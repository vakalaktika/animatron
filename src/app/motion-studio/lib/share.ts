import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { normalizeDoc, type RawDoc } from "./migrate";

/** Hash parameter that carries a whole composition (the long link). */
export const SHARE_PARAM = "share";
/** Hash parameter that names a composition kept by the share service (the short link). */
export const SHORT_PARAM = "s";

/**
 * Browsers and servers are comfortable with URLs well past this, but a link
 * that long is also one with embedded pictures in it, which is a hint that
 * a JSON file is the better handoff.
 */
export const SHARE_LIMIT = 60_000;

/** What the share service accepts: a composition this big, pictures included. */
export const SHORT_SHARE_LIMIT = 2_000_000;

export type ShareResult = { ok: true; url: string } | { ok: false; reason: "too-large" };

/**
 * Where short links are made and opened: the share service's origin, baked
 * in at build time. Unset means the studio only makes long links.
 */
export function shareOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SHARE_ORIGIN?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** The composition folded into the current page's URL. */
export function shareUrl(doc: StudioDoc, location: { origin: string; pathname: string }): ShareResult {
  const data = compressToEncodedURIComponent(JSON.stringify(doc));
  if (data.length > SHARE_LIMIT) return { ok: false, reason: "too-large" };
  return { ok: true, url: `${location.origin}${location.pathname}#${SHARE_PARAM}=${data}` };
}

const isDocLike = (parsed: unknown): parsed is RawDoc => {
  if (!parsed || typeof parsed !== "object") return false;
  const candidate = parsed as Partial<RawDoc>;
  return Array.isArray(candidate.clips) && !!candidate.stage;
};

/** The composition carried by a URL hash, or null when there is none or it is unreadable. */
export function docFromHash(hash: string): StudioDoc | null {
  const prefix = `#${SHARE_PARAM}=`;
  if (!hash.startsWith(prefix)) return null;
  try {
    const json = decompressFromEncodedURIComponent(hash.slice(prefix.length));
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    return isDocLike(parsed) ? normalizeDoc(parsed).doc : null;
  } catch {
    return null;
  }
}

const SHORT_ID = /^[1-9A-HJ-NP-Za-km-z]{8,16}$/;

/** The short-link id in a URL hash (`#s=…`), or null. */
export function shareIdFromHash(hash: string): string | null {
  const prefix = `#${SHORT_PARAM}=`;
  if (!hash.startsWith(prefix)) return null;
  const id = hash.slice(prefix.length);
  return SHORT_ID.test(id) ? id : null;
}

export type ShortShareResult = { ok: true; url: string } | { ok: false; reason: string };

/**
 * Stores the composition with the share service and returns the short link.
 * The card is the preview picture the link shows wherever it is pasted.
 */
export async function createShortShare(origin: string, doc: StudioDoc, card: Blob, duration: number): Promise<ShortShareResult> {
  const payload = new Blob([JSON.stringify(doc)], { type: "application/json" });
  if (payload.size > SHORT_SHARE_LIMIT) return { ok: false, reason: "too-large" };
  const form = new FormData();
  form.set("doc", payload, "doc.json");
  form.set("card", card, "card.png");
  form.set("duration", String(duration));
  let response: Response;
  try {
    response = await fetch(`${origin}/api/share`, { method: "POST", body: form });
  } catch {
    return { ok: false, reason: "offline" };
  }
  const body: unknown = await response.json().catch(() => null);
  const asObj = body && typeof body === "object" ? (body as { url?: unknown; error?: unknown }) : null;
  if (response.ok && typeof asObj?.url === "string") return { ok: true, url: asObj.url };
  return { ok: false, reason: typeof asObj?.error === "string" ? asObj.error : `The share service answered ${response.status}.` };
}

/** The composition a short link points at, or null when it is gone or unreadable. */
export async function fetchShortShare(origin: string, id: string): Promise<StudioDoc | null> {
  try {
    const response = await fetch(`${origin}/api/share/${id}`);
    if (!response.ok) return null;
    const parsed: unknown = await response.json();
    return isDocLike(parsed) ? normalizeDoc(parsed).doc : null;
  } catch {
    return null;
  }
}
