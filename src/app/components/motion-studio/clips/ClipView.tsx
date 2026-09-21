"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { transformAt } from "../engine/transform";
import type { Clip, StudioDoc } from "../types";
import { LogoClipView } from "./LogoClipView";
import { LottieClipView } from "./LottieClipView";
import { SpriteClipView } from "./SpriteClipView";
import { TextClipView } from "./TextClipView";

/** Picks the renderer for a clip. The only place the stage switches on type. */
function ClipArt({ clip, doc, time }: { clip: Clip; doc: StudioDoc; time: MotionValue<number> }) {
  switch (clip.type) {
    case "logo":
      return <LogoClipView clip={clip} time={time} />;
    case "sprite":
      return <SpriteClipView clip={clip} time={time} />;
    case "text":
      return <TextClipView clip={clip} doc={doc} time={time} />;
    case "lottie":
      return <LottieClipView clip={clip} time={time} />;
  }
}

/**
 * Places a clip on the stage from its world transform, composed down the
 * parent chain by the engine every frame. Renderers draw with their anchor at
 * (0, 0) and never position themselves; that keeps an attached clip glued to
 * its parent through flight, bank, squash, flip, and fade.
 */
export function ClipView({
  clip,
  doc,
  time,
}: {
  clip: Clip;
  doc: StudioDoc;
  time: MotionValue<number>;
}) {
  const world = useTransform(time, (t) => transformAt(doc, clip.id, t));
  const x = useTransform(world, (w) => w.x);
  const y = useTransform(world, (w) => w.y);
  const rotate = useTransform(world, (w) => w.rotation);
  const scaleX = useTransform(world, (w) => w.scaleX);
  const scaleY = useTransform(world, (w) => w.scaleY);
  const opacity = useTransform(world, (w) => w.opacity);

  return (
    <motion.div
      data-clip-id={clip.id}
      className="absolute left-0 top-0 h-0 w-0 origin-top-left overflow-visible"
      style={{ x, y, rotate, scaleX, scaleY, opacity }}
    >
      <ClipArt clip={clip} doc={doc} time={time} />
    </motion.div>
  );
}
