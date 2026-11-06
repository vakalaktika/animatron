"use client";

import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, type MotionValue } from "motion/react";
import type { Clip, KeyedProp, StudioDoc } from "@/app/components/motion-studio/types";
import type { MotionBlock, MotionConstraint, MotionController } from "@/app/components/motion-studio/engine/motionTypes";
import { evaluateScene, targetSocketTransform } from "@/app/components/motion-studio/engine/motionScene";
import { applyMatrix, world } from "@/app/components/motion-studio/engine/rig";
import { toLocalPoint, toWorldPoint } from "@/app/components/motion-studio/engine/transform";
import { Button } from "@/app/components/shared-components";
import { addMotionController, addMotionPath, changeConstraint, changeController, changeMotionBlock, controllerAt, editableMotion, keyMotionController, removeMotionController, retimeMotionBlock, retimeControllerKey, removeControllerKey } from "../lib/motionEdit";
import { BUTTON_ROW, NumField, SelectField, TextField, ToggleField } from "./fields";
import { MotionFieldsMesh } from "./MotionFieldsMesh";
import { EaseField } from "./EaseField";
import { validateMotionDocument } from "@/app/components/motion-studio/engine/motionValidation";

type Change = (clip: Clip) => void;
const spring = { type: "spring", stiffness: 180, damping: 24 } as const;
const properties: { value: KeyedProp; label: string }[] = [{ value: "x", label: "Horizontal" }, { value: "y", label: "Vertical" }, { value: "rotation", label: "Turn" }, { value: "scale", label: "Size" }, { value: "opacity", label: "Opacity" }];
const uniqueId = (clip: Clip, prefix: string) => {
  const program = editableMotion(clip);
  const ids = new Set([...program.blocks, ...program.controllers, ...program.constraints].map(item => item.id));
  let n = 1;
  while (ids.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
};

function BlockFields({ clip, block, onChange }: { clip: Clip; block: MotionBlock; onChange: Change }) {
  const label = block.name || block.id;
  const update = (next: MotionBlock) => onChange(changeMotionBlock(clip, next));
  const controls = editableMotion(clip).controllers;
  return <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-hairline p-3">
    <legend className="px-1 atm-label">{label}</legend>
    <ToggleField label={`${label} enabled`} value={block.enabled !== false} onChange={enabled => update({ ...block, enabled })} />
    <TextField label={`${label} name`} value={block.name ?? ""} onChange={name => update({ ...block, name })} />
    <div className="grid grid-cols-2 gap-3">
      <NumField label={`${label} start`} unit="s" value={block.start} min={0} max={600} onChange={start => onChange(retimeMotionBlock(clip, block.id, start, block.duration))} />
      <NumField label={`${label} duration`} unit="s" value={block.duration} min={0.01} max={600} onChange={duration => onChange(retimeMotionBlock(clip, block.id, block.start, duration))} />
    </div>
    <NumField label={`${label} repeats`} value={block.repeat ?? 1} min={1} max={100} step={1} onChange={repeat => { if (Number.isInteger(repeat) && repeat >= 1 && repeat <= 100) update({ ...block, repeat }); }} />
    <ToggleField label={`${label} return on alternate repeats`} value={!!block.alternate} onChange={alternate => update({ ...block, alternate })} />
    <EaseField label={`${label} timing`} value={block.ease ?? {name:"inOut"}} onChange={ease=>update({...block,ease})} />
    {controls.length > 0 && <SelectField label={`${label} moves`} value={block.controllerId ?? ""} options={[{ value: "", label: "This object" }, ...controls.map(c => ({ value: c.id, label: c.name ?? c.id }))]} onChange={id => update({ ...block, controllerId: id || undefined })} />}
    {block.type === "path" && <>
      <ToggleField label={`${label} turn along path`} value={!!block.orient} onChange={orient => update({ ...block, orient })} />
      <ToggleField label={`${label} closed path`} value={!!block.closed} onChange={closed => update({ ...block, closed })} />
      {block.orient && <NumField label={`${label} facing offset`} unit="°" value={block.facingOffset ?? 0} min={-360} max={360} onChange={facingOffset => update({ ...block, facingOffset })} />}
      <p className="atm-help">Path points are offsets. Your existing position and artwork stay editable.</p>
      {block.points.map((point, i) => <div key={i} className="grid grid-cols-2 gap-3">
        {(["x", "y"] as const).map(axis => <NumField key={axis} label={`${label} point ${i + 1} ${axis.toUpperCase()}`} unit="px" value={point[axis]} min={-2500} max={2500} step={1} onChange={value => update({ ...block, points: block.points.map((p, j) => i === j ? { ...p, [axis]: value } : p) })} />)}
      </div>)}
      <div className={BUTTON_ROW}>
        <Button size="xs" variant="outline" disabled={block.points.length >= 64} onClick={() => update({ ...block, points: [...block.points, { x: (block.points.at(-1)?.x ?? 0) + 80, y: block.points.at(-1)?.y ?? 0 }] })}>Add path point</Button>
        <Button size="xs" variant="outline" disabled={block.points.length <= 2} onClick={() => update({ ...block, points: block.points.slice(0, -1) })}>Remove last point</Button>
      </div>
    </>}
    {block.type === "transform" && properties.map(prop => <div key={prop.value} className="grid grid-cols-2 gap-3">
      <NumField label={`${label} ${prop.label} from`} value={block.from[prop.value] ?? 0} min={-2500} max={2500} onChange={value => update({ ...block, from: { ...block.from, [prop.value]: value } })} />
      <NumField label={`${label} ${prop.label} to`} value={block.to[prop.value] ?? 0} min={-2500} max={2500} onChange={value => update({ ...block, to: { ...block.to, [prop.value]: value } })} />
    </div>)}
    {block.type === "oscillate" && <>
      <SelectField label={`${label} property`} value={block.property} options={properties} onChange={property => update({ ...block, property })} />
      <NumField label={`${label} amount`} value={block.amplitude} min={-100} max={100} onChange={amplitude => update({ ...block, amplitude })} />
      <NumField label={`${label} cycles`} value={block.cycles ?? 1} min={0.01} max={100} onChange={cycles => { if (cycles > 0) update({ ...block, cycles }); }} />
    </>}
    <Button size="xs" variant="outline" onClick={()=>onChange(changeMotionBlock(clip,{...block,id:uniqueId(clip,block.type),start:block.start+block.duration*(block.repeat??1)}))}>Duplicate {label}</Button>
  </fieldset>;
}

function ControllerFields({ doc, clip, control, now, onChange, onSeek }: { doc: StudioDoc; clip: Clip; control: MotionController; now: number; onChange: Change; onSeek:(at:number)=>void }) {
  const label = control.name || control.id;
  const position = controllerAt(control, now - clip.start);
  const used = editableMotion(clip).constraints.some(c => "targetId" in c && c.targetId === control.id) || editableMotion(clip).blocks.some(b => b.controllerId === control.id);
  const portable = clip.type === "rig" && clip.rig.motion?.controllers?.some(c => c.id === control.id);
  const keyTimes=[...new Set(Object.values(control.keys??{}).flatMap(track=>track?.map(k=>k.time)??[]))].sort((a,b)=>a-b);
  const currentKey=Object.values(control.keys??{}).flatMap(track=>track??[]).find(k=>Math.abs(k.time-(now-clip.start))<.0005);
  return <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-hairline p-3">
    <legend className="px-1 atm-label">{label}</legend>
    <TextField label={`${label} label`} value={control.name ?? ""} onChange={name => onChange(changeController(clip, { ...control, name }))} />
    <SelectField label={`${label} follows`} value={control.space==="object"?control.clipId??clip.id:control.space} options={[{value:"stage",label:"Stay on the canvas"},...(clip.type==="rig"?[{value:"rig",label:"Move with this character"}]:[]),...doc.clips.filter(c=>c.id!==clip.id).map(c=>({value:c.id,label:c.name}))]} onChange={value=>onChange(changeController(clip,{...control,space:value==="stage"||value==="rig"?value:"object",clipId:value==="stage"||value==="rig"?undefined:value,slotId:undefined}))} />
    {control.space==="object"&&<SelectField label={`${label} socket`} value={control.slotId??""} options={[{value:"",label:"Object anchor"},...(()=>{const target=doc.clips.find(c=>c.id===control.clipId);return target?.type==="rig"?target.rig.slots?.map(s=>({value:s.id,label:s.id}))??[]:[];})()]} onChange={slotId=>onChange(changeController(clip,{...control,slotId:slotId||undefined}))} />}
    <p className="atm-help">{control.space === "stage" ? "Canvas coordinates" : control.space === "rig" ? "Character drawing coordinates" : `Coordinates relative to ${control.clipId ?? "this object"}`}. Edits add sparse keys at the playhead.</p>
    <div className="grid grid-cols-2 gap-3">
      {(["x", "y"] as const).map(axis => <NumField key={axis} label={`${label} ${axis.toUpperCase()}`} unit="px" value={position[axis]} min={-2500} max={2500} step={1} onChange={value => onChange(keyMotionController(clip, control.id, now, { ...position, [axis]: value }))} />)}
    </div>
    {currentKey&&<EaseField label={`${label} key timing`} value={currentKey.ease??{name:"inOut"}} onChange={ease=>onChange(changeController(clip,{...control,keys:Object.fromEntries(Object.entries(control.keys??{}).map(([axis,track])=>[axis,track?.map(k=>Math.abs(k.time-currentKey.time)<.0005?{...k,ease}:k)]))}))}/>}
    {keyTimes.length>0&&<div role="group" aria-label={`${label} target keys`} className="max-h-64 overflow-y-auto rounded border border-hairline p-2">
      <p className="atm-help mb-2">Move these times to change the action’s timing. X and Y keys move together.</p>
      {keyTimes.map(at=><div key={at} className="mb-3 grid grid-cols-[1fr_auto] gap-2">
        <NumField label={`${label} key ${at.toFixed(2)} time`} unit="s" value={at} min={0} max={600} onChange={to=>onChange(retimeControllerKey(clip,control.id,at,to))}/>
        <div className="flex flex-col gap-1"><Button size="xs" variant="outline" onClick={()=>onSeek(at)}>Go</Button><button type="button" className="text-xs text-ink-muted" aria-label={`Remove ${label} key at ${at.toFixed(2)} seconds`} onClick={()=>onChange(removeControllerKey(clip,control.id,at))}>Remove</button></div>
      </div>)}
    </div>}
    <Button size="xs" variant="outline" disabled={!!used || !!portable} onClick={() => onChange(removeMotionController(clip, control.id))}>Remove {label} target</Button>
    {used && <p className="atm-help">Disconnect this target from its actions and relationships before removing it.</p>}
  </fieldset>;
}

function ConstraintFields({ doc, clip, constraint, onChange }: { doc: StudioDoc; clip: Clip; constraint: MotionConstraint; onChange: Change }) {
  const label = constraint.name || constraint.id;
  const update = (next: MotionConstraint) => {
    if (next.type === "attach" && constraint.type === "attach" && (next.start !== constraint.start || next.targetClipId !== constraint.targetClipId || next.slotId !== constraint.slotId)) {
      const clock = clip.start + (next.start ?? 0);
      const current = evaluateScene(doc, clock).transforms[clip.id];
      const target = targetSocketTransform(doc, next.targetClipId, next.slotId, clock);
      const point = toLocalPoint(target, current);
      onChange(changeConstraint(clip, { ...next, offset: { ...point, rotation: current.rotation - target.rotation } }));
    } else onChange(changeConstraint(clip, next));
  };
  const controllers = editableMotion(clip).controllers.map(c => ({ value: c.id, label: c.name ?? c.id }));
  const bones = clip.type === "rig" ? clip.rig.bones.map(b => ({ value: b.id, label: b.name ?? b.role ?? b.id })) : [];
  const targetClip = constraint.type === "attach" ? doc.clips.find(c => c.id === constraint.targetClipId) : undefined;
  return <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-hairline p-3">
    <legend className="px-1 atm-label">{label}</legend>
    <ToggleField label={`${label} enabled`} value={constraint.enabled !== false} onChange={enabled => update({ ...constraint, enabled })} />
    <NumField label={`${label} strength`} value={constraint.weight ?? 1} min={0} max={1} onChange={weight => { if (weight >= 0 && weight <= 1) update({ ...constraint, weight }); }} />
    <div className="grid grid-cols-2 gap-3">
      <NumField label={`${label} starts`} unit="s" value={constraint.start ?? 0} min={0} max={600} onChange={start => { if (start >= 0 && start < (constraint.end ?? 600)) update({ ...constraint, start }); }} />
      <NumField label={`${label} ends`} unit="s" value={constraint.end ?? 8} min={0.01} max={600} onChange={end => { if (end > (constraint.start ?? 0) && end <= 600) update({ ...constraint, end }); }} />
    </div>
    {constraint.type !== "attach" && <SelectField label={`${label} target`} value={constraint.targetId} options={controllers} onChange={targetId => update({ ...constraint, targetId })} />}
    {constraint.type === "ik" && <>
      <SelectField label={`${label} end joint`} value={constraint.tipId} options={bones.filter(option => clip.type === "rig" && clip.rig.bones.find(b => b.id === clip.rig.bones.find(t => t.id === option.value)?.parentId)?.parentId)} onChange={tipId => {
        if (clip.type !== "rig") return;
        const tip = clip.rig.bones.find(b => b.id === tipId);
        const mid = clip.rig.bones.find(b => b.id === tip?.parentId);
        if (mid?.parentId) update({ ...constraint, tipId, midId: mid.id, rootId: mid.parentId });
      }} />
      <p className="atm-help">Chain: {constraint.rootId} → {constraint.midId} → {constraint.tipId}</p>
      <SelectField label={`${label} bend direction`} value={String(constraint.bend)} options={[{ value: "1", label: "Positive" }, { value: "-1", label: "Negative" }]} onChange={value => update({ ...constraint, bend: value === "1" ? 1 : -1 })} />
    </>}
    {constraint.type === "aim" && <>
      <SelectField label={`${label} turns`} value={constraint.boneId} options={bones} onChange={boneId => update({ ...constraint, boneId })} />
      <NumField label={`${label} angle offset`} unit="°" value={constraint.offset ?? 0} min={-360} max={360} onChange={offset => update({ ...constraint, offset })} />
    </>}
    {constraint.type === "attach" && <>
      <SelectField label={`${label} follows`} value={constraint.targetClipId} options={doc.clips.filter(c => c.id !== clip.id).map(c => ({ value: c.id, label: c.name }))} onChange={targetClipId => update({ ...constraint, targetClipId, slotId: undefined })} />
      <SelectField label={`${label} socket`} value={constraint.slotId ?? ""} options={[{ value: "", label: "Object anchor" }, ...(targetClip?.type === "rig" ? targetClip.rig.slots?.map(s => ({ value: s.id, label: s.id })) ?? [] : [])]} onChange={slotId => update({ ...constraint, slotId: slotId || undefined })} />
      <ToggleField label={`${label} follow rotation`} value={constraint.followRotation !== false} onChange={followRotation => update({ ...constraint, followRotation })} />
      {(["x", "y", "rotation"] as const).map(axis => <NumField key={axis} label={`${label} grip ${axis}`} unit={axis === "rotation" ? "°" : "px"} value={constraint.offset[axis]} min={-2500} max={2500} onChange={value => update({ ...constraint, offset: { ...constraint.offset, [axis]: value } })} />)}
    </>}
  </fieldset>;
}

function Relationships({ clip, onChange }: { clip: Clip; onChange: Change }) {
  const program = editableMotion(clip);
  const sources=[...program.controllers.map(c=>({id:c.id,text:`${c.name??c.id} → target`})),...program.constraints.filter(c=>c.type==="attach").map(c=>({id:c.type==="attach"?c.targetClipId:c.id,text:c.type==="attach"?c.targetClipId:c.id}))].filter((item,i,all)=>all.findIndex(x=>x.id===item.id)===i);
  const height=Math.max(60,Math.max(sources.length,program.constraints.length)*50+16);
  return <>
    <svg role="group" aria-label="Motion relationships" viewBox={`0 0 300 ${height}`} className="w-full rounded-md bg-surface-sunken">
      {program.constraints.map((c,i)=>{const source="targetId" in c?c.targetId:c.targetClipId,index=sources.findIndex(s=>s.id===source);return <path key={`edge-${c.id}`} d={`M128 ${index*50+32} C146 ${index*50+32} 146 ${i*50+32} 164 ${i*50+32}`} fill="none" stroke="var(--info)" strokeWidth="2" strokeDasharray={c.enabled===false?"4 4":undefined}/>;})}
      {sources.map((row,i)=><g key={`target-${row.id}`} transform={`translate(8 ${i*50+16})`}><rect width="120" height="32" rx="6" fill="var(--surface-raised)" stroke="var(--border-control)"/><text x="6" y="20" fontSize="10" fill="var(--ink)">{row.text.length>19?`${row.text.slice(0,16)}…`:row.text}</text><title>{`Target: ${row.text}`}</title></g>)}
      {program.constraints.map((c,i)=>{
        const toggle=()=>onChange(changeConstraint(clip,{...c,enabled:c.enabled===false}));
        return <g key={`constraint-${c.id}`} role="button" tabIndex={0} aria-label={`${c.enabled===false?"Enable":"Disable"} ${c.name??c.id} relationship`} onClick={toggle} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();}}} transform={`translate(164 ${i*50+16})`} className="cursor-pointer focus-visible:outline-2">
          <rect width="128" height="32" rx="6" fill="var(--surface-raised)" stroke={c.enabled===false?"var(--border-control)":"var(--info)"}/><text x="6" y="20" fontSize="10" fill="var(--ink)">{(c.name??c.id).slice(0,19)}</text><title>{`${c.type}: ${c.name??c.id}. Click to ${c.enabled===false?"enable":"disable"}.`}</title>
        </g>;
      })}
    </svg>
    <p className="atm-help">These are the same targets and relationships edited below. Change a target or socket to reconnect a node; disable a relationship to disconnect it.</p>
  </>;
}

/** Default human controls for the same sparse programs authored by Composer. */
export function MotionFields({ doc, clip, time, onChange }: { doc: StudioDoc; clip: Clip; time: MotionValue<number>; onChange: Change }) {
  const commit=onChange;
  const [now, setNow] = useState(time.get());
  const [advanced, setAdvanced] = useState(false);
  const [message, setMessage] = useState("");
  onChange=(next:Clip)=>{
    const candidate={...doc,version:4,clips:doc.clips.map(c=>c.id===next.id?next:c)};
    const errors=validateMotionDocument(candidate);
    if(errors.length){setMessage(errors[0]);return;}
    setMessage("");commit(next);
  };
  const reduce = useReducedMotion();
  useMotionValueEvent(time, "change", setNow);
  const program = editableMotion(clip);
  const local = Math.max(0, now - clip.start);
  const duration = Math.max(1, ...program.blocks.map(b => b.start + b.duration * (b.repeat ?? 1)), ...program.constraints.map(c => c.end ?? 0));
  const chains = clip.type === "rig" ? clip.rig.bones.filter(tip => {
    const mid = clip.rig.bones.find(b => b.id === tip.parentId);
    return mid && clip.rig.bones.some(b => b.id === mid.parentId);
  }).sort((a, b) => Number(/hand|foot/.test(b.role ?? b.id)) - Number(/hand|foot/.test(a.role ?? a.id))) : [];
  const scene = evaluateScene(doc, now);
  const addConstraint = (type: "ik" | "aim" | "attach") => {
    if (type === "attach") {
      const target = doc.clips.find(c => c.id !== clip.id);
      if (!target) return;
      const current = scene.transforms[clip.id], frame = scene.transforms[target.id];
      const point = toLocalPoint(frame, current);
      onChange(changeConstraint(clip, { id: uniqueId(clip, "grip"), name: "Prop attachment", type: "attach", targetClipId: target.id, start: local, end: Math.min(600, local + 2), offset: { ...point, rotation: current.rotation - frame.rotation }, weight: 1, followRotation: true }));
      setMessage("Attachment added without moving the object. Choose its socket and grip offset below.");
      return;
    }
    if (clip.type !== "rig") return;
    const tip = type === "ik" ? chains[0] : clip.rig.bones.find(b => b.role === "head") ?? clip.rig.bones.at(-1);
    if (!tip) return;
    const bone = world(clip.rig, scene.poses[clip.id])[tip.id];
    const canvasPoint = applyMatrix(bone, { x: type === "aim" ? 120 : 0, y: 0 });
    const point = toWorldPoint(scene.transforms[clip.id], { x: canvasPoint.x - clip.rig.canvas.width / 2, y: canvasPoint.y - clip.rig.canvas.height / 2 });
    const next = addMotionController(clip, point, type === "ik" ? "Hand or foot" : "Gaze");
    const targetId = editableMotion(next).controllers.at(-1)!.id;
    const id = uniqueId(next, type);
    const common = { id, targetId, start: local, end: Math.min(600, local + 2), weight: 1 };
    if (type === "aim") {
      const bone = clip.rig.bones.find(b => b.role === "head") ?? clip.rig.bones.at(-1);
      if (bone) onChange(changeConstraint(next, { ...common, name: "Look toward target", type, boneId: bone.id, offset: 0 }));
    } else {
      const mid = clip.rig.bones.find(b => b.id === tip?.parentId);
      if (tip && mid?.parentId) onChange(changeConstraint(next, { ...common, name: "Hand or foot contact", type, rootId: mid.parentId, midId: mid.id, tipId: tip.id, bend: 1 }));
    }
  };
  return <div className="flex flex-col gap-4">
    <p className="atm-help">Give objects a path, pose targets, and keep contacts intact between keyframes. Times below are relative to this layer’s start.</p>
    <div className={BUTTON_ROW}>
      <Button size="xs" onClick={() => onChange(addMotionPath(clip, local))}>Add motion path</Button>
      <Button size="xs" variant="outline" onClick={() => onChange(changeMotionBlock(clip, { id: uniqueId(clip, "move"), name: "Lift and hold", type: "transform", start: local, duration: 1, from: {}, to: { y: -40 }, ease: { name: "inOut" } }))}>Add lift</Button>
      <Button size="xs" variant="outline" onClick={() => onChange(changeMotionBlock(clip, { id: uniqueId(clip, "breath"), name: "Breathing", type: "oscillate", start: local, duration: 4, property: "y", amplitude: 2, cycles: 1 }))}>Add breathing</Button>
      <Button size="xs" variant="outline" onClick={() => onChange(addMotionController(clip, { x: clip.x, y: clip.y }))}>Add target</Button>
    </div>
    <div className={BUTTON_ROW}>
      {clip.type === "rig" && <>
        <Button size="xs" variant="outline" disabled={!chains.length} onClick={() => addConstraint("ik")}>Add hand or foot contact</Button>
        <Button size="xs" variant="outline" onClick={() => addConstraint("aim")}>Add gaze</Button>
      </>}
      <Button size="xs" variant="outline" disabled={doc.clips.length < 2} onClick={() => addConstraint("attach")}>Attach to object or grip</Button>
    </div>
    {program.blocks.length > 0 && <div role="group" aria-label="Motion timeline" className="flex flex-col gap-2">
      {program.blocks.map(block => <div key={block.id} className="flex items-center gap-2">
        <button type="button" className="atm-chip min-h-8 text-xs" aria-label={`Go to ${block.name ?? block.id} start`} onClick={() => time.set(clip.start + block.start)}>{block.name ?? block.id}</button>
        <svg viewBox="0 0 100 8" aria-hidden="true" className="h-2 min-w-8 flex-1"><rect x={block.start / duration * 100} width={block.duration * (block.repeat ?? 1) / duration * 100} height="8" rx="2" fill="var(--info)" opacity={block.enabled === false ? 0.3 : 1} /></svg>
        <button type="button" className="atm-chip min-h-8 text-xs tabular-nums" aria-label={`Go to ${block.name ?? block.id} end`} onClick={() => time.set(clip.start + block.start + block.duration * (block.repeat ?? 1))}>{(block.start + block.duration * (block.repeat ?? 1)).toFixed(2)} s</button>
      </div>)}
    </div>}
    <button type="button" aria-expanded={advanced} className="atm-chip min-h-9 text-left text-xs" onClick={() => setAdvanced(value => !value)}>Relationships (advanced)</button>
    <AnimatePresence initial={false}>{advanced && <motion.div key="relationships" className="flex flex-col gap-4" initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }} transition={reduce ? { duration: 0 } : spring}><Relationships clip={clip} onChange={onChange} />{clip.type === "rig" && <MotionFieldsMesh clip={clip} onChange={onChange} />}</motion.div>}</AnimatePresence>
    {program.controllers.map(control => <ControllerFields key={control.id} doc={doc} clip={clip} control={control} now={now} onChange={onChange} onSeek={at=>time.set(clip.start+at)} />)}
    {program.blocks.map(block => <BlockFields key={block.id} clip={clip} block={block} onChange={onChange} />)}
    {program.constraints.map(constraint => <ConstraintFields key={constraint.id} doc={doc} clip={clip} constraint={constraint} onChange={onChange} />)}
    {scene.diagnostics.filter(diagnostic => diagnostic.clipId === clip.id).map((diagnostic, i) => <p role="alert" className="atm-help text-danger" key={`${diagnostic.operatorId}-${i}`}>{diagnostic.message}</p>)}
    <p role="status" className="atm-help">{message}</p>
  </div>;
}
