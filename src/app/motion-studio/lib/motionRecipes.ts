import type { Clip, RigClip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import type { MotionConstraint } from "@/app/components/motion-studio/engine/motionTypes";
import { evaluateScene, targetSocketTransform } from "@/app/components/motion-studio/engine/motionScene";
import { validateMotionDocument } from "@/app/components/motion-studio/engine/motionValidation";
import { applyMatrix, world } from "@/app/components/motion-studio/engine/rig";
import { toLocalPoint, toWorldPoint } from "@/app/components/motion-studio/engine/transform";
import { changeConstraint, changeController, changeMotionBlock, editableMotion } from "./motionEdit";
import { graphNodeId } from "./motionGraph";

export type MotionRecipe = "target" | "path" | "lift" | "breathing" | "reach" | "aim" | "hold";
export interface MotionRecipeOptions {
  name?: string;
  duration?: number;
  repeat?: number;
  controllerId?: string;
  targetClipId?: string;
  slotId?: string;
  rootId?: string;
  midId?: string;
  tipId?: string;
  boneId?: string;
  bend?: 1 | -1;
  point?: Vec2;
}
export interface MotionRecipeResult { doc: StudioDoc; error?: string; nodeId?: string }
export const MOTION_RECIPES: { id: MotionRecipe; label: string; description: string }[] = [
  { id: "target", label: "Add target", description: "A named canvas control, ready for sparse keyframes." },
  { id: "path", label: "Move along path", description: "An editable curved travel path." },
  { id: "lift", label: "Lift and hold", description: "A restrained upward gesture with editable timing." },
  { id: "breathing", label: "Breathing", description: "A subtle vertical cycle; adjust its amount for the artwork." },
  { id: "reach", label: "Hand or foot reaches target", description: "A selected limb follows a named target." },
  { id: "aim", label: "Look toward target", description: "A selected bone aims toward a named target." },
  { id: "hold", label: "Hand holds prop", description: "Attach this prop to a selected object or grip socket." },
];

const finite = (value: number) => Number.isFinite(value) && Math.abs(value) <= 1e7;
function nextId(clip: Clip, prefix: string): string {
  const program = editableMotion(clip);
  const used = new Set([...program.controllers, ...program.blocks, ...program.constraints].map(item => item.id));
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}

/** The recipe is expanded into ordinary Doc 4 controls, never an opaque playback effect. */
export function createMotionRecipe(doc: StudioDoc, clipId: string, recipe: MotionRecipe, time: number, options: MotionRecipeOptions = {}): MotionRecipeResult {
  const clip = doc.clips.find(item => item.id === clipId);
  if (!clip) return { doc, error: "Select an object before adding motion." };
  const duration = options.duration ?? (recipe === "breathing" ? 4 : recipe === "lift" ? 1 : 2);
  const repeat = options.repeat ?? 1;
  const start = Math.max(0, time - clip.start);
  if (!finite(time) || time < 0 || time > 600 || !finite(duration) || duration <= 0 || !Number.isInteger(repeat) || repeat < 1 || repeat > 100 || start + duration * repeat > 600 || clip.start + start + duration * repeat > 600) {
    return { doc, error: "Motion must fit within 600 seconds, with a positive duration and 1–100 repeats." };
  }
  if (options.point && (!finite(options.point.x) || !finite(options.point.y))) return { doc, error: "Target coordinates must be finite." };
  if (options.name !== undefined && (typeof options.name !== "string" || options.name.length > 200)) return { doc, error: "Use a name of at most 200 characters." };
  const context: RecipeContext = { doc, clip, time, start, duration, repeat, options };
  const result = expandRecipe(context, recipe);
  if ("error" in result) return { doc, error: result.error };
  const end = recipe === "target" ? 0 : clip.start + start + duration * repeat;
  const candidate: StudioDoc = {
    ...doc, version: 4, clips: doc.clips.map(item => item.id === clipId ? result.clip : item),
    ...(doc.timeline?.duration !== undefined && end > doc.timeline.duration ? { timeline: { ...doc.timeline, duration: end } } : {}),
  };
  const errors = validateMotionDocument(candidate);
  if (errors.length) return { doc, error: errors[0] };
  return { doc: candidate, nodeId: graphNodeId(clipId, result.kind, result.id) };
}

interface RecipeContext {
  doc: StudioDoc; clip: Clip; time: number; start: number; duration: number; repeat: number; options: MotionRecipeOptions;
}
type Expanded = { clip: Clip; kind: "controller" | "block" | "constraint"; id: string } | { error: string };
function expandRecipe(context: RecipeContext, recipe: MotionRecipe): Expanded {
  const { clip, start, duration, repeat, options } = context;
  if (recipe === "target") {
    const id = nextId(clip, "target");
    const frame = evaluateScene(context.doc, context.time).transforms[clip.id];
    return { clip: changeController(clip, { id, name: options.name ?? "Motion target", space: "stage", ...(options.point ?? { x: frame.x, y: frame.y }) }), id, kind: "controller" };
  }
  if (recipe === "hold") return attachRecipe(context);
  if (recipe === "reach" || recipe === "aim") return limbRecipe(context, recipe);
  const id = nextId(clip, recipe), common = { id, start, duration, repeat, ...(options.controllerId ? { controllerId: options.controllerId } : {}) };
  if (recipe === "path") return { clip: changeMotionBlock(clip, { ...common, name: options.name ?? "Move along path", type: "path", points: [{ x: 0, y: 0 }, { x: 80, y: -40 }, { x: 160, y: 0 }], ease: { name: "inOut" } }), kind: "block", id };
  if (recipe === "lift") return { clip: changeMotionBlock(clip, { ...common, name: options.name ?? "Lift and hold", type: "transform", from: {}, to: { y: -40 }, ease: { name: "inOut" } }), kind: "block", id };
  if (recipe === "breathing") return { clip: changeMotionBlock(clip, { ...common, name: options.name ?? "Breathing", type: "oscillate", property: "y", amplitude: 2, cycles: 1 }), kind: "block", id };
  return { error: "This motion recipe is not supported." };
}

function attachRecipe({ doc, clip, time, start, duration, repeat, options }: RecipeContext): Expanded {
  if (!options.targetClipId) return { error: "Choose the object or hand socket that should hold this prop." };
  const target = doc.clips.find(item => item.id === options.targetClipId);
  if (!target || target.id === clip.id) return { error: "Choose another existing object to hold this prop." };
  if (options.slotId && (target.type !== "rig" || !target.rig.slots?.some(slot => slot.id === options.slotId))) return { error: "Choose an existing grip socket on the target character." };
  if (repeat !== 1) return { error: "Attachments use one continuous interval; add separate holds for repeated handoffs." };
  const scene = evaluateScene(doc, time), current = scene.transforms[clip.id];
  const frame = targetSocketTransform(doc, target.id, options.slotId, time);
  if (!frame.scaleX || !frame.scaleY) return { error: "The selected attachment has zero scale; choose a visible attachment frame." };
  const point = toLocalPoint(frame, current), id = nextId(clip, "hold");
  return { id, kind: "constraint", clip: changeConstraint(clip, {
    id, type: "attach", name: options.name ?? "Hand holds prop", targetClipId: target.id,
    ...(options.slotId ? { slotId: options.slotId } : {}), start, end: start + duration,
    offset: { ...point, rotation: current.rotation - frame.rotation }, followRotation: true, weight: 1,
  }) };
}

function selectLimb(clip: RigClip, options: MotionRecipeOptions): { rootId: string; midId: string; tipId: string } | undefined {
  const bones = clip.rig.bones;
  const chains = bones.flatMap(tip => {
    const mid = bones.find(item => item.id === tip.parentId), root = bones.find(item => item.id === mid?.parentId);
    return mid && root ? [{ rootId: root.id, midId: mid.id, tipId: tip.id }] : [];
  });
  if (options.rootId || options.midId || options.tipId) return chains.find(chain => chain.rootId === options.rootId && chain.midId === options.midId && chain.tipId === options.tipId);
  return chains.length === 1 ? chains[0] : undefined;
}

function limbRecipe(context: RecipeContext, recipe: "reach" | "aim"): Expanded {
  const { doc, clip, time, start, duration, repeat, options } = context;
  if (clip.type !== "rig") return { error: "Limb and gaze controls require a prepared character rig." };
  if (repeat !== 1) return { error: "Limb relationships use one continuous interval; animate their targets to repeat motion." };
  const chain = recipe === "reach" ? selectLimb(clip, options) : undefined;
  const heads = clip.rig.bones.filter(bone => bone.role === "head");
  const boneId = options.boneId ?? (heads.length === 1 ? heads[0].id : undefined);
  if (recipe === "reach" && !chain) return { error: "Choose a direct root, middle, and tip joint chain for this limb." };
  if (recipe === "aim" && !clip.rig.bones.some(bone => bone.id === boneId)) return { error: "Choose the bone that should look toward the target." };
  let next: Clip = clip, targetId = options.controllerId;
  if (targetId && !editableMotion(clip).controllers.some(control => control.id === targetId)) return { error: "Choose an existing named target on this character." };
  if (!targetId) {
    const scene = evaluateScene(doc, time), matrices = world(clip.rig, scene.poses[clip.id]);
    const matrix = matrices[recipe === "reach" ? chain!.tipId : boneId!];
    const local = applyMatrix(matrix, { x: recipe === "aim" ? 120 : 0, y: 0 });
    const point = options.point ?? toWorldPoint(scene.transforms[clip.id], { x: local.x - clip.rig.canvas.width / 2, y: local.y - clip.rig.canvas.height / 2 });
    targetId = nextId(next, "target");
    next = changeController(next, { id: targetId, name: recipe === "reach" ? "Limb target" : "Gaze target", space: "stage", ...point });
  }
  const id = nextId(next, recipe), common = { id, targetId, start, end: start + duration, weight: 1 };
  const constraint: MotionConstraint = recipe === "reach"
    ? { ...common, name: options.name ?? "Hand or foot reaches target", type: "ik", ...chain!, bend: options.bend ?? 1 }
    : { ...common, name: options.name ?? "Look toward target", type: "aim", boneId: boneId!, offset: 0 };
  return { clip: changeConstraint(next, constraint), id, kind: "constraint" };
}
