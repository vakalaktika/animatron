"use client";

import { attachableParents } from "@/app/components/motion-studio/engine/hierarchy";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { NumField, SelectField, TextField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

/** Name, start, attachment, position, scale. Every clip has this. */
export function placementSection(
  doc: StudioDoc,
  clip: Clip,
  onChange: (c: Clip) => void,
  onReparent: (parentId: string | null) => void,
): PanelSection {
  const set = setter(clip, onChange);
  const parents = attachableParents(doc, clip.id);
  const attached = clip.parentId !== null;
  return {
    id: "placement",
    title: "Placement and timing",
    content: (
      <>
        <TextField label="Name" value={clip.name} onChange={(v) => set("name", v)} />
        <NumField label="Start (s)" value={clip.start} min={0} max={20} step={0.05} onChange={(v) => set("start", v)} />
        <SelectField
          label="Attach to"
          value={clip.parentId ?? ""}
          options={[
            { value: "", label: "Nothing (stage)" },
            ...parents.map((p) => ({ value: p.id, label: `${p.name} · ${p.type}` })),
          ]}
          onChange={(v) => onReparent(v === "" ? null : v)}
        />
        {attached && (
          <ToggleField label="Follow parent rotation" value={clip.followRotation} onChange={(v) => set("followRotation", v)} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <NumField label={attached ? "Offset X" : "X"} value={clip.x} min={-2500} max={2500} step={1} onChange={(v) => set("x", v)} />
          <NumField label={attached ? "Offset Y" : "Y"} value={clip.y} min={-2500} max={2500} step={1} onChange={(v) => set("y", v)} />
        </div>
        <NumField label="Scale" value={clip.scale} min={0.1} max={4} step={0.01} onChange={(v) => set("scale", v)} />
      </>
    ),
  };
}
