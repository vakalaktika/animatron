"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { controllerLocalPoint, evaluateScene } from "@/app/components/motion-studio/engine/motionScene";
import type { MotionController } from "@/app/components/motion-studio/engine/motionTypes";
import type { Clip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import { controllerAt, editableMotion, keyMotionController } from "../lib/motionEdit";

interface Props {
  doc: StudioDoc;
  clip: Clip;
  time: MotionValue<number>;
  zoom: number;
  stageEl: () => HTMLElement | null;
  onChange: (clip: Clip) => void;
}

function ControllerHandle({ doc, clip, time, zoom, stageEl, onChange, control }: Props & { control: MotionController }) {
  const reduce = useReducedMotion();
  const position = useTransform(time, t => evaluateScene(doc, t).controllers[clip.id]?.[control.id] ?? { x: 0, y: 0, rotation: 0 });
  const x = useTransform(position, point => point.x);
  const y = useTransform(position, point => point.y);
  const drag = useRef<{ doc: StudioDoc; clip: Clip; clock: number; point: Vec2; value: Vec2 } | null>(null);
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const clock = time.get();
    const point = position.get();
    drag.current = { doc, clip, clock, point: controllerLocalPoint(doc, clip.id, control.id, point, clock), value: controllerAt(control, clock - clip.start) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const started = drag.current;
    const bounds = stageEl()?.getBoundingClientRect();
    if (!started || !bounds) return;
    event.stopPropagation();
    const stage = { x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom };
    const local = controllerLocalPoint(started.doc, started.clip.id, control.id, stage, started.clock);
    onChange(keyMotionController(started.clip, control.id, started.clock, { x: started.value.x + local.x - started.point.x, y: started.value.y + local.y - started.point.y }));
  };
  const key = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0;
    const dy = event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    event.stopPropagation();
    const current = controllerAt(control, time.get() - clip.start);
    onChange(keyMotionController(clip, control.id, time.get(), { x: current.x + dx, y: current.y + dy }));
  };
  return <motion.div className="pointer-events-none absolute left-0 top-0" style={{ x, y }}>
    <motion.button type="button" data-stage-overlay data-motion-controller={control.id}
      aria-label={`Move ${control.name ?? control.id} target`} title="Drag target; arrow keys move one unit, Shift moves ten"
      className="pointer-events-auto absolute -left-3 -top-3 flex h-6 w-6 touch-none items-center justify-center rounded-full border-2 border-white bg-info text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-info"
      style={{ scale: 1 / Math.max(0.01, zoom), transformOrigin: "center" }}
      whileTap={reduce ? undefined : { scale: 0.97 / Math.max(0.01, zoom) }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
      onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={key}>
      <span aria-hidden="true">+</span>
      <span aria-hidden="true" className="pointer-events-none absolute left-8 whitespace-nowrap rounded bg-surface-raised px-1 py-0.5 text-[11px] font-semibold text-ink">{control.name ?? control.id}</span>
    </motion.button>
  </motion.div>;
}

/** Accessible, named target handles; these write the same sparse tracks as the inspector. */
export function MotionControllers(props: Props) {
  return <>{editableMotion(props.clip).controllers.map(control => <ControllerHandle key={control.id} {...props} control={control} />)}</>;
}
