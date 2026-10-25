"use client";

import type { SpriteClip, SpriteTrail } from "@/app/components/motion-studio/types";
import { MoreFields, NumField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { PaletteField } from "./palette";
import { setter } from "./setter";

/** The rainbow painted behind a picture as it travels its path. How it is lit and shaped is the Line style section. */
export function trailSection(clip: SpriteClip, onChange: (c: SpriteClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const trail = (patch: Partial<SpriteTrail>) => set("trail", { ...clip.trail, ...patch });
  return {
    id: "trail",
    title: "Trail",
    content: (
      <>
        <ToggleField label="Leave a trail along the path" value={clip.trail.enabled} onChange={(v) => trail({ enabled: v })} />
        {clip.trail.enabled && (
          <>
            <PaletteField label="Colours" colors={clip.trail.colors} onChange={(colors) => trail({ colors })} />
            <NumField label="Band width" unit="px" value={clip.trail.band} min={2} max={40} step={1} onChange={(v) => trail({ band: v })} />
            <MoreFields>
              <NumField
                label="Tuck under the picture"
                unit="px"
                value={clip.trail.offset.along}
                min={-120}
                max={120}
                step={1}
                onChange={(v) => trail({ offset: { ...clip.trail.offset, along: v } })}
              />
              <NumField
                label="Shift sideways"
                unit="px"
                value={clip.trail.offset.across}
                min={-80}
                max={80}
                step={1}
                onChange={(v) => trail({ offset: { ...clip.trail.offset, across: v } })}
              />
              {!clip.loop && clip.trail.style.motion === "paint" && (
                <NumField label="Fade out after landing" unit="s" value={clip.trail.fadeOut} min={0} max={4} step={0.1} onChange={(v) => trail({ fadeOut: v })} />
              )}
            </MoreFields>
          </>
        )}
      </>
    ),
  };
}
