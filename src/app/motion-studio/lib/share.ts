import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { normalizeDoc, type RawDoc } from "./migrate";

/** Hash parameter that carries a composition. */
export const SHARE_PARAM = "share";

/**
 * Browsers and servers are comfortable with URLs well past this, but a link
 * that long is also one with embedded pictures in it, which is a hint that
 * a JSON file is the better handoff.
 */
export const SHARE_LIMIT = 60_000;

export type ShareResult = { ok: true; url: string } | { ok: false; reason: "too-large" };

/** The composition folded into the current page's URL. */
export function shareUrl(doc: StudioDoc, location: { origin: string; pathname: string }): ShareResult {
  const data = compressToEncodedURIComponent(JSON.stringify(doc));
  if (data.length > SHARE_LIMIT) return { ok: false, reason: "too-large" };
  return { ok: true, url: `${location.origin}${location.pathname}#${SHARE_PARAM}=${data}` };
}

/** The composition carried by a URL hash, or null when there is none or it is unreadable. */
export function docFromHash(hash: string): StudioDoc | null {
  const prefix = `#${SHARE_PARAM}=`;
  if (!hash.startsWith(prefix)) return null;
  try {
    const json = decompressFromEncodedURIComponent(hash.slice(prefix.length));
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<RawDoc>;
    if (!Array.isArray(candidate.clips) || !candidate.stage) return null;
    return normalizeDoc(candidate as RawDoc).doc;
  } catch {
    return null;
  }
}
