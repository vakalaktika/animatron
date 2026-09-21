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
 * along the bottom, settings down the right. Both panels can be hidden from
 * the app bar and resized by dragging their edge; the choice is remembered.
 */
export function DesktopShell({ docName, stage, playback, timeline, clips, edit }: StudioSlots) {
  const { layout, update } = usePanelLayout();
  const { sidebarOpen, timelineOpen, sidebarWidth, timelineHeight } = layout;

  return (
    <div className="flex h-dvh flex-col bg-surface font-body text-ink">
      <header className="flex min-w-0 items-center gap-4 border-b border-border-strong bg-surface-raised py-1 pr-2 pl-4">
        <h1 className="flex shrink-0 items-center gap-2 font-display text-xl font-semibold tracking-[-0.01em]">
          <AtomMark className="text-primary" />
          Animatron
        </h1>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{docName}</span>
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
            label={sidebarOpen ? "Hide settings panel" : "Show settings panel"}
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
            <>
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
              <section
                id={TIMELINE_ID}
                aria-label="Timeline"
                className="atm-drawer-up shrink-0 overflow-y-auto bg-surface-raised"
                style={{ height: timelineHeight }}
              >
                {timeline}
              </section>
            </>
          ) : (
            <div className="border-t border-border-strong">{playback}</div>
          )}
        </main>
        {sidebarOpen && (
          <>
            <ResizeHandle
              axis="x"
              label="Resize settings panel"
              controls={SIDEBAR_ID}
              value={sidebarWidth}
              min={SIDEBAR.min}
              max={SIDEBAR.max}
              initial={SIDEBAR.initial}
              onChange={(w) => update({ sidebarWidth: w })}
            />
            <aside
              id={SIDEBAR_ID}
              aria-label="Settings"
              className="atm-drawer-right flex min-h-0 shrink-0 flex-col bg-surface-raised"
              style={{ width: sidebarWidth }}
            >
              <div className="border-b border-hairline p-6">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="atm-section-label text-ink">Clips</h2>
                  <span className="text-xs text-ink-muted">lower rows paint on top · drag right to nest</span>
                </div>
                {clips}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-6">{edit}</div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
