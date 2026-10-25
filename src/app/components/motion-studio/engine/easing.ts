import type { Ease } from "../types";

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Solves a CSS cubic-bezier(x1, y1, x2, y2) timing function for t in 0..1. */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(u) - t;
      const s = slopeX(u);
      if (Math.abs(err) < 1e-5 || s === 0) break;
      u -= err / s;
    }
    u = clamp01(u);
    return sampleY(u);
  };
}

/** Ease-out with a tunable overshoot; 0 overshoot is a plain cubic ease-out. */
export function backOut(overshoot: number): (t: number) => number {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return (t: number) => {
    const u = clamp01(t) - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
  };
}

export const EASE_PRESETS = {
  linear: (t: number) => clamp01(t),
  // transitions.dev --ease-smooth-out
  smoothOut: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.45, 0, 0.55, 1),
  // Gentle start, slightly early arrival: tuned for Chippy's swoop.
  flight: cubicBezier(0.4, 0.1, 0.55, 0.94),
  backOut: backOut(1.2),
  // Pulls back a touch before it goes, then overshoots: a wind-up.
  anticipate: cubicBezier(0.68, -0.4, 0.3, 1.3),
  // Nearly all of the move happens at once, then a long soft settle.
  snap: cubicBezier(0.1, 0.9, 0.15, 1),
} as const;

export const EASE_LABELS: Record<Ease["name"], string> = {
  linear: "Linear",
  smoothOut: "Smooth out",
  inOut: "In / out",
  flight: "Flight swoop",
  backOut: "Overshoot",
  anticipate: "Wind-up",
  snap: "Snap",
  custom: "Custom",
};

export const DEFAULT_BEZIER: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

/** Control points that draw the same curve as a preset, for the curve editor to start from. */
export const PRESET_BEZIERS: Record<Exclude<Ease["name"], "custom">, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  smoothOut: [0.22, 1, 0.36, 1],
  inOut: [0.45, 0, 0.55, 1],
  flight: [0.4, 0.1, 0.55, 0.94],
  // backOut(1.2) is not a bezier; this is the closest two-handle shape.
  backOut: [0.34, 1.56, 0.64, 1],
  anticipate: [0.68, -0.4, 0.3, 1.3],
  snap: [0.1, 0.9, 0.15, 1],
};

/** The CSS timing function for an ease, for live previews. */
export function easeCss(ease: Ease): string {
  if (ease.name === "linear") return "linear";
  const [x1, y1, x2, y2] = ease.name === "custom" ? (ease.custom ?? DEFAULT_BEZIER) : PRESET_BEZIERS[ease.name];
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

export function resolveEase(ease: Ease): (t: number) => number {
  if (ease.name === "custom") {
    const [x1, y1, x2, y2] = ease.custom ?? [0.25, 0.1, 0.25, 1];
    return cubicBezier(x1, y1, x2, y2);
  }
  return EASE_PRESETS[ease.name];
}
