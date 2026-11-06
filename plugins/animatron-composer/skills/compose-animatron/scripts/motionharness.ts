// Bundled against the selected app source, not a second motion implementation.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { docFromJson } from '@/app/motion-studio/lib/importDoc';
import { docDuration } from '@/app/components/motion-studio/engine/timing';
import { evaluateScene } from '@/app/components/motion-studio/engine/motionScene';
import { validateMotionDocument, validateRigMotion } from '@/app/components/motion-studio/engine/motionValidation';
import { reviewScene } from '@/app/components/motion-studio/engine/sceneReview';
import { applyMotion, applyRigControls } from './motion-authoring.mjs';

try {
  const [input, specification, output, mode, repo] = process.argv.slice(2);
  const require = createRequire(join(repo, 'package.json'));
  const { JSDOM } = require('jsdom');
  (globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM('').window.DOMParser;
  const source = JSON.parse(readFileSync(input, 'utf8')), spec = JSON.parse(readFileSync(specification, 'utf8'));
  const portable = mode === 'rig';
  const before = docFromJson(JSON.stringify(source), portable ? 'source.mci.json' : 'source.json');
  if (!before.ok) throw new Error(before.message);
  const originalAsset = portable && before.doc.clips[0]?.type === 'rig' ? before.doc.clips[0].rig : before.doc;
  if (before.warnings.length || !isDeepStrictEqual(originalAsset, source)) throw new Error('Source requires repair; repair it explicitly before motion authoring');
  const authored = portable ? applyRigControls(source, spec) : applyMotion(source, spec);
  const after = docFromJson(JSON.stringify(authored), portable ? 'controls.mci.json' : 'controls.json');
  if (!after.ok) throw new Error(after.message);
  const importedAsset = portable && after.doc.clips[0]?.type === 'rig' ? after.doc.clips[0].rig : after.doc;
  if (after.warnings.length || !isDeepStrictEqual(importedAsset, authored)) throw new Error('Selected app repairs the authored result; use a compatible Document 4 / Rig 4 app revision');
  const errors = portable ? validateRigMotion(authored) : validateMotionDocument(after.doc);
  if (errors.length) throw new Error(errors.join(' '));
  const duration = docDuration(after.doc);
  if (!portable && Math.abs(duration - spec.duration) > 0.005) throw new Error(`Requested ${spec.duration}s but application evaluates ${duration}s`);
  const times = new Set<number>([0, duration]);
  for (let i = 1; i < 65; i++) times.add(duration * i / 65);
  let controllers = 0, constraints = 0;
  for (const clip of after.doc.clips) {
    const programs = [clip.motion, clip.type === 'rig' ? clip.rig.motion : undefined];
    for (const motion of programs) {
      controllers += motion?.controllers?.length ?? 0;
      constraints += motion?.constraints?.length ?? 0;
      for (const controller of motion?.controllers ?? []) for (const keys of Object.values(controller.keys ?? {})) for (const key of keys ?? []) times.add(clip.start + key.time);
      for (const block of motion?.blocks ?? []) {
        times.add(clip.start + block.start);
        times.add(clip.start + block.start + block.duration * (block.repeat ?? 1));
      }
      for (const constraint of motion?.constraints ?? []) for (const at of [constraint.start, constraint.end]) if (at !== undefined) {
        times.add(clip.start + at);
        if (at > 0) times.add(Math.max(0, clip.start + at - 0.001));
        times.add(clip.start + at + 0.001);
      }
      for (const constraint of motion?.constraints ?? []) for (const key of constraint.weightKeys ?? []) times.add(clip.start + key.time);
    }
  }
  const samples = [...times].filter(t => t >= 0 && t <= duration);
  for (const at of samples) {
    const result = evaluateScene(after.doc, at);
    if (result.diagnostics.length) throw new Error(`Motion at ${at.toFixed(3)}s: ${result.diagnostics.map(d => d.message).join(' ')}`);
  }
  if (after.doc.scenePlan) {
    const review = reviewScene(after.doc);
    if (!review.ok) throw new Error(`Scene readiness: ${review.issues.map(issue => issue.message).join(' ')}`);
  }
  writeFileSync(output, JSON.stringify(authored, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  writeFileSync(1, JSON.stringify({ duration, sampleCount: samples.length, controllers, constraints, notes: ['Technical checks do not certify visual quality or approval.', 'Preview and deployed-app compatibility must be verified separately.'] }));
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
