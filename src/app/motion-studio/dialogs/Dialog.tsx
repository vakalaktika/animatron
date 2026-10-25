"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "../shell/IconButton";
import { CloseIcon } from "../panel/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line under the title. */
  description?: string;
  /** Controls that sit in the header next to the close button. */
  headerActions?: ReactNode;
  size?: "md" | "lg" | "full";
  children: ReactNode;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  md: "lg:w-[520px]",
  lg: "lg:w-[880px]",
  full: "lg:w-[min(1120px,calc(100vw-48px))]",
};

/**
 * The studio's one dialog: a native modal <dialog> (focus trap, Escape and
 * backdrop to close, focus restored) that rises as a sheet on phones and
 * sits centred on desktop. Content scrolls inside; the header stays put.
 */
export function Dialog({ open, onClose, title, description, headerActions, size = "md", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`atm-sheet fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none flex-col rounded-t-2xl border-t border-border-strong bg-surface-raised p-0 pb-[env(safe-area-inset-bottom)] text-ink shadow-lg open:flex lg:inset-auto lg:top-1/2 lg:left-1/2 lg:max-h-[min(86dvh,900px)] lg:max-w-[calc(100vw-48px)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-lg lg:border ${SIZE[size]}`}
    >
      {open && (
        <>
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border-strong lg:hidden" />
          <header className="flex shrink-0 items-start gap-3 border-b border-hairline py-3 pr-2 pl-5 lg:py-4 lg:pl-6">
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="truncate font-display text-xl font-semibold tracking-[-0.01em]">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
            </div>
            {headerActions}
            <IconButton label="Close" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 lg:p-6">{children}</div>
        </>
      )}
    </dialog>
  );
}
