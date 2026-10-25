"use client";

import { useState, type ReactNode } from "react";
import { ColorInput, Select, Slider, TextInput, Toggle } from "@/app/components/shared-components";
import { ChevronIcon } from "./icons";

/*
 * Control scale for the studio panels. The rule:
 *   - Inputs, selects, sliders, toggles: compact / sm. They repeat dozens of
 *     times per panel, so the dense scale keeps a whole clip readable at once.
 *   - Buttons: xs for anything repeated or inside a list (waypoints, clip
 *     rows, export links); sm only for the few one-off primary actions
 *     (Play, Record, Save preset) so they stand out from the field noise.
 *   - Labels: 12px semibold; section titles: eyebrow. Values are tabular.
 *   - Units ride in the value box ("0.6 s"), never in the label.
 */

/**
 * Layout for a wrapping group of small buttons: 8px between buttons, 12px
 * between wrapped rows, so each row still reads as a row. Keep a section's
 * primary action (import, record, save) on its own line below the group.
 */
export const BUTTON_ROW = "flex flex-wrap gap-x-2 gap-y-3";

/** Labeled slider with a typed value box (and its unit) on the label row. */
export function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Short unit shown after the value: "s", "px", "°", "×". */
  unit?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="atm-label">{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            aria-label={unit ? `${label} in ${unit}` : `${label} value`}
            className="w-[4.5rem] rounded-sm border border-border-control bg-surface-raised px-1.5 py-0.5 text-right text-xs tabular-nums focus:outline-none focus:border-primary"
            value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
            step={step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(n);
            }}
          />
          {unit && (
            <span aria-hidden="true" className="w-4 font-sans text-[11px] text-ink-muted">
              {unit}
            </span>
          )}
        </span>
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Focus on mount, for a field the user is about to type into (a freshly added text clip). */
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block atm-label">{label}</span>
      <TextInput variant="compact" className="w-full" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} placeholder={placeholder} />
    </label>
  );
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Expands #abc to #aabbcc; the native picker only speaks six digits. */
function toPickerHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map((c) => c + c).join("")}`.toLowerCase();
  return "#000000";
}

/**
 * A colour: the platform picker as a swatch, with the hex beside it for
 * anyone who has one to paste. Typing only commits a valid hex, so a
 * half-typed value never turns the clip black.
 */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  return (
    <div>
      <span className="mb-2 block atm-label">{label}</span>
      <div className="flex items-center gap-2">
        <ColorInput aria-label={`${label} swatch`} value={toPickerHex(value)} onChange={onChange} />
        <TextInput
          variant="compact"
          aria-label={`${label} hex`}
          className="w-full font-mono text-xs uppercase tabular-nums"
          value={shown}
          spellCheck={false}
          onChange={(e) => {
            const next = e.target.value.trim();
            setDraft(next);
            if (HEX.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </div>
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

/**
 * A choice shown as a row of chips rather than a dropdown, for the three to
 * five options a person picks by feel (how text arrives, a line's look).
 */
export function ChipField<T extends string>({
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
    <fieldset className="min-w-0">
      <legend className="mb-2 block atm-label">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`atm-chip min-h-8 rounded-full border px-3 font-sans text-[12px] font-semibold tracking-[0.02em] pointer-coarse:min-h-10 ${
                on ? "border-primary bg-primary-soft text-ink" : "border-border-control text-ink-secondary hover:bg-surface-sunken hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The fine-tuning a section keeps out of the way: closed by default, one
 * click to open, and it stays open while the same clip is selected (the
 * section remounts with the clip).
 */
export function MoreFields({ label = "Fine-tune", defaultOpen = false, children }: { label?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="-mx-1 rounded-md border border-hairline">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-9 w-full items-center gap-1.5 rounded-md px-2 text-left font-sans text-[12px] font-semibold tracking-[0.04em] text-ink-secondary hover:bg-surface-sunken hover:text-ink"
      >
        <ChevronIcon width={14} height={14} className={`atm-chevron ${open ? "is-open" : ""}`} />
        {label}
      </button>
      {open && <div className="flex flex-col gap-4 px-2 pt-1 pb-3">{children}</div>}
    </div>
  );
}
