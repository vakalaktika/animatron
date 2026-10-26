import type { StudioDoc, TailSide, TextClip, TextReveal, Vec2 } from "../types";
import { backOut, clamp01, EASE_PRESETS, lerp } from "./easing";
import { restTransformAt } from "./transform";

/** Where the tail comes out of the box and how far it reaches, or null when no tail shows. */
export interface ResolvedTail {
  side: TailSide;
  position: number;
  length: number;
}

export const AUTO_TAIL_POSITION = 38;
export const AUTO_TAIL_LENGTH = 15;

/** Does this clip draw a tail at all? Needs a container and a tail mode other than none. */
export function hasTail(clip: TextClip): boolean {
  return clip.container.shape !== "none" && clip.tail.mode !== "none";
}

/** Side of the box that faces `toward` from the tip: the box hangs on the opposite side. */
function sideFacing(toward: Vec2): TailSide {
  if (Math.abs(toward.y) >= Math.abs(toward.x)) return toward.y > 0 ? "bottom" : "top";
  return toward.x > 0 ? "right" : "left";
}

/**
 * The tail to draw. Manual mode uses the stored side / position / length.
 * Auto mode aims at the parent's resting anchor (or hangs below the tip
 * when the clip is a root) with a fixed emergence point and length.
 */
export function resolveTail(doc: StudioDoc, clip: TextClip): ResolvedTail | null {
  if (!hasTail(clip)) return null;
  if (clip.tail.mode === "manual") {
    return { side: clip.tail.side, position: clip.tail.position, length: clip.tail.length };
  }
  const side = clip.parentId ? sideFacing(parentDirection(doc, clip)) : "bottom";
  return { side, position: AUTO_TAIL_POSITION, length: AUTO_TAIL_LENGTH };
}

function parentDirection(doc: StudioDoc, clip: TextClip): Vec2 {
  const tip = restTransformAt(doc, clip.id);
  const parent = restTransformAt(doc, clip.parentId ?? "");
  return { x: parent.x - tip.x, y: parent.y - tip.y };
}

/** Point on the box edge where the tail meets it, relative to the tip (the clip's origin). */
export function tailBase(tail: ResolvedTail): Vec2 {
  switch (tail.side) {
    case "bottom":
      return { x: 0, y: -tail.length };
    case "top":
      return { x: 0, y: tail.length };
    case "left":
      return { x: tail.length, y: 0 };
    case "right":
      return { x: -tail.length, y: 0 };
  }
}

/** Seconds the typing caret keeps blinking after the last letter, and its blink half-period. */
export const CARET_LINGER = 1.2;
const CARET_BLINK = 0.4;

/** Where the letter reveal starts in each glyph's lift (px) and blur (px). */
const LETTER_RISE = 8;
const LETTER_BLUR = 2;
/** Blur at the start of the blur-in reveal, in px. */
const FOCUS_BLUR = 12;
/** How far below its slot a masked glyph starts, as a fraction of its own height. */
const MASK_DROP = 1.05;

/** Reveals that bring each glyph in on its own clock. */
export const staggered = (clip: TextClip) => clip.reveal === "letters" || clip.reveal === "typewriter";

/** 0..1 progress of a whole-clip reveal (pop, fade, blur, mask) at time `t`. */
export function revealProgress(clip: TextClip, t: number): number {
  return clamp01((t - clip.start) / Math.max(0.001, clip.revealDuration));
}

/**
 * Seconds after the clip start when glyph `index` of `count` begins. Typing
 * always runs left to right; the letter reveal follows `direction`.
 */
export function letterDelay(clip: TextClip, index: number, count: number): number {
  if (clip.reveal === "typewriter") return index * clip.letterStagger;
  const center = (count - 1) / 2;
  const order =
    clip.direction === "center" ? Math.abs(index - center) : clip.direction === "left" ? index : count - 1 - index;
  return order * clip.letterStagger;
}

/**
 * 0..1 arrival of glyph `index` at time `t`. Letters ease in one by one,
 * typing snaps each glyph on, blur and mask move every glyph together, and
 * pop and fade (whole-clip transforms) leave the glyphs alone.
 */
export function glyphProgress(clip: TextClip, index: number, count: number, t: number): number {
  switch (clip.reveal) {
    case "letters": {
      const at = clip.start + letterDelay(clip, index, count);
      return EASE_PRESETS.smoothOut(clamp01((t - at) / Math.max(0.001, clip.letterDuration)));
    }
    case "typewriter":
      return t >= clip.start + letterDelay(clip, index, count) ? 1 : 0;
    case "blur":
    case "mask":
      return EASE_PRESETS.smoothOut(revealProgress(clip, t));
    default:
      return 1;
  }
}

/**
 * How a glyph looks at arrival `p`: its opacity, a lift in px, a drop as a
 * fraction of its own height (the mask slides it up from behind its slot,
 * which the view clips), and a blur in px.
 */
export interface GlyphLook {
  opacity: number;
  rise: number;
  drop: number;
  blur: number;
}

export function glyphLook(reveal: TextReveal, p: number): GlyphLook {
  switch (reveal) {
    case "letters":
      return { opacity: p, rise: lerp(LETTER_RISE, 0, p), drop: 0, blur: lerp(LETTER_BLUR, 0, p) };
    case "blur":
      return { opacity: clamp01(p * 2), rise: 0, drop: 0, blur: lerp(FOCUS_BLUR, 0, p) };
    case "mask":
      return { opacity: 1, rise: 0, drop: lerp(MASK_DROP, 0, p), blur: 0 };
    default:
      return { opacity: p, rise: 0, drop: 0, blur: 0 };
  }
}

/**
 * The glyph the typing caret sits after at time `t`, or null when it is not
 * showing. It is solid while typing, then blinks for `CARET_LINGER` seconds
 * after the last letter and goes.
 */
export function caretAfter(clip: TextClip, count: number, t: number): number | null {
  if (clip.reveal !== "typewriter" || count === 0) return null;
  const local = t - clip.start;
  if (local < 0) return null;
  const typedAll = (count - 1) * clip.letterStagger;
  if (local < typedAll) return Math.min(count - 1, Math.floor(local / Math.max(0.001, clip.letterStagger)));
  const since = local - typedAll;
  if (since >= CARET_LINGER) return null;
  return Math.floor(since / CARET_BLINK) % 2 === 0 ? count - 1 : null;
}

/** Scale and opacity contributed by the reveal to the clip's transform. */
export function revealTransform(clip: TextClip, t: number): { scale: number; opacity: number } {
  if (clip.reveal === "pop") {
    const p = revealProgress(clip, t);
    return { scale: backOut(clip.overshoot)(p), opacity: clamp01(p * 8) };
  }
  if (clip.reveal === "fade") {
    return { scale: 1, opacity: EASE_PRESETS.smoothOut(revealProgress(clip, t)) };
  }
  return { scale: 1, opacity: 1 };
}

/** Seconds the reveal itself takes, before any rule. Typing includes the caret's last blinks. */
export function revealDuration(clip: TextClip): number {
  const letters = Array.from(clip.text).length;
  if (clip.reveal === "typewriter") return Math.max(0, letters - 1) * clip.letterStagger + CARET_LINGER;
  if (clip.reveal !== "letters") return clip.revealDuration;
  const spread = clip.direction === "center" ? Math.ceil(letters / 2) : letters;
  return spread * clip.letterStagger + clip.letterDuration;
}
