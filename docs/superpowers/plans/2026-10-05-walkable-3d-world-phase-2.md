# Walkable 3D World — Phase 2 Implementation Plan (the map's logic in 3D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D world follow her progress: buildings level up with medals, ⚔️ ❗ 🔁 markers float over the right buildings, Mayor Mimi by the fountain gives the guide's next step and lights a sparkle trail to it, Bunny's shop counter opens the reward shop (a hop to the lobby's shop and back), and the Boss Fort opens this week's next boss stage.

**Architecture:** The 3D world reads the same engines the lobby uses, loaded on the world pages: medals (`mastery.js`), due review (`recall.js`), quests, boss, wallet and the guide. `engine/world.js` (the 2D map) gains an exported `liveDeps(win)` so both maps read progress the same way through its existing pure `status()`. New pure `web/world/progress.js` turns that into a snapshot; new `decor.js` draws it; `cast.js` holds Mayor Mimi; `talk.js` is the speech bubble; `town.js` is the Phase 2 controller that `world-main.js` delegates to. The shop is not moved: Bunny opens `lobby/grade-N.html#shop-world`, and closing the shop there sends her back to Shop Plaza.

**Tech Stack:** Plain HTML/CSS/JS (no build step), Three.js r149 (vendored, global `THREE`), `node --test`, headless Chrome e2e (`tests/e2e/chrome.js`).

**Spec:** `docs/superpowers/specs/2026-10-05-walkable-3d-world-design.md`, "Phase 2". **User decision 2026-10-05:** the shop opens by hopping to the lobby's shop and back (option A), not by moving the shop into `engine/shop.js`.

**Phase 1 code this builds on (committed):** `web/world/{text,layout,look,prefs,walk,music,scene,build,avatar,move,maker,world-main}.js`, `world.css`, `grade-5.html`, `grade-2.html`; `tests/world3d-*.test.js`; `tests/e2e/world-e2e.js` + `world-driver.page.js`.

**House rules (read before starting):**
- Never run `git commit`. Each task ends by staging with `git add`; the user commits.
- Comments sparingly. Browser files: ES5 `var`/`function`, IIFE `(function (root) { ... })(this)`. Tests: `const`, arrow functions, `node:test`.
- Grade 2: labels pair Filipino with English (`Filipino · English`); buttons are English only.
- After adding a file under `web/`, run `node tools/update-precache.js`.
- Run unit tests from the repo root with `node --test`.
- Edits to existing files are given as "find this exact text → replace with". If the text is not found exactly, stop and report it.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `web/engine/world.js` | Modify | Export `liveDeps(win)`; the 2D map uses it too |
| `web/world/text.js` | Modify | Words for Mimi, the shop counter and the Boss Fort |
| `web/world/layout.js` | Modify | Mimi's spot, the moved signpost, the counter and fort-gate spots, `spawnFor` places, `route()` for the trail |
| `web/world/prefs.js` | Modify | `world3d_v1` daily marks (`mimi`) |
| `web/world/progress.js` | Create | Pure snapshot: levels, markers, shop sparkle, fort, guide step and links |
| `web/world/scene.js` | Modify | `badge(text)` marker texture; shared `pill()` |
| `web/world/build.js` | Modify | Return each building's group, roof meshes and sign height, the shop group and the fort's door |
| `web/world/decor.js` | Create | Medal flags/banners/gold roofs, markers, shop ✨, fort count and glow, sparkle trail |
| `web/world/cast.js` | Create | Mayor Mimi (Phase 3 adds more characters here) |
| `web/world/talk.js` | Create | The speech bubble |
| `web/world/town.js` | Create | Phase 2 controller: snapshot → decor, Mimi, counter, fort |
| `web/world/world-main.js` | Modify | Create the town, delegate labels/actions, door links from the guide |
| `web/world/world.css` | Modify | Speech bubble styles |
| `web/world/grade-5.html`, `grade-2.html` | Modify | Load the progress engines and the new files |
| `web/lobby/grade-5.html`, `grade-2.html` | Modify | `#shop-world`: open the shop, and closing it returns to the world |
| `tests/paths.js` | Modify | `WORLD_FILES`, new `WORLD_ENGINES` |
| `tests/world.test.js`, `tests/world3d-*.test.js` | Modify / create | Unit + wiring tests |
| `tests/e2e/world-e2e.js`, `world-driver.page.js` | Modify | Progress and shop-return cases |

---

### Task 1: `liveDeps` in the 2D map engine

**Files:**
- Modify: `web/engine/world.js` (the `try { ... root.World = api; }` block at the end, and the `exported` object)
- Test: `tests/world.test.js` (append)

- [ ] **Step 1: Append the failing test to `tests/world.test.js`**

The file already has `const W = require(engineFile('world.js'));` at the top.

```js
test('liveDeps reads the live engines, and a page without them reads nothing', () => {
  const empty = W.liveDeps({});
  assert.deepEqual(empty.due(), {});
  assert.deepEqual(empty.quests(), []);
  assert.deepEqual(empty.boss(), {});
  assert.equal(empty.canAfford(), false);
  assert.equal(empty.tally('x'), null);
  assert.equal(empty.guide([]), null);

  const win = {
    Recall: { dueByApp: () => ({ a: 2 }) },
    Boss: { current: () => ({ stages: [{ app: 'a', cleared: false }] }) },
    Wallet: { canAfford: () => true },
    Mastery: { summary: () => ({ apps: { a: 'E' } }), counts: (e) => (e === 'E' ? { gold: 1, silver: 0, bronze: 0, total: 1 } : null) },
    Quests: { state: () => ({ list: [{ app: 'a', done: false }] }) },
    Guide: { step: (cards, o) => ({ kind: 'boss', app: cards[0].app, afford: o.canAfford }) },
  };
  const st = W.status(['a'], W.liveDeps(win));
  assert.equal(st.apps.a.level, 3);
  assert.deepEqual(st.apps.a.markers.map((m) => m.kind), ['boss', 'quest']);
  assert.equal(st.shop.sparkle, true);
  assert.deepEqual(W.liveDeps(win).guide([{ app: 'a' }]), { kind: 'boss', app: 'a', afford: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world.test.js`
Expected: FAIL, `W.liveDeps is not a function`.

- [ ] **Step 3: Add `liveDeps` to `web/engine/world.js`**

Find:

```js
  var exported = { readState: readState, saveState: saveState, status: status, levelOf: levelOf, rects: rects, radius: radius,
```

Insert directly above it:

```js
  // Where a live page reads her progress: the lobby's 2D map and the 3D world (web/world/) both use this.
  function liveDeps(win) {
    return {
      now: Date.now,
      tally: function (app) { var M = win.Mastery; return M && M.summary && M.counts ? M.counts(M.summary().apps[app]) : null; },
      due: function () { return win.Recall && win.Recall.dueByApp ? win.Recall.dueByApp() : {}; },
      quests: function () { return win.Quests && win.Quests.state ? win.Quests.state().list : []; },
      boss: function () { return win.Boss && win.Boss.current ? win.Boss.current() : {}; },
      canAfford: function () { var Wa = win.Wallet; return !!(Wa && Wa.canAfford && Wa.canAfford()); },
      guide: function (cards) {
        var G = win.Guide, Wa = win.Wallet;
        return G && G.step ? G.step(cards, { canAfford: !!(Wa && Wa.canAfford && Wa.canAfford()) }) : null;
      }
    };
  }

```

In the `exported` object, add `liveDeps: liveDeps,` right after `status: status,`.

Find the whole `api = mountUi(root, grade, storage, { ... });` call (it starts with `api = mountUi(root, grade, storage, {` and ends with `});` after the `guide:` function) and replace it with:

```js
      api = mountUi(root, grade, storage, liveDeps(root));
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world.test.js tests/world-wiring.test.js && node tests/e2e/guide-e2e.js`
Expected: PASS; guide-e2e prints its `ok` lines (the 2D map still reads progress the same way).

- [ ] **Step 5: Stage**

```bash
git add web/engine/world.js tests/world.test.js
```

---

### Task 2: Words for Mimi, the counter and the fort (`text.js`)

**Files:**
- Modify: `web/world/text.js`
- Test: `tests/world3d-text.test.js`

- [ ] **Step 1: Extend the test's English-only button list** (`tests/world3d-text.test.js`)

Find:

```js
  'maker.pets.chick', 'maker.pets.kitten', 'maker.pets.puppy', 'petNames.chick', 'petNames.kitten', 'petNames.puppy']);
```

Replace with:

```js
  'maker.pets.chick', 'maker.pets.kitten', 'maker.pets.puppy', 'petNames.chick', 'petNames.kitten', 'petNames.puppy',
  'mimiTalk', 'goTrail', 'later', 'counter', 'fortGo', 'fortClosed']);
```

Append:

```js
test('counts go into the fort words through {c} and {n}', () => {
  for (const g of ['grade5', 'grade2']) assert.ok(TEXT[g].fortCount.includes('{c}') && TEXT[g].fortCount.includes('{n}'), g);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-text.test.js`
Expected: FAIL (`both grades have the same words` passes, the new test fails: `fortCount` undefined).

- [ ] **Step 3: Add the words** (`web/world/text.js`)

Find:

```js
  var BUTTONS = {
    go: 'Go to {name}!', mirror: '🪞 Change my look', signpost: '⚡ Quick travel', close: 'Close', lobby: '🏠 Lobby',
```

Replace with:

```js
  var BUTTONS = {
    mimiTalk: '💬 Talk to Mayor Mimi', goTrail: 'Go ▶', later: 'Later', counter: '🛍️ Open the shop',
    fortGo: '⚔️ Enter the Boss Fort!', fortClosed: '💤 Boss Fort',
    go: 'Go to {name}!', mirror: '🪞 Change my look', signpost: '⚡ Quick travel', close: 'Close', lobby: '🏠 Lobby',
```

In `grade5: words({`, after the line `travelTitle: '⚡ Where to?', settingsTitle: 'Settings', music: '🎵 Music', sound: '🔊 Sound', quality: 'Quality',` add:

```js
      mimi: 'Mayor Mimi', mimiIdle: 'Hello! Explore the world and have fun!', follow: 'Follow the sparkles ✨',
      fortCount: '⚔️ {c} of {n} stages cleared', fortNone: '🐉 The boss comes when you have played a few games',
      fortBeaten: '🏆 Boss beaten! A new boss comes on Monday',
```

In `grade2: words({`, after the line `sound: '🔊 Tunog · Sound', quality: 'Linaw · Quality',` add:

```js
      mimi: 'Mayora Mimi · Mayor Mimi', mimiIdle: 'Kumusta! Maglibot at magsaya sa bayan! · Hello! Explore the world and have fun!',
      follow: 'Sundan ang mga kislap ✨ · Follow the sparkles ✨',
      fortCount: '⚔️ {c} sa {n} na yugto ang tapos · {c} of {n} stages cleared',
      fortNone: '🐉 Darating ang boss kapag nakapaglaro ka na · The boss comes when you have played a few games',
      fortBeaten: '🏆 Natalo mo na ang Boss! Bagong boss sa Lunes · Boss beaten! A new boss comes on Monday',
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-text.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Stage**

```bash
git add web/world/text.js tests/world3d-text.test.js
```

---

### Task 3: Layout — Mimi, the counter, the fort gate, places as return spots, and the trail route

**Files:**
- Modify: `web/world/layout.js`
- Test: `tests/world3d-layout.test.js`

The signpost moves from (7.5, 7.5) to (−7.5, −7.5) because the path to My Little House runs through (7.5, 7.5). Mayor Mimi stands at (6.5, −6), beside the street's mouth, facing the gate.

- [ ] **Step 1: Append the failing tests to `tests/world3d-layout.test.js`**

```js
for (const grade of ['grade5', 'grade2']) {
  test(grade + ': Mimi, the shop counter and the fort gate can be walked up to', () => {
    const ids = L.interactables(grade).map((i) => i.id);
    for (const id of ['mimi', 'counter', 'fort', 'signpost', 'mirror']) assert.ok(ids.includes(id), id);
  });

  test(grade + ': every trail starts at the plaza, ends at its spot and stays in the open', () => {
    const obs = L.obstacles(grade);
    const bounds = L.GRADES[grade].bounds;
    for (const s of L.spots(grade)) {
      const pts = L.route(grade, s.id);
      assert.ok(pts.length >= 2, s.id);
      assert.ok(Math.hypot(pts[0][0], pts[0][1]) <= 6, s.id + ' starts at the plaza');
      assert.deepEqual(pts[pts.length - 1], [s.x, s.z], s.id + ' ends at the spot');
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
        for (let k = 0; k <= steps; k++) {
          const x = ax + (bx - ax) * k / steps;
          const z = az + (bz - az) * k / steps;
          assert.equal(L.blocked(obs, bounds, x, z, 0.3), false, s.id + ' trail is blocked at ' + x.toFixed(1) + ',' + z.toFixed(1));
        }
      }
    }
    assert.deepEqual(L.route(grade, 'nowhere'), []);
  });
}

test('back from the shop or the fort she starts in that place', () => {
  assert.equal(L.spawnFor('grade5', { grade: 'grade5', app: 'shop' }).id, 'shop');
  assert.equal(L.spawnFor('grade2', { grade: 'grade2', app: 'boss' }).id, 'boss');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-layout.test.js`
Expected: FAIL: `mimi` missing, `L.route is not a function`, spawn `shop` gives `gate`.

- [ ] **Step 3: Change `web/world/layout.js`**

(a) Find:

```js
  var PLACE_ORDER = ['gate', 'plaza', 'garden', 'shop', 'park', 'house', 'playground', 'boss'];
```

Insert directly above it:

```js
  // Where each side path leaves the plaza for its place (the street, gate and playground run along x = 0).
  var PATH_END = { garden: [-50, 0], shop: [54, 0], park: [-44, 42], house: [46, 44] };
```

(b) In `props`, find:

```js
      signpost: { x: 7.5, z: 7.5, r: 0.5 },
```

Replace with:

```js
      signpost: { x: -7.5, z: -7.5, r: 0.5 },
      mimi: { x: 6.5, z: -6, r: 0.8 },
```

(c) Replace the whole `paths` function with:

```js
  function paths(grade) {
    var p = places(grade);
    var out = [
      { from: [0, p.gate.z], to: [0, 0], w: 7 },
      { from: [0, 0], to: [0, p.boss.z + 10], w: STREET.half * 2 }
    ];
    ['garden', 'shop'].forEach(function (id) { out.push({ from: [0, 0], to: PATH_END[id], w: 6 }); });
    ['park', 'house'].forEach(function (id) { out.push({ from: [0, 0], to: PATH_END[id], w: 5 }); });
    out.push({ from: [0, 74], to: [16, 74], w: 5 });
    return out;
  }
```

(d) In `obstacles`, find:

```js
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mirror, pr.pond, pr.merry].concat(pr.posts,
```

Replace with:

```js
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mimi, pr.mirror, pr.pond, pr.merry].concat(pr.posts,
```

(e) In `interactables`, find the two `list.push(...)` lines for the mirror and the signpost (they read from `pr`, e.g. `list.push({ kind: 'mirror', id: 'mirror', x: pr.mirror.x, z: pr.mirror.z - 2.4, r: 2.4 });` and the signpost one). Directly after the signpost push, add:

```js
    list.push({ kind: 'mimi', id: 'mimi', x: pr.mimi.x, z: pr.mimi.z, r: 3.2 });
    list.push({ kind: 'counter', id: 'counter', x: pr.shop.x - pr.shop.hx - 1.4, z: pr.shop.z, r: 2.6 });
    list.push({ kind: 'fort', id: 'fort', x: pr.fort.x, z: pr.fort.z + pr.fort.r + 2, r: 3 });
```

(If `interactables` does not already define `var pr = props(grade);`, add it as its first line.)

(f) Replace the whole `spawnFor` function with:

```js
  // Back from a game she starts at its door; back from the shop or the fort, in that place.
  function spawnFor(grade, ret) {
    var all = spots(grade);
    var hit = ret && ret.grade === grade ? all.filter(function (s) { return s.id === ret.app; })[0] : null;
    return hit || all[0];
  }

  // Mayor Mimi's sparkle trail: from the plaza, along the paths, to a quick-travel spot. [] for an unknown spot.
  function route(grade, id) {
    var spot = spots(grade).filter(function (s) { return s.id === id; })[0];
    if (!spot) return [];
    var lead;
    if (spot.kind === 'door' || id === 'boss') lead = [[0, -5], [0, spot.z]];
    else if (id === 'playground') lead = [[0, 5], [0, 76], [22, 76]];
    else if (id === 'gate' || id === 'plaza') lead = [[0, 5]];
    else {
      var end = PATH_END[id], len = Math.hypot(end[0], end[1]);
      lead = [[5 * end[0] / len, 5 * end[1] / len], end];
    }
    return lead.concat([[spot.x, spot.z]]);
  }
```

(g) Add `route: route` to the `exported` object (after `spawnFor: spawnFor,`).

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-layout.test.js`
Expected: PASS. If a trail is blocked, the message names the spot and the point: adjust that spot's `lead` waypoints (not the test).

- [ ] **Step 5: Stage**

```bash
git add web/world/layout.js tests/world3d-layout.test.js
```

---

### Task 4: Daily marks (`prefs.js`)

**Files:**
- Modify: `web/world/prefs.js`
- Test: `tests/world3d-prefs.test.js`

`world3d_v1` is the synced key from the spec. Phase 2 stores the day Mimi last talked to her (`mimi`); Phase 4 adds `greeted` and `comforted`.

- [ ] **Step 1: Append the failing test to `tests/world3d-prefs.test.js`**

```js
test('daily marks remember the day Mimi talked to her, and sync whole', () => {
  const s = memory();
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '', t: 0 });
  P.markDaily(s, 'mimi', '2026-10-05', 99);
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '2026-10-05', t: 99 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '{"mimi":5,"t":"x"}' })), { v: 1, mimi: '', t: 0 });
  assert.equal(P.DAILY_KEY, 'world3d_v1');
  assert.equal(kindOf('world3d_v1'), 'replace');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-prefs.test.js`
Expected: FAIL, `P.readDaily is not a function`.

- [ ] **Step 3: Add to `web/world/prefs.js`**

Find:

```js
  var QUALITIES = ['auto', 'high', 'low'];
```

Replace with:

```js
  var QUALITIES = ['auto', 'high', 'low'];
  var DAILY_KEY = 'world3d_v1';
```

Find:

```js
  // tick(dt) once per frame;
```

Insert directly above it:

```js
  // Once-a-day moments, synced so a second device does not repeat them. mimi: the day she last talked to Mayor Mimi.
  function readDaily(storage) {
    var d = parse(storage, DAILY_KEY) || {};
    return { v: 1, mimi: typeof d.mimi === 'string' ? d.mimi : '', t: typeof d.t === 'number' ? d.t : 0 };
  }

  function markDaily(storage, field, day, now) {
    var d = readDaily(storage);
    d[field] = day;
    d.t = now;
    try { storage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }

```

Add `DAILY_KEY: DAILY_KEY, readDaily: readDaily, markDaily: markDaily,` to the `exported` object.

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-prefs.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/prefs.js tests/world3d-prefs.test.js
```

---

### Task 5: The progress snapshot (`progress.js`)

**Files:**
- Create: `web/world/progress.js`
- Test: `tests/world3d-progress.test.js`

- [ ] **Step 1: Write the failing test** `tests/world3d-progress.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const P = require(worldFile('progress.js'));
const L = require(worldFile('layout.js'));
const { SUBJECTS } = require(engineFile('subjects.js'));
const World = require(engineFile('world.js'));
const Guide = require(engineFile('guide.js'));

function deps(over) {
  return Object.assign({ now: () => 0, tally: () => null, due: () => ({}), quests: () => [], boss: () => ({}), canAfford: () => false, guide: () => null }, over);
}
const cards5 = () => P.cards('grade5', L, SUBJECTS);

test('cards follow the lobby: subject names and the lobby card links', () => {
  assert.deepEqual(cards5()[7], { app: 'life-lab', name: 'Science', emoji: '🔬', href: '../subjects/grade-5/science/index.html?reset=1' });
  assert.equal(P.cards('grade2', L, SUBJECTS)[0].name, 'Math');
  assert.equal(P.cards('grade5', L, null)[7].name, 'Science', 'without engine/subjects.js the sign is the name');
});

test('snapshot: levels, markers, the fort and the guide step with its link', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    tally: (app) => (app === 'life-lab' ? { gold: 2, silver: 0, bronze: 0, total: 2 } : null),
    due: () => ({ 'page-turners': 3 }),
    boss: () => ({ stages: [{ app: 'life-lab', cleared: false }, { app: 'math-mastery', cleared: true }] }),
    guide: () => ({ kind: 'boss', app: 'life-lab', text: 'x' }),
  }) });
  assert.equal(s.apps['life-lab'].level, 3);
  assert.deepEqual(s.apps['life-lab'].markers, [{ kind: 'boss' }]);
  assert.deepEqual(s.apps['page-turners'].markers, [{ kind: 'due', count: 3 }]);
  assert.deepEqual(s.fort, { cleared: 1, total: 2, beaten: false, next: 'life-lab', href: '../subjects/grade-5/science/index.html?reset=1&boss=1' });
  assert.equal(s.target, 'life-lab');
  assert.equal(s.stepHref, '../subjects/grade-5/science/index.html?reset=1&boss=1');
  assert.equal(P.doorHref(s, 'life-lab', 'plain'), s.stepHref, 'the door the guide points at keeps the guide\'s link');
  assert.equal(P.doorHref(s, 'math-mastery', 'plain'), 'plain');
  assert.equal(P.doorHref(null, 'math-mastery', 'plain'), 'plain');
});

test('all done: no fort stage, and the shop is the target when she can afford a reward', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    guide: () => ({ kind: 'done', app: null, shop: true }), canAfford: () => true,
  }) });
  assert.deepEqual(s.fort, { cleared: 0, total: 0, beaten: false, next: null, href: null });
  assert.equal(s.target, 'shop');
  assert.equal(s.stepHref, null);
  assert.equal(s.shop.sparkle, true);
});

test('broken engines give a plain world, never an error', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    boss: () => { throw new Error('x'); }, guide: () => { throw new Error('x'); },
  }) });
  assert.equal(s.step, null);
  assert.equal(s.target, null);
  assert.equal(s.fort.next, null);
});

test('canAfford asks the wallet with each subject\'s stored points', () => {
  const seen = [];
  const wallet = { catalog: [{ id: 'a' }, { id: 'b' }], canBuy: (id, pts) => { seen.push([id, pts]); return { ok: id === 'b' }; } };
  const store = { getItem: (k) => (k === 'x_points_v1' ? '120' : null) };
  assert.equal(P.canAfford(wallet, store, ['x_points_v1', 'y_points_v1']), true);
  assert.deepEqual(seen[0], ['a', { x_points_v1: 120, y_points_v1: 0 }]);
  assert.equal(P.canAfford(null, store, []), false);
});

test('fill puts numbers into the words', () => {
  assert.equal(P.fill('{c} of {n}', { c: 1, n: 3 }), '1 of 3');
  assert.equal(P.fill('{c} of {x}', { c: 1 }), '1 of {x}');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-progress.test.js`
Expected: FAIL, cannot find `web/world/progress.js`.

- [ ] **Step 3: Write `web/world/progress.js`**

```js
/* What the 3D world shows from her progress: each building's medal level and markers, the shop sparkle, the Boss Fort,
   and the guide's next step with where its Go leads. Pure: town.js passes in World.status, World.liveDeps(window) and
   Guide.link, so the world reads progress exactly like the lobby's 2D map. */
(function (root) {
  'use strict';

  function safe(fn, fallback) {
    try {
      var v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  // The cards the guide and the map expect, in lobby order: { app, name (subject name), emoji, href (lobby card link) }.
  function cards(grade, Layout, subjects) {
    var n = grade === 'grade2' ? 2 : 5, titles = {};
    ((subjects && subjects[n]) || []).forEach(function (s) { titles[s.app] = s.title; });
    return Layout.buildings(grade).map(function (b) {
      return { app: b.app, name: titles[b.app] || b.sign, emoji: b.emoji, href: Layout.appUrl(grade, b.folder) };
    });
  }

  // o = { cards, status (World.status), deps (World.liveDeps), link (Guide.link) }
  function snapshot(o) {
    var apps = o.cards.map(function (c) { return c.app; });
    var st = o.status(apps, o.deps);
    var step = safe(function () { return o.deps.guide(o.cards); }, null);
    var boss = safe(function () { return o.deps.boss(); }, {});
    var stages = Array.isArray(boss.stages) ? boss.stages : [];
    var next = stages.filter(function (s) { return s && s.cleared !== true && apps.indexOf(s.app) >= 0; })[0];
    return {
      apps: st.apps,
      shop: st.shop,
      fort: {
        cleared: st.arena.cleared, total: st.arena.total, beaten: st.arena.beaten, next: next ? next.app : null,
        href: next ? safe(function () { return o.link({ kind: 'boss', app: next.app }, o.cards); }, null) : null
      },
      step: step,
      stepHref: step ? safe(function () { return o.link(step, o.cards); }, null) : null,
      target: step ? (step.shop === true ? 'shop' : step.app || null) : null
    };
  }

  // The door the guide points at opens the guide's link (?boss=1, ?review=1, ?lesson=); other doors open the plain page.
  function doorHref(snap, app, plain) {
    return snap && snap.step && snap.step.app === app && snap.stepHref ? snap.stepHref : plain;
  }

  // Like the lobby shop's canAfford, from each subject's stored points.
  function canAfford(wallet, storage, keys) {
    if (!wallet || !wallet.catalog || !wallet.canBuy) return false;
    var points = {};
    keys.forEach(function (k) { points[k] = safe(function () { return parseInt(storage.getItem(k), 10) || 0; }, 0); });
    return wallet.catalog.some(function (item) { return safe(function () { return wallet.canBuy(item.id, points).ok === true; }, false); });
  }

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (m, k) { return values[k] === undefined ? m : String(values[k]); });
  }

  var exported = { cards: cards, snapshot: snapshot, doorHref: doorHref, canAfford: canAfford, fill: fill };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Progress = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-progress.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Stage**

```bash
git add web/world/progress.js tests/world3d-progress.test.js
```

---

### Task 6: Marker badges (`scene.js`) and what `build.js` hands back

**Files:**
- Modify: `web/world/scene.js`, `web/world/build.js`

No unit test (needs WebGL); Task 11's e2e covers it.

- [ ] **Step 1: `scene.js` — a shared `pill()` and a cached `badge(text)`**

In `create`, find the line `function label(text, bg) {` and the inner `function pill(l, t, w, h) { ... }` inside it. Move the pill drawing to a create-level helper that takes the canvas context, by adding this directly above `function label(text, bg) {`:

```js
    function pill(x, l, t, w, h) {
      var r = h / 2;
      x.beginPath();
      x.moveTo(l + r, t);
      x.arcTo(l + w, t, l + w, t + h, r);
      x.arcTo(l + w, t + h, l, t + h, r);
      x.arcTo(l, t + h, l, t, r);
      x.arcTo(l, t, l + w, t, r);
      x.fill();
    }

    // A small white pill with dark text for markers ("⚔️", "❗", "🔁3", "⚔️ 1/4"); one texture per text.
    var badges = {};
    function badge(text) {
      if (badges[text]) return badges[text];
      var c = doc.createElement('canvas');
      c.width = 256; c.height = 128;
      var x = c.getContext('2d');
      x.fillStyle = 'rgba(0,0,0,.15)'; pill(x, 10, 14, 236, 108);
      x.fillStyle = '#ffffff'; pill(x, 6, 6, 236, 108);
      var size = 70;
      do { x.font = '800 ' + size + 'px "Baloo 2", sans-serif'; size -= 4; } while (x.measureText(text).width > 210 && size > 24);
      x.fillStyle = '#6a2c70';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, 124, 64);
      return (badges[text] = canvasTexture(c));
    }

```

Then inside `label`, delete its inner `function pill(l, t, w, h) { ... }` and change its three calls `pill(14, 22, 484, 148)`, `pill(8, 8, 496, 152)`, `pill(20, 20, 472, 128)` to `pill(x, 14, 22, 484, 148)`, `pill(x, 8, 8, 496, 152)`, `pill(x, 20, 20, 472, 128)`.

Add `badge: badge,` to the object `create` returns (next to `label: label,`).

- [ ] **Step 2: `build.js` — remember each building's parts**

In `build`, find:

```js
    var doorMats = {}, signs = [], clouds = [], sparks = [];
```

Replace with:

```js
    var doorMats = {}, signs = [], clouds = [], sparks = [], parts = {}, shopGroup = null, fortParts = null;
```

Replace the whole `function building(b) { ... }` with:

```js
    // Local +z is the front, turned to face the street. parts[app] keeps what decor.js changes with her medals.
    function building(b) {
      var g = group(b.x, b.z, b.rot), roofs = [], top;
      add(rbox(11.5, 0.7, 9.5, 0.3), '#ffffff', 0, 0.35, 0, g);
      add(rbox(10, 6.4, 8, 1.2), b.wall, 0, 3.7, 0, g);
      if (b.shape === 'dome') {
        roofs.push(add(ball(5.4), b.roof, 0, 6.9, 0, g));
        roofs[0].scale.set(1, 0.62, 0.8);
        add(ball(0.6), '#fff6a8', 0, 10.5, 0, g);
        top = 10.5;
      } else if (b.shape === 'cone') {
        roofs.push(add(S.cone(6.6, 4.6, 32), b.roof, 0, 9.3, 0, g));
        roofs[0].scale.z = 0.8;
        add(ball(0.55), '#fff6a8', 0, 11.8, 0, g);
        top = 11.8;
      } else {
        roofs.push(add(rbox(10.6, 1.4, 8.6, 0.6), b.roof, 0, 7.4, 0, g));
        for (var d = -4; d <= 4; d += 1.6) roofs.push(add(ball(0.55), b.roof, d, 6.7, 4.2, g));
        add(rbox(3, 2.4, 3, 0.6), '#ffffff', 0, 9, 0, g);
        add(ball(0.7), '#ff6f91', 0, 10.7, 0, g);
        top = 10.7;
      }
      add(rbox(2.6, 3.8, 0.5, 0.25), '#c98b6b', 0, 2.6, 4.05, g);
      add(ball(1.3), '#c98b6b', 0, 4.5, 4.05, g).scale.set(1, 0.6, 0.38);
      add(ball(0.2), '#ffd166', 0.8, 2.5, 4.35, g);
      porthole(g, -3.3, 4.3, 4.05);
      porthole(g, 3.3, 4.3, 4.05);
      var signY = b.shape === 'cake' ? 12.2 : 11.8;
      floatSign(b.emoji + ' ' + b.sign, b.roof, 0, signY, 0, 6.4 * cfg.signScale, g);
      doorMats[b.app] = flat(add(S.cyl(2.1, 2.1, 0.12, 40), toon('#ffffff', { transparent: true, opacity: 0.85 }, true), 0, 0.1, L.BUILDING.doorOut, g));
      parts[b.app] = { group: g, roofs: roofs, roofColor: b.roof, top: top, signY: signY };
    }
```

In `function fort(p) {`, find:

```js
      add(rbox(4, 4.4, 0.6, 0.6), '#8e7cc3', 0, 2.2, 9.7, g);
```

Replace with:

```js
      var door = add(rbox(4, 4.4, 0.6, 0.6), toon('#8e7cc3', null, true), 0, 2.2, 9.7, g);
      fortParts = { group: g, door: door };
```

In `function shop() {`, find:

```js
      var s = pr.shop, g = group(s.x, s.z, -Math.PI / 2);
```

Replace with:

```js
      var s = pr.shop, g = group(s.x, s.z, -Math.PI / 2);
      shopGroup = g;
```

Find the final line of `build`:

```js
    return { animate: animate, sparkle: sparkle };
```

Replace with:

```js
    return { animate: animate, sparkle: sparkle, buildings: parts, shop: shopGroup, fort: fortParts };
```

- [ ] **Step 3: Check the syntax and that Phase 1 still works**

Run: `node --check web/world/scene.js && node --check web/world/build.js && node tests/e2e/world-e2e.js`
Expected: no syntax output; world-e2e prints its 6 `ok` lines.

- [ ] **Step 4: Stage**

```bash
git add web/world/scene.js web/world/build.js
```

---

### Task 7: Decorations from her progress (`decor.js`)

**Files:**
- Create: `web/world/decor.js`

- [ ] **Step 1: Write `web/world/decor.js`**

```js
/* Decorations that follow her progress: a medal flag on the roof (bronze), a banner and flowers over the door (silver),
   a gold roof with a twinkling star (gold); floating markers (⚔️ boss, ❗ quest, 🔁 n due); the shop's ✨; the Boss
   Fort's count, glowing gate or sleepy 💤; and Mayor Mimi's sparkle trail. apply(snapshot) redraws; animate(t) moves. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var MEDAL = ['', '#d08a4e', '#cfd8e6', '#ffd54a'];
  var MARK = { boss: '⚔️', quest: '❗' };
  var TRAIL_GAP = 2.2;

  // built = what build.js returned: { buildings: { app: { group, roofs, roofColor, top, signY } }, shop, fort: { group, door } }
  function create(S, built) {
    var THREE = S.THREE, add = S.add;
    var medals = {}, marks = {}, moving = [], twinkles = [], trail = [], fortGlow = false, fortBadge = null;
    var trailMat = new THREE.SpriteMaterial({ map: S.emoji('✨'), transparent: true, depthWrite: false });

    var shopSpark = S.sprite(S.emoji('✨'), 2.2, 2.2);
    shopSpark.position.set(0, 10.5, 0);
    shopSpark.visible = false;
    built.shop.add(shopSpark);
    var fortSleep = S.sprite(S.emoji('💤'), 2.4, 2.4);
    fortSleep.position.set(3, 8.5, 9);
    built.fort.group.add(fortSleep);
    var fixed = [{ o: shopSpark, y: 10.5 }, { o: fortSleep, y: 8.5 }];

    // Sprites own their material (the textures are shared and cached), so free the material when a sprite goes.
    function empty(group) {
      while (group.children.length) {
        var c = group.children[0];
        group.remove(c);
        if (c.isSprite) c.material.dispose();
      }
    }

    function layer(store, app) {
      if (!store[app]) {
        store[app] = new THREE.Group();
        built.buildings[app].group.add(store[app]);
      }
      empty(store[app]);
      return store[app];
    }

    function medal(app, level) {
      var b = built.buildings[app], g = layer(medals, app);
      b.roofs.forEach(function (m) { m.material = S.toon(level === 3 ? MEDAL[3] : b.roofColor); });
      if (level < 1) return;
      add(S.cyl(0.12, 0.12, 3, 8), '#ffffff', 2.6, b.top + 1.5, 0, g);
      add(S.cone(0.8, 1.6, 3), MEDAL[level], 3.3, b.top + 2.4, 0, g).rotation.z = -Math.PI / 2;
      if (level >= 2) {
        add(S.rbox(6, 1.1, 0.25, 0.3), MEDAL[2], 0, 6.25, 4.2, g);
        for (var k = 0; k < 5; k++) add(S.ball(0.3), ['#ff8fab', '#ffd166', '#c77dff'][k % 3], (k - 2) * 1.2, 6.9, 4.3, g);
      }
      if (level === 3) {
        var star = S.sprite(S.emoji('🌟'), 2, 2);
        star.position.set(0, b.top + 2.2, 0);
        g.add(star);
        twinkles.push(star);
      }
    }

    function markers(app, list) {
      var b = built.buildings[app], g = layer(marks, app);
      list.forEach(function (m, i) {
        var s = S.sprite(S.badge(m.kind === 'due' ? '🔁' + m.count : MARK[m.kind]), 2.6, 1.3);
        s.position.set((i - (list.length - 1) / 2) * 2.9, b.signY + 2.4, 0);
        g.add(s);
        moving.push({ o: s, y: s.position.y });
      });
    }

    function fort(f) {
      fortSleep.visible = !f.next;
      fortGlow = !!f.next;
      if (!fortGlow) built.fort.door.material.emissive.setRGB(0, 0, 0);
      if (fortBadge) {
        built.fort.group.remove(fortBadge);
        fortBadge.material.dispose();
        fortBadge = null;
      }
      if (!f.total) return;
      fortBadge = S.sprite(S.badge('⚔️ ' + f.cleared + '/' + f.total), 3.6, 1.8);
      fortBadge.position.set(0, 16.4, 0);
      built.fort.group.add(fortBadge);
    }

    function apply(snap) {
      moving = [];
      twinkles = [];
      Object.keys(snap.apps).forEach(function (app) {
        if (!built.buildings[app]) return;
        medal(app, snap.apps[app].level);
        markers(app, snap.apps[app].markers);
      });
      shopSpark.visible = !!(snap.shop && snap.shop.sparkle);
      fort(snap.fort);
    }

    function hideTrail() {
      trail.forEach(function (s) { S.scene.remove(s); });
      trail = [];
    }

    // points: [[x, z], ...] from layout.route(); one sparkle every TRAIL_GAP along the way.
    function showTrail(points) {
      hideTrail();
      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / TRAIL_GAP));
        for (var k = i === 1 ? 0 : 1; k <= n; k++) {
          var s = new THREE.Sprite(trailMat);
          s.position.set(a[0] + (b[0] - a[0]) * k / n, 0.7, a[1] + (b[1] - a[1]) * k / n);
          S.scene.add(s);
          trail.push(s);
        }
      }
    }

    function animate(t) {
      fixed.concat(moving).forEach(function (m) { m.o.position.y = m.y + Math.sin(t * 2.4 + m.o.position.x) * 0.3; });
      twinkles.forEach(function (s) { var k = 2 + Math.sin(t * 4) * 0.3; s.scale.set(k, k, 1); });
      trail.forEach(function (s, i) { var k = 0.7 + 0.35 * Math.max(0, Math.sin(t * 5 - i * 0.6)); s.scale.set(k, k, 1); });
      if (fortGlow) built.fort.door.material.emissive.setRGB(0.25 + 0.25 * Math.sin(t * 3), 0.05, 0.15);
    }

    return { apply: apply, showTrail: showTrail, hideTrail: hideTrail, trailCount: function () { return trail.length; }, animate: animate };
  }

  W.Decor = { create: create };
})(this);
```

- [ ] **Step 2: Check the syntax**

Run: `node --check web/world/decor.js`
Expected: no output.

- [ ] **Step 3: Stage**

```bash
git add web/world/decor.js
```

---

### Task 8: Mayor Mimi (`cast.js`) and the speech bubble (`talk.js`)

**Files:**
- Create: `web/world/cast.js`, `web/world/talk.js`
- Modify: `web/world/world.css`

- [ ] **Step 1: Write `web/world/cast.js`**

```js
/* The world's characters, each a group facing local +z with animate(t). Phase 2: Mayor Mimi, the cat in a purple coat
   and top hat who stands by the fountain and guides her. Phase 3 adds the subject buddies, Professor Hoot and Bunny. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var FUR = '#fff4e6', COAT = '#7b5cff', HAT = '#3a2a4f';

  function catFace(S) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = FUR;
    x.fillRect(0, 0, 256, 256);
    [[84, 120], [172, 120]].forEach(function (e) {
      x.fillStyle = '#3a2a4f'; x.beginPath(); x.ellipse(e[0], e[1], 20, 26, 0, 0, 7); x.fill();
      x.fillStyle = '#5fcf9a'; x.beginPath(); x.ellipse(e[0], e[1] + 6, 14, 16, 0, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(e[0] + 7, e[1] - 10, 7, 0, 7); x.fill();
    });
    x.fillStyle = '#ff8fab';
    x.beginPath(); x.moveTo(116, 160); x.lineTo(140, 160); x.lineTo(128, 174); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,120,160,.45)';
    x.beginPath(); x.ellipse(52, 168, 20, 11, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(204, 168, 20, 11, 0, 0, 7); x.fill();
    x.strokeStyle = '#3a2a4f'; x.lineWidth = 4; x.lineCap = 'round';
    [[-1, 0], [-1, 12], [1, 0], [1, 12]].forEach(function (w) {
      x.beginPath(); x.moveTo(128 + w[0] * 30, 168 + w[1] / 2); x.lineTo(128 + w[0] * 86, 160 + w[1]); x.stroke();
    });
    x.beginPath(); x.arc(118, 178, 10, 0.2, Math.PI - 0.6); x.stroke();
    x.beginPath(); x.arc(138, 178, 10, 0.6, Math.PI - 0.2); x.stroke();
    return S.canvasTexture(c);
  }

  function mimi(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, ball = S.ball;
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    var furMat = S.toon(FUR), face = new THREE.MeshToonMaterial({ map: catFace(S), gradientMap: S.ramp });

    add(S.cyl(0.8, 1.1, 1.8, 24), COAT, 0, 1.6, 0, body);
    add(rbox(0.35, 1.9, 0.12, 0.05), '#ffd166', 0.3, 1.7, 0.92, body).rotation.z = 0.5;
    add(ball(0.18), '#ffd166', -0.1, 2.2, 0.95, body);
    [-0.35, 0.35].forEach(function (x) { add(rbox(0.6, 0.35, 0.8, 0.15), FUR, x, 0.2, 0.15, body); });
    add(S.cyl(0.12, 0.08, 1.4, 8), FUR, -0.4, 0.9, -0.85, body).rotation.x = -0.9;

    var head = new THREE.Group();
    head.position.y = 3.4;
    body.add(head);
    add(rbox(2.2, 2, 2, 0.8), [furMat, furMat, furMat, furMat, face, furMat], 0, 0, 0, head);
    [-0.65, 0.65].forEach(function (x) {
      add(S.cone(0.4, 0.7, 4), FUR, x, 1.2, 0, head);
      add(S.cone(0.22, 0.4, 4), '#ffb3c7', x, 1.15, 0.12, head);
    });
    add(S.cyl(1.1, 1.1, 0.12, 20), HAT, 0, 1.1, 0, head);
    add(S.cyl(0.75, 0.75, 0.9, 20), HAT, 0, 1.6, 0, head);
    add(S.cyl(0.77, 0.77, 0.2, 20), '#ff6f91', 0, 1.3, 0, head);

    var arm = new THREE.Group();
    arm.position.set(0.95, 2.3, 0);
    body.add(arm);
    add(rbox(0.45, 1.1, 0.45, 0.2), COAT, 0, 0.5, 0, arm);
    add(ball(0.28), FUR, 0, 1.1, 0, arm);
    var arm2 = new THREE.Group();
    arm2.position.set(-0.95, 2.3, 0);
    body.add(arm2);
    add(rbox(0.45, 1.1, 0.45, 0.2), COAT, 0, -0.5, 0, arm2);
    add(ball(0.28), FUR, 0, -1.1, 0, arm2);

    var waving = false;
    function animate(t) {
      arm.rotation.z = waving ? -0.4 + Math.sin(t * 8) * 0.5 : -0.2;
      head.rotation.z = Math.sin(t * 1.4) * 0.05;
      body.position.y = waving ? Math.abs(Math.sin(t * 4)) * 0.2 : 0;
    }
    return { group: group, animate: animate, wave: function (on) { waving = on; } };
  }

  W.Cast = { mimi: mimi };
})(this);
```

- [ ] **Step 2: Write `web/world/talk.js`**

```js
/* The speech bubble for the world's characters: a face, a name, the words, and buttons. One bubble at a time; a button
   or Escape closes it (then runs that button's action). Phase 3's characters use it too. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { doc, face, who, text, buttons: [{ text, main, onClick }], onClose }
  function open(o) {
    var doc = o.doc, done = false, before = doc.activeElement;
    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    var box = el('div', 'talk');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', o.who);
    box.appendChild(el('div', 'talk-who', o.face + ' ' + o.who));
    var say = el('p', 'talk-say', o.text);
    say.setAttribute('aria-live', 'polite');
    box.appendChild(say);
    var row = el('div', 'talk-row');
    o.buttons.forEach(function (b) {
      var btn = el('button', 'talk-btn' + (b.main ? ' main' : ''), b.text);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        close();
        if (b.onClick) b.onClick();
      });
      row.appendChild(btn);
    });
    box.appendChild(row);

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      if (done) return;
      done = true;
      doc.removeEventListener('keydown', onKey);
      if (box.parentNode) box.parentNode.removeChild(box);
      if (before && before.focus && doc.body.contains(before)) before.focus();
      if (o.onClose) o.onClose();
    }

    doc.addEventListener('keydown', onKey);
    doc.body.appendChild(box);
    var first = row.querySelector('button');
    if (first) first.focus();
    return { close: close, el: box };
  }

  W.Talk = { open: open };
})(this);
```

- [ ] **Step 3: Add the bubble styles** to the end of `web/world/world.css`

```css

/* Speech bubble (talk.js) */
.talk { position: fixed; left: 50%; top: 70px; transform: translateX(-50%); width: min(560px, calc(100% - 32px)); box-sizing: border-box;
  background: #fff; border-radius: 28px; padding: 14px 20px 16px; text-align: center; color: #5b2a6b;
  box-shadow: 0 6px 0 #f3b6d6, 0 14px 30px rgba(200,80,150,.25); z-index: 20; }
.talk-who { font-weight: 800; color: #7b5cff; font-size: 15px; letter-spacing: .3px; }
.talk-say { font-size: 21px; font-weight: 800; line-height: 1.3; margin: 6px 0 10px; }
.talk-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.talk-btn { font: 800 17px 'Baloo 2', system-ui, sans-serif; border: 0; border-radius: 999px; padding: 8px 20px; min-height: 44px;
  background: #fff0f7; color: #6a2c70; box-shadow: 0 4px 0 #f3b6d6; cursor: pointer; }
.talk-btn.main { background: linear-gradient(#ffe066, #ffb3d9); box-shadow: 0 4px 0 #e58fbf; }
```

- [ ] **Step 4: Check the syntax**

Run: `node --check web/world/cast.js && node --check web/world/talk.js`
Expected: no output.

- [ ] **Step 5: Stage**

```bash
git add web/world/cast.js web/world/talk.js web/world/world.css
```

---

### Task 9: The town controller (`town.js`), wiring into `world-main.js` and the pages

**Files:**
- Create: `web/world/town.js`
- Modify: `web/world/world-main.js`, `web/world/grade-5.html`, `web/world/grade-2.html`, `tests/paths.js`, `tests/world3d-wiring.test.js`

- [ ] **Step 1: Update `tests/paths.js`**

Replace the `WORLD_FILES` line with:

```js
const WORLD_FILES = ['text.js', 'layout.js', 'look.js', 'prefs.js', 'walk.js', 'music.js', 'progress.js', 'scene.js', 'build.js', 'decor.js', 'cast.js', 'talk.js', 'avatar.js', 'move.js', 'maker.js', 'town.js', 'world-main.js'];
// The engine files a world page loads, in order; world.js and subjects.js load without data-grade (pure helpers only).
const WORLD_ENGINES = ['storage', 'learner', 'clock', 'study-history', 'recall', 'mastery', 'wallet', 'quests', 'boss', 'guide', 'world', 'subjects', 'fx'];
```

Add `WORLD_ENGINES` to `module.exports`.

- [ ] **Step 2: Update the failing wiring test** (`tests/world3d-wiring.test.js`)

Change the `require('./paths.js')` line to also take `WORLD_ENGINES`, then replace:

```js
const ORDER = ['../engine/storage.js', '../engine/learner.js', '../engine/fx.js']
  .concat(VENDOR_FILES.map((f) => '../' + f), WORLD_FILES);
```

with:

```js
const ORDER = WORLD_ENGINES.map((f) => '../engine/' + f + '.js')
  .concat(VENDOR_FILES.map((f) => '../' + f), WORLD_FILES);
const NO_GRADE = ['world', 'subjects'];
```

and replace the loop:

```js
    for (const f of ['storage', 'learner', 'fx']) {
      assert.ok(html.includes('<script src="../engine/' + f + '.js" data-grade="' + grade + '"></script>'), f + ' has data-grade');
    }
```

with:

```js
    for (const f of WORLD_ENGINES) {
      const tag = NO_GRADE.includes(f) ? '<script src="../engine/' + f + '.js"></script>' : '<script src="../engine/' + f + '.js" data-grade="' + grade + '"></script>';
      assert.ok(html.includes(tag), f + (NO_GRADE.includes(f) ? ' loads without data-grade (pure helpers only)' : ' has data-grade'));
    }
```

Run: `node --test tests/world3d-wiring.test.js`
Expected: FAIL (script order).

- [ ] **Step 3: Load the engines and new files in both world pages**

In `web/world/grade-5.html`, replace the three engine lines:

```html
<script src="../engine/storage.js" data-grade="grade5"></script>
<script src="../engine/learner.js" data-grade="grade5"></script>
<script src="../engine/fx.js" data-grade="grade5"></script>
```

with:

```html
<script src="../engine/storage.js" data-grade="grade5"></script>
<script src="../engine/learner.js" data-grade="grade5"></script>
<script src="../engine/clock.js" data-grade="grade5"></script>
<script src="../engine/study-history.js" data-grade="grade5"></script>
<script src="../engine/recall.js" data-grade="grade5"></script>
<script src="../engine/mastery.js" data-grade="grade5"></script>
<script src="../engine/wallet.js" data-grade="grade5"></script>
<script src="../engine/quests.js" data-grade="grade5"></script>
<script src="../engine/boss.js" data-grade="grade5"></script>
<script src="../engine/guide.js" data-grade="grade5"></script>
<script src="../engine/world.js"></script>
<script src="../engine/subjects.js"></script>
<script src="../engine/fx.js" data-grade="grade5"></script>
```

and replace the world-script block with (one tag per entry of `WORLD_FILES`, in order):

```html
<script src="text.js"></script>
<script src="layout.js"></script>
<script src="look.js"></script>
<script src="prefs.js"></script>
<script src="walk.js"></script>
<script src="music.js"></script>
<script src="progress.js"></script>
<script src="scene.js"></script>
<script src="build.js"></script>
<script src="decor.js"></script>
<script src="cast.js"></script>
<script src="talk.js"></script>
<script src="avatar.js"></script>
<script src="move.js"></script>
<script src="maker.js"></script>
<script src="town.js"></script>
<script src="world-main.js"></script>
```

Do the same in `web/world/grade-2.html` with `data-grade="grade2"`.

- [ ] **Step 4: Write `web/world/town.js`**

```js
/* Phase 2 of the world: her progress on the map. Reads the same engines as the lobby (medals, review, quests, boss,
   wallet, guide), dresses the buildings through decor.js, puts Mayor Mimi by the fountain with her sparkle trail, and
   handles Mimi, Bunny's shop counter (a hop to the lobby's shop and back) and the Boss Fort gate. world-main.js asks it
   for button labels, actions and door links. If an engine is missing, the world stays plain. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var ARRIVE = 3, GREET = 16;

  // o = { S, built, grade, T, store, session, lobbyUrl, go(url), sound(name), busy(on), today() }
  function create(o) {
    var L = W.Layout, P = W.Progress, S = o.S, T = o.T, grade = o.grade;
    var subjects = root.Subjects, n = grade === 'grade2' ? 2 : 5;
    var cards = P.cards(grade, L, subjects);
    var keys = ((subjects && subjects[n]) || []).map(function (s) { return s.pointsKey; });
    if (root.Wallet && root.Wallet.catalog && !root.Wallet.canAfford) {
      root.Wallet.canAfford = function () { return P.canAfford(root.Wallet, o.store, keys); };
    }
    var deps = root.World && root.World.liveDeps ? root.World.liveDeps(root) : null;
    var link = root.Guide && root.Guide.link ? root.Guide.link : function () { return null; };
    var decor = W.Decor.create(S, o.built);
    var pr = L.props(grade), plaza = L.places(grade).plaza, allSpots = L.spots(grade);

    var mimi = W.Cast.mimi(S);
    mimi.group.position.set(pr.mimi.x, 0, pr.mimi.z);
    S.scene.add(mimi.group);
    var plate = S.sprite(S.label('🐱 ' + T.mimi, '#7b5cff'), 4.4, 4.4 * 180 / 512);
    plate.position.set(pr.mimi.x, 6.4, pr.mimi.z);
    S.scene.add(plate);

    var snap = null, trailTo = null, talk = null;

    function talkedToday() { return W.Prefs.readDaily(o.store).mimi === o.today(); }

    function refresh() {
      try {
        snap = deps && root.World.status ? P.snapshot({ cards: cards, status: root.World.status, deps: deps, link: link }) : null;
      } catch (e) { snap = null; }
      if (snap) decor.apply(snap);
      mimi.wave(!talkedToday());
      return snap;
    }

    function say(face, who, text, buttons) {
      o.busy(true);
      talk = W.Talk.open({ doc: root.document, face: face, who: who, text: text, buttons: buttons,
        onClose: function () { talk = null; o.busy(false); } });
    }

    function startTrail(id) {
      var pts = L.route(grade, id);
      if (!pts.length) return;
      decor.showTrail(pts);
      trailTo = allSpots.filter(function (s) { return s.id === id; })[0] || null;
      o.sound('allRead');
    }

    function openMimi() {
      if (talk) return;
      W.Prefs.markDaily(o.store, 'mimi', o.today(), Date.now());
      mimi.wave(false);
      var step = snap && snap.step, target = snap && snap.target;
      var buttons = [];
      if (target) buttons.push({ text: T.goTrail, main: true, onClick: function () { startTrail(target); } });
      buttons.push({ text: T.later });
      say('🐱', T.mimi, step ? step.text + (target ? ' ' + T.follow : '') : T.mimiIdle, buttons);
    }

    function openFort() {
      var f = snap && snap.fort;
      if (f && f.href) {
        W.Prefs.setReturn(o.session, grade, 'boss');
        o.go(f.href);
        return;
      }
      say('🏰', T.places.boss, f && f.beaten ? T.fortBeaten : T.fortNone, [{ text: T.close }]);
    }

    function label(it) {
      if (it.kind === 'mimi') return T.mimiTalk;
      if (it.kind === 'counter') return T.counter;
      if (it.kind === 'fort') return snap && snap.fort && snap.fort.href ? T.fortGo : T.fortClosed;
      return null;
    }

    function act(it) {
      if (it.kind === 'mimi') openMimi();
      else if (it.kind === 'counter') o.go(o.lobbyUrl + '#shop-world');
      else if (it.kind === 'fort') openFort();
    }

    // Each frame: Mimi greets her the first time today she comes into the plaza; the trail goes out when she arrives.
    function tick(t, st) {
      mimi.animate(t);
      decor.animate(t);
      if (!talk && Math.hypot(st.x - plaza.x, st.z - plaza.z) < GREET && !talkedToday()) openMimi();
      if (trailTo && Math.hypot(st.x - trailTo.x, st.z - trailTo.z) < ARRIVE) {
        decor.hideTrail();
        trailTo = null;
      }
    }

    return {
      refresh: refresh, label: label, act: act, tick: tick,
      handles: function (kind) { return kind === 'mimi' || kind === 'counter' || kind === 'fort'; },
      doorHref: function (app, plain) { return P.doorHref(snap, app, plain); },
      snapshot: function () { return snap; },
      trail: function () { return { to: trailTo ? trailTo.id : null, count: decor.trailCount() }; },
      talking: function () { return !!talk; },
      talkText: function () { return talk ? talk.el.querySelector('.talk-say').textContent : null; },
      closeTalk: function () { if (talk) talk.close(); }
    };
  }

  W.Town = { create: create };
})(this);
```

- [ ] **Step 5: Wire it into `web/world/world-main.js`**

(a) Find:

```js
    var me = null, pet = null, near = null, maker = null, overlay = null, lost = false, before = null;
```

Replace with:

```js
    var me = null, pet = null, near = null, maker = null, overlay = null, lost = false, before = null, talking = false;
```

(b) Find the end of the `var ctl = W.Move.create(S, { ... });` statement:

```js
      blocked: function (x, z) { return L.blocked(obs, bounds, x, z, L.PLAYER_R); }
    });
```

Replace with:

```js
      blocked: function (x, z) { return L.blocked(obs, bounds, x, z, L.PLAYER_R); }
    });

    var town = W.Town.create({
      S: S, built: world, grade: grade, T: T, store: store, session: session, lobbyUrl: lobbyUrl,
      go: function (url) { debug.go(url); }, sound: sound,
      busy: function (on) { talking = on; ctl.freeze(on); },
      today: function () { return root.Guide && root.Guide.dayKey ? root.Guide.dayKey(Date.now()) : new Date().toDateString(); }
    });
```

(c) Replace the whole `actLabel` function with:

```js
    function actLabel(it) {
      if (it.kind === 'door') return it.emoji + ' ' + T.go.replace('{name}', english(it.sign));
      if (town.handles(it.kind)) return town.label(it);
      return it.kind === 'mirror' ? T.mirror : T.signpost;
    }
```

(d) Replace the whole `act` function with:

```js
    function act() {
      if (!near || maker || overlay || talking) return;
      if (near.kind === 'door') {
        W.Prefs.setReturn(session, grade, near.app);
        debug.go(town.doorHref(near.app, L.appUrl(grade, near.folder)));
      } else if (near.kind === 'mirror') openMaker();
      else if (near.kind === 'signpost') openTravel();
      else town.act(near);
    }
```

(e) In `tick`, find:

```js
      near = maker || overlay ? null : L.nearest(items, st.x, st.z);
```

Replace with:

```js
      near = maker || overlay || talking ? null : L.nearest(items, st.x, st.z);
```

and directly after the line `world.animate(t, dt, near && near.kind === 'door' ? near.id : null);` add:

```js
      if (!maker) town.tick(t, st);
```

(f) In the `keydown` handler, find:

```js
      if ((e.key === 'Enter' || String(e.key).toLowerCase() === 'e') && near && !maker && !overlay) {
```

Replace with:

```js
      if ((e.key === 'Enter' || String(e.key).toLowerCase() === 'e') && near && !maker && !overlay && !talking) {
```

(g) Find:

```js
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) music.stop();
      else if (wantMusic()) music.start();
    });
```

Replace with:

```js
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) music.stop();
      else {
        if (wantMusic()) music.start();
        town.refresh();
      }
    });
    root.addEventListener('pageshow', function (e) { if (e.persisted) town.refresh(); });
```

(h) Find:

```js
    dress(look);
    goTo(L.spawnFor(grade, W.Prefs.readReturn(session)));
```

Replace with:

```js
    town.refresh();
    dress(look);
    goTo(L.spawnFor(grade, W.Prefs.readReturn(session)));
```

(i) Find:

```js
    debug.openTravel = openTravel;
```

Replace with:

```js
    debug.openTravel = openTravel;
    debug.snapshot = town.snapshot;
    debug.trail = town.trail;
    debug.talking = town.talking;
    debug.talkText = town.talkText;
    debug.closeTalk = town.closeTalk;
    debug.actText = function () { return hud.act.textContent; };
```

- [ ] **Step 6: Run the tests and the precache**

Run: `node tools/update-precache.js && node --test tests/world3d-wiring.test.js tests/pwa.test.js && node --check web/world/town.js && node --check web/world/world-main.js`
Expected: PASS.

- [ ] **Step 7: Update `stageWorld` in `tests/e2e/world-e2e.js` so the staged pages get every engine file they now load**

Find:

```js
  const file = stage(site, WORLDS[grade], appendDriver(html, driver), ['storage.js', 'learner.js', 'fx.js']);
```

Replace with:

```js
  const file = stage(site, WORLDS[grade], appendDriver(html, driver), ENGINE_FILES);
```

Run: `node tests/e2e/world-e2e.js`
Expected: the 6 Phase 1 `ok` lines (the fresh profile starts at the gate, far from Mimi, so her greeting does not open).

- [ ] **Step 8: Stage**

```bash
git add web/world/town.js web/world/world-main.js web/world/grade-5.html web/world/grade-2.html tests/paths.js tests/world3d-wiring.test.js tests/e2e/world-e2e.js web/sw.js
```

---

### Task 10: The lobby shop sends her back to the world (`#shop-world`)

**Files:**
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html` (the `<script data-shop>` block; the edit must be identical in both, `tests/copies.test.js` compares them)
- Test: `tests/world3d-wiring.test.js` (append)

- [ ] **Step 1: Append the failing test**

```js
for (const n of Object.keys(WORLDS)) {
  test('grade ' + n + ' lobby shop opened from the world sends her back to Shop Plaza when she closes it', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const shop = html.slice(html.indexOf('<script data-shop>'), html.indexOf('</script>', html.indexOf('<script data-shop>')));
    assert.ok(shop.includes("location.hash === '#shop-world'"), 'opens the shop for #shop-world');
    assert.ok(shop.includes("app: 'shop'"), 'returns to the shop place');
    assert.ok(shop.includes('window.ShopReturn = { go: function (url) { location.href = url; } };'), 'the e2e can watch where it goes');
  });
}
```

Run: `node --test tests/world3d-wiring.test.js`
Expected: FAIL.

- [ ] **Step 2: Change the `<script data-shop>` block in BOTH lobbies**

(a) Find:

```js
  var asked = null, unwatch = null, phoneOnly = false;
```

Replace with:

```js
  var asked = null, unwatch = null, phoneOnly = false;
  var fromWorld = location.hash === '#shop-world';
  window.ShopReturn = { go: function (url) { location.href = url; } };
```

(b) Find:

```js
  function closeShop(){
```

Insert directly above it:

```js
  // Opened from the 3D world (#shop-world): closing the shop by hand walks her back to Shop Plaza there.
  function closeByHand(){
    closeShop();
    if (!fromWorld) return;
    fromWorld = false;
    var link = $('world-open'), href = link ? link.getAttribute('href') : '', g = (href.match(/grade-(\d)/) || [])[1];
    if (!g) return;
    try { sessionStorage.setItem('world_return_v1', JSON.stringify({ grade: 'grade' + g, app: 'shop' })); } catch (e) {}
    window.ShopReturn.go(href);
  }

```

(c) Find:

```js
  $('shop-close').addEventListener('click', closeShop);
```

Replace with:

```js
  $('shop-close').addEventListener('click', closeByHand);
```

(d) Find:

```js
    if (ev.key === 'Escape') closeShop();
```

Replace with:

```js
    if (ev.key === 'Escape') closeByHand();
```

(e) Find:

```js
  if (location.hash === '#shop') {
```

Replace with:

```js
  if (location.hash === '#shop' || fromWorld) {
```

(`pagehide` and `visibilitychange` keep calling `closeShop`, so leaving the page never navigates.)

- [ ] **Step 3: Run the tests**

Run: `node --test && node tests/e2e/lobby-e2e.js && node tests/e2e/lobby-e2e.js 5`
Expected: all pass (including `tests/copies.test.js`).

- [ ] **Step 4: Stage**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html tests/world3d-wiring.test.js
```

---

### Task 11: Browser test for Phase 2

**Files:**
- Modify: `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`

- [ ] **Step 1: Add a `progress` mode to `tests/e2e/world-driver.page.js`**

Find:

```js
    if (mode === 'back') { o.state = D.state(); return out(o); }
```

Insert directly above it:

```js
    if (mode === 'progress') {
      var s = D.snapshot();
      o.lifeLevel = s.apps['life-lab'].level;
      o.lifeMarkers = s.apps['life-lab'].markers.map(function (m) { return m.kind; });
      o.fort = s.fort;
      o.target = s.target;
      D.teleport('plaza');
      o.greeted = D.talking();
      o.mimiText = D.talkText();
      document.querySelector('.talk-btn.main').click();
      o.trail = D.trail();
      var went = null;
      D.go = function (u) { went = u; };
      D.teleport('life-lab');
      o.trailAfterArrive = D.trail();
      D.act();
      o.doorWent = went;
      o.fortHref = D.snapshot().fort.href;
      return out(o);
    }
```

- [ ] **Step 2: Add the cases to `tests/e2e/world-e2e.js`**

Find:

```js
  const noGl = '<script>HTMLCanvasElement.prototype.getContext = function () { return null; };</script>';
```

Insert directly above it:

```js
  // Medals, markers, Mimi and the trail, the guide's door link and the fort, from seeded progress.
  const PROGRESS = '<script>(function () {'
    + 'function p(n) { return (n < 10 ? "0" : "") + n; }'
    + 'var d = new Date(), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7);'
    + 'var week = m.getFullYear() + "-" + p(m.getMonth() + 1) + "-" + p(m.getDate());'
    + 'Learner.storage.setItem("boss_v1", JSON.stringify({ v: 1, week: week, stages: [{ app: "life-lab", title: "Matter", cleared: false }, { app: "math-mastery", title: "Fractions", cleared: true }], paid: [] }));'
    + 'Learner.storage.setItem("mastery_v1", JSON.stringify({ v: 1, apps: { "life-lab": { t: 1, order: ["a"], lessons: { a: { title: "Matter", now: 3, best: 3, paid: 3 } } } } }));'
    + 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));'
    + '})();</script>';
  const prog = run('progress', stageWorld('progress', 5, PROGRESS), 'progress');
  assert.deepEqual(prog.errors, [], 'progress: page errors');
  assert.equal(prog.lifeLevel, 3, 'all-gold Science has a gold roof');
  assert.deepEqual(prog.lifeMarkers, ['boss'], 'the boss stage floats over Science');
  assert.equal(prog.fort.next, 'life-lab');
  assert.equal(prog.fort.cleared, 1);
  assert.equal(prog.fort.total, 2);
  assert.equal(prog.target, 'life-lab', 'the guide points at the boss stage');
  assert.equal(prog.greeted, true, 'Mimi greets her the first time today she comes to the plaza');
  assert.equal(prog.mimiText, '⚔️ The boss is waiting in Science! Follow the sparkles ✨');
  assert.equal(prog.trail.to, 'life-lab');
  assert.ok(prog.trail.count > 10, 'the sparkle trail is drawn');
  assert.deepEqual(prog.trailAfterArrive, { to: null, count: 0 }, 'the trail goes out when she arrives');
  assert.equal(prog.doorWent, '../subjects/grade-5/science/index.html?reset=1&boss=1', 'the door keeps the guide\'s link');
  assert.equal(prog.fortHref, '../subjects/grade-5/science/index.html?reset=1&boss=1', 'the fort opens the next boss stage');
  console.log('ok medals, markers, Mimi, trail, fort');

  const SHOP_BACK = '<script>sessionStorage.setItem("world_return_v1", JSON.stringify({ grade: "grade5", app: "shop" }));'
    + 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));</script>';
  const back2 = run('shopback', stageWorld('shopback', 5, SHOP_BACK), 'back');
  assert.deepEqual(back2.errors, [], 'shop back: page errors');
  assert.deepEqual([back2.state.x, back2.state.z], [54, 0], 'back from the shop she stands in Shop Plaza');
  console.log('ok back in Shop Plaza');

  // The lobby shop opened from the world sends her back when she closes it.
  const lobbyDriver = 'addEventListener("pageshow", function () { setTimeout(function () {'
    + 'var went = null; ShopReturn.go = function (u) { went = u; };'
    + 'var open = !document.getElementById("shop-overlay").hidden;'
    + 'document.getElementById("shop-close").click();'
    + 'var pre = document.createElement("pre"); pre.id = "e2e-out";'
    + 'pre.textContent = JSON.stringify({ open: open, went: went, ret: JSON.parse(sessionStorage.getItem("world_return_v1")), errors: window.__e2eErrors || [] });'
    + 'document.body.appendChild(pre); }, 0); });';
  const lobbyFile5 = stage(path.join(work, 'lobby'), LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), lobbyDriver), ENGINE_FILES);
  const shop = readOutput(dumpDom(path.join(work, 'profile-lobby'), lobbyFile5, '#shop-world', 3000));
  assert.deepEqual(shop.errors, [], 'lobby: page errors');
  assert.equal(shop.open, true, '#shop-world opens the shop');
  assert.equal(shop.went, '../world/grade-5.html', 'closing it goes back to the world');
  assert.deepEqual(shop.ret, { grade: 'grade5', app: 'shop' });
  console.log('ok lobby shop and back');
```

Also change the `require('../paths.js')` line at the top to:

```js
const { WORLDS, VENDOR_FILES, ENGINE_FILES, LOBBIES, web, app, appFile, lobbyFile } = require('../paths.js');
```

- [ ] **Step 3: Run it**

Run: `node tests/e2e/world-e2e.js`
Expected: 9 `ok` lines (the 6 from Phase 1 plus `ok medals, markers, Mimi, trail, fort`, `ok back in Shop Plaza`, `ok lobby shop and back`). If `mimiText` differs only in wording, read it from the guide's `TEXT.grade5.boss('Science')` + `' '` + `TEXT.grade5.follow` in `text.js` and correct the expected string, not the app.

- [ ] **Step 4: Stage**

```bash
git add tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 12: Look check, docs and the full run

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Screenshot with seeded progress**

Copy `web/` to the scratchpad, insert the `PROGRESS` seed script from Task 11 (as plain HTML) before `<script src="../vendor/three/three.min.js"></script>` in the copy's `world/grade-5.html`, and screenshot from file:// with a fresh `--user-data-dir`:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --no-first-run --user-data-dir="<fresh dir>" --window-size=1200,800 --virtual-time-budget=8000 --screenshot="<out.png>" "file:///<scratchpad>/site/world/grade-5.html"
```

Take one at the gate and one at the plaza (add `#e2e` is not needed; instead append `<script>addEventListener("world-ready",function(){WorldDebug.teleport("plaza");});</script>` at the end of the copied page body for the plaza shot). Check: Mimi stands by the fountain in her purple coat and hat and waves; her bubble shows the boss step with Go ▶ and Later; the Science building has a gold roof and a ⚔️ marker; markers and badges are readable. Delete the copy afterwards.

- [ ] **Step 2: README**

In the "Running locally" list, change the `world-e2e.js` comment to:

```
node tests/e2e/world-e2e.js          # 3D world: maker, doors, 🏠 back, quick travel, medals, markers, Mimi's trail, fort, shop and back
```

- [ ] **Step 3: Full run**

Run: `node tools/update-precache.js && node --test && node tests/e2e/world-e2e.js && node tests/e2e/lobby-e2e.js && node tests/e2e/lobby-e2e.js 5 && node tests/e2e/guide-e2e.js && node tests/e2e/nav-e2e.js && node tests/e2e/file-check-e2e.js`
Expected: everything passes.

- [ ] **Step 4: Stage and hand the commit to the user**

```bash
git add README.md web/sw.js
```

Suggested commit for the user:

```bash
git commit -m "3D world phase 2: buildings level up with her medals (bronze flag, silver banner, gold roof with a twinkling star), boss, quest and review markers float over the right buildings, Mayor Mimi by the fountain greets her once a day with the guide's next step and lights a sparkle trail to it, doors open the guide's link, the Boss Fort shows the week's stages and opens the next one, and Bunny's counter in Shop Plaza opens the lobby's reward shop, which sends her back to Shop Plaza when she closes it; the 2D map and the 3D world read progress through the same liveDeps"
```

---

## Self-review notes

- **Spec Phase 2 coverage:** medal tiers (Tasks 6, 7), markers incl. ✨ shop and max 2 per building (`World.status`, Task 7), subject-name signs (Phase 1), Mayor Mimi with guide picker + sparkle trail + daily wave (Tasks 3, 4, 8, 9), Shop Plaza → same reward shop (Task 10, user's option A), Boss Fort glow / count / 💤 / Mimi-style message (Tasks 7, 9), redraw on return / pageshow / visibility (Task 9; the world page does not load cloud.js, so `cloud-synced` never fires there). Phase 3–4 items are not here.
- **Names across tasks:** `World.liveDeps`; `Layout.{route, spawnFor, interactables kinds mimi|counter|fort, props.mimi}`; `Prefs.{DAILY_KEY, readDaily, markDaily}`; `Progress.{cards, snapshot, doorHref, canAfford, fill}`; `S.badge`; `build()` → `{ buildings: { app: { group, roofs, roofColor, top, signY } }, shop, fort: { group, door } }`; `Decor.create(S, built)` → `{ apply, showTrail, hideTrail, trailCount, animate }`; `Cast.mimi(S)` → `{ group, animate, wave }`; `Talk.open(o)` → `{ close, el }`; `Town.create(o)` → `{ refresh, label, act, tick, handles, doorHref, snapshot, trail, talking, talkText, closeTalk }`; `WorldDebug.{snapshot, trail, talking, talkText, closeTalk, actText}`.
