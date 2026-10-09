# Mastery Map (lesson medals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lesson in all 15 games earns 🥉/🥈/🥇 from its review boxes. Medals are kept, marked 🔧 when they slip, pay 20/40/80 points once, and show on lesson cards, a lobby map panel and the parent phone page.

**Architecture:** A new engine file `web/engine/mastery.js` reads `review_v1` (built by spaced review), works out each lesson's level from its weakest question, and keeps `mastery_v1` per learner: `{ v:1, apps: { <app>: { t, order, lessons: { <id>: { title, icon, now, best, paid } } } } }`. Each game builds its lesson list (`medalLessons`), calls `Mastery.update` on open and after every round, pays new medals with `kit.award`, and draws badges. Lobbies and the parent page read `mastery_v1` only. Cloud sync merges it per app (newer write) with `best`/`paid` taking the max.

**Tech Stack:** Plain ES5 browser JS (engine files), ES6 inside game pages as they already are, `node --test`, headless Chrome e2e (`tests/e2e/*.js`).

**Spec:** `docs/superpowers/specs/2026-10-02-mastery-map-design.md`

**House rules for every task:**
- Never run `git commit`. Each task ends by staging its files with `git add`; the user commits.
- Run unit tests from the repo root with `node --test` (never `node --test tests/`).
- Comments only where the code is not obvious.
- `web/engine/sync-core.js` must stay ASCII-only.
- Grade 2 text pairs Filipino with English; buttons are English only.

---

## File map

| File | Change |
|---|---|
| `web/engine/mastery.js` | **New.** Levels, pay, `mastery_v1`, text, badge/chip/new-line/map drawing |
| `web/engine/study-kit.js` | `kit.award(pts)` |
| `web/engine/sync-core.js` | `mastery` kind + merge rule |
| `web/engine/study-history.js` | backups carry `mastery_v1` |
| `web/engine/parent-panel.js` | `savedState` includes `mastery_v1` |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | load `mastery.js`, map button + panel |
| `web/parent/index.html`, `web/parent/phone.js` | Medals section |
| 15 game pages under `web/subjects/` | `medalLessons`, `updateMedals`, `showMedals`, `medalBadge`, calls |
| `web/sw.js` | PRECACHE gains `engine/mastery.js` (via the tool) |
| `tests/paths.js` | `ENGINE_FILES` gains `mastery.js` |
| `tests/mastery.test.js` | **New.** Engine rules |
| `tests/mastery-wiring.test.js` | **New.** Static wiring of games and lobbies |
| `tests/study-kit.test.js`, `tests/sync.test.js`, `tests/study-history.test.js`, `tests/browser-globals.test.js`, `tests/english-everywhere.test.js`, `tests/copies.test.js` | new cases |
| `tests/e2e/driver-common.page.js`, `driver-family-{a,b,c}.page.js`, `driver-math.page.js`, `apps-e2e.js`, `lobby-driver.page.js`, `lobby-e2e.js` | medal and map e2e |
| `README.md` | engine list, features, new-subject checklist |

---

### Task 1: mastery.js engine — levels, pay, saved summary, text

**Files:**
- Create: `web/engine/mastery.js`
- Modify: `tests/paths.js:8`
- Test: `tests/mastery.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/mastery.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, read, counts, polishList, levelOf, MEDALS, MIN_BOX, PAY, TEXT } = require(engineFile('mastery.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const boxes = (map) => JSON.stringify({ v: 1, items: Object.fromEntries(Object.entries(map).map(([k, box]) => [k, { box, due: '2026-10-09', t: 1 }])) });
const saved = (s) => JSON.parse(s.data.mastery_v1);
const lesson = (id, keys) => ({ id, title: 'Lesson ' + id, icon: '🌱', keys });
const now = () => 1000;

test('the medal ladder', () => {
  assert.deepEqual(MEDALS, ['', '🥉', '🥈', '🥇']);
  assert.deepEqual(MIN_BOX, [0, 2, 3, 4]);
  assert.deepEqual(PAY, [0, 20, 40, 80]);
});

test('a lesson is as strong as its weakest question; unanswered and gone count as box 0', () => {
  assert.equal(levelOf({ a: { box: 5 }, b: { box: 4 } }, ['a', 'b']), 3);
  assert.equal(levelOf({ a: { box: 5 }, b: { box: 3 } }, ['a', 'b']), 2);
  assert.equal(levelOf({ a: { box: 2 }, b: { box: 5 } }, ['a', 'b']), 1);
  assert.equal(levelOf({ a: { box: 1 }, b: { box: 5 } }, ['a', 'b']), 0);
  assert.equal(levelOf({ a: { box: 5 } }, ['a', 'b']), 0, 'b never answered');
  assert.equal(levelOf({ a: { box: 5 }, b: { box: 5, gone: true } }, ['a', 'b']), 0, 'a tombstone is not an answer');
  assert.equal(levelOf({ a: { box: 9 } }, ['a']), 0, 'junk boxes count as nothing');
});

test('the first time a game reports, medals she already has show but pay nothing', () => {
  const s = memory({ review_v1: boxes({ a: 3, b: 3, c: 1 }) });
  const r = create(s, now, 'grade5').update('life-lab', [lesson('l1', ['a', 'b']), lesson('l2', ['c'])]);
  assert.equal(r.points, 0);
  assert.deepEqual(r.newly, []);
  assert.deepEqual(r.lessons, { l1: { now: 2, best: 2, polish: false }, l2: { now: 0, best: 0, polish: false } });
  assert.deepEqual(r.counts, { gold: 0, silver: 1, bronze: 0, total: 2 });
  assert.deepEqual(saved(s).apps['life-lab'], { t: 1000, order: ['l1', 'l2'], lessons: {
    l1: { title: 'Lesson l1', icon: '🌱', now: 2, best: 2, paid: 2 },
    l2: { title: 'Lesson l2', icon: '🌱', now: 0, best: 0, paid: 0 },
  } });
});

test('a new medal pays once, the tiers between add up, and earning it back pays nothing', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) });
  const m = create(s, now, 'grade5'), lessons = [lesson('l1', ['a'])];
  m.update('life-lab', lessons);
  s.data.review_v1 = boxes({ a: 3 });
  const up = m.update('life-lab', lessons);
  assert.equal(up.points, 60, 'nothing to Silver pays Bronze 20 + Silver 40');
  assert.deepEqual(up.newly, [{ id: 'l1', title: 'Lesson l1', level: 2, points: 60 }]);
  assert.equal(m.update('life-lab', lessons).points, 0, 'paid once');
  s.data.review_v1 = boxes({ a: 1 });
  const slip = m.update('life-lab', lessons);
  assert.deepEqual(slip.lessons.l1, { now: 0, best: 2, polish: true }, 'the medal stays, with a polish mark');
  assert.equal(slip.points, 0);
  assert.deepEqual(polishList(saved(s).apps['life-lab']), ['Lesson l1']);
  s.data.review_v1 = boxes({ a: 3 });
  assert.equal(m.update('life-lab', lessons).points, 0, 'earning it back pays nothing');
  s.data.review_v1 = boxes({ a: 4 });
  const gold = m.update('life-lab', lessons);
  assert.equal(gold.points, 80);
  assert.deepEqual(gold.counts, { gold: 1, silver: 0, bronze: 0, total: 1 });
});

test('a lesson added later starts paid; lessons with no questions are left out; each app keeps its own entry', () => {
  const s = memory({ review_v1: boxes({ a: 1, b: 2 }) });
  const m = create(s, now, 'grade5');
  m.update('life-lab', [lesson('l1', ['a'])]);
  const r = m.update('life-lab', [lesson('l1', ['a']), lesson('l2', ['b']), lesson('gen', [])]);
  assert.equal(r.points, 0, 'l2 already had Bronze when it appeared');
  assert.deepEqual(saved(s).apps['life-lab'].order, ['l1', 'l2']);
  m.update('word-train', [lesson('w1', ['b'])]);
  assert.deepEqual(Object.keys(saved(s).apps).sort(), ['life-lab', 'word-train']);
  assert.deepEqual(read(s).apps['life-lab'].order, ['l1', 'l2'], 'the other app is untouched');
});

test('a Math skill is a lesson with one key', () => {
  const key = 'math-mastery|skill:frac';
  const s = memory({ review_v1: boxes({ [key]: 1 }) });
  const m = create(s, now, 'grade5'), lessons = [{ id: 'frac', title: 'Fractions', icon: '🍕', keys: [key] }];
  m.update('math-mastery', lessons);
  s.data.review_v1 = boxes({ [key]: 2 });
  assert.equal(m.update('math-mastery', lessons).points, 20);
});

test('junk saved data reads as no medals', () => {
  assert.deepEqual(read(memory({ mastery_v1: '{nope' })), { v: 1, apps: {} });
  assert.deepEqual(read(memory({ mastery_v1: JSON.stringify({ v: 2, apps: {} }) })), { v: 1, apps: {} });
  assert.deepEqual(counts(undefined), { gold: 0, silver: 0, bronze: 0, total: 0 });
  assert.deepEqual(polishList(null), []);
  const s = memory({ review_v1: '{nope', mastery_v1: JSON.stringify({ v: 1, apps: { 'life-lab': { t: 1, lessons: { l1: 'x' } } } }) });
  const r = create(s, now, 'grade5').update('life-lab', [lesson('l1', ['a'])]);
  assert.deepEqual(r.lessons.l1, { now: 0, best: 0, polish: false });
});

test('create needs a known grade', () => {
  assert.throws(() => create(memory(), now, 'grade9'), /grade/);
});

test('grade 5 and grade 2 medal text', () => {
  const c = { gold: 2, silver: 3, bronze: 5, total: 18 };
  assert.equal(TEXT.grade5.chip(c), '🥇 2 · 🥈 3 · 🥉 5 of 18 lessons');
  assert.equal(TEXT.grade5.newLine({ level: 2, title: 'Plants', points: 40 }), '🏅 New Silver: Plants! +40 points');
  assert.equal(TEXT.grade5.name(3), 'Gold');
  assert.equal(TEXT.grade2.chip(c), '🥇 2 · 🥈 3 · 🥉 5 sa 18 aralin · of 18 lessons');
  assert.equal(TEXT.grade2.newLine({ level: 1, title: 'Halaman', points: 20 }), '🏅 Bagong Tanso · New Bronze: Halaman! +20 points');
  assert.equal(TEXT.grade2.name(3), 'Ginto · Gold');
  assert.equal(TEXT.grade2.mapButton, TEXT.grade5.mapButton, 'buttons stay English');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/mastery.test.js`
Expected: FAIL with `Cannot find module '...web/engine/mastery.js'`.

- [ ] **Step 3: Create `web/engine/mastery.js`**

```js
/* Loaded by every game and both lobbies after recall.js, and by the parent page. The pages are decoded as UTF-8, so the text can hold emoji.
   A lesson's medal comes from its weakest question's review box: Bronze at box 2, Silver at 3, Gold at 4.
   The best medal is kept in mastery_v1, shown with a polish mark when the lesson slips, and paid once. */
(function (root) {
  'use strict';

  var KEY = 'mastery_v1';
  var MEDALS = ['', '🥉', '🥈', '🥇'];
  var MIN_BOX = [0, 2, 3, 4];
  var PAY = [0, 20, 40, 80];
  var NAMES = { en: ['', 'Bronze', 'Silver', 'Gold'], fil: ['', 'Tanso', 'Pilak', 'Ginto'] };

  function tally(c) { return '🥇 ' + c.gold + ' · 🥈 ' + c.silver + ' · 🥉 ' + c.bronze; }

  var TEXT = {
    grade5: {
      name: function (l) { return NAMES.en[l]; },
      newLine: function (m) { return '🏅 New ' + NAMES.en[m.level] + ': ' + m.title + '! +' + m.points + ' points'; },
      chip: function (c) { return tally(c) + ' of ' + c.total + ' lessons'; },
      polish: 'needs a polish',
      mapButton: '🗺️ My Map',
      mapTitle: '🗺️ My Medal Map',
      mapHint: 'Get every question in a lesson right: 🥉 on 1 day · 🥈 on 2 days · 🥇 on 3 days',
      openOnce: 'Open this game once to see its medals'
    },
    grade2: {
      name: function (l) { return NAMES.fil[l] + ' · ' + NAMES.en[l]; },
      newLine: function (m) { return '🏅 Bagong ' + NAMES.fil[m.level] + ' · New ' + NAMES.en[m.level] + ': ' + m.title + '! +' + m.points + ' points'; },
      chip: function (c) { return tally(c) + ' sa ' + c.total + ' aralin · of ' + c.total + ' lessons'; },
      polish: 'kailangang balikan · needs a polish',
      mapButton: '🗺️ My Map',
      mapTitle: '🗺️ Mapa ng Galing · Map of My Medals',
      mapHint: 'Sagutin nang tama ang lahat: 🥉 1 araw · 🥈 2 araw · 🥇 3 araw · Get all of the questions right: 🥉 1 day · 🥈 2 days · 🥇 3 days',
      openOnce: 'Buksan muna ang laro · Open this game once to see its medals'
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function level(v) { var n = Math.floor(Number(v)); return n >= 1 && n <= 3 ? n : 0; }
  function readJson(storage, key) { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } }

  function read(storage) {
    var d = readJson(storage, KEY);
    return isObj(d) && d.v === 1 && isObj(d.apps) ? d : { v: 1, apps: {} };
  }

  function boxOf(items, key) {
    var it = items[key];
    return isObj(it) && !it.gone && it.box >= 1 && it.box <= 5 ? Math.floor(it.box) : 0;
  }

  function levelOf(items, keys) {
    var min = Math.min.apply(null, keys.map(function (k) { return boxOf(items, k); }));
    for (var l = 3; l > 0; l--) if (min >= MIN_BOX[l]) return l;
    return 0;
  }

  function lessonsOf(entry) {
    if (!isObj(entry) || !isObj(entry.lessons)) return [];
    var order = Array.isArray(entry.order) ? entry.order : Object.keys(entry.lessons);
    return order.filter(function (id) { return isObj(entry.lessons[id]); }).map(function (id) { return entry.lessons[id]; });
  }

  function counts(entry) {
    var c = { gold: 0, silver: 0, bronze: 0, total: 0 };
    lessonsOf(entry).forEach(function (l) {
      var b = level(l.best);
      c.total++;
      if (b === 3) c.gold++;
      else if (b === 2) c.silver++;
      else if (b === 1) c.bronze++;
    });
    return c;
  }

  function polishList(entry) {
    return lessonsOf(entry).filter(function (l) { return level(l.now) < level(l.best); }).map(function (l) { return String(l.title); });
  }

  function create(storage, now, grade) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Mastery needs a grade like "grade5".');
    return {
      text: TEXT[grade],

      summary: function () { return read(storage); },

      // lessons: [{ id, title, icon, keys }], keys being the lesson's review_v1 keys. A lesson with no keys has no medal.
      update: function (app, lessons) {
        var boxes = readJson(storage, 'review_v1'), items = isObj(boxes) && isObj(boxes.items) ? boxes.items : {};
        var state = read(storage), old = isObj(state.apps[app]) && isObj(state.apps[app].lessons) ? state.apps[app].lessons : {};
        var entry = { t: now(), order: [], lessons: {} }, result = { lessons: {}, newly: [], points: 0 };
        lessons.forEach(function (l) {
          if (!l.keys || !l.keys.length || entry.lessons[l.id]) return;
          var was = isObj(old[l.id]) ? old[l.id] : null, lv = levelOf(items, l.keys);
          var best = Math.max(lv, was ? level(was.best) : 0);
          // A lesson seen for the first time starts as paid, so medals earned before it was tracked pay nothing.
          var paid = was ? level(was.paid) : best, pts = 0;
          for (var x = paid + 1; x <= best; x++) pts += PAY[x];
          if (pts) {
            result.newly.push({ id: l.id, title: l.title, level: best, points: pts });
            result.points += pts;
          }
          entry.order.push(l.id);
          entry.lessons[l.id] = { title: String(l.title), icon: l.icon || '', now: lv, best: best, paid: Math.max(paid, best) };
          result.lessons[l.id] = { now: lv, best: best, polish: lv < best };
        });
        state.apps[app] = entry;
        try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
        result.counts = counts(entry);
        return result;
      }
    };
  }

  var exported = { create: create, read: read, counts: counts, polishList: polishList, levelOf: levelOf,
    MEDALS: MEDALS, MIN_BOX: MIN_BOX, PAY: PAY, TEXT: TEXT, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Mastery = exported;
})(this);
```

- [ ] **Step 4: Add the file to the engine list** — in `tests/paths.js:8`, insert `'mastery.js'` right after `'recall.js'`:

```js
const ENGINE_FILES = ['storage.js', 'learner.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'parent-panel.js'];
```

- [ ] **Step 5: Add the Grade 2 English check** — append to `tests/english-everywhere.test.js`:

```js
test('every Grade 2 medal line has English', () => {
  const { TEXT } = require(engineFile('mastery.js'));
  const c = { gold: 1, silver: 2, bronze: 3, total: 9 };
  for (const [key, value] of Object.entries(TEXT.grade2)) {
    const v = key === 'newLine' ? value({ level: 2, title: 'Halaman', points: 40 }) : key === 'chip' ? value(c) : key === 'name' ? value(2) : value;
    hasEnglishWhereFilipino(v, 'medal ' + key);
  }
});
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/mastery.test.js tests/english-everywhere.test.js`
Expected: all pass. (`node --test` as a whole will fail `tests/pwa.test.js` until Task 12 adds `engine/mastery.js` to PRECACHE; that is expected.)

- [ ] **Step 7: Stage**

```bash
git add web/engine/mastery.js tests/mastery.test.js tests/paths.js tests/english-everywhere.test.js
```

---

### Task 2: study-kit pays milestone points with `kit.award`

**Files:**
- Modify: `web/engine/study-kit.js` (the object returned by `start`, next to `renderLive`)
- Test: `tests/study-kit.test.js`

- [ ] **Step 1: Write the failing test** — append to `tests/study-kit.test.js`:

```js
test('award adds milestone points to the total but not to the round', () => {
  const { kit, root, log } = page();
  kit.startRound();
  kit.answer(true, {});
  kit.award(40);
  kit.award(0);
  assert.equal(kit.sessionPoints(), 10);
  assert.equal(kit.totalPoints(), 50);
  assert.equal(root.localStorage.data.riseshine_points_v1, '50');
  assert.equal(log.filter((l) => l[0] === 'renderCoins').length, 2, 'coins redrawn after the answer and the award only');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/study-kit.test.js`
Expected: FAIL with `kit.award is not a function`.

- [ ] **Step 3: Implement** — in `web/engine/study-kit.js`, replace

```js
      renderLive: renderLive,
```

with

```js
      // Milestone points (a new medal): they count toward coins but not toward this round's line.
      award: function (pts) {
        if (!(pts > 0)) return;
        total += pts;
        set(opts.pointsKey, String(total));
        if (win.Wallet && win.Wallet.renderCoins) win.Wallet.renderCoins();
      },
      renderLive: renderLive,
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/study-kit.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/study-kit.js tests/study-kit.test.js
```

---

### Task 3: Cloud sync merges medals; backups carry them

**Files:**
- Modify: `web/engine/sync-core.js:31-43` (kindOf), `:56` (MERGE), `:145` and `:160` (readLocal/writeLocal)
- Modify: `web/engine/study-history.js:323`
- Modify: `web/engine/parent-panel.js:329`
- Test: `tests/sync.test.js`, `tests/study-history.test.js`

- [ ] **Step 1: Write the failing sync tests** — append to `tests/sync.test.js`:

```js
test('medals: per app the newer write wins, best and paid never go down, in either order', () => {
  const a = { v: 1, apps: { 'life-lab': { t: 200, order: ['l1', 'l2'], lessons: {
    l1: { title: 'Plants', icon: '🌱', now: 1, best: 2, paid: 1 },
    l2: { title: 'Rocks', icon: '', now: 0, best: 0, paid: 0 } } } } };
  const b = { v: 1, apps: {
    'life-lab': { t: 100, order: ['l1'], lessons: { l1: { title: 'Old', icon: '🌱', now: 3, best: 3, paid: 3 } } },
    'word-train': { t: 5, order: [], lessons: {} } } };
  const want = { v: 1, apps: {
    'life-lab': { t: 200, order: ['l1', 'l2'], lessons: {
      l1: { title: 'Plants', icon: '🌱', now: 1, best: 3, paid: 3 },
      l2: { title: 'Rocks', icon: '', now: 0, best: 0, paid: 0 } } },
    'word-train': { t: 5, order: [], lessons: {} } } };
  assert.deepEqual(MERGE.mastery(a, b), want);
  assert.deepEqual(MERGE.mastery(b, a), want);
  assert.deepEqual(MERGE.mastery(MERGE.mastery(a, b), b), want, 'safe to repeat');
  assert.deepEqual(MERGE.mastery(null, b), MERGE.mastery(b, null));
  assert.equal(kindOf('mastery_v1'), 'mastery');
});

test('medals: at the same time either order agrees; junk apps are dropped', () => {
  const x = { v: 1, apps: { a: { t: 5, order: ['l'], lessons: { l: { title: 'X', icon: '', now: 2, best: 2, paid: 2 } } } } };
  const y = { v: 1, apps: { a: { t: 5, order: ['l'], lessons: { l: { title: 'Y', icon: '', now: 1, best: 3, paid: 1 } } } } };
  assert.deepEqual(MERGE.mastery(x, y), MERGE.mastery(y, x));
  assert.deepEqual(MERGE.mastery(MERGE.mastery(x, y), y), MERGE.mastery(x, y), 'safe to repeat');
  assert.deepEqual(MERGE.mastery({ v: 1, apps: { p: 'nope', q: { t: 'z', lessons: {} }, r: { t: 1 } } }, null), { v: 1, apps: {} });
});

test('medals travel to a second device and merge back', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  const m = (best, t) => JSON.stringify({ v: 1, apps: { 'life-lab': { t, order: ['l1'], lessons: { l1: { title: 'Plants', icon: '', now: best, best, paid: best } } } } });
  a.s.setItem('mastery_v1', m(2, 10));
  await a.sync();
  await b.sync();
  assert.equal(JSON.parse(b.s.getItem('mastery_v1')).apps['life-lab'].lessons.l1.best, 2);
  b.s.setItem('mastery_v1', m(1, 20));
  await b.sync();
  await a.sync();
  const l1 = JSON.parse(a.s.getItem('mastery_v1')).apps['life-lab'].lessons.l1;
  assert.deepEqual({ now: l1.now, best: l1.best, paid: l1.paid }, { now: 1, best: 2, paid: 2 });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test tests/sync.test.js`
Expected: FAIL with `MERGE.mastery is not a function`.

- [ ] **Step 3: Implement in `web/engine/sync-core.js`** (ASCII only)

In `kindOf`, after `if (key === 'review_v1') return 'review';` add:

```js
    if (key === 'mastery_v1') return 'mastery';
```

After the `reviewNewer` function (before `var MERGE = {`) add:

```js
  // What a medal entry shows apart from best and paid; it breaks a tie between two writes at the same time.
  function masteryView(e) {
    return JSON.stringify([e.order, Object.keys(e.lessons).map(function (k) { var l = e.lessons[k] || {}; return [k, l.title, l.icon, l.now]; })]);
  }
  function masteryApp(newer, older) {
    var lessons = {};
    Object.keys(newer.lessons).forEach(function (k) {
      var l = newer.lessons[k], o = older && isObj(older.lessons[k]) ? older.lessons[k] : {};
      if (!isObj(l)) return;
      lessons[k] = { title: l.title, icon: l.icon, now: l.now,
        best: Math.max(Number(l.best) || 0, Number(o.best) || 0), paid: Math.max(Number(l.paid) || 0, Number(o.paid) || 0) };
    });
    return { t: newer.t, order: newer.order, lessons: lessons };
  }
```

Inside `var MERGE = {`, before `recall: function (a, b) {`, add:

```js
    // Medals: per app the newer write gives the lessons, titles and current levels; best and paid only go up.
    mastery: function (a, b) {
      var apps = {};
      [a, b].forEach(function (x) {
        if (!x || !isObj(x.apps)) return;
        Object.keys(x.apps).forEach(function (id) {
          var e = x.apps[id], have = apps[id];
          if (!isObj(e) || !isObj(e.lessons) || typeof e.t !== 'number' || !isFinite(e.t)) return;
          if (!have) { apps[id] = masteryApp(e, null); return; }
          var eNewer = e.t !== have.t ? e.t > have.t : masteryView(e) > masteryView(have);
          apps[id] = eNewer ? masteryApp(e, have) : masteryApp(have, e);
        });
      });
      return { v: 1, apps: apps };
    },
```

In `readLocal`, change

```js
      if (kind === 'recall' || kind === 'review' || kind === 'profile' || kind === 'requests') return json(space.getItem(key), null);
```

to

```js
      if (kind === 'recall' || kind === 'review' || kind === 'mastery' || kind === 'profile' || kind === 'requests') return json(space.getItem(key), null);
```

In `writeLocal`, change

```js
      } else if (kind === 'recall' || kind === 'review' || kind === 'profile' || kind === 'requests') {
```

to

```js
      } else if (kind === 'recall' || kind === 'review' || kind === 'mastery' || kind === 'profile' || kind === 'requests') {
```

- [ ] **Step 4: Run the sync tests**

Run: `node --test tests/sync.test.js`
Expected: PASS.

- [ ] **Step 5: Backups carry medals — update the backup test first.** In `tests/study-history.test.js`, test `'a full backup carries points, wallet, rest-days and her name, for its own grade only'`: add `mastery_v1: '{"v":1,"apps":{}}',` after `review_v1: '{"v":1,"items":{}}',` in the `state` input, and add `mastery_v1: '{"v":1,"apps":{}}'` to the expected `state` object, so it reads:

```js
    state: { lifelab_points_v1: '420', wallet_v1: '{"v":1,"spent":40}', recall_v1: '{"v":1,"rest":{}}', review_v1: '{"v":1,"items":{}}', mastery_v1: '{"v":1,"apps":{}}' },
```

Run: `node --test tests/study-history.test.js`
Expected: FAIL (mastery_v1 is dropped from the backup).

- [ ] **Step 6: Implement** — `web/engine/study-history.js:323`:

```js
    var STATE_KEY_RE = /^(?:[a-z0-9]+_points_v1|wallet_v1|recall_v1|review_v1|mastery_v1)$/;
```

`web/engine/parent-panel.js:329`:

```js
        var keys = ['wallet_v1', 'recall_v1', 'review_v1', 'mastery_v1'];
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/study-history.test.js tests/sync.test.js`
Expected: PASS.

- [ ] **Step 8: Stage**

```bash
git add web/engine/sync-core.js web/engine/study-history.js web/engine/parent-panel.js tests/sync.test.js tests/study-history.test.js
```

---

### Task 4: mastery.js draws medals in the browser

Adds the page helpers: `badge` (lesson-card HTML), `renderChip` (header chip under `#points-total-badge`), `showNew` (new-medal lines under an element), `renderMap` (lobby panel), their CSS, and the browser bootstrap. A page with no `data-grade` (the parent page) gets only the pure helpers.

**Files:**
- Modify: `web/engine/mastery.js` (end of file)
- Test: `tests/browser-globals.test.js`

- [ ] **Step 1: Write the failing test** — append to `tests/browser-globals.test.js`:

```js
test('the parent page can read medals from a child\'s in-memory space', () => {
  const win = browser('storage.js', 'mastery.js');
  const s = win.StudyStore.memorySpace('kid');
  s.put('mastery_v1', JSON.stringify({ v: 1, apps: { 'life-lab': { t: 1, order: ['a', 'b'], lessons: {
    a: { title: 'Plants', now: 3, best: 3, paid: 3 }, b: { title: 'Rocks', now: 1, best: 2, paid: 2 } } } } }));
  const e = win.Mastery.read(s).apps['life-lab'];
  assert.deepEqual({ ...win.Mastery.counts(e) }, { gold: 1, silver: 1, bronze: 0, total: 2 });
  assert.deepEqual([...win.Mastery.polishList(e)], ['Rocks']);
  assert.equal(win.Mastery.update, undefined, 'no grade: no game helpers');
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/browser-globals.test.js`
Expected: PASS already for `read`/`counts`/`polishList` (Task 1 exported them to `root.Mastery`). Keep the test; it guards the bootstrap rewrite below.

- [ ] **Step 3: Add the UI** — in `web/engine/mastery.js`, replace the tail

```js
  var exported = { create: create, read: read, counts: counts, polishList: polishList, levelOf: levelOf,
    MEDALS: MEDALS, MIN_BOX: MIN_BOX, PAY: PAY, TEXT: TEXT, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Mastery = exported;
})(this);
```

with

```js
  var UI_CSS =
    '.medal{display:inline-block;margin-left:6px;font-size:1.1em;line-height:1;vertical-align:middle;}' +
    '.medal-chip{margin:6px 0 0;font-weight:800;font-size:.95rem;}' +
    '.medal-new{margin:8px 0;padding:8px 12px;border-radius:12px;background:#FFF4D6;color:#5A3E00;font-weight:800;}' +
    '.map-open{display:block;margin:0 0 12px;padding:10px 18px;border:2px solid #9BB4E0;border-radius:999px;background:#fff;color:#23395B;font:inherit;font-weight:800;cursor:pointer;}' +
    '.map-open[hidden],.map-view[hidden]{display:none;}' +
    '.map-open:focus-visible,.map-tile:focus-visible{outline:3px solid #23395B;outline-offset:2px;}' +
    '.map-view{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#F7FAFF;color:#23395B;}' +
    '.map-view h2{margin:0 0 4px;font-size:1.2rem;}' +
    '.map-hint,.map-count,.map-empty{margin:0 0 8px;font-size:.9rem;font-weight:700;}' +
    '.map-row{margin:12px 0 0;}' +
    '.map-row h3{margin:0 0 4px;font-size:1rem;}' +
    '.map-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;}' +
    '.map-tile{display:flex;gap:6px;align-items:center;padding:8px 10px;border-radius:12px;background:#fff;border:2px solid #DCE5F2;color:#23395B;text-decoration:none;font-size:.85rem;font-weight:700;}' +
    '.map-tile.has{border-color:#E8B93A;}' +
    '.map-medal{font-size:1.2rem;flex:none;}';

  function mountUi(win, core) {
    var doc = win.document, T = core.text;
    var style = doc.createElement('style');
    style.textContent = UI_CSS;
    (doc.head || doc.documentElement).appendChild(style);

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function after(anchor, node) { anchor.parentNode.insertBefore(node, anchor.nextSibling); }
    function sticker(best, polish) { return MEDALS[best] + (polish ? '🔧' : ''); }

    // HTML for a lesson card; m is one of update()'s lessons.
    core.badge = function (m) {
      if (!m || !m.best) return '';
      var label = T.name(m.best) + (m.polish ? ' · ' + T.polish : '');
      return '<span class="medal" title="' + label + '" aria-label="' + label + '">' + sticker(m.best, m.polish) + '</span>';
    };

    core.renderChip = function (result) {
      var badge = doc.getElementById('points-total-badge');
      if (!badge || !badge.parentNode) return;
      var chip = doc.getElementById('medal-chip');
      if (!chip) {
        chip = el('div', 'medal-chip');
        chip.id = 'medal-chip';
        after(badge, chip);
      }
      chip.textContent = T.chip(result.counts);
      chip.hidden = !result.counts.total;
    };

    // Replaces the new-medal lines right under anchor.
    core.showNew = function (anchor, newly) {
      if (!anchor || !anchor.parentNode) return;
      var next = anchor.nextSibling;
      while (next && next.className === 'medal-new') {
        var old = next;
        next = next.nextSibling;
        old.parentNode.removeChild(old);
      }
      newly.slice().reverse().forEach(function (m) { after(anchor, el('div', 'medal-new', T.newLine(m))); });
    };

    core.renderMap = function (box, cards) {
      if (!box) return;
      var apps = core.summary().apps;
      box.innerHTML = '';
      box.appendChild(el('h2', '', T.mapTitle));
      box.appendChild(el('p', 'map-hint', T.mapHint));
      Array.prototype.forEach.call(cards, function (card) {
        var app = card.getAttribute('data-app'), entry = apps[app], list = lessonsOf(entry);
        var title = card.querySelector('.subject-title'), emoji = card.querySelector('.subject-emoji');
        var row = el('section', 'map-row');
        row.setAttribute('data-app', app);
        row.appendChild(el('h3', '', (emoji ? emoji.textContent + ' ' : '') + (title ? title.textContent : app)));
        if (!list.length) {
          row.appendChild(el('p', 'map-empty', T.openOnce));
        } else {
          row.appendChild(el('p', 'map-count', T.chip(counts(entry))));
          var tiles = el('div', 'map-tiles');
          list.forEach(function (l) {
            var best = level(l.best), a = el('a', 'map-tile' + (best ? ' has' : ''));
            a.href = card.getAttribute('href');
            a.appendChild(el('span', 'map-medal', best ? sticker(best, level(l.now) < best) : '⚪'));
            a.appendChild(el('span', '', (l.icon ? l.icon + ' ' : '') + String(l.title)));
            tiles.appendChild(a);
          });
          row.appendChild(tiles);
        }
        box.appendChild(row);
      });
    };
    return core;
  }

  var exported = { create: create, read: read, counts: counts, polishList: polishList, levelOf: levelOf,
    MEDALS: MEDALS, MIN_BOX: MIN_BOX, PAY: PAY, TEXT: TEXT, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Games and lobbies get the page helpers for their grade; the parent page (no data-grade) gets only the pure ones.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = grade && TEXT[grade] ? mountUi(root, create(root.Learner ? root.Learner.storage : root.localStorage, Date.now, grade)) : {};
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Mastery = api;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/browser-globals.test.js tests/mastery.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/mastery.js tests/browser-globals.test.js
```

---

### Task 5: Wiring test, then medals in the 7 Grade 5 family C games

Family C games: `history-explorers` (`web/subjects/grade-5/araling-panlipunan`), `wikaharian` (`grade-5/filipino`), `page-turners` (`grade-5/english`), `rise-shine` (`grade-5/gmrc`), `rally-ready` (`grade-5/pe-health`), `craft-corner` (`grade-5/tle`), `life-lab` (`grade-5/science`). Each has `LESSONS` with `id`, `title`, an emoji `icon`, and `quiz`.

**Files:**
- Create: `tests/mastery-wiring.test.js`
- Modify: the 7 `index.html` files above

- [ ] **Step 1: Write the wiring test** — create `tests/mastery-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;

for (const app of APPS) {
  test(app.id + ' reports and shows lesson medals', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const tag = '<script src="../../../engine/mastery.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads mastery.js');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/recall.js"'), 'after recall.js');
    assert.equal(count(html, 'function medalLessons('), 1);
    assert.equal(count(html, 'function updateMedals('), 1);
    assert.equal(count(html, 'function showMedals('), 1);
    assert.equal(count(html, 'function medalBadge('), 1);
    assert.equal(count(html, 'Mastery.update(SH_APP, medalLessons())'), 1);
    assert.equal(count(html, 'if (medals.points) kit.award(medals.points);'), 1, 'pays new medals');
    assert.equal(count(html, "showMedals(document.getElementById('points-earned'));"), 1, 'after every round');
    const open = "showMedals(document.getElementById('points-total-badge'));";
    assert.equal(count(html, open), 1, 'on open');
    if (app.id !== 'math-mastery') assert.ok(html.indexOf('Recall.tidy(SH_APP') < html.indexOf(open), 'after the review boxes are tidied');
    assert.ok(html.indexOf(open) < html.lastIndexOf('renderHome();'), 'before the home screen is drawn');
    assert.equal(count(html, 'Mastery.renderChip(medals)'), 1, 'header chip');
    assert.ok(count(html, 'medalBadge(') >= 2, 'lesson cards show the medal');
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby has the mastery map', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/mastery.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/recall.js"'), 'after recall.js');
    assert.equal(count(html, '<button class="map-open" id="map-open" type="button" aria-expanded="false" aria-controls="map-view" hidden></button>'), 1);
    assert.equal(count(html, '<div class="map-view" id="map-view" hidden></div>'), 1);
    assert.ok(html.indexOf('id="map-view"') < html.indexOf('<div class="grid">'), 'above the games');
    assert.equal(count(html, "Mastery.renderMap(document.getElementById('map-view'), document.querySelectorAll('.subject-card[data-app]'))"), 1);
  });
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/mastery-wiring.test.js`
Expected: FAIL for all 15 games and both lobbies (`loads mastery.js`).

- [ ] **Step 3: Check the icons are plain emoji** — the map shows `icon` as text:

Run: `grep -h "^  icon:" web/subjects/grade-5/{araling-panlipunan,filipino,english,gmrc,pe-health,tle,science}/lessons/*.js | grep -c "[<&]"`
Expected: `0`. If not 0, pass `icon: ''` for that game in Step 5 instead of `icon: l.icon`.

- [ ] **Step 4: Load the engine file** — in each of the 7 files, after

```html
<script src="../../../engine/recall.js" data-grade="grade5"></script>
```

add

```html
<script src="../../../engine/mastery.js" data-grade="grade5"></script>
```

- [ ] **Step 5: Add the helpers** — in each of the 7 files, right after the `reviewPool` function

```js
function reviewPool(){
  return LESSONS.flatMap(l => l.quiz.map(prepareQuestion));
}
```

add

```js
function medalLessons(){
  return LESSONS.map(l => ({ id: l.id, title: Recall.textOf(l.title), icon: l.icon, keys: l.quiz.map(prepareQuestion).map(q => Recall.keyOf(SH_APP, reviewInfo(q))) }));
}
let medals = null;
function updateMedals(){
  if (!window.Mastery || !window.Recall) return null;
  medals = Mastery.update(SH_APP, medalLessons());
  if (medals.points) kit.award(medals.points);
  return medals;
}
function showMedals(el){
  const m = updateMedals();
  if (m) Mastery.showNew(el, m.newly);
}
function medalBadge(id){
  return medals && medals.lessons[id] ? Mastery.badge(medals.lessons[id]) : '';
}
```

- [ ] **Step 6: Header chip** — in `renderHome`, after

```js
  document.getElementById('points-total-badge').textContent = '⭐ ' + kit.totalPoints() + ' points earned';
```

add

```js
  if (window.Mastery && medals) Mastery.renderChip(medals);
```

- [ ] **Step 7: Lesson card badge** — in `renderHome`'s `LESSONS.forEach` card, replace

```js
      <div class="stars">${starString(starsFor(best/l.quiz.length))}</div>
```

with

```js
      <div class="stars">${starString(starsFor(best/l.quiz.length))}${medalBadge(l.id)}</div>
```

- [ ] **Step 8: After every round** — in `renderResults`, after

```js
  document.getElementById('points-earned').textContent = kit.resultLine();
```

add

```js
  showMedals(document.getElementById('points-earned'));
```

- [ ] **Step 9: On open** — at the end of the script, replace

```js
if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
renderHome();
```

with

```js
if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
showMedals(document.getElementById('points-total-badge'));
renderHome();
```

- [ ] **Step 10: Run the tests**

Run: `node --test tests/mastery-wiring.test.js`
Expected: the 7 family C game tests PASS; the other games and both lobbies still FAIL.

- [ ] **Step 11: Stage**

```bash
git add tests/mastery-wiring.test.js web/subjects/grade-5/araling-panlipunan/index.html web/subjects/grade-5/filipino/index.html web/subjects/grade-5/english/index.html web/subjects/grade-5/gmrc/index.html web/subjects/grade-5/pe-health/index.html web/subjects/grade-5/tle/index.html web/subjects/grade-5/science/index.html
```

---

### Task 6: Medals in the 5 Grade 2 family B games

Family B games: `byte-buddies` (`grade-2/computer`), `word-train` (`grade-2/english`), `growing-good` (`grade-2/gmrc`), `batang-bayani` (`grade-2/makabansa`), `science-detectives` (`grade-2/science`). Their script is one ES5 IIFE; `lessons` have no `id` (progress uses the index) and their `icon` is SVG markup. A lesson's medal id is its plain title; the map shows no icon.

**Files:** the 5 `index.html` files above.

- [ ] **Step 1: Load the engine file** — after

```html
<script src="../../../engine/recall.js" data-grade="grade2"></script>
```

add

```html
<script src="../../../engine/mastery.js" data-grade="grade2"></script>
```

- [ ] **Step 2: Add the helpers** — right after the `reviewPool` function

```js
  function reviewPool(){
    return [].concat.apply([], lessons.map(function(l){ return l.quiz.map(prepareQuestion); }));
  }
```

add

```js
  function medalLessons(){
    return lessons.map(function(l){
      var id = Recall.textOf(l.title);
      return { id: id, title: id, icon: '', keys: l.quiz.map(prepareQuestion).map(function(q){ return Recall.keyOf(SH_APP, reviewInfo(q)); }) };
    });
  }
  var medals = null;
  function updateMedals(){
    if (!window.Mastery || !window.Recall) return null;
    medals = Mastery.update(SH_APP, medalLessons());
    if (medals.points) kit.award(medals.points);
    return medals;
  }
  function showMedals(el){
    var m = updateMedals();
    if (m) Mastery.showNew(el, m.newly);
  }
  function medalBadge(l){
    var id = window.Recall ? Recall.textOf(l.title) : '';
    return medals && medals.lessons[id] ? Mastery.badge(medals.lessons[id]) : '';
  }
```

- [ ] **Step 3: Header chip** — in `renderHome`, after the line that sets `points-total-badge` (`... ' points earned';` in four games, `... ' na puntos (points)';` in makabansa) add

```js
    if (window.Mastery && medals) Mastery.renderChip(medals);
```

- [ ] **Step 4: Lesson card badge** — in the `lessons.map(function(l, i){ ... })` lesson card (check the parameter is named `l`), replace

```js
            '<div class="mini-stars">' + starsMarkup(stars, 3) + '</div>' +
```

with

```js
            '<div class="mini-stars">' + starsMarkup(stars, 3) + medalBadge(l) + '</div>' +
```

- [ ] **Step 5: After every round** — in `finishQuiz`, right after the line that sets `points-earned` (`= kit.resultLine();`, or `= ptsLine + '\n' + kit.resultLine();` in makabansa) add

```js
    showMedals(document.getElementById('points-earned'));
```

- [ ] **Step 6: On open** — at the end of the IIFE, replace

```js
  if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
  renderHome();
```

with

```js
  if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
  showMedals(document.getElementById('points-total-badge'));
  renderHome();
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/mastery-wiring.test.js`
Expected: family B and C game tests PASS.

- [ ] **Step 8: Stage**

```bash
git add web/subjects/grade-2/computer/index.html web/subjects/grade-2/english/index.html web/subjects/grade-2/gmrc/index.html web/subjects/grade-2/makabansa/index.html web/subjects/grade-2/science/index.html
```

---

### Task 7: Medals in the 2 Grade 2 family A games

`kuwentista` (`web/subjects/grade-2/filipino/index.html`) and `block-bot` (`web/subjects/grade-2/math/index.html`). Lessons have `id`, `title`, `emoji`, `quiz`; Block Bot's `generate` lessons have no fixed questions and get no medal.

**Files:** the 2 `index.html` files.

- [ ] **Step 1: Load the engine file** — after `<script src="../../../engine/recall.js" data-grade="grade2"></script>` add

```html
<script src="../../../engine/mastery.js" data-grade="grade2"></script>
```

- [ ] **Step 2: Add the helpers** — right after the `reviewPool` function. In **kuwentista**:

```js
function medalLessons(){
  return LESSONS.map(l => ({ id: l.id, title: Recall.textOf(l.title), icon: l.emoji, keys: l.quiz.map(prepareQuestion).map(q => Recall.keyOf(SH_APP, reviewInfo(q))) }));
}
```

In **block-bot**:

```js
function medalLessons(){
  return LESSONS.filter(l => !l.generate).map(l => ({ id: l.id, title: Recall.textOf(l.title), icon: l.emoji, keys: l.quiz.map(prepareQuestion).map(q => Recall.keyOf(SH_APP, reviewInfo(q))) }));
}
```

Then, in both:

```js
let medals = null;
function updateMedals(){
  if (!window.Mastery || !window.Recall) return null;
  medals = Mastery.update(SH_APP, medalLessons());
  if (medals.points) kit.award(medals.points);
  return medals;
}
function showMedals(el){
  const m = updateMedals();
  if (m) Mastery.showNew(el, m.newly);
}
function medalBadge(id){
  return medals && medals.lessons[id] ? Mastery.badge(medals.lessons[id]) : '';
}
```

- [ ] **Step 3: Header chip** — in `renderHome`, after the `points-total-badge` line add

```js
  if (window.Mastery && medals) Mastery.renderChip(medals);
```

- [ ] **Step 4: Lesson card badge** — in `renderHome`'s `LESSONS.forEach((lesson, i)=>{ ... })` card (not the final-exam card), replace

```js
        <div class="stars">${[1,2,3].map(s=>`<span class="${s<=stars?'star-on':'star-off'}">★</span>`).join('')}</div>
```

with

```js
        <div class="stars">${[1,2,3].map(s=>`<span class="${s<=stars?'star-on':'star-off'}">★</span>`).join('')}${medalBadge(lesson.id)}</div>
```

- [ ] **Step 5: After every round** — right after the line that sets `points-earned` (`= ptsLine + '\n' + kit.resultLine();` in kuwentista, `= kit.resultLine();` in block-bot) add

```js
  showMedals(document.getElementById('points-earned'));
```

- [ ] **Step 6: On open** — replace

```js
if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
renderHome();
```

with

```js
if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
showMedals(document.getElementById('points-total-badge'));
renderHome();
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/mastery-wiring.test.js`
Expected: all games except math-mastery PASS.

- [ ] **Step 8: Stage**

```bash
git add web/subjects/grade-2/filipino/index.html web/subjects/grade-2/math/index.html
```

---

### Task 8: Medals in Math Mastery (by skill)

`web/subjects/grade-5/math/index.html`. A lesson is one skill box `math-mastery|skill:<id>`. Skills are graded in `finishQuiz` before `renderResults`, so the medal update after the points line sees the new box.

- [ ] **Step 1: Load the engine file** — after `<script src="../../../engine/recall.js" data-grade="grade5"></script>` add

```html
<script src="../../../engine/mastery.js" data-grade="grade5"></script>
```

- [ ] **Step 2: Add the helpers** — right after the review variables

```js
const REVIEW_SKILLS = 3, REVIEW_PER_SKILL = 3;
let skillTally = {}, reviewBonus = 0, roundMoved = 0;
```

add

```js
function medalLessons(){
  return LESSONS.map(l => ({ id: l.id, title: Recall.textOf(l.title), icon: l.emoji, keys: [SH_APP + '|skill:' + l.id] }));
}
let medals = null;
function updateMedals(){
  if (!window.Mastery || !window.Recall) return null;
  medals = Mastery.update(SH_APP, medalLessons());
  if (medals.points) kit.award(medals.points);
  return medals;
}
function showMedals(el){
  const m = updateMedals();
  if (m) Mastery.showNew(el, m.newly);
}
function medalBadge(id){
  return medals && medals.lessons[id] ? Mastery.badge(medals.lessons[id]) : '';
}
```

- [ ] **Step 3: Header chip** — in `renderHome`, after

```js
  document.getElementById('points-total-badge').textContent = '⭐ ' + kit.totalPoints() + ' points earned';
```

add

```js
  if (window.Mastery && medals) Mastery.renderChip(medals);
```

- [ ] **Step 4: Lesson card badge** — in `renderHome`'s `LESSONS.forEach((lesson, i)=>{ ... })` card, replace

```js
        <div class="stars">${[1,2,3].map(s=>`<span class="${s<=stars?'star-on':'star-off'}">★</span>`).join('')}</div>
```

with

```js
        <div class="stars">${[1,2,3].map(s=>`<span class="${s<=stars?'star-on':'star-off'}">★</span>`).join('')}${medalBadge(lesson.id)}</div>
```

- [ ] **Step 5: After every round** — in `renderResults`, after

```js
  document.getElementById('points-earned').textContent = kit.roundLine('this round') + (roundMoved && window.Recall ? Recall.text.movedLine(roundMoved, reviewBonus) : '');
```

add

```js
  showMedals(document.getElementById('points-earned'));
```

- [ ] **Step 6: On open** — at the end of the script, replace

```js
renderHome();
if (window.Recall && Recall.wantsReview) startReview();
```

with

```js
showMedals(document.getElementById('points-total-badge'));
renderHome();
if (window.Recall && Recall.wantsReview) startReview();
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/mastery-wiring.test.js`
Expected: all 15 game tests PASS; the 2 lobby tests still FAIL.

- [ ] **Step 8: Stage**

```bash
git add web/subjects/grade-5/math/index.html
```

---

### Task 9: The lobby map panel

Both lobbies get the same markup and the same inline script (`tests/copies.test.js` requires the last `<script>` of both lobbies to be identical, so paste the script exactly the same in both).

**Files:** `web/lobby/grade-5.html`, `web/lobby/grade-2.html`

- [ ] **Step 1: Load the engine file** — after `<script src="../engine/recall.js" data-grade="grade5"></script>` (grade-2: `data-grade="grade2"`) add

```html
<script src="../engine/mastery.js" data-grade="grade5"></script>
```

(grade-2.html: `data-grade="grade2"`.)

- [ ] **Step 2: Markup** — replace

```html
  <div class="review-due" id="review-due" hidden></div>
  <div class="grid">
```

with

```html
  <div class="review-due" id="review-due" hidden></div>
  <button class="map-open" id="map-open" type="button" aria-expanded="false" aria-controls="map-view" hidden></button>
  <div class="map-view" id="map-view" hidden></div>
  <div class="grid">
```

- [ ] **Step 3: Script** — after

```js
  document.addEventListener('cloud-synced', showReview);
```

add

```js
  function showMap(){ Mastery.renderMap(document.getElementById('map-view'), document.querySelectorAll('.subject-card[data-app]')); }
  (function(){
    var btn = document.getElementById('map-open'), view = document.getElementById('map-view');
    if (!btn || !view || !window.Mastery || !Mastery.renderMap) return;
    btn.textContent = Mastery.text.mapButton;
    btn.hidden = false;
    btn.addEventListener('click', function(){
      var open = view.hidden;
      if (open) showMap();
      view.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('cloud-synced', function(){ if (!view.hidden) showMap(); });
  })();
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/mastery-wiring.test.js tests/copies.test.js tests/review-wiring.test.js tests/subjects.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html
```

---

### Task 10: Medals on the parent phone page

**Files:** `web/parent/index.html`, `web/parent/phone.js`, `tests/copies.test.js`

- [ ] **Step 1: Update the test first** — in `tests/copies.test.js`, test `'the parent page loads the shared panel and its engine files'`, add `'mastery'` to the list:

```js
  for (const f of ['storage', 'study-history', 'wallet', 'sync-core', 'firebase-config', 'firebase-remote', 'shop-requests', 'subjects', 'mastery', 'parent-panel']) {
```

Run: `node --test tests/copies.test.js`
Expected: FAIL (`parent page does not load mastery.js`).

- [ ] **Step 2: Load it** — in `web/parent/index.html`, after `<script src="../engine/subjects.js"></script>` add

```html
<script src="../engine/mastery.js"></script>
```

- [ ] **Step 3: A section in the child template** — in `web/parent/index.html`, inside `<template id="child-template">`, between the coins section and the shop prices, i.e. right after

```html
    <div class="pts-list" id="kid-points"></div>
  </div>
```

add

```html
  <div class="p-section" id="medals" hidden></div>
```

- [ ] **Step 4: Render it** — in `web/parent/phone.js`, change `render()` to

```js
  function render() {
    renderRequests();
    renderRecent();
    renderCoins();
    renderMedals();
    child.panel.render();
  }
```

and add after `renderShop`:

```js
  function renderMedals() {
    var box = $('medals'), polish = [];
    box.textContent = '';
    box.hidden = !window.Mastery;
    if (!window.Mastery) return;
    var apps = Mastery.read(child.space).apps;
    box.appendChild(el('h3', '', '🏅 Medals'));
    child.subjects.forEach(function (s) {
      var e = apps[s.app];
      if (!e) { box.appendChild(el('div', 'p-note', s.title + ' · not opened since medals were added')); return; }
      var c = Mastery.counts(e);
      box.appendChild(el('div', '', s.title + ' · 🥇 ' + c.gold + ' · 🥈 ' + c.silver + ' · 🥉 ' + c.bronze + ' of ' + c.total));
      Mastery.polishList(e).forEach(function (t) { polish.push(s.title + ': ' + t); });
    });
    if (!polish.length) return;
    box.appendChild(el('h3', '', '🔧 Needs a polish'));
    polish.forEach(function (t) { box.appendChild(el('div', '', t)); });
  }
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/copies.test.js`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add web/parent/index.html web/parent/phone.js tests/copies.test.js
```

---

### Task 11: E2E — medals in every game, the lobby map

**Files:** `tests/e2e/driver-common.page.js`, `tests/e2e/driver-family-a.page.js`, `tests/e2e/driver-family-b.page.js`, `tests/e2e/driver-family-c.page.js`, `tests/e2e/driver-math.page.js`, `tests/e2e/apps-e2e.js`, `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`

The game scenario, on a fresh profile: play the first medal lesson's quiz all right; move every question of that lesson to box 3 (due in 30 days) and play it again (resting, so it pays nothing and boxes stay); then let one question slip to box 1. For Math the lesson is its one skill: the quiz moves it to box 2 (Bronze), the second quiz does not grade it (not due), so it stays at box 3 (Silver).

- [ ] **Step 1: Common driver** — append to `tests/e2e/driver-common.page.js`:

```js
function __e2eMedal(startLesson) {
  var r = {}, lesson = medalLessons()[0];
  function texts(sel) { return Array.prototype.map.call(document.querySelectorAll(sel), function (e) { return e.textContent; }); }
  function round() {
    var before = kit.totalPoints();
    startLesson(lesson);
    __e2eAnswerAll(true);
    return kit.totalPoints() - before - kit.sessionPoints();
  }
  function setBox(keys, box) {
    var store = JSON.parse(__store.getItem('review_v1') || '{"v":1,"items":{}}');
    keys.forEach(function (k) { store.items[k] = { box: box, due: __e2eToday(30), t: Date.now() }; });
    __store.setItem('review_v1', JSON.stringify(store));
  }
  r.first = round();
  setBox(lesson.keys, 3);
  r.second = round();
  r.newText = texts('.medal-new').join(' | ');
  var saved = JSON.parse(__store.getItem('mastery_v1')).apps[SH_APP].lessons[lesson.id];
  r.saved = { now: saved.now, best: saved.best, paid: saved.paid };
  renderHome();
  r.badges = texts('.medal');
  r.chip = (document.getElementById('medal-chip') || {}).textContent || '';
  setBox(lesson.keys.slice(0, 1), 1);
  r.slipPaid = updateMedals().points;
  renderHome();
  r.slipBadges = texts('.medal');
  __e2eOut({ medal: r });
}
```

- [ ] **Step 2: Family drivers** — add a `medal` mode next to each driver's `review` mode line:

`tests/e2e/driver-family-c.page.js`, after the `if (mode === 'review') ...` line:

```js
  if (mode === 'medal') return __e2eMedal(function () { currentLessonIdx = 0; startQuiz(); });
```

`tests/e2e/driver-family-b.page.js`, after its `review` line:

```js
  if (mode === 'medal') return __e2eMedal(function () { currentLesson = 0; startQuiz(); });
```

`tests/e2e/driver-family-a.page.js`, after its `review` line:

```js
  if (mode === 'medal') return __e2eMedal(function (lesson) { currentLessonIdx = LESSONS.findIndex(function (l) { return l.id === lesson.id; }); startQuiz(); });
```

`tests/e2e/driver-math.page.js`, right before `if (mode === 'review') {`:

```js
  if (mode === 'medal') return __e2eMedal(function () { currentLessonIdx = 0; startQuiz(); });
```

- [ ] **Step 3: Check it in `tests/e2e/apps-e2e.js`** — add after `checkMathReview`:

```js
function checkMedal(app, out) {
  assert.deepEqual(out.errors, [], 'medal: page errors');
  const m = out.medal;
  if (app.family === 'math') assert.deepEqual([m.first, m.second], [20, 40], 'a skill at box 2 pays Bronze, at box 3 Silver');
  else {
    assert.ok(m.first === 0 || m.first === 20, 'Bronze only when the quiz covered the whole lesson: ' + m.first);
    assert.equal(m.first + m.second, 60, 'Bronze and Silver pay 20 + 40, once each');
  }
  assert.match(m.newText, /🏅/, 'the results show the new medal');
  assert.deepEqual(m.saved, { now: 2, best: 2, paid: 2 });
  assert.ok(m.badges.includes('🥈'), 'the lesson card shows Silver: ' + m.badges.join(' '));
  assert.match(m.chip, /🥈 1/, 'the header chip counts it');
  assert.equal(m.slipPaid, 0, 'a slip pays nothing');
  assert.ok(m.slipBadges.includes('🥈🔧'), 'a slipped lesson keeps its medal with a polish mark');
  console.log('  medal: ' + m.first + ' + ' + m.second + ' pts');
}
```

and in the per-app loop, after the `if (app.family === 'math') checkMathReview(reviewOut); else { ... }` block:

```js
    checkMedal(app, readOutput(dumpDom(path.join(work, 'profile-medal-' + app.slug), recallFile, '#e2e=medal')));
```

- [ ] **Step 4: Lobby driver** — in `tests/e2e/lobby-driver.page.js`, before `if (mode === 'nojs') {` add:

```js
  if (mode === 'map') {
    var mcard = document.querySelector('.subject-card[data-app]'), mapp = mcard.getAttribute('data-app'), apps = {};
    apps[mapp] = { t: 1, order: ['x', 'y'], lessons: {
      x: { title: 'Lesson X', icon: '', now: 3, best: 3, paid: 3 },
      y: { title: 'Lesson Y', icon: '', now: 1, best: 2, paid: 2 } } };
    __store.setItem('mastery_v1', JSON.stringify({ v: 1, apps: apps }));
    r.buttonHidden = $('map-open').hidden;
    $('map-open').click();
    var view = $('map-view'), mrow = view.querySelector('.map-row[data-app="' + mapp + '"]');
    r.viewHidden = view.hidden;
    r.expanded = $('map-open').getAttribute('aria-expanded');
    r.tiles = Array.prototype.map.call(mrow.querySelectorAll('.map-tile'), function (t) { return { text: t.textContent, href: t.getAttribute('href') }; });
    r.count = mrow.querySelector('.map-count').textContent;
    r.empty = view.querySelectorAll('.map-empty').length;
    r.rows = view.querySelectorAll('.map-row').length;
    r.cards = document.querySelectorAll('.subject-card[data-app]').length;
    r.cardHref = mcard.getAttribute('href');
    $('map-open').click();
    r.closed = view.hidden;
    return out(r);
  }
```

- [ ] **Step 5: Lobby check** — in `tests/e2e/lobby-e2e.js`, after the review-card assertions (`assert.equal(rv.emptyHidden, true, ...)`), add:

```js
  const mp = readOutput(dumpDom(path.join(work, 'profile-map'), withJsLobby, '#e2e=map'));
  assert.deepEqual(mp.errors, [], 'map: page errors');
  assert.equal(mp.buttonHidden, false, 'the My Map button shows');
  assert.equal(mp.viewHidden, false, 'tapping it opens the map');
  assert.equal(mp.expanded, 'true');
  assert.deepEqual(mp.tiles.map((t) => t.text), ['🥇Lesson X', '🥈🔧Lesson Y'], 'medal per lesson, polish mark when slipped');
  assert.ok(mp.tiles.every((t) => t.href === mp.cardHref), 'a tile opens the game like its card');
  assert.match(mp.count, /🥇 1 · 🥈 1 · 🥉 0/);
  assert.equal(mp.rows, mp.cards, 'one row per subject');
  assert.equal(mp.empty, mp.cards - 1, 'games never opened say so');
  assert.equal(mp.closed, true, 'tapping again closes it');
```

- [ ] **Step 6: Run the e2e suites**

Run: `node tests/e2e/apps-e2e.js 5` then `node tests/e2e/apps-e2e.js 2`, then `node tests/e2e/lobby-e2e.js 5` and `node tests/e2e/lobby-e2e.js 2` (each reads the grade from its first argument; anything but `5` means Grade 2).
Expected: `PASS <slug>` with a `medal:` line for every game, and `Lobby passed` for both grades. Also run `node tests/e2e/backup-e2e.js`, `node tests/e2e/file-check-e2e.js` and `node tests/e2e/migration-e2e.js` (with their grade arguments) and expect them to pass unchanged.

If an existing check fails only because medal points now land in a total, fix the expectation to subtract the medal pay, and say so in the report.

- [ ] **Step 7: Stage**

```bash
git add tests/e2e/driver-common.page.js tests/e2e/driver-family-a.page.js tests/e2e/driver-family-b.page.js tests/e2e/driver-family-c.page.js tests/e2e/driver-math.page.js tests/e2e/apps-e2e.js tests/e2e/lobby-driver.page.js tests/e2e/lobby-e2e.js
```

---

### Task 12: Offline cache, README, final check

**Files:** `web/sw.js` (generated), `README.md`, spec status

- [ ] **Step 1: Offline cache**

Run: `node tools/update-precache.js`
Expected: `web/sw.js` PRECACHE now lists `'engine/mastery.js'`. Check with `grep -n "engine/mastery.js" web/sw.js`.

- [ ] **Step 2: README** — in the engine file list, after the `recall.js` line add:

```
    mastery.js                 lesson medals (🥉🥈🥇 from the review boxes), the lobby map, medal points
```

Under the game features list, after the `**Stars**` line add:

```markdown
- **Medals** (🥉 Bronze, 🥈 Silver, 🥇 Gold) need every question in a lesson right on 1, 2 and 3 separate days. They never go away; a 🔧 shows when a lesson needs a polish. A new medal pays 20, 40 or 80 points once. The lobby's **🗺️ My Map** shows every lesson's medal.
```

In "A new subject or grade", after step 4 (the Review round) add a step and renumber the rest:

```markdown
5. Give it medals: `medalLessons`, `updateMedals`, `showMedals`, `medalBadge`, the `Mastery.renderChip(medals)` line in `renderHome`, `showMedals(...'points-earned')` after the round's points line and `showMedals(...'points-total-badge')` before the first `renderHome()` (copy them from a game of the same family; `tests/mastery-wiring.test.js` checks them).
```

- [ ] **Step 3: Spec status** — in `docs/superpowers/specs/2026-10-02-mastery-map-design.md`, change `Status: approved 2026-10-02.` to `Status: built 2026-10-02.`

- [ ] **Step 4: Full check**

Run: `node --test`
Expected: all tests pass (the earlier 475 plus the new ones), 0 failures.
Run every e2e suite as in Task 11 Step 6. Expected: all pass.

- [ ] **Step 5: Stage**

```bash
git add web/sw.js README.md docs/superpowers/specs/2026-10-02-mastery-map-design.md docs/superpowers/plans/2026-10-02-mastery-map.md
```

---

## Self-review notes

- Spec coverage: levels/thresholds (Task 1), keep best + polish (Tasks 1, 4), pay 20/40/80 once + first-open and later-lesson no pay (Task 1), `kit.award` (Task 2), sync merge + backups (Task 3), lesson cards + header chip + results line + open-time line (Tasks 4-8), lobby map (Tasks 4, 9), parent page (Task 10), Block Bot `generate` and Math skills (Tasks 7, 8), e2e (Task 11), PRECACHE (Task 12).
- Names used across tasks: `Mastery.update(app, lessons)`, `Mastery.badge`, `Mastery.renderChip(result)`, `Mastery.showNew(anchor, newly)`, `Mastery.renderMap(box, cards)`, `Mastery.read/counts/polishList`, `Mastery.text.mapButton`, `kit.award(pts)`; per game `medalLessons`, `medals`, `updateMedals`, `showMedals`, `medalBadge`.
