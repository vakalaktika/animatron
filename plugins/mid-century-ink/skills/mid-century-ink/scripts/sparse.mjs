#!/usr/bin/env node
// Native Rig 3 sparse tween authoring. Seconds, independent bone tracks,
// no sampled in-betweens. Legacy motion.mjs remains available for baking.
import {readFileSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const C=createRequire(import.meta.url)('../references/mci-rig-core.cjs');
const ID=/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/;
const fields=(o,allowed)=>{
 if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw new Error('unsupported sparse motion fields');
};
const finite=(v,label)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`${label} must be finite`);return v;};
export function sparse(rig,spec){
 fields(spec,['id','name','duration','loop','tracks']);
 if(!ID.test(spec.id??'')||typeof spec.loop!=='boolean'||!(finite(spec.duration,'duration')>0&&spec.duration<=600))throw new Error('spec requires id, duration 0..600, and explicit loop');
 if(!spec.tracks||typeof spec.tracks!=='object'||Array.isArray(spec.tracks)||!Object.keys(spec.tracks).length)throw new Error('spec needs independent bone tracks');
 const seen=new Set();let count=0;
 const tracks=Object.entries(spec.tracks).map(([ref,list])=>{
  const bone=rig.bones.find(b=>b.id===ref)??rig.bones.find(b=>b.role===ref);
  if(!bone||seen.has(bone.id))throw new Error(`unknown or aliased bone ${ref}`);
  seen.add(bone.id);
  if(!Array.isArray(list)||!list.length)throw new Error(`${ref} needs keys`);
  let previous=-1;
  const keys=list.map(k=>{
   fields(k,['time','x','y','rotation','ease']);
   const time=finite(k.time,'time');
   if(time<0||time>spec.duration||time<=previous||(previous<0&&time!==0))throw new Error('track times must start at 0 and strictly increase through duration');
   previous=time;count++;
   const ease=k.ease??'inOut';
   const tween=typeof ease==='string'?{name:ease}:ease;
   const rotation=finite(k.rotation??0,'rotation');
   if(bone.limits&&(rotation<bone.limits.min||rotation>bone.limits.max))throw new Error(`${ref} exceeds joint limits`);
   return {time,x:finite(k.x??0,'x'),y:finite(k.y??0,'y'),rotation,easing:ease==='hold'?'hold':'linear',...(ease!=='hold'&&tween.name!=='linear'?{tween}:{})};
  });
  return {boneId:bone.id,keys};
 });
 if(count>10000)throw new Error('sparse motion exceeds 10000 keys');
 const existing=rig.animations.find(a=>a.id===spec.id);
 const anim={...existing,id:spec.id,...(spec.name?{name:spec.name}:{}),duration:spec.duration,loop:spec.loop,tracks:[...(existing?.tracks??[]).filter(t=>!seen.has(t.boneId)),...tracks]};
 const out={...rig,version:3,animations:[...rig.animations.filter(a=>a.id!==anim.id),anim]};
 const check=C.validate(out);if(!check.ok)throw new Error(check.errors.join('\n'));
 return {rig:out,anim,notes:['Native sparse tween keys require an Animatron build supporting Rig 3. Structural check does not certify visual seams or contact.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [rigPath,specPath,out]=process.argv.slice(2);
 try{
  if(!rigPath||!specPath||!out)throw new Error('usage: sparse.mjs rig.mci.json motion.json output.mci.json');
  const result=sparse(JSON.parse(readFileSync(rigPath,'utf8')),JSON.parse(readFileSync(specPath,'utf8')));
  const temp=`${out}.${process.pid}.tmp`;
  try{writeFileSync(temp,JSON.stringify(result.rig,null,2)+'\n',{flag:'wx'});renameSync(temp,out);}finally{rmSync(temp,{force:true});}
  console.log(`${result.anim.tracks.reduce((n,t)=>n+t.keys.length,0)} native keys over ${result.anim.duration}s → ${out}`);
  result.notes.forEach(n=>console.log(`! ${n}`));
 }catch(e){console.error(`sparse: ${e.message}`);process.exitCode=1;}
}
