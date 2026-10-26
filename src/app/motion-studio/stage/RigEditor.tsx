"use client";

import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { applyMatrix, boneLabel, rigPoseAt, world, type Matrix } from "@/app/components/motion-studio/engine/rig";
import { restTransformAt, toLocalPoint, transformAt } from "@/app/components/motion-studio/engine/transform";
import type { RigBone, RigClip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import type { RigHandle, RigMode } from "../lib/rigEdit";

interface Props {
  doc: StudioDoc;
  clip: RigClip;
  time: MotionValue<number>;
  zoom: number;
  /** The StageCanvas root, to read pointer positions in stage pixels. */
  stageEl: () => HTMLElement | null;
  mode: RigMode;
  selectedBone: string | null;
  onSelectBone: (id: string | null) => void;
  /**
   * A handle dragged to `point` (in the rig's canvas coordinates, SVG user
   * units). Pose mode: a joint pulls its chain (IK), a tip turns its bone.
   * Joints mode: a joint moves the bone's rest position, a tip its rest
   * direction and length.
   */
  onDragHandle: (boneId: string, handle: RigHandle, point: Vec2) => void;
}

const BONE = "var(--info)";
const PICKED = "var(--accent)";

/** One bone: a tapered line from its joint to its tip, live with the pose. */
function BoneGlyph({
  bone,
  worlds,
  k,
  selected,
  mode,
  onDown,
}: {
  bone: RigBone;
  worlds: MotionValue<Record<string, Matrix>>;
  /** Screen-pixel scale: handles are divided by it so they keep a constant size. */
  k: number;
  selected: boolean;
  mode: RigMode;
  onDown: (handle: RigHandle) => (e: ReactPointerEvent<SVGElement>) => void;
}) {
  const origin = useTransform(worlds, (w) => applyMatrix(w[bone.id] ?? [1, 0, 0, 1, 0, 0], { x: 0, y: 0 }));
  const tip = useTransform(worlds, (w) => applyMatrix(w[bone.id] ?? [1, 0, 0, 1, 0, 0], { x: bone.length, y: 0 }));
  const x1 = useTransform(origin, (p) => p.x);
  const y1 = useTransform(origin, (p) => p.y);
  const x2 = useTransform(tip, (p) => p.x);
  const y2 = useTransform(tip, (p) => p.y);
  const stroke = selected ? PICKED : BONE;
  const r = (selected ? 8 : 6.5) / k;
  const label = boneLabel(bone);
  return (
    <g>
      {bone.length > 0 && (
        <>
          <motion.line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={5 / k} strokeLinecap="round" opacity={0.8} />
          <motion.line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={2.5 / k} strokeLinecap="round" />
          <motion.circle
            cx={x2}
            cy={y2}
            r={4.5 / k}
            fill="#fff"
            stroke={stroke}
            strokeWidth={1.5 / k}
            data-rig-handle={`${bone.id}:tip`}
            style={{ cursor: "crosshair", pointerEvents: "all" }}
            onPointerDown={onDown("tip")}
          >
            <title>{`${label}: ${mode === "pose" ? "turn" : "direction and length"}`}</title>
          </motion.circle>
        </>
      )}
      <motion.circle
        cx={x1}
        cy={y1}
        r={r}
        fill={selected ? PICKED : "#fff"}
        stroke={selected ? "#fff" : stroke}
        strokeWidth={2 / k}
        data-rig-handle={`${bone.id}:joint`}
        style={{ cursor: mode === "pose" ? "grab" : "move", pointerEvents: "all" }}
        onPointerDown={onDown("joint")}
      >
        <title>{`${label}: ${mode === "pose" ? "joint" : "rest joint"}`}</title>
      </motion.circle>
    </g>
  );
}

/** A named attachment frame, drawn as a small hollow square that rides its bone. */
function SlotGlyph({ slot, worlds, k }: { slot: NonNullable<RigClip["rig"]["slots"]>[number]; worlds: MotionValue<Record<string, Matrix>>; k: number }) {
  const p = useTransform(worlds, (w) => applyMatrix(w[slot.boneId] ?? [1, 0, 0, 1, 0, 0], { x: slot.x, y: slot.y }));
  const x = useTransform(p, (q) => q.x - 4 / k);
  const y = useTransform(p, (q) => q.y - 4 / k);
  return <motion.rect x={x} y={y} width={8 / k} height={8 / k} fill="none" stroke={BONE} strokeWidth={1.5 / k} opacity={0.7}>
    <title>{`Attachment point ${slot.id}`}</title>
  </motion.rect>;
}

/**
 * The selected rig's skeleton drawn over the artwork, in the rig's own
 * canvas frame so it follows the clip wherever it rides. Joint dots and
 * bone tips are pointer handles; what a drag does depends on the mode. Like
 * the path editor's dots, the overlay is hidden from assistive tech: the
 * Skeleton panel's fields are the keyboard path to the same edits.
 */
export function RigEditor({ doc, clip, time, zoom, stageEl, mode, selectedBone, onSelectBone, onDragHandle }: Props) {
  const { rig } = clip;
  const { width, height } = rig.canvas;
  const worlds = useTransform(time, (t) => world(rig, rigPoseAt(clip, t)));
  const frame = useTransform(time, (t) => {
    const w = transformAt(doc, clip.id, t);
    return `translate(${w.x} ${w.y}) scale(${w.scaleX} ${w.scaleY}) rotate(${w.rotation}) translate(${-width / 2} ${-height / 2})`;
  });
  const k = Math.max(0.01, zoom * Math.abs(restTransformAt(doc, clip.id).scaleX));
  // Written as the SVG attribute by hand: motion would apply a `transform`
  // prop as a CSS transform about the group's centre.
  const frameRef = useRef<SVGGElement>(null);
  useMotionValueEvent(frame, "change", (v) => frameRef.current?.setAttribute("transform", v));
  const drag = useRef<{ boneId: string; handle: RigHandle } | null>(null);

  /** Pointer position in the rig's canvas coordinates. */
  const canvasPoint = (e: ReactPointerEvent): Vec2 => {
    const s = stageEl()?.getBoundingClientRect();
    if (!s) return { x: 0, y: 0 };
    const stage = { x: (e.clientX - s.left) / zoom, y: (e.clientY - s.top) / zoom };
    const local = toLocalPoint(transformAt(doc, clip.id, time.get()), stage);
    return { x: local.x + width / 2, y: local.y + height / 2 };
  };
  const onDown = (boneId: string) => (handle: RigHandle) => (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectBone(boneId);
    drag.current = { boneId, handle };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d) return;
    onDragHandle(d.boneId, d.handle, canvasPoint(e));
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <g ref={frameRef} transform={frame.get()}>
        {rig.slots?.map((slot) => <SlotGlyph key={slot.id} slot={slot} worlds={worlds} k={k} />)}
        {rig.bones.map((bone) => (
          <BoneGlyph key={bone.id} bone={bone} worlds={worlds} k={k} selected={bone.id === selectedBone} mode={mode} onDown={onDown(bone.id)} />
        ))}
      </g>
    </svg>
  );
}
