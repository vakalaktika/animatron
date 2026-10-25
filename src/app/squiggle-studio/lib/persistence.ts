import { MIN_COLORS } from "./palette";
import type { Point, Stroke } from "../types";

// Namespaced beside the studio's own stores ("motion-studio:doc",
// "motion-studio.presets.v1"). The value is the whole drawing session.
export const SQUIGGLES_STORAGE_KEY = "squiggle-studio:session";

export interface SquiggleSession {
  colors: string[];
  band: number;
  strokes: Stroke[];
}

const isPoint = (p: unknown): p is Point =>
  Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number";

const isStroke = (s: unknown): s is Stroke => {
  if (typeof s !== "object" || s === null) return false;
  const v = s as Record<string, unknown>;
  return typeof v.id === "number" && typeof v.smoothed === "number" && Array.isArray(v.pts) && v.pts.every(isPoint);
};

/**
 * Restore the saved drawing session, or null when there is nothing saved or
 * the stored value can't be read. Never throws: a bad value just means a
 * fresh canvas.
 */
export function loadSquiggles(): SquiggleSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SQUIGGLES_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const v = parsed as Record<string, unknown>;
    if (!Array.isArray(v.colors) || v.colors.length < MIN_COLORS || !v.colors.every((c) => typeof c === "string")) return null;
    if (typeof v.band !== "number" || !Array.isArray(v.strokes) || !v.strokes.every(isStroke)) return null;
    return { colors: v.colors as string[], band: v.band, strokes: v.strokes as Stroke[] };
  } catch {
    return null;
  }
}

/** Save the drawing session. Quota errors are non-fatal; the canvas is still the source of truth. */
export function saveSquiggles(session: SquiggleSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SQUIGGLES_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Nothing to do: the next change tries again.
  }
}
