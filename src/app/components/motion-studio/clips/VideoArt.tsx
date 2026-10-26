"use client";

import { useAnimationFrame, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { mediaUrl } from "../engine/media";
import { useFrameSync, useMediaUrl } from "../engine/useMedia";
import type { SpriteClip } from "../types";

type VideoSource = Extract<SpriteClip["source"], { kind: "video" }>;

interface Props {
  clip: SpriteClip;
  source: VideoSource;
  time: MotionValue<number>;
  width: number;
  height: number;
}

/** Longest the renderer waits for a seek before it captures whatever is showing. */
const SEEK_TIMEOUT_MS = 4000;
/** How far the free-running video may drift from the clock before it is snapped back. */
const DRIFT_SECONDS = 0.15;

/** Resolves on the event, on a decode error, or after `timeout`; says which. */
const once = (el: HTMLMediaElement, event: string, timeout: number) =>
  new Promise<"ok" | "error" | "timeout">((resolve) => {
    const timer = window.setTimeout(() => finish("timeout"), timeout);
    function finish(how: "ok" | "error" | "timeout") {
      window.clearTimeout(timer);
      el.removeEventListener(event, onEvent);
      el.removeEventListener("error", onError);
      resolve(how);
    }
    const onEvent = () => finish("ok");
    const onError = () => finish("error");
    el.addEventListener(event, onEvent);
    el.addEventListener("error", onError);
  });

/**
 * A video playing on the stage. The frames are copied into a canvas each
 * animation frame so the renderer, which snapshots the DOM through an SVG
 * foreignObject, sees them too (a `<video>` element rasterises blank). In the
 * editor the video free-runs with the clock and is nudged back when it
 * drifts; during a render it seeks to each exact moment instead.
 */
export function VideoArt({ clip, source, time, width, height }: Props) {
  const url = useMediaUrl(source.mediaId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef(Number.NaN);
  // Set once the file fails to decode or load: later frames stop waiting on it.
  const broken = useRef(false);
  const sync = useFrameSync();

  const fileEnd = Math.min(source.length || Infinity, source.trimStart + source.playFor);
  /** Seconds into the file for a clock time. */
  const fileTimeAt = useCallback(
    (t: number) => {
      const local = Math.min(Math.max(0, t - clip.start), source.playFor);
      return Math.min(source.trimStart + local, Math.max(source.trimStart, fileEnd - 0.001));
    },
    [clip.start, source.playFor, source.trimStart, fileEnd],
  );

  const paint = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.readyState < 2 || v.videoWidth === 0) return;
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
  }, []);

  // Editor: follow the clock, playing while it advances.
  useAnimationFrame(() => {
    if (sync) return;
    const v = videoRef.current;
    if (!v || !url || v.readyState < 1) return;
    const t = time.get();
    const target = fileTimeAt(t);
    const advancing = t > last.current && t - last.current < 0.25;
    last.current = t;
    const showing = t >= clip.start && t < clip.start + source.playFor && target < fileEnd - 0.05;
    if (advancing && showing) {
      if (v.paused) void v.play().catch(() => undefined);
    } else if (!v.paused) v.pause();
    if (Math.abs(v.currentTime - target) > DRIFT_SECONDS) v.currentTime = target;
    paint();
  });

  // Render: seek precisely and report when the frame is on the canvas.
  useEffect(() => {
    if (!sync) return;
    return sync.register(async (s) => {
      const v = videoRef.current;
      if (!v || broken.current) return;
      if (!v.src) {
        // A cold start: the object URL may not be in the cache yet.
        const fresh = await mediaUrl(source.mediaId);
        if (!fresh) {
          broken.current = true;
          return;
        }
        v.src = fresh;
      }
      if (!v.paused) v.pause();
      if (v.readyState < 2 && (await once(v, "loadeddata", SEEK_TIMEOUT_MS)) !== "ok") {
        broken.current = true;
        return;
      }
      const target = fileTimeAt(s);
      if (Math.abs(v.currentTime - target) > 0.0005) {
        const seeked = once(v, "seeked", SEEK_TIMEOUT_MS);
        v.currentTime = target;
        if ((await seeked) === "error") {
          broken.current = true;
          return;
        }
      }
      paint();
    });
  }, [sync, source.mediaId, fileTimeAt, paint]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url) return;
    v.currentTime = fileTimeAt(time.get());
    const onReady = () => paint();
    v.addEventListener("loadeddata", onReady);
    return () => v.removeEventListener("loadeddata", onReady);
  }, [url, fileTimeAt, time, paint]);

  return (
    <>
      <video ref={videoRef} src={url ?? undefined} muted playsInline preload="auto" aria-hidden="true" className="pointer-events-none absolute h-px w-px opacity-0" />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="h-full w-full select-none"
        style={{ width, height, objectFit: source.cover ? "cover" : "contain", backgroundColor: url ? undefined : "rgba(0,0,0,0.06)" }}
      />
    </>
  );
}
