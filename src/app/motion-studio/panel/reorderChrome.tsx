"use client";

import type { ComponentProps } from "react";
import { ArrowDownIcon, ArrowUpIcon, GripIcon } from "./icons";

/** Grip icon that starts a pointer drag. Keyboard users get MoveButtons instead. */
export function DragHandle({ label, index, className = "", ...rest }: ComponentProps<"span"> & { label: string; index: number }) {
  return (
    <span
      role="presentation"
      title={label}
      data-reorder-index={index}
      className={`flex cursor-grab touch-none select-none items-center justify-center px-0.5 text-ink-muted hover:text-ink-secondary active:cursor-grabbing pointer-coarse:px-2 pointer-coarse:py-3 ${className}`}
      {...rest}
    >
      <GripIcon width={14} height={14} />
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
  className = "flex",
}: {
  className?: string;
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const cls =
    "flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <span className={`${className} shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100`}>
      <button type="button" className={cls} aria-label={`Move ${label} up`} disabled={!canUp} onClick={onUp}>
        <ArrowUpIcon width={12} height={12} />
      </button>
      <button type="button" className={cls} aria-label={`Move ${label} down`} disabled={!canDown} onClick={onDown}>
        <ArrowDownIcon width={12} height={12} />
      </button>
    </span>
  );
}
