// Reproducible graph organization of the existing finished scenes. No artwork or motion is baked.
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
globalThis.DOMParser=new JSDOM('').window.DOMParser;
const root=path.resolve(import.meta.dirname,'..'),folder=mkdtempSync(path.join(tmpdir(),'animatron-graph-'));
try {
 const compiled=path.join(folder,'graph.cjs');
 await build({stdin:{contents:`export {buildMotionGraph} from './src/app/motion-studio/lib/motionGraph'; export {docFromJson} from './src/app/motion-studio/lib/importDoc'; export {evaluateScene} from './src/app/components/motion-studio/engine/motionScene';`,resolveDir:root,loader:'ts'},outfile:compiled,platform:'node',format:'cjs',bundle:true,logLevel:'error'});
 const {buildMotionGraph,docFromJson,evaluateScene}=createRequire(import.meta.url)(compiled);
 const examples=[['family','examples/motion-pipeline/illustrated/detailed-illustrated.animatron.json'],['bedtime','examples/motion-pipeline/original-bedtime.animatron.json']];
 const output=path.join(root,'examples/node-editor');mkdirSync(output,{recursive:true});const report=[];
 for(const [name,input] of examples){
  const result=docFromJson(readFileSync(path.join(root,input),'utf8'),input);assert.ok(result.ok,result.message);const source=result.doc,graph=buildMotionGraph(source);
  const positions={};source.clips.forEach((clip,group)=>{const counts={};graph.nodes.filter(n=>n.clipId===clip.id).forEach(node=>{const column={object:0,block:1,controller:2,constraint:3,bone:4,socket:5}[node.kind];const row=counts[node.kind]??0;counts[node.kind]=row+1;positions[node.id]={x:column*250,y:group*440+row*210};});});
  const doc={...source,editor:{motionGraph:{version:1,positions}}};
  const reopened=docFromJson(JSON.stringify(doc),name+'.nodes.animatron.json');assert.ok(reopened.ok,reopened.message);assert.deepEqual(reopened.doc.editor,doc.editor);
  assert.deepEqual(reopened.doc.clips,source.clips);
  for(const time of [0,.6,1.1,1.8,2.2,3.8,5.2,7.8,8]) assert.deepEqual(evaluateScene(reopened.doc,time),evaluateScene(source,time));
  writeFileSync(path.join(output,name+'.nodes.animatron.json'),JSON.stringify(doc,null,2)+'\n');
  report.push({name,nodes:graph.nodes.length,edges:graph.edges.length,artworkAndMotionUnchanged:true,roundTrip:true,evaluatedSamples:9});
 }
 writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{rmSync(folder,{recursive:true,force:true});}
