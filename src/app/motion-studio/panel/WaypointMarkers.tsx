"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { spriteTiming } from "@/app/components/motion-studio/engine/spriteTiming";
import type { SpriteClip } from "@/app/components/motion-studio/types";

interface Props {
  clip: SpriteClip;
  /** Composition length: the lane spans 0..duration seconds. */
  duration: number;
  /** Waypoint being edited on this clip, if any. */
  selected: number | null;
  onSelect: (index: number) => void;
  /** New travel time for a waypoint, in seconds from the clip start (holds excluded). */
  onRetime: (index: number, travel: number) => void;
}

const STEP = 0.05;
const BIG_STEP = 0.25;

/**
 * A sprite's waypoint keyframes on its timeline lane, drawn over the clip's
 * bar with a band for each hold. Pressing a keyframe selects its waypoint;
 * dragging it sideways changes only when the sprite gets there (never the
 * clip's start or the waypoint's values). The first and last keyframes are
 * pinned to the travel's start and end, so they select but don't move.
 */
export function WaypointMarkers({ clip, duration, selected, onSelect, onRetime }: Props) {
  const timing = spriteTiming(clip);
  const drag = useRef<{ index: number; startX: number; startTravel: number; pxPerSecond: number } | null>(null);
  if (duration <= 0) return null;
  const pct = (seconds: number) => ((clip.start + seconds) / duration) * 100;

  const onPointerDown = (index: number) => (e: PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    onSelect(index);
    const lane = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!timing.points[index].movable || !lane) return;
    drag.current = { index, startX: e.clientX, startTravel: timing.points[index].travel, pxPerSecond: lane.width / duration };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    onRetime(d.index, d.startTravel + (e.clientX - d.startX) / d.pxPerSecond);
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(index);
      return;
    }
    const step = e.shiftKey ? BIG_STEP : STEP;
    const delta = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
    if (!delta || !timing.points[index].movable) return;
    e.preventDefault();
    onSelect(index);
    onRetime(index, timing.points[index].travel + delta);
  };

  return (
    <>
      {timing.points.map((point, i) =>
        point.leave > point.arrive && pct(point.arrive) <= 100 ? (
          <span
            key={`hold-${i}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 bg-ink/20"
            style={{ left: `${pct(point.arrive)}%`, width: `${Math.min(100, pct(point.leave)) - pct(point.arrive)}%` }}
          />
        ) : null,
      )}
      {timing.points.map((point, i) => {
        const at = pct(point.arrive);
        if (at > 100) return null;
        const isSelected = i === selected;
        const name = `${clip.name} waypoint ${i + 1}`;
        const arrive = clip.start + point.arrive;
        const common = {
          tabIndex: 0,
          style: { left: `${at}%` },
          onPointerDown: onPointerDown(i),
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          onKeyDown: onKeyDown(i),
          className: `absolute top-1/2 z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center pointer-coarse:h-7 pointer-coarse:w-7 ${
            point.movable ? "cursor-ew-resize" : "cursor-pointer"
          }`,
        };
        const diamond = (
          <span
            aria-hidden="true"
            className={`rotate-45 border border-ink transition-transform duration-150 ${
              isSelected ? "h-2.5 w-2.5 bg-highlight" : "h-2 w-2 bg-surface-raised hover:scale-125"
            }`}
          />
        );
        return point.movable ? (
          <span
            key={i}
            role="slider"
            aria-label={`${name} arrival time`}
            aria-valuemin={Number((clip.start + (timing.points[i - 1]?.arrive ?? 0)).toFixed(2))}
            aria-valuemax={Number((clip.start + (timing.points[i + 1]?.arrive ?? clip.duration)).toFixed(2))}
            aria-valuenow={Number(arrive.toFixed(2))}
            aria-valuetext={`Arrives at ${arrive.toFixed(2)} seconds`}
            {...common}
          >
            {diamond}
          </span>
        ) : (
          <span key={i} role="button" aria-label={`Select ${name}`} aria-pressed={isSelected} {...common}>
            {diamond}
          </span>
        );
      })}
    </>
  );
}
