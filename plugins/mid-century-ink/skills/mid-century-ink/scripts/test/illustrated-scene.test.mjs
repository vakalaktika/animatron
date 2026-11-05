import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scene } from "../scene.mjs";
import { slim } from "../slim.mjs";
const require = createRequire(import.meta.url);
const core = require("../../references/mci-rig-core.cjs");
const fixture = new URL("../../examples/illustrated-part.mci.json", import.meta.url);
const source = JSON.parse(readFileSync(fixture, "utf8"));

test("packaged validator resolves its runtime and reads Rig 2", () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL("../validate-rig.cjs", import.meta.url)), fileURLToPath(fixture)], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /structural checks passed/);
});

test("scene combination retains Rig 2 parts, registrations, drawings and source", () => {
  const original = JSON.stringify(source);
  const animation = source.animations[0].id;
  const { rig } = scene({ name: "Illustrated pair", members: [
    { rig: source, prefix: "left", offset: [10, 20], play: animation },
    { rig: source, prefix: "right", offset: [150, 20], play: animation },
  ] });
  assert.equal(rig.version, 2);
  assert.equal(core.validate(rig).ok, true, JSON.stringify(core.validate(rig).errors));
  assert.equal(rig.rasterAttachments.length, source.rasterAttachments.length * 2);
  assert.equal(rig.drawingSets.length, source.drawingSets.length * 2);
  for (const prefix of ["left", "right"]) {
    const attachment = rig.rasterAttachments.find(a => a.id === `${prefix}-${source.rasterAttachments[0].id}`);
    assert.equal(attachment.src, source.rasterAttachments[0].src);
    assert.equal(attachment.svgId, `${prefix}-${source.rasterAttachments[0].svgId}`);
    assert.ok(rig.animations[0].drawingTracks.some(t => t.setId.startsWith(prefix + "-")));
    const at = core.drawingVisibility(rig, rig.animations[0].id, .75);
    const originalVisibility = core.drawingVisibility(source, animation, .75);
    for (const [id, visible] of Object.entries(originalVisibility)) assert.equal(at[`${prefix}-${id}`], visible);
  }
  assert.equal(JSON.stringify(source), original);
  assert.deepEqual(slim(rig).rig, rig, "Rig 2 playback optimization must preserve authored art and motion");
});
