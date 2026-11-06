// Repeatable browser journey against the built app, in an isolated profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import puppeteer from 'puppeteer-core';
const root=path.resolve('out'),output=path.resolve('examples/motion-pipeline/qa');
fs.mkdirSync(output,{recursive:true});
const server=createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 const target=file===root?path.join(root,'index.html'):file;
 if(!target.startsWith(root+'/')||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404).end();return;}
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json','.png':'image/png'};
 res.setHeader('content-type',types[path.extname(target)]??'application/octet-stream');res.end(fs.readFileSync(target));
});
await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1440,height:1000});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.evaluateOnNewDocument(()=>{
  localStorage.setItem('animatron.tour.v1','done');window.__exportedJson=[];
  const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='application/json')window.__exportedJson.push(blob);return original.call(this,blob);};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle0'});
 const click=async name=>{await page.waitForFunction(name=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===name||b.getAttribute('aria-label')===name);if(!button||button.disabled)return false;button.click();return true;},{},name);};
 const number=async(label,value)=>{const input=await page.waitForSelector(`input[type="number"][aria-label="${label}"]`);await input.evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);};
 const readDoc=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc;});
 const source=path.resolve('examples/motion-pipeline/illustrated/detailed-illustrated.animatron.json');
 const original=JSON.parse(fs.readFileSync(source,'utf8'));
 await click('Compositions');await(await page.waitForSelector('dialog[open][aria-label="Compositions"] input[type="file"][multiple]')).uploadFile(source);await click('Open '+original.name);
 await page.waitForSelector('[data-rig-part="hand-paint"]');
 assert.ok(await page.$('button[aria-label="Play"]'),'Reduced motion starts paused');
 await click(original.clips.find(c=>c.id==='daughter').name);
 await number('Lift the paper airplane Y in px',370);
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId)?.doc.clips.find(c=>c.id==='daughter')?.motion?.controllers?.[0]?.keys?.y?.[0]?.value===370;},{timeout:10000});
 const handle=await page.waitForSelector('button[data-motion-controller="plane-hand"]');await handle.focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId)?.doc.clips.find(c=>c.id==='daughter')?.motion?.controllers?.[0]?.keys?.x?.[0]?.value===1101;},{timeout:10000});
 await page.waitForFunction(()=>!document.body.innerText.includes('Not saved')&&!document.body.innerText.includes("exceeded the quota"));
 await number('Lift the paper airplane key 0.60 time in s',.7);
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId)?.doc.clips.find(c=>c.id==='daughter')?.motion?.controllers?.[0]?.keys?.x?.[1]?.time===.7;});
 await click('Relationships (advanced)');
 await page.waitForSelector('svg[aria-label="Motion relationships"]');
 await page.screenshot({path:path.join(output,'controls-desktop.png')});
 const edited=await readDoc();
 assert.equal(edited.version,4);assert.equal(edited.timeline.duration,8);assert.equal(edited.timeline.tailSeconds,0);
 const daughter=edited.clips.find(c=>c.id==='daughter');
 assert.equal(daughter.motion.controllers[0].keys.x[0].value,1101);
 assert.equal(daughter.rig.rasterSources[0].src,original.clips.find(c=>c.id==='daughter').rig.rasterSources[0].src);
 await click(original.clips.find(c=>c.id==='plane').name);
 await page.waitForFunction(name=>Array.from(document.querySelectorAll('h2,h3')).some(h=>h.textContent.trim()===name),{},original.clips.find(c=>c.id==='plane').name);
 const exportCount=await page.evaluate(()=>window.__exportedJson.length);await click('Save layer as JSON');
 await page.waitForFunction(count=>window.__exportedJson.length>count,{},exportCount);
 const layer=JSON.parse(await page.evaluate(()=>window.__exportedJson.at(-1).text()));
 assert.deepEqual(layer.clips.map(c=>c.id),['daughter','plane']);assert.ok(layer.scenePlan.actors.every(a=>layer.clips.some(c=>c.id===a.clipId)));
 fs.writeFileSync(path.join(output,'layer-dependencies.animatron.json'),JSON.stringify(layer,null,2));
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-rig-part="hand-paint"]');
 await click('Share');await click('Download JSON');await page.waitForFunction(()=>window.__exportedJson.length>0);
 const exported=JSON.parse(await page.evaluate(()=>window.__exportedJson.at(-1).text()));
 assert.deepEqual(exported,await readDoc());
 fs.writeFileSync(path.join(output,'edited-reopened.animatron.json'),JSON.stringify(exported,null,2));
 await page.keyboard.press('Escape');
 await click(original.clips.find(c=>c.id==='daughter').name);
 await page.setViewport({width:390,height:844});await click('Edit');
 await number('Lift the paper airplane Y in px',372);
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId)?.doc.clips.find(c=>c.id==='daughter')?.motion?.controllers?.[0]?.keys?.y?.[0]?.value===372;});
 await page.screenshot({path:path.join(output,'controls-mobile.png')});
 await page.setViewport({width:1440,height:1000});
 await click(original.clips.find(c=>c.id==='bird').name);await number('Bird flies right duration in s',6);
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId)?.doc.clips.find(c=>c.id==='bird')?.motion?.blocks?.[0]?.duration===6;});
 await click('Compositions');
 const clothPath=path.resolve('examples/deformation-proof/cloth.animatron.json'),cloth=JSON.parse(fs.readFileSync(clothPath,'utf8'));
 await(await page.waitForSelector('dialog[open][aria-label="Compositions"] input[type="file"][multiple]')).uploadFile(clothPath);await click('Open '+cloth.name);await page.waitForSelector('[data-rig-mesh]');await click(cloth.clips[0].name);await click('Relationships (advanced)');
 const mesh=cloth.clips[0].rig.meshes[0],vertex=mesh.vertices.findIndex(v=>v.weights.length>1),bone=mesh.vertices[vertex].weights[0].boneId;
 await page.evaluate(index=>{const label=Array.from(document.querySelectorAll('label')).find(l=>l.querySelector('span')?.textContent==='Bending point');const select=label.querySelector('select');select.value=String(index);select.dispatchEvent(new Event('change',{bubbles:true}));},vertex);
 await number(`${bone} influence value`,.7);
 await page.waitForFunction(({vertex})=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1')),d=s.projects.find(p=>p.id===s.currentId)?.doc;return Math.abs(d.clips[0].rig.meshes[0].vertices[vertex].weights[0].weight-.7)<1e-6;},{}, {vertex});
 await page.screenshot({path:path.join(output,'mesh-weight-edit.png')});
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-rig-mesh]');
 const savedCloth=await readDoc();assert.equal(savedCloth.clips[0].rig.meshes[0].vertices[vertex].weights[0].weight,.7);
 assert.deepEqual(savedCloth.clips[0].rig.meshes[0].triangles,mesh.triangles);
 await click('Share');await click('Download JSON');await page.waitForFunction(()=>window.__exportedJson.length>0);
 const exportedCloth=JSON.parse(await page.evaluate(()=>window.__exportedJson.at(-1).text()));assert.deepEqual(exportedCloth,savedCloth);
 fs.writeFileSync(path.join(output,'edited-cloth.animatron.json'),JSON.stringify(exportedCloth,null,2));
 assert.deepEqual(errors,[]);
 const report={browser:await browser.version(),import:'PASS',numericTargetEdit:'PASS',keyboardTargetPose:'PASS',targetKeyRetime:'PASS',relationshipsView:'PASS',objectPathRetime:'PASS',layerDependencyExport:'PASS',preserveArtwork:'PASS',saveReopenExport:'PASS',meshEditSaveReopenExport:'PASS',reducedMotion:'PASS',mobileEdit:'PASS',viewports:[1440,390],consoleErrors:0};
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{
 // Chrome can wait indefinitely on a download during shutdown. Tests above
 // already finished; bound cleanup to this isolated browser process only.
 server.closeAllConnections();server.close();
 const owned=browser?.process(),stop=setTimeout(()=>owned?.kill('SIGKILL'),3000);stop.unref();
 try{await browser?.close();}catch(error){if(!owned?.killed)throw error;}finally{clearTimeout(stop);}
}
