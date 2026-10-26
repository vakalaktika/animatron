import type { Clip, RibbonClip, StudioDoc, TextClip, Vec2 } from "../types";
import type { PathSampler } from "./path";
import { ribbonHead, ribbonPath } from "./ribbon";

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
  points: Vec2[];
  /** Distance from the first point to each point. */
  cumulative: number[];
  length: number;
}

// Offset tracks are rebuilt only when the path or the lift changes. Paths
// are cached per ribbon (engine/ribbon.ts), so the path is a sound key.
const tracks = new WeakMap<PathSampler, Map<number, Track>>();

/**
 * The path's polyline pushed `lift` px along its normal (negative = left of
 * travel). Glyphs are spaced along this line rather than the centreline, so
 * a run lifted off the inside of a bend does not bunch up, nor spread out on
 * the outside.
 */
function offsetTrack(path: PathSampler, closed: boolean, lift: number): Track {
  const byLift = tracks.get(path) ?? new Map<number, Track>();
  tracks.set(path, byLift);
  const cached = byLift.get(lift);
  if (cached) return cached;
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
  const cumulative = [0];
  for (let i = 1; i < n; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const track = { points, cumulative, length: cumulative[n - 1] ?? 0 };
  byLift.set(lift, track);
  return track;
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
 * is pinned at fraction `pin` of the path by its centre or its end, then
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
  let cursor = pin * length + shift - (align === "center" ? total / 2 : total);
  return widths.map((w) => {
    const mid = cursor + w / 2;
    cursor += w;
    const onPath = closed || (mid >= 0 && mid <= length);
    const at = closed && length > 0 ? ((mid % length) + length) % length : mid;
    return { ...trackAt(track, at), onPath };
  });
}

/** The glyph seats of a flowing text clip at time `t` (riding the front follows the paint head). */
export function flowSeats(clip: TextClip, ribbon: RibbonClip, widths: number[], t: number): GlyphSeat[] {
  const front = clip.along === "front";
  const pin = front ? ribbonHead(ribbon, t) : typeof clip.along === "number" ? clip.along : 0;
  return flowGlyphs(ribbonPath(ribbon), ribbon.loop, pin, front ? "end" : "center", widths, clip.x, clip.y);
}
