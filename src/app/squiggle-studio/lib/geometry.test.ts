import type { Point } from "../types";
import { bands, bbox, curve, offset, resample, smoothPts } from "./geometry";

describe("resample", () => {
  it("returns points unchanged when there are fewer than two", () => {
    expect(resample([], 5)).toEqual([]);
    expect(resample([[1, 2]], 5)).toEqual([[1, 2]]);
  });

  it("drops evenly spaced points along a straight line and keeps endpoints", () => {
    const out = resample(
      [
        [0, 0],
        [10, 0],
      ],
      5,
    );
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([10, 0]);
    // A point lands at the 5px mark between the two ends.
    expect(out).toContainEqual([5, 0]);
  });
});

describe("bbox", () => {
  it("computes a padded axis-aligned bounding box", () => {
    const box = bbox(
      [
        [0, 0],
        [10, 20],
      ],
      2,
    );
    expect(box).toEqual([-2, -2, 14, 24]);
  });
});

describe("offset", () => {
  it("shifts a horizontal line straight down by the offset distance", () => {
    const pts: Point[] = [
      [0, 0],
      [10, 0],
      [20, 0],
    ];
    const shifted = offset(pts, 5);
    // Tangent points right, normal points down: y grows by exactly d.
    for (const [, y] of shifted) expect(y).toBeCloseTo(5);
  });
});

describe("bands", () => {
  it("makes one band per color, each slightly wider than the stripe", () => {
    const pts: Point[] = [
      [0, 0],
      [10, 10],
      [20, 0],
    ];
    const colors = ["#c74028", "#59996a", "#457a9d"];
    const out = bands(pts, colors, 8);
    expect(out).toHaveLength(3);
    expect(out.map((b) => b.color)).toEqual(colors);
    for (const b of out) {
      expect(b.w).toBeCloseTo(8.6);
      expect(b.d.startsWith("M")).toBe(true);
    }
  });
});

describe("curve", () => {
  it("renders a dot for one point and a line for two", () => {
    expect(curve([[3, 4]])).toContain("M3.0 4.0");
    expect(curve([[0, 0], [5, 5]])).toBe("M0.0 0.0 L5.0 5.0");
  });

  it("emits cubic segments for three or more points", () => {
    const d = curve([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
    expect(d.startsWith("M0.0 0.0")).toBe(true);
    expect(d).toContain(" C");
  });
});

describe("smoothPts", () => {
  it("returns a finite polyline and tolerates tiny inputs", () => {
    const jagged: Point[] = [
      [0, 0],
      [5, 40],
      [10, 0],
      [15, 40],
      [20, 0],
    ];
    const out = smoothPts(jagged);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const [x, y] of out) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
    expect(smoothPts([[0, 0], [1, 1]])).toHaveLength(2);
  });
});
