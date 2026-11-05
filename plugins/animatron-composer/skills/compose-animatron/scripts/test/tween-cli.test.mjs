// Explicit integration suite: set ANIMATRON_COMPOSER_CACHE to an existing
// Composer runtime cache, and ANIMATRON_TEST_REPO to a source checkout.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=process.env.ANIMATRON_TEST_REPO;
test('CLI refuses malformed inputs without overwriting output, then writes validated sparse result',{skip:!repo?'set ANIMATRON_TEST_REPO to run against an actual studio checkout':false},()=>{
 const dir=mkdtempSync(join(tmpdir(),'animatron-tween-test-'));
 try{
  const input=join(repo,'examples/illustrated-scenes/sunroom-glider/sunroom-glider.animatron.json');
  const specPath=join(dir,'spec.json'),output=join(dir,'output.json');
  const cli=fileURLToPath(new URL('../tween.mjs',import.meta.url));
  const spec={version:1,duration:8,loop:true,targets:[{clipId:'scene',bones:{lift:[{time:0,rotation:0},{time:2,rotation:-4},{time:8,rotation:0}]}}]};
  const run=()=>spawnSync(process.execPath,[cli,input,specPath,'--out',output,'--repo',resolve(repo),'--offline'],{encoding:'utf8'});
  for(const corrupt of [s=>s.targets[0].clipId='missing',s=>s.targets[0].bones.lift[1].time=0,s=>s.targets[0].bones.lift[0].ease={name:'custom',custom:[-1,0,1,1]},s=>s.duration=2]){
   const bad=structuredClone(spec);corrupt(bad);writeFileSync(specPath,JSON.stringify(bad));writeFileSync(output,'original');
   const r=run();assert.notEqual(r.status,0,r.stdout);assert.equal(readFileSync(output,'utf8'),'original');
  }
  writeFileSync(specPath,JSON.stringify(spec));const success=run();assert.equal(success.status,0,success.stderr);
  const result=JSON.parse(readFileSync(output,'utf8'));const original=JSON.parse(readFileSync(input,'utf8'));
  assert.equal(result.clips[1].rig.version,3);assert.equal(result.clips[1].rig.animations[0].tracks.find(t=>t.boneId==='lift').keys.length,3);
  assert.equal(result.clips[1].rig.svg,original.clips[1].rig.svg);assert.deepEqual(result.clips[1].rig.rasterAttachments,original.clips[1].rig.rasterAttachments);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
