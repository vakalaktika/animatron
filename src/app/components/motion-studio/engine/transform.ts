import type { Clip, RigClip, SpriteClip, StudioDoc, TextClip, Vec2 } from "../types";
import { clamp01, lerp } from "./easing";
import { ancestorChain } from "./hierarchy";
import { placementAt, propValue, restPlacement, restValue, type Placement } from "./keys";
import { ribbonHead, ribbonPointAt } from "./ribbon";
import { spriteActiveDuration, spritePath, spriteProgress, waypointValuesAt } from "./spriteTiming";
import { revealTransform } from "./text";
import { flowsOnRibbon } from "./textFlow";
import { LANDING_SQUASH_SECONDS } from "./timing";

/**
 * A clip's placement on the stage at one instant. Views render it as
 * translate → scale → rotate about the clip's anchor, which is also the order
 * `motion` emits for `x / y / scaleX / scaleY / rotate`, so a point `q` in the
 * clip's local space lands at `position + scale ⊙ R(rotation) · q`.
 */
export interface WorldTransform {
  x: number;
  y: number;
  /** Degrees, clockwise on screen. */
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export const IDENTITY: WorldTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

const DEG = Math.PI / 180;
// Width of the turn-around window, as the cosine of the travel angle. The
// mirror runs 1 → 0 → -1 while the direction is within ~30° of vertical.
const FLIP_WINDOW = 0.5;
const MIN_SCALE = 1e-6;

/**
 * Travel angle folded into -90..90 so a sprite stays upright whether it is
 * moving left or right. atan2(sin, |cos|) is continuous through vertical, so
 * the bank never jumps.
 */
export function foldedHeading(angleDeg: number): number {
  const a = angleDeg * DEG;
  return Math.atan2(Math.sin(a), Math.abs(Math.cos(a))) / DEG;
}

/**
 * Horizontal mirror for a sprite that faces +x: 1 moving right, -1 moving
 * left, easing through 0 near vertical so the turn reads as the sprite
 * wheeling around rather than snapping.
 */
export function facing(angleDeg: number): number {
  const c = Math.cos(angleDeg * DEG) / FLIP_WINDOW;
  const u = Math.min(1, Math.abs(c));
  const eased = u * u * (3 - 2 * u);
  return c < 0 ? -eased : eased;
}

function landingSquash(clip: SpriteClip, t: number): number {
  if (clip.loop || clip.source.kind !== "chippy" || clip.landing.squash <= 0) return 1;
  const since = t - (clip.start + spriteActiveDuration(clip));
  if (since < 0 || since > LANDING_SQUASH_SECONDS) return 1;
  const u = since / LANDING_SQUASH_SECONDS;
  const bump = Math.sin(u * Math.PI) * (u < 0.5 ? -1 : 0.3);
  return 1 + bump * clip.landing.squash;
}

function spriteLocal(clip: SpriteClip, place: Placement, t: number): WorldTransform {
  const p = spriteProgress(clip, t);
  const sample = spritePath(clip).at(p);
  const settle = clip.loop ? 1 : 1 - p;
  const grow = clip.loop ? 1 : lerp(clip.scaleFrom, 1, p);
  const point = waypointValuesAt(clip, sample);
  const local = t - clip.start;
  const fade = local < 0 ? 0 : clip.fadeIn > 0 ? clamp01(local / clip.fadeIn) : 1;
  return {
    x: place.x + sample.x,
    y: place.y + sample.y,
    rotation: foldedHeading(sample.angle) * clip.bank * settle + point.rotate,
    scaleX: place.scale * grow * point.scale * (clip.autoFlip ? facing(sample.angle) : 1),
    scaleY: place.scale * grow * point.scale * landingSquash(clip, t),
    opacity: fade * point.opacity,
  };
}

function textLocal(clip: TextClip, place: Placement, t: number): WorldTransform {
  const { scale, opacity } = revealTransform(clip, t);
  const s = place.scale * scale;
  return { x: place.x, y: place.y, rotation: 0, scaleX: s, scaleY: s, opacity };
}

/** A rig is simply absent before its start, then stands (or plays) in place. */
function rigLocal(clip: RigClip, place: Placement, t: number): WorldTransform {
  return { x: place.x, y: place.y, rotation: 0, scaleX: place.scale, scaleY: place.scale, opacity: t < clip.start ? 0 : 1 };
}

/** The clip's own turn and opacity (keyed or not), applied over whatever its animation does. */
function styled(place: Placement, local: WorldTransform): WorldTransform {
  if (place.rotation === 0 && place.opacity === 1) return local;
  return { ...local, rotation: local.rotation + place.rotation, opacity: local.opacity * place.opacity };
}

function still(place: Placement): WorldTransform {
  return styled(place, { x: place.x, y: place.y, rotation: 0, scaleX: place.scale, scaleY: place.scale, opacity: 1 });
}

/** The clip's placement with no animation applied: where it sits when settled (keyed properties at their last key). */
export function restLocal(clip: Clip): WorldTransform {
  return still(restPlacement(clip));
}

/** The clip's own animated placement at time `t`, ignoring any parent. Keyframed properties are read at `t`. */
export function localTransformAt(clip: Clip, t: number): WorldTransform {
  const place = placementAt(clip, t);
  switch (clip.type) {
    case "sprite":
      return styled(place, spriteLocal(clip, place, t));
    case "text":
      return styled(place, textLocal(clip, place, t));
    case "rig":
      return styled(place, rigLocal(clip, place, t));
    case "logo":
    case "lottie":
    case "ribbon":
      return still(place);
  }
}

/**
 * A clip seated on a ribbon parent (`along`) is placed at that point of the
 * ribbon, offset by its own x / y; riding the front follows the paint head
 * at time `t` (or sits at the end when asked for the rest pose). With
 * `followRotation` it also turns with the ribbon's heading there, folded so
 * it never hangs upside down.
 *
 * Text flowing along the ribbon is laid out glyph by glyph in the ribbon's
 * own frame (engine/textFlow.ts), so its frame stays on the ribbon's anchor:
 * `x` / `y` become a slide along and a lift off the line, and the pop
 * reveal scales each glyph in place rather than the whole run.
 */
export function seatOnRibbon(clip: Clip, parent: Clip | undefined, local: WorldTransform, t: number, rest: boolean): WorldTransform {
  if (flowsOnRibbon(clip, parent)) {
    const scale = rest ? restValue(clip, "scale") : propValue(clip, "scale", t);
    return { ...local, x: 0, y: 0, scaleX: scale, scaleY: scale };
  }
  if (!parent || parent.type !== "ribbon" || clip.along === null || clip.along === undefined) return local;
  const fraction = clip.along === "front" ? (rest ? 1 : ribbonHead(parent, t)) : clip.along;
  const seat = ribbonPointAt(parent, fraction);
  return {
    ...local,
    x: local.x + seat.x,
    y: local.y + seat.y,
    rotation: local.rotation + (clip.followRotation ? foldedHeading(seat.angle) : 0),
  };
}

/** Places `local` inside `parent`'s frame. Position and scale always inherit; rotation only on request. */
export function composeTransforms(
  parent: WorldTransform,
  local: WorldTransform,
  followRotation: boolean,
): WorldTransform {
  const r = parent.rotation * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const rx = local.x * cos - local.y * sin;
  const ry = local.x * sin + local.y * cos;
  return {
    x: parent.x + parent.scaleX * rx,
    y: parent.y + parent.scaleY * ry,
    rotation: (followRotation ? parent.rotation : 0) + local.rotation,
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY,
    opacity: parent.opacity * local.opacity,
  };
}

type LocalFn = (clip: Clip, t: number) => WorldTransform;

function worldFrom(doc: StudioDoc, clipId: string, t: number, local: LocalFn): WorldTransform {
  const chain = ancestorChain(doc, clipId);
  let world = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    const seated = seatOnRibbon(chain[i], chain[i + 1], local(chain[i], t), t, local === restLocal);
    // Flowing text is drawn in the ribbon's frame, so it always turns with it.
    const follow = chain[i].followRotation || flowsOnRibbon(chain[i], chain[i + 1]);
    world = composeTransforms(world, seated, follow);
  }
  return world;
}

/**
 * The clip's world transform at time `t`, composed down its parent chain.
 * Every view derives its placement from this, so a clip riding another one
 * matches it frame for frame. A missing clip id yields the identity.
 */
export function transformAt(doc: StudioDoc, clipId: string, t: number): WorldTransform {
  return worldFrom(doc, clipId, t, localTransformAt);
}

/** Where the clip settles once every ancestor is at rest. */
export function restTransformAt(doc: StudioDoc, clipId: string): WorldTransform {
  return worldFrom(doc, clipId, 0, restLocal);
}

/** The parent's world transform, or the identity for a root clip. */
export function parentTransformAt(doc: StudioDoc, clipId: string, t: number): WorldTransform {
  const clip = doc.clips.find((c) => c.id === clipId);
  return clip?.parentId ? transformAt(doc, clip.parentId, t) : IDENTITY;
}

const safeScale = (s: number) => (Math.abs(s) < MIN_SCALE ? 1 : s);

/** Maps a stage-space direction into `frame`'s local space (ignores translation). */
export function toLocalDelta(frame: WorldTransform, delta: Vec2): Vec2 {
  const dx = delta.x / safeScale(frame.scaleX);
  const dy = delta.y / safeScale(frame.scaleY);
  const r = -frame.rotation * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** Maps a stage-space point into `frame`'s local space. */
export function toLocalPoint(frame: WorldTransform, point: Vec2): Vec2 {
  return toLocalDelta(frame, { x: point.x - frame.x, y: point.y - frame.y });
}

/** Maps a local point of `frame` out to stage space. */
export function toWorldPoint(frame: WorldTransform, point: Vec2): Vec2 {
  const r = frame.rotation * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: frame.x + frame.scaleX * (point.x * cos - point.y * sin),
    y: frame.y + frame.scaleY * (point.x * sin + point.y * cos),
  };
}
