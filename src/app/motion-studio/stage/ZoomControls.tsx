"use client";

import { MinusIcon, PlusIcon } from "../panel/icons";
import { MAX_VIEW_SCALE, MIN_VIEW_SCALE } from "../lib/viewport";

interface Props {
  /** The view's zoom on top of fitting the canvas (1 = fit). */
  scale: number;
  /** The canvas is fitted and centred. */
  fitted: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

const BUTTON =
  "flex h-9 min-w-9 items-center justify-center rounded-md px-1.5 text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-primary";

/**
 * The single-pointer way to do what pinching and two-finger dragging do:
 * zoom out, back to fit, zoom in. Floats over the stage's bottom-left
 * corner, clear of the add rail and the phone's add button.
 */
export function ZoomControls({ scale, fitted, onZoomIn, onZoomOut, onFit }: Props) {
  const percent = Math.round(scale * 100);
  return (
    <div
      data-stage-overlay
      role="group"
      aria-label="Canvas zoom"
      className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-hairline bg-surface-raised p-0.5 shadow-sm"
    >
      <button type="button" className={BUTTON} aria-label="Zoom out" title="Zoom out" disabled={scale <= MIN_VIEW_SCALE} onClick={onZoomOut}>
        <MinusIcon width={16} height={16} />
      </button>
      <button
        type="button"
        className={`${BUTTON} w-14 font-sans text-[12px] tabular-nums`}
        aria-label={fitted ? `Zoom ${percent}%, fitted to the screen` : `Zoom ${percent}%. Fit the canvas to the screen`}
        title="Fit to screen"
        disabled={fitted}
        onClick={onFit}
      >
        {percent}%
      </button>
      <button type="button" className={BUTTON} aria-label="Zoom in" title="Zoom in" disabled={scale >= MAX_VIEW_SCALE} onClick={onZoomIn}>
        <PlusIcon width={16} height={16} />
      </button>
    </div>
  );
}
