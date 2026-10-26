import type { Clip, Ease, KeyedProp, PropKey } from "../types";
import { clamp01, resolveEase } from "./easing";

/** Every property a clip can keyframe, in panel order. */
export const KEYED_PROPS: readonly KeyedProp[] = ["x", "y", "scale", "rotation", "opacity"];

/** How a new key travels to the next one. */
export const DEFAULT_KEY_EASE: Ease = { name: "inOut" };

/** Two keys closer than this (seconds) are the same key. */
const SAME_TIME = 0.005;
/** New keys land on a hundredth-of-a-second grid, so the panel and the timeline agree on where they are. */
const keyTime = (local: number) => Math.max(0, Math.round(local * 100) / 100);
/** Keys never get closer than this when retimed. */
const MIN_GAP = 0.01;
/** Latest a key can sit after its clip's start, in seconds (a file can say anything). */
export const MAX_KEY_TIME = 600;

/**
 * The properties this clip can keyframe. A ribbon's band geometry has no
 * size or turn of its own (it draws in its parent's frame), so it keys only
 * its place and opacity.
 */
export function keyableProps(clip: Clip): readonly KeyedProp[] {
  return clip.type === "ribbon" ? ["x", "y", "opacity"] : KEYED_PROPS;
}

/** The property's own (unkeyed) value, with the clip's defaults for the optional ones. */
export function staticValue(clip: Clip, prop: KeyedProp): number {
  if (prop === "rotation") return clip.rotation ?? 0;
  if (prop === "opacity") return clip.opacity ?? 1;
  return clip[prop];
}

/** The property's keys, in time order, or null when it is not animated. */
export function propKeys(clip: Clip, prop: KeyedProp): PropKey[] | null {
  const keys = clip.keys?.[prop];
  return keys && keys.length > 0 ? keys : null;
}

/** Does any property of this clip have keys? */
export const hasKeys = (clip: Clip) => KEYED_PROPS.some((p) => propKeys(clip, p) !== null);

/**
 * The value of a key track at `local` seconds from the clip start: the
 * first key's value before it, the last one's after it, and in between
 * each key eases to the next by its own easing.
 */
export function keyValue(keys: PropKey[], local: number): number {
  if (local <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (local >= last.time) return last.value;
  let i = 0;
  while (keys[i + 1].time <= local) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = clamp01((local - a.time) / Math.max(1e-6, b.time - a.time));
  return a.value + (b.value - a.value) * resolveEase(a.ease ?? DEFAULT_KEY_EASE)(u);
}

/** The property at clock time `t`: keyed when it has keys, else its own value. */
export function propValue(clip: Clip, prop: KeyedProp, t: number): number {
  const keys = propKeys(clip, prop);
  return keys ? keyValue(keys, t - clip.start) : staticValue(clip, prop);
}

/** Where an animated property settles: its last key, as a sprite's rest is its landing. */
export function restValue(clip: Clip, prop: KeyedProp): number {
  const keys = propKeys(clip, prop);
  return keys ? keys[keys.length - 1].value : staticValue(clip, prop);
}

/** Every placement property at clock time `t`. */
export interface Placement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export function placementAt(clip: Clip, t: number): Placement {
  return {
    x: propValue(clip, "x", t),
    y: propValue(clip, "y", t),
    scale: propValue(clip, "scale", t),
    rotation: propValue(clip, "rotation", t),
    opacity: propValue(clip, "opacity", t),
  };
}

export function restPlacement(clip: Clip): Placement {
  return {
    x: restValue(clip, "x"),
    y: restValue(clip, "y"),
    scale: restValue(clip, "scale"),
    rotation: restValue(clip, "rotation"),
    opacity: restValue(clip, "opacity"),
  };
}

const withTrack = <T extends Clip>(clip: T, prop: KeyedProp, keys: PropKey[] | null): T => {
  const { [prop]: _dropped, ...rest } = clip.keys ?? {};
  const next = keys && keys.length > 0 ? { ...rest, [prop]: keys } : rest;
  return { ...clip, keys: Object.keys(next).length > 0 ? next : undefined };
};

/** Index of the key at `local` seconds, or -1. */
export function keyIndexAt(keys: PropKey[] | null, local: number): number {
  return keys ? keys.findIndex((k) => Math.abs(k.time - local) < SAME_TIME) : -1;
}

/**
 * The clip with `prop` keyed to `value` at `local` seconds from its start
 * (to the hundredth): the key there is updated (keeping its easing) or a new
 * one is slotted in.
 */
export function upsertPropKey<T extends Clip>(clip: T, prop: KeyedProp, local: number, value: number): T {
  const keys = propKeys(clip, prop) ?? [];
  const at = keyTime(local);
  const index = keyIndexAt(keys, at);
  const next =
    index >= 0
      ? keys.map((k, i) => (i === index ? { ...k, value } : k))
      : [...keys, { time: at, value, ease: DEFAULT_KEY_EASE }].sort((a, b) => a.time - b.time);
  return withTrack(clip, prop, next);
}

/**
 * The clip with the key at `local` removed. Removing the last key stops the
 * animation and leaves the property at that key's value.
 */
export function removePropKey<T extends Clip>(clip: T, prop: KeyedProp, local: number): T {
  const keys = propKeys(clip, prop);
  const index = keyIndexAt(keys, local);
  if (!keys || index < 0) return clip;
  if (keys.length > 1) return withTrack(clip, prop, keys.filter((_, i) => i !== index));
  return withTrack({ ...clip, [prop]: keys[0].value }, prop, null);
}

/** The clip with `prop` set at clock time `t`: keyed there when animated, else its own value. */
export function setPropAt<T extends Clip>(clip: T, prop: KeyedProp, t: number, value: number): T {
  return propKeys(clip, prop) ? upsertPropKey(clip, prop, t - clip.start, value) : { ...clip, [prop]: value };
}

/** Seconds from the clip start to clock time `t`, on the key grid: where a key set now lands. */
export const keyTimeAt = (clip: Clip, t: number) => keyTime(t - clip.start);

/**
 * The clip shifted by (dx, dy) in its parent's frame: its own x / y, or
 * every key of an animated x / y, so the animation keeps its shape.
 */
export function shiftPosition<T extends Clip>(clip: T, dx: number, dy: number): T {
  const shift = (acc: T, prop: "x" | "y", d: number): T => {
    if (d === 0) return acc;
    const keys = propKeys(acc, prop);
    return keys ? withTrack(acc, prop, keys.map((k) => ({ ...k, value: k.value + d }))) : { ...acc, [prop]: acc[prop] + d };
  };
  return shift(shift(clip, "x", dx), "y", dy);
}

/** The clip moved so it rests at (x, y): re-expressing it in another frame keeps any position animation intact. */
export function moveRestTo<T extends Clip>(clip: T, x: number, y: number): T {
  return shiftPosition(clip, x - restValue(clip, "x"), y - restValue(clip, "y"));
}

/** The clip with these properties' keys dropped (their own values stand). */
export function clearPropKeys<T extends Clip>(clip: T, props: readonly KeyedProp[]): T {
  return props.reduce((acc, prop) => withTrack(acc, prop, null), clip);
}

/** Every distinct key time of the clip (seconds from its start), ascending. */
export function propKeyTimes(clip: Clip): number[] {
  const times: number[] = [];
  for (const prop of KEYED_PROPS) {
    for (const k of propKeys(clip, prop) ?? []) {
      if (!times.some((t) => Math.abs(t - k.time) < SAME_TIME)) times.push(k.time);
    }
  }
  return times.sort((a, b) => a - b);
}

/** Seconds from the clip start to its last key; 0 with none. */
export function keysEnd(clip: Clip): number {
  const times = propKeyTimes(clip);
  return times.length > 0 ? times[times.length - 1] : 0;
}

/**
 * Where the keys at `time` can move toward `to`: never before 0, and never
 * past a neighbouring key of any property that has a key there, so keys
 * keep their order.
 */
export function retimedPropKeyTime(clip: Clip, time: number, to: number): number {
  let lo = 0;
  let hi = Infinity;
  for (const prop of KEYED_PROPS) {
    const keys = propKeys(clip, prop);
    const index = keyIndexAt(keys, time);
    if (!keys || index < 0) continue;
    if (index > 0) lo = Math.max(lo, keys[index - 1].time + MIN_GAP);
    if (index < keys.length - 1) hi = Math.min(hi, keys[index + 1].time - MIN_GAP);
  }
  // On the same hundredth grid as new keys, so the panel finds them at the playhead.
  return Math.min(hi, Math.max(lo, Math.round(to * 100) / 100));
}

/** The clip with every key at `time` moved to `to` (see `retimedPropKeyTime`). */
export function retimePropKeys<T extends Clip>(clip: T, time: number, to: number): T {
  const target = retimedPropKeyTime(clip, time, to);
  return KEYED_PROPS.reduce((acc, prop) => {
    const keys = propKeys(acc, prop);
    const index = keyIndexAt(keys, time);
    if (!keys || index < 0) return acc;
    return withTrack(acc, prop, keys.map((k, i) => (i === index ? { ...k, time: target } : k)));
  }, clip);
}

/** The easing of the keys at `local` seconds (the first animated property's), or null when there are none. */
export function keyEaseAt(clip: Clip, local: number): Ease | null {
  for (const prop of KEYED_PROPS) {
    const keys = propKeys(clip, prop);
    const index = keyIndexAt(keys, local);
    if (keys && index >= 0) return keys[index].ease ?? DEFAULT_KEY_EASE;
  }
  return null;
}

/** The clip with every key at `local` easing to its next key by `ease`. */
export function setKeyEaseAt<T extends Clip>(clip: T, local: number, ease: Ease): T {
  return KEYED_PROPS.reduce((acc, prop) => {
    const keys = propKeys(acc, prop);
    const index = keyIndexAt(keys, local);
    if (!keys || index < 0) return acc;
    return withTrack(acc, prop, keys.map((k, i) => (i === index ? { ...k, ease } : k)));
  }, clip);
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const EASE_NAMES = new Set<string>(["linear", "smoothOut", "inOut", "flight", "backOut", "anticipate", "snap", "custom"]);

/** An easing read from a file: a known name, and for a custom curve four finite control points. Otherwise the default. */
function sanitizeEase(raw: unknown): Ease {
  if (!raw || typeof raw !== "object") return DEFAULT_KEY_EASE;
  const { name, custom } = raw as { name?: unknown; custom?: unknown };
  if (typeof name !== "string" || !EASE_NAMES.has(name)) return DEFAULT_KEY_EASE;
  if (name !== "custom") return { name: name as Ease["name"] };
  return Array.isArray(custom) && custom.length === 4 && custom.every(finite)
    ? { name: "custom", custom: [custom[0], custom[1], custom[2], custom[3]] }
    : DEFAULT_KEY_EASE;
}

/**
 * Keys as read from a file or link: only the known properties, only keys
 * with a finite time (clamped to 0..MAX_KEY_TIME) and value, a known
 * easing, sorted, one per time. Anything else is dropped rather than trusted.
 */
export function sanitizeKeys(raw: unknown): Clip["keys"] {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<KeyedProp, PropKey[]>> = {};
  for (const prop of KEYED_PROPS) {
    const list = (raw as Record<string, unknown>)[prop];
    if (!Array.isArray(list)) continue;
    const keys = list
      .filter((k): k is PropKey => !!k && typeof k === "object" && finite((k as PropKey).time) && finite((k as PropKey).value))
      .map((k) => ({ time: Math.min(MAX_KEY_TIME, Math.max(0, k.time)), value: k.value, ease: sanitizeEase(k.ease) }))
      .sort((a, b) => a.time - b.time)
      .filter((k, i, all) => i === 0 || k.time - all[i - 1].time >= SAME_TIME);
    if (keys.length > 0) out[prop] = keys;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
