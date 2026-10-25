import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";

/**
 * Offline video rendering. The composition is stepped frame by frame on its
 * own clock, each frame rasterised from the live DOM (html-to-image draws the
 * stage into a canvas through an SVG foreignObject, fonts and pictures
 * inlined), then encoded with WebCodecs and muxed in the page. No screen
 * capture, no real-time constraint, works on phones that have WebCodecs.
 * Browsers without WebCodecs fall back to MediaRecorder on a canvas stream,
 * which plays the frames out in real time.
 */

export interface RenderPlan {
  /** Frame size; H.264 wants even dimensions. */
  width: number;
  height: number;
  fps: number;
  /** Seconds of composition to render. */
  duration: number;
  /** Painted under the stage when it is see-through; MP4 has no alpha. */
  background: string;
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
  extension: "mp4" | "webm";
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

/** Picks the first H.264 profile the encoder accepts for this frame size, else a VP9 WebM, else nothing. */
async function pickCodec(width: number, height: number): Promise<{ codec: string; container: "mp4" | "webm" } | null> {
  if (typeof VideoEncoder === "undefined") return null;
  const candidates: { codec: string; container: "mp4" | "webm" }[] = [
    { codec: "avc1.640028", container: "mp4" },
    { codec: "avc1.4d0028", container: "mp4" },
    { codec: "avc1.42e028", container: "mp4" },
    { codec: "vp09.00.10.08", container: "webm" },
    { codec: "vp8", container: "webm" },
  ];
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

/** Rasterises the stage as it is right now. The embedded font CSS is reused across frames. */
async function paintFrame(node: HTMLElement, plan: RenderPlan, fontEmbedCSS: string, target: CanvasRenderingContext2D) {
  const shot = await toCanvas(node, {
    width: plan.width,
    height: plan.height,
    pixelRatio: 1,
    cacheBust: false,
    fontEmbedCSS,
    backgroundColor: plan.background,
  });
  target.fillStyle = plan.background;
  target.fillRect(0, 0, plan.width, plan.height);
  target.drawImage(shot, 0, 0, plan.width, plan.height);
}

/** Renders the composition to a video file. */
export async function renderVideo(input: RenderPlan, hooks: RenderHooks): Promise<RenderResult> {
  const plan: RenderPlan = { ...input, width: even(input.width), height: even(input.height) };
  const node = hooks.node();
  if (!node) throw new Error("The stage is not ready to render");
  const total = Math.max(1, Math.round(plan.duration * plan.fps));
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw frames");
  const fontEmbedCSS = await getFontEmbedCSS(node);
  const check = () => {
    if (hooks.signal?.aborted) throw new RenderCancelled();
  };

  const codec = await pickCodec(plan.width, plan.height);
  if (codec) {
    const muxer =
      codec.container === "mp4"
        ? new Mp4Muxer({ target: new Mp4Target(), video: { codec: "avc", width: plan.width, height: plan.height }, fastStart: "in-memory" })
        : new WebmMuxer({ target: new WebmTarget(), video: { codec: codec.codec.startsWith("vp09") ? "V_VP9" : "V_VP8", width: plan.width, height: plan.height } });
    let failure: Error | null = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        failure = e;
      },
    });
    encoder.configure({ codec: codec.codec, width: plan.width, height: plan.height, bitrate: 8_000_000, framerate: plan.fps });
    const frameMicros = Math.round(1_000_000 / plan.fps);
    for (let i = 0; i < total; i++) {
      check();
      await hooks.seek(i / plan.fps);
      await paintFrame(node, plan, fontEmbedCSS, ctx);
      const frame = new VideoFrame(canvas, { timestamp: i * frameMicros, duration: frameMicros });
      encoder.encode(frame, { keyFrame: i % (plan.fps * 2) === 0 });
      frame.close();
      if (failure) throw failure;
      hooks.onProgress?.(i + 1, total);
      // Let the encoder drain so memory stays flat on long pieces.
      if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    const buffer = (muxer.target as Mp4Target | WebmTarget).buffer;
    return { blob: new Blob([buffer], { type: codec.container === "mp4" ? "video/mp4" : "video/webm" }), extension: codec.container };
  }

  // No WebCodecs: play the frames out in real time into a MediaRecorder.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });
  recorder.start(250);
  const started = performance.now();
  for (let i = 0; i < total; i++) {
    check();
    await hooks.seek(i / plan.fps);
    await paintFrame(node, plan, fontEmbedCSS, ctx);
    track.requestFrame?.();
    hooks.onProgress?.(i + 1, total);
    const due = started + ((i + 1) * 1000) / plan.fps;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  return { blob: await stopped, extension: "webm" };
}
