"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotionValueEvent, type MotionValue } from "motion/react";
import { ReactFlow, Background, Controls, applyNodeChanges, type Connection, type Edge, type NodeChange, type ReactFlowInstance } from "@xyflow/react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { buildMotionGraph, connectMotionGraph, editMotionGraph, type MotionGraphConnection } from "../lib/motionGraph";
import { MotionNodeCard, type MotionCardNode, type PortSelection } from "./MotionNodeCard";
import { MotionNodeInspector, nodeActive } from "./MotionNodeInspector";
import { MotionRecipePalette } from "./MotionRecipePalette";
import { MotionGraphTimeline } from "./MotionGraphTimeline";

export interface MotionGraphWorkspaceProps {
  doc: StudioDoc;
  time: MotionValue<number>;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onChange: (doc: StudioDoc) => void;
  onClose: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}
const nodeTypes = { motion: MotionNodeCard };
type Position = { x: number; y: number };
type Layout = { version: 1; positions: Record<string, Position>; viewport?: { x: number; y: number; zoom: number } };

/** A typed editing surface over the canonical program. No second playback graph is stored. */
export function MotionGraphWorkspace({ doc, time, selectedClipId, onSelectClip, onChange, onClose, onUndo, onRedo }: MotionGraphWorkspaceProps) {
  const [now, setNow] = useState(time.get()), [query, setQuery] = useState(""), [scope, setScope] = useState("selected");
  const [selected, setSelected] = useState<string[]>([]), [pending, setPending] = useState<PortSelection | null>(null);
  const [message, setMessage] = useState(""), [expanded, setExpanded] = useState(false), [draft, setDraft] = useState<Record<string, Position>>({});
  const flow = useRef<ReactFlowInstance<MotionCardNode, Edge> | null>(null);
  useMotionValueEvent(time, "change", setNow);
  const graph = useMemo(() => buildMotionGraph(doc), [doc]);
  const layout = doc.editor?.motionGraph;
  useEffect(() => { setDraft({}); }, [layout]);
  const connection = useCallback((a: PortSelection, b: PortSelection): MotionGraphConnection | null => {
    const first = graph.nodes.find(n => n.id === a.nodeId)?.ports.find(p => p.id === a.portId);
    const second = graph.nodes.find(n => n.id === b.nodeId)?.ports.find(p => p.id === b.portId);
    if (!first || !second || first.direction === second.direction) return null;
    const source = first.direction === "output" ? a : b, target = first.direction === "input" ? a : b;
    return { source: source.nodeId, sourceHandle: source.portId, target: target.nodeId, targetHandle: target.portId };
  }, [graph]);
  const commitConnection = useCallback((wire: MotionGraphConnection) => {
    const result = connectMotionGraph(doc, wire, time.get());
    if (result.error) { setMessage(result.error); return; }
    setPending(null); setMessage("Connected. The timeline and canvas use this relationship."); onChange(result.doc);
  }, [doc, onChange, time]);
  const onPort = useCallback((nodeId: string, portId: string) => {
    const next = { nodeId, portId };
    if (!pending) { setPending(next); setMessage("Choose a matching port to connect. Escape cancels."); return; }
    if (pending.nodeId === nodeId && pending.portId === portId) { setPending(null); setMessage("Connection cancelled."); return; }
    const wire = connection(pending, next);
    if (!wire) { setMessage("Choose an output and an input with compatible roles."); return; }
    commitConnection(wire);
  }, [pending, connection, commitConnection]);
  const compatible = useCallback((nodeId: string, portId: string) => {
    if (!pending) return false;
    const wire = connection(pending, { nodeId, portId });
    return !!wire && !connectMotionGraph(doc, wire, time.get()).error;
  }, [pending, connection, doc, time]);
  const visible = useMemo(() => {
    const direct = new Set(graph.nodes.filter(n => scope === "all" || !selectedClipId || n.clipId === selectedClipId).map(n => n.id));
    if (scope !== "all") graph.edges.forEach(e => { if (direct.has(e.source) || direct.has(e.target)) { direct.add(e.source); direct.add(e.target); } });
    return graph.nodes.filter(n => direct.has(n.id) && (!query || `${n.label} ${doc.clips.find(c => c.id === n.clipId)?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())));
  }, [graph, scope, selectedClipId, query, doc.clips]);
  const nodes: MotionCardNode[] = useMemo(() => visible.map((node, i) => ({ id: node.id, type: "motion", selected: selected.includes(node.id), position: draft[node.id] ?? layout?.positions[node.id] ?? { x: (i % 4) * 260, y: Math.floor(i / 4) * 240 }, data: { node, active: nodeActive(doc, node, now), pending, onPort, compatible } })), [visible, selected, draft, layout, doc, now, pending, onPort, compatible]);
  const visibleIds = new Set(nodes.map(n => n.id));
  const edges: Edge[] = graph.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)).map(edge => ({ ...edge, reconnectable: true, animated: false, style: { stroke: edge.enabled === false ? "var(--border-control)" : "var(--info)", strokeWidth: 2, strokeDasharray: edge.enabled === false ? "5 4" : undefined }, labelStyle: { fill: "var(--ink-secondary)", fontSize: 10 }, labelBgStyle: { fill: "var(--surface-raised)" } }));
  const persist = (positions: Record<string, Position>, viewport = layout?.viewport) => {
    const next: Layout = { version: 1, positions: { ...layout?.positions, ...positions }, ...(viewport ? { viewport } : {}) };
    onChange({ ...doc, editor: { ...doc.editor, motionGraph: next } });
  };
  const onNodesChange = (changes: NodeChange<MotionCardNode>[]) => {
    const next = applyNodeChanges(changes, nodes);
    if (changes.some(c => c.type === "select")) setSelected(next.filter(n => n.selected).map(n => n.id));
    const moved = changes.filter(c => c.type === "position");
    if (moved.length) {
      const positions = Object.fromEntries(next.filter(n => moved.some(c => c.id === n.id)).map(n => [n.id, n.position]));
      setDraft(previous => ({ ...previous, ...positions }));
      if (moved.every(c => c.dragging === undefined)) persist(positions);
    }
  };
  const act = (type: "remove" | "duplicate" | "toggle") => {
    let next = doc;
    for (const nodeId of selected) {
      const result = editMotionGraph(next, { type, nodeId }, time.get());
      if (result.error) { setMessage(result.error); return; }
      next = result.doc;
    }
    if (next !== doc) { onChange(next); setMessage(type === "remove" ? "Removed selected nodes." : type === "toggle" ? "Changed enabled state." : "Duplicated selected nodes."); }
  };
  const choose = (nodeId: string) => { setSelected([nodeId]); const node = graph.nodes.find(n => n.id === nodeId); if (node) onSelectClip(node.clipId); };
  const wireFromFlow = (wire: Connection) => { if (wire.sourceHandle && wire.targetHandle) commitConnection(wire as MotionGraphConnection); };
  return <section data-motion-graph aria-label="Motion node editor" className="flex min-h-0 flex-col border-t border-border-strong bg-surface-raised text-ink" onKeyDown={event => {
    const field = event.target instanceof HTMLElement && !!event.target.closest("input,textarea,select");
    if (event.key === "Escape") { event.stopPropagation(); setPending(null); setMessage("Connection cancelled."); }
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.stopPropagation(); if(event.shiftKey) onRedo?.(); else onUndo?.(); }
    else if (!field && (event.key === "Delete" || event.key === "Backspace")) { event.preventDefault(); act("remove"); }
    else if (!field && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); act("duplicate"); }
  }}>
    <header className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
      <h2 className="mr-2 text-sm font-semibold">Motion nodes</h2>
      <input type="search" aria-label="Find nodes" placeholder="Find a node…" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded border border-border-control bg-surface-sunken px-2 py-1.5 text-xs sm:max-w-[180px]" />
      <select aria-label="Graph scope" className="rounded border border-border-control bg-surface-raised px-2 py-1.5 text-xs" value={scope} onChange={e => setScope(e.target.value)}><option value="selected">Selected object + connections</option><option value="all">Whole scene</option></select>
      <Button size="xs" variant="outline" onClick={() => void flow.current?.fitView({ nodes: selected.length ? selected.map(id => ({ id })) : undefined, padding: .2 })}>Fit</Button>
      {onUndo && <Button size="xs" variant="outline" onClick={onUndo}>Undo</Button>}
      {onRedo && <Button size="xs" variant="outline" onClick={onRedo}>Redo</Button>}
      <Button size="xs" variant="outline" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Compact" : "Expand"}</Button>
      <Button size="xs" variant="outline" onClick={onClose}>Close nodes</Button>
    </header>
    <MotionRecipePalette doc={doc} clipId={selectedClipId} time={now} onChange={onChange} onError={setMessage} onSelectNode={choose} />
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-1.5">
      <span className="mr-auto text-[11px] text-ink-muted">{nodes.length} nodes · {selected.length} selected · Shift selects more</span>
      <Button size="xs" variant="outline" disabled={!selected.length} onClick={() => act("duplicate")}>Duplicate nodes</Button>
      <Button size="xs" variant="outline" disabled={!selected.length} onClick={() => act("toggle")}>Enable / disable</Button>
      <Button size="xs" variant="outline" disabled={!selected.length} onClick={() => act("remove")}>Remove nodes</Button>
    </div>
    <div className="flex min-h-0 flex-col sm:flex-row" style={{ height: expanded ? "min(65dvh, 720px)" : 400 }}>
      <div className="relative min-h-[220px] min-w-0 flex-1" data-motion-graph-canvas>
        <ReactFlow<MotionCardNode, Edge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={wireFromFlow} onReconnect={(_, wire) => wireFromFlow(wire)}
          isValidConnection={wire => !!wire.sourceHandle && !!wire.targetHandle && !connectMotionGraph(doc, wire as MotionGraphConnection, time.get()).error}
          onNodeClick={(_, node) => { setSelected(previous => previous.includes(node.id) ? previous : [node.id]); onSelectClip(node.data.node.clipId); }}
          onNodeDragStop={(_, node, dragged) => persist(Object.fromEntries((dragged?.length ? dragged : [node]).map(n => [n.id, n.position])))}
          onMoveEnd={(event, viewport) => { if (event) persist({}, viewport); }} onInit={instance => { flow.current = instance; }}
          defaultViewport={layout?.viewport} fitView={!layout?.viewport} minZoom={.15} maxZoom={2} deleteKeyCode={null} multiSelectionKeyCode="Shift" selectNodesOnDrag={false} snapToGrid snapGrid={[12, 12]}>
          <Background color="var(--border-control)" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {!nodes.length && <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted">{query ? "No matching nodes. Try another name." : "Select an object, then add a target or motion."}</p>}
      </div>
      <div className="max-h-[190px] w-full shrink-0 border-t border-hairline bg-surface-sunken sm:max-h-none sm:w-[228px] sm:border-t-0 sm:border-l"><MotionNodeInspector doc={doc} node={graph.nodes.find(n => n.id === selected.at(-1))} time={now} onChange={onChange} onError={setMessage} /></div>
    </div>
    {selectedClipId && <MotionGraphTimeline doc={doc} clipId={selectedClipId} nodeId={selected.at(-1)} time={time} onChange={onChange} onSelectNode={choose} />}
    <p role="status" aria-live="polite" className="min-h-8 border-t border-hairline px-3 py-2 text-[11px] text-ink-secondary">{message || "Drag between matching ports, or select two port labels to connect. Connections control motion; layers control paint order."}</p>
  </section>;
}
