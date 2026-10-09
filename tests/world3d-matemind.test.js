const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const Mind = require(worldFile('matemind.js'));
const M = require(worldFile('mates.js'));

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function make(seed, ways, grade = 'grade5') {
  const obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds, ends = {};
  L.rideSpots(grade).forEach((s) => { ends[s.id] = s.end; });
  return Mind.create({
    pr: L.props(grade), ends, boards: L.rideSpots(grade), area: L.places(grade).playground, rand: seeded(seed),
    kids: M.all(seeded(seed)).map((m) => ({ id: m.id, fav: m.fav, racer: m.id === 'tomas' })),
    blocked: (x, z, r) => L.blocked(obs, bounds, x, z, r), ways: ways ? L.walkways(grade) : undefined
  });
}
const pg = L.places('grade5').playground;
const away = { x: 0, z: 0, now: null };

function sim(mind, seconds, her) {
  const out = [];
  for (let i = 0; i < seconds * 10; i++) out.push(mind.tick(0.1, typeof her === 'function' ? her(i / 10) : her));
  return out;
}

test('nine kids start inside the playground, not inside a ride', () => {
  const mind = make(1), obs = L.obstacles('grade5');
  assert.equal(mind.list().length, 9);
  for (const k of mind.list()) {
    assert.ok(Math.hypot(k.x - pg.x, k.z - pg.z) < pg.r, k.id);
    assert.equal(L.blocked(obs, L.GRADES.grade5.bounds, k.x, k.z, 0.7), false, k.id);
  }
});

test('left alone, kids go and ride, and stay in the playground', () => {
  const mind = make(2);
  let rode = new Set();
  for (let i = 0; i < 600; i++) {
    mind.tick(0.1, away);
    for (const k of mind.list()) {
      if (k.seat) rode.add(k.id);
      const f = mind.frames().find((x) => x.id === k.id);
      assert.ok(Math.hypot(f.x - pg.x, f.z - pg.z) < pg.r + 1, k.id + ' stays in');
    }
  }
  assert.ok(rode.size >= 5, 'most kids rode something: ' + [...rode]);
});

test('when she rides the see-saw a kid comes and sits on the far end', () => {
  const mind = make(3);
  mind.calm();
  const sp = L.rideSpots('grade5').find((s) => s.id === 'seesaw');
  let t = 0;
  sim(mind, 8, () => ({ x: sp.x, z: sp.z, now: { id: 'seesaw', t: (t += 0.1), stopAt: null } }));
  const on = mind.list().filter((k) => k.seat && k.seat.id === 'seesaw');
  assert.equal(on.length, 1);
  assert.equal(on[0].seat.i, 1);
});

test('an invited friend follows her and gets the partner seat first, then the invite ends', () => {
  const mind = make(4);
  mind.calm();
  mind.invite('luna', 'swings');
  const sp = L.rideSpots('grade5').find((s) => s.id === 'swings');
  sim(mind, 6, { x: sp.x, z: sp.z, now: null });
  const luna = () => mind.list().find((k) => k.id === 'luna');
  assert.equal(luna().state, 'follow');
  assert.ok(Math.hypot(luna().x - sp.x, luna().z - sp.z) < 4, 'she came along');
  let t = 0;
  sim(mind, 6, () => ({ x: sp.x, z: sp.z, now: { id: 'swings', t: (t += 0.1), stopAt: null } }));
  assert.deepEqual(luna().seat, { id: 'swings', i: 1 });
  sim(mind, 0.2, { x: sp.x, z: sp.z, now: null });
  assert.equal(luna().seat, null);
  assert.equal(luna().invited, false, 'riding together used the invite');
});

test('the invite ends after a minute, or when she leaves the playground', () => {
  const mind = make(5);
  mind.calm();
  mind.invite('migo', 'merry');
  sim(mind, 61, { x: pg.x, z: pg.z, now: null });
  assert.notEqual(mind.list().find((k) => k.id === 'migo').state, 'follow');
  mind.invite('migo', 'merry');
  sim(mind, 1, { x: pg.x, z: pg.z + pg.r + 6, now: null });
  assert.notEqual(mind.list().find((k) => k.id === 'migo').state, 'follow');
});

test('a kid stops to talk; a riding kid cannot be talked to; only riding kids pop', () => {
  const mind = make(6);
  mind.calm();
  assert.equal(mind.talk('jun', true), true);
  sim(mind, 2, away);
  assert.equal(mind.list().find((k) => k.id === 'jun').state, 'talk');
  mind.talk('jun', false);
  assert.equal(mind.list().find((k) => k.id === 'jun').state, 'idle');
  assert.ok(mind.tappable().some((k) => k.id === 'jun'));
  const sp = L.rideSpots('grade5').find((s) => s.id === 'merry');
  let t = 0, pops = 0;
  for (let i = 0; i < 100; i++) {
    const out = mind.tick(0.1, { x: sp.x, z: sp.z, now: { id: 'merry', t: (t += 0.1), stopAt: null } });
    const seated = mind.list().filter((k) => k.seat).map((k) => k.id);
    for (const p of out.pops) assert.ok(seated.includes(p.kid), p.kid + ' popped while riding');
    pops += out.pops.length;
  }
  assert.ok(pops > 0, 'riders pop');
  const riders = mind.list().filter((k) => k.seat).map((k) => k.id);
  assert.ok(riders.length >= 1);
  for (const id of riders) {
    assert.equal(mind.talk(id, true), false);
    assert.ok(!mind.tappable().some((k) => k.id === id));
  }
});

// Where a kid is from her point of view: along her line to the camera, how far off it, and how far from the camera.
function view(k, her) {
  const len = Math.hypot(her.cam.x - her.x, her.cam.z - her.z), fx = (her.cam.x - her.x) / len, fz = (her.cam.z - her.z) / len;
  const dx = k.x - her.x, dz = k.z - her.z;
  return { along: dx * fx + dz * fz, side: dx * fz - dz * fx, d: Math.hypot(dx, dz), cam: Math.hypot(k.x - her.cam.x, k.z - her.cam.z), len };
}
function camFrom(x, z, yaw, dist) { return { x: x + Math.sin(yaw) * dist, z: z + Math.cos(yaw) * dist }; }

test('standing kids keep out of the lane to the camera, away from the camera and off her toes', () => {
  for (const yaw of [0, 1.3, Math.PI, -2]) {
    for (const dist of [15, 33]) {
      const mind = make(7);
      mind.calm();
      const her = { x: pg.x, z: pg.z, now: null, cam: camFrom(pg.x, pg.z, yaw, dist) };
      sim(mind, 6, her);
      for (const k of mind.list().filter((k) => k.state === 'idle')) {
        const v = view(k, her), at = ' at yaw ' + yaw + ' dist ' + dist + ': ' + JSON.stringify(v);
        assert.ok(v.d >= Mind.SPACE - 0.3, k.id + ' gives her room' + at);
        assert.ok(!(v.along > -1 && v.along < v.len && Math.abs(v.side) < Mind.LANE_W - 0.3), k.id + ' out of the camera lane' + at);
        assert.ok(v.cam >= Mind.CAM_R - 0.3, k.id + ' away from the camera' + at);
      }
    }
  }
});

test('a kid she walks up to stays within talking reach', () => {
  const mind = make(8);
  mind.calm();
  const k0 = mind.list()[0], her = { x: k0.x + 1, z: k0.z, now: null, cam: { x: k0.x + 16, z: k0.z } };
  sim(mind, 3, her);
  const k = mind.list()[0];
  assert.ok(Math.hypot(k.x - her.x, k.z - her.z) <= 2.4, 'still tappable: ' + Math.hypot(k.x - her.x, k.z - her.z));
});

test('an invited friend walks beside her, not between her and the camera', () => {
  const mind = make(4);
  mind.calm();
  mind.invite('luna', 'swings');
  const her = { x: pg.x, z: pg.z + 2, now: null, cam: camFrom(pg.x, pg.z + 2, 0.4, 15) };
  sim(mind, 8, her);
  const v = view(mind.list().find((k) => k.id === 'luna'), her);
  assert.ok(Math.abs(v.side) > Mind.LANE_W, 'beside her: ' + JSON.stringify(v));
  assert.ok(v.d < 4.5, 'close by: ' + JSON.stringify(v));
});

test('wherever she stands in the playground, kids are rarely in her view and leave her ride to her', () => {
  const spots = L.rideSpots('grade5').concat([{ id: 'middle', x: pg.x, z: pg.z }]);
  let frames = 0, inView = 0;
  for (const seed of [1, 2]) {
    for (const sp of spots) {
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const mind = make(seed), her = { x: sp.x, z: sp.z, now: null, cam: camFrom(sp.x, sp.z, yaw, 14) };
        for (let i = 0; i < 200; i++) {
          mind.tick(0.1, her);
          if (i < 50) continue;
          frames++;
          const kids = mind.list().filter((k) => !k.seat);
          if (kids.some((k) => { const v = view(k, her); return (v.along > -1 && v.along < v.len && Math.abs(v.side) < Mind.LANE_W) || v.cam < Mind.CAM_R; })) inView++;
          if (sp.id !== 'middle') assert.ok(!kids.some((k) => k.state === 'walk' && k.ride === sp.id), 'nobody heads for the ride she stands at: ' + sp.id);
        }
      }
    }
  }
  assert.ok(inView / frames < 0.06, 'in her view ' + (100 * inView / frames).toFixed(1) + '% of the time');
});

test('an invited friend reaches her side at every ride, even where a ride blocks one side', () => {
  for (const sp of L.rideSpots('grade5')) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const mind = make(3);
      mind.calm();
      mind.invite('luna', 'merry');
      const her = { x: sp.x, z: sp.z, now: null, cam: camFrom(sp.x, sp.z, yaw, 14) };
      sim(mind, 10, her);
      const v = view(mind.list().find((k) => k.id === 'luna'), her);
      assert.ok(v.d < 4.5, sp.id + ' yaw ' + yaw + ': ' + JSON.stringify(v));
    }
  }
});

// Which hangout (x, z) is in, by the same shapes Layout.walkways gives.
function placeOf(ways, x, z) {
  const h = ways.hangouts.find((h) => (h.r ? Math.hypot(x - h.x, z - h.z) <= h.r : Math.abs(x - h.x) <= h.hx && Math.abs(z - h.z) <= h.hz));
  return h ? h.id : null;
}

test('with the walkways, kids go all over the map, never into a prop, and still ride at the playground', () => {
  for (const grade of ['grade5', 'grade2']) {
    const mind = make(2, true, grade), ways = L.walkways(grade), obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds;
    const seen = new Set(), rode = new Set(), still = {};
    let out = 0, frames = 0;
    for (let i = 0; i < 12000; i++) {
      const before = mind.list();
      mind.tick(0.1, away);
      for (const k of mind.list()) {
        if (k.seat) { rode.add(k.id); continue; }
        assert.equal(L.blocked(obs, bounds, k.x, k.z, 0.69), false, grade + ' ' + k.id + ' at ' + k.x.toFixed(1) + ',' + k.z.toFixed(1));
        const p = placeOf(ways, k.x, k.z);
        if (p) seen.add(p);
        if (p !== 'playground') out++;
        frames++;
        const b = before.find((x) => x.id === k.id);
        still[k.id] = k.state === 'walk' && Math.hypot(b.x - k.x, b.z - k.z) < 0.01 ? (still[k.id] || 0) + 0.1 : 0;
        assert.ok(still[k.id] < 3, grade + ' ' + k.id + ' stuck on the way at ' + k.x.toFixed(1) + ',' + k.z.toFixed(1));
      }
    }
    assert.deepEqual([...seen].sort(), ways.hangouts.map((h) => h.id).sort(), grade + ' every place gets visitors');
    assert.ok(out / frames > 0.5, grade + ' most of the time kids are out and about: ' + (out / frames).toFixed(2));
    assert.ok(rode.size >= 3, grade + ' kids still ride: ' + [...rode]);
  }
});

test('with the walkways, kids come over to the place she is in, but not a crowd', () => {
  const mind = make(5, true), ways = L.walkways('grade5'), park = ways.hangouts.find((h) => h.id === 'park');
  const her = { x: park.x, z: park.z, now: null };
  let most = 0, sum = 0, n = 0;
  for (let i = 0; i < 6000; i++) {
    mind.tick(0.1, her);
    if (i < 1200) continue;
    const there = mind.list().filter((k) => placeOf(ways, k.x, k.z) === 'park').length;
    most = Math.max(most, there);
    sum += there;
    n++;
  }
  assert.ok(sum / n >= 1, 'about one or more kids in the park with her: ' + (sum / n).toFixed(2));
  assert.ok(most <= 6, 'never a crowd: ' + most);
});

test('with the walkways, an invited friend follows her out of the playground and pops in when left far behind', () => {
  const mind = make(4, true);
  mind.calm();
  mind.invite('luna', 'swings');
  const luna = () => mind.list().find((k) => k.id === 'luna');
  // She walks out of the playground and along the path to the plaza.
  sim(mind, 30, (t) => ({ x: Math.max(0, pg.x - 3 * t), z: pg.x - 3 * t > 0 ? 74 : Math.max(12, 74 - 3 * (t - pg.x / 3)), now: null }));
  assert.equal(luna().state, 'follow', 'still following outside the playground');
  sim(mind, 2, { x: 0, z: 12, now: null });
  assert.ok(Math.hypot(luna().x, luna().z - 12) < 6, 'beside her at the plaza: ' + luna().x.toFixed(1) + ',' + luna().z.toFixed(1));
  // Quick travel to the park: she pops in beside her.
  sim(mind, 0.5, { x: -48, z: 44, now: null });
  assert.ok(Math.hypot(luna().x + 48, luna().z - 44) < 6, 'beside her in the park');
});

test('a kid in a game is left alone by the brain, moved by the game, hidden while hiding, and goes back to playing after', () => {
  const mind = make(7, true);
  const id = mind.list()[0].id, her = { x: 0, z: 0, now: null };
  assert.equal(mind.game(id, true), true);
  const at = mind.where(id);
  sim(mind, 5, her);
  assert.deepEqual([mind.where(id).x, mind.where(id).z], [at.x, at.z], 'the brain does not move it');
  assert.ok(!mind.tappable().some((k) => k.id === id), 'not tappable while playing');
  const goal = { x: at.x + 3, z: at.z };
  let there = false;
  for (let i = 0; i < 40 && !there; i++) there = mind.move(id, goal.x, goal.z, 5, 0.1);
  assert.ok(there, 'the game moves it with the same steering');
  mind.put(id, { hidden: true });
  assert.equal(mind.frames().find((f) => f.id === id).hidden, true);
  mind.game(id, false);
  assert.equal(mind.frames().find((f) => f.id === id).hidden, false);
  assert.equal(mind.list().find((k) => k.id === id).state, 'idle');
  assert.equal(mind.move(id, 0, 0, 5, 0.1), false, 'move only works in a game');
});
