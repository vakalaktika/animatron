"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clipEnd } from "@/app/components/motion-studio/engine/timing";
import type { AudioTrack, Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { Button, Select, Toggle } from "@/app/components/shared-components";
import { DragHandle, MoveButtons } from "./reorderChrome";
import { PauseIcon, PlayIcon, ReplayIcon } from "./icons";
import { rowMotion, useReorderDrag } from "./useReorderDrag";
import { SoundRow } from "./SoundRow";
import { WaypointMarkers } from "./WaypointMarkers";
import { canTrim, trimClip } from "../lib/trim";

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
  /** Waypoint being edited on the selected sprite; its keyframe is highlighted. */
  selectedPoint?: number | null;
  /** A keyframe was pressed: select that sprite and waypoint. */
  onSelectWaypoint: (clipId: string, index: number) => void;
  /** A keyframe was dragged or nudged to a new travel time. */
  onRetimeWaypoint: (clipId: string, index: number, travel: number) => void;
  /** Same effect as the clip's Start slider. */
  onSetStart: (id: string, start: number) => void;
  /** The sound track changed (dragged on the timeline). */
  onChangeAudio: (next: AudioTrack) => void;
  /** The sound lane was picked: open the canvas settings, where its controls live. */
  onSelectAudio: () => void;
  /** Nothing is selected and the sound lane should read as picked. */
  audioSelected?: boolean;
  /** The end of a bar was dragged: the clip with its length changed. */
  onChangeClip: (clip: Clip) => void;
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
  ribbon: "var(--chart-5)",
};

/** Percent span of a clip on a timeline of `duration` seconds, clamped to it. */
export function barSpan(clip: Clip, duration: number): { left: number; width: number; clipped: boolean } {
  if (duration <= 0) return { left: 0, width: 0, clipped: false };
  const left = Math.min(100, Math.max(0, (clip.start / duration) * 100));
  const rawEnd = (clipEnd(clip) / duration) * 100;
  const end = Math.min(100, rawEnd);
  return { left, width: Math.max(0.5, end - left), clipped: rawEnd > 100 };
}

/** Tick spacing that keeps labels legible for the composition's length. */
function tickStep(duration: number): number {
  if (duration <= 4) return 0.5;
  if (duration <= 12) return 1;
  if (duration <= 30) return 2;
  return 5;
}

/** Seconds along the top of the tracks; press or drag anywhere on it to move the playhead. */
function Ruler({ duration, now, onSeek }: { duration: number; now: number; onSeek: (s: number) => void }) {
  const step = tickStep(duration);
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(Number(t.toFixed(2)));
  const scrubbing = useRef(false);
  const seekTo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration)));
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={now}
      aria-valuetext={`${now.toFixed(2)} seconds`}
      className="relative h-6 min-w-0 flex-1 cursor-ew-resize touch-none select-none border-b border-hairline"
      onPointerDown={(e) => {
        scrubbing.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekTo(e);
      }}
      onPointerMove={(e) => {
        if (scrubbing.current) seekTo(e);
      }}
      onPointerUp={() => {
        scrubbing.current = false;
      }}
      onPointerCancel={() => {
        scrubbing.current = false;
      }}
      onKeyDown={(e) => {
        const nudge = e.shiftKey ? 1 : 0.1;
        if (e.key === "ArrowLeft") onSeek(Math.max(0, now - nudge));
        if (e.key === "ArrowRight") onSeek(Math.min(duration, now + nudge));
        if (e.key === "Home") onSeek(0);
        if (e.key === "End") onSeek(duration);
      }}
    >
      {ticks.map((t) => (
        <span
          key={t}
          aria-hidden="true"
          className="absolute bottom-0 flex flex-col items-start"
          style={{ left: `${(t / duration) * 100}%` }}
        >
          <span className="ml-1 -mt-px font-sans text-[10px] leading-3 tabular-nums tracking-[0.04em] text-ink-muted">{Number.isInteger(t) ? `${t}s` : t.toFixed(1)}</span>
          <span className="h-1 w-px bg-border-strong" />
        </span>
      ))}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-px h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 rounded-[2px] bg-accent"
        style={{ left: `${duration > 0 ? (now / duration) * 100 : 0}%` }}
      />
    </div>
  );
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
  onChangeAudio,
  onSelectAudio,
  audioSelected = false,
  onChangeClip,
  onReorder,
  selectedPoint = null,
  onSelectWaypoint,
  onRetimeWaypoint,
  layout = "full",
}: Props) {
  const [now, setNow] = useState(0);
  useMotionValueEvent(time, "change", (t) => setNow(t));
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    trackRef.current?.querySelector<HTMLElement>(`[data-track-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId, doc.clips.length]);
  const pct = duration > 0 ? (now / duration) * 100 : 0;

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

  // Right-edge trim: the clip as it was at pickup, and the pointer's start.
  const trimDrag = useRef<{ clip: Clip; startX: number } | null>(null);
  const secondsPerPixel = () => {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const labelWidth = parseFloat(getComputedStyle(track).getPropertyValue("--label-w")) || 0;
    return duration / (track.getBoundingClientRect().width - labelWidth);
  };
  const onTrimDown = (clip: Clip) => (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    onSelect(clip.id);
    trimDrag.current = { clip, startX: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onTrimMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const d = trimDrag.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) * secondsPerPixel();
    onChangeClip(trimClip(d.clip, Math.round(delta / START_STEP) * START_STEP));
  };
  const onTrimUp = () => {
    trimDrag.current = null;
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
      <div className="flex items-center gap-1.5 bg-surface-raised px-2 py-0.5" data-tour="scrub">
        {playButton}
        {replayButton}
        {scrubber}
        {readout}
      </div>
    );
  }

  const stacked = layout === "tracks";
  const tracks = (
    <div
      ref={(el) => {
        trackRef.current = el;
        reorder.attachContainer(el);
      }}
      className={`relative ${stacked ? "space-y-0.5" : "space-y-1"}`}
    >
      {doc.clips.map((clip, i) => {
        const { left, width, clipped } = barSpan(clip, duration);
        const isSelected = selectedId === clip.id;
        const motion = rowMotion(i, reorder.state);
        const trimEl = canTrim(clip) ? (
          <span
            role="slider"
            tabIndex={0}
            aria-label={`${clip.name} length`}
            aria-valuemin={0}
            aria-valuenow={Number((clipEnd(clip) - clip.start).toFixed(2))}
            aria-valuetext={`${(clipEnd(clip) - clip.start).toFixed(2)} seconds long`}
            className={`t-trim absolute z-[1] w-2.5 cursor-col-resize touch-none rounded-r-full pointer-coarse:w-4 ${stacked ? "top-0 h-full" : "top-0.5 h-4 pointer-coarse:top-2 pointer-coarse:h-7"}`}
            style={{ left: `calc(${left + width}% - ${10}px)` }}
            onPointerDown={onTrimDown(clip)}
            onPointerMove={onTrimMove}
            onPointerUp={onTrimUp}
            onPointerCancel={onTrimUp}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") onChangeClip(trimClip(clip, -START_STEP));
              if (e.key === "ArrowRight") onChangeClip(trimClip(clip, START_STEP));
            }}
          />
        ) : null;
        const barEl = (
        <span
          role="slider"
          tabIndex={0}
          aria-label={`${clip.name} start`}
          aria-valuemin={0}
          aria-valuenow={clip.start}
          aria-valuetext={`${clip.start.toFixed(2)} seconds`}
          className={`t-drag-bar absolute ${stacked ? "" : "top-0.5 h-4"} cursor-ew-resize touch-none rounded-full ${stacked ? "top-0 h-full" : "pointer-coarse:top-2 pointer-coarse:h-7"} ${draggingBar === clip.id ? "is-dragging" : ""}`}
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
        );
        const markers =
          clip.type === "sprite" ? (
            <WaypointMarkers
              clip={clip}
              duration={duration}
              selected={isSelected ? selectedPoint : null}
              onSelect={(index) => onSelectWaypoint(clip.id, index)}
              onRetime={(index, travel) => onRetimeWaypoint(clip.id, index, travel)}
            />
          ) : null;
        // Phone timeline: name and time on one line, the bar across the full
        // width below it, so names aren't squeezed into a narrow column.
        if (stacked) {
          return (
            <div
              key={clip.id}
              data-reorder-row
              data-track-id={clip.id}
              className={`group flex items-center gap-0.5 rounded-md py-1 pr-1 ${isSelected ? "bg-primary-soft" : ""} ${motion.className}`}
              style={motion.style}
            >
              <DragHandle className="w-5 shrink-0 text-center" label={`Drag to restack ${clip.name}`} index={i} {...reorder.handleProps} />
              <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center gap-2 pl-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(clip.id)}
                  className="h-full min-w-0 flex-1 truncate text-left text-[13px] leading-5 text-ink"
                  aria-label={`${clip.name}, ${clip.start.toFixed(2)}s to ${clipEnd(clip).toFixed(2)}s`}
                >
                  {clip.name}
                </button>
                <span aria-hidden="true" className="shrink-0 font-sans text-[11px] tabular-nums tracking-[0.04em] text-ink-muted">
                  {clip.start.toFixed(1)}–{clipEnd(clip).toFixed(1)}s
                </span>
              </div>
              <div className="relative mt-1 h-5 overflow-hidden">
                {barEl}
                {trimEl}
                {markers}
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${pct}%` }} />
              </div>
              </div>
            </div>
          );
        }
        return (
          <div
            key={clip.id}
            data-reorder-row
            data-track-id={clip.id}
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
              {barEl}
              {trimEl}
              {markers}
            </div>
          </div>
        );
      })}
      {doc.audio && (
        <SoundRow
          doc={doc}
          duration={duration}
          selected={audioSelected}
          secondsPerPixel={secondsPerPixel}
          onSelect={onSelectAudio}
          onChange={onChangeAudio}
          stacked={stacked}
          labelWidth={LABEL_W}
        />
      )}
      {!stacked && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 bottom-0 w-0.5 bg-accent"
          style={{ left: `calc(${LABEL_W} + (100% - ${LABEL_W}) * ${pct / 100})` }}
        />
      )}
    </div>
  );

  // Mobile timeline tab: playback lives in the bar, so this is speed, loop and tracks.
  if (layout === "tracks") {
    return (
      <div className="space-y-2 bg-surface-raised px-3 py-2 [--label-w:22px]">
        <div className="flex items-center justify-between gap-4 px-1">{speedAndLoop}</div>
        {tracks}
      </div>
    );
  }

  return (
    <div className="bg-surface-raised px-4 pb-3 [--label-w:190px]">
      <div className="sticky top-0 z-[2] -mx-4 space-y-3 bg-surface-raised px-4 pt-3 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        {playButton}
        {replayButton}
        <span className="w-28">{readout}</span>
        {speedAndLoop}
      </div>
      <div className="flex" data-tour="scrub">
        <span style={{ width: LABEL_W }} className="shrink-0" aria-hidden="true" />
        <Ruler duration={duration} now={now} onSeek={onSeek} />
      </div>
      </div>
      <div className="pt-1">{tracks}</div>
    </div>
  );
}
