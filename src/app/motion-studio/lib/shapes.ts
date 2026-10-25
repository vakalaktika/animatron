import type { SpriteClip, StageConfig } from "@/app/components/motion-studio/types";
import { makeSvgSprite } from "../presets";

export type ShapeKind = "circle" | "square" | "rounded" | "triangle" | "star" | "arrow" | "heart" | "blob";

export interface ShapeSpec {
  kind: ShapeKind;
  label: string;
}

export const SHAPES: ShapeSpec[] = [
  { kind: "circle", label: "Circle" },
  { kind: "square", label: "Square" },
  { kind: "rounded", label: "Rounded square" },
  { kind: "triangle", label: "Triangle" },
  { kind: "star", label: "Star" },
  { kind: "arrow", label: "Arrow" },
  { kind: "heart", label: "Heart" },
  { kind: "blob", label: "Blob" },
];

/** A handful of stage-friendly fills, drawn from the chart palette. */
export const SHAPE_COLORS = ["#186a63", "#c33a26", "#d69a2c", "#2b6cb0", "#7a4f9a", "#2a241d"];

function starPoints(outer: number, inner: number, cx: number, cy: number, n = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(" ");
}

/**
 * The shape as a self-contained SVG on a 100-unit box. Every shape is a
 * single filled element so the result is tiny and scales crisply. The
 * `aspect` is height over width, as the sprite model expects.
 */
export function shapeSvg(kind: ShapeKind, fill: string): { markup: string; aspect: number } {
  const body = (() => {
    switch (kind) {
      case "circle":
        return `<circle cx="50" cy="50" r="48" fill="${fill}"/>`;
      case "square":
        return `<rect x="2" y="2" width="96" height="96" fill="${fill}"/>`;
      case "rounded":
        return `<rect x="2" y="2" width="96" height="96" rx="22" fill="${fill}"/>`;
      case "triangle":
        return `<polygon points="50,3 97,95 3,95" fill="${fill}"/>`;
      case "star":
        return `<polygon points="${starPoints(48, 20, 50, 52)}" fill="${fill}"/>`;
      case "arrow":
        return `<path d="M4 38h52V16l40 34-40 34V62H4z" fill="${fill}"/>`;
      case "heart":
        return `<path d="M50 92 C20 70 4 54 4 34 4 20 15 10 28 10c9 0 17 5 22 13 5-8 13-13 22-13 13 0 24 10 24 24 0 20-16 36-46 58z" fill="${fill}"/>`;
      case "blob":
        return `<path d="M58 6c17 2 32 14 36 31 5 20-6 40-22 51-15 10-36 12-51 2C5 80-2 60 6 42 13 24 32 3 58 6z" fill="${fill}"/>`;
    }
  })();
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${body}</svg>`;
  return { markup, aspect: 1 };
}

/** A shape clip that drops into place in the middle of the stage. */
export function makeShape(kind: ShapeKind, fill: string, stage: Pick<StageConfig, "width" | "height">, over: Partial<SpriteClip> = {}): SpriteClip {
  const { markup, aspect } = shapeSvg(kind, fill);
  const label = SHAPES.find((s) => s.kind === kind)?.label ?? "Shape";
  return makeSvgSprite(markup, label, aspect, [], {
    name: label,
    x: stage.width / 2,
    y: stage.height / 2,
    width: 220,
    start: 0,
    path: [
      { x: 0, y: -60 },
      { x: 0, y: 0 },
    ],
    duration: 0.6,
    ease: { name: "backOut" },
    scaleFrom: 0.4,
    fadeIn: 0.2,
    bank: 0,
    ...over,
  });
}
