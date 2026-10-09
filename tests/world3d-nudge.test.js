const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const N = require(worldFile('nudge.js'));

test('10 minutes of world time brings one nudge, then it counts again', () => {
  assert.equal(N.LIMIT, 600);
  const n = N.create();
  let fired = 0;
  for (let i = 0; i < 599; i++) if (n.tick(1, true)) fired++;
  assert.equal(fired, 0);
  assert.equal(n.tick(1, true), true);
  assert.equal(n.tick(1, true), false, 'the timer restarts after a nudge');
});

test('time that does not count (the character maker, a hidden page) never nudges', () => {
  const n = N.create(10);
  for (let i = 0; i < 50; i++) assert.equal(n.tick(1, false), false);
  for (let i = 0; i < 9; i++) assert.equal(n.tick(1, true), false);
  assert.equal(n.tick(1, true), true);
});

test('force nudges on the next tick (the browser test uses it); reset starts again', () => {
  const n = N.create();
  n.force();
  assert.equal(n.tick(0.016, true), true);
  n.force();
  n.reset();
  assert.equal(n.tick(0.016, true), false);
});
