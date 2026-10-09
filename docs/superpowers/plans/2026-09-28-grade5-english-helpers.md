# Grade 5 English Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Add Grade-2-style English helpers (flashcard English box, tap-to-reveal English question, English explanation, a "🔑 Paano Sagutin?" tip card per lesson, and English on the Exam Strategy page) to `history-explorers.html` and `wikaharian.html` without changing any Filipino text.

**Spec:** `docs/superpowers/specs/2026-09-28-grade5-english-helpers-design.md`. Read its **Translation rules** section before writing any English.

**House rules:**
- Never run `git commit` (not a git repo). Give commit messages with no Co-Authored-By line.
- **Never change existing Filipino text, options, answer indexes, explanations, ids or titles.** Only add fields and tip cards.
- The app strings are single-quoted JS. Write apostrophes as `&rsquo;`, quotes as `&ldquo;`/`&rdquo;`, and dashes as `&mdash;`. Never use a raw `'` inside a string.
- After every edit, syntax-check the app's inline script with Node `vm.Script`. Write helper scripts with the Write tool, not heredocs; this shell mangles backslashes.
- Pre-change snapshot: `C:\Users\ADMIN\AppData\Local\Temp\english-before\` (both files). Never overwrite it.
- Unit tests: `node --test` from the repo root. History e2e: `node tests/e2e/apps-e2e.js 5` (600000 ms timeout).

---

### Task H1: UI support in both apps + coverage test

**Files:** `history-explorers.html`, `wikaharian.html` (identical edits); create `tests/english-helpers.test.js`.

- [ ] **Step 1: Coverage test** `tests/english-helpers.test.js`. For each of the two files:
  - extract the source of `const LESSONS = [` … its matching `];` and `const STRATEGY = [` … `];`, and evaluate each with `vm.runInNewContext('(' + arrayText + ')')`. Both are plain literals in these two apps; confirm by reading them.
  - Assert:
    - every lesson has ≥1 card, and exactly one card has `tip:true`, and it is the last card with front `🔑 Paano Sagutin?`;
    - every card has a non-empty `en`;
    - every quiz item has non-empty `qen` and `en`;
    - an item whose `q` starts with `Tama o Mali:` has a `qen` starting with `True or False:`;
    - every STRATEGY entry has a non-empty `en`;
    - no `en`/`qen` contains the Filipino string verbatim as its whole value (a guard against untranslated copies).
  
  Run it. It fails (no English yet), which is expected until H2–H4.
- [ ] **Step 2: Theme token.** In each app's CSS, add `--en:#2F6FB0;` to the light `:root` block and `--en:#8DBBEA;` to BOTH dark token blocks (`@media (prefers-color-scheme: dark)` near line 24 and `:root[data-theme="dark"]` near line 41).
- [ ] **Step 3: CSS**, appended just before `</style>`:
  ```css
  .en-box{display:none;margin-top:12px;padding:8px 12px;border-left:4px solid var(--en);border-radius:10px;background:color-mix(in srgb, var(--en) 12%, transparent);font-size:.92rem;line-height:1.5;text-align:left;}
  .en-label{display:block;font-weight:800;font-size:.72rem;letter-spacing:.05em;color:var(--en);margin-bottom:2px;}
  .q-help{display:inline-block;background:none;border:1px dashed var(--en);color:var(--en);border-radius:10px;padding:6px 12px;font:inherit;font-weight:700;font-size:.85rem;margin:0 0 12px;cursor:pointer;}
  .q-en{padding:8px 12px;margin:0 0 12px;border-left:4px solid var(--en);border-radius:10px;background:color-mix(in srgb, var(--en) 12%, transparent);font-size:.95rem;line-height:1.5;}
  .fb-en{margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);}
  .flashcard.tip{border:2px solid var(--gold);background:linear-gradient(180deg, color-mix(in srgb, var(--gold) 16%, var(--card)), var(--card));}
  ```
- [ ] **Step 4: Markup.**
  - After `<p id="flashBack" style="display:none;"></p>`, insert `<div class="en-box" id="flashEn"></div>`.
  - After `<h3 id="qText"></h3>`, insert:
    `<button class="q-help" id="qHelp" type="button" onclick="showQuestionEnglish()">🤔 Hindi maintindihan? Tingnan sa English</button>`
    `<div class="q-en" id="qEn" style="display:none;"></div>`
- [ ] **Step 5: JS.**
  - `prepareQuestion`: add `qen:q.qen, en:q.en` to the returned object.
  - `renderFlash`: after the line that sets `flashBack`'s innerHTML, insert:
    ```js
    const enBox = document.getElementById('flashEn');
    enBox.innerHTML = c.en ? '<span class="en-label">SA ENGLISH</span>' + c.en : '';
    enBox.style.display = 'none';
    document.getElementById('flashCard').classList.toggle('tip', !!c.tip);
    ```
  - `flipCard`: as the last line, insert:
    `const enBox = document.getElementById('flashEn'); enBox.style.display = !flipped && enBox.innerHTML ? 'block' : 'none';`
    Here `flipped` is its existing variable, meaning the back was showing *before* this flip.
  - `renderQuestion`: after the line setting `qText`, insert:
    ```js
    const qEn = document.getElementById('qEn');
    qEn.innerHTML = q.qen || '';
    qEn.style.display = 'none';
    document.getElementById('qHelp').style.display = q.qen ? 'inline-block' : 'none';
    ```
  - New function, next to `renderQuestion`:
    `function showQuestionEnglish(){ document.getElementById('qHelp').style.display = 'none'; document.getElementById('qEn').style.display = 'block'; }`
  - `selectOption`: change `document.getElementById('explainBox').innerHTML = q.explain;` to
    `document.getElementById('explainBox').innerHTML = q.explain + (q.en ? '<div class="fb-en"><b>Sa English:</b> ' + q.en + '</div>' : '');`
  - `renderStrategy`: after `<p>${t.body}</p>`, add
    `${t.en ? `<div class="en-box" style="display:block"><span class="en-label">SA ENGLISH</span>${t.en}</div>` : ''}`
- [ ] **Step 6:** Syntax-check both files. Run `node tests/e2e/apps-e2e.js 5`, which must still give `All 8 apps passed`. Diff both files against the snapshot and confirm the only removed lines are the 3 modified lines per file (the `prepareQuestion` return, the explainBox assignment, and the strategy `<p>` line), plus any CSS token lines you changed in place.
- [ ] Commit message: `feat(grade5): English helper UI for History Explorers and Wikaharian`

### Task H2: Wikaharian English content (5 lessons)

- [ ] For each of the 32 existing cards, add `en`. For each of the 53 quiz items, add `qen` and `en`, appended before the item's closing `}`. For each of the 7 STRATEGY tips, add `en`. Add one tip card as the LAST card of each of the 5 lessons, following the spec rules: only rules the lesson teaches. For Wikaharian, the lessons teach things like nang vs ng, the pang-angkop rules -ng/-g/na, kong vs kung, pokus sa tagaganap (who does the action is the subject), and the elements of tula/kathang-isip/teksto.
- [ ] Syntax-check. `node --test`: the Wikaharian assertions in `tests/english-helpers.test.js` must pass (History Explorers ones still fail). Run `node tests/e2e/apps-e2e.js 5`.
- [ ] Commit message: `feat(wikaharian): English helpers and Paano Sagutin tip cards`

### Task H3: History Explorers English content, lessons 1–6

- [ ] Lessons 1–6 in LESSONS order: the same additions as H2 (card `en`, quiz `qen`/`en`, a tip card per lesson). Tip-card source: the lesson's own cards and quiz explanations, the textbook Hamon reversals (see the Exam Strategy "Trap" tips), and the three "pormula" in the strategy page.
- [ ] Syntax-check and run the e2e suite.
- [ ] Commit message: `feat(history-explorers): English helpers for lessons 1-6`

### Task H4: History Explorers English content, lessons 7–12 + Exam Strategy

- [ ] Lessons 7–12 as in H3, plus `en` on every STRATEGY tip. `node --test` must now pass fully. Run the e2e suite.
- [ ] Commit message: `feat(history-explorers): English helpers for lessons 7-12 and the strategy page`

### Task H5: Fidelity check, translation review, final verification

- [ ] **Fidelity check** (a one-off script in the scratchpad): evaluate LESSONS and STRATEGY from the snapshot and from the current file. Assert:
  - the same lesson count, ids and titles;
  - for each lesson, the current cards minus the trailing tip card equal the snapshot cards when compared on `{front, back}`;
  - quiz items equal the snapshot on `{q, options, correct, explain}` and have the same count;
  - strategy entries equal the snapshot on `{kicker, title, body}`;
  - the only new keys are `en`, `qen` and `tip`.
- [ ] **Translation review** (fresh reviewer): read every Filipino/English pair and flag mistranslations, additions, omissions, wrong T/F wording, and tip-card facts not taught in the lesson. Fix the flagged items, then re-run all checks.
- [ ] Headless screenshots: the flipped card with its English box, a question with the English revealed, the explanation, a tip card, and the strategy page.
- [ ] Commit message: `test(grade5): verify English helpers leave the Filipino content untouched`
