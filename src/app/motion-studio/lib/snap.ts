import { descendantIds } from "@/app/components/motion-studio/engine/hierarchy";
import { restTransformAt } from "@/app/components/motion-studio/engine/transform";
import type { StudioDoc, Vec2 } from "@/app/components/motion-studio/types";

export interface SnapGuide {
  axis: "x" | "y";
  /** Stage coordinate of the guide line. */
  at: number;
}

export interface SnapTargets {
  xs: number[];
  ys: number[];
}

export interface SnapResult {
  point: Vec2;
  guides: SnapGuide[];
}

/** Screen pixels within which a dragged anchor jumps to a guide. */
export const SNAP_SCREEN_PX = 8;

/**
 * Where a dragged clip wants to land: the stage centre lines and the resting
 * anchors of every other clip that is not riding along with it. Rest
 * positions, not the animated ones, so the targets hold still while the
 * composition plays.
 */
export function snapTargets(doc: StudioDoc, movingId: string): SnapTargets {
  const skip = descendantIds(doc, movingId);
  skip.add(movingId);
  const xs = [doc.stage.width / 2];
  const ys = [doc.stage.height / 2];
  for (const clip of doc.clips) {
    if (skip.has(clip.id) || !clip.enabled) continue;
    const world = restTransformAt(doc, clip.id);
    xs.push(world.x);
    ys.push(world.y);
  }
  return { xs, ys };
}

/** Snaps each axis independently to its nearest target within `threshold` stage px. */
export function snapPoint(point: Vec2, targets: SnapTargets, threshold: number): SnapResult {
  const guides: SnapGuide[] = [];
  const nearest = (value: number, candidates: number[]) => {
    let best: number | null = null;
    let bestDistance = threshold;
    for (const c of candidates) {
      const d = Math.abs(c - value);
      if (d <= bestDistance) {
        best = c;
        bestDistance = d;
      }
    }
    return best;
  };
  const x = nearest(point.x, targets.xs);
  const y = nearest(point.y, targets.ys);
  if (x !== null) guides.push({ axis: "x", at: x });
  if (y !== null) guides.push({ axis: "y", at: y });
  return { point: { x: x ?? point.x, y: y ?? point.y }, guides };
}
