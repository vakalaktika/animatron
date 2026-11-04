/** Where the studio lives: share pages open compositions there. */
export function studioUrl(): string {
  const raw = process.env.STUDIO_URL?.trim() || "https://vakalaktika.github.io/animatron/";
  return raw.endsWith("/") ? raw : `${raw}/`;
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
/** The studio's own short link: it fetches the share and adds it to the visitor's compositions. */
export const openInStudio = (id: string): string => `${studioUrl()}?s=${id}`;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * The studio's Supabase project, read with the same public anon key the
 * studio ships. Shares are made by the studio; this service only reads
 * them, through get_share_meta and the public card bucket.
 */
export function supabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set (docs/share-links.md).");
  return { url: url.replace(/\/+$/, ""), anonKey };
}
