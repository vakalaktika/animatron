import type { Point } from "../types";
import { bands, bbox, curve, densify, offset, resample, smoothPts } from "./geometry";

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

  it("flattens hand jitter into a sparse, gently curving line", () => {
    // A long gentle arc with ±6px wobble every 8px, the way a hand draws.
    const wobbly: Point[] = Array.from({ length: 101 }, (_, i) => [i * 8, Math.sin(i / 25) * 120 + (i % 2 ? 6 : -6)]);
    const out = smoothPts(wobbly);
    // Reduced to ~20px spacing.
    expect(out.length).toBeLessThan(wobbly.length / 2);
    // No wobble left: the turn between consecutive segments stays small.
    // The pinned endpoints keep their own jitter; judge the body of the line.
    let maxTurn = 0;
    for (let i = 3; i < out.length - 3; i++) {
      const a = Math.atan2(out[i][1] - out[i - 1][1], out[i][0] - out[i - 1][0]);
      const b = Math.atan2(out[i + 1][1] - out[i][1], out[i + 1][0] - out[i][0]);
      maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))));
    }
    expect(maxTurn).toBeLessThan(0.15);
  });
});

describe("densify", () => {
  it("leaves a dense stroke alone and splines a sparse one", () => {
    const dense: Point[] = Array.from({ length: 20 }, (_, i) => [i * 5, 0]);
    expect(densify(dense)).toBe(dense);
    const sparse: Point[] = [
      [0, 0],
      [100, 100],
      [200, 0],
    ];
    const out = densify(sparse);
    expect(out.length).toBeGreaterThan(20);
    // Passes through the waypoints, with a rounded (not pointed) top.
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([200, 0]);
    const top = Math.max(...out.map((p) => p[1]));
    expect(top).toBeGreaterThan(99);
  });
});
