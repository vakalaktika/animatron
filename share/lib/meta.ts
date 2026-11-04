/** What a share page shows, as get_share_meta returns it. */
export interface ShareMeta {
  name: string;
  description: string;
  width: number;
  height: number;
  /** Seconds, as the studio measured it; null for shares made before it was kept. */
  duration: number | null;
  layers: number;
  createdAt: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isSize = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 16 && v <= 8192;

export const MAX_NAME = 120;
export const MAX_DESCRIPTION = 300;

/**
 * Meta read back from the database. The document inside a share is only
 * checked for its rough shape when stored, so everything the page reads
 * from it is checked here; anything off means there is no page to show.
 */
export function checkMeta(json: unknown): ShareMeta | null {
  if (!isObject(json)) return null;
  const { name, description, width, height, duration, layers, createdAt } = json;
  if (typeof name !== "string" || !name.trim() || typeof description !== "string") return null;
  if (!isSize(width) || !isSize(height)) return null;
  if (duration !== null && (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0)) return null;
  if (typeof layers !== "number" || typeof createdAt !== "string") return null;
  return {
    name: name.trim().slice(0, MAX_NAME),
    description: description.trim().slice(0, MAX_DESCRIPTION),
    width,
    height,
    duration,
    layers,
    createdAt,
  };
}
