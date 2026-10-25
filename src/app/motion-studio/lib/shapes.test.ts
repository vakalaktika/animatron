import { normalizeDoc } from "./migrate";
import { makeShape, SHAPES, shapeSvg } from "./shapes";

const stage = { width: 1920, height: 1080 };

describe("shapes", () => {
  it.each(SHAPES.map((s) => [s.kind] as const))("%s is one filled element in a square box", (kind) => {
    const { markup, aspect } = shapeSvg(kind, "#123456");
    expect(aspect).toBe(1);
    expect(markup).toContain('viewBox="0 0 100 100"');
    expect(markup).toContain('fill="#123456"');
    expect((markup.match(/<(circle|rect|polygon|path)\b/g) ?? []).length).toBe(1);
  });

  it("drops in at the stage centre and survives the migrator", () => {
    const clip = makeShape("star", "#c33a26", stage);
    expect(clip).toMatchObject({ type: "sprite", name: "Star", x: 960, y: 540, bank: 0 });
    expect(clip.source.kind).toBe("svg");
    expect(clip.path[clip.path.length - 1]).toEqual({ x: 0, y: 0 });
    const { doc, warnings } = normalizeDoc({ version: 2, name: "t", stage: { ...stage, background: "#fff", transparent: false }, clips: [clip] });
    expect(warnings).toEqual([]);
    expect(doc.clips[0].id).toBe(clip.id);
  });
});
