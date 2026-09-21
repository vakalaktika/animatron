"use client";

import { useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import {
  CHIPPY_ANCHOR,
  CHIPPY_BEAK,
  CHIPPY_BEAK_DARK,
  CHIPPY_BEAK_SHADOW,
  CHIPPY_BODY,
  CHIPPY_COLORS,
  CHIPPY_EYE,
  CHIPPY_TAIL,
  CHIPPY_VIEWBOX,
  CHIPPY_WING,
  CHIPPY_WING_FILL,
  CHIPPY_WING_PIVOT,
} from "../assets/chippyPaths";
import { clamp01, EASE_PRESETS, lerp } from "../engine/easing";
import { spriteActiveDuration } from "../engine/spriteTiming";
import { svgDataUrl } from "../engine/svgText";
import { IDLE_FLAP_SECONDS } from "../engine/timing";
import type { SpriteClip } from "../types";

interface Props {
  clip: SpriteClip;
  time: MotionValue<number>;
}

const IDLE_FLAP_DEPTH = 13;
const TWO_PI = Math.PI * 2;

/** Wing angle in degrees for a given clock time: flapping, settling, then folding. */
function wingAngle(clip: SpriteClip, t: number): number {
  const local = t - clip.start;
  if (local < 0) return 0;
  const { hz, depth } = clip.flap;
  // Wings keep beating through holds: the bird hovers at the waypoint.
  const flying = spriteActiveDuration(clip);
  if (clip.loop || local < flying) {
    return -depth * (0.5 - 0.5 * Math.cos(TWO_PI * hz * local));
  }
  const sinceLanding = local - flying;
  const settleEnd = clip.landing.settleFlaps * IDLE_FLAP_SECONDS;
  if (sinceLanding < settleEnd) {
    return -IDLE_FLAP_DEPTH * (0.5 - 0.5 * Math.cos((TWO_PI * sinceLanding) / IDLE_FLAP_SECONDS));
  }
  const fold = clamp01((sinceLanding - settleEnd) / Math.max(0.001, clip.landing.foldDuration));
  return lerp(0, clip.landing.foldAngle, EASE_PRESETS.smoothOut(fold));
}

function ChippyArt({ clip, time }: Props) {
  const wingRef = useRef<SVGGElement>(null);
  const wing = useTransform(time, (t) => wingAngle(clip, t));
  useMotionValueEvent(wing, "change", (deg) => {
    const scale = clip.landing.foldAngle !== 0 && deg !== 0 ? lerp(1, 0.8, clamp01(deg / clip.landing.foldAngle)) : 1;
    wingRef.current?.setAttribute(
      "transform",
      `rotate(${deg} ${CHIPPY_WING_PIVOT.x} ${CHIPPY_WING_PIVOT.y}) translate(${CHIPPY_WING_PIVOT.x} ${CHIPPY_WING_PIVOT.y}) scale(${scale}) translate(${-CHIPPY_WING_PIVOT.x} ${-CHIPPY_WING_PIVOT.y})`,
    );
  });

  return (
    <svg
      viewBox={`0 0 ${CHIPPY_VIEWBOX.width} ${CHIPPY_VIEWBOX.height}`}
      className="h-full w-full"
      aria-hidden="true"
    >
      <path d={CHIPPY_BODY} fill={CHIPPY_COLORS.body} />
      <path d={CHIPPY_BEAK} fill={CHIPPY_COLORS.beak} />
      <path d={CHIPPY_BEAK_SHADOW} fill={CHIPPY_COLORS.wing} />
      <path d={CHIPPY_BEAK_DARK} fill={CHIPPY_COLORS.dark} />
      <path d={CHIPPY_EYE} fill={CHIPPY_COLORS.dark} />
      <path d={CHIPPY_WING_FILL} fill={CHIPPY_COLORS.body} />
      <g ref={wingRef}>
        <path d={CHIPPY_WING} fill={CHIPPY_COLORS.wing} />
      </g>
      <path d={CHIPPY_TAIL} fill={CHIPPY_COLORS.wing} />
    </svg>
  );
}

/**
 * Any sprite (Chippy or an imported image), drawn with its anchor at (0, 0).
 * Path travel, bank, flip, squash, and fade come from the engine's world
 * transform via ClipView; this only draws the art and the wing.
 */
export function SpriteClipView({ clip, time }: Props) {
  const { source } = clip;
  const isChippy = source.kind === "chippy";
  const aspect = source.kind === "chippy" ? CHIPPY_VIEWBOX.height / CHIPPY_VIEWBOX.width : source.aspect;
  const src = source.kind === "image" ? source.dataUrl : source.kind === "svg" ? svgDataUrl(source) : null;
  const width = clip.width;
  const height = width * aspect;
  const anchor = isChippy ? CHIPPY_ANCHOR : { x: 0.5, y: 0.5 };

  return (
    <div
      className="absolute"
      style={{ left: -width * anchor.x, top: -height * anchor.y, width, height }}
    >
      {isChippy ? (
        <ChippyArt clip={clip} time={time} />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={Math.round(width)}
          height={Math.round(height)}
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
      ) : null}
    </div>
  );
}
