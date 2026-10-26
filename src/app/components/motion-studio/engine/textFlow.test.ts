import type { Clip, RibbonClip, StudioDoc, TextClip } from "../types";
import { DEFAULT_LINE_STYLE } from "./line";
import { buildPath } from "./path";
import { flowDragDelta, flowGlyphs, flowRibbon, flowSeats, flowsOnRibbon } from "./textFlow";
import { transformAt } from "./transform";

const ribbon = (over: Partial<RibbonClip> = {}): RibbonClip => ({
  id: "r",
  name: "r",
  enabled: true,
  start: 0,
  x: 100,
  y: 100,
  scale: 1,
  parentId: null,
  followRotation: false,
  type: "ribbon",
  points: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
  ],
  loop: false,
  colors: ["#111"],
  band: 8,
  duration: 2,
  ease: { name: "linear" },
  style: DEFAULT_LINE_STYLE,
  coat: { colors: [], every: 0, duration: 1 },
  ...over,
});

const words = (over: Partial<TextClip> = {}): TextClip => ({
  id: "t",
  name: "t",
  enabled: true,
  start: 0,
  x: 0,
  y: 0,
  scale: 2,
  parentId: "r",
  followRotation: false,
  along: 0.5,
  flow: true,
  type: "text",
  text: "abcd",
  font: "sans",
  fontSize: 20,
  color: "#000",
  accentSuffix: "",
  accentColor: "#000",
  container: { shape: "none", fill: "#fff", stroke: "#000", padding: { x: 0, y: 0 }, radius: 0 },
  tail: { mode: "none", side: "bottom", position: 0, length: 0 },
  reveal: "pop",
  revealDuration: 1,
  overshoot: 0,
  letterStagger: 0.1,
  letterDuration: 0.5,
  direction: "left",
  rule: false,
  ruleDelay: 0,
  ruleDuration: 1,
  ruleWidth: 10,
  ...over,
});

const doc = (clips: Clip[]): StudioDoc => ({
  version: 2,
  name: "d",
  stage: { width: 1000, height: 1000, background: "#fff", transparent: false },
  clips,
});

const straight = buildPath(
  [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
  ],
  false,
);

describe("flowGlyphs", () => {
  test("centres the run on the pin, each glyph at its own middle", () => {
    const seats = flowGlyphs(straight, false, 0.5, "center", [10, 20, 10], 0, 0);
    expect(seats.map((s) => Math.round(s.x))).toEqual([185, 200, 215]);
    expect(seats.every((s) => s.onPath && Math.abs(s.y) < 1e-9 && s.angle === 0)).toBe(true);
  });

  test("an end-aligned run trails the pin, and shift slides it along", () => {
    const seats = flowGlyphs(straight, false, 0.5, "end", [10, 10], 30, 0);
    expect(seats.map((s) => Math.round(s.x))).toEqual([215, 225]);
  });

  test("lift pushes along the normal: negative is left of travel", () => {
    const right = flowGlyphs(straight, false, 0.5, "center", [10], 0, -20)[0];
    expect(right.y).toBeCloseTo(-20);
    const down = buildPath(
      [
        { x: 0, y: 0 },
        { x: 0, y: 400 },
      ],
      false,
    );
    const seat = flowGlyphs(down, false, 0.5, "center", [10], 0, -20)[0];
    expect(seat.x).toBeCloseTo(20);
    expect(seat.angle).toBeCloseTo(90);
  });

  test("glyphs past the ends of an open path are off it; a closed path wraps", () => {
    const seats = flowGlyphs(straight, false, 0, "center", [10, 10, 10, 10], 0, 0);
    expect(seats.map((s) => s.onPath)).toEqual([false, false, true, true]);
    const ring = buildPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      true,
    );
    expect(flowGlyphs(ring, true, 0, "center", [10, 10], 0, 0).every((s) => s.onPath)).toBe(true);
  });

  test("spacing is measured on the lifted line, so glyphs do not bunch inside a bend", () => {
    // Half a circle of radius 200, travelled left to right over the top.
    const arch = buildPath(
      [0, 1, 2, 3, 4].map((i) => ({ x: 200 - 200 * Math.cos((i * Math.PI) / 4), y: 200 - 200 * Math.sin((i * Math.PI) / 4) })),
      false,
    );
    // Positive lift is below: the inside of the bend, a circle of radius 140.
    const inside = flowGlyphs(arch, false, 0.5, "center", [20, 20], 0, 60);
    const gap = Math.hypot(inside[1].x - inside[0].x, inside[1].y - inside[0].y);
    expect(gap).toBeGreaterThan(19);
    expect(gap).toBeLessThan(20.5);
  });
});

describe("flowing text clips", () => {
  test("flows only with flow on, a ribbon parent and a seat", () => {
    const r = ribbon();
    expect(flowsOnRibbon(words(), r)).toBe(true);
    expect(flowsOnRibbon(words({ flow: false }), r)).toBe(false);
    expect(flowsOnRibbon(words({ along: null }), r)).toBe(false);
    expect(flowsOnRibbon(words(), words({ id: "p" }))).toBe(false);
    expect(flowRibbon(doc([r, words()]), words())).toBe(r);
    expect(flowRibbon(doc([r, words({ parentId: null })]), words({ parentId: null }))).toBeNull();
  });

  test("its frame stays on the ribbon anchor and ignores the pop scale", () => {
    const r = ribbon({ rotation: 30 });
    const t = words({ x: 40, y: -10 });
    const w = transformAt(doc([r, t]), "t", 0.5);
    expect(w.x).toBeCloseTo(100);
    expect(w.y).toBeCloseTo(100);
    expect(w.rotation).toBeCloseTo(30);
    expect(w.scaleX).toBeCloseTo(2);
  });

  test("a point seat centres on it; the front trails the paint head", () => {
    const r = ribbon();
    const plain = { scale: 1 };
    expect(flowSeats(words(plain), r, [10, 10], 0).map((s) => Math.round(s.x))).toEqual([195, 205]);
    const front = words({ ...plain, along: "front" });
    expect(flowSeats(front, r, [10, 10], 1).map((s) => Math.round(s.x))).toEqual([185, 195]);
    expect(flowSeats(front, r, [10, 10], 0).every((s) => !s.onPath)).toBe(true);
  });

  test("the clip's size spaces the glyphs as it sizes them", () => {
    const seats = flowSeats(words({ scale: 2 }), ribbon(), [10, 10], 0);
    expect(seats[1].x - seats[0].x).toBeCloseTo(20);
  });

  test("a lifted run stays level with its seat on the centreline through a bend", () => {
    // A long straight, then a tight turn down: lifting to the inside shortens the line after the seat only.
    const r = ribbon({ points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 450, y: 50 }, { x: 450, y: 400 }] });
    const centre = flowSeats(words({ scale: 1, along: 0.3 }), r, [2], 0)[0];
    const lifted = flowSeats(words({ scale: 1, along: 0.3, y: 40 }), r, [2], 0)[0];
    expect(lifted.x).toBeCloseTo(centre.x, 0);
    expect(lifted.y - centre.y).toBeCloseTo(40, 0);
  });

  test("a drag slides along the ribbon and lifts off it, whichever way it runs", () => {
    const down = ribbon({ points: [{ x: 0, y: 0 }, { x: 0, y: 400 }] });
    const d = flowDragDelta(words(), down, { x: 0, y: 30 }, 0);
    expect(d.x).toBeCloseTo(30);
    expect(d.y).toBeCloseTo(0);
    const side = flowDragDelta(words(), down, { x: -10, y: 0 }, 0);
    expect(side.x).toBeCloseTo(0);
    expect(side.y).toBeCloseTo(10);
  });
});
