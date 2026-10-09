# Daily Quests and Gentle Streak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each day the lobby offers 3 quests fitted to her (rotating, never the same twice in a row), finishing rounds in any game ticks them off with a popup, all 3 pay 3 coins once a day, and a streak that survives 2 rest days a week pays 5/10/15/20 coins at 7/14/30/60 days.

**Architecture:** New engine file `web/engine/quests.js`. The lobby picks the day's quests once (`Quests.pick(cards)`) from the review boxes (`Recall.dueByApp`), weak lessons (`StudyHistory.weakSpots`) and the study history, and saves `quests_v1`. Lobbies and games call `Quests.check()`, which reads today's finished rounds from the study history, marks quests done, records study days, pays through `Wallet.addBonus`, and returns popup events for `Fx.celebrate`. Cloud sync merges `quests_v1`.

**Tech Stack:** Plain ES5 engine files, `node --test`, headless-Chrome e2e in `tests/e2e/`.

**Spec:** `docs/superpowers/specs/2026-10-02-daily-quests-design.md` (one simplification: "yesterday's picks" are read from the saved list itself, so there is no separate `prev` field).

**House rules for every task:**
- Never run `git commit`. Each task ends by staging its files with `git add`; the user commits.
- Run unit tests from the repo root with `node --test <files>` (never `node --test tests/`).
- Engine files are ES5: no arrow functions, `let`/`const`, template strings or `Object.assign`. `web/engine/sync-core.js` must stay ASCII-only.
- Comments only where the code is not obvious.
- Grade 2 text pairs Filipino with English; buttons are English only.

---

## File map

| File | Change |
|---|---|
| `web/engine/quests.js` | **New.** Picking, checking, streak, pay, text, lobby card, parent line |
| `web/engine/fx.js` | `celebrate` puts big events first (stable) |
| `web/engine/sync-core.js` | `quests` kind + merge |
| `web/engine/study-history.js`, `web/engine/parent-panel.js` | backups carry `quests_v1` |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | load `quests.js`, `#quests` card, `showQuests`, shop "bonus" text |
| 15 game pages | load `quests.js`; `showMedals` adds quest events |
| `web/parent/index.html`, `web/parent/phone.js` | streak line |
| `web/sw.js` | PRECACHE gains `engine/quests.js` (tool) |
| `tests/paths.js` | `ENGINE_FILES` gains `quests.js` |
| `tests/quests.test.js` | **New** |
| `tests/sync.test.js`, `tests/study-history.test.js`, `tests/english-everywhere.test.js`, `tests/browser-globals.test.js`, `tests/copies.test.js`, `tests/mastery-wiring.test.js` | new cases |
| `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`, `tests/e2e/driver-common.page.js`, `tests/e2e/apps-e2e.js` | quests e2e |
| `README.md` | features, engine list, new-subject checklist |

---

### Task 1: quests.js — picking, done rules, streak, pay, text

**Files:**
- Create: `web/engine/quests.js`
- Modify: `tests/paths.js:8`
- Test: `tests/quests.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/quests.test.js`:

```js
process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, streakOf, read, parentLine, TEXT, ORDER, ALL_COINS, MILESTONES } = require(engineFile('quests.js'));

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
  now.mins = (n) => { t += n * 60000; };
  return now;
}

const CARDS = [
  { app: 'life-lab', title: 'Life Lab', href: 'life.html?reset=1' },
  { app: 'craft-corner', title: 'Craft Corner', href: 'craft.html?reset=1' },
  { app: 'page-turners', title: 'Page Turners', href: 'pages.html?reset=1' },
];

// A fake page: history entries, due counts, weak spots and a wallet.
function world(opts) {
  const o = Object.assign({ due: {}, weak: [], entries: [] }, opts);
  const s = memory(), now = o.now || clock(2026, 10, 2);
  const paid = [];
  const deps = {
    history: () => o.entries,
    due: () => o.due,
    weak: () => o.weak,
    bonus: (c) => { paid.push(c); return true; },
  };
  return { o, s, now, paid, q: create(s, now, 'grade5', deps) };
}

let nextId = 1;
const round = (now, f) => Object.assign({ id: 'e' + nextId++, type: 'quiz', app: 'life-lab', appTitle: 'Life Lab', lessonTitle: 'Plants',
  final: false, finished: true, stars: 1, correct: 5, answered: 8, total: 8, t: now() }, f);
const saved = (s) => JSON.parse(s.data.quests_v1);

test('the pool, the all-3 bonus and the streak milestones', () => {
  assert.deepEqual(ORDER, ['rounds', 'stars', 'right', 'explore', 'best']);
  assert.equal(ALL_COINS, 3);
  assert.deepEqual(MILESTONES, [[7, 5], [14, 10], [30, 15], [60, 20]]);
});

test('slot 1 is the review with the most due, slot 2 the weakest lesson, slot 3 the first pool kind', () => {
  const w = world({ due: { 'craft-corner': 2, 'life-lab': 5 }, weak: [{ app: 'life-lab', appTitle: 'Life Lab', lesson: 'Plants', pct: 50 }] });
  const list = w.q.pick(CARDS).list;
  assert.deepEqual(list.map((x) => x.id), ['review|life-lab', 'practice|life-lab|Plants', 'rounds']);
  assert.deepEqual(list[0], { id: 'review|life-lab', kind: 'review', app: 'life-lab', title: 'Life Lab', href: 'life.html?reset=1&review=1', done: false });
  assert.equal(list[1].lesson, 'Plants');
  assert.equal(w.q.pick(CARDS).list[0].id, 'review|life-lab', 'picked once a day');
});

test('fallbacks: nothing due gives 3 stars, no weak lesson gives 20 right; slot 3 skips kinds already used', () => {
  const w = world();
  assert.deepEqual(w.q.pick(CARDS).list.map((x) => x.kind), ['stars', 'right', 'rounds']);
  const weakOnlyMock = world({ weak: [{ app: 'life-lab', lesson: 'Final Mock Exam', pct: 40 }, { app: 'life-lab', lesson: 'Case Study: X', pct: 40 }, { app: 'other-app', lesson: 'Y', pct: 40 }] });
  assert.equal(weakOnlyMock.q.pick(CARDS).list[1].kind, 'right', 'mock exams, case studies and other grades are not practice quests');
});

test('rotation: tomorrow skips yesterday\'s subject, lesson and pool kind when there is another choice', () => {
  const w = world({ due: { 'life-lab': 5, 'craft-corner': 2 }, weak: [{ app: 'life-lab', lesson: 'Plants', pct: 50 }, { app: 'craft-corner', lesson: 'Sewing', pct: 60 }] });
  w.q.pick(CARDS);
  w.now.days(1);
  const list = w.q.pick(CARDS).list;
  assert.deepEqual(list.map((x) => x.id), ['review|craft-corner', 'practice|craft-corner|Sewing', 'stars']);
  w.now.days(1);
  w.o.due = { 'life-lab': 5 };
  w.o.weak = [{ app: 'life-lab', lesson: 'Plants', pct: 50 }];
  assert.deepEqual(w.q.pick(CARDS).list.map((x) => x.id), ['review|life-lab', 'practice|life-lab|Plants', 'right'], 'the only choice may repeat');
});

test('explore picks the subject she has not played the longest; best needs a lesson played before', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now, entries: [round(now, { app: 'life-lab', t: now() - 86400000 }), round(now, { app: 'page-turners', t: now() - 3 * 86400000 })] });
  const saveDay = (kind) => { w.s.data.quests_v1 = JSON.stringify({ v: 1, day: '2026-10-01', at: 1, list: [{ id: 'stars', kind: 'stars' }, { id: 'right', kind: 'right' }, { id: kind, kind }], days: [], paidDay: '', streakPaid: [] }); };
  saveDay('right');
  assert.deepEqual(w.q.pick(CARDS).list[2], { id: 'explore|craft-corner', kind: 'explore', app: 'craft-corner', title: 'Craft Corner', href: 'craft.html?reset=1', done: false }, 'never played first');
  const fresh = world();
  fresh.s.data.quests_v1 = JSON.stringify({ v: 1, day: '2026-10-01', at: 1, list: [{ id: 'x', kind: 'stars' }, { id: 'y', kind: 'right' }, { id: 'explore|a', kind: 'explore' }], days: [], paidDay: '', streakPaid: [] });
  assert.equal(fresh.q.pick(CARDS).list[2].kind, 'rounds', 'no lesson played yet: best is skipped and the rotation wraps');
});

test('each quest is done by the right rounds today, after the pick', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now, due: { 'life-lab': 3 }, weak: [{ app: 'life-lab', lesson: 'Plants', pct: 50 }] });
  w.o.entries.push(round(now, { kind: 'review', lessonTitle: 'Review' }));
  now.mins(1);
  w.q.pick(CARDS);
  assert.deepEqual(w.q.check(), [], 'a round before the pick does not count');
  now.mins(5);
  w.o.entries.push(round(now, { kind: 'review', lessonTitle: 'Review', finished: false }));
  assert.deepEqual(w.q.check(), [], 'an unfinished round does not count');
  w.o.entries.push(round(now, { kind: 'review', lessonTitle: 'Review' }));
  const ev = w.q.check();
  assert.deepEqual(ev, [{ big: false, icon: '🎯', title: 'You finished a quest!', line: '🔁 Clear your Review in Life Lab', next: '1 of 3 quests done today' }]);
  assert.deepEqual(saved(w.s).days, ['2026-10-02'], 'one quest makes it a study day');
  assert.deepEqual(w.q.check(), [], 'celebrated once');
  w.o.entries.push(round(now, { lessonTitle: 'Plants' }));
  const done = w.q.check();
  assert.equal(done.length, 3, 'practice and 2 rounds are done too, so all 3 pay the bonus');
  assert.equal(done[0].big, true, 'the bonus leads');
});

test('stars, right, explore and best rules', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  const isDone = (q, entries) => { w.o.entries = entries; return w.q.doneBy(q, entries.filter((e) => e.finished)); };
  assert.equal(isDone({ kind: 'stars' }, [round(now, { stars: 3 })]), true);
  assert.equal(isDone({ kind: 'stars' }, [round(now, { stars: 2 })]), false);
  assert.equal(isDone({ kind: 'right' }, [round(now, { correct: 12 }), round(now, { correct: 8 })]), true);
  assert.equal(isDone({ kind: 'right' }, [round(now, { correct: 19 })]), false);
  assert.equal(isDone({ kind: 'rounds' }, [round(now)]), false);
  assert.equal(isDone({ kind: 'explore', app: 'craft-corner' }, [round(now, { app: 'craft-corner' })]), true);
  const old = round(now, { correct: 6, t: now() - 86400000 });
  w.o.entries = [old, round(now, { correct: 7 })];
  assert.equal(w.q.doneBy({ kind: 'best' }, [w.o.entries[1]]), true, 'beat 6 with 7');
  w.o.entries = [old, round(now, { correct: 6 })];
  assert.equal(w.q.doneBy({ kind: 'best' }, [w.o.entries[1]]), false, 'a tie is not a new best');
  w.o.entries = [round(now, { correct: 8, lessonTitle: 'New' })];
  assert.equal(w.q.doneBy({ kind: 'best' }, w.o.entries), false, 'a first try is not a new best');
});

test('all 3 quests pay 3 coins once a day', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  w.q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3, correct: 12 }), round(now, { stars: 1, correct: 9 }));
  const ev = w.q.check();
  assert.deepEqual(w.paid, [3]);
  assert.deepEqual(ev[0], { big: true, icon: '🎯', title: 'You finished all 3 quests!', line: '+3 coins', next: 'See you tomorrow!' });
  assert.equal(ev.length, 4, 'the big one first, then each quest');
  w.q.check();
  assert.deepEqual(w.paid, [3], 'paid once');
  assert.equal(saved(w.s).paidDay, '2026-10-02');
});

test('a failed payment is tried again later and never marked paid', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  let ok = false;
  const q = create(w.s, now, 'grade5', { history: () => w.o.entries, due: () => ({}), weak: () => [], bonus: (c) => { if (ok) w.paid.push(c); return ok; } });
  q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3, correct: 12 }), round(now, { correct: 9 }));
  q.check();
  assert.equal(saved(w.s).paidDay, '');
  ok = true;
  q.check();
  assert.deepEqual(w.paid, [3]);
});

test('the streak survives 2 rest days in any 7, counts only study days, and today is not over yet', () => {
  const d = (n) => { const x = new Date(2026, 9, 2 + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const today = d(0);
  assert.deepEqual(streakOf([], today), { days: 0, start: null, restLeft: 2, welcomeBack: false });
  assert.equal(streakOf([d(-1), d(-2), d(-3)], today).days, 3, 'not studied today yet: still 3');
  assert.equal(streakOf([d(0), d(-1), d(-3), d(-5)], today).days, 4, 'two rest days inside the week');
  assert.equal(streakOf([d(0), d(-1), d(-3), d(-5)], today).restLeft, 0, 'both rest days used');
  assert.equal(streakOf([d(0), d(-2), d(-4), d(-5)], today).days, 4);
  assert.equal(streakOf([d(0), d(-4), d(-5)], today).days, 1, 'three missed days in a row end the run');
  const back = streakOf([d(-10), d(-11)], today);
  assert.deepEqual([back.days, back.welcomeBack], [0, true]);
  assert.equal(streakOf([d(0), d(-1)], today).start, d(-1));
});

test('streak milestones pay once per run', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  const days = [];
  for (let i = 6; i >= 1; i--) { const x = new Date(2026, 9, 2 - i); days.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); }
  w.s.data.quests_v1 = JSON.stringify({ v: 1, day: '', at: 0, list: [], days, paidDay: '', streakPaid: [] });
  w.q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3 }));
  const ev = w.q.check();
  assert.deepEqual(ev[0], { big: true, icon: '🔥', title: 'You have a 7-day streak!', line: '+5 coins', next: 'Next: 14 days' });
  assert.deepEqual(w.paid, [5]);
  assert.deepEqual(saved(w.s).streakPaid, [days[0] + '|7']);
  w.o.entries.push(round(now, { stars: 3 }));
  w.q.check();
  assert.deepEqual(w.paid, [5], 'once per run');
});

test('lobby text and the parent line', () => {
  const T = TEXT.grade5;
  assert.equal(T.streak({ days: 12, restLeft: 2 }), '🔥 12-day streak · you can rest 2 more days this week');
  assert.equal(T.streak({ days: 3, restLeft: 1 }), '🔥 3-day streak · you can rest 1 more day this week');
  assert.equal(T.streak({ days: 3, restLeft: 0 }), '🔥 3-day streak · your rest days are used this week');
  assert.equal(T.streak({ days: 0, welcomeBack: true }), 'Welcome back! Let\'s start a new streak');
  assert.equal(T.streak({ days: 0, welcomeBack: false }), 'Start a streak today!');
  assert.equal(T.quest({ kind: 'practice', lesson: 'Plants', title: 'Life Lab' }), '📘 Practice Plants in Life Lab');
  assert.equal(TEXT.grade2.quest({ kind: 'review', title: 'Kuwentista' }), '🔁 Balikan ang Review sa Kuwentista · Clear your Review in Kuwentista');
  const today = new Date(2026, 9, 2, 9).getTime();
  const state = { v: 1, day: '2026-10-02', at: 1, list: [{ done: true }, { done: false }, { done: true }], days: ['2026-10-01', '2026-10-02'], paidDay: '', streakPaid: [] };
  assert.equal(parentLine(state, today), '🔥 2-day streak · today 2 of 3 quests');
  assert.equal(parentLine(read(memory()), today), 'No streak yet · quests not picked yet today');
});

test('junk saved data reads as a fresh start', () => {
  assert.deepEqual(read(memory({ quests_v1: '{nope' })), { v: 1, day: '', at: 0, list: [], days: [], paidDay: '', streakPaid: [] });
  const w = world();
  w.s.data.quests_v1 = JSON.stringify({ v: 1, day: 5, list: 'x', days: 'y' });
  assert.equal(w.q.pick(CARDS).list.length, 3);
});

test('create needs a known grade', () => {
  assert.throws(() => create(memory(), () => 0, 'grade9', {}), /grade/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/quests.test.js`
Expected: FAIL with `Cannot find module '...web/engine/quests.js'`.

- [ ] **Step 3: Create `web/engine/quests.js`**

```js
/* Loaded by both lobbies and every game after mastery.js, and by the parent page. The pages are decoded as UTF-8, so the text can hold emoji.
   The lobby picks 3 quests a day; finishing rounds ticks them off. All 3 pay a small bonus once a day, and a streak
   that survives 2 rest days in any 7 pays at 7, 14, 30 and 60 days. Nothing here ever talks about losing a streak. */
(function (root) {
  'use strict';

  var KEY = 'quests_v1';
  var ORDER = ['rounds', 'stars', 'right', 'explore', 'best'];
  var ALL_COINS = 3;
  var MILESTONES = [[7, 5], [14, 10], [30, 15], [60, 20]];
  var KEEP_DAYS = 60;
  var WEAK_DAYS = 14;
  var RIGHT_GOAL = 20;
  var ROUNDS_GOAL = 2;
  var REST_DAYS = 2;

  function restEn(r) { return r > 0 ? 'you can rest ' + r + (r === 1 ? ' more day' : ' more days') + ' this week' : 'your rest days are used this week'; }
  function coinsEn(c) { return '+' + c + ' coins'; }
  var QUEST_EN = {
    review: function (q) { return '🔁 Clear your Review in ' + q.title; },
    practice: function (q) { return '📘 Practice ' + q.lesson + ' in ' + q.title; },
    stars: function () { return '⭐ Get 3 stars on a lesson'; },
    right: function () { return '✅ Get ' + RIGHT_GOAL + ' answers right today'; },
    rounds: function () { return '🎮 Play ' + ROUNDS_GOAL + ' rounds of any game'; },
    explore: function (q) { return '🧭 Go play ' + q.title + ' today'; },
    best: function () { return '🏅 Beat your best score on a lesson'; }
  };
  var QUEST_FIL = {
    review: function (q) { return 'Balikan ang Review sa ' + q.title; },
    practice: function (q) { return 'Sanayin ang ' + q.lesson + ' sa ' + q.title; },
    stars: function () { return 'Kumuha ng 3 star sa isang aralin'; },
    right: function () { return RIGHT_GOAL + ' tamang sagot ngayon'; },
    rounds: function () { return 'Maglaro ng ' + ROUNDS_GOAL + ' round'; },
    explore: function (q) { return 'Laruin ang ' + q.title + ' ngayon'; },
    best: function () { return 'Talunin ang best score mo sa isang aralin'; }
  };
  function streakEn(s) {
    if (s.days) return '🔥 ' + s.days + '-day streak · ' + restEn(s.restLeft);
    return s.welcomeBack ? 'Welcome back! Let\'s start a new streak' : 'Start a streak today!';
  }

  var TEXT = {
    grade5: {
      title: '🎯 Today\'s quests',
      quest: function (q) { return (QUEST_EN[q.kind] || QUEST_EN.rounds)(q); },
      streak: streakEn,
      doneTitle: 'You finished a quest!',
      doneNext: function (n, total) { return n + ' of ' + total + ' quests done today'; },
      allTitle: 'You finished all 3 quests!',
      allNext: 'See you tomorrow!',
      streakTitle: function (n) { return 'You have a ' + n + '-day streak!'; },
      streakNext: function (next) { return next ? 'Next: ' + next + ' days' : 'You are amazing!'; },
      coins: coinsEn
    },
    grade2: {
      title: '🎯 Mga quest ngayon · Today\'s quests',
      quest: function (q) {
        var en = (QUEST_EN[q.kind] || QUEST_EN.rounds)(q), cut = en.indexOf(' ');
        return en.slice(0, cut) + ' ' + (QUEST_FIL[q.kind] || QUEST_FIL.rounds)(q) + ' · ' + en.slice(cut + 1);
      },
      streak: function (s) {
        if (s.days) return '🔥 ' + s.days + ' araw na sunod-sunod · ' + (s.restLeft > 0 ? s.restLeft + ' pahinga pa' : 'wala nang pahinga') + ' · ' + streakEn(s).slice(3);
        return s.welcomeBack ? 'Maligayang pagbabalik! · Welcome back! Let\'s start a new streak' : 'Simulan ang streak ngayon! · Start a streak today!';
      },
      doneTitle: 'Tapos ang quest! · You finished a quest!',
      doneNext: function (n, total) { return n + ' sa ' + total + ' quest ngayon · ' + n + ' of ' + total + ' quests done today'; },
      allTitle: 'Tapos ang 3 quest! · You finished all 3 quests!',
      allNext: 'Kita tayo bukas! · See you tomorrow!',
      streakTitle: function (n) { return n + ' araw na sunod-sunod! · You have a ' + n + '-day streak!'; },
      streakNext: function (next) { return next ? 'Susunod: ' + next + ' araw · Next: ' + next + ' days' : 'Ang galing mo! · You are amazing!'; },
      coins: coinsEn
    }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayNum(key) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
    return p ? Math.round(Date.UTC(+p[1], +p[2] - 1, +p[3]) / 86400000) : NaN;
  }
  function keyOfNum(n) { var d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function strings(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; }

  function read(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    var ok = isObj(d) && d.v === 1;
    return {
      v: 1,
      day: ok && typeof d.day === 'string' ? d.day : '',
      at: ok && typeof d.at === 'number' ? d.at : 0,
      list: ok && Array.isArray(d.list) ? d.list.filter(isObj) : [],
      days: ok ? strings(d.days) : [],
      paidDay: ok && typeof d.paidDay === 'string' ? d.paidDay : '',
      streakPaid: ok ? strings(d.streakPaid) : []
    };
  }

  // days: study days as YYYY-MM-DD. Going back from today (or yesterday, while today has no quest yet), the run
  // continues until some 7-day window holds 3 days without study.
  function streakOf(days, today) {
    var set = {}, t = dayNum(today), any = false;
    days.forEach(function (d) { var n = dayNum(d); if (!isNaN(n)) { set[n] = true; any = true; } });
    var start = set[t] ? t : t - 1, count = 0, first = null, misses = [];
    for (var d = start; d > start - 400; d--) {
      if (set[d]) { count++; first = d; continue; }
      misses.push(d);
      if (misses.filter(function (m) { return m - d < 7; }).length > REST_DAYS) break;
    }
    var used = 0;
    if (first !== null) for (var r = Math.max(t - 6, first); r < t; r++) if (!set[r]) used++;
    return { days: count, start: first === null ? null : keyOfNum(first), restLeft: Math.max(0, REST_DAYS - used), welcomeBack: count === 0 && any };
  }

  function parentLine(state, nowMs) {
    var today = dayKey(nowMs), s = streakOf(state.days, today);
    var head = s.days ? '🔥 ' + s.days + '-day streak' : 'No streak yet';
    if (state.day !== today || !state.list.length) return head + ' · quests not picked yet today';
    var done = state.list.filter(function (q) { return q.done; }).length;
    return head + ' · today ' + done + ' of ' + state.list.length + ' quests';
  }

  function plainLesson(label) {
    return label !== 'Final Mock Exam' && label.indexOf('UPAC Walkthrough: ') !== 0 && label.indexOf('Case Study: ') !== 0;
  }

  // deps: { history() -> study history entries, due() -> { app: count }, weak(entries) -> SH.weakSpots groups, bonus(coins) -> true when paid }
  function create(storage, now, grade, deps) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Quests needs a grade like "grade5".');
    var T = TEXT[grade];

    function save(state) { try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
    function finished(entries) {
      return entries.filter(function (e) { return e && e.type === 'quiz' && e.finished === true && typeof e.t === 'number'; });
    }
    function lessonQuiz(e) { return !e.kind && !e.final && typeof e.lessonTitle === 'string'; }

    function doneBy(q, today) {
      if (q.kind === 'review') return today.some(function (e) { return e.kind === 'review' && e.app === q.app; });
      if (q.kind === 'practice') return today.some(function (e) { return lessonQuiz(e) && e.app === q.app && e.lessonTitle === q.lesson; });
      if (q.kind === 'stars') return today.some(function (e) { return e.stars === 3; });
      if (q.kind === 'right') return today.reduce(function (n, e) { return n + (Number(e.correct) || 0); }, 0) >= RIGHT_GOAL;
      if (q.kind === 'rounds') return today.length >= ROUNDS_GOAL;
      if (q.kind === 'explore') return today.some(function (e) { return e.app === q.app; });
      if (q.kind === 'best') {
        var all = finished(deps.history());
        return today.some(function (e) {
          if (!lessonQuiz(e)) return false;
          var before = all.filter(function (o) { return lessonQuiz(o) && o.app === e.app && o.lessonTitle === e.lessonTitle && o.t < e.t; });
          return before.length > 0 && before.every(function (o) { return (Number(e.correct) || 0) > (Number(o.correct) || 0); });
        });
      }
      return false;
    }

    function pick(cards) {
      var state = read(storage), today = dayKey(now());
      if (state.day === today && state.list.length === 3) return state;
      var last = state.list, apps = cards.map(function (c) { return c.app; }), byApp = {};
      cards.forEach(function (c) { byApp[c.app] = c; });
      var entries = finished(deps.history());
      function prevOf(kind) { for (var i = 0; i < last.length; i++) if (last[i].kind === kind) return last[i]; return null; }
      function quest(kind, app, extra) {
        var q = { id: kind + (app ? '|' + app : '') + (extra && extra.lesson ? '|' + extra.lesson : ''), kind: kind };
        if (app) { q.app = app; q.title = byApp[app].title; q.href = byApp[app].href + (kind === 'review' ? (byApp[app].href.indexOf('?') >= 0 ? '&' : '?') + 'review=1' : ''); }
        if (extra && extra.lesson) q.lesson = extra.lesson;
        q.done = false;
        return q;
      }
      function notYesterday(list, same) { return list.length > 1 ? list.filter(function (x) { return !same(x); }) : list; }

      var due = deps.due() || {}, prevReview = prevOf('review');
      var dueApps = apps.filter(function (a) { return due[a] > 0; }).sort(function (a, b) { return due[b] - due[a] || apps.indexOf(a) - apps.indexOf(b); });
      dueApps = notYesterday(dueApps, function (a) { return prevReview && prevReview.app === a; });
      var slot1 = dueApps.length ? quest('review', dueApps[0]) : quest('stars');

      var from = dayNum(today) - WEAK_DAYS, prevPractice = prevOf('practice');
      var recent = entries.filter(function (e) { return dayNum(dayKey(e.t)) >= from; });
      var weak = (deps.weak(recent) || []).filter(function (g) { return byApp[g.app] && typeof g.lesson === 'string' && plainLesson(g.lesson) && g.pct < 80; });
      weak = notYesterday(weak, function (g) { return prevPractice && prevPractice.app === g.app && prevPractice.lesson === g.lesson; });
      var slot2 = weak.length ? quest('practice', weak[0].app, { lesson: weak[0].lesson }) : quest('right');

      var lastPlayed = {};
      entries.forEach(function (e) { if (!lastPlayed[e.app] || e.t > lastPlayed[e.app]) lastPlayed[e.app] = e.t; });
      var stale = apps.slice().sort(function (a, b) { return (lastPlayed[a] || 0) - (lastPlayed[b] || 0) || apps.indexOf(a) - apps.indexOf(b); })[0];
      var playedLesson = entries.some(lessonQuiz);
      var prev3 = last.length === 3 ? last[2].kind : null, startAt = (ORDER.indexOf(prev3) + 1) % ORDER.length, slot3 = null;
      for (var i = 0; i < ORDER.length && !slot3; i++) {
        var kind = ORDER[(startAt + i) % ORDER.length];
        if (kind === slot1.kind || kind === slot2.kind || kind === prev3) continue;
        if (kind === 'explore' && !stale) continue;
        if (kind === 'best' && !playedLesson) continue;
        slot3 = kind === 'explore' ? quest('explore', stale) : quest(kind);
      }
      if (!slot3) slot3 = quest('rounds');

      state.day = today;
      state.at = now();
      state.list = [slot1, slot2, slot3];
      save(state);
      return state;
    }

    function check() {
      var state = read(storage), today = dayKey(now()), events = [], changed = false;
      if (state.day !== today || !state.list.length) return [];
      var todays = finished(deps.history()).filter(function (e) { return e.t >= state.at && dayKey(e.t) === today; });
      var newly = [];
      state.list.forEach(function (q) {
        if (!q.done && doneBy(q, todays)) { q.done = true; newly.push(q); changed = true; }
      });
      var doneCount = state.list.filter(function (q) { return q.done; }).length;
      if (doneCount && state.days.indexOf(today) < 0) {
        state.days.push(today);
        state.days.sort();
        state.days = state.days.slice(-KEEP_DAYS);
        changed = true;
      }
      newly.forEach(function (q) { events.push({ big: false, icon: '🎯', title: T.doneTitle, line: T.quest(q), next: T.doneNext(doneCount, state.list.length) }); });
      if (doneCount === state.list.length && state.paidDay !== today && deps.bonus(ALL_COINS)) {
        state.paidDay = today;
        changed = true;
        events.unshift({ big: true, icon: '🎯', title: T.allTitle, line: T.coins(ALL_COINS), next: T.allNext });
      }
      var s = streakOf(state.days, today);
      MILESTONES.forEach(function (m, i) {
        var key = s.start + '|' + m[0];
        if (!s.start || s.days < m[0] || state.streakPaid.indexOf(key) >= 0 || !deps.bonus(m[1])) return;
        state.streakPaid.push(key);
        changed = true;
        events.unshift({ big: true, icon: '🔥', title: T.streakTitle(m[0]), line: T.coins(m[1]), next: T.streakNext(MILESTONES[i + 1] ? MILESTONES[i + 1][0] : 0) });
      });
      if (changed && !save(state)) return [];
      return events;
    }

    return {
      text: T,
      pick: pick,
      check: check,
      doneBy: doneBy,
      state: function () { return read(storage); },
      streak: function () { return streakOf(read(storage).days, dayKey(now())); }
    };
  }

  var exported = { create: create, read: read, streakOf: streakOf, parentLine: parentLine, TEXT: TEXT, ORDER: ORDER,
    ALL_COINS: ALL_COINS, MILESTONES: MILESTONES, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Quests = exported;
})(this);
```

- [ ] **Step 4: Add the file to the engine list** — in `tests/paths.js:8`, insert `'quests.js'` right after `'mastery.js'`.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/quests.test.js`
Expected: PASS. If a test disagrees with the code, decide which one matches the spec (`docs/superpowers/specs/2026-10-02-daily-quests-design.md`) and fix that one; report any change. (The whole suite fails `tests/pwa.test.js` until Task 8 updates the offline cache; that is expected.)

- [ ] **Step 6: Grade 2 English check** — append to `tests/english-everywhere.test.js`:

```js
test('every Grade 2 quest and streak line has English', () => {
  const { TEXT } = require(engineFile('quests.js'));
  const t = TEXT.grade2;
  const quests = ['review', 'practice', 'stars', 'right', 'rounds', 'explore', 'best'].map((kind) => t.quest({ kind, title: 'Kuwentista', lesson: 'Pangngalan' }));
  const lines = [t.title, t.doneTitle, t.allTitle, t.allNext, t.doneNext(2, 3), t.streakTitle(7), t.streakNext(14), t.streakNext(0),
    t.streak({ days: 5, restLeft: 2 }), t.streak({ days: 5, restLeft: 0 }), t.streak({ days: 0, welcomeBack: true }), t.streak({ days: 0 })].concat(quests);
  lines.forEach((line) => hasEnglishWhereFilipino(line, 'quest text'));
});
```

Run: `node --test tests/english-everywhere.test.js`
Expected: PASS.

- [ ] **Step 7: Stage**

```bash
git add web/engine/quests.js tests/quests.test.js tests/paths.js tests/english-everywhere.test.js
```

---

### Task 2: Cloud sync merges quests; backups carry them; Fx puts big events first

**Files:**
- Modify: `web/engine/sync-core.js`, `web/engine/study-history.js:323`, `web/engine/parent-panel.js:329`, `web/engine/fx.js` (`celebrate`)
- Test: `tests/sync.test.js`, `tests/study-history.test.js`

- [ ] **Step 1: Failing sync tests** — append to `tests/sync.test.js`:

```js
test('quests: the later day wins; on the same day the first pick is kept and done marks add up', () => {
  const q = (id, done) => ({ id, kind: 'rounds', done });
  const a = { v: 1, day: '2026-10-02', at: 100, list: [q('x', true), q('y', false), q('z', false)], days: ['2026-10-01', '2026-10-02'], paidDay: '', streakPaid: ['2026-09-20|7'] };
  const b = { v: 1, day: '2026-10-02', at: 200, list: [q('p', true), q('y', true), q('r', false)], days: ['2026-09-30'], paidDay: '2026-10-02', streakPaid: [] };
  const want = { v: 1, day: '2026-10-02', at: 100, list: [q('x', true), q('y', true), q('z', false)],
    days: ['2026-09-30', '2026-10-01', '2026-10-02'], paidDay: '2026-10-02', streakPaid: ['2026-09-20|7'] };
  assert.deepEqual(MERGE.quests(a, b), want);
  assert.deepEqual(MERGE.quests(b, a), want);
  assert.deepEqual(MERGE.quests(MERGE.quests(a, b), b), want, 'safe to repeat');
  const older = Object.assign({}, b, { day: '2026-10-01', at: 1 });
  assert.equal(MERGE.quests(a, older).day, '2026-10-02');
  assert.equal(MERGE.quests(older, a).at, 100);
  assert.equal(kindOf('quests_v1'), 'quests');
});

test('quests: at the same pick time either order agrees; days keep the last 60; junk is ignored', () => {
  const a = { v: 1, day: '2026-10-02', at: 5, list: [{ id: 'a', done: false }], days: [], paidDay: '', streakPaid: [] };
  const b = { v: 1, day: '2026-10-02', at: 5, list: [{ id: 'b', done: false }], days: [], paidDay: '', streakPaid: [] };
  assert.deepEqual(MERGE.quests(a, b), MERGE.quests(b, a));
  const many = [];
  for (let i = 1; i <= 70; i++) many.push('2026-07-' + String(i).padStart(2, '0'));
  assert.equal(MERGE.quests({ v: 1, day: '', at: 0, list: [], days: many.slice(0, 40), paidDay: '', streakPaid: [] }, { v: 1, day: '', at: 0, list: [], days: many.slice(30), paidDay: '', streakPaid: [] }).days.length, 60);
  assert.deepEqual(MERGE.quests('nope', null), null);
});

test('quests travel to a second device', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  a.s.setItem('quests_v1', JSON.stringify({ v: 1, day: '2026-10-02', at: 5, list: [{ id: 'rounds', kind: 'rounds', done: true }], days: ['2026-10-02'], paidDay: '', streakPaid: [] }));
  await a.sync();
  await b.sync();
  assert.deepEqual(JSON.parse(b.s.getItem('quests_v1')).days, ['2026-10-02']);
});
```

(Days in July only go to 31; `'2026-07-32'` and later are not real dates but are fine as strings for this length test — the merge sorts and keeps the last 60 strings.)

Run: `node --test tests/sync.test.js`
Expected: FAIL with `MERGE.quests is not a function`.

- [ ] **Step 2: Implement the merge** — in `web/engine/sync-core.js` (ASCII only):

In `kindOf`, after `if (key === 'mastery_v1') return 'mastery';` add:

```js
    if (key === 'quests_v1') return 'quests';
```

Before `var MERGE = {` add:

```js
  function union(x, y, keep) {
    var seen = {}, out = [];
    (Array.isArray(x) ? x : []).concat(Array.isArray(y) ? y : []).forEach(function (s) { if (typeof s === 'string' && !seen[s]) { seen[s] = true; out.push(s); } });
    out.sort();
    return keep ? out.slice(-keep) : out;
  }
  function questIds(q) { return JSON.stringify((q.list || []).map(function (x) { return x && x.id; })); }
```

Inside `var MERGE = {`, before `recall: function (a, b) {` add:

```js
    // Daily quests: the later day's list wins; on the same day the first pick is kept and a quest done anywhere is done.
    // Study days and paid streak milestones add up; the all-3 bonus day is the later one.
    quests: function (a, b) {
      a = isObj(a) ? a : null;
      b = isObj(b) ? b : null;
      if (!a || !b) return a || b;
      var keep;
      if (dayNum(a.day) !== dayNum(b.day)) keep = dayNum(a.day) > dayNum(b.day) ? a : b;
      else if ((Number(a.at) || 0) !== (Number(b.at) || 0)) keep = (Number(a.at) || 0) < (Number(b.at) || 0) ? a : b;
      else keep = questIds(a) <= questIds(b) ? a : b;
      var other = keep === a ? b : a, sameDay = dayNum(a.day) === dayNum(b.day), doneThere = {};
      if (sameDay) (Array.isArray(other.list) ? other.list : []).forEach(function (q) { if (q && q.done) doneThere[q.id] = true; });
      var list = (Array.isArray(keep.list) ? keep.list : []).filter(isObj).map(function (q) {
        var c = {};
        Object.keys(q).forEach(function (k) { c[k] = q[k]; });
        c.done = !!(q.done || doneThere[q.id]);
        return c;
      });
      return {
        v: 1, day: keep.day, at: keep.at, list: list,
        days: union(a.days, b.days, 60),
        paidDay: dayNum(a.paidDay) >= dayNum(b.paidDay) ? (a.paidDay || b.paidDay || '') : b.paidDay,
        streakPaid: union(a.streakPaid, b.streakPaid)
      };
    },
```

In `readLocal` and `writeLocal`, add `kind === 'quests' ||` next to `kind === 'mastery' ||` in both JSON-kind conditions.

- [ ] **Step 3: Run the sync tests**

Run: `node --test tests/sync.test.js`
Expected: PASS. Check sync-core.js stays ASCII: `node -e "const s=require('fs').readFileSync('web/engine/sync-core.js','utf8');console.log([...s].filter(c=>c.charCodeAt(0)>127).length)"` prints `0`.

- [ ] **Step 4: Backups** — in `tests/study-history.test.js`, test `'a full backup carries points, wallet, rest-days and her name, for its own grade only'`, add `quests_v1: '{"v":1}',` to the input `state` (after `mastery_v1`) and `quests_v1: '{"v":1}'` to the expected `state`. Run `node --test tests/study-history.test.js` → FAIL. Then:

`web/engine/study-history.js:323`:

```js
    var STATE_KEY_RE = /^(?:[a-z0-9]+_points_v1|wallet_v1|recall_v1|review_v1|mastery_v1|quests_v1)$/;
```

`web/engine/parent-panel.js:329`:

```js
        var keys = ['wallet_v1', 'recall_v1', 'review_v1', 'mastery_v1', 'quests_v1'];
```

Run: `node --test tests/study-history.test.js` → PASS.

- [ ] **Step 5: Fx puts big events first** — in `web/engine/fx.js`, in `celebrate(events, anchor)`, replace the line that stores the queue (it reads `queued = events;`) with

```js
      // Big ones lead the card; the order within each size is kept.
      queued = events.map(function (e, i) { return { e: e, i: i }; })
        .sort(function (x, y) { return (y.e.big ? 1 : 0) - (x.e.big ? 1 : 0) || x.i - y.i; })
        .map(function (x) { return x.e; });
```

Run: `node --test tests/fx.test.js` → PASS.

- [ ] **Step 6: Stage**

```bash
git add web/engine/sync-core.js web/engine/study-history.js web/engine/parent-panel.js web/engine/fx.js tests/sync.test.js tests/study-history.test.js
```

---

### Task 3: quests.js in the browser — the lobby card and the bootstrap

**Files:**
- Modify: `web/engine/quests.js` (tail)
- Test: `tests/browser-globals.test.js`

- [ ] **Step 1: Test** — append to `tests/browser-globals.test.js`:

```js
test('the parent page can show a child\'s streak line', () => {
  const win = browser('storage.js', 'quests.js');
  const s = win.StudyStore.memorySpace('kid');
  s.put('quests_v1', JSON.stringify({ v: 1, day: '2026-10-02', at: 1, list: [{ done: true }], days: ['2026-10-02'], paidDay: '', streakPaid: [] }));
  assert.equal(win.Quests.parentLine(win.Quests.read(s), new Date(2026, 9, 2, 9).getTime()), '🔥 1-day streak · today 1 of 1 quests');
  assert.equal(win.Quests.check, undefined, 'no grade: no lobby or game helpers');
});
```

Run: `node --test tests/browser-globals.test.js` → PASS already (Task 1 exports the pure helpers); it guards the rewrite below.

- [ ] **Step 2: Browser part** — in `web/engine/quests.js`, replace the tail

```js
  var exported = { create: create, read: read, streakOf: streakOf, parentLine: parentLine, TEXT: TEXT, ORDER: ORDER,
    ALL_COINS: ALL_COINS, MILESTONES: MILESTONES, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Quests = exported;
})(this);
```

with

```js
  var UI_CSS =
    '.quests{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#FFF8E6;color:#4A3500;font-weight:800;}' +
    '.quests[hidden]{display:none;}' +
    '.quests-title{margin:0 0 8px;}' +
    '.quests-list{margin:0;padding:0;list-style:none;display:grid;gap:6px;}' +
    '.quests-list li{display:flex;gap:8px;align-items:center;font-size:.95rem;}' +
    '.quests-list a{color:inherit;text-decoration:underline;text-underline-offset:3px;}' +
    '.quests-list a:focus-visible{outline:3px solid #4A3500;outline-offset:2px;border-radius:6px;}' +
    '.quests-list .done{opacity:.6;text-decoration:line-through;}' +
    '.quests-streak{margin:10px 0 0;font-size:.95rem;}';

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

    core.renderLobby = function (box) {
      if (!box) return;
      var state = core.state();
      box.innerHTML = '';
      box.appendChild(el('p', 'quests-title', T.title));
      var list = el('ul', 'quests-list');
      state.list.forEach(function (q) {
        var li = el('li');
        li.appendChild(el('span', '', q.done ? '✅' : '⬜'));
        var text = T.quest(q);
        if (!q.done && q.href) {
          var a = el('a', '', text);
          a.href = q.href;
          li.appendChild(a);
        } else {
          li.appendChild(el('span', q.done ? 'done' : '', text));
        }
        list.appendChild(li);
      });
      box.appendChild(list);
      box.appendChild(el('p', 'quests-streak', T.streak(core.streak())));
      box.hidden = !state.list.length;
    };
    return core;
  }

  var exported = { create: create, read: read, streakOf: streakOf, parentLine: parentLine, TEXT: TEXT, ORDER: ORDER,
    ALL_COINS: ALL_COINS, MILESTONES: MILESTONES, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies and games get pick/check for their grade; the parent page (no data-grade) gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && TEXT[grade]) {
      var SH = root.StudyHistory;
      api = mountUi(root, create(root.Learner ? root.Learner.storage : root.localStorage, Date.now, grade, {
        history: function () { return SH && SH.list ? SH.list() : []; },
        due: function () { return root.Recall && root.Recall.dueByApp ? root.Recall.dueByApp() : {}; },
        weak: function (entries) { return SH && SH.weakSpots ? SH.weakSpots(entries, 20) : []; },
        bonus: function (coins) {
          var W = root.Wallet;
          if (!W || !W.addBonus || !W.addBonus(coins)) return false;
          if (W.renderCoins) W.renderCoins();
          return true;
        }
      }));
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Quests = api;
  } catch (e) {}
})(this);
```

- [ ] **Step 3: Check the study-history API names** — confirm `StudyHistory.list()` and `StudyHistory.weakSpots(entries, limit)` exist on the browser global (`grep -n "api.list\|sh.list\|api.weakSpots" web/engine/study-history.js`). If `list` has another name on the global, use that name in the `history` dep and say so.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/browser-globals.test.js tests/quests.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/quests.js tests/browser-globals.test.js
```

---

### Task 4: Lobbies show the quests

Both lobbies get the same markup and the identical inline script (`tests/copies.test.js` compares the last `<script>` of both lobbies).

**Files:** `web/lobby/grade-5.html`, `web/lobby/grade-2.html`, `tests/mastery-wiring.test.js`, `tests/e2e/lobby-e2e.js:124`

- [ ] **Step 1: Wiring test** — append to `tests/mastery-wiring.test.js`:

```js
for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby shows today\'s quests', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/quests.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/mastery.js"'), 'after mastery.js');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/wallet.js"'), 'after wallet.js');
    assert.equal(count(html, '<div class="quests" id="quests" hidden></div>'), 1);
    assert.ok(html.indexOf('id="quests"') < html.indexOf('id="review-due"'), 'above the review card');
    assert.equal(count(html, 'Quests.pick(cards);'), 1);
    assert.equal(count(html, "document.addEventListener('cloud-synced', showQuests);"), 1);
    assert.ok(!html.includes('test bonus'), 'the shop says bonus: it holds tests and quests');
  });
}
```

Run: `node --test tests/mastery-wiring.test.js` → the 2 new tests FAIL.

- [ ] **Step 2: Load it** — in each lobby, after `<script src="../engine/mastery.js" data-grade="gradeN"></script>` add `<script src="../engine/quests.js" data-grade="gradeN"></script>` (N = 5 or 2). The wallet script tag must come before it; if `wallet.js` is loaded after `mastery.js`, put the quests tag right after the `wallet.js` tag instead.

- [ ] **Step 3: Markup** — replace

```html
  <div class="review-due" id="review-due" hidden></div>
```

with

```html
  <div class="quests" id="quests" hidden></div>
  <div class="review-due" id="review-due" hidden></div>
```

- [ ] **Step 4: Script** — after the line

```js
  document.addEventListener('cloud-synced', showReview);
```

add (identical in both lobbies):

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
    Quests.renderLobby(box);
    if (events.length && window.Fx && Fx.celebrate) Fx.celebrate(events, box);
  }
  showQuests();
  document.addEventListener('cloud-synced', showQuests);
```

- [ ] **Step 5: Shop text** — in both lobbies' `SHOP_TEXT.earned`, replace `(bonus ? ' · 📝 ' + bonus + ' test bonus' : '')` with `(bonus ? ' · ✨ ' + bonus + ' bonus' : '')`. In `tests/e2e/lobby-e2e.js:124` change `/📝 90 test bonus/` to `/✨ 90 bonus/`.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/mastery-wiring.test.js tests/copies.test.js tests/review-wiring.test.js tests/english-everywhere.test.js`
Expected: PASS.

- [ ] **Step 7: Stage**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html tests/mastery-wiring.test.js tests/e2e/lobby-e2e.js
```

---

### Task 5: Games tick quests off

**Files:** all 15 `web/subjects/grade-*/*/index.html`, `tests/mastery-wiring.test.js`

- [ ] **Step 1: Test** — in `tests/mastery-wiring.test.js`, inside the per-game test (`app.id + ' reports and shows lesson medals'`):

Replace the assertion that checks

```js
"if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE), el);"
```

with one that checks

```js
"if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE).concat(window.Quests && Quests.check ? Quests.check() : []), el);"
```

and add:

```js
    const qtag = '<script src="../../../engine/quests.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, qtag), 1, 'loads quests.js');
    assert.ok(html.indexOf(qtag) > html.indexOf(tag), 'after mastery.js');
    assert.ok(html.indexOf(qtag) > html.indexOf('<script src="../../../engine/wallet.js"'), 'after wallet.js');
```

Run: `node --test tests/mastery-wiring.test.js` → the 15 game tests FAIL.

- [ ] **Step 2: Load it** — in each game, after `<script src="../../../engine/mastery.js" data-grade="gradeN"></script>` add `<script src="../../../engine/quests.js" data-grade="gradeN"></script>`.

- [ ] **Step 3: Quest events** — in each game's `showMedals`, replace

```js
Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE), el);
```

with

```js
Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE).concat(window.Quests && Quests.check ? Quests.check() : []), el);
```

(keep the `if (window.Fx && Fx.celebrate) ` prefix and the indentation; family B is ES5, which this line already is.)

- [ ] **Step 4: Run the tests**

Run: `node --test tests/mastery-wiring.test.js tests/fx.test.js tests/review-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/subjects tests/mastery-wiring.test.js
```

---

### Task 6: The parent phone line

**Files:** `web/parent/index.html`, `web/parent/phone.js`, `tests/copies.test.js`

- [ ] **Step 1: Test** — in `tests/copies.test.js`, add `'quests'` after `'mastery'` in the parent page's engine list. Run `node --test tests/copies.test.js` → FAIL.

- [ ] **Step 2: Load it** — in `web/parent/index.html`, after `<script src="../engine/mastery.js"></script>` add `<script src="../engine/quests.js"></script>`, and after

```html
    <p class="coins-big" id="kid-coins"></p>
```

add

```html
    <p class="p-note" id="kid-streak"></p>
```

- [ ] **Step 3: Render it** — in `web/parent/phone.js` `renderCoins`, after the line that sets `kid-coins`, add:

```js
    $('kid-streak').textContent = window.Quests ? Quests.parentLine(Quests.read(child.space), Date.now()) : '';
```

- [ ] **Step 4: Run**

Run: `node --test tests/copies.test.js` and `node --check web/parent/phone.js`
Expected: PASS / no output.

- [ ] **Step 5: Stage**

```bash
git add web/parent/index.html web/parent/phone.js tests/copies.test.js
```

---

### Task 7: E2E — lobby quests and a quest done in every game

**Files:** `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`, `tests/e2e/driver-common.page.js`, `tests/e2e/apps-e2e.js`

- [ ] **Step 1: Lobby driver** — in `tests/e2e/lobby-driver.page.js`, before `if (mode === 'nojs') {` add:

```js
  if (mode === 'quests') {
    var qcard = document.querySelector('.subject-card[data-app]'), qapp = qcard.getAttribute('data-app');
    var qkey = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var qitems = {};
    qitems[qapp + '|aa'] = { box: 1, due: qkey(new Date()), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: qitems }));
    __store.removeItem('quests_v1');
    __store.setItem(KEY, JSON.stringify({ v: 1, entries: [] }));
    Quests.pick(Array.prototype.map.call(document.querySelectorAll('.subject-card[data-app]'), function (c) {
      return { app: c.getAttribute('data-app'), title: c.getAttribute('data-app'), href: c.getAttribute('href') };
    }));
    Quests.renderLobby($('quests'));
    r.hidden = $('quests').hidden;
    r.items = Array.prototype.map.call($('quests').querySelectorAll('li'), function (li) { return li.textContent; });
    var link = $('quests').querySelector('li a');
    r.firstHref = link ? link.getAttribute('href') : null;
    r.cardHref = qcard.getAttribute('href');
    r.streakBefore = $('quests').querySelector('.quests-streak').textContent;
    var bonusBefore = (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0;
    var t = Date.now() + 1000, n = 0;
    var entry = function (f) { var e = { id: 'qe' + (n++), type: 'quiz', app: qapp, appTitle: qapp, lessonId: 'l', lessonTitle: 'L', final: false, total: 10, answered: 10, correct: 10, wrong: [], finished: true, stars: 3, points: 0, bestStreak: 0, t: t + n }; for (var k in f) e[k] = f[k]; return e; };
    __store.setItem(KEY, JSON.stringify({ v: 1, entries: [entry({ kind: 'review', lessonTitle: 'Review', stars: 0 }), entry({}), entry({ correct: 12 })] }));
    r.events = Quests.check().map(function (e) { return { big: e.big, icon: e.icon }; });
    r.again = Quests.check().length;
    r.bonusPaid = ((JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0) - bonusBefore;
    Quests.renderLobby($('quests'));
    r.doneCount = $('quests').querySelectorAll('li .done').length;
    r.streakAfter = $('quests').querySelector('.quests-streak').textContent;
    return out(r);
  }
```

(`KEY` is the driver's history key, `__store` the learner storage. Check at the top of `lobby-driver.page.js` that both exist with these names; the review mode above uses them the same way.)

- [ ] **Step 2: Lobby check** — in `tests/e2e/lobby-e2e.js`, after the map assertions add:

```js
  const qs = readOutput(dumpDom(path.join(work, 'profile-quests'), withJsLobby, '#e2e=quests'));
  assert.deepEqual(qs.errors, [], 'quests: page errors');
  assert.equal(qs.hidden, false, 'the quest card shows');
  assert.equal(qs.items.length, 3, 'three quests');
  assert.match(qs.items[0], /🔁/, 'something is due, so slot 1 is a Review quest');
  assert.equal(qs.firstHref, qs.cardHref + '&review=1', 'it opens that game in Review mode');
  assert.match(qs.streakBefore, /Start a streak today!/);
  assert.equal(qs.events[0].big, true, 'all 3 done is the big one');
  assert.equal(qs.events.length, 4, 'all 3 done, then each quest');
  assert.equal(qs.again, 0, 'celebrated once');
  assert.equal(qs.bonusPaid, 3, 'all 3 quests pay 3 coins once');
  assert.equal(qs.doneCount, 3, 'all ticked');
  assert.match(qs.streakAfter, /🔥 1-day streak/);
```

- [ ] **Step 3: A quest done in every game** — in `tests/e2e/driver-common.page.js` `__e2eReview`, right before the line `startReview();` that starts the review round (the first `startReview();` in the function, after `r.due = Recall.dueCount(SH_APP);`), add:

```js
  __store.setItem('quests_v1', JSON.stringify({ v: 1, day: __e2eToday(), at: Date.now(), list: [
    { id: 'review|' + SH_APP, kind: 'review', app: SH_APP, title: SH_TITLE, done: false },
    { id: 'right', kind: 'right', done: false }, { id: 'rounds', kind: 'rounds', done: false }], days: [], paidDay: '', streakPaid: [] }));
```

and right after the existing line that reads `r.fixedEvents = ...` add:

```js
  r.questEvents = (Fx.queued() || []).filter(function (e) { return e.icon === '🎯'; }).length;
  r.questDone = JSON.parse(__store.getItem('quests_v1')).list[0].done;
```

In `tests/e2e/apps-e2e.js` `checkReview`, before its `console.log`, add:

```js
  assert.equal(r.questDone, true, 'a Review round ticks off the Review quest');
  assert.equal(r.questEvents, 1, 'with a quest popup');
```

- [ ] **Step 4: Run every e2e suite**

Run: `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/apps-e2e.js 2`, `node tests/e2e/lobby-e2e.js 5`, `node tests/e2e/lobby-e2e.js 2`, `node tests/e2e/backup-e2e.js 5`, `node tests/e2e/backup-e2e.js 2`, `node tests/e2e/file-check-e2e.js`, `node tests/e2e/migration-e2e.js`.
Expected: all pass. If a failure is a product bug, find the root cause and fix the product code; never weaken an assertion.

- [ ] **Step 5: Stage**

```bash
git add tests/e2e/lobby-driver.page.js tests/e2e/lobby-e2e.js tests/e2e/driver-common.page.js tests/e2e/apps-e2e.js
```

---

### Task 8: Offline cache, README, final check

- [ ] **Step 1:** Run `node tools/update-precache.js`; check `grep -n "engine/quests.js" web/sw.js`.

- [ ] **Step 2: README** — engine list, after the `mastery.js` line:

```
    quests.js                  daily quests, the gentle streak, quest and streak coins
```

Features, after the `**Celebrations:**` line:

```markdown
- **Daily quests:** the lobby offers 3 quests a day fitted to her (a Review that is due, her weakest recent lesson, and a rotating one), never the same twice in a row when there is another choice. All 3 pay 3 coins once a day. The **streak** counts days with at least one quest and survives 2 rest days in any 7; it pays 5, 10, 15 and 20 coins at 7, 14, 30 and 60 days. It never talks about losing a streak.
```

In "A new subject or grade", in the medals step, add: "and load `quests.js` after `mastery.js` (its quest events join the medal popup in `showMedals`)".

- [ ] **Step 3:** Spec status: in `docs/superpowers/specs/2026-10-02-daily-quests-design.md` change `Status: draft 2026-10-02.` to `Status: built 2026-10-02.`

- [ ] **Step 4: Full check** — `node --test` → all pass; all e2e suites as in Task 7 → all pass.

- [ ] **Step 5: Stage**

```bash
git add web/sw.js README.md docs/superpowers/specs/2026-10-02-daily-quests-design.md docs/superpowers/plans/2026-10-02-daily-quests.md
```

---

## Self-review notes

- Spec coverage: picking + fallbacks + rotation (Task 1), done rules, study days, streak rule, pay once (Task 1), sync + backups (Task 2), lobby card + links + streak text (Tasks 3, 4), shop "bonus" text (Task 4), games' popups (Task 5), parent line (Task 6), e2e (Task 7), PRECACHE (Task 8).
- Names: `Quests.pick(cards)`, `Quests.check()`, `Quests.renderLobby(box)`, `Quests.state()`, `Quests.streak()`, `Quests.doneBy(q, todays)`, `Quests.read(storage)`, `Quests.streakOf(days, today)`, `Quests.parentLine(state, nowMs)`, `MERGE.quests`, `#quests`, `.quests-list`, `.quests-streak`, `li .done`.
