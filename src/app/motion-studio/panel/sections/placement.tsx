"use client";

import { attachableParents } from "@/app/components/motion-studio/engine/hierarchy";
import type { MotionValue } from "motion/react";
import { hasKeys } from "@/app/components/motion-studio/engine/keys";
import { arrivalTime } from "@/app/components/motion-studio/engine/ribbon";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { BUTTON_ROW, MoreFields, NumField, SelectField, TextField, ToggleField } from "../fields";
import { KeyEaseField, KeyedNumField } from "../KeyedFields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

const KIND: Record<Clip["type"], string> = { logo: "logo", sprite: "picture", text: "text", lottie: "Lottie", ribbon: "ribbon", rig: "rig" };

/** Name, start, what it follows, position, size. Every clip has this. */
export function placementSection(
  doc: StudioDoc,
  clip: Clip,
  onChange: (c: Clip) => void,
  onReparent: (parentId: string | null) => void,
  time: MotionValue<number>,
): PanelSection {
  const set = setter(clip, onChange);
  const parents = attachableParents(doc, clip.id);
  const attached = clip.parentId !== null;
  const parent = doc.clips.find((c) => c.id === clip.parentId);
  const ribbon = parent?.type === "ribbon" ? parent : null;
  const seat = clip.along === "front" ? "front" : typeof clip.along === "number" ? "at" : "free";
  const fraction = typeof clip.along === "number" ? clip.along : 0.5;
  const flowing = clip.type === "text" && !!clip.flow && ribbon !== null && seat !== "free";
  // Lift new flowing text clear of the ribbon's bands, to the left of travel.
  const setFlow = (flow: boolean) => {
    if (clip.type !== "text" || !ribbon) return;
    const lift = flow ? -Math.round((ribbon.band * ribbon.colors.length) / 2 + clip.fontSize * 0.7) : 0;
    onChange({ ...clip, flow, x: 0, y: lift });
  };
  const keyed = { clip, time, onChange };
  const center = () => onChange({ ...clip, x: doc.stage.width / 2, y: doc.stage.height / 2 });
  return {
    id: "placement",
    title: "Position and timing",
    content: (
      <>
        <TextField label="Name" value={clip.name} onChange={(v) => set("name", v)} />
        <NumField label="Starts at" unit="s" value={clip.start} min={0} max={20} step={0.05} onChange={(v) => set("start", v)} />
        <div className="grid grid-cols-2 gap-4">
          <KeyedNumField {...keyed} prop="x" label={flowing ? "Slide along" : attached ? "Offset X" : "X"} unit="px" min={-2500} max={2500} step={1} />
          <KeyedNumField {...keyed} prop="y" label={flowing ? "Lift off the line" : attached ? "Offset Y" : "Y"} unit="px" min={-2500} max={2500} step={1} />
        </div>
        {clip.type === "ribbon" ? (
          <NumField label="Size" unit="×" value={clip.scale} min={0.1} max={4} step={0.01} onChange={(v) => set("scale", v)} />
        ) : (
          <KeyedNumField {...keyed} prop="scale" label="Size" unit="×" min={0.1} max={4} step={0.01} />
        )}
        <div className="grid grid-cols-2 gap-4">
          {clip.type !== "ribbon" && <KeyedNumField {...keyed} prop="rotation" label="Turn" unit="°" min={-180} max={180} step={1} />}
          <KeyedNumField {...keyed} prop="opacity" label="Opacity" min={0} max={1} step={0.01} />
        </div>
        {hasKeys(clip) && <KeyEaseField clip={clip} time={time} onChange={onChange} />}
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
            {ribbon && seat !== "free" && clip.type === "text" && (
              <ToggleField label="Write along the ribbon" value={!!clip.flow} onChange={setFlow} />
            )}
            {attached && !flowing && (
              <ToggleField label={ribbon && seat !== "free" ? "Turn with the ribbon" : "Turn with it"} value={clip.followRotation} onChange={(v) => set("followRotation", v)} />
            )}
          </MoreFields>
        )}
      </>
    ),
  };
}
