// node --test scripts/test/rig.test.mjs
// rig.mjs against the studio's own fixture rig, using the plugin's cached
// studio checkout (run validate.mjs once first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = fileURLToPath(new URL("..", import.meta.url));
const EXAMPLES = join(SCRIPTS, "..", "examples");
const work = mkdtempSync(join(tmpdir(), "ac-rig-"));
copyFileSync(join(EXAMPLES, "rigs", "example-character.mci.json"), join(work, "hero.mci.json"));
const node = (script, args) => spawnSync("node", [join(SCRIPTS, script), ...args, "--offline", ...(process.env.ANIMATRON_COMPOSER_REPO ? ["--repo", process.env.ANIMATRON_COMPOSER_REPO] : [])], { encoding: "utf8" });
const spec = (name, body) => {
  const p = join(work, name);
  writeFileSync(p, JSON.stringify({ rig: "hero.mci.json", stage: { width: 1080, height: 1920 }, ...body }));
  return p;
};
const blank = () => {
  const p = join(work, `doc-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify({ version: 2, name: "Rig test", stage: { width: 1080, height: 1920, background: "#16283a", transparent: false }, clips: [] }));
  return p;
};

test("inspect lists bones, roles, clips and presets", () => {
  const r = node("rig.mjs", ["inspect", join(work, "hero.mci.json")]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /passes the studio's rig import/);
  assert.match(r.stdout, /upper-left · arm\.left\.upper · -130°\.\.90°/);
  assert.match(r.stdout, /wave yes, nod yes/);
});

test("inspect refuses artwork outside the contract's SVG subset", () => {
  const rig = JSON.parse(readFileSync(join(work, "hero.mci.json"), "utf8"));
  rig.svg = rig.svg.replace("</svg>", "<script>alert(1)</script></svg>");
  writeFileSync(join(work, "bad.mci.json"), JSON.stringify(rig));
  const r = node("rig.mjs", ["inspect", join(work, "bad.mci.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /can't be opened/);
});

test("place builds a layer that passes validation, with a motion of its own", () => {
  const doc = blank();
  const s = spec("cheer.json", {
    id: "hero",
    name: "Hero",
    x: 540,
    y: 1100,
    height: 900,
    motions: [{ id: "cheer", duration: 1.2, loop: false, keys: [{ time: 0, pose: {} }, { time: 0.6, pose: { "arm.left.upper": -110, head: -12 } }, { time: 1.2, pose: { "arm.left.upper": -100, head: 0 } }] }],
    play: "cheer",
  });
  let r = node("rig.mjs", ["place", s, "--into", doc]);
  assert.equal(r.status, 0, r.stderr);
  const clip = JSON.parse(readFileSync(doc, "utf8")).clips[0];
  assert.equal(clip.type, "rig");
  assert.equal(clip.animationId, "cheer");
  assert.equal(clip.scale, Number((900 / 700).toFixed(3)));
  const cheer = clip.rig.animations.find((a) => a.id === "cheer");
  assert.deepEqual(cheer.tracks.map((t) => t.boneId).sort(), ["head", "upper-left"]);
  assert.deepEqual(cheer.tracks.find((t) => t.boneId === "upper-left").keys.map((k) => k.rotation), [0, -110, -100]);
  r = node("validate.mjs", [doc]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /PASS/);
});

test("presets need the roles; poses clamp to joint limits", () => {
  const doc = blank();
  const r = node("rig.mjs", ["place", spec("still.json", { id: "still", presets: ["nod"], play: null, pose: { head: 90, "arm.right.upper": 40 } }), "--into", doc]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /head: 90° clamped to 35°/);
  const clip = JSON.parse(readFileSync(doc, "utf8")).clips[0];
  assert.equal(clip.animationId, null);
  assert.deepEqual(clip.pose.head, { x: 0, y: 0, rotation: 35 });
  assert.ok(clip.rig.animations.some((a) => a.id === "nod"));
  assert.equal(node("validate.mjs", [doc]).status, 0);
});

test("rejects unknown bones and badly ordered keys", () => {
  let r = node("rig.mjs", ["place", spec("tail.json", { pose: { tail: 10 }, play: null })]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no bone with id or role "tail"/);
  r = node("rig.mjs", ["place", spec("order.json", { motions: [{ id: "m", duration: 1, loop: false, keys: [{ time: 0, pose: {} }, { time: 0, pose: { head: 5 } }] }] })]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /strictly increase/);
});

test("the validator catches a rig layer whose clip doesn't exist", () => {
  const doc = blank();
  node("rig.mjs", ["place", spec("ok.json", { id: "hero" }), "--into", doc]);
  const d = JSON.parse(readFileSync(doc, "utf8"));
  d.clips[0].animationId = "dance";
  writeFileSync(doc, JSON.stringify(d));
  const r = node("validate.mjs", [doc]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /animationId/);
});
