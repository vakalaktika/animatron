"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { lineNeedsShape } from "../engine/line";
import { parentTransformAt } from "../engine/transform";
import { trailBands, trailCenterline, trailOpacity, trailShift, trailSubject, trailWindow } from "../engine/trail";
import type { SpriteClip, StudioDoc } from "../types";
import { RainbowDashes } from "./RainbowDashes";
import { ShapedLineView } from "./ShapedLineView";

interface Props {
  doc: StudioDoc;
  clip: SpriteClip;
  time: MotionValue<number>;
}

/**
 * The rainbow squiggle a sprite paints along its path. The bands live in the
 * sprite's parent frame (they must not bank or flip with the sprite), so this
 * draws in a stage-sized SVG under the sprite and rides the parent's live
 * transform. The lit stretch comes from the sprite's own progress, so the
 * head stays under the sprite as it flies. A plain painted trail is drawn
 * as dashes; a shaped one (a tapering comet, a braid, ...) is rebuilt per
 * frame by `ShapedLineView`.
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
        {lineNeedsShape(clip.trail.style) ? (
          <ShapedLineView
            line={trailCenterline(clip)}
            style={clip.trail.style}
            subject={trailSubject(clip)}
            colors={clip.trail.colors}
            band={clip.trail.band}
            time={time}
            shift={trailShift(clip)}
          />
        ) : (
          <RainbowDashes bands={bands} window={window} fade={false} />
        )}
      </motion.g>
    </motion.svg>
  );
}
