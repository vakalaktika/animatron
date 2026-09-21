/** Pure list-ordering helpers shared by the clip list, timeline, and panels. */

/** Move the item at `from` so it lands at index `to`. Returns a new array. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const clampedTo = Math.max(0, Math.min(list.length - 1, to));
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(clampedTo, 0, item);
  return next;
}

/**
 * Sort `ids` by a saved order. Ids missing from the saved order keep their
 * relative position and follow the known ones; saved ids that no longer exist
 * are ignored.
 */
export function applySavedOrder(ids: readonly string[], savedOrder: readonly string[]): string[] {
  const known = savedOrder.filter((id) => ids.includes(id));
  const unknown = ids.filter((id) => !savedOrder.includes(id));
  return [...known, ...unknown];
}

/**
 * Fold a newly arranged subset back into a saved global order. Saved ids
 * that are not in `visible` keep their slots; the visible ids take the
 * remaining slots in their new order; visible ids the saved order has never
 * seen are appended. Lets one ranking serve every panel that shares
 * sections, so "Reveal on top" holds across clip types.
 */
export function mergeOrder(saved: readonly string[], visible: readonly string[]): string[] {
  const visibleSet = new Set(visible);
  const queue = [...visible];
  const merged = saved.map((id) => (visibleSet.has(id) ? (queue.shift() ?? id) : id));
  return [...merged, ...queue];
}

/**
 * Vertical slot pitch of each row (its height plus the list gap) from the
 * rows' static rects. Rows may be any height, so each carries its own pitch;
 * the last row borrows the gap measured between its neighbours.
 */
export function rowPitches(rects: readonly { top: number; bottom: number }[]): number[] {
  const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
  return rects.map((r, i) => (i < rects.length - 1 ? rects[i + 1].top - r.top : r.bottom - r.top + gap));
}

/**
 * How far row `from` travels to land in slot `to`: the summed pitches of the
 * rows it passes over, negative when moving up.
 */
export function slotTravel(pitches: readonly number[], from: number, to: number): number {
  if (to > from) return pitches.slice(from + 1, to + 1).reduce((sum, p) => sum + p, 0);
  if (to < from) return -pitches.slice(to, from).reduce((sum, p) => sum + p, 0);
  return 0;
}

/**
 * Which slot a pointer at `clientY` would drop into, given the row rects in
 * order. The pointer picks the row whose vertical center is nearest.
 */
export function dropIndexFromY(rowTops: readonly { top: number; bottom: number }[], clientY: number): number {
  if (rowTops.length === 0) return 0;
  let best = 0;
  let bestDist = Infinity;
  rowTops.forEach((r, i) => {
    const dist = Math.abs((r.top + r.bottom) / 2 - clientY);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}
