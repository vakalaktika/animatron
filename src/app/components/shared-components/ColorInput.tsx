"use client";

import React from "react";

export type ColorInputProps = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  /** Called with the new hex value whenever the swatch changes. */
  onChange: (value: string) => void;
};

/**
 * A styled native color picker. The OS swatch is framed as a control-outline
 * tile on raised paper, like the other inputs; the underlying
 * `<input type="color">` keeps keyboard access and the platform picker for
 * free. Callers get the hex value directly rather than the raw event.
 */
export function ColorInput({ value, onChange, className = "", ...props }: ColorInputProps) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "h-8 w-8 flex-none cursor-pointer rounded-sm border border-border-control bg-surface-raised p-0.5",
        "hover:border-ink-secondary focus:outline-none focus:border-primary",
        "[&::-webkit-color-swatch-wrapper]:p-0",
        "[&::-webkit-color-swatch]:rounded-[2px] [&::-webkit-color-swatch]:border-0",
        "[&::-moz-color-swatch]:rounded-[2px] [&::-moz-color-swatch]:border-0",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
