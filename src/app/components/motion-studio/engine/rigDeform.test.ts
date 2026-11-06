import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RigAsset } from "../types";
import { deformMesh, meshTriangleMatrix, validateRigMeshes, type RigMeshAttachment } from "./rigDeform";

const png = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../docs/mci-rig/example-illustrated-part.mci.json"), "utf8")).rasterAttachments[0].src;
const mesh = (): RigMeshAttachment => ({ id: "sleeve-mesh", rasterId: "paint", vertices: [
  { x: 0, y: 0, weights: [{ boneId: "root", weight: 1 }] },
  { x: 100, y: 0, weights: [{ boneId: "forearm", weight: 1 }] },
  { x: 100, y: 40, weights: [{ boneId: "forearm", weight: 1 }] },
  { x: 50, y: 40, weights: [{ boneId: "root", weight: 0.5 }, { boneId: "forearm", weight: 0.5 }] },
  { x: 0, y: 40, weights: [{ boneId: "root", weight: 1 }] },
], triangles: [[0, 1, 3], [1, 2, 3], [0, 3, 4]] });
const fixture = (): RigAsset & { meshes: RigMeshAttachment[] } => ({
  format: "mid-century-ink-rig", version: 4 as RigAsset["version"], canvas: { width: 160, height: 100 },
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><g id="sleeve"/></svg>',
  bones: [{ id: "root", parentId: null, rest: { x: 0, y: 0, rotation: 0 }, length: 50 }, { id: "forearm", parentId: "root", rest: { x: 50, y: 0, rotation: 0 }, length: 50 }],
  bindings: [{ id: "binding", svgId: "sleeve", boneId: "root", bindMatrix: [1, 0, 0, 1, 0, 0] }],
  rasterAttachments: [{ id: "paint", svgId: "sleeve", src: png, x: 0, y: 0, width: 100, height: 40 }],
  animations: [], meshes: [mesh()],
});

describe("registered raster mesh deformation", () => {
  it("retains rest coordinates and survives a JSON round trip", () => {
    const asset = JSON.parse(JSON.stringify(fixture()));
    expect(validateRigMeshes(asset)).toEqual([]);
    expect(deformMesh(asset, {}, asset.meshes[0])).toEqual(asset.meshes[0].vertices.map(({ x, y }: {x:number;y:number}) => ({ x, y })));
  });
  it("bends one region while retaining the pinned region and blended influences", () => {
    const asset = fixture();
    const pose = { forearm: { x: 0, y: 0, rotation: 90 } };
    const before = JSON.stringify(asset);
    const actual = deformMesh(asset, pose, asset.meshes[0]);
    expect(actual[0]).toEqual({ x: 0, y: 0 });
    expect(actual[1].x).toBeCloseTo(50);
    expect(actual[1].y).toBeCloseTo(50);
    expect(actual[3].x).toBeCloseTo(30);
    expect(actual[3].y).toBeCloseTo(20);
    expect(Math.hypot(actual[1].x - actual[0].x, actual[1].y - actual[0].y)).not.toBeCloseTo(100);
    expect(JSON.stringify(asset)).toBe(before);
  });
  it("maps each rest triangle onto its skinned triangle", () => {
    const m = meshTriangleMatrix([{x:0,y:0},{x:10,y:0},{x:0,y:10}], [{x:4,y:5},{x:4,y:25},{x:-6,y:5}]);
    expect(m).toEqual([0, 2, -1, 0, 4, 5]);
    expect(meshTriangleMatrix([{x:0,y:0},{x:0,y:0},{x:0,y:1}], [{x:0,y:0},{x:1,y:0},{x:0,y:1}])).toBeNull();
  });
  it.each([
    ["old version", (a: ReturnType<typeof fixture>) => { a.version = 3; }],
    ["external image", (a: ReturnType<typeof fixture>) => { a.rasterAttachments![0].src = "https://invalid/sleeve.png"; }],
    ["missing raster", (a: ReturnType<typeof fixture>) => { a.meshes[0].rasterId = "missing"; }],
    ["missing bone", (a: ReturnType<typeof fixture>) => { a.meshes[0].vertices[0].weights[0].boneId = "missing"; }],
    ["unnormalized", (a: ReturnType<typeof fixture>) => { a.meshes[0].vertices[0].weights[0].weight = 0.7; }],
    ["negative weight", (a: ReturnType<typeof fixture>) => { a.meshes[0].vertices[0].weights[0].weight = -1; }],
    ["duplicate influences", (a: ReturnType<typeof fixture>) => { a.meshes[0].vertices[0].weights = [{boneId:"root",weight:0.5},{boneId:"root",weight:0.5}]; }],
    ["bad index", (a: ReturnType<typeof fixture>) => { a.meshes[0].triangles[0][0] = 99; }],
    ["degenerate triangle", (a: ReturnType<typeof fixture>) => { a.meshes[0].triangles[0] = [0, 0, 1]; }],
    ["bad position", (a: ReturnType<typeof fixture>) => { a.meshes[0].vertices[0].x = Infinity; }],
    ["out of paint", (a: ReturnType<typeof fixture>) => { a.meshes[0].vertices[0].x = -5; }],
    ["too many vertices", (a: ReturnType<typeof fixture>) => { a.meshes[0].vertices = Array.from({length:129},()=>a.meshes[0].vertices[0]); }],
    ["too many triangles", (a: ReturnType<typeof fixture>) => { a.meshes[0].triangles = Array.from({length:257},()=>[0,1,3]); }],
    ["duplicate raster", (a: ReturnType<typeof fixture>) => { a.meshes.push({...a.meshes[0],id:"other"}); }],
  ])("rejects %s", (_label, damage) => {
    const a = fixture(); damage(a); expect(validateRigMeshes(a).length).toBeGreaterThan(0);
  });
  it("permits old assets without the extension and refuses malformed extension containers", () => {
    expect(validateRigMeshes({ version: 1 })).toEqual([]);
    expect(validateRigMeshes(null)).toEqual([]);
    expect(validateRigMeshes({version:4,meshes:{}})).not.toEqual([]);
  });
  it("rejects missing or excessive influences rather than normalizing unknown input",()=>{
    const empty=fixture(); empty.meshes[0].vertices[0].weights=[];
    expect(validateRigMeshes(empty)).toContain("Each mesh vertex requires 1–4 bone weights.");
    const excessive=fixture(); excessive.meshes[0].vertices[0].weights=Array.from({length:5},()=>({boneId:"root",weight:0.2}));
    expect(validateRigMeshes(excessive)).toContain("Each mesh vertex requires 1–4 bone weights.");
  });
  it("validates the editable painted cloth fixture and returns to its registered rest appearance",()=>{
    const asset=JSON.parse(readFileSync(path.resolve(__dirname,"../../../../../examples/deformation-proof/cloth.mci.json"),"utf8"));
    expect(validateRigMeshes(asset)).toEqual([]);
    const actual=deformMesh(asset,{forearm:{x:0,y:0,rotation:58}},asset.meshes[0]);
    const rest=deformMesh(asset,{},asset.meshes[0]);
    expect(actual[0]).toEqual(rest[0]);
    expect(actual[6].y).toBeGreaterThan(rest[6].y+100);
    for(let i=0;i<rest.length;i++) {
      expect(rest[i].x).toBeCloseTo(asset.meshes[0].vertices[i].x);
      expect(rest[i].y).toBeCloseTo(asset.meshes[0].vertices[i].y);
    }
  });
});
