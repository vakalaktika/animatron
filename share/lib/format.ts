import type { ShareMeta } from "./meta";

const seconds = (duration: number) => (duration >= 10 ? Math.round(duration) : Math.round(duration * 10) / 10);

/** "1920 × 1080 · about 9.7 s" (just the size when the length isn't known). */
export function kicker(meta: Pick<ShareMeta, "width" | "height" | "duration">): string {
  const size = `${meta.width} × ${meta.height}`;
  return meta.duration === null ? size : `${size} · about ${seconds(meta.duration)} s`;
}

/** What the link says about itself when the maker wrote nothing. */
export function fallbackDescription(meta: Pick<ShareMeta, "duration" | "layers">): string {
  const layers = `${meta.layers} ${meta.layers === 1 ? "layer" : "layers"}`;
  const piece = meta.duration === null ? "An animation" : `A ${Math.round(meta.duration * 10) / 10}-second animation`;
  return `${piece} with ${layers}, made in Animatron. Open it to get your own copy to edit.`;
}
