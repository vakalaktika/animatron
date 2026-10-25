import { DEFAULT_LINE_STYLE } from "./line";
import type { SpriteClip } from "../types";
import { clipDuration } from "./timing";
import { spriteProgress } from "./spriteTiming";
import { DEFAULT_TRAIL, shiftSpans, trailBands, trailCenterline, trailOpacity, trailProgress, trailWindow } from "./trail";

const sprite = (over: Partial<SpriteClip> = {}): SpriteClip => ({
  id: "s",
  name: "s",
  enabled: true,
  start: 1,
  x: 500,
  y: 300,
  scale: 1,
  parentId: null,
  followRotation: false,
  type: "sprite",
  source: { kind: "chippy" },
  width: 100,
  path: [
    { x: -400, y: 0 },
    { x: -200, y: -100 },
    { x: 0, y: 0 },
  ],
  duration: 2,
  ease: { name: "linear" },
  loop: false,
  bank: 0,
  autoFlip: false,
  scaleFrom: 1,
  fadeIn: 0,
  flap: { hz: 0, depth: 0 },
  landing: { squash: 0, settleFlaps: 0, foldAngle: 0, foldDuration: 0 },
  trail: { ...DEFAULT_TRAIL, enabled: true },
  ...over,
});

describe("trailBands", () => {
  it("draws one band per colour, positioned at the sprite's anchor", () => {
    const clip = sprite();
    const bands = trailBands(clip);
    expect(bands).toHaveLength(DEFAULT_TRAIL.colors.length);
    expect(bands.map((b) => b.color)).toEqual(DEFAULT_TRAIL.colors);
    // The centre band ends where the path does: at the anchor (500, 300).
    expect(bands[1].d).toMatch(/500\.0 300\.0$/);
  });

  it("is cached per clip object", () => {
    const clip = sprite();
    expect(trailBands(clip)).toBe(trailBands(clip));
    expect(trailBands({ ...clip })).not.toBe(trailBands(clip));
  });

  it("is empty for a path with fewer than two points", () => {
    expect(trailBands(sprite({ path: [{ x: 0, y: 0 }] }))).toEqual([]);
  });
});

describe("trailProgress", () => {
  it("follows the sprite's eased progress on a landing path", () => {
    const clip = sprite();
    expect(trailProgress(clip, 0)).toBe(0);
    expect(trailProgress(clip, 2)).toBeCloseTo(0.5);
    expect(trailProgress(clip, 5)).toBe(1);
  });

  it("paints over the first lap of a loop and then stays whole", () => {
    const clip = sprite({ loop: true });
    expect(trailProgress(clip, 2)).toBeCloseTo(0.5);
    expect(trailProgress(clip, 3.5)).toBe(1);
  });
});

describe("trailWindow", () => {
  it("lights the path from the start to the head in paint mode", () => {
    expect(trailWindow(sprite(), 2)).toEqual({ tail: 0, length: 0.5 });
  });

  it("follows the head by cometSeconds of travel in comet mode", () => {
    const comet = sprite({ trail: { ...DEFAULT_TRAIL, enabled: true, style: { ...DEFAULT_LINE_STYLE, motion: "comet", tail: 1 } } });
    // Linear 2s flight from t=1: at t=2 the head is at 0.5, the tail (1s ago) at 0.
    expect(trailWindow(comet, 2)).toEqual({ tail: 0, length: 0.5 });
    expect(trailWindow(comet, 2.5)).toEqual({ tail: 0.25, length: 0.5 });
    // After landing the head stays at 1 and the tail catches up until nothing is lit.
    expect(trailWindow(comet, 3.5).tail).toBeCloseTo(0.75);
    expect(trailWindow(comet, 3.5).length).toBeCloseTo(0.25);
    expect(trailWindow(comet, 4)).toEqual({ tail: 1, length: 0 });
    // A comet tail holds the clip on the clock until it is gone.
    expect(clipDuration(comet)).toBe(3);
  });

  it("wraps around the join on a loop", () => {
    const comet = sprite({ loop: true, trail: { ...DEFAULT_TRAIL, enabled: true, style: { ...DEFAULT_LINE_STYLE, motion: "comet", tail: 1 } } });
    // At t=3.2 the head is at phase 0.1; the tail (1s ago) is at 0.6, so the lit stretch wraps.
    const w = trailWindow(comet, 3.2);
    expect(w.tail).toBeCloseTo(0.6);
    expect(w.length).toBeCloseTo(0.5);
  });
});

describe("trail offset", () => {
  it("pulls the head back along the path by `along` pixels", () => {
    const plain = sprite();
    const tucked = sprite({ trail: { ...DEFAULT_TRAIL, enabled: true, offset: { along: 50, across: 0 } } });
    const length = trailCenterline(plain).length;
    expect(trailWindow(tucked, 2).length).toBeCloseTo(trailWindow(plain, 2).length - 50 / length, 5);
    // Nothing lit before the sprite has flown that far.
    expect(trailWindow(tucked, 1.001).length).toBe(0);
  });

  it("wraps the pull-back on a loop and clips it at the start otherwise", () => {
    const span = { tail: 0.1, length: 0.2, opacity: 1, palette: "own" as const, reverse: false, flat: false, symmetric: false };
    expect(shiftSpans([span], 0.3, true)[0].tail).toBeCloseTo(0.8);
    const clipped = shiftSpans([span], 0.2, false)[0];
    expect(clipped.tail).toBe(0);
    expect(clipped.length).toBeCloseTo(0.1);
    expect(shiftSpans([span], 0.5, false)).toEqual([]);
  });

  it("pushes a painted trail ahead without opening a gap at its start or running past the end", () => {
    const painted = { tail: 0, length: 0.5, opacity: 1, palette: "own" as const, reverse: false, flat: true, symmetric: false };
    expect(shiftSpans([painted], -0.1, false)[0]).toMatchObject({ tail: 0 });
    expect(shiftSpans([painted], -0.1, false)[0].length).toBeCloseTo(0.6);
    const whole = shiftSpans([{ ...painted, length: 0.95 }], -0.1, false)[0];
    expect(whole.tail).toBe(0);
    expect(whole.length).toBeCloseTo(1);
    // A comet moves ahead whole, stopping at the end of the path.
    const comet = { ...painted, tail: 0.85, length: 0.1, flat: false };
    const ahead = shiftSpans([comet], -0.1, false)[0];
    expect(ahead.tail).toBeCloseTo(0.95);
    expect(ahead.length).toBeCloseTo(0.05);
  });

  it("moves the whole trail sideways by `across` pixels", () => {
    const shifted = sprite({ trail: { ...DEFAULT_TRAIL, enabled: true, offset: { along: 0, across: 20 }, colors: ["#f00"] } });
    // On the final, rightward and level leg the right of travel is +y.
    const plain = trailCenterline(sprite({ trail: { ...DEFAULT_TRAIL, enabled: true, colors: ["#f00"] } }));
    const moved = trailCenterline(shifted);
    expect(moved.pts.at(-1)![1]).toBeGreaterThan(plain.pts.at(-1)![1] + 10);
    expect(trailBands(shifted)).toHaveLength(1);
  });
});

describe("trailOpacity", () => {
  it("is hidden before takeoff and fades in with the sprite", () => {
    const clip = sprite({ fadeIn: 1 });
    expect(trailOpacity(clip, 0.5)).toBe(0);
    expect(trailOpacity(clip, 1.5)).toBeCloseTo(0.5);
    expect(trailOpacity(clip, 4)).toBe(1);
  });

  it("fades out after landing when asked, and holds the clip on the clock", () => {
    const clip = sprite({ trail: { ...DEFAULT_TRAIL, enabled: true, fadeOut: 2 } });
    expect(trailOpacity(clip, 3)).toBe(1);
    expect(trailOpacity(clip, 4)).toBeCloseTo(0.5);
    expect(trailOpacity(clip, 5)).toBe(0);
    expect(clipDuration(clip)).toBe(4);
    expect(clipDuration(sprite())).toBe(2.45);
  });
});

describe("trail follows the sprite's own timing", () => {
  // A one-second hold at the middle waypoint: the sprite pauses there, so the
  // paint head must pause too, and the trail stays on the clock for the hold.
  const held = sprite({ path: [{ x: -400, y: 0 }, { x: -200, y: -100, hold: 1 }, { x: 0, y: 0 }] });

  it("keeps the paint head under a sprite that is holding at a waypoint", () => {
    const during = trailWindow(held, held.start + 1.5).length;
    const after = trailWindow(held, held.start + 1.9).length;
    expect(spriteProgress(held, held.start + 1.5)).toBeCloseTo(during, 6);
    expect(after).toBeCloseTo(during, 6);
    expect(trailWindow(held, held.start + 3).length).toBe(1);
  });

  it("counts the hold in the clip's duration and the comet's catch-up", () => {
    expect(clipDuration({ ...held, trail: { ...held.trail, enabled: true } })).toBeGreaterThanOrEqual(3);
    const comet = { ...held, trail: { ...held.trail, enabled: true, style: { ...DEFAULT_LINE_STYLE, motion: "comet" as const, tail: 0.5 } } };
    expect(clipDuration(comet)).toBeGreaterThanOrEqual(3.5);
  });
});
