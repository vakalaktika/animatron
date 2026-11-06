import type { Ease, KeyedProp, PropKey, Vec2 } from "../types";

/** Document 4 / Rig 4: declarative data only; all times are seconds from the owning clip start. */
export interface MotionController {
  id: string;
  name?: string;
  space: "rig" | "stage" | "object";
  x: number;
  y: number;
  rotation?: number;
  /** Object space references another clip, optionally one of its rig sockets. */
  clipId?: string;
  slotId?: string;
  keys?: Partial<Record<"x" | "y" | "rotation", PropKey[]>>;
}

interface BlockBase {
  id: string;
  name?: string;
  enabled?: boolean;
  /** Omit to move the object; otherwise move this controller. */
  controllerId?: string;
  start: number;
  duration: number;
  /** Number of cycles; defaults to one. */
  repeat?: number;
  /** Alternate forward and backward cycles. */
  alternate?: boolean;
  ease?: Ease;
}

export interface PathMotionBlock extends BlockBase {
  type: "path";
  points: Vec2[];
  closed?: boolean;
  orient?: boolean;
  facingOffset?: number;
}

export interface TransformMotionBlock extends BlockBase {
  type: "transform";
  /** Additive deltas from zero; scale and opacity deltas are also additive. */
  from: Partial<Record<KeyedProp, number>>;
  to: Partial<Record<KeyedProp, number>>;
}

export interface OscillateMotionBlock extends BlockBase {
  type: "oscillate";
  property: KeyedProp;
  amplitude: number;
  cycles?: number;
  phase?: number;
}

export type MotionBlock = PathMotionBlock | TransformMotionBlock | OscillateMotionBlock;

interface ConstraintBase {
  id: string;
  name?: string;
  /** Enabled over [start,end], defaulting to the whole owning clip. */
  start?: number;
  end?: number;
  weight?: number;
  weightKeys?: PropKey[];
  enabled?: boolean;
}

export interface IKMotionConstraint extends ConstraintBase {
  type: "ik";
  rootId: string;
  midId: string;
  tipId: string;
  targetId: string;
  bend: 1 | -1;
}

export interface AimMotionConstraint extends ConstraintBase {
  type: "aim";
  boneId: string;
  targetId: string;
  /** Angle offset from the bone's local +X direction. */
  offset?: number;
}

export interface AttachMotionConstraint extends ConstraintBase {
  type: "attach";
  targetClipId: string;
  slotId?: string;
  /** Target-local displacement and rotation, authored to preserve the grip at handoff. */
  offset: { x: number; y: number; rotation: number };
  followRotation?: boolean;
}

export type MotionConstraint = IKMotionConstraint | AimMotionConstraint | AttachMotionConstraint;

export interface MotionProgram {
  controllers?: MotionController[];
  blocks?: MotionBlock[];
  constraints?: MotionConstraint[];
}

export interface MotionDiagnostic {
  clipId: string;
  operatorId?: string;
  code: "invalid" | "unreachable" | "contact";
  message: string;
  error?: number;
}
