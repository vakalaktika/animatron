"use client";

import { RAINBOW_PRESETS } from "@/app/components/motion-studio/engine/rainbow";
import type { SpriteClip, SpriteTrail } from "@/app/components/motion-studio/types";
import { NumField, SelectField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

const PRESET_LABELS: Record<string, string> = { cool: "Cool", warm: "Warm", full: "Full rainbow" };
const PRESET_OPTIONS = [
  ...RAINBOW_PRESETS.map((p) => ({ value: p.name, label: PRESET_LABELS[p.name] ?? p.name })),
  { value: "custom", label: "Custom (from Squiggle Studio)" },
];

/** Which preset the trail's colours match, or "custom" for a handed-off squiggle. */
function presetFor(colors: string[]): string {
  return RAINBOW_PRESETS.find((p) => p.colors.join() === colors.join())?.name ?? "custom";
}

/** The rainbow painted behind a sprite as it travels its path. How it is lit and shaped is the Line style section. */
export function trailSection(clip: SpriteClip, onChange: (c: SpriteClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const trail = (patch: Partial<SpriteTrail>) => set("trail", { ...clip.trail, ...patch });
  const preset = presetFor(clip.trail.colors);
  return {
    id: "trail",
    title: "Rainbow trail",
    content: (
      <>
        <ToggleField label="Paint the path as it flies" value={clip.trail.enabled} onChange={(v) => trail({ enabled: v })} />
        {clip.trail.enabled && (
          <>
            <SelectField
              label="Colours"
              value={preset}
              options={preset === "custom" ? PRESET_OPTIONS : PRESET_OPTIONS.filter((o) => o.value !== "custom")}
              onChange={(name) => {
                const next = RAINBOW_PRESETS.find((p) => p.name === name);
                if (next) trail({ colors: next.colors.slice() });
              }}
            />
            <NumField label="Stripe width (px)" value={clip.trail.band} min={2} max={40} step={1} onChange={(v) => trail({ band: v })} />
            <NumField
              label="Head behind the sprite (px along the path)"
              value={clip.trail.offset.along}
              min={-120}
              max={120}
              step={1}
              onChange={(v) => trail({ offset: { ...clip.trail.offset, along: v } })}
            />
            <NumField
              label="Sideways offset (px, + is right of travel)"
              value={clip.trail.offset.across}
              min={-80}
              max={80}
              step={1}
              onChange={(v) => trail({ offset: { ...clip.trail.offset, across: v } })}
            />
            {!clip.loop && clip.trail.style.motion === "paint" && (
              <NumField label="Fade out after landing (s); 0 keeps it" value={clip.trail.fadeOut} min={0} max={4} step={0.1} onChange={(v) => trail({ fadeOut: v })} />
            )}
          </>
        )}
      </>
    ),
  };
}
