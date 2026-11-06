"use client";

import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { useMotionValueEvent, type MotionValue } from "motion/react";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { docDuration } from "@/app/components/motion-studio/engine/timing";
import { authoredClipEnd } from "@/app/components/motion-studio/engine/motionTimeline";
import { validateMotionDocument } from "@/app/components/motion-studio/engine/motionValidation";
import { changeConstraint, changeMotionBlock, editableMotion, retimeControllerKey } from "../lib/motionEdit";
import { graphNodeId } from "../lib/motionGraph";

interface Props {
  doc: StudioDoc; clipId: string | null; nodeId?: string | null; time: MotionValue<number>;
  onChange: (doc: StudioDoc) => void; onSelectNode?: (id: string) => void;
}
interface Row {
  id: string; label: string; start: number; length: number; repeat: number;
  kind: "block" | "constraint" | "key"; keyTime?: number;
}
interface Gesture { row: Row; x: number; delta: number; width: number; resize: boolean }
const round = (n: number) => Math.round(n * 100) / 100;
const inputClass = "w-20 rounded border border-border-control bg-surface-raised px-1 py-1 text-xs";

/** Sparse timing edits share the studio clock and canonical motion program. */
export function MotionGraphTimeline({ doc, clipId, nodeId, time, onChange, onSelectNode }: Props) {
  const [now, setNow] = useState(time.get()), [error, setError] = useState("");
  const [preview, setPreview] = useState<Gesture | null>(null);
  const gesture = useRef<Gesture | null>(null), track = useRef<HTMLDivElement | null>(null);
  useMotionValueEvent(time, "change", setNow);
  const clip = doc.clips.find(c => c.id === clipId);
  if (!clip) return <p className="p-3 text-xs">Select an object to edit motion timing.</p>;
  const program = editableMotion(clip), duration = Math.max(1, docDuration(doc));
  const rows: Row[] = [
    ...program.blocks.map(b => ({ id: b.id, label: b.name ?? b.id, start: b.start, length: b.duration, repeat: b.repeat ?? 1, kind: "block" as const })),
    ...program.constraints.map(c => ({ id: c.id, label: c.name ?? c.id, start: c.start ?? 0, length: (c.end ?? Math.min(600, duration - clip.start)) - (c.start ?? 0), repeat: 1, kind: "constraint" as const })),
    ...program.controllers.flatMap(c => [...new Set(Object.values(c.keys ?? {}).flatMap(keys => keys?.map(k => k.time) ?? []))].sort((a,b)=>a-b).map(at => ({ id: c.id, label: c.name ?? c.id, start: at, length: 0, repeat: 1, kind: "key" as const, keyTime: at }))),
  ];
  const nodeFor = (row: Row) => graphNodeId(clip.id, row.kind === "key" ? "controller" : row.kind, row.id);
  const commit = (next: Clip) => {
    const end = next.start + authoredClipEnd(next);
    const candidate: StudioDoc = { ...doc, version: 4, clips: doc.clips.map(c => c.id === next.id ? next : c),
      ...(doc.timeline?.duration !== undefined ? { timeline: { ...doc.timeline, duration: Math.max(doc.timeline.duration, end) } } : {}) };
    const errors = validateMotionDocument(candidate);
    if (end > 600 || errors.length) { setError(errors[0] ?? "Motion must fit within 600 seconds."); return; }
    setError(""); onChange(candidate);
  };
  const retime = (row: Row, start: number, length = row.length) => {
    if (!Number.isFinite(start) || start < 0 || start > 600 || !Number.isFinite(length) || (row.kind !== "key" && length <= 0)) { setError("Choose a positive interval within 600 seconds."); return; }
    onSelectNode?.(nodeFor(row));
    if (row.kind === "key") {
      const next = retimeControllerKey(clip, row.id, row.keyTime!, start);
      if (next === clip) { setError("Key collision: the previous keys have been kept."); return; }
      commit(next);
    } else if (row.kind === "block") {
      const block = program.blocks.find(b => b.id === row.id)!;
      commit(changeMotionBlock(clip, { ...block, start, duration: length }));
    } else {
      const constraint = program.constraints.find(c => c.id === row.id)!;
      commit(changeConstraint(clip, { ...constraint, start, end: start + length }));
    }
  };
  const down = (e: PointerEvent, row: Row, resize = false) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gesture.current = { row, x: e.clientX, delta: 0, width: track.current?.getBoundingClientRect().width || 600, resize };
    setPreview(gesture.current); onSelectNode?.(nodeFor(row));
  };
  const move = (e: PointerEvent) => {
    if (!gesture.current) return;
    gesture.current = { ...gesture.current, delta: (e.clientX - gesture.current.x) / gesture.current.width * duration };
    setPreview(gesture.current);
  };
  const up = () => {
    const g = gesture.current; gesture.current = null; setPreview(null);
    if (!g || Math.abs(g.delta) < .001) return;
    retime(g.row, g.resize ? g.row.start : Math.max(0, round(g.row.start + g.delta)), g.resize ? Math.max(.01, round(g.row.length + g.delta / g.row.repeat)) : g.row.length);
  };
  const key = (e: KeyboardEvent, row: Row, resize = false) => {
    if (e.key === "Escape") { gesture.current = null; setPreview(null); e.stopPropagation(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault(); e.stopPropagation(); const delta = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : .1);
      retime(row, resize ? row.start : Math.max(0, round(row.start + delta)), resize ? Math.max(.01, round(row.length + delta / row.repeat)) : row.length);
    }
  };
  return <section aria-label="Node timing" className="max-h-[240px] overflow-auto border-t border-hairline bg-surface-sunken p-3 text-xs">
    <div className="mb-2 flex items-center gap-2"><strong>Motion timing</strong><span className="text-ink-muted">Scene {now.toFixed(2)} s · object starts {clip.start.toFixed(2)} s</span></div>
    <input className="mb-2 w-full" type="range" aria-label="Motion playhead" min={0} max={duration} step={.01} value={Math.min(now,duration)} onChange={e => time.set(Number(e.target.value))} />
    <div ref={track} className="flex flex-col gap-2">
      {rows.map(row => {
        const g = preview?.row === row || preview?.row.id === row.id && preview.row.kind === row.kind && preview.row.keyTime === row.keyTime ? preview : null;
        const start = g && !g.resize ? Math.max(0, round(row.start + g.delta)) : row.start;
        const length = g?.resize ? Math.max(.01, row.length + g.delta / row.repeat) : row.length;
        return <div key={`${row.kind}:${row.id}:${row.keyTime ?? ""}`} className={`rounded border p-2 ${nodeFor(row) === nodeId ? "border-primary" : "border-hairline"}`}>
          <div className="mb-1 flex flex-wrap items-center gap-2"><button type="button" className="text-left font-semibold" onClick={() => { onSelectNode?.(nodeFor(row)); time.set(clip.start + row.start); }}>{row.label}{row.kind === "key" ? ` key ${row.keyTime}` : ""}</button>
            <label className="ml-auto">{row.kind === "key" ? "Key" : "Start"} <input type="number" className={inputClass} aria-label={row.kind === "key" ? `${row.label} key ${row.keyTime} time` : `${row.label} start`} min={0} max={600} step={.1} value={row.start} onChange={e => retime(row,e.currentTarget.valueAsNumber)} /></label>
            {row.kind !== "key" && <label>Duration <input type="number" className={inputClass} aria-label={`${row.label} cycle duration`} min={.01} max={600} step={.1} value={row.length} onChange={e => retime(row,row.start,e.currentTarget.valueAsNumber)} /></label>}
            {row.repeat > 1 && <span>{row.repeat} cycles · {round(row.length*row.repeat)} s total</span>}
          </div>
          <div className="relative h-7 rounded bg-surface-raised">
            <button type="button" aria-label={`Move ${row.label}${row.kind === "key" ? ` key ${row.keyTime}` : ""} timing`} className="absolute h-7 min-w-4 touch-none rounded bg-primary-soft text-ink" style={{ transform:`translateX(${(clip.start+start)/duration*(track.current?.clientWidth || 600)-8}px) scaleX(${row.kind === "key" ? 1 : Math.max(.005,length*row.repeat/duration)})`, transformOrigin:"left center", width: row.kind === "key" ? 16 : "100%" }} onPointerDown={e => down(e,row)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setPreview(null);}} onKeyDown={e => key(e,row)}>{row.kind === "key" ? "◆" : "↔"}</button>
            {row.kind !== "key" && <button type="button" aria-label={`Resize ${row.label} timing`} className="absolute h-7 w-3 touch-none rounded bg-info" style={{ transform:`translateX(${(clip.start+start+length*row.repeat)/duration*(track.current?.clientWidth || 600)-8}px)` }} onPointerDown={e => down(e,row,true)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setPreview(null);}} onKeyDown={e => key(e,row,true)} />}
          </div>
        </div>;
      })}
    </div>
    {!rows.length && <p>No timed motion yet. Add a motion node or key a target on the canvas.</p>}
    {error && <p role="status" className="mt-2">{error}</p>}
  </section>;
}
