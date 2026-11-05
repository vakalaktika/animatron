import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const repo=process.env.ANIMATRON_TEST_REPO;
test('scene preflight rejects unsupported acting and protects tween output, while scoped motion round-trips',{skip:!repo},()=>{
 const folder=mkdtempSync(join(tmpdir(),'animatron-scene-check-'));
 try{
  const input=join(folder,'scene.json'),spec=join(folder,'motion.json'),out=join(folder,'out.json');
  const doc=JSON.parse(readFileSync(join(repo,'examples/scene-structure/sunroom-structured.animatron.json'),'utf8'));
  const natural=JSON.parse(readFileSync(join(repo,'examples/scene-structure/natural-acting-required.plan.json'),'utf8'));
  writeFileSync(spec,JSON.stringify({version:1,duration:8,loop:true,targets:[{clipId:'scene',properties:{rotation:[{time:0,value:0},{time:8,value:0}]}}]}));
  writeFileSync(input,JSON.stringify({...doc,scenePlan:natural}));writeFileSync(out,'protected');
  const args=[resolve(import.meta.dirname,'../tween.mjs'),input,spec,'--out',out,'--repo',repo,'--offline'];
  const bad=spawnSync(process.execPath,args,{encoding:'utf8',env:process.env});
  assert.notEqual(bad.status,0);assert.match(bad.stderr,/motion preflight failed/);assert.equal(readFileSync(out,'utf8'),'protected');
  writeFileSync(input,JSON.stringify(doc));
  const good=spawnSync(process.execPath,args,{encoding:'utf8',env:process.env});
  assert.equal(good.status,0,good.stderr);assert.deepEqual(JSON.parse(readFileSync(out,'utf8')).scenePlan,doc.scenePlan);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
