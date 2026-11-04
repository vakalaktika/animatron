import type { ShareMeta } from "./validate";

/** "1920 × 1080 · about 9.7 s" */
export function kicker(meta: Pick<ShareMeta, "width" | "height" | "duration">): string {
  const seconds = meta.duration >= 10 ? Math.round(meta.duration) : Math.round(meta.duration * 10) / 10;
  return `${meta.width} × ${meta.height} · about ${seconds} s`;
}

/** What the link says about itself when the maker wrote nothing. */
export function fallbackDescription(meta: Pick<ShareMeta, "duration" | "layers">): string {
  const seconds = Math.round(meta.duration * 10) / 10;
  const layers = `${meta.layers} ${meta.layers === 1 ? "layer" : "layers"}`;
  return `A ${seconds}-second animation with ${layers}, made in Animatron. Open it to get your own copy to edit.`;
}
