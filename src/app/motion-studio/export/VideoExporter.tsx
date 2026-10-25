"use client";

import { useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { Dialog } from "../dialogs/Dialog";
import { downloadBlob } from "./recorder";
import { RenderCancelled, renderVideo } from "./renderer";

interface Props {
  doc: StudioDoc;
  /** Seconds to render. */
  duration: number;
  fileStem: string;
  onDone: (message: string) => void;
  onClose: () => void;
}

const FPS = 30;

/** Two animation frames: enough for Motion to flush the new clock value into the DOM. */
const settled = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Renders the composition to a video file without screen capture. A copy of
 * the stage is mounted at native size off screen on its own clock; the
 * renderer steps that clock, rasterises each frame and encodes as it goes.
 */
export function VideoExporter({ doc, duration, fileStem, onDone, onClose }: Props) {
  const time = useMotionValue(0);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [error, setError] = useState<string | null>(null);
  const abort = useRef(new AbortController());

  useEffect(() => {
    const controller = abort.current;
    let cancelled = false;
    (async () => {
      try {
        const result = await renderVideo(
          {
            width: doc.stage.width,
            height: doc.stage.height,
            fps: FPS,
            duration,
            background: doc.stage.transparent ? "#ffffff" : doc.stage.background,
          },
          {
            node: () => nodeRef.current,
            seek: async (s) => {
              time.set(s);
              await settled();
            },
            onProgress: (done, total) => {
              if (!cancelled) setProgress({ done, total });
            },
            signal: controller.signal,
          },
        );
        if (cancelled) return;
        downloadBlob(result.blob, `${fileStem}.${result.extension}`);
        onDone(`Saved ${fileStem}.${result.extension} to your downloads.`);
      } catch (err) {
        if (cancelled || err instanceof RenderCancelled) return;
        setError(err instanceof Error ? err.message : "Rendering failed");
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // The export runs once for the document it was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed top-0 left-0 -z-50 opacity-0" style={{ transform: "translateX(-200vw)" }}>
        <div ref={nodeRef} style={{ width: doc.stage.width, height: doc.stage.height }}>
          <StageCanvas doc={doc} time={time} />
        </div>
      </div>
      <Dialog open onClose={onClose} title={error ? "Couldn't render the video" : "Rendering video"} description={error ?? `${doc.name} · ${duration.toFixed(1)}s at ${FPS} fps`}>
        {error ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-5 text-ink-secondary">You can still record this tab from the Share dialog on a desktop browser, or download the JSON and render it elsewhere.</p>
            <Button size="sm" variant="outline" className="self-start" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Rendering progress" className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${pct}%` }} />
            </div>
            <p className="font-sans text-xs tabular-nums tracking-[0.04em] text-ink-muted">
              Frame {progress.done} of {progress.total} · {pct}%
            </p>
            <p className="text-sm leading-5 text-ink-secondary">Keep this tab open; the file downloads when it is done.</p>
            <Button size="sm" variant="outline" className="self-start" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
