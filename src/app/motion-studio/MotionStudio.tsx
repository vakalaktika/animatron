"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioClock } from "@/app/components/motion-studio/engine/clock";
import { docDuration } from "@/app/components/motion-studio/engine/timing";
import type { Clip, SpriteClip, StudioDoc, Vec2 } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { clipComponentCode, docComponentCode, HANDOFF_NOTES } from "./export/codegen";
import { downloadBlob, downloadText, startTabRecording, type Recording } from "./export/recorder";
import { parseSvg } from "@/app/components/motion-studio/engine/svgText";
import { deleteClip, deltaInParentFrame, dropClip, nudgeClip, reparentClip } from "./lib/attach";
import { reorder } from "./lib/order";
import { attachedTextFor, detachRun, restoreRun, setRunText } from "./lib/textRuns";
import { moveAmongSiblings, normalizeOrder, type DropTarget } from "./lib/tree";
import { ClipControls } from "./panel/ClipControls";
import { ClipTree } from "./panel/ClipTree";
import type { MobileTab } from "./panel/MobileTabs";
import { StagePanel } from "./panel/StagePanel";
import { Transport } from "./panel/Transport";
import {
  endCapPreset,
  loadSavedPresets,
  makeChippy,
  makeImageSprite,
  makeLogo,
  makeLottie,
  makeSpeechText,
  makeSvgSprite,
  makeText,
  newId,
  parseImport,
  savePresets,
  type SavedPreset,
} from "./presets";
import { EditorStage } from "./stage/EditorStage";
import { loadDoc, saveDoc } from "./lib/persistence";
import { useMediaQuery } from "./lib/useMediaQuery";
import { ChevronLeftIcon } from "./panel/icons";
import { DesktopShell } from "./shell/DesktopShell";
import { LandscapeShell } from "./shell/LandscapeShell";
import { PortraitShell } from "./shell/PortraitShell";
import type { StudioSlots } from "./shell/types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "animation";

export function MotionStudio() {
  // Restore the autosaved working document on load, falling back to the default
  // preset. Lazy initializer so localStorage is only read on the client.
  const [doc, setRawDoc] = useState<StudioDoc>(() => loadDoc() ?? endCapPreset());
  // Every write keeps the clip list in tree order (each clip followed by its
  // descendants), which is what the layer tree and the paint order both read.
  const setDoc = useCallback((next: StudioDoc | ((d: StudioDoc) => StudioDoc)) => {
    setRawDoc((d) => {
      const resolved = typeof next === "function" ? next(d) : next;
      const clips = normalizeOrder(resolved.clips);
      return clips === resolved.clips ? resolved : { ...resolved, clips };
    });
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The clip just added by a "+" button: its text field gets focus once.
  const [freshId, setFreshId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [clean, setClean] = useState(false);
  // Lazy initializer: localStorage is only read on the client, after mount
  // is not required since this component is never server-rendered with data.
  const [saved, setSaved] = useState<SavedPreset[]>(() =>
    typeof window === "undefined" ? [] : loadSavedPresets(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  // Phone portrait: which panel the bottom tab bar shows under the stage.
  const [mobileTab, setMobileTab] = useState<MobileTab>("timeline");
  // Portrait: panels hidden so the stage fills the screen.
  const [portraitFocused, setPortraitFocused] = useState(false);
  // Landscape phone: which drawer is open beside the full-screen stage.
  const [landscapeDrawer, setLandscapeDrawer] = useState<MobileTab | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px) and (min-height: 501px)");
  const isLandscapePhone = useMediaQuery("(orientation: landscape) and (max-height: 500px)");
  const mode: "desktop" | "landscape" | "portrait" = isDesktop ? "desktop" : isLandscapePhone ? "landscape" : "portrait";
  const [recording, setRecording] = useState<Recording | null>(null);
  const [codePreview, setCodePreview] = useState<{ title: string; code: string } | null>(null);
  const stopTimer = useRef<number | null>(null);

  // Autosave the working document to localStorage (debounced inside saveDoc)
  // so the composition survives a page refresh.
  useEffect(() => {
    saveDoc(doc);
  }, [doc]);

  const duration = useMemo(() => docDuration(doc), [doc]);
  // A composition with a looping clip keeps running so loaders never freeze.
  const hasLoopingClip = doc.clips.some(
    (c) => c.enabled && (c.type === "sprite" || c.type === "lottie") && c.loop,
  );
  const clock = useStudioClock(duration, { autoplay: true, loop: loop || hasLoopingClip, speed });

  const selected = doc.clips.find((c) => c.id === selectedId) ?? null;

  const updateClip = useCallback((next: Clip) => {
    setDoc((d) => ({ ...d, clips: d.clips.map((c) => (c.id === next.id ? next : c)) }));
  }, [setDoc]);

  const setClipStart = useCallback((id: string, start: number) => {
    setDoc((d) => ({ ...d, clips: d.clips.map((c) => (c.id === id ? { ...c, start } : c)) }));
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
    (id: string, delta: Vec2) => setDoc((d) => nudgeClip(d, id, delta, clock.time.get())),
    [clock.time, setDoc],
  );

  const reparent = useCallback(
    (id: string, parentId: string | null) => setDoc((d) => reparentClip(d, id, parentId)),
    [setDoc],
  );

  const removeClip = (id: string) => {
    setDoc((d) => deleteClip(d, id));
    if (selectedId === id) setSelectedId(null);
  };

  const movePoint = useCallback((clipId: string, index: number, stageDelta: Vec2) => {
    setDoc((d) => ({
      ...d,
      clips: d.clips.map((c) => {
        if (c.id !== clipId || c.type !== "sprite") return c;
        const delta = deltaInParentFrame(d, clipId, stageDelta, clock.time.get());
        // The last waypoint is the anchor for landing sprites, and every other
        // waypoint is stored relative to it. Dragging the end point moves the
        // anchor and counter-shifts the rest so they stay put on stage.
        if (!c.loop && index === c.path.length - 1) {
          return {
            ...c,
            x: c.x + delta.x,
            y: c.y + delta.y,
            path: c.path.map((p, i) =>
              i === index ? p : { x: p.x - delta.x, y: p.y - delta.y },
            ),
          };
        }
        return {
          ...c,
          path: c.path.map((p, i) => (i === index ? { x: p.x + delta.x, y: p.y + delta.y } : p)),
        };
      }),
    }));
  }, [clock.time, setDoc]);

  const addClip = (clip: Clip) => {
    setDoc((d) => ({ ...d, clips: [...d.clips, clip] }));
    setSelectedId(clip.id);
  };

  const addByType = (type: "logo" | "chippy" | "bubble" | "text") => {
    const cx = doc.stage.width / 2;
    const cy = doc.stage.height / 2;
    if (type === "logo") addClip(makeLogo({ x: cx, y: cy, start: 0 }));
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
  };

  const importFile = async (file: File) => {
    try {
      if (/\.json$/i.test(file.name)) {
        const parsed: unknown = JSON.parse(await file.text());
        const asObj = parsed as Record<string, unknown>;
        if (typeof parsed === "object" && parsed && "layers" in asObj && "fr" in asObj) {
          addClip(makeLottie(asObj, file.name, { x: doc.stage.width / 2, y: doc.stage.height / 2 }));
          return;
        }
        const result = parseImport(parsed);
        if (result.kind === "doc") {
          setDoc(result.doc);
          setSelectedId(null);
          if (result.warnings.length) setNotice(result.warnings.join(" "));
        } else if (result.kind === "clip") addClip(result.clip);
        else setNotice(result.message);
        return;
      }
      if (/\.svg$/i.test(file.name)) {
        const parsed = parseSvg(await file.text());
        if (parsed) {
          addClip(makeSvgSprite(parsed.markup, file.name, parsed.aspect, parsed.textRuns, { x: doc.stage.width / 2, y: doc.stage.height / 2 }));
          return;
        }
        setNotice(`Couldn't read ${file.name} as SVG, so it was imported as a picture.`);
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
      setNotice(err instanceof Error ? err.message : "Import failed");
    }
  };

  const artwork = {
    onSetRunText: (clip: SpriteClip, runId: string, text: string) => setDoc((d) => setRunText(d, clip, runId, text)),
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

  const savePreset = () => {
    const name = window.prompt("Preset name", doc.name);
    if (!name) return;
    const next = [...saved.filter((p) => p.name !== name), { name, savedAt: new Date().toISOString(), doc: { ...doc, name } }];
    const err = savePresets(next);
    if (err) setNotice(`Could not save: ${err}. Export JSON instead for large Lottie files.`);
    else {
      setSaved(next);
      setNotice(`Saved "${name}"`);
    }
  };

  const deletePreset = (name: string) => {
    const next = saved.filter((p) => p.name !== name);
    savePresets(next);
    setSaved(next);
  };

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    const blob = await recording.stop();
    setRecording(null);
    setClean(false);
    downloadBlob(blob, `${slug(doc.name)}.webm`);
  }, [recording, doc.name]);

  const record = async () => {
    if (recording) {
      void stopRecording();
      return;
    }
    try {
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
        },
        400 + (duration / speed) * 1000 + 500,
      );
    } catch (err) {
      setClean(false);
      setNotice(err instanceof Error ? err.message : "Recording failed");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        clock.toggle();
      } else if (e.key === "r" || e.key === "R") clock.replay();
      else if (e.key === "Escape") setClean(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock]);

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
    onSelect: setSelectedId,
    onSetStart: setClipStart,
    onReorder: reorderClips,
  };

  // Choosing a clip from the list opens its settings wherever they live.
  const pickClip = (id: string) => {
    setSelectedId(id);
    setMobileTab("edit");
    setLandscapeDrawer((open) => (open ? "edit" : open));
  };

  const stage = (
    <EditorStage
      doc={doc}
      time={clock.time}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onMoveClip={moveClip}
      onMovePoint={movePoint}
      onChangeClip={updateClip}
      clean={clean}
    />
  );

  const slots: StudioSlots = {
    docName: doc.name,
    stage,
    playback: <Transport {...transportProps} layout="bar" />,
    timeline: <Transport {...transportProps} layout="full" />,
    tracks: <Transport {...transportProps} layout="tracks" />,
    clips: (
      <>
        <ClipTree
          doc={doc}
          selectedId={selectedId}
          onSelect={pickClip}
          onToggleEnabled={(clip, enabled) => updateClip({ ...clip, enabled })}
          onSolo={(id) => setDoc((d) => ({ ...d, clips: d.clips.map((c) => ({ ...c, enabled: c.id === id })) }))}
          onDuplicate={(clip) => addClip({ ...clip, id: newId(), name: `${clip.name} copy` })}
          onDelete={removeClip}
          onDrop={dropInTree}
          onMoveSibling={moveSibling}
        />
        <div className="mt-3 flex gap-2">
          <Button size="xs" variant="outline" onClick={() => setDoc((d) => ({ ...d, clips: d.clips.map((c) => ({ ...c, enabled: true })) }))}>
            Show all
          </Button>
        </div>
      </>
    ),
    edit: (
      <>
        {selected ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-2">
              {mode !== "desktop" && (
                <button
                  type="button"
                  className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-sunken"
                  aria-label="Back to stage settings"
                  onClick={() => setSelectedId(null)}
                >
                  <ChevronLeftIcon />
                </button>
              )}
              <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{selected.name}</h2>
              <div className="flex gap-2">
                <Button size="xs" variant="outline" onClick={() => setCodePreview({ title: `${selected.name}.tsx`, code: clipComponentCode(doc, selected) })}>
                  Code
                </Button>
                <Button size="xs" variant="outline" onClick={() => downloadText(JSON.stringify(selected, null, 2), `${slug(selected.name)}.clip.json`, "application/json")}>
                  JSON
                </Button>
              </div>
            </div>
            <ClipControls
              key={selected.id}
              doc={doc}
              clip={selected}
              onChange={updateClip}
              onReparent={(p) => reparent(selected.id, p)}
              focusText={freshId === selected.id}
              artwork={artwork}
            />
            {mode === "desktop" && (
              <Button size="xs" variant="outline" className="mt-6" onClick={() => setSelectedId(null)}>
                Back to stage settings
              </Button>
            )}
          </>
        ) : (
          <StagePanel
            doc={doc}
            onChangeDoc={setDoc}
            saved={saved}
            onSavePreset={savePreset}
            onLoadPreset={(d) => {
              setDoc(d);
              setSelectedId(null);
              clock.replay();
            }}
            onDeletePreset={deletePreset}
            onImportFile={(f) => void importFile(f)}
            onAddClip={addByType}
            onExportDocCode={() => setCodePreview({ title: `${slug(doc.name)}.tsx`, code: docComponentCode(doc) })}
            onExportDocJson={() => downloadText(JSON.stringify(doc, null, 2), `${slug(doc.name)}.studio.json`, "application/json")}
            onRecord={() => void record()}
            recording={recording !== null}
            onClean={() => setClean(true)}
            notice={notice}
          />
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
      {codePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-inverse/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={codePreview.title}>
          <div className="flex max-h-full w-full max-w-4xl flex-col rounded-lg border border-border-strong bg-surface-raised shadow-lg">
            <div className="flex flex-wrap items-center gap-2 border-b border-background-cta-10 px-4 py-3">
              <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">{codePreview.title}</h2>
              <Button size="xs" variant="outline" onClick={() => void navigator.clipboard.writeText(codePreview.code).then(() => setNotice("Copied"))}>
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
            <pre className="border-t border-background-cta-10 p-4 text-xs leading-relaxed whitespace-pre-wrap text-ink-secondary">{HANDOFF_NOTES}</pre>
          </div>
        </div>
      )}
    </>
  );
}
