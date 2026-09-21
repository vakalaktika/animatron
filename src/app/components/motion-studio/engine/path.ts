import type { Vec2 } from "../types";

export interface PathSample {
  x: number;
  y: number;
  /** Direction of travel in degrees, screen coordinates (y down). */
  angle: number;
}

export interface PathSampler {
  at: (progress: number) => PathSample;
  /** Dense polyline of the whole path, for drawing it in the editor. */
  polyline: Vec2[];
  length: number;
}

const SAMPLES_PER_SEGMENT = 40;

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * Builds an arc-length parameterized Catmull-Rom spline through `points`.
 * Progress 0..1 maps to distance along the path, so speed depends only on the
 * easing applied to progress, not on how the waypoints are spaced.
 */
export function buildPath(points: Vec2[], closed: boolean): PathSampler {
  if (points.length === 0) {
    const origin = { x: 0, y: 0, angle: 0 };
    return { at: () => origin, polyline: [], length: 0 };
  }
  if (points.length === 1) {
    const only = { ...points[0], angle: 0 };
    return { at: () => only, polyline: [points[0]], length: 0 };
  }

  const n = points.length;
  const pick = (i: number) =>
    closed ? points[((i % n) + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  const segments = closed ? n : n - 1;

  const polyline: Vec2[] = [];
  for (let s = 0; s < segments; s++) {
    for (let k = 0; k < SAMPLES_PER_SEGMENT; k++) {
      polyline.push(
        catmullRom(pick(s - 1), pick(s), pick(s + 1), pick(s + 2), k / SAMPLES_PER_SEGMENT),
      );
    }
  }
  polyline.push(closed ? { ...points[0] } : { ...points[n - 1] });

  const cumulative: number[] = [0];
  for (let i = 1; i < polyline.length; i++) {
    const dx = polyline[i].x - polyline[i - 1].x;
    const dy = polyline[i].y - polyline[i - 1].y;
    cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
  }
  const length = cumulative[cumulative.length - 1];

  const at = (progress: number): PathSample => {
    const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    const target = p * length;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= target) lo = mid;
      else hi = mid;
    }
    const a = polyline[lo];
    const b = polyline[hi];
    const span = cumulative[hi] - cumulative[lo];
    const t = span === 0 ? 0 : (target - cumulative[lo]) / span;
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle };
  };

  return { at, polyline, length };
}
