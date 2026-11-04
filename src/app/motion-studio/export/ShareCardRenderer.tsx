"use client";

import { frameData, frameSteps, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { createFrameSync } from "@/app/components/motion-studio/engine/media";
import { FrameSyncContext } from "@/app/components/motion-studio/engine/useMedia";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { drawShareCard, snapshotStage } from "./shareCard";

interface Props {
  doc: StudioDoc;
  /** Seconds into the composition to picture. */
  time: number;
  onReady: (card: Blob) => void;
  onError: (error: Error) => void;
}

const STEPS = ["setup", "read", "resolveKeyframes", "preUpdate", "update", "preRender", "render", "postRender"] as const;

/**
 * Mounts a copy of the stage off screen at native size, parks its clock on
 * one moment and hands back that frame drawn onto the share card. Lives
 * only as long as the picture takes; the owner unmounts it on either
 * callback.
 */
export function ShareCardRenderer({ doc, time, onReady, onError }: Props) {
  const clock = useMotionValue(time);
  const nodeRef = useRef<HTMLDivElement>(null);
  const sync = useMemo(() => createFrameSync(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        clock.set(time);
        for (const step of STEPS) frameSteps[step].process(frameData);
        await sync.settle(time);
        // Fonts and pictures inside the stage load on their own schedule;
        // one frame's grace catches the common case before the snapshot.
        await new Promise((resolve) => setTimeout(resolve, 120));
        const node = nodeRef.current;
        if (!node) throw new Error("The stage is not ready");
        const frame = await snapshotStage(node, doc.stage.width, doc.stage.height);
        const card = await drawShareCard(frame, doc.stage);
        if (!cancelled) onReady(card);
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err : new Error("Could not draw the preview card"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // One picture per mount, of the document and moment it was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed top-0 left-0 -z-50 opacity-0" style={{ transform: "translateX(-200vw)" }}>
      <div ref={nodeRef} style={{ width: doc.stage.width, height: doc.stage.height }}>
        <FrameSyncContext.Provider value={sync}>
          <StageCanvas doc={doc} time={clock} />
        </FrameSyncContext.Provider>
      </div>
    </div>
  );
}
