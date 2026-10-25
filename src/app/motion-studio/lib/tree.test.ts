import type { Clip, LogoClip } from "@/app/components/motion-studio/types";
import { moveAmongSiblings, moveSubtree, normalizeOrder, projectDrop, subtreeIds, treeRows } from "./tree";

function clip(id: string, parentId: string | null = null): Clip {
  const logo: LogoClip = {
    id,
    name: id,
    enabled: true,
    start: 0,
    x: 0,
    y: 0,
    scale: 1,
    parentId,
    followRotation: false,
    type: "logo",
    size: 100,
    layerStagger: 0,
    layerDuration: 1,
    entryRotate: 0,
    entryScale: 0,
    overshoot: 0,
    traceDelay: 0,
    traceDuration: 1,
    fillDuration: 0,
  };
  return logo;
}

const ids = (list: Clip[]) => list.map((c) => c.id);

// logo, bird (with bubble), name; bubble is a child of bird.
const flat = [clip("logo"), clip("bird"), clip("bubble", "bird"), clip("name")];

describe("normalizeOrder", () => {
  test("keeps an already ordered list by identity", () => {
    expect(normalizeOrder(flat)).toBe(flat);
  });

  test("moves children directly after their parent", () => {
    const scattered = [clip("bubble", "bird"), clip("logo"), clip("bird")];
    expect(ids(normalizeOrder(scattered))).toEqual(["logo", "bird", "bubble"]);
  });

  test("orphans and loop members become roots", () => {
    const broken = [clip("a", "ghost"), clip("b", "c"), clip("c", "b")];
    const out = normalizeOrder(broken);
    expect(ids(out).sort()).toEqual(["a", "b", "c"]);
    expect(out.every((c) => c.parentId === null || c.id === "a")).toBe(true);
  });
});

describe("treeRows", () => {
  test("assigns depth and hides collapsed subtrees", () => {
    expect(treeRows(flat, new Set()).map((r) => `${r.clip.id}:${r.depth}${r.hasChildren ? "+" : ""}`)).toEqual([
      "logo:0",
      "bird:0+",
      "bubble:1",
      "name:0",
    ]);
    expect(ids(treeRows(flat, new Set(["bird"])).map((r) => r.clip))).toEqual(["logo", "bird", "name"]);
  });

  test("subtreeIds walks every level", () => {
    const deep = [...flat, clip("tail", "bubble")];
    expect([...subtreeIds(deep, "bird")].sort()).toEqual(["bubble", "tail"]);
  });
});

describe("projectDrop", () => {
  const rows = treeRows(flat, new Set());

  test("between two roots at depth 0 lands after the row above", () => {
    expect(projectDrop(rows, 1, 0)).toMatchObject({ parentId: null, afterId: "logo", depth: 0 });
  });

  test("pointer indented under a row makes it that row's first child", () => {
    expect(projectDrop(rows, 2, 1)).toMatchObject({ parentId: "bird", afterId: null, depth: 1 });
  });

  test("after a child, staying indented makes a following sibling", () => {
    expect(projectDrop(rows, 3, 1)).toMatchObject({ parentId: "bird", afterId: "bubble", depth: 1 });
  });

  test("depth is clamped to what the neighbours allow", () => {
    // Above is the bubble (depth 1): at most depth 2, and pulling left goes back to the root.
    expect(projectDrop(rows, 3, 5)?.depth).toBe(2);
    expect(projectDrop(rows, 3, 0)).toMatchObject({ parentId: null, afterId: "bird", depth: 0 });
    // The row below is the bubble at depth 1, so the gap above it can't go shallower than 1.
    expect(projectDrop(rows, 2, 0)?.depth).toBe(1);
  });

  test("top and bottom gaps", () => {
    expect(projectDrop(rows, 0, 3)).toMatchObject({ parentId: null, afterId: null, depth: 0 });
    expect(projectDrop(rows, 4, 0)).toMatchObject({ parentId: null, afterId: "name", depth: 0 });
    expect(projectDrop(rows, 9, 0)).toBeNull();
  });
});

describe("moveSubtree", () => {
  test("nests a root under another root as first child", () => {
    const out = moveSubtree(flat, "name", "bird", null);
    expect(ids(out)).toEqual(["logo", "bird", "name", "bubble"]);
    expect(out[2].parentId).toBe("bird");
  });

  test("pulls a child out to the root after a given sibling", () => {
    const out = moveSubtree(flat, "bubble", null, "name");
    expect(ids(out)).toEqual(["logo", "bird", "name", "bubble"]);
    expect(out[3].parentId).toBeNull();
  });

  test("carries the subtree along", () => {
    const deep = [...flat, clip("tail", "bubble")];
    const out = moveSubtree(deep, "bird", null, "name");
    expect(ids(out)).toEqual(["logo", "name", "bird", "bubble", "tail"]);
  });

  test("refuses a drop into its own subtree", () => {
    expect(moveSubtree(flat, "bird", "bubble", null)).toBe(flat);
    expect(moveSubtree(flat, "bird", "bird", null)).toBe(flat);
  });
});

describe("moveAmongSiblings", () => {
  test("swaps with the neighbouring sibling and stops at the ends", () => {
    expect(ids(moveAmongSiblings(flat, "name", -1))).toEqual(["logo", "name", "bird", "bubble"]);
    expect(ids(moveAmongSiblings(flat, "logo", 1))).toEqual(["bird", "bubble", "logo", "name"]);
    expect(moveAmongSiblings(flat, "logo", -1)).toBe(flat);
    expect(moveAmongSiblings(flat, "bubble", 1)).toBe(flat);
  });
});
