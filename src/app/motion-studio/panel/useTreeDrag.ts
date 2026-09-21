"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { projectDrop, subtreeIds, type DropTarget, type TreeRow } from "../lib/tree";
import type { Clip } from "@/app/components/motion-studio/types";

/*
 * Pointer-driven tree drag in the Figma style: the held row (and its
 * subtree) rides the pointer, and an insertion line shows where it will
 * land. Vertical position picks the gap between rows. Depth comes from how
 * far the pointer has moved sideways since pickup, so a row stays at its
 * own depth until you deliberately pull it right (nest) or left (climb
 * out); a little hysteresis keeps it from flickering at column edges. The
 * result is clamped to what the neighbours allow.
 */

export const TREE_INDENT = 16;
// Fraction of a column the pointer must cross before the depth changes.
const DEPTH_HYSTERESIS = 0.65;

export interface TreeDragState {
  activeId: string | null;
  /** Ids riding along with the active row. */
  carried: ReadonlySet<string>;
  offsetY: number;
  /** Columns the held row has shifted from its own depth: negative climbs out, positive nests. */
  shiftDepth: number;
  target: DropTarget | null;
  /** Insertion line in container coordinates. */
  indicator: { y: number; depth: number } | null;
}

const IDLE: TreeDragState = {
  activeId: null,
  carried: new Set(),
  offsetY: 0,
  shiftDepth: 0,
  target: null,
  indicator: null,
};

interface Session {
  activeId: string;
  startX: number;
  startY: number;
  startDepth: number;
  /** Depth last asked for, so small sideways wobble doesn't flip columns. */
  wantDepth: number;
  /** Visible rows minus the dragged subtree, with their static rects. */
  candidates: { row: TreeRow; top: number; bottom: number }[];
  containerTop: number;
}

export function useTreeDrag(
  rows: TreeRow[],
  clips: Clip[],
  onDrop: (id: string, target: DropTarget) => void,
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const attachContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);
  const [state, setState] = useState<TreeDragState>(IDLE);
  const session = useRef<Session | null>(null);

  const handleProps = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      const activeId = e.currentTarget.dataset.treeId;
      const container = containerRef.current;
      if (!activeId || !container) return;
      e.stopPropagation();
      e.preventDefault();
      const carried = subtreeIds(clips, activeId);
      const rowEls = Array.from(container.querySelectorAll<HTMLElement>("[data-tree-row]"));
      const candidates = rows.flatMap((row, i) => {
        const el = rowEls[i];
        if (!el || row.clip.id === activeId || carried.has(row.clip.id)) return [];
        const r = el.getBoundingClientRect();
        return [{ row, top: r.top, bottom: r.bottom }];
      });
      const box = container.getBoundingClientRect();
      const startDepth = rows.find((r) => r.clip.id === activeId)?.depth ?? 0;
      session.current = {
        activeId,
        startX: e.clientX,
        startY: e.clientY,
        startDepth,
        wantDepth: startDepth,
        candidates,
        containerTop: box.top,
      };
      setState({ activeId, carried, offsetY: 0, shiftDepth: 0, target: null, indicator: null });
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = session.current;
      if (!s) return;
      const gap = s.candidates.filter((c) => (c.top + c.bottom) / 2 < e.clientY).length;
      const raw = s.startDepth + (e.clientX - s.startX) / TREE_INDENT;
      if (Math.abs(raw - s.wantDepth) >= DEPTH_HYSTERESIS) s.wantDepth = Math.round(raw);
      const target = projectDrop(
        s.candidates.map((c) => c.row),
        gap,
        s.wantDepth,
      );
      const edge = gap === 0 ? s.candidates[0]?.top : s.candidates[gap - 1]?.bottom;
      const indicator = target && edge !== undefined ? { y: edge - s.containerTop, depth: target.depth } : null;
      setState((prev) => ({
        ...prev,
        offsetY: e.clientY - s.startY,
        shiftDepth: target ? target.depth - s.startDepth : prev.shiftDepth,
        target,
        indicator,
      }));
    },
    onPointerUp: () => {
      const s = session.current;
      session.current = null;
      setState((prev) => {
        if (s && prev.target) onDrop(s.activeId, prev.target);
        return IDLE;
      });
    },
    onPointerCancel: () => {
      session.current = null;
      setState(IDLE);
    },
  };

  return { attachContainer, state, handleProps };
}
