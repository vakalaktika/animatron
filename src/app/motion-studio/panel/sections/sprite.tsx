"use client";

import { EASE_LABELS } from "@/app/components/motion-studio/engine/easing";
import type { Ease, SpriteClip } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { NumField, SelectField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

const EASE_OPTIONS = (Object.keys(EASE_LABELS) as Ease["name"][]).map((value) => ({
  value,
  label: EASE_LABELS[value],
}));
const DEFAULT_BEZIER: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

/** Size, timing, easing, bank, flip, fade, loop. */
export function motionSection(clip: SpriteClip, onChange: (c: SpriteClip) => void): PanelSection {
  const set = setter(clip, onChange);
  return {
    id: "motion",
    title: "Motion",
    content: (
      <>
        <NumField label="Width (px)" value={clip.width} min={40} max={1200} step={1} onChange={(v) => set("width", v)} />
        <NumField label="Duration (s)" value={clip.duration} min={0.2} max={12} onChange={(v) => set("duration", v)} />
        <ToggleField label="Loop the path" value={clip.loop} onChange={(v) => set("loop", v)} />
        {!clip.loop && (
          <>
            <SelectField label="Easing" value={clip.ease.name} options={EASE_OPTIONS} onChange={(name) => set("ease", { ...clip.ease, name })} />
            {clip.ease.name === "custom" && (
              <div className="grid grid-cols-4 gap-2">
                {(clip.ease.custom ?? DEFAULT_BEZIER).map((v, i) => (
                  <input
                    key={i}
                    type="number"
                    step={0.01}
                    aria-label={`Bezier ${["x1", "y1", "x2", "y2"][i]}`}
                    className="rounded border border-background-cta-20 px-1.5 py-1 text-xs tabular-nums"
                    value={v}
                    onChange={(e) => {
                      const next = [...(clip.ease.custom ?? DEFAULT_BEZIER)] as [number, number, number, number];
                      next[i] = Number(e.target.value);
                      set("ease", { name: "custom", custom: next });
                    }}
                  />
                ))}
              </div>
            )}
            <NumField label="Scale at takeoff" value={clip.scaleFrom} min={0.1} max={2} onChange={(v) => set("scaleFrom", v)} />
          </>
        )}
        <NumField label="Bank into turns" value={clip.bank} min={0} max={1} onChange={(v) => set("bank", v)} />
        <ToggleField label="Flip when moving left" value={clip.autoFlip} onChange={(v) => set("autoFlip", v)} />
        <NumField label="Fade in (s)" value={clip.fadeIn} min={0} max={2} onChange={(v) => set("fadeIn", v)} />
      </>
    ),
  };
}

/** Waypoint list; the same points are draggable on the stage. */
export function pathSection(clip: SpriteClip, onChange: (c: SpriteClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const setPoint = (i: number, axis: "x" | "y", v: number) =>
    set("path", clip.path.map((p, j) => (j === i ? { ...p, [axis]: v } : p)));
  const addPoint = () => {
    const last = clip.path[clip.path.length - 1] ?? { x: 0, y: 0 };
    const prev = clip.path[clip.path.length - 2] ?? { x: last.x - 300, y: last.y };
    const mid = { x: (prev.x + last.x) / 2, y: (prev.y + last.y) / 2 - 120 };
    set("path", [...clip.path.slice(0, -1), mid, last]);
  };
  const removePoint = (i: number) => set("path", clip.path.filter((_, j) => j !== i));
  return {
    id: "path",
    title: "Path (relative to the anchor; drag the dots on stage)",
    content: (
      <>
        {clip.path.map((p, i) => (
          <div key={i} className="grid grid-cols-[1.25rem_1fr_1fr_auto] items-end gap-2">
            <span className="pb-1 text-xs tabular-nums text-background-cta-60">{i + 1}</span>
            <NumField label="x" value={p.x} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, "x", v)} />
            <NumField label="y" value={p.y} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, "y", v)} />
            <Button variant="outline" size="xs" onClick={() => removePoint(i)} disabled={clip.path.length <= 2} aria-label={`Remove point ${i + 1}`}>
              x
            </Button>
          </div>
        ))}
        <Button variant="outline" size="xs" onClick={addPoint}>
          + Add waypoint
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
    title: "Wings in flight",
    content: (
      <>
        <NumField label="Flaps per second" value={clip.flap.hz} min={0} max={10} step={0.1} onChange={(v) => set("flap", { ...clip.flap, hz: v })} />
        <NumField label="Flap depth (deg)" value={clip.flap.depth} min={0} max={60} step={1} onChange={(v) => set("flap", { ...clip.flap, depth: v })} />
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
    content: (
      <>
        <NumField label="Squash" value={clip.landing.squash} min={0} max={0.4} onChange={(v) => landing({ squash: v })} />
        <NumField label="Settle flaps" value={clip.landing.settleFlaps} min={0} max={6} step={1} onChange={(v) => landing({ settleFlaps: v })} />
        <NumField label="Fold angle (deg)" value={clip.landing.foldAngle} min={-110} max={0} step={1} onChange={(v) => landing({ foldAngle: v })} />
        <NumField label="Fold duration (s)" value={clip.landing.foldDuration} min={0} max={2} onChange={(v) => landing({ foldDuration: v })} />
      </>
    ),
  };
}
