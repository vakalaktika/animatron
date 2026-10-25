import { RAINBOW, RAINBOW_PRESETS } from "@/app/components/motion-studio/engine/rainbow";
import type { Preset } from "../types";

export { RAINBOW };

/** Order used when appending a fresh color, so additions stay on-brand. */
const CYCLE = [
  RAINBOW.blue,
  RAINBOW.green,
  RAINBOW.purple,
  RAINBOW.red,
  RAINBOW.orange,
  RAINBOW.yellow,
];

/** The default rainbow a fresh canvas starts with. */
export const DEFAULT_COLORS: string[] = [
  RAINBOW.blue,
  RAINBOW.green,
  RAINBOW.purple,
];

/** Fewest colors a rainbow may have — the last three can't be removed. */
export const MIN_COLORS = 3;

/** Quick-apply presets, shared with Motion Studio's rainbow trail. */
export const PRESETS: Preset[] = RAINBOW_PRESETS;

/** Pick the next color to append given how many are already present. */
export function nextColor(count: number): string {
  return CYCLE[count % CYCLE.length];
}
