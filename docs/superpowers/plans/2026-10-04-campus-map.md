# Campus Map Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each lobby opens on a tap-to-go SVG map (Grade 5 Campus, Grade 2 Bayan) where games are buildings that level up with medals, quests, due review and boss stages show as markers, the shop and boss arena are places, and a free buddy walks to the building she taps; the card list stays one tap away.

**Architecture:** One new engine file, `web/engine/world.js`, in the style of `boss.js`: pure helpers (state, status, layout geometry, an SVG string builder) exported for Node tests, plus a browser part that mounts the map over the lobby's existing `.grid` of cards. The cards stay in the page (hidden in Campus mode), so quests, the boss, review and the parent panel need no changes. The lobby's shop script adds `Wallet.canAfford()` for the shop sparkle.

**Tech Stack:** Plain ES5 JavaScript, inline SVG, `node:test` unit tests, headless-Chrome e2e (`tests/e2e/`). Static files only (GitHub Pages).

**Spec:** `docs/superpowers/specs/2026-10-04-campus-map-design.md`

**Rules for every task (from the user's CLAUDE.md):**
- Never run `git commit`. At the end of each task, give the user a `git add` block and a `git commit -m '...'` block and let them run it. No `Co-Authored-By` lines.
- Use comments sparingly; only for non-obvious code. Match the surrounding code style (ES5 `var`/`function` in engine files, 2-space indent).
- Before starting: `git status` may show staged work from another session (`tests/read-gate.test.js`, `web/engine/fx.js`, `web/engine/read-gate.js`). Leave those files alone and never add them to this feature's commit commands.

**Test commands:**
- One unit file: `node --test tests/world.test.js`
- All unit tests: `node --test` (from the repo root)
- Lobby e2e: `node tests/e2e/lobby-e2e.js` (Grade 2) and `node tests/e2e/lobby-e2e.js 5` (Grade 5)
- File-check e2e: `node tests/e2e/file-check-e2e.js`

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `web/engine/world.js` | create | `world_v1` state, `status()`, layout tables + geometry, `draw()` SVG builder, browser `mount()` |
| `tests/world.test.js` | create | unit tests for every pure helper + a browser-load check |
| `tests/world-wiring.test.js` | create | both lobbies wire the map; layout ⇄ cards; precache; exact-case script paths |
| `tests/english-everywhere.test.js` | modify | Grade 2 map text pairs Filipino with English |
| `tests/paths.js` | modify | add `world.js` to `ENGINE_FILES` (the e2e site copies it) |
| `web/sw.js` | regenerate | `node tools/update-precache.js` adds `engine/world.js` |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | modify | script tag, missing-file name, toggle button, `#campus`, `Wallet.canAfford`, mount script |
| `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js` | modify | `campus` mode + no-`world.js` checks |
| `tests/e2e/file-check-e2e.js` | modify | lobby without `world.js` names it in the red bar |
| `README.md` | modify | feature bullet + engine list line |

---

### Task 1: `world.js` core: saved state and status

**Files:**
- Create: `web/engine/world.js`
- Create: `tests/world.test.js`
- Modify: `tests/paths.js:8`
- Regenerate: `web/sw.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/world.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const W = require(engineFile('world.js'));
const { readState, saveState, status, levelOf, KEY, AVATARS, AVATAR_ORDER, DEFAULT_AVATAR, MAX_MARKERS } = W;

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const FRESH = { v: 1, avatar: null, view: 'campus', at: null, t: 0 };

test('eight buddies, cat by default', () => {
  assert.equal(AVATAR_ORDER.length, 8);
  AVATAR_ORDER.forEach((id) => assert.ok(AVATARS[id], id));
  assert.equal(DEFAULT_AVATAR, 'cat');
});

test('a fresh or broken world_v1 reads as defaults', () => {
  assert.deepEqual(readState(memory()), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: '{not json' })), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: JSON.stringify({ v: 2, avatar: 'owl' }) })), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: JSON.stringify({ v: 1, avatar: 'dragon', view: 'grid', at: 5, t: 'x' }) })), FRESH);
});

test('saveState merges into what is saved and stamps the time', () => {
  const s = memory();
  assert.equal(saveState(s, () => 42, { avatar: 'owl' }), true);
  saveState(s, () => 43, { view: 'list', at: 'life-lab' });
  assert.deepEqual(JSON.parse(s.data[KEY]), { v: 1, avatar: 'owl', view: 'list', at: 'life-lab', t: 43 });
  assert.deepEqual(readState(s), { v: 1, avatar: 'owl', view: 'list', at: 'life-lab', t: 43 });
});

test('saveState says false when storage is full', () => {
  const s = { getItem: () => null, setItem: () => { throw new Error('full'); } };
  assert.equal(saveState(s, () => 1, { view: 'list' }), false);
});

test('a game levels up only when every lesson has the medal', () => {
  assert.equal(levelOf({ gold: 0, silver: 0, bronze: 0, total: 0 }), 0);
  assert.equal(levelOf({ gold: 2, silver: 1, bronze: 0, total: 4 }), 0);
  assert.equal(levelOf({ gold: 2, silver: 1, bronze: 1, total: 4 }), 1);
  assert.equal(levelOf({ gold: 2, silver: 2, bronze: 0, total: 4 }), 2);
  assert.equal(levelOf({ gold: 4, silver: 0, bronze: 0, total: 4 }), 3);
});

test('status: markers come boss, quest, due, two at most', () => {
  const st = status(['a', 'b', 'c'], {
    tally: (app) => (app === 'a' ? { gold: 3, silver: 0, bronze: 0, total: 3 } : null),
    due: () => ({ a: 3, b: 0, c: 2 }),
    quests: () => [{ app: 'a', done: false }, { app: 'b', done: true }, { kind: 'stars' }],
    boss: () => ({ stages: [{ app: 'a', cleared: false }, { app: 'c', cleared: true }] }),
    canAfford: () => true,
  });
  assert.equal(MAX_MARKERS, 2);
  assert.deepEqual(st.apps.a.markers, [{ kind: 'boss' }, { kind: 'quest' }], 'due is dropped past two');
  assert.equal(st.apps.a.level, 3);
  assert.deepEqual(st.apps.a.tally, { gold: 3, silver: 0, bronze: 0, total: 3 });
  assert.deepEqual(st.apps.b.markers, [], 'a done quest and 0 due show nothing');
  assert.deepEqual(st.apps.c.markers, [{ kind: 'due', count: 2 }], 'a cleared stage shows nothing');
  assert.deepEqual(st.arena, { cleared: 1, total: 2, beaten: false });
  assert.equal(st.shop.sparkle, true);
});

test('status: missing, throwing or odd engines give no markers and never throw', () => {
  const boom = () => { throw new Error('x'); };
  const cases = [undefined, {}, { tally: boom, due: boom, quests: boom, boss: boom, canAfford: boom },
    { due: () => 'x', quests: () => 'x', boss: () => ({ stages: 'x' }) }];
  for (const deps of cases) {
    const st = status(['a'], deps);
    assert.deepEqual(st.apps.a, { level: 0, tally: { gold: 0, silver: 0, bronze: 0, total: 0 }, markers: [] });
    assert.deepEqual(st.arena, { cleared: 0, total: 0, beaten: false });
    assert.equal(st.shop.sparkle, false);
  }
});

test('status: the arena is beaten when every stage is cleared', () => {
  const st = status([], { boss: () => ({ stages: [{ app: 'a', cleared: true }, { app: 'b', cleared: true }] }) });
  assert.deepEqual(st.arena, { cleared: 2, total: 2, beaten: true });
});

test('status: the shop sparkles only on a real true', () => {
  assert.equal(status([], { canAfford: () => false }).shop.sparkle, false);
  assert.equal(status([], { canAfford: () => 'yes' }).shop.sparkle, false);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/world.test.js`
Expected: FAIL with `Cannot find module '...web/engine/world.js'`.

- [ ] **Step 3: Write the core of `world.js`**

Create `web/engine/world.js`:

```js
/* Loaded by both lobbies after boss.js. The pages are decoded as UTF-8, so the text can hold emoji.
   Draws the lobby as a map she taps around: every game card is a building that levels up with her medals, plus the
   shop and the weekly boss arena. The cards stay the source of names and links; Campus mode only hides them. */
(function (root) {
  'use strict';

  var KEY = 'world_v1';
  var AVATARS = { girl: '👧', boy: '👦', cat: '🐱', dog: '🐶', bear: '🐻', rabbit: '🐰', owl: '🦉', robot: '🤖' };
  var AVATAR_ORDER = ['girl', 'boy', 'cat', 'dog', 'bear', 'rabbit', 'owl', 'robot'];
  var DEFAULT_AVATAR = 'cat';
  var MAX_MARKERS = 2;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function readJson(storage, key) { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } }

  function readState(storage) {
    var d = readJson(storage, KEY), ok = isObj(d) && d.v === 1;
    return {
      v: 1,
      avatar: ok && typeof d.avatar === 'string' && has(AVATARS, d.avatar) ? d.avatar : null,
      view: ok && d.view === 'list' ? 'list' : 'campus',
      at: ok && typeof d.at === 'string' && d.at ? d.at : null,
      t: ok && typeof d.t === 'number' ? d.t : 0
    };
  }

  function saveState(storage, now, patch) {
    var s = readState(storage);
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    s.t = now();
    try { storage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }

  function safe(fn, fallback) {
    if (typeof fn !== 'function') return fallback;
    try {
      var v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function tallyOf(c) {
    function n(v) { v = Math.floor(Number(v)); return v > 0 ? v : 0; }
    return isObj(c) ? { gold: n(c.gold), silver: n(c.silver), bronze: n(c.bronze), total: n(c.total) } : { gold: 0, silver: 0, bronze: 0, total: 0 };
  }

  // Like the lobby's My Map: a game's level is its weakest lesson's medal.
  function levelOf(t) {
    if (!t.total) return 0;
    if (t.gold >= t.total) return 3;
    if (t.gold + t.silver >= t.total) return 2;
    if (t.gold + t.silver + t.bronze >= t.total) return 1;
    return 0;
  }

  function status(apps, deps) {
    deps = deps || {};
    var due = safe(deps.due, {}), quests = safe(deps.quests, []), boss = safe(deps.boss, {});
    if (!isObj(due)) due = {};
    if (!Array.isArray(quests)) quests = [];
    var stages = isObj(boss) && Array.isArray(boss.stages) ? boss.stages.filter(isObj) : [];
    var cleared = stages.filter(function (s) { return s.cleared === true; }).length;
    var out = {
      apps: {},
      shop: { sparkle: safe(deps.canAfford, false) === true },
      arena: { cleared: cleared, total: stages.length, beaten: stages.length > 0 && cleared === stages.length }
    };
    apps.forEach(function (app) {
      var tally = tallyOf(safe(function () { return deps.tally(app); }, null)), markers = [];
      if (stages.some(function (s) { return s.app === app && s.cleared !== true; })) markers.push({ kind: 'boss' });
      if (quests.some(function (q) { return isObj(q) && q.app === app && q.done !== true; })) markers.push({ kind: 'quest' });
      var n = Math.floor(Number(due[app]));
      if (n > 0) markers.push({ kind: 'due', count: n });
      out.apps[app] = { level: levelOf(tally), tally: tally, markers: markers.slice(0, MAX_MARKERS) };
    });
    return out;
  }

  var exported = { readState: readState, saveState: saveState, status: status, levelOf: levelOf,
    KEY: KEY, AVATARS: AVATARS, AVATAR_ORDER: AVATAR_ORDER, DEFAULT_AVATAR: DEFAULT_AVATAR, MAX_MARKERS: MAX_MARKERS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World = exported;
})(this);
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/world.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Register the file for e2e and offline**

In `tests/paths.js` line 8, add `'world.js'` right after `'boss.js'` in `ENGINE_FILES`:

```js
const ENGINE_FILES = ['storage.js', 'learner.js', 'clock.js', 'nav.js', 'search.js', 'read-gate.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'quests.js', 'boss.js', 'world.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'parent-panel.js'];
```

Then run: `node tools/update-precache.js`
Expected: `web/sw.js precaches N files` and `git diff web/sw.js` shows only `+  'engine/world.js',` added.

- [ ] **Step 6: Run all unit tests**

Run: `node --test`
Expected: all pass (`tests/pwa.test.js` passes because `world.js` is now precached).

- [ ] **Step 7: Hand the user the commit commands**

```bash
git add web/engine/world.js tests/world.test.js tests/paths.js web/sw.js
```

```bash
git commit -m "Start the campus map engine: world_v1 keeps her buddy, Campus or List view and the last place she visited; status() turns medals, due review, quests, the boss and the shop into building levels and markers, and never throws when an engine is missing"
```

---

### Task 2: Layout tables, geometry, places and map text

**Files:**
- Modify: `web/engine/world.js`
- Modify: `tests/world.test.js`
- Modify: `tests/english-everywhere.test.js`

- [ ] **Step 1: Write the failing tests**

Change the require line at the top of `tests/world.test.js` to:

```js
const { readState, saveState, status, levelOf, KEY, AVATARS, AVATAR_ORDER, DEFAULT_AVATAR, MAX_MARKERS,
  LAYOUT, TEXT, rects, radius, stand, route, pointAt, resolveAt, places } = W;
```

Append to `tests/world.test.js`:

```js
const CARDS5 = Object.keys(LAYOUT.grade5.apps).map((app) => ({ app, name: app + ' game', emoji: '📘', accent: '#123456', href: app + '/index.html?reset=1' }));

for (const grade of ['grade5', 'grade2']) {
  test(grade + ' layout: places fit the map, stay off the main road and never overlap', () => {
    const L = LAYOUT[grade], list = rects(grade);
    for (const a of list) {
      assert.ok(a.x0 >= 0 && a.y0 >= 0 && a.x1 <= L.w && a.y1 <= L.h, a.id + ' is inside the map');
      if (a.id !== 'arena') assert.ok(a.x1 <= L.spine - 30 || a.x0 >= L.spine + 30, a.id + ' stays off the main road');
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, a.id + ' overlaps ' + b.id);
      }
    }
  });

  test(grade + ' layout: the buddy stands between each building and the main road', () => {
    const L = LAYOUT[grade], r = radius(L);
    for (const p of rects(grade).filter((x) => x.id !== 'arena')) {
      const [x] = stand(L, { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2, w: p.x1 - p.x0, h: p.y1 - p.y0 });
      assert.ok(x - r >= p.x1 || x + r <= p.x0, p.id + ': not on the building');
      assert.ok(x + r <= L.spine - 30 || x - r >= L.spine + 30, p.id + ': not on the main road');
    }
  });
}

test('route goes to the main road, along it, then to the building', () => {
  const L = LAYOUT.grade5;
  assert.deepEqual(route(L, [413, 1252], [587, 892]), [[413, 1252], [500, 1252], [500, 892], [587, 892]]);
  assert.deepEqual(route(L, [500, 1350], [413, 892]), [[500, 1350], [500, 892], [413, 892]], 'the gate is on the road already');
});

test('pointAt walks the path by distance', () => {
  const pts = [[0, 0], [10, 0], [10, 10]];
  assert.deepEqual(pointAt(pts, 0), [0, 0]);
  assert.deepEqual(pointAt(pts, 0.25), [5, 0]);
  assert.deepEqual(pointAt(pts, 0.75), [10, 5]);
  assert.deepEqual(pointAt(pts, 1), [10, 10]);
  assert.deepEqual(pointAt([[3, 4]], 0.5), [3, 4]);
});

test('resolveAt falls back to the gate for a place that is gone', () => {
  const list = [{ id: 'a' }, { id: 'shop' }];
  assert.equal(resolveAt('a', list), 'a');
  assert.equal(resolveAt('removed-game', list), 'gate');
  assert.equal(resolveAt(null, list), 'gate');
});

test('places: cards in order, then shop and arena; an unknown card takes the spare lot, a second one is left out', () => {
  const extra = (n) => ({ app: 'new-' + n, name: 'New ' + n, emoji: '🆕', accent: '', href: 'n' + n });
  const cards = CARDS5.slice(0, 2).concat([extra(1), extra(2)]);
  const st = status(cards.map((c) => c.app), {});
  const list = places('grade5', cards, st, TEXT.grade5);
  assert.deepEqual(list.map((p) => p.id), [CARDS5[0].app, CARDS5[1].app, 'new-1', 'shop', 'arena']);
  assert.deepEqual([list[2].x, list[2].y], [LAYOUT.grade5.lot.x, LAYOUT.grade5.lot.y]);
  assert.equal(list[0].href, CARDS5[0].href);
  assert.equal(list[3].name, TEXT.grade5.shop);
  assert.deepEqual(list[4].arena, { cleared: 0, total: 0, beaten: false });
});
```

Append to `tests/english-everywhere.test.js`:

```js
test('every Grade 2 campus map line has English', () => {
  const { TEXT } = require(engineFile('world.js'));
  const t = TEXT.grade2;
  [t.campus, t.list, t.mapLabel, t.pick, t.skip, t.buddy, t.shop, t.arena, t.boss, t.quest, t.sparkle,
    t.due(1), t.due(3), t.arenaCount(1, 3), t.beaten, t.noBoss].concat(t.level)
    .forEach((line) => hasEnglishWhereFilipino(line, 'campus text'));
  assert.match(t.pick, /Pick your buddy!/);
  assert.equal(t.skip, 'Skip', 'buttons are English only');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/world.test.js tests/english-everywhere.test.js`
Expected: FAIL: `rects is not a function` (and `Cannot read properties of undefined (reading 'grade2')` in the English test).

- [ ] **Step 3: Add the layout, text and geometry**

In `web/engine/world.js`, add after `var MAX_MARKERS = 2;`:

```js
  var SPINE_HALF = 30;
  var ARENA = { w: 260, h: 140 };

  // One canvas per grade. Buildings sit in two columns either side of the main road (x = spine), from the gate at the
  // bottom to the boss arena at the top; every walk goes building → main road → building, so no path graph is needed.
  var LAYOUT = {
    grade5: {
      w: 1000, h: 1400, bw: 300, bh: 150, spine: 500, gate: [500, 1350],
      arena: { x: 500, y: 110 }, shop: { x: 230, y: 1210 }, lot: { x: 770, y: 1210 },
      trees: [[150, 1345], [300, 1355], [700, 1355], [850, 1345], [180, 110], [300, 80], [700, 80], [820, 110]],
      apps: {
        'history-explorers': { x: 230, y: 1030, roof: 'peak' },
        'wikaharian': { x: 770, y: 1030, roof: 'dome' },
        'math-mastery': { x: 230, y: 850, roof: 'flat' },
        'page-turners': { x: 770, y: 850, roof: 'peak' },
        'rise-shine': { x: 230, y: 670, roof: 'dome' },
        'rally-ready': { x: 770, y: 670, roof: 'flat' },
        'craft-corner': { x: 230, y: 490, roof: 'peak' },
        'life-lab': { x: 770, y: 490, roof: 'dome' },
        'net-navigators': { x: 230, y: 310, roof: 'flat' },
        'rhythm-hues': { x: 770, y: 310, roof: 'peak' }
      }
    },
    grade2: {
      w: 1000, h: 1260, bw: 320, bh: 170, spine: 500, gate: [500, 1210],
      arena: { x: 500, y: 110 }, shop: { x: 230, y: 1060 }, lot: { x: 770, y: 1060 },
      trees: [[150, 1215], [300, 1220], [700, 1220], [850, 1215], [700, 270], [850, 330], [900, 230], [180, 110], [820, 110]],
      apps: {
        'block-bot': { x: 230, y: 870, roof: 'flat' },
        'kuwentista': { x: 770, y: 870, roof: 'peak' },
        'word-train': { x: 230, y: 680, roof: 'dome' },
        'batang-bayani': { x: 770, y: 680, roof: 'peak' },
        'growing-good': { x: 230, y: 490, roof: 'dome' },
        'byte-buddies': { x: 770, y: 490, roof: 'flat' },
        'science-detectives': { x: 230, y: 300, roof: 'peak' }
      }
    }
  };

  function dueEn(n) { return n + (n === 1 ? ' review question due' : ' review questions due'); }
  function arenaEn(c, n) { return c + ' of ' + n + ' stages cleared'; }
  var TEXT = {
    grade5: {
      campus: '🗺️ Campus', list: '📋 List', mapLabel: 'Campus map',
      pick: 'Pick your buddy!', skip: 'Skip', buddy: 'Your buddy. Tap to change.',
      shop: 'Shop', arena: 'Boss Arena',
      level: ['', 'bronze', 'silver', 'gold'],
      boss: 'boss stage this week', quest: 'quest today', sparkle: 'you can buy a reward',
      due: dueEn, arenaCount: arenaEn, beaten: 'boss beaten', noBoss: 'no boss this week'
    },
    grade2: {
      campus: '🗺️ Bayan', list: '📋 List', mapLabel: 'Mapa ng bayan · Map of the village',
      pick: 'Piliin ang kasama mo! · Pick your buddy!', skip: 'Skip', buddy: 'Your buddy. Tap to change.',
      shop: 'Tindahan · Shop', arena: 'Boss Fort',
      level: ['', 'bronze', 'silver', 'gold'],
      boss: 'boss stage this week', quest: 'quest today', sparkle: 'you can buy a reward',
      due: dueEn, arenaCount: arenaEn, beaten: 'boss beaten', noBoss: 'no boss this week'
    }
  };
```

Add after the `status` function:

```js
  function box(id, x, y, w, h) { return { id: id, x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }; }

  // Every fixed spot on a grade's map as a rectangle, for the layout tests.
  function rects(grade) {
    var L = LAYOUT[grade];
    var out = Object.keys(L.apps).map(function (app) { return box(app, L.apps[app].x, L.apps[app].y, L.bw, L.bh); });
    out.push(box('shop', L.shop.x, L.shop.y, L.bw, L.bh), box('lot', L.lot.x, L.lot.y, L.bw, L.bh),
      box('arena', L.arena.x, L.arena.y, ARENA.w, ARENA.h));
    return out;
  }

  function radius(L) { return Math.round(L.bh * 0.22); }

  // Where the buddy stands by a place: beside it on the road side, near its foot; below the arena.
  function stand(L, p) {
    var r = radius(L);
    if (p.x === L.spine) return [L.spine, p.y + p.h / 2 + r];
    return [p.x < L.spine ? p.x + p.w / 2 + r : p.x - p.w / 2 - r, p.y + p.h / 2 - r];
  }

  function route(L, from, to) {
    var out = [];
    [from, [L.spine, from[1]], [L.spine, to[1]], to].forEach(function (p) {
      var last = out[out.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    });
    return out;
  }

  // The point a fraction f (0-1) of the way along the path; every leg is level or upright.
  function pointAt(pts, f) {
    var lens = [], total = 0, i;
    for (i = 1; i < pts.length; i++) {
      lens.push(Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]));
      total += lens[i - 1];
    }
    var d = f * total;
    for (i = 1; i < pts.length; i++) {
      if (d <= lens[i - 1] || i === pts.length - 1) {
        var k = lens[i - 1] ? Math.min(1, d / lens[i - 1]) : 1;
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      }
      d -= lens[i - 1];
    }
    return pts[pts.length - 1];
  }

  function resolveAt(at, list) {
    return at && list.some(function (p) { return p.id === at; }) ? at : 'gate';
  }

  // The places to draw, in order: a building per card, then the shop and the arena. A card with no spot in the
  // layout takes the spare lot; any more than one is left to the List view.
  function places(grade, cards, st, T) {
    var L = LAYOUT[grade], list = [], lotUsed = false;
    cards.forEach(function (c) {
      var spot = L.apps[c.app];
      if (!spot) {
        if (lotUsed) return;
        lotUsed = true;
        spot = L.lot;
      }
      var s = st.apps[c.app] || { level: 0, tally: tallyOf(null), markers: [] };
      list.push({ id: c.app, kind: 'game', x: spot.x, y: spot.y, w: L.bw, h: L.bh, roof: spot.roof || 'flat',
        name: c.name, emoji: c.emoji, accent: c.accent, href: c.href, level: s.level, tally: s.tally, markers: s.markers });
    });
    list.push({ id: 'shop', kind: 'shop', x: L.shop.x, y: L.shop.y, w: L.bw, h: L.bh, roof: 'peak', name: T.shop, emoji: '🛒',
      level: 0, tally: null, markers: st.shop.sparkle ? [{ kind: 'sparkle' }] : [] });
    list.push({ id: 'arena', kind: 'arena', x: L.arena.x, y: L.arena.y, w: ARENA.w, h: ARENA.h, roof: 'flat', name: T.arena, emoji: '🐉',
      level: 0, tally: null, markers: [], arena: st.arena });
    return list;
  }
```

Replace the `var exported = ...` statement with:

```js
  var exported = { readState: readState, saveState: saveState, status: status, levelOf: levelOf, rects: rects, radius: radius,
    stand: stand, route: route, pointAt: pointAt, resolveAt: resolveAt, places: places,
    LAYOUT: LAYOUT, TEXT: TEXT, KEY: KEY, AVATARS: AVATARS, AVATAR_ORDER: AVATAR_ORDER, DEFAULT_AVATAR: DEFAULT_AVATAR, MAX_MARKERS: MAX_MARKERS };
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/world.test.js tests/english-everywhere.test.js`
Expected: PASS. If a layout test fails, fix the numbers in `LAYOUT`, not the test.

- [ ] **Step 5: Hand the user the commit commands**

```bash
git add web/engine/world.js tests/world.test.js tests/english-everywhere.test.js
```

```bash
git commit -m "Lay out the campus maps: Grade 5 Campus with 10 buildings and Grade 2 Bayan with 7, each beside one main road from the gate to the boss arena, plus the shop and a spare lot for a new game; tests keep places on the map, off the road and apart, and the Grade 2 map text in English too"
```

---

### Task 3: Draw the map as an SVG string

**Files:**
- Modify: `web/engine/world.js`
- Modify: `tests/world.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/world.test.js` (it calls `W.draw`, so the require line stays as it is):

```js
test('draw: one group per place, tiers, markers, escaped labels and one buddy', () => {
  const cards = CARDS5.slice(0, 2).map((c) => ({ ...c }));
  cards[0].name = 'Math <Mastery>';
  const st = status(cards.map((c) => c.app), {
    tally: (app) => (app === cards[0].app ? { gold: 4, silver: 0, bronze: 0, total: 4 } : { gold: 0, silver: 1, bronze: 2, total: 3 }),
    due: () => ({ [cards[1].app]: 3 }),
    quests: () => [{ app: cards[0].app }],
    boss: () => ({ stages: [{ app: cards[1].app, cleared: false }, { app: cards[0].app, cleared: true }] }),
    canAfford: () => true,
  });
  const svg = W.draw('grade5', places('grade5', cards, st, TEXT.grade5), 'owl', cards[0].app, TEXT.grade5);
  assert.equal((svg.match(/class="w-place /g) || []).length, 4, '2 games, the shop and the arena');
  assert.ok(svg.includes('data-place="' + cards[0].app + '"'));
  assert.ok(svg.includes('w-tier-3') && svg.includes('w-tier-1'));
  assert.ok(svg.includes('Math &lt;Mastery&gt;') && !svg.includes('<Mastery>'), 'names are escaped');
  assert.ok(svg.includes('aria-label="Math &lt;Mastery&gt;, gold, quest today"'));
  assert.ok(svg.includes('aria-label="' + cards[1].app + ' game, bronze, boss stage this week, 3 review questions due"'));
  assert.ok(svg.includes('aria-label="Shop, you can buy a reward"'));
  assert.ok(svg.includes('aria-label="Boss Arena, 1 of 2 stages cleared"'));
  for (const mark of ['>🔁3<', '>⚔️<', '>❗<', '>✨<']) assert.ok(svg.includes(mark), mark);
  assert.ok(svg.includes('>🥇4 🥈0 🥉0 / 4<'), 'tally strip');
  assert.ok(svg.includes('>1 / 2<'), 'arena count');
  assert.equal((svg.match(/class="w-avatar"/g) || []).length, 1);
  assert.ok(svg.includes('>' + AVATARS.owl + '<'));
  assert.ok(svg.startsWith('<svg class="w-map" viewBox="0 0 1000 1400"'));
});

test('draw: the buddy waits at the gate when its place is gone, and an unknown buddy is the cat', () => {
  const list = places('grade5', CARDS5.slice(0, 1), status([CARDS5[0].app], {}), TEXT.grade5);
  const svg = W.draw('grade5', list, 'dragon', 'removed-game', TEXT.grade5);
  assert.ok(svg.includes('class="w-avatar" data-avatar="" tabindex="0" role="button" aria-label="Your buddy. Tap to change." transform="translate(500 1350)"'));
  assert.ok(svg.includes('>' + AVATARS.cat + '<'));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/world.test.js`
Expected: FAIL with `W.draw is not a function`.

- [ ] **Step 3: Write the SVG builder**

In `web/engine/world.js`, add after `var ARENA = ...;`:

```js
  var MARK = { boss: '⚔️', quest: '❗', sparkle: '✨' };
```

Add after the `places` function:

```js
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // Long names are squeezed onto the board instead of spilling past it.
  function svgText(cls, x, y, size, value, max) {
    var v = String(value), squeeze = v.length * size * 0.56 > max ? ' textLength="' + max + '" lengthAdjust="spacingAndGlyphs"' : '';
    return '<text' + (cls ? ' class="' + cls + '"' : '') + ' x="' + x + '" y="' + y + '" font-size="' + size + '"' + squeeze + '>' + esc(v) + '</text>';
  }

  function markText(m) { return m.kind === 'due' ? '🔁' + m.count : MARK[m.kind]; }

  function label(p, T) {
    var parts = [p.name];
    if (p.kind === 'arena') parts.push(!p.arena.total ? T.noBoss : p.arena.beaten ? T.beaten : T.arenaCount(p.arena.cleared, p.arena.total));
    if (p.level) parts.push(T.level[p.level]);
    p.markers.forEach(function (m) { parts.push(m.kind === 'due' ? T.due(m.count) : T[m.kind]); });
    return parts.join(', ');
  }

  function subLine(p) {
    if (p.kind === 'arena') return p.arena.total ? (p.arena.beaten ? '✅ ' : '') + p.arena.cleared + ' / ' + p.arena.total : '';
    return p.tally && p.tally.total ? '🥇' + p.tally.gold + ' 🥈' + p.tally.silver + ' 🥉' + p.tally.bronze + ' / ' + p.tally.total : '';
  }

  function roofPath(p, top, rh) {
    var l = p.x - p.w / 2 + 8, r = p.x + p.w / 2 - 8, base = top + rh;
    if (p.roof === 'peak') return 'M' + l + ' ' + base + 'L' + p.x + ' ' + top + 'L' + r + ' ' + base + 'Z';
    if (p.roof === 'dome') return 'M' + l + ' ' + base + 'A' + (r - l) / 2 + ' ' + rh + ' 0 0 1 ' + r + ' ' + base + 'Z';
    return 'M' + l + ' ' + (top + rh / 2) + 'H' + r + 'V' + base + 'H' + l + 'Z';
  }

  // A building: roof, body with the card's emoji, a name board with the medal tally, then up to two markers.
  // Bronze adds a flag, Silver a banner, Gold a gold roof and a glow.
  function drawPlace(p, T) {
    var top = p.y - p.h / 2, left = p.x - p.w / 2, rh = Math.round(p.h * 0.2), bodyTop = top + rh, bodyH = Math.round(p.h * 0.38);
    var boardTop = bodyTop + bodyH, boardH = p.h - rh - bodyH, font = Math.round(boardH * 0.42), u = Math.round(p.h / 6);
    var sub = subLine(p), beaten = p.arena && p.arena.beaten;
    var s = '<g class="w-place w-' + p.kind + ' w-tier-' + p.level + (beaten ? ' w-beaten' : '') + '" data-place="' + esc(p.id) +
      '" tabindex="0" role="link" aria-label="' + esc(label(p, T)) + '"' + (p.accent ? ' style="--acc:' + esc(p.accent) + '"' : '') + '>';
    if (p.level === 3) s += '<rect class="w-glow" x="' + (left - 10) + '" y="' + (top - 10) + '" width="' + (p.w + 20) + '" height="' + (p.h + 20) + '" rx="28"/>';
    s += '<path class="w-roof' + (p.level === 3 ? ' w-gold' : '') + '" d="' + roofPath(p, top, rh) + '"/>';
    s += '<rect class="w-body" x="' + (left + 8) + '" y="' + bodyTop + '" width="' + (p.w - 16) + '" height="' + bodyH + '" rx="10"/>';
    if (p.level >= 2) s += '<rect class="w-banner" x="' + (left + 20) + '" y="' + (bodyTop + 6) + '" width="' + u + '" height="' + (bodyH - 12) + '" rx="4"/>';
    if (p.level >= 1) {
      var px = Math.round(p.x + p.w * 0.3), py = top - 6;
      s += '<path class="w-pole" d="M' + px + ' ' + bodyTop + 'V' + py + '"/>' +
        '<path class="w-flag" d="M' + px + ' ' + py + 'l' + u + ' ' + u / 2 + 'l' + -u + ' ' + u / 2 + 'Z"/>';
    }
    s += svgText('w-emoji', p.x, bodyTop + bodyH / 2, Math.round(bodyH * 0.62), p.emoji, p.w);
    s += '<rect class="w-board" x="' + left + '" y="' + boardTop + '" width="' + p.w + '" height="' + boardH + '" rx="10"/>';
    s += svgText('w-name', p.x, sub ? boardTop + boardH * 0.32 : boardTop + boardH / 2, font, p.name, p.w - 16);
    if (sub) s += svgText('w-sub', p.x, boardTop + boardH * 0.74, Math.round(font * 0.72), sub, p.w - 16);
    p.markers.forEach(function (m, i) {
      var mw = Math.round(u * 2.4), mh = Math.round(u * 1.4), mx = left + p.w - mw - i * (mw + 6), my = top - Math.round(mh / 2);
      s += '<g class="w-marker w-m-' + m.kind + '" aria-hidden="true"><rect x="' + mx + '" y="' + my + '" width="' + mw + '" height="' + mh +
        '" rx="' + Math.round(mh / 2) + '"/>' + svgText('', mx + mw / 2, my + mh / 2, Math.round(mh * 0.62), markText(m), mw - 8) + '</g>';
    });
    return s + '</g>';
  }

  function drawTree(t) {
    return '<g class="w-tree" aria-hidden="true"><rect x="' + (t[0] - 6) + '" y="' + (t[1] + 16) + '" width="12" height="24"/>' +
      '<circle cx="' + t[0] + '" cy="' + t[1] + '" r="28"/></g>';
  }

  function drawGate(L) {
    var x0 = L.spine - SPINE_HALF - 18, x1 = L.spine + SPINE_HALF + 6, y = L.gate[1] - 46;
    return '<g class="w-gate" aria-hidden="true"><rect x="' + x0 + '" y="' + y + '" width="12" height="66"/>' +
      '<rect x="' + x1 + '" y="' + y + '" width="12" height="66"/>' +
      '<rect x="' + x0 + '" y="' + (y - 12) + '" width="' + (x1 - x0 + 12) + '" height="14" rx="6"/></g>';
  }

  function drawAvatar(spot, avatar, r, T) {
    return '<g class="w-avatar" data-avatar="" tabindex="0" role="button" aria-label="' + esc(T.buddy) + '" transform="translate(' + spot[0] + ' ' + spot[1] + ')">' +
      '<circle r="' + r + '"/>' + svgText('', 0, 0, Math.round(r * 1.2), AVATARS[avatar], r * 2) + '</g>';
  }

  function draw(grade, list, avatar, at, T) {
    var L = LAYOUT[grade], r = radius(L), byId = {};
    list.forEach(function (p) { byId[p.id] = p; });
    var s = '<svg class="w-map" viewBox="0 0 ' + L.w + ' ' + L.h + '" role="group" aria-label="' + esc(T.mapLabel) + '">' +
      '<rect class="w-ground" width="' + L.w + '" height="' + L.h + '" rx="40"/>' +
      '<path class="w-road" stroke-width="' + SPINE_HALF * 2 + '" d="M' + L.spine + ' ' + L.gate[1] + 'V' + (L.arena.y + ARENA.h / 2) + '"/>';
    list.forEach(function (p) {
      if (p.kind === 'arena') return;
      var edge = p.x < L.spine ? p.x + p.w / 2 : p.x - p.w / 2;
      s += '<path class="w-road" stroke-width="' + r + '" d="M' + edge + ' ' + stand(L, p)[1] + 'H' + L.spine + '"/>';
    });
    L.trees.forEach(function (t) { s += drawTree(t); });
    s += drawGate(L);
    list.forEach(function (p) { s += drawPlace(p, T); });
    var spot = has(byId, at) ? stand(L, byId[at]) : L.gate;
    return s + drawAvatar(spot, has(AVATARS, avatar) ? avatar : DEFAULT_AVATAR, r, T) + '</svg>';
  }
```

Add `draw: draw,` to the `exported` object (after `places: places,`).

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/world.test.js`
Expected: PASS. If the marker test fails only on `'>⚔️<'`, check that `MARK.boss` in `world.js` and the test both use U+2694 U+FE0F.

- [ ] **Step 5: Hand the user the commit commands**

```bash
git add web/engine/world.js tests/world.test.js
```

```bash
git commit -m "Draw the campus map: each game is a building with its card's emoji, color and name, a medal tally, a flag for Bronze, a banner for Silver and a gold roof for Gold; markers show a boss stage, an open quest and due review; the shop sparkles when a reward is affordable and the arena counts stages cleared; every place has a spoken label"
```

---

### Task 4: Mount the map in the browser

**Files:**
- Modify: `web/engine/world.js`
- Modify: `tests/world.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/world.test.js`:

```js
test('in a browser page without data-grade, World has the helpers but no map', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const win = {};
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('world.js'), 'utf8'), win);
  assert.equal(typeof win.World.status, 'function');
  assert.ok(win.World.LAYOUT.grade5);
  assert.equal(win.World.mount, undefined);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/world.test.js`
Expected: PASS already, because the Task 1 tail sets `root.World = exported`. This test is a guard: the bootstrap written below must keep it passing (helpers present, no `mount` without `data-grade`).

- [ ] **Step 3: Add the browser part**

In `web/engine/world.js`, add after `var MARK = ...;`:

```js
  var WALK_MS = 600;
```

Add after the `draw` function:

```js
  var UI_CSS =
    '.grid[hidden],.campus[hidden],.campus-toggle[hidden]{display:none!important;}' +
    '.campus{position:relative;margin:0 0 16px;}' +
    '.campus-toggle{font:inherit;font-weight:800;cursor:pointer;margin-top:10px;padding:8px 18px;border-radius:999px;' +
      'border:1.5px solid var(--border);background:var(--card);color:var(--ink);}' +
    '.w-map{display:block;width:100%;height:auto;}' +
    '.w-map text{text-anchor:middle;dominant-baseline:central;font-family:inherit;}' +
    '.w-ground{fill:var(--bg-alt);}' +
    '.w-road{fill:none;stroke:var(--card);stroke-linecap:round;}' +
    '.w-tree circle{fill:#5FAF6B;}.w-tree rect{fill:#8A5E3B;}' +
    '.w-gate rect{fill:var(--ink-soft);}' +
    '.w-place,.w-avatar{cursor:pointer;outline:none;}' +
    '.w-place:focus-visible .w-board,.w-avatar:focus-visible circle{stroke:var(--ink);stroke-width:6;}' +
    '.w-roof{fill:var(--acc,var(--ink-soft));}.w-roof.w-gold{fill:#E0A526;}' +
    '.w-body{fill:var(--card);stroke:var(--acc,var(--ink-soft));stroke-width:4;}' +
    '.w-board{fill:var(--card);stroke:var(--acc,var(--border));stroke-width:3;}' +
    '.w-name{fill:var(--ink);font-weight:800;}.w-sub{fill:var(--ink-soft);font-weight:700;}' +
    '.w-pole{stroke:var(--ink-soft);stroke-width:4;}' +
    '.w-flag{fill:#C9772B;}.w-tier-2 .w-flag{fill:#9AA4AE;}.w-tier-3 .w-flag{fill:#E0A526;}' +
    '.w-banner{fill:var(--acc,var(--ink-soft));opacity:.55;}' +
    '.w-glow{fill:#F6D36B;opacity:.35;}' +
    '.w-marker rect{fill:var(--card);stroke:var(--ink);stroke-width:3;}.w-marker text{fill:var(--ink);font-weight:800;}' +
    '.w-m-boss rect{fill:#F3ECFF;stroke:#7C4DDB;}.w-m-sparkle rect{fill:var(--gold-soft);stroke:var(--gold-deep);}' +
    '.w-arena .w-roof{fill:#7C4DDB;}.w-arena .w-body{stroke:#7C4DDB;}.w-shop .w-roof{fill:var(--gold-deep);}' +
    '.w-beaten{opacity:.55;filter:grayscale(1);}' +
    '.w-avatar circle{fill:var(--card);stroke:var(--header-accent);stroke-width:5;}' +
    '.w-picker{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'padding:16px;background:var(--card);border:1.5px solid var(--border);border-radius:20px;}' +
    '.w-picker[hidden]{display:none;}' +
    '.w-pick-title{margin:0;font-weight:800;font-size:1.2rem;text-align:center;}' +
    '.w-pick-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;width:100%;max-width:420px;}' +
    '.w-pick-grid button{font-size:2.2rem;padding:10px 0;border-radius:16px;border:1.5px solid var(--border);background:var(--bg-alt);cursor:pointer;}' +
    '.w-pick-grid button[aria-pressed="true"]{border:3px solid var(--header-accent);}' +
    '.w-skip{font:inherit;font-weight:800;padding:8px 18px;border-radius:12px;border:0;background:var(--bg-alt);color:var(--ink);cursor:pointer;}';

  function pickerHtml(T, current) {
    var s = '<div class="w-picker" hidden role="dialog" aria-label="' + esc(T.pick) + '"><p class="w-pick-title">' + esc(T.pick) + '</p><div class="w-pick-grid">';
    AVATAR_ORDER.forEach(function (id) {
      s += '<button type="button" data-pick="' + id + '" aria-label="' + id + '" aria-pressed="' + (id === current) + '">' + AVATARS[id] + '</button>';
    });
    return s + '</div><button type="button" class="w-skip">' + esc(T.skip) + '</button></div>';
  }

  function cardsOf(grid) {
    return Array.prototype.map.call(grid.querySelectorAll('.subject-card[data-app]'), function (c) {
      function textOf(sel) { var e = c.querySelector(sel); return e ? e.textContent.trim() : ''; }
      return {
        app: c.getAttribute('data-app'),
        name: textOf('.subject-app') || textOf('.subject-title') || c.getAttribute('data-app'),
        emoji: textOf('.subject-emoji'),
        accent: c.style.getPropertyValue('--card-accent').trim(),
        href: c.getAttribute('href')
      };
    });
  }

  function mountUi(win, grade, storage, deps) {
    var doc = win.document, T = TEXT[grade], L = LAYOUT[grade], api = {}, walking = null, asked = false;
    var style = doc.createElement('style');
    style.textContent = UI_CSS;
    (doc.head || doc.documentElement).appendChild(style);

    function reduced() {
      try { return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }
    function put(el, pt) { el.setAttribute('transform', 'translate(' + pt[0] + ' ' + pt[1] + ')'); }

    // Moves the buddy along the path, then calls done once. finish() jumps to the end; stop() only halts.
    function walk(el, pts, ms, done) {
      var start = null, over = false, frame = null;
      var ask = win.requestAnimationFrame ? function (f) { return win.requestAnimationFrame(f); } : function (f) { return win.setTimeout(function () { f(Date.now()); }, 16); };
      var drop = win.cancelAnimationFrame ? function (id) { win.cancelAnimationFrame(id); } : function (id) { win.clearTimeout(id); };
      function stop() { over = true; if (frame !== null) drop(frame); }
      function finish() {
        if (over) return;
        stop();
        put(el, pts[pts.length - 1]);
        done();
      }
      frame = ask(function step(t) {
        if (over) return;
        if (start === null) start = t;
        var f = Math.min(1, (t - start) / ms);
        put(el, pointAt(pts, f));
        if (f < 1) frame = ask(step);
        else finish();
      });
      return { finish: finish, stop: stop };
    }

    api.text = T;
    api.walkMs = WALK_MS;
    api.navigate = function (href) { win.location.href = href; };

    // Draws the map into box and hides the cards (or the reverse, in List view). Safe to call again: it replaces
    // its own SVG. If anything fails, the cards stay as they were.
    api.mount = function (box, grid, toggle) {
      if (!box || !grid) return false;
      if (walking) { walking.stop(); walking = null; }
      var list, state, at;
      try {
        var cards = cardsOf(grid);
        state = readState(storage);
        list = places(grade, cards, status(cards.map(function (c) { return c.app; }), deps), T);
        at = resolveAt(state.at, list);
        box.innerHTML = draw(grade, list, state.avatar || DEFAULT_AVATAR, at, T) + pickerHtml(T, state.avatar);
      } catch (e) {
        box.innerHTML = '';
        box.hidden = true;
        grid.hidden = false;
        if (toggle) toggle.hidden = true;
        return false;
      }
      var svg = box.querySelector('.w-map'), buddy = box.querySelector('.w-avatar'), picker = box.querySelector('.w-picker');

      function find(id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
      function spot(id) { var p = find(id); return p ? stand(L, p) : L.gate; }
      function act(p) {
        if (p.kind === 'game') return api.navigate(p.href);
        if (p.kind === 'shop') {
          var b = doc.getElementById('shop-open');
          if (b) b.click();
          return;
        }
        var boss = doc.getElementById('boss');
        if (boss && boss.scrollIntoView) boss.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }
      function go(id) {
        if (walking) return walking.finish();
        var p = find(id);
        if (!p) return;
        var path = route(L, spot(at), stand(L, p));
        at = id;
        saveState(storage, deps.now, { at: id });
        if (reduced() || !(api.walkMs > 0)) {
          put(buddy, path[path.length - 1]);
          return act(p);
        }
        walking = walk(buddy, path, api.walkMs, function () { walking = null; act(p); });
      }
      function openPicker(focus) {
        picker.hidden = false;
        var first = picker.querySelector('button');
        if (focus && first) first.focus();
      }
      function activate(target) {
        if (!target || !target.closest) return;
        if (target.closest('.w-avatar')) return openPicker(true);
        var g = target.closest('[data-place]');
        if (g) go(g.getAttribute('data-place'));
      }

      svg.addEventListener('click', function (e) { activate(e.target); });
      svg.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activate(e.target);
      });
      picker.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var pick = b.getAttribute('data-pick');
        saveState(storage, deps.now, { avatar: pick || state.avatar || DEFAULT_AVATAR });
        if (pick) return api.mount(box, grid, toggle);
        picker.hidden = true;
      });

      var campus = state.view !== 'list';
      box.hidden = !campus;
      grid.hidden = campus;
      if (toggle) {
        toggle.textContent = campus ? T.list : T.campus;
        toggle.hidden = false;
        if (!toggle.getAttribute('data-wired')) {
          toggle.setAttribute('data-wired', '1');
          toggle.addEventListener('click', function () {
            saveState(storage, deps.now, { view: readState(storage).view === 'list' ? 'campus' : 'list' });
            api.mount(box, grid, toggle);
          });
        }
      }
      if (campus && !state.avatar && !asked) {
        asked = true;
        openPicker(false);
      }
      return true;
    };
    return api;
  }
```

Replace the tail (from `var exported = ...` to the end of the file) with:

```js
  var exported = { readState: readState, saveState: saveState, status: status, levelOf: levelOf, rects: rects, radius: radius,
    stand: stand, route: route, pointAt: pointAt, resolveAt: resolveAt, places: places, draw: draw,
    LAYOUT: LAYOUT, TEXT: TEXT, KEY: KEY, AVATARS: AVATARS, AVATAR_ORDER: AVATAR_ORDER, DEFAULT_AVATAR: DEFAULT_AVATAR, MAX_MARKERS: MAX_MARKERS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies get the map for their grade; a page without data-grade gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && LAYOUT[grade]) {
      var storage = root.Learner ? root.Learner.storage : root.localStorage;
      api = mountUi(root, grade, storage, {
        now: Date.now,
        tally: function (app) { var M = root.Mastery; return M && M.summary && M.counts ? M.counts(M.summary().apps[app]) : null; },
        due: function () { return root.Recall && root.Recall.dueByApp ? root.Recall.dueByApp() : {}; },
        quests: function () { return root.Quests && root.Quests.state ? root.Quests.state().list : []; },
        boss: function () { return root.Boss && root.Boss.current ? root.Boss.current() : {}; },
        canAfford: function () { var W = root.Wallet; return !!(W && W.canAfford && W.canAfford()); }
      });
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.World = api;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Run the unit tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Hand the user the commit commands**

```bash
git add web/engine/world.js tests/world.test.js
```

```bash
git commit -m "Mount the campus map in the lobby: World.mount draws the map over the hidden cards, walks her buddy along the road to the building she taps and then opens that game, the shop or the boss card; the buddy picker opens once for a new player, Skip keeps the cat; Campus or List is remembered; any failure leaves the cards showing"
```

---

### Task 5: Wire both lobbies

**Files:**
- Create: `tests/world-wiring.test.js`
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html`

- [ ] **Step 1: Write the failing wiring test**

Create `tests/world-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { LOBBIES, APPS, WEB, ENGINE_FILES, lobbyFile, appFile, engineFile, web } = require('./paths.js');
const { LAYOUT } = require(engineFile('world.js'));

const count = (html, s) => html.split(s).length - 1;

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby draws the campus map', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/world.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads world.js once');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/boss.js"'), 'after boss.js');
    assert.equal(count(html, '<button class="campus-toggle" id="campus-toggle" type="button" hidden></button>'), 1, 'toggle in the hero');
    assert.equal(count(html, '<div class="campus" id="campus" hidden></div>'), 1);
    assert.ok(html.indexOf('id="campus"') < html.indexOf('<div class="grid">'), 'the map sits above the cards');
    assert.equal(count(html, "World.mount(document.getElementById('campus'), document.querySelector('.grid'), document.getElementById('campus-toggle'))"), 1);
    assert.ok(html.indexOf('<script data-campus>') > html.indexOf('<script data-shop>'), 'mounted after the shop sets Wallet.canAfford');
    assert.equal(count(html, 'W.canAfford = function(){'), 1, 'the shop tells the map when a reward is affordable');
    assert.ok(html.includes("'parent-panel': 'ParentPanel', world: 'World' };"), 'the missing-file bar knows world.js');
  });

  test('grade ' + grade + ' map has a spot for every card and a card for every spot', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const cards = [...html.matchAll(/class="subject-card" data-app="([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(Object.keys(LAYOUT['grade' + grade].apps).sort(), cards);
  });
}

test('world.js is cached for offline use and copied to the e2e site', () => {
  assert.ok(fs.readFileSync(web('sw.js'), 'utf8').includes("'engine/world.js',"));
  assert.ok(ENGINE_FILES.includes('world.js'));
});

// GitHub Pages is case-sensitive and Windows is not: World.js would work here and break online.
test('every script path matches a real file name exactly, case included', () => {
  const pages = [...Object.keys(LOBBIES).map((g) => lobbyFile(g)), ...APPS.map((a) => appFile(a.id))];
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      let dir = path.dirname(file);
      for (const part of m[1].split('/')) {
        if (part === '..') { dir = path.dirname(dir); continue; }
        if (part === '.') continue;
        assert.ok(fs.readdirSync(dir).includes(part), path.relative(WEB, file) + ': ' + m[1] + ' (no "' + part + '" in ' + (path.relative(WEB, dir) || 'web') + ')');
        dir = path.join(dir, part);
      }
    }
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world-wiring.test.js`
Expected: the two "draws the campus map" tests FAIL (`loads world.js once`); the layout, precache and case tests PASS.

- [ ] **Step 3: Edit `web/lobby/grade-5.html`**

Make these six edits (each anchor appears once):

1. After `<script src="../engine/boss.js" data-grade="grade5"></script>` add the line:
   ```html
   <script src="../engine/world.js" data-grade="grade5"></script>
   ```
2. In the `data-file-check` script, change `'parent-panel': 'ParentPanel' };` to `'parent-panel': 'ParentPanel', world: 'World' };`
3. After `    <div class="points-combined" id="points-combined-badge"></div>` add:
   ```html
       <button class="campus-toggle" id="campus-toggle" type="button" hidden></button>
   ```
4. After `  <div class="map-view" id="map-view" hidden></div>` add:
   ```html
     <div class="campus" id="campus" hidden></div>
   ```
5. In the `data-shop` script, after `  W.refreshShop = renderList;` add:
   ```js
     W.canAfford = function(){
       var points = readPoints();
       return W.catalog.some(function(item){ return W.canBuy(item.id, points).ok; });
     };
   ```
6. Right before the parent-panel script (the `<script>` whose second line is `(function(){` and third is `  var SH = window.StudyHistory, P = window.ParentPanel;`), insert:
   ```html
   <script data-campus>
   (function(){
     if (!window.World || !World.mount) return;
     function draw(){ World.mount(document.getElementById('campus'), document.querySelector('.grid'), document.getElementById('campus-toggle')); }
     draw();
     document.addEventListener('cloud-synced', draw);
     window.addEventListener('pageshow', function(e){ if (e.persisted) draw(); });
   })();
   </script>
   ```

- [ ] **Step 4: Edit `web/lobby/grade-2.html`**

The same six edits, with `data-grade="grade2"` in edit 1:

```html
<script src="../engine/world.js" data-grade="grade2"></script>
```

- [ ] **Step 5: Run the wiring test and all unit tests**

Run: `node --test tests/world-wiring.test.js`
Expected: PASS.

Run: `node --test`
Expected: all pass (`tests/pages.test.js` still sees `storage.js` then `learner.js` first; `tests/boss-wiring.test.js` is unaffected).

- [ ] **Step 6: Hand the user the commit commands**

```bash
git add tests/world-wiring.test.js web/lobby/grade-5.html web/lobby/grade-2.html
```

```bash
git commit -m "Open both lobbies on the map: Grade 5 Campus and Grade 2 Bayan with a Campus or List button in the header, the shop telling the map when a reward is affordable, and the missing-file bar naming world.js; tests keep a map spot for every game card and check that script paths match real file names exactly for GitHub Pages"
```

---

### Task 6: End-to-end checks in headless Chrome

**Files:**
- Modify: `tests/e2e/lobby-driver.page.js`
- Modify: `tests/e2e/lobby-e2e.js`
- Modify: `tests/e2e/file-check-e2e.js`

- [ ] **Step 1: Add the `campus` driver mode**

In `tests/e2e/lobby-driver.page.js`, insert right before the line `  if (mode === 'nojs') {`:

```js
  if (mode === 'campus') {
    var wcards = document.querySelectorAll('.subject-card[data-app]');
    var first = wcards[0].getAttribute('data-app'), second = wcards[1].getAttribute('data-app');
    var campus = $('campus'), grid = document.querySelector('.grid'), toggle = $('campus-toggle');
    var place = function (id) { return campus.querySelector('[data-place="' + id + '"]'); };
    var marks = function (id) { return Array.prototype.map.call(place(id).querySelectorAll('.w-marker text'), function (t) { return t.textContent; }); };
    var tap = function (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
    var world = function () { return JSON.parse(__store.getItem('world_v1') || 'null'); };
    var remount = function () { World.mount(campus, grid, toggle); };
    var buddyAt = function () { return campus.querySelector('.w-avatar').getAttribute('transform'); };
    r.firstApp = first;
    r.campusShown = !campus.hidden;
    r.gridHidden = grid.hidden;
    r.toggleShown = !toggle.hidden;
    r.toggleText = toggle.textContent;
    r.buildings = campus.querySelectorAll('.w-game').length;
    r.cards = wcards.length;
    r.pickerOpen = !campus.querySelector('.w-picker').hidden;
    campus.querySelector('[data-pick="owl"]').click();
    r.avatar = world().avatar;
    r.buddy = campus.querySelector('.w-avatar text').textContent;
    r.pickerAfter = !campus.querySelector('.w-picker').hidden;
    var wday = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var witems = {};
    for (var wi = 0; wi < 3; wi++) witems[first + '|w' + wi] = { box: 1, due: wday(new Date()), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: witems }));
    __store.setItem('quests_v1', JSON.stringify({ v: 1, day: wday(new Date()), at: 1, list: [{ kind: 'explore', app: second, title: 'Second', done: false }], days: [], paidDay: '', streakPaid: [] }));
    __store.setItem('boss_v1', JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), stages: [{ app: second, title: 'Second', cleared: false }, { app: first, title: 'First', cleared: true }], paid: [] }));
    remount();
    r.firstMarks = marks(first);
    r.secondMarks = marks(second);
    r.arenaSub = campus.querySelector('.w-arena .w-sub').textContent;
    r.firstLabel = place(first).getAttribute('aria-label');
    var went = null;
    World.walkMs = 0;
    World.navigate = function (href) { went = href; };
    r.atGate = buddyAt();
    tap(place(first));
    r.went = went;
    r.cardHref = wcards[0].getAttribute('href');
    r.savedAt = world().at;
    r.afterWalk = buddyAt();
    remount();
    r.afterReturn = buddyAt();
    tap(place('shop'));
    r.shopOpen = !$('shop-overlay').hidden;
    $('shop-close').click();
    tap(toggle);
    r.listGridShown = !grid.hidden;
    r.listCampusHidden = campus.hidden;
    r.listToggle = toggle.textContent;
    r.savedView = world().view;
    remount();
    r.listAfterReload = !grid.hidden && campus.hidden;
    return out(r);
  }
```

In the existing `if (mode === 'nojs') {` block, add right after its first line:

```js
    r.gridShownNoWorld = !document.querySelector('.grid').hidden;
    r.campusHiddenNoWorld = $('campus').hidden;
    r.toggleHiddenNoWorld = $('campus-toggle').hidden;
```

- [ ] **Step 2: Add the assertions**

In `tests/e2e/lobby-e2e.js`, add `campusLabel: '🗺️ Bayan',` to `CONFIGS[2]` and `campusLabel: '🗺️ Campus',` to `CONFIGS[5]` (after `subjectOptions`).

Insert right before `  const n = readOutput(dumpDom(path.join(work, 'profile-nojs'), noJsLobby, '#e2e=nojs'));`:

```js
  const cp = readOutput(dumpDom(path.join(work, 'profile-campus'), withJsLobby, '#e2e=campus'));
  assert.deepEqual(cp.errors, [], 'campus: page errors');
  assert.equal(cp.campusShown, true, 'the lobby opens on the map');
  assert.equal(cp.gridHidden, true, 'the cards wait behind the List button');
  assert.equal(cp.toggleShown, true);
  assert.equal(cp.toggleText, '📋 List');
  assert.equal(cp.buildings, cp.cards, 'one building per card');
  assert.equal(cp.pickerOpen, true, 'a new player picks a buddy first');
  assert.equal(cp.avatar, 'owl');
  assert.equal(cp.buddy, '🦉');
  assert.equal(cp.pickerAfter, false, 'picking closes the picker');
  assert.deepEqual(cp.firstMarks, ['🔁3'], 'due review shows its count');
  assert.deepEqual(cp.secondMarks, ['⚔️', '❗'], 'the boss stage first, then the quest');
  assert.equal(cp.arenaSub, '1 / 2', 'the arena counts stages cleared');
  assert.match(cp.firstLabel, /, 3 review questions due$/);
  assert.equal(cp.went, cp.cardHref, 'tapping a building opens its game');
  assert.equal(cp.savedAt, cp.firstApp);
  assert.notEqual(cp.afterWalk, cp.atGate, 'the buddy walked to the building');
  assert.equal(cp.afterReturn, cp.afterWalk, 'coming back, the buddy waits at that building');
  assert.equal(cp.shopOpen, true, 'the shop building opens the shop');
  assert.equal(cp.listGridShown, true, 'List shows the cards');
  assert.equal(cp.listCampusHidden, true);
  assert.equal(cp.listToggle, cfg.campusLabel);
  assert.equal(cp.savedView, 'list');
  assert.equal(cp.listAfterReload, true, 'the lobby opens in List next time');
```

After the existing `assert.equal(n.coinRowHidden, true, ...)` line, add:

```js
  assert.equal(n.gridShownNoWorld, true, 'no world.js: the cards show as before');
  assert.equal(n.campusHiddenNoWorld, true);
  assert.equal(n.toggleHiddenNoWorld, true);
```

- [ ] **Step 3: Add the file-check case**

In `tests/e2e/file-check-e2e.js`, add to `cases` after the `wallet.js` lobby case:

```js
  [LOBBIES[2].page, lobbyFile(2), ['world.js'], missing('world.js')],
```

- [ ] **Step 4: Run the e2e tests**

Run: `node tests/e2e/lobby-e2e.js`
Expected: `Lobby passed`

Run: `node tests/e2e/lobby-e2e.js 5`
Expected: `Lobby passed`

Run: `node tests/e2e/file-check-e2e.js`
Expected: `File check passed`

If `secondMarks` is `['⚔️']` only: the seeded quest was replaced because `Quests.pick` ran again. The driver must not dispatch `cloud-synced` in this mode; check that it calls `remount()` directly. If `firstMarks` is `[]`: check that `Recall.dueByApp()` reads `review_v1` from the learner's storage (`__store`), not `localStorage`.

- [ ] **Step 5: Run the rest of the e2e suite that touches lobbies**

Run: `node tests/e2e/backup-e2e.js` and `node tests/e2e/backup-e2e.js 5` and `node tests/e2e/migration-e2e.js`
Expected: each prints its `passed` line. (The picker opens on a fresh profile; these tests use `.click()` on elements, which still works under it.)

- [ ] **Step 6: Hand the user the commit commands**

```bash
git add tests/e2e/lobby-driver.page.js tests/e2e/lobby-e2e.js tests/e2e/file-check-e2e.js
```

```bash
git commit -m "Test the campus map in headless Chrome: the lobby opens on the map with one building per card, a new player picks a buddy, due review, quest and boss markers show, tapping a building opens its game and the buddy waits there after, the shop building opens the shop, List is remembered, and without world.js the cards show as before"
```

---

### Task 7: README and final check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the feature bullet**

In `README.md`, after the `- **Date guard:** ...` bullet in "How a game works", add:

```markdown
- **Campus map:** the lobby opens on a map (Grade 5 Campus, Grade 2 Bayan). Every game is a building that gets a flag, a banner and a gold roof as all its lessons reach Bronze, Silver and Gold. ⚔️, ❗ and 🔁 show a boss stage, an open quest and due review; the shop sparkles when a reward is affordable, and the Boss Arena counts stages cleared. Her buddy (picked once, free) walks to the building she taps. 📋 List shows the cards, and the lobby remembers the choice.
```

In the engine file list, after the `boss.js` line, add:

```
    world.js                   the lobby's campus map: buildings, markers, the buddy, Campus or List
```

- [ ] **Step 2: Run everything**

Run: `node --test`
Expected: all pass.

Run: `node tests/e2e/lobby-e2e.js` and `node tests/e2e/lobby-e2e.js 5`
Expected: `Lobby passed` twice.

- [ ] **Step 3: Look at it**

Open `web/lobby/grade-5.html` and `web/lobby/grade-2.html` in Chrome (desktop, then DevTools device mode at 360 px and 800 px wide, light and dark). Check: the whole map fits the width with no sideways scroll, names are readable on the 800 px view, the buddy walks along the road, List and Campus switch, and the shop and arena taps work. Report anything that looks wrong rather than guessing a fix.

- [ ] **Step 4: Hand the user the commit commands**

```bash
git add README.md
```

```bash
git commit -m "Describe the campus map in the README"
```

Deploy reminder for the user: push, then open each tablet's lobby once while online so the new `world.js` is cached.
