import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTweens } from '../tween.mjs';

const rig = () => ({ version:2, bones:[{id:'root',role:'body',limits:{min:-90,max:90}}], animations:[{id:'act',duration:4,loop:true,tracks:[],drawingTracks:[{setId:'eyes',keys:[{time:0,drawingId:'open'}]}]}], svg:'unchanged', bindings:[{id:'art'}] });
const doc = () => ({timeline:{tailSeconds:1},clips:[{id:'person',type:'rig',start:0,animationId:'act',rig:rig()},{id:'title',type:'text',start:0,x:20}]});
const spec = () => ({version:1,duration:4,loop:true,targets:[{clipId:'person',bones:{body:[{time:0,rotation:0,ease:'inOut'},{time:2,rotation:30,ease:'smoothOut'},{time:4,rotation:0}]}},{clipId:'title',properties:{x:[{time:0,value:20},{time:4,value:60}]}}]});
test('sparse tracks preserve artwork, drawing keys, and untouched source',()=>{
 const original=doc(), before=structuredClone(original), out=applyTweens(original,spec());
 assert.deepEqual(original,before); assert.equal(out.clips[0].rig.version,3);
 assert.equal(out.clips[0].rig.animations[0].tracks[0].keys.length,3);
 assert.deepEqual(out.clips[0].rig.animations[0].tracks[0].keys[0].tween,{name:'inOut'});
 assert.deepEqual(out.clips[0].rig.animations[0].drawingTracks,before.clips[0].rig.animations[0].drawingTracks);
 assert.equal(out.clips[0].rig.svg,'unchanged'); assert.deepEqual(out.clips[0].rig.bindings,before.clips[0].rig.bindings);
 assert.equal(out.clips[1].keys.x.length,2); assert.deepEqual(out.timeline,{tailSeconds:0});
});
test('invalid references, budgets, nonfinite values, time order and curves fail',()=>{
 for(const change of [s=>s.targets[0].clipId='absent',s=>s.targets[0].bones={missing:[{time:0}]},s=>s.duration=Infinity,s=>s.loop='yes',s=>s.targets[0].bones.body[1].time=0,s=>s.targets[0].bones.body[1].rotation=Infinity,s=>s.targets[0].bones.body[0].ease={name:'custom',custom:[2,0,1,1]},s=>s.targets[1].properties={width:[{time:0,value:3}]}]){
  const s=spec();change(s);assert.throws(()=>applyTweens(doc(),s));
 }
});
test('hold states remain discrete and linear-only edits do not upgrade old rigs',()=>{
 const s=spec();s.targets=[{clipId:'person',bones:{body:[{time:0,rotation:0,ease:'hold'},{time:4,rotation:10,ease:'linear'}]}}];
 const out=applyTweens(doc(),s);assert.equal(out.clips[0].rig.version,2); assert.equal(out.clips[0].rig.animations[0].tracks[0].keys[0].easing,'hold');
});
test('duplicate targets, aliased bones, and partial track replacement fail rather than conflict',()=>{
 const s=spec();s.targets.push(s.targets[0]);assert.throws(()=>applyTweens(doc(),s));
 const alias=spec();alias.targets[0].bones.root=alias.targets[0].bones.body;assert.throws(()=>applyTweens(doc(),alias));
});
