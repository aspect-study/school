# Playground Games Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Repo rules:** never run `git commit` (the owner does); never add `Co-Authored-By` or any AI attribution. Where a step says "Commit", only print the command for the owner. Browser JS is ES5 in an IIFE. Comments only for non-obvious code. No fully-qualified class names inline. Spec: `docs/superpowers/specs/2026-10-12-playground-games-polish-design.md`.

**Goal:** Stamina heart in tag, hide-and-seek and Patintero; a roster and name tags of who plays; a tag chaser who switches targets and comes back; Patintero bibs, slow-motion replay on every tag, and a different guard lane for her each round.

**Architecture:** Pure rules stay in `web/world/mategame.js` and `web/world/patintero.js` (unit-tested with `node --test`). A new pure module `web/world/replay.js` records and samples player positions. `web/world/games3d.js` shows everything (roster, name tags, bibs, replay) and `web/world/world-main.js` wires stamina and the replay camera.

**Tech Stack:** Plain ES5 JS, Three.js (global `THREE` via `S.THREE`), `node --test`, headless-Chrome e2e in `tests/e2e`.

---

## File structure

- Modify `web/world/mategame.js` — tag give-up time, return-to-her rule, `TAG.returnR`, `TAG.hold`.
- Modify `web/world/patintero.js` — `LANES`, `pickLane`, lane-aware `lineUp`, `fence` 5th arg, `state().herPost`.
- Create `web/world/replay.js` — pure recorder/sampler. Add to `tests/paths.js` `WORLD_FILES` (before `games3d.js`) and both `web/world/grade-2.html`, `grade-5.html` script lists, then `node tools/update-precache.js`.
- Modify `web/world/games3d.js` — roster row, name tags, bibs, replay playback, lane hint, hide-and-seek heartbeat.
- Modify `web/world/mates3d.js` (`api.group(id)`), `web/world/kin.js` (`player().group()`), `web/world/world-main.js` (stamina not paused; `herGroup`, `pose`, `focus` options for games), `web/world/world.css` (roster, name tag, replay label/skip).
- Tests: `tests/world3d-mategame.test.js`, `tests/world3d-patintero.test.js`, create `tests/world3d-replay.test.js`, `tests/world3d-games-wiring.test.js`, e2e `tests/e2e/world-e2e.js` + `world-driver.page.js`.
- Docs: `docs/HANDOFF.md`, `README.md` if it lists the games' features.

---

### Task 1: Tag — a chaser who cannot catch her tries another kid, then comes back

**Files:** Modify `web/world/mategame.js` (`TAG` consts line ~22, `tickTag` ~360); Test `tests/world3d-mategame.test.js`.

- [ ] **Step 1: Write the failing tests** (append; reuse the file's `field`, `make`, `rand`)

```js
test('tag: a chaser who cannot catch her for 8 s goes after another kid', () => {
  const f = field({ migo: { x: 1, z: 0 }, ella: { x: 3, z: 3 } }), g = make(f);
  g.startTag(['migo', 'ella'], { x: 0, z: 0 });
  g.tick(0.1, { x: 0, z: 0 });
  assert.equal(g.state().it, 'migo');
  let gave = null, t = 0;
  while (!gave && t < 20) { g.tick(0.1, { x: 0, z: 1000 + t * 100 }).forEach((e) => { if (e.type === 'gaveUp') gave = e; }); t += 0.1; }
  assert.ok(gave && gave.chase === 'ella');
  assert.ok(t > 7 && t < 12, 'gave up after about 8 s of chasing, not 20: ' + t);
});

test('tag: when she comes close again the chaser leaves the other kid and chases her', () => {
  const f = field({ migo: { x: 1, z: 0 }, ella: { x: 200, z: 0 } }), g = make(f);
  g.startTag(['migo', 'ella'], { x: 0, z: 0 });
  g.tick(0.1, { x: 0, z: 0 });
  let t = 0, her = { x: 0, z: 1000 };
  while (g.state().danger !== undefined && t < 30 && !(f.kids.migo && g.state().chaseD === null && t > 9)) { g.tick(0.1, her); t += 0.1; }
  f.kids.migo.x = 100; f.kids.migo.z = 0;
  const near = { x: 105, z: 0 };
  let back = null;
  for (let i = 0; i < 60 && !back; i++) g.tick(0.1, near).forEach((e) => { if (e.type === 'backOnHer') back = e; });
  assert.ok(back && back.kid === 'migo', 'chaser returns to her');
});

test('tag: no flip-flop, the chaser holds a new target for 3 s', () => {
  const f = field({ migo: { x: 1, z: 0 }, ella: { x: 200, z: 0 } }), g = make(f);
  g.startTag(['migo', 'ella'], { x: 0, z: 0 });
  g.tick(0.1, { x: 0, z: 0 });
  let gaveAt = null, t = 0;
  while (gaveAt === null && t < 20) { g.tick(0.1, { x: 0, z: 1000 + t * 100 }).forEach((e) => { if (e.type === 'gaveUp') gaveAt = t; }); t += 0.1; }
  f.kids.migo.x = 50; f.kids.migo.z = 0;
  let backs = 0;
  for (let i = 0; i < 25; i++) g.tick(0.1, { x: 52, z: 0 }).forEach((e) => { if (e.type === 'backOnHer') backs++; });
  assert.equal(backs, 0, 'nothing in the first 2.5 s');
});
```

- [ ] **Step 2: Run** `node --test tests/world3d-mategame.test.js` — Expected: the 8 s test FAILS (gave up at 20 s), the others fail (`backOnHer` never emitted).

- [ ] **Step 3: Implement.** In `TAG` change `giveUp: 20` to `giveUp: 8` and add `returnR: 10, hold: 3`. In `tickTag`, just before the existing `if (st.target === 'her' && st.chaseT > TAG.giveUp ...)` block, add:

```js
        if (st.target !== 'her' && st.chaseT > TAG.hold && dist(at, her) <= TAG.returnR) {
          st.target = 'her';
          st.chaseT = 0;
          ev.push({ type: 'backOnHer', kid: it });
        }
```
Update the header comment of the file ("a kid who cannot catch her for GIVE_UP seconds chases another kid instead") to add "and comes back to her once she is within RETURN_R". Rename the old test title "for 20 s" to "for 8 s" in `tests/world3d-mategame.test.js` (the 700-tick loop still passes).

- [ ] **Step 4: Run** `node --test tests/world3d-mategame.test.js` — Expected: all pass.
- [ ] **Step 5: Commit** (owner): `git add web/world/mategame.js tests/world3d-mategame.test.js && git commit -m 'Tag: a chaser who cannot catch her tries another kid after 8 s and comes back when she is near' -- web/world/mategame.js tests/world3d-mategame.test.js`

---

### Task 2: Patintero — her guard lane changes every round

**Files:** Modify `web/world/patintero.js`; Test `tests/world3d-patintero.test.js`.

- [ ] **Step 1: Write failing tests** (append; reuse `setup`, `go`, `C`)

```js
test('pickLane: one of the four lanes, never the one before', () => {
  assert.deepEqual(P.LANES, ['mid', 'c0', 'c1', 'c2']);
  const seen = new Set();
  let prev = null;
  for (let i = 0; i < 60; i++) { const l = P.pickLane(prev, rand); assert.notEqual(l, prev); assert.ok(P.LANES.includes(l)); seen.add(l); prev = l; }
  assert.equal(seen.size, 4);
  assert.ok(P.LANES.includes(P.pickLane(null, rand)));
});

test('when she guards she gets a lane; the kids fill the other three; state names it', () => {
  const { g } = setup(false);
  const s = g.state();
  assert.equal(s.guarding, true);
  assert.ok(P.LANES.includes(s.herPost));
  assert.equal(s.posts.her, s.herPost);
  assert.deepEqual(Object.values(s.posts).sort(), P.LANES.slice().sort(), 'all four lanes used once');
});

test('her lane differs round to round', () => {
  const { f, g, her } = setup(true);
  go(g, her);
  const lanes = [];
  for (let round = 0; round < 6; round++) {
    // a guard tags her: she guards next
    const gid = Object.keys(g.state().posts)[0];
    her.x = 39; her.z = 80;
    f.kids[gid].x = 39; f.kids[gid].z = 80;
    g.tick(0.05, her);
    const s = g.state();
    if (s.guarding) lanes.push(s.herPost);
    // she tags a runner: teams swap back
    const rid = s.team[s.running ? 'blue' : 'blue'].find((id) => id !== 'her');
    const runner = s.team.red[0];
    f.kids[runner].x = her.x; f.kids[runner].z = her.z;
    go(g, her);
    g.tick(0.05, her);
    go(g, her);
  }
  for (let i = 1; i < lanes.length; i++) assert.notEqual(lanes[i], lanes[i - 1]);
});

test('fence follows her lane: a cross line keeps her on that line', () => {
  const z = C.cross[1];
  assert.equal(P.fence(C, true, 39, z, 'c1'), false);
  assert.equal(P.fence(C, true, 39, z + 1, 'c1'), true, 'off the line');
  assert.equal(P.fence(C, true, C.maxX + 1, z, 'c1'), true, 'past the sideline');
  assert.equal(P.fence(C, true, 39, 70), false, 'default stays the middle line');
});
```
(If the third test's helper logic proves awkward, simplify to calling `g.start(...)` repeatedly with `herRuns:false` via a loop of `setup(false)` and a shared `prev`; the required behaviour is "`start`/`lineUp` never repeats `herPost` of the previous guarding round for the same game". Keep it deterministic.)

- [ ] **Step 2: Run** `node --test tests/world3d-patintero.test.js` — Expected: FAIL (`P.LANES` undefined).

- [ ] **Step 3: Implement.** In `patintero.js`:
  - After `POSTS`: `var LANES = ['mid', 'c0', 'c1', 'c2'];` and
    ```js
    // A random lane for her to guard, different from the round before.
    function pickLane(prev, rand) {
      var pool = LANES.filter(function (l) { return l !== prev; });
      return pool[Math.floor(rand() * pool.length) % pool.length];
    }
    ```
  - `fence(c, guarding, x, z, post)`: when `guarding` and `post` is `'c0'|'c1'|'c2'`: `return Math.abs(z - c.cross[+post.slice(1)]) > 0.01 || x < c.minX + COURT.edge || x > c.maxX - COURT.edge;` otherwise the existing middle-line test.
  - In `create`, keep `var lastLane = null;` Replace the guard loop in `lineUp`:
    ```js
      var herLane = guard.indexOf('her') >= 0 ? pickLane(lastLane, rand) : null;
      if (herLane) lastLane = herLane;
      var rest = LANES.filter(function (l) { return l !== herLane; }), restAt = 0;
      guard.forEach(function (id, n) {
        var post = id === 'her' ? herLane : (herLane ? rest[restAt++] : POSTS[n]);
        st.posts[id] = post;
        var p = postSpot(post, c.cx + (n % 2 ? 2 : -2));
        if (id === 'her') ev.push({ type: 'place', x: p.x, z: p.z, face: Math.PI });
        else o.put(id, { x: p.x, z: p.z, face: 0, still: true });
      });
    ```
    (when she runs, `herLane` is null and kids keep `POSTS[n]` as before). Reset `lastLane = null` at the start of `start()`.
  - The instance `fence`: `fence(st.court, guarding(), x, z, st.posts.her)`.
  - `state()`: add `herPost: st.posts.her || null`.
  - Export `LANES`, `pickLane`. Update the file header (she guards a random lane each round, not only the middle).
  - Existing tests that assert `posts.her === 'mid'` (lines ~116 and ~158) must become `P.LANES.includes(...)`; the placement test at ~118 must check the placement against her lane (`pl.x === 39` stays true; `pl.z` is the middle line's centre only if lane is `mid`).
  - In `guardKid` for a kid on `'mid'`: unchanged. Check `threat()`/`lineGuard()` already work with her on a cross line (they read `where('her')`); no change expected, verify with the sim test below.

- [ ] **Step 4: Run** `node --test tests/world3d-patintero.test.js tests/world3d-patintero-sim.test.js` — Expected: PASS. If the sim test fails because a runner can never cross when she is on a cross line, adjust only the test's assumptions (she is a guard of that line), not the kids' logic, unless a kid is stuck forever (then fix and note it).
- [ ] **Step 5: Commit** (owner): `git add web/world/patintero.js tests/world3d-patintero.test.js && git commit -m 'Patintero: she guards a different lane every round' -- web/world/patintero.js tests/world3d-patintero.test.js`

---

### Task 3: Replay recorder (pure)

**Files:** Create `web/world/replay.js`, `tests/world3d-replay.test.js`; modify `tests/paths.js`, `web/world/grade-2.html`, `web/world/grade-5.html`.

- [ ] **Step 1: Failing test** `tests/world3d-replay.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const R = require(worldFile('replay.js'));

test('keeps only the last 2.5 s of frames', () => {
  const r = R.create();
  for (let i = 0; i <= 100; i++) r.push(0.1, { a: { x: i, z: 0, face: 0 } });
  const clip = r.clip();
  assert.ok(clip.length <= 27 && clip.length >= 24, 'about 2.5 s at 0.1 s: ' + clip.length);
  assert.equal(clip[clip.length - 1].a.x, 100);
});

test('sample slows time and interpolates', () => {
  const r = R.create();
  r.push(1, { a: { x: 0, z: 0, face: 0 } });
  r.push(1, { a: { x: 10, z: 0, face: 1 } });
  const clip = r.clip();
  const p = R.sample(clip, 0.5);
  assert.equal(p.a.x, 5);
  assert.equal(R.length(clip), 1);
});

test('player: 2.5 s of footage at 0.3 speed lasts about 8.3 s and can be skipped', () => {
  const r = R.create();
  for (let i = 0; i < 40; i++) r.push(0.1, { a: { x: i, z: 0, face: 0 } });
  const pl = R.player(r.clip(), 0.3);
  let t = 0;
  while (!pl.done() && t < 20) { pl.tick(0.1); t += 0.1; }
  assert.ok(t > 7.5 && t < 9, String(t));
  const q = R.player(r.clip(), 0.3);
  q.skip();
  assert.equal(q.done(), true);
});
```

- [ ] **Step 2: Run** `node --test tests/world3d-replay.test.js` — FAIL (module missing).
- [ ] **Step 3: Implement** `web/world/replay.js` (header comment: "Slow-motion replay of the last seconds of a Patintero tag. No DOM, no Three.js."):

```js
(function (root) {
  'use strict';

  var KEEP = 2.5;

  // Frames are { dt, at: { id: { x, z, face } } } for the last KEEP seconds.
  function create() {
    var frames = [], total = 0;
    function push(dt, at) {
      frames.push({ dt: dt, at: at });
      total += dt;
      while (frames.length > 2 && total - frames[0].dt >= KEEP) total -= frames.shift().dt;
    }
    function clip() { return frames.slice(); }
    function clear() { frames = []; total = 0; }
    return { push: push, clip: clip, clear: clear };
  }

  function length(clip) { return clip.reduce(function (s, f) { return s + f.dt; }, 0); }

  // Positions at t seconds into the clip, between the two frames either side.
  function sample(clip, t) {
    var at = 0, i, a, b, k, out = {};
    for (i = 0; i < clip.length - 1 && at + clip[i + 1].dt < t; i++) at += clip[i + 1].dt;
    a = clip[i];
    b = clip[Math.min(i + 1, clip.length - 1)];
    k = b === a || !b.dt ? 0 : Math.max(0, Math.min(1, (t - at) / b.dt));
    Object.keys(a.at).forEach(function (id) {
      var p = a.at[id], q = b.at[id] || p;
      out[id] = { x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k, face: q.face };
    });
    return out;
  }

  // Plays a clip at speed (0.3 = slow motion): tick(dt) returns the positions to show.
  function player(clip, speed) {
    var t = 0, end = length(clip), over = false;
    return {
      tick: function (dt) { t = Math.min(end, t + dt * speed); if (t >= end) over = true; return sample(clip, t); },
      skip: function () { over = true; },
      done: function () { return over; },
      last: function () { return sample(clip, end); }
    };
  }

  var exported = { KEEP: KEEP, create: create, sample: sample, length: length, player: player };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Replay = exported;
})(this);
```
Fix the first test if `clip.length` bounds do not match the trimming rule (the contract is "about 2.5 s kept"; adjust the bounds, not the 2.5 s).

- [ ] **Step 4: Wire files.** Add `'replay.js'` to `WORLD_FILES` in `tests/paths.js` immediately before `'games3d.js'`; add `<script src="replay.js"></script>` before `games3d.js` in `web/world/grade-2.html` and `grade-5.html`. Run `node tools/update-precache.js`, then `node --test tests/world3d-replay.test.js tests/pwa.test.js tests/world-wiring.test.js`. Expected PASS.
- [ ] **Step 5: Commit** (owner): `git add web/world/replay.js tests/world3d-replay.test.js tests/paths.js web/world/grade-2.html web/world/grade-5.html web/sw.js && git commit -m 'Replay recorder for Patintero tags' -- <the same files>` (use whichever files `update-precache.js` changed).

---

### Task 4: Stamina heart in all three games (and the hide-and-seek thump)

**Files:** Modify `web/world/world-main.js:1311`, `web/world/games3d.js` (`heartbeat`); Test `tests/world3d-games-wiring.test.js`.

- [ ] **Step 1: Failing wiring test** (append)

```js
test('the stamina heart is not paused by a playground game', () => {
  const src = require('node:fs').readFileSync(worldFile('world-main.js'), 'utf8');
  const call = src.slice(src.indexOf('stamina.tick('), src.indexOf('stamina.tick(') + 220);
  assert.ok(!/games\.playing\(\)/.test(call), call);
});
```
- [ ] **Step 2: Run** `node --test tests/world3d-games-wiring.test.js` — FAIL.
- [ ] **Step 3: Implement.**
  - `world-main.js`: in the `stamina.tick(dt, {...})` call remove `, paused: games.playing()`. In `stamina.js` update the header sentence "Free roaming only: a playmate game pauses it" to "Runs in free roaming and in the playground games."
  - `games3d.js`: replace `heartbeat(dt)` with
    ```js
    var HIDE_BEAT = 10;
    // Distance of the one chasing or seeking her, or null when nobody is: tag and Patintero use the danger flag, a hider hears the seeker.
    function chaserDistance(s) {
      if (s.kind === 'hide') {
        if (s.phase === 'count' || !s.seeker) return null;
        var p = cast.where(s.seeker);
        return p && Math.hypot(p.x - her.x, p.z - her.z) <= HIDE_BEAT ? Math.hypot(p.x - her.x, p.z - her.z) : null;
      }
      return s.danger ? s.chaseD : null;
    }
    function heartbeat(dt) {
      var s = state();
      if (!s || s.done) return;
      var d = chaserDistance(s);
      if (d === null) return;
      if ((beatT -= dt) > 0) return;
      o.sfx('heartbeat');
      beatT = 0.35 + 0.05 * d;
    }
    ```
    and call `heartbeat(dt)` after `hud()` in the `game.playing()` branch (already there).
  - Check by simulation (a short `node` script or a test) that a tired walk (speed 9) vs chase 9.6 leaves tag winnable: tired lasts about 4.2 s until the heart is at 0.3 (WALK 1/6 per s from 1). If a chaser starting 8 units away closes to the tag radius 1.8 within that time with her walking straight away, raise nothing — just record in the commit message. Otherwise add `tiredWalk` to `walk.js` speed only while `games.playing()`.
- [ ] **Step 4: Run** `node --test tests/world3d-games-wiring.test.js tests/world3d-stamina.test.js` — PASS.
- [ ] **Step 5: Commit** (owner): `git add web/world/world-main.js web/world/stamina.js web/world/games3d.js tests/world3d-games-wiring.test.js && git commit -m 'Stamina heart now runs in tag, hide-and-seek and Patintero; hide-and-seek thumps when the seeker is close' -- <same files>`

---

### Task 5: Who is playing: roster row and name tags

**Files:** Modify `web/world/games3d.js` (HUD section, `hud()`, `patHud`, `release`), `web/world/world.css`.

- [ ] **Step 1: Add the DOM.** In the HUD section next to `pill`:

```js
    var roster = el('div', 'g-roster');
    roster.setAttribute('aria-label', 'Players');
    doc.body.appendChild(roster);
    roster.hidden = true;
    var rosterKey = '';
```
Add `roster` to the `[pill, hint, count, ...]` hide lists in `hud()`.

- [ ] **Step 2: Build the roster from `state()`.** Add:

```js
    function chip(id, cls) {
      var c = el('span', 'g-chip' + (cls ? ' ' + cls : ''));
      c.appendChild(el('span', 'g-chip-face', id === 'her' ? '🙂' : faceOf(id)));
      c.appendChild(el('span', 'g-chip-name', id === 'her' ? 'You' : nameOf(id)));
      return c;
    }
    // Rebuilt only when the players or the "it" kid change.
    function showRoster(s) {
      var rows;
      if (s.kind === 'patintero') rows = [['blue', s.team.blue], ['red', s.team.red]];
      else rows = [['', ['her'].concat(s.ids)]];
      var key = s.kind + '|' + (s.it || '') + '|' + (s.seeker || '') + '|' + rows.map(function (r) { return r[1].join(','); }).join('/');
      show(roster, true);
      if (key === rosterKey) return;
      rosterKey = key;
      roster.textContent = '';
      rows.forEach(function (r) {
        var row = el('div', 'g-roster-row' + (r[0] ? ' ' + r[0] : ''));
        r[1].forEach(function (id) {
          var mark = (s.kind === 'tag' && s.it === id) || (s.kind === 'hide' && s.seeker === id) ? 'it' : isSis(id) ? 'sis' : '';
          row.appendChild(chip(id, mark));
        });
        roster.appendChild(row);
      });
    }
```
Call `showRoster(s)` at the end of both `hud()` (non-patintero path) and `patHud(s)`. Reset `rosterKey = ''` in `release()`. In hide-and-seek where she seeks, `s.seeker` is null and `s.ids` are the hiders; fine.

- [ ] **Step 3: Name tags.** Using the same sprite technique as the board (`S.sprite(S.label(text, colour), w, h)`):

```js
    var tags = null;
    function makeTags(s) {
      clearTags();
      tags = { group: new THREE.Group(), of: {} };
      s.ids.forEach(function (id) {
        var sp = S.sprite(S.label(nameOf(id), '#ffffff'), 2.4, 2.4 * 180 / 512);
        tags.of[id] = sp;
        tags.group.add(sp);
      });
      S.scene.add(tags.group);
    }
    function moveTags(s) {
      if (!tags) return;
      Object.keys(tags.of).forEach(function (id) {
        var p = cast.where(id), sp = tags.of[id];
        var far = !p || Math.hypot(p.x - her.x, p.z - her.z) > 40 || (s.hidden && s.hidden.indexOf(id) >= 0);
        sp.visible = !far;
        if (!far) sp.position.set(p.x, 6.4, p.z);
      });
    }
    function clearTags() { if (tags) S.scene.remove(tags.group); tags = null; }
```
Call `makeTags(state())` after every `start()` success path (both Patintero and the others), `moveTags(state())` each tick in both playing branches, and `clearTags()` in `release()`. Hide-and-seek: a hidden kid's tag must be hidden (`s.hidden`), so no tag gives their prop away. Her own name is not tagged. Pick the tag height after viewing a screenshot: it must sit just above the head (kid group scale is `SCALE * Avatar.SCALE`; the pop bubble uses y + 5.2, so use 6.4 or lower it to keep clear of pops).

- [ ] **Step 4: CSS** in `world.css`:

```css
.g-roster { position: fixed; top: 52px; left: 50%; transform: translateX(-50%); z-index: 6; display: flex; flex-direction: column; gap: 4px; align-items: center; pointer-events: none; max-width: 94vw; }
.g-roster[hidden] { display: none; }
.g-roster-row { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; padding: 3px 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.85); }
.g-roster-row.blue { box-shadow: 0 0 0 2px #4a8cff; }
.g-roster-row.red { box-shadow: 0 0 0 2px #ff5a5a; }
.g-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: #fff; color: #333; }
.g-chip.it { background: #ffe27a; box-shadow: 0 0 0 2px #ff9e2c; }
.g-chip.sis { background: #ffe0f0; }
```
Check the pill's real position in `world.css` (`.g-pill`) and place the roster directly under it (adjust `top`), and that on a phone width two rows still fit without covering the joystick.
- [ ] **Step 5: Verify** `node tests/e2e/world-e2e.js` (extend the `games` and `patintero` assertions: `debug.state()` gains `roster: roster.hidden ? null : roster.textContent` and the Patintero test expects both team names present, 4+4 chips; tag expects one `.it` chip) — add that to `games3d.js` debug state and assert in `world-e2e.js`.
- [ ] **Step 6: Commit** (owner): `git add web/world/games3d.js web/world/world.css tests/e2e/world-e2e.js && git commit -m 'Playground games: roster row and name tags of the players' -- <same files>`

---

### Task 6: Patintero bibs

**Files:** Modify `web/world/mates3d.js` (`api.group(id)`), `web/world/kin.js` (`player().group()`), `web/world/world-main.js` (pass `herGroup`), `web/world/games3d.js`.

- [ ] **Step 1: Expose the groups.**
  - `mates3d.js` `api`: `group: function (id) { return byId[id] ? byId[id].ch.group : null; },`
  - `kin.js` `player()` return object: `group: function () { return x.ch.group; },`
  - `world-main.js` `W.Games3D.create({...})`: `herGroup: function () { return me ? me.group : null; }` (`me` is her avatar, as in `me.group.position` used near line 1300; confirm the variable in scope at that point).
  - `games3d.js` `cast.group(id)`: `isSis(id) ? sis.group() : M.group(id)`; her: `o.herGroup ? o.herGroup() : null`.
- [ ] **Step 2: Build and wear the bibs** in `games3d.js`:

```js
    var BIBS = { blue: '#4a8cff', red: '#ff5a5a' };
    var bibs = [];
    // A coloured bib over the outfit, a child of the character so it walks, turns and hides with them.
    function wearBibs(s) {
      removeBibs();
      ['blue', 'red'].forEach(function (team) {
        s.team[team].forEach(function (id) {
          var g = id === 'her' ? (o.herGroup && o.herGroup()) : cast.group(id);
          if (!g) return;
          var bib = new THREE.Group();
          S.add(S.cyl(0.62, 0.7, 0.9, 16), BIBS[team], 0, 1.55, 0, bib);
          g.add(bib);
          bibs.push({ g: g, bib: bib });
        });
      });
    }
    function removeBibs() {
      bibs.forEach(function (b) { b.g.remove(b.bib); });
      bibs = [];
    }
```
The numbers are a first guess: render one kid and her with `node tests/e2e/world-e2e.js` plus a headless screenshot (the driver's `#e2e=patintero` mode) and tune the radius and height so the bib sits on the torso, over every body shape, and is visible from the camera. Call `wearBibs(pat.state())` after `makeRings(...)` in `start()` and `removeBibs()` in `release()`. Her bib comes off when the game ends (including ✖ End game, door, quick travel, because all go through `release()`). If her avatar rebuilds (outfit change) while the game plays that cannot happen (she is busy), so no re-attach is needed.
- [ ] **Step 3: Check** the bib does not break `ownMaterials`/`fade` in `mates3d.js`: the kid fade copies materials of the group's meshes at creation, so the bib's materials stay opaque when a kid fades near the camera; that is acceptable (note it). Verify `g.visible = false` for a distant kid hides the bib too (it is a child).
- [ ] **Step 4: Verify** e2e: `debug.state()` gains `bibs: bibs.length`; `world-e2e.js` expects 8 during Patintero (her team 4 + other 4; PAT_KIDS is 7 + her) and 0 after the game ends.
- [ ] **Step 5: Commit** (owner): `git add web/world/mates3d.js web/world/kin.js web/world/world-main.js web/world/games3d.js tests/e2e/world-e2e.js && git commit -m 'Patintero: team-coloured bibs on every player' -- <same files>`

---

### Task 7: Patintero slow-motion replay on every tag

**Files:** Modify `web/world/games3d.js`, `web/world/world-main.js`, `web/world/world.css`.

Design recap: every frame of a Patintero game pushes all positions into the recorder. When `pat.tick` returns a `swap` event, do not `handle` the events yet. Save them (`pending`) and the post-swap positions (`after`: `cast.where` of each kid; her new place comes from the `place` event in `pending`), then play the recorded clip at 0.3 speed while the game logic is paused. When the player is done or skipped, restore `after` and `handle(pending)`.

- [ ] **Step 1: New options.** `world-main.js` `W.Games3D.create({...})` gets:
  - `pose: function (x, z, face) { ctl.teleport(x, z, face); }` (only the avatar; no pet reset, no sparkle).
  - `focus: function (p) { replayFocus = p; }` and in the frame code replace `S.follow(st.x, st.z);` with `S.follow(replayFocus ? replayFocus.x : st.x, replayFocus ? replayFocus.z : st.z);` (declare `var replayFocus = null;` near `gameFreeze`).
  - Confirm `ctl.teleport` does not need the avatar to be unfrozen; `o.freeze(true)` is already on for 'place' events.
- [ ] **Step 2: Record every frame.** In `games3d.js` `var rec = W.Replay.create(), show = null, pending = null;`. In `tick`, in the `pat.playing()` branch, before `pat.tick`:

```js
        if (!replaying) rec.push(dt, snapshot(st));
```
with
```js
    function snapshot(st) {
      var at = { her: { x: st.x, z: st.z, face: st.face } };
      pat.state().ids.forEach(function (id) { var p = cast.where(id); at[id] = { x: p.x, z: p.z, face: p.face || 0 }; });
      return at;
    }
```
(`st.face` exists on the controller state; confirm. The sister's `where` may lack `face`; the `|| 0` covers it.)
- [ ] **Step 3: Start the replay.** In the patintero branch, replace `if (pev.length) handle(pev); else hud();` with:

```js
        if (pev.some(function (e) { return e.type === 'swap'; })) startReplay(pev, st);
        else if (pev.length) handle(pev);
        else hud();
```
and:
```js
    var replaying = null;
    function startReplay(events, st) {
      var clip = rec.clip(), after = {};
      pat.state().ids.forEach(function (id) { after[id] = cast.where(id); });
      var tag = events.filter(function (e) { return e.type === 'swap'; })[0];
      var a = clip[clip.length - 1].at, hit = a[tag.kid] || a.her;
      replaying = { player: W.Replay.player(clip, REPLAY_SPEED), events: events, after: after, hit: hit, t: 0 };
      rec.clear();
      o.sfx('catch');
      o.freeze(true);
      o.focus({ x: hit.x, z: hit.z });
      replayLabel.hidden = replaySkip.hidden = false;
    }
    function replayTick(dt) {
      var r = replaying, at = r.player.tick(dt);
      Object.keys(at).forEach(function (id) {
        if (id === 'her') o.pose(at.her.x, at.her.z, at.her.face);
        else cast.put(id, { x: at[id].x, z: at[id].z, face: at[id].face, still: false });
      });
      moveRings();
      moveTags(pat.state());
      if (r.player.done()) endReplay();
    }
    function endReplay() {
      var r = replaying;
      replaying = null;
      replayLabel.hidden = replaySkip.hidden = true;
      o.focus(null);
      Object.keys(r.after).forEach(function (id) { cast.put(id, { x: r.after[id].x, z: r.after[id].z, face: r.after[id].face, still: true }); });
      handle(r.events);
      moveRings();
      rec.clear();
    }
```
with `REPLAY_SPEED = 0.3` among the constants, and in `tick` before the `pat.playing()` branch: `if (replaying) { replayTick(dt); return; }`. While replaying: she cannot move (frozen), the game clock does not run (no `pat.tick`), and `end()`/`release()` (✖ End game, quick travel) must clean up: in `release()` add `replaying = null; replayLabel.hidden = replaySkip.hidden = true; o.focus(null); rec.clear();`. The kids' walking animation comes from the mind's frames (`mag`/`walkT`); setting positions through `cast.put` with `still: false` may not animate legs. If kids slide without walking, set `mag` through `put` if matemind supports it, otherwise accept sliding poses (note it in the commit) — check visually.
- [ ] **Step 4: Label and skip button.** In the HUD section:

```js
    var replayLabel = el('div', 'g-replay', '🎬 Replay'), replaySkip = button('g-replay-skip', 'Skip ⏭', function () { if (replaying) replaying.player.skip(); });
    [replayLabel, replaySkip].forEach(function (n) { n.hidden = true; doc.body.appendChild(n); });
```
CSS: `.g-replay { position: fixed; top: 96px; left: 50%; transform: translateX(-50%); z-index: 7; padding: 4px 14px; border-radius: 999px; background: rgba(0,0,0,0.65); color: #fff; font-weight: 800; }` `.g-replay-skip { position: fixed; right: 16px; bottom: 120px; z-index: 7; ... }` `[hidden]` rules for both. The label text is English both grades ("Tagged!" feel): use `'🎬 Replay'` literal; check `tests/world-english-first.test.js` does not flag it.
- [ ] **Step 5: e2e.** In `world-driver.page.js` the `patintero` mode: after the guard tags her, `D.games.state()` must show `replay: true` for ~8 s of game time (add `replay: !!replaying` to the debug state), the clock `left` must not drop while it plays, and after the skip (`debug.skipReplay`, add `replaySkip.click()` as a debug function) the swap hint appears and she is placed. Update `world-e2e.js` accordingly (the existing assertions at 332-352 expect the swap right after the tag: insert a skip call first).
- [ ] **Step 6: Commit** (owner): `git add web/world/games3d.js web/world/world-main.js web/world/world.css tests/e2e/world-e2e.js tests/e2e/world-driver.page.js && git commit -m 'Patintero: slow-motion replay of every tag with a skip button' -- <same files>`

---

### Task 8: Lane hint, pill and her lane on the court

**Files:** Modify `web/world/mategame.js` (`TEXT.patGuard...`), `web/world/games3d.js` (`patHud`, `handle` swap).

- [ ] **Step 1: Text.** In `mategame.js` add, for `grade5` and `grade2` beside `patGuard`:
  - grade5: `patLane: { mid: '🛡️ Guard the middle line! Tag a runner!', c0: '🛡️ Guard the 1st line! Tag a runner!', c1: '🛡️ Guard the 2nd line! Tag a runner!', c2: '🛡️ Guard the 3rd line! Tag a runner!' }`
  - grade2: `pair(...)` of the same with Filipino `Bantayan ang gitnang guhit! Tayain ang tatakbo!`, `Bantayan ang unang guhit! ...`, `... ang ikalawang guhit! ...`, `... ang ikatlong guhit! ...` (same Filipino wording style as the existing `patGuard`).
  Keep `patGuard` for old callers or remove it and update tests that reference it (`tests/world3d-mategame.test.js:337-347` checks Patintero texts: extend them to cover `patLane` in both grades).
- [ ] **Step 2: Use it.** In `patHud` replace `s.running ? LT.patRun : LT.patGuard` with `s.running ? LT.patRun : LT.patLane[s.herPost]`. In the swap handler, when `e.herTeam === 'tagged'` the hint is `LT.patTagged`; after the replay, the next frame shows the lane hint because `hintT` expires — set `hintT = HINT_TIME` only for the swap text (as now). Also show the lane on the pill: `'🏃 Patintero …'` is unchanged.
- [ ] **Step 3: Test** `node --test` for the texts (both grades; no leftover `middle` assumption in `world-english-first.test.js`), then `node tests/e2e/world-e2e.js` (update the e2e expectation that the guarding hint says "middle line": it now matches `/^🛡️ Guard the (middle|1st|2nd|3rd) line! Tag a runner!$/`).
- [ ] **Step 4: Commit** (owner): `git add web/world/mategame.js web/world/games3d.js tests/ && git commit -m 'Patintero: the hint names her lane' -- <same files>`

---

### Task 9: Docs and final verification

- [ ] **Step 1: Docs.** In `docs/HANDOFF.md` update: the HUD tidy-up bullet ("a playmate game pauses it" → stamina runs in games), the Playground games bullet (tag switch rule, Patintero bibs, replay, rotating lane, roster and name tags), and add "Playground games polish tablet check pending" to the owner's pending list. Update the "Updated" date.
- [ ] **Step 2: Full run.** `node --test` (all pass), `node tests/e2e/world-e2e.js` (pass; the owner's CLAUDE.md requires it for 3D world changes), `node tools/update-precache.js` then `node --test tests/pwa.test.js`.
- [ ] **Step 3: Final review** with `superpowers:requesting-code-review` over the whole diff.
- [ ] **Step 4: Commit** (owner): `git add docs/HANDOFF.md && git commit -m 'Docs: playground games polish' -- docs/HANDOFF.md`

---

## Self-review

- Spec 1 (stamina): Task 4. Spec 2 (roster + tags): Task 5. Spec 3 (tag switch): Task 1. Spec 4 (bibs, replay, lanes): Tasks 6, 7, 2, 8. Docs/tests: Task 9.
- Names consistent across tasks: `LANES`, `pickLane`, `herPost`, `Replay.create/sample/length/player`, `backOnHer`, `o.pose`, `o.focus`, `o.herGroup`, `M.group`, `cast.group`.
- Known judgement calls to confirm while building (not placeholders): bib and name-tag sizes are tuned from a screenshot; replay leg animation depends on `matemind` (accept sliding if it cannot walk-animate); the tired-walk speed fallback is only added if the simulation in Task 4 shows tag becomes unwinnable.
