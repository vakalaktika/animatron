"use client";

import { frameData, frameSteps, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFrameSync } from "@/app/components/motion-studio/engine/media";
import { FrameSyncContext } from "@/app/components/motion-studio/engine/useMedia";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { Dialog } from "../dialogs/Dialog";
import { mixAudio } from "./audioMix";
import { downloadBlob } from "./recorder";
import { RenderCancelled, renderVideo, type RenderFormat } from "./renderer";

export interface RenderOptions {
  format: RenderFormat;
  /** GIF only: output width in pixels. */
  gifWidth?: number;
}

interface Props {
  doc: StudioDoc;
  /** Seconds to render. */
  duration: number;
  fileStem: string;
  options: RenderOptions;
  onDone: (message: string) => void;
  onClose: () => void;
}

const FPS = 30;
const STEPS = ["setup", "read", "resolveKeyframes", "preUpdate", "update", "preRender", "render", "postRender"] as const;

/**
 * Runs Motion's frame loop by hand so the DOM shows the new clock value at
 * once. Waiting for animation frames instead would tie the render to the
 * browser's frame rate, and a hidden or covered tab gets one frame a second.
 */
function flushFrame() {
  for (const step of STEPS) frameSteps[step].process(frameData);
}

const FORMAT_LABEL: Record<RenderFormat, string> = { mp4: "MP4 video", webm: "WebM video", gif: "GIF" };

/**
 * Renders the composition to a file without screen capture. A copy of the
 * stage is mounted at native size off screen on its own clock; the renderer
 * steps that clock, waits for any video layers to seek, rasterises each
 * frame and encodes as it goes.
 */
export function VideoExporter({ doc, duration, fileStem, options, onDone, onClose }: Props) {
  const time = useMotionValue(0);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [stage, setStage] = useState<"sound" | "frames">("frames");
  const [error, setError] = useState<string | null>(null);
  const abort = useRef(new AbortController());
  const sync = useMemo(() => createFrameSync(), []);

  useEffect(() => {
    const controller = abort.current;
    let cancelled = false;
    (async () => {
      try {
        let audio: AudioBuffer | null = null;
        if (doc.audio && options.format !== "gif") {
          setStage("sound");
          audio = await mixAudio(doc.audio, duration).catch(() => null);
          if (cancelled) return;
          setStage("frames");
        }
        const alpha = doc.stage.transparent && options.format !== "mp4";
        const result = await renderVideo(
          {
            width: doc.stage.width,
            height: doc.stage.height,
            fps: FPS,
            duration,
            background: doc.stage.transparent ? "#ffffff" : doc.stage.background,
            format: options.format,
            alpha,
            gifWidth: options.gifWidth,
            audio,
          },
          {
            node: () => nodeRef.current,
            seek: async (s) => {
              time.set(s);
              flushFrame();
              await sync.settle(s);
            },
            onProgress: (done, total) => {
              if (!cancelled) setProgress({ done, total });
            },
            signal: controller.signal,
          },
        );
        if (cancelled) return;
        const name = `${fileStem}.${result.extension}`;
        downloadBlob(result.blob, name);
        const wantedSound = !!doc.audio && options.format !== "gif";
        const note = !wantedSound
          ? ""
          : result.silent || !audio
            ? " This browser couldn't add the sound, so the file is silent."
            : result.audioCodec === "opus" && result.extension === "mp4"
              ? " The sound is Opus (this browser has no AAC encoder): fine in Chrome, Firefox and VLC; QuickTime may stay silent."
              : "";
        onDone(`Saved ${name} to your downloads.${note}`);
      } catch (err) {
        if (cancelled || err instanceof RenderCancelled) return;
        setError(err instanceof Error ? err.message : "Rendering failed");
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // The export runs once for the document and options it was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round((progress.done / progress.total) * 100);
  const label = FORMAT_LABEL[options.format];
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed top-0 left-0 -z-50 opacity-0" style={{ transform: "translateX(-200vw)" }}>
        <div ref={nodeRef} style={{ width: doc.stage.width, height: doc.stage.height }}>
          <FrameSyncContext.Provider value={sync}>
            <StageCanvas doc={doc} time={time} />
          </FrameSyncContext.Provider>
        </div>
      </div>
      <Dialog open onClose={onClose} title={error ? `Couldn't render the ${label}` : `Rendering ${label}`} description={error ?? `${doc.name} · ${duration.toFixed(1)}s${options.format === "gif" ? "" : ` at ${FPS} fps`}`}>
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
              {stage === "sound" ? "Mixing the sound…" : `Frame ${progress.done} of ${progress.total} · ${pct}%`}
            </p>
            <p className="text-sm leading-5 text-ink-secondary">Keep this page open (switching tabs is fine); the file downloads when it is done.</p>
            <Button size="sm" variant="outline" className="self-start" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
