"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { knownMediaUrl, mediaUrl, type FrameSync } from "./media";

/** Resolves a media id to an object URL; null while loading or when the file is gone. */
export function useMediaUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (id ? knownMediaUrl(id) : null));
  useEffect(() => {
    if (!id) return;
    let live = true;
    const known = knownMediaUrl(id);
    if (known) {
      setUrl(known);
      return;
    }
    void mediaUrl(id).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [id]);
  return id ? url : null;
}

/**
 * Present while a frame-by-frame render is running: media views register a
 * seek so the renderer can wait for them to show the exact moment before it
 * captures. Absent in the editor, where media free-runs with the clock.
 */
export const FrameSyncContext = createContext<FrameSync | null>(null);
export const useFrameSync = () => useContext(FrameSyncContext);
