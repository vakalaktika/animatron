const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const core = require('../../../docs/mci-rig/mci-rig-core.cjs');
const read = name => JSON.parse(readFileSync(join(__dirname, name), 'utf8'));
const rig = () => read('sunroom-glider.mci.json');

test('generated illustration scene preserves explicit timing and safe attachment budgets', () => {
  const r = rig(), doc = read('sunroom-glider.animatron.json');
  assert.deepEqual(doc.clips.find(c => c.id === 'scene').rig, r);
  assert.deepEqual(read('sunroom-glider.playback.animatron.json'), doc);
  assert.equal(core.validate(r).ok, true, JSON.stringify(core.validate(r).errors));
  assert.equal(r.version, 2);
  assert.equal(r.rasterAttachments.length, 6);
  const room = doc.clips.find(c => c.id === 'room').rig;
  assert.equal(core.validate(room).ok, true);
  assert.deepEqual(room, read('room.mci.json'));
  assert.equal(room.rasterAttachments[0].width, 1536);
  assert.equal(doc.timeline.tailSeconds, 0);
  assert.equal(r.animations[0].duration, 8);
  assert.equal(r.animations[0].loop, true);
  assert.equal(r.metadata.artworkPath, 'generated-layered-illustration');
  assert.ok(Buffer.byteLength(JSON.stringify(doc)) < 4_000_000);
  const payload = r.rasterAttachments.reduce((n, a) => n + core.pngInfo(a.src).bytes, 0);
  assert.ok(payload <= 2_000_000);
});

test('outside bird is hidden through its reset and at both loop endpoints', () => {
  const doc = read('sunroom-glider.animatron.json');
  const bird = doc.clips.find(c => c.id === 'outside-bird');
  assert.deepEqual(bird.rig, read('bird.mci.json'));
  assert.equal(core.validate(bird.rig).ok, true);
  assert.equal(bird.rig.animations[0].duration, 8);
  assert.deepEqual(bird.keys.opacity.filter(k => k.time === 0 || k.time >= 6).map(k => k.value), [0,0,0]);
  assert.ok(bird.keys.opacity.some(k => k.time > 0 && k.time < 6 && k.value === 1));
  // Its return/reset is deliberately invisible, rather than a backward flight.
  const track = bird.rig.animations[0].tracks[0];
  assert.ok(track.keys.filter(k => k.time >= 6).every(k => Number.isFinite(k.x)));
});

test('every drawing state is exclusive and blink/turn are actual registered drawings', () => {
  const r = rig();
  for (let i = 0; i <= 384; i++) {
    const visible = core.drawingVisibility(r, 'sunroom-loop', i / 48);
    assert.equal(['head-open', 'head-blink', 'head-mid', 'head-turn'].filter(id => visible[id]).length, 1);
  }
  assert.equal(core.drawingVisibility(r, 'sunroom-loop', 1.15)['head-blink'], true);
  assert.equal(core.drawingVisibility(r, 'sunroom-loop', 3.5)['head-turn'], true);
  assert.deepEqual(core.drawingVisibility(r, 'sunroom-loop', 0), core.drawingVisibility(r, 'sunroom-loop', 7.99));
});

test('carrier keeps hand and plane together and each loop channel closes with matching velocity', () => {
  const r = rig(), contact = r.metadata.contact;
  const distance = (p, q) => Math.hypot(p.x-q.x, p.y-q.y);
  const rest = distance(contact.hand, contact.plane);
  assert.equal(r.bindings.find(b => b.svgId === 'lift').boneId, 'lift');
  for (let i = 0; i <= 384; i++) {
    const pose = core.sample(r, 'sunroom-loop', i / 48);
    const m = core.transforms(r, pose).lift;
    assert.ok(Math.abs(distance(core.point(m, contact.hand), core.point(m, contact.plane))-rest) < 1e-6);
    core.world(r, pose).root.forEach((v,i) => assert.ok(Math.abs(v-[1,0,0,1,0,0][i]) < 1e-9));
  }
  const dt = 1/24;
  for (const track of r.animations[0].tracks) {
    for (const channel of ['x','y','rotation']) {
      const sample = t => core.sample(r, 'sunroom-loop', t)[track.boneId][channel];
      assert.ok(Math.abs(sample(0)-sample(8-1e-7)) < 1e-5);
      assert.ok(Math.abs((sample(dt)-sample(0))/dt-(sample(0)-sample(8-dt))/dt) < 1e-5);
    }
  }
});

test('source parts remain transparent and edits survive serialization without losing drawings', () => {
  const r = rig(), manifest = read('part-inventory.json');
  assert.equal(manifest.parts.filter(p => p.alpha).length, 7);
  for (const part of manifest.parts.filter(p => p.alpha)) {
    assert.ok(part.alphaStats.transparent > 0);
    assert.ok(part.alphaStats.visible > 0);
    assert.ok(part.alphaStats.partial > 0);
  }
  const edited = core.record(r, 'sunroom-loop', 3, {lift:{x:0,y:0,rotation:-3}});
  const reopened = JSON.parse(JSON.stringify(edited));
  assert.equal(core.validate(reopened).ok, true);
  assert.deepEqual(reopened.rasterAttachments, r.rasterAttachments);
  assert.deepEqual(reopened.drawingSets, r.drawingSets);
  assert.equal(core.sample(reopened, 'sunroom-loop', 3).lift.rotation, -3);
});

test('actual app preview round trip retains the master and rendered endpoint pixels match', async () => {
  const sharp = require('sharp');
  assert.deepEqual(read('preview.reopened.animatron.json'), read('sunroom-glider.animatron.json'));
  const first = await sharp(join(__dirname,'preview.frame-0.00.png')).raw().toBuffer();
  const last = await sharp(join(__dirname,'preview.frame-7.96.png')).raw().toBuffer();
  assert.ok(first.equals(last), 'rendered endpoint pixels match; motion velocity is checked separately');
});
