const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Chatter = require(worldFile('chatter.js'));

const kid = (id, x) => ({ id, speaker: { id }, x, z: 0, head: 4, hidden: false });
const HER = { x: 0, z: 0 };

// Steps the scheduler once per second for `seconds`; calls back with the second and the bubbles on screen.
function run(chatter, mode, speakers, seconds, extra, each) {
  for (let t = 1; t <= seconds; t++) {
    const input = Object.assign({ mode, her: HER, speakers, silent: false }, extra);
    each(t, chatter.step(1, input));
  }
}

test('Quiet shows no bubbles at all', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  run(c, 'quiet', [kid('a', 3)], 60, {}, (t, list) => assert.equal(list.length, 0));
});

test('Calm: a near speaker speaks after the warm-up and the bubble follows its head', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const sp = [kid('a', 3)];
  let first = null;
  run(c, 'calm', sp, 3, {}, (t, list) => { if (list.length && !first) first = { t, b: list[0] }; });
  assert.equal(first.t, 2);
  assert.equal(first.b.text, 'Hi!');
  assert.equal(first.b.y, 4);
  sp[0].x = 7;
  const list = c.step(1, { mode: 'calm', her: HER, speakers: sp, silent: false });
  assert.equal(list.length, 1);
  assert.equal(list[0].x, 7);
});

test('a speaker beyond the radius never speaks (Calm 12, Chatty 16)', () => {
  const calm = Chatter.create({ rand: () => 0, ask: () => 'Hi!' }), chatty = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  run(calm, 'calm', [kid('a', 14)], 60, {}, (t, list) => assert.equal(list.length, 0));
  let seen = 0;
  run(chatty, 'chatty', [kid('a', 14)], 60, {}, (t, list) => { seen += list.length; });
  assert.ok(seen > 0);
});

test('Calm never shows more than 2 bubbles and does reach 2', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  let max = 0;
  run(c, 'calm', [kid('a', 3), kid('b', 4), kid('c', 5)], 90, {}, (t, list) => { max = Math.max(max, list.length); });
  assert.equal(max, 2);
});

test('Chatty allows 3 at once', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  let max = 0;
  run(c, 'chatty', [kid('a', 3), kid('b', 4), kid('c', 5), kid('d', 6)], 90, {}, (t, list) => { max = Math.max(max, list.length); });
  assert.equal(max, 3);
});

test('in Calm new bubbles start at least 3 seconds apart', () => {
  const births = [];
  let now = 0;
  const c = Chatter.create({ rand: () => 0, ask: () => { births.push(now); return 'Hi!'; } });
  run(c, 'calm', [kid('a', 3), kid('b', 4), kid('c', 5)], 60, {}, (t) => { now = t; });
  // ask runs inside step(), before `now` is updated, so every birth is one second early; the gaps are exact.
  assert.ok(births.length >= 3);
  for (let i = 1; i < births.length; i++) assert.ok(births[i] - births[i - 1] >= 3, births.join(','));
});

test('one speaker waits at least the Calm gap (20 s) between speeches', () => {
  const births = [];
  let now = 0;
  const c = Chatter.create({ rand: () => 0, ask: () => { births.push(now + 1); return 'Hi!'; } });
  run(c, 'calm', [kid('a', 3)], 100, {}, (t) => { now = t; });
  assert.ok(births.length >= 3);
  for (let i = 1; i < births.length; i++) assert.ok(births[i] - births[i - 1] >= 20, births.join(','));
});

test('a bubble lasts about 4 seconds', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const seen = [];
  run(c, 'calm', [kid('a', 3)], 12, {}, (t, list) => seen.push(list.length));
  assert.deepEqual(seen.slice(0, 8), [0, 1, 1, 1, 1, 0, 0, 0]);
});

test('silent clears the bubbles and blocks new ones', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const sp = [kid('a', 3)];
  run(c, 'calm', sp, 3, {}, () => {});
  const during = c.step(1, { mode: 'calm', her: HER, speakers: sp, silent: true });
  assert.equal(during.length, 0);
  run(c, 'calm', sp, 40, { silent: true }, (t, list) => assert.equal(list.length, 0));
});

test('ask returning nothing shows no bubble and the speaker tries again after its gap', () => {
  let calls = 0;
  const c = Chatter.create({ rand: () => 0, ask: () => { calls++; return null; } });
  run(c, 'calm', [kid('a', 3)], 50, {}, (t, list) => assert.equal(list.length, 0));
  assert.ok(calls >= 2 && calls <= 3, 'asked ' + calls);
});

test('a hidden speaker does not speak and its bubble goes', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const sp = [kid('a', 3)];
  run(c, 'calm', sp, 3, {}, () => {});
  sp[0].hidden = true;
  assert.equal(c.step(1, { mode: 'calm', her: HER, speakers: sp, silent: false }).length, 0);
});

test('the bubble fades in and out', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const alphas = [];
  run(c, 'calm', [kid('a', 3)], 6, {}, (t, list) => { if (list.length) alphas.push(list[0].alpha); });
  assert.equal(alphas[0], 0);
  assert.equal(alphas[1], 1);
});
