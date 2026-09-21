"use client";

import { Select, Slider, TextInput, Toggle } from "@/app/components/shared-components";

/*
 * Control scale for the studio panels. The rule:
 *   - Inputs, selects, sliders, toggles: compact / sm. They repeat dozens of
 *     times per panel, so the dense scale keeps a whole clip readable at once.
 *   - Buttons: xs for anything repeated or inside a list (waypoints, clip
 *     rows, export links); sm only for the few one-off primary actions
 *     (Play, Record, Save preset) so they stand out from the field noise.
 *   - Labels: 12px semibold; section titles: eyebrow. Values are tabular.
 */

/**
 * Layout for a wrapping group of small buttons: 8px between buttons, 12px
 * between wrapped rows, so each row still reads as a row. Keep a section's
 * primary action (import, record, save) on its own line below the group.
 */
export const BUTTON_ROW = "flex flex-wrap gap-x-2 gap-y-3";

/** Labeled slider with a typed value box on the label row. */
export function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="atm-label">{label}</span>
        <input
          type="number"
          aria-label={`${label} value`}
          className="w-[4.5rem] rounded-sm border border-border-control bg-surface-raised px-1.5 py-0.5 text-right text-xs tabular-nums focus:outline-none focus:border-primary"
          value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
      </div>
      <Slider size="sm" value={value} onChange={onChange} min={min} max={max} step={step} aria-label={label} />
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Focus on mount, for a field the user is about to type into (a freshly added text clip). */
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block atm-label">{label}</span>
      <TextInput variant="compact" className="w-full" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block atm-label">{label}</span>
      <Select variant="compact" className="w-full" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return <Toggle size="sm" checked={value} onChange={onChange} label={label} />;
}
