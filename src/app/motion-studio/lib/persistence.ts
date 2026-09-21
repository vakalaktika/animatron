import type { StudioDoc } from "@/app/components/motion-studio/types";
import { normalizeDoc, type RawDoc } from "./migrate";

// Namespaced so it never collides with the saved-presets store
// ("motion-studio.presets.v1"). The value is a whole StudioDoc; on read it is
// run through normalizeDoc so an older or slightly broken document is migrated
// and repaired rather than crashing the studio.
export const DOC_STORAGE_KEY = "motion-studio:doc";

const SAVE_DEBOUNCE_MS = 500;

/**
 * Restore the autosaved working document, or null when there is nothing saved
 * or the stored value can't be read. Never throws — a bad value just means we
 * fall back to the default preset.
 */
export function loadDoc(): StudioDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DOC_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<RawDoc>;
    if (!Array.isArray(candidate.clips) || !candidate.stage) return null;
    return normalizeDoc(candidate as RawDoc).doc;
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced autosave of the working document to localStorage. */
export function saveDoc(doc: StudioDoc): void {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      window.localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(doc));
    } catch {
      // Quota errors (large embedded Lottie/SVG) are non-fatal — the in-memory
      // document is still the source of truth; the user can export JSON.
    }
  }, SAVE_DEBOUNCE_MS);
}
