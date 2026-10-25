import type { Vec2 } from "../types";

export interface PathSample {
  x: number;
  y: number;
  /** Direction of travel in degrees, screen coordinates (y down). */
  angle: number;
  /** Index of the waypoint this sample is leaving. */
  segment: number;
  /** 0..1 distance through that segment, by spline parameter. */
  segmentT: number;
}

export interface PathSampler {
  at: (progress: number) => PathSample;
  /** Dense polyline of the whole path, for drawing it in the editor. */
  polyline: Vec2[];
  length: number;
  /** 0..1 progress (fraction of the path's length) at which each waypoint sits. */
  pointProgress: number[];
}

const SAMPLES_PER_SEGMENT = 40;
/** Centripetal parameterisation: knots spaced by the square root of the chord length. */
const ALPHA = 0.5;

/**
 * Centripetal Catmull-Rom between p1 and p2. Unlike the uniform form it never
 * cusps or overshoots when waypoints are unevenly spaced, so a ribbon drawn
 * through a tight loop next to a long straight stays a smooth curve.
 */
function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const knot = (a: Vec2, b: Vec2, prev: number) => prev + Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y) ** ALPHA);
  const t0 = 0;
  const t1 = knot(p0, p1, t0);
  const t2 = knot(p1, p2, t1);
  const t3 = knot(p2, p3, t2);
  const u = t1 + (t2 - t1) * t;
  const mix = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => {
    const w = (u - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

/**
 * Builds an arc-length parameterized centripetal Catmull-Rom spline through
 * `points`. Progress 0..1 maps to distance along the path, so speed depends
 * only on the easing applied to progress, not on how the waypoints are spaced.
 */
export function buildPath(points: Vec2[], closed: boolean): PathSampler {
  if (points.length === 0) {
    const origin = { x: 0, y: 0, angle: 0, segment: 0, segmentT: 0 };
    return { at: () => origin, polyline: [], length: 0, pointProgress: [] };
  }
  if (points.length === 1) {
    const only = { x: points[0].x, y: points[0].y, angle: 0, segment: 0, segmentT: 0 };
    return { at: () => only, polyline: [points[0]], length: 0, pointProgress: [0] };
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
  // Waypoint i is polyline sample i * SAMPLES_PER_SEGMENT (the open path's last one is the final sample).
  const pointProgress = points.map((_, i) =>
    length === 0 ? 0 : cumulative[Math.min(i * SAMPLES_PER_SEGMENT, cumulative.length - 1)] / length,
  );

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
    const segment = Math.min(segments - 1, Math.floor(lo / SAMPLES_PER_SEGMENT));
    const segmentT = Math.min(1, (lo - segment * SAMPLES_PER_SEGMENT + t) / SAMPLES_PER_SEGMENT);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle, segment, segmentT };
  };

  return { at, polyline, length, pointProgress };
}
