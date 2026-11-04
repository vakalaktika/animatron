"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * An SVG group placed by a live SVG `transform` attribute. `motion.g` would
 * apply a `transform` value as a CSS transform about the group's own centre,
 * which reads SVG syntax (`translate(10 20)`) as invalid and drops it, so the
 * attribute is written by hand on every change.
 */
export function SvgFrame({ transform, children }: { transform: MotionValue<string>; children: ReactNode }) {
  const ref = useRef<SVGGElement>(null);
  useMotionValueEvent(transform, "change", (v) => ref.current?.setAttribute("transform", v));
  return (
    <g ref={ref} transform={transform.get()}>
      {children}
    </g>
  );
}
