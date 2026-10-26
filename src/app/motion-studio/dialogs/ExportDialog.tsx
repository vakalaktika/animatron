"use client";

import { useState, type ReactNode } from "react";
import { Button, Select } from "@/app/components/shared-components";
import type { RenderOptions } from "../export/VideoExporter";
import type { RenderFormat } from "../export/renderer";
import { CheckIcon, CodeIcon, FileIcon, FilmIcon, ShareIcon } from "../panel/icons";
import { Dialog } from "./Dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  docName: string;
  /** Seconds the recording will run. */
  duration: number;
  /** WebCodecs or a canvas recorder is available: render without screen capture. */
  canRender: boolean;
  /** A see-through WebM can be made (canvas recorder present). */
  canAlpha: boolean;
  /** The stage is see-through, so WebM and GIF can keep the transparency. */
  transparent: boolean;
  stageWidth: number;
  hasSound: boolean;
  onRender: (options: RenderOptions) => void;
  /** Tab capture is available (desktop browsers). */
  canRecord: boolean;
  onRecord: () => void;
  /** Resolves to the link, or a reason it couldn't be made. */
  onShareLink: () => { ok: true; url: string } | { ok: false; reason: string };
  onDownloadJson: () => void;
  onShowCode: () => void;
  onPreview: () => void;
}

function Row({ icon, title, blurb, children }: { icon: ReactNode; title: string; blurb: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-hairline py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-ink-secondary">{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-sm leading-5 text-ink-muted">{blurb}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{children}</div>
    </div>
  );
}

/**
 * Every way the work leaves the studio, with the plain-language ones first.
 * Video records this tab through the browser's own capture, so the steps are
 * spelled out; the share link carries the whole composition in the URL.
 */
export function ExportDialog({ open, onClose, docName, duration, canRender, canAlpha, transparent, stageWidth, hasSound, onRender, canRecord, onRecord, onShareLink, onDownloadJson, onShowCode, onPreview }: Props) {
  const [share, setShare] = useState<{ url?: string; error?: string; copied?: boolean } | null>(null);
  const [format, setFormat] = useState<RenderFormat>("mp4");
  const [gifWidth, setGifWidth] = useState(Math.min(720, stageWidth));
  const formats: { value: RenderFormat; label: string; hint: string }[] = [
    { value: "mp4", label: "MP4", hint: hasSound ? "Video with sound. Plays everywhere." : "Video. Plays everywhere." },
    { value: "gif", label: "GIF", hint: transparent ? "Silent, loops, see-through. For chat, docs and READMEs." : "Silent, loops. For chat, docs and READMEs." },
    ...(transparent && canAlpha ? [{ value: "webm" as const, label: "WebM, see-through", hint: "Keeps the transparency. Renders in real time." }] : []),
  ];
  const gifSizes = [...new Set([480, 720, 1080, stageWidth].filter((w) => w <= stageWidth))].sort((a, b) => a - b);
  // A see-through WebM picked earlier falls back to MP4 once the stage is opaque again.
  const chosen: RenderFormat = formats.some((f) => f.value === format) ? format : "mp4";
  const renderLabel = chosen === "gif" ? "Render GIF" : chosen === "webm" ? "Render WebM" : "Render MP4";

  const makeLink = async () => {
    const result = onShareLink();
    if (!result.ok) {
      setShare({ error: result.reason });
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(result.url);
      copied = true;
    } catch {
      // No clipboard access: the link is shown to copy by hand.
    }
    setShare({ url: result.url, copied });
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setShare(null);
        onClose();
      }}
      title="Share and export"
      description={docName}
      size="md"
    >
      <Row
        icon={<FilmIcon />}
        title="Save a video or GIF"
        blurb={
          canRender
            ? `Renders the composition frame by frame (${duration.toFixed(1)}s) and saves the file, right here in the browser.`
            : canRecord
              ? `Plays the composition once (${duration.toFixed(1)}s) and saves a WebM file. The browser will ask what to capture: pick this tab.`
              : "This browser can't make video files. Share a link, or open the composition in a current Chrome, Edge or Safari."
        }
      >
        <Button size="sm" variant="outline" onClick={onPreview}>
          Preview
        </Button>
        {canRender ? (
          <Button size="sm" onClick={() => onRender({ format: chosen, gifWidth })}>
            {renderLabel}
          </Button>
        ) : (
          <Button size="sm" disabled={!canRecord} onClick={onRecord}>
            Record
          </Button>
        )}
      </Row>
      {canRender && (
        <div className="-mt-2 mb-3 flex flex-col gap-2 sm:pl-14">
          <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-1.5">
            {formats.map((f) => {
              const on = f.value === chosen;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setFormat(f.value)}
                  title={f.hint}
                  className={`atm-chip min-h-8 rounded-full border px-3 font-sans text-[12px] font-semibold tracking-[0.02em] ${
                    on ? "border-primary bg-primary-soft text-ink" : "border-border-control text-ink-secondary hover:bg-surface-sunken hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
            {chosen === "gif" && gifSizes.length > 1 && (
              <label className="ml-auto flex items-center gap-2 font-sans text-[12px] text-ink-secondary">
                Width
                <Select variant="compact" value={String(gifWidth)} onChange={(e) => setGifWidth(Number(e.target.value))} aria-label="GIF width">
                  {gifSizes.map((w) => (
                    <option key={w} value={w}>
                      {w === stageWidth ? `${w} px (full)` : `${w} px`}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
          <p className="text-xs leading-4 text-ink-muted">
            {formats.find((f) => f.value === chosen)?.hint}
            {transparent && chosen === "mp4" ? " MP4 has no transparency: the background renders white." : ""}
            {hasSound && chosen === "gif" ? " The sound is left out of a GIF." : ""}
          </p>
        </div>
      )}
      {canRender && canRecord && (
        <p className="-mt-2 mb-2 text-xs leading-4 text-ink-muted sm:pl-14">
          Prefer a live capture of this tab instead?{" "}
          <button type="button" className="underline decoration-hairline underline-offset-2 hover:text-ink" onClick={onRecord}>
            Record the tab
          </button>
          .
        </p>
      )}
      <Row icon={<ShareIcon />} title="Share a link" blurb="The whole composition travels in the link. Anyone who opens it gets their own copy to edit.">
        <Button size="sm" variant={share?.url ? "outline" : "primary"} onClick={() => void makeLink()} icon={share?.copied ? <CheckIcon width={16} height={16} /> : undefined}>
          {share?.copied ? "Copied" : share?.url ? "Copy again" : "Copy link"}
        </Button>
      </Row>
      <div className="-mt-2 mb-2 min-h-9 sm:pl-14">
        {share?.url && (
          <input
            readOnly
            aria-label="Share link"
            className="w-full rounded-sm border border-border-control bg-surface px-2 py-1.5 font-mono text-xs text-ink"
            value={share.url}
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
        {share?.error && (
          <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-ink">
            {share.error}
          </p>
        )}
      </div>
      <Row icon={<FileIcon />} title="Save a file" blurb="A JSON file of the composition, to keep, back up, or drop back into the studio later.">
        <Button size="sm" variant="outline" onClick={onDownloadJson}>
          Download JSON
        </Button>
      </Row>
      <Row icon={<CodeIcon />} title="For developers" blurb="A React component that plays this composition with the Animatron runtime.">
        <Button size="sm" variant="outline" onClick={onShowCode}>
          View code
        </Button>
      </Row>
    </Dialog>
  );
}
