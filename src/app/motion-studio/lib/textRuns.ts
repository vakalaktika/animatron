import type { Clip, SpriteClip, StudioDoc, SvgTextRun } from "@/app/components/motion-studio/types";
import { makeSpeechText, makeText, newId } from "../presets";

type SvgSource = Extract<SpriteClip["source"], { kind: "svg" }>;

function withRuns(clip: SpriteClip, source: SvgSource, textRuns: SvgTextRun[]): SpriteClip {
  return { ...clip, source: { ...source, textRuns } };
}

function replaceClip(doc: StudioDoc, next: Clip): StudioDoc {
  return { ...doc, clips: doc.clips.map((c) => (c.id === next.id ? next : c)) };
}

/** Edits one run's text in place. */
export function setRunText(doc: StudioDoc, clip: SpriteClip, runId: string, text: string): StudioDoc {
  if (clip.source.kind !== "svg") return doc;
  const runs = clip.source.textRuns.map((r) => (r.id === runId ? { ...r, text } : r));
  return replaceClip(doc, withRuns(clip, clip.source, runs));
}

/**
 * Pulls a run out of the artwork into its own text clip attached to the
 * asset, sitting just above it. The run is hidden in the SVG until restored.
 */
export function detachRun(doc: StudioDoc, clip: SpriteClip, runId: string): { doc: StudioDoc; clipId: string } | null {
  if (clip.source.kind !== "svg") return null;
  const run = clip.source.textRuns.find((r) => r.id === runId);
  if (!run || run.detachedTo) return null;
  const text = makeText({
    id: newId(),
    name: run.text.slice(0, 24) || "Text run",
    parentId: clip.id,
    x: 0,
    y: -(clip.width * clip.source.aspect) / 2 - 24,
    start: clip.start,
    text: run.text,
    accentSuffix: "",
    rule: false,
    reveal: "fade",
    revealDuration: 0.3,
  });
  const runs = clip.source.textRuns.map((r) => (r.id === runId ? { ...r, detachedTo: text.id } : r));
  const next = replaceClip(doc, withRuns(clip, clip.source, runs));
  return { doc: { ...next, clips: [...next.clips, text] }, clipId: text.id };
}

/** Puts a detached run back into the artwork and removes the text clip it became. */
export function restoreRun(doc: StudioDoc, clip: SpriteClip, runId: string): StudioDoc {
  if (clip.source.kind !== "svg") return doc;
  const run = clip.source.textRuns.find((r) => r.id === runId);
  if (!run?.detachedTo) return doc;
  const runs = clip.source.textRuns.map((r) => (r.id === runId ? { ...r, detachedTo: null } : r));
  const next = replaceClip(doc, withRuns(clip, clip.source, runs));
  return { ...next, clips: next.clips.filter((c) => c.id !== run.detachedTo) };
}

/** A speech-container text clip riding a picture whose own text can't be edited. */
export function attachedTextFor(clip: SpriteClip): Clip {
  const height = clip.source.kind === "chippy" ? clip.width * 0.82 : clip.width * clip.source.aspect;
  return makeSpeechText({
    parentId: clip.id,
    x: 38,
    y: -height / 2 - 30,
    start: clip.start,
    text: "Your text",
  });
}
