# Term 2 Study Loft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A term tag on lessons, game pages that show one term on `?term=1|2` (and a Term 2 exam on `&exam=1`), and a
ladder in My Room up to a Study Loft with a desk per subject and an Exam Corner, plus an Old lessons bookcase downstairs.

**Architecture:** The engine (`study-kit.js`) reads `?term=` once when it loads and filters `StudyKit.lessons()`; every
game already builds its home, lesson path, search and final exam from that list, so the 16 file-based games need no
edits and Math Mastery needs one line. Recall, Mastery and the final-exam score are made term-safe inside the engine.
In the world, `room.js` reserves the ladder and bookcase squares, a pure `loft.js` lays out the loft and its desks, a
`loft3d.js` draws it, `term-lessons.js` (generated) says which games have Term 2 lessons, and `world-main.js` wires
climb, desks, Exam Corner and Old lessons through the existing portal.

**Tech Stack:** Plain ES5 browser JS in IIFEs, Three.js (vendored), `node --test`, headless-Chrome e2e scripts.

Spec: `docs/superpowers/specs/2026-11-07-term-2-study-loft-design.md`.

**Owner rules (apply to every task):**
- Never run `git commit`. Each task ends with the commit command for the owner, in the form
  `git add <files> && git commit -m '...' -- <files>`. No `Co-Authored-By`, no `Claude-Session`, no AI attribution.
- ES5 only in `web/` (no `let`, `const`, arrow functions or template strings). Tests and tools are Node and may use ES2020.
- Comments only for non-obvious code.
- Grade 2 sentences pair "Filipino · English"; buttons are English only.
- After adding a file under `web/`, run `node tools/update-precache.js`. After adding a file to `web/world/`, add it to
  `tools/world-manifest.json` and run `node tools/update-world-pages.js`.

## File map

| File | Change | Job |
| --- | --- | --- |
| `web/engine/study-kit.js` | modify | `viewOf`, `pick`; `StudyKit.lessons()` filtered, `all()`, `term()`, `examView()`; term-safe final score; `?reset=1` keeps `term=` |
| `web/engine/recall.js` | modify | `partialList` (pure); tidy keeps every box in a term view |
| `web/engine/mastery.js` | modify | `update(app, lessons, { keep })` keeps the other lessons' order |
| `web/engine/trail.js` | modify | `&exam=1` opens the final exam |
| `web/engine/search.js` | modify | `termHeads` (pure); Term 1 / Term 2 headings in the full view |
| `web/subjects/grade-5/math/index.html` | modify | `ALL_LESSONS` + `StudyKit.pick` |
| `tools/lesson-files.js` | modify | `termCounts`, `termSource`, `TERM_OUT` |
| `tools/update-precache.js` | modify | writes `web/world/term-lessons.js` |
| `web/world/term-lessons.js` | create (generated) | `World3D.TermLessons` |
| `web/world/room.js` | modify | `LADDER(size)`, `SHELF(size)`, reserved squares |
| `web/world/loft.js` | create | Loft layout, desks, items, solids, URLs (pure) |
| `web/world/room3d.js` | modify | draws the ladder and the bookcase |
| `web/world/loft3d.js` | create | draws the loft |
| `web/world/text.js` | modify | loft words |
| `web/world/world-main.js` | modify | climb, loft items, desks, Exam Corner, Old lessons, debug hooks |
| `tools/world-manifest.json` | modify | `term-lessons.js`, `loft.js`, `loft3d.js` |
| tests | create/modify | see each task |
| `docs/HANDOFF.md`, `README.md`, `docs/world-modules.md` | modify | record the feature |

---

### Task 1: StudyKit term view

**Files:**
- Modify: `web/engine/study-kit.js`
- Test: `tests/study-kit.test.js`

- [ ] **Step 1: Write the failing tests** (append to `tests/study-kit.test.js`)

```js
const { viewOf, pick } = require(engineFile('study-kit.js'));

test('viewOf reads ?term=1|2, and &exam=1 only with a term', () => {
  assert.deepEqual(viewOf(''), { term: null, exam: false });
  assert.deepEqual(viewOf('?term=2'), { term: 2, exam: false });
  assert.deepEqual(viewOf('?reset=1&term=1&embed=1'), { term: 1, exam: false });
  assert.deepEqual(viewOf('?term=2&exam=1'), { term: 2, exam: true });
  assert.deepEqual(viewOf('?exam=1'), { term: null, exam: false });
  assert.deepEqual(viewOf('?term=3'), { term: null, exam: false });
});

test('pick: no term shows every lesson; a term view shows its lessons, exam-only ones only in the exam view', () => {
  const ls = [{ id: 'a' }, { id: 'b', term: 2 }, { id: 'c', term: 2, exam: true }, { id: 'd', term: 1 }];
  assert.deepEqual(pick(ls, null, false).map((l) => l.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(pick(ls, 1, false).map((l) => l.id), ['a', 'd']);
  assert.deepEqual(pick(ls, 2, false).map((l) => l.id), ['b']);
  assert.deepEqual(pick(ls, 2, true).map((l) => l.id), ['b', 'c']);
});

test('a term view keeps its own final-exam best and leaves the both-terms best alone', () => {
  const { kit, root } = page({ search: '?term=2', stored: { riseshine_progress_v1: JSON.stringify({ final: 30, l1: 4, 'final-t2': 8 }), riseshine_progress_v1_day: '2026-10-2' } });
  const p = kit.progress();
  assert.equal(p.final, 8, 'the Term 2 best shows as final');
  assert.equal(p.l1, 4, 'lesson stars are shared');
  p.final = 12;
  kit.saveProgress(p);
  assert.deepEqual(JSON.parse(root.localStorage.data.riseshine_progress_v1), { final: 30, l1: 4, 'final-t2': 12 });
});

test('a term view with no Term 2 best yet starts with none', () => {
  const { kit, root } = page({ search: '?term=2', stored: { riseshine_progress_v1: JSON.stringify({ final: 30 }), riseshine_progress_v1_day: '2026-10-2' } });
  const p = kit.progress();
  assert.equal(p.final, undefined);
  kit.saveProgress(p);
  assert.deepEqual(JSON.parse(root.localStorage.data.riseshine_progress_v1), { final: 30 });
});

test('?reset=1 keeps term= in the address, drops exam=', () => {
  const { log } = page({ search: '?reset=1&term=2&exam=1' });
  assert.deepEqual(log.filter((l) => l[0] === 'replaceState'), [['replaceState', '/school/subjects/grade-5/gmrc/index.html?term=2#top']]);
  const { log: log2 } = page({ search: '?reset=1&embed=1&term=1' });
  assert.deepEqual(log2.filter((l) => l[0] === 'replaceState'), [['replaceState', '/school/subjects/grade-5/gmrc/index.html?embed=1&term=1#top']]);
});

test('library().lessons(view) filters, all() does not', () => {
  const { library } = require(engineFile('study-kit.js'));
  const lib = library({ term: 2, exam: false });
  lib.lesson({ id: 'a' });
  lib.lesson({ id: 'b', term: 2 });
  assert.deepEqual(lib.lessons().map((l) => l.id), ['b']);
  assert.deepEqual(lib.all().map((l) => l.id), ['a', 'b']);
});
```

Check the date key the fake page uses: `page()` defaults to `new Date(2026, 9, 2, 9)`, and `dayKey` gives `'2026-10-2'`, so the
stored `_day` above keeps the saved progress.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/study-kit.test.js`
Expected: FAIL (`viewOf is not a function`, and the final/replaceState tests).

- [ ] **Step 3: Implement** in `web/engine/study-kit.js`

Add after `dayKey`:

```js
  // ?term=1|2 picks the lessons a page shows; &exam=1 (with a term) opens that term's final exam.
  function viewOf(search) {
    var t = /(?:^|[?&])term=([12])(?:&|$)/.exec(search || '');
    return { term: t ? Number(t[1]) : null, exam: !!t && /(?:^|[?&])exam=1(?:&|$)/.test(search || '') };
  }

  // A lesson without term is Term 1. An exam-only lesson (summative practice) shows only in the exam view.
  function pick(list, term, examView) {
    if (!term) return list.slice();
    return list.filter(function (l) { return (l.term || 1) === term && (examView || !l.exam); });
  }
```

In `start(opts, win, now)`, right after the daily reset block, make the final score term-safe:

```js
    var search = win.location ? win.location.search : '';
    var view = viewOf(search), finalKey = view.term ? 'final-t' + view.term : null, bothFinal = progress.final;
    if (finalKey) {
      progress = Object.assign({}, progress);
      if (progress[finalKey] === undefined) delete progress.final;
      else progress.final = progress[finalKey];
      delete progress[finalKey];
    }
```

(Move the existing `var search = ...` line up to here so it is declared once.) Replace the `?reset=1` `replaceState`
call so it keeps `embed=1` and `term=`:

```js
      var keep = [];
      if (/[?&]embed=1(&|$)/.test(search)) keep.push('embed=1');
      if (view.term) keep.push('term=' + view.term);
      if (win.history && win.history.replaceState) win.history.replaceState(null, '', win.location.pathname + (keep.length ? '?' + keep.join('&') : '') + win.location.hash);
```

Replace `saveProgress`:

```js
      saveProgress: function (p) {
        progress = p;
        var out = p;
        if (finalKey) {
          out = Object.assign({}, p);
          if (p.final !== undefined) out[finalKey] = p.final;
          if (bothFinal === undefined) delete out.final;
          else out.final = bothFinal;
        }
        set(opts.progressKey, JSON.stringify(out));
      },
```

Change `library` to take the view:

```js
  function library(view) {
    var lessons = [], content = {}, v = view || { term: null, exam: false };
    return {
      lesson: function (l) { lessons.push(l); },
      lessons: function () { return pick(lessons, v.term, v.exam); },
      all: function () { return lessons.slice(); },
      content: function (name, value) {
        if (arguments.length > 1) content[name] = value;
        return content[name];
      }
    };
  }
```

Export and the browser object (the view is read when the script loads, before `StudyKit.start` can drop the address):

```js
  var exported = { start: start, library: library, viewOf: viewOf, pick: pick, RULES: RULES };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  var VIEW = viewOf(root.location ? root.location.search : '');
  var lib = library(VIEW);
  root.StudyKit = {
    RULES: RULES,
    start: function (opts) { return start(opts, root, function () { return new Date(); }); },
    lesson: lib.lesson,
    lessons: lib.lessons,
    all: lib.all,
    pick: function (list) { return pick(list, VIEW.term, VIEW.exam); },
    term: function () { return VIEW.term; },
    examView: function () { return VIEW.exam; },
    content: lib.content
  };
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/study-kit.test.js`
Expected: PASS (the existing `?reset=1` tests keep passing: no `term=` means the same address as before).

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/engine/study-kit.js tests/study-kit.test.js && git commit -m 'StudyKit term view: ?term=1|2 filters the lessons, &exam=1 marks the exam view, a per-term final best, ?reset=1 keeps term=' -- web/engine/study-kit.js tests/study-kit.test.js
```

---

### Task 2: Review boxes and medals stay safe in a term view

**Files:**
- Modify: `web/engine/recall.js` (browser `core.tidy` wrapper, about line 537), `web/engine/mastery.js` (`update`, about line 158, and the browser part near line 28)
- Test: `tests/recall.test.js`, `tests/mastery.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/recall.test.js`:

```js
const { partialList } = require(engineFile('recall.js'));

test('partialList: tidy keeps every box when a lesson file failed or the page shows one term', () => {
  assert.equal(partialList(10, 10, null), false);
  assert.equal(partialList(9, 10, null), true);
  assert.equal(partialList(3, 10, 2), true);
  assert.equal(partialList(10, 10, 1), true);
});
```

(If `engineFile` is not imported at the top of `tests/recall.test.js`, import it from `./paths.js` the way the file
already imports the engine.)

Append to `tests/mastery.test.js`:

```js
test('keep: a term view updates its lessons and keeps the others in their place', () => {
  const s = memory({ review_v1: boxes({ a: 4, b: 4, c: 2 }) });
  const m = create(s, now, 'grade5');
  m.update('life-lab', [lesson('l1', ['a']), lesson('l2', ['b']), lesson('l3', ['c'])]);
  m.update('life-lab', [lesson('l3', ['c'])], { keep: true });
  assert.deepEqual(saved(s).apps['life-lab'].order, ['l1', 'l2', 'l3']);
  assert.equal(counts(saved(s).apps['life-lab']).total, 3);
});

test('without keep, a shorter list still drops the missing lessons from the order (unchanged)', () => {
  const s = memory({ review_v1: boxes({ a: 4, c: 2 }) });
  const m = create(s, now, 'grade5');
  m.update('life-lab', [lesson('l1', ['a']), lesson('l3', ['c'])]);
  m.update('life-lab', [lesson('l3', ['c'])]);
  assert.deepEqual(saved(s).apps['life-lab'].order, ['l3']);
});
```

Check `review_v1` keys: `levelOf(items, keys)` reads `items[key]`, so the keys passed to `lesson()` are the item names
used in `boxes()` (as in the existing tests).

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/recall.test.js tests/mastery.test.js`
Expected: FAIL (`partialList is not a function`; keep order is `['l3']`).

- [ ] **Step 3: Implement**

`web/engine/recall.js`: add near `keyOf`/`renamesOf` (pure section):

```js
  // Tidy may drop boxes only when the page holds every lesson: none failed to load and no ?term= view.
  function partialList(listLength, tags, term) { return listLength < tags || !!term; }
```

Use it in the browser `core.tidy` wrapper:

```js
    core.tidy = function (app, questions, info, entries) {
      var tags = doc.querySelectorAll('script[src*="lessons/"]').length;
      var SK = win.StudyKit, list = SK && SK.all ? SK.all() : null, term = SK && SK.term ? SK.term() : null;
      return tidy(app, questions, info, entries, partialList(list ? list.length : tags, tags, term), list ? renamesOf(list) : null);
    };
```

and add `partialList: partialList` to `exported`.

`web/engine/mastery.js`: change the signature to `update: function (app, lessons, opt) {` and, right after the
`Object.keys(old).forEach(...)` loop and before `var prev = state.apps[app]`, add:

```js
        var before = state.apps[app];
        if (opt && opt.keep && isObj(before) && Array.isArray(before.order)) {
          var mine = entry.order;
          entry.order = before.order.filter(function (id, i) { return before.order.indexOf(id) === i && has(entry.lessons, id); })
            .concat(mine.filter(function (id) { return before.order.indexOf(id) < 0; }));
        }
```

In the browser part, where the object built by `create(...)` becomes `root.Mastery`, wrap `update` so a term view
passes `keep`:

```js
    var plainUpdate = api.update;
    api.update = function (app, lessons) {
      var SK = root.StudyKit;
      return plainUpdate(app, lessons, { keep: !!(SK && SK.term && SK.term()) });
    };
```

(`api` is the name used at about line 28; if `mountUi` returns a different object, wrap `update` on the object that is
assigned to `root.Mastery`.)

- [ ] **Step 4: Run to see them pass**

Run: `node --test tests/recall.test.js tests/mastery.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/engine/recall.js web/engine/mastery.js tests/recall.test.js tests/mastery.test.js && git commit -m 'A term view never drops review boxes or medals of the other term' -- web/engine/recall.js web/engine/mastery.js tests/recall.test.js tests/mastery.test.js
```

---

### Task 3: Exam view opens the final exam; Term headings in the full view

**Files:**
- Modify: `web/engine/trail.js` (browser `start`, about line 272), `web/engine/search.js`
- Test: `tests/search.test.js`

- [ ] **Step 1: Write the failing test** (append to `tests/search.test.js`)

```js
const { termHeads } = require(engineFile('search.js'));

test('termHeads: headings only when a Term 2 lesson exists, Term 1 above the first lesson, Term 2 above its first', () => {
  assert.deepEqual(termHeads([{}, {}, {}]), []);
  assert.deepEqual(termHeads([{}, { term: 1 }, { term: 2 }, { term: 2 }]), [{ before: 0, term: 1 }, { before: 2, term: 2 }]);
  assert.deepEqual(termHeads([{ term: 2 }, { term: 2 }]), [{ before: 0, term: 2 }]);
});
```

(Import `engineFile` from `./paths.js` if the file does not already.)

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/search.test.js`
Expected: FAIL (`termHeads is not a function`).

- [ ] **Step 3: Implement**

`web/engine/search.js`: add words to both `TEXT` grades:

```js
      term1: '📘 Term 1', term2: '🌟 Term 2 · New'
```

for `grade5`, and for `grade2`:

```js
      term1: '📘 Unang Termino · Term 1', term2: '🌟 Ikalawang Termino, bago · Term 2 · New'
```

Add the pure helper after `find`:

```js
  // Where the Term headings go in a page that shows both terms: [{ before: lesson index, term }].
  function termHeads(lessons) {
    var first2 = -1;
    for (var i = 0; i < lessons.length; i++) if (lessons[i] && lessons[i].term === 2) { first2 = i; break; }
    if (first2 < 0) return [];
    return first2 === 0 ? [{ before: 0, term: 2 }] : [{ before: 0, term: 1 }, { before: first2, term: 2 }];
  }
```

Inside `create`, keep the plan in `start` and place the headings at the end of `apply()`:

```js
    var heads = [];
    function placeHeads() {
      var want = input && input.value ? [] : heads;
      Array.prototype.slice.call(list.querySelectorAll('.lterm')).forEach(function (h) {
        var ok = want.some(function (w) {
          var next = h.nextElementSibling;
          return h.getAttribute('data-term') === String(w.term) && next && next.getAttribute('data-search-lesson') === String(w.before);
        });
        if (!ok) h.parentNode.removeChild(h);
      });
      want.forEach(function (w) {
        var card = list.querySelector('[data-search-lesson="' + w.before + '"]');
        if (!card || card.parentNode !== list) return;
        var prev = card.previousElementSibling;
        if (prev && prev.classList.contains('lterm') && prev.getAttribute('data-term') === String(w.term)) return;
        var h = doc.createElement('h3');
        h.className = 'lterm';
        h.setAttribute('data-term', String(w.term));
        h.textContent = w.term === 2 ? t.term2 : t.term1;
        list.insertBefore(h, card);
      });
    }
```

Call `placeHeads()` as the last line of `apply()`. In `start(opts)`, before `build()`:

```js
      heads = win.StudyKit && win.StudyKit.term && win.StudyKit.term() ? [] : termHeads(opts.lessons);
```

Add to `CSS`: `.lterm{margin:14px 4px 6px;font-size:1.05rem;font-weight:800;}` and export `termHeads` in `exported`.
A heading carries no `data-search-lesson`, so the search's own card loop already leaves it alone and `cardsOf()`
callers that look for lessons skip it. Inserting a heading fires the list's `MutationObserver` once more; the second
`apply()` finds every heading in place and changes nothing, so it does not loop.

`web/engine/trail.js`, browser `start(opts)`: open the exam instead of a lesson in the exam view:

```js
    function start(opts) {
      if (list || !isObj(opts)) return;
      try {
        mount(opts);
      } catch (e) {
        try { unmount(); } catch (e2) {}
      }
      var SK = win.StudyKit;
      if (o && SK && SK.examView && SK.examView()) { win.setTimeout(function () { o.final(); }, 0); return; }
      var want = list && o ? indexOfId(o.lessons, wanted) : -1;
      if (want >= 0) win.setTimeout(function () { openAt(want); }, 0);
    }
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test tests/search.test.js tests/trail.test.js tests/search-wiring.test.js tests/trail-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/engine/search.js web/engine/trail.js tests/search.test.js && git commit -m 'Game home shows Term 1 and Term 2 headings; &exam=1 opens the final exam' -- web/engine/search.js web/engine/trail.js tests/search.test.js
```

---

### Task 4: Math Mastery and the term wiring test for all 17 games

**Files:**
- Modify: `web/subjects/grade-5/math/index.html` (`const LESSONS = [` at about line 2293)
- Create: `tests/term-wiring.test.js`

- [ ] **Step 1: Write the failing test** (`tests/term-wiring.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { APPS, appFile } = require('./paths.js');

for (const a of APPS) {
  test(a.id + ' builds its lessons from the term-aware list', () => {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    const fromKit = /(?:const|var) (?:LESSONS|lessons) = StudyKit\.lessons\(\);/.test(html);
    const fromPick = /const LESSONS = StudyKit\.pick\(ALL_LESSONS\);/.test(html);
    assert.ok(fromKit || fromPick, 'LESSONS comes from StudyKit.lessons() or StudyKit.pick(ALL_LESSONS)');
    assert.ok(!/location\.search[^\n]*term=/.test(html), 'the game never reads term= itself');
  });
}

test('a lesson file that names a term puts it on its own top-level line', () => {
  for (const a of APPS) {
    const dir = path.dirname(appFile(a.id));
    const lessons = path.join(dir, 'lessons');
    if (!fs.existsSync(lessons)) continue;
    for (const f of fs.readdirSync(lessons)) {
      const src = fs.readFileSync(path.join(lessons, f), 'utf8');
      if (!/\bterm\s*:/.test(src)) continue;
      assert.match(src, /^ {2}term: [12],$/m, a.id + '/' + f + ': write "  term: 2," as its own line');
      if (/\bexam\s*:/.test(src.split('flashcards')[0])) assert.match(src, /^ {2}exam: true,$/m, a.id + '/' + f);
    }
  }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/term-wiring.test.js`
Expected: FAIL for `math-mastery` only.

- [ ] **Step 3: Implement** in `web/subjects/grade-5/math/index.html`

Rename `const LESSONS = [` to `const ALL_LESSONS = [` and, on the line after that array's closing `];`, add:

```js
const LESSONS = StudyKit.pick(ALL_LESSONS);
```

A Term 2 Math lesson later carries `term: 2,` on its own line inside its object (and `term: 2, exam: true,` for a
summative practice lesson; `tools/lesson-files.js` counts those patterns in Task 5).

- [ ] **Step 4: Run to see it pass, then the game tests**

Run: `node --test tests/term-wiring.test.js && node --test`
Expected: PASS, whole suite green.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/subjects/grade-5/math/index.html tests/term-wiring.test.js && git commit -m 'Math Mastery picks its lessons by term; a test keeps all 17 games on the term-aware list' -- web/subjects/grade-5/math/index.html tests/term-wiring.test.js
```

---

### Task 5: Generated Term 2 counts for the world

**Files:**
- Modify: `tools/lesson-files.js`, `tools/update-precache.js`, `tools/world-manifest.json`
- Create: `web/world/term-lessons.js` (generated), `tests/world3d-term-lessons.test.js`

- [ ] **Step 1: Write the failing test** (`tests/world3d-term-lessons.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { worldFile } = require('./paths.js');
const gen = require(path.join(__dirname, '..', 'tools', 'lesson-files.js'));

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'terms-'));
  const game = (g, s, id, html, files) => {
    const dir = path.join(base, g, s);
    fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'subject.json'), JSON.stringify({ id }));
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    Object.entries(files || {}).forEach(([f, src]) => fs.writeFileSync(path.join(dir, 'lessons', f), src));
  };
  game('grade-5', 'science', 'life-lab',
    '<script src="lessons/01-a.js"></script><script src="lessons/02-b.js"></script><script src="lessons/03-c.js"></script>',
    { '01-a.js': "StudyKit.lesson({\n  tag: 'Lesson 1',\n});", '02-b.js': "StudyKit.lesson({\n  term: 2,\n});", '03-c.js': "StudyKit.lesson({\n  term: 2,\n  exam: true,\n});" });
  game('grade-5', 'math', 'math-mastery', "const ALL_LESSONS = [\n  { id:'a', term: 2, title:'A' },\n  { id:'b', term: 2, exam: true },\n  { id:'c' }\n];");
  return base;
}

test('termCounts reads term: 2 and exam: true from lesson files and the inline Math list', () => {
  assert.deepEqual(gen.termCounts(fixture()), { 'life-lab': { lessons: 1, exams: 1 }, 'math-mastery': { lessons: 1, exams: 1 } });
});

test('web/world/term-lessons.js is up to date (run node tools/update-precache.js)', () => {
  assert.equal(fs.readFileSync(worldFile('term-lessons.js'), 'utf8').replace(/\r\n/g, '\n'), gen.termSource());
});

test('every one of the 17 games is listed', () => {
  assert.equal(Object.keys(require(worldFile('term-lessons.js'))).length, 17);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-term-lessons.test.js`
Expected: FAIL (`gen.termCounts is not a function`).

- [ ] **Step 3: Implement** in `tools/lesson-files.js`

```js
const TERM_OUT = path.join(WEB, 'world', 'term-lessons.js');

// How many Term 2 lessons (and exam-only Term 2 lessons) each game has, for the Study Loft's desks.
function termCounts(base = path.join(WEB, 'subjects')) {
  const out = {};
  for (const g of fs.readdirSync(base).sort()) {
    for (const s of fs.readdirSync(path.join(base, g)).sort()) {
      const dir = path.join(base, g, s);
      const json = path.join(dir, 'subject.json');
      if (!fs.existsSync(json)) continue;
      const id = JSON.parse(fs.readFileSync(json, 'utf8')).id;
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      const files = [...html.matchAll(/<script src="(lessons\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
      let lessons = 0, exams = 0;
      if (files.length) {
        for (const f of files) {
          const src = fs.readFileSync(path.join(dir, f), 'utf8');
          if (!/^\s*term:\s*2,?\s*$/m.test(src)) continue;
          if (/^\s*exam:\s*true,?\s*$/m.test(src)) exams++;
          else lessons++;
        }
      } else {
        exams = (html.match(/\bterm:\s*2,\s*exam:\s*true\b/g) || []).length;
        lessons = (html.match(/\bterm:\s*2\b/g) || []).length - exams;
      }
      out[id] = { lessons, exams };
    }
  }
  return out;
}

function termSource() {
  return '/* Made by tools/update-precache.js; do not edit. Each game\'s Term 2 lesson count (exams = summative practice\n'
    + '   lessons), which the Study Loft uses to light its desks (loft.js). */\n'
    + '(function (root) {\n'
    + "  'use strict';\n"
    + '  var TERMS = ' + JSON.stringify(termCounts(), null, 2).replace(/\n/g, '\n  ') + ';\n'
    + "  if (typeof module !== 'undefined' && module.exports) {\n"
    + '    module.exports = TERMS;\n'
    + '    return;\n'
    + '  }\n'
    + '  root.World3D = root.World3D || {};\n'
    + '  root.World3D.TermLessons = TERMS;\n'
    + '})(this);\n';
}

module.exports = { collect, source, OUT, termCounts, termSource, TERM_OUT };
```

(Replace the existing `module.exports` line.) In `tools/update-precache.js`, after
`fs.writeFileSync(lessonFiles.OUT, lessonFiles.source());` add:

```js
fs.writeFileSync(lessonFiles.TERM_OUT, lessonFiles.termSource());
```

Add `"term-lessons.js"` to the `world` list of `tools/world-manifest.json` right after `"lesson-files.js"`.

- [ ] **Step 4: Generate and run**

Run: `node tools/update-precache.js && node tools/update-world-pages.js && node --test tests/world3d-term-lessons.test.js tests/pwa.test.js tests/world3d-wiring.test.js`
Expected: PASS; `web/world/term-lessons.js` lists 17 games, all `{ lessons: 0, exams: 0 }` until Term 2 lessons land.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add tools/lesson-files.js tools/update-precache.js tools/world-manifest.json web/world/term-lessons.js web/world/grade-2.html web/world/grade-5.html web/sw.js tests/world3d-term-lessons.test.js && git commit -m 'Generate each game'"'"'s Term 2 lesson count for the world (term-lessons.js)' -- tools/lesson-files.js tools/update-precache.js tools/world-manifest.json web/world/term-lessons.js web/world/grade-2.html web/world/grade-5.html web/sw.js tests/world3d-term-lessons.test.js
```

---

### Task 6: Ladder and bookcase squares in My Room

**Files:**
- Modify: `web/world/room.js`
- Test: `tests/world3d-room.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/world3d-room.test.js`, update the existing `WALL_TAKEN` assertions:

```js
  assert.deepEqual(R.WALL_TAKEN(4), ['s1', 's2', 'w1', 'w2', 's3', 'e0', 'e1']);
  assert.deepEqual(R.WALL_TAKEN(5), ['s1', 's2', 'w1', 'w2', 's4', 'e0', 'e1']);
  assert.deepEqual(R.WALL_TAKEN(6), ['s1', 's2', 'w1', 'w2', 'n5', 's5', 'e0', 'e1']);
```

and append:

```js
test('the ladder corner and the bookcase front stay clear at every size; a rug may lie before the bookcase', () => {
  [4, 5, 6, 7, 8].forEach((size) => {
    assert.deepEqual(R.LADDER(size), [size - 1, 0]);
    assert.deepEqual(R.SHELF(size), [size - 1, 1]);
    const room = empty(size);
    assert.equal(R.fits(F, room, { id: 'home-lamp', c: size - 1, r: 0, turn: 0 }), false, 'no lamp on the ladder');
    assert.equal(R.fits(F, room, { id: 'home-lamp', c: size - 1, r: 1, turn: 0 }), false, 'no lamp before the bookcase');
    const rug = F.ITEMS.find((it) => it.kind === 'floor' && it.rug && it.size[0] === 1 && it.size[1] === 1);
    if (rug) {
      assert.equal(R.fits(F, room, { id: rug.id, c: size - 1, r: 1, turn: 0 }), true, 'a rug before the bookcase');
      assert.equal(R.fits(F, room, { id: rug.id, c: size - 1, r: 0, turn: 0 }), false, 'never under the ladder');
    }
  });
});

test('a saved piece on the ladder square goes back to storage on load', () => {
  const r = R.repair(F, { placed: [{ id: 'home-lamp', c: 3, r: 0, turn: 0 }] }, 4, all);
  assert.deepEqual(r.placed, []);
});
```

Add `R.LADDER(4)` and `R.SHELF(4)` to the `KEPT` list's consumers only if an existing test sweeps every kept square;
check the random-placement test near the top and add `R.LADDER(size).join(',')` and `R.SHELF(size).join(',')` to what
it asserts stays free for standing pieces.

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/world3d-room.test.js`
Expected: FAIL (`R.LADDER is not a function`, WALL_TAKEN lists).

- [ ] **Step 3: Implement** in `web/world/room.js`

```js
  // The ladder up to the Study Loft stands in the south-east corner; the Old lessons bookcase hangs on e1 beside it.
  function LADDER(size) { return [size - 1, 0]; }
  function SHELF(size) { return [size - 1, 1]; }

  // The door, the mirror and the trophy shelf take these wall squares; at 6x6 the window seat's alcove takes n5; the
  // ladder leans on the south-east corner and the bookcase takes e1.
  function WALL_TAKEN(size) {
    return (size >= 6 ? ['s1', 's2', 'w1', 'w2', 'n5'] : ['s1', 's2', 'w1', 'w2']).concat(['s' + (size - 1), 'e0', 'e1']);
  }
```

In `fits`, the floor check becomes:

```js
    var ok = sq.every(function (s) {
      if (s[0] < 0 || s[1] < 0 || s[0] >= size || s[1] >= size || same(DESK, s[0], s[1]) || same(LADDER(size), s[0], s[1])) return false;
      // At 6x6 the square before the window seat stays clear too, so she can reach 🪑 Sit.
      return rug || !(same(DOOR, s[0], s[1]) || same(WALK, s[0], s[1]) || same(MIRROR, s[0], s[1]) || same(SHELF(size), s[0], s[1]) || (size >= 6 && same(SEAT, s[0], s[1])));
    });
```

Export `LADDER: LADDER, SHELF: SHELF`.

- [ ] **Step 4: Run to see them pass, then the house and decorate tests**

Run: `node --test tests/world3d-room.test.js tests/world3d-decorate.test.js tests/world3d-house.test.js tests/world3d-room3d.test.js`
Expected: PASS. If an auto-place expectation in `world3d-room.test.js` changes because a starter piece used to land on
(size − 1, 0) or (size − 1, 1), update that expected square to the new auto-placed one and note it in the commit message.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/world/room.js tests/world3d-room.test.js && git commit -m 'My Room keeps the south-east corner clear for the ladder and e1 for the Old lessons bookcase' -- web/world/room.js tests/world3d-room.test.js
```

---

### Task 7: Loft layout (pure)

**Files:**
- Create: `web/world/loft.js`, `tests/world3d-loft.test.js`
- Modify: `tools/world-manifest.json` (add `"loft.js"` right after `"room.js"`)

- [ ] **Step 1: Write the failing test** (`tests/world3d-loft.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Lo = require(worldFile('loft.js'));
const L = require(worldFile('layout.js'));
const R = require(worldFile('room.js'));

const counts = { 'life-lab': { lessons: 3, exams: 1 }, wikaharian: { lessons: 0, exams: 2 } };

test('desk squares: the north row, then the east wall, never the ladder, Exam Corner or arrival squares', () => {
  const sq = Lo.deskSquares(10);
  assert.equal(sq.length, 10);
  assert.deepEqual(sq.slice(0, 6), [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5]]);
  assert.deepEqual(sq.slice(6), [[5, 4], [5, 3], [5, 2], [5, 1]]);
  [Lo.LADDER, Lo.EXAM, Lo.ARRIVE].forEach((s) => assert.ok(!sq.some((d) => d[0] === s[0] && d[1] === s[1])));
});

test('one desk per game of the grade, ready only with a Term 2 lesson that is not exam-only', () => {
  ['grade5', 'grade2'].forEach((g) => {
    const desks = Lo.desks(L.APPS[g], counts);
    assert.equal(desks.length, L.APPS[g].length);
    desks.forEach((d) => assert.equal(d.ready, d.app === 'life-lab'));
  });
});

test('Exam Corner lists every game with any Term 2 lesson', () => {
  assert.deepEqual(Lo.examApps(L.APPS.grade5, counts).map((a) => a.app).sort(), ['life-lab', 'wikaharian']);
});

test('urls: desks open ?term=2, the Exam Corner adds exam=1, the bookcase opens ?term=1', () => {
  const a = L.APPS.grade5.filter((x) => x.app === 'life-lab')[0];
  assert.equal(Lo.deskUrl('grade5', a), '../subjects/grade-5/science/index.html?reset=1&term=2');
  assert.equal(Lo.examUrl('grade5', a), '../subjects/grade-5/science/index.html?reset=1&term=2&exam=1');
  assert.equal(Lo.oldUrl('grade5', a), '../subjects/grade-5/science/index.html?reset=1&term=1');
});

test('items: a desk per game, the Exam Corner and the ladder down, all inside the loft', () => {
  const desks = Lo.desks(L.APPS.grade5, counts), items = Lo.items(desks), side = Lo.SIZE * R.SQ;
  assert.equal(items.filter((i) => i.kind === 'loft-desk').length, 10);
  assert.equal(items.filter((i) => i.kind === 'loft-exam').length, 1);
  assert.equal(items.filter((i) => i.kind === 'ladder-down').length, 1);
  items.forEach((i) => {
    assert.ok(i.x > R.ORIGIN.x && i.x < R.ORIGIN.x + side && i.z < R.ORIGIN.z && i.z > R.ORIGIN.z - side, i.id);
  });
});

test('solids: each desk blocks its square, the arrival square stays open', () => {
  const desks = Lo.desks(L.APPS.grade2, counts), solid = Lo.solid(desks), a = R.center(Lo.ARRIVE[0], Lo.ARRIVE[1]);
  assert.equal(solid.length, desks.length + 1, 'desks plus the Exam Corner board');
  assert.ok(!solid.some((q) => Math.abs(a.x - q.x) < q.hx && Math.abs(a.z - q.z) < q.hz));
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-loft.test.js`
Expected: FAIL (cannot find `loft.js`).

- [ ] **Step 3: Implement** `web/world/loft.js`

```js
/* The Study Loft upstairs in My Little House: a fixed 6x6 floor with a desk per game of her grade (Term 2 lessons),
   the Exam Corner board on the west wall and the ladder down in the south-east corner. Pure (no 3D). Squares use
   room.js maths (same ORIGIN and SQ), so the loft stands where her room does while the room is hidden. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Room = node ? require('./room.js') : root.World3D.Room;
  var Layout = node ? require('./layout.js') : root.World3D.Layout;

  var SIZE = 6, LADDER = [5, 0], ARRIVE = [4, 0], EXAM = [0, 2];

  function deskSquares(n) {
    var out = [], c, r;
    for (c = 0; c < SIZE; c++) out.push([c, SIZE - 1]);
    for (r = SIZE - 2; r >= 1; r--) out.push([SIZE - 1, r]);
    for (r = SIZE - 2; r >= 3; r--) out.push([0, r]);
    return out.slice(0, n);
  }

  function countOf(counts, app) { return counts && counts[app] ? counts[app] : { lessons: 0, exams: 0 }; }

  // apps: Layout.APPS[grade]; counts: World3D.TermLessons.
  function desks(apps, counts) {
    var sq = deskSquares(apps.length);
    return apps.map(function (a, i) {
      return { app: a.app, folder: a.folder, emoji: a.emoji, sign: a.sign, roof: a.roof, c: sq[i][0], r: sq[i][1], ready: countOf(counts, a.app).lessons > 0 };
    });
  }

  function examApps(apps, counts) {
    return apps.filter(function (a) { var n = countOf(counts, a.app); return n.lessons + n.exams > 0; });
  }

  function deskUrl(grade, a) { return Layout.appUrl(grade, a.folder) + '&term=2'; }
  function examUrl(grade, a) { return deskUrl(grade, a) + '&exam=1'; }
  function oldUrl(grade, a) { return Layout.appUrl(grade, a.folder) + '&term=1'; }

  function items(list) {
    var out = list.map(function (d) {
      var p = Room.center(d.c, d.r);
      return { kind: 'loft-desk', id: 'loft:' + d.app, app: d.app, x: p.x, z: p.z, r: 2.1 };
    });
    var e = Room.center(EXAM[0], EXAM[1]), l = Room.center(LADDER[0], LADDER[1]);
    out.push({ kind: 'loft-exam', id: 'loft-exam', x: e.x, z: e.z, r: 2.3 });
    out.push({ kind: 'ladder-down', id: 'ladder-down', x: l.x, z: l.z, r: 1.3 });
    return out;
  }

  // Boxes she and her pet walk round: each desk (a little short of its square) and the Exam Corner board on the wall.
  function solid(list) {
    var out = list.map(function (d) {
      var p = Room.center(d.c, d.r);
      return { x: p.x, z: p.z, hx: 0.9, hz: 0.9 };
    });
    var e = Room.center(EXAM[0], EXAM[1]);
    out.push({ x: Room.ORIGIN.x + 0.35, z: e.z, hx: 0.35, hz: 1.6 });
    return out;
  }

  var exported = { SIZE: SIZE, LADDER: LADDER, ARRIVE: ARRIVE, EXAM: EXAM, deskSquares: deskSquares, desks: desks,
    examApps: examApps, deskUrl: deskUrl, examUrl: examUrl, oldUrl: oldUrl, items: items, solid: solid };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Loft = exported;
})(this);
```

Add `"loft.js"` after `"room.js"` in `tools/world-manifest.json` (it loads after `layout.js` and `room.js`).

- [ ] **Step 4: Run**

Run: `node tools/update-world-pages.js && node tools/update-precache.js && node --test tests/world3d-loft.test.js tests/world3d-wiring.test.js tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/world/loft.js tests/world3d-loft.test.js tools/world-manifest.json web/world/grade-2.html web/world/grade-5.html web/sw.js && git commit -m 'Study Loft layout: a desk per subject, Exam Corner, ladder down (pure loft.js)' -- web/world/loft.js tests/world3d-loft.test.js tools/world-manifest.json web/world/grade-2.html web/world/grade-5.html web/sw.js
```

---

### Task 8: Drawing: ladder and bookcase in the room, the loft itself

**Files:**
- Modify: `web/world/room3d.js` (in `buildShell`, after `doorFrame();`)
- Create: `web/world/loft3d.js`, `tests/world3d-loft3d.test.js`
- Modify: `tools/world-manifest.json` (add `"loft3d.js"` right after `"room3d.js"`)

- [ ] **Step 1: Write the failing test** (`tests/world3d-loft3d.test.js`)

Copy the fake stage helpers (`any`, `loose`, `vec`, `Obj`, `obj`, `material`, `mesh`, `fakeS`) from the top of
`tests/world3d-room3d.test.js` into a shared `tests/fake-stage.js` that exports `fakeS`, and make
`tests/world3d-room3d.test.js` require it (no behaviour change). Then:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { fakeS } = require('./fake-stage.js');
const Layout = require(worldFile('layout.js'));
const Lo = require(worldFile('loft.js'));
const L3 = require(worldFile('loft3d.js'));

test('the loft builds for both grades, with a desk group per subject, and disposes cleanly', () => {
  ['grade5', 'grade2'].forEach((g) => {
    const S = fakeS();
    const desks = Lo.desks(Layout.APPS[g], { 'life-lab': { lessons: 1, exams: 0 } });
    const v = L3.create(S, { grade: g, desks });
    assert.equal(S.scene.children.length, 1, 'one group in the scene');
    assert.equal(v.deskCount(), desks.length);
    assert.equal(typeof v.see, 'function');
    assert.equal(typeof v.animate, 'function');
    assert.equal(v.hit({}), null);
    v.dispose();
    assert.equal(S.scene.children.length, 0, 'removed on dispose');
  });
});
```

Also add to `tests/world3d-room3d.test.js`'s "builds and shows at every size" test an assertion that the room view at
each size reports `view.fixedParts()` including `'ladder'` and `'bookcase'` (the method is added below).

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-loft3d.test.js tests/world3d-room3d.test.js`
Expected: FAIL (no `loft3d.js`, no `fixedParts`).

- [ ] **Step 3: Implement**

`web/world/room3d.js`: add two builders inside `create`, called from `buildShell()` right after `doorFrame();` (they
are part of the shell, so they move when the room grows), and push their groups into `shellOn.s` / `shellOn.e` so the
see-through walls fade them too:

```js
    var parts = [];
    // The ladder up to the Study Loft in the south-east corner square, leaning on the south wall, rungs toward the room.
    function ladder() {
      var c = Room.LADDER(size), p = Room.center(c[0], c[1]), g = sub(S, shell, p.x - O.x, 0, p.z - O.z + SQ / 2 - 0.35);
      shellOn.s.push(g);
      pair(function (s) { box(S, g, 0.16, WALL_H + 0.6, 0.16, DARK_WOOD, s * 0.55, (WALL_H + 0.6) / 2, 0, 0.04); });
      for (var k = 0; k < 7; k++) box(S, g, 1.1, 0.1, 0.14, WOOD, 0, 0.55 + k * 0.75, 0, 0.03);
      var hatch = sprite(emojiTex('🪜'), 0.9, 0.9);
      hatch.position.set(0, WALL_H + 1.1, 0);
      g.add(hatch);
      parts.push('ladder');
    }
    // The Old lessons bookcase on east wall square e1: three shelves of books and a 📚 sign.
    function bookcase() {
      var p = wallPoint('e', 1.5 * SQ, L), g = sub(S, shell, p.x - 0.4, 0, p.z);
      g.rotation.y = p.rot;
      shellOn.e.push(g);
      box(S, g, 2.0, 3.0, 0.7, DARK_WOOD, 0, 1.5, 0, 0.06);
      for (var k = 0; k < 3; k++) {
        box(S, g, 1.8, 0.08, 0.6, WOOD, 0, 0.5 + k * 0.9, 0.05, 0.02);
        for (var b = 0; b < 6; b++) box(S, g, 0.22, 0.6, 0.45, BOOKS[(b + k) % BOOKS.length], -0.7 + b * 0.28, 0.85 + k * 0.9, 0.08, 0.03);
      }
      var sign = sprite(emojiTex('📚'), 0.9, 0.9);
      sign.position.set(0, 3.6, 0);
      g.add(sign);
      parts.push('bookcase');
    }
```

In `buildShell`, reset `parts = [];` at the start and call `if (!o.visit) { ladder(); bookcase(); }` after
`doorFrame();` (her sister's room, opened with `visit: true`, has neither). Add
`fixedParts: function () { return parts.slice(); }` to the returned object. (`L` is `size * SQ`, already set at the top
of `buildShell`; `wallPoint`, `sub`, `box`, `pair`, `sprite`, `emojiTex`, `BOOKS`, `WOOD`, `DARK_WOOD` already exist in
the file. Check the bookcase faces into the room: `wallPoint('e', ...)` returns `nx: -1`, so `p.x - 0.4` moves it off the
wall toward the room; adjust the 0.4 if the e2e screenshot shows it inside the wall.)

`web/world/loft3d.js`:

```js
/* The Study Loft in 3D: a wooden floor with a low railing (so the camera sees over it), a little desk per subject
   with its emoji and English sign (dimmed with 🌱 when Term 2 lessons are not ready), the Exam Corner board on the
   west wall and the ladder hole in the south-east corner. Squares come from loft.js and room.js. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Room = node ? require('./room.js') : root.World3D.Room;
  var Loft = node ? require('./loft.js') : root.World3D.Loft;
  var SQ = Room.SQ, HALF = Math.PI / 2;

  function create(S, o) {
    var THREE = S.THREE, O = Room.ORIGIN, L = Loft.SIZE * SQ, myTex = [], mySprites = [];
    var group = new THREE.Group();
    group.position.set(O.x, 0, O.z);
    S.scene.add(group);

    function add(geo, color, x, y, z, parent) { var m = S.add(geo, color, x, y, z, parent || group); m.castShadow = false; return m; }
    function sprite(tex, w, h, x, y, z, parent) {
      myTex.push(tex);
      var s = S.sprite(tex, w, h);
      mySprites.push(s.material);
      s.position.set(x, y, z);
      (parent || group).add(s);
      return s;
    }
    function local(c, r) { var p = Room.center(c, r); return { x: p.x - O.x, z: p.z - O.z }; }

    var fl = add(new THREE.PlaneGeometry(L, L), '#f3d3a8', L / 2, 0, -L / 2);
    fl.rotation.x = -HALF;
    add(S.rbox(L + 1.6, 0.6, L + 1.6, 0.3), '#fff6fb', L / 2, -0.31, -L / 2);
    [[L / 2, 0.05, L + 0.3, 0.3], [L / 2, -L - 0.05, L + 0.3, 0.3], [-0.05, -L / 2, 0.3, L + 0.3], [L + 0.05, -L / 2, 0.3, L + 0.3]].forEach(function (w) {
      add(S.rbox(w[2], 0.2, w[3], 0.06), '#c98f62', w[0], 1.3, w[1]);
      add(S.rbox(w[2], 0.12, w[3], 0.04), '#e7b58c', w[0], 0.4, w[1]);
    });

    var deskGroups = o.desks.map(function (d) {
      var p = local(d.c, d.r), g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      group.add(g);
      var top = d.ready ? d.roof || '#ffd166' : '#d8d8e0';
      add(S.rbox(1.7, 0.14, 1.2, 0.05), top, 0, 1.6, 0, g);
      [[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]].forEach(function (k) { add(S.rbox(0.12, 1.55, 0.12, 0.03), '#c98f62', k[0], 0.78, k[1], g); });
      add(S.rbox(0.9, 0.08, 0.6, 0.02), '#ffffff', 0, 1.72, 0.1, g);
      sprite(S.emoji(d.emoji), 0.9, 0.9, 0, 2.45, 0, g);
      sprite(S.label(d.sign, d.ready ? '#5fcf9a' : '#b8b8c8'), 2.2, 2.2 * 180 / 512, 0, 3.25, 0, g);
      if (!d.ready) sprite(S.emoji('🌱'), 0.6, 0.6, 0.6, 2.1, 0.3, g);
      return g;
    });

    var e = local(Loft.EXAM[0], Loft.EXAM[1]);
    add(S.rbox(0.25, 2.6, 3.2, 0.06), '#5a7f5a', 0.2, 2.2, e.z);
    add(S.rbox(0.3, 0.2, 3.4, 0.04), '#c98f62', 0.22, 0.85, e.z);
    sprite(S.emoji('📝'), 1.0, 1.0, 0.6, 2.4, e.z);
    sprite(S.label('📝 Exam Corner', '#ff9f68'), 2.6, 2.6 * 180 / 512, 0.8, 4.0, e.z);

    var l = local(Loft.LADDER[0], Loft.LADDER[1]);
    add(S.rbox(1.6, 0.05, 1.6, 0.02), '#5a3e2b', l.x, 0.02, l.z);
    [-0.55, 0.55].forEach(function (s) { add(S.rbox(0.16, 1.4, 0.16, 0.04), '#c98f62', l.x + s, 0.7, l.z - 0.6); });
    sprite(S.emoji('🪜'), 0.9, 0.9, l.x, 2.0, l.z);

    return {
      group: group,
      show: function () {},
      see: function () {},
      animate: function () {},
      hit: function () { return null; },
      trophyAt: function () { return null; },
      seeThrough: function () { return []; },
      deskCount: function () { return deskGroups.length; },
      dispose: function () {
        S.scene.remove(group);
        mySprites.forEach(function (m) { m.dispose(); });
        myTex.forEach(function (t) { if (t && t.dispose) t.dispose(); });
      }
    };
  }

  var exported = { create: create };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Loft3D = exported;
})(this);
```

Check `S.emoji` against `scene.js`: if it caches textures across calls (shared), do not dispose them here (drop the
`myTex.push(tex)` for emoji textures and keep it for `S.label` textures only). Read `emoji` in `scene.js` before
finishing this step.

Add `"loft3d.js"` after `"room3d.js"` in `tools/world-manifest.json`.

- [ ] **Step 4: Run**

Run: `node tools/update-world-pages.js && node tools/update-precache.js && node --test tests/world3d-loft3d.test.js tests/world3d-room3d.test.js tests/world3d-wiring.test.js tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/world/room3d.js web/world/loft3d.js tests/fake-stage.js tests/world3d-loft3d.test.js tests/world3d-room3d.test.js tools/world-manifest.json web/world/grade-2.html web/world/grade-5.html web/sw.js && git commit -m 'Draw the ladder and Old lessons bookcase in My Room, and the Study Loft' -- web/world/room3d.js web/world/loft3d.js tests/fake-stage.js tests/world3d-loft3d.test.js tests/world3d-room3d.test.js tools/world-manifest.json web/world/grade-2.html web/world/grade-5.html web/sw.js
```

---

### Task 9: Words and world wiring

**Files:**
- Modify: `web/world/text.js`, `web/world/world-main.js`
- Test: `tests/world3d-text.test.js` (if it checks key parity between grades it covers the new keys automatically), `tests/world3d-loft-wiring.test.js` (create)

- [ ] **Step 1: Write the failing wiring test** (`tests/world3d-loft-wiring.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');
const T = require(worldFile('text.js'));

const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');

test('world-main wires the ladder, the loft desks, the Exam Corner and the Old lessons bookcase', () => {
  ['ladder-up', 'ladder-down', 'loft-desk', 'loft-exam', 'old-lessons'].forEach((k) => assert.ok(main.includes("'" + k + "'"), k));
  ['W.Loft3D.create(', 'Loft.items(', 'Loft.solid(', 'Loft.deskUrl(', 'Loft.examUrl(', 'Loft.oldUrl(', 'W.TermLessons'].forEach((s) => assert.ok(main.includes(s), s));
});

test('loft words exist for both grades; Grade 2 sentences pair Filipino with English, buttons stay English', () => {
  const g5 = T.TEXT ? T.TEXT.grade5 : T.words('grade5'), g2 = T.TEXT ? T.TEXT.grade2 : T.words('grade2');
  ['climb', 'down', 'oldLessons', 'examCorner', 'loft', 'shelf', 'oldPick', 'soon', 'examPick', 'examNone'].forEach((k) => {
    assert.equal(typeof g5[k], 'string', 'grade5 ' + k);
    assert.equal(typeof g2[k], 'string', 'grade2 ' + k);
  });
  ['climb', 'down', 'oldLessons', 'examCorner'].forEach((k) => assert.ok(!g2[k].includes(' · '), 'button ' + k + ' is English only'));
  ['loft', 'shelf', 'oldPick', 'soon', 'examPick', 'examNone'].forEach((k) => assert.ok(g2[k].includes(' · '), 'grade2 ' + k + ' is a pair'));
});
```

Read the bottom of `web/world/text.js` first: use whatever it exports for the per-grade tables (`TEXT`, `words`, or
`forGrade`), and make the test read it the same way the existing `tests/world3d-text.test.js` does.

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-loft-wiring.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the words** in `web/world/text.js`

Shared buttons (the `BUTTONS` table near line 21, beside `study` and `sit`):

```js
    climb: '🪜 Climb up', down: '🪜 Go down', oldLessons: '📚 Old lessons', examCorner: '📝 Exam Corner',
```

`grade5` words:

```js
      loft: 'Study Loft', shelf: 'Old lessons',
      oldPick: 'Pick a subject to look back at your Term 1 lessons.',
      soon: 'Term 2 lessons for {name} are coming soon! 🌱',
      examPick: 'Pick a subject for a Term 2 practice exam.',
      examNone: 'No Term 2 lessons yet. Check back soon! 🌱',
```

`grade2` words:

```js
      loft: 'Silid-Aralan sa Itaas · Study Loft', shelf: 'Lumang Aralin · Old lessons',
      oldPick: 'Pumili ng asignatura para balikan ang mga aralin sa Term 1. · Pick a subject to look back at your Term 1 lessons.',
      soon: 'Malapit na ang mga aralin sa Term 2 ng {name}! 🌱 · Term 2 lessons for {name} are coming soon! 🌱',
      examPick: 'Pumili ng asignatura para sa pagsasanay na pagsusulit sa Term 2. · Pick a subject for a Term 2 practice exam.',
      examNone: 'Wala pang aralin sa Term 2. Bumalik ka ulit! 🌱 · No Term 2 lessons yet. Check back soon! 🌱',
```

- [ ] **Step 4: Implement the wiring** in `web/world/world-main.js` (read it by line range; the My Room section starts
near line 676)

1. Near `var R = W.Room, F = W.Furniture, ...` add `var Loft = W.Loft;`.

2. `roomItems()`: for her own room (inside `if (!home.visit) {`), add:

```js
        var la = R.LADDER(home.size), sh = R.SHELF(home.size), lp = R.center(la[0], la[1]), sp = R.center(sh[0], sh[1]);
        out.push({ kind: 'ladder-up', id: 'ladder-up', x: lp.x, z: lp.z, r: 1.3 });
        out.push({ kind: 'old-lessons', id: 'old-lessons', x: sp.x, z: sp.z, r: 1.2 });
```

3. Add the loft functions after `goOut()`:

```js
    // 🪜 Climb up: her room's view gives way to the Study Loft (same place, the room hidden); 🪜 Go down brings it back.
    function climbUp() {
      if (!home || home.visit || home.loft || seat || deco) return false;
      if (roomTalk) roomTalk.close();
      home.view.dispose();
      home.loft = Loft.desks(L.APPS[grade], W.TermLessons || {});
      home.view = W.Loft3D.create(S, { grade: grade, desks: home.loft });
      var O = R.ORIGIN, side = Loft.SIZE * R.SQ, a = R.center(Loft.ARRIVE[0], Loft.ARRIVE[1]);
      home.box = { minX: O.x, maxX: O.x + side, minZ: O.z - side, maxZ: O.z };
      home.solid = Loft.solid(home.loft);
      home.items = Loft.items(home.loft);
      ctl.box(home.box);
      ctl.teleport(a.x, a.z, 0);
      pal.place(ctl.state, true);
      world.sparkle(a.x, a.z);
      sound('allRead');
      tick(0);
      return true;
    }
    function climbDown() {
      if (!home || !home.loft) return false;
      if (roomTalk) roomTalk.close();
      home.view.dispose();
      home.loft = null;
      home.view = W.Room3D.create(S, { grade: home.grade, apps: home.apps, visit: false });
      home.view.show(roomState());
      var O = R.ORIGIN, side = home.size * R.SQ, sh = R.SHELF(home.size), at = R.center(sh[0] - 1, sh[1]);
      home.box = { minX: O.x, maxX: O.x + side, minZ: O.z - side, maxZ: O.z };
      home.solid = roomSolid();
      home.items = roomItems();
      ctl.box(home.box);
      ctl.teleport(at.x, at.z, Math.PI);
      pal.place(ctl.state, true);
      world.sparkle(at.x, at.z);
      sound('allRead');
      tick(0);
      return true;
    }
    function loftDesk(app) {
      var d = (home.loft || []).filter(function (x) { return x.app === app; })[0];
      if (!d) return;
      if (!d.ready) return roomSay(d.emoji, english(d.sign), fill(T.soon, { name: english(d.sign) }), [{ text: T.bye }]);
      openGame(d.app, Loft.deskUrl(grade, d));
    }
    function examCorner() {
      var list = Loft.examApps(L.APPS[grade], W.TermLessons || {});
      if (!list.length) return roomSay('📝', T.examCorner, T.examNone, [{ text: T.bye }]);
      roomSay('📝', T.examCorner, T.examPick, list.map(function (a) {
        return { text: a.emoji + ' ' + english(a.sign), onClick: function () { openGame(a.app, Loft.examUrl(grade, a)); } };
      }).concat([{ text: T.bye }]));
    }
    function oldLessons() {
      roomSay('📚', T.shelf, T.oldPick, L.APPS[grade].map(function (a) {
        return { text: a.emoji + ' ' + english(a.sign), onClick: function () { openGame(a.app, Loft.oldUrl(grade, a)); } };
      }).concat([{ text: T.bye }]));
    }
```

Check the `W.Talk.open` button shape (`{ text, main, onClick }`) against `talk.js` and how existing `roomSay` button
lists handle a click (some buttons close the bubble on click by default); match it. `openGame` already exists (about
line 378) and opens the portal from inside the house.

4. `goIn(sis)`: create the room view with `W.Room3D.create(S, { grade: g, apps: apps, visit: !!sis })` so her sister's
   room draws no ladder or bookcase. `goOut()`: nothing extra — it disposes `home.view` (the loft view when she is upstairs) and clears `home`.
   `goIn()` starts with `home.loft` undefined (her room).

5. `actLabel(it)`: add before the `games.handles` line:

```js
      if (it.kind === 'ladder-up') return T.climb;
      if (it.kind === 'ladder-down') return T.down;
      if (it.kind === 'old-lessons') return T.oldLessons;
      if (it.kind === 'loft-exam') return T.examCorner;
      if (it.kind === 'loft-desk') {
        var d = (home && home.loft || []).filter(function (x) { return x.app === it.app; })[0];
        return d ? d.emoji + ' ' + english(d.sign) : T.study;
      }
```

6. `act()`: add beside `else if (near.kind === 'desk') study();`:

```js
      else if (near.kind === 'ladder-up') climbUp();
      else if (near.kind === 'ladder-down') climbDown();
      else if (near.kind === 'old-lessons') oldLessons();
      else if (near.kind === 'loft-desk') loftDesk(near.app);
      else if (near.kind === 'loft-exam') examCorner();
```

7. HUD pills (about line 1410): hide 🛠️ Decorate upstairs: `showDeco = !!(home && !home.visit && !home.loft) && free && !seat`.

8. Code that assumes her room while `home` is set must skip the loft: `roomTap` (return false when `home.loft`),
   `openDecorate` (return when `home.loft`), `sit` and `study` (only reachable through room items, so no change),
   `saveRoom` (return false when `home.loft`). Search the file for `home.view.trophyAt` and `home.size` uses and guard
   any that run while upstairs with `!home.loft`.

9. Debug hooks next to `debug.goIn`:

```js
    debug.climbUp = climbUp;
    debug.climbDown = climbDown;
    debug.loft = function () { return home && home.loft ? home.loft.map(function (d) { return { app: d.app, ready: d.ready, c: d.c, r: d.r }; }) : null; };
```

and add `loft: !!home.loft` to the object `debug.room()` returns.

- [ ] **Step 5: Run**

Run: `node --test tests/world3d-loft-wiring.test.js tests/world3d-text.test.js tests/world-english-first.test.js tests/world3d-wiring.test.js`
Expected: PASS. If `tests/world-english-first.test.js` flags the Grade 2 pairs, route them the way neighbouring Grade 2
words are (that test documents the rule).

- [ ] **Step 6: Commit (owner runs)**

```bash
git add web/world/text.js web/world/world-main.js tests/world3d-loft-wiring.test.js && git commit -m 'Climb the ladder to the Study Loft: desks open Term 2, Exam Corner opens Term 2 exams, the bookcase opens Term 1' -- web/world/text.js web/world/world-main.js tests/world3d-loft-wiring.test.js
```

---

### Task 10: End-to-end checks

**Files:**
- Modify: `tests/e2e/world-e2e.js`, `tests/e2e/world-driver.page.js`
- Create: `tests/e2e/term-e2e.js`, `tests/e2e/driver-term.page.js`

- [ ] **Step 1: Update the house case for the new room items**

In `tests/e2e/world-e2e.js` (about line 703) change the expected items:

```js
  assert.deepEqual(hs.room.items, ['room-out', 'room-out:walk', 'mirror', 'desk', 'ladder-up', 'old-lessons']);
```

Her sister's room (about line 831) stays `['room-out', 'room-out:walk']`.

- [ ] **Step 2: Add a loft case** to `world-driver.page.js` as a new `#e2e=loft` mode, following the `house` mode's
pattern (pause, teleport to the house, stand at `house-in`, act):

```js
    if (mode === 'loft') {
      D.pause();
      var LHl = World3D.Layout, RHl = World3D.Room, Lo = World3D.Loft;
      var hinL = LHl.interactables('grade5').filter(function (i) { return i.id === 'house-in'; })[0];
      D.teleport('house');
      D.stand(hinL.x, hinL.z);
      D.act();
      var la = RHl.center(RHl.LADDER(4)[0] - 1, 0);
      D.stand(la.x + 1.3, la.z);
      o.ladderNear = D.state().near;
      o.ladderAct = D.actText();
      D.act();
      o.up = D.room();
      o.desks = D.loft();
      var dk = RHl.center(Lo.deskSquares(1)[0][0], Lo.deskSquares(1)[0][1] - 1);
      D.stand(dk.x, dk.z + 0.4);
      o.deskNear = D.state().near;
      D.act();
      o.deskTalk = D.talkText();
      D.pressTalk('👋 Bye');
      var ex = RHl.center(Lo.EXAM[0] + 1, Lo.EXAM[1]);
      D.stand(ex.x - 0.3, ex.z);
      o.examNear = D.state().near;
      D.act();
      o.examTalk = D.talkText();
      D.pressTalk('👋 Bye');
      var dn = RHl.center(Lo.ARRIVE[0], Lo.ARRIVE[1]);
      D.stand(dn.x + 1.3, dn.z);
      o.downNear = D.state().near;
      D.act();
      o.down = D.room();
      var sh = RHl.center(RHl.SHELF(4)[0] - 1, RHl.SHELF(4)[1]);
      D.stand(sh.x + 1.3, sh.z);
      o.shelfNear = D.state().near;
      D.act();
      o.shelfButtons = D.talkButtons();
      D.portal.instant(true);
      D.pressTalk(D.talkButtons()[0]);
      o.portalUrl = D.portal.url();
      return done(o);
    }
```

Use the driver's own helper names (`D.stand`, `D.act`, `D.talkText`, `D.talkButtons`, `D.pressTalk`, `D.portal`,
`done`); read the top of `world-driver.page.js` for how a mode returns its result, and add `climbUp`, `climbDown` and
`loft` to the driver's `D` object from `World3D.debug` if it wraps debug hooks. Then in `world-e2e.js`:

```js
  const lf = run('loft', stageWorld('loft', 5, HOUSE), 'loft');
  assert.deepEqual(lf.errors, [], 'loft: page errors');
  assert.equal(lf.ladderNear, 'ladder-up');
  assert.equal(lf.ladderAct, '🪜 Climb up');
  assert.equal(lf.up.loft, true);
  assert.equal(lf.desks.length, 10, 'a desk per Grade 5 subject');
  assert.ok(lf.desks.every((d) => !d.ready), 'no Term 2 lessons yet');
  assert.equal(lf.deskNear, 'loft-desk');
  assert.match(lf.deskTalk, /coming soon/);
  assert.equal(lf.examNear, 'loft-exam');
  assert.match(lf.examTalk, /No Term 2 lessons yet/);
  assert.equal(lf.downNear, 'ladder-down');
  assert.equal(lf.down.loft, false);
  assert.equal(lf.shelfNear, 'old-lessons');
  assert.ok(lf.shelfButtons.length >= 11, 'ten subjects and Bye');
  assert.match(lf.portalUrl, /index\.html\?reset=1&term=1&embed=1$/);
  console.log('ok Study Loft: climb, desk coming soon, Exam Corner, down, Old lessons opens term=1');
```

Stand positions are a first guess from the square maths; if a `*Near` assertion fails, print `D.state()` and move the
spot inside the item's reach (`r` in `roomItems()` / `Loft.items`).

- [ ] **Step 3: Add `tests/e2e/term-e2e.js`** (game side, same harness as `search-e2e.js`)

The staged copy of Life Lab gets one Term 2 lesson by tagging its last lesson file (`18-adapt.js`) after staging.

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile } = require('../paths.js');

const work = makeWorkDir('term-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'driver-term.page.js'), 'utf8');
const html = injectDriver(fs.readFileSync(appFile('life-lab'), 'utf8'), driver);
const file = stage(path.join(work, 'site'), app('life-lab').page, html, ENGINE_FILES);
const last = path.join(path.dirname(file), 'lessons', '18-adapt.js');
fs.writeFileSync(last, fs.readFileSync(last, 'utf8').replace('StudyKit.lesson({
', 'StudyKit.lesson({
  term: 2,
'));
const total = (html.match(/<script src="lessons//g) || []).length;

function view(name, suffix) {
  const r = readOutput(dumpDom(path.join(work, 'profile-' + name), file, suffix, 3000));
  assert.deepEqual(r.errors, [], name + ': page errors');
  return r;
}

const t2 = view('t2', '?term=2');
assert.equal(t2.cards, 1, '?term=2: the one Term 2 lesson');
assert.deepEqual(t2.heads, [], '?term=2: no headings');

const t1 = view('t1', '?term=1');
assert.equal(t1.cards, total - 1, '?term=1: every other lesson');
assert.deepEqual(t1.heads, []);

const both = view('both', '');
assert.equal(both.cards, total, 'no term: every lesson');
assert.deepEqual(both.heads, [['📘 Term 1', '0'], ['🌟 Term 2 · New', String(total - 1)]]);

const ex = view('exam', '?term=2&exam=1');
assert.equal(ex.quiz, 'final', '&exam=1 opens the final exam');
assert.equal(ex.questions, 2, 'drawn from the one Term 2 lesson (2 a lesson)');
console.log('ok term views: Term 2 only, Term 1 only, both with headings, Term 2 exam');
```

`tests/e2e/driver-term.page.js` (runs after Life Lab's last `renderHome();`; Life Lab's top-level `let`
`currentQuizMeta` and `currentQuizSet` are visible to it):

```js
(function () {
  setTimeout(function () {
    var list = document.getElementById('homeList');
    var out = { errors: window.__e2eErrors || [] };
    out.cards = list.querySelectorAll(':scope > [data-search-lesson]').length;
    out.heads = [].slice.call(list.querySelectorAll('.lterm')).map(function (h) {
      return [h.textContent, h.nextElementSibling ? h.nextElementSibling.getAttribute('data-search-lesson') : null];
    });
    out.quiz = currentQuizMeta ? currentQuizMeta.id : null;
    out.questions = currentQuizSet.length;
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }, 200);
})();
```

Add `node tests/e2e/term-e2e.js` to the e2e list in `README.md`.

- [ ] **Step 4: Run**

Run: `node tests/e2e/world-e2e.js && node tests/e2e/term-e2e.js && node --test`
Expected: all pass. `world-e2e.js` takes a few minutes; run it in the background.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add tests/e2e/world-e2e.js tests/e2e/world-driver.page.js tests/e2e/term-e2e.js tests/e2e/driver-term.page.js README.md && git commit -m 'E2E: the Study Loft in the world and the term views in a game' -- tests/e2e/world-e2e.js tests/e2e/world-driver.page.js tests/e2e/term-e2e.js tests/e2e/driver-term.page.js README.md
```


---

### Task 11: Docs and the final check

**Files:**
- Modify: `docs/HANDOFF.md`, `README.md`, `docs/world-modules.md`

- [ ] **Step 1: Record the feature**

`docs/HANDOFF.md`, under "Built" → 3D world, add a bullet: Term 2 Study Loft (2026-11-07): the term tag (`term: 2`,
`exam: true`), `?term=1|2` and `&exam=1` on every game, the ladder and Study Loft, Exam Corner, Old lessons bookcase,
`term-lessons.js`; spec and plan paths; tablet check pending (climb, desk signs readable, Exam Corner list on a phone).
Under "Next", add "Term 2 lessons, one subject per commit (sub-project 2 of the Study Loft spec)" with the received
sources listed in the spec.

`README.md`, "Adding content": a new Term 2 lesson file carries `  term: 2,` on its own top-level line (and
`  exam: true,` for summative practice), numbered after the game's last lesson; Math Mastery's inline lessons carry
`term: 2` (and `term: 2, exam: true`). Run `node tools/update-precache.js` so its desk lights up.

`docs/world-modules.md`: add `loft.js` (pure: loft layout, desks, URLs), `loft3d.js` (the loft in 3D) and
`term-lessons.js` (generated, never edit) to the tables, and mention the ladder and bookcase in the `room.js` /
`room3d.js` rows.

- [ ] **Step 2: Full check**

Run: `node --test && node tests/e2e/world-e2e.js && node tests/e2e/term-e2e.js && node tests/e2e/apps-e2e.js && node tests/e2e/search-e2e.js && node tests/e2e/portal-e2e.js`
Expected: all pass.

- [ ] **Step 3: Commit (owner runs)**

```bash
git add docs/HANDOFF.md README.md docs/world-modules.md && git commit -m 'Docs: Term 2 Study Loft built; how to add a Term 2 lesson' -- docs/HANDOFF.md README.md docs/world-modules.md
```
