"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/app/components/shared-components";

export interface TourStep {
  /** Matches a `data-tour` attribute on the thing to point at. */
  target: string;
  title: string;
  body: string;
}

export const TOUR_KEY = "animatron.tour.v1";

export const TOUR_STEPS: TourStep[] = [
  { target: "add", title: "Add things here", body: "Text, shapes, pictures, video, a ribbon, Chippy. Everything lands on the canvas ready to move and resize." },
  { target: "scrub", title: "Scrub through time", body: "Drag the scrubber to see any moment. Each layer has a bar in the timeline: drag it to change when it comes in, drag its end to change how long it runs." },
  { target: "share", title: "Share or save when you're done", body: "Render an MP4 or GIF right here in the browser, copy a link that carries the whole piece, or download the JSON." },
];

export function tourSeen(): boolean {
  try {
    return window.localStorage.getItem(TOUR_KEY) === "done";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_KEY, "done");
  } catch {
    // Private mode: the tour shows again next time, which is fine.
  }
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 300;
const GAP = 14;

function measure(target: string): Rect | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  const visible = els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  });
  if (!visible) return null;
  const r = visible.getBoundingClientRect();
  return { x: r.left - PAD, y: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

/** Where the card goes: beside the spot if there is room, else below or above it, always inside the viewport. */
function place(spot: Rect | null): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardH = 190;
  if (!spot) return { left: Math.max(16, (vw - CARD_W) / 2), top: Math.max(16, (vh - cardH) / 2) };
  const clampX = (x: number) => Math.min(vw - CARD_W - 16, Math.max(16, x));
  const clampY = (y: number) => Math.min(vh - cardH - 16, Math.max(16, y));
  if (spot.x + spot.width + GAP + CARD_W <= vw - 16) return { left: spot.x + spot.width + GAP, top: clampY(spot.y) };
  if (spot.x - GAP - CARD_W >= 16) return { left: spot.x - GAP - CARD_W, top: clampY(spot.y) };
  if (spot.y + spot.height + GAP + cardH <= vh - 16) return { left: clampX(spot.x), top: spot.y + spot.height + GAP };
  return { left: clampX(spot.x), top: clampY(spot.y - GAP - cardH) };
}

/**
 * A three-stop walk through the studio on the first visit: a spotlight on
 * the thing, a short card beside it. Follows the layout, so it points at
 * the rail on a desktop and the + button on a phone.
 */
export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    const update = () => setSpot(measure(step.target));
    update();
    window.addEventListener("resize", update);
    const timer = window.setInterval(update, 400);
    return () => {
      window.removeEventListener("resize", update);
      window.clearInterval(timer);
    };
  }, [step.target]);

  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      // Keep Tab inside the card while the rest of the page is dimmed.
      if (e.key === "Tab" && cardRef.current) {
        const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>("button, [tabindex]:not([tabindex='-1'])"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!cardRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone, steps.length]);

  const last = index === steps.length - 1;
  const pos = typeof window === "undefined" ? { left: 16, top: 16 } : place(spot);
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      <button type="button" aria-label="Skip the tour" className="absolute inset-0 cursor-default" onClick={onDone} />
      <div
        aria-hidden="true"
        className="atm-spot pointer-events-none absolute rounded-lg border-2 border-primary"
        style={spot ? { left: spot.x, top: spot.y, width: spot.width, height: spot.height } : { left: "50%", top: "50%", width: 0, height: 0 }}
      />
      <div
        key={index}
        ref={cardRef}
        className="atm-tour-card absolute flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-raised p-4 shadow-lg"
        style={{ left: pos.left, top: pos.top, width: Math.min(CARD_W, window.innerWidth - 32) }}
      >
        <p className="font-sans text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
          {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="font-display text-lg leading-6 font-semibold text-ink">
          {step.title}
        </h2>
        <p id="tour-body" className="text-sm leading-5 text-ink-secondary">
          {step.body}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Button size="sm" onClick={() => (last ? onDone() : setIndex(index + 1))}>
            {last ? "Start making" : "Next"}
          </Button>
          {index > 0 && (
            <Button size="sm" variant="outline" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          {!last && (
            <button type="button" className="ml-auto font-sans text-[12px] font-semibold text-ink-secondary underline decoration-hairline underline-offset-2 hover:text-ink" onClick={onDone}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
