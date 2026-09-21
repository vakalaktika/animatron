"use client";

import type { MotionValue } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import type { Clip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
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
  /** Recording mode: fill the window, no chrome, no handles. */
  clean: boolean;
}

/**
 * The editable stage. Scales the native-size canvas to fit its container,
 * lets any clip be dragged by its rendered element, and overlays the path
 * handles for the selected sprite plus attachment guides. Drag deltas are
 * reported in stage pixels; the owner maps them into the clip's parent frame.
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
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const drag = useRef<{ id: string; lastX: number; lastY: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      // Room for the 1px canvas border plus a small gutter on phones.
      const pad = clean ? 0 : width < 640 ? 12 : 32;
      setZoom(
        Math.min((width - pad) / doc.stage.width, (height - pad) / doc.stage.height),
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.stage.width, doc.stage.height, clean]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (clean) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-clip-id]");
    if (!target) {
      onSelect(null);
      return;
    }
    const id = target.dataset.clipId;
    if (!id) return;
    onSelect(id);
    drag.current = { id, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    onMoveClip(d.id, { x: (e.clientX - d.lastX) / zoom, y: (e.clientY - d.lastY) / zoom });
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };
  const onPointerUp = () => {
    drag.current = null;
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
          : "relative flex h-full w-full touch-none items-center justify-center overflow-hidden"
      }
      style={clean ? { backgroundColor: doc.stage.transparent ? "#000" : doc.stage.background } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={clean ? "" : "box-content border border-border-strong sm:shadow-pop"}
        style={{ width: scaledW, height: scaledH, cursor: clean ? "default" : "grab" }}
      >
        <StageCanvas doc={doc} time={time} zoom={zoom}>
          {!clean && selected?.type === "sprite" && (
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
        </StageCanvas>
      </div>
    </div>
  );
}
