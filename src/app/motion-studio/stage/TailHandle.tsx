"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { resolveTail, tailBase } from "@/app/components/motion-studio/engine/text";
import { toLocalDelta, toWorldPoint, transformAt } from "@/app/components/motion-studio/engine/transform";
import type { StudioDoc, TextClip, TextTail, Vec2 } from "@/app/components/motion-studio/types";

interface Props {
  doc: StudioDoc;
  clip: TextClip;
  time: MotionValue<number>;
  zoom: number;
  onChange: (next: TextClip) => void;
}

/**
 * Applies a drag of the tail's base point, given in the clip's own frame.
 * Along the tail's axis the drag changes its length; across it the box
 * slides, which reads as the tail's emergence point moving.
 */
export function dragTail(tail: TextTail, delta: Vec2): TextTail {
  const along: Record<TextTail["side"], number> = { bottom: -delta.y, top: delta.y, left: delta.x, right: -delta.x };
  const across: Record<TextTail["side"], number> = { bottom: delta.x, top: delta.x, left: delta.y, right: delta.y };
  return {
    ...tail,
    length: Math.max(0, tail.length + along[tail.side]),
    position: Math.max(0, tail.position - across[tail.side]),
  };
}

/** Draggable handle on the tail's base for a text clip in manual tail mode. */
export function TailHandle({ doc, clip, time, zoom, onChange }: Props) {
  const drag = useRef<{ lastX: number; lastY: number } | null>(null);
  const tail = resolveTail(doc, clip);
  const base = tail ? tailBase(tail) : { x: 0, y: 0 };
  const world = useTransform(time, (t) => toWorldPoint(transformAt(doc, clip.id, t), base));
  const cx = useTransform(world, (p) => p.x);
  const cy = useTransform(world, (p) => p.y);
  const r = 8 / zoom;

  const start = (e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    drag.current = { lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<SVGCircleElement>) => {
    const d = drag.current;
    if (!d) return;
    const stageDelta = { x: (e.clientX - d.lastX) / zoom, y: (e.clientY - d.lastY) / zoom };
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    const local = toLocalDelta(transformAt(doc, clip.id, time.get()), stageDelta);
    onChange({ ...clip, tail: dragTail(clip.tail, local) });
  };
  const end = () => {
    drag.current = null;
  };

  if (!tail) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#c33a26"
        stroke="#fff"
        strokeWidth={2 / zoom}
        style={{ cursor: "move", pointerEvents: "all" }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
    </svg>
  );
}
