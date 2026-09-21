"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { LOGO_LAYERS, LOGO_LETTER, LOGO_VIEWBOX } from "../assets/logoPaths";
import { backOut, clamp01, EASE_PRESETS, lerp } from "../engine/easing";
import type { LogoClip } from "../types";

interface Props {
  clip: LogoClip;
  time: MotionValue<number>;
}

function LogoLayer({
  clip,
  index,
  time,
}: Props & { index: number }) {
  const startAt = clip.start + index * clip.layerStagger;
  const ease = backOut(clip.overshoot);
  const progress = useTransform(time, (t) =>
    clamp01((t - startAt) / clip.layerDuration),
  );
  const scale = useTransform(progress, (p) => lerp(clip.entryScale, 1, ease(p)));
  const rotate = useTransform(progress, (p) =>
    lerp(clip.entryRotate, 0, EASE_PRESETS.smoothOut(p)),
  );
  const opacity = useTransform(progress, (p) => clamp01(p * 6));
  const layer = LOGO_LAYERS[index];

  return (
    <motion.svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      style={{ scale, rotate, opacity }}
    >
      <path d={layer.d} fill={layer.fill} />
    </motion.svg>
  );
}

function LogoLetter({ clip, time }: Props) {
  const traceAt = clip.start + clip.traceDelay;
  const fillAt = traceAt + clip.traceDuration * 0.7;
  const pathLength = useTransform(time, (t) =>
    EASE_PRESETS.inOut(clamp01((t - traceAt) / clip.traceDuration)),
  );
  const strokeOpacity = useTransform(time, (t) => (t >= traceAt ? 1 : 0));
  const fillOpacity = useTransform(time, (t) =>
    clamp01((t - fillAt) / clip.fillDuration),
  );

  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <motion.path
        d={LOGO_LETTER}
        fill="#000000"
        stroke="#000000"
        strokeWidth={10}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ pathLength, strokeOpacity, fillOpacity }}
      />
    </svg>
  );
}

/** The logo building itself: rings spring in back to front, then the A traces and fills. Centered on (0, 0). */
export function LogoClipView({ clip, time }: Props) {
  const size = clip.size;
  return (
    <div className="absolute" style={{ left: -size / 2, top: -size / 2, width: size, height: size }}>
      {LOGO_LAYERS.map((layer, i) => (
        <LogoLayer key={layer.fill + i} clip={clip} index={i} time={time} />
      ))}
      <LogoLetter clip={clip} time={time} />
    </div>
  );
}
