import type { Clip, StudioDoc, TextClip } from "@/app/components/motion-studio/types";
import { snapPoint, snapTargets } from "./snap";

function text(id: string, over: Partial<TextClip> = {}): TextClip {
  return {
    id,
    name: id,
    enabled: true,
    start: 0,
    x: 0,
    y: 0,
    scale: 1,
    parentId: null,
    followRotation: false,
    type: "text",
    text: "hi",
    font: "sans",
    fontSize: 20,
    container: { shape: "none", fill: "#fff", stroke: "#000", padding: { x: 0, y: 0 }, radius: 0 },
    tail: { mode: "none", side: "bottom", position: 0, length: 0 },
    reveal: "fade",
    revealDuration: 0.5,
    overshoot: 0,
    letterStagger: 0,
    letterDuration: 0.1,
    direction: "left",
    accentSuffix: "",
    accentColor: "#000",
    color: "#000",
    rule: false,
    ruleDelay: 0,
    ruleDuration: 0.1,
    ruleWidth: 10,
    ...over,
  };
}

const doc = (clips: Clip[]): StudioDoc => ({
  version: 2,
  name: "t",
  stage: { width: 1000, height: 600, background: "#fff", transparent: false },
  clips,
});

describe("snapping", () => {
  it("offers the stage centre and the other clips' anchors, never the moving clip or its riders", () => {
    const d = doc([text("a", { x: 100, y: 50 }), text("rider", { parentId: "a", x: 10, y: 10 }), text("b", { x: 700, y: 400 })]);
    const t = snapTargets(d, "a");
    expect(t.xs).toEqual([500, 700]);
    expect(t.ys).toEqual([300, 400]);
  });

  it("skips hidden clips", () => {
    const d = doc([text("a"), text("b", { x: 700, y: 400, enabled: false })]);
    expect(snapTargets(d, "a")).toEqual({ xs: [500], ys: [300] });
  });

  it("snaps each axis independently within the threshold and reports guides", () => {
    const targets = { xs: [500], ys: [300] };
    const near = snapPoint({ x: 494, y: 100 }, targets, 8);
    expect(near.point).toEqual({ x: 500, y: 100 });
    expect(near.guides).toEqual([{ axis: "x", at: 500 }]);
    const far = snapPoint({ x: 480, y: 100 }, targets, 8);
    expect(far.point).toEqual({ x: 480, y: 100 });
    expect(far.guides).toEqual([]);
  });

  it("picks the nearest of several candidates", () => {
    const snapped = snapPoint({ x: 0, y: 303 }, { xs: [], ys: [300, 305, 310] }, 8);
    expect(snapped.point.y).toBe(305);
  });
});
