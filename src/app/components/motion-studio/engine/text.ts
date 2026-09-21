import type { StudioDoc, TailSide, TextClip, Vec2 } from "../types";
import { backOut, clamp01, EASE_PRESETS } from "./easing";
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

/** 0..1 progress of a pop or fade reveal at time `t`. */
export function revealProgress(clip: TextClip, t: number): number {
  return clamp01((t - clip.start) / Math.max(0.001, clip.revealDuration));
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

/** Seconds the reveal itself takes, before any rule. */
export function revealDuration(clip: TextClip): number {
  if (clip.reveal !== "letters") return clip.revealDuration;
  const letters = Array.from(clip.text).length;
  const spread = clip.direction === "center" ? Math.ceil(letters / 2) : letters;
  return spread * clip.letterStagger + clip.letterDuration;
}
