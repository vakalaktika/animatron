"use client";

import { SIDEBAR, TIMELINE, usePanelLayout } from "../lib/usePanelLayout";
import { AtomMark, BottomPanelIcon, SidePanelIcon } from "../panel/icons";
import { ResizeHandle } from "../panel/ResizeHandle";
import { IconButton } from "./IconButton";
import type { StudioSlots } from "./types";

const SIDEBAR_ID = "studio-sidebar";
const TIMELINE_ID = "studio-timeline";

/**
 * Desktop and tablet-landscape arrangement: stage in the middle, timeline
 * along the bottom, layers and settings down the right. Both panels can be
 * hidden from the app bar and resized by dragging their edge; the choice
 * is remembered.
 */
export function DesktopShell({ title, actions, stage, playback, timeline, clips, edit }: StudioSlots) {
  const { layout, update } = usePanelLayout();
  const { sidebarOpen, timelineOpen, sidebarWidth, timelineHeight } = layout;

  return (
    <div className="flex h-dvh flex-col bg-surface font-body text-ink">
      <header className="flex min-w-0 items-center gap-3 border-b border-border-strong bg-surface-raised py-1 pr-2 pl-4">
        <h1 className="flex shrink-0 items-center gap-2 font-display text-xl font-semibold tracking-[-0.01em]">
          <AtomMark className="text-primary" />
          Animatron
        </h1>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-strong" />
        <div className="min-w-0 flex-1">{title}</div>
        {actions}
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border-strong" />
        <div className="flex items-center gap-1">
          <IconButton
            label={timelineOpen ? "Hide timeline" : "Show timeline"}
            pressed={timelineOpen}
            aria-controls={TIMELINE_ID}
            onClick={() => update({ timelineOpen: !timelineOpen })}
          >
            <BottomPanelIcon />
          </IconButton>
          <IconButton
            label={sidebarOpen ? "Hide layers and settings" : "Show layers and settings"}
            pressed={sidebarOpen}
            aria-controls={SIDEBAR_ID}
            onClick={() => update({ sidebarOpen: !sidebarOpen })}
          >
            <SidePanelIcon />
          </IconButton>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-4">{stage}</div>
          {timelineOpen ? (
            <section
              id={TIMELINE_ID}
              aria-label="Timeline"
              className="atm-drawer-up flex shrink-0 flex-col bg-surface-raised"
              style={{ height: timelineHeight }}
            >
              <ResizeHandle
                axis="y"
                label="Resize timeline"
                controls={TIMELINE_ID}
                value={timelineHeight}
                min={TIMELINE.min}
                max={TIMELINE.max}
                initial={TIMELINE.initial}
                onChange={(h) => update({ timelineHeight: h })}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">{timeline}</div>
            </section>
          ) : (
            <div className="border-t border-border-strong">{playback}</div>
          )}
        </main>
        {sidebarOpen && (
          <aside
            id={SIDEBAR_ID}
            aria-label="Layers and settings"
            className="atm-drawer-right flex min-h-0 shrink-0 bg-surface-raised"
            style={{ width: sidebarWidth }}
          >
            <ResizeHandle
              axis="x"
              label="Resize layers and settings"
              controls={SIDEBAR_ID}
              value={sidebarWidth}
              min={SIDEBAR.min}
              max={SIDEBAR.max}
              initial={SIDEBAR.initial}
              onChange={(w) => update({ sidebarWidth: w })}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <section aria-labelledby="layers-heading" className="max-h-[42%] shrink-0 overflow-y-auto border-b border-hairline px-4 pt-4 pb-3">
                <h2 id="layers-heading" className="atm-section-label mb-2 px-2 text-ink">
                  Layers
                </h2>
                {clips}
              </section>
              <div className="min-h-0 flex-1 overflow-y-auto p-6">{edit}</div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
