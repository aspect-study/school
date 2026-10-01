# Grade 2 Study History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record, with date and time, every app visit, lesson review and quiz (including each wrong answer) in the 7 Grade 2 study games, and show it in a PIN-protected History panel in the Grade 2 lobby with filters, export/import and date-range delete.

**Architecture:** One shared, dependency-free script `grade 2/study-history.js` owns all storage (one `localStorage` key, `grade2_history_v1`, never touched by `?reset=1`). The 7 apps call it at five moments each through a guarded global (`SH && SH.quizStarted(...)`), so a missing file never breaks a game. The lobby loads the same script to render the timeline and to delete, export and import.

**Tech Stack:** Plain ES5-style browser JavaScript (no build, no libraries), Node 22 `node:test` for unit tests, headless Chrome `--dump-dom` for end-to-end tests.

**Spec:** `docs/superpowers/specs/2026-09-28-grade2-study-history-design.md`

**House rules for whoever executes this plan:**
- **Never run `git commit`.** The folder is not a git repo today. Each task ends with a suggested commit message in a code block for the user to run themselves. Never add `Co-Authored-By:` lines.
- Comment sparingly: only non-obvious code.
- `study-history.js` must stay **ASCII-only** (write non-ASCII as `\uXXXX`). The app pages have no `<meta charset>`, so an external script's non-ASCII bytes could be mis-decoded.
- Never change lesson content, questions, answer keys, scoring or points logic in any app.
- All paths below are relative to `C:\Users\ADMIN\IdeaProjects\school\`.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `grade 2/study-history.js` | create | storage, recording API, reading/summary, delete, export/import |
| `tests/study-history.test.js` | create | Node unit tests for `study-history.js` |
| `tests/e2e/chrome.js` | create | headless Chrome helpers: work dir, `dumpDom`, driver injection, output parsing |
| `tests/e2e/driver-common.page.js` | create | in-page helpers shared by the app drivers |
| `tests/e2e/driver-family-a.page.js` | create | in-page driver for Block Bot and Kuwentista |
| `tests/e2e/driver-family-b.page.js` | create | in-page driver for the other five apps |
| `tests/e2e/apps-e2e.js` | create | plays every app in headless Chrome and asserts the history |
| `tests/e2e/lobby-driver.page.js` | create | in-page driver for the lobby |
| `tests/e2e/lobby-e2e.js` | create | exercises the lobby panel in headless Chrome |
| `grade 2/word-train.html`, `batang-bayani.html`, `growing-good.html`, `byte-buddies.html`, `science-detectives.html` | modify | family B hooks |
| `grade 2/kuwentista.html` | modify | family A hooks |
| `grade 2/block-bot.html` | modify | family A hooks + number-line hook |
| `grade 2/lobby.html` | modify | Parent link, PIN pad, History panel |

`tests/` lives at the repo root, outside `grade 2/`, so it is never copied to the girls' devices.

---

### Task 1: `study-history.js` core: storage, text cleanup, recording

**Files:**
- Create: `grade 2/study-history.js`
- Test: `tests/study-history.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/study-history.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { create, plain, KEY } = require(path.join(__dirname, '..', 'grade 2', 'study-history.js'));

function memStorage() {
  const data = {};
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

function makeClock() {
  const clock = { ms: new Date(2026, 8, 28, 15, 41).getTime() };
  clock.now = () => clock.ms;
  clock.advance = (minutes) => { clock.ms += minutes * 60000; };
  clock.set = (y, mo, d, h, mi) => { clock.ms = new Date(y, mo - 1, d, h, mi).getTime(); };
  return clock;
}

function setup() {
  const storage = memStorage();
  const clock = makeClock();
  return { storage, clock, sh: create(storage, clock.now) };
}

const saved = (storage) => JSON.parse(storage.getItem(KEY)).entries;

test('plain strips tags, decodes entities and collapses whitespace', () => {
  assert.equal(plain('<b>Tom</b> &amp; Jerry&rsquo;s &mdash; &#8369;50\n ok'), 'Tom & Jerry\u2019s \u2014 \u20B150 ok');
  assert.equal(plain(42), '42');
  assert.equal(plain(null), '');
  assert.equal(plain('&unknown;'), '&unknown;');
});

test('appOpened records an open entry with the time', () => {
  const { sh, storage, clock } = setup();
  const id = sh.appOpened('word-train', 'Word Train');
  const data = JSON.parse(storage.getItem(KEY));
  assert.equal(data.v, 1);
  assert.deepEqual(data.entries, [{ type: 'open', app: 'word-train', appTitle: 'Word Train', id, t: clock.ms }]);
});

test('lessonOpened and cardViewed track the furthest card reached', () => {
  const { sh, storage, clock } = setup();
  const start = clock.ms;
  const id = sh.lessonOpened('kuwentista', 'Kuwentista', 'pangngalan', 'Pangngalan &amp; Panghalip', 8);
  sh.cardViewed(id, 1);
  clock.advance(2);
  sh.cardViewed(id, 3);
  sh.cardViewed(id, 2);
  const [e] = saved(storage);
  assert.equal(e.type, 'lesson');
  assert.equal(e.lessonId, 'pangngalan');
  assert.equal(e.lessonTitle, 'Pangngalan & Panghalip');
  assert.equal(e.cardsTotal, 8);
  assert.equal(e.cardsViewed, 3);
  assert.equal(e.t, start);
  assert.equal(e.updatedAt, start + 2 * 60000);
});

test('a quiz records answers, wrong picks as plain text, and the finish', () => {
  const { sh, storage, clock } = setup();
  const start = clock.ms;
  const id = sh.quizStarted('word-train', 'Word Train', 0, 'Nouns', false, 3);
  sh.quizAnswered(id, true, 'Q1', 'a', 'a');
  clock.advance(2);
  sh.quizAnswered(id, false, 'Which is a &ldquo;noun&rdquo;?', '<b>run</b>', 'cat');
  sh.quizAnswered(id, true, 'Q3', 'x', 'x');
  clock.advance(1);
  sh.quizFinished(id, 2, 45, 1);
  const [e] = saved(storage);
  assert.equal(e.type, 'quiz');
  assert.equal(e.lessonId, '0');
  assert.equal(e.final, false);
  assert.equal(e.total, 3);
  assert.equal(e.answered, 3);
  assert.equal(e.correct, 2);
  assert.deepEqual(e.wrong, [{ q: 'Which is a \u201Cnoun\u201D?', picked: 'run', answer: 'cat' }]);
  assert.equal(e.finished, true);
  assert.equal(e.stars, 2);
  assert.equal(e.points, 45);
  assert.equal(e.bestStreak, 1);
  assert.equal(e.t, start);
  assert.equal(e.updatedAt, start + 3 * 60000);
});

test('a quiz left halfway stays unfinished with its partial counts', () => {
  const { sh, storage } = setup();
  const id = sh.quizStarted('word-train', 'Word Train', 'final', 'Word Train Review', true, 21);
  sh.quizAnswered(id, true, 'Q1', 'a', 'a');
  sh.quizAnswered(id, false, 'Q2', 'b', 'c');
  const [e] = saved(storage);
  assert.equal(e.final, true);
  assert.equal(e.finished, false);
  assert.equal(e.answered, 2);
  assert.equal(e.correct, 1);
});

test('calls with a missing entry id are ignored', () => {
  const { sh, storage } = setup();
  sh.cardViewed(null, 2);
  sh.quizAnswered(null, false, 'q', 'a', 'b');
  sh.quizFinished(null, 3, 10, 1);
  assert.equal(storage.getItem(KEY), null);
});

test('a full storage drops the entry, sets the error marker and never throws', () => {
  const { sh, storage, clock } = setup();
  const realSet = storage.setItem;
  storage.setItem = (k, v) => { if (k === KEY) throw new Error('QuotaExceededError'); realSet(k, v); };
  assert.equal(sh.appOpened('word-train', 'Word Train'), null);
  assert.equal(sh.storageError(), clock.ms);
  assert.equal(storage.getItem(KEY), null);
});

test('corrupt history is copied aside before new writes', () => {
  const { sh, storage, clock } = setup();
  storage.setItem(KEY, '{not json');
  sh.appOpened('word-train', 'Word Train');
  assert.equal(storage.getItem('grade2_history_corrupt_v1_' + clock.ms), '{not json');
  assert.equal(saved(storage).length, 1);
});

test('corrupt history that cannot be copied aside is left untouched', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{not json');
  const realSet = storage.setItem;
  storage.setItem = (k, v) => { if (k.startsWith('grade2_history_corrupt')) throw new Error('full'); realSet(k, v); };
  assert.equal(sh.appOpened('word-train', 'Word Train'), null);
  assert.equal(storage.getItem(KEY), '{not json');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `C:\Users\ADMIN\IdeaProjects\school`): `node --test tests/`
Expected: FAIL with `Cannot find module ...grade 2\study-history.js`.

- [ ] **Step 3: Write the implementation**

Create `grade 2/study-history.js`:

```js
/* Keep this file ASCII-only: the pages that load it declare no charset. */
(function (root) {
  'use strict';

  var KEY = 'grade2_history_v1';
  var ERROR_KEY = 'grade2_history_error_v1';
  var CORRUPT_PREFIX = 'grade2_history_corrupt_v1_';
  var TYPES = ['open', 'lesson', 'quiz'];
  var MAX_ENTRY_MS = 60 * 60000;
  var ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ldquo: '\u201C', rdquo: '\u201D', lsquo: '\u2018', rsquo: '\u2019',
    mdash: '\u2014', ndash: '\u2013', minus: '\u2212', middot: '\u00B7',
    rarr: '\u2192', larr: '\u2190', times: '\u00D7', divide: '\u00F7', hellip: '\u2026'
  };

  function plain(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/<[^>]*>/g, '')
      .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, function (match, code) {
        if (code.charAt(0) === '#') {
          var hex = code.charAt(1) === 'x' || code.charAt(1) === 'X';
          var n = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
          return isNaN(n) ? match : String.fromCodePoint(n);
        }
        return Object.prototype.hasOwnProperty.call(ENTITIES, code) ? ENTITIES[code] : match;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayStart(key, addDays) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2] + (addDays || 0)).getTime();
  }

  function inRange(t, from, to) {
    return (!from || t >= dayStart(from)) && (!to || t < dayStart(to, 1));
  }

  function create(storage, now) {
    var api = { plain: plain, dateKey: dateKey };

    // Returns null when history cannot be safely written (unreadable, or corrupt and not copied aside).
    function load() {
      var raw;
      try { raw = storage.getItem(KEY); } catch (e) { return null; }
      if (!raw) return [];
      try {
        var data = JSON.parse(raw);
        if (data && data.v === 1 && Array.isArray(data.entries)) return data.entries;
      } catch (e) {}
      try { storage.setItem(CORRUPT_PREFIX + now(), raw); } catch (e) { return null; }
      return [];
    }

    function save(entries) {
      try {
        storage.setItem(KEY, JSON.stringify({ v: 1, entries: entries }));
        return true;
      } catch (e) {
        try { storage.setItem(ERROR_KEY, String(now())); } catch (e2) {}
        return false;
      }
    }

    function mutate(fn) {
      var entries = load();
      if (entries === null) return false;
      fn(entries);
      return save(entries);
    }

    function clearError() {
      try { storage.removeItem(ERROR_KEY); } catch (e) {}
    }

    function add(fields) {
      var t = now();
      fields.id = t + '-' + Math.random().toString(36).slice(2, 8);
      fields.t = t;
      if (fields.type !== 'open') fields.updatedAt = t;
      return mutate(function (entries) { entries.push(fields); }) ? fields.id : null;
    }

    function update(id, fn) {
      if (!id) return false;
      return mutate(function (entries) {
        for (var i = entries.length - 1; i >= 0; i--) {
          if (entries[i].id === id) { fn(entries[i]); entries[i].updatedAt = now(); return; }
        }
      });
    }

    api.appOpened = function (app, appTitle) {
      return add({ type: 'open', app: app, appTitle: plain(appTitle) });
    };

    api.lessonOpened = function (app, appTitle, lessonId, lessonTitle, cardsTotal) {
      return add({
        type: 'lesson', app: app, appTitle: plain(appTitle),
        lessonId: String(lessonId), lessonTitle: plain(lessonTitle),
        cardsTotal: cardsTotal, cardsViewed: 0
      });
    };

    api.cardViewed = function (id, cardNumber) {
      update(id, function (e) { if (cardNumber > e.cardsViewed) e.cardsViewed = cardNumber; });
    };

    api.quizStarted = function (app, appTitle, lessonId, lessonTitle, isFinal, total) {
      return add({
        type: 'quiz', app: app, appTitle: plain(appTitle),
        lessonId: String(lessonId), lessonTitle: plain(lessonTitle),
        final: !!isFinal, total: total, answered: 0, correct: 0, wrong: [],
        finished: false, stars: 0, points: 0, bestStreak: 0
      });
    };

    api.quizAnswered = function (id, isCorrect, q, picked, answer) {
      update(id, function (e) {
        e.answered++;
        if (isCorrect) e.correct++;
        else e.wrong.push({ q: plain(q), picked: plain(picked), answer: plain(answer) });
      });
    };

    api.quizFinished = function (id, stars, points, bestStreak) {
      update(id, function (e) {
        e.finished = true;
        e.stars = stars;
        e.points = points;
        e.bestStreak = bestStreak;
      });
    };

    api.storageError = function () {
      try {
        var v = storage.getItem(ERROR_KEY);
        return v ? Number(v) : null;
      } catch (e) { return null; }
    };

    return api;
  }

  var exported = { create: create, plain: plain, dateKey: dateKey, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    root.localStorage.getItem(KEY);
    root.StudyHistory = create(root.localStorage, Date.now);
  } catch (e) {}
})(this);
```

Later tasks add more `api.*` functions and reference `inRange`, `load`, `mutate`, `clearError`, `TYPES` and `MAX_ENTRY_MS`; they all go **inside `create`, immediately before `return api;`**.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: `# pass 9`, `# fail 0`.

- [ ] **Step 5: Check the file is ASCII-only**

Run (Git Bash): `grep -nP '[^\x00-\x7F]' "grade 2/study-history.js" || echo ASCII-OK`
Expected: `ASCII-OK`.

- [ ] **Step 6: Suggest a commit message to the user (do not run git)**

```
feat(grade2): add study-history.js core recording API
```

---

### Task 2: Reading: `list` and `summary`

**Files:**
- Modify: `grade 2/study-history.js` (inside `create`, before `return api;`)
- Test: `tests/study-history.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/study-history.test.js`:

```js
function seed() {
  const ctx = setup();
  const { sh, clock } = ctx;

  clock.set(2026, 9, 1, 9, 0);
  sh.appOpened('word-train', 'Word Train');

  clock.set(2026, 9, 15, 23, 59);
  const lesson = sh.lessonOpened('kuwentista', 'Kuwentista', 'pangngalan', 'Pangngalan', 8);
  clock.advance(4);
  sh.cardViewed(lesson, 8);

  clock.set(2026, 9, 16, 0, 0);
  const c = sh.quizStarted('word-train', 'Word Train', 0, 'Nouns', false, 10);
  for (let i = 0; i < 8; i++) sh.quizAnswered(c, true, 'ok', 'a', 'a');
  sh.quizAnswered(c, false, 'Pick the noun', 'run', 'cat');
  sh.quizAnswered(c, false, 'Spell "cat"', 'kat', 'cat');
  clock.advance(5);
  sh.quizFinished(c, 2, 95, 8);

  clock.set(2026, 9, 20, 10, 0);
  const d = sh.quizStarted('word-train', 'Word Train', 'final', 'Word Train Review', true, 4);
  sh.quizAnswered(d, true, 'ok', 'a', 'a');
  sh.quizAnswered(d, false, 'Pick the noun', 'run', 'cat');
  sh.quizAnswered(d, false, 'Pick the verb', 'cat', 'run');
  sh.quizAnswered(d, true, 'ok', 'a', 'a');
  clock.advance(3);
  sh.quizFinished(d, 1, 20, 1);

  clock.set(2026, 9, 28, 15, 0);
  const e = sh.quizStarted('kuwentista', 'Kuwentista', 'pangngalan', 'Pangngalan', false, 10);
  clock.advance(2);
  sh.quizAnswered(e, false, 'Q', 'A', 'B');

  return ctx;
}

const kinds = (entries) => entries.map((e) => e.type + ':' + e.app + ':' + new Date(e.t).getDate());

test('list returns everything newest first', () => {
  const { sh } = seed();
  assert.deepEqual(kinds(sh.list()), [
    'quiz:kuwentista:28', 'quiz:word-train:20', 'quiz:word-train:16', 'lesson:kuwentista:15', 'open:word-train:1',
  ]);
});

test('list date range is inclusive of whole local days', () => {
  const { sh } = seed();
  assert.deepEqual(kinds(sh.list('2026-09-15', '2026-09-15')), ['lesson:kuwentista:15']);
  assert.deepEqual(kinds(sh.list('2026-09-16', null)), ['quiz:kuwentista:28', 'quiz:word-train:20', 'quiz:word-train:16']);
});

test('list filters by app', () => {
  const { sh } = seed();
  assert.deepEqual(kinds(sh.list(null, null, 'kuwentista')), ['quiz:kuwentista:28', 'lesson:kuwentista:15']);
});

test('summary totals time, quizzes, average and the most-missed question', () => {
  const { sh } = seed();
  assert.deepEqual(sh.summary(sh.list('2026-09-01', '2026-09-30')), {
    studyMs: 14 * 60000,
    quizzes: 3,
    averagePct: 65,
    mostMissed: { appTitle: 'Word Train', q: 'Pick the noun', count: 2 },
  });
});

test('summary of nothing is empty', () => {
  const { sh } = setup();
  assert.deepEqual(sh.summary([]), { studyMs: 0, quizzes: 0, averagePct: null, mostMissed: null });
});

test('summary caps one entry at 60 minutes', () => {
  const { sh, clock } = setup();
  const id = sh.lessonOpened('word-train', 'Word Train', 0, 'Nouns', 5);
  clock.advance(180);
  sh.cardViewed(id, 5);
  assert.equal(sh.summary(sh.list()).studyMs, 60 * 60000);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL with `sh.list is not a function`.

- [ ] **Step 3: Write the implementation**

Insert inside `create` in `grade 2/study-history.js`, immediately before `return api;`:

```js
    api.list = function (from, to, app) {
      return (load() || [])
        .filter(function (e) { return inRange(e.t, from, to) && (!app || e.app === app); })
        .sort(function (a, b) { return b.t - a.t; });
    };

    api.summary = function (entries) {
      var studyMs = 0, quizzes = 0, finished = 0, pctSum = 0, missed = {}, top = null;
      entries.forEach(function (e) {
        if (e.type !== 'open' && e.updatedAt) studyMs += Math.min(e.updatedAt - e.t, MAX_ENTRY_MS);
        if (e.type !== 'quiz') return;
        quizzes++;
        if (e.finished && e.total) { finished++; pctSum += e.correct / e.total; }
        (e.wrong || []).forEach(function (w) {
          var k = e.app + '\n' + w.q;
          var m = missed[k] || (missed[k] = { appTitle: e.appTitle, q: w.q, count: 0 });
          m.count++;
          if (!top || m.count > top.count) top = m;
        });
      });
      return {
        studyMs: studyMs,
        quizzes: quizzes,
        averagePct: finished ? Math.round(pctSum / finished * 100) : null,
        mostMissed: top
      };
    };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: `# pass 15`, `# fail 0`.

- [ ] **Step 5: Suggest a commit message to the user (do not run git)**

```
feat(grade2): add history list and summary
```

---

### Task 3: Delete, export and import

**Files:**
- Modify: `grade 2/study-history.js` (inside `create`, before `return api;`)
- Test: `tests/study-history.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/study-history.test.js`:

```js
test('deleteRange removes only entries inside the inclusive range', () => {
  const { sh } = seed();
  assert.equal(sh.deleteRange('2026-09-15', '2026-09-16'), 2);
  assert.deepEqual(kinds(sh.list()), ['quiz:kuwentista:28', 'quiz:word-train:20', 'open:word-train:1']);
});

test('deleting clears the storage-full marker', () => {
  const { sh, storage } = seed();
  storage.setItem('grade2_history_error_v1', '123');
  sh.deleteRange('2026-09-01', '2026-09-01');
  assert.equal(sh.storageError(), null);
});

test('deleteAll empties history and reports the count', () => {
  const { sh, storage } = seed();
  assert.equal(sh.deleteAll(), 5);
  assert.equal(storage.getItem(KEY), null);
  assert.deepEqual(sh.list(), []);
});

test('export then import restores identical entries and a second import adds nothing', () => {
  const { sh } = seed();
  const backup = sh.exportJson();
  const other = setup().sh;
  assert.deepEqual(other.importJson(backup), { added: 5, skipped: 0 });
  assert.deepEqual(other.list(), sh.list());
  assert.deepEqual(other.importJson(backup), { added: 0, skipped: 5 });
});

test('import merges with existing entries in time order', () => {
  const { sh } = seed();
  const backup = sh.exportJson();
  sh.deleteRange('2026-09-15', '2026-09-20');
  assert.deepEqual(sh.importJson(backup), { added: 3, skipped: 2 });
  assert.equal(sh.list().length, 5);
  const t = JSON.parse(sh.exportJson()).entries.map((e) => e.t);
  assert.deepEqual(t, [...t].sort((a, b) => a - b));
});

test('import rejects files that are not a history backup and changes nothing', () => {
  const { sh } = seed();
  const before = sh.exportJson();
  for (const bad of ['hello', '{"v":2,"entries":[]}', '{"v":1,"entries":[{"type":"open","t":1,"app":"x"}]}']) {
    assert.throws(() => sh.importJson(bad), /not a Study History backup/);
  }
  assert.equal(sh.exportJson(), before);
});

test('exportCsv writes one spreadsheet-safe row per entry', () => {
  const { sh } = seed();
  const csv = sh.exportCsv();
  assert.ok(csv.startsWith('\uFEFF'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Date,Time,Subject,Type,Lesson,Score,Answered,Stars,Points,Minutes,Cards viewed,Finished,Wrong answers');
  assert.equal(lines[1], '2026-09-01,09:00,Word Train,Opened app,,,,,,,,,');
  assert.equal(lines[2], '2026-09-15,23:59,Kuwentista,Lesson,Pangngalan,,,,,4,8 of 8,,');
  assert.equal(lines[3], '2026-09-16,00:00,Word Train,Quiz,Nouns,8 of 10,10,2,95,5,,Yes,"Pick the noun \u2192 run (correct: cat) | Spell ""cat"" \u2192 kat (correct: cat)"');
  assert.equal(lines[4], '2026-09-20,10:00,Word Train,Final exam,Final Mock Exam,2 of 4,4,1,20,3,,Yes,Pick the noun \u2192 run (correct: cat) | Pick the verb \u2192 cat (correct: run)');
  assert.equal(lines[5], '2026-09-28,15:00,Kuwentista,Quiz,Pangngalan,0 of 10,1,,,2,,No,Q \u2192 A (correct: B)');
  assert.equal(lines[6], '');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL with `sh.deleteRange is not a function`.

- [ ] **Step 3: Write the implementation**

Insert inside `create` in `grade 2/study-history.js`, immediately before `return api;`:

```js
    api.deleteRange = function (from, to) {
      var removed = 0;
      var ok = mutate(function (entries) {
        for (var i = entries.length - 1; i >= 0; i--) {
          if (inRange(entries[i].t, from, to)) { entries.splice(i, 1); removed++; }
        }
      });
      if (!ok) return 0;
      clearError();
      return removed;
    };

    api.deleteAll = function () {
      var count = (load() || []).length;
      try { storage.removeItem(KEY); } catch (e) { return 0; }
      clearError();
      return count;
    };

    api.exportJson = function () {
      return JSON.stringify({ v: 1, exportedAt: now(), entries: load() || [] });
    };

    function csvCell(value) {
      var s = value === null || value === undefined ? '' : String(value);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function timeKey(ms) {
      var d = new Date(ms);
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    // "8 of 10" rather than "8/10": spreadsheets turn 8/10 into a date.
    function csvRow(e) {
      var quiz = e.type === 'quiz';
      var type = e.type === 'open' ? 'Opened app' : e.type === 'lesson' ? 'Lesson' : e.final ? 'Final exam' : 'Quiz';
      return [
        dateKey(e.t), timeKey(e.t), e.appTitle, type,
        e.type === 'open' ? '' : (e.final ? 'Final Mock Exam' : e.lessonTitle),
        quiz ? e.correct + ' of ' + e.total : '',
        quiz ? e.answered : '',
        quiz && e.finished ? e.stars : '',
        quiz && e.finished ? e.points : '',
        e.type === 'open' ? '' : Math.round((e.updatedAt - e.t) / 60000),
        e.type === 'lesson' ? e.cardsViewed + ' of ' + e.cardsTotal : '',
        quiz ? (e.finished ? 'Yes' : 'No') : '',
        quiz ? e.wrong.map(function (w) {
          return w.q + ' \u2192 ' + w.picked + ' (correct: ' + w.answer + ')';
        }).join(' | ') : ''
      ];
    }

    api.exportCsv = function () {
      var rows = [['Date', 'Time', 'Subject', 'Type', 'Lesson', 'Score', 'Answered', 'Stars', 'Points',
        'Minutes', 'Cards viewed', 'Finished', 'Wrong answers']];
      (load() || []).slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (e) {
        rows.push(csvRow(e));
      });
      return '\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
    };

    function validEntry(e) {
      return !!e && typeof e.id === 'string' && typeof e.t === 'number' &&
        typeof e.app === 'string' && TYPES.indexOf(e.type) >= 0;
    }

    api.importJson = function (text) {
      var data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (!data || data.v !== 1 || !Array.isArray(data.entries) || !data.entries.every(validEntry)) {
        throw new Error('This file is not a Study History backup.');
      }
      var result = { added: 0, skipped: 0 };
      var ok = mutate(function (entries) {
        var seen = {};
        entries.forEach(function (e) { seen[e.id] = true; });
        data.entries.forEach(function (e) {
          if (seen[e.id]) { result.skipped++; return; }
          seen[e.id] = true;
          entries.push(e);
          result.added++;
        });
        entries.sort(function (a, b) { return a.t - b.t; });
      });
      if (!ok) throw new Error('Could not save: browser storage is full or unavailable.');
      clearError();
      return result;
    };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: `# pass 22`, `# fail 0`.

- [ ] **Step 5: Check the file is still ASCII-only**

Run (Git Bash): `grep -nP '[^\x00-\x7F]' "grade 2/study-history.js" || echo ASCII-OK`
Expected: `ASCII-OK`.

- [ ] **Step 6: Suggest a commit message to the user (do not run git)**

```
feat(grade2): add history delete, export and import
```

---

### Task 4: End-to-end harness for the apps (fails until the apps are wired)

**Files:**
- Create: `tests/e2e/chrome.js`
- Create: `tests/e2e/driver-common.page.js`
- Create: `tests/e2e/driver-family-a.page.js`
- Create: `tests/e2e/driver-family-b.page.js`
- Create: `tests/e2e/apps-e2e.js`

How it works: for each app, the harness copies the app into a temp folder and injects a driver script right after the app's **last** `renderHome();` call. In family B that call is inside the app's closure, so the driver can reach its private variables. Chrome runs three times per app with one shared profile, since headless Chrome keeps `localStorage` between runs that share `--user-data-dir` (verified 2026-09-28):
1. `#e2e=seed` puts a sentinel history entry in storage.
2. `?reset=1#e2e=play` plays the scenarios. `?reset=1` must keep the sentinel and log exactly one "open". The mode sits in the **hash** because the app's `replaceState` strips the query string.
3. `#e2e=refresh` reloads without reset, which must add no entries.

A fourth run uses a copy with **no** `study-history.js` and must play cleanly.

- [ ] **Step 1: Create `tests/e2e/chrome.js`**

```js
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const GRADE2 = path.join(__dirname, '..', '..', 'grade 2');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

const ERROR_TRAP = '<script>window.__e2eErrors=[];addEventListener("error",function(e){__e2eErrors.push(String(e.message));});</script>';

function makeWorkDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), name + '-'));
}

function dumpDom(profileDir, file, suffix) {
  if (!CHROME) throw new Error('Chrome or Edge not found');
  const url = pathToFileURL(file).href + (suffix || '');
  return execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + profileDir, '--dump-dom', url,
  ], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
}

function readOutput(html) {
  const m = html.match(/<pre id="e2e-out">([\s\S]*?)<\/pre>/);
  if (!m) throw new Error('no e2e output in page (driver did not run): ' + html.slice(-300));
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return JSON.parse(text);
}

function withErrorTrap(html) {
  const first = html.indexOf('<script');
  if (first < 0) throw new Error('no <script> in page');
  return html.slice(0, first) + ERROR_TRAP + html.slice(first);
}

function injectDriver(html, driver) {
  const marker = 'renderHome();';
  const last = html.lastIndexOf(marker);
  if (last < 0) throw new Error('renderHome(); not found');
  const cut = last + marker.length;
  return withErrorTrap(html.slice(0, cut) + '\n' + driver + '\n' + html.slice(cut));
}

function appendDriver(html, driver) {
  return withErrorTrap(html) + '\n<script>\n' + driver + '\n</script>\n';
}

module.exports = { GRADE2, makeWorkDir, dumpDom, readOutput, injectDriver, appendDriver };
```

- [ ] **Step 2: Create `tests/e2e/driver-common.page.js`**

```js
function __e2eOut(obj) {
  obj.errors = window.__e2eErrors || [];
  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(obj);
  document.body.appendChild(pre);
}

function __e2eHistory() {
  try { return (JSON.parse(localStorage.getItem('grade2_history_v1')) || { entries: [] }).entries; }
  catch (e) { return 'unparseable'; }
}

function __e2eMode() {
  return (location.hash.match(/e2e=(\w+)/) || [])[1];
}

function __e2eSeed() {
  localStorage.setItem('grade2_history_v1', JSON.stringify({
    v: 1, entries: [{ id: 'seed-1', type: 'open', app: 'seed', appTitle: 'Seed', t: 1 }]
  }));
  __e2eOut({ seeded: true });
}
```

- [ ] **Step 3: Create `tests/e2e/driver-family-b.page.js`**

Runs inside the family B closure (word-train, batang-bayani, growing-good, byte-buddies, science-detectives). The loops run a fixed count because `#btn-next` on the last question calls `finishQuiz()`.

```js
function __e2eAnswer(right) {
  var item = currentQuizSet[qIdx];
  if (item.type === 'tf') {
    var want = right ? item.answer : !item.answer;
    document.querySelector('#q-options .tf-row').children[want ? 0 : 1].click();
    return;
  }
  var pick = -1;
  item.options.forEach(function (o, i) { if (pick < 0 && (right ? o.correct : !o.correct)) pick = i; });
  document.querySelectorAll('#q-options .opt')[pick].click();
}

function __e2eAnswerAll(right) {
  var n = currentQuizSet.length;
  for (var k = 0; k < n; k++) { __e2eAnswer(right); document.getElementById('btn-next').click(); }
  return n;
}

function __e2eRun() {
  var mode = __e2eMode();
  if (mode === 'seed') return __e2eSeed();
  if (mode === 'refresh') return __e2eOut({ entries: __e2eHistory() });
  if (mode === 'nojs') {
    currentLesson = 0; startQuiz();
    var n0 = __e2eAnswerAll(true);
    return __e2eOut({ score: score, total: n0, hasSH: !!window.StudyHistory });
  }
  if (mode !== 'play') return;

  var expect = { cardsTotal: lessons[0].flashcards.length, lessonTitle: lessons[0].title };
  document.querySelector('button[data-lesson="0"]').click();
  document.getElementById('btn-flash-next').click();
  document.getElementById('btn-flash-next').click();
  goHome();

  currentLesson = 0; startQuiz();
  expect.perfectTotal = __e2eAnswerAll(true);
  expect.perfectPoints = sessionPoints;

  currentLesson = 0; startQuiz();
  expect.wrongTotal = __e2eAnswerAll(false);

  currentLesson = 0; startQuiz();
  expect.partialTotal = currentQuizSet.length;
  __e2eAnswer(true); document.getElementById('btn-next').click();
  __e2eAnswer(true);
  goHome();

  startFinalExam();
  expect.finalTotal = __e2eAnswerAll(true);

  __e2eOut({ entries: __e2eHistory(), expect: expect });
}
__e2eRun();
```

- [ ] **Step 4: Create `tests/e2e/driver-family-a.page.js`**

Runs at the top level of Block Bot and Kuwentista. It sets `currentLessonIdx` directly rather than calling `openLesson`, so no extra lesson entries are logged.

```js
function __e2eAnswer(right) {
  var q = currentQuizSet[quizIdx];
  if (q.type === 'numberline') {
    document.getElementById('nline-input').value = String(q.start + q.jumps + (right ? 0 : 1));
    checkNumberline();
    return;
  }
  selectOption(right ? q.correct : (q.correct + 1) % q.options.length);
}

function __e2eAnswerAll(right) {
  var n = currentQuizSet.length;
  for (var k = 0; k < n; k++) { __e2eAnswer(right); nextQuestion(); }
  return n;
}

function __e2eRun() {
  var mode = __e2eMode();
  if (mode === 'seed') return __e2eSeed();
  if (mode === 'refresh') return __e2eOut({ entries: __e2eHistory() });
  if (mode === 'nojs') {
    currentLessonIdx = 0; startQuiz();
    var n0 = __e2eAnswerAll(true);
    return __e2eOut({ score: quizScore, total: n0, hasSH: !!window.StudyHistory });
  }
  if (mode !== 'play') return;

  var expect = { cardsTotal: LESSONS[0].flashcards.length, lessonTitle: LESSONS[0].title };
  openLesson(0);
  cardStep(1);
  cardStep(1);
  goHome();

  currentLessonIdx = 0; startQuiz();
  expect.perfectTotal = __e2eAnswerAll(true);
  expect.perfectPoints = sessionPoints;

  currentLessonIdx = 0; startQuiz();
  expect.wrongTotal = __e2eAnswerAll(false);

  currentLessonIdx = 0; startQuiz();
  expect.partialTotal = currentQuizSet.length;
  __e2eAnswer(true); nextQuestion();
  __e2eAnswer(true);
  goHome();

  startFinalExam();
  expect.finalTotal = __e2eAnswerAll(true);

  var gen = -1;
  for (var i = 0; i < LESSONS.length; i++) if (gen < 0 && LESSONS[i].generate) gen = i;
  if (gen >= 0) {
    currentLessonIdx = gen; startQuiz();
    expect.numberlineTotal = __e2eAnswerAll(false);
  }

  __e2eOut({ entries: __e2eHistory(), expect: expect });
}
__e2eRun();
```

- [ ] **Step 5: Create `tests/e2e/apps-e2e.js`**

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GRADE2, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { plain } = require(path.join(GRADE2, 'study-history.js'));

const APPS = [
  { file: 'block-bot.html', slug: 'block-bot', title: 'Block Bot', family: 'a' },
  { file: 'kuwentista.html', slug: 'kuwentista', title: 'Kuwentista', family: 'a' },
  { file: 'word-train.html', slug: 'word-train', title: 'Word Train', family: 'b' },
  { file: 'batang-bayani.html', slug: 'batang-bayani', title: 'Batang Bayani', family: 'b' },
  { file: 'growing-good.html', slug: 'growing-good', title: 'Growing Good', family: 'b' },
  { file: 'byte-buddies.html', slug: 'byte-buddies', title: 'Byte Buddies', family: 'b' },
  { file: 'science-detectives.html', slug: 'science-detectives', title: 'Science Detectives', family: 'b' },
];

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

function checkPlay(app, out) {
  const x = out.expect;
  assert.deepEqual(out.errors, [], 'page errors');
  assert.ok(Array.isArray(out.entries), 'history is readable');
  assert.ok(out.entries.some((e) => e.id === 'seed-1'), '?reset=1 kept the existing history');
  const mine = out.entries.filter((e) => e.app === app.slug);

  const opens = mine.filter((e) => e.type === 'open');
  assert.equal(opens.length, 1, 'one open entry');
  assert.equal(opens[0].appTitle, app.title);

  const lessons = mine.filter((e) => e.type === 'lesson');
  assert.equal(lessons.length, 1, 'one lesson entry');
  assert.equal(lessons[0].cardsViewed, 3, 'cards viewed');
  assert.equal(lessons[0].cardsTotal, x.cardsTotal);
  assert.equal(lessons[0].lessonTitle, plain(x.lessonTitle));

  const quizzes = mine.filter((e) => e.type === 'quiz');
  assert.equal(quizzes.length, x.numberlineTotal ? 5 : 4, 'quiz entry count');
  const [perfect, wrong, partial, final] = quizzes;

  assert.equal(perfect.finished, true);
  assert.equal(perfect.total, x.perfectTotal);
  assert.equal(perfect.correct, x.perfectTotal);
  assert.equal(perfect.wrong.length, 0);
  assert.equal(perfect.stars, 3);
  assert.equal(perfect.points, x.perfectPoints, 'points match the app');
  assert.equal(perfect.points, 10 * x.perfectTotal + 5 * Math.max(0, x.perfectTotal - 2), 'points formula');
  assert.equal(perfect.bestStreak, x.perfectTotal);

  assert.equal(wrong.finished, true);
  assert.equal(wrong.answered, x.wrongTotal);
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.wrong.length, x.wrongTotal);
  assert.equal(wrong.stars, 0);
  assert.equal(wrong.points, 0);
  wrong.wrong.forEach((w) => {
    assert.ok(w.q && w.picked && w.answer, 'wrong answer has question, pick and answer');
    assert.notEqual(w.picked, w.answer, 'pick differs from answer');
    assert.doesNotMatch(w.q + w.picked + w.answer, /&(#\d+|[a-z]+);/i, 'stored as plain text');
  });

  assert.equal(partial.finished, false);
  assert.equal(partial.total, x.partialTotal);
  assert.equal(partial.answered, 2);
  assert.equal(partial.correct, 2);

  assert.equal(final.final, true);
  assert.equal(final.finished, true);
  assert.equal(final.correct, x.finalTotal);

  if (x.numberlineTotal) {
    const nl = quizzes[4];
    assert.equal(nl.wrong.length, x.numberlineTotal);
    nl.wrong.filter((w) => /^\d+ \+ \d+ = \?$/.test(w.q)).forEach((w) => {
      assert.equal(w.picked, String(Number(w.answer) + 1), 'number-line pick is the typed number');
    });
  }
}

function checkRefresh(play, refresh) {
  assert.deepEqual(refresh.errors, []);
  assert.equal(refresh.entries.length, play.entries.length, 'a refresh adds no entries');
}

function checkNoJs(out) {
  assert.deepEqual(out.errors, [], 'no errors without study-history.js');
  assert.equal(out.hasSH, false);
  assert.ok(out.total > 0 && out.score === out.total, 'quiz still plays to the end');
}

const work = makeWorkDir('study-history-e2e');
const withJs = path.join(work, 'with-js');
const noJs = path.join(work, 'no-js');
fs.mkdirSync(withJs);
fs.mkdirSync(noJs);
fs.copyFileSync(path.join(GRADE2, 'study-history.js'), path.join(withJs, 'study-history.js'));

const common = read('driver-common.page.js');
const failures = [];
for (const app of APPS) {
  const driver = common + '\n' + read('driver-family-' + app.family + '.page.js');
  const html = injectDriver(fs.readFileSync(path.join(GRADE2, app.file), 'utf8'), driver);
  const file = path.join(withJs, app.file);
  fs.writeFileSync(file, html);
  fs.writeFileSync(path.join(noJs, app.file), html);
  const profile = path.join(work, 'profile-' + app.slug);
  try {
    dumpDom(profile, file, '#e2e=seed');
    const play = readOutput(dumpDom(profile, file, '?reset=1#e2e=play'));
    checkPlay(app, play);
    checkRefresh(play, readOutput(dumpDom(profile, file, '#e2e=refresh')));
    checkNoJs(readOutput(dumpDom(path.join(work, 'profile-nojs-' + app.slug), path.join(noJs, app.file), '#e2e=nojs')));
    console.log('PASS ' + app.file);
  } catch (err) {
    failures.push(app.file);
    console.log('FAIL ' + app.file + ': ' + err.message);
  }
}
fs.rmSync(work, { recursive: true, force: true });
if (failures.length) {
  console.log(failures.length + ' of ' + APPS.length + ' apps failed');
  process.exit(1);
}
console.log('All ' + APPS.length + ' apps passed');
```

- [ ] **Step 6: Run it to verify it fails for the right reason**

Run: `node tests/e2e/apps-e2e.js`
Expected: all 7 apps `FAIL ... one open entry` (history is readable and the seed survives, but no app records anything yet). If any app instead fails with `no e2e output` or a page error, fix the driver before continuing.

- [ ] **Step 7: Suggest a commit message to the user (do not run git)**

```
test(grade2): add headless end-to-end harness for study history
```

---

### Task 5: Wire the five family-B apps

**Files (same edits in each):**
- Modify: `grade 2/word-train.html`
- Modify: `grade 2/batang-bayani.html`
- Modify: `grade 2/growing-good.html`
- Modify: `grade 2/byte-buddies.html`
- Modify: `grade 2/science-detectives.html`

The seven edits below are identical in all five files **except the constants line in edit 2**, which comes from this table:

| file | constants line |
|---|---|
| `word-train.html` | `  var SH = window.StudyHistory, SH_APP = 'word-train', SH_TITLE = 'Word Train', SH_TRUE = 'True', SH_FALSE = 'False';` |
| `batang-bayani.html` | `  var SH = window.StudyHistory, SH_APP = 'batang-bayani', SH_TITLE = 'Batang Bayani', SH_TRUE = 'Tama', SH_FALSE = 'Mali';` |
| `growing-good.html` | `  var SH = window.StudyHistory, SH_APP = 'growing-good', SH_TITLE = 'Growing Good', SH_TRUE = 'True', SH_FALSE = 'False';` |
| `byte-buddies.html` | `  var SH = window.StudyHistory, SH_APP = 'byte-buddies', SH_TITLE = 'Byte Buddies', SH_TRUE = 'True', SH_FALSE = 'False';` |
| `science-detectives.html` | `  var SH = window.StudyHistory, SH_APP = 'science-detectives', SH_TITLE = 'Science Detectives', SH_TRUE = 'True', SH_FALSE = 'False';` |

`SH_APP` must equal the file name without `.html`; the lobby's subject filter derives slugs from its card links. `SH_TRUE`/`SH_FALSE` match each app's True/False button labels (Batang Bayani's are `Tama`/`Mali`).

- [ ] **Step 0: Snapshot the apps before touching them** (Task 10 diffs against this)

Run (Git Bash, from the repo root):

```bash
mkdir -p /c/Users/ADMIN/AppData/Local/Temp/study-history-before && cp "grade 2/"*.html /c/Users/ADMIN/AppData/Local/Temp/study-history-before/
```

Expected: 8 `.html` files in that folder.

- [ ] **Step 1: Apply the edits to `word-train.html`**

**Edit 1: load the script.** Replace the app's only bare `<script>` line:

```html
<script>
(function(){
```

with:

```html
<script src="study-history.js"></script>
<script>
(function(){
```

**Edit 2: constants.** Immediately before the line `  var STORAGE_KEY = '...';`, insert the constants line from the table, followed by:

```js
  var historyLessonId = null, historyQuizId = null;
```

**Edit 3: app opened.** In the `?reset=1` block, replace:

```js
    progress = {};
    saveProgress(progress);
```

with:

```js
    progress = {};
    saveProgress(progress);
    SH && SH.appOpened(SH_APP, SH_TITLE);
```

**Edit 4: lesson opened and card viewed.** In the lesson button handler, replace:

```js
        flashIdx = 0;
        renderFlash();
```

with:

```js
        flashIdx = 0;
        historyLessonId = SH ? SH.lessonOpened(SH_APP, SH_TITLE, currentLesson, lessons[currentLesson].title, lessons[currentLesson].flashcards.length) : null;
        renderFlash();
```

In `renderFlash()`, replace:

```js
    var f = lesson.flashcards[flashIdx];
```

with:

```js
    var f = lesson.flashcards[flashIdx];
    SH && SH.cardViewed(historyLessonId, flashIdx + 1);
```

**Edit 5: quiz started.** In `startQuiz()`, replace:

```js
    currentQuizMeta = { id: currentLesson, title: lesson.title };
```

with:

```js
    currentQuizMeta = { id: currentLesson, title: lesson.title };
    historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, false, currentQuizSet.length) : null;
```

In `startFinalExam()`, directly after the line that begins `    currentQuizMeta = { id: 'final',` (its title differs per app; leave that line unchanged), insert:

```js
    historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, true, currentQuizSet.length) : null;
```

**Edit 6: each answer.** Replace the `showFeedback` opening:

```js
  function showFeedback(isCorrect){
    var item = currentQuizSet[qIdx];
```

with:

```js
  function showFeedback(isCorrect, picked, answer){
    var item = currentQuizSet[qIdx];
    SH && SH.quizAnswered(historyQuizId, isCorrect, item.q, picked, answer);
```

In `handleMC`, replace:

```js
    showFeedback(opt.correct);
```

with:

```js
    showFeedback(opt.correct, opt.text, item.options.filter(function(o){ return o.correct; })[0].text);
```

In `handleTF`, replace:

```js
    showFeedback(isRight);
```

with:

```js
    showFeedback(isRight, choice ? SH_TRUE : SH_FALSE, correct ? SH_TRUE : SH_FALSE);
```

**Edit 7: quiz finished.** In `finishQuiz()`, replace:

```js
    var starCount = starsFor(score / total);
```

with:

```js
    var starCount = starsFor(score / total);
    SH && SH.quizFinished(historyQuizId, starCount, sessionPoints, bestStreak);
```

- [ ] **Step 2: Apply the same seven edits to `batang-bayani.html`**, using its constants line from the table.
- [ ] **Step 3: Apply the same seven edits to `growing-good.html`**, using its constants line from the table.
- [ ] **Step 4: Apply the same seven edits to `byte-buddies.html`**, using its constants line from the table.
- [ ] **Step 5: Apply the same seven edits to `science-detectives.html`**, using its constants line from the table.

- [ ] **Step 6: Confirm every edit landed exactly once per file**

Run (Git Bash, from `grade 2/`):

```bash
for f in word-train batang-bayani growing-good byte-buddies science-detectives; do printf "%-20s " $f; for p in 'src="study-history.js"' 'SH.appOpened' 'SH.lessonOpened' 'SH.cardViewed' 'SH.quizStarted' 'SH.quizAnswered' 'SH.quizFinished' 'showFeedback(isRight, choice'; do printf "%s " $(grep -c "$p" $f.html); done; echo; done
```

Expected: every row reads `1 1 1 1 2 1 1 1`.

- [ ] **Step 7: Run the e2e harness**

Run: `node tests/e2e/apps-e2e.js`
Expected: `PASS` for all five family-B files. `block-bot.html` and `kuwentista.html` still `FAIL ... one open entry`.

- [ ] **Step 8: Suggest a commit message to the user (do not run git)**

```
feat(grade2): record study history in Word Train, Batang Bayani, Growing Good, Byte Buddies and Science Detectives
```

---

### Task 6: Wire Kuwentista

**Files:**
- Modify: `grade 2/kuwentista.html`

- [ ] **Step 1: Load the script.** Replace the first line of the app's only bare `<script>` block:

```html
<script>
const STORY_PASSAGE =
```

with:

```html
<script src="study-history.js"></script>
<script>
const STORY_PASSAGE =
```

(Only the `<script>` line and the tag above it change; the rest of that `const STORY_PASSAGE = ...` line stays as it is.)

- [ ] **Step 2: Constants.** Immediately before `const STORAGE_KEY = 'kuwentista_progress_v2';`, insert:

```js
const SH = window.StudyHistory, SH_APP = 'kuwentista', SH_TITLE = 'Kuwentista';
let historyLessonId = null, historyQuizId = null;
```

- [ ] **Step 3: App opened.** Replace:

```js
  progress = {};
  saveProgress(progress);
```

with:

```js
  progress = {};
  saveProgress(progress);
  SH && SH.appOpened(SH_APP, SH_TITLE);
```

- [ ] **Step 4: Lesson opened and card viewed.** Replace:

```js
  currentLessonIdx = i;
  cardIdx = 0;
```

with:

```js
  currentLessonIdx = i;
  cardIdx = 0;
  historyLessonId = SH ? SH.lessonOpened(SH_APP, SH_TITLE, LESSONS[i].id, LESSONS[i].title, LESSONS[i].flashcards.length) : null;
```

In `renderCard()`, replace:

```js
  const fc = lesson.flashcards[cardIdx];
```

with:

```js
  const fc = lesson.flashcards[cardIdx];
  SH && SH.cardViewed(historyLessonId, cardIdx + 1);
```

- [ ] **Step 5: Quiz started.** Replace:

```js
  currentQuizMeta = {id:lesson.id, title:lesson.title};
```

with:

```js
  currentQuizMeta = {id:lesson.id, title:lesson.title};
  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, false, currentQuizSet.length) : null;
```

Replace:

```js
  currentQuizMeta = {id:'final', title:'Pangwakas na Pagsusulit'};
```

with:

```js
  currentQuizMeta = {id:'final', title:'Pangwakas na Pagsusulit'};
  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, true, currentQuizSet.length) : null;
```

- [ ] **Step 6: Each answer.** In `selectOption`, replace:

```js
  const correct = idx === q.correct;
```

with:

```js
  const correct = idx === q.correct;
  SH && SH.quizAnswered(historyQuizId, correct, q.q, q.options[idx], q.options[q.correct]);
```

- [ ] **Step 7: Quiz finished.** In `finishQuiz()`, replace:

```js
  progress[currentQuizMeta.id] = best;
  saveProgress(progress);
```

with:

```js
  progress[currentQuizMeta.id] = best;
  saveProgress(progress);
  SH && SH.quizFinished(historyQuizId, starsFor(quizScore / currentQuizSet.length), sessionPoints, bestStreak);
```

- [ ] **Step 8: Run the e2e harness**

Run: `node tests/e2e/apps-e2e.js`
Expected: `PASS kuwentista.html` and the five family-B apps; only `block-bot.html` fails.

- [ ] **Step 9: Suggest a commit message to the user (do not run git)**

```
feat(grade2): record study history in Kuwentista
```

---

### Task 7: Wire Block Bot (including number-line and picture questions)

**Files:**
- Modify: `grade 2/block-bot.html`

- [ ] **Step 1: Load the script.** Replace the app's only bare `<script>` line, the one directly followed by the `/* ---- Philippine money art` comment:

```html
<script>
/* ---- Philippine money art
```

with:

```html
<script src="study-history.js"></script>
<script>
/* ---- Philippine money art
```

- [ ] **Step 2: Constants.** Immediately before `const STORAGE_KEY = 'blockbot_progress_v2';`, insert:

```js
const SH = window.StudyHistory, SH_APP = 'block-bot', SH_TITLE = 'Block Bot';
let historyLessonId = null, historyQuizId = null;
```

- [ ] **Step 3: App opened.** Replace:

```js
  progress = {};
  saveProgress(progress);
```

with:

```js
  progress = {};
  saveProgress(progress);
  SH && SH.appOpened(SH_APP, SH_TITLE);
```

- [ ] **Step 4: Picture-question label helper.** Picture questions share stems such as "How much money is this?", so the history appends the drawn items' `aria-label`s. Immediately after the closing `}` of `function buildQuizSet(lesson){ ... }`, insert:

```js
function historyQuestion(q){
  const names = [...String(q.art || '').matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]);
  return names.length ? `${q.q} [${names.join(', ')}]` : q.q;
}
```

- [ ] **Step 5: Lesson opened and card viewed.** Replace:

```js
  currentLessonIdx = i;
  cardIdx = 0;
```

with:

```js
  currentLessonIdx = i;
  cardIdx = 0;
  historyLessonId = SH ? SH.lessonOpened(SH_APP, SH_TITLE, LESSONS[i].id, LESSONS[i].title, LESSONS[i].flashcards.length) : null;
```

In `renderCard()`, replace:

```js
  const fc = lesson.flashcards[cardIdx];
```

with:

```js
  const fc = lesson.flashcards[cardIdx];
  SH && SH.cardViewed(historyLessonId, cardIdx + 1);
```

- [ ] **Step 6: Quiz started.** Replace:

```js
  currentQuizMeta = {id: lesson.id, title: lesson.title};
```

with:

```js
  currentQuizMeta = {id: lesson.id, title: lesson.title};
  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, false, currentQuizSet.length) : null;
```

Replace:

```js
  currentQuizMeta = {id:'final', title:'Final Mock Exam'};
```

with:

```js
  currentQuizMeta = {id:'final', title:'Final Mock Exam'};
  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, true, currentQuizSet.length) : null;
```

- [ ] **Step 7: Each answer, multiple choice.** In `selectOption`, replace:

```js
  const correct = idx === q.correct;
```

with:

```js
  const correct = idx === q.correct;
  SH && SH.quizAnswered(historyQuizId, correct, historyQuestion(q), q.options[idx], q.options[q.correct]);
```

- [ ] **Step 8: Each answer, number line.** In `checkNumberline`, replace:

```js
  const correct = val === correctAns;
```

with:

```js
  const correct = val === correctAns;
  SH && SH.quizAnswered(historyQuizId, correct, `${q.start} + ${q.jumps} = ?`, isNaN(val) ? '(blank)' : String(val), String(correctAns));
```

- [ ] **Step 9: Quiz finished.** In `finishQuiz()`, replace:

```js
  progress[currentQuizMeta.id] = best;
  saveProgress(progress);
```

with:

```js
  progress[currentQuizMeta.id] = best;
  saveProgress(progress);
  SH && SH.quizFinished(historyQuizId, starsFor(quizScore / currentQuizSet.length), sessionPoints, bestStreak);
```

- [ ] **Step 10: Run the e2e harness**

Run: `node tests/e2e/apps-e2e.js`
Expected: `PASS` for all 7 apps, then `All 7 apps passed`.

- [ ] **Step 11: Suggest a commit message to the user (do not run git)**

```
feat(grade2): record study history in Block Bot, including number-line answers
```

---

### Task 8: Lobby end-to-end test (fails until the panel exists)

**Files:**
- Create: `tests/e2e/lobby-driver.page.js`
- Create: `tests/e2e/lobby-e2e.js`

- [ ] **Step 1: Create `tests/e2e/lobby-driver.page.js`**

```js
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'grade2_history_v1';

  function out(obj) {
    obj.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(obj);
    document.body.appendChild(pre);
  }
  function at(daysAgo, h, m) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  function press(digits) {
    digits.split('').forEach(function (ch) {
      Array.prototype.filter.call($('pin-pad').querySelectorAll('button'), function (b) {
        return b.textContent === ch;
      })[0].click();
    });
  }
  function rows() { return document.querySelectorAll('#hist-list .h-item').length; }
  function change(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('change')); }

  var mode = (location.hash.match(/e2e=(\w+)/) || [])[1];
  var r = {};

  if (mode === 'nojs') {
    $('parent-open').click();
    press('0108');
    r.missingShown = !$('history-missing').hidden;
    r.bodyHidden = $('history-body').hidden;
    return out(r);
  }

  localStorage.setItem(KEY, JSON.stringify({ v: 1, entries: [
    { id: 'a', type: 'open', app: 'word-train', appTitle: 'Word Train', t: at(0, 9, 0) },
    { id: 'b', type: 'quiz', app: 'word-train', appTitle: 'Word Train', lessonId: '0', lessonTitle: 'Nouns', final: false,
      total: 10, answered: 10, correct: 8, finished: true, stars: 2, points: 95, bestStreak: 5,
      wrong: [{ q: 'Pick the noun', picked: 'run', answer: 'cat' }, { q: 'Pick the verb', picked: 'cat', answer: 'run' }],
      t: at(0, 9, 5), updatedAt: at(0, 9, 9) },
    { id: 'c', type: 'lesson', app: 'kuwentista', appTitle: 'Kuwentista', lessonId: 'x', lessonTitle: 'Pangngalan',
      cardsTotal: 8, cardsViewed: 6, t: at(3, 16, 0), updatedAt: at(3, 16, 4) },
    { id: 'd', type: 'quiz', app: 'kuwentista', appTitle: 'Kuwentista', lessonId: 'final', lessonTitle: 'Pangwakas', final: true,
      total: 21, answered: 4, correct: 3, finished: false, stars: 0, points: 0, bestStreak: 0,
      wrong: [{ q: 'Q', picked: 'A', answer: 'B' }], t: at(40, 10, 0), updatedAt: at(40, 10, 3) }
  ] }));

  $('parent-open').click();
  r.overlayOpen = !$('parent-overlay').hidden;
  press('1234');
  r.wrongPinLocked = $('history-view').hidden;
  press('0108');
  r.unlocked = !$('history-view').hidden && $('pin-view').hidden;
  r.missingHidden = $('history-missing').hidden;

  r.rows7 = rows();
  r.summary7 = $('hist-summary').textContent;
  r.detailsCount = document.querySelectorAll('#hist-list details').length;
  r.detailsText = document.querySelector('#hist-list details').textContent;

  document.querySelector('#range-buttons [data-range="all"]').click();
  r.rowsAll = rows();
  r.allText = $('hist-list').textContent;
  change('subject-filter', 'kuwentista');
  r.rowsKuwentista = rows();
  change('subject-filter', '');
  r.subjectOptions = $('subject-filter').options.length;

  window.confirm = function () { return true; };
  var day3 = window.StudyHistory.dateKey(at(3, 12, 0));
  $('del-from').value = day3;
  $('del-to').value = day3;
  $('delete-range').click();
  r.afterRange = JSON.parse(localStorage.getItem(KEY)).entries.map(function (e) { return e.id; }).join(',');
  r.deleteMsg = $('delete-msg').textContent;
  $('delete-all').click();
  r.afterAll = localStorage.getItem(KEY);

  $('parent-close').click();
  r.closed = $('parent-overlay').hidden;
  $('parent-open').click();
  r.relocked = !$('pin-view').hidden && $('history-view').hidden;
  out(r);
})();
```

- [ ] **Step 2: Create `tests/e2e/lobby-e2e.js`**

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GRADE2, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');

const work = makeWorkDir('study-history-lobby');
const withJs = path.join(work, 'with-js');
const noJs = path.join(work, 'no-js');
fs.mkdirSync(withJs);
fs.mkdirSync(noJs);
fs.copyFileSync(path.join(GRADE2, 'study-history.js'), path.join(withJs, 'study-history.js'));
const html = appendDriver(fs.readFileSync(path.join(GRADE2, 'lobby.html'), 'utf8'), fs.readFileSync(path.join(__dirname, 'lobby-driver.page.js'), 'utf8'));
fs.writeFileSync(path.join(withJs, 'lobby.html'), html);
fs.writeFileSync(path.join(noJs, 'lobby.html'), html);

try {
  const r = readOutput(dumpDom(path.join(work, 'profile'), path.join(withJs, 'lobby.html'), '#e2e=lobby'));
  assert.deepEqual(r.errors, [], 'page errors');
  assert.equal(r.overlayOpen, true, 'Parent link opens the panel');
  assert.equal(r.wrongPinLocked, true, 'wrong PIN stays locked');
  assert.equal(r.unlocked, true, '0108 unlocks');
  assert.equal(r.missingHidden, true);
  assert.equal(r.rows7, 3, 'last 7 days shows 3 rows');
  assert.match(r.summary7, /Study time: 8 min/);
  assert.match(r.summary7, /Quizzes: 1/);
  assert.match(r.summary7, /Average: 80%/);
  assert.match(r.summary7, /Most missed: Word Train · “Pick the noun”/);
  assert.equal(r.detailsCount, 1);
  assert.match(r.detailsText, /2 wrong answers/);
  assert.match(r.detailsText, /❌ run/);
  assert.match(r.detailsText, /✅ cat/);
  assert.equal(r.rowsAll, 4, 'All shows every row');
  assert.match(r.allText, /Kuwentista · Final Mock Exam — stopped at 4 of 21, 3 correct/);
  assert.match(r.allText, /Kuwentista · Pangngalan — viewed 6 of 8 cards/);
  assert.match(r.allText, /Word Train · Nouns quiz — 8\/10 ⭐⭐ \+95 pts · 4 min/);
  assert.equal(r.rowsKuwentista, 2, 'subject filter');
  assert.equal(r.subjectOptions, 8, 'All subjects + 7 apps');
  assert.equal(r.afterRange, 'a,b,d', 'range delete removes only that day');
  assert.match(r.deleteMsg, /Deleted 1 entry\./);
  assert.equal(r.afterAll, null, 'delete everything');
  assert.equal(r.closed, true);
  assert.equal(r.relocked, true, 'reopening asks for the PIN again');

  const n = readOutput(dumpDom(path.join(work, 'profile-nojs'), path.join(noJs, 'lobby.html'), '#e2e=nojs'));
  assert.deepEqual(n.errors, [], 'no errors without study-history.js');
  assert.equal(n.missingShown, true, 'missing-file message shown');
  assert.equal(n.bodyHidden, true, 'history controls hidden');
  console.log('Lobby passed');
} catch (err) {
  console.log('FAIL lobby: ' + err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node tests/e2e/lobby-e2e.js`
Expected: `FAIL lobby: ... Cannot read properties of null (reading 'click')` or similar, because `#parent-open` does not exist yet.

- [ ] **Step 4: Suggest a commit message to the user (do not run git)**

```
test(grade2): add lobby history panel end-to-end test
```

---

### Task 9: Lobby: Parent link, PIN pad and History panel

**Files:**
- Modify: `grade 2/lobby.html`

- [ ] **Step 1: Declare the charset** (the lobby already contains emoji, and the panel adds more). Replace line 1–2:

```html
<html lang="fil">
<title>Study Games Lobby</title>
```

with:

```html
<html lang="fil">
<meta charset="utf-8">
<title>Study Games Lobby</title>
```

- [ ] **Step 2: Add colour tokens for right/wrong answers.** In each of the three token blocks, add a line after `--gold-soft:...;`:
  - In `:root{ ... }` add: `    --good:#1E7A46; --bad:#B03A2E;`
  - In `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ ... } }` add: `      --good:#7DCEA0; --bad:#F1948A;`
  - In `:root[data-theme="dark"]{ ... }` add: `    --good:#7DCEA0; --bad:#F1948A;`

- [ ] **Step 3: Add the panel styles.** Immediately before the `  @media (prefers-reduced-motion: reduce){` block, insert:

```css
  .parent-link{
    display:block; margin:14px auto 0; padding:6px 10px;
    background:none; border:0; cursor:pointer;
    font:inherit; font-size:0.78rem; font-weight:700; color:var(--ink-soft); opacity:0.6;
  }
  .parent-overlay{
    position:fixed; inset:0; z-index:50; overflow-y:auto;
    background:var(--bg); padding:clamp(16px,4vw,32px) 16px 48px;
  }
  .parent-overlay[hidden], .parent-overlay [hidden]{ display:none; }
  .parent-box{ max-width:760px; margin:0 auto; }
  .parent-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
  .parent-head h2{ margin:0; font-family:'Baloo 2', system-ui, sans-serif; font-size:1.5rem; color:var(--header-accent); }
  .p-btn{
    font:inherit; font-size:0.9rem; font-weight:800; cursor:pointer;
    padding:9px 14px; border-radius:12px; border:1px solid var(--border);
    background:var(--card); color:var(--ink);
  }
  .p-btn.on{ background:var(--ink); color:var(--bg); }
  .p-btn.danger{ background:var(--bad); border-color:var(--bad); color:var(--card); }
  .pin-hint{ text-align:center; font-weight:700; color:var(--ink-soft); }
  .pin-dots{ display:flex; justify-content:center; gap:14px; margin:24px 0; }
  .pin-dots span{ width:18px; height:18px; border-radius:50%; border:2px solid var(--ink-soft); }
  .pin-dots span.fill{ background:var(--ink); border-color:var(--ink); }
  .pin-dots.shake{ animation:pin-shake 0.35s; }
  @keyframes pin-shake{ 25%{ transform:translateX(-8px); } 75%{ transform:translateX(8px); } }
  .pin-pad{ display:grid; grid-template-columns:repeat(3, 72px); gap:12px; justify-content:center; }
  .pin-pad button{
    height:64px; cursor:pointer; font:inherit; font-size:1.5rem; font-weight:800;
    border-radius:16px; border:1px solid var(--border); background:var(--card); color:var(--ink);
  }
  .p-section{ background:var(--card); border:1px solid var(--border); border-radius:18px; padding:14px 16px; margin-bottom:14px; }
  .p-section h3{ margin:0 0 10px; font-size:1rem; }
  .p-row{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .p-row + .p-row{ margin-top:10px; }
  .p-row label{ font-weight:700; }
  .p-row input, .p-row select{
    font:inherit; padding:8px; border-radius:10px;
    border:1px solid var(--border); background:var(--bg); color:var(--ink);
  }
  .p-note{ margin:8px 0 0; font-size:0.85rem; font-weight:700; color:var(--ink-soft); }
  .p-warn{ margin-bottom:14px; padding:10px 14px; border-radius:12px; font-weight:800; background:var(--gold-soft); color:var(--gold-deep); }
  .h-summary{ display:flex; flex-wrap:wrap; gap:8px 18px; font-weight:800; }
  .h-summary .missed{ flex-basis:100%; font-weight:700; color:var(--ink-soft); }
  .h-day{ margin:16px 0 6px; font-family:'Baloo 2', system-ui, sans-serif; font-weight:700; font-size:1.05rem; }
  .h-day:first-child{ margin-top:0; }
  .h-item{ display:flex; gap:10px; padding:8px 0; border-top:1px solid var(--border); }
  .h-time{ flex:none; width:72px; padding-top:2px; font-size:0.85rem; font-weight:800; color:var(--ink-soft); }
  .h-body{ flex:1; min-width:0; overflow-wrap:anywhere; }
  .h-body details{ margin-top:6px; }
  .h-body summary{ cursor:pointer; font-weight:800; color:var(--header-accent); }
  .h-wrong{ margin:8px 0 0; padding:0; list-style:none; }
  .h-wrong li{ margin-bottom:8px; font-size:0.9rem; }
  .h-wrong .pick{ color:var(--bad); }
  .h-wrong .ans{ color:var(--good); }
```

- [ ] **Step 4: Add the Parent link and the panel markup.** Replace:

```html
  <p class="footer-note">Tap a subject to review the lessons and take the quiz! 🌟</p>
</div>
```

with:

```html
  <p class="footer-note">Tap a subject to review the lessons and take the quiz! 🌟</p>
  <button class="parent-link" id="parent-open" type="button">🔒 Parent</button>
</div>

<div class="parent-overlay" id="parent-overlay" hidden>
  <div class="parent-box">
    <div class="parent-head">
      <h2>Study History</h2>
      <button class="p-btn" id="parent-close" type="button">✕ Close</button>
    </div>

    <div id="pin-view">
      <p class="pin-hint">Enter the parent PIN</p>
      <div class="pin-dots" id="pin-dots"><span></span><span></span><span></span><span></span></div>
      <div class="pin-pad" id="pin-pad">
        <button type="button">1</button><button type="button">2</button><button type="button">3</button>
        <button type="button">4</button><button type="button">5</button><button type="button">6</button>
        <button type="button">7</button><button type="button">8</button><button type="button">9</button>
        <button type="button" data-key="clear" aria-label="Delete digit">⌫</button><button type="button">0</button><span></span>
      </div>
    </div>

    <div id="history-view" hidden>
      <div class="p-warn" id="history-missing" hidden>History file missing — copy study-history.js into the grade 2 folder.</div>
      <div id="history-body">
        <div class="p-warn" id="history-full" hidden>History storage is full — export a backup, then delete old entries.</div>

        <div class="p-section">
          <div class="p-row" id="range-buttons">
            <button class="p-btn" type="button" data-range="today">Today</button>
            <button class="p-btn on" type="button" data-range="7">Last 7 days</button>
            <button class="p-btn" type="button" data-range="30">Last 30 days</button>
            <button class="p-btn" type="button" data-range="all">All</button>
            <button class="p-btn" type="button" data-range="custom">Custom</button>
          </div>
          <div class="p-row" id="custom-range" hidden>
            <label>From <input type="date" id="range-from"></label>
            <label>To <input type="date" id="range-to"></label>
          </div>
          <div class="p-row">
            <label>Subject <select id="subject-filter"><option value="">All subjects</option></select></label>
          </div>
        </div>

        <div class="p-section"><div class="h-summary" id="hist-summary"></div></div>
        <div class="p-section" id="hist-list"></div>

        <div class="p-section">
          <h3>Backup</h3>
          <div class="p-row">
            <button class="p-btn" type="button" id="export-json">Export backup (.json)</button>
            <button class="p-btn" type="button" id="export-csv">Export spreadsheet (.csv)</button>
            <button class="p-btn" type="button" id="import-btn">Import backup</button>
            <input type="file" id="import-file" accept=".json,application/json" hidden>
          </div>
          <p class="p-note" id="backup-msg"></p>
        </div>

        <div class="p-section">
          <h3>Delete history</h3>
          <div class="p-row">
            <label>From <input type="date" id="del-from"></label>
            <label>To <input type="date" id="del-to"></label>
            <button class="p-btn" type="button" id="delete-range">Delete this range</button>
          </div>
          <div class="p-row">
            <button class="p-btn danger" type="button" id="delete-all">Delete everything</button>
          </div>
          <p class="p-note" id="delete-msg"></p>
        </div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Load the history script.** Replace the lobby's only `<script>` line (the one directly followed by `(function(){` and `  function getPoints(key){`):

```html
<script>
(function(){
  function getPoints(key){
```

with:

```html
<script src="study-history.js"></script>
<script>
(function(){
  function getPoints(key){
```

- [ ] **Step 6: Add the panel script.** At the very end of the file, after the existing closing `</script>`, append:

```html
<script>
(function(){
  var PIN = '0108';
  var SH = window.StudyHistory;
  var $ = function(id){ return document.getElementById(id); };
  var overlay = $('parent-overlay'), pinView = $('pin-view'), historyView = $('history-view'), dots = $('pin-dots');
  var entered = '';
  var range = '7';

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function plural(n, word){ return n + ' ' + word + (n === 1 ? '' : 's'); }
  function entriesWord(n){ return n + (n === 1 ? ' entry' : ' entries'); }

  function drawDots(){
    Array.prototype.forEach.call(dots.children, function(d, i){ d.classList.toggle('fill', i < entered.length); });
  }
  function lock(){
    entered = '';
    drawDots();
    pinView.hidden = false;
    historyView.hidden = true;
  }
  function openParent(){ lock(); overlay.hidden = false; }
  function closeParent(){ lock(); overlay.hidden = true; }
  function unlock(){
    pinView.hidden = true;
    historyView.hidden = false;
    $('history-missing').hidden = !!SH;
    $('history-body').hidden = !SH;
    if (SH) renderHistory();
  }
  function pressKey(key){
    if (key === 'clear'){ entered = entered.slice(0, -1); drawDots(); return; }
    if (entered.length >= 4) return;
    entered += key;
    drawDots();
    if (entered.length < 4) return;
    if (entered === PIN){ entered = ''; unlock(); return; }
    entered = '';
    dots.classList.add('shake');
    setTimeout(function(){ dots.classList.remove('shake'); drawDots(); }, 400);
  }

  function today(){ return SH.dateKey(Date.now()); }
  function daysAgo(n){ var d = new Date(); d.setDate(d.getDate() - n); return SH.dateKey(d.getTime()); }
  function currentRange(){
    if (range === 'all') return [null, null];
    if (range === 'custom') return [$('range-from').value || null, $('range-to').value || null];
    if (range === 'today') return [today(), today()];
    return [daysAgo(parseInt(range, 10) - 1), today()];
  }

  function formatDuration(ms){
    var mins = Math.round(ms / 60000);
    if (mins < 1) return 'under 1 min';
    if (mins < 60) return mins + ' min';
    return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
  }

  function describe(e){
    if (e.type === 'open') return '📂 Opened ' + e.appTitle;
    if (e.type === 'lesson') return '📖 ' + e.appTitle + ' · ' + e.lessonTitle + ' — viewed ' + e.cardsViewed + ' of ' + e.cardsTotal + ' cards';
    var name = e.appTitle + ' · ' + (e.final ? 'Final Mock Exam' : e.lessonTitle + ' quiz');
    if (!e.finished) return '✏️ ' + name + ' — stopped at ' + e.answered + ' of ' + e.total + ', ' + e.correct + ' correct';
    var stars = e.stars > 0 ? ' ' + '⭐'.repeat(e.stars) : '';
    return '✏️ ' + name + ' — ' + e.correct + '/' + e.total + stars + ' +' + e.points + ' pts · ' + formatDuration(e.updatedAt - e.t);
  }

  function wrongDetails(e){
    var d = el('details');
    d.appendChild(el('summary', '', plural(e.wrong.length, 'wrong answer')));
    var ul = el('ul', 'h-wrong');
    e.wrong.forEach(function(w){
      var li = el('li');
      li.appendChild(el('div', '', w.q));
      li.appendChild(el('div', 'pick', '❌ ' + w.picked));
      li.appendChild(el('div', 'ans', '✅ ' + w.answer));
      ul.appendChild(li);
    });
    d.appendChild(ul);
    return d;
  }

  function renderSummary(s){
    var box = $('hist-summary');
    box.textContent = '';
    box.appendChild(el('span', '', '⏱️ Study time: ' + formatDuration(s.studyMs)));
    box.appendChild(el('span', '', '✏️ Quizzes: ' + s.quizzes));
    box.appendChild(el('span', '', '🎯 Average: ' + (s.averagePct === null ? '—' : s.averagePct + '%')));
    if (s.mostMissed) {
      box.appendChild(el('span', 'missed', 'Most missed: ' + s.mostMissed.appTitle + ' · “' + s.mostMissed.q + '” (' + s.mostMissed.count + '×)'));
    }
  }

  function renderList(entries){
    var box = $('hist-list');
    box.textContent = '';
    if (!entries.length){ box.appendChild(el('p', 'p-note', 'No activity in this range yet.')); return; }
    var lastDay = '';
    entries.forEach(function(e){
      var when = new Date(e.t);
      var day = when.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric', year:'numeric' });
      if (day !== lastDay){ box.appendChild(el('div', 'h-day', day)); lastDay = day; }
      var row = el('div', 'h-item');
      row.appendChild(el('div', 'h-time', when.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' })));
      var body = el('div', 'h-body', describe(e));
      if (e.type === 'quiz' && e.wrong && e.wrong.length) body.appendChild(wrongDetails(e));
      row.appendChild(body);
      box.appendChild(row);
    });
  }

  function renderHistory(){
    $('history-full').hidden = !SH.storageError();
    var r = currentRange();
    var entries = SH.list(r[0], r[1], $('subject-filter').value || null);
    renderSummary(SH.summary(entries));
    renderList(entries);
  }

  function download(name, text, type){
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }

  document.querySelectorAll('.subject-card').forEach(function(card){
    var opt = el('option', '', card.querySelector('.subject-app').textContent);
    opt.value = card.getAttribute('href').split('.html')[0];
    $('subject-filter').appendChild(opt);
  });

  $('parent-open').addEventListener('click', openParent);
  $('parent-close').addEventListener('click', closeParent);
  window.addEventListener('pagehide', closeParent);
  $('pin-pad').addEventListener('click', function(ev){
    var b = ev.target.closest('button');
    if (b) pressKey(b.getAttribute('data-key') || b.textContent);
  });
  document.addEventListener('keydown', function(ev){
    if (overlay.hidden) return;
    if (ev.key === 'Escape') closeParent();
    else if (!pinView.hidden && /^[0-9]$/.test(ev.key)) pressKey(ev.key);
    else if (!pinView.hidden && ev.key === 'Backspace') pressKey('clear');
  });

  $('range-buttons').addEventListener('click', function(ev){
    var b = ev.target.closest('button[data-range]');
    if (!b) return;
    range = b.getAttribute('data-range');
    Array.prototype.forEach.call(this.children, function(c){ c.classList.toggle('on', c === b); });
    $('custom-range').hidden = range !== 'custom';
    renderHistory();
  });
  ['range-from', 'range-to', 'subject-filter'].forEach(function(id){
    $(id).addEventListener('change', renderHistory);
  });

  $('export-json').addEventListener('click', function(){
    download('study-history-' + today() + '.json', SH.exportJson(), 'application/json');
  });
  $('export-csv').addEventListener('click', function(){
    download('study-history-' + today() + '.csv', SH.exportCsv(), 'text/csv;charset=utf-8');
  });
  $('import-btn').addEventListener('click', function(){ $('import-file').click(); });
  $('import-file').addEventListener('change', function(){
    var input = this, file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try {
        var r = SH.importJson(String(reader.result));
        $('backup-msg').textContent = 'Added ' + entriesWord(r.added) + ', skipped ' + plural(r.skipped, 'duplicate') + '.';
        renderHistory();
      } catch (err) {
        $('backup-msg').textContent = err.message;
      }
      input.value = '';
    };
    reader.readAsText(file);
  });

  $('delete-range').addEventListener('click', function(){
    var from = $('del-from').value, to = $('del-to').value;
    if (!from || !to || from > to){
      $('delete-msg').textContent = 'Pick a From date and a To date (From must be on or before To).';
      return;
    }
    var n = SH.list(from, to).length;
    if (!n){ $('delete-msg').textContent = 'Nothing to delete in that range.'; return; }
    if (!confirm('Delete ' + entriesWord(n) + ' from ' + from + ' to ' + to + '? This cannot be undone. Export a backup first if you might want them.')) return;
    $('delete-msg').textContent = 'Deleted ' + entriesWord(SH.deleteRange(from, to)) + '.';
    renderHistory();
  });
  $('delete-all').addEventListener('click', function(){
    var n = SH.list(null, null).length;
    if (!n){ $('delete-msg').textContent = 'History is already empty.'; return; }
    if (!confirm('Delete ALL ' + entriesWord(n) + ' on this device? This cannot be undone.')) return;
    $('delete-msg').textContent = 'Deleted ' + entriesWord(SH.deleteAll()) + '.';
    renderHistory();
  });
})();
</script>
```

- [ ] **Step 7: Run the lobby e2e test**

Run: `node tests/e2e/lobby-e2e.js`
Expected: `Lobby passed`.

- [ ] **Step 8: Re-run everything**

Run: `node --test tests/` then `node tests/e2e/apps-e2e.js` then `node tests/e2e/lobby-e2e.js`
Expected: `# fail 0`, `All 7 apps passed`, `Lobby passed`.

- [ ] **Step 9: Visual check at phone and desktop width**

Seed some history (play one quiz in any app), open the lobby and unlock with 0108, then capture screenshots:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --window-size=1200,1400 --screenshot="C:\Users\ADMIN\AppData\Local\Temp\lobby-desktop.png" "file:///C:/Users/ADMIN/IdeaProjects/school/grade%202/lobby.html"
```

A headless run starts with an empty profile, so for the panel itself, open `grade 2/lobby.html` in a real Chrome instead. Play one quiz, tap 🔒 Parent, enter 0108, and check at full width and with DevTools device mode at 390px:
- no horizontal scroll;
- the PIN pad is centred;
- filter buttons wrap;
- the wrong-answer list expands on tap;
- dark mode (DevTools → Rendering → prefers-color-scheme: dark) is readable.

Remember the known headless quirk: `--window-size` narrower than 500px is clamped, so don't chase "phone" screenshots from headless.

- [ ] **Step 10: Suggest a commit message to the user (do not run git)**

```
feat(grade2): add PIN-protected study history panel to the lobby
```

---

### Task 10: Regression check, spec sync, and device rollout notes

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-grade2-study-history-design.md` (only if anything drifted during implementation)
- Modify: `C:\Users\ADMIN\.claude\projects\C--Users-ADMIN-IdeaProjects-school\memory\study-games-repo.md`

- [ ] **Step 1: Prove no lesson content changed.** Diff each app against the snapshot taken in Task 5 Step 0:

```bash
for f in block-bot kuwentista word-train batang-bayani growing-good byte-buddies science-detectives; do echo "== $f"; diff "/c/Users/ADMIN/AppData/Local/Temp/study-history-before/$f.html" "grade 2/$f.html" | grep '^[<>]' ; done
```

Expected: `>` lines are only the hook additions from Tasks 5–7. The only `<` lines are the three family-B call sites whose arguments changed (`function showFeedback(isCorrect){`, `showFeedback(opt.correct);`, `showFeedback(isRight);`) plus nothing else.

- [ ] **Step 2: Sync the spec** if the build deviated from it. Known deliberate refinements already reflected in the spec: "Last 7 days"/"Last 30 days" filters, two separate export buttons, the CSV `Answered` column with `8 of 10` scores, and timestamped corrupt-copy keys.

- [ ] **Step 3: Update project memory.** Add a short section to `study-games-repo.md`:
  - Grade 2 now has `grade 2/study-history.js`, which must be copied to devices with the HTML.
  - Key `grade2_history_v1` is never touched by `?reset=1`.
  - The lobby PIN is 0108.
  - Tests live in `tests/` (unit: `node --test tests/`; e2e: `node tests/e2e/apps-e2e.js`, `node tests/e2e/lobby-e2e.js`).
  - Grade 5 is next with the same design.
  - Any new Grade 2 app needs the five hooks plus the `<script src>` tag.

- [ ] **Step 4: Device rollout checklist for the user.** Copy **all of these** into the `grade 2` folder on each device, then check on the device:
  - Files: `study-history.js`, `lobby.html`, and the 7 app `.html` files.
  - Open the lobby, open a subject, study a lesson, and finish a quiz.
  - Back in the lobby, tap 🔒 Parent and enter 0108. The visit, lesson and quiz show with today's date and time.
  - Tap Export backup and confirm the file lands in Downloads.

- [ ] **Step 5: Suggest a commit message to the user (do not run git)**

```
docs(grade2): sync study history spec and note rollout steps
```
