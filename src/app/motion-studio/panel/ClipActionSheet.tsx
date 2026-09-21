"use client";

import { useEffect, useRef } from "react";
import type { Clip } from "@/app/components/motion-studio/types";

interface Props {
  clip: Clip | null;
  onClose: () => void;
  onSolo: (id: string) => void;
  onDuplicate: (clip: Clip) => void;
  onDelete: (id: string) => void;
  /** Keyboard / screen-reader path for restacking, which the row hides on phones. */
  onMoveSibling: (id: string, direction: -1 | 1) => void;
}

/**
 * Phone-sized home for a clip's row actions: a bottom action sheet in thumb
 * reach, so the row itself can give its width to the clip name. A native
 * modal <dialog> traps focus, closes on Escape, and hands focus back to the
 * button that opened it; tapping the backdrop closes it too.
 */
export function ClipActionSheet({ clip, onClose, onSolo, onDuplicate, onDelete, onMoveSibling }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (clip && !dialog.open) dialog.showModal();
    if (!clip && dialog.open) dialog.close();
  }, [clip]);

  const act = (run: () => void) => () => {
    run();
    onClose();
  };

  const item =
    "flex min-h-13 w-full items-center px-5 text-left text-base transition-colors duration-150 hover:bg-surface-sunken";

  return (
    <dialog
      ref={ref}
      aria-label={clip ? `${clip.name} actions` : "Clip actions"}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="atm-sheet fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-2xl border-t border-border-strong bg-surface-raised p-0 pb-[env(safe-area-inset-bottom)] text-ink shadow-lg"
    >
      {clip && (
        <div className="flex flex-col">
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-border-strong" />
          <p className="truncate px-5 pt-3 pb-2 font-display text-lg font-semibold">
            {clip.name} <span className="font-body text-sm font-normal text-ink-muted">{clip.type}</span>
          </p>
          <div className="flex flex-col border-t border-hairline py-1">
            <button type="button" className={`${item} text-ink`} onClick={act(() => onSolo(clip.id))}>
              Show only this clip
            </button>
            <button type="button" className={`${item} text-ink`} onClick={act(() => onDuplicate(clip))}>
              Duplicate
            </button>
            <button type="button" className={`${item} text-ink`} onClick={act(() => onMoveSibling(clip.id, -1))}>
              Move up
            </button>
            <button type="button" className={`${item} text-ink`} onClick={act(() => onMoveSibling(clip.id, 1))}>
              Move down
            </button>
            <button type="button" className={`${item} text-error`} onClick={act(() => onDelete(clip.id))}>
              Delete clip
            </button>
          </div>
          <div className="border-t border-hairline p-3">
            <button
              type="button"
              className="atm-button-type min-h-12 w-full rounded-md border border-border-control text-sm text-ink hover:bg-surface-sunken"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
