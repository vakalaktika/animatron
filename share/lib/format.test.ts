import { fallbackDescription, kicker } from "./format";

describe("format", () => {
  it("writes the kicker with one decimal under ten seconds and none above", () => {
    expect(kicker({ width: 1920, height: 1080, duration: 9.74 })).toBe("1920 × 1080 · about 9.7 s");
    expect(kicker({ width: 1080, height: 1920, duration: 12.4 })).toBe("1080 × 1920 · about 12 s");
  });

  it("falls back to a sentence about the piece", () => {
    expect(fallbackDescription({ duration: 4, layers: 1 })).toBe("A 4-second animation with 1 layer, made in Animatron. Open it to get your own copy to edit.");
    expect(fallbackDescription({ duration: 9.74, layers: 5 })).toMatch(/^A 9.7-second animation with 5 layers/);
  });
});
