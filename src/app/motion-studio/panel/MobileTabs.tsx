"use client";

import { useRef, type ComponentType, type KeyboardEvent, type SVGProps } from "react";
import { LayersIcon, SlidersIcon, TimelineIcon } from "./icons";

export type MobileTab = "timeline" | "clips" | "edit";

const TABS: { id: MobileTab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "timeline", label: "Timeline", Icon: TimelineIcon },
  { id: "clips", label: "Clips", Icon: LayersIcon },
  { id: "edit", label: "Edit", Icon: SlidersIcon },
];

export const tabId = (tab: MobileTab) => `studio-tab-${tab}`;
export const panelId = (tab: MobileTab) => `studio-panel-${tab}`;

/**
 * The phone app's bottom tab bar: switches the area under the stage between
 * the timeline, clip list and settings, in thumb reach and clear of the home
 * indicator. Only rendered below lg, where the three can't sit side by side.
 * Arrow keys move between tabs (roving tabindex), per the WAI-ARIA tabs pattern.
 */
export function MobileTabs({ active, onChange }: { active: MobileTab; onChange: (tab: MobileTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <nav aria-label="Studio" className="border-t border-border-strong bg-surface-raised pb-[env(safe-area-inset-bottom)]">
      <div role="tablist" aria-label="Studio panels" className="flex">
        {TABS.map(({ id, label, Icon }, i) => {
          const selected = id === active;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(id)}
              aria-selected={selected}
              aria-controls={panelId(id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`group flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 transition-colors duration-200 ${
                selected ? "text-primary" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span
                className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                  selected ? "bg-primary-soft" : "group-hover:bg-surface-sunken"
                }`}
              >
                <Icon width={20} height={20} />
              </span>
              <span className={`font-sans text-[11px] font-semibold tracking-[0.06em] uppercase ${selected ? "text-ink" : ""}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
