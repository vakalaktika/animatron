"use client";

import { Button } from "@/app/components/shared-components";
import { DownloadIcon, ImageIcon, SmoothIcon, SquiggleIcon, WingIcon } from "../motion-studio/panel/icons";
import { bands, bbox } from "./lib/geometry";
import type { Stroke } from "./types";

interface StrokeListProps {
  strokes: Stroke[];
  colors: string[];
  band: number;
  onHover: (id: number | null) => void;
  onSmooth: (id: number) => void;
  onExport: (stroke: Stroke, index: number) => void;
  /** Send to the Motion Studio as a ribbon that paints itself in. */
  onAnimate: (stroke: Stroke) => void;
  /** Send to the Motion Studio: Chippy flies the squiggle and paints it behind. */
  onFly: (stroke: Stroke) => void;
  /** Send to the Motion Studio as a still picture. */
  onArtwork: (stroke: Stroke, index: number) => void;
  onRemove: (id: number) => void;
}

const ICON = "h-4 w-4";

/**
 * The per-squiggle roster in the sidebar. Each row previews the stroke, names
 * it, shows how many times it's been smoothed, and offers smooth / export /
 * delete, then the three ways to send it to the Motion Studio. Hovering a
 * row highlights the matching stroke on the canvas.
 */
export function StrokeList({ strokes, colors, band, onHover, onSmooth, onExport, onAnimate, onFly, onArtwork, onRemove }: StrokeListProps) {
  if (strokes.length === 0) {
    return <p className="atm-help">Nothing yet. Draw on the canvas and your squiggles will show up here.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {strokes.map((s, i) => {
        const [x, y, w, h] = bbox(s.pts, (colors.length * band) / 2 + 2);
        return (
          <li
            key={s.id}
            onMouseEnter={() => onHover(s.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(s.id)}
            onBlur={() => onHover(null)}
            className="flex flex-col gap-2 rounded-md border border-hairline bg-surface p-2.5"
          >
            <div className="flex items-center gap-2">
              <svg viewBox={`${x} ${y} ${w} ${h}`} className="h-8 w-12 flex-none overflow-visible" aria-hidden="true">
                {bands(s.pts, colors, band).map((b, j) => (
                  <path
                    key={j}
                    d={b.d}
                    fill="none"
                    stroke={b.color}
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <span className="min-w-0 flex-1 truncate text-sm">
                Squiggle {i + 1}
                {s.smoothed > 0 && <span className="font-sans text-[11px] tabular-nums text-ink-muted"> · smoothed ×{s.smoothed}</span>}
              </span>
              <Button variant="outline" size="xs" onClick={() => onRemove(s.id)} aria-label={`Delete squiggle ${i + 1}`}>
                Delete
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="xs" icon={<SmoothIcon className={ICON} />} onClick={() => onSmooth(s.id)}>
                Smooth
              </Button>
              <Button variant="outline" size="xs" icon={<DownloadIcon className={ICON} />} onClick={() => onExport(s, i)}>
                SVG
              </Button>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-hairline pt-2">
              <span className="atm-section-label">Send to the studio</span>
              <Button variant="primary" size="xs" fullWidth icon={<SquiggleIcon className={ICON} />} onClick={() => onAnimate(s)}>
                Animate it
              </Button>
              <Button variant="outline" size="xs" fullWidth icon={<WingIcon className={ICON} />} onClick={() => onFly(s)}>
                Fly Chippy on it
              </Button>
              <Button variant="outline" size="xs" fullWidth icon={<ImageIcon className={ICON} />} onClick={() => onArtwork(s, i)}>
                Add as artwork
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
