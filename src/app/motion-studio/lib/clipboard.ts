import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { newId } from "../presets";

/** How far a pasted or duplicated copy sits from the original, in stage px. */
export const PASTE_OFFSET = 24;

/**
 * The studio's own clipboard: one clip, kept for the tab's lifetime so a
 * copy survives switching compositions. Not the system clipboard, which
 * would need permission prompts for a thing that never leaves the page.
 */
let held: Clip | null = null;

export function copyClip(clip: Clip): void {
  held = clip;
}

export function heldClip(): Clip | null {
  return held;
}

/**
 * A fresh copy, offset so it is visibly a copy. It keeps following its
 * parent when that parent is in the target document, else it is set free.
 */
export function copyOf(clip: Clip, doc: StudioDoc, offset = PASTE_OFFSET): Clip {
  const parentStays = clip.parentId !== null && doc.clips.some((c) => c.id === clip.parentId);
  return {
    ...clip,
    id: newId(),
    name: /\bcopy\b/.test(clip.name) ? clip.name : `${clip.name} copy`,
    parentId: parentStays ? clip.parentId : null,
    along: parentStays ? clip.along : null,
    x: clip.x + offset,
    y: clip.y + offset,
  };
}
