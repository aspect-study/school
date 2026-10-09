const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile, web } = require('./paths.js');
const R = require(worldFile('rides.js'));
const L = require(worldFile('layout.js'));

const pr = L.props('grade5');
const steps = Array.from({ length: 21 }, (_, i) => i / 20);

test('each ride takes a few seconds and ends at rest', () => {
  assert.deepEqual(Object.keys(R.RIDES), ['slide', 'swings', 'seesaw', 'merry']);
  for (const id of Object.keys(R.RIDES)) {
    assert.ok(R.RIDES[id].time >= 1.5 && R.RIDES[id].time <= 5, id);
    assert.equal(R.part(id, 1), R.part(id, null), id + ' stops where it rests');
    assert.equal(R.part(id, 0), R.part(id, null), id + ' starts where it rests');
  }
});

test('her pose stays sensible all ride long, in the playground', () => {
  const pg = L.places('grade5').playground;
  for (const id of Object.keys(R.RIDES)) {
    for (const k of steps) {
      const p = R.pose(pr, id, k);
      for (const f of ['x', 'y', 'z', 'face']) assert.ok(Number.isFinite(p[f]), id + ' ' + f + ' at ' + k);
      assert.ok(p.y >= -1 && p.y < 4, id + ' height at ' + k);
      assert.ok(Math.hypot(p.x - pg.x, p.z - pg.z) < pg.r, id + ' at ' + k);
    }
  }
});

test('she sits on the swing and moves with its seat', () => {
  const k = 0.12, a = R.part('swings', k), p = R.pose(pr, 'swings', k);
  assert.ok(Math.abs(a) > 0.3, 'the swing is out');
  assert.equal(p.sit, true);
  assert.ok(Math.abs(p.z - (pr.swings.z - 3.2 * Math.sin(a))) < 1e-9);
});

test('the slide takes her from the top to the bottom', () => {
  const top = R.pose(pr, 'slide', 0.3), low = R.pose(pr, 'slide', 0.95);
  assert.ok(top.y > low.y && low.z > top.z);
  assert.equal(low.sit, true);
});

test('the merry-go-round carries her round its middle', () => {
  const a = R.pose(pr, 'merry', 0.25), b = R.pose(pr, 'merry', 0.5);
  for (const p of [a, b]) assert.ok(Math.abs(Math.hypot(p.x - pr.merry.x, p.z - pr.merry.z) - 1.5) < 1e-9);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.5, 'she moved round');
});

test('the slide ramp is high at the ladder tower, where her ride starts down it', () => {
  const THREE = require(web('vendor/three/three.min.js'));
  const src = fs.readFileSync(worldFile('build.js'), 'utf8');
  assert.match(src, /rbox\(1\.6, 0\.3, ramp\.half \* 2, 0\.15\), '#ff8fab', sl\.x, ramp\.y, sl\.z \+ ramp\.dz, null\)\.rotation\.x = ramp\.tilt;/,
    'build.js draws the ramp from Rides.RAMP, tilted the same way');
  const sl = pr.slide, ramp = new THREE.Object3D();
  ramp.position.set(sl.x, R.RAMP.y, sl.z + R.RAMP.dz);
  ramp.rotation.x = R.RAMP.tilt;
  ramp.updateMatrixWorld();
  const towerEnd = ramp.localToWorld(new THREE.Vector3(0, 0, -R.RAMP.half));
  const farEnd = ramp.localToWorld(new THREE.Vector3(0, 0, R.RAMP.half));
  assert.ok(towerEnd.y > farEnd.y, 'the end by the tower is the high one');
  const start = R.pose(pr, 'slide', 0.25), end = R.pose(pr, 'slide', 1);
  assert.ok(Math.abs(start.z - towerEnd.z) < 1e-9 && Math.abs(start.y - (towerEnd.y - 1.05 + 0.05)) < 1e-9, 'she sits on the top end');
  assert.ok(Math.abs(end.z - farEnd.z) < 1e-9 && Math.abs(end.y - Math.max(0, farEnd.y - 1.05 + 0.05)) < 1e-9, 'she slides off the low end');
});

test('ride cues: each ride\'s sound moments come once each, however the frames fall', () => {
  for (const id of Object.keys(R.RIDES)) {
    const all = R.CUES[id].map((c) => c[1]);
    assert.equal(all[0], 'ride-start', id);
    assert.equal(all[all.length - 1], 'ride-land', id);
    assert.deepEqual(R.cues(id, -1, 1), all, id + ' whole ride');
    let framed = R.cues(id, -1, 0);
    for (let i = 0; i < 10; i++) framed = framed.concat(R.cues(id, i / 10, (i + 1) / 10));
    assert.deepEqual(framed, all, id + ' in frames of 0.1');
    assert.deepEqual(R.cues(id, -1, 0).concat(R.cues(id, 0, 1)), all, id + ' in one long frame');
  }
  assert.equal(R.cues('swings', -1, 1).filter((c) => c === 'swing').length, 3);
  assert.equal(R.cues('seesaw', -1, 1).filter((c) => c === 'seesaw-bump').length, 4);
  assert.deepEqual(R.cues('merry', -1, 0), ['ride-start', 'merry-start']);
  assert.deepEqual(R.cues('nope', -1, 1), []);
  assert.deepEqual(R.cues('constructor', -1, 1), []);
});

test('the cues sit where the ride maths says: swings at the bottom, the see-saw at a touchdown', () => {
  for (const [k, name] of R.CUES.swings) if (name === 'swing') assert.ok(Math.abs(R.part('swings', k)) < 1e-9, 'swing at ' + k);
  for (const [k, name] of R.CUES.seesaw) if (name === 'seesaw-bump') assert.ok(Math.abs(Math.abs(R.part('seesaw', k)) - 0.3) < 1e-9, 'bump at ' + k);
  const slideGo = R.CUES.slide.filter((c) => c[1] === 'slide-go')[0][0];
  assert.equal(R.pose(pr, 'slide', slideGo - 0.01).y, R.pose(pr, 'slide', 0).y, 'still at the top just before');
  assert.ok(R.pose(pr, 'slide', slideGo + 0.05).y < R.pose(pr, 'slide', 0).y, 'going down just after');
});

const LAP = { swings: 2, seesaw: 2, merry: 4 / 3 };
const same = (a, b, eps) => Math.abs(Math.sin(a) - Math.sin(b)) < eps && Math.abs(Math.cos(a) - Math.cos(b)) < eps;

test('the swings, see-saw and merry-go-round loop until Stop; the slide does not', () => {
  assert.deepEqual(Object.keys(R.LOOPS), ['swings', 'seesaw', 'merry']);
  for (const id of Object.keys(R.LOOPS)) assert.ok(Math.abs(R.LOOPS[id] - LAP[id]) < 1e-12, id);
  assert.equal(R.loops('slide'), false);
  assert.equal(R.loops('swings'), true);
  assert.equal(R.loops('nope'), false);
});

test('a loop joins itself: one lap later the ride is in the same place', () => {
  for (const id of Object.keys(LAP)) {
    for (let t = 2; t < 12; t += 0.37) assert.ok(same(R.loopPart(id, t, null), R.loopPart(id, t + LAP[id], null), 1e-9), id + ' at ' + t);
  }
});

test('a looping ride starts like today\'s ride and never jumps, with or without Stop', () => {
  for (const id of Object.keys(LAP)) {
    for (let t = 0; t < 2; t += 0.1) assert.ok(Math.abs(R.loopPart(id, t, null) - R.part(id, t / 4)) < 1e-9, id + ' start at ' + t);
    for (const stopAt of [null, 0.5, 3.3, 7.9]) {
      let prev = R.loopPart(id, 0, stopAt);
      for (let t = 0.01; t < 14; t += 0.01) {
        const a = R.loopPart(id, t, stopAt);
        assert.ok(same(a, prev, 0.1), id + ' jumps at ' + t + ' (stop ' + stopAt + ')');
        prev = a;
      }
    }
  }
});

test('Stop ends the ride at rest, on a loop boundary at or after the tap and never before 2 s', () => {
  assert.equal(R.endAt('swings', null), null);
  assert.equal(R.endAt('swings', 0.5), 2);
  assert.equal(R.endAt('swings', 3.3), 4);
  assert.equal(R.endAt('swings', 4), 4);
  assert.equal(R.endAt('swings', 7.9), 8);
  assert.ok(Math.abs(R.endAt('merry', 3.3) - (2 + 4 / 3)) < 1e-9);
  for (const id of Object.keys(LAP)) {
    for (const stopAt of [0.5, 3.3, 7.9]) {
      const e = R.endAt(id, stopAt), rest = R.part(id, null);
      assert.ok(e >= stopAt && e >= 2, id + ' ends after the tap');
      assert.equal(R.loopDone(id, e + 2 - 0.01, stopAt), false, id);
      assert.equal(R.loopDone(id, e + 2, stopAt), true, id);
      assert.equal(R.loopPart(id, e + 2, stopAt), rest, id + ' rests once done');
      assert.ok(same(R.loopPart(id, e + 2 - 1e-6, stopAt), rest, 1e-4), id + ' comes to rest just before landing');
    }
    assert.equal(R.loopDone(id, 1000, null), false, id + ' goes on until Stop');
  }
});

test('looping ride cues: the start once, a creak every second, a bump per touchdown, the ending once after Stop', () => {
  const frames = (id, stopAt, until) => {
    let list = R.loopCues(id, -1, 0, stopAt);
    for (let t = 0; t < until; t += 0.1) list = list.concat(R.loopCues(id, t, t + 0.1, stopAt));
    return list;
  };
  const count = (list, name) => list.filter((c) => c === name).length;
  const swings = frames('swings', 5.5, 12);
  assert.equal(swings[0], 'ride-start');
  assert.equal(swings[swings.length - 1], 'ride-land');
  assert.deepEqual([count(swings, 'ride-start'), count(swings, 'swing'), count(swings, 'ride-land')], [1, 7, 1], 'Stop at 5.5: ends at 6, lands at 8');
  assert.equal(count(frames('seesaw', 5.5, 12), 'seesaw-bump'), 8);
  assert.deepEqual(frames('merry', 3, 12), ['ride-start', 'merry-start', 'merry-slow', 'ride-land']);
  for (const id of Object.keys(LAP)) assert.deepEqual(frames(id, 0, 12), R.cues(id, -1, 1), id + ': Stop straight away sounds like today\'s ride');
  const forever = frames('swings', null, 30.5);
  assert.deepEqual([count(forever, 'swing'), count(forever, 'ride-land')], [30, 0], 'no Stop: a creak every second and no landing');
  assert.deepEqual(R.loopCues('swings', 9, 10, 0.5), [], 'nothing after it is done');
});

test('her looping pose stays in the playground and starts as today', () => {
  const pg = L.places('grade5').playground;
  for (const id of Object.keys(LAP)) {
    for (let t = 0; t < 12; t += 0.25) {
      const p = R.loopPose(pr, id, t, 6);
      for (const f of ['x', 'y', 'z', 'face']) assert.ok(Number.isFinite(p[f]), id + ' ' + f + ' at ' + t);
      assert.ok(p.y >= -1 && p.y < 4, id + ' height at ' + t);
      assert.ok(Math.hypot(p.x - pg.x, p.z - pg.z) < pg.r, id + ' at ' + t);
    }
    assert.deepEqual(R.loopPose(pr, id, 1.25, null), R.pose(pr, id, 1.25 / 4), id);
  }
});

test('a friend on the see-saw sits on the far end, down when she is up', () => {
  const se = pr.seesaw;
  for (const a of [-0.3, 0, 0.15, 0.3]) {
    const her = R.seat(pr, 'seesaw', a), fr = R.partner(pr, 'seesaw', a);
    assert.ok(Math.abs((her.x - se.x) + (fr.x - se.x)) < 1e-9, 'opposite ends at ' + a);
    const mid = 0.9 - 1.05 + 0.15;
    assert.ok(Math.abs((her.y - mid) + (fr.y - mid)) < 1e-9, 'one up, one down at ' + a);
    assert.equal(fr.face, Math.PI / 2, 'faces her');
    assert.equal(fr.sit, true);
  }
});

test('the other swing hangs 1.2 west of the middle, where build.js draws it', () => {
  const p = R.partner(pr, 'swings', 0);
  assert.equal(p.x, pr.swings.x - 1.2);
  assert.equal(p.z, pr.swings.z);
  assert.equal(R.seat(pr, 'swings', 0).x, pr.swings.x + 1.2);
  assert.match(fs.readFileSync(web('world/build.js'), 'utf8'), /id === 'swing2'/);
});

test('merry-go-round friends sit a quarter turn apart from her', () => {
  const her = R.seat(pr, 'merry', 0.4);
  const spots = [1, 2, 3].map((s) => R.partner(pr, 'merry', 0.4, s));
  const all = [her].concat(spots);
  for (const p of all) assert.ok(Math.abs(Math.hypot(p.x - pr.merry.x, p.z - pr.merry.z) - 1.5) < 1e-9);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    assert.ok(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z) > 2, i + ' and ' + j + ' apart');
  }
});

test('runPart and runDone follow a ride run for looping rides and the slide', () => {
  assert.equal(R.runPart('swings', 0.7, null), R.loopPart('swings', 0.7, null));
  assert.equal(R.runPart('slide', 1, null), R.part('slide', 0.5));
  assert.equal(R.runDone('slide', 1.9, null), false);
  assert.equal(R.runDone('slide', 2, null), true);
  assert.equal(R.runDone('seesaw', 100, null), false, 'no Stop yet');
  assert.equal(R.runDone('seesaw', R.endAt('seesaw', 6) + 2, 6), true);
});
