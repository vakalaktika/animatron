import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import type { MotionConstraint, MotionProgram } from "@/app/components/motion-studio/engine/motionTypes";
import { controllerLocalPoint, evaluateScene, targetSocketTransform } from "@/app/components/motion-studio/engine/motionScene";
import { toLocalPoint } from "@/app/components/motion-studio/engine/transform";
import { validateMotionDocument } from "@/app/components/motion-studio/engine/motionValidation";
import { changeConstraint, changeController, changeMotionBlock, controllerAt, editableMotion, keyMotionController, removeMotionController } from "./motionEdit";

export type MotionGraphNodeKind = "object" | "controller" | "block" | "constraint" | "bone" | "socket";
export interface MotionGraphPort {
  id: string;
  label: string;
  direction: "input" | "output";
  kind: "motion" | "target" | "frame" | "bone";
}
export interface MotionGraphNode {
  id: string;
  clipId: string;
  itemId?: string;
  kind: MotionGraphNodeKind;
  label: string;
  provenance: "scene" | "rig" | "override";
  ownerName: string;
  enabled: boolean;
  ports: MotionGraphPort[];
}
export interface MotionGraphConnection { source: string; sourceHandle: string; target: string; targetHandle: string }
export interface MotionGraphEdge extends MotionGraphConnection { id: string; label: string; ownerNodeId: string; enabled: boolean }
export interface MotionGraph { nodes: MotionGraphNode[]; edges: MotionGraphEdge[] }
export interface MotionGraphResult { doc: StudioDoc; error?: string; nodeId?: string }
export type MotionGraphEdit = { type: "remove" | "duplicate" | "toggle"; nodeId: string };

/** Array encoding avoids collisions between repeated rig IDs and punctuation in clip IDs. */
export const graphNodeId = (clipId: string, kind: MotionGraphNodeKind, itemId = ""): string => encodeURIComponent(JSON.stringify([clipId, kind, itemId]));
const port = (id: string, label: string, direction: MotionGraphPort["direction"], kind: MotionGraphPort["kind"]): MotionGraphPort => ({ id, label, direction, kind });
const portsFor = (kind: MotionGraphNodeKind, attach = false): MotionGraphPort[] => {
  if (kind === "object") return [port("motion", "Moves", "input", "motion"), port("frame", "Object anchor", "output", "frame")];
  if (kind === "controller") return [port("motion", "Motion", "input", "motion"), port("space", "Follows", "input", "frame"), port("target", "Target", "output", "target")];
  if (kind === "block") return [port("motion", "Moves", "output", "motion")];
  if (kind === "bone") return [port("bone", "Joint", "output", "bone")];
  if (kind === "socket") return [port("frame", "Socket", "output", "frame")];
  return attach ? [port("frame", "Follows", "input", "frame")]
    : [port("target", "Aims / reaches toward", "input", "target"), port("bone", "Joint / end of limb", "input", "bone")];
};

function provenance(clip: Clip, list: keyof MotionProgram, id: string): MotionGraphNode["provenance"] {
  const inherited = clip.type === "rig" && clip.rig.motion?.[list]?.some(item => item.id === id);
  return inherited ? clip.motion?.[list]?.some(item => item.id === id) ? "override" : "rig" : "scene";
}

/** The graph is a projection of the authored motion program, never a second playback model. */
export function buildMotionGraph(doc: StudioDoc): MotionGraph {
  const nodes: MotionGraphNode[] = [], edges: MotionGraphEdge[] = [];
  for (const clip of doc.clips) {
    const node = (kind: MotionGraphNodeKind, label: string, itemId?: string, source: MotionGraphNode["provenance"] = "scene", enabled = true, attach = false) => {
      const value = { id: graphNodeId(clip.id, kind, itemId), clipId: clip.id, itemId, kind, label, ownerName: clip.name || clip.id, provenance: source, enabled, ports: portsFor(kind, attach) };
      nodes.push(value); return value.id;
    };
    const edge = (source: string, sourceHandle: string, target: string, targetHandle: string, label: string, ownerNodeId: string, enabled = true) => {
      edges.push({ id: encodeURIComponent(JSON.stringify([ownerNodeId, targetHandle])), source, sourceHandle, target, targetHandle, label, ownerNodeId, enabled });
    };
    const objectId = node("object", clip.name || clip.id), program = editableMotion(clip);
    for (const c of program.controllers) {
      const target = node("controller", c.name || c.id, c.id, provenance(clip, "controllers", c.id));
      if (c.space !== "stage") edge(graphNodeId(c.space === "rig" ? clip.id : c.clipId ?? clip.id, c.slotId ? "socket" : "object", c.slotId), "frame", target, "space", "follows", target);
    }
    for (const b of program.blocks) {
      const source = node("block", b.name || b.id, b.id, provenance(clip, "blocks", b.id), b.enabled !== false);
      edge(source, "motion", b.controllerId ? graphNodeId(clip.id, "controller", b.controllerId) : objectId, "motion", "moves", source, b.enabled !== false);
    }
    for (const c of program.constraints) {
      const target = node("constraint", c.name || c.id, c.id, provenance(clip, "constraints", c.id), c.enabled !== false, c.type === "attach");
      if (c.type === "attach") edge(graphNodeId(c.targetClipId, c.slotId ? "socket" : "object", c.slotId), "frame", target, "frame", "holds", target, c.enabled !== false);
      else {
        edge(graphNodeId(clip.id, "controller", c.targetId), "target", target, "target", c.type === "ik" ? "reaches toward" : "aims at", target, c.enabled !== false);
        edge(graphNodeId(clip.id, "bone", c.type === "ik" ? c.tipId : c.boneId), "bone", target, "bone", c.type === "ik" ? "controls limb" : "turns joint", target, c.enabled !== false);
      }
    }
    if (clip.type === "rig") {
      for (const b of clip.rig.bones) node("bone", b.name || b.role || b.id, b.id, "rig");
      for (const s of clip.rig.slots ?? []) node("socket", s.id, s.id, "rig");
    }
  }
  return { nodes, edges };
}

const failure = (doc: StudioDoc, error: string): MotionGraphResult => ({ doc, error });
/** Rewire an operation's input/destination without silently leaving a second driver behind. */
export function reconnectMotionGraph(doc: StudioDoc, edgeId: string, connection: MotionGraphConnection, time: number): MotionGraphResult {
  const graph=buildMotionGraph(doc),edge=graph.edges.find(e=>e.id===edgeId);
  if(!edge) return failure(doc,"This connection no longer exists.");
  const owner=graph.nodes.find(n=>n.id===edge.ownerNodeId)!;
  if(owner.kind==="block" ? connection.source!==owner.id || connection.sourceHandle!==edge.sourceHandle : connection.target!==owner.id || connection.targetHandle!==edge.targetHandle)
    return failure(doc,"Reconnect this operation's driver or destination. Create a new relationship to control another operation.");
  return connectMotionGraph(doc,connection,time);
}
function commit(doc: StudioDoc, next: Clip): MotionGraphResult {
  const candidate: StudioDoc = { ...doc, version: 4, clips: doc.clips.map(c => c.id === next.id ? next : c) };
  const errors = validateMotionDocument(candidate);
  return errors.length ? failure(doc, errors[0]) : { doc: candidate };
}

function preserveAttachment(doc: StudioDoc, clip: Clip, constraint: Extract<MotionConstraint, { type: "attach" }>, time: number): MotionGraphResult {
  const check = commit(doc, changeConstraint(clip, constraint));
  if (check.error) return check;
  const current = evaluateScene(doc, time).transforms[clip.id];
  const frame = targetSocketTransform(check.doc, constraint.targetClipId, constraint.slotId, time);
  const offset = { ...toLocalPoint(frame, current), rotation: current.rotation - frame.rotation };
  return commit(doc, changeConstraint(clip, { ...constraint, offset }));
}

/** One completed gesture is one validated immutable document edit; cancelled wires never call this. */
export function connectMotionGraph(doc: StudioDoc, connection: MotionGraphConnection, time: number): MotionGraphResult {
  if (!Number.isFinite(time)) return failure(doc, "Choose a finite playhead time.");
  const graph = buildMotionGraph(doc), source = graph.nodes.find(n => n.id === connection.source), target = graph.nodes.find(n => n.id === connection.target);
  const out = source?.ports.find(p => p.id === connection.sourceHandle), input = target?.ports.find(p => p.id === connection.targetHandle);
  if (!source || !target || out?.direction !== "output" || input?.direction !== "input" || out.kind !== input.kind) return failure(doc, "These ports cannot connect.");
  const owner = source.kind === "block" ? source : target;
  const clip = doc.clips.find(c => c.id === owner.clipId)!;
  const program = editableMotion(clip);
  if (source.kind === "block" && (target.kind === "object" || target.kind === "controller")) {
    if (source.clipId !== target.clipId) return failure(doc, "Move blocks belong to their own object or character targets.");
    const block = program.blocks.find(b => b.id === source.itemId)!;
    return commit(doc, changeMotionBlock(clip, { ...block, controllerId: target.kind === "controller" ? target.itemId : undefined }));
  }
  if (target.kind === "constraint") {
    const constraint = program.constraints.find(c => c.id === target.itemId)!;
    if (constraint.type === "attach" && out.kind === "frame") return preserveAttachment(doc, clip, { ...constraint, targetClipId: source.clipId, slotId: source.kind === "socket" ? source.itemId : undefined }, time);
    if (constraint.type !== "attach" && source.clipId === target.clipId) {
      if (source.kind === "controller") return commit(doc, changeConstraint(clip, { ...constraint, targetId: source.itemId! }));
      if (source.kind === "bone" && clip.type === "rig") {
        if (constraint.type === "aim") return commit(doc, changeConstraint(clip, { ...constraint, boneId: source.itemId! }));
        const tip = clip.rig.bones.find(b => b.id === source.itemId), mid = clip.rig.bones.find(b => b.id === tip?.parentId);
        if (!tip || !mid?.parentId) return failure(doc, "Choose the end of a direct three-joint limb.");
        return commit(doc, changeConstraint(clip, { ...constraint, tipId: tip.id, midId: mid.id, rootId: mid.parentId }));
      }
    }
  }
  if (target.kind === "controller" && connection.targetHandle === "space" && out.kind === "frame") {
    const controller = program.controllers.find(c => c.id === target.itemId)!;
    const worldPoint = evaluateScene(doc, time).controllers[clip.id][controller.id];
    const space = source.clipId === clip.id && source.kind === "object" && clip.type === "rig" ? "rig" : "object";
    const next = changeController(clip, { ...controller, space, clipId: space === "object" ? source.clipId : undefined, slotId: source.kind === "socket" ? source.itemId : undefined });
    const check = commit(doc, next); if (check.error) return check;
    const local = controllerLocalPoint(check.doc, clip.id, controller.id, worldPoint, time);
    const keyed = keyMotionController(next, controller.id, time, local);
    const after = evaluateScene({ ...check.doc, clips: check.doc.clips.map(c=>c.id===clip.id?keyed:c) },time).controllers[clip.id][controller.id];
    const value = editableMotion(keyed).controllers.find(c=>c.id===controller.id)!;
    const localTime = Math.max(0,time-clip.start), rotation = controllerAt(value,localTime).rotation + worldPoint.rotation - after.rotation;
    const keys = value.keys?.rotation ?? (localTime > 0 ? [{time:0,value:value.rotation??0}] : []);
    return commit(doc, changeController(keyed,{...value,keys:{...value.keys,rotation:[...keys.filter(k=>Math.abs(k.time-localTime)>.0005),{time:localTime,value:rotation}].sort((a,b)=>a.time-b.time)}}));
  }
  return failure(doc, "This connection is not supported by the selected controls.");
}

function freshId(clip: Clip, prefix: string): string {
  const p = editableMotion(clip), ids = new Set([...p.controllers, ...p.blocks, ...p.constraints].map(x => x.id));
  let count = 1; while (ids.has(`${prefix}-copy-${count}`)) count++;
  return `${prefix}-copy-${count}`;
}

/** Inherited operations are suspended through overrides; source artwork and rig masters stay intact. */
export function editMotionGraph(doc: StudioDoc, edit: MotionGraphEdit, _time: number): MotionGraphResult {
  const node = buildMotionGraph(doc).nodes.find(n => n.id === edit.nodeId);
  if (!node) return failure(doc, "This node no longer exists.");
  const clip = doc.clips.find(c => c.id === node.clipId)!, p = editableMotion(clip);
  const controller = p.controllers.find(c => node.kind === "controller" && c.id === node.itemId);
  const block = p.blocks.find(b => node.kind === "block" && b.id === node.itemId);
  const constraint = p.constraints.find(c => node.kind === "constraint" && c.id === node.itemId);
  const item = controller ?? block ?? constraint;
  if (!item) return failure(doc, "Edit artwork, bones, and sockets in their existing canvas tools.");
  const list = controller ? "controllers" : block ? "blocks" : "constraints";
  if (edit.type === "duplicate") {
    const copyId = freshId(clip, item.id);
    const next = controller ? changeController(clip, { ...controller, id: copyId, name: `${node.label} copy` })
      : block ? changeMotionBlock(clip, { ...block, id: copyId, name: `${node.label} copy`, start: block.start + block.duration * (block.repeat ?? 1) })
        : changeConstraint(clip, { ...constraint!, id: copyId, name: `${node.label} copy`, enabled: false });
    const result = commit(doc, next);
    return result.error ? result : { ...result, nodeId: graphNodeId(clip.id, node.kind, copyId) };
  }
  if (controller) {
    if (edit.type === "toggle") return failure(doc, "Targets cannot be suspended; suspend their motion or relationships instead.");
    const next = removeMotionController(clip, controller.id);
    return next === clip ? failure(doc, node.provenance !== "scene" ? "Rig targets belong to the reusable rig and cannot be removed here." : "This target is still used by a motion or relationship.") : commit(doc, next);
  }
  if (edit.type === "toggle" || node.provenance !== "scene") {
    const enabled = edit.type === "toggle" ? (block ?? constraint)!.enabled === false : false;
    return commit(doc, block ? changeMotionBlock(clip, { ...block, enabled }) : changeConstraint(clip, { ...constraint!, enabled }));
  }
  return commit(doc, { ...clip, motion: { ...clip.motion, [list]: clip.motion?.[list]?.filter(c => c.id !== item.id) ?? [] } });
}
