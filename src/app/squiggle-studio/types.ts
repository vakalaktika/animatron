import type { Band, Point, RainbowPreset } from "@/app/components/motion-studio/engine/rainbow";

export type { Band, Point };

/** One drawn squiggle: an id, its sampled points, and a smoothing counter. */
export interface Stroke {
  id: number;
  /** The centerline the rainbow bands are fanned around. */
  pts: Point[];
  /** How many times this stroke has been smoothed (shown as "×N"). */
  smoothed: number;
}

/** A named color preset shown as a quick-apply swatch. */
export type Preset = RainbowPreset;
