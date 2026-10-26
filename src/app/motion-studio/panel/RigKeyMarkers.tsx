"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { activeAnimation, keyTimes } from "@/app/components/motion-studio/engine/rig";
import type { RigClip } from "@/app/components/motion-studio/types";

interface Props {
  clip: RigClip;
  /** Composition length: the lane spans 0..duration seconds. */
  duration: number;
  /** Bone whose keys are highlighted and moved alone; null moves every bone's key at that time. */
  selectedBone: string | null;
  /** Clock time to park the playhead on. */
  onSeek: (seconds: number) => void;
  /** A key at clip-local `time` dragged to clip-local `to`. */
  onRetime: (time: number, to: number) => void;
}

const STEP = 0.05;
const BIG_STEP = 0.25;

/**
 * A rig's animation keys on its timeline lane: one diamond per key time
 * (the selected bone's keys filled in). Pressing one parks the playhead
 * there; dragging moves the key. Keys of a looping clip repeat every lap,
 * but only the first lap is shown, where they are edited.
 */
export function RigKeyMarkers({ clip, duration, selectedBone, onSeek, onRetime }: Props) {
  const anim = activeAnimation(clip);
  const drag = useRef<{ time: number; startX: number; pxPerSecond: number } | null>(null);
  if (!anim || duration <= 0) return null;
  const times = keyTimes(anim);
  const own = new Set(anim.tracks.find((t) => t.boneId === selectedBone)?.keys.map((k) => k.time) ?? []);
  const pct = (seconds: number) => ((clip.start + seconds) / duration) * 100;

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
    const to = d.time + (e.clientX - d.startX) / d.pxPerSecond;
    if (Math.abs(to - d.time) < 0.005) return;
    onRetime(d.time, Number(to.toFixed(2)));
    d.time = Number(to.toFixed(2));
    d.startX = e.clientX;
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
    onRetime(time, Number((time + delta).toFixed(2)));
  };

  return (
    <>
      {times.map((time) => {
        const at = pct(time);
        if (at > 100) return null;
        const mine = own.has(time);
        return (
          <span
            key={time}
            role="slider"
            tabIndex={0}
            aria-label={`${clip.name} key at ${(clip.start + time).toFixed(2)} seconds`}
            aria-valuemin={Number(clip.start.toFixed(2))}
            aria-valuemax={Number((clip.start + anim.duration).toFixed(2))}
            aria-valuenow={Number((clip.start + time).toFixed(2))}
            aria-valuetext={`${(clip.start + time).toFixed(2)} seconds`}
            style={{ left: `${at}%` }}
            onPointerDown={onPointerDown(time)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown(time)}
            className="absolute top-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center pointer-coarse:h-7 pointer-coarse:w-7"
          >
            <span aria-hidden="true" className={`rotate-45 border border-ink transition-transform duration-150 ${mine ? "h-2.5 w-2.5 bg-highlight" : "h-2 w-2 bg-surface-raised hover:scale-125"}`} />
          </span>
        );
      })}
    </>
  );
}
