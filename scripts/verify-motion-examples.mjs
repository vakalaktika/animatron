// Imports the actual app evaluator into a short-lived Node bundle.
import {build} from 'esbuild';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
const folder=mkdtempSync(join(tmpdir(),'motion-check-'));
const source=`
import fs from 'node:fs';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {isDeepStrictEqual} from 'node:util';
import {docFromJson} from '@/app/motion-studio/lib/importDoc';import {evaluateScene,targetSocketTransform} from '@/app/components/motion-studio/engine/motionScene';import {reviewScene} from '@/app/components/motion-studio/engine/sceneReview';import {docDuration} from '@/app/components/motion-studio/engine/timing';import {applyMatrix,world} from '@/app/components/motion-studio/engine/rig';import {toWorldPoint} from '@/app/components/motion-studio/engine/transform';
const require=createRequire(resolve('package.json'));globalThis.DOMParser=new(require('jsdom').JSDOM)('').window.DOMParser;
const rows=[];
for(const file of process.argv.slice(2)){
 const raw=JSON.parse(fs.readFileSync(file,'utf8')),opened=docFromJson(JSON.stringify(raw),file);if(!opened.ok)throw Error(opened.message);
 if(opened.warnings.length||!isDeepStrictEqual(raw,opened.doc))throw Error('Import repairs '+file);
 const doc=opened.doc,duration=docDuration(doc),issues=[],start=performance.now();let maxContact=0,maxGrip=0;
 for(let i=0;i<=240;i++){
  const t=duration*i/240,scene=evaluateScene(doc,t);issues.push(...scene.diagnostics);
  for(const clip of doc.clips){
   if(clip.type!=='rig')continue;const programs=[clip.rig.motion,clip.motion];
   for(const program of programs)for(const c of program?.constraints??[]){
    if(c.enabled===false||c.weight!==undefined&&c.weight!==1||t<clip.start+(c.start??0)||t>clip.start+(c.end??600))continue;
    if(c.type==='ik'){
     const p=applyMatrix(world(clip.rig,scene.poses[clip.id])[c.tipId],{x:0,y:0});
     const actual=toWorldPoint(scene.transforms[clip.id],{x:p.x-clip.rig.canvas.width/2,y:p.y-clip.rig.canvas.height/2}),goal=scene.controllers[clip.id][c.targetId];
     maxContact=Math.max(maxContact,Math.hypot(actual.x-goal.x,actual.y-goal.y));
    }else if(c.type==='attach'){
     const target=targetSocketTransform(doc,c.targetClipId,c.slotId,t),goal=toWorldPoint(target,c.offset),actual=scene.transforms[clip.id];maxGrip=Math.max(maxGrip,Math.hypot(actual.x-goal.x,actual.y-goal.y));
    }
   }
  }
 }
 const evaluationMs=performance.now()-start;if(issues.length)throw Error(file+': '+JSON.stringify(issues.slice(0,3)));
 if(doc.scenePlan&&!reviewScene(doc).ok)throw Error(file+': '+JSON.stringify(reviewScene(doc).issues));
 const endpointA=evaluateScene(doc,0),endpointB=evaluateScene(doc,duration);let loopPoseError=0,seamSpeedError=0;
 for(const clip of doc.clips){
  if(clip.stageMask)continue;
  const a=endpointA.transforms[clip.id],b=endpointB.transforms[clip.id];loopPoseError=Math.max(loopPoseError,Math.hypot(a.x-b.x,a.y-b.y),Math.abs(a.rotation-b.rotation));
  for(const bone of clip.type==='rig'?clip.rig.bones:[]){const p=endpointA.poses[clip.id][bone.id]??{x:0,y:0,rotation:0},q=endpointB.poses[clip.id][bone.id]??{x:0,y:0,rotation:0};loopPoseError=Math.max(loopPoseError,Math.hypot(p.x-q.x,p.y-q.y),Math.abs(p.rotation-q.rotation));}
  const e=.001,after=evaluateScene(doc,e).transforms[clip.id],before=evaluateScene(doc,duration-e).transforms[clip.id];seamSpeedError=Math.max(seamSpeedError,Math.hypot((after.x-a.x)/e-(b.x-before.x)/e,(after.y-a.y)/e-(b.y-before.y)/e));
 }
 if(maxContact>1||maxGrip>1)throw Error(file+': contact drift exceeds1px');
 if(doc.timeline?.loop&&(loopPoseError>.01||seamSpeedError>1))throw Error(file+': loop discontinuity');
 rows.push({file,duration,samples:241,maxContactPixels:maxContact,maxGripPixels:maxGrip,loopPoseError,seamSpeedError,evaluationMs,roundTrip:'PASS',sceneReadiness:doc.scenePlan?'PASS':'not-declared',notes:'Technical sampling is separate from visual review. Masked travelers are excluded from pose seam comparison and require invisible resets.'});
}
console.log(JSON.stringify(rows,null,2));`;
try{
 const bundle=join(folder,'check.cjs');await build({stdin:{contents:source,resolveDir:resolve('.'),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:resolve('tsconfig.json'),logLevel:'error'});
 const result=execFileSync(process.execPath,[bundle,...process.argv.slice(2)],{cwd:resolve('.'),encoding:'utf8'});
 writeFileSync('examples/motion-pipeline/technical-results.json',result);console.log(result);
}finally{rmSync(folder,{recursive:true,force:true});}
