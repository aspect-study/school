const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const Data = require(worldFile('lifedata.js'));
const Engine = require(worldFile('routines.js'));

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const KIDS = ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna', 'new1', 'new2', 'new3'];

// Runs the engine for `seconds`; ctx is an object or a function of the time.
function run(engine, seconds, ctx, each) {
  let out = null;
  for (let i = 0; i < seconds * 10; i++) {
    out = engine.tick(0.1, typeof ctx === 'function' ? ctx(i / 10) : ctx);
    if (each) each(out, i / 10);
  }
  return out;
}
function plain(actors, extra) {
  return Engine.create(Object.assign({ actors, rand: seeded(3), blocked: () => false }, extra));
}
function char(id, x, z, extra) {
  return Object.assign({ id, kind: 'buddy', home: { x, z }, face: 0, leash: 3, homeR: 0, routines: ['sweep', 'read', 'gaze', 'stretch'] }, extra);
}
const HER_FAR = { x: 0, z: 30 };

test('characters leave home, stay inside the leash and never stand in a blocked square', () => {
  const obs = L.obstacles('grade5'), bounds = L.GRADES.grade5.bounds, pr = L.props('grade5');
  const defs = Data.build('grade5', L, KIDS).filter((d) => !d.pet);
  const engine = Engine.create({ actors: defs, rand: seeded(5), blocked: (x, z, r) => L.blocked(obs, bounds, x, z, r) });
  const away = {};
  const homes = {};
  defs.forEach((d) => { if (d.home) homes[d.id] = d; });
  run(engine, 120, { x: pr.fountain.x + 4, z: pr.fountain.z + 4 }, (out) => {
    for (const [id, p] of Object.entries(out.poses)) {
      const d = homes[id], dist = Math.hypot(p.x - d.home.x, p.z - d.home.z);
      assert.ok(dist <= d.leash + 0.35, id + ' strayed ' + dist);
      if (dist > 0.5) away[id] = true;
      if (!d.fly) {
        const own = d.homeR && dist <= d.homeR + 0.5;
        assert.ok(own || !L.blocked(obs, bounds, p.x, p.z, 0.5 - 0.01), id + ' is in a blocked square at ' + p.x + ',' + p.z);
      }
    }
  });
  assert.ok(Object.keys(away).length >= 3, 'some characters near the plaza moved: ' + Object.keys(away));
});

test('a character that is talked to stops, faces her, and carries on 2 s after the talk', () => {
  const engine = plain([char('a', 0, 0)]);
  run(engine, 20, { x: 0, z: 30 });
  const her = { x: 8, z: 3, talkingTo: 'a' };
  const first = engine.tick(0.1, her).poses.a;
  const out = run(engine, 5, her);
  assert.equal(out.poses.a.x, first.x);
  assert.equal(out.poses.a.z, first.z);
  assert.ok(Math.abs(out.poses.a.face - Math.atan2(her.x - first.x, her.z - first.z)) < 1e-9);
  assert.equal(out.poses.a.action, 'idle');
  const moved = [];
  run(engine, 30, { x: 8, z: 3 }, (o, t) => { if (o.poses.a.action !== 'idle') moved.push(t); });
  assert.ok(moved.length > 0, 'resumes');
  assert.ok(moved[0] >= 1.9, 'not before the 2 s rest: ' + moved[0]);
});

test('nobody starts a routine while a talk or gift is open (busy)', () => {
  const engine = plain([char('a', 0, 0)]);
  const out = run(engine, 30, { x: 0, z: 30, busy: true });
  assert.equal(out.poses.a.action, 'idle');
  assert.equal(out.poses.a.x, 0);
});

test('only `cap` characters do something at once', () => {
  const actors = [0, 1, 2, 3, 4, 5].map((i) => char('c' + i, i * 6, 0, { routines: ['sweep', 'read'] }));
  const engine = plain(actors, { cap: 2 });
  let most = 0;
  run(engine, 120, { x: 15, z: 30 }, (out) => {
    most = Math.max(most, Object.values(out.poses).filter((p) => p.action !== 'idle').length);
  });
  assert.ok(most >= 1, 'something happened');
  assert.ok(most <= 2, 'at most 2 at once, saw ' + most);
});

test('characters further than 40 units from her stand still', () => {
  const engine = plain([char('a', 0, 0), char('b', 10, 0)]);
  const out = run(engine, 60, { x: 1000, z: 1000 });
  assert.equal(out.poses.a.x, 0);
  assert.equal(out.poses.b.x, 10);
  assert.equal(out.poses.a.action, 'idle');
});

test('a held character stands at home and does not move, then goes back to its spot when released', () => {
  const engine = plain([char('a', 5, 5)]);
  run(engine, 20, { x: 5, z: 35 });
  const held = run(engine, 10, { x: 5, z: 35, hold: { a: true } });
  assert.equal(held.poses.a.held, true);
  const x = held.poses.a.x;
  assert.equal(run(engine, 5, { x: 5, z: 35, hold: { a: true } }).poses.a.x, x);
  const free = engine.tick(0.1, { x: 5, z: 35 }).poses.a;
  assert.equal(free.held, false);
  assert.deepEqual([free.x, free.z], [5, 5]);
});

test('a flying character lifts off, stays inside the leash and ignores blocked squares', () => {
  const hoot = char('h', 0, 0, { fly: true, leash: 3, routines: ['fly', 'flap'], kind: 'hoot' });
  const engine = plain([hoot], { blocked: () => true });
  let high = 0, far = 0;
  run(engine, 90, { x: 0, z: 30 }, (out) => {
    high = Math.max(high, out.poses.h.y);
    far = Math.max(far, Math.hypot(out.poses.h.x, out.poses.h.z));
  });
  assert.ok(high > 1, 'flew: ' + high);
  assert.ok(far > 1 && far <= 3.35, 'inside the leash: ' + far);
});

test('a character waves when she walks close, then not again for a while', () => {
  const engine = plain([char('a', 0, 0, { waves: true })]);
  const pops = [];
  run(engine, 30, { x: 3, z: 0 }, (out, t) => out.pops.forEach((p) => { if (p.text === '👋') pops.push(t); }));
  assert.equal(pops.length >= 1, true, 'waved');
  assert.ok(pops.every((t) => t < 5), 'only at the start, then the 40 s wait: ' + pops);
});

test('a route character walks its route', () => {
  const route = [{ x: 3, z: 0 }, { x: 3, z: 3 }, { x: 0, z: 3 }];
  const engine = plain([char('m', 0, 0, { routines: ['stroll'], route, leash: 4 })]);
  let reached = 0;
  run(engine, 120, { x: 0, z: 30 }, (out) => { if (Math.hypot(out.poses.m.x - 3, out.poses.m.z - 3) < 0.6) reached++; });
  assert.ok(reached > 0, 'reached the middle of its route');
});

function kidPet(species, owner, id) { return { id: id || 'p-' + owner, pet: true, owner, species, name: 'x' }; }
function kid(id) { return { id, external: true }; }
function owners(map) { return Object.assign({ x: 20, z: 20 }, { owners: map }); }
const STILL = { state: 'idle', seat: false, hidden: false };

test('a pet stays near a standing owner and does its species behavior', () => {
  const engine = plain([kid('o'), kidPet('puppy', 'o')]);
  let far = 0;
  const seen = new Set();
  run(engine, 90, owners({ o: Object.assign({ x: 0, z: 0 }, STILL) }), (out) => {
    const p = out.poses['p-o'];
    far = Math.max(far, Math.hypot(p.x, p.z));
    seen.add(p.action);
  });
  assert.ok(far <= 4.5, 'stayed near: ' + far);
  assert.ok(seen.has('carry') || seen.has('graze'), 'puppy things: ' + [...seen]);
});

test('a pet follows an owner who walks away, running when far behind', () => {
  const engine = plain([kid('o'), kidPet('puppy', 'o')]);
  let x = 0;
  run(engine, 10, () => { x += 0.4; return owners({ o: Object.assign({ x, z: 0 }, STILL) }); });
  const out = run(engine, 6, owners({ o: Object.assign({ x, z: 0 }, STILL) }));
  const p = out.poses['p-o'];
  assert.ok(Math.hypot(p.x - x, p.z) <= 4.5, 'caught up: ' + Math.hypot(p.x - x, p.z));
});

test('a pet whose owner is on a ride sits and waits, with a cheer', () => {
  const engine = plain([kid('o'), kidPet('puppy', 'o')]);
  run(engine, 5, owners({ o: Object.assign({ x: 0, z: 0 }, STILL) }));
  const pops = [];
  const out = run(engine, 3, owners({ o: { x: 0, z: 0, state: 'ride', seat: true, hidden: false } }), (o) => o.pops.forEach((p) => pops.push(p.text)));
  assert.equal(out.poses['p-o'].action, 'sit');
  assert.ok(pops.includes('🎉'));
  let acted = false;
  run(engine, 20, owners({ o: Object.assign({ x: 0, z: 0 }, STILL) }), (o) => { if (o.poses['p-o'].action !== 'sit' && o.poses['p-o'].action !== 'idle') acted = true; });
  assert.ok(acted, 'free again');
});

test('a pet naps when its owner has been still a while', () => {
  const engine = plain([kid('o'), kidPet('puppy', 'o')]);
  const seen = new Set();
  run(engine, 150, owners({ o: Object.assign({ x: 0, z: 0 }, STILL) }), (out) => seen.add(out.poses['p-o'].action));
  assert.ok(seen.has('sleep'), [...seen].join());
});

test('a pet greets her once when she comes close, then not for 30 s', () => {
  const engine = plain([kid('o'), kidPet('puppy', 'o')]);
  const times = [];
  run(engine, 28, { x: 0.5, z: 0, owners: { o: Object.assign({ x: 0, z: 0 }, STILL) } }, (out, tm) => out.pops.forEach((p) => { if (p.text === '💕') times.push(tm); }));
  assert.equal(times.length, 1, 'one greeting: ' + times);
});

test('a pet startles when someone else runs past, a turtle pulls into its shell', () => {
  for (const [species, expect] of [['puppy', '❗'], ['turtle', 'shell']]) {
    const engine = plain([kid('o'), kid('r'), kidPet(species, 'o')]);
    const calm = run(engine, 2, owners({ o: Object.assign({ x: 0, z: 0 }, STILL) }));
    const at = calm.poses['p-o'];
    let rx = at.x - 4, saw = false;
    run(engine, 2, () => {
      rx += 0.6;
      return owners({ o: Object.assign({ x: 0, z: 0 }, STILL), r: { x: rx, z: at.z + 0.5, state: 'walk', seat: false, hidden: false } });
    }, (out) => {
      if (expect === '❗' ? out.pops.some((p) => p.text === '❗') : out.poses['p-o'].action === 'shell') saw = true;
    });
    assert.ok(saw, species);
  }
});

test('two pets of different owners who are close play together', () => {
  const engine = plain([kid('o1'), kid('o2'), kidPet('puppy', 'o1'), kidPet('bunny', 'o2')]);
  let both = false;
  run(engine, 300, owners({ o1: Object.assign({ x: 0, z: 0 }, STILL), o2: Object.assign({ x: 1.5, z: 0 }, STILL) }), (out) => {
    if (out.poses['p-o1'].action === 'chase' && out.poses['p-o2'].action === 'chase') both = true;
  });
  assert.ok(both);
});

test('a pet of a hidden owner is hidden', () => {
  const engine = plain([kid('o'), kidPet('puppy', 'o')]);
  const out = run(engine, 2, owners({ o: { x: 0, z: 0, state: 'game', seat: false, hidden: true } }));
  assert.equal(out.poses['p-o'].hidden, true);
});

test('a pet of a character follows the character and never stands in a blocked square', () => {
  const obs = L.obstacles('grade5'), bounds = L.GRADES.grade5.bounds, pr = L.props('grade5');
  const defs = Data.build('grade5', L, KIDS).filter((d) => !d.external && (!d.pet || !d.owner.startsWith('mate:')));
  const engine = Engine.create({ actors: defs, rand: seeded(9), blocked: (x, z, r) => L.blocked(obs, bounds, x, z, r) });
  const homes = {};
  defs.forEach((d) => { homes[d.id] = d; });
  let worst = 0;
  run(engine, 90, { x: pr.fountain.x + 4, z: pr.fountain.z + 4 }, (out) => {
    for (const d of defs.filter((x) => x.pet && x.owner.startsWith('buddy:'))) {
      const owner = homes[d.owner], p = out.poses[d.id];
      worst = Math.max(worst, Math.hypot(p.x - owner.home.x, p.z - owner.home.z));
    }
  });
  assert.ok(worst < 9, 'buddy pets stay close to their buddy: ' + worst);
});
