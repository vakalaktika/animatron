"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { useEffect, useState } from "react";
import { EASE_LABELS } from "@/app/components/motion-studio/engine/easing";
import {
  keyEaseAt,
  keyIndexAt,
  keyTimeAt,
  propKeys,
  propValue,
  removePropKey,
  setKeyEaseAt,
  setPropAt,
  upsertPropKey,
} from "@/app/components/motion-studio/engine/keys";
import type { Clip, EaseName, KeyedProp } from "@/app/components/motion-studio/types";
import { NumField, SelectField } from "./fields";

/** The playhead's clock time, re-rendering only while `live` (something here is keyframed). */
function usePlayhead(time: MotionValue<number>, live: boolean): number {
  const [now, setNow] = useState(() => time.get());
  useMotionValueEvent(time, "change", (t) => {
    if (live) setNow(t);
  });
  // Catch up when the first key appears with the clock standing still.
  useEffect(() => {
    if (live) setNow(time.get());
  }, [live, time]);
  return live ? now : time.get();
}


interface KeyedNumFieldProps {
  clip: Clip;
  prop: KeyedProp;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  time: MotionValue<number>;
  onChange: (next: Clip) => void;
}

/**
 * A placement number with a keyframe toggle. Once the property has keys the
 * field shows its value at the playhead and editing it keys it there; the
 * diamond adds or removes the key at the playhead (removing the last one
 * leaves the property still, at that value).
 */
export function KeyedNumField({ clip, prop, label, unit, min, max, step, time, onChange }: KeyedNumFieldProps) {
  const keys = propKeys(clip, prop);
  const now = usePlayhead(time, keys !== null);
  const local = keyTimeAt(clip, now);
  const onKey = keyIndexAt(keys, local) >= 0;
  const value = propValue(clip, prop, now);
  const seconds = (clip.start + local).toFixed(2);
  const toggle = () => {
    const t = time.get();
    const at = keyTimeAt(clip, t);
    const here = keyIndexAt(propKeys(clip, prop), at) >= 0;
    onChange(here ? removePropKey(clip, prop, at) : upsertPropKey(clip, prop, at, propValue(clip, prop, t)));
  };
  const diamond = (
    <button
      type="button"
      aria-pressed={onKey}
      aria-label={onKey ? `Remove the keyframe for ${label} at ${seconds} s` : keys ? `Add a keyframe for ${label} at ${seconds} s` : `Animate ${label} with keyframes`}
      title={onKey ? "Remove keyframe" : keys ? "Add keyframe here" : "Animate with keyframes"}
      onClick={toggle}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rotate-45 border ${onKey ? "border-ink bg-ink" : keys ? "border-ink bg-surface-raised" : "border-current"}`}
      />
    </button>
  );
  return (
    <NumField
      label={label}
      unit={unit}
      value={value}
      min={min}
      max={max}
      step={step}
      adornment={diamond}
      onChange={(v) => onChange(setPropAt(clip, prop, time.get(), v))}
    />
  );
}

const EASES: EaseName[] = ["inOut", "smoothOut", "linear", "flight", "backOut", "anticipate", "snap"];

/** How the keys at the playhead travel to their next keys; shown only while the playhead sits on a key. */
export function KeyEaseField({ clip, time, onChange }: { clip: Clip; time: MotionValue<number>; onChange: (next: Clip) => void }) {
  const now = usePlayhead(time, true);
  const local = keyTimeAt(clip, now);
  const ease = keyEaseAt(clip, local);
  if (!ease) return null;
  const current = EASES.includes(ease.name) ? ease.name : "inOut";
  return (
    <SelectField
      label={`Keyframe at ${(clip.start + local).toFixed(2)} s eases on`}
      value={current}
      options={EASES.map((name) => ({ value: name, label: EASE_LABELS[name] }))}
      onChange={(name) => onChange(setKeyEaseAt(clip, local, { name }))}
    />
  );
}
