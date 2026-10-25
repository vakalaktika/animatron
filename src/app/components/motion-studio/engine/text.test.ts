import type { Clip, StudioDoc, TextClip } from "../types";
import { resolveTail, revealDuration, tailBase } from "./text";
import { clipDuration } from "./timing";

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
    text: "abcd",
    font: "sans",
    fontSize: 20,
    color: "#000",
    accentSuffix: "",
    accentColor: "#000",
    container: { shape: "speech", fill: "#fff", stroke: "#000", padding: { x: 28, y: 16 }, radius: 16 },
    tail: { mode: "auto", side: "bottom", position: 38, length: 15 },
    reveal: "letters",
    revealDuration: 0.6,
    overshoot: 0,
    letterStagger: 0.1,
    letterDuration: 0.5,
    direction: "left",
    rule: false,
    ruleDelay: 0,
    ruleDuration: 1,
    ruleWidth: 10,
    ...over,
  };
}

const doc = (clips: Clip[]): StudioDoc => ({
  version: 2,
  name: "t",
  stage: { width: 1000, height: 1000, background: "#fff", transparent: false },
  clips,
});

describe("resolveTail", () => {
  test("no container or tail mode none means no tail", () => {
    expect(resolveTail(doc([]), text("a", { container: { ...text("a").container, shape: "none" } }))).toBeNull();
    expect(resolveTail(doc([]), text("a", { tail: { ...text("a").tail, mode: "none" } }))).toBeNull();
  });

  test("auto hangs below the tip for a root clip", () => {
    expect(resolveTail(doc([]), text("a"))).toEqual({ side: "bottom", position: 38, length: 15 });
  });

  test("auto faces the parent", () => {
    const parent = text("p", { x: 500, y: 500 });
    const above = text("a", { parentId: "p", x: 0, y: -200 });
    const left = text("l", { parentId: "p", x: -300, y: 10 });
    const d = doc([parent, above, left]);
    expect(resolveTail(d, above)?.side).toBe("bottom");
    expect(resolveTail(d, left)?.side).toBe("right");
  });

  test("manual uses the stored tail", () => {
    const t = text("m", { tail: { mode: "manual", side: "left", position: 12, length: 30 } });
    expect(resolveTail(doc([t]), t)).toEqual({ side: "left", position: 12, length: 30 });
    expect(tailBase({ side: "left", position: 12, length: 30 })).toEqual({ x: 30, y: 0 });
  });
});

describe("text timing", () => {
  test("letters reveal spans the stagger plus one letter", () => {
    expect(revealDuration(text("a"))).toBeCloseTo(4 * 0.1 + 0.5);
    expect(revealDuration(text("a", { direction: "center" }))).toBeCloseTo(2 * 0.1 + 0.5);
  });

  test("pop and fade use the reveal duration, and the rule can extend it", () => {
    expect(clipDuration(text("a", { reveal: "pop" }))).toBeCloseTo(0.6);
    expect(clipDuration(text("a", { reveal: "fade", rule: true, ruleDelay: 1, ruleDuration: 1 }))).toBeCloseTo(2);
  });
});
