#!/usr/bin/env node
// Scene rigs: compatible Rig 1, 2 or 3 assets combined into ONE rig, so characters that
// touch or are tied together (a leash, a hand-hold, a rider on a horse, a
// cup in a hand that belongs to another rig) move as one layer and share one
// clock in Animatron, and a rope or prop can be solved between their bones.
//
//   node scene.mjs spec.json out.mci.json
//
// spec: {
//   "name": "Dot walks Pip",
//   "members": [
//     { "rig": "dot.mci.json", "prefix": "dot", "offset": [0, 0], "play": "walk" },
//     { "rig": "pip.mci.json", "prefix": "pip", "offset": [226, 331], "play": "trot" }
//   ],
//   "animation": { "id": "scene", "name": "Scene" },     optional
//   "padding": 0                                           optional, canvas units
// }
//
// - offset: where the member's canvas origin sits in the scene canvas
//   (canvas units of the member). The scene canvas is the bounding box of
//   all members (shifted so nothing is negative) plus padding.
// - Every id is prefixed "<prefix>-" (bones, bindings, SVG targets, slots,
//   swap bones); roles become "<prefix>.<role>" because roles must be unique.
// - A scene root bone sits at the ground centre; each member's root hangs
//   from it with its rest moved by the offset, so all member animation
//   deltas stay valid unchanged.
// - Artwork: each member's top-level groups keep their ids (prefixed) and
//   get an inner <g transform="translate(ox oy)">, and each bindMatrix is
//   rebased (old · translate(-offset)), so the rig stays identity at rest.
// - Animations: each member's `play` clip is repeated until all members
//   share one length (the longest, which must be a whole multiple of the
//   others: tune frames per cycle until they match), then merged.
// - metadata: swaps and defaultPose merged with prefixes; members, offsets,
//   cycles and travel speeds under metadata.scene.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const r6 = (v) => Number(v.toFixed(6));
const r4 = (v) => Number(v.toFixed(4));
const RAD = Math.PI / 180;
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];

/** Splits an SVG's root children into top-level elements (strings). */
export function topLevel(svg) {
  const open = svg.indexOf(">", svg.indexOf("<svg")) + 1;
  const close = svg.lastIndexOf("</svg>");
  const body = svg.slice(open, close);
  const out = [];
  const re = /<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g;
  let depth = 0, start = -1, m;
  while ((m = re.exec(body))) {
    const [, closing, , , self] = m;
    if (!closing && depth === 0) start = m.index;
    if (closing) depth--;
    else if (!self) depth++;
    if (depth === 0 && start >= 0) {
      out.push(body.slice(start, m.index + m[0].length));
      start = -1;
    }
  }
  return out;
}

const prefixId = (p, id) => `${p}-${id}`;

export function scene(spec, { baseDir = "." } = {}) {
  const members = spec.members.map((m) => ({ ...m, rig: typeof m.rig === "string" ? JSON.parse(readFileSync(resolve(baseDir, m.rig), "utf8")) : m.rig }));
  if (members.length < 2) throw new Error("a scene needs at least two members");
  const prefixes = new Set();
  for (const m of members) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,15}$/.test(m.prefix ?? "")) throw new Error(`member prefix "${m.prefix}" must be a short letters-and-digits name`);
    if (prefixes.has(m.prefix)) throw new Error(`duplicate prefix ${m.prefix}`);
    prefixes.add(m.prefix);
  }

  // ---- one treatment for the whole cast (style-presets.md): never mix Original and Detailed
  const treatments = new Set(members.map((m) => m.rig.metadata?.treatment).filter(Boolean));
  if (treatments.size > 1) throw new Error(`members are drawn in different treatments (${[...treatments].join(", ")}); one scene uses one treatment for the whole cast — redraw the odd one out`);
  const treatment = [...treatments][0] ?? null;

  // ---- canvas: bounding box of members, shifted to non-negative, plus padding
  const pad = spec.padding ?? 0;
  const minX = Math.min(...members.map((m) => m.offset[0])), minY = Math.min(...members.map((m) => m.offset[1]));
  for (const m of members) m.o = [m.offset[0] - minX + pad, m.offset[1] - minY + pad];
  const width = Math.ceil(Math.max(...members.map((m) => m.o[0] + m.rig.canvas.width)) + pad);
  const height = Math.ceil(Math.max(...members.map((m) => m.o[1] + m.rig.canvas.height)) + pad);

  // ---- scene root at the ground centre (ground = lowest member root's ground if known, else canvas bottom)
  const ground = spec.groundY ?? height;
  const sceneRoot = { id: "scene", parentId: null, role: "root", rest: { x: r6(width / 2), y: r6(ground), rotation: 0 }, length: 0.5, limits: { min: -180, max: 180 } };
  const bones = [sceneRoot];
  const bindings = [];
  const rasterAttachments = [];
  const drawingSets = [];
  const slots = [];
  const groups = [];
  const swaps = { park: null, sets: {}, default: {} };
  const defaultPose = {};
  const sceneMeta = [];

  for (const m of members) {
    const { rig, prefix: p, o } = m;
    const P = (id) => prefixId(p, id);
    const roots = rig.bones.filter((b) => b.parentId === null);
    if (roots.length !== 1) throw new Error(`${p}: expected one root bone`);
    for (const b of rig.bones) {
      const nb = { ...b, id: P(b.id), parentId: b.parentId === null ? "scene" : P(b.parentId) };
      if (b.role) nb.role = `${p}.${b.role}`;
      if (b.name) nb.name = `${p} ${b.name}`;
      if (b.parentId === null) {
        // Rest relative to the scene root (rotation 0 at the scene root, so a plain translation).
        nb.rest = { ...b.rest, x: r6(b.rest.x + o[0] - sceneRoot.rest.x), y: r6(b.rest.y + o[1] - sceneRoot.rest.y) };
      }
      bones.push(nb);
    }
    const back = [1, 0, 0, 1, -o[0], -o[1]];
    for (const bd of rig.bindings) bindings.push({ ...bd, id: P(bd.id), svgId: P(bd.svgId), boneId: P(bd.boneId), bindMatrix: mul(bd.bindMatrix, back).map(r6) });
    for (const s of rig.slots ?? []) slots.push({ ...s, id: P(s.id), boneId: P(s.boneId) });

    // Artwork: prefix bound group ids, translate their content.
    const bound = new Set(rig.bindings.map((bd) => bd.svgId));
    const tr = `translate(${r6(o[0])} ${r6(o[1])})`;
    for (const el of topLevel(rig.svg)) {
      if (/^<title[\s>]/.test(el)) continue;
      const head = el.match(/^<g\b([^>]*?)\bid="([^"]+)"([^>]*)>/);
      if (head && bound.has(head[2])) {
        const attrs = head[1] + head[3];
        const originalTransform = attrs.match(/\btransform="([^"]*)"/)?.[1] ?? "";
        const cleanAttrs = attrs.replace(/\btransform="[^"]*"/, "");
        const inner = el.endsWith("/>") ? "" : el.slice(head[0].length, el.length - "</g>".length);
        // Conjugate an authored group transform into scene coordinates.
        // Both vector paths and injected raster rectangles receive the same offset.
        const transformed = `translate(${r6(o[0])} ${r6(o[1])}) ${originalTransform} translate(${-r6(o[0])} ${-r6(o[1])})`;
        groups.push(`<g id="${P(head[2])}" ${cleanAttrs} transform="${transformed}"><g transform="${tr}">${inner.replace(/\bid="([^"]+)"/g, (_, id) => `id="${P(id)}"`)}</g></g>`);
      } else {
        groups.push(`<g transform="${tr}">${el.replace(/\bid="([^"]+)"/g, (_, id) => `id="${P(id)}"`)}</g>`);
      }
    }
    for (const attachment of rig.rasterAttachments ?? []) {
      rasterAttachments.push({ ...attachment, id: P(attachment.id), svgId: P(attachment.svgId), x: attachment.x + o[0], y: attachment.y + o[1] });
    }
    for (const set of rig.drawingSets ?? []) {
      drawingSets.push({ ...set, id: P(set.id), defaultDrawingId: P(set.defaultDrawingId), drawings: set.drawings.map((drawing) => ({ ...drawing, id: P(drawing.id), svgIds: drawing.svgIds.map(P) })) });
    }

    // Swaps and the default pose.
    const sw = rig.metadata?.swaps;
    if (sw) {
      swaps.park = swaps.park ?? sw.park;
      for (const [set, states] of Object.entries(sw.sets)) swaps.sets[`${p}.${set}`] = Object.fromEntries(Object.entries(states).map(([k, ids]) => [k, ids.map(P)]));
      for (const [set, st] of Object.entries(sw.default ?? {})) swaps.default[`${p}.${set}`] = st;
    }
    for (const [id, d] of Object.entries(rig.metadata?.defaultPose ?? {})) defaultPose[P(id)] = d;
  }

  // ---- animations: repeat each member's clip to a common length
  const clips = members.map((m) => {
    if (!m.play) return null;
    const a = m.rig.animations.find((x) => x.id === m.play);
    if (!a) throw new Error(`${m.prefix}: no animation "${m.play}" (have ${m.rig.animations.map((x) => x.id).join(", ") || "none"})`);
    return { m, a };
  }).filter(Boolean);
  let animation = null;
  if (clips.length) {
    const T = Math.max(...clips.map((c) => c.a.duration));
    const tracks = [];
    const drawingTracks = [];
    for (const { m, a } of clips) {
      const n = Math.round(T / a.duration);
      if (Math.abs(n * a.duration - T) > 1 / 240) throw new Error(`${m.prefix}: "${a.id}" lasts ${a.duration}s, which does not divide the scene length ${T}s; change its frames per cycle so ${T}s holds a whole number of cycles`);
      if (n > 1 && !a.loop) throw new Error(`${m.prefix}: "${a.id}" is shorter than the scene but does not loop`);
      m.cycles = n;
      for (const track of a.drawingTracks ?? []) {
        const set = m.rig.drawingSets.find((entry) => entry.id === track.setId);
        const byTime = new Map();
        for (let cycle = 0; cycle < n; cycle++) {
          const start = r4(cycle * a.duration);
          // Restore the set default before a delayed first key on each repeat.
          byTime.set(start, { time: start, drawingId: prefixId(m.prefix, set.defaultDrawingId) });
          for (const key of track.keys) {
            const time = r4(key.time + cycle * a.duration);
            byTime.set(time, { time, drawingId: prefixId(m.prefix, key.drawingId) });
          }
        }
        drawingTracks.push({ setId: prefixId(m.prefix, track.setId), keys: [...byTime.values()].sort((x, y) => x.time - y.time) });
      }
      for (const tr of a.tracks) {
        const keys = [];
        for (let k = 0; k < n; k++) {
          for (const key of tr.keys) {
            const t = r4(key.time + k * a.duration);
            if (t > T + 1e-9) continue;
            if (keys.length && t <= keys[keys.length - 1].time) continue; // loop seam: same drawing
            keys.push({ ...key, time: t });
          }
        }
        // A track that ends early holds its last value to the end of the scene.
        if (keys[keys.length - 1].time < r4(T)) keys.push({ ...keys[keys.length - 1], time: r4(T), easing: "linear" });
        tracks.push({ ...tr, boneId: prefixId(m.prefix, tr.boneId), keys });
      }
    }
    animation = { id: spec.animation?.id ?? "scene", name: spec.animation?.name ?? "Scene", duration: r4(T), loop: spec.animation?.loop ?? clips.every(({ a }) => a.loop), tracks, ...(drawingTracks.length ? { drawingTracks } : {}) };
  }

  for (const m of members) {
    const gaits = m.rig.metadata?.gaits ?? {};
    const g = m.play ? gaits[m.play] : null;
    sceneMeta.push({ prefix: m.prefix, name: m.rig.name, offset: m.o, play: m.play ?? null, cycles: m.cycles ?? null, travelPerSecond: g?.travelPerSecond ?? null });
  }
  const speeds = sceneMeta.map((s) => s.travelPerSecond).filter((v) => v !== null);
  const spread = speeds.length ? Math.max(...speeds) - Math.min(...speeds) : 0;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><title>${spec.name ?? "Scene"}</title>${groups.join("")}</svg>`;
  const rig = {
    format: "mid-century-ink-rig",
    version: Math.max(...members.map(member=>member.rig.version)),
    name: spec.name ?? "Scene",
    canvas: { width, height },
    svg,
    bones,
    bindings,
    ...(rasterAttachments.length ? { rasterAttachments } : {}),
    ...(drawingSets.length ? { drawingSets } : {}),
    slots,
    animations: animation ? [animation] : [],
    metadata: {
      style: "mid-century-ink",
      ...(treatment ? { treatment } : {}),
      reviewStatus: "draft",
      scene: {
        members: sceneMeta,
        ...(speeds.length ? { travelPerSecond: Number((speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(3)), speedSpread: Number(spread.toFixed(3)) } : {}),
        note: "One layer for the whole scene. Move it at travelPerSecond x layer scale stage px/s; members whose speeds differ will slide.",
      },
      ...(swaps.park ? { swaps, defaultPose } : {}),
      motionProfiles: Object.fromEntries(members.filter((m) => m.rig.metadata?.motionProfile).map((m) => [m.prefix, m.rig.metadata.motionProfile])),
    },
  };
  if (bones.length > 128) throw new Error(`the scene has ${bones.length} bones; Rig 1 allows 128`);
  if (bindings.length > 256) throw new Error(`the scene has ${bindings.length} bindings; Rig 1 allows 256`);
  return { rig, report: { width, height, bones: bones.length, bindings: bindings.length, members: sceneMeta, speedSpread: spread } };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath || !outPath) {
    console.error("usage: node scene.mjs spec.json out.mci.json");
    process.exit(2);
  }
  try {
    const { rig, report } = scene(JSON.parse(readFileSync(specPath, "utf8")), { baseDir: dirname(resolve(specPath)) });
    writeFileSync(outPath, JSON.stringify(rig, null, 2));
    console.log(`scene ${report.width}x${report.height}, ${report.bones} bones, ${report.bindings} bindings; ${report.members.map((m) => `${m.prefix} ${m.play ?? "-"} x${m.cycles ?? "-"}`).join(", ")}; speed spread ${report.speedSpread.toFixed(3)} → ${outPath}`);
  } catch (e) {
    console.error(`scene: ${e.message}`);
    process.exit(1);
  }
}
