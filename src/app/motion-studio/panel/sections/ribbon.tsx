"use client";

import { EASE_LABELS } from "@/app/components/motion-studio/engine/easing";
import { RAINBOW_PRESETS } from "@/app/components/motion-studio/engine/rainbow";
import type { Ease, RibbonClip } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { NumField, SelectField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

const EASE_OPTIONS = (Object.keys(EASE_LABELS) as Ease["name"][])
  .filter((name) => name !== "custom")
  .map((value) => ({ value, label: EASE_LABELS[value] }));
const PRESET_LABELS: Record<string, string> = { cool: "Cool", warm: "Warm", full: "Full rainbow" };
const PRESET_OPTIONS = [
  ...RAINBOW_PRESETS.map((p) => ({ value: p.name, label: PRESET_LABELS[p.name] ?? p.name })),
  { value: "custom", label: "Custom" },
];

/** Which preset these colours match, or "custom" for a handed-off squiggle or the hero lanes. */
function presetFor(colors: string[]): string {
  return RAINBOW_PRESETS.find((p) => p.colors.join() === colors.join())?.name ?? "custom";
}

function PaletteField({ label, colors, onChange }: { label: string; colors: string[]; onChange: (c: string[]) => void }) {
  const preset = presetFor(colors);
  return (
    <SelectField
      label={label}
      value={preset}
      options={preset === "custom" ? PRESET_OPTIONS : PRESET_OPTIONS.filter((o) => o.value !== "custom")}
      onChange={(name) => {
        const next = RAINBOW_PRESETS.find((p) => p.name === name);
        if (next) onChange(next.colors.slice());
      }}
    />
  );
}

/** Paint-in timing, colours, stripe width, and repaint coats. How the line is lit and shaped is the Line style section. */
export function ribbonSection(clip: RibbonClip, onChange: (c: RibbonClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const coat = (patch: Partial<RibbonClip["coat"]>) => set("coat", { ...clip.coat, ...patch });
  return {
    id: "ribbon",
    title: "Ribbon",
    content: (
      <>
        <NumField label="Paint-in time (s)" value={clip.duration} min={0.2} max={12} onChange={(v) => set("duration", v)} />
        <SelectField label="Easing" value={clip.ease.name} options={EASE_OPTIONS} onChange={(name) => set("ease", { name })} />
        <ToggleField label="Closed loop" value={clip.loop} onChange={(v) => set("loop", v)} />
        <PaletteField label="Colours" colors={clip.colors} onChange={(colors) => set("colors", colors)} />
        <NumField label="Stripe width (px)" value={clip.band} min={2} max={40} step={1} onChange={(v) => set("band", v)} />
        {clip.style.motion === "paint" && (
          <>
            <NumField label="Repaint every (s); 0 = never" value={clip.coat.every} min={0} max={60} step={0.5} onChange={(v) => coat({ every: v })} />
            {clip.coat.every > 0 && (
              <>
                <PaletteField label="Repaint colours" colors={clip.coat.colors} onChange={(colors) => coat({ colors })} />
                <NumField label="Repaint takes (s)" value={clip.coat.duration} min={0.2} max={12} step={0.1} onChange={(v) => coat({ duration: v })} />
              </>
            )}
          </>
        )}
      </>
    ),
  };
}

/** Waypoint list; the same points are draggable on the stage. */
export function ribbonPointsSection(clip: RibbonClip, onChange: (c: RibbonClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const setPoint = (i: number, axis: "x" | "y", v: number) =>
    set("points", clip.points.map((p, j) => (j === i ? { ...p, [axis]: v } : p)));
  const addPoint = () => {
    const last = clip.points[clip.points.length - 1] ?? { x: 0, y: 0 };
    const prev = clip.points[clip.points.length - 2] ?? { x: last.x - 300, y: last.y };
    set("points", [...clip.points, { x: last.x + (last.x - prev.x), y: last.y + (last.y - prev.y) }]);
  };
  const removePoint = (i: number) => set("points", clip.points.filter((_, j) => j !== i));
  return {
    id: "ribbonPoints",
    title: "Points",
    content: (
      <>
        <p className="atm-help">Relative to the anchor. Drag the dots on stage to move them.</p>
        <ol className="flex flex-col gap-2">
          {clip.points.map((p, i) => (
            <li key={i} className="grid grid-cols-[1.25rem_1fr_1fr_auto] items-end gap-2">
              <span
                aria-hidden="true"
                className="mb-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-sans text-[11px] font-semibold tabular-nums text-ink-secondary"
              >
                {i + 1}
              </span>
              <NumField label="X" value={p.x} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, "x", v)} />
              <NumField label="Y" value={p.y} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, "y", v)} />
              <Button variant="danger" size="xs" onClick={() => removePoint(i)} disabled={clip.points.length <= 2} aria-label={`Remove point ${i + 1}`}>
                Remove
              </Button>
            </li>
          ))}
        </ol>
        <Button variant="outline" size="xs" onClick={addPoint}>
          + Add point
        </Button>
      </>
    ),
  };
}
