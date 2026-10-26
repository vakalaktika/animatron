"use client";

import type { SpriteClip } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { BUTTON_ROW, ChipField, NumField, TextField } from "../fields";
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
    title: `Text in the artwork (${runs.length})`,
    content: (
      <>
        {runs.map((run) => (
          <div key={run.id} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              {run.detachedTo ? (
                <p className="atm-help">“{run.text}” is now its own text clip.</p>
              ) : (
                <TextField label={`Text ${Number(run.id.replace("run-", "")) + 1}`} value={run.text} onChange={(v) => actions.onSetRunText(clip, run.id, v)} />
              )}
            </div>
            {run.detachedTo ? (
              <Button size="xs" variant="outline" onClick={() => actions.onRestoreRun(clip, run.id)}>
                Restore
              </Button>
            ) : (
              <Button size="xs" variant="outline" onClick={() => actions.onDetachRun(clip, run.id)}>
                Make it a clip
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
    content: <p className="atm-help">This SVG has no editable text. To edit words here, export it with text kept as text rather than outlines.</p>,
  };
}

/** A raster picture: text in it is pixels, so offer a text clip that rides it instead. */
export function rasterSection(clip: SpriteClip, actions: ArtworkActions): PanelSection {
  return {
    id: "artwork",
    title: "Picture",
    content: (
      <>
        <p className="atm-help">Words inside a picture are pixels. Add a text clip that rides along with it instead.</p>
        <Button size="xs" variant="outline" onClick={() => actions.onAddAttachedText(clip)}>
          + Text that follows this picture
        </Button>
      </>
    ),
  };
}

/** A video: where in the file it starts, how long it shows, and how it fills its box. */
export function videoSection(clip: SpriteClip, onChange: (c: SpriteClip) => void, stage: { width: number; height: number }): PanelSection {
  const source = clip.source.kind === "video" ? clip.source : null;
  if (!source) return { id: "video", title: "Video", content: null };
  const set = (patch: Partial<typeof source>) => onChange({ ...clip, source: { ...source, ...patch } });
  const longest = Math.max(0.2, (source.length || 600) - source.trimStart);
  return {
    id: "video",
    title: "Video",
    content: (
      <>
        <NumField label="Start in the file at" unit="s" value={source.trimStart} min={0} max={Math.max(0, (source.length || 600) - 0.2)} step={0.1} onChange={(v) => set({ trimStart: v, playFor: Math.min(source.playFor, Math.max(0.2, (source.length || 600) - v)) })} />
        <NumField label="Show for" unit="s" value={source.playFor} min={0.2} max={Math.min(600, longest)} step={0.1} onChange={(v) => set({ playFor: v })} />
        <ChipField
          label="Fit"
          value={source.cover ? "cover" : "contain"}
          options={[
            { value: "cover", label: "Fill the box" },
            { value: "contain", label: "Show it all" },
          ]}
          onChange={(v) => set({ cover: v === "cover" })}
        />
        <div className={BUTTON_ROW}>
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              onChange({
                ...clip,
                x: stage.width / 2,
                y: stage.height / 2,
                width: stage.width,
                scale: 1,
                rotation: 0,
                path: [
                  { x: 0, y: 0 },
                  { x: 0, y: 0 },
                ],
                source: { ...source, cover: true, aspect: stage.height / stage.width },
              })
            }
          >
            Fill the canvas
          </Button>
        </div>
        <p className="atm-help">The video plays without sound. Add music or a voice-over with the Sound tool; it is one track for the whole piece.</p>
      </>
    ),
  };
}
