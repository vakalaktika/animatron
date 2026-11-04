import { makeImageSprite, welcomePreset } from "../presets";
import { docFromHash, SHARE_PARAM, shareUrl } from "./share";

const location = { origin: "https://example.test", pathname: "/animatron/" };

describe("share links", () => {
  it("carries a composition through the URL hash and back", () => {
    const doc = { ...welcomePreset(), name: "Shared one" };
    const result = shareUrl(doc, location);
    if (!result.ok) throw new Error("expected a link");
    expect(result.url.startsWith(`https://example.test/animatron/#${SHARE_PARAM}=`)).toBe(true);
    const hash = result.url.slice(result.url.indexOf("#"));
    const back = docFromHash(hash);
    expect(back?.name).toBe("Shared one");
    expect(back?.clips.map((c) => c.id)).toEqual(doc.clips.map((c) => c.id));
  });

  it("refuses a link that would carry embedded pictures", () => {
    const doc = welcomePreset();
    // Pseudo-random bytes stand in for a real picture, which compresses about as badly.
    let seed = 7;
    const noise = Array.from({ length: 120_000 }, () => {
      seed = (seed * 48271) % 2147483647;
      return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[seed % 64];
    }).join("");
    doc.clips.push(makeImageSprite(`data:image/png;base64,${noise}`, "big.png", 1));
    expect(shareUrl(doc, location)).toEqual({ ok: false, reason: "too-large" });
  });

  it("ignores hashes that are not a share, or are unreadable", () => {
    expect(docFromHash("")).toBeNull();
    expect(docFromHash("#other=1")).toBeNull();
    expect(docFromHash(`#${SHARE_PARAM}=not-a-real-payload`)).toBeNull();
  });
});

describe("short links", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads a short id out of the hash and nothing else", async () => {
    const { shareIdFromHash } = await import("./share");
    expect(shareIdFromHash("#s=Ab3dEfGh9k")).toBe("Ab3dEfGh9k");
    expect(shareIdFromHash("#s=")).toBeNull();
    expect(shareIdFromHash("#s=has/slash")).toBeNull();
    expect(shareIdFromHash("#s=0OIl0OIl")).toBeNull();
    expect(shareIdFromHash("#share=x")).toBeNull();
  });

  it("knows the share origin only when the build set one", async () => {
    const { shareOrigin } = await import("./share");
    vi.stubEnv("NEXT_PUBLIC_SHARE_ORIGIN", "");
    expect(shareOrigin()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SHARE_ORIGIN", "https://share.example.test/ ");
    expect(shareOrigin()).toBe("https://share.example.test");
  });

  it("posts the composition and card and returns the link the service made", async () => {
    const { createShortShare } = await import("./share");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "Ab3dEfGh9k", url: "https://share.example.test/s/Ab3dEfGh9k" }), { status: 201 });
    });
    const doc = welcomePreset();
    const result = await createShortShare("https://share.example.test", doc, new Blob(["png"], { type: "image/png" }), 9.7);
    expect(result).toEqual({ ok: true, url: "https://share.example.test/s/Ab3dEfGh9k" });
    expect(calls[0].url).toBe("https://share.example.test/api/share");
    const form = calls[0].init.body as FormData;
    expect(form.get("duration")).toBe("9.7");
    expect(await (form.get("doc") as Blob).text()).toBe(JSON.stringify(doc));
  });

  it("passes the service's refusal on, and says when it cannot be reached", async () => {
    const { createShortShare } = await import("./share");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "Too big." }), { status: 413 }));
    expect(await createShortShare("https://share.example.test", welcomePreset(), new Blob([]), 1)).toEqual({ ok: false, reason: "Too big." });
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await createShortShare("https://share.example.test", welcomePreset(), new Blob([]), 1)).toEqual({ ok: false, reason: "offline" });
  });

  it("fetches and repairs the composition behind a short link", async () => {
    const { fetchShortShare } = await import("./share");
    const doc = { ...welcomePreset(), name: "From afar" };
    vi.stubGlobal("fetch", async (url: string) => (url.endsWith("/api/share/Ab3dEfGh9k") ? Response.json(doc) : new Response("", { status: 404 })));
    expect((await fetchShortShare("https://share.example.test", "Ab3dEfGh9k"))?.name).toBe("From afar");
    expect(await fetchShortShare("https://share.example.test", "missing1")).toBeNull();
  });
});
