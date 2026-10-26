"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { propKeys } from "@/app/components/motion-studio/engine/keys";
import { flowRibbon } from "@/app/components/motion-studio/engine/textFlow";
import { restTransformAt, transformAt } from "@/app/components/motion-studio/engine/transform";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import type { Clip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import { SNAP_SCREEN_PX, snapPoint, snapTargets, type SnapGuide, type SnapTargets } from "../lib/snap";
import { clampView, FIT_VIEW, isFit, pinchView, wheelView, ZOOM_STEP, zoomAbout, type View } from "../lib/viewport";
import { AttachmentOverlay } from "./AttachmentOverlay";
import { PathEditor } from "./PathEditor";
import type { RigHandle, RigMode } from "../lib/rigEdit";
import { RigEditor } from "./RigEditor";
import { SelectionBox } from "./SelectionBox";
import { TailHandle } from "./TailHandle";
import { ZoomControls } from "./ZoomControls";

interface Props {
  doc: StudioDoc;
  time: MotionValue<number>;
  selectedId: string | null;
  /** `additive` (shift held) adds the clip to the selection instead of replacing it. */
  onSelect: (id: string | null, additive?: boolean) => void;
  onMoveClip: (id: string, delta: Vec2) => void;
  onMovePoint: (clipId: string, index: number, delta: Vec2) => void;
  /** Also-selected clips (shift-click): marked, moved along, but not edited. */
  extraIds?: ReadonlySet<string>;
  /** Waypoint being edited on the selected sprite, if any. */
  selectedPoint: number | null;
  onSelectPoint: (index: number) => void;
  onChangeClip: (next: Clip) => void;
  /** Corner handles: uniform size about the centre. */
  onScaleClip: (id: string, scale: number) => void;
  /** The turn handle above the selection. */
  onRotateClip: (id: string, degrees: number) => void;
  /** Preview / recording mode: fill the window, no chrome, no handles. */
  clean: boolean;
  /** The pen: pointer strokes become lines instead of moving things. */
  drawing?: boolean;
  /** A finished stroke, in stage pixels. */
  onDraw?: (points: [number, number][]) => void;
  /** Floating controls drawn over the stage area (the add rail, the preview exit). */
  overlay?: ReactNode;
  /** Skeleton editing for a selected rig: which bone, what a drag does, and where it went. */
  rig: {
    mode: RigMode;
    selectedBone: string | null;
    onSelectBone: (id: string | null) => void;
    onDragHandle: (clipId: string, boneId: string, handle: RigHandle, point: Vec2) => void;
  };
}

/** The selected clip's anchor, live with the clock so a keyframed or riding clip's dot stays on it. */
function AnchorDot({ doc, clipId, time }: { doc: StudioDoc; clipId: string; time: MotionValue<number> }) {
  const world = useTransform(time, (t) => transformAt(doc, clipId, t));
  const left = useTransform(world, (w) => w.x);
  const top = useTransform(world, (w) => w.y);
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-info"
      style={{ left, top }}
    />
  );
}

/** A finger press not yet acted on (see `pending` in EditorStage). */
interface Pending {
  pointerId: number;
  target: HTMLElement;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
}

/** How far (screen px) a finger moves before its press counts as a drag. */
const TOUCH_SLOP = 6;

interface Drag {
  id: string;
  /** Where the clip rests on stage when the drag began (its animated position may differ). */
  anchor: Vec2;
  /** Pointer position at pickup, in screen px. */
  startX: number;
  startY: number;
  targets: SnapTargets;
  /**
   * Text flowing along a ribbon (its frame stays on the ribbon's anchor
   * however far it slides) or a clip with a keyframed position (the drag
   * keys it at the playhead, not its rest): the drag tracks what it has
   * applied (`moved`) instead of reading the rest position back, and does
   * not snap.
   */
  tracked: boolean;
  moved: Vec2;
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
  extraIds,
  onSelect,
  onMoveClip,
  onMovePoint,
  selectedPoint,
  onSelectPoint,
  onChangeClip,
  onScaleClip,
  onRotateClip,
  clean,
  drawing = false,
  onDraw,
  overlay,
  rig,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stroke = useRef<[number, number][] | null>(null);
  const [strokePath, setStrokePath] = useState<string | null>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const [fitZoom, setFitZoom] = useState(0.5);
  // Pinch, trackpad and the zoom buttons move the view; the recording view is always fitted.
  const [view, setView] = useState<View>(FIT_VIEW);
  const shown = clean ? FIT_VIEW : view;
  const zoom = fitZoom * shown.scale;
  const drag = useRef<Drag | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  // Fingers on the stage, by pointer id, relative to its centre, tracked in
  // the capture phase so a finger on a handle counts too. Two make a pinch;
  // once one of those lifts, the rest do nothing until every finger is up.
  const touches = useRef(new Map<number, Vec2>());
  const pinch = useRef<{ start: View; ids: [number, number]; from: [Vec2, Vec2] } | null>(null);
  const pinchDone = useRef(false);
  // A finger's press on the stage waits until it moves or lifts, so a pinch
  // never selects, deselects or drags something on the way.
  const pending = useRef<Pending | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      // Room for the 1px canvas border plus a gutter: small on phones, and
      // on desktop enough that the add rail never sits over the canvas.
      const padX = clean ? 0 : width < 640 ? 12 : 176;
      const padY = clean ? 0 : width < 640 ? 12 : 32;
      setFitZoom(Math.min((width - padX) / doc.stage.width, (height - padY) / doc.stage.height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.stage.width, doc.stage.height, clean]);

  // A different canvas size starts from a fitted view again.
  useEffect(() => setView(FIT_VIEW), [doc.stage.width, doc.stage.height]);

  /** Applies a view change, keeping part of the canvas on screen. */
  const moveView = useCallback(
    (change: (v: View) => View) => {
      const area = wrapRef.current?.getBoundingClientRect();
      if (!area) return;
      const canvas = { x: doc.stage.width * fitZoom, y: doc.stage.height * fitZoom };
      setView((v) => clampView(change(v), canvas, { x: area.width, y: area.height }));
    },
    [doc.stage.width, doc.stage.height, fitZoom],
  );

  /** A screen point relative to the centre of the stage area, where the view's pan is measured from. */
  const fromCentre = useCallback((clientX: number, clientY: number): Vec2 => {
    const r = wrapRef.current?.getBoundingClientRect();
    return r ? { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 } : { x: 0, y: 0 };
  }, []);

  // Trackpad pinch (and Ctrl + wheel) zooms about the cursor; scrolling pans
  // a zoomed-in view. Native listener: React's wheel handler can't prevent
  // the browser's own page zoom.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || clean) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && isFit(view)) return;
      e.preventDefault();
      moveView((v) => wheelView(v, { x: e.deltaX, y: e.deltaY }, e.ctrlKey, fromCentre(e.clientX, e.clientY)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clean, view, moveView, fromCentre]);

  /** A screen position in stage pixels. */
  const stagePointAt = (clientX: number, clientY: number): [number, number] => {
    const box = canvasBoxRef.current?.getBoundingClientRect();
    if (!box) return [0, 0];
    return [(clientX - box.left) / zoom, (clientY - box.top) / zoom];
  };

  /** Drops whatever a single pointer had started: a pending press, a drag, a stroke. */
  const abandonPointer = () => {
    pending.current = null;
    drag.current = null;
    setGuides([]);
    stroke.current = null;
    setStrokePath(null);
  };

  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (clean || e.pointerType !== "touch") return;
    if ((e.target as HTMLElement).closest("[data-stage-overlay]")) return;
    touches.current.set(e.pointerId, fromCentre(e.clientX, e.clientY));
    if (pinch.current || pinchDone.current) {
      e.stopPropagation();
      return;
    }
    if (touches.current.size < 2) return;
    const [a, b] = [...touches.current.entries()];
    abandonPointer();
    pinch.current = { start: view, ids: [a[0], b[0]], from: [a[1], b[1]] };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const onPointerMoveCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" || !touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, fromCentre(e.clientX, e.clientY));
    const p = pinch.current;
    // While pinching (and after, until the fingers are up) handles and clips don't see these moves.
    if (!p && !pinchDone.current) return;
    e.stopPropagation();
    const a = p && touches.current.get(p.ids[0]);
    const b = p && touches.current.get(p.ids[1]);
    if (p && a && b) moveView(() => pinchView(p.start, p.from, [a, b]));
  };
  const onPointerEndCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    touches.current.delete(e.pointerId);
    if (pinch.current?.ids.includes(e.pointerId)) {
      pinch.current = null;
      pinchDone.current = touches.current.size > 0;
    } else if (touches.current.size === 0) pinchDone.current = false;
  };

  /**
   * Acts on a press: starts a stroke when drawing, else selects (or clears)
   * and starts dragging what was hit. True when a stroke or drag started.
   */
  const begin = (press: Pending, el: HTMLDivElement): boolean => {
    if (drawing) {
      stroke.current = [stagePointAt(press.clientX, press.clientY)];
      setStrokePath(null);
      el.setPointerCapture(press.pointerId);
      return true;
    }
    const target = press.target.closest<HTMLElement>("[data-clip-id]");
    if (!target) {
      onSelect(null);
      return false;
    }
    const id = target.dataset.clipId;
    if (!id) return false;
    onSelect(id, press.shiftKey);
    const rest = restTransformAt(doc, id);
    const clip = doc.clips.find((c) => c.id === id);
    const flowing = clip?.type === "text" && flowRibbon(doc, clip) !== null;
    const keyed = !!clip && (propKeys(clip, "x") !== null || propKeys(clip, "y") !== null);
    drag.current = { id, anchor: { x: rest.x, y: rest.y }, startX: press.clientX, startY: press.clientY, targets: snapTargets(doc, id), tracked: flowing || keyed, moved: { x: 0, y: 0 } };
    el.setPointerCapture(press.pointerId);
    return true;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (clean) return;
    // Controls floating over the stage are not the stage.
    if ((e.target as HTMLElement).closest("[data-stage-overlay]")) return;
    const press = { pointerId: e.pointerId, target: e.target as HTMLElement, clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey };
    if (e.pointerType === "touch") {
      pending.current = press;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    // Only a drag or stroke keeps focus where it is; a click on empty canvas may blur a field.
    if (begin(press, e.currentTarget)) e.preventDefault();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pending.current;
    if (p && p.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - p.clientX, e.clientY - p.clientY) < TOUCH_SLOP) return;
      pending.current = null;
      begin(p, e.currentTarget);
    }
    if (stroke.current) {
      const [px, py] = stroke.current[stroke.current.length - 1];
      const next = stagePointAt(e.clientX, e.clientY);
      if (Math.hypot(next[0] - px, next[1] - py) >= 2 / zoom) {
        stroke.current.push(next);
        setStrokePath(stroke.current.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "));
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    const wanted = { x: d.anchor.x + (e.clientX - d.startX) / zoom, y: d.anchor.y + (e.clientY - d.startY) / zoom };
    const snapped = e.altKey || d.tracked ? { point: wanted, guides: [] } : snapPoint(wanted, d.targets, SNAP_SCREEN_PX / zoom);
    const current = d.tracked ? { x: d.anchor.x + d.moved.x, y: d.anchor.y + d.moved.y } : restTransformAt(doc, d.id);
    const delta = { x: snapped.point.x - current.x, y: snapped.point.y - current.y };
    if (Math.abs(delta.x) > 0.01 || Math.abs(delta.y) > 0.01) {
      onMoveClip(d.id, delta);
      drag.current = { ...d, moved: { x: d.moved.x + delta.x, y: d.moved.y + delta.y } };
    }
    setGuides(snapped.guides);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    // A finger that lifted without moving was a tap: it selects (or clears) now.
    const p = pending.current;
    if (p && p.pointerId === e.pointerId) {
      pending.current = null;
      begin(p, e.currentTarget);
    }
    if (stroke.current) {
      const points = stroke.current;
      stroke.current = null;
      setStrokePath(null);
      if (points.length > 1) onDraw?.(points);
      return;
    }
    drag.current = null;
    setGuides([]);
  };
  const onPointerCancel = () => abandonPointer();

  /** The selected layer's middle on screen, relative to the stage area's centre: where zooming in heads. */
  const selectionCentre = (): Vec2 | null => {
    if (!selectedId) return null;
    const el = canvasBoxRef.current?.querySelector<HTMLElement>(`[data-clip-id="${CSS.escape(selectedId)}"]`);
    const parts = el ? (Array.from(el.children) as HTMLElement[]).map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0) : [];
    if (parts.length === 0) return null;
    const left = Math.min(...parts.map((r) => r.left));
    const right = Math.max(...parts.map((r) => r.right));
    const top = Math.min(...parts.map((r) => r.top));
    const bottom = Math.max(...parts.map((r) => r.bottom));
    return fromCentre((left + right) / 2, (top + bottom) / 2);
  };

  /** Zooms in, on the selected layer when there is one (bringing it to the middle), else on the middle. */
  const zoomIn = () => {
    const at = selectionCentre();
    moveView((v) => {
      const zoomed = zoomAbout(v, ZOOM_STEP, at ?? { x: 0, y: 0 });
      return at ? { ...zoomed, x: zoomed.x - at.x, y: zoomed.y - at.y } : zoomed;
    });
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
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerEndCapture}
      onPointerCancelCapture={onPointerEndCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        ref={canvasBoxRef}
        className={clean ? "" : `box-content border border-border-strong sm:shadow-pop ${doc.stage.transparent ? "atm-checker" : ""}`}
        style={{ width: scaledW, height: scaledH, translate: `${shown.x}px ${shown.y}px`, cursor: clean ? "default" : drawing ? "crosshair" : "grab" }}
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
          {!clean && selected?.type === "rig" && (
            <RigEditor
              doc={doc}
              clip={selected}
              time={time}
              zoom={zoom}
              stageEl={() => (canvasBoxRef.current?.firstElementChild as HTMLElement | null) ?? null}
              mode={rig.mode}
              selectedBone={rig.selectedBone}
              onSelectBone={rig.onSelectBone}
              onDragHandle={(boneId, handle, point) => rig.onDragHandle(selected.id, boneId, handle, point)}
            />
          )}
          {!clean && selected?.type === "text" && selected.tail.mode === "manual" && (
            <TailHandle doc={doc} clip={selected} time={time} zoom={zoom} onChange={onChangeClip} />
          )}
          {!clean && selected && (
            <AttachmentOverlay doc={doc} time={time} selected={selected} zoom={zoom} labels={selected.type !== "sprite" && selected.type !== "ribbon"} />
          )}
          {!clean && selected && selected.type !== "sprite" && selected.type !== "rig" && (
            <AnchorDot doc={doc} clipId={selected.id} time={time} />
          )}
          {!clean &&
            extraIds &&
            doc.clips
              .filter((c) => extraIds.has(c.id) && c.id !== selectedId)
              .map((c) => {
                const w = restTransformAt(doc, c.id);
                return (
                  <div
                    key={c.id}
                    aria-hidden="true"
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-info bg-surface-raised"
                    style={{ left: w.x, top: w.y }}
                  />
                );
              })}
          {!clean && selected && selected.type !== "ribbon" && (
            <SelectionBox
              clip={selected}
              time={time}
              zoom={zoom}
              stageEl={() => (canvasBoxRef.current?.firstElementChild as HTMLElement | null) ?? null}
              onScale={(s) => onScaleClip(selected.id, s)}
              onRotate={(d) => onRotateClip(selected.id, d)}
              canRotate
            />
          )}
          {strokePath && (
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              <path d={strokePath} fill="none" stroke="var(--info)" strokeWidth={4 / zoom} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${8 / zoom} ${6 / zoom}`} />
            </svg>
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
      {!clean && (
        <ZoomControls
          scale={view.scale}
          fitted={isFit(view)}
          onZoomIn={zoomIn}
          zoomInLabel={selected ? `Zoom in on ${selected.name}` : "Zoom in"}
          onZoomOut={() => moveView((v) => zoomAbout(v, 1 / ZOOM_STEP, { x: 0, y: 0 }))}
          onFit={() => setView(FIT_VIEW)}
        />
      )}
      {overlay}
    </div>
  );
}
