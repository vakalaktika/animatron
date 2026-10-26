import type { Clip, StudioDoc } from "../types";
import { LOGO_LAYER_COUNT } from "../assets/logoPaths";
import { lineDuration, lineForever } from "./line";
import { ribbonSubject } from "./ribbon";
import { rigDuration, rigLoops } from "./rig";
import { spriteActiveDuration } from "./spriteTiming";
import { revealDuration } from "./text";
import { trailSubject } from "./trail";

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
      // A trail that fades out, or one still moving after the landing (a
      // comet tail catching up, an erase), keeps the clip on the clock.
      const trail = !clip.trail.enabled
        ? 0
        : clip.trail.style.motion === "paint"
          ? clip.trail.fadeOut
          : lineDuration(clip.trail.style, trailSubject(clip)) - active;
      // A video shows for its own length, travel or not.
      const video = clip.source.kind === "video" ? clip.source.playFor : 0;
      return Math.max(active + Math.max(perch, trail), video);
    }
    case "text": {
      const ruleEnd = clip.rule ? clip.ruleDelay + clip.ruleDuration : 0;
      return Math.max(revealDuration(clip), ruleEnd);
    }
    case "ribbon": {
      // The line settles when its motion does (a comet tail keeps catching
      // up after the head stops). A repainting ribbon stays on the clock
      // through one full cycle of coats (new palette, then back to its own),
      // so a looped composition is seamless.
      const line = lineDuration(clip.style, ribbonSubject(clip));
      const coats = clip.style.motion === "paint" && clip.coat.every > 0 ? 2 * clip.coat.every + clip.coat.duration : 0;
      return line + coats;
    }
    case "rig":
      return rigDuration(clip);
    case "lottie": {
      const ip = Number(clip.data.ip ?? 0);
      const op = Number(clip.data.op ?? 0);
      const fr = Number(clip.data.fr ?? 30);
      const frames = Math.max(0, op - ip);
      return fr > 0 && clip.speed > 0 ? frames / fr / clip.speed : 0;
    }
  }
}

/** A clip that never settles, so the composition keeps running for it. */
export function loopsForever(clip: Clip): boolean {
  switch (clip.type) {
    case "sprite":
      return clip.loop || (clip.trail.enabled && lineForever(clip.trail.style, trailSubject(clip)));
    case "lottie":
      return clip.loop;
    case "ribbon":
      return lineForever(clip.style, ribbonSubject(clip));
    case "rig":
      return rigLoops(clip);
    default:
      return false;
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

/** Seconds the sound plays for on the clock, within a composition of `duration`. */
export function audioSpan(doc: StudioDoc, duration: number): { start: number; end: number } | null {
  const a = doc.audio;
  if (!a) return null;
  const available = Math.max(0, a.length - a.trimStart);
  const end = Math.min(duration, a.offset + available);
  return end > a.offset ? { start: a.offset, end } : null;
}
