#!/usr/bin/env node
// Ships a rig LIGHT: the same picture and motion in fewer characters, so
// pieces fit Animatron's #share= links (60,000 characters after the studio
// compresses the whole composition) and load fast.
//
//   node slim.mjs rig.mci.json [out.mci.json] [--keep walk,stroll] [--tol 0.05] [--master]
//
// What it does, in order (each step reported):
// 1. UNUSED PARTS: bones parked for the whole of every kept animation (swap
//    views that never show, e.g. six head angles in a profile walk) are
//    removed with everything under them: bones, bindings, artwork, tracks,
//    slots, swap-set entries, defaultPose entries. Only animations in
//    --keep are kept (default: all). --master skips this step, for rigs
//    that will be re-animated later.
// 2. KEYS: keys that the neighbouring keys already give by straight-line
//    interpolation (within --tol degrees / rig units) are dropped; tracks
//    that sit at rest the whole time are dropped (no track = rest); values
//    are rounded to 2 decimals.
// 3. ARTWORK: polygon outlines (M/L/Z paths) are rewritten with relative
//    moves and one decimal; no-op wrappers (translate(0 0)) are unwrapped.
// 4. NUMBERS: bind matrices to 5 decimals (scale/rotation) and 2 (offsets),
//    bone rests and lengths to 3.
// 5. METADATA: notes, construction and review fields are dropped; what the
//    studio and the scripts still read (treatment, view, swaps, defaultPose, gaits,
//    scene speeds, ropes, toes) stays.
// The visible error is below a hundredth of a pixel for the numbers and
// below --tol for the motion. Run it LAST, on the rig that goes into the
// composition; keep the full rig as the master for later edits.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const round = (v, d) => { const p = 10 ** d; const r = Math.round(v * p) / p; return Object.is(r, -0) ? 0 : r; };
const num = (v) => { const s = round(v, 1).toFixed(1); return s.endsWith(".0") ? s.slice(0, -2) : s; };
const size = (o) => { const s = JSON.stringify(o); return { chars: s.length, gzip: gzipSync(s).length }; };

/** Groups at the top level of the svg: [{ id, text }] in paint order. */
function topGroups(svg) {
  const out = [];
  const re = /<g id="([^"]+)">/g;
  let m;
  while ((m = re.exec(svg))) {
    let depth = 1, i = re.lastIndex;
    const open = /<g[\s>]/g, close = /<\/g>/g;
    while (depth > 0) {
      open.lastIndex = i; close.lastIndex = i;
      const o = open.exec(svg), c = close.exec(svg);
      if (o && o.index < c.index) { depth++; i = o.index + 2; } else { depth--; i = c.index + 4; }
    }
    out.push({ id: m[1], start: m.index, end: i, text: svg.slice(m.index, i) });
    re.lastIndex = i;
  }
  return out;
}

/** M/L/Z polygon path → relative commands on a 0.1 grid (absolute rounding first, so no drift). */
function compactPath(d) {
  if (/[^MLZmlz\d\s.,eE+-]/.test(d) || /[mlz]/.test(d)) return d;
  const toks = d.match(/[MLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  let out = "", cur = [0, 0], start = [0, 0], cmd = null, last = "";
  for (let i = 0; i < toks.length; ) {
    const t = toks[i];
    if (/^[MLZ]$/i.test(t)) { cmd = t.toUpperCase(); i++; if (cmd === "Z") { out += "z"; cur = start; last = "z"; } continue; }
    const p = [round(Number(toks[i]), 1), round(Number(toks[i + 1]), 1)];
    i += 2;
    const dx = round(p[0] - cur[0], 1), dy = round(p[1] - cur[1], 1);
    const c = cmd === "M" ? "m" : "l";
    const pair = `${num(dx)}${dy < 0 ? "" : " "}${num(dy)}`;
    out += (last === c ? (dx < 0 ? "" : " ") : c) + pair;
    last = c;
    if (cmd === "M") { start = p; cmd = "L"; }
    cur = p;
  }
  return out;
}

export function slim(rig, { keep = null, tol = 0.05, master = false } = {}) {
  const report = [];
  const before = size(rig);
  let r = JSON.parse(JSON.stringify(rig));
  if (keep) r.animations = r.animations.filter((a) => keep.includes(a.id));
  if (r.version >= 2) {
    report.push(`Rig ${r.version} preserve-only optimization: artwork, PNG payloads, registrations, keys, drawing states and metadata retained exactly; only explicit --keep filters animations`);
    return { rig: r, report, before, after: size(r) };
  }
  const park = r.metadata?.swaps?.park?.x ?? 9000;

  // 1. unused parts
  if (!master && r.animations.length) {
    const parked = new Set();
    for (const b of r.bones) {
      const tracks = r.animations.map((a) => a.tracks.find((t) => t.boneId === b.id));
      if (tracks.every((t) => t && t.keys.every((k) => Math.abs(k.x) >= park * 0.8))) parked.add(b.id);
    }
    const gone = new Set();
    const children = (id) => r.bones.filter((b) => b.parentId === id).map((b) => b.id);
    const drop = (id) => { gone.add(id); children(id).forEach(drop); };
    parked.forEach(drop);
    if (gone.size) {
      const groups = new Set(r.bindings.filter((b) => gone.has(b.boneId)).map((b) => b.svgId));
      r.bones = r.bones.filter((b) => !gone.has(b.id));
      r.bindings = r.bindings.filter((b) => !gone.has(b.boneId));
      r.svg = topGroups(r.svg).filter((g) => groups.has(g.id)).reverse().reduce((s, g) => s.slice(0, g.start) + s.slice(g.end), r.svg);
      r.slots = (r.slots ?? []).filter((s) => !gone.has(s.boneId));
      for (const a of r.animations) a.tracks = a.tracks.filter((t) => !gone.has(t.boneId));
      const sw = r.metadata?.swaps;
      if (sw?.sets) for (const set of Object.values(sw.sets)) for (const [k, ids] of Object.entries(set)) { const left = ids.filter((i) => !gone.has(i)); if (left.length) set[k] = left; else delete set[k]; }
      if (r.metadata?.defaultPose) for (const id of Object.keys(r.metadata.defaultPose)) if (gone.has(id)) delete r.metadata.defaultPose[id];
      report.push(`removed ${gone.size} bones that never show in ${r.animations.map((a) => a.id).join(", ")} (and their artwork)`);
      r.metadata = { ...(r.metadata ?? {}), slimRemoved: [...gone] };
    }
  }

  // 2. keys
  let kb = 0, ka = 0, tracksDropped = 0;
  for (const a of r.animations) {
    a.tracks = a.tracks.filter((t) => {
      const atRest = t.keys.every((k) => Math.abs(k.x) < tol && Math.abs(k.y) < tol && Math.abs(k.rotation) < tol);
      if (atRest) tracksDropped++;
      return !atRest;
    });
    for (const t of a.tracks) {
      const k = t.keys; kb += k.length;
      if (k.length > 2 && k.slice(0, -1).every((x) => (x.easing ?? "linear") === "linear")) {
        const keepK = [k[0]];
        let i = 0;
        while (i < k.length - 1) {
          let j = i + 1;
          while (j + 1 < k.length) {
            const a0 = k[i], b0 = k[j + 1];
            let ok = true;
            for (let m = i + 1; m <= j && ok; m++) {
              const u = (k[m].time - a0.time) / (b0.time - a0.time);
              for (const f of ["x", "y", "rotation"]) if (Math.abs(a0[f] + (b0[f] - a0[f]) * u - k[m][f]) > tol) { ok = false; break; }
            }
            if (!ok) break;
            j++;
          }
          keepK.push(k[j]); i = j;
        }
        t.keys = keepK;
      }
      t.keys = t.keys.map((x) => ({ ...x, x: round(x.x, 2), y: round(x.y, 2), rotation: round(x.rotation, 2) }));
      ka += t.keys.length;
    }
  }
  report.push(`keys ${kb} → ${ka} (within ${tol}), ${tracksDropped} tracks at rest dropped`);

  // 3. artwork
  const svgBefore = r.svg.length;
  r.svg = r.svg.replace(/<g transform="translate\(0 0\)">([\s\S]*?)<\/g>/g, (all, inner) => (/<g[\s>]/.test(inner) ? all : inner));
  r.svg = r.svg.replace(/ d="([^"]+)"/g, (_, d) => ` d="${compactPath(d)}"`);
  report.push(`artwork ${svgBefore} → ${r.svg.length} characters`);

  // 4. numbers
  r.bindings = r.bindings.map((b) => ({ ...b, bindMatrix: b.bindMatrix.map((v, i) => round(v, i < 4 ? 5 : 2)) }));
  r.bones = r.bones.map((b) => ({ ...b, rest: { x: round(b.rest.x, 3), y: round(b.rest.y, 3), rotation: round(b.rest.rotation, 3) }, length: round(b.length, 3) }));

  // 5. metadata
  const KEEP = ["style", "treatment", "view", "swaps", "defaultPose", "gaits", "scene", "ropes", "toes", "slimRemoved"];
  const md = {};
  for (const k of KEEP) if (r.metadata?.[k] !== undefined) md[k] = r.metadata[k];
  if (md.scene) { md.scene = { ...md.scene }; delete md.scene.note; md.scene.members = md.scene.members?.map(({ name, ...m }) => m); }
  if (md.ropes) md.ropes = Object.fromEntries(Object.entries(md.ropes).map(([k, v]) => { const { note, ...rest } = v; return [k, rest]; }));
  if (md.gaits) md.gaits = Object.fromEntries(Object.entries(md.gaits).map(([k, v]) => { const { note, ...rest } = v; return [k, rest]; }));
  md.slim = { tol };
  r.metadata = md;

  const after = size(r);
  return { rig: r, report, before, after };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const argv = process.argv.slice(2);
  const take = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv.splice(i, 2)[1] : null; };
  const master = argv.includes("--master"); if (master) argv.splice(argv.indexOf("--master"), 1);
  const keep = take("--keep");
  const tol = Number(take("--tol") ?? 0.05);
  const [inPath, outPath = inPath.replace(/\.mci\.json$/, ".slim.mci.json")] = argv;
  if (!inPath) { console.error("usage: node slim.mjs rig.mci.json [out.mci.json] [--keep walk,stroll] [--tol 0.05] [--master]"); process.exit(2); }
  try {
    const { rig, report, before, after } = slim(JSON.parse(readFileSync(inPath, "utf8")), { keep: keep ? keep.split(",") : null, tol, master });
    writeFileSync(outPath, JSON.stringify(rig));
    for (const line of report) console.log(`  ${line}`);
    console.log(`slim: ${before.chars} → ${after.chars} characters (compressed ~${before.gzip} → ~${after.gzip}) → ${outPath}`);
  } catch (e) { console.error(`slim: ${e.message}`); process.exit(1); }
}
