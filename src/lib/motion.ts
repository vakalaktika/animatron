import type { Transition } from "motion/react";

/* Shared spring vocabulary for Motion for React. Conventions:
   1. Respect prefers-reduced-motion (useReducedMotion or
      MotionConfig reducedMotion="user").
   2. Press states never go below scale 0.95.
   3. Prefer layout / layoutId for position and size changes.
   4. Wrap conditional content in AnimatePresence.
   5. Animate only transform and opacity for interactive motion. */
export const SNAP: Transition = { type: "spring", stiffness: 400, damping: 28 };
export const SMOOTH: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 24,
};
export const PLAYFUL: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 15,
};
