"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clipEnd } from "@/app/components/motion-studio/engine/timing";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { Button, Select, Toggle } from "@/app/components/shared-components";
import { DragHandle, MoveButtons } from "./reorderChrome";
import { PauseIcon, PlayIcon, ReplayIcon } from "./icons";
import { rowMotion, useReorderDrag } from "./useReorderDrag";

interface Props {
  doc: StudioDoc;
  time: MotionValue<number>;
  duration: number;
  playing: boolean;
  speed: number;
  loop: boolean;
  selectedId: string | null;
  onToggle: () => void;
  onReplay: () => void;
  onSeek: (s: number) => void;
  onSpeed: (s: number) => void;
  onLoop: (v: boolean) => void;
  onSelect: (id: string) => void;
  /** Same effect as the clip's Start slider. */
  onSetStart: (id: string, start: number) => void;
  /** Row order is stacking order: later rows render on top of earlier ones. */
  onReorder: (from: number, to: number) => void;
  /**
   * full — desktop: controls, scrubber and tracks together.
   * bar — mobile: the compact playback strip pinned under the stage.
   * tracks — mobile Timeline tab: speed, loop and the clip tracks.
   */
  layout?: "full" | "bar" | "tracks";
}

const SPEEDS = [0.1, 0.25, 0.5, 1, 1.5, 2];
const START_STEP = 0.05;
// Timeline label column width lives in the --label-w custom property (set
// per layout below) so the drag math reads the rendered width.
const LABEL_W = "var(--label-w)";

const TYPE_COLOR: Record<Clip["type"], string> = {
  logo: "var(--chart-3)",
  sprite: "var(--chart-2)",
  text: "var(--chart-1)",
  lottie: "var(--chart-4)",
};

/** Percent span of a clip on a timeline of `duration` seconds, clamped to it. */
export function barSpan(clip: Clip, duration: number): { left: number; width: number; clipped: boolean } {
  if (duration <= 0) return { left: 0, width: 0, clipped: false };
  const left = Math.min(100, Math.max(0, (clip.start / duration) * 100));
  const rawEnd = (clipEnd(clip) / duration) * 100;
  const end = Math.min(100, rawEnd);
  return { left, width: Math.max(0.5, end - left), clipped: rawEnd > 100 };
}

/** Play controls, scrubber, and a timeline showing when each clip runs. */
export function Transport({
  doc,
  time,
  duration,
  playing,
  speed,
  loop,
  selectedId,
  onToggle,
  onReplay,
  onSeek,
  onSpeed,
  onLoop,
  onSelect,
  onSetStart,
  onReorder,
  layout = "full",
}: Props) {
  const [now, setNow] = useState(0);
  useMotionValueEvent(time, "change", (t) => setNow(t));
  const pct = duration > 0 ? (now / duration) * 100 : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const barDrag = useRef<{ id: string; startX: number; startValue: number } | null>(null);
  const [draggingBar, setDraggingBar] = useState<string | null>(null);
  const reorder = useReorderDrag(onReorder);

  const onBarDown = (clip: Clip) => (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    onSelect(clip.id);
    barDrag.current = { id: clip.id, startX: e.clientX, startValue: clip.start };
    setDraggingBar(clip.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBarMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const d = barDrag.current;
    const track = trackRef.current;
    if (!d || !track || duration <= 0) return;
    const labelWidth = parseFloat(getComputedStyle(track).getPropertyValue("--label-w")) || 0;
    const trackWidth = track.getBoundingClientRect().width - labelWidth;
    const seconds = ((e.clientX - d.startX) / trackWidth) * duration;
    const next = Math.max(0, Math.round((d.startValue + seconds) / START_STEP) * START_STEP);
    onSetStart(d.id, Number(next.toFixed(2)));
  };
  const onBarUp = () => {
    barDrag.current = null;
    setDraggingBar(null);
  };

  const playButton = (
    <Button
      size="sm"
      onClick={onToggle}
      aria-label={playing ? "Pause" : "Play"}
      icon={playing ? <PauseIcon /> : <PlayIcon />}
      className={layout === "bar" ? "min-w-11 !rounded-full !px-0" : ""}
    >
      {layout === "bar" ? null : playing ? "Pause" : "Play"}
    </Button>
  );
  const replayButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={onReplay}
      aria-label="Replay"
      icon={<ReplayIcon />}
      className={layout === "bar" ? "min-w-11 !rounded-full !border-transparent !px-0 hover:!shadow-none" : ""}
    >
      {layout === "bar" ? null : "Replay"}
    </Button>
  );
  const readout = (
    <span className="shrink-0 font-sans text-xs tabular-nums tracking-[0.04em] text-ink-secondary">
      {now.toFixed(2)}
      <span className="text-ink-muted"> / {duration.toFixed(2)}s</span>
    </span>
  );
  const scrubber = (
    <input
      type="range"
      aria-label="Scrub"
      className="w-full min-w-0"
      min={0}
      max={duration}
      step={0.01}
      value={now}
      onChange={(e) => onSeek(Number(e.target.value))}
    />
  );
  const speedAndLoop = (
    <>
      <label className="flex items-center gap-2 atm-label">
        Speed
        <Select variant="compact" value={String(speed)} onChange={(e) => onSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </Select>
      </label>
      <Toggle size="sm" checked={loop} onChange={onLoop} label="Loop" />
    </>
  );

  // Mobile: the always-visible playback strip under the stage.
  if (layout === "bar") {
    return (
      <div className="flex items-center gap-2 bg-surface-raised px-3 py-1.5">
        {playButton}
        {replayButton}
        {scrubber}
        {readout}
      </div>
    );
  }

  const tracks = (
    <div
      ref={(el) => {
        trackRef.current = el;
        reorder.attachContainer(el);
      }}
      className="relative space-y-1"
    >
      {doc.clips.map((clip, i) => {
        const { left, width, clipped } = barSpan(clip, duration);
        const isSelected = selectedId === clip.id;
        const motion = rowMotion(i, reorder.state);
        return (
          <div
            key={clip.id}
            data-reorder-row
            className={`group flex h-5 items-center rounded pointer-coarse:h-11 ${isSelected ? "bg-primary-soft" : ""} ${motion.className}`}
            style={motion.style}
          >
            <div style={{ width: LABEL_W }} className="flex h-full shrink-0 items-center gap-0.5 pr-2">
              <DragHandle label={`Drag to restack ${clip.name}`} index={i} {...reorder.handleProps} />
              <button
                type="button"
                onClick={() => onSelect(clip.id)}
                className="h-full min-w-0 flex-1 truncate text-left text-[11px] leading-5 text-ink pointer-coarse:text-[13px]"
                aria-label={`${clip.name}, ${clip.start.toFixed(2)}s to ${clipEnd(clip).toFixed(2)}s`}
              >
                {clip.name}
              </button>
              <MoveButtons
                label={clip.name}
                canUp={i > 0}
                canDown={i < doc.clips.length - 1}
                onUp={() => onReorder(i, i - 1)}
                onDown={() => onReorder(i, i + 1)}
              />
            </div>
            <div className="relative h-full min-w-0 flex-1 overflow-hidden">
              <span
                role="slider"
                tabIndex={0}
                aria-label={`${clip.name} start`}
                aria-valuemin={0}
                aria-valuenow={clip.start}
                aria-valuetext={`${clip.start.toFixed(2)} seconds`}
                className={`t-drag-bar absolute top-0.5 h-4 cursor-ew-resize touch-none rounded-full pointer-coarse:top-2 pointer-coarse:h-7 ${draggingBar === clip.id ? "is-dragging" : ""}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: TYPE_COLOR[clip.type],
                  opacity: clip.enabled ? 0.85 : 0.25,
                  borderTopRightRadius: clipped ? 0 : undefined,
                  borderBottomRightRadius: clipped ? 0 : undefined,
                }}
                title={clipped ? "Runs past the end of the enabled composition" : undefined}
                onPointerDown={onBarDown(clip)}
                onPointerMove={onBarMove}
                onPointerUp={onBarUp}
                onPointerCancel={onBarUp}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") onSetStart(clip.id, Math.max(0, Number((clip.start - START_STEP).toFixed(2))));
                  if (e.key === "ArrowRight") onSetStart(clip.id, Number((clip.start + START_STEP).toFixed(2)));
                }}
              />
            </div>
          </div>
        );
      })}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1 bottom-0 w-0.5 bg-accent"
        style={{ left: `calc(${LABEL_W} + (100% - ${LABEL_W}) * ${pct / 100})` }}
      />
    </div>
  );

  // Mobile timeline tab: playback lives in the bar, so this is speed, loop and tracks.
  if (layout === "tracks") {
    return (
      <div className="space-y-4 bg-surface-raised px-4 py-4 [--label-w:136px] sm:[--label-w:190px]">
        <div className="flex items-center justify-between gap-4">{speedAndLoop}</div>
        {tracks}
        <p className="atm-help">Drag a bar to change when a clip starts. Drag the grip to restack.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-surface-raised px-4 py-3 [--label-w:190px]">
      <div className="flex flex-wrap items-center gap-3">
        {playButton}
        {replayButton}
        <span className="w-28">{readout}</span>
        {speedAndLoop}
        <span className="ml-auto text-xs text-ink-muted">
          Drag a bar to change its start · drag ⋮⋮ to restack · Space: play/pause · R: replay · Esc: exit clean mode
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ width: `calc(${LABEL_W} - 8px)` }} className="shrink-0" aria-hidden="true" />
        {scrubber}
      </div>
      {tracks}
    </div>
  );
}
