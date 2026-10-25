import { applySavedOrder, dropIndexFromY, mergeOrder, reorder, rowPitches, slotTravel } from "./order";

describe("reorder", () => {
  test("moves an item forward to the target index", () => {
    expect(reorder(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  test("moves an item backward to the target index", () => {
    expect(reorder(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  test("returns a copy when from equals to", () => {
    const list = ["a", "b"];
    const next = reorder(list, 1, 1);
    expect(next).toEqual(list);
    expect(next).not.toBe(list);
  });

  test("clamps the target index into range", () => {
    expect(reorder(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
    expect(reorder(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
  });

  test("ignores an out-of-range source index", () => {
    expect(reorder(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("applySavedOrder", () => {
  test("orders known ids by the saved order", () => {
    expect(applySavedOrder(["a", "b", "c"], ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  test("appends ids missing from the saved order in their original order", () => {
    expect(applySavedOrder(["a", "b", "c", "d"], ["c", "a"])).toEqual(["c", "a", "b", "d"]);
  });

  test("drops saved ids that no longer exist", () => {
    expect(applySavedOrder(["a", "b"], ["zzz", "b", "a"])).toEqual(["b", "a"]);
  });
});

describe("dropIndexFromY", () => {
  const rows = [
    { top: 0, bottom: 20 },
    { top: 20, bottom: 40 },
    { top: 40, bottom: 60 },
  ];

  test("picks the row whose center is nearest the pointer", () => {
    expect(dropIndexFromY(rows, 5)).toBe(0);
    expect(dropIndexFromY(rows, 31)).toBe(1);
    expect(dropIndexFromY(rows, 100)).toBe(2);
  });

  test("returns 0 for an empty list", () => {
    expect(dropIndexFromY([], 10)).toBe(0);
  });
});

describe("mergeOrder", () => {
  test("keeps unseen ids in place and reorders the visible ones", () => {
    expect(mergeOrder(["placement", "path", "reveal", "text"], ["reveal", "placement"])).toEqual([
      "reveal",
      "path",
      "placement",
      "text",
    ]);
  });

  test("appends visible ids the saved order has not seen", () => {
    expect(mergeOrder(["placement"], ["build", "placement"])).toEqual(["build", "placement"]);
    expect(mergeOrder([], ["a", "b"])).toEqual(["a", "b"]);
  });

  test("round-trips through applySavedOrder", () => {
    const saved = mergeOrder(["placement", "motion", "path"], ["path", "placement", "motion"]);
    expect(applySavedOrder(["placement", "motion", "path"], saved)).toEqual(["path", "placement", "motion"]);
    expect(applySavedOrder(["placement", "reveal"], saved)).toEqual(["placement", "reveal"]);
  });
});

describe("uneven rows", () => {
  // Three rows of 20, 100, and 40px with a 4px gap.
  const rects = [
    { top: 0, bottom: 20 },
    { top: 24, bottom: 124 },
    { top: 128, bottom: 168 },
  ];

  test("rowPitches gives each row its own height plus the gap", () => {
    expect(rowPitches(rects)).toEqual([24, 104, 44]);
    expect(rowPitches([{ top: 10, bottom: 30 }])).toEqual([20]);
    expect(rowPitches([])).toEqual([]);
  });

  test("slotTravel sums the rows crossed, in either direction", () => {
    const pitches = rowPitches(rects);
    expect(slotTravel(pitches, 0, 2)).toBe(104 + 44);
    expect(slotTravel(pitches, 2, 0)).toBe(-(24 + 104));
    expect(slotTravel(pitches, 1, 1)).toBe(0);
  });
});
