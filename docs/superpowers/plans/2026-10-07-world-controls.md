# World Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tap-on/auto-off Sprint button, swings / see-saw / merry-go-round that loop until a Stop pill, and pinch / wheel zoom (0.7×–1.5×) remembered on the device, in the 3D world.

**Architecture:** Pure maths stays in Node-testable files: loop timing and cues in `web/world/rides.js`, the sprint factor in `web/world/walk.js`, the zoom clamp and saved pref in `web/world/prefs.js`. `web/world/play.js` drives looping rides and `stop()`; `web/world/move.js` owns sprint state and pinch / wheel zoom; `web/world/world-main.js` adds the Sprint button, speed-line overlay and Stop pill and wires the nudge.

**Tech Stack:** Plain ES5 browser JS (IIFE modules on `World3D`), Three.js, `node --test` unit tests, headless-Chrome e2e (`node tests/e2e/world-e2e.js`).

**Spec:** `docs/superpowers/specs/2026-10-07-world-controls-design.md`

**Repo rules:** never run `git commit` — each task ends by **staging** its files (`git add …`); the user commits. No `Co-Authored-By`. Comments only for non-obvious code, in the style of the file. Match the ES5 style (`var`, `function`, no arrow functions) in `web/`; tests use modern Node.

---

## File map

| File | Change |
|---|---|
| `web/world/rides.js` | `LOOPS`, `loops`, `endAt`, `loopDone`, `loopPart`, `loopPose`, `loopCues`; `pose` split into `seat` + slide |
| `web/world/build.js` | `ride(id, a)` takes the angle (null = rest) instead of `k` |
| `web/world/play.js` | looping rides, `stop()`, `stoppable()` |
| `web/world/walk.js` | `SPRINT = 1.4`, `step(…, fast)` |
| `web/world/prefs.js` | `zoom` in `world3d_device_v1`, `clampZoom`, `ZOOM_MIN`, `ZOOM_MAX` |
| `web/world/move.js` | `st.sprint`, `st.zoom`, `sprint(on)`, `zoom(z)`, pinch, wheel, `CAM_DIST / zoom` |
| `web/world/text.js` | `sprint`, `stop` button words |
| `web/world/world-main.js` | Sprint button, speed overlay, Stop pill, nudge stops a loop, zoom save, debug hooks |
| `web/world/world.css` | `.w-sprint`, `.w-stop`, `.w-speed`; narrow-layout stack moves up 64px |
| `tests/world3d-rides.test.js`, `tests/world3d-walk.test.js`, `tests/world3d-prefs.test.js`, `tests/world3d-text.test.js` | unit tests |
| `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`, `README.md` | e2e cases + README line |

---

### Task 1: Loop maths in rides.js

**Files:**
- Modify: `web/world/rides.js`
- Test: `tests/world3d-rides.test.js`

How today's rides map to the loop (all on today's 4 s clock, `k = t / 4`):
- Swings `0.7·sin(4πk)` and see-saw `0.3·sin(4πk + π/6)` repeat every 2 s. While looping, use `k = (t mod 2) / 4` (never reaches the swing's fade at k ≥ 0.8). The ending is today's last 2 s: `k = 0.5 + (t − e) / 4`.
- Merry-go-round spins up as today for 2 s (angle 2π, speed 1.5π rad/s), then turns at 1.5π rad/s. A loop is 4/3 s (one full turn), so every loop boundary is a whole number of turns and the ending (today's last 2 s, which adds another 2π) lands exactly at rest — no jump when `build.ride(id, null)` resets it to 0.
- `e = endAt(id, stopAt)`: the first loop boundary `2 + lap·n` at or after `max(2, stopAt)`. `null` while looping. Done at `t ≥ e + 2`.

- [ ] **Step 1: Write the failing tests** — append to `tests/world3d-rides.test.js`:

```js
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-rides.test.js`
Expected: the new tests FAIL (`R.LOOPS` undefined / `R.loopPart is not a function`); the old ones pass.

- [ ] **Step 3: Implement** — in `web/world/rides.js`:

Replace the `pose` function with `seat` + `pose`:

```js
  // Her seat on the swings, see-saw or merry-go-round when its moving part is at angle a.
  function seat(pr, id, a) {
    if (id === 'swings') {
      var sw = pr.swings;
      return { x: sw.x + SEAT, y: BAR - ROPE * Math.cos(a) - HIPS + 0.1, z: sw.z - ROPE * Math.sin(a), face: 0, sit: true, cheer: false };
    }
    if (id === 'seesaw') {
      var se = pr.seesaw;
      return { x: se.x + PLANK * Math.cos(a), y: PLANK_Y + PLANK * Math.sin(a) - HIPS + 0.15, z: se.z, face: -Math.PI / 2, sit: true, cheer: false };
    }
    var mr = pr.merry;
    return { x: mr.x + MERRY * Math.sin(a), y: DECK, z: mr.z + MERRY * Math.cos(a), face: a + Math.PI / 2, sit: false, cheer: true };
  }

  // { x, y, z, face, sit, cheer } for her at moment k of the ride.
  function pose(pr, id, k) {
    if (id !== 'slide') return seat(pr, id, part(id, k));
    var sl = pr.slide;
    if (k < 0.25) return { x: sl.x, y: 3.6, z: sl.z - 2.4, face: 0, sit: false, cheer: false };
    var u = ease(Math.min(1, (k - 0.25) / 0.75)), c = Math.cos(RAMP.tilt) * RAMP.half, s = Math.sin(RAMP.tilt) * RAMP.half;
    var z0 = sl.z + RAMP.dz - c, z1 = sl.z + RAMP.dz + c, y0 = RAMP.y + s, y1 = RAMP.y - s;
    return { x: sl.x, y: Math.max(0, y0 + (y1 - y0) * u - HIPS + 0.05), z: z0 + (z1 - z0) * u, face: 0, sit: true, cheer: u > 0.85 };
  }
```

Add after `pose`:

```js
  // Rides that go on until she taps Stop, and one loop in seconds: a whole swing or rock, and one full turn of the
  // merry-go-round at its top speed (1.5π a second), so every loop ends where it rests.
  var LOOPS = { swings: 2, seesaw: 2, merry: 4 / 3 };
  var SPIN = Math.PI * 1.5;

  function loops(id) { return Object.prototype.hasOwnProperty.call(LOOPS, id); }

  // When the ending (today's last 2 s) starts: the first loop boundary at or after Stop, never before 2 s; null
  // until Stop.
  function endAt(id, stopAt) {
    if (stopAt === null || stopAt === undefined) return null;
    var lap = LOOPS[id];
    return 2 + lap * Math.max(0, Math.ceil((Math.max(2, stopAt) - 2) / lap - 1e-9));
  }

  function loopDone(id, t, stopAt) {
    var e = endAt(id, stopAt);
    return e !== null && t >= e + 2;
  }

  function spun(t) { return t < 2 ? part('merry', t / 4) : Math.PI * 2 + SPIN * (t - 2); }

  // The moving part's angle t seconds into a looping ride.
  function loopPart(id, t, stopAt) {
    var e = endAt(id, stopAt);
    if (e !== null && t >= e + 2) return part(id, null);
    if (e !== null && t >= e) {
      var k = 0.5 + (t - e) / 4;
      return id === 'merry' ? spun(e) + part(id, k) - Math.PI * 2 : part(id, k);
    }
    return id === 'merry' ? spun(t) : part(id, (t % 2) / 4);
  }

  function loopPose(pr, id, t, stopAt) { return seat(pr, id, loopPart(id, t, stopAt)); }

  // The cue names a looping ride passes after time from and up to time to (play.js starts with from = -1): the start,
  // a creak each second as the swing passes the bottom or a bump a third of a second past each second as a see-saw
  // side touches down, the merry-go-round slowing 0.8 s into its ending, and the landing.
  function loopCues(id, from, to, stopAt) {
    var e = endAt(id, stopAt), last = e === null ? Infinity : e + 2, out = [];
    function at(time, name) { if (time > from && time <= to && time <= last) out.push({ time: time, name: name }); }
    at(0, 'ride-start');
    if (id === 'merry') {
      at(0, 'merry-start');
      if (e !== null) at(e + 0.8, 'merry-slow');
    } else {
      var off = id === 'seesaw' ? 1 / 3 : 0, name = id === 'seesaw' ? 'seesaw-bump' : 'swing';
      for (var n = Math.max(0, Math.floor(from)); n + off <= Math.min(to, last); n++) {
        if (n + off > 0 && n + off < last) at(n + off, name);
      }
    }
    if (e !== null) at(last, 'ride-land');
    return out.sort(function (a, b) { return a.time - b.time; }).map(function (c) { return c.name; });
  }
```

Change the exports line to:

```js
  var exported = {
    RIDES: RIDES, RAMP: RAMP, CUES: CUES, LOOPS: LOOPS, part: part, pose: pose, cues: cues,
    loops: loops, endAt: endAt, loopDone: loopDone, loopPart: loopPart, loopPose: loopPose, loopCues: loopCues
  };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-rides.test.js`
Expected: all PASS (old and new).

- [ ] **Step 5: Stage**

```bash
git add web/world/rides.js tests/world3d-rides.test.js
```

---

### Task 2: play.js drives looping rides; build.js takes the angle

**Files:**
- Modify: `web/world/play.js` (whole `create`)
- Modify: `web/world/build.js:334-341`

No unit test (browser-only module); covered by the e2e in Task 6 and the unit maths in Task 1.

- [ ] **Step 1: build.js** — replace the `ride` function (lines 334-341) with:

```js
    // Turns a ride's moving part to angle a (rides.js part or loopPart); null puts it back at rest.
    function ride(id, a) {
      if (!rideParts) return;
      if (a === null) a = W.Rides.part(id, null);
      if (id === 'swings') rideParts.pivot.rotation.x = a;
      else if (id === 'seesaw') rideParts.plank.rotation.z = a;
      else if (id === 'merry') rideParts.merry.rotation.y = a;
    }
```

- [ ] **Step 2: play.js** — replace the file header comment's first sentence ending and the `create` function so the file reads:

```js
/* Playground rides: she walks up to the slide, the swings, the see-saw or the merry-go-round and taps; she rides with
   an animation (the pet bounces beside it) and lands beside the ride. The slide is one run; the others go on until
   she taps Stop. Nothing is saved or paid. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { grade, built, ctl, busy(on), cue(name) (optional: each sound moment the ride passes) }
  function create(o) {
    var R = W.Rides, pr = W.Layout.props(o.grade), ends = {}, ride = null;
    W.Layout.rideSpots(o.grade).forEach(function (s) { ends[s.id] = s.end; });

    function cue(names) {
      if (o.cue) names.forEach(function (name) { o.cue(name); });
    }

    function start(id) {
      if (ride || !R.RIDES[id]) return;
      ride = { id: id, t: 0, stopAt: null, loop: R.loops(id) };
      o.busy(true);
      cue(ride.loop ? R.loopCues(id, -1, 0, null) : R.cues(id, -1, 0));
    }

    // A looping ride finishes its loop, plays its ending and lands her.
    function stop() {
      if (ride && ride.loop && ride.stopAt === null) ride.stopAt = ride.t;
    }

    // Each frame: her pose while she rides, or null. The last frame puts her down at the ride's end spot.
    function tick(dt) {
      if (!ride) return null;
      var id = ride.id, from = ride.t, p, a, done;
      ride.t += dt;
      if (ride.loop) {
        cue(R.loopCues(id, from, ride.t, ride.stopAt));
        p = R.loopPose(pr, id, ride.t, ride.stopAt);
        a = R.loopPart(id, ride.t, ride.stopAt);
        done = R.loopDone(id, ride.t, ride.stopAt);
      } else {
        var time = R.RIDES[id].time, k = Math.min(1, ride.t / time);
        cue(R.cues(id, Math.min(1, from / time), k));
        p = R.pose(pr, id, k);
        a = R.part(id, k);
        done = k >= 1;
      }
      o.built.ride(id, a);
      if (done) {
        o.built.ride(id, null);
        ride = null;
        o.ctl.teleport(ends[id].x, ends[id].z, ends[id].face);
        o.busy(false);
      }
      return p;
    }

    return {
      start: start, stop: stop, tick: tick,
      riding: function () { return ride ? ride.id : null; },
      stoppable: function () { return !!ride && ride.loop && ride.stopAt === null; }
    };
  }

  W.Play = { create: create };
})(this);
```

- [ ] **Step 3: Run the unit tests** (wiring tests read these files)

Run: `node --test`
Expected: all PASS. If `tests/world3d-wiring.test.js` or `tests/world3d-sfx-wiring.test.js` matches the old `o.built.ride(id, k)` / `R.cues(id, from, k)` text, update that regex to the new lines and say so in the report.

- [ ] **Step 4: Stage**

```bash
git add web/world/play.js web/world/build.js
```

---

### Task 3: Sprint maths (walk.js) and sprint state (move.js)

**Files:**
- Modify: `web/world/walk.js`
- Modify: `web/world/move.js`
- Test: `tests/world3d-walk.test.js`

- [ ] **Step 1: Write the failing test** — append to `tests/world3d-walk.test.js`:

```js
test('sprint moves her 1.4 times as far, and walls still stop her', () => {
  const open = () => false, dir = { x: 0, z: 1, mag: 1 };
  assert.equal(Walk.SPRINT, 1.4);
  const walk = Walk.step(0, 0, dir, 0.5, open), run = Walk.step(0, 0, dir, 0.5, open, Walk.SPRINT);
  assert.ok(close(walk.z, 4.5));
  assert.ok(close(run.z, 4.5 * 1.4));
  assert.equal(Walk.step(0, 0, dir, 0.5, (x, z) => z > 1, Walk.SPRINT).z, 0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-walk.test.js`
Expected: FAIL (`Walk.SPRINT` is undefined).

- [ ] **Step 3: walk.js**

```js
  var SPEED = 9;
  var SPRINT = 1.4;
```

```js
  // Moves x then z separately, so a wall in one direction still lets her slide along it. fast: SPRINT while she runs.
  function step(x, z, dir, dt, blocked, fast) {
    var sp = SPEED * (fast || 1) * dir.mag * dt, nx = x + dir.x * sp, nz = z + dir.z * sp, out = { x: x, z: z };
```

```js
  var exported = { SPEED: SPEED, SPRINT: SPRINT, moveVector: moveVector, toward: toward, step: step, facing: facing, turn: turn, advance: advance };
```

- [ ] **Step 4: move.js sprint** — sprint turns on with `sprint(true)` and off when she goes from moving to stopped, on freeze, and on blur / hidden.

State line becomes:

```js
    var st = { x: 0, z: 0, face: Math.PI, yaw: 0, pitch: 0.32, target: null, walkT: 0, mag: 0, sprint: false };
    var frozen = false, moved = false, keys = {}, joy = { x: 0, y: 0 }, joyId = null, lookId = null, last = null, down = null;
```

In `releaseAll`, add `st.sprint = false;` after `joy.x = joy.y = 0;`.

Replace the tail of `update` from `if (!dir) { … }` to the end of the function with:

```js
      if (!dir) {
        st.mag = 0;
        st.walkT *= 0.85;
        if (moved) st.sprint = false;
        moved = false;
        return st;
      }
      var fast = st.sprint ? Walk.SPRINT : 1, next = Walk.step(st.x, st.z, dir, dt, o.blocked, fast);
      if (st.target && next.x === st.x && next.z === st.z) st.target = null;
      st.x = next.x;
      st.z = next.z;
      st.face = Walk.turn(st.face, Walk.facing(dir), dt * 12);
      st.walkT += dt * 12 * dir.mag * fast;
      st.mag = dir.mag;
      moved = true;
      return st;
    }

    // Sprint stays armed while she stands; it switches off when she stops after moving.
    function sprint(on) { st.sprint = !!on && !frozen; }
```

In `freeze(on)`, add `if (on) st.sprint = false;` as its last line.

Return line:

```js
    return { state: st, update: update, camera: camera, portrait: portrait, teleport: teleport, freeze: freeze, sprint: sprint };
```

- [ ] **Step 5: Run the tests**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 6: Stage**

```bash
git add web/world/walk.js web/world/move.js tests/world3d-walk.test.js
```

---

### Task 4: Zoom pref (prefs.js) and pinch / wheel zoom (move.js)

**Files:**
- Modify: `web/world/prefs.js`
- Modify: `web/world/move.js`
- Test: `tests/world3d-prefs.test.js`

- [ ] **Step 1: Write the failing tests** — in `tests/world3d-prefs.test.js`, the first test's expected objects gain `zoom: 1`:

```js
test('device prefs default to auto quality with music and footsteps on', () => {
  assert.deepEqual(P.readPrefs(memory()), { v: 1, quality: 'auto', music: true, steps: true, zoom: 1 });
  assert.deepEqual(P.readPrefs(memory({ world3d_device_v1: '{"quality":"ultra","music":"no","steps":"no"}' })), { v: 1, quality: 'auto', music: true, steps: true, zoom: 1 });
  const s = memory();
  P.savePrefs(s, { quality: 'low', music: false, steps: false });
  assert.deepEqual(P.readPrefs(s), { v: 1, quality: 'low', music: false, steps: false, zoom: 1 });
  P.savePrefs(s, { quality: 'low', music: false });
  assert.equal(P.readPrefs(s).steps, true, 'footsteps stay on unless switched off');
});
```

and append:

```js
test('zoom is kept on the device between 0.7 and 1.5; anything else reads as 1', () => {
  assert.deepEqual([P.ZOOM_MIN, P.ZOOM_MAX], [0.7, 1.5]);
  const s = memory();
  P.savePrefs(s, Object.assign(P.readPrefs(s), { zoom: 1.3 }));
  assert.equal(P.readPrefs(s).zoom, 1.3);
  assert.equal(P.readPrefs(s).quality, 'auto', 'the other prefs are kept');
  assert.equal(P.readPrefs(memory({ world3d_device_v1: '{"zoom":9}' })).zoom, 1.5);
  assert.equal(P.readPrefs(memory({ world3d_device_v1: '{"zoom":0.1}' })).zoom, 0.7);
  for (const bad of ['"1.2"', 'null', '[1]']) assert.equal(P.readPrefs(memory({ world3d_device_v1: '{"zoom":' + bad + '}' })).zoom, 1, bad);
  assert.equal(P.clampZoom(NaN), 1);
  assert.equal(P.clampZoom(Infinity), 1);
  assert.equal(P.clampZoom(undefined), 1);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-prefs.test.js`
Expected: FAIL (no `zoom` in the read prefs; `P.clampZoom` undefined).

- [ ] **Step 3: prefs.js**

Under `var QUALITIES = …`:

```js
  var ZOOM_MIN = 0.7, ZOOM_MAX = 1.5;

  function clampZoom(z) { return typeof z === 'number' && isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : 1; }
```

`readPrefs` and `savePrefs`:

```js
  function readPrefs(storage) {
    var d = parse(storage, DEVICE_KEY) || {};
    return { v: 1, quality: QUALITIES.indexOf(d.quality) >= 0 ? d.quality : 'auto', music: d.music !== false, steps: d.steps !== false, zoom: clampZoom(d.zoom) };
  }

  function savePrefs(storage, prefs) {
    var out = { v: 1, quality: QUALITIES.indexOf(prefs.quality) >= 0 ? prefs.quality : 'auto', music: prefs.music !== false, steps: prefs.steps !== false, zoom: clampZoom(prefs.zoom) };
```

Update the header comment's list "(quality, music, footsteps)" to "(quality, music, footsteps, zoom)". Exports gain `ZOOM_MIN: ZOOM_MIN, ZOOM_MAX: ZOOM_MAX, clampZoom: clampZoom`.

- [ ] **Step 4: Run the prefs tests**

Run: `node --test tests/world3d-prefs.test.js`
Expected: PASS.

- [ ] **Step 5: move.js zoom** — options gain `zoom` (start value) and `onZoom(z)` (save). Update the options comment:

```js
  // o = { win, canvas, joy, knob, tapWalk, blocked(x, z), tapHit(x, y) → true when the tap was used (her pet),
  //       zoom (saved zoom), onZoom(z) (save it) }
```

After the `var groundPlane …` line:

```js
    var pinchId = null, pinch = null, zoomSave = null;
    st.zoom = W.Prefs.clampZoom(o.zoom);

    function zoom(z) { st.zoom = W.Prefs.clampZoom(z); }
    function saveZoom(wait) {
      if (zoomSave) win.clearTimeout(zoomSave);
      zoomSave = win.setTimeout(function () {
        zoomSave = null;
        if (o.onZoom) o.onZoom(st.zoom);
      }, wait);
    }
    function pinchZoom() { zoom(pinch.zoom * Math.hypot(pinch.x - last.x, pinch.y - last.y) / pinch.d); }
```

In `releaseAll`, add `pinchId = null; pinch = null;` (two lines).

Canvas `pointerdown` becomes:

```js
    // A second finger while the first is down pinches: spreading them zooms in, and the camera does not turn.
    o.canvas.addEventListener('pointerdown', function (e) {
      if (lookId !== null) {
        if (pinchId !== null || frozen) return;
        pinchId = e.pointerId;
        capture(e);
        pinch = { x: e.clientX, y: e.clientY, d: Math.max(1, Math.hypot(e.clientX - last.x, e.clientY - last.y)), zoom: st.zoom };
        down = null;
        return;
      }
      lookId = e.pointerId;
      capture(e);
      last = { x: e.clientX, y: e.clientY };
      down = { x: e.clientX, y: e.clientY, at: Date.now() };
    });
    o.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (frozen || !e.deltaY) return;
      zoom(st.zoom * (e.deltaY < 0 ? 1 / 0.9 : 0.9));
      saveZoom(500);
    }, { passive: false });
```

`pointermove` becomes:

```js
    win.addEventListener('pointermove', function (e) {
      if (e.pointerId === joyId) moveJoy(e);
      else if (e.pointerId === pinchId) {
        pinch.x = e.clientX;
        pinch.y = e.clientY;
        pinchZoom();
      } else if (e.pointerId === lookId && pinchId !== null) {
        last = { x: e.clientX, y: e.clientY };
        pinchZoom();
      } else if (e.pointerId === lookId && !frozen) {
        st.yaw -= (e.clientX - last.x) * 0.008;
        st.pitch = Math.max(0.12, Math.min(0.85, st.pitch + (e.clientY - last.y) * 0.004));
        last = { x: e.clientX, y: e.clientY };
      }
    });
```

In `end(e)`, before the `if (e.pointerId === lookId)` block:

```js
      if (pinchId !== null && (e.pointerId === pinchId || e.pointerId === lookId)) {
        pinchId = null;
        pinch = null;
        saveZoom(0);
      }
```

(`down` was cleared when the pinch began, so lifting the look finger is not a tap.)

`camera(dt, snap)` uses the zoomed distance:

```js
    function camera(dt, snap) {
      var dist = CAM_DIST / st.zoom;
      camPos.set(st.x + Math.sin(st.yaw) * dist * Math.cos(st.pitch), 2.5 + Math.sin(st.pitch) * dist,
        st.z + Math.cos(st.yaw) * dist * Math.cos(st.pitch));
```

In `freeze(on)` add `pinchId = null; pinch = null;`. Return gains `zoom: zoom`.

- [ ] **Step 6: Run all unit tests**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 7: Stage**

```bash
git add web/world/prefs.js web/world/move.js tests/world3d-prefs.test.js
```

---

### Task 5: World wiring — Sprint button, speed lines, Stop pill, nudge, zoom save

**Files:**
- Modify: `web/world/text.js` (BUTTONS)
- Modify: `web/world/world-main.js` (Move.create ~line 84, buildHud ~line 397-428, tick ~line 436-485, debug ~line 600-640)
- Modify: `web/world/world.css`
- Test: `tests/world3d-text.test.js`

- [ ] **Step 1: Failing text test** — in `tests/world3d-text.test.js` add `'sprint', 'stop'` to the `ENGLISH_ONLY` set, and append:

```js
test('the Sprint and Stop buttons have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    assert.equal(TEXT[g].sprint, 'Sprint');
    assert.equal(TEXT[g].stop, '⏹️ Stop');
  }
});
```

Run: `node --test tests/world3d-text.test.js` — Expected: FAIL (`undefined !== 'Sprint'`).

- [ ] **Step 2: text.js** — in `BUTTONS`, after `use: '✨ Use', emote: '😊 Emote',` add:

```js
    sprint: 'Sprint', stop: '⏹️ Stop',
```

Run: `node --test tests/world3d-text.test.js` — Expected: PASS.

- [ ] **Step 3: Move.create gets the saved zoom** (world-main.js ~line 84):

```js
    var ctl = W.Move.create(S, {
      win: root, canvas: S.renderer.domElement, joy: hud.joy, knob: hud.knob, tapWalk: L.GRADES[grade].tapWalk,
      blocked: function (x, z) { return L.blocked(obs, bounds, x, z, L.PLAYER_R); },
      tapHit: function (x, y) { return !maker && !stall && !overlay && !talking && pal.hit(x, y); },
      zoom: prefs.zoom,
      onZoom: function (z) { prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { zoom: z })); }
    });
```

- [ ] **Step 4: buildHud** — after the `treat` line add:

```js
      var sprint = button('w-sprint', '🏃', function () {
        if (!maker && !stall && !overlay && !talking) ctl.sprint(!ctl.state.sprint);
        sprint.setAttribute('aria-pressed', ctl.state.sprint ? 'true' : 'false');
      });
      sprint.id = 'sprint';
      sprint.setAttribute('aria-label', T.sprint);
      sprint.setAttribute('aria-pressed', 'false');
      var stop = button('w-pill w-stop', T.stop, function () {
        play.stop();
        stop.hidden = true;
      });
      stop.id = 'stop-ride';
      stop.hidden = true;
      var speed = el('div', 'w-speed');
      speed.setAttribute('aria-hidden', 'true');
```

The append line and return become (Sprint must come after the joystick in the DOM for the `.w-joy.big ~` rules):

```js
      [top, joy, actBtn, treat, sprint, stop, speed, waking].forEach(function (n) { doc.body.appendChild(n); });
      return {
        joy: joy, knob: knob, act: actBtn, waking: waking, actFor: null,
        treat: treat, sprint: sprint, stop: stop, speed: speed,
        show: function (on) {
          top.hidden = !on; joy.hidden = !on; actBtn.hidden = !on; treat.hidden = !on; sprint.hidden = !on;
          if (!on) { stop.hidden = true; speed.classList.remove('on'); }
        }
      };
```

- [ ] **Step 5: tick** — after `hud.treat.hidden = !free || !!pose;` add:

```js
      hud.sprint.hidden = hud.treat.hidden;
      hud.sprint.setAttribute('aria-pressed', st.sprint ? 'true' : 'false');
      hud.speed.classList.toggle('on', !!st.sprint && st.mag > 0);
      hud.stop.hidden = !play.stoppable();
```

and change the nudge lines to:

```js
      if (nudge.tick(dt, !doc.hidden && !maker && !stall)) nudgeDue = true;
      // A looping ride would keep her busy for ever, so the nudge stops it; Mimi comes once she lands.
      if (nudgeDue && play.stoppable()) play.stop();
      if (nudgeDue && free && !kin.visiting() && town.nudge(st)) nudgeDue = false;
```

- [ ] **Step 6: debug hooks** — next to `debug.riding = play.riding;` add:

```js
    debug.stoppable = play.stoppable;
    debug.stopRide = function () { hud.stop.click(); };
    debug.view = function () {
      var st = ctl.state, c = S.camera.position;
      return { zoom: st.zoom, yaw: st.yaw, sprint: st.sprint, dist: Math.hypot(c.x - st.x, c.y - 2.5, c.z - st.z) };
    };
```

- [ ] **Step 7: CSS** — in `web/world/world.css`, after the `.w-treat` narrow `@media (max-width: 600px)` block add:

```css
/* Sprint: a round button in the bottom-right corner, under the Treat stack. */
.w-sprint { position: fixed; right: 16px; bottom: max(24px, env(safe-area-inset-bottom)); width: 56px; height: 56px; border: 0;
  border-radius: 50%; background: rgba(255,255,255,.92); box-shadow: 0 4px 0 #f3b6d6; font-size: 28px; line-height: 1; cursor: pointer; }
.w-sprint[aria-pressed="true"] { background: #ffd166; box-shadow: 0 0 0 4px #fff3b0, 0 4px 0 #f0a500; }
.w-stop { position: fixed; right: 16px; top: calc(max(14px, env(safe-area-inset-top)) + 56px); }
.w-speed { position: fixed; inset: 0; pointer-events: none; opacity: 0; transition: opacity .2s;
  background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.6) 0deg 1.2deg, transparent 1.2deg 7deg);
  -webkit-mask-image: radial-gradient(ellipse at center, transparent 58%, #000 88%);
  mask-image: radial-gradient(ellipse at center, transparent 58%, #000 88%); }
.w-speed.on { opacity: .75; animation: w-speed .3s linear infinite alternate; }
@keyframes w-speed { to { transform: scale(1.05); } }
@media (prefers-reduced-motion: reduce) { .w-speed { display: none; } }
```

On a narrow phone the action pill sits bottom-right, so Sprint goes just above the joystick and the left stack moves up 64px. Replace the narrow treat block:

```css
/* On a narrow phone the action button moves to the right and can wrap to several lines, so Sprint and Treat sit above
   the joystick. */
@media (max-width: 600px) {
  .w-sprint { right: auto; left: 24px; bottom: calc(max(24px, env(safe-area-inset-bottom)) + 152px); }
  .w-joy.big ~ .w-sprint { bottom: calc(max(24px, env(safe-area-inset-bottom)) + 188px); }
  .w-treat { right: auto; left: 24px; bottom: calc(max(24px, env(safe-area-inset-bottom)) + 216px); }
  .w-joy.big ~ .w-treat { bottom: calc(max(24px, env(safe-area-inset-bottom)) + 252px); }
}
```

(The `.w-sprint` base rule must be **above** this block so the media rule wins — put the Sprint/Stop/speed CSS just before it.) In the later narrow block for Play / Emote / Use / rows, add 64 to every pixel offset: Play 208→272 and 244→308, Emote 264→328 and 300→364, Use 320→384 and 356→420, rows 376→440 and 412→476 (both in `bottom` and in the `max-height` `calc`).

- [ ] **Step 8: Run all unit tests**

Run: `node --test`
Expected: all PASS. If a wiring test pins the buildHud append list or the nudge lines by regex, update it to the new text and say so in the report.

- [ ] **Step 9: Stage**

```bash
git add web/world/text.js web/world/world-main.js web/world/world.css tests/world3d-text.test.js
```

---

### Task 6: E2e — looping ride + Stop, slide, nudge stops a loop, sprint, zoom

**Files:**
- Modify: `tests/e2e/world-driver.page.js` (mode `family`; new modes `controls`, `zoomed`; header mode list)
- Modify: `tests/e2e/world-e2e.js` (family assertions; new cases)
- Modify: `README.md` (world-e2e line)

- [ ] **Step 1: Driver, family mode** — replace from `var sw = LF.interactables('grade5')…` to the `return out(o);` of the family mode with:

```js
      var ride = function (id) { return LF.interactables('grade5').filter(function (x) { return x.id === 'ride:' + id; })[0]; };
      var stopShown = function () { return !document.getElementById('stop-ride').hidden; };
      var sw = ride('swings');
      D.stand(sw.x, sw.z);
      o.rideAct = D.actText();
      D.act();
      o.riding = D.riding();
      for (var r = 0; r < 55; r++) D.tick(0.1);
      o.stillRiding = D.riding();
      o.stopShown = stopShown();
      D.stopRide();
      o.stopAfterTap = stopShown();
      for (r = 0; r < 60 && D.riding(); r++) D.tick(0.1);
      o.rodeDone = D.riding();
      o.rideSounds = D.sfxLog().map(function (l) { return l.key; })
        .filter(function (k) { return /^(ride-|swing$)/.test(k); });
      o.after = D.state();
      o.end = LF.rideSpots('grade5').filter(function (x) { return x.id === 'swings'; })[0].end;
      var sl = ride('slide');
      D.stand(sl.x, sl.z);
      D.act();
      D.tick(0.1);
      o.slideRiding = D.riding();
      o.slideStop = stopShown();
      for (r = 0; r < 40 && D.riding(); r++) D.tick(0.1);
      o.slideDone = D.riding();
      var mg = ride('merry');
      D.stand(mg.x, mg.z);
      D.act();
      for (r = 0; r < 20; r++) D.tick(0.1);
      o.merryRiding = D.riding();
      D.nudgeNow();
      for (var n = 0; n < 150 && !D.talking(); n++) D.tick(0.1);
      o.nudgeRiding = D.riding();
      o.nudgeText = D.talkText();
      return out(o);
```

- [ ] **Step 2: Driver, new modes** — add before `if (mode === 'lost')`:

```js
    if (mode === 'controls') {
      D.pause();
      var canvas = document.querySelector('canvas'), sprintBtn = document.getElementById('sprint');
      var key = function (type, k) { window.dispatchEvent(new KeyboardEvent(type, { key: k })); };
      // Half a second walking up the street from the gate (quick travel faces her into the campus).
      var walkFor = function () {
        D.teleport('gate');
        D.closeTalk();
        var a = D.state();
        key('keydown', 'w');
        for (var i = 0; i < 5; i++) D.tick(0.1);
        key('keyup', 'w');
        var b = D.state();
        return Math.hypot(b.x - a.x, b.z - a.z);
      };
      o.startZoom = D.view().zoom;
      o.walked = walkFor();
      D.tick(0.1);
      D.closeTalk();
      sprintBtn.click();
      o.pressed = sprintBtn.getAttribute('aria-pressed');
      D.tick(0.1);
      o.armed = D.view().sprint;
      o.ran = walkFor();
      o.speedOn = document.querySelector('.w-speed').classList.contains('on');
      D.tick(0.1);
      o.pressedAfter = sprintBtn.getAttribute('aria-pressed');
      o.speedAfter = document.querySelector('.w-speed').classList.contains('on');
      for (var w = 0; w < 12; w++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
      o.wheelZoom = D.view().zoom;
      for (var c = 0; c < 40; c++) D.tick(0.1);
      o.dist = D.view().dist;
      var yaw = D.view().yaw;
      var pe = function (type, id, x, target) {
        (target || window).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: 300, bubbles: true }));
      };
      pe('pointerdown', 11, 300, canvas);
      pe('pointerdown', 12, 500, canvas);
      pe('pointermove', 12, 460);
      o.pinchZoom = D.view().zoom;
      o.pinchYaw = D.view().yaw === yaw;
      pe('pointerup', 12, 460);
      pe('pointerup', 11, 300);
      var saved = function () { return JSON.parse(Learner.storage.getItem('world3d_device_v1') || '{}').zoom; };
      waitFor(function () { return saved() === o.pinchZoom; }, function () {
        o.savedZoom = saved();
        out(o);
      });
      return;
    }
    if (mode === 'zoomed') {
      D.pause();
      for (var zt = 0; zt < 40; zt++) D.tick(0.1);
      o.view = D.view();
      return out(o);
    }
```

Update the header comment's mode list to add `|controls|zoomed`.

- [ ] **Step 3: world-e2e.js, family assertions** — update the case comment to "a swing goes on until Stop, the slide ends by itself, the 10-minute nudge stops a merry-go-round ride and brings Mimi", and replace the ride / nudge assertions (`fam.rideAct` … `fam.nudgeText`) with:

```js
  assert.equal(fam.rideAct, '🌈 Ride the swing!');
  assert.equal(fam.riding, 'swings');
  assert.equal(fam.stillRiding, 'swings', 'the swing goes on until Stop');
  assert.equal(fam.stopShown, true, 'Stop shows while it loops');
  assert.equal(fam.stopAfterTap, false, 'Stop hides once tapped');
  assert.equal(fam.rodeDone, null, 'after Stop she lands');
  assert.deepEqual(fam.rideSounds, ['ride-start', 'swing', 'swing', 'swing', 'swing', 'swing', 'swing', 'swing', 'ride-land'],
    'a creak each second until the ending, then the landing');
  assert.deepEqual([fam.after.x, fam.after.z], [fam.end.x, fam.end.z], 'she lands beside the swing');
  assert.equal(fam.slideRiding, 'slide');
  assert.equal(fam.slideStop, false, 'the slide has no Stop');
  assert.equal(fam.slideDone, null, 'the slide ends by itself');
  assert.equal(fam.merryRiding, 'merry');
  assert.equal(fam.nudgeRiding, null, 'the nudge stops the ride first');
  assert.equal(fam.nudgeText.indexOf("Let's learn something!"), 0, fam.nudgeText);
  console.log('ok sister cheers, a looping ride and Stop, the slide, the 10-minute nudge');
```

- [ ] **Step 4: world-e2e.js, new cases** — after the family case:

```js
  // Sprint makes her 1.4x as fast and turns off when she stops; the wheel and a pinch zoom, kept on the device.
  const ctlRun = run('controls', stageWorld('controls', 5, LOOK), 'controls');
  assert.deepEqual(ctlRun.errors, [], 'controls: page errors');
  assert.equal(ctlRun.startZoom, 1);
  assert.equal(ctlRun.pressed, 'true');
  assert.equal(ctlRun.armed, true, 'sprint stays on while she stands');
  assert.ok(Math.abs(ctlRun.ran / ctlRun.walked - 1.4) < 0.05, 'sprint is 1.4x: ' + ctlRun.ran + ' vs ' + ctlRun.walked);
  assert.equal(ctlRun.speedOn, true, 'speed lines while she runs');
  assert.equal(ctlRun.pressedAfter, 'false', 'sprint turns off when she stops');
  assert.equal(ctlRun.speedAfter, false);
  assert.equal(ctlRun.wheelZoom, 1.5, 'the wheel zooms in up to 1.5x');
  assert.ok(Math.abs(ctlRun.dist - 10) < 0.5, 'the camera comes in to 15 / 1.5: ' + ctlRun.dist);
  assert.ok(Math.abs(ctlRun.pinchZoom - 1.2) < 1e-9, 'pinching 200px to 160px zooms 1.5x to 1.2x: ' + ctlRun.pinchZoom);
  assert.equal(ctlRun.pinchYaw, true, 'a pinch does not turn the camera');
  assert.equal(ctlRun.savedZoom, ctlRun.pinchZoom, 'zoom is saved on the device');
  const ZOOMED = LOOK + '<script>Learner.storage.setItem("world3d_device_v1", JSON.stringify({ v: 1, quality: "auto", music: true, steps: true, zoom: 0.7 }));</script>';
  const zoomed = run('zoomed', stageWorld('zoomed', 5, ZOOMED), 'zoomed');
  assert.deepEqual(zoomed.errors, [], 'zoomed: page errors');
  assert.equal(zoomed.view.zoom, 0.7, 'the saved zoom comes back');
  assert.ok(Math.abs(zoomed.view.dist - 15 / 0.7) < 0.5, 'wide view: ' + zoomed.view.dist);
  console.log('ok sprint, wheel and pinch zoom, zoom kept');
```

- [ ] **Step 5: README** — on the `node tests/e2e/world-e2e.js` line, change "rides, the 10-minute nudge" to "rides (looping until Stop, the slide one run), the 10-minute nudge stopping a ride, sprint, wheel and pinch zoom".

- [ ] **Step 6: Run the world e2e**

Run: `node tests/e2e/world-e2e.js`
Expected: every `ok …` line prints, including `ok sister cheers, a looping ride and Stop, the slide, the 10-minute nudge` and `ok sprint, wheel and pinch zoom, zoom kept`. If the sprint ratio fails because something on the street blocks her, check `D.state()` positions in the output; pick another open quick-travel spot and its forward key (do not loosen the 1.4 check).

- [ ] **Step 7: Stage**

```bash
git add tests/e2e/world-driver.page.js tests/e2e/world-e2e.js README.md
```

---

### Task 7: Final check

- [ ] **Step 1:** `node --test` — all PASS.
- [ ] **Step 2:** `node tests/e2e/world-e2e.js` — all `ok` lines, no page errors.
- [ ] **Step 3:** `node tests/e2e/lobby-e2e.js 5` and `node tests/e2e/apps-e2e.js 5` — still PASS (shared engine untouched, sanity only).
- [ ] **Step 4:** Check the PWA precache test still passes (no new files were added, so `sw.js` PRECACHE needs no change).
- [ ] **Step 5:** `git status` — only the files above changed, all staged. Hand the user this commit command:

```bash
git commit -m "World controls: a round Sprint button (bottom-right; above the joystick on a narrow phone) makes her 40% faster with one tap and switches off when she stops after moving, a ride or card starts, or the world is hidden, with soft speed lines at the screen edges while she runs (hidden for reduced motion); her legs and footsteps speed up with her; the swings, see-saw and merry-go-round now go on until she taps a Stop pill (today's start, a steady loop, then today's ending from the next loop boundary, so nothing jumps; creaks and bumps keep time and the start and landing sound once), the slide stays one run, and the 10-minute nudge stops a looping ride so Mayor Mimi comes once she lands; pinch with two fingers or use the mouse wheel to zoom from 0.7x to 1.5x, saved on the device in world3d_device_v1; unit and e2e tests"
```
