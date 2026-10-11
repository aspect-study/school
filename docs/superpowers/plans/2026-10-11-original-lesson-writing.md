# Original Lesson Writing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lessons keep the source's facts, terms and learning targets but never its sentences: a written rule set, a local
overlap checker, a review-progress carry-over for reworded questions, and an audit of all existing lessons.

**Architecture:** `tools/overlap-core.js` (pure matching) + `tools/unzip.js` + `tools/source-text.js` (source extraction
with a cache in the untracked `sources/.text/`) feed the CLI `tools/source-overlap.js`. `tests/game-keys.js` computes
review keys with each game's own `reviewInfo`; `tools/review-keys.js` snapshots old keys before an audit and tells which
rewritten questions need `was: '<old hash>'`. `Recall.tidy` copies the old box to the new key through
`Recall.renamesOf(StudyKit.lessons())`.

**Tech Stack:** Node 22 (tools and tests, `node:test`), ES5 browser engine (`web/engine/recall.js`), `pdftotext` from
Git for Windows.

**Spec:** `docs/superpowers/specs/2026-10-11-original-lesson-writing-design.md`

## Rules for whoever runs this plan

- **Start only after the games-in-world work is committed** (`git status` shows no changes under `web/world`,
  `web/engine/nav.js`, `web/engine/trail.js`, `web/engine/study-kit.js`, `README.md`, `docs/HANDOFF.md`). Tasks 9 and
  later edit `README.md` and `docs/HANDOFF.md`.
- **Never run `git commit`.** Each task ends with a commit command block for the owner, in the form
  `git add <files> && git commit -m '...' -- <files>`. No `Co-Authored-By`, no `Claude-Session`, no AI attribution.
- `sources/` is untracked and exists only on the owner's PC. Never copy text from it into anything tracked except as
  the rules in `docs/lesson-writing.md` allow.
- Tools are plain Node (CommonJS, modern syntax is fine). Browser code in `web/` is ES5 inside the existing IIFE.
- Comments sparingly, only for non-obvious code.

## File map

| File | Responsibility |
|---|---|
| `tests/game-keys.js` (new) | `textOf`, `extract`, `gameReviewInfo(id)`, `gameKey(id, item)`, `hashOf(key)`: review keys exactly as a game builds them |
| `tests/world3d-quiz.test.js` (modify) | uses `tests/game-keys.js` instead of its own copies |
| `web/engine/recall.js` (modify) | `renamesOf(lessons)`; `tidy(..., keepAll, renames)` copies an old box to the new key; the browser wrapper passes `renamesOf(StudyKit.lessons())` |
| `tests/recall.test.js` (modify) | carry-over and `renamesOf` tests |
| `tests/was-wiring.test.js` (new) | every `was` is a well-formed old hash, differs from the key now, and its stem is unique in the game |
| `tools/review-keys.js` (new) | `snapshot <game dir>` / `check <game dir>`: old keys before an audit, `was` lines after |
| `tools/overlap-core.js` (new) | `plainText`, `normalize`, `sentencesOf`, `h53`, `buildIndex`, `findHits`, `RUN`, `SENTENCE` |
| `tests/source-overlap.test.js` (new) | tests for overlap-core and unzip |
| `tools/unzip.js` (new) | reads zip entries (stored and deflate) with `node:zlib` |
| `tools/source-text.js` (new) | text of every file in `sources/` (pdf, pptx, docx, zip, md, txt, html), cached in `sources/.text/` |
| `tools/source-overlap.js` (new) | the CLI: lesson strings vs source index, report, exit code |
| `tools/overlap-allow.txt` (new) | accepted shared phrases |
| `docs/lesson-writing.md` (new) | the writing rules, worked examples, tool use |
| `CLAUDE.md`, `README.md`, `docs/HANDOFF.md` (modify) | rule line, tools list, audit checklist |
| `web/subjects/**/lessons/*.js` etc. (modify, Tasks 11-27) | the audit rewrites |

---

### Task 1: Shared game-key helper

**Files:**
- Create: `tests/game-keys.js`
- Modify: `tests/world3d-quiz.test.js:1-36`

- [ ] **Step 1: Create `tests/game-keys.js`** (the code moves out of `tests/world3d-quiz.test.js` unchanged, with
  asserts turned into thrown errors so tools can use it)

```js
// Review keys exactly as each game builds them: the game's own decode / historyQuestion / reviewInfo, cut out of its
// page and run in Node. Used by tests and by tools/review-keys.js.
const fs = require('node:fs');
const vm = require('node:vm');
const { appFile, engineFile } = require('./paths.js');
const { keyOf } = require(engineFile('recall.js'));

// Stands in for Recall.textOf (the browser's innerHTML → textContent).
const NAMED = { ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', minus: '−', hellip: '…', middot: '·', lt: '<', gt: '>', quot: '"', rarr: '→', uarr: '↑', darr: '↓', sup3: '³', nbsp: ' ', amp: '&' };
const textOf = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z0-9]+);/gi, (m, n) => (n in NAMED ? NAMED[n] : m));

// Cuts `function name(...) { ... }` out of a page by counting braces.
function extract(html, name) {
  const start = html.indexOf('function ' + name + '(');
  let i = html.indexOf('{', start);
  for (let depth = 0; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}

const cache = new Map();
function gameReviewInfo(id) {
  if (!cache.has(id)) {
    const html = fs.readFileSync(appFile(id), 'utf8');
    if (!html.includes('function reviewInfo(')) throw new Error(id + ' has no reviewInfo');
    const tf = html.match(/SH_TRUE = '([^']*)', SH_FALSE = '([^']*)'/);
    const names = ['decode', 'historyQuestion', 'reviewInfo'].filter((n) => html.includes('function ' + n + '('));
    names.forEach((n) => { if (html.split('function ' + n + '(').length !== 2) throw new Error(id + ' has more than one ' + n); });
    const src = names.map((n) => extract(html, n)).join('\n');
    const ctx = vm.createContext({ Recall: { textOf }, SH_TRUE: tf ? tf[1] : 'True', SH_FALSE: tf ? tf[2] : 'False' });
    cache.set(id, vm.runInContext(src + '\nreviewInfo', ctx));
  }
  return cache.get(id);
}

const gameKey = (id, item) => keyOf(id, gameReviewInfo(id)(item));
const hashOf = (key) => key.slice(key.indexOf('|') + 1);

module.exports = { textOf, extract, gameReviewInfo, gameKey, hashOf };
```

- [ ] **Step 2: Point `tests/world3d-quiz.test.js` at it.** Delete its `NAMED`, `textOf`, `extract` and
  `gameReviewInfo` definitions (lines 9-36) and add after the other requires:

```js
const { textOf, gameReviewInfo } = require('./game-keys.js');
```

  Then remove the `fs` and `vm` requires if nothing else in the file uses them:
  `grep -n "fs\.\|vm\." tests/world3d-quiz.test.js` must print nothing before you delete them.

- [ ] **Step 3: Run it**

Run: `node --test tests/world3d-quiz.test.js`
Expected: PASS, the same test count as before (one "builds the same review key" test per game).

- [ ] **Step 4: Commit (owner runs)**

```bash
git add tests/game-keys.js tests/world3d-quiz.test.js && git commit -m 'Move game review-key helpers into tests/game-keys.js' -- tests/game-keys.js tests/world3d-quiz.test.js
```

---

### Task 2: Review carry-over in Recall

**Files:**
- Modify: `web/engine/recall.js` (tidy at ~line 325, browser wrapper at ~line 517, exports at ~line 532)
- Test: `tests/recall.test.js`

- [ ] **Step 1: Write the failing tests.** Append to `tests/recall.test.js` (it already defines `memory`, `clock`,
  `items`, `info`, `pool`, `setItem`, and requires `create` and `keyOf`). Add `renamesOf` to the destructured
  require on line 6.

```js
const hashPart = (k) => k.slice(k.indexOf('|') + 1);

test('renamesOf maps a stem to its old hash, and drops stems that appear twice', () => {
  const lessons = [
    { quiz: [{ q: 'New A', was: 'abc123' }, { q: 'Same', was: 'aaaa' }, { q: 'Plain' }] },
    { quiz: [{ q: 'Same' }, { q: 'Bad', was: 'XYZ!' }, { q: 'Num', was: 12 }] },
    { generate: true },
  ];
  const r = renamesOf(lessons);
  assert.equal(r['New A'], 'abc123');
  assert.equal(r.Same, undefined, 'a stem used twice is ambiguous');
  assert.equal(r.Bad, undefined, 'not a hex hash');
  assert.equal(r.Num, undefined, 'not a string');
  assert.equal(r.Plain, undefined);
});

test('tidy moves a reworded question\'s box to its new key and retires the old one', () => {
  const s = memory(), old = { q: 'Old stem', a: 'A' }, now = { q: 'New stem', a: 'A' };
  setItem(s, 'a', old, 4, '2026-10-09', 5);
  const oldKey = keyOf('a', info(old)), newKey = keyOf('a', info(now));
  const r = create(s, clock(2026, 10, 2), 'grade5');
  r.tidy('a', [now], info, [], false, { 'New stem': hashPart(oldKey) });
  const it = items(s);
  assert.equal(it[newKey].box, 4);
  assert.equal(it[newKey].due, '2026-10-09');
  assert.equal(it[oldKey].gone, true);
});

test('tidy never overwrites a box the new key already has', () => {
  const s = memory(), old = { q: 'Old stem', a: 'A' }, now = { q: 'New stem', a: 'A' };
  setItem(s, 'a', old, 4, '2026-10-09');
  setItem(s, 'a', now, 1, '2026-10-02');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  r.tidy('a', [now], info, [], false, { 'New stem': hashPart(keyOf('a', info(old))) });
  assert.equal(items(s)[keyOf('a', info(now))].box, 1);
});

test('tidy carries a box over even when it keeps unmatched boxes', () => {
  const s = memory(), old = { q: 'Old stem', a: 'A' }, now = { q: 'New stem', a: 'A' };
  setItem(s, 'a', old, 3, '2026-10-05');
  const oldKey = keyOf('a', info(old));
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', [now], info, [], true, { 'New stem': hashPart(oldKey) });
  assert.equal(items(s)[keyOf('a', info(now))].box, 3);
  assert.ok(!items(s)[oldKey].gone, 'kept while some lessons did not load');
});

test('tidy without renames retires the old box and gives the new question none', () => {
  const s = memory(), old = { q: 'Old stem', a: 'A' }, now = { q: 'New stem', a: 'A' };
  setItem(s, 'a', old, 4, '2026-10-09');
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', [now], info, []);
  assert.equal(items(s)[keyOf('a', info(now))], undefined);
  assert.equal(items(s)[keyOf('a', info(old))].gone, true);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/recall.test.js`
Expected: FAIL: `renamesOf is not a function` and the carry-over asserts (the new key has no box).

- [ ] **Step 3: Implement.** In `web/engine/recall.js`:

  Add next to `keyOf` (after line ~94):

```js
  // A reworded question carries was: '<old hash>'; this maps its stem to that hash. A stem used by two questions is
  // left out, since it cannot tell which one was reworded.
  function renamesOf(lessons) {
    var seen = {}, out = {};
    (lessons || []).forEach(function (l) {
      ((l && l.quiz) || []).forEach(function (item) {
        if (!item || typeof item.q !== 'string') return;
        seen[item.q] = (seen[item.q] || 0) + 1;
        if (typeof item.was === 'string' && /^[0-9a-f]{1,8}$/.test(item.was)) out[item.q] = item.was;
      });
    });
    Object.keys(out).forEach(function (q) { if (seen[q] > 1) delete out[q]; });
    return out;
  }
```

  Change the `tidy` signature and add the copy step right after the `questions.forEach(...)` that fills `keys` and
  `byText`, before the `if (!keepAll)` pruning:

```js
      tidy: function (app, questions, info, entries, keepAll, renames) {
```

```js
        if (renames) questions.forEach(function (q) {
          var i = info(q), h = renames[i.q], key = keyOf(app, i), from = h ? state.items[prefix + h] : null;
          if (!from || prefix + h === key || !valid(from) || valid(state.items[key])) return;
          state.items[key] = { box: from.box, due: from.due, t: now() };
          changed = true;
        });
```

  In the browser wrapper, pass the renames:

```js
    core.tidy = function (app, questions, info, entries) {
      var tags = doc.querySelectorAll('script[src*="lessons/"]').length;
      var list = win.StudyKit && win.StudyKit.lessons ? win.StudyKit.lessons() : null;
      return tidy(app, questions, info, entries, (list ? list.length : tags) < tags, list ? renamesOf(list) : null);
    };
```

  Add `renamesOf: renamesOf` to the `exported` object, and `core.renamesOf = renamesOf;` next to `core.keyOf = keyOf;`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/recall.test.js`
Expected: PASS, all tests including the 5 new ones.

- [ ] **Step 5: Run the whole suite and one game e2e** (tidy runs in every game)

Run: `node --test` then `node tests/e2e/apps-e2e.js 5`
Expected: both PASS.

- [ ] **Step 6: Commit (owner runs)**

```bash
git add web/engine/recall.js tests/recall.test.js && git commit -m 'Carry the review box of a reworded question over through its was field' -- web/engine/recall.js tests/recall.test.js
```

---

### Task 3: `was` wiring test

**Files:**
- Create: `tests/was-wiring.test.js`

- [ ] **Step 1: Write the test**

```js
// A reworded question's was field must name its old review key, so Recall can carry her progress over.
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { gameKey, hashOf } = require('./game-keys.js');
const Q = require(worldFile('quiz.js'));

for (const id of Object.keys(Q.SHAPES)) {
  test(id + ': every was is an old key hash, not the key now, on a stem used once', () => {
    const stems = new Map();
    lessons(id).forEach((l) => (l.quiz || []).forEach((item) => stems.set(item.q, (stems.get(item.q) || 0) + 1)));
    lessons(id).forEach((l, li) => (l.quiz || []).forEach((item, i) => {
      if (item.was === undefined) return;
      const where = id + ' lesson ' + (li + 1) + ' question ' + (i + 1);
      assert.match(item.was, /^[0-9a-f]{1,8}$/, where + ': was is a review hash');
      assert.notEqual(item.was, hashOf(gameKey(id, item)), where + ': the key did not change, so was is not needed');
      assert.equal(stems.get(item.q), 1, where + ': another question has the same stem');
    }));
  });
}
```

- [ ] **Step 2: Run it**

Run: `node --test tests/was-wiring.test.js`
Expected: PASS (no lesson has `was` yet, so each game's test passes trivially).

- [ ] **Step 3: Check it catches a mistake.** Temporarily add `was: 'XYZ', ` to the first quiz item of
  `web/subjects/grade-5/science/lessons/01-*.js`, run the test, and see `life-lab` FAIL with "was is a review hash".
  Undo the change (`git diff web/subjects` must be empty).

- [ ] **Step 4: Commit (owner runs)**

```bash
git add tests/was-wiring.test.js && git commit -m 'Test that every was field names a real old review key' -- tests/was-wiring.test.js
```

---

### Task 4: `tools/review-keys.js`

**Files:**
- Create: `tools/review-keys.js`

- [ ] **Step 1: Write the tool**

```js
// Before an audit rewrites a game: `node tools/review-keys.js snapshot <game dir>` saves every question's review hash.
// After: `node tools/review-keys.js check <game dir>` lists each question whose key changed and the was line it needs.
// Questions are matched by lesson file and position, so a rewrite keeps every question where it is.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { dataFiles } = require('../tests/content.js');
const { gameKey, hashOf } = require('../tests/game-keys.js');

const CACHE = path.join(__dirname, '..', 'sources', '.text');

function game(dir) {
  const abs = path.resolve(dir);
  const meta = JSON.parse(fs.readFileSync(path.join(abs, 'subject.json'), 'utf8'));
  return { id: meta.id, dir: abs };
}

function questions(g) {
  const out = [];
  dataFiles(g.id).filter((rel) => rel.startsWith('lessons/')).forEach((rel) => {
    const found = [];
    vm.runInNewContext(fs.readFileSync(path.join(g.dir, rel), 'utf8'),
      { StudyKit: { lesson: (l) => found.push(l), content: () => undefined } }, { filename: rel });
    found.forEach((l, li) => {
      if (l.generate) return;
      (l.quiz || []).forEach((item, i) => out.push({ where: rel + '#' + li + '.' + i, item }));
    });
  });
  return out;
}

function snapshotFile(g) { return path.join(CACHE, 'keys-' + g.id + '.json'); }

function snapshot(g, force) {
  const file = snapshotFile(g);
  if (fs.existsSync(file) && !force) {
    console.error(file + ' exists (taken before this audit started). Use --force only to start the audit over.');
    return 1;
  }
  const list = questions(g).map((x) => ({ where: x.where, q: x.item.q, hash: hashOf(gameKey(g.id, x.item)) }));
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(list, null, 1));
  console.log('Saved ' + list.length + ' question keys to ' + file);
  return 0;
}

function check(g) {
  const file = snapshotFile(g);
  if (!fs.existsSync(file)) { console.error('No snapshot: run snapshot before rewriting.'); return 1; }
  const old = new Map(JSON.parse(fs.readFileSync(file, 'utf8')).map((e) => [e.where, e]));
  const now = questions(g);
  let changed = 0, problems = 0;
  for (const { where, item } of now) {
    const before = old.get(where);
    old.delete(where);
    if (!before || hashOf(gameKey(g.id, item)) === before.hash) continue;
    changed++;
    if (item.was === before.hash) continue;
    problems++;
    console.log(where + '  add  was: \'' + before.hash + '\',   // ' + String(item.q).slice(0, 60));
  }
  for (const [where, e] of old) {
    problems++;
    console.log(where + '  removed: "' + String(e.q).slice(0, 60) + '" (an audit keeps every question in place)');
  }
  console.log(changed + ' reworded, ' + problems + ' to fix');
  return problems ? 1 : 0;
}

const [cmd, dir, flag] = process.argv.slice(2);
if (!dir || (cmd !== 'snapshot' && cmd !== 'check')) {
  console.error('Usage: node tools/review-keys.js snapshot|check <game dir> [--force]');
  process.exit(2);
}
process.exit(cmd === 'snapshot' ? snapshot(game(dir), flag === '--force') : check(game(dir)));
```

- [ ] **Step 2: Try it on a copy-free change**

Run: `node tools/review-keys.js snapshot web/subjects/grade-5/science` → `Saved N question keys to …keys-life-lab.json`
Run: `node tools/review-keys.js check web/subjects/grade-5/science` → `0 reworded, 0 to fix`, exit 0.

- [ ] **Step 3: Try it on a reworded stem.** Change one quiz stem in `web/subjects/grade-5/science/lessons/01-*.js`
  (for example `'What is matter?'` → `'What do we call anything with mass that takes up space?'`), run `check`:
  expected one `add  was: '…'` line and exit 1. Add the printed `was: '…',` to that quiz item, run `check` again:
  `1 reworded, 0 to fix`. Run `node --test tests/was-wiring.test.js`: PASS. Then undo the lesson change
  (`git checkout -- web/subjects/grade-5/science/lessons/`) and delete the test snapshot
  (`rm sources/.text/keys-life-lab.json`) so the real audit starts clean.

- [ ] **Step 4: Commit (owner runs)**

```bash
git add tools/review-keys.js && git commit -m 'Add review-keys tool: snapshot old keys, list the was lines a rewrite needs' -- tools/review-keys.js
```

---

### Task 5: Overlap matching core

**Files:**
- Create: `tools/overlap-core.js`
- Test: `tests/source-overlap.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ROOT } = require('./paths.js');
const O = require(path.join(ROOT, 'tools', 'overlap-core.js'));

const SOURCE = 'Matter is anything that has mass and takes up space. Plants need sunlight to grow.\n'
  + 'The Batas Pambansa is a law made by the Batasang Pambansa during that time.';
const index = O.buildIndex([{ name: 'deck.pdf', text: SOURCE }]);

test('normalize drops tags, entities, accents, case and punctuation', () => {
  assert.equal(O.normalize('Earth&rsquo;s <b>pull</b> of GRAVITY!'), 'earths pull of gravity');
  assert.equal(O.normalize('Paaralán — “tahanan”'), 'paaralan tahanan');
});

test('the thresholds are 7-word runs and 4-word sentences', () => {
  assert.equal(O.RUN, 7);
  assert.equal(O.SENTENCE, 4);
});

test('a copied run of 7 words inside a new sentence is a hit', () => {
  const hits = O.findHits('Kuya Pilo says matter is anything that has mass and takes up room.', index, []);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, 'run');
  assert.equal(hits[0].words, 'matter is anything that has mass and takes up');
  assert.equal(hits[0].source, 'deck.pdf');
});

test('a shared run of 6 words is not a hit', () => {
  assert.deepEqual(O.findHits('Lola Lana knows anything that has mass and weight.', index, []), []);
});

test('a long copy is one hit, not one per window', () => {
  const hits = O.findHits('The Batas Pambansa is a law made by the Batasang Pambansa during that time.', index, []);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].words, 'the batas pambansa is a law made by the batasang pambansa during that time');
});

test('a whole sentence of 4 or more words copied is a hit; 3 words is not', () => {
  const hits = O.findHits('Yes. Plants need sunlight to grow!', index, []);
  assert.deepEqual(hits.map((h) => [h.kind, h.words]), [['sentence', 'plants need sunlight to grow']]);
  const short = O.buildIndex([{ name: 'x', text: 'Plants need sun.' }]);
  assert.deepEqual(O.findHits('Plants need sun.', short, []), []);
});

test('an allowed phrase is not a hit', () => {
  const allow = ['the batas pambansa is a law made by the batasang pambansa during that time'];
  assert.deepEqual(O.findHits('The Batas Pambansa is a law made by the Batasang Pambansa during that time.', index, allow), []);
});

test('a fresh rewrite with the same facts and terms has no hits', () => {
  const fresh = 'Mang Kiko says the chair, the air and the water are all matter: each has mass and fills a space. '
    + 'Sunlight helps plants grow, Tito Tasyo reminds us.';
  assert.deepEqual(O.findHits(fresh, index, []), []);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/source-overlap.test.js`
Expected: FAIL with `Cannot find module …overlap-core.js`.

- [ ] **Step 3: Write `tools/overlap-core.js`**

```js
// Finds lesson text that copies a source: a shared run of RUN words, or a whole sentence of SENTENCE or more words.
const RUN = 7;
const SENTENCE = 4;

const NAMED = { ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', minus: '−', hellip: '…', middot: '·', lt: '<', gt: '>', quot: '"', apos: "'", rarr: '→', nbsp: ' ', amp: '&', times: '×', divide: '÷', deg: '°', ntilde: 'ñ', Ntilde: 'Ñ', eacute: 'é', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú' };

function plainText(s) {
  return String(s == null ? '' : s)
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => (n in NAMED ? NAMED[n] : ' '));
}

function normalize(s) {
  return plainText(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const words = (s) => normalize(s).split(' ').filter(Boolean);

function sentencesOf(s) {
  return plainText(s).split(/[.!?;:]+(?=\s|$)|\n+/).map(normalize).filter((x) => x.split(' ').length >= SENTENCE);
}

// Two 32-bit FNV-style hashes folded into one exact JS number (53 bits), so millions of runs fit in memory.
function h53(str) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return (b & 0x1fffff) * 4294967296 + a;
}

function buildIndex(sources) {
  const runs = new Map(), sentences = new Map(), names = [];
  sources.forEach((s, n) => {
    names.push(s.name);
    const w = words(s.text);
    for (let i = 0; i + RUN <= w.length; i++) {
      const k = h53(w.slice(i, i + RUN).join(' '));
      if (!runs.has(k)) runs.set(k, n);
    }
    for (const x of sentencesOf(s.text)) {
      const k = h53(x);
      if (!sentences.has(k)) sentences.set(k, n);
    }
  });
  return { runs, sentences, names };
}

function findHits(text, index, allow) {
  const allowed = (w) => allow.some((a) => (' ' + a + ' ').includes(' ' + w + ' '));
  const w = words(text), spans = [];
  let span = null;
  for (let i = 0; i + RUN <= w.length; i++) {
    const src = index.runs.get(h53(w.slice(i, i + RUN).join(' ')));
    if (src === undefined) continue;
    if (span && i <= span.end) { span.end = i + RUN; continue; }
    if (span) spans.push(span);
    span = { start: i, end: i + RUN, source: src };
  }
  if (span) spans.push(span);
  const hits = spans.map((s) => ({ kind: 'run', words: w.slice(s.start, s.end).join(' '), source: index.names[s.source] }));
  for (const x of sentencesOf(text)) {
    const src = index.sentences.get(h53(x));
    if (src === undefined || hits.some((h) => (' ' + h.words + ' ').includes(' ' + x + ' '))) continue;
    hits.push({ kind: 'sentence', words: x, source: index.names[src] });
  }
  return hits.filter((h) => !allowed(h.words));
}

module.exports = { RUN, SENTENCE, plainText, normalize, sentencesOf, h53, buildIndex, findHits };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/source-overlap.test.js`
Expected: PASS (8 tests). If "a long copy is one hit" fails, check that `span.end` is extended for every
overlapping window (`i <= span.end`).

- [ ] **Step 5: Commit (owner runs)**

```bash
git add tools/overlap-core.js tests/source-overlap.test.js && git commit -m 'Add overlap matching: 7-word runs and whole 4-word sentences shared with a source' -- tools/overlap-core.js tests/source-overlap.test.js
```

---

### Task 6: Zip reader

**Files:**
- Create: `tools/unzip.js`
- Test: `tests/source-overlap.test.js` (append)

- [ ] **Step 1: Write the failing test** (append; it builds a tiny zip by hand with one stored and one deflated entry)

```js
const zlib = require('node:zlib');
const { unzip } = require(path.join(ROOT, 'tools', 'unzip.js'));

function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), raw = Buffer.from(f.text);
    const data = f.deflate ? zlib.deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(f.deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(f.deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

test('unzip reads stored and deflated entries', () => {
  const zip = makeZip([{ name: 'a/slide1.xml', text: 'hello' }, { name: 'b.md', text: 'deflated text here', deflate: true }]);
  const got = unzip(zip).map((e) => [e.name, e.data().toString('utf8')]);
  assert.deepEqual(got, [['a/slide1.xml', 'hello'], ['b.md', 'deflated text here']]);
});

test('unzip refuses a file that is not a zip', () => {
  assert.throws(() => unzip(Buffer.from('not a zip at all, just text')), /not a zip/);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/source-overlap.test.js`
Expected: FAIL with `Cannot find module …unzip.js`.

- [ ] **Step 3: Write `tools/unzip.js`**

```js
// Reads a zip's entries (stored or deflate) from a Buffer, using the central directory. No zip64.
const zlib = require('node:zlib');

function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip directory');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    out.push({
      name,
      data() {
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const raw = buf.subarray(start, start + size);
        if (method === 0) return raw;
        if (method === 8) return zlib.inflateRawSync(raw);
        throw new Error('zip method ' + method);
      },
    });
  }
  return out;
}

module.exports = { unzip };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/source-overlap.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit (owner runs)**

```bash
git add tools/unzip.js tests/source-overlap.test.js && git commit -m 'Add a small zip reader for the source-overlap tool' -- tools/unzip.js tests/source-overlap.test.js
```

---

### Task 7: Source text extraction

**Files:**
- Create: `tools/source-text.js`

No unit test: it reads the owner's `sources/` folder, which CI does not have. Task 8 exercises it.

- [ ] **Step 1: Write `tools/source-text.js`**

```js
// The text of every file in sources/: pdf (pdftotext), pptx and docx (their XML), zip (the files inside), md, txt and
// saved Google Forms pages. Cached per file in sources/.text/, rebuilt when the file's size or time changes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { unzip } = require('./unzip.js');
const { normalize } = require('./overlap-core.js');

const SOURCES = path.join(__dirname, '..', 'sources');
const CACHE = path.join(SOURCES, '.text');
const MAX_BYTES = 1.5e9;
const LITTLE = 20;

let pdftotext;
function findPdftotext() {
  if (pdftotext !== undefined) return pdftotext;
  pdftotext = null;
  for (const c of ['pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe']) {
    try { execFileSync(c, ['-v'], { stdio: 'ignore' }); pdftotext = c; break; }
    catch (e) { if (e.code !== 'ENOENT') { pdftotext = c; break; } }
  }
  return pdftotext;
}

function pdfText(buf) {
  const exe = findPdftotext();
  if (!exe) throw new Error('pdftotext not found (it comes with Git for Windows)');
  const tmp = path.join(os.tmpdir(), 'overlap-' + process.pid + '.pdf');
  fs.writeFileSync(tmp, buf);
  try { return execFileSync(exe, ['-layout', '-enc', 'UTF-8', tmp, '-'], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8'); }
  finally { fs.rmSync(tmp, { force: true }); }
}

function xmlText(xml, para, run) {
  const runRe = new RegExp('<' + run + '(?:\\s[^>]*)?>([^<]*)</' + run + '>', 'g');
  return xml.split('</' + para + '>').map((p) => [...p.matchAll(runRe)].map((m) => m[1]).join('')).filter(Boolean).join('\n');
}

function slides(buf) {
  return unzip(buf).filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => Number(a.name.match(/\d+/)[0]) - Number(b.name.match(/\d+/)[0]))
    .map((e) => xmlText(e.data().toString('utf8'), 'a:p', 'a:t')).join('\n');
}

function docx(buf) {
  const doc = unzip(buf).find((e) => e.name === 'word/document.xml');
  return doc ? xmlText(doc.data().toString('utf8'), 'w:p', 'w:t') : '';
}

// Google Forms keep their questions in a script as JSON strings; decode the escapes and keep the script text.
function html(text) {
  return text.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/\\u([0-9a-f]{4})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

// [{ name, text }] for one file; a zip gives one entry per readable file inside it. null: not a text format.
function docsOf(name, buf) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.pdf') return [{ name, text: pdfText(buf) }];
  if (ext === '.pptx') return [{ name, text: slides(buf) }];
  if (ext === '.docx') return [{ name, text: docx(buf) }];
  if (ext === '.md' || ext === '.txt') return [{ name, text: buf.toString('utf8') }];
  if (ext === '.html' || ext === '.htm') return [{ name, text: html(buf.toString('utf8')) }];
  if (ext === '.zip') {
    const out = [];
    for (const e of unzip(buf)) {
      const inner = docsOf(name + '!' + e.name, e.data());
      if (inner) out.push(...inner);
    }
    return out;
  }
  return null;
}

function walk(dir, out) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) { if (d.name !== '.text' && !d.name.endsWith('_files')) walk(full, out); }
    else out.push(full);
  }
  return out;
}

// { docs: [{ name, text }], notChecked: [{ name, why }] }, names relative to sources/.
function loadSources() {
  if (!fs.existsSync(SOURCES)) throw new Error('No sources/ folder: this tool runs on the owner\'s PC only.');
  fs.mkdirSync(CACHE, { recursive: true });
  const docs = [], notChecked = [];
  for (const full of walk(SOURCES, [])) {
    const rel = path.relative(SOURCES, full).split(path.sep).join('/');
    const stat = fs.statSync(full);
    const cacheFile = path.join(CACHE, crypto.createHash('sha1').update(rel).digest('hex') + '.json');
    let entry = null;
    try { entry = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
    if (!entry || entry.size !== stat.size || entry.mtimeMs !== stat.mtimeMs) {
      entry = { rel, size: stat.size, mtimeMs: stat.mtimeMs, docs: null, why: null };
      if (stat.size > MAX_BYTES) entry.why = 'too big to read';
      else {
        try { entry.docs = docsOf(rel, fs.readFileSync(full)); if (!entry.docs) entry.why = 'not a text format'; }
        catch (e) { entry.why = 'could not read: ' + e.message; }
      }
      fs.writeFileSync(cacheFile, JSON.stringify(entry));
    }
    if (!entry.docs) { notChecked.push({ name: rel, why: entry.why }); continue; }
    for (const d of entry.docs) {
      docs.push(d);
      if (normalize(d.text).split(' ').length < LITTLE) notChecked.push({ name: d.name, why: 'little or no text (pictures?)' });
    }
  }
  return { docs, notChecked };
}

module.exports = { loadSources, docsOf, xmlText };
```

- [ ] **Step 2: Smoke-test it**

Run: `node -e "const {loadSources}=require('./tools/source-text.js');const r=loadSources();console.log(r.docs.length,'docs',r.notChecked.length,'not checked');console.log(r.notChecked.slice(0,15))"`
Expected: several hundred docs (pdf, pptx, md, zip entries, Google Forms pages); "not checked" lists images, svg, logs,
and picture-only decks. A second run is much faster (cache). If pdfs show "could not read", run
`"C:\Program Files\Git\mingw64\bin\pdftotext.exe" -v` to confirm the path.

- [ ] **Step 3: Commit (owner runs)**

```bash
git add tools/source-text.js && git commit -m 'Add source text extraction for the overlap tool (pdf, pptx, docx, zip, md, forms)' -- tools/source-text.js
```

---

### Task 8: `tools/source-overlap.js` CLI and the first full report

**Files:**
- Create: `tools/source-overlap.js`, `tools/overlap-allow.txt`

- [ ] **Step 1: Write `tools/overlap-allow.txt`**

```text
# Phrases a lesson may share with a source word for word: official titles, fixed term lists, anthem or song lines.
# One phrase per line, written plainly; the tool normalises case, accents and punctuation. Lines starting with # are notes.
```

- [ ] **Step 2: Write `tools/source-overlap.js`**

```js
// Lists lesson text that copies a source in sources/ (see docs/lesson-writing.md).
//   node tools/source-overlap.js                 every game
//   node tools/source-overlap.js <game dir>      one game
//   node tools/source-overlap.js <file> ...      only these data files
// Exit code 1 when anything is found.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildIndex, findHits, normalize } = require('./overlap-core.js');
const { loadSources } = require('./source-text.js');
const { APPS, web } = require('../tests/paths.js');
const { dataFiles } = require('../tests/content.js');

const SKIP = new Set(['icon', 'id', 'emoji', 'pic', 'art', 'was']);

function fileData(file) {
  const lessons = [], content = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    StudyKit: { lesson: (l) => lessons.push(l), content: (n, v) => { if (v !== undefined) content[n] = v; return content[n]; } },
  }, { filename: file });
  return { lessons, content };
}

function strings(value, where, out) {
  if (typeof value === 'string') out.push({ where, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, where + '[' + i + ']', out));
  else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) if (!SKIP.has(k)) strings(value[k], where ? where + '.' + k : k, out);
  }
  return out;
}

function targets(args) {
  const all = APPS.flatMap((a) => dataFiles(a.id).map((rel) => path.join(path.dirname(web(a.page)), rel)));
  if (!args.length) return all;
  return args.flatMap((a) => {
    const abs = path.resolve(a);
    return fs.statSync(abs).isDirectory() ? all.filter((f) => f.startsWith(abs + path.sep)) : [abs];
  });
}

function main(args) {
  const { docs, notChecked } = loadSources();
  const index = buildIndex(docs);
  const allow = fs.readFileSync(path.join(__dirname, 'overlap-allow.txt'), 'utf8').split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#')).map(normalize);
  const perGame = new Map();
  let total = 0;
  for (const file of targets(args)) {
    const { lessons, content } = fileData(file);
    const list = strings(lessons.length === 1 ? lessons[0] : lessons, '', []).concat(strings(content, 'content', []));
    const rel = path.relative(web(''), file).split(path.sep).join('/');
    const lines = [];
    for (const s of list) {
      for (const h of findHits(s.text, index, allow)) lines.push('  ' + s.where + '  [' + h.kind + '] "' + h.words + '"  ← ' + h.source);
    }
    if (!lines.length) continue;
    console.log(rel);
    lines.forEach((l) => console.log(l));
    const game = rel.split('/').slice(0, 3).join('/');
    perGame.set(game, (perGame.get(game) || 0) + lines.length);
    total += lines.length;
  }
  console.log('\nHits per game:');
  [...perGame].sort((a, b) => b[1] - a[1]).forEach(([g, n]) => console.log('  ' + n + '  ' + g));
  console.log('Total: ' + total);
  console.log('\nNot checked (' + notChecked.length + '):');
  notChecked.forEach((n) => console.log('  ' + n.name + ' (' + n.why + ')'));
  return total ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
```

- [ ] **Step 3: Run the full report into the scratchpad**

Run: `node tools/source-overlap.js > "$TMPDIR/overlap-full.txt"; tail -40 "$TMPDIR/overlap-full.txt"`
(use your session scratchpad directory for `$TMPDIR`). Expected: exit 1, hits grouped per lesson file, a "Hits per game"
table and a "Not checked" list. It must finish in under a few minutes after the first (cache-building) run.

- [ ] **Step 4: Calibrate.** Read about 30 hits across games. Sort each into: a real copy (leave it for the audit) or a
  legitimate repeat (official law or program title, an anthem or song line, a fixed list of term names). Add only the
  legitimate repeats to `tools/overlap-allow.txt`, one phrase per line. Do not add whole definitions or explanations.
  Rerun and record the final "Hits per game" table: Task 9 copies it into `docs/HANDOFF.md`.

- [ ] **Step 5: Run the unit tests** (`node --test`) to confirm nothing else changed. Expected: PASS.

- [ ] **Step 6: Commit (owner runs)**

```bash
git add tools/source-overlap.js tools/overlap-allow.txt && git commit -m 'Add source-overlap checker: lesson text vs the class decks and tests' -- tools/source-overlap.js tools/overlap-allow.txt
```

---

### Task 9: Docs: writing rules, CLAUDE.md, README, HANDOFF

**Files:**
- Create: `docs/lesson-writing.md`
- Modify: `CLAUDE.md:37-38`, `README.md` (tools list after the `tools/kid-sounds.js` line; the "Adding content" wording line), `docs/HANDOFF.md` ("Next")

- [ ] **Step 1: Write `docs/lesson-writing.md`**

````markdown
# Writing lessons

Lessons come from class decks, textbook scans and summative tests. Those are other people's work, and the site is
public, so a lesson keeps the source's **facts and terms** and writes **every sentence fresh**.

## Kept exactly

- Facts, answer keys, real names (people, places, events, laws, books, authors), dates and numbers that are facts.
- Subject terms and their spelling: Batas, Komunidad, Hardware, Software, kongkreto, pantukoy, presser foot.
- The order of steps or lists the deck teaches, when a test could ask for it.
- Where sources disagree, the deck wins; ask the owner when an existing answer key would flip.

## Written new

- Every sentence of cards, questions, options, `explain`, `why`, `tip` and their English halves. Allowed repeats: a
  term, a name, a title, a list of terms, or a definition's core phrase of a few words ("Ang **komunidad** ay pangkat
  ng mga tao…" with the rest of the sentence new).
- Invented people and scenes: the play-world cast first (Lola Lana, Kuya Pilo, Tito Tasyo, Mang Kiko, Mayor Mimi,
  Professor Hoot, Bunny, the playmates Tagpi, Lila, Kidlat, Pandesal, Mingming and their pets), everyday Filipino names
  to fill in (Aling Nena, Mang Ben, Bea, Paolo). Nanay, Tatay, Lolo, Ate and Kuya only in a general sense. Never the
  sisters' real names.
- **Math:** new numbers and a new story; the same concept, number of steps, digit counts, regrouping or borrowing,
  decimal places and fraction type. Work every answer out twice. `explain` follows the source's method.
- **Stories:** an original passage practises the skill (sequence, main idea, cause and effect, inference, character
  traits). A 📖 card in our own words covers the class story: title, author, who, what happened, its lesson. Never
  quote it; questions about it ask about events and meaning.

## Kept the same in each question

- The learning target and the thinking level. An apply or analyse question ("Which shows…", "What would happen if…",
  "Why…") stays one; it never shrinks to recalling a definition.
- The question type (multiple choice, Tama/Mali, type-it, matching) and roughly the number of options.
- Every other rule: one right answer, the Filipino wording rules, `why` and `tip` on every option, Tama/Mali about half
  and half, the right answer not usually the longest.

## Examples

These "source" lines are made up for the examples.

**Math (Grade 5, adding decimals: hundredths plus tenths, one regrouping)**
- Source: "Mrs. Cruz bought 3.75 kg of rice and 2.5 kg of sugar. How many kilograms did she buy in all?"
- Ours: "Lola Lana bought 4.65 m of red cloth and 1.8 m of blue cloth for a costume. How many meters of cloth did she
  buy?" Answer 6.45 m (4.65 + 1.80; 6 + 8 = 14 tenths regroups once, like the source's 7 + 5 = 12 tenths).

**GMRC situation (apply a value to a new case)**
- Source: "Your classmate dropped her baon. What should you do?"
- Ours: "Kidlat's lunchbox spilled on the way to the playground. What is the kind thing for you to do?" with the same
  right choice (help pick it up and share) and wrong choices that test the same value.

**Story (English 5, sequence)**
- The class story stays in the class book. The lesson gets a 📖 card ("In *the class story*, a boy loses his kite,
  searches the town and learns to ask for help") and an original passage about Pandesal the puppy losing a ball, with
  the sequence questions asked about the new passage.

## Checking

1. Write or rewrite the lesson.
2. `node tools/source-overlap.js <lesson files>` until it prints `Total: 0`. A hit shows the shared words and the
   source file. Rewrite the sentence; add a phrase to `tools/overlap-allow.txt` only when it is an official title, a
   fixed list of terms, or a song or anthem line.
3. `node --test` and the game's e2e (`node tests/e2e/apps-e2e.js 5` or `2`).

The checker cannot read picture-only slides (listed under "Not checked"): read those yourself.

## Rewording an existing question

Rewording changes a question's review key. To keep her progress:

1. Before editing: `node tools/review-keys.js snapshot <game dir>`.
2. Rewrite, keeping every question in its place (new questions go at the end of a lesson).
3. `node tools/review-keys.js check <game dir>` prints `add  was: '…'` for each reworded question; add that field to the
   quiz item and run it again until it says `0 to fix`.
4. If a stem changed and the game has a type-it map, update the map's key to the new stem (`node --test` checks).
````

- [ ] **Step 2: Update `CLAUDE.md`.** Replace

```text
- Lessons follow the class deck's wording and facts, even where another source differs. Read picture-only slides,
  check what a lesson already covers before adding, and never leave two right answers in one question.
```

  with

```text
- Lessons follow the class deck's facts and terms, even where another source differs, but every sentence is written
  fresh (`docs/lesson-writing.md`). Run `node tools/source-overlap.js <new lesson files>` before handing over a
  lesson; it must report 0 hits. Read picture-only slides, check what a lesson already covers before adding, and
  never leave two right answers in one question.
```

- [ ] **Step 3: Update `README.md`.** In the tools list (after the `tools/kid-sounds.js` line) add

```text
tools/source-overlap.js      lists lesson text that copies a source in sources/ (owner's PC only)
tools/review-keys.js         keeps review progress when an audit rewords questions (snapshot / check)
```

  and replace the "Adding content" line

```text
- Follow the class deck's wording and facts, even where an outside source says something different.
```

  with

```text
- Follow the class deck's facts and terms, even where an outside source says something different, but write every sentence fresh: see `docs/lesson-writing.md`, and run `node tools/source-overlap.js <lesson files>` until it reports 0 hits.
```

- [ ] **Step 4: Update `docs/HANDOFF.md`.** Under "Built", add:

```markdown
- Original lesson writing (2026-10-11): lessons keep the deck's facts and terms, every sentence fresh
  (`docs/lesson-writing.md`); `tools/source-overlap.js` checks lesson text against `sources/` (7-word runs, whole
  4-word sentences); a reworded question's `was` field carries its review box over (`Recall.renamesOf`). Spec and
  plan: `docs/superpowers/specs/2026-10-11-original-lesson-writing-design.md`,
  `docs/superpowers/plans/2026-10-11-original-lesson-writing.md`.
```

  Under "Next", add the audit checklist with the hit counts from Task 8 Step 4 (fill in the numbers from the report):

```markdown
- **Lesson audit** (rewrite text that copies a source; `docs/lesson-writing.md`, "Rewording an existing question"),
  one game per commit. Hits at the start in brackets.
  - [ ] Net Navigators (Computer 5) [n]  - [ ] Wikaharian (Filipino 5) [n]  - [ ] Rise & Shine (GMRC 5) [n]
  - [ ] Craft Corner (TLE 5) [n]  - [ ] Life Lab (Science 5) [n]  - [ ] History Explorers (AP 5) [n]
  - [ ] Page Turners (English 5) [n]  - [ ] Kuwentista (Filipino 2) [n]  - [ ] Word Train (English 2) [n]
  - [ ] the rest, most hits first: Block Bot, Byte Buddies, Growing Good, Batang Bayani, Science Detectives,
    Rally Ready, Rhythm & Hues, Math Mastery [n each]
```

  Replace each `[n]` with the count from the report (`[0]` games are ticked straight away).

- [ ] **Step 5: Update the owner's lesson-building memory**
  (`C:\Users\ADMIN\.claude\projects\C--Users-ADMIN-IdeaProjects-school\memory\lesson-building-rules.md`): in point 6
  add "Write every sentence fresh: facts and terms from the deck, wording our own (docs/lesson-writing.md)", and in
  point 8 add "`node tools/source-overlap.js <new files>` until Total: 0".

- [ ] **Step 6: Run** `node --test`. Expected: PASS.

- [ ] **Step 7: Commit (owner runs)**

```bash
git add docs/lesson-writing.md CLAUDE.md README.md docs/HANDOFF.md && git commit -m 'Lesson writing rules: deck facts and terms, every sentence fresh, checked by source-overlap' -- docs/lesson-writing.md CLAUDE.md README.md docs/HANDOFF.md
```

---

### Task 10: Final check of the tooling (before the audit)

- [ ] **Step 1:** `node --test` → PASS.
- [ ] **Step 2:** `node tests/e2e/apps-e2e.js 5` and `node tests/e2e/apps-e2e.js 2` → PASS (tidy changed).
- [ ] **Step 3:** `node tests/e2e/world-e2e.js` → PASS (the world loads `recall.js`).
- [ ] **Step 4:** Request a code review of Tasks 1-9 (superpowers:requesting-code-review) before any lesson is touched.

---

## The audit (Tasks 11-27)

Every audit task is one game and follows the same steps, written out in full in each task. Shared rules:

- Rewrite **only** strings the report flags. Leave unflagged questions and cards exactly as they are.
- Keep every quiz item in its place; never delete or reorder. A story that needs a new original passage gets the 📖
  summary card added as a new card and its passage questions rewritten in place.
- Compare each rewrite with the source line the report names: the same fact, term, answer key, question type and
  thinking level. Follow `docs/lesson-writing.md` and the Filipino wording rules in `CLAUDE.md`.
- Grade 2 text stays paired "Filipino · English" where the game pairs it.
- If a flagged sentence cannot be reworded without changing a fact (an official title, a law name, a song line), add
  the phrase to `tools/overlap-allow.txt` and say so in the hand-off.
- Hand the owner one commit per game.

### Task 11: Audit Net Navigators (Grade 5 Computer)

**Files:** `web/subjects/grade-5/computer/lessons/*.js`, possibly its type-it data file and `tools/overlap-allow.txt`

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-5/computer`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-5/computer > "$TMPDIR/overlap-computer5.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above.
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-5/computer`; add each printed `was: '…',` to its
  quiz item; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-5/computer` → `Total: 0`.
- [ ] **Step 6:** `node --test` (type-it keys, `was` wiring, content rules) and `node tests/e2e/apps-e2e.js 5` → PASS.
- [ ] **Step 7:** Tick Net Navigators in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-5/computer tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Net Navigators: reword text copied from the class sources, keep review progress' -- web/subjects/grade-5/computer tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 12: Audit Wikaharian (Grade 5 Filipino)

**Files:** `web/subjects/grade-5/filipino/lessons/*.js`, possibly its type-it data file and `tools/overlap-allow.txt`

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-5/filipino`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-5/filipino > "$TMPDIR/overlap-filipino5.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above. Stories and alamat get the original
  passage plus 📖 card treatment.
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-5/filipino`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-5/filipino` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `node tests/e2e/apps-e2e.js 5` → PASS.
- [ ] **Step 7:** Tick Wikaharian in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-5/filipino tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Wikaharian: reword text copied from the class sources, keep review progress' -- web/subjects/grade-5/filipino tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 13: Audit Rise & Shine (Grade 5 GMRC)

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-5/gmrc`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-5/gmrc > "$TMPDIR/overlap-gmrc5.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above; situational questions keep the same
  value and the same right choice in a new scene.
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-5/gmrc`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-5/gmrc` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `node tests/e2e/apps-e2e.js 5` → PASS.
- [ ] **Step 7:** Tick Rise & Shine in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-5/gmrc tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Rise & Shine: reword text copied from the class sources, keep review progress' -- web/subjects/grade-5/gmrc tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 14: Audit Craft Corner (Grade 5 TLE)

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-5/tle`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-5/tle > "$TMPDIR/overlap-tle5.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above (tool and part names, like presser foot,
  stay exact).
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-5/tle`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-5/tle` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `node tests/e2e/apps-e2e.js 5` → PASS.
- [ ] **Step 7:** Tick Craft Corner in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-5/tle tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Craft Corner: reword text copied from the class sources, keep review progress' -- web/subjects/grade-5/tle tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 15: Audit Life Lab (Grade 5 Science)

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-5/science`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-5/science > "$TMPDIR/overlap-science5.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above.
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-5/science`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-5/science` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `node tests/e2e/apps-e2e.js 5` → PASS.
- [ ] **Step 7:** Tick Life Lab in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-5/science tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Life Lab: reword text copied from the class sources, keep review progress' -- web/subjects/grade-5/science tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 16: Audit History Explorers (Grade 5 Araling Panlipunan)

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-5/araling-panlipunan`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-5/araling-panlipunan > "$TMPDIR/overlap-ap5.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above. Historical names, places, dates and
  the deck-specific notes (T'uhan = Tohan, Constantino vs Agoncillo) stay exact.
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-5/araling-panlipunan`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-5/araling-panlipunan` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `node tests/e2e/apps-e2e.js 5` → PASS.
- [ ] **Step 7:** Tick History Explorers in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-5/araling-panlipunan tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit History Explorers: reword text copied from the class sources, keep review progress' -- web/subjects/grade-5/araling-panlipunan tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 17: Audit Page Turners (Grade 5 English)

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-5/english`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-5/english > "$TMPDIR/overlap-english5.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above. Each class story gets an original
  passage for the skill questions and a 📖 summary card (title, author, who, what happened, lesson); no quoted lines.
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-5/english`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-5/english` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `node tests/e2e/apps-e2e.js 5` → PASS.
- [ ] **Step 7:** Tick Page Turners in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-5/english tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Page Turners: reword text copied from the class sources, keep review progress' -- web/subjects/grade-5/english tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 18: Audit Kuwentista (Grade 2 Filipino)

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-2/filipino`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-2/filipino > "$TMPDIR/overlap-filipino2.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above. Stories get the original passage plus
  📖 card; keep the English helpers and Paano Sagutin cards; Filipino stays simple for Grade 2.
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-2/filipino`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-2/filipino` → `Total: 0`.
- [ ] **Step 6:** `node --test`, `node tests/e2e/apps-e2e.js 2` and `node tests/e2e/english-first-e2e.js` → PASS.
- [ ] **Step 7:** Tick Kuwentista in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-2/filipino tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Kuwentista: reword text copied from the class sources, keep review progress' -- web/subjects/grade-2/filipino tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 19: Audit Word Train (Grade 2 English)

- [ ] **Step 1:** `node tools/review-keys.js snapshot web/subjects/grade-2/english`
- [ ] **Step 2:** `node tools/source-overlap.js web/subjects/grade-2/english > "$TMPDIR/overlap-english2.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above (stories: original passage plus 📖 card;
  the deck's asking = rising intonation rule stays).
- [ ] **Step 4:** `node tools/review-keys.js check web/subjects/grade-2/english`; add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js web/subjects/grade-2/english` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `node tests/e2e/apps-e2e.js 2` → PASS.
- [ ] **Step 7:** Tick Word Train in `docs/HANDOFF.md`. Commit (owner runs):

```bash
git add web/subjects/grade-2/english tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit Word Train: reword text copied from the class sources, keep review progress' -- web/subjects/grade-2/english tools/overlap-allow.txt docs/HANDOFF.md
```

### Tasks 20-27: Audit the rest, most hits first

Order these by the Task 8 "Hits per game" table (skip any game with 0 hits and tick it). Each one:

| Task | Game | Folder | e2e |
|---|---|---|---|
| 20 | Block Bot (Math 2) | `web/subjects/grade-2/math` | `node tests/e2e/apps-e2e.js 2` |
| 21 | Byte Buddies (Computer 2) | `web/subjects/grade-2/computer` | `node tests/e2e/apps-e2e.js 2` |
| 22 | Growing Good (GMRC 2) | `web/subjects/grade-2/gmrc` | `node tests/e2e/apps-e2e.js 2` |
| 23 | Batang Bayani (Makabansa 2) | `web/subjects/grade-2/makabansa` | `node tests/e2e/apps-e2e.js 2` |
| 24 | Science Detectives (Science 2) | `web/subjects/grade-2/science` | `node tests/e2e/apps-e2e.js 2` |
| 25 | Rally Ready (P.E. & Health 5) | `web/subjects/grade-5/pe-health` | `node tests/e2e/apps-e2e.js 5` |
| 26 | Rhythm & Hues (Music & Arts 5) | `web/subjects/grade-5/music-arts` | `node tests/e2e/apps-e2e.js 5` |
| 27 | Math Mastery (Math 5) | `web/subjects/grade-5/math` | `node tests/e2e/apps-e2e.js 5` |

For the game in row N, with `<folder>` and `<e2e>` from the table:

- [ ] **Step 1:** `node tools/review-keys.js snapshot <folder>` (Math Mastery: skip; its review is per lesson skill, so
  rewording its `cases.js` / `walkthroughs.js` text loses nothing).
- [ ] **Step 2:** `node tools/source-overlap.js <folder> > "$TMPDIR/overlap-<game>.txt"` and read it.
- [ ] **Step 3:** Rewrite every flagged string following the audit rules above. Math word problems: new numbers and
  story, the same concept, steps, digit counts and regrouping; compute each answer twice.
- [ ] **Step 4:** `node tools/review-keys.js check <folder>` (not Math Mastery); add each printed `was`; repeat until `0 to fix`.
- [ ] **Step 5:** `node tools/source-overlap.js <folder>` → `Total: 0`.
- [ ] **Step 6:** `node --test` and `<e2e>` → PASS.
- [ ] **Step 7:** Tick the game in `docs/HANDOFF.md`. Commit (owner runs), with `<folder>` and `<Game>` filled in:

```bash
git add <folder> tools/overlap-allow.txt docs/HANDOFF.md && git commit -m 'Audit <Game>: reword text copied from the class sources, keep review progress' -- <folder> tools/overlap-allow.txt docs/HANDOFF.md
```

### Task 28: Close the audit

- [ ] **Step 1:** `node tools/source-overlap.js` → `Total: 0` across every game.
- [ ] **Step 2:** `node --test`, `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/apps-e2e.js 2`, `node tests/e2e/world-e2e.js` → PASS.
- [ ] **Step 3:** In `docs/HANDOFF.md`, move the audit from "Next" to "Built" as one line: "Lesson audit (date): every
  game reworded where it copied a source; `was` fields keep review progress and can be removed after every tablet has
  opened each game."
- [ ] **Step 4:** Commit (owner runs):

```bash
git add docs/HANDOFF.md && git commit -m 'Lesson audit done: every game passes the source-overlap check' -- docs/HANDOFF.md
```
