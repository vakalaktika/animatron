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
