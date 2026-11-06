import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = process.env.ANIMATRON_TEST_REPO;
test('motion CLI validates through app, preserves large output, and leaves failed destination untouched', { skip: !repo ? 'Set ANIMATRON_TEST_REPO for application integration' : false }, () => {
  const work = mkdtempSync(join(tmpdir(), 'motion-cli-'));
  try {
    const source = JSON.parse(readFileSync(join(repo, 'examples/tween-studio/lamp.animatron.json'), 'utf8'));
    source.clips[0].rig.svg = source.clips[0].rig.svg.replace('</svg>', ' '.repeat(1_200_000) + '</svg>');
    const input = join(work, 'source.json'), spec = join(work, 'motion.json'), output = join(work, 'master.json');
    writeFileSync(input, JSON.stringify(source));
    const request = { version: 1, duration: 8, loop: true, targets: [{ clipId: 'lamp', motion: { blocks: [{ id: 'sway', type: 'transform', start: 0, duration: 8, from: { rotation: 0 }, to: { rotation: 2 } }] } }] };
    const cli = fileURLToPath(new URL('../motion-program.mjs', import.meta.url));
    const run = () => spawnSync(process.execPath, [cli, input, spec, '--out', output, '--repo', resolve(repo), '--offline'], { encoding: 'utf8', maxBuffer: 256 * 1024 });
    writeFileSync(spec, JSON.stringify(request));
    const good = run(); assert.equal(good.status, 0, good.stderr);
    const result = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(result.version, 4);
    assert.equal(result.clips[0].rig.svg, source.clips[0].rig.svg);
    assert.ok(readFileSync(output).length > 1_200_000);
    assert.ok(good.stdout.length < 1000);
    assert.match(good.stdout, /8.00 s/);
    for (const corrupt of [s => s.targets[0].motion.blocks[0].type = 'javascript', s => s.targets[0].motion.blocks[0].duration = 10, s => s.targets[0].motion.constraints = [{ id: 'bad', type: 'attach', targetClipId: 'missing', offset: { x: 0, y: 0, rotation: 0 } }]]) {
      const bad = structuredClone(request); corrupt(bad); writeFileSync(spec, JSON.stringify(bad));
      writeFileSync(output, 'protected destination');
      const failed = run(); assert.notEqual(failed.status, 0, failed.stdout);
      assert.equal(readFileSync(output, 'utf8'), 'protected destination');
      assert.ok(!readdirSync(work).some(file => file.endsWith('.tmp')));
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('Mid-century Ink portable command keeps artwork and rejects scene-only references atomically', { skip: !repo ? 'Set ANIMATRON_TEST_REPO for application integration' : false }, () => {
  const work = mkdtempSync(join(tmpdir(), 'rig-controls-cli-'));
  try {
    const source = join(repo, 'docs/mci-rig/example-character.mci.json');
    const spec = join(work, 'controls.json'), output = join(work, 'rig.mci.json');
    const original = JSON.parse(readFileSync(source, 'utf8'));
    const request = { version: 1, motion: { controllers: [{ id: 'hand-target', space: 'rig', x: 320, y: 180 }] } };
    const cli = join(repo, 'plugins/mid-century-ink/skills/mid-century-ink/scripts/controls.mjs');
    const run = () => spawnSync(process.execPath, [cli, source, spec, '--out', output, '--repo', resolve(repo)], { encoding: 'utf8' });
    writeFileSync(spec, JSON.stringify(request));
    const good = run(); assert.equal(good.status, 0, good.stderr);
    const result = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(result.version, 4); assert.equal(result.svg, original.svg); assert.deepEqual(result.metadata, original.metadata);
    request.motion.controllers[0].space = 'stage';
    writeFileSync(spec, JSON.stringify(request)); writeFileSync(output, 'protected');
    const bad = run(); assert.notEqual(bad.status, 0); assert.equal(readFileSync(output, 'utf8'), 'protected');
  } finally { rmSync(work, { recursive: true, force: true }); }
});
