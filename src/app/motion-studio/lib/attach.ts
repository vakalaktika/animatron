import { descendantIds } from "@/app/components/motion-studio/engine/hierarchy";
import {
  IDENTITY,
  restTransformAt,
  toLocalPoint,
  transformAt,
  toLocalDelta,
} from "@/app/components/motion-studio/engine/transform";
import type { Clip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import { moveSubtree, type DropTarget } from "./tree";

/**
 * Attaches (or detaches, with `null`) a clip. The clip's resting spot on the
 * stage is preserved: its rest position is re-expressed in the new parent's
 * frame so nothing jumps. Attaching to itself or a descendant is refused.
 */
export function reparentClip(doc: StudioDoc, clipId: string, parentId: string | null): StudioDoc {
  const clip = doc.clips.find((c) => c.id === clipId);
  if (!clip || clip.parentId === parentId) return doc;
  if (parentId !== null && (parentId === clipId || descendantIds(doc, clipId).has(parentId))) return doc;
  const world = restTransformAt(doc, clipId);
  const frame = parentId ? restTransformAt(doc, parentId) : IDENTITY;
  const local = toLocalPoint(frame, world);
  return replaceClip(doc, { ...clip, parentId, x: local.x, y: local.y });
}

/**
 * A tree drop: re-expresses the clip's position in the new parent's frame
 * (so it stays put on stage) and moves its subtree to the target slot.
 */
export function dropClip(doc: StudioDoc, clipId: string, target: DropTarget): StudioDoc {
  const reparented = reparentClip(doc, clipId, target.parentId);
  return { ...reparented, clips: moveSubtree(reparented.clips, clipId, target.parentId, target.afterId) };
}

/**
 * Removes a clip. Its children are detached in place: their absolute rest
 * position is baked into `x` / `y`, so the stage looks the same afterwards.
 */
export function deleteClip(doc: StudioDoc, clipId: string): StudioDoc {
  const detachedChildren = doc.clips.map((c) => {
    if (c.parentId !== clipId) return c;
    const world = restTransformAt(doc, c.id);
    return { ...c, parentId: null, x: world.x, y: world.y };
  });
  return { ...doc, clips: detachedChildren.filter((c) => c.id !== clipId) };
}

/**
 * Moves a clip by a stage-space delta. For an attached clip the delta is
 * converted into the parent's frame at time `t`, so dragging on the stage
 * feels the same whether or not the parent is scaled or banked.
 */
export function nudgeClip(doc: StudioDoc, clipId: string, delta: Vec2, t: number): StudioDoc {
  const clip = doc.clips.find((c) => c.id === clipId);
  if (!clip) return doc;
  const local = clip.parentId ? toLocalDelta(transformAt(doc, clip.parentId, t), delta) : delta;
  return replaceClip(doc, { ...clip, x: clip.x + local.x, y: clip.y + local.y });
}

/** Same conversion as `nudgeClip`, for callers that move something other than the anchor (path points). */
export function deltaInParentFrame(doc: StudioDoc, clipId: string, delta: Vec2, t: number): Vec2 {
  const clip = doc.clips.find((c) => c.id === clipId);
  if (!clip?.parentId) return delta;
  return toLocalDelta(transformAt(doc, clip.parentId, t), delta);
}

function replaceClip(doc: StudioDoc, next: Clip): StudioDoc {
  return { ...doc, clips: doc.clips.map((c) => (c.id === next.id ? next : c)) };
}
