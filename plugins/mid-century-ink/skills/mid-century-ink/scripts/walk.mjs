#!/usr/bin/env node
// A walk cycle for a biped rig seen in profile, with mechanical truth:
//
//   node walk.mjs rig.mci.json [walk.json] [out.mci.json]
//
// 1. Keys the four classical positions per step (CONTACT, DOWN, PASSING, UP)
//    for both legs by role, arms swinging opposite, with drag on head, hair,
//    skirt and forearms, and bakes them on twos (scripts/motion.mjs).
// 2. GROUND LOCK: for every drawing, the root (hips) is raised or lowered so
//    the lowest point of either foot (heel or toe) touches the ground line.
//    The body's rise and fall comes out of the leg geometry instead of being
//    guessed.
// 3. FOOT LOCK: the travel speed is solved so the foot on the ground does not
//    slide, and a small looping root offset absorbs the rest, so the planted
//    foot stays put at every drawing when the layer moves at that speed.
//    The speed is written to metadata.gaits.<id>.travelPerSecond (rig units;
//    multiply by the layer's scale for stage pixels per second).
// 4. FOOT ROLL: the foot on the ground rolls like a real one instead of
//    rocking with the shin like a boot: heel strike with the toe up, the sole
//    lowers flat (the ankle bends to keep it flat while the leg passes over),
//    the heel peels up while the toe stays planted, toe-off; in the air the
//    foot relaxes, then flexes up to meet the ground heel first. Ground and
//    foot lock use the DRAWN sole (back of the heel, tip of the toe, read from
//    the foot's artwork), not the ankle joint.
// Baked on ones by default: the ground slides under a planted foot every
// frame, so a walk on twos makes the foot skid and catch.
//
// The rig must be in a profile view (|yaw| near 90) with the standard leg
// and arm roles. Facing direction comes from metadata.view.bodyYaw (or yaw).
import { readFileSync, writeFileSync } from "node:fs";
import { bake } from "./motion.mjs";
import { createRequire } from 'node:module';
const {resolveEase}=createRequire(import.meta.url)('../references/mci-easing.cjs');
const rejectSparseConstraint=anim=>{
  if(anim.tracks.some(t=>t.keys.some(k=>k.tween)))throw new Error('This sampled contact solver cannot preserve a sparse tween constraint between its keys; bake a delivery copy first and retain the sparse master.');
};

const DEFAULTS = {
  id: "walk",
  fps: 24,
  on: 1,
  stepFrames: 12, // frames per step; 2 steps per cycle
  stride: 24, // thigh swing at contact, degrees forward (front leg) / 0.8x back (back leg)
  knee: { contact: 4, down: 14, passing: 70, up: 30, push: 30, lift: 55 },
  foot: { heelStrike: 16, pushOff: 26, toeOff: 34, flick: 10, roll: true },
  armSwing: 18,
  forearm: 14,
  lean: 3,
  overlap: { forearm: 2, head: 2, skirt: 3, ponytail: 4 },
};

const RAD = Math.PI / 180;
const mat = (x, y, d) => [Math.cos(d * RAD), Math.sin(d * RAD), -Math.sin(d * RAD), Math.cos(d * RAD), x, y];
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** Sample one animation track at time t (linear or hold), rest when absent. */
function sampleTrack(track, t) {
  if (!track) return { x: 0, y: 0, rotation: 0 };
  const k = track.keys;
  if (t <= k[0].time) return k[0];
  for (let i = 0; i < k.length - 1; i++) {
    if (t < k[i + 1].time) {
      const a = k[i], b = k[i + 1];
      let u = a.easing === "hold" ? 0 : (t - a.time) / (b.time - a.time);
      if(a.tween&&a.easing!=='hold'&&u>0&&u<1)u=resolveEase(a.tween)(u);
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, rotation: a.rotation + (b.rotation - a.rotation) * u };
    }
  }
  return k[k.length - 1];
}

/** World matrices of all bones for an animation at time t (deltas clamped to limits). */
function worlds(rig, anim, t, override = {}) {
  const byId = new Map(rig.bones.map((b) => [b.id, b]));
  const tracks = new Map(anim.tracks.map((tr) => [tr.boneId, tr]));
  const out = {};
  const visit = (id) => {
    if (out[id]) return out[id];
    const b = byId.get(id);
    const d = override[id] ?? sampleTrack(tracks.get(id), t);
    const lim = b.limits ?? { min: -3600, max: 3600 };
    const rot = Math.min(lim.max, Math.max(lim.min, d.rotation));
    const local = mat(b.rest.x + d.x, b.rest.y + d.y, b.rest.rotation + rot);
    out[id] = b.parentId ? mul(visit(b.parentId), local) : local;
    return out[id];
  };
  for (const b of rig.bones) visit(b.id);
  return out;
}

export { worlds, sampleTrack };

const tr0Times = (tracks) => tracks.reduce((a, t) => (t.keys.length > a.length ? t.keys : a), []).map((k) => k.time);

/**
 * The sole of a foot bone in its own frame: the back of the heel and the tip
 * of the toe, read from the bottom of the artwork bound to it (rest pose).
 * Falls back to the joint and the bone's tip when there is no artwork.
 */
export function soleOf(rig, foot, facing = 1) {
  const fallback = { heel: [0, 0], toe: [foot.length, 0] };
  const pts = [];
  for (const b of rig.bindings.filter((x) => x.boneId === foot.id)) {
    const m = rig.svg.match(new RegExp(`<g id="${b.svgId.replace(/[.]/g, "\\.")}">([\\s\\S]*?)</g>(?=<g id=|</svg>)`));
    if (!m) continue;
    const t = m[1].match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
    const [ox, oy] = t ? [Number(t[1]), Number(t[2])] : [0, 0];
    for (const d of m[1].matchAll(/ d="([^"]+)"/g)) {
      if (/[^MLZmlz\d\s.,-]/.test(d[1])) continue; // only polygon outlines (M/L/Z)
      const n = d[1].match(/-?\d*\.?\d+/g).map(Number);
      for (let i = 0; i + 1 < n.length; i += 2) pts.push({ w: [n[i] + ox, n[i + 1] + oy], bm: b.bindMatrix });
    }
  }
  if (pts.length < 3) return fallback;
  const maxY = Math.max(...pts.map((p) => p.w[1]));
  const bottom = pts.filter((p) => p.w[1] >= maxY - 0.35 * (maxY - Math.min(...pts.map((q) => q.w[1]))));
  const back = bottom.reduce((a, p) => (p.w[0] * facing < a.w[0] * facing ? p : a));
  const front = bottom.reduce((a, p) => (p.w[0] * facing > a.w[0] * facing ? p : a));
  // A heel and toe that sit on the ground line at rest: both take the sole's lowest y.
  const local = (p) => apply(p.bm, [p.w[0], maxY]);
  return { heel: local(back), toe: local(front) };
}

/**
 * Keeps one foot planted: for every key time in [from, to] the root is moved
 * so the lower point of that foot stays where it was at `from` (both x and
 * y). Use it for stops, starts, turns on the spot and weight shifts.
 * `start` is the root delta at `from` (to continue from another clip).
 */
export function pinFoot(rig, anim, side, { from = 0, to = Infinity, start = { x: 0, y: 0 } } = {}) {
  rejectSparseConstraint(anim);
  const foot = rig.bones.find((b) => b.role === `leg.${side}.foot`);
  const root = rig.bones.find((b) => b.role === "root");
  const pts = (w) => [apply(w[foot.id], [0, 0]), apply(w[foot.id], [foot.length, 0])];
  const low = (w) => pts(w).reduce((a, b) => (b[1] > a[1] ? b : a));
  const times = [...new Set(anim.tracks.flatMap((t) => t.keys.map((k) => k.time)))].sort((a, b) => a - b);
  const w0 = worlds(rig, anim, from, { [root.id]: { x: start.x, y: start.y, rotation: 0 } });
  const target = low(w0);
  const keys = times.map((t) => {
    if (t < from || t > to) return null;
    const w = worlds(rig, anim, t, { [root.id]: { x: 0, y: 0, rotation: 0 } });
    const p = low(w);
    return { time: t, x: Number((target[0] - p[0]).toFixed(3)), y: Number((target[1] - p[1]).toFixed(3)), rotation: 0, easing: "linear" };
  }).filter(Boolean);
  return { ...anim, tracks: [...anim.tracks.filter((t) => t.boneId !== root.id), { boneId: root.id, keys }] };
}

export function walk(rig, opts = {}) {
  const o = { ...DEFAULTS, ...opts, knee: { ...DEFAULTS.knee, ...opts.knee }, foot: { ...DEFAULTS.foot, ...opts.foot }, overlap: { ...DEFAULTS.overlap, ...opts.overlap } };
  const yaw = rig.metadata?.view?.bodyYaw ?? rig.metadata?.view?.yaw ?? 90;
  if (Math.abs(Math.abs(yaw) - 90) > 30) throw new Error(`a walk cycle needs a profile body view; this rig is at ${yaw}°`);
  const f = Math.sign(Math.sin(yaw * RAD)); // +1 facing screen right
  const role = (r) => rig.bones.find((b) => b.role === r)?.id;
  for (const r of ["root", "leg.left.upper", "leg.left.lower", "leg.left.foot", "leg.right.upper", "leg.right.lower", "leg.right.foot"])
    if (!role(r)) throw new Error(`the rig has no "${r}" bone`);
  // The near leg leads the first step: in a right-facing profile that is the character's right.
  const near = f > 0 ? "right" : "left";
  const far = near === "right" ? "left" : "right";
  const fw = -f; // forward thigh rotation sign; knee bends back = +f; toe up = -f
  const K = o.knee, S = o.stride;
  // One step: the LEAD leg goes from contact (front) through down, passing (it
  // is now the support), up; the TRAIL leg from push-off through passing to
  // contact. Values per position for [thigh, knee, foot].
  const lead = {
    contact: [fw * S, f * K.contact, -f * o.foot.heelStrike],
    down: [fw * S * 0.6, f * K.down, 0],
    passing: [0, f * K.contact, 0],
    up: [-fw * S * 0.6, f * K.contact, f * o.foot.heelStrike * 0.5],
  };
  // The swing leg lifts off behind, passes under the hips with the knee well
  // bent (foot clear of the ground), and reaches forward for the next contact.
  const trail = {
    contact: [-fw * S * 0.8, f * K.push, f * o.foot.pushOff],
    down: [-fw * S * 0.35, f * K.lift, f * 12],
    passing: [fw * S * 0.55, f * K.passing, f * 6],
    up: [fw * S * 0.85, f * (K.up + 8), -f * 6],
  };
  const legPose = (side, p) => ({ [`leg.${side}.upper`]: p[0], [`leg.${side}.lower`]: p[1], [`leg.${side}.foot`]: p[2] });
  const steps = ["contact", "down", "passing", "up"];
  const q = o.stepFrames / 4;
  const poses = [];
  // Arms swing opposite the legs: at contact the lead leg's arm is fully back,
  // through neutral at passing, crossing toward the other extreme at up.
  const swingFactor = { contact: 1, down: 0.6, passing: 0, up: -0.6 };
  const swing = (L, T, step) => {
    const a = o.armSwing * swingFactor[step];
    const out = {};
    if (role(`arm.${L}.upper`)) out[`arm.${L}.upper`] = -fw * a;
    if (role(`arm.${T}.upper`)) out[`arm.${T}.upper`] = fw * a;
    // Forearms bend a little more on the forward swing.
    if (role(`arm.${L}.forearm`)) out[`arm.${L}.forearm`] = -f * o.forearm * (a < 0 ? 1.4 : 0.6);
    if (role(`arm.${T}.forearm`)) out[`arm.${T}.forearm`] = -f * o.forearm * (a > 0 ? 1.4 : 0.6);
    return out;
  };
  const extras = (i, step) => {
    const bob = { contact: 0, down: 1, passing: 0, up: -1 }[step];
    const e = {};
    if (role("torso")) e.torso = f * o.lean + f * bob * 0.6;
    if (role("head")) e.head = -f * bob * 1.5;
    if (role("skirt")) e.skirt = (i % 2 ? -1 : 1) * f * { contact: 3, down: 4, passing: 1, up: -2 }[step];
    for (const b of rig.bones) if (/^ponytail-v/.test(b.id)) e[b.id] = f * bob * 7;
    return e;
  };
  for (let s = 0; s < 2; s++) {
    const L = s === 0 ? near : far, T = s === 0 ? far : near;
    steps.forEach((step, k) => {
      const frame = s * o.stepFrames + k * q;
      poses.push({ frame, ease: k === 0 ? "slowIn" : "linear", pose: { ...legPose(L, lead[step]), ...legPose(T, trail[step]), ...swing(L, T, step), ...extras(s, step) } });
    });
  }
  poses.push({ frame: 2 * o.stepFrames, ease: "slowIn", pose: { ...poses[0].pose } });
  const overlap = {};
  for (const b of rig.bones) {
    if (/forearm$/.test(b.role ?? "")) overlap[b.id] = o.overlap.forearm;
    if (b.role === "head") overlap[b.id] = o.overlap.head;
    if (b.role === "skirt") overlap[b.id] = o.overlap.skirt;
    if (/^ponytail-v/.test(b.id)) overlap[b.id] = o.overlap.ponytail;
  }
  const baked = bake(rig, { id: o.id, name: "Walk", fps: o.fps, on: o.on, loop: true, poses, overlap, drift: 0 });
  let anim = baked.anim;
  const soles = Object.fromEntries(["left", "right"].map((s) => {
    const foot = rig.bones.find((b) => b.role === `leg.${s}.foot`);
    const toe = rig.bones.find((b) => b.role === `leg.${s}.toe`);
    return [s, { foot, toe, heel: soleOf(rig, foot, f).heel, toeEnd: soleOf(rig, foot, f).toe, ...(toe ? { ball: soleOf(rig, toe, f).heel, tip: soleOf(rig, toe, f).toe } : {}) }];
  }));
  // Contact points of a foot: heel and toe end of the drawn sole; with a toe
  // bone (scripts/toe.mjs) the ball and the tip ride on the toe.
  const contacts = (w, side) => {
    const S = soles[side];
    const pts = [{ id: `${side}.heel`, p: apply(w[S.foot.id], S.heel) }];
    if (S.toe) pts.push({ id: `${side}.ball`, p: apply(w[S.toe.id], S.ball) }, { id: `${side}.toe`, p: apply(w[S.toe.id], S.tip) });
    else pts.push({ id: `${side}.toe`, p: apply(w[S.foot.id], S.toeEnd) });
    return pts;
  };

  // ---- foot roll: the stance foot's pitch against the ground, by gait phase
  // (0 = this foot's heel strike, 0.5 = the other foot's). theta > 0 = toe up.
  let rollClamped = 0;
  if (o.foot.roll) {
    const N = 2 * o.stepFrames;
    const ss = (u) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
    const H = o.foot.heelStrike, P1 = o.foot.pushOff, P2 = Math.max(o.foot.toeOff, P1);
    const pitch = (ph) => {
      if (ph < 0.12) return H * (1 - ss(ph / 0.12)); // heel rolls down to flat
      if (ph < 0.3) return 0; // flat while the body passes over
      if (ph < 0.5) return -P1 * ss((ph - 0.3) / 0.2); // heel peels, toe planted
      return -P1 - (P2 - P1) * Math.min(1, (ph - 0.5) / 0.1); // toe-off
    };
    // How much of the scheduled pitch to use (the rest is the keyed swing pose).
    const weight = (ph) => (ph < 0.6 ? 1 : ph < 0.72 ? 1 - ss((ph - 0.6) / 0.12) : ph < 0.88 ? 0 : ss((ph - 0.88) / 0.12));
    const restW0 = worlds(rig, { tracks: [] }, 0);
    const ang = (m) => Math.atan2(m[1], m[0]) / RAD;
    const rootId0 = role("root");
    const legs = ["left", "right"].map((side) => {
      const foot = rig.bones.find((b) => b.role === `leg.${side}.foot`);
      return { side, foot, shin: foot.parentId, offset: side === near ? 0 : o.stepFrames };
    });
    const tracks = anim.tracks.map((t) => ({ ...t, keys: t.keys.map((k) => ({ ...k })) }));
    for (const L of legs) {
      const tr = tracks.find((t) => t.boneId === L.foot.id);
      const lim = L.foot.limits ?? { min: -3600, max: 3600 };
      for (const k of tr.keys) {
        const w = worlds(rig, anim, k.time, { [rootId0]: { x: 0, y: 0, rotation: 0 } });
        const dShin = ang(w[L.shin]) - ang(restW0[L.shin]);
        const frame = Math.round(k.time * o.fps);
        const ph = ((((frame - L.offset) % N) + N) % N) / N;
        const sched = ph >= 0.88 ? -f * H - dShin : -f * pitch(ph) - dShin;
        const wgt = weight(ph);
        let r = wgt * sched + (1 - wgt) * k.rotation;
        if (r < lim.min || r > lim.max) rollClamped = Math.max(rollClamped, Math.abs(r - Math.min(lim.max, Math.max(lim.min, r))));
        k.rotation = Number(Math.min(lim.max, Math.max(lim.min, r)).toFixed(3));
      }
      // Toe break: flat on the ground while the heel peels (it bends up by
      // as much as the foot pitches down), a small flick after toe-off, then
      // straight in the air and at heel strike.
      const toe = soles[L.side].toe;
      if (toe) {
        let tt = tracks.find((t) => t.boneId === toe.id);
        if (!tt) { tt = { boneId: toe.id, keys: tr.keys.map((k) => ({ time: k.time, x: 0, y: 0, rotation: 0, easing: "linear" })) }; tracks.push(tt); }
        const tl = toe.limits ?? { min: -3600, max: 3600 };
        const flat = (ph) => f * pitch(ph); // toe rotation that cancels the foot's heel-up pitch
        for (const k of tt.keys) {
          const ph = ((((Math.round(k.time * o.fps) - L.offset) % N) + N) % N) / N;
          let r = 0;
          if (ph >= 0.3 && ph < 0.6) r = flat(ph);
          else if (ph >= 0.6 && ph < 0.72) r = flat(0.6) + (f * o.foot.flick - flat(0.6)) * ss((ph - 0.6) / 0.12);
          else if (ph >= 0.72 && ph < 0.9) r = f * o.foot.flick * (1 - ss((ph - 0.72) / 0.18));
          k.rotation = Number(Math.min(tl.max, Math.max(tl.min, r)).toFixed(3));
        }
      }
    }
    anim = { ...anim, tracks };

    // Swing clearance: the body sits on the stance foot, and wherever the
    // swinging foot would dip below it before its own heel strike, the hip
    // and knee are re-solved (two-bone IK) to lift the ankle just clear; the
    // foot keeps its pitch. Smoothed so the lift eases in and out.
    const times = tr0Times(tracks);
    const R2 = (a) => ((a + 540) % 360) - 180;
    for (const L of legs) {
      const other = legs.find((l) => l !== L);
      const thigh = rig.bones.find((b) => b.role === `leg.${L.side}.upper`);
      const shin = rig.bones.find((b) => b.role === `leg.${L.side}.lower`);
      const A = shin.rest.x, B = L.foot.rest.x; // segment lengths (child offsets)
      const need = times.map((t) => {
        const ph = ((((Math.round(t * o.fps) - L.offset) % N) + N) % N) / N;
        if (ph < 0.62) return 0;
        const w = worlds(rig, anim, t, { [rootId0]: { x: 0, y: 0, rotation: 0 } });
        const mine = Math.max(...contacts(w, L.side).map((c) => c.p[1]));
        const base = Math.max(...contacts(w, other.side).map((c) => c.p[1]));
        return Math.max(0, mine - base + 1.5);
      });
      const lift = need.map((_, i) => Math.max(...[-2, -1, 0, 1, 2].map((d) => need[(i + d + need.length - 1) % (need.length - 1)] * (1 - Math.abs(d) * 0.25))));
      const keyAt = (id, i) => tracks.find((t) => t.boneId === id).keys[i];
      times.forEach((t, i) => {
        if (lift[i] <= 0) return;
        const w = worlds(rig, anim, t, { [rootId0]: { x: 0, y: 0, rotation: 0 } });
        const hip = apply(w[thigh.id], [0, 0]), ank = apply(w[L.foot.id], [0, 0]);
        const tx = ank[0], ty = ank[1] - lift[i];
        const dx = tx - hip[0], dy = ty - hip[1], D = Math.min(A + B - 0.01, Math.hypot(dx, dy));
        const knee = Math.acos(Math.max(-1, Math.min(1, (A * A + B * B - D * D) / (2 * A * B)))); // interior angle
        const bend = Math.PI - knee; // 0 = straight
        const toTarget = Math.atan2(dy, dx);
        const alpha = Math.acos(Math.max(-1, Math.min(1, (A * A + D * D - B * B) / (2 * A * D))));
        // knee bends back: the thigh sits on the forward side of the hip-ankle line
        const thighW = (toTarget - f * alpha) / RAD;
        const shinW = thighW + f * bend / RAD;
        const curThigh = Math.atan2(w[thigh.id][1], w[thigh.id][0]) / RAD;
        const curShin = Math.atan2(w[shin.id][1], w[shin.id][0]) / RAD;
        const dT = R2(thighW - curThigh), dS = R2(shinW - curShin) - dT;
        const clampB = (b, v) => Math.min(b.limits?.max ?? 3600, Math.max(b.limits?.min ?? -3600, v));
        const kt = keyAt(thigh.id, i), ks = keyAt(shin.id, i), kf = keyAt(L.foot.id, i);
        kt.rotation = Number(clampB(thigh, kt.rotation + dT).toFixed(3));
        ks.rotation = Number(clampB(shin, ks.rotation + dS).toFixed(3));
        kf.rotation = Number(clampB(L.foot, kf.rotation - dT - dS).toFixed(3));
      });
      anim = { ...anim, tracks };
    }
  }

  // ---- ground lock and foot lock, drawing by drawing
  const footPoints = contacts;
  const restW = worlds(rig, { tracks: [] }, 0);
  const groundY = Math.max(...["left", "right"].flatMap((s) => footPoints(restW, s).map((q) => q.p[1])));
  const rootId = role("root");
  const times = anim.tracks[0].keys.map((k) => k.time);
  // The planted foot follows the step schedule: the lead leg of each step,
  // from its contact to the next contact. Its lower point (heel at contact,
  // rolling to the toe) is the one held on the ground and kept from sliding.
  let dip = 0;
  const frames = times.map((t) => {
    const w = worlds(rig, anim, t, { [rootId]: { x: 0, y: 0, rotation: 0 } });
    const pts = ["left", "right"].flatMap((s) => footPoints(w, s));
    const frame = Math.round(t * o.fps);
    const stanceSide = Math.floor((frame % (2 * o.stepFrames)) / o.stepFrames) === 0 ? near : far;
    // The planted foot is the one actually on the ground: its lowest point
    // (ties go to the scheduled support leg). With a rolling foot the heel
    // can land a drawing early; the lock then follows it instead of a foot
    // that has already left the ground.
    const N2 = 2 * o.stepFrames;
    const phaseOf = (side) => ((((frame - (side === near ? 0 : o.stepFrames)) % N2) + N2) % N2) / N2;
    const canPlant = (side) => phaseOf(side) >= 0.95 || phaseOf(side) <= 0.62; // landing, or in its stance
    const lowAll = pts.filter((p) => canPlant(p.id.split(".")[0])).reduce((a, b) => (b.p[1] > a.p[1] ? b : a));
    const ownLow = pts.filter((p) => p.id.startsWith(stanceSide)).reduce((a, b) => (b.p[1] > a.p[1] ? b : a));
    const low = ownLow.p[1] >= lowAll.p[1] - 0.5 ? ownLow : lowAll;
    // Height: whichever point of either foot is lowest touches the ground (a
    // reaching heel lands a drawing early rather than sinking into the floor).
    const lowest = Math.max(...pts.map((p) => p.p[1]));
    const dy = groundY - lowest;
    // Report how far the planted foot lifts off when the other one lands early.
    dip = Math.max(dip, groundY - (low.p[1] + dy));
    return { t, pts, low, dy };
  });
  // Travel speed that keeps the planted point still over a whole cycle, and
  // the looping root offset that makes it exact at every drawing.
  let back = 0;
  for (let i = 1; i < frames.length; i++) {
    const id = frames[i].low.id;
    const now = frames[i].pts.find((p) => p.id === id).p[0];
    const before = frames[i - 1].pts.find((p) => p.id === id).p[0];
    back += now - before;
  }
  const cycle = times[times.length - 1];
  const v = -back / cycle; // rig units per second, in the facing direction when > 0 ... sign follows the screen
  let dx = 0;
  const offsets = [0];
  for (let i = 1; i < frames.length; i++) {
    const id = frames[i].low.id;
    const now = frames[i].pts.find((p) => p.id === id).p[0];
    const before = frames[i - 1].pts.find((p) => p.id === id).p[0];
    dx = dx - (now - before) - v * (frames[i].t - frames[i - 1].t);
    offsets.push(dx);
  }
  // Close the loop exactly (float error) and centre the offsets.
  const drift = offsets[offsets.length - 1];
  const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  const rootKeys = frames.map((fr, i) => ({
    time: fr.t,
    x: Number((offsets[i] - (drift * fr.t) / cycle - mean).toFixed(3)),
    y: Number(fr.dy.toFixed(3)),
    rotation: 0,
    easing: "linear",
  }));
  rootKeys[rootKeys.length - 1] = { ...rootKeys[0], time: rootKeys[rootKeys.length - 1].time };
  const tracks = [...anim.tracks.filter((t) => t.boneId !== rootId), { boneId: rootId, keys: rootKeys }];
  const finalAnim = { ...anim, tracks };

  // ---- report: planted-point slip with the layer moving at v
  let slip = 0;
  for (let i = 1; i < frames.length; i++) {
    const w0 = worlds(rig, finalAnim, frames[i - 1].t), w1 = worlds(rig, finalAnim, frames[i].t);
    const id = frames[i].low.id;
    const side = id.split(".")[0];
    const a = footPoints(w0, side).find((p) => p.id === id).p[0] + v * frames[i - 1].t;
    const b = footPoints(w1, side).find((p) => p.id === id).p[0] + v * frames[i].t;
    slip = Math.max(slip, Math.abs(b - a));
  }
  const bob = Math.max(...rootKeys.map((k) => k.y)) - Math.min(...rootKeys.map((k) => k.y));
  const out = {
    ...baked.rig,
    animations: [...baked.rig.animations.filter((a) => a.id !== o.id), finalAnim],
    metadata: {
      ...(baked.rig.metadata ?? {}),
      gaits: {
        ...(baked.rig.metadata?.gaits ?? {}),
        [o.id]: {
          travelPerSecond: Number(v.toFixed(3)),
          cycleSeconds: cycle,
          stepFrames: o.stepFrames,
          note: "Move the layer at travelPerSecond x layer scale stage px/s (negative = to the left) so the planted foot stays put.",
        },
      },
    },
  };
  const notes = [...baked.notes];
  if (rollClamped > 0.5) notes.push(`foot roll limited by the ankle's joint limits (up to ${rollClamped.toFixed(1)}° short); widen leg.*.foot limits for a fuller roll`);
  return { rig: out, report: { travelPerSecond: v, cycle, bob, slip, dip, notes } };
}

/**
 * An arm that HOLDS something while walking (a leash, a bag, a phone, a hand
 * of another character): it keeps a held pose and only a fraction of the
 * swing, because the load steadies it. Rewrites the arm tracks of `animId`:
 * rotation = held angle + keep x (walk angle - its mean). Angles are deltas
 * in degrees (negative upper = forward for a figure facing right; read the
 * bone limits). Missing tracks are created at the root track's key times.
 */
export function carryArm(rig, animId, side, { upper = -20, fore = -50, hand = 8, keep = 0.3 } = {}) {
  const requested=rig.animations.find(a=>a.id===animId);
  if(requested)rejectSparseConstraint(requested);
  const anim = rig.animations.find((a) => a.id === animId);
  if (!anim) throw new Error(`no animation "${animId}"`);
  const held = { upper, forearm: fore, hand };
  const rootId = rig.bones.find((b) => b.parentId === null).id;
  const times = (anim.tracks.find((t) => t.boneId === rootId) ?? anim.tracks[0]).keys.map((k) => k.time);
  const tracks = anim.tracks.map((t) => ({ ...t }));
  for (const [part, angle] of Object.entries(held)) {
    const b = rig.bones.find((x) => x.role === `arm.${side}.${part}`);
    if (!b) throw new Error(`the rig has no arm.${side}.${part} bone`);
    const clamp = (v) => Math.min(b.limits?.max ?? 3600, Math.max(b.limits?.min ?? -3600, v));
    let i = tracks.findIndex((t) => t.boneId === b.id);
    if (i < 0) {
      tracks.push({ boneId: b.id, keys: times.map((time) => ({ time, x: 0, y: 0, rotation: 0, easing: "linear" })) });
      i = tracks.length - 1;
    }
    const keys = tracks[i].keys;
    const mean = keys.reduce((a, k) => a + k.rotation, 0) / keys.length;
    tracks[i] = { ...tracks[i], keys: keys.map((k) => ({ ...k, rotation: Number(clamp(angle + keep * (k.rotation - mean)).toFixed(3)) })) };
  }
  return { ...rig, animations: rig.animations.map((a) => (a.id === animId ? { ...a, tracks } : a)) };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [rigPath, specPath, outPath = rigPath] = process.argv.slice(2);
  if (!rigPath) {
    console.error("usage: node walk.mjs rig.mci.json [walk.json] [out.mci.json]");
    process.exit(2);
  }
  try {
    const spec = specPath && specPath.endsWith(".json") && !specPath.endsWith(".mci.json") ? JSON.parse(readFileSync(specPath, "utf8")) : {};
    const out = specPath && specPath.endsWith(".mci.json") ? specPath : outPath;
    const { rig, report } = walk(JSON.parse(readFileSync(rigPath, "utf8")), spec);
    writeFileSync(out, JSON.stringify(rig, null, 2));
    console.log(`walk: ${report.cycle} s cycle, travel ${report.travelPerSecond.toFixed(1)} rig units/s, body rise and fall ${report.bob.toFixed(1)}, planted-foot slip ${report.slip.toFixed(2)} at drawings, planted foot lifted at most ${Math.max(0, report.dip).toFixed(1)} → ${out}`);
    for (const n of report.notes) console.log(`  ! ${n}`);
  } catch (e) {
    console.error(`walk: ${e.message}`);
    process.exit(1);
  }
}
