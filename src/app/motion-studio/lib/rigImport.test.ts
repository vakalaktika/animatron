// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { clipDuration, loopsForever } from "@/app/components/motion-studio/engine/timing";
import { transformAt } from "@/app/components/motion-studio/engine/transform";
import type { RigAsset, StudioDoc } from "@/app/components/motion-studio/types";
import { parseImport, welcomePreset } from "../presets";
import { normalizeDoc } from "./migrate";
import { makeRig, rigClipFrom, rigFileName } from "./rigImport";

const fixture = (): RigAsset => JSON.parse(readFileSync(path.resolve(__dirname, "../../../../docs/mci-rig/example-character.mci.json"), "utf8")) as RigAsset;
const STAGE = { width: 1920, height: 1080 };

describe("rigClipFrom", () => {
  it("opens the cross-tool fixture as a rig layer centred on the stage, playing its first clip", () => {
    const result = rigClipFrom(fixture(), STAGE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { clip } = result;
    expect(clip.type).toBe("rig");
    expect(clip.name).toBe("Ink demonstrator");
    expect(clip.x).toBe(960);
    expect(clip.y).toBe(540);
    expect(clip.scale).toBe(1);
    expect(clip.animationId).toBe("wave");
    expect(clip.pose).toEqual({});
    expect(clipDuration(clip)).toBe(2);
    expect(loopsForever(clip)).toBe(true);
  });

  it("scales a rig down to fit a small stage, never up", () => {
    const small = rigClipFrom(fixture(), { width: 400, height: 400 });
    if (!small.ok) throw new Error(small.message);
    expect(small.clip.scale).toBeCloseTo((400 * 0.8) / 700, 3);
  });

  it("refuses an unsupported version with a clear message and never produces a clip", () => {
    const result = rigClipFrom({ ...fixture(), version: 3 }, STAGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/version 3/);
  });

  it("refuses artwork outside the SVG subset", () => {
    const asset = fixture();
    const result = rigClipFrom({ ...asset, svg: asset.svg.replace("<title>", '<script>alert(1)</script><title>') }, STAGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/<script>/);
  });

  it("refuses a rig over the 4 MB budget", () => {
    const asset = fixture();
    const result = rigClipFrom({ ...asset, metadata: { pad: "x".repeat(4_000_001) } }, STAGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/4 MB/);
  });
});

describe("parseImport with a rig file", () => {
  it("recognises the rig format before anything else and hands back a rig layer", () => {
    const result = parseImport(fixture(), STAGE);
    expect(result.kind).toBe("rig");
    if (result.kind === "rig") expect(result.clip.rig.bones).toHaveLength(15);
  });

  it("validates the asset inside a saved rig layer file too", () => {
    const good = parseImport({ ...makeRig(fixture(), STAGE), parentId: null }, STAGE);
    expect(good.kind).toBe("clip");
    const bad = parseImport({ id: "a", type: "rig", start: 0, x: 0, y: 0, name: "n", enabled: true, scale: 1 }, STAGE);
    expect(bad.kind).toBe("error");
    const broken = parseImport({ ...makeRig(fixture(), STAGE), rig: { ...fixture(), bones: [] } }, STAGE);
    expect(broken.kind).toBe("error");
    const rigWithLottieKeys = parseImport({ ...fixture(), layers: [], fr: 30 }, STAGE);
    expect(rigWithLottieKeys.kind).toBe("rig");
  });

  it("reports a bad rig as an error rather than a document", () => {
    const result = parseImport({ ...fixture(), bones: [] }, STAGE);
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.message).toMatch(/can't be opened/);
  });
});

describe("rig-preserving save and reopen", () => {
  const asset = fixture();
  const clip = makeRig(asset, STAGE);
  const doc: StudioDoc = { ...welcomePreset(), name: "Rigged", clips: [...welcomePreset().clips, clip] };

  it("keeps bones, bindings, slots, animations and metadata byte for byte through a studio JSON round trip", () => {
    const text = JSON.stringify(doc);
    const result = parseImport(JSON.parse(text), STAGE);
    expect(result.kind).toBe("doc");
    if (result.kind !== "doc") return;
    expect(result.warnings).toEqual([]);
    const back = result.doc.clips.find((c) => c.type === "rig");
    expect(back?.type).toBe("rig");
    if (back?.type !== "rig") return;
    expect(back.rig).toEqual(asset);
    expect(JSON.stringify(back.rig)).toBe(JSON.stringify(asset));
  });

  it("writes the master back out under its own name", () => {
    expect(rigFileName(clip)).toBe("ink-demonstrator.mci.json");
    expect(clip.rig).toBe(asset);
  });

  it("preserves fields the studio does not read", () => {
    const extra = { ...asset, metadata: { ...asset.metadata, reviewer: "torres" }, vendorNote: "keep me" } as RigAsset;
    const result = rigClipFrom(extra, STAGE);
    if (!result.ok) throw new Error(result.message);
    expect(JSON.parse(JSON.stringify(result.clip.rig))).toEqual(extra);
  });

  it("renders the rig clip in place in the composition's transform chain", () => {
    const world = transformAt(doc, clip.id, 1);
    expect(world).toEqual({ x: 960, y: 540, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    expect(transformAt({ ...doc, clips: [{ ...clip, start: 3 }] }, clip.id, 1).opacity).toBe(0);
  });
});

describe("migration", () => {
  const asset = fixture();

  it("leaves older documents without rigs untouched", () => {
    const old = welcomePreset();
    const { doc, warnings } = normalizeDoc(JSON.parse(JSON.stringify(old)));
    expect(warnings).toEqual([]);
    expect(doc).toEqual(old);
  });

  it("fills in a rig clip's missing pose and clears an animation id that no longer exists", () => {
    const clip = makeRig(asset, STAGE, { animationId: "gone" });
    const raw = { ...welcomePreset(), clips: [{ ...clip, pose: undefined }] };
    const { doc, warnings } = normalizeDoc(JSON.parse(JSON.stringify(raw)));
    expect(warnings).toEqual([]);
    const back = doc.clips[0];
    expect(back.type === "rig" && back.animationId).toBeNull();
    expect(back.type === "rig" && back.pose).toEqual({});
  });

  it("drops a rig clip whose asset breaks the contract, with a note, instead of crashing", () => {
    const clip = makeRig({ ...asset, bones: asset.bones.map((b) => (b.id === "head" ? { ...b, parentId: "ghost" } : b)) }, STAGE);
    const { doc, warnings } = normalizeDoc({ ...welcomePreset(), clips: [clip] });
    expect(doc.clips).toEqual([]);
    expect(warnings[0]).toMatch(/can't read; removed/);
  });

  it("clamps a stored pose to the bone limits", () => {
    const clip = makeRig(asset, STAGE, { animationId: null, pose: { head: { x: 0, y: 0, rotation: 400 }, torso: { x: 0, y: 0, rotation: 0 } } });
    const { doc } = normalizeDoc({ ...welcomePreset(), clips: [clip] });
    expect(doc.clips[0].type === "rig" && doc.clips[0].pose).toEqual({ head: { x: 0, y: 0, rotation: 35 } });
  });
});
