"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioClock } from "@/app/components/motion-studio/engine/clock";
import { clipEnd, docDuration, loopsForever } from "@/app/components/motion-studio/engine/timing";
import type { AudioTrack, Clip, RigClip, SpriteClip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import { retimePropKeys, setPropAt, shiftPosition } from "@/app/components/motion-studio/engine/keys";
import { retimeKeys } from "@/app/components/motion-studio/engine/rig";
import { RIG_FORMAT } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { ExportDialog } from "./dialogs/ExportDialog";
import { GalleryDialog } from "./dialogs/GalleryDialog";
import { HelpDialog } from "./dialogs/HelpDialog";
import { clipComponentCode, docComponentCode, HANDOFF_NOTES } from "./export/codegen";
import { downloadBlob, downloadText, startTabRecording, type Recording } from "./export/recorder";
import { canRenderAlpha, canRenderOffline } from "./export/renderer";
import { VideoExporter, type RenderOptions } from "./export/VideoExporter";
import { deleteClip, deltaInParentFrame, dropClip, nudgeClip, reparentClip } from "./lib/attach";
import { ancestorChain } from "@/app/components/motion-studio/engine/hierarchy";
import { copyClip, copyOf, heldClip } from "./lib/clipboard";
import { artworkFromSquiggle, flightFromSquiggle, pathFromStroke, ribbonFromSquiggle, ribbonFromStroke, takeHandoff } from "./lib/handoff";
import { canRedo, canUndo, createHistory, record, redo as redoHistory, reset as resetHistory, undo as undoHistory, type History } from "./lib/history";
import { normalizeOrder, moveAmongSiblings, type DropTarget } from "./lib/tree";
import { reorder } from "./lib/order";
import {
  addProject,
  duplicateProject,
  loadProjects,
  removeProject,
  renameProject,
  saveProjects,
  upsertCurrent,
  type ProjectStore,
} from "./lib/projects";
import { hasMedia, hydrateClipMedia, hydrateMedia, inlineClipMedia, inlineMedia, pruneMedia } from "./lib/mediaDoc";
import { docFromHash, shareUrl } from "./lib/share";
import { makeShape, type ShapeKind } from "./lib/shapes";
import { svgSpriteFrom } from "./lib/svgSprite";
import { attachedTextFor, detachRun, restoreRun, setRunText } from "./lib/textRuns";
import { insertWaypointAt, retimeWaypoint } from "./lib/waypoints";
import { rigFileName } from "./lib/rigImport";
import { dragRigHandle, type RigHandle, type RigMode } from "./lib/rigEdit";
import { spriteTiming } from "@/app/components/motion-studio/engine/spriteTiming";
import { useMediaQuery } from "./lib/useMediaQuery";
import { AddToolbar, type AddKind } from "./panel/AddToolbar";
import { AudioPlayer } from "./panel/AudioPlayer";
import { CanvasPanel } from "./panel/CanvasPanel";
import { ClipControls } from "./panel/ClipControls";
import { ClipTree, clipIcon } from "./panel/ClipTree";
import { ChevronLeftIcon, CollapseIcon, GridIcon, HelpIcon, RedoIcon, ShareIcon, SquiggleIcon, UndoIcon } from "./panel/icons";
import type { MobileTab } from "./panel/MobileTabs";
import { Toast, type ToastMessage } from "./panel/Toast";
import { markTourSeen, Tour, TOUR_STEPS, tourSeen } from "./panel/Tour";
import { Transport } from "./panel/Transport";
import { makeChippy, makeImageSprite, makeLogo, makeLottie, makeRibbon, makeSpeechText, makeText, makeVideoSprite, parseImport, welcomePreset } from "./presets";
import { hasMediaStore, probeMedia, putMedia } from "@/app/components/motion-studio/engine/media";
import { DesktopShell } from "./shell/DesktopShell";
import { IconButton } from "./shell/IconButton";
import { LandscapeShell } from "./shell/LandscapeShell";
import { PortraitShell } from "./shell/PortraitShell";
import { TitleField } from "./shell/TitleField";
import type { StudioSlots } from "./shell/types";
import { EditorStage } from "./stage/EditorStage";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "animation";
const SAVE_DEBOUNCE_MS = 500;

/** A fresh, empty canvas in the given frame. */
function blankDoc(width: number, height: number): StudioDoc {
  const base = welcomePreset();
  return { ...base, name: "Untitled", stage: { ...base.stage, width, height }, clips: [] };
}

/** Where the studio starts: the current project, else the Welcome composition. */
function initialState(): { store: ProjectStore; doc: StudioDoc } {
  const store = loadProjects();
  const current = store.projects.find((p) => p.id === store.currentId);
  if (current) return { store, doc: current.doc };
  const doc = welcomePreset();
  return { store: addProject(store, doc), doc };
}

export function MotionStudio() {
  const [initial] = useState(initialState);
  const [store, setStore] = useState<ProjectStore>(initial.store);
  const storeRef = useRef(store);
  storeRef.current = store;

  // The working document lives inside an undo history. Every write keeps the
  // clip list in tree order (each clip followed by its descendants), which is
  // what the layer tree and the paint order both read.
  const [history, setHistory] = useState<History<StudioDoc>>(() => createHistory(initial.doc));
  const doc = history.present;
  /**
   * @param key names a gesture; changes with the same key a moment apart
   * coalesce into one undo step (a drag, a slider, typing).
   */
  const setDoc = useCallback((next: StudioDoc | ((d: StudioDoc) => StudioDoc), key?: string) => {
    setHistory((h) => {
      const resolved = typeof next === "function" ? next(h.present) : next;
      const clips = normalizeOrder(resolved.clips);
      return record(h, clips === resolved.clips ? resolved : { ...resolved, clips }, { key });
    });
  }, []);
  /** Opens a different document with a clean history (a project, a template, a link). */
  const replaceDoc = useCallback((next: StudioDoc) => setHistory((h) => resetHistory(h, next)), []);
  const undo = useCallback(() => setHistory(undoHistory), []);
  const redo = useCallback(() => setHistory(redoHistory), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Shift-click builds a group: these move, nudge and delete with the main
  // selection but only the main one has its settings open.
  const [extraIds, setExtraIds] = useState<ReadonlySet<string>>(() => new Set());
  // The clip just added by a "+" button: its text field gets focus once.
  const [freshId, setFreshId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [clean, setClean] = useState(false);
  // The pen: strokes on the canvas become ribbons, or the selected picture's path.
  const [drawing, setDrawing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastSeq = useRef(0);
  const notify = useCallback((text: string, extra: Partial<Omit<ToastMessage, "id" | "text">> = {}) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, ...extra });
  }, []);
  const dismissToast = useCallback((id: number) => setToast((t) => (t?.id === id ? null : t)), []);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [dialog, setDialog] = useState<"gallery" | "export" | "help" | "render" | null>(null);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({ format: "mp4" });
  // The first-run tour: shown once, replayable from Help.
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (tourSeen() || window.location.hash.startsWith("#share=")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of localStorage on mount
    const timer = window.setTimeout(() => setTour(true), 900);
    return () => window.clearTimeout(timer);
  }, []);
  const endTour = useCallback(() => {
    markTourSeen();
    setTour(false);
  }, []);
  const canRender = typeof window !== "undefined" && canRenderOffline();
  const canAlpha = typeof window !== "undefined" && canRenderAlpha();
  // Phone portrait: which panel the bottom tab bar shows under the stage.
  const [mobileTab, setMobileTab] = useState<MobileTab>("timeline");
  // Portrait: panels hidden so the stage fills the screen.
  const [portraitFocused, setPortraitFocused] = useState(false);
  // Landscape phone: which drawer is open beside the full-screen stage.
  const [landscapeDrawer, setLandscapeDrawer] = useState<MobileTab | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px) and (min-height: 501px)");
  const isLandscapePhone = useMediaQuery("(orientation: landscape) and (max-height: 500px)");
  const mode: "desktop" | "landscape" | "portrait" = isDesktop ? "desktop" : isLandscapePhone ? "landscape" : "portrait";
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const [recording, setRecording] = useState<Recording | null>(null);
  const [codePreview, setCodePreview] = useState<{ title: string; code: string } | null>(null);
  const stopTimer = useRef<number | null>(null);

  // Autosave the working document into its project slot, debounced, and
  // keep the gallery's copy in step.
  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const next = upsertCurrent(storeRef.current, doc);
      const err = saveProjects(next);
      setStore(next);
      setSaveStatus(err ? "failed" : "saved");
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [doc]);

  const duration = useMemo(() => docDuration(doc), [doc]);
  // A composition with a looping clip keeps running so loaders never freeze.
  const hasLoopingClip = doc.clips.some((c) => c.enabled && loopsForever(c));
  // Someone who asked their system for less motion gets a still frame to
  // scrub and edit; Play still works when they want to see it move.
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const clock = useStudioClock(duration, { autoplay: !reducedMotion, loop: loop || hasLoopingClip, speed });

  const selected = doc.clips.find((c) => c.id === selectedId) ?? null;
  const extras = useMemo(() => new Set([...extraIds].filter((id) => id !== selectedId && doc.clips.some((c) => c.id === id))), [extraIds, selectedId, doc.clips]);
  /** Every selected clip, main one first. */
  const selectionIds = useMemo(() => (selectedId ? [selectedId, ...extras] : []), [selectedId, extras]);
  // The waypoint being edited, remembered with its clip so switching clips clears it.
  const [pointSelection, setPointSelection] = useState<{ clipId: string; index: number } | null>(null);
  const selectedPoint =
    selected?.type === "sprite" && pointSelection?.clipId === selected.id && pointSelection.index < selected.path.length
      ? pointSelection.index
      : null;
  // Rig editing: posing (bend limbs, turn bones) or editing the rest joints,
  // and which bone the panels and the stage are talking about.
  const [rigMode, setRigMode] = useState<RigMode>("pose");
  const [boneSelection, setBoneSelection] = useState<{ clipId: string; boneId: string } | null>(null);
  const selectedBone = selected?.type === "rig" && boneSelection?.clipId === selected.id && selected.rig.bones.some((b) => b.id === boneSelection.boneId) ? boneSelection.boneId : null;

  const updateClip = useCallback((next: Clip) => {
    setDoc((d) => ({ ...d, clips: d.clips.map((c) => (c.id === next.id ? next : c)) }), `clip:${next.id}`);
  }, [setDoc]);

  const setClipStart = useCallback((id: string, start: number) => {
    setDoc((d) => ({ ...d, clips: d.clips.map((c) => (c.id === id ? { ...c, start } : c)) }), `start:${id}`);
  }, [setDoc]);

  // Clip order is stacking order on the stage: later clips render on top.
  // The timeline reorders the flat list; setDoc pulls subtrees back together.
  const reorderClips = useCallback((from: number, to: number) => {
    setDoc((d) => ({ ...d, clips: reorder(d.clips, from, to) }));
  }, [setDoc]);

  const dropInTree = useCallback((id: string, target: DropTarget) => setDoc((d) => dropClip(d, id, target)), [setDoc]);
  const moveSibling = useCallback(
    (id: string, direction: -1 | 1) => setDoc((d) => ({ ...d, clips: moveAmongSiblings(d.clips, id, direction) })),
    [setDoc],
  );

  // Stage drags arrive in stage pixels. An attached clip stores its position in
  // its parent's frame, so the delta is mapped through the parent's transform
  // at the current clock time before it is applied.
  const moveClip = useCallback(
    (id: string, delta: Vec2) => {
      // A grouped drag moves every selected clip once: a clip whose ancestor
      // is also selected rides along already.
      const ids = selectionIds.includes(id) ? selectionIds : [id];
      setDoc((d) => {
        const group = new Set(ids);
        const movers = ids.filter((cid) => !ancestorChain(d, cid).slice(1).some((a) => group.has(a.id)));
        return movers.reduce((acc, cid) => nudgeClip(acc, cid, delta, clock.time.get()), d);
      }, `move:${ids.join("+")}`);
    },
    [clock.time, setDoc, selectionIds],
  );

  const reparent = useCallback(
    (id: string, parentId: string | null) => setDoc((d) => reparentClip(d, id, parentId)),
    [setDoc],
  );

  const removeClip = useCallback(
    (id: string) => {
      const ids = selectionIds.includes(id) ? selectionIds : [id];
      const clips = ids.map((cid) => doc.clips.find((c) => c.id === cid)).filter((c): c is Clip => !!c);
      if (clips.length === 0) return;
      setDoc((d) => clips.reduce((acc, c) => deleteClip(acc, c.id), d));
      if (ids.includes(selectedId ?? "")) setSelectedId(null);
      setExtraIds(new Set());
      notify(clips.length === 1 ? `Deleted “${clips[0].name}”` : `Deleted ${clips.length} layers`, { action: { label: "Undo", run: undo } });
    },
    [doc.clips, selectedId, selectionIds, setDoc, notify, undo],
  );

  const movePoint = useCallback((clipId: string, index: number, stageDelta: Vec2) => {
    setDoc((d) => ({
      ...d,
      clips: d.clips.map((c) => {
        if (c.id !== clipId || (c.type !== "sprite" && c.type !== "ribbon")) return c;
        const delta = deltaInParentFrame(d, clipId, stageDelta, clock.time.get());
        if (c.type === "ribbon") {
          return { ...c, points: c.points.map((p, i) => (i === index ? { x: p.x + delta.x, y: p.y + delta.y } : p)) };
        }
        // The last waypoint is the anchor for landing sprites, and every other
        // waypoint is stored relative to it. Dragging the end point moves the
        // anchor and counter-shifts the rest so they stay put on stage.
        if (!c.loop && index === c.path.length - 1) {
          return {
            ...shiftPosition(c, delta.x, delta.y),
            path: c.path.map((p, i) =>
              i === index ? p : { ...p, x: p.x - delta.x, y: p.y - delta.y },
            ),
          };
        }
        return {
          ...c,
          path: c.path.map((p, i) => (i === index ? { ...p, x: p.x + delta.x, y: p.y + delta.y } : p)),
        };
      }),
    }), `point:${clipId}:${index}`);
  }, [clock.time, setDoc]);

  const addClip = useCallback((clip: Clip) => {
    setDoc((d) => ({ ...d, clips: [...d.clips, clip] }));
    setSelectedId(clip.id);
  }, [setDoc]);

  const duplicateClip = useCallback(
    (clip: Clip) => addClip(copyOf(clip, doc)),
    [addClip, doc],
  );

  /** An SVG document becomes a sprite; returns false when it can't be read as SVG. */
  const addSvgMarkup = (text: string, label: string): boolean => {
    const clip = svgSpriteFrom(text, label, doc.stage);
    if (!clip) return false;
    addClip(clip);
    return true;
  };

  // Something arriving from outside on mount: a squiggle sent over from the
  // Squiggle Studio (sessionStorage), or a composition carried in the URL.
  // The squiggle is added to the open composition; the shared composition
  // opens as a new project so the current work stays in the gallery. This
  // has to be an effect, not a lazy state initializer: it changes state the
  // first render already committed.
  const arrivalsTaken = useRef(false);
  useEffect(() => {
    if (arrivalsTaken.current) return;
    arrivalsTaken.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time reads of external stores on mount */
    const shared = typeof window !== "undefined" ? docFromHash(window.location.hash) : null;
    if (shared) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      const next = addProject(storeRef.current, shared);
      saveProjects(next);
      setStore(next);
      replaceDoc(shared);
      setSelectedId(null);
      notify(`Opened “${shared.name}” from a link. It is now one of your compositions.`);
      clock.replay();
      return;
    }
    // Files left behind by compositions deleted in an earlier visit.
    void pruneMedia(storeRef.current, doc);
    const handoff = takeHandoff();
    if (!handoff) return;
    const stage = doc.stage;
    const clip =
      handoff.kind === "flight"
        ? flightFromSquiggle(handoff.points, handoff.colors, handoff.band, stage)
        : handoff.kind === "ribbon"
          ? ribbonFromSquiggle(handoff.points, handoff.colors, handoff.band, stage)
          : artworkFromSquiggle(handoff.svg, handoff.label, stage);
    if (!clip) return;
    setDoc((d) => ({ ...d, clips: [...d.clips, clip] }));
    setSelectedId(clip.id);
    /* eslint-enable react-hooks/set-state-in-effect */
    clock.replay();
  }, [clock, doc.stage, setDoc, replaceDoc, notify]);

  const addByType = (type: AddKind) => {
    const cx = doc.stage.width / 2;
    const cy = doc.stage.height / 2;
    if (type === "logo") addClip(makeLogo({ x: cx, y: cy, start: 0 }));
    if (type === "ribbon") addClip(makeRibbon({ x: cx, y: cy, start: 0 }));
    if (type === "chippy") addClip(makeChippy({ x: cx, y: cy, start: 0 }));
    if (type === "text") {
      const clip = makeText({ x: cx, y: cy, start: 0.5, text: "Your text", accentSuffix: "", rule: false });
      addClip(clip);
      setFreshId(clip.id);
    }
    if (type === "bubble") {
      // Ride the most recently added asset if there is one; else sit on the stage.
      const asset = [...doc.clips].reverse().find((c) => c.type !== "text");
      const clip = asset
        ? makeSpeechText({ parentId: asset.id, x: 88, y: -209, start: 0.5 })
        : makeSpeechText({ x: cx + 88, y: cy - 209, start: 0.5 });
      addClip(clip);
      setFreshId(clip.id);
    }
    if (mode !== "desktop") {
      setMobileTab("edit");
      setLandscapeDrawer("edit");
    }
  };

  const addShape = (kind: ShapeKind, fill: string) => {
    addClip(makeShape(kind, fill, doc.stage));
    if (mode !== "desktop") {
      setMobileTab("edit");
      setLandscapeDrawer("edit");
    }
  };

  const importFile = async (file: File) => {
    try {
      if (/\.json$/i.test(file.name)) {
        const parsed: unknown = JSON.parse(await file.text());
        const asObj = parsed as Record<string, unknown>;
        // A rig is its own format even if it happens to carry Lottie-looking keys.
        if (typeof parsed === "object" && parsed && asObj.format !== RIG_FORMAT && "layers" in asObj && "fr" in asObj) {
          addClip(makeLottie(asObj, file.name, { x: doc.stage.width / 2, y: doc.stage.height / 2 }));
          return;
        }
        const result = parseImport(parsed, doc.stage);
        if (result.kind === "doc") {
          // A whole composition opens as its own project; nothing is overwritten.
          const { doc: hydrated, missing } = await hydrateMedia(result.doc);
          openDoc(hydrated);
          const warnings = [...result.warnings, ...(missing.length ? [`Missing media: ${missing.join(", ")}.`] : [])];
          notify(warnings.length ? `Opened “${hydrated.name}”. ${warnings.join(" ")}` : `Opened “${hydrated.name}” as a new composition.`);
        } else if (result.kind === "clip") {
          const { clip, missing } = await hydrateClipMedia(result.clip);
          addClip(clip);
          if (missing.length) notify(`Missing media: ${missing.join(", ")}. The layer is here but its file is not.`, { sticky: true });
        } else if (result.kind === "rig") {
          addClip(result.clip);
          const { bones, animations } = result.clip.rig;
          notify(`Opened the rig “${result.clip.name}”: ${bones.length} bones, ${animations.length} ${animations.length === 1 ? "clip" : "clips"}. Pick a joint on the canvas to pose it.`);
          clock.replay();
        } else notify(result.message, { sticky: true });
        return;
      }
      if (/\.svg$/i.test(file.name)) {
        if (addSvgMarkup(await file.text(), file.name)) return;
        notify(`Couldn't read ${file.name} as SVG, so it was imported as a picture.`);
      }
      const isVideo = /^video\//.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name);
      const isAudio = /^audio\//.test(file.type) || /\.(mp3|wav|m4a|aac|ogg|oga|flac)$/i.test(file.name);
      if (isVideo || isAudio) {
        if (!hasMediaStore()) throw new Error("This browser can't keep video or sound files. Try Chrome, Edge, Safari or Firefox.");
        const probe = await probeMedia(file, isVideo ? "video" : "audio");
        const mediaId = await putMedia(file, file.name);
        const label = file.name.replace(/\.[a-z0-9]+$/i, "");
        if (isAudio) {
          setDoc((d) => ({ ...d, audio: { mediaId, name: label, length: probe.length, offset: 0, trimStart: 0, volume: 1, fadeOut: 0.5 } }));
          setSelectedId(null);
          notify(`“${label}” is the sound for this composition. Its settings are in the Canvas panel.`);
          return;
        }
        // A landscape video wider than half the stage is most likely a backdrop.
        const background = probe.aspect <= 1 && doc.clips.every((c) => c.type !== "sprite" || c.source.kind !== "video");
        const clip = makeVideoSprite(
          { mediaId, label: file.name, aspect: probe.aspect, length: probe.length, trimStart: 0, playFor: Math.min(probe.length || 10, 60) },
          doc.stage,
          background,
        );
        if (background) {
          setDoc((d) => ({ ...d, clips: [clip, ...d.clips] }));
          setSelectedId(clip.id);
          notify("Added as the backdrop, behind everything else. Shorten it by dragging the end of its bar.");
        } else addClip(clip);
        clock.replay();
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const aspect = await new Promise<number>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve(img.naturalHeight / Math.max(1, img.naturalWidth));
        img.onerror = () => resolve(1);
        img.src = dataUrl;
      });
      addClip(makeImageSprite(dataUrl, file.name, aspect, { x: doc.stage.width / 2, y: doc.stage.height / 2 }));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Import failed", { sticky: true });
    }
  };

  const artwork = {
    onSetRunText: (clip: SpriteClip, runId: string, text: string) => setDoc((d) => setRunText(d, clip, runId, text), `run:${clip.id}:${runId}`),
    onDetachRun: (clip: SpriteClip, runId: string) => {
      const result = detachRun(doc, clip, runId);
      if (!result) return;
      setDoc(result.doc);
      setSelectedId(result.clipId);
    },
    onRestoreRun: (clip: SpriteClip, runId: string) => setDoc((d) => restoreRun(d, clip, runId)),
    onAddAttachedText: (clip: SpriteClip) => {
      const text = attachedTextFor(clip);
      addClip(text);
      setFreshId(text.id);
    },
  };

  // ----- Rigs ---------------------------------------------------------------

  const selectBone = useCallback(
    (boneId: string | null) => {
      if (selected?.type !== "rig") return;
      setBoneSelection(boneId ? { clipId: selected.id, boneId } : null);
      clock.pause();
    },
    [selected, clock],
  );

  /** A joint or bone tip dragged on the canvas: posed, or its rest moved, at the current clock time. */
  const dragHandle = useCallback(
    (clipId: string, boneId: string, handle: RigHandle, point: Vec2) => {
      setDoc((d) => {
        const clip = d.clips.find((c) => c.id === clipId);
        if (clip?.type !== "rig") return d;
        const next = dragRigHandle(clip, clock.time.get(), boneId, handle, rigMode, point);
        return { ...d, clips: d.clips.map((c) => (c.id === clipId ? next : c)) };
      }, `rig:${rigMode}:${clipId}:${boneId}:${handle}`);
    },
    [setDoc, clock.time, rigMode],
  );

  const retimeRigKey = useCallback(
    (clipId: string, time: number, to: number) => {
      setDoc((d) => {
        const clip = d.clips.find((c) => c.id === clipId);
        if (clip?.type !== "rig") return d;
        const animationId = clip.animationId;
        if (!animationId) return d;
        const bone = boneSelection?.clipId === clipId ? boneSelection.boneId : null;
        return { ...d, clips: d.clips.map((c) => (c.id === clipId ? { ...clip, rig: retimeKeys(clip.rig, animationId, bone, time, to) } : c)) };
      }, `rigkey:${clipId}`);
    },
    [setDoc, boneSelection],
  );

  const retimePropKey = useCallback(
    (clipId: string, time: number, to: number) => {
      setDoc((d) => ({ ...d, clips: d.clips.map((c) => (c.id === clipId ? retimePropKeys(c, time, to) : c)) }), `propkey:${clipId}`);
    },
    [setDoc],
  );

  const saveRig = (clip: RigClip) => {
    downloadText(JSON.stringify(clip.rig, null, 2), rigFileName(clip), "application/json");
    notify(`Saved ${rigFileName(clip)} to your downloads. It opens in Agent Torres and the Mid-century Ink generator with every bone and clip.`);
  };

  const rigActions = {
    mode: rigMode,
    onMode: setRigMode,
    selectedBone,
    onSelectBone: selectBone,
    time: clock.time,
    onSeek: (s: number) => {
      clock.pause();
      clock.seek(s);
    },
    onSaveRig: saveRig,
  };

  // ----- Projects -----------------------------------------------------------

  /** Flushes the current document into its slot, then applies `change` to the store. */
  const changeStore = useCallback((change: (s: ProjectStore) => ProjectStore) => {
    const next = change(upsertCurrent(storeRef.current, doc));
    const err = saveProjects(next);
    setStore(next);
    if (err) notify(`Couldn't save to this browser: ${err}. Download a JSON file to keep your work.`, { sticky: true });
    return next;
  }, [doc, notify]);

  /** Opens a document as a brand-new project. */
  const openDoc = useCallback((next: StudioDoc) => {
    changeStore((s) => addProject(s, next));
    replaceDoc(next);
    setSelectedId(null);
    setDialog(null);
    clock.replay();
  }, [changeStore, replaceDoc, clock]);

  const openProject = (id: string) => {
    const next = changeStore((s) => ({ ...s, currentId: id }));
    const project = next.projects.find((p) => p.id === id);
    if (!project) return;
    replaceDoc(project.doc);
    setSelectedId(null);
    setDialog(null);
    clock.replay();
  };

  const deleteProject = (id: string) => {
    const wasCurrent = id === storeRef.current.currentId;
    const next = changeStore((s) => removeProject(s, id));
    void pruneMedia(next, wasCurrent ? undefined : doc);
    if (!wasCurrent) return;
    // The open composition was deleted: fall back to the latest, or a fresh Welcome.
    const fallback = next.projects.find((p) => p.id === next.currentId);
    if (fallback) replaceDoc(fallback.doc);
    else {
      const fresh = welcomePreset();
      const withFresh = addProject(next, fresh);
      saveProjects(withFresh);
      setStore(withFresh);
      replaceDoc(fresh);
    }
    setSelectedId(null);
  };

  // ----- Export -------------------------------------------------------------

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    const blob = await recording.stop();
    setRecording(null);
    setClean(false);
    downloadBlob(blob, `${slug(doc.name)}.webm`);
  }, [recording, doc.name]);

  const record_ = async () => {
    if (recording) {
      void stopRecording();
      return;
    }
    try {
      setDialog(null);
      setClean(true);
      clock.pause();
      clock.seek(0);
      const rec = await startTabRecording();
      setRecording(rec);
      // Give the capture a beat to stabilize, then play from the top.
      window.setTimeout(() => clock.replay(), 400);
      stopTimer.current = window.setTimeout(
        async () => {
          const blob = await rec.stop();
          setRecording(null);
          setClean(false);
          downloadBlob(blob, `${slug(doc.name)}.webm`);
          notify("Saved the recording to your downloads.");
        },
        400 + (duration / speed) * 1000 + 500,
      );
    } catch (err) {
      setClean(false);
      notify(err instanceof Error ? err.message : "Recording failed", { sticky: true });
    }
  };

  const makeShareLink = () => {
    if (hasMedia(doc)) return { ok: false as const, reason: "Video and sound files are too big for a link. Download the composition as a JSON file instead; the media travels inside it." };
    const result = shareUrl(doc, window.location);
    if (result.ok) return result;
    return { ok: false as const, reason: "This composition has pictures in it, which are too big for a link. Download it as a JSON file instead." };
  };

  // ----- Selection, waypoints and keys -------------------------------------

  const selectPoint = useCallback(
    (index: number | null) => setPointSelection(index === null || !selectedId ? null : { clipId: selectedId, index }),
    [selectedId],
  );

  // While a waypoint is selected, park the playhead on it: selecting one (row,
  // stage handle, W) or editing it shows the sprite exactly at that point, and
  // edits that shift its timing (an earlier hold, the duration) follow it.
  const { pause, seek } = clock;
  useEffect(() => {
    if (selected?.type !== "sprite" || selectedPoint === null) return;
    const point = spriteTiming(selected).points[selectedPoint];
    if (!point) return;
    pause();
    seek(selected.start + point.arrive);
  }, [selected, selectedPoint, pause, seek]);

  /** Adds a waypoint where the selected sprite is at the playhead, and selects it. */
  const addWaypoint = useCallback(() => {
    if (selected?.type !== "sprite") return;
    const { clip, index } = insertWaypointAt(selected, clock.time.get());
    updateClip(clip);
    setPointSelection({ clipId: clip.id, index });
  }, [selected, clock.time, updateClip]);

  /** Removes a waypoint; a path keeps at least two. */
  const removeWaypoint = useCallback(
    (index: number) => {
      if (selected?.type !== "sprite" || selected.path.length <= 2) return;
      updateClip({ ...selected, path: selected.path.filter((_, i) => i !== index) });
      setPointSelection(null);
    },
    [selected, updateClip],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      // Handles and dialogs (timeline bars, curve handles, the tour) take their own keys.
      if (target?.closest?.('[role="slider"], [role="dialog"], dialog')) return;
      if (dialog !== null || codePreview || tour) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && !e.altKey) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === "y") {
          e.preventDefault();
          redo();
        } else if (key === "d" && selected) {
          e.preventDefault();
          duplicateClip(selected);
        } else if (key === "c" && selected) {
          e.preventDefault();
          copyClip(selected);
          notify(`Copied “${selected.name}”`);
        } else if (key === "v") {
          const held = heldClip();
          if (!held) return;
          e.preventDefault();
          addClip(copyOf(held, doc));
        }
        return;
      }
      if (e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        clock.toggle();
      } else if (key === "r") clock.replay();
      else if (key === "w") addWaypoint();
      else if (key === "?") setDialog("help");
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedPoint !== null) {
          e.preventDefault();
          removeWaypoint(selectedPoint);
        } else if (selected) {
          e.preventDefault();
          removeClip(selected.id);
        }
      } else if (e.key.startsWith("Arrow") && selected) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const delta = e.key === "ArrowLeft" ? { x: -step, y: 0 } : e.key === "ArrowRight" ? { x: step, y: 0 } : e.key === "ArrowUp" ? { x: 0, y: -step } : { x: 0, y: step };
        moveClip(selected.id, delta);
      } else if (e.key === "Escape") {
        if (drawing) setDrawing(false);
        else if (clean) setClean(false);
        else if (extras.size > 0) setExtraIds(new Set());
        else if (selectedPoint !== null) setPointSelection(null);
        else if (selectedBone !== null) setBoneSelection(null);
        else setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock, addWaypoint, removeWaypoint, selectedPoint, selectedBone, selected, undo, redo, duplicateClip, addClip, doc, removeClip, moveClip, clean, drawing, extras, dialog, codePreview, tour, notify]);

  // Choosing a clip from the list or the stage shows it: if the playhead is
  // outside its time range it would be invisible, so park the clock where it
  // appears before anything can be dragged blind.
  const revealClip = useCallback(
    (id: string | null, additive = false) => {
      if (additive && id && selectedId && id !== selectedId) {
        setExtraIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }
      if (!additive) setExtraIds(new Set());
      setSelectedId(id);
      const clip = id ? doc.clips.find((c) => c.id === id) : null;
      if (!clip) return;
      const t = clock.time.get();
      if (t < clip.start || t > clipEnd(clip)) {
        clock.pause();
        clock.seek(Math.min(clipEnd(clip), clip.start + 0.3));
      }
    },
    [doc.clips, clock, selectedId],
  );
  const transportProps = {
    doc,
    time: clock.time,
    duration,
    playing: clock.playing,
    speed,
    loop,
    selectedId,
    onToggle: clock.toggle,
    onReplay: clock.replay,
    onSeek: (s: number) => {
      clock.pause();
      clock.seek(s);
    },
    onSpeed: setSpeed,
    onLoop: setLoop,
    onSelect: revealClip,
    selectedPoint,
    onSelectWaypoint: (clipId: string, index: number) => {
      setSelectedId(clipId);
      setPointSelection({ clipId, index });
    },
    onRetimeWaypoint: (clipId: string, index: number, travel: number) => {
      const clip = doc.clips.find((c) => c.id === clipId);
      if (clip?.type === "sprite") updateClip(retimeWaypoint(clip, index, travel));
    },
    selectedBone,
    onRetimeRigKey: retimeRigKey,
    onRetimePropKey: retimePropKey,
    onSetStart: setClipStart,
    onChangeClip: updateClip,
    onReorder: reorderClips,
    onChangeAudio: (audio: AudioTrack) => setDoc((d) => ({ ...d, audio }), "audio"),
    onSelectAudio: () => pickClip(null),
    audioSelected: selectedId === null && !!doc.audio,
  };

  // Choosing a clip from the list opens its settings wherever they live.
  const pickClip = (id: string | null, additive = false) => {
    revealClip(id, additive);
    if (additive) return;
    setMobileTab("edit");
    setLandscapeDrawer((open) => (open ? "edit" : open));
  };

  const addToolbar = (layout: "rail" | "sheet") => (
    <AddToolbar
      layout={layout}
      onAdd={addByType}
      onAddShape={addShape}
      onImport={(f) => void importFile(f)}
      drawing={drawing}
      onToggleDraw={() => {
        setDrawing((d) => !d);
        if (!drawing) {
          clock.pause();
          notify(selected?.type === "sprite" ? `Draw a path for “${selected.name}”. Esc stops drawing.` : "Draw on the canvas to make a ribbon. Pick a picture first to draw its path instead. Esc stops drawing.");
        }
      }}
    />
  );

  /** A finished pen stroke: the selected picture's new path, or a new ribbon. */
  const finishStroke = (points: [number, number][]) => {
    setDrawing(false);
    if (selected?.type === "sprite") {
      const flown = pathFromStroke(selected, points);
      if (!flown) return;
      updateClip(flown);
      setPointSelection(null);
      clock.replay();
      notify(`“${selected.name}” now follows your line.`, { action: { label: "Undo", run: undo } });
      return;
    }
    const ribbon = ribbonFromStroke(points);
    if (!ribbon) return;
    addClip(ribbon);
    clock.replay();
  };

  const stage = (
    <EditorStage
      doc={doc}
      time={clock.time}
      selectedId={selectedId}
      extraIds={extras}
      onSelect={revealClip}
      onMoveClip={moveClip}
      onMovePoint={movePoint}
      selectedPoint={selectedPoint}
      onSelectPoint={selectPoint}
      onChangeClip={updateClip}
      onScaleClip={(id, scale) => setDoc((d) => ({ ...d, clips: d.clips.map((c) => (c.id === id ? setPropAt(c, "scale", clock.time.get(), scale) : c)) }), `scale:${id}`)}
      onRotateClip={(id, rotation) => setDoc((d) => ({ ...d, clips: d.clips.map((c) => (c.id === id ? setPropAt(c, "rotation", clock.time.get(), rotation) : c)) }), `rotate:${id}`)}
      clean={clean}
      drawing={drawing}
      onDraw={finishStroke}
      rig={{ mode: rigMode, selectedBone, onSelectBone: selectBone, onDragHandle: dragHandle }}
      overlay={
        clean ? (
          !recording && (
            <div data-stage-overlay className="fixed top-4 right-4 z-[60]">
              <Button size="sm" variant="outline" className="bg-surface-raised" icon={<CollapseIcon width={16} height={16} />} onClick={() => setClean(false)}>
                Exit preview
              </Button>
            </div>
          )
        ) : (
          <>
            {doc.clips.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <p className="max-w-xs text-center text-base leading-6 text-ink-secondary">
                  An empty canvas. Add text, a shape, a picture or a ribbon with <strong className="font-semibold text-ink">+</strong>
                  {mode === "desktop" ? " on the left" : " below"}, or open <strong className="font-semibold text-ink">Compositions</strong> for a ready-made start.
                </p>
              </div>
            )}
            {mode === "desktop" ? (
              <div data-stage-overlay data-tour="add" className="absolute top-4 left-4 z-10">
                {addToolbar("rail")}
              </div>
            ) : (
              <div data-stage-overlay data-tour="add" className="absolute right-3 bottom-3 z-10">
                {addToolbar("sheet")}
              </div>
            )}
          </>
        )
      }
    />
  );

  const undoRedo = (
    <>
      <IconButton label={`Undo (${mac ? "⌘" : "Ctrl+"}Z)`} disabled={!canUndo(history)} className="disabled:opacity-[0.42]" onClick={undo}>
        <UndoIcon />
      </IconButton>
      <IconButton label={`Redo (${mac ? "⌘⇧" : "Ctrl+Shift+"}Z)`} disabled={!canRedo(history)} className="disabled:opacity-[0.42]" onClick={redo}>
        <RedoIcon />
      </IconButton>
    </>
  );

  const saveLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "failed" ? "Not saved" : "Saved";

  const slots: StudioSlots = {
    title: <TitleField value={doc.name} onChange={(name) => setDoc((d) => ({ ...d, name }), "name")} status={saveLabel} compact={mode !== "desktop"} />,
    actions: (
      <div className="flex items-center gap-1">
        {undoRedo}
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border-strong" />
        <Button size="sm" variant="outline" icon={<GridIcon width={18} height={18} />} onClick={() => setDialog("gallery")}>
          Compositions
        </Button>
        <Link
          href="/squiggle"
          className="atm-button-type inline-flex min-h-10 items-center gap-2 rounded-md border border-border-control px-3 text-[12.5px] leading-none text-ink transition-[background-color,box-shadow] duration-200 hover:bg-surface-raised hover:shadow-pop"
        >
          <SquiggleIcon width={18} height={18} />
          Squiggles
        </Link>
        <span data-tour="share" className="inline-flex">
          <Button size="sm" icon={<ShareIcon width={18} height={18} />} onClick={() => setDialog("export")}>
            Share
          </Button>
        </span>
        <IconButton label="Help and shortcuts (?)" onClick={() => setDialog("help")}>
          <HelpIcon />
        </IconButton>
      </div>
    ),
    phoneActions: (
      <>
        {undoRedo}
        <IconButton label="Compositions" onClick={() => setDialog("gallery")}>
          <GridIcon />
        </IconButton>
        <span data-tour="share" className="inline-flex">
          <IconButton label="Share and export" onClick={() => setDialog("export")}>
            <ShareIcon />
          </IconButton>
        </span>
      </>
    ),
    stage,
    playback: <Transport {...transportProps} layout="bar" />,
    timeline: <Transport {...transportProps} layout="full" />,
    tracks: <Transport {...transportProps} layout="tracks" />,
    clips: (
      <ClipTree
        doc={doc}
        selectedId={selectedId}
        extraIds={extras}
        onSelect={pickClip}
        onSelectCanvas={() => pickClip(null)}
        onRename={(clip, name) => updateClip({ ...clip, name })}
        onToggleEnabled={(clip, enabled) => updateClip({ ...clip, enabled })}
        onSolo={(id) => setDoc((d) => ({ ...d, clips: d.clips.map((c) => ({ ...c, enabled: c.id === id })) }))}
        onDuplicate={duplicateClip}
        onDelete={removeClip}
        onDrop={dropInTree}
        onMoveSibling={moveSibling}
      />
    ),
    edit: selected ? (
      <>
        <div className="mb-4 flex items-center gap-2">
          {mode !== "desktop" && (
            <button
              type="button"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-sunken"
              aria-label="Back to the canvas settings"
              onClick={() => setSelectedId(null)}
            >
              <ChevronLeftIcon />
            </button>
          )}
          {(() => {
            const Glyph = clipIcon(selected);
            return <Glyph width={20} height={20} className="shrink-0 text-primary" />;
          })()}
          <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{selected.name}</h2>
          {extras.size > 0 && (
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 font-sans text-[11px] font-semibold tracking-[0.04em] text-ink" title="Shift-click adds layers to the selection; they move and delete together.">
              +{extras.size} more
            </span>
          )}
        </div>
        <ClipControls
          key={selected.id}
          doc={doc}
          clip={selected}
          onChange={updateClip}
          onReparent={(p) => reparent(selected.id, p)}
          focusText={freshId === selected.id}
          artwork={artwork}
          waypoints={{
            selected: selectedPoint,
            onSelect: selectPoint,
            onAdd: addWaypoint,
            onRemove: removeWaypoint,
            onRetime: (index, travel) => {
              if (selected.type === "sprite") updateClip(retimeWaypoint(selected, index, travel));
            },
          }}
          rig={rigActions}
          time={clock.time}
        />
        <div className="mt-6 flex flex-wrap gap-2 border-t border-hairline pt-4">
          <Button size="xs" variant="outline" onClick={() => duplicateClip(selected)}>
            Duplicate
          </Button>
          <Button size="xs" variant="outline" onClick={() => void inlineClipMedia(selected).then((full) => downloadText(JSON.stringify(full, null, 2), `${slug(selected.name)}.clip.json`, "application/json"))}>
            Save layer as JSON
          </Button>
          {selected.type === "rig" && (
            <Button size="xs" variant="outline" onClick={() => saveRig(selected)}>
              Save rig (.mci.json)
            </Button>
          )}
          <Button size="xs" variant="danger" onClick={() => removeClip(selected.id)}>
            Delete
          </Button>
        </div>
      </>
    ) : (
      <>
        <CanvasPanel doc={doc} onChangeDoc={(next) => setDoc(next, "canvas")} onImport={(f) => void importFile(f)} />
        {mode !== "desktop" && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-hairline pt-4">
            <Link href="/squiggle" className="atm-button-type inline-flex min-h-11 items-center gap-2 rounded-md border border-border-control px-3 text-[12.5px] leading-none text-ink">
              <SquiggleIcon width={18} height={18} />
              Draw a squiggle
            </Link>
            <Button size="sm" variant="outline" icon={<HelpIcon width={18} height={18} />} onClick={() => setDialog("help")}>
              Help
            </Button>
          </div>
        )}
      </>
    ),
  };

  const shell =
    mode === "desktop" ? (
      <DesktopShell {...slots} />
    ) : mode === "landscape" ? (
      <LandscapeShell {...slots} drawer={landscapeDrawer} onDrawer={setLandscapeDrawer} />
    ) : (
      <PortraitShell
        {...slots}
        tab={mobileTab}
        onTab={setMobileTab}
        focused={portraitFocused}
        onFocused={setPortraitFocused}
      />
    );

  return (
    <>
      <style>{"nextjs-portal { display: none; }"}</style>
      {clean ? <div className="h-dvh">{stage}</div> : shell}
      {doc.audio && dialog !== "render" && <AudioPlayer audio={doc.audio} time={clock.time} playing={clock.playing} duration={duration} speed={speed} />}
      <Toast toast={toast} onDismiss={dismissToast} />
      <GalleryDialog
        open={dialog === "gallery"}
        onClose={() => setDialog(null)}
        projects={store.projects}
        currentId={store.currentId}
        onOpenProject={openProject}
        onNewFromTemplate={openDoc}
        onNewBlank={(w, h) => openDoc(blankDoc(w, h))}
        onDuplicateProject={(id) => changeStore((s) => duplicateProject(s, id))}
        onDeleteProject={deleteProject}
        onRenameProject={(id, name) => {
          if (id === store.currentId) setDoc((d) => ({ ...d, name }), "name");
          else changeStore((s) => renameProject(s, id, name));
        }}
      />
      <ExportDialog
        open={dialog === "export"}
        onClose={() => setDialog(null)}
        docName={doc.name}
        duration={duration / speed}
        canRender={canRender}
        canAlpha={canAlpha}
        transparent={doc.stage.transparent}
        stageWidth={doc.stage.width}
        hasSound={!!doc.audio}
        onRender={(options) => {
          setRenderOptions(options);
          setDialog("render");
        }}
        canRecord={canRecord}
        onRecord={() => void record_()}
        onShareLink={makeShareLink}
        onDownloadJson={() => {
          void inlineMedia(doc).then((full) => downloadText(JSON.stringify(full, null, 2), `${slug(doc.name)}.studio.json`, "application/json"));
        }}
        onShowCode={() => {
          setDialog(null);
          setCodePreview({ title: `${slug(doc.name)}.tsx`, code: docComponentCode(doc) });
        }}
        onPreview={() => {
          setDialog(null);
          setClean(true);
          clock.replay();
        }}
      />
      <HelpDialog
        open={dialog === "help"}
        onClose={() => setDialog(null)}
        onTour={() => {
          setDialog(null);
          setTour(true);
        }}
        mac={mac}
      />
      {tour && dialog === null && <Tour steps={TOUR_STEPS} onDone={endTour} />}
      {dialog === "render" && (
        <VideoExporter
          doc={doc}
          duration={duration}
          fileStem={slug(doc.name)}
          options={renderOptions}
          onDone={(message) => {
            setDialog(null);
            notify(message);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {codePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-inverse/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={codePreview.title}>
          <div className="flex max-h-full w-full max-w-4xl flex-col rounded-lg border border-border-strong bg-surface-raised shadow-lg">
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
              <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">{codePreview.title}</h2>
              {selected && (
                <Button size="xs" variant="outline" onClick={() => setCodePreview({ title: `${slug(selected.name)}.tsx`, code: clipComponentCode(doc, selected) })}>
                  Just “{selected.name}”
                </Button>
              )}
              <Button size="xs" variant="outline" onClick={() => void navigator.clipboard.writeText(codePreview.code).then(() => notify("Copied the code"))}>
                Copy
              </Button>
              <Button size="xs" variant="outline" onClick={() => downloadText(codePreview.code, codePreview.title, "text/plain")}>
                Download
              </Button>
              <Button size="xs" onClick={() => setCodePreview(null)}>
                Close
              </Button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto bg-surface-sunken p-4 text-xs leading-relaxed">{codePreview.code}</pre>
            <pre className="border-t border-hairline p-4 text-xs leading-relaxed whitespace-pre-wrap text-ink-secondary">{HANDOFF_NOTES}</pre>
          </div>
        </div>
      )}
    </>
  );
}
