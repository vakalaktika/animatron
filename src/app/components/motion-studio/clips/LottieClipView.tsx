"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import type { LottieClip } from "../types";

interface Props {
  clip: LottieClip;
  time: MotionValue<number>;
}

/** An imported Lottie animation, scrubbed frame by frame from the shared clock. Centered on (0, 0). */
export function LottieClipView({ clip, time }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<AnimationItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const width = clip.width;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let item: AnimationItem | null = null;
    let cancelled = false;
    import("lottie-web")
      .then((mod) => {
        if (cancelled) return;
        item = mod.default.loadAnimation({
          container,
          renderer: "svg",
          loop: false,
          autoplay: false,
          animationData: clip.data,
        });
        setAnim(item);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      item?.destroy();
      setAnim(null);
    };
  }, [clip.data]);

  useMotionValueEvent(time, "change", (t) => {
    if (!anim) return;
    const total = anim.totalFrames;
    if (total <= 0) return;
    const local = Math.max(0, t - clip.start) * clip.speed;
    const raw = local * anim.frameRate;
    const frame = clip.loop ? raw % total : Math.min(total - 1, raw);
    anim.goToAndStop(frame, true);
  });

  const aspect = Number(clip.data.h ?? 1) / Number(clip.data.w ?? 1) || 1;
  const height = width * aspect;

  return (
    <div className="absolute" style={{ left: -width / 2, top: -height / 2, width, height }}>
      <div ref={containerRef} className="h-full w-full" aria-hidden="true" />
      {error && (
        <p className="absolute inset-0 flex items-center justify-center bg-red-50 p-2 text-center text-xs text-red-700">
          Lottie failed to load: {error}
        </p>
      )}
    </div>
  );
}
