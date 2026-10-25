"use client";

import { useRef } from "react";
import type { AudioTrack, StudioDoc } from "@/app/components/motion-studio/types";
import { Button, Select, Slider } from "@/app/components/shared-components";
import { FRAME_SIZES } from "../presets";
import { BUTTON_ROW, ColorField, NumField, TextField, ToggleField } from "./fields";
import { MusicIcon } from "./icons";
import { PanelGroup, type PanelSection } from "./PanelGroup";

interface Props {
  doc: StudioDoc;
  onChangeDoc: (next: StudioDoc) => void;
  /** A sound file picked here goes through the same import as the toolbar's. */
  onImport: (file: File) => void;
}

const ACCEPT_SOUND = ".mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,audio/*";

/** The composition's sound: when it comes in, where in the file it starts, how loud. */
function SoundFields({ audio, onChange, onRemove, onReplace }: { audio: AudioTrack; onChange: (a: AudioTrack) => void; onRemove: () => void; onReplace: () => void }) {
  const set = <K extends keyof AudioTrack>(key: K, value: AudioTrack[K]) => onChange({ ...audio, [key]: value });
  const mins = Math.floor(audio.length / 60);
  const secs = Math.round(audio.length % 60);
  return (
    <>
      <p className="flex items-center gap-2 text-sm text-ink">
        <MusicIcon width={16} height={16} className="shrink-0 text-ink-secondary" />
        <span className="min-w-0 truncate">{audio.name}</span>
        <span className="shrink-0 font-sans text-[11px] tabular-nums tracking-[0.04em] text-ink-muted">
          {mins}:{String(secs).padStart(2, "0")}
        </span>
      </p>
      <NumField label="Comes in at" unit="s" value={audio.offset} min={0} max={120} step={0.1} onChange={(v) => set("offset", v)} />
      <NumField label="Start in the file at" unit="s" value={audio.trimStart} min={0} max={Math.max(0, audio.length - 0.5)} step={0.1} onChange={(v) => set("trimStart", v)} />
      <Slider size="sm" label="Volume" min={0} max={1} step={0.05} value={audio.volume} valueLabel={`${Math.round(audio.volume * 100)}%`} onChange={(v) => set("volume", v)} />
      <NumField label="Fade out over" unit="s" value={audio.fadeOut} min={0} max={10} step={0.1} onChange={(v) => set("fadeOut", v)} />
      <div className={BUTTON_ROW}>
        <Button size="xs" variant="outline" onClick={onReplace}>
          Replace
        </Button>
        <Button size="xs" variant="danger" onClick={onRemove}>
          Remove sound
        </Button>
      </div>
      <p className="atm-help">Rendered videos carry the sound; GIFs are silent. The sound ends with the composition.</p>
    </>
  );
}

/** The canvas itself: name, frame size and background. Shown when nothing is selected. */
export function CanvasPanel({ doc, onChangeDoc, onImport }: Props) {
  const soundRef = useRef<HTMLInputElement>(null);
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
    {
      id: "sound",
      title: "Sound",
      content: (
        <>
          {doc.audio ? (
            <SoundFields
              audio={doc.audio}
              onChange={(audio) => onChangeDoc({ ...doc, audio })}
              onRemove={() => onChangeDoc({ ...doc, audio: null })}
              onReplace={() => soundRef.current?.click()}
            />
          ) : (
            <>
              <p className="atm-help">Music or a voice-over for the whole piece. One track; it plays in the preview and is baked into rendered videos.</p>
              <Button size="xs" variant="outline" icon={<MusicIcon width={14} height={14} />} onClick={() => soundRef.current?.click()}>
                Add a sound
              </Button>
            </>
          )}
          <input
            ref={soundRef}
            type="file"
            accept={ACCEPT_SOUND}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = "";
            }}
          />
        </>
      ),
    },
  ];

  return <PanelGroup storageKey="stage" sections={sections} />;
}
