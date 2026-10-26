import {
  animationTime,
  applyMatrix,
  editRestJoint,
  inverse,
  poseOf,
  rigPoseAt,
  setPoseDelta,
  solve,
  tidyPose,
  upsertKey,
  world,
  activeAnimation,
  type Matrix,
} from "@/app/components/motion-studio/engine/rig";
import type { RigClip, RigDelta, RigPose, Vec2 } from "@/app/components/motion-studio/types";

/** What a stage drag on a rig does: pose it, or edit its rest joints. */
export type RigMode = "pose" | "joints";
/** Where on a bone a drag started: its joint (origin) or its tip. */
export type RigHandle = "joint" | "tip";

/**
 * What a stage gesture on a rig means for the document. Pose edits change
 * deltas (into the manual pose, or as keys at the playhead when a clip is
 * playing); rest edits change the skeleton and keep the drawing fixed.
 * Everything here is pure, so it is unit-tested without the stage.
 */

const DEG = 180 / Math.PI;
const rotationOf = (m: Matrix) => Math.atan2(m[1], m[0]) * DEG;
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** The clip's animation-local time at clock `t`, folded into the clip. */
export function localTime(clip: RigClip, t: number): number {
  const anim = activeAnimation(clip);
  if (!anim) return 0;
  return Number(animationTime(anim, Math.max(0, t - clip.start)).toFixed(2));
}

/**
 * Writes a new pose into the clip: when a clip is playing, every changed
 * bone gets a key at the playhead (auto-key); otherwise the manual pose
 * changes. Unchanged bones are left alone either way.
 */
export function commitPose(clip: RigClip, t: number, next: RigPose, onlyBones?: string[]): RigClip {
  const anim = activeAnimation(clip);
  if (!anim) return { ...clip, pose: tidyPose(clip.rig, next) };
  const current = rigPoseAt(clip, t);
  const at = localTime(clip, t);
  const changed = (clip.rig.bones.map((b) => b.id)).filter((id) => {
    if (onlyBones && !onlyBones.includes(id)) return false;
    const a = poseOf(current, id);
    const b = poseOf(next, id);
    return Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6 || Math.abs(a.rotation - b.rotation) > 1e-6;
  });
  const rig = changed.reduce((acc, id) => upsertKey(acc, anim.id, id, at, poseOf(next, id)), clip.rig);
  return { ...clip, rig };
}

/** Sets one bone's delta (clamped) through `commitPose`. */
export function setBoneDelta(clip: RigClip, t: number, boneId: string, delta: Partial<RigDelta>): RigClip {
  const pose = rigPoseAt(clip, t);
  return commitPose(clip, t, setPoseDelta(clip.rig, pose, boneId, delta), [boneId]);
}

/**
 * A handle dragged to `point` (rig canvas units) at clock time `t`.
 * Pose · joint: the chain above the bone bends so its joint follows (the
 * root slides instead). Pose · tip: the bone turns about its joint.
 * Joints · joint: the rest position moves (drawing held). Joints · tip: the
 * rest direction and length follow the pointer.
 */
export function dragRigHandle(clip: RigClip, t: number, boneId: string, handle: RigHandle, mode: RigMode, point: Vec2): RigClip {
  const { rig } = clip;
  const bone = rig.bones.find((b) => b.id === boneId);
  if (!bone) return clip;
  const pose = rigPoseAt(clip, t);
  const worlds = world(rig, pose);
  const parent = bone.parentId ? worlds[bone.parentId] : ([1, 0, 0, 1, 0, 0] as Matrix);
  const origin = applyMatrix(worlds[boneId], { x: 0, y: 0 });

  if (mode === "pose") {
    if (handle === "joint") {
      if (bone.parentId === null) {
        // The root has nothing above it to bend: it slides to the pointer.
        const inParent = applyMatrix(inverse(parent), point);
        return commitPose(clip, t, setPoseDelta(rig, pose, boneId, { x: inParent.x - bone.rest.x, y: inParent.y - bone.rest.y }), [boneId]);
      }
      const solved = solve(rig, pose, boneId, point);
      return commitPose(clip, t, solved);
    }
    const angle = Math.atan2(point.y - origin.y, point.x - origin.x) * DEG;
    const delta = wrap(angle - rotationOf(parent) - bone.rest.rotation);
    return commitPose(clip, t, setPoseDelta(rig, pose, boneId, { rotation: delta }), [boneId]);
  }

  // Joints mode: edit the rest skeleton, with the artwork kept in place.
  if (handle === "joint") {
    const current = poseOf(pose, boneId);
    const inParent = applyMatrix(inverse(parent), point);
    const rest = { x: inParent.x - current.x, y: inParent.y - current.y, rotation: bone.rest.rotation };
    return { ...clip, rig: editRestJoint(rig, boneId, { rest }) };
  }
  const current = poseOf(pose, boneId).rotation;
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x) * DEG;
  const rotation = wrap(angle - rotationOf(parent) - current);
  // Bone frames carry no scale, so a canvas distance is a bone length.
  const length = Math.hypot(point.x - origin.x, point.y - origin.y);
  return { ...clip, rig: editRestJoint(rig, boneId, { rest: { ...bone.rest, rotation }, length: Number(length.toFixed(2)) }) };
}
