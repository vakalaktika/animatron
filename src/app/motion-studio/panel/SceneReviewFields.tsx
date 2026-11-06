"use client";
import { useState } from "react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { reviewScene, validScenePlan, type ScenePlan } from "@/app/components/motion-studio/engine/sceneReview";
import { Button } from "@/app/components/shared-components";
import { MoreFields, SelectField, TextField } from "./fields";

/** Intent stays in the editable composition; checks are explicitly re-run after edits. */
export function SceneReviewFields({doc,onChange}:{doc:StudioDoc;onChange:(doc:StudioDoc)=>void}) {
 const [checked,setChecked]=useState<{doc:StudioDoc;result:ReturnType<typeof reviewScene>}|null>(null);
 const plan=validScenePlan(doc.scenePlan)?doc.scenePlan:null;
 const update=(next:ScenePlan)=>onChange({...doc,version:doc.version>=3?doc.version:3,scenePlan:next});
 if(!plan)return <><p className="atm-help">Declare acting, facing and scene space before animating. Import validity and fewer keys do not establish good acting.</p><Button size="xs" onClick={()=>update({version:1,actors:[],travels:[]})}>Plan scene motion</Button></>;
 return <>
  <p className="atm-help">Checks cover declared actions only. Articulated acting needs independently bound parts; outside travel needs a real portal mask. Inspect acting quality separately.</p>
  {doc.clips.map(clip=>{
   const actor=plan.actors.find(a=>a.clipId===clip.id),travel=plan.travels.find(t=>t.clipId===clip.id);
   return <MoreFields key={clip.id} label={clip.name}>
    <SelectField label="Planned action" value={actor?.action??"undeclared"} options={[{value:"undeclared",label:"Not declared"},{value:"still",label:"Still artwork"},{value:"rigid",label:"Rigid object / limited gesture"},{value:"articulated",label:"Coordinated articulated acting"}]} onChange={value=>update({...plan,actors:[...plan.actors.filter(a=>a.clipId!==clip.id),...(value==="undeclared"?[]:[{clipId:clip.id,action:value as ScenePlan["actors"][number]["action"],requiredParts:actor?.requiredParts??[]}])]})}/>
    {actor?.action==="articulated"&&<TextField label="Required independent parts" value={actor.requiredParts?.join(", ")??""} placeholder="torso, upper-arm, forearm, hand, head" onChange={value=>update({...plan,actors:plan.actors.map(a=>a.clipId===clip.id?{...a,requiredParts:value.split(",").map(s=>s.trim()).filter(Boolean).slice(0,64)}:a)})}/>}
    <SelectField label="Facing in the artwork" value={travel?.restFacing??"none"} options={[{value:"none",label:"No directed travel"},{value:"right",label:"Faces right"},{value:"left",label:"Faces left"}]} onChange={value=>update({...plan,travels:[...plan.travels.filter(t=>t.clipId!==clip.id),...(value==="none"?[]:[{clipId:clip.id,restFacing:value as "left"|"right",mode:travel?.mode??"forward",space:travel?.space??"interior",...(clip.type==="rig"?{boneId:travel?.boneId??clip.rig.animations.find(a=>a.id===clip.animationId)?.tracks[0]?.boneId??clip.rig.bones[0].id}:{})}])]})}/>
    {travel&&<>
     {clip.type==="rig"&&<SelectField label="Travel control" value={travel.boneId??""} options={[{value:"",label:"Whole layer"},...clip.rig.bones.map(b=>({value:b.id,label:b.name??b.id}))]} onChange={boneId=>update({...plan,travels:plan.travels.map(t=>t.clipId===clip.id?{...t,boneId:boneId||undefined}:t)})}/>}
     <SelectField label="Travel intention" value={travel.mode} options={[{value:"forward",label:"Forward travel"},{value:"backward",label:"Intentional backward travel"}]} onChange={mode=>update({...plan,travels:plan.travels.map(t=>t.clipId===clip.id?{...t,mode}:t)})}/>
     <SelectField label="Scene space" value={travel.space} options={[{value:"interior",label:"Inside / foreground"},{value:"exterior",label:"Outside through a portal"}]} onChange={space=>update({...plan,travels:plan.travels.map(t=>t.clipId===clip.id?{...t,space}:t)})}/>
    </>}
   </MoreFields>;
  })}
  <Button size="xs" onClick={()=>setChecked({doc,result:reviewScene(doc)})}>Check motion structure</Button>
  {checked&&checked.doc!==doc&&<p role="status" className="atm-help">Scene changed. Run the checks again.</p>}
  {checked?.doc===doc&&<div role="status"><p className="atm-help">{checked.result.ok?"Declared structural checks passed. Visual acting review is still required.":"Motion structure needs work:"}</p><ul>{checked.result.issues.map((issue,i)=><li key={i} className="atm-help">{issue.clipId}: {issue.message}</li>)}</ul></div>}
 </>;
}
