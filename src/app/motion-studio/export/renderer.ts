import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { getFontEmbedCSS, toSvg } from "html-to-image";
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";

/**
 * Offline rendering. The composition is stepped frame by frame on its own
 * clock, each frame rasterised from the live DOM (html-to-image draws the
 * stage into a canvas through an SVG foreignObject, fonts and pictures
 * inlined), then encoded in the page. No screen capture, no real-time
 * constraint, works on phones that have WebCodecs, and keeps its pace when
 * the tab is hidden because nothing here waits on the frame loop.
 *
 * Three outputs share the frame loop:
 * - MP4 (H.264) or WebM (VP9): WebCodecs VideoEncoder + muxer, with the
 *   sound track encoded alongside (AAC or Opus). Browsers without WebCodecs
 *   fall back to MediaRecorder on a canvas stream, which plays the frames
 *   out in real time.
 * - Transparent WebM: MediaRecorder keeps the canvas alpha, which the
 *   VideoEncoder path does not, so a see-through render always takes that
 *   route.
 * - GIF: frames quantised to 256 colours per frame, at a lower rate and
 *   size; one-bit transparency when the stage is see-through.
 */

export type RenderFormat = "mp4" | "webm" | "gif";

export interface RenderPlan {
  /** Frame size; H.264 wants even dimensions. */
  width: number;
  height: number;
  fps: number;
  /** Seconds of composition to render. */
  duration: number;
  /** Painted under the stage when it is not see-through. */
  background: string;
  format: RenderFormat;
  /** Keep the stage's transparency (WebM and GIF only; MP4 has no alpha). */
  alpha: boolean;
  /** GIF: output width in pixels (height follows the stage aspect). */
  gifWidth?: number;
  /** The sound mixed down to the composition's length, or none. */
  audio?: AudioBuffer | null;
}

export interface RenderHooks {
  /** Moves the composition's clock and resolves once the DOM shows that moment. */
  seek: (seconds: number) => Promise<void>;
  /** The stage node at native size. */
  node: () => HTMLElement | null;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface RenderResult {
  blob: Blob;
  extension: "mp4" | "webm" | "gif";
  /** True when a sound track was asked for but could not be included. */
  silent: boolean;
  /** How the sound was encoded, when it was. */
  audioCodec?: "aac" | "opus";
}

export class RenderCancelled extends Error {
  constructor() {
    super("Rendering was cancelled");
    this.name = "RenderCancelled";
  }
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/** Whether this browser can render video without screen capture at all. */
export function canRenderOffline(): boolean {
  if (typeof window === "undefined") return false;
  return "VideoEncoder" in window || ("MediaRecorder" in window && "captureStream" in HTMLCanvasElement.prototype);
}

/** Whether a see-through WebM can be made here (needs a canvas recorder). */
export function canRenderAlpha(): boolean {
  return typeof window !== "undefined" && "MediaRecorder" in window && "captureStream" in HTMLCanvasElement.prototype;
}

/** Picks the first codec the encoder accepts for this frame size, honouring the asked-for container. */
async function pickCodec(width: number, height: number, format: "mp4" | "webm"): Promise<{ codec: string; container: "mp4" | "webm" } | null> {
  if (typeof VideoEncoder === "undefined") return null;
  const mp4: { codec: string; container: "mp4" | "webm" }[] = [
    { codec: "avc1.640028", container: "mp4" },
    { codec: "avc1.4d0028", container: "mp4" },
    { codec: "avc1.42e028", container: "mp4" },
  ];
  const webm: { codec: string; container: "mp4" | "webm" }[] = [
    { codec: "vp09.00.10.08", container: "webm" },
    { codec: "vp8", container: "webm" },
  ];
  const candidates = format === "mp4" ? [...mp4, ...webm] : [...webm, ...mp4];
  for (const c of candidates) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec: c.codec, width, height, bitrate: 8_000_000, framerate: 30 });
      if (supported) return c;
    } catch {
      // Unknown codec string on this platform: try the next.
    }
  }
  return null;
}

/**
 * Yields to the event loop through a message port. Unlike timers and
 * animation frames, these are not slowed to once a second when the tab is
 * hidden or covered, so a render keeps its pace in the background.
 */
const yieldToBrowser = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });

/** Loads the SVG snapshot as an image without waiting on the frame loop. */
async function decodeSnapshot(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  await yieldToBrowser();
  return img;
}

/** Rasterises the stage as it is right now. The embedded font CSS is reused across frames. */
async function paintFrame(node: HTMLElement, plan: RenderPlan, fontEmbedCSS: string, target: CanvasRenderingContext2D) {
  const svg = await toSvg(node, { width: plan.width, height: plan.height, cacheBust: false, fontEmbedCSS });
  const shot = await decodeSnapshot(svg);
  target.clearRect(0, 0, plan.width, plan.height);
  if (!plan.alpha) {
    target.fillStyle = plan.background;
    target.fillRect(0, 0, plan.width, plan.height);
  }
  target.drawImage(shot, 0, 0, plan.width, plan.height);
}

interface Frame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  fontEmbedCSS: string;
  node: HTMLElement;
  total: number;
  check: () => void;
}

async function prepare(plan: RenderPlan, hooks: RenderHooks, fps: number): Promise<Frame> {
  const node = hooks.node();
  if (!node) throw new Error("The stage is not ready to render");
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Could not draw frames");
  const fontEmbedCSS = await getFontEmbedCSS(node);
  return {
    canvas,
    ctx,
    fontEmbedCSS,
    node,
    total: Math.max(1, Math.round(plan.duration * fps)),
    check: () => {
      if (hooks.signal?.aborted) throw new RenderCancelled();
    },
  };
}

// ----- Sound -----------------------------------------------------------------

/** Planar float samples for a slice of the buffer, laid out channel after channel. */
function planar(buffer: AudioBuffer, from: number, count: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(new ArrayBuffer(count * buffer.numberOfChannels * 4));
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    buffer.copyFromChannel(out.subarray(ch * count, (ch + 1) * count), ch, from);
  }
  return out;
}

interface AudioLane {
  encoder: AudioEncoder;
  codec: "aac" | "opus";
  flush: () => Promise<void>;
}

/** Sets up the sound encoder for the container, or null when this browser has none that fits. */
async function openAudio(container: "mp4" | "webm", audio: AudioBuffer, onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void): Promise<AudioLane | null> {
  if (typeof AudioEncoder === "undefined") return null;
  // AAC is what MP4 players expect; browsers built without it (Chromium on
  // Linux, for one) can still write Opus into the MP4, which Chrome, Firefox
  // and VLC play.
  const wanted: { codec: string; kind: "aac" | "opus" }[] =
    container === "mp4"
      ? [
          { codec: "mp4a.40.2", kind: "aac" },
          { codec: "opus", kind: "opus" },
        ]
      : [{ codec: "opus", kind: "opus" }];
  for (const c of wanted) {
    try {
      const config: AudioEncoderConfig = { codec: c.codec, sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels, bitrate: 128_000 };
      const { supported } = await AudioEncoder.isConfigSupported(config);
      if (!supported) continue;
      let failure: Error | null = null;
      const encoder = new AudioEncoder({
        output: onChunk,
        error: (e) => {
          failure = e;
        },
      });
      encoder.configure(config);
      return {
        encoder,
        codec: c.kind,
        flush: async () => {
          await encoder.flush();
          if (failure) throw failure;
          encoder.close();
        },
      };
    } catch {
      // Try the next codec.
    }
  }
  return null;
}

/** Feeds the whole mix to the encoder in half-second pieces. */
function encodeAudio(lane: AudioLane, audio: AudioBuffer) {
  const piece = Math.round(audio.sampleRate / 2);
  for (let from = 0; from < audio.length; from += piece) {
    const count = Math.min(piece, audio.length - from);
    const data = new AudioData({
      format: "f32-planar",
      sampleRate: audio.sampleRate,
      numberOfFrames: count,
      numberOfChannels: audio.numberOfChannels,
      timestamp: Math.round((from / audio.sampleRate) * 1_000_000),
      data: planar(audio, from, count),
    });
    lane.encoder.encode(data);
    data.close();
  }
}

// ----- Video through WebCodecs ------------------------------------------------

async function renderEncoded(plan: RenderPlan, hooks: RenderHooks, codec: { codec: string; container: "mp4" | "webm" }): Promise<RenderResult> {
  const frame = await prepare(plan, hooks, plan.fps);
  const wantAudio = !!plan.audio;

  // The sound is encoded first, offline and in one go. If that fails the
  // file is built without an audio track rather than lost.
  let lane: AudioLane | null = null;
  const audioChunks: { chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }[] = [];
  if (plan.audio) {
    try {
      lane = await openAudio(codec.container, plan.audio, (chunk, meta) => audioChunks.push({ chunk, meta }));
      if (lane) {
        encodeAudio(lane, plan.audio);
        await lane.flush();
      }
    } catch {
      lane = null;
      audioChunks.length = 0;
    }
  }
  const audioTrack = lane && plan.audio ? { codec: lane.codec, sampleRate: plan.audio.sampleRate, numberOfChannels: plan.audio.numberOfChannels } : null;

  const muxer =
    codec.container === "mp4"
      ? new Mp4Muxer({
          target: new Mp4Target(),
          video: { codec: "avc", width: plan.width, height: plan.height },
          audio: audioTrack ? { codec: audioTrack.codec, sampleRate: audioTrack.sampleRate, numberOfChannels: audioTrack.numberOfChannels } : undefined,
          fastStart: "in-memory",
        })
      : new WebmMuxer({
          target: new WebmTarget(),
          video: { codec: codec.codec.startsWith("vp09") ? "V_VP9" : "V_VP8", width: plan.width, height: plan.height },
          audio: audioTrack ? { codec: audioTrack.codec === "opus" ? "A_OPUS" : "A_AAC", sampleRate: audioTrack.sampleRate, numberOfChannels: audioTrack.numberOfChannels } : undefined,
        });

  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure({ codec: codec.codec, width: plan.width, height: plan.height, bitrate: 8_000_000, framerate: plan.fps });
  const frameMicros = Math.round(1_000_000 / plan.fps);
  try {
    for (let i = 0; i < frame.total; i++) {
      frame.check();
      await hooks.seek(i / plan.fps);
      await paintFrame(frame.node, plan, frame.fontEmbedCSS, frame.ctx);
      const vf = new VideoFrame(frame.canvas, { timestamp: i * frameMicros, duration: frameMicros });
      encoder.encode(vf, { keyFrame: i % (plan.fps * 2) === 0 });
      vf.close();
      if (failure) throw failure;
      hooks.onProgress?.(i + 1, frame.total);
      // Let the encoder drain so memory stays flat on long pieces.
      if (encoder.encodeQueueSize > 8) await yieldToBrowser();
    }
    await encoder.flush();
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  for (const { chunk, meta } of audioChunks) muxer.addAudioChunk(chunk, meta);
  muxer.finalize();
  const buffer = (muxer.target as Mp4Target | WebmTarget).buffer;
  return {
    blob: new Blob([buffer], { type: codec.container === "mp4" ? "video/mp4" : "video/webm" }),
    extension: codec.container,
    silent: wantAudio && !lane,
    audioCodec: lane?.codec,
  };
}

// ----- Video through MediaRecorder (alpha, or no WebCodecs) ------------------

async function renderRecorded(plan: RenderPlan, hooks: RenderHooks): Promise<RenderResult> {
  const frame = await prepare(plan, hooks, plan.fps);
  const stream = frame.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };

  // Sound: the mix plays into the stream through an audio context, in step
  // with the real-time frame pacing below.
  let audioCtx: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  const wantAudio = !!plan.audio;
  if (plan.audio && typeof AudioContext !== "undefined") {
    try {
      audioCtx = new AudioContext({ sampleRate: plan.audio.sampleRate });
      const dest = audioCtx.createMediaStreamDestination();
      source = audioCtx.createBufferSource();
      source.buffer = plan.audio;
      source.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {
      audioCtx = null;
      source = null;
    }
  }

  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp9", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });
  // The first frame is on the canvas before recording starts, so the file opens on it.
  await hooks.seek(0);
  await paintFrame(frame.node, plan, frame.fontEmbedCSS, frame.ctx);
  recorder.start(250);
  if (audioCtx && source) {
    await audioCtx.resume();
    source.start();
  }
  const started = performance.now();
  try {
    for (let i = 0; i < frame.total; i++) {
      frame.check();
      await hooks.seek(i / plan.fps);
      await paintFrame(frame.node, plan, frame.fontEmbedCSS, frame.ctx);
      track.requestFrame?.();
      hooks.onProgress?.(i + 1, frame.total);
      const due = started + ((i + 1) * 1000) / plan.fps;
      const wait = due - performance.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  } finally {
    try {
      source?.stop();
    } catch {
      // Already ended.
    }
  }
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await stopped;
  stream.getTracks().forEach((t) => t.stop());
  void audioCtx?.close();
  return { blob, extension: "webm", silent: wantAudio && !source };
}

// ----- GIF -------------------------------------------------------------------

async function renderGif(plan: RenderPlan, hooks: RenderHooks): Promise<RenderResult> {
  const fps = Math.min(plan.fps, 20);
  const frame = await prepare(plan, hooks, fps);
  const outW = even(Math.min(plan.gifWidth ?? plan.width, plan.width));
  const outH = even(Math.round((outW * plan.height) / plan.width));
  const small = document.createElement("canvas");
  small.width = outW;
  small.height = outH;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new Error("Could not draw frames");
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  const format = plan.alpha ? "rgba4444" : "rgb565";
  for (let i = 0; i < frame.total; i++) {
    frame.check();
    await hooks.seek(i / fps);
    await paintFrame(frame.node, plan, frame.fontEmbedCSS, frame.ctx);
    sctx.clearRect(0, 0, outW, outH);
    sctx.drawImage(frame.canvas, 0, 0, outW, outH);
    const { data } = sctx.getImageData(0, 0, outW, outH);
    const palette = quantize(data, 256, { format, oneBitAlpha: plan.alpha ? true : undefined });
    const index = applyPalette(data, palette, format);
    const transparentIndex = plan.alpha ? palette.findIndex((c) => c[3] === 0) : -1;
    gif.writeFrame(index, outW, outH, {
      palette,
      delay,
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: plan.alpha ? 2 : 0,
    });
    hooks.onProgress?.(i + 1, frame.total);
    if (i % 4 === 3) await yieldToBrowser();
  }
  gif.finish();
  return { blob: new Blob([gif.bytes() as BlobPart], { type: "image/gif" }), extension: "gif", silent: false };
}

/** Renders the composition to a file in the asked-for format. */
export async function renderVideo(input: RenderPlan, hooks: RenderHooks): Promise<RenderResult> {
  const plan: RenderPlan = { ...input, width: even(input.width), height: even(input.height), alpha: input.alpha && input.format !== "mp4" };
  if (plan.format === "gif") return renderGif(plan, hooks);
  // A see-through WebM needs the canvas recorder: VideoEncoder drops alpha.
  if (plan.alpha) return renderRecorded(plan, hooks);
  const codec = await pickCodec(plan.width, plan.height, plan.format);
  if (codec) return renderEncoded(plan, hooks, codec);
  return renderRecorded(plan, hooks);
}
