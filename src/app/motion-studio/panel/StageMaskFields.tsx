"use client";

import { useState } from "react";
import type { Clip, StageMask, Vec2 } from "@/app/components/motion-studio/types";
import { STAGE_MASK_LIMITS, validStageMask } from "@/app/components/motion-studio/engine/stageMask";
import { Button } from "@/app/components/shared-components";
import { MoreFields, NumField, ToggleField } from "./fields";

/** Editable scene aperture, fixed on the stage rather than attached to a moving part. */
export function StageMaskFields({ clip, stage, onChange }: { clip: Clip; stage: { width: number; height: number }; onChange: (clip: Clip) => void }) {
  const [error, setError] = useState("");
  const mask = clip.stageMask;
  const rectangle = (): Vec2[] => [{ x: 0, y: 0 }, { x: stage.width, y: 0 }, { x: stage.width, y: stage.height }, { x: 0, y: stage.height }];
  const change = (next: StageMask) => {
    if (!validStageMask(next)) { setError("Each region needs at least three finite points enclosing an area. The last valid region is retained."); return; }
    setError("");
    onChange({ ...clip, stageMask: next });
  };
  const replace = (region: number, points: Vec2[]) => mask && change({ regions: mask.regions.map((p, i) => i === region ? points : p) });
  return <MoreFields label="Stage visibility regions" defaultOpen={!!mask}>
    <p className="atm-help">Keep this layer visible through fixed stage regions, such as window panes. Regions stay still while the object moves; separate regions leave frames hidden. Paint order is unchanged. A region does not reconstruct missing foreground artwork.</p>
    <ToggleField label="Clip to stage regions" value={!!mask} onChange={enabled => {
      if (enabled) change({ regions: [rectangle()] });
      else { const { stageMask: _removed, ...rest } = clip; setError(""); onChange(rest); }
    }} />
    {mask?.regions.map((points, region) => <MoreFields key={region} label={`Region ${region + 1} points`}>
      {points.map((point, index) => <div key={index} className="flex flex-col gap-2 border-b border-hairline pb-2">
        <div className="grid grid-cols-2 gap-4">
          {(["x", "y"] as const).map(axis => <NumField key={axis} label={`Region ${region + 1} point ${index + 1} ${axis.toUpperCase()}`} unit="px" value={point[axis]} min={0} max={axis === "x" ? stage.width : stage.height} step={1} onChange={value => replace(region, points.map((p, i) => i === index ? { ...p, [axis]: value } : p))} />)}
        </div>
        <Button size="xs" variant="outline" disabled={points.length <= 3} onClick={() => replace(region, points.filter((_, i) => i !== index))}>Remove point {index + 1} from region {region + 1}</Button>
      </div>)}
      <Button size="xs" variant="outline" disabled={points.length >= STAGE_MASK_LIMITS.points} onClick={() => {
        const first = points[0], last = points[points.length - 1];
        replace(region, [...points, { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }]);
      }}>Add point to region {region + 1}</Button>
      <Button size="xs" variant="outline" disabled={mask.regions.length <= 1} onClick={() => change({ regions: mask.regions.filter((_, i) => i !== region) })}>Remove region {region + 1}</Button>
    </MoreFields>)}
    {mask && <Button size="xs" variant="outline" disabled={mask.regions.length >= STAGE_MASK_LIMITS.regions} onClick={() => change({ regions: [...mask.regions, rectangle()] })}>Add a stage region</Button>}
    {error && <p role="alert" className="atm-help">{error}</p>}
  </MoreFields>;
}
