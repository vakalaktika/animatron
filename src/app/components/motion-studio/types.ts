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
  | "anticipate"
  | "snap"
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

/** Placement properties any clip can animate with keyframes. */
export type KeyedProp = "x" | "y" | "scale" | "rotation" | "opacity";

/**
 * One keyframe: the property's value `time` seconds after the clip starts
 * (so keys move with the clip's bar), and how it eases to the next key.
 * Missing easing reads as in / out.
 */
export interface PropKey {
  time: number;
  value: number;
  ease?: Ease;
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
  /** Degrees clockwise the whole clip is turned, on top of any animated heading. Unset = 0. */
  rotation?: number;
  /** 0..1 overall opacity, multiplied with any animated fade. Unset = 1. */
  opacity?: number;
  /** Clip this one rides on. Position and scale are always inherited. */
  parentId: string | null;
  /** Also inherit the parent's rotation (a wing on a bird: yes; a bubble on a bird: no). */
  followRotation: boolean;
  /**
   * Seat on a ribbon parent. A fraction 0..1 threads the clip onto the
   * ribbon at that point along it; `"front"` makes it ride the paint head.
   * `x` / `y` then offset from the seat. Ignored unless the parent is a
   * ribbon. With `followRotation` the clip also turns with the ribbon's
   * tangent there.
   */
  along?: number | "front" | null;
  /**
   * Keyframes per placement property. An animated property takes its value
   * from its keys (holding the first before it and the last after it) and
   * its own field above is ignored. Kept apart from a sprite's waypoints,
   * which shape its flight; keys move the whole flight.
   */
  keys?: Partial<Record<KeyedProp, PropKey[]>>;
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
  | {
      kind: "image";
      dataUrl: string;
      label: string;
      aspect: number;
      /** Clip the picture to a circle, filling it edge to edge (a face in the hero). */
      round?: boolean;
    }
  | {
      kind: "svg";
      /** The SVG markup with each live text run stamped with `data-studio-run`. */
      markup: string;
      label: string;
      aspect: number;
      textRuns: SvgTextRun[];
    }
  | {
      /**
       * A video file, kept in the browser's media store (see lib/media.ts)
       * and referenced by id: a doc stays small enough for localStorage.
       * Plays from the clip start, muted (the composition's sound comes
       * from its own track), and holds its last frame after `playFor`.
       */
      kind: "video";
      mediaId: string;
      label: string;
      aspect: number;
      /** Length of the file in seconds. */
      length: number;
      /** Seconds into the file where playback starts. */
      trimStart: number;
      /** Seconds the video shows for, from the clip start. */
      playFor: number;
      /** Fill the stage as a background rather than travel as a picture. */
      cover: boolean;
    };

/**
 * A rainbow squiggle painted along the sprite's path as it travels. Bands are
 * fanned around the path's centerline exactly as Squiggle Studio draws them,
 * and the paint head rides the sprite's own progress, so Chippy leaves the
 * rainbow behind as it flies.
 */
export type LineMotion =
  /** Lights from the start to the head and stays. */
  | "paint"
  /** Only the last stretch behind the head stays lit; the tail follows. */
  | "comet"
  /** Paints in, holds, then retracts from its start until gone. */
  | "erase"
  /** Paints in and stays; a short highlight in the accent palette then runs along it on a timer. */
  | "pulse"
  /** A short lit stretch bounces end to end forever. */
  | "pingpong"
  /** Short dashes march along the whole line forever. */
  | "dash"
  /** Grows from the middle toward both ends and stays. */
  | "unfold";

export type LineColour =
  /** The line's own colours. */
  | "fixed"
  /** Own colours at the head blending into the accent palette toward the tail. */
  | "along"
  /** Hue drifts over time. */
  | "cycle"
  /** The colour bands slide along the line forever (barber pole). */
  | "chase";

/**
 * How a line (a ribbon, or the squiggle a sprite paints) is lit and shaped.
 * Five independent knobs: which stretch is lit and how it moves (`motion`),
 * the width and opacity profile along the lit stretch (`taper`, `fade`,
 * `nib`, `core`), colour behaviour (`colour`), copies (`echo`, `wiggle`
 * braids the bands), and finish (`glow`). Every look in the studio's "Look"
 * menu is a combination of these.
 */
export interface LineStyle {
  motion: LineMotion;
  /**
   * Length of the lit stretch. Comet: seconds of travel kept behind the
   * head. Pulse, ping-pong, dash: fraction of the line (0..1).
   */
  tail: number;
  /** Erase: seconds the full line holds before retracting. Pulse: seconds between pulses (never less than one crossing). */
  hold: number;
  /** 0 keeps the trailing end full width; 1 thins it to a hairline. */
  taper: number;
  /** 0 ends the trailing end hard; 1 fades it over the whole lit stretch. */
  fade: number;
  /**
   * Width where the line meets the thing leaving it (the sprite, or the
   * paint head), as a fraction of full width. 1 is full width; smaller
   * values pinch the head so the line visibly grows out of the object,
   * widening to full over the stretch just behind it.
   */
  head: number;
  /** Thick-and-thin by stroke direction, like a broad nib. 0 off, 1 strong. */
  nib: number;
  /** A thin bright line down the middle. */
  core: boolean;
  /** Trailing copies, each later, fainter, and offset sideways. 0..3. */
  echo: number;
  /** Soft glow behind the line, 0..1. */
  glow: number;
  /** Sideways wobble in stage pixels; the bands braid around each other. */
  wiggle: number;
  colour: LineColour;
  /** Speed multiplier for `cycle` and `chase`. */
  colourSpeed: number;
  /** Second palette: the pulse highlight and the tail colours of `along`. */
  accent: string[];
}

/**
 * A rainbow squiggle painted along the sprite's path as it travels. Bands are
 * fanned around the path's centerline exactly as Squiggle Studio draws them,
 * and the paint head rides the sprite's own progress, so Chippy leaves the
 * rainbow behind as it flies.
 */
export interface SpriteTrail {
  enabled: boolean;
  style: LineStyle;
  /** Concrete colours, one band each, drawn in order across the stripe. */
  colors: string[];
  /** Width of one colour band in stage pixels. */
  band: number;
  /** Paint motion: seconds the trail lingers after the sprite lands before fading; 0 keeps it. */
  fadeOut: number;
  /**
   * Where the head sits relative to the sprite's anchor, in stage pixels:
   * `along` moves it back along the path (positive = behind the sprite),
   * `across` moves the whole trail sideways (positive = to the right of
   * travel). For tucking the head under the body so the trail is seen to
   * come out of the sprite.
   */
  offset: { along: number; across: number };
}

export interface SpriteClip extends ClipBase {
  type: "sprite";
  source: SpriteSource;
  trail: SpriteTrail;
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

/**
 * How a text clip arrives. `letters` rise in one by one (from the middle or
 * either end); `typewriter` types them left to right behind a caret; `blur`
 * brings the whole line into focus; `mask` slides it up from behind an
 * invisible edge; `pop` and `fade` scale or fade the whole clip.
 */
export type TextReveal = "letters" | "typewriter" | "blur" | "mask" | "pop" | "fade";

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
  /** Seconds for a pop, fade, blur or mask reveal. */
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
  /**
   * Set the letters along the ribbon this clip is seated on (`along`), like
   * text on a path. A point seat centres the text there; riding the front
   * trails it behind the paint head. `x` then slides it along the ribbon and
   * `y` lifts it off the line (negative = to the left of travel, which is
   * above a ribbon drawn left to right). The box, pointer and underline are
   * not drawn while flowing. Ignored unless seated on a ribbon.
   */
  flow?: boolean;
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

/**
 * A new palette swept over a ribbon after it has painted in, the way the
 * homepage ribbons drift between warm and cool. Coats alternate between the
 * ribbon's own colours and these, one sweep every `every` seconds.
 */
export interface RibbonCoat {
  colors: string[];
  /** Seconds between sweeps; 0 = no regular repaint. */
  every: number;
  /** Seconds one sweep takes to cover the ribbon. */
  duration: number;
  /**
   * Extra sweeps at these clock times, on top of (or instead of) the regular
   * ones. A page that repaints on hover or at random appends to this list.
   */
  at?: number[];
}

/**
 * The brand squiggle as a clip of its own: a centerline fanned into colour
 * bands, lit and shaped by its `style` (paint in, comet, pulse, ...), that
 * can repaint in a new palette. Other clips thread onto it or ride its paint head via
 * `along`. Points are relative to the anchor, like a sprite's path.
 */
export interface RibbonClip extends ClipBase {
  type: "ribbon";
  points: Vec2[];
  /** Closed ribbon: the paint head laps it instead of stopping at the end. */
  loop: boolean;
  colors: string[];
  /** Width of one colour band in stage pixels. */
  band: number;
  /** Seconds to paint in. */
  duration: number;
  ease: Ease;
  style: LineStyle;
  /** Repaint sweeps; only a `paint` ribbon coats (there is nothing to cover otherwise). */
  coat: RibbonCoat;
}

// ----- Skeletal rigs (Mid-century Ink Rig 1) ---------------------------------

/**
 * A bone in a Mid-century Ink rig. `rest` is in the parent's frame (SVG user
 * units, +Y down, degrees clockwise); `length` is the visual tip distance
 * along the bone's local +X; `limits` bound the rotation delta from rest and
 * include zero. See docs/mci-rig/mci-rig-v1.md for the contract.
 */
export interface RigBone {
  id: string;
  parentId: string | null;
  /** Semantic role such as `head` or `arm.left.forearm`; unique when present. */
  role?: string;
  name?: string;
  rest: { x: number; y: number; rotation: number };
  length: number;
  limits?: { min: number; max: number };
}

/**
 * Ties a direct-child `<g id>` of the rig's SVG to a bone. `bindMatrix`
 * (SVG affine `[a, b, c, d, e, f]`) maps the group's authored coordinates
 * into the bone's rest-local frame; the group is drawn wrapped in
 * `posedBoneWorld * bindMatrix`, which is the identity at rest.
 */
export interface RigBinding {
  id: string;
  svgId: string;
  boneId: string;
  bindMatrix: [number, number, number, number, number, number];
}

/** A named attachment frame in bone-local coordinates (a grip, a hat anchor). */
export interface RigSlot {
  id: string;
  boneId: string;
  x: number;
  y: number;
  rotation: number;
}

/** A pose delta from rest for one bone. */
export interface RigDelta {
  x: number;
  y: number;
  rotation: number;
}

export type RigEasing = "linear" | "hold";

/** A keyframe: deltas from rest at `time` seconds, and how to reach the next key. */
export interface RigKey extends RigDelta {
  time: number;
  easing: RigEasing;
}

export interface RigTrack {
  boneId: string;
  /** Times strictly increase from 0 through the clip's duration. */
  keys: RigKey[];
}

export interface RigAnimation {
  id: string;
  name?: string;
  /** Seconds, > 0 and <= 600. */
  duration: number;
  loop: boolean;
  /** At most one track per bone. */
  tracks: RigTrack[];
}

export const RIG_FORMAT = "mid-century-ink-rig";
export const RIG_VERSION = 1;

/**
 * The editable skeletal master exactly as exchanged with Agent Torres and
 * the Mid-century Ink generator (`name.mci.json`). Kept whole inside a rig
 * clip so saving it back out loses nothing, including fields this studio
 * does not interpret (`metadata`, extra keys).
 */
export interface RigAsset {
  format: typeof RIG_FORMAT;
  version: typeof RIG_VERSION;
  name?: string;
  canvas: { width: number; height: number };
  /** The artwork; its viewBox is `0 0 canvas.width canvas.height`. */
  svg: string;
  bones: RigBone[];
  bindings: RigBinding[];
  slots?: RigSlot[];
  animations: RigAnimation[];
  /** Descriptive only, never executable. */
  metadata?: Record<string, unknown>;
}

/** Manual pose deltas keyed by bone id; bones not listed are at rest. */
export type RigPose = Record<string, RigDelta>;

/**
 * A rigged character: the rig's canvas is centred on the clip's anchor and
 * scaled by `scale`. It plays `animationId` from the clip start (holding
 * the first key before it, looping or holding the last after), or stands in
 * its manual `pose` when no animation is chosen.
 */
export interface RigClip extends ClipBase {
  type: "rig";
  rig: RigAsset;
  animationId: string | null;
  pose: RigPose;
}

export type Clip = LogoClip | SpriteClip | TextClip | LottieClip | RibbonClip | RigClip;
export type ClipType = Clip["type"];

export interface StageConfig {
  width: number;
  height: number;
  background: string;
  /** Render the stage with no background (for screen-recording over alpha). */
  transparent: boolean;
}

/**
 * The composition's one sound: a music bed or voice-over kept in the media
 * store. It starts on the shared clock at `offset`, `trimStart` seconds into
 * the file, and plays to the end of the composition or the file, whichever
 * comes first. Rendered videos carry it; the preview plays it in step.
 */
export interface AudioTrack {
  mediaId: string;
  name: string;
  /** Length of the file in seconds. */
  length: number;
  /** Seconds on the clock when the sound starts. */
  offset: number;
  /** Seconds into the file where playback starts. */
  trimStart: number;
  /** 0..1 */
  volume: number;
  /** Seconds of fade at the end of the composition; 0 cuts. */
  fadeOut: number;
}

export const DOC_VERSION = 2;

export interface StudioDoc {
  version: typeof DOC_VERSION;
  name: string;
  stage: StageConfig;
  clips: Clip[];
  audio?: AudioTrack | null;
}
