"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { parentTransformAt } from "../engine/transform";
import { trailBands, trailOpacity, trailWindow } from "../engine/trail";
import type { SpriteClip, StudioDoc } from "../types";
import { RainbowDashes } from "./RainbowDashes";

interface Props {
  doc: StudioDoc;
  clip: SpriteClip;
  time: MotionValue<number>;
}

/**
 * The rainbow squiggle a sprite paints along its path. The bands live in the
 * sprite's parent frame (they must not bank or flip with the sprite), so this
 * draws in a stage-sized SVG under the sprite and rides the parent's live
 * transform. The lit window comes from the sprite's own progress, so the
 * head stays under the sprite as it flies.
 */
export function SpriteTrailView({ doc, clip, time }: Props) {
  const bands = trailBands(clip);
  const window = useTransform(time, (t) => trailWindow(clip, t));
  const opacity = useTransform(time, (t) => trailOpacity(clip, t));
  const frame = useTransform(time, (t) => {
    const w = parentTransformAt(doc, clip.id, t);
    return `translate(${w.x} ${w.y}) scale(${w.scaleX} ${w.scaleY}) rotate(${w.rotation})`;
  });

  if (bands.length === 0) return null;

  return (
    <motion.svg
      data-trail-for={clip.id}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ opacity }}
      aria-hidden="true"
    >
      <motion.g transform={frame}>
        <RainbowDashes bands={bands} window={window} fade={clip.trail.mode === "comet"} />
      </motion.g>
    </motion.svg>
  );
}
