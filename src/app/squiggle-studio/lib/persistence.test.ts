// @vitest-environment jsdom
import { loadSquiggles, saveSquiggles, SQUIGGLES_STORAGE_KEY, type SquiggleSession } from "./persistence";

const SESSION: SquiggleSession = {
  colors: ["#111", "#222", "#333"],
  band: 12,
  strokes: [
    { id: 1, pts: [[0, 0], [10, 5], [20, 0]], smoothed: 0 },
    { id: 3, pts: [[5, 5], [15, 15]], smoothed: 2 },
  ],
};

describe("squiggle persistence", () => {
  afterEach(() => window.localStorage.clear());

  it("round-trips a drawing session", () => {
    saveSquiggles(SESSION);
    expect(loadSquiggles()).toEqual(SESSION);
  });

  it("is empty before anything is saved", () => {
    expect(loadSquiggles()).toBeNull();
  });

  it("ignores junk and partial shapes rather than crashing the canvas", () => {
    window.localStorage.setItem(SQUIGGLES_STORAGE_KEY, "not json");
    expect(loadSquiggles()).toBeNull();
    window.localStorage.setItem(SQUIGGLES_STORAGE_KEY, JSON.stringify({ colors: ["#111", "#222", "#333"] }));
    expect(loadSquiggles()).toBeNull();
    window.localStorage.setItem(SQUIGGLES_STORAGE_KEY, JSON.stringify({ ...SESSION, strokes: [{ id: "x", pts: [], smoothed: 0 }] }));
    expect(loadSquiggles()).toBeNull();
    window.localStorage.setItem(SQUIGGLES_STORAGE_KEY, JSON.stringify({ ...SESSION, strokes: [{ id: 1, pts: [[1, 2, 3]], smoothed: 0 }] }));
    expect(loadSquiggles()).toBeNull();
  });

  it("refuses a palette below the three-colour minimum", () => {
    window.localStorage.setItem(SQUIGGLES_STORAGE_KEY, JSON.stringify({ ...SESSION, colors: ["#111", "#222"] }));
    expect(loadSquiggles()).toBeNull();
  });

  it("swallows a storage failure on save", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => saveSquiggles(SESSION)).not.toThrow();
    setItem.mockRestore();
  });
});
