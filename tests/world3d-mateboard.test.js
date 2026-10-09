const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const B = require(worldFile('mateboard.js'));
const R = require(worldFile('rides.js'));
const L = require(worldFile('layout.js'));

const pr = L.props('grade5');
const ends = {};
L.rideSpots('grade5').forEach((s) => { ends[s.id] = s.end; });
const half = () => 0.5;

function run(b, seconds, now) {
  const ev = [];
  for (let i = 0; i < seconds * 10; i++) ev.push(...b.tick(0.1, typeof now === 'function' ? now(i / 10) : now));
  return ev;
}

test('kids take free seats and never a full or moving ride', () => {
  const b = B.create(pr, ends, half);
  assert.equal(b.claim('a', 'seesaw'), 0);
  assert.equal(b.claim('a', 'swings'), -1, 'one seat per kid');
  assert.equal(b.claim('b', 'seesaw'), 1);
  assert.equal(b.claim('c', 'seesaw'), -1, 'full');
  b.tick(0.1, null);
  assert.ok(b.running('seesaw'), 'two kids: the see-saw goes');
  b.leave('b');
  assert.equal(b.claim('c', 'seesaw'), -1, 'no hopping on while it moves');
});

test('two kids on the see-saw ride opposite ends, then land at the ride end', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'seesaw');
  run(b, 0.5, null);
  assert.equal(b.running('seesaw'), false, 'one kid waits for a partner');
  b.claim('b', 'seesaw');
  run(b, 1.3, null);
  const pa = b.pose('a'), pb = b.pose('b'), mid = 0.9 - 1.05 + 0.15;
  assert.ok(Math.abs((pa.y - mid) + (pb.y - mid)) < 1e-9);
  const ev = run(b, 20, null);
  assert.deepEqual(ev.filter((e) => e.type === 'land').map((e) => e.kid).sort(), ['a', 'b']);
  assert.equal(b.seatOf('a'), null);
  assert.equal(b.parts().seesaw, R.part('seesaw', null), 'back at rest');
});

test('she gets her seat: a kid on it moves over, or gets off when the ride is full', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'merry');
  let ev = b.tick(0.1, { id: 'merry', t: 0, stopAt: null });
  assert.equal(ev[0].type, 'start');
  assert.deepEqual(ev[0].bumped, []);
  assert.deepEqual(b.seatOf('a'), { id: 'merry', i: 1 }, 'moved to the next spot');
  const c = B.create(pr, ends, half);
  c.claim('a', 'swings');
  c.claim('b', 'swings');
  ev = c.tick(0.1, { id: 'swings', t: 0, stopAt: null });
  assert.deepEqual(ev[0].bumped.map((x) => x.kid), ['a']);
  assert.equal(c.seatOf('a'), null);
  assert.deepEqual(c.seatOf('b'), { id: 'swings', i: 1 });
});

test('a friend on her ride moves with it and lands with her', () => {
  const b = B.create(pr, ends, half);
  b.tick(0.1, { id: 'seesaw', t: 0, stopAt: null });
  assert.equal(b.claim('a', 'seesaw'), 1, 'her seat is never given to a kid');
  b.tick(0.1, { id: 'seesaw', t: 3.3, stopAt: null });
  const a = R.runPart('seesaw', 3.3, null);
  assert.deepEqual(b.pose('a'), R.partner(pr, 'seesaw', a));
  assert.equal('seesaw' in b.parts(), false, 'play.js turns her own ride');
  const ev = b.tick(0.1, null);
  assert.deepEqual(ev.filter((e) => e.type === 'land').map((e) => e.kid), ['a']);
});

test('the other swing swings opposite her', () => {
  const b = B.create(pr, ends, half);
  b.tick(0.1, { id: 'swings', t: 0, stopAt: null });
  b.claim('a', 'swings');
  b.tick(0.1, { id: 'swings', t: 2.6, stopAt: null });
  const a = R.runPart('swings', 2.6, null);
  assert.equal(b.parts().swing2, -a);
  assert.deepEqual(b.pose('a'), R.partner(pr, 'swings', -a));
});

test('the next kid down the slide follows her a second later and lands after her', () => {
  const b = B.create(pr, ends, half);
  b.tick(0.1, { id: 'slide', t: 0, stopAt: null });
  b.claim('a', 'slide');
  b.tick(0.1, { id: 'slide', t: 0.5, stopAt: null });
  assert.equal(b.running('slide1'), false);
  b.tick(0.1, { id: 'slide', t: 1.1, stopAt: null });
  assert.equal(b.running('slide1'), true);
  let ev = b.tick(0.1, null);
  assert.deepEqual(ev.filter((e) => e.type === 'land'), [], 'still sliding when she lands');
  ev = run(b, 3, null);
  const land = ev.filter((e) => e.type === 'land');
  assert.equal(land.length, 1);
  assert.equal(land[0].end.x, ends.slide.x + 1.4, 'lands beside her spot');
});

test('kids on the merry-go-round wait a moment for friends, then spin a few loops', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'merry');
  run(b, 1, null);
  assert.equal(b.claim('b', 'merry'), 1, 'friends can still hop on');
  run(b, 1, null);
  assert.equal(b.running('merry'), true);
  const pa = b.pose('a'), pb = b.pose('b');
  assert.ok(Math.hypot(pa.x - pb.x, pa.z - pb.z) > 2);
  const ev = run(b, 20, null);
  assert.equal(ev.filter((e) => e.type === 'land').length, 2);
});

test('clear empties every seat and run', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'swings');
  b.tick(0.1, null);
  b.clear();
  assert.equal(b.seatOf('a'), null);
  assert.equal(b.running('swings'), false);
});

test('a kid already sliding down when she gets on the slide finishes the slide instead of jumping back up', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'slide');
  run(b, 1, null);
  const before = b.pose('a');
  const ev = b.tick(0.1, { id: 'slide', t: 0, stopAt: null });
  assert.deepEqual(ev[0].bumped, []);
  assert.deepEqual(b.seatOf('a'), { id: 'slide', i: 1 });
  assert.ok(b.pose('a').z > before.z, 'still going down');
  const land = run(b, 1, { id: 'slide', t: 0.5, stopAt: null }).filter((e) => e.type === 'land');
  assert.deepEqual(land.map((e) => e.kid), ['a'], 'lands while she is still on the slide');
  assert.equal(land[0].end.x, ends.slide.x + 1.4);
});
