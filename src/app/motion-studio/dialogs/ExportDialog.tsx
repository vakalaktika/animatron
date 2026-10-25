"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/app/components/shared-components";
import { CheckIcon, CodeIcon, FileIcon, FilmIcon, ShareIcon } from "../panel/icons";
import { Dialog } from "./Dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  docName: string;
  /** Seconds the recording will run. */
  duration: number;
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
export function ExportDialog({ open, onClose, docName, duration, canRecord, onRecord, onShareLink, onDownloadJson, onShowCode, onPreview }: Props) {
  const [share, setShare] = useState<{ url?: string; error?: string; copied?: boolean } | null>(null);

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
      <Row icon={<FilmIcon />} title="Record a video" blurb={canRecord ? `Plays the composition once (${duration.toFixed(1)}s) and saves a WebM file. The browser will ask what to capture: pick this tab.` : "Video recording needs a desktop browser. Open this composition on a computer, or share a link instead."}>
        <Button size="sm" variant="outline" onClick={onPreview}>
          Preview
        </Button>
        <Button size="sm" disabled={!canRecord} onClick={onRecord}>
          Record
        </Button>
      </Row>
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
