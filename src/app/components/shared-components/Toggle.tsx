"use client";

import type { ReactNode } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  /** "sm" is the dense tool-panel scale (20px tall). */
  size?: "md" | "sm";
}

/**
 * On/off switch for boolean settings. A real (visually hidden) checkbox backs
 * it, so clicking the label toggles it and it stays keyboard-accessible.
 *
 * The track color and knob position are driven off the `checked` prop rather
 * than the CSS `peer-checked` variant: the `bg-background-cta-10` off-state
 * color is an unlayered utility (safariBrowserFixes.css), so it would win the
 * cascade over a layered `peer-checked:bg-background-cta` and the on/off states
 * would look identical. Focus ring / disabled state still use the `peer`.
 */
export function Toggle({ checked, onChange, label, disabled, size = "md" }: ToggleProps) {
  const sm = size === "sm";
  return (
    <label className={`inline-flex items-center cursor-pointer select-none ${sm ? "gap-2" : "gap-3"}`}>
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`${sm ? "h-5 w-9" : "h-6 w-11"} rounded-full transition-colors peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-background-cta peer-focus-visible:ring-offset-1 ${
            checked ? "bg-background-cta" : "bg-background-cta-10"
          }`}
        />
        <span
          className={`pointer-events-none absolute left-0.5 top-0.5 ${sm ? "h-4 w-4" : "h-5 w-5"} rounded-full bg-background shadow transition-transform ${
            checked ? (sm ? "translate-x-4" : "translate-x-5") : "translate-x-0"
          }`}
        />
      </span>
      {label != null && <span className={sm ? "text-xs font-semibold" : "type-control"}>{label}</span>}
    </label>
  );
}
