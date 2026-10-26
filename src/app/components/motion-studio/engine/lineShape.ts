import type { LineStyle, Vec2 } from "../types";
import type { LineSubject, LitSpan } from "./line";
import { lineSpans } from "./line";
import { shiftSpans } from "./trail";
import { resample, type Point } from "./rainbow";

/**
 * Per-frame geometry for a shaped line: the lit stretch rebuilt as a run of
 * small filled polygons whose width and opacity follow the style's profile
 * from tail to head. This is what gives a comet its taper and smooth fade,
 * a nib its thick-and-thin, and a braid its weave; the dash renderer can do
 * none of those. Pure geometry: the views turn the chunks into SVG.
 */

/** Spacing of the centerline samples the shape is built on. */
const SAMPLE_STEP = 4;
/** Target spacing of the polygon chunks along the line. */
const CHUNK_STEP = 6;
/** Most chunks per band per span, so a very long line stays cheap. */
const MAX_CHUNKS = 240;
/** Width left at the tail end of a fully tapered line, as a fraction of the band. */
const HAIRLINE = 0.08;
/** The bright core line's width, as a fraction of one band. */
const CORE_WIDTH = 0.22;
const CORE_COLOR = "#ffffff";
const CORE_ALPHA = 0.55;
/** A broad nib held at 45°, the classic calligraphy angle. */
const NIB_ANGLE = -Math.PI / 4;
/** How thin the nib's thin stroke gets. */
const NIB_THIN = 0.25;
/** Wavelength of the braid's weave in stage pixels, and how fast it travels. */
const WIGGLE_WAVELENGTH = 60;
const WIGGLE_SPEED = 4;
/** Echo copies: how far behind in time, how much fainter, how far sideways (in bands). */
const ECHO_LAG = 0.09;
const ECHO_FADE = 0.45;
const ECHO_SHIFT = 0.9;
/** Chase stripes: length of one colour cell, in bundle widths. */
const CHASE_PERIOD = 1.5;
/** A pinched head widens to full over this many bundle widths behind the object. */
const HEAD_RUN = 6;
/** `along` colour: the stretch (0 tail → 1 head) over which the accent gives way to the own colours. */
const ALONG_RUN = 0.7;

export interface Centerline {
  pts: Point[];
  /** Arc length at each point. */
  cum: number[];
  length: number;
  loop: boolean;
}

/** A dense, evenly spaced copy of the line in its parent frame (anchor applied). */
export function centerline(polyline: Vec2[], anchor: Vec2, loop: boolean): Centerline {
  const pts = resample(
    polyline.map((p): Point => [anchor.x + p.x, anchor.y + p.y]),
    SAMPLE_STEP,
  );
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, length: cum[cum.length - 1] ?? 0, loop };
}

interface Sample {
  x: number;
  y: number;
  /** Unit normal. */
  nx: number;
  ny: number;
  /** Direction of travel in radians. */
  angle: number;
}

/** The point `s` pixels along the line, wrapping on a loop and clamping otherwise. */
function sampleAt(c: Centerline, s: number): Sample {
  const { pts, cum, length } = c;
  const n = pts.length;
  if (n < 2 || length === 0) return { x: pts[0]?.[0] ?? 0, y: pts[0]?.[1] ?? 0, nx: 0, ny: 1, angle: 0 };
  const d = c.loop ? ((s % length) + length) % length : Math.min(length, Math.max(0, s));
  let lo = 0;
  let hi = n - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const span = cum[hi] - cum[lo];
  const t = span === 0 ? 0 : (d - cum[lo]) / span;
  let tx = b[0] - a[0];
  let ty = b[1] - a[1];
  const L = Math.hypot(tx, ty) || 1;
  tx /= L;
  ty /= L;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -ty, ny: tx, angle: Math.atan2(ty, tx) };
}

/** One filled polygon of the line. */
export interface Chunk {
  d: string;
  color: string;
  opacity: number;
}

const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

/**
 * Width multiplier at `u` (0 tail → 1 head) for the style's taper, nib and
 * pinched head. `toHead` is the distance in pixels back from the head, as a
 * fraction of the head run (0 at the object, ≥ 1 once the line is full).
 */
function widthAt(style: LineStyle, u: number, angle: number, flat: boolean, toHead: number): number {
  let w = 1;
  if (!flat && style.taper > 0) w *= 1 - style.taper * (1 - HAIRLINE) * (1 - Math.pow(u, 0.8));
  if (style.head < 1 && toHead < 1) w *= style.head + (1 - style.head) * smooth(toHead);
  if (style.nib > 0) {
    const thin = NIB_THIN + (1 - NIB_THIN) * Math.abs(Math.sin(angle - NIB_ANGLE));
    w *= 1 - style.nib * (1 - thin);
  }
  return w;
}

/** Opacity at `u` for the style's fade. */
function alphaAt(style: LineStyle, u: number, flat: boolean): number {
  if (flat || style.fade <= 0) return 1;
  return smooth(u / style.fade);
}

/** Hex colour → [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two hex colours; `t` = 1 is all `b`. Non-hex input falls back to `a`. */
export function mixColour(a: string, b: string, t: number): string {
  if (!a.startsWith("#") || !b.startsWith("#")) return a;
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

interface Lane {
  /** Sideways offset from the centerline, in stage pixels. */
  offset: number;
  width: number;
  color: (u: number, s: number, bandIndex: number) => string;
  alpha: number;
  index: number;
}

/** The side-by-side lanes a palette fans into, plus the core when asked. */
function lanes(style: LineStyle, colors: string[], band: number, t: number, accent: string[]): Lane[] {
  const n = colors.length;
  const out: Lane[] = colors.map((own, i) => ({
    index: i,
    offset: (i - (n - 1) / 2) * band,
    width: band + 0.6,
    alpha: 1,
    color: (u, s) => {
      if (style.colour === "along" && accent.length > 0) {
        // The accent palette is fanned across the bundle as a whole, so the
        // tail reads as that palette, and it gives way to the own colours only
        // over the stretch nearest the head.
        const target = accent[Math.round((i * (accent.length - 1)) / Math.max(1, n - 1))];
        return mixColour(own, target, smooth((1 - u) / ALONG_RUN));
      }
      if (style.colour === "chase") {
        // Stripes run diagonally across the whole bundle: the colour cell is
        // picked by distance along the line, skewed by the lane's offset.
        const cell = Math.floor((s + (i - (n - 1) / 2) * band) / (band * n * CHASE_PERIOD) + t * style.colourSpeed);
        return colors[((cell % n) + n) % n];
      }
      return own;
    },
  }));
  if (style.core) out.push({ index: n, offset: 0, width: Math.max(1, band * CORE_WIDTH), alpha: CORE_ALPHA, color: () => CORE_COLOR });
  return out;
}

/**
 * The polygons for one lit span across all lanes. Each chunk spans two
 * steps so neighbours overlap by one: the antialiased seam of one chunk
 * sits under the solid body of the next, and the per-chunk opacity is set
 * so two stacked chunks land on the profile's target.
 */
function spanChunks(
  c: Centerline,
  span: LitSpan,
  style: LineStyle,
  laneList: Lane[],
  t: number,
  shift: number,
  opacity: number,
): Chunk[] {
  const px = span.length * c.length;
  if (px <= 0 || c.length === 0) return [];
  const steps = Math.min(MAX_CHUNKS, Math.max(2, Math.round(px / CHUNK_STEP)));
  const start = span.tail * c.length;
  const out: Chunk[] = [];
  const headRun = HEAD_RUN * Math.max(1, laneList.length - (style.core ? 1 : 0)) * Math.max(1, laneList[0]?.width ?? 1);
  // Distance back from the head as a fraction of the run; a symmetric
  // stretch has no object at either end, so it never pinches.
  const toHeadAt = (i: number) => (span.symmetric ? 1 : (span.reverse ? i / steps : 1 - i / steps) * (px / headRun));
  const profileU = (i: number) => {
    const along = i / steps;
    const u = span.reverse ? 1 - along : along;
    return span.symmetric ? Math.min(u, 1 - u) * 2 : u;
  };
  for (const lane of laneList) {
    const pts: { x: number; y: number; nx: number; ny: number; w: number; a: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const s = start + (i / steps) * px;
      const smp = sampleAt(c, s);
      const u = profileU(i);
      const wf = widthAt(style, u, smp.angle, span.flat, toHeadAt(i));
      const w = (lane.width * wf) / 2;
      const wiggle =
        style.wiggle > 0 ? style.wiggle * Math.sin(s / WIGGLE_WAVELENGTH + lane.index * 2.1 + t * WIGGLE_SPEED) * (span.flat ? 1 : 0.3 + 0.7 * (1 - u)) : 0;
      // Lanes close up as the line thins, so the bundle narrows as one stroke.
      const off = lane.offset * wf + wiggle + shift;
      pts.push({ x: smp.x + smp.nx * off, y: smp.y + smp.ny * off, nx: smp.nx, ny: smp.ny, w, a: alphaAt(style, u, span.flat) * lane.alpha * opacity });
    }
    const side = (p: (typeof pts)[number], sg: number) => `${(p.x + p.nx * p.w * sg).toFixed(1)},${(p.y + p.ny * p.w * sg).toFixed(1)}`;
    const per = (a: number) => 1 - Math.sqrt(Math.max(0, 1 - a));
    for (let i = 0; i < steps; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const d2 = pts[Math.min(steps, i + 2)];
      const s = start + ((i + 1) / steps) * px;
      out.push({
        d: `M${side(a, 1)} L${side(b, 1)} L${side(d2, 1)} L${side(d2, -1)} L${side(b, -1)} L${side(a, -1)}Z`,
        color: lane.color(profileU(i + 1), s, lane.index),
        opacity: per((a.a + d2.a) / 2),
      });
    }
    // Round off the head so it reads as a brush tip, not a cut.
    const head = span.reverse ? pts[0] : pts[steps];
    if (!span.symmetric) {
      const headS = span.reverse ? start : start + px;
      out.push({
        d: `M${(head.x - head.w).toFixed(1)},${head.y.toFixed(1)} a${head.w.toFixed(1)},${head.w.toFixed(1)} 0 1,0 ${(head.w * 2).toFixed(1)},0 a${head.w.toFixed(1)},${head.w.toFixed(1)} 0 1,0 ${(-head.w * 2).toFixed(1)},0Z`,
        color: lane.color(span.reverse ? profileU(0) : profileU(steps), headS, lane.index),
        opacity: head.a,
      });
    }
  }
  return out;
}

/**
 * Every polygon of the line at time `t`: each lit span, in its palette,
 * plus the echo copies behind it. The caller wraps the result in SVG.
 */
export function lineChunks(
  c: Centerline,
  style: LineStyle,
  subject: LineSubject,
  colors: string[],
  band: number,
  t: number,
  /** Pulls every lit stretch back along the line by this fraction (a trail tucked under its sprite). */
  pullBack = 0,
): Chunk[] {
  const out: Chunk[] = [];
  const copies = Math.max(0, Math.min(3, Math.round(style.echo)));
  for (let k = copies; k >= 0; k--) {
    const time = t - k * ECHO_LAG;
    const opacity = Math.pow(ECHO_FADE, k);
    const shift = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * band * colors.length * ECHO_SHIFT;
    for (const span of shiftSpans(lineSpans(style, subject, time), pullBack, subject.loop)) {
      const palette = span.palette === "accent" && style.accent.length > 0 ? style.accent : colors;
      const laneList = lanes(style, palette, band, time, style.accent);
      out.push(...spanChunks(c, span, style, laneList, time, shift, opacity * span.opacity));
    }
  }
  return out;
}

const ATTR_ESCAPES: Record<string, string> = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };
/** A value made safe to sit inside a double-quoted attribute (colours come from documents, which can come from links). */
const attr = (value: string) => value.replace(/[&"<>]/g, (c) => ATTR_ESCAPES[c]);

/** The chunks as SVG markup, for a view to drop into a `<g>`. */
export function chunksMarkup(chunks: Chunk[]): string {
  let s = "";
  for (const ch of chunks) s += `<path d="${attr(ch.d)}" fill="${attr(ch.color)}" fill-opacity="${ch.opacity.toFixed(3)}"/>`;
  return s;
}

/** Degrees of hue rotation for the `cycle` colour mode at time `t`. */
export function hueAt(style: LineStyle, t: number): number {
  return style.colour === "cycle" ? (t * style.colourSpeed * 60) % 360 : 0;
}
