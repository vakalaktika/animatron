"use client";

import type { LottieClip } from "@/app/components/motion-studio/types";
import { NumField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

/** Size, speed, and loop for an imported Lottie. */
export function playbackSection(clip: LottieClip, onChange: (c: LottieClip) => void): PanelSection {
  const set = setter(clip, onChange);
  return {
    id: "playback",
    title: `Lottie: ${clip.label}`,
    content: (
      <>
        <NumField label="Width (px)" value={clip.width} min={40} max={2000} step={1} onChange={(v) => set("width", v)} />
        <NumField label="Speed" value={clip.speed} min={0.1} max={4} onChange={(v) => set("speed", v)} />
        <ToggleField label="Loop" value={clip.loop} onChange={(v) => set("loop", v)} />
      </>
    ),
  };
}
