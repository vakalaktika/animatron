#!/usr/bin/env node
// Bakes animator-style key poses into a Rig 1 clip.
//
//   node motion.mjs rig.mci.json motion.json [out.mci.json]
//
// Rig 1 only interpolates linearly between keys, which reads as mechanical.
// This tool keeps the animator's controls and writes the result as dense
// linear keys, sampled on twos (12 drawings a second at 24 fps) by default:
//
// - Key poses at FRAMES, each with the spacing INTO it:
//     "slowIn"  decelerate into the pose (favour the pose: most drawings near it)
//     "slowOut" accelerate away from the previous pose
//     "slowInOut" both, the default for a move between two held poses
//     "linear"  even spacing (mechanical; only for constant motion)
//     "snap"    almost all of the move at once, then settle (a hit)
//     "overshoot" past the pose and back (a lively arrival)
// - "hold" frames after a pose, as a MOVING hold: a slight drift so the
//   drawing never freezes dead ("drift" degrees, default 1).
// - "overlap": bones that drag behind their parent by N frames
//   (forearm 2, hand 4 for an arm; a ponytail or a tail more).
// - "settle": bones that overshoot their arrival by a fraction of the move
//   and settle back (follow-through).
// Bones are named by role or id; values are rotation deltas in degrees from
// rest ({x,y,rotation} for joints that also slide). Every bone named in any
// pose is keyed in every pose; unnamed there means rest. Values are clamped
// to the rig's joint limits, and each clamp is reported.
import { readFileSync, writeFileSync } from "node:fs";

const EASE = {
  linear: (u) => u,
  slowIn: (u) => 1 - (1 - u) ** 3,
  slowOut: (u) => u ** 3,
  slowInOut: (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
  snap: (u) => 1 - (1 - u) ** 6,
  overshoot: (u) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
  },
};

export function bake(rig, spec) {
  const notes = [];
  const fps = spec.fps ?? 24;
  const step = spec.on ?? 2;
  const byRef = (ref) => {
    const b = rig.bones.find((x) => x.id === ref) ?? rig.bones.find((x) => x.role === ref);
    if (!b) throw new Error(`no bone with id or role "${ref}"`);
    return b;
  };
  const poses = spec.poses.slice().sort((a, b) => a.frame - b.frame);
  if (poses[0].frame !== 0) throw new Error("the first pose must be at frame 0");
  const end = Math.max(...poses.map((p) => p.frame + (p.hold ?? 0)), spec.frames ?? 0);
  const boneIds = [...new Set(poses.flatMap((p) => Object.keys(p.pose).map((r) => byRef(r).id)))];
  const delta = (v) => (typeof v === "number" ? { x: 0, y: 0, rotation: v } : { x: v.x ?? 0, y: v.y ?? 0, rotation: v.rotation ?? 0 });
  const overlap = Object.fromEntries(Object.entries(spec.overlap ?? {}).map(([r, n]) => [byRef(r).id, n]));
  const settle = Object.fromEntries(Object.entries(spec.settle ?? {}).map(([r, n]) => [byRef(r).id, n]));
  const drift = spec.drift ?? 1;

  // Per bone: the value at frame f, from the poses (before overlap).
  const valueAt = (id, f) => {
    const at = (p) => {
      const ref = Object.keys(p.pose).find((r) => byRef(r).id === id);
      return ref ? delta(p.pose[ref]) : { x: 0, y: 0, rotation: 0 };
    };
    let i = 0;
    while (i + 1 < poses.length && poses[i + 1].frame <= f) i++;
    const a = poses[i], va = at(a);
    const holdEnd = a.frame + (a.hold ?? 0);
    const b = poses[i + 1];
    if (!b) {
      // Final moving hold.
      const u = Math.min(1, (f - a.frame) / Math.max(1, a.hold ?? 1));
      return { ...va, rotation: va.rotation + drift * Math.sin(u * Math.PI) * 0.5 };
    }
    if (f <= holdEnd) {
      const u = (f - a.frame) / Math.max(1, a.hold ?? 1);
      return { ...va, rotation: va.rotation + drift * Math.sin(u * Math.PI) * 0.5 };
    }
    const vb = at(b);
    const u = (f - holdEnd) / Math.max(1, b.frame - holdEnd);
    let ease = EASE[b.ease ?? "slowInOut"];
    if (!ease) throw new Error(`unknown ease "${b.ease}"; use ${Object.keys(EASE).join(", ")}`);
    if (settle[id] && Math.abs(vb.rotation - va.rotation) > 2) {
      // Follow-through: arrive past the pose by a share of the move, then settle.
      const k = settle[id];
      const base = ease;
      ease = (t) => base(t) + k * Math.sin(Math.PI * t) * t * t;
    }
    const e = ease(Math.min(1, Math.max(0, u)));
    return { x: va.x + (vb.x - va.x) * e, y: va.y + (vb.y - va.y) * e, rotation: va.rotation + (vb.rotation - va.rotation) * e };
  };

  const tracks = [];
  for (const id of boneIds) {
    const bone = rig.bones.find((b) => b.id === id);
    const lag = overlap[id] ?? 0;
    const keys = [];
    let clamped = 0;
    for (let f = 0; f <= end; f += step) {
      const v = valueAt(id, Math.max(0, f - lag));
      let rot = v.rotation;
      if (bone.limits) {
        const c = Math.min(bone.limits.max, Math.max(bone.limits.min, rot));
        if (Math.abs(c - rot) > 1e-6) clamped++;
        rot = c;
      }
      keys.push({ time: Number((f / fps).toFixed(4)), x: Number(v.x.toFixed(3)), y: Number(v.y.toFixed(3)), rotation: Number(rot.toFixed(3)), easing: "linear" });
    }
    if (keys[keys.length - 1].time < Number((end / fps).toFixed(4))) {
      const v = valueAt(id, Math.max(0, end - lag));
      keys.push({ time: Number((end / fps).toFixed(4)), x: v.x, y: v.y, rotation: Math.min(bone.limits?.max ?? 1e9, Math.max(bone.limits?.min ?? -1e9, v.rotation)), easing: "linear" });
    }
    if (clamped) notes.push(`${bone.role ?? id}: ${clamped} drawing(s) clamped to its ${bone.limits.min}°..${bone.limits.max}° limits in this view`);
    tracks.push({ boneId: id, keys });
  }
  // Swap sets (performance rigs: head views, eyes open/closed). A pose's
  // "swap": { "head": "90", "eyes": "closed" } cuts to those drawings at the
  // pose's frame; states persist until changed. Written as "hold" keys that
  // park the drawings not in use off the canvas (see performance.mjs).
  const swaps = rig.metadata?.swaps;
  if (poses.some((p) => p.swap) && !swaps) throw new Error("this rig has no swap sets (metadata.swaps); build it with performance.mjs");
  if (swaps) {
    let state = { ...swaps.default, ...(spec.startSwap ?? {}) };
    const changes = new Map([[0, { ...state }]]);
    for (const p of poses) {
      if (!p.swap) continue;
      for (const [set, name] of Object.entries(p.swap)) {
        if (!swaps.sets[set]) throw new Error(`no swap set "${set}" (has ${Object.keys(swaps.sets).join(", ")})`);
        if (!swaps.sets[set][name]) throw new Error(`swap set "${set}" has no state "${name}" (has ${Object.keys(swaps.sets[set]).join(", ")})`);
      }
      state = { ...state, ...p.swap };
      changes.set(p.frame, { ...state });
    }
    const frames = [...changes.keys()].sort((a, b) => a - b);
    for (const [set, states] of Object.entries(swaps.sets)) {
      for (const [name, bones] of Object.entries(states)) {
        for (const boneId of bones) {
          if (tracks.some((t) => t.boneId === boneId)) throw new Error(`${boneId} is a swap bone; switch it with "swap", don't pose it`);
          const keys = frames.map((f) => {
            const on = changes.get(f)[set] === name;
            return { time: Number((f / fps).toFixed(4)), x: on ? 0 : swaps.park.x, y: on ? 0 : swaps.park.y, rotation: 0, easing: "hold" };
          });
          if (frames[frames.length - 1] < end) keys.push({ ...keys[keys.length - 1], time: Number((end / fps).toFixed(4)) });
          tracks.push({ boneId, keys });
        }
      }
    }
  }
  const anim = { id: spec.id, name: spec.name ?? spec.id, duration: Number((end / fps).toFixed(4)), loop: spec.loop ?? false, tracks };
  return { rig: { ...rig, animations: [...rig.animations.filter((a) => a.id !== spec.id), anim] }, notes, anim };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [rigPath, specPath, out = rigPath] = process.argv.slice(2);
  if (!rigPath || !specPath) {
    console.error("usage: node motion.mjs rig.mci.json motion.json [out.mci.json]");
    process.exit(2);
  }
  try {
    const { rig, notes, anim } = bake(JSON.parse(readFileSync(rigPath, "utf8")), JSON.parse(readFileSync(specPath, "utf8")));
    writeFileSync(out, JSON.stringify(rig, null, 2));
    console.log(`baked "${anim.id}": ${anim.duration} s, ${anim.tracks.length} bones, ${anim.tracks.reduce((n, t) => n + t.keys.length, 0)} keys → ${out}`);
    for (const n of notes) console.log(`  ! ${n}`);
  } catch (e) {
    console.error(`motion: ${e.message}`);
    process.exit(1);
  }
}
