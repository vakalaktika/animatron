import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMotion, applyRigControls } from '../motion-authoring.mjs';

const rig = () => ({ format: 'mid-century-ink-rig', version: 3, svg: '<svg/>', bones: [], bindings: [], animations: [], metadata: { identity: 'protected' } });
const doc = () => ({ version: 3, name: 'Master', stage: { width: 1280, height: 720 }, timeline: { tailSeconds: 1 }, clips: [{ id: 'cast', type: 'rig', rig: rig(), pose: {} }, { id: 'room', type: 'sprite', source: { kind: 'svg', svg: '<svg/>' } }] });
const program = () => ({ controllers: [{ id: 'grip', name: 'Plane grip', space: 'rig', x: 320, y: 180 }], blocks: [{ id: 'lift', type: 'transform', controllerId: 'grip', start: 0, duration: 2, from: { y: 0 }, to: { y: -40 } }] });
const spec = () => ({ version: 1, duration: 8, loop: true, targets: [{ clipId: 'cast', motion: program() }] });

test('replaces only selected motion programs and preserves protected artwork without mutation', () => {
  const source = doc(), original = structuredClone(source), request = spec();
  const result = applyMotion(source, request);
  assert.deepEqual(source, original);
  assert.equal(result.version, 4);
  assert.equal(result.timeline.tailSeconds, 0);
  assert.equal(result.timeline.duration, 8);
  assert.equal(result.timeline.loop, true);
  assert.deepEqual(result.clips[0].motion, request.targets[0].motion);
  assert.deepEqual(result.clips[0].rig, source.clips[0].rig);
  assert.deepEqual(result.clips[1], source.clips[1]);
});

test('portable controls deliberately opt into Rig 4 and preserve drawings, art and metadata', () => {
  const source = rig(), original = structuredClone(source);
  const result = applyRigControls(source, { version: 1, motion: program() });
  assert.equal(result.version, 4);
  assert.deepEqual(source, original);
  assert.deepEqual(result.motion, program());
  assert.equal(result.svg, source.svg);
  assert.deepEqual(result.metadata, source.metadata);
});

test('rejects malformed authoring envelopes and missing targets before writing', () => {
  for (const corrupt of [s => s.version = 2, s => s.duration = Infinity, s => s.loop = 'true', s => s.targets[0].clipId = 'absent', s => s.targets.push(s.targets[0]), s => s.targets[0].unknown = true, s => s.unknown = true, s => s.targets[0].motion = [], s => s.targets = []]) {
    const request = spec(); corrupt(request);
    assert.throws(() => applyMotion(doc(), request));
  }
  assert.throws(() => applyRigControls(rig(), { version: 1, motion: null }));
});

test('large legal illustrated payload is retained exactly by authoring', () => {
  const source = doc(); source.clips[1].source.svg = '<svg>' + ' '.repeat(1_200_000) + '</svg>';
  const result = applyMotion(source, spec());
  assert.equal(result.clips[1].source.svg, source.clips[1].source.svg);
  assert.ok(JSON.stringify(result).length > 1_200_000);
});
