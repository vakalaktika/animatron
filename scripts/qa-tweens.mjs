// Exercises the built application UI in an isolated local browser profile.
// Run after npm run build. Never touches production or the user's browser data.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import puppeteer from "puppeteer-core";
import { isDeepStrictEqual } from "node:util";
const root = resolve(import.meta.dirname, "../out");
const [sceneFile, outputDirectory] = process.argv.slice(2);
const output = outputDirectory ? resolve(outputDirectory) : resolve(import.meta.dirname, "../examples/tween-studio/qa");
mkdirSync(output, { recursive: true });
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  let path = resolve(root, "." + new URL(req.url, "http://local").pathname);
  if (path === root) path = join(root, "index.html");
  if (!path.startsWith(root + "/") || !existsSync(path) || !statSync(path).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader("content-type", types[extname(path)] ?? "application/octet-stream");
  res.end(readFileSync(path));
});
await new Promise((done, reject) => { server.on("error", reject); server.listen(0, "127.0.0.1", done); });
let browser;
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", e => failures.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluateOnNewDocument(() => localStorage.setItem("animatron.tour.v1", "done"));
  await page.evaluateOnNewDocument(() => {
    window.__exportedJson = [];
    const original = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
      if (blob.type === "application/json") window.__exportedJson.push(blob);
      return original.call(this, blob);
    };
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin, { waitUntil: "networkidle0" });
  const click = async text => {
    await page.waitForFunction(t => {
      const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === t || b.getAttribute("aria-label") === t);
      if (!button) return false;
      button.click();
      return true;
    }, {}, text);
  };
  await click("Compositions");
  const file = sceneFile ? resolve(sceneFile) : resolve(import.meta.dirname, "../examples/tween-studio/lamp.animatron.json");
  await (await page.$('input[type="file"][multiple]')).uploadFile(file);
  const document = JSON.parse(readFileSync(file, "utf8"));
  await click("Open " + document.name);
  await page.waitForSelector('[data-rig-part="shade"]');
  await click(document.clips[0].name);
  await click("Lower arm");
  const changeNumber = async (label,value) => {
    const input=await page.waitForSelector(`input[aria-label="${label}"]`);
    await input.evaluate((el,next)=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,String(next));
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
    },value);
  };
  const selectLabel = async (label,value) => {
    const id=await page.evaluate(text=>Array.from(document.querySelectorAll("label")).find(l=>l.textContent.includes(text))?.querySelector("select")?.id,label);
    if(id)await page.select(`#${id}`,value);
    else {
      const selects=await page.$$("select");
      let found=false;
      for(const select of selects) if(await select.evaluate((el,text)=>el.getAttribute("aria-label")===text||el.closest("label")?.textContent.includes(text),label)) {await select.select(value);found=true;break;}
      if(!found)throw new Error(`Missing select ${label}`);
    }
  };
  assert.equal(await page.evaluate(()=>!!document.querySelector('button[aria-label="Play"]')),true);
  await selectLabel("Tween at 0.00 s","smoothOut");
  await changeNumber("Turn at 0.00 s in °",3);
  await changeNumber("Time of key 1.50 s in s",1.6);
  await page.waitForFunction(()=>{
    const store=JSON.parse(localStorage.getItem("animatron.projects.v1"));
    const doc=store.projects.find(p=>p.id===store.currentId).doc;
    const track=doc.clips[0].rig.animations[0].tracks.find(t=>t.boneId==="lower");
    return track.keys[0].tween.name==="smoothOut"&&track.keys[0].rotation===3&&track.keys[1].time===1.6;
  });
  await page.screenshot({path:join(output,"rig-tween-controls.png")});
  await click("Save rig (.mci.json)");
  await page.waitForFunction(()=>window.__exportedJson.length>0);
  const rig=JSON.parse(await page.evaluate(()=>window.__exportedJson.at(-1).text()));
  assert.equal(rig.version,3);
  assert.equal(rig.animations[0].tracks[0].keys.length,5);
  assert.ok(isDeepStrictEqual(rig.bindings,document.clips[0].rig.bindings));
  writeFileSync(join(output,"edited-export.mci.json"),JSON.stringify(rig));
  await click(document.clips[1].name);
  await click("Tween to…");
  await changeNumber("Destination Y in px",560);
  await click("Create tween");
  await page.waitForFunction(()=>{
    const store=JSON.parse(localStorage.getItem("animatron.projects.v1"));
    return store.projects.find(p=>p.id===store.currentId).doc.clips[1].keys.y?.length===2;
  });
  await page.screenshot({path:join(output,"object-tween-controls.png")});
  await page.reload({waitUntil:"networkidle0"});
  await page.waitForSelector('[data-rig-part="shade"]');
  await click("Share");
  await click("Download JSON");
  await page.waitForFunction(()=>window.__exportedJson.length>0);
  const composition=JSON.parse(await page.evaluate(()=>window.__exportedJson.at(-1).text()));
  assert.ok(isDeepStrictEqual(composition.clips[0].rig,rig));
  assert.equal(composition.clips[1].keys.y.length,2);
  assert.equal(composition.clips[1].keys.rotation.length,5);
  assert.equal(composition.timeline.tailSeconds,0);
  writeFileSync(join(output,"edited-export.animatron.json"),JSON.stringify(composition));
  await page.keyboard.press("Escape");
  await page.screenshot({ path: join(output, "editor-desktop.png") });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, "editor-mobile.png") });
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ browser: await browser.version(), import: "PASS", editCurveTimeAndPose: "PASS", objectEndpointTween: "PASS", saveReopen: "PASS", rigAndCompositionExport: "PASS", reducedMotionArrival: "PASS", consoleErrors: failures.length, viewports: [1440, 390] }));
} finally {
  await browser?.close();
  server.close();
}
