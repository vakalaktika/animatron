"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { propKeyTimes, retimedPropKeyTime } from "@/app/components/motion-studio/engine/keys";
import type { Clip } from "@/app/components/motion-studio/types";

interface Props {
  clip: Clip;
  /** Composition length: the lane spans 0..duration seconds. */
  duration: number;
  /** Clock time to park the playhead on. */
  onSeek: (seconds: number) => void;
  /** The keys at clip-local `time` dragged to clip-local `to`. */
  onRetime: (time: number, to: number) => void;
}

const STEP = 0.05;
const BIG_STEP = 0.25;

/**
 * A clip's keyframes on its timeline lane: one solid diamond per key time,
 * across all its animated properties (a sprite's waypoints keep their own
 * open diamonds). Pressing one parks the playhead there; dragging or the
 * arrow keys move every key at that time, never past a neighbour.
 */
export function PropKeyMarkers({ clip, duration, onSeek, onRetime }: Props) {
  const drag = useRef<{ time: number; startX: number; pxPerSecond: number } | null>(null);
  const times = propKeyTimes(clip);
  if (times.length === 0 || duration <= 0) return null;
  const pct = (seconds: number) => ((clip.start + seconds) / duration) * 100;
  const last = times[times.length - 1];

  const onPointerDown = (time: number) => (e: PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    onSeek(clip.start + time);
    const lane = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!lane) return;
    drag.current = { time, startX: e.clientX, pxPerSecond: lane.width / duration };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    // Follow the keys to where they actually land (clamped between neighbours), so a drag never loses them.
    const to = retimedPropKeyTime(clip, d.time, d.time + (e.clientX - d.startX) / d.pxPerSecond);
    if (Math.abs(to - d.time) < 0.005) return;
    onRetime(d.time, to);
    onSeek(clip.start + to);
    drag.current = { ...d, time: to, startX: e.clientX };
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (time: number) => (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSeek(clip.start + time);
      return;
    }
    const step = e.shiftKey ? BIG_STEP : STEP;
    const delta = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
    if (!delta) return;
    e.preventDefault();
    onRetime(time, retimedPropKeyTime(clip, time, time + delta));
  };

  return (
    <>
      {times.map((time, i) => {
        const at = pct(time);
        if (at > 100) return null;
        const seconds = (clip.start + time).toFixed(2);
        return (
          <span
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={`${clip.name} keyframe at ${seconds} seconds`}
            aria-valuemin={Number(clip.start.toFixed(2))}
            aria-valuemax={Number((clip.start + Math.max(last, duration)).toFixed(2))}
            aria-valuenow={Number(seconds)}
            aria-valuetext={`${seconds} seconds`}
            style={{ left: `${at}%` }}
            onPointerDown={onPointerDown(time)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown(time)}
            className="absolute top-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center pointer-coarse:h-7 pointer-coarse:w-7"
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 border border-surface-raised bg-ink transition-transform duration-150 hover:scale-125" />
          </span>
        );
      })}
    </>
  );
}
