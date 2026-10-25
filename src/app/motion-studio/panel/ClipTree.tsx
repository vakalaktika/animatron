"use client";

import { useEffect, useState, type ComponentType, type CSSProperties, type SVGProps } from "react";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { treeRows, type DropTarget } from "../lib/tree";
import { ClipActionSheet } from "./ClipActionSheet";
import { CanvasIcon, ChevronIcon, DuplicateIcon, EyeIcon, EyeOffIcon, FileIcon, GripIcon, MoreIcon, RingsIcon, SpriteIcon, SquiggleIcon, TextIcon, TrashIcon, WingIcon } from "./icons";
import { TREE_INDENT, useTreeDrag } from "./useTreeDrag";

interface Props {
  doc: StudioDoc;
  selectedId: string | null;
  /** `additive` (shift held) adds the layer to the selection instead of replacing it. */
  onSelect: (id: string, additive?: boolean) => void;
  /** Layers selected alongside the main one. */
  extraIds?: ReadonlySet<string>;
  /** The pinned Canvas row: shows the canvas settings. */
  onSelectCanvas: () => void;
  onRename: (clip: Clip, name: string) => void;
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

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** The glyph that says what kind of thing a layer is. */
export function clipIcon(clip: Clip): IconComponent {
  switch (clip.type) {
    case "text":
      return TextIcon;
    case "ribbon":
      return SquiggleIcon;
    case "logo":
      return RingsIcon;
    case "lottie":
      return FileIcon;
    case "sprite":
      return clip.source.kind === "chippy" ? WingIcon : SpriteIcon;
  }
}

export function clipKind(clip: Clip): string {
  switch (clip.type) {
    case "text":
      return clip.container.shape === "none" ? "text" : "speech bubble";
    case "ribbon":
      return "ribbon";
    case "logo":
      return "logo";
    case "lottie":
      return "animation";
    case "sprite":
      return clip.source.kind === "chippy" ? "character" : clip.source.kind === "svg" ? "artwork" : "picture";
  }
}

const ROW_ACTION =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink pointer-coarse:h-11 pointer-coarse:w-11";

/**
 * The layers: the canvas pinned on top, then every clip as a tree, children
 * indented under what they follow, collapsible, and draggable into or out
 * of any parent. Row order is paint order (later rows paint on top).
 *
 * While a row is held it slides sideways into the column it will land in,
 * the parent it is about to join gets a soft ring, and the insertion line
 * glides between slots. On release the landed row tints briefly and fades.
 */
export function ClipTree({
  doc,
  selectedId,
  extraIds,
  onSelect,
  onSelectCanvas,
  onRename,
  onToggleEnabled,
  onSolo,
  onDuplicate,
  onDelete,
  onDrop,
  onMoveSibling,
}: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [landedId, setLandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
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

  const canvasSelected = selectedId === null;

  return (
    <div ref={(el) => drag.attachContainer(el)} className="relative">
      <ul className="flex flex-col gap-px" aria-label="Layers">
        <li>
          <button
            type="button"
            aria-current={canvasSelected ? "true" : undefined}
            onClick={onSelectCanvas}
            className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors duration-150 ${
              canvasSelected ? "bg-primary-soft text-ink" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink"
            }`}
          >
            <span className="inline-block w-4" aria-hidden="true" />
            <CanvasIcon width={18} height={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">Canvas</span>
            <span className="shrink-0 font-sans text-[11px] tabular-nums text-ink-secondary">
              {doc.stage.width}×{doc.stage.height}
            </span>
          </button>
        </li>
        {rows.map(({ clip, depth, hasChildren }) => {
          const held = activeId === clip.id;
          const riding = carried.has(clip.id);
          const moving = held || riding;
          const receiving = dragging && target?.parentId === clip.id;
          const selected = selectedId === clip.id;
          const extra = !selected && !!extraIds?.has(clip.id);
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
          // the icon and name step sideways together and nothing overlaps.
          const indent = (depth + (moving ? shiftDepth : 0)) * TREE_INDENT;
          const Glyph = clipIcon(clip);
          const renaming = renamingId === clip.id;
          return (
            <li
              key={clip.id}
              data-tree-row
              className={`group flex min-h-10 items-center gap-1 rounded-md pr-1 text-sm transition-colors duration-150 ${
                selected ? "bg-primary-soft" : extra ? "bg-primary-soft/50" : "hover:bg-surface-sunken"
              } ${clip.enabled ? "" : "text-ink-muted"} ${rowClass}`}
              style={style}
            >
              <span
                role="presentation"
                title={`Drag to move ${clip.name}`}
                data-tree-id={clip.id}
                className="flex h-10 w-5 shrink-0 cursor-grab touch-none select-none items-center justify-center text-ink-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 active:cursor-grabbing pointer-coarse:opacity-100"
                {...drag.handleProps}
              >
                <GripIcon width={14} height={14} />
              </span>
              <span data-tree-indent className="t-drag-shift flex shrink-0" style={{ paddingLeft: Math.max(0, indent) }}>
                {hasChildren ? (
                  <button
                    type="button"
                    className="flex h-5 w-4 items-center justify-center text-ink-muted hover:text-ink"
                    aria-label={`${collapsed.has(clip.id) ? "Expand" : "Collapse"} ${clip.name}`}
                    aria-expanded={!collapsed.has(clip.id)}
                    onClick={() => toggleCollapsed(clip.id)}
                  >
                    <ChevronIcon width={12} height={12} className={`atm-chevron ${collapsed.has(clip.id) ? "" : "is-open"}`} />
                  </button>
                ) : (
                  <span className="inline-block h-5 w-4" />
                )}
              </span>
              <Glyph width={18} height={18} className={`shrink-0 ${selected ? "text-primary" : "text-ink-muted"}`} />
              {renaming ? (
                <input
                  autoFocus
                  aria-label={`Rename ${clip.name}`}
                  className="min-w-0 flex-1 rounded-sm border border-primary bg-surface-raised px-1 py-0.5 text-sm focus:outline-none"
                  defaultValue={clip.name}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    const name = e.currentTarget.value.trim();
                    if (name && name !== clip.name) onRename(clip, name);
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = clip.name;
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate py-2 text-left"
                  aria-current={selected ? "true" : undefined}
                  title={`${clip.name} · ${clipKind(clip)}. Double-click to rename.`}
                  onClick={(e) => onSelect(clip.id, e.shiftKey)}
                  onDoubleClick={() => setRenamingId(clip.id)}
                >
                  {clip.name}
                </button>
              )}
              <button
                type="button"
                className={`${ROW_ACTION} ${clip.enabled ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100" : ""}`}
                aria-label={clip.enabled ? `Hide ${clip.name}` : `Show ${clip.name}`}
                aria-pressed={!clip.enabled}
                onClick={() => onToggleEnabled(clip, !clip.enabled)}
              >
                {clip.enabled ? <EyeIcon width={16} height={16} /> : <EyeOffIcon width={16} height={16} />}
              </button>
              <span className="hidden items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 lg:flex">
                <button type="button" className={ROW_ACTION} aria-label={`Duplicate ${clip.name}`} onClick={() => onDuplicate(clip)}>
                  <DuplicateIcon width={16} height={16} />
                </button>
                <button type="button" className={`${ROW_ACTION} hover:text-error`} aria-label={`Delete ${clip.name}`} onClick={() => onDelete(clip.id)}>
                  <TrashIcon width={16} height={16} />
                </button>
              </span>
              <button
                type="button"
                className={`${ROW_ACTION} lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100`}
                aria-label={`More actions for ${clip.name}`}
                aria-haspopup="dialog"
                onClick={() => setSheetId(clip.id)}
              >
                <MoreIcon width={16} height={16} />
              </button>
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
        onRename={(clip) => setRenamingId(clip.id)}
        onSolo={onSolo}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onMoveSibling={onMoveSibling}
      />
    </div>
  );
}
