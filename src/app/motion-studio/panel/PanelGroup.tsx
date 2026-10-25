"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronIcon } from "./icons";

export interface PanelSection {
  id: string;
  title: string;
  content: ReactNode;
  /** Start folded: tuning few people reach for (wings, landing, point lists). */
  defaultCollapsed?: boolean;
}

interface Props {
  /** localStorage key; each group remembers which sections are folded. */
  storageKey: string;
  sections: PanelSection[];
}

const PREFIX = "motion-studio.panels.";

interface Folded {
  /** Sections the user folded themselves. */
  closed: string[];
  /** Sections that start folded but the user opened. */
  opened: string[];
}

function readFolded(key: string): Folded {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return { closed: [], opened: [] };
    const parsed = JSON.parse(raw) as Partial<Folded> & { collapsed?: unknown };
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
    // Earlier builds stored only `collapsed`; carry it over as `closed`.
    return { closed: strings(parsed.closed ?? parsed.collapsed), opened: strings(parsed.opened) };
  } catch {
    return { closed: [], opened: [] };
  }
}

function writeFolded(key: string, folded: Folded) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(folded));
  } catch {
    // Storage full or unavailable: the layout just doesn't persist this time.
  }
}

/**
 * A stack of collapsible sections. Which ones are folded is remembered per
 * storageKey and keyed by section id, so folding "Landing" on one sprite
 * folds it on every sprite. Sections are in a fixed, considered order:
 * what a person reaches for first is first.
 */
export function PanelGroup({ storageKey, sections }: Props) {
  // Start from the default layout so the server and client render the same
  // tree, then adopt the saved layout after mount.
  const [folded, setFolded] = useState<Folded>({ closed: [], opened: [] });

  useEffect(() => {
    setFolded(readFolded(storageKey));
  }, [storageKey]);

  const isOpen = (s: PanelSection) => (s.defaultCollapsed ? folded.opened.includes(s.id) : !folded.closed.includes(s.id));
  const toggle = (s: PanelSection) => {
    const list = s.defaultCollapsed ? "opened" : "closed";
    const has = folded[list].includes(s.id);
    const next = { ...folded, [list]: has ? folded[list].filter((id) => id !== s.id) : [...folded[list], s.id] };
    setFolded(next);
    writeFolded(storageKey, next);
  };

  return (
    <div className="flex flex-col">
      {sections.map((section) => {
        const open = isOpen(section);
        return (
          <section key={section.id} className="border-t border-hairline py-3 first:border-t-0 first:pt-0">
            <h3 className="m-0">
              <button
                type="button"
                className="-mx-2 flex min-h-9 w-[calc(100%+1rem)] items-center gap-1.5 rounded-md px-2 text-left hover:bg-surface-sunken"
                aria-expanded={open}
                onClick={() => toggle(section)}
              >
                <ChevronIcon width={14} height={14} className={`atm-chevron shrink-0 text-ink-muted ${open ? "is-open" : ""}`} />
                <span className="atm-section-label truncate text-ink-secondary">{section.title}</span>
              </button>
            </h3>
            {open && <div className="flex flex-col gap-4 pt-3">{section.content}</div>}
          </section>
        );
      })}
    </div>
  );
}
