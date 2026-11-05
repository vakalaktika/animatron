import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('./',import.meta.url);
const doc=JSON.parse(readFileSync(new URL('../tween-studio/sunroom-tween.animatron.json',import.meta.url),'utf8'));
doc.version=3;
doc.name='Sunroom — scoped motion structure proof';
doc.description='Forward exterior bird behind a manually reviewed sky aperture. The family remains a limited rigid gesture; this is not natural character acting proof.';
const bird=doc.clips.find(c=>c.id==='outside-bird');
// Stage-space sky aperture excludes the left window frame, house, people and foliage.
// Deliberately scoped to this path, not automatic segmentation of the flattened room.
bird.stageMask={regions:[[{x:592,y:104},{x:737,y:82},{x:737,y:295},{x:592,y:295}],[{x:762,y:82},{x:985,y:48},{x:1080,y:208},{x:1080,y:295},{x:762,y:295}]]};
bird.rig.animations[0].tracks[0].keys=[
 [0,-480,0],[0.6,-480,0],[5.5,140,20],[6,180,20],[6.01,-480,0],[8,-480,0]
].map(([time,x,y])=>({time,x,y,rotation:0,easing:'linear'}));
doc.scenePlan={version:1,actors:[{clipId:'room',action:'still'},{clipId:'scene',action:'rigid',requiredParts:['lift','head']},{clipId:'outside-bird',action:'rigid',requiredParts:['bird']}],travels:[{clipId:'outside-bird',boneId:'bird',restFacing:'right',mode:'forward',space:'exterior'}]};
const acting={...doc.scenePlan,actors:doc.scenePlan.actors.map(a=>a.clipId==='scene'?{...a,action:'articulated',requiredParts:['torso','upper-arm','forearm','hand','head','hair']}:a)};
writeFileSync(new URL('sunroom-structured.animatron.json',root),JSON.stringify(doc,null,2)+'\n');
writeFileSync(new URL('natural-acting-required.plan.json',root),JSON.stringify(acting,null,2)+'\n');
writeFileSync(new URL('scoped-motion.plan.json',root),JSON.stringify(doc.scenePlan,null,2)+'\n');
console.log('Built corrected direction/portal proof and the intentionally unmet natural-acting requirements.');
