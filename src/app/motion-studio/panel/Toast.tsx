"use client";

import { useEffect } from "react";
import { CloseIcon } from "./icons";

export interface ToastMessage {
  id: number;
  text: string;
  /** A single follow-up, typically Undo. */
  action?: { label: string; run: () => void };
  /** Keep it up until dismissed (errors that need reading). */
  sticky?: boolean;
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 5000;

/**
 * One quiet notice at a time, bottom centre over the stage, with room for a
 * single action. Replaces the status line that used to sit at the foot of
 * the settings panel, where nobody looked.
 */
export function Toast({ toast, onDismiss }: Props) {
  useEffect(() => {
    if (!toast || toast.sticky) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-[70] flex justify-center px-4 lg:bottom-6">
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="atm-toast pointer-events-auto flex max-w-[min(560px,100%)] items-center gap-3 rounded-md border border-border-strong bg-surface-inverse py-2 pr-1 pl-4 text-sm text-ink-on-inverse shadow-lg"
        >
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="atm-button-type shrink-0 rounded-md px-2.5 py-1.5 text-[12px] text-highlight hover:bg-white/10"
              onClick={() => {
                toast.action?.run();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-on-inverse/70 hover:bg-white/10 hover:text-ink-on-inverse"
            onClick={() => onDismiss(toast.id)}
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      )}
    </div>
  );
}
