/**
 * Undo history for the working document. A plain value type with pure
 * transitions so it is trivial to test; the studio keeps one in state.
 *
 * Continuous edits (a stage drag, a slider, typing) arrive as many changes a
 * few milliseconds apart. Each change carries a `key` naming the gesture
 * ("move:clip-3", "clip:clip-3"); a change with the same key as the previous
 * one, within `COALESCE_MS`, replaces the present instead of adding a step,
 * so one drag undoes in one go.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Gesture key and clock of the last recorded change, for coalescing. */
  last: { key: string; at: number } | null;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 700;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], last: null };
}

export interface RecordOptions {
  /** Gesture name; successive changes with the same key coalesce. */
  key?: string;
  /** Clock in ms (injectable for tests). */
  now?: number;
}

/** Records a new present. Clears the redo stack like every editor does. */
export function record<T>(h: History<T>, next: T, { key, now = Date.now() }: RecordOptions = {}): History<T> {
  if (Object.is(next, h.present)) return h;
  const coalesce = key !== undefined && h.last !== null && h.last.key === key && now - h.last.at <= COALESCE_MS;
  const past = coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], last: key === undefined ? null : { key, at: now } };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const present = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future], last: null };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [present, ...future] = h.future;
  return { past: [...h.past, h.present], present, future, last: null };
}

/** Replaces the present without a history step (loading a saved document). */
export function reset<T>(h: History<T>, present: T): History<T> {
  return { past: [], present, future: [], last: null };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;
