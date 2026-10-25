"use client";

import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Select } from "@/app/components/shared-components";
import { FRAME_SIZES } from "../presets";
import { ColorField, NumField, TextField, ToggleField } from "./fields";
import { PanelGroup, type PanelSection } from "./PanelGroup";

interface Props {
  doc: StudioDoc;
  onChangeDoc: (next: StudioDoc) => void;
}

/** The canvas itself: name, frame size and background. Shown when nothing is selected. */
export function CanvasPanel({ doc, onChangeDoc }: Props) {
  const setStage = <K extends keyof StudioDoc["stage"]>(key: K, value: StudioDoc["stage"][K]) =>
    onChangeDoc({ ...doc, stage: { ...doc.stage, [key]: value } });
  const frameValue = `${doc.stage.width}x${doc.stage.height}`;
  const preset = FRAME_SIZES.some((f) => `${f.width}x${f.height}` === frameValue) ? frameValue : "custom";

  const sections: PanelSection[] = [
    {
      id: "canvas",
      title: "Canvas",
      content: (
        <>
          <TextField label="Name" value={doc.name} onChange={(v) => onChangeDoc({ ...doc, name: v })} />
          <label className="block">
            <span className="mb-2 block atm-label">Frame</span>
            <Select
              variant="compact"
              className="w-full"
              value={preset}
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
              <option value="custom">Custom size</option>
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Width" unit="px" value={doc.stage.width} min={200} max={4000} step={1} onChange={(v) => setStage("width", v)} />
            <NumField label="Height" unit="px" value={doc.stage.height} min={200} max={4000} step={1} onChange={(v) => setStage("height", v)} />
          </div>
          <ColorField label="Background" value={doc.stage.background} onChange={(v) => setStage("background", v)} />
          <ToggleField label="See-through background" value={doc.stage.transparent} onChange={(v) => setStage("transparent", v)} />
          {doc.stage.transparent && <p className="atm-help">Shown on a checkerboard here; recordings over a see-through canvas need a capture tool that keeps alpha.</p>}
        </>
      ),
    },
  ];

  return <PanelGroup storageKey="stage" sections={sections} />;
}
