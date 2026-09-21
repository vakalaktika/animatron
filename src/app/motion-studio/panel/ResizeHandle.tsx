"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface Props {
  /** "x" resizes a side panel (drag left/right); "y" a bottom panel (drag up/down). */
  axis: "x" | "y";
  label: string;
  /** Id of the panel this handle sizes. */
  controls: string;
  value: number;
  min: number;
  max: number;
  /** Default size, restored by double-click. */
  initial: number;
  onChange: (next: number) => void;
}

const STEP = 16;
const BIG_STEP = 64;

/**
 * A draggable divider for a panel that sits at the right or bottom edge, so
 * dragging toward the stage grows the panel. Keyboard: arrows resize, Shift
 * takes bigger steps, Home/End jump to the limits (WAI-ARIA window splitter).
 */
export function ResizeHandle({ axis, label, controls, value, min, max, initial, onChange }: Props) {
  const start = useRef<{ pointer: number; value: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const x = axis === "x";

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { pointer: x ? e.clientX : e.clientY, value };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    // The panel sits after the handle, so moving toward the stage (left / up) grows it.
    onChange(s.value - ((x ? e.clientX : e.clientY) - s.pointer));
  };
  const onPointerUp = () => {
    start.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? BIG_STEP : STEP;
    const grow = x ? "ArrowLeft" : "ArrowUp";
    const shrink = x ? "ArrowRight" : "ArrowDown";
    const next =
      e.key === grow ? value + step
      : e.key === shrink ? value - step
      : e.key === "Home" ? min
      : e.key === "End" ? max
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-controls={controls}
      aria-orientation={x ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      title={`${label}. Double-click to reset.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onChange(initial)}
      onKeyDown={onKeyDown}
      data-dragging={dragging || undefined}
      className={`atm-resize group relative z-10 shrink-0 touch-none select-none outline-none ${
        x ? "-mx-1 w-2 cursor-col-resize" : "-my-1 h-2 cursor-row-resize"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute bg-border-strong transition-colors duration-150 group-hover:bg-primary group-focus-visible:bg-focus group-data-dragging:bg-primary ${
          x ? "inset-y-0 left-1/2 w-px -translate-x-1/2" : "inset-x-0 top-1/2 h-px -translate-y-1/2"
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-1/2 left-1/2 -translate-1/2 rounded-full border border-border-strong bg-surface-raised opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-dragging:opacity-100 pointer-coarse:opacity-100 ${
          x ? "h-9 w-2" : "h-2 w-9"
        }`}
      />
    </div>
  );
}
