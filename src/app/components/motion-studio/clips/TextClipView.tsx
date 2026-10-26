"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LOGO_RAINBOW } from "../assets/logoPaths";
import { clamp01, EASE_PRESETS } from "../engine/easing";
import { caretAfter, glyphLook, glyphProgress, resolveTail, revealTransform, type ResolvedTail } from "../engine/text";
import { propValue } from "../engine/keys";
import { flowRibbon, flowSeats, type GlyphSeat } from "../engine/textFlow";
import type { RibbonClip, StudioDoc, TextClip } from "../types";

interface Props {
  clip: TextClip;
  doc: StudioDoc;
  time: MotionValue<number>;
}

const RAINBOW_RULE = `linear-gradient(90deg, ${LOGO_RAINBOW.join(", ")})`;
const SQRT2 = Math.SQRT2;
/** Floor on the clip scale divided out of flowing glyph seats. */
const MIN_FLOW_SCALE = 0.01;

const FONT_STYLE: Record<TextClip["font"], CSSProperties> = {
  sans: { fontFamily: "var(--font-work-sans), Arial, sans-serif", fontWeight: 500, letterSpacing: "0.01em" },
  serif: { fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 600, letterSpacing: "-0.01em" },
};

const SHADOW: Record<TextClip["container"]["shape"], string> = {
  none: "",
  speech: "shadow-md",
  soft: "shadow-sm",
  minimal: "",
  thought: "shadow-md",
};

interface GlyphProps {
  clip: TextClip;
  time: MotionValue<number>;
  index: number;
  count: number;
  letter: string;
  accent: boolean;
}

/**
 * One glyph arriving per the clip's reveal. The outer box clips it for the
 * mask reveal (it slides up from behind its own slot) and carries the
 * typing caret on its right edge.
 */
function Glyph({ clip, time, index, count, letter, accent }: GlyphProps) {
  const look = useTransform(time, (t) => glyphLook(clip.reveal, glyphProgress(clip, index, count, t)));
  const opacity = useTransform(look, (l) => l.opacity);
  const transform = useTransform(look, (l) => (l.drop || l.rise ? `translateY(${l.drop * 100}%) translateY(${l.rise}px)` : "none"));
  const filter = useTransform(look, (l) => (l.blur > 0 ? `blur(${l.blur}px)` : "none"));
  const caret = useTransform(time, (t) => (caretAfter(clip, count, t) === index ? 1 : 0));

  return (
    <span aria-hidden="true" className={`relative inline-block ${clip.reveal === "mask" ? "overflow-hidden" : ""}`}>
      <motion.span className="inline-block" style={{ color: accent ? clip.accentColor : undefined, opacity, transform, filter }}>
        {letter === " " ? "\u00a0" : letter}
      </motion.span>
      {clip.reveal === "typewriter" && (
        <motion.span className="absolute bottom-[0.12em] right-[-0.08em] top-[0.12em] w-[0.06em] bg-current" style={{ opacity: caret }} />
      )}
    </span>
  );
}

/** Box placement so that the tail tip sits on the clip origin. */
function boxOffset(tail: ResolvedTail): CSSProperties {
  switch (tail.side) {
    case "bottom":
      return { left: -tail.position, bottom: tail.length };
    case "top":
      return { left: -tail.position, top: tail.length };
    case "left":
      return { top: -tail.position, left: tail.length };
    case "right":
      return { top: -tail.position, right: tail.length };
  }
}

/** A rotated square whose outer corner is the tail tip, sharing the box's border. */
function SpeechTail({ tail, fill, stroke }: { tail: ResolvedTail; fill: string; stroke: string }) {
  const side = tail.length * SQRT2;
  const half = side / 2;
  const centre = tail.position - half;
  const style: CSSProperties = { width: side, height: side, backgroundColor: fill, borderColor: stroke };
  const place: Record<ResolvedTail["side"], CSSProperties> = {
    bottom: { left: centre, bottom: -half, borderBottomWidth: 1, borderRightWidth: 1 },
    top: { left: centre, top: -half, borderTopWidth: 1, borderLeftWidth: 1 },
    left: { top: centre, left: -half, borderLeftWidth: 1, borderBottomWidth: 1 },
    right: { top: centre, right: -half, borderTopWidth: 1, borderRightWidth: 1 },
  };
  return <span aria-hidden="true" className="absolute block rotate-45 border-solid" style={{ ...style, ...place[tail.side] }} />;
}

/** Three shrinking circles trailing from the box edge toward the tip. */
function ThoughtTail({ tail, fill, stroke }: { tail: ResolvedTail; fill: string; stroke: string }) {
  const dots = [0.45, 0.28, 0.16];
  return (
    <>
      {dots.map((size, i) => {
        const along = ((i + 0.5) / dots.length) * tail.length;
        const d = Math.max(4, tail.length * size);
        const style: CSSProperties = {
          width: d,
          height: d,
          backgroundColor: fill,
          borderColor: stroke,
          borderWidth: 1,
        };
        const place: Record<ResolvedTail["side"], CSSProperties> = {
          bottom: { left: tail.position - d / 2, bottom: -along - d / 2 },
          top: { left: tail.position - d / 2, top: -along - d / 2 },
          left: { top: tail.position - d / 2, left: -along - d / 2 },
          right: { top: tail.position - d / 2, right: -along - d / 2 },
        };
        return <span key={i} aria-hidden="true" className="absolute block rounded-full border-solid" style={{ ...style, ...place[tail.side] }} />;
      })}
    </>
  );
}

/** Index of the first glyph in the highlighted ending (the count when there is none). */
function accentStart(clip: TextClip, letters: string[]): number {
  return clip.accentSuffix && clip.text.endsWith(clip.accentSuffix)
    ? letters.length - Array.from(clip.accentSuffix).length
    : letters.length;
}

/**
 * Text with an optional container and tail. Drawn so the clip origin is the
 * tail tip when a tail shows, otherwise the top centre of the box. Pop and
 * fade reveals are part of the clip's transform in the engine; the other
 * reveals animate each glyph here. Text flowing along its ribbon parent is
 * laid out glyph by glyph instead (see `FlowingText`).
 */
export function TextClipView({ clip, doc, time }: Props) {
  const ribbon = flowRibbon(doc, clip);
  return ribbon ? <FlowingText clip={clip} ribbon={ribbon} time={time} /> : <TextBlock clip={clip} doc={doc} time={time} />;
}

function TextBlock({ clip, doc, time }: Props) {
  const letters = Array.from(clip.text);
  const accent = accentStart(clip, letters);
  const ruleAt = clip.start + clip.ruleDelay;
  const ruleProgress = useTransform(time, (t) =>
    EASE_PRESETS.smoothOut(clamp01((t - ruleAt) / Math.max(0.001, clip.ruleDuration))),
  );
  const ruleOpacity = useTransform(ruleProgress, (p) => clamp01(p * 4));

  const { container } = clip;
  const boxed = container.shape !== "none";
  const tail = resolveTail(doc, clip);
  const placement: CSSProperties = tail ? boxOffset(tail) : { left: 0, top: 0, translate: "-50% 0" };
  const boxStyle: CSSProperties = boxed
    ? {
        backgroundColor: container.fill,
        borderColor: container.stroke,
        borderWidth: 1,
        borderRadius: container.radius,
        padding: `${container.padding.y}px ${container.padding.x}px`,
      }
    : {};

  return (
    <div
      className={`absolute flex flex-col items-center whitespace-nowrap ${boxed ? `border-solid ${SHADOW[container.shape]}` : ""}`}
      style={{ ...placement, ...boxStyle }}
    >
      <p className="flex" style={{ ...FONT_STYLE[clip.font], fontSize: clip.fontSize, color: clip.color }}>
        <span className="sr-only">{clip.text}</span>
        {letters.map((letter, i) => (
          <Glyph key={i} clip={clip} index={i} count={letters.length} letter={letter} accent={i >= accent} time={time} />
        ))}
      </p>
      {clip.rule && (
        <motion.span
          aria-hidden="true"
          className="mt-3 block h-[2px] rounded-full"
          style={{
            width: clip.ruleWidth,
            background: RAINBOW_RULE,
            transformOrigin: "50% 50%",
            scaleX: ruleProgress,
            opacity: ruleOpacity,
          }}
        />
      )}
      {tail && container.shape === "thought" && <ThoughtTail tail={tail} fill={container.fill} stroke={container.stroke} />}
      {tail && container.shape !== "thought" && <SpeechTail tail={tail} fill={container.fill} stroke={container.stroke} />}
    </div>
  );
}

interface FlowProps {
  clip: TextClip;
  ribbon: RibbonClip;
  time: MotionValue<number>;
}

/**
 * Text set along its ribbon parent. The clip's frame sits on the ribbon's
 * anchor (engine/transform.ts), so each glyph is placed at its seat divided
 * by the clip's own scale and turned to the ribbon there. Glyph widths come
 * from an invisible row of the same glyphs, re-measured once web fonts load.
 * Every glyph is a direct child of the clip element so the selection box
 * wraps the run itself; the hidden row has no size and is skipped.
 */
function FlowingText({ clip, ribbon, time }: FlowProps) {
  const letters = Array.from(clip.text);
  const accent = accentStart(clip, letters);
  const rowRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let live = true;
    const measure = () => {
      if (live) setWidths(Array.from(row.children, (c) => (c as HTMLElement).offsetWidth));
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [clip.text, clip.font, clip.fontSize]);

  const seats = useTransform(time, (t) => (widths ? flowSeats(clip, ribbon, widths, t) : []));
  const pop = useTransform(time, (t) => revealTransform(clip, t).scale);
  const size = useTransform(time, (t) => propValue(clip, "scale", t));
  const font: CSSProperties = { ...FONT_STYLE[clip.font], fontSize: clip.fontSize, color: clip.color };

  return (
    <>
      <span className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden whitespace-nowrap" style={font}>
        <span className="sr-only visible">{clip.text}</span>
        <span ref={rowRef} aria-hidden="true">
          {letters.map((letter, i) => (
            <span key={i} className="inline-block">
              {letter === " " ? "\u00a0" : letter}
            </span>
          ))}
        </span>
      </span>
      {widths &&
        letters.map((letter, i) => (
          <SeatedGlyph key={i} index={i} seats={seats} pop={pop} size={size} style={font}>
            <Glyph clip={clip} index={i} count={letters.length} letter={letter} accent={i >= accent} time={time} />
          </SeatedGlyph>
        ))}
    </>
  );
}

interface SeatedGlyphProps {
  index: number;
  seats: MotionValue<GlyphSeat[]>;
  pop: MotionValue<number>;
  /** The clip's own size, divided out so the seat lands on the ribbon. */
  size: MotionValue<number>;
  style: CSSProperties;
  children: ReactNode;
}

function SeatedGlyph({ index, seats, pop, size, style, children }: SeatedGlyphProps) {
  const transform = useTransform(() => {
    const seat = seats.get()[index];
    if (!seat) return "none";
    const s = Math.max(MIN_FLOW_SCALE, size.get());
    return `translate(${seat.x / s}px, ${seat.y / s}px) translate(-50%, -50%) rotate(${seat.angle}deg) scale(${pop.get()})`;
  });
  const opacity = useTransform(seats, (all) => (all[index]?.onPath ? 1 : 0));
  return (
    <motion.span aria-hidden="true" className="absolute left-0 top-0 whitespace-nowrap" style={{ ...style, transform, opacity }}>
      {children}
    </motion.span>
  );
}
