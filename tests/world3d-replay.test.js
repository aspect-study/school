const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const R = require(worldFile('replay.js'));

const at = (x, face) => ({ a: { x, z: 0, face: face || 0 } });

test('keeps the last 2.5 s: the span is at least 2.5 s and less than 2.5 s plus one frame', () => {
  const r = R.create();
  for (let i = 0; i <= 100; i++) r.push(0.1, at(i));
  const clip = r.clip();
  const span = R.length(clip);
  assert.ok(span >= R.KEEP - 1e-9 && span < R.KEEP + 0.1 - 1e-9, 'span ' + span);
  assert.ok(clip.length >= 26 && clip.length <= 27, 'frames ' + clip.length);
  assert.equal(clip[clip.length - 1].at.a.x, 100);
  assert.equal(clip[0].at.a.x, 100 - (clip.length - 1));
});

test('a recording shorter than 2.5 s keeps everything; clear empties it', () => {
  const r = R.create();
  for (let i = 0; i < 10; i++) r.push(0.1, at(i));
  assert.equal(r.clip().length, 10);
  r.clear();
  assert.equal(r.clip().length, 0);
});

test('sample interpolates between frames and clamps outside the clip', () => {
  const r = R.create();
  r.push(1, at(0, 0));
  r.push(1, at(10, 1));
  const clip = r.clip();
  assert.equal(R.length(clip), 1);
  assert.equal(R.sample(clip, 0.5).a.x, 5);
  assert.equal(R.sample(clip, 0).a.x, 0);
  assert.equal(R.sample(clip, 1).a.x, 10);
  assert.equal(R.sample(clip, 99).a.x, 10);
  assert.equal(R.sample(clip, -5).a.x, 0);
});

test('sample picks the right segment across several frames', () => {
  const r = R.create();
  r.push(0.1, at(0));
  r.push(0.1, at(10));
  r.push(0.3, at(40));
  const clip = r.clip();
  assert.ok(Math.abs(R.sample(clip, 0.1).a.x - 10) < 1e-9);
  assert.ok(Math.abs(R.sample(clip, 0.25).a.x - 25) < 1e-9);
});

test('a one-frame clip and an empty clip do not throw', () => {
  const r = R.create();
  assert.deepEqual(R.sample(r.clip(), 0), {});
  assert.equal(R.length(r.clip()), 0);
  r.push(0.1, at(7));
  assert.equal(R.sample(r.clip(), 0.5).a.x, 7);
  assert.equal(R.length(r.clip()), 0);
  const pl = R.player(r.clip(), 0.3);
  assert.equal(pl.tick(0.1).a.x, 7);
  assert.equal(pl.done(), true);
  const e = R.player([], 0.3);
  assert.deepEqual(e.tick(0.1), {});
  assert.equal(e.done(), true);
});

test('player at speed 0.3 lasts length / 0.3 seconds, ends on the last frame, and can be skipped', () => {
  const r = R.create();
  for (let i = 0; i < 40; i++) r.push(0.1, at(i));
  const clip = r.clip();
  const want = R.length(clip) / 0.3;
  const pl = R.player(clip, 0.3);
  let t = 0, p;
  while (!pl.done() && t < 20) { p = pl.tick(0.1); t += 0.1; }
  assert.ok(Math.abs(t - want) <= 0.1 + 1e-9, t + ' vs ' + want);
  assert.ok(want > 8.3 && want < 8.7, String(want));
  assert.equal(p.a.x, clip[clip.length - 1].at.a.x);
  const q = R.player(clip, 0.3);
  assert.equal(q.done(), false);
  q.skip();
  assert.equal(q.done(), true);
});
