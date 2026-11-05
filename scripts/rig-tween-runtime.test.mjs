import {test,expect} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {sample,validateRig} from '../src/app/components/motion-studio/engine/rig';
const C=createRequire(import.meta.url)('../docs/mci-rig/mci-rig-core.cjs');
const base=()=>JSON.parse(readFileSync(new URL('../docs/mci-rig/example-character.mci.json',import.meta.url),'utf8'));
test('shared plugin runtime and app sample identical sparse timing, including overshoot and holds',()=>{
 const rig=base(),bone=rig.bones[0].id;
 for(const tween of ['linear','smoothOut','inOut','flight','backOut','anticipate','snap'].map(name=>({name})).concat([{name:'custom',custom:[0.2,-0.3,0.8,1.2]}])){
  rig.version=3;rig.animations=[{id:'tween',duration:4,loop:false,tracks:[{boneId:bone,keys:[{time:0,x:0,y:10,rotation:0,easing:'linear',tween},{time:3,x:100,y:20,rotation:30,easing:'hold'},{time:4,x:200,y:0,rotation:0,easing:'linear'}]}]}];
  expect(C.validate(rig).ok).toBe(true);expect(validateRig(rig).ok).toBe(true);
  for(let i=0;i<=128;i++)expect({...C.sample(rig,'tween',i/32)}).toEqual(sample(rig,'tween',i/32));
 }
});
test('shared runtime rejects unsupported versions and malformed curves like the app',()=>{
 const rig=base(),bone=rig.bones[0].id;
 for(const version of [1,2,3])for(const tween of [{name:'unknown'},{name:'custom',custom:[2,0,0.5,1]},{name:'custom',custom:[0,Infinity,1,1]},{name:'inOut'}]){
  rig.version=version;rig.animations=[{id:'tween',duration:1,loop:false,tracks:[{boneId:bone,keys:[{time:0,x:0,y:0,rotation:0,easing:'linear',tween}]}]}];
  expect(C.validate(rig).ok).toEqual(validateRig(rig).ok);
 }
});
