import type { TextClip } from "../types";
import { describe, expect, test } from "vitest";
import { tweenTo } from "./tween";
import { makeText } from "@/app/motion-studio/presets";
import { propValue, sanitizeKeys } from "./keys";

const clip = () => makeText({ id: "title", x: 100, y: 120, start: 1 });
describe("sparse object tween authoring", () => {
  test("authors just two keys per changed property and keeps other tracks", () => {
    const source: TextClip = { ...clip(), keys: { opacity: [{ time: 0, value: 0.5, ease: { name: "linear" as const } }] } };
    const next = tweenTo(source, 2, 2, { x: 300, rotation: 20 }, { name: "inOut" });
    expect(next.keys?.x).toEqual([{ time: 0, value: 100, ease: { name: "inOut" } }, { time: 1, value: 100, ease: { name: "inOut" } }, { time: 3, value: 300, ease: { name: "inOut" } }]);
    expect(next.keys?.rotation).toHaveLength(3);
    expect(next.keys?.opacity).toEqual(source.keys!.opacity);
    expect(propValue(next, "x", 3)).toBeCloseTo(200);
    expect(source.keys).not.toHaveProperty("x");
  });
  test("retains keys outside the interval, replacing only the requested segment", () => {
    const source: TextClip = { ...clip(), keys: { x: [0, 1, 2, 4].map(time => ({ time, value: time * 100, ease: { name: "linear" as const } })) } };
    const next = tweenTo(source, 2, 2, { x: 500 }, { name: "smoothOut" });
    expect(next.keys?.x?.map(k => k.time)).toEqual([0, 1, 3, 4]);
    expect(next.keys?.x?.at(-1)).toEqual(source.keys!.x!.at(-1));
  });
  test("ignores unchanged properties and rejects invalid intervals or destinations", () => {
    expect(tweenTo(clip(), 1, 2, { x: 100 }, { name: "inOut" })).toEqual(clip());
    for (const duration of [0, -1, Infinity, 601]) expect(() => tweenTo(clip(), 1, duration, { x: 300 }, { name: "inOut" })).toThrow();
    expect(() => tweenTo(clip(), 1, 2, { x: NaN }, { name: "inOut" })).toThrow();
    expect(() => tweenTo(clip(), 0, 2, { x: 300 }, { name: "inOut" })).toThrow();
  });
});

test("tween endpoints respect importer collision tolerance", () => {
 const source: TextClip = { ...clip(), keys: {x:[0,0.996,3].map(time=>({time,value:time*100,ease:{name:"linear"}}))} };
 const next=tweenTo(source,2,1,{x:500},{name:"inOut"});
 expect(sanitizeKeys(JSON.parse(JSON.stringify(next.keys)))).toEqual(next.keys);
});
