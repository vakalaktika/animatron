"use client";

import { Button } from "@/app/components/shared-components";
import { Dialog } from "./Dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Replays the first-run tour. */
  onTour: () => void;
  /** Mac shows ⌘, everything else Ctrl. */
  mac: boolean;
}

const tips = (mac: boolean): [string, string][] => [
  ["Pick anything on the canvas", `Tap or click it, then change it in the settings panel. Drag it to move it; it snaps to the middle and to other layers (hold ${mac ? "Option" : "Alt"} to skip). Drag a corner to resize, the handle above to turn it. Shift-click to pick several at once.`],
  ["Draw a line", "Pick the pen in the add bar and draw on the canvas: a ribbon appears where you drew. Pick a picture first and your line becomes its flight path."],
  ["Shape a path", "Select a picture or ribbon and drag its numbered dots. Press W to drop a new point wherever the picture is right now."],
  ["Make something ride along", "In Position and timing, open \"Follow another clip\". Text can even ride the tip of a ribbon as it draws, or turn on \"Write along the ribbon\" to bend its letters along the curve."],
  ["Change when things happen", "Drag a bar on the timeline to move it, or drag its right end to make it longer or shorter."],
  ["Add video and sound", "Drop in an MP4 or MOV with the picture tool: a landscape one becomes the backdrop. Add one music or voice track with the Sound tool; it plays in the preview and is baked into rendered videos."],
  ["Pose a rigged character", "Drop in a Mid-century Ink rig (.mci.json) with the picture tool. Drag a joint on the canvas to bend a limb or a bone tip to turn it; with a clip playing, each move becomes a key at the playhead. Save rig writes the master back out for Agent Torres."],
  ["Save as MP4 or GIF", "Share renders the file right here, even with the tab in the background. A see-through canvas can come out as a transparent GIF or WebM."],
  ["Nothing is lost", "Every change can be undone, and each composition autosaves in this browser. Find them all under Compositions."],
];

/** Keyboard shortcuts and the five things worth knowing, in one place. */
export function HelpDialog({ open, onClose, onTour, mac }: Props) {
  const mod = mac ? "⌘" : "Ctrl";
  const shortcuts: [string, string][] = [
    ["Space", "Play or pause"],
    ["R", "Play from the start"],
    [`${mod} Z`, "Undo"],
    [`${mod} ⇧ Z`, "Redo"],
    [`${mod} D`, "Duplicate the selected layer"],
    [`${mod} C · ${mod} V`, "Copy and paste a layer"],
    ["← ↑ → ↓", "Nudge by 1 px (⇧ for 10)"],
    ["Delete", "Remove the selected layer or path point"],
    ["W", "Add a path point where the picture is"],
    ["Esc", "Stop drawing, deselect, or leave the preview"],
    ["?", "This sheet"],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Help" description="How the studio works, and the keys that speed it up." size="lg">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="help-tips">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="help-tips" className="atm-section-label">
              Good to know
            </h3>
            <Button size="xs" variant="outline" onClick={onTour}>
              Show the tour
            </Button>
          </div>
          <ol className="flex flex-col gap-4">
            {tips(mac).map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft font-sans text-[12px] font-semibold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-ink">{title}</h4>
                  <p className="mt-0.5 text-sm leading-5 text-ink-secondary">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="help-keys">
          <h3 id="help-keys" className="atm-section-label mb-3">
            Keyboard
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {shortcuts.map(([keys, what]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="inline-block rounded-sm border border-border-control bg-surface px-1.5 py-0.5 font-sans text-[12px] font-semibold tracking-[0.04em] text-ink-secondary">{keys}</kbd>
                </dt>
                <dd className="self-center text-ink-secondary">{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Dialog>
  );
}
