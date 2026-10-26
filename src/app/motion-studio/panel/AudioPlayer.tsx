"use client";

import { useAnimationFrame, type MotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import { useMediaUrl } from "@/app/components/motion-studio/engine/useMedia";
import type { AudioTrack } from "@/app/components/motion-studio/types";

interface Props {
  audio: AudioTrack;
  time: MotionValue<number>;
  playing: boolean;
  /** Composition length: the sound stops here. */
  duration: number;
  /** Clock speed; the sound keeps pitch and follows the rate. */
  speed: number;
  muted?: boolean;
}

const DRIFT_SECONDS = 0.12;

/**
 * Plays the composition's sound in step with the clock: starts when the
 * playhead crosses its offset, follows scrubs, fades out at the end. The
 * browser may refuse to play before the first click on the page; the clock
 * runs on regardless and the sound joins at the next play.
 */
export function AudioPlayer({ audio, time, playing, duration, speed, muted = false }: Props) {
  const url = useMediaUrl(audio.mediaId);
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.playbackRate = Math.min(4, Math.max(0.25, speed));
  }, [speed]);

  useAnimationFrame(() => {
    const el = ref.current;
    if (!el || !url || el.readyState < 1) return;
    const t = time.get();
    const fileTime = audio.trimStart + (t - audio.offset);
    const fileEnd = audio.length || Infinity;
    const inSpan = t >= audio.offset && t < duration && fileTime < fileEnd;
    const fadeLen = Math.max(0, audio.fadeOut);
    const fade = fadeLen > 0 && t > duration - fadeLen ? Math.max(0, (duration - t) / fadeLen) : 1;
    el.volume = Math.min(1, Math.max(0, audio.volume * fade));
    el.muted = muted;
    if (playing && inSpan) {
      if (Math.abs(el.currentTime - fileTime) > DRIFT_SECONDS) el.currentTime = Math.max(0, fileTime);
      if (el.paused) void el.play().catch(() => undefined);
    } else {
      if (!el.paused) el.pause();
      if (inSpan && Math.abs(el.currentTime - fileTime) > DRIFT_SECONDS) el.currentTime = Math.max(0, fileTime);
    }
  });

  return <audio ref={ref} src={url ?? undefined} preload="auto" aria-hidden="true" className="hidden" />;
}
