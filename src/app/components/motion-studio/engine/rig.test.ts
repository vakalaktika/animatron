import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RigAnimation, RigAsset, RigClip, RigPose } from "../types";
import {
  addAnimation,
  addBone,
  animationTime,
  applyMatrix,
  compatibleActions,
  editRestJoint,
  inverse,
  keyTimes,
  matrix,
  multiply,
  poseOf,
  preset,
  reassignBinding,
  rebind,
  rebindPreserving,
  record,
  removeBone,
  removeKey,
  retimedKeyTime,
  retimeKeys,
  rigDuration,
  rigPoseAt,
  sample,
  setAnimationDuration,
  setPoseDelta,
  solve,
  transforms,
  upsertKey,
  validateRig,
  world,
  type Matrix,
} from "./rig";

const DOCS = path.resolve(__dirname, "../../../../../docs/mci-rig");
const fixture = (): RigAsset => JSON.parse(readFileSync(path.join(DOCS, "example-character.mci.json"), "utf8")) as RigAsset;

interface Reference {
  validate: (a: unknown) => { ok: boolean; errors: string[] };
  sample: (a: RigAsset, id: string, s: number) => RigPose;
  world: (a: RigAsset, p?: RigPose) => Record<string, Matrix>;
  transforms: (a: RigAsset, p?: RigPose) => Record<string, Matrix>;
  rebind: (a: RigAsset) => RigAsset;
  solve: (a: RigAsset, p: RigPose, tip: string, target: { x: number; y: number }, n?: number) => RigPose;
  record: (a: RigAsset, id: string, t: number, p: RigPose) => RigAsset;
  compatibleActions: (a: RigAsset) => { nod: boolean; wave: boolean };
  preset: (a: RigAsset, kind: "nod" | "wave") => RigAsset;
}
// The shared reference runtime, loaded as CommonJS: the port must agree with it.
const ref = createRequire(__filename)(path.join(DOCS, "mci-rig-core.cjs")) as Reference;

const close = (a: number[], b: number[], digits = 9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
const closeMap = (a: Record<string, Matrix>, b: Record<string, Matrix>) => {
  expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  for (const k of Object.keys(a)) close(a[k], b[k]);
};

describe("matrices", () => {
  it("multiplies and inverts in SVG's affine convention", () => {
    const m = matrix(10, 20, 30);
    const p = applyMatrix(m, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(10 + Math.cos(Math.PI / 6));
    expect(p.y).toBeCloseTo(20 + Math.sin(Math.PI / 6));
    close(multiply(m, inverse(m)), [1, 0, 0, 1, 0, 0]);
    expect(() => inverse([1, 2, 2, 4, 0, 0])).toThrow(/Singular/);
  });
});

describe("validateRig", () => {
  const asset = fixture();

  it("accepts the cross-tool fixture, as the reference does", () => {
    expect(validateRig(asset)).toEqual({ ok: true, errors: [] });
    expect(ref.validate(asset).ok).toBe(true);
  });

  it.each([
    ["an unsupported version", { ...asset, version: 2 }, /version 2/],
    ["a studio document in disguise", { version: 2, name: "x", stage: {}, clips: [] }, /mid-century-ink-rig/],
    ["a missing parent", { ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, parentId: "nowhere" } : b)) }, /Missing parent/],
    ["a cycle", { ...asset, bones: asset.bones.map((b) => (b.id === "root" ? { ...b, parentId: "torso" } : b)) }, /root bone|cycle/],
    ["two roots", { ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, parentId: null } : b)) }, /Exactly one root/],
    ["repeated bone ids", { ...asset, bones: [...asset.bones, asset.bones[1]] }, /unique identifiers/],
    ["repeated roles", { ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, role: "torso" } : b)) }, /Roles must be unique/],
    ["a non-finite number", { ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, length: Number.NaN } : b)) }, /Invalid length/],
    ["limits that exclude rest", { ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, limits: { min: 10, max: 20 } } : b)) }, /include the rest angle/],
    ["a singular bind matrix", { ...asset, bindings: asset.bindings.map((b, i) => (i === 0 ? { ...b, bindMatrix: [0, 0, 0, 0, 1, 1] } : b)) }, /Singular bind matrix/],
    ["a repeated binding target", { ...asset, bindings: [...asset.bindings, { ...asset.bindings[0], id: "dup" }] }, /unique SVG targets/],
    ["a binding to a missing bone", { ...asset, bindings: asset.bindings.map((b, i) => (i === 0 ? { ...b, boneId: "ghost" } : b)) }, /existing bones/],
    ["no bindings", { ...asset, bindings: [] }, /1–256 artwork bindings/],
    ["a slot on a missing bone", { ...asset, slots: [{ id: "s", boneId: "ghost", x: 0, y: 0, rotation: 0 }] }, /Invalid attachment slot/],
    ["unsorted keys", { ...asset, animations: [{ id: "a", duration: 2, loop: true, tracks: [{ boneId: "head", keys: [{ time: 1, x: 0, y: 0, rotation: 0, easing: "linear" }, { time: 0.5, x: 0, y: 0, rotation: 0, easing: "linear" }] }] }] }, /unsorted/],
    ["a key past the end", { ...asset, animations: [{ id: "a", duration: 2, loop: true, tracks: [{ boneId: "head", keys: [{ time: 3, x: 0, y: 0, rotation: 0, easing: "linear" }] }] }] }, /keyframe/],
    ["a bad easing", { ...asset, animations: [{ id: "a", duration: 2, loop: true, tracks: [{ boneId: "head", keys: [{ time: 0, x: 0, y: 0, rotation: 0, easing: "bounce" }] }] }] }, /keyframe/],
    ["two tracks for one bone", { ...asset, animations: [{ id: "a", duration: 2, loop: true, tracks: [{ boneId: "head", keys: [{ time: 0, x: 0, y: 0, rotation: 0, easing: "hold" }] }, { boneId: "head", keys: [{ time: 0, x: 0, y: 0, rotation: 0, easing: "hold" }] }] }] }, /Invalid animation track/],
    ["a clip longer than ten minutes", { ...asset, animations: [{ id: "a", duration: 601, loop: false, tracks: [] }] }, /Invalid animation clip/],
    ["too many bones", { ...asset, bones: Array.from({ length: 129 }, (_, i) => ({ id: `b${i}`, parentId: i ? "b0" : null, rest: { x: 0, y: 0, rotation: 0 }, length: 1 })) }, /1–128 bones/],
  ])("rejects %s and agrees with the reference", (_what, bad, pattern) => {
    const mine = validateRig(bad);
    expect(mine.ok).toBe(false);
    expect(mine.errors.join(" ")).toMatch(pattern);
    expect(ref.validate(bad).ok).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validateRig(null).ok).toBe(false);
    expect(validateRig([]).ok).toBe(false);
    expect(validateRig("rig").ok).toBe(false);
  });
});

describe("evaluation", () => {
  const asset = fixture();

  it("gives the identity wrapper for every bound group at rest (neutral pose renders as authored)", () => {
    const wraps = transforms(asset);
    for (const b of asset.bindings) close(wraps[b.svgId], [1, 0, 0, 1, 0, 0], 6);
    closeMap(wraps, ref.transforms(asset));
  });

  it("samples linear, held, looped and clamped time exactly like the reference", () => {
    for (const anim of asset.animations) {
      for (const t of [-0.5, 0, 0.2, 0.55, 1, 1.45, 1.999, 2, 2.3, 7.1]) {
        const mine = sample(asset, anim.id, t);
        const theirs = ref.sample(asset, anim.id, t);
        expect(Object.keys(mine)).toEqual(Object.keys(theirs));
        for (const id of Object.keys(mine)) close([mine[id].x, mine[id].y, mine[id].rotation], [theirs[id].x, theirs[id].y, theirs[id].rotation]);
      }
    }
    expect(sample(asset, "missing", 1)).toEqual({});
  });

  it("holds the first key before the range and the last after it when the clip does not loop", () => {
    const still: RigAsset = { ...asset, animations: [{ id: "once", duration: 2, loop: false, tracks: [{ boneId: "head", keys: [{ time: 0.5, x: 0, y: 0, rotation: 10, easing: "linear" }, { time: 1.5, x: 0, y: 0, rotation: 30, easing: "linear" }] }] }] };
    expect(sample(still, "once", 0).head.rotation).toBe(10);
    expect(sample(still, "once", 1).head.rotation).toBeCloseTo(20);
    expect(sample(still, "once", 5).head.rotation).toBe(30);
    expect(animationTime(still.animations[0], 5)).toBe(2);
    expect(animationTime({ ...still.animations[0], loop: true }, 5)).toBeCloseTo(1);
    expect(animationTime({ ...still.animations[0], loop: true }, -0.5)).toBeCloseTo(1.5);
  });

  it("uses the explicit numeric span for rotations, not the shortest way round", () => {
    const spin: RigAsset = { ...asset, animations: [{ id: "spin", duration: 2, loop: false, tracks: [{ boneId: "root", keys: [{ time: 0, x: 0, y: 0, rotation: 0, easing: "linear" }, { time: 2, x: 0, y: 0, rotation: 350, easing: "linear" }] }] }] };
    expect(sample(spin, "spin", 1).root.rotation).toBeCloseTo(175);
  });

  it("a hold key keeps its value until the next key", () => {
    const reach = sample(asset, "reach", 1.3);
    expect(reach["upper-left"].rotation).toBe(-55);
  });

  it("moves descendants with a parent exactly once and leaves siblings alone", () => {
    const rest = world(asset);
    const posed = world(asset, { "upper-left": { x: 0, y: 0, rotation: 30 } });
    const shoulder = applyMatrix(rest["upper-left"], { x: 0, y: 0 });
    const handRest = applyMatrix(rest["hand-left"], { x: 0, y: 0 });
    const handPosed = applyMatrix(posed["hand-left"], { x: 0, y: 0 });
    // The hand's distance from the shoulder is unchanged: it swung, it did not stretch.
    expect(Math.hypot(handPosed.x - shoulder.x, handPosed.y - shoulder.y)).toBeCloseTo(Math.hypot(handRest.x - shoulder.x, handRest.y - shoulder.y));
    // ... and the swing is exactly 30°, not 60°.
    const a0 = Math.atan2(handRest.y - shoulder.y, handRest.x - shoulder.x);
    const a1 = Math.atan2(handPosed.y - shoulder.y, handPosed.x - shoulder.x);
    expect((((a1 - a0) * 180) / Math.PI + 540) % 360 - 180).toBeCloseTo(30);
    close(posed["upper-right"], rest["upper-right"]);
    close(posed["head"], rest["head"]);
    closeMap(posed, ref.world(asset, { "upper-left": { x: 0, y: 0, rotation: 30 } }));
  });

  it("clamps rotation deltas to the bone's limits during playback and posing", () => {
    const head = asset.bones.find((b) => b.id === "head")!;
    const over = world(asset, { head: { x: 0, y: 0, rotation: 500 } });
    const atMax = world(asset, { head: { x: 0, y: 0, rotation: head.limits!.max } });
    close(over.head, atMax.head);
    closeMap(over, ref.world(asset, { head: { x: 0, y: 0, rotation: 500 } }));
  });

  it("evaluates a clip from clock time: before its start, its first key; its manual pose with no animation", () => {
    const clip: RigClip = { id: "c", type: "rig", name: "r", enabled: true, start: 2, x: 0, y: 0, scale: 1, parentId: null, followRotation: false, rig: asset, animationId: "wave", pose: {} };
    expect(rigPoseAt(clip, 0)).toEqual(sample(asset, "wave", 0));
    expect(rigPoseAt(clip, 2.4)).toEqual(sample(asset, "wave", 0.4));
    const still = { ...clip, animationId: null, pose: { head: { x: 0, y: 0, rotation: 5 } } };
    expect(rigPoseAt(still, 9)).toEqual(still.pose);
    expect(rigDuration(clip)).toBe(2);
    expect(rigDuration(still)).toBe(1);
  });
});

describe("editing the skeleton", () => {
  const asset = fixture();

  it("rebind matches the reference and leaves a document-space asset's bindings as they were", () => {
    const mine = rebind(asset);
    const theirs = ref.rebind(asset);
    mine.bindings.forEach((b, i) => close(b.bindMatrix, theirs.bindings[i].bindMatrix));
    mine.bindings.forEach((b, i) => close(b.bindMatrix, asset.bindings[i].bindMatrix, 6));
  });

  it("moving a rest joint keeps the drawing and every descendant exactly where they were", () => {
    const before = transforms(asset);
    const worldBefore = world(asset);
    const moved = editRestJoint(asset, "upper-left", { rest: { x: 120, y: 50, rotation: 140 } });
    expect(moved.bones.find((b) => b.id === "upper-left")!.rest).toEqual({ x: 120, y: 50, rotation: 140 });
    const after = transforms(moved);
    for (const b of asset.bindings) close(after[b.svgId], before[b.svgId], 6);
    // Children re-expressed so their world rest did not move.
    const worldAfter = world(moved);
    for (const id of ["fore-left", "hand-left"]) close(worldAfter[id], worldBefore[id], 6);
    // The general rule agrees with the reference's inverse-rest rebind for document-space art.
    const refRebound = ref.rebind(moved);
    moved.bindings.forEach((b, i) => close(b.bindMatrix, refRebound.bindings[i].bindMatrix, 6));
    expect(validateRig(moved).ok).toBe(true);
  });

  it("posing moves the drawing around the joint while a rest edit does not", () => {
    const rest = transforms(asset)["fore-art-left"];
    const posed = transforms(asset, { "fore-left": { x: 0, y: 0, rotation: 40 } })["fore-art-left"];
    expect(posed.some((v, i) => Math.abs(v - rest[i]) > 1e-3)).toBe(true);
    const elbow = applyMatrix(world(asset)["fore-left"], { x: 0, y: 0 });
    // The elbow itself stays put: it is the pivot.
    const elbowPosed = applyMatrix(world(asset, { "fore-left": { x: 0, y: 0, rotation: 40 } })["fore-left"], { x: 0, y: 0 });
    expect(elbowPosed.x).toBeCloseTo(elbow.x);
    expect(elbowPosed.y).toBeCloseTo(elbow.y);
  });

  it("rebindPreserving keeps non-document-space bindings intact too", () => {
    // Fake an asset whose group is authored in bone-local space (identity bind).
    const local: RigAsset = { ...asset, bindings: [{ id: "b", svgId: "head-art", boneId: "head", bindMatrix: [1, 0, 0, 1, 0, 0] }] };
    const before = transforms(local)["head-art"];
    const moved = rebindPreserving(local, editRestJoint(local, "torso", { rest: { x: 10, y: 10, rotation: -80 } }));
    close(transforms(moved)["head-art"], before, 6);
  });

  it("changing a binding's bone recomputes the matrix so the neutral drawing stays put", () => {
    const before = transforms(asset)["hand-art-left"];
    const next = reassignBinding(asset, "bind-hand-art-left", "fore-left");
    expect(next.bindings.find((b) => b.id === "bind-hand-art-left")!.boneId).toBe("fore-left");
    close(transforms(next)["hand-art-left"], before, 6);
    expect(reassignBinding(asset, "bind-hand-art-left", "ghost")).toBe(asset);
  });

  it("adds a child bone at the parent's tip and removes a bone without moving art or children", () => {
    const added = addBone(asset, "head");
    const bone = added.bones[added.bones.length - 1];
    expect(bone.parentId).toBe("head");
    expect(bone.rest).toEqual({ x: 70, y: 0, rotation: 0 });
    expect(validateRig(added).ok).toBe(true);

    const before = transforms(asset);
    const worldBefore = world(asset);
    const removed = removeBone(asset, "fore-left");
    expect(removed.bones.some((b) => b.id === "fore-left")).toBe(false);
    expect(removed.bones.find((b) => b.id === "hand-left")!.parentId).toBe("upper-left");
    expect(removed.bindings.find((b) => b.svgId === "fore-art-left")!.boneId).toBe("upper-left");
    expect(removed.slots!.find((s) => s.id === "hold-left")!.boneId).toBe("hand-left");
    expect(removed.animations.find((a) => a.id === "wave")!.tracks.some((t) => t.boneId === "fore-left")).toBe(false);
    const after = transforms(removed);
    for (const b of removed.bindings) close(after[b.svgId], before[b.svgId], 6);
    close(world(removed)["hand-left"], worldBefore["hand-left"], 6);
    expect(validateRig(removed).ok).toBe(true);
    expect(removeBone(asset, "root")).toBe(asset);
  });
});

describe("posing and inverse kinematics", () => {
  const asset = fixture();

  it("solve matches the reference and reaches a target within the arm's limits", () => {
    const target = { x: 480, y: 250 };
    const mine = solve(asset, {}, "hand-left", target);
    const theirs = ref.solve(asset, {}, "hand-left", target);
    for (const id of Object.keys(theirs)) close([mine[id].rotation], [theirs[id].rotation]);
    const hand = applyMatrix(world(asset, mine)["hand-left"], { x: 0, y: 0 });
    expect(Math.hypot(hand.x - target.x, hand.y - target.y)).toBeLessThan(5);
    // The stage root is never turned by IK.
    expect(mine.root).toBeUndefined();
    for (const id of Object.keys(mine)) {
      const b = asset.bones.find((x) => x.id === id)!;
      expect(mine[id].rotation).toBeGreaterThanOrEqual(b.limits!.min);
      expect(mine[id].rotation).toBeLessThanOrEqual(b.limits!.max);
    }
  });

  it("setPoseDelta clamps to limits and ignores unknown bones", () => {
    const pose = setPoseDelta(asset, {}, "head", { rotation: 900 });
    expect(pose.head.rotation).toBe(35);
    expect(setPoseDelta(asset, pose, "ghost", { rotation: 1 })).toBe(pose);
  });
});

describe("animation editing", () => {
  const asset = fixture();

  it("record saves every bone's delta at the time, replacing a key already there, exactly like the reference", () => {
    const pose = { head: { x: 0, y: 0, rotation: 20 }, "upper-left": { x: 1, y: 2, rotation: -10 } };
    const mine = record(asset, "nod", 0.4, pose);
    const theirs = ref.record(asset, "nod", 0.4, pose);
    expect(mine.animations).toEqual(theirs.animations);
    const head = mine.animations.find((a) => a.id === "nod")!.tracks.find((t) => t.boneId === "head")!;
    expect(head.keys.filter((k) => k.time === 0.4)).toHaveLength(1);
    expect(head.keys.find((k) => k.time === 0.4)!.rotation).toBe(20);
    expect(() => record(asset, "missing", 0, {})).toThrow(/Select an animation/);
    expect(validateRig(mine).ok).toBe(true);
  });

  it("presets are gated by roles and match the reference", () => {
    expect(compatibleActions(asset)).toEqual({ nod: true, wave: true });
    expect(preset(asset, "nod").animations).toEqual(ref.preset(asset, "nod").animations);
    expect(preset(asset, "wave").animations).toEqual(ref.preset(asset, "wave").animations);
    const headless: RigAsset = { ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, role: undefined } : b)) };
    expect(compatibleActions(headless).nod).toBe(false);
    expect(() => preset(headless, "nod")).toThrow(/lacks the roles/);
  });

  it("upsertKey touches one bone's track only and keeps times sorted and valid", () => {
    const next = upsertKey(asset, "wave", "head", 1.2, { x: 0, y: 0, rotation: 999 });
    const wave = next.animations.find((a) => a.id === "wave")!;
    const head = wave.tracks.find((t) => t.boneId === "head")!;
    expect(head.keys).toEqual([{ time: 1.2, x: 0, y: 0, rotation: 35, easing: "linear" }]);
    expect(wave.tracks.find((t) => t.boneId === "upper-left")).toEqual(asset.animations[0].tracks[0]);
    const again = upsertKey(next, "wave", "head", 0.3, { x: 0, y: 0, rotation: 5 }, "hold");
    expect(again.animations.find((a) => a.id === "wave")!.tracks.find((t) => t.boneId === "head")!.keys.map((k) => k.time)).toEqual([0.3, 1.2]);
    expect(validateRig(again).ok).toBe(true);
  });

  it("keeps a bone named like an Object prototype member as a plain key", () => {
    const odd: RigAsset = { ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, id: "constructor" } : b)), bindings: asset.bindings.map((b) => (b.boneId === "head" ? { ...b, boneId: "constructor" } : b)), animations: [] };
    expect(validateRig(odd).ok).toBe(true);
    const name: string = "constructor";
    const w = world(odd);
    expect(Array.isArray(w[name])).toBe(true);
    expect(w[name].every((v) => Number.isFinite(v))).toBe(true);
    const sampled = sample({ ...odd, animations: [{ id: "a", duration: 1, loop: false, tracks: [{ boneId: name, keys: [{ time: 0, x: 0, y: 0, rotation: 5, easing: "hold" }] }] }] }, "a", 0.5);
    expect(sampled[name]).toEqual({ x: 0, y: 0, rotation: 5 });
    expect(poseOf({}, name)).toEqual({ x: 0, y: 0, rotation: 0 });
    expect(poseOf({}, "toString")).toEqual({ x: 0, y: 0, rotation: 0 });
  });

  it("retimes crowded keys safely: never past a neighbour, and all tracks land on one moment", () => {
    const crowded: RigAsset = { ...asset, animations: [{ id: "c", duration: 2, loop: false, tracks: [
      { boneId: "head", keys: [{ time: 0, x: 0, y: 0, rotation: 0, easing: "linear" }, { time: 0.5, x: 0, y: 0, rotation: 1, easing: "linear" }, { time: 0.505, x: 0, y: 0, rotation: 2, easing: "linear" }] },
      { boneId: "torso", keys: [{ time: 0.5, x: 0, y: 0, rotation: 1, easing: "linear" }, { time: 1.5, x: 0, y: 0, rotation: 2, easing: "linear" }] },
    ] }] };
    const anim = crowded.animations[0];
    // Every track's key at 0.5: the head's next key at 0.505 caps the move just short of it.
    expect(retimedKeyTime(anim, null, 0.5, 0.9)).toBe(0.495);
    const all = retimeKeys(crowded, "c", null, 0.5, 0.9);
    expect(all.animations[0].tracks.map((t) => t.keys.map((k) => k.time))).toEqual([[0, 0.495, 0.505], [0.495, 1.5]]);
    // A key wedged between two neighbours 0.01 s apart cannot move at all.
    const wedged: RigAnimation = { id: "w", duration: 2, loop: false, tracks: [{ boneId: "head", keys: [0.5, 0.505, 0.51].map((time) => ({ time, x: 0, y: 0, rotation: 0, easing: "linear" as const })) }] };
    expect(retimedKeyTime(wedged, "head", 0.505, 0.7)).toBe(0.505);
    expect(retimeKeys({ ...crowded, animations: [wedged] }, "w", "head", 0.505, 0.7).animations[0]).toBe(wedged);
    expect(retimedKeyTime(anim, "torso", 0.5, 0.9)).toBe(0.9);
    const moved = retimeKeys(crowded, "c", "torso", 0.5, 0.9);
    expect(moved.animations[0].tracks[1].keys.map((k) => k.time)).toEqual([0.9, 1.5]);
    expect(moved.animations[0].tracks[0].keys.map((k) => k.time)).toEqual([0, 0.5, 0.505]);
    expect(validateRig(moved).ok).toBe(true);
  });

  it("removeKey drops a key and an emptied track; retimeKeys stays strictly between neighbours", () => {
    const one = upsertKey(asset, "nod", "torso", 1, { x: 0, y: 0, rotation: 3 });
    const gone = removeKey(one, "nod", "torso", 1);
    expect(gone.animations.find((a) => a.id === "nod")!.tracks.some((t) => t.boneId === "torso")).toBe(false);
    const moved = retimeKeys(asset, "nod", "head", 0.8, 1.9);
    const times = moved.animations.find((a) => a.id === "nod")!.tracks[0].keys.map((k) => k.time);
    expect(times).toEqual([0, 0.4, 1.19, 1.2, 1.6, 2]);
    // Every track at a shared time lands on the same clamped moment.
    const shared = retimeKeys(asset, "wave", null, 0.4, 0.69);
    for (const t of shared.animations.find((a) => a.id === "wave")!.tracks) expect(t.keys.map((k) => k.time)).toContain(0.69);
    const all = retimeKeys(asset, "wave", null, 0.4, 0.5);
    for (const t of all.animations.find((a) => a.id === "wave")!.tracks) expect(t.keys.map((k) => k.time)).toContain(0.5);
    // A bone with no key at that time does not block the drag: every track's key moves.
    const fallback = retimeKeys(asset, "wave", "head", 0.4, 0.5);
    expect(fallback.animations.find((a) => a.id === "wave")!.tracks.map((t) => t.keys.map((k) => k.time))).toEqual(all.animations.find((a) => a.id === "wave")!.tracks.map((t) => t.keys.map((k) => k.time)));
    const solo = retimeKeys(asset, "wave", "hand-left", 0.7, 0.75);
    expect(solo.animations.find((a) => a.id === "wave")!.tracks.find((t) => t.boneId === "hand-left")!.keys.map((k) => k.time)).toContain(0.75);
    expect(solo.animations.find((a) => a.id === "wave")!.tracks.find((t) => t.boneId === "fore-left")!.keys.map((k) => k.time)).toContain(0.7);
    expect(validateRig(moved).ok && validateRig(all).ok).toBe(true);
  });

  it("changing a clip's duration rescales its key times", () => {
    const longer = setAnimationDuration(asset, "nod", 4);
    const nod = longer.animations.find((a) => a.id === "nod")!;
    expect(nod.duration).toBe(4);
    expect(nod.tracks[0].keys.map((k) => k.time)).toEqual([0, 0.8, 1.6, 2.4, 3.2, 4]);
    expect(validateRig(longer).ok).toBe(true);
  });

  it("adds a clip under a free id and lists every key time once", () => {
    const { asset: next, id } = addAnimation(asset, "Wave");
    expect(id).toBe("wave-2");
    expect(next.animations.find((a) => a.id === id)).toEqual({ id, name: "Wave", duration: 2, loop: true, tracks: [] });
    expect(keyTimes(asset.animations.find((a) => a.id === "wave")!)).toEqual([0, 0.4, 0.7, 1, 1.3, 1.6, 2]);
  });
});
