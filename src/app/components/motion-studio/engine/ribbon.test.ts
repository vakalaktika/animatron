import type { RibbonClip, SpriteClip } from "../types";
import { arrivalTime, nearestFraction, ribbonBands, ribbonCoat, ribbonHead, ribbonWindow } from "./ribbon";
import { clipDuration, loopsForever } from "./timing";
import { restTransformAt, transformAt } from "./transform";
import { DEFAULT_LINE_STYLE } from "./line";
import { DEFAULT_TRAIL } from "./trail";

const ribbon = (over: Partial<RibbonClip> = {}): RibbonClip => ({
  id: "r",
  name: "r",
  enabled: true,
  start: 1,
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
  colors: ["#111", "#222", "#333"],
  band: 8,
  duration: 2,
  ease: { name: "linear" },
  style: DEFAULT_LINE_STYLE,
  coat: { colors: ["#aaa", "#bbb", "#ccc"], every: 0, duration: 1 },
  ...over,
});

describe("ribbon paint-in", () => {
  it("draws one band per colour at the anchor and heads 0 → 1 over its duration", () => {
    const r = ribbon();
    expect(ribbonBands(r).map((b) => b.color)).toEqual(r.colors);
    expect(ribbonBands(r)[1].d.startsWith("M100.0 100.0")).toBe(true);
    expect(ribbonHead(r, 0)).toBe(0);
    expect(ribbonHead(r, 2)).toBeCloseTo(0.5);
    expect(ribbonHead(r, 9)).toBe(1);
    expect(ribbonWindow(r, 2)).toEqual({ tail: 0, length: 0.5 });
  });

  it("comet lights the last cometSeconds and holds the clip until the tail is gone", () => {
    const r = ribbon({ style: { ...DEFAULT_LINE_STYLE, motion: "comet", tail: 1 } });
    expect(ribbonWindow(r, 2.5)).toEqual({ tail: 0.25, length: 0.5 });
    expect(clipDuration(r)).toBe(3);
    expect(clipDuration(ribbon())).toBe(2);
  });

  it("arrivalTime inverts the easing", () => {
    const r = ribbon({ ease: { name: "inOut" } });
    const t = arrivalTime(r, 0.3);
    expect(ribbonHead(r, t)).toBeCloseTo(0.3, 3);
    expect(arrivalTime(r, 0)).toBeCloseTo(1, 3);
    expect(arrivalTime(r, 1)).toBeCloseTo(3, 3);
  });

  it("nearestFraction finds where a point sits along the ribbon", () => {
    expect(nearestFraction(ribbon(), 300, 100)).toBeCloseTo(0.5, 1);
    expect(nearestFraction(ribbon(), 500, 90)).toBe(1);
  });
});

describe("ribbon coats", () => {
  // Paint-in ends at t=3; sweeps every 4s taking 1s: 7–8 warm, 11–12 back to own.
  const r = ribbon({ coat: { colors: ["#aaa", "#bbb", "#ccc"], every: 4, duration: 1 } });

  it("rests in its own colours until the first sweep", () => {
    expect(ribbonCoat(r, 6.9)).toEqual({ resting: null, sweeping: null });
    // On the clock through both sweeps: 2s paint + 2 × 4s + the 1s sweep back.
    expect(clipDuration(r)).toBe(11);
    expect(loopsForever(r)).toBe(false);
    expect(loopsForever(ribbon({ loop: true, style: { ...DEFAULT_LINE_STYLE, motion: "comet" } }))).toBe(true);
  });

  it("sweeps the coat palette, rests in it, then sweeps its own colours back", () => {
    expect(ribbonCoat(r, 7.5)).toEqual({ resting: null, sweeping: { colors: r.coat.colors, progress: 0.5 } });
    expect(ribbonCoat(r, 9)).toEqual({ resting: r.coat.colors, sweeping: null });
    expect(ribbonCoat(r, 11.5)).toEqual({ resting: r.coat.colors, sweeping: { colors: r.colors, progress: 0.5 } });
    expect(ribbonCoat(r, 13)).toEqual({ resting: null, sweeping: null });
  });

  it("takes scheduled sweeps on top of the regular ones, and alone", () => {
    const scheduled = ribbon({ coat: { colors: ["#aaa", "#bbb", "#ccc"], every: 0, duration: 1, at: [5, 9] } });
    expect(ribbonCoat(scheduled, 4.9)).toEqual({ resting: null, sweeping: null });
    expect(ribbonCoat(scheduled, 5.5)).toEqual({ resting: null, sweeping: { colors: scheduled.coat.colors, progress: 0.5 } });
    expect(ribbonCoat(scheduled, 7)).toEqual({ resting: scheduled.coat.colors, sweeping: null });
    expect(ribbonCoat(scheduled, 9.5)).toEqual({ resting: scheduled.coat.colors, sweeping: { colors: scheduled.colors, progress: 0.5 } });
    expect(ribbonCoat(scheduled, 11)).toEqual({ resting: null, sweeping: null });
    // A scheduled sweep between regular ones shifts the parity for the rest.
    const both = { ...r, coat: { ...r.coat, at: [5] } };
    expect(ribbonCoat(both, 6.5)).toEqual({ resting: r.coat.colors, sweeping: null });
    expect(ribbonCoat(both, 7.5)).toEqual({ resting: r.coat.colors, sweeping: { colors: r.colors, progress: 0.5 } });
  });

  it("never coats a comet", () => {
    expect(ribbonCoat({ ...r, style: { ...DEFAULT_LINE_STYLE, motion: "comet" } }, 7.5)).toEqual({ resting: null, sweeping: null });
  });
});

describe("seating on a ribbon", () => {
  const face = (over: Partial<SpriteClip>): SpriteClip => ({
    id: "f",
    name: "f",
    enabled: true,
    start: 0,
    x: 0,
    y: 0,
    scale: 1,
    parentId: "r",
    followRotation: false,
    type: "sprite",
    source: { kind: "image", dataUrl: "", label: "", aspect: 1 },
    width: 50,
    path: [],
    duration: 1,
    ease: { name: "linear" },
    loop: false,
    bank: 0,
    autoFlip: false,
    scaleFrom: 1,
    fadeIn: 0,
    flap: { hz: 0, depth: 0 },
    landing: { squash: 0, settleFlaps: 0, foldAngle: 0, foldDuration: 0 },
    trail: DEFAULT_TRAIL,
    ...over,
  });

  it("threads a clip at a fraction, plus its own offset", () => {
    const doc = { version: 2 as const, name: "", stage: { width: 1, height: 1, background: "", transparent: false }, clips: [ribbon(), face({ along: 0.5, y: -20 })] };
    const w = transformAt(doc, "f", 5);
    expect(w.x).toBeCloseTo(300);
    expect(w.y).toBeCloseTo(80);
    expect(restTransformAt(doc, "f").x).toBeCloseTo(300);
  });

  it("rides the paint head when along is 'front', and rests at the end", () => {
    const doc = { version: 2 as const, name: "", stage: { width: 1, height: 1, background: "", transparent: false }, clips: [ribbon(), face({ along: "front" })] };
    expect(transformAt(doc, "f", 2).x).toBeCloseTo(300);
    expect(transformAt(doc, "f", 3).x).toBeCloseTo(500);
    expect(restTransformAt(doc, "f").x).toBeCloseTo(500);
  });

  it("ignores along when the parent is not a ribbon", () => {
    const doc = { version: 2 as const, name: "", stage: { width: 1, height: 1, background: "", transparent: false }, clips: [face({ id: "p", parentId: null, x: 10 }), face({ along: 0.5, parentId: "p", x: 5 })] };
    expect(transformAt(doc, "f", 1).x).toBeCloseTo(15);
  });
});
