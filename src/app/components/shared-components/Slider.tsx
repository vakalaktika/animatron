"use client";

import type { ReactNode } from "react";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Optional label row rendered above the track. Caller passes t() strings. */
  label?: ReactNode;
  /** Optional value readout rendered right-aligned in the label row. */
  valueLabel?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
  /** "sm" is the dense tool-panel scale: thin track, 16px thumb. */
  size?: "md" | "sm";
}

/**
 * Range slider for numeric settings. A native <input type="range"> keeps
 * keyboard and screen-reader behavior for free; the track/thumb are restyled
 * to the design tokens via the vendor pseudo-element utilities.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  valueLabel,
  disabled,
  "aria-label": ariaLabel,
  size = "md",
}: SliderProps) {
  const sm = size === "sm";
  return (
    <div className="w-full">
      {(label != null || valueLabel != null) && (
        <div className="flex items-baseline justify-between gap-3 mb-2">
          {label != null && <span className={sm ? "text-xs font-semibold" : "type-field-label"}>{label}</span>}
          {valueLabel != null && (
            <span className={sm ? "text-xs text-background-cta" : "type-control text-background-cta"}>
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className={[
          sm ? "w-full h-1.5" : "w-full h-2",
          "appearance-none rounded-full bg-background-cta-10 cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-background-cta focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "[&::-webkit-slider-thumb]:appearance-none",
          sm
            ? "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4"
            : "[&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-background-cta [&::-webkit-slider-thumb]:shadow",
          "[&::-moz-range-thumb]:border-0",
          "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-background-cta [&::-moz-range-thumb]:shadow",
        ].join(" ")}
      />
    </div>
  );
}
