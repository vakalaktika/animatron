import type { RigClip, StudioDoc } from "@/app/components/motion-studio/types";
import { evaluateScene } from "@/app/components/motion-studio/engine/motionScene";
import { validateMotionDocument } from "@/app/components/motion-studio/engine/motionValidation";
import { makeText } from "../presets";
import { createMotionRecipe, MOTION_RECIPES } from "./motionRecipes";

const actor = (): RigClip => ({
  id: "actor", name: "Actor", type: "rig", enabled: true, start: 1, x: 100, y: 100, scale: 1,
  parentId: null, followRotation: true, animationId: null, pose: {},
  rig: { format: "mid-century-ink-rig", version: 4, canvas: { width: 200, height: 200 },
    svg: '<svg viewBox="0 0 200 200"><g id="art"/></svg>', bindings: [], animations: [],
    bones: [
      { id: "upper", parentId: null, rest: { x: 100, y: 100, rotation: 0 }, length: 50 },
      { id: "fore", parentId: "upper", rest: { x: 50, y: 0, rotation: 0 }, length: 50 },
      { id: "hand", parentId: "fore", rest: { x: 50, y: 0, rotation: 0 }, length: 0 },
    ], slots: [{ id: "grip", boneId: "hand", x: 0, y: 0, rotation: 0 }],
  },
});
const document = (rig = actor()): StudioDoc => ({ version: 4, name: "Recipes", stage: { width: 400, height: 300, background: "#fff", transparent: false }, timeline: { duration: 2, tailSeconds: 0, loop: false }, clips: [rig, makeText({ id: "plane", x: 220, y: 130, start: 0 })] });

describe("editable motion recipes", () => {
  test("advertises only implemented reusable recipes", () => {
    expect(MOTION_RECIPES.map(r => r.id)).toEqual(["target", "path", "lift", "breathing", "reach", "aim", "hold"]);
  });
  test.each(["target", "path", "lift", "breathing"] as const)("creates %s without changing artwork or input", recipe => {
    const doc = document(), before = structuredClone(doc);
    const result = createMotionRecipe(doc, "actor", recipe, 2);
    expect(result.error).toBeUndefined();
    expect(result.doc.clips[0]).not.toBe(doc.clips[0]);
    expect((result.doc.clips[0] as RigClip).rig).toBe((doc.clips[0] as RigClip).rig);
    expect(doc).toEqual(before);
    expect(validateMotionDocument(result.doc)).toEqual([]);
    expect(result.nodeId).toBeTruthy();
  });
  test("uses clip-local time and extends duration through repeated cycles", () => {
    const result = createMotionRecipe(document(), "actor", "path", 3, { duration: 2, repeat: 3 });
    expect(result.doc.clips[0].motion?.blocks?.[0]).toMatchObject({ start: 2, duration: 2, repeat: 3 });
    expect(result.doc.timeline?.duration).toBe(9);
  });
  test("does not collide with portable rig IDs", () => {
    const rig = actor(); rig.rig.motion = { controllers: [{ id: "target-1", space: "rig", x: 100, y: 100 }] };
    const result = createMotionRecipe(document(rig), "actor", "target", 1);
    expect(result.doc.clips[0].motion?.controllers?.[0].id).toBe("target-2");
    expect(rig.rig.motion.controllers).toHaveLength(1);
  });
  test("creates a no-jump reach for the only valid limb chain", () => {
    const doc = document(), before = evaluateScene(doc, 2);
    const result = createMotionRecipe(doc, "actor", "reach", 2);
    expect(result.error).toBeUndefined();
    expect(result.doc.clips[0].motion?.constraints?.[0]).toMatchObject({ type: "ik", rootId: "upper", midId: "fore", tipId: "hand", start: 1 });
    expect(evaluateScene(result.doc, 2).controllers.actor["target-1"]).toMatchObject({ x: 200, y: 100 });
    expect(evaluateScene(result.doc, 2).transforms.actor).toEqual(before.transforms.actor);
    expect(validateMotionDocument(result.doc)).toEqual([]);
  });
  test("requires a selected chain when a rig has multiple valid choices", () => {
    const rig = actor(); rig.rig.bones = [...rig.rig.bones, { id: "finger", parentId: "hand", rest: { x: 10, y: 0, rotation: 0 }, length: 0 }];
    const doc = document(rig), rejected = createMotionRecipe(doc, "actor", "reach", 1);
    expect(rejected.doc).toBe(doc); expect(rejected.error).toMatch(/chain/i);
    expect(createMotionRecipe(doc, "actor", "reach", 1, { rootId: "upper", midId: "fore", tipId: "hand" }).error).toBeUndefined();
  });
  test("can reach an existing named target without creating another", () => {
    const rig = actor(); rig.motion = { controllers: [{ id: "goal", name: "Plane hand", space: "stage", x: 170, y: 100 }] };
    const result = createMotionRecipe(document(rig), "actor", "reach", 2, { controllerId: "goal", bend: -1 });
    expect(result.error).toBeUndefined();
    expect(result.doc.clips[0].motion?.controllers).toHaveLength(1);
    expect(result.doc.clips[0].motion?.constraints?.[0]).toMatchObject({ targetId: "goal", bend: -1 });
  });
  test("requires an explicit gaze bone or a unique head role", () => {
    const doc = document();
    expect(createMotionRecipe(doc, "actor", "aim", 1).error).toMatch(/bone/i);
    const result = createMotionRecipe(doc, "actor", "aim", 1, { boneId: "upper" });
    expect(result.error).toBeUndefined(); expect(result.doc.clips[0].motion?.constraints?.[0]).toMatchObject({ type: "aim", boneId: "upper" });
  });
  test("holds a prop at its current pose when attaching to a moving socket", () => {
    const rig = actor(); rig.rotation = 25; rig.scale = 1.4;
    rig.motion = { blocks: [{ id: "move", type: "transform", start: 0, duration: 3, from: {}, to: { x: 30, rotation: 15 } }] };
    const doc = document(rig), before = evaluateScene(doc, 2).transforms.plane;
    const result = createMotionRecipe(doc, "plane", "hold", 2, { targetClipId: "actor", slotId: "grip" });
    expect(result.error).toBeUndefined();
    const after = evaluateScene(result.doc, 2).transforms.plane;
    expect(after.x).toBeCloseTo(before.x, 7); expect(after.y).toBeCloseTo(before.y, 7); expect(after.rotation).toBeCloseTo(before.rotation, 7);
    expect(result.doc.clips[1].motion?.constraints?.[0]).toMatchObject({ targetClipId: "actor", slotId: "grip" });
  });
  test("rejects unknown targets, invalid anatomy, cycles and overlapping drivers atomically", () => {
    const doc = document();
    for (const options of [{}, { targetClipId: "missing" }, { targetClipId: "plane" }, { targetClipId: "actor", slotId: "missing" }]) {
      const result = createMotionRecipe(doc, "plane", "hold", 1, options);
      expect(result.doc).toBe(doc); expect(result.error).toBeTruthy();
    }
    expect(createMotionRecipe(doc, "actor", "reach", 1, { rootId: "upper", midId: "hand", tipId: "fore" }).doc).toBe(doc);
    const first = createMotionRecipe(doc, "actor", "reach", 1).doc;
    const second = createMotionRecipe(first, "actor", "reach", 1);
    expect(second.doc).toBe(first); expect(second.error).toMatch(/conflict/i);
    const held = createMotionRecipe(doc, "plane", "hold", 1, { targetClipId: "actor" }).doc;
    expect(createMotionRecipe(held, "actor", "hold", 1, { targetClipId: "plane" }).doc).toBe(held);
  });
  test("rejects invalid bounds and missing objects without altering the document", () => {
    const doc = document();
    for (const result of [createMotionRecipe(doc, "unknown", "path", 0), createMotionRecipe(doc, "actor", "path", NaN), createMotionRecipe(doc, "actor", "path", 599, { duration: 4 }), createMotionRecipe(doc, "actor", "path", 1, { repeat: 101 }), createMotionRecipe(doc, "actor", "target", 1, { point: { x: Infinity, y: 3 } }), createMotionRecipe(doc, "plane", "reach", 0)]) {
      expect(result.doc).toBe(doc); expect(result.error).toBeTruthy();
    }
  });
});
