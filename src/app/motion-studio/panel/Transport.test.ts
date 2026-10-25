import { makeChippy, makeLogo } from "../presets";
import { barSpan } from "./Transport";

describe("barSpan", () => {
  test("maps start and end to percentages of the duration", () => {
    const clip = makeLogo({ start: 1 });
    const span = barSpan(clip, 10);
    expect(span.left).toBe(10);
    expect(span.clipped).toBe(false);
    expect(span.left + span.width).toBeLessThan(100);
  });

  test("clamps a clip that runs past the composition end", () => {
    // A disabled clip is not counted in docDuration but still draws a bar.
    const clip = makeChippy({ start: 3, enabled: false });
    const span = barSpan(clip, 4);
    expect(span.left).toBe(75);
    expect(span.left + span.width).toBe(100);
    expect(span.clipped).toBe(true);
  });

  test("keeps a bar starting after the end inside the track", () => {
    const span = barSpan(makeLogo({ start: 50 }), 4);
    expect(span.left).toBe(100);
    expect(span.width).toBe(0.5);
  });

  test("returns an empty span for a zero duration", () => {
    expect(barSpan(makeLogo(), 0)).toEqual({ left: 0, width: 0, clipped: false });
  });
});
