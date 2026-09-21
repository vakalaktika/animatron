import type { Clip, StudioDoc } from "../types";
import { LOGO_LAYER_COUNT } from "../assets/logoPaths";
import { spriteActiveDuration } from "./spriteTiming";
import { revealDuration } from "./text";

export const IDLE_FLAP_SECONDS = 0.55;
export const LANDING_SQUASH_SECONDS = 0.45;

/** Seconds a clip occupies on the clock, from its start. */
export function clipDuration(clip: Clip): number {
  switch (clip.type) {
    case "logo": {
      const layers = (LOGO_LAYER_COUNT - 1) * clip.layerStagger + clip.layerDuration;
      const letter = clip.traceDelay + clip.traceDuration + clip.fillDuration;
      return Math.max(layers, letter);
    }
    case "sprite": {
      const active = spriteActiveDuration(clip);
      if (clip.loop) return active;
      const perch =
        clip.source.kind === "chippy"
          ? Math.max(
              LANDING_SQUASH_SECONDS,
              clip.landing.settleFlaps * IDLE_FLAP_SECONDS + clip.landing.foldDuration,
            )
          : 0;
      return active + perch;
    }
    case "text": {
      const ruleEnd = clip.rule ? clip.ruleDelay + clip.ruleDuration : 0;
      return Math.max(revealDuration(clip), ruleEnd);
    }
    case "lottie": {
      const ip = Number(clip.data.ip ?? 0);
      const op = Number(clip.data.op ?? 0);
      const fr = Number(clip.data.fr ?? 30);
      const frames = Math.max(0, op - ip);
      return fr > 0 && clip.speed > 0 ? frames / fr / clip.speed : 0;
    }
  }
}

export function clipEnd(clip: Clip): number {
  return clip.start + clipDuration(clip);
}

/** Total composition length: the latest clip end, with a short hold after. */
export function docDuration(doc: StudioDoc, tail = 1): number {
  const ends = doc.clips.filter((c) => c.enabled).map(clipEnd);
  return ends.length ? Math.max(...ends) + tail : tail;
}
