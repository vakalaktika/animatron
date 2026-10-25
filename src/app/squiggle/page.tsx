"use client";

import dynamic from "next/dynamic";

// The drawing studio restores its browser-local session. Mount only on the
// client so saved squiggles cannot disagree with static exported HTML.
const SquiggleStudio = dynamic(
  () => import("../squiggle-studio/SquiggleStudio").then((module) => module.SquiggleStudio),
  { ssr: false, loading: () => <p role="status">Loading Squiggle Studio…</p> },
);

export default function Page() {
  return <SquiggleStudio />;
}
