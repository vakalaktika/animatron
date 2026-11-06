#!/usr/bin/env node
// Requires an explicit checkout: private plugin releases never imply a deployed app capability.
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function runMotionCommand(argv, mode = 'composition') {
  const args = [...argv], repoIndex = args.indexOf('--repo'), outIndex = args.indexOf('--out');
  if (repoIndex < 0 || outIndex < 0 || !args[repoIndex + 1] || !args[outIndex + 1]) throw new Error('Supply input.json controls.json --out result.json --repo /path/to/animatron [--offline]');
  const repo = resolve(args[repoIndex + 1]), output = resolve(args[outIndex + 1]);
  const files = args.filter((_, i) => i !== repoIndex && i !== repoIndex + 1 && i !== outIndex && i !== outIndex + 1 && args[i] !== '--offline');
  if (files.length !== 2 || files.some(file => file.startsWith('--'))) throw new Error('Supply exactly one source and one controls specification');
  for (const file of files) if (statSync(resolve(file)).size > 32 * 1024 * 1024) throw new Error('Input exceeds the 32 MiB file budget');
  if (!existsSync(join(repo, 'src/app/components/motion-studio/engine/motionScene.ts'))) throw new Error('Selected checkout does not support Document 4 / Rig 4 motion');
  const require = createRequire(join(repo, 'package.json'));
  const esbuild = require('esbuild');
  const work = mkdtempSync(join(tmpdir(), 'animatron-motion-'));
  const temporary = join(dirname(output), `.${basename(output)}.${process.pid}.tmp`);
  try {
    const entry = fileURLToPath(new URL('./motionharness.ts', import.meta.url)), bundle = join(work, 'harness.mjs');
    esbuild.buildSync({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { '@': join(repo, 'src') }, logLevel: 'silent' });
    const result = spawnSync(process.execPath, [bundle, resolve(files[0]), resolve(files[1]), temporary, mode, repo], { encoding: 'utf8', maxBuffer: 256 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Application motion validation failed');
    if (!existsSync(temporary) || statSync(temporary).size > 32 * 1024 * 1024) throw new Error('Missing result or result exceeds the 32 MiB output budget');
    const summary = JSON.parse(result.stdout);
    renameSync(temporary, output);
    return { output, ...summary };
  } finally {
    rmSync(temporary, { force: true });
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = runMotionCommand(process.argv.slice(2));
    console.log(`Wrote ${result.output}: ${result.duration.toFixed(2)} s; ${result.sampleCount} evaluated times; ${result.controllers} controllers; ${result.constraints} constraints. ${result.notes.join(' ')}`);
  } catch (error) { console.error(`motion-program: ${error.message}`); process.exitCode = 1; }
}
