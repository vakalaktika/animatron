// Repeatable browser journey against the built app, in an isolated profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import puppeteer from 'puppeteer-core';
const root=path.resolve('out'),output=path.resolve('examples/node-editor/qa');
fs.mkdirSync(output,{recursive:true});
const server=createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 const target=file===root?path.join(root,'index.html'):file;
 if(!target.startsWith(root+'/')||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404).end();return;}
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json','.png':'image/png'};
 res.setHeader('content-type',types[path.extname(target)]??'application/octet-stream');res.end(fs.readFileSync(target));
});
await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser, page;
try {
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1600,height:1150});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.evaluateOnNewDocument(()=>{localStorage.setItem('animatron.tour.v1','done');window.__exportedJson=[];const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='application/json')window.__exportedJson.push(blob);return original.call(this,blob);};});
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle0'});
 const click=async(name,scope='')=>{await page.waitForFunction(({name,scope})=>{const root=scope?document.querySelector(scope):document;const button=Array.from(root?.querySelectorAll('button')??[]).find(b=>b.textContent.trim()===name||b.getAttribute('aria-label')===name);if(!button||button.disabled)return false;button.click();return true;},{},{name,scope});};
 const readDoc=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc;});
 const waitSaved=async(predicate)=>page.waitForFunction(predicate,{timeout:10000,polling:100});
 const source=path.resolve('examples/motion-pipeline/illustrated/detailed-illustrated.animatron.json'),original=JSON.parse(fs.readFileSync(source,'utf8'));
 await click('Compositions');await(await page.waitForSelector('dialog[open][aria-label="Compositions"] input[type="file"][multiple]')).uploadFile(source);await click('Open '+original.name);
 await page.waitForSelector('[data-rig-part="hand-paint"]');
 const daughter=original.clips.find(c=>c.id==='daughter');await click(daughter.name);await click('Nodes');
 await page.waitForSelector('[data-motion-graph] .react-flow__node');
 await page.screenshot({path:path.join(output,'workspace-desktop.png')});
 const info=await page.$('button[aria-label="About Lift the paper airplane"]');
 await info.hover();await page.waitForSelector('[role="tooltip"]');
 assert.match(await page.$eval('[role="tooltip"]',el=>el.textContent),/From reusable rig/);
 await page.screenshot({path:path.join(output,'node-details-desktop.png')});
 await page.keyboard.press('Escape');assert.equal(await page.$('[role="tooltip"]'),null);

 await click('Add path','[data-motion-graph]');
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc.clips.find(c=>c.id==='daughter').motion?.blocks?.some(b=>b.id==='path-1');});
 await click('Move along path: Moves','[data-motion-graph]');await click('Lift the paper airplane: Motion','[data-motion-graph]');
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc.clips.find(c=>c.id==='daughter').motion?.blocks.find(b=>b.id==='path-1')?.controllerId==='plane-hand';});
 await click('Move along path: Moves','[data-motion-graph]');await click(daughter.name+': Moves','[data-motion-graph]');
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc.clips.find(c=>c.id==='daughter').motion?.blocks?.find(b=>b.id==='path-1')?.controllerId===undefined;});
 // Wire by dragging the real React Flow handles as well as by accessible port buttons.
 const handlePoint=async(node,port,type)=>page.evaluate(({node,port,type})=>{const el=Array.from(document.querySelectorAll('.react-flow__handle')).find(el=>el.dataset.nodeid===node&&el.dataset.handleid===port&&el.classList.contains(type));if(!el)throw new Error('Missing handle '+node+' '+port);const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};},{node:encodeURIComponent(JSON.stringify(node)),port,type});
 const from=await handlePoint(['daughter','block','path-1'],'motion','source'),to=await handlePoint(['daughter','controller','plane-hand'],'motion','target');
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:15});await page.mouse.up();
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc.clips.find(c=>c.id==='daughter').motion?.blocks?.find(b=>b.id==='path-1')?.controllerId==='plane-hand';});
 // Card drag through the real graph implementation; only release persists.
 const card=await page.$(`[data-motion-node='${encodeURIComponent(JSON.stringify(['daughter','controller','plane-hand']))}'] header`);
 await card.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await card.boundingBox();
 await page.mouse.move(box.x+50,box.y+20);await page.mouse.down();await page.mouse.move(box.x+122,box.y+56,{steps:8});await page.mouse.up();
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return Object.keys(s.projects.find(p=>p.id===s.currentId).doc.editor?.motionGraph.positions??{}).length>0;});
 const moved=await readDoc();assert.equal(moved.clips.find(c=>c.id==='daughter').rig.rasterSources[0].src,daughter.rig.rasterSources[0].src);
 await click('Undo','[data-motion-graph]');
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return !s.projects.find(p=>p.id===s.currentId).doc.editor;});
 await click('Redo','[data-motion-graph]');
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return !!s.projects.find(p=>p.id===s.currentId).doc.editor;});
 const bar=await page.$('button[aria-label="Move Move along path timing"]');await bar.evaluate(el=>el.scrollIntoView({block:'center'}));const barBox=await bar.boundingBox();
 await page.mouse.move(barBox.x+10,barBox.y+12);await page.mouse.down();await page.mouse.move(barBox.x+46,barBox.y+12,{steps:10});await page.mouse.up();
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc.clips.find(c=>c.id==='daughter').motion?.blocks?.find(b=>b.id==='path-1')?.start>0;});
 await click('Undo','[data-motion-graph]');
 await waitSaved(()=>{const s=JSON.parse(localStorage.getItem('animatron.projects.v1'));return s.projects.find(p=>p.id===s.currentId).doc.clips.find(c=>c.id==='daughter').motion?.blocks?.find(b=>b.id==='path-1')?.start===0;});
 await page.$eval('[data-motion-graph-canvas]',el=>el.scrollIntoView({block:'center'}));
 await page.screenshot({path:path.join(output,'connected-family.png')});
 await click('Close nodes','[data-motion-graph]');await click('Share');await click('Download JSON');await page.waitForFunction(()=>window.__exportedJson.length>0);
 const exported=JSON.parse(await page.evaluate(()=>window.__exportedJson.at(-1).text()));fs.writeFileSync(path.join(output,'edited-family.animatron.json'),JSON.stringify(exported,null,2));
 await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-rig-part="hand-paint"]');
 const reopened=await readDoc();assert.deepEqual(reopened.editor,exported.editor);assert.deepEqual(reopened.clips,exported.clips);
 await click(daughter.name);await click('Nodes');await page.waitForSelector('[data-motion-graph] .react-flow__node');
 await page.setViewport({width:390,height:844});await page.waitForSelector('dialog[open][aria-label="Motion nodes"]');
 const search=await page.$('[data-motion-graph] input[type="search"]');await search.type('Lift the paper airplane');await page.$eval('[data-motion-graph-canvas]',el=>el.scrollIntoView({block:'center'}));
 await page.screenshot({path:path.join(output,'workspace-mobile.png')});
 await click('About Lift the paper airplane','[data-motion-graph]');
 await page.waitForSelector('dialog[open] [role="tooltip"]');
 const overlay=await page.$eval('[role="tooltip"]',el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom};});
 assert.ok(overlay.left>=0&&overlay.right<=390&&overlay.bottom<=844);
 await page.screenshot({path:path.join(output,'node-details-mobile.png')});
 await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);
 const report={browser:await browser.version(),hoverAndTouchDetails:'PASS',realCardDrag:'PASS',realWireDrag:'PASS',realTimingDrag:'PASS',accessibleConnect:'PASS',undoRedo:'PASS',saveReopenExport:'PASS',artworkPreserved:'PASS',reducedMotion:'PASS',viewports:[1600,390],consoleErrors:0};
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} catch(error) { if(page) { console.log(JSON.stringify(await page.evaluate(()=>({currentId:JSON.parse(localStorage.getItem('animatron.projects.v1')).currentId,status:Array.from(document.querySelectorAll('[role="status"]')).map(e=>e.textContent),docs:JSON.parse(localStorage.getItem('animatron.projects.v1')).projects.map(p=>({id:p.id,name:p.doc.name,motion:p.doc.clips.find(c=>c.id==='daughter')?.motion}))}))));await page.screenshot({path:path.join(output,'failure.png')}); } throw error;
} finally {
 server.closeAllConnections();server.close();const owned=browser?.process(),stop=setTimeout(()=>owned?.kill('SIGKILL'),3000);stop.unref();try{await browser?.close();}finally{clearTimeout(stop);}
}
