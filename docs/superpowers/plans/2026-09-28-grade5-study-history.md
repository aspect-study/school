# Grade 5 Study History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the Grade 5 lobby and its 8 apps the same permanent, PIN-protected (0108) study history that Grade 2 has, with Math Mastery also recording UPAC Walkthrough problems and Case Studies.

**Architecture:** A byte-identical copy of `study-history.js` at the repo root, whose storage prefix comes from `data-grade="grade5"` on the script tag. The 7 layout-sharing apps and Math Mastery get guarded hooks (`SH && ...`). `lobby-grade5.html` gets the same Parent panel, and its script is identical to Grade 2's.

**Spec:** `docs/superpowers/specs/2026-09-28-grade5-study-history-design.md` (addendum to the Grade 2 spec).

**House rules:**
- **Never run `git commit`** (not a git repo). Give suggested commit messages **without Co-Authored-By lines**.
- Never change lesson content, questions, answer keys, scoring or points logic.
- `study-history.js` stays ASCII-only. Write `\uXXXX` as literal text; your tools may decode it, so check with `node -e "console.log([...require('fs').readFileSync('<file>')].filter(b=>b>127).length)"`, which must print 0.
- Comments sparing. Unit tests: `node --test` from the repo root (`node --test tests/` does not work here).
- Paths are relative to `C:\Users\ADMIN\IdeaProjects\school\`.
- Snapshot before editing any Grade 5 app: `mkdir -p /c/Users/ADMIN/AppData/Local/Temp/study-history-before-g5 && cp *.html /c/Users/ADMIN/AppData/Local/Temp/study-history-before-g5/` (Git Bash, repo root). Only do this if the folder does not already exist.

---

### Task G1: Library v2 (grade prefix, distinct cards, round kinds) + root copy + parity test

**Files:** modify `grade 2/study-history.js`, `tests/study-history.test.js`, `grade 2/lobby.html` (panel `describe` only). Create `study-history.js` (root copy) and `tests/copies.test.js`.

- [ ] **Step 1: Failing tests.** Append to `tests/study-history.test.js`:

```js
test('cardViewed counts distinct cards, so wrapping back does not inflate the count', () => {
  const { sh, storage } = setup();
  const id = sh.lessonOpened('rise-shine', 'Rise & Shine', 'l1', 'Signs', 8);
  sh.cardViewed(id, 1);
  sh.cardViewed(id, 8);
  sh.cardViewed(id, 1);
  assert.equal(saved(storage)[0].cardsViewed, 2);
});

test('quizStarted stores a walkthrough or case kind, and ignores unknown kinds', () => {
  const { sh, storage } = setup();
  sh.quizStarted('math-mastery', 'Math Mastery', 'wt1', 'A baker has 3/4 kg...', false, 5, 'walkthrough');
  sh.quizStarted('math-mastery', 'Math Mastery', 'bibingka', 'Bibingka at the Fiesta', false, 3, 'case');
  sh.quizStarted('math-mastery', 'Math Mastery', 'l1', 'Fractions', false, 10, 'bogus');
  const [w, c, q] = saved(storage);
  assert.equal(w.kind, 'walkthrough');
  assert.equal(c.kind, 'case');
  assert.equal('kind' in q, false);
});

test('exportCsv labels walkthrough and case rounds', () => {
  const { sh } = setup();
  const w = sh.quizStarted('math-mastery', 'Math Mastery', 'wt1', 'Dough problem', false, 5, 'walkthrough');
  sh.quizFinished(w, 0, 65, 5);
  const c = sh.quizStarted('math-mastery', 'Math Mastery', 'bibingka', 'Bibingka at the Fiesta', false, 3, 'case');
  sh.quizFinished(c, 0, 35, 3);
  const lines = sh.exportCsv().slice(1).split('\r\n');
  assert.match(lines[1], /^[^,]*,[^,]*,Math Mastery,UPAC walkthrough,Dough problem,/);
  assert.match(lines[2], /^[^,]*,[^,]*,Math Mastery,Case study,Bibingka at the Fiesta,/);
});

test('create with a grade prefix uses that grade\'s keys only', () => {
  const storage = memStorage();
  const clock = makeClock();
  const g5 = create(storage, clock.now, 'grade5');
  g5.appOpened('math-mastery', 'Math Mastery');
  assert.equal(storage.getItem(KEY), null);
  assert.equal(JSON.parse(storage.getItem('grade5_history_v1')).entries.length, 1);
  assert.equal(create(storage, clock.now).list().length, 0, 'default prefix is grade2');
  assert.equal(create(storage, clock.now, 'bad prefix!').list().length, 0, 'invalid prefix falls back to grade2');
});
```

Create `tests/copies.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('the Grade 2 and Grade 5 copies of study-history.js are identical', () => {
  const g2 = fs.readFileSync(path.join(root, 'grade 2', 'study-history.js'));
  const g5 = fs.readFileSync(path.join(root, 'study-history.js'));
  assert.ok(g2.equals(g5), 'edit grade 2/study-history.js, then copy it over the root study-history.js');
});
```

- [ ] **Step 2:** Run `node --test`. Expect the 4 new library tests and the copies test to fail.

- [ ] **Step 3: Implement in `grade 2/study-history.js`.**
  - `create(storage, now, grade)`: first line inside `create`:
    ```js
    var prefix = /^[a-z0-9]+$/.test(grade || '') ? grade : 'grade2';
    var KEY = prefix + '_history_v1', ERROR_KEY = prefix + '_history_error_v1', CORRUPT_PREFIX = prefix + '_history_corrupt_v1_';
    ```
    These shadow the module-level constants. Keep the module-level `KEY` export as `'grade2_history_v1'` for existing tests.
  - `api.cardViewed`:
    ```js
    api.cardViewed = function (id, cardNumber) {
      update(id, function (e) {
        if (!Array.isArray(e.seen)) e.seen = [];
        if (e.seen.indexOf(cardNumber) < 0) e.seen.push(cardNumber);
        e.cardsViewed = e.seen.length;
      });
    };
    ```
  - `api.quizStarted` gains a 7th parameter `kind`. Build the fields object as before, then `if (kind === 'walkthrough' || kind === 'case') fields.kind = kind;` before `add(fields)`.
  - `csvRow` type: for quiz entries, `e.kind === 'walkthrough' ? 'UPAC walkthrough' : e.kind === 'case' ? 'Case study' : e.final ? 'Final exam' : 'Quiz'`. The Lesson column stays `e.final ? 'Final Mock Exam' : e.lessonTitle`.
  - The browser bootstrap at the bottom reads the grade from the script tag:
    ```js
    try {
      var script = root.document && root.document.currentScript;
      var grade = script ? script.getAttribute('data-grade') : null;
      root.localStorage.getItem('grade2_history_v1');
      root.StudyHistory = create(root.localStorage, Date.now, grade);
    } catch (e) {}
    ```
- [ ] **Step 4:** Copy it: `cp "grade 2/study-history.js" study-history.js`. Run `node --test`; all must pass (38 + 4 + 1 = 43). Byte-scan both copies: 0.
- [ ] **Step 5: Panel kinds in `grade 2/lobby.html`.** In the panel script's `describe(e)`, replace the quiz branch's name and icon logic so that:
  - `e.kind === 'walkthrough'` → icon `🧩`, name `e.appTitle + ' · UPAC Walkthrough: ' + e.lessonTitle`, score text `correct + '/' + total + ' steps'`.
  - `e.kind === 'case'` → icon `📋`, name `e.appTitle + ' · Case Study: ' + e.lessonTitle`.
  - otherwise the current behaviour (icon `✏️`, "Final Mock Exam" or "`<lesson>` quiz").
  - Stars stay hidden when 0. The unfinished text ("stopped at …") is unchanged.
- [ ] **Step 6:** Rerun the Grade 2 suites: `node --test`, `node tests/e2e/apps-e2e.js` (All 7 apps passed), `node tests/e2e/lobby-e2e.js` (Lobby passed).
- [ ] Commit message: `feat(history): grade-prefixed keys, distinct card counting and round kinds`

---

### Task G2: Generalise the e2e harness for Grade 5 (fails until the apps are wired)

**Files:** modify `tests/e2e/apps-e2e.js`, `tests/e2e/driver-common.page.js`, `tests/e2e/driver-family-a.page.js`, `tests/e2e/driver-family-b.page.js`. Create `tests/e2e/driver-family-c.page.js` and `tests/e2e/driver-math.page.js`.

- [ ] **Step 1: Grade argument.** `node tests/e2e/apps-e2e.js` defaults to grade 2; `node tests/e2e/apps-e2e.js 5` runs Grade 5. Per-grade config:
  - grade 2: `dir = GRADE2`, `key = 'grade2_history_v1'`, the existing 7 APPS.
  - grade 5: `dir = repo root`, `key = 'grade5_history_v1'`, with APPS:
    ```js
    [
      { file: 'history-explorers.html', slug: 'history-explorers', title: 'History Explorers', family: 'c' },
      { file: 'wikaharian.html', slug: 'wikaharian', title: 'Wikaharian', family: 'c' },
      { file: 'page-turners.html', slug: 'page-turners', title: 'Page Turners', family: 'c' },
      { file: 'rise-shine.html', slug: 'rise-shine', title: 'Rise & Shine', family: 'c' },
      { file: 'rally-ready.html', slug: 'rally-ready', title: 'Rally Ready', family: 'c' },
      { file: 'craft-corner.html', slug: 'craft-corner', title: 'Craft Corner', family: 'c' },
      { file: 'life-lab.html', slug: 'life-lab', title: 'Life Lab', family: 'c' },
      { file: 'math-mastery.html', slug: 'math-mastery', title: 'Math Mastery', family: 'math' },
    ]
    ```
  - The driver text is prefixed with `var __E2E_KEY = '<key>';`. `driver-common.page.js` uses `__E2E_KEY` everywhere it currently hard-codes `'grade2_history_v1'`.
  - `study-history.js` is copied from the grade's `dir`.
- [ ] **Step 2: `driver-family-c.page.js`.** Top-level globals: `LESSONS` (with `.cards`), `currentLessonIdx`, `openLesson(i)`, `nextCard()`, `prevCard()`, `goHome()`, `startQuiz()`, `startFinalExam()`, `selectOption(i)`, `nextQuestion()`, `currentQuizSet`, `quizIdx`, `quizScore`, `sessionPoints`. Note that `nextQuestion()` on the last question calls `finishQuiz()` and does not advance, so always loop a fixed count.
  ```js
  function __e2eAnswer(right) {
    var q = currentQuizSet[quizIdx];
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
    var expect = { cardsTotal: LESSONS[0].cards.length, lessonTitle: LESSONS[0].title, wrapLesson: true };
    openLesson(0); nextCard(); nextCard(); prevCard(); goHome();
    openLesson(0); prevCard(); goHome();
    currentLessonIdx = 0; startQuiz(); expect.perfectTotal = __e2eAnswerAll(true); expect.perfectPoints = sessionPoints;
    currentLessonIdx = 0; startQuiz(); expect.wrongTotal = __e2eAnswerAll(false);
    currentLessonIdx = 0; startQuiz(); expect.partialTotal = currentQuizSet.length;
    __e2eAnswer(true); nextQuestion(); __e2eAnswer(true); goHome();
    startFinalExam(); expect.finalTotal = __e2eAnswerAll(true);
    __e2eOut({ entries: __e2eHistory(), expect: expect });
  }
  __e2eRun();
  ```
- [ ] **Step 3: `driver-math.page.js`.** This is the family-A driver adapted for Math Mastery. Its quiz questions all come from `l.generate` and are multiple choice, so `__e2eAnswer` is just `selectOption(right ? q.correct : (q.correct + 1) % q.options.length)`. It adds walkthrough and case scenarios after the final exam:
  ```js
  function __e2eWtPick(right) {
    document.querySelector('#wt-options .option[data-right="' + (right ? 1 : 0) + '"]').click();
  }
  function __e2eWalk(right) {
    startWalkthrough();
    var p = wtCurrent();
    p.givens.forEach(function (g, i) { if (right ? g.is : !g.is) wtPicks.add(i); });
    wtCheckGivens(); wtAdvance();
    __e2eWtPick(right); wtAdvance();
    __e2eWtPick(right); wtAdvance();
    document.getElementById('wt-answer').value = right ? fracToString(p.answer.num, p.answer.den) : '999';
    wtCheckAnswer(); wtAdvance();
    __e2eWtPick(right); wtAdvance();
  }
  function __e2eCase(i, right) {
    openCase(i);
    var cs = CASES[i];
    for (var k = 0; k < cs.questions.length; k++) {
      var q = cs.questions[k];
      if (q.type === 'num') {
        document.getElementById('case-answer').value = right ? fracToString(q.answer.num, q.answer.den) : '999';
        caseCheckNum();
      } else {
        document.querySelector('#case-options .option[data-right="' + (right ? 1 : 0) + '"]').click();
      }
      if (k < cs.questions.length - 1) { caseQ++; renderCase(); } else caseShowKey();
    }
    return cs.questions.length;
  }
  ```
  In `play` mode, after the final exam, add:
  ```js
  __e2eWalk(true); __e2eWalk(false);
  startWalkthrough(); wtCheckGivens(); goHome();
  expect.casePerfectTotal = __e2eCase(0, true);
  expect.caseWrongTotal = __e2eCase(1, false);
  ```
  The partial walkthrough checks givens with nothing picked, then leaves. Math Mastery flashcards are linear (`cardStep`), like Grade 2 family A, so use `openLesson(0); cardStep(1); cardStep(1); goHome();` and do not set `wrapLesson`.
- [ ] **Step 4: Checks** in `apps-e2e.js`:
  - `checkPlay` takes the lesson entries in order. `lessons[0].cardsViewed === 3`. If `x.wrapLesson`, there must be exactly 2 lesson entries and `lessons[1].cardsViewed === 2` (card 1 plus the wrapped-to last card); otherwise exactly 1.
  - Quiz checks cover only entries without `kind`: the existing perfect/wrong/partial/final checks, `numberlineTotal` untouched.
  - New `checkMath(mine, x)` for the entries with `kind`:
    - Walkthrough entries in order: perfect, wrong, partial.
      - perfect: `kind === 'walkthrough'`, finished, `total === 5`, `correct === 5`, `points === 65`, `wrong.length === 0`.
      - wrong: finished, `correct === 0`, `wrong.length === 5`, each with q, picked and answer non-empty and `picked !== answer`.
      - partial: not finished, `answered === 1`.
    - Case entries: perfect then wrong.
      - perfect: `kind === 'case'`, finished, `correct === total === x.casePerfectTotal`, `points === 10*n + 5*max(0, n-2)`.
      - wrong: `correct === 0` and `wrong.length === x.caseWrongTotal`.
    - Every walkthrough/case `lessonTitle` is non-empty plain text: no `<` or `&...;`, and the walkthrough title is at most 60 characters.
- [ ] **Step 5:** Run `node tests/e2e/apps-e2e.js` and confirm all 7 Grade 2 apps still pass. Run `node tests/e2e/apps-e2e.js 5`: all 8 Grade 5 apps should FAIL with `one open entry`, and **not** with `no e2e output` or a page error (if they do, fix the harness). Timeouts: 600000 ms.
- [ ] Commit message: `test(history): run the e2e harness for Grade 5 apps`

---

### Task G3: Wire the 7 Grade 5 apps that share the Rise & Shine layout

**Files:** `history-explorers.html`, `wikaharian.html`, `page-turners.html`, `rise-shine.html`, `rally-ready.html`, `craft-corner.html`, `life-lab.html` (repo root). Take the snapshot first (see house rules).

The constants line per app:

| file | line |
|---|---|
| history-explorers | `const SH = window.StudyHistory, SH_APP = 'history-explorers', SH_TITLE = 'History Explorers';` |
| wikaharian | `const SH = window.StudyHistory, SH_APP = 'wikaharian', SH_TITLE = 'Wikaharian';` |
| page-turners | `const SH = window.StudyHistory, SH_APP = 'page-turners', SH_TITLE = 'Page Turners';` |
| rise-shine | `const SH = window.StudyHistory, SH_APP = 'rise-shine', SH_TITLE = 'Rise & Shine';` |
| rally-ready | `const SH = window.StudyHistory, SH_APP = 'rally-ready', SH_TITLE = 'Rally Ready';` |
| craft-corner | `const SH = window.StudyHistory, SH_APP = 'craft-corner', SH_TITLE = 'Craft Corner';` |
| life-lab | `const SH = window.StudyHistory, SH_APP = 'life-lab', SH_TITLE = 'Life Lab';` |

Identical edits in each file:
1. Before the only bare `<script>` line, insert `<script src="study-history.js" data-grade="grade5"></script>`.
2. Before `const STORAGE_KEY = `, insert the constants line from the table followed by `let historyLessonId = null, historyQuizId = null;`.
3. After `  progress = {};\n  saveProgress(progress);` (the `?reset=1` block), insert `  SH && SH.appOpened(SH_APP, SH_TITLE);`.
4. After `  currentLessonIdx = i;\n  flashIdx = 0;` (in `openLesson`), insert:
   `  historyLessonId = SH ? SH.lessonOpened(SH_APP, SH_TITLE, LESSONS[i].id, LESSONS[i].title, LESSONS[i].cards.length) : null;`
5. After `  const c = l.cards[flashIdx];` (in `renderFlash`), insert `  SH && SH.cardViewed(historyLessonId, flashIdx + 1);`.
6. After `  currentQuizMeta = {id:l.id, title:l.title};`, insert:
   `  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, false, currentQuizSet.length) : null;`
   After `  currentQuizMeta = {id:'final', title:'Full Mock Exam'};`, insert the same line with `true`.
7. After `  const q = currentQuizSet[quizIdx];\n  const buttons = document.querySelectorAll('#optionsBox .option');` (in `selectOption`), insert:
   `  SH && SH.quizAnswered(historyQuizId, i === q.correct, q.art ? q.q + ' [' + q.options[q.correct] + ']' : q.q, q.options[i], q.options[q.correct]);`
8. After `  if(quizScore > best) progress[currentQuizMeta.id] = quizScore;\n  saveProgress(progress);` (in `finishQuiz`), insert:
   `  SH && SH.quizFinished(historyQuizId, starsFor(quizScore / total), sessionPoints, bestStreak);`

- [ ] Apply to all 7. Then verify:
  - A diff against the snapshot shows **no removed lines** and 11 added lines per file.
  - `node tests/e2e/apps-e2e.js 5`: the 7 PASS, and only `math-mastery.html` fails.
- [ ] Commit message: `feat(grade5): record study history in the seven lesson apps`

---

### Task G4: Wire Math Mastery (quiz, UPAC Walkthrough, Case Studies)

**File:** `math-mastery.html` (repo root; snapshot must exist).

1. Before the only bare `<script>` line, insert `<script src="study-history.js" data-grade="grade5"></script>`.
2. Before `const STORAGE_KEY = 'mathmastery_progress_v1';`, insert:
   ```js
   const SH = window.StudyHistory, SH_APP = 'math-mastery', SH_TITLE = 'Math Mastery';
   let historyLessonId = null, historyQuizId = null;
   function historyShort(html){
     const t = SH ? SH.plain(html) : '';
     return t.length > 60 ? t.slice(0, 57) + '...' : t;
   }
   ```
3. `?reset=1` block: after `  progress = {};\n  saveProgress(progress);`, insert `  SH && SH.appOpened(SH_APP, SH_TITLE);`.
4. After `  currentLessonIdx = i;\n  cardIdx = 0;`, insert `  historyLessonId = SH ? SH.lessonOpened(SH_APP, SH_TITLE, LESSONS[i].id, LESSONS[i].title, LESSONS[i].flashcards.length) : null;`.
5. After `  const fc = lesson.flashcards[cardIdx];`, insert `  SH && SH.cardViewed(historyLessonId, cardIdx + 1);`.
6. After `  currentQuizMeta = {id: lesson.id, title: lesson.title};`, insert the quizStarted line (`false`). After `  currentQuizMeta = {id:'final', title:'Full Practice Test'};`, insert it with `true`:
   `  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, currentQuizMeta.id, currentQuizMeta.title, false, currentQuizSet.length) : null;`
7. In `selectOption`, after `  const correct = idx === q.correct;`, insert `  SH && SH.quizAnswered(historyQuizId, correct, q.q, q.options[idx], q.options[q.correct]);`.
8. In `finishQuiz`, after `  progress[currentQuizMeta.id] = best;\n  saveProgress(progress);`, insert `  SH && SH.quizFinished(historyQuizId, starsFor(quizScore / total), sessionPoints, bestStreak);`.
9. In `openWtProblem`, after `  wtClean = true;\n  startRound();`, insert:
   `  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, wtCurrent().id, historyShort(wtCurrent().text), false, WT_STAGES.length, 'walkthrough') : null;`
10. In `wtChoiceStage`, after `      const right = list.find(z=>z.c);`, insert:
    `      SH && SH.quizAnswered(historyQuizId, ok, WT_STAGES[wtStage].title + ': ' + WT_STAGES[wtStage].prompt, item.t, right.t);`
11. In `wtCheckGivens`, after `  wtRecord.given = p.givens.filter(g=>g.is).map(g=>g.t).join('; ');`, insert:
    `  SH && SH.quizAnswered(historyQuizId, ok, WT_STAGES[0].title + ': ' + WT_STAGES[0].prompt, p.givens.filter((g, i)=>wtPicks.has(i)).map(g=>g.t).join('; ') || '(none picked)', wtRecord.given);`
12. In `wtCheckAnswer`, after `  const wantStr = fracToString(want.num, want.den);`, insert:
    `  SH && SH.quizAnswered(historyQuizId, ok, WT_STAGES[3].title + ': ' + WT_STAGES[3].prompt, document.getElementById('wt-answer').value.trim(), wantStr + ' ' + p.unit);`
13. Replace `function wtShowSummary(){\n  const p = wtCurrent();` with the same two lines plus `\n  SH && SH.quizFinished(historyQuizId, 0, sessionPoints, bestStreak);`.
14. In `openCase`, after `  caseClean = true;\n  startRound();`, insert:
    `  historyQuizId = SH ? SH.quizStarted(SH_APP, SH_TITLE, CASES[i].id, CASES[i].title, false, CASES[i].questions.length, 'case') : null;`
15. In `caseCheckChoice`, after `  const q = CASES[caseIdx].questions[caseQ];\n  if(!ok) caseClean = false;`, insert:
    `  SH && SH.quizAnswered(historyQuizId, ok, q.q, btn.textContent, q.options.find(o=>o.c).t);`
16. In `caseCheckNum`, after `  const wantStr = fracToString(q.answer.num, q.answer.den);`, insert:
    `  SH && SH.quizAnswered(historyQuizId, ok, q.q, document.getElementById('case-answer').value.trim(), wantStr + ' ' + q.unit);`
17. Replace `function caseShowKey(){\n  const cs = CASES[caseIdx];` with the same two lines plus `\n  SH && SH.quizFinished(historyQuizId, 0, sessionPoints, bestStreak);`.

Every anchor must match exactly once; read each region first. If an anchor is not unique, say so and extend it with a neighbouring line.

- [ ] Apply. Verify:
  - The diff vs the snapshot has no removed lines.
  - `node tests/e2e/apps-e2e.js 5` gives `All 8 apps passed`, and `node tests/e2e/apps-e2e.js` still gives `All 7 apps passed`.
- [ ] Commit message: `feat(grade5): record Math Mastery quizzes, UPAC walkthroughs and case studies`

---

### Task G5: Grade 5 lobby panel + lobby e2e for both grades + panel parity test

**Files:** `lobby-grade5.html`, `tests/e2e/lobby-e2e.js`, `tests/e2e/lobby-driver.page.js`, `tests/copies.test.js`.

- [ ] **Step 1: Parity test first.** Append to `tests/copies.test.js`:
  ```js
  function lastScript(file) {
    const html = fs.readFileSync(file, 'utf8');
    return html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
  }
  test('both lobbies run the identical Parent panel script', () => {
    assert.equal(lastScript(path.join(root, 'lobby-grade5.html')), lastScript(path.join(root, 'grade 2', 'lobby.html')));
  });
  ```
  Run it and see it fail.
- [ ] **Step 2: Build the Grade 5 panel.** Copy from `grade 2/lobby.html` into `lobby-grade5.html`, in the same places:
  - `<meta charset="utf-8">`;
  - the `--good`/`--bad` tokens and the `color-scheme` lines in all three token blocks;
  - the whole Parent CSS block;
  - the `🔒 Parent` button and the full `#parent-overlay` markup, after the footer note. The one markup difference: the missing-file message reads `History file missing — copy study-history.js into the same folder as this lobby.`;
  - `<script src="study-history.js" data-grade="grade5"></script>` before the points script;
  - the panel `<script>` block at the very end, **byte-identical** to Grade 2's.
  
  Check first that `lobby-grade5.html` already defines every token the CSS uses (`--bg --card --ink --ink-soft --border --header-accent --gold-soft --gold-deep`). Leave the Grade 5 subject cards, `?reset=1` links, fresh-note and points script untouched.
- [ ] **Step 3: Lobby e2e for both grades.** `node tests/e2e/lobby-e2e.js [2|5]`, defaulting to 2.
  - Config: grade 2 → `grade 2/lobby.html`, key `grade2_history_v1`, slugs `['word-train','kuwentista']`, 8 subject options. Grade 5 → `lobby-grade5.html`, key `grade5_history_v1`, slugs `['page-turners','math-mastery']`, 9 subject options.
  - Prefix the driver with `var __E2E_KEY = '...', __E2E_APPS = ['<slug A>', '<slug B>'];`. In the driver, use `__E2E_KEY` for the key, `__E2E_APPS[0]` where it has `'word-train'`, and `__E2E_APPS[1]` where it has `'kuwentista'` (seed entries' `app` and the subject-filter value). The appTitle labels can stay as they are.
  - Add two seeded entries at 1 day ago, both on `__E2E_APPS[1]` with appTitle `'Math Mastery'`:
    - `{id:'e', type:'quiz', kind:'walkthrough', lessonTitle:'Dough problem', total:5, answered:5, correct:4, finished:true, stars:0, points:50, bestStreak:3, wrong:[{q:'Plan: What is your plan?', picked:'Add', answer:'Divide'}], t, updatedAt}`
    - `{id:'f', type:'quiz', kind:'case', lessonTitle:'Bibingka at the Fiesta', total:3, answered:1, correct:1, finished:false, stars:0, points:0, bestStreak:1, wrong:[], t, updatedAt}`
  - Update the assertions:
    - rows7 = 5;
    - rowsAll = 6;
    - allText matches `/Math Mastery · UPAC Walkthrough: Dough problem — 4\/5 steps/` and `/Math Mastery · Case Study: Bibingka at the Fiesta — stopped at 1 of 3, 1 correct/`;
    - rowsKuwentista (slug B filter) = 4;
    - afterRange (deleting day 3) = `'a,b,d,e,f'`;
    - the summary7 average becomes the mean of b (80%) and e (80%) = 80%, so the regex is unchanged;
    - "Quizzes: 2";
    - adjust study time to the seeded minutes.
  
  Reason through each number from the seed data and state it in a comment only if it is non-obvious.
- [ ] **Step 4:** Run everything:
  - `node --test` (all pass, including both parity tests);
  - `node tests/e2e/lobby-e2e.js` and `node tests/e2e/lobby-e2e.js 5` (both `Lobby passed`);
  - `node tests/e2e/apps-e2e.js` and `node tests/e2e/apps-e2e.js 5`.
- [ ] **Step 5:** Take one headless screenshot of the unlocked Grade 5 panel with seeded walkthrough and case entries, at `--window-size=1200,1600`. Save it to `C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN-IdeaProjects-school\b81f3145-3c40-4eaf-a007-96f148156e67\scratchpad\lobby5-panel.png`. Build the temp copy in the scratchpad, not the repo.
- [ ] Commit message: `feat(grade5): add the PIN-protected study history panel to the Grade 5 lobby`

---

### Task G6: Final review, docs, memory, rollout

- [ ] Whole-feature code review (fresh reviewer).
- [ ] Double-check pass, as done for Grade 2:
  - folder clean;
  - every page's scripts parse;
  - diffs vs snapshot are additive only;
  - the reset contract (stars cleared, points and history kept) in all 8 apps, on both the baseline and the current files;
  - the Grade 5 lobby cards, links and points total unchanged.
- [ ] Update the project memory and the rollout checklist.
