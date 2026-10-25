"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/app/components/shared-components";
import { useMediaQuery } from "../motion-studio/lib/useMediaQuery";
import { RAIL, usePanelLayout } from "../motion-studio/lib/usePanelLayout";
import { writeHandoff, type Handoff } from "../motion-studio/lib/handoff";
import { AtomMark, ChevronLeftIcon } from "../motion-studio/panel/icons";
import { ResizeHandle } from "../motion-studio/panel/ResizeHandle";
import { IconButton } from "../motion-studio/shell/IconButton";
import { ControlsSidebar } from "./ControlsSidebar";
import { DrawingCanvas } from "./DrawingCanvas";
import { downloadSvg, svgString } from "./lib/svg";
import { useSquiggles } from "./useSquiggles";
import type { Stroke } from "./types";

/** Ms between staggered downloads so browsers don't drop a burst of blobs. */
const EXPORT_STAGGER = 250;
/** The Motion Studio lives at the site root; the router applies the base path. */
const MOTION_STUDIO = "/";
const CONTROLS_ID = "squiggle-controls";

/**
 * The whole drawing studio: a canvas with the global actions (undo / clear /
 * smooth all / export all) along its top, and the controls beside it on wide
 * screens (in a rail that can be dragged wider, remembered) or under it on
 * phones. All drawing state lives in `useSquiggles`;
 * this component wires it to the UI and owns SVG export and the handoff to the
 * Motion Studio.
 */
export function SquiggleStudio() {
  const router = useRouter();
  const wide = useMediaQuery("(min-width: 1024px) and (min-height: 501px)");
  const { layout, update } = usePanelLayout();
  const squiggles = useSquiggles();
  const { colors, band, strokes, current, hover, beginStroke, extendStroke, endStroke, undo, clearAll, smoothAll } = squiggles;

  const noStrokes = strokes.length === 0;

  const exportStroke = (stroke: Stroke, index: number) => {
    downloadSvg(`squiggle-${index + 1}.svg`, svgString(stroke.pts, colors, band));
  };

  /** Park the squiggle for the Motion Studio and go there. */
  const sendToMotionStudio = (handoff: Handoff) => {
    if (writeHandoff(handoff)) router.push(MOTION_STUDIO);
  };

  const animateStroke = (stroke: Stroke) => sendToMotionStudio({ kind: "ribbon", points: stroke.pts, colors, band });

  const flyStroke = (stroke: Stroke) => sendToMotionStudio({ kind: "flight", points: stroke.pts, colors, band });

  const artworkStroke = (stroke: Stroke, index: number) =>
    sendToMotionStudio({ kind: "artwork", svg: svgString(stroke.pts, colors, band), label: `squiggle-${index + 1}.svg` });

  const exportAll = () => {
    strokes.forEach((stroke, i) => {
      setTimeout(() => exportStroke(stroke, i), i * EXPORT_STAGGER);
    });
  };

  const controls = (
    <ControlsSidebar
      squiggles={squiggles}
      onExportStroke={exportStroke}
      onAnimateStroke={animateStroke}
      onFlyStroke={flyStroke}
      onArtworkStroke={artworkStroke}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-surface font-body text-ink">
      <header className="flex min-h-12 min-w-0 items-center gap-3 border-b border-border-strong bg-surface-raised py-1 pr-2 pl-1 pt-[env(safe-area-inset-top)]">
        <IconButton label="Back to the Motion Studio" onClick={() => router.push(MOTION_STUDIO)}>
          <ChevronLeftIcon />
        </IconButton>
        <h1 className="flex min-w-0 shrink-0 items-center gap-2 font-display text-xl font-semibold tracking-[-0.01em]">
          <AtomMark className="text-primary" />
          {wide ? "Animatron" : "Squiggle Studio"}
        </h1>
        {wide && <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">Squiggle Studio · draw, smooth, export, or send to the studio</span>}
      </header>

      <div className={`flex min-h-0 flex-1 ${wide ? "flex-row" : "flex-col"}`}>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
          <div className={wide ? "flex flex-wrap items-center gap-x-2 gap-y-3" : "grid grid-cols-4 gap-2"}>
            {wide && <p className="atm-help mr-auto">Draw squiggles and loops with your mouse.</p>}
            <Button variant="outline" size="xs" onClick={undo} disabled={noStrokes}>
              Undo
            </Button>
            <Button variant="outline" size="xs" onClick={clearAll} disabled={noStrokes}>
              Clear
            </Button>
            <Button variant="outline" size="xs" onClick={smoothAll} disabled={noStrokes} aria-label="Smooth all">
              {wide ? "Smooth all" : "Smooth"}
            </Button>
            <Button variant="primary" size="xs" onClick={exportAll} disabled={noStrokes} aria-label="Export all SVGs">
              {wide ? "Export all SVGs" : "Export"}
            </Button>
          </div>
          <DrawingCanvas
            colors={colors}
            band={band}
            strokes={strokes}
            current={current}
            hover={hover}
            onBegin={beginStroke}
            onExtend={extendStroke}
            onEnd={endStroke}
          />
        </main>

        {wide ? (
          <>
            <ResizeHandle
              axis="x"
              label="Resize squiggle controls"
              controls={CONTROLS_ID}
              value={layout.railWidth}
              min={RAIL.min}
              max={RAIL.max}
              initial={RAIL.initial}
              onChange={(w) => update({ railWidth: w })}
            />
            <aside
              id={CONTROLS_ID}
              aria-label="Squiggle controls"
              className="atm-drawer-right shrink-0 overflow-y-auto bg-surface-raised p-6"
              style={{ width: layout.railWidth }}
            >
              {controls}
            </aside>
          </>
        ) : (
          <section
            id={CONTROLS_ID}
            aria-label="Squiggle controls"
            className="atm-drawer-up max-h-[50dvh] shrink-0 overflow-y-auto border-t border-border-strong bg-surface-raised p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            {controls}
          </section>
        )}
      </div>
    </div>
  );
}
