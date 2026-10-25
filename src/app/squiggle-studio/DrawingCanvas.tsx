"use client";

import { type PointerEvent, useRef } from "react";
import { bands } from "./lib/geometry";
import type { Point, Stroke } from "./types";

interface DrawingCanvasProps {
  colors: string[];
  band: number;
  strokes: Stroke[];
  current: Point[] | null;
  hover: number | null;
  onBegin: (p: Point) => void;
  onExtend: (p: Point) => void;
  onEnd: () => void;
}

/**
 * The drawing surface. A single full-bleed `<svg>` captures the pointer, maps
 * client coordinates into its own space, and renders every committed stroke
 * plus the one in progress as fanned rainbow bands. Non-hovered strokes dim so
 * the hovered one reads clearly. The dotted paper is the stage's own.
 */
export function DrawingCanvas({ colors, band, strokes, current, hover, onBegin, onExtend, onEnd }: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const pos = (e: PointerEvent): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onBegin(pos(e));
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!current) return;
    onExtend(pos(e));
  };

  const showHint = strokes.length === 0 && !current;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border-strong bg-surface-raised shadow-[var(--atm-shadow-md)]">
      <svg
        ref={svgRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onPointerLeave={onEnd}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        style={{
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--ink) 18%, transparent) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-label="Drawing canvas"
      >
        {strokes.map((s) => (
          <g key={s.id} opacity={hover == null || hover === s.id ? 1 : 0.25}>
            {bands(s.pts, colors, band).map((b, i) => (
              <path key={i} d={b.d} fill="none" stroke={b.color} strokeWidth={b.w} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        ))}
        {current &&
          bands(current, colors, band).map((b, i) => (
            <path key={i} d={b.d} fill="none" stroke={b.color} strokeWidth={b.w} strokeLinecap="round" strokeLinejoin="round" />
          ))}
      </svg>
      {showHint && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
          <p className="font-display text-lg text-ink-muted">Click and drag (or draw with a finger) to make a squiggle</p>
        </div>
      )}
    </div>
  );
}
