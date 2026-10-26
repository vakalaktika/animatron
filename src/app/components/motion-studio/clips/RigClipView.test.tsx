// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { motionValue } from "motion/react";
import { StageCanvas } from "../StageCanvas";
import { matrixString, rigPoseAt, transforms } from "../engine/rig";
import type { RigAsset, RigClip, StudioDoc } from "../types";

const fixture = (): RigAsset => JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../docs/mci-rig/example-character.mci.json"), "utf8")) as RigAsset;

const docWith = (clip: RigClip): StudioDoc => ({ version: 2, name: "t", stage: { width: 1920, height: 1080, background: "#fff", transparent: false }, clips: [clip] });
const rigClip = (over: Partial<RigClip> = {}): RigClip => ({
  id: "rig",
  type: "rig",
  name: "Ink",
  enabled: true,
  start: 0,
  x: 960,
  y: 540,
  scale: 1,
  parentId: null,
  followRotation: false,
  rig: fixture(),
  animationId: "wave",
  pose: {},
  ...over,
});

describe("RigClipView", () => {
  it("draws every bound group inline, wrapped in its posed bone transform", () => {
    const clip = rigClip();
    const time = motionValue(0.7);
    const { container, unmount } = render(<StageCanvas doc={docWith(clip)} time={time} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 600 700");
    const wraps = transforms(clip.rig, rigPoseAt(clip, 0.7));
    for (const b of clip.rig.bindings) {
      const group = svg.querySelector(`g[id="${b.svgId}"]`)!;
      expect(group).not.toBeNull();
      expect(group.parentElement?.getAttribute("transform")).toBe(matrixString(wraps[b.svgId]));
    }
    // The arm that waves is not at the identity mid-wave; the torso is.
    expect(svg.querySelector('g[id="fore-art-left"]')!.parentElement?.getAttribute("transform")).not.toBe(matrixString([1, 0, 0, 1, 0, 0]));
    expect(svg.querySelector('g[id="torso-art"]')!.parentElement?.getAttribute("transform")).toBe(matrixString([1, 0, 0, 1, 0, 0]));
    // Nothing from the file is executable or live.
    expect(container.querySelector("script, image, use, style, text, foreignObject")).toBeNull();
    expect(svg.querySelector("title")?.textContent).toBe("Ink demonstrator");
    unmount();
  });

  it("stands in the manual pose with no clip and refuses to draw artwork outside the subset", () => {
    const posed = rigClip({ animationId: null, pose: { head: { x: 0, y: 0, rotation: 20 } } });
    const { container, unmount } = render(<StageCanvas doc={docWith(posed)} time={motionValue(3)} />);
    const head = container.querySelector('g[id="head-art"]')!.parentElement!;
    expect(head.getAttribute("transform")).toBe(matrixString(transforms(posed.rig, posed.pose)["head-art"]));
    unmount();

    const asset = fixture();
    const bad = rigClip({ rig: { ...asset, svg: asset.svg.replace("<title>", "<script>alert(1)</script><title>") } });
    const { container: c2, unmount: u2 } = render(<StageCanvas doc={docWith(bad)} time={motionValue(0)} />);
    expect(c2.querySelector("svg")).toBeNull();
    expect(c2.querySelector("script")).toBeNull();
    u2();
  });

  it("is placed by the engine like any clip: hidden before its start, centred on its anchor", () => {
    const clip = rigClip({ start: 2 });
    const { container, unmount } = render(<StageCanvas doc={docWith(clip)} time={motionValue(0.5)} />);
    const box = container.querySelector("[data-clip-id='rig'] > div") as HTMLElement;
    expect(box.style.left).toBe("-300px");
    expect(box.style.top).toBe("-350px");
    expect(box.style.width).toBe("600px");
    unmount();
  });
});
