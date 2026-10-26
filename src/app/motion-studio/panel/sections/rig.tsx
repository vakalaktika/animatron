"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { useState } from "react";
import {
  activeAnimation,
  addAnimation,
  addBone,
  boneLabel,
  boneRows,
  compatibleActions,
  editRestJoint,
  isRigId,
  keyTimes,
  preset,
  reassignBinding,
  record,
  removeAnimation,
  removeBone,
  removeKey,
  replaceAnimation,
  rigPoseAt,
  setAnimationDuration,
  upsertKey,
} from "@/app/components/motion-studio/engine/rig";
import type { RigAsset, RigClip, RigKey } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { localTime, setBoneDelta } from "../../lib/rigEdit";
import type { RigMode } from "../../stage/RigEditor";
import { BUTTON_ROW, ChipField, MoreFields, NumField, SelectField, TextField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";

/** How the rig panels read and change the studio's rig editing state. */
export interface RigActions {
  mode: RigMode;
  onMode: (mode: RigMode) => void;
  selectedBone: string | null;
  onSelectBone: (id: string | null) => void;
  /** The shared clock, for the playhead-relative fields. */
  time: MotionValue<number>;
  onSeek: (seconds: number) => void;
  /** Downloads the editable master as `.mci.json`. */
  onSaveRig: (clip: RigClip) => void;
}

const setRig = (clip: RigClip, onChange: (c: RigClip) => void) => (rig: RigAsset) => onChange({ ...clip, rig });

/** The clock, as React state, for fields that read the playhead. */
function useNow(time: MotionValue<number>): number {
  const [now, setNow] = useState(() => time.get());
  useMotionValueEvent(time, "change", (t) => setNow(t));
  return now;
}

const fmt = (n: number) => Number(n.toFixed(2));

// ----- Skeleton --------------------------------------------------------------

function SkeletonFields({ clip, onChange, rig }: { clip: RigClip; onChange: (c: RigClip) => void; rig: RigActions }) {
  const asset = clip.rig;
  const now = useNow(rig.time);
  const change = setRig(clip, onChange);
  const rows = boneRows(asset);
  const bone = asset.bones.find((b) => b.id === rig.selectedBone) ?? null;
  const anim = activeAnimation(clip);
  const pose = rigPoseAt(clip, now);
  const delta = bone ? (pose[bone.id] ?? { x: 0, y: 0, rotation: 0 }) : null;
  const limits = bone?.limits ?? { min: -180, max: 180 };
  const span = Math.max(asset.canvas.width, asset.canvas.height);
  const [roleDraft, setRoleDraft] = useState<string | null>(null);

  return (
    <>
      <ChipField
        label="Working on"
        value={rig.mode}
        options={[
          { value: "pose", label: "Pose" },
          { value: "joints", label: "Joints" },
        ]}
        onChange={rig.onMode}
      />
      <p className="atm-help">
        {rig.mode === "pose"
          ? anim
            ? `Drag a joint on the canvas to bend the limb above it, or a bone tip to turn it. While “${anim.name ?? anim.id}” plays, each move is saved as a key at the playhead.`
            : "Drag a joint on the canvas to bend the limb above it, or a bone tip to turn it. The drawing moves around its joints; the skeleton itself stays as drawn."
          : "Drag a joint to move where the bone bends, or a tip to change its direction and length. The drawing stays exactly where it is; only the skeleton under it changes."}
      </p>
      <ol className="flex flex-col gap-px" aria-label="Bones">
        {rows.map(({ bone: b, depth }) => {
          const on = b.id === rig.selectedBone;
          return (
            <li key={b.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => rig.onSelectBone(on ? null : b.id)}
                className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${on ? "bg-primary-soft text-ink" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink"}`}
                style={{ paddingLeft: 8 + depth * 14 }}
              >
                <span className="min-w-0 flex-1 truncate">{boneLabel(b)}</span>
                {b.role && b.role !== boneLabel(b) && <span className="shrink-0 font-sans text-[11px] text-ink-muted">{b.role}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {!bone && <p className="atm-help">Pick a bone here or on the canvas to see its settings.</p>}
      {bone && delta && rig.mode === "pose" && (
        <>
          <NumField label={`Turn ${boneLabel(bone)}`} unit="°" value={fmt(delta.rotation)} min={limits.min} max={limits.max} step={1} onChange={(v) => onChange(setBoneDelta(clip, now, bone.id, { rotation: v }))} />
          <MoreFields label="Shift">
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Shift X" unit="px" value={fmt(delta.x)} min={-span} max={span} step={1} onChange={(v) => onChange(setBoneDelta(clip, now, bone.id, { x: v }))} />
              <NumField label="Shift Y" unit="px" value={fmt(delta.y)} min={-span} max={span} step={1} onChange={(v) => onChange(setBoneDelta(clip, now, bone.id, { y: v }))} />
            </div>
          </MoreFields>
          <div className={BUTTON_ROW}>
            <Button size="xs" variant="outline" onClick={() => onChange(setBoneDelta(clip, now, bone.id, { x: 0, y: 0, rotation: 0 }))}>
              Straighten this bone
            </Button>
            {!anim && (
              <Button size="xs" variant="outline" disabled={Object.keys(clip.pose).length === 0} onClick={() => onChange({ ...clip, pose: {} })}>
                Back to rest pose
              </Button>
            )}
          </div>
        </>
      )}
      {bone && rig.mode === "joints" && (
        <>
          <TextField label="Name" value={bone.name ?? ""} placeholder={bone.id} onChange={(v) => change(editRestJoint(asset, bone.id, { name: v || undefined }))} />
          <TextField
            label="Role"
            value={roleDraft ?? bone.role ?? ""}
            placeholder="head, arm.left.forearm, tail…"
            onChange={(v) => {
              const next = v.trim();
              setRoleDraft(v);
              const taken = asset.bones.some((b) => b.id !== bone.id && b.role === next);
              if (next === "") change(editRestJoint(asset, bone.id, { role: undefined }));
              else if (isRigId(next) && !taken) change(editRestJoint(asset, bone.id, { role: next }));
            }}
          />
          {roleDraft !== null && roleDraft.trim() !== "" && roleDraft.trim() !== bone.role && <p className="atm-help">Roles are letters, digits, dots, dashes and underscores, starting with a letter, and unique in the rig.</p>}
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Joint X" unit="px" value={fmt(bone.rest.x)} min={-span} max={span} step={1} onChange={(v) => change(editRestJoint(asset, bone.id, { rest: { ...bone.rest, x: v } }))} />
            <NumField label="Joint Y" unit="px" value={fmt(bone.rest.y)} min={-span} max={span} step={1} onChange={(v) => change(editRestJoint(asset, bone.id, { rest: { ...bone.rest, y: v } }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Rest turn" unit="°" value={fmt(bone.rest.rotation)} min={-180} max={180} step={1} onChange={(v) => change(editRestJoint(asset, bone.id, { rest: { ...bone.rest, rotation: v } }))} />
            <NumField label="Length" unit="px" value={fmt(bone.length)} min={0} max={span} step={1} onChange={(v) => change(editRestJoint(asset, bone.id, { length: v }))} />
          </div>
          <ToggleField label="Limit how far it turns" value={!!bone.limits} onChange={(v) => change(editRestJoint(asset, bone.id, { limits: v ? { min: -90, max: 90 } : undefined }))} />
          {bone.limits && (
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Turns back to" unit="°" value={fmt(bone.limits.min)} min={-360} max={0} step={1} onChange={(v) => change(editRestJoint(asset, bone.id, { limits: { min: Math.min(0, v), max: bone.limits!.max } }))} />
              <NumField label="Turns forward to" unit="°" value={fmt(bone.limits.max)} min={0} max={360} step={1} onChange={(v) => change(editRestJoint(asset, bone.id, { limits: { min: bone.limits!.min, max: Math.max(0, v) } }))} />
            </div>
          )}
          <div className={BUTTON_ROW}>
            <Button size="xs" variant="outline" disabled={asset.bones.length >= 128} onClick={() => change(addBone(asset, bone.id))}>
              + Add a bone below it
            </Button>
            <Button size="xs" variant="danger" disabled={bone.parentId === null} onClick={() => {
              rig.onSelectBone(bone.parentId);
              change(removeBone(asset, bone.id));
            }}>
              Remove bone
            </Button>
          </div>
        </>
      )}
      <MoreFields label={`Artwork parts (${asset.bindings.length})`}>
        <p className="atm-help">Each drawn part follows one bone. Changing the bone keeps the part where it is drawn.</p>
        {asset.bindings.map((b) => (
          <SelectField
            key={b.id}
            label={b.svgId}
            value={b.boneId}
            options={asset.bones.map((bn) => ({ value: bn.id, label: boneLabel(bn) }))}
            onChange={(v) => change(reassignBinding(asset, b.id, v))}
          />
        ))}
        {asset.slots && asset.slots.length > 0 && (
          <p className="atm-help">
            Attachment points, kept for other tools: {asset.slots.map((s) => `${s.id} on ${boneLabel(asset.bones.find((bn) => bn.id === s.boneId) ?? { id: s.boneId, parentId: null, rest: { x: 0, y: 0, rotation: 0 }, length: 0 })}`).join(", ")}.
          </p>
        )}
      </MoreFields>
    </>
  );
}

/** Bones, posing and joint editing for a rig. */
export function skeletonSection(clip: RigClip, onChange: (c: RigClip) => void, rig: RigActions): PanelSection {
  return { id: "skeleton", title: "Skeleton", content: <SkeletonFields clip={clip} onChange={onChange} rig={rig} /> };
}

// ----- Animation -------------------------------------------------------------

const EASINGS: { value: RigKey["easing"]; label: string }[] = [
  { value: "linear", label: "Glide to the next" },
  { value: "hold", label: "Hold until the next" },
];

function AnimationFields({ clip, onChange, rig }: { clip: RigClip; onChange: (c: RigClip) => void; rig: RigActions }) {
  const asset = clip.rig;
  const change = setRig(clip, onChange);
  const now = useNow(rig.time);
  const anim = activeAnimation(clip);
  const at = localTime(clip, now);
  const actions = compatibleActions(asset);
  const bone = asset.bones.find((b) => b.id === rig.selectedBone) ?? null;
  const track = anim && bone ? anim.tracks.find((t) => t.boneId === bone.id) : null;
  const times = anim ? keyTimes(anim) : [];
  const seekTo = (time: number) => rig.onSeek(clip.start + time);

  return (
    <>
      <SelectField
        label="Plays"
        value={clip.animationId ?? ""}
        options={[{ value: "", label: "Nothing: hold a pose" }, ...asset.animations.map((a) => ({ value: a.id, label: a.name ?? a.id }))]}
        onChange={(v) => onChange({ ...clip, animationId: v === "" ? null : v })}
      />
      {anim ? (
        <>
          <TextField label="Clip name" value={anim.name ?? ""} placeholder={anim.id} onChange={(v) => change(replaceAnimation(asset, { ...anim, name: v || undefined }))} />
          <NumField label="Length" unit="s" value={fmt(anim.duration)} min={0.1} max={60} step={0.1} onChange={(v) => change(setAnimationDuration(asset, anim.id, v))} />
          <ToggleField label="Loop" value={anim.loop} onChange={(v) => change(replaceAnimation(asset, { ...anim, loop: v }))} />
          <p className="atm-help">Keys are moments where bones have a set position; the rig glides between them. The diamonds on the timeline are the keys; drag one to move it.</p>
          <div className={BUTTON_ROW}>
            <Button size="xs" onClick={() => change(record(asset, anim.id, at, rigPoseAt(clip, now)))}>
              Record the pose at {at.toFixed(2)} s
            </Button>
            {times.length > 0 && (
              <>
                <Button size="xs" variant="outline" disabled={!times.some((t) => t < at - 1e-6)} onClick={() => seekTo([...times].reverse().find((t) => t < at - 1e-6) ?? 0)}>
                  ◀ Key
                </Button>
                <Button size="xs" variant="outline" disabled={!times.some((t) => t > at + 1e-6)} onClick={() => seekTo(times.find((t) => t > at + 1e-6) ?? anim.duration)}>
                  Key ▶
                </Button>
              </>
            )}
          </div>
          {bone && (
            <MoreFields label={`Keys for ${boneLabel(bone)} (${track?.keys.length ?? 0})`} defaultOpen>
              {!track && <p className="atm-help">This bone has no keys in this clip yet; it stays at rest. Pose it, or record the pose.</p>}
              {track?.keys.map((k) => {
                const here = Math.abs(k.time - at) <= 1e-6;
                return (
                  <div key={k.time} className={`flex flex-col gap-2 rounded-md border p-2 ${here ? "border-primary bg-primary-soft/40" : "border-hairline"}`}>
                    <div className="flex items-center gap-2">
                      <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-ink" onClick={() => seekTo(k.time)} aria-label={`Go to the key at ${k.time.toFixed(2)} seconds`}>
                        {k.time.toFixed(2)} s · {Math.round(k.rotation)}°{k.x || k.y ? ` · ${Math.round(k.x)}, ${Math.round(k.y)} px` : ""}
                      </button>
                      <Button size="xs" variant="outline" onClick={() => change(removeKey(asset, anim.id, bone.id, k.time))}>
                        Remove
                      </Button>
                    </div>
                    <ChipField label="Then" value={k.easing} options={EASINGS} onChange={(v) => change(upsertKey(asset, anim.id, bone.id, k.time, k, v))} />
                  </div>
                );
              })}
            </MoreFields>
          )}
          {!bone && <p className="atm-help">Pick a bone to see and edit its keys.</p>}
        </>
      ) : (
        <p className="atm-help">The rig holds whatever pose you give it. Add a clip to make it move; its length then sets how long the layer runs.</p>
      )}
      <div className={BUTTON_ROW}>
        <Button
          size="xs"
          variant="outline"
          disabled={asset.animations.length >= 64}
          onClick={() => {
            const { asset: next, id } = addAnimation(asset, "Clip");
            onChange({ ...clip, rig: next, animationId: id });
          }}
        >
          + New clip
        </Button>
        <Button size="xs" variant="outline" disabled={!actions.wave} title={actions.wave ? undefined : "Needs bones with the roles arm.left.upper, arm.left.forearm and arm.left.hand"} onClick={() => onChange({ ...clip, rig: preset(asset, "wave"), animationId: "wave" })}>
          + Wave
        </Button>
        <Button size="xs" variant="outline" disabled={!actions.nod} title={actions.nod ? undefined : "Needs a bone with the role head"} onClick={() => onChange({ ...clip, rig: preset(asset, "nod"), animationId: "nod" })}>
          + Nod
        </Button>
        {anim && (
          <Button size="xs" variant="danger" onClick={() => onChange({ ...clip, rig: removeAnimation(asset, anim.id), animationId: asset.animations.find((a) => a.id !== anim.id)?.id ?? null })}>
            Remove clip
          </Button>
        )}
      </div>
      <div className="border-t border-hairline pt-3">
        <Button size="xs" variant="outline" onClick={() => rig.onSaveRig(clip)}>
          Save rig (.mci.json)
        </Button>
        <p className="atm-help mt-2">The editable master with every bone, part, attachment point and clip, for Agent Torres and the Mid-century Ink generator.</p>
      </div>
    </>
  );
}

/** Which clip plays, its length and keys, presets, and the rig-preserving save. */
export function rigAnimationSection(clip: RigClip, onChange: (c: RigClip) => void, rig: RigActions): PanelSection {
  return { id: "rig-animation", title: "Animation clips", content: <AnimationFields clip={clip} onChange={onChange} rig={rig} /> };
}
