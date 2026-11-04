// The page and the card route against a stand-in for the Supabase REST API.

const SUPABASE = "https://project.supabase.test";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const ID = "Ab3dEfGh9k";
const META = { name: "Strands to Logo", description: "Woven rainbow strands turn into the rings.", width: 1920, height: 1080, duration: 9.7, layers: 3, createdAt: "2026-11-04T00:00:00+00:00" };

interface Fake {
  metas?: Record<string, unknown>;
  cards?: Record<string, Uint8Array>;
  rpcStatus?: number;
}

function fakeSupabase({ metas = { [ID]: META }, cards = { [ID]: PNG }, rpcStatus = 200 }: Fake = {}) {
  const calls: { method: string; url: string; apikey: string | null }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, url: url.href, apikey: new Headers(init?.headers).get("apikey") });
    if (url.pathname === "/rest/v1/rpc/get_share_meta") {
      if (rpcStatus !== 200) return new Response("boom", { status: rpcStatus });
      const { share_id } = JSON.parse(String(init?.body)) as { share_id: string };
      return Response.json(metas[share_id] ?? null);
    }
    const card = url.pathname.match(/^\/storage\/v1\/object\/public\/share-cards\/(.+)\.png$/);
    if (card) {
      const bytes = cards[card[1]];
      // Supabase Storage answers a missing object with a 400.
      if (!bytes) return Response.json({ statusCode: "404", error: "not_found" }, { status: 400 });
      return new Response(method === "HEAD" ? null : new Blob([new Uint8Array(bytes)]), { status: 200, headers: { "content-type": "image/png" } });
    }
    return new Response("unexpected", { status: 500 });
  });
  return calls;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", SUPABASE);
  vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SHARE_URL", "https://links.example.test");
  vi.stubEnv("STUDIO_URL", "https://studio.example.test/");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the share page", () => {
  it("writes the link preview from the share's meta, with the anon key and nothing else", async () => {
    const calls = fakeSupabase();
    const { generateMetadata } = await import("../app/s/[id]/page");
    const meta = await generateMetadata(params(ID));
    expect(meta.title).toBe("Strands to Logo · Animatron");
    expect(meta.description).toBe("Woven rainbow strands turn into the rings.");
    expect(meta.openGraph).toMatchObject({ siteName: "Animatron", title: "Strands to Logo", url: `https://links.example.test/s/${ID}` });
    expect((meta.openGraph as { images: { url: string; width: number }[] }).images[0]).toMatchObject({ url: `https://links.example.test/s/${ID}/card.png`, width: 1200 });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(calls.every((c) => c.url.startsWith(SUPABASE))).toBe(true);
    expect(calls.find((c) => c.url.endsWith("get_share_meta"))?.apikey).toBe("anon-key");
  });

  it("leaves the picture out when the share has no card", async () => {
    fakeSupabase({ cards: {} });
    const { generateMetadata } = await import("../app/s/[id]/page");
    const meta = await generateMetadata(params(ID));
    expect((meta.openGraph as { images: unknown[] }).images).toEqual([]);
    expect(meta.twitter).toMatchObject({ card: "summary" });
  });

  it("has nothing to show for an unknown id or one that isn't a share id, without asking for the latter", async () => {
    const calls = fakeSupabase({ metas: {} });
    const { generateMetadata } = await import("../app/s/[id]/page");
    expect((await generateMetadata(params("Zz3dEfGh9k"))).title).toBe("Animatron");
    const before = calls.length;
    expect((await generateMetadata(params("../secret"))).title).toBe("Animatron");
    expect(calls).toHaveLength(before);
  });

  it("fails loudly when the database can't answer, rather than calling the link empty", async () => {
    fakeSupabase({ rpcStatus: 503 });
    const { generateMetadata } = await import("../app/s/[id]/page");
    await expect(generateMetadata(params(ID))).rejects.toThrow("get_share_meta answered 503");
  });
});

describe("the card route", () => {
  it("serves the stored card from this domain, cached for good", async () => {
    fakeSupabase();
    const { GET } = await import("../app/s/[id]/card.png/route");
    const response = await GET(new Request("https://links.example.test"), params(ID));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("answers 404 for a share without a card and for ids that aren't share ids", async () => {
    fakeSupabase({ cards: {} });
    const { GET } = await import("../app/s/[id]/card.png/route");
    expect((await GET(new Request("https://links.example.test"), params(ID))).status).toBe(404);
    expect((await GET(new Request("https://links.example.test"), params("nope"))).status).toBe(404);
  });
});
