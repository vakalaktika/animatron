/**
 * Short links, made exactly the way the studio's Share → Copy link makes
 * them: this runs inside an Animatron checkout (launched by short-link.mjs
 * with `tsx --tsconfig <repo>/tsconfig.json`) and calls the studio's own
 * `shareWithPreview` and `shareLinkFor` from lib/cloud.ts, against the
 * studio's Supabase project, with the public anon key and row-level
 * security doing the gatekeeping. Nothing here writes into the repo.
 *
 *   shortlink.ts create <studioUrl> <file.json>
 *   shortlink.ts card <shareId>
 *   shortlink.ts delete <shareId>
 *
 * Settings arrive in the environment (never argv, so they stay out of `ps`):
 *   AC_SUPABASE_URL, AC_SUPABASE_KEY   the project's URL and anon/publishable key
 *   AC_SHARE_ORIGIN                    share page service, or empty for the studio's own ?s= link
 *   AC_SESSION_FILE                    where the anonymous session is kept between runs
 *   AC_CARD_FILE                       the preview card PNG (drawn by card.mjs), if there is one
 *   AC_FAKE_SUPABASE                   test only: path of a log for the fake backend
 *
 * The last stdout line is `RESULT <json>` for the caller to parse.
 */
import { createRequire } from "node:module";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { docDuration } from "@/app/components/motion-studio/engine/timing";
import { cloudConfig, isShareId, shareLinkFor, shareOrigin, shareWithPreview, uploadShareCard } from "@/app/motion-studio/lib/cloud";
import { docFromJson } from "@/app/motion-studio/lib/importDoc";
import { hasMedia } from "@/app/motion-studio/lib/mediaDoc";

type Result = { ok: true; [k: string]: unknown } | { ok: false; error: string; offline?: boolean };

function finish(result: Result): never {
  writeFileSync(1, `RESULT ${JSON.stringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}

/**
 * The anonymous session, kept in a file only this user can read, so every
 * link the plugin makes has the same owner: the one who can delete it later
 * (and, one day, add its preview card). It is a credential for that
 * anonymous user only, never for the project.
 */
function fileStorage(path: string) {
  const read = (): Record<string, string> => {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return {};
    }
  };
  const write = (all: Record<string, string>) => {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(all, null, 2), { mode: 0o600 });
    chmodSync(path, 0o600);
  };
  return {
    getItem: (key: string) => read()[key] ?? null,
    setItem: (key: string, value: string) => write({ ...read(), [key]: value }),
    removeItem: (key: string) => {
      const all = read();
      delete all[key];
      write(all);
    },
  };
}

async function client(): Promise<SupabaseClient> {
  const config = cloudConfig(process.env.AC_SUPABASE_URL, process.env.AC_SUPABASE_KEY);
  if (!config) finish({ ok: false, error: "No usable Supabase project: set the project URL (https) and its anon key with `short-link.mjs setup`." });
  // supabase-js comes from the studio's own node_modules, at the version the studio ships.
  const { createClient } = createRequire(join(process.cwd(), "package.json"))("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  const fakeLog = process.env.AC_FAKE_SUPABASE;
  const fetchImpl = fakeLog ? (await import(join(dirname(process.argv[1]), "test", "fake-supabase.ts"))).fakeFetch(fakeLog) : undefined;
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "animatron.auth",
      storage: fileStorage(process.env.AC_SESSION_FILE || join(process.cwd(), ".animatron-composer-session.json")),
    },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

/** True when the error is the network refusing the connection, not the project refusing the request. */
function isOffline(message: string): boolean {
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket|403 Forbidden|tunneling/i.test(message);
}

async function create(studioUrl: string, file: string) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    finish({ ok: false, error: `can't read ${file}` });
  }
  const imported = docFromJson(text, basename(file));
  if (!imported.ok) finish({ ok: false, error: `the studio would not import it: ${imported.message}` });
  if (imported.warnings.length) finish({ ok: false, error: `the studio would repair it (${imported.warnings.join("; ")}); fix and validate first` });
  const doc: StudioDoc = imported.doc;
  // The same refusals and the same tidy-up as the studio's makeShareLink().
  if (hasMedia(doc)) finish({ ok: false, error: "Video and sound files are too big for a link. Hand over the JSON file instead." });
  const description = doc.description?.trim();
  const shared: StudioDoc = { ...doc, description: description || undefined };
  const duration = docDuration(shared);
  const supabase = await client();
  try {
    // The card is drawn beforehand by card.mjs (the studio's renderer in
    // headless Chrome). Without one, the studio's own path applies: the
    // link works and pasted links show no picture.
    const card = readCard();
    const { id, cardError } = await shareWithPreview(supabase, shared, { card, duration });
    const studio = new URL(studioUrl);
    const url = shareLinkFor(id, { origin: studio.origin, pathname: studio.pathname }, shareOrigin(process.env.AC_SHARE_ORIGIN ?? ""));
    const user = (await supabase.auth.getSession()).data.session?.user?.id ?? null;
    finish({ ok: true, id, url, duration: Number(duration.toFixed(2)), card: !cardError, cardError: card ? cardError : null, owner: user });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    finish({ ok: false, error: message, offline: isOffline(message) });
  }
}

/** The card PNG named by AC_CARD_FILE, as the Blob the studio's upload takes; null when there is none. */
function readCard(): Blob | null {
  const path = process.env.AC_CARD_FILE;
  if (!path) return null;
  try {
    return new Blob([new Uint8Array(readFileSync(path))], { type: "image/png" });
  } catch {
    return null;
  }
}

/**
 * Adds the card to a link made earlier without one. The database allows
 * it to the share's owner only, and only once (no update policy), so this
 * works for links this plugin's session made and never had a card.
 */
async function addCard(id: string) {
  if (!isShareId(id)) finish({ ok: false, error: `"${id}" is not a share id (10 characters of A-Z a-z 0-9 - _)` });
  const card = readCard();
  if (!card) finish({ ok: false, error: "no card to upload (AC_CARD_FILE missing or unreadable)" });
  const supabase = await client();
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) finish({ ok: false, error: "No saved session: only links made by this plugin's session can get a card here." });
    await uploadShareCard(supabase, id, card);
    finish({ ok: true, id, card: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    finish({ ok: false, error: /exists|duplicate/i.test(message) ? `${id} already has a card; a card can't be changed once added.` : /security|policy|403|unauthor/i.test(message) ? `${id} isn't a link this plugin's session made, so it can't add its card.` : message, offline: isOffline(message) });
  }
}

/**
 * Removes a share and its card. The studio has no delete button yet; the
 * database allows it to the share's owner only (RLS "Owners delete their
 * shares"), which is the session this plugin keeps.
 */
async function remove(id: string) {
  if (!isShareId(id)) finish({ ok: false, error: `"${id}" is not a share id (10 characters of A-Z a-z 0-9 - _)` });
  const supabase = await client();
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) finish({ ok: false, error: "No saved session: only links made by this plugin's session can be deleted here. Links made in the studio are owned by that browser." });
    const { error, count } = await supabase.from("shares").delete({ count: "exact" }).eq("id", id);
    if (error) throw new Error(error.message);
    if (!count) finish({ ok: false, error: `No link ${id} owned by this plugin's session (already deleted, or made elsewhere).` });
    // The card, if one was ever added; a missing file is fine.
    await supabase.storage.from("share-cards").remove([`${id}.png`]);
    finish({ ok: true, id, deleted: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    finish({ ok: false, error: message, offline: isOffline(message) });
  }
}

// No top-level await: the studio's package is CommonJS, so tsx compiles this file as such.
const [cmd, ...rest] = process.argv.slice(2);
const job =
  cmd === "create" && rest.length === 2 ? create(rest[0], rest[1]) : cmd === "card" && rest.length === 1 ? addCard(rest[0]) : cmd === "delete" && rest.length === 1 ? remove(rest[0]) : null;
if (!job) {
  console.error("usage: shortlink.ts create <studioUrl> <file.json> | card <shareId> | delete <shareId>");
  process.exit(2);
} else {
  job.catch((e) => finish({ ok: false, error: e instanceof Error ? e.message : String(e) }));
}
