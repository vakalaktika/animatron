import type { ReactNode } from "react";

/**
 * The studio's pieces, built once by MotionStudio and arranged by whichever
 * shell fits the screen (desktop, phone portrait, phone landscape).
 */
export interface StudioSlots {
  /** The composition's name, editable in place. */
  title: ReactNode;
  /** App-bar actions for a wide screen: undo / redo, compositions, share, help. */
  actions: ReactNode;
  /** The few actions that fit a phone app bar. */
  phoneActions: ReactNode;
  stage: ReactNode;
  /** Compact play / replay / scrub strip. */
  playback: ReactNode;
  /** Desktop timeline: controls, scrubber and tracks together. */
  timeline: ReactNode;
  /** Speed, loop and tracks, for when playback lives in its own strip. */
  tracks: ReactNode;
  /** The layer list, without a heading. */
  clips: ReactNode;
  /** Canvas settings, or the selected clip's settings. */
  edit: ReactNode;
}
