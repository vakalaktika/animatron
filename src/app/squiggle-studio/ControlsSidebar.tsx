"use client";

import type { ReactNode } from "react";
import { Button, ColorInput, Slider } from "@/app/components/shared-components";
import { PRESETS } from "./lib/palette";
import { StrokeList } from "./StrokeList";
import type { Squiggles } from "./useSquiggles";
import type { Stroke } from "./types";

interface ControlsSidebarProps {
  squiggles: Squiggles;
  onExportStroke: (stroke: Stroke, index: number) => void;
  onAnimateStroke: (stroke: Stroke) => void;
  onFlyStroke: (stroke: Stroke) => void;
  onArtworkStroke: (stroke: Stroke, index: number) => void;
}

const PRESET_LABELS: Record<string, string> = { cool: "Cool", warm: "Warm", full: "Full" };

/** Quiet uppercase anchor that heads each sidebar section, with an optional count. */
function SectionHeading({ children, count }: { children: ReactNode; count?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="atm-section-label">{children}</h2>
      {count && <span className="font-sans text-[11px] tabular-nums text-ink-muted">{count}</span>}
    </div>
  );
}

/** The controls: rainbow colours, stripe width, and the squiggle roster. */
export function ControlsSidebar({ squiggles, onExportStroke, onAnimateStroke, onFlyStroke, onArtworkStroke }: ControlsSidebarProps) {
  const { colors, band, strokes, setColorAt, addColor, removeColorAt, applyPreset, setBand, smoothStroke, removeStroke, setHover } =
    squiggles;

  const atMin = colors.length <= 3;

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <SectionHeading count={`${colors.length} colour${colors.length === 1 ? "" : "s"}`}>Rainbow</SectionHeading>

        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p.colors)}
              className="flex flex-1 cursor-pointer flex-col gap-1.5 rounded-md border border-border-control bg-surface-raised p-2 text-left transition-[background-color,box-shadow] duration-200 hover:bg-surface-sunken hover:shadow-pop"
            >
              <span className="flex flex-col overflow-hidden rounded-sm">
                {p.colors.map((c, i) => (
                  <span key={i} className="h-1.5" style={{ background: c }} />
                ))}
              </span>
              <span className="atm-button-type text-[11px]">{PRESET_LABELS[p.name] ?? p.name}</span>
            </button>
          ))}
        </div>

        <ul className="flex flex-col gap-2">
          {colors.map((value, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <ColorInput value={value} onChange={(v) => setColorAt(i, v)} aria-label={`Colour ${i + 1}`} />
              <span className="flex-1 font-mono text-[13px] uppercase text-ink-secondary">{value}</span>
              <Button variant="outline" size="xs" onClick={() => removeColorAt(i)} disabled={atMin} aria-label={`Remove colour ${i + 1}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="xs" onClick={addColor} className="self-start">
          + Add colour
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <Slider size="sm" min={3} max={24} value={band} onChange={setBand} label="Stripe width" valueLabel={`${band}px`} aria-label="Stripe width" />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading count={strokes.length ? String(strokes.length) : undefined}>Squiggles</SectionHeading>
        <StrokeList
          strokes={strokes}
          colors={colors}
          band={band}
          onHover={setHover}
          onSmooth={smoothStroke}
          onExport={onExportStroke}
          onAnimate={onAnimateStroke}
          onFly={onFlyStroke}
          onArtwork={onArtworkStroke}
          onRemove={removeStroke}
        />
      </section>
    </div>
  );
}
