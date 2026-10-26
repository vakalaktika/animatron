import type { Clip, StudioDoc, TextClip } from "../types";
import { CARET_LINGER, caretAfter, glyphLook, glyphProgress, letterDelay, resolveTail, revealDuration, tailBase } from "./text";
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

describe("glyph reveals", () => {
  test("typing runs left to right whatever the direction, snapping each glyph on", () => {
    const t = text("a", { reveal: "typewriter", direction: "center", start: 1, letterStagger: 0.1 });
    expect(letterDelay(t, 0, 4)).toBe(0);
    expect(letterDelay(t, 3, 4)).toBeCloseTo(0.3);
    expect(glyphProgress(t, 1, 4, 1.09)).toBe(0);
    expect(glyphProgress(t, 1, 4, 1.1)).toBe(1);
    expect(glyphProgress(t, 0, 4, 0.99)).toBe(0);
  });

  test("letters ease in per glyph from the chosen end", () => {
    const t = text("a", { direction: "right", letterStagger: 0.1, letterDuration: 0.5 });
    expect(letterDelay(t, 3, 4)).toBe(0);
    expect(glyphProgress(t, 3, 4, 0.5)).toBe(1);
    expect(glyphProgress(t, 0, 4, 0.3)).toBe(0);
    expect(glyphProgress(t, 0, 4, 0.55)).toBeGreaterThan(0);
  });

  test("blur and mask move every glyph together over the reveal duration", () => {
    for (const reveal of ["blur", "mask"] as const) {
      const t = text("a", { reveal, revealDuration: 1 });
      expect(glyphProgress(t, 0, 4, 0.5)).toBe(glyphProgress(t, 3, 4, 0.5));
      expect(glyphProgress(t, 0, 4, 0)).toBe(0);
      expect(glyphProgress(t, 0, 4, 1)).toBe(1);
    }
  });

  test("pop and fade leave the glyphs to the clip transform", () => {
    expect(glyphProgress(text("a", { reveal: "pop" }), 0, 4, 0)).toBe(1);
    expect(glyphProgress(text("a", { reveal: "fade" }), 0, 4, 0)).toBe(1);
  });

  test("looks start hidden, blurred or dropped and settle to plain", () => {
    expect(glyphLook("blur", 0)).toMatchObject({ opacity: 0, blur: 12 });
    expect(glyphLook("mask", 0)).toMatchObject({ opacity: 1, drop: 1.05 });
    expect(glyphLook("letters", 0)).toMatchObject({ opacity: 0, rise: 8, blur: 2 });
    for (const reveal of ["letters", "typewriter", "blur", "mask", "pop", "fade"] as const) {
      expect(glyphLook(reveal, 1)).toEqual({ opacity: 1, rise: 0, drop: 0, blur: 0 });
    }
  });
});

describe("typing caret", () => {
  const t = text("a", { reveal: "typewriter", start: 1, letterStagger: 0.1 });

  test("sits after the latest letter while typing", () => {
    expect(caretAfter(t, 4, 0.9)).toBeNull();
    expect(caretAfter(t, 4, 1)).toBe(0);
    expect(caretAfter(t, 4, 1.15)).toBe(1);
  });

  test("blinks after the last letter, then goes", () => {
    expect(caretAfter(t, 4, 1.3)).toBe(3);
    expect(caretAfter(t, 4, 1.3 + 0.6)).toBeNull();
    expect(caretAfter(t, 4, 1.3 + 0.9)).toBe(3);
    expect(caretAfter(t, 4, 1.3 + CARET_LINGER)).toBeNull();
  });

  test("only typing has a caret", () => {
    expect(caretAfter(text("a"), 4, 0.1)).toBeNull();
    expect(caretAfter(t, 0, 1.1)).toBeNull();
  });

  test("typing lasts until the caret stops blinking", () => {
    expect(revealDuration(t)).toBeCloseTo(0.3 + CARET_LINGER);
    expect(clipDuration(t)).toBeCloseTo(0.3 + CARET_LINGER);
  });
});
