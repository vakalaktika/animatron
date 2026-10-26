import { clipEnd, docDuration, loopsForever } from "@/app/components/motion-studio/engine/timing";
import { normalizeDoc } from "./lib/migrate";
import { BUILT_IN_PRESETS, FRAME_SIZES } from "./presets";
import { frameLabel, STARTER_TEMPLATES, TEMPLATES } from "./templates";

const each = TEMPLATES.map((t) => [t.label, t] as const);

describe("gallery templates", () => {
  it("lists the four originals first, then the starters, with no duplicate labels", () => {
    expect(TEMPLATES.slice(0, BUILT_IN_PRESETS.length)).toEqual(BUILT_IN_PRESETS);
    expect(TEMPLATES.slice(BUILT_IN_PRESETS.length)).toEqual(STARTER_TEMPLATES);
    expect(new Set(TEMPLATES.map((t) => t.label)).size).toBe(TEMPLATES.length);
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("covers every frame size", () => {
    const frames = new Set(TEMPLATES.map((t) => frameLabel(t.make())));
    for (const f of FRAME_SIZES) expect(frames).toContain(`${f.width} × ${f.height}`);
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
      if (clip.parentId !== null) expect(ids).toContain(clip.parentId);
    }
  });

  it.each(each)("%s is set in one of the offered frames and is named after its tile", (label, t) => {
    const doc = t.make();
    expect(doc.name).toBe(label);
    expect(FRAME_SIZES.some((f) => f.width === doc.stage.width && f.height === doc.stage.height)).toBe(true);
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

  it("only the loaders run forever", () => {
    const forever = TEMPLATES.filter((t) => t.make().clips.some(loopsForever)).map((t) => t.label);
    expect(forever).toEqual(["Welcome", "Ribbon ride", "Chippy loader", "Thank you", "Loader dots"]);
  });
});

describe("frameLabel", () => {
  it("names the frame the way the size chips do", () => {
    expect(frameLabel({ stage: { width: 1080, height: 1920, background: "#fff", transparent: false } })).toBe("1080 × 1920");
  });
});
