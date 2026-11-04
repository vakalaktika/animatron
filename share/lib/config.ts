/** Where the studio lives: short links open compositions there. */
export function studioUrl(): string {
  const raw = process.env.STUDIO_URL?.trim() || "https://vakalaktika.github.io/animatron/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * Sites allowed to make links from a browser: the studio, plus anything in
 * ALLOWED_ORIGINS (comma-separated) and the local dev server. Non-browser
 * clients can send any Origin they like, so this limits other websites
 * rather than scripts; size limits and the platform firewall do the rest.
 */
export function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return [...new Set([new URL(studioUrl()).origin, "http://localhost:3000", ...extra])];
}

/** This service's own public address, for absolute links and the Open Graph card. */
export function shareBase(): string {
  const configured = process.env.SHARE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3100";
}

export const shareLink = (id: string): string => `${shareBase()}/s/${id}`;
export const openInStudio = (id: string): string => `${studioUrl()}#s=${id}`;
