import type { SpriteClip, Waypoint } from "../types";
import { clamp01, lerp, resolveEase } from "./easing";
import { buildPath, type PathSample, type PathSampler } from "./path";

/** Values a waypoint has when it doesn't set its own. */
export const WAYPOINT_DEFAULTS = { scale: 1, rotate: 0, opacity: 1, hold: 0 } as const;

/** When a sprite reaches and leaves one waypoint, in seconds from the clip start. */
export interface WaypointTiming {
  /** Seconds of pure travel (holds excluded) to reach this point. */
  travel: number;
  arrive: number;
  /** arrive + this point's hold. */
  leave: number;
}

export interface SpriteTiming {
  points: WaypointTiming[];
  /** Sum of every waypoint's hold. */
  totalHold: number;
  /** Travel duration plus holds: how long the sprite is moving or paused on its path. */
  active: number;
}

const EASE_SOLVE_STEPS = 32;

// Clips are replaced immutably on every edit, so the clip object itself is a
// sound cache key for its spline and its timing.
const samplers = new WeakMap<SpriteClip, PathSampler>();
const timings = new WeakMap<SpriteClip, SpriteTiming>();

export function spritePath(clip: SpriteClip): PathSampler {
  const cached = samplers.get(clip);
  if (cached) return cached;
  const built = buildPath(clip.path, clip.loop);
  samplers.set(clip, built);
  return built;
}

/** First time u in 0..1 where the ease reaches `target` (bisection; eases rise overall). */
function invertEase(ease: (t: number) => number, target: number): number {
  if (target <= 0) return 0;
  if (target >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < EASE_SOLVE_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

const holdOf = (p: Waypoint) => (p.hold !== undefined && p.hold > 0 ? p.hold : 0);

/**
 * When the sprite reaches each waypoint. Travel is paced by the clip's easing
 * over `duration`; each hold then pauses the sprite in place and pushes
 * everything after it later.
 */
export function spriteTiming(clip: SpriteClip): SpriteTiming {
  const cached = timings.get(clip);
  if (cached) return cached;
  const duration = Math.max(0.001, clip.duration);
  const ease = resolveEase(clip.ease);
  const progress = spritePath(clip).pointProgress;
  let held = 0;
  const points = clip.path.map((p, i) => {
    const fraction = progress[i] ?? 0;
    const travel = (clip.loop ? fraction : invertEase(ease, fraction)) * duration;
    const arrive = travel + held;
    held += holdOf(p);
    return { travel, arrive, leave: arrive + holdOf(p) };
  });
  const timing = { points, totalHold: held, active: duration + held };
  timings.set(clip, timing);
  return timing;
}

/** Seconds from the clip start until the sprite finishes its path (holds included). */
export function spriteActiveDuration(clip: SpriteClip): number {
  return spriteTiming(clip).active;
}

/** Maps seconds since the clip started to seconds of travel, pausing through holds. */
function travelAt(timing: SpriteTiming, local: number): number {
  let held = 0;
  for (const point of timing.points) {
    if (local < point.arrive) return local - held;
    if (local < point.leave) return point.travel;
    held += point.leave - point.arrive;
  }
  return local - held;
}

/** Eased 0..1 progress along the path at clock time `t` (or the looping phase). */
export function spriteProgress(clip: SpriteClip, t: number): number {
  const timing = spriteTiming(clip);
  const local = t - clip.start;
  if (local <= 0) return 0;
  const duration = Math.max(0.001, clip.duration);
  if (clip.loop) return (travelAt(timing, local % timing.active) / duration) % 1;
  return resolveEase(clip.ease)(clamp01(travelAt(timing, local) / duration));
}

export interface WaypointValues {
  scale: number;
  rotate: number;
  opacity: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const valueOf = (p: Waypoint | undefined, key: keyof WaypointValues) => p?.[key] ?? WAYPOINT_DEFAULTS[key];

/** Scale, rotation and opacity at a path sample, eased between its two waypoints. */
export function waypointValuesAt(clip: SpriteClip, sample: PathSample): WaypointValues {
  const n = clip.path.length;
  const from = clip.path[sample.segment];
  const to = clip.path[clip.loop ? (sample.segment + 1) % Math.max(1, n) : Math.min(n - 1, sample.segment + 1)];
  const k = smooth(sample.segmentT);
  const mix = (key: keyof WaypointValues) => lerp(valueOf(from, key), valueOf(to, key), k);
  return { scale: mix("scale"), rotate: mix("rotate"), opacity: clamp01(mix("opacity")) };
}
