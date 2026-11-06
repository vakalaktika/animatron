"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { createMotionRecipe, type MotionRecipeOptions } from "../lib/motionRecipes";

type Recipe = "target" | "path" | "lift" | "breathing" | "reach" | "aim" | "hold";
export function MotionRecipePalette({ doc, clipId, time, onChange, onError, onSelectNode }: { doc: StudioDoc; clipId: string | null; time: number; onChange: (doc: StudioDoc) => void; onError: (text: string) => void; onSelectNode: (id: string) => void }) {
  const [advanced, setAdvanced] = useState<Recipe | null>(null), [target, setTarget] = useState(""), [bone, setBone] = useState(""), [slot, setSlot] = useState("");
  const reduce = useReducedMotion(), clip = doc.clips.find(c => c.id === clipId);
  const add = (recipe: Recipe, options?: MotionRecipeOptions) => {
    if (!clip) { onError("Select an object or character before adding motion."); return; }
    const result = createMotionRecipe(doc, clip.id, recipe, time, options);
    if (result.error) onError(result.error); else { onError(""); onChange(result.doc); if (result.nodeId) onSelectNode(result.nodeId); setAdvanced(null); }
  };
  const rig = clip?.type === "rig" ? clip.rig : undefined;
  const targetClip = doc.clips.find(c => c.id === target);
  const inputClass = "rounded border border-border-control bg-surface-raised px-2 py-1 text-xs text-ink";
  return <div className="border-b border-hairline px-3 py-2">
    <div className="flex flex-wrap items-center gap-2" aria-label="Add motion nodes">
      <span className="text-[11px] font-semibold text-ink-muted">Add</span>
      {([ ["target", "Add target"], ["path", "Add path"], ["lift", "Add lift"], ["breathing", "Add breathing"] ] as const).map(([id, label]) => <Button key={id} size="xs" variant="outline" disabled={!clip} onClick={() => add(id)}>{label}</Button>)}
      <Button size="xs" variant="outline" disabled={!rig} onClick={() => { setAdvanced("reach"); setBone(""); }}>Hand / foot reach</Button>
      <Button size="xs" variant="outline" disabled={!rig} onClick={() => { setAdvanced("aim"); setBone(""); }}>Look at target</Button>
      <Button size="xs" variant="outline" disabled={!clip || doc.clips.length < 2} onClick={() => { setAdvanced("hold"); setTarget(""); setSlot(""); }}>Hold a prop</Button>
    </div>
    <AnimatePresence initial={false}>{advanced && <motion.div key={advanced} initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 24 }} className="mt-3 flex flex-wrap items-end gap-2 rounded border border-hairline bg-surface-sunken p-2">
      {advanced === "hold" ? <>
        <label className="flex flex-col gap-1 text-xs">Follow object<select aria-label="Attachment object" className={inputClass} value={target} onChange={e => { setTarget(e.target.value); setSlot(""); }}><option value="">Choose an object</option>{doc.clips.filter(c => c.id !== clipId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs">Connection point<select aria-label="Attachment socket" className={inputClass} value={slot} onChange={e => setSlot(e.target.value)}><option value="">Object anchor</option>{targetClip?.type === "rig" && targetClip.rig.slots?.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></label>
      </> : <label className="flex flex-col gap-1 text-xs">{advanced === "reach" ? "Hand or foot joint" : "Joint to turn"}<select aria-label="Recipe joint" className={inputClass} value={bone} onChange={e => setBone(e.target.value)}><option value="">Choose a joint</option>{rig?.bones.filter(b => advanced !== "reach" || rig.bones.find(parent => parent.id === b.parentId)?.parentId).map(b => <option key={b.id} value={b.id}>{b.name ?? b.id}</option>)}</select></label>}
      <Button size="xs" disabled={advanced === "hold" ? !target : !bone} onClick={() => {
        if (advanced === "hold") add("hold", { targetClipId: target, slotId: slot || undefined });
        else if (advanced === "aim") add("aim", { boneId: bone });
        else { const tip = rig?.bones.find(b => b.id === bone), mid = rig?.bones.find(b => b.id === tip?.parentId); if (mid?.parentId) add("reach", { rootId: mid.parentId, midId: mid.id, tipId: bone }); }
      }}>Create relationship</Button>
      <Button size="xs" variant="outline" onClick={() => setAdvanced(null)}>Cancel</Button>
      <p className="basis-full text-[11px] text-ink-muted">{advanced === "hold" ? "Select the prop first. Its current position is preserved when connected." : "Creates an editable target and relationship; move the target on the canvas to pose."}</p>
    </motion.div>}</AnimatePresence>
  </div>;
}
