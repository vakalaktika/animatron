import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {sparse} from '../sparse.mjs';
import {worlds,pinFoot} from '../walk.mjs';
const rig=()=>JSON.parse(readFileSync(new URL('../../references/example-character.mci.json',import.meta.url),'utf8'));
const C=createRequire(import.meta.url)('../../references/mci-rig-core.cjs');
test('native sparse motion retains three keys and separate artwork',()=>{
 const source=rig(),bone=source.bones[0].id,before=structuredClone(source);
 const out=sparse(source,{id:'tween',duration:4,loop:true,tracks:{[bone]:[{time:0,rotation:0,ease:'inOut'},{time:2,rotation:10,ease:'smoothOut'},{time:4,rotation:0}]}});
 assert.equal(out.rig.version,3);assert.equal(out.anim.tracks[0].keys.length,3);assert.deepEqual(source,before);assert.equal(out.rig.svg,source.svg);
});
test('unsupported moving hold/overlap features fail instead of silently approximating',()=>{
 assert.throws(()=>sparse(rig(),{id:'tween',duration:4,loop:false,tracks:{},overlap:{head:2}}),/unsupported/);
});
test('legacy world sampler fails safely on invalid curves rather than playing them linearly',()=>{
 const source=rig();const bone=source.bones[0];
 const anim={duration:4,loop:false,tracks:[{boneId:bone.id,keys:[{time:0,x:0,y:0,rotation:0,easing:'linear',tween:{name:'smoothOut'}},{time:4,x:100,y:0,rotation:0,easing:'linear'}]}]};
 const root=worlds(source,anim,1)[bone.id];assert.ok(root[4]>bone.rest.x+50);
 assert.throws(()=>pinFoot(source,anim,'left'),/sparse tween/);
});
test('legacy world sampler switches held values exactly at each right-hand key like the shared evaluator',()=>{
 const source=rig(),bone=source.bones[0].id;
 const anim={id:'boundary',duration:4,loop:false,tracks:[{boneId:bone,keys:[{time:0,x:0,y:0,rotation:0,easing:'hold'},{time:2,x:100,y:0,rotation:0,easing:'hold'},{time:4,x:200,y:0,rotation:0,easing:'linear'}]}]};
 source.animations=[anim];
 for(const time of [0,1.999999,2,2.000001,3.999999,4,4.000001])assert.deepEqual(worlds(source,anim,time)[bone],C.world(source,C.sample(source,anim.id,time))[bone],`held key at ${time}s`);
});
