"use client";

import type { LogoClip } from "@/app/components/motion-studio/types";
import { NumField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

/** The logo build: rings springing in, then the letter tracing and filling. */
export function buildSections(clip: LogoClip, onChange: (c: LogoClip) => void): PanelSection[] {
  const set = setter(clip, onChange);
  return [
    {
      id: "rings",
      title: "Rings",
      content: (
        <>
          <NumField label="Size (px)" value={clip.size} min={80} max={1200} step={1} onChange={(v) => set("size", v)} />
          <NumField label="Layer stagger (s)" value={clip.layerStagger} min={0} max={0.6} onChange={(v) => set("layerStagger", v)} />
          <NumField label="Layer duration (s)" value={clip.layerDuration} min={0.1} max={2} onChange={(v) => set("layerDuration", v)} />
          <NumField label="Entry rotation (deg)" value={clip.entryRotate} min={-180} max={180} step={1} onChange={(v) => set("entryRotate", v)} />
          <NumField label="Entry scale" value={clip.entryScale} min={0} max={2} onChange={(v) => set("entryScale", v)} />
          <NumField label="Overshoot" value={clip.overshoot} min={0} max={4} onChange={(v) => set("overshoot", v)} />
        </>
      ),
    },
    {
      id: "letter",
      title: "Letter A",
      content: (
        <>
          <NumField label="Trace starts after (s)" value={clip.traceDelay} min={0} max={5} onChange={(v) => set("traceDelay", v)} />
          <NumField label="Trace duration (s)" value={clip.traceDuration} min={0.1} max={4} onChange={(v) => set("traceDuration", v)} />
          <NumField label="Fill duration (s)" value={clip.fillDuration} min={0} max={2} onChange={(v) => set("fillDuration", v)} />
        </>
      ),
    },
  ];
}
