"use client";

import type { ReactNode } from "react";
import { CloseIcon, LayersIcon, SlidersIcon, TimelineIcon } from "../panel/icons";
import type { MobileTab } from "../panel/MobileTabs";
import { IconButton } from "./IconButton";
import type { StudioSlots } from "./types";

interface Props extends StudioSlots {
  /** The open drawer, or null for the full-screen stage. */
  drawer: MobileTab | null;
  onDrawer: (drawer: MobileTab | null) => void;
}

const drawerId = (id: MobileTab) => `studio-drawer-${id}`;

const SIDE: Record<MobileTab, { title: string; className: string }> = {
  clips: { title: "Clips", className: "atm-drawer-left w-[min(340px,44vw)] border-r" },
  edit: { title: "Edit", className: "atm-drawer-right w-[min(340px,44vw)] border-l" },
  timeline: { title: "Timeline", className: "atm-drawer-up h-[48dvh] border-t" },
};

function Drawer({ id, onClose, children }: { id: MobileTab; onClose: () => void; children: ReactNode }) {
  const { title, className } = SIDE[id];
  return (
    <section
      id={drawerId(id)}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={`flex min-h-0 shrink-0 flex-col border-border-strong bg-surface-raised ${className}`}
    >
      <div className="flex items-center justify-between border-b border-hairline py-1 pr-1 pl-4">
        <h2 className="atm-section-label text-ink">{title}</h2>
        <IconButton label={`Close ${title.toLowerCase()}`} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

/**
 * Phone landscape: the stage gets the whole screen and one control bar runs
 * along the bottom. Clips slides in from the left, Edit from the right, and
 * the Timeline rises from the bottom; the stage refits beside whichever is
 * open so you can watch the edit land. One drawer at a time.
 */
export function LandscapeShell({ stage, playback, tracks, clips, edit, drawer, onDrawer }: Props) {
  const toggle = (id: MobileTab) => onDrawer(drawer === id ? null : id);
  const close = () => onDrawer(null);
  const drawerButton = (id: MobileTab, icon: ReactNode) => (
    <IconButton
      label={drawer === id ? `Close ${SIDE[id].title.toLowerCase()}` : SIDE[id].title}
      pressed={drawer === id}
      aria-expanded={drawer === id}
      aria-controls={drawerId(id)}
      onClick={() => toggle(id)}
    >
      {icon}
    </IconButton>
  );

  return (
    <div className="flex h-dvh flex-col bg-surface pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-body text-ink">
      <h1 className="sr-only">Animatron</h1>
      <div className="flex min-h-0 flex-1">
        {drawer === "clips" && (
          <Drawer id="clips" onClose={close}>
            <div className="px-4 py-3">
              <p className="atm-help mb-1">Lower rows paint on top. Drag a grip right to nest a clip.</p>
              {clips}
            </div>
          </Drawer>
        )}
        <div className="min-h-0 min-w-0 flex-1">{stage}</div>
        {drawer === "edit" && (
          <Drawer id="edit" onClose={close}>
            <div className="p-4">{edit}</div>
          </Drawer>
        )}
      </div>
      {drawer === "timeline" && (
        <Drawer id="timeline" onClose={close}>
          {tracks}
        </Drawer>
      )}
      <nav
        aria-label="Studio"
        className="flex items-center gap-1 border-t border-border-strong bg-surface-raised px-1 pb-[env(safe-area-inset-bottom)]"
      >
        {drawerButton("clips", <LayersIcon />)}
        <div className="min-w-0 flex-1">{playback}</div>
        {drawerButton("timeline", <TimelineIcon />)}
        {drawerButton("edit", <SlidersIcon />)}
      </nav>
    </div>
  );
}
