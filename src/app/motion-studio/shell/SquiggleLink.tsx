"use client";

import Link from "next/link";
import { SquiggleIcon } from "../panel/icons";

/** App-bar link to the Squiggle Studio, in the same 44px frame as the icon buttons beside it. */
export function SquiggleLink({ className = "" }: { className?: string }) {
  const label = "Open the Squiggle Studio";
  return (
    <Link
      href="/squiggle"
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink ${className}`}
    >
      <SquiggleIcon />
    </Link>
  );
}
