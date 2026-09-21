import { useCallback, useEffect, useState } from "react";

export interface PanelLayout {
  sidebarOpen: boolean;
  timelineOpen: boolean;
  /** Side panel width in px. */
  sidebarWidth: number;
  /** Bottom timeline height in px. */
  timelineHeight: number;
}

export const SIDEBAR = { min: 300, max: 640, initial: 380 } as const;
export const TIMELINE = { min: 120, max: 560, initial: 240 } as const;

const DEFAULTS: PanelLayout = {
  sidebarOpen: true,
  timelineOpen: true,
  sidebarWidth: SIDEBAR.initial,
  timelineHeight: TIMELINE.initial,
};

const KEY = "animatron.panel-layout";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Reads the saved layout, keeping only well-formed fields. */
function readLayout(): PanelLayout {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<Record<keyof PanelLayout, unknown>>;
    const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
    const num = (v: unknown, fallback: number, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback;
    return {
      sidebarOpen: bool(saved.sidebarOpen, DEFAULTS.sidebarOpen),
      timelineOpen: bool(saved.timelineOpen, DEFAULTS.timelineOpen),
      sidebarWidth: num(saved.sidebarWidth, DEFAULTS.sidebarWidth, SIDEBAR.min, SIDEBAR.max),
      timelineHeight: num(saved.timelineHeight, DEFAULTS.timelineHeight, TIMELINE.min, TIMELINE.max),
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * The desktop studio's panel arrangement: which panels are showing and how
 * big they are, remembered in localStorage across visits.
 */
export function usePanelLayout() {
  const [layout, setLayout] = useState<PanelLayout>(readLayout);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      // Storage full or unavailable: the layout just doesn't persist this time.
    }
  }, [layout]);

  const update = useCallback(
    (patch: Partial<PanelLayout>) =>
      setLayout((prev) => ({
        ...prev,
        ...patch,
        sidebarWidth: clamp(patch.sidebarWidth ?? prev.sidebarWidth, SIDEBAR.min, SIDEBAR.max),
        timelineHeight: clamp(patch.timelineHeight ?? prev.timelineHeight, TIMELINE.min, TIMELINE.max),
      })),
    [],
  );

  return { layout, update };
}
