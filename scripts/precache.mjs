// After `next build`: give the exported service worker the full list of
// build files to cache on install, and a cache name that changes with every
// build (so a release replaces the old cache instead of mixing with it).
// Lazily loaded chunks (the export pipeline, Lottie, the cloud client) are
// not named in the HTML, so a list taken from the pages alone is not enough
// to work offline.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Every file under `dir`, as paths relative to it with forward slashes, sorted. */
export async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)).map((f) => `${entry.name}/${f}`));
    else out.push(entry.name);
  }
  return out.sort();
}

/** The worker source with its placeholders filled: the cache version and the files to precache. */
export function fillWorker(source, { version, files }) {
  const withVersion = source.replace(/const VERSION = "[^"]*";/, `const VERSION = ${JSON.stringify(version)};`);
  const filled = withVersion.replace(/const PRECACHE = \[\];/, `const PRECACHE = ${JSON.stringify(files)};`);
  if (filled === withVersion || withVersion === source) throw new Error("sw.js is missing its VERSION or PRECACHE placeholder");
  return filled;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const out = path.join(root, "out");
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const files = (await listFiles(path.join(out, "_next", "static"))).map((f) => `${base}/_next/static/${f}`);
  const version = `animatron-${createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12)}`;
  const worker = path.join(out, "sw.js");
  await writeFile(worker, fillWorker(await readFile(worker, "utf8"), { version, files }));
  console.log(`sw.js: ${files.length} build files to precache (${version})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
