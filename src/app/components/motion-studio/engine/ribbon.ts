import type { RibbonClip } from "../types";
import { clamp01, resolveEase } from "./easing";
import { buildPath, type PathSample, type PathSampler } from "./path";
import { bands, RAINBOW, resample, type Band, type Point } from "./rainbow";
import type { TrailWindow } from "./trail";

/** Spacing of the band centerline samples; matches a smoothed squiggle. */
const RIBBON_STEP = 10;

export const DEFAULT_RIBBON_COLORS = [RAINBOW.blue, RAINBOW.purple, RAINBOW.green];
export const DEFAULT_COAT_COLORS = [RAINBOW.red, RAINBOW.orange, RAINBOW.yellow];

// Clips are replaced immutably on every edit, so the clip object is a sound
// cache key, the same way transform.ts caches a sprite's spline.
const samplers = new WeakMap<RibbonClip, PathSampler>();
const baseBands = new WeakMap<RibbonClip, Band[]>();
const coatBands = new WeakMap<RibbonClip, Band[]>();

/** The ribbon's spline, anchor-relative and arc-length parameterised. */
export function ribbonPath(clip: RibbonClip): PathSampler {
  const cached = samplers.get(clip);
  if (cached) return cached;
  const built = buildPath(clip.points, clip.loop);
  samplers.set(clip, built);
  return built;
}

function buildBands(clip: RibbonClip, colors: string[]): Band[] {
  const centerline: Point[] = ribbonPath(clip).polyline.map((p) => [clip.x + p.x, clip.y + p.y]);
  return centerline.length < 2 ? [] : bands(resample(centerline, RIBBON_STEP), colors, clip.band);
}

/** The ribbon's own colour bands, in its parent frame (anchor offset applied). */
export function ribbonBands(clip: RibbonClip): Band[] {
  const cached = baseBands.get(clip);
  if (cached) return cached;
  const built = buildBands(clip, clip.colors);
  baseBands.set(clip, built);
  return built;
}

/** The same geometry in the coat palette. */
export function ribbonCoatBands(clip: RibbonClip): Band[] {
  const cached = coatBands.get(clip);
  if (cached) return cached;
  const built = buildBands(clip, clip.coat.colors);
  coatBands.set(clip, built);
  return built;
}

/** Where along the ribbon (0..1) the paint head is at time `t`. */
export function ribbonHead(clip: RibbonClip, t: number): number {
  const raw = (t - clip.start) / Math.max(0.001, clip.duration);
  if (clip.loop && clip.mode === "comet") return raw <= 0 ? 0 : raw % 1;
  return resolveEase(clip.ease)(clamp01(raw));
}

/**
 * The lit stretch of the ribbon. Paint mode lights from the start to the
 * head. Comet mode lights from where the head was `cometSeconds` ago to where
 * it is now, wrapping around the join on a loop (length counts past 1; the
 * dash pattern repeats).
 */
export function ribbonWindow(clip: RibbonClip, t: number): TrailWindow {
  if (clip.mode !== "comet") return { tail: 0, length: ribbonHead(clip, t) };
  const head = ribbonHead(clip, t);
  const tail = ribbonHead(clip, t - Math.max(0, clip.cometSeconds));
  const wrapped = clip.loop && tail > head;
  return { tail, length: wrapped ? head - tail + 1 : head - tail };
}

export interface CoatState {
  /** Palette fully covering the ribbon right now, or null for the ribbon's own colours. */
  resting: string[] | null;
  /** A sweep in flight: its palette and how far it has got. */
  sweeping: { colors: string[]; progress: number } | null;
}

/** Repaints alternate: odd sweeps lay the coat palette, even sweeps return to the ribbon's own. */
const paletteFor = (clip: RibbonClip, pass: number) => (pass % 2 === 1 ? clip.coat.colors : clip.colors);

/**
 * Which coat covers the ribbon at time `t`. Sweeps start `every` seconds
 * after the paint-in finishes and repeat; each takes `duration` and then
 * rests until the next. Comet ribbons never coat (there is nothing to cover).
 */
export function ribbonCoat(clip: RibbonClip, t: number): CoatState {
  const none: CoatState = { resting: null, sweeping: null };
  const { every, duration } = clip.coat;
  if (clip.mode === "comet" || every <= 0 || clip.coat.colors.length === 0) return none;
  const since = t - (clip.start + clip.duration);
  if (since < every) return none;
  const pass = Math.floor(since / every);
  const into = since - pass * every;
  const completed = into >= duration ? pass : pass - 1;
  const resting = completed >= 1 ? paletteFor(clip, completed) : null;
  const restingIsOwn = completed >= 1 && completed % 2 === 0;
  const sweeping =
    into < duration ? { colors: paletteFor(clip, pass), progress: clamp01(into / Math.max(0.001, duration)) } : null;
  return { resting: restingIsOwn ? null : resting, sweeping };
}

/** Hidden before its start, else fully visible. */
export function ribbonOpacity(clip: RibbonClip, t: number): number {
  return t < clip.start ? 0 : 1;
}

/** The point (anchor-relative) and heading at a fraction along the ribbon. */
export function ribbonPointAt(clip: RibbonClip, fraction: number): PathSample {
  return ribbonPath(clip).at(fraction);
}

/**
 * The clock time when the paint head first reaches `fraction`, so a clip
 * seated there can pop in just as the paint arrives (the homepage faces).
 * Found by bisection since the easing is not generally invertible.
 */
export function arrivalTime(clip: RibbonClip, fraction: number): number {
  const target = clamp01(fraction);
  let lo = 0;
  let hi = clip.duration;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ribbonHead(clip, clip.start + mid) < target) lo = mid;
    else hi = mid;
  }
  return clip.start + hi;
}

/** Fraction along the ribbon nearest a point given in the ribbon's parent frame. */
export function nearestFraction(clip: RibbonClip, x: number, y: number): number {
  const { polyline } = ribbonPath(clip);
  if (polyline.length < 2) return 0;
  let best = Infinity;
  let index = 0;
  polyline.forEach((p, i) => {
    const d = (clip.x + p.x - x) ** 2 + (clip.y + p.y - y) ** 2;
    if (d < best) {
      best = d;
      index = i;
    }
  });
  return index / (polyline.length - 1);
}
