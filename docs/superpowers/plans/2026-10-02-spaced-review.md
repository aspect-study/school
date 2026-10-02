# Spaced Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Questions come back on a 1/3/7/14/30-day schedule (Leitner boxes) and a right answer on its due day pays a gap bonus; a Review round in every game plays what is due, and the lobby shows what is due per subject.

**Architecture:** `web/engine/recall.js` swaps its 3-day rest store (`recall_v1`) for a box store (`review_v1`) and owns every rule: keys, boxes, due days, pay, picking, seeding from history, Math skills, and the small lobby/home UI text. `study-kit.js` tells Recall about wrong answers and passes Math's skill bonus through. Each game adds `reviewInfo`, `startReview`, a home card and `?review=1`; lobbies load `recall.js` and show the due card. `sync-core.js` gets a `review` merge rule.

**Tech Stack:** Plain ES5 browser JS (no build step), `node --test` unit tests, headless Chrome e2e drivers in `tests/e2e/`.

**Spec:** `docs/superpowers/specs/2026-10-02-spaced-review-design.md`

**House rules:** never run `git commit` — give the user `git add` + `git commit -m` blocks (no Co-Authored-By). Few comments. Run unit tests from the repo root with `node --test` (`node --test tests/` does not work here). After the work, remind the user the engine files must be copied to both tablets (or deployed).

**Baseline:** before Task 1 run `node --test` and the e2e suites below and note the pass counts:
`node tests/e2e/apps-e2e.js`, `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/lobby-e2e.js 5`, `node tests/e2e/backup-e2e.js`, `node tests/e2e/backup-e2e.js 5`, `node tests/e2e/file-check-e2e.js`, `node tests/e2e/migration-e2e.js`.

---

## File map

| File | Change |
|---|---|
| `web/engine/recall.js` | box store, migration, `keyOf`, `textOf`, `pickDue`, `tidy`, due counts, skills, new TEXT, lobby/home UI helpers, `wantsReview` |
| `web/engine/study-kit.js` | `Recall.missed()` on a wrong answer; `o.extra` points |
| `web/engine/study-history.js` | `kind:'review'`; `weakSpots` skips it; `review_v1` in backups; browser `sh.plain` |
| `web/engine/parent-panel.js` | `review_v1` in the saved backup state |
| `web/engine/sync-core.js` | `review` kind + `MERGE.review` |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | load `recall.js`, due card |
| 7 family C games (`web/subjects/grade-5/{araling-panlipunan,english,filipino,gmrc,pe-health,science,tle}/index.html`) | review wiring |
| 5 family B games (`web/subjects/grade-2/{computer,english,gmrc,makabansa,science}/index.html`) | review wiring |
| 2 family A games (`web/subjects/grade-2/{filipino,math}/index.html`) | review wiring (+ numberline `review:false`) |
| `web/subjects/grade-5/math/index.html` | load `recall.js`, skill review |
| `tests/recall.test.js`, `tests/study-kit.test.js`, `tests/sync.test.js`, `tests/study-history.test.js` | unit tests |
| `tests/review-wiring.test.js` (new) | static wiring checks for all games and lobbies |
| `tests/e2e/driver-common.page.js`, `tests/e2e/apps-e2e.js`, drivers, `tests/e2e/lobby-*.js`, `tests/e2e/backup-e2e.js` | e2e |

No new web files, so `PRECACHE` in `web/sw.js` does not change (`tests/pwa.test.js` keeps passing).

---

### Task 1: Box store, keys and pay in recall.js

**Files:**
- Modify: `web/engine/recall.js` (constants at the top; `questionKey`; the whole `create()` function; `exported`)
- Test: `tests/recall.test.js`

- [ ] **Step 1: Replace the rest-day tests with box tests**

In `tests/recall.test.js`, change the require line to:

```js
const { create, matches, normalize, keyOf, REST_DAYS, TYPED_BONUS, BOX_DAYS, GAP_BONUS, REVIEW_SIZE, TEXT } = require(engineFile('recall.js'));
```

Delete these tests (they describe the old 3-day store): `the rest lasts 3 days and the typed bonus is 5`, `the key covers the app, the mode, the stem and the picture`, `an unhelped right answer pays, then rests until 3 calendar days later`, `the rest counts calendar days, not hours`, `a helped right answer pays half and does not start the rest`, `a typed right answer adds the bonus; a resting one pays nothing at all`, `lesson and exam rest separately`, `old rest dates are pruned and bad data is ignored`, `rest-days live in the learner space given, and an unknown grade is refused`. Keep the others. Add, after the `clock` helper:

```js
const items = (s) => JSON.parse(s.data.review_v1).items;

test('boxes, gap bonuses, round size and the typed bonus', () => {
  assert.equal(REST_DAYS, 3);
  assert.equal(TYPED_BONUS, 5);
  assert.deepEqual(BOX_DAYS, [0, 1, 3, 7, 14, 30]);
  assert.deepEqual(GAP_BONUS, [0, 2, 4, 6, 8, 10]);
  assert.equal(REVIEW_SIZE, 10);
});

test('the key covers the app, the stem, the picture and the answer, but not the mode', () => {
  assert.notEqual(keyOf('a', { q: 'How much?', art: '<svg 1>' }), keyOf('a', { q: 'How much?', art: '<svg 2>' }));
  assert.notEqual(keyOf('a', { q: 'Q', answer: 'x' }), keyOf('a', { q: 'Q', answer: 'y' }));
  assert.notEqual(keyOf('a', { q: 'Q' }), keyOf('b', { q: 'Q' }));
  assert.equal(keyOf('a', { q: 'Q', art: undefined, answer: undefined }), keyOf('a', { q: 'Q', art: '', answer: '' }));
  assert.match(keyOf('a', { q: 'Q' }), /^a\|[0-9a-f]+$/);
});

test('a new question right on her own pays normally and goes to box 2, due in 3 days', () => {
  const s = memory(), now = clock(2026, 10, 30);
  const r = create(s, now, 'grade5');
  assert.equal(r.begin([], 'k').resting, 0);
  assert.equal(r.points(false, 10, 5), 15);
  assert.deepEqual(items(s).k, { box: 2, due: '2026-11-02', t: now() });
  assert.equal(r.begin([], 'k').resting, 3, 'same day: resting 3 more days');
  assert.equal(r.points(false, 10, 5), 0, 'a resting question pays nothing');
  assert.equal(items(s).k.box, 2, 'and its box does not change');
});

test('a due question right on her own pays the gap bonus of its box and moves up', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  r.begin([], 'k'); r.points(false, 10, 0);
  const pays = [];
  for (const days of [3, 7, 14, 30, 30]) {
    now.days(days);
    assert.equal(r.begin([], 'k').resting, 0, 'due after ' + days + ' days');
    pays.push(r.points(false, 10, 0));
  }
  assert.deepEqual(pays, [14, 16, 18, 20, 20], 'box 2..5 bonuses, box 5 stays at 5');
  assert.equal(items(s).k.box, 5);
});

test('the gap counts calendar days, not hours', () => {
  const now = clock(2026, 10, 5);
  now.set(new Date(2026, 9, 5, 23, 59).getTime());
  const r = create(memory(), now, 'grade5');
  r.begin([], 'k'); r.points(false, 10, 0);
  now.set(new Date(2026, 9, 8, 0, 1).getTime());
  assert.equal(r.begin([], 'k').resting, 0);
});

test('a wrong answer sends a due or new question to box 1, due tomorrow', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  r.begin([], 'k'); r.missed();
  assert.deepEqual(items(s).k, { box: 1, due: '2026-10-02', t: now() });
  assert.equal(r.begin([], 'k').resting, 1, 'a same-day retry rests');
  assert.equal(r.points(false, 10, 0), 0, 'and pays nothing');
  now.days(1);
  r.begin([], 'k');
  assert.equal(r.points(false, 10, 0), 12, 'the next day it pays + the box 1 bonus');
  assert.equal(items(s).k.box, 2);
});

test('a wrong answer on a resting question changes nothing', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  r.begin([], 'k'); r.points(false, 10, 0);
  const before = s.data.review_v1;
  r.begin([], 'k'); r.missed();
  assert.equal(s.data.review_v1, before);
});

test('a helped right answer pays half and goes to box 1', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  assert.equal(r.points(true, 10, 5), 5);
  assert.equal(items(s).k.box, 1);
});

test('a typed right answer adds the bonus; a resting one pays nothing at all', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  r.markTyped();
  assert.equal(r.typed(), true);
  assert.equal(r.points(false, 20, 5), 20 + 5 + TYPED_BONUS);
  r.begin([], 'k');
  r.markTyped();
  assert.equal(r.points(false, 20, 5), 0);
  r.begin([], 'other');
  assert.equal(r.typed(), false, 'a new question starts untyped');
});

test('a question with review:false always pays normally and is never stored', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 1), 'grade5');
  r.begin([], 'n', { review: false });
  assert.equal(r.points(false, 10, 5), 15);
  r.begin([], 'n', { review: false });
  r.missed();
  assert.equal(r.points(false, 10, 5), 15);
  assert.equal(s.data.review_v1, undefined);
});

test('the results line counts resting answers and moves in this quiz only', () => {
  const now = clock(2026, 10, 1);
  const r = create(memory(), now, 'grade5');
  const q1 = [];
  r.begin(q1, 'a'); r.points(false, 10, 0);
  r.begin(q1, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), '', 'new questions are not moves');
  const q2 = [];
  r.begin(q2, 'a'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), TEXT.grade5.resultLine(1));
  now.days(3);
  const q3 = [];
  r.begin(q3, 'a'); r.points(false, 10, 0);
  r.begin(q3, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), TEXT.grade5.movedLine(2, 8));
  r.begin([], 'a');
  assert.equal(r.resultLine(), '', 'a new quiz starts the count again');
});

test('the 3-day rest dates become box 2 items, due when the rest ends, once', () => {
  const s = memory({ recall_v1: JSON.stringify({ v: 1, rest: {
    'life-lab|lesson|1a2b': '2026-10-01', 'life-lab|exam|1a2b': '2026-09-30', 'page-turners|lesson|ff': '2026-09-29', junk: 5, 'bad|lesson|zz': 'yesterday',
  } }) });
  create(s, clock(2026, 10, 2), 'grade5');
  const got = items(s);
  assert.deepEqual(Object.keys(got).sort(), ['life-lab|1a2b', 'page-turners|ff']);
  assert.equal(got['life-lab|1a2b'].due, '2026-10-04', 'the later rest wins');
  assert.equal(got['life-lab|1a2b'].box, 2);
  assert.equal(got['page-turners|ff'].due, '2026-10-02');
  assert.ok(s.data.recall_v1, 'the old key is kept as a safety net');
  s.data.review_v1 = JSON.stringify({ v: 1, items: {} });
  create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(items(s), {}, 'it runs only while review_v1 does not exist');
});

test('nothing is written when there is nothing to migrate, and bad data is ignored', () => {
  const s = memory();
  create(s, clock(2026, 10, 2), 'grade5');
  assert.equal(s.data.review_v1, undefined);
  const r = create(memory({ review_v1: '{nope' }), clock(2026, 10, 2), 'grade5');
  assert.equal(r.begin([], 'k').resting, 0);
  const bad = memory({ review_v1: JSON.stringify({ v: 1, items: { k: { box: 9, due: 'x', t: 1 } } }) });
  assert.equal(create(bad, clock(2026, 10, 2), 'grade5').begin([], 'k').resting, 0, 'a broken item counts as new');
});

test('boxes live in the learner space given, and an unknown grade is refused', () => {
  const now = clock(2026, 10, 1);
  const mine = memory(), sister = memory();
  const g5 = create(mine, now, 'grade5');
  g5.begin([], 'k');
  g5.points(false, 10, 0);
  assert.ok(mine.data.review_v1, 'saved as review_v1 in her own space');
  assert.equal(create(sister, now, 'grade5').begin([], 'k').resting, 0, 'another learner has her own boxes');
  assert.throws(() => create(mine, now, 'grade9'));
  assert.throws(() => create(mine, now, null));
});
```

Also change the `Grade 2 text pairs Filipino…` test's line list to include the new lines added in Task 7 later; for now leave it.

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/recall.test.js`
Expected: FAIL — `keyOf is not a function`, `BOX_DAYS` undefined.

- [ ] **Step 3: Implement the box store**

In `web/engine/recall.js`, change the file's header comment and constants to:

```js
/* Loaded by every game and both lobbies, after study-history.js and powerups.js. The pages are decoded as UTF-8, so the text can hold emoji.
   Every question sits in a box (1-5). A right answer on its due day pays a gap bonus and moves it up; a wrong one sends it to box 1.
   A question that is not due yet pays no points. */
(function (root) {
  'use strict';

  var REST_DAYS = 3;
  var TYPED_BONUS = 5;
  var BOX_DAYS = [0, 1, 3, 7, 14, 30];
  var GAP_BONUS = [0, 2, 4, 6, 8, 10];
  var MAX_BOX = 5;
  var REVIEW_SIZE = 10;
  var SEED_DAYS = 14;
```

Replace `questionKey` with:

```js
  // The stem, picture and answer text; the same hash the 3-day rest used, without its lesson/exam part.
  function keyOf(app, info) {
    return app + '|' + hash(String(info.q) + '|' + String(info.art || '') + '|' + String(info.answer || ''));
  }
```

Add after `dayNumber`:

```js
  function dayKeyOf(n) {
    var d = new Date(n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
```

Replace the whole `create` function with:

```js
  function create(storage, now, grade, plain) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Recall needs a grade like "grade5".');
    var KEY = 'review_v1', OLD_KEY = 'recall_v1';
    var current = null, lastQuiz = null, round = { resting: 0, moved: 0, bonus: 0 };
    plain = plain || function (s) { return String(s == null ? '' : s); };

    function today() { return dayNumber(dateKey(now())); }

    function valid(it) {
      return !!it && typeof it === 'object' && it.box >= 1 && it.box <= MAX_BOX && Math.floor(it.box) === it.box &&
        !isNaN(dayNumber(it.due)) && typeof it.t === 'number';
    }

    function read() {
      var raw = null;
      try { raw = storage.getItem(KEY); } catch (e) {}
      try {
        var d = raw ? JSON.parse(raw) : null;
        if (d && d.v === 1 && d.items && typeof d.items === 'object' && !Array.isArray(d.items)) return d;
      } catch (e) {}
      return null;
    }

    function load() { return read() || { v: 1, items: {} }; }

    function write(state) {
      try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }

    function item(key) {
      var it = load().items[key];
      return valid(it) ? it : null;
    }

    function put(key, box) {
      var state = load();
      state.items[key] = { box: box, due: dayKeyOf(today() + BOX_DAYS[box]), t: now() };
      write(state);
    }

    function daysLeft(it) { return it ? Math.max(0, dayNumber(it.due) - today()) : 0; }

    // One-time copy of the 3-day rest dates: each resting question starts in box 2, due when its rest ends.
    function migrate() {
      var raw = null;
      try { if (storage.getItem(KEY) !== null) return; raw = storage.getItem(OLD_KEY); } catch (e) { return; }
      var old = null;
      try { old = raw ? JSON.parse(raw) : null; } catch (e) {}
      if (!old || !old.rest || typeof old.rest !== 'object') return;
      var items = {}, any = false;
      Object.keys(old.rest).forEach(function (k) {
        var p = /^(.*)\|(?:lesson|exam)\|([0-9a-f]+)$/.exec(k), day = dayNumber(old.rest[k]);
        if (!p || isNaN(day)) return;
        var key = p[1] + '|' + p[2], due = day + REST_DAYS;
        if (items[key] && dayNumber(items[key].due) >= due) return;
        items[key] = { box: 2, due: dayKeyOf(due), t: day * 86400000 };
        any = true;
      });
      if (any) write({ v: 1, items: items });
    }
    migrate();

    return {
      text: TEXT[grade],

      // opts.review false: a generated question that never comes back, so it is never stored.
      begin: function (quiz, key, opts) {
        if (quiz !== lastQuiz) { lastQuiz = quiz; round = { resting: 0, moved: 0, bonus: 0 }; }
        var review = !(opts && opts.review === false);
        var it = review ? item(key) : null;
        current = { key: key, review: review, item: it, resting: it && daysLeft(it) > 0 ? daysLeft(it) : 0, typed: false };
        return current;
      },

      clear: function () { current = null; },

      lastKey: function () { return current ? current.key : null; },

      markTyped: function () { if (current) current.typed = true; },

      typed: function () { return !!(current && current.typed); },

      // Called only for a right answer.
      points: function (helped, base, bonus) {
        if (!current) return helped ? base / 2 : base + bonus;
        if (current.resting) { round.resting++; return 0; }
        var typed = current.typed ? TYPED_BONUS : 0;
        if (!current.review) return helped ? base / 2 : base + bonus + typed;
        if (helped) { put(current.key, 1); return base / 2; }
        var from = current.item ? current.item.box : 0, gap = GAP_BONUS[from];
        put(current.key, from ? Math.min(MAX_BOX, from + 1) : 2);
        if (from) { round.moved++; round.bonus += gap; }
        return base + bonus + gap + typed;
      },

      // Called for a wrong answer.
      missed: function () {
        if (current && current.review && !current.resting) put(current.key, 1);
      },

      resultLine: function () {
        return (round.resting ? TEXT[grade].resultLine(round.resting) : '') +
          (round.moved ? TEXT[grade].movedLine(round.moved, round.bonus) : '');
      }
    };
  }
```

Add `movedLine` to both TEXT entries now (the rest of the new text comes in Task 7):

```js
      movedLine: function (n, bonus) { return ' · 📦 ' + n + (n === 1 ? ' question' : ' questions') + ' moved up a box (+' + bonus + ' review bonus)'; },
```

and for grade2:

```js
      movedLine: function (n, bonus) { return ' · 📦 ' + n + ' tanong ang umakyat ng box · ' + n + (n === 1 ? ' question' : ' questions') + ' moved up a box (+' + bonus + ' review bonus)'; },
```

Change `exported` to:

```js
  var exported = { create: create, matches: matches, normalize: normalize, keyOf: keyOf, TEXT: TEXT,
    REST_DAYS: REST_DAYS, TYPED_BONUS: TYPED_BONUS, BOX_DAYS: BOX_DAYS, GAP_BONUS: GAP_BONUS, REVIEW_SIZE: REVIEW_SIZE, SEED_DAYS: SEED_DAYS };
```

In `mountUi`'s `core.ask`, replace the `var cur = core.begin(...)` line with:

```js
      var cur = core.begin(pu.quiz, keyOf(app, { q: pu.q, art: pu.art, answer: right ? right.textContent : '' }), { review: pu.review });
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test tests/recall.test.js`
Expected: PASS (the wiring tests at the bottom still pass; `Math Mastery … never rests` still passes until Task 12).

- [ ] **Step 5: Commit**

```bash
git add web/engine/recall.js tests/recall.test.js
git commit -m "Recall keeps each question in a review box instead of a 3-day rest"
```

---

### Task 2: Picking due questions, seeding from history, pruning, counts

**Files:**
- Modify: `web/engine/recall.js` (the object returned by `create`)
- Test: `tests/recall.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/recall.test.js`:

```js
const info = (q) => ({ q: q.q, answer: q.a, historyQ: q.q, historyAnswer: q.a });
const pool = (n) => Array.from({ length: n }, (_, i) => ({ q: 'Q' + i, a: 'A' + i }));
function setItem(s, app, q, box, due, t = 1) {
  const d = s.data.review_v1 ? JSON.parse(s.data.review_v1) : { v: 1, items: {} };
  d.items[keyOf(app, info(q))] = { box, due, t };
  s.data.review_v1 = JSON.stringify(d);
}

test('pickDue returns only due questions that have a box, most overdue first, then lowest box', () => {
  const s = memory(), p = pool(6);
  setItem(s, 'a', p[0], 3, '2026-10-05');
  setItem(s, 'a', p[1], 2, '2026-09-28');
  setItem(s, 'a', p[2], 1, '2026-10-01');
  setItem(s, 'a', p[3], 4, '2026-10-01');
  setItem(s, 'b', p[4], 1, '2026-09-01');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.pickDue('a', p, info).map((q) => q.q), ['Q1', 'Q2', 'Q3']);
});

test('pickDue takes at most the round size, and counts every due one', () => {
  const s = memory(), p = pool(14);
  p.forEach((q) => setItem(s, 'a', q, 1, '2026-10-01'));
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.equal(r.pickDue('a', p, info).length, 10);
  assert.equal(r.pickDue('a', p, info, 3).length, 3);
  assert.equal(r.dueCount('a'), 14);
  assert.deepEqual(r.dueByApp(), { a: 14 });
});

test('nextDue says when the next questions come due, and how many', () => {
  const s = memory(), p = pool(4);
  setItem(s, 'a', p[0], 2, '2026-10-04');
  setItem(s, 'a', p[1], 2, '2026-10-04');
  setItem(s, 'a', p[2], 3, '2026-10-09');
  setItem(s, 'b', p[3], 1, '2026-10-03');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.nextDue('a'), { days: 2, count: 2 });
  assert.deepEqual(r.nextDue(), { days: 1, count: 1 });
  assert.equal(r.nextDue('c'), null);
});

test('tidy puts her wrong answers from the last 14 days in box 1, due today', () => {
  const s = memory(), p = pool(4), now = clock(2026, 10, 20);
  const day = (d) => new Date(2026, 9, d, 9).getTime();
  const entries = [
    { type: 'quiz', app: 'a', t: day(19), wrong: [{ q: 'Q0', picked: 'x', answer: 'A0' }, { q: 'Q9', picked: 'x', answer: 'A9' }] },
    { type: 'quiz', app: 'a', t: day(1), wrong: [{ q: 'Q1', picked: 'x', answer: 'A1' }] },
    { type: 'quiz', app: 'b', t: day(19), wrong: [{ q: 'Q2', picked: 'x', answer: 'A2' }] },
    { type: 'open', app: 'a', t: day(19) },
  ];
  setItem(s, 'a', p[3], 4, '2026-11-01');
  const r = create(s, now, 'grade5');
  r.tidy('a', p, info, entries);
  const got = items(s);
  assert.deepEqual(got[keyOf('a', info(p[0]))], { box: 1, due: '2026-10-20', t: day(19) });
  assert.equal(got[keyOf('a', info(p[1]))], undefined, 'older than 14 days');
  assert.equal(got[keyOf('a', info(p[2]))], undefined, 'another app');
  assert.equal(got[keyOf('a', info(p[3]))].box, 4, 'a question that has a box keeps it');
});

test('tidy matches history text through the plain function it was given', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 2), 'grade5', (x) => String(x).replace(/<[^>]+>/g, ''));
  const q = { q: '<b>Q</b>', a: '<i>A</i>' };
  r.tidy('a', [q], info, [{ type: 'quiz', app: 'a', t: new Date(2026, 9, 2, 9).getTime(), wrong: [{ q: 'Q', answer: 'A' }] }]);
  assert.ok(items(s)[keyOf('a', info(q))]);
});

test('tidy drops boxes for questions no longer in that game, but keeps other apps and skills', () => {
  const s = memory(), p = pool(2);
  setItem(s, 'a', p[0], 2, '2026-10-01');
  setItem(s, 'a', { q: 'gone', a: 'x' }, 2, '2026-10-01');
  setItem(s, 'b', { q: 'gone', a: 'x' }, 2, '2026-10-01');
  const d = JSON.parse(s.data.review_v1); d.items['a|skill:frac'] = { box: 1, due: '2026-10-01', t: 1 }; s.data.review_v1 = JSON.stringify(d);
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', p, info, []);
  assert.deepEqual(Object.keys(items(s)).sort(), [keyOf('a', info(p[0])), 'a|skill:frac', keyOf('b', { q: 'gone', answer: 'x' })].sort());
});

test('tidy writes nothing when nothing changes', () => {
  const s = memory();
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', pool(2), info, []);
  assert.equal(s.data.review_v1, undefined);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test tests/recall.test.js`
Expected: FAIL — `r.pickDue is not a function`.

- [ ] **Step 3: Implement**

In `create`, add these to the returned object (after `resultLine`; add a comma after `resultLine`'s closing brace):

```js
      // info(q) gives { q, art, answer, historyQ, historyAnswer } for one of the game's questions.
      pickDue: function (app, questions, info, limit) {
        var items = load().items, t = today(), seen = {}, due = [];
        questions.forEach(function (q) {
          var key = keyOf(app, info(q)), it = items[key];
          if (seen[key] || !valid(it) || dayNumber(it.due) > t) return;
          seen[key] = true;
          due.push({ q: q, late: t - dayNumber(it.due), box: it.box, r: Math.random() });
        });
        due.sort(function (a, b) { return b.late - a.late || a.box - b.box || a.r - b.r; });
        return due.slice(0, limit || REVIEW_SIZE).map(function (d) { return d.q; });
      },

      dueByApp: function () {
        var items = load().items, t = today(), counts = {};
        Object.keys(items).forEach(function (k) {
          if (!valid(items[k]) || dayNumber(items[k].due) > t) return;
          var app = k.slice(0, k.indexOf('|'));
          counts[app] = (counts[app] || 0) + 1;
        });
        return counts;
      },

      dueCount: function (app) { return this.dueByApp()[app] || 0; },

      nextDue: function (app) {
        var items = load().items, t = today(), best = null;
        Object.keys(items).forEach(function (k) {
          var it = items[k];
          if (!valid(it) || (app && k.indexOf(app + '|') !== 0)) return;
          var d = dayNumber(it.due) - t;
          if (d <= 0) return;
          if (!best || d < best.days) best = { days: d, count: 1 };
          else if (d === best.days) best.count++;
        });
        return best;
      },

      // Seeds box 1 from her recent wrong answers and drops boxes for questions this game no longer has.
      tidy: function (app, questions, info, entries) {
        var state = load(), keys = {}, byText = {}, changed = false, prefix = app + '|';
        questions.forEach(function (q) {
          var i = info(q), key = keyOf(app, i);
          keys[key] = true;
          byText[plain(i.historyQ) + '\n' + plain(i.historyAnswer)] = key;
        });
        Object.keys(state.items).forEach(function (k) {
          if (k.indexOf(prefix) === 0 && k.indexOf(prefix + 'skill:') !== 0 && !keys[k]) { delete state.items[k]; changed = true; }
        });
        var from = today() - SEED_DAYS;
        (entries || []).forEach(function (e) {
          if (!e || e.type !== 'quiz' || e.app !== app || !Array.isArray(e.wrong) || dayNumber(dateKey(e.t)) < from) return;
          e.wrong.forEach(function (w) {
            var key = w && byText[w.q + '\n' + w.answer];
            if (key && !state.items[key]) { state.items[key] = { box: 1, due: dayKeyOf(today()), t: e.t }; changed = true; }
          });
        });
        if (changed) write(state);
      },
```

- [ ] **Step 4: Run and see them pass**

Run: `node --test tests/recall.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/engine/recall.js tests/recall.test.js
git commit -m "Recall picks due questions, seeds recent mistakes and counts what is due"
```

---

### Task 3: Math Mastery skill boxes

**Files:**
- Modify: `web/engine/recall.js` (returned object)
- Test: `tests/recall.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('a skill moves up after 2 of 3 right, and back to box 1 otherwise', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  assert.equal(r.gradeSkill('m', 'frac', 2, 3), 0, 'a new skill goes to box 2 but is not a move');
  assert.equal(items(s)['m|skill:frac'].box, 2);
  assert.equal(r.gradeSkill('m', 'frac', 3, 3), 0, 'not due yet: unchanged');
  assert.equal(items(s)['m|skill:frac'].box, 2);
  now.days(3);
  assert.equal(r.skillBonus('m', 'frac'), 4, 'box 2 gap bonus while due');
  assert.equal(r.gradeSkill('m', 'frac', 6, 9), 1, '2 of 3 or better moves up');
  assert.equal(items(s)['m|skill:frac'].box, 3);
  assert.equal(r.skillBonus('m', 'frac'), 0, 'no bonus once it is resting');
  now.days(7);
  assert.equal(r.gradeSkill('m', 'frac', 1, 3), 0);
  assert.equal(items(s)['m|skill:frac'].box, 1);
});

test('a skill needs at least 3 problems in the round to be graded', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 1), 'grade5');
  assert.equal(r.gradeSkill('m', 'frac', 2, 2), 0);
  assert.equal(s.data.review_v1, undefined);
});

test('skillsDue lists due skills, most overdue first, up to the limit', () => {
  const s = memory({ review_v1: JSON.stringify({ v: 1, items: {
    'm|skill:a': { box: 2, due: '2026-10-01', t: 1 }, 'm|skill:b': { box: 1, due: '2026-09-20', t: 1 },
    'm|skill:c': { box: 3, due: '2026-10-09', t: 1 }, 'm|skill:d': { box: 1, due: '2026-10-02', t: 1 },
  } }) });
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.skillsDue('m', ['a', 'b', 'c', 'd', 'e']), ['b', 'a', 'd']);
  assert.deepEqual(r.skillsDue('m', ['a', 'b', 'c', 'd'], 2), ['b', 'a']);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test tests/recall.test.js`
Expected: FAIL — `r.gradeSkill is not a function`.

- [ ] **Step 3: Implement**

Add to the returned object:

```js
      // Math Mastery makes up new problems, so it keeps a box per skill (lesson id) instead of per question.
      gradeSkill: function (app, id, right, total) {
        if (total < 3) return 0;
        var key = app + '|skill:' + id, it = item(key);
        if (it && daysLeft(it) > 0) return 0;
        var from = it ? it.box : 0, pass = right * 3 >= total * 2;
        put(key, pass ? (from ? Math.min(MAX_BOX, from + 1) : 2) : 1);
        return pass && from ? 1 : 0;
      },

      skillBonus: function (app, id) {
        var it = item(app + '|skill:' + id);
        return it && daysLeft(it) === 0 ? GAP_BONUS[it.box] : 0;
      },

      skillsDue: function (app, ids, limit) {
        var t = today();
        return ids.map(function (id) { return { id: id, it: item(app + '|skill:' + id) }; })
          .filter(function (s) { return s.it && dayNumber(s.it.due) <= t; })
          .sort(function (a, b) { return dayNumber(a.it.due) - dayNumber(b.it.due) || a.it.box - b.it.box; })
          .slice(0, limit || 3)
          .map(function (s) { return s.id; });
      },
```

- [ ] **Step 4: Run and see them pass**

Run: `node --test tests/recall.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/engine/recall.js tests/recall.test.js
git commit -m "Recall keeps a review box per Math Mastery skill"
```

---

### Task 4: Study kit tells Recall about wrong answers and pays Math's extra

**Files:**
- Modify: `web/engine/study-kit.js:66-86` (`answer`)
- Test: `tests/study-kit.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/study-kit.test.js` (it already has `page({ recall })`):

```js
test('a wrong answer tells Recall, so the question goes back to box 1', () => {
  const calls = [];
  const recall = { points() { return 10; }, missed() { calls.push('missed'); }, resultLine() { return ''; } };
  const { kit } = page({ recall });
  kit.answer(false, { helped: false });
  kit.answer(true, { helped: false });
  assert.deepEqual(calls, ['missed']);
});

test('extra points are added to an unhelped right answer only', () => {
  const { kit } = page();
  assert.equal(kit.answer(true, { helped: false, extra: 6 }), RULES.POINTS_PER_CORRECT + 6);
  assert.equal(kit.answer(true, { helped: true, extra: 6 }), RULES.POINTS_PER_CORRECT / 2);
  assert.equal(kit.answer(false, { helped: false, extra: 6 }), 0);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test tests/study-kit.test.js`
Expected: FAIL — `calls` is empty; extra not added.

- [ ] **Step 3: Implement**

In `web/engine/study-kit.js` `answer`, change the points line and the wrong branch:

```js
          pts = win.Recall ? win.Recall.points(!!o.helped, base, bonus) : o.helped ? base / 2 : base + bonus;
          if (!o.helped && o.extra) pts += o.extra;
```

```js
        } else {
          if (win.Recall && win.Recall.missed) win.Recall.missed();
          if (!(o.shield !== false && win.PowerUps && win.PowerUps.shield())) streak = 0;
          if (win.Fx) win.Fx.wrong();
        }
```

Also update the comment above `answer` to:

```js
      // opts.shield: false for answers that never had power-ups, so an unused Streak Shield is not spent.
      // opts.extra: points added to an unhelped right answer (Math Mastery's review bonus).
```

- [ ] **Step 4: Run and see them pass**

Run: `node --test tests/study-kit.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/engine/study-kit.js tests/study-kit.test.js
git commit -m "Study kit sends wrong answers to Recall and pays Math's review bonus"
```

---

### Task 5: Cloud sync merges review boxes

**Files:**
- Modify: `web/engine/sync-core.js` (`kindOf`, `MERGE`, `readLocal`, `writeLocal`)
- Test: `tests/sync.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/sync.test.js`:

```js
test('review boxes: the later answer wins per question, in either order', () => {
  const a = { v: 1, items: { q1: { box: 3, due: '2026-10-09', t: 200 }, q2: { box: 1, due: '2026-10-03', t: 100 } } };
  const b = { v: 1, items: { q1: { box: 1, due: '2026-10-03', t: 150 }, q2: { box: 2, due: '2026-10-05', t: 300 }, q3: { box: 2, due: '2026-10-04', t: 1 } } };
  const want = { v: 1, items: { q1: a.items.q1, q2: b.items.q2, q3: b.items.q3 } };
  assert.deepEqual(MERGE.review(a, b), want);
  assert.deepEqual(MERGE.review(b, a), want);
  assert.deepEqual(MERGE.review(MERGE.review(a, b), b), want, 'safe to repeat');
});

test('review boxes: at the same time the higher box wins; junk is dropped', () => {
  const a = { v: 1, items: { q: { box: 2, due: '2026-10-05', t: 5 }, bad: 7 } };
  const b = { v: 1, items: { q: { box: 3, due: '2026-10-09', t: 5 } } };
  assert.deepEqual(MERGE.review(a, b).items, { q: b.items.q });
  assert.deepEqual(MERGE.review(b, a).items, { q: b.items.q });
  assert.deepEqual(MERGE.review(null, b), { v: 1, items: b.items });
});
```

In the `which keys sync, and how` test add:

```js
  assert.equal(kindOf('review_v1'), 'review');
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test tests/sync.test.js`
Expected: FAIL — `MERGE.review is not a function`.

- [ ] **Step 3: Implement**

In `kindOf`, after the recall line:

```js
    if (key === 'review_v1') return 'review';
```

In `MERGE`, after `recall`:

```js
    // Review boxes: per question the later answer wins; at the same time the higher box, then the later due day.
    review: function (a, b) {
      var items = {};
      [a, b].forEach(function (x) {
        if (!x || !isObj(x.items)) return;
        Object.keys(x.items).forEach(function (k) {
          var it = x.items[k], have = items[k];
          if (!isObj(it) || typeof it.t !== 'number') return;
          if (!have || it.t > have.t || (it.t === have.t && (it.box > have.box || (it.box === have.box && dayNum(it.due) > dayNum(have.due))))) items[k] = it;
        });
      });
      return { v: 1, items: items };
    },
```

In `readLocal` and `writeLocal`, change both `kind === 'recall' || kind === 'profile' || kind === 'requests'` conditions to:

```js
kind === 'recall' || kind === 'review' || kind === 'profile' || kind === 'requests'
```

Check the file stays ASCII: `node -e "const s=require('fs').readFileSync('web/engine/sync-core.js','utf8');if(/[^\x00-\x7f]/.test(s))throw 'non-ascii'"` prints nothing.

- [ ] **Step 4: Run and see them pass**

Run: `node --test tests/sync.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/engine/sync-core.js tests/sync.test.js
git commit -m "Sync review boxes between devices: the later answer wins"
```

---

### Task 6: Study history, backups and the parent panel know about review

**Files:**
- Modify: `web/engine/study-history.js:162-171` (`quizStarted`), `:274-279` (`weakSpots`), `:323` (`STATE_KEY_RE`), bootstrap (`sh.plain`)
- Modify: `web/engine/parent-panel.js:329`
- Test: `tests/study-history.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/study-history.test.js` (it uses the file's own `setup()` helper):

```js
test('a Review round is saved with kind review and kept out of Needs practice', () => {
  const { sh } = setup();
  const id = sh.quizStarted('life-lab', 'Life Lab', 'review', 'Review', false, 3, 'review');
  sh.quizAnswered(id, false, 'Q1', 'x', 'A1');
  sh.quizAnswered(id, false, 'Q2', 'x', 'A2');
  sh.quizAnswered(id, false, 'Q3', 'x', 'A3');
  sh.quizAnswered(id, false, 'Q4', 'x', 'A4');
  sh.quizAnswered(id, false, 'Q5', 'x', 'A5');
  const entries = sh.list();
  assert.equal(entries[0].kind, 'review');
  assert.deepEqual(sh.weakSpots(entries), []);
});
```

In the existing backup export/import tests that list `recall_v1` in `state`, add a `review_v1: '{"v":1,"items":{}}'` value to the stored data and to the expected `state` (around lines 626-649), so they prove `review_v1` is saved and restored.

- [ ] **Step 2: Run and see them fail**

Run: `node --test tests/study-history.test.js`
Expected: FAIL — `kind` undefined; `review_v1` missing from the exported state.

- [ ] **Step 3: Implement**

`quizStarted`:

```js
      if (kind === 'walkthrough' || kind === 'case' || kind === 'review') fields.kind = kind;
```

`weakSpots`, first line of the `forEach`:

```js
        if (e.type !== 'quiz' || !(e.answered > 0) || e.kind === 'review') return;
```

`STATE_KEY_RE`:

```js
    var STATE_KEY_RE = /^(?:[a-z0-9]+_points_v1|wallet_v1|recall_v1|review_v1)$/;
```

Bootstrap, after `sh.create = create;`:

```js
    sh.plain = plain;
```

`web/engine/parent-panel.js` `savedState`:

```js
        var keys = ['wallet_v1', 'recall_v1', 'review_v1'];
```

- [ ] **Step 4: Run and see them pass**

Run: `node --test`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add web/engine/study-history.js web/engine/parent-panel.js tests/study-history.test.js
git commit -m "History records Review rounds apart from Needs practice; backups keep review boxes"
```

---

### Task 7: Review text, home card, lobby card and the ?review=1 flag

**Files:**
- Modify: `web/engine/recall.js` (TEXT, `UI_CSS`, `mountUi`, bootstrap)
- Test: `tests/recall.test.js`

- [ ] **Step 1: Write the failing tests**

Replace the `Grade 2 text pairs Filipino with English…` test with:

```js
test('Grade 2 text pairs Filipino with English; buttons are English only', () => {
  const t = TEXT.grade2;
  const lines = [t.resting(2), t.resultLine(3), t.typePrompt, t.typePromptResting, t.notQuite, t.typedRight, t.movedLine(2, 8),
    t.lobbyTitle, t.caughtUp(null), t.caughtUp({ days: 1, count: 5 }), t.cardTitle, t.cardDue(3, 3), t.cardDue(10, 23), t.cardNext(2), t.cardNext(0), t.reviewTitle];
  for (const line of lines) assert.match(line, / · /, line);
  assert.equal(t.check, 'Check');
  assert.equal(t.show, 'Show choices');
  assert.deepEqual(Object.keys(TEXT.grade2).sort(), Object.keys(TEXT.grade5).sort());
  assert.equal(TEXT.grade5.resting(1), '⏳ Resting: points again in 1 day');
});

test('Grade 5 review text', () => {
  const t = TEXT.grade5;
  assert.equal(t.cardDue(4, 4), '4 due');
  assert.equal(t.cardDue(10, 23), '10 of 23 due');
  assert.equal(t.cardNext(1), 'Next: tomorrow');
  assert.equal(t.cardNext(5), 'Next: in 5 days');
  assert.equal(t.cardNext(0), 'Answer some questions first');
  assert.equal(t.caughtUp({ days: 1, count: 5 }), '🎉 All caught up! Next review: tomorrow (5)');
  assert.equal(t.caughtUp(null), '🎉 All caught up!');
});

test('homeCard says how many are due, or when the next ones are', () => {
  const s = memory({ review_v1: JSON.stringify({ v: 1, items: {
    'a|1': { box: 1, due: '2026-10-01', t: 1 }, 'b|1': { box: 2, due: '2026-10-04', t: 1 },
  } }) });
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.homeCard('a'), { ready: true, title: '🔁 Review', line: '1 due' });
  assert.deepEqual(r.homeCard('b'), { ready: false, title: '🔁 Review', line: 'Next: in 2 days' });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test tests/recall.test.js`
Expected: FAIL — `t.lobbyTitle` undefined.

- [ ] **Step 3: Implement**

Add to `TEXT.grade5`:

```js
      lobbyTitle: '🔁 Review due',
      caughtUp: function (next) { return '🎉 All caught up!' + (next ? ' Next review: ' + whenEn(next.days) + ' (' + next.count + ')' : ''); },
      cardTitle: '🔁 Review',
      cardDue: function (n, total) { return total > n ? n + ' of ' + total + ' due' : n + ' due'; },
      cardNext: function (days) { return days ? 'Next: ' + whenEn(days) : 'Answer some questions first'; },
      reviewTitle: 'Review'
```

Add to `TEXT.grade2`:

```js
      lobbyTitle: '🔁 Balikan · Review due',
      caughtUp: function (next) { return '🎉 Tapos na lahat! · All caught up!' + (next ? ' Susunod · Next review: ' + whenEn(next.days) + ' (' + next.count + ')' : ''); },
      cardTitle: '🔁 Balikan · Review',
      cardDue: function (n, total) { return (total > n ? n + ' sa ' + total : String(n)) + ' na babalikan · ' + (total > n ? n + ' of ' + total + ' due' : n + ' due'); },
      cardNext: function (days) { return days ? 'Susunod · Next: ' + whenEn(days) : 'Sumagot muna ng mga tanong · Answer some questions first'; },
      reviewTitle: 'Balikan · Review'
```

Above `var TEXT`, add:

```js
  function whenEn(days) { return days === 1 ? 'tomorrow' : 'in ' + days + ' days'; }
```

Add to the object returned by `create` (it uses `this.dueCount`, so it must be called as `Recall.homeCard(...)`):

```js
      homeCard: function (app) {
        var T = TEXT[grade], due = this.dueCount(app), next = due ? null : this.nextDue(app);
        return { ready: due > 0, title: T.cardTitle, line: due ? T.cardDue(Math.min(due, REVIEW_SIZE), due) : T.cardNext(next ? next.days : 0) };
      },
```

Append to `UI_CSS`:

```js
    '.review-empty{opacity:.55;filter:grayscale(.6);cursor:default;}' +
    '.review-due{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#EEF4FF;color:#23395B;font-weight:800;}' +
    '.review-due p{margin:0 0 8px;}' +
    '.review-chips{display:flex;flex-wrap:wrap;gap:8px;}' +
    '.review-chip{display:inline-block;padding:8px 14px;border-radius:999px;background:#fff;border:2px solid #9BB4E0;color:#23395B;text-decoration:none;font-weight:800;}' +
    '.review-chip:focus-visible{outline:3px solid #23395B;outline-offset:2px;}';
```

In `mountUi`, before `return core;`:

```js
    // The lobby card: one chip per subject with questions due, each opening that game's Review round.
    core.renderLobby = function (box, cards) {
      if (!box) return;
      var counts = core.dueByApp(), chips = [];
      Array.prototype.forEach.call(cards, function (card) {
        var n = counts[card.getAttribute('data-app')];
        if (!n) return;
        var a = el('a', 'review-chip'), title = card.querySelector('.subject-title');
        var href = card.getAttribute('href');
        a.href = href + (href.indexOf('?') >= 0 ? '&' : '?') + 'review=1';
        a.textContent = (title ? title.textContent : card.getAttribute('data-app')) + ' ' + n;
        chips.push(a);
      });
      box.innerHTML = '';
      box.appendChild(el('p', '', chips.length ? T.lobbyTitle : T.caughtUp(core.nextDue())));
      if (chips.length) {
        var row = el('div', 'review-chips');
        chips.forEach(function (c) { row.appendChild(c); });
        box.appendChild(row);
      }
      box.hidden = false;
    };
```

Change the bootstrap at the bottom to capture `?review=1` before `study-kit.js` strips the address, and to pass the history `plain` function:

```js
  try {
    var script = root.document && root.document.currentScript;
    var SH = root.StudyHistory;
    root.Recall = mountUi(root, create(root.Learner ? root.Learner.storage : root.localStorage, Date.now,
      script ? script.getAttribute('data-grade') : null, SH && SH.plain));
    root.Recall.wantsReview = /(^|[?&])review=1(&|$)/.test(root.location ? root.location.search : '');
  } catch (e) {}
```

- [ ] **Step 4: Run and see them pass**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/engine/recall.js tests/recall.test.js
git commit -m "Review card text for games and lobbies, in both grades"
```

---

### Task 8: Lobbies show what is due

**Files:**
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html`
- Create: `tests/review-wiring.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/review-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby loads recall.js and shows the review card', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/recall.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/study-history.js"'), 'after study-history.js');
    assert.equal(count(html, '<div class="review-due" id="review-due" hidden></div>'), 1);
    assert.ok(html.indexOf('id="review-due"') < html.indexOf('<div class="grid">'), 'above the games');
    assert.equal(count(html, "Recall.renderLobby(document.getElementById('review-due'), document.querySelectorAll('.subject-card[data-app]'))"), 1);
  });
}
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/review-wiring.test.js`
Expected: FAIL (2 tests).

- [ ] **Step 3: Implement in both lobbies**

In `web/lobby/grade-5.html`, after `<script src="../engine/study-history.js" data-grade="grade5"></script>` add:

```html
<script src="../engine/recall.js" data-grade="grade5"></script>
```

Directly above `<div class="grid">` add:

```html
  <div class="review-due" id="review-due" hidden></div>
```

At the end of the last `<script>` block's function body (after `P.mount(...)`), and also before the early `return;` in its `if (!P || !SH || !SH.list)` branch so it shows even without the parent panel, add:

```js
  if (window.Recall && Recall.renderLobby) Recall.renderLobby(document.getElementById('review-due'), document.querySelectorAll('.subject-card[data-app]'));
```

Then make the test's exact string appear once: put that line once, as the first line inside the `(function(){` of that block, instead of twice. Final block start:

```js
(function(){
  if (window.Recall && Recall.renderLobby) Recall.renderLobby(document.getElementById('review-due'), document.querySelectorAll('.subject-card[data-app]'));
  var SH = window.StudyHistory, P = window.ParentPanel;
```

Do the same in `web/lobby/grade-2.html` with `data-grade="grade2"`.

The lobbies already list `recall: 'Recall'` in their `data-file-check` GLOBALS, so a missing file shows the red bar.

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: PASS (including `tests/pages.test.js`, which checks the file-check snippet is unchanged).

- [ ] **Step 5: Commit**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html tests/review-wiring.test.js
git commit -m "Lobbies show which subjects have review questions due"
```

---

### Task 9: Review in the 7 Grade 5 family C games

**Files:**
- Modify: `web/subjects/grade-5/{araling-panlipunan,english,filipino,gmrc,pe-health,science,tle}/index.html`
- Test: `tests/review-wiring.test.js`

All 7 share these names: `LESSONS` (each with `.quiz`), `prepareQuestion`, `currentQuizSet`, `currentQuizMeta`, `startFinalExam`, `retryQuiz`, `goHome`, `renderHome` building `html` with an `item-card final-card` card, and `SH.quizAnswered(… q.art ? q.q + ' [' + q.options[q.correct] + ']' : q.q, …)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/review-wiring.test.js`:

```js
const FAMILY = {
  c: ['history-explorers', 'wikaharian', 'page-turners', 'rise-shine', 'rally-ready', 'craft-corner', 'life-lab'],
  b: ['byte-buddies', 'word-train', 'growing-good', 'batang-bayani', 'science-detectives'],
  a: ['kuwentista', 'block-bot'],
};

for (const id of [].concat(FAMILY.c, FAMILY.b, FAMILY.a)) {
  test(id + ' has a Review round', () => {
    const html = fs.readFileSync(appFile(id), 'utf8');
    assert.equal(count(html, 'function reviewInfo('), 1);
    assert.equal(count(html, 'function reviewPool('), 1);
    assert.equal(count(html, 'function startReview('), 1);
    assert.equal(count(html, 'Recall.pickDue(SH_APP, reviewPool(), reviewInfo)'), 1);
    assert.equal(count(html, 'Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : [])'), 1);
    assert.equal(count(html, "'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review')"), 1, 'history kind review');
    assert.equal(count(html, 'Recall.homeCard(SH_APP)'), 1, 'home card');
    assert.equal(count(html, 'Recall.wantsReview'), 1, '?review=1 starts it');
    assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview();"), 1, 'retry replays review');
  });
}
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/review-wiring.test.js`
Expected: FAIL for all 14 games.

- [ ] **Step 3: Implement in `web/subjects/grade-5/science/index.html`**

After `prepareQuestion`, add:

```js
// The same fields offerQuestion and SH.quizAnswered use, so the review key and history text match.
function reviewInfo(q){
  const answer = q.options[q.correct];
  return { q:q.q, art:q.art, answer:Recall.textOf(answer), historyQ: q.art ? q.q + ' [' + answer + ']' : q.q, historyAnswer:answer };
}
function reviewPool(){
  return LESSONS.flatMap(l => l.quiz.map(prepareQuestion));
}
```

After `startFinalExam`, add `startReview` — a copy of this file's `startFinalExam` with the question set, meta and history lines replaced:

```js
function startReview(){
  if(!window.Recall) return;
  currentQuizSet = Recall.pickDue(SH_APP, reviewPool(), reviewInfo);
  if(!currentQuizSet.length){ goHome(); return; }
  currentQuizMeta = {id:'review', title:Recall.text.reviewTitle};
  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, 'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review') : null;
  quizIdx = 0;
  quizScore = 0;
  missedQuestions = [];
  kit.startRound();
  document.getElementById('quizTitle').textContent = Recall.text.reviewTitle;
  document.getElementById('passageBox').innerHTML = '';
  renderQuestion();
  showScreen('quizScreen');
}
```

(In the other 6 games, copy that game's own `startFinalExam` body from `kit.startRound();` to the end, because the title/passage element ids differ.)

In `renderHome`, right after the final-card `html += …;` statement, add:

```js
  const rc = window.Recall ? Recall.homeCard(SH_APP) : null;
  if(rc) html += `<div class="item-card${rc.ready ? '' : ' review-empty'}" role="button" tabindex="0" ${rc.ready ? 'onclick="startReview()" onkeydown="cardKey(event)"' : 'aria-disabled="true"'}>
    <div class="icon">🔁</div>
    <div class="info">
      <h3>${rc.title}</h3>
      <p>${rc.line}</p>
    </div>
  </div>`;
```

At the top of `retryQuiz`:

```js
  if (currentQuizMeta.id === 'review') return startReview();
```

Replace the last line of the script, `renderHome();`, with:

```js
if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
renderHome();
if (window.Recall && Recall.wantsReview) startReview();
```

Add `Recall.textOf` to `web/engine/recall.js` `mountUi` (before `return core;`), since every game uses it:

```js
    // The text a button shows for this HTML, as Recall.ask reads it with textContent.
    core.textOf = function (html) {
      var d = doc.createElement('div');
      d.innerHTML = String(html == null ? '' : html);
      return d.textContent;
    };
```

- [ ] **Step 4: Repeat Step 3 in the other 6 family C games**

For `araling-panlipunan`, `english`, `filipino`, `gmrc`, `pe-health`, `tle`: the same `reviewInfo`, `reviewPool`, home card, retry line and last lines. `startReview` = the shown first 6 lines + that file's own `startFinalExam` lines from `kit.startRound();` to the closing `}`, with any title text it sets replaced by `Recall.text.reviewTitle`. Check each file's `renderHome` uses `html +=` and `cardKey` (all 7 do, verified in planning with `grep -c 'item-card final-card" role="button"'`).

- [ ] **Step 5: Run tests**

Run: `node --test tests/review-wiring.test.js`
Expected: the 7 family C tests PASS (B and A still fail).

- [ ] **Step 6: Commit**

```bash
git add web/engine/recall.js web/subjects/grade-5 tests/review-wiring.test.js
git commit -m "Grade 5 games get a Review round"
```

---

### Task 10: Review in the 5 Grade 2 family B games

**Files:**
- Modify: `web/subjects/grade-2/{computer,english,gmrc,makabansa,science}/index.html`

All 5 share: `lessons` (lowercase), `prepareQuestion(item)`, `buildQuizSet`, `decode`, `SH_TRUE`/`SH_FALSE`, `qIdx`, `score`, `resetPc()`, `showScreen('quiz')`, the `btn-retry` listener, `goHome`, and a string-built `renderHome` with `list.innerHTML = finalCard + lessonCards;`. Only `computer` passes `art: item.pic` and puts `[answer]` in the history question.

- [ ] **Step 1: Implement in `web/subjects/grade-2/computer/index.html`**

After `buildQuizSet`, add:

```js
  // The same fields offerQuestion and SH.quizAnswered use, so the review key and history text match.
  function reviewInfo(item){
    var right = item.type === 'tf' ? null : item.options.filter(function(o){ return o.correct; })[0];
    var answer = item.type === 'tf' ? (item.answer ? SH_TRUE : SH_FALSE) : (right || {}).text;
    return { q: item.q, art: item.pic, answer: right ? Recall.textOf(decode(right.text)) : '',
      historyQ: item.pic ? item.q + ' [' + answer + ']' : item.q, historyAnswer: answer };
  }
  function reviewPool(){
    return [].concat.apply([], lessons.map(function(l){ return l.quiz.map(prepareQuestion); }));
  }
```

In the other 4 games use the same function but with `art: undefined` and `historyQ: item.q` (their `offerQuestion` passes no `art` and their `SH.quizAnswered` passes `item.q`):

```js
  function reviewInfo(item){
    var right = item.type === 'tf' ? null : item.options.filter(function(o){ return o.correct; })[0];
    var answer = item.type === 'tf' ? (item.answer ? SH_TRUE : SH_FALSE) : (right || {}).text;
    return { q: item.q, art: undefined, answer: right ? Recall.textOf(decode(right.text)) : '', historyQ: item.q, historyAnswer: answer };
  }
```

`decode` is defined later in the file as a function declaration, so it is hoisted and safe to call.

After `startFinalExam`, add:

```js
  function startReview(){
    if (!window.Recall) return;
    currentQuizSet = Recall.pickDue(SH_APP, reviewPool(), reviewInfo);
    if (!currentQuizSet.length){ goHome(); return; }
    currentQuizMeta = { id: 'review', title: Recall.text.reviewTitle };
    historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, 'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review') : null;
    qIdx = 0; score = 0; missedQuestions = []; kit.startRound(); resetPc();
    showScreen('quiz');
    renderQuestion();
  }
```

(Copy the `qIdx = 0; …` line and the two after it from that file's own `startFinalExam`; the robot/plant reset call differs per game, e.g. `resetPc()`.)

In `renderHome`, replace `list.innerHTML = finalCard + lessonCards;` with:

```js
    var rc = window.Recall ? Recall.homeCard(SH_APP) : null;
    var reviewCard = rc ? '<div class="card lesson-card' + (rc.ready ? '' : ' review-empty') + '">' +
      '<div class="lesson-top">' +
        '<svg class="lesson-icon" viewBox="0 0 76 76"><circle cx="38" cy="38" r="34" fill="var(--amber-soft)"/><text x="38" y="50" font-size="34" text-anchor="middle">🔁</text></svg>' +
        '<div class="lesson-info">' +
          '<div class="lesson-title">' + rc.title + '</div>' +
          '<div class="lesson-tag-label">' + rc.line + '</div>' +
        '</div>' +
      '</div>' +
      (rc.ready ? '<button class="btn" id="btn-review">Start</button>' : '') +
    '</div>' : '';
    list.innerHTML = finalCard + reviewCard + lessonCards;
    var reviewBtn = document.getElementById('btn-review');
    if (reviewBtn) reviewBtn.addEventListener('click', startReview);
```

In the `btn-retry` listener, make the first line:

```js
    if (currentQuizMeta.id === 'review') return startReview();
```

Replace the final `  renderHome();` line with:

```js
  if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
  renderHome();
  if (window.Recall && Recall.wantsReview) startReview();
```

- [ ] **Step 2: Repeat in `english`, `gmrc`, `makabansa`, `science`** with the 4-game `reviewInfo` above.

- [ ] **Step 3: Run tests**

Run: `node --test tests/review-wiring.test.js`
Expected: family B tests PASS.

- [ ] **Step 4: Commit**

```bash
git add web/subjects/grade-2 tests/review-wiring.test.js
git commit -m "Grade 2 card games get a Review round"
```

---

### Task 11: Review in the 2 Grade 2 family A games

**Files:**
- Modify: `web/subjects/grade-2/filipino/index.html` (Kuwentista), `web/subjects/grade-2/math/index.html` (Block Bot)

Both use `LESSONS`, `prepareQuestion(q)`, `quizIdx`, `quizScore`, `showScreen(quizScreen)`, `retryLesson`, `goHome`, and a DOM-built `renderHome` that appends `finalCard` to `grid`. Their buttons set `b.textContent = opt`, so the key answer is the raw option text.

- [ ] **Step 1: Kuwentista (`grade-2/filipino`)**

After `prepareQuestion`:

```js
// The same fields offerQuestion and SH.quizAnswered use, so the review key and history text match.
function reviewInfo(q){
  const answer = q.options[q.correct];
  return { q:q.q, art:undefined, answer, historyQ:q.q, historyAnswer:answer };
}
function reviewPool(){
  return LESSONS.flatMap(l => l.quiz.map(prepareQuestion));
}
```

After `startFinalExam`:

```js
function startReview(){
  if(!window.Recall) return;
  currentQuizSet = Recall.pickDue(SH_APP, reviewPool(), reviewInfo);
  if(!currentQuizSet.length){ goHome(); return; }
  currentQuizMeta = {id:'review', title:Recall.text.reviewTitle};
  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, 'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review') : null;
  quizIdx = 0;
  quizScore = 0;
  missedQuestions = [];
  kit.startRound();
  renderQuestion();
  showScreen(quizScreen);
}
```

In `renderHome`, after `grid.appendChild(finalCard);`:

```js
  const rc = window.Recall ? Recall.homeCard(SH_APP) : null;
  if(rc){
    const reviewCard = document.createElement('button');
    reviewCard.className = 'lesson-card' + (rc.ready ? '' : ' review-empty');
    reviewCard.disabled = !rc.ready;
    reviewCard.onclick = startReview;
    reviewCard.innerHTML = `
      <div class="lesson-emoji">🔁</div>
      <div class="lesson-info">
        <h3>${rc.title}</h3>
        <p>${rc.line}</p>
      </div>
      ${rc.ready ? '<div class="go-btn">Start</div>' : ''}
    `;
    grid.appendChild(reviewCard);
  }
```

First line of `retryLesson`:

```js
  if (currentQuizMeta.id === 'review') return startReview();
```

Replace the last `renderHome();` with:

```js
if (window.Recall) Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : []);
renderHome();
if (window.Recall && Recall.wantsReview) startReview();
```

- [ ] **Step 2: Block Bot (`grade-2/math`)**

Same as Kuwentista, but `reviewInfo` and `reviewPool` are:

```js
function reviewInfo(q){
  const answer = q.options[q.correct];
  return { q:q.q, art:q.art, answer, historyQ:historyQuestion(q), historyAnswer:answer };
}
// Generated number-line lessons never repeat a question, so they have no review.
function reviewPool(){
  return LESSONS.filter(l => !l.generate).flatMap(l => l.quiz.map(prepareQuestion));
}
```

In `renderQuestion`'s number-line branch, add `review:false` to its `offerQuestion({ … })` call:

```js
    offerQuestion({ art:q.art, review:false, quiz:currentQuizSet, exam:currentQuizMeta.id === 'final', before:document.getElementById('q-numberline'), options:[], tip:NUMBERLINE_TIP, q:`${q.start} + ${q.jumps} = ?`, historyId:historyQuizId, streak:kit.streak(), index:quizIdx, rerender:renderQuestion });
```

- [ ] **Step 3: Run tests**

Run: `node --test`
Expected: all PASS, including every test in `tests/review-wiring.test.js`.

- [ ] **Step 4: Commit**

```bash
git add web/subjects/grade-2/filipino/index.html web/subjects/grade-2/math/index.html
git commit -m "Kuwentista and Block Bot get a Review round"
```

---

### Task 12: Math Mastery reviews by skill

**Files:**
- Modify: `web/subjects/grade-5/math/index.html`
- Test: `tests/recall.test.js` (the `Math Mastery …` test), `tests/review-wiring.test.js`

- [ ] **Step 1: Update the failing tests**

In `tests/recall.test.js` replace the `Math Mastery pays double in the mock exam but never rests questions` test with:

```js
test('Math Mastery pays double in the mock exam, never rests questions, and reviews by skill', () => {
  const html = fs.readFileSync(appFile('math-mastery'), 'utf8');
  assert.equal(count(html, "kit.answer(correct, { helped: helped, exam: currentQuizMeta.id === 'final', extra: extra });"), 1);
  assert.equal(count(html, 'kit.answer(ok, { shield: false });'), 5, 'walkthrough and case-study steps never spend a Streak Shield');
  const tag = '<script src="../../../engine/recall.js" data-grade="grade5"></script>';
  assert.equal(count(html, tag), 1, 'recall.js loaded for skill boxes');
  assert.ok(html.indexOf(tag) < html.indexOf('<script src="../../../engine/study-kit.js"'));
  assert.equal(count(html, 'Recall.ask('), 0, 'questions never rest');
  assert.equal(count(html, 'offerQuestion('), 0);
});
```

Append to `tests/review-wiring.test.js`:

```js
test('math-mastery reviews due skills with fresh problems', () => {
  const html = fs.readFileSync(appFile('math-mastery'), 'utf8');
  assert.equal(count(html, 'function startReview('), 1);
  assert.equal(count(html, 'Recall.skillsDue(SH_APP, LESSONS.map(l => l.id), REVIEW_SKILLS)'), 1);
  assert.equal(count(html, 'Recall.gradeSkill(SH_APP, id, skillTally[id].right, skillTally[id].total)'), 1);
  assert.equal(count(html, 'Recall.skillBonus(SH_APP, q.skill)'), 1);
  assert.equal(count(html, "'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review')"), 1);
  assert.equal(count(html, 'Recall.homeCard(SH_APP)'), 1);
  assert.equal(count(html, 'Recall.wantsReview'), 1);
  assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview();"), 1);
});
```

Run: `node --test tests/recall.test.js tests/review-wiring.test.js` — Expected: FAIL.

- [ ] **Step 2: Load recall.js**

After `<script src="../../../engine/powerups.js" data-grade="grade5"></script>` add:

```html
<script src="../../../engine/recall.js" data-grade="grade5"></script>
```

- [ ] **Step 3: Tag problems with their skill and tally them**

Near `FINAL_EXAM_PER_LESSON`, add:

```js
const REVIEW_SKILLS = 3, REVIEW_PER_SKILL = 3;
let skillTally = {}, reviewBonus = 0;
// Object.assign does not call Math.random, so the generators' random order is unchanged.
function forSkill(lesson, qs){ return qs.map(q => Object.assign(q, { skill: lesson.id })); }
```

In `startQuiz`, change the set line to:

```js
  currentQuizSet = forSkill(lesson, buildQuizSet(lesson));
```

In `startFinalExam`, change the loop body to:

```js
    qs = qs.concat(forSkill(l, l.generate(FINAL_EXAM_PER_LESSON)));
```

In both `startQuiz` and `startFinalExam`, after `missedQuestions = [];` add:

```js
  skillTally = {}; reviewBonus = 0;
```

- [ ] **Step 4: Add startReview**

After `startFinalExam`:

```js
function startReview(){
  if(!window.Recall) return;
  const ids = Recall.skillsDue(SH_APP, LESSONS.map(l => l.id), REVIEW_SKILLS);
  if(!ids.length){ goHome(); return; }
  currentQuizSet = [].concat(...ids.map(id => { const l = LESSONS.find(x => x.id === id); return forSkill(l, l.generate(REVIEW_PER_SKILL)); }));
  currentQuizMeta = {id:'review', title:Recall.text.reviewTitle};
  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, 'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review') : null;
  quizIdx = 0;
  quizScore = 0;
  missedQuestions = [];
  skillTally = {}; reviewBonus = 0;
  kit.startRound();
  renderQuestion();
  showScreen(quizScreen);
}
```

- [ ] **Step 5: Pay the bonus, tally, grade**

In `selectOption`, replace `kit.answer(correct, { helped: helped, exam: currentQuizMeta.id === 'final' });` with:

```js
  const extra = currentQuizMeta.id === 'review' && correct && !helped && window.Recall ? Recall.skillBonus(SH_APP, q.skill) : 0;
  reviewBonus += extra;
  if(q.skill){
    const t = skillTally[q.skill] = skillTally[q.skill] || { right: 0, total: 0 };
    t.total++;
    if(correct && !helped) t.right++;
  }
  kit.answer(correct, { helped: helped, exam: currentQuizMeta.id === 'final', extra: extra });
```

In `finishQuiz`, after `kit.saveProgress(progress);`:

```js
  let moved = 0;
  if(window.Recall) Object.keys(skillTally).forEach(id => { moved += Recall.gradeSkill(SH_APP, id, skillTally[id].right, skillTally[id].total); });
  roundMoved = moved;
```

Declare `let roundMoved = 0;` next to `skillTally`. In `renderResults`, replace the `points-earned` line with:

```js
  document.getElementById('points-earned').textContent = kit.roundLine('this round') + (roundMoved && window.Recall ? Recall.text.movedLine(roundMoved, reviewBonus) : '');
```

- [ ] **Step 6: Home card, retry, ?review=1**

In `renderHome`, after `grid.appendChild(finalCard);`:

```js
  const rc = window.Recall ? Recall.homeCard(SH_APP) : null;
  if(rc){
    const reviewCard = document.createElement('button');
    reviewCard.className = 'lesson-card' + (rc.ready ? '' : ' review-empty');
    reviewCard.disabled = !rc.ready;
    reviewCard.onclick = ()=>startReview();
    reviewCard.innerHTML = `
      <div class="lesson-emoji">🔁</div>
      <div class="lesson-info">
        <h3>${rc.title}</h3>
        <p>${rc.line}</p>
      </div>
      ${rc.ready ? '<div class="go-btn">Start</div>' : ''}
    `;
    grid.appendChild(reviewCard);
  }
```

First line of `retryLesson`:

```js
  if (currentQuizMeta.id === 'review') return startReview();
```

Replace the last `renderHome();` with:

```js
renderHome();
if (window.Recall && Recall.wantsReview) startReview();
```

(Math has no fixed questions, so no `Recall.tidy`.)

- [ ] **Step 7: Run tests**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add web/subjects/grade-5/math/index.html tests/recall.test.js tests/review-wiring.test.js
git commit -m "Math Mastery reviews due skills with fresh problems"
```

---

### Task 13: E2E — review rounds, keys, lobby card, backups

**Files:**
- Modify: `tests/e2e/driver-common.page.js`, `tests/e2e/apps-e2e.js`, `tests/e2e/driver-family-{a,b,c}.page.js`, `tests/e2e/driver-math.page.js`, `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`, `tests/e2e/backup-e2e.js`

- [ ] **Step 1: Update the recall scenario to boxes**

In `driver-common.page.js` `__e2eRecall`, replace the block that rewrites `store.rest` with one that makes every box due today, and clear boxes before the exam round so it starts fresh:

```js
function __e2eRecall(startLesson, next, startExam) {
  var key = 'review_v1';
  var r = {};
  r.first = __e2eRecallRound(startLesson, next, 'wrong');
  r.second = __e2eRecallRound(startLesson, next, 'wrong');
  var store = JSON.parse(__store.getItem(key));
  var d = new Date();
  var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  Object.keys(store.items).forEach(function (k) { store.items[k].due = today; });
  __store.setItem(key, JSON.stringify(store));
  r.boxesBefore = Object.keys(store.items).map(function (k) { return store.items[k].box; });
  r.third = __e2eRecallRound(startLesson, next, 'right');
  __store.setItem(key, JSON.stringify({ v: 1, items: {} }));
  r.exam = __e2eRecallRound(startExam, next, null);
  __e2eOut({ recall: r, hasRecall: !!window.Recall });
}
```

In `apps-e2e.js` `checkRecall`, change the third-round assertions:

```js
  assert.ok(third.typedBoxes > 0, 'the chosen lesson has a typed question');
  assert.equal(third.resting, 0, 'due questions pay again');
  assert.equal(out.recall.boxesBefore.every((b) => b === 2), true, 'the first round put every question in box 2');
  assert.equal(third.points, perfect(10, third.total) + 5 * third.typedBoxes + 4 * third.total, 'typed answers add 5, box 2 adds 4 each');
  assert.match(third.resultText, /📦/, 'the results screen says questions moved up');
```

These replace the old `third.resting` / `third.points` lines; keep the rest of `checkRecall` (the exam round starts from empty boxes, so `perfect(20, exam.total)` still holds).

- [ ] **Step 2: Add a review scenario to every family**

Append to `driver-common.page.js`:

```js
// Every question's reviewInfo key must equal the key Recall used when it was shown.
function __e2eReview(startLesson, next) {
  var r = { keysMatch: 0, keysWrong: 0 };
  startLesson();
  for (var k = 0; k < currentQuizSet.length; k++) {
    var q = currentQuizSet[__e2eIndex()];
    if (Recall.lastKey() === Recall.keyOf(SH_APP, reviewInfo(q))) r.keysMatch++; else r.keysWrong++;
    __e2eAnswer(k !== 0);
    next();
  }
  r.dueToday = Recall.dueCount(SH_APP);
  var store = JSON.parse(__store.getItem('review_v1'));
  var d = new Date();
  var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  Object.keys(store.items).forEach(function (key) { store.items[key].due = today; });
  __store.setItem('review_v1', JSON.stringify(store));
  r.due = Recall.dueCount(SH_APP);
  startReview();
  r.reviewTotal = currentQuizSet.length;
  r.reviewTitle = currentQuizMeta.title;
  for (var j = 0; j < r.reviewTotal; j++) { __e2eAnswer(true); next(); }
  var quizzes = __e2eHistory().filter(function (e) { return e.type === 'quiz'; });
  r.kind = quizzes[quizzes.length - 1].kind;
  r.points = quizzes[quizzes.length - 1].points;
  r.resultText = document.getElementById('points-earned').textContent;
  startReview();
  r.retryTotal = currentQuizMeta.id === 'review' ? currentQuizSet.length : 0;
  __e2eOut({ review: r });
}
```

`Recall.keyOf` is not exposed on the browser object yet: in `web/engine/recall.js` `mountUi`, before `return core;`, add `core.keyOf = keyOf;`.

`__e2eIndex()` returns the current question index: add to each family driver file — family C and A: `function __e2eIndex() { return quizIdx; }`; family B: `function __e2eIndex() { return qIdx; }`.

In each of `driver-family-a.page.js`, `driver-family-b.page.js`, `driver-family-c.page.js`, next to the `recall` mode line, add (using that file's own lesson-start and next calls as in its `recall` line, e.g. family C):

```js
  if (mode === 'review') return __e2eReview(function () { currentLessonIdx = 0; startQuiz(); }, nextQuestion);
```

In `apps-e2e.js`, add (a wrong answer is due tomorrow and a right one in 3 days, so nothing is due today until the driver moves the days):

```js
function checkReview(app, out) {
  assert.deepEqual(out.errors, [], 'review: page errors');
  const r = out.review;
  assert.equal(r.keysWrong, 0, 'reviewInfo gives the same key Recall used');
  assert.ok(r.keysMatch > 0);
  assert.equal(r.dueToday, 0, 'nothing is due on the day it was answered');
  assert.equal(r.reviewTotal, Math.min(10, r.due), 'a review round takes up to 10 due questions');
  assert.equal(r.kind, 'review');
  assert.match(r.resultText, /📦/, 'moved up a box');
  assert.equal(r.retryTotal, Math.min(10, r.due - r.reviewTotal), 'what was just answered rests; retry plays only what is still due');
  console.log('  review: ' + r.reviewTotal + ' of ' + r.due + ' due, ' + r.points + ' pts');
}
```

Call it in the app loop, next to `checkRecall`:

```js
    if (app.family !== 'math') checkReview(app, readOutput(dumpDom(path.join(work, 'profile-review-' + app.slug), recallFile, '#e2e=review')));
```

- [ ] **Step 3: Math skill review e2e**

In `driver-math.page.js`, add a mode:

```js
  if (mode === 'review') {
    currentLessonIdx = 0; startQuiz();
    var n = currentQuizSet.length;
    for (var k = 0; k < n; k++) { selectOption(currentQuizSet[quizIdx].correct); nextQuestion(); }
    var store = JSON.parse(__store.getItem('review_v1'));
    var skill = SH_APP + '|skill:' + LESSONS[0].id;
    var before = store.items[skill];
    var d = new Date();
    store.items[skill].due = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    __store.setItem('review_v1', JSON.stringify(store));
    startReview();
    var total = currentQuizSet.length;
    for (var j = 0; j < total; j++) { selectOption(currentQuizSet[quizIdx].correct); nextQuestion(); }
    var after = JSON.parse(__store.getItem('review_v1')).items[skill];
    return __e2eOut({ review: { before: before.box, after: after.box, total: total, points: kit.sessionPoints(), resultText: document.getElementById('points-earned').textContent } });
  }
```

In `apps-e2e.js`, stage Math with recall too (change `const recallFile = app.family !== 'math' && stage(...)` to always stage), and add for math:

```js
    if (app.family === 'math') {
      const r = readOutput(dumpDom(path.join(work, 'profile-review-' + app.slug), recallFile, '#e2e=review')).review;
      assert.equal(r.before, 2, 'a perfect lesson quiz puts the skill in box 2');
      assert.equal(r.after, 3, 'a perfect review moves it to box 3');
      assert.equal(r.total, 3, 'one due skill = 3 fresh problems');
      assert.equal(r.points, 3 * (10 + 4) + 5, 'RULES: 10 a question + box 2 bonus 4 each, +5 streak bonus on the 3rd in a row');
      assert.match(r.resultText, /📦/);
    }
```

- [ ] **Step 4: Lobby card e2e**

In `lobby-driver.page.js`, add a mode `review` that writes a `review_v1` with one due item for the first card's app and one future item, reloads the card, and reports it:

```js
  if (mode === 'review') {
    var card = document.querySelector('.subject-card[data-app]');
    var app = card.getAttribute('data-app');
    var d = new Date(), key = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var later = new Date(); later.setDate(later.getDate() + 2);
    var items = {};
    items[app + '|aa'] = { box: 1, due: key(d), t: 1 };
    items[app + '|bb'] = { box: 2, due: key(later), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: items }));
    var box = document.getElementById('review-due');
    Recall.renderLobby(box, document.querySelectorAll('.subject-card[data-app]'));
    var chip = box.querySelector('.review-chip');
    var first = { hidden: box.hidden, text: box.textContent, chips: box.querySelectorAll('.review-chip').length, href: chip && chip.getAttribute('href') };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: {} }));
    Recall.renderLobby(box, document.querySelectorAll('.subject-card[data-app]'));
    r.review = { first: first, empty: box.textContent, app: app, cardHref: card.getAttribute('href') };
    out(r);
    return;
  }
```

(Put it next to the `testscore` branch; `mode`, `r` and `out` are the driver's own.)

In `lobby-e2e.js`, after the test-score checks:

```js
const rv = readOutput(dumpDom(path.join(work, 'profile-review'), withJsLobby, '#e2e=review')).review;
assert.equal(rv.first.hidden, false);
assert.equal(rv.first.chips, 1);
assert.equal(rv.first.href, rv.cardHref + '&review=1');
assert.match(rv.first.text, /1$/);
assert.match(rv.empty, /🎉/);
```

- [ ] **Step 5: Backup e2e**

In `backup-e2e.js`, the lobby now loads `recall.js`, which copies the seeded `recall_v1` entry (`'x|quiz|1'` — it does not match `lesson|exam`, so nothing is copied and no `review_v1` is written). Keep the exported-keys assertion as it is; if the run shows `review_v1` in `exportedKeys`, add it to the expected list.

- [ ] **Step 6: Run every e2e suite**

Run each, expect all PASS:

```bash
node tests/e2e/apps-e2e.js
node tests/e2e/apps-e2e.js 5
node tests/e2e/lobby-e2e.js
node tests/e2e/lobby-e2e.js 5
node tests/e2e/backup-e2e.js
node tests/e2e/backup-e2e.js 5
node tests/e2e/file-check-e2e.js
node tests/e2e/migration-e2e.js
node --test
```

If `checkPlay` fails in a game: the play mode stages the page *without* recall.js, so it should be unchanged; look for a `startReview`/`homeCard` call that runs without a `window.Recall` guard.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e web/engine/recall.js
git commit -m "E2E: review rounds, matching keys, Math skills and the lobby card"
```

---

### Task 14: Docs and final check

**Files:**
- Modify: `README.md` (the section that lists engine files / how a new game is wired), `docs/superpowers/specs/2026-10-02-spaced-review-design.md` (Status line)

- [ ] **Step 1: README**

In the "add a new game" checklist, add: "Add `reviewInfo`, `reviewPool`, `startReview`, the `Recall.homeCard` card, the `currentQuizMeta.id === 'review'` retry line and the `Recall.tidy` / `Recall.wantsReview` lines (see `tests/review-wiring.test.js`)."

- [ ] **Step 2: Spec status**

Change the spec's first line under the title to `Status: built 2026-10-02.`

- [ ] **Step 3: Full run**

Run: `node --test` and every e2e suite from Task 13 Step 6. Expected: all PASS. Compare the counts with the baseline.

- [ ] **Step 4: Commit and hand off**

```bash
git add README.md docs/superpowers/specs/2026-10-02-spaced-review-design.md
git commit -m "Document the Review round wiring"
```

Tell the user: copy (or deploy) `web/engine/recall.js`, `study-kit.js`, `study-history.js`, `parent-panel.js`, `sync-core.js`, both lobbies and all 15 game pages to the tablets; the first open of each game seeds her recent mistakes into Review.
