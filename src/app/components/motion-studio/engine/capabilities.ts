import type { Clip, LogoClip, LottieClip, SpriteClip, TextClip } from "../types";

/**
 * What a clip can do, derived from its type and source. The properties
 * panel builds its section list from this and nothing else, so the panel
 * never branches on `clip.type`.
 *
 * Typed capabilities hand back the narrowed clip (or null) so a section can
 * edit its fields without re-checking the type. Adding a capability means:
 * one field here, one line in `capabilities()`, one section file.
 */
export interface Capabilities {
  /** Text the user can edit: the whole string, SVG text runs in place, or nothing. */
  editText: "full" | "runs" | "none";
  /** Typography, colour, and accent controls. */
  text: TextClip | null;
  /** Reveal mode (letters, pop, fade) and the rule. */
  reveal: TextClip | null;
  /** Optional box around the text, with a tail. */
  container: TextClip | null;
  /** Timing, easing, bank, flip, fade, loop. */
  motion: SpriteClip | null;
  /** Editable waypoints. */
  path: SpriteClip | null;
  /** Wing flap in flight. */
  flap: SpriteClip | null;
  /** Squash, settle, fold on arrival. */
  landing: SpriteClip | null;
  /** Rings, trace, fill. */
  build: LogoClip | null;
  /** Speed and loop for an imported animation. */
  playback: LottieClip | null;
  /** Imported SVG whose live text can be edited in place. */
  textRuns: SpriteClip | null;
  /** Imported SVG with no live text (outlined). */
  outlinedSvg: SpriteClip | null;
  /** Imported raster picture; any text in it is baked. */
  raster: SpriteClip | null;
}

const NONE: Capabilities = {
  editText: "none",
  text: null,
  reveal: null,
  container: null,
  motion: null,
  path: null,
  flap: null,
  landing: null,
  build: null,
  playback: null,
  textRuns: null,
  outlinedSvg: null,
  raster: null,
};

export function capabilities(clip: Clip): Capabilities {
  switch (clip.type) {
    case "text":
      return { ...NONE, editText: "full", text: clip, reveal: clip, container: clip };
    case "sprite": {
      const { source } = clip;
      const chippy = source.kind === "chippy";
      const runs = source.kind === "svg" && source.textRuns.length > 0;
      return {
        ...NONE,
        editText: runs ? "runs" : "none",
        motion: clip,
        path: clip,
        flap: chippy ? clip : null,
        landing: chippy && !clip.loop ? clip : null,
        textRuns: runs ? clip : null,
        outlinedSvg: source.kind === "svg" && !runs ? clip : null,
        raster: source.kind === "image" ? clip : null,
      };
    }
    case "logo":
      return { ...NONE, build: clip };
    case "lottie":
      return { ...NONE, playback: clip };
  }
}
