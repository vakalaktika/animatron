"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { MotionGraphNode, MotionGraphPort } from "../lib/motionGraph";

export type PortSelection = { nodeId: string; portId: string };
export type MotionCardNode = Node<{
  node: MotionGraphNode;
  active: boolean;
  pending: PortSelection | null;
  onPort: (nodeId: string, portId: string) => void;
  compatible: (nodeId: string, portId: string) => boolean;
}, "motion">;

const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const role: Record<string, string> = { object: "Artwork", controller: "Target", block: "Motion", constraint: "Relationship", bone: "Joint", socket: "Socket" };

/** Port buttons also provide a complete tap/keyboard alternative to wiring by drag. */
export const MotionNodeCard = memo(function MotionNodeCard({ data, selected }: NodeProps<MotionCardNode>) {
  const { node, pending } = data;
  const port = (p: MotionGraphPort) => {
    const input = p.direction === "input", chosen = pending?.nodeId === node.id && pending.portId === p.id;
    const compatible = pending && !chosen && data.compatible(node.id, p.id);
    return <div key={p.id} className={`relative flex items-center ${input ? "justify-start" : "justify-end"}`}>
      <Handle id={p.id} type={input ? "target" : "source"} position={input ? Position.Left : Position.Right}
        aria-label={`${node.label}: ${title(p.label)} drag connector`}
        style={{ width: 12, height: 12, borderRadius: p.kind === "frame" ? 2 : "50%", background: chosen || compatible ? "var(--primary)" : "var(--info)", border: "2px solid var(--surface-raised)" }} />
      <button type="button" className={`nodrag nopan min-h-7 rounded px-2 text-[11px] pointer-coarse:min-h-10 ${chosen || compatible ? "bg-primary-soft text-ink" : "text-ink-secondary hover:bg-surface-sunken"}`}
        aria-label={`${node.label}: ${title(p.label)}`} aria-pressed={chosen}
        onClick={event => { event.stopPropagation(); data.onPort(node.id, p.id); }}>
        {input ? "← " : ""}{title(p.label)}{input ? "" : " →"}
      </button>
    </div>;
  };
  return <article data-motion-node={node.id} className={`w-[196px] rounded-md border bg-surface-raised shadow-sm ${selected ? "border-primary ring-2 ring-primary/20" : "border-border-control"}`}>
    <header className="border-b border-hairline px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-wide text-ink-muted"><span>{role[node.kind]}</span><span>{node.provenance === "rig" ? "From rig" : node.provenance === "override" ? "Scene override" : "Scene"}</span></div>
      <div className="mt-1 truncate text-xs font-semibold text-ink" title={node.label}>{node.label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-muted"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${!node.enabled ? "bg-border-control" : data.active ? "bg-primary" : "bg-info"}`} />{!node.enabled ? "Disabled" : data.active ? "Active at playhead" : "Outside active interval"}</div>
    </header>
    <div className="flex flex-col gap-1 py-2">{node.ports.map(port)}</div>
  </article>;
});
