"use client";

import type { MotionValue } from "motion/react";
import { useId, type ReactNode } from "react";
import { validStageMask } from "./engine/stageMask";
import { ClipView } from "./clips/ClipView";
import type { Clip, StudioDoc } from "./types";

interface Props {
  doc: StudioDoc;
  time: MotionValue<number>;
  /** CSS scale applied to the stage so it fits its container. */
  zoom?: number;
  /** Overlay rendered in stage coordinates (editor handles, guides). */
  children?: ReactNode;
  className?: string;
  /** Let art run past the stage edges (a ribbon bleeding off a hero band). */
  overflow?: "hidden" | "visible";
}

/** Clip the complete layer (including its trail) in the stationary stage frame. */
function StageLayer({ clip, doc, time }: { clip: Clip; doc: StudioDoc; time: MotionValue<number> }) {
  const id = `stage-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const mask = clip.stageMask;
  if (mask === undefined) return <ClipView clip={clip} doc={doc} time={time} />;
  // Fail closed even for an invalid in-memory document that bypassed import.
  if (!validStageMask(mask)) return null;
  return <div data-stage-mask={clip.id} className="absolute left-0 top-0" style={{ width: doc.stage.width, height: doc.stage.height, clipPath: `url(#${id})` }}>
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs><clipPath id={id} clipPathUnits="userSpaceOnUse">{mask.regions.map((points, i) => <polygon key={i} clipRule="evenodd" points={points.map(p => `${p.x},${p.y}`).join(" ")} />)}</clipPath></defs>
    </svg>
    <ClipView clip={clip} doc={doc} time={time} />
  </div>;
}

/**
 * Renders a StudioDoc at its native stage size, optionally scaled. Clips are
 * absolutely positioned in stage pixels, so the same component serves the
 * editor, the recording view, and any page that embeds a composition.
 */
export function StageCanvas({ doc, time, zoom = 1, children, className, overflow = "hidden" }: Props) {
  const { width, height, background, transparent } = doc.stage;
  return (
    <div
      className={["relative", overflow === "hidden" ? "overflow-hidden" : "overflow-visible", className].filter(Boolean).join(" ")}
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
          <StageLayer key={clip.id} clip={clip} doc={doc} time={time} />
        ))}
      {children}
    </div>
  );
}
