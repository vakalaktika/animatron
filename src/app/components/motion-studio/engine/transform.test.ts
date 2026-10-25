import type { Clip, SpriteClip, StudioDoc, TextClip } from "../types";
import {
  composeTransforms,
  IDENTITY,
  restTransformAt,
  toLocalDelta,
  toLocalPoint,
  toWorldPoint,
  transformAt,
} from "./transform";
import { ancestorChain, attachableParents, descendantIds, loopMemberIds } from "./hierarchy";

const base = (id: string, over: Partial<Clip> = {}) => ({
  id,
  name: id,
  enabled: true,
  start: 0,
  x: 0,
  y: 0,
  scale: 1,
  parentId: null,
  followRotation: false,
  ...over,
});

function sprite(id: string, over: Partial<SpriteClip> = {}): SpriteClip {
  return {
    ...base(id),
    type: "sprite",
    source: { kind: "image", dataUrl: "", label: "img", aspect: 1 },
    trail: { enabled: false, mode: "paint", cometSeconds: 0.8, colors: [], band: 8, fadeOut: 0 },
    width: 100,
    path: [
      { x: -100, y: 0 },
      { x: 0, y: 0 },
    ],
    duration: 1,
    ease: { name: "linear" },
    loop: false,
    bank: 0,
    autoFlip: false,
    scaleFrom: 1,
    fadeIn: 0,
    flap: { hz: 0, depth: 0 },
    landing: { squash: 0, settleFlaps: 0, foldAngle: 0, foldDuration: 0 },
    ...over,
  };
}

function text(id: string, over: Partial<TextClip> = {}): TextClip {
  return {
    ...base(id),
    type: "text",
    text: "hi",
    font: "sans",
    fontSize: 20,
    container: { shape: "none", fill: "#fff", stroke: "#000", padding: { x: 0, y: 0 }, radius: 0 },
    tail: { mode: "none", side: "bottom", position: 0, length: 0 },
    reveal: "letters",
    revealDuration: 0.5,
    overshoot: 0,
    letterStagger: 0,
    letterDuration: 0.1,
    direction: "left",
    accentSuffix: "",
    accentColor: "#000",
    color: "#000",
    rule: false,
    ruleDelay: 0,
    ruleDuration: 0.1,
    ruleWidth: 10,
    ...over,
  };
}

function bubble(id: string, over: Partial<TextClip> = {}): TextClip {
  return text(id, {
    container: { shape: "speech", fill: "#fff", stroke: "#000", padding: { x: 28, y: 16 }, radius: 16 },
    tail: { mode: "auto", side: "bottom", position: 38, length: 15 },
    reveal: "pop",
    ...over,
  });
}

function doc(clips: Clip[]): StudioDoc {
  return {
    version: 2,
    name: "t",
    stage: { width: 1000, height: 1000, background: "#fff", transparent: false },
    clips,
  };
}

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 5);

describe("transformAt", () => {
  test("root clip with no parent is its own local transform", () => {
    const d = doc([text("a", { x: 40, y: 60, scale: 2 })]);
    const w = transformAt(d, "a", 3);
    expect(w).toEqual({ x: 40, y: 60, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1 });
  });

  test("one level: child offset is added to the parent's rest position", () => {
    const d = doc([
      sprite("bird", { x: 500, y: 300 }),
      bubble("b", { parentId: "bird", x: 50, y: -200 }),
    ]);
    const w = transformAt(d, "b", 5);
    near(w.x, 550);
    near(w.y, 100);
  });

  test("child follows the parent mid-flight, frame by frame", () => {
    const d = doc([
      sprite("bird", { x: 500, y: 300, start: 0, duration: 2 }),
      text("tag", { parentId: "bird", x: 10, y: 0 }),
    ]);
    // Linear ease, path from (-100, 0) to (0, 0): halfway the bird is at x = 450.
    const bird = transformAt(d, "bird", 1);
    near(bird.x, 450);
    const tag = transformAt(d, "tag", 1);
    near(tag.x, 460);
    near(tag.y, 300);
    const later = transformAt(d, "tag", 2);
    near(later.x, 510);
  });

  test("two levels compose through the middle clip", () => {
    const d = doc([
      text("root", { x: 100, y: 100, scale: 2 }),
      text("mid", { parentId: "root", x: 10, y: 0, scale: 1 }),
      text("leaf", { parentId: "mid", x: 5, y: 5 }),
    ]);
    const mid = transformAt(d, "mid", 0);
    near(mid.x, 120);
    near(mid.scaleX, 2);
    const leaf = transformAt(d, "leaf", 0);
    near(leaf.x, 130);
    near(leaf.y, 110);
    near(leaf.scaleX, 2);
  });

  test("followRotation off keeps the child upright while the parent banks", () => {
    const banked = sprite("bird", { x: 0, y: 0, bank: 1, duration: 1, path: [{ x: -100, y: -100 }, { x: 0, y: 0 }] });
    const d = doc([banked, text("kid", { parentId: "bird", x: 0, y: 0 }), text("wing", { parentId: "bird", x: 0, y: 0, followRotation: true })]);
    const parent = transformAt(d, "bird", 0.5);
    expect(parent.rotation).not.toBe(0);
    expect(transformAt(d, "kid", 0.5).rotation).toBe(0);
    near(transformAt(d, "wing", 0.5).rotation, parent.rotation);
  });

  test("child position rotates with the parent even when followRotation is off", () => {
    const parent = { x: 100, y: 100, rotation: 90, scaleX: 1, scaleY: 1, opacity: 1 };
    const local = { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const w = composeTransforms(parent, local, false);
    near(w.x, 100);
    near(w.y, 110);
    expect(w.rotation).toBe(0);
  });

  test("parent flip and fade are inherited", () => {
    const parent = { x: 0, y: 0, rotation: 0, scaleX: -1, scaleY: 1, opacity: 0.5 };
    const local = { x: 10, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1 };
    const w = composeTransforms(parent, local, false);
    near(w.x, -10);
    near(w.scaleX, -2);
    near(w.opacity, 0.5);
  });

  test("a hidden parent still positions its children", () => {
    const d = doc([sprite("bird", { x: 500, y: 300, enabled: false }), text("kid", { parentId: "bird", x: 1, y: 2 })]);
    const w = transformAt(d, "kid", 9);
    near(w.x, 501);
    near(w.y, 302);
  });

  test("a parent loop from a malformed doc terminates and stays finite", () => {
    const d = doc([text("a", { parentId: "b", x: 1, y: 1 }), text("b", { parentId: "a", x: 2, y: 2 })]);
    const w = transformAt(d, "a", 0);
    expect(Number.isFinite(w.x)).toBe(true);
    expect(Number.isFinite(w.y)).toBe(true);
    expect(ancestorChain(d, "a").map((c) => c.id)).toEqual(["a", "b"]);
  });

  test("a missing parent id behaves like a root", () => {
    const d = doc([text("orphan", { parentId: "gone", x: 7, y: 8 })]);
    expect(transformAt(d, "orphan", 0)).toMatchObject({ x: 7, y: 8 });
  });

  test("unknown clip id yields the identity", () => {
    expect(transformAt(doc([]), "nope", 0)).toEqual(IDENTITY);
  });

  test("a pop reveal scales the text clip from zero to its scale", () => {
    const d = doc([bubble("b", { start: 1, revealDuration: 1, scale: 2, overshoot: 0 })]);
    expect(transformAt(d, "b", 0.5).scaleX).toBe(0);
    near(transformAt(d, "b", 5).scaleX, 2);
    expect(transformAt(d, "b", 0.5).opacity).toBe(0);
  });

  test("a fade reveal only changes opacity", () => {
    const d = doc([text("f", { reveal: "fade", start: 0, revealDuration: 1 })]);
    expect(transformAt(d, "f", 0).opacity).toBe(0);
    expect(transformAt(d, "f", 0.5).scaleX).toBe(1);
    near(transformAt(d, "f", 2).opacity, 1);
  });

  test("restTransformAt ignores animation but keeps the chain", () => {
    const d = doc([sprite("bird", { x: 500, y: 300, duration: 2 }), text("kid", { parentId: "bird", x: 10, y: 0 })]);
    expect(restTransformAt(d, "kid")).toMatchObject({ x: 510, y: 300 });
  });
});

describe("frame conversion", () => {
  const frame = { x: 100, y: 50, rotation: 90, scaleX: 2, scaleY: 2, opacity: 1 };

  test("toLocalPoint inverts toWorldPoint", () => {
    const local = { x: 12, y: -7 };
    const back = toLocalPoint(frame, toWorldPoint(frame, local));
    near(back.x, local.x);
    near(back.y, local.y);
  });

  test("toLocalDelta undoes scale and rotation", () => {
    const d = toLocalDelta(frame, { x: 0, y: 20 });
    near(d.x, 10);
    near(d.y, 0);
  });

  test("a zero scale does not blow up", () => {
    const d = toLocalDelta({ ...IDENTITY, scaleX: 0 }, { x: 5, y: 5 });
    expect(Number.isFinite(d.x)).toBe(true);
  });
});

describe("hierarchy", () => {
  const d = doc([
    text("a"),
    text("b", { parentId: "a" }),
    text("c", { parentId: "b" }),
    text("d"),
  ]);

  test("descendantIds walks every level", () => {
    expect([...descendantIds(d, "a")].sort()).toEqual(["b", "c"]);
    expect(descendantIds(d, "d").size).toBe(0);
  });

  test("attachableParents hides self and descendants", () => {
    expect(attachableParents(d, "a").map((c) => c.id)).toEqual(["d"]);
    expect(attachableParents(d, "c").map((c) => c.id)).toEqual(["a", "b", "d"]);
  });

  test("loopMemberIds finds only the clips on the loop", () => {
    const looped = doc([
      text("a", { parentId: "b" }),
      text("b", { parentId: "a" }),
      text("c", { parentId: "a" }),
      text("self", { parentId: "self" }),
    ]);
    expect([...loopMemberIds(looped)].sort()).toEqual(["a", "b", "self"]);
    expect(loopMemberIds(d).size).toBe(0);
  });
});
