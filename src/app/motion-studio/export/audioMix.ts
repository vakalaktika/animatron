import { getMedia } from "@/app/components/motion-studio/engine/media";
import type { AudioTrack } from "@/app/components/motion-studio/types";

/** Opus wants 48 kHz; AAC is happy with it too. */
export const MIX_SAMPLE_RATE = 48_000;

/**
 * The composition's sound as one buffer exactly `duration` seconds long:
 * silence until the track comes in, the trimmed file at its volume, a fade
 * at the end. Rendered offline, so it is sample-exact and instant.
 */
export async function mixAudio(audio: AudioTrack, duration: number): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === "undefined" || typeof AudioContext === "undefined") return null;
  const record = await getMedia(audio.mediaId);
  if (!record) return null;
  const decoder = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await record.blob.arrayBuffer());
  } finally {
    void decoder.close();
  }
  const length = Math.max(1, Math.ceil(duration * MIX_SAMPLE_RATE));
  const channels = Math.min(2, Math.max(1, decoded.numberOfChannels));
  const ctx = new OfflineAudioContext(channels, length, MIX_SAMPLE_RATE);
  const source = ctx.createBufferSource();
  source.buffer = decoded;
  const gain = ctx.createGain();
  const volume = Math.min(1, Math.max(0, audio.volume));
  gain.gain.setValueAtTime(volume, 0);
  if (audio.fadeOut > 0 && duration > audio.fadeOut) {
    gain.gain.setValueAtTime(volume, duration - audio.fadeOut);
    gain.gain.linearRampToValueAtTime(0, duration);
  }
  source.connect(gain).connect(ctx.destination);
  const available = Math.max(0, decoded.duration - audio.trimStart);
  const play = Math.min(available, duration - audio.offset);
  if (play <= 0) return ctx.startRendering();
  source.start(audio.offset, audio.trimStart, play);
  return ctx.startRendering();
}
