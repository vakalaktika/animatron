import { restTransformAt } from "@/app/components/motion-studio/engine/transform";
import type { Clip, StudioDoc, TextClip } from "@/app/components/motion-studio/types";
import { deleteClip, nudgeClip, reparentClip } from "./attach";
import { normalizeClip, normalizeDoc } from "./migrate";

function text(id: string, over: Partial<TextClip> = {}): TextClip {
  return {
    id,
    name: id,
    enabled: true,
    start: 0,
    x: 0,
    y: 0,
    scale: 1,
    parentId: null,
    followRotation: false,
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

function doc(clips: Clip[]): StudioDoc {
  return {
    version: 2,
    name: "t",
    stage: { width: 1000, height: 1000, background: "#fff", transparent: false },
    clips,
  };
}

const find = (d: StudioDoc, id: string) => d.clips.find((c) => c.id === id) as Clip;

describe("reparentClip", () => {
  test("attaching keeps the clip where it was on stage", () => {
    const d = doc([text("p", { x: 100, y: 100, scale: 2 }), text("c", { x: 140, y: 100 })]);
    const next = reparentClip(d, "c", "p");
    expect(find(next, "c")).toMatchObject({ parentId: "p", x: 20, y: 0 });
    expect(restTransformAt(next, "c")).toMatchObject({ x: 140, y: 100 });
  });

  test("detaching bakes the absolute position back in", () => {
    const d = doc([text("p", { x: 100, y: 100 }), text("c", { parentId: "p", x: 5, y: 5 })]);
    const next = reparentClip(d, "c", null);
    expect(find(next, "c")).toMatchObject({ parentId: null, x: 105, y: 105 });
  });

  test("refuses itself and its descendants", () => {
    const d = doc([text("a"), text("b", { parentId: "a" })]);
    expect(reparentClip(d, "a", "a")).toBe(d);
    expect(reparentClip(d, "a", "b")).toBe(d);
  });
});

describe("deleteClip", () => {
  test("children stay put and become roots", () => {
    const d = doc([text("p", { x: 100, y: 50 }), text("c", { parentId: "p", x: 10, y: 10 }), text("other")]);
    const next = deleteClip(d, "p");
    expect(next.clips.map((c) => c.id)).toEqual(["c", "other"]);
    expect(find(next, "c")).toMatchObject({ parentId: null, x: 110, y: 60 });
  });
});

describe("nudgeClip", () => {
  test("a keyframed position gets a key where the playhead is", () => {
    const keys = { x: [{ time: 0, value: 0 }, { time: 2, value: 100 }] };
    const next = find(nudgeClip(doc([text("a", { x: 5, y: 7, keys })]), "a", { x: 10, y: 3 }, 2), "a");
    expect(next.keys?.x?.map((k) => [k.time, k.value])).toEqual([[0, 0], [2, 110]]);
    expect(next.x).toBe(5);
    expect(next.y).toBe(10);
    const vertical = find(nudgeClip(doc([text("b", { keys })]), "b", { x: 0, y: 3 }, 1), "b");
    expect(vertical.keys?.x).toHaveLength(2);
  });

  test("a root clip moves by the raw delta", () => {
    const next = nudgeClip(doc([text("a", { x: 1, y: 1 })]), "a", { x: 4, y: 6 }, 0);
    expect(find(next, "a")).toMatchObject({ x: 5, y: 7 });
  });

  test("a child of a scaled parent moves by the delta divided by the scale", () => {
    const d = doc([text("p", { scale: 2 }), text("c", { parentId: "p", x: 0, y: 0 })]);
    const next = nudgeClip(d, "c", { x: 10, y: -4 }, 0);
    expect(find(next, "c")).toMatchObject({ x: 5, y: -2 });
  });
});

describe("normalize", () => {
  test("fills attachment defaults on clips from before the feature", () => {
    const { parentId, followRotation, ...old } = text("a");
    void parentId;
    void followRotation;
    expect(normalizeClip(old as Clip)).toMatchObject({ parentId: null, followRotation: false });
  });

  test("migrates a v1 bubble into speech text at the tail tip", () => {
    const v1 = { id: "b", name: "Bubble", enabled: true, start: 4, x: 999, y: 999, scale: 1, type: "bubble", text: "Hi", attachTo: "bird", offsetX: 50, offsetY: -200, duration: 0.6, overshoot: 1.7, fontSize: 32 };
    const out = normalizeClip(v1 as unknown as Clip);
    expect(out).toMatchObject({
      type: "text",
      parentId: "bird",
      x: 50 + 38,
      y: -200 + 15,
      font: "serif",
      fontSize: 32,
      reveal: "pop",
      revealDuration: 0.6,
      overshoot: 1.7,
      container: { shape: "speech" },
    });
    expect("attachTo" in out).toBe(false);
    const loose = { ...v1, attachTo: null, x: 100, y: 300 };
    expect(normalizeClip(loose as unknown as Clip)).toMatchObject({ parentId: null, x: 150 + 38, y: 100 + 15 });
  });

  test("fills container and reveal defaults on v1 text", () => {
    const { font, container, tail, reveal, revealDuration, overshoot, ...v1 } = text("t");
    void font; void container; void tail; void reveal; void revealDuration; void overshoot;
    expect(normalizeClip(v1 as Clip)).toMatchObject({ font: "sans", reveal: "letters", container: { shape: "none" } });
  });

  test("normalizeDoc stamps the current version", () => {
    const { doc: fixed } = normalizeDoc({ ...doc([text("a")]), version: 1 });
    expect(fixed.version).toBe(2);
  });

  test("detaches loop members and reports it", () => {
    const { doc: fixed, warnings } = normalizeDoc(doc([text("a", { parentId: "b" }), text("b", { parentId: "a" }), text("c", { parentId: "a" })]));
    expect(find(fixed, "a").parentId).toBeNull();
    expect(find(fixed, "b").parentId).toBeNull();
    expect(find(fixed, "c").parentId).toBe("a");
    expect(warnings).toHaveLength(2);
  });

  test("drops parents that are not in the file", () => {
    const { doc: fixed, warnings } = normalizeDoc(doc([text("a", { parentId: "ghost" })]));
    expect(find(fixed, "a").parentId).toBeNull();
    expect(warnings).toHaveLength(1);
  });
});

describe("keyed children", () => {
  test("deleting a parent keeps a keyed child's animation where it was on stage", () => {
    const parent = text("p", { x: 500, y: 0 });
    const child = text("c", { parentId: "p", x: 0, y: 0, keys: { x: [{ time: 0, value: 0 }, { time: 2, value: 200 }] } });
    const before = restTransformAt(doc([parent, child]), "c").x;
    const after = find(deleteClip(doc([parent, child]), "p"), "c");
    expect(after.keys?.x?.map((k) => k.value)).toEqual([500, 700]);
    expect(restTransformAt(doc([after]), "c").x).toBeCloseTo(before);
  });

  test("reparenting a keyed clip re-bases its keys in the new frame", () => {
    const parent = text("p", { x: 300, y: 0 });
    const loose = text("c", { keys: { x: [{ time: 0, value: 100 }, { time: 2, value: 400 }] } });
    const next = find(reparentClip(doc([parent, loose]), "c", "p"), "c");
    expect(next.keys?.x?.map((k) => k.value)).toEqual([-200, 100]);
  });
});

describe("keyframes from files", () => {
  test("normalizeClip keeps good keys and drops bad ones", () => {
    const raw = { ...text("a"), keys: { x: [{ time: 1, value: 3 }, { time: "x", value: 1 }], bogus: [] } } as unknown as Clip;
    expect(normalizeClip(raw).keys).toEqual({ x: [{ time: 1, value: 3, ease: { name: "inOut" } }] });
    expect("keys" in normalizeClip(text("b"))).toBe(false);
  });
});

describe("untrusted documents", () => {
  test("a picture pointing at the web instead of carrying its data is removed, with a warning", () => {
    const remote = { id: "r", name: "Tracker", type: "sprite", source: { kind: "image", dataUrl: "https://example.com/pixel.png", label: "p", aspect: 1 } };
    const inline = { id: "i", name: "Kept", type: "sprite", source: { kind: "image", dataUrl: "data:image/png;base64,AAAA", label: "p", aspect: 1 } };
    const { doc: fixed, warnings } = normalizeDoc({ ...doc([]), clips: [remote, inline] as unknown as Clip[] });
    expect(fixed.clips.map((c) => c.id)).toEqual(["i"]);
    expect(warnings.join(" ")).toContain("Tracker");
  });
});
