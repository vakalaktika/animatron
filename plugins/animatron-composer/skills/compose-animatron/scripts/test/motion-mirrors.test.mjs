import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
test('both private plugins carry identical actual-app motion authoring implementation', () => {
  const composer = join(root, 'plugins/animatron-composer/skills/compose-animatron/scripts');
  const ink = join(root, 'plugins/mid-century-ink/skills/mid-century-ink/scripts');
  for (const file of ['motion-authoring.mjs', 'motion-program.mjs', 'motionharness.ts']) assert.equal(readFileSync(join(composer, file), 'utf8'), readFileSync(join(ink, file), 'utf8'), file);
});
test('Rig 4 schema copies are exact structural aids for both plugin packages', () => {
  const schema = readFileSync(join(root, 'docs/mci-rig/mci-rig-v4.schema.json'), 'utf8');
  for (const plugin of ['mid-century-ink/skills/mid-century-ink', 'animatron-composer/skills/compose-animatron']) assert.equal(readFileSync(join(root, 'plugins', plugin, 'references/mci-rig-v4.schema.json'), 'utf8'), schema);
  const parsed = JSON.parse(schema); assert.equal(parsed.properties.version.const, 4); assert.equal(parsed.properties.meshes.maxItems, 8);
});
