import type { StageMask, Vec2 } from "../types";

export const STAGE_MASK_LIMITS = { regions: 16, points: 64, coordinate: 1e7 } as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= STAGE_MASK_LIMITS.coordinate;
const point = (v: unknown): v is Vec2 => object(v) && Object.keys(v).every(k => k === "x" || k === "y") && finite(v.x) && finite(v.y);

/** Geometry only: no source markup, selectors, URLs or CSS cross the boundary. */
export function validStageMask(value: unknown): value is StageMask {
  if (!object(value) || Object.keys(value).some(k => k !== "regions") || !Array.isArray(value.regions) || value.regions.length < 1 || value.regions.length > STAGE_MASK_LIMITS.regions) return false;
  return value.regions.every((polygon: unknown) => {
    if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > STAGE_MASK_LIMITS.points || !polygon.every(point)) return false;
    const area = polygon.reduce((sum, p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0);
    return Math.abs(area) > 1e-6;
  });
}

/** Point membership in a union of stage regions, including polygon edges. */
export function pointInStageMask(mask: StageMask, p: Vec2): boolean {
  if (!validStageMask(mask) || !point(p)) return false;
  return mask.regions.some(polygon => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j], b = polygon[i];
      const cross = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
      if (Math.abs(cross) < 1e-7 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)) return true;
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  });
}
