import {
  DOC_VERSION,
  type Clip,
  type LogoClip,
  type LottieClip,
  type SpriteClip,
  type StudioDoc,
  type SvgTextRun,
  type TextClip,
} from "@/app/components/motion-studio/types";
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

// Built-in presets use fixed ids so the server-rendered DOM and the client
// state agree after hydration (drag-to-move looks clips up by DOM id).

/** The recorded YC end cap, as shipped on /thank-you-end-cap. */
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
        path: [
          { x: 0, y: -260 },
          { x: 260, y: 0 },
          { x: 0, y: 260 },
          { x: -260, y: 0 },
        ],
      }),
    ],
  };
}

export const BUILT_IN_PRESETS: { label: string; make: () => StudioDoc }[] = [
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
