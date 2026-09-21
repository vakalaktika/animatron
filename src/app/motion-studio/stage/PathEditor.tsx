"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { parentTransformAt, spritePath } from "@/app/components/motion-studio/engine/transform";
import type { SpriteClip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";

interface Props {
  doc: StudioDoc;
  clip: SpriteClip;
  time: MotionValue<number>;
  zoom: number;
  /** Delta in stage pixels; the caller converts it into the parent's frame. */
  onMovePoint: (index: number, delta: Vec2) => void;
}

/**
 * Draws the selected sprite's spline with draggable waypoints. Path points
 * live in the sprite's parent frame, so the whole drawing rides the parent's
 * live transform; for a root sprite that frame is the stage itself.
 */
export function PathEditor({ doc, clip, time, zoom, onMovePoint }: Props) {
  const sampler = spritePath(clip);
  const drag = useRef<{ index: number; lastX: number; lastY: number } | null>(null);
  const handleRadius = 9 / zoom;
  const frame = useTransform(time, (t) => {
    const w = parentTransformAt(doc, clip.id, t);
    return `translate(${w.x} ${w.y}) scale(${w.scaleX} ${w.scaleY}) rotate(${w.rotation})`;
  });

  const d = sampler.polyline
    .map((p, i) => `${i === 0 ? "M" : "L"}${(clip.x + p.x).toFixed(1)} ${(clip.y + p.y).toFixed(1)}`)
    .join(" ");

  const start = (index: number) => (e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    drag.current = { index, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<SVGCircleElement>) => {
    const dr = drag.current;
    if (!dr) return;
    onMovePoint(dr.index, { x: (e.clientX - dr.lastX) / zoom, y: (e.clientY - dr.lastY) / zoom });
    dr.lastX = e.clientX;
    dr.lastY = e.clientY;
  };
  const end = () => {
    drag.current = null;
  };

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <motion.g transform={frame}>
      <path d={d} fill="none" stroke="#2b6cb0" strokeWidth={2 / zoom} strokeDasharray={`${8 / zoom} ${6 / zoom}`} />
      {clip.path.map((p, i) => (
        <g key={i}>
          <circle
            cx={clip.x + p.x}
            cy={clip.y + p.y}
            r={handleRadius}
            fill={i === clip.path.length - 1 && !clip.loop ? "#c33a26" : "#2b6cb0"}
            stroke="#fff"
            strokeWidth={2 / zoom}
            style={{ cursor: "move", pointerEvents: "all" }}
            onPointerDown={start(i)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <text
            x={clip.x + p.x + handleRadius * 1.4}
            y={clip.y + p.y - handleRadius * 0.6}
            fontSize={12 / zoom}
            fill="#2b6cb0"
            style={{ pointerEvents: "none", fontFamily: "var(--font-work-sans), sans-serif" }}
          >
            {i + 1}
          </text>
        </g>
      ))}
      </motion.g>
    </svg>
  );
}
