// Shared plumbing for validate.mjs and refresh.mjs: finding or caching an
// Animatron checkout, running the harness inside it, and fingerprinting the
// files the composition schema lives in. Only the plugin's own cache clone is
// ever fetched, checked out or npm-installed; a checkout passed with --repo is
// used exactly as it is.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, mkdtempSync, openSync, closeSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = resolve(HERE, "..");
export const LOCK_PATH = join(SKILL_DIR, "schema.lock.json");
export const REPO_URL = "https://github.com/vakalaktika/animatron.git";
export const STUDIO_URL = "https://vakalaktika.github.io/animatron/";
const TSX = "tsx@4";

/** Files whose change can change what a valid composition is. Kept in schema.lock.json with a hash each. */
export const SCHEMA_FILES = [
  "src/app/components/motion-studio/types.ts",
  "src/app/motion-studio/lib/migrate.ts",
  "src/app/motion-studio/lib/importDoc.ts",
  "src/app/motion-studio/lib/share.ts",
  "src/app/motion-studio/presets.ts",
  "src/app/motion-studio/templates.ts",
  "src/app/motion-studio/lib/shapes.ts",
  "src/app/motion-studio/lib/waypoints.ts",
  "src/app/motion-studio/lib/tree.ts",
  "src/app/components/motion-studio/engine/easing.ts",
  "src/app/components/motion-studio/engine/keys.ts",
  "src/app/components/motion-studio/engine/line.ts",
  "src/app/components/motion-studio/engine/trail.ts",
  "src/app/components/motion-studio/engine/ribbon.ts",
  "src/app/components/motion-studio/engine/text.ts",
  "src/app/components/motion-studio/engine/timing.ts",
  "src/app/components/motion-studio/engine/rainbow.ts",
  // Short links (v0.2): the studio's share code and the database rules it relies on.
  "src/app/motion-studio/lib/cloud.ts",
  "supabase/migrations/20261026000000_cloud.sql",
  "supabase/migrations/20261104000000_share_pages.sql",
  // Preview cards (v0.3): the renderer card.mjs bundles, and the studio's typefaces.
  "src/app/motion-studio/export/ShareCardRenderer.tsx",
  "src/app/motion-studio/export/shareCard.ts",
  "src/app/layout-helpers.ts",
  // Rigs (v0.4): the engine rig.mjs drives, the import it mirrors, and the shared contract.
  "src/app/components/motion-studio/engine/rig.ts",
  "src/app/components/motion-studio/engine/rigSvg.ts",
  "src/app/components/motion-studio/engine/rigV2.ts",
  "src/app/motion-studio/lib/rigImport.ts",
  "docs/mci-rig/mci-rig-v1.md",
  "docs/mci-rig/mci-rig-v1.schema.json",
  "docs/mci-rig/mci-rig-v2.md",
  "docs/mci-rig/mci-rig-v2.schema.json",
  "src/app/components/motion-studio/engine/rigTween.ts",
  "docs/mci-rig/mci-rig-v3.md",
  "docs/mci-rig/mci-rig-v3.schema.json",
  "docs/mci-rig/mci-easing.cjs",
  "docs/mci-rig/mci-rig-core.cjs",
  "docs/mci-rig/mci-rig-v2.cjs",
  "docs/mci-rig/example-character.mci.json",
];

export function parseArgs(argv) {
  const opts = { files: [], repo: null, ref: "origin/main", offline: false, studioUrl: STUDIO_URL, pinned: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") opts.repo = resolve(argv[++i]);
    else if (a === "--ref") opts.ref = argv[++i];
    else if (a === "--pinned") opts.pinned = true;
    else if (a === "--offline") opts.offline = true;
    else if (a === "--studio-url") opts.studioUrl = argv[++i];
    else if (a === "-h" || a === "--help") opts.help = true;
    else opts.files.push(resolve(a));
  }
  return opts;
}

const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function readLock() {
  return existsSync(LOCK_PATH) ? JSON.parse(readFileSync(LOCK_PATH, "utf8")) : null;
}

/** A checkout to test against: the one given with --repo, or the plugin's cache clone at `ref`. */
export function ensureRepo(opts, log = console.error) {
  if (opts.repo) {
    if (!existsSync(join(opts.repo, "src/app/components/motion-studio/types.ts"))) throw new Error(`${opts.repo} is not an Animatron checkout`);
    if (!existsSync(join(opts.repo, "node_modules/lz-string"))) throw new Error(`${opts.repo} has no node_modules; run "npm ci" there first (or drop --repo to use the plugin's own cache)`);
    return opts.repo;
  }
  const base = process.env.ANIMATRON_COMPOSER_CACHE || join(homedir(), ".cache", "animatron-composer");
  const repo = join(base, "animatron");
  mkdirSync(base, { recursive: true });
  if (!existsSync(join(repo, ".git"))) {
    if (opts.offline) throw new Error(`no cached checkout at ${repo}; run once without --offline`);
    log(`cloning ${REPO_URL} into ${repo} ...`);
    execFileSync("git", ["clone", "--quiet", "--filter=blob:none", REPO_URL, repo], { stdio: "inherit" });
  } else if (!opts.offline) {
    git(repo, "fetch", "--quiet", "origin");
  }
  const ref = opts.pinned ? readLock()?.commit : opts.ref;
  if (!ref) throw new Error("no pinned commit in schema.lock.json");
  git(repo, "checkout", "--quiet", "--detach", ref);
  // Dependencies only when the lockfile changed since the last install.
  const lockSha = createHash("sha256").update(readFileSync(join(repo, "package-lock.json"))).digest("hex");
  const marker = join(repo, "node_modules", ".animatron-composer-deps");
  if (!existsSync(marker) || readFileSync(marker, "utf8") !== lockSha) {
    log("installing the studio's dependencies (npm ci) ...");
    execFileSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: repo, stdio: ["ignore", "inherit", "inherit"] });
    writeFileSync(marker, lockSha);
  }
  return repo;
}

export function repoInfo(repo) {
  const [commit, date, ...subject] = git(repo, "log", "-1", "--format=%H%n%cI%n%s").split("\n");
  return { commit, commitDate: date, subject: subject.join(" ") };
}

/** Stands in for the migrations folder's file list, so a new migration counts as drift too. */
export const MIGRATIONS_KEY = "supabase/migrations/ (file list)";

export function fingerprints(repo) {
  const out = Object.fromEntries(
    SCHEMA_FILES.map((f) => {
      const p = join(repo, f);
      return [f, existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16) : "missing"];
    }),
  );
  const dir = join(repo, "supabase/migrations");
  const names = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".sql")).sort() : [];
  out[MIGRATIONS_KEY] = createHash("sha256").update(names.join("\n")).digest("hex").slice(0, 16);
  return out;
}

/** Runs harness.ts inside `repo`, so its `@/` imports resolve to the studio's own source. */
export function runHarness(repo, args, { capture = false, script = "harness.ts", env = {} } = {}) {
  // Resolve tsx through npm, then use its Node loader directly. The tsx CLI
  // opens an IPC socket, which is unavailable in some managed executors.
  const locateLoader = `
    const fs = require('node:fs'), path = require('node:path');
    for (const dir of process.env.PATH.split(path.delimiter)) {
      try {
        const cli = fs.realpathSync(path.join(dir, 'tsx'));
        const loader = path.join(path.dirname(cli), 'loader.mjs');
        if (fs.existsSync(loader)) { process.stdout.write(loader); process.exit(0); }
      } catch {}
    }
    throw new Error('Cannot locate the installed tsx Node loader');
  `;
  const runtimeCache = process.env.ANIMATRON_COMPOSER_CACHE || join(homedir(), ".cache", "animatron-composer");
  mkdirSync(runtimeCache, { recursive: true });
  const loaderFile = join(runtimeCache, "tsx-loader-path.txt");
  let loader = existsSync(loaderFile) ? readFileSync(loaderFile, "utf8").trim() : "";
  if (!loader || !existsSync(loader)) {
  const loaderArgs = ["exec", "--yes", "--package", TSX, "--", "node", "-e", locateLoader];
  const cached = spawnSync("npm", ["--offline", ...loaderArgs], {
    cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  loader = cached.status === 0 ? cached.stdout.trim() : execFileSync("npm", loaderArgs, {
    cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  writeFileSync(loaderFile, loader);
  }
  // Capture to a private regular file: pipes truncate large RESULT lines when
  // a harness exits and spawnSync's default buffer is only 1 MiB. A rig may
  // legally be 4 MiB. Regular-file capture avoids both failure modes.
  const captureDir = capture ? mkdtempSync(join(tmpdir(), "animatron-result-")) : null;
  const captureFile = captureDir ? join(captureDir, "stdout") : null;
  const captureFd = captureFile ? openSync(captureFile, "wx", 0o600) : null;
  try {
    const r = spawnSync(process.execPath, ["--import", loader, join(HERE, script), ...args], {
      cwd: repo,
      encoding: "utf8",
      stdio: capture ? ["ignore", captureFd, "inherit"] : "inherit",
      env: { ...process.env, ...env, TSX_TSCONFIG_PATH: join(repo, "tsconfig.json") },
    });
    if (r.error) throw r.error;
    if (captureFile && statSync(captureFile).size > 32 * 1024 * 1024) throw new Error("harness output exceeds the 32 MiB result budget");
    return { status: r.status ?? 1, stdout: captureFile ? readFileSync(captureFile, "utf8") : "" };
  } finally {
    if (captureFd !== null) closeSync(captureFd);
    if (captureDir) rmSync(captureDir, { recursive: true, force: true });
  }
}

/** How the tested checkout compares with the commit the plugin was built against. */
export function driftReport(repo) {
  const lock = readLock();
  const now = repoInfo(repo);
  if (!lock) return { lines: ["no schema.lock.json; run refresh.mjs"], changed: [] };
  const fp = fingerprints(repo);
  const changed = [...SCHEMA_FILES, MIGRATIONS_KEY].filter((f) => lock.fingerprints?.[f] !== fp[f]);
  const lines = [`tested against ${now.commit.slice(0, 7)} (${now.commitDate.slice(0, 10)}, "${now.subject}")`];
  if (!changed.length && now.commit === lock.commit) lines.push("schema: same commit the plugin was built against");
  else if (!changed.length) lines.push(`schema: unchanged since the locked commit ${lock.commit.slice(0, 7)} (schema files identical)`);
  else {
    lines.push(`schema DRIFT: ${changed.length} schema file(s) changed since the locked commit ${lock.commit.slice(0, 7)}:`);
    for (const f of changed) lines.push(`  - ${f}`);
    const paths = changed.map((f) => (f === MIGRATIONS_KEY ? "supabase/migrations" : f));
    lines.push(`  read the change: git -C ${repo} diff ${lock.commit.slice(0, 12)} HEAD -- ${paths.join(" ")}`);
    lines.push("  then update the skill's references and run scripts/refresh.mjs");
  }
  return { lines, changed };
}
