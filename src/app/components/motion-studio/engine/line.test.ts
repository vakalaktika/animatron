import type { LineStyle } from "../types";
import { DEFAULT_LINE_STYLE, lineDuration, lineForever, lineFront, lineNeedsShape, lineSpans, type LineSubject } from "./line";
import { centerline, lineChunks, mixColour } from "./lineShape";

const subject: LineSubject = { start: 1, duration: 2, loop: false, ease: { name: "linear" } };
const looped: LineSubject = { ...subject, loop: true };
const style = (patch: Partial<LineStyle>): LineStyle => ({ ...DEFAULT_LINE_STYLE, ...patch });

describe("line spans", () => {
  it("is dark before the start", () => {
    expect(lineSpans(style({ motion: "paint" }), subject, 0.5)).toEqual([]);
  });

  it("paint lights from the start to the head and stays; the stretch is flat", () => {
    const [span] = lineSpans(style({ motion: "paint" }), subject, 2);
    expect(span).toMatchObject({ tail: 0, length: 0.5, flat: true });
    expect(lineSpans(style({ motion: "paint" }), subject, 9)[0].length).toBe(1);
    // On a loop it paints one lap and then stays whole.
    expect(lineSpans(style({ motion: "paint" }), looped, 9)[0].length).toBe(1);
  });

  it("comet keeps only the last `tail` seconds of travel, wrapping on a loop", () => {
    const comet = style({ motion: "comet", tail: 1 });
    expect(lineSpans(comet, subject, 2.5)[0]).toMatchObject({ tail: 0.25, length: 0.5 });
    // Head stops at the end; the tail keeps catching up.
    expect(lineSpans(comet, subject, 3.5)[0]).toMatchObject({ tail: 0.75, length: 0.25 });
    // Loop: at t=3.2 the head is at 0.1 and the tail (1s ago) at 0.6: wraps.
    const wrapped = lineSpans(comet, looped, 3.2)[0];
    expect(wrapped.tail).toBeCloseTo(0.6);
    expect(wrapped.length).toBeCloseTo(0.5);
  });

  it("erase paints, holds, retracts from its start, then is gone", () => {
    const erase = style({ motion: "erase", hold: 1 });
    expect(lineSpans(erase, subject, 2)[0]).toMatchObject({ length: 0.5, flat: true });
    expect(lineSpans(erase, subject, 3.5)[0]).toMatchObject({ length: 1, flat: true });
    expect(lineSpans(erase, subject, 5)[0]).toMatchObject({ tail: 0.5, length: 0.5, flat: false });
    expect(lineSpans(erase, subject, 6.5)).toEqual([]);
    expect(lineDuration(erase, subject)).toBe(5);
    // Looping, the cycle repeats.
    expect(lineSpans(erase, looped, 7)[0]).toMatchObject({ length: 0.5, flat: true });
  });

  it("pulse paints in, then runs an accent highlight along the line every `hold` seconds", () => {
    const pulse = style({ motion: "pulse", hold: 4, tail: 0.2 });
    expect(lineSpans(pulse, subject, 2)).toHaveLength(1);
    // Painted at t=3; the first pulse runs 3..5 and enters from the start.
    const [base, highlight] = lineSpans(pulse, subject, 4);
    expect(base).toMatchObject({ length: 1, flat: true, palette: "own" });
    expect(highlight.palette).toBe("accent");
    expect(highlight.tail).toBeCloseTo(0.4);
    expect(highlight.length).toBeCloseTo(0.2);
    // Between pulses only the base shows; the next starts at t=7.
    expect(lineSpans(pulse, subject, 6)).toHaveLength(1);
    expect(lineSpans(pulse, subject, 7.5)).toHaveLength(2);
    expect(lineForever(pulse, subject)).toBe(true);
  });

  it("lets a pulse run the whole line even when `hold` is shorter than the duration", () => {
    const pulse = style({ motion: "pulse", hold: 0.5, tail: 0.2 });
    // Painted at t=3; the pulse takes the full 2s duration to cross.
    const highlight = lineSpans(pulse, subject, 4.9)[1];
    expect(highlight.tail).toBeCloseTo(0.94);
    expect(highlight.tail + highlight.length).toBeCloseTo(1);
    // The next one starts right after, from the line's start.
    expect(lineSpans(pulse, subject, 5.5)[1].tail).toBeCloseTo(0.1);
  });

  it("ping-pong bounces a fixed stretch end to end and marks the way back as reversed", () => {
    const pp = style({ motion: "pingpong", tail: 0.2 });
    expect(lineSpans(pp, subject, 2)[0]).toMatchObject({ tail: 0.4, length: 0.2, reverse: false });
    const back = lineSpans(pp, subject, 4)[0];
    expect(back.tail).toBeCloseTo(0.4);
    expect(back.reverse).toBe(true);
    expect(lineFront(pp, subject, 2)).toBeCloseTo(0.6);
    expect(lineFront(pp, subject, 4)).toBeCloseTo(0.4);
  });

  it("dash marches equal dashes and gaps along the line", () => {
    const dash = style({ motion: "dash", tail: 0.1 });
    const spans = lineSpans(dash, subject, 1);
    expect(spans).toHaveLength(5);
    expect(spans.every((s) => s.length <= 0.1 + 1e-9)).toBe(true);
    expect(spans[0]).toMatchObject({ tail: 0, length: 0.1 });
    // Dashes travel the line in one duration: 0.1s on is 5% of the line.
    const moved = lineSpans(dash, subject, 1.1)[1];
    expect(moved.tail).toBeCloseTo(0.25);
  });

  it("unfold grows from the middle and is shaped at both ends", () => {
    const [span] = lineSpans(style({ motion: "unfold" }), subject, 2);
    expect(span).toMatchObject({ tail: 0.25, length: 0.5, symmetric: true, flat: true });
  });

  it("front follows the paint head, the comet head and the pulse", () => {
    expect(lineFront(style({ motion: "paint" }), subject, 2)).toBe(0.5);
    expect(lineFront(style({ motion: "comet", tail: 1 }), subject, 2)).toBe(0.5);
    expect(lineFront(style({ motion: "pulse", hold: 4, tail: 0.2 }), subject, 4)).toBeCloseTo(0.6);
  });

  it("knows what settles and what runs forever", () => {
    expect(lineForever(style({ motion: "paint" }), subject)).toBe(false);
    expect(lineForever(style({ motion: "comet" }), subject)).toBe(false);
    expect(lineForever(style({ motion: "comet" }), looped)).toBe(true);
    expect(lineForever(style({ motion: "paint", colour: "chase" }), subject)).toBe(true);
    expect(lineForever(style({ motion: "paint", wiggle: 10 }), subject)).toBe(true);
    expect(lineDuration(style({ motion: "comet", tail: 1 }), subject)).toBe(3);
    expect(lineDuration(style({ motion: "comet", tail: 1 }), looped)).toBe(2);
  });

  it("draws plain paint and hard comets as dashes, anything shaped per frame", () => {
    expect(lineNeedsShape(style({ motion: "paint" }))).toBe(false);
    expect(lineNeedsShape(style({ motion: "comet", taper: 0, fade: 0 }))).toBe(false);
    expect(lineNeedsShape(style({ motion: "comet" }))).toBe(true);
    expect(lineNeedsShape(style({ motion: "paint", nib: 0.5 }))).toBe(true);
    expect(lineNeedsShape(style({ motion: "paint", colour: "chase" }))).toBe(true);
    expect(lineNeedsShape(style({ motion: "paint", head: 0.4 }))).toBe(true);
  });

  it("shapes every motion with more than one lit stretch, even unshaped (the dash renderer draws one)", () => {
    expect(lineNeedsShape(style({ motion: "dash", taper: 0, fade: 0 }))).toBe(true);
    expect(lineNeedsShape(style({ motion: "pulse", taper: 0, fade: 0 }))).toBe(true);
  });

  it("shapes a glowing or hue-cycling line, since only the shaped renderer draws those", () => {
    expect(lineNeedsShape(style({ motion: "paint", glow: 0.5 }))).toBe(true);
    expect(lineNeedsShape(style({ motion: "paint", colour: "cycle" }))).toBe(true);
    expect(lineNeedsShape(style({ motion: "comet", taper: 0, fade: 0, glow: 0.5 }))).toBe(true);
  });
});

describe("line shape", () => {
  const straight = centerline(
    [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ],
    { x: 100, y: 100 },
    false,
  );

  it("resamples the line in the parent frame and measures it", () => {
    expect(straight.length).toBeCloseTo(400);
    expect(straight.pts[0]).toEqual([100, 100]);
    expect(straight.pts.at(-1)).toEqual([500, 100]);
  });

  it("a tapered comet thins and fades from tail to head", () => {
    const comet = style({ motion: "comet", tail: 1, taper: 1, fade: 1 });
    const chunks = lineChunks(straight, comet, subject, ["#ff0000"], 10, 3);
    // Lit from 0.5 to 1: 200px, 6px chunks, plus the round head.
    expect(chunks.length).toBeGreaterThan(30);
    const first = chunks[0];
    const late = chunks[chunks.length - 3];
    expect(first.opacity).toBeLessThan(0.1);
    expect(late.opacity).toBeGreaterThan(0.5);
    // Polygon height (y extent) grows toward the head.
    const height = (d: string) => {
      const ys = [...d.matchAll(/,(-?\d+\.?\d*)/g)].map((m) => Number(m[1]));
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(height(first.d)).toBeLessThan(height(late.d));
    expect(height(late.d)).toBeCloseTo(10.6, 0);
  });

  it("a flat painted line keeps its full width and opacity", () => {
    const chunks = lineChunks(straight, style({ motion: "paint", nib: 0.5 }), subject, ["#ff0000", "#00ff00"], 10, 3);
    expect(chunks.every((c) => c.opacity === 1)).toBe(true);
    expect(chunks.some((c) => c.color === "#00ff00")).toBe(true);
  });

  it("a pinched head narrows the whole bundle where it meets the object and is full further back", () => {
    const pinched = style({ motion: "paint", head: 0.2 });
    const chunks = lineChunks(straight, pinched, subject, ["#ff0000", "#00ff00", "#0000ff"], 10, 9);
    const height = (d: string) => {
      const ys = [...d.matchAll(/,(-?\d+\.?\d*)/g)].map((m) => Number(m[1]));
      return Math.max(...ys) - Math.min(...ys);
    };
    // Chunks come lane by lane: the first lane's first chunk is at the tail
    // (full) and its last body chunk is at the head (pinched to 20%).
    const perLane = chunks.length / 3;
    const tail = chunks[0];
    const nearHead = chunks[perLane - 2];
    expect(height(nearHead.d)).toBeLessThan(height(tail.d) * 0.4);
    // The lanes close up with the pinch: the outer lane's head sits near the centerline.
    const outerHead = chunks[chunks.length - 2];
    const ys = [...outerHead.d.matchAll(/,(-?\d+\.?\d*)/g)].map((m) => Number(m[1]));
    expect(Math.abs((Math.max(...ys) + Math.min(...ys)) / 2 - 100)).toBeLessThan(4);
  });

  it("echo copies are fainter", () => {
    const comet = style({ motion: "comet", tail: 1, echo: 1, fade: 0, taper: 0 });
    const chunks = lineChunks(straight, comet, subject, ["#ff0000"], 10, 3);
    expect(Math.min(...chunks.map((c) => c.opacity))).toBeLessThan(0.5);
    expect(Math.max(...chunks.map((c) => c.opacity))).toBe(1);
  });

  it("blends colours along the line toward the accent", () => {
    expect(mixColour("#000000", "#ffffff", 0.5)).toBe("#808080");
    const along = style({ motion: "comet", tail: 1, colour: "along", accent: ["#0000ff"], fade: 0, taper: 0 });
    const chunks = lineChunks(straight, along, subject, ["#ff0000"], 10, 3);
    // The tail half is the accent outright, not a mix; only near the head do the own colours return.
    expect(chunks[0].color).toBe("#0000ff");
    expect(chunks[Math.floor(chunks.length * 0.25)].color).toBe("#0000ff");
    expect(chunks[chunks.length - 1].color).toBe("#ff0000");
    // With several lanes the accent palette is fanned across the bundle, outer lane to outer lane.
    const fanned = style({ motion: "paint", colour: "along", accent: ["#0000ff", "#00ffff"] });
    const lanes = lineChunks(straight, fanned, subject, ["#ff0000", "#ff0000", "#ff0000"], 10, 9);
    const per = lanes.length / 3;
    expect(lanes[0].color).toBe("#0000ff");
    expect(lanes[per * 2].color).toBe("#00ffff");
  });

  it("chase slides the band colours along the line", () => {
    const chase = style({ motion: "paint", colour: "chase" });
    const chunks = lineChunks(straight, chase, subject, ["#ff0000", "#00ff00"], 10, 3);
    const colours = new Set(chunks.map((c) => c.color));
    expect(colours.size).toBe(2);
  });
});
