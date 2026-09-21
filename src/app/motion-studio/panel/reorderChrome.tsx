"use client";

import type { ComponentProps } from "react";

/** Grip icon that starts a pointer drag. Keyboard users get MoveButtons instead. */
export function DragHandle({ label, index, className = "", ...rest }: ComponentProps<"span"> & { label: string; index: number }) {
  return (
    <span
      role="presentation"
      title={label}
      data-reorder-index={index}
      className={`cursor-grab select-none px-0.5 text-sm leading-none text-background-cta-40 hover:text-background-cta-70 active:cursor-grabbing ${className}`}
      {...rest}
    >
      ⋮⋮
    </span>
  );
}

/** Up / down buttons: the accessible path to reordering rows. */
export function MoveButtons({
  label,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const cls =
    "h-5 w-5 rounded text-[10px] leading-none text-background-cta-50 hover:bg-surface-sunken hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      <button type="button" className={cls} aria-label={`Move ${label} up`} disabled={!canUp} onClick={onUp}>
        ▲
      </button>
      <button type="button" className={cls} aria-label={`Move ${label} down`} disabled={!canDown} onClick={onDown}>
        ▼
      </button>
    </span>
  );
}
