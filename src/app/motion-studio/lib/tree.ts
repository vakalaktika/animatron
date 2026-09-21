import type { Clip } from "@/app/components/motion-studio/types";

/*
 * The clip list is a tree drawn from the flat `doc.clips` array. The array
 * stays the paint order (later paints on top), with one constraint: every
 * clip is immediately followed by its descendants, so a child always paints
 * above its parent and the tree reads top to bottom. `normalizeOrder`
 * enforces that after any edit; the tree helpers here assume it.
 */

export interface TreeRow {
  clip: Clip;
  depth: number;
  hasChildren: boolean;
}

/** Where a dragged subtree will land: under `parentId`, right after sibling `afterId` (null = first). */
export interface DropTarget {
  parentId: string | null;
  afterId: string | null;
  depth: number;
  /** Slot between visible rows, 0 = above the first row. */
  gap: number;
}

/** Children keyed by parent id (null for roots), in flat order. Orphans count as roots. */
export function childrenByParent(clips: readonly Clip[]): Map<string | null, Clip[]> {
  const ids = new Set(clips.map((c) => c.id));
  const map = new Map<string | null, Clip[]>();
  for (const clip of clips) {
    const key = clip.parentId && ids.has(clip.parentId) ? clip.parentId : null;
    map.set(key, [...(map.get(key) ?? []), clip]);
  }
  return map;
}

function flatten(map: Map<string | null, Clip[]>, parentId: string | null, seen: Set<string>): Clip[] {
  const out: Clip[] = [];
  for (const clip of map.get(parentId) ?? []) {
    if (seen.has(clip.id)) continue;
    seen.add(clip.id);
    out.push(clip, ...flatten(map, clip.id, seen));
  }
  return out;
}

/** Depth-first order: each clip followed by its subtree. Returns the same array when already in order. */
export function normalizeOrder(clips: Clip[]): Clip[] {
  const seen = new Set<string>();
  const ordered = flatten(childrenByParent(clips), null, seen);
  // Clips on a parent loop never get reached from a root; keep them at the end as roots.
  const stranded = clips.filter((c) => !seen.has(c.id)).map((c) => ({ ...c, parentId: null }));
  const next = [...ordered, ...stranded];
  const unchanged = next.length === clips.length && next.every((c, i) => c === clips[i]);
  return unchanged ? clips : next;
}

/** Ids of every clip below `id`. */
export function subtreeIds(clips: readonly Clip[], id: string): Set<string> {
  const map = childrenByParent(clips);
  const out = new Set<string>();
  const walk = (parent: string) => {
    for (const child of map.get(parent) ?? []) {
      if (out.has(child.id)) continue;
      out.add(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

/** Rows to draw, top to bottom, skipping the descendants of collapsed clips. */
export function treeRows(clips: readonly Clip[], collapsed: ReadonlySet<string>): TreeRow[] {
  const map = childrenByParent(clips);
  const rows: TreeRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const clip of map.get(parentId) ?? []) {
      const kids = map.get(clip.id) ?? [];
      rows.push({ clip, depth, hasChildren: kids.length > 0 });
      if (!collapsed.has(clip.id)) walk(clip.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Resolves a drop at `gap` (between rows[gap - 1] and rows[gap]) with the
 * depth the pointer is asking for. `rows` must already exclude the dragged
 * subtree. The depth is clamped to what the neighbours allow: at most one
 * deeper than the row above (its child), at least the depth of the row
 * below (so the row below keeps its parent).
 */
export function projectDrop(rows: readonly TreeRow[], gap: number, wantDepth: number): DropTarget | null {
  if (gap < 0 || gap > rows.length) return null;
  const above = rows[gap - 1];
  const below = rows[gap];
  const maxDepth = above ? above.depth + 1 : 0;
  const minDepth = below ? below.depth : 0;
  const depth = clamp(wantDepth, minDepth, maxDepth);
  if (depth === 0) {
    return { parentId: null, afterId: lastAtDepth(rows, gap, 0), depth, gap };
  }
  const parentId = lastAtDepth(rows, gap, depth - 1);
  if (parentId === null) return null;
  return { parentId, afterId: above?.depth === depth - 1 ? null : lastAtDepth(rows, gap, depth), depth, gap };
}

/** Nearest row above the gap at exactly `depth`, or null. */
function lastAtDepth(rows: readonly TreeRow[], gap: number, depth: number): string | null {
  for (let i = gap - 1; i >= 0; i--) {
    if (rows[i].depth < depth) return null;
    if (rows[i].depth === depth) return rows[i].clip.id;
  }
  return null;
}

/**
 * Moves `id` and its subtree under `parentId`, right after `afterId` among
 * that parent's children (first when null). Returns the re-flattened list.
 * Dropping into its own subtree is refused.
 */
export function moveSubtree(clips: Clip[], id: string, parentId: string | null, afterId: string | null): Clip[] {
  const active = clips.find((c) => c.id === id);
  if (!active || parentId === id || (parentId !== null && subtreeIds(clips, id).has(parentId))) return clips;
  const moved = { ...active, parentId };
  const map = childrenByParent(clips.map((c) => (c.id === id ? moved : c)));
  const siblings = (map.get(parentId) ?? []).filter((c) => c.id !== id);
  const at = afterId === null ? 0 : siblings.findIndex((c) => c.id === afterId) + 1;
  map.set(parentId, [...siblings.slice(0, at), moved, ...siblings.slice(at)]);
  return flatten(map, null, new Set());
}

/** Swaps `id` with its previous (-1) or next (+1) sibling. */
export function moveAmongSiblings(clips: Clip[], id: string, direction: -1 | 1): Clip[] {
  const clip = clips.find((c) => c.id === id);
  if (!clip) return clips;
  const map = childrenByParent(clips);
  const key = clip.parentId && map.has(clip.parentId) ? clip.parentId : null;
  const siblings = map.get(key) ?? [];
  const i = siblings.findIndex((c) => c.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= siblings.length) return clips;
  const after = direction === 1 ? siblings[j].id : j === 0 ? null : siblings[j - 1].id;
  return moveSubtree(clips, id, key, after);
}
