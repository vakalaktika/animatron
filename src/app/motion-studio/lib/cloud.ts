import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { normalizeDoc, type RawDoc } from "./migrate";
import type { Project } from "./projects";

/**
 * Accounts and short share links, on Supabase. The studio is a static site,
 * so it talks to the database with the public anon key and every rule lives
 * in row-level security (supabase/migrations). With no project configured
 * at build time the cloud is simply off: links carry the whole composition
 * and compositions stay in this browser, as before.
 */

export interface CloudConfig {
  url: string;
  anonKey: string;
}

/** Query parameter that names a short share link. */
export const SHORT_SHARE_PARAM = "s";

const SHARE_ID = /^[A-Za-z0-9_-]{10}$/;
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * The project's address and anon key, read at build time. Null (cloud off)
 * when either is missing or the address is not https (plain http is allowed
 * for a local Supabase only).
 */
export function cloudConfig(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): CloudConfig | null {
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ""), anonKey };
}

let client: Promise<SupabaseClient> | null = null;

/** The one Supabase client, loaded on first use so the library stays out of the first page load. */
export function cloudClient(config: CloudConfig): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "animatron.auth" },
    }),
  );
  return client;
}

/** Who is signed in: nobody, an anonymous session (made to create a share link), or an account. */
export type CloudUser = { kind: "none" } | { kind: "anonymous"; id: string } | { kind: "account"; id: string; email: string };

/** Who a session belongs to. */
export function userFromSession(session: Session | null): CloudUser {
  const user = session?.user;
  if (!user) return { kind: "none" };
  if (user.is_anonymous || !user.email) return { kind: "anonymous", id: user.id };
  return { kind: "account", id: user.id, email: user.email };
}

export async function currentUser(supabase: SupabaseClient): Promise<CloudUser> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Could not read the sign-in: ${error.message}`);
  return userFromSession(data.session);
}

/** A session to write with: the current one, or a fresh anonymous one. */
async function ensureSession(supabase: SupabaseClient): Promise<void> {
  const user = await currentUser(supabase);
  if (user.kind !== "none") return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Could not start a session: ${error.message}`);
}

/** A random share id: 10 characters of a URL-safe alphabet (60 bits). */
export function newShareId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(10), (b) => ID_ALPHABET[b & 63]).join("");
}

export const isShareId = (id: string) => SHARE_ID.test(id);

/** Postgres unique violation: a share id that already exists. */
const DUPLICATE = "23505";
/** Largest composition a share holds, in characters of JSON (the table allows a little more). */
export const SHARE_MAX_CHARS = 1_900_000;

/** Stores the composition as a short share and returns its id. */
export async function createShare(supabase: SupabaseClient, doc: StudioDoc, makeId = newShareId): Promise<string> {
  if (JSON.stringify(doc).length > SHARE_MAX_CHARS) {
    throw new Error("This composition is too big to share as a link (large pictures?). Download it as a JSON file instead.");
  }
  await ensureSession(supabase);
  // Two tries: a collision in 60 bits is vanishingly rare, but costs nothing to survive.
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = makeId();
    const { error } = await supabase.from("shares").insert({ id, doc });
    if (!error) return id;
    if (error.code !== DUPLICATE) throw new Error(`Could not save the link: ${error.message}`);
  }
  throw new Error("Could not save the link: try again.");
}

/** The composition behind a short share id, repaired like any opened file; null when there is no such link. */
export async function fetchShare(supabase: SupabaseClient, id: string): Promise<StudioDoc | null> {
  if (!isShareId(id)) return null;
  // Shares can't be listed; the one way in is this lookup by exact id.
  const { data, error } = await supabase.rpc("get_share", { share_id: id });
  if (error) throw new Error(`Could not open the link: ${error.message}`);
  const raw: unknown = data;
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<RawDoc>;
  if (!Array.isArray(candidate.clips) || !candidate.stage) return null;
  return normalizeDoc(candidate as RawDoc).doc;
}

/** The short link for a share id on the current page. */
export function shortShareUrl(id: string, location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}?${SHORT_SHARE_PARAM}=${id}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (email: string) => EMAIL.test(email.trim());

/**
 * Emails a sign-in link that comes back to `redirectTo`. An anonymous
 * session (from making a share link) is upgraded in place, so the links
 * it made stay its own.
 */
export async function sendSignInLink(supabase: SupabaseClient, email: string, redirectTo: string): Promise<void> {
  const address = email.trim();
  if (!isEmail(address)) throw new Error("That doesn't look like an email address.");
  const user = await currentUser(supabase);
  if (user.kind === "anonymous") {
    const { error } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: redirectTo });
    if (!error) return;
    // The address already has an account: sign in to that one instead (this session's links stay readable).
    if (error.code !== "email_exists") throw new Error(`Could not send the sign-in link: ${error.message}`);
  }
  const { error } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo } });
  if (error) throw new Error(`Could not send the sign-in link: ${error.message}`);
}

export async function signOut(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Could not sign out: ${error.message}`);
}

/**
 * A composition as kept in the account. A deleted one stays as a tombstone
 * (no document) so every device learns of the deletion.
 */
export interface RemoteProject {
  id: string;
  name: string;
  doc: unknown;
  deleted: boolean;
  updatedAt: string;
}

interface ProjectRow {
  id: string;
  name: string;
  doc: unknown;
  deleted: boolean;
  updated_at: string;
}

/** Largest composition kept in an account, in characters of JSON (the table allows a little more). */
export const PROJECT_MAX_CHARS = 4_800_000;
const NAME_MAX = 200;

export async function listRemoteProjects(supabase: SupabaseClient): Promise<RemoteProject[]> {
  const { data, error } = await supabase.from("projects").select("id, name, doc, deleted, updated_at");
  if (error) throw new Error(`Could not read your saved compositions: ${error.message}`);
  return ((data ?? []) as ProjectRow[]).map((r) => ({ id: r.id, name: r.name, doc: r.doc, deleted: r.deleted, updatedAt: r.updated_at }));
}

/**
 * Saves compositions to the account and returns the ones too big to keep
 * there (they stay in this browser). Saving an older copy over a newer one
 * is ignored by the database.
 */
export async function pushProjects(supabase: SupabaseClient, projects: Project[]): Promise<Project[]> {
  const fits = (p: Project) => JSON.stringify(p.doc).length <= PROJECT_MAX_CHARS;
  const rows = projects.filter(fits).map((p) => ({ id: p.id, name: p.doc.name.slice(0, NAME_MAX), doc: p.doc, deleted: false, updated_at: p.updatedAt }));
  if (rows.length > 0) {
    const { error } = await supabase.from("projects").upsert(rows, { onConflict: "owner,id" });
    if (error) throw new Error(`Could not save to your account: ${error.message}`);
  }
  return projects.filter((p) => !fits(p));
}

/** Marks a composition deleted in the account, so other devices drop it rather than upload it again. */
export async function deleteRemoteProject(supabase: SupabaseClient, id: string, name: string, now = new Date().toISOString()): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .upsert({ id, name: name.slice(0, NAME_MAX), doc: null, deleted: true, updated_at: now }, { onConflict: "owner,id" });
  if (error) throw new Error(`Could not remove it from your account: ${error.message}`);
}
