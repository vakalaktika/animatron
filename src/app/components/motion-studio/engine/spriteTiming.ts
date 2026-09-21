import type { SpriteClip, Waypoint } from "../types";
import { clamp01, lerp, resolveEase } from "./easing";
import { buildPath, type PathSample, type PathSampler } from "./path";

/** Values a waypoint has when it doesn't set its own. */
export const WAYPOINT_DEFAULTS = { scale: 1, rotate: 0, opacity: 1, hold: 0 } as const;

/** When a sprite reaches and leaves one waypoint, in seconds from the clip start. */
export interface WaypointTiming {
  /** Seconds of travel (holds excluded) to reach this point: its own `time`, or `auto`. */
  travel: number;
  /** Where the clip's easing alone would put this point. */
  auto: number;
  /** Whether the point's time can be changed (not pinned to the start or end). */
  movable: boolean;
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
  /** Some waypoint has its own time, so travel is remapped segment by segment. */
  retimed: boolean;
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
 * When the sprite reaches each waypoint. By default travel is paced by the
 * clip's easing over `duration`; a waypoint with its own `time` overrides
 * that. Each hold then pauses the sprite in place and pushes everything after
 * it later.
 */
export function spriteTiming(clip: SpriteClip): SpriteTiming {
  const cached = timings.get(clip);
  if (cached) return cached;
  const duration = Math.max(0.001, clip.duration);
  const ease = resolveEase(clip.ease);
  const progress = spritePath(clip).pointProgress;
  const last = clip.path.length - 1;
  let held = 0;
  let retimed = false;
  const points = clip.path.map((p, i) => {
    const fraction = progress[i] ?? 0;
    const auto = (clip.loop ? fraction : invertEase(ease, fraction)) * duration;
    const movable = i > 0 && (clip.loop || i < last);
    const own = movable && p.time !== undefined ? Math.min(duration, Math.max(0, p.time)) : undefined;
    if (own !== undefined) retimed = true;
    const travel = own ?? auto;
    const arrive = travel + held;
    held += holdOf(p);
    return { travel, auto, movable, arrive, leave: arrive + holdOf(p) };
  });
  const timing = { points, totalHold: held, active: duration + held, retimed };
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

/**
 * Maps retimed travel back onto the easing's own clock, segment by segment,
 * so each stretch between waypoints keeps the ease's shape while reaching
 * every waypoint at its chosen time.
 */
function toEaseClock(timing: SpriteTiming, travel: number, duration: number): number {
  if (!timing.retimed) return travel;
  const points = [...timing.points, { travel: duration, auto: duration }];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (travel < b.travel) {
      const span = b.travel - a.travel;
      return span <= 0 ? b.auto : lerp(a.auto, b.auto, (travel - a.travel) / span);
    }
  }
  return travel;
}

/** Seconds of travel (holds excluded) the sprite has covered at clock time `t`. */
export function spriteTravelAt(clip: SpriteClip, t: number): number {
  const timing = spriteTiming(clip);
  const local = t - clip.start;
  if (local <= 0) return 0;
  return travelAt(timing, clip.loop ? local % timing.active : local);
}

/** Eased 0..1 progress along the path at clock time `t` (or the looping phase). */
export function spriteProgress(clip: SpriteClip, t: number): number {
  const timing = spriteTiming(clip);
  if (t - clip.start <= 0) return 0;
  const duration = Math.max(0.001, clip.duration);
  const eased = toEaseClock(timing, spriteTravelAt(clip, t), duration) / duration;
  if (clip.loop) return eased % 1;
  return resolveEase(clip.ease)(clamp01(eased));
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
