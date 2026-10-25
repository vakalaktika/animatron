import { arrivalTime } from "@/app/components/motion-studio/engine/ribbon";
import { clipEnd, docDuration } from "@/app/components/motion-studio/engine/timing";
import { normalizeDoc } from "./lib/migrate";
import { BUILT_IN_PRESETS, welcomePreset } from "./presets";

describe("built-in presets", () => {
  it.each(BUILT_IN_PRESETS.map((p) => [p.label, p] as const))("%s survives a round trip through the migrator untouched", (_label, preset) => {
    const doc = preset.make();
    const { doc: normalized, warnings } = normalizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(warnings).toEqual([]);
    expect(normalized.clips.map((c) => c.id)).toEqual(doc.clips.map((c) => c.id));
  });

  it.each(BUILT_IN_PRESETS.map((p) => [p.label, p] as const))("%s has unique ids and only resolvable parents", (_label, preset) => {
    const doc = preset.make();
    const ids = doc.clips.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const clip of doc.clips) {
      if (clip.parentId !== null) expect(ids).toContain(clip.parentId);
    }
  });
});

describe("welcome preset", () => {
  const doc = welcomePreset();
  const ribbon = doc.clips.find((c) => c.id === "welcome-ribbon");
  const title = doc.clips.find((c) => c.id === "welcome-title");
  const tagline = doc.clips.find((c) => c.id === "welcome-tagline");

  it("is the first built-in preset so new visitors land on it", () => {
    expect(BUILT_IN_PRESETS[0].label).toBe("Welcome");
    expect(BUILT_IN_PRESETS[0].make().name).toBe("Welcome");
  });

  it("carries no A Team branding", () => {
    const text = JSON.stringify(doc).toLowerCase();
    expect(text).not.toContain("theateamproject");
    expect(text).not.toContain("a team");
    expect(doc.clips.some((c) => c.type === "logo")).toBe(false);
  });

  it("rides the title on the ribbon's paint head and fades the tagline in when the paint arrives", () => {
    expect(ribbon?.type).toBe("ribbon");
    expect(title?.parentId).toBe("welcome-ribbon");
    expect(title?.along).toBe("front");
    expect(tagline?.parentId).toBeNull();
    if (ribbon?.type !== "ribbon" || !tagline) throw new Error("missing clips");
    expect(tagline.start).toBeCloseTo(arrivalTime(ribbon, 1), 1);
  });

  it("lands the title and tagline within a few seconds", () => {
    const words = doc.clips.filter((c) => c.type === "text");
    expect(words.length).toBeGreaterThan(0);
    expect(Math.max(...words.map(clipEnd))).toBeLessThan(6);
    expect(docDuration(doc)).toBeGreaterThan(0);
  });
});
