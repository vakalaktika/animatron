"use client";

import type { MotionValue } from "motion/react";
import type { ReactNode } from "react";
import { ClipView } from "./clips/ClipView";
import type { StudioDoc } from "./types";

interface Props {
  doc: StudioDoc;
  time: MotionValue<number>;
  /** CSS scale applied to the stage so it fits its container. */
  zoom?: number;
  /** Overlay rendered in stage coordinates (editor handles, guides). */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders a StudioDoc at its native stage size, optionally scaled. Clips are
 * absolutely positioned in stage pixels, so the same component serves the
 * editor, the recording view, and any page that embeds a composition.
 */
export function StageCanvas({ doc, time, zoom = 1, children, className }: Props) {
  const { width, height, background, transparent } = doc.stage;
  return (
    <div
      className={["relative overflow-hidden", className].filter(Boolean).join(" ")}
      style={{
        width,
        height,
        backgroundColor: transparent ? "transparent" : background,
        transform: `scale(${zoom})`,
        transformOrigin: "0 0",
      }}
    >
      {doc.clips
        .filter((clip) => clip.enabled)
        .map((clip) => (
          <ClipView key={clip.id} clip={clip} doc={doc} time={time} />
        ))}
      {children}
    </div>
  );
}
