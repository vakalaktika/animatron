"use client";

import { useState } from "react";

/** Copies the short link; when the clipboard is off limits, shows it to copy by hand. */
export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("manual");
    }
  };
  return (
    <>
      <button type="button" className="share-button share-button-outline" onClick={() => void copy()} aria-live="polite">
        {state === "copied" ? "Copied" : "Copy link"}
      </button>
      {state === "manual" && <input readOnly aria-label="Share link" className="share-manual" value={url} onFocus={(e) => e.currentTarget.select()} />}
    </>
  );
}
