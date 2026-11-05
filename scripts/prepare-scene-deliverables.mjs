import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "../examples/illustrated-scenes");
const entries = [ ["garden-glider", "garden-glider"], ["goodnight-room", "goodnight-room"], ["garden-glider", "garden-glider-layered"] ];
const report = [];
const links = [];
for (const [folder, name] of entries) {
  const file = join(root, folder, name + ".animatron.json");
  const master = readFileSync(file);
  const doc = JSON.parse(master);
  const playback = JSON.stringify(doc);
  writeFileSync(join(root, folder, name + ".playback.animatron.json"), playback);
  report.push({ name, masterBytes: master.length, playbackBytes: Buffer.byteLength(playback), semanticEquality: JSON.stringify(JSON.parse(playback)) === JSON.stringify(doc), masterSha256: createHash("sha256").update(master).digest("hex") });
  if (name.endsWith("layered")) continue;
  const shared = readFileSync(join(root, folder, name + ".animatron.share-link.txt"), "utf8").trim();
  const hash = new URL(shared).hash;
  links.push(`<li><a href="http://localhost:3000/${hash}">${name}: open in the upgraded local application</a></li>`);
}
writeFileSync(join(root, "file-validation.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(join(root, "open-scenes.html"), `<!doctype html><meta charset="utf-8"><title>Illustrated Animatron scenes</title><style>body{font:18px system-ui;max-width:48rem;margin:4rem auto;line-height:1.6}a{color:#186a63}</style><h1>Illustrated scenes</h1><p>Run the application revision in this PR with <code>npm ci &amp;&amp; npm run dev</code> on port 3000, then open a scene below. The production application has not been deployed with Rig 2 support.</p><ul>${links.join("")}</ul><p>The layered edition exceeds the supported URL budget; import its JSON file from Compositions → Import JSON.</p>`);
console.log(JSON.stringify(report));
