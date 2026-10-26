import type { RigAsset } from "../types";
import { isRigId, RIG_LIMITS } from "./rig";

/**
 * The rig contract's SVG subset, checked before any of the artwork is drawn
 * inline. Only plain geometry gets through: groups, path, rect, circle,
 * ellipse, line, polyline, polygon, title and desc, with solid fills and
 * strokes, opacity and geometric transforms. Nothing that can run, fetch,
 * style the page or reference something else (scripts, event handlers,
 * images, `use`, CSS, gradients, filters, masks, live text) is accepted;
 * an asset using any of it is rejected with the reason, never partially
 * rendered. The result is a plain tree the renderer turns into elements,
 * so the raw markup is never handed to the DOM.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const SHAPES = new Set(["g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const TEXTUAL = new Set(["title", "desc"]);

const PRESENTATION = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "fill-rule", "fill-opacity", "stroke-opacity", "opacity", "transform", "paint-order", "vector-effect", "id"];
const GEOMETRY = ["d", "x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "points", "x1", "y1", "x2", "y2", "pathLength"];
const ROOT_ONLY = ["xmlns", "viewBox", "version", "preserveAspectRatio"];
const ALLOWED = new Set([...PRESENTATION, ...GEOMETRY]);
const ROOT_ALLOWED = new Set([...PRESENTATION, "width", "height", ...ROOT_ONLY]);
/** Harmless namespaced attributes that are simply dropped. */
const IGNORED = new Set(["xml:space", "xmlns:xlink"]);

export interface RigSvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: RigSvgNode[];
  /** Text of a `<title>` or `<desc>`. */
  text?: string;
}

export interface RigSvg {
  root: RigSvgNode;
  /** Direct-child groups by id, in paint order. */
  groups: Map<string, RigSvgNode>;
  elements: number;
}

export type RigSvgResult = { ok: true; svg: RigSvg } | { ok: false; error: string };

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function checkAttributes(el: Element, allowed: Set<string>): string | null {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    if (IGNORED.has(name)) continue;
    if (/^on/i.test(name)) return `The artwork has an event attribute (${name}), which the rig format does not allow.`;
    if (name === "style" || name === "class") return `The artwork uses ${name} attributes; the rig format wants plain presentation attributes.`;
    if (name.includes(":") || !allowed.has(name)) return `The artwork uses an attribute the rig format does not allow: ${name} on <${el.localName}>.`;
    if ((name === "fill" || name === "stroke") && /url\s*\(/i.test(attr.value)) return `The artwork references a paint server (${name}="${attr.value}"); only solid colours are allowed.`;
  }
  return null;
}

function readNode(el: Element, isRoot: boolean, count: { n: number }): RigSvgNode | string {
  if (el.namespaceURI !== SVG_NS) return `The artwork contains a non-SVG element: <${el.localName}>.`;
  const tag = el.localName;
  if (isRoot ? tag !== "svg" : !SHAPES.has(tag) && !TEXTUAL.has(tag)) return `The artwork uses <${tag}>, which the rig format does not allow. Outline text and flatten effects first.`;
  count.n += 1;
  if (count.n > RIG_LIMITS.svgElements) return `The artwork has more than ${RIG_LIMITS.svgElements} elements.`;
  const problem = checkAttributes(el, isRoot ? ROOT_ALLOWED : ALLOWED);
  if (problem) return problem;
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (IGNORED.has(attr.name) || ROOT_ONLY.includes(attr.name)) continue;
    attrs[camel(attr.name)] = attr.value;
  }
  if (TEXTUAL.has(tag)) return { tag, attrs, children: [], text: el.textContent ?? "" };
  const children: RigSvgNode[] = [];
  for (const child of Array.from(el.children)) {
    const node = readNode(child, false, count);
    if (typeof node === "string") return node;
    children.push(node);
  }
  return { tag, attrs, children };
}

/**
 * Parses and validates the rig's artwork. The viewBox must be
 * `0 0 canvas.width canvas.height` and every binding must name a direct-child
 * `<g id>` of the root.
 */
export function parseRigSvg(asset: Pick<RigAsset, "svg" | "canvas" | "bindings">): RigSvgResult {
  if (typeof DOMParser === "undefined") return { ok: false, error: "This environment cannot parse SVG." };
  if (asset.svg.length > RIG_LIMITS.svgChars) return { ok: false, error: "The artwork is larger than 2 MB." };
  const doc = new DOMParser().parseFromString(asset.svg, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return { ok: false, error: "The rig's SVG does not parse." };
  const rootEl = doc.documentElement;
  const node = readNode(rootEl, true, { n: 0 });
  if (typeof node === "string") return { ok: false, error: node };
  const viewBox = (rootEl.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const expected = [0, 0, asset.canvas.width, asset.canvas.height];
  if (viewBox.length !== 4 || viewBox.some((v, i) => !Number.isFinite(v) || Math.abs(v - expected[i]) > 1e-6)) {
    return { ok: false, error: `The SVG viewBox must be "0 0 ${asset.canvas.width} ${asset.canvas.height}" to match the rig's canvas.` };
  }
  const groups = new Map<string, RigSvgNode>();
  for (const child of node.children) {
    if (child.tag !== "g" || !isRigId(child.attrs.id)) continue;
    if (groups.has(child.attrs.id)) return { ok: false, error: `Two artwork groups share the id "${child.attrs.id}".` };
    groups.set(child.attrs.id, child);
  }
  for (const binding of asset.bindings) {
    if (!groups.has(binding.svgId)) return { ok: false, error: `Binding "${binding.id}" points at an artwork group that is not a direct child of the SVG: "${binding.svgId}".` };
  }
  let elements = 0;
  const walk = (n: RigSvgNode) => {
    elements += 1;
    n.children.forEach(walk);
  };
  walk(node);
  return { ok: true, svg: { root: node, groups, elements } };
}

/** The element's props as React wants them (camelCase presentation attributes). */
export const svgNodeProps = (node: RigSvgNode): Record<string, string> => node.attrs;
