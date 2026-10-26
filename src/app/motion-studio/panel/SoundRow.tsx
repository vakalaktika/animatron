"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getMedia } from "@/app/components/motion-studio/engine/media";
import { audioSpan } from "@/app/components/motion-studio/engine/timing";
import type { AudioTrack, StudioDoc } from "@/app/components/motion-studio/types";
import { MusicIcon } from "./icons";

const PEAKS = 240;
const peakCache = new Map<string, Promise<Float32Array | null>>();

/** Loudness per slice of the whole file, 0..1, decoded once per media id. */
function loadPeaks(mediaId: string): Promise<Float32Array | null> {
  const cached = peakCache.get(mediaId);
  if (cached) return cached;
  const p = (async () => {
    const record = await getMedia(mediaId);
    if (!record || typeof AudioContext === "undefined") return null;
    const ctx = new AudioContext();
    try {
      const buffer = await ctx.decodeAudioData(await record.blob.arrayBuffer());
      const data = buffer.getChannelData(0);
      const per = Math.max(1, Math.floor(data.length / PEAKS));
      const peaks = new Float32Array(PEAKS);
      let max = 0;
      for (let i = 0; i < PEAKS; i++) {
        let peak = 0;
        const from = i * per;
        for (let j = from; j < from + per && j < data.length; j += 8) {
          const v = Math.abs(data[j]);
          if (v > peak) peak = v;
        }
        peaks[i] = peak;
        if (peak > max) max = peak;
      }
      if (max > 0) for (let i = 0; i < PEAKS; i++) peaks[i] /= max;
      return peaks;
    } catch {
      return null;
    } finally {
      void ctx.close();
    }
  })();
  peakCache.set(mediaId, p);
  return p;
}

export function useWaveform(mediaId: string | null | undefined): Float32Array | null {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  useEffect(() => {
    if (!mediaId) return;
    let live = true;
    void loadPeaks(mediaId).then((p) => {
      if (live) setPeaks(p);
    });
    return () => {
      live = false;
    };
  }, [mediaId]);
  return mediaId ? peaks : null;
}

/** The waveform of the part of the file that plays, as mirrored bars. */
function Waveform({ peaks, from, to }: { peaks: Float32Array; from: number; to: number }) {
  const first = Math.floor(from * PEAKS);
  const last = Math.max(first + 1, Math.ceil(to * PEAKS));
  const slice = Array.from(peaks.slice(first, last));
  const w = 100;
  const step = w / slice.length;
  const d = slice.map((v, i) => `M${(i * step).toFixed(2)} ${(50 - v * 46).toFixed(1)}V${(50 + v * 46).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <path d={d} stroke="currentColor" strokeWidth={Math.max(0.35, step * 0.7)} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface Props {
  doc: StudioDoc;
  duration: number;
  selected: boolean;
  /** Pixels per second of the bar area; reads the track width. */
  secondsPerPixel: () => number;
  onSelect: () => void;
  onChange: (next: AudioTrack) => void;
  stacked: boolean;
  labelWidth?: string;
}

const STEP = 0.05;

/**
 * The sound's lane under the layers: its span on the clock with the
 * waveform inside, dragged to change when it starts. Not stacked with the
 * layers because it does not sit on the canvas.
 */
export function SoundRow({ doc, duration, selected, secondsPerPixel, onSelect, onChange, stacked, labelWidth }: Props) {
  const audio = doc.audio;
  const peaks = useWaveform(audio?.mediaId);
  const drag = useRef<{ startX: number; offset: number } | null>(null);
  if (!audio) return null;
  const span = audioSpan(doc, duration);
  const left = duration > 0 ? (audio.offset / duration) * 100 : 0;
  const width = span && duration > 0 ? ((span.end - span.start) / duration) * 100 : 0;
  const playedFrom = audio.length > 0 ? audio.trimStart / audio.length : 0;
  const playedTo = audio.length > 0 && span ? Math.min(1, (audio.trimStart + (span.end - span.start)) / audio.length) : 1;

  const down = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    onSelect();
    drag.current = { startX: e.clientX, offset: audio.offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = Math.max(0, Math.round((d.offset + (e.clientX - d.startX) * secondsPerPixel()) / STEP) * STEP);
    onChange({ ...audio, offset: Number(next.toFixed(2)) });
  };
  const up = () => {
    drag.current = null;
  };

  const bar = (
    <span
      role="slider"
      tabIndex={0}
      aria-label={`${audio.name} starts`}
      aria-valuemin={0}
      aria-valuemax={Math.max(duration, audio.offset)}
      aria-valuenow={audio.offset}
      aria-valuetext={`${audio.offset.toFixed(2)} seconds`}
      className={`t-drag-bar absolute cursor-ew-resize touch-none overflow-hidden rounded-md ${stacked ? "top-0 h-full" : "top-0.5 h-4 pointer-coarse:top-2 pointer-coarse:h-7"}`}
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 0.5)}%`,
        backgroundColor: "color-mix(in srgb, var(--success) 26%, transparent)",
        color: "var(--success)",
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange({ ...audio, offset: Math.max(0, Number((audio.offset - STEP).toFixed(2))) });
        if (e.key === "ArrowRight") onChange({ ...audio, offset: Number((audio.offset + STEP).toFixed(2)) });
      }}
    >
      {peaks && <Waveform peaks={peaks} from={playedFrom} to={playedTo} />}
    </span>
  );

  const name = (
    <button type="button" onClick={onSelect} className="flex h-full min-w-0 flex-1 items-center gap-1.5 truncate text-left text-[11px] leading-5 text-ink pointer-coarse:text-[13px]" aria-label={`Sound: ${audio.name}`}>
      <MusicIcon width={14} height={14} className="shrink-0 text-ink-secondary" />
      <span className="truncate">{audio.name}</span>
    </button>
  );

  if (stacked) {
    return (
      <div data-track-id="audio" className={`mt-2 flex items-center gap-0.5 rounded-md border-t border-hairline py-1 pr-1 pt-2 ${selected ? "bg-primary-soft" : ""}`}>
        <span className="w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex h-5 items-center gap-2 pl-1.5">{name}</div>
          <div className="relative mt-1 h-5 overflow-hidden">{bar}</div>
        </div>
      </div>
    );
  }
  return (
    <div data-track-id="audio" className={`mt-1.5 flex h-5 items-center rounded border-t border-hairline pt-1.5 pointer-coarse:h-11 ${selected ? "bg-primary-soft" : ""}`} style={{ height: "auto" }}>
      <div style={{ width: labelWidth }} className="flex h-5 shrink-0 items-center gap-0.5 pr-2 pl-6 pointer-coarse:h-11">
        {name}
      </div>
      <div className="relative h-5 min-w-0 flex-1 overflow-hidden pointer-coarse:h-11">{bar}</div>
    </div>
  );
}
