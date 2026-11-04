import { supabaseConfig } from "./config";
import { checkMeta, type ShareMeta } from "./meta";

/**
 * Reads from the studio's Supabase project over plain REST: one RPC for a
 * share's page and the public bucket for its card. Shares can't be listed;
 * both reads need the exact id.
 */

const CARDS_BUCKET = "share-cards";

/** What the page shows about a share; null when there is no such share. */
export async function readMeta(id: string): Promise<ShareMeta | null> {
  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/get_share_meta`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ share_id: id }),
  });
  if (!response.ok) throw new Error(`get_share_meta answered ${response.status}: ${await response.text()}`);
  return checkMeta(await response.json());
}

const cardUrl = (url: string, id: string) => `${url}/storage/v1/object/public/${CARDS_BUCKET}/${id}.png`;

/** Storage answers a missing object with 400 or 404, depending on version. */
const isMissing = (status: number) => status === 400 || status === 404;

/** The share's preview card, or null when it has none. */
export async function readCard(id: string): Promise<ReadableStream<Uint8Array> | null> {
  const { url } = supabaseConfig();
  const response = await fetch(cardUrl(url, id));
  if (isMissing(response.status)) return null;
  if (!response.ok || !response.body) throw new Error(`The card store answered ${response.status}.`);
  return response.body;
}

/** Whether the share has a card, without fetching it. */
export async function hasCard(id: string): Promise<boolean> {
  const { url } = supabaseConfig();
  const response = await fetch(cardUrl(url, id), { method: "HEAD" });
  if (isMissing(response.status)) return false;
  if (!response.ok) throw new Error(`The card store answered ${response.status}.`);
  return true;
}
