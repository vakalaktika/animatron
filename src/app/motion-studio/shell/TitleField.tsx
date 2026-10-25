"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** Shown faintly beside the name: "Saved", "Saving…". */
  status?: string;
  compact?: boolean;
}

/**
 * The composition's name as plain text that becomes a field when clicked:
 * the one place to rename, visible on every screen. Enter or blur commits,
 * Escape puts the old name back.
 */
export function TitleField({ value, onChange, status, compact = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== value) onChange(name);
    setEditing(false);
  };

  const text = compact ? "text-[17px]" : "text-base";
  return (
    <div className="flex min-w-0 items-center gap-2">
      {editing ? (
        <input
          ref={inputRef}
          aria-label="Composition name"
          className={`min-w-0 flex-1 rounded-sm border border-primary bg-surface-raised px-1.5 py-0.5 font-display ${text} font-semibold tracking-[-0.01em] text-ink focus:outline-none`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          title="Rename"
          onClick={() => setEditing(true)}
          className={`-mx-1.5 min-w-0 truncate rounded-sm border border-transparent px-1.5 py-0.5 text-left font-display ${text} font-semibold tracking-[-0.01em] text-ink transition-colors duration-150 hover:border-hairline hover:bg-surface`}
        >
          {value}
        </button>
      )}
      {status && !compact && (
        <span aria-live="polite" className="shrink-0 font-sans text-[11px] tracking-[0.04em] text-ink-muted">
          {status}
        </span>
      )}
    </div>
  );
}
