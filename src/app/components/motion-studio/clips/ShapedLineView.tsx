"use client";

import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useEffect, useId, useRef } from "react";
import type { LineSubject } from "../engine/line";
import { chunksMarkup, hueAt, lineChunks, type Centerline } from "../engine/lineShape";
import type { LineStyle } from "../types";

interface Props {
  line: Centerline;
  style: LineStyle;
  subject: LineSubject;
  colors: string[];
  band: number;
  time: MotionValue<number>;
  /** Fraction of the line every lit stretch is pulled back by. */
  shift?: number;
}

/** Glow blur radius at full strength, in stage pixels. */
const GLOW_BLUR = 10;

/**
 * A line whose lit stretch is rebuilt every frame as filled polygons
 * (engine/lineShape.ts), for the looks the dash renderer cannot do: a comet
 * that tapers and fades smoothly, a braid, a nib, echoes, colour that
 * varies along the line. The polygons are written straight into the DOM on
 * each clock tick rather than through React, since their count changes
 * from frame to frame.
 */
export function ShapedLineView({ line, style, subject, colors, band, time, shift = 0 }: Props) {
  const body = useRef<SVGGElement>(null);
  const glow = useRef<SVGGElement>(null);
  const filterId = useId();
  const hue = useTransform(time, (t) => `hue-rotate(${hueAt(style, t).toFixed(1)}deg)`);

  const paint = (t: number) => {
    const markup = chunksMarkup(lineChunks(line, style, subject, colors, band, t, shift));
    if (body.current) body.current.innerHTML = markup;
    if (glow.current) glow.current.innerHTML = markup;
  };
  useMotionValueEvent(time, "change", paint);
  // Draw the current frame on mount and whenever the line or its style changes.
  useEffect(() => {
    paint(time.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `paint` closes over exactly these
  }, [line, style, subject, colors, band, time, shift]);

  return (
    <motion.g style={{ filter: style.colour === "cycle" ? hue : undefined }}>
      {style.glow > 0 && (
        <>
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={2 + GLOW_BLUR * style.glow} />
            </filter>
          </defs>
          <g ref={glow} filter={`url(#${filterId})`} opacity={0.5 + 0.5 * style.glow} />
        </>
      )}
      <g ref={body} />
    </motion.g>
  );
}
