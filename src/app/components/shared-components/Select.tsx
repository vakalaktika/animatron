"use client";

import type { SelectHTMLAttributes } from "react";
import { INPUT_VARIANT_CLASS, type InputVariant } from "./inputVariants";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: InputVariant;
}

/**
 * Select field matching the form input styling, with the thick custom caret.
 * Pass <option> children as usual.
 */
export function Select({
  variant = "outline",
  className,
  children,
  ...props
}: SelectProps) {
  const base = INPUT_VARIANT_CLASS[variant];
  return (
    <select
      className={`${base} select-thick-caret ${className ?? ""}`}
      {...props}
    >
      {children}
    </select>
  );
}
