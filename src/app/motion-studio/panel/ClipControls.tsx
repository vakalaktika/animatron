"use client";

import type { MotionValue } from "motion/react";
import { capabilities } from "@/app/components/motion-studio/engine/capabilities";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import { PanelGroup, type PanelSection } from "./PanelGroup";
import { outlinedSvgSection, rasterSection, textRunsSection, videoSection, type ArtworkActions } from "./sections/artwork";
import { buildSections } from "./sections/logo";
import { lineSection } from "./sections/line";
import { playbackSection } from "./sections/lottie";
import { ribbonPointsSection, ribbonSection } from "./sections/ribbon";
import { rigAnimationSection, skeletonSection, type RigActions } from "./sections/rig";
import { placementSection } from "./sections/placement";
import { flapSection, landingSection, motionSection, pathSection, type WaypointControls } from "./sections/sprite";
import { containerSection, revealSection, textSection } from "./sections/text";
import { trailSection } from "./sections/trail";

interface Props {
  doc: StudioDoc;
  clip: Clip;
  onChange: (next: Clip) => void;
  /** Attach to another clip (or detach with null). Keeps the clip where it is on stage. */
  onReparent: (parentId: string | null) => void;
  /** Focus the text field on mount (a clip the user just added). */
  focusText?: boolean;
  /** Imported-artwork actions that add or remove clips, so they live with the document. */
  artwork: ArtworkActions;
  /** Waypoint selection and add / remove, shared with the stage and the W key. */
  waypoints: WaypointControls;
  /** Rig posing and joint editing state, shared with the stage. */
  rig: RigActions;
  /** The studio clock: keyframed fields read and key at the playhead. */
  time: MotionValue<number>;
}

/**
 * Every clip's settings as collapsible, reorderable panels. Which sections
 * appear comes from the clip's capabilities, never from its type. Layout is
 * remembered per section id, so putting Reveal first sticks for any clip
 * that has a Reveal section.
 */
export function ClipControls({ doc, clip, onChange, onReparent, focusText = false, artwork, waypoints, rig, time }: Props) {
  const caps = capabilities(clip);
  const sections: (PanelSection | null)[] = [
    // What the thing says comes before where it sits.
    caps.text && textSection(caps.text, onChange, focusText),
    // A video's own settings come first: the file is the point of the layer.
    caps.video && videoSection(caps.video, onChange, doc.stage),
    // A rig's clips come first: which one plays decides what you see.
    caps.rig && rigAnimationSection(caps.rig, onChange, rig),
    caps.rig && skeletonSection(caps.rig, onChange, rig),
    placementSection(doc, clip, onChange, onReparent, time),
    caps.reveal && revealSection(caps.reveal, onChange),
    caps.container && containerSection(caps.container, onChange),
    caps.motion && motionSection(caps.motion, onChange),
    caps.path && pathSection(caps.path, onChange, waypoints),
    caps.trail && trailSection(caps.trail, onChange),
    caps.line?.type === "sprite" ? lineSection(caps.line, onChange) : null,
    caps.flap && flapSection(caps.flap, onChange),
    caps.landing && landingSection(caps.landing, onChange),
    ...(caps.build ? buildSections(caps.build, onChange) : []),
    caps.playback && playbackSection(caps.playback, onChange),
    caps.ribbon && ribbonSection(caps.ribbon, onChange),
    caps.line?.type === "ribbon" ? lineSection(caps.line, onChange) : null,
    caps.ribbon && ribbonPointsSection(caps.ribbon, onChange),
    caps.textRuns && textRunsSection(caps.textRuns, artwork),
    caps.outlinedSvg && outlinedSvgSection(),
    caps.raster && rasterSection(caps.raster, artwork),
  ];
  return <PanelGroup storageKey="clip" sections={sections.filter((s): s is PanelSection => s !== null)} />;
}
