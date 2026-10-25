"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { ribbonBands, ribbonCoat, ribbonCoatBands, ribbonOpacity, ribbonWindow } from "../engine/ribbon";
import { parentTransformAt } from "../engine/transform";
import type { RibbonClip, StudioDoc } from "../types";
import { RainbowDashes, RainbowSolid } from "./RainbowDashes";

interface Props {
  doc: StudioDoc;
  clip: RibbonClip;
  time: MotionValue<number>;
}

/**
 * The brand squiggle painting itself in. Like a sprite's trail it draws in
 * the parent frame (the anchor offset is baked into the bands) rather than
 * inside the clip's own transform, so it is positioned by `ClipView`'s
 * sibling placement, not by this element. Layers, bottom to top: the ribbon's
 * own colours lit along the live window; the resting coat (if a repaint has
 * completed) covering it whole; the sweep in flight painting the next coat.
 */
export function RibbonClipView({ doc, clip, time }: Props) {
  const own = ribbonBands(clip);
  const coat = ribbonCoatBands(clip);
  const window = useTransform(time, (t) => ribbonWindow(clip, t));
  const coatState = useTransform(time, (t) => ribbonCoat(clip, t));
  const restingOnCoat = useTransform(coatState, (c) => (c.resting ? 1 : 0));
  const sweepWindow = useTransform(coatState, (c) => ({ tail: 0, length: c.sweeping?.progress ?? 0 }));
  const sweepIsCoat = useTransform(coatState, (c) => (c.sweeping && c.sweeping.colors === clip.coat.colors ? 1 : 0));
  const sweepIsOwn = useTransform(coatState, (c) => (c.sweeping && c.sweeping.colors === clip.colors ? 1 : 0));
  const opacity = useTransform(time, (t) => ribbonOpacity(clip, t));
  const frame = useTransform(time, (t) => {
    const w = parentTransformAt(doc, clip.id, t);
    return `translate(${w.x} ${w.y}) scale(${w.scaleX} ${w.scaleY}) rotate(${w.rotation})`;
  });

  if (own.length === 0) return null;
  const coats = clip.mode === "paint" && clip.coat.every > 0;

  return (
    <motion.svg
      data-ribbon-for={clip.id}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ opacity }}
      aria-hidden="true"
    >
      <motion.g transform={frame}>
        <RainbowDashes bands={own} window={window} fade={clip.mode === "comet"} />
        {coats && (
          <>
            <motion.g style={{ opacity: restingOnCoat }}>
              <RainbowSolid bands={coat} />
            </motion.g>
            <motion.g style={{ opacity: sweepIsCoat }}>
              <RainbowDashes bands={coat} window={sweepWindow} fade={false} />
            </motion.g>
            <motion.g style={{ opacity: sweepIsOwn }}>
              <RainbowDashes bands={own} window={sweepWindow} fade={false} />
            </motion.g>
          </>
        )}
      </motion.g>
    </motion.svg>
  );
}
