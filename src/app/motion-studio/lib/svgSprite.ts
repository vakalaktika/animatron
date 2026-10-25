import { parseSvg } from "@/app/components/motion-studio/engine/svgText";
import type { SpriteClip, StageConfig } from "@/app/components/motion-studio/types";
import { makeSvgSprite } from "../presets";

/**
 * An SVG document becomes a sprite centred on the stage, keeping any live
 * text editable. Returns null when the markup can't be read as SVG.
 */
export function svgSpriteFrom(text: string, label: string, stage: Pick<StageConfig, "width" | "height">, over: Partial<SpriteClip> = {}): SpriteClip | null {
  const parsed = parseSvg(text);
  if (!parsed) return null;
  return makeSvgSprite(parsed.markup, label, parsed.aspect, parsed.textRuns, { x: stage.width / 2, y: stage.height / 2, ...over });
}
