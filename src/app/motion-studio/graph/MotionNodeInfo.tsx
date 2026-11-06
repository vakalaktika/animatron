"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MotionGraphNode } from "../lib/motionGraph";

/** Supporting facts stay readable at any graph zoom, including inside the mobile dialog. */
export function MotionNodeInfo({ node, active }: { node: MotionGraphNode; active: boolean }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [placement, setPlacement] = useState<{ x: number; y: number; host: HTMLElement } | null>(null);
  const pinned = useRef(false);
  const cancelClose = () => clearTimeout(timer.current);
  const close = () => { cancelClose(); pinned.current = false; setPlacement(null); };
  const show = () => {
    cancelClose();
    const button = trigger.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setPlacement({ x: Math.max(8, Math.min(rect.right - 256, window.innerWidth - 264)), y: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 200)), host: button.closest("dialog") ?? document.body });
  };
  const leave = () => { if (!pinned.current) timer.current = setTimeout(close, 150); };
  useEffect(() => {
    if (!placement) return;
    const dismiss = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as globalThis.Node) && !panel.current?.contains(event.target as globalThis.Node)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } };
    // Close rather than leave an overlay behind when the user moves the graph or page.
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    window.addEventListener("wheel", close, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("wheel", close);
      cancelClose();
    };
  }, [placement]);
  useEffect(() => () => cancelClose(), []);
  const source = node.provenance === "rig" ? "From reusable rig" : node.provenance === "override" ? "Scene override of rig" : "Defined in this scene";
  return <>
    <button ref={trigger} type="button" aria-label={`About ${node.label}`} aria-describedby={placement ? id : undefined}
      className="nodrag nopan flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-secondary hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:h-11 pointer-coarse:w-11"
      onMouseEnter={show} onMouseLeave={leave} onFocus={show} onBlur={() => { if (!pinned.current) close(); }}
      onClick={event => { event.stopPropagation(); if (pinned.current) close(); else { pinned.current = true; show(); } }}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5M10 5.5v1" /></svg>
    </button>
    {placement && createPortal(<div ref={panel} id={id} role="tooltip" data-motion-graph
      onMouseEnter={cancelClose} onMouseLeave={leave}
      className="nodrag nopan fixed z-[100] w-64 rounded-md bg-surface-raised p-3 text-xs text-ink shadow-lg"
      style={{ left: placement.x, top: placement.y }}>
      <p className="break-words font-semibold leading-5">{node.label}</p>
      <dl className="mt-2 space-y-2 leading-4">
        <div><dt className="text-ink-secondary">Object</dt><dd className="break-words">{node.ownerName}</dd></div>
        <div><dt className="text-ink-secondary">Source</dt><dd>{source}</dd></div>
        <div><dt className="text-ink-secondary">Status</dt><dd>{!node.enabled ? "Disabled" : active ? "Active at playhead" : "Outside active interval"}</dd></div>
      </dl>
    </div>, placement.host)}
  </>;
}
