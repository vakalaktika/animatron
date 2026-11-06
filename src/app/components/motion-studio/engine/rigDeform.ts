import type { RigAsset, RigPose, Vec2 } from "../types";
import { applyMatrix, inverse, multiply, world, type Matrix } from "./rig";
import { pngInfo, rasterSource } from "./rigV2";

/** Rest-canvas mesh; texture coordinates are its rest positions in the registered PNG rectangle. */
export interface RigMeshAttachment {
  id: string;
  rasterId: string;
  vertices: { x: number; y: number; weights: { boneId: string; weight: number }[] }[];
  triangles: [number, number, number][];
}

export const MESH_LIMITS = { meshes: 8, vertices: 128, triangles: 256, weights: 4 } as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e7;
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(v);
const area = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Extension-only checks. Existing PNG and SVG validators remain authoritative and unchanged. */
export function validateRigMeshes(asset: unknown): string[] {
  if (!object(asset) || asset.meshes === undefined) return [];
  if (asset.version !== 4) return ["Raster mesh deformation requires Rig version 4."];
  if (!Array.isArray(asset.meshes) || asset.meshes.length > MESH_LIMITS.meshes) return ["Expected at most 8 raster meshes."];
  const errors: string[] = [];
  const bones = new Set((Array.isArray(asset.bones) ? asset.bones : []).filter(object).map(b => b.id));
  const rasters = (Array.isArray(asset.rasterAttachments) ? asset.rasterAttachments : []).filter(object);
  const bindings = (Array.isArray(asset.bindings) ? asset.bindings : []).filter(object);
  const usedIds = new Set(), usedRasters = new Set();
  for (const mesh of asset.meshes) {
    if (!object(mesh) || !id(mesh.id) || usedIds.has(mesh.id) || !id(mesh.rasterId) || usedRasters.has(mesh.rasterId)) {
      errors.push("Meshes require unique IDs and unique registered raster targets."); continue;
    }
    usedIds.add(mesh.id); usedRasters.add(mesh.rasterId);
    const raster = rasters.find(r => r.id === mesh.rasterId);
    if (!raster || !bindings.some(b => b.svgId === raster.svgId) || !pngInfo(rasterSource(asset as Partial<RigAsset>,raster as {src:string})) || raster.sourceRect!==undefined || ![raster.x, raster.y, raster.width, raster.height].every(finite) || (raster.width as number) <= 0 || (raster.height as number) <= 0) {
      errors.push("Mesh target must be an existing bound, validated PNG attachment."); continue;
    }
    if (!Array.isArray(mesh.vertices) || mesh.vertices.length < 3 || mesh.vertices.length > MESH_LIMITS.vertices) {
      errors.push("A mesh requires 3–128 rest vertices."); continue;
    }
    let validVertices = true;
    for (const v of mesh.vertices) {
      if (!object(v) || !finite(v.x) || !finite(v.y) || v.x < (raster.x as number) || v.y < (raster.y as number) || v.x > (raster.x as number) + (raster.width as number) || v.y > (raster.y as number) + (raster.height as number)) {
        errors.push("Mesh rest vertices must lie inside their PNG rectangle."); validVertices = false; continue;
      }
      if (!Array.isArray(v.weights) || !v.weights.length || v.weights.length > MESH_LIMITS.weights) {
        errors.push("Each mesh vertex requires 1–4 bone weights."); continue;
      }
      let sum = 0;
      const seen = new Set();
      for (const w of v.weights) {
        if (!object(w) || !id(w.boneId) || !bones.has(w.boneId) || seen.has(w.boneId) || !finite(w.weight) || w.weight <= 0 || w.weight > 1) {
          errors.push("Mesh weights require existing, unique bones and positive finite values."); continue;
        }
        seen.add(w.boneId); sum += w.weight;
      }
      if (Math.abs(sum - 1) > 1e-6) errors.push("Mesh bone weights must sum to one.");
    }
    if (!Array.isArray(mesh.triangles) || !mesh.triangles.length || mesh.triangles.length > MESH_LIMITS.triangles) {
      errors.push("A mesh requires 1–256 triangles."); continue;
    }
    const vertices = mesh.vertices as Vec2[];
    for (const t of mesh.triangles) {
      if (!Array.isArray(t) || t.length !== 3 || t.some(i => !Number.isInteger(i) || i < 0 || i >= vertices.length) || new Set(t).size !== 3) {
        errors.push("Mesh triangles require three distinct, existing vertex indices."); continue;
      }
      if (validVertices && Math.abs(area(vertices[t[0]], vertices[t[1]], vertices[t[2]])) < 1e-6) errors.push("Mesh rest triangles must have nonzero area.");
    }
  }
  return [...new Set(errors)];
}

/** Linear blend skinning in rig-canvas coordinates, with rest matrices cancelled per influence. */
export function deformMesh(asset: RigAsset, pose: RigPose, mesh: RigMeshAttachment): Vec2[] {
  const rest = world(asset), posed = world(asset, pose);
  const matrices = Object.fromEntries(asset.bones.map(b => [b.id, multiply(posed[b.id], inverse(rest[b.id]))]));
  return mesh.vertices.map(v => v.weights.reduce((result, influence) => {
    const p = applyMatrix(matrices[influence.boneId], v);
    return { x: result.x + p.x * influence.weight, y: result.y + p.y * influence.weight };
  }, { x: 0, y: 0 }));
}

/** Affine texture map for one triangle; collapsed triangles are not drawable. */
export function meshTriangleMatrix(rest: [Vec2, Vec2, Vec2], posed: [Vec2, Vec2, Vec2]): Matrix | null {
  if (Math.abs(area(...rest)) < 1e-8 || Math.abs(area(...posed)) < 1e-8) return null;
  const basis = (v: [Vec2, Vec2, Vec2]): Matrix => [v[1].x - v[0].x, v[1].y - v[0].y, v[2].x - v[0].x, v[2].y - v[0].y, v[0].x, v[0].y];
  return multiply(basis(posed), inverse(basis(rest)));
}
