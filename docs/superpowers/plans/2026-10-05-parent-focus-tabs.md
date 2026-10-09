# Parent Focus and Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Parent view (tablet lobbies and the parent phone page) becomes tabs: 🎯 Focus (opens first) ranks subjects by how much help they need and lists the weakest lessons and the questions to fix with a Still missing / Fixed chip; 📚 Subjects shows every lesson with its medal and % right; 🕒 Activity keeps the day log; 🪙 Rewards; ⚙️ Settings (tablets only). The default range becomes Last 30 days.

**Architecture:** A new pure engine file `web/engine/insights.js` groups study history quiz entries by subject, lesson and question, and reads review boxes (`review_v1`) to tell fixed from still missing. `study-history.js` starts saving each wrong answer's review key (`Recall.lastKey()`) and time. `parent-panel.js` injects its own CSS, switches tabs and renders Focus and Subjects; the three pages only regroup their existing markup into tab panels.

**Tech Stack:** Plain ES5 browser scripts (IIFE + `module.exports` for Node), `node --test` unit tests, headless Chrome e2e (`tests/e2e/lobby-e2e.js`).

**Spec:** `docs/superpowers/specs/2026-10-05-parent-focus-tabs-design.md`

**House rules for every task:**
- Never run `git commit`. Each task ends by staging its files and giving the user a `git add` + `git commit -m '...'` block with no `Co-Authored-By` line; the user commits.
- Comments only where the code isn't obvious. Match the style of `parent-panel.js` and `mastery.js`.
- `study-history.js` and `insights.js` must stay ASCII-only (the pages that load them declare no charset). Write `—` and friends, never the character.
- Run unit tests from the repo root: `node --test`.

---

## File map

| File | What it does |
|---|---|
| `web/engine/insights.js` (new) | `build(entries, { subjects, items })`, `lessonRows(subject, masteryEntry)`, `status(key, missedAt, items)` |
| `web/engine/study-history.js` | wrong answers keep `key` and `t`; `create` takes an optional `currentKey` reader |
| `web/engine/parent-panel.js` | CSS, tabs, summary tiles, Focus, Subjects, default range 30, subject filter only on Activity |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | tab markup, `insights.js` script tag, dead CSS removed |
| `web/parent/index.html`, `web/parent/phone.js`, `web/parent/parent.css` | tab markup, `insights.js`, medals move into Subjects |
| `web/sw.js`, `tests/paths.js` | precache and stage `insights.js` |
| `tests/insights.test.js`, `tests/insights-wiring.test.js` (new) | unit and wiring tests |
| `tests/study-history.test.js`, `tests/browser-globals.test.js` | key/time tests, browser load test |
| `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js` | tabs, tiles, Focus, Subjects |
| `README.md` | Parent panel section |

---

### Task 1: Wrong answers keep the review key and the time

**Files:**
- Modify: `web/engine/study-history.js` (`create`, `api.quizAnswered`, the browser binding at the bottom)
- Test: `tests/study-history.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/study-history.test.js`, change the existing assertion at line 95 (the wrong answer is now saved with its time; the clock advanced 2 minutes after `start`):

```js
  assert.deepEqual(e.wrong, [{ q: 'Which is a “noun”?', picked: 'run', answer: 'cat', t: start + 2 * 60000 }]);
```

Append these tests at the end of the file:

```js
test('a wrong answer keeps when she missed it and the review key of the question being asked', () => {
  const storage = memStorage();
  const clock = makeClock();
  let key = 'page-turners|abc123';
  const sh = create(storage, clock.now, 'grade5', () => key);
  const id = sh.quizStarted('page-turners', 'Page Turners', '1', 'Nouns', false, 3);
  clock.advance(1);
  sh.quizAnswered(id, false, 'Pick the noun', 'run', 'cat');
  sh.quizAnswered(id, true, 'Pick the verb', 'run', 'run');
  key = null;
  sh.quizAnswered(id, false, 'Pick the adjective', 'cat', 'red');
  assert.deepEqual(saved(storage)[0].wrong, [
    { q: 'Pick the noun', picked: 'run', answer: 'cat', t: clock.ms, key: 'page-turners|abc123' },
    { q: 'Pick the adjective', picked: 'cat', answer: 'red', t: clock.ms },
  ]);
});

test('a key reader that throws does not lose the answer', () => {
  const storage = memStorage();
  const clock = makeClock();
  const sh = create(storage, clock.now, 'grade5', () => { throw new Error('no Recall'); });
  const id = sh.quizStarted('page-turners', 'Page Turners', '1', 'Nouns', false, 1);
  sh.quizAnswered(id, false, 'Pick the noun', 'run', 'cat');
  assert.deepEqual(saved(storage)[0].wrong, [{ q: 'Pick the noun', picked: 'run', answer: 'cat', t: clock.ms }]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/study-history.test.js`
Expected: FAIL. The wrong answers have no `t` and no `key`.

- [ ] **Step 3: Implement**

In `web/engine/study-history.js`, change the `create` signature:

```js
  // currentKey() gives the review_v1 key of the question being asked (Recall.lastKey), or null.
  function create(storage, now, grade, currentKey) {
```

Replace `api.quizAnswered` with:

```js
    function keyNow() {
      try {
        var k = currentKey ? currentKey() : null;
        return typeof k === 'string' && k ? k : null;
      } catch (e) { return null; }
    }

    api.quizAnswered = function (id, isCorrect, q, picked, answer, typed) {
      var key = isCorrect ? null : keyNow();
      update(id, function (e) {
        e.answered++;
        if (isCorrect) e.correct++;
        else {
          var w = { q: plain(q), picked: plain(picked), answer: plain(answer), t: now() };
          if (key) w.key = key;
          e.wrong.push(w);
        }
        if (typed) e.typed = (e.typed || 0) + 1;
      });
    };
```

In the browser binding at the bottom, pass the reader. `Recall` loads after this file, so it is looked up at answer time:

```js
    var sh = create(store, Date.now, grade, function () { return root.Recall && root.Recall.lastKey ? root.Recall.lastKey() : null; });
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/study-history.test.js`
Expected: PASS.

- [ ] **Step 5: Check the key is the question being answered in every game**

`Recall.lastKey()` is the key `Recall.ask` set for the current question; every game's quiz calls `offerQuestion` (which calls `Recall.ask`) before the answer, except Grade 5 Math, which never calls `Recall.ask`, so its key is `null`. Confirm:

Run: `grep -L "offerQuestion(" $(grep -l "SH.quizAnswered" web/subjects/*/*/index.html)`
Expected: only `web/subjects/grade-5/math/index.html`.

If any other file is listed, stop and report it: that game's wrong answers would get a stale key.

- [ ] **Step 6: Run every unit test, then stage**

Run: `node --test`
Expected: PASS.

```bash
git add web/engine/study-history.js tests/study-history.test.js
git commit -m 'Keep the time and the review key of each wrong answer, so the Parent view can tell a fixed question from one she still misses'
```

---

### Task 2: `insights.js`, the pure grouping

**Files:**
- Create: `web/engine/insights.js`
- Test: `tests/insights.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/insights.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { build, lessonRows, status } = require(engineFile('insights.js'));

const SUBJECTS = [{ app: 'page-turners', title: 'English' }, { app: 'math-mastery', title: 'Math' }, { app: 'life-lab', title: 'Science' }];
let n = 0;
function quiz(app, lessonTitle, answered, correct, wrong, extra) {
  n++;
  return Object.assign({ id: 'q' + n, type: 'quiz', app, appTitle: app, lessonTitle, answered, correct, total: answered,
    wrong: wrong || [], t: 1000 * n, updatedAt: 1000 * n + 500 }, extra);
}
const miss = (q, picked, answer, more) => Object.assign({ q, picked, answer }, more);

test('status: fixed after a right answer since the miss, missing until then, blank when nothing says', () => {
  const items = {
    k2: { box: 2, due: '2026-10-08', t: 500 },
    k1: { box: 1, due: '2026-10-06', t: 500 },
    kGone: { box: 3, due: '2026-10-08', t: 500, gone: true },
  };
  assert.equal(status('k2', 400, items), 'fixed');
  assert.equal(status('k2', 600, items), 'missing', 'graded before the miss: the box does not know about it');
  assert.equal(status('k1', 400, items), 'missing');
  assert.equal(status('kGone', 400, items), '');
  assert.equal(status('nope', 400, items), '');
  assert.equal(status('', 400, items), '');
  assert.equal(status('k2', 400, null), '');
});

test('build ranks subjects by questions to fix, then % right, and lists every subject', () => {
  const r = build([
    quiz('page-turners', 'Nouns', 10, 8, [miss('Pick the noun', 'run', 'cat'), miss('Pick the verb', 'cat', 'run')]),
    quiz('math-mastery', 'Rounding', 10, 5, [miss('Round 4.67', '4.6', '4.7')]),
    { id: 'o', type: 'open', app: 'life-lab', appTitle: 'Life Lab', t: 1 },
  ], { subjects: SUBJECTS, items: {} });
  assert.deepEqual(r.subjects.map((s) => [s.title, s.answered, s.correct, s.pct, s.toFix, s.fixed, s.quizzes]), [
    ['English', 10, 8, 80, 2, 0, 1],
    ['Math', 10, 5, 50, 1, 0, 1],
    ['Science', 0, 0, null, 0, 0, 0],
  ]);
  assert.deepEqual([r.answered, r.correct, r.pct, r.toFix, r.fixed], [20, 13, 65, 3, 0]);
});

test('equal questions to fix rank the lower % right first; an app not in the list still shows', () => {
  const r = build([
    quiz('page-turners', 'Nouns', 10, 9, [miss('A', 'x', 'y')]),
    quiz('math-mastery', 'Rounding', 10, 6, [miss('B', 'x', 'y')]),
    quiz('old-app', 'Old', 4, 4, [], { appTitle: 'Old App' }),
  ], { subjects: SUBJECTS.slice(0, 2), items: {} });
  assert.deepEqual(r.subjects.map((s) => s.title), ['Math', 'English', 'Old App']);
});

test('lessons: review rounds left out, weak at 5+ answers under 80%, weakest first, special lesson names', () => {
  const r = build([
    quiz('math-mastery', 'Rounding', 10, 4),
    quiz('math-mastery', 'Rounding', 5, 5),
    quiz('math-mastery', 'Adding', 4, 1),
    quiz('math-mastery', 'Pangwakas', 6, 3, [], { final: true }),
    quiz('math-mastery', 'Dough problem', 5, 4, [], { kind: 'walkthrough' }),
    quiz('math-mastery', 'Bibingka', 5, 2, [], { kind: 'case' }),
    quiz('math-mastery', 'Review', 10, 0, [], { kind: 'review' }),
  ], { subjects: SUBJECTS, items: {} });
  const math = r.subjects.find((s) => s.app === 'math-mastery');
  assert.deepEqual(math.lessons.map((l) => [l.title, l.answered, l.correct, l.pct, l.quizzes, l.weak]), [
    ['Adding', 4, 1, 25, 1, false],
    ['Case Study: Bibingka', 5, 2, 40, 1, true],
    ['Final Mock Exam', 6, 3, 50, 1, true],
    ['Rounding', 15, 9, 60, 2, true],
    ['UPAC Walkthrough: Dough problem', 5, 4, 80, 1, false],
  ]);
  assert.equal(math.answered, 45, 'the review round still counts toward the subject');
});

test('questions: grouped across quizzes, repeated wrong pick flagged, to fix before fixed, then most missed', () => {
  const items = { 'math-mastery|k1': { box: 2, due: '2026-10-08', t: 9000 } };
  const r = build([
    quiz('math-mastery', 'Rounding', 5, 3, [miss('Round 4.67', '4.6', '4.7', { t: 100 }), miss('0.35 + 1.2', '0.47', '1.55', { t: 110, key: 'math-mastery|k1' })]),
    quiz('math-mastery', 'Review', 3, 1, [miss('Round 4.67', '4.6', '4.7', { t: 200 }), miss('Round 2.35', '2.4', '2.3', { t: 210 })], { kind: 'review' }),
    quiz('math-mastery', 'Rounding', 5, 4, [miss('Round 4.67', '5', '4.7', { t: 300 })]),
  ], { subjects: SUBJECTS, items });
  const math = r.subjects.find((s) => s.app === 'math-mastery');
  assert.deepEqual(math.questions.map((q) => [q.q, q.count, q.lastPick, q.answer, q.repeatedPick, q.status, q.lesson]), [
    ['Round 4.67', 3, '5', '4.7', '4.6', '', 'Rounding'],
    ['Round 2.35', 1, '2.4', '2.3', '', '', ''],
    ['0.35 + 1.2', 1, '0.47', '1.55', '', 'fixed', 'Rounding'],
  ]);
  assert.deepEqual([math.toFix, math.fixed], [2, 1]);
});

test('an older answer without a key and a newer one with it are the same question', () => {
  const items = { 'page-turners|k9': { box: 1, due: '2026-10-06', t: 500 } };
  const r = build([
    quiz('page-turners', 'Nouns', 3, 2, [miss('Pick the noun', 'run', 'cat')]),
    quiz('page-turners', 'Nouns', 3, 2, [miss('Pick the noun', 'jump', 'cat', { key: 'page-turners|k9', t: 400 })]),
  ], { subjects: SUBJECTS, items });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  assert.deepEqual(en.questions.map((q) => [q.q, q.count, q.key, q.status]), [['Pick the noun', 2, 'page-turners|k9', 'missing']]);
});

test('build ignores odd entries and odd wrong answers', () => {
  const r = build([
    null,
    { type: 'quiz', app: 'page-turners', answered: 0, wrong: [miss('X', 'a', 'b')] },
    quiz('page-turners', 'Nouns', 2, 1, [null, { picked: 'a' }, miss('Y', 'a', 'b')]),
  ], { subjects: SUBJECTS });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  assert.deepEqual(en.questions.map((q) => q.q), ['Y']);
  assert.equal(build([], {}).pct, null);
  assert.deepEqual(build(null).subjects, []);
});

test('lessonRows: medal lessons in game order with her answers, then other lessons she answered', () => {
  const r = build([
    quiz('page-turners', 'Verbs', 10, 4),
    quiz('page-turners', 'Pangwakas', 6, 6, [], { final: true }),
  ], { subjects: SUBJECTS, items: {} });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  const entry = { order: ['n', 'v'], lessons: { n: { title: 'Nouns', best: 2, now: 1 }, v: { title: ' verbs ', best: 0, now: 0 } } };
  assert.deepEqual(lessonRows(en, entry), [
    { title: 'Nouns', medal: 2, polish: true, answered: 0, pct: null },
    { title: 'verbs', medal: 0, polish: false, answered: 10, pct: 40 },
    { title: 'Final Mock Exam', medal: 0, polish: false, answered: 6, pct: 100 },
  ]);
  assert.deepEqual(lessonRows(en, undefined).map((l) => l.title), ['Verbs', 'Final Mock Exam']);
  assert.deepEqual(lessonRows(en, { order: 'bad', lessons: null }).map((l) => l.title), ['Verbs', 'Final Mock Exam']);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/insights.test.js`
Expected: FAIL with `Cannot find module` for `insights.js`.

- [ ] **Step 3: Implement**

Create `web/engine/insights.js`:

```js
/* Keep this file ASCII-only: the pages that load it declare no charset.
   The Parent view's Focus and Subjects tabs: quiz answers grouped by subject, lesson and question, the subjects
   that need the most help first. Pure: it reads only what it is given. */
(function (root) {
  'use strict';

  var MIN_ANSWERS = 5;
  var WEAK_BELOW = 80;

  function pct(correct, answered) { return answered > 0 ? Math.round(correct / answered * 100) : null; }
  function num(x) { return typeof x === 'number' && x > 0 ? x : 0; }
  function timeOf(e) { return typeof e.updatedAt === 'number' ? e.updatedAt : typeof e.t === 'number' ? e.t : 0; }
  function level(v) { var n = Math.floor(Number(v)); return n >= 1 ? Math.min(n, 3) : 0; }
  function norm(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function lessonName(e) {
    if (e.final) return 'Final Mock Exam';
    if (e.kind === 'walkthrough') return 'UPAC Walkthrough: ' + e.lessonTitle;
    if (e.kind === 'case') return 'Case Study: ' + e.lessonTitle;
    return String(e.lessonTitle == null ? '' : e.lessonTitle);
  }

  // 'fixed' once she answers it right without help after her last miss; 'missing' until then. '' when nothing
  // says: answers saved before keys were kept, review: false questions, and Grade 5 Math (its boxes are per lesson).
  function status(key, missedAt, items) {
    var it = key && isObj(items) ? items[key] : null;
    if (!isObj(it) || it.gone || !(it.box >= 1)) return '';
    return it.box >= 2 && typeof it.t === 'number' && it.t > missedAt ? 'fixed' : 'missing';
  }

  function topPick(picks) {
    var best = '', n = 0;
    Object.keys(picks).forEach(function (p) { if (picks[p] > n) { best = p; n = picks[p]; } });
    return { text: best, count: n };
  }

  // entries: study history entries. o: { subjects: [{ app, title }] in game order, items: review_v1 items }.
  function build(entries, o) {
    o = o || {};
    var items = isObj(o.items) ? o.items : {}, list = [], byApp = Object.create(null);

    function subject(app, title) {
      var s = byApp[app];
      if (!s) {
        s = byApp[app] = { app: app, title: String(title || app), answered: 0, correct: 0, quizzes: 0, lessons: [], questions: [],
          lessonOf: Object.create(null), questionOf: Object.create(null) };
        list.push(s);
      }
      return s;
    }

    function addMiss(s, e, w, at) {
      var when = typeof w.t === 'number' ? w.t : at, textKey = 'text:' + w.q;
      var q = (w.key && s.questionOf[w.key]) || s.questionOf[textKey];
      if (!q) {
        q = { q: String(w.q), answer: '', lastPick: '', lesson: '', key: '', count: 0, last: -1, picks: Object.create(null) };
        s.questions.push(q);
      }
      s.questionOf[textKey] = q;
      if (w.key) { s.questionOf[w.key] = q; if (!q.key) q.key = w.key; }
      q.count++;
      var picked = String(w.picked == null ? '' : w.picked);
      q.picks[picked] = (q.picks[picked] || 0) + 1;
      if (when >= q.last) { q.last = when; q.answer = String(w.answer == null ? '' : w.answer); q.lastPick = picked; }
      if (!q.lesson && e.kind !== 'review') q.lesson = lessonName(e);
    }

    (o.subjects || []).forEach(function (s) { subject(s.app, s.title); });
    (entries || []).forEach(function (e) {
      if (!e || e.type !== 'quiz' || !(e.answered > 0) || typeof e.app !== 'string') return;
      var s = subject(e.app, e.appTitle), at = timeOf(e);
      s.answered += num(e.answered);
      s.correct += num(e.correct);
      s.quizzes++;
      if (e.kind !== 'review') {
        var name = lessonName(e), l = s.lessonOf[name];
        if (!l) s.lessons.push(l = s.lessonOf[name] = { title: name, answered: 0, correct: 0, quizzes: 0, last: 0 });
        l.answered += num(e.answered);
        l.correct += num(e.correct);
        l.quizzes++;
        l.last = Math.max(l.last, at);
      }
      (Array.isArray(e.wrong) ? e.wrong : []).forEach(function (w) {
        if (isObj(w) && w.q) addMiss(s, e, w, at);
      });
    });

    var out = { answered: 0, correct: 0, pct: null, toFix: 0, fixed: 0, subjects: list };
    list.forEach(function (s) {
      s.pct = pct(s.correct, s.answered);
      s.toFix = 0;
      s.fixed = 0;
      s.lessons.forEach(function (l) {
        l.pct = pct(l.correct, l.answered);
        l.weak = l.answered >= MIN_ANSWERS && l.pct < WEAK_BELOW;
      });
      s.lessons.sort(function (a, b) { return a.pct - b.pct || b.answered - a.answered; });
      s.questions.forEach(function (q) {
        q.status = status(q.key, q.last, items);
        var top = topPick(q.picks);
        q.repeatedPick = top.count >= 2 ? top.text : '';
        delete q.picks;
        if (q.status === 'fixed') s.fixed++;
        else s.toFix++;
      });
      s.questions.sort(function (a, b) {
        return (a.status === 'fixed') - (b.status === 'fixed') || b.count - a.count || b.last - a.last;
      });
      delete s.lessonOf;
      delete s.questionOf;
      out.answered += s.answered;
      out.correct += s.correct;
      out.toFix += s.toFix;
      out.fixed += s.fixed;
    });
    out.pct = pct(out.correct, out.answered);
    list.sort(function (a, b) {
      return (b.answered > 0) - (a.answered > 0) || b.toFix - a.toFix || (a.pct || 0) - (b.pct || 0) || a.title.localeCompare(b.title);
    });
    return out;
  }

  // The Subjects tab's rows for one subject from build(): every lesson the medals know, in game order, with her
  // answers in the range, then any other lesson she answered (the mock exam, walkthroughs).
  // entry: Mastery.read(storage).apps[app], or undefined. Titles are matched ignoring case and spaces.
  function lessonRows(s, entry) {
    var byTitle = Object.create(null), used = Object.create(null), rows = [];
    s.lessons.forEach(function (l) { byTitle[norm(l.title)] = l; });
    var lessons = isObj(entry) && isObj(entry.lessons) ? entry.lessons : {};
    var order = isObj(entry) && Array.isArray(entry.order) ? entry.order : Object.keys(lessons);
    var seenId = Object.create(null);
    order.forEach(function (id) {
      var m = lessons[id];
      if (!isObj(m) || seenId[id]) return;
      seenId[id] = true;
      var l = byTitle[norm(m.title)];
      if (l) used[norm(l.title)] = true;
      rows.push({ title: String(m.title == null ? '' : m.title).trim(), medal: level(m.best), polish: level(m.now) < level(m.best),
        answered: l ? l.answered : 0, pct: l ? l.pct : null });
    });
    s.lessons.forEach(function (l) {
      if (!used[norm(l.title)]) rows.push({ title: l.title, medal: 0, polish: false, answered: l.answered, pct: l.pct });
    });
    return rows;
  }

  var api = { build: build, lessonRows: lessonRows, status: status, MIN_ANSWERS: MIN_ANSWERS, WEAK_BELOW: WEAK_BELOW };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.Insights = api;
})(this);
```

Note on the subject sort: a subject with no answers has `pct: null`; `(a.pct || 0)` keeps the comparison numeric, and those subjects are already sorted last by the first clause.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/insights.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Stage**

```bash
git add web/engine/insights.js tests/insights.test.js
git commit -m 'Add insights.js: group quiz answers by subject, lesson and question, rank subjects by questions to fix, and tell fixed from still missing with the review boxes'
```

---

### Task 3: Wire `insights.js` into the three pages, the offline cache and the test staging

**Files:**
- Modify: `tests/paths.js:8` (ENGINE_FILES)
- Modify: `web/sw.js` (PRECACHE list, next to `'engine/parent-panel.js'`)
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html`, `web/parent/index.html` (script tags)
- Create: `tests/insights-wiring.test.js`
- Modify: `tests/browser-globals.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/insights-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { WEB, LOBBIES, PARENT } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const PAGES = [
  [LOBBIES[5].page, '<script src="../engine/insights.js" data-grade="grade5"></script>'],
  [LOBBIES[2].page, '<script src="../engine/insights.js" data-grade="grade2"></script>'],
  [PARENT.page, '<script src="../engine/insights.js"></script>'],
];

for (const [page, tag] of PAGES) {
  test(page + ' loads insights.js once, before parent-panel.js', () => {
    const html = fs.readFileSync(path.join(WEB, page), 'utf8');
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) < html.indexOf('/engine/parent-panel.js"'), 'before the panel that uses it');
  });
}

test('the offline cache keeps insights.js', () => {
  assert.equal(count(fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8'), "'engine/insights.js',"), 1);
});
```

Append to `tests/browser-globals.test.js`:

```js
test('the parent page can group a child\'s answers', () => {
  const win = browser('insights.js');
  const r = win.Insights.build([{ id: 'a', type: 'quiz', app: 'x', appTitle: 'X', lessonTitle: 'L', answered: 2, correct: 1, wrong: [{ q: 'Q', picked: 'p', answer: 'a' }], t: 1 }],
    { subjects: [{ app: 'x', title: 'X' }], items: {} });
  assert.equal(r.toFix, 1);
  assert.equal(r.subjects[0].pct, 50);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/insights-wiring.test.js tests/browser-globals.test.js tests/pwa.test.js`
Expected: the wiring tests FAIL (no script tags, not precached). `browser-globals` passes already. `pwa.test.js` FAILS once `insights.js` exists but is not in PRECACHE.

- [ ] **Step 3: Implement**

`tests/paths.js`: add `'insights.js'` to ENGINE_FILES right before `'parent-panel.js'`.

`web/sw.js`: add `'engine/insights.js',` on its own line right before `'engine/parent-panel.js',`.

`web/lobby/grade-5.html`: right before `<script src="../engine/parent-panel.js" data-grade="grade5"></script>` add:

```html
<script src="../engine/insights.js" data-grade="grade5"></script>
```

`web/lobby/grade-2.html`: right before `<script src="../engine/parent-panel.js" data-grade="grade2"></script>` add:

```html
<script src="../engine/insights.js" data-grade="grade2"></script>
```

`web/parent/index.html`: right before `<script src="../engine/parent-panel.js"></script>` add:

```html
<script src="../engine/insights.js"></script>
```

Do not add `insights` to the missing-file bar's GLOBALS line: `mastery.js`, `quests.js` and `boss.js` are not in it either, and `tests/family-wiring.test.js` and `tests/guide-wiring.test.js` pin that line.

- [ ] **Step 4: Run every unit test**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add tests/paths.js web/sw.js web/lobby/grade-5.html web/lobby/grade-2.html web/parent/index.html tests/insights-wiring.test.js tests/browser-globals.test.js
git commit -m 'Load insights.js in both lobbies and on the parent phone page, and keep it in the offline cache'
```

---

### Task 4: Tab markup on the three pages

The IDs `parent-panel.js` reads stay the same; sections only move into tab panels. Two IDs are new (`p-tabs`, `focus`, `subjects-list`), one goes (`weak-spots`), and `#hist-summary` changes class.

**Files:**
- Modify: `web/lobby/grade-5.html` (the `#history-body` block inside `#parent-overlay`, and the lobby CSS)
- Modify: `web/lobby/grade-2.html` (same block, same CSS)
- Modify: `web/parent/index.html` (`<template id="child-template">`), `web/parent/parent.css`

- [ ] **Step 1: Regroup the Grade 5 lobby's `#history-body`**

In `web/lobby/grade-5.html`, replace everything from `<div id="history-body">` through its closing `</div>` (the line before `    </div>` that closes `#history-view`) with the block below. Every section's inner markup (learner, clock, test score, cloud, backup, delete) is moved unchanged; only its position changes. Keep the `history-full` message text as it is in this file.

```html
      <div id="history-body">
        <div class="p-warn" id="history-full" hidden>History storage is full — export a backup, then delete old entries.</div>

        <!-- MOVE HERE, unchanged: <div class="p-section" id="clock-section" hidden> ... </div> -->

        <div class="p-section">
          <div class="p-row" id="range-buttons">
            <button class="p-btn" type="button" data-range="today">Today</button>
            <button class="p-btn" type="button" data-range="7">Last 7 days</button>
            <button class="p-btn on" type="button" data-range="30">Last 30 days</button>
            <button class="p-btn" type="button" data-range="all">All</button>
            <button class="p-btn" type="button" data-range="custom">Custom</button>
          </div>
          <div class="p-row" id="custom-range" hidden>
            <label>From <input type="date" id="range-from"></label>
            <label>To <input type="date" id="range-to"></label>
          </div>
          <p class="p-note" id="range-msg"></p>
        </div>

        <div class="p-tabs" id="p-tabs" role="tablist" aria-label="Parent view">
          <button class="p-tab on" type="button" role="tab" aria-selected="true" data-tab="focus">🎯 Focus</button>
          <button class="p-tab" type="button" role="tab" aria-selected="false" data-tab="subjects">📚 Subjects</button>
          <button class="p-tab" type="button" role="tab" aria-selected="false" data-tab="activity">🕒 Activity</button>
          <button class="p-tab" type="button" role="tab" aria-selected="false" data-tab="rewards">🪙 Rewards</button>
          <button class="p-tab" type="button" role="tab" aria-selected="false" data-tab="settings">⚙️ Settings</button>
        </div>

        <div class="p-panel" role="tabpanel" data-panel="focus">
          <div class="p-section"><div class="p-tiles" id="hist-summary"></div></div>
          <div class="p-section" id="focus"></div>
        </div>

        <div class="p-panel" role="tabpanel" data-panel="subjects" hidden>
          <div class="p-section">
            <h3>📚 Subjects</h3>
            <p class="p-note">Every lesson with its medal and how she did in this range. 🔧 means a medal she earned needs a review to keep it.</p>
            <div id="subjects-list"></div>
          </div>
        </div>

        <div class="p-panel" role="tabpanel" data-panel="activity" hidden>
          <div class="p-section">
            <div class="p-row">
              <label>Subject <select id="subject-filter"><option value="">All subjects</option></select></label>
            </div>
          </div>
          <div class="p-section" id="hist-list"></div>
        </div>

        <div class="p-panel" role="tabpanel" data-panel="rewards" hidden>
          <!-- MOVE HERE, unchanged: <div class="p-section" id="test-score"> ... </div> -->
        </div>

        <div class="p-panel" role="tabpanel" data-panel="settings" hidden>
          <!-- MOVE HERE, unchanged, in this order:
               <div class="p-section" id="learner-section"> ... </div>
               <div class="p-section" id="cloud-section" hidden></div>
               <div class="p-section"> <h3>Backup</h3> ... </div>
               <div class="p-section"> <h3>Delete history</h3> ... </div> -->
        </div>
      </div>
```

The `<!-- MOVE HERE -->` lines are instructions for this step, not markup to keep: paste the real sections there and delete the comment lines. The clock section sits above the tabs because it is a warning that must be seen.

In the same file's `<style>`, delete the now-unused rules `.h-summary{...}`, `.h-summary span{...}`, `.h-summary .missed{...}`, `.weak-list{...}` and `.weak-list li{...}`.

- [ ] **Step 2: Do the same in the Grade 2 lobby**

Apply Step 1 to `web/lobby/grade-2.html`. Its `#history-missing` text is different and stays as it is; the rest of the block is identical.

Check the two lobbies still match apart from that line:

Run: `diff <(sed -n '/id="parent-overlay"/,/id="shop-overlay"/p' web/lobby/grade-5.html) <(sed -n '/id="parent-overlay"/,/id="shop-overlay"/p' web/lobby/grade-2.html)`
Expected: only the `history-missing` line differs.

- [ ] **Step 3: Regroup the phone template**

In `web/parent/index.html`, replace the whole `<template id="child-template"> ... </template>` with:

```html
<template id="child-template">
  <div class="p-section" id="requests" hidden></div>
  <div class="p-section" id="recent" hidden></div>
  <h3 class="kid-title" id="kid-name"></h3>

  <div class="p-warn" id="history-full" hidden>History storage is full.</div>
  <div class="p-section">
    <div class="p-row" id="range-buttons">
      <button class="p-btn" type="button" data-range="today">Today</button>
      <button class="p-btn" type="button" data-range="7">Last 7 days</button>
      <button class="p-btn on" type="button" data-range="30">Last 30 days</button>
      <button class="p-btn" type="button" data-range="all">All</button>
      <button class="p-btn" type="button" data-range="custom">Custom</button>
    </div>
    <div class="p-row" id="custom-range" hidden>
      <label>From <input type="date" id="range-from"></label>
      <label>To <input type="date" id="range-to"></label>
    </div>
    <p class="p-note" id="range-msg"></p>
  </div>

  <div class="p-tabs" id="p-tabs" role="tablist" aria-label="Parent view">
    <button class="p-tab on" type="button" role="tab" aria-selected="true" data-tab="focus">🎯 Focus</button>
    <button class="p-tab" type="button" role="tab" aria-selected="false" data-tab="subjects">📚 Subjects</button>
    <button class="p-tab" type="button" role="tab" aria-selected="false" data-tab="activity">🕒 Activity</button>
    <button class="p-tab" type="button" role="tab" aria-selected="false" data-tab="rewards">🪙 Rewards</button>
  </div>

  <div class="p-panel" role="tabpanel" data-panel="focus">
    <div class="p-section"><div class="p-tiles" id="hist-summary"></div></div>
    <div class="p-section" id="focus"></div>
  </div>

  <div class="p-panel" role="tabpanel" data-panel="subjects" hidden>
    <div class="p-section">
      <h3>📚 Subjects</h3>
      <p class="p-note">Every lesson with its medal and how she did in this range. 🔧 means a medal she earned needs a review to keep it.</p>
      <div id="subjects-list"></div>
    </div>
  </div>

  <div class="p-panel" role="tabpanel" data-panel="activity" hidden>
    <div class="p-section">
      <div class="p-row">
        <label>Subject <select id="subject-filter"><option value="">All subjects</option></select></label>
      </div>
    </div>
    <div class="p-section" id="hist-list"></div>
  </div>

  <div class="p-panel" role="tabpanel" data-panel="rewards" hidden>
    <div class="p-section">
      <p class="coins-big" id="kid-coins"></p>
      <p class="p-note" id="kid-streak"></p>
      <p class="p-note" id="kid-boss"></p>
      <div class="pts-list" id="kid-points"></div>
    </div>
    <details class="p-section shop-prices">
      <summary>🛒 Shop prices</summary>
      <p class="p-note">What she can buy right now. She buys on the tablet; you approve here or with the PIN.</p>
      <div id="shop-list"></div>
    </details>
    <div class="p-section" id="test-score">
      <h3>📝 Real test score</h3>
      <div class="p-row">
        <label>Subject <select id="ts-subject"></select></label>
        <label>Test <input type="text" id="ts-name" maxlength="60" placeholder="e.g. Science ST1"></label>
      </div>
      <div class="p-row">
        <label>Score <input type="number" id="ts-score" min="0" step="1" inputmode="numeric"></label>
        <label>out of <input type="number" id="ts-total" min="1" step="1" inputmode="numeric"></label>
        <button class="p-btn" type="button" id="ts-add" disabled>Add coins</button>
      </div>
      <p class="p-note">100% = 50 coins · 90% or more = 40 · 80% or more = 30 · below 80% = 10 for trying.</p>
      <p class="p-note" id="ts-msg"></p>
    </div>
  </div>
</template>
```

The phone has no Settings tab (backups and delete stay on the tablets), and `#medals` is gone: medals now show in Subjects (Task 6).

In `web/parent/parent.css`, delete the `.h-summary`, `.h-summary span`, `.h-summary .missed`, `.weak-list` and `.weak-list li` rules, and add:

```css
  .kid-title{ margin:0 0 12px; font-family:'Baloo 2', system-ui, sans-serif; font-size:1.2rem; }
```

- [ ] **Step 4: Run the unit tests**

Run: `node --test`
Expected: PASS. (The panel still runs: nothing it reads was removed except `#weak-spots`, which Task 5 stops using. If `renderWeakSpots` throws on a missing `#weak-spots` before Task 5, that only shows in the e2e, which Task 7 updates.)

- [ ] **Step 5: Stage**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html web/parent/index.html web/parent/parent.css
git commit -m 'Regroup the Parent view into tabs: Focus, Subjects, Activity, Rewards and Settings on the tablets, the same without Settings on the phone; Last 30 days is the default range'
```

---

### Task 5: Tabs, tiles and Focus in `parent-panel.js`

**Files:**
- Modify: `web/engine/parent-panel.js`

- [ ] **Step 1: Add the CSS and its injector**

Right after `var PIN = '0108';`, add:

```js
  // The panel's own look, so the two lobbies and the phone page share one copy. It uses each page's theme colors.
  var CSS =
    '.p-tabs{display:flex;gap:6px;overflow-x:auto;margin:0 0 14px;padding:2px;scrollbar-width:none;}' +
    '.p-tab{flex:none;font:inherit;font-size:.9rem;font-weight:800;cursor:pointer;padding:8px 14px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--ink);}' +
    '.p-tab.on{background:var(--header-accent);border-color:var(--header-accent);color:var(--card);}' +
    '.p-tab:focus-visible{outline:3px solid var(--gold-deep);outline-offset:2px;}' +
    '.p-panel[hidden]{display:none;}' +
    '.p-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;}' +
    '.p-tile{padding:10px 12px;border-radius:14px;background:var(--bg);}' +
    '.p-tile-label{font-size:.8rem;font-weight:700;color:var(--ink-soft);}' +
    '.p-tile-value{font-size:1.25rem;font-weight:800;}' +
    '.p-tile.bad .p-tile-value{color:var(--bad);}' +
    '.f-subject{border:1px solid var(--border);border-radius:14px;padding:10px 12px;margin-top:10px;}' +
    '.f-subject.need{border-color:var(--bad);}' +
    '.f-subject>summary{cursor:pointer;list-style:none;}' +
    '.f-subject>summary::-webkit-details-marker{display:none;}' +
    '.f-head{display:flex;justify-content:space-between;gap:8px;font-weight:800;}' +
    '.f-stat{color:var(--ink-soft);font-weight:700;}' +
    '.f-subject.need .f-head .f-stat{color:var(--bad);}' +
    '.f-bar{height:6px;border-radius:3px;background:var(--bg);margin-top:6px;overflow:hidden;}' +
    '.f-bar span{display:block;height:100%;background:var(--good);}' +
    '.f-subject.need .f-bar span{background:var(--bad);}' +
    '.f-label{margin:12px 0 4px;font-size:.8rem;font-weight:800;color:var(--ink-soft);}' +
    '.f-row{padding:6px 0;border-top:1px solid var(--border);overflow-wrap:anywhere;}' +
    '.f-lesson{display:flex;justify-content:space-between;gap:8px;}' +
    '.f-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:3px;font-size:.85rem;font-weight:700;}' +
    '.f-pick{color:var(--bad);}' +
    '.f-ans{color:var(--good);}' +
    '.f-from{color:var(--ink-soft);}' +
    '.f-chip{padding:1px 8px;border-radius:999px;font-size:.78rem;font-weight:800;color:var(--card);}' +
    '.f-chip.missing{background:var(--bad);}' +
    '.f-chip.fixed{background:var(--good);}' +
    '.f-mix{margin-top:3px;font-size:.85rem;font-weight:700;color:var(--gold-deep);}' +
    '.f-more>summary{cursor:pointer;margin-top:8px;font-weight:800;color:var(--header-accent);}';

  function addStyle(doc) {
    if (doc.getElementById('parent-panel-css')) return;
    var s = doc.createElement('style');
    s.id = 'parent-panel-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
```

- [ ] **Step 2: Default range, Insights handle, style**

In `mount`, change `var range = '7';` to `var range = '30';` and add right after the `var $ = ...` line:

```js
    var IN = root.Insights;
    addStyle(doc);
```

- [ ] **Step 3: Replace `renderSummary` and `renderWeakSpots`**

Delete `renderSummary` and the whole `var WEAK_BELOW = 80; function renderWeakSpots(...) {...}` block, and put this in their place:

```js
    var WEAK_BELOW = 80;
    var FOCUS_QUESTIONS = 8;
    var MEDALS = ['·', '🥉', '🥈', '🥇'];

    function tile(label, value, cls) {
      var t = el('div', 'p-tile' + (cls ? ' ' + cls : ''));
      t.appendChild(el('div', 'p-tile-label', label));
      t.appendChild(el('div', 'p-tile-value', value));
      return t;
    }

    function renderSummary(s, report) {
      var box = $('hist-summary');
      box.textContent = '';
      box.appendChild(tile('Study time', s.studyMs > 0 ? formatDuration(s.studyMs) : 'none yet'));
      box.appendChild(tile('Quizzes', String(s.quizzes)));
      box.appendChild(tile('Right answers', report && report.pct !== null ? report.pct + '%' : '—'));
      if (report) box.appendChild(tile('To fix', String(report.toFix), report.toFix ? 'bad' : ''));
    }

    function bar(pct) {
      var b = el('div', 'f-bar'), fill = el('span');
      fill.style.width = (pct || 0) + '%';
      b.appendChild(fill);
      return b;
    }

    function questionRow(q) {
      var row = el('div', 'f-row f-question');
      row.appendChild(el('div', '', q.q));
      var meta = el('div', 'f-meta');
      meta.appendChild(el('span', 'f-pick', '❌ ' + q.lastPick + (q.count > 1 ? ' · missed ' + q.count + '×' : '')));
      meta.appendChild(el('span', 'f-ans', '✅ ' + q.answer));
      if (q.status) meta.appendChild(el('span', 'f-chip ' + q.status, q.status === 'fixed' ? 'Fixed' : 'Still missing'));
      if (q.lesson) meta.appendChild(el('span', 'f-from', q.lesson));
      row.appendChild(meta);
      if (q.repeatedPick) row.appendChild(el('div', 'f-mix', 'Picked “' + q.repeatedPick + '” more than once: she may be mixing these up.'));
      return row;
    }

    function folded(summary, list) {
      var d = el('details', 'f-more');
      d.appendChild(el('summary', '', summary));
      list.forEach(function (q) { d.appendChild(questionRow(q)); });
      return d;
    }

    function focusSubject(s, open) {
      var need = s.toFix > 0 || s.pct < WEAK_BELOW;
      var d = el('details', 'f-subject' + (need ? ' need' : ''));
      d.open = open;
      var sum = el('summary'), head = el('div', 'f-head');
      head.appendChild(el('span', '', s.title));
      head.appendChild(el('span', 'f-stat', s.pct + '% right · ' + (s.toFix ? s.toFix + ' to fix' : 'nothing to fix')));
      sum.appendChild(head);
      sum.appendChild(bar(s.pct));
      d.appendChild(sum);

      var weak = s.lessons.filter(function (l) { return l.weak; }).slice(0, 3);
      if (weak.length) {
        d.appendChild(el('div', 'f-label', 'Weakest lessons'));
        weak.forEach(function (l) {
          var row = el('div', 'f-row f-lesson');
          row.appendChild(el('span', '', l.title));
          row.appendChild(el('span', 'f-pick', l.pct + '% (' + l.correct + ' of ' + l.answered + ')'));
          d.appendChild(row);
        });
      }

      var toFix = s.questions.filter(function (q) { return q.status !== 'fixed'; });
      var fixed = s.questions.filter(function (q) { return q.status === 'fixed'; });
      if (toFix.length) {
        d.appendChild(el('div', 'f-label', 'Questions to fix'));
        toFix.slice(0, FOCUS_QUESTIONS).forEach(function (q) { d.appendChild(questionRow(q)); });
        if (toFix.length > FOCUS_QUESTIONS) d.appendChild(folded('Show ' + (toFix.length - FOCUS_QUESTIONS) + ' more', toFix.slice(FOCUS_QUESTIONS)));
      }
      if (fixed.length) d.appendChild(folded('Fixed (' + fixed.length + ')', fixed));
      if (!toFix.length && !fixed.length) d.appendChild(el('p', 'p-note', 'No wrong answers in this range. 🎉'));
      return d;
    }

    function renderFocus(report) {
      var box = $('focus');
      box.textContent = '';
      if (!report) { box.appendChild(el('p', 'p-note', 'Focus file missing — copy engine/insights.js.')); return; }
      var active = report.subjects.filter(function (s) { return s.answered > 0; });
      if (!active.length) { box.appendChild(el('p', 'p-note', 'No quiz answers in this range yet.')); return; }
      box.appendChild(el('p', 'p-note', 'Subjects that need the most help come first. Open one to see its weakest lessons and the questions to fix.'));
      active.forEach(function (s, i) { box.appendChild(focusSubject(s, i === 0 && s.toFix > 0)); });
    }
```

- [ ] **Step 4: Replace `renderHistory`**

The range now drives every tab; the subject filter narrows only the Activity log. Replace `renderHistory` with:

```js
    function reviewItems() {
      try {
        var d = JSON.parse(STORE.getItem('review_v1'));
        return d && d.items && typeof d.items === 'object' ? d.items : {};
      } catch (e) { return {}; }
    }

    function renderHistory() {
      $('history-full').hidden = !SH.storageError();
      var r = currentRange();
      if (range === 'custom' && r[0] && r[1] && r[0] > r[1]) {
        $('range-msg').textContent = 'From must be on or before To.';
        $('hist-summary').textContent = '';
        $('focus').textContent = '';
        if ($('subjects-list')) $('subjects-list').textContent = '';
        $('hist-list').textContent = '';
        return;
      }
      $('range-msg').textContent = '';
      var entries = SH.list(r[0], r[1]), app = $('subject-filter').value || null;
      var report = IN ? IN.build(entries, { subjects: o.subjects, items: reviewItems() }) : null;
      renderSummary(SH.summary(entries), report);
      renderFocus(report);
      renderSubjects(report);
      renderList(app ? entries.filter(function (e) { return e.app === app; }) : entries);
    }
```

`renderSubjects` comes in Task 6. Until then add this stub right above `renderHistory` so the page runs:

```js
    function renderSubjects() {}
```

- [ ] **Step 5: Tabs**

Right after the `['range-from', 'range-to', 'subject-filter'].forEach(...)` block, add:

```js
    function showTab(name) {
      Array.prototype.forEach.call($('p-tabs').querySelectorAll('[data-tab]'), function (b) {
        var on = b.getAttribute('data-tab') === name;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      Array.prototype.forEach.call(doc.querySelectorAll('.p-panel[data-panel]'), function (p) {
        p.hidden = p.getAttribute('data-panel') !== name;
      });
    }
    $('p-tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tab]');
      if (b) showTab(b.getAttribute('data-tab'));
    });
```

In `mountLobby`'s `unlock()`, add `showTab('focus');` as its first line, so every open starts on Focus.

Change the last line of `mount` to:

```js
    return { render: renderHistory, showTab: showTab };
```

- [ ] **Step 6: Run the unit tests**

Run: `node --test`
Expected: PASS. (`tests/clock-wiring.test.js` reads `parent-panel.js`; the clock code is untouched.)

- [ ] **Step 7: Stage**

```bash
git add web/engine/parent-panel.js
git commit -m 'Parent view: tabs that open on Focus, summary tiles (study time, quizzes, right answers, to fix), and a Focus tab that ranks subjects by questions to fix and lists the weakest lessons and each question to fix with what she picked, the answer, a Still missing or Fixed chip and repeated wrong picks'
```

---

### Task 6: The Subjects tab, and medals move off the phone's top section

**Files:**
- Modify: `web/engine/parent-panel.js`
- Modify: `web/parent/phone.js`

- [ ] **Step 1: Replace the `renderSubjects` stub**

In `web/engine/parent-panel.js`, replace `function renderSubjects() {}` with:

```js
    function subjectRow(s, entry) {
      var M = root.Mastery;
      var d = el('details', 'f-subject');
      var sum = el('summary'), head = el('div', 'f-head');
      head.appendChild(el('span', '', s.title));
      head.appendChild(el('span', 'f-stat', s.answered ? s.pct + '% right · ' + (s.quizzes === 1 ? '1 quiz' : s.quizzes + ' quizzes') : 'No quiz in this range'));
      sum.appendChild(head);
      if (s.answered) sum.appendChild(bar(s.pct));
      if (entry && M && M.counts) {
        var c = M.counts(entry);
        sum.appendChild(el('div', 'p-note', '🥇 ' + c.gold + ' · 🥈 ' + c.silver + ' · 🥉 ' + c.bronze + ' of ' + c.total + ' lessons'));
      }
      d.appendChild(sum);
      var rows = IN.lessonRows(s, entry);
      if (!rows.length) d.appendChild(el('p', 'p-note', 'Not opened since medals were added, and no quiz in this range.'));
      rows.forEach(function (l) {
        var row = el('div', 'f-row f-lesson');
        row.appendChild(el('span', '', MEDALS[l.medal] + ' ' + l.title + (l.polish ? ' 🔧' : '')));
        row.appendChild(el('span', l.answered && l.pct < WEAK_BELOW ? 'f-pick' : 'f-stat', l.answered ? l.pct + '% right' : 'No quiz in this range'));
        d.appendChild(row);
      });
      return d;
    }

    // In game order, not ranked: this tab is for looking a subject up.
    function renderSubjects(report) {
      var box = $('subjects-list');
      if (!box) return;
      box.textContent = '';
      if (!report) return;
      var M = root.Mastery, apps = M && M.read ? M.read(STORE).apps : {}, byApp = {};
      report.subjects.forEach(function (s) { byApp[s.app] = s; });
      o.subjects.forEach(function (sub) {
        if (byApp[sub.app]) box.appendChild(subjectRow(byApp[sub.app], apps[sub.app]));
      });
    }
```

- [ ] **Step 2: Remove the phone's own medals section**

In `web/parent/phone.js`:
- In `render()`, delete the line `renderMedals();`.
- Delete the whole `function renderMedals() { ... }`.

The 🔧 "Needs a polish" list it showed is now the 🔧 mark on each lesson in Subjects.

- [ ] **Step 3: Run the unit tests**

Run: `node --test`
Expected: PASS. (`tests/browser-globals.test.js` "can read medals" uses `Mastery` directly, not `renderMedals`.)

- [ ] **Step 4: Stage**

```bash
git add web/engine/parent-panel.js web/parent/phone.js
git commit -m 'Parent view: a Subjects tab with every subject in game order, its % right, quizzes and medals, and every lesson with its medal, a 🔧 when it needs a review and its % right in the range; the phone shows medals there instead of its own section'
```

---

### Task 7: Lobby e2e for tabs, tiles, Focus and Subjects

**Files:**
- Modify: `tests/e2e/lobby-driver.page.js`
- Modify: `tests/e2e/lobby-e2e.js`

The seeded history (driver lines ~255-275) in the default Last 30 days has quizzes `b` (subject 0, Nouns, 8 of 10, wrong: "Pick the noun" run→cat, "Pick the verb" cat→run), `e` (subject 1, walkthrough, 4 of 5, one wrong) and `f` (subject 1, case, 1 of 1). `d` is 40 days ago. So: 16 answers, 13 right = 81%; 3 to fix; subject 0 is 80% with 2 to fix, subject 1 is 83% (5 of 6) with 1 to fix.

- [ ] **Step 1: Update the driver**

In `tests/e2e/lobby-driver.page.js`, add a helper next to `rows()`:

```js
  function visiblePanels() {
    return Array.prototype.filter.call(document.querySelectorAll('.p-panel[data-panel]'), function (p) { return !p.hidden; })
      .map(function (p) { return p.getAttribute('data-panel'); });
  }
  function focusSubjects() { return document.querySelectorAll('#focus .f-subject'); }
```

Replace the line `r.summary7 = $('hist-summary').textContent;` with:

```js
  r.summary30 = $('hist-summary').textContent;
  r.panelsAtOpen = visiblePanels();
  r.focusHeads = Array.prototype.map.call(focusSubjects(), function (d) { return d.querySelector('.f-head').textContent; });
  r.focusFirstOpen = focusSubjects()[0].open;
  r.focusQuestions = Array.prototype.map.call(focusSubjects()[0].querySelectorAll('.f-question'), function (q) { return q.textContent; });
  r.focusChips = document.querySelectorAll('#focus .f-chip').length;
```

Rename `r.rows7 = rows();` to `r.rows30 = rows();`.

Replace the line `r.weakAll = $('weak-spots').textContent;` with:

```js
  r.focusWeakAll = document.querySelectorAll('#focus .f-lesson').length;
```

Replace the block from `var seeded = __store.getItem(KEY), withWeak = JSON.parse(seeded);` through `__store.setItem(KEY, seeded);` with:

```js
  var seeded = __store.getItem(KEY), withWeak = JSON.parse(seeded);
  withWeak.entries.push({ id: 'w', type: 'quiz', app: APPS[0], appTitle: 'X', lessonTitle: 'Verbs', total: 10, answered: 10, correct: 4,
    finished: true, stars: 0, points: 40, bestStreak: 1, t: at(0, 8, 0), updatedAt: at(0, 8, 5),
    wrong: [{ q: 'Pick the adjective', picked: 'run', answer: 'red', key: 'k-adj', t: at(0, 8, 1) },
      { q: 'Pick the pronoun', picked: 'cat', answer: 'she', key: 'k-pro', t: at(0, 8, 2) }] });
  __store.setItem(KEY, JSON.stringify(withWeak));
  __store.setItem('review_v1', JSON.stringify({ v: 1, items: {
    'k-adj': { box: 2, due: '2099-01-01', t: at(0, 8, 3) },
    'k-pro': { box: 1, due: '2099-01-01', t: at(0, 8, 2) }
  } }));
  document.querySelector('#range-buttons [data-range="all"]').click();
  r.weakList = Array.prototype.map.call(focusSubjects()[0].querySelectorAll('.f-lesson'), function (li) { return li.textContent; });
  r.fixedChip = Array.prototype.map.call(document.querySelectorAll('#focus .f-chip'), function (c) { return c.textContent; }).sort();
  r.fixedFolded = focusSubjects()[0].querySelector('.f-more summary').textContent;
  __store.setItem(KEY, seeded);
  __store.removeItem('review_v1');
```

Right after `r.subjectOptions = $('subject-filter').options.length;`, add:

```js
  document.querySelector('#p-tabs [data-tab="subjects"]').click();
  r.panelsSubjects = visiblePanels();
  r.subjectRows = document.querySelectorAll('#subjects-list .f-subject').length;
  r.subjectsTabOn = document.querySelector('#p-tabs [data-tab="subjects"]').getAttribute('aria-selected');
```

Leave the Subjects tab selected. After the existing line `r.relocked = !$('pin-view').hidden && $('history-view').hidden;`, add:

```js
  press('0108');
  r.panelsAfterReopen = visiblePanels();
```

(The next existing line, `$('parent-close').click();`, closes it again.)

- [ ] **Step 2: Update the assertions**

In `tests/e2e/lobby-e2e.js`, replace the assertions from `assert.equal(r.rows7, 5, ...)` through `assert.deepEqual(r.weakList, ...)` with:

```js
  assert.equal(r.rows30, 5, 'the default Last 30 days shows 5 rows (a,b,c,e,f; d is 40 days ago)');
  assert.deepEqual(r.panelsAtOpen, ['focus'], 'opens on Focus');
  assert.match(r.summary30, /Study time20 min/);
  assert.match(r.summary30, /Quizzes3/);
  assert.match(r.summary30, /Right answers81%/);
  assert.match(r.summary30, /To fix3/);
  assert.deepEqual(r.focusHeads, [cfg.subjects[0] + '80% right · 2 to fix', cfg.subjects[1] + '83% right · 1 to fix'], 'most to fix first');
  assert.equal(r.focusFirstOpen, true, 'the subject needing the most help starts open');
  assert.equal(r.focusQuestions.length, 2);
  assert.match(r.focusQuestions[0], /Pick the noun❌ run✅ catNouns/);
  assert.equal(r.focusChips, 0, 'answers saved without a key show no chip');
  assert.equal(r.detailsCount, 2, 'b and e each have wrong answers in the list');
  assert.match(r.detailsText, /2 wrong answers/);
  assert.match(r.detailsText, /❌ run/);
  assert.match(r.detailsText, /✅ cat/);
  assert.equal(r.rowsAll, 6, 'All shows every row');
  assert.equal(r.focusWeakAll, 0, 'no lesson under 80% with 5 answers yet');
  assert.deepEqual(r.weakList, ['Verbs40% (4 of 10)']);
  assert.deepEqual(r.fixedChip, ['Fixed', 'Still missing']);
  assert.equal(r.fixedFolded, 'Fixed (1)');
```

After `assert.equal(r.subjectOptions, cfg.subjectOptions, ...)`, add:

```js
  assert.deepEqual(r.panelsSubjects, ['subjects']);
  assert.equal(r.subjectsTabOn, 'true');
  assert.equal(r.subjectRows, cfg.subjectOptions - 1, 'one row per subject');
  assert.deepEqual(r.panelsAfterReopen, ['focus'], 'every open starts on Focus again');
```

Delete the old `assert.match(r.summary7, ...)` lines (Study time, Quizzes, Average, Most missed) if any remain.

- [ ] **Step 3: Run the e2e for both grades**

Run: `node tests/e2e/lobby-e2e.js`
Then: `node tests/e2e/lobby-e2e.js 5`
Expected: both pass with no page errors.

If an assertion on exact text fails, print `r` from the run, compare with the numbers in this task's intro, and fix the code (not the expected numbers) unless the intro's arithmetic is wrong.

- [ ] **Step 4: Run the other e2e suites that open the lobby**

Run: `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/backup-e2e.js`, `node tests/e2e/migration-e2e.js`
Expected: pass. (`backup-e2e` presses Export and Import buttons that now sit in the hidden Settings panel; `.click()` still works on hidden elements. If one of them checks visibility, have it click the Settings tab first.)

- [ ] **Step 5: Stage**

```bash
git add tests/e2e/lobby-driver.page.js tests/e2e/lobby-e2e.js
git commit -m 'Lobby e2e: the Parent view opens on Focus with tiles, subjects ranked by questions to fix, weakest lessons, Fixed and Still missing chips, the Subjects tab, and Focus again on every open'
```

---

### Task 8: Check the phone page by hand, then README

**Files:**
- Modify: `README.md` (Parent panel section)

- [ ] **Step 1: Look at the phone page**

The phone page has no e2e. Serve `web/` and open it in Chrome at a phone width (DevTools device toolbar, 390 px):

Run: `npx http-server web -p 8080 -c-1`
Open: `http://localhost:8080/parent/` → sign in with the family login → PIN 0108 → a child.

Check:
- Shop requests and the child's name sit above the range bar and tabs.
- Focus opens first, tiles fit in two rows, subject cards open and close.
- Subjects shows every subject with medals; 🔧 shows on lessons that need a polish.
- Rewards shows coins, points, streak, boss line, shop prices and the real test form; adding a test score still syncs.
- Both light and dark mode read well.
- No horizontal scroll.

If you cannot sign in (no network or no family login), say so in the report and skip this step; do not mark it done.

- [ ] **Step 2: Update README**

In `README.md`, in `## Parent panel`, replace the **Study history** and **Needs practice** bullets with:

```markdown
- **Tabs:** 🎯 Focus (opens first), 📚 Subjects, 🕒 Activity, 🪙 Rewards and ⚙️ Settings (tablets only). The range (Today, 7 days, 30 days, All, Custom; Last 30 days by default) drives Focus, Subjects and Activity.
- **Focus:** the subjects that need the most help first, ranked by questions to fix, then % right. Open one for its weakest lessons (5+ answers, under 80%) and each question she missed: what she picked, the right answer, how often, its lesson, a **Still missing** or **Fixed** chip (from the review boxes; answers saved before 2026-10-05 and Grade 5 Math show no chip), and a note when she picked the same wrong answer more than once.
- **Subjects:** every subject with % right, quizzes and medals; every lesson with its medal, 🔧 when it needs a review, and % right in the range.
- **Activity:** every app opened, lesson viewed and quiz taken, with score, time, power-ups used and each wrong answer. Filter by subject.
```

Keep the Learner, Real test score, Cloud backup, Full backup and spreadsheet bullets.

- [ ] **Step 3: Full test run, then stage**

Run: `node --test`
Expected: PASS.

```bash
git add README.md
git commit -m 'README: the Parent view tabs, Focus and Subjects'
```

---

## Self-review notes

- Spec coverage: tabs (Tasks 4, 5), Focus ranking, weakest lessons, questions with chips and repeated picks (Tasks 2, 5), Subjects with medals and 🔧 (Tasks 2, 6), 30-day default (Tasks 4, 5), key and time on wrong answers (Task 1), phone medals moved (Tasks 4, 6), wiring and offline cache (Task 3), README (Task 8). "Practice these" is out of scope by decision.
- Names used across tasks: `Insights.build`, `Insights.lessonRows`, `Insights.status`; report fields `answered, correct, pct, toFix, fixed, subjects`; subject fields `app, title, answered, correct, pct, quizzes, toFix, fixed, lessons, questions`; lesson fields `title, answered, correct, pct, quizzes, last, weak`; question fields `q, answer, lastPick, lesson, key, count, last, status, repeatedPick`; panel `showTab`, `renderFocus`, `renderSubjects`, ids `p-tabs`, `focus`, `subjects-list`, `hist-summary`.
- `SH.weakSpots` and `SH.summary().mostMissed` stay in `study-history.js`: daily quests use `weakSpots`, and both have unit tests. The panel just stops showing them.
