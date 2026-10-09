# Weekly Boss Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **The user runs every commit.** Never run `git commit`. At each "Commit" step, stage nothing and show the user the `git add` / `git commit -m '...'` commands as a code block. No `Co-Authored-By` lines.

**Goal:** Once a week the lobby shows a 🐉 boss made of 3-question review stages (4 for Grade 5, 3 for Grade 2), each played inside its own game. Clearing every stage pays 10 coins, and clearing at least half by the end of the week pays 4.

**Architecture:** A new engine file `web/engine/boss.js` (global `Boss`) owns the week, stage picking, the clear rule and the pay. Its rules sit in a pure `create(storage, now, grade, deps)` that is unit-tested like `quests.js`. `recall.js` gets two pickers (`pickBoss`, `weakestSkill`). Each game's existing `startReview` takes a `boss` flag, so a boss stage is a review round with a different pick and title. Its result goes through `Boss.stageResult` into the existing `Fx.celebrate` call. The lobby's `showQuests` also runs `Boss.ensure` and `Boss.renderLobby`. `sync-core.js` gets a `MERGE.boss` rule.

**Tech Stack:** Plain HTML/JS, no build step. Unit tests use `node --test`. E2E runs headless Chrome (`tests/e2e/*.js`, `--dump-dom` with an in-page driver).

**Spec:** `docs/superpowers/specs/2026-10-04-weekly-boss-design.md`

---

## Background the engineer needs

- The site lives in `web/`. Games are at `web/subjects/grade-N/<subject>/index.html` and load engine files with `<script src="../../../engine/X.js" data-grade="gradeN"></script>`. Lobbies are `web/lobby/grade-5.html` and `web/lobby/grade-2.html`. The parent phone page is `web/parent/index.html` + `web/parent/phone.js`.
- Engine files follow one pattern (copy `web/engine/quests.js`): an IIFE that does `module.exports = exported` under Node (unit tests). In the browser, it creates a global and reads `data-grade` from `document.currentScript`. Without a grade (the parent page), it exposes only the pure helpers.
- Storage is the learner's space: `root.Learner ? root.Learner.storage : root.localStorage`. Review boxes are `review_v1` = `{ v: 1, items: { "<app>|<hash>" | "<app>|skill:<id>": { box 1-5, due 'YYYY-MM-DD', t, started?, gone? } } }`.
- Spaced review rules already in `recall.js`: a question that is not due is "resting". It pays 0 and its box does not move. A due right answer pays points plus a gap bonus and moves up a box. A wrong answer goes to box 1. **The boss changes none of this.**
- `Wallet.addBonus(coins)` pays coins and returns true. `Fx.celebrate(events, anchor)` shows one popup card. Events are `{ big, icon, title, line, next }`, and big ones are put first. A second `celebrate` call replaces the first, so gather events and call once.
- `tests/paths.js` has `ENGINE_FILES`, `APPS` (each with `id`, `grade`, `page`, `family`), `appFile(id)`, `lobbyFile(grade)`, `engineFile(name)`.
- Every file under `web/` must be in PRECACHE in `web/sw.js`. Run `node tools/update-precache.js` after adding a file. `tests/pwa.test.js` enforces it.
- Grade 2 text: Filipino always comes paired with English (`tests/english-everywhere.test.js`), and buttons are English only.
- Unit tests: `node --test` from the repo root. E2E: `node tests/e2e/apps-e2e.js` (Grade 2), `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/lobby-e2e.js 5`. Question order is random, so run e2e suites twice before trusting them.
- There are **17 games** in four families:

| Family | Games (app id) | Style | Score variable | Retry | Extra quirk |
|---|---|---|---|---|---|
| C (Grade 5) | history-explorers, page-turners, wikaharian, rise-shine, rally-ready, life-lab, craft-corner, net-navigators, rhythm-hues | top-level functions | `quizScore` | `retryQuiz()` | `startReview` also sets `#quizTitle` from `Recall.text.reviewTitle` |
| B (Grade 2) | byte-buddies, word-train, growing-good, batang-bayani, science-detectives | inside an IIFE, 2-space indent | `score` | `#btn-retry` click listener | `reviewBtn.addEventListener('click', startReview)` passes the click event as the first argument |
| A (Grade 2) | kuwentista, block-bot | top-level functions | `quizScore` | `retryLesson()` | none |
| math | math-mastery | top-level functions | `quizScore` | `retryLesson()` | reviews by skill: `Recall.skillsDue` + `l.generate(REVIEW_PER_SKILL)` (= 3) |

## File map

- Create `web/engine/boss.js`: the week, picking, clearing, pay, lobby card and parent line.
- Create `tests/boss.test.js`: unit tests for the boss rules.
- Create `tests/boss-wiring.test.js`: static checks that every game and both lobbies are wired.
- Modify `web/engine/recall.js`: `pickBoss`, `weakestSkill`.
- Modify `tests/recall.test.js`: tests for the two pickers.
- Modify `web/engine/sync-core.js`: `kindOf('boss_v1')`, `MERGE.boss`, and the JSON kinds in `readLocal` / `writeLocal`.
- Modify `tests/sync.test.js`: merge and travel tests.
- Modify all 17 game `index.html` files, through a one-off script.
- Modify `tests/review-wiring.test.js` and `tests/mastery-wiring.test.js`: the changed lines.
- Modify `web/lobby/grade-5.html` and `web/lobby/grade-2.html`: `#boss` div, script tag, `showQuests`.
- Modify `web/parent/index.html` and `web/parent/phone.js`: the boss line.
- Modify `tests/browser-globals.test.js` and `tests/english-everywhere.test.js`.
- Modify `tests/paths.js`: add `boss.js` to `ENGINE_FILES`.
- Modify `web/sw.js`, regenerated by the tool.
- Modify the e2e files: `tests/e2e/driver-common.page.js`, the four `driver-*.page.js` files, `apps-e2e.js`, `lobby-driver.page.js` and `lobby-e2e.js`.
- Modify `README.md`.

---

### Task 1: The boss engine (`boss.js`)

**Files:**
- Create: `web/engine/boss.js`
- Create: `tests/boss.test.js`
- Modify: `tests/paths.js` (ENGINE_FILES)
- Modify: `web/sw.js` (via `node tools/update-precache.js`)

- [ ] **Step 1: Write the failing tests**

Create `tests/boss.test.js`:

```js
process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, read, rank, weekKey, linkFor, parentLine, TEXT, KEY, STAGES, STAGE_SIZE, FULL_COINS, HALF_COINS } = require(engineFile('boss.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function clock(y, m, d, h) {
  let t = new Date(y, m - 1, d, h || 9, 0).getTime();
  const now = () => t;
  now.days = (n) => { const x = new Date(t); x.setDate(x.getDate() + n); t = x.getTime(); };
  return now;
}

const CARDS = ['a', 'b', 'c', 'd', 'e', 'm'].map((app) => ({ app, title: app.toUpperCase() + ' Game', href: app + '.html?reset=1' }));

// n review boxes for one app, all due on 2026-10-05.
function boxes(items, app, n, box) {
  for (let i = 0; i < n; i++) items[app + '|h' + i] = { box: box || 2, due: '2026-10-05', t: 1 };
  return items;
}

function world(opts) {
  const o = Object.assign({ items: {}, due: {}, grade: 'grade5', bonusOk: true }, opts);
  const s = memory(), now = o.now || clock(2026, 10, 5);
  const paid = [];
  const deps = {
    items: () => o.items,
    due: () => o.due,
    bonus: (c) => { if (!o.bonusOk) return false; paid.push(c); return true; },
    random: () => 0.5,
  };
  return { o, s, now, paid, b: create(s, now, o.grade, deps) };
}

// Four qualifying apps: a has the most due, then c; b and d have none due, b has more weak boxes.
function fourApps() {
  const items = {};
  boxes(items, 'a', 3, 3); boxes(items, 'b', 5, 1); boxes(items, 'c', 3, 2); boxes(items, 'd', 4, 2);
  return { items, due: { a: 3, c: 1 } };
}
const saved = (s) => JSON.parse(s.data[KEY]);

test('sizes and pay', () => {
  assert.deepEqual(STAGES, { grade5: 4, grade2: 3 });
  assert.equal(STAGE_SIZE, 3);
  assert.equal(FULL_COINS, 10);
  assert.equal(HALF_COINS, 4);
});

test('a week starts on Monday', () => {
  assert.equal(weekKey(new Date(2026, 9, 4, 23, 59).getTime()), '2026-09-28', 'Sunday belongs to the week before');
  assert.equal(weekKey(new Date(2026, 9, 5, 0, 1).getTime()), '2026-10-05');
  assert.equal(weekKey(new Date(2026, 9, 11, 20).getTime()), '2026-10-05');
  assert.equal(weekKey(new Date(2027, 0, 1, 9).getTime()), '2026-12-28', 'across the year end');
});

test('rank: most due first, then most weak boxes; 3 boxes or 1 skill box qualify; gone boxes and other cards do not count', () => {
  const items = {};
  boxes(items, 'a', 3, 3);
  boxes(items, 'b', 5, 1);
  boxes(items, 'c', 3, 2);
  boxes(items, 'd', 2, 1);
  items['m|skill:fractions'] = { box: 2, due: '2026-10-09', t: 1 };
  boxes(items, 'e', 3, 1);
  Object.keys(items).filter((k) => k.indexOf('e|') === 0).forEach((k) => { items[k].gone = true; });
  boxes(items, 'x', 9, 1);
  const order = rank(CARDS, items, { a: 3, c: 1, x: 9 }, () => 0.5).map((c) => c.app);
  assert.deepEqual(order, ['a', 'c', 'b', 'm']);
});

test('ensure picks the stages once a week, with their titles', () => {
  const w = world(fourApps());
  assert.deepEqual(w.b.ensure(CARDS), []);
  const st = saved(w.s);
  assert.equal(st.week, '2026-10-05');
  assert.deepEqual(st.stages, [
    { app: 'a', title: 'A Game', cleared: false }, { app: 'c', title: 'C Game', cleared: false },
    { app: 'b', title: 'B Game', cleared: false }, { app: 'd', title: 'D Game', cleared: false }]);
  w.o.due = { d: 9 };
  w.now.days(3);
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages.map((s) => s.app), ['a', 'c', 'b', 'd'], 'kept for the rest of the week');
  assert.equal(w.b.isStage('a'), true);
  assert.equal(w.b.isStage('e'), false);
});

test('Grade 2 has 3 stages', () => {
  const w = world(Object.assign(fourApps(), { grade: 'grade2' }));
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages.map((s) => s.app), ['a', 'c', 'b']);
});

test('fewer than 2 qualifying games: no boss yet, and the lobby tries again later that week', () => {
  const w = world({ items: boxes({}, 'a', 3) });
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages, []);
  assert.equal(w.b.isStage('a'), false);
  boxes(w.o.items, 'b', 3);
  w.now.days(1);
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages.map((s) => s.app), ['a', 'b']);
});

test('2 of 3 right clears a stage; 1 of 3 asks to try again; a cleared stage counts once', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  const miss = w.b.stageResult('c', 1, 3);
  assert.equal(miss.length, 1);
  assert.deepEqual([miss[0].big, miss[0].icon, miss[0].title], [false, '⚔️', TEXT.grade5.missTitle]);
  assert.equal(miss[0].line, '1 of 3 right · you need 2');
  assert.equal(w.b.isStage('c'), true, 'still open');
  const hit = w.b.stageResult('c', 2, 3);
  assert.deepEqual(hit.map((e) => e.title), ['Boss hit! C Game stage cleared']);
  assert.equal(hit[0].line, '1 of 4 stages cleared');
  assert.equal(hit[0].next, 'Next stage: A Game');
  assert.equal(w.b.isStage('c'), false);
  assert.deepEqual(w.b.stageResult('c', 3, 3), [], 'already cleared');
  assert.deepEqual(w.b.stageResult('e', 3, 3), [], 'not a stage');
  assert.deepEqual(w.b.stageResult('a', 0, 0), [], 'an empty round counts for nothing');
  assert.deepEqual(w.b.stageResult('a', 2, 2).map((e) => e.icon), ['⚔️'], 'a short pool keeps the 2-of-3 ratio');
  assert.equal(w.paid.length, 0);
});

test('clearing every stage pays 10 coins once', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  ['a', 'c', 'b'].forEach((app) => w.b.stageResult(app, 3, 3));
  const last = w.b.stageResult('d', 2, 3);
  assert.deepEqual(last.map((e) => e.big), [true, false]);
  assert.deepEqual([last[0].icon, last[0].title, last[0].line], ['🐉', TEXT.grade5.beatTitle, '+10 coins']);
  assert.equal(last[1].next, TEXT.grade5.hitNext(null));
  assert.deepEqual(w.paid, [10]);
  assert.deepEqual(saved(w.s).paid, ['2026-10-05|full']);
  assert.deepEqual(w.b.ensure(CARDS), [], 'the lobby pays nothing more');
  w.now.days(7);
  assert.deepEqual(w.b.ensure(CARDS), [], 'nor at the next week');
  assert.deepEqual(w.paid, [10]);
});

test('at least half cleared pays 4 coins when the next week starts; then a new boss is picked', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  w.b.stageResult('a', 3, 3);
  w.b.stageResult('c', 3, 3);
  w.now.days(7);
  const events = w.b.ensure(CARDS);
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].big, events[0].title, events[0].line], [false, 'Last week\'s boss: 2 of 4 stages', '+4 coins']);
  assert.deepEqual(w.paid, [4]);
  const st = saved(w.s);
  assert.equal(st.week, '2026-10-12');
  assert.equal(st.stages.length, 4);
  assert.ok(st.stages.every((s) => !s.cleared), 'a fresh boss');
  assert.deepEqual(st.paid, ['2026-10-05|half']);
  assert.deepEqual(w.b.ensure(CARDS), []);
  assert.deepEqual(w.paid, [4]);
});

test('under half pays nothing at the next week', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  w.b.stageResult('a', 3, 3);
  w.now.days(7);
  assert.deepEqual(w.b.ensure(CARDS), []);
  assert.deepEqual(w.paid, []);
});

test('stages cleared on another device: the lobby pays the full boss once, this week or at rollover', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  const st = saved(w.s);
  st.stages.forEach((s) => { s.cleared = true; });
  w.s.data[KEY] = JSON.stringify(st);
  assert.deepEqual(w.b.ensure(CARDS).map((e) => e.big), [true]);
  assert.deepEqual(w.paid, [10]);

  const w2 = world(fourApps());
  w2.b.ensure(CARDS);
  const st2 = saved(w2.s);
  st2.stages.forEach((s) => { s.cleared = true; });
  w2.s.data[KEY] = JSON.stringify(st2);
  w2.now.days(7);
  assert.deepEqual(w2.b.ensure(CARDS).map((e) => e.title), [TEXT.grade5.beatTitle], 'full, not half');
  assert.deepEqual(w2.paid, [10]);
});

test('a failed payment leaves no mark, so the lobby pays later', () => {
  const w = world(Object.assign(fourApps(), { bonusOk: false }));
  w.b.ensure(CARDS);
  ['a', 'c', 'b'].forEach((app) => w.b.stageResult(app, 3, 3));
  assert.deepEqual(w.b.stageResult('d', 3, 3).map((e) => e.big), [false], 'no beat popup without the coins');
  assert.deepEqual(saved(w.s).paid, []);
  w.o.bonusOk = true;
  assert.deepEqual(w.b.ensure(CARDS).map((e) => e.big), [true]);
  assert.deepEqual(w.paid, [10]);
});

test('read ignores junk', () => {
  assert.deepEqual(read(memory({ boss_v1: '{nope' })), { v: 1, week: '', stages: [], paid: [] });
  assert.deepEqual(read(memory({ boss_v1: JSON.stringify({ v: 1, week: 5, stages: [null, { app: 'a', cleared: 'yes' }, { title: 'x' }], paid: [1, 'w|full'] }) })),
    { v: 1, week: '', stages: [{ app: 'a', title: 'a', cleared: false }], paid: ['w|full'] });
});

test('links open the game in boss mode', () => {
  assert.equal(linkFor('a', CARDS), 'a.html?reset=1&boss=1');
  assert.equal(linkFor('z', [{ app: 'z', href: 'z.html' }]), 'z.html?boss=1');
  assert.equal(linkFor('q', CARDS), null);
});

test('the parent line', () => {
  const now = new Date(2026, 9, 6, 9).getTime();
  const st = (cleared) => ({ v: 1, week: '2026-10-05', stages: [{ app: 'a', title: 'A', cleared: true }, { app: 'b', title: 'B', cleared }], paid: [] });
  assert.equal(parentLine(st(false), now), '🐉 Weekly boss: 1 of 2 stages');
  assert.equal(parentLine(st(true), now), '🐉 Weekly boss: beaten');
  assert.equal(parentLine(st(true), new Date(2026, 9, 13, 9).getTime()), '🐉 Weekly boss: not started');
  assert.equal(parentLine({ v: 1, week: '2026-10-05', stages: [], paid: [] }, now), '🐉 Weekly boss: not started');
});
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `node --test tests/boss.test.js`
Expected: FAIL with `Cannot find module` for `web/engine/boss.js`.

- [ ] **Step 3: Write `web/engine/boss.js`**

```js
/* Loaded by both lobbies and every game after quests.js, and by the parent page. The pages are decoded as UTF-8, so the text can hold emoji.
   Once a week the lobby picks a boss: the games where review is most needed. Each stage is a short review round
   played inside that game; 2 of 3 right clears it. Every stage cleared pays 10 coins, at least half by the end of
   the week pays 4. */
(function (root) {
  'use strict';

  var KEY = 'boss_v1';
  var STAGES = { grade5: 4, grade2: 3 };
  var STAGE_SIZE = 3;
  var MIN_STAGES = 2;
  var MIN_BOXES = 3;
  var FULL_COINS = 10;
  var HALF_COINS = 4;
  var KEEP_PAID = 60;

  function coinsEn(c) { return '+' + c + ' coins'; }
  var TEXT = {
    grade5: {
      stageTitle: '🐉 Boss stage',
      cardTitle: '🐉 Weekly Boss — until Sunday',
      hp: function (c, n) { return c + ' of ' + n + ' stages cleared'; },
      beaten: '🐉 Boss beaten! New boss on Monday',
      none: '🐉 The boss comes when you\'ve played a few games',
      hitTitle: function (t) { return 'Boss hit! ' + t + ' stage cleared'; },
      hitNext: function (t) { return t ? 'Next stage: ' + t : 'The boss is down!'; },
      missTitle: 'Almost! Try the boss stage again',
      missLine: function (r, n, need) { return r + ' of ' + n + ' right · you need ' + need; },
      missNext: 'Tap Try Again when you\'re ready',
      beatTitle: 'You beat the Weekly Boss!',
      beatNext: 'New boss on Monday',
      halfTitle: function (c, n) { return 'Last week\'s boss: ' + c + ' of ' + n + ' stages'; },
      halfNext: 'A new boss is here!',
      coins: coinsEn
    },
    grade2: {
      stageTitle: '🐉 Boss stage · Laban sa Boss',
      cardTitle: '🐉 Boss ngayong linggo · Weekly Boss — until Sunday',
      hp: function (c, n) { return c + ' sa ' + n + ' stage ang tapos · ' + c + ' of ' + n + ' stages cleared'; },
      beaten: '🐉 Natalo mo na ang Boss! · Boss beaten! New boss on Monday',
      none: '🐉 Darating ang boss kapag nakapaglaro ka na · The boss comes when you\'ve played a few games',
      hitTitle: function (t) { return 'Tinamaan mo ang Boss! · Boss hit! ' + t + ' stage cleared'; },
      hitNext: function (t) { return t ? 'Susunod: ' + t + ' · Next stage: ' + t : 'Talo na ang Boss! · The boss is down!'; },
      missTitle: 'Muntik na! · Almost! Try the boss stage again',
      missLine: function (r, n, need) { return r + ' sa ' + n + ' ang tama · ' + r + ' of ' + n + ' right · kailangan ' + need + ' · you need ' + need; },
      missNext: 'Pindutin ang Try Again · Tap Try Again when you\'re ready',
      beatTitle: 'Natalo mo ang Boss! · You beat the Weekly Boss!',
      beatNext: 'Bagong boss sa Lunes · New boss on Monday',
      halfTitle: function (c, n) { return 'Boss noong nakaraang linggo: ' + c + ' sa ' + n + ' · Last week\'s boss: ' + c + ' of ' + n + ' stages'; },
      halfNext: 'May bagong boss! · A new boss is here!',
      coins: coinsEn
    }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function weekKey(ms) {
    var d = new Date(ms);
    return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7));
  }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function strings(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; }
  function clearedCount(stages) { return stages.filter(function (s) { return s.cleared; }).length; }

  function read(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    var ok = isObj(d) && d.v === 1;
    return {
      v: 1,
      week: ok && typeof d.week === 'string' ? d.week : '',
      stages: ok && Array.isArray(d.stages) ? d.stages.filter(function (s) { return isObj(s) && typeof s.app === 'string'; })
        .map(function (s) { return { app: s.app, title: typeof s.title === 'string' ? s.title : s.app, cleared: s.cleared === true }; }) : [],
      paid: ok ? strings(d.paid) : []
    };
  }

  // The lobby cards whose game has at least 3 review boxes (or 1 skill box, for Math), most due first, then most
  // boxes in 1-2, then at random.
  function rank(cards, items, due, random) {
    var stats = {};
    Object.keys(items || {}).forEach(function (k) {
      var it = items[k], cut = k.indexOf('|');
      if (cut < 1 || !isObj(it) || it.gone || !(it.box >= 1 && it.box <= 5)) return;
      var app = k.slice(0, cut), s = stats[app] || (stats[app] = { n: 0, skills: 0, weak: 0 });
      s.n++;
      if (k.indexOf('|skill:') === cut) s.skills++;
      if (it.box <= 2) s.weak++;
    });
    return cards.filter(function (c) { var s = stats[c.app]; return s && (s.n >= MIN_BOXES || s.skills >= 1); })
      .map(function (c) { return { card: c, due: (due && due[c.app]) || 0, weak: stats[c.app].weak, r: random() }; })
      .sort(function (a, b) { return b.due - a.due || b.weak - a.weak || a.r - b.r; })
      .map(function (x) { return x.card; });
  }

  function linkFor(app, cards) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].app === app) return cards[i].href + (cards[i].href.indexOf('?') >= 0 ? '&' : '?') + 'boss=1';
    }
    return null;
  }

  function parentLine(state, nowMs) {
    if (state.week !== weekKey(nowMs) || !state.stages.length) return '🐉 Weekly boss: not started';
    var c = clearedCount(state.stages), n = state.stages.length;
    return c === n ? '🐉 Weekly boss: beaten' : '🐉 Weekly boss: ' + c + ' of ' + n + ' stages';
  }

  // deps: { items() -> review_v1 items, due() -> { app: count }, bonus(coins) -> true when paid, random?() }
  function create(storage, now, grade, deps) {
    if (!Object.prototype.hasOwnProperty.call(STAGES, grade || '')) throw new Error('Boss needs a grade like "grade5".');
    var T = TEXT[grade], random = deps.random || Math.random;

    function save(state) { try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
    function paidFor(state, week) { return state.paid.some(function (p) { return p.indexOf(week + '|') === 0; }); }

    // Mark and save first, then pay: a failed save never leaves coins without a mark, a failed payment leaves no mark.
    function pay(state, mark, coins) {
      state.paid = state.paid.concat([mark]).slice(-KEEP_PAID);
      function unmark() { state.paid = state.paid.filter(function (p) { return p !== mark; }); }
      if (!save(state)) { unmark(); return false; }
      if (deps.bonus(coins)) return true;
      unmark();
      save(state);
      return false;
    }

    // Whichever device or sync cleared the last stage, the whole boss is paid once.
    function payFull(state) {
      var n = state.stages.length;
      if (!n || clearedCount(state.stages) < n || paidFor(state, state.week)) return [];
      if (!pay(state, state.week + '|full', FULL_COINS)) return [];
      return [{ big: true, icon: '🐉', title: T.beatTitle, line: T.coins(FULL_COINS), next: T.beatNext }];
    }

    function current() {
      var state = read(storage);
      return state.week === weekKey(now()) ? state : { v: 1, week: weekKey(now()), stages: [], paid: state.paid };
    }

    function ensure(cards) {
      var state = read(storage), week = weekKey(now()), events = [];
      if (state.week && state.week !== week) {
        var n = state.stages.length, c = clearedCount(state.stages);
        if (state.week < week && n && !paidFor(state, state.week)) {
          if (c === n) events = payFull(state);
          else if (c >= Math.ceil(n / 2) && pay(state, state.week + '|half', HALF_COINS)) {
            events.push({ big: false, icon: '🐉', title: T.halfTitle(c, n), line: T.coins(HALF_COINS), next: T.halfNext });
          }
        }
        state.week = '';
        state.stages = [];
      }
      if (state.week === week && state.stages.length) return payFull(state);
      var picked = rank(cards || [], deps.items() || {}, deps.due() || {}, random).slice(0, STAGES[grade]);
      state.week = week;
      state.stages = picked.length >= MIN_STAGES ? picked.map(function (p) { return { app: p.app, title: p.title, cleared: false }; }) : [];
      save(state);
      return events;
    }

    function stageResult(app, right, total) {
      var state = read(storage);
      if (state.week !== weekKey(now()) || !total) return [];
      var stage = state.stages.filter(function (s) { return s.app === app; })[0];
      if (!stage || stage.cleared) return [];
      var need = Math.ceil(total * 2 / 3);
      if (right < need) return [{ big: false, icon: '⚔️', title: T.missTitle, line: T.missLine(right, total, need), next: T.missNext }];
      stage.cleared = true;
      if (!save(state)) return [];
      var open = state.stages.filter(function (s) { return !s.cleared; });
      var hit = { big: false, icon: '⚔️', title: T.hitTitle(stage.title), line: T.hp(clearedCount(state.stages), state.stages.length),
        next: T.hitNext(open.length ? open[0].title : null) };
      return payFull(state).concat([hit]);
    }

    return {
      text: T,
      STAGE_SIZE: STAGE_SIZE,
      ensure: ensure,
      stageResult: stageResult,
      current: current,
      isStage: function (app) { return current().stages.some(function (s) { return s.app === app && !s.cleared; }); }
    };
  }

  var UI_CSS =
    '.boss{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#F3ECFF;color:#3B2363;font-weight:800;}' +
    '.boss[hidden]{display:none;}' +
    '.boss-title{margin:0 0 8px;}' +
    '.boss-hp{height:12px;margin:0 0 4px;border-radius:999px;background:#E0D4F7;overflow:hidden;}' +
    '.boss-hp span{display:block;height:100%;background:#7C4DDB;}' +
    '.boss-count{margin:0 0 8px;font-size:.9rem;}' +
    '.boss-list{margin:0;padding:0;list-style:none;display:grid;gap:6px;}' +
    '.boss-list li{display:flex;gap:8px;align-items:center;font-size:.95rem;}' +
    '.boss-list a{color:inherit;text-decoration:underline;text-underline-offset:3px;}' +
    '.boss-list a:focus-visible{outline:3px solid #3B2363;outline-offset:2px;border-radius:6px;}' +
    '.boss-list .done{opacity:.6;}';

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

    core.renderLobby = function (box, cards) {
      if (!box) return;
      var stages = core.current().stages, n = stages.length, c = clearedCount(stages);
      box.innerHTML = '';
      box.hidden = false;
      box.appendChild(el('p', 'boss-title', !n ? T.none : c === n ? T.beaten : T.cardTitle));
      if (!n) return;
      var bar = el('div', 'boss-hp'), fill = el('span');
      fill.style.width = Math.round((n - c) / n * 100) + '%';
      bar.setAttribute('aria-hidden', 'true');
      bar.appendChild(fill);
      box.appendChild(bar);
      box.appendChild(el('p', 'boss-count', T.hp(c, n)));
      var list = el('ul', 'boss-list');
      stages.forEach(function (s) {
        var li = el('li'), href = s.cleared ? null : linkFor(s.app, cards || []);
        li.appendChild(el('span', '', s.cleared ? '✅' : '⚔️'));
        if (href) {
          var a = el('a', '', s.title);
          a.href = href;
          li.appendChild(a);
        } else {
          li.appendChild(el('span', s.cleared ? 'done' : '', s.title));
        }
        list.appendChild(li);
      });
      box.appendChild(list);
    };
    return core;
  }

  var exported = { create: create, read: read, rank: rank, weekKey: weekKey, linkFor: linkFor, parentLine: parentLine,
    TEXT: TEXT, KEY: KEY, STAGES: STAGES, STAGE_SIZE: STAGE_SIZE, FULL_COINS: FULL_COINS, HALF_COINS: HALF_COINS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies and games get the boss for their grade; the parent page (no data-grade) gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && STAGES[grade]) {
      var storage = root.Learner ? root.Learner.storage : root.localStorage;
      api = mountUi(root, create(storage, Date.now, grade, {
        items: function () {
          try { var d = JSON.parse(storage.getItem('review_v1')); return d && isObj(d.items) ? d.items : {}; } catch (e) { return {}; }
        },
        due: function () { return root.Recall && root.Recall.dueByApp ? root.Recall.dueByApp() : {}; },
        bonus: function (coins) {
          var W = root.Wallet;
          if (!W || !W.addBonus || !W.addBonus(coins)) return false;
          if (W.renderCoins) W.renderCoins();
          return true;
        }
      }));
      api.wantsBoss = /(^|[?&])boss=1(&|$)/.test(root.location ? root.location.search : '');
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Boss = api;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test tests/boss.test.js`
Expected: every test passes.

- [ ] **Step 5: Register the file**

In `tests/paths.js`, add `'boss.js'` to `ENGINE_FILES` right after `'quests.js'`:

```js
const ENGINE_FILES = ['storage.js', 'learner.js', 'nav.js', 'search.js', 'read-gate.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'quests.js', 'boss.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'parent-panel.js'];
```

Then run: `node tools/update-precache.js`
Expected: `web/sw.js precaches N files`, and `engine/boss.js` is now in PRECACHE.

- [ ] **Step 6: Run the whole unit suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 7: Commit (the user runs it)**

```bash
git add web/engine/boss.js tests/boss.test.js tests/paths.js web/sw.js
git commit -m "Add the weekly boss engine: Monday weeks, stages picked from the games with the most due and weakest review boxes, 2 of 3 right clears a stage, 10 coins for every stage and 4 for at least half"
```

---

### Task 2: Boss pickers in `recall.js`

**Files:**
- Modify: `web/engine/recall.js` (the object returned by `create`, around lines 266-352)
- Test: `tests/recall.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the end of `tests/recall.test.js`. The helpers `memory`, `clock`, `info`, `pool` and `setItem` already exist in that file.

```js
test('pickBoss: due questions first, then the lowest boxes even when not due, most recently answered first', () => {
  const s = memory(), p = pool(7);
  setItem(s, 'a', p[0], 3, '2026-10-01');
  setItem(s, 'a', p[1], 2, '2026-09-28');
  setItem(s, 'a', p[2], 1, '2026-10-03', 5);
  setItem(s, 'a', p[3], 1, '2026-10-03', 9);
  setItem(s, 'a', p[4], 4, '2026-10-20');
  setItem(s, 'a', p[5], 2, '2026-10-04');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.pickBoss('a', p, info, 3).map((q) => q.q), ['Q1', 'Q0', 'Q3']);
  assert.deepEqual(r.pickBoss('a', p, info, 6).map((q) => q.q), ['Q1', 'Q0', 'Q3', 'Q2', 'Q5', 'Q4']);
  assert.deepEqual(r.pickBoss('a', [p[6]], info, 3), [], 'a question with no box is never picked');
  assert.deepEqual(r.pickBoss('a', [p[0], p[0]], info, 3).map((q) => q.q), ['Q0'], 'once each');
});

test('weakestSkill: the most overdue due skill, otherwise the lowest box, then the earliest due', () => {
  const s = memory({ review_v1: JSON.stringify({ v: 1, items: {
    'm|skill:a': { box: 2, due: '2026-10-09', t: 1 }, 'm|skill:b': { box: 1, due: '2026-10-05', t: 1 },
    'm|skill:c': { box: 1, due: '2026-10-04', t: 1 },
  } }) });
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.weakestSkill('m', ['a', 'b', 'c', 'd']), ['c']);
  const d = JSON.parse(s.data.review_v1);
  d.items['m|skill:d'] = { box: 3, due: '2026-10-01', t: 1 };
  s.data.review_v1 = JSON.stringify(d);
  assert.deepEqual(r.weakestSkill('m', ['a', 'b', 'c', 'd']), ['d'], 'a due skill comes first');
  assert.deepEqual(r.weakestSkill('m', ['x']), []);
});
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `node --test tests/recall.test.js`
Expected: FAIL with `r.pickBoss is not a function`.

- [ ] **Step 3: Implement**

In `web/engine/recall.js`, inside `create`, turn the body of `skillsDue` into a local function so `weakestSkill` can reuse it. Add this just above `return {` (around line 218):

```js
    function skillsDue(app, ids, limit) {
      var t = today();
      return ids.map(function (id) { return { id: id, it: item(app + '|skill:' + id) }; })
        .filter(function (s) { return isDue(s.it, t); })
        .sort(function (a, b) { return dayNumber(a.it.due) - dayNumber(b.it.due) || a.it.box - b.it.box; })
        .slice(0, limit || 3)
        .map(function (s) { return s.id; });
    }
```

Replace the existing `skillsDue: function (app, ids, limit) { ... }` entry in the returned object with:

```js
      skillsDue: skillsDue,

      // A boss stage: Math's due skill, otherwise the skill in the lowest box.
      weakestSkill: function (app, ids) {
        var due = skillsDue(app, ids, 1);
        if (due.length) return due;
        var best = null;
        ids.forEach(function (id) {
          var it = item(app + '|skill:' + id);
          if (it && (!best || it.box < best.it.box || (it.box === best.it.box && dayNumber(it.due) < dayNumber(best.it.due)))) best = { id: id, it: it };
        });
        return best ? [best.id] : [];
      }
```

Add `pickBoss` right after `pickDue` in the returned object:

```js
      // A boss stage: due questions first, then the lowest boxes even when not due yet (those rest, so they pay 0).
      pickBoss: function (app, questions, info, n) {
        var items = load().items, t = today(), seen = {}, due = [], rest = [];
        questions.forEach(function (q) {
          var key = keyOf(app, info(q)), it = items[key];
          if (seen[key] || !valid(it)) return;
          seen[key] = true;
          (isDue(it, t) ? due : rest).push({ q: q, late: t - dayNumber(it.due), box: it.box, at: it.t, r: Math.random() });
        });
        due.sort(function (a, b) { return b.late - a.late || a.box - b.box || a.r - b.r; });
        rest.sort(function (a, b) { return a.box - b.box || b.at - a.at || a.r - b.r; });
        return due.concat(rest).slice(0, n || 3).map(function (d) { return d.q; });
      },
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test tests/recall.test.js`
Expected: all pass, including the existing `skillsDue` test.

- [ ] **Step 5: Commit (the user runs it)**

```bash
git add web/engine/recall.js tests/recall.test.js
git commit -m "Add boss pickers to review: due questions first then the weakest boxes, and Math's weakest skill"
```

---

### Task 3: Sync the boss

**Files:**
- Modify: `web/engine/sync-core.js` (`kindOf` around line 31, `MERGE` around line 91, `readLocal` / `writeLocal` around lines 220 and 235)
- Test: `tests/sync.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the end of `tests/sync.test.js`. `fakeCloud` and `device` already exist in that file.

```js
const bossStage = (app, cleared) => ({ app, title: app.toUpperCase(), cleared });

test('boss: the later week wins; in one week a stage cleared anywhere is cleared and pay marks add up', () => {
  const a = { v: 1, week: '2026-10-05', stages: [bossStage('x', true), bossStage('y', false)], paid: ['2026-09-28|half'] };
  const b = { v: 1, week: '2026-10-05', stages: [bossStage('x', false), bossStage('y', true)], paid: ['2026-10-05|full'] };
  const want = { v: 1, week: '2026-10-05', stages: [bossStage('x', true), bossStage('y', true)], paid: ['2026-09-28|half', '2026-10-05|full'] };
  assert.deepEqual(MERGE.boss(a, b), want);
  assert.deepEqual(MERGE.boss(b, a), want);
  assert.deepEqual(MERGE.boss(MERGE.boss(a, b), b), want, 'safe to repeat');
  const old = { v: 1, week: '2026-09-28', stages: [bossStage('z', true)], paid: ['2026-09-21|full'] };
  assert.deepEqual(MERGE.boss(a, old).stages, a.stages);
  assert.deepEqual(MERGE.boss(old, a).stages, a.stages);
  assert.deepEqual(MERGE.boss(old, a).paid, ['2026-09-21|full', '2026-09-28|half']);
  assert.equal(kindOf('boss_v1'), 'boss');
  assert.equal(MERGE.boss('nope', null), null);
});

test('boss: two devices that picked different stages keep the list with more cleared, in either order', () => {
  const week = '2026-10-05';
  const a = { v: 1, week, stages: [bossStage('x', true), bossStage('y', false)], paid: [] };
  const b = { v: 1, week, stages: [bossStage('p', false), bossStage('q', false)], paid: [] };
  assert.deepEqual(MERGE.boss(a, b).stages, a.stages);
  assert.deepEqual(MERGE.boss(b, a).stages, a.stages);
  const c = { v: 1, week, stages: [bossStage('p', true), bossStage('q', false)], paid: [] };
  assert.deepEqual(MERGE.boss(a, c).stages, c.stages, 'a tie goes to the smaller app list');
  assert.deepEqual(MERGE.boss(c, a).stages, c.stages);
  const empty = { v: 1, week, stages: [], paid: [] };
  assert.deepEqual(MERGE.boss(empty, b).stages, b.stages, 'a picked list beats no list');
  assert.deepEqual(MERGE.boss(b, empty).stages, b.stages);
});

test('the boss travels to a second device', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  a.s.setItem('boss_v1', JSON.stringify({ v: 1, week: '2026-10-05', stages: [bossStage('x', true), bossStage('y', false)], paid: [] }));
  await a.sync();
  await b.sync();
  assert.deepEqual(JSON.parse(b.s.getItem('boss_v1')).stages, [bossStage('x', true), bossStage('y', false)]);
});
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `node --test tests/sync.test.js`
Expected: FAIL with `MERGE.boss is not a function`.

- [ ] **Step 3: Implement**

In `kindOf`, add after the `quests_v1` line:

```js
    if (key === 'boss_v1') return 'boss';
```

Add these helpers just above `var MERGE = {` (next to `questIds`):

```js
  function bossStages(v) {
    return (Array.isArray(v) ? v : []).filter(function (s) { return isObj(s) && typeof s.app === 'string'; })
      .map(function (s) { return { app: s.app, title: typeof s.title === 'string' ? s.title : s.app, cleared: s.cleared === true }; });
  }
  function bossCleared(list) { return list.filter(function (s) { return s.cleared; }).length; }
  function bossApps(list) { return JSON.stringify(list.map(function (s) { return s.app; })); }
```

Add this rule to `MERGE`, right after `quests`:

```js
    // Weekly boss: the later week wins. In one week a picked list beats an empty one, then the list with more
    // cleared stages, then the smaller app list. A stage cleared on either copy is cleared, and pay marks add up.
    boss: function (a, b) {
      a = isObj(a) ? a : null;
      b = isObj(b) ? b : null;
      if (!a || !b) return a || b;
      var paid = union(a.paid, b.paid, 60);
      if (dnum(a.week) !== dnum(b.week)) {
        var newer = dnum(a.week) > dnum(b.week) ? a : b;
        return { v: 1, week: newer.week, stages: bossStages(newer.stages), paid: paid };
      }
      var sa = bossStages(a.stages), sb = bossStages(b.stages), keep;
      if (!sa.length || !sb.length) keep = sa.length ? sa : sb;
      else if (bossCleared(sa) !== bossCleared(sb)) keep = bossCleared(sa) > bossCleared(sb) ? sa : sb;
      else keep = bossApps(sa) <= bossApps(sb) ? sa : sb;
      var done = {};
      (keep === sa ? sb : sa).forEach(function (s) { if (s.cleared) done[s.app] = true; });
      return { v: 1, week: typeof a.week === 'string' ? a.week : '', stages: keep.map(function (s) {
        return { app: s.app, title: s.title, cleared: s.cleared || !!done[s.app] };
      }), paid: paid };
    },
```

In `readLocal` and `writeLocal`, add `kind === 'boss'` to both JSON-kind conditions. Both lines become:

```js
      if (kind === 'recall' || kind === 'review' || kind === 'quests' || kind === 'boss' || kind === 'mastery' || kind === 'profile' || kind === 'requests') return json(space.getItem(key), null);
```

```js
      } else if (kind === 'recall' || kind === 'review' || kind === 'quests' || kind === 'boss' || kind === 'mastery' || kind === 'profile' || kind === 'requests') {
```

Then run `grep -n "'requests'" web/engine/sync-core.js`. If any other line lists the JSON kinds, add `'boss'` there too.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test tests/sync.test.js`
Expected: all pass.

- [ ] **Step 5: Commit (the user runs it)**

```bash
git add web/engine/sync-core.js tests/sync.test.js
git commit -m "Sync the weekly boss: the later week wins, cleared stages and pay marks add up across devices"
```

---

### Task 4: Wire the boss into all 17 games

**Files:**
- Modify: every `web/subjects/grade-*/*/index.html` (17 files), through a one-off script
- Create: `tests/boss-wiring.test.js`
- Modify: `tests/review-wiring.test.js`, `tests/mastery-wiring.test.js`

What changes in each game:
1. Load `boss.js` after `quests.js`.
2. `startReview(boss)`: with `boss` true, it picks with `Recall.pickBoss` (Math: `Recall.weakestSkill`) and titles the round with `Boss.text.stageTitle`. `currentQuizMeta.boss` is true, and `currentQuizMeta.id` stays `'review'`, so history kind, retry and Math's skill bonus behave as in a review.
3. Every other `Recall.text.reviewTitle` inside `startReview` becomes `currentQuizMeta.title`.
4. Retry calls `startReview(bossAgain())`.
5. `bossEvents(el)` adds the stage result to the `Fx.celebrate` call in `showMedals`, once per round.
6. `?boss=1` starts the boss round when that game is an open stage.
7. Family B: the review button listener must not pass the click event as `boss`.

- [ ] **Step 1: Write the failing wiring test**

Create `tests/boss-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const FAMILY_B = ['byte-buddies', 'word-train', 'growing-good', 'batang-bayani', 'science-detectives'];

for (const app of APPS) {
  test(app.id + ' plays boss stages', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const tag = '<script src="../../../engine/boss.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads boss.js');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/quests.js"'), 'after quests.js');
    assert.equal(count(html, 'function startReview(boss){'), 1);
    if (app.id === 'math-mastery') {
      assert.equal(count(html, 'const ids = boss ? Recall.weakestSkill(SH_APP, LESSONS.map(l => l.id)) : Recall.skillsDue(SH_APP, LESSONS.map(l => l.id), REVIEW_SKILLS);'), 1);
    } else {
      assert.equal(count(html, 'currentQuizSet = boss ? Recall.pickBoss(SH_APP, reviewPool(), reviewInfo, Boss.STAGE_SIZE) : Recall.pickDue(SH_APP, reviewPool(), reviewInfo);'), 1);
    }
    assert.equal(count(html, 'title: boss ? Boss.text.stageTitle : Recall.text.reviewTitle, boss: !!boss'), 1, 'boss title and flag');
    assert.equal(count(html, 'Recall.text.reviewTitle'), 1, 'the round title comes from currentQuizMeta');
    assert.equal(count(html, "'review', currentQuizMeta.title, false, currentQuizSet.length, 'review')"), 1, 'history kind review');
    assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview(bossAgain());"), 1, 'retry');
    assert.equal(count(html, 'function bossEvents(el){'), 1);
    assert.equal(count(html, 'function bossAgain(){'), 1);
    const score = FAMILY_B.includes(app.id) ? 'score' : 'quizScore';
    assert.equal(count(html, 'return Boss.stageResult(SH_APP, ' + score + ', currentQuizSet.length);'), 1, 'reports the stage');
    assert.equal(count(html, '.concat(window.Quests && Quests.check ? Quests.check() : []).concat(bossEvents(el)), el);'), 1, 'joins the popup');
    assert.equal(count(html, 'else if (window.Recall && window.Boss && Boss.wantsBoss && Boss.isStage(SH_APP)) startReview(true);'), 1, '?boss=1');
    assert.ok(html.indexOf('Boss.wantsBoss') > html.indexOf('Recall.wantsReview'), 'right after the review check');
    assert.ok(!html.includes("addEventListener('click', startReview)"), 'a click event is never taken for the boss flag');
  });
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/boss-wiring.test.js`
Expected: 17 failures (`loads boss.js`).

- [ ] **Step 3: Write and run the wiring script**

Write this to the scratchpad as `wire-boss.js` (not into the repo). It changes each game in place, and it stops at the first edit that does not match exactly once.

```js
// One-off: wires the weekly boss into every game. Run: node <scratchpad>/wire-boss.js <repo root>
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(process.argv[2]);
const { APPS, appFile } = require(path.join(ROOT, 'tests', 'paths.js'));

const FAMILY_B = ['byte-buddies', 'word-train', 'growing-good', 'batang-bayani', 'science-detectives'];

function once(html, from, to, what) {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(what + ': expected 1 match, found ' + n);
  return html.replace(from, () => to);
}

for (const app of APPS) {
  const file = appFile(app.id);
  const b = FAMILY_B.includes(app.id), ind = b ? '  ' : '', score = b ? 'score' : 'quizScore', id = app.id;
  let h = fs.readFileSync(file, 'utf8');

  const qtag = '<script src="../../../engine/quests.js" data-grade="grade' + app.grade + '"></script>';
  h = once(h, qtag, qtag + '\n<script src="../../../engine/boss.js" data-grade="grade' + app.grade + '"></script>', id + ' tag');

  h = once(h, ind + 'function startReview(){', ind + 'function startReview(boss){', id + ' signature');

  if (id === 'math-mastery') {
    h = once(h, 'const ids = Recall.skillsDue(SH_APP, LESSONS.map(l => l.id), REVIEW_SKILLS);',
      'const ids = boss ? Recall.weakestSkill(SH_APP, LESSONS.map(l => l.id)) : Recall.skillsDue(SH_APP, LESSONS.map(l => l.id), REVIEW_SKILLS);', id + ' skills');
  } else {
    h = once(h, 'currentQuizSet = Recall.pickDue(SH_APP, reviewPool(), reviewInfo);',
      'currentQuizSet = boss ? Recall.pickBoss(SH_APP, reviewPool(), reviewInfo, Boss.STAGE_SIZE) : Recall.pickDue(SH_APP, reviewPool(), reviewInfo);', id + ' pick');
  }

  const tight = "currentQuizMeta = {id:'review', title:Recall.text.reviewTitle};";
  const spaced = "currentQuizMeta = { id: 'review', title: Recall.text.reviewTitle };";
  if (h.includes(tight)) h = once(h, tight, "currentQuizMeta = {id:'review', title: boss ? Boss.text.stageTitle : Recall.text.reviewTitle, boss: !!boss};", id + ' meta');
  else h = once(h, spaced, "currentQuizMeta = { id: 'review', title: boss ? Boss.text.stageTitle : Recall.text.reviewTitle, boss: !!boss };", id + ' meta');

  h = once(h, "'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review')",
    "'review', currentQuizMeta.title, false, currentQuizSet.length, 'review')", id + ' history');

  const quizTitle = "document.getElementById('quizTitle').textContent = Recall.text.reviewTitle;";
  if (h.includes(quizTitle)) h = once(h, quizTitle, "document.getElementById('quizTitle').textContent = currentQuizMeta.title;", id + ' quiz title');

  h = once(h, "if (currentQuizMeta.id === 'review') return startReview();",
    "if (currentQuizMeta.id === 'review') return startReview(bossAgain());", id + ' retry');

  const listener = "reviewBtn.addEventListener('click', startReview);";
  if (h.includes(listener)) h = once(h, listener, "reviewBtn.addEventListener('click', function () { startReview(); });", id + ' listener');

  h = once(h, '.concat(window.Quests && Quests.check ? Quests.check() : []), el);',
    '.concat(window.Quests && Quests.check ? Quests.check() : []).concat(bossEvents(el)), el);', id + ' celebrate');

  const badge = ind + 'function medalBadge(';
  const helpers =
    ind + '// A finished boss stage reports once; Try Again replays it only while the stage is still open.\n' +
    ind + 'function bossEvents(el){\n' +
    ind + "  if (el.id !== 'points-earned' || !currentQuizMeta || !currentQuizMeta.boss || currentQuizMeta.bossDone || !window.Boss) return [];\n" +
    ind + '  currentQuizMeta.bossDone = true;\n' +
    ind + '  return Boss.stageResult(SH_APP, ' + score + ', currentQuizSet.length);\n' +
    ind + '}\n' +
    ind + 'function bossAgain(){\n' +
    ind + '  return !!(currentQuizMeta.boss && window.Boss && Boss.isStage(SH_APP));\n' +
    ind + '}\n';
  h = once(h, badge, helpers + badge, id + ' helpers');

  const entry = ind + 'if (window.Recall && Recall.wantsReview) startReview();';
  h = once(h, entry, entry + '\n' + ind + 'else if (window.Recall && window.Boss && Boss.wantsBoss && Boss.isStage(SH_APP)) startReview(true);', id + ' entry');

  fs.writeFileSync(file, h);
  console.log('wired ' + id);
}
```

`bossEvents` checks `el.id` first. That matters because games call `showMedals` on load (for `points-total-badge`) before `currentQuizMeta` may exist.

Run: `node <scratchpad>/wire-boss.js .`
Expected: 17 lines of `wired <id>` and no error.

- [ ] **Step 4: Update the two older wiring tests to the new lines**

In `tests/review-wiring.test.js`, replace the history and retry assertions in **both** the per-game test and the `math-mastery` test.

Replace:
```js
    assert.equal(count(html, "'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review')"), 1, 'history kind review');
```
with:
```js
    assert.equal(count(html, "'review', currentQuizMeta.title, false, currentQuizSet.length, 'review')"), 1, 'history kind review');
```

Replace:
```js
    assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview();"), 1, 'retry replays review');
```
with:
```js
    assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview(bossAgain());"), 1, 'retry replays review');
```

In the `math-mastery` test, do the same two replacements on its lines:

```js
  assert.equal(count(html, "'review', currentQuizMeta.title, false, currentQuizSet.length, 'review')"), 1);
```

```js
  assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview(bossAgain());"), 1);
```

In `tests/mastery-wiring.test.js`, change the celebrate assertion to:

```js
    assert.equal(count(html, "if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE).concat(window.Quests && Quests.check ? Quests.check() : []).concat(bossEvents(el)), el);"), 1, 'celebrates milestones');
```

- [ ] **Step 5: Run the unit suite**

Run: `node --test`
Expected: all pass, including the 17 new boss-wiring tests.

- [ ] **Step 6: Run the e2e game suites to check nothing else broke**

Run: `node tests/e2e/apps-e2e.js` then `node tests/e2e/apps-e2e.js 5`
Expected: `All 7 apps passed` and `All 10 apps passed`. The boss modes come in Task 6.

- [ ] **Step 7: Commit (the user runs it)**

```bash
git add web/subjects tests/boss-wiring.test.js tests/review-wiring.test.js tests/mastery-wiring.test.js
git commit -m "Play boss stages in every game: ?boss=1 starts a 3-question review from the boss pick, and the stage result joins the round's popup"
```

---

### Task 5: The lobby card and the parent line

**Files:**
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html`
- Modify: `web/parent/index.html`, `web/parent/phone.js`
- Modify: `tests/boss-wiring.test.js`, `tests/browser-globals.test.js`, `tests/english-everywhere.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/boss-wiring.test.js`:

```js
for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby shows the weekly boss', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/boss.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/quests.js"'), 'after quests.js');
    assert.equal(count(html, '<div class="boss" id="boss" hidden></div>'), 1);
    assert.ok(html.indexOf('id="boss"') > html.indexOf('id="quests"'), 'under the quests');
    assert.equal(count(html, 'events = Boss.ensure(cards);'), 1);
    assert.equal(count(html, "Boss.renderLobby(document.getElementById('boss'), cards);"), 1);
    assert.equal(count(html, 'events = Quests.check().concat(events);'), 1, 'one popup for quests and the boss');
  });
}

test('the parent phone page shows the boss line', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'parent', 'index.html'), 'utf8');
  assert.equal(count(html, '<script src="../engine/boss.js"></script>'), 1);
  assert.equal(count(html, '<p class="p-note" id="kid-boss"></p>'), 1);
  const js = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'parent', 'phone.js'), 'utf8');
  assert.equal(count(js, "$('kid-boss').textContent = window.Boss ? Boss.parentLine(Boss.read(child.space), Date.now()) : '';"), 1);
});
```

Append to `tests/browser-globals.test.js`:

```js
test('the parent page can show a child\'s boss line', () => {
  const win = browser('storage.js', 'boss.js');
  const s = win.StudyStore.memorySpace('kid');
  s.put('boss_v1', JSON.stringify({ v: 1, week: '2026-10-05', stages: [{ app: 'a', title: 'A', cleared: true }, { app: 'b', title: 'B', cleared: false }], paid: [] }));
  assert.equal(win.Boss.parentLine(win.Boss.read(s), new Date(2026, 9, 6, 9).getTime()), '🐉 Weekly boss: 1 of 2 stages');
  assert.equal(win.Boss.ensure, undefined, 'no grade: no lobby or game helpers');
});
```

Append to `tests/english-everywhere.test.js`:

```js
test('every Grade 2 boss line has English', () => {
  const { TEXT } = require(engineFile('boss.js'));
  const t = TEXT.grade2;
  [t.stageTitle, t.cardTitle, t.hp(1, 3), t.beaten, t.none, t.hitTitle('Kuwentista'), t.hitNext('Kuwentista'), t.hitNext(null),
    t.missTitle, t.missLine(1, 3, 2), t.missNext, t.beatTitle, t.beatNext, t.halfTitle(2, 3), t.halfNext]
    .forEach((line) => hasEnglishWhereFilipino(line, 'boss text'));
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test tests/boss-wiring.test.js tests/browser-globals.test.js tests/english-everywhere.test.js`
Expected: the 2 lobby tests and the phone test FAIL. The browser-globals and English tests may already pass, because Task 1 built `boss.js`.

- [ ] **Step 3: Wire both lobbies**

In each of `web/lobby/grade-5.html` and `web/lobby/grade-2.html`:

(a) After `<div class="quests" id="quests" hidden></div>` add:

```html
  <div class="boss" id="boss" hidden></div>
```

(b) After the `quests.js` script tag add (use `grade2` in the Grade 2 lobby):

```html
<script src="../engine/boss.js" data-grade="grade5"></script>
```

(c) Replace the whole `showQuests` function:

```js
  function showQuests(){
    if (!window.Quests || !Quests.pick) return;
    var box = document.getElementById('quests');
    var cards = Array.prototype.map.call(document.querySelectorAll('.subject-card[data-app]'), function(c){
      var name = c.querySelector('.subject-app') || c.querySelector('.subject-title');
      return { app: c.getAttribute('data-app'), title: name ? name.textContent.trim() : c.getAttribute('data-app'), href: c.getAttribute('href') };
    });
    Quests.pick(cards);
    var events = Quests.check();
    Quests.renderLobby(box, cards);
    if (events.length && window.Fx && Fx.celebrate) Fx.celebrate(events, box);
  }
```

with:

```js
  function showQuests(){
    var box = document.getElementById('quests');
    var cards = Array.prototype.map.call(document.querySelectorAll('.subject-card[data-app]'), function(c){
      var name = c.querySelector('.subject-app') || c.querySelector('.subject-title');
      return { app: c.getAttribute('data-app'), title: name ? name.textContent.trim() : c.getAttribute('data-app'), href: c.getAttribute('href') };
    });
    var events = [];
    if (window.Boss && Boss.ensure) {
      events = Boss.ensure(cards);
      Boss.renderLobby(document.getElementById('boss'), cards);
    }
    if (window.Quests && Quests.pick) {
      Quests.pick(cards);
      events = Quests.check().concat(events);
      Quests.renderLobby(box, cards);
    }
    if (events.length && window.Fx && Fx.celebrate) Fx.celebrate(events, box.hidden ? document.getElementById('boss') : box);
  }
```

The existing `cloud-synced` and `pageshow` listeners already call `showQuests`, so the boss card redraws with them.

- [ ] **Step 4: Wire the parent phone page**

In `web/parent/index.html`, after `<p class="p-note" id="kid-streak"></p>` add:

```html
    <p class="p-note" id="kid-boss"></p>
```

After `<script src="../engine/quests.js"></script>` add:

```html
<script src="../engine/boss.js"></script>
```

In `web/parent/phone.js`, inside `renderCoins`, after the `$('kid-streak').textContent = …` line add:

```js
    $('kid-boss').textContent = window.Boss ? Boss.parentLine(Boss.read(child.space), Date.now()) : '';
```

- [ ] **Step 5: Run the unit suite**

Run: `node --test`
Expected: all pass. If `tests/pages.test.js` complains about the parent page's script list, follow its message, for example a file-check entry, and rerun.

- [ ] **Step 6: Commit (the user runs it)**

```bash
git add web/lobby web/parent tests/boss-wiring.test.js tests/browser-globals.test.js tests/english-everywhere.test.js
git commit -m "Show the weekly boss in both lobbies under today's quests, with its HP bar and stage links, and a boss line on the parent phone page"
```

---

### Task 6: E2E checks

**Files:**
- Modify: `tests/e2e/driver-common.page.js`, `tests/e2e/driver-family-a.page.js`, `tests/e2e/driver-family-b.page.js`, `tests/e2e/driver-family-c.page.js`, `tests/e2e/driver-math.page.js`
- Modify: `tests/e2e/apps-e2e.js`
- Modify: `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`

- [ ] **Step 1: Add the game driver**

Append to `tests/e2e/driver-common.page.js`:

```js
// A boss stage: this game and one already-cleared stage. A failed try keeps it open; Try Again and 3 right clear it
// and pay the whole boss, once.
function __e2eBoss(startLesson, next, retry) {
  var r = {};
  startLesson();
  for (var k = 0; k < currentQuizSet.length; k++) { __e2eAnswer(true); next(); }
  __store.setItem('boss_v1', JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [],
    stages: [{ app: SH_APP, title: SH_TITLE, cleared: false }, { app: 'other-app', title: 'Other', cleared: true }] }));
  var bonus = function () { return (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0; };
  var before = bonus(), pointsBefore = kit.totalPoints();
  r.isStage = Boss.isStage(SH_APP);
  startReview(true);
  r.title = currentQuizMeta.title;
  r.total = currentQuizSet.length;
  for (var j = 0; j < r.total; j++) { __e2eAnswer(false); next(); }
  r.missEvents = (Fx.queued() || []).filter(function (e) { return e.icon === '⚔️'; }).length;
  r.openAfterMiss = Boss.isStage(SH_APP);
  retry();
  r.retryBoss = !!currentQuizMeta.boss;
  for (var i = 0; i < currentQuizSet.length; i++) { __e2eAnswer(true); next(); }
  var queued = Fx.queued() || [];
  r.beat = queued.filter(function (e) { return e.icon === '🐉' && e.big; }).length;
  r.hit = queued.filter(function (e) { return e.icon === '⚔️'; }).length;
  r.coins = bonus() - before;
  r.points = kit.totalPoints() - pointsBefore;
  r.openAfter = Boss.isStage(SH_APP);
  r.paid = JSON.parse(__store.getItem('boss_v1')).paid;
  var quizzes = __e2eHistory().filter(function (e) { return e.type === 'quiz'; });
  r.kind = quizzes[quizzes.length - 1].kind;
  __e2eOut({ boss: r });
}
```

Add one line to each family driver, next to its `review` mode line:

`tests/e2e/driver-family-c.page.js`:
```js
  if (mode === 'boss') return __e2eBoss(function () { currentLessonIdx = 0; startQuiz(); }, nextQuestion, retryQuiz);
```

`tests/e2e/driver-family-a.page.js`:
```js
  if (mode === 'boss') return __e2eBoss(function () { currentLessonIdx = 0; startQuiz(); }, nextQuestion, retryLesson);
```

`tests/e2e/driver-family-b.page.js`:
```js
  if (mode === 'boss') return __e2eBoss(function () { currentLesson = 0; startQuiz(); }, function () { document.getElementById('btn-next').click(); }, function () { document.getElementById('btn-retry').click(); });
```

`tests/e2e/driver-math.page.js`, next to its `review` block:
```js
  if (mode === 'boss') {
    currentLessonIdx = 0; startQuiz();
    var bn = currentQuizSet.length;
    for (var bk = 0; bk < bn; bk++) { selectOption(currentQuizSet[quizIdx].correct); nextQuestion(); }
    var bskill = SH_APP + '|skill:' + LESSONS[0].id;
    __store.setItem('boss_v1', JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [],
      stages: [{ app: SH_APP, title: SH_TITLE, cleared: false }, { app: 'other-app', title: 'Other', cleared: false }] }));
    startReview(true);
    var btotal = currentQuizSet.length, btitle = currentQuizMeta.title;
    for (var bj = 0; bj < btotal; bj++) { selectOption(currentQuizSet[quizIdx].correct); nextQuestion(); }
    var bstate = JSON.parse(__store.getItem('boss_v1'));
    return __e2eOut({ boss: { title: btitle, total: btotal, cleared: bstate.stages[0].cleared, paid: bstate.paid,
      box: JSON.parse(__store.getItem('review_v1')).items[bskill].box,
      hit: (Fx.queued() || []).filter(function (e) { return e.icon === '⚔️'; }).length } });
  }
```

- [ ] **Step 2: Check the results in `apps-e2e.js`**

Near the `REVIEW_TITLE` line add:

```js
const BOSS_TITLE = require(engineFile('boss.js')).TEXT['grade' + grade].stageTitle;
```

Add these two functions next to `checkReview`:

```js
function checkBoss(out) {
  assert.deepEqual(out.errors, [], 'boss: page errors');
  const r = out.boss;
  assert.equal(r.isStage, true);
  assert.equal(r.title, BOSS_TITLE);
  assert.equal(r.total, 3, 'a stage is 3 questions');
  assert.equal(r.missEvents, 1, 'a failed stage says try again');
  assert.equal(r.openAfterMiss, true, 'and stays open');
  assert.equal(r.retryBoss, true, 'Try Again replays the boss stage');
  assert.equal(r.hit, 1, 'clearing it is a boss hit');
  assert.equal(r.beat, 1, 'the last stage beats the boss');
  assert.equal(r.coins, 10, 'the boss pays 10 coins once');
  assert.equal(r.paid.length, 1, 'one pay mark');
  assert.equal(r.openAfter, false);
  assert.equal(r.points, 0, 'none of these were due, so they rest and pay no points');
  assert.equal(r.kind, 'review', 'history logs a boss stage as a review round');
  console.log('  boss: cleared on retry, +10 coins');
}

function checkMathBoss(out) {
  assert.deepEqual(out.errors, [], 'boss: page errors');
  const r = out.boss;
  assert.equal(r.title, BOSS_TITLE);
  assert.equal(r.total, 3, 'one skill, 3 fresh problems');
  assert.equal(r.cleared, true);
  assert.equal(r.hit, 1);
  assert.deepEqual(r.paid, [], 'one of two stages: no pay yet');
  assert.equal(r.box, 2, 'the skill was not due, so its box stays');
  console.log('  boss: skill stage cleared');
}
```

In the per-app loop, right after the `checkReview(app, reviewOut);` / `checkMathReview(reviewOut);` block, add:

```js
    const bossOut = readOutput(dumpDom(path.join(work, 'profile-boss-' + app.slug), recallFile, '#e2e=boss'));
    if (app.family === 'math') checkMathBoss(bossOut); else checkBoss(bossOut);
```

- [ ] **Step 3: Run the game e2e twice per grade**

Run: `node tests/e2e/apps-e2e.js`, `node tests/e2e/apps-e2e.js 5`, then both again.
Expected: every app passes each time, and each prints `boss: …`.

If `r.points` is not 0 in a game, check whether that game pays something outside `Recall.points`, such as a typed bonus or a streak bonus on resting questions. Report it instead of loosening the assertion.

- [ ] **Step 4: Add the lobby driver mode**

In `tests/e2e/lobby-driver.page.js`, add this block before `if (mode === 'nojs')`:

```js
  if (mode === 'boss') {
    var bcards = Array.prototype.map.call(document.querySelectorAll('.subject-card[data-app]'), function (c) {
      return { app: c.getAttribute('data-app'), href: c.getAttribute('href') };
    });
    var bday = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var bitems = {};
    for (var bi = 0; bi < 4; bi++) bitems[bcards[0].app + '|a' + bi] = { box: 1, due: bday(new Date()), t: 1 };
    for (var bj = 0; bj < 3; bj++) bitems[bcards[1].app + '|b' + bj] = { box: 1, due: bday(new Date()), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: bitems }));
    __store.removeItem('boss_v1');
    var bcoins = function () { return (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0; };
    document.dispatchEvent(new Event('cloud-synced'));
    r.hidden = $('boss').hidden;
    r.stages = JSON.parse(__store.getItem('boss_v1')).stages.map(function (s) { return s.app; });
    r.expect = [bcards[0].app, bcards[1].app];
    var blink = $('boss').querySelector('.boss-list a');
    r.firstHref = blink ? blink.getAttribute('href') : null;
    r.cardHref = bcards[0].href;
    r.rows = $('boss').querySelectorAll('.boss-list li').length;
    var before = bcoins();
    Boss.stageResult(bcards[0].app, 3, 3);
    r.beat = Boss.stageResult(bcards[1].app, 2, 3).filter(function (e) { return e.big; }).length;
    r.coins = bcoins() - before;
    document.dispatchEvent(new Event('cloud-synced'));
    r.title = $('boss').querySelector('.boss-title').textContent;
    r.links = $('boss').querySelectorAll('.boss-list a').length;
    r.coinsAfterSync = bcoins() - before;
    return out(r);
  }
```

In `tests/e2e/lobby-e2e.js`, after the quests assertions, add:

```js
  const bs = readOutput(dumpDom(path.join(work, 'profile-boss'), withJsLobby, '#e2e=boss'));
  assert.deepEqual(bs.errors, [], 'boss: page errors');
  assert.equal(bs.hidden, false, 'the boss card shows');
  assert.deepEqual(bs.stages, bs.expect, 'the 2 games with review boxes, most due first');
  assert.equal(bs.rows, 2);
  assert.equal(bs.firstHref, bs.cardHref + '&boss=1', 'a stage opens its game in boss mode');
  assert.equal(bs.beat, 1, 'clearing both stages beats the boss');
  assert.equal(bs.coins, 10);
  assert.match(bs.title, /Boss beaten! New boss on Monday/);
  assert.equal(bs.links, 0, 'cleared stages have no links');
  assert.equal(bs.coinsAfterSync, 10, 'a sync pays nothing more');
```

- [ ] **Step 5: Run the lobby e2e for both grades, twice**

Run: `node tests/e2e/lobby-e2e.js`, `node tests/e2e/lobby-e2e.js 5`, then both again.
Expected: `Lobby passed` every time.

- [ ] **Step 6: Run the remaining e2e suites**

Run: `node tests/e2e/backup-e2e.js`, `node tests/e2e/file-check-e2e.js`, `node tests/e2e/migration-e2e.js`, `node tests/e2e/nav-e2e.js`
Expected: all pass.

- [ ] **Step 7: Commit (the user runs it)**

```bash
git add tests/e2e
git commit -m "Test the weekly boss end to end: a failed stage stays open, Try Again clears it and pays the boss once, Math clears a skill stage, and the lobby card links and settles"
```

---

### Task 7: Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-04-weekly-boss-design.md` (status line)

- [ ] **Step 1: README**

After the **Daily quests** paragraph (around line 70), add:

```markdown
- **Weekly boss:** every Monday the lobby picks a boss: 4 games (3 for Grade 2) where review is most needed. Each stage is a 3-question review inside that game, due questions first, then her weakest boxes (those rest and pay 0 points). 2 of 3 right clears a stage, and she can retry. Every stage cleared pays 10 coins at once. At least half cleared by Sunday pays 4 coins when the next week starts.
```

In the engine file list, after the `quests.js` line, add:

```
    boss.js                    the weekly boss: stages, the lobby card, boss coins
```

In "A new subject or grade", after step 5, add a step and renumber the rest:

```markdown
6. Let it play boss stages: load `boss.js` after `quests.js`, give `startReview` the `boss` flag, and add the `bossEvents` / `bossAgain` helpers, the `.concat(bossEvents(el))` in `showMedals` and the `Boss.wantsBoss` line after the review check (copy them from a game of the same family; `tests/boss-wiring.test.js` checks them).
```

- [ ] **Step 2: Spec status**

Change the spec's status line to:

```
Status: built 2026-10-04. Feature 4 of 9 in the user's game-improvement list (see `2026-10-02-spaced-review-design.md`).
```

- [ ] **Step 3: Final full check**

Run: `node --test`
Expected: all pass.

- [ ] **Step 4: Commit (the user runs it)**

```bash
git add README.md docs/superpowers/specs/2026-10-04-weekly-boss-design.md docs/superpowers/plans/2026-10-04-weekly-boss.md
git commit -m "Document the weekly boss round"
```

---

## Deploy note for the user

Push everything together: the engine files (`boss.js`, `recall.js`, `sync-core.js`), both lobbies, the parent page and all 17 games. Then open each tablet's lobby once while online, so this week's boss is picked.
