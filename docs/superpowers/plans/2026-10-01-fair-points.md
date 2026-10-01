# Fair Points (anti-memorization) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop replays of memorized questions from earning coins. Questions rest for 3 days after an unhelped right answer, an optional typed answer earns +5, the mock exam pays 20 per right answer, and a parent can turn a real school test score into coins.

**Architecture:**
- A new shared module, `recall.js`, with a byte-identical `grade 2/recall-grade2.js`. Like `powerups.js`, it owns the rest store, the typed-answer matcher and the typing box.
- Each game swaps its direct `PowerUps.offer(pu)` call for a small `offerQuestion(pu)` helper and routes its points line through `Recall.points`.
- The wallet gains a `bonus` total. The study history gains a `test` entry type and a typed-answer count. Both lobbies' Parent panel gains a test-score form.

**Tech Stack:** Plain ES5 browser JavaScript in single-file HTML games, `node --test` unit tests, and headless-Chrome e2e (`tests/e2e`). There's no build step.

**Spec:** `docs/superpowers/specs/2026-10-01-anti-memorization-design.md`

**House rules for whoever executes this:**
- **Never run `git commit`.** The folder isn't a git repo anyway. Each task ends with a suggested commit message for the user. Leave out any `Co-Authored-By` line.
- Comments are sparse: only for non-obvious code.
- Shared files: always edit the **Grade 2 copy** (`grade 2/*-grade2.js`), then `cp` it over the root copy. `tests/copies.test.js` fails if they differ.
- Bash heredocs fail on emoji and quotes in this repo. Write edit scripts to the scratchpad with the Write tool and run them with `node`.
- Run unit tests with `node --test` from the repo root (`node --test tests/` doesn't work on this machine).
- Run e2e with `node tests/e2e/apps-e2e.js 2`, `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/lobby-e2e.js 2` and `node tests/e2e/lobby-e2e.js 5`. Question order is random, so run e2e at least twice before trusting it.

---

## File map

| File | Change |
|---|---|
| `grade 2/recall-grade2.js` (new), `recall.js` (copy) | Rest store, matcher, texts, `Recall.ask` typing box |
| `grade 2/powerups-grade2.js`, `powerups.js` | Add `PowerUps.skip()` |
| `grade 2/wallet-grade2.js`, `wallet.js` | `bonus`, `addBonus`, `testBonus`, `TEST_BONUS_TIERS`, `earned().bonus`, 4 guide sections |
| `grade 2/study-history-grade2.js`, `study-history.js` | `typed` count, `test` type, `testScore`, `findTest`, CSV row |
| 14 games (all but Math Mastery) | Script tag, `EXAM_POINTS_PER_CORRECT`, `offerQuestion`, `Recall.points`, typed history flag, results line, `TYPE_IT` map |
| `math-mastery.html` | `EXAM_POINTS_PER_CORRECT`, `awardPoint(…, exam)` |
| `lobby-grade5.html`, `grade 2/lobby.html` | Test-score form, `📝`/`✏️` history lines, shop `earned` bonus, `W.refreshShop` |
| `tests/recall.test.js` (new) | Core unit tests + per-game wiring |
| `tests/load-games.js` (new), `tests/typeit.test.js` (new) | Load every game's questions + `TYPE_IT`; eligibility test |
| `tests/wallet.test.js`, `tests/study-history.test.js`, `tests/copies.test.js`, `tests/powerups.test.js` | New and updated assertions |
| `tests/e2e/driver-common.page.js`, `driver-family-{a,b,c}.page.js`, `apps-e2e.js`, `lobby-driver.page.js`, `lobby-e2e.js` | `recall` mode, exam-pays-20 check, `testscore` lobby mode |

---

### Task 1: Recall core (pure logic)

**Files:**
- Create: `grade 2/recall-grade2.js`
- Create: `tests/recall.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/recall.test.js`:

```js
process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { create, matches, normalize, questionKey, REST_DAYS, TYPED_BONUS, TEXT } = require(path.join(__dirname, '..', 'grade 2', 'recall-grade2.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function clock(y, m, d) {
  let t = new Date(y, m - 1, d, 10, 0).getTime();
  const now = () => t;
  now.days = (n) => { const x = new Date(t); x.setDate(x.getDate() + n); t = x.getTime(); };
  now.set = (ms) => { t = ms; };
  return now;
}

test('the rest lasts 3 days and the typed bonus is 5', () => {
  assert.equal(REST_DAYS, 3);
  assert.equal(TYPED_BONUS, 5);
});

test('normalize drops case, accents, punctuation and extra spaces', () => {
  assert.equal(normalize('  Ñino,  BATHALA! '), 'nino bathala');
  assert.equal(normalize('Apo-Kabunian'), 'apo kabunian');
  assert.equal(normalize(null), '');
});

test('matches the answer or an accepted alternative', () => {
  assert.equal(matches('bathala', 'Bathala', []), true);
  assert.equal(matches('Insomnia.', 'INSOMNIA', []), true);
  assert.equal(matches('sun', 'the Sun', ['sun']), true);
  assert.equal(matches('moon', 'Sun', []), false);
});

test('one typo is forgiven only when the answer has 5 or more letters', () => {
  assert.equal(matches('insomia', 'insomnia', []), true, 'one letter missing');
  assert.equal(matches('insomniaa', 'insomnia', []), true, 'one letter extra');
  assert.equal(matches('insomnoa', 'insomnia', []), true, 'one letter changed');
  assert.equal(matches('insomnai', 'insomnia', []), false, 'two letters swapped is two edits');
  assert.equal(matches('rots', 'root', []), false, 'short answers must be exact');
});

test('numbers must match exactly', () => {
  assert.equal(matches('125', '125', []), true);
  assert.equal(matches('126', '125', []), false);
  assert.equal(matches('12345', '12346', []), false);
});

test('an empty answer never matches', () => {
  assert.equal(matches('', 'Sun', []), false);
  assert.equal(matches('  !! ', 'Sun', []), false);
});

test('the key covers the app, the mode, the stem and the picture', () => {
  assert.notEqual(questionKey('a', false, 'How much?', '<svg 1>'), questionKey('a', false, 'How much?', '<svg 2>'));
  assert.notEqual(questionKey('a', false, 'Q', ''), questionKey('a', true, 'Q', ''));
  assert.notEqual(questionKey('a', false, 'Q', ''), questionKey('b', false, 'Q', ''));
  assert.equal(questionKey('a', false, 'Q', undefined), questionKey('a', false, 'Q', ''));
});

test('an unhelped right answer pays, then rests until 3 calendar days later', () => {
  const now = clock(2026, 10, 30);
  const r = create(memory(), now, 'grade5');
  const quiz = [];
  assert.equal(r.begin(quiz, 'k').resting, 0);
  assert.equal(r.points(false, 10, 5), 15);
  assert.equal(r.begin(quiz, 'k').resting, 3, 'same day');
  assert.equal(r.points(false, 10, 5), 0, 'a resting question pays nothing');
  now.days(2);
  assert.equal(r.begin(quiz, 'k').resting, 1, 'Nov 1, across the month end');
  now.days(1);
  assert.equal(r.begin(quiz, 'k').resting, 0, 'Nov 2 = paid day + 3');
  assert.equal(r.points(false, 10, 0), 10);
});

test('the rest counts calendar days, not hours', () => {
  const now = clock(2026, 10, 5);
  now.set(new Date(2026, 9, 5, 23, 59).getTime());
  const r = create(memory(), now, 'grade5');
  r.begin([], 'k');
  r.points(false, 10, 0);
  now.set(new Date(2026, 9, 8, 0, 1).getTime());
  assert.equal(r.begin([], 'k').resting, 0);
});

test('a helped right answer pays half and does not start the rest', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  assert.equal(r.points(true, 10, 5), 5);
  assert.equal(r.begin([], 'k').resting, 0);
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

test('lesson and exam rest separately', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  r.begin([], questionKey('a', false, 'Q', ''));
  r.points(false, 10, 0);
  assert.equal(r.begin([], questionKey('a', true, 'Q', '')).resting, 0);
});

test('the results line counts resting answers in this quiz only', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  const q1 = [];
  r.begin(q1, 'a'); r.points(false, 10, 0);
  r.begin(q1, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), '');
  const q2 = [];
  r.begin(q2, 'a'); r.points(false, 10, 0);
  r.begin(q2, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), TEXT.grade5.resultLine(2));
  r.begin([], 'a');
  assert.equal(r.resultLine(), '', 'a new quiz starts the count again');
});

test('points with no question started fall back to the normal rule', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  assert.equal(r.points(false, 10, 5), 15);
  assert.equal(r.points(true, 10, 5), 5);
});

test('old rest dates are pruned and bad data is ignored', () => {
  const s = memory({ grade5_recall_v1: JSON.stringify({ v: 1, rest: { old: '2026-09-01', fresh: '2026-10-01', junk: 5, bad: 'yesterday' } }) });
  create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(JSON.parse(s.data.grade5_recall_v1).rest, { fresh: '2026-10-01' });
  const r = create(memory({ grade5_recall_v1: '{nope' }), clock(2026, 10, 2), 'grade5');
  assert.equal(r.begin([], 'k').resting, 0);
});

test('each grade has its own store and an unknown grade is refused', () => {
  const s = memory();
  const now = clock(2026, 10, 1);
  const g5 = create(s, now, 'grade5');
  g5.begin([], 'k');
  g5.points(false, 10, 0);
  assert.equal(create(s, now, 'grade2').begin([], 'k').resting, 0);
  assert.throws(() => create(s, now, 'grade9'));
  assert.throws(() => create(s, now, null));
});

test('storage that throws never breaks the game', () => {
  const s = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const r = create(s, clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  assert.equal(r.points(false, 10, 0), 10);
});

test('Grade 2 text pairs Filipino with English; buttons are English only', () => {
  const t = TEXT.grade2;
  for (const line of [t.resting(2), t.resultLine(3), t.typePrompt, t.notQuite, t.typedRight]) assert.match(line, / · /, line);
  assert.equal(t.check, 'Check');
  assert.equal(t.show, 'Show choices');
  assert.deepEqual(Object.keys(TEXT.grade2).sort(), Object.keys(TEXT.grade5).sort());
  assert.equal(TEXT.grade5.resting(1), '⏳ Resting: points again in 1 day');
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/recall.test.js`
Expected: FAIL with `Cannot find module '…recall-grade2.js'`.

- [ ] **Step 3: Write the core module**

Create `grade 2/recall-grade2.js`:

```js
/* Loaded by every game except Math Mastery, after powerups.js. The pages are decoded as UTF-8, so the text can hold emoji.
   A question she gets right on her own pays no points again for REST_DAYS calendar days. */
(function (root) {
  'use strict';

  var REST_DAYS = 3;
  var TYPED_BONUS = 5;

  function dayWord(n) { return n === 1 ? ' day' : ' days'; }
  function restingEn(n) { return n + (n === 1 ? ' question was resting, so it pays' : ' questions were resting, so they pay') + ' again soon'; }

  var TEXT = {
    grade5: {
      resting: function (days) { return '⏳ Resting: points again in ' + days + dayWord(days); },
      resultLine: function (n) { return ' · ⏳ ' + restingEn(n); },
      typePrompt: '✏️ Type the answer first for +' + TYPED_BONUS + ' bonus!',
      placeholder: 'Your answer',
      check: 'Check',
      show: 'Show choices',
      notQuite: 'Not quite! Pick from the choices.',
      typedRight: '✏️ You typed it! +' + TYPED_BONUS + ' bonus'
    },
    grade2: {
      resting: function (days) { return '⏳ Pahinga muna ang tanong na ito · Resting: points again in ' + days + dayWord(days); },
      resultLine: function (n) { return ' · ⏳ ' + n + ' tanong ang nagpahinga · ' + restingEn(n); },
      typePrompt: '✏️ I-type muna ang sagot para sa +' + TYPED_BONUS + ' bonus · Type the answer first for +' + TYPED_BONUS + ' bonus!',
      placeholder: 'Your answer',
      check: 'Check',
      show: 'Show choices',
      notQuite: 'Hindi pa tama. Pumili sa choices. · Not quite! Pick from the choices.',
      typedRight: '✏️ Na-type mo! · You typed it! +' + TYPED_BONUS + ' bonus'
    }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayNumber(key) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
    return p ? Math.round(Date.UTC(+p[1], +p[2] - 1, +p[3]) / 86400000) : NaN;
  }

  // 32-bit FNV-1a, enough to tell about a thousand questions apart.
  function hash(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function questionKey(app, exam, q, art) {
    return app + '|' + (exam ? 'exam' : 'lesson') + '|' + hash(String(q) + '|' + String(art || ''));
  }

  function normalize(text) {
    return String(text == null ? '' : text).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function withinOneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  function matches(typed, answer, accept) {
    var t = normalize(typed);
    if (!t) return false;
    return [answer].concat(accept || []).some(function (target) {
      var want = normalize(target);
      if (!want) return false;
      if (t === want) return true;
      if (/[0-9]/.test(want + t)) return false;
      return want.replace(/ /g, '').length >= 5 && withinOneEdit(t, want);
    });
  }

  function create(storage, now, grade) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Recall needs a grade like "grade5".');
    var KEY = grade + '_recall_v1';
    var current = null, lastQuiz = null, restingCount = 0;

    function read() {
      var raw = null;
      try { raw = storage.getItem(KEY); } catch (e) {}
      try {
        var d = raw ? JSON.parse(raw) : null;
        if (d && d.v === 1 && d.rest && typeof d.rest === 'object' && !Array.isArray(d.rest)) return d;
      } catch (e) {}
      return { v: 1, rest: {} };
    }

    function write(state) {
      try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }

    function daysLeft(paidOn) {
      var gone = dayNumber(dateKey(now())) - dayNumber(paidOn);
      return isNaN(gone) ? 0 : Math.max(0, Math.min(REST_DAYS, REST_DAYS - gone));
    }

    var stored = read(), pruned = false;
    Object.keys(stored.rest).forEach(function (k) {
      if (typeof stored.rest[k] !== 'string' || daysLeft(stored.rest[k]) === 0) { delete stored.rest[k]; pruned = true; }
    });
    if (pruned) write(stored);

    return {
      text: TEXT[grade],

      begin: function (quiz, key) {
        if (quiz !== lastQuiz) { lastQuiz = quiz; restingCount = 0; }
        var paidOn = read().rest[key];
        current = { key: key, resting: typeof paidOn === 'string' ? daysLeft(paidOn) : 0, typed: false };
        return current;
      },

      markTyped: function () { if (current) current.typed = true; },

      typed: function () { return !!(current && current.typed); },

      // Called only for a right answer.
      points: function (helped, base, bonus) {
        if (!current) return helped ? base / 2 : base + bonus;
        if (current.resting) { restingCount++; return 0; }
        if (helped) return base / 2;
        var state = read();
        state.rest[current.key] = dateKey(now());
        write(state);
        return base + bonus + (current.typed ? TYPED_BONUS : 0);
      },

      resultLine: function () { return restingCount ? TEXT[grade].resultLine(restingCount) : ''; }
    };
  }

  var exported = { create: create, matches: matches, normalize: normalize, questionKey: questionKey, TEXT: TEXT, REST_DAYS: REST_DAYS, TYPED_BONUS: TYPED_BONUS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
})(this);
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/recall.test.js`
Expected: every test passes.

- [ ] **Step 5: Suggest a commit message to the user**

```
feat: add recall core (3-day question rest, typed-answer matcher)
```

---

### Task 2: `PowerUps.skip()`

**Files:**
- Modify: `grade 2/powerups-grade2.js` (the object returned by `mountUi`, just before `answered: function () {`)
- Copy over: `powerups.js`
- Test: `tests/powerups.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/powerups.test.js`:

```js
test('power-ups can be skipped for a question (resting or waiting for a typed answer)', () => {
  const src = fs.readFileSync(path.join(root, 'grade 2', 'powerups-grade2.js'), 'utf8');
  assert.match(src, /skip: function \(\) \{\n\s+disarm\(\);\n\s+info = null;\n\s+if \(bar && bar\.parentNode\) bar\.parentNode\.removeChild\(bar\);/);
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `node --test tests/powerups.test.js`
Expected: FAIL on the new test, because the regex finds no `skip:`.

- [ ] **Step 3: Add `skip`**

In `grade 2/powerups-grade2.js`, inside the object returned by `mountUi`, insert this immediately before the line `      answered: function () {`:

```js
      // No bar and no state for a question that cannot use power-ups.
      skip: function () {
        disarm();
        info = null;
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      },
```

`answered()`, `shield()` and the second-chance listener already return early when `info` is null. `offer()` rebuilds `info` and re-inserts the bar.

Then run: `cp "grade 2/powerups-grade2.js" powerups.js`

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/powerups.test.js tests/copies.test.js`
Expected: PASS.

- [ ] **Step 5: Suggest a commit message**

```
feat: let a question skip the power-up bar
```

---

### Task 3: Recall UI (`Recall.ask`) and the root copy

**Files:**
- Modify: `grade 2/recall-grade2.js` (add the UI and the browser bootstrap)
- Copy over: `recall.js`
- Test: `tests/copies.test.js`

- [ ] **Step 1: Write the failing copies test**

Append to `tests/copies.test.js`:

```js
test('the Grade 2 and Grade 5 recall files are identical', () => {
  const g2 = fs.readFileSync(path.join(root, 'grade 2', 'recall-grade2.js'));
  const g5 = fs.readFileSync(path.join(root, 'recall.js'));
  assert.ok(g2.equals(g5), 'edit grade 2/recall-grade2.js, then copy it over the root recall.js');
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `node --test tests/copies.test.js`
Expected: FAIL with `ENOENT … recall.js`.

- [ ] **Step 3: Add the UI**

In `grade 2/recall-grade2.js`, insert this block immediately before the line `  var exported = {`:

```js
  var UI_CSS =
    '.recall-note{margin:8px 0;padding:8px 12px;border-radius:12px;background:#EEF4FF;color:#23395B;font-size:.9rem;font-weight:700;}' +
    '.recall-type{margin:10px 0;padding:12px;border:2px dashed #9BB4E0;border-radius:16px;background:#F7FAFF;color:#23395B;}' +
    '.recall-type p{margin:0 0 8px;font-weight:800;}' +
    '.recall-type input{box-sizing:border-box;width:100%;padding:10px 12px;border:2px solid #9BB4E0;border-radius:12px;font:inherit;font-size:1.05rem;}' +
    '.recall-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}' +
    '.recall-row button{flex:1 1 140px;padding:10px 14px;border:0;border-radius:999px;font:inherit;font-weight:800;cursor:pointer;}' +
    '.recall-check{background:#2E9E5B;color:#fff;}' +
    '.recall-show{background:#E4E9F2;color:#23395B;}' +
    '.recall-type button:focus-visible,.recall-type input:focus-visible{outline:3px solid #23395B;outline-offset:2px;}';

  // pu is the object the game builds for PowerUps.offer, plus `art`.
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
    function note(before, text) { before.parentNode.insertBefore(el('div', 'recall-note', text), before); }

    core.ask = function (pu, app, typeIt) {
      var PU = win.PowerUps;
      Array.prototype.forEach.call(doc.querySelectorAll('.recall-note, .recall-type'), function (n) { n.parentNode.removeChild(n); });
      if (PU && PU.skip) PU.skip();
      var before = pu.before;
      if (!before || !before.parentNode) return;
      var cur = core.begin(pu.quiz, questionKey(app, pu.exam, pu.q, pu.art));
      function offer() { if (!cur.resting && PU) PU.offer(pu); }
      if (cur.resting) note(before, T.resting(cur.resting));

      var right = (pu.options || [])[pu.correct];
      var accept = typeIt && Object.prototype.hasOwnProperty.call(typeIt, pu.q) ? typeIt[pu.q] : null;
      if (!accept || !right) { offer(); return; }

      var box = el('div', 'recall-type');
      var input = el('input');
      input.type = 'text';
      input.placeholder = T.placeholder;
      input.setAttribute('aria-label', T.placeholder);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      var row = el('div', 'recall-row');
      var check = el('button', 'recall-check', T.check);
      var show = el('button', 'recall-show', T.show);
      check.type = 'button';
      show.type = 'button';
      row.appendChild(check);
      row.appendChild(show);
      box.appendChild(el('p', '', T.typePrompt));
      box.appendChild(input);
      box.appendChild(row);
      before.style.display = 'none';
      before.parentNode.insertBefore(box, before);

      function reveal() {
        if (box.parentNode) box.parentNode.removeChild(box);
        before.style.display = '';
      }
      check.addEventListener('click', function () {
        if (!input.value.trim()) { input.focus(); return; }
        reveal();
        if (matches(input.value, right.textContent, accept)) {
          core.markTyped();
          if (!cur.resting) note(before, T.typedRight);
          right.click();
        } else {
          note(before, T.notQuite);
          offer();
        }
      });
      show.addEventListener('click', function () { reveal(); offer(); });
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') check.click(); });
    };
    return core;
  }

```

Then replace the module tail:

```js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
})(this);
```

with:

```js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Recall = mountUi(root, create(root.localStorage, Date.now, script ? script.getAttribute('data-grade') : null));
  } catch (e) {}
})(this);
```

Then run: `cp "grade 2/recall-grade2.js" recall.js`

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/copies.test.js tests/recall.test.js`
Expected: PASS. Task 1's tests still pass, because the UI is only added in the browser.

- [ ] **Step 5: Suggest a commit message**

```
feat: add the recall typing box and resting note
```

---

### Task 4: Wallet bonus, test-score tiers and guide sections

**Files:**
- Modify: `grade 2/wallet-grade2.js`
- Copy over: `wallet.js`
- Test: `tests/wallet.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/wallet.test.js`, change the two `deepEqual` lines in the test `'earned reports the new points since the baseline and the coins they made'` (around line 247) to include `bonus: 0`:

```js
  assert.deepEqual(w.earned({ a: 1500, b: 9 }), { points: 1009, coins: 100, welcome: 40, spent: 0, bonus: 0 });
```
and
```js
  assert.deepEqual(w.earned({ a: 1500, b: 9 }), { points: 1009, coins: 100, welcome: 40, spent: 40, bonus: 0 });
```

Then append:

```js
test('test-score coins follow the tiers, compared without rounding', () => {
  const { testBonus, TEST_BONUS_TIERS } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));
  assert.deepEqual(TEST_BONUS_TIERS.map((t) => [t.pct, t.coins]), [[100, 50], [90, 40], [80, 30], [0, 10]]);
  assert.equal(testBonus(15, 15), 50);
  assert.equal(testBonus(14, 15), 40, '93.3%');
  assert.equal(testBonus(9, 10), 40, 'exactly 90%');
  assert.equal(testBonus(899, 1000), 30, '89.9%');
  assert.equal(testBonus(4, 5), 30, 'exactly 80%');
  assert.equal(testBonus(799, 1000), 10, '79.9%');
  assert.equal(testBonus(0, 10), 10, 'trying still counts');
  assert.equal(testBonus(11, 10), 0, 'score above total');
  assert.equal(testBonus(5, 0), 0, 'no total');
  assert.equal(testBonus(2.5, 10), 0, 'whole numbers only');
});

test('a bonus adds coins on top of points, welcome gift and spending', () => {
  const { w } = setup();
  converted(w);
  const before = w.balance({});
  assert.equal(w.addBonus(40), true);
  assert.equal(w.balance({}), before + 40);
  assert.equal(w.balanceStored(), before + 40);
  assert.equal(w.earned({}).bonus, 40);
  assert.equal(w.addBonus(0), false);
  assert.equal(w.addBonus(-5), false);
  assert.equal(w.addBonus(2.5), false);
  assert.equal(w.balance({}), before + 40);
});

test('an old wallet without a bonus field reads it as 0', () => {
  const { storage, clock } = setup();
  storage.setItem('grade5_wallet_v1', JSON.stringify({ v: 1, baselines: {}, spent: 0, purchases: [], oldPointsCounted: true }));
  const w = create(storage, clock.now, 'grade5');
  assert.equal(w.earned({}).bonus, 0);
  assert.equal(w.balance({}), 40);
});

test('the coin guide explains resting, typing, the exam and the test bonus in both grades', () => {
  const { GUIDE_TEXT } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));
  for (const grade of ['grade2', 'grade5']) {
    const icons = GUIDE_TEXT[grade].sections(40).map((s) => s[0]);
    for (const icon of ['⏳', '✏️', '🏆', '📝']) assert.ok(icons.includes(icon), grade + ' has ' + icon);
  }
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/wallet.test.js`
Expected: FAIL. `bonus` is missing from `earned`, and `testBonus`, `addBonus` and the guide icons are undefined or absent.

- [ ] **Step 3: Implement**

In `grade 2/wallet-grade2.js`:

(a) After the `var POWER_UPS = …;` line, add:

```js

  // A real school test, entered by a parent in the lobby. score * 100 >= total * pct, checked top-down.
  var TEST_BONUS_TIERS = [{ pct: 100, coins: 50 }, { pct: 90, coins: 40 }, { pct: 80, coins: 30 }, { pct: 0, coins: 10 }];

  function testBonus(score, total) {
    if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) return 0;
    for (var i = 0; i < TEST_BONUS_TIERS.length; i++) {
      if (score * 100 >= total * TEST_BONUS_TIERS[i].pct) return TEST_BONUS_TIERS[i].coins;
    }
    return 0;
  }
```

(b) `fresh()` becomes:

```js
    function fresh() { return { v: 1, baselines: {}, spent: 0, bonus: 0, purchases: [], oldPointsCounted: false }; }
```

(c) In `read()`, after the `spent: …,` line, add:

```js
          bonus: typeof d.bonus === 'number' && d.bonus > 0 ? d.bonus : 0,
```

(d) `balanceOf` becomes:

```js
    function balanceOf(state, points) {
      var earned = Math.floor(newPoints(state, points) / POINTS_PER_COIN);
      return Math.max(0, WELCOME_GIFT + earned + state.bonus - state.spent);
    }
```

(e) `earned` becomes:

```js
      earned: function (points) {
        var state = read(), gained = newPoints(state, points);
        return { points: gained, coins: Math.floor(gained / POINTS_PER_COIN), welcome: WELCOME_GIFT, spent: state.spent, bonus: state.bonus };
      },
```

(f) After `earned`, add:

```js
      addBonus: function (coins) {
        if (!Number.isInteger(coins) || coins <= 0) return false;
        var state = read();
        state.bonus += coins;
        return write(state);
      },

      testBonus: testBonus,
```

(g) The `exported` line becomes:

```js
  var exported = { create: create, CATALOG: CATALOG, POWER_UPS: POWER_UPS, TEST_BONUS_TIERS: TEST_BONUS_TIERS, testBonus: testBonus, findItem: findItem, GUIDE_TEXT: GUIDE_TEXT };
```

(h) In `GUIDE_TEXT.grade5.sections`, insert these four rows immediately before the `['★', 'Stars', …]` row:

```js
          ['⏳', 'Resting questions', 'When you get a question right on your own, it rests for 3 days. You can still practice it, but it gives points again only after the rest. Remembering after days is what counts!'],
          ['✏️', 'Type it first', 'See a ✏️ box? Type the answer before you look at the choices. If it is right, you earn 5 bonus points. If not, just pick from the choices.'],
          ['🏆', 'Mock Exam', 'Every right answer in the Mock Exam is worth 20 points, double a lesson quiz!'],
          ['📝', 'Real test bonus', 'Got your real test back from school? Show it to Mommy or Tatay. They can add up to 50 coins: 50 for a perfect score, 40 for 90% or more, 30 for 80% or more, and 10 for trying.'],
```

(i) In `GUIDE_TEXT.grade2.sections`, insert these four rows immediately before the `['★', 'Stars', …]` row:

```js
          ['⏳', 'Pahinga · Resting questions', 'Kapag tama ang sagot mo nang walang tulong, magpapahinga ang tanong nang 3 araw. Puwede mo pa rin itong sagutan, pero walang points hanggang matapos ang pahinga.',
            'When you get a question right on your own, it rests for 3 days. You can still answer it, but it gives no points until the rest is over.'],
          ['✏️', 'I-type muna · Type it first', 'May kahon na ✏️? I-type muna ang sagot bago tumingin sa choices. Kapag tama, may 5 bonus points ka. Kapag mali, pumili lang sa choices.',
            'See a ✏️ box? Type the answer before you look at the choices. If it is right, you get 5 bonus points. If not, just pick from the choices.'],
          ['🏆', 'Mock Exam', 'Bawat tamang sagot sa Mock Exam = 20 points, doble ng lesson quiz!',
            'Every right answer in the Mock Exam = 20 points, double a lesson quiz!'],
          ['📝', 'Totoong test · Real test bonus', 'Ipakita kay Mommy o Tatay ang score mo sa totoong test sa school. Hanggang 50 coins: 50 kapag perfect, 40 kapag 90% pataas, 30 kapag 80% pataas, at 10 dahil sumubok ka.',
            'Show Mommy or Tatay your real test score from school. Up to 50 coins: 50 for a perfect score, 40 for 90% or more, 30 for 80% or more, and 10 for trying.'],
```

Then run: `cp "grade 2/wallet-grade2.js" wallet.js`

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/wallet.test.js tests/copies.test.js tests/english-everywhere.test.js`
Expected: PASS. If `english-everywhere` flags a new Grade 2 line, fix the copy so Filipino is paired with English, rather than loosening the test.

- [ ] **Step 5: Suggest a commit message**

```
feat: add wallet test-score bonus and guide sections for fair points
```

---

### Task 5: Study history (typed count, real test entries)

**Files:**
- Modify: `grade 2/study-history-grade2.js`
- Copy over: `study-history.js`
- Test: `tests/study-history.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/study-history.test.js`:

```js
test('quizAnswered counts answers she typed', () => {
  const { storage, sh } = setup();
  const id = sh.quizStarted('life-lab', 'Life Lab', 'roots', 'Roots', false, 3);
  sh.quizAnswered(id, true, 'Q1', 'Roots', 'Roots', true);
  sh.quizAnswered(id, true, 'Q2', 'Stem', 'Stem', false);
  sh.quizAnswered(id, true, 'Q3', 'Leaf', 'Leaf');
  assert.equal(saved(storage)[0].typed, 1);
});

test('a real test score is stored, listed, findable, never pruned, and exported', () => {
  const { storage, clock, sh } = setup();
  sh.testScore('life-lab', 'Life <b>Lab</b>', 'Science ST1', 14, 15, 40);
  const e = saved(storage)[0];
  assert.deepEqual([e.type, e.app, e.appTitle, e.testName, e.score, e.total, e.coins], ['test', 'life-lab', 'Life Lab', 'Science ST1', 14, 15, 40]);
  assert.equal(sh.list().length, 1);
  assert.equal(sh.findTest('life-lab', 'science st1').id, e.id, 'case-insensitive');
  assert.equal(sh.findTest('life-lab', 'Science ST2'), null);
  assert.equal(sh.findTest('rise-shine', 'Science ST1'), null);
  clock.set(2026, 12, 1, 9, 0);
  sh.prunePurchases(7);
  assert.equal(saved(storage).length, 1, 'only purchases are pruned');
  const row = sh.exportCsv().slice(1).split('\r\n')[1];
  assert.match(row, /,Real test,Science ST1 \(\+40 coins\),14 of 15,/);
  assert.equal(row.split(',').length, 14, 'same column count as every other row');
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/study-history.test.js`
Expected: FAIL. `typed` is undefined and `sh.testScore` is not a function.

- [ ] **Step 3: Implement**

In `grade 2/study-history-grade2.js`:

(a) `var TYPES = ['open', 'lesson', 'quiz', 'purchase'];` becomes:

```js
  var TYPES = ['open', 'lesson', 'quiz', 'purchase', 'test'];
```

(b) `api.quizAnswered` becomes:

```js
    api.quizAnswered = function (id, isCorrect, q, picked, answer, typed) {
      update(id, function (e) {
        e.answered++;
        if (isCorrect) e.correct++;
        else e.wrong.push({ q: plain(q), picked: plain(picked), answer: plain(answer) });
        if (typed) e.typed = (e.typed || 0) + 1;
      });
    };
```

(c) After `api.purchased = …;`, add:

```js
    api.testScore = function (app, appTitle, testName, score, total, coins) {
      return add({ type: 'test', app: String(app), appTitle: plain(appTitle), testName: plain(testName), score: score, total: total, coins: coins });
    };

    // The latest entry for this subject and test name (case-insensitive), or null.
    api.findTest = function (app, testName) {
      var want = plain(testName).toLowerCase(), found = null;
      (read() || []).forEach(function (e) {
        if (validEntry(e) && e.type === 'test' && e.app === app && String(e.testName).toLowerCase() === want && (!found || e.t > found.t)) found = e;
      });
      return found;
    };
```

(d) In `csvRow`, right after the `if (e.type === 'purchase') { … }` block, add:

```js
      if (e.type === 'test') {
        return [dateKey(e.t), timeKey(e.t), nameOf ? nameOf(e.app, e.appTitle) : e.appTitle, 'Real test',
          e.testName + ' (+' + numOr0(e.coins) + ' coins)', numOr0(e.score) + ' of ' + numOr0(e.total), '', '', '', '', '', '', '', ''];
      }
```

Then run: `cp "grade 2/study-history-grade2.js" study-history.js`

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/study-history.test.js tests/copies.test.js`
Expected: PASS.

- [ ] **Step 5: Suggest a commit message**

```
feat: record typed answers and real test scores in study history
```

---

### Task 6: Wire Recall and the double-pay exam into the games

**Files:**
- Modify: the 14 games below and `math-mastery.html`
- Create (scratchpad, not the repo): `wire-recall.js`
- Test: `tests/recall.test.js` (wiring) and `tests/powerups.test.js` (updated counts)

The 14 games are:
- **Grade 5:** `craft-corner`, `history-explorers`, `life-lab`, `page-turners`, `rally-ready`, `rise-shine`, `wikaharian` (all at the root);
- **Grade 2:** `batang-bayani`, `block-bot`, `byte-buddies`, `growing-good`, `kuwentista`, `science-detectives`, `word-train` (in `grade 2/`).

- [ ] **Step 1: Write the failing wiring tests**

Append to `tests/recall.test.js`:

```js
const fs = require('node:fs');
const root = path.join(__dirname, '..');
const G5 = ['craft-corner', 'history-explorers', 'life-lab', 'page-turners', 'rally-ready', 'rise-shine', 'wikaharian'];
const G2 = ['batang-bayani', 'block-bot', 'byte-buddies', 'growing-good', 'kuwentista', 'science-detectives', 'word-train'];
const games = G5.map((a) => ({ a, file: path.join(root, a + '.html'), tag: '<script src="recall.js" data-grade="grade5"></script>', pu: 'powerups.js' }))
  .concat(G2.map((a) => ({ a, file: path.join(root, 'grade 2', a + '.html'), tag: '<script src="recall-grade2.js" data-grade="grade2"></script>', pu: 'powerups-grade2.js' })));
const count = (html, s) => html.split(s).length - 1;

for (const g of games) {
  test(g.a + ' routes every question and every point through Recall', () => {
    const html = fs.readFileSync(g.file, 'utf8');
    assert.ok(html.indexOf(g.tag) > html.indexOf('<script src="' + g.pu + '"'), 'recall tag after the power-ups tag');
    assert.equal(count(html, 'PowerUps.offer('), 1, 'only offerQuestion calls PowerUps.offer');
    assert.ok(count(html, 'offerQuestion({') >= 1, 'questions are offered through offerQuestion');
    assert.match(html, /EXAM_POINTS_PER_CORRECT = 20/);
    assert.equal(count(html, 'Recall.points(helped, ptsBase, ptsBonus)'), count(html, 'streak++;'), 'every right answer is scored by Recall');
    assert.equal(count(html, ', window.Recall ? Recall.typed() : false);'), count(html, 'SH.quizAnswered('), 'history hears about typed answers');
    assert.equal(count(html, 'Recall.resultLine()'), 1, 'the results screen shows resting questions');
    assert.match(html, /(const|var) TYPE_IT = \{/);
  });
}

test('Math Mastery pays double in the mock exam but never rests questions', () => {
  const html = fs.readFileSync(path.join(root, 'math-mastery.html'), 'utf8');
  assert.match(html, /EXAM_POINTS_PER_CORRECT = 20/);
  assert.match(html, /function awardPoint\(correct, helped, shielded, exam\)/);
  assert.match(html, /awardPoint\(correct, helped, [^\n]*, currentQuizMeta\.id === 'final'\);/);
  assert.equal(count(html, 'recall.js'), 0);
});
```

In `tests/powerups.test.js`, inside the `for (const g of games)` test, replace these three assertions:

```js
    assert.ok(html.split('PowerUps.offer(').length - 1 >= answers, 'every answered question was offered');
```
```js
    assert.equal(html.split('helped ? POINTS_PER_CORRECT / 2 :').length - 1, html.split('streak++;').length - 1, 'a helped answer earns half points');
```
```js
    assert.equal(html.split('rerender:').length - 1, html.split('PowerUps.offer(').length - 1, 'every question can be saved for later');
```

with:

```js
    const offers = html.split('PowerUps.offer({').length - 1 + html.split('offerQuestion({').length - 1;
    assert.ok(offers >= answers, 'every answered question was offered');
```
```js
    assert.equal(html.split(/helped \? ptsBase \/ 2 :/).length - 1, html.split('streak++;').length - 1, 'a helped answer earns half points');
```
```js
    assert.equal(html.split('rerender:').length - 1, offers, 'every question can be saved for later');
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/recall.test.js tests/powerups.test.js`
Expected: FAIL. Every game is missing the recall tag, `offerQuestion` and `ptsBase`.

- [ ] **Step 3: Write and run the wiring script**

Save as `<scratchpad>/wire-recall.js`:

```js
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
if (!root) throw new Error('usage: node wire-recall.js <repo root>');

const GRADE5 = ['craft-corner', 'history-explorers', 'life-lab', 'page-turners', 'rally-ready', 'rise-shine', 'wikaharian'];
const GRADE2 = ['batang-bayani', 'block-bot', 'byte-buddies', 'growing-good', 'kuwentista', 'science-detectives', 'word-train'];
const FAMILY_B = ['batang-bayani', 'byte-buddies', 'growing-good', 'science-detectives', 'word-train'];
const ART = { 'block-bot': 'art:q.art, ', 'byte-buddies': 'art: item.pic, ' };
GRADE5.forEach((a) => { ART[a] = 'art:q.art, '; });

function once(html, from, to, what) {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(what + ': expected 1 match, found ' + n);
  return html.replace(from, () => to);
}
function each(html, re, fn, what) {
  let n = 0;
  const out = html.replace(re, (...m) => { n++; return fn(...m); });
  if (!n) throw new Error(what + ': no match');
  return out;
}

const games = GRADE5.map((a) => ({ a, file: path.join(root, a + '.html'), g: 5 }))
  .concat(GRADE2.map((a) => ({ a, file: path.join(root, 'grade 2', a + '.html'), g: 2 })));

for (const { a, file, g } of games) {
  let html = fs.readFileSync(file, 'utf8');
  const pu = g === 5 ? '<script src="powerups.js" data-grade="grade5"></script>' : '<script src="powerups-grade2.js" data-grade="grade2"></script>';
  const rc = g === 5 ? '<script src="recall.js" data-grade="grade5"></script>' : '<script src="recall-grade2.js" data-grade="grade2"></script>';
  html = once(html, pu, pu + '\n' + rc, a + ' script tag');

  html = each(html, /POINTS_PER_CORRECT = 10, /g, () => 'POINTS_PER_CORRECT = 10, EXAM_POINTS_PER_CORRECT = 20, ', a + ' exam constant');

  html = each(html, /^([ \t]*)(const|var) pts = helped \? POINTS_PER_CORRECT \/ 2 : POINTS_PER_CORRECT \+ \(streak >= STREAK_BONUS_AT \? STREAK_BONUS : 0\);$/gm,
    (m, ind, kw) => ind + kw + " ptsBase = currentQuizMeta.id === 'final' ? EXAM_POINTS_PER_CORRECT : POINTS_PER_CORRECT, ptsBonus = streak >= STREAK_BONUS_AT ? STREAK_BONUS : 0;\n" +
      ind + kw + ' pts = window.Recall ? Recall.points(helped, ptsBase, ptsBonus) : helped ? ptsBase / 2 : ptsBase + ptsBonus;', a + ' points line');

  html = each(html, /window\.PowerUps && PowerUps\.offer\(\{ ?/g, () => 'offerQuestion({ ' + (ART[a] || ''), a + ' offer calls');

  html = each(html, /^( *)function prepareQuestion\(/m, (m, ind) =>
    ind + '// Recall decides whether this question pays, shows a typing box, and offers power-ups.\n' +
    ind + 'function offerQuestion(pu){\n' +
    ind + "  if (window.Recall) Recall.ask(pu, SH_APP, typeof TYPE_IT === 'undefined' ? null : TYPE_IT);\n" +
    ind + '  else if (window.PowerUps) PowerUps.offer(pu);\n' +
    ind + '}\n' + m, a + ' helper');

  if (FAMILY_B.includes(a)) {
    const at = html.indexOf('\n  var lessons = [');
    const end = html.indexOf('\n  ];', at) + 5;
    if (at < 0 || end < 5) throw new Error(a + ': lessons not found');
    html = html.slice(0, end) + '\n\n  var TYPE_IT = {};' + html.slice(end);
  } else {
    const at = html.indexOf('\nconst LESSONS = [');
    const end = html.indexOf('\n];', at) + 3;
    if (at < 0 || end < 3) throw new Error(a + ': LESSONS not found');
    html = html.slice(0, end) + '\n\n// Questions she may answer by typing first (+5 bonus). Value: other accepted answers.\nconst TYPE_IT = {};' + html.slice(end);
  }

  html = each(html, /^([ \t]*SH && SH\.quizAnswered\(historyQuizId,.*)\);$/gm, (m, body) => body + ', window.Recall ? Recall.typed() : false);', a + ' history typed');

  html = once(html, "document.getElementById('points-earned').textContent = ptsLine;",
    "document.getElementById('points-earned').textContent = ptsLine + (window.Recall ? Recall.resultLine() : '');", a + ' result line');

  fs.writeFileSync(file, html);
  console.log('wired ' + a);
}

const mathFile = path.join(root, 'math-mastery.html');
let m = fs.readFileSync(mathFile, 'utf8');
m = once(m, 'POINTS_PER_CORRECT = 10, ', 'POINTS_PER_CORRECT = 10, EXAM_POINTS_PER_CORRECT = 20, ', 'math constant');
m = once(m, 'They all pay the same, so a streak carries across the', 'A mock exam answer pays double. A streak carries across the', 'math comment');
m = once(m, 'function awardPoint(correct, helped, shielded){', 'function awardPoint(correct, helped, shielded, exam){', 'math signature');
m = once(m, '    const pts = helped ? POINTS_PER_CORRECT / 2 : POINTS_PER_CORRECT + (streak >= STREAK_BONUS_AT ? STREAK_BONUS : 0);',
  '    const ptsBase = exam ? EXAM_POINTS_PER_CORRECT : POINTS_PER_CORRECT;\n    const pts = helped ? ptsBase / 2 : ptsBase + (streak >= STREAK_BONUS_AT ? STREAK_BONUS : 0);', 'math points');
m = once(m, '  awardPoint(correct, helped, !correct && !!(window.PowerUps && PowerUps.shield()));',
  "  awardPoint(correct, helped, !correct && !!(window.PowerUps && PowerUps.shield()), currentQuizMeta.id === 'final');", 'math quiz call');
fs.writeFileSync(mathFile, m);
console.log('wired math-mastery');
```

Back up first, then run:

```bash
mkdir -p "<scratchpad>/backup-before-recall" && cp *.html "<scratchpad>/backup-before-recall/" && cp "grade 2"/*.html "<scratchpad>/backup-before-recall/"
```
```bash
node "<scratchpad>/wire-recall.js" "C:/Users/ADMIN/IdeaProjects/school"
```

Expected: 15 `wired …` lines. If any `expected 1 match` or `no match` error appears, stop. Restore that file from the backup, open the game at the failing anchor, and fix the script's pattern for it. Never hand-edit around the error.

- [ ] **Step 4: Check every game still parses, then run the tests**

Run: `node --test`
Expected: everything passes, including the new wiring tests and the updated power-ups counts. `learn-from-mistakes.test.js` loads each family's lessons block; a `SyntaxError` there means a `TYPE_IT` insert landed inside the array. Restore and fix.

- [ ] **Step 5: Run e2e and check old behaviour is unchanged**

Run: `node tests/e2e/apps-e2e.js 2` and `node tests/e2e/apps-e2e.js 5`
Expected: all PASS. The e2e folder doesn't contain `recall.js` yet, so every game takes its `window.Recall`-absent path, and the existing assertions hold. The exam now pays 20, but the existing play checks don't assert exam points; Task 9 adds that.

- [ ] **Step 6: Suggest a commit message**

```
feat: route quiz points through recall and pay double in mock exams
```

---

### Task 7: Choose the typed questions (`TYPE_IT`)

**Files:**
- Create: `tests/load-games.js`
- Create: `tests/typeit.test.js`
- Create (scratchpad): `typeit-candidates.js`
- Modify: the `TYPE_IT = {}` line in each of the 14 games

- [ ] **Step 1: Write the shared loader**

Create `tests/load-games.js`:

```js
// Reads every question and the TYPE_IT map out of a game file, for tests and tools.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const GRADE5 = ['craft-corner', 'history-explorers', 'life-lab', 'page-turners', 'rally-ready', 'rise-shine', 'wikaharian'];
const GRADE2 = ['batang-bayani', 'block-bot', 'byte-buddies', 'growing-good', 'kuwentista', 'science-detectives', 'word-train'];
const FAMILY_B = ['batang-bayani', 'byte-buddies', 'growing-good', 'science-detectives', 'word-train'];
const TF = /^(true|false|tama|mali)$/i;

function sandbox() {
  return {
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    location: { search: '', pathname: '', hash: '' },
    history: {},
    genNumberlineSet() { return []; },
  };
}

function fileOf(app) {
  return GRADE5.includes(app) ? path.join(root, app + '.html') : path.join(root, 'grade 2', app + '.html');
}

function loadLessons(app, html) {
  if (FAMILY_B.includes(app)) {
    const start = html.indexOf('  function shuffle(');
    const at = html.indexOf('  var lessons = [', start);
    const end = html.indexOf('\n  ];', at);
    return vm.runInNewContext(html.slice(start, end + 5) + '\nlessons', sandbox());
  }
  const at = html.indexOf('\nconst LESSONS = [');
  const helpers = html.indexOf('\nconst COIN_SPECS');
  const start = GRADE5.includes(app) ? html.lastIndexOf('<script>', at) + 8 : (helpers !== -1 && helpers < at ? helpers : at);
  const end = html.indexOf('\n];', at);
  return vm.runInNewContext(html.slice(start, end + 3) + '\nLESSONS', sandbox());
}

function loadTypeIt(app, html) {
  const at = html.indexOf('TYPE_IT = {');
  if (at < 0) return null;
  const open = html.indexOf('{', at);
  if (html.slice(open, open + 2) === '{}') return {};
  const end = html.indexOf(FAMILY_B.includes(app) ? '\n  };' : '\n};', open);
  return vm.runInNewContext('(' + html.slice(open, end + (FAMILY_B.includes(app) ? 4 : 2)) + ')');
}

// Every fixed quiz question as { lesson, q, answer, tf }.
function loadGame(app) {
  const html = fs.readFileSync(fileOf(app), 'utf8');
  const questions = [];
  loadLessons(app, html).forEach((lesson, li) => {
    (lesson.quiz || []).forEach((item) => {
      if (item.type === 'tf') { questions.push({ lesson: li, q: item.q, answer: String(item.answer), tf: true }); return; }
      const options = item.options.map((o) => (typeof o === 'string' ? o : o.text));
      const correct = typeof item.correct === 'number' ? item.correct : item.options.findIndex((o) => o.correct);
      questions.push({ lesson: li, q: item.q, answer: options[correct], tf: options.length === 2 && options.every((o) => TF.test(o)) });
    });
  });
  return { questions, typeIt: loadTypeIt(app, html) };
}

module.exports = { loadGame, GRADE5, GRADE2 };
```

- [ ] **Step 2: Write the failing eligibility test**

Create `tests/typeit.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadGame, GRADE5, GRADE2 } = require('./load-games.js');
const { normalize } = require(path.join(__dirname, '..', 'grade 2', 'recall-grade2.js'));

const plain = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ');

for (const app of GRADE5.concat(GRADE2)) {
  test(app + ': every typed question is real and can be answered without the choices', () => {
    const { questions, typeIt } = loadGame(app);
    assert.ok(typeIt, 'TYPE_IT map present');
    assert.ok(Object.keys(typeIt).length >= 1, 'at least one typed question, so the e2e recall check can type');
    const byStem = new Map(questions.map((q) => [q.q, q]));
    for (const [stem, accept] of Object.entries(typeIt)) {
      const q = byStem.get(stem);
      const where = `${app}: "${stem}"`;
      assert.ok(q, `${where} is not a stem in this game`);
      assert.ok(Array.isArray(accept), `${where}: value must be an array of other accepted answers`);
      assert.ok(!q.tf, `${where}: True/False cannot be typed`);
      assert.doesNotMatch(stem, /which of (these|the following)|alin sa mga/i, `${where}: needs the choices`);
      assert.doesNotMatch(stem, /\bNOT\b|\bHINDI\b/, `${where}: a NOT question needs the choices`);
      const words = normalize(plain(q.answer)).split(' ').filter(Boolean);
      assert.ok(words.length >= 1 && words.length <= 3, `${where}: answer "${q.answer}" is not 1-3 words`);
      for (const alt of accept) assert.ok(normalize(alt), `${where}: empty accepted answer`);
    }
  });
}
```

Run: `node --test tests/typeit.test.js`
Expected: FAIL on each game with `at least one typed question`.

- [ ] **Step 3: List the candidates**

Save as `<scratchpad>/typeit-candidates.js`:

```js
const path = require('path');
const repo = process.argv[2];
const { loadGame, GRADE5, GRADE2 } = require(path.join(repo, 'tests', 'load-games.js'));
const { normalize } = require(path.join(repo, 'grade 2', 'recall-grade2.js'));
const plain = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ');

for (const app of GRADE5.concat(GRADE2)) {
  const { questions } = loadGame(app);
  console.log('\n=== ' + app);
  questions.filter((q) => !q.tf && !/which of (these|the following)|alin sa mga/i.test(q.q) && !/\bNOT\b|\bHINDI\b/.test(q.q))
    .filter((q) => { const n = normalize(plain(q.answer)).split(' ').filter(Boolean).length; return n >= 1 && n <= 3; })
    .forEach((q) => console.log('  [L' + (q.lesson + 1) + '] ' + JSON.stringify(q.q) + '  =>  ' + q.answer));
}
```

Run: `node "<scratchpad>/typeit-candidates.js" "C:/Users/ADMIN/IdeaProjects/school" > "<scratchpad>/typeit-candidates.txt"`

- [ ] **Step 4: Pick the typed questions in each game**

Go through each game's candidates. Keep a question **only if** a child who knows the lesson could type exactly this answer with no choices showing. Typical keeps:
- a definition that asks for its term ("What do you call…?" → INSOMNIA);
- a "who/what is…" naming question (→ Bathala);
- a single number answer (Block Bot: "How much money is this?" → `₱75` is fine, since digits match exactly).

**Drop** a candidate when any of these is true:
- more than one answer would be right without the choices;
- the answer is a behaviour or opinion ("What should you do…");
- the stem already contains the answer word;
- the stem quotes a sentence and asks which word in it is the answer, where several words could fit;
- the answer depends on a picture plus options together.

When in doubt, drop it. Aim for 2–4 per lesson where good ones exist; a lesson may have none.

For each kept question, list other spellings she might fairly type:
- singular or plural (`root` for `roots`);
- with or without a hyphen when normalizing doesn't already merge them (`lapulapu` for `Lapu-Lapu`);
- the English name the deck itself also uses.

Don't add answers the lesson doesn't teach.

Replace each game's `TYPE_IT = {};` with the map. Use the exact stem string from the candidate list; its `JSON.stringify` form is a valid JS key. Grade 5 / family A form:

```js
const TYPE_IT = {
  "What do you call trouble falling or staying asleep?": [],
  "Who is the highest god of the Tagalog?": ["Bathala Maykapal"],
};
```

Family B form (two-space indent, `var`, inside the IIFE):

```js
  var TYPE_IT = {
    "What is the opposite of hot?": [],
  };
```

Keep `TYPE_IT` free of comments. In Grade 5 / family A files the comment line the wiring script added stays above it.

- [ ] **Step 5: Run the tests and check they pass**

Run: `node --test`
Expected: PASS. If an entry fails with "is not a stem in this game", copy the stem again from `typeit-candidates.txt`; entities like `&rsquo;` must match the source exactly.

- [ ] **Step 6: Report the picks to the user**

List per game how many typed questions were chosen, and show 3 examples each, before moving on. These are content choices the parent may want to adjust.

- [ ] **Step 7: Suggest a commit message**

```
feat: choose type-it-first questions in every game
```

---

### Task 8: Lobby: real test score form, history lines, shop bonus

**Files:**
- Modify: `lobby-grade5.html` and `grade 2/lobby.html`. Make identical edits to both, because the copies test compares their shop scripts and Parent panel scripts.
- Modify: `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`

- [ ] **Step 1: Write the failing lobby e2e**

In `tests/e2e/lobby-driver.page.js`, insert this immediately before `  if (mode === 'nojs') {`:

```js
  if (mode === 'testscore') {
    $('parent-open').click();
    press('0108');
    r.shown = !$('test-score').hidden;
    r.subjects = $('ts-subject').options.length;
    var fill = function (name, score, total) {
      $('ts-name').value = name;
      $('ts-score').value = score;
      $('ts-total').value = total;
      $('ts-total').dispatchEvent(new Event('input'));
    };
    fill('Science ST1', '14', '15');
    r.preview = $('ts-add').textContent;
    $('ts-add').click();
    r.bonusAfterFirst = wallet().bonus;
    r.listed = /📝 Real test · .* · Science ST1 — 14\/15 · \+40 coins/.test($('hist-list').textContent);
    fill('science st1', '15', '15');
    $('ts-add').click();
    r.dupWarning = $('ts-msg').textContent;
    r.bonusAfterWarn = wallet().bonus;
    $('ts-add').click();
    r.bonusAfterSecond = wallet().bonus;
    fill('Bad', '16', '15');
    r.badDisabled = $('ts-add').disabled;
    r.entries = JSON.parse(localStorage.getItem(KEY)).entries.filter(function (e) { return e.type === 'test'; }).length;
    r.shopEarned = $('shop-earned').textContent;
    return out(r);
  }
```

In `tests/e2e/lobby-e2e.js`, insert this immediately before the line `  const n = readOutput(dumpDom(path.join(work, 'profile-nojs')`:

```js
  const t = readOutput(dumpDom(path.join(work, 'profile-testscore'), path.join(withJs, 'lobby.html'), '#e2e=testscore'));
  assert.deepEqual(t.errors, [], 'test score: page errors');
  assert.equal(t.shown, true, 'the test score form shows when the wallet is there');
  assert.ok(t.subjects > 0, 'subjects come from the lobby cards');
  assert.equal(t.preview, 'Add 40 coins', '14/15 previews 40 coins');
  assert.equal(t.bonusAfterFirst, 40);
  assert.equal(t.listed, true, 'the Parent panel lists the test');
  assert.match(t.dupWarning, /Already added on .*Tap Add again/);
  assert.equal(t.bonusAfterWarn, 40, 'the warning tap adds nothing');
  assert.equal(t.bonusAfterSecond, 90, 'the second tap adds 50 for a perfect score');
  assert.equal(t.badDisabled, true, 'a score above the total cannot be added');
  assert.equal(t.entries, 2);
  assert.match(t.shopEarned, /📝 90 test bonus/, 'the shop shows the bonus');
```

Run: `node tests/e2e/lobby-e2e.js 5`
Expected: FAIL. `$('test-score')` is null, so the page reports an error.

- [ ] **Step 2: Add the form markup (both lobbies)**

In each lobby, insert this immediately before the `<div class="p-section">` that contains `<h3>Backup</h3>`:

```html
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

```

- [ ] **Step 3: Shop bonus line (both lobbies)**

In each lobby's first inline script (`window.SHOP_TEXT`), the `earned:` line becomes:

```js
  earned: function(pts, coins, welcome, spent, bonus){ return '⭐ ' + pts + ' new points → 🪙 ' + coins + ' coins · 🎁 ' + welcome + ' welcome' + (bonus ? ' · 📝 ' + bonus + ' test bonus' : '') + ' · 🛒 ' + spent + ' spent'; },
```

In each lobby's `<script data-shop>`:
- `$('shop-earned').textContent = T.earned(e.points, e.coins, e.welcome, e.spent);` becomes:

  ```js
      $('shop-earned').textContent = T.earned(e.points, e.coins, e.welcome, e.spent, e.bonus);
  ```

- Immediately after the line `  renderList();` that's followed by `  $('coin-row').hidden = false;`, add:

  ```js
    W.refreshShop = renderList;
  ```

The existing lobby e2e expects `earned` text without a bonus. That still holds, because the bonus part only appears when the bonus is above 0.

- [ ] **Step 4: Parent panel script (both lobbies, identical)**

In the Parent panel script (the last `<script>` in each lobby):

(a) After the `function helpsText(e){ … }` block, add:

```js
  function typedText(e){ return e.typed ? ' · ✏️ ' + e.typed + ' typed' : ''; }
```

(b) In `describe(e)`, after the `if (e.type === 'purchase') return …;` line, add:

```js
    if (e.type === 'test') return '📝 Real test · ' + subject + ' · ' + e.testName + ' — ' + e.score + '/' + e.total + ' · +' + e.coins + ' coins';
```

and change both occurrences of `+ helpsText(e);` in `describe` to `+ helpsText(e) + typedText(e);`.

(c) After the `function fmtDate(key){ … }` block, add:

```js
  var W = window.Wallet, tsRepeat = null;
  function tsValues(){
    var name = $('ts-name').value.trim(), scoreText = $('ts-score').value, totalText = $('ts-total').value;
    var score = Number(scoreText), total = Number(totalText);
    if (!name || scoreText === '' || totalText === '' || !Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) return null;
    return { app: $('ts-subject').value, name: name, score: score, total: total, coins: W.testBonus(score, total) };
  }
  function tsPreview(){
    tsRepeat = null;
    var v = tsValues();
    $('ts-add').disabled = !v;
    $('ts-add').textContent = v ? 'Add ' + v.coins + ' coins' : 'Add coins';
    $('ts-msg').textContent = v ? Math.floor(v.score * 100 / v.total) + '% → 🪙 ' + v.coins + ' coins' : '';
  }
  function tsAdd(){
    var v = tsValues();
    if (!v) return;
    var earlier = SH.findTest(v.app, v.name);
    if (earlier && tsRepeat !== earlier.id){
      tsRepeat = earlier.id;
      $('ts-msg').textContent = 'Already added on ' + fmtDate(SH.dateKey(earlier.t)) + '. Tap Add again to add it again.';
      return;
    }
    if (!W.addBonus(v.coins)){ $('ts-msg').textContent = 'Could not save. Storage may be full.'; return; }
    SH.testScore(v.app, subjectOf(v.app), v.name, v.score, v.total, v.coins);
    if (W.refreshShop) W.refreshShop();
    if (W.renderCoins) W.renderCoins();
    $('ts-name').value = '';
    $('ts-score').value = '';
    $('ts-total').value = '';
    tsPreview();
    $('ts-msg').textContent = '✅ Added 🪙 ' + v.coins + ' coins for ' + v.name + '.';
    renderHistory();
  }
```

(d) Inside the existing `document.querySelectorAll('.subject-card').forEach(function(card){ … })` loop, after `$('subject-filter').appendChild(opt);`, add:

```js
    var tsOpt = el('option', '', subjectByApp[app]);
    tsOpt.value = app;
    $('ts-subject').appendChild(tsOpt);
```

(e) After the line `$('parent-open').addEventListener('click', openParent);`, add:

```js
  $('test-score').hidden = !(W && W.addBonus && W.testBonus);
  ['ts-name', 'ts-score', 'ts-total'].forEach(function(id){ $(id).addEventListener('input', tsPreview); });
  $('ts-subject').addEventListener('change', tsPreview);
  $('ts-add').addEventListener('click', tsAdd);
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/copies.test.js`, then `node tests/e2e/lobby-e2e.js 2` and `node tests/e2e/lobby-e2e.js 5`
Expected: PASS in all three. A copies failure means the two lobbies' Parent panel or shop scripts differ; diff them and make them identical.

- [ ] **Step 6: Suggest a commit message**

```
feat: let a parent turn a real test score into coins in the lobby
```

---

### Task 9: Apps e2e: exam pays 20, and the recall mode

**Files:**
- Modify: `tests/e2e/driver-common.page.js`, `tests/e2e/driver-family-a.page.js`, `tests/e2e/driver-family-b.page.js`, `tests/e2e/driver-family-c.page.js`, `tests/e2e/apps-e2e.js`

- [ ] **Step 1: Assert exam points in the existing play check**

In `tests/e2e/apps-e2e.js` `checkPlay`, after `assert.equal(final.correct, x.finalTotal);`, add:

```js
  assert.equal(final.points, 20 * x.finalTotal + 5 * Math.max(0, x.finalTotal - 2), 'the mock exam pays 20 a question');
```

- [ ] **Step 2: Add the recall driver**

Append to `tests/e2e/driver-common.page.js`:

```js
function __e2eTypedLesson(list) {
  for (var i = 0; i < list.length; i++) {
    if ((list[i].quiz || []).some(function (q) { return Object.prototype.hasOwnProperty.call(TYPE_IT, q.q); })) return i;
  }
  return 0;
}

// typed: 'right' or 'wrong' types into each typing box; null taps Show choices instead.
function __e2eRecallRound(start, next, typed) {
  start();
  var n = currentQuizSet.length, r = { resting: 0, bars: 0, typedBoxes: 0 };
  for (var k = 0; k < n; k++) {
    Array.prototype.forEach.call(document.querySelectorAll('.recall-note'), function (e) { if (e.textContent.indexOf('⏳') >= 0) r.resting++; });
    if (__e2eVisible('.pu-bar')) r.bars++;
    var box = document.querySelector('.recall-type'), done = false;
    if (box) {
      r.typedBoxes++;
      if (typed) {
        box.querySelector('input').value = typed === 'right' ? box.nextElementSibling.querySelectorAll('button')[__e2eRightIdx()].textContent : 'zzzz';
        box.querySelector('.recall-check').click();
        done = typed === 'right';
      } else {
        box.querySelector('.recall-show').click();
      }
    }
    if (!done) __e2eAnswer(true);
    next();
  }
  var quizzes = __e2eHistory().filter(function (e) { return e.type === 'quiz'; });
  var last = quizzes[quizzes.length - 1];
  r.total = last.total;
  r.score = last.correct;
  r.points = last.points;
  r.typedLogged = last.typed || 0;
  r.resultText = document.getElementById('points-earned').textContent;
  return r;
}

function __e2eRecall(startLesson, next, startExam) {
  var key = __E2E_KEY.replace('_history_v1', '_recall_v1');
  var r = {};
  r.first = __e2eRecallRound(startLesson, next, 'wrong');
  r.second = __e2eRecallRound(startLesson, next, 'wrong');
  var store = JSON.parse(localStorage.getItem(key));
  var d = new Date();
  d.setDate(d.getDate() - 3);
  var back = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  Object.keys(store.rest).forEach(function (k) { store.rest[k] = back; });
  localStorage.setItem(key, JSON.stringify(store));
  r.third = __e2eRecallRound(startLesson, next, 'right');
  r.exam = __e2eRecallRound(startExam, next, null);
  __e2eOut({ recall: r, hasRecall: !!window.Recall });
}
```

- [ ] **Step 3: Hook the mode into each family driver**

In each family driver's `__e2eRun`, add this line right after the `powerups3` line.

`driver-family-a.page.js` and `driver-family-c.page.js`:

```js
  if (mode === 'recall') return __e2eRecall(function () { currentLessonIdx = __e2eTypedLesson(LESSONS); startQuiz(); }, nextQuestion, startFinalExam);
```

`driver-family-b.page.js`:

```js
  if (mode === 'recall') return __e2eRecall(function () { currentLesson = __e2eTypedLesson(lessons); startQuiz(); }, function () { document.getElementById('btn-next').click(); }, startFinalExam);
```

- [ ] **Step 4: Add the runner and check**

In `tests/e2e/apps-e2e.js`:

(a) After the `checkNoJs` function, add:

```js
function checkRecall(app, out) {
  assert.deepEqual(out.errors, [], 'recall: page errors');
  assert.equal(out.hasRecall, true, 'recall file loaded');
  const { first, second, third, exam } = out.recall;
  const perfect = (base, n) => base * n + 5 * Math.max(0, n - 2);
  assert.equal(first.score, first.total);
  assert.equal(first.resting, 0, 'nothing rests on the first round');
  assert.equal(first.points, perfect(10, first.total), 'a wrong typed guess, then the right pick, pays normally');
  assert.equal(second.resting, second.total, 'every question rests on the same day');
  assert.equal(second.points, 0, 'a resting round pays nothing');
  assert.equal(second.score, second.total, 'but still counts for the score');
  assert.equal(second.bars, 0, 'no power-up bar on a resting question');
  assert.match(second.resultText, /⏳/, 'the results screen says questions were resting');
  assert.ok(third.typedBoxes > 0, 'the chosen lesson has a typed question');
  assert.equal(third.resting, 0, '3 days later every question pays again');
  assert.equal(third.points, perfect(10, third.total) + 5 * third.typedBoxes, 'typed answers add 5 each');
  assert.equal(third.typedLogged, third.typedBoxes, 'history counts typed answers');
  assert.equal(exam.points, perfect(20, exam.total), 'the mock exam pays 20 a question');
  console.log('  recall: typed ' + third.typedBoxes + ', exam ' + exam.points + ' pts');
}
```

(b) After the four `fs.copyFileSync(…, path.join(withJs, …))` lines, add:

```js
const recallFile = grade === 5 ? 'recall.js' : 'recall-grade2.js';
const withRecall = path.join(work, 'with-recall');
fs.mkdirSync(withRecall);
[shFile, walletFile, fxFile, puFile, recallFile].forEach((f) => fs.copyFileSync(path.join(dir, f), path.join(withRecall, f)));
```

(c) In the loop, after `fs.writeFileSync(path.join(noJs, app.file), html);`, add:

```js
  if (app.family !== 'math') fs.writeFileSync(path.join(withRecall, app.file), html);
```

and after the `checkPowerUps3(…)` line, add:

```js
    if (app.family !== 'math') checkRecall(app, readOutput(dumpDom(path.join(work, 'profile-recall-' + app.slug), path.join(withRecall, app.file), '#e2e=recall')));
```

- [ ] **Step 5: Run e2e twice per grade**

Run `node tests/e2e/apps-e2e.js 2` twice and `node tests/e2e/apps-e2e.js 5` twice.
Expected: every app PASSes each time.

- [ ] **Step 6: If something fails, find the cause before changing anything**

- A `second.resting` short by one in Block Bot can mean two generated number-line questions share a stem. Check the failing round's stems before changing anything.
- A typed-points mismatch usually means `right.textContent` differs from the stored answer, for example because of extra markup inside the option button. Fix the `TYPE_IT` accept list, or the button text source, not the assertion.

- [ ] **Step 7: Suggest a commit message**

```
test: cover resting questions, typed answers and double-pay exams end to end
```

---

### Task 10: Final check and docs

- [ ] **Step 1: Run everything**

Run: `node --test`, then `node tests/e2e/apps-e2e.js 2`, `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/lobby-e2e.js 2` and `node tests/e2e/lobby-e2e.js 5`.
Expected: all PASS.

- [ ] **Step 2: Check one game by hand in a browser**

Open `life-lab.html` directly, play lesson 1 perfectly, then again.
- The second round shows `⏳ Resting…` notes and `+0`, with no power-up bar.
- A `✏️` box appears on typed questions.
- Typing the answer marks it right with `+5`.

Then open `grade 2/word-train.html` and check that the Grade 2 copy reads Filipino · English.

- [ ] **Step 3: Update the spec's rollout note**

In `docs/superpowers/specs/2026-10-01-anti-memorization-design.md` → "Rollout notes", add one line listing the files to copy to each tablet:
- **Grade 5 tablet:** `recall.js`, `wallet.js`, `study-history.js`, `powerups.js`, both lobbies' changes and every game;
- **Grade 2 tablet:** the `grade 2/` equivalents.

- [ ] **Step 4: Suggest the final commit message**

```
feat: fair points (resting questions, type it first, double-pay exams, real test bonus)
```

---

## Self-review notes

Each spec requirement maps to a task:
- **Rest rule:** Tasks 1, 3 and 6.
- **No power-ups on resting questions:** Tasks 2 and 3.
- **Math Mastery exempt:** Task 6, plus its test.
- **Typing box and matching:** Tasks 1 and 3.
- **Which questions can be typed:** Task 7.
- **Typed count in the history:** Tasks 5 and 6.
- **Exam pays 20:** Tasks 6 and 9.
- **Test bonus:** Tasks 4, 5 and 8.
- **Coin guide:** Task 4.
- **Copies:** Tasks 2–5.
- **E2E:** Tasks 8 and 9.

Names used across tasks are consistent:
- recall core: `Recall.ask`, `Recall.points(helped, ptsBase, ptsBonus)`, `Recall.typed()`, `Recall.resultLine()`;
- powerups and wallet: `PowerUps.skip()`, `W.testBonus`, `W.addBonus`, `W.refreshShop`;
- history: `SH.testScore`, `SH.findTest`.
