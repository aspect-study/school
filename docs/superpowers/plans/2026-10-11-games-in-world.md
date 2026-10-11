# Games inside the world Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules that override the skill defaults:** never run `git commit` (the owner does); never add `Co-Authored-By` or any AI attribution anywhere. Each task ends with a suggested commit command in a code block for the owner. Browser JS in `web/` is ES5 in an IIFE (`var`, `function`, no arrow functions, no `const`/`let`, no template strings); tests and `tools/` are modern Node. Comments only for non-obvious code. Never use fully-qualified names inline.

**Goal:** A door (or a buddy's "Let's go", or the Boss Fort) opens the game inside the 3D world: the camera glides in, the world stops drawing and blurs, the real game page runs in a playful frame, and closing it brings her back to the same spot with her pet's celebration, with no page reload.

**Architecture:** New `web/world/portal.js` holds a pure core (`ease`, `closer`, `embedUrl`, `acceptMessage`), a state machine `create(o)` that only talks to injected deps (unit-tested with fakes), and a small DOM `view()`. `world-main.js` wires it to the camera, the frame loop, the HUD, history and `message` events. In the game, `nav.js` reads `?embed=1`; in embed mode every way out of the game (`go(url)`) posts `{type:'portal-close'}` to the world instead of loading a page, the page is locked to the light theme, and the menu's Lobby item reads "Back to town". `trail.js`'s home stop goes through `Nav.go` in embed mode.

**Tech Stack:** plain browser JS (ES5 IIFE), Three.js (existing `S.camera`), `postMessage`, Node 22 (`node --test`), headless-Chrome e2e scripts in `tests/e2e`.

Spec: `docs/superpowers/specs/2026-10-11-games-in-world-design.md`.

**Resolved from the spec's open check (cloud sync):** neither the world page nor the game pages load `cloud.js` (only the lobbies and the parent page sync), so a game in the frame cannot double-sync. No sync change is needed.

**Plan-level refinements of the spec (same intent, simpler code):**
- The camera glide target is computed from the current camera, not from building geometry: at a door the camera sits behind her looking at her, so `closer(pose)` moves the camera 60% of the way toward what it looks at and lifts the look point a little. This works the same for doors, buddies and the fort.
- The portal pauses the world (frame loop, music, HUD) at the *start* of the glide and draws the glide frames itself, so it never fights `ctl.camera()` for the camera.
- Buddies' "Let's go" (`folk.open`) and the Boss Fort (`town` `go`) open through the portal too, since they open game pages from the world.
- The frame's ✕ uses the existing `T.close` label; no new world text.

## File map

- Create `web/world/portal.js`: pure helpers, `create(o)` state machine, `view(doc, label, onX)`.
- Create `tests/world3d-portal.test.js`: unit tests for the helpers and the state machine.
- Modify `web/engine/nav.js`: `isEmbedded`, `closeMessage`, `targetOrigin`; embed-mode `go`, light theme, "Back to town" labels; `Nav.embedded`.
- Modify `tests/nav.test.js`: the new helpers.
- Modify `web/engine/trail.js`: exported `leaveHome(win, grade)`; the home stop uses it.
- Modify `tests/trail.test.js`: `leaveHome` in and out of embed mode.
- Modify `web/world/world-main.js`: create the portal, `pauseWorld`, `openGame`, door/buddy/fort wiring, popstate, message, Escape, `debug.portal`, `debug.paused`.
- Modify `web/world/world.css`: `.w-portal*` and the canvas blur.
- Modify `web/world/grade-5.html`, `web/world/grade-2.html`, `tests/paths.js`: load `portal.js` before `world-main.js`.
- Modify `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`: the `fresh` and `progress` cases read the portal's URL instead of `D.go`.
- Create `tests/e2e/portal-e2e.js`, `tests/e2e/portal-world.page.js`, `tests/e2e/portal-game.page.js`: world + Science game together.
- Modify `web/sw.js` via `node tools/update-precache.js`.
- Modify `README.md`, `docs/HANDOFF.md`.

---

### Task 1: Embed mode in `nav.js`

**Files:**
- Modify: `web/engine/nav.js`
- Test: `tests/nav.test.js`

- [ ] **Step 1: Write the failing tests**

Change the require line at the top of `tests/nav.test.js` to:

```js
const { controller, lobbyUrl, homeUrl, WORLD_RETURN, TEXT, isEmbedded, closeMessage, targetOrigin } = require(engineFile('nav.js'));
```

Append to `tests/nav.test.js`:

```js
test('a game is embedded only with ?embed=1 and inside another window', () => {
  const top = { location: { search: '?embed=1' } };
  top.parent = top;
  assert.equal(isEmbedded(top), false, 'opened on its own, even with the flag');
  const framed = { location: { search: '?reset=1&embed=1' }, parent: {} };
  assert.equal(isEmbedded(framed), true);
  assert.equal(isEmbedded({ location: { search: '?embed=10' }, parent: {} }), false);
  assert.equal(isEmbedded({ location: { search: '' }, parent: {} }), false);
  assert.equal(isEmbedded({ get location() { throw new Error('blocked'); } }), false);
});

test('leaving an embedded game asks the world to close the frame; the shop asks for the shop after', () => {
  assert.deepEqual(closeMessage('../../../world/grade-5.html'), { type: 'portal-close' });
  assert.deepEqual(closeMessage('../../../lobby/grade-5.html'), { type: 'portal-close' });
  assert.deepEqual(closeMessage('../../../lobby/grade-5.html#shop'), { type: 'portal-close', then: 'shop' });
});

test('the close message goes to the page\'s own origin; file pages (origin "null") use *', () => {
  assert.equal(targetOrigin('https://study-game.example'), 'https://study-game.example');
  assert.equal(targetOrigin('null'), '*');
  assert.equal(targetOrigin(undefined), '*');
});

test('both grades have the embedded labels, English only', () => {
  for (const g of ['grade5', 'grade2']) {
    assert.equal(TEXT[g].town, '🏠 Back to town');
    assert.equal(TEXT[g].homeTown, 'Back to town');
  }
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/nav.test.js`
Expected: FAIL, `isEmbedded is not a function` (and the TEXT test fails).

- [ ] **Step 3: Implement**

In `web/engine/nav.js`:

1. Add `town: '🏠 Back to town', homeTown: 'Back to town',` to both `TEXT.grade5` and `TEXT.grade2` (on the line with `lessons:`, after `lobby:`).

2. After `function worldReturn(win) {...}` add:

```js
  // Inside the world's frame (web/world/portal.js) a game opens with ?embed=1; leaving it closes the frame.
  function isEmbedded(win) {
    try { return /[?&]embed=1(&|$)/.test(win.location.search) && !!win.parent && win.parent !== win; } catch (e) { return false; }
  }

  function closeMessage(url) {
    return /#shop$/.test(url) ? { type: 'portal-close', then: 'shop' } : { type: 'portal-close' };
  }

  function targetOrigin(origin) { return origin && origin !== 'null' ? origin : '*'; }
```

3. In `create(win, grade)`, replace the `var api = {...};` block with:

```js
    // Read at load: StudyKit drops the query on ?reset=1 before the game starts.
    var embedded = isEmbedded(win);
    if (embedded) doc.documentElement.setAttribute('data-theme', 'light');

    var api = {
      lobby: lobbyUrl(grade),
      away: homeUrl(grade, worldReturn(win)),
      embedded: embedded,
      go: embedded
        ? function (url) { win.parent.postMessage(closeMessage(url), targetOrigin(win.location.origin)); }
        : function (url) { win.location.href = url; },
      start: start,
      screen: function (id) { if (ctl) ctl.screen(id); },
      current: function () { return ctl ? ctl.current() : null; }
    };
```

4. In `build(title)`, change the 🏠 button and the Lobby menu item to:

```js
      bar.appendChild(button('nav-home', 'gnav-btn', '🏠', embedded ? t.homeTown : t.home, function () { ctl.home(); }));
```

```js
        button('nav-lobby', 'gnav-item', embedded ? t.town : t.lobby, null, pick(function () { ctl.home(); }))
```

5. Change the exports line to:

```js
  var exported = { TEXT: TEXT, lobbyUrl: lobbyUrl, homeUrl: homeUrl, WORLD_RETURN: WORLD_RETURN, controller: controller,
    isEmbedded: isEmbedded, closeMessage: closeMessage, targetOrigin: targetOrigin };
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/nav.test.js tests/nav-wiring.test.js tests/english-everywhere.test.js`
Expected: PASS.

- [ ] **Step 5: Run the nav e2e (no embed, behaviour unchanged)**

Run: `node tests/e2e/nav-e2e.js`
Expected: four `ok` lines.

- [ ] **Step 6: Suggested commit (owner runs it)**

```bash
git add web/engine/nav.js tests/nav.test.js && git commit -m 'Nav: embed mode (?embed=1 inside the world frame): leaving posts portal-close, light theme, Back to town' -- web/engine/nav.js tests/nav.test.js
```

---

### Task 2: The lesson path's home stop in embed mode

**Files:**
- Modify: `web/engine/trail.js`
- Test: `tests/trail.test.js`

- [ ] **Step 1: Write the failing test**

Add `leaveHome` to the destructured require at the top of `tests/trail.test.js` (after `lobbyUrl,`). Append:

```js
test('the home stop leaves through Nav in the world frame, and to the lobby otherwise', () => {
  const went = [];
  const framed = { Nav: { embedded: true, lobby: '../../../lobby/grade-5.html', go: (u) => went.push(u) }, location: { href: '' } };
  leaveHome(framed, 'grade5');
  assert.deepEqual(went, ['../../../lobby/grade-5.html']);
  assert.equal(framed.location.href, '');

  const page = { Nav: { embedded: false, go: () => went.push('nav') }, location: { href: '' } };
  leaveHome(page, 'grade2');
  assert.equal(page.location.href, '../../../lobby/grade-2.html');
  const bare = { location: { href: '' } };
  leaveHome(bare, 'grade5');
  assert.equal(bare.location.href, '../../../lobby/grade-5.html');
  assert.equal(went.length, 1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/trail.test.js`
Expected: FAIL, `leaveHome is not a function`.

- [ ] **Step 3: Implement**

In `web/engine/trail.js`, after `function lobbyUrl(grade) {...}` (line 129) add:

```js
  function leaveHome(win, grade) {
    if (win.Nav && win.Nav.embedded) win.Nav.go(win.Nav.lobby);
    else win.location.href = lobbyUrl(grade);
  }
```

In `act(s)` replace

```js
      if (s.kind === 'home') { win.location.href = lobbyUrl(grade); return; }
```

with

```js
      if (s.kind === 'home') { leaveHome(win, grade); return; }
```

Add `leaveHome: leaveHome,` to `exported` (after `lobbyUrl: lobbyUrl,`).

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/trail.test.js tests/trail-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Suggested commit (owner runs it)**

```bash
git add web/engine/trail.js tests/trail.test.js && git commit -m 'Trail: the home stop closes the world frame in embed mode' -- web/engine/trail.js tests/trail.test.js
```

---

### Task 3: `portal.js` pure helpers

**Files:**
- Create: `web/world/portal.js`
- Test: `tests/world3d-portal.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/world3d-portal.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const P = require(worldFile('portal.js'));

const A = { pos: { x: 0, y: 10, z: 20 }, look: { x: 0, y: 3.4, z: 0 } };
const B = { pos: { x: 10, y: 4, z: 0 }, look: { x: 2, y: 4, z: -2 } };

test('ease starts at from, ends at to, and is halfway at the middle', () => {
  assert.deepEqual(P.ease(A, B, 0), A);
  assert.deepEqual(P.ease(A, B, 1), B);
  assert.deepEqual(P.ease(A, B, 0.5).pos, { x: 5, y: 7, z: 10 });
  assert.deepEqual(P.ease(A, B, -1), A, 'clamped below');
  assert.deepEqual(P.ease(A, B, 2), B, 'clamped above');
  assert.ok(P.ease(A, B, 0.1).pos.x < 1, 'starts slowly');
});

test('closer moves the camera most of the way to what it looks at, looking a little higher', () => {
  const c = P.closer(A);
  assert.deepEqual(c.pos, { x: 0, y: 10 + (3.4 - 10) * 0.6, z: 8 });
  assert.deepEqual(c.look, { x: 0, y: 3.4 + 0.6, z: 0 });
});

test('embedUrl adds embed=1 to the query, before any hash', () => {
  assert.equal(P.embedUrl('../subjects/grade-5/science/index.html?reset=1'), '../subjects/grade-5/science/index.html?reset=1&embed=1');
  assert.equal(P.embedUrl('page.html'), 'page.html?embed=1');
  assert.equal(P.embedUrl('page.html?a=1#x'), 'page.html?a=1&embed=1#x');
  assert.equal(P.embedUrl('page.html#x'), 'page.html?embed=1#x');
});

test('acceptMessage takes only a portal-close from the frame, same origin', () => {
  const frame = {};
  const good = { source: frame, origin: 'https://a.test', data: { type: 'portal-close' } };
  assert.equal(P.acceptMessage(good, frame, 'https://a.test'), true);
  assert.equal(P.acceptMessage(Object.assign({}, good, { source: {} }), frame, 'https://a.test'), false, 'another window');
  assert.equal(P.acceptMessage(Object.assign({}, good, { origin: 'https://b.test' }), frame, 'https://a.test'), false, 'another origin');
  assert.equal(P.acceptMessage(Object.assign({}, good, { data: { type: 'other' } }), frame, 'https://a.test'), false, 'another message');
  assert.equal(P.acceptMessage(Object.assign({}, good, { data: null }), frame, 'https://a.test'), false);
  assert.equal(P.acceptMessage(good, null, 'https://a.test'), false, 'no frame open');
  assert.equal(P.acceptMessage(Object.assign({}, good, { origin: 'null' }), frame, 'null'), true, 'file pages');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-portal.test.js`
Expected: FAIL, `Cannot find module …/web/world/portal.js`.

- [ ] **Step 3: Implement**

Create `web/world/portal.js`:

```js
/* Opens a game page inside the world: the camera glides toward her at the door, the world stops drawing and blurs,
   and the game runs in a framed iframe with ?embed=1 until it asks to close (nav.js) or ✕ is pressed. */
(function (root) {
  'use strict';

  function smooth(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }
  // k = 1 returns b's own numbers, so a glide ends exactly where it was aimed.
  function mix(a, b, k) {
    if (k === 1) return { x: b.x, y: b.y, z: b.z };
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
  }

  // pose = { pos, look }: where the camera is and the point it looks at.
  function ease(from, to, t) {
    var k = smooth(t);
    return { pos: mix(from.pos, to.pos, k), look: mix(from.look, to.look, k) };
  }

  function closer(pose) {
    return { pos: mix(pose.pos, pose.look, 0.6), look: { x: pose.look.x, y: pose.look.y + 0.6, z: pose.look.z } };
  }

  function embedUrl(url) {
    var hash = url.indexOf('#'), base = hash < 0 ? url : url.slice(0, hash), tail = hash < 0 ? '' : url.slice(hash);
    return base + (base.indexOf('?') < 0 ? '?' : '&') + 'embed=1' + tail;
  }

  function acceptMessage(evt, frameWin, origin) {
    return !!evt && !!frameWin && evt.source === frameWin && evt.origin === origin && !!evt.data && evt.data.type === 'portal-close';
  }

  var exported = { ease: ease, closer: closer, embedUrl: embedUrl, acceptMessage: acceptMessage };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Portal = exported;
})(this);
```

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/world3d-portal.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Suggested commit (owner runs it)**

```bash
git add web/world/portal.js tests/world3d-portal.test.js && git commit -m 'Portal: camera ease, embed URL and message check for games inside the world' -- web/world/portal.js tests/world3d-portal.test.js
```

---

### Task 4: `portal.js` state machine and view

**Files:**
- Modify: `web/world/portal.js`
- Test: `tests/world3d-portal.test.js`

The state machine never touches the DOM or Three.js; everything comes through `o`:

| dep | meaning |
|---|---|
| `camera.get()` / `camera.set(pose)` | read / place the camera as `{pos, look}` |
| `render()` | draw one frame |
| `freeze(on)` | stop / free her movement |
| `pauseWorld(on)` | stop / restart the frame loop, music and HUD |
| `view.show(url, color, title, onLoad)`, `view.hide()`, `view.win()` | the frame (Step 5 below) |
| `history` | `pushState`, `back` |
| `origin` | the world page's `location.origin` |
| `raf(fn)`, `now()`, `later(fn, ms)` → id, `cancel(id)` | timing |
| `instant()` | true: no glide (reduced motion, or the e2e driver) |
| `onClosed(then)` | after closing; `then` is `'shop'` or undefined |
| `fallback(href)` | the frame never loaded: open the plain page |

States: `closed` → `opening` (glide in) → `open` (frame shown) → `closing` (glide out) → `closed`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/world3d-portal.test.js`:

```js
function rig(over = {}) {
  const log = [];
  const hold = { onLoad: null };
  const frames = [];
  const timers = [];
  let t = 0;
  let pose = { pos: { x: 0, y: 10, z: 20 }, look: { x: 0, y: 3.4, z: 0 } };
  const frameWin = {};
  const history = {
    state: null,
    pushState(s) { this.state = s; log.push('push:' + s.portal); },
    back() { this.state = null; log.push('back'); },
  };
  const o = Object.assign({
    camera: { get: () => JSON.parse(JSON.stringify(pose)), set: (p) => { pose = p; } },
    render: () => {},
    freeze: (on) => log.push('freeze:' + on),
    pauseWorld: (on) => log.push('pause:' + on),
    view: {
      show: (url, color, title, onLoad) => { hold.onLoad = onLoad; log.push('show:' + url + '|' + color + '|' + title); },
      hide: () => log.push('hide'),
      win: () => frameWin,
    },
    history,
    origin: 'https://a.test',
    raf: (fn) => frames.push(fn),
    now: () => t,
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    cancel: (id) => { timers[id - 1] = null; },
    instant: () => true,
    onClosed: (then) => log.push('closed:' + then),
    fallback: (href) => log.push('fallback:' + href),
  }, over);
  const portal = P.create(o);
  return {
    portal, log, hold, frameWin, timers, history,
    pose: () => pose,
    tick(ms) { t += ms; frames.splice(0).forEach((fn) => fn()); },
    msg(data, source = frameWin, origin = 'https://a.test') { portal.message({ data, source, origin }); },
  };
}
const HREF = '../subjects/grade-5/science/index.html?reset=1';
const URL1 = HREF + '&embed=1';

test('open freezes her, pauses the world, adds a history entry and shows the frame with embed=1', () => {
  const r = rig();
  assert.equal(r.portal.open('life-lab', HREF, '#7bd88f', 'Science'), true);
  assert.deepEqual(r.log, ['freeze:true', 'pause:true', 'push:life-lab', 'show:' + URL1 + '|#7bd88f|Science']);
  assert.equal(r.portal.state(), 'open');
  assert.equal(r.portal.isOpen(), true);
  assert.equal(r.portal.url(), URL1);
  assert.equal(r.timers[0].ms, 8000, 'a load timeout');
});

test('a second open while one is open does nothing', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  const n = r.log.length;
  assert.equal(r.portal.open('math-mastery', HREF, '#fff', 'Math'), false);
  assert.equal(r.log.length, n);
});

test('the game\'s close message closes the frame, takes back the history entry and restarts the world', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.hold.onLoad();
  r.msg({ type: 'portal-close' });
  assert.deepEqual(r.log.slice(4), ['hide', 'back', 'pause:false', 'freeze:false', 'closed:undefined']);
  assert.equal(r.portal.isOpen(), false);
});

test('a close message asking for the shop passes it on', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.msg({ type: 'portal-close', then: 'shop' });
  assert.equal(r.log.at(-1), 'closed:shop');
  const s = rig();
  s.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  s.msg({ type: 'portal-close', then: 'elsewhere' });
  assert.equal(s.log.at(-1), 'closed:undefined', 'only the shop is passed on');
});

test('messages from another window or origin, or while closed, are ignored', () => {
  const r = rig();
  r.msg({ type: 'portal-close' });
  assert.deepEqual(r.log, [], 'closed');
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.msg({ type: 'portal-close' }, {});
  r.msg({ type: 'portal-close' }, r.frameWin, 'https://evil.test');
  assert.equal(r.portal.isOpen(), true);
});

test('the back gesture on the game home closes without stepping back again', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.portal.popstate({ portal: 'life-lab' });
  assert.equal(r.portal.isOpen(), true, 'still on our entry: the game stepped back inside itself');
  r.portal.popstate(null);
  assert.equal(r.portal.isOpen(), false);
  assert.equal(r.log.includes('back'), false);
  r.portal.popstate(null);
  assert.equal(r.log.filter((l) => l.startsWith('closed')).length, 1, 'ignored once closed');
});

test('✕ (close) works at any time and only once', () => {
  const r = rig();
  assert.equal(r.portal.close(), false, 'nothing open');
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  assert.equal(r.portal.close(), true);
  assert.equal(r.portal.close(), false);
});

test('a frame that never loads falls back to the plain page; a loaded one cancels the timeout', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.timers[0].fn();
  assert.deepEqual(r.log.slice(-2), ['hide', 'fallback:' + HREF]);
  assert.equal(r.portal.isOpen(), false);
  const s = rig();
  s.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  s.hold.onLoad();
  assert.equal(s.timers[0], null);
});

test('with motion the camera glides in over 600 ms before the frame shows, and back out on close', () => {
  const r = rig({ instant: () => false });
  const start = r.pose();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  assert.equal(r.portal.state(), 'opening');
  assert.equal(r.log.some((l) => l.startsWith('show')), false);
  r.tick(300);
  assert.ok(r.pose().pos.z < start.pos.z && r.pose().pos.z > P.closer(start).pos.z, 'part way');
  r.tick(300);
  assert.equal(r.portal.state(), 'open');
  assert.deepEqual(r.pose(), P.closer(start));
  r.portal.close();
  assert.equal(r.portal.state(), 'closing');
  r.tick(400);
  assert.equal(r.portal.state(), 'closed');
  assert.deepEqual(r.pose(), start);
  assert.equal(r.log.at(-1), 'closed:undefined');
});

test('closing during the glide in never shows the frame', () => {
  const r = rig({ instant: () => false });
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.tick(100);
  r.portal.close();
  r.tick(1000);
  r.tick(1000);
  assert.equal(r.log.some((l) => l.startsWith('show')), false);
  assert.equal(r.portal.state(), 'closed');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-portal.test.js`
Expected: FAIL, `P.create is not a function`.

- [ ] **Step 3: Implement the state machine**

In `web/world/portal.js`, before `var exported`, add:

```js
  var OPEN_MS = 600, CLOSE_MS = 400, LOAD_MS = 8000;

  function create(o) {
    var state = 'closed', url = null, home = null, glide = null, timer = null;

    function animate(from, to, ms, done) {
      var mine = glide = {};
      if (o.instant()) {
        o.camera.set(to);
        o.render();
        glide = null;
        done();
        return;
      }
      var start = o.now();
      function step() {
        if (glide !== mine) return;
        var t = Math.min(1, (o.now() - start) / ms);
        o.camera.set(ease(from, to, t));
        o.render();
        if (t < 1) o.raf(step);
        else { glide = null; done(); }
      }
      step();
    }

    function stopTimer() {
      if (timer !== null) o.cancel(timer);
      timer = null;
    }

    function open(app, href, color, title) {
      if (state !== 'closed') return false;
      state = 'opening';
      url = embedUrl(href);
      o.freeze(true);
      o.pauseWorld(true);
      home = o.camera.get();
      o.history.pushState({ portal: app || 'game' }, '');
      animate(home, closer(home), OPEN_MS, function () {
        if (state !== 'opening') return;
        state = 'open';
        o.view.show(url, color, title, stopTimer);
        timer = o.later(function () {
          timer = null;
          if (state !== 'open') return;
          state = 'closed';
          o.view.hide();
          o.fallback(href);
        }, LOAD_MS);
      });
      return true;
    }

    // popped: the browser already left our history entry (the back gesture).
    function close(then, popped) {
      if (state === 'closed' || state === 'closing') return false;
      stopTimer();
      state = 'closing';
      o.view.hide();
      if (!popped && o.history.state && o.history.state.portal) o.history.back();
      animate(o.camera.get(), home, CLOSE_MS, function () {
        state = 'closed';
        o.pauseWorld(false);
        o.freeze(false);
        o.onClosed(then);
      });
      return true;
    }

    return {
      open: open,
      close: function (then) { return close(then, false); },
      popstate: function (st) {
        if ((state === 'opening' || state === 'open') && !(st && st.portal)) close(undefined, true);
      },
      message: function (evt) {
        if (state !== 'open' || !acceptMessage(evt, o.view.win(), o.origin)) return;
        close(evt.data.then === 'shop' ? 'shop' : undefined, false);
      },
      isOpen: function () { return state !== 'closed'; },
      state: function () { return state; },
      url: function () { return url; }
    };
  }
```

Note on `close`: it checks `o.history.state` because the game's own history entries can sit above ours; the frame is removed first so its entries no longer count.

Change `exported` to:

```js
  var exported = { ease: ease, closer: closer, embedUrl: embedUrl, acceptMessage: acceptMessage, create: create, view: view,
    OPEN_MS: OPEN_MS, CLOSE_MS: CLOSE_MS, LOAD_MS: LOAD_MS };
```

- [ ] **Step 4: Add the view (DOM)**

In `web/world/portal.js`, before `var exported`, add:

```js
  // The frame: a full-screen layer with a card (the game's iframe) and a ✕ that always closes.
  function view(doc, label, onX) {
    var box = null, frame = null;
    return {
      show: function (url, color, title, onLoad) {
        box = doc.createElement('div');
        box.className = 'w-portal';
        box.style.setProperty('--portal-color', color || '#ffb84d');
        var card = doc.createElement('div');
        card.className = 'w-portal-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-label', title);
        frame = doc.createElement('iframe');
        frame.className = 'w-portal-frame';
        frame.title = title;
        frame.addEventListener('load', onLoad);
        frame.src = url;
        var x = doc.createElement('button');
        x.type = 'button';
        x.className = 'w-portal-x';
        x.textContent = '✕';
        x.setAttribute('aria-label', label);
        x.addEventListener('click', onX);
        card.appendChild(frame);
        card.appendChild(x);
        box.appendChild(card);
        doc.body.appendChild(box);
        doc.documentElement.classList.add('w-portal-on');
        frame.focus();
      },
      hide: function () {
        if (box && box.parentNode) box.parentNode.removeChild(box);
        box = frame = null;
        doc.documentElement.classList.remove('w-portal-on');
      },
      win: function () { return frame ? frame.contentWindow : null; }
    };
  }
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test tests/world3d-portal.test.js`
Expected: PASS (14 tests).

- [ ] **Step 6: Suggested commit (owner runs it)**

```bash
git add web/world/portal.js tests/world3d-portal.test.js && git commit -m 'Portal: open/close state machine (glide, pause, history entry, close message, load fallback) and the frame view' -- web/world/portal.js tests/world3d-portal.test.js
```

---

### Task 5: Wire the portal into the world

**Files:**
- Modify: `web/world/world-main.js`, `web/world/world.css`, `web/world/grade-5.html`, `web/world/grade-2.html`, `tests/paths.js`, `web/sw.js` (generated)

- [ ] **Step 1: Load the script (the wiring test fails first)**

In `tests/paths.js`, in `WORLD_FILES`, insert `'portal.js'` between `'loot3d.js'` and `'world-main.js'`.

Run: `node --test tests/world3d-wiring.test.js`
Expected: FAIL, "world grade 5 loads its scripts in order".

In both `web/world/grade-5.html` and `web/world/grade-2.html`, between `<script src="loot3d.js"></script>` and `<script src="world-main.js"></script>` add:

```html
<script src="portal.js"></script>
```

Run: `node --test tests/world3d-wiring.test.js`
Expected: PASS.

- [ ] **Step 2: Styles**

Append to `web/world/world.css`:

```css
/* A game inside the world (portal.js): a playful frame over the frozen, blurred town. */
.w-portal-on #stage canvas { filter: blur(6px) saturate(1.1); }
.w-portal { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 8px;
  background: rgba(255, 248, 235, .25); }
.w-portal-card { position: relative; width: min(900px, 100%); height: min(100dvh - 16px, 1100px);
  border: 6px solid var(--portal-color, #ffb84d); border-radius: 28px; background: #fff; overflow: hidden;
  box-shadow: 0 6px 0 rgba(0, 0, 0, .12), 0 18px 40px rgba(60, 30, 80, .25); animation: w-portal-pop .28s ease-out; }
.w-portal-frame { display: block; width: 100%; height: 100%; border: 0; }
.w-portal-x { position: absolute; top: 6px; right: 6px; width: 52px; height: 52px; border-radius: 50%;
  border: 3px solid var(--portal-color, #ffb84d); border-bottom-width: 7px; background: #fff; color: #4a3a1a;
  font: 800 1.4rem 'Baloo 2', system-ui, sans-serif; cursor: pointer; transition: transform .08s; }
.w-portal-x:active { transform: scale(.9); border-bottom-width: 3px; }
.w-portal-x:focus-visible { outline: 3px solid #4a3a1a; outline-offset: 2px; }
@keyframes w-portal-pop { from { transform: scale(.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .w-portal-card { animation: none; } }
```

The ✕ sits over the game's own top-right corner, where its ☰ button is. The game's `#nav-bar` is 52 px tall, so give the bar room for it in embed mode: in `web/engine/nav.js` `CSS`, add this rule after the `#nav-bar{…}` rule:

```js
    'html[data-embed] #nav-bar{padding-right:64px;}' +
```

and in `create()`, right after `if (embedded) doc.documentElement.setAttribute('data-theme', 'light');`, add:

```js
    if (embedded) doc.documentElement.setAttribute('data-embed', '');
```

- [ ] **Step 3: Create the portal in `world-main.js`**

In `start()`, right after `var nudge = W.Nudge.create(), nudgeDue = false;` (line 276), add:

```js
    // A game inside the world (portal.js). portalInstant: the e2e driver skips the camera glide.
    var portalInstant = false;
    function reduced() {
      try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }
    function pauseWorld(on) {
      hud.show(!on);
      if (on) {
        paused = true;
        music.stop();
        sfx.stopAll(0);
        return;
      }
      paused = false;
      clock.getDelta();
      if (wantMusic()) music.start();
      frame();
    }
    var portal = W.Portal.create({
      camera: {
        get: function () {
          var p = S.camera.position;
          return { pos: { x: p.x, y: p.y, z: p.z }, look: { x: ctl.state.x, y: 3.4, z: ctl.state.z } };
        },
        set: function (pose) {
          S.camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
          S.camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
        }
      },
      render: function () { if (!lost) S.render(); },
      freeze: function (on) { ctl.freeze(on || talking || gameFreeze); },
      pauseWorld: pauseWorld,
      view: W.Portal.view(doc, T.close, function () { portal.close(); }),
      history: root.history,
      origin: root.location.origin,
      raf: function (fn) { root.requestAnimationFrame(fn); },
      now: function () { return root.performance.now(); },
      later: function (fn, ms) { return root.setTimeout(fn, ms); },
      cancel: function (id) { root.clearTimeout(id); },
      instant: function () { return portalInstant || reduced(); },
      onClosed: function (then) {
        refresh();
        welcome(W.Prefs.readReturn(session));
        if (then === 'shop') debug.go(lobbyUrl + '#shop-world');
      },
      fallback: function (href) { debug.go(href); }
    });
    // The frame takes the building's roof colour and sign; the fort has no building, so gold.
    function openGame(app, href) {
      var b = L.buildings(grade).filter(function (x) { return x.app === app; })[0];
      portal.open(app, href, b ? b.roof : '#ffb84d', b ? english(b.sign) : T.title);
    }
    root.addEventListener('message', function (e) { portal.message(e); });
    root.addEventListener('popstate', function (e) { portal.popstate(e.state); });
```

`wantMusic`, `frame`, `welcome` and `refresh` are function declarations inside `start()`, so they are hoisted; `town` and `folk` only call `openGame` later, at tap time.

- [ ] **Step 4: Send doors, buddies and the fort through it**

In `act()`, change the first line and the door branch to:

```js
      if (!near || maker || overlay || talking || stall || deco || portal.isOpen()) return;
      if (near.kind === 'door') {
        leaving(near.app);
        openGame(near.app, town.doorHref(near.app, L.appUrl(grade, near.folder)));
      } else if (near.kind === 'mirror') openMaker();
```

In the `W.Town.create({...})` options, change `go` to:

```js
      go: function (url) { openGame('boss', url); }, sound: sound, busy: busy, today: today,
```

(`town.js` only calls `o.go` from `enterFort`, after `o.leave('boss')`.)

In the `W.Folk.create({...})` options, change `open` to:

```js
      open: function (app, href) { leaving(app); openGame(app, href); },
```

- [ ] **Step 5: Keys and debug hooks**

At the very top of the `doc.addEventListener('keydown', function (e) {` handler (before the `useBar` line), add:

```js
      if (portal.isOpen()) {
        if (e.key === 'Escape') portal.close();
        return;
      }
```

Next to `debug.pause = function () { paused = true; };` add:

```js
    debug.paused = function () { return paused; };
    debug.portal = {
      isOpen: portal.isOpen, state: portal.state, url: portal.url,
      close: function (then) { return portal.close(then); },
      instant: function (on) { portalInstant = !!on; }
    };
```

- [ ] **Step 6: Precache and unit tests**

Run: `node tools/update-precache.js`
Then: `node --test`
Expected: all PASS (`tests/pwa.test.js` now sees `world/portal.js` in `web/sw.js`).

- [ ] **Step 7: Suggested commit (owner runs it)**

```bash
git add web/world/world-main.js web/world/world.css web/world/grade-5.html web/world/grade-2.html web/engine/nav.js tests/paths.js web/sw.js && git commit -m 'World: doors, buddies and the fort open the game in a frame over the paused, blurred town' -- web/world/world-main.js web/world/world.css web/world/grade-5.html web/world/grade-2.html web/engine/nav.js tests/paths.js web/sw.js
```

---

### Task 6: Keep the world e2e passing

**Files:**
- Modify: `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`

The `fresh` and `progress` cases caught the door's page change through `D.go`; the door now opens the portal.

- [ ] **Step 1: Run the world e2e to see the two cases fail**

Run: `node tests/e2e/world-e2e.js`
Expected: FAIL at `fresh.went` (null).

- [ ] **Step 2: Update the `fresh` case**

In `tests/e2e/world-driver.page.js`, in `if (mode === 'fresh') {`, replace

```js
      var went = null;
      D.go = function (u) { went = u; };
      D.act();
      o.went = went;
      o.ret = JSON.parse(sessionStorage.getItem('world_return_v1'));
```

with

```js
      D.portal.instant(true);
      D.act();
      o.went = D.portal.url();
      o.portalOpen = D.portal.isOpen();
      o.ret = JSON.parse(sessionStorage.getItem('world_return_v1'));
      D.portal.close();
```

(`o.ret` is read before closing: closing runs the welcome, which drops `before`.)

In `tests/e2e/world-e2e.js`, replace the `fresh.went` assertion with:

```js
  assert.equal(fresh.went, '../subjects/grade-5/science/index.html?reset=1&embed=1', 'the door opens the lobby card\'s page in the frame');
  assert.equal(fresh.portalOpen, true);
```

- [ ] **Step 3: Update the `progress` case**

In `tests/e2e/world-driver.page.js`, in `if (mode === 'progress') {`, replace

```js
      var went = null;
      D.go = function (u) { went = u; };
      D.teleport('life-lab');
      o.trailAfterArrive = D.trail();
      D.act();
      o.doorWent = went;
```

with

```js
      D.portal.instant(true);
      D.teleport('life-lab');
      o.trailAfterArrive = D.trail();
      D.act();
      o.doorWent = D.portal.url();
      D.portal.close();
```

In `tests/e2e/world-e2e.js`, change the `prog.doorWent` assertion's expected value to `'../subjects/grade-5/science/index.html?reset=1&boss=1&embed=1'`. Leave `prog.fortHref` as it is (it reads the snapshot, not the portal).

- [ ] **Step 4: Run the world e2e to see it pass**

Run: `node tests/e2e/world-e2e.js`
Expected: every case prints `ok`. If another case fails because it used `D.go` for a door, buddy or fort, change it the same way (`D.portal.instant(true)`, read `D.portal.url()`, then `D.portal.close()`), and expect `&embed=1` on the URL.

- [ ] **Step 5: Suggested commit (owner runs it)**

```bash
git add tests/e2e/world-driver.page.js tests/e2e/world-e2e.js && git commit -m 'World e2e: doors open the game frame (embed=1)' -- tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 7: World and game together (new e2e)

**Files:**
- Create: `tests/e2e/portal-e2e.js`, `tests/e2e/portal-world.page.js`, `tests/e2e/portal-game.page.js`

Pages are `file://` here, so the world cannot read the frame's DOM; the game's driver writes what it sees into `localStorage` (shared by `file://` pages in Chrome) and leaves through ← like she would.

- [ ] **Step 1: The game-side driver**

Create `tests/e2e/portal-game.page.js`:

```js
// Runs inside the Science game when the world opens it in its frame: notes what embed mode changed, then presses ←
// on the game home, which should close the frame.
(function () {
  var r = {
    embedded: !!(window.Nav && Nav.embedded),
    theme: document.documentElement.getAttribute('data-theme'),
    lobbyItem: document.getElementById('nav-lobby') ? document.getElementById('nav-lobby').textContent : null,
    errors: window.__e2eErrors || []
  };
  localStorage.setItem('e2e_portal_game', JSON.stringify(r));
  if (r.embedded) setTimeout(function () { document.getElementById('nav-back').click(); }, 100);
})();
```

- [ ] **Step 2: The world-side driver**

Create `tests/e2e/portal-world.page.js`:

```js
// Drives the world for portal-e2e.js: open the Science door with the real glide, wait for the frame, let the game
// close it, then check ✕ and a second tap while open.
(function () {
  var sent = false;
  function out(o) {
    if (sent) return;
    sent = true;
    if (window.WorldDebug && WorldDebug.pause) WorldDebug.pause();
    o.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(o);
    document.body.appendChild(pre);
  }
  function waitFor(check, then, tries) {
    tries = tries === undefined ? 200 : tries;
    if (check() || tries <= 0) return then();
    setTimeout(function () { waitFor(check, then, tries - 1); }, 50);
  }
  function blurred() {
    var c = document.querySelector('#stage canvas');
    return document.documentElement.classList.contains('w-portal-on') && !!c && getComputedStyle(c).filter.indexOf('blur') >= 0;
  }
  waitFor(function () { return window.WorldDebug && WorldDebug.ready; }, function () {
    var D = window.WorldDebug, o = {};
    localStorage.removeItem('e2e_portal_game');
    D.teleport('life-lab');
    o.near = D.state().near;
    D.act();
    o.first = D.portal.state();
    o.pausedWhileOpening = D.paused();
    o.url = D.portal.url();
    o.entry = !!(history.state && history.state.portal);
    waitFor(function () { return D.portal.state() === 'open'; }, function () {
      o.opened = D.portal.state();
      o.blurred = blurred();
      o.frameSrc = document.querySelector('.w-portal-frame').getAttribute('src');
      o.color = document.querySelector('.w-portal').style.getPropertyValue('--portal-color');
      o.hudHidden = document.querySelector('.w-hud').hidden;
      waitFor(function () { return !D.portal.isOpen(); }, function () {
        o.game = JSON.parse(localStorage.getItem('e2e_portal_game'));
        o.closed = !D.portal.isOpen();
        o.frameGone = !document.querySelector('.w-portal');
        o.blurGone = !blurred();
        o.pausedAfter = D.paused();
        o.hudBack = !document.querySelector('.w-hud').hidden;
        o.entryAfter = !!(history.state && history.state.portal);
        D.portal.instant(true);
        D.teleport('life-lab');
        D.act();
        o.xOpen = D.portal.state();
        D.act();
        o.frames = document.querySelectorAll('.w-portal').length;
        document.querySelector('.w-portal-x').click();
        o.xClosed = !D.portal.isOpen() && !document.querySelector('.w-portal');
        out(o);
      });
    });
  });
})();
```

- [ ] **Step 3: The runner**

Create `tests/e2e/portal-e2e.js`:

```js
// A game inside the 3D world: the Science door glides in, the world stops and blurs, the real game runs in the frame
// in embed mode (light theme, Back to town), ← on the game home closes it, and ✕ closes it at once.
// Run: node tests/e2e/portal-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver, injectDriver, WEBGL_ARGS } = require('./chrome.js');
const { WORLDS, VENDOR_FILES, ENGINE_FILES, web, app, appFile } = require('../paths.js');

const work = makeWorkDir('portal-e2e');
const site = path.join(work, 'site');
const SEED = '<script>(function () { var k = Guide.dayKey(Date.now());'
  + 'Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: k, bossWin: Boss.weekKey(Date.now()), t: 1 }));'
  + 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "bob", hairColor: 2, outfit: 3, pet: "kitten", petName: "Tom", t: 5 })); })();</script>';

let world = fs.readFileSync(web(WORLDS[5]), 'utf8');
const three = '<script src="../vendor/three/three.min.js"></script>';
if (!world.includes(three)) throw new Error('three.min.js tag not found');
world = world.replace(three, SEED + three);
const worldFile = stage(site, WORLDS[5], appendDriver(world, fs.readFileSync(path.join(__dirname, 'portal-world.page.js'), 'utf8')), ENGINE_FILES);
for (const f of VENDOR_FILES) {
  const to = path.join(site, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(web(f), to);
}
fs.copyFileSync(web('world/world.css'), path.join(site, 'world', 'world.css'));

const game = injectDriver(fs.readFileSync(appFile('life-lab'), 'utf8'), fs.readFileSync(path.join(__dirname, 'portal-game.page.js'), 'utf8'));
stage(site, app('life-lab').page, game, ENGINE_FILES);

const r = readOutput(dumpDom(path.join(work, 'profile'), worldFile, '', 15000, WEBGL_ARGS));
assert.deepEqual(r.errors, [], 'world page errors');
assert.equal(r.near, 'life-lab');
assert.equal(r.first, 'opening', 'the camera glides in first');
assert.equal(r.pausedWhileOpening, true, 'the world stops drawing during the glide');
assert.equal(r.url, '../subjects/grade-5/science/index.html?reset=1&embed=1');
assert.equal(r.entry, true, 'one history entry for the frame');
assert.equal(r.opened, 'open');
assert.equal(r.blurred, true, 'the frozen town is blurred');
assert.equal(r.frameSrc, r.url);
assert.match(r.color, /^#[0-9a-f]{6}$/i, 'the frame takes the building\'s roof colour');
assert.equal(r.hudHidden, true, 'the HUD hides under the frame');
assert.ok(r.game, 'the game ran inside the frame');
assert.deepEqual(r.game.errors, [], 'game page errors');
assert.equal(r.game.embedded, true, 'the game knows it is in the frame');
assert.equal(r.game.theme, 'light', 'the game is locked to light inside the frame');
assert.equal(r.game.lobbyItem, '🏠 Back to town');
assert.equal(r.closed, true, '← on the game home closed the frame');
assert.equal(r.frameGone, true);
assert.equal(r.blurGone, true);
assert.equal(r.pausedAfter, false, 'the world draws again');
assert.equal(r.hudBack, true, 'the HUD is back');
assert.equal(r.entryAfter, false, 'the frame\'s history entry is gone');
assert.equal(r.xOpen, 'open');
assert.equal(r.frames, 1, 'a second tap while open opens nothing');
assert.equal(r.xClosed, true, '✕ closes at once');
console.log('ok game inside the world: glide, blur, embed mode, close from the game, ✕');
```

- [ ] **Step 4: Run it**

Run: `node tests/e2e/portal-e2e.js`
Expected: `ok game inside the world: glide, blur, embed mode, close from the game, ✕`.

If `r.game` is null: the frame did not run the game driver. Check that `stage` copied `subjects/grade-5/science/lessons/*.js` (it copies every script `src` that does not start with `.` or `/`) and that `injectDriver` found `renderHome();` in the Science page. If `r.closed` is false but `r.game.embedded` is true, the close message was rejected: log `e.origin` and `location.origin` in the world's `message` listener (both should be `"null"` on `file://`).

- [ ] **Step 5: Run the whole suite**

Run: `node --test` then `node tests/e2e/world-e2e.js`, `node tests/e2e/nav-e2e.js`, `node tests/e2e/guide-e2e.js`, `node tests/e2e/portal-e2e.js`.
Expected: all PASS.

- [ ] **Step 6: Suggested commit (owner runs it)**

```bash
git add tests/e2e/portal-e2e.js tests/e2e/portal-world.page.js tests/e2e/portal-game.page.js && git commit -m 'Portal e2e: Science door opens the real game in the frame, game closes it, ✕ closes it' -- tests/e2e/portal-e2e.js tests/e2e/portal-world.page.js tests/e2e/portal-game.page.js
```

---

### Task 8: Docs

**Files:**
- Modify: `README.md`, `docs/HANDOFF.md`

- [ ] **Step 1: README e2e list**

In `README.md`, after the `node tests/e2e/world-e2e.js …` line, add:

```
node tests/e2e/portal-e2e.js         # a game inside the world: the door glides in, the town blurs, the game runs in the frame (embed mode), ← and ✕ close it
```

- [ ] **Step 2: HANDOFF**

In `docs/HANDOFF.md`, under **3D world**, add a bullet:

```markdown
- Games inside the world (2026-10-11): a door, a buddy's "Let's go" or the Boss Fort opens the real game page in a
  framed iframe over the paused, blurred town (`web/world/portal.js`); the game runs with `?embed=1` (`Nav.embedded`):
  ←/🏠 on the game home, the menu's 🏠 Back to town and the lesson path's home stop close the frame, ☰ Shop closes it
  and opens the lobby shop, and the game is locked to light inside. Closing replays her pet's welcome without a reload.
  The lobby and the phone page still open games as pages. Spec and plan: `docs/superpowers/specs/2026-10-11-games-in-world-design.md`,
  `docs/superpowers/plans/2026-10-11-games-in-world.md`. Tablet check pending (glide smoothness, frame size on phone
  and tablet, the back gesture after a quiz, the pet's welcome).
```

Under **Next**, add:

```markdown
- **App inside the world, sub-projects A, C, D** (from the 2026-10-11 brainstorm; brainstorm each first): A, lock games
  and lobbies to light (today they follow the device's dark mode) and restyle; C, sign-in goes straight to the world
  with the shop, quests, search, settings and the PIN-gated parent area as overlays (lobby stays as the no-WebGL
  fallback); D, HUD tidy-up and lazy loading after measuring the tablet.
```

- [ ] **Step 3: Suggested commit (owner runs it)**

```bash
git add README.md docs/HANDOFF.md docs/superpowers/plans/2026-10-11-games-in-world.md && git commit -m 'Games inside the world: docs and plan' -- README.md docs/HANDOFF.md docs/superpowers/plans/2026-10-11-games-in-world.md
```

---

## Owner tablet check (after the build)

- The glide in and out is smooth; the blur shows; the frame fits the tablet and the phone.
- A full quiz inside the frame, then 🏠: the leave-quiz check, then back in town with the pet's welcome.
- The back gesture: from a quiz screen it goes to the game home; from the game home it closes the frame; one more back
  leaves the world as before (not a dead tap).
- ☰ Shop from inside a game opens the lobby shop, and closing the shop returns to the world.
