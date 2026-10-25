import type { Ease, LineStyle } from "../types";
import { clamp01, resolveEase } from "./easing";
import { RAINBOW } from "./rainbow";

/** A fresh line paints in and stays; its comet settings are ready for when the motion changes. */
export const DEFAULT_LINE_STYLE: LineStyle = {
  motion: "paint",
  tail: 0.8,
  hold: 2,
  taper: 0.85,
  fade: 0.8,
  head: 1,
  nib: 0,
  core: false,
  echo: 0,
  glow: 0,
  wiggle: 0,
  colour: "fixed",
  colourSpeed: 1,
  accent: [RAINBOW.red, RAINBOW.orange, RAINBOW.yellow],
};

/** The timing a line's motion runs on: the clip's own start, duration, loop and easing. */
export interface LineSubject {
  start: number;
  duration: number;
  loop: boolean;
  ease: Ease;
  /**
   * The head's eased 0..1 progress (or lap phase on a loop) at clock time
   * `t`, when the subject's travel isn't a plain ease over `duration`: a
   * sprite with waypoint holds or retimed waypoints supplies its own so the
   * paint head stays under it.
   */
  head?: (t: number) => number;
}

/**
 * One lit stretch of the line, as fractions of its length. `tail` is the
 * trailing end and `tail + length` the head; on a looping line the head may
 * pass 1 (the renderer wraps). `reverse` puts the head at the low end
 * instead (a ping-pong on its way back). `flat` stretches ignore the width
 * and fade profile (a painted line has no trailing end to shape). A
 * `symmetric` stretch is shaped at both ends.
 */
export interface LitSpan {
  tail: number;
  length: number;
  opacity: number;
  palette: "own" | "accent";
  reverse: boolean;
  flat: boolean;
  symmetric: boolean;
}

const SPAN: LitSpan = { tail: 0, length: 0, opacity: 1, palette: "own", reverse: false, flat: false, symmetric: false };
export const phase = (x: number) => ((x % 1) + 1) % 1;
const MIN_HOLD = 0.1;
const MIN_FRACTION = 0.02;

/** Eased 0..1 progress of a one-shot, or the raw lap phase of a looping subject. */
export function lineHeadAt(s: LineSubject, t: number): number {
  if (s.head) return s.head(t);
  const raw = (t - s.start) / Math.max(0.001, s.duration);
  if (s.loop) return raw <= 0 ? 0 : raw % 1;
  return resolveEase(s.ease)(clamp01(raw));
}

/** How far a painting-in line has got: eased for a one-shot, a single lap then whole on a loop. */
function painted(s: LineSubject, t: number): number {
  const raw = clamp01((t - s.start) / Math.max(0.001, s.duration));
  if (s.loop) return raw;
  return s.head ? s.head(t) : resolveEase(s.ease)(raw);
}

/** The stretch behind the head: from where it was `seconds` ago to where it is now, wrapping on a loop. */
function cometSpan(s: LineSubject, t: number, seconds: number): LitSpan {
  const head = lineHeadAt(s, t);
  const tail = lineHeadAt(s, t - Math.max(0, seconds));
  const wrapped = s.loop && tail > head;
  return { ...SPAN, tail, length: wrapped ? head - tail + 1 : head - tail };
}

/**
 * Everything lit on the line at time `t`, for the renderer to shape. Empty
 * before the start, and after a one-shot erase has finished.
 */
export function lineSpans(style: LineStyle, s: LineSubject, t: number): LitSpan[] {
  const local = t - s.start;
  if (local < 0) return [];
  const D = Math.max(0.001, s.duration);
  const ease = resolveEase(s.ease);
  switch (style.motion) {
    case "paint":
      return [{ ...SPAN, length: painted(s, t), flat: true }];
    case "unfold": {
      const p = painted(s, t);
      return [{ ...SPAN, tail: 0.5 - p / 2, length: p, flat: true, symmetric: true }];
    }
    case "comet":
      return [cometSpan(s, t, style.tail)];
    case "erase": {
      const hold = Math.max(MIN_HOLD, style.hold);
      const period = 2 * D + hold;
      const x = s.loop ? local % period : local;
      if (x < D) return [{ ...SPAN, length: ease(x / D), flat: true }];
      if (x < D + hold) return [{ ...SPAN, length: 1, flat: true }];
      if (x >= period) return [];
      const gone = ease((x - D - hold) / D);
      return [{ ...SPAN, tail: gone, length: 1 - gone }];
    }
    case "pulse": {
      const base: LitSpan = { ...SPAN, length: painted(s, t), flat: true };
      if (local < D) return [base];
      // A pulse starts every `hold` seconds, but never before the last one has crossed.
      const every = Math.max(MIN_HOLD, style.hold, D);
      const into = (local - D) % every;
      if (into >= D) return [base];
      const f = Math.max(MIN_FRACTION, Math.min(1, style.tail));
      const head = ease(into / D) * (1 + f);
      const tail = Math.max(0, head - f);
      return [base, { ...SPAN, tail, length: Math.min(1, head) - tail, palette: "accent" }];
    }
    case "pingpong": {
      const f = Math.max(MIN_FRACTION, Math.min(1, style.tail));
      const x = (local % (2 * D)) / D;
      const forward = x < 1;
      const p = ease(forward ? x : 2 - x);
      return [{ ...SPAN, tail: p * (1 - f), length: f, reverse: !forward }];
    }
    case "dash": {
      const f = Math.max(MIN_FRACTION, Math.min(0.5, style.tail));
      const period = 2 * f;
      // Dashes travel one line length per duration, like the paint head.
      const shift = phase(local / D) % period;
      const spans: LitSpan[] = [];
      for (let tail = shift - period; tail < 1; tail += period) {
        if (s.loop) {
          spans.push({ ...SPAN, tail: phase(tail), length: f });
        } else {
          const from = Math.max(0, tail);
          const to = Math.min(1, tail + f);
          if (to > from) spans.push({ ...SPAN, tail: from, length: to - from });
        }
      }
      return spans;
    }
  }
}

/**
 * The fraction a clip riding the "front" follows: the paint head, the comet
 * head, the moving end of a ping-pong, or the pulse while one is running.
 */
export function lineFront(style: LineStyle, s: LineSubject, t: number): number {
  const spans = lineSpans(style, s, t);
  if (spans.length === 0) return t < s.start ? 0 : 1;
  if (style.motion === "dash") return painted(s, t);
  const lead = spans[spans.length - 1];
  const head = lead.reverse ? lead.tail : lead.tail + lead.length;
  return s.loop ? phase(head) : clamp01(head);
}

/** A line that never settles: anything that keeps moving after painting in. */
export function lineForever(style: LineStyle, s: LineSubject): boolean {
  if (style.colour === "cycle" || style.colour === "chase" || style.wiggle > 0) return true;
  switch (style.motion) {
    case "pulse":
    case "pingpong":
    case "dash":
      return true;
    case "comet":
    case "erase":
      return s.loop;
    default:
      return false;
  }
}

/** Seconds from the start until the line is settled (or gone). */
export function lineDuration(style: LineStyle, s: LineSubject): number {
  switch (style.motion) {
    case "comet":
      return s.duration + (s.loop ? 0 : Math.max(0, style.tail));
    case "erase":
      return 2 * s.duration + Math.max(MIN_HOLD, style.hold);
    default:
      return s.duration;
  }
}

/**
 * Whether the line can be drawn as dashed strokes (one path per band, lit by
 * dash offset), or needs its shape built per frame. A plain painted line and
 * a hard-edged comet are dashes; anything with a width or fade profile, a
 * braid, echoes, a core, a pinched head, a glow, colour that isn't the
 * line's own, or more than one lit stretch (dashes, a pulse over its base)
 * is a shape: the dash renderer draws a single stretch, unfiltered.
 */
export function lineNeedsShape(style: LineStyle): boolean {
  if (style.core || style.nib > 0 || style.wiggle > 0 || style.echo > 0 || style.head < 1 || style.glow > 0) return true;
  if (style.colour !== "fixed") return true;
  switch (style.motion) {
    case "paint":
    case "unfold":
      return false;
    case "dash":
    case "pulse":
      return true;
    default:
      return style.taper > 0 || style.fade > 0;
  }
}
