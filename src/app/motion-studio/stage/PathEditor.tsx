"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { ribbonPath } from "@/app/components/motion-studio/engine/ribbon";
import { spritePath } from "@/app/components/motion-studio/engine/spriteTiming";
import { parentTransformAt } from "@/app/components/motion-studio/engine/transform";
import type { RibbonClip, SpriteClip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";

interface Props {
  doc: StudioDoc;
  clip: SpriteClip | RibbonClip;
  time: MotionValue<number>;
  zoom: number;
  /** Delta in stage pixels; the caller converts it into the parent's frame. */
  onMovePoint: (index: number, delta: Vec2) => void;
  selectedPoint: number | null;
  /** Pressing a handle selects that waypoint for editing. */
  onSelectPoint: (index: number) => void;
}

/**
 * Draws the selected sprite's or ribbon's spline with draggable waypoints.
 * Points live in the clip's parent frame, so the whole drawing rides the
 * parent's live transform; for a root clip that frame is the stage itself.
 */
export function PathEditor({ doc, clip, time, zoom, onMovePoint, selectedPoint, onSelectPoint }: Props) {
  const sampler = clip.type === "sprite" ? spritePath(clip) : ribbonPath(clip);
  const points = clip.type === "sprite" ? clip.path : clip.points;
  // A landing sprite's last point is its anchor; it is drawn red to say so.
  const markEnd = clip.type === "sprite" && !clip.loop;
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
    onSelectPoint(index);
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
      <path d={d} fill="none" stroke="var(--info)" strokeWidth={2 / zoom} strokeDasharray={`${8 / zoom} ${6 / zoom}`} />
      {points.map((p, i) => (
        <g key={i}>
          {i === selectedPoint && (
            <circle
              cx={clip.x + p.x}
              cy={clip.y + p.y}
              r={handleRadius * 1.75}
              fill="none"
              stroke="#e3a51f"
              strokeWidth={3 / zoom}
            />
          )}
          <circle
            cx={clip.x + p.x}
            cy={clip.y + p.y}
            r={handleRadius}
            fill={markEnd && i === points.length - 1 ? "var(--accent)" : "var(--info)"}
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
            fill="var(--info)"
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
