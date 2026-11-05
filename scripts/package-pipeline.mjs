// Packages committed plugin update overlays; unchanged private reference
// assets are retained by Plugin Creator, never copied into the public PR.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const repo = resolve(import.meta.dirname, "..");
const out = join(repo, "dist");
mkdirSync(out, { recursive: true });
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
const report = { commit, packages: [] };
for (const name of ["mid-century-ink", "animatron-composer"]) {
  const prefix = `plugins/${name}/`;
  const files = execFileSync("git", ["ls-files", "-z", prefix], { cwd: repo, encoding: "utf8" }).split("\0").filter(Boolean);
  if (!files.includes(prefix + "plugin.json")) throw new Error(`No tracked update manifest for ${name}`);
  for (const file of files) {
    const committed = execFileSync("git", ["show", `HEAD:${file}`], { cwd: repo });
    if (!committed.equals(readFileSync(join(repo, file)))) throw new Error(`Uncommitted package input: ${file}`);
  }
  const version = JSON.parse(readFileSync(join(repo, prefix, "plugin.json"))).version;
  const archive = join(out, `${name}-${version}.zip`);
  // Python's standard ZIP library preserves exact bytes and root-relative paths.
  execFileSync("python3", ["-c", "import json,sys,zipfile,pathlib; root=pathlib.Path(sys.argv[1]); archive=sys.argv[2]; files=json.loads(sys.argv[3]); prefix=sys.argv[4]; z=zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED); [(z.write(root/f,f[len(prefix):])) for f in files]; z.close()", repo, archive, JSON.stringify(files), prefix]);
  report.packages.push({ name, version, file: archive, sha256: createHash("sha256").update(readFileSync(archive)).digest("hex"), files: files.length });
}
writeFileSync(join(out, "release-provenance.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
