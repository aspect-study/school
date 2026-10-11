const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const S = require(worldFile('stamina.js'));

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg || a + ' is not ' + b);
const run = (st, seconds, input) => { for (let i = 0; i < seconds * 2; i++) st.tick(0.5, input); return st.state(); };

test('running for 8 seconds fills the heart and makes her tired', () => {
  const st = S.create();
  const half = run(st, 4, { running: true });
  near(half.heart, 0.5);
  assert.equal(half.tired, false);
  const full = run(st, 4, { running: true });
  near(full.heart, 1);
  assert.equal(full.tired, true);
  near(run(st, 4, { running: true }).heart, 1, 'the heart never goes above 1');
});

test('walking calms the heart in about 6 seconds, standing twice as fast', () => {
  const walk = S.create();
  run(walk, 8, { running: true });
  near(run(walk, 3, {}).heart, 0.5);
  const still = S.create();
  run(still, 8, { running: true });
  near(run(still, 3, { still: true }).heart, 0);
  near(run(still, 3, { still: true }).heart, 0, 'the heart never goes below 0');
});

test('she is tired until the heart is at or below 0.3, then can run again', () => {
  const st = S.create();
  run(st, 8, { running: true });
  assert.equal(run(st, 4, {}).tired, true, 'about 0.33 after 4 seconds of walking: still tired');
  assert.equal(run(st, 1, {}).tired, false, 'about 0.17 after 5 seconds: calm');
  assert.equal(run(st, 1, { running: true }).tired, false, 'a short run does not tire her again at once');
});

test('paused (a playmate game) keeps the heart at 0 and never tires her', () => {
  const st = S.create();
  run(st, 8, { running: true });
  const s = st.tick(0.5, { running: true, paused: true });
  assert.deepEqual(s, { heart: 0, tired: false });
  near(run(st, 20, { running: true, paused: true }).heart, 0);
});

test('pulse and beat timings follow the heart', () => {
  near(S.pulseSeconds(0), 1.2);
  near(S.pulseSeconds(1), 0.35);
  assert.ok(S.pulseSeconds(0.5) < S.pulseSeconds(0.2));
  assert.equal(S.beatGap(0), null);
  assert.equal(S.beatGap(0.66), null, 'no beat until the last third');
  near(S.beatGap(0.67 + 1e-9), 0.9 - 0.55 * ((0.67 + 1e-9 - 0.66) / 0.34));
  near(S.beatGap(1), 0.35);
});

test('a tap on the run button: starts only while moving, ends a run, ignored when still or tired', () => {
  assert.equal(S.sprintTap({ sprinting: false, moving: true, tired: false }), true);
  assert.equal(S.sprintTap({ sprinting: false, moving: false, tired: false }), null, 'standing still: nothing');
  assert.equal(S.sprintTap({ sprinting: false, moving: true, tired: true }), null, 'tired: nothing');
  assert.equal(S.sprintTap({ sprinting: true, moving: true, tired: false }), false, 'a tap ends the run');
  assert.equal(S.sprintTap({ sprinting: true, moving: false, tired: true }), false, 'a run can always be ended');
});

test('a bad dt (NaN, negative, zero) leaves the state unchanged', () => {
  const st = S.create();
  run(st, 4, { running: true });
  const before = st.state();
  assert.deepEqual(st.tick(NaN, { running: true }), before);
  assert.deepEqual(st.tick(-1, { running: true }), before);
  assert.deepEqual(st.tick(0, {}), before);
});

test('running wins when both running and still are set', () => {
  const st = S.create();
  near(run(st, 4, { running: true, still: true }).heart, 0.5);
});

test('standing still calms a full heart by 1/3 per second', () => {
  const st = S.create();
  run(st, 8, { running: true });
  near(run(st, 1.5, { still: true }).heart, 0.5);
});

test('tired clears just below 0.3 and not just above it', () => {
  const st = S.create();
  run(st, 8, { running: true });
  run(st, 4, {});
  st.tick(0.1, {});
  near(st.state().heart, 1 - 4.1 / 6);
  assert.equal(st.state().tired, true, 'heart about 0.317 is still tired');
  st.tick(0.2, {});
  assert.equal(st.state().tired, false, 'heart about 0.283 is calm');
});
