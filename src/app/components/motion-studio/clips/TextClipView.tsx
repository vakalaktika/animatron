"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { LOGO_RAINBOW } from "../assets/logoPaths";
import { clamp01, EASE_PRESETS, lerp } from "../engine/easing";
import { resolveTail, type ResolvedTail } from "../engine/text";
import type { StudioDoc, TextClip } from "../types";

interface Props {
  clip: TextClip;
  doc: StudioDoc;
  time: MotionValue<number>;
}

const RAINBOW_RULE = `linear-gradient(90deg, ${LOGO_RAINBOW.join(", ")})`;
const SQRT2 = Math.SQRT2;

const FONT_STYLE: Record<TextClip["font"], CSSProperties> = {
  sans: { fontFamily: "var(--font-work-sans), Arial, sans-serif", fontWeight: 500, letterSpacing: "0.01em" },
  serif: { fontFamily: "var(--font-gelasio), Georgia, serif", fontWeight: 600, letterSpacing: "-0.01em" },
};

const SHADOW: Record<TextClip["container"]["shape"], string> = {
  none: "",
  speech: "shadow-md",
  soft: "shadow-sm",
  minimal: "",
  thought: "shadow-md",
};

function letterDelay(clip: TextClip, index: number, count: number): number {
  const center = (count - 1) / 2;
  const order =
    clip.direction === "center"
      ? Math.abs(index - center)
      : clip.direction === "left"
        ? index
        : count - 1 - index;
  return order * clip.letterStagger;
}

function Letter({
  clip,
  index,
  count,
  letter,
  accent,
  time,
}: Omit<Props, "doc"> & { index: number; count: number; letter: string; accent: boolean }) {
  const at = clip.start + letterDelay(clip, index, count);
  const progress = useTransform(time, (t) =>
    EASE_PRESETS.smoothOut(clamp01((t - at) / Math.max(0.001, clip.letterDuration))),
  );
  const y = useTransform(progress, (p) => lerp(8, 0, p));
  const filter = useTransform(progress, (p) => `blur(${lerp(2, 0, p)}px)`);

  return (
    <motion.span
      aria-hidden="true"
      className="inline-block"
      style={{ color: accent ? clip.accentColor : undefined, opacity: progress, y, filter }}
    >
      {letter === " " ? " " : letter}
    </motion.span>
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

/**
 * Text with an optional container and tail. Drawn so the clip origin is the
 * tail tip when a tail shows, otherwise the top centre of the box. Pop and
 * fade reveals are part of the clip's transform in the engine; the letter
 * reveal animates each glyph here.
 */
export function TextClipView({ clip, doc, time }: Props) {
  const letters = Array.from(clip.text);
  const accentStart =
    clip.accentSuffix && clip.text.endsWith(clip.accentSuffix)
      ? letters.length - Array.from(clip.accentSuffix).length
      : letters.length;
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
      <p aria-label={clip.text} className="flex" style={{ ...FONT_STYLE[clip.font], fontSize: clip.fontSize, color: clip.color }}>
        {clip.reveal === "letters"
          ? letters.map((letter, i) => (
              <Letter key={i} clip={clip} index={i} count={letters.length} letter={letter} accent={i >= accentStart} time={time} />
            ))
          : letters.map((letter, i) => (
              <span key={i} aria-hidden="true" style={{ color: i >= accentStart ? clip.accentColor : undefined }}>
                {letter === " " ? " " : letter}
              </span>
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
