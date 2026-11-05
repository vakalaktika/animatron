// Exercises the built application UI in an isolated local browser profile.
// Run after npm run build. Never touches production or the user's browser data.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import puppeteer from "puppeteer-core";
const root = resolve(import.meta.dirname, "../out");
const output = resolve(import.meta.dirname, "../examples/illustrated-scenes/qa");
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
  const file = resolve(import.meta.dirname, "../examples/illustrated-scenes/garden-glider/garden-glider-layered.animatron.json");
  const input = await page.$('input[type="file"][multiple]');
  await input.uploadFile(file);
  const document = JSON.parse(readFileSync(file, "utf8"));
  const name = document.name;
  await click("Open " + name);
  await page.waitForSelector('[data-rig-part="lift"] image');
  // Select the scene's layer from its timeline/layer row.
  await click(document.clips[0].name);
  await page.waitForSelector("select");
  assert.equal(await page.evaluate(() => !!Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("aria-label") === "Play")), true, "reduced motion must remain paused after opening a project");
  for (const select of await page.$$("select")) {
    if (await select.evaluate(e => Array.from(e.options).some(o => o.value === "side"))) await select.select("side");
  }
  await page.waitForFunction(() => document.querySelector('[data-rig-part="head-side"]').getAttribute("opacity") === "1");
  assert.equal(await page.$eval('[data-rig-part="head-front"]', e => e.getAttribute("opacity")), "0");
  await click("lift");
  const turn = await page.waitForSelector('input[aria-label="Turn lift in °"]');
  await turn.evaluate(el => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "-6");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const store = JSON.parse(localStorage.getItem("animatron.projects.v1"));
    const current = store.projects.find(p => p.id === store.currentId);
    const animation = current.doc.clips[0].rig.animations[0];
    return animation.drawingTracks[0].keys.some(k => k.time === 0 && k.drawingId === "side") && animation.tracks.find(t => t.boneId === "lift").keys[0].rotation === -6;
  });
  await click("Save rig (.mci.json)");
  await page.waitForFunction(() => window.__exportedJson.length > 0);
  const rig = JSON.parse(await page.evaluate(() => window.__exportedJson.at(-1).text()));
  assert.equal(rig.rasterAttachments.length, 2);
  assert.equal(rig.animations[0].drawingTracks[0].keys[0].drawingId, "side");
  assert.equal(rig.animations[0].tracks.find(t => t.boneId === "lift").keys[0].rotation, -6);
  writeFileSync(join(output, "edited-export.mci.json"), JSON.stringify(rig));
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-rig-part="head-side"]');
  assert.equal(await page.$eval('[data-rig-part="head-side"]', e => e.getAttribute("opacity")), "1", "drawing edit survives save/reopen");
  await click("Share");
  await click("Download JSON");
  await page.waitForFunction(() => window.__exportedJson.length > 0);
  const composition = JSON.parse(await page.evaluate(() => window.__exportedJson.at(-1).text()));
  assert.equal(composition.timeline.tailSeconds, 0);
  assert.deepEqual(composition.clips[0].rig, rig);
  writeFileSync(join(output, "edited-export.animatron.json"), JSON.stringify(composition));
  await page.keyboard.press("Escape");
  await page.screenshot({ path: join(output, "editor-desktop.png") });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, "editor-mobile.png") });
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ browser: await browser.version(), import: "PASS", editDrawingAndPose: "PASS", saveReopen: "PASS", rigAndCompositionExport: "PASS", reducedMotionArrival: "PASS", consoleErrors: failures.length, viewports: [1440, 390] }));
} finally {
  await browser?.close();
  server.close();
}
