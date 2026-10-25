import type { Clip } from "@/app/components/motion-studio/types";

/** Shortest a trimmed clip can get, in seconds. */
export const MIN_TRIM = 0.2;
export const MAX_TRIM = 30;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Number(v.toFixed(2));

/**
 * Whether dragging the end of this clip's bar can change how long it runs.
 * Lotties play their own length and the logo build is a fixed choreography.
 */
export function canTrim(clip: Clip): boolean {
  return clip.type === "sprite" || clip.type === "ribbon" || clip.type === "text";
}

/**
 * The clip with its main length changed by `delta` seconds: a picture's
 * travel time, a ribbon's draw time, a text's reveal. Letter-by-letter text
 * spreads the change over its letter gaps so the rhythm scales.
 */
export function trimClip<T extends Clip>(clip: T, delta: number): T {
  switch (clip.type) {
    case "sprite":
    case "ribbon":
      return { ...clip, duration: round(clamp(clip.duration + delta, MIN_TRIM, MAX_TRIM)) };
    case "text": {
      if (clip.reveal !== "letters") return { ...clip, revealDuration: round(clamp(clip.revealDuration + delta, 0.1, MAX_TRIM)) };
      const letters = Array.from(clip.text).length;
      const spread = Math.max(1, clip.direction === "center" ? Math.ceil(letters / 2) : letters);
      return { ...clip, letterStagger: Number(clamp(clip.letterStagger + delta / spread, 0, 1).toFixed(4)) };
    }
    default:
      return clip;
  }
}
