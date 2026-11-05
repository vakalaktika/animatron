import { readFileSync } from "node:fs";
import path from "node:path";
import type { RigAsset } from "../types";
import { sample, validateRig, upsertKey } from "./rig";

const fixture = (): RigAsset => JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../docs/mci-rig/example-character.mci.json"), "utf8"));
const curved = (tween: unknown = { name: "inOut" }, version = 3) => ({
  ...fixture(), version,
  animations: [{ id: "move", duration: 2, loop: false, tracks: [{ boneId: "root", keys: [
    { time: 0, x: 0, y: 0, rotation: 0, easing: "linear", tween },
    { time: 2, x: 100, y: 40, rotation: 60, easing: "linear" },
  ] }] }],
}) as RigAsset;

describe("sparse Rig 3 tweens", () => {
  it("evaluates two eased poses without baking intermediate keys", () => {
    const asset = curved();
    expect(validateRig(asset)).toEqual({ ok: true, errors: [] });
    const quarter = sample(asset, "move", 0.5).root;
    expect(quarter.x).toBeGreaterThan(0);
    expect(quarter.x).toBeLessThan(20);
    expect(quarter.y).toBeCloseTo(quarter.x * 0.4);
    expect(quarter.rotation).toBeCloseTo(quarter.x * 0.6);
    expect(sample(asset, "move", 1).root.x).toBeCloseTo(50);
    expect(sample(asset, "move", 2).root.x).toBe(100);
    expect(asset.animations[0].tracks[0].keys).toHaveLength(2);
  });

  it.each([1, 2])("rejects tween declarations in legacy version %s", version => {
    expect(validateRig(curved(undefined, version)).ok).toBe(false);
  });

  it.each([null, {}, { name: "unknown" }, { name: "custom", custom: [2, 0, 1, 1] }, { name: "custom", custom: [0, NaN, 1, 1] }, { name: "custom", custom: [0, 0, 1] }])("rejects malformed curve %j", tween => {
    expect(validateRig(curved(tween)).ok).toBe(false);
  });

  it("preserves exact held and linear legacy interpolation", () => {
    const asset = curved();
    asset.animations[0].tracks[0].keys[0].easing = "hold";
    expect(sample(asset, "move", 1.99).root.x).toBe(0);
    expect(sample(asset, "move", 2).root.x).toBe(100);
    delete asset.animations[0].tracks[0].keys[0].tween;
    asset.animations[0].tracks[0].keys[0].easing = "linear";
    expect(sample(asset, "move", 0.5).root.x).toBe(25);
  });

  it("keeps an existing curve when a human edits its pose", () => {
    const asset = curved();
    const next = upsertKey(asset, "move", "root", 0, { x: 10, y: 0, rotation: 0 });
    expect(next.animations[0].tracks[0].keys[0].tween).toEqual({ name: "inOut" });
    expect(asset.animations[0].tracks[0].keys[0].x).toBe(0);
  });
});
