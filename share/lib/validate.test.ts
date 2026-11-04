import { checkCard, checkDoc, checkDuration, checkMeta, MAX_DESCRIPTION, MAX_NAME, metaFrom } from "./validate";

const doc = () => ({ version: 2, name: "Strands to Logo", description: "Rainbow strands.", stage: { width: 1920, height: 1080, background: "#fff", transparent: false }, clips: [{ id: "a", type: "text" }] });

describe("checkDoc", () => {
  it("accepts a composition-shaped object", () => {
    expect(checkDoc(doc())).toMatchObject({ ok: true });
  });

  it.each([
    ["an array", [], "Not a composition."],
    ["a future version", { ...doc(), version: 9 }, "Not a composition this service knows."],
    ["a blank name", { ...doc(), name: "  " }, "The composition needs a name."],
    ["a long name", { ...doc(), name: "x".repeat(MAX_NAME + 1) }, `The name is longer than ${MAX_NAME} characters.`],
    ["a long description", { ...doc(), description: "x".repeat(MAX_DESCRIPTION + 1) }, `The description is longer than ${MAX_DESCRIPTION} characters.`],
    ["a silly stage", { ...doc(), stage: { width: 10, height: 1e9 } }, "The stage size is missing or out of range."],
    ["a broken clip", { ...doc(), clips: [{ id: 1 }] }, "A layer in the composition is malformed."],
    ["a sound track", { ...doc(), audio: { mediaId: "m" } }, "Compositions with sound can't be shared by link."],
    ["a video layer", { ...doc(), clips: [{ id: "v", type: "sprite", source: { kind: "video", mediaId: "m" } }] }, "Compositions with video can't be shared by link."],
  ])("refuses %s", (_label, json, message) => {
    expect(checkDoc(json)).toEqual({ ok: false, message });
  });
});

describe("checkDuration and checkCard", () => {
  it("reads the duration as sent by a form and rounds it", () => {
    expect(checkDuration("9.7351")).toEqual({ ok: true, value: 9.74 });
    expect(checkDuration("0")).toMatchObject({ ok: false });
    expect(checkDuration("abc")).toMatchObject({ ok: false });
    expect(checkDuration(1e6)).toMatchObject({ ok: false });
  });

  it("wants a real PNG of a sane size", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    expect(checkCard(png, "image/png")).toMatchObject({ ok: true });
    expect(checkCard(png, "image/jpeg")).toEqual({ ok: false, message: "The preview picture must be a PNG." });
    expect(checkCard(Uint8Array.from([1, 2, 3]), "image/png")).toMatchObject({ ok: false });
    expect(checkCard(new Uint8Array(1_500_001), "image/png")).toEqual({ ok: false, message: "The preview picture is too big." });
  });
});

describe("meta", () => {
  it("is derived from the document and survives a round trip", () => {
    const meta = metaFrom({ ...doc(), name: " Strands to Logo " }, 9.74, "2026-11-04T00:00:00.000Z");
    expect(meta).toEqual({ name: "Strands to Logo", description: "Rainbow strands.", width: 1920, height: 1080, duration: 9.74, layers: 1, createdAt: "2026-11-04T00:00:00.000Z" });
    expect(checkMeta(JSON.parse(JSON.stringify(meta)))).toEqual(meta);
    expect(checkMeta({ ...meta, width: "1920" })).toBeNull();
    expect(checkMeta(null)).toBeNull();
  });
});
