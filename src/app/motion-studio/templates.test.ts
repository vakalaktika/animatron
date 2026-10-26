import { clipEnd, docDuration, loopsForever } from "@/app/components/motion-studio/engine/timing";
import { normalizeDoc } from "./lib/migrate";
import { FRAME_SIZES } from "./presets";
import { frameIndex, frameLabel, STARTER_TEMPLATES, TEMPLATES } from "./templates";

const each = TEMPLATES.map((t) => [t.label, t] as const);

describe("gallery templates", () => {
  it("keeps the Welcome composition first and gives every tile its own label", () => {
    expect(TEMPLATES[0].label).toBe("Welcome");
    expect(new Set(TEMPLATES.map((t) => t.label)).size).toBe(TEMPLATES.length);
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("covers every frame size", () => {
    const frames = new Set(TEMPLATES.map((t) => frameIndex(t.make())));
    for (let i = 0; i < FRAME_SIZES.length; i++) expect(frames).toContain(i);
  });

  it.each(each)("%s survives a round trip through the migrator untouched", (_label, t) => {
    const doc = t.make();
    const { doc: normalized, warnings } = normalizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(warnings).toEqual([]);
    expect(normalized).toEqual(doc);
  });

  it.each(each)("%s has fixed unique ids and only resolvable parents", (_label, t) => {
    const doc = t.make();
    const ids = doc.clips.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(t.make().clips.map((c) => c.id)).toEqual(ids);
    for (const clip of doc.clips) {
      if (clip.parentId === null) continue;
      const parent = doc.clips.find((c) => c.id === clip.parentId);
      expect(parent).toBeDefined();
      expect(clip.start).toBeGreaterThanOrEqual(parent?.start ?? Infinity);
    }
  });

  it.each(each)("%s is set in one of the offered frames and is named after its tile", (label, t) => {
    const doc = t.make();
    expect(doc.name).toBe(label);
    expect(frameIndex(doc)).toBeGreaterThanOrEqual(0);
    expect(t.blurb.length).toBeGreaterThan(8);
  });

  it.each(each)("%s has every clip switched on and starting on the clock", (_label, t) => {
    const doc = t.make();
    expect(doc.clips.length).toBeGreaterThan(0);
    for (const clip of doc.clips) {
      expect(clip.enabled).toBe(true);
      expect(clip.start).toBeGreaterThanOrEqual(0);
      expect(clipEnd(clip)).toBeGreaterThan(clip.start);
    }
    expect(docDuration(doc)).toBeGreaterThan(1);
  });

  it.each(STARTER_TEMPLATES.map((t) => [t.label, t] as const))("%s plays out within a few seconds", (_label, t) => {
    const doc = t.make();
    expect(docDuration(doc)).toBeLessThan(8);
    const settled = Math.max(...doc.clips.filter((c) => !loopsForever(c)).map(clipEnd));
    expect(settled).toBeLessThan(5);
  });

  it.each(STARTER_TEMPLATES.map((t) => [t.label, t] as const))("%s uses only text, shapes and ribbons and carries no brand artwork", (_label, t) => {
    const doc = t.make();
    const text = JSON.stringify(doc).toLowerCase();
    expect(text).not.toContain("theateamproject");
    expect(text).not.toContain("a team");
    for (const clip of doc.clips) {
      expect(["text", "sprite", "ribbon"]).toContain(clip.type);
      if (clip.type === "sprite") expect(clip.source.kind).toBe("svg");
      if (clip.type === "text") expect(clip.accentSuffix).toBe("");
    }
  });

  it.each(each)("%s keeps every anchor inside its frame", (_label, t) => {
    const doc = t.make();
    const { width, height } = doc.stage;
    for (const clip of doc.clips) {
      if (clip.parentId !== null) continue;
      // A ribbon may start off the edge and sweep in; everything else sits in frame.
      if (clip.type === "ribbon") continue;
      expect(clip.x).toBeGreaterThanOrEqual(0);
      expect(clip.x).toBeLessThanOrEqual(width);
      expect(clip.y).toBeGreaterThanOrEqual(0);
      expect(clip.y).toBeLessThanOrEqual(height);
    }
  });

  it("runs forever only where a loop is the point: the loaders, and the comets that keep a card alive", () => {
    const forever = TEMPLATES.filter((t) => t.make().clips.some(loopsForever)).map((t) => t.label);
    expect(forever).toEqual(["Welcome", "Ribbon ride", "Chippy loader", "Thank you", "Loader dots"]);
  });
});

describe("frame helpers", () => {
  it("spell out a frame and find it in the offered sizes", () => {
    expect(frameLabel({ width: 1080, height: 1920 })).toBe("1080 × 1920");
    expect(frameIndex({ stage: { width: 1080, height: 1920, background: "#fff", transparent: false } })).toBe(2);
    expect(frameIndex({ stage: { width: 500, height: 500, background: "#fff", transparent: false } })).toBe(-1);
  });
});
