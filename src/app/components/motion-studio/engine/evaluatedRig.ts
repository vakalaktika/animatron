import type { RigClip, RigPose, StudioDoc } from "../types";
import { rigPoseAt } from "./rig";
import { evaluateScene, hasMotion } from "./motionScene";

/** Scene-space targets require the same context as object transforms. */
export function sceneRigPoseAt(doc: StudioDoc, clip: RigClip, time: number): RigPose {
  return hasMotion(doc) ? evaluateScene(doc, time).poses[clip.id] ?? rigPoseAt(clip, time) : rigPoseAt(clip, time);
}
