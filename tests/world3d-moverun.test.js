const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Run = require(worldFile('moverun.js'));

const still = { moving: false, free: true, clothes: '' };

test('a move runs once from k 0 to 1, with its effects, then ends', () => {
  const r = Run.create();
  assert.equal(r.start('use-bubblewand'), true);
  assert.equal(r.start('emote-wave'), false, 'one move at a time');
  const seen = [];
  let last = null;
  for (let i = 0; i < 25; i++) {
    const f = r.tick(0.1, still);
    if (f) { seen.push(...f.fx); last = f; }
  }
  assert.deepEqual(seen, ['bubbles', 'bubbles', 'bubbles']);
  assert.equal(last.k, 1);
  assert.equal(r.state(), null, 'ended');
});

test('walking, a panel or a stop() ends a move at once', () => {
  const r = Run.create();
  r.start('emote-dance');
  r.tick(0.1, still);
  assert.equal(r.tick(0.1, { moving: true, free: true }), null);
  assert.equal(r.state(), null);
  r.start('emote-dance');
  assert.equal(r.tick(0.1, { moving: false, free: false }), null);
  assert.equal(r.state(), null);
  r.start('emote-dance');
  assert.equal(r.stop(), 'emote-dance');
  assert.equal(r.state(), null);
  assert.equal(r.stop(), null, 'nothing runs');
});

test('a tap is refused while a demo runs, and no idle starts over it', () => {
  const r = Run.create();
  r.start('emote-relax', true);
  assert.equal(r.start('emote-wave'), false);
  for (let i = 0; i < 30; i++) {
    const f = r.tick(0.1, { moving: false, free: false });
    if (f) assert.equal(f.move, 'emote-relax');
  }
  assert.equal(r.state(), null, 'the demo ended, no idle followed');
});

test('a demo replaces a tap move', () => {
  const r = Run.create();
  r.start('emote-wave');
  assert.equal(r.start('emote-spin', true), true);
  assert.equal(r.state().move, 'emote-spin');
});

test('the idle comes 8 s after a move ends, not after it began', () => {
  const r = Run.create();
  r.start('emote-relax');
  let ended = false, after = 0, idleAt = null;
  for (let i = 0; i < 400 && idleAt === null; i++) {
    const f = r.tick(0.1, still);
    if (f && f.idle) idleAt = after;
    else if (f && f.k === 1) ended = true;
    else if (!f && ended) after += 0.1;
  }
  assert.ok(ended);
  assert.ok(idleAt > 7.5 && idleAt < 8.5, 'idle after ' + idleAt);
});

test('a demo at the stall keeps going while the panel is open, and replaces another demo', () => {
  const r = Run.create();
  assert.equal(r.start('emote-dance', true), true);
  assert.equal(r.tick(0.1, { moving: false, free: false }).move, 'emote-dance');
  assert.equal(r.start('emote-spin', true), true);
  assert.equal(r.state().move, 'emote-spin');
  assert.equal(r.state().demo, true);
});

test('after 8 s standing still and free she plays her outfit idle; a tap replaces an idle', () => {
  const r = Run.create();
  for (let i = 0; i < 79; i++) assert.equal(r.tick(0.1, { moving: false, free: true, clothes: 'princess' }), null);
  const f = r.tick(0.2, { moving: false, free: true, clothes: 'princess' });
  assert.equal(f.move, 'idle-princess');
  assert.equal(f.idle, true);
  assert.equal(r.start('emote-wave'), true, 'a tap replaces an idle');
  assert.equal(r.state().move, 'emote-wave');
});

test('moving or a panel resets the idle wait; unknown moves never start', () => {
  const r = Run.create();
  for (let i = 0; i < 60; i++) r.tick(0.1, still);
  r.tick(0.1, { moving: true, free: true });
  for (let i = 0; i < 60; i++) assert.equal(r.tick(0.1, still), null);
  assert.equal(r.start('nope'), false);
});

test('a stop() (a ride, quick travel) resets the idle wait too', () => {
  const r = Run.create();
  for (let i = 0; i < 70; i++) r.tick(0.1, still);
  r.stop();
  for (let i = 0; i < 70; i++) assert.equal(r.tick(0.1, still), null);
});
