import type { SpriteSource, SvgTextRun } from "../types";

export const RUN_ATTR = "data-studio-run";
const SVG_NS = "http://www.w3.org/2000/svg";
// Text inside these never renders directly, so it is not editable artwork.
const HIDDEN_ANCESTORS = "defs, symbol, mask, clipPath";

export interface ParsedSvg {
  markup: string;
  aspect: number;
  textRuns: SvgTextRun[];
}

function parseDocument(source: string): SVGSVGElement | null {
  if (typeof DOMParser === "undefined") return null;
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (parsed.getElementsByTagName("parsererror").length > 0) return null;
  const root = parsed.documentElement;
  if (root.namespaceURI !== SVG_NS || root.localName !== "svg") return null;
  return root as unknown as SVGSVGElement;
}

function aspectOf(root: SVGSVGElement): number {
  const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) return viewBox[3] / viewBox[2];
  const w = parseFloat(root.getAttribute("width") ?? "");
  const h = parseFloat(root.getAttribute("height") ?? "");
  return w > 0 && h > 0 ? h / w : 1;
}

/**
 * Reads an SVG file for live text. Every `<text>` outside defs, symbols,
 * masks, and clip paths becomes a run and is stamped with an id so it can
 * be edited later. Returns null when the file does not parse as SVG; the
 * caller treats it as an opaque picture and says so.
 */
export function parseSvg(source: string): ParsedSvg | null {
  const root = parseDocument(source);
  if (!root) return null;
  const textRuns: SvgTextRun[] = [];
  Array.from(root.getElementsByTagName("text")).forEach((el, i) => {
    if (el.closest(HIDDEN_ANCESTORS)) return;
    const text = el.textContent?.trim() ?? "";
    if (!text) return;
    const id = `run-${i}`;
    el.setAttribute(RUN_ATTR, id);
    textRuns.push({ id, text, detachedTo: null });
  });
  return { markup: new XMLSerializer().serializeToString(root), aspect: aspectOf(root), textRuns };
}

/**
 * The SVG markup with the current run texts applied and detached runs
 * hidden, as a data URL for an `<img>`. Rendering through an image keeps
 * imported markup from running anything in the page.
 */
export function svgDataUrl(source: Extract<SpriteSource, { kind: "svg" }>): string {
  const root = parseDocument(source.markup);
  const markup = root ? applyRuns(root, source.textRuns) : source.markup;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function applyRuns(root: SVGSVGElement, runs: SvgTextRun[]): string {
  for (const run of runs) {
    const el = root.querySelector(`[${RUN_ATTR}="${run.id}"]`);
    if (!el) continue;
    if (run.detachedTo) el.setAttribute("display", "none");
    else {
      el.removeAttribute("display");
      el.textContent = run.text;
    }
  }
  return new XMLSerializer().serializeToString(root);
}
