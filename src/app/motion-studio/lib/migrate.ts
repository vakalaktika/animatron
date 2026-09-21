import { loopMemberIds } from "@/app/components/motion-studio/engine/hierarchy";
import { AUTO_TAIL_LENGTH, AUTO_TAIL_POSITION } from "@/app/components/motion-studio/engine/text";
import { DOC_VERSION, type Clip, type StudioDoc, type TextClip } from "@/app/components/motion-studio/types";
import { normalizeOrder } from "./tree";

export interface Normalized {
  doc: StudioDoc;
  /** Human-readable notes about anything that had to be repaired. */
  warnings: string[];
}

/** A document as it may arrive from a file or storage: any version, any clip shape. */
export interface RawDoc {
  version: number;
  name: string;
  stage: StudioDoc["stage"];
  clips: Clip[];
}

/** Fields the first studio build stored on bubbles before attachment became universal. */
interface LegacyBubble {
  id: string;
  name: string;
  enabled: boolean;
  start: number;
  x: number;
  y: number;
  scale: number;
  type: "bubble";
  text: string;
  attachTo?: unknown;
  offsetX?: unknown;
  offsetY?: unknown;
  duration: number;
  overshoot: number;
  fontSize: number;
  parentId?: unknown;
  followRotation?: unknown;
}

/** A v1 text clip: sans plain text with the letter reveal, no container fields yet. */
type LegacyText = Omit<TextClip, "font" | "container" | "tail" | "reveal" | "revealDuration" | "overshoot"> &
  Partial<Pick<TextClip, "font" | "container" | "tail" | "reveal" | "revealDuration" | "overshoot">>;

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export const PLAIN_TEXT_DEFAULTS: Pick<TextClip, "font" | "container" | "tail" | "reveal" | "revealDuration" | "overshoot"> = {
  font: "sans",
  container: { shape: "none", fill: "#ffffff", stroke: "rgba(0, 0, 0, 0.1)", padding: { x: 28, y: 16 }, radius: 16 },
  tail: { mode: "auto", side: "bottom", position: AUTO_TAIL_POSITION, length: AUTO_TAIL_LENGTH },
  reveal: "letters",
  revealDuration: 0.6,
  overshoot: 1.7,
};

/**
 * A v1 speech bubble becomes text with a speech container and pop reveal.
 * The v1 anchor was the box's bottom-left corner with the tail tip a fixed
 * distance from it; the v2 anchor is the tail tip, so the position shifts
 * by that distance and the composition looks the same.
 */
function bubbleToText(bubble: LegacyBubble): TextClip {
  const attached = typeof bubble.attachTo === "string" ? bubble.attachTo : null;
  const dx = num(bubble.offsetX, 0);
  const dy = num(bubble.offsetY, 0);
  const baseX = attached ? dx : bubble.x + dx;
  const baseY = attached ? dy : bubble.y + dy;
  return {
    id: bubble.id,
    name: bubble.name,
    enabled: bubble.enabled,
    start: bubble.start,
    x: baseX + AUTO_TAIL_POSITION,
    y: baseY + AUTO_TAIL_LENGTH,
    scale: bubble.scale,
    parentId: attached ?? (typeof bubble.parentId === "string" ? bubble.parentId : null),
    followRotation: bubble.followRotation === true,
    type: "text",
    text: bubble.text,
    font: "serif",
    fontSize: bubble.fontSize,
    color: "#060103",
    accentSuffix: "",
    accentColor: "#C74028",
    container: { ...PLAIN_TEXT_DEFAULTS.container, shape: "speech" },
    tail: { ...PLAIN_TEXT_DEFAULTS.tail },
    reveal: "pop",
    revealDuration: bubble.duration,
    overshoot: bubble.overshoot,
    letterStagger: 0.04,
    letterDuration: 0.45,
    direction: "center",
    rule: false,
    ruleDelay: 0.35,
    ruleDuration: 0.6,
    ruleWidth: 96,
  };
}

/** Brings one clip up to the current shape, whatever version wrote it. */
export function normalizeClip(raw: Clip | LegacyBubble): Clip {
  if (raw.type === "bubble") return bubbleToText(raw);
  const parentId = typeof raw.parentId === "string" ? raw.parentId : null;
  const followRotation = raw.followRotation === true;
  if (raw.type === "text") {
    const legacy = raw as LegacyText;
    return { ...PLAIN_TEXT_DEFAULTS, ...legacy, parentId, followRotation };
  }
  return { ...raw, parentId, followRotation };
}

/**
 * Migrates a document of any version to the current one, then repairs the
 * tree: parents that don't exist are dropped and clips on a parent loop are
 * detached. Import and localStorage are the only ways an old or broken
 * document can arrive, so both run this.
 */
export function normalizeDoc(raw: RawDoc): Normalized {
  const warnings: string[] = [];
  const clips = raw.clips.map(normalizeClip);
  const ids = new Set(clips.map((c) => c.id));
  const withParents = clips.map((c) => {
    if (c.parentId && !ids.has(c.parentId)) {
      warnings.push(`"${c.name}" was attached to a clip that isn't in this file; detached.`);
      return { ...c, parentId: null };
    }
    return c;
  });
  const doc: StudioDoc = { ...raw, version: DOC_VERSION, clips: withParents };
  const looped = loopMemberIds(doc);
  const repaired = doc.clips.map((c) => {
    if (!looped.has(c.id)) return c;
    warnings.push(`"${c.name}" was part of an attachment loop; detached.`);
    return { ...c, parentId: null };
  });
  return { doc: { ...doc, clips: normalizeOrder(repaired) }, warnings };
}
