"use client";

import { RAINBOW_PRESETS } from "@/app/components/motion-studio/engine/rainbow";
import { ColorInput } from "@/app/components/shared-components";
import { CloseIcon, PlusIcon } from "../icons";

const PRESET_LABELS: Record<string, string> = { cool: "Cool", warm: "Warm", full: "Rainbow" };

/** Which preset these colours match, or null for a hand-mixed set. */
export function presetFor(colors: string[]): string | null {
  return RAINBOW_PRESETS.find((p) => p.colors.join() === colors.join())?.name ?? null;
}

interface Props {
  label: string;
  colors: string[];
  onChange: (colors: string[]) => void;
  /** Fewest bands allowed (a ribbon needs one; the Squiggle Studio three). */
  min?: number;
  max?: number;
}

/**
 * A set of colour bands: the three ready palettes as swatch chips, then the
 * bands themselves, each a picker, with add and remove. Picking a preset
 * replaces the bands; editing one band keeps the rest.
 */
export function PaletteField({ label, colors, onChange, min = 1, max = 8 }: Props) {
  const preset = presetFor(colors);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 block atm-label">{label}</legend>
      <div role="radiogroup" aria-label={`${label} presets`} className="mb-3 flex flex-wrap gap-1.5">
        {RAINBOW_PRESETS.map((p) => {
          const on = preset === p.name;
          return (
            <button
              key={p.name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(p.colors.slice())}
              className={`atm-chip flex min-h-8 items-center gap-2 rounded-full border pr-3 pl-1.5 font-sans text-[12px] font-semibold tracking-[0.02em] pointer-coarse:min-h-10 ${
                on ? "border-primary bg-primary-soft text-ink" : "border-border-control text-ink-secondary hover:bg-surface-sunken hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="flex h-4 overflow-hidden rounded-full">
                {p.colors.map((c) => (
                  <span key={c} className="h-4 w-1.5" style={{ backgroundColor: c }} />
                ))}
              </span>
              {PRESET_LABELS[p.name] ?? p.name}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap items-center gap-1.5">
        {colors.map((c, i) => (
          <li key={i} className="group relative">
            <ColorInput aria-label={`Band ${i + 1}`} value={c} onChange={(next) => onChange(colors.map((x, j) => (j === i ? next : x)))} />
            {colors.length > min && (
              <button
                type="button"
                aria-label={`Remove band ${i + 1}`}
                onClick={() => onChange(colors.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border-control bg-surface-raised text-ink-secondary opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              >
                <CloseIcon width={10} height={10} strokeWidth={2.4} />
              </button>
            )}
          </li>
        ))}
        {colors.length < max && (
          <li>
            <button
              type="button"
              aria-label="Add a band"
              onClick={() => onChange([...colors, colors[colors.length - 1] ?? "#186a63"])}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-dashed border-border-control text-ink-secondary hover:border-ink-secondary hover:text-ink"
            >
              <PlusIcon width={16} height={16} />
            </button>
          </li>
        )}
      </ul>
    </fieldset>
  );
}
