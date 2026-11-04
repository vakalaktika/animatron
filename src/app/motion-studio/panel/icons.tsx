import type { SVGProps } from "react";

// Atomic Age icon grammar: 24px grid, no fill, currentColor stroke at 1.8,
// round caps and joins. Decorative by default; label the control, not the glyph.
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </Icon>
);

export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={3} />
  </Icon>
);

export const ReplayIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v3.5H8" />
  </Icon>
);

export const MoreIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18" cy="12" r="1.2" fill="currentColor" />
  </Icon>
);

export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Icon>
);

/** Staggered bars on a clock: the timeline. */
export const TimelineIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 7h9M8 12h11M6 17h7" />
    <path d="M17 4v6" strokeWidth={1.4} />
  </Icon>
);

/** Stacked orbits: the clip layers. */
export const LayersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m12 4 8 4-8 4-8-4z" />
    <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
  </Icon>
);

/** Two knobs on tracks: the settings. */
export const SlidersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 8h2.8M11.2 8H20M4 16h8.8M17.2 16H20" />
    <circle cx="9" cy="8" r="2.2" />
    <circle cx="15" cy="16" r="2.2" />
  </Icon>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Icon>
);

/** A frame with its right column filled in: the side panel. */
export const SidePanelIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M14.5 4.5v15" />
  </Icon>
);

/** A frame with its bottom band marked: the timeline panel. */
export const BottomPanelIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 14.5h17" />
  </Icon>
);

/** Corners pushed outward: give the stage the whole screen. */
export const ExpandIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />
  </Icon>
);

/** Corners pulled inward: bring the panels back. */
export const CollapseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5" />
  </Icon>
);

/** The atom mark that stands in for a logo (see the Atomic Age brand book). */
export const AtomMark = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <ellipse cx="12" cy="12" rx="10" ry="4" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
  </Icon>
);

export const SquiggleIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 14c2.5-6 4.5-6 6 0s3.5 6 6 0 4-6 6 0" />
  </Icon>
);

export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4.5 17.5v2h15v-2" />
  </Icon>
);

export const ImageIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17 4.5-4.5 3 3 3-3.5 4.5 5" />
  </Icon>
);

export const WingIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3.5 13c3-6 8-8 17-7-2 5-6 8-12 9l-2 3" />
    <path d="M8.5 15c2-3 5-5 9-6" />
  </Icon>
);

export const SmoothIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 17c5 0 5-10 11-10 2 0 3.5 1 5 3" />
    <circle cx="4" cy="17" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="20" cy="10" r="1.6" fill="currentColor" stroke="none" />
  </Icon>
);

/** Right-pointing chevron; rotate it with .atm-chevron for open/closed. */
export const ChevronIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const EyeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M2.5 12c2.5-4.5 5.7-6.5 9.5-6.5s7 2 9.5 6.5c-2.5 4.5-5.7 6.5-9.5 6.5S5 16.5 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 4l16 16" />
    <path d="M10.2 6.1C10.8 6 11.4 5.9 12 5.9c3.8 0 7 2 9.5 6.1-.9 1.6-1.9 2.9-3 3.9M6.6 7.6C5 8.7 3.6 10.1 2.5 12c2.5 4.1 5.7 6.1 9.5 6.1 1.4 0 2.7-.3 3.9-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12h9.4l.8-12" />
    <path d="M10 10.5v5.5M14 10.5v5.5" />
  </Icon>
);

/** Two overlapping frames: duplicate. */
export const DuplicateIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Icon>
);

export const UndoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 7.5H4.5V4" />
    <path d="M4.8 7.6A8 8 0 1 1 4 12" />
  </Icon>
);

export const RedoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M16 7.5h3.5V4" />
    <path d="M19.2 7.6A8 8 0 1 0 20 12" />
  </Icon>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

/** A serif "T": add text. */
export const TextIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6" />
  </Icon>
);

export const BubbleIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.5L7 19.5v-4H6.5a2 2 0 0 1-2-2z" />
  </Icon>
);

/** A circle over a square: shapes. */
export const ShapesIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="10" width="10" height="10" rx="1.5" />
    <circle cx="15.5" cy="8.5" r="4.5" />
  </Icon>
);

/** Three stacked rings: the logo build. */
export const RingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const HelpIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.4" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

/** Four tiles: the gallery of templates and projects. */
export const GridIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Icon>
);

export const ShareIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 14 14 10" />
    <path d="M13 7.5l1.8-1.8a3.2 3.2 0 0 1 4.5 4.5L17.5 12M11 16.5l-1.8 1.8a3.2 3.2 0 0 1-4.5-4.5L6.5 12" />
  </Icon>
);

/** A film frame: record a video. */
export const FilmIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M7 5.5v13M17 5.5v13M3.5 9.5H7M3.5 14.5H7M17 9.5h3.5M17 14.5h3.5" />
  </Icon>
);

export const CodeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
  </Icon>
);

/** Six dots: a drag grip. */
export const GripIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

/** A frame with corner ticks: the canvas itself. */
export const CanvasIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4.5" y="6" width="15" height="12" rx="1.5" />
    <path d="M2.5 9V4.5H7M17 4.5h4.5V9M21.5 15v4.5H17M7 19.5H2.5V15" strokeWidth={1.2} />
  </Icon>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const ArrowUpIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
);

export const ArrowDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);

/** A pen nib: the Lottie / JSON file import. */
export const FileIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7 3.5h7l4.5 4.5v12.5h-11.5z" />
    <path d="M14 3.5V8h4.5" />
  </Icon>
);

/** Play inside a frame: preview. */
export const PreviewIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M10 9v6l5-3z" fill="currentColor" stroke="none" />
  </Icon>
);

/** A small sprite picture frame with a motion arc: the flying image. */
export const SpriteIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M3.5 13.5C4 8 8 4 13.5 3.5" />
    <path d="M11 3.5h2.5V6" />
  </Icon>
);

/** A bone with a joint at each end: a rigged character. */
export const BonesIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M7.8 7.8l8.4 8.4" />
    <path d="M12 7.5l4.5 4.5" />
  </Icon>
);

/** A pencil: draw by hand. */
export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m4.5 19.5 4.2-.9L19.4 7.9a1.8 1.8 0 0 0 0-2.6l-.7-.7a1.8 1.8 0 0 0-2.6 0L5.4 15.3z" />
    <path d="m14.8 6 3.2 3.2" />
  </Icon>
);

/** A play triangle in a frame: a video layer. */
export const VideoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m10.5 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none" />
  </Icon>
);

/** A note: the composition's sound. */
export const MusicIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9.5 17.5V6.8l10-2.3v10.5" />
    <circle cx="7" cy="17.5" r="2.5" />
    <circle cx="17" cy="15" r="2.5" />
  </Icon>
);

/** Two wavy bars: a GIF or image sequence. */
export const GifIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M8.5 10.5H7a1.5 1.5 0 0 0 0 3h1.5v-1.5M11.5 10.5v3M14 13.5v-3h2.5M14 12h2" />
  </Icon>
);

/** A chequer and a corner: transparency. */
export const AlphaIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M3.5 12h8.5V3.5M12 20.5V12h8.5" />
  </Icon>
);
