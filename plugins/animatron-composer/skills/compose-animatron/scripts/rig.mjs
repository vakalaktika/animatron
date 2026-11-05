#!/usr/bin/env node
// Mid-century Ink rigs (`.mci.json`) in compositions, through the studio's
// own rig engine.
//
//   node rig.mjs inspect character.mci.json
//   node rig.mjs place spec.json [--into composition.json [--index <n>]] [--out clip.json]
//
// inspect: runs the studio's rig import (contract, budgets, SVG subset) and
//   lists bones with roles and limits, animation clips, slots, and which
//   preset actions (wave, nod) the skeleton's roles allow.
// place: builds a rig layer from a spec (placement, presets, motions of
//   your own, still pose; see references/rigs.md) with the studio's
//   makeRig/preset/upsertKey, then prints it, writes it with --out, or puts
//   it into a composition with --into (replacing a layer with the same id,
//   else appending, or at --index). Run validate.mjs on the composition after.
//
// Common flags: --repo <checkout>, --ref <ref> | --pinned, --offline.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureRepo, parseArgs, runHarness } from "./lib.mjs";

const fail = (msg, code = 1) => {
  console.error(`rig: ${msg}`);
  process.exit(code);
};

function takeFlag(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const [, value] = argv.splice(i, 2);
  return value;
}

function harness(argv, args) {
  const opts = parseArgs(argv);
  const repo = ensureRepo(opts);
  const { status, stdout } = runHarness(repo, args, { script: "righarness.ts", capture: true });
  const line = stdout.trim().split("\n").reverse().find((l) => l.startsWith("RESULT "));
  if (!line) fail("the rig step printed no result");
  const result = JSON.parse(line.slice(7));
  if (!result.ok) fail(result.error);
  if (status !== 0) fail(`the rig step exited with status ${status}; no asset written`);
  return result;
}

function inspect(argv) {
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) fail("usage: rig.mjs inspect <rig.mci.json>", 2);
  const r = harness(argv.filter((a) => a !== file), ["inspect", resolve(file)]);
  console.log(`${r.name ?? "(unnamed rig)"}: canvas ${r.canvas.width} × ${r.canvas.height}, ${(r.bytes / 1024).toFixed(1)} KB (studio limit ${r.budget.jsonBytes / 1e6} MB) — passes the studio's rig import`);
  console.log("\nbones (id · role · limits on the rotation delta):");
  for (const b of r.bones) {
    const lim = b.limits ? `${b.limits.min}°..${b.limits.max}°` : "unlimited";
    console.log(`  ${"  ".repeat(b.depth)}${b.id}${b.role ? ` · ${b.role}` : ""} · ${lim}`);
  }
  console.log("\nanimation clips:");
  if (!r.animations.length) console.log("  (none)");
  for (const a of r.animations) console.log(`  ${a.id}${a.name ? ` "${a.name}"` : ""}: ${a.duration} s, ${a.loop ? "loops" : "plays once"}, moves ${a.bones.join(", ")}`);
  console.log(`\npresets the roles allow: wave ${r.presets.wave ? "yes" : "no"}, nod ${r.presets.nod ? "yes" : "no"}`);
  if (r.slots.length) console.log(`slots: ${r.slots.map((s) => `${s.id} (on ${s.boneId})`).join(", ")}`);
  if (r.metadata) console.log(`metadata: ${JSON.stringify(r.metadata)}`);
}

function place(argv) {
  const into = takeFlag(argv, "--into");
  const index = takeFlag(argv, "--index");
  const out = takeFlag(argv, "--out");
  const spec = argv.find((a) => !a.startsWith("--"));
  if (!spec) fail("usage: rig.mjs place <spec.json> [--into composition.json [--index n]] [--out clip.json]", 2);
  const r = harness(argv.filter((a) => a !== spec), ["place", resolve(spec)]);
  const { clip } = r;
  const anim = clip.animationId ? clip.rig.animations.find((a) => a.id === clip.animationId) : null;
  console.log(`rig layer "${clip.name}" (${clip.id}) at ${clip.x}, ${clip.y}, scale ${clip.scale} (canvas ${Math.round(r.canvasBox.width)} × ${Math.round(r.canvasBox.height)} px), from ${clip.start} s`);
  console.log(anim ? `  plays "${anim.id}" (${anim.duration} s, ${anim.loop ? "loops" : "once"})` : `  still pose${Object.keys(clip.pose).length ? `: ${Object.keys(clip.pose).join(", ")}` : " (rest)"}`);
  console.log(`  clips on the rig: ${clip.rig.animations.map((a) => a.id).join(", ") || "none"}`);
  for (const n of r.notes) console.log(`  ! ${n}`);
  if (out) {
    writeFileSync(out, JSON.stringify(clip, null, 2) + "\n");
    console.log(`  wrote ${out}`);
  }
  if (into) {
    const doc = JSON.parse(readFileSync(into, "utf8"));
    if (!Array.isArray(doc.clips)) fail(`${into} is not a composition`);
    const at = doc.clips.findIndex((c) => c.id === clip.id);
    if (at >= 0) doc.clips[at] = clip;
    else if (index !== null) doc.clips.splice(Number(index), 0, clip);
    else doc.clips.push(clip);
    writeFileSync(into, JSON.stringify(doc, null, 2) + "\n");
    console.log(`  ${at >= 0 ? "replaced" : "added"} in ${into}; run validate.mjs on it next`);
  }
  if (!out && !into) console.log(JSON.stringify(clip, null, 2));
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "inspect") inspect(rest);
  else if (cmd === "place") place(rest);
  else {
    console.log("usage: node rig.mjs inspect <rig.mci.json> | place <spec.json> [--into composition.json [--index n]] [--out clip.json]");
    process.exit(cmd ? 2 : 0);
  }
} catch (e) {
  fail(e.message, 2);
}
