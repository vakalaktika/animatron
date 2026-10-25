import type { SpriteClip, StudioDoc } from "@/app/components/motion-studio/types";
import { attachedTextFor, detachRun, restoreRun, setRunText } from "./textRuns";

const svgSprite: SpriteClip = {
  id: "art",
  name: "art",
  enabled: true,
  start: 1,
  x: 500,
  y: 500,
  scale: 1,
  parentId: null,
  followRotation: false,
  type: "sprite",
  trail: { enabled: false, mode: "paint", cometSeconds: 0.8, colors: [], band: 8, fadeOut: 0 },
  source: {
    kind: "svg",
    markup: "<svg/>",
    label: "a.svg",
    aspect: 0.5,
    textRuns: [
      { id: "run-0", text: "Hello", detachedTo: null },
      { id: "run-1", text: "World", detachedTo: null },
    ],
  },
  width: 400,
  path: [],
  duration: 1,
  ease: { name: "linear" },
  loop: false,
  bank: 0,
  autoFlip: false,
  scaleFrom: 1,
  fadeIn: 0,
  flap: { hz: 0, depth: 0 },
  landing: { squash: 0, settleFlaps: 0, foldAngle: 0, foldDuration: 0 },
};

const doc: StudioDoc = {
  version: 2,
  name: "t",
  stage: { width: 1000, height: 1000, background: "#fff", transparent: false },
  clips: [svgSprite],
};

const runsOf = (d: StudioDoc) => {
  const c = d.clips.find((x) => x.id === "art");
  return c?.type === "sprite" && c.source.kind === "svg" ? c.source.textRuns : [];
};

describe("text runs", () => {
  test("setRunText edits one run", () => {
    expect(runsOf(setRunText(doc, svgSprite, "run-1", "Earth")).map((r) => r.text)).toEqual(["Hello", "Earth"]);
  });

  test("detachRun creates an attached text clip above the asset and hides the run", () => {
    const result = detachRun(doc, svgSprite, "run-0");
    if (!result) throw new Error("expected a detach");
    const text = result.doc.clips.find((c) => c.id === result.clipId);
    expect(text).toMatchObject({ type: "text", text: "Hello", parentId: "art", start: 1 });
    expect(text && text.y < 0).toBe(true);
    expect(runsOf(result.doc)[0].detachedTo).toBe(result.clipId);
    expect(detachRun(result.doc, result.doc.clips[0] as SpriteClip, "run-0")).toBeNull();
  });

  test("restoreRun removes the text clip and shows the run again", () => {
    const detached = detachRun(doc, svgSprite, "run-0");
    if (!detached) throw new Error("expected a detach");
    const restored = restoreRun(detached.doc, detached.doc.clips[0] as SpriteClip, "run-0");
    expect(restored.clips.map((c) => c.id)).toEqual(["art"]);
    expect(runsOf(restored)[0].detachedTo).toBeNull();
  });

  test("attachedTextFor rides the picture with a speech container", () => {
    const clip = attachedTextFor(svgSprite);
    expect(clip).toMatchObject({ type: "text", parentId: "art", container: { shape: "speech" } });
  });
});
