"use client";

import { useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { createElement, useMemo, useRef, type ReactNode } from "react";
import { matrixString, rigPoseAt, transforms, type Matrix } from "../engine/rig";
import { parseRigSvg, type RigSvgNode } from "../engine/rigSvg";
import type { RigClip } from "../types";

interface Props {
  clip: RigClip;
  time: MotionValue<number>;
}

/** One validated SVG node as a React element; nothing from the file reaches the DOM as markup. */
function renderNode(node: RigSvgNode, key: string | number): ReactNode {
  if (node.text !== undefined) return createElement(node.tag, { key, ...node.attrs }, node.text);
  return createElement(node.tag, { key, ...node.attrs }, node.children.map((child, i) => renderNode(child, i)));
}

/**
 * A bound artwork group, wrapped in its bone's posed world · bind matrix
 * (the identity at rest). The matrix is written as the SVG `transform`
 * attribute by hand: motion would apply it as a CSS transform about the
 * group's own centre, and a rig matrix is in canvas coordinates.
 */
function BoundGroup({ node, svgId, wraps }: { node: RigSvgNode; svgId: string; wraps: MotionValue<Record<string, Matrix>> }) {
  const ref = useRef<SVGGElement>(null);
  const transform = useTransform(wraps, (m) => matrixString(m[svgId] ?? [1, 0, 0, 1, 0, 0]));
  useMotionValueEvent(transform, "change", (v) => ref.current?.setAttribute("transform", v));
  return (
    <g ref={ref} transform={transform.get()}>
      {renderNode(node, svgId)}
    </g>
  );
}

/**
 * A Mid-century Ink rig, drawn with its canvas centred on the clip's
 * anchor. The artwork is validated against the contract's SVG subset and
 * rebuilt as elements; each bound group rides its bone. Pose comes from the
 * clip's animation sampled at the clock time, or from its manual pose, and
 * is always evaluated from time, never accumulated.
 */
export function RigClipView({ clip, time }: Props) {
  const { rig } = clip;
  const parsed = useMemo(() => parseRigSvg(rig), [rig]);
  const wraps = useTransform(time, (t) => transforms(rig, rigPoseAt(clip, t)));
  const { width, height } = rig.canvas;
  if (!parsed.ok) return null;
  const bound = new Map(rig.bindings.map((b) => [b.svgId, b]));
  return (
    <div className="absolute" style={{ left: -width / 2, top: -height / 2, width, height }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block overflow-visible" aria-hidden="true" {...parsed.svg.root.attrs}>
        {parsed.svg.root.children.map((child, i) => {
          const id = child.tag === "g" ? child.attrs.id : undefined;
          return id && bound.has(id) ? <BoundGroup key={id} node={child} svgId={id} wraps={wraps} /> : renderNode(child, i);
        })}
      </svg>
    </div>
  );
}
