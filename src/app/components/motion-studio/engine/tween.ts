import type { Clip, Ease, KeyedProp } from "../types";
import { keyableProps, MAX_KEY_TIME, propValue, upsertPropKey } from "./keys";

/** Replace a selected segment with two editable endpoints, preserving other tracks/keys. */
export function tweenTo<T extends Clip>(clip: T, clock: number, duration: number, destination: Partial<Record<KeyedProp, number>>, ease: Ease): T {
  const start = Math.round((clock - clip.start) * 100) / 100;
  const end = Math.round((start + duration) * 100) / 100;
  if (!Number.isFinite(clock) || !Number.isFinite(duration) || duration <= 0 || start < 0 || end > MAX_KEY_TIME || end <= start) throw new Error("Tween must start inside the clip and end within 600 seconds.");
  return keyableProps(clip).reduce((next, prop) => {
    const value = destination[prop];
    if (value === undefined) return next;
    if (!Number.isFinite(value)) throw new Error("Tween values must be finite.");
    const from = propValue(clip, prop, clip.start + start);
    if (Math.abs(value - from) < 1e-9) return next;
    const existing = next.keys?.[prop];
    const outside = existing?.filter(k => k.time < start - 0.005 || k.time > end + 0.005) ?? [];
    // A later first key otherwise holds its endpoint backward through the whole clip.
    const baseline = !existing?.length && start > 0 ? [{ time: 0, value: from, ease }] : [];
    const track = [...baseline, ...outside, { time: start, value: from, ease }, { time: end, value, ease }].sort((a, b) => a.time - b.time);
    const authored = upsertPropKey(next, prop, start, from);
    return { ...authored, keys: { ...authored.keys, [prop]: track } };
  }, clip);
}
