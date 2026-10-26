"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { lineNeedsShape } from "../engine/line";
import {
  ribbonBands,
  ribbonCenterline,
  ribbonCoat,
  ribbonCoatBands,
  ribbonOpacity,
  ribbonSubject,
  ribbonWindow,
} from "../engine/ribbon";
import { propValue } from "../engine/keys";
import { parentTransformAt } from "../engine/transform";
import type { RibbonClip, StudioDoc } from "../types";
import { SvgFrame } from "./SvgFrame";
import { RainbowDashes, RainbowSolid } from "./RainbowDashes";
import { ShapedLineView } from "./ShapedLineView";

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
 * own colours lit per its line style; the resting coat (if a repaint has
 * completed) covering it whole; the sweep in flight painting the next coat.
 * A plain painted line is drawn as dashes; a shaped one (taper, braid, nib,
 * ...) is rebuilt per frame by `ShapedLineView`.
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
  const opacity = useTransform(time, (t) => ribbonOpacity(clip, t) * propValue(clip, "opacity", t));
  // The bands bake in the clip's own x / y; keyframes on them shift the bands by the difference.
  const frame = useTransform(time, (t) => {
    const w = parentTransformAt(doc, clip.id, t);
    const dx = propValue(clip, "x", t) - clip.x;
    const dy = propValue(clip, "y", t) - clip.y;
    return `translate(${w.x} ${w.y}) scale(${w.scaleX} ${w.scaleY}) rotate(${w.rotation}) translate(${dx} ${dy})`;
  });

  if (own.length === 0) return null;
  const coats = clip.style.motion === "paint" && (clip.coat.every > 0 || (clip.coat.at?.length ?? 0) > 0);

  return (
    <motion.svg
      data-ribbon-for={clip.id}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ opacity }}
      aria-hidden="true"
    >
      <SvgFrame transform={frame}>
        {lineNeedsShape(clip.style) ? (
          <ShapedLineView
            line={ribbonCenterline(clip)}
            style={clip.style}
            subject={ribbonSubject(clip)}
            colors={clip.colors}
            band={clip.band}
            time={time}
          />
        ) : (
          <RainbowDashes bands={own} window={window} fade={false} />
        )}
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
      </SvgFrame>
    </motion.svg>
  );
}
