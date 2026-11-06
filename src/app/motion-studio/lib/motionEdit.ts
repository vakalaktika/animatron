import type { Clip, PropKey, RigClip, Vec2 } from "@/app/components/motion-studio/types";
import type { MotionBlock, MotionConstraint, MotionController, MotionProgram } from "@/app/components/motion-studio/engine/motionTypes";
import { keyValue } from "@/app/components/motion-studio/engine/keys";

const merge = <T extends { id: string }>(base: T[] = [], overrides: T[] = []): T[] => [...new Map([...base, ...overrides].map(item => [item.id, item])).values()];

/** Instance edits override portable controls without altering the source rig. */
export function editableMotion(clip: Clip): Required<MotionProgram> {
  const base = clip.type === "rig" ? clip.rig.motion : undefined;
  return {
    controllers: merge(base?.controllers, clip.motion?.controllers),
    blocks: merge(base?.blocks, clip.motion?.blocks),
    constraints: merge(base?.constraints, clip.motion?.constraints),
  };
}

function nextId(clip: Clip, prefix: string): string {
  const program = editableMotion(clip);
  const ids = new Set([...program.controllers, ...program.blocks, ...program.constraints].map(item => item.id));
  let suffix = 1;
  while (ids.has(`${prefix}-${suffix}`)) suffix++;
  return `${prefix}-${suffix}`;
}

export function changeController<T extends Clip>(clip: T, control: MotionController): T {
  return { ...clip, motion: { ...clip.motion, controllers: merge(clip.motion?.controllers, [control]) } };
}

export function changeMotionBlock<T extends Clip>(clip: T, block: MotionBlock): T {
  return { ...clip, motion: { ...clip.motion, blocks: merge(clip.motion?.blocks, [block]) } };
}

export function changeConstraint<T extends Clip>(clip: T, constraint: MotionConstraint): T {
  return { ...clip, motion: { ...clip.motion, constraints: merge(clip.motion?.constraints, [constraint]) } };
}

export function addMotionPath<T extends Clip>(clip: T, local: number): T {
  return changeMotionBlock(clip, { id: nextId(clip, "path"), name: "Move along path", type: "path", start: Math.max(0, local), duration: 1,
    points: [{ x: 0, y: 0 }, { x: 80, y: -40 }, { x: 160, y: 0 }], ease: { name: "inOut" } });
}

export function addMotionController<T extends Clip>(clip: T, point: Vec2, name = "Target"): T {
  return changeController(clip, { id: nextId(clip, "target"), name, space: "stage", ...point });
}

export function controllerAt(controller: MotionController, local: number): Vec2 & { rotation: number } {
  return { x: controller.keys?.x?.length ? keyValue(controller.keys.x, local) : controller.x,
    y: controller.keys?.y?.length ? keyValue(controller.keys.y, local) : controller.y,
    rotation: controller.keys?.rotation?.length ? keyValue(controller.keys.rotation, local) : controller.rotation ?? 0 };
}

function keyTrack(keys: PropKey[] | undefined, local: number, value: number, baseline: number): PropKey[] {
  const at = Math.max(0, Math.min(600, Math.round(local * 1000) / 1000));
  const existing = keys ?? (at > 0 ? [{ time: 0, value: baseline, ease: { name: "inOut" } as const }] : []);
  const prior = existing.find(key => Math.abs(key.time - at) < 0.0005);
  return [...existing.filter(key => Math.abs(key.time - at) >= 0.0005), { time: at, value, ease: prior?.ease ?? { name: "inOut" } }].sort((a, b) => a.time - b.time);
}

export function keyMotionController<T extends Clip>(clip: T, id: string, clock: number, point: Vec2): T {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return clip;
  const control = editableMotion(clip).controllers.find(item => item.id === id);
  if (!control) return clip;
  return changeController(clip, { ...control, keys: { ...control.keys,
    x: keyTrack(control.keys?.x, clock - clip.start, point.x, control.x),
    y: keyTrack(control.keys?.y, clock - clip.start, point.y, control.y) } });
}

export function removeMotionController<T extends Clip>(clip: T, id: string): T {
  const program = editableMotion(clip);
  if (program.constraints.some(item => "targetId" in item && item.targetId === id) || program.blocks.some(item => item.controllerId === id)) return clip;
  if (clip.type === "rig" && clip.rig.motion?.controllers?.some(item => item.id === id)) return clip;
  return { ...clip, motion: { ...clip.motion, controllers: clip.motion?.controllers?.filter(item => item.id !== id) ?? [] } };
}

/** Move the corresponding x/y/rotation keys together; collisions never erase keys. */
export function retimeControllerKey<T extends Clip>(clip:T,id:string,from:number,to:number):T {
  if(!Number.isFinite(to)||to<0||to>600)return clip;
  const control=editableMotion(clip).controllers.find(c=>c.id===id);
  if(!control?.keys)return clip;
  const entries=Object.entries(control.keys).map(([axis,track])=>[axis,track?.map(k=>Math.abs(k.time-from)<.0005?{...k,time:to}:k).sort((a,b)=>a.time-b.time)] as const);
  if(entries.some(([,track])=>track?.some((k,i)=>i>0&&k.time-track[i-1].time<.001)))return clip;
  return changeController(clip,{...control,keys:Object.fromEntries(entries)});
}

export function removeControllerKey<T extends Clip>(clip:T,id:string,at:number):T {
  const control=editableMotion(clip).controllers.find(c=>c.id===id);
  if(!control?.keys)return clip;
  const keys=Object.fromEntries(Object.entries(control.keys).map(([axis,track])=>[axis,track?.filter(k=>Math.abs(k.time-at)>=.0005)]).filter(([,track])=>Array.isArray(track)&&track.length));
  return changeController(clip,{...control,keys});
}

export function retimeMotionBlock<T extends Clip>(clip: T, id: string, start: number, duration: number): T {
  if (!Number.isFinite(start) || !Number.isFinite(duration) || start < 0 || duration <= 0 || start + duration > 600) return clip;
  const block = editableMotion(clip).blocks.find(item => item.id === id);
  return block ? changeMotionBlock(clip, { ...block, start, duration }) : clip;
}

/** Change one influence and proportionally redistribute the others; topology stays intact. */
export function changeMeshWeight(clip: RigClip, meshId: string, vertexIndex: number, boneId: string, value: number): RigClip {
  const mesh = clip.rig.meshes?.find(item => item.id === meshId);
  const vertex = mesh?.vertices[vertexIndex];
  if (!vertex || !vertex.weights.some(item => item.boneId === boneId) || !Number.isFinite(value) || value <= 0 || value > 1 || (vertex.weights.length > 1 && value >= 1)) return clip;
  if (vertex.weights.length === 1) return clip;
  const others = vertex.weights.filter(item => item.boneId !== boneId).reduce((sum, item) => sum + item.weight, 0);
  if (others <= 0) return clip;
  const weights = vertex.weights.map(item => ({ ...item, weight: item.boneId === boneId ? value : item.weight / others * (1 - value) }));
  return { ...clip, rig: { ...clip.rig, meshes: clip.rig.meshes!.map(item => item.id !== meshId ? item : { ...item, vertices: item.vertices.map((point, index) => index === vertexIndex ? { ...point, weights } : point) }) } };
}
