import { activeAnimation, RIG_LIMITS, setAnimationDuration } from "@/app/components/motion-studio/engine/rig";
import { staggered } from "@/app/components/motion-studio/engine/text";
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
  if (clip.type === "rig") return activeAnimation(clip) !== null;
  return clip.type === "sprite" || clip.type === "ribbon" || clip.type === "text";
}

/**
 * The clip with its main length changed by `delta` seconds: a picture's
 * travel time, a ribbon's draw time, a text's reveal. Letter-by-letter and
 * typed text spread the change over their letter gaps so the rhythm scales.
 */
export function trimClip<T extends Clip>(clip: T, delta: number): T {
  switch (clip.type) {
    case "sprite":
      // A video's bar is how long it plays; a picture's is its travel.
      if (clip.source.kind === "video") {
        const longest = Math.max(MIN_TRIM, clip.source.length > 0 ? clip.source.length - clip.source.trimStart : 600);
        return { ...clip, source: { ...clip.source, playFor: round(clamp(clip.source.playFor + delta, MIN_TRIM, Math.min(longest, 600))) } };
      }
      return { ...clip, duration: round(clamp(clip.duration + delta, MIN_TRIM, MAX_TRIM)) };
    case "ribbon":
      return { ...clip, duration: round(clamp(clip.duration + delta, MIN_TRIM, MAX_TRIM)) };
    case "rig": {
      // A rig clip's length rescales its key times with it (the rig contract's rule).
      const anim = activeAnimation(clip);
      if (!anim) return clip;
      return { ...clip, rig: setAnimationDuration(clip.rig, anim.id, round(clamp(anim.duration + delta, MIN_TRIM, RIG_LIMITS.duration))) };
    }
    case "text": {
      if (!staggered(clip)) return { ...clip, revealDuration: round(clamp(clip.revealDuration + delta, 0.1, MAX_TRIM)) };
      const letters = Array.from(clip.text).length;
      const gaps = clip.reveal === "typewriter" ? letters - 1 : clip.direction === "center" ? Math.ceil(letters / 2) : letters;
      const spread = Math.max(1, gaps);
      return { ...clip, letterStagger: Number(clamp(clip.letterStagger + delta / spread, 0, 1).toFixed(4)) };
    }
    default:
      return clip;
  }
}
