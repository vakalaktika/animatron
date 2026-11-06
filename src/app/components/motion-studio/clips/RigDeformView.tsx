"use client";

import { useId, useMemo, useRef } from "react";
import { useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import type { RigAsset, RigPose, Vec2 } from "../types";
import { matrixString } from "../engine/rig";
import { rasterSource } from "../engine/rigV2";
import { deformMesh, meshTriangleMatrix, validateRigMeshes, type RigMeshAttachment } from "../engine/rigDeform";

/** Tiny overlap removes antialias cracks inside an opaque painted strip; PNG alpha still clips its outside edge. */
function triangleClip(points: [Vec2, Vec2, Vec2]): string {
  const centre = { x: points.reduce((n, p) => n + p.x, 0) / 3, y: points.reduce((n, p) => n + p.y, 0) / 3 };
  return points.map(p => {
    const dx = p.x - centre.x, dy = p.y - centre.y;
    const distance = Math.hypot(dx, dy);
    // A validated, non-collinear triangle cannot have a vertex at its centroid.
    const factor = 1 + 0.15 / distance;
    return `${centre.x + dx * factor},${centre.y + dy * factor}`;
  }).join(" ");
}

function Triangle({ id, imageId, rest, indices, vertices }: {
  id: string; imageId: string; rest: [Vec2, Vec2, Vec2]; indices: [number, number, number]; vertices: MotionValue<Vec2[]>;
}) {
  const ref = useRef<SVGGElement>(null);
  const transform = useTransform(vertices, v => {
    const matrix = meshTriangleMatrix(rest, indices.map(i => v[i]) as [Vec2, Vec2, Vec2]);
    return matrix ? matrixString(matrix) : null;
  });
  useMotionValueEvent(transform, "change", value => {
    ref.current?.setAttribute("transform", value ?? "");
    ref.current?.setAttribute("opacity", value === null ? "0" : "1");
  });
  return <g ref={ref} data-mesh-triangle={id} transform={transform.get() ?? ""} opacity={transform.get() === null ? 0 : 1}>
    <defs><clipPath id={id} clipPathUnits="userSpaceOnUse"><polygon points={triangleClip(rest)} /></clipPath></defs>
    <use href={`#${imageId}`} clipPath={`url(#${id})`} />
  </g>;
}

interface Props {
  asset: RigAsset;
  mesh: RigMeshAttachment;
  pose: MotionValue<RigPose>;
  visibility?: MotionValue<Record<string, boolean>>;
}

/**
 * Fixed-topology raster skinning, rendered at the original bound group's paint position.
 * No outer bone transform: vertices already include all posed bone-world transforms.
 * SVG images/use/clip paths here are generated from validated data; they do not relax the import allowlist.
 */
export function RigDeformView({ asset, mesh, pose, visibility }: Props) {
  const instance = `mesh-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const safe = useMemo(() => validateRigMeshes({ ...asset, meshes: [mesh] }).length === 0, [asset, mesh]);
  const raster = asset.rasterAttachments?.find(r => r.id === mesh.rasterId);
  const vertices = useTransform(pose, p => safe ? deformMesh(asset, p, mesh) : []);
  const opacity = useTransform(() => raster && visibility?.get()[raster.svgId] === false ? "0" : "1");
  const ref = useRef<SVGGElement>(null);
  useMotionValueEvent(opacity, "change", v => ref.current?.setAttribute("opacity", v));
  if (!safe || !raster) return null;
  const imageId = `${instance}-paint`;
  return <g ref={ref} data-rig-part={raster.svgId} data-rig-mesh={mesh.id} opacity={opacity.get()}>
    <defs><image id={imageId} href={rasterSource(asset,raster)} x={raster.x} y={raster.y} width={raster.width} height={raster.height} preserveAspectRatio="none" /></defs>
    {mesh.triangles.map((triangle, i) => <Triangle key={i} id={`${instance}-t${i}`} imageId={imageId} indices={triangle} rest={[mesh.vertices[triangle[0]], mesh.vertices[triangle[1]], mesh.vertices[triangle[2]]]} vertices={vertices} />)}
  </g>;
}
