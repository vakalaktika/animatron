/**
 * The rainbow squiggle: a centerline fanned into side-by-side colour bands.
 * Squiggle Studio draws with this, and a sprite's rainbow trail paints the
 * same bands behind it, so the two tools always agree on what a squiggle
 * looks like. Pure geometry and literal colours, no DOM, no CSS variables.
 */

import { buildPath } from "./path";

/** A 2D point in pixel space, `[x, y]`. */
export type Point = [number, number];

/**
 * The six rainbow hues, as concrete hex values mirroring the `--rainbow-*`
 * tokens in `src/app/styles/colors.css`. They're duplicated here rather than
 * read from CSS because a `<input type="color">` swatch and an exported
 * standalone `.svg` both need a literal color — `var(--rainbow-blue)` would
 * resolve to nothing outside the app. Keep in sync with colors.css.
 */
export const RAINBOW = {
  red: "#c74028",
  orange: "#e57b30",
  yellow: "#f9c958",
  green: "#59996a",
  blue: "#457a9d",
  purple: "#7a5d86",
} as const;

/** A named color preset shown as a quick-apply swatch. */
export interface RainbowPreset {
  name: string;
  colors: string[];
}

/**
 * Quick-apply presets. `name` is a translation key suffix (`admin.tools.
 * squiggle.presets.<name>`); the label itself is resolved by the caller so
 * this stays i18n-agnostic.
 */
export const RAINBOW_PRESETS: RainbowPreset[] = [
  { name: "cool", colors: [RAINBOW.blue, RAINBOW.green, RAINBOW.purple] },
  { name: "warm", colors: [RAINBOW.red, RAINBOW.orange, RAINBOW.yellow] },
  {
    name: "full",
    colors: [RAINBOW.red, RAINBOW.orange, RAINBOW.yellow, RAINBOW.green, RAINBOW.blue, RAINBOW.purple],
  },
];

/** One rainbow band of a stroke: an SVG path, its stroke color, and its width. */
export interface Band {
  /** SVG path data for the band's centerline. */
  d: string;
  /** Concrete color string (hex/rgb) — never a CSS var, so exports resolve. */
  color: string;
  /** Stroke width in user units. */
  w: number;
}

/**
 * Walk the polyline and drop a point every `step` pixels of arc length, so the
 * spacing is uniform no matter how fast the pointer moved. Endpoints are always
 * kept. Fewer than two points pass through unchanged.
 */
export function resample(pts: Point[], step: number): Point[] {
  if (pts.length < 2) return pts.slice();
  const out: Point[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= step) {
      const t = (step - acc) / seg;
      const nx = ax + (bx - ax) * t;
      const ny = ay + (by - ay) * t;
      out.push([nx, ny]);
      ax = nx;
      ay = ny;
      seg = Math.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += seg;
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Points closer together than this are drawn as they lie (a stroke straight
 * off the pointer); sparser ones are run through the spline first, so a
 * hand-drawn line and a few clean waypoints both come out as the same smooth
 * curve. The spline is skipped for dense input because a stroke in progress
 * redraws every pointer move.
 */
const DENSE_SPACING = 12;

/**
 * The smooth curve through `pts`, sampled every `step` pixels. Sparse points
 * are interpolated with the centripetal spline (the one ribbons and flight
 * paths use), which never kinks or overshoots however the points fall.
 */
export function densify(pts: Point[], step = 10): Point[] {
  if (pts.length < 3) return pts.slice();
  if (polylineLength(pts) / (pts.length - 1) <= DENSE_SPACING) return pts;
  const spline = buildPath(pts.map(([x, y]) => ({ x, y })), false).polyline;
  return resample(spline.map((p): Point => [p.x, p.y]), step);
}

/** Spacing of the points a smoothed squiggle is reduced to. Sparse enough that the spline, not the hand, shapes the curve. */
const SMOOTH_SPACING = 20;
/** Box-blur half-window in 3px samples: about ±18px, the scale of hand jitter. */
const SMOOTH_WINDOW = 6;

/**
 * Smooth a squiggle the way the homepage ribbons are smooth: blur out the
 * hand's jitter, then keep only a sparse set of points and let the spline
 * draw the curve between them. The line is first densified along its spline
 * (so a previously smoothed, sparse line is not re-read as a polygon), then
 * resampled tightly, blurred in three passes with the endpoints pinned, and
 * reduced to `SMOOTH_SPACING`. Each call relaxes a little more, which is why
 * repeated "Smooth" presses keep rounding the line.
 */
export function smoothPts(pts: Point[]): Point[] {
  let p = resample(densify(pts, 3), 3);
  for (let pass = 0; pass < 3; pass++) {
    const q = p.slice();
    for (let i = 1; i < p.length - 1; i++) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let k = -SMOOTH_WINDOW; k <= SMOOTH_WINDOW; k++) {
        const j = Math.min(p.length - 1, Math.max(0, i + k));
        sx += p[j][0];
        sy += p[j][1];
        n++;
      }
      q[i] = [sx / n, sy / n];
    }
    p = q;
  }
  return resample(p, SMOOTH_SPACING);
}

/**
 * Shift every point `d` pixels along its local normal, producing a parallel
 * copy of the centerline. Positive `d` fans one way, negative the other — this
 * is how the rainbow bands sit side by side.
 */
export function offset(pts: Point[], d: number): Point[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const L = Math.hypot(tx, ty) || 1;
    tx /= L;
    ty /= L;
    return [p[0] - ty * d, p[1] + tx * d];
  });
}

/**
 * Turn a point list into a smooth SVG path using Catmull-Rom control points
 * expressed as cubic béziers. Degenerate cases (one or two points) fall back to
 * a dot and a straight line.
 */
export function curve(pts: Point[]): string {
  if (pts.length === 1) {
    return `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} l0.01 0`;
  }
  if (pts.length === 2) {
    return `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} L${pts[1][0].toFixed(
      1,
    )} ${pts[1][1].toFixed(1)}`;
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(
      1,
    )} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Build the rainbow bands for a stroke: one offset path per color, fanned
 * symmetrically around the centerline so the colors sit shoulder to shoulder.
 * Band width is `band + 0.6` so neighbors overlap slightly and leave no gap.
 */
export function bands(pts: Point[], colors: string[], band: number): Band[] {
  const n = colors.length;
  const line = densify(pts);
  return colors.map((color, i) => ({
    color,
    w: band + 0.6,
    d: curve(offset(line, (i - (n - 1) / 2) * band)),
  }));
}

/** Axis-aligned bounding box `[x, y, w, h]` of the points, padded by `pad`. */
export function bbox(
  pts: Point[],
  pad: number,
): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
}

/** Total arc length of a polyline, in the same units as its points. */
export function polylineLength(pts: Point[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}
