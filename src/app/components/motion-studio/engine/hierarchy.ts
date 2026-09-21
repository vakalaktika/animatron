import type { Clip, StudioDoc } from "../types";

/** Clips keyed by id, for repeated lookups while walking the tree. */
export function clipIndex(doc: StudioDoc): Map<string, Clip> {
  return new Map(doc.clips.map((c) => [c.id, c]));
}

/**
 * The clip and its ancestors, nearest first. Stops at a missing parent or at
 * the first repeated id, so a malformed document with a parent loop still
 * yields a finite chain.
 */
export function ancestorChain(doc: StudioDoc, clipId: string): Clip[] {
  const byId = clipIndex(doc);
  const chain: Clip[] = [];
  const seen = new Set<string>();
  let current = byId.get(clipId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** Nesting depth: 0 for a root clip, 1 for its children, and so on. */
export function depthOf(doc: StudioDoc, clipId: string): number {
  return Math.max(0, ancestorChain(doc, clipId).length - 1);
}

/** Direct children, in list (paint) order. */
export function childrenOf(doc: StudioDoc, clipId: string): Clip[] {
  return doc.clips.filter((c) => c.parentId === clipId);
}

/** Every clip below `clipId`, at any depth. Guards against loops. */
export function descendantIds(doc: StudioDoc, clipId: string): Set<string> {
  const found = new Set<string>();
  const queue = [clipId];
  while (queue.length) {
    const id = queue.shift();
    if (id === undefined) break;
    for (const child of childrenOf(doc, id)) {
      if (found.has(child.id) || child.id === clipId) continue;
      found.add(child.id);
      queue.push(child.id);
    }
  }
  return found;
}

/**
 * Ids that sit on a parent loop (A → B → A). Clips that merely point into a
 * loop from outside are not included; once the loop is broken they are fine.
 */
export function loopMemberIds(doc: StudioDoc): Set<string> {
  const byId = clipIndex(doc);
  const members = new Set<string>();
  for (const clip of doc.clips) {
    const walk: string[] = [];
    const seen = new Set<string>();
    let current: Clip | undefined = clip;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      walk.push(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (!current) continue;
    for (const id of walk.slice(walk.indexOf(current.id))) members.add(id);
  }
  return members;
}

/** Clips a given clip may attach to: everything except itself and its descendants. */
export function attachableParents(doc: StudioDoc, clipId: string): Clip[] {
  const excluded = descendantIds(doc, clipId);
  return doc.clips.filter((c) => c.id !== clipId && !excluded.has(c.id));
}
