import type { Clip, KeyedProp, RigClip, RigPose, StudioDoc, Vec2 } from "../types";
import type { MotionBlock, MotionController, MotionDiagnostic, MotionProgram } from "./motionTypes";
import { mergedMotion, validateMotionDocument } from "./motionValidation";
import { keyValue, placementAt } from "./keys";
import { buildPath } from "./path";
import { clamp01, resolveEase } from "./easing";
import { applyMatrix, clampRotation, rigPoseAt, world } from "./rig";
import { flowsOnRibbon } from "./textFlow";
import { composeTransforms, IDENTITY, legacyTransformAt, localTransformAt, seatOnRibbon, toLocalPoint, toWorldPoint, type WorldTransform } from "./transform";

export interface EvaluatedScene {
  transforms: Record<string, WorldTransform>;
  poses: Record<string, RigPose>;
  controllers: Record<string, Record<string, {x:number;y:number;rotation:number}>>;
  diagnostics: MotionDiagnostic[];
}
const cache=new WeakMap<StudioDoc,{time:number;value:EvaluatedScene}>();
const motionCache=new WeakMap<StudioDoc,boolean>();
const paths=new WeakMap<MotionBlock,ReturnType<typeof buildPath>>();
const checks=new WeakMap<StudioDoc,string[]>();
const DEG=180/Math.PI;
const wrap=(a:number)=>((a+540)%360+360)%360-180;
const blendAngle=(a:number,b:number,w:number)=>a+wrap(b-a)*w;
const poseDelta=(pose:RigPose,id:string)=>pose[id]??{x:0,y:0,rotation:0};

/** Programs are immutable; instance entries with the same id override portable entries. */
export const motionProgram=(clip:Clip):Required<MotionProgram>=>mergedMotion(clip);
export function hasMotion(doc: StudioDoc): boolean {
  const found=motionCache.get(doc); if(found!==undefined)return found;
  const result=doc.clips.some(c=>c.motion!==undefined||c.type==="rig"&&c.rig.motion!==undefined);
  motionCache.set(doc,result);return result;
}

/** Last local time used by any declared motion track or operation. */
export function motionEnd(clip:Clip):number {
  const p=motionProgram(clip); const times=[0];
  for(const b of p.blocks) if(b.enabled!==false) times.push(b.start+b.duration*(b.repeat??1));
  for(const c of p.controllers) for(const track of Object.values(c.keys??{})) if(track?.length) times.push(track[track.length-1].time);
  for(const c of p.constraints) if(c.enabled!==false) { if(c.end!==undefined)times.push(c.end); if(c.weightKeys?.length)times.push(c.weightKeys[c.weightKeys.length-1].time); }
  return Math.max(...times);
}

function progress(block:MotionBlock,time:number):number|null {
  if(block.enabled===false||time<block.start)return null;
  const elapsed=Math.max(0,time-block.start),repeat=block.repeat??1,total=block.duration*repeat;
  const complete=elapsed>=total;
  const cycle=complete?repeat-1:Math.floor(elapsed/block.duration);
  let u=complete?1:(elapsed-cycle*block.duration)/block.duration;
  if(block.alternate&&cycle%2===1)u=1-u;
  return resolveEase(block.ease??{name:"inOut"})(u);
}

function offsets(blocks:MotionBlock[],time:number):Partial<Record<KeyedProp,number>> {
  let out:Partial<Record<KeyedProp,number>>={};
  const add=(k:KeyedProp,v:number)=>{out={...out,[k]:(out[k]??0)+v};};
  for(const b of blocks) {
    const u=progress(b,time);if(u===null)continue;
    if(b.type==="path") {
      let path=paths.get(b);if(!path){path=buildPath(b.points,b.closed??false);paths.set(b,path);}
      const point=path.at(u);add("x",point.x);add("y",point.y);
      if(b.orient)add("rotation",point.angle+(b.facingOffset??0));
    } else if(b.type==="transform") {
      for(const key of new Set([...Object.keys(b.from),...Object.keys(b.to)]) as Set<KeyedProp>)add(key,(b.from[key]??0)+((b.to[key]??0)-(b.from[key]??0))*u);
    } else add(b.property,Math.sin((u*(b.cycles??1)+(b.phase??0))*Math.PI*2)*b.amplitude);
  }
  return out;
}

function sampledClip(clip:Clip,t:number):Clip {
  const blocks=motionProgram(clip).blocks.filter(b=>!b.controllerId);
  if(!blocks.length)return clip;
  const changes=offsets(blocks,t-clip.start),base=placementAt(clip,t);
  const values={...base};const remaining={...clip.keys};
  for(const k of Object.keys(changes) as KeyedProp[]) { values[k]+=changes[k]??0;delete remaining[k]; }
  return {...clip,...values,keys:remaining};
}

function controllerValue(c:MotionController,blocks:MotionBlock[],local:number) {
  const delta=offsets(blocks.filter(b=>b.controllerId===c.id),local);
  return {x:(c.keys?.x?.length?keyValue(c.keys.x,local):c.x)+(delta.x??0),y:(c.keys?.y?.length?keyValue(c.keys.y,local):c.y)+(delta.y??0),rotation:(c.keys?.rotation?.length?keyValue(c.keys.rotation,local):c.rotation??0)+(delta.rotation??0)};
}

function rotateToward(clip:RigClip,pose:RigPose,boneId:string,target:Vec2,offset:number,weight:number):RigPose {
  const bone=clip.rig.bones.find(b=>b.id===boneId);if(!bone)return pose;
  const matrices=world(clip.rig,pose),origin=applyMatrix(matrices[boneId],{x:0,y:0});
  const parent=bone.parentId?matrices[bone.parentId]:[1,0,0,1,0,0];
  const parentAngle=Math.atan2(parent[1],parent[0])*DEG;
  const angle=Math.atan2(target.y-origin.y,target.x-origin.x)*DEG-parentAngle-bone.rest.rotation+offset;
  const old=poseDelta(pose,boneId);
  return {...pose,[boneId]:{...old,rotation:clampRotation(bone,blendAngle(old.rotation,angle,weight))}};
}

function socketFrame(target:Clip,result:EvaluatedScene,slotId?:string):WorldTransform {
  const frame=result.transforms[target.id]??IDENTITY;
  if(!slotId||target.type!=="rig")return frame;
  const slot=target.rig.slots?.find(s=>s.id===slotId);if(!slot)return frame;
  const matrix=world(target.rig,result.poses[target.id])[slot.boneId];
  const point=applyMatrix(matrix,slot),angle=Math.atan2(matrix[1],matrix[0])*DEG+slot.rotation;
  const localPoint={x:point.x-target.rig.canvas.width/2,y:point.y-target.rig.canvas.height/2};
  const position=toWorldPoint(frame,localPoint);
  return {...frame,...position,rotation:frame.rotation+angle};
}

/** Socket registration frame used by attachments and the editor's preserve-pose operation. */
export function targetSocketTransform(doc:StudioDoc,targetClipId:string,slotId:string|undefined,t:number):WorldTransform {
  const target=doc.clips.find(c=>c.id===targetClipId);
  return target?socketFrame(target,evaluateScene(doc,t),slotId):IDENTITY;
}

/** Inverse of the evaluated handle: returns editable coordinates before motion-block offsets. */
export function controllerLocalPoint(doc:StudioDoc,clipId:string,controllerId:string,point:Vec2,t:number):Vec2 {
  const clip=doc.clips.find(c=>c.id===clipId);if(!clip)return point;
  const program=motionProgram(clip),controller=program.controllers.find(c=>c.id===controllerId);if(!controller)return point;
  const evaluated=evaluateScene(doc,t);
  let value=point;
  if(controller.space!=="stage") {
    const frame=controller.space==="object"?targetSocketTransform(doc,controller.clipId??clip.id,controller.slotId,t):evaluated.transforms[clip.id];
    value=toLocalPoint(frame,point);
    if(controller.space==="rig"&&clip.type==="rig")value={x:value.x+clip.rig.canvas.width/2,y:value.y+clip.rig.canvas.height/2};
  }
  const delta=offsets(program.blocks.filter(b=>b.controllerId===controller.id),t-clip.start);
  return {x:value.x-(delta.x??0),y:value.y-(delta.y??0)};
}

/** Analytic two-bone IK: direct chains, authored bend side, no stretch. */
function solveTwoBone(clip:RigClip,input:RigPose,ids:{rootId:string;midId:string;tipId:string;bend:1|-1},target:Vec2,weight:number):{pose:RigPose;error:number;unreachable:boolean} {
  const matrices=world(clip.rig,input),root=applyMatrix(matrices[ids.rootId],{x:0,y:0}),mid=applyMatrix(matrices[ids.midId],{x:0,y:0}),tip=applyMatrix(matrices[ids.tipId],{x:0,y:0});
  const a=Math.hypot(mid.x-root.x,mid.y-root.y),b=Math.hypot(tip.x-mid.x,tip.y-mid.y);
  const d=Math.hypot(target.x-root.x,target.y-root.y);
  if(a<1e-8||b<1e-8)return{pose:input,error:d,unreachable:true};
  const reachable=d<=a+b+1e-5&&d>=Math.abs(a-b)-1e-5;
  const reach=Math.max(Math.abs(a-b)+1e-8,Math.min(a+b-1e-8,d));
  const direction=Math.atan2(target.y-root.y,target.x-root.x);
  const angle=Math.acos(Math.max(-1,Math.min(1,(a*a+reach*reach-b*b)/(2*a*reach))));
  const elbow={x:root.x+a*Math.cos(direction+ids.bend*angle),y:root.y+a*Math.sin(direction+ids.bend*angle)};
  let solved=rotateToward(clip,input,ids.rootId,elbow,0,1);
  // A segment can be authored along any rest-local direction, not just +X.
  const middle=clip.rig.bones.find(x=>x.id===ids.midId)!;
  const end=clip.rig.bones.find(x=>x.id===ids.tipId)!;
  const rootOffset=-Math.atan2(middle.rest.y+poseDelta(input,ids.midId).y,middle.rest.x+poseDelta(input,ids.midId).x)*DEG;
  solved=rotateToward(clip,input,ids.rootId,elbow,rootOffset,1);
  const endOffset=-Math.atan2(end.rest.y+poseDelta(input,ids.tipId).y,end.rest.x+poseDelta(input,ids.tipId).x)*DEG;
  solved=rotateToward(clip,solved,ids.midId,target,endOffset,1);
  const pose={...input};
  for(const id of [ids.rootId,ids.midId]) { const old=poseDelta(input,id),next=poseDelta(solved,id);pose[id]={...old,rotation:blendAngle(old.rotation,next.rotation,weight)}; }
  const actual=applyMatrix(world(clip.rig,pose)[ids.tipId],{x:0,y:0});
  return {pose,error:Math.hypot(actual.x-target.x,actual.y-target.y),unreachable:!reachable};
}

/** One seekable snapshot shared by preview, editing, review and export. */
export function evaluateScene(doc:StudioDoc,t:number):EvaluatedScene {
  const time=Number.isFinite(t)?t:0;
  const previous=cache.get(doc);if(previous?.time===time)return previous.value;
  const result:EvaluatedScene={transforms:Object.create(null),poses:Object.create(null),controllers:Object.create(null),diagnostics:[]};
  let errors=checks.get(doc);if(!errors){errors=validateMotionDocument(doc);checks.set(doc,errors);}
  if(errors.length) {
    result.diagnostics=errors.map(message=>({clipId:"",code:"invalid" as const,message}));
    // Invalid in-memory data never executes operators; imported data is rejected earlier.
    for(const clip of doc.clips){result.transforms[clip.id]=legacyTransformAt(doc,clip.id,time);if(clip.type==="rig")result.poses[clip.id]=rigPoseAt(clip,time);}
    cache.set(doc,{time,value:result});return result;
  }
  const sampled={...doc,clips:doc.clips.map(c=>sampledClip(c,time))};
  const byId=new Map(sampled.clips.map(c=>[c.id,c]));
  const done=new Set<string>(),visiting=new Set<string>();
  const evaluate=(clip:Clip):void=>{
    if(done.has(clip.id)||visiting.has(clip.id))return;
    visiting.add(clip.id);
    const program=motionProgram(clip),local=time-clip.start;
    const need=(id:string)=>{const target=byId.get(id);if(target&&target.id!==clip.id)evaluate(target);return target;};
    const parent=clip.parentId?need(clip.parentId):undefined;
    for(const c of program.controllers) if(c.space==="object"&&c.clipId)need(c.clipId);
    for(const c of program.constraints) if(c.type==="attach"&&c.enabled!==false)need(c.targetClipId);
    const seated=seatOnRibbon(clip,parent,localTransformAt(clip,time),time,false);
    result.transforms[clip.id]=parent?composeTransforms(result.transforms[parent.id]??IDENTITY,seated,clip.followRotation||flowsOnRibbon(clip,parent)):seated;
    if(clip.type==="rig")result.poses[clip.id]=rigPoseAt(clip,time);
    const resolveControllers=()=>{
      const values:Record<string,{x:number;y:number;rotation:number}>=Object.create(null);
      for(const c of program.controllers) {
        const value=controllerValue(c,program.blocks,local);
        if(c.space==="stage") {values[c.id]=value;continue;}
        let frame=result.transforms[clip.id],point=value;
        if(c.space==="rig"&&clip.type==="rig")point={...value,x:value.x-clip.rig.canvas.width/2,y:value.y-clip.rig.canvas.height/2};
        if(c.space==="object")frame=socketFrame(byId.get(c.clipId??clip.id)??clip,result,c.slotId);
        values[c.id]={...toWorldPoint(frame,point),rotation:frame.rotation+value.rotation};
      }
      result.controllers[clip.id]=values;
    };
    resolveControllers();
    const attachments=program.constraints.filter(c=>c.type==="attach"&&c.enabled!==false&&local>=(c.start??0)).sort((a,b)=>(a.start??0)-(b.start??0));
    const attachment=attachments[attachments.length-1];
    const carry=(ended:typeof attachment)=>{
      if(!ended||ended.end===undefined)return;
      const endTime=clip.start+ended.end,endScene=evaluateScene(doc,endTime);
      const atEnd=sampledClip(doc.clips.find(c=>c.id===clip.id)!,endTime);
      const parentAtEnd=atEnd.parentId?doc.clips.find(c=>c.id===atEnd.parentId):undefined;
      const localEnd=seatOnRibbon(atEnd,parentAtEnd,localTransformAt(atEnd,endTime),endTime,false);
      const baseEnd=parentAtEnd?composeTransforms(endScene.transforms[parentAtEnd.id],localEnd,atEnd.followRotation||flowsOnRibbon(atEnd,parentAtEnd)):localEnd;
      const end=endScene.transforms[clip.id],base=result.transforms[clip.id];
      result.transforms[clip.id]={...base,x:base.x+end.x-baseEnd.x,y:base.y+end.y-baseEnd.y,rotation:base.rotation+wrap(end.rotation-baseEnd.rotation)};
    };
    if(attachment) {
      if(local>(attachment.end??600))carry(attachment);
      else carry(attachments[attachments.length-2]);
      resolveControllers();
    }
    for(const c of [...(attachment?[attachment]:[]),...program.constraints.filter(c=>c.type!=="attach")]) {
      if(c.enabled===false||local<(c.start??0)||local>(c.end??600))continue;
      const weight=clamp01(c.weightKeys?.length?keyValue(c.weightKeys,local):c.weight??1);if(weight===0)continue;
      if(c.type==="attach") {
        const target=byId.get(c.targetClipId);if(!target)continue;
        const frame=socketFrame(target,result,c.slotId),desired=toWorldPoint(frame,c.offset),old=result.transforms[clip.id];
        result.transforms[clip.id]={...old,x:old.x+(desired.x-old.x)*weight,y:old.y+(desired.y-old.y)*weight,rotation:c.followRotation===false?old.rotation:blendAngle(old.rotation,frame.rotation+c.offset.rotation,weight)};
        resolveControllers();
      } else if(clip.type==="rig") {
        const target=result.controllers[clip.id][c.targetId];if(!target)continue;
        const point=toLocalPoint(result.transforms[clip.id],target),rigTarget={x:point.x+clip.rig.canvas.width/2,y:point.y+clip.rig.canvas.height/2};
        if(c.type==="aim")result.poses[clip.id]=rotateToward(clip,result.poses[clip.id],c.boneId,rigTarget,c.offset??0,weight);
        else {
          const solved=solveTwoBone(clip,result.poses[clip.id],c,rigTarget,weight);result.poses[clip.id]=solved.pose;
          const scale=Math.max(Math.abs(result.transforms[clip.id].scaleX),Math.abs(result.transforms[clip.id].scaleY));
          if(solved.unreachable)result.diagnostics.push({clipId:clip.id,operatorId:c.id,code:"unreachable",message:"Target is outside the two-bone reach; the limb was not stretched.",error:solved.error*scale});
          else if(weight===1&&solved.error*scale>1)result.diagnostics.push({clipId:clip.id,operatorId:c.id,code:"contact",message:"Joint limits prevent the requested contact.",error:solved.error*scale});
        }
      }
    }
    visiting.delete(clip.id);done.add(clip.id);
  };
  sampled.clips.forEach(evaluate);
  cache.set(doc,{time,value:result});return result;
}
