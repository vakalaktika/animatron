import { readFileSync } from "node:fs";
import path from "node:path";
import { applyMatrix, rigPoseAt, transforms, validateRig, world } from "@/app/components/motion-studio/engine/rig";
import type { RigAsset, RigClip } from "@/app/components/motion-studio/types";
import { canTrim, trimClip } from "./trim";
import { commitPose, dragRigHandle, localTime, setBoneDelta } from "./rigEdit";

const fixture = (): RigAsset => JSON.parse(readFileSync(path.resolve(__dirname, "../../../../docs/mci-rig/example-character.mci.json"), "utf8")) as RigAsset;
const clipWith = (over: Partial<RigClip> = {}): RigClip => ({
  id: "rig",
  type: "rig",
  name: "Ink",
  enabled: true,
  start: 1,
  x: 0,
  y: 0,
  scale: 1,
  parentId: null,
  followRotation: false,
  rig: fixture(),
  animationId: null,
  pose: {},
  ...over,
});

describe("localTime", () => {
  it("is the clip's animation time at the clock, folded for loops, and 0 without a clip", () => {
    expect(localTime(clipWith(), 5)).toBe(0);
    expect(localTime(clipWith({ animationId: "wave" }), 1.4)).toBe(0.4);
    expect(localTime(clipWith({ animationId: "wave" }), 3.5)).toBe(0.5);
    expect(localTime(clipWith({ animationId: "wave" }), 0)).toBe(0);
  });
});

describe("commitPose and setBoneDelta", () => {
  it("writes into the manual pose when no clip plays, dropping rest-only bones", () => {
    const clip = setBoneDelta(clipWith(), 2, "head", { rotation: 20 });
    expect(clip.pose).toEqual({ head: { x: 0, y: 0, rotation: 20 } });
    expect(setBoneDelta(clip, 2, "head", { rotation: 0 }).pose).toEqual({});
    expect(clip.rig).toEqual(fixture());
  });

  it("clamps to the bone's limits", () => {
    expect(setBoneDelta(clipWith(), 2, "head", { rotation: 300 }).pose.head.rotation).toBe(35);
  });

  it("records a key at the playhead for the changed bone only when a clip plays", () => {
    const clip = setBoneDelta(clipWith({ animationId: "nod" }), 1.6, "torso", { rotation: 10 });
    const nod = clip.rig.animations.find((a) => a.id === "nod")!;
    expect(nod.tracks.map((t) => t.boneId)).toEqual(["head", "torso"]);
    expect(nod.tracks[1].keys).toEqual([{ time: 0.6, x: 0, y: 0, rotation: 10, easing: "linear" }]);
    expect(nod.tracks[0]).toEqual(fixture().animations[1].tracks[0]);
    expect(clip.pose).toEqual({});
    expect(rigPoseAt(clip, 1.6).torso.rotation).toBe(10);
    expect(validateRig(clip.rig).ok).toBe(true);
  });

  it("replaces an existing key at the same time instead of adding one", () => {
    const once = setBoneDelta(clipWith({ animationId: "nod" }), 1.4, "head", { rotation: 20 });
    const twice = setBoneDelta(once, 1.4, "head", { rotation: 25 });
    const keys = twice.rig.animations.find((a) => a.id === "nod")!.tracks[0].keys;
    expect(keys.filter((k) => k.time === 0.4)).toEqual([{ time: 0.4, x: 0, y: 0, rotation: 25, easing: "linear" }]);
    expect(keys).toHaveLength(6);
  });

  it("leaves everything alone when the pose did not change", () => {
    const clip = clipWith({ animationId: "nod" });
    expect(commitPose(clip, 1.4, rigPoseAt(clip, 1.4)).rig).toEqual(clip.rig);
  });
});

describe("dragRigHandle", () => {
  const clip = clipWith();
  const rest = world(clip.rig);
  const at = (id: string, p = { x: 0, y: 0 }) => applyMatrix(rest[id], p);

  it("pose · joint: bends the chain above the bone so its joint follows the pointer, within limits", () => {
    const target = { x: at("hand-left").x - 60, y: at("hand-left").y - 120 };
    const next = dragRigHandle(clip, 2, "hand-left", "joint", "pose", target);
    const hand = applyMatrix(world(next.rig, next.pose)["hand-left"], { x: 0, y: 0 });
    const before = Math.hypot(at("hand-left").x - target.x, at("hand-left").y - target.y);
    // The pointer is past what the elbow and shoulder limits allow, so the hand gets as close as it may.
    expect(Math.hypot(hand.x - target.x, hand.y - target.y)).toBeLessThan(before / 3);
    const near = { x: at("hand-left").x - 20, y: at("hand-left").y - 30 };
    const reached = dragRigHandle(clip, 2, "hand-left", "joint", "pose", near);
    const handNear = applyMatrix(world(reached.rig, reached.pose)["hand-left"], { x: 0, y: 0 });
    expect(Math.hypot(handNear.x - near.x, handNear.y - near.y)).toBeLessThan(2);
    expect(next.rig).toEqual(clip.rig);
    expect(Object.keys(next.pose).sort()).toEqual(["fore-left", "torso", "upper-left"]);
    for (const id of Object.keys(next.pose)) {
      const bone = clip.rig.bones.find((b) => b.id === id)!;
      expect(next.pose[id].rotation).toBeGreaterThanOrEqual(bone.limits!.min);
      expect(next.pose[id].rotation).toBeLessThanOrEqual(bone.limits!.max);
    }
  });

  it("pose · root joint: slides the whole character", () => {
    const next = dragRigHandle(clip, 2, "root", "joint", "pose", { x: 350, y: 420 });
    expect(next.pose.root).toEqual({ x: 50, y: 20, rotation: 0 });
    const head = applyMatrix(world(next.rig, next.pose)["head"], { x: 0, y: 0 });
    expect(head.x).toBeCloseTo(at("head").x + 50);
    expect(head.y).toBeCloseTo(at("head").y + 20);
  });

  it("pose · tip: turns the bone about its own joint toward the pointer", () => {
    const elbow = at("fore-left");
    const target = { x: elbow.x + 100, y: elbow.y };
    const next = dragRigHandle(clip, 2, "fore-left", "tip", "pose", target);
    const posed = world(next.rig, next.pose);
    const tip = applyMatrix(posed["fore-left"], { x: 90, y: 0 });
    const angle = (Math.atan2(tip.y - elbow.y, tip.x - elbow.x) * 180) / Math.PI;
    // The forearm's limits allow pointing straight right from this rest, so it does.
    expect(angle).toBeCloseTo(0, 0);
    expect(applyMatrix(posed["fore-left"], { x: 0, y: 0 })).toEqual(elbow);
    expect(next.pose["upper-left"]).toBeUndefined();
  });

  it("pose · tip: stops at the joint limit", () => {
    const neck = at("head");
    const next = dragRigHandle(clip, 2, "head", "tip", "pose", { x: neck.x + 100, y: neck.y });
    expect(next.pose.head.rotation).toBe(35);
  });

  it("joints · joint: moves the rest joint while the drawing and children stay put", () => {
    const before = transforms(clip.rig);
    const target = { x: at("fore-left").x + 15, y: at("fore-left").y + 10 };
    const next = dragRigHandle(clip, 2, "fore-left", "joint", "joints", target);
    const joint = applyMatrix(world(next.rig)["fore-left"], { x: 0, y: 0 });
    expect(joint.x).toBeCloseTo(target.x);
    expect(joint.y).toBeCloseTo(target.y);
    const after = transforms(next.rig);
    for (const b of next.rig.bindings) after[b.svgId].forEach((v, i) => expect(v).toBeCloseTo(before[b.svgId][i], 6));
    const hand = applyMatrix(world(next.rig)["hand-left"], { x: 0, y: 0 });
    expect(hand.x).toBeCloseTo(at("hand-left").x, 6);
    expect(hand.y).toBeCloseTo(at("hand-left").y, 6);
    expect(next.pose).toEqual({});
    expect(validateRig(next.rig).ok).toBe(true);
  });

  it("joints · tip: sets the rest direction and length to the pointer", () => {
    const neck = at("head");
    const next = dragRigHandle(clip, 2, "head", "tip", "joints", { x: neck.x, y: neck.y - 50 });
    const head = next.rig.bones.find((b) => b.id === "head")!;
    expect(head.length).toBe(50);
    const tip = applyMatrix(world(next.rig)["head"], { x: head.length, y: 0 });
    expect(tip.x).toBeCloseTo(neck.x);
    expect(tip.y).toBeCloseTo(neck.y - 50);
    const before = transforms(clip.rig)["head-art"];
    transforms(next.rig)["head-art"].forEach((v, i) => expect(v).toBeCloseTo(before[i], 6));
  });

  it("ignores an unknown bone", () => {
    expect(dragRigHandle(clip, 2, "ghost", "joint", "pose", { x: 0, y: 0 })).toBe(clip);
  });

  it("with a clip playing, a pose drag becomes keys at the playhead", () => {
    const playing = clipWith({ animationId: "nod" });
    const next = dragRigHandle(playing, 1.4, "head", "tip", "pose", { x: at("head").x + 100, y: at("head").y + 100 });
    const nod = next.rig.animations.find((a) => a.id === "nod")!;
    expect(nod.tracks[0].keys.find((k) => k.time === 0.4)!.rotation).not.toBe(12);
    expect(next.pose).toEqual({});
  });
});

describe("trimming a rig on the timeline", () => {
  it("rescales the playing clip's keys with its length and refuses a still pose", () => {
    const still = clipWith();
    expect(canTrim(still)).toBe(false);
    expect(trimClip(still, 1)).toBe(still);
    const playing = clipWith({ animationId: "nod" });
    expect(canTrim(playing)).toBe(true);
    const longer = trimClip(playing, 2);
    const nod = longer.rig.animations.find((a) => a.id === "nod")!;
    expect(nod.duration).toBe(4);
    expect(nod.tracks[0].keys.map((k) => k.time)).toEqual([0, 0.8, 1.6, 2.4, 3.2, 4]);
  });
});
