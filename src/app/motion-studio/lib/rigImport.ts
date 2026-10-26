import { RIG_LIMITS, validateRig } from "@/app/components/motion-studio/engine/rig";
import { parseRigSvg } from "@/app/components/motion-studio/engine/rigSvg";
import type { RigAsset, RigClip, StageConfig } from "@/app/components/motion-studio/types";
import { newId } from "./id";

/**
 * A `.mci.json` rig on its way into the studio, and back out. The asset is
 * kept whole inside the clip (fields the studio does not read included), so
 * what "Save rig" writes is the master Agent Torres or the generator can open
 * again, with every edit made here.
 */

/** Largest share of the stage a freshly imported rig's canvas takes. */
const FIT = 0.8;

export type RigImportResult = { ok: true; clip: RigClip } | { ok: false; message: string };

/** A rig clip around a validated asset, centred on the stage at a size that fits. */
export function makeRig(rig: RigAsset, stage: Pick<StageConfig, "width" | "height">, over: Partial<RigClip> = {}): RigClip {
  const scale = Math.min(1, (stage.width * FIT) / rig.canvas.width, (stage.height * FIT) / rig.canvas.height);
  return {
    id: newId(),
    type: "rig",
    name: rig.name || "Rig",
    enabled: true,
    start: 0,
    x: stage.width / 2,
    y: stage.height / 2,
    scale: Number(scale.toFixed(3)),
    parentId: null,
    followRotation: false,
    rig,
    animationId: rig.animations[0]?.id ?? null,
    pose: {},
    ...over,
  };
}

/**
 * Validates a parsed `.mci.json` against the contract (structure, budgets,
 * SVG subset) and wraps it in a clip. Anything wrong is reported in plain
 * words and nothing is changed; the current composition is never touched by
 * a bad file.
 */
export function rigClipFrom(json: unknown, stage: Pick<StageConfig, "width" | "height">): RigImportResult {
  if (json && typeof json === "object" && new TextEncoder().encode(JSON.stringify(json)).length > RIG_LIMITS.jsonBytes) {
    return { ok: false, message: "This rig is larger than 4 MB, which is more than the studio keeps in a composition." };
  }
  const check = validateRig(json);
  if (!check.ok) return { ok: false, message: `This rig can't be opened: ${check.errors.join(" ")}` };
  const asset = json as RigAsset;
  const svg = parseRigSvg(asset);
  if (!svg.ok) return { ok: false, message: `This rig can't be opened: ${svg.error}` };
  return { ok: true, clip: makeRig(asset, stage) };
}

/** File name for a saved rig. */
export const rigFileName = (clip: RigClip) => `${(clip.rig.name || clip.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "rig"}.mci.json`;
