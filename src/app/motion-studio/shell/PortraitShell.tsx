"use client";

import { AtomMark, CollapseIcon, ExpandIcon } from "../panel/icons";
import { MobileTabs, panelId, tabId, type MobileTab } from "../panel/MobileTabs";
import { IconButton } from "./IconButton";
import type { StudioSlots } from "./types";

interface Props extends StudioSlots {
  tab: MobileTab;
  onTab: (tab: MobileTab) => void;
  /** Panels hidden: the stage takes the space above the playback strip. */
  focused: boolean;
  onFocused: (focused: boolean) => void;
}

/**
 * Phone (and tablet) portrait: app bar, stage, a pinned playback strip, one
 * panel at a time, and a bottom tab bar in thumb reach. The panel hugs its
 * content (scrolling past 55dvh) and the stage absorbs the rest, so short
 * panels never leave dead space. The app bar can hide the panels entirely.
 */
export function PortraitShell({ title, phoneActions, stage, playback, tracks, clips, edit, tab, onTab, focused, onFocused }: Props) {
  const panel = (id: MobileTab) => ({ role: "tabpanel", id: panelId(id), "aria-labelledby": tabId(id) });

  return (
    <div className="flex h-dvh flex-col bg-surface font-body text-ink">
      <header className="flex min-h-12 min-w-0 items-center gap-2 border-b border-border-strong bg-surface-raised pt-[env(safe-area-inset-top)] pr-1 pl-3">
        <h1 className="flex shrink-0 items-center">
          <AtomMark className="text-primary" />
          <span className="sr-only">Animatron</span>
        </h1>
        <div className="min-w-0 flex-1">{title}</div>
        {phoneActions}
        <IconButton label={focused ? "Show panels" : "Focus on the stage"} pressed={focused} onClick={() => onFocused(!focused)}>
          {focused ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </header>
      {/* The stage takes whatever the panel doesn't need, canvas centered in it. */}
      <main className="min-h-[28dvh] flex-1">{stage}</main>
      <section aria-label="Playback" className="border-b border-hairline">{playback}</section>
      {!focused && (
        <section aria-label="Panels" className="max-h-[55dvh] shrink-0 overflow-y-auto bg-surface-raised">
          {tab === "timeline" && <div {...panel("timeline")}>{tracks}</div>}
          {tab === "clips" && (
            <div {...panel("clips")} className="px-3 py-2">
              <h2 className="sr-only">Layers</h2>
              {clips}
            </div>
          )}
          {tab === "edit" && (
            <div {...panel("edit")} className="p-4 sm:p-6">
              {edit}
            </div>
          )}
        </section>
      )}
      <MobileTabs
        active={tab}
        onChange={(next) => {
          onTab(next);
          onFocused(false);
        }}
      />
    </div>
  );
}
