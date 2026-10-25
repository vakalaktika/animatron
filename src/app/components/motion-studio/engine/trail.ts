import type { SpriteClip, SpriteTrail } from "../types";
import { clamp01 } from "./easing";
import { DEFAULT_LINE_STYLE, lineSpans, type LineSubject, type LitSpan } from "./line";
import { centerline, type Centerline } from "./lineShape";
import { bands, RAINBOW, resample, type Band, type Point } from "./rainbow";
import { phase } from "./line";
import { spriteActiveDuration, spritePath, spriteProgress } from "./spriteTiming";

/** A fresh sprite carries a trail, switched off, in the cool rainbow. */
export const DEFAULT_TRAIL: SpriteTrail = {
  enabled: false,
  // A trail grows out of its sprite: pinched where it meets the body.
  style: { ...DEFAULT_LINE_STYLE, head: 0.35 },
  colors: [RAINBOW.blue, RAINBOW.green, RAINBOW.purple],
  band: 8,
  fadeOut: 0,
  offset: { along: 0, across: 0 },
};

/**
 * The sprite's flight as the timing its trail is lit on. The duration is the
 * real time on the path (holds included) and the head follows the sprite's
 * own progress, so retimed or held waypoints keep the paint under it.
 */
export const trailSubject = (clip: SpriteClip): LineSubject => ({
  start: clip.start,
  duration: spriteActiveDuration(clip),
  loop: clip.loop,
  ease: clip.ease,
  head: (t) => spriteProgress(clip, t),
});

/** Spacing of the trail's centerline samples; matches a smoothed squiggle. */
const TRAIL_STEP = 10;

// Clips are replaced immutably on every edit, so the clip object is a sound
// cache key for its bands, the same way transform.ts caches the spline.
const cache = new WeakMap<SpriteClip, Band[]>();

/** The path's points pushed sideways by `across` pixels along their normals (to the right of travel). */
function offsetAcross(pts: Point[], across: number): Point[] {
  if (across === 0 || pts.length < 2) return pts;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / L) * across, p[1] + ((b[0] - a[0]) / L) * across];
  });
}

/** The trail's path in the parent frame, with the sideways offset applied. */
function trailPolyline(clip: SpriteClip): Point[] {
  return offsetAcross(
    spritePath(clip).polyline.map((p): Point => [clip.x + p.x, clip.y + p.y]),
    clip.trail.offset.across,
  );
}

/** The `along` offset as a fraction of the path, to pull every lit stretch back from the sprite. */
export function trailShift(clip: SpriteClip): number {
  const along = clip.trail.offset.along;
  if (along === 0) return 0;
  const length = trailCenterline(clip).length;
  return length > 0 ? along / length : 0;
}

/**
 * Every span pulled back by `shift` of the line (pushed ahead when negative),
 * wrapping on a loop and clipping to the path otherwise. A painted stretch
 * keeps its start: only its head moves.
 */
export function shiftSpans(spans: LitSpan[], shift: number, loop: boolean): LitSpan[] {
  if (shift === 0) return spans;
  return spans.flatMap((span) => {
    if (loop) return [{ ...span, tail: phase(span.tail - shift) }];
    const head = Math.min(1, span.tail + span.length - shift);
    const tail = span.flat && span.tail === 0 ? 0 : Math.max(0, span.tail - shift);
    return head > tail ? [{ ...span, tail, length: head - tail }] : [];
  });
}
const lines = new WeakMap<SpriteClip, Centerline>();

/**
 * The rainbow bands for a sprite's path, in the sprite's parent frame
 * (anchor offset applied). Built once per clip version; only the paint head
 * moves per frame.
 */
export function trailBands(clip: SpriteClip): Band[] {
  const cached = cache.get(clip);
  if (cached) return cached;
  const centerline = trailPolyline(clip);
  const built = centerline.length < 2 ? [] : bands(resample(centerline, TRAIL_STEP), clip.trail.colors, clip.trail.band);
  cache.set(clip, built);
  return built;
}

/** The dense centerline the shaped trail is built on, in the parent frame. */
export function trailCenterline(clip: SpriteClip): Centerline {
  const cached = lines.get(clip);
  if (cached) return cached;
  const built = centerline(
    trailPolyline(clip).map(([x, y]) => ({ x, y })),
    { x: 0, y: 0 },
    clip.loop,
  );
  lines.set(clip, built);
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

/** Everything lit on the trail at `t`, per its line style. */
export function trailSpans(clip: SpriteClip, t: number): LitSpan[] {
  return shiftSpans(lineSpans(clip.trail.style, trailSubject(clip), t), trailShift(clip), clip.loop);
}

/**
 * The single lit stretch, for the dash renderer: paint lights from the start
 * to the head; a comet lights from where the sprite was `tail` seconds ago
 * to where it is now, wrapping around the join of a loop (length counts
 * past 1; the dash pattern repeats).
 */
export function trailWindow(clip: SpriteClip, t: number): TrailWindow {
  const span = trailSpans(clip, t)[0];
  return span ? { tail: span.tail, length: span.length } : { tail: 0, length: 0 };
}

/** Trail opacity: hidden before takeoff, fading in with the sprite, fading out after landing on request. */
export function trailOpacity(clip: SpriteClip, t: number): number {
  const local = t - clip.start;
  if (local < 0) return 0;
  const fadeIn = clip.fadeIn > 0 ? clamp01(local / clip.fadeIn) : 1;
  if (clip.loop || clip.trail.style.motion !== "paint" || clip.trail.fadeOut <= 0) return fadeIn;
  const since = local - spriteActiveDuration(clip);
  if (since <= 0) return fadeIn;
  return fadeIn * (1 - clamp01(since / clip.trail.fadeOut));
}
