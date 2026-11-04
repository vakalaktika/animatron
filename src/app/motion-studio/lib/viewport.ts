import type { Vec2 } from "@/app/components/motion-studio/types";

/**
 * How the editor looks at the canvas, on top of fitting it to the stage
 * area: `scale` multiplies the fitted zoom (1 = fit) and `x` / `y` pan the
 * canvas from the centre, in screen pixels. Points are given relative to
 * the centre of the stage area.
 */
export interface View {
  scale: number;
  x: number;
  y: number;
}

export const FIT_VIEW: View = { scale: 1, x: 0, y: 0 };
export const MIN_VIEW_SCALE = 0.5;
export const MAX_VIEW_SCALE = 8;
/** Each zoom button press. */
export const ZOOM_STEP = 1.25;
/** At least this much of the canvas (screen px) stays on screen however far it is panned. */
const KEEP_VISIBLE = 48;

const clampScale = (s: number) => Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, s));

export const isFit = (view: View) => view.scale === 1 && view.x === 0 && view.y === 0;

/**
 * Keeps part of the canvas on screen: `canvas` is its size at the fitted
 * zoom and `area` the stage area's, both in screen pixels.
 */
export function clampView(view: View, canvas: Vec2, area: Vec2): View {
  const maxX = Math.max(0, (canvas.x * view.scale) / 2 + area.x / 2 - KEEP_VISIBLE);
  const maxY = Math.max(0, (canvas.y * view.scale) / 2 + area.y / 2 - KEEP_VISIBLE);
  return { scale: view.scale, x: Math.min(maxX, Math.max(-maxX, view.x)), y: Math.min(maxY, Math.max(-maxY, view.y)) };
}

/** Zooms by `factor` keeping the canvas point under `at` where it is. */
export function zoomAbout(view: View, factor: number, at: Vec2): View {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale;
  return { scale, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k };
}

const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Two fingers moving from `from` to `to`: the spread zooms (about the
 * point between them) and the shared movement pans, so the canvas point
 * that started between the fingers stays between them.
 */
export function pinchView(start: View, from: [Vec2, Vec2], to: [Vec2, Vec2]): View {
  const d0 = gap(from[0], from[1]);
  const factor = d0 > 0 ? gap(to[0], to[1]) / d0 : 1;
  const m0 = mid(from[0], from[1]);
  const m1 = mid(to[0], to[1]);
  const zoomed = zoomAbout(start, factor, m0);
  return { ...zoomed, x: zoomed.x + m1.x - m0.x, y: zoomed.y + m1.y - m0.y };
}

/**
 * Zoom per pixel of wheel travel. A trackpad pinch sends many small deltas;
 * a mouse wheel notch is about 100 px, which this makes roughly a 1.3× step.
 */
const WHEEL_ZOOM = 0.0025;

/** A wheel event: pinching on a trackpad (or Ctrl + wheel) zooms; plain scrolling pans a zoomed-in view. */
export function wheelView(view: View, delta: Vec2, zoom: boolean, at: Vec2): View {
  if (zoom) return zoomAbout(view, Math.exp(-delta.y * WHEEL_ZOOM), at);
  return { ...view, x: view.x - delta.x, y: view.y - delta.y };
}
