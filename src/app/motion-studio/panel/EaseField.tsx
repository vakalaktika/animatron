"use client";

import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_BEZIER, EASE_LABELS, easeCss, PRESET_BEZIERS, resolveEase } from "@/app/components/motion-studio/engine/easing";
import type { Ease } from "@/app/components/motion-studio/types";

type Bezier = [number, number, number, number];

const PRESETS = ["smoothOut", "inOut", "snap", "flight", "backOut", "anticipate", "linear"] as const satisfies readonly Ease["name"][];

/** The curve as an SVG path through a unit box; `pad` leaves room for overshoot above and below. */
function curvePath(ease: Ease, w: number, h: number, pad: number, samples = 40): string {
  const fn = resolveEase(ease);
  const inner = h - pad * 2;
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = fn(t);
    points.push(`${(t * w).toFixed(1)},${(pad + inner - y * inner).toFixed(1)}`);
  }
  return `M${points.join(" L")}`;
}

function Thumb({ ease, on }: { ease: Ease; on: boolean }) {
  return (
    <svg viewBox="0 0 36 24" width={36} height={24} aria-hidden="true" className="shrink-0">
      <path d={curvePath(ease, 36, 24, 4)} fill="none" stroke={on ? "var(--primary)" : "currentColor"} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const round = (v: number) => Number(v.toFixed(2));

/**
 * Two handles that bend the curve. Horizontal control stays in 0..1 (time
 * can't run backwards); vertical may leave the box to make overshoot and
 * wind-up. Arrow keys nudge the focused handle.
 */
function CurveEditor({ value, onChange }: { value: Bezier; onChange: (next: Bezier) => void }) {
  const W = 220;
  const H = 150;
  const PAD = 30;
  const inner = H - PAD * 2;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  const toSvg = (x: number, y: number) => ({ cx: x * W, cy: PAD + inner - y * inner });
  const fromSvg = (cx: number, cy: number) => ({ x: Math.min(1, Math.max(0, cx / W)), y: Math.min(1.6, Math.max(-0.6, (PAD + inner - cy) / inner)) });
  const points: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: value[0], y: value[1] },
    { x: value[2], y: value[3] },
  ];

  const setPoint = (i: 0 | 1, p: { x: number; y: number }) => {
    const next = [...value] as Bezier;
    next[i * 2] = round(p.x);
    next[i * 2 + 1] = round(p.y);
    onChange(next);
  };
  const pointer = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return fromSvg(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };
  const begin = (i: 0 | 1) => (e: ReactPointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(i);
  };
  const move = (e: ReactPointerEvent<SVGCircleElement>) => {
    if (drag === null) return;
    const p = pointer(e);
    if (p) setPoint(drag, p);
  };
  const end = () => setDrag(null);
  const key = (i: 0 | 1) => (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const p = { ...points[i] };
    if (e.key === "ArrowLeft") p.x -= step;
    else if (e.key === "ArrowRight") p.x += step;
    else if (e.key === "ArrowUp") p.y += step;
    else if (e.key === "ArrowDown") p.y -= step;
    else return;
    e.preventDefault();
    setPoint(i, { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1.6, Math.max(-0.6, p.y)) });
  };

  const start = toSvg(0, 0);
  const finish = toSvg(1, 1);
  const ease: Ease = { name: "custom", custom: value };
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none rounded-md border border-hairline bg-surface"
      style={{ aspectRatio: `${W} / ${H}` }}
      role="group"
      aria-label="Pace curve editor"
    >
      <rect x={0} y={PAD} width={W} height={inner} fill="var(--surface-sunken)" />
      <line x1={0} y1={PAD + inner} x2={W} y2={PAD + inner} stroke="var(--hairline)" />
      <line x1={0} y1={PAD} x2={W} y2={PAD} stroke="var(--hairline)" />
      {points.map((p, i) => {
        const c = toSvg(p.x, p.y);
        const anchor = i === 0 ? start : finish;
        return <line key={`arm-${i}`} x1={anchor.cx} y1={anchor.cy} x2={c.cx} y2={c.cy} stroke="var(--ink-muted)" strokeDasharray="3 3" />;
      })}
      <path d={curvePath(ease, W, H, PAD, 60)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const c = toSvg(p.x, p.y);
        return (
          <circle
            key={`handle-${i}`}
            cx={c.cx}
            cy={c.cy}
            r={9}
            fill="var(--surface-raised)"
            stroke="var(--primary)"
            strokeWidth={2}
            tabIndex={0}
            role="slider"
            aria-label={i === 0 ? "Start handle" : "End handle"}
            aria-valuetext={`${p.x} across, ${p.y} up`}
            aria-valuemin={-60}
            aria-valuemax={160}
            aria-valuenow={round(p.y * 100)}
            className="cursor-grab outline-none focus-visible:stroke-[3px] active:cursor-grabbing"
            onPointerDown={begin(i as 0 | 1)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={key(i as 0 | 1)}
          />
        );
      })}
    </svg>
  );
}

/**
 * Picks how a move is paced. Each preset shows its curve; "Custom" opens a
 * two-handle editor started from the preset that was chosen. The dot under
 * the chips runs the chosen pace on a loop so it can be felt, not read.
 */
export function EaseField({ label = "Pace", value, onChange }: { label?: string; value: Ease; onChange: (ease: Ease) => void }) {
  const id = useId();
  const bezier: Bezier = value.name === "custom" ? (value.custom ?? DEFAULT_BEZIER) : PRESET_BEZIERS[value.name];
  const custom = value.name === "custom";
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 block atm-label">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5">
        {[...PRESETS, "custom" as const].map((name) => {
          const on = value.name === name;
          const ease: Ease = name === "custom" ? { name, custom: bezier } : { name };
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(name === "custom" ? { name: "custom", custom: bezier } : { name })}
              className={`atm-chip flex min-h-8 flex-col items-center gap-0.5 rounded-md border px-1 pt-1.5 pb-1 font-sans text-[11px] font-semibold tracking-[0.02em] ${
                on ? "border-primary bg-primary-soft text-ink" : "border-border-control text-ink-secondary hover:bg-surface-sunken hover:text-ink"
              }`}
            >
              <Thumb ease={ease} on={on} />
              <span className="truncate">{EASE_LABELS[name]}</span>
            </button>
          );
        })}
      </div>
      <div className="atm-pace-track mt-2 h-3 rounded-full bg-surface-sunken" aria-hidden="true">
        <span
          key={easeCss(value)}
          className="atm-pace-dot block h-3 w-3 rounded-full bg-primary"
          style={{ animationTimingFunction: easeCss(value) }}
        />
      </div>
      {custom && (
        <div className="mt-3 flex flex-col gap-2">
          <CurveEditor value={bezier} onChange={(next) => onChange({ name: "custom", custom: next })} />
          <p id={`${id}-hint`} className="font-mono text-[11px] tabular-nums text-ink-muted">
            cubic-bezier({bezier.join(", ")}) · drag the handles, or arrow keys
          </p>
        </div>
      )}
    </fieldset>
  );
}
