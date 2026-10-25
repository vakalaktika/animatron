import { DEFAULT_LINE_STYLE } from "./line";
import type { Clip, LogoClip, LottieClip, RibbonClip, SpriteClip } from "../types";
import { capabilities } from "./capabilities";

const base = {
  id: "c",
  name: "c",
  enabled: true,
  start: 0,
  x: 0,
  y: 0,
  scale: 1,
  parentId: null,
  followRotation: false,
};

const sprite = (over: Partial<SpriteClip> = {}): SpriteClip => ({
  ...base,
  type: "sprite",
  source: { kind: "chippy" },
  width: 100,
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
  trail: { enabled: false, style: DEFAULT_LINE_STYLE, colors: [], band: 8, fadeOut: 0, offset: { along: 0, across: 0 } },
  ...over,
});

const on = (c: Clip) =>
  Object.entries(capabilities(c))
    .filter(([, v]) => v !== null && v !== "none")
    .map(([k]) => k)
    .sort();

describe("capabilities", () => {
  test("text edits, reveals, has a container, and nothing else", () => {
    const text = { ...base, type: "text", text: "", font: "sans", fontSize: 1, letterStagger: 0, letterDuration: 0, direction: "left", accentSuffix: "", accentColor: "", color: "", rule: false, ruleDelay: 0, ruleDuration: 0, ruleWidth: 0 } as unknown as Clip;
    expect(on(text)).toEqual(["container", "editText", "reveal", "text"]);
    expect(capabilities(text).editText).toBe("full");
  });

  test("chippy sprite has motion, path, trail, flap, landing", () => {
    expect(on(sprite())).toEqual(["flap", "landing", "motion", "path", "trail"]);
  });

  test("looping chippy has no landing", () => {
    expect(on(sprite({ loop: true }))).toEqual(["flap", "motion", "path", "trail"]);
  });

  test("image sprite is raster artwork with motion, path, trail", () => {
    expect(on(sprite({ source: { kind: "image", dataUrl: "", label: "", aspect: 1 } }))).toEqual(["motion", "path", "raster", "trail"]);
  });

  test("svg with live text exposes runs; without it is outlined", () => {
    const run = { id: "run-0", text: "Hi", detachedTo: null };
    const withRuns = sprite({ source: { kind: "svg", markup: "", label: "", aspect: 1, textRuns: [run] } });
    expect(on(withRuns)).toEqual(["editText", "motion", "path", "textRuns", "trail"]);
    expect(capabilities(withRuns).editText).toBe("runs");
    const outlined = sprite({ source: { kind: "svg", markup: "", label: "", aspect: 1, textRuns: [] } });
    expect(on(outlined)).toEqual(["motion", "outlinedSvg", "path", "trail"]);
  });

  test("logo builds", () => {
    const logo = { ...base, type: "logo", size: 1, layerStagger: 0, layerDuration: 1, entryRotate: 0, entryScale: 0, overshoot: 0, traceDelay: 0, traceDuration: 1, fillDuration: 0 } as LogoClip;
    expect(on(logo)).toEqual(["build"]);
  });

  test("ribbon is a ribbon with a line style and nothing else", () => {
    const ribbon = { ...base, type: "ribbon", points: [], loop: false, colors: [], band: 8, duration: 1, ease: { name: "linear" }, style: DEFAULT_LINE_STYLE, coat: { colors: [], every: 0, duration: 1 } } as RibbonClip;
    expect(on(ribbon)).toEqual(["line", "ribbon"]);
  });

  test("lottie has playback", () => {
    const lottie = { ...base, type: "lottie", label: "", data: {}, width: 1, speed: 1, loop: false } as LottieClip;
    expect(on(lottie)).toEqual(["playback"]);
  });
});
