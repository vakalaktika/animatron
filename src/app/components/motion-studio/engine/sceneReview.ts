import type { Clip, RigClip, StudioDoc, Vec2 } from "../types";
import { applyMatrix, inverse, multiply, world } from "./rig";
import { sceneRigPoseAt } from "./evaluatedRig";
import { toWorldPoint, transformAt } from "./transform";
import { docDuration } from "./timing";
import { validStageMask } from "./stageMask";

/** Production intent, separate from artwork approval and import validity. */
export interface ScenePlan {
  version: 1;
  actors: { clipId: string; action: "still" | "rigid" | "articulated"; requiredParts?: string[] }[];
  travels: { clipId: string; boneId?: string; restFacing: "left" | "right"; mode: "forward" | "backward"; space: "interior" | "exterior" }[];
}
export interface SceneIssue { code: string; clipId?: string; message: string }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
export function validScenePlan(plan: unknown): plan is ScenePlan {
  if (!object(plan) || plan.version !== 1 || !Array.isArray(plan.actors) || !Array.isArray(plan.travels) || plan.actors.length > 64 || plan.travels.length > 64) return false;
  return plan.actors.every(a => object(a) && text(a.clipId) && ["still", "rigid", "articulated"].includes(a.action as string) && (a.requiredParts === undefined || (Array.isArray(a.requiredParts) && a.requiredParts.length <= 64 && a.requiredParts.every(text))))
    && plan.travels.every(t => object(t) && text(t.clipId) && (t.boneId === undefined || text(t.boneId)) && ["left", "right"].includes(t.restFacing as string) && ["forward", "backward"].includes(t.mode as string) && ["interior", "exterior"].includes(t.space as string));
}
function partBone(clip: RigClip, ref: string): string | undefined {
  const bone=clip.rig.bones.find(b=>b.id===ref || b.role===ref);
  const binding=clip.rig.bindings.find(b=>b.svgId===ref || b.boneId===bone?.id);
  return binding?.boneId;
}
function position(doc: StudioDoc, clip: Clip, boneId: string | undefined, t: number): { point: Vec2; facing: Vec2; opacity: number } {
  const frame=transformAt(doc,clip.id,t);
  let p={x:0,y:0}, q={x:1,y:0};
  if(clip.type==="rig" && boneId) {
    const matrix=world(clip.rig,sceneRigPoseAt(doc,clip,t))[boneId];
    const rest=world(clip.rig)[boneId];
    const deformation=multiply(matrix,inverse(rest));
    const origin=applyMatrix(deformation,{x:0,y:0}), ahead=applyMatrix(deformation,{x:1,y:0});
    p=applyMatrix(matrix,p);
    q={x:p.x+ahead.x-origin.x,y:p.y+ahead.y-origin.y};
    p={x:p.x-clip.rig.canvas.width/2,y:p.y-clip.rig.canvas.height/2};
    q={x:q.x-clip.rig.canvas.width/2,y:q.y-clip.rig.canvas.height/2};
  }
  const point=toWorldPoint(frame,p), ahead=toWorldPoint(frame,q);
  return {point,facing:{x:ahead.x-point.x,y:ahead.y-point.y},opacity:frame.opacity};
}
/** Bounded actual-evaluator preflight. A pass certifies these declarations only, never acting quality. */
export function reviewScene(doc: StudioDoc, raw: unknown = doc.scenePlan): { ok: boolean; issues: SceneIssue[] } {
  if(!validScenePlan(raw))return {ok:false,issues:[{code:"invalid-plan",message:"Provide a bounded version 1 scene plan with actor and travel intent."}]};
  if(!raw.actors.length && !raw.travels.length)return {ok:false,issues:[{code:"undeclared-plan",message:"No actor actions or travel have been declared; there is nothing to preflight yet."}]};
  const issues: SceneIssue[]=[], byId=new Map(doc.clips.map(c=>[c.id,c]));
  const fail=(code:string,clipId:string,message:string)=>issues.push({code,clipId,message});
  for(const actor of raw.actors) {
    const clip=byId.get(actor.clipId);
    if(!clip) {fail("missing-actor",actor.clipId,"Planned actor does not exist.");continue;}
    if(actor.action==="still")continue;
    if(clip.type!=="rig") {if(actor.action==="articulated")fail("missing-articulation",clip.id,"Articulated acting requires independently bound artwork parts.");continue;}
    const refs=actor.requiredParts??[], bones=refs.map(ref=>partBone(clip,ref));
    if(bones.some(b=>!b))fail("missing-articulation",clip.id,`Prepared artwork lacks required controls: ${refs.filter((_,i)=>!bones[i]).join(", ")}. Rebuild parts before authoring this action.`);
    if(actor.action==="articulated") {
      const first=sceneRigPoseAt(doc,clip,clip.start);
      const samples=Array.from({length:25},(_,i)=>sceneRigPoseAt(doc,clip,clip.start+docDuration(doc)*i/24));
      const moving=bones.filter((id):id is string=>!!id && clip.rig.bindings.some(b=>b.boneId===id) && samples.some(p=>{
        const a=first[id]??{x:0,y:0,rotation:0},b=p[id]??{x:0,y:0,rotation:0};
        return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.rotation-b.rotation)>1e-5;
      }));
      if(new Set(bones.filter(Boolean)).size<2 || moving.length<2)fail("rigid-carrier",clip.id,"This action is still mostly rigid. Articulated acting needs at least two declared independent parts and coordinated motion on multiple bound controls.");
    }
  }
  const duration=docDuration(doc), count=Math.max(2,Math.min(240,Math.ceil(duration*12))), step=duration/count;
  for(const travel of raw.travels) {
    const clip=byId.get(travel.clipId);
    if(!clip) {fail("missing-traveler",travel.clipId,"Planned moving object does not exist.");continue;}
    if(travel.boneId && (clip.type!=="rig" || !clip.rig.bones.some(b=>b.id===travel.boneId))) {fail("missing-control",clip.id,"Travel bone does not exist.");continue;}
    if(travel.space==="exterior" && !validStageMask(clip.stageMask))fail("missing-portal",clip.id,"Exterior motion needs a real stage-space portal mask; a layer name or paint order is insufficient.");
    let reversed=false;
    for(let i=1;i<count;i++) {
      const t=i*step, before=position(doc,clip,travel.boneId,t-0.001), now=position(doc,clip,travel.boneId,t), after=position(doc,clip,travel.boneId,t+0.001);
      if(!clip.enabled || Math.min(before.opacity,now.opacity,after.opacity)<0.05)continue;
      const dx=after.point.x-before.point.x,dy=after.point.y-before.point.y;
      if(Math.hypot(dx,dy)<0.001)continue;
      const sign=(travel.restFacing==="right"?1:-1)*(travel.mode==="forward"?1:-1);
      if((dx*now.facing.x+dy*now.facing.y)*sign < -0.001) {reversed=true;break;}
    }
    if(reversed)fail("backward-travel",clip.id,"Visible travel opposes the declared facing/direction. Fix the path, artwork facing, or explicitly declare intentional backward motion.");
  }
  return {ok:issues.length===0,issues};
}
