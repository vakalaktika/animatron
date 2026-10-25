import { bbox, polylineLength, resample, type Point } from "@/app/components/motion-studio/engine/rainbow";
import { DEFAULT_TRAIL } from "@/app/components/motion-studio/engine/trail";
import type { RibbonClip, SpriteClip, StageConfig } from "@/app/components/motion-studio/types";
import { makeChippy, makeRibbon } from "../presets";
import { svgSpriteFrom } from "./svgSprite";

/**
 * Squiggle Studio → Motion Studio handoff. A squiggle is parked in
 * sessionStorage under this key, the browser navigates to the studio, and the
 * studio takes it on mount. sessionStorage (not the URL) because a squiggle
 * can be hundreds of points, and it's per tab so two tabs don't collide.
 */
export const HANDOFF_KEY = "motion-studio.handoff.v1";

export type Handoff =
  | {
      /** Chippy flies the squiggle and paints the rainbow behind. */
      kind: "flight";
      points: Point[];
      colors: string[];
      band: number;
    }
  | {
      /** The squiggle becomes a ribbon clip that paints itself in. */
      kind: "ribbon";
      points: Point[];
      colors: string[];
      band: number;
    }
  | {
      /** The squiggle arrives as a still picture that can move like any sprite. */
      kind: "artwork";
      svg: string;
      label: string;
    };

export function writeHandoff(handoff: Handoff): boolean {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
    return true;
  } catch {
    // The caller just doesn't navigate, so the Send button looks dead.
    return false;
  }
}

/** Reads and clears the pending handoff, so a reload doesn't add it twice. */
export function takeHandoff(): Handoff | null {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(HANDOFF_KEY);
    const parsed: unknown = JSON.parse(raw);
    return isHandoff(parsed) ? parsed : null;
  } catch {
    // Only writeHandoff writes this key, so unreadable storage or JSON is a bug.
    return null;
  }
}

function isHandoff(v: unknown): v is Handoff {
  if (typeof v !== "object" || v === null) return false;
  const h = v as Record<string, unknown>;
  if (h.kind === "flight" || h.kind === "ribbon") return Array.isArray(h.points) && Array.isArray(h.colors) && typeof h.band === "number";
  if (h.kind === "artwork") return typeof h.svg === "string" && typeof h.label === "string";
  return false;
}

/** Fraction of the stage the squiggle is scaled to fill, so Chippy has room at the edges. */
const FIT = 0.8;
/** Waypoints a short squiggle is reduced to; each becomes a draggable dot on stage. */
const WAYPOINTS = 18;
/** Never space waypoints further than this, so a long squiggle's loops stay round. */
const MAX_WAYPOINT_GAP = 80;
const waypointStep = (length: number) => Math.min(MAX_WAYPOINT_GAP, Math.max(20, length / WAYPOINTS));
/** Stage pixels Chippy covers per second, clamped to a sensible flight time. */
const SPEED = 520;
const MIN_DURATION = 1.5;
const MAX_DURATION = 8;

/**
 * `resample` always keeps the true endpoint, which can land a hair after the
 * last regular sample. Two near-coincident final waypoints make the spline's
 * last heading arbitrary, so the sprite may land facing the wrong way; drop
 * the crowded one.
 */
function dropCrowdedEnd(pts: Point[], minGap: number): Point[] {
  if (pts.length < 3) return pts;
  const [lx, ly] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  return Math.hypot(lx - px, ly - py) < minGap ? [...pts.slice(0, -2), pts[pts.length - 1]] : pts;
}

/** The squiggle scaled to fill `FIT` of the stage and centred, with its scale factor. */
function fitToStage(points: Point[], stage: Pick<StageConfig, "width" | "height">): { fitted: Point[]; scale: number } {
  const [bx, by, bw, bh] = bbox(points, 0);
  const scale = Math.min((stage.width * FIT) / Math.max(1, bw), (stage.height * FIT) / Math.max(1, bh), 4);
  const dx = (stage.width - bw * scale) / 2 - bx * scale;
  const dy = (stage.height - bh * scale) / 2 - by * scale;
  return { fitted: points.map(([x, y]) => [x * scale + dx, y * scale + dy]), scale };
}

/**
 * Turns a drawn squiggle into a ribbon that paints itself in: fitted to the
 * stage, thinned to waypoints, anchored on its first point. Stripe width
 * scales with the drawing; paint time scales with its length.
 */
export function ribbonFromSquiggle(
  points: Point[],
  colors: string[],
  band: number,
  stage: Pick<StageConfig, "width" | "height">,
): RibbonClip {
  const { fitted, scale } = fitToStage(points, stage);
  const length = polylineLength(fitted);
  const waypoints = dropCrowdedEnd(resample(fitted, waypointStep(length)), 10);
  const [ax, ay] = waypoints[0];
  return makeRibbon({
    name: "Squiggle ribbon",
    start: 0,
    x: ax,
    y: ay,
    points: waypoints.map(([x, y]) => ({ x: x - ax, y: y - ay })),
    colors: colors.slice(),
    band: Math.max(2, band * scale),
    duration: Math.min(MAX_DURATION, Math.max(MIN_DURATION, length / SPEED)),
  });
}

/**
 * Turns a drawn squiggle into a Chippy flight that paints it. The squiggle is
 * scaled to fit the stage and centred; its points are thinned to a handful
 * of waypoints (the spline through them re-smooths the curve); the last point
 * becomes the landing anchor because a sprite's path is anchor-relative with
 * (0, 0) at the end. Stripe width scales with the drawing.
 */
export function flightFromSquiggle(
  points: Point[],
  colors: string[],
  band: number,
  stage: Pick<StageConfig, "width" | "height">,
): SpriteClip {
  const { fitted, scale } = fitToStage(points, stage);
  const length = polylineLength(fitted);
  const step = waypointStep(length);
  const waypoints = dropCrowdedEnd(resample(fitted, step), step / 2);
  const [ax, ay] = waypoints[waypoints.length - 1];
  const duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, length / SPEED));

  return makeChippy({
    name: "Chippy on a squiggle",
    start: 0,
    x: ax,
    y: ay,
    path: waypoints.map(([x, y]) => ({ x: x - ax, y: y - ay })),
    duration,
    ease: { name: "flight" },
    bank: 0.45,
    autoFlip: true,
    scaleFrom: 1,
    trail: { ...DEFAULT_TRAIL, enabled: true, colors: colors.slice(), band: Math.max(2, band * scale) },
  });
}

/**
 * The squiggle's exported SVG as a still sprite, centred on the stage and
 * starting at once; it can then follow a path like any imported picture.
 * Null when the SVG can't be read.
 */
export function artworkFromSquiggle(svg: string, label: string, stage: Pick<StageConfig, "width" | "height">): SpriteClip | null {
  return svgSpriteFrom(svg, label, stage, { start: 0 });
}
