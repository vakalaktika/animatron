#!/usr/bin/env node
// Draws a composition's share-link preview card (1200 × 630 PNG) with the
// studio's own ShareCardRenderer, in headless Chrome:
//
//   node card.mjs piece.json [out.png] [--time <seconds>] [--repo <checkout>] [--ref <ref> | --pinned] [--offline]
//
// How: the studio's renderer, stage and clip views are bundled with esbuild
// straight from an Animatron checkout, styled with the studio's own CSS run
// through its own Tailwind, given the studio's typefaces (Fraunces, Work
// Sans), served from 127.0.0.1, and opened in the Chrome already installed
// on this machine (CHROME_PATH to choose one). Nothing leaves the machine.
// The bundler, browser driver and fonts are installed once into
// ~/.cache/animatron-composer/renderer.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { homedir, platform } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { ensureRepo, HERE, parseArgs, repoInfo } from "./lib.mjs";

const RENDER_DIR = join(process.env.ANIMATRON_COMPOSER_CACHE || join(homedir(), ".cache", "animatron-composer"), "renderer");
const DEPS = {
  esbuild: "^0.25.0",
  "puppeteer-core": "^24.0.0",
  "@fontsource-variable/fraunces": "^5.0.0",
  "@fontsource-variable/work-sans": "^5.0.0",
};
/** Seconds to wait for the card; the studio gives up after 10. */
const TIMEOUT_MS = 30_000;

const CHROME_PATHS = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    join(homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  ],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge", "/snap/bin/chromium"],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
};

export function findChrome() {
  if (process.env.CHROME_PATH) return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  return (CHROME_PATHS[platform()] ?? []).find((p) => existsSync(p)) ?? null;
}

function ensureRendererDeps(log) {
  const pkgPath = join(RENDER_DIR, "package.json");
  const wanted = JSON.stringify({ name: "animatron-composer-renderer", private: true, dependencies: DEPS }, null, 2);
  const installed = existsSync(join(RENDER_DIR, "node_modules", ".deps")) && readFileSync(join(RENDER_DIR, "node_modules", ".deps"), "utf8") === wanted;
  if (installed) return;
  log("installing the card renderer (esbuild, puppeteer-core, fonts) once ...");
  mkdirSync(RENDER_DIR, { recursive: true });
  writeFileSync(pkgPath, wanted);
  // PUPPETEER_SKIP_DOWNLOAD: use the machine's own Chrome, never download one.
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", "--ignore-scripts"], {
    cwd: RENDER_DIR,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "1" },
  });
  writeFileSync(join(RENDER_DIR, "node_modules", ".deps"), wanted);
}

/** Content-based cache identity, including local edits and untracked source. */
export function rendererSourceStamp(repo) {
  const hash = createHash("sha256").update(JSON.stringify(DEPS));
  const walk = (relative) => {
    const path = join(repo, relative);
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(relative, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) hash.update(child).update(readFileSync(join(repo, child)));
    }
  };
  walk("src");
  walk("docs/mci-rig");
  for (const relative of ["package-lock.json", "tsconfig.json"]) {
    if (existsSync(join(repo, relative))) hash.update(relative).update(readFileSync(join(repo, relative)));
  }
  hash.update(readFileSync(join(HERE, "card", "entry.tsx")));
  hash.update(readFileSync(join(HERE, "card.mjs")));
  return hash.digest("hex").slice(0, 20);
}

/** Build once per actual source content, including dirty --repo changes. */
async function ensureBundle(repo, log) {
  const { commit } = repoInfo(repo);
  const entry = join(HERE, "card", "entry.tsx");
  const stamp = rendererSourceStamp(repo);
  const out = join(RENDER_DIR, "dist", stamp);
  if (existsSync(join(out, "app.js")) && existsSync(join(out, "app.css"))) return out;
  log(`building the card page from the studio at ${commit.slice(0, 7)} ...`);
  mkdirSync(out, { recursive: true });
  const fromRenderer = createRequire(join(RENDER_DIR, "package.json"));
  const fromRepo = createRequire(join(repo, "package.json"));

  // Script: the studio's renderer and stage, bundled from its source.
  const esbuild = fromRenderer("esbuild");
  await esbuild.build({
    entryPoints: [entry],
    outfile: join(out, "app.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    jsx: "automatic",
    tsconfig: join(repo, "tsconfig.json"),
    nodePaths: [join(repo, "node_modules")],
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: "var process = globalThis.process || { env: { NODE_ENV: 'production' } };" },
    loader: { ".svg": "text" },
    logLevel: "error",
  });

  // Styles: the studio's own stylesheets through its own Tailwind.
  const postcss = fromRepo("postcss");
  const tailwind = fromRepo("@tailwindcss/postcss");
  const sheets = ["src/app/styles/globals.css", "src/app/motion-studio/studio-motion.css"].map((f) => join(repo, f)).filter(existsSync);
  let css = "";
  for (const file of sheets) {
    const result = await postcss([tailwind({ base: repo })]).process(readFileSync(file, "utf8"), { from: file });
    css += result.css + "\n";
  }
  // Typefaces: next/font self-hosts Fraunces and Work Sans in the studio; same faces from Fontsource here.
  for (const [pkg, dir] of [["@fontsource-variable/fraunces", "fraunces"], ["@fontsource-variable/work-sans", "work-sans"]]) {
    const src = dirname(fromRenderer.resolve(`${pkg}/package.json`));
    cpSync(join(src, "files"), join(out, "fonts", dir, "files"), { recursive: true });
    css += readFileSync(join(src, "index.css"), "utf8").replaceAll("./files/", `./fonts/${dir}/files/`) + "\n";
  }
  css += ':root { --font-fraunces: "Fraunces Variable"; --font-work-sans: "Work Sans Variable"; }\nbody { -webkit-font-smoothing: antialiased; margin: 0; }\n';
  writeFileSync(join(out, "app.css"), css);
  return out;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff" };

function serve(dir, html) {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (path === "/") {
        res.writeHead(200, { "content-type": TYPES[".html"] });
        return res.end(html);
      }
      const file = resolve(dir, "." + path);
      if (!file.startsWith(dir) || !existsSync(file)) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

/**
 * Renders the card for `doc` and returns { png: Buffer, time }.
 * Throws with a plain reason when it can't (no Chrome, a picture that
 * never loads, ...): callers treat a card as optional, as the studio does.
 */
export async function renderCard(repo, doc, { time = null, log = console.error } = {}) {
  const chrome = findChrome();
  if (!chrome) throw new Error("no Chrome, Chromium, Edge or Brave found (set CHROME_PATH to one)");
  ensureRendererDeps(log);
  const dir = await ensureBundle(repo, log);
  const payload = JSON.stringify(doc).replaceAll("<", "\\u003c");
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.__DOC=${payload};window.__TIME=${time == null ? "null" : Number(time)};</script><script type="module" src="/app.js"></script></body></html>`;
  const server = await serve(dir, html);
  const puppeteer = createRequire(join(RENDER_DIR, "package.json"))("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-proxy-server", "--hide-scrollbars", ...(process.getuid?.() === 0 ? ["--no-sandbox"] : [])],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
    try {
      await page.waitForFunction(() => window.__CARD || window.__CARD_ERROR, { timeout: TIMEOUT_MS });
    } catch {
      throw new Error(`drawing the card took longer than ${TIMEOUT_MS / 1000} s${problems.length ? ` (${problems[0]})` : ""}`);
    }
    const { card, error, at } = await page.evaluate(() => ({ card: window.__CARD, error: window.__CARD_ERROR, at: window.__CARD_TIME }));
    if (error) throw new Error(`the studio's card renderer failed: ${error}`);
    return { png: Buffer.from(card, "base64"), time: at };
  } finally {
    await browser.close();
    server.close();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const argv = process.argv.slice(2);
  const ti = argv.indexOf("--time");
  const time = ti >= 0 ? Number(argv.splice(ti, 2)[1]) : null;
  const opts = parseArgs(argv);
  if (!opts.files.length || opts.help) {
    console.log("usage: node card.mjs piece.json [out.png] [--time <seconds>] [--repo <checkout>] [--ref <ref> | --pinned] [--offline]");
    process.exit(opts.help ? 0 : 2);
  }
  const [file, outArg] = opts.files;
  const out = outArg ?? file.replace(/\.json$/i, "") + ".card.png";
  try {
    const repo = ensureRepo(opts);
    const doc = JSON.parse(readFileSync(file, "utf8"));
    const { png, time: at } = await renderCard(repo, doc, { time });
    writeFileSync(out, png);
    console.log(`card: ${out} (1200 × 630, frame at ${at.toFixed(2)} s)`);
  } catch (e) {
    console.error(`card: ${e.message}`);
    process.exit(1);
  }
}
