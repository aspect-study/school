const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const C = require(worldFile('backdrop-core.js'));
const Pets = require(worldFile('pets.js'));

test('pickGrade picks Campus below one half and Bayan from one half up', () => {
  assert.equal(C.pickGrade(() => 0), 'grade5');
  assert.equal(C.pickGrade(() => 0.49), 'grade5');
  assert.equal(C.pickGrade(() => 0.5), 'grade2');
  assert.equal(C.pickGrade(() => 0.99), 'grade2');
});

test('mode: off without WebGL, still with reduced motion, run otherwise', () => {
  assert.equal(C.mode({ webgl: false, reduced: false }), 'off');
  assert.equal(C.mode({ webgl: false, reduced: true }), 'off');
  assert.equal(C.mode({ webgl: true, reduced: true }), 'still');
  assert.equal(C.mode({ webgl: true, reduced: false }), 'run');
});

test('every pet is a free pet the world knows', () => {
  C.PET_IDS.forEach((id) => {
    const p = Pets.find(id);
    assert.ok(p, id);
    assert.equal(p.coins, 0, id + ' is free');
  });
});

test('viewOf circles the focus at a fixed distance and height, looking at it', () => {
  const a = C.viewOf({ x: 10, z: 20 }, 0), b = C.viewOf({ x: 10, z: 20 }, 7);
  [a, b].forEach((v) => {
    assert.ok(Math.abs(Math.hypot(v.x - 10, v.z - 20) - C.RADIUS) < 1e-9);
    assert.equal(v.y, C.HEIGHT);
  });
  assert.notEqual(a.x, b.x);
});

test('ease moves part of the way and never overshoots', () => {
  assert.equal(C.ease(0, 10, 0, 2), 0);
  const v = C.ease(0, 10, 0.5, 2);
  assert.ok(v > 0 && v < 10);
  assert.ok(Math.abs(C.ease(0, 10, 100, 2) - 10) < 1e-6);
});

test('petSpot sits behind the kid on alternating sides', () => {
  const kid = { x: 0, z: 0, face: 0 };
  const left = C.petSpot(kid, 0), right = C.petSpot(kid, 1);
  assert.ok(left.z < 0 && right.z < 0, 'behind a kid facing +z');
  assert.ok(left.x * right.x < 0, 'opposite sides');
});

test('stepPet walks toward its spot at most PET_SPEED and stops there', () => {
  const pet = { x: 0, z: 0, face: 0 };
  const r = C.stepPet(pet, { x: 0, z: 20 }, 1);
  assert.equal(r.moving, true);
  assert.ok(Math.abs(pet.z - C.PET_SPEED) < 1e-9);
  assert.equal(pet.face, 0);
  const near = { x: 0, z: 0, face: 1 };
  assert.equal(C.stepPet(near, { x: 0.05, z: 0 }, 1).moving, false);
  assert.equal(near.x, 0.05);
});

test('stepPet jumps a pet that is left far behind', () => {
  const pet = { x: 0, z: 0, face: 0 };
  C.stepPet(pet, { x: 0, z: 200 }, 0.016);
  assert.equal(pet.z, 200);
});

test('slowWatch fires only after a full window of slow frames', () => {
  const w = C.slowWatch();
  for (let i = 0; i < 200; i++) assert.equal(w.push(0.02), false, 'fast frames never fire');
  const s = C.slowWatch();
  let fired = false;
  for (let i = 0; i < 200 && !fired; i++) fired = s.push(0.1);
  assert.equal(fired, true);
  const seconds = (() => { const x = C.slowWatch(); let t = 0; while (!x.push(0.1)) t += 0.1; return t; })();
  assert.ok(seconds >= C.SLOW_SECONDS - 0.2, 'not before ' + C.SLOW_SECONDS + ' seconds');
});

test('a few slow frames among fast ones do not fire', () => {
  const w = C.slowWatch();
  for (let i = 0; i < 300; i++) assert.equal(w.push(i % 10 === 0 ? 0.3 : 0.02), false);
});
