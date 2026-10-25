"use client";

import type { MotionValue } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { restTransformAt } from "@/app/components/motion-studio/engine/transform";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import type { Clip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import { SNAP_SCREEN_PX, snapPoint, snapTargets, type SnapGuide, type SnapTargets } from "../lib/snap";
import { AttachmentOverlay } from "./AttachmentOverlay";
import { PathEditor } from "./PathEditor";
import { TailHandle } from "./TailHandle";

interface Props {
  doc: StudioDoc;
  time: MotionValue<number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveClip: (id: string, delta: Vec2) => void;
  onMovePoint: (clipId: string, index: number, delta: Vec2) => void;
  /** Waypoint being edited on the selected sprite, if any. */
  selectedPoint: number | null;
  onSelectPoint: (index: number) => void;
  onChangeClip: (next: Clip) => void;
  /** Preview / recording mode: fill the window, no chrome, no handles. */
  clean: boolean;
  /** Floating controls drawn over the stage area (the add rail, the preview exit). */
  overlay?: ReactNode;
}

interface Drag {
  id: string;
  /** Where the clip rests on stage when the drag began (its animated position may differ). */
  anchor: Vec2;
  /** Pointer position at pickup, in screen px. */
  startX: number;
  startY: number;
  targets: SnapTargets;
}

/**
 * The editable stage. Scales the native-size canvas to fit its container,
 * lets any clip be dragged by its rendered element, and overlays the path
 * handles for the selected sprite plus attachment guides. Drag deltas are
 * reported in stage pixels; the owner maps them into the clip's parent frame.
 *
 * While dragging, the anchor snaps to the canvas centre lines and to the
 * other layers' anchors, and a guide shows what it snapped to. Alt skips it.
 */
export function EditorStage({
  doc,
  time,
  selectedId,
  onSelect,
  onMoveClip,
  onMovePoint,
  selectedPoint,
  onSelectPoint,
  onChangeClip,
  clean,
  overlay,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const drag = useRef<Drag | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      // Room for the 1px canvas border plus a gutter: small on phones, and
      // on desktop enough that the add rail never sits over the canvas.
      const padX = clean ? 0 : width < 640 ? 12 : 176;
      const padY = clean ? 0 : width < 640 ? 12 : 32;
      setZoom(Math.min((width - padX) / doc.stage.width, (height - padY) / doc.stage.height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.stage.width, doc.stage.height, clean]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (clean) return;
    // Controls floating over the stage are not the stage.
    if ((e.target as HTMLElement).closest("[data-stage-overlay]")) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-clip-id]");
    if (!target) {
      onSelect(null);
      return;
    }
    const id = target.dataset.clipId;
    if (!id) return;
    onSelect(id);
    const rest = restTransformAt(doc, id);
    drag.current = { id, anchor: { x: rest.x, y: rest.y }, startX: e.clientX, startY: e.clientY, targets: snapTargets(doc, id) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const wanted = { x: d.anchor.x + (e.clientX - d.startX) / zoom, y: d.anchor.y + (e.clientY - d.startY) / zoom };
    const snapped = e.altKey ? { point: wanted, guides: [] } : snapPoint(wanted, d.targets, SNAP_SCREEN_PX / zoom);
    const current = restTransformAt(doc, d.id);
    const delta = { x: snapped.point.x - current.x, y: snapped.point.y - current.y };
    if (Math.abs(delta.x) > 0.01 || Math.abs(delta.y) > 0.01) onMoveClip(d.id, delta);
    setGuides(snapped.guides);
  };
  const onPointerUp = () => {
    drag.current = null;
    setGuides([]);
  };

  const selected: Clip | undefined = doc.clips.find((c) => c.id === selectedId);
  const scaledW = doc.stage.width * zoom;
  const scaledH = doc.stage.height * zoom;

  return (
    <div
      ref={wrapRef}
      className={
        clean
          ? "fixed inset-0 z-50 flex items-center justify-center"
          : "relative flex h-full w-full touch-none select-none items-center justify-center overflow-hidden"
      }
      style={clean ? { backgroundColor: doc.stage.transparent ? "#000" : doc.stage.background } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={clean ? "" : `box-content border border-border-strong sm:shadow-pop ${doc.stage.transparent ? "atm-checker" : ""}`}
        style={{ width: scaledW, height: scaledH, cursor: clean ? "default" : "grab" }}
      >
        <StageCanvas doc={doc} time={time} zoom={zoom}>
          {!clean && (selected?.type === "sprite" || selected?.type === "ribbon") && (
            <PathEditor
              doc={doc}
              clip={selected}
              time={time}
              zoom={zoom}
              onMovePoint={(index, delta) => onMovePoint(selected.id, index, delta)}
              selectedPoint={selectedPoint}
              onSelectPoint={onSelectPoint}
            />
          )}
          {!clean && selected?.type === "text" && selected.tail.mode === "manual" && (
            <TailHandle doc={doc} clip={selected} time={time} zoom={zoom} onChange={onChangeClip} />
          )}
          {!clean && selected && <AttachmentOverlay doc={doc} time={time} selected={selected} zoom={zoom} />}
          {!clean && selected && selected.type !== "sprite" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2b6cb0]"
              style={{ left: selected.x, top: selected.y }}
            />
          )}
          {!clean &&
            guides.map((g) => (
              <div
                key={`${g.axis}${g.at}`}
                aria-hidden="true"
                className="pointer-events-none absolute bg-accent"
                style={
                  g.axis === "x"
                    ? { left: g.at, top: 0, width: Math.max(1, 1 / zoom), height: doc.stage.height }
                    : { top: g.at, left: 0, height: Math.max(1, 1 / zoom), width: doc.stage.width }
                }
              />
            ))}
        </StageCanvas>
      </div>
      {overlay}
    </div>
  );
}
