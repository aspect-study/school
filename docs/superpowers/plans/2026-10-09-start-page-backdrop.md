# Start page backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules that override defaults:** never run `git commit` (give the owner the one-block `git add <files> && git commit -m '...' -- <files>` command), never add `Co-Authored-By` or any AI attribution, browser JS is ES5 inside `(function (root) {...})(this)`, comments only for non-obvious code, never use fully-qualified class names inline.

**Goal:** The start page (`web/index.html`) shows the real 3D Play World behind its buttons: a slow camera, playground kids walking the paths and pets trotting after them, in a random town (Campus or Bayan) each visit.

**Architecture:** A standalone page `web/world/backdrop.html` loads only the scripts that draw a town and its kids (no learner, storage, wallet or sync) and is shown by `index.html` in a full-screen, click-through iframe that loads after the page's `load` event and fades in on a `backdrop-ready` message. Pure logic (grade pick, camera, pet follow, slow-frame watch, mode) lives in `backdrop-core.js` so `node --test` can cover it; `backdrop.js` is the Three.js side. Any failure posts `backdrop-failed` and the parent removes the iframe, leaving today's cream page.

**Tech Stack:** Plain ES5 JS, Three.js r149 (`web/vendor/three`), existing `World3D.*` modules, `node --test`, headless-Chrome e2e scripts.

**Spec:** `docs/superpowers/specs/2026-10-09-start-page-backdrop-design.md`. Two refinements made while planning (the spec is updated to match): the camera orbits the kid it is following and hands over to the next kid every 25 s (an orbit around the Plaza would rarely show the kids, who roam the whole map), and the legibility treatment is a translucent panel behind `<main>` instead of a title pill (every view of the start page sits on the backdrop, not only the title).

---

## File structure

- Create `web/world/backdrop-core.js`: pure helpers (`pickGrade`, `mode`, `viewOf`, `ease`, `petSpot`, `stepPet`, `slowWatch`, `PET_IDS`, constants). Works in Node (`module.exports`) and the browser (`World3D.BackdropCore`).
- Create `web/world/backdrop.js`: builds the scene and runs the frame loop; posts `backdrop-ready` / `backdrop-failed` to the parent; sets `window.__backdrop` (debug: `{ state, frames, grade }`).
- Create `web/world/backdrop.html`: the iframe page, loads the scripts in order.
- Modify `web/index.html`: iframe, veil, panel CSS, loader script.
- Modify `tests/paths.js`: add `BACKDROP_FILES`, `BACKDROP_PAGE`.
- Create `tests/world3d-backdrop.test.js`: unit tests for the core.
- Create `tests/backdrop-wiring.test.js`: page wiring, script order, precache.
- Create `tests/e2e/backdrop-e2e.js`: headless-Chrome check.
- Modify `README.md` (e2e list) and `docs/HANDOFF.md`.
- Modify `web/sw.js` via `node tools/update-precache.js`.

---

### Task 1: Paths and the pure core

**Files:**
- Modify: `tests/paths.js`
- Create: `web/world/backdrop-core.js`
- Test: `tests/world3d-backdrop.test.js`

- [ ] **Step 1: Add the paths**

In `tests/paths.js`, after the `WORLD_FILES` line add:

```js
// The start page's animated backdrop (a standalone page in web/world, loaded in an iframe by web/index.html).
const BACKDROP_PAGE = 'world/backdrop.html';
const BACKDROP_FILES = ['text.js', 'layout.js', 'items.js', 'pets.js', 'moves.js', 'look.js', 'rides.js', 'wear.js', 'mates.js', 'mateboard.js', 'matemind.js', 'scene.js', 'build.js', 'petbody.js', 'avatar.js', 'backdrop-core.js', 'backdrop.js'];
```

and add `BACKDROP_PAGE, BACKDROP_FILES` to the `module.exports` list.

- [ ] **Step 2: Write the failing tests**

Create `tests/world3d-backdrop.test.js`:

```js
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
  const r = C.stepPet(pet, { x: 0, z: 100 }, 1);
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/world3d-backdrop.test.js`
Expected: FAIL, `Cannot find module '.../backdrop-core.js'`.

- [ ] **Step 4: Write the core**

Create `web/world/backdrop-core.js`:

```js
/* The start page backdrop's pure helpers: which town, whether to draw at all, where the camera and the pets go, and
   when frames are too slow to keep going. Used by backdrop.js; kept apart so node --test can run it. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;

  var RADIUS = 18, HEIGHT = 11, ORBIT_SPEED = 0.12, LOOK_Y = 3;
  var PET_IDS = ['chick', 'kitten', 'puppy', 'kitten'];
  var PET_SPEED = 5, PET_STOP = 0.3, PET_JUMP = 30, PET_BEHIND = 2.4, PET_SIDE = 1.3;
  var SLOW_FRAME = 1 / 15, SLOW_SECONDS = 3;

  function pickGrade(rand) { return rand() < 0.5 ? 'grade5' : 'grade2'; }

  // env = { webgl, reduced }
  function mode(env) {
    if (!env.webgl) return 'off';
    return env.reduced ? 'still' : 'run';
  }

  function viewOf(focus, t) {
    var a = t * ORBIT_SPEED;
    return { x: focus.x + Math.sin(a) * RADIUS, y: HEIGHT, z: focus.z + Math.cos(a) * RADIUS, lookY: LOOK_Y };
  }

  function ease(cur, target, dt, rate) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

  // Behind the kid (who faces face, 0 = +z), on alternating sides by i.
  function petSpot(kid, i) {
    var side = i % 2 ? 1 : -1, s = Math.sin(kid.face), c = Math.cos(kid.face);
    return { x: kid.x - s * PET_BEHIND + c * PET_SIDE * side, z: kid.z - c * PET_BEHIND - s * PET_SIDE * side };
  }

  // Moves pet ({ x, z, face }) toward spot; one left far behind (a kid taking a long path) pops in beside it.
  function stepPet(pet, spot, dt) {
    var dx = spot.x - pet.x, dz = spot.z - pet.z, d = Math.hypot(dx, dz);
    if (d > PET_JUMP) {
      pet.x = spot.x;
      pet.z = spot.z;
      return { moving: false };
    }
    if (d <= PET_STOP) {
      pet.x = spot.x;
      pet.z = spot.z;
      return { moving: false };
    }
    var step = Math.min(d, PET_SPEED * dt);
    pet.x += dx / d * step;
    pet.z += dz / d * step;
    pet.face = Math.atan2(dx, dz);
    return { moving: true };
  }

  // push(frameSeconds) is true once the frames of the last SLOW_SECONDS were on average slower than SLOW_FRAME.
  function slowWatch() {
    var time = 0, frames = 0;
    return {
      push: function (dt) {
        time += dt;
        frames++;
        if (time < SLOW_SECONDS) return false;
        var slow = time / frames > SLOW_FRAME;
        time = 0;
        frames = 0;
        return slow;
      }
    };
  }

  var exported = {
    RADIUS: RADIUS, HEIGHT: HEIGHT, PET_IDS: PET_IDS, PET_SPEED: PET_SPEED, SLOW_SECONDS: SLOW_SECONDS,
    pickGrade: pickGrade, mode: mode, viewOf: viewOf, ease: ease, petSpot: petSpot, stepPet: stepPet, slowWatch: slowWatch
  };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.BackdropCore = exported;
})(this);
```

Note: the "jump" branch and the "within PET_STOP" branch are deliberately separate so the far-behind case is obvious; do not merge them.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/world3d-backdrop.test.js`
Expected: PASS (9 tests). If `stepPet` "stops there" fails on `near.x`, check the `d <= PET_STOP` branch sets x/z to the spot.

- [ ] **Step 6: Suggested commit (owner runs it)**

```bash
git add tests/paths.js web/world/backdrop-core.js tests/world3d-backdrop.test.js && git commit -m 'Start page backdrop: pure core (town pick, mode, camera orbit, pet follow, slow-frame watch) with tests' -- tests/paths.js web/world/backdrop-core.js tests/world3d-backdrop.test.js
```

---

### Task 2: The backdrop page and scene

**Files:**
- Create: `web/world/backdrop.html`
- Create: `web/world/backdrop.js`
- Test: `tests/backdrop-wiring.test.js`

- [ ] **Step 1: Write the failing wiring test**

Create `tests/backdrop-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { WEB, BACKDROP_PAGE, BACKDROP_FILES, VENDOR_FILES, web } = require('./paths.js');

const ORDER = VENDOR_FILES.map((f) => '../' + f).concat(BACKDROP_FILES);

test('backdrop page loads its scripts in order, with no learner or storage code', () => {
  const html = fs.readFileSync(web(BACKDROP_PAGE), 'utf8');
  assert.match(html.slice(0, 1024), /<meta charset="utf-8">/i);
  assert.deepEqual([...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]), ORDER);
  assert.ok(!/engine\//.test(html), 'no engine files: the backdrop reads and writes nothing');
  assert.ok(html.includes('id="stage"'));
});

test('every backdrop script is a file in web/world, case included', () => {
  for (const f of BACKDROP_FILES) assert.ok(fs.readdirSync(path.join(WEB, 'world')).includes(f), f);
});

test('the backdrop never touches saved data', () => {
  for (const f of ['backdrop.js', 'backdrop-core.js']) {
    const src = fs.readFileSync(path.join(WEB, 'world', f), 'utf8');
    assert.ok(!/localStorage|sessionStorage|Learner|Wallet|StudyHistory/.test(src), f);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/backdrop-wiring.test.js`
Expected: FAIL (page missing).

- [ ] **Step 3: Write the page**

Create `web/world/backdrop.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Study Games backdrop</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #d6ecff; }
  #stage { position: fixed; inset: 0; }
  #stage canvas { display: block; }
</style>
</head>
<body>
<div id="stage"></div>
<script src="../vendor/three/three.min.js"></script>
<script src="../vendor/three/rounded-box.js"></script>
<script src="text.js"></script>
<script src="layout.js"></script>
<script src="items.js"></script>
<script src="pets.js"></script>
<script src="moves.js"></script>
<script src="look.js"></script>
<script src="rides.js"></script>
<script src="wear.js"></script>
<script src="mates.js"></script>
<script src="mateboard.js"></script>
<script src="matemind.js"></script>
<script src="scene.js"></script>
<script src="build.js"></script>
<script src="petbody.js"></script>
<script src="avatar.js"></script>
<script src="backdrop-core.js"></script>
<script src="backdrop.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write the scene**

Create `web/world/backdrop.js`:

```js
/* The start page backdrop: a random town (Campus or Bayan) with the playground kids walking its paths and pets trotting
   after them, seen by a slow camera that circles one kid at a time. Purely visual: it reads and writes no saved data.
   Tells the page that shows it (web/index.html) when it is drawing (backdrop-ready) or cannot (backdrop-failed), and
   window.__backdrop is for the e2e driver. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var doc = root.document, C = W.BackdropCore;
  var FRAME = 1 / 30, STILL_SECONDS = 6, FOCUS_EVERY = 25, FAR = 1e4;
  var debug = root.__backdrop = { state: 'start', frames: 0, grade: '' };

  function tell(message) {
    debug.state = message === 'backdrop-ready' ? 'ready' : 'failed';
    try { root.parent.postMessage(message, '*'); } catch (e) {}
  }

  function webgl() {
    if (!root.THREE || !root.THREE.RoundedBoxGeometry) return false;
    try {
      var c = doc.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  function reduced() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function start() {
    var kind = C.mode({ webgl: webgl(), reduced: reduced() });
    if (kind === 'off') return tell('backdrop-failed');

    var L = W.Layout, grade = C.pickGrade(Math.random), T = W.Text.localized(grade, false);
    debug.grade = grade;
    var S = W.Scene.create(doc.getElementById('stage'), 'low');
    var world = W.Build.build(S, grade, T);
    var obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds, ends = {};
    L.rideSpots(grade).forEach(function (s) { ends[s.id] = s.end; });

    var list = W.Mates.all(Math.random);
    var mind = W.MateMind.create({
      pr: L.props(grade), ends: ends, boards: L.rideSpots(grade), area: L.places(grade).playground, rand: Math.random,
      kids: list.map(function (m) { return { id: m.id, fav: m.fav, racer: m.id === 'tomas' }; }), ways: L.walkways(grade),
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r); }
    });
    var kids = list.map(function (m) {
      var ch = W.Avatar.character(S, W.Pets.wearable(W.Items.wearable(m.look, null), null));
      ch.group.scale.setScalar(0.92 * W.Avatar.SCALE);
      S.scene.add(ch.group);
      return ch;
    });
    var pets = C.PET_IDS.map(function (id, i) {
      var body = W.PetBody.build(S, W.Pets.wearable({ pet: id, petColor: i }, null));
      S.scene.add(body.group);
      return { body: body, state: { x: 0, z: 0, face: 0 }, owner: i, placed: false };
    });

    var frames = [], t = 0, focus = { x: 0, z: 0 }, focusIdx = 0, focusT = 0, placed = false;
    var watch = C.slowWatch(), clock = 0;

    function step(dt) {
      t += dt;
      mind.tick(dt, { x: FAR, z: FAR, now: null });
      frames = mind.frames();
      var parts = mind.parts();
      Object.keys(parts).forEach(function (p) { world.ride(p, parts[p]); });
      frames.forEach(function (f, n) {
        var g = kids[n].group;
        g.visible = !f.hidden;
        g.position.set(f.x, f.y, f.z);
        g.rotation.y = f.face;
        kids[n].animate(t, f.walkT, f.mag, f.ride ? { ride: true, sit: f.sit, cheer: f.cheer } : { wave: f.wave, cheer: f.cheer });
      });
      pets.forEach(function (p, i) {
        var owner = frames[p.owner], spot = C.petSpot(owner, i);
        if (!p.placed) {
          p.state.x = spot.x;
          p.state.z = spot.z;
          p.placed = true;
        }
        var r = C.stepPet(p.state, spot, dt);
        p.body.group.position.set(p.state.x, 0, p.state.z);
        p.body.group.rotation.y = p.state.face;
        p.body.animate(t, r.moving ? 'walk' : 'idle');
      });
      world.animate(t, dt, null);
    }

    function aim(dt) {
      focusT += dt;
      if (focusT >= FOCUS_EVERY) {
        focusT = 0;
        focusIdx = (focusIdx + 1) % frames.length;
      }
      var k = frames[focusIdx];
      focus.x = placed ? C.ease(focus.x, k.x, dt, 1.5) : k.x;
      focus.z = placed ? C.ease(focus.z, k.z, dt, 1.5) : k.z;
      placed = true;
      var v = C.viewOf(focus, t);
      S.camera.position.set(v.x, v.y, v.z);
      S.camera.lookAt(focus.x, v.lookY, focus.z);
      S.follow(focus.x, focus.z);
    }

    function draw(dt) {
      aim(dt);
      S.render();
      debug.frames++;
    }

    var canvas = S.renderer.domElement, stopped = false;
    function giveUp() {
      stopped = true;
      tell('backdrop-failed');
    }
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      giveUp();
    });

    for (var i = 0; i < 20; i++) step(0.1);
    if (kind === 'still') {
      for (i = 0; i < STILL_SECONDS * 10; i++) step(0.1);
      draw(0.1);
      return tell('backdrop-ready');
    }

    var last = null, acc = 0, told = false;
    function frame(now) {
      if (stopped) return;
      root.requestAnimationFrame(frame);
      if (last === null) last = now;
      acc += Math.min(0.1, (now - last) / 1000);
      var real = (now - last) / 1000;
      last = now;
      if (acc < FRAME) return;
      var dt = acc;
      acc = 0;
      step(dt);
      draw(dt);
      if (!told) {
        told = true;
        tell('backdrop-ready');
      }
      clock += real;
      if (watch.push(Math.min(real, 1)) && clock > 0) giveUp();
    }
    root.requestAnimationFrame(frame);
  }

  try {
    start();
  } catch (e) {
    tell('backdrop-failed');
  }
})(this);
```

Notes for the implementer: `S.render()` is `renderer.render(scene, camera)`. `Scene.create` calls `setQuality('low')`, which turns shadows off and hides the `detail` group. If the browser throws in `start()` because a module the page did not load is missing (check the console in Step 6), add that script to `backdrop.html` and to `BACKDROP_FILES` in `tests/paths.js`, in dependency order.

- [ ] **Step 5: Run the wiring test**

Run: `node --test tests/backdrop-wiring.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Look at it in a real browser**

Run: `node tools/serve.js` if the repo has one, otherwise open `web/world/backdrop.html` through any static server rooted at `web/` (for example `npx serve web`), then open `/world/backdrop.html` in Chrome with the console open.
Expected: a town with kids walking and pets following, no console errors, `window.__backdrop` is `{ state: 'ready', frames: N>0, grade: ... }`. Reload a few times: both Campus and Bayan appear. Fix any missing-module error as the note in Step 4 says.

- [ ] **Step 7: Suggested commit (owner runs it)**

```bash
git add web/world/backdrop.html web/world/backdrop.js tests/backdrop-wiring.test.js && git commit -m 'Start page backdrop: standalone 3D page with a random town, walking kids, following pets and a slow camera that circles one kid at a time' -- web/world/backdrop.html web/world/backdrop.js tests/backdrop-wiring.test.js
```

---

### Task 3: Show it behind the start page

**Files:**
- Modify: `web/index.html`
- Test: `tests/backdrop-wiring.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `tests/backdrop-wiring.test.js`:

```js
test('the start page shows the backdrop in a click-through, hidden-from-readers iframe that loads late', () => {
  const html = fs.readFileSync(web('index.html'), 'utf8');
  assert.ok(html.includes('id="backdrop"'));
  assert.ok(/<iframe[^>]*id="backdrop"[^>]*aria-hidden="true"[^>]*tabindex="-1"/.test(html), 'hidden from readers and the tab order');
  assert.ok(!/<iframe[^>]*id="backdrop"[^>]*\ssrc=/.test(html), 'no src in the markup: it is set after load');
  assert.ok(/#backdrop\s*\{[^}]*pointer-events:\s*none/.test(html), 'taps pass through');
  assert.ok(html.includes("'load'") && html.includes('world/backdrop.html'), 'the src is set from a load handler');
  assert.ok(html.includes("'backdrop-ready'") && html.includes("'backdrop-failed'"), 'listens for ready and failed');
});

test('the start page lets the backdrop fail quietly and keeps its buttons first', () => {
  const html = fs.readFileSync(web('index.html'), 'utf8');
  assert.ok(html.includes('.remove()') && html.includes('e.source'), 'removes the iframe when it fails, only for its own messages');
  assert.ok(html.indexOf('<iframe') < html.indexOf('<main'), 'the iframe is behind the content');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/backdrop-wiring.test.js`
Expected: the two new tests FAIL.

- [ ] **Step 3: Edit `web/index.html`**

In the `<style>` block, after the `main{ ... }` rule, add:

```css
  #backdrop{ position:fixed; inset:0; width:100%; height:100%; border:0; z-index:-2; pointer-events:none; opacity:0; transition:opacity .8s; }
  #backdrop.on{ opacity:1; }
  body::before{ content:''; position:fixed; inset:0; z-index:-1; pointer-events:none; background:rgba(244,241,233,.4); }
  main{ background:rgba(244,241,233,.78); border-radius:24px; padding:20px; }
```

(If `main{ width:100%; max-width:520px; ... }` already sets properties, keep it and add `background`/`border-radius`/`padding` in this later rule; they do not clash.)

Directly after `<body>` (before `<main`), add:

```html
<iframe id="backdrop" title="" aria-hidden="true" tabindex="-1"></iframe>
```

Before `</body>` (after `engine/account.js`), add:

```html
<script>
(function () {
  var frame = document.getElementById('backdrop');
  addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    if (e.data === 'backdrop-ready') frame.classList.add('on');
    else if (e.data === 'backdrop-failed') {
      frame.remove();
      frame = null;
    }
  });
  addEventListener('load', function () { if (frame) frame.src = 'world/backdrop.html'; });
})();
</script>
```

Note `body` is `display:flex; justify-content:center`: the iframe is `position:fixed`, so it does not take part in the flex layout, and the `body::before` veil is fixed too.

- [ ] **Step 4: Run the wiring tests and the existing start page tests**

Run: `node --test tests/backdrop-wiring.test.js tests/pages.test.js tests/account.test.js`
Expected: PASS. If a test counts elements or asserts the exact markup after `<body>`, adjust the new markup, not the test, unless the test is plainly checking something the iframe legitimately changes (then tell the owner).

- [ ] **Step 5: Suggested commit (owner runs it)**

```bash
git add web/index.html tests/backdrop-wiring.test.js && git commit -m 'Start page: the animated 3D Play World shows behind the buttons (click-through iframe loaded after the page, fades in, removed if 3D cannot run)' -- web/index.html tests/backdrop-wiring.test.js
```

---

### Task 4: Precache

**Files:**
- Modify: `web/sw.js` (generated)
- Test: `tests/pwa.test.js` (existing)

- [ ] **Step 1: Run the precache test to see it fail**

Run: `node --test tests/pwa.test.js`
Expected: FAIL, the three new files under `web/world/` are not in `PRECACHE`.

- [ ] **Step 2: Regenerate**

Run: `node tools/update-precache.js`
Expected: prints `web/sw.js precaches <N> files` with N three higher than before; `git diff web/sw.js` shows exactly `world/backdrop.html`, `world/backdrop-core.js`, `world/backdrop.js` added (and nothing else changed; if `web/world/lesson-files.js` changed, that is the tool rewriting it, and the diff should be empty).

- [ ] **Step 3: Run the test**

Run: `node --test tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 4: Suggested commit (owner runs it)**

```bash
git add web/sw.js && git commit -m 'Precache the start page backdrop files' -- web/sw.js
```

---

### Task 5: Headless-Chrome e2e

**Files:**
- Create: `tests/e2e/backdrop-e2e.js`

- [ ] **Step 1: Write the e2e**

Create `tests/e2e/backdrop-e2e.js`:

```js
// The start page's animated backdrop: the backdrop page draws a town with kids and pets (both towns), the start page
// shows it behind click-through buttons, and with 3D unavailable the page stays as it was.
// Run: node tests/e2e/backdrop-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver, WEBGL_ARGS } = require('./chrome.js');
const { BACKDROP_PAGE, BACKDROP_FILES, VENDOR_FILES, ENGINE_FILES, web } = require('../paths.js');

const WAIT_MS = 6000;
const work = makeWorkDir('backdrop-e2e');

const REPORT = `<script>
(function () {
  function out(o) {
    o.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(o);
    document.body.appendChild(pre);
  }
  addEventListener('load', function () { setTimeout(function () { out(window.__report()); }, 4000); });
})();
</script>`;

function copyVendor(site) {
  for (const f of VENDOR_FILES) {
    const to = path.join(site, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(web(f), to);
  }
}

// seed runs before the backdrop's own scripts: it forces the town (Math.random) or turns 3D off (getContext).
function backdropSite(name, seed, report) {
  const html = fs.readFileSync(web(BACKDROP_PAGE), 'utf8').replace('<script src="../vendor/three/three.min.js"></script>', seed + '<script src="../vendor/three/three.min.js"></script>');
  const site = path.join(work, name);
  const file = stage(site, BACKDROP_PAGE, appendDriver(html, report), []);
  copyVendor(site);
  return file;
}

function runPage(name, file, args) {
  return readOutput(dumpDom(path.join(work, 'profile-' + name), file, '', WAIT_MS, args));
}

const BACKDROP_REPORT = 'window.__report = function () { return { state: __backdrop.state, frames: __backdrop.frames, grade: __backdrop.grade }; };' + REPORT.replace(/<\/?script>/g, '');

function backdropReport() { return '\nwindow.__report = function () { return { state: __backdrop.state, frames: __backdrop.frames, grade: __backdrop.grade }; };\n' + REPORT.slice('<script>'.length, -'</script>'.length); }

for (const [name, random, grade] of [['campus', 'Math.random = function () { return 0.1; };', 'grade5'], ['bayan', 'Math.random = function () { return 0.9; };', 'grade2']]) {
  const out = runPage(name, backdropSite(name, '<script>' + random + '</script>', backdropReport()), WEBGL_ARGS);
  assert.equal(out.errors.length, 0, name + ': ' + out.errors.join('; '));
  assert.equal(out.state, 'ready', name);
  assert.equal(out.grade, grade, name + ' town');
  assert.ok(out.frames > 3, name + ' drew frames: ' + out.frames);
  console.log('ok backdrop draws ' + name + ' (' + out.frames + ' frames)');
}

{
  const seed = '<script>HTMLCanvasElement.prototype.getContext = function () { return null; };</script>';
  const out = runPage('nogl', backdropSite('nogl', seed, backdropReport()), WEBGL_ARGS);
  assert.equal(out.state, 'failed', 'no 3D: the backdrop says it cannot');
  assert.equal(out.frames, 0);
  console.log('ok backdrop reports failure without 3D');
}

// The start page itself, with the backdrop staged beside it.
function startSite(name, seed) {
  const html = fs.readFileSync(web('index.html'), 'utf8');
  const site = path.join(work, name);
  const driver = `
window.__report = function () {
  var f = document.getElementById('backdrop'), btn = document.getElementById('welcome-view') ? document.querySelector('#welcome-view button') : document.querySelector('main button');
  var r = btn.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { frame: !!f, on: !!(f && f.classList.contains('on')), src: f ? f.getAttribute('src') : null, hitIsButton: hit === btn || btn.contains(hit), buttons: document.querySelectorAll('main button').length };
};`;
  const file = stage(site, 'index.html', appendDriver(html, driver + REPORT.slice('<script>'.length, -'</script>'.length)), ENGINE_FILES);
  fs.mkdirSync(path.join(site, 'assets', 'icons'), { recursive: true });
  for (const f of BACKDROP_FILES) {
    const to = path.join(site, 'world', f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(web('world/' + f), to);
  }
  const page = fs.readFileSync(web(BACKDROP_PAGE), 'utf8').replace('<script src="../vendor/three/three.min.js"></script>', seed + '<script src="../vendor/three/three.min.js"></script>');
  fs.writeFileSync(path.join(site, BACKDROP_PAGE), page);
  copyVendor(site);
  return file;
}

{
  const out = runPage('start', startSite('start', ''), WEBGL_ARGS);
  assert.equal(out.errors.length, 0, 'start page: ' + out.errors.join('; '));
  assert.equal(out.src, 'world/backdrop.html', 'loaded after the page');
  assert.equal(out.on, true, 'faded in once the backdrop was ready');
  assert.ok(out.buttons >= 3, 'the start buttons are there: ' + out.buttons);
  assert.equal(out.hitIsButton, true, 'a tap on a button reaches it through the iframe');
  console.log('ok start page shows the backdrop behind working buttons');
}

{
  const seed = '<script>HTMLCanvasElement.prototype.getContext = function () { return null; };</script>';
  const out = runPage('start-nogl', startSite('start-nogl', seed), WEBGL_ARGS);
  assert.equal(out.errors.length, 0, 'no 3D: ' + out.errors.join('; '));
  assert.equal(out.frame, false, 'the iframe is removed when 3D cannot run');
  assert.ok(out.buttons >= 3);
  console.log('ok start page is unchanged without 3D');
}
```

- [ ] **Step 2: Tidy the helper duplication before running**

The file above defines `BACKDROP_REPORT` and `backdropReport()` for the same thing. Delete the `BACKDROP_REPORT` constant (unused) and keep `backdropReport()`. Check that `stage()` with `[]` engine files and a `world/backdrop.html` page copies each `<script src="x.js">` that does not start with `.` or `/` (it does: the regex skips `../vendor/...`, and `copyVendor` supplies those).

- [ ] **Step 3: Run it**

Run: `node tests/e2e/backdrop-e2e.js`
Expected: five `ok` lines. If the start page case reports `on: false`, the backdrop did not reach ready within the virtual-time budget: raise `WAIT_MS` and the `setTimeout` in `REPORT` together (software WebGL is slow) before suspecting the code. If `frames` stays 0 but state is `ready`, `requestAnimationFrame` is not running under the budget: switch the page cases to a real-time wait by passing `0` for `waitMs` and a longer `setTimeout`.

- [ ] **Step 4: Run the world e2e and the full unit suite (scene.js and build.js are shared)**

Run: `node tests/e2e/world-e2e.js`
Expected: passes as before.

Run: `node --test`
Expected: all pass.

Run: `node tests/e2e/account-e2e.js`
Expected: passes (the start page's buttons and views still work with the iframe present).

- [ ] **Step 5: Suggested commit (owner runs it)**

```bash
git add tests/e2e/backdrop-e2e.js && git commit -m 'Start page backdrop: headless-Chrome check (both towns draw, buttons work through the iframe, unchanged without 3D)' -- tests/e2e/backdrop-e2e.js
```

---

### Task 6: Docs

**Files:**
- Modify: `README.md` (the e2e list near line 250)
- Modify: `docs/HANDOFF.md` (the start page / 3D world sections)

- [ ] **Step 1: README**

In the e2e command list in `README.md`, after the `account-e2e.js` line add:

```
node tests/e2e/backdrop-e2e.js       # start page backdrop: both towns draw with kids and pets, buttons work through the iframe, page unchanged without 3D
```

Also add one sentence where the README describes the start page or the 3D world: "The start page shows a slow animated 3D town (`web/world/backdrop.html`, random Campus or Bayan) behind its buttons; it is purely visual and falls back to the plain page when 3D cannot run."

- [ ] **Step 2: HANDOFF**

In `docs/HANDOFF.md`, in the built list near the "Play without an account" bullet (about line 32), add a bullet: "Start page backdrop: animated 3D Play World (random town, kids and pets walking, camera circling one kid at a time) in a click-through iframe, `web/world/backdrop*.js`; falls back to the plain page without WebGL; owner tablet and phone check pending."

- [ ] **Step 3: Suggested commit (owner runs it)**

```bash
git add README.md docs/HANDOFF.md && git commit -m 'Docs: start page backdrop in README and HANDOFF' -- README.md docs/HANDOFF.md
```

---

## Self-review

- **Spec coverage:** random town (Task 1 `pickGrade`, Task 2 `start`), real 3D with kids and pets (Task 2), iframe behind buttons loaded after `load`, click-through, `aria-hidden` (Task 3), veil and legibility (Task 3, panel replaces the title pill, noted in the header), quality low, 30 fps cap, hidden-tab pause (rAF stops by itself and `acc` clamps to 0.1 s), context loss (Task 2 `giveUp`), reduced motion still frame (Task 2 `still`), no WebGL / error / slow frames fall back (Tasks 1, 2, 3), precache (Task 4), unit and e2e tests (Tasks 1, 5), world e2e still passing (Task 5 Step 4), no saved data touched (Task 2 test), docs (Task 6).
- **Placeholders:** none; every code step has the code.
- **Type consistency:** `BackdropCore` exports `pickGrade, mode, viewOf, ease, petSpot, stepPet, slowWatch, PET_IDS, PET_SPEED, SLOW_SECONDS, RADIUS, HEIGHT`; `backdrop.js` and the tests use exactly those. `__backdrop` is `{ state, frames, grade }` in both `backdrop.js` and the e2e report. Messages are `'backdrop-ready'` and `'backdrop-failed'` in `backdrop.js`, `index.html` and the wiring test.
- **Known risk to check at run time:** the exact set of scripts the backdrop page needs. Task 2 Step 6 is where a missing module shows up; the fix is to add it to both `backdrop.html` and `BACKDROP_FILES`.
