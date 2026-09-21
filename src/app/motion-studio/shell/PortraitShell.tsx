"use client";

import type { CSSProperties } from "react";
import { AtomMark, CollapseIcon, ExpandIcon } from "../panel/icons";
import { MobileTabs, panelId, tabId, type MobileTab } from "../panel/MobileTabs";
import { IconButton } from "./IconButton";
import type { StudioSlots } from "./types";

interface Props extends StudioSlots {
  stageAspect: string;
  tab: MobileTab;
  onTab: (tab: MobileTab) => void;
  /** Panels hidden: the stage takes the space above the playback strip. */
  focused: boolean;
  onFocused: (focused: boolean) => void;
}

/**
 * Phone (and tablet) portrait: app bar, stage sized to the canvas, a pinned
 * playback strip, one panel at a time, and a bottom tab bar in thumb reach.
 * The app bar can hide the panels so the stage gets the whole screen.
 */
export function PortraitShell({ docName, stage, playback, tracks, clips, edit, stageAspect, tab, onTab, focused, onFocused }: Props) {
  const panel = (id: MobileTab) => ({ role: "tabpanel", id: panelId(id), "aria-labelledby": tabId(id) });

  return (
    <div className="flex h-dvh flex-col bg-surface font-body text-ink">
      <header className="flex min-h-12 min-w-0 items-center gap-3 border-b border-border-strong bg-surface-raised pt-[env(safe-area-inset-top)] pr-1 pl-4">
        <h1 className="flex shrink-0 items-center">
          <AtomMark className="text-primary" />
          <span className="sr-only">Animatron</span>
        </h1>
        <span className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold tracking-[-0.01em]">{docName}</span>
        <IconButton label={focused ? "Show panels" : "Focus on the stage"} pressed={focused} onClick={() => onFocused(!focused)}>
          {focused ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </header>
      <div
        className={focused ? "min-h-0 flex-1" : "aspect-[var(--stage-ar)] max-h-[46dvh] w-full shrink-0"}
        style={{ "--stage-ar": stageAspect } as CSSProperties}
      >
        {stage}
      </div>
      <div className="border-b border-hairline">{playback}</div>
      {!focused && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised">
          {tab === "timeline" && <div {...panel("timeline")}>{tracks}</div>}
          {tab === "clips" && (
            <div {...panel("clips")} className="px-4 py-3">
              <h2 className="sr-only">Clips</h2>
              <p className="atm-help mb-1">Lower rows paint on top. Drag a grip right to nest a clip.</p>
              {clips}
            </div>
          )}
          {tab === "edit" && (
            <div {...panel("edit")} className="p-4 sm:p-6">
              {edit}
            </div>
          )}
        </div>
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
