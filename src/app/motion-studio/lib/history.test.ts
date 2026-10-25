import { canRedo, canUndo, COALESCE_MS, createHistory, HISTORY_LIMIT, record, redo, reset, undo } from "./history";

describe("history", () => {
  it("records steps and walks back and forward through them", () => {
    let h = createHistory("a");
    h = record(h, "b");
    h = record(h, "c");
    expect(h.present).toBe("c");
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe("c");
    expect(redo(h)).toBe(h);
  });

  it("a new change after undo discards the redo branch", () => {
    let h = record(createHistory("a"), "b");
    h = undo(h);
    h = record(h, "z");
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe("a");
  });

  it("coalesces a gesture's successive changes into one step", () => {
    let h = createHistory({ x: 0 });
    h = record(h, { x: 1 }, { key: "move:a", now: 1000 });
    h = record(h, { x: 2 }, { key: "move:a", now: 1050 });
    h = record(h, { x: 3 }, { key: "move:a", now: 1100 });
    expect(h.past).toHaveLength(1);
    expect(undo(h).present).toEqual({ x: 0 });
  });

  it("starts a new step for a different gesture or after a pause", () => {
    let h = createHistory({ x: 0 });
    h = record(h, { x: 1 }, { key: "move:a", now: 1000 });
    h = record(h, { x: 2 }, { key: "move:b", now: 1010 });
    expect(h.past).toHaveLength(2);
    h = record(h, { x: 3 }, { key: "move:b", now: 1010 + COALESCE_MS + 1 });
    expect(h.past).toHaveLength(3);
  });

  it("an undo ends coalescing so the next drag is its own step", () => {
    let h = createHistory(0);
    h = record(h, 1, { key: "k", now: 0 });
    h = undo(h);
    h = record(h, 2, { key: "k", now: 10 });
    expect(h.past).toEqual([0]);
    expect(h.present).toBe(2);
  });

  it("ignores a change that is the same value", () => {
    const h = record(createHistory("a"), "b");
    expect(record(h, "b")).toBe(h);
  });

  it("keeps the stack bounded", () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = record(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
  });

  it("reset replaces the document with a clean history", () => {
    const h = reset(record(createHistory("a"), "b"), "fresh");
    expect(h.present).toBe("fresh");
    expect(canUndo(h)).toBe(false);
  });
});
