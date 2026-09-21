"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { childrenOf } from "@/app/components/motion-studio/engine/hierarchy";
import { transformAt } from "@/app/components/motion-studio/engine/transform";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";

interface Props {
  doc: StudioDoc;
  time: MotionValue<number>;
  selected: Clip;
  zoom: number;
}

const LEADER = "#2b6cb0";

/** Dashed line from a selected child's anchor to its parent's anchor, live with the clock. */
function LeaderLine({ doc, time, selected, zoom }: Props) {
  const child = useTransform(time, (t) => transformAt(doc, selected.id, t));
  const parent = useTransform(time, (t) => transformAt(doc, selected.parentId ?? "", t));
  const x1 = useTransform(child, (w) => w.x);
  const y1 = useTransform(child, (w) => w.y);
  const x2 = useTransform(parent, (w) => w.x);
  const y2 = useTransform(parent, (w) => w.y);
  return (
    <g>
      <motion.line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={LEADER}
        strokeWidth={1.5 / zoom}
        strokeDasharray={`${6 / zoom} ${5 / zoom}`}
      />
      <motion.circle cx={x2} cy={y2} r={5 / zoom} fill="none" stroke={LEADER} strokeWidth={1.5 / zoom} />
    </g>
  );
}

/** Faint ring on one child of the selected parent, tracking its live anchor. */
function ChildMark({ doc, time, child, zoom }: Omit<Props, "selected"> & { child: Clip }) {
  const world = useTransform(time, (t) => transformAt(doc, child.id, t));
  const cx = useTransform(world, (w) => w.x);
  const cy = useTransform(world, (w) => w.y);
  const labelX = useTransform(world, (w) => w.x + 16 / zoom);
  const labelY = useTransform(world, (w) => w.y - 10 / zoom);
  return (
    <g opacity={0.55}>
      <motion.circle
        cx={cx}
        cy={cy}
        r={12 / zoom}
        fill="none"
        stroke={LEADER}
        strokeWidth={1.5 / zoom}
        strokeDasharray={`${4 / zoom} ${4 / zoom}`}
      />
      <motion.text
        x={labelX}
        y={labelY}
        fontSize={11 / zoom}
        fill={LEADER}
        style={{ fontFamily: "var(--font-work-sans), sans-serif" }}
      >
        {child.name}
      </motion.text>
    </g>
  );
}

/**
 * Stage guides for attachment: a leader from the selected clip up to its
 * parent, and a faint mark on each of the selected clip's children. Drawn in
 * stage coordinates over the canvas; never interactive.
 */
export function AttachmentOverlay(props: Props) {
  const { doc, selected } = props;
  const children = childrenOf(doc, selected.id);
  if (!selected.parentId && children.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      {selected.parentId && <LeaderLine {...props} />}
      {children.map((child) => (
        <ChildMark key={child.id} doc={doc} time={props.time} zoom={props.zoom} child={child} />
      ))}
    </svg>
  );
}
