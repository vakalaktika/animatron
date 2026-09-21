"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { treeRows, type DropTarget } from "../lib/tree";
import { ClipActionSheet } from "./ClipActionSheet";
import { MoreIcon } from "./icons";
import { DragHandle, MoveButtons } from "./reorderChrome";
import { TREE_INDENT, useTreeDrag } from "./useTreeDrag";

interface Props {
  doc: StudioDoc;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleEnabled: (clip: Clip, enabled: boolean) => void;
  onSolo: (id: string) => void;
  onDuplicate: (clip: Clip) => void;
  onDelete: (id: string) => void;
  /** Drop a dragged row (and its subtree) at a resolved target. */
  onDrop: (id: string, target: DropTarget) => void;
  /** Keyboard path: swap with the previous / next sibling. */
  onMoveSibling: (id: string, direction: -1 | 1) => void;
}

// How long the landed row stays tinted after a drop, matching --drag-settle-dur.
const LANDED_MS = 400;

/**
 * The clip list as a layer tree: children indented under their parent,
 * collapsible, and draggable into or out of any parent. Row order is paint
 * order (later rows paint on top).
 *
 * While a row is held it slides sideways into the column it will land in,
 * the parent it is about to join gets a soft ring, and the insertion line
 * glides between slots. On release the landed row tints briefly and fades.
 */
export function ClipTree({
  doc,
  selectedId,
  onSelect,
  onToggleEnabled,
  onSolo,
  onDuplicate,
  onDelete,
  onDrop,
  onMoveSibling,
}: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [landedId, setLandedId] = useState<string | null>(null);
  // Phones: the clip whose row actions are open in the action sheet.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const rows = treeRows(doc.clips, collapsed);
  const drag = useTreeDrag(rows, doc.clips, (id, target) => {
    onDrop(id, target);
    setLandedId(id);
  });
  const { activeId, carried, offsetY, shiftDepth, target, indicator } = drag.state;
  const dragging = activeId !== null;

  useEffect(() => {
    if (!landedId) return;
    const timer = window.setTimeout(() => setLandedId(null), LANDED_MS);
    return () => window.clearTimeout(timer);
  }, [landedId]);

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div ref={(el) => drag.attachContainer(el)} className="relative">
      <ul className="flex flex-col">
        {rows.map(({ clip, depth, hasChildren }) => {
          const held = activeId === clip.id;
          const riding = carried.has(clip.id);
          const moving = held || riding;
          const receiving = dragging && target?.parentId === clip.id;
          const rowClass = [
            "t-drag-row",
            held && "is-dragging",
            riding && "t-drag-follow",
            receiving && "t-drop-parent",
            landedId === clip.id && "t-drop-landed",
          ]
            .filter(Boolean)
            .join(" ");
          const style = { "--drag-y": `${moving ? offsetY : 0}px` } as CSSProperties;
          // The indent grows or shrinks toward the landing column while held, so
          // the checkbox and name step sideways together and nothing overlaps.
          const indent = (depth + (moving ? shiftDepth : 0)) * TREE_INDENT;
          return (
            <li
              key={clip.id}
              data-tree-row
              className={`group flex items-center gap-2 rounded-sm px-2 py-3 text-sm ${selectedId === clip.id ? "bg-primary-soft" : "hover:bg-surface-sunken"} ${rowClass}`}
              style={style}
            >
              <DragHandle label={`Drag to move ${clip.name}`} index={0} data-tree-id={clip.id} {...drag.handleProps} />
              <span data-tree-indent aria-hidden="true" className="t-drag-shift flex shrink-0" style={{ paddingLeft: Math.max(0, indent) }}>
                {hasChildren ? (
                  <button
                    type="button"
                    className="h-4 w-4 text-[9px] text-background-cta-50 hover:text-background-cta"
                    aria-label={`${collapsed.has(clip.id) ? "Expand" : "Collapse"} ${clip.name}`}
                    aria-expanded={!collapsed.has(clip.id)}
                    onClick={() => toggleCollapsed(clip.id)}
                  >
                    <span className={`inline-block transition-transform ${collapsed.has(clip.id) ? "" : "rotate-90"}`}>▶</span>
                  </button>
                ) : (
                  <span className="inline-block h-4 w-4" />
                )}
              </span>
              <input
                type="checkbox"
                aria-label={`Show ${clip.name}`}
                checked={clip.enabled}
                onChange={(e) => onToggleEnabled(clip, e.target.checked)}
              />
              <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(clip.id)}>
                {clip.name} <span className="text-[13px] text-ink-muted">{clip.type}</span>
              </button>
              <span className="hidden items-center gap-2 lg:flex">
                <button type="button" className="text-[13px] text-ink-muted hover:text-ink pointer-coarse:min-h-11 pointer-coarse:px-1" aria-label={`Solo ${clip.name}`} onClick={() => onSolo(clip.id)}>
                  solo
                </button>
                <button type="button" className="text-[13px] text-ink-muted hover:text-ink pointer-coarse:min-h-11 pointer-coarse:px-1" aria-label={`Duplicate ${clip.name}`} onClick={() => onDuplicate(clip)}>
                  dup
                </button>
                <button type="button" className="text-[13px] text-error hover:text-accent-hover pointer-coarse:min-h-11 pointer-coarse:px-1" aria-label={`Delete ${clip.name}`} onClick={() => onDelete(clip.id)}>
                  del
                </button>
              </span>
              <button
                type="button"
                className="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-sunken lg:hidden"
                aria-label={`${clip.name} actions`}
                aria-haspopup="dialog"
                onClick={() => setSheetId(clip.id)}
              >
                <MoreIcon />
              </button>
              <MoveButtons
                className="hidden lg:flex"
                label={clip.name}
                canUp
                canDown
                onUp={() => onMoveSibling(clip.id, -1)}
                onDown={() => onMoveSibling(clip.id, 1)}
              />
            </li>
          );
        })}
      </ul>
      {dragging && (
        <div
          aria-hidden="true"
          className={`t-drop-line pointer-events-none absolute left-0 top-0 ${indicator ? "is-visible" : ""}`}
          style={{
            width: `calc(100% - ${28 + (indicator?.depth ?? 0) * TREE_INDENT + 4}px)`,
            transform: `translate(${28 + (indicator?.depth ?? 0) * TREE_INDENT}px, ${indicator?.y ?? 0}px)`,
          }}
        />
      )}
      <ClipActionSheet
        clip={doc.clips.find((c) => c.id === sheetId) ?? null}
        onClose={() => setSheetId(null)}
        onSolo={onSolo}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onMoveSibling={onMoveSibling}
      />
    </div>
  );
}
