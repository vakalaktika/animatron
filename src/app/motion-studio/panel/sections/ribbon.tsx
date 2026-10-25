"use client";

import { EASE_LABELS } from "@/app/components/motion-studio/engine/easing";
import type { Ease, RibbonClip } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { ChipField, MoreFields, NumField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { PaletteField } from "./palette";
import { setter } from "./setter";

const EASE_CHIPS = (["smoothOut", "inOut", "flight", "backOut", "linear"] as Ease["name"][]).map((value) => ({
  value,
  label: EASE_LABELS[value],
}));

/** Draw-in timing, colours, stripe width, and recolour sweeps. How the line is lit and shaped is the Line style section. */
export function ribbonSection(clip: RibbonClip, onChange: (c: RibbonClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const coat = (patch: Partial<RibbonClip["coat"]>) => set("coat", { ...clip.coat, ...patch });
  return {
    id: "ribbon",
    title: "Ribbon",
    content: (
      <>
        <PaletteField label="Colours" colors={clip.colors} onChange={(colors) => set("colors", colors)} />
        <NumField label="Band width" unit="px" value={clip.band} min={2} max={40} step={1} onChange={(v) => set("band", v)} />
        <NumField label="Draws in over" unit="s" value={clip.duration} min={0.2} max={12} onChange={(v) => set("duration", v)} />
        <ChipField label="Pace" value={clip.ease.name === "custom" ? "smoothOut" : clip.ease.name} options={EASE_CHIPS} onChange={(name) => set("ease", { name })} />
        <MoreFields>
          <ToggleField label="Closed loop" value={clip.loop} onChange={(v) => set("loop", v)} />
          {clip.style.motion === "paint" && (
            <>
              <NumField label="Recolour every" unit="s" value={clip.coat.every} min={0} max={60} step={0.5} onChange={(v) => coat({ every: v })} />
              {clip.coat.every > 0 ? (
                <>
                  <PaletteField label="Recolour with" colors={clip.coat.colors} onChange={(colors) => coat({ colors })} />
                  <NumField label="Each recolour takes" unit="s" value={clip.coat.duration} min={0.2} max={12} step={0.1} onChange={(v) => coat({ duration: v })} />
                </>
              ) : (
                <p className="atm-help">At 0 the ribbon keeps its colours once drawn.</p>
              )}
            </>
          )}
        </MoreFields>
      </>
    ),
  };
}

/** Point list; the same points are draggable on the stage. */
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
    title: `Points (${clip.points.length})`,
    defaultCollapsed: true,
    content: (
      <>
        <p className="atm-help">Drag the dots on the canvas to reshape the ribbon. These are the exact positions, relative to the ribbon's anchor.</p>
        <ol className="flex flex-col gap-2">
          {clip.points.map((p, i) => (
            <li key={i} className="grid grid-cols-[1.25rem_1fr_1fr_auto] items-end gap-2">
              <span
                aria-hidden="true"
                className="mb-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-sans text-[11px] font-semibold tabular-nums text-ink-secondary"
              >
                {i + 1}
              </span>
              <NumField label="X" unit="px" value={p.x} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, "x", v)} />
              <NumField label="Y" unit="px" value={p.y} min={-2500} max={2500} step={1} onChange={(v) => setPoint(i, "y", v)} />
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
