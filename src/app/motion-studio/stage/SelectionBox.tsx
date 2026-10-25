"use client";

import { useAnimationFrame } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Clip } from "@/app/components/motion-studio/types";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  clip: Clip;
  zoom: number;
  /** The StageCanvas root: box coordinates are measured relative to it. */
  stageEl: () => HTMLElement | null;
  onScale: (scale: number) => void;
  onRotate: (degrees: number) => void;
  /** Ribbons draw their own geometry, so they have no turn handle. */
  canRotate: boolean;
}

const HANDLE = 10;
const ROTATE_GAP = 26;

/** Union of the rendered boxes of everything inside the clip's element, in stage pixels. */
function measure(stage: HTMLElement, clipId: string, zoom: number): Box | null {
  const el = stage.querySelector<HTMLElement>(`[data-clip-id="${CSS.escape(clipId)}"]`);
  if (!el) return null;
  const parts = Array.from(el.children) as HTMLElement[];
  if (parts.length === 0) return null;
  const s = stage.getBoundingClientRect();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const part of parts) {
    const r = part.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return null;
  return { x: (left - s.left) / zoom, y: (top - s.top) / zoom, width: (right - left) / zoom, height: (bottom - top) / zoom };
}

const same = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

/**
 * The selection frame every canvas tool has: a box around what is picked,
 * corner handles that resize it (about its centre, uniformly) and a turn
 * handle above. It follows the live rendering every frame, so it tracks a
 * picture mid-flight as well as a word standing still.
 */
export function SelectionBox({ clip, zoom, stageEl, onScale, onRotate, canRotate }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const boxRef = useRef<Box | null>(null);
  const gesture = useRef<{ kind: "scale" | "rotate"; startValue: number; startDistance: number; startAngle: number; cx: number; cy: number } | null>(null);

  useAnimationFrame(() => {
    const stage = stageEl();
    if (!stage) return;
    const next = measure(stage, clip.id, zoom);
    if (!same(boxRef.current, next)) {
      boxRef.current = next;
      setBox(next);
    }
  });

  if (!box) return null;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const h = HANDLE / zoom;

  const pointerStage = (e: ReactPointerEvent) => {
    const stage = stageEl();
    const s = stage?.getBoundingClientRect();
    if (!s) return { x: cx, y: cy };
    return { x: (e.clientX - s.left) / zoom, y: (e.clientY - s.top) / zoom };
  };
  const begin = (kind: "scale" | "rotate") => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const p = pointerStage(e);
    gesture.current = {
      kind,
      startValue: kind === "scale" ? clip.scale : (clip.rotation ?? 0),
      startDistance: Math.max(1, Math.hypot(p.x - cx, p.y - cy)),
      startAngle: Math.atan2(p.y - cy, p.x - cx),
      cx,
      cy,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = pointerStage(e);
    if (g.kind === "scale") {
      const ratio = Math.hypot(p.x - g.cx, p.y - g.cy) / g.startDistance;
      onScale(Math.min(8, Math.max(0.05, Number((g.startValue * ratio).toFixed(3)))));
    } else {
      const angle = Math.atan2(p.y - g.cy, p.x - g.cx);
      let degrees = g.startValue + ((angle - g.startAngle) * 180) / Math.PI;
      if (e.shiftKey) degrees = Math.round(degrees / 15) * 15;
      degrees = ((degrees + 180) % 360 + 360) % 360 - 180;
      onRotate(Number(degrees.toFixed(1)));
    }
  };
  const end = () => {
    gesture.current = null;
  };

  const corner = (left: number, top: number, cursor: string, label: string) => (
    <div
      role="slider"
      tabIndex={-1}
      aria-label={label}
      aria-valuenow={Math.round(clip.scale * 100)}
      aria-valuetext={`${Math.round(clip.scale * 100)}% size`}
      className="absolute rounded-[2px] border bg-surface-raised border-info shadow-sm"
      style={{ left: left - h / 2, top: top - h / 2, width: h, height: h, cursor, borderWidth: Math.max(1, 1.5 / zoom) }}
      onPointerDown={begin("scale")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );

  return (
    <div data-stage-overlay className="absolute left-0 top-0" style={{ width: 0, height: 0 }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute border-info"
        style={{ left: box.x, top: box.y, width: box.width, height: box.height, borderWidth: Math.max(1, 1 / zoom), borderStyle: "solid" }}
      />
      {corner(box.x, box.y, "nwse-resize", "Resize from the top left")}
      {corner(box.x + box.width, box.y, "nesw-resize", "Resize from the top right")}
      {corner(box.x, box.y + box.height, "nesw-resize", "Resize from the bottom left")}
      {corner(box.x + box.width, box.y + box.height, "nwse-resize", "Resize from the bottom right")}
      {canRotate && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bg-info"
            style={{ left: cx - Math.max(0.5, 0.5 / zoom), top: box.y - ROTATE_GAP / zoom, width: Math.max(1, 1 / zoom), height: ROTATE_GAP / zoom }}
          />
          <div
            role="slider"
            tabIndex={-1}
            aria-label="Turn"
            aria-valuenow={Math.round(clip.rotation ?? 0)}
            aria-valuetext={`${Math.round(clip.rotation ?? 0)} degrees`}
            className="absolute rounded-full border bg-surface-raised border-info shadow-sm"
            style={{ left: cx - h / 2, top: box.y - ROTATE_GAP / zoom - h / 2, width: h, height: h, cursor: "grab", borderWidth: Math.max(1, 1.5 / zoom) }}
            onPointerDown={begin("rotate")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        </>
      )}
    </div>
  );
}
