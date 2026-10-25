"use client";

import { useEffect, useRef } from "react";
import type { Clip } from "@/app/components/motion-studio/types";

interface Props {
  clip: Clip | null;
  onClose: () => void;
  onRename: (clip: Clip) => void;
  onSolo: (id: string) => void;
  onDuplicate: (clip: Clip) => void;
  onDelete: (id: string) => void;
  /** Keyboard / screen-reader path for restacking, which the row hides on phones. */
  onMoveSibling: (id: string, direction: -1 | 1) => void;
}

/**
 * The rest of a layer's actions: a bottom sheet in thumb reach on phones and
 * the overflow menu on desktop, so the row itself can give its width to the name. A native
 * modal <dialog> traps focus, closes on Escape, and hands focus back to the
 * button that opened it; tapping the backdrop closes it too.
 */
export function ClipActionSheet({ clip, onClose, onRename, onSolo, onDuplicate, onDelete, onMoveSibling }: Props) {
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
      className="atm-sheet fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-2xl border-t border-border-strong bg-surface-raised p-0 pb-[env(safe-area-inset-bottom)] text-ink shadow-lg lg:inset-auto lg:top-1/2 lg:left-1/2 lg:w-80 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-lg lg:border"
    >
      {clip && (
        <div className="flex flex-col">
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-border-strong" />
          <p className="truncate px-5 pt-3 pb-2 font-display text-lg font-semibold">
            {clip.name}
          </p>
          <div className="flex flex-col border-t border-hairline py-1">
            <button type="button" className={`${item} text-ink`} onClick={act(() => onRename(clip))}>
              Rename
            </button>
            <button type="button" className={`${item} text-ink`} onClick={act(() => onSolo(clip.id))}>
              Show only this layer
            </button>
            <button type="button" className={`${item} text-ink`} onClick={act(() => onDuplicate(clip))}>
              Duplicate
            </button>
            <button type="button" className={`${item} text-ink`} onClick={act(() => onMoveSibling(clip.id, -1))}>
              Move up (paints underneath)
            </button>
            <button type="button" className={`${item} text-ink`} onClick={act(() => onMoveSibling(clip.id, 1))}>
              Move down (paints on top)
            </button>
            <button type="button" className={`${item} text-error`} onClick={act(() => onDelete(clip.id))}>
              Delete
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
