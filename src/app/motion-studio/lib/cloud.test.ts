import { createClient } from "@supabase/supabase-js";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import {
  cloudConfig,
  createShare,
  currentUser,
  deleteRemoteProject,
  fetchShare,
  isShareId,
  listRemoteProjects,
  newShareId,
  pushProjects,
  sendSignInLink,
  shareLinkFor,
  shareOrigin,
  shareWithPreview,
  shortShareUrl,
  uploadShareCard,
} from "./cloud";

const URL_BASE = "https://example.supabase.co";

const doc: StudioDoc = {
  version: 2,
  name: "Shared",
  stage: { width: 100, height: 100, background: "#fff", transparent: false },
  clips: [],
};

interface Call {
  method: string;
  path: string;
  search: string;
  body: unknown;
  auth: string | null;
}

/** A tiny stand-in for the Supabase auth and REST endpoints the studio uses. */
function fakeSupabase(over: { insertError?: { code: string; message: string }[]; rows?: Record<string, unknown>[]; shares?: Record<string, unknown>; emailTaken?: boolean; cardError?: boolean } = {}) {
  const calls: Call[] = [];
  const insertErrors = [...(over.insertError ?? [])];
  const session = (anonymous: boolean) => ({
    access_token: "token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh",
    user: { id: "user-1", aud: "authenticated", role: "authenticated", is_anonymous: anonymous, email: anonymous ? "" : "ed@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" && init.body ? (JSON.parse(init.body) as unknown) : (init?.body ?? null);
    calls.push({ method, path: url.pathname, search: url.search, body, auth: headers.get("authorization") });
    if (url.pathname === "/auth/v1/signup") return json(200, session(true));
    if (url.pathname === "/auth/v1/otp") return json(200, {});
    if (url.pathname === "/auth/v1/user" && method === "PUT") {
      return over.emailTaken ? json(422, { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" }) : json(200, session(true).user);
    }
    if (url.pathname === "/rest/v1/rpc/get_share") {
      const id = (body as { share_id: string }).share_id;
      return json(200, over.shares?.[id] ?? null);
    }
    if (url.pathname === "/rest/v1/shares" && method === "POST") {
      const err = insertErrors.shift();
      return err ? json(409, { ...err, details: null, hint: null }) : new Response(null, { status: 201 });
    }
    if (url.pathname.startsWith("/storage/v1/object/share-cards/") && method === "POST") {
      return over.cardError ? json(403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }) : json(200, { Key: url.pathname });
    }
    if (url.pathname === "/rest/v1/projects" && method === "GET") return json(200, over.rows ?? []);
    if (url.pathname === "/rest/v1/projects") return new Response(null, { status: method === "DELETE" ? 204 : 201 });
    return json(404, { message: `unexpected ${method} ${url.pathname}` });
  };
  const supabase = createClient(URL_BASE, "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchImpl },
  });
  return { supabase, calls };
}

describe("cloudConfig", () => {
  test("needs both values and an https address (http only for a local Supabase)", () => {
    expect(cloudConfig(undefined, "k")).toBeNull();
    expect(cloudConfig("https://x.supabase.co", "")).toBeNull();
    expect(cloudConfig("http://evil.example", "k")).toBeNull();
    expect(cloudConfig("not a url", "k")).toBeNull();
    expect(cloudConfig("https://x.supabase.co/", "k")).toEqual({ url: "https://x.supabase.co", anonKey: "k" });
    expect(cloudConfig("http://localhost:54321", "k")?.url).toBe("http://localhost:54321");
  });
});

describe("share ids and links", () => {
  test("ids are ten URL-safe characters", () => {
    const id = newShareId();
    expect(isShareId(id)).toBe(true);
    expect(newShareId(() => new Uint8Array(10).fill(255))).toBe("__________");
    expect(isShareId("../../etc")).toBe(false);
  });

  test("a short link is a query parameter on this page", () => {
    expect(shortShareUrl("abcdefghij", { origin: "https://ed.github.io", pathname: "/animatron/" })).toBe("https://ed.github.io/animatron/?s=abcdefghij");
  });

  test("with the share page service set up, the link is its page (which carries the preview card)", () => {
    const here = { origin: "https://ed.github.io", pathname: "/animatron/" };
    expect(shareLinkFor("abcdefghij", here, "https://share.example.com")).toBe("https://share.example.com/s/abcdefghij");
    expect(shareLinkFor("abcdefghij", here, null)).toBe("https://ed.github.io/animatron/?s=abcdefghij");
  });

  test("the share page address must be https (http only on this machine), with no trailing slash", () => {
    expect(shareOrigin("https://share.example.com/")).toBe("https://share.example.com");
    expect(shareOrigin("http://localhost:3100")).toBe("http://localhost:3100");
    expect(shareOrigin("http://share.example.com")).toBeNull();
    expect(shareOrigin("not a url")).toBeNull();
    expect(shareOrigin(undefined)).toBeNull();
    expect(shareOrigin("  ")).toBeNull();
  });
});

describe("createShare", () => {
  test("starts an anonymous session when nobody is signed in, then stores the composition", async () => {
    const { supabase, calls } = fakeSupabase();
    const id = await createShare(supabase, doc, { makeId: () => "abcdefghij" });
    expect(id).toBe("abcdefghij");
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/shares"]);
    expect(calls[1].body).toEqual({ id: "abcdefghij", doc });
    expect(calls[1].auth).toBe("Bearer token");
  });

  test("tries a fresh id once after a collision, and reports other failures", async () => {
    const ids = ["aaaaaaaaaa", "bbbbbbbbbb"];
    const retry = fakeSupabase({ insertError: [{ code: "23505", message: "duplicate" }] });
    await expect(createShare(retry.supabase, doc, { makeId: () => ids.shift() ?? "" })).resolves.toBe("bbbbbbbbbb");
    const broken = fakeSupabase({ insertError: [{ code: "42501", message: "permission denied" }] });
    await expect(createShare(broken.supabase, doc, { makeId: () => "cccccccccc" })).rejects.toThrow("Could not save the link: permission denied");
  });

  test("refuses a composition too big for a link before sending anything", async () => {
    const { supabase, calls } = fakeSupabase();
    const huge = { ...doc, name: "x".repeat(2_000_000) };
    await expect(createShare(supabase, huge)).rejects.toThrow("too big");
    expect(calls).toHaveLength(0);
  });

  test("keeps the length the studio measured, for the share page", async () => {
    const { supabase, calls } = fakeSupabase();
    await createShare(supabase, doc, { duration: 9.7, makeId: () => "abcdefghij" });
    expect(calls[1].body).toEqual({ id: "abcdefghij", doc, duration: 9.7 });
  });
});

describe("uploadShareCard", () => {
  test("stores the card as <id>.png in the public cards bucket, never over an existing one", async () => {
    const { supabase, calls } = fakeSupabase();
    await uploadShareCard(supabase, "abcdefghij", new Blob([new Uint8Array([0x89, 0x50])], { type: "image/png" }));
    expect(calls).toHaveLength(1);
    expect(`${calls[0].method} ${calls[0].path}`).toBe("POST /storage/v1/object/share-cards/abcdefghij.png");
  });

  test("says what went wrong when the bucket refuses it", async () => {
    const { supabase } = fakeSupabase({ cardError: true });
    await expect(uploadShareCard(supabase, "abcdefghij", new Blob([], { type: "image/png" }))).rejects.toThrow("Could not save the preview picture");
  });
});

describe("shareWithPreview", () => {
  const card = new Blob([new Uint8Array([0x89, 0x50])], { type: "image/png" });

  test("stores the share, then its card", async () => {
    const { supabase, calls } = fakeSupabase();
    await expect(shareWithPreview(supabase, doc, { card, duration: 4 }, () => "abcdefghij")).resolves.toEqual({ id: "abcdefghij", cardError: null });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/shares", "POST /storage/v1/object/share-cards/abcdefghij.png"]);
  });

  test("the link still comes back when the card can't be saved, with the reason", async () => {
    const { supabase } = fakeSupabase({ cardError: true });
    const result = await shareWithPreview(supabase, doc, { card, duration: 4 }, () => "abcdefghij");
    expect(result.id).toBe("abcdefghij");
    expect(result.cardError).toMatch("Could not save the preview picture");
  });

  test("with no card (it couldn't be drawn) the link is made without one, and says so", async () => {
    const { supabase, calls } = fakeSupabase();
    const result = await shareWithPreview(supabase, doc, { card: null, duration: 4 }, () => "abcdefghij");
    expect(result).toEqual({ id: "abcdefghij", cardError: "Couldn't draw the preview picture." });
    expect(calls.some((c) => c.path.startsWith("/storage/"))).toBe(false);
  });

  test("a failure to store the share itself is still an error", async () => {
    const { supabase } = fakeSupabase({ insertError: [{ code: "P0001", message: "Share limit reached: 50 links a day." }] });
    await expect(shareWithPreview(supabase, doc, { card, duration: 4 }, () => "abcdefghij")).rejects.toThrow("Share limit reached");
  });
});

describe("fetchShare", () => {
  test("opens the composition, repaired like any file", async () => {
    const { supabase, calls } = fakeSupabase({ shares: { abcdefghij: doc } });
    expect((await fetchShare(supabase, "abcdefghij"))?.name).toBe("Shared");
    // Shares are read by exact id through the get_share function, never by listing the table.
    expect(calls).toMatchObject([{ method: "POST", path: "/rest/v1/rpc/get_share", body: { share_id: "abcdefghij" } }]);
  });

  test("null for a malformed id (no request), a missing link or something that isn't a composition", async () => {
    const empty = fakeSupabase();
    await expect(fetchShare(empty.supabase, "nope")).resolves.toBeNull();
    expect(empty.calls).toHaveLength(0);
    await expect(fetchShare(empty.supabase, "abcdefghij")).resolves.toBeNull();
    const junk = fakeSupabase({ shares: { abcdefghij: { hello: 1 } } });
    await expect(fetchShare(junk.supabase, "abcdefghij")).resolves.toBeNull();
  });
});

describe("accounts", () => {
  test("nobody is signed in to begin with", async () => {
    expect(await currentUser(fakeSupabase().supabase)).toEqual({ kind: "none" });
  });

  test("a sign-in link goes out by email; an anonymous session is upgraded in place", async () => {
    const fresh = fakeSupabase();
    await sendSignInLink(fresh.supabase, " ed@example.com ", "https://site/");
    expect(fresh.calls.map((c) => c.path)).toEqual(["/auth/v1/otp"]);
    expect(fresh.calls[0].body).toMatchObject({ email: "ed@example.com" });

    const anon = fakeSupabase();
    await createShare(anon.supabase, doc, { makeId: () => "abcdefghij" });
    await sendSignInLink(anon.supabase, "ed@example.com", "https://site/");
    expect(anon.calls.at(-1)).toMatchObject({ method: "PUT", path: "/auth/v1/user", body: { email: "ed@example.com" } });
    await expect(sendSignInLink(anon.supabase, "not-an-email", "https://site/")).rejects.toThrow("email address");
  });

  test("an anonymous session whose email already has an account signs in to that account instead", async () => {
    const taken = fakeSupabase({ emailTaken: true });
    await createShare(taken.supabase, doc, { makeId: () => "abcdefghij" });
    await sendSignInLink(taken.supabase, "ed@example.com", "https://site/");
    expect(taken.calls.slice(-2).map((c) => `${c.method} ${c.path}`)).toEqual(["PUT /auth/v1/user", "POST /auth/v1/otp"]);
  });

  test("projects are listed, upserted per owner and id, and deleted", async () => {
    const { supabase, calls } = fakeSupabase({ rows: [{ id: "p1", name: "One", doc, deleted: false, updated_at: "2026-10-01T00:00:00Z" }] });
    expect(await listRemoteProjects(supabase)).toEqual([{ id: "p1", name: "One", doc, deleted: false, updatedAt: "2026-10-01T00:00:00Z" }]);
    const huge = { id: "big", doc: { ...doc, name: "x".repeat(5_000_000) }, updatedAt: "2026-10-02T00:00:00Z" };
    const tooBig = await pushProjects(supabase, [{ id: "p2", doc, updatedAt: "2026-10-02T00:00:00Z" }, huge]);
    expect(tooBig.map((p) => p.id)).toEqual(["big"]);
    const upsert = calls.at(-1);
    expect(upsert?.search).toContain("on_conflict=owner%2Cid");
    expect(upsert?.body).toEqual([{ id: "p2", name: "Shared", doc, deleted: false, updated_at: "2026-10-02T00:00:00Z" }]);
    // A deletion is a tombstone, so other devices drop their copy instead of uploading it again.
    await deleteRemoteProject(supabase, "p2", "Shared", "2026-10-03T00:00:00Z");
    expect(calls.at(-1)).toMatchObject({ method: "POST", body: { id: "p2", name: "Shared", doc: null, deleted: true, updated_at: "2026-10-03T00:00:00Z" } });
  });
});

test("scene-contract short sharing refuses before network or card upload",async()=>{
 const {supabase,calls}=fakeSupabase();
 await expect(shareWithPreview(supabase,{...doc,version:3},{card:null,duration:4},()=>"abcdefghij")).rejects.toThrow(/updated application/i);
 expect(calls).toEqual([]);
});
