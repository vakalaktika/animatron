"use client";

import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { validateMotionDocument } from "@/app/components/motion-studio/engine/motionValidation";
import type { MotionGraphNode } from "../lib/motionGraph";
import { changeConstraint, changeController, changeMotionBlock, controllerAt, editableMotion, keyMotionController } from "../lib/motionEdit";

export function nodeActive(doc: StudioDoc, node: MotionGraphNode, time: number) {
  const clip = doc.clips.find(c => c.id === node.clipId);
  if (!clip || !clip.enabled || !node.enabled) return false;
  const local = time - clip.start, program = editableMotion(clip);
  if (local < 0) return false;
  if (node.kind === "block") {
    const block = program.blocks.find(b => b.id === node.itemId);
    return !!block && local >= block.start && local <= block.start + block.duration * (block.repeat ?? 1);
  }
  if (node.kind === "constraint") {
    const constraint = program.constraints.find(c => c.id === node.itemId);
    return !!constraint && local >= (constraint.start ?? 0) && local <= (constraint.end ?? 600);
  }
  return true;
}

const inputClass = "w-full rounded border border-border-control bg-surface-raised px-2 py-1.5 text-xs text-ink";

export function MotionNodeInspector({ doc, node, time, onChange, onError }: { doc: StudioDoc; node: MotionGraphNode | undefined; time: number; onChange: (doc: StudioDoc) => void; onError: (error: string) => void }) {
  if (!node) return <p className="p-3 text-xs leading-5 text-ink-muted">Select a node to edit it. Drag between matching ports, or select two port labels to connect.</p>;
  const clip = doc.clips.find(c => c.id === node.clipId);
  if (!clip) return null;
  const program = editableMotion(clip);
  const block = node.kind === "block" ? program.blocks.find(b => b.id === node.itemId) : undefined;
  const controller = node.kind === "controller" ? program.controllers.find(c => c.id === node.itemId) : undefined;
  const constraint = node.kind === "constraint" ? program.constraints.find(c => c.id === node.itemId) : undefined;
  const update = (next: Clip) => {
    const candidate: StudioDoc = { ...doc, version: 4, clips: doc.clips.map(c => c.id === next.id ? next : c) };
    const errors = validateMotionDocument(candidate);
    if (errors.length) onError(errors[0]); else { onError(""); onChange(candidate); }
  };
  const number = (label: string, value: number, change: (value: number) => void, min = 0, max = 600) => <label className="flex flex-col gap-1 text-[11px] text-ink-secondary">{label}<input aria-label={label} type="number" className={inputClass} min={min} max={max} step="0.01" value={Math.round(value * 1000) / 1000} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= min && value <= max) change(value); }} /></label>;
  const rename = (name: string) => {
    if (block) update(changeMotionBlock(clip, { ...block, name }));
    else if (controller) update(changeController(clip, { ...controller, name }));
    else if (constraint) update(changeConstraint(clip, { ...constraint, name }));
    else if (node.kind === "object") update({ ...clip, name });
  };
  const canRename = !!(block || controller || constraint || node.kind === "object");
  return <aside aria-label="Node inspector" className="flex h-full flex-col gap-3 overflow-y-auto p-3">
    <h3 className="text-xs font-semibold text-ink">{node.label}</h3>
    <p className="text-[11px] text-ink-muted">{clip.name} · {node.provenance === "rig" ? "Reusable rig control; edits become scene overrides." : "Scene control"}</p>
    {canRename && <label className="flex flex-col gap-1 text-[11px] text-ink-secondary">Name<input aria-label="Node name" className={inputClass} value={block?.name ?? controller?.name ?? constraint?.name ?? clip.name} onChange={e => rename(e.target.value)} /></label>}
    <p className="text-[11px] text-ink-muted">Scene {time.toFixed(2)} s · Object {(time - clip.start).toFixed(2)} s</p>
    {block && <>
      {number("Node start", block.start, start => update(changeMotionBlock(clip, { ...block, start })))}
      {number("Node duration", block.duration, duration => update(changeMotionBlock(clip, { ...block, duration })), .01)}
      {number("Node repeats", block.repeat ?? 1, repeat => { if (Number.isInteger(repeat)) update(changeMotionBlock(clip, { ...block, repeat })); }, 1, 100)}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!block.alternate} onChange={e => update(changeMotionBlock(clip, { ...block, alternate: e.target.checked }))} />Alternate direction</label>
      {block.type === "path" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!block.orient} onChange={e => update(changeMotionBlock(clip, { ...block, orient: e.target.checked }))} />Face along path</label>}
      {block.type === "oscillate" && number("Motion amount", block.amplitude, amplitude => update(changeMotionBlock(clip, { ...block, amplitude })), -2500, 2500)}
    </>}
    {constraint && <>
      {number("Relationship start", constraint.start ?? 0, start => update(changeConstraint(clip, { ...constraint, start })))}
      {number("Relationship end", constraint.end ?? 600, end => update(changeConstraint(clip, { ...constraint, end })), .01)}
      {number("Relationship strength", constraint.weight ?? 1, weight => update(changeConstraint(clip, { ...constraint, weight })), 0, 1)}
      {constraint.type === "ik" && <label className="flex flex-col gap-1 text-xs">Elbow / knee bend<select className={inputClass} aria-label="Bend direction" value={constraint.bend} onChange={e => update(changeConstraint(clip, { ...constraint, bend: Number(e.target.value) === 1 ? 1 : -1 }))}><option value="1">Positive</option><option value="-1">Negative</option></select></label>}
    </>}
    {controller && <>
      <p className="text-[11px] text-ink-muted">Position edits add keys at the playhead in {controller.space} coordinates.</p>
      {(["x", "y"] as const).map(axis => {
        const point = controllerAt(controller, Math.max(0, time - clip.start));
        return <div key={axis}>{number(`Target ${axis.toUpperCase()}`, point[axis], value => update(keyMotionController(clip, controller.id, time, { ...point, [axis]: value })), -2500, 2500)}</div>;
      })}
    </>}
    {(node.kind === "bone" || node.kind === "socket") && <p className="text-[11px] leading-5 text-ink-muted">This is a registered point on the artwork. Use its output to connect a limb or attachment. Edit its structure in the character controls.</p>}
  </aside>;
}
