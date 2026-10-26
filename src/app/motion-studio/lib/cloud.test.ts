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
  shortShareUrl,
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
function fakeSupabase(over: { insertError?: { code: string; message: string }[]; rows?: Record<string, unknown>[]; anonymous?: boolean } = {}) {
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
    const body = typeof init?.body === "string" && init.body ? (JSON.parse(init.body) as unknown) : null;
    calls.push({ method, path: url.pathname, search: url.search, body, auth: headers.get("authorization") });
    if (url.pathname === "/auth/v1/signup") return json(200, session(true));
    if (url.pathname === "/auth/v1/otp") return json(200, {});
    if (url.pathname === "/auth/v1/user" && method === "PUT") return json(200, session(true).user);
    if (url.pathname === "/rest/v1/shares" && method === "POST") {
      const err = insertErrors.shift();
      return err ? json(409, { ...err, details: null, hint: null }) : new Response(null, { status: 201 });
    }
    if (url.pathname === "/rest/v1/shares" && method === "GET") {
      const rows = over.rows ?? [];
      const single = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
      if (single) return rows.length ? json(200, rows[0]) : json(406, { code: "PGRST116", message: "no rows", details: null, hint: null });
      return json(200, rows);
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
});

describe("createShare", () => {
  test("starts an anonymous session when nobody is signed in, then stores the composition", async () => {
    const { supabase, calls } = fakeSupabase();
    const id = await createShare(supabase, doc, () => "abcdefghij");
    expect(id).toBe("abcdefghij");
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /auth/v1/signup", "POST /rest/v1/shares"]);
    expect(calls[1].body).toEqual({ id: "abcdefghij", doc });
    expect(calls[1].auth).toBe("Bearer token");
  });

  test("tries a fresh id once after a collision, and reports other failures", async () => {
    const ids = ["aaaaaaaaaa", "bbbbbbbbbb"];
    const retry = fakeSupabase({ insertError: [{ code: "23505", message: "duplicate" }] });
    await expect(createShare(retry.supabase, doc, () => ids.shift() ?? "")).resolves.toBe("bbbbbbbbbb");
    const broken = fakeSupabase({ insertError: [{ code: "42501", message: "permission denied" }] });
    await expect(createShare(broken.supabase, doc, () => "cccccccccc")).rejects.toThrow("Could not save the link: permission denied");
  });

  test("refuses a composition too big for a link before sending anything", async () => {
    const { supabase, calls } = fakeSupabase();
    const huge = { ...doc, name: "x".repeat(2_000_000) };
    await expect(createShare(supabase, huge)).rejects.toThrow("too big");
    expect(calls).toHaveLength(0);
  });
});

describe("fetchShare", () => {
  test("opens the composition, repaired like any file", async () => {
    const { supabase } = fakeSupabase({ rows: [{ doc }] });
    expect((await fetchShare(supabase, "abcdefghij"))?.name).toBe("Shared");
  });

  test("null for a malformed id (no request), a missing link or something that isn't a composition", async () => {
    const empty = fakeSupabase();
    await expect(fetchShare(empty.supabase, "nope")).resolves.toBeNull();
    expect(empty.calls).toHaveLength(0);
    await expect(fetchShare(empty.supabase, "abcdefghij")).resolves.toBeNull();
    const junk = fakeSupabase({ rows: [{ doc: { hello: 1 } }] });
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
    await createShare(anon.supabase, doc, () => "abcdefghij");
    await sendSignInLink(anon.supabase, "ed@example.com", "https://site/");
    expect(anon.calls.at(-1)).toMatchObject({ method: "PUT", path: "/auth/v1/user", body: { email: "ed@example.com" } });
    await expect(sendSignInLink(anon.supabase, "not-an-email", "https://site/")).rejects.toThrow("email address");
  });

  test("projects are listed, upserted per owner and id, and deleted", async () => {
    const { supabase, calls } = fakeSupabase({ rows: [{ id: "p1", name: "One", doc, updated_at: "2026-10-01T00:00:00Z" }] });
    expect(await listRemoteProjects(supabase)).toEqual([{ id: "p1", name: "One", doc, updatedAt: "2026-10-01T00:00:00Z" }]);
    await pushProjects(supabase, [{ id: "p2", doc, updatedAt: "2026-10-02T00:00:00Z" }]);
    const upsert = calls.at(-1);
    expect(upsert?.search).toContain("on_conflict=owner%2Cid");
    expect(upsert?.body).toEqual([{ id: "p2", name: "Shared", doc, updated_at: "2026-10-02T00:00:00Z" }]);
    await deleteRemoteProject(supabase, "p2");
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", search: "?id=eq.p2" });
  });
});
