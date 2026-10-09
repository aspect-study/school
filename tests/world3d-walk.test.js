const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Walk = require(worldFile('walk.js'));

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('pushing up walks away from the camera; right walks to the camera\'s right', () => {
  const up = Walk.moveVector(0, -1, 0);
  assert.ok(close(up.x, 0) && close(up.z, -1) && up.mag === 1);
  const right = Walk.moveVector(1, 0, 0);
  assert.ok(close(right.x, 1) && close(right.z, 0));
  const turned = Walk.moveVector(0, -1, Math.PI / 2);
  assert.ok(close(turned.x, -1) && close(turned.z, 0), 'camera turned: up follows it');
});

test('a tiny push does nothing; a half push walks at half speed', () => {
  assert.equal(Walk.moveVector(0.05, 0, 0), null);
  assert.ok(close(Walk.moveVector(0, -0.5, 0).mag, 0.5));
});

test('toward stops when she arrives', () => {
  const d = Walk.toward(0, 0, 3, 4);
  assert.ok(close(d.x, 0.6) && close(d.z, 0.8));
  assert.equal(Walk.toward(0, 0, 0.1, 0.1), null);
});

test('step slides along a wall instead of stopping', () => {
  const wall = (x) => x > 1;
  const next = Walk.step(1, 0, { x: Math.SQRT1_2, z: Math.SQRT1_2, mag: 1 }, 0.1, wall);
  assert.equal(next.x, 1, 'the wall stops x');
  assert.ok(next.z > 0, 'she still slides along z');
});

test('turn takes the short way round', () => {
  const t = Walk.turn(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
  assert.ok(close(Math.cos(t), -1), 'half way the short way is pointing straight back');
  assert.ok(close(Walk.turn(0, 1, 0.5), 0.5));
});

test('facing points along the direction', () => {
  assert.ok(close(Walk.facing({ x: 0, z: -1 }), Math.PI));
  assert.ok(close(Walk.facing({ x: 1, z: 0 }), Math.PI / 2));
});

test('advance moves up to a distance toward a spot and says when it arrives', () => {
  const a = Walk.advance(0, 0, 3, 4, 1);
  assert.ok(close(a.x, 0.6) && close(a.z, 0.8) && a.arrived === false);
  assert.deepEqual(Walk.advance(0, 0, 3, 4, 5), { x: 3, z: 4, arrived: true });
});

test('sprint moves her 1.4 times as far, and walls still stop her', () => {
  const open = () => false, dir = { x: 0, z: 1, mag: 1 };
  assert.equal(Walk.SPRINT, 1.4);
  const walk = Walk.step(0, 0, dir, 0.5, open), run = Walk.step(0, 0, dir, 0.5, open, Walk.SPRINT);
  assert.ok(close(walk.z, 4.5));
  assert.ok(close(run.z, 4.5 * 1.4));
  assert.equal(Walk.step(0, 0, dir, 0.5, (x, z) => z > 1, Walk.SPRINT).z, 0);
});
