"use client";

import { useCallback, useEffect, useState } from "react";
import { resample, smoothPts } from "./lib/geometry";
import { loadSquiggles, saveSquiggles } from "./lib/persistence";
import { DEFAULT_COLORS, MIN_COLORS, nextColor } from "./lib/palette";
import type { Point, Stroke } from "./types";

/** Pointer travel (px) below which a move is ignored, to thin out samples. */
const MIN_MOVE = 1.5;
/** A stroke needs at least this many raw points to be worth keeping. */
const MIN_STROKE_POINTS = 3;

/** State and actions backing the Squiggle Studio canvas. */
export interface Squiggles {
  colors: string[];
  band: number;
  strokes: Stroke[];
  /** The in-progress stroke while the pointer is down, else null. */
  current: Point[] | null;
  /** Id of the stroke being hovered in the list, for canvas highlighting. */
  hover: number | null;

  setColorAt: (index: number, value: string) => void;
  addColor: () => void;
  removeColorAt: (index: number) => void;
  applyPreset: (colors: string[]) => void;
  setBand: (band: number) => void;

  beginStroke: (p: Point) => void;
  extendStroke: (p: Point) => void;
  endStroke: () => void;

  smoothStroke: (id: number) => void;
  removeStroke: (id: number) => void;
  setHover: (id: number | null) => void;

  undo: () => void;
  clearAll: () => void;
  smoothAll: () => void;
}

/**
 * Owns everything the studio draws: the active rainbow, stripe width, the list
 * of committed strokes, and the one being drawn right now. Pointer coordinates
 * are resolved to canvas space by the caller (which holds the SVG ref); this
 * hook only deals in points. Colours, width and strokes are autosaved, so a
 * trip to the Motion Studio and back finds the drawings where they were.
 */
export function useSquiggles(): Squiggles {
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [band, setBand] = useState(8);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Point[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [nextId, setNextId] = useState(1);
  const [restored, setRestored] = useState(false);

  // Restore once on mount. An effect rather than a lazy initializer so the
  // first client render matches the static page before the saved drawings
  // replace it.
  useEffect(() => {
    const saved = loadSquiggles();
    /* eslint-disable react-hooks/set-state-in-effect -- a one-time read of an external store on mount */
    if (saved) {
      setColors(saved.colors);
      setBand(saved.band);
      setStrokes(saved.strokes);
      setNextId(saved.strokes.reduce((max, s) => Math.max(max, s.id), 0) + 1);
    }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (restored) saveSquiggles({ colors, band, strokes });
  }, [restored, colors, band, strokes]);

  const setColorAt = useCallback((index: number, value: string) => {
    setColors((cs) => cs.map((c, j) => (j === index ? value : c)));
  }, []);

  const addColor = useCallback(() => {
    setColors((cs) => [...cs, nextColor(cs.length)]);
  }, []);

  const removeColorAt = useCallback((index: number) => {
    setColors((cs) => (cs.length > MIN_COLORS ? cs.filter((_, j) => j !== index) : cs));
  }, []);

  const applyPreset = useCallback((next: string[]) => {
    setColors(next.slice());
  }, []);

  const beginStroke = useCallback((p: Point) => {
    setCurrent([p]);
  }, []);

  const extendStroke = useCallback((p: Point) => {
    setCurrent((c) => {
      if (!c) return c;
      const last = c[c.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_MOVE) return c;
      return [...c, p];
    });
  }, []);

  const endStroke = useCallback(() => {
    // Read `current` from the closure and commit with plain, non-nested
    // setState calls. Nesting setStrokes/setNextId inside a setCurrent updater
    // would double-run them under StrictMode's purity check and duplicate the
    // stroke; each of these updaters is pure on its own.
    if (current && current.length >= MIN_STROKE_POINTS) {
      setStrokes((ss) => [...ss, { id: nextId, pts: resample(current, 4), smoothed: 0 }]);
      setNextId((n) => n + 1);
    }
    setCurrent(null);
  }, [current, nextId]);

  const smoothStroke = useCallback((id: number) => {
    setStrokes((ss) => ss.map((s) => (s.id === id ? { ...s, pts: smoothPts(s.pts), smoothed: s.smoothed + 1 } : s)));
  }, []);

  const removeStroke = useCallback((id: number) => {
    setStrokes((ss) => ss.filter((s) => s.id !== id));
    setHover(null);
  }, []);

  const undo = useCallback(() => {
    setStrokes((ss) => ss.slice(0, -1));
  }, []);

  const clearAll = useCallback(() => {
    setStrokes([]);
    setHover(null);
  }, []);

  const smoothAll = useCallback(() => {
    setStrokes((ss) => ss.map((s) => ({ ...s, pts: smoothPts(s.pts), smoothed: s.smoothed + 1 })));
  }, []);

  return {
    colors,
    band,
    strokes,
    current,
    hover,
    setColorAt,
    addColor,
    removeColorAt,
    applyPreset,
    setBand,
    beginStroke,
    extendStroke,
    endStroke,
    smoothStroke,
    removeStroke,
    setHover,
    undo,
    clearAll,
    smoothAll,
  };
}
