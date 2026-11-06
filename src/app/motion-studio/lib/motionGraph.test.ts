import type { Clip, RigClip, StudioDoc } from "@/app/components/motion-studio/types";
import { evaluateScene } from "@/app/components/motion-studio/engine/motionScene";
import { makeText } from "../presets";
import { buildMotionGraph, connectMotionGraph, editMotionGraph, graphNodeId, reconnectMotionGraph } from "./motionGraph";

const actor = (): RigClip => ({
  id: "actor", name: "Actor", type: "rig", enabled: true, start: 0, x: 100, y: 100, scale: 1,
  parentId: null, followRotation: true, animationId: null, pose: {},
  rig: { format: "mid-century-ink-rig", version: 4, canvas: { width: 200, height: 200 },
    svg: '<svg viewBox="0 0 200 200"><g id="arm"/></svg>', bindings: [], animations: [],
    bones: [{ id: "root", parentId: null, rest: { x: 100, y: 100, rotation: 0 }, length: 50 },
      { id: "fore", parentId: "root", rest: { x: 50, y: 0, rotation: 0 }, length: 50 },
      { id: "hand", parentId: "fore", rest: { x: 50, y: 0, rotation: 0 }, length: 0 }],
    slots: [{ id: "grip", boneId: "hand", x: 0, y: 0, rotation: 10 }] },
  motion: { controllers: [{ id: "target", space: "stage", x: 155, y: 140 }],
    blocks: [{ id: "lift", type: "transform", start: 0, duration: 2, from: {}, to: { y: -20 } }],
    constraints: [{ id: "reach", type: "ik", rootId: "root", midId: "fore", tipId: "hand", targetId: "target", bend: 1 }] },
});
const scene = (...clips: Clip[]): StudioDoc => ({ version: 4, name: "Graph", stage: { width: 500, height: 400, background: "#fff", transparent: false }, clips });
const id = graphNodeId;
const wire = (source: string, sourceHandle: string, target: string, targetHandle: string) => ({ source, sourceHandle, target, targetHandle });

describe("motion graph adapter", () => {
  it("uses selector-safe IDs for real drag handles",()=>{
    expect(graphNodeId('character/"A"',"controller","hand")).not.toMatch(/["\[\]\s]/);
  });
  it("scopes IDs, derives meaningful edges, and leaves artwork untouched", () => {
    const a = actor(), b = { ...actor(), id: "other" }, doc = scene(a, b), before = structuredClone(doc);
    const graph = buildMotionGraph(doc);
    expect(new Set(graph.nodes.map(n => n.id)).size).toBe(graph.nodes.length);
    expect(graph.edges).toEqual(expect.arrayContaining([expect.objectContaining({ source: id("actor", "block", "lift"), target: id("actor", "object"), label: "moves" })]));
    expect(graph.nodes.find(n => n.id === id("actor", "socket", "grip"))?.ports[0].kind).toBe("frame");
    expect(doc).toEqual(before);
    expect(id("a/b", "controller", "c")).not.toBe(id("a", "controller", "b/c"));
  });
  it("marks portable rig controls and instance overrides", () => {
    const a = actor(); a.rig.motion = { controllers: [{ id: "target", space: "rig", x: 1, y: 2 }], blocks: [{ id: "breath", type: "oscillate", start: 0, duration: 3, property: "y", amplitude: 2 }] };
    const graph = buildMotionGraph(scene(a));
    expect(graph.nodes.find(n => n.id === id("actor", "controller", "target"))?.provenance).toBe("override");
    expect(graph.nodes.find(n => n.id === id("actor", "block", "breath"))?.provenance).toBe("rig");
  });
});

describe("validated graph connections", () => {
  it("reconnects the same owner atomically and rejects moving a wire to another operation",()=>{
    const doc=scene(actor()),edge=buildMotionGraph(doc).edges.find(e=>e.ownerNodeId===id("actor","block","lift"))!;
    const valid=wire(edge.source,"motion",id("actor","controller","target"),"motion");
    expect(reconnectMotionGraph(doc,edge.id,valid,0).doc.clips[0].motion?.blocks?.[0].controllerId).toBe("target");
    expect(reconnectMotionGraph(doc,edge.id,wire(id("actor","controller","target"),"target",id("actor","constraint","reach"),"target"),0).doc).toBe(doc);
    expect(reconnectMotionGraph(doc,"missing",valid,0).error).toBeTruthy();
  });
  it("routes a block to a same-character target without changing its sparse motion", () => {
    const doc = scene(actor());
    const next = connectMotionGraph(doc, wire(id("actor", "block", "lift"), "motion", id("actor", "controller", "target"), "motion"), 1);
    expect(next.error).toBeUndefined();
    expect(next.doc.clips[0].motion?.blocks?.[0].controllerId).toBe("target");
    expect(doc.clips[0].motion?.blocks?.[0].controllerId).toBeUndefined();
    expect(next.doc.clips[0].motion?.blocks?.[0].duration).toBe(2);
  });
  it("rejects incompatible ports, cross-character targets, and missing endpoints atomically", () => {
    const doc = scene(actor(), { ...actor(), id: "other" });
    for (const connection of [
      wire(id("actor", "block", "lift"), "motion", id("actor", "constraint", "reach"), "target"),
      wire(id("actor", "block", "lift"), "motion", id("other", "controller", "target"), "motion"),
      wire("missing", "motion", id("actor", "object"), "motion"),
    ]) { const result = connectMotionGraph(doc, connection, 0); expect(result.error).toBeTruthy(); expect(result.doc).toBe(doc); }
  });
  it("reconnects a reach to a different controller", () => {
    const a = actor(); a.motion!.controllers!.push({ id: "second", space: "stage", x: 130, y: 150 });
    const result = connectMotionGraph(scene(a), wire(id("actor", "controller", "second"), "target", id("actor", "constraint", "reach"), "target"), 0);
    expect(result.error).toBeUndefined();
    expect(result.doc.clips[0].motion!.constraints![0]).toMatchObject({ targetId: "second" });
  });
  it("preserves a prop pose when reconnecting to a mirrored rotated socket", () => {
    const a = actor(); a.scale = -1.3; a.rotation = 25;
    const prop = makeText({ id: "plane", x: 260, y: 160 });
    prop.motion = { constraints: [{ id: "hold", type: "attach", enabled: false, targetClipId: "actor", offset: { x: 0, y: 0, rotation: 0 } }] };
    const doc = scene(a, prop), before = evaluateScene(doc, 1).transforms.plane;
    const result = connectMotionGraph(doc, wire(id("actor", "socket", "grip"), "frame", id("plane", "constraint", "hold"), "frame"), 1);
    expect(result.error).toBeUndefined();
    const after = evaluateScene(result.doc, 1).transforms.plane;
    expect(after.x).toBeCloseTo(before.x, 6); expect(after.y).toBeCloseTo(before.y, 6); expect(after.rotation).toBeCloseTo(before.rotation, 6);
  });
  it("preserves the current controller point on a coordinate-space change including additive motion", () => {
    const a = actor(), prop = makeText({ id: "plane", x: 260, y: 160, rotation: 30, scale: -1.5 });
    a.motion!.blocks![0].controllerId = "target";
    const doc = scene(a, prop), before = evaluateScene(doc, 1).controllers.actor.target;
    const result = connectMotionGraph(doc, wire(id("plane", "object"), "frame", id("actor", "controller", "target"), "space"), 1);
    expect(result.error).toBeUndefined();
    const after = evaluateScene(result.doc, 1).controllers.actor.target;
    expect(after.x).toBeCloseTo(before.x, 6); expect(after.y).toBeCloseTo(before.y, 6);
  });
  it("rejects a dependency cycle without changing the previous connection", () => {
    const a = actor(), prop = makeText({ id: "plane" });
    prop.motion = { constraints: [{ id: "hold", type: "attach", targetClipId: "actor", offset: { x: 0, y: 0, rotation: 0 } }] };
    const doc = scene(a, prop), result = connectMotionGraph(doc, wire(id("plane", "object"), "frame", id("actor", "controller", "target"), "space"), 0);
    expect(result.error).toMatch(/cycle/i); expect(result.doc).toBe(doc);
  });
  it("connects aim joints and validates three-joint limb ends", () => {
    const a = actor(); a.motion!.constraints = [{ id: "look", type: "aim", boneId: "root", targetId: "target", enabled: false }];
    const doc = scene(a);
    const aimed = connectMotionGraph(doc, wire(id("actor", "bone", "hand"), "bone", id("actor", "constraint", "look"), "bone"), 0);
    expect(aimed.error).toBeUndefined(); expect(aimed.doc.clips[0].motion!.constraints![0]).toMatchObject({ boneId: "hand" });
    const ikDoc = scene(actor());
    expect(connectMotionGraph(ikDoc, wire(id("actor", "bone", "root"), "bone", id("actor", "constraint", "reach"), "bone"), 0).error).toMatch(/three-joint/i);
    expect(connectMotionGraph(ikDoc, wire(id("actor", "bone", "hand"), "bone", id("actor", "constraint", "reach"), "bone"), 0).doc.clips[0].motion!.constraints![0]).toMatchObject({ rootId: "root", midId: "fore", tipId: "hand" });
  });
  it("moves a controller back into its own rig space without a visible jump", () => {
    const a = actor(); a.rotation = 30; a.scale = -1.2;
    const doc = scene(a), before = evaluateScene(doc, .7).controllers.actor.target;
    const result = connectMotionGraph(doc, wire(id("actor", "object"), "frame", id("actor", "controller", "target"), "space"), .7);
    expect(result.error).toBeUndefined();
    expect(result.doc.clips[0].motion!.controllers![0].space).toBe("rig");
    const after = evaluateScene(result.doc, .7).controllers.actor.target;
    expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
  });
  it("preserves controller rotation when changing coordinate space", () => {
    const a = actor(), prop = makeText({ id: "plane", x: 260, y: 160, rotation: 30 });
    const doc = scene(a, prop), before = evaluateScene(doc, 1).controllers.actor.target;
    const result = connectMotionGraph(doc, wire(id("plane", "object"), "frame", id("actor", "controller", "target"), "space"), 1);
    expect(evaluateScene(result.doc, 1).controllers.actor.target.rotation).toBeCloseTo(before.rotation, 6);
  });
  it("rejects nonfinite playhead times", () => {
    const doc = scene(actor());
    expect(connectMotionGraph(doc, wire(id("actor", "block", "lift"), "motion", id("actor", "object"), "motion"), NaN).doc).toBe(doc);
  });
});

describe("safe graph operations", () => {
  it("blocks target deletion when used and disables inherited operations instead of revealing them", () => {
    const a = actor(); a.rig.motion = { blocks: [{ id: "lift", type: "transform", start: 0, duration: 2, from: {}, to: { y: -10 } }] };
    const doc = scene(a);
    expect(editMotionGraph(doc, { type: "remove", nodeId: id("actor", "controller", "target") }, 0).doc).toBe(doc);
    const result = editMotionGraph(doc, { type: "remove", nodeId: id("actor", "block", "lift") }, 0);
    expect(result.error).toBeUndefined(); expect(result.doc.clips[0].motion?.blocks?.[0].enabled).toBe(false);
    expect(a.rig.motion.blocks![0].enabled).toBeUndefined();
  });
  it("duplicates constraints disabled to avoid competing drivers and uses fresh IDs", () => {
    const doc = scene(actor());
    const result = editMotionGraph(doc, { type: "duplicate", nodeId: id("actor", "constraint", "reach") }, 0);
    expect(result.error).toBeUndefined();
    const constraints = result.doc.clips[0].motion!.constraints!;
    expect(constraints).toHaveLength(2); expect(constraints[1].enabled).toBe(false); expect(constraints[1].id).not.toBe("reach");
  });
  it("removes an unused scene controller and keeps source objects immutable", () => {
    const a = actor(); a.motion!.controllers!.push({ id: "unused", space: "stage", x: 5, y: 6 });
    const doc = scene(a), result = editMotionGraph(doc, { type: "remove", nodeId: id("actor", "controller", "unused") }, 0);
    expect(result.error).toBeUndefined(); expect(result.doc.clips[0].motion?.controllers).toHaveLength(1); expect(a.motion?.controllers).toHaveLength(2);
  });
  it("duplicates sparse controllers and blocks with fresh collision-free IDs", () => {
    const doc = scene(actor());
    const copied = editMotionGraph(doc, { type: "duplicate", nodeId: id("actor", "controller", "target") }, 0);
    const again = editMotionGraph(copied.doc, { type: "duplicate", nodeId: id("actor", "controller", "target") }, 0);
    expect(again.doc.clips[0].motion!.controllers!.map(c => c.id)).toEqual(["target", "target-copy-1", "target-copy-2"]);
    const block = editMotionGraph(doc, { type: "duplicate", nodeId: id("actor", "block", "lift") }, 0);
    expect(block.doc.clips[0].motion!.blocks![1]).toMatchObject({ start: 2, duration: 2, id: "lift-copy-1" });
  });
  it("suspends and resumes relationships, rejecting conflicts without replacing the scene", () => {
    const doc = scene(actor()), suspended = editMotionGraph(doc, { type: "toggle", nodeId: id("actor", "constraint", "reach") }, 0);
    expect(suspended.doc.clips[0].motion!.constraints![0].enabled).toBe(false);
    expect(editMotionGraph(suspended.doc, { type: "toggle", nodeId: id("actor", "constraint", "reach") }, 0).doc.clips[0].motion!.constraints![0].enabled).toBe(true);
    const copied = editMotionGraph(doc, { type: "duplicate", nodeId: id("actor", "constraint", "reach") }, 0);
    const conflict = editMotionGraph(copied.doc, { type: "toggle", nodeId: id("actor", "constraint", "reach-copy-1") }, 0);
    expect(conflict.error).toMatch(/conflicting/i); expect(conflict.doc).toBe(copied.doc);
  });
  it("removes scene operators, protects source controls, and rejects stale or artwork-node edits", () => {
    const a = actor(); a.rig.motion = { controllers: [{ id: "source", space: "rig", x: 5, y: 10 }] };
    const doc = scene(a);
    expect(editMotionGraph(doc, { type: "remove", nodeId: id("actor", "block", "lift") }, 0).doc.clips[0].motion!.blocks).toEqual([]);
    expect(editMotionGraph(doc, { type: "remove", nodeId: id("actor", "constraint", "reach") }, 0).doc.clips[0].motion!.constraints).toEqual([]);
    for (const edit of [
      { type: "remove" as const, nodeId: id("actor", "controller", "source") },
      { type: "toggle" as const, nodeId: id("actor", "controller", "target") },
      { type: "remove" as const, nodeId: id("actor", "object") },
      { type: "remove" as const, nodeId: "gone" },
    ]) { const result = editMotionGraph(doc, edit, 0); expect(result.error).toBeTruthy(); expect(result.doc).toBe(doc); }
  });
});
