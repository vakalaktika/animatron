import type { RigAnimation, RigAsset, RigBone, RigClip, RigDelta, RigKey, RigPose } from "../types";
import { RIG_FORMAT, RIG_VERSION } from "../types";

/**
 * Mid-century Ink Rig 1: the skeleton maths, validation and clip-editing
 * operations. A TypeScript port of the shared reference runtime
 * (docs/mci-rig/mci-rig-core.cjs), kept numerically identical to it so a rig
 * posed here plays the same in Agent Torres; `rig.test.ts` checks the two
 * against each other. Matrices are SVG affine `[a, b, c, d, e, f]`
 * (`x' = a·x + c·y + e; y' = b·x + d·y + f`), composed with column vectors.
 */

export type Matrix = [number, number, number, number, number, number];

const ID = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/;
export const isRigId = (value: unknown): value is string => typeof value === "string" && ID.test(value);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e7;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const DEG = Math.PI / 180;
/** Rotation bound used when a bone declares no limits. */
const UNLIMITED = 3600;

export const RIG_LIMITS = {
  jsonBytes: 4_000_000,
  svgChars: 2_000_000,
  bones: 128,
  bindings: 256,
  slots: 128,
  animations: 64,
  keys: 10_000,
  svgElements: 3000,
  duration: 600,
} as const;

export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** Throws on a singular matrix, the way the reference does. */
export function inverse(m: Matrix): Matrix {
  const d = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(d) < 1e-10) throw new Error("Singular binding matrix.");
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}

/** translate(x, y) · rotate(degrees). */
export function matrix(x: number, y: number, degrees: number): Matrix {
  const a = degrees * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, s, -s, c, x, y];
}

export const applyMatrix = (m: Matrix, p: { x: number; y: number }) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

export const matrixString = (m: Matrix) => `matrix(${m.map((v) => Number(v.toFixed(6))).join(" ")})`;

// ----- Validation ------------------------------------------------------------

export interface RigCheck {
  ok: boolean;
  errors: string[];
}

/**
 * Structural checks from the contract: format and version, hierarchy (one
 * root, parents exist, no cycles, unique ids and roles), finite numbers,
 * limits that include rest, bindings with unique targets and invertible
 * matrices, slots, and keyframes that strictly increase within each clip.
 * Everything here is pure; the SVG subset is checked separately in
 * `rigSvg.ts` because it needs a DOM parser.
 */
export function validateRig(asset: unknown): RigCheck {
  const errors: string[] = [];
  const fail = (m: string) => errors.push(m);
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return { ok: false, errors: ["Expected an asset object."] };
  const a = asset as Record<string, unknown>;
  if (a.name !== undefined && (typeof a.name !== "string" || a.name.length > 200)) fail("Invalid asset name.");
  if (a.metadata !== undefined && (!a.metadata || typeof a.metadata !== "object" || Array.isArray(a.metadata))) fail("Metadata must be an object.");
  if (a.format !== RIG_FORMAT || a.version !== RIG_VERSION) {
    fail(
      a.format === RIG_FORMAT && typeof a.version === "number"
        ? `This rig is version ${a.version}; the studio reads Mid-century Ink Rig version ${RIG_VERSION}.`
        : "Expected mid-century-ink-rig version 1.",
    );
  }
  const canvas = a.canvas as { width?: unknown; height?: unknown } | undefined;
  if (!canvas || !finite(canvas.width) || !finite(canvas.height) || canvas.width <= 0 || canvas.height <= 0) fail("Canvas dimensions must be positive numbers.");
  if (typeof a.svg !== "string" || a.svg.length > RIG_LIMITS.svgChars || !a.svg.includes("<svg")) fail("Expected SVG artwork, up to 2 MB.");
  const rawBones = a.bones;
  if (!Array.isArray(rawBones) || rawBones.length < 1 || rawBones.length > RIG_LIMITS.bones) return { ok: false, errors: [...errors, "Expected 1–128 bones."] };
  const bones = new Map<string, RigBone>();
  const roles = new Set<string>();
  for (const raw of rawBones as Partial<RigBone>[]) {
    const b = raw;
    if (!b || !isRigId(b.id) || bones.has(b.id)) {
      fail("Bone IDs must be unique identifiers.");
      continue;
    }
    bones.set(b.id, b as RigBone);
    if (b.parentId !== null && !isRigId(b.parentId)) fail("Invalid parent for " + b.id);
    if (!b.rest || !(["x", "y", "rotation"] as const).every((k) => finite(b.rest?.[k]))) fail("Invalid rest transform for " + b.id);
    if (!finite(b.length) || b.length < 0) fail("Invalid length for " + b.id);
    if (b.role !== undefined && (typeof b.role !== "string" || !isRigId(b.role) || roles.has(b.role))) fail("Roles must be unique identifiers.");
    if (b.role) roles.add(b.role);
    if (b.limits && (!finite(b.limits.min) || !finite(b.limits.max) || b.limits.min > 0 || b.limits.max < 0 || b.limits.min > b.limits.max)) fail("Joint limits must include the rest angle for " + b.id);
  }
  if ((rawBones as Partial<RigBone>[]).filter((b) => b && b.parentId === null).length !== 1) fail("Exactly one root bone is required.");
  for (const b of bones.values()) {
    if (b.parentId !== null && !bones.has(b.parentId)) fail("Missing parent for " + b.id);
    const seen = new Set([b.id]);
    let p = b.parentId;
    while (p && bones.has(p)) {
      if (seen.has(p)) {
        fail("Bone hierarchy contains a cycle.");
        break;
      }
      seen.add(p);
      p = bones.get(p)?.parentId ?? null;
    }
  }
  const rawBindings = a.bindings;
  if (!Array.isArray(rawBindings) || rawBindings.length < 1 || rawBindings.length > RIG_LIMITS.bindings) fail("Expected 1–256 artwork bindings.");
  else {
    const ids = new Set<string>();
    const targets = new Set<string>();
    for (const b of rawBindings as Partial<RigAsset["bindings"][number]>[]) {
      if (!b || !isRigId(b.id) || ids.has(b.id) || !isRigId(b.svgId) || targets.has(b.svgId) || !isRigId(b.boneId) || !bones.has(b.boneId)) {
        fail("Bindings need unique IDs, unique SVG targets, and existing bones.");
        continue;
      }
      ids.add(b.id);
      targets.add(b.svgId);
      if (!Array.isArray(b.bindMatrix) || b.bindMatrix.length !== 6 || !b.bindMatrix.every(finite)) fail("Invalid bind matrix for " + b.id);
      else {
        try {
          inverse(b.bindMatrix);
        } catch {
          fail("Singular bind matrix for " + b.id);
        }
      }
    }
  }
  if (a.slots !== undefined) {
    const ids = new Set<string>();
    if (!Array.isArray(a.slots) || a.slots.length > RIG_LIMITS.slots) fail("Invalid attachment slots.");
    else
      for (const s of a.slots as Partial<NonNullable<RigAsset["slots"]>[number]>[]) {
        if (!s || !isRigId(s.id) || ids.has(s.id) || !isRigId(s.boneId) || !bones.has(s.boneId) || !(["x", "y", "rotation"] as const).every((k) => finite(s[k]))) fail("Invalid attachment slot.");
        else ids.add(s.id);
      }
  }
  if (!Array.isArray(a.animations) || a.animations.length > RIG_LIMITS.animations) fail("Expected an animations array, up to 64 clips.");
  else {
    const ids = new Set<string>();
    let count = 0;
    for (const anim of a.animations as Partial<RigAnimation>[]) {
      if (!anim || !isRigId(anim.id) || ids.has(anim.id) || !finite(anim.duration) || anim.duration <= 0 || anim.duration > RIG_LIMITS.duration || typeof anim.loop !== "boolean" || !Array.isArray(anim.tracks) || anim.tracks.length > RIG_LIMITS.bones) {
        fail("Invalid animation clip.");
        continue;
      }
      if (anim.name !== undefined && typeof anim.name !== "string") fail("Invalid animation clip.");
      ids.add(anim.id);
      const tracks = new Set<string>();
      for (const t of anim.tracks as Partial<RigAnimation["tracks"][number]>[]) {
        if (!t || !isRigId(t.boneId) || !bones.has(t.boneId) || tracks.has(t.boneId) || !Array.isArray(t.keys) || !t.keys.length || t.keys.length > RIG_LIMITS.keys) {
          fail("Invalid animation track.");
          continue;
        }
        tracks.add(t.boneId);
        let previous = -1;
        for (const k of t.keys as Partial<RigKey>[]) {
          count++;
          const time = k && finite(k.time) ? k.time : null;
          if (!k || time === null || !(["x", "y", "rotation"] as const).every((f) => finite(k[f])) || time < 0 || time > anim.duration || time <= previous || !["linear", "hold"].includes(k.easing as string)) {
            fail("Invalid or unsorted animation keyframe.");
          }
          previous = time ?? previous;
        }
      }
    }
    if (count > RIG_LIMITS.keys) fail("Asset exceeds 10000 animation keyframes.");
  }
  return { ok: !errors.length, errors: [...new Set(errors)] };
}

// ----- Evaluation ------------------------------------------------------------

const bonesById = (asset: RigAsset) => new Map(asset.bones.map((b) => [b.id, b]));
const REST: RigDelta = { x: 0, y: 0, rotation: 0 };
/**
 * A bone's delta in a pose, rest when absent. Always an own-property read, so
 * a bone named `constructor` or `toString` is just a key (the reference uses
 * prototype-less objects; these records travel through MotionValues, which
 * need ordinary objects, so the guard lives here instead).
 */
export const poseOf = (pose: RigPose, boneId: string): RigDelta => (Object.hasOwn(pose, boneId) ? pose[boneId] : REST);

/** The clip's local time folded into its range: modulo when it loops, clamped otherwise. */
export function animationTime(anim: RigAnimation, seconds: number): number {
  return anim.loop ? ((seconds % anim.duration) + anim.duration) % anim.duration : clamp(seconds, 0, anim.duration);
}

/**
 * The pose an animation gives at `seconds`: each track interpolated between
 * its neighbouring keys (linear, or held), holding the first key before the
 * range and the last after it. Bones without a track are left out (at rest).
 */
export function sample(asset: RigAsset, animationId: string, seconds: number): RigPose {
  const anim = asset.animations.find((x) => x.id === animationId);
  const pose: RigPose = {};
  if (!anim) return pose;
  const time = animationTime(anim, seconds);
  for (const track of anim.tracks) {
    const keys = track.keys;
    let left = keys[0];
    let right = left;
    for (const k of keys) {
      if (k.time <= time) left = k;
      if (k.time >= time) {
        right = k;
        break;
      }
      right = k;
    }
    const f = right.time === left.time || left.easing === "hold" ? 0 : clamp((time - left.time) / (right.time - left.time), 0, 1);
    pose[track.boneId] = { x: left.x + (right.x - left.x) * f, y: left.y + (right.y - left.y) * f, rotation: left.rotation + (right.rotation - left.rotation) * f };
  }
  return pose;
}

const limitOf = (b: RigBone, side: "min" | "max") => b.limits?.[side] ?? (side === "min" ? -UNLIMITED : UNLIMITED);

/** A bone's rotation delta clamped to its limits. */
export const clampRotation = (b: RigBone, degrees: number) => clamp(degrees, limitOf(b, "min"), limitOf(b, "max"));

/** Every bone's world matrix for a pose (deltas from rest, clamped to limits). */
export function world(asset: RigAsset, pose: RigPose = {}): Record<string, Matrix> {
  const map = bonesById(asset);
  const result: Record<string, Matrix> = {};
  const visit = (id: string): Matrix => {
    if (Object.hasOwn(result, id)) return result[id];
    const b = map.get(id);
    if (!b) return IDENTITY_MATRIX;
    const p = poseOf(pose, id);
    const angle = clampRotation(b, p.rotation || 0);
    const local = matrix(b.rest.x + (p.x || 0), b.rest.y + (p.y || 0), b.rest.rotation + angle);
    const m = b.parentId === null ? local : multiply(visit(b.parentId), local);
    result[id] = m;
    return m;
  };
  for (const b of asset.bones) visit(b.id);
  return result;
}

/** The transform each bound SVG group is wrapped in: posed bone world · bind matrix. */
export function transforms(asset: RigAsset, pose: RigPose = {}): Record<string, Matrix> {
  const w = world(asset, pose);
  const out: Record<string, Matrix> = {};
  for (const binding of asset.bindings) out[binding.svgId] = multiply(w[binding.boneId], binding.bindMatrix);
  return out;
}

/** Every binding recomputed as the inverse of its bone's rest world (groups authored in document coordinates). */
export function rebind(asset: RigAsset): RigAsset {
  const w = world(asset);
  return { ...asset, bindings: asset.bindings.map((b) => ({ ...b, bindMatrix: inverse(w[b.boneId]) })) };
}

/**
 * CCD inverse kinematics: turns the ancestors of `tipId` (never the stage
 * root) so that bone's origin reaches `target`, within every joint's limits.
 */
export function solve(asset: RigAsset, inputPose: RigPose, tipId: string, target: { x: number; y: number }, iterations = 18): RigPose {
  const pose: RigPose = { ...inputPose };
  const map = bonesById(asset);
  const tip = map.get(tipId);
  if (!tip || !finite(target.x) || !finite(target.y)) return pose;
  const chain: string[] = [];
  let id = tip.parentId;
  while (id) {
    chain.push(id);
    id = map.get(id)?.parentId ?? null;
  }
  for (let i = 0; i < iterations; i++) {
    for (const joint of chain) {
      const w = world(asset, pose);
      const origin = applyMatrix(w[joint], { x: 0, y: 0 });
      const end = applyMatrix(w[tipId], { x: 0, y: 0 });
      const u = Math.atan2(end.y - origin.y, end.x - origin.x);
      const v = Math.atan2(target.y - origin.y, target.x - origin.x);
      const delta = ((((v - u) * 180) / Math.PI + 540) % 360) - 180;
      const b = map.get(joint);
      if (!b || b.parentId === null) continue;
      const old = poseOf(pose, joint);
      pose[joint] = { ...old, rotation: clamp((old.rotation || 0) + delta, b.limits?.min ?? -360, b.limits?.max ?? 360) };
    }
  }
  return pose;
}

/** Saves every bone's current delta as a linear key at `time` (replacing a key already there). */
export function record(asset: RigAsset, animationId: string, time: number, pose: RigPose): RigAsset {
  const anim = asset.animations.find((x) => x.id === animationId);
  if (!anim) throw new Error("Select an animation before recording.");
  const at = clamp(time, 0, anim.duration);
  const keyed = (b: RigBone, track: RigAnimation["tracks"][number]) => {
    const p = poseOf(pose, b.id);
    const key: RigKey = { time: at, x: p.x || 0, y: p.y || 0, rotation: clampRotation(b, p.rotation || 0), easing: "linear" };
    return { ...track, keys: [...track.keys.filter((k) => Math.abs(k.time - at) > 1e-6), key].sort((l, r) => l.time - r.time) };
  };
  const map = bonesById(asset);
  // Existing tracks keep their order; bones without one are appended in bone order.
  const existing = anim.tracks.map((t) => {
    const bone = map.get(t.boneId);
    return bone ? keyed(bone, t) : t;
  });
  const added = asset.bones.filter((b) => !anim.tracks.some((t) => t.boneId === b.id)).map((b) => keyed(b, { boneId: b.id, keys: [] }));
  return replaceAnimation(asset, { ...anim, tracks: [...existing, ...added] });
}

/** Which preset actions this skeleton's roles allow. */
export function compatibleActions(asset: RigAsset): { nod: boolean; wave: boolean } {
  const roles = new Set(asset.bones.map((b) => b.role));
  return { nod: roles.has("head"), wave: roles.has("arm.left.upper") && roles.has("arm.left.forearm") && roles.has("arm.left.hand") };
}

/** Adds (or replaces) the shared `nod` or `wave` clip; throws when the roles are missing. */
export function preset(asset: RigAsset, kind: "nod" | "wave"): RigAsset {
  if (!compatibleActions(asset)[kind]) throw new Error("This skeleton lacks the roles required for " + kind + ".");
  const role = (r: string) => asset.bones.find((b) => b.role === r)?.id ?? "";
  const track = (r: string, values: [number, number][]) => ({ boneId: role(r), keys: values.map(([time, rotation]) => ({ time, x: 0, y: 0, rotation, easing: "linear" as const })) });
  const anim: RigAnimation =
    kind === "nod"
      ? { id: "nod", duration: 2, loop: true, tracks: [track("head", [[0, 0], [0.4, 12], [0.8, 0], [1.2, 12], [1.6, 0], [2, 0]])] }
      : {
          id: "wave",
          duration: 2,
          loop: true,
          tracks: [
            track("arm.left.upper", [[0, 0], [0.4, -40], [1.6, -40], [2, 0]]),
            track("arm.left.forearm", [[0, 0], [0.4, -70], [0.7, -95], [1, -65], [1.3, -95], [1.6, -70], [2, 0]]),
            track("arm.left.hand", [[0, 0], [0.4, 0], [0.7, 20], [1, -20], [1.3, 20], [1.6, 0], [2, 0]]),
          ],
        };
  return { ...asset, animations: [...asset.animations.filter((x) => x.id !== anim.id), anim] };
}

// ----- Clip evaluation -------------------------------------------------------

/** The animation a rig clip plays, if it names one that exists. */
export function activeAnimation(clip: RigClip): RigAnimation | null {
  return clip.animationId ? (clip.rig.animations.find((a) => a.id === clip.animationId) ?? null) : null;
}

/** The pose the clip shows at clock time `t`: its animation sampled from the clip start, or its manual pose. */
export function rigPoseAt(clip: RigClip, t: number): RigPose {
  const anim = activeAnimation(clip);
  if (!anim) return clip.pose;
  return sample(clip.rig, anim.id, Math.max(0, t - clip.start));
}

/** Seconds the rig occupies on the clock: its animation's length, or a nominal second for a still pose. */
export const RIG_STILL_SECONDS = 1;
export function rigDuration(clip: RigClip): number {
  return activeAnimation(clip)?.duration ?? RIG_STILL_SECONDS;
}

export const rigLoops = (clip: RigClip) => activeAnimation(clip)?.loop === true;

// ----- Editing: skeleton -----------------------------------------------------

export const replaceBone = (asset: RigAsset, next: RigBone): RigAsset => ({ ...asset, bones: asset.bones.map((b) => (b.id === next.id ? next : b)) });

export const replaceAnimation = (asset: RigAsset, next: RigAnimation): RigAsset => ({ ...asset, animations: asset.animations.map((a) => (a.id === next.id ? next : a)) });

/** The bone's rest-pose world matrix. */
export const restWorld = (asset: RigAsset, boneId: string): Matrix => world(asset)[boneId] ?? IDENTITY_MATRIX;

/**
 * Bindings for `next` recomputed so the neutral drawing stays exactly where
 * it was under `previous`: `newRest · newBind = oldRest · oldBind`. This is
 * the contract's rest-joint rule in its general form; for groups authored
 * in document coordinates it comes out as `inverse(newRestWorld)`, the same
 * as the reference `rebind`.
 */
export function rebindPreserving(previous: RigAsset, next: RigAsset): RigAsset {
  const before = world(previous);
  const after = world(next);
  return {
    ...next,
    bindings: next.bindings.map((b) => {
      const old = previous.bindings.find((p) => p.id === b.id) ?? b;
      const oldRest = before[old.boneId] ?? IDENTITY_MATRIX;
      const newRest = after[b.boneId] ?? IDENTITY_MATRIX;
      return { ...b, bindMatrix: multiply(inverse(newRest), multiply(oldRest, old.bindMatrix)) };
    }),
  };
}

/** Changes a bone's rest transform or length while the artwork and every descendant stay put on the canvas. */
export function editRestJoint(asset: RigAsset, boneId: string, patch: Partial<Pick<RigBone, "rest" | "length" | "limits" | "role" | "name">>): RigAsset {
  const bone = asset.bones.find((b) => b.id === boneId);
  if (!bone) return asset;
  const moved = replaceBone(asset, { ...bone, ...patch });
  if (!patch.rest) return moved;
  // Children keep their world rest: re-express each child's rest in the new parent frame.
  const oldParent = world(asset)[boneId];
  const newParent = world(moved)[boneId];
  const fix = multiply(inverse(newParent), oldParent);
  const withChildren: RigAsset = {
    ...moved,
    bones: moved.bones.map((b) => {
      if (b.parentId !== boneId) return b;
      const local = multiply(fix, matrix(b.rest.x, b.rest.y, b.rest.rotation));
      return { ...b, rest: { x: local[4], y: local[5], rotation: (Math.atan2(local[1], local[0]) / DEG + 540) % 360 - 180 } };
    }),
  };
  return rebindPreserving(asset, withChildren);
}

/** A bone id not already taken, from a readable stem. */
export function freeBoneId(asset: RigAsset, stem = "bone"): string {
  const base = stem.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^[^A-Za-z]+/, "") || "bone";
  const taken = new Set(asset.bones.map((b) => b.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Adds a child bone at the parent's tip, pointing the same way. */
export function addBone(asset: RigAsset, parentId: string, length = 60): RigAsset {
  const parent = asset.bones.find((b) => b.id === parentId);
  if (!parent) return asset;
  const bone: RigBone = { id: freeBoneId(asset), parentId, rest: { x: parent.length, y: 0, rotation: 0 }, length, limits: { min: -90, max: 90 } };
  return { ...asset, bones: [...asset.bones, bone] };
}

/**
 * Removes a bone (never the root). Its children move up to its parent with
 * their world rest preserved, its artwork and slots follow to the parent
 * with the drawing kept in place, and its animation tracks are dropped.
 */
export function removeBone(asset: RigAsset, boneId: string): RigAsset {
  const bone = asset.bones.find((b) => b.id === boneId);
  if (!bone || bone.parentId === null) return asset;
  const parentId = bone.parentId;
  const w = world(asset);
  const gone = w[boneId];
  const next: RigAsset = {
    ...asset,
    bones: asset.bones
      .filter((b) => b.id !== boneId)
      .map((b) => {
        if (b.parentId !== boneId) return b;
        const local = multiply(inverse(w[parentId]), multiply(gone, matrix(b.rest.x, b.rest.y, b.rest.rotation)));
        return { ...b, parentId, rest: { x: local[4], y: local[5], rotation: (Math.atan2(local[1], local[0]) / DEG + 540) % 360 - 180 } };
      }),
    bindings: asset.bindings.map((b) => (b.boneId === boneId ? { ...b, boneId: parentId } : b)),
    slots: asset.slots?.map((s) => {
      if (s.boneId !== boneId) return s;
      const local = multiply(inverse(w[parentId]), multiply(gone, matrix(s.x, s.y, s.rotation)));
      return { ...s, boneId: parentId, x: local[4], y: local[5], rotation: (Math.atan2(local[1], local[0]) / DEG + 540) % 360 - 180 };
    }),
    animations: asset.animations.map((a) => ({ ...a, tracks: a.tracks.filter((t) => t.boneId !== boneId) })),
  };
  return rebindPreserving(asset, next);
}

/** Binds an SVG group to a different bone, recomputing its matrix so the neutral drawing does not move. */
export function reassignBinding(asset: RigAsset, bindingId: string, boneId: string): RigAsset {
  const binding = asset.bindings.find((b) => b.id === bindingId);
  if (!binding || binding.boneId === boneId || !asset.bones.some((b) => b.id === boneId)) return asset;
  const next: RigAsset = { ...asset, bindings: asset.bindings.map((b) => (b.id === bindingId ? { ...b, boneId } : b)) };
  return rebindPreserving(asset, next);
}

// ----- Editing: pose and animation ------------------------------------------

/** Sets one bone's delta in a manual pose (rotation clamped to its limits). */
export function setPoseDelta(asset: RigAsset, pose: RigPose, boneId: string, delta: Partial<RigDelta>): RigPose {
  const bone = asset.bones.find((b) => b.id === boneId);
  if (!bone) return pose;
  const old = poseOf(pose, boneId);
  const next = { ...old, ...delta };
  return { ...pose, [boneId]: { ...next, rotation: clampRotation(bone, next.rotation) } };
}

/** The pose with every delta clamped to its bone's limits and rest-only bones dropped. */
export function tidyPose(asset: RigAsset, pose: RigPose): RigPose {
  const out: RigPose = {};
  for (const b of asset.bones) {
    if (!Object.hasOwn(pose, b.id)) continue;
    const p = pose[b.id];
    const d = { x: p.x || 0, y: p.y || 0, rotation: clampRotation(b, p.rotation || 0) };
    if (d.x !== 0 || d.y !== 0 || d.rotation !== 0) out[b.id] = d;
  }
  return out;
}

/** An animation id not already taken. */
export function freeAnimationId(asset: RigAsset, stem = "clip"): string {
  const base = stem.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^[^A-Za-z]+/, "") || "clip";
  const taken = new Set(asset.animations.map((a) => a.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function addAnimation(asset: RigAsset, name = "Clip", duration = 2, loop = true): { asset: RigAsset; id: string } {
  const id = freeAnimationId(asset, name.toLowerCase());
  return { asset: { ...asset, animations: [...asset.animations, { id, name, duration, loop, tracks: [] }] }, id };
}

export const removeAnimation = (asset: RigAsset, id: string): RigAsset => ({ ...asset, animations: asset.animations.filter((a) => a.id !== id) });

/** Changes a clip's length, rescaling every key time with it (the contract's rule). */
export function setAnimationDuration(asset: RigAsset, animationId: string, duration: number): RigAsset {
  const anim = asset.animations.find((a) => a.id === animationId);
  if (!anim) return asset;
  const next = clamp(duration, 0.1, RIG_LIMITS.duration);
  const f = next / anim.duration;
  return replaceAnimation(asset, {
    ...anim,
    duration: next,
    // Full precision: rounding could merge two keys and break the strict order.
    tracks: anim.tracks.map((t) => ({ ...t, keys: t.keys.map((k) => ({ ...k, time: k.time * f })) })),
  });
}

/** Saves one bone's delta as a key at `time`, replacing a key of that bone already there; other bones are untouched. */
export function upsertKey(asset: RigAsset, animationId: string, boneId: string, time: number, delta: RigDelta, easing?: RigKey["easing"]): RigAsset {
  const anim = asset.animations.find((a) => a.id === animationId);
  const bone = asset.bones.find((b) => b.id === boneId);
  if (!anim || !bone) return asset;
  const at = Number(clamp(time, 0, anim.duration).toFixed(4));
  const track = anim.tracks.find((t) => t.boneId === boneId) ?? { boneId, keys: [] };
  const existing = track.keys.find((k) => Math.abs(k.time - at) <= 1e-6);
  const key: RigKey = { time: at, x: delta.x || 0, y: delta.y || 0, rotation: clampRotation(bone, delta.rotation || 0), easing: easing ?? existing?.easing ?? "linear" };
  const keys = [...track.keys.filter((k) => Math.abs(k.time - at) > 1e-6), key].sort((l, r) => l.time - r.time);
  const tracks = anim.tracks.some((t) => t.boneId === boneId) ? anim.tracks.map((t) => (t.boneId === boneId ? { ...t, keys } : t)) : [...anim.tracks, { boneId, keys }];
  return replaceAnimation(asset, { ...anim, tracks });
}

/** Drops a bone's key at `time`; a track left with no keys disappears. */
export function removeKey(asset: RigAsset, animationId: string, boneId: string, time: number): RigAsset {
  const anim = asset.animations.find((a) => a.id === animationId);
  if (!anim) return asset;
  const tracks = anim.tracks
    .map((t) => (t.boneId === boneId ? { ...t, keys: t.keys.filter((k) => Math.abs(k.time - time) > 1e-6) } : t))
    .filter((t) => t.keys.length > 0);
  return replaceAnimation(asset, { ...anim, tracks });
}

const KEY_GAP = 0.01;

/** The tracks a key drag at `time` moves: the one bone's when it has a key there, else every track with one. */
function retimedTracks(anim: RigAnimation, boneId: string | null, time: number): RigAnimation["tracks"] {
  const at = (t: RigAnimation["tracks"][number]) => t.keys.some((k) => Math.abs(k.time - time) <= 1e-6);
  const own = boneId !== null ? anim.tracks.filter((t) => t.boneId === boneId && at(t)) : [];
  return own.length ? own : anim.tracks.filter(at);
}

/**
 * Where a key at `time` lands when dragged to `to`: kept strictly between
 * its neighbours on every track it moves on, and inside the clip. Returns
 * `time` itself when the keys are too crowded to move.
 */
export function retimedKeyTime(anim: RigAnimation, boneId: string | null, time: number, to: number): number {
  let lo = 0;
  let hi = anim.duration;
  for (const t of retimedTracks(anim, boneId, time)) {
    const i = t.keys.findIndex((k) => Math.abs(k.time - time) <= 1e-6);
    if (i > 0) lo = Math.max(lo, t.keys[i - 1].time + KEY_GAP);
    if (i < t.keys.length - 1) hi = Math.min(hi, t.keys[i + 1].time - KEY_GAP);
  }
  if (hi < lo) return time;
  return Number(clamp(to, lo, hi).toFixed(4));
}

/**
 * Moves the keys at `time` to `to`: the one bone's key when `boneId` names a
 * bone that has a key there, otherwise every track's key at that time, all
 * to the same clamped moment (see `retimedKeyTime`).
 */
export function retimeKeys(asset: RigAsset, animationId: string, boneId: string | null, time: number, to: number): RigAsset {
  const anim = asset.animations.find((a) => a.id === animationId);
  if (!anim) return asset;
  const next = retimedKeyTime(anim, boneId, time, to);
  if (next === time) return asset;
  const moving = new Set(retimedTracks(anim, boneId, time).map((t) => t.boneId));
  const tracks = anim.tracks.map((t) => (moving.has(t.boneId) ? { ...t, keys: t.keys.map((k) => (Math.abs(k.time - time) <= 1e-6 ? { ...k, time: next } : k)) } : t));
  return replaceAnimation(asset, { ...anim, tracks });
}

/** Every distinct key time in the clip, ascending. */
export function keyTimes(anim: RigAnimation): number[] {
  return [...new Set(anim.tracks.flatMap((t) => t.keys.map((k) => k.time)))].sort((a, b) => a - b);
}

/** Bones in tree order, each with its depth, for a list view. */
export function boneRows(asset: RigAsset): { bone: RigBone; depth: number }[] {
  const rows: { bone: RigBone; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const bone of asset.bones) {
      if (bone.parentId !== parentId || seen.has(bone.id)) continue;
      seen.add(bone.id);
      rows.push({ bone, depth });
      walk(bone.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const bone of asset.bones) if (!seen.has(bone.id)) rows.push({ bone, depth: 0 });
  return rows;
}

/** A readable label for a bone: its name, else its role, else its id. */
export const boneLabel = (b: RigBone) => b.name || b.role || b.id;
