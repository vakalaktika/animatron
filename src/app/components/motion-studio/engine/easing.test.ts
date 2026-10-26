import { DEFAULT_BEZIER, easeCss, PRESET_BEZIERS, resolveEase } from "./easing";

describe("easing presets", () => {
  it("start at 0 and end at 1, overshoot or not", () => {
    for (const name of Object.keys(PRESET_BEZIERS) as (keyof typeof PRESET_BEZIERS)[]) {
      const fn = resolveEase({ name });
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    }
  });

  it("wind-up dips below zero before it goes; snap is most of the way early", () => {
    expect(resolveEase({ name: "anticipate" })(0.15)).toBeLessThan(0);
    expect(resolveEase({ name: "snap" })(0.3)).toBeGreaterThan(0.75);
  });

  it("describes itself as a CSS timing function", () => {
    expect(easeCss({ name: "linear" })).toBe("linear");
    expect(easeCss({ name: "custom", custom: [0.1, 0.2, 0.3, 0.4] })).toBe("cubic-bezier(0.1, 0.2, 0.3, 0.4)");
    expect(easeCss({ name: "custom" })).toBe(`cubic-bezier(${DEFAULT_BEZIER.join(", ")})`);
  });
});
