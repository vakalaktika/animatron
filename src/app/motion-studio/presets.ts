import {
  DOC_VERSION,
  type Clip,
  type LogoClip,
  type LottieClip,
  type RibbonClip,
  type SpriteClip,
  type StudioDoc,
  type SvgTextRun,
  type TextClip,
  type Vec2,
} from "@/app/components/motion-studio/types";
import { DEFAULT_LINE_STYLE } from "@/app/components/motion-studio/engine/line";
import { arrivalTime, DEFAULT_COAT_COLORS, DEFAULT_RIBBON_COLORS } from "@/app/components/motion-studio/engine/ribbon";
import { DEFAULT_TRAIL } from "@/app/components/motion-studio/engine/trail";
import { normalizeClip, normalizeDoc, PLAIN_TEXT_DEFAULTS, type Normalized, type RawDoc } from "./lib/migrate";

// Storage key stays on v1: saved documents of any version are migrated on read.
export const STORAGE_KEY = "motion-studio.presets.v1";
export const FRAME_SIZES = [
  { label: "1920 x 1080 (video)", width: 1920, height: 1080 },
  { label: "1080 x 1080 (square post)", width: 1080, height: 1080 },
  { label: "1080 x 1920 (story / reel)", width: 1080, height: 1920 },
  { label: "1440 x 900 (site hero)", width: 1440, height: 900 },
] as const;

export const newId = () => Math.random().toString(36).slice(2, 9);

export function makeLogo(over: Partial<LogoClip> = {}): LogoClip {
  return {
    id: newId(),
    type: "logo",
    name: "Logo build",
    enabled: true,
    start: 0.6,
    x: 960,
    y: 560,
    scale: 1,
    parentId: null,
    followRotation: false,
    size: 440,
    layerStagger: 0.11,
    layerDuration: 0.7,
    entryRotate: -40,
    entryScale: 0,
    overshoot: 1.2,
    traceDelay: 1.15,
    traceDuration: 0.9,
    fillDuration: 0.4,
    ...over,
  };
}

export function makeChippy(over: Partial<SpriteClip> = {}): SpriteClip {
  return {
    id: newId(),
    type: "sprite",
    name: "Chippy flight",
    enabled: true,
    start: 1.6,
    x: 1090,
    y: 344,
    scale: 1,
    parentId: null,
    followRotation: false,
    source: { kind: "chippy" },
    width: 300,
    path: [
      { x: -1700, y: 380 },
      { x: -900, y: 470 },
      { x: -300, y: -120 },
      { x: 0, y: 0 },
    ],
    duration: 2.4,
    ease: { name: "flight" },
    loop: false,
    bank: 0.45,
    autoFlip: false,
    scaleFrom: 0.7,
    fadeIn: 0,
    flap: { hz: 3.3, depth: 34 },
    landing: { squash: 0.1, settleFlaps: 2, foldAngle: -70, foldDuration: 0.5 },
    trail: DEFAULT_TRAIL,
    ...over,
  };
}

/**
 * A speech bubble: serif text in a speech container that pops in. Its x / y
 * are the tail tip, so pass the offset from whatever it points at.
 */
export function makeSpeechText(over: Partial<TextClip> = {}): TextClip {
  return makeText({
    name: "Speech bubble",
    start: 4.55,
    x: 1228,
    y: -89,
    text: "Thank you",
    font: "serif",
    fontSize: 32,
    color: "#060103",
    accentSuffix: "",
    container: { ...PLAIN_TEXT_DEFAULTS.container, shape: "speech" },
    reveal: "pop",
    revealDuration: 0.6,
    overshoot: 1.7,
    rule: false,
    ...over,
  });
}

export function makeText(over: Partial<TextClip> = {}): TextClip {
  return {
    id: newId(),
    type: "text",
    name: "Site name",
    enabled: true,
    start: 5.25,
    x: 960,
    y: 824,
    scale: 1,
    parentId: null,
    followRotation: false,
    ...PLAIN_TEXT_DEFAULTS,
    text: "theateamproject.ai",
    fontSize: 26,
    letterStagger: 0.04,
    letterDuration: 0.45,
    direction: "center",
    accentSuffix: ".ai",
    accentColor: "#C74028",
    color: "rgba(6, 1, 3, 0.85)",
    rule: true,
    ruleDelay: 0.35,
    ruleDuration: 0.6,
    ruleWidth: 96,
    ...over,
  };
}

export function makeLottie(
  data: Record<string, unknown>,
  label: string,
  over: Partial<LottieClip> = {},
): LottieClip {
  return {
    id: newId(),
    type: "lottie",
    name: label.replace(/\.json$/i, ""),
    enabled: true,
    start: 0,
    x: 960,
    y: 540,
    scale: 1,
    parentId: null,
    followRotation: false,
    label,
    data,
    width: Number(data.w ?? 400) || 400,
    speed: 1,
    loop: false,
    ...over,
  };
}

export function makeImageSprite(
  dataUrl: string,
  label: string,
  aspect: number,
  over: Partial<SpriteClip> = {},
): SpriteClip {
  return makeChippy({
    name: label.replace(/\.[a-z0-9]+$/i, ""),
    source: { kind: "image", dataUrl, label, aspect },
    width: 240,
    x: 960,
    y: 540,
    path: [
      { x: -600, y: 0 },
      { x: 0, y: 0 },
    ],
    duration: 1.2,
    ease: { name: "smoothOut" },
    bank: 0,
    fadeIn: 0.3,
    ...over,
  });
}

export function makeSvgSprite(
  markup: string,
  label: string,
  aspect: number,
  textRuns: SvgTextRun[],
  over: Partial<SpriteClip> = {},
): SpriteClip {
  return makeImageSprite("", label, aspect, {
    source: { kind: "svg", markup, label, aspect, textRuns },
    ...over,
  });
}

/**
 * Eight points evenly around a circle, starting at the top. The spline is
 * centripetal (it hugs its chords rather than overshooting), so a loop needs
 * this many waypoints to read as round; four give a rounded diamond.
 */
export function ringPoints(radius: number): Vec2[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    return { x: Math.round(radius * Math.cos(a)), y: Math.round(radius * Math.sin(a)) };
  });
}

/** A gentle S-curve ribbon that paints itself in, ready to be reshaped on stage. */
export function makeRibbon(over: Partial<RibbonClip> = {}): RibbonClip {
  return {
    id: newId(),
    type: "ribbon",
    name: "Ribbon",
    enabled: true,
    start: 0,
    x: 960,
    y: 540,
    scale: 1,
    parentId: null,
    followRotation: false,
    points: [
      { x: -600, y: 120 },
      { x: -300, y: -140 },
      { x: 0, y: 120 },
      { x: 300, y: -140 },
      { x: 600, y: 120 },
    ],
    loop: false,
    colors: DEFAULT_RIBBON_COLORS.slice(),
    band: 8,
    duration: 2.4,
    ease: { name: "inOut" },
    style: DEFAULT_LINE_STYLE,
    coat: { colors: DEFAULT_COAT_COLORS.slice(), every: 0, duration: 5 },
    ...over,
  };
}

// Built-in presets use fixed ids so the server-rendered DOM and the client
// state agree after hydration (drag-to-move looks clips up by DOM id).

/**
 * Two ribbons painting in one after the other, with a caption that rides the
 * paint head of the first and a second strand that loops as a comet. A quick
 * tour of what ribbons do; every point is draggable on stage.
 */
export function ribbonRidePreset(): StudioDoc {
  const wave = makeRibbon({
    id: "ride-wave",
    name: "Wave",
    start: 0,
    x: 240,
    y: 440,
    points: [
      { x: 0, y: 0 },
      { x: 240, y: -180 },
      { x: 480, y: 60 },
      { x: 720, y: -200 },
      { x: 960, y: 40 },
      { x: 1200, y: -160 },
      { x: 1440, y: 0 },
    ],
    duration: 2.6,
    ease: { name: "inOut" },
    coat: { colors: DEFAULT_COAT_COLORS.slice(), every: 5, duration: 3 },
  });
  const loop = makeRibbon({
    id: "ride-loop",
    name: "Comet loop",
    start: 1.2,
    x: 1480,
    y: 780,
    points: ringPoints(170),
    loop: true,
    style: { ...DEFAULT_LINE_STYLE, motion: "comet", tail: 1.1 },
    duration: 3,
    ease: { name: "linear" },
    colors: DEFAULT_COAT_COLORS.slice(),
    band: 7,
  });
  const rider = makeText({
    id: "ride-caption",
    name: "Rider",
    parentId: wave.id,
    along: "front",
    followRotation: true,
    x: 0,
    y: -44,
    start: 0,
    text: "ribbon",
    fontSize: 30,
    accentSuffix: "",
    rule: false,
    direction: "center",
    letterStagger: 0.05,
    letterDuration: 0.4,
  });
  const landing = makeText({
    id: "ride-landing",
    name: "Landing",
    parentId: wave.id,
    along: 1,
    x: 120,
    y: 36,
    start: Number(arrivalTime(wave, 1).toFixed(2)),
    text: "painted in",
    fontSize: 22,
    accentSuffix: "",
    rule: false,
    direction: "left",
  });
  return {
    version: DOC_VERSION,
    name: "Ribbon ride",
    stage: { width: 1920, height: 1080, background: "#f7f5ee", transparent: false },
    clips: [wave, rider, landing, loop],
  };
}

/**
 * What a new visitor sees first: a ribbon paints across the stage, the
 * title rides its paint head and settles, a tagline fades in under it, and
 * a small comet loop keeps the stage alive. Everything here is editable, so
 * it doubles as a tour of ribbons, seating, text reveals and trails.
 */
export function welcomePreset(): StudioDoc {
  const ribbon = makeRibbon({
    id: "welcome-ribbon",
    name: "Ribbon",
    start: 0,
    x: 180,
    y: 560,
    points: [
      { x: 0, y: 0 },
      { x: 280, y: -140 },
      { x: 580, y: 60 },
      { x: 880, y: -120 },
      { x: 1160, y: 40 },
      { x: 1380, y: -60 },
    ],
    duration: 2.8,
    ease: { name: "inOut" },
    band: 10,
    coat: { colors: DEFAULT_COAT_COLORS.slice(), every: 7, duration: 3.5 },
  });
  const title = makeText({
    id: "welcome-title",
    name: "Title",
    parentId: ribbon.id,
    along: "front",
    followRotation: false,
    x: 0,
    y: -84,
    start: 0.2,
    text: "Animatron",
    font: "serif",
    fontSize: 84,
    color: "#2a241d",
    accentSuffix: "",
    rule: false,
    direction: "left",
    letterStagger: 0.06,
    letterDuration: 0.5,
  });
  // Free-standing under the ribbon, timed to when the paint reaches the end.
  const tagline = makeText({
    id: "welcome-tagline",
    name: "Tagline",
    x: 960,
    y: 760,
    start: Number(arrivalTime(ribbon, 1).toFixed(2)),
    text: "Draw a path. Ride it. Export the code.",
    font: "sans",
    fontSize: 26,
    color: "#645e56",
    accentSuffix: "",
    rule: true,
    ruleDelay: 0.2,
    ruleDuration: 0.6,
    ruleWidth: 120,
    direction: "center",
    reveal: "fade",
    revealDuration: 0.6,
  });
  const loop = makeRibbon({
    id: "welcome-loop",
    name: "Comet loop",
    start: 0.6,
    x: 1650,
    y: 250,
    points: ringPoints(110),
    loop: true,
    style: { ...DEFAULT_LINE_STYLE, motion: "comet", tail: 0.9 },
    duration: 2.6,
    ease: { name: "linear" },
    colors: DEFAULT_COAT_COLORS.slice(),
    band: 6,
  });
  const flyer = makeChippy({
    id: "welcome-flyer",
    name: "Chippy",
    parentId: loop.id,
    along: "front",
    followRotation: true,
    x: 0,
    y: 0,
    start: 0.6,
    width: 150,
    path: [],
    duration: 0.5,
    ease: { name: "backOut" },
    scaleFrom: 0,
    fadeIn: 0.2,
    loop: false,
    bank: 0,
    autoFlip: false,
    landing: { squash: 0, settleFlaps: 0, foldAngle: 0, foldDuration: 0 },
  });
  return {
    version: DOC_VERSION,
    name: "Welcome",
    stage: { width: 1920, height: 1080, background: "#f7f5ee", transparent: false },
    clips: [ribbon, title, tagline, loop, flyer],
  };
}

export function endCapPreset(): StudioDoc {
  return {
    version: DOC_VERSION,
    name: "End cap",
    stage: { width: 1920, height: 1080, background: "#f7f5ee", transparent: false },
    clips: [
      makeLogo({ id: "endcap-logo" }),
      makeChippy({ id: "endcap-chippy" }),
      // Rides on Chippy: x / y are the tail tip's offset from his perch point.
      makeSpeechText({ id: "endcap-bubble", parentId: "endcap-chippy", x: 88, y: -209 }),
      makeText({ id: "endcap-site-name" }),
    ],
  };
}

/** Chippy circling on a loop, for loading or processing screens. */
export function loaderPreset(): StudioDoc {
  return {
    version: DOC_VERSION,
    name: "Chippy loader",
    stage: { width: 1080, height: 1080, background: "#f7f5ee", transparent: false },
    clips: [
      makeChippy({
        id: "loader-chippy",
        name: "Chippy loop",
        start: 0,
        x: 540,
        y: 540,
        width: 220,
        loop: true,
        duration: 4,
        ease: { name: "linear" },
        bank: 0.6,
        autoFlip: true,
        scaleFrom: 1,
        path: ringPoints(260),
      }),
    ],
  };
}

export const BUILT_IN_PRESETS: { label: string; make: () => StudioDoc }[] = [
  { label: "Welcome", make: welcomePreset },
  { label: "Ribbon ride", make: ribbonRidePreset },
  { label: "End cap", make: endCapPreset },
  { label: "Chippy loader", make: loaderPreset },
];

export interface SavedPreset {
  name: string;
  savedAt: string;
  doc: StudioDoc;
}

/** Reads saved presets, bringing each document up to the current clip shape. */
export function loadSavedPresets(): SavedPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as { name: string; savedAt: string; doc: RawDoc }[]).map((p) => ({ ...p, doc: normalizeDoc(p.doc).doc }));
  } catch {
    // Every saved preset silently disappears from the list when this fails.
    return [];
  }
}

/** Returns an error message if the browser's storage quota was exceeded. */
export function savePresets(presets: SavedPreset[]): string | null {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Could not save preset";
  }
}

function isClip(value: unknown): value is Clip {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.type === "string" &&
    typeof v.start === "number" &&
    typeof v.x === "number" &&
    typeof v.y === "number"
  );
}

export type ImportResult =
  | ({ kind: "doc" } & Normalized)
  | { kind: "clip"; clip: Clip }
  | { kind: "error"; message: string };

/**
 * Validates an imported document or a single clip file. Documents are
 * normalized (legacy fields migrated, broken attachments repaired) and any
 * repair is reported in `warnings`. A lone clip arrives detached, since its
 * parent isn't in the file.
 */
export function parseImport(json: unknown): ImportResult {
  if (typeof json !== "object" || json === null) return { kind: "error", message: "Not a JSON object" };
  const v = json as Record<string, unknown>;
  if (typeof v.version === "number" && v.version >= 1 && v.version <= DOC_VERSION && Array.isArray(v.clips) && typeof v.stage === "object") {
    if (!v.clips.every(isClip)) return { kind: "error", message: "A clip in this file is malformed" };
    return { kind: "doc", ...normalizeDoc(json as RawDoc) };
  }
  if (v.version !== undefined) return { kind: "error", message: `This file is version ${String(v.version)}; the studio reads up to ${DOC_VERSION}` };
  if (isClip(json)) return { kind: "clip", clip: { ...normalizeClip(json), id: newId(), parentId: null } };
  return { kind: "error", message: "Unrecognized file: expected a studio document, a clip, or a Lottie" };
}
