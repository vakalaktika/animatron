"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { INPUT_VARIANT_CLASS, type InputVariant } from "./inputVariants";

type SingleLine = {
  multiline?: false;
  variant?: InputVariant;
} & InputHTMLAttributes<HTMLInputElement>;

type MultiLine = {
  multiline: true;
  variant?: InputVariant;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export type TextInputProps = SingleLine | MultiLine;

/**
 * Text field matching the form input styling. Renders an <input> by default,
 * or a resizable <textarea> when `multiline` is set. Any native input/textarea
 * attribute (type, value, onChange, placeholder, required, …) is passed through.
 */
export function TextInput(props: TextInputProps) {
  const base = INPUT_VARIANT_CLASS[props.variant ?? "outline"];

  if (props.multiline) {
    const { multiline: _m, variant: _v, className, ...rest } = props;
    return (
      <textarea className={`${base} resize-y ${className ?? ""}`} {...rest} />
    );
  }

  const { multiline: _m, variant: _v, className, ...rest } = props;
  return <input className={`${base} ${className ?? ""}`} {...rest} />;
}
