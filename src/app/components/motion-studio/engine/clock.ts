"use client";

import { useAnimationFrame, useMotionValue, type MotionValue } from "motion/react";
import { useCallback, useState } from "react";

export interface ClockOptions {
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
}

export interface StudioClock {
  /** Seconds since the composition started. Drive every clip from this. */
  time: MotionValue<number>;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  replay: () => void;
}

/**
 * A single deterministic clock for a composition. Clips derive every visual
 * from `time`, so pausing, scrubbing, speed changes, and looping all come for
 * free and the same code path renders in the editor and on the site.
 */
export function useStudioClock(
  duration: number,
  { autoplay = true, loop = false, speed = 1 }: ClockOptions = {},
): StudioClock {
  const time = useMotionValue(0);
  const [playing, setPlaying] = useState(autoplay);

  useAnimationFrame((_, delta) => {
    if (!playing) return;
    let next = time.get() + (delta / 1000) * speed;
    if (next >= duration) {
      if (loop && duration > 0) next %= duration;
      else {
        next = duration;
        setPlaying(false);
      }
    }
    time.set(next);
  });

  const play = useCallback(() => {
    if (time.get() >= duration) time.set(0);
    setPlaying(true);
  }, [duration, time]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    if (playing) setPlaying(false);
    else play();
  }, [playing, play]);
  const seek = useCallback(
    (seconds: number) => time.set(Math.max(0, Math.min(duration, seconds))),
    [duration, time],
  );
  const replay = useCallback(() => {
    time.set(0);
    setPlaying(true);
  }, [time]);

  return { time, playing, play, pause, toggle, seek, replay };
}
