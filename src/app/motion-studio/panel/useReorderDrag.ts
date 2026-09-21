"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { dropIndexFromY, rowPitches, slotTravel } from "../lib/order";

/*
 * Pointer-driven vertical reordering with the transitions.dev drag feel:
 * the held row rides the pointer, rows in between glide aside to open a gap,
 * and on release the row is parked at the drop point and bounces home.
 * Styling lives in studio-motion.css (.t-drag-row); this hook only produces
 * the state, and `rowMotion` turns it into a className + style per row.
 *
 * Usage: pass `attachContainer` as the list's ref, spread `handleProps` onto
 * each row's drag handle with `data-reorder-index`, put `data-reorder-row`
 * on each row element, and spread `rowMotion(i, state)` onto each row.
 */

interface Settle {
  index: number;
  y: number;
  live: boolean;
}

export interface ReorderDragState {
  dragging: number | null;
  over: number | null;
  offsetY: number;
  /** Each row's slot height (row plus gap), captured on pickup. Rows may differ. */
  pitches: number[];
  settle: Settle | null;
}

const FALLBACK_SETTLE_MS = 400;

function settleDuration(el: HTMLElement | null): number {
  if (!el) return FALLBACK_SETTLE_MS;
  const raw = getComputedStyle(el).getPropertyValue("--drag-settle-dur").trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : raw.endsWith("s") ? parseFloat(raw) * 1000 : NaN;
  return Number.isFinite(ms) ? ms : FALLBACK_SETTLE_MS;
}

export function useReorderDrag(onReorder: (from: number, to: number) => void) {
  const containerRef = useRef<HTMLElement | null>(null);
  const attachContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);
  const [state, setState] = useState<ReorderDragState>({
    dragging: null,
    over: null,
    offsetY: 0,
    pitches: [],
    settle: null,
  });
  // Row rects are captured on pickup, before any row is transformed, so the
  // drop slot is computed against the static layout.
  const session = useRef<{
    from: number;
    to: number;
    startY: number;
    rects: { top: number; bottom: number }[];
    pitches: number[];
  } | null>(null);

  const handleProps = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      const index = Number(e.currentTarget.dataset.reorderIndex);
      const container = containerRef.current;
      if (!Number.isInteger(index) || !container) return;
      e.stopPropagation();
      e.preventDefault();
      const rects = Array.from(container.querySelectorAll<HTMLElement>("[data-reorder-row]")).map((row) => {
        const r = row.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      });
      const pitches = rowPitches(rects);
      session.current = { from: index, to: index, startY: e.clientY, rects, pitches };
      setState({ dragging: index, over: index, offsetY: 0, pitches, settle: null });
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = session.current;
      if (!s) return;
      s.to = dropIndexFromY(s.rects, e.clientY);
      setState((prev) => ({ ...prev, over: s.to, offsetY: e.clientY - s.startY }));
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const s = session.current;
      session.current = null;
      if (!s) return;
      const offsetY = e.clientY - s.startY;
      // Where the row was released, relative to the slot it is about to occupy.
      const residual = offsetY - slotTravel(s.pitches, s.from, s.to);
      setState({
        dragging: null,
        over: null,
        offsetY: 0,
        pitches: s.pitches,
        settle: { index: s.to, y: residual, live: false },
      });
      if (s.from !== s.to) onReorder(s.from, s.to);
    },
    onPointerCancel: () => {
      session.current = null;
      setState((prev) => ({ ...prev, dragging: null, over: null, offsetY: 0 }));
    },
  };

  // Park at the release point for one frame, then let the bounce play out.
  useEffect(() => {
    const settle = state.settle;
    if (!settle) return;
    if (!settle.live) {
      const raf = requestAnimationFrame(() =>
        setState((prev) => (prev.settle ? { ...prev, settle: { ...prev.settle, live: true } } : prev)),
      );
      return () => cancelAnimationFrame(raf);
    }
    const timer = window.setTimeout(
      () => setState((prev) => ({ ...prev, settle: null })),
      settleDuration(containerRef.current),
    );
    return () => window.clearTimeout(timer);
  }, [state.settle]);

  return { attachContainer, state, handleProps };
}

/** className + style for row `i` given the current drag state. */
export function rowMotion(i: number, state: ReorderDragState): { className: string; style: CSSProperties } {
  const { dragging, over, offsetY, pitches, settle } = state;
  if (settle && settle.index === i) {
    return {
      className: `t-drag-row is-settling${settle.live ? " is-live" : ""}`,
      style: { "--drag-y": `${settle.live ? 0 : settle.y}px` } as CSSProperties,
    };
  }
  if (dragging === i) {
    return { className: "t-drag-row is-dragging", style: { "--drag-y": `${offsetY}px` } as CSSProperties };
  }
  // Rows the held row passes over slide aside by the held row's own pitch,
  // whatever their height, so the gap that opens is exactly its size.
  let shift = 0;
  if (dragging !== null && over !== null) {
    const held = pitches[dragging] ?? 0;
    if (dragging < i && i <= over) shift = -held;
    else if (over <= i && i < dragging) shift = held;
  }
  return { className: "t-drag-row", style: { "--drag-y": `${shift}px` } as CSSProperties };
}
