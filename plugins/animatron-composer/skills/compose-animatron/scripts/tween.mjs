#!/usr/bin/env node
// Sparse object and bone motion. The CLI validates with the selected studio
// source before writing; importing applyTweens alone performs spec validation.
import { readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureRepo, parseArgs, runHarness } from './lib.mjs';

const PROPS = new Set(['x','y','scale','rotation','opacity']);
const EASES = new Set(['linear','inOut','smoothOut','flight','backOut','anticipate','snap','custom']);
const ownObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v, label, lo=-1e7, hi=1e7) => {
 if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi) throw new Error(`${label} must be finite in ${lo}..${hi}`);
 return v;
};
const fields = (obj, allowed, label) => {
 if(!ownObject(obj)||Object.keys(obj).some(k=>!allowed.includes(k))) throw new Error(`${label} has unsupported fields`);
};
export function tweenEase(value='inOut', hold=false) {
 if(value==='hold'&&hold)return 'hold';
 const e=typeof value==='string'?{name:value}:value;
 fields(e,['name','custom'],'ease');
 if(!EASES.has(e.name))throw new Error('unknown easing');
 if(e.name==='custom'){
  if(!Array.isArray(e.custom)||e.custom.length!==4)throw new Error('custom easing needs four control points');
  e.custom.forEach((v,i)=>number(v,'curve point',i%2===0?0:-10,i%2===0?1:10));
  return {name:'custom',custom:[...e.custom]};
 }
 if(e.custom!==undefined)throw new Error('only custom easing accepts control points');
 return {name:e.name};
}
function readKeys(keys,duration,bone=false){
 if(!Array.isArray(keys)||keys.length<1||keys.length>10000)throw new Error('a track needs 1..10000 keys');
 let previous=-1;
 return keys.map(k=>{
  fields(k,bone?['time','x','y','rotation','ease']:['time','value','ease'],'key');
  const time=number(k.time,'key time',0,duration);
  if(time<=previous)throw new Error('key times must strictly increase');
  if(previous<0&&time!==0)throw new Error('each replacement track must start at time 0');
  previous=time;
  const ease=tweenEase(k.ease,bone);
  if(!bone)return {time,value:number(k.value,'key value'),ease};
  return {time,x:number(k.x??0,'bone x'),y:number(k.y??0,'bone y'),rotation:number(k.rotation??0,'bone rotation'),easing:ease==='hold'?'hold':'linear',...(ease!=='hold'&&ease.name!=='linear'?{tween:ease}:{})};
 });
}
/** Replace only explicitly addressed tracks; all art and unaddressed motion survive. */
export function applyTweens(doc,spec){
 fields(spec,['version','duration','loop','targets'],'tween spec');
 if(spec.version!==1)throw new Error('expected tween spec version 1');
 const duration=number(spec.duration,'duration',0.01,600);
 if(typeof spec.loop!=='boolean')throw new Error('loop must be explicit boolean');
 if(!Array.isArray(doc?.clips)||!Array.isArray(spec.targets)||!spec.targets.length||spec.targets.length>256)throw new Error('expected composition and 1..256 targets');
 const byId=new Map(doc.clips.map(c=>[c.id,c]));
 if(byId.size!==doc.clips.length)throw new Error('duplicate composition clip IDs');
 const replacements=new Map();let count=0;
 for(const target of spec.targets){
  fields(target,['clipId','properties','animationId','bones'],'target');
  const source=byId.get(target.clipId);
  if(!source||replacements.has(target.clipId))throw new Error(`unknown or repeated clip ${target.clipId}`);
  if(!target.properties&&!target.bones)throw new Error('target needs properties or bones');
  let clip={...source};
  if(target.properties){
   if(!ownObject(target.properties)||!Object.keys(target.properties).length)throw new Error('empty property tracks');
   const keys={...source.keys};
   for(const [prop,list] of Object.entries(target.properties)){
    if(!PROPS.has(prop)||(source.type==='ribbon'&&['scale','rotation'].includes(prop)))throw new Error(`unsupported property ${prop}`);
    keys[prop]=readKeys(list,duration);count+=keys[prop].length;
    if(prop==='opacity'&&keys[prop].some(k=>k.value<0||k.value>1))throw new Error('opacity must be in 0..1');
    if(prop==='scale'&&keys[prop].some(k=>k.value<=0))throw new Error('scale must be positive');
   }
   clip={...clip,keys};
  }
  if(target.bones){
   if(source.type!=='rig'||!ownObject(target.bones)||!Object.keys(target.bones).length)throw new Error('bone tracks need a rig target');
   const rig=source.rig,id=target.animationId??source.animationId;
   if(typeof id!=='string'||!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(id))throw new Error('bone target needs valid animationId');
   const before=rig.animations.find(a=>a.id===id);
   // Existing drawing keys and unaddressed tracks must fit the new duration.
   const tracks=new Map((before?.tracks??[]).map(t=>[t.boneId,t]));
   const seen=new Set();let curved=false;
   for(const [ref,list] of Object.entries(target.bones)){
    const bone=rig.bones.find(b=>b.id===ref)??rig.bones.find(b=>b.role===ref);
    if(!bone||seen.has(bone.id))throw new Error(`unknown or aliased bone ${ref}`);
    seen.add(bone.id);const keys=readKeys(list,duration,true);count+=keys.length;
    if(bone.limits&&keys.some(k=>k.rotation<bone.limits.min||k.rotation>bone.limits.max))throw new Error(`${ref} exceeds its rotation limits`);
    curved ||= keys.some(k=>k.tween);tracks.set(bone.id,{boneId:bone.id,keys});
   }
   const animation={...before,id,duration,loop:spec.loop,tracks:[...tracks.values()]};
   if(animation.tracks.some(t=>t.keys.some(k=>k.time>duration))||(animation.drawingTracks??[]).some(t=>t.keys.some(k=>k.time>duration)))throw new Error('duration would truncate preserved keys');
   clip={...clip,animationId:id,rig:{...rig,version:curved?3:rig.version,animations:[...rig.animations.filter(a=>a.id!==id),animation]}};
  }else if(target.animationId!==undefined)throw new Error('animationId only applies to bone tracks');
  replacements.set(target.clipId,clip);
 }
 if(count>10000)throw new Error('spec exceeds 10000 authored keys');
 return {...doc,timeline:{...doc.timeline,tailSeconds:0},clips:doc.clips.map(c=>replacements.get(c.id)??c)};
}

function main(argv){
 const outIndex=argv.indexOf('--out');
 if(outIndex<0||!argv[outIndex+1])throw new Error('usage: tween.mjs composition.json motion.json --out result.json [--repo checkout --offline]');
 const out=resolve(argv[outIndex+1]);argv.splice(outIndex,2);
 const opts=parseArgs(argv);
 if(opts.files.length!==2)throw new Error('supply composition and motion spec');
 const repo=ensureRepo(opts);
 const result=runHarness(repo,opts.files,{capture:true,script:'tweenharness.ts'});
 const line=result.stdout.trim().split('\n').reverse().find(l=>l.startsWith('RESULT '));
 if(!line)throw new Error('studio tween validation returned no result');
 const parsed=JSON.parse(line.slice(7));
 if(result.status!==0||!parsed.ok)throw new Error(parsed.error??'studio tween validation failed');
 const temporary=join(dirname(out),`.${basename(out)}.${process.pid}.tmp`);
 try{writeFileSync(temporary,JSON.stringify(parsed.doc,null,2)+'\n',{flag:'wx'});renameSync(temporary,out);}finally{rmSync(temporary,{force:true});}
 console.log(`Wrote ${out}: sparse editable tracks; ${parsed.duration.toFixed(2)} s, ${parsed.keys} authored keys. ${parsed.notes.join(' ')}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main(process.argv.slice(2));}catch(e){console.error(`tween: ${e.message}`);process.exitCode=1;}
}
