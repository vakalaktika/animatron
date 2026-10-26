import type { Clip, RibbonClip, StudioDoc, TextClip, Vec2 } from "../types";
import { propValue } from "./keys";
import type { PathSampler } from "./path";
import { ribbonHead, ribbonPath, ribbonPointAt } from "./ribbon";

/** Where one glyph of flowing text sits: its centre and heading, in the ribbon's anchor frame. */
export interface GlyphSeat {
  x: number;
  y: number;
  /** Degrees, clockwise on screen. */
  angle: number;
  /** False when the glyph falls off either end of an open ribbon; the view hides it. */
  onPath: boolean;
}

/** Is this clip text set along its ribbon parent? Needs `flow` and a seat on the ribbon. */
export function flowsOnRibbon(clip: Clip, parent: Clip | undefined): boolean {
  return clip.type === "text" && !!clip.flow && parent?.type === "ribbon" && clip.along !== null && clip.along !== undefined;
}

/** The ribbon a text clip flows along, or null when it is laid out as a plain line. */
export function flowRibbon(doc: StudioDoc, clip: TextClip): RibbonClip | null {
  const parent = doc.clips.find((c) => c.id === clip.parentId);
  return parent?.type === "ribbon" && flowsOnRibbon(clip, parent) ? parent : null;
}

/** Which part of the run is pinned to the seat: a point seat centres it, the paint head trails it. */
export type FlowAlign = "center" | "end";

/** A polyline walked by distance: the line the glyphs actually sit on. */
interface Track {
  lift: number;
  points: Vec2[];
  /** Distance from the first point to each point. */
  cumulative: number[];
  length: number;
  /** The same for the centreline it was lifted off, point for point. */
  base: number[];
}

// One offset track per path, rebuilt when the lift changes (a drag changes
// it every frame, so older lifts are not kept). Paths are cached per ribbon
// (engine/ribbon.ts), so the path is a sound key.
const tracks = new WeakMap<PathSampler, Track>();

const walk = (points: Vec2[]) => {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return out;
};

/**
 * The path's polyline pushed `lift` px along its normal (negative = left of
 * travel). Glyphs are spaced along this line rather than the centreline, so
 * a run lifted off the inside of a bend does not bunch up, nor spread out on
 * the outside.
 */
function offsetTrack(path: PathSampler, closed: boolean, lift: number): Track {
  const cached = tracks.get(path);
  if (cached && cached.lift === lift) return cached;
  const line = path.polyline;
  const n = line.length;
  const neighbour = (i: number) => (closed ? line[(i + n - 1) % n] : line[Math.max(0, i - 1)]);
  const next = (i: number) => (closed ? line[(i + 1) % n] : line[Math.min(n - 1, i + 1)]);
  const points = line.map((p, i) => {
    const a = neighbour(i);
    const b = next(i);
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Unit tangent (tx, ty); the left-of-travel normal is (ty, -tx).
    const tx = (b.x - a.x) / d;
    const ty = (b.y - a.y) / d;
    return { x: p.x - lift * ty, y: p.y + lift * tx };
  });
  const cumulative = walk(points);
  const track = { lift, points, cumulative, length: cumulative[n - 1] ?? 0, base: walk(line) };
  tracks.set(path, track);
  return track;
}

/**
 * Distance along the track level with fraction `pin` of the centreline, so
 * a seat (and the paint head) means the same spot whether or not the text
 * is lifted: the lifted line is longer or shorter through every bend.
 */
function pinDistance(track: Track, pin: number): number {
  const { base, cumulative } = track;
  if (base.length < 2) return 0;
  const target = pin * base[base.length - 1];
  let lo = 0;
  let hi = base.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (base[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = base[hi] - base[lo];
  const u = span === 0 ? 0 : Math.min(1, Math.max(0, (target - base[lo]) / span));
  return cumulative[lo] + (cumulative[hi] - cumulative[lo]) * u;
}

/** The point and heading `distance` along a track (clamped to its ends). */
function trackAt(track: Track, distance: number): { x: number; y: number; angle: number } {
  const { points, cumulative } = track;
  if (points.length < 2) return { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, angle: 0 };
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const span = cumulative[hi] - cumulative[lo];
  const u = span === 0 ? 0 : Math.min(1, Math.max(0, (distance - cumulative[lo]) / span));
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

/**
 * Lays a run of glyphs with the given advance widths along `path`, the way
 * text sits on a path: each glyph's centre on the line `lift` px off the
 * curve (negative = left of travel), turned to its tangent there. The run
 * is pinned level with fraction `pin` of the path by its centre or its end, then
 * slid `shift` px along it. A closed path wraps; on an open one, glyphs
 * past either end are marked off the path.
 */
export function flowGlyphs(
  path: PathSampler,
  closed: boolean,
  pin: number,
  align: FlowAlign,
  widths: number[],
  shift: number,
  lift: number,
): GlyphSeat[] {
  const track = offsetTrack(path, closed, lift);
  const { length } = track;
  const total = widths.reduce((sum, w) => sum + w, 0);
  let cursor = pinDistance(track, pin) + shift - (align === "center" ? total / 2 : total);
  return widths.map((w) => {
    const mid = cursor + w / 2;
    cursor += w;
    const onPath = closed || (mid >= 0 && mid <= length);
    const at = closed && length > 0 ? ((mid % length) + length) % length : mid;
    return { ...trackAt(track, at), onPath };
  });
}

/** Fraction of the ribbon a flowing clip is pinned at, at time `t`: its seat, or the paint head. */
function flowPin(clip: TextClip, ribbon: RibbonClip, t: number): number {
  if (clip.along === "front") return ribbonHead(ribbon, t);
  return typeof clip.along === "number" ? clip.along : 0;
}

/**
 * The glyph seats of a flowing text clip at time `t` (riding the front
 * follows the paint head). `widths` are the glyphs' unscaled advances; the
 * clip's size scales them, as it scales the glyphs drawn. Keyframed slide,
 * lift and size are read at `t`.
 */
export function flowSeats(clip: TextClip, ribbon: RibbonClip, widths: number[], t: number): GlyphSeat[] {
  const align = clip.along === "front" ? "end" : "center";
  const scale = propValue(clip, "scale", t);
  const advances = widths.map((w) => w * scale);
  const pin = flowPin(clip, ribbon, t);
  return flowGlyphs(ribbonPath(ribbon), ribbon.loop, pin, align, advances, propValue(clip, "x", t), propValue(clip, "y", t));
}

/**
 * A drag of a flowing clip in the ribbon's frame, turned into its own
 * terms: how far to slide along the ribbon (`x`) and lift off it (`y`),
 * measured against the ribbon's heading at the seat.
 */
export function flowDragDelta(clip: TextClip, ribbon: RibbonClip, delta: Vec2, t: number): Vec2 {
  const a = (ribbonPointAt(ribbon, flowPin(clip, ribbon, t)).angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: delta.x * cos + delta.y * sin, y: -delta.x * sin + delta.y * cos };
}
