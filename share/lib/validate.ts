/**
 * What the service will keep. It knows nothing of the engine: a document
 * is a composition-shaped JSON object within size, and the studio that
 * opens it repairs it like any imported file.
 */

export const MAX_DOC_BYTES = 2_000_000;
export const MAX_CARD_BYTES = 1_500_000;
export const MAX_NAME = 120;
export const MAX_DESCRIPTION = 300;
export const MAX_DURATION = 600;
const DOC_VERSIONS = [1, 2];

export interface ShareMeta {
  name: string;
  description: string;
  width: number;
  height: number;
  /** Seconds, as the studio measured it. */
  duration: number;
  layers: number;
  createdAt: string;
}

export interface ShareDoc {
  version: number;
  name: string;
  description?: string;
  stage: { width: number; height: number };
  clips: unknown[];
}

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isSize = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 16 && v <= 8192;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** What each kind of layer cannot do without; the studio repairs the rest. */
const CLIP_NEEDS: Record<string, (c: Record<string, unknown>) => boolean> = {
  logo: () => true,
  sprite: (c) => isObject(c.source) && typeof c.source.kind === "string",
  text: (c) => typeof c.text === "string",
  lottie: (c) => isObject(c.data),
  ribbon: (c) => Array.isArray(c.points),
  rig: (c) => isObject(c.rig),
};

/** A layer of a known kind with the fields its view reads unconditionally. */
function isClipShaped(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.type !== "string") return false;
  if (!isNum(value.start) || !isNum(value.x) || !isNum(value.y) || !isNum(value.scale)) return false;
  const needs = CLIP_NEEDS[value.type];
  return !!needs && needs(value);
}

/** A composition-shaped object: version, name, stage size, a list of clips. */
export function checkDoc(json: unknown): Checked<ShareDoc> {
  if (!isObject(json)) return { ok: false, message: "Not a composition." };
  const version = json.version;
  if (typeof version !== "number" || !DOC_VERSIONS.includes(version)) return { ok: false, message: "Not a composition this service knows." };
  if (typeof json.name !== "string" || !json.name.trim()) return { ok: false, message: "The composition needs a name." };
  if (json.name.length > MAX_NAME) return { ok: false, message: `The name is longer than ${MAX_NAME} characters.` };
  if (json.description !== undefined && (typeof json.description !== "string" || json.description.length > MAX_DESCRIPTION)) {
    return { ok: false, message: `The description is longer than ${MAX_DESCRIPTION} characters.` };
  }
  if (!isObject(json.stage) || !isSize(json.stage.width) || !isSize(json.stage.height)) return { ok: false, message: "The stage size is missing or out of range." };
  if (!Array.isArray(json.clips) || !json.clips.every(isClipShaped)) return { ok: false, message: "A layer in the composition is malformed." };
  if (json.audio) return { ok: false, message: "Compositions with sound can't be shared by link." };
  if (json.clips.some((c) => isObject(c) && isObject(c.source) && c.source.kind === "video")) return { ok: false, message: "Compositions with video can't be shared by link." };
  return { ok: true, value: json as unknown as ShareDoc };
}

export function checkDuration(raw: unknown): Checked<number> {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > MAX_DURATION) return { ok: false, message: "The duration is missing or out of range." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** The card is a PNG at the Open Graph size; the magic bytes are what count. */
export function checkCard(bytes: Uint8Array<ArrayBuffer>, type: string): Checked<Uint8Array<ArrayBuffer>> {
  if (bytes.byteLength > MAX_CARD_BYTES) return { ok: false, message: "The preview picture is too big." };
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (type !== "image/png" || bytes.byteLength < 8 || !signature.every((b, i) => bytes[i] === b)) return { ok: false, message: "The preview picture must be a PNG." };
  return { ok: true, value: bytes };
}

export function metaFrom(doc: ShareDoc, duration: number, createdAt = new Date().toISOString()): ShareMeta {
  return {
    name: doc.name.trim(),
    description: (doc.description ?? "").trim(),
    width: doc.stage.width,
    height: doc.stage.height,
    duration,
    layers: doc.clips.length,
    createdAt,
  };
}

/** Meta read back from storage: shape-checked so a tampered file cannot break the page. */
export function checkMeta(json: unknown): ShareMeta | null {
  if (!isObject(json)) return null;
  const { name, description, width, height, duration, layers, createdAt } = json;
  if (typeof name !== "string" || typeof description !== "string" || !isSize(width) || !isSize(height)) return null;
  if (typeof duration !== "number" || typeof layers !== "number" || typeof createdAt !== "string") return null;
  return { name, description, width, height, duration, layers, createdAt };
}
