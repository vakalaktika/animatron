/**
 * Mid-century Ink rigs, handled with the studio's own rig engine
 * (engine/rig.ts, engine/rigSvg.ts, lib/rigImport.ts). Runs inside an
 * Animatron checkout, launched by rig.mjs with `tsx --tsconfig`. Nothing
 * here writes into the repo, and the rig's artwork is never redrawn: only
 * placement, pose and animation clips change, all through engine functions.
 *
 *   righarness.ts inspect <rig.mci.json>
 *   righarness.ts place <spec.json>          spec: see placeRig() below; prints the clip JSON
 *   righarness.ts example <rig.mci.json> <out.json>
 *
 * The last stdout line is `RESULT <json>`.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  RIG_LIMITS,
  addAnimation,
  boneRows,
  clampRotation,
  compatibleActions,
  preset,
  replaceAnimation,
  tidyPose,
  upsertKey,
  validateRig,
} from "@/app/components/motion-studio/engine/rig";
import { DOC_VERSION, type RigAsset, type RigClip, type RigKey, type RigPose, type StudioDoc } from "@/app/components/motion-studio/types";
import { makeRig, rigClipFrom } from "@/app/motion-studio/lib/rigImport";
import { makeText } from "@/app/motion-studio/presets";

// The studio parses rig SVG with the browser's DOMParser; in Node the
// studio's own test environment (jsdom, from its devDependencies) supplies it.
const { JSDOM } = createRequire(join(process.cwd(), "package.json"))("jsdom");
(globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM("").window.DOMParser;

type Result = { ok: true; [k: string]: unknown } | { ok: false; error: string };
function finish(result: Result): never {
  writeFileSync(1, `RESULT ${JSON.stringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}

/** A rig file, run through the studio's own import (budget, contract, SVG subset). */
function loadRig(path: string): RigAsset {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    finish({ ok: false, error: `${path}: not readable JSON (${(e as Error).message})` });
  }
  const imported = rigClipFrom(json, { width: 1920, height: 1080 });
  if (!imported.ok) finish({ ok: false, error: imported.message });
  return imported.clip.rig;
}

function inspect(path: string) {
  const rig = loadRig(path);
  const bytes = Buffer.byteLength(readFileSync(path, "utf8"));
  finish({
    ok: true,
    name: rig.name ?? null,
    canvas: rig.canvas,
    bytes,
    budget: { jsonBytes: RIG_LIMITS.jsonBytes },
    bones: boneRows(rig).map(({ bone, depth }) => ({
      id: bone.id,
      role: bone.role ?? null,
      name: bone.name ?? null,
      parent: bone.parentId,
      depth,
      length: bone.length,
      limits: bone.limits ?? null,
    })),
    animations: rig.animations.map((a) => ({ id: a.id, name: a.name ?? null, duration: a.duration, loop: a.loop, bones: a.tracks.map((t) => t.boneId) })),
    slots: rig.slots ?? [],
    presets: compatibleActions(rig),
    metadata: rig.metadata ?? null,
  });
}

/** A bone named by its id or its role ("arm.left.upper"). */
function boneId(rig: RigAsset, ref: string): string {
  const bone = rig.bones.find((b) => b.id === ref) ?? rig.bones.find((b) => b.role === ref);
  if (!bone) finish({ ok: false, error: `no bone with id or role "${ref}"; run inspect to see them` });
  return bone.id;
}

type DeltaSpec = number | { x?: number; y?: number; rotation?: number };
const deltaOf = (d: DeltaSpec) => (typeof d === "number" ? { x: 0, y: 0, rotation: d } : { x: d.x ?? 0, y: d.y ?? 0, rotation: d.rotation ?? 0 });

/**
 * A motion written as poses at times. Every bone mentioned anywhere gets a
 * track; at a key where it isn't mentioned it is at rest, so each key reads
 * as the whole pose at that moment.
 *   { id, name?, duration, loop, keys: [{ time, pose: { "<role or id>": deg | {x,y,rotation} }, easing?: "linear"|"hold" }] }
 */
interface MotionSpec {
  id?: string;
  name?: string;
  duration: number;
  loop: boolean;
  keys: { time: number; pose: Record<string, DeltaSpec>; easing?: RigKey["easing"] }[];
}

function addMotion(rig: RigAsset, motion: MotionSpec, notes: string[]): { rig: RigAsset; id: string } {
  if (!(motion.duration > 0 && motion.duration <= RIG_LIMITS.duration)) finish({ ok: false, error: `motion duration must be over 0 and at most ${RIG_LIMITS.duration} s` });
  if (!Array.isArray(motion.keys) || motion.keys.length < 1) finish({ ok: false, error: "a motion needs at least one key" });
  const times = motion.keys.map((k) => k.time);
  if (times[0] !== 0) finish({ ok: false, error: "a motion's first key must be at time 0" });
  if (times.some((t, i) => i > 0 && !(t > times[i - 1]))) finish({ ok: false, error: "motion key times must strictly increase" });
  if (times[times.length - 1] > motion.duration) finish({ ok: false, error: "a motion key is past its duration" });
  const name = motion.name ?? motion.id ?? "Motion";
  let { asset, id } = addAnimation(rig, name, motion.duration, motion.loop);
  if (motion.id && motion.id !== id) {
    // Replace a clip of the same id rather than adding "id-2".
    asset = { ...asset, animations: asset.animations.filter((a) => a.id !== motion.id).map((a) => (a.id === id ? { ...a, id: motion.id! } : a)) };
    id = motion.id;
  }
  const bones = [...new Set(motion.keys.flatMap((k) => Object.keys(k.pose).map((ref) => boneId(rig, ref))))];
  for (const key of motion.keys) {
    const byId = Object.fromEntries(Object.entries(key.pose).map(([ref, d]) => [boneId(rig, ref), deltaOf(d)]));
    for (const b of bones) {
      const d = byId[b] ?? { x: 0, y: 0, rotation: 0 };
      const bone = rig.bones.find((x) => x.id === b)!;
      const clamped = clampRotation(bone, d.rotation);
      if (clamped !== d.rotation) notes.push(`${bone.role ?? bone.id} at ${key.time}s: ${d.rotation}° is past its limits, clamped to ${clamped}°`);
      asset = upsertKey(asset, id, b, key.time, d, key.easing ?? "linear");
    }
  }
  const anim = asset.animations.find((a) => a.id === id)!;
  if (motion.loop) {
    const first = motion.keys[0];
    const last = motion.keys[motion.keys.length - 1];
    if (last.time !== motion.duration || JSON.stringify(first.pose) !== JSON.stringify(last.pose)) notes.push(`"${id}" loops but its last key isn't the first pose at the full duration, so it will jump each cycle`);
  }
  return { rig: replaceAnimation(asset, anim), id };
}

/**
 * Placement spec (all optional except rig and stage):
 *   { rig: "path.mci.json", stage: {width,height}, id, name, start,
 *     x, y,                    anchor = centre of the rig's canvas, stage px
 *     scale | height,          height = rendered canvas height in px
 *     presets: ["wave","nod"], add the studio's role-gated clips
 *     motions: [MotionSpec],   add clips of your own
 *     play: "<animation id>" | null,   which clip plays from `start`; null = still pose
 *     pose: { "<role or id>": deg | {x,y,rotation} }   the still pose (when play is null)
 *   }
 */
interface PlaceSpec {
  rig: string;
  stage: { width: number; height: number };
  id?: string;
  name?: string;
  start?: number;
  x?: number;
  y?: number;
  scale?: number;
  height?: number;
  presets?: ("wave" | "nod")[];
  motions?: MotionSpec[];
  play?: string | null;
  pose?: Record<string, DeltaSpec>;
}

function placeRig(spec: PlaceSpec, base: string): { clip: RigClip; notes: string[] } {
  const notes: string[] = [];
  let rig = loadRig(join(base, spec.rig));
  for (const kind of spec.presets ?? []) {
    if (!compatibleActions(rig)[kind]) finish({ ok: false, error: `this skeleton lacks the roles the "${kind}" preset needs (see inspect → presets)` });
    rig = preset(rig, kind);
  }
  for (const motion of spec.motions ?? []) rig = addMotion(rig, motion, notes).rig;
  const play = spec.play === undefined ? (rig.animations[0]?.id ?? null) : spec.play;
  if (play !== null && !rig.animations.some((a) => a.id === play)) finish({ ok: false, error: `no animation "${play}" on this rig (has: ${rig.animations.map((a) => a.id).join(", ") || "none"})` });
  const rawPose: RigPose = Object.fromEntries(Object.entries(spec.pose ?? {}).map(([ref, d]) => [boneId(rig, ref), deltaOf(d)]));
  const pose = tidyPose(rig, rawPose);
  for (const [id, d] of Object.entries(rawPose)) if (pose[id] && pose[id].rotation !== d.rotation) notes.push(`pose ${id}: ${d.rotation}° clamped to ${pose[id].rotation}°`);
  if (play !== null && Object.keys(pose).length) notes.push("a pose is only shown when no animation plays (play: null); it is kept for when one is turned off");
  const scale = spec.height ? Number((spec.height / rig.canvas.height).toFixed(3)) : spec.scale;
  const check = validateRig(rig);
  if (!check.ok) finish({ ok: false, error: `the edited rig fails the contract: ${check.errors.join(" ")}` });
  const clip = makeRig(rig, spec.stage, {
    ...(spec.id ? { id: spec.id } : {}),
    ...(spec.name ? { name: spec.name } : {}),
    ...(spec.start !== undefined ? { start: spec.start } : {}),
    ...(spec.x !== undefined ? { x: spec.x } : {}),
    ...(spec.y !== undefined ? { y: spec.y } : {}),
    ...(scale !== undefined ? { scale } : {}),
    animationId: play,
    pose,
  });
  const w = rig.canvas.width * clip.scale;
  const h = rig.canvas.height * clip.scale;
  const box = { left: clip.x - w / 2, top: clip.y - h / 2, right: clip.x + w / 2, bottom: clip.y + h / 2 };
  if (box.left < 0 || box.top < 0 || box.right > spec.stage.width || box.bottom > spec.stage.height) {
    notes.push(`the rig's canvas (${Math.round(box.left)},${Math.round(box.top)})-(${Math.round(box.right)},${Math.round(box.bottom)}) runs past the stage; fine if the art inside doesn't, check the card`);
  }
  return { clip, notes };
}

function place(specPath: string) {
  const spec = JSON.parse(readFileSync(specPath, "utf8")) as PlaceSpec;
  if (!spec.rig || !spec.stage) finish({ ok: false, error: "spec needs rig and stage" });
  const { clip, notes } = placeRig(spec, join(specPath, ".."));
  finish({ ok: true, clip, notes, canvasBox: { width: clip.rig.canvas.width * clip.scale, height: clip.rig.canvas.height * clip.scale } });
}

/** The worked example: the studio's cross-tool fixture waving beside a greeting. */
function example(rigPath: string, out: string) {
  const stage = { width: 1920, height: 1080 };
  const { clip } = placeRig({ rig: rigPath, stage, id: "rig-character", name: "Character", start: 1.0, x: 560, y: 560, height: 820, presets: ["wave"], play: "wave" }, "/");
  const hello = makeText({ id: "rig-hello", name: "Greeting", x: 1260, y: 420, start: 0.4, text: "Hello there", font: "serif", fontSize: 120, color: "#2a241d", accentSuffix: "", rule: false, reveal: "pop", revealDuration: 0.6, overshoot: 1.4 });
  const sub = makeText({ id: "rig-sub", name: "Sub-line", x: 1260, y: 580, start: 1.0, text: "A rigged character, waving", font: "sans", fontSize: 36, color: "#645e56", accentSuffix: "", rule: false, reveal: "fade", revealDuration: 0.6 });
  const doc: StudioDoc = { version: DOC_VERSION, name: "Rig wave", description: "A Mid-century Ink character waves beside a greeting.", stage: { ...stage, background: "#f7f5ee", transparent: false }, clips: [clip, hello, sub] };
  writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  finish({ ok: true, wrote: out });
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "inspect" && rest.length === 1) inspect(rest[0]);
else if (cmd === "place" && rest.length === 1) place(rest[0]);
else if (cmd === "example" && rest.length === 2) example(rest[0], rest[1]);
else {
  console.error("usage: righarness.ts inspect <rig> | place <spec.json> | example <rig> <out.json>");
  process.exit(2);
}
