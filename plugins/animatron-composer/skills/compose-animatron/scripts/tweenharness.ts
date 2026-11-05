// Run against the selected app source, never an approximated importer.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { docFromJson } from '@/app/motion-studio/lib/importDoc';
import { docDuration } from '@/app/components/motion-studio/engine/timing';
import { applyTweens } from './tween.mjs';
const {JSDOM}=createRequire(join(process.cwd(),'package.json'))('jsdom');
(globalThis as {DOMParser?:unknown}).DOMParser=new JSDOM('').window.DOMParser;
try{
 const [input,specPath]=process.argv.slice(2);
 const raw=JSON.parse(readFileSync(input,'utf8'));
 const spec=JSON.parse(readFileSync(specPath,'utf8'));
 const before=docFromJson(JSON.stringify(raw),'source.json');
 if(!before.ok)throw new Error(before.message);
 if(before.warnings.length||!isDeepStrictEqual(JSON.parse(JSON.stringify(before.doc)),raw))throw new Error('source composition requires repair; validate and repair it before tween authoring');
 const doc=applyTweens(raw,spec);
 const after=docFromJson(JSON.stringify(doc),'tweened.json');
 if(!after.ok)throw new Error(after.message);
 if(after.warnings.length||!isDeepStrictEqual(JSON.parse(JSON.stringify(after.doc)),doc))throw new Error('target studio repairs the tweened file; use a studio build supporting these tracks');
 const duration=docDuration(after.doc);
 if(Math.abs(duration-spec.duration)>0.005)throw new Error(`requested ${spec.duration}s but application evaluates ${duration}s; adjust layer timing`);
 if(after.doc.scenePlan!==undefined){
  const {reviewScene}=createRequire(join(process.cwd(),'package.json'))(join(process.cwd(),'src/app/components/motion-studio/engine/sceneReview.ts'));
  const review=reviewScene(after.doc);
  if(!review.ok)throw new Error('motion preflight failed: '+review.issues.map((i:{message:string})=>i.message).join(' '));
 }
 const notes=[];
 if(spec.loop)notes.push('Loop requested: bone clips repeat; object property tracks hold after their last key and repeat with whole-composition playback. Check position and velocity seams visually.');
 const keys=spec.targets.reduce((n: number,t: {properties?:Record<string,unknown[]>;bones?:Record<string,unknown[]>})=>n+Object.values({...t.properties,...t.bones}).reduce((a,k)=>a+k.length,0),0);
 writeFileSync(1,`RESULT ${JSON.stringify({ok:true,doc,duration,keys,notes})}\n`);
}catch(e){writeFileSync(1,`RESULT ${JSON.stringify({ok:false,error:(e as Error).message})}\n`);process.exitCode=1;}
