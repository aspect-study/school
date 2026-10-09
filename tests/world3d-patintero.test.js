const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const P = require(worldFile('patintero.js'));

// Kids on an open field: move goes straight at speed; put sets fields.
function field(ids) {
  const kids = {};
  ids.forEach((id, i) => { kids[id] = { x: i, z: 0, face: 0, cheer: false }; });
  return {
    kids,
    move(id, x, z, speed, dt) {
      const k = kids[id], dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz), s = speed * dt;
      if (d <= Math.max(s, 0.3)) { k.x = x; k.z = z; return true; }
      k.x += dx / d * s; k.z += dz / d * s;
      return false;
    },
    where(id) { return kids[id]; },
    put(id, p) { const k = kids[id]; ['x', 'z', 'face', 'cheer'].forEach((f) => { if (p[f] !== undefined) k[f] = p[f]; }); return true; }
  };
}
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const C = P.court(39, 74);
function setup(herRuns = true, sister = null, ids = IDS) {
  const f = field(ids), g = P.create({ rand, move: f.move, where: f.where, put: f.put });
  const her = { x: 39, z: 90 };
  const ev = g.start(ids, her, C, sister, herRuns);
  ev.filter((e) => e.type === 'place').forEach((e) => { her.x = e.x; her.z = e.z; });
  return { f, g, her, ev };
}
// Runs the ready count down.
function go(g, her) { let ev = []; for (let i = 0; i < 70 && g.state().phase === 'ready'; i++) ev = ev.concat(g.tick(0.05, her)); return ev; }
// Puts every guard far from (x, z) along their own line, so she can pass.
function clear(f, g, x) {
  const s = g.state();
  Object.keys(s.posts).forEach((id) => { if (id === 'her') return; const k = f.kids[id];
    if (s.posts[id] === 'mid') k.z = C.mid.to; else k.x = x < C.cx ? C.maxX - 0.6 : C.minX + 0.6; });
}

test('the court: home at +z, 3 cross lines 15 apart, the middle line from the first cross line to the far line', () => {
  assert.equal(C.home, 104); assert.equal(C.far, 44);
  assert.deepEqual(C.cross, [89, 74, 59]);
  assert.deepEqual(C.mid, { x: 39, from: 89, to: 44 });
  assert.deepEqual([C.minX, C.maxX], [24, 54]);
});

test('her fence: running, the court and its run-offs; guarding, only the middle line', () => {
  assert.equal(P.fence(C, false, 39, 74), false);
  assert.equal(P.fence(C, false, 39, 108), false, 'behind the home line');
  assert.equal(P.fence(C, false, 23, 74), true, 'past a sideline');
  assert.equal(P.fence(C, false, 39, 113), true, 'too far behind home');
  assert.equal(P.fence(C, true, 39, 70), false);
  assert.equal(P.fence(C, true, 39.5, 70), true, 'off the middle line');
  assert.equal(P.fence(C, true, 39, 90), true, 'before the middle line starts');
});

test('teams of 4: her, the kid who asked and her sister in blue; runners behind home, guards on their posts', () => {
  const { f, g, her, ev } = setup(true, 'c');
  const s = g.state();
  assert.deepEqual(s.team.blue, ['her', 'a', 'c', 'b']);
  assert.deepEqual(s.team.red, ['d', 'e', 'f', 'g']);
  assert.deepEqual(s.posts, { d: 'c0', e: 'c1', f: 'c2', g: 'mid' });
  assert.equal(s.phase, 'ready'); assert.equal(s.running, true); assert.equal(s.guarding, false);
  assert.ok(her.z > C.home, 'she starts behind the home line');
  ['a', 'b', 'c'].forEach((id) => assert.ok(f.kids[id].z > C.home, id));
  assert.equal(f.kids.d.z, 89); assert.equal(f.kids.e.z, 74); assert.equal(f.kids.f.z, 59); assert.equal(f.kids.g.x, 39);
  assert.deepEqual(ev.map((e) => e.type).slice(0, 2), ['start', 'place']);
});

test('ready, set, go: a 3-second count and then play', () => {
  const { g, her } = setup();
  const ev = go(g, her);
  assert.deepEqual(ev.filter((e) => e.type === 'count').map((e) => e.n), [3, 2, 1]);
  assert.ok(ev.some((e) => e.type === 'go'));
  assert.equal(g.state().phase, 'play');
});

test('she scores by running past the far line and back home; guards never leave their lines', () => {
  const { f, g, her } = setup();
  go(g, her);
  const route = [[36, 108], [36, 40], [36, 108]];
  let ev = [], at = { x: 36, z: 108 };
  for (const [x, z] of route) {
    while (Math.hypot(at.x - x, at.z - z) > 0.01) {
      clear(f, g, at.x);
      const d = Math.hypot(x - at.x, z - at.z), s = Math.min(d, 0.5);
      at = { x: at.x + (x - at.x) / d * s, z: at.z + (z - at.z) / d * s };
      her.x = at.x; her.z = at.z;
      ev = ev.concat(g.tick(0.05, her));
      const st = g.state();
      Object.keys(st.posts).forEach((id) => {
        const k = f.kids[id];
        if (st.posts[id] === 'mid') assert.equal(k.x, 39, id + ' on the middle line');
        else assert.ok(C.cross.includes(k.z), id + ' on a cross line');
      });
      if (!g.state().running) break;
    }
  }
  const sc = ev.filter((e) => e.type === 'score');
  assert.ok(sc.some((e) => e.kid === 'her' && e.team === 'blue'), 'her point: ' + JSON.stringify(sc));
  assert.ok(g.state().score.blue >= 1);
});

test('a guard touching her swaps the teams: she becomes the middle guard', () => {
  const { f, g, her } = setup();
  go(g, her);
  her.x = 37; her.z = 89.5;
  f.kids.d.x = 37; f.kids.d.z = 89;
  const ev = g.tick(0.05, her);
  const sw = ev.find((e) => e.type === 'swap');
  assert.ok(sw, JSON.stringify(ev));
  assert.equal(sw.by, 'd'); assert.equal(sw.kid, 'her'); assert.equal(sw.herTeam, 'tagged');
  const s = g.state();
  assert.equal(s.guarding, true); assert.equal(s.posts.her, 'mid'); assert.equal(s.phase, 'ready');
  const pl = ev.filter((e) => e.type === 'place').pop();
  assert.equal(pl.x, 39); assert.ok(pl.z <= 89 && pl.z >= 44, 'placed on the middle line');
  assert.equal(g.fence(39, 70), false); assert.equal(g.fence(40, 70), true);
});

test('she tags a runner while guarding: the teams swap back and her team runs', () => {
  const { f, g, her } = setup(false);
  assert.equal(g.state().guarding, true);
  go(g, her);
  const runner = g.state().team.red[0];
  f.kids[runner].x = 39.5; f.kids[runner].z = her.z;
  const ev = g.tick(0.05, her);
  const sw = ev.find((e) => e.type === 'swap');
  assert.ok(sw); assert.equal(sw.by, 'her'); assert.equal(sw.herTeam, 'tagger');
  assert.equal(g.state().running, true);
});

test('a runner behind the lines cannot be tagged', () => {
  const { f, g, her } = setup();
  go(g, her);
  her.x = 39; her.z = 105;
  f.kids.d.x = 39; f.kids.d.z = 104.5;
  assert.ok(!g.tick(0.05, her).some((e) => e.type === 'swap'));
});

test('first to 5 wins; after 4 minutes the team ahead wins, equal is a tie', () => {
  let { g, her } = setup();
  go(g, her);
  let ev = [];
  for (let i = 0; i < 241 / 0.5 && g.playing(); i++) ev = ev.concat(g.tick(0.5, her));
  assert.equal(g.playing(), false);
  const end = ev.find((e) => e.type === 'end');
  assert.ok(end); assert.equal(end.kind, 'patintero');
  const s = g.state();
  assert.equal(end.result, s.score.blue > s.score.red ? 'win' : s.score.blue < s.score.red ? 'lose' : 'tie');
  assert.equal(P.RULES.win, 5); assert.equal(P.RULES.time, 240);
});

test('Play again can start with her team guarding', () => {
  const { g } = setup(false);
  const s = g.state();
  assert.equal(s.running, false); assert.equal(s.herRuns, false); assert.equal(s.posts.her, 'mid');
});

test('fewer kids: the teams stay as even as they can', () => {
  const { g } = setup(true, null, ['a', 'b', 'c', 'd', 'e']);
  const s = g.state();
  assert.equal(s.team.blue.length, 3); assert.equal(s.team.red.length, 3);
});
