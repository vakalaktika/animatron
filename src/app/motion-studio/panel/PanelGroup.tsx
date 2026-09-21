"use client";

import { useEffect, useState, type ReactNode } from "react";
import { applySavedOrder, mergeOrder, reorder } from "../lib/order";
import { DragHandle, MoveButtons } from "./reorderChrome";
import { rowMotion, useReorderDrag } from "./useReorderDrag";

export interface PanelSection {
  id: string;
  title: string;
  content: ReactNode;
}

interface Props {
  /** localStorage key; each group remembers its own order and collapsed set. */
  storageKey: string;
  sections: PanelSection[];
}

interface Layout {
  order: string[];
  collapsed: string[];
}

const PREFIX = "motion-studio.panels.";

function readLayout(key: string): Layout {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return { order: [], collapsed: [] };
    const parsed: unknown = JSON.parse(raw);
    const obj = parsed as Partial<Layout>;
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
    return { order: strings(obj.order), collapsed: strings(obj.collapsed) };
  } catch {
    return { order: [], collapsed: [] };
  }
}

function writeLayout(key: string, layout: Layout) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(layout));
  } catch {
    // Storage full or unavailable: the layout just doesn't persist this time.
  }
}

/**
 * A stack of collapsible, reorderable sections. Collapse state and order are
 * remembered per storageKey and keyed by section id, so a preference like
 * "Reveal on top" follows the section onto any clip that has it. Sections
 * not yet in the saved order are appended.
 */
export function PanelGroup({ storageKey, sections }: Props) {
  // Start from the default layout so the server and client render the same
  // tree, then adopt the saved layout after mount.
  const [layout, setLayout] = useState<Layout>({ order: [], collapsed: [] });

  useEffect(() => {
    setLayout(readLayout(storageKey));
  }, [storageKey]);

  const update = (next: Layout) => {
    setLayout(next);
    writeLayout(storageKey, next);
  };

  const orderedIds = applySavedOrder(
    sections.map((s) => s.id),
    layout.order,
  );
  const ordered = orderedIds
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is PanelSection => s !== undefined);

  // Fold the new arrangement into the saved ranking rather than replacing it,
  // so sections that are hidden right now keep their place for later.
  const move = (from: number, to: number) =>
    update({ ...layout, order: mergeOrder(layout.order, reorder(orderedIds, from, to)) });
  const toggle = (id: string) =>
    update({
      ...layout,
      collapsed: layout.collapsed.includes(id)
        ? layout.collapsed.filter((c) => c !== id)
        : [...layout.collapsed, id],
    });

  const drag = useReorderDrag(move);

  return (
    <div ref={(el) => drag.attachContainer(el)} className="space-y-1">
      {ordered.map((section, i) => {
        const open = !layout.collapsed.includes(section.id);
        const motion = rowMotion(i, drag.state);
        return (
          <section
            key={section.id}
            data-reorder-row
            className={`rounded border-b border-background-cta-10 pb-2 ${motion.className}`}
            style={motion.style}
          >
            <div className="group flex items-center gap-1">
              <DragHandle label={`Drag to move ${section.title}`} index={i} {...drag.handleProps} />
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
                aria-expanded={open}
                onClick={() => toggle(section.id)}
              >
                <span aria-hidden="true" className={`inline-block text-[10px] text-background-cta-60 transition-transform ${open ? "rotate-90" : ""}`}>
                  ▶
                </span>
                <span className="eyebrow truncate text-background-cta-70">{section.title}</span>
              </button>
              <MoveButtons
                label={section.title}
                canUp={i > 0}
                canDown={i < ordered.length - 1}
                onUp={() => move(i, i - 1)}
                onDown={() => move(i, i + 1)}
              />
            </div>
            {open && <div className="space-y-2.5 pt-1 pl-1">{section.content}</div>}
          </section>
        );
      })}
    </div>
  );
}
