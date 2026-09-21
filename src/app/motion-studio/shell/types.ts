import type { ReactNode } from "react";

/**
 * The studio's pieces, built once by MotionStudio and arranged by whichever
 * shell fits the screen (desktop, phone portrait, phone landscape).
 */
export interface StudioSlots {
  docName: string;
  stage: ReactNode;
  /** Compact play / replay / scrub strip. */
  playback: ReactNode;
  /** Desktop timeline: controls, scrubber and tracks together. */
  timeline: ReactNode;
  /** Speed, loop and tracks, for when playback lives in its own strip. */
  tracks: ReactNode;
  /** The clip tree and its actions, without a heading. */
  clips: ReactNode;
  /** Stage settings, or the selected clip's settings. */
  edit: ReactNode;
}
