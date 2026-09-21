"use client";

import dynamic from "next/dynamic";

// The editor restores browser-local documents and presets. Mount only on the
// client so a saved composition cannot disagree with static exported HTML.
const MotionStudio = dynamic(
  () => import("./motion-studio/MotionStudio").then((module) => module.MotionStudio),
  { ssr: false, loading: () => <p role="status">Loading Animatron…</p> },
);

export default function Page() {
  return <MotionStudio />;
}
