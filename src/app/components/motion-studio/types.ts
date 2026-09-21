/**
 * Motion-studio document model. A StudioDoc is a stage plus an ordered list of
 * clips. Every clip is driven by one shared clock (seconds), so the whole
 * composition is deterministic, scrubbable, and loopable.
 *
 * Positions are stage pixels. A clip's (x, y) is its anchor: the logo's
 * center, a sprite's resting point, a text block's top center (or its tail
 * tip when it has one), a Lottie's center. Clips form a tree through `parentId`; see
 * engine/transform.ts for how a child's placement composes with its parent.
 */

export type EaseName =
  | "linear"
  | "smoothOut"
  | "inOut"
  | "flight"
  | "backOut"
  | "custom";

export interface Ease {
  name: EaseName;
  /** Cubic bezier control points, used when name is "custom". */
  custom?: [number, number, number, number];
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * A point on a sprite's path, relative to its anchor. The optional values
 * shape the sprite as it passes through: each one eases smoothly from the
 * previous waypoint to this one. Missing values use the defaults in
 * engine/spriteTiming.ts (scale 1, rotate 0, opacity 1, hold 0).
 */
export interface Waypoint extends Vec2 {
  /** Multiplier on the clip's scale at this point. */
  scale?: number;
  /** Degrees added on top of the banking at this point, clockwise. */
  rotate?: number;
  /** 0..1 opacity at this point. */
  opacity?: number;
  /** Seconds to pause here before moving on. Adds to the clip's length. */
  hold?: number;
  /**
   * Seconds of travel from the clip start (holds excluded) to reach this
   * point, set by dragging its timeline keyframe. Unset: paced by the clip's
   * easing. Ignored on the first point and on an open path's last point,
   * which always sit at the start and end of the travel.
   */
  time?: number;
}

export interface ClipBase {
  id: string;
  name: string;
  enabled: boolean;
  /** Seconds on the shared clock when this clip begins. Always absolute, never parent-relative. */
  start: number;
  /**
   * Anchor position. For a root clip these are stage pixels. For an attached
   * clip they are an offset in the parent's local space, measured from the
   * parent's anchor.
   */
  x: number;
  y: number;
  scale: number;
  /** Clip this one rides on. Position and scale are always inherited. */
  parentId: string | null;
  /** Also inherit the parent's rotation (a wing on a bird: yes; a bubble on a bird: no). */
  followRotation: boolean;
}

export interface LogoClip extends ClipBase {
  type: "logo";
  /** Rendered diameter in stage pixels. */
  size: number;
  /** Delay between successive layers. */
  layerStagger: number;
  /** How long each layer takes to spring in. */
  layerDuration: number;
  entryRotate: number;
  entryScale: number;
  /** Back-out overshoot amount; 0 = no bounce. */
  overshoot: number;
  /** Letter trace start, relative to the clip start. */
  traceDelay: number;
  traceDuration: number;
  fillDuration: number;
}

/** One live `<text>` element found in an imported SVG. */
export interface SvgTextRun {
  /** Matches the `data-studio-run` attribute stamped on the element. */
  id: string;
  text: string;
  /** Id of the text clip this run was pulled out into, while detached. */
  detachedTo: string | null;
}

export type SpriteSource =
  | { kind: "chippy" }
  | { kind: "image"; dataUrl: string; label: string; aspect: number }
  | {
      kind: "svg";
      /** The SVG markup with each live text run stamped with `data-studio-run`. */
      markup: string;
      label: string;
      aspect: number;
      textRuns: SvgTextRun[];
    };

export interface SpriteClip extends ClipBase {
  type: "sprite";
  source: SpriteSource;
  /** Rendered width in stage pixels. */
  width: number;
  /**
   * Waypoints relative to the anchor. The sprite travels through them in
   * order with a smooth spline. For a landing, the last point is (0, 0).
   */
  path: Waypoint[];
  duration: number;
  ease: Ease;
  /** Closed path that repeats forever (loading / processing screens). */
  loop: boolean;
  /** 0..1, how much the sprite banks into the path's tangent. */
  bank: number;
  /** Flip horizontally when travelling leftwards. */
  autoFlip: boolean;
  scaleFrom: number;
  /** Seconds of fade-in at takeoff; 0 = pop in. */
  fadeIn: number;
  flap: { hz: number; depth: number };
  landing: {
    squash: number;
    settleFlaps: number;
    foldAngle: number;
    foldDuration: number;
  };
}

export type ContainerShape = "none" | "speech" | "soft" | "minimal" | "thought";

/** Optional box drawn around a text clip. `none` is plain text. */
export interface TextContainer {
  shape: ContainerShape;
  fill: string;
  stroke: string;
  padding: Vec2;
  radius: number;
}

export type TailSide = "top" | "bottom" | "left" | "right";

/**
 * Pointer from a container to the clip's anchor. When a tail shows, the
 * clip's (x, y) is the tail tip and the box hangs off it on `side`; `auto`
 * picks the side facing the parent. `position` is px from the side's start
 * (left or top edge) to the tail's centre; `length` is box edge to tip.
 */
export interface TextTail {
  mode: "auto" | "manual" | "none";
  side: TailSide;
  position: number;
  length: number;
}

export type TextReveal = "letters" | "pop" | "fade";

/**
 * Anything the user types: plain text, a speech bubble, a caption. The
 * anchor is the tail tip when a tail is shown, else the top centre of the
 * box (or of the text when there is no container).
 */
export interface TextClip extends ClipBase {
  type: "text";
  text: string;
  font: "sans" | "serif";
  fontSize: number;
  color: string;
  accentSuffix: string;
  accentColor: string;
  container: TextContainer;
  tail: TextTail;
  reveal: TextReveal;
  /** Seconds for a pop or fade reveal. */
  revealDuration: number;
  /** Back-out overshoot for the pop reveal; 0 = no bounce. */
  overshoot: number;
  letterStagger: number;
  letterDuration: number;
  /** "center" unfolds from the middle outward. */
  direction: "center" | "left" | "right";
  rule: boolean;
  ruleDelay: number;
  ruleDuration: number;
  ruleWidth: number;
}

export interface LottieClip extends ClipBase {
  type: "lottie";
  label: string;
  /** Parsed Lottie JSON. Kept opaque; lottie-web validates it on load. */
  data: Record<string, unknown>;
  /** Rendered width in stage pixels. */
  width: number;
  speed: number;
  loop: boolean;
}

export type Clip = LogoClip | SpriteClip | TextClip | LottieClip;
export type ClipType = Clip["type"];

export interface StageConfig {
  width: number;
  height: number;
  background: string;
  /** Render the stage with no background (for screen-recording over alpha). */
  transparent: boolean;
}

export const DOC_VERSION = 2;

export interface StudioDoc {
  version: typeof DOC_VERSION;
  name: string;
  stage: StageConfig;
  clips: Clip[];
}
