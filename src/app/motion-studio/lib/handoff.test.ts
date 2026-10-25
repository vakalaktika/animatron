import type { Point } from "@/app/components/motion-studio/engine/rainbow";
import { flightFromSquiggle, HANDOFF_KEY, ribbonFromSquiggle, takeHandoff, writeHandoff } from "./handoff";

const STAGE = { width: 1920, height: 1080 };
// A wide, shallow wave drawn on a small canvas, 10px apart.
const WAVE: Point[] = Array.from({ length: 41 }, (_, i) => [i * 10, 100 + Math.sin(i / 4) * 40]);

describe("flightFromSquiggle", () => {
  const clip = flightFromSquiggle(WAVE, ["#111", "#222", "#333"], 8, STAGE);

  it("makes a Chippy sprite that paints the squiggle's colours behind it", () => {
    expect(clip.type).toBe("sprite");
    expect(clip.source).toEqual({ kind: "chippy" });
    expect(clip.trail.enabled).toBe(true);
    expect(clip.trail.colors).toEqual(["#111", "#222", "#333"]);
    expect(clip.loop).toBe(false);
  });

  it("anchors on the last point with an anchor-relative path ending at the origin", () => {
    const last = clip.path[clip.path.length - 1];
    expect(last).toEqual({ x: 0, y: 0 });
    expect(clip.path.length).toBeGreaterThan(4);
    expect(clip.path.length).toBeLessThanOrEqual(24);
  });

  it("scales the drawing to fit inside the stage, centred", () => {
    const xs = clip.path.map((p) => p.x + clip.x);
    const ys = clip.path.map((p) => p.y + clip.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(maxX).toBeLessThanOrEqual(STAGE.width);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(STAGE.height);
    // Centred horizontally: equal margins either side.
    expect(Math.abs(minX - (STAGE.width - maxX))).toBeLessThan(2);
    // 400px wide drawing on a 1920 stage fills 80% of the width.
    expect(maxX - minX).toBeCloseTo(STAGE.width * 0.8, 0);
    // Stripe width grows with the drawing.
    expect(clip.trail.band).toBeCloseTo(8 * (STAGE.width * 0.8) / 400, 5);
  });

  it("never ends on two crowded waypoints, so the landing heading is the drawing's", () => {
    const [a, b] = clip.path.slice(-2);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(20);
  });

  it("flies longer for a longer squiggle, within bounds", () => {
    const short = flightFromSquiggle([[0, 0], [10, 0]], ["#111"], 8, STAGE);
    expect(short.duration).toBe(1.5);
    const long = flightFromSquiggle(
      Array.from({ length: 200 }, (_, i) => [i * 10, (i % 2) * 400] as Point),
      ["#111"],
      8,
      STAGE,
    );
    expect(long.duration).toBe(8);
  });
});

describe("ribbonFromSquiggle", () => {
  const clip = ribbonFromSquiggle(WAVE, ["#111", "#222", "#333"], 8, STAGE);

  it("makes a ribbon in the squiggle's colours, anchored on its first point", () => {
    expect(clip.type).toBe("ribbon");
    expect(clip.colors).toEqual(["#111", "#222", "#333"]);
    expect(clip.points[0]).toEqual({ x: 0, y: 0 });
    expect(clip.points.length).toBeGreaterThan(4);
  });

  it("fits the stage like a flight does", () => {
    const xs = clip.points.map((p) => p.x + clip.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(STAGE.width * 0.8, 0);
  });
});

describe("handoff storage", () => {
  afterEach(() => window.sessionStorage.clear());

  it("round-trips a handoff and clears it once taken", () => {
    expect(writeHandoff({ kind: "artwork", svg: "<svg/>", label: "a.svg" })).toBe(true);
    expect(takeHandoff()).toEqual({ kind: "artwork", svg: "<svg/>", label: "a.svg" });
    expect(takeHandoff()).toBeNull();
  });

  it("ignores junk left under the key", () => {
    window.sessionStorage.setItem(HANDOFF_KEY, '{"kind":"flight"}');
    expect(takeHandoff()).toBeNull();
    window.sessionStorage.setItem(HANDOFF_KEY, "not json");
    expect(takeHandoff()).toBeNull();
  });

  it("says so when a handoff can't be stored", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(writeHandoff({ kind: "artwork", svg: "<svg/>", label: "a.svg" })).toBe(false);
    setItem.mockRestore();
  });
});
