import { spritePath, spriteProgress, waypointValuesAt, WAYPOINT_DEFAULTS } from "@/app/components/motion-studio/engine/spriteTiming";
import type { PathSample } from "@/app/components/motion-studio/engine/path";
import type { SpriteClip, Waypoint } from "@/app/components/motion-studio/types";

// Closer than this to an existing waypoint (path px), a new one goes mid-segment instead.
const MIN_GAP = 12;

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
  const path = [...clip.path.slice(0, index), waypointFrom(clip, sample), ...clip.path.slice(index)];
  return { clip: { ...clip, path }, index };
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
    return [point];
  });
}
