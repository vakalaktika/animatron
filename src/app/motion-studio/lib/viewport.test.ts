import { clampView, FIT_VIEW, isFit, MAX_VIEW_SCALE, MIN_VIEW_SCALE, pinchView, wheelView, zoomAbout } from "./viewport";

describe("zoomAbout", () => {
  test("keeps the point under the cursor in place", () => {
    const at = { x: 100, y: -40 };
    const view = zoomAbout(FIT_VIEW, 2, at);
    expect(view.scale).toBe(2);
    // A canvas point at screen `at` is (at - pan) / scale in canvas terms; it must not move.
    expect((at.x - view.x) / view.scale).toBeCloseTo(at.x);
    expect((at.y - view.y) / view.scale).toBeCloseTo(at.y);
  });

  test("stays within the zoom limits", () => {
    expect(zoomAbout(FIT_VIEW, 100, { x: 0, y: 0 }).scale).toBe(MAX_VIEW_SCALE);
    expect(zoomAbout(FIT_VIEW, 0.01, { x: 0, y: 0 }).scale).toBe(MIN_VIEW_SCALE);
  });
});

describe("pinchView", () => {
  test("spreading the fingers zooms about the point between them", () => {
    const view = pinchView(FIT_VIEW, [{ x: -10, y: 0 }, { x: 10, y: 0 }], [{ x: -30, y: 0 }, { x: 30, y: 0 }]);
    expect(view).toEqual({ scale: 3, x: 0, y: 0 });
  });

  test("moving both fingers together pans", () => {
    const view = pinchView(FIT_VIEW, [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 50, y: 20 }, { x: 60, y: 20 }]);
    expect(view).toEqual({ scale: 1, x: 50, y: 20 });
  });

  test("the canvas point between the fingers follows them while zooming", () => {
    const start = { scale: 1.5, x: 30, y: -10 };
    const from: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 40, y: 0 }];
    const to: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 100, y: 50 }, { x: 180, y: 50 }];
    const view = pinchView(start, from, to);
    const canvasPoint = (screen: { x: number; y: number }, v: typeof start) => ({ x: (screen.x - v.x) / v.scale, y: (screen.y - v.y) / v.scale });
    expect(canvasPoint({ x: 140, y: 50 }, view).x).toBeCloseTo(canvasPoint({ x: 20, y: 0 }, start).x);
    expect(canvasPoint({ x: 140, y: 50 }, view).y).toBeCloseTo(canvasPoint({ x: 20, y: 0 }, start).y);
  });
});

describe("wheelView and clampView", () => {
  test("a trackpad pinch zooms; scrolling pans", () => {
    // One mouse-wheel notch (about 100 px) is a gentle step, not a jump.
    expect(wheelView(FIT_VIEW, { x: 0, y: -100 }, true, { x: 0, y: 0 }).scale).toBeCloseTo(Math.exp(0.25));
    expect(wheelView({ scale: 2, x: 0, y: 0 }, { x: 10, y: 20 }, false, { x: 0, y: 0 })).toEqual({ scale: 2, x: -10, y: -20 });
  });

  test("never pans the canvas fully off screen", () => {
    const view = clampView({ scale: 1, x: 5000, y: -5000 }, { x: 800, y: 450 }, { x: 1000, y: 600 });
    expect(view.x).toBe(800 / 2 + 1000 / 2 - 48);
    expect(view.y).toBe(-(450 / 2 + 600 / 2 - 48));
    expect(isFit(FIT_VIEW)).toBe(true);
    expect(isFit(view)).toBe(false);
  });
});
