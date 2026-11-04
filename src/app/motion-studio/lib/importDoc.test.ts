import { makeText, welcomePreset } from "../presets";
import { docFromJson } from "./importDoc";

describe("docFromJson", () => {
  it("opens a studio document as it is", () => {
    const doc = { ...welcomePreset(), name: "Shared" };
    const result = docFromJson(JSON.stringify(doc), "shared.studio.json");
    if (!result.ok) throw new Error(result.message);
    expect(result.doc.name).toBe("Shared");
    expect(result.doc.clips.map((c) => c.id)).toEqual(doc.clips.map((c) => c.id));
  });

  it("names an unnamed document after its file", () => {
    const result = docFromJson(JSON.stringify({ ...welcomePreset(), name: "  " }), "big-intro.studio.json");
    expect(result.ok && result.doc.name).toBe("big-intro");
  });

  it("wraps a lone layer in a fresh composition at the centre of the default frame", () => {
    const clip = makeText({ name: "Headline", x: 5, y: 5 });
    const result = docFromJson(JSON.stringify(clip), "headline.clip.json");
    if (!result.ok) throw new Error(result.message);
    expect(result.doc.name).toBe("Headline");
    expect(result.doc.stage).toMatchObject({ width: 1920, height: 1080 });
    expect(result.doc.clips).toHaveLength(1);
    expect(result.doc.clips[0]).toMatchObject({ type: "text", x: 960, y: 540, parentId: null });
  });

  it("wraps a Lottie file the same way", () => {
    const result = docFromJson(JSON.stringify({ v: "5.7", fr: 30, ip: 0, op: 60, w: 300, h: 300, layers: [] }), "spinner.json");
    if (!result.ok) throw new Error(result.message);
    expect(result.doc.name).toBe("spinner");
    expect(result.doc.clips[0]).toMatchObject({ type: "lottie", width: 300 });
  });

  it("says what is wrong with a file it cannot read", () => {
    expect(docFromJson("{not json", "x.json")).toEqual({ ok: false, message: "x.json is not valid JSON." });
    const result = docFromJson(JSON.stringify({ hello: 1 }), "x.json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/^x\.json: Unrecognized file/);
  });
});
