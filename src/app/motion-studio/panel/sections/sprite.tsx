"use client";

import { spriteTiming, WAYPOINT_DEFAULTS } from "@/app/components/motion-studio/engine/spriteTiming";
import type { SpriteClip, Waypoint } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { EaseField } from "../EaseField";
import { BUTTON_ROW, MoreFields, NumField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

/** Size, timing, easing, bank, flip, fade, loop. */
export function motionSection(clip: SpriteClip, onChange: (c: SpriteClip) => void): PanelSection {
  const set = setter(clip, onChange);
  return {
    id: "motion",
    title: "Motion",
    content: (
      <>
        <NumField label="Width" unit="px" value={clip.width} min={40} max={1200} step={1} onChange={(v) => set("width", v)} />
        <NumField label="Travel time" unit="s" value={clip.duration} min={0.2} max={12} onChange={(v) => set("duration", v)} />
        <ToggleField label="Loop around the path forever" value={clip.loop} onChange={(v) => set("loop", v)} />
        {!clip.loop && <EaseField value={clip.ease} onChange={(ease) => set("ease", ease)} />}
        <MoreFields>
          {!clip.loop && <NumField label="Size at takeoff" unit="×" value={clip.scaleFrom} min={0.1} max={2} onChange={(v) => set("scaleFrom", v)} />}
          <NumField label="Lean into turns" value={clip.bank} min={0} max={1} onChange={(v) => set("bank", v)} />
          <ToggleField label="Face the way it travels" value={clip.autoFlip} onChange={(v) => set("autoFlip", v)} />
          <NumField label="Fade in over" unit="s" value={clip.fadeIn} min={0} max={2} onChange={(v) => set("fadeIn", v)} />
        </MoreFields>
      </>
    ),
  };
}

/** How the Path panel reads and changes which waypoint is being edited. */
export interface WaypointControls {
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** Adds a waypoint where the sprite is at the playhead (the W key does the same). */
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Sets when the sprite reaches a waypoint, in seconds of travel (holds excluded). */
  onRetime: (index: number, travel: number) => void;
}

const pointValue = (p: Waypoint, key: keyof typeof WAYPOINT_DEFAULTS) => p[key] ?? WAYPOINT_DEFAULTS[key];

/** Short summary of what a waypoint changes, for its collapsed row. */
function pointSummary(p: Waypoint): string {
  const parts: string[] = [];
  if (pointValue(p, "scale") !== 1) parts.push(`${pointValue(p, "scale")}×`);
  if (pointValue(p, "rotate") !== 0) parts.push(`${pointValue(p, "rotate")}°`);
  if (pointValue(p, "opacity") !== 1) parts.push(`${Math.round(pointValue(p, "opacity") * 100)}%`);
  if (pointValue(p, "hold") > 0) parts.push(`pause ${pointValue(p, "hold")}s`);
  return parts.join(" · ");
}

/**
 * Waypoint list. Each row selects its waypoint (so do the dots on stage and
 * the W key); the selected one opens its position and the values the sprite
 * takes on as it passes through.
 */
export function pathSection(clip: SpriteClip, onChange: (c: SpriteClip) => void, waypoints: WaypointControls): PanelSection {
  const set = setter(clip, onChange);
  const setPoint = (i: number, patch: Partial<Waypoint>) =>
    set("path", clip.path.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const last = clip.path.length - 1;
  const timing = spriteTiming(clip);
  return {
    id: "path",
    title: "Path",
    content: (
      <>
        <p className="atm-help">Drag the numbered dots on the canvas to shape the path. Pick one here to pause, turn or resize the picture as it passes.</p>
        <ol className="flex flex-col gap-1">
          {clip.path.map((p, i) => {
            const open = waypoints.selected === i;
            const summary = pointSummary(p);
            const name = !clip.loop && i === last ? "Landing point" : `Point ${i + 1}`;
            return (
              <li key={i} className={`rounded-md border ${open ? "border-primary bg-primary-soft/40" : "border-transparent"}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => waypoints.onSelect(open ? null : i)}
                  className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-surface-sunken"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-sans text-[11px] font-semibold tabular-nums ${
                      open ? "bg-highlight text-on-highlight" : "bg-surface-sunken text-ink-secondary"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                  {summary && <span className="shrink-0 font-sans text-[11px] tabular-nums text-ink-muted">{summary}</span>}
                </button>
                {open && (
                  <div className="flex flex-col gap-4 px-2 pt-2 pb-3">
                    <div className="grid grid-cols-2 gap-4">
                      <NumField label="Pause here" unit="s" value={pointValue(p, "hold")} min={0} max={5} onChange={(v) => setPoint(i, { hold: v })} />
                      <NumField label="Size here" unit="×" value={pointValue(p, "scale")} min={0} max={4} onChange={(v) => setPoint(i, { scale: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <NumField label="Turn" unit="°" value={pointValue(p, "rotate")} min={-360} max={360} step={1} onChange={(v) => setPoint(i, { rotate: v })} />
                      <NumField label="Opacity" value={pointValue(p, "opacity")} min={0} max={1} onChange={(v) => setPoint(i, { opacity: v })} />
                    </div>
                    {timing.points[i]?.movable && (
                      <NumField
                        label="Arrives at"
                        unit="s"
                        value={clip.start + timing.points[i].arrive}
                        min={clip.start}
                        max={clip.start + timing.active}
                        onChange={(v) => waypoints.onRetime(i, v - clip.start - (timing.points[i].arrive - timing.points[i].travel))}
                      />
                    )}
                    <MoreFields label="Exact position">
                      <div className="grid grid-cols-2 gap-4">
                        <NumField label="X" unit="px" value={p.x} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, { x: v })} />
                        <NumField label="Y" unit="px" value={p.y} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, { y: v })} />
                      </div>
                    </MoreFields>
                    <div className={BUTTON_ROW}>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setPoint(i, { scale: undefined, rotate: undefined, opacity: undefined, hold: undefined, time: undefined })}
                        disabled={!summary && p.time === undefined}
                      >
                        Reset
                      </Button>
                      <Button variant="danger" size="xs" onClick={() => waypoints.onRemove(i)} disabled={clip.path.length <= 2}>
                        Remove point
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <Button variant="outline" size="xs" onClick={waypoints.onAdd}>
          + Add a point here
        </Button>
      </>
    ),
  };
}

/** Wing flap while travelling. */
export function flapSection(clip: SpriteClip, onChange: (c: SpriteClip) => void): PanelSection {
  const set = setter(clip, onChange);
  return {
    id: "wings",
    title: "Wings",
    defaultCollapsed: true,
    content: (
      <>
        <NumField label="Flaps per second" value={clip.flap.hz} min={0} max={10} step={0.1} onChange={(v) => set("flap", { ...clip.flap, hz: v })} />
        <NumField label="Flap depth" unit="°" value={clip.flap.depth} min={0} max={60} step={1} onChange={(v) => set("flap", { ...clip.flap, depth: v })} />
      </>
    ),
  };
}

/** Squash, settle flaps, and wing fold on arrival. */
export function landingSection(clip: SpriteClip, onChange: (c: SpriteClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const landing = (patch: Partial<SpriteClip["landing"]>) => set("landing", { ...clip.landing, ...patch });
  return {
    id: "landing",
    title: "Landing",
    defaultCollapsed: true,
    content: (
      <>
        <NumField label="Squash on landing" value={clip.landing.squash} min={0} max={0.4} onChange={(v) => landing({ squash: v })} />
        <NumField label="Settling flaps" value={clip.landing.settleFlaps} min={0} max={6} step={1} onChange={(v) => landing({ settleFlaps: v })} />
        <NumField label="Wing fold" unit="°" value={clip.landing.foldAngle} min={-110} max={0} step={1} onChange={(v) => landing({ foldAngle: v })} />
        <NumField label="Fold takes" unit="s" value={clip.landing.foldDuration} min={0} max={2} onChange={(v) => landing({ foldDuration: v })} />
      </>
    ),
  };
}
