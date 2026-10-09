# Living World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** World characters (buddies, Hoot, Bunny, Mimi, four shop owners) move and do things, and 5 playmates plus 6 world characters get a unique pet that acts like its species and reacts to its surroundings.

**Architecture:** One pure routine engine (`routines.js`, Node-testable like `matemind.js`) drives every character and pet as a small state machine; species and character tables live in a second pure file (`lifedata.js`). A Three.js view layer (`life.js`) turns the engine's poses into positions, poses, prop emoji, pet bodies and voices. `cast.js` gains whole-body actions, `petbody.js` gains moods; `folk.js`, `mates3d.js`, `town.js` and `world-main.js` get small hooks. Nothing is saved; no coins or points.

**Tech Stack:** Plain ES5 browser JS in IIFEs, Three.js (already vendored), `node --test`, headless-Chrome e2e (`tests/e2e`).

**Spec:** `docs/superpowers/specs/2026-10-09-living-world-design.md`. One deviation: the data tables live in `lifedata.js`, not inside `routines.js`, so each file keeps one job.

**Rules that apply to every task (from `CLAUDE.md`):** browser JS is ES5 (`var`, `function`, no arrow functions, no `let`/`const`); comments only for non-obvious code; never `git commit` (give the commit command as a code block for the owner); never add `Co-Authored-By`; after adding or removing a file under `web/` run `node tools/update-precache.js`; no fully-qualified class names inline; English-only text (no new Filipino strings, pops are emoji).

## File map

| File | Action | Responsibility |
|---|---|---|
| `web/world/lifedata.js` | create | Pure tables: character routines, pet routines, species lists, pet assignments, `build(grade, L, kidIds)` → actor definitions |
| `web/world/routines.js` | create | Pure engine: leash, walking, routines, talk freeze, hold, distance gate, cap, pet follow and reactions |
| `web/world/life.js` | create | Three.js view: builds pets, applies poses, prop and pop sprites, pet voices, name tags |
| `web/world/petbody.js` | modify | New moods in `animate`, export `MOODS_ALL` |
| `web/world/cast.js` | modify | `life()` gets `ACTIONS`, `setAction`, exposes `body`; Mimi gets `setAction` |
| `web/world/folk.js` | modify | `chars()`, `talkingId()` |
| `web/world/mates3d.js` | modify | `api.owners()` |
| `web/world/town.js` | modify | `mimiLife()` for placing, holding and talking |
| `web/world/world-main.js` | modify | Create `Life`, tick it, `debug.life` |
| `web/world/grade-5.html`, `grade-2.html` | modify | Script tags |
| `tests/paths.js` | modify | `WORLD_FILES` |
| `tests/world3d-lifedata.test.js` | create | Tables are consistent |
| `tests/world3d-routines.test.js` | create | Engine behavior |
| `tests/world3d-life-wiring.test.js` | create | Cast actions exist, wiring present |
| `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js` | modify | `life` mode |
| `docs/HANDOFF.md`, `README.md` | modify | Document the feature |

---

### Task 1: `lifedata.js` tables

**Files:**
- Create: `web/world/lifedata.js`
- Test: `tests/world3d-lifedata.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-lifedata.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const Pets = require(worldFile('pets.js'));
const Data = require(worldFile('lifedata.js'));

const KIDS = ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna', 'new1', 'new2', 'new3'];

test('every species has routines and all of them exist', () => {
  assert.deepEqual(Object.keys(Data.SPECIES).sort(), Pets.PETS.map((p) => p.id).sort());
  for (const [species, list] of Object.entries(Data.SPECIES)) {
    assert.ok(list.length >= 2, species);
    for (const id of list) assert.ok(Data.PET_ROUTINES[id], species + ' → ' + id);
  }
});

test('routines are well formed', () => {
  for (const table of [Data.CHAR_ROUTINES, Data.PET_ROUTINES]) {
    for (const [id, rt] of Object.entries(table)) {
      assert.ok(['here', 'home', 'wander', 'route'].includes(rt.move), id);
      assert.ok(rt.steps.length >= 1, id);
      for (const s of rt.steps) {
        assert.ok(s.action, id);
        assert.ok(s.len[0] > 0 && s.len[1] >= s.len[0], id);
      }
    }
  }
});

test('every grade builds the same cast: 17 or 14 characters, 11 pets, all different', () => {
  for (const grade of ['grade5', 'grade2']) {
    const defs = Data.build(grade, L, KIDS), chars = defs.filter((d) => !d.pet && !d.external), pets = defs.filter((d) => d.pet);
    assert.equal(chars.length, L.buddies(grade).length + 7, grade);
    assert.equal(pets.length, 11, grade);
    assert.equal(new Set(pets.map((p) => p.species)).size, 11, 'species are unique');
    assert.equal(new Set(pets.map((p) => p.name)).size, 11, 'names are unique');
    const defaults = Pets.PETS.map((p) => p.name);
    for (const p of pets) assert.ok(!defaults.includes(p.name), p.name + ' is a stall default name');
    const ids = new Set(defs.map((d) => d.id));
    for (const p of pets) assert.ok(ids.has(p.owner), p.id + ' owner ' + p.owner);
    for (const c of chars) for (const id of c.routines) assert.ok(Data.CHAR_ROUTINES[id], c.id + ' → ' + id);
  }
});

test('characters start where the world puts them and wander only a little', () => {
  const defs = Data.build('grade5', L, KIDS), pr = L.props('grade5');
  const lana = defs.find((d) => d.id === 'lana'), mimi = defs.find((d) => d.id === 'mimi'), hoot = defs.find((d) => d.id === 'hoot');
  assert.deepEqual(lana.home, { x: pr.lana.x, z: pr.lana.z });
  assert.deepEqual(mimi.home, { x: pr.mimi.x, z: pr.mimi.z });
  assert.equal(hoot.fly, true);
  for (const d of defs.filter((x) => !x.pet && !x.external)) assert.ok(d.leash >= 1.5 && d.leash <= 6, d.id);
  assert.ok(mimi.route.length >= 4);
});

test('the six playmate pets belong to named friends and the kids in the list', () => {
  const defs = Data.build('grade5', L, KIDS);
  const kidPets = defs.filter((d) => d.pet && d.owner.startsWith('mate:'));
  assert.equal(kidPets.length, 5);
  for (const p of kidPets) assert.ok(KIDS.includes(p.owner.slice(5)), p.owner);
  assert.ok(defs.filter((d) => d.external).length === KIDS.length);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/world3d-lifedata.test.js`
Expected: FAIL, `Cannot find module '.../web/world/lifedata.js'`.

- [ ] **Step 3: Write `web/world/lifedata.js`**

```js
/* Living world data (pure, so the Node tests can read it): what each world character and each pet does. A routine is
   { move, steps }: move 'here' acts where they stand, 'home' walks back first, 'wander' walks to a free point inside
   the leash (a pet's: around its owner), 'route' walks the actor's route; steps run one after another, each
   { action, len: [min, max], prop?, pop?, voice? }. Characters' actions are poses in cast.js, pets' actions are moods
   in petbody.js. build() turns the layout into the actor list routines.js runs. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;

  function r(move, steps) { return { move: move, steps: steps }; }
  function s(action, min, max, extra) { return Object.assign({ action: action, len: [min, max] }, extra); }

  var CHAR_ROUTINES = {
    sweep: r('wander', [s('sweep', 4, 6, { prop: '🧹' })]),
    read: r('here', [s('read', 5, 8, { prop: '📖' })]),
    water: r('wander', [s('water', 3, 5, { prop: '💧' })]),
    gaze: r('here', [s('gaze', 3, 5, { pop: '☁️' })]),
    stretch: r('here', [s('stretch', 2, 3)]),
    hum: r('here', [s('hum', 3, 5, { pop: '🎵' })]),
    arrange: r('wander', [s('arrange', 3, 5, { prop: '📦' })]),
    serve: r('home', [s('serve', 3, 5, { pop: '🛍️' })]),
    sip: r('home', [s('sip', 2, 3, { prop: '🥤' })]),
    hammer: r('home', [s('hammer', 4, 6, { pop: '🔨' })]),
    nibble: r('wander', [s('nibble', 3, 4, { prop: '🥕' })]),
    hop: r('wander', [s('hop', 2, 3)]),
    flap: r('here', [s('flap', 1.5, 2.5)]),
    fly: r('wander', [s('hover', 1, 1.5)]),
    stroll: r('route', [s('wave', 1.5, 2.5, { pop: '👋' })]),
    wave: r('here', [s('wave', 2, 3, { pop: '👋' })])
  };

  var PET_ROUTINES = {
    sit: r('here', [s('sit', 3, 6)]),
    nap: r('here', [s('sleep', 5, 9, { pop: '💤' })]),
    sniff: r('wander', [s('graze', 2, 4)]),
    hop: r('wander', [s('hop', 2, 3)]),
    say: r('here', [s('hop', 1.2, 1.6, { pop: '💬', voice: true })]),
    preen: r('here', [s('preen', 2, 3)]),
    pounce: r('wander', [s('crouch', 1, 1.5), s('pounce', 0.6, 0.6, { voice: true })]),
    shell: r('here', [s('shell', 2.5, 3.5, { pop: '🐢' })]),
    breathe: r('here', [s('rear', 0.8, 0.8), s('breathe', 1.2, 1.2, { pop: '✨', voice: true })]),
    butterfly: r('wander', [s('chase', 3, 4, { prop: '🦋' })]),
    fetch: r('wander', [s('carry', 3, 4, { prop: '🦴' })]),
    wheel: r('here', [s('run', 3, 4)]),
    roll: r('here', [s('roll', 2, 3)]),
    slide: r('wander', [s('belly', 2, 3, { pop: '❄️' })]),
    graze: r('wander', [s('graze', 4, 6, { prop: '🌾' })]),
    bamboo: r('here', [s('munch', 4, 6, { prop: '🎋' })]),
    carrot: r('here', [s('munch', 3, 4, { prop: '🥕' })]),
    prance: r('wander', [s('prance', 3, 4, { pop: '✨' })]),
    stare: r('here', [s('stare', 3, 4, { pop: '👀' })]),
    paddle: r('here', [s('paddle', 3, 4, { prop: '💧' })]),
    peck: r('wander', [s('peck', 3, 4)]),
    greet: r('here', [s('hop', 1.2, 1.4, { pop: '💕', voice: true })]),
    play: r('here', [s('chase', 4, 4, { pop: '🎵' })])
  };

  // What each species does when it is free; the engine adds 'sit', and 'nap' when its owner has been still a while.
  var SPECIES = {
    chick: ['peck', 'hop'], kitten: ['butterfly', 'preen'], puppy: ['fetch', 'sniff'], hamster: ['wheel', 'preen'],
    duckling: ['paddle', 'peck'], bunny: ['hop', 'carrot'], turtle: ['shell', 'sniff'], piglet: ['roll', 'sniff'],
    parrot: ['say', 'preen'], carabao: ['graze', 'sit'], penguin: ['slide', 'preen'], fox: ['pounce', 'sniff'],
    tarsier: ['stare', 'preen'], panda: ['bamboo', 'roll'], unicorn: ['prance', 'preen'], dragon: ['breathe', 'hop']
  };

  // Walking speed relative to the engine's pet walk.
  var PET_SPEED = { turtle: 0.4, carabao: 0.7, panda: 0.7, piglet: 0.85, fox: 1.2, puppy: 1.1, hamster: 1.2, chick: 1.1 };

  var KID_PETS = [
    { owner: 'migo', species: 'puppy', color: 2, name: 'Tagpi' },
    { owner: 'ella', species: 'bunny', color: 3, name: 'Lila' },
    { owner: 'tomas', species: 'fox', color: 0, name: 'Kidlat' },
    { owner: 'bea', species: 'hamster', color: 2, name: 'Pandesal' },
    { owner: 'luna', species: 'kitten', color: 4, name: 'Mingming' }
  ];
  var CHAR_PETS = [
    { owner: 'hoot', species: 'parrot', color: 1, name: 'Kwento' },
    { owner: 'bunny', species: 'turtle', color: 1, name: 'Tagal' },
    { owner: 'mimi', species: 'unicorn', color: 1, name: 'Bituin' }
  ];
  // By position in Layout.buddies, so both grades get them.
  var BUDDY_PETS = [
    { index: 1, species: 'panda', color: 1, name: 'Kawayan' },
    { index: 4, species: 'penguin', color: 2, name: 'Hielo' },
    { index: 6, species: 'duckling', color: 3, name: 'Pitik' }
  ];

  var BUDDY_SETS = [['sweep', 'read', 'gaze'], ['water', 'stretch', 'hum'], ['read', 'hum', 'arrange'], ['sweep', 'water', 'gaze']];
  var OWNER_SETS = {
    lana: ['arrange', 'serve', 'hum', 'stretch'], kiko: ['arrange', 'serve', 'sip', 'stretch'],
    pilo: ['serve', 'hum', 'sip', 'stretch'], tasyo: ['hammer', 'stretch', 'sip', 'serve']
  };

  function pet(owner, p) {
    return { id: 'pet:' + owner, pet: true, owner: owner, species: p.species, color: p.color, name: p.name };
  }

  // kidIds: the playmates' ids; each becomes an external actor ('mate:<id>') whose position the world feeds in.
  function build(grade, L, kidIds) {
    var pr = L.props(grade), buddies = L.buddies(grade), out = [];
    buddies.forEach(function (b, i) {
      out.push({ id: 'buddy:' + b.app, kind: 'buddy', home: { x: b.x, z: b.z }, face: b.face, leash: 2, homeR: 0.8, waves: true, routines: BUDDY_SETS[i % BUDDY_SETS.length] });
    });
    out.push({ id: 'hoot', kind: 'hoot', home: { x: pr.hoot.x, z: pr.hoot.z }, face: Math.PI, leash: 3, homeR: 0, fly: true, waves: false, routines: ['read', 'flap', 'fly', 'gaze'] });
    out.push({ id: 'bunny', kind: 'bunny', home: { x: pr.bunny.x, z: pr.bunny.z }, face: -Math.PI / 2, leash: 3, homeR: 0, waves: true, routines: ['hop', 'nibble', 'stretch', 'gaze'] });
    Object.keys(OWNER_SETS).forEach(function (id) {
      out.push({ id: id, kind: 'owner', home: { x: pr[id].x, z: pr[id].z }, face: -Math.PI / 2, leash: 2, homeR: pr[id].r, waves: true, routines: OWNER_SETS[id] });
    });
    var ring = [];
    for (var i = 0; i < 6; i++) ring.push({ x: pr.mimi.x + Math.sin(i / 6 * Math.PI * 2) * 2.5, z: pr.mimi.z + Math.cos(i / 6 * Math.PI * 2) * 2.5 });
    out.push({ id: 'mimi', kind: 'mimi', home: { x: pr.mimi.x, z: pr.mimi.z }, face: 0, leash: 3, homeR: pr.mimi.r, waves: true, route: ring, routines: ['stroll', 'gaze', 'wave', 'stretch'] });

    (kidIds || []).forEach(function (id) { out.push({ id: 'mate:' + id, external: true }); });
    KID_PETS.forEach(function (p) { if ((kidIds || []).indexOf(p.owner) >= 0) out.push(pet('mate:' + p.owner, p)); });
    CHAR_PETS.forEach(function (p) { out.push(pet(p.owner, p)); });
    BUDDY_PETS.forEach(function (p) { if (buddies[p.index]) out.push(pet('buddy:' + buddies[p.index].app, p)); });
    return out;
  }

  var exported = { CHAR_ROUTINES: CHAR_ROUTINES, PET_ROUTINES: PET_ROUTINES, SPECIES: SPECIES, PET_SPEED: PET_SPEED, build: build };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.LifeData = exported;
})(this);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/world3d-lifedata.test.js`
Expected: PASS (5 tests). If the "17 or 14 characters" assertion fails, print `L.buddies(grade).length` and fix the test's expected count to buddies + 7 (hoot, bunny, lana, kiko, pilo, tasyo, mimi); do not change the data.

- [ ] **Step 5: Commit command for the owner**

```bash
git add web/world/lifedata.js tests/world3d-lifedata.test.js && git commit -m 'Add living world data: character and pet routines, species behaviors, pet cast' -- web/world/lifedata.js tests/world3d-lifedata.test.js
```

---

### Task 2: `routines.js` engine, characters

**Files:**
- Create: `web/world/routines.js`
- Test: `tests/world3d-routines.test.js`

- [ ] **Step 1: Write the failing tests (characters)**

Create `tests/world3d-routines.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-routines.test.js`
Expected: FAIL, `Cannot find module '.../routines.js'`.

- [ ] **Step 3: Write `web/world/routines.js` (characters; pet branch stubbed to be filled in Task 3)**

```js
/* The living world's engine (pure, no Three.js): every world character and pet is a small state machine. A character
   rests, picks one of its routines (lifedata.js), walks to the routine's spot inside its leash around home, acts for
   the step lengths, and walks home. tick(dt, her) with
   her = { x, z, cam ({ x, z }), sprint, talkingTo (an id), busy, waving, hold ({ id: true }), owners ({ id: { x, z,
   state, seat, hidden } }, the playmates, whom matemind.js moves) }
   returns { poses: { id: { x, y, z, face, action, mag, walkT, prop, hidden, held, pet } }, pops: [{ id, text }],
   sounds: [{ id, name, species }] }.
   Rules: a character talked to stops, faces her and resumes 2 s after; nobody starts a routine while busy; actors
   further than NEAR from her stand still; at most cap actors do a routine at once; a held actor (Mimi on her visit)
   waits at home and goes back to its spot when released. Walking asks blocked(x, z, r); a character may stand on its
   own home spot, which is a circle in the layout's obstacles. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Data = node ? require('./lifedata.js') : root.World3D.LifeData;

  var NEAR = 40, CAP = 12, R_CHAR = 0.5, R_PET = 0.35;
  var CHAR_SPEED = 1.8, FLY_SPEED = 3, FLY_H = 2.4, ARRIVE = 0.25, STUCK = 1.5;
  var REST = [1.5, 3.5], PET_REST = [0.8, 2], TALK_RESUME = 2, LANE_W = 2.6;
  var WAVE_R = 5, WAVE_COOL = 40;
  var FOLLOW_NEAR = 1.8, FOLLOW_FAR = 3.6, PET_WALK = 3.4, PET_RUN = 7, RUN_FROM = 9, JUMP = 25, SIDE = 2.4, LOOK_R = 7;
  var NAP_AFTER = 12, GREET_R = 4, WAVING_R = 9, GREET_COOL = 30, PLAY_R = 3.5, PLAY_COOL = 40;
  var STARTLE_R = 2.8, STARTLE_SPEED = 5, SPRINT_SPEED = 12, STARTLE_COOL = 5, STARTLE_TIME = 0.6, STARTLE_RUN = 5;

  // rand: Math.random unless a test passes its own.
  // o = { actors (lifedata.build), blocked(x, z, r), rand, cap }
  function create(o) {
    var rand = o.rand || Math.random, blocked = o.blocked || function () { return false; }, cap = o.cap || CAP;
    var t = 0, ctx = null, pops = [], sounds = [], sources = [], byId = {};
    var actors = o.actors.map(function (d) {
      var a = {
        def: d, x: d.home ? d.home.x : 0, z: d.home ? d.home.z : 0, y: 0, face: d.face || 0, state: 'rest', timer: 0.5 + rand() * 2,
        action: 'idle', prop: null, speed: 0, still: 0, walkT: 0, stuck: 0, target: null, route: [], homing: false, rt: null, last: null,
        stepI: 0, step: null, held: false, hidden: false, placed: !d.pet, loose: false, seen: false, own: null,
        greetAt: 0, playAt: 0, startleAt: 0, waveAt: 0, legX: 0, legZ: 0, sx: 0, sz: 0
      };
      byId[d.id] = a;
      return a;
    });

    function between(range) { return range[0] + rand() * (range[1] - range[0]); }
    function dist(a, p) { return Math.hypot(a.x - p.x, a.z - p.z); }
    function toward(a, p) { return Math.atan2(p.x - a.x, p.z - a.z); }
    function far(a, p, r) { return dist(a, p) > (r === undefined ? 0.6 : r); }

    function busyCount() {
      var n = 0;
      actors.forEach(function (a) { if (!a.def.external && !a.held && (a.state === 'walk' || a.state === 'do')) n++; });
      return n;
    }

    // Keeps a point out of the lane between her and the camera, where a character would fill the view.
    function inLane(x, z) {
      var cam = ctx.cam;
      if (!cam) return false;
      var dx = cam.x - ctx.x, dz = cam.z - ctx.z, len2 = dx * dx + dz * dz;
      if (len2 < 1e-6) return false;
      var k = Math.max(0, Math.min(1, ((x - ctx.x) * dx + (z - ctx.z) * dz) / len2));
      return Math.hypot(x - (ctx.x + dx * k), z - (ctx.z + dz * k)) < LANE_W / 2;
    }

    function free(a, x, z) {
      var d = a.def;
      if (d.pet) return a.loose || !blocked(x, z, R_PET);
      var fromHome = Math.hypot(x - d.home.x, z - d.home.z);
      if (fromHome > d.leash + 0.3) return false;
      if (d.fly) return true;
      if (d.homeR && fromHome <= d.homeR + R_CHAR) return true;
      return !blocked(x, z, R_CHAR);
    }

    function anchor(a) { return a.def.pet ? a.own : a.def.home; }

    function pickPoint(a) {
      var c = anchor(a), lo = a.def.pet ? 1 : 0.8, hi = a.def.pet ? FOLLOW_FAR - 0.4 : a.def.leash;
      for (var i = 0; i < 10; i++) {
        var ang = rand() * Math.PI * 2, d = lo + rand() * (hi - lo), x = c.x + Math.sin(ang) * d, z = c.z + Math.cos(ang) * d;
        if (free(a, x, z) && !inLane(x, z)) return { x: x, z: z };
      }
      return null;
    }

    function setTarget(a, p) {
      a.target = p;
      a.legX = a.x;
      a.legZ = a.z;
      a.stuck = 0;
    }
    function goTo(a, p) {
      setTarget(a, p);
      a.state = 'walk';
      a.action = 'walk';
      a.prop = null;
    }

    // Steps toward (tx, tz), sliding round whatever is in the way; true when there.
    function walk(a, tx, tz, speed, dt) {
      var dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      if (d <= ARRIVE) {
        a.speed = 0;
        return true;
      }
      var len = Math.min(d, speed * dt), base = Math.atan2(dx, dz), turns = [0, 0.7, -0.7, 1.4, -1.4];
      for (var i = 0; i < turns.length; i++) {
        var ang = base + turns[i], nx = a.x + Math.sin(ang) * len, nz = a.z + Math.cos(ang) * len;
        if (free(a, nx, nz)) {
          a.speed = len / dt;
          a.x = nx;
          a.z = nz;
          a.face = ang;
          a.walkT += dt * speed * 0.5;
          a.stuck = 0;
          return false;
        }
      }
      a.speed = 0;
      a.stuck += dt;
      return false;
    }

    function rest(a) {
      a.state = 'rest';
      a.timer = between(a.def.pet ? PET_REST : REST);
      a.action = 'idle';
      a.prop = null;
      a.speed = 0;
      a.rt = null;
    }

    function enter(a) {
      var st = a.rt.steps[a.stepI];
      a.step = { t: 0, len: between(st.len) };
      a.state = 'do';
      a.action = st.action;
      a.prop = st.prop || null;
      a.speed = 0;
      if (st.pop) pops.push({ id: a.def.id, text: st.pop });
      if (st.voice) sounds.push({ id: a.def.id, name: 'voice', species: a.def.species });
    }
    function beginSteps(a) {
      a.stepI = 0;
      enter(a);
    }
    function nextStep(a) {
      a.stepI++;
      if (a.stepI < a.rt.steps.length) return enter(a);
      a.prop = null;
      if (!a.def.pet && far(a, a.def.home)) {
        a.homing = true;
        goTo(a, a.def.home);
        return;
      }
      rest(a);
    }

    function run(a, id) {
      var table = a.def.pet ? Data.PET_ROUTINES : Data.CHAR_ROUTINES, rt = table[id];
      a.last = id;
      a.rt = rt;
      a.route = [];
      a.homing = false;
      if (rt.move === 'home' && !a.def.pet && far(a, a.def.home)) return goTo(a, a.def.home);
      if (rt.move === 'wander') {
        var p = pickPoint(a);
        if (p) return goTo(a, p);
      }
      if (rt.move === 'route') {
        var pts = (a.def.route || []).filter(function (q) { return free(a, q.x, q.z); });
        if (pts.length) {
          a.route = pts.slice(1);
          return goTo(a, pts[0]);
        }
      }
      beginSteps(a);
    }

    function pickDifferent(list, last) {
      var pool = list.filter(function (id) { return id !== last; });
      pool = pool.length ? pool : list;
      return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
    }

    function startNext(a) {
      if (busyCount() >= cap) {
        a.timer = 1;
        return;
      }
      if (a.def.pet) return startPet(a);
      if (far(a, a.def.home)) {
        a.homing = true;
        return goTo(a, a.def.home);
      }
      run(a, pickDifferent(a.def.routines, a.last));
    }

    function runStates(a, dt, speed) {
      if (a.state === 'rest') {
        a.speed = 0;
        a.action = 'idle';
        if (ctx.busy) return;
        a.timer -= dt;
        if (a.timer <= 0) startNext(a);
      } else if (a.state === 'walk') {
        a.action = 'walk';
        if (walk(a, a.target.x, a.target.z, speed, dt)) {
          if (a.route.length) setTarget(a, a.route.shift());
          else if (a.homing) {
            a.homing = false;
            rest(a);
          } else beginSteps(a);
        } else if (a.stuck > STUCK) {
          a.homing = false;
          a.route = [];
          rest(a);
        }
      } else if (a.state === 'do') {
        a.speed = 0;
        a.step.t += dt;
        if (a.step.t >= a.step.len) nextStep(a);
      }
    }

    function charTick(a, dt) {
      var d = a.def;
      if (ctx.talkingTo === d.id) {
        a.state = 'talk';
        a.action = 'idle';
        a.prop = null;
        a.speed = 0;
        a.rt = null;
        a.homing = false;
        a.face = toward(a, ctx);
        return;
      }
      if (a.state === 'talk') {
        rest(a);
        a.timer = TALK_RESUME;
      }
      if (a.state === 'rest' && !ctx.busy && d.waves && t >= a.waveAt && Math.hypot(ctx.x - a.x, ctx.z - a.z) <= WAVE_R) {
        a.waveAt = t + WAVE_COOL;
        a.face = toward(a, ctx);
        run(a, 'wave');
        return;
      }
      runStates(a, dt, d.fly ? FLY_SPEED : CHAR_SPEED);
      if (d.fly) {
        var want = 0;
        if (a.state === 'walk') {
          want = FLY_H * Math.min(1, Math.hypot(a.x - a.legX, a.z - a.legZ) / 1.5, Math.hypot(a.target.x - a.x, a.target.z - a.z) / 1.5);
        } else if (a.state === 'do' && a.action === 'hover') want = FLY_H * 0.8;
        a.y += (want - a.y) * Math.min(1, dt * 6);
      }
    }

    // Pets: filled in by the next task.
    function startPet(a) { run(a, pickDifferent(Data.SPECIES[a.def.species].concat('sit'), a.last)); }
    function petTick(a, dt) { a.hidden = true; }

    function track(a, dt) {
      var s = ctx.owners && ctx.owners[a.def.id];
      if (!s) {
        a.speed = 0;
        return;
      }
      a.speed = a.seen && dt > 0 ? Math.hypot(s.x - a.x, s.z - a.z) / dt : 0;
      a.still = a.speed < 0.3 ? a.still + dt : 0;
      a.x = s.x;
      a.z = s.z;
      a.seen = true;
    }

    function hold(a) {
      a.held = true;
      a.state = 'rest';
      a.timer = 1;
      a.action = 'idle';
      a.prop = null;
      a.speed = 0;
      a.rt = null;
      a.homing = false;
      a.x = a.def.home.x;
      a.z = a.def.home.z;
      a.y = 0;
      a.face = a.def.face || 0;
    }
    function release(a) {
      a.held = false;
      a.x = a.def.home.x;
      a.z = a.def.home.z;
      a.face = a.def.face || 0;
      rest(a);
    }

    function gateDist(a) {
      var p = a;
      if (a.def.pet) p = byId[a.def.owner] || a;
      return Math.hypot(ctx.x - p.x, ctx.z - p.z);
    }

    function pose(a) {
      return { id: a.def.id, x: a.x, y: a.y, z: a.z, face: a.face, action: a.action, mag: a.speed > 0.1 ? 1 : 0, walkT: a.walkT,
        prop: a.prop, hidden: a.hidden, held: a.held, pet: !!a.def.pet };
    }

    function tick(dt, c) {
      ctx = c;
      t += dt;
      pops = [];
      sounds = [];
      sources = [];
      if (c.sprint) sources.push({ id: 'her', x: c.x, z: c.z, speed: SPRINT_SPEED });
      actors.forEach(function (a) {
        if (!a.def.external) return;
        track(a, dt);
        if (a.speed > STARTLE_SPEED) sources.push({ id: a.def.id, x: a.x, z: a.z, speed: a.speed });
      });
      [false, true].forEach(function (pets) {
        actors.forEach(function (a) {
          if (a.def.external || !!a.def.pet !== pets) return;
          if (c.hold && c.hold[a.def.id]) {
            hold(a);
            return;
          }
          if (a.held) release(a);
          if (gateDist(a) > NEAR) return;
          if (pets) petTick(a, dt);
          else charTick(a, dt);
          a.still = a.speed < 0.3 ? a.still + dt : 0;
        });
      });
      var poses = {};
      actors.forEach(function (a) { if (!a.def.external) poses[a.def.id] = pose(a); });
      return { poses: poses, pops: pops, sounds: sounds };
    }

    return {
      tick: tick,
      list: function () {
        return actors.filter(function (a) { return !a.def.external; }).map(function (a) {
          return { id: a.def.id, x: a.x, z: a.z, state: a.state, action: a.action, owner: a.def.owner || null, pet: !!a.def.pet };
        });
      }
    };
  }

  var exported = { create: create, NEAR: NEAR, CAP: CAP };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Routines = exported;
})(this);
```

- [ ] **Step 4: Run to verify the character tests pass**

Run: `node --test tests/world3d-routines.test.js`
Expected: PASS (8 tests). If "some characters near the plaza moved" fails because the plaza has few characters in range, widen `her`'s position to the street (`x: 0, z: -20`) in that one test; the other tests are unaffected.

- [ ] **Step 5: Commit command for the owner**

```bash
git add web/world/routines.js tests/world3d-routines.test.js && git commit -m 'Add living world engine: characters wander inside a leash, act, talk-freeze, hold, fly, cap' -- web/world/routines.js tests/world3d-routines.test.js
```

---

### Task 3: Pets in the engine (follow, species routines, reactions)

**Files:**
- Modify: `web/world/routines.js` (replace the two pet stubs)
- Test: `tests/world3d-routines.test.js` (append)

- [ ] **Step 1: Append the failing pet tests**

Append to `tests/world3d-routines.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `node --test tests/world3d-routines.test.js`
Expected: the 8 new pet tests FAIL (pet poses are all `hidden`, no `p-o` movement); the 8 character tests still pass.

- [ ] **Step 3: Replace the pet stubs in `web/world/routines.js`**

Replace the two lines `// Pets: filled in by the next task.`, `function startPet…`, `function petTick…` with:

```js
    function ownerOf(a) {
      var b = byId[a.def.owner];
      if (!b) return null;
      if (b.def.external) {
        var s = ctx.owners && ctx.owners[b.def.id];
        return s ? { x: s.x, z: s.z, state: s.state, seat: !!s.seat, hidden: !!s.hidden, still: b.still } : null;
      }
      return { x: b.def.fly ? b.def.home.x : b.x, z: b.def.fly ? b.def.home.z : b.z, state: 'idle', seat: false, hidden: b.hidden, still: b.still };
    }

    function spawn(a, own) {
      a.placed = true;
      a.loose = false;
      a.state = 'rest';
      a.timer = 0.5;
      a.action = 'idle';
      a.prop = null;
      a.rt = null;
      a.speed = 0;
      for (var i = 0; i < 20; i++) {
        var ang = rand() * Math.PI * 2, r = FOLLOW_NEAR + rand() * 1.4, x = own.x + Math.sin(ang) * r, z = own.z + Math.cos(ang) * r;
        if (!blocked(x, z, R_PET)) {
          a.x = x;
          a.z = z;
          return;
        }
      }
      a.x = own.x;
      a.z = own.z;
      a.loose = true;
    }

    // A pet of another owner, close and resting, who may play too.
    function playMate(a) {
      for (var i = 0; i < actors.length; i++) {
        var b = actors[i];
        if (b === a || !b.def.pet || b.def.owner === a.def.owner || !b.placed || b.hidden || b.state !== 'rest') continue;
        if (t >= a.playAt && t >= b.playAt && dist(a, b) <= PLAY_R) return b;
      }
      return null;
    }

    function startPet(a) {
      var d = a.def, herD = Math.hypot(ctx.x - a.x, ctx.z - a.z), mate = playMate(a);
      if (t >= a.greetAt && (herD <= GREET_R || (ctx.waving && herD <= WAVING_R))) {
        a.greetAt = t + GREET_COOL;
        a.face = toward(a, ctx);
        return run(a, 'greet');
      }
      if (mate) {
        a.playAt = mate.playAt = t + PLAY_COOL;
        a.face = toward(a, mate);
        mate.face = toward(mate, a);
        run(mate, 'play');
        return run(a, 'play');
      }
      if (a.own.still >= NAP_AFTER && rand() < 0.7) return run(a, 'nap');
      run(a, pickDifferent(Data.SPECIES[d.species].concat('sit'), a.last));
    }

    // Someone else running (or her sprinting) close by: a hop away, or a turtle's shell.
    function startled(a) {
      if (t < a.startleAt) return false;
      for (var i = 0; i < sources.length; i++) {
        var s = sources[i];
        if (s.id === a.def.owner || Math.hypot(s.x - a.x, s.z - a.z) > STARTLE_R) continue;
        a.startleAt = t + STARTLE_COOL;
        if (a.def.species === 'turtle') {
          run(a, 'shell');
          return true;
        }
        var dx = a.x - s.x, dz = a.z - s.z, dl = Math.hypot(dx, dz) || 1;
        a.sx = dx / dl;
        a.sz = dz / dl;
        a.state = 'startle';
        a.timer = STARTLE_TIME;
        a.prop = null;
        a.rt = null;
        pops.push({ id: a.def.id, text: '❗' });
        return true;
      }
      return false;
    }

    function petTick(a, dt) {
      var d = a.def, own = ownerOf(a);
      if (!own) {
        a.hidden = true;
        return;
      }
      a.own = own;
      a.hidden = own.hidden;
      if (!a.placed || far(a, own, JUMP)) spawn(a, own);
      var gap = Math.hypot(own.x - a.x, own.z - a.z), speed = PET_WALK * (Data.PET_SPEED[d.species] || 1);

      if (a.state === 'startle') {
        a.action = 'hop';
        a.timer -= dt;
        var nx = a.x + a.sx * STARTLE_RUN * dt, nz = a.z + a.sz * STARTLE_RUN * dt;
        if (free(a, nx, nz)) {
          a.x = nx;
          a.z = nz;
        }
        a.speed = STARTLE_RUN;
        if (a.timer <= 0) rest(a);
        return;
      }

      if (own.seat || own.state === 'ride' || own.state === 'join' || own.state === 'game') {
        if (a.state !== 'wait') {
          a.state = 'wait';
          a.speed = 0;
          a.prop = null;
          a.rt = null;
          if (own.state !== 'game') pops.push({ id: d.id, text: '🎉' });
        }
        a.action = 'sit';
        a.face = toward(a, own);
        return;
      }
      if (a.state === 'wait') rest(a);

      var talking = ctx.talkingTo === d.owner, stop = talking ? SIDE : FOLLOW_NEAR, limit = talking ? SIDE + 0.5 : FOLLOW_FAR;
      if (gap > limit && a.state !== 'follow') {
        a.state = 'follow';
        a.prop = null;
        a.rt = null;
        a.homing = false;
      }
      if (a.state === 'follow') {
        a.action = 'walk';
        var k = gap > 0 ? stop / gap : 0;
        if (gap <= stop + 0.3) {
          rest(a);
          a.timer = 0.3;
        } else if (walk(a, own.x + (a.x - own.x) * k, own.z + (a.z - own.z) * k, gap > RUN_FROM ? PET_RUN : speed, dt)) {
          rest(a);
          a.timer = 0.3;
        } else if (a.stuck > STUCK) spawn(a, own);
        return;
      }
      if (talking) {
        a.state = 'side';
        a.action = 'sit';
        a.speed = 0;
        a.face = toward(a, ctx);
        return;
      }
      if (a.state === 'side') rest(a);

      if (startled(a)) return;
      if (a.state === 'rest' && Math.hypot(ctx.x - a.x, ctx.z - a.z) <= LOOK_R) a.face = toward(a, ctx);
      runStates(a, dt, speed);
    }
```

- [ ] **Step 4: Run to verify everything passes**

Run: `node --test tests/world3d-routines.test.js`
Expected: PASS (16 tests). If the play test or the nap test is flaky on the seed (it uses one seed so it should be stable), lengthen the loop first; never loosen the assertion.

- [ ] **Step 5: Commit command for the owner**

```bash
git add web/world/routines.js tests/world3d-routines.test.js && git commit -m 'Pets in the living world engine: follow, species routines, nap, greet, play, startle, ride wait' -- web/world/routines.js tests/world3d-routines.test.js
```

---

### Task 4: New pet moods in `petbody.js`

**Files:**
- Modify: `web/world/petbody.js` (`animate`, exports)
- Test: `tests/world3d-life-wiring.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-life-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');
const Data = require(worldFile('lifedata.js'));
const PetBody = require(worldFile('petbody.js'));

test('every pet action is a mood the pet body can show', () => {
  const actions = new Set(['idle', 'walk', 'sit', 'hop']);
  for (const rt of Object.values(Data.PET_ROUTINES)) for (const s of rt.steps) actions.add(s.action);
  for (const a of actions) assert.ok(PetBody.MOODS_ALL.includes(a), 'petbody has no mood ' + a);
});

test('every character action is a pose cast.js knows', () => {
  const src = fs.readFileSync(worldFile('cast.js'), 'utf8');
  const actions = new Set(['walk']);
  for (const rt of Object.values(Data.CHAR_ROUTINES)) for (const s of rt.steps) actions.add(s.action);
  for (const a of actions) assert.match(src, new RegExp('\\b' + a + ': function'), 'cast.js has no action ' + a);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-life-wiring.test.js`
Expected: FAIL (`PetBody.MOODS_ALL` is undefined; the cast test also fails until Task 5).

- [ ] **Step 3: Edit `petbody.js`**

Above `// l = a look already through Pets.wearable()` (before `function build`), add:

```js
  // Moods the world's living pets show (routines.js actions); t is the clock, so each loops.
  var MOODS = {
    hop: function (b, t) { b.position.y = Math.abs(Math.sin(t * 8)) * 0.6; },
    preen: function (b, t) { b.rotation.z = Math.sin(t * 6) * 0.18; b.rotation.x = 0.1; },
    crouch: function (b, t) { b.scale.set(1.1, 0.7, 1.1); b.rotation.x = 0.1; b.position.x = Math.sin(t * 25) * 0.03; },
    pounce: function (b, t) { b.position.y = Math.abs(Math.sin(t * 5)) * 1.2; b.rotation.x = -0.4; },
    shell: function (b) { b.scale.set(1.1, 0.6, 1.1); },
    rear: function (b) { b.rotation.x = -0.5; b.position.y = 0.2; },
    breathe: function (b, t) { b.rotation.x = -0.35; b.scale.set(1, 1 + Math.sin(t * 20) * 0.05, 1); },
    chase: function (b, t) { b.position.y = Math.abs(Math.sin(t * 9)) * 0.5; b.rotation.y = Math.sin(t * 3) * 0.9; },
    carry: function (b, t) { b.position.y = Math.abs(Math.sin(t * 6)) * 0.25; b.rotation.x = -0.1; },
    run: function (b, t) { b.position.y = Math.abs(Math.sin(t * 16)) * 0.3; b.rotation.z = Math.sin(t * 16) * 0.12; },
    roll: function (b, t) { b.rotation.z = t * 7; b.position.y = 0.3; },
    belly: function (b) { b.rotation.x = 1.2; b.position.y = 0.1; },
    graze: function (b, t) { b.rotation.x = 0.5 + Math.sin(t * 3) * 0.08; },
    prance: function (b, t) { b.position.y = Math.abs(Math.sin(t * 5)) * 0.5; b.rotation.y = Math.sin(t * 2.5) * 0.4; },
    stare: function (b, t) { b.rotation.y = Math.sin(t * 0.9) * 0.9; },
    paddle: function (b, t) { b.position.y = Math.sin(t * 6) * 0.08; b.rotation.z = Math.sin(t * 6) * 0.1; },
    peck: function (b, t) { b.rotation.x = 0.1 + Math.max(0, Math.sin(t * 9)) * 0.55; }
  };
  var MOODS_ALL = ['idle', 'walk', 'happy', 'munch', 'sit', 'sleep', 'stretch'].concat(Object.keys(MOODS));
```

In `animate`, change the final `else body.position.y = Math.abs(Math.sin(t * 2)) * 0.05;` to:

```js
      else if (MOODS[mood]) MOODS[mood](body, t);
      else body.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
```

Note `hop` is a new mood but `munch` already exists (head bob) and is reused by bamboo and carrot.

In the `exported` object add `MOODS_ALL: MOODS_ALL`.

- [ ] **Step 4: Run to verify the pet-mood test passes**

Run: `node --test tests/world3d-life-wiring.test.js`
Expected: first test PASS, second FAIL (cast.js, done in Task 5).

- [ ] **Step 5: Commit command for the owner (after Task 5 so the suite is green; combine)** — see Task 5 step 5.

---

### Task 5: Character actions in `cast.js`

**Files:**
- Modify: `web/world/cast.js` (`life()`, `mimi()`, `hoot` body offset exposure)

- [ ] **Step 1: Read what writes the body and head each frame**

Run `grep -n "top.rotation\|body.rotation\|body.position\|body.scale" web/world/cast.js`. Today only `life()` (lines 54-68) and one other animate (line 387, a tree face) write them, plus each character's own wrapper that calls `idle(t)` first. The action layer below runs inside `life().animate`, so wrappers still run after it.

- [ ] **Step 2: Add the actions and `setAction` to `life()`**

Replace `life()` (currently lines 53-68, starting at the comment `// A gentle idle bob and head tilt; dance() hops and spins once.`) with:

```js
  // Whole-body poses for what the world's characters do (routines.js); d = seconds since the action began.
  var ACTIONS = {
    walk: function (b, top, d) { b.position.y += Math.abs(Math.sin(d * 8)) * 0.18; b.rotation.z = Math.sin(d * 8) * 0.07; },
    sweep: function (b, top, d) { b.rotation.y = Math.sin(d * 4) * 0.35; b.rotation.x = 0.18; },
    read: function (b, top) { top.rotation.x = 0.35; b.rotation.x = 0.06; },
    water: function (b, top, d) { b.rotation.x = 0.3 + Math.sin(d * 6) * 0.05; },
    gaze: function (b, top, d) { top.rotation.x = -0.35; top.rotation.y = Math.sin(d * 0.8) * 0.4; },
    stretch: function (b, top, d) { b.scale.y = 1.08 + Math.sin(d * 3) * 0.04; top.rotation.x = -0.25; },
    hum: function (b, top, d) { b.rotation.z = Math.sin(d * 3) * 0.1; b.position.y += Math.abs(Math.sin(d * 3)) * 0.12; },
    arrange: function (b, top, d) { b.rotation.x = 0.2; b.rotation.y = Math.sin(d * 2.5) * 0.25; },
    serve: function (b, top, d) { b.rotation.x = 0.15 + Math.max(0, Math.sin(d * 2)) * 0.15; top.rotation.y = Math.sin(d * 1.4) * 0.3; },
    sip: function (b, top, d) { top.rotation.x = -0.3 * Math.min(1, d * 2); },
    hammer: function (b, top, d) { b.rotation.x = 0.1 + Math.max(0, Math.sin(d * 6)) * 0.12; },
    nibble: function (b, top, d) { top.rotation.x = 0.4 + Math.sin(d * 12) * 0.12; },
    hop: function (b, top, d) { b.position.y += Math.abs(Math.sin(d * 7)) * 0.7; },
    flap: function (b, top, d) { b.position.y += Math.abs(Math.sin(d * 12)) * 0.25; b.rotation.z = Math.sin(d * 12) * 0.12; },
    hover: function (b, top, d) { b.position.y += Math.sin(d * 5) * 0.12; b.rotation.z = Math.sin(d * 9) * 0.1; },
    wave: function (b, top, d) { b.rotation.z = Math.sin(d * 6) * 0.14; b.position.y += Math.abs(Math.sin(d * 6)) * 0.2; }
  };

  // A gentle idle bob and head tilt; dance() hops and spins once; setAction(name, lift) holds one of ACTIONS (lift raises
  // the body, for a flying Hoot).
  function life(group, body, top, phase) {
    var from = null, pending = false, baseY = body.position.y, act = 'idle', actFrom = 0, lastT = 0, lift = 0;
    function animate(t) {
      lastT = t;
      if (pending) { from = t; pending = false; }
      var d = from === null ? -1 : t - from;
      body.scale.y = 1;
      body.rotation.x = 0;
      body.rotation.z = 0;
      top.rotation.x = 0;
      top.rotation.y = 0;
      if (d >= 0 && d < DANCE) {
        body.position.y = baseY + Math.abs(Math.sin(d * 9)) * 0.7;
        body.rotation.y = d / DANCE * Math.PI * 2;
      } else {
        from = null;
        body.position.y = baseY + Math.abs(Math.sin(t * 2 + phase)) * 0.08;
        body.rotation.y = 0;
        if (ACTIONS[act]) ACTIONS[act](body, top, t - actFrom);
      }
      body.position.y += lift;
      top.rotation.z = Math.sin(t * 1.5 + phase) * 0.06;
    }
    function setAction(name, y) {
      if (name !== act) {
        act = name;
        actFrom = lastT;
      }
      lift = y || 0;
    }
    return { group: group, body: body, animate: animate, dance: function () { pending = true; }, setAction: setAction };
  }
```

If `grep` in step 1 shows another character writes `top.rotation.x/y` or `body.rotation.x/z` outside a wrapper that runs after `idle(t)`, drop that axis from the resets above.

- [ ] **Step 3: Give Mimi `setAction` too**

Read `mimi()` (`web/world/cast.js:193-236`). It returns `{ group, animate, wave }` with its own animate. Add, inside `mimi()`, a variable `var act = 'idle', actFrom = 0, lastT = 0;`, set `lastT = t` at the top of its animate, and after its existing pose code add `if (ACTIONS[act]) ACTIONS[act](body, head, t - actFrom);` using its body group and its head group (use the variable names the function already has; if it has no head variable, pass the body group twice). Return `setAction: function (name) { if (name !== act) { act = name; actFrom = lastT; } }` and `body: body` with the others. Mimi's own wave pose still runs; actions only add to it.

- [ ] **Step 4: Run the wiring test**

Run: `node --test tests/world3d-life-wiring.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit command for the owner (Tasks 4 and 5)**

```bash
git add web/world/petbody.js web/world/cast.js tests/world3d-life-wiring.test.js && git commit -m 'Add pet moods and character actions for the living world' -- web/world/petbody.js web/world/cast.js tests/world3d-life-wiring.test.js
```

---

### Task 6: Hooks in `folk.js`, `mates3d.js`, `town.js`

**Files:**
- Modify: `web/world/folk.js`, `web/world/mates3d.js`, `web/world/town.js`
- Test: `tests/world3d-life-wiring.test.js` (append)

- [ ] **Step 1: Append failing tests**

```js
test('folk, mates3d and town give the living world what it needs', () => {
  const folk = fs.readFileSync(worldFile('folk.js'), 'utf8');
  assert.match(folk, /chars: function/);
  assert.match(folk, /talkingId: function/);
  assert.match(fs.readFileSync(worldFile('mates3d.js'), 'utf8'), /owners: function/);
  const town = fs.readFileSync(worldFile('town.js'), 'utf8');
  assert.match(town, /mimiLife: function/);
});
```

Run `node --test tests/world3d-life-wiring.test.js`; expected FAIL on the new test.

- [ ] **Step 2: `folk.js`**

In `act(it)`, record who is being talked to. Replace `act`:

```js
    var talkWho = null;
    function whoOf(it) {
      if (it.kind === 'buddy') return 'buddy:' + it.app;
      if (it.kind === 'hoot') return 'hoot';
      if (it.kind === 'counter') return 'bunny';
      if (it.kind === 'boutique') return 'lana';
      if (it.kind === 'petshop') return 'kiko';
      if (it.kind === 'toyshop') return 'pilo';
      if (it.kind === 'carpenter') return 'tasyo';
      return null;
    }

    function act(it) {
      if (talk) return;
      talkWho = whoOf(it);
      if (it.kind === 'buddy') openBuddy(it.app);
      else if (it.kind === 'hoot') openHoot();
      else if (it.kind === 'counter') openBunny();
      else if (it.kind === 'boutique' || it.kind === 'petshop' || it.kind === 'toyshop' || it.kind === 'carpenter') o.stall(it.kind);
      else if (it.kind === 'tree') openTree(it.tree);
    }

    // Every character with a body, by the id routines.js uses, for the living world (life.js).
    function chars() {
      var out = { hoot: hoot.char, bunny: bunny.char, lana: lana, kiko: kiko, pilo: pilo, tasyo: tasyo };
      Object.keys(buddies).forEach(function (a) { out['buddy:' + a] = buddies[a].char; });
      return out;
    }
```

In the returned object add `chars: chars,` and `talkingId: function () { return talk ? talkWho : null; },`.

- [ ] **Step 3: `mates3d.js`**

In the `api` object, after `ids:`, add:

```js
      owners: function () {
        var out = {};
        mind.list().forEach(function (k) {
          out['mate:' + k.id] = { x: k.x, z: k.z, state: k.state, seat: !!k.seat, hidden: !byId[k.id].ch.group.visible };
        });
        return out;
      },
      talking: function () { return talking ? 'mate:' + talking.m.id : null; },
```

- [ ] **Step 4: `town.js`**

In its returned object add (near the other mimi-related methods; `plate`, `mimi`, `visit`, `talk` are the closure variables seen at lines 26-35):

```js
      mimiLife: function () {
        return {
          char: mimi,
          held: function () { return !!visit; },
          talking: function () { return !!talk; },
          place: function (x, z, face) {
            mimi.group.position.set(x, 0, z);
            mimi.group.rotation.y = face;
            plate.position.set(x, 6.4, z);
          }
        };
      },
```

`held()` is true during the 10-minute nudge visit, where `town.js` moves Mimi itself; `talking()` is true while any of Mimi's talks is open. If `talk` is also open for other town talks (Jesus, Lamb), `town.js` has a `talk` closure for all of them; use a separate `var mimiTalk = false;` set true in the Mimi-talk opener (the `say('🐱', T.mimi, …)` calls at lines 81, 112, 122) and false in `say`'s `onClose`, and return that in `talking()` instead.

- [ ] **Step 5: Run the wiring test and the existing suite for these files**

Run: `node --test tests/world3d-life-wiring.test.js tests/world-wiring.test.js tests/world3d-mates-wiring.test.js`
Expected: PASS.

- [ ] **Step 6: Commit command for the owner**

```bash
git add web/world/folk.js web/world/mates3d.js web/world/town.js tests/world3d-life-wiring.test.js && git commit -m 'Expose characters, playmate positions and Mimi to the living world' -- web/world/folk.js web/world/mates3d.js web/world/town.js tests/world3d-life-wiring.test.js
```

---

### Task 7: `life.js` view layer

**Files:**
- Create: `web/world/life.js`
- Test: `tests/world3d-life-wiring.test.js` (append)

- [ ] **Step 1: Append failing tests**

```js
test('life.js builds pets from lifedata and never touches coins, points or storage', () => {
  const src = fs.readFileSync(worldFile('life.js'), 'utf8');
  assert.match(src, /PetBody\.build\(/);
  assert.match(src, /Routines\.create\(/);
  for (const banned of ['Wallet', 'Recall.', 'StudyKit', 'Learner', 'localStorage', 'store']) assert.ok(!src.includes(banned), banned);
});
```

Run; expected FAIL (`ENOENT life.js`).

- [ ] **Step 2: Write `web/world/life.js`**

```js
/* The living world in 3D: runs routines.js for the characters and pets, moves each character to its pose (Hoot's body
   only, because his bench is part of his group), builds the unique pets (petbody.js), shows a prop emoji beside whoever
   is using one and a pop over their head, plays a pet's voice when it is close, and shows a pet's name only when she
   is near. Cosmetic: nothing is saved, no coins or points. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SHOW = 50, TAG_R = 7, VOICE_R = 14, POP_TIME = 1.4, POOLS = 8, PROP_SIDE = 1.1;
  var CHAR_HEAD = 4.4, PET_HEAD = 2.4, CHAR_PROP_Y = 2.3, PET_PROP_Y = 1.1;

  // o = { S, grade, rand, blocked(x, z, r), kids: ids from mates.api.ids(), chars() (folk.chars), owners() (mates.api.owners),
  //       mimi() (town.mimiLife), talkingId() → id | null, busy() → bool, waving() → bool, sfx(name) }
  function create(o) {
    var S = o.S, L = W.Layout, PB = W.PetBody, defs = W.LifeData.build(o.grade, L, o.kids);
    var obs = L.obstacles(o.grade), bounds = L.GRADES[o.grade].bounds;
    var engine = W.Routines.create({
      actors: defs, rand: o.rand,
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r) || !!(o.blocked && o.blocked(x, z, r)); }
    });
    var chars = o.chars(), mimi = o.mimi(), textures = {}, pets = {}, props = {}, pool = [], forced;
    chars.mimi = mimi.char;

    function texture(e) {
      if (!textures[e]) textures[e] = S.emoji(e);
      return textures[e];
    }
    function sprite(e, size) {
      var sp = S.sprite(texture(e), size, size);
      sp.visible = false;
      S.scene.add(sp);
      return sp;
    }

    defs.forEach(function (d) {
      if (!d.pet) return;
      var body = PB.build(S, { pet: d.species, petColor: d.color, petWear: {} });
      body.group.visible = false;
      S.scene.add(body.group);
      pets[d.id] = { def: d, body: body, tag: PB.tag(S, body, d.name) };
      pets[d.id].tag.visible = false;
    });
    for (var i = 0; i < POOLS; i++) pool.push({ sp: null, e: '', t: 0, x: 0, y: 0, z: 0 });

    function pop(x, y, z, text) {
      var slot = pool.filter(function (p) { return p.t <= 0; })[0];
      if (!slot) return;
      if (!slot.sp || slot.e !== text) {
        if (slot.sp) S.scene.remove(slot.sp);
        slot.sp = sprite(text, 1.4);
        slot.e = text;
      }
      slot.t = POP_TIME;
      slot.x = x;
      slot.y = y;
      slot.z = z;
    }

    // The emoji of what someone is using, floating beside them while they use it.
    function showProp(id, e, x, y, z, face) {
      var p = props[id];
      if (!e) {
        if (p) p.sp.visible = false;
        return;
      }
      if (!p || p.e !== e) {
        if (p) S.scene.remove(p.sp);
        p = props[id] = { e: e, sp: sprite(e, 1.1) };
      }
      p.sp.visible = true;
      p.sp.position.set(x + Math.sin(face + Math.PI / 2) * PROP_SIDE, y, z + Math.cos(face + Math.PI / 2) * PROP_SIDE);
    }

    function applyChar(def, p, t, st) {
      var c = chars[def.id];
      if (!c) return;
      var near = Math.hypot(p.x - st.x, p.z - st.z) <= SHOW;
      if (def.id === 'mimi') {
        if (!p.held) mimi.place(p.x, p.z, p.face);
      } else if (def.fly) {
        // Hoot's bench belongs to his group, so only his body moves, in the group's own axes.
        var f = c.group.rotation.y, dx = p.x - def.home.x, dz = p.z - def.home.z;
        c.body.position.x = dx * Math.cos(f) - dz * Math.sin(f);
        c.body.position.z = dx * Math.sin(f) + dz * Math.cos(f);
      } else {
        c.group.position.set(p.x, 0, p.z);
        c.group.rotation.y = p.face;
      }
      if (c.setAction && !p.held) c.setAction(p.action, def.fly ? p.y : 0);
      showProp(def.id, near && !p.held ? p.prop : null, p.x, CHAR_PROP_Y + (def.fly ? p.y : 0), p.z, p.face);
    }

    function applyPet(pet, p, t, st) {
      var g = pet.body.group, d = Math.hypot(p.x - st.x, p.z - st.z);
      g.visible = !p.hidden && d <= SHOW;
      pet.tag.visible = g.visible && d <= TAG_R;
      if (!g.visible) {
        showProp(pet.def.id, null);
        return;
      }
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.face;
      pet.body.animate(t, p.action);
      showProp(pet.def.id, p.prop, p.x, PET_PROP_Y, p.z, p.face);
    }

    function tick(t, dt, st) {
      var out = engine.tick(dt, {
        x: st.x, z: st.z, sprint: !!st.sprint, cam: { x: S.camera.position.x, z: S.camera.position.z },
        talkingTo: forced !== undefined ? forced : (o.talkingId() || (mimi.talking() ? 'mimi' : null)),
        busy: !!(o.busy && o.busy()), waving: !!(o.waving && o.waving()),
        hold: mimi.held() ? { mimi: true } : null, owners: o.owners()
      });
      defs.forEach(function (d) {
        if (d.external) return;
        var p = out.poses[d.id];
        if (d.pet) applyPet(pets[d.id], p, t, st);
        else applyChar(d, p, t, st);
      });
      out.pops.forEach(function (q) {
        var p = out.poses[q.id], d = Math.hypot(p.x - st.x, p.z - st.z);
        if (d <= SHOW && !p.hidden) pop(p.x, (p.pet ? PET_HEAD : CHAR_HEAD) + p.y, p.z, q.text);
      });
      out.sounds.forEach(function (q) {
        var p = out.poses[q.id];
        if (o.sfx && Math.hypot(p.x - st.x, p.z - st.z) <= VOICE_R) o.sfx(q.species === 'dragon' ? 'rawr' : 'pet-' + q.species);
      });
      pool.forEach(function (p) {
        if (p.t <= 0) {
          if (p.sp) p.sp.visible = false;
          return;
        }
        p.t -= dt;
        p.sp.visible = p.t > 0;
        p.sp.position.set(p.x, p.y + (POP_TIME - p.t) * 0.8, p.z);
      });
    }

    return {
      tick: tick,
      debug: {
        list: engine.list,
        pets: function () { return Object.keys(pets); },
        talk: function (id) { forced = id === null ? undefined : id; }
      }
    };
  }

  W.Life = { create: create };
})(this);
```

If `sfx.play('rawr')` / `'pet-turtle'` names are not the keys `sfx.play` accepts, check `web/world/sfx.js` `SOUNDS` (`pet-turtle` maps to `pop.mp3`; the dragon's voice key is `rawr`) and use those; no new sound files are added.

- [ ] **Step 3: Run the wiring test**

Run: `node --test tests/world3d-life-wiring.test.js`
Expected: PASS.

- [ ] **Step 4: Commit command for the owner**

```bash
git add web/world/life.js tests/world3d-life-wiring.test.js && git commit -m 'Add the living world view: poses, pets, prop and pop emoji, voices' -- web/world/life.js tests/world3d-life-wiring.test.js
```

---

### Task 8: Load the files, create `Life` in `world-main.js`

**Files:**
- Modify: `tests/paths.js:15` (`WORLD_FILES`), `web/world/grade-5.html`, `web/world/grade-2.html`, `web/world/world-main.js`
- Test: `tests/world3d-life-wiring.test.js` (append), existing `tests/world-wiring.test.js`

- [ ] **Step 1: Append failing tests**

```js
test('the world creates and ticks the living world, only outside rooms and menus', () => {
  const src = fs.readFileSync(worldFile('world-main.js'), 'utf8');
  assert.match(src, /W\.Life\.create\(/);
  assert.match(src, /life\.tick\(/);
  assert.match(src, /debug\.life = life\.debug/);
});
```

Run; expected FAIL.

- [ ] **Step 2: `tests/paths.js`**

In `WORLD_FILES`, insert `'lifedata.js', 'routines.js'` after `'petlife.js'`, and `'life.js'` after `'mates3d.js'` (before `'games3d.js'`).

- [ ] **Step 3: Both world pages**

In `web/world/grade-5.html` and `web/world/grade-2.html` add the same three `<script src="…"></script>` tags in the same positions as in `WORLD_FILES` (tests/world-wiring.test.js compares order).

- [ ] **Step 4: `world-main.js`**

After the `var mates = W.Mates3D.create({ … });` statement (line ~220-234) add:

```js
    var herMove = false;
    var life = W.Life.create({
      S: S, grade: grade, kids: mates.api.ids(),
      blocked: function (x, z, r) { return !!games && games.blocked(x, z, r); },
      chars: folk.chars, owners: mates.api.owners, mimi: town.mimiLife,
      talkingId: function () { return folk.talkingId() || mates.api.talking(); }, busy: function () { return talking || !!overlay; }, waving: function () { return herMove; },
      sfx: function (name) { sfx.play(name); }
    });
```

In `startMove(id)` after `pal.watch(ctl.state, W.Moves.find(id).len);` add `herMove = true;`. In the frame code where `if (!mv) pal.unwatch();` appears add `if (!mv) herMove = false;` on the next line.

In the frame block that ticks mates, after `if (!overlay) mates.tick(t, dt, st, play.now(), near);` add:

```js
        if (!overlay) life.tick(t, dt, st);
```

Near `debug.mates = mates.debug;` add `debug.life = life.debug;`.

`overlay`, `talking` and `games` are existing variables in `world-main.js`; `games` is assigned after `mates` is created, which is why `blocked` checks it at call time.

- [ ] **Step 5: Update the precache and run the wiring tests**

Run: `node tools/update-precache.js`
Run: `node --test tests/world3d-life-wiring.test.js tests/world-wiring.test.js tests/pwa.test.js tests/browser-globals.test.js`
Expected: PASS. `browser-globals.test.js` may flag a missing/extra global; fix by matching its message (the new globals are `World3D.LifeData`, `World3D.Routines`, `World3D.Life`).

- [ ] **Step 6: Commit command for the owner**

```bash
git add tests/paths.js web/world/grade-5.html web/world/grade-2.html web/world/world-main.js web/sw.js tests/world3d-life-wiring.test.js && git commit -m 'Wire the living world into both worlds' -- tests/paths.js web/world/grade-5.html web/world/grade-2.html web/world/world-main.js web/sw.js tests/world3d-life-wiring.test.js
```

---

### Task 9: e2e in headless Chrome

**Files:**
- Modify: `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`

- [ ] **Step 1: Add the `life` mode to the driver**

In `tests/e2e/world-driver.page.js`, extend the header comment's mode list with `life`, and add before `if (mode === 'house')`:

```js
    if (mode === 'life') {
      D.pause();
      var LF = D.life, start = {}, r;
      D.teleport('playground');
      D.tick(0.1);
      LF.list().forEach(function (a) { start[a.id] = { x: a.x, z: a.z }; });
      var charIds = LF.list().filter(function (a) { return !a.pet; }).map(function (a) { return a.id; });
      var seen = {};
      for (r = 0; r < 600; r++) {
        D.tick(0.1);
        LF.list().forEach(function (a) { seen[a.id] = seen[a.id] || {}; seen[a.id][a.action] = true; });
      }
      var now = {};
      LF.list().forEach(function (a) { now[a.id] = a; });
      o.pets = LF.pets();
      o.movedChars = charIds.filter(function (id) { return Math.hypot(now[id].x - start[id].x, now[id].z - start[id].z) > 0.3 || Object.keys(seen[id]).length > 2; }).length;
      o.chars = charIds.length;
      o.petActions = LF.pets().map(function (id) { return Object.keys(seen[id] || {}).length; });
      LF.talk('lana');
      D.tick(0.1);
      var lanaAt = LF.list().filter(function (a) { return a.id === 'lana'; })[0];
      for (r = 0; r < 30; r++) D.tick(0.1);
      var lanaLater = LF.list().filter(function (a) { return a.id === 'lana'; })[0];
      o.lanaFrozen = lanaAt.x === lanaLater.x && lanaAt.z === lanaLater.z && lanaLater.action === 'idle';
      LF.talk(null);
      return out(o);
    }
```

Mode bodies in this file use `D = window.WorldDebug` and `o` as the output object; `D.teleport('playground')` and `D.tick(dt)` are used the same way in the `mates` mode. If `D.teleport('playground')` places her away from the shop owners, the distance gate (40) can freeze them: use `D.stand(57.8 - 8, 0)` (west of the shop owners) instead and keep the rest.

- [ ] **Step 2: Assert it in `world-e2e.js`**

After the `mt` playmates block (`console.log('ok playmates: …')`), add:

```js
  // Living world: characters move or act within 60 s, 11 pets exist (6 on world characters, 5 on playmates), a character
  // that is talked to freezes.
  const lifeFile = stageWorld('life', 5, MATES);
  for (const f of lf.files) {
    const to = path.join(work, 'life', 'world', lf.dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(web('world'), lf.dir, f), to);
  }
  const lv = run('life', lifeFile, 'life');
  assert.deepEqual(lv.errors, [], 'life: page errors');
  assert.equal(lv.pets.length, 11, 'eleven pets');
  assert.ok(lv.movedChars >= lv.chars - 3, 'characters move or act: ' + lv.movedChars + ' of ' + lv.chars);
  assert.ok(lv.petActions.every((n) => n >= 2), 'every pet did something: ' + lv.petActions);
  assert.equal(lv.lanaFrozen, true, 'a character talked to stands still');
  console.log('ok living world: characters move, pets act, talks freeze');
```

- [ ] **Step 3: Run the new and the existing world e2e**

Run: `node tests/e2e/world-e2e.js`
Expected: every `ok …` line prints, including `ok living world: characters move, pets act, talks freeze`, and the earlier blocks (playmates, games, rides, house) still pass. If `movedChars` is low because some characters sit beyond 40 units from where she stands, move her with `D.stand(...)` to a central spot (the plaza `0, 0`) for the first half of the loop and the second half near the shops; do not lower the assertion below `chars - 6`.

- [ ] **Step 4: Commit command for the owner**

```bash
git add tests/e2e/world-driver.page.js tests/e2e/world-e2e.js && git commit -m 'Add the living world e2e: characters move, pets act, talks freeze' -- tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 10: Full verification, docs

**Files:**
- Modify: `docs/HANDOFF.md`, `README.md`

- [ ] **Step 1: Run everything**

Run: `node --test`
Run: `node tests/e2e/world-e2e.js`
Run: `node tests/e2e/backdrop-e2e.js` (the start-page backdrop shares `petbody.js`, `cast.js` and `pets.js`)
Run: `node tests/e2e/english-first-e2e.js` (guards Grade 2 text)
Expected: all pass. A failure in `english-first` means a new string leaked; the only new strings are emoji, pet names (Tagpi, Lila, Kidlat, Pandesal, Mingming, Kwento, Tagal, Bituin, Kawayan, Hielo, Pitik) and no labels; if it flags a pet name add them to that test's allowed names (names are not translated).

- [ ] **Step 2: Manual look**

Run the site (`node tools/` has no server; open `web/world/grade-5.html` through the project's usual local server) and check: buddies by their doors sweep, read, water; the shop owners tidy and serve; Hoot flaps and flies short loops; Mimi strolls and waves; the five playmates' pets follow and sit when their kid rides; walking close to a pet makes it hop with a heart; the turtle pulls into its shell when she sprints past. Report anything that clips (a character in a wall, a pet floating) with the character's id before fixing.

- [ ] **Step 3: Docs**

In `docs/HANDOFF.md`, under `**3D world**` → "Built", add after the Playground playmates bullet:

```
- Living world (2026-10-09): world characters no longer stand still. Buddies, Hoot, Bunny, Mimi and the four shop
  owners each run small routines (sweep, read, water, serve, hammer, hop, short flights, Mimi's stroll) inside a
  leash of 2-3 squares around their spot; they wave when she walks close, stop and face her when she talks to them,
  and carry on 2 s after. 11 unique pets (5 on playmates: Tagpi, Lila, Kidlat, Pandesal, Mingming; Hoot's parrot
  Kwento, Bunny's turtle Tagal, Mimi's unicorn Bituin; three on buddies) follow their owner, do 2 species behaviors
  each (parrot talks, fox pounces, dragon-style breathe, turtle shell...), sit and cheer when their kid rides, nap
  when the owner is still, greet her once every 30 s, play with another pet, and startle (a turtle hides) when
  someone runs or she sprints past. Pure engine `web/world/routines.js` + tables `lifedata.js`, view `life.js`;
  cosmetic only (no coins, points or saved data); far characters (40+) stand still and at most 12 act at once.
  Spec and plan: `docs/superpowers/specs/2026-10-09-living-world-design.md`,
  `docs/superpowers/plans/2026-10-09-living-world.md`. Tablet smoothness check pending.
```

Add one line to "Still pending on the owner's side": `- Living world on the tablet: smoothness with everyone moving, pets keeping up when a kid runs, and whether the pets' sizes next to the characters look right.`

In `README.md`, find the 3D world section (grep for `matemind` or "playmates") and add one sentence there: `Characters walk small routines and some of them have unique pets (web/world/routines.js, lifedata.js, life.js).`

- [ ] **Step 4: Final commit command for the owner (docs)**

```bash
git add docs/HANDOFF.md README.md && git commit -m 'Document the living world' -- docs/HANDOFF.md README.md
```

- [ ] **Step 5: Before any push**

Run: `git log origin/main..HEAD --grep='Co-Authored-By\|Claude-Session'` and confirm it prints nothing.

---

## Self-review

**Spec coverage**
- Routines per character, leash, talk freeze and resume, camera lane, distance gate, cap: Task 2 (engine) and its tests.
- Hoot flights, Bunny hops, Mimi patrol and waves, shop owner and buddy routines, wave when she passes: Tasks 1 and 2 (tables, `wave` reaction) and Task 5 (poses).
- Pets for about 5 playmates, Hoot, Bunny, Mimi and 2-3 buddies, all different: Task 1 (`KID_PETS`, `CHAR_PETS`, `BUDDY_PETS`, uniqueness test).
- Species behaviors for all 16 species: Task 1 `SPECIES`, Task 4 moods (test enforces every action exists).
- Reactions (looks at her, greets and gets excited when she waves, hops after owner starts a ride, plays with another pet, flees when a runner passes, sleeps when owner is still): Task 3. "Flees when a tag chaser passes" is covered by the generic runner rule (any kid faster than 5 units/s, including tag chasers, or her sprint). The spec's "waves" trigger is her own emotes/moves via `herMove` in Task 8.
- Pause during pet teacher and gifts: Task 8 passes `busy: talking || overlay`; `talking` is set by `busy(on)`, which every talk, teacher and gift uses.
- Rendering in `cast.js`, `mates3d.js`, `petbody.js`, `folk.js`, `world-main.js`: Tasks 4-8.
- Tests: Node unit tests (Tasks 1-4, 6-8), e2e (Task 9), `world-e2e.js` still run, `update-precache` (Task 8).
- Kids' pets sit beside the kid during a talk: `ctx.talkingTo === owner` is handled in `petTick`; `mates.api.talking()` (Task 6) feeds the playmate being talked to into `talkingId` (Task 8).

**Placeholder scan:** no TBD/TODO; every code step shows code. The two places that say "read the function first" (Mimi in Task 5, `town.js` Mimi talk flag in Task 6) name the exact lines and the exact change to make, because those functions' internals were not fully read when planning.

**Type consistency:** actor ids are `buddy:<app>`, `hoot`, `bunny`, `lana`, `kiko`, `pilo`, `tasyo`, `mimi`, `mate:<id>` (external), `pet:<ownerId>` everywhere (lifedata, folk.chars, mates `owners()`, life.js, tests). Pose fields `{ id, x, y, z, face, action, mag, walkT, prop, hidden, held, pet }` match between `routines.js` `pose()` and `life.js`. `her.talkingTo`, `her.busy`, `her.hold`, `her.owners`, `her.sprint`, `her.waving`, `her.cam` match the engine header, the tests and `life.js`. `setAction(name, lift)` is the same in `cast.js` and `life.js`. `MOODS_ALL` is the same in `petbody.js` and the test.
