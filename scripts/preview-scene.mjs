// Local benchmark capture using the application's actual StageCanvas,
// frame evaluation and renderVideo export code. Nothing is uploaded.
// Requires esbuild (installed by the app toolchain), puppeteer-core and Chrome.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:http";

const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const puppeteer = require("puppeteer-core");
const repo = resolve(import.meta.dirname, "..");
const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: node scripts/preview-scene.mjs scene.animatron.json output-prefix");
const folder = mkdtempSync(join(tmpdir(), "animatron-preview-"));
let server;
let browser;
try {
  await build({ entryPoints: [join(repo, "scripts/scene-preview/entry.tsx")], outfile: join(folder, "scene.js"), bundle: true, format: "esm", platform: "browser", jsx: "automatic", tsconfig: join(repo, "tsconfig.json"), define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
  const css = `.relative{position:relative}.absolute{position:absolute}.block{display:block}.overflow-hidden{overflow:hidden}.overflow-visible{overflow:visible}body{margin:0}`;
  server = createServer((req, res) => {
    if (req.url === "/scene.js") { res.setHeader("content-type", "application/javascript"); res.end(readFileSync(join(folder, "scene.js"))); }
    else { res.setHeader("content-type", "text/html"); res.end(`<!doctype html><style>${css}</style><div id="root"></div><script type="module" src="/scene.js"></script>`); }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.scene, { timeout: 10000 });
  const duration = await page.evaluate((json) => window.scene.load(json), readFileSync(resolve(input), "utf8"));
  const exportData = async (suffix, fn) => {
    const result = await page.evaluate(fn);
    writeFileSync(`${output}${suffix}`, Buffer.from(result.split(",")[1], "base64"));
  };
  const moments = flags.includes("--stills-only") ? [1.08, 1.15, 1.25, 2.5] : [0, 1, 2, 3, 4, 5, 6, 7, duration - 1 / 24];
  for (const at of moments) {
    await page.evaluate((t) => window.scene.seek(t), at);
    await exportData(`.frame-${at.toFixed(2)}.png`, () => window.scene.still());
  }
  if (!flags.includes("--stills-only")) await exportData(".mp4", () => window.scene.video());
  const saved = await page.evaluate(() => window.scene.save());
  writeFileSync(`${output}.reopened.animatron.json`, saved);
  if (errors.length) throw new Error(errors.join("; "));
  console.log(JSON.stringify({ input, duration, preview: flags.includes("--stills-only") ? null : `${output}.mp4`, frames: moments.length, renderer: "Application StageCanvas + renderVideo", browser: await browser.version() }));
} finally {
  await browser?.close();
  server?.close();
  rmSync(folder, { recursive: true, force: true });
}
