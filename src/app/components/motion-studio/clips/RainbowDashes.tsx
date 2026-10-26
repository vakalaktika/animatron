"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import type { Band } from "../engine/rainbow";
import type { TrailWindow } from "../engine/trail";

/**
 * A comet fades toward its tail by stacking the lit stretch in slices that
 * start further and further from the tail. Slice k's opacity is chosen so the
 * stack reads k/STEPS where k slices overlap: a linear ramp from faint at the
 * tail to solid at the head. The slices use flat caps so their ends don't
 * show as stacked rounds; only the head slice is round-capped. Sixteen steps
 * is past the point where the eye can tell a ramp from a gradient.
 */
const FADE_STEPS = 16;
const FADE_SLICES = Array.from({ length: FADE_STEPS }, (_, k) => ({
  from: k / FADE_STEPS,
  opacity: 1 / (FADE_STEPS + 1 - (k + 1)),
  cap: (k === FADE_STEPS - 1 ? "round" : "butt") as "round" | "butt",
}));
const SOLID = [{ from: 0, opacity: 1, cap: "round" as const }];
/**
 * Extra gap (fraction of the path) after each dash. Without it the pattern's
 * next dash starts exactly at the end of an open path, and its round cap
 * shows there as a stray dot; a looping window's wrapped part shifts by this
 * much, which is invisible.
 */
const REPEAT_SLACK = 0.001;

interface Props {
  bands: Band[];
  /** The lit stretch, as fractions of the path, live. */
  window: MotionValue<TrailWindow>;
  /** Fade toward the tail (comet) instead of a hard edge. */
  fade: boolean;
}

/**
 * Rainbow bands lit along a window of their length. Each band is a dash:
 * `pathOffset` is the tail, `pathLength` the lit stretch. The dash pattern
 * repeats every path length, which is what lets a window wrap around the
 * join of a looping path.
 */
export function RainbowDashes({ bands, window, fade }: Props) {
  const slices = fade ? FADE_SLICES : SOLID;
  return (
    <>
      {slices.map((slice) => (
        <Slice key={slice.from} bands={bands} window={window} from={slice.from} opacity={slice.opacity} cap={slice.cap} />
      ))}
    </>
  );
}

/** Every band, lit from `from` (a fraction of the window) to the head. */
function Slice({
  bands,
  window,
  from,
  opacity,
  cap,
}: {
  bands: Band[];
  window: MotionValue<TrailWindow>;
  from: number;
  opacity: number;
  cap: "round" | "butt";
}) {
  const pathLength = useTransform(window, (w) => Math.max(0.0001, w.length * (1 - from)));
  const pathOffset = useTransform(window, (w) => w.tail + w.length * from);
  const pathSpacing = useTransform(window, (w) => Math.max(0, 1 - w.length * (1 - from)) + REPEAT_SLACK);
  return (
    <g opacity={opacity}>
      {bands.map((b, i) => (
        <motion.path
          key={i}
          d={b.d}
          fill="none"
          stroke={b.color}
          strokeWidth={b.w}
          strokeLinecap={cap}
          strokeLinejoin="round"
          style={{ pathLength, pathOffset, pathSpacing }}
        />
      ))}
    </g>
  );
}

/** Every band fully lit, no animation: a resting coat. */
export function RainbowSolid({ bands }: { bands: Band[] }) {
  return (
    <>
      {bands.map((b, i) => (
        <path key={i} d={b.d} fill="none" stroke={b.color} strokeWidth={b.w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </>
  );
}
