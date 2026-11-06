"use client";

import { useState } from "react";
import type { RigClip } from "@/app/components/motion-studio/types";
import { changeMeshWeight } from "../lib/motionEdit";
import { NumField, SelectField } from "./fields";

/** A narrow weight inspector for prepared topology, rather than a general mesh authoring tool. */
export function MotionFieldsMesh({ clip, onChange }: { clip: RigClip; onChange: (clip: RigClip) => void }) {
  const [meshId, setMeshId] = useState(clip.rig.meshes?.[0]?.id ?? "");
  const [vertexIndex, setVertexIndex] = useState(0);
  const mesh = clip.rig.meshes?.find(item => item.id === meshId) ?? clip.rig.meshes?.[0];
  const vertex = mesh?.vertices[vertexIndex];
  if (!mesh || !vertex) return null;
  return <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-hairline p-3">
    <legend className="px-1 atm-label">Illustrated bending weights</legend>
    <p className="atm-help">Edit the bone influence on prepared artwork. Other weights adjust to keep their total at one; the original topology stays intact.</p>
    <SelectField label="Bending artwork" value={mesh.id} options={clip.rig.meshes!.map(item => ({ value: item.id, label: item.id }))} onChange={id => { setMeshId(id); setVertexIndex(0); }} />
    <SelectField label="Bending point" value={String(vertexIndex)} options={mesh.vertices.map((point, index) => ({ value: String(index), label: `${index + 1}: (${point.x}, ${point.y})` }))} onChange={index => setVertexIndex(Number(index))} />
    {vertex.weights.length === 1 ? <p className="atm-help">This point follows {vertex.weights[0].boneId} fully. Choose a blended point to adjust its weights.</p> : vertex.weights.map(influence => <NumField key={influence.boneId} label={`${influence.boneId} influence`} value={influence.weight} min={0.001} max={0.999} step={0.01} onChange={weight => onChange(changeMeshWeight(clip, mesh.id, vertexIndex, influence.boneId, weight))} />)}
  </fieldset>;
}
