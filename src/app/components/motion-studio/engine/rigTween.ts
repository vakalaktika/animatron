import type { Ease, RigAsset, RigKey } from "../types";
import { clamp01, resolveEase } from "./easing";

const NAMES = new Set(["linear", "smoothOut", "inOut", "flight", "backOut", "anticipate", "snap", "custom"]);

/** Strict boundary: custom timing is monotone in time, with bounded overshoot. */
export function validRigTween(value: unknown): value is Ease {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { name, custom } = value as Partial<Ease>;
  if (typeof name !== "string" || !NAMES.has(name)) return false;
  if (name !== "custom") return custom === undefined;
  return Array.isArray(custom) && custom.length === 4 && custom.every(v => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 10)
    && custom[0] >= 0 && custom[0] <= 1 && custom[2] >= 0 && custom[2] <= 1;
}

/** A deterministic tween, sampled by the same evaluator at any output frame rate. */
export function rigTweenProgress(key: RigKey, progress: number): number {
  if (key.easing === "hold") return 0;
  const u = clamp01(progress);
  if (u === 0 || u === 1) return u;
  return key.tween ? resolveEase(key.tween)(u) : u;
}

/** Opt in to Rig 3 only when the author requests a curve; never downgrade. */
export function setRigKeyTween(asset: RigAsset, animationId: string, boneId: string, time: number, tween: Ease | null): RigAsset {
  if (tween && !validRigTween(tween)) return asset;
  const animation = asset.animations.find(a => a.id === animationId);
  const track = animation?.tracks.find(t => t.boneId === boneId);
  if (!track?.keys.some(k => Math.abs(k.time - time) <= 1e-6)) return asset;
  return {
    ...asset, version: tween && asset.version < 3 ? 3 : asset.version,
    animations: asset.animations.map(a => a.id !== animationId ? a : {
      ...a, tracks: a.tracks.map(t => t.boneId !== boneId ? t : {
        ...t, keys: t.keys.map(k => {
          if (Math.abs(k.time - time) > 1e-6) return k;
          const { tween: _old, ...rest } = k;
          return tween ? { ...rest, easing: "linear", tween: { ...tween } } : rest;
        }),
      }),
    }),
  };
}
