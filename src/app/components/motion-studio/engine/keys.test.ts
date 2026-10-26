import type { Clip, LogoClip, RibbonClip, StudioDoc } from "../types";
import {
  hasKeys,
  keyableProps,
  keyEaseAt,
  keyValue,
  placementAt,
  propKeyTimes,
  propValue,
  removePropKey,
  restValue,
  retimedPropKeyTime,
  retimePropKeys,
  sanitizeKeys,
  setKeyEaseAt,
  setPropAt,
  upsertPropKey,
} from "./keys";
import { DEFAULT_LINE_STYLE } from "./line";
import { clipDuration } from "./timing";
import { restTransformAt, transformAt } from "./transform";

const logo = (over: Partial<LogoClip> = {}): LogoClip => ({
  id: "l",
  name: "l",
  enabled: true,
  start: 1,
  x: 100,
  y: 200,
  scale: 1,
  parentId: null,
  followRotation: false,
  type: "logo",
  size: 100,
  layerStagger: 0.1,
  layerDuration: 0.4,
  entryRotate: 0,
  entryScale: 0,
  overshoot: 0,
  traceDelay: 0,
  traceDuration: 0.5,
  fillDuration: 0.5,
  ...over,
});

const linear = { name: "linear" } as const;
const doc = (clips: Clip[]): StudioDoc => ({
  version: 2,
  name: "d",
  stage: { width: 1000, height: 1000, background: "#fff", transparent: false },
  clips,
});

describe("keyValue", () => {
  const keys = [
    { time: 1, value: 10, ease: linear },
    { time: 3, value: 30 },
    { time: 4, value: 0 },
  ];

  test("holds the first key before it and the last after it", () => {
    expect(keyValue(keys, 0)).toBe(10);
    expect(keyValue(keys, 9)).toBe(0);
  });

  test("eases between keys by the earlier key's easing", () => {
    expect(keyValue(keys, 2)).toBeCloseTo(20);
    // The default in / out is symmetric: halfway in time is halfway in value.
    expect(keyValue(keys, 3.5)).toBeCloseTo(15);
    expect(keyValue(keys, 3.25)).toBeGreaterThan(22.5);
  });
});

describe("keyed placement", () => {
  const animated = logo({ keys: { x: [{ time: 0, value: 0, ease: linear }, { time: 2, value: 400, ease: linear }], opacity: [{ time: 1, value: 0.5 }] } });

  test("keyed properties come from their keys, measured from the clip start", () => {
    expect(propValue(animated, "x", 2)).toBeCloseTo(200);
    expect(propValue(animated, "y", 2)).toBe(200);
    expect(placementAt(animated, 0).x).toBe(0);
    expect(placementAt(animated, 9).opacity).toBe(0.5);
  });

  test("the transform follows the keys; the rest pose sits on the last key", () => {
    expect(transformAt(doc([animated]), "l", 2).x).toBeCloseTo(200);
    expect(transformAt(doc([animated]), "l", 2).opacity).toBeCloseTo(0.5);
    expect(restTransformAt(doc([animated]), "l").x).toBe(400);
    expect(restValue(animated, "y")).toBe(200);
  });

  test("a child rides its keyframed parent", () => {
    const child = logo({ id: "c", parentId: "l", x: 10, y: 0, keys: undefined });
    expect(transformAt(doc([animated, child]), "c", 2).x).toBeCloseTo(210);
  });

  test("the clip lasts until its last key", () => {
    const short = logo({ keys: { scale: [{ time: 0, value: 1 }, { time: 5, value: 2 }] } });
    expect(clipDuration(short)).toBe(5);
    expect(clipDuration(logo())).toBeLessThan(5);
  });

  test("ribbons key their place and opacity only", () => {
    expect(keyableProps({ type: "ribbon" } as RibbonClip)).toEqual(["x", "y", "opacity"]);
    expect(keyableProps(logo())).toHaveLength(5);
  });

  test("a ribbon's seat moves with its keyed place", () => {
    const ribbon: RibbonClip = {
      id: "r", name: "r", enabled: true, start: 0, x: 0, y: 0, scale: 1, parentId: null, followRotation: false,
      type: "ribbon", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], loop: false, colors: ["#000"], band: 4, duration: 1,
      ease: linear, style: DEFAULT_LINE_STYLE, coat: { colors: [], every: 0, duration: 1 },
      keys: { y: [{ time: 0, value: 0, ease: linear }, { time: 1, value: 50 }] },
    };
    const seated = logo({ id: "s", parentId: "r", along: 0.5, x: 0, y: 0, start: 0 });
    expect(transformAt(doc([ribbon, seated]), "s", 1).y).toBeCloseTo(50);
  });
});

describe("editing keys", () => {
  test("upsert slots a key in order and updates one at the same time", () => {
    let c = upsertPropKey(logo(), "x", 2, 50);
    c = upsertPropKey(c, "x", 1, 20);
    c = upsertPropKey(c, "x", 2.001, 60);
    expect(c.keys?.x?.map((k) => [k.time, k.value])).toEqual([[1, 20], [2, 60]]);
    expect(hasKeys(c)).toBe(true);
  });

  test("new keys land on the hundredth, so float playheads still hit them", () => {
    const c = setPropAt(upsertPropKey(logo(), "x", 0, 0), "x", 4.0 + 1e-9, 5);
    expect(c.keys?.x?.[1].time).toBe(3);
    expect(upsertPropKey(logo(), "y", 1.23456, 1).keys?.y?.[0].time).toBe(1.23);
  });

  test("set at a time keys an animated property and sets a still one", () => {
    const still = setPropAt(logo(), "rotation", 3, 45);
    expect(still.rotation).toBe(45);
    expect(still.keys).toBeUndefined();
    const keyed = setPropAt(upsertPropKey(logo(), "rotation", 0, 0), "rotation", 3, 45);
    expect(keyed.keys?.rotation?.map((k) => [k.time, k.value])).toEqual([[0, 0], [2, 45]]);
  });

  test("removing the last key stops the animation at its value", () => {
    const one = upsertPropKey(logo(), "opacity", 1, 0.3);
    const gone = removePropKey(one, "opacity", 1);
    expect(gone.keys).toBeUndefined();
    expect(gone.opacity).toBe(0.3);
    const two = upsertPropKey(one, "opacity", 2, 1);
    expect(removePropKey(two, "opacity", 1).keys?.opacity).toHaveLength(1);
    expect(removePropKey(two, "opacity", 5)).toBe(two);
  });

  test("key times merge across properties; retiming moves them together within their neighbours", () => {
    let c = upsertPropKey(logo(), "x", 1, 0);
    c = upsertPropKey(c, "y", 1, 0);
    c = upsertPropKey(c, "x", 2, 10);
    c = upsertPropKey(c, "y", 0.5, 5);
    expect(propKeyTimes(c)).toEqual([0.5, 1, 2]);
    expect(retimedPropKeyTime(c, 1, 3)).toBeCloseTo(1.99);
    expect(retimedPropKeyTime(c, 1, 0)).toBeCloseTo(0.51);
    const moved = retimePropKeys(c, 1, 1.5);
    expect(moved.keys?.x?.[0].time).toBe(1.5);
    expect(moved.keys?.y?.[1].time).toBe(1.5);
  });

  test("easing is read and set for every key at a time", () => {
    let c = upsertPropKey(logo(), "x", 1, 0);
    c = upsertPropKey(c, "scale", 1, 2);
    expect(keyEaseAt(c, 1)).toEqual({ name: "inOut" });
    c = setKeyEaseAt(c, 1, { name: "snap" });
    expect(c.keys?.x?.[0].ease).toEqual({ name: "snap" });
    expect(c.keys?.scale?.[0].ease).toEqual({ name: "snap" });
    expect(keyEaseAt(c, 4)).toBeNull();
  });
});

describe("sanitizeKeys", () => {
  test("keeps only well-formed keys of known properties, sorted and deduplicated", () => {
    const keys = sanitizeKeys({
      x: [{ time: 2, value: 1 }, { time: -1, value: 0 }, { time: 2, value: 9 }, { time: "a", value: 1 }, null],
      colour: [{ time: 0, value: 1 }],
      y: "nope",
      opacity: [{ time: 1, value: Number.NaN }],
    });
    expect(keys?.x?.map((k) => [k.time, k.value])).toEqual([[0, 0], [2, 1]]);
    expect(Object.keys(keys ?? {})).toEqual(["x"]);
    expect(sanitizeKeys(undefined)).toBeUndefined();
    expect(sanitizeKeys({ x: [] })).toBeUndefined();
  });
});
