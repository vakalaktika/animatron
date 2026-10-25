"use client";

import { attachableParents } from "@/app/components/motion-studio/engine/hierarchy";
import { arrivalTime } from "@/app/components/motion-studio/engine/ribbon";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { BUTTON_ROW, MoreFields, NumField, SelectField, TextField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

const KIND: Record<Clip["type"], string> = { logo: "logo", sprite: "picture", text: "text", lottie: "Lottie", ribbon: "ribbon" };

/** Name, start, what it follows, position, size. Every clip has this. */
export function placementSection(
  doc: StudioDoc,
  clip: Clip,
  onChange: (c: Clip) => void,
  onReparent: (parentId: string | null) => void,
): PanelSection {
  const set = setter(clip, onChange);
  const parents = attachableParents(doc, clip.id);
  const attached = clip.parentId !== null;
  const parent = doc.clips.find((c) => c.id === clip.parentId);
  const ribbon = parent?.type === "ribbon" ? parent : null;
  const seat = clip.along === "front" ? "front" : typeof clip.along === "number" ? "at" : "free";
  const fraction = typeof clip.along === "number" ? clip.along : 0.5;
  const center = () => onChange({ ...clip, x: doc.stage.width / 2, y: doc.stage.height / 2 });
  return {
    id: "placement",
    title: "Position and timing",
    content: (
      <>
        <TextField label="Name" value={clip.name} onChange={(v) => set("name", v)} />
        <NumField label="Starts at" unit="s" value={clip.start} min={0} max={20} step={0.05} onChange={(v) => set("start", v)} />
        <div className="grid grid-cols-2 gap-4">
          <NumField label={attached ? "Offset X" : "X"} unit="px" value={clip.x} min={-2500} max={2500} step={1} onChange={(v) => set("x", v)} />
          <NumField label={attached ? "Offset Y" : "Y"} unit="px" value={clip.y} min={-2500} max={2500} step={1} onChange={(v) => set("y", v)} />
        </div>
        <NumField label="Size" unit="×" value={clip.scale} min={0.1} max={4} step={0.01} onChange={(v) => set("scale", v)} />
        {!attached && (
          <div className={BUTTON_ROW}>
            <Button size="xs" variant="outline" onClick={center}>
              Center on canvas
            </Button>
          </div>
        )}
        {parents.length > 0 && (
          <MoreFields label={attached ? `Follows ${parent?.name ?? "another clip"}` : "Follow another clip"} defaultOpen={attached}>
            <SelectField
              label="Follows"
              value={clip.parentId ?? ""}
              options={[
                { value: "", label: "Nothing, it stays on the canvas" },
                ...parents.map((p) => ({ value: p.id, label: `${p.name} (${KIND[p.type]})` })),
              ]}
              onChange={(v) => onReparent(v === "" ? null : v)}
            />
            {ribbon && (
              <SelectField
                label="Where on the ribbon"
                value={seat}
                options={[
                  { value: "free", label: "Beside it, at a fixed offset" },
                  { value: "at", label: "On the ribbon, at a point along it" },
                  { value: "front", label: "On the tip as it draws" },
                ]}
                onChange={(v) => set("along", v === "front" ? "front" : v === "at" ? fraction : null)}
              />
            )}
            {ribbon && seat === "at" && (
              <>
                <NumField label="Point along the ribbon" value={fraction} min={0} max={1} step={0.005} onChange={(v) => set("along", v)} />
                <Button size="xs" variant="outline" onClick={() => set("start", Number(arrivalTime(ribbon, fraction).toFixed(2)))}>
                  Start when the ribbon reaches it
                </Button>
              </>
            )}
            {attached && (
              <ToggleField label={ribbon && seat !== "free" ? "Turn with the ribbon" : "Turn with it"} value={clip.followRotation} onChange={(v) => set("followRotation", v)} />
            )}
          </MoreFields>
        )}
      </>
    ),
  };
}
