"use client";

import { useState } from "react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Button, FileInput, Select } from "@/app/components/shared-components";
import { BUILT_IN_PRESETS, FRAME_SIZES, type SavedPreset } from "../presets";
import { NumField, TextField, ToggleField } from "./fields";
import { PanelGroup, type PanelSection } from "./PanelGroup";

interface Props {
  doc: StudioDoc;
  onChangeDoc: (next: StudioDoc) => void;
  saved: SavedPreset[];
  onSavePreset: () => void;
  onLoadPreset: (doc: StudioDoc) => void;
  onDeletePreset: (name: string) => void;
  onImportFile: (file: File) => void;
  onAddClip: (type: "logo" | "chippy" | "bubble" | "text") => void;
  onExportDocCode: () => void;
  onExportDocJson: () => void;
  onRecord: () => void;
  recording: boolean;
  onClean: () => void;
  notice: string | null;
}

/** Stage, presets, import, add clips, and whole-composition export. */
export function StagePanel({
  doc,
  onChangeDoc,
  saved,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onImportFile,
  onAddClip,
  onExportDocCode,
  onExportDocJson,
  onRecord,
  recording,
  onClean,
  notice,
}: Props) {
  const [presetPick, setPresetPick] = useState("");
  const setStage = <K extends keyof StudioDoc["stage"]>(key: K, value: StudioDoc["stage"][K]) =>
    onChangeDoc({ ...doc, stage: { ...doc.stage, [key]: value } });
  const frameValue = `${doc.stage.width}x${doc.stage.height}`;

  const sections: PanelSection[] = [
    { id: "composition", title: "Composition", content: (
      <>
        <TextField label="Name" value={doc.name} onChange={(v) => onChangeDoc({ ...doc, name: v })} />
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Frame size</span>
          <Select
            variant="compact"
            className="w-full"
            value={FRAME_SIZES.some((f) => `${f.width}x${f.height}` === frameValue) ? frameValue : "custom"}
            onChange={(e) => {
              const f = FRAME_SIZES.find((s) => `${s.width}x${s.height}` === e.target.value);
              if (f) onChangeDoc({ ...doc, stage: { ...doc.stage, width: f.width, height: f.height } });
            }}
          >
            {FRAME_SIZES.map((f) => (
              <option key={f.label} value={`${f.width}x${f.height}`}>
                {f.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Width" value={doc.stage.width} min={200} max={4000} step={1} onChange={(v) => setStage("width", v)} />
          <NumField label="Height" value={doc.stage.height} min={200} max={4000} step={1} onChange={(v) => setStage("height", v)} />
        </div>
        <TextField label="Background" value={doc.stage.background} onChange={(v) => setStage("background", v)} />
        <ToggleField label="Transparent background" value={doc.stage.transparent} onChange={(v) => setStage("transparent", v)} />
      </>
    ) },
    { id: "add", title: "Add a clip", content: (
      <>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => onAddClip("logo")}>+ Logo build</Button>
          <Button size="xs" variant="outline" onClick={() => onAddClip("chippy")}>+ Chippy</Button>
          <Button size="xs" variant="outline" onClick={() => onAddClip("bubble")}>+ Speech bubble</Button>
          <Button size="xs" variant="outline" onClick={() => onAddClip("text")}>+ Text</Button>
          <FileInput size="sm" accept=".json,.svg,.png,.jpg,.jpeg,.webp,.gif" onFile={onImportFile}>
            Import Lottie, clip, or image
          </FileInput>
        </div>
        <p className="text-xs text-background-cta-60">
          Lottie and studio JSON files add a clip. Images and SVGs become sprites that can follow a path; an SVG with live text keeps it editable. A studio document replaces the composition.
        </p>
      </>
    ) },
    { id: "presets", title: "Presets", content: (
      <>
        <div className="flex items-center gap-2">
          <Select variant="compact" value={presetPick} onChange={(e) => setPresetPick(e.target.value)} className="min-w-0 flex-1">
            <option value="">Choose a preset</option>
            {BUILT_IN_PRESETS.map((p) => (
              <option key={`builtin:${p.label}`} value={`builtin:${p.label}`}>
                {p.label} (built in)
              </option>
            ))}
            {saved.map((p) => (
              <option key={`saved:${p.name}`} value={`saved:${p.name}`}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button
            size="xs"
            variant="outline"
            disabled={!presetPick}
            onClick={() => {
              const sep = presetPick.indexOf(":");
              const kind = presetPick.slice(0, sep);
              const name = presetPick.slice(sep + 1);
              const doc =
                kind === "builtin"
                  ? BUILT_IN_PRESETS.find((p) => p.label === name)?.make()
                  : saved.find((p) => p.name === name)?.doc;
              if (doc) onLoadPreset(doc);
            }}
          >
            Load
          </Button>
          {presetPick.startsWith("saved:") && (
            <Button size="xs" variant="danger" onClick={() => { onDeletePreset(presetPick.slice(6)); setPresetPick(""); }}>
              Delete
            </Button>
          )}
        </div>
        <Button size="sm" onClick={onSavePreset}>Save current as preset</Button>
      </>
    ) },
    { id: "export", title: "Export and record", content: (
      <>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={onExportDocCode}>Composition code (.tsx)</Button>
          <Button size="xs" variant="outline" onClick={onExportDocJson}>Composition JSON</Button>
          <Button size="xs" variant="outline" onClick={onClean}>Clean view</Button>
          <Button size="sm" variant={recording ? "danger" : "primary"} onClick={onRecord}>
            {recording ? "Stop recording" : "Record to WebM"}
          </Button>
        </div>
        <p className="text-xs text-background-cta-60">
          Recording switches to the clean view, replays from the start, and captures this tab. Pick “This tab” in the browser prompt. For alpha, screen-record the clean view with a transparent stage in your capture tool instead.
        </p>
        {notice && <p className="text-xs text-background-cta">{notice}</p>}
      </>
    ) },
  ];

  return <PanelGroup storageKey="stage" sections={sections} />;
}
