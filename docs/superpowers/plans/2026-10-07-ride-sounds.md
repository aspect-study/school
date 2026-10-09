# Wardrobe 3c: Ride Sounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playground rides make sounds that follow the motion (start, slide whoosh, swing creaks, see-saw thumps, merry-go-round spin-up and slow-down, landing), and stall buys ring the lobby's cash register.

**Architecture:** `rides.js` gets a pure cue table worked out from the ride maths and `cues(id, from, to)`; `play.js` reports the cues it passes each frame through a new optional `o.cue(name)` hook (and drops its start chime); `world-main.js` plays each cue with the 3b engine `sfx` and swaps the stall buy chime for `Fx.purchase()`. 6 new clips are made by the existing `tools/world-sounds.js`.

**Tech Stack:** Plain ES5 browser scripts (IIFE, `root.World3D`), Web Audio via `web/world/sfx.js`, Node's built-in test runner (`node --test`), headless Chrome e2e (`node tests/e2e/world-e2e.js`), `ffmpeg-static` (temporary, never in the repo).

**Spec:** `docs/superpowers/specs/2026-10-07-ride-sounds-design.md`

---

## Ground rules for every task

- **Never run `git commit`.** The user commits. Each task ends by **staging** its files with `git add` (listed in the task). No `Co-Authored-By` lines anywhere.
- Match the surrounding code: ES5 in `web/` (`var`, `function`), 2-space indent, single quotes, comments only where something is not obvious, no fully-qualified names. Lines stay under ~120 characters.
- A new file under `web/` changes `web/sw.js` PRECACHE: run `node tools/update-precache.js` in the same task (`tests/pwa.test.js` fails otherwise).
- After each task: `node --test` (from the repo root) must pass, all of it. Task 3 also runs `node tests/e2e/world-e2e.js`.

## File map

| File | Change |
|---|---|
| `web/world/rides.js` | `CUES` table + `cues(id, from, to)` |
| `tools/world-sounds.js` | 6 more picks |
| `web/assets/sounds/world/` | 6 new mp3s (56 in all) |
| `web/world/sfx.js` | 7 more `SOUNDS` keys |
| `web/world/play.js` | reports cues via `o.cue`; no start chime |
| `web/world/world-main.js` | passes `cue` to `W.Play.create`; stall buy → `sound('purchase')` |
| `web/sw.js` | regenerated |
| `tests/world3d-rides.test.js`, `tests/world3d-sfx.test.js`, `tests/world3d-sfx-wiring.test.js`, `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js` | tests |

---

### Task 1: Ride cues in `rides.js`

**Files:**
- Modify: `web/world/rides.js` (after `fade`, and the `exported` line)
- Modify: `tests/world3d-rides.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/world3d-rides.test.js`:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-rides.test.js`
Expected: the 2 new tests FAIL (`R.CUES` is undefined).

- [ ] **Step 3: Add the cues**

In `web/world/rides.js`, after the line `function fade(k) { return k < 0.8 ? 1 : Math.max(0, (1 - k) / 0.2); }` add:

```js

  // Each ride's sound moments at k (world-main.js plays them through sfx.js): the slide starts down at 0.25, a swing
  // passes the bottom where sin(4πk) is 0, a see-saw side touches down at its extremes, the merry-go-round slows at 0.7.
  var CUES = {
    slide: [[0, 'ride-start'], [0.25, 'slide-go'], [1, 'ride-land']],
    swings: [[0, 'ride-start'], [0.25, 'swing'], [0.5, 'swing'], [0.75, 'swing'], [1, 'ride-land']],
    seesaw: [[0, 'ride-start'], [1 / 12, 'seesaw-bump'], [4 / 12, 'seesaw-bump'], [7 / 12, 'seesaw-bump'], [10 / 12, 'seesaw-bump'], [1, 'ride-land']],
    merry: [[0, 'ride-start'], [0, 'merry-start'], [0.7, 'merry-slow'], [1, 'ride-land']]
  };

  // The cue names a ride passes after k = from and up to k = to, in order; play.js starts with from = -1.
  function cues(id, from, to) {
    var list = Object.prototype.hasOwnProperty.call(CUES, id) ? CUES[id] : [];
    return list.filter(function (c) { return c[0] > from && c[0] <= to; }).map(function (c) { return c[1]; });
  }
```

Then change the export line

```js
  var exported = { RIDES: RIDES, RAMP: RAMP, part: part, pose: pose };
```

to

```js
  var exported = { RIDES: RIDES, RAMP: RAMP, CUES: CUES, part: part, pose: pose, cues: cues };
```

- [ ] **Step 4: Run the rides tests, then everything**

Run: `node --test tests/world3d-rides.test.js` → all PASS.
Run: `node --test` → all pass.

- [ ] **Step 5: Stage (do not commit)**

```bash
git add web/world/rides.js tests/world3d-rides.test.js
```

---

### Task 2: The 6 ride clips and their `SOUNDS` keys

**Files:**
- Modify: `tools/world-sounds.js` (`PICKS`, header comment)
- Create: 6 files in `web/assets/sounds/world/` (generated)
- Modify: `web/world/sfx.js` (`SOUNDS`)
- Modify: `tests/world3d-sfx.test.js`
- Modify: `web/sw.js` (generated)

- [ ] **Step 1: Update the sfx tests**

In `tests/world3d-sfx.test.js`, change `assert.equal(Sfx.FILES.length, 50);` to `assert.equal(Sfx.FILES.length, 56);`, and append:

```js
test('every ride cue has a sound', () => {
  const Rides = require(worldFile('rides.js'));
  for (const id of Object.keys(Rides.CUES)) {
    for (const [, name] of Rides.CUES[id]) assert.ok(Sfx.SOUNDS[name] && !Sfx.SOUNDS[name].files, id + ': ' + name);
  }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-sfx.test.js`
Expected: FAIL (`FILES.length` is 50; `ride-start` is not a sound).

- [ ] **Step 3: Add the picks to the tool**

In `tools/world-sounds.js`:
- change the first comment line's `for wardrobe 3b` to `for wardrobe 3b and 3c`, and the spec reference line to `// (docs/superpowers/specs/2026-10-07-world-sounds-design.md and 2026-10-07-ride-sounds-design.md). Each clip is cut to the part she heard, sped up the way` (keep the rest of the comment; rewrap so lines stay under ~120 characters);
- in `PICKS`, after the `'emote-hero.mp3'` entry (add a comma after it), add:

```js
  'ride-start.mp3': { mixkit: 2043, name: 'Player jumping in a video game' },
  'swing.mp3': { kenney: 'rpg', entry: 'Audio/creak2.ogg' },
  'seesaw-bump.mp3': { kenney: 'impact', entry: 'Audio/impactWood_light_000.ogg' },
  'merry-start.mp3': { mixkit: 2649, name: 'Spinning magic sound' },
  'merry-slow.mp3': { mixkit: 2822, name: 'Clockwork mechanism sound' },
  'ride-land.mp3': { mixkit: 2070, name: 'Light impact on the ground' }
```

- [ ] **Step 4: Run the tool**

A temporary ffmpeg is already installed outside the repo at
`C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN-IdeaProjects-school\75c2a392-7db2-4251-822f-f8999a714b8f\scratchpad\ff\node_modules\ffmpeg-static\ffmpeg.exe`
(if it is gone: `npm i --prefix "<any scratch folder>/ff" ffmpeg-static --no-audit --no-fund`).

```bash
node tools/world-sounds.js "<path to ffmpeg.exe>"
ls web/assets/sounds/world | wc -l
git status --short web/assets/sounds/world
```

Expected: `56 files, … KB in all`; `56`; the status lists the 6 new files as untracked (`??`). The tool rewrites all 56 files; re-encoding the same sources should give the same bytes. If any of the 50 older files show as modified (` M`), put them back with `git checkout -- web/assets/sounds/world/<file>` (this restores the staged or committed version) so only the 6 new files change, and report it.

- [ ] **Step 5: Add the keys to `sfx.js`**

In `web/world/sfx.js` `SOUNDS`, change the last entry `'emote-hero': act('emote-hero.mp3')` to:

```js
    'emote-hero': act('emote-hero.mp3'),
    'ride-start': play('ride-start.mp3'),
    'slide-go': play('emote-cartwheel.mp3'),
    swing: clip('swing.mp3', 0.4),
    'seesaw-bump': play('seesaw-bump.mp3'),
    'merry-start': play('merry-start.mp3'),
    'merry-slow': play('merry-slow.mp3'),
    'ride-land': play('ride-land.mp3')
```

(`play(file)` is the existing helper in `sfx.js` for gain 0.5; `clip(file, gain)` sets its own gain.) Also change the header comment's first sentence `her footsteps, her pet's voice and play, her props' ✨ Use and her emotes.` to `her footsteps, her pet's voice and play, her props' ✨ Use, her emotes and the playground rides.` and rewrap if a line passes ~120 characters.

- [ ] **Step 6: Precache and run all tests**

```bash
node tools/update-precache.js
node --test
```

Expected: all pass (`world3d-sfx.test.js` sees 56 files, all used; every cue has a sound; `pwa.test.js` sees the new files precached).

- [ ] **Step 7: Stage (do not commit)**

```bash
git add tools/world-sounds.js web/assets/sounds/world web/world/sfx.js tests/world3d-sfx.test.js web/sw.js
```

---

### Task 3: `play.js` reports cues; `world-main.js` plays them; stall cha-ching; e2e

**Files:**
- Modify: `web/world/play.js`
- Modify: `web/world/world-main.js` (the `W.Play.create` line ~175; the stall `onBought` ~262)
- Modify: `tests/world3d-sfx-wiring.test.js` (append)
- Modify: `tests/e2e/world-driver.page.js` (the `family` mode block that rides the swings), `tests/e2e/world-e2e.js` (after the `fam.rodeDone` assertion)

- [ ] **Step 1: Write the failing wiring test**

Append to `tests/world3d-sfx-wiring.test.js`:

```js
test('rides report their sound cues; stall buys ring the cash register', () => {
  const p = read('play.js');
  assert.ok(!p.includes('o.sound('), 'the ride start chime is gone');
  assert.ok(p.includes('R.cues('), 'play.js reports the ride cues');
  const w = read('world-main.js');
  assert.ok(w.includes('cue: function (name) { sfx.play(name); }'), 'world-main plays them');
  assert.ok(/onBought:[\s\S]*?sound\('purchase'\)[\s\S]*?onClose:/.test(w), 'a stall buy rings the cash register');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-sfx-wiring.test.js`
Expected: the new test FAILS.

- [ ] **Step 3: `play.js` reports cues**

Replace the body of `web/world/play.js` from the `// o = …` comment through the end of `tick` with:

```js
  // o = { grade, built, ctl, busy(on), cue(name) (optional: each sound moment the ride passes, Rides.cues) }
  function create(o) {
    var R = W.Rides, pr = W.Layout.props(o.grade), ends = {}, ride = null;
    W.Layout.rideSpots(o.grade).forEach(function (s) { ends[s.id] = s.end; });

    function cue(id, from, to) {
      if (o.cue) R.cues(id, from, to).forEach(function (name) { o.cue(name); });
    }

    function start(id) {
      if (ride || !R.RIDES[id]) return;
      ride = { id: id, t: 0 };
      o.busy(true);
      cue(id, -1, 0);
    }

    // Each frame: her pose while she rides, or null. The last frame puts her down at the ride's end spot.
    function tick(dt) {
      if (!ride) return null;
      var id = ride.id, time = R.RIDES[id].time, from = Math.min(1, ride.t / time);
      ride.t += dt;
      var k = Math.min(1, ride.t / time), p = R.pose(pr, id, k);
      cue(id, from, k);
      o.built.ride(id, k);
      if (k >= 1) {
        o.built.ride(id, null);
        ride = null;
        o.ctl.teleport(ends[id].x, ends[id].z, ends[id].face);
        o.busy(false);
      }
      return p;
    }
```

(The `return { start, tick, riding }` line and the rest of the file stay as they are.)

- [ ] **Step 4: `world-main.js` plays cues and rings the cash register**

(a) Change

```js
    var play = W.Play.create({ grade: grade, built: world, ctl: ctl, busy: busy, sound: sound });
```

to

```js
    var play = W.Play.create({ grade: grade, built: world, ctl: ctl, busy: busy, cue: function (name) { sfx.play(name); } });
```

(b) In `openStall`'s `onBought`, change

```js
          world.sparkle(ctl.state.x, ctl.state.z);
          sound('allRead');
        },
        onClose: function () {
```

to

```js
          world.sparkle(ctl.state.x, ctl.state.z);
          sound('purchase');
        },
        onClose: function () {
```

- [ ] **Step 5: Run the unit tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 6: e2e: the swings ride logs its sounds**

(a) In `tests/e2e/world-driver.page.js`, in the `family` mode block, right after the line `o.rodeDone = D.riding();` add:

```js
      o.rideSounds = D.sfxLog().map(function (l) { return l.key; }).filter(function (k) { return /^(ride-|swing$)/.test(k); });
```

(b) In `tests/e2e/world-e2e.js`, right after `assert.equal(fam.rodeDone, null, 'the ride ends by itself');` add:

```js
  assert.deepEqual(fam.rideSounds, ['ride-start', 'swing', 'swing', 'swing', 'ride-land'], 'the swings ride asks for its sounds');
```

(Clips are not copied into the e2e site and audio is locked without a real tap, so every sound is logged as `locked`; the log still proves each cue reached the engine once, in order.)

- [ ] **Step 7: Run the world e2e**

Run: `node tests/e2e/world-e2e.js`
Expected: every case prints `ok …` (including `ok sister cheers, a ride, the 10-minute nudge`), exit 0.

If `rideSounds` has extra or missing entries: check that `play.js` computes `from` before adding `dt`, and that the sfx log (last 30 entries) was not flooded by other sounds during the ride.

- [ ] **Step 8: Stage (do not commit)**

```bash
git add web/world/play.js web/world/world-main.js tests/world3d-sfx-wiring.test.js tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 4: Final check

- [ ] **Step 1: Everything passes**

```bash
node --test
node tests/e2e/world-e2e.js
node tests/e2e/sisters-e2e.js
```

Expected: all pass.

- [ ] **Step 2: Hand over**

Nothing is committed by the agent. Give the user one `git add … && git commit -m "…" -- <files>` command covering every staged file, plus the tablet-check list from the spec.

---

## Self-review notes

- Spec coverage: picks + 6 files + 7 keys (Task 2); `CUES`/`cues` with frame-safe semantics (Task 1); `play.js` cue hook, start chime removed (Task 3); `world-main` cue → `sfx.play`, stall `sound('purchase')` (Task 3); tests: cue timing, ties to the maths, 56 files, cue→sound, wiring, e2e ride log (Tasks 1-3).
- Names: `Rides.CUES`, `Rides.cues(id, from, to)`, `o.cue(name)`, sound keys `ride-start`, `slide-go`, `swing`, `seesaw-bump`, `merry-start`, `merry-slow`, `ride-land`.
