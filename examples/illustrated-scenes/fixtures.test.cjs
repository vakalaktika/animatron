const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const core=require('../../docs/mci-rig/mci-rig-core.cjs');
const read=(name,layered=false)=>JSON.parse(readFileSync(join(__dirname,name,`${name}${layered?'-layered':''}.mci.json`),'utf8'));
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} ≠ ${b}`);
const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);

for(const name of ['garden-glider','goodnight-room']) {
  test(`${name}: structural and rigid motion continuity separately`,()=>{
    const rig=read(name), check=core.validate(rig);assert.equal(check.ok,true,JSON.stringify(check.errors));
    const a=rig.animations[0];assert.equal(a.duration,8);assert.equal(a.loop,true);
    const frame=1/24;
    for(const track of a.tracks) {
      const start=core.sample(rig,a.id,0)[track.boneId];
      const end=core.sample(rig,a.id,8-1e-7)[track.boneId];
      // Position continuity and one-sided velocity continuity are distinct.
      for(const channel of ['x','y','rotation']) {
        near(start[channel],end[channel],1e-5);
        const after=core.sample(rig,a.id,frame)[track.boneId][channel];
        const before=core.sample(rig,a.id,8-frame)[track.boneId][channel];
        const incoming=(start[channel]-before)/frame,outgoing=(after-start[channel])/frame;
        assert.ok(Math.abs(incoming-outgoing)<6,`${track.boneId}/${channel} seam changes velocity ${incoming}→${outgoing}`);
      }
    }
  });
}

test('held hand and glider retain contact through every frame and edit',()=>{
  const rig=read('garden-glider');
  // Both contours are in the one `lift` group, with no independent world transform.
  const b=rig.bindings.find(b=>b.svgId==='lift');assert.equal(b.boneId,'lift');
  const hand={x:668,y:358},plane={x:680,y:351},restDistance=distance(hand,plane);
  for(let i=0;i<=192;i++) {
    const pose=core.sample(rig,'scene-loop',i/24), m=core.transforms(rig,pose).lift;
    near(distance(core.point(m,hand),core.point(m,plane)),restDistance);
    // The root anchors the seated bodies and planted feet throughout.
    core.world(rig,pose).root.forEach((v,i)=>near(v,[1,0,0,1,0,0][i]));
  }
  const edited=core.record(rig,'scene-loop',3,{lift:{x:0,y:0,rotation:-9}});
  assert.equal(core.validate(edited).ok,true);
  const reopened=JSON.parse(JSON.stringify(edited));assert.deepEqual(reopened,edited);
  const m=core.transforms(reopened,core.sample(reopened,'scene-loop',3)).lift;
  near(distance(core.point(m,hand),core.point(m,plane)),restDistance);
});

test('registered head drawings and blink hold exactly one visible drawing',()=>{
  const rig=read('garden-glider');
  for(let i=0;i<800;i++) {
    const v=core.drawingVisibility(rig,'scene-loop',i/100);
    assert.equal(['head-front','head-blink','head-side'].filter(id=>v[id]).length,1);
  }
  assert.equal(core.drawingVisibility(rig,'scene-loop',1.15)['head-blink'],true);
  assert.equal(core.drawingVisibility(rig,'scene-loop',2.5)['head-side'],true);
  assert.deepEqual(core.drawingVisibility(rig,'scene-loop',0),core.drawingVisibility(rig,'scene-loop',8));
  assert.equal(core.drawingVisibility(rig,null,0)['head-front'],true);
});

test('bird silhouette remains within garden window throughout flight',()=>{
  const rig=read('garden-glider');
  for(let i=0;i<=192;i++) {
    const m=core.transforms(rig,core.sample(rig,'scene-loop',i/24)).bird;
    for(const p of [{x:678,y:164},{x:757,y:218}]) {
      const posed=core.point(m,p);assert.ok(posed.x>=585&&posed.x<=1159);assert.ok(posed.y>=85&&posed.y<=494);
    }
  }
});

test('layered attachment payloads retain matching anchors and bounded PNGs',()=>{
  const vector=read('garden-glider'),layered=read('garden-glider',true);
  const check=core.validate(layered);assert.equal(check.ok,true,JSON.stringify(check.errors));
  assert.deepEqual(layered.bones,vector.bones);assert.deepEqual(layered.bindings,vector.bindings);
  assert.equal(layered.rasterAttachments.length,2);
  for(const a of layered.rasterAttachments)assert.ok(core.pngInfo(a.src));
  assert.equal(layered.svg.includes('<image'),false);
  assert.equal(layered.rasterAttachments.find(a=>a.svgId==='lift').x,620);
  assert.ok(JSON.stringify(layered).length<4_000_000);
});
