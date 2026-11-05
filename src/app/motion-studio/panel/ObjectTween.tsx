"use client";

import { useState } from "react";
import { useMotionValueEvent, type MotionValue } from "motion/react";
import type { Clip, EaseName, KeyedProp } from "@/app/components/motion-studio/types";
import { keyableProps, placementAt } from "@/app/components/motion-studio/engine/keys";
import { tweenTo } from "@/app/components/motion-studio/engine/tween";
import { EASE_LABELS } from "@/app/components/motion-studio/engine/easing";
import { Button } from "@/app/components/shared-components";
import { MoreFields, NumField, SelectField } from "./fields";

const names: Record<KeyedProp, string> = { x: "Destination X", y: "Destination Y", scale: "Destination size", rotation: "Destination turn", opacity: "Destination opacity" };
const curves: EaseName[] = ["inOut", "smoothOut", "backOut", "anticipate", "snap", "linear"];

/** A short endpoint workflow over the existing key tracks; no extra playback system. */
export function ObjectTween({ clip, time, onChange }: { clip: Clip; time: MotionValue<number>; onChange: (clip: Clip) => void }) {
  const [now, setNow] = useState(time.get());
  useMotionValueEvent(time, "change", setNow);
  const [duration, setDuration] = useState(1);
  const [ease, setEase] = useState<EaseName>("inOut");
  const [destination, setDestination] = useState<Partial<Record<KeyedProp, number>>>({});
  const [message, setMessage] = useState("");
  const pose = placementAt(clip, now);
  const invalid = now < clip.start || duration < 0.01 || now - clip.start + duration > 600;
  return <MoreFields label="Tween to…">
    <p className="atm-help">Set a destination from this playhead. Only changed properties receive keys. Keys inside that interval are replaced; other keys stay editable. Layer movement combines with any existing path or reveal.</p>
    <NumField label="Tween length" unit="s" value={duration} min={0.01} max={60} step={0.1} onChange={setDuration} />
    {keyableProps(clip).map(prop => <NumField key={prop} label={names[prop]} value={destination[prop] ?? pose[prop]} unit={prop === "x" || prop === "y" ? "px" : prop === "rotation" ? "°" : undefined} min={prop === "opacity" ? 0 : prop === "scale" ? 0.01 : -2500} max={prop === "opacity" ? 1 : prop === "scale" ? 10 : 2500} onChange={value => { setDestination(prev => ({ ...prev, [prop]: value })); setMessage(""); }} />)}
    <SelectField label="Tween curve" value={ease} options={curves.map(value => ({ value, label: EASE_LABELS[value] }))} onChange={setEase} />
    <Button size="xs" disabled={invalid || Object.keys(destination).length === 0} onClick={() => {
      const next = tweenTo(clip, time.get(), duration, destination, { name: ease });
      onChange(next);
      setDestination({});
      setMessage(next === clip ? "Destination matches the current pose." : "Tween added. Scrub the timeline or drag its keys to adjust timing.");
    }}>Create tween</Button>
    {invalid && <p className="atm-help">Choose a playhead inside this layer and an ending before 600 seconds.</p>}
    <p role="status" className="atm-help">{message}</p>
  </MoreFields>;
}
