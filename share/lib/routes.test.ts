import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The route handlers against the local file backend, in a scratch folder.
const dir = mkdtempSync(join(tmpdir(), "animatron-share-"));
const cwd = vi.spyOn(process, "cwd").mockReturnValue(dir);
afterAll(() => {
  cwd.mockRestore();
  rmSync(dir, { recursive: true, force: true });
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const doc = () => ({ version: 2, name: "Strands to Logo", description: "Woven rainbow strands turn into the rings.", stage: { width: 1920, height: 1080, background: "#fff", transparent: false }, clips: [{ id: "a", type: "text" }] });

function form(over: { doc?: unknown; card?: Blob; duration?: string } = {}) {
  const body = new FormData();
  body.set("doc", new Blob([JSON.stringify(over.doc ?? doc())], { type: "application/json" }), "doc.json");
  body.set("card", over.card ?? new Blob([PNG], { type: "image/png" }), "card.png");
  body.set("duration", over.duration ?? "9.7");
  return body;
}

const post = async (body: FormData, origin: string | null = "https://vakalaktika.github.io") => {
  const { POST } = await import("../app/api/share/route");
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return POST(new Request("http://localhost:3100/api/share", { method: "POST", body, headers }));
};

describe("POST /api/share", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("SHARE_URL", "https://links.example.test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("stores a composition and answers with a short link, with CORS for the studio", async () => {
    const response = await post(form());
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://vakalaktika.github.io");
    const body = (await response.json()) as { id: string; url: string };
    expect(body.id).toMatch(/^[1-9A-HJ-NP-Za-km-z]{10}$/);
    expect(body.url).toBe(`https://links.example.test/s/${body.id}`);

    const { GET } = await import("../app/api/share/[id]/route");
    const back = await GET(new Request("http://localhost:3100"), { params: Promise.resolve({ id: body.id }) });
    expect(back.status).toBe(200);
    expect(back.headers.get("access-control-allow-origin")).toBe("*");
    expect(back.headers.get("cache-control")).toContain("immutable");
    expect(((await back.json()) as { name: string }).name).toBe("Strands to Logo");

    const { readMeta } = await import("./store");
    expect(await readMeta(body.id)).toMatchObject({ name: "Strands to Logo", width: 1920, height: 1080, duration: 9.7, layers: 1 });

    const card = await import("../app/s/[id]/card.png/route");
    const picture = await card.GET(new Request("http://localhost:3100"), { params: Promise.resolve({ id: body.id }) });
    expect(picture.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await picture.arrayBuffer())).toEqual(PNG);
  });

  it("refuses other websites, bad files and oversized uploads", async () => {
    expect((await post(form(), "https://evil.example")).status).toBe(403);
    expect((await post(form({ doc: { hello: 1 } }))).status).toBe(400);
    expect((await post(form({ card: new Blob(["nope"], { type: "image/png" }) }))).status).toBe(400);
    expect((await post(form({ duration: "-1" }))).status).toBe(400);
    const big = { ...doc(), clips: Array.from({ length: 20_000 }, (_, i) => ({ id: `c${i}`, type: "text", pad: "x".repeat(100) })) };
    expect((await post(form({ doc: big }))).status).toBe(413);
  });

  it("answers 404 for ids that are not shares", async () => {
    const { GET } = await import("../app/api/share/[id]/route");
    expect((await GET(new Request("http://localhost:3100"), { params: Promise.resolve({ id: "nope" }) })).status).toBe(404);
    expect((await GET(new Request("http://localhost:3100"), { params: Promise.resolve({ id: "Ab3dEfGh9k" }) })).status).toBe(404);
  });

  it("writes the link preview from the stored meta", async () => {
    const response = await post(form());
    const { id } = (await response.json()) as { id: string };
    const { generateMetadata } = await import("../app/s/[id]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ id }) });
    expect(meta.title).toBe("Strands to Logo · Animatron");
    expect(meta.description).toBe("Woven rainbow strands turn into the rings.");
    expect(meta.openGraph).toMatchObject({ siteName: "Animatron", title: "Strands to Logo", url: `https://links.example.test/s/${id}` });
    expect((meta.openGraph as { images: { url: string; width: number }[] }).images[0]).toMatchObject({ url: `https://links.example.test/s/${id}/card.png`, width: 1200 });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
