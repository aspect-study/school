# Playground Playmates (part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 kids live in the 3D world's playground (6 named friends + 3 new kids each visit): they ride on their own, join her rides, follow her when invited, and talk with her (progress lines, one study or fun question per talk, never the same question twice a day).

**Architecture:** Pure modules (node-tested) do all the thinking: `mates.js` (who), `matelines.js` (what they say + fun bank), `matequiz.js` (`mates_v1` + daily-unique picking), `mateboard.js` (seats and rides on top of `rides.js` maths), `matemind.js` (each kid's plan and steering). One thin 3D module `mates3d.js` builds the kids with `Avatar.character`, poses them, shows emoji pops and runs the talk bubble. `world-main.js` only wires it in; `play.js` gains `now()`; `build.js` gains a second swing part `swing2`.

**Tech Stack:** Plain ES5 classic scripts (`(function (root) {...})(this)` with `module.exports` for node), Three.js r149 (already loaded), `node --test` unit tests, headless Chrome e2e (`tests/e2e/world-e2e.js`).

**Spec:** `docs/superpowers/specs/2026-10-07-playground-playmates-design.md`. Small decisions made while planning (the spec is updated in Task 9):
- `mates_v1` lives in `matequiz.js` (with the code that uses it), not `prefs.js`. It is a plain synced key: `sync-core.js` `kindOf` already returns `'replace'` for it, so no engine change.
- The giggle reuses the existing CC0 clip `emote-giggle.mp3` (new sound key `mate-giggle`), so no new files and `Sfx.FILES` stays 56.
- "Half a beat behind" on the swings = the other swing swings opposite her (angle `-a`): it starts and lands at rest with her, with no jump.
- "Your turn!" and "Tara!" show as a word pop over the kid's head (no bubble mid-ride).
- Kids are only tappable when no door, ride, buddy or other character is in reach, so ride spots always stay tappable.

**Rules for every task:** never run `git commit` — each task ends by staging and showing the user the commit command (the user commits; never add `Co-Authored-By`). Comment sparingly, like the surrounding code. Run the unit tests with `node --test tests/` from the repo root.

---

## File map

| File | New/changed | Responsibility |
|---|---|---|
| `web/world/rides.js` | changed | export `seat`, add `partner`, `runPart`, `runDone` |
| `web/world/build.js` | changed | keep the left swing as part `swing2` |
| `web/world/play.js` | changed | `now()` → `{ id, t, stopAt }` of her ride |
| `web/world/mates.js` | new | the 6 friends + 3 new kids |
| `web/world/matelines.js` | new | lines per grade, progress lines, fun bank (60) |
| `web/world/matequiz.js` | new | `mates_v1`, daily-unique pickers, favourites |
| `web/world/mateboard.js` | new | seats, kids' own rides, riding with her |
| `web/world/matemind.js` | new | each kid's plan, steering, join, invite, talk |
| `web/world/mates3d.js` | new | 3D kids, pops, talk bubble, study answers to history |
| `web/world/sfx.js` | changed | `mate-giggle` |
| `web/world/world-main.js` | changed | wiring |
| `web/world/grade-5.html`, `grade-2.html`, `tests/paths.js`, `web/sw.js` | changed | load order + precache |
| `tests/world3d-rides.test.js` | changed | partner seats |
| `tests/world3d-mates.test.js` | new | mates + matelines + matequiz |
| `tests/world3d-mateboard.test.js` | new | board |
| `tests/world3d-matemind.test.js` | new | mind |
| `tests/world3d-mates-wiring.test.js` | new | wiring source checks |
| `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js` | changed | `mates` e2e case |

---

### Task 1: Partner seats in rides.js, `swing2` in build.js, `now()` in play.js

**Files:**
- Modify: `web/world/rides.js` (after `pose`, and the `exported` object)
- Modify: `web/world/build.js:226-240` (playground swings) and `:335-341` (`ride`)
- Modify: `web/world/play.js` (returned object)
- Test: `tests/world3d-rides.test.js`

- [ ] **Step 1: Write the failing tests** — append to `tests/world3d-rides.test.js`:

```js
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
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/world3d-rides.test.js`
Expected: FAIL — `R.seat is not a function` / `R.partner is not a function`.

- [ ] **Step 3: Implement in `web/world/rides.js`** — add after the `pose` function:

```js
  // A friend riding along: the far end of the see-saw, the other swing (at its own angle a), or the merry-go-round
  // spot `slot` (1-3) a quarter turn on from hers.
  function partner(pr, id, a, slot) {
    if (id === 'seesaw') {
      var se = pr.seesaw;
      return { x: se.x - PLANK * Math.cos(a), y: PLANK_Y - PLANK * Math.sin(a) - HIPS + 0.15, z: se.z, face: Math.PI / 2, sit: true, cheer: false };
    }
    if (id === 'swings') {
      var sw = pr.swings;
      return { x: sw.x - SEAT, y: BAR - ROPE * Math.cos(a) - HIPS + 0.1, z: sw.z - ROPE * Math.sin(a), face: 0, sit: true, cheer: false };
    }
    if (id === 'merry') return seat(pr, 'merry', a + (slot || 1) * Math.PI / 2);
    return null;
  }
```

and after `loopCues` (it needs `loops`, `loopPart`, `loopDone`):

```js
  // A ride run { t, stopAt } by anyone: the moving part's angle t seconds in, and whether it has landed.
  function runPart(id, t, stopAt) { return loops(id) ? loopPart(id, t, stopAt) : part(id, Math.min(1, t / RIDES[id].time)); }
  function runDone(id, t, stopAt) { return loops(id) ? loopDone(id, t, stopAt) : t >= RIDES[id].time; }
```

and extend `exported`:

```js
  var exported = {
    RIDES: RIDES, RAMP: RAMP, CUES: CUES, LOOPS: LOOPS, part: part, pose: pose, cues: cues, seat: seat, partner: partner,
    loops: loops, endAt: endAt, loopDone: loopDone, loopPart: loopPart, loopPose: loopPose, loopCues: loopCues,
    runPart: runPart, runDone: runDone
  };
```

- [ ] **Step 4: `web/world/build.js`** — in `playground(p)` replace

```js
      swing(sw.x - 1.2, sw.z);
      var pivot = swing(sw.x + 1.2, sw.z);
```
with
```js
      var left = swing(sw.x - 1.2, sw.z);
      var pivot = swing(sw.x + 1.2, sw.z);
```
and `rideParts = { pivot: pivot, plank: plank, merry: merry };` with `rideParts = { pivot: pivot, left: left, plank: plank, merry: merry };`.
In `ride(id, a)` add the second swing (a friend's swing; `Rides.part('swing2', null)` is 0):

```js
      if (id === 'swings') rideParts.pivot.rotation.x = a;
      else if (id === 'swing2') rideParts.left.rotation.x = a;
      else if (id === 'seesaw') rideParts.plank.rotation.z = a;
```

- [ ] **Step 5: `web/world/play.js`** — add to the returned object:

```js
      // Her ride as a run for the playground kids (mateboard.js): { id, t, stopAt }, or null.
      now: function () { return ride ? { id: ride.id, t: ride.t, stopAt: ride.loop ? ride.stopAt : null } : null; },
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/world3d-rides.test.js`
Expected: PASS (all old and new tests).

- [ ] **Step 7: Stage and hand over**

```bash
git add web/world/rides.js web/world/build.js web/world/play.js tests/world3d-rides.test.js && git commit -m 'Playmates 1/9: partner seats on the rides (far see-saw end, the other swing, merry-go-round spots), runPart/runDone for anyone riding, the left swing turns as swing2, play.now() gives her ride as a run' -- web/world/rides.js web/world/build.js web/world/play.js tests/world3d-rides.test.js
```

---

### Task 2: `mates.js` — the 6 friends and the 3 new kids

**Files:**
- Create: `web/world/mates.js`
- Test: `tests/world3d-mates.test.js` (new; later tasks add to it)

- [ ] **Step 1: Write the failing test** — create `tests/world3d-mates.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const M = require(worldFile('mates.js'));
const Look = require(worldFile('look.js'));

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('six friends, each with a name, a valid look, a favourite ride and the kind of question they ask', () => {
  assert.deepEqual(M.FRIENDS.map((f) => f.id), ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna']);
  assert.deepEqual(M.FRIENDS.map((f) => f.name), ['Migo', 'Ella', 'Tomas', 'Bea', 'Jun', 'Luna']);
  assert.deepEqual(M.FRIENDS.filter((f) => f.asks === 'study').map((f) => f.id), ['ella', 'bea', 'jun']);
  for (const f of M.FRIENDS) {
    assert.ok(M.RIDES.includes(f.fav), f.id);
    assert.deepEqual(f.look, Look.clean(f.look), f.id + ' look is already clean');
    assert.ok(f.face, f.id);
  }
  assert.equal(new Set(M.FRIENDS.map((f) => M.lookKey(f.look))).size, 6, 'no two friends look the same');
});

test('three new kids each visit, unnamed, fun questions only, never looking like a friend or each other', () => {
  const friends = M.FRIENDS.map((f) => M.lookKey(f.look));
  for (const rand of [() => 0, () => 0.999, seeded(1), seeded(2), seeded(3)]) {
    const kids = M.newKids(rand);
    assert.equal(kids.length, 3);
    const keys = kids.map((k) => M.lookKey(k.look));
    assert.equal(new Set(keys).size, 3);
    for (const k of kids) {
      assert.equal(k.name, '');
      assert.equal(k.asks, 'fun');
      assert.equal(k.isNew, true);
      assert.ok(!friends.includes(M.lookKey(k.look)));
      assert.deepEqual(k.look, Look.clean(k.look));
    }
  }
  assert.deepEqual(M.all(seeded(9)).map((k) => k.id), ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna', 'new1', 'new2', 'new3']);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-mates.test.js`
Expected: FAIL — `Cannot find module .../mates.js`.

- [ ] **Step 3: Create `web/world/mates.js`**

```js
/* The playground's kids (playmates part 1): six friends who are always there, each with a look made from the
   character maker's parts, a favourite ride and the kind of question they ask, and three new kids each time the world
   opens, whose looks never match a friend's. Pure. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Look = node ? require('./look.js') : root.World3D.Look;

  var RIDES = ['slide', 'swings', 'seesaw', 'merry'];
  var NEW_COUNT = 3;

  function look(o) { return Look.clean(Object.assign({ v: 1 }, o)); }

  var FRIENDS = [
    { id: 'migo', name: 'Migo', face: '😄', fav: 'merry', asks: 'fun',
      look: look({ body: 'boy', skin: 2, hair: 'curly', hairColor: 1, outfit: 1, eyes: 'smiley' }) },
    { id: 'ella', name: 'Ella', face: '🌷', fav: 'swings', asks: 'study',
      look: look({ body: 'girl', skin: 1, hair: 'braids', hairColor: 0, outfit: 7, eyes: 'sparkly' }) },
    { id: 'tomas', name: 'Tomas', face: '⚡', fav: 'slide', asks: 'fun',
      look: look({ body: 'boy', skin: 3, hair: 'short', hairColor: 1, outfit: 5, eyes: 'round', freckles: true }) },
    { id: 'bea', name: 'Bea', face: '📋', fav: 'seesaw', asks: 'study',
      look: look({ body: 'girl', skin: 0, hair: 'ponytail', hairColor: 2, outfit: 4, eyes: 'smiley' }) },
    { id: 'jun', name: 'Jun', face: '🔭', fav: 'swings', asks: 'study',
      look: look({ body: 'boy', skin: 6, hair: 'short', hairColor: 0, outfit: 2, eyes: 'round', blush: false }) },
    { id: 'luna', name: 'Luna', face: '🐾', fav: 'merry', asks: 'fun',
      look: look({ body: 'girl', skin: 4, hair: 'curly', hairColor: 1, outfit: 3, eyes: 'sleepy' }) }
  ];

  function lookKey(l) { return [l.body, l.skin, l.hair, l.hairColor, l.outfit, l.eyes].join('|'); }

  function index(n, rand) { return Math.min(n - 1, Math.floor(rand() * n)); }
  function pickOne(list, rand) { return list[index(list.length, rand)]; }

  // A look that clashes with one already taken gets the next outfit colour until it is unique.
  function newKids(rand) {
    var O = Look.OPTIONS, taken = FRIENDS.map(function (f) { return lookKey(f.look); }), out = [];
    while (out.length < NEW_COUNT) {
      var l = look({
        body: pickOne(O.body, rand), skin: index(O.skin.length, rand), hair: pickOne(O.hair, rand),
        hairColor: index(O.hairColor.length, rand), outfit: index(O.outfit.length, rand), eyes: pickOne(O.eyes, rand)
      });
      for (var i = 0; taken.indexOf(lookKey(l)) >= 0 && i < O.outfit.length; i++) l.outfit = (l.outfit + 1) % O.outfit.length;
      for (i = 0; taken.indexOf(lookKey(l)) >= 0 && i < O.skin.length; i++) l.skin = (l.skin + 1) % O.skin.length;
      taken.push(lookKey(l));
      out.push({ id: 'new' + (out.length + 1), name: '', face: '🙂', fav: pickOne(RIDES, rand), asks: 'fun', look: l, isNew: true });
    }
    return out;
  }

  function all(rand) { return FRIENDS.concat(newKids(rand)); }

  var exported = { RIDES: RIDES, FRIENDS: FRIENDS, lookKey: lookKey, newKids: newKids, all: all };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Mates = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-mates.test.js`
Expected: PASS.

- [ ] **Step 5: Stage and hand over**

```bash
git add web/world/mates.js tests/world3d-mates.test.js && git commit -m 'Playmates 2/9: mates.js, the six playground friends (Migo, Ella, Tomas, Bea, Jun, Luna) with looks, favourite rides and question kinds, and three new kids each visit whose looks never match a friend' -- web/world/mates.js tests/world3d-mates.test.js
```

---

### Task 3: `matequiz.js` — `mates_v1`, daily-unique questions, favourites

**Files:**
- Create: `web/world/matequiz.js`
- Test: `tests/world3d-mates.test.js` (append)

- [ ] **Step 1: Write the failing tests** — append to `tests/world3d-mates.test.js`:

```js
const Q = require(worldFile('matequiz.js'));
const { engineFile } = require('./paths.js');
const { kindOf } = require(engineFile('sync-core.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

test('mates_v1 is a synced replace key; junk reads as empty', () => {
  assert.equal(Q.KEY, 'mates_v1');
  assert.equal(kindOf('mates_v1'), 'replace');
  for (const raw of [null, '7', '[1]', '{bad', '{"asked":"x","fun":[1]}']) {
    assert.deepEqual(Q.read(memory(raw === null ? {} : { mates_v1: raw }), 'D1'), { v: 1, day: 'D1', asked: [], fun: {}, t: 0 });
  }
});

test('asked questions are kept for the day; a new day clears them and keeps her fun answers', () => {
  const s = memory();
  Q.markAsked(s, 'D1', 'fun:pet', 5);
  Q.markAsked(s, 'D1', 'fun:pet', 6);
  Q.saveFun(s, 'D1', 'pet', 1, 7);
  assert.deepEqual(Q.read(s, 'D1'), { v: 1, day: 'D1', asked: ['fun:pet'], fun: { pet: 1 }, t: 7 });
  assert.deepEqual(Q.read(s, 'D2'), { v: 1, day: 'D2', asked: [], fun: { pet: 1 }, t: 7 });
});

test('pickers skip what was asked today and give null when nothing is left', () => {
  const bank = [{ id: 'a', choices: ['x', 'y'] }, { id: 'b', choices: ['x', 'y'] }];
  assert.equal(Q.pickFun(bank, ['fun:a'], () => 0).id, 'b');
  assert.equal(Q.pickFun(bank, ['fun:a', 'fun:b'], () => 0), null);
  const cands = [{ app: 'life-lab', item: { q: 'One?' } }, { app: 'life-lab', item: { q: 'Two?' } }];
  assert.equal(Q.pickStudy(cands, [Q.studyKey('life-lab', 'One?')], () => 0).item.q, 'Two?');
  assert.equal(Q.pickStudy(cands, cands.map((c) => Q.studyKey(c.app, c.item.q)), () => 0), null);
  assert.equal(Q.studyKey('x', 'y'.repeat(500)).length, 'study:x:'.length + 120);
});

test('a friend remembers her answer, and each kid has a steady favourite choice', () => {
  const bank = [{ id: 'pet', choices: ['cat', 'dog'] }, { id: 'fruit', choices: ['a', 'b', 'c'] }];
  assert.equal(Q.remembered(bank, {}, () => 0), null);
  assert.deepEqual(Q.remembered(bank, { fruit: 2, gone: 0 }, () => 0), { q: bank[1], choice: 2 });
  assert.equal(Q.remembered(bank, { pet: 5 }, () => 0), null, 'a choice the question no longer has is ignored');
  const favs = new Set();
  for (const kid of ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna']) {
    const f = Q.favourite(kid, bank[1]);
    assert.equal(f, Q.favourite(kid, bank[1]));
    assert.ok(f >= 0 && f < 3);
    favs.add(f);
  }
  assert.ok(favs.size > 1, 'kids like different things');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/world3d-mates.test.js`
Expected: FAIL — `Cannot find module .../matequiz.js`.

- [ ] **Step 3: Create `web/world/matequiz.js`**

```js
/* What the playground kids ask (playmates part 1): today's questions, never the same one twice in a day, and her
   answers to the fun questions, which the friends remember. Saved as mates_v1 { v, day, asked, fun, t }, a synced
   replace key like world3d_v1; a new day clears asked and keeps fun. Pure. */
(function (root) {
  'use strict';
  var KEY = 'mates_v1', MAX_ASKED = 400, Q_MAX = 120;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function index(n, rand) { return Math.min(n - 1, Math.floor(rand() * n)); }

  function read(storage, today) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    if (!isObj(d)) d = {};
    var fun = {};
    if (isObj(d.fun)) Object.keys(d.fun).forEach(function (id) { if (Number.isInteger(d.fun[id]) && d.fun[id] >= 0) fun[id] = d.fun[id]; });
    var asked = d.day === today && Array.isArray(d.asked) ? d.asked.filter(function (k) { return typeof k === 'string'; }) : [];
    return { v: 1, day: today, asked: asked, fun: fun, t: typeof d.t === 'number' ? d.t : 0 };
  }

  function write(storage, d, now) {
    d.t = now;
    try { storage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }

  function funKey(id) { return 'fun:' + id; }
  function studyKey(app, q) { return 'study:' + app + ':' + String(q).slice(0, Q_MAX); }

  function markAsked(storage, today, key, now) {
    var d = read(storage, today);
    if (d.asked.indexOf(key) < 0) d.asked.push(key);
    if (d.asked.length > MAX_ASKED) d.asked = d.asked.slice(-MAX_ASKED);
    return write(storage, d, now);
  }

  function saveFun(storage, today, id, choice, now) {
    var d = read(storage, today);
    d.fun[id] = choice;
    return write(storage, d, now);
  }

  // bank: [{ id, choices }]; null when every fun question was asked today.
  function pickFun(bank, asked, rand) {
    var left = bank.filter(function (q) { return asked.indexOf(funKey(q.id)) < 0; });
    return left.length ? left[index(left.length, rand)] : null;
  }

  // cands: [{ app, item }] from a game's lessons; null when every one was asked today.
  function pickStudy(cands, asked, rand) {
    var left = cands.filter(function (c) { return asked.indexOf(studyKey(c.app, c.item.q)) < 0; });
    return left.length ? left[index(left.length, rand)] : null;
  }

  // One of her saved fun answers: { q, choice }, or null.
  function remembered(bank, fun, rand) {
    var have = bank.filter(function (q) { return has(fun, q.id) && fun[q.id] < q.choices.length; });
    if (!have.length) return null;
    var q = have[index(have.length, rand)];
    return { q: q, choice: fun[q.id] };
  }

  // The choice a kid likes best: the same every time, different from kid to kid.
  function favourite(kidId, q) {
    var s = kidId + '|' + q.id, h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % q.choices.length;
  }

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = index(i + 1, rand), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  var exported = {
    KEY: KEY, read: read, markAsked: markAsked, saveFun: saveFun, funKey: funKey, studyKey: studyKey,
    pickFun: pickFun, pickStudy: pickStudy, remembered: remembered, favourite: favourite, shuffle: shuffle
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateQuiz = exported;
})(this);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-mates.test.js`
Expected: PASS.

- [ ] **Step 5: Stage and hand over**

```bash
git add web/world/matequiz.js tests/world3d-mates.test.js && git commit -m 'Playmates 3/9: matequiz.js keeps mates_v1 (questions asked today, her fun answers), picks study and fun questions never asked today, remembers her answers and gives each kid a steady favourite' -- web/world/matequiz.js tests/world3d-mates.test.js
```

---

### Task 4: `matelines.js` — what the kids say, progress lines, 60 fun questions

**Files:**
- Create: `web/world/matelines.js`
- Test: `tests/world3d-mates.test.js` (append)

- [ ] **Step 1: Write the failing tests** — append:

```js
const ML = require(worldFile('matelines.js'));

test('60 fun questions with unique ids, 2-4 unique choices, English and Filipino', () => {
  assert.equal(ML.FUN.length, 60);
  assert.equal(new Set(ML.FUN.map((q) => q.id)).size, 60);
  for (const q of ML.FUN) {
    assert.ok(q.en && q.fil, q.id);
    assert.ok(q.choices.length >= 2 && q.choices.length <= 4, q.id);
    assert.equal(new Set(q.choices).size, q.choices.length, q.id);
    assert.ok(!q.choices.some((c) => c.includes(' · ')), q.id + ': buttons are English only');
  }
  const g5 = ML.fun('grade5'), g2 = ML.fun('grade2');
  assert.equal(g5[0].text, ML.FUN[0].en);
  assert.equal(g5[0].sub, ML.FUN[0].en);
  assert.equal(g2[0].text, ML.FUN[0].fil + ' · ' + ML.FUN[0].en);
  assert.equal(g2[0].sub, ML.FUN[0].fil + '\n' + ML.FUN[0].en);
});

test('every kid line exists in both grades; Grade 2 lines are Filipino · English pairs, Grade 5 lines are not', () => {
  const facts = { gold: 'Science', golds: 3, streak: 4, bossLeft: 2, bossBeaten: false };
  for (const grade of ['grade5', 'grade2']) {
    const T = ML.TEXT[grade], q = ML.fun(grade)[0];
    const said = [].concat(...Object.values(T.hello), T.newHello, T.right, ML.progress(grade, facts),
      ML.progress(grade, { gold: null, golds: 0, streak: 0, bossLeft: 0, bossBeaten: true }),
      T.remember(q, q.choices[0]), T.answerIs('7'), T.same, T.other('🐶 Dogs'), T.thinking, T.pickRide, T.newFriend);
    for (const f of ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna']) assert.ok(T.hello[f].length >= 3, grade + ' ' + f);
    for (const s of said) {
      assert.equal(typeof s, 'string');
      assert.equal(s.includes(' · '), grade === 'grade2', grade + ': ' + s);
    }
    for (const b of [T.play, T.tara, T.yourTurn]) assert.ok(!b.includes(' · '), 'buttons and pops are English only: ' + b);
  }
});

test('progress lines come from what she really did', () => {
  assert.deepEqual(ML.progress('grade5', { gold: null, golds: 0, streak: 1, bossLeft: 0, bossBeaten: false }), []);
  const all = ML.progress('grade5', { gold: 'Math', golds: 3, streak: 5, bossLeft: 0, bossBeaten: true });
  assert.ok(all.some((l) => l.includes('Math')));
  assert.ok(all.some((l) => l.includes('3 gold')));
  assert.ok(all.some((l) => l.includes('5-day')));
  assert.ok(all.some((l) => l.includes('boss')));
  const facts = ML.facts({ apps: { a: { tally: { gold: 1 } }, b: { tally: { gold: 2 } } }, fort: { cleared: 1, total: 4, beaten: false } },
    { a: 'Science', b: 'Math' }, 6);
  assert.deepEqual(facts, { gold: 'Math', golds: 3, streak: 6, bossLeft: 3, bossBeaten: false });
  assert.deepEqual(ML.facts(null, {}, 0), { gold: null, golds: 0, streak: 0, bossLeft: 0, bossBeaten: false });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/world3d-mates.test.js`
Expected: FAIL — `Cannot find module .../matelines.js`.

- [ ] **Step 3: Create `web/world/matelines.js`**

Filipino wording follows `filipino-wording-rules` (no "bagay" for fits, "Ang" before a quoted subject, the Filipino half says the full meaning).

```js
/* What the playground kids say (playmates part 1): hellos in each friend's own way, lines about her real progress,
   the reactions to her answers, and 60 fun "getting to know you" questions. Grade 2 lines are "Filipino · English"
   (the bubble's pair mode); buttons and the word pops over a kid's head are English only. Pure. */
(function (root) {
  'use strict';

  // { id, en, fil, choices (English, they are buttons) }
  var FUN = [
    { id: 'pet', en: 'Cats or dogs?', fil: 'Pusa o aso?', choices: ['🐱 Cats', '🐶 Dogs'] },
    { id: 'fruit', en: 'What is your favourite fruit?', fil: 'Ano ang paborito mong prutas?', choices: ['🥭 Mango', '🍌 Banana', '🍉 Watermelon', '🍓 Strawberry'] },
    { id: 'color', en: 'What is your favourite colour?', fil: 'Ano ang paborito mong kulay?', choices: ['💗 Pink', '💙 Blue', '💚 Green', '💜 Purple'] },
    { id: 'fly', en: 'If you could fly, where would you go?', fil: 'Kung kaya mong lumipad, saan ka pupunta?', choices: ['🌙 The moon', '🏝️ A beach', '⛰️ The mountains', '🏫 School'] },
    { id: 'weather', en: 'Sunny days or rainy days?', fil: 'Maaraw o maulan na araw?', choices: ['☀️ Sunny', '🌧️ Rainy'] },
    { id: 'merienda', en: 'What is the best merienda?', fil: 'Ano ang pinakamasarap na merienda?', choices: ['🍌 Turon', '🍡 Banana cue', '🥟 Siomai', '🍞 Pandesal'] },
    { id: 'animal', en: 'Which animal would you like to be?', fil: 'Anong hayop ang gusto mong maging?', choices: ['🦁 Lion', '🐬 Dolphin', '🦋 Butterfly', '🐼 Panda'] },
    { id: 'power', en: 'Pick a superpower!', fil: 'Pumili ka ng superpower!', choices: ['💪 Super strength', '👻 Invisible', '⚡ Super speed', '🧠 Read minds'] },
    { id: 'breakfast', en: 'Rice or bread for breakfast?', fil: 'Kanin o tinapay sa almusal?', choices: ['🍚 Rice', '🍞 Bread'] },
    { id: 'ride', en: 'What is your favourite ride here?', fil: 'Ano ang paborito mong sakyan dito?', choices: ['🛝 Slide', '🌈 Swings', '⚖️ See-saw', '🎠 Merry-go-round'] },
    { id: 'subject', en: 'What is your favourite subject?', fil: 'Ano ang paborito mong asignatura?', choices: ['➕ Math', '🔬 Science', '📖 English', '🎨 Arts'] },
    { id: 'swim', en: 'Beach or swimming pool?', fil: 'Dagat o swimming pool?', choices: ['🏖️ Beach', '🏊 Pool'] },
    { id: 'dessert', en: 'What is the best dessert?', fil: 'Ano ang pinakamasarap na panghimagas?', choices: ['🍧 Halo-halo', '🍦 Ice cream', '🍰 Cake', '🍮 Leche flan'] },
    { id: 'time', en: 'Morning or night?', fil: 'Umaga o gabi?', choices: ['🌅 Morning', '🌃 Night'] },
    { id: 'art', en: 'Drawing or painting?', fil: 'Pagguhit o pagpinta?', choices: ['✏️ Drawing', '🖌️ Painting'] },
    { id: 'dino', en: 'Which dinosaur is the coolest?', fil: 'Aling dinosaur ang pinakaastig?', choices: ['🦖 T-rex', '🦕 Long neck', '🦅 Flying one'] },
    { id: 'holiday', en: 'What is the happiest day of the year?', fil: 'Ano ang pinakamasayang araw ng taon?', choices: ['🎄 Christmas', '🎂 My birthday', '🎆 New Year'] },
    { id: 'space', en: 'Would you go to space?', fil: 'Gusto mo bang pumunta sa kalawakan?', choices: ['🚀 Yes!', '🌍 No, I like Earth'] },
    { id: 'sky', en: 'Rainbow or stars?', fil: 'Bahaghari o mga bituin?', choices: ['🌈 Rainbow', '⭐ Stars'] },
    { id: 'sport', en: 'What is your favourite sport?', fil: 'Ano ang paborito mong isport?', choices: ['🏀 Basketball', '🏐 Volleyball', '🏸 Badminton', '🏊 Swimming'] },
    { id: 'noodles', en: 'Pancit or spaghetti?', fil: 'Pansit o spaghetti?', choices: ['🍜 Pancit', '🍝 Spaghetti'] },
    { id: 'books', en: 'Stories or comics?', fil: 'Kuwento o komiks?', choices: ['📚 Stories', '💥 Comics'] },
    { id: 'smallpet', en: 'A fish or a bird for a pet?', fil: 'Isda o ibon bilang alaga?', choices: ['🐠 Fish', '🐦 Bird'] },
    { id: 'ulam', en: 'Chicken or fish for lunch?', fil: 'Manok o isda sa tanghalian?', choices: ['🍗 Chicken', '🐟 Fish'] },
    { id: 'drink', en: 'Hot chocolate or cold juice?', fil: 'Mainit na tsokolate o malamig na juice?', choices: ['☕ Hot chocolate', '🧃 Cold juice'] },
    { id: 'game', en: 'Tag or hide-and-seek?', fil: 'Habulan o taguan?', choices: ['🏃 Tag', '🙈 Hide-and-seek'] },
    { id: 'music', en: 'Which instrument would you play?', fil: 'Anong instrumento ang gusto mong tugtugin?', choices: ['🎸 Guitar', '🥁 Drums', '🎹 Piano', '🎺 Trumpet'] },
    { id: 'shape', en: 'What is your favourite shape?', fil: 'Ano ang paborito mong hugis?', choices: ['⭐ Star', '❤️ Heart', '⚪ Circle', '🔺 Triangle'] },
    { id: 'flower', en: 'What is your favourite flower?', fil: 'Ano ang paborito mong bulaklak?', choices: ['🌻 Sunflower', '🌹 Rose', '🌸 Sampaguita', '🌷 Tulip'] },
    { id: 'job', en: 'What do you want to be when you grow up?', fil: 'Ano ang gusto mong maging paglaki mo?', choices: ['🩺 Doctor', '📚 Teacher', '🚀 Astronaut', '🎨 Artist'] },
    { id: 'wake', en: 'Early bird or sleepyhead?', fil: 'Maagang gumising o antukin?', choices: ['🐓 Early bird', '😴 Sleepyhead'] },
    { id: 'sunmoon', en: 'The sun or the moon?', fil: 'Ang araw o ang buwan?', choices: ['☀️ Sun', '🌙 Moon'] },
    { id: 'build', en: 'Puzzles or building blocks?', fil: 'Puzzle o building blocks?', choices: ['🧩 Puzzles', '🧱 Blocks'] },
    { id: 'trip', en: 'Ride a jeepney, a boat or a plane?', fil: 'Sasakay ka ng jeep, bangka o eroplano?', choices: ['🚙 Jeepney', '⛵ Boat', '✈️ Plane'] },
    { id: 'sweet', en: 'Chocolate or candy?', fil: 'Tsokolate o kendi?', choices: ['🍫 Chocolate', '🍬 Candy'] },
    { id: 'farm', en: 'Which farm animal do you like best?', fil: 'Aling hayop sa bukid ang pinakagusto mo?', choices: ['🐄 Cow', '🐐 Goat', '🐔 Chicken', '🐃 Carabao'] },
    { id: 'rainplay', en: 'Would you play in the rain?', fil: 'Maglalaro ka ba sa ulan?', choices: ['☔ Yes, fun!', '🏠 No, stay dry'] },
    { id: 'zoo', en: 'Zoo or aquarium?', fil: 'Zoo o aquarium?', choices: ['🦒 Zoo', '🐙 Aquarium'] },
    { id: 'hat', en: 'Pick a hat!', fil: 'Pumili ka ng sombrero!', choices: ['👑 Crown', '🎩 Top hat', '🧢 Cap'] },
    { id: 'party', en: 'Best party game?', fil: 'Ano ang pinakamasayang laro sa party?', choices: ['🎁 Pabitin', '🎉 Piñata', '🪑 Trip to Jerusalem'] },
    { id: 'grow', en: 'Grow flowers or vegetables?', fil: 'Magtanim ng bulaklak o gulay?', choices: ['🌼 Flowers', '🥕 Vegetables'] },
    { id: 'kitchen', en: 'Help cook or help bake?', fil: 'Tumulong magluto o mag-bake?', choices: ['🍳 Cook', '🧁 Bake'] },
    { id: 'robot', en: 'Would you like a robot friend?', fil: 'Gusto mo ba ng robot na kaibigan?', choices: ['🤖 Yes!', '🙂 Maybe'] },
    { id: 'explore', en: 'Climb a mountain or explore a cave?', fil: 'Umakyat sa bundok o pumasok sa kuweba?', choices: ['⛰️ Mountain', '🦇 Cave'] },
    { id: 'bug', en: 'Bee or butterfly?', fil: 'Bubuyog o paru-paro?', choices: ['🐝 Bee', '🦋 Butterfly'] },
    { id: 'lucky', en: 'What is your lucky number?', fil: 'Ano ang masuwerte mong numero?', choices: ['3️⃣ Three', '7️⃣ Seven', '9️⃣ Nine'] },
    { id: 'note', en: 'Write a letter or make a card?', fil: 'Sumulat ng liham o gumawa ng kard?', choices: ['✉️ Letter', '💌 Card'] },
    { id: 'sea', en: 'Which sea animal do you like best?', fil: 'Aling hayop sa dagat ang pinakagusto mo?', choices: ['🐢 Turtle', '🦈 Shark', '🐳 Whale', '🦀 Crab'] },
    { id: 'noise', en: 'A quiet library or a noisy party?', fil: 'Tahimik na library o maingay na party?', choices: ['🤫 Library', '🥳 Party'] },
    { id: 'pizza', en: 'Pizza or burger?', fil: 'Pizza o burger?', choices: ['🍕 Pizza', '🍔 Burger'] },
    { id: 'myth', en: 'Unicorn or dragon?', fil: 'Unicorn o dragon?', choices: ['🦄 Unicorn', '🐉 Dragon'] },
    { id: 'magic', en: 'A magic wand or a flying carpet?', fil: 'Magic wand o lumilipad na karpet?', choices: ['🪄 Wand', '🧞 Carpet'] },
    { id: 'camp', en: 'Camping or a sleepover?', fil: 'Kamping o sleepover?', choices: ['⛺ Camping', '🛏️ Sleepover'] },
    { id: 'corn', en: 'Corn or sweet potato?', fil: 'Mais o kamote?', choices: ['🌽 Corn', '🍠 Sweet potato'] },
    { id: 'chore', en: 'How do you like to help at home?', fil: 'Paano mo gustong tumulong sa bahay?', choices: ['🧹 Sweep', '🍽️ Wash dishes', '🧺 Fold clothes', '🌱 Water plants'] },
    { id: 'move', en: 'Dance or sing?', fil: 'Sumayaw o kumanta?', choices: ['💃 Dance', '🎤 Sing'] },
    { id: 'rest', en: 'A long nap or a long play?', fil: 'Mahabang tulog o mahabang laro?', choices: ['😴 Nap', '🤸 Play'] },
    { id: 'rainbow', en: 'Pick a rainbow colour!', fil: 'Pumili ka ng kulay ng bahaghari!', choices: ['❤️ Red', '🧡 Orange', '💛 Yellow', '💙 Blue'] },
    { id: 'friends', en: 'Play with one friend or many friends?', fil: 'Makipaglaro sa isang kaibigan o sa marami?', choices: ['🙂 One friend', '🎉 Many friends'] },
    { id: 'week', en: 'School day or weekend?', fil: 'Araw ng pasok o Sabado at Linggo?', choices: ['🏫 School day', '🎈 Weekend'] }
  ];

  var TEXT = {
    grade5: {
      newFriend: 'New friend',
      title: 'Playground friends',
      hello: {
        migo: ['Hahaha! Hi! Did you see me spin? 😄', 'Knock knock! … I forgot the joke. Hahaha!', 'The merry-go-round makes me dizzy. I love it! 🎠'],
        ella: ['Oh, hi… I like your outfit. 🌷', 'Hello! Want to swing with me later?', 'Hi! I\'m glad you came today. 😊'],
        tomas: ['Race you to the slide! ⚡', 'I\'m the fastest kid here! Well… almost.', 'Ready, set, go! Oh wait, hi! 😆'],
        bea: ['Okay, everyone! Line up for the see-saw! Oh, hi! 📋', 'You can ride with me. I\'ll count to three!', 'Hello! Rule number one: have fun!'],
        jun: ['Did you know? A swing is a kind of pendulum! 🔭', 'Hi! I like facts. Do you?', 'Fun fact: the slide works because of gravity!'],
        luna: ['Hi! Did you bring your pet? 🐾', 'I saw a butterfly here this morning! 🦋', 'Hello! The clouds look like bunnies today. ☁️']
      },
      newHello: ['Hi! I\'m new here. Wanna play? 🙂', 'Hello! This playground is so fun!', 'Hi! Is that your pet? So cute!', 'Hey! I just moved here. Let\'s be friends!'],
      gold: function (subject) { return 'Whoa, a gold medal in ' + subject + '? Galing! 🏅'; },
      golds: function (n) { return n + ' gold medals! You study a lot! 🏅'; },
      streak: function (n) { return 'A ' + n + '-day streak! Keep it going! 🔥'; },
      bossLeft: function (n) { return 'The boss still has ' + n + ' stage' + (n === 1 ? '' : 's') + ' left. You can do it! ⚔️'; },
      bossBeaten: 'You beat the boss this week? So cool! 🏆',
      remember: function (q, choice) { return 'I remember! You said ' + choice + ' for “' + q.en + '” 😊'; },
      thinking: '🤔 Let me think of a question…',
      right: ['🎉 Galing! You got it!', '⭐ Yes! So smart!', '🙌 Right! Teach me sometime!'],
      answerIs: function (a) { return 'Oops! It\'s ' + a + '. Next time! 💪'; },
      same: 'Me too!! 🤩',
      other: function (mine) { return 'Ooh, cool! I like ' + mine + '.'; },
      pickRide: 'Which ride? 🎠',
      play: '🎠 Let\'s play!',
      tara: 'Tara!',
      yourTurn: 'Your turn!'
    },
    grade2: {
      newFriend: 'Bagong kaibigan · New friend',
      title: 'Mga kalaro · Playground friends',
      hello: {
        migo: ['Hahaha! Hi! Nakita mo ba akong umikot? 😄 · Hahaha! Hi! Did you see me spin? 😄',
          'Tok tok! … Nakalimutan ko ang biro. Hahaha! · Knock knock! … I forgot the joke. Hahaha!',
          'Nahihilo ako sa merry-go-round. Gustong-gusto ko! 🎠 · The merry-go-round makes me dizzy. I love it! 🎠'],
        ella: ['Uy, hi… Ang ganda ng damit mo. 🌷 · Oh, hi… I like your outfit. 🌷',
          'Hello! Gusto mo bang mag-swing tayo mamaya? · Hello! Want to swing with me later?',
          'Hi! Masaya ako na dumating ka. 😊 · Hi! I\'m glad you came today. 😊'],
        tomas: ['Karera tayo papunta sa slide! ⚡ · Race you to the slide! ⚡',
          'Ako ang pinakamabilis dito! Halos… · I\'m the fastest kid here! Well… almost.',
          'Handa, takbo! Ay, hi! 😆 · Ready, set, go! Oh wait, hi! 😆'],
        bea: ['Sige, pila tayo sa see-saw! Uy, hi! 📋 · Okay, everyone! Line up for the see-saw! Oh, hi! 📋',
          'Sumakay ka kasama ko. Bibilang ako hanggang tatlo! · You can ride with me. I\'ll count to three!',
          'Hello! Unang tuntunin: magsaya! · Hello! Rule number one: have fun!'],
        jun: ['Alam mo ba? Ang swing ay isang uri ng pendulum! 🔭 · Did you know? A swing is a kind of pendulum! 🔭',
          'Hi! Mahilig ako sa mga fact. Ikaw ba? · Hi! I like facts. Do you?',
          'Fun fact: dumudulas tayo sa slide dahil sa gravity! · Fun fact: the slide works because of gravity!'],
        luna: ['Hi! Kasama mo ba ang alaga mo? 🐾 · Hi! Did you bring your pet? 🐾',
          'May nakita akong paru-paro dito kaninang umaga! 🦋 · I saw a butterfly here this morning! 🦋',
          'Hello! Mukhang kuneho ang mga ulap ngayon. ☁️ · Hello! The clouds look like bunnies today. ☁️']
      },
      newHello: ['Hi! Bago ako dito. Laro tayo? 🙂 · Hi! I\'m new here. Wanna play? 🙂',
        'Hello! Ang saya dito sa palaruan! · Hello! This playground is so fun!',
        'Hi! Alaga mo ba iyan? Ang cute! · Hi! Is that your pet? So cute!',
        'Uy! Kalilipat ko lang dito. Magkaibigan tayo! · Hey! I just moved here. Let\'s be friends!'],
      gold: function (subject) { return 'Wow, gold medal sa ' + subject + '? Galing! 🏅 · Whoa, a gold medal in ' + subject + '? Great job! 🏅'; },
      golds: function (n) { return n + ' gold medal! Masipag kang mag-aral! 🏅 · ' + n + ' gold medals! You study a lot! 🏅'; },
      streak: function (n) { return n + ' araw na sunod-sunod! Ituloy mo! 🔥 · A ' + n + '-day streak! Keep it going! 🔥'; },
      bossLeft: function (n) { return 'May ' + n + ' stage pa ang boss. Kaya mo iyan! ⚔️ · The boss still has ' + n + ' stage' + (n === 1 ? '' : 's') + ' left. You can do it! ⚔️'; },
      bossBeaten: 'Natalo mo ang boss ngayong linggo? Astig! 🏆 · You beat the boss this week? So cool! 🏆',
      remember: function (q, choice) { return 'Naaalala ko! ' + choice + ' ang sagot mo sa “' + q.fil + '” 😊 · I remember! You said ' + choice + ' for “' + q.en + '” 😊'; },
      thinking: '🤔 Mag-iisip ako ng tanong… · 🤔 Let me think of a question…',
      right: ['🎉 Galing! Tama ka! · 🎉 Great job! You got it!', '⭐ Oo! Ang talino mo! · ⭐ Yes! So smart!', '🙌 Tama! Turuan mo ako minsan! · 🙌 Right! Teach me sometime!'],
      answerIs: function (a) { return 'Ay! Ang sagot ay ' + a + '. Sa susunod! 💪 · Oops! The answer is ' + a + '. Next time! 💪'; },
      same: 'Ako rin!! 🤩 · Me too!! 🤩',
      other: function (mine) { return 'Wow, astig! Mas gusto ko ang ' + mine + '. · Ooh, cool! I like ' + mine + '.'; },
      pickRide: 'Saan tayo sasakay? 🎠 · Which ride? 🎠',
      play: '🎠 Let\'s play!',
      tara: 'Tara!',
      yourTurn: 'Your turn!'
    }
  };

  // The bank as a grade shows it: text (one line, Grade 2 "Filipino · English") and sub (the bubble's lines).
  function fun(grade) {
    return FUN.map(function (q) {
      var two = grade === 'grade2';
      return { id: q.id, en: q.en, fil: q.fil, choices: q.choices, text: two ? q.fil + ' · ' + q.en : q.en, sub: two ? q.fil + '\n' + q.en : q.en };
    });
  }

  // facts = { gold (a subject name with gold medals, or null), golds, streak, bossLeft, bossBeaten }
  function progress(grade, f) {
    var T = TEXT[grade], out = [];
    if (f.gold) out.push(T.gold(f.gold));
    if (f.golds >= 3) out.push(T.golds(f.golds));
    if (f.streak >= 2) out.push(T.streak(f.streak));
    if (f.bossBeaten) out.push(T.bossBeaten);
    else if (f.bossLeft > 0) out.push(T.bossLeft(f.bossLeft));
    return out;
  }

  // From town.js's snapshot, the subject names by app and her streak.
  function facts(snap, names, streak) {
    var golds = 0, best = null, most = 0, apps = (snap && snap.apps) || {}, fort = (snap && snap.fort) || {};
    Object.keys(apps).forEach(function (app) {
      var g = apps[app] && apps[app].tally ? Number(apps[app].tally.gold) || 0 : 0;
      golds += g;
      if (g > most) { most = g; best = app; }
    });
    var total = Number(fort.total) || 0, cleared = Number(fort.cleared) || 0;
    return {
      gold: best ? names[best] || null : null, golds: golds, streak: Number(streak) || 0,
      bossLeft: Math.max(0, total - cleared), bossBeaten: !!fort.beaten && total > 0
    };
  }

  var exported = { FUN: FUN, TEXT: TEXT, fun: fun, progress: progress, facts: facts };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateLines = exported;
})(this);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-mates.test.js`
Expected: PASS. If the `' · '` check fails on a Grade 5 line, the line has a stray separator; fix the line, not the test.

- [ ] **Step 5: Stage and hand over**

```bash
git add web/world/matelines.js tests/world3d-mates.test.js && git commit -m 'Playmates 4/9: matelines.js, each friend'"'"'s hellos, lines about her real medals, streak and boss, answer reactions and 60 fun getting-to-know-you questions; Grade 2 lines in Filipino and English, buttons English only' -- web/world/matelines.js tests/world3d-mates.test.js
```

---

### Task 5: `mateboard.js` — seats, the kids' own rides, riding with her

**Files:**
- Create: `web/world/mateboard.js`
- Test: `tests/world3d-mateboard.test.js`

Concepts: each ride has seats (`slide` 2: rider and the next one down, `swings` 2: right is hers / left, `seesaw` 2: her end / far end, `merry` 4). A *run* `{ t, stopAt }` moves a part. Parts: `slide0`, `slide1`, `swings` (right swing), `swing2` (left swing), `seesaw`, `merry`. When she rides, play.js moves her part; kids sitting on her ride follow her run (see-saw far end, opposite swing, merry spots, the next one down the slide starts `FOLLOW` s after her).

- [ ] **Step 1: Write the failing tests** — create `tests/world3d-mateboard.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const B = require(worldFile('mateboard.js'));
const R = require(worldFile('rides.js'));
const L = require(worldFile('layout.js'));

const pr = L.props('grade5');
const ends = {};
L.rideSpots('grade5').forEach((s) => { ends[s.id] = s.end; });
const half = () => 0.5;

function run(b, seconds, now) {
  const ev = [];
  for (let i = 0; i < seconds * 10; i++) ev.push(...b.tick(0.1, typeof now === 'function' ? now(i / 10) : now));
  return ev;
}

test('kids take free seats and never a full or moving ride', () => {
  const b = B.create(pr, ends, half);
  assert.equal(b.claim('a', 'seesaw'), 0);
  assert.equal(b.claim('a', 'swings'), -1, 'one seat per kid');
  assert.equal(b.claim('b', 'seesaw'), 1);
  assert.equal(b.claim('c', 'seesaw'), -1, 'full');
  b.tick(0.1, null);
  assert.ok(b.running('seesaw'), 'two kids: the see-saw goes');
  b.leave('b');
  assert.equal(b.claim('c', 'seesaw'), -1, 'no hopping on while it moves');
});

test('two kids on the see-saw ride opposite ends, then land at the ride end', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'seesaw');
  run(b, 0.5, null);
  assert.equal(b.running('seesaw'), false, 'one kid waits for a partner');
  b.claim('b', 'seesaw');
  run(b, 1.3, null);
  const pa = b.pose('a'), pb = b.pose('b'), mid = 0.9 - 1.05 + 0.15;
  assert.ok(Math.abs((pa.y - mid) + (pb.y - mid)) < 1e-9);
  const ev = run(b, 20, null);
  assert.deepEqual(ev.filter((e) => e.type === 'land').map((e) => e.kid).sort(), ['a', 'b']);
  assert.equal(b.seatOf('a'), null);
  assert.equal(b.parts().seesaw, R.part('seesaw', null), 'back at rest');
});

test('she gets her seat: a kid on it moves over, or gets off when the ride is full', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'merry');
  let ev = b.tick(0.1, { id: 'merry', t: 0, stopAt: null });
  assert.equal(ev[0].type, 'start');
  assert.deepEqual(ev[0].bumped, []);
  assert.deepEqual(b.seatOf('a'), { id: 'merry', i: 1 }, 'moved to the next spot');
  const c = B.create(pr, ends, half);
  c.claim('a', 'swings');
  c.claim('b', 'swings');
  ev = c.tick(0.1, { id: 'swings', t: 0, stopAt: null });
  assert.deepEqual(ev[0].bumped.map((x) => x.kid), ['a']);
  assert.equal(c.seatOf('a'), null);
  assert.deepEqual(c.seatOf('b'), { id: 'swings', i: 1 });
});

test('a friend on her ride moves with it and lands with her', () => {
  const b = B.create(pr, ends, half);
  b.tick(0.1, { id: 'seesaw', t: 0, stopAt: null });
  assert.equal(b.claim('a', 'seesaw'), 1, 'her seat is never given to a kid');
  b.tick(0.1, { id: 'seesaw', t: 3.3, stopAt: null });
  const a = R.runPart('seesaw', 3.3, null);
  assert.deepEqual(b.pose('a'), R.partner(pr, 'seesaw', a));
  assert.equal('seesaw' in b.parts(), false, 'play.js turns her own ride');
  const ev = b.tick(0.1, null);
  assert.deepEqual(ev.filter((e) => e.type === 'land').map((e) => e.kid), ['a']);
});

test('the other swing swings opposite her', () => {
  const b = B.create(pr, ends, half);
  b.tick(0.1, { id: 'swings', t: 0, stopAt: null });
  b.claim('a', 'swings');
  b.tick(0.1, { id: 'swings', t: 2.6, stopAt: null });
  const a = R.runPart('swings', 2.6, null);
  assert.equal(b.parts().swing2, -a);
  assert.deepEqual(b.pose('a'), R.partner(pr, 'swings', -a));
});

test('the next kid down the slide follows her a second later and lands after her', () => {
  const b = B.create(pr, ends, half);
  b.tick(0.1, { id: 'slide', t: 0, stopAt: null });
  b.claim('a', 'slide');
  b.tick(0.1, { id: 'slide', t: 0.5, stopAt: null });
  assert.equal(b.running('slide1'), false);
  b.tick(0.1, { id: 'slide', t: 1.1, stopAt: null });
  assert.equal(b.running('slide1'), true);
  let ev = b.tick(0.1, null);
  assert.deepEqual(ev.filter((e) => e.type === 'land'), [], 'still sliding when she lands');
  ev = run(b, 3, null);
  const land = ev.filter((e) => e.type === 'land');
  assert.equal(land.length, 1);
  assert.equal(land[0].end.x, ends.slide.x + 1.4, 'lands beside her spot');
});

test('kids on the merry-go-round wait a moment for friends, then spin a few loops', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'merry');
  run(b, 1, null);
  assert.equal(b.claim('b', 'merry'), 1, 'friends can still hop on');
  run(b, 1, null);
  assert.equal(b.running('merry'), true);
  const pa = b.pose('a'), pb = b.pose('b');
  assert.ok(Math.hypot(pa.x - pb.x, pa.z - pb.z) > 2);
  const ev = run(b, 20, null);
  assert.equal(ev.filter((e) => e.type === 'land').length, 2);
});

test('clear empties every seat and run', () => {
  const b = B.create(pr, ends, half);
  b.claim('a', 'swings');
  b.tick(0.1, null);
  b.clear();
  assert.equal(b.seatOf('a'), null);
  assert.equal(b.running('swings'), false);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/world3d-mateboard.test.js`
Expected: FAIL — `Cannot find module .../mateboard.js`.

- [ ] **Step 3: Create `web/world/mateboard.js`**

```js
/* Who sits where on the playground rides (playmates part 1): seats, the kids' own rides, and friends riding with her.
   Pure maths on rides.js. A ride's moving part is shared, so kids on her ride move with her run and land with her;
   seat 0 of her ride is hers. tick(dt, now) takes play.js now() each frame and returns events:
   { type: 'start', id, bumped: [{ kid, end }] } when she gets on, { type: 'land', kid, end } when a kid gets off. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var R = node ? require('./rides.js') : root.World3D.Rides;

  var SEATS = { slide: 2, swings: 2, seesaw: 2, merry: 4 };
  var FOLLOW = 1, MERRY_WAIT = 1.5;
  var SIDE = [0, 1.4, -1.4, 2.8];

  // pr = Layout.props(grade); ends = { rideId: { x, z, face } }; rand picks how many loops the kids ride (2-4).
  function create(pr, ends, rand) {
    var seats = {}, runs = {}, her = null, wait = {};
    function reset() {
      seats = {};
      runs = {};
      wait = {};
      Object.keys(SEATS).forEach(function (id) {
        seats[id] = [];
        for (var i = 0; i < SEATS[id]; i++) seats[id].push(null);
      });
    }
    reset();

    function partOf(id, i) { return id === 'slide' ? 'slide' + i : id === 'swings' ? (i ? 'swing2' : 'swings') : id; }
    function rideOf(part) { return part.indexOf('slide') === 0 ? 'slide' : part === 'swing2' ? 'swings' : part; }
    function mine(id) { return !!her && her.id === id; }
    function endFor(id, i) { var e = ends[id]; return { x: e.x + SIDE[i], z: e.z, face: e.face }; }
    function newRun(id) { return { t: 0, stopAt: R.loops(id) ? 2 + R.LOOPS[id] * (2 + Math.min(2, Math.floor(rand() * 3))) : null }; }

    function seatOf(kid) {
      for (var id in seats) {
        var i = seats[id].indexOf(kid);
        if (i >= 0) return { id: id, i: i };
      }
      return null;
    }

    // A free seat on ride id, or -1 when it is full or the kids' part there is already moving.
    function claim(kid, id) {
      if (seatOf(kid) || !seats[id]) return -1;
      for (var i = 0; i < seats[id].length; i++) {
        if (seats[id][i] !== null || (mine(id) && i === 0) || runs[partOf(id, i)]) continue;
        seats[id][i] = kid;
        if (id === 'merry' && !mine(id) && wait.merry === undefined) wait.merry = 0;
        return i;
      }
      return -1;
    }

    function leave(kid) {
      var s = seatOf(kid);
      if (!s) return;
      seats[s.id][s.i] = null;
      var part = partOf(s.id, s.i);
      if (runs[part] && !seats[s.id].some(function (k, i) { return k !== null && partOf(s.id, i) === part; })) delete runs[part];
      if (!seats[s.id].some(function (k) { return k !== null; })) delete wait[s.id];
    }

    function land(id, i, ev) {
      ev.push({ type: 'land', kid: seats[id][i], end: endFor(id, i) });
      seats[id][i] = null;
    }

    function herStart(id) {
      var bumped = [];
      her = { id: id, t: 0, stopAt: null };
      seats[id].forEach(function (k, i) { if (k !== null) delete runs[partOf(id, i)]; });
      delete wait[id];
      var k0 = seats[id][0];
      if (k0 !== null) {
        seats[id][0] = null;
        var j = seats[id].indexOf(null, 1);
        if (j > 0) seats[id][j] = k0;
        else bumped.push({ kid: k0, end: endFor(id, 0) });
      }
      return bumped;
    }

    // She landed: her friends get off with her; a kid still sliding down after her finishes first.
    function herLand(ev) {
      var id = her.id;
      her = null;
      seats[id].forEach(function (k, i) { if (k !== null && !runs[partOf(id, i)]) land(id, i, ev); });
    }

    function startReady(dt) {
      Object.keys(seats).forEach(function (id) {
        var s = seats[id];
        if (mine(id)) {
          if (id === 'slide' && s[1] !== null && !runs.slide1 && her.t >= FOLLOW) runs.slide1 = newRun('slide');
          return;
        }
        if (id === 'slide') {
          if (s[0] !== null && !runs.slide0) runs.slide0 = newRun('slide');
          if (s[1] !== null && !runs.slide1 && (s[0] === null || (runs.slide0 && runs.slide0.t >= FOLLOW))) runs.slide1 = newRun('slide');
        } else if (id === 'swings') {
          if (s[0] !== null && !runs.swings) runs.swings = newRun('swings');
          if (s[1] !== null && !runs.swing2) runs.swing2 = newRun('swings');
        } else if (id === 'seesaw') {
          if (s[0] !== null && s[1] !== null && !runs.seesaw) runs.seesaw = newRun('seesaw');
        } else if (wait.merry !== undefined && !runs.merry) {
          wait.merry += dt;
          if (wait.merry >= MERRY_WAIT) {
            runs.merry = newRun('merry');
            delete wait.merry;
          }
        }
      });
    }

    function tick(dt, now) {
      var ev = [];
      if (her && (!now || now.id !== her.id)) herLand(ev);
      if (now && !her) ev.push({ type: 'start', id: now.id, bumped: herStart(now.id) });
      if (now) {
        her.t = now.t;
        her.stopAt = now.stopAt;
      }
      Object.keys(runs).forEach(function (part) {
        var r = runs[part], id = rideOf(part);
        r.t += dt;
        if (!R.runDone(id, r.t, r.stopAt)) return;
        delete runs[part];
        seats[id].forEach(function (k, i) { if (k !== null && partOf(id, i) === part) land(id, i, ev); });
      });
      startReady(dt);
      return ev;
    }

    function angle(id, i) {
      if (mine(id)) {
        var a = R.runPart(id, her.t, her.stopAt);
        return id === 'swings' ? -a : a;
      }
      var r = runs[partOf(id, i)];
      return r ? R.runPart(id, r.t, r.stopAt) : R.part(id, null);
    }

    // Where a seated kid is: { x, y, z, face, sit, cheer }, or null.
    function pose(kid) {
      var s = seatOf(kid);
      if (!s) return null;
      var id = s.id, i = s.i;
      if (id === 'slide') {
        var r = runs[partOf(id, i)];
        return R.pose(pr, 'slide', r ? Math.min(1, r.t / R.RIDES.slide.time) : 0);
      }
      var a = angle(id, i);
      if (id === 'swings') return mine(id) || i === 1 ? R.partner(pr, 'swings', a) : R.seat(pr, 'swings', a);
      if (i === 0) return R.seat(pr, id, a);
      return R.partner(pr, id, a, i);
    }

    // The angles build.js should show for the parts she is not riding.
    function parts() {
      var out = {};
      ['swings', 'swing2', 'seesaw', 'merry'].forEach(function (p) {
        var id = rideOf(p);
        if (mine(id)) {
          if (p === 'swing2') out.swing2 = seats.swings[1] !== null ? angle('swings', 1) : R.part('swings', null);
          return;
        }
        var r = runs[p];
        out[p] = r ? R.runPart(id, r.t, r.stopAt) : R.part(id, null);
      });
      return out;
    }

    // Kids on ride id beside her (seats 1 and up).
    function friends(id) { return seats[id].slice(1).filter(function (k) { return k !== null; }).length; }

    return {
      claim: claim, leave: leave, tick: tick, pose: pose, parts: parts, seatOf: seatOf, friends: friends,
      running: function (part) { return !!runs[part]; },
      herRide: function () { return her ? her.id : null; },
      moving: function (kid) { var s = seatOf(kid); return !!s && (mine(s.id) || !!runs[partOf(s.id, s.i)]); },
      clear: function () { reset(); her = null; },
      SEATS: SEATS
    };
  }

  var exported = { create: create, SEATS: SEATS, FOLLOW: FOLLOW };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateBoard = exported;
})(this);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-mateboard.test.js`
Expected: PASS. If the slide-follow test fails on timing, check `her.t >= FOLLOW` uses the `now.t` set earlier in the same `tick` (it does: `her.t` is set before `startReady`).

- [ ] **Step 5: Stage and hand over**

```bash
git add web/world/mateboard.js tests/world3d-mateboard.test.js && git commit -m 'Playmates 5/9: mateboard.js, who sits where on the rides: kids ride the see-saw in pairs, the swings, the slide one after another and the merry-go-round together; she always gets her seat (a kid on it moves over or gets off), and friends on her ride move with it (far see-saw end, opposite swing, merry spots, one slides down after her) and land with her' -- web/world/mateboard.js tests/world3d-mateboard.test.js
```

---

### Task 6: `matemind.js` — each kid's plan

**Files:**
- Create: `web/world/matemind.js`
- Test: `tests/world3d-matemind.test.js`

States: `idle` (stand; wave when she is close), `walk` (to a ride or a spot), `join` (run to her ride), `wait` (queue: retry the seat), `ride` (seated; the board poses them), `follow` (invited), `talk`, `cheer` (after landing).

- [ ] **Step 1: Write the failing tests** — create `tests/world3d-matemind.test.js`:

```js
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

function make(seed) {
  const grade = 'grade5', obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds, ends = {};
  L.rideSpots(grade).forEach((s) => { ends[s.id] = s.end; });
  return Mind.create({
    pr: L.props(grade), ends, boards: L.rideSpots(grade), area: L.places(grade).playground, rand: seeded(seed),
    kids: M.all(seeded(seed)).map((m) => ({ id: m.id, fav: m.fav, racer: m.id === 'tomas' })),
    blocked: (x, z, r) => L.blocked(obs, bounds, x, z, r)
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
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/world3d-matemind.test.js`
Expected: FAIL — `Cannot find module .../matemind.js`.

- [ ] **Step 3: Create `web/world/matemind.js`**

```js
/* What each playground kid does (playmates part 1): stand and wave, wander, walk or run to a ride, wait their turn,
   ride (mateboard.js says where they sit), come and ride with her, follow her when invited, stop to talk, cheer after
   a ride. Pure: steering asks blocked(x, z, r) and stays inside the playground circle. tick(dt, her) with
   her = { x, z, now (play.js now()) } returns { pops: [{ kid, text }], sounds: [name] }. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Board = node ? require('./mateboard.js') : root.World3D.MateBoard;

  var WALK = 3, RUN = 5.5, NEAR = 0.5, KID_R = 0.7, JOIN_R = 16, GAP = 2.4, INVITE_TIME = 60, CHEER_TIME = 2.5;
  var WAIT_TIME = 8, STUCK_TIME = 2, WAVE_R = 5, POP_EVERY = 2.5, LEAVE_R = 4;
  var JOIN = { slide: 1, swings: 1, seesaw: 1, merry: 3 };
  var RIDES = ['slide', 'swings', 'seesaw', 'merry'];
  var POPS = ['😄', '🎉', '⭐'];
  var TURNS = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8];

  // o = { pr, ends, boards (Layout.rideSpots), area { x, z, r }, kids [{ id, fav, racer }], blocked(x, z, r), rand }
  function create(o) {
    var rand = o.rand, area = o.area, board = Board.create(o.pr, o.ends, rand), spots = {};
    o.boards.forEach(function (b) { spots[b.id] = b; });

    function index(n) { return Math.min(n - 1, Math.floor(rand() * n)); }
    function inside(x, z, margin) { return Math.hypot(x - area.x, z - area.z) <= area.r - margin; }
    function open(x, z) { return inside(x, z, 1) && !o.blocked(x, z, KID_R); }

    // A free spot inside the playground about r from the middle, starting at angle a.
    function spotAt(a, r) {
      for (var i = 0; i < 12; i++) {
        var b = a + i * 0.5, x = area.x + Math.sin(b) * r, z = area.z + Math.cos(b) * r;
        if (open(x, z)) return { x: x, z: z };
      }
      return { x: area.x, z: area.z };
    }

    var kids = o.kids.map(function (k, n) {
      var a = n / o.kids.length * Math.PI * 2, home = spotAt(a, area.r * 0.6);
      return {
        id: k.id, fav: k.fav, racer: !!k.racer, home: home, x: home.x, z: home.z, face: a + Math.PI,
        state: 'idle', timer: 0.5 + rand() * 2, target: null, ride: null, invite: null,
        walkT: 0, mag: 0, stuck: 0, pop: rand() * POP_EVERY, wave: false
      };
    });
    var byId = {};
    kids.forEach(function (k) { byId[k.id] = k; });

    function idle(k, time) {
      k.state = 'idle';
      k.timer = time === undefined ? 1 + rand() * 3 : time;
      k.target = null;
      k.ride = null;
      k.mag = 0;
    }

    function goTo(k, state, x, z, ride) {
      k.state = state;
      k.target = { x: x, z: z };
      k.ride = ride || null;
      k.stuck = 0;
    }

    function goRide(k, id, state) {
      var s = spots[id];
      goTo(k, state || 'walk', s.x + (rand() - 0.5), s.z + (rand() - 0.5) * 0.6, id);
    }

    // What an idle kid does next: a ride (their favourite half the time), a partner for a kid waiting alone on the
    // see-saw, or a wander.
    function choose(k) {
      if (waitingAlone() && rand() < 0.7) return goRide(k, 'seesaw');
      if (rand() < 0.65) return goRide(k, rand() < 0.5 ? k.fav : RIDES[index(RIDES.length)]);
      var p = spotAt(rand() * Math.PI * 2, area.r * (0.3 + rand() * 0.5));
      goTo(k, 'walk', p.x, p.z, null);
    }

    function waitingAlone() {
      return !board.herRide() && board.friends('seesaw') === 0 && kids.some(function (k) {
        var s = board.seatOf(k.id);
        return s && s.id === 'seesaw' && !board.moving(k.id);
      });
    }

    // One step toward the target, round props; true on arrival.
    function step(k, dt, speed) {
      var dx = k.target.x - k.x, dz = k.target.z - k.z, d = Math.hypot(dx, dz);
      if (d <= NEAR) {
        k.mag = 0;
        return true;
      }
      var len = Math.min(d, speed * dt), base = Math.atan2(dx, dz);
      for (var i = 0; i < TURNS.length; i++) {
        var a = base + TURNS[i], nx = k.x + Math.sin(a) * len, nz = k.z + Math.cos(a) * len;
        if (!o.blocked(nx, nz, KID_R)) {
          k.x = nx;
          k.z = nz;
          k.face = a;
          k.mag = speed / RUN;
          k.walkT += len * 1.6;
          k.stuck = 0;
          return false;
        }
      }
      k.mag = 0;
      k.stuck += dt;
      return false;
    }

    // The timer counts how long a seated kid has waited for the ride to start.
    function seated(k) {
      k.state = 'ride';
      k.mag = 0;
      k.timer = 0;
    }

    function arrive(k) {
      if (!k.ride) return idle(k);
      if (board.claim(k.id, k.ride) >= 0) return seated(k);
      if (k.state === 'join' || k.ride === 'slide') {
        k.state = 'wait';
        k.timer = WAIT_TIME;
        return;
      }
      idle(k);
    }

    // She got on ride id: friends come, an invited one first, then kids who love that ride, then the nearest.
    function joiners(id, her) {
      var need = Math.max(0, JOIN[id] - board.friends(id));
      kids.filter(function (k) {
        return !board.seatOf(k.id) && k.state !== 'talk' && (k.invite || Math.hypot(k.x - her.x, k.z - her.z) <= JOIN_R);
      }).sort(function (a, b) {
        return (b.invite ? 2 : 0) + (b.fav === id ? 1 : 0) - (a.invite ? 2 : 0) - (a.fav === id ? 1 : 0)
          || Math.hypot(a.x - her.x, a.z - her.z) - Math.hypot(b.x - her.x, b.z - her.z);
      }).slice(0, need).forEach(function (k) { goRide(k, id, 'join'); });
    }

    function landed(k, end, out, said) {
      k.x = end.x;
      k.z = end.z;
      k.face = end.face || 0;
      k.state = 'cheer';
      k.timer = CHEER_TIME;
      k.invite = null;
      k.target = null;
      k.ride = null;
      if (said) out.pops.push({ kid: k.id, text: said });
    }

    function tick(dt, her) {
      var out = { pops: [], sounds: [] };
      board.tick(dt, her.now).forEach(function (e) {
        if (e.type === 'land') landed(byId[e.kid], e.end, out, null);
        else if (e.type === 'start') {
          e.bumped.forEach(function (b) { landed(byId[b.kid], b.end, out, 'yourTurn'); });
          joiners(e.id, her);
        }
      });
      var gone = !inside(her.x, her.z, -LEAVE_R);
      kids.forEach(function (k) {
        var near = Math.hypot(k.x - her.x, k.z - her.z);
        k.wave = false;
        if (board.seatOf(k.id)) {
          k.state = 'ride';
          if (board.moving(k.id)) {
            k.pop -= dt;
            if (k.pop <= 0) {
              k.pop = POP_EVERY + rand() * 2;
              out.pops.push({ kid: k.id, text: POPS[index(POPS.length)] });
              if (rand() < 0.3) out.sounds.push('mate-giggle');
            }
          } else if ((k.timer -= dt) < -WAIT_TIME) {
            board.leave(k.id);
            idle(k);
          }
          return;
        }
        if (k.invite) {
          k.invite.t -= dt;
          if (k.invite.t <= 0 || gone) {
            k.invite = null;
            if (k.state === 'follow') {
              idle(k, 2);
              out.pops.push({ kid: k.id, text: '👋' });
            }
          }
        }
        if (k.state === 'idle') {
          if (near <= WAVE_R) {
            k.face = Math.atan2(her.x - k.x, her.z - k.z);
            k.wave = true;
          }
          if ((k.timer -= dt) <= 0) choose(k);
        } else if (k.state === 'walk' || k.state === 'join') {
          var speed = k.state === 'join' || k.racer ? RUN : WALK;
          if (step(k, dt, speed)) arrive(k);
          else if (k.stuck > STUCK_TIME) idle(k);
          if (k.state === 'join' && board.herRide() !== k.ride) idle(k);
        } else if (k.state === 'wait') {
          if (board.claim(k.id, k.ride) >= 0) seated(k);
          else if ((k.timer -= dt) <= 0 || (k.ride !== 'slide' && board.herRide() !== k.ride)) idle(k);
        } else if (k.state === 'follow') {
          k.target = { x: her.x, z: her.z };
          if (near > GAP) step(k, dt, RUN);
          else {
            k.mag = 0;
            k.face = Math.atan2(her.x - k.x, her.z - k.z);
          }
        } else if (k.state === 'talk') {
          k.mag = 0;
          k.face = Math.atan2(her.x - k.x, her.z - k.z);
        } else if (k.state === 'cheer') {
          k.mag = 0;
          if ((k.timer -= dt) <= 0) idle(k);
        }
      });
      return out;
    }

    // Each kid's pose this frame, in o.kids order.
    function frames() {
      return kids.map(function (k) {
        var p = board.pose(k.id);
        if (p) return { id: k.id, x: p.x, y: p.y, z: p.z, face: p.face, ride: true, sit: p.sit, cheer: p.cheer, walkT: 0, mag: 0 };
        return { id: k.id, x: k.x, y: 0, z: k.z, face: k.face, ride: false, sit: false, cheer: k.state === 'cheer', wave: k.wave, walkT: k.walkT, mag: k.mag };
      });
    }

    function talk(id, on) {
      var k = byId[id];
      if (!k) return false;
      if (on) {
        if (board.seatOf(id) || k.state === 'join') return false;
        k.state = 'talk';
        k.target = null;
        k.mag = 0;
        return true;
      }
      if (k.state === 'talk') idle(k, 1);
      return true;
    }

    function invite(id, ride) {
      var k = byId[id];
      if (!k || board.seatOf(id)) return false;
      k.invite = { ride: ride, t: INVITE_TIME };
      k.state = 'follow';
      k.ride = null;
      return true;
    }

    // Everyone off the rides and standing at home; they stay put until she rides (the e2e uses this).
    function calm() {
      board.clear();
      kids.forEach(function (k) {
        k.x = k.home.x;
        k.z = k.home.z;
        k.invite = null;
        idle(k, 1e9);
      });
    }

    return {
      tick: tick, frames: frames, talk: talk, invite: invite, calm: calm, parts: board.parts,
      tappable: function () {
        return kids.filter(function (k) { return !board.seatOf(k.id) && k.state !== 'join'; }).map(function (k) { return { id: k.id, x: k.x, z: k.z }; });
      },
      list: function () {
        return kids.map(function (k) { return { id: k.id, x: k.x, z: k.z, state: k.state, seat: board.seatOf(k.id), invited: !!k.invite }; });
      }
    };
  }

  var exported = { create: create, INVITE_TIME: INVITE_TIME };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateMind = exported;
})(this);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-matemind.test.js`
Expected: PASS. If "most kids rode something" fails, print `mind.list()` states over time: kids stuck walking into a prop show `stuck`; the fix is in `step`/`spotAt`, not lowering the number below 5.

- [ ] **Step 5: Stage and hand over**

```bash
git add web/world/matemind.js tests/world3d-matemind.test.js && git commit -m 'Playmates 6/9: matemind.js, each playground kid stands and waves, wanders, walks or runs to a ride, waits their turn, rides, runs over to ride with her (an invited friend first, then kids who love that ride), follows her for a minute when invited, stops to talk and cheers after a ride; only riding kids show emoji pops' -- web/world/matemind.js tests/world3d-matemind.test.js
```

---

### Task 7: `mates3d.js` — the kids in 3D, pops and the talk bubble

**Files:**
- Create: `web/world/mates3d.js`
- Test: `tests/world3d-mates-wiring.test.js` (source checks; the behaviour is covered by Task 8's e2e)

- [ ] **Step 1: Write the failing test** — create `tests/world3d-mates-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');

const src = fs.readFileSync(worldFile('mates3d.js'), 'utf8');

test('playground study answers are saved to history but never scored or reviewed', () => {
  assert.match(src, /quizStarted\(/);
  assert.match(src, /quizAnswered\(/);
  for (const banned of ['Recall.', 'StudyKit', 'quizFinished', 'Wallet']) assert.ok(!src.includes(banned), banned);
});

test('every question asked is marked for today first, so none repeats', () => {
  assert.match(src, /markAsked\(o\.store, today, MQ\.studyKey\(/);
  assert.match(src, /markAsked\(o\.store, today, MQ\.funKey\(/);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-mates-wiring.test.js`
Expected: FAIL — `ENOENT ... mates3d.js`.

- [ ] **Step 3: Create `web/world/mates3d.js`**

```js
/* The playground kids in 3D (playmates part 1): builds the nine kids with the character maker's body, shows them only
   while she is near the playground, poses them each frame from matemind.js, shows emoji and word pops over their heads,
   and talks with her in the speech bubble: a hello, then one question (a study question from any of her subjects or a
   fun one), then 🎠 Let's play! to invite a friend along. Study answers go to her study history with no points; review
   boxes, quests and the 3-day rest are never touched. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var WAKE = 20, POP_TIME = 1.4, TAG_Y = 7.2, SCALE = 0.92;

  // o = { S, built, grade, T, store, today(), busy(on), sound(name), sfx(name), textOf(html), facts(), rand }
  function create(o) {
    var L = W.Layout, S = o.S, T = o.T, grade = o.grade, doc = root.document, rand = o.rand || Math.random;
    var ML = W.MateLines, MQ = W.MateQuiz, LT = ML.TEXT[grade], bank = ML.fun(grade);
    var pg = L.places(grade).playground, ends = {}, obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds;
    L.rideSpots(grade).forEach(function (s) { ends[s.id] = s.end; });
    var list = W.Mates.all(rand);
    var mind = W.MateMind.create({
      pr: L.props(grade), ends: ends, boards: L.rideSpots(grade), area: pg, rand: rand,
      kids: list.map(function (m) { return { id: m.id, fav: m.fav, racer: m.id === 'tomas' }; }),
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r); }
    });
    var load = W.Ask.loader(root, W.LessonFiles), apps = L.buildings(grade).map(function (b) { return b.app; });
    var still = false, textures = {}, talk = null, token = 0, awake = false;
    try { still = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

    var kids = list.map(function (m) {
      var ch = W.Avatar.character(S, W.Pets.wearable(W.Items.wearable(m.look, null), null));
      ch.group.scale.setScalar(SCALE);
      if (m.name) {
        var tag = S.sprite(S.label(m.face + ' ' + m.name, '#6aa9ff'), 3.6, 3.6 * 180 / 512);
        tag.position.set(0, TAG_Y, 0);
        ch.group.add(tag);
      }
      var pop = S.sprite(S.emoji('😄'), 1.4, 1.4);
      pop.visible = false;
      ch.group.visible = false;
      S.scene.add(ch.group);
      S.scene.add(pop);
      return { m: m, ch: ch, pop: pop, popT: 0, x: 0, y: 0, z: 0 };
    });
    var byId = {};
    kids.forEach(function (k) { byId[k.m.id] = k; });

    function english(s) { return String(s).split(' · ').pop(); }
    function pick(lines) { return lines[Math.min(lines.length - 1, Math.floor(rand() * lines.length))]; }
    function nameOf(k) { return k.m.name || LT.newFriend; }

    // An emoji pops as a picture; words (Tara!, Your turn!) as a small sign.
    function showPop(k, text) {
      if (text === 'yourTurn') text = LT.yourTurn;
      var word = /[A-Za-z]/.test(text);
      if (!textures[text]) textures[text] = word ? S.label(text, '#ff9e6b') : S.emoji(text);
      k.pop.material.map = textures[text];
      k.pop.material.needsUpdate = true;
      if (word) k.pop.scale.set(3.2, 3.2 * 180 / 512, 1);
      else k.pop.scale.set(1.4, 1.4, 1);
      k.popT = POP_TIME;
    }

    function tick(t, dt, st, now) {
      var on = Math.hypot(st.x - pg.x, st.z - pg.z) <= pg.r + WAKE;
      if (on !== awake) {
        awake = on;
        kids.forEach(function (k) {
          k.ch.group.visible = on;
          if (!on) k.pop.visible = false;
        });
      }
      if (!on) return;
      var out = mind.tick(dt, { x: st.x, z: st.z, now: now });
      out.pops.forEach(function (p) { showPop(byId[p.kid], p.text); });
      out.sounds.forEach(function (s) { o.sfx(s); });
      var parts = mind.parts();
      Object.keys(parts).forEach(function (p) { o.built.ride(p, parts[p]); });
      mind.frames().forEach(function (f, n) {
        var k = kids[n], g = k.ch.group;
        k.x = f.x;
        k.y = f.y;
        k.z = f.z;
        g.position.set(f.x, f.y, f.z);
        g.rotation.y = f.face;
        k.ch.animate(t, f.walkT, f.mag, f.ride ? { ride: true, sit: f.sit, cheer: f.cheer } : { wave: f.wave, cheer: f.cheer });
        if (k.popT > 0) {
          k.popT = Math.max(0, k.popT - dt);
          k.pop.visible = k.popT > 0;
          k.pop.position.set(f.x, f.y + 6.4 + (still ? 0 : (POP_TIME - k.popT) * 0.8), f.z);
        }
      });
    }

    function say(k, text, sub, buttons) {
      if (talk) talk.close();
      mind.talk(k.m.id, true);
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: k.m.face, who: nameOf(k), text: text, sub: sub, stack: true, pair: grade === 'grade2', buttons: buttons,
        onClose: function () {
          if (talk !== mine) return;
          talk = null;
          o.busy(false);
          mind.talk(k.m.id, false);
        }
      });
    }

    function tail(k) {
      return [{ text: LT.play, onClick: function () { pickRide(k); } }, { text: T.bye }];
    }

    function pickRide(k) {
      var buttons = ['slide', 'swings', 'seesaw', 'merry'].map(function (id) {
        return { text: T.rides[id], onClick: function () { if (mind.invite(k.m.id, id)) showPop(k, LT.tara); } };
      });
      say(k, LT.pickRide, '', buttons.concat([{ text: T.bye }]));
    }

    function hello(k, today) {
      if (k.m.isNew) return pick(LT.newHello);
      var r = rand();
      if (r < 0.3) {
        var mem = MQ.remembered(bank, MQ.read(o.store, today).fun, rand);
        if (mem) return LT.remember(mem.q, mem.q.choices[mem.choice]);
      }
      if (r < 0.65) {
        var lines = [];
        try { lines = ML.progress(grade, o.facts()); } catch (e) {}
        if (lines.length) return pick(lines);
      }
      return pick(LT.hello[k.m.id]);
    }

    function fun(k, line, today) {
      var q = MQ.pickFun(bank, MQ.read(o.store, today).asked, rand);
      if (!q) return say(k, line, '', tail(k));
      MQ.markAsked(o.store, today, MQ.funKey(q.id), Date.now());
      var buttons = q.choices.map(function (c, j) { return { text: c, onClick: function () { funAnswered(k, q, j, today); } }; });
      say(k, line, q.sub, buttons.concat(tail(k)));
    }

    function funAnswered(k, q, j, today) {
      MQ.saveFun(o.store, today, q.id, j, Date.now());
      var fav = MQ.favourite(k.m.id, q);
      if (fav === j) o.built.hearts(k.x, 5, k.z);
      say(k, fav === j ? LT.same : LT.other(q.choices[fav]), '', tail(k));
    }

    // A question from her own subjects not asked today: each subject's lesson files load in a random order until one
    // has a question left; null when none does.
    function findStudy(today) {
      var asked = MQ.read(o.store, today).asked;
      var mineApps = MQ.shuffle(apps.filter(function (a) { return W.Quiz.supports(a) && !!W.LessonFiles[a]; }), rand);
      return mineApps.reduce(function (p, app) {
        return p.then(function (found) {
          if (found) return found;
          return load(app).then(function (lessons) {
            var cands = [];
            lessons.forEach(function (l) {
              (l.quiz || []).forEach(function (it) { if (W.Quiz.askable(app, l, it)) cands.push({ app: app, item: it }); });
            });
            return MQ.pickStudy(cands, asked, rand);
          }, function () { return null; });
        });
      }, Promise.resolve(null));
    }

    // my: this talk's token; a later talk (with any kid) makes the slow lesson load give up.
    function study(k, line, today, my) {
      say(k, line, LT.thinking, [{ text: T.bye }]);
      findStudy(today).then(function (q) {
        if (my !== token || !talk) return;
        if (!q) return fun(k, line, today);
        MQ.markAsked(o.store, today, MQ.studyKey(q.app, q.item.q), Date.now());
        var v = W.Quiz.view(q.app, q.item, o.textOf, rand);
        var buttons = v.options.map(function (opt) { return { text: opt.text, onClick: function () { studied(k, q, v, opt); } }; });
        say(k, line, [v.q, v.sub].filter(Boolean).join('\n'), buttons.concat(tail(k)));
      }, function () {
        if (my === token && talk) fun(k, line, today);
      });
    }

    // Saved like a world Ask me! answer (a review quiz that never finishes), but with no points and no review box.
    function studied(k, q, v, opt) {
      var right = !!opt.right, SH = root.StudyHistory, f = W.LessonFiles[q.app];
      try {
        if (SH && SH.quizStarted) {
          var info = W.Quiz.info(q.app, q.item, o.textOf);
          var id = SH.quizStarted(q.app, f.title, 'review', english(LT.title), false, 1, 'review');
          SH.quizAnswered(id, right, info.historyQ, opt.history, info.historyAnswer, false);
        }
      } catch (e) {}
      if (right) {
        o.built.cheer(k.x, 4.5, k.z);
        o.sound('allRead');
      }
      var sub = (right ? [v.good, v.explain] : [opt.why, v.explain]).filter(Boolean).join('\n');
      say(k, right ? pick(LT.right) : LT.answerIs(v.answer), sub, tail(k));
    }

    function openTalk(n) {
      var k = kids[n];
      if (!mind.talk(k.m.id, true)) return;
      var my = ++token, today = o.today(), line = hello(k, today);
      if (k.m.asks === 'study') study(k, line, today, my);
      else fun(k, line, today);
    }

    function items() {
      if (!awake) return [];
      return mind.tappable().map(function (t) {
        var n = kids.indexOf(byId[t.id]);
        return { kind: 'mate', id: 'mate:' + t.id, mate: n, x: t.x, z: t.z, r: 2.4 };
      });
    }

    return {
      tick: tick, items: items,
      handles: function (kind) { return kind === 'mate'; },
      label: function (it) { return T.talkTo.replace('{name}', english(nameOf(kids[it.mate]))); },
      act: function (it) { if (!talk) openTalk(it.mate); },
      closeTalk: function () { if (talk) talk.close(); },
      debug: {
        list: function () { return mind.list().map(function (k) { return Object.assign({ visible: byId[k.id].ch.group.visible }, k); }); },
        calm: mind.calm,
        invite: mind.invite,
        talk: function (id) { var n = kids.indexOf(byId[id]); if (n >= 0) openTalk(n); }
      }
    };
  }

  W.Mates3D = { create: create };
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-mates-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Stage and hand over**

```bash
git add web/world/mates3d.js tests/world3d-mates-wiring.test.js && git commit -m 'Playmates 7/9: mates3d.js draws the nine kids near the playground with name tags, emoji and word pops, and talks with her: a hello (sometimes about her real progress or an answer she gave before), one study or fun question never asked today, then Let'"'"'s play! to invite a friend; study answers are saved to history with no points and no review box' -- web/world/mates3d.js tests/world3d-mates-wiring.test.js
```

---

### Task 8: Wire it into the world, pages, sound, precache and e2e

**Files:**
- Modify: `web/world/world-main.js` (after `var play = ...` at line ~178; `actLabel` ~210; `act` ~219; `tick` ~455-507; debug ~651)
- Modify: `web/world/sfx.js` (`SOUNDS`)
- Modify: `web/world/grade-5.html`, `web/world/grade-2.html`, `tests/paths.js:12`
- Modify: `web/sw.js` via `node tools/update-precache.js`
- Modify: `tests/world3d-mates-wiring.test.js`, `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`

- [ ] **Step 1: Write the failing tests** — append to `tests/world3d-mates-wiring.test.js`:

```js
const { WORLD_FILES } = require('./paths.js');
const Sfx = require(worldFile('sfx.js'));

test('the playmate files load after what they use', () => {
  const at = (f) => WORLD_FILES.indexOf(f);
  for (const f of ['mates.js', 'matelines.js', 'matequiz.js', 'mateboard.js', 'matemind.js', 'mates3d.js']) assert.ok(at(f) >= 0, f);
  assert.ok(at('look.js') < at('mates.js'));
  assert.ok(at('rides.js') < at('mateboard.js'));
  assert.ok(at('mateboard.js') < at('matemind.js'));
  for (const f of ['avatar.js', 'talk.js', 'ask.js', 'quiz.js', 'matemind.js']) assert.ok(at(f) < at('mates3d.js'), f);
  assert.ok(at('mates3d.js') < at('world-main.js'));
});

test('world-main wires the kids in, behind every other thing she can tap', () => {
  const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');
  assert.match(main, /W\.Mates3D\.create\(/);
  assert.match(main, /\|\| L\.nearest\(mates\.items\(\), st\.x, st\.z\)/);
  assert.match(main, /mates\.tick\(t, dt, st, play\.now\(\)\)/);
  assert.ok(Sfx.SOUNDS['mate-giggle'], 'the giggle is a sound');
  assert.equal(Sfx.FILES.length, 56, 'no new clip files');
});
```

Run: `node --test tests/world3d-mates-wiring.test.js` → Expected: FAIL (`mates.js` not in `WORLD_FILES`).

- [ ] **Step 2: Load order** — in `tests/paths.js` line 12, insert `'mates.js', 'matelines.js', 'matequiz.js', 'mateboard.js', 'matemind.js'` right after `'rides.js'`, and `'mates3d.js'` right after `'play.js'`. In both `web/world/grade-5.html` and `web/world/grade-2.html`, after `<script src="rides.js"></script>` add:

```html
<script src="mates.js"></script>
<script src="matelines.js"></script>
<script src="matequiz.js"></script>
<script src="mateboard.js"></script>
<script src="matemind.js"></script>
```
and after `<script src="play.js"></script>` add `<script src="mates3d.js"></script>`.

- [ ] **Step 3: Sound** — in `web/world/sfx.js` `SOUNDS`, after `'emote-giggle'`:

```js
    'mate-giggle': clip('emote-giggle.mp3', 0.3, { cool: 2 }),
```

- [ ] **Step 4: `web/world/world-main.js`** — after the `var play = W.Play.create({...});` block add:

```js
    var subjectNames = {};
    W.Progress.cards(grade, L, root.Subjects).forEach(function (c) { subjectNames[c.app] = english(c.name); });
    var mates = W.Mates3D.create({
      S: S, built: world, grade: grade, T: T, store: store, today: today, busy: busy, sound: sound,
      sfx: function (name) { sfx.play(name); },
      textOf: function (html) { return root.Recall && root.Recall.textOf ? root.Recall.textOf(html) : String(html == null ? '' : html); },
      facts: function () {
        var streak = 0;
        try { streak = root.Quests.streakOf(root.Quests.read(store).days, today()); } catch (e) {}
        return W.MateLines.facts(town.snapshot(), subjectNames, streak);
      }
    });
```

In `actLabel(it)` add before the `kin.handles` line: `if (mates.handles(it.kind)) return mates.label(it);`
In `act()` add before the `kin.handles` branch: `else if (mates.handles(near.kind)) mates.act(near);`
In `tick(dt)` replace

```js
      near = free ? L.nearest(items.concat(kin.items()), st.x, st.z) : null;
```
with
```js
      // A kid is only the thing to tap when no door, ride or other character is in reach.
      near = free ? L.nearest(items.concat(kin.items()), st.x, st.z) || L.nearest(mates.items(), st.x, st.z) : null;
```
and inside `if (!maker && !stall) { ... }` add after `kin.tick(...)`:

```js
        if (!overlay) mates.tick(t, dt, st, play.now());
```
In the debug section: change `debug.closeTalk` to also call `mates.closeTalk();` and add `debug.mates = mates.debug;`.

- [ ] **Step 5: Precache**

Run: `node tools/update-precache.js`
Expected: `web/sw.js` PRECACHE now lists `world/mates.js`, `world/matelines.js`, `world/matequiz.js`, `world/mateboard.js`, `world/matemind.js`, `world/mates3d.js`.

- [ ] **Step 6: Run all unit tests**

Run: `node --test tests/`
Expected: PASS (every suite, including `world3d-wiring`, `pwa`, `world3d-sfx`).

- [ ] **Step 7: e2e case** — in `tests/e2e/world-driver.page.js` add `mates` to the mode list comment and this case before `if (mode === 'lost')`:

```js
    if (mode === 'mates') {
      D.pause();
      var MLY = World3D.Layout, rs = function (id) { return MLY.rideSpots('grade5').filter(function (s) { return s.id === id; })[0]; };
      D.teleport('playground');
      D.tick(0.1);
      o.visible = D.mates.list().filter(function (k) { return k.visible; }).length;
      D.mates.calm();
      var se = rs('seesaw');
      D.stand(se.x, se.z);
      o.seesawAct = D.actText();
      D.act();
      var r;
      for (r = 0; r < 100 && !D.mates.list().some(function (k) { return k.seat && k.seat.id === 'seesaw'; }); r++) D.tick(0.1);
      o.partner = D.mates.list().filter(function (k) { return k.seat && k.seat.id === 'seesaw'; }).map(function (k) { return k.seat.i; });
      D.stopRide();
      for (r = 0; r < 80 && D.riding(); r++) D.tick(0.1);
      D.tick(0.1);
      o.landed = D.mates.list().filter(function (k) { return k.seat; }).length;
      D.mates.calm();
      D.mates.talk('ella');
      return waitFor(function () { return document.querySelector('.talk-row.stack') && D.talkButtons().length > 3; }, function () {
        o.ellaText = D.talkText();
        o.ellaButtons = D.talkButtons();
        var reviewBefore = Learner.storage.getItem('review_v1');
        D.pressTalk(o.ellaButtons[0]);
        o.ellaAfter = D.talkText();
        o.history = StudyHistory.list().filter(function (e) { return e.app === 'life-lab'; })
          .map(function (e) { return { kind: e.kind, answered: e.answered, finished: e.finished, points: e.points }; });
        o.points = Learner.storage.getItem('lifelab_points_v1');
        o.reviewSame = Learner.storage.getItem('review_v1') === reviewBefore;
        o.asked = JSON.parse(Learner.storage.getItem('mates_v1')).asked.length;
        D.pressTalk("🎠 Let's play!");
        D.pressTalk('🌈 Ride the swing!');
        o.ellaState = D.mates.list().filter(function (k) { return k.id === 'ella'; })[0].state;
        var sw = rs('swings');
        D.stand(sw.x, sw.z);
        for (r = 0; r < 30; r++) D.tick(0.1);
        D.act();
        for (r = 0; r < 60 && !D.mates.list().some(function (k) { return k.id === 'ella' && k.seat; }); r++) D.tick(0.1);
        o.ellaSeat = D.mates.list().filter(function (k) { return k.id === 'ella'; })[0].seat;
        D.stopRide();
        for (r = 0; r < 80 && D.riding(); r++) D.tick(0.1);
        D.tick(0.1);
        D.mates.talk('migo');
        o.migoButtons = D.talkButtons();
        D.pressTalk(o.migoButtons[0]);
        o.migoAfter = D.talkText();
        o.fun = JSON.parse(Learner.storage.getItem('mates_v1')).fun;
        D.pressTalk('👋 Bye');
        D.teleport('gate');
        D.tick(0.1);
        o.farVisible = D.mates.list().filter(function (k) { return k.visible; }).length;
        out(o);
      });
    }
```

Migo is talked to after the swing ride lands, so the bubble's busy state never mixes with the ride's.

In `tests/e2e/world-e2e.js`, after the `talk` block (it already computed `item`, `answer`, `key` and copies the Life Lab lesson files), add:

```js
  // Playmates part 1: nine kids near the playground only, a friend on the see-saw's far end who lands with her, Ella's
  // study question saved to history with 0 points and no review box, an invited friend on the other swing, Migo's fun
  // question remembered in mates_v1.
  const MATES = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));'
    + 'Math.random = (function () { var s = 7; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();</script>';
  const matesFile = stageWorld('mates', 5, MATES);
  for (const f of lf.files) {
    const to = path.join(work, 'mates', 'world', lf.dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(web('world'), lf.dir, f), to);
  }
  const mt = run('mates', matesFile, 'mates');
  assert.deepEqual(mt.errors, [], 'mates: page errors');
  assert.equal(mt.visible, 9, 'nine kids at the playground');
  assert.equal(mt.seesawAct, '⚖️ Ride the see-saw!', 'the ride stays the thing to tap');
  assert.deepEqual(mt.partner, [1], 'a friend on the far end');
  assert.equal(mt.landed, 0, 'everyone got off with her');
  assert.deepEqual(mt.ellaButtons.slice(-2), ["🎠 Let's play!", '👋 Bye']);
  assert.ok(mt.ellaButtons.length >= 4, 'a Life Lab question with its choices: ' + mt.ellaButtons);
  assert.ok(/Galing|Right|smart|Oops/.test(mt.ellaAfter), mt.ellaAfter);
  assert.deepEqual(mt.history, [{ kind: 'review', answered: 1, finished: false, points: 0 }]);
  assert.equal(mt.points, null, 'no points');
  assert.equal(mt.reviewSame, true, 'no review box moved');
  assert.equal(mt.asked, 1);
  assert.equal(mt.ellaState, 'follow');
  assert.deepEqual(mt.ellaSeat, { id: 'swings', i: 1 }, 'the invited friend takes the other swing');
  assert.ok(mt.migoButtons.length >= 4, 'a fun question with choices');
  assert.ok(/Me too|cool/.test(mt.migoAfter), mt.migoAfter);
  assert.equal(Object.keys(mt.fun).length, 1, 'Migo remembers her answer');
  assert.equal(mt.farVisible, 0, 'hidden away from the playground');
  console.log('ok playmates: ride together, study and fun questions, invite');
```

The Math.random seed only makes the run repeatable. Only Life Lab's lesson files are staged, so every other subject fails to load and Ella's question comes from Life Lab; the driver presses her first choice, right or wrong.

- [ ] **Step 8: Run the e2e suites the world touches**

Run: `node tests/e2e/world-e2e.js`
Expected: every `ok ...` line including `ok playmates: ride together, study and fun questions, invite`. The existing `kin` case rides the swings and merry-go-round near the kids; it must still pass (kids never take her tap: `near` prefers rides).

Run: `node tests/e2e/lobby-e2e.js`, `node tests/e2e/file-check-e2e.js`, `node tests/e2e/nav-e2e.js`
Expected: PASS.

- [ ] **Step 9: Stage and hand over**

```bash
git add web/world/world-main.js web/world/sfx.js web/world/grade-5.html web/world/grade-2.html web/sw.js web/world/lesson-files.js tests/paths.js tests/world3d-mates-wiring.test.js tests/e2e/world-driver.page.js tests/e2e/world-e2e.js && git commit -m 'Playmates 8/9: the playground kids join the 3D world in both grades: tappable only when nothing else is in reach, frozen while a card, the maker or a stall is open, a soft giggle (the existing clip) now and then while they ride; precache and e2e' -- web/world/world-main.js web/world/sfx.js web/world/grade-5.html web/world/grade-2.html web/sw.js web/world/lesson-files.js tests/paths.js tests/world3d-mates-wiring.test.js tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 9: Spec touch-up and a look at it running

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-playground-playmates-design.md`

- [ ] **Step 1: Update the spec** with the planning decisions listed at the top of this plan: `mates_v1` in `matequiz.js` (prefs.js untouched), the giggle reuses `emote-giggle.mp3` (no new clips), the other swing swings opposite her, "Your turn!" / "Tara!" are word pops, kids are tapped only when nothing else is in reach, `mateboard.js` and `mates3d.js` added to the file table.

- [ ] **Step 2: Look at it** — open `web/world/grade-5.html` from disk in Chrome, use quick travel to 🛝 Playground, and check by eye: the kids ride on their own, a kid sits opposite on the see-saw, the other swing swings opposite her, pops float over riders, name tags read clearly, Ella's question bubble, Let's play! → the friend follows. Then `grade-2.html`: Filipino · English lines in the bubble, English buttons. Report anything odd to the user rather than guessing.

- [ ] **Step 3: Run everything once more**

Run: `node --test tests/` and `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 4: Stage and hand over**

```bash
git add docs/superpowers/specs/2026-10-07-playground-playmates-design.md && git commit -m 'Playmates 9/9: spec matches the build (mates_v1 in matequiz.js, the giggle reuses the existing clip, the other swing swings opposite her, word pops for Tara! and Your turn!, kids tapped only when nothing else is in reach)' -- docs/superpowers/specs/2026-10-07-playground-playmates-design.md
```
