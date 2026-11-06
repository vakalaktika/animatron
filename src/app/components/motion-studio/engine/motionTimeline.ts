import type { Clip, StudioDoc } from "../types";
import { motionEnd } from "./motionScene";

/** Includes ordinary property, bone and drawing keys as well as controller operations. */
export function authoredClipEnd(clip: Clip): number {
  const animation=clip.type==="rig"&&Array.isArray(clip.rig?.animations)?clip.rig.animations.find(a=>a.id===clip.animationId):undefined;
  const tracks=[...Object.values(clip.keys??{}),...(animation?.tracks??[]).map(t=>t.keys),...(animation?.drawingTracks??[]).map(t=>t.keys)];
  const times=tracks.flatMap(track=>Array.isArray(track)?track.map(k=>k?.time).filter(t=>typeof t==="number"&&Number.isFinite(t)):[]);
  return Math.max(motionEnd(clip),0,...times);
}

/** Exact duration and loop are opt-in so old inferred timelines retain their behavior. */
export function timelineErrors(doc: Pick<StudioDoc, "version" | "timeline" | "clips">): string[] {
  const timeline = doc.timeline;
  if (timeline === undefined) return [];
  if (!timeline || typeof timeline !== "object" || Array.isArray(timeline)) return ["Invalid timeline."];
  const errors: string[] = [];
  if (timeline.duration !== undefined) {
    if (doc.version < 4) errors.push("Explicit duration requires document version 4.");
    if (typeof timeline.duration !== "number" || !Number.isFinite(timeline.duration) || timeline.duration <= 0 || timeline.duration > 600) errors.push("Timeline duration must be between zero and 600 seconds.");
    else if (doc.clips.some(c => c.enabled && c.start + authoredClipEnd(c) > timeline.duration! + 1e-6)) errors.push("Timeline duration cuts off an authored motion operation or key.");
  }
  if (timeline.loop !== undefined && (typeof timeline.loop !== "boolean" || doc.version < 4)) errors.push("Explicit loop behavior requires a boolean in document version 4.");
  if (doc.version === 4 && (typeof timeline.tailSeconds !== "number" || !Number.isFinite(timeline.tailSeconds) || timeline.tailSeconds < 0 || timeline.tailSeconds > 60)) errors.push("Timeline tail must be between zero and 60 seconds.");
  return errors;
}
