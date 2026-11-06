// Declarative authoring only. The CLI always follows this with actual app validation.
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const fields = (value, allowed, label) => {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`${label} has unsupported fields`);
};
const program = value => {
  fields(value, ['controllers', 'blocks', 'constraints'], 'motion program');
  for (const key of Object.keys(value)) if (!Array.isArray(value[key])) throw new Error(`${key} must be an array`);
  return structuredClone(value);
};

/** Replace addressed programs, never redraw artwork or alter unaddressed tracks. */
export function applyMotion(doc, spec) {
  fields(spec, ['version', 'duration', 'loop', 'targets'], 'motion spec');
  if (spec.version !== 1) throw new Error('Expected motion spec version 1');
  if (!Number.isFinite(spec.duration) || spec.duration <= 0 || spec.duration > 600) throw new Error('duration must be in 0..600 seconds');
  if (typeof spec.loop !== 'boolean') throw new Error('loop must be an explicit boolean');
  if (!Array.isArray(doc?.clips) || !Array.isArray(spec.targets) || !spec.targets.length || spec.targets.length > 256) throw new Error('Expected composition and 1..256 targets');
  const byId = new Map(doc.clips.map(clip => [clip.id, clip]));
  if (byId.size !== doc.clips.length) throw new Error('Duplicate clip IDs');
  const replacements = new Map();
  for (const target of spec.targets) {
    fields(target, ['clipId', 'motion', 'rigMotion'], 'target');
    const source = byId.get(target.clipId);
    if (!source || replacements.has(target.clipId)) throw new Error(`Unknown or repeated clip ${target.clipId}`);
    if (target.motion === undefined && target.rigMotion === undefined) throw new Error('Target needs motion or rigMotion');
    let clip = { ...source };
    if (target.motion !== undefined) clip = { ...clip, motion: program(target.motion) };
    if (target.rigMotion !== undefined) {
      if (source.type !== 'rig') throw new Error('rigMotion requires a rig clip');
      clip = { ...clip, rig: applyRigControls(source.rig, { version: 1, motion: target.rigMotion }) };
    }
    replacements.set(target.clipId, clip);
  }
  return { ...doc, version: 4, timeline: { ...doc.timeline, duration: spec.duration, loop: spec.loop, tailSeconds: 0 }, clips: doc.clips.map(clip => replacements.get(clip.id) ?? clip) };
}

/** Rig-local controls must be portable; the app enforces all reference semantics. */
export function applyRigControls(rig, spec) {
  fields(spec, ['version', 'motion'], 'rig controls spec');
  if (spec.version !== 1 || rig?.format !== 'mid-century-ink-rig') throw new Error('Expected rig and controls spec version 1');
  return { ...rig, version: 4, motion: program(spec.motion) };
}
