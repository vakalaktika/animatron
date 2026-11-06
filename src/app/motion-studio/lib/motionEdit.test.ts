import { makeText } from "../presets";
import { addMotionPath, addMotionController, keyMotionController, removeMotionController, retimeMotionBlock, changeMeshWeight, controllerAt, changeController, retimeControllerKey, removeControllerKey } from "./motionEdit";
import { readFileSync } from "node:fs";
import type { RigClip } from "@/app/components/motion-studio/types";

describe("editable motion", () => {
  it("retimes controller keys together while preserving curves and rejecting collisions",()=>{
    const start=addMotionController(makeText({id:"actor",start:0}),{x:10,y:20});
    const id=start.motion!.controllers![0].id,clip=keyMotionController(start,id,2,{x:30,y:40});
    const next=retimeControllerKey(clip,id,2,3);
    expect(next.motion!.controllers![0].keys!.x!.map(k=>k.time)).toEqual([0,3]);
    expect(next.motion!.controllers![0].keys!.y![1].time).toBe(3);
    expect(next.motion!.controllers![0].keys!.x![1].ease).toEqual({name:"inOut"});
    expect(clip.motion!.controllers![0].keys!.x![1].time).toBe(2);
    expect(retimeControllerKey(clip,id,2,0)).toBe(clip);
    expect(retimeControllerKey(clip,id,2,-1)).toBe(clip);
    expect(retimeControllerKey(clip,"missing",2,3)).toBe(clip);
    expect(removeControllerKey(next,id,3).motion!.controllers![0].keys!.x).toHaveLength(1);
  });
  it("adds a sparse path without changing existing artwork or keys", () => {
    const clip = makeText({ id: "title", text: "Hello", x: 100, y: 200 });
    const before = structuredClone(clip);
    const next = addMotionPath(clip, 2);
    expect(clip).toEqual(before);
    expect(next.text).toBe("Hello");
    expect(next.motion?.blocks).toHaveLength(1);
    expect(next.motion?.blocks?.[0]).toMatchObject({ start: 2, duration: 1 });
  });
  it("keys a controller sparsely at local time, keeping a baseline", () => {
    const clip = addMotionController(makeText({ id: "title", start: 1 }), { x: 20, y: 30 });
    const id = clip.motion!.controllers![0].id;
    const next = keyMotionController(clip, id, 2.5, { x: 80, y: 90 });
    expect(next.motion?.controllers?.[0].keys?.x).toHaveLength(2);
    expect(next.motion?.controllers?.[0].keys?.x?.[0]).toMatchObject({ time: 0, value: 20 });
    expect(next.motion?.controllers?.[0].keys?.x?.[1]).toMatchObject({ time: 1.5, value: 80 });
    expect(clip.motion?.controllers?.[0].keys).toBeUndefined();
  });
  it("prevents deleting a target that a relationship still uses", () => {
    const clip = addMotionController(makeText({ id: "title" }), { x: 20, y: 30 });
    const id = clip.motion!.controllers![0].id;
    const related = { ...clip, motion: { ...clip.motion, constraints: [{ id: "look", type: "aim", boneId: "head", targetId: id, weight: 1 }] } } as typeof clip;
    expect(removeMotionController(related, id)).toBe(related);
    expect(removeMotionController(clip, id).motion?.controllers).toEqual([]);
  });
  it("retimes a block without baking or mutating its sparse path", () => {
    const clip = addMotionPath(makeText({ id: "title" }), 0);
    const id = clip.motion!.blocks![0].id;
    const next = retimeMotionBlock(clip, id, 3, 2);
    expect(next.motion?.blocks?.[0]).toMatchObject({ start: 3, duration: 2 });
    expect(clip.motion?.blocks?.[0]).toMatchObject({ start: 0, duration: 1 });
    expect(next.motion?.blocks?.[0].type).toBe("path");
  });
  it("edits a mesh weight while preserving a normalized distribution", () => {
    const clip = JSON.parse(readFileSync("examples/deformation-proof/cloth.animatron.json", "utf8")).clips[0] as RigClip;
    const mesh = clip.rig.meshes![0];
    const index = mesh.vertices.findIndex(vertex => vertex.weights.length > 1);
    const boneId = mesh.vertices[index].weights[0].boneId;
    const next = changeMeshWeight(clip, mesh.id, index, boneId, 0.7);
    expect(next.rig.meshes![0].vertices[index].weights[0].weight).toBeCloseTo(0.7);
    expect(next.rig.meshes![0].vertices[index].weights.reduce((sum, w) => sum + w.weight, 0)).toBeCloseTo(1);
    expect(next.rig.meshes![0].triangles).toBe(mesh.triangles);
    expect(clip.rig.meshes![0].vertices[index].weights[0].weight).not.toBeCloseTo(0.7);
    expect(changeMeshWeight(clip, mesh.id, index, boneId, 0)).toBe(clip);
  });
  it("samples sparse targets and keeps existing curves when overwriting a key", () => {
    let clip = addMotionController(makeText({ id: "title", start: 0 }), { x: 20, y: 30 });
    const control = clip.motion!.controllers![0];
    clip = changeController(clip, { ...control, keys: { x: [{ time: 0, value: 20, ease: { name: "linear" } }, { time: 2, value: 40 }], rotation: [{ time: 0, value: 10 }] } });
    expect(controllerAt(clip.motion!.controllers![0], 1)).toEqual({ x: 30, y: 30, rotation: 10 });
    const keyed = keyMotionController(clip, control.id, 0, { x: 25, y: 35 });
    expect(keyed.motion?.controllers?.[0].keys?.x?.[0].ease).toEqual({ name: "linear" });
    expect(keyMotionController(clip, "missing", 1, { x: 1, y: 2 })).toBe(clip);
    expect(keyMotionController(clip, control.id, 1, { x: NaN, y: 2 })).toBe(clip);
  });
  it("rejects impossible block timing without replacing the master", () => {
    const clip = addMotionPath(makeText({ id: "title" }), 0);
    const id = clip.motion!.blocks![0].id;
    expect(retimeMotionBlock(clip, id, -1, 1)).toBe(clip);
    expect(retimeMotionBlock(clip, id, 0, 0)).toBe(clip);
    expect(retimeMotionBlock(clip, id, 599, 2)).toBe(clip);
    expect(retimeMotionBlock(clip, "missing", 0, 1)).toBe(clip);
  });
});
