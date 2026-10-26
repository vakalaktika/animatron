/* MCI Rig 1: shared, dependency-free rigid vector skeleton runtime. */
(function (host, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else host.MCIRig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'mid-century-ink-rig', VERSION = 1;
  const ID = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/;
  const isId = value => typeof value === 'string' && ID.test(value);
  const identity = () => [1, 0, 0, 1, 0, 0];
  const finite = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e7;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clone = value => JSON.parse(JSON.stringify(value));
  function multiply(a, b) {
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  }
  function inverse(m) {
    const d = m[0]*m[3]-m[1]*m[2];
    if (Math.abs(d) < 1e-10) throw new Error('Singular binding matrix.');
    return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
  }
  function matrix(x, y, degrees) {
    const a = degrees*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
    return [c, s, -s, c, x, y];
  }
  const point = (m, p) => ({x:m[0]*p.x+m[2]*p.y+m[4], y:m[1]*p.x+m[3]*p.y+m[5]});
  function validate(asset) {
    const errors = [], fail = m => errors.push(m);
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return {ok:false,errors:['Expected an asset object.']};
    if (asset.name !== undefined && (typeof asset.name !== 'string' || asset.name.length > 200)) fail('Invalid asset name.');
    if (asset.metadata !== undefined && (!asset.metadata || typeof asset.metadata !== 'object' || Array.isArray(asset.metadata))) fail('Metadata must be an object.');
    if (asset.format !== FORMAT || asset.version !== VERSION) fail('Expected mid-century-ink-rig version 1.');
    if (!asset.canvas || !finite(asset.canvas.width) || !finite(asset.canvas.height) || asset.canvas.width <= 0 || asset.canvas.height <= 0) fail('Canvas dimensions must be positive numbers.');
    if (typeof asset.svg !== 'string' || asset.svg.length > 2_000_000 || !asset.svg.includes('<svg')) fail('Expected SVG artwork, up to 2 MB.');
    if (!Array.isArray(asset.bones) || asset.bones.length < 1 || asset.bones.length > 128) return {ok:false,errors:[...errors,'Expected 1–128 bones.']};
    const bones = new Map(), roles = new Set();
    for (const b of asset.bones) {
      if (!b || !isId(b.id) || bones.has(b.id)) { fail('Bone IDs must be unique identifiers.'); continue; }
      bones.set(b.id,b);
      if (b.parentId !== null && !isId(b.parentId)) fail('Invalid parent for '+b.id);
      if (!b.rest || !['x','y','rotation'].every(k=>finite(b.rest[k]))) fail('Invalid rest transform for '+b.id);
      if (!finite(b.length) || b.length < 0) fail('Invalid length for '+b.id);
      if (b.role !== undefined && (typeof b.role !== 'string' || !isId(b.role) || roles.has(b.role))) fail('Roles must be unique identifiers.');
      if (b.role) roles.add(b.role);
      if (b.limits && (!finite(b.limits.min) || !finite(b.limits.max) || b.limits.min > 0 || b.limits.max < 0 || b.limits.min > b.limits.max)) fail('Joint limits must include the rest angle for '+b.id);
    }
    if (asset.bones.filter(b=>b && b.parentId === null).length !== 1) fail('Exactly one root bone is required.');
    for (const b of bones.values()) {
      if (b.parentId !== null && !bones.has(b.parentId)) fail('Missing parent for '+b.id);
      const seen = new Set([b.id]); let p = b.parentId;
      while (p && bones.has(p)) { if (seen.has(p)) { fail('Bone hierarchy contains a cycle.'); break; } seen.add(p); p = bones.get(p).parentId; }
    }
    if (!Array.isArray(asset.bindings) || asset.bindings.length < 1 || asset.bindings.length > 256) fail('Expected 1–256 artwork bindings.');
    else {
      const ids = new Set(), targets = new Set();
      for (const b of asset.bindings) {
        if (!b || !isId(b.id) || ids.has(b.id) || !isId(b.svgId) || targets.has(b.svgId) || !bones.has(b.boneId)) { fail('Bindings need unique IDs, unique SVG targets, and existing bones.'); continue; }
        ids.add(b.id); targets.add(b.svgId);
        if (!Array.isArray(b.bindMatrix) || b.bindMatrix.length !== 6 || !b.bindMatrix.every(finite)) fail('Invalid bind matrix for '+b.id);
        else try { inverse(b.bindMatrix); } catch { fail('Singular bind matrix for '+b.id); }
      }
    }
    if (asset.slots !== undefined) {
      const ids = new Set();
      if (!Array.isArray(asset.slots) || asset.slots.length > 128) fail('Invalid attachment slots.');
      else for (const s of asset.slots) {
        if (!s || !isId(s.id) || ids.has(s.id) || !bones.has(s.boneId) || !['x','y','rotation'].every(k=>finite(s[k]))) fail('Invalid attachment slot.');
        else ids.add(s.id);
      }
    }
    if (!Array.isArray(asset.animations) || asset.animations.length > 64) fail('Expected an animations array, up to 64 clips.');
    else {
      const ids = new Set(); let count = 0;
      for (const a of asset.animations) {
        if (!a || !isId(a.id) || ids.has(a.id) || !finite(a.duration) || a.duration <= 0 || a.duration > 600 || typeof a.loop !== 'boolean' || !Array.isArray(a.tracks) || a.tracks.length > 128) { fail('Invalid animation clip.'); continue; }
        ids.add(a.id); const tracks = new Set();
        for (const t of a.tracks) {
          if (!t || !bones.has(t.boneId) || tracks.has(t.boneId) || !Array.isArray(t.keys) || !t.keys.length || t.keys.length > 10000) { fail('Invalid animation track.'); continue; }
          tracks.add(t.boneId); let previous = -1;
          for (const k of t.keys) {
            count++;
            if (!k || !['time','x','y','rotation'].every(f=>finite(k[f])) || k.time < 0 || k.time > a.duration || k.time <= previous || !['linear','hold'].includes(k.easing)) fail('Invalid or unsorted animation keyframe.');
            previous = k && k.time;
          }
        }
      }
      if (count > 10000) fail('Asset exceeds 10000 animation keyframes.');
    }
    return {ok:!errors.length, errors:[...new Set(errors)]};
  }
  function sample(asset, animationId, seconds) {
    const a = asset.animations.find(a=>a.id===animationId), pose = Object.create(null);
    if (!a) return pose;
    const time = a.loop ? ((seconds%a.duration)+a.duration)%a.duration : clamp(seconds,0,a.duration);
    for (const track of a.tracks) {
      const keys = track.keys; let left = keys[0], right = left;
      for (const k of keys) { if (k.time<=time) left=k; if (k.time>=time) {right=k;break;} right=k; }
      const f = right.time===left.time || left.easing==='hold' ? 0 : clamp((time-left.time)/(right.time-left.time),0,1);
      pose[track.boneId] = Object.fromEntries(['x','y','rotation'].map(k=>[k,left[k]+(right[k]-left[k])*f]));
    }
    return pose;
  }
  function world(asset, pose = {}) {
    const map = new Map(asset.bones.map(b=>[b.id,b])), result = Object.create(null);
    function visit(id) {
      if (result[id]) return result[id];
      const b=map.get(id), p=Object.hasOwn(pose,id)?pose[id]:{}, r=b.rest;
      const angle=clamp(p.rotation||0,b.limits?.min??-3600,b.limits?.max??3600);
      const local=matrix(r.x+(p.x||0),r.y+(p.y||0),r.rotation+angle);
      return result[id]=b.parentId===null?local:multiply(visit(b.parentId),local);
    }
    for (const b of asset.bones) visit(b.id);
    return result;
  }
  function transforms(asset, pose = {}) {
    const w=world(asset,pose), output=Object.create(null);
    for (const binding of asset.bindings) output[binding.svgId]=multiply(w[binding.boneId],binding.bindMatrix);
    return output;
  }
  function rebind(asset) {
    const output=clone(asset), w=world(output);
    output.bindings=output.bindings.map(b=>({...b,bindMatrix:inverse(w[b.boneId])}));
    return output;
  }
  function solve(asset, inputPose, tipId, target, iterations=18) {
    const pose=clone(inputPose), map=new Map(asset.bones.map(b=>[b.id,b]));
    const tip=map.get(tipId); if(!tip || !finite(target.x)||!finite(target.y))return pose;
    // CCD rotates ancestors of the selected bone; its own pivot is the target.
    const chain=[];let id=tip.parentId;
    while(id){chain.push(id);id=map.get(id).parentId;}
    for(let i=0;i<iterations;i++)for(const joint of chain){
      const w=world(asset,pose), origin=point(w[joint],{x:0,y:0}), end=point(w[tipId],{x:0,y:0});
      const u=Math.atan2(end.y-origin.y,end.x-origin.x),v=Math.atan2(target.y-origin.y,target.x-origin.x);
      const delta=((v-u)*180/Math.PI+540)%360-180,b=map.get(joint),old=pose[joint]||{x:0,y:0,rotation:0};
      // Keep the stage root planted. Pose it explicitly if desired.
      if(b.parentId===null)continue;
      pose[joint]={...old,rotation:clamp((old.rotation||0)+delta,b.limits?.min??-360,b.limits?.max??360)};
    }
    return pose;
  }
  function record(asset, animationId, time, pose) {
    const output=clone(asset), a=output.animations.find(a=>a.id===animationId);
    if(!a)throw new Error('Select an animation before recording.');
    time=clamp(time,0,a.duration);
    for(const b of output.bones){
      let track=a.tracks.find(t=>t.boneId===b.id);
      if(!track){track={boneId:b.id,keys:[]};a.tracks.push(track);}
      const p=Object.hasOwn(pose,b.id)?pose[b.id]:{}, k={time,x:p.x||0,y:p.y||0,rotation:clamp(p.rotation||0,b.limits?.min??-3600,b.limits?.max??3600),easing:'linear'};
      track.keys=track.keys.filter(k=>Math.abs(k.time-time)>1e-6).concat(k).sort((a,b)=>a.time-b.time);
    }
    return output;
  }
  function compatibleActions(asset) {
    const roles=new Set(asset.bones.map(b=>b.role));
    return {nod:roles.has('head'),wave:roles.has('arm.left.upper')&&roles.has('arm.left.forearm')&&roles.has('arm.left.hand')};
  }
  function preset(asset, kind) {
    if(!compatibleActions(asset)[kind])throw new Error('This skeleton lacks the roles required for '+kind+'.');
    const output=clone(asset), role=r=>output.bones.find(b=>b.role===r).id;
    const track=(r,values)=>({boneId:role(r),keys:values.map(([time,rotation])=>({time,x:0,y:0,rotation,easing:'linear'}))});
    const a=kind==='nod'?{id:'nod',duration:2,loop:true,tracks:[track('head',[[0,0],[.4,12],[.8,0],[1.2,12],[1.6,0],[2,0]])]}:
      {id:'wave',duration:2,loop:true,tracks:[track('arm.left.upper',[[0,0],[.4,-40],[1.6,-40],[2,0]]),track('arm.left.forearm',[[0,0],[.4,-70],[.7,-95],[1,-65],[1.3,-95],[1.6,-70],[2,0]]),track('arm.left.hand',[[0,0],[.4,0],[.7,20],[1,-20],[1.3,20],[1.6,0],[2,0]])]};
    output.animations=output.animations.filter(x=>x.id!==a.id).concat(a); return output;
  }
  return {FORMAT,VERSION,identity,multiply,inverse,matrix,point,clone,validate,sample,world,transforms,rebind,solve,record,compatibleActions,preset};
});
