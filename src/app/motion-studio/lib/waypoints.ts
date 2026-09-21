import { spritePath, spriteProgress, spriteTiming, spriteTravelAt, waypointValuesAt, WAYPOINT_DEFAULTS } from "@/app/components/motion-studio/engine/spriteTiming";
import type { PathSample } from "@/app/components/motion-studio/engine/path";
import type { SpriteClip, Waypoint } from "@/app/components/motion-studio/types";

// Closer than this to an existing waypoint (path px), a new one goes mid-segment instead.
const MIN_GAP = 12;
// Closest two neighbouring waypoints may be in time, in seconds of travel.
const MIN_STEP = 0.05;

const round = (v: number) => Math.round(v * 10) / 10;

/** A waypoint at `sample`, carrying the values the sprite has there so nothing jumps. */
function waypointFrom(clip: SpriteClip, sample: PathSample): Waypoint {
  const values = waypointValuesAt(clip, sample);
  const point: Waypoint = { x: round(sample.x), y: round(sample.y) };
  if (Math.abs(values.scale - WAYPOINT_DEFAULTS.scale) > 1e-3) point.scale = round(values.scale * 100) / 100;
  if (Math.abs(values.rotate - WAYPOINT_DEFAULTS.rotate) > 1e-3) point.rotate = round(values.rotate);
  if (Math.abs(values.opacity - WAYPOINT_DEFAULTS.opacity) > 1e-3) point.opacity = round(values.opacity * 100) / 100;
  return point;
}

/**
 * Inserts a waypoint where the sprite is at clock time `t`, between the two
 * waypoints it is travelling through. If that spot is on top of an existing
 * waypoint (at the start, the end, or during a hold), the new one goes
 * halfway along the neighbouring segment instead. Returns the new index.
 */
export function insertWaypointAt(clip: SpriteClip, t: number): { clip: SpriteClip; index: number } {
  const sampler = spritePath(clip);
  const n = clip.path.length;
  let sample = sampler.at(spriteProgress(clip, t));
  const near = clip.path.findIndex((p) => Math.hypot(p.x - sample.x, p.y - sample.y) < MIN_GAP);
  if (near !== -1 && n >= 2) {
    const segment = !clip.loop && near === n - 1 ? n - 2 : near;
    const from = sampler.pointProgress[segment];
    const to = segment + 1 < n ? sampler.pointProgress[segment + 1] : 1;
    sample = sampler.at((from + to) / 2);
  }
  const index = Math.min(n, sample.segment + 1);
  const point = waypointFrom(clip, sample);
  // Once any waypoint has its own time, pin the new one too, at the travel it
  // was added at (or midway between its neighbours), so the order holds.
  const timing = spriteTiming(clip);
  if (timing.retimed) {
    const before = timing.points[index - 1]?.travel ?? 0;
    const after = timing.points[index]?.travel ?? clip.duration;
    const travel = near === -1 ? spriteTravelAt(clip, t) : (before + after) / 2;
    point.time = round(Math.min(after - MIN_STEP, Math.max(before + MIN_STEP, travel)) * 100) / 100;
  }
  const path = [...clip.path.slice(0, index), point, ...clip.path.slice(index)];
  return { clip: { ...clip, path }, index };
}


/**
 * Sets when the sprite reaches waypoint `index`, in seconds of travel from
 * the clip start (holds excluded), without touching where it is or how it
 * looks there. Clamped between its neighbours; the first point and an open
 * path's last point stay pinned to the start and end.
 */
export function retimeWaypoint(clip: SpriteClip, index: number, travel: number): SpriteClip {
  const timing = spriteTiming(clip);
  const point = timing.points[index];
  if (!point?.movable) return clip;
  const before = timing.points[index - 1]?.travel ?? 0;
  const after = timing.points[index + 1]?.travel ?? clip.duration;
  const time = Math.round(Math.min(after - MIN_STEP, Math.max(before + MIN_STEP, travel)) * 100) / 100;
  return { ...clip, path: clip.path.map((p, i) => (i === index ? { ...p, time } : p)) };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Keeps only well-formed waypoint fields from an imported or stored path.
 * Position is required; the optional values are dropped unless numeric.
 */
export function sanitizePath(raw: unknown): Waypoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): Waypoint[] => {
    if (typeof item !== "object" || item === null) return [];
    const v = item as Record<string, unknown>;
    if (!finite(v.x) || !finite(v.y)) return [];
    const point: Waypoint = { x: v.x, y: v.y };
    if (finite(v.scale)) point.scale = Math.max(0, v.scale);
    if (finite(v.rotate)) point.rotate = v.rotate;
    if (finite(v.opacity)) point.opacity = Math.min(1, Math.max(0, v.opacity));
    if (finite(v.hold) && v.hold > 0) point.hold = v.hold;
    if (finite(v.time) && v.time >= 0) point.time = v.time;
    return [point];
  });
}
