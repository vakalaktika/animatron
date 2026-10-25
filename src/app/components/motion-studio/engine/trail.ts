import type { SpriteClip, SpriteTrail } from "../types";
import { clamp01 } from "./easing";
import { bands, RAINBOW, resample, type Band, type Point } from "./rainbow";
import { spriteActiveDuration, spritePath, spriteProgress } from "./spriteTiming";

/** A fresh sprite carries a trail, switched off, in the cool rainbow. */
export const DEFAULT_TRAIL: SpriteTrail = {
  enabled: false,
  mode: "paint",
  cometSeconds: 0.8,
  colors: [RAINBOW.blue, RAINBOW.green, RAINBOW.purple],
  band: 8,
  fadeOut: 0,
};

/** Spacing of the trail's centerline samples; matches a smoothed squiggle. */
const TRAIL_STEP = 10;

// Clips are replaced immutably on every edit, so the clip object is a sound
// cache key for its bands, the same way transform.ts caches the spline.
const cache = new WeakMap<SpriteClip, Band[]>();

/**
 * The rainbow bands for a sprite's path, in the sprite's parent frame
 * (anchor offset applied). Built once per clip version; only the paint head
 * moves per frame.
 */
export function trailBands(clip: SpriteClip): Band[] {
  const cached = cache.get(clip);
  if (cached) return cached;
  const centerline: Point[] = spritePath(clip).polyline.map((p) => [clip.x + p.x, clip.y + p.y]);
  const built = centerline.length < 2 ? [] : bands(resample(centerline, TRAIL_STEP), clip.trail.colors, clip.trail.band);
  cache.set(clip, built);
  return built;
}

/**
 * How much of the trail is painted, 0..1. It rides the sprite's eased
 * progress so the paint head sits under the sprite. A looping path paints
 * over its first lap and then stays whole.
 */
export function trailProgress(clip: SpriteClip, t: number): number {
  if (!clip.loop) return spriteProgress(clip, t);
  return clamp01((t - clip.start) / Math.max(0.001, spriteActiveDuration(clip)));
}

/** The stretch of the path that is lit, as fractions of its length. */
export interface TrailWindow {
  /** Where the lit stretch begins. */
  tail: number;
  /** How much of the path is lit from `tail`; may wrap past the end on a loop. */
  length: number;
}

/**
 * Paint mode lights everything from the start to the head. Comet mode lights
 * from where the sprite was `cometSeconds` ago to where it is now, so the
 * tail follows the head, catches up once the sprite lands, and on a loop
 * wraps around the join (length counts past 1; the dash pattern repeats).
 */
export function trailWindow(clip: SpriteClip, t: number): TrailWindow {
  if (clip.trail.mode !== "comet") return { tail: 0, length: trailProgress(clip, t) };
  const head = spriteProgress(clip, t);
  const tail = spriteProgress(clip, t - Math.max(0, clip.trail.cometSeconds));
  const wrapped = clip.loop && tail > head;
  return { tail, length: wrapped ? head - tail + 1 : head - tail };
}

/** Trail opacity: hidden before takeoff, fading in with the sprite, fading out after landing on request. */
export function trailOpacity(clip: SpriteClip, t: number): number {
  const local = t - clip.start;
  if (local < 0) return 0;
  const fadeIn = clip.fadeIn > 0 ? clamp01(local / clip.fadeIn) : 1;
  if (clip.loop || clip.trail.mode === "comet" || clip.trail.fadeOut <= 0) return fadeIn;
  const since = local - spriteActiveDuration(clip);
  if (since <= 0) return fadeIn;
  return fadeIn * (1 - clamp01(since / clip.trail.fadeOut));
}
