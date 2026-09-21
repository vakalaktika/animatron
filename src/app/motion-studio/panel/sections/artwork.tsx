"use client";

import type { SpriteClip } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { TextField } from "../fields";
import type { PanelSection } from "../PanelGroup";

export interface ArtworkActions {
  onSetRunText: (clip: SpriteClip, runId: string, text: string) => void;
  onDetachRun: (clip: SpriteClip, runId: string) => void;
  onRestoreRun: (clip: SpriteClip, runId: string) => void;
  onAddAttachedText: (clip: SpriteClip) => void;
}

/** One field per live text run in an imported SVG, each with Detach / Restore. */
export function textRunsSection(clip: SpriteClip, actions: ArtworkActions): PanelSection {
  const runs = clip.source.kind === "svg" ? clip.source.textRuns : [];
  return {
    id: "artwork",
    title: `SVG, ${runs.length} text ${runs.length === 1 ? "run" : "runs"}, editable in place`,
    content: (
      <>
        {runs.map((run) => (
          <div key={run.id} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              {run.detachedTo ? (
                <p className="text-xs text-background-cta-60">“{run.text}” is now its own text clip.</p>
              ) : (
                <TextField label={`Run ${run.id.replace("run-", "")}`} value={run.text} onChange={(v) => actions.onSetRunText(clip, run.id, v)} />
              )}
            </div>
            {run.detachedTo ? (
              <Button size="xs" variant="outline" onClick={() => actions.onRestoreRun(clip, run.id)}>
                Restore
              </Button>
            ) : (
              <Button size="xs" variant="outline" onClick={() => actions.onDetachRun(clip, run.id)}>
                Detach
              </Button>
            )}
          </div>
        ))}
      </>
    ),
  };
}

/** An SVG whose text was exported as outlines. Nothing to edit; say why. */
export function outlinedSvgSection(): PanelSection {
  return {
    id: "artwork",
    title: "SVG artwork",
    content: <p className="text-xs text-background-cta-60">No live text found. Re-export with text as text, not outlines.</p>,
  };
}

/** A raster picture: text in it is pixels, so offer a text clip that rides it instead. */
export function rasterSection(clip: SpriteClip, actions: ArtworkActions): PanelSection {
  return {
    id: "artwork",
    title: "Picture",
    content: (
      <>
        <p className="text-xs text-background-cta-60">Text baked into a picture can’t be edited.</p>
        <Button size="xs" variant="outline" onClick={() => actions.onAddAttachedText(clip)}>
          + Attached text
        </Button>
      </>
    ),
  };
}
