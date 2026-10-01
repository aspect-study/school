# Fair Points (anti-memorization) — Design

Date: 2026-10-01. Decided with the parent in conversation; the options are numbered as they were offered (1, 5, 7, 10).

## Goal
Each lesson has a fixed bank of about 10 questions, and every replay paid full points. Since points became coins that buy real rewards ([coin shop](2026-10-01-coin-shop-design.md)), a child can earn by replaying a lesson until she recognises the questions. The goal is to make **remembering the facts over time** the only way to earn, without making practice feel worse.

Out of scope: stars, explore mode, the learn-from-mistakes panel, the study history's existing fields, and the coin conversion rate (10 points = 1 coin) all stay as they are.

## The four rules
| # | Rule | Applies to |
|---|---|---|
| 1 | A question answered right **unhelped** pays no points for the next 3 local calendar days | 14 games (Math Mastery exempt) |
| 5 | Optional "type it first" on marked questions: a correct typed answer earns **+5 bonus** | 14 games (Math Mastery exempt) |
| 7 | Mock exam pays **20** per correct answer, compared with 10 in a lesson quiz | all 15 games |
| 10 | The parent enters a real school test score in the lobby (PIN 0108) to earn bonus coins | both lobbies |

## Shared module: `recall.js`
- A new file at the root, `recall.js`, plus a byte-identical copy at `grade 2/recall-grade2.js` (the copies test enforces that they match). It's loaded with `<script src="…" data-grade="grade2|grade5">` after the wallet, fx and power-ups tags.
- It exposes `window.Recall`. The pure functions are also exported to Node for unit tests, using the same `create(storage, now, grade)` pattern as `wallet.js`.
- If the file is missing on a tablet, every game still plays with today's rules: every hook is guarded with `window.Recall && …`, there's no cooldown and no typing box, and the exam still pays 20 (that rule lives in each game).

### Storage
- Key `<grade>_recall_v1`, holding `{ v: 1, rest: { "<app>|<mode>|<qkey>": "YYYY-MM-DD" } }`.
  - `mode` is `lesson` or `exam`.
  - The value is the local date the question last paid points.
- On load, entries whose date is 3 or more days old are deleted, so the store never grows without limit.
- Bad or missing JSON is read as an empty store. It's the same defensive read as the wallet's, and storage access is wrapped in try/catch.

### Question key (`qkey`)
- `qkey = hash(stem + "|" + art + "|" + correct answer text)`, a short 32-bit FNV-1a in hex. `art` is the picture (`q.art`, or Byte Buddies' `item.pic`), or `''` when there's none.
- The answer text is there because Word Train and Byte Buddies reuse a stem with different answers ("Which of these is a common noun?": book, and also dog).
- Picture questions such as Block Bot's "How much money is this?" share a stem, so the picture is part of the key.
- The lesson is deliberately left out, so `prepareQuestion` doesn't have to carry a lesson id. If two lessons ever had an identical stem and picture, they would share one rest, which is harmless.
- Questions don't need ids, and no existing question is edited.
- If a stem's wording changes later, the question simply counts as new, which is harmless.

### API (browser)
- `Recall.ask(pu, app, typeIt)` replaces the game's direct `PowerUps.offer(pu)` call at the end of `renderQuestion`.
  - `pu` is the object the game already builds for power-ups, plus `art`.
  - Recall starts the question, shows the rest note or the typing box, and calls `PowerUps.offer(pu)` only when power-ups should show. Otherwise it calls the new `PowerUps.skip()`.
- `Recall.points(helped, base, streakBonus)` is called from the correct-answer branch. It returns the points for this answer: 0 if resting, plus the +5 typed bonus. When the answer was unhelped and not resting, it also records today's date.
- `Recall.typed()` says whether the current question was answered by typing; it's passed to the history.
- `Recall.resultLine()` returns the extra results-screen text, or `''`.
- The Node export has the pure parts: `create(storage, now, grade)`, `matches(typed, answer, accept)`, `normalize`, `questionKey`, `TEXT`, `REST_DAYS`, `TYPED_BONUS`.

### `powerups.js` gains `skip()`
`PowerUps.skip()` clears the current question's power-up state and removes the bar from the page. Without it, the previous question's bar would stay on screen over a resting or not-yet-revealed typed question.

## Rule 1: resting questions
- **Starts resting:** a correct answer that was not helped. "Helped" has the same meaning as in power-ups: Hint, 50/50 or Ask Family was used, or a Second Chance was actually needed. A typed-correct answer counts as unhelped.
- **Doesn't start resting:** a wrong answer, or a helped right answer. The question can then pay full points next time.
- **Rest length:** 3 local calendar days. Paid on day D, it pays again from day D+3 (Monday → Thursday). The comparison uses dates, not hours, so the time of day doesn't matter.
- **Lesson quiz and mock exam rest separately** (`mode` in the key). One question can pay once in each mode per 3 days. Otherwise, doing a lesson first would leave the exam paying nothing.
- **A resting question still counts normally for** the score, stars, streak, best streak and study history. Only the points are 0:
  - The streak still grows, so the next question that pays gets the bonus.
  - A small note appears above the choices, for example `⏳ Resting: points again in 2 days` (Grade 2: Filipino always paired with English, the same rule as the coin text).
- **No power-ups on a resting question.** The bar isn't offered, so she can't spend coins for 0 points. In practice, `PowerUps.offer` isn't called when `resting > 0`.
- **Results screen:** an extra line under the points line, for example `⏳ 3 questions were resting — they'll pay again soon.`
- **Math Mastery is exempt.** Its quiz, walkthrough and case questions are generated with new numbers each time, so it never calls `Recall.resting` or `Recall.paid`.
- **Block Bot's number-line questions** are typed by design already. They rest like any other question, and the key is built from the stem plus `start` and `jumps`.

## Rule 5: type it first
### Which questions
- Each game has one hand-written map, `TYPE_IT = { '<exact stem as in the source>': ['other accepted answer', …] }`, placed right after its lessons array. An empty array means only the correct option's text is accepted.
- Using a map keeps the quiz items and every `prepareQuestion` untouched.
- A test fails if a key doesn't match a real stem in that game.
- A question qualifies only if all of these hold:
  - its correct answer is short: 1–3 words, or a number;
  - the answer can be given **without seeing the choices**;
  - it isn't True/False;
  - it isn't a "Which of these…", "Alin sa mga…" or "NOT"/"HINDI" question;
  - its answer isn't a sentence picked from a passage.
- When in doubt, leave it unmarked.
- Math Mastery isn't marked (it's generated). Block Bot's number line already takes typed input and is left as it is.
- A unit test checks every `TYPE_IT` entry against the rules above that a program can check (answer length, not T/F, stem patterns).

### Flow (lesson quiz and mock exam)
1. When a marked question appears, the option buttons are hidden. In their place is a text box with **✏️ Check** and **Show choices**. Grade 2 labels follow the coin-text rule, so Filipino is always paired with English and the buttons are English-only.
2. **She types an answer and taps Check.**
   - **Right:** the game handles it exactly as if she had picked the correct option: the same scoring path, feedback, explanation and explore mode, with the choices then shown so she can explore them. It also adds a **+5 bonus**, and the line reads `✏️ +5 typed it!`.
     - If the question is resting, the base points and the bonus are both 0.
     - The streak, stars and history behave as for a normal correct pick.
   - **Wrong:** the choices appear with a gentle note (`Not quite — pick from the choices`). She then picks as normal, and there's no penalty: the normal points still apply.
3. **She taps Show choices:** an ordinary question, with no bonus.
4. Power-ups (lesson quiz only) are offered only after the choices are showing. Once the choices are shown, a typed bonus isn't possible any more.

### Matching (`Recall.matches`)
1. Normalise both strings:
   - lower-case;
   - remove accents (`NFD`, then strip combining marks; `ñ` becomes `n`);
   - turn punctuation into spaces;
   - collapse runs of spaces and trim.
2. Compare the result against the correct option's text **and** every `accept` entry.
3. It's a match if the strings are equal, or if the target has 5 or more letters and the edit distance is ≤ 1 (one typo).
4. Numbers have to match exactly; no typo is allowed in a digit string.
5. An empty input is never a match.

### History
- `SH.quizAnswered` gains an optional 6th argument, `typed`. When it's true, the quiz entry's `typed` count goes up by 1. The Parent panel adds ` · ✏️ N typed` to that quiz's line. The CSV is unchanged.
- The resting state isn't recorded, because the history already keeps the date of every answer.

## Rule 7: the mock exam pays double
- Each game adds `EXAM_POINTS_PER_CORRECT = 20`.
- In the answer handler, the base is `currentQuizMeta.id === 'final' ? EXAM_POINTS_PER_CORRECT : POINTS_PER_CORRECT`. The exam id is `final` in every game.
- The streak bonus (+5 from 3 in a row) is unchanged.
- There are no power-ups in exams (as today), so the "helped = half points" rule never meets the exam.
- Math Mastery: only its Full Mock Exam pays 20. The UPAC walkthrough and case studies keep 10.

## Rule 10: real test score bonus
- The 🔒 Parent panel in both lobbies (PIN 0108) gets a **📝 Real test score** form with these fields:
  - **Subject:** a dropdown of that lobby's game cards.
  - **Test name:** free text, required, for example "Science ST1".
  - **Score** and **total:** whole numbers, with 0 ≤ score ≤ total and total ≥ 1.
- As the form is filled in, it previews the coins:

  | Percent | Coins |
  |---|---|
  | 100% | 50 |
  | ≥ 90% | 40 |
  | ≥ 80% | 30 |
  | below 80% | 10 (for trying) |

  The percent is `score / total`, compared without rounding, so 14/15 = 93.3% gives 40.
- **Approve** adds the coins:
  - Wallet: there's a new `bonus` field (default 0), and the balance becomes `40 + earned + bonus − spent`. Old wallets without the field read it as 0.
  - New `Wallet.addBonus(coins)`.
  - The tiers live in the wallet file as `TEST_BONUS_TIERS`, the one place to edit them.
- **Duplicate guard:** if the same subject and test name (case-insensitive) is already in the history, the first tap on Add shows "Already added on <date>. Tap Add again to add it again." Only a second tap saves. This uses the same tap-twice pattern as power-ups, with no browser dialog.
- If the wallet file is missing, the section is hidden.
- **History:** a new entry type `test` (`app`, `appTitle`, `testName`, `score`, `total`, `coins`).
  - It shows in the Parent panel list and in the CSV export with those columns.
  - It's **never auto-pruned**; only purchases are pruned after 7 days.
  - The existing delete-range action does remove it, but deleting a history entry never takes coins back (same as purchases).
- The coin guide gets a line telling the kids about it.

## Coin guide
New sections in `GUIDE_TEXT` (Grade 5 English; Grade 2 Taglish with an English 4th element, as before):
- **Resting questions:** "After you get a question right, it rests for 3 days. You can still practise it, but it pays points again only after the rest. Remembering after days is what counts!"
- **Type it first:** "See ✏️? Type the answer before looking at the choices for +5 bonus."
- **Mock exam:** "Mock exam answers are worth 20 points, double a lesson quiz."
- **Real test bonus:** "Show your real test score to Mommy or Tatay for up to 50 coins."

The two grades' key sets must still match, as `wallet.test.js` already checks.

## Per-game hook contract
This is enforced by a new `tests/recall.test.js`. Every game except Math Mastery needs items 1–6; Math Mastery needs only item 2, through `awardPoint(…, exam)`.
1. The `recall.js` / `recall-grade2.js` script tag with `data-grade`, after the power-ups tag.
2. `EXAM_POINTS_PER_CORRECT = 20` beside `POINTS_PER_CORRECT`, plus the base switch in every points line.
3. One helper, `offerQuestion(pu)`: `Recall.ask(pu, SH_APP, TYPE_IT)` when Recall loaded, else `PowerUps.offer(pu)`. Every former `PowerUps.offer(` call site uses it and adds `art` where the game has pictures.
4. Points: `pts = window.Recall ? Recall.points(helped, base, bonus) : helped ? base / 2 : base + bonus`.
5. `SH.quizAnswered(…, window.Recall ? Recall.typed() : false)`.
6. Results: `ptsLine + (window.Recall ? Recall.resultLine() : '')`, and a `TYPE_IT` map (it may be `{}`).

## Testing
- **Unit (`node --test`):**
  - `recall.test.js`: the matching rules (accents, punctuation, one typo only at 5+ letters, exact digits, empty input); the rest timing on day D, D+2 and D+3, including across a month end; that lesson and exam modes are separate; pruning; bad JSON; the qkey for picture questions.
  - `recall.test.js`: the per-game hooks, and that every `TYPE_IT` key is a real stem and passes the eligibility checks.
  - `wallet.test.js`: the `bonus` field, `addBonus`, the tiers at their edges (100 / 90 / 89.9 / 80 / 79.9), and that old wallets read bonus as 0.
  - `copies.test.js`: `recall.js` = `grade 2/recall-grade2.js`.
  - `study-history.test.js`: the `test` entry, the CSV columns, that it's exempt from pruning, and the `typed` flag.
- **E2E** (`tests/e2e/apps-e2e.js`, new mode `#e2e=recall`, both grades): play a lesson perfectly, then again on the same day.
  - The second round pays 0 points, has the same stars and score, and shows the resting line.
  - Move every stored rest date back 3 days in localStorage, then replay: it pays again.
  - The mock exam pays `20n + 5·max(0, n−2)` when played perfectly.
  - A typed-correct answer earns base + 5.
  - A typed-wrong answer shows the choices and pays normally.
  - The power-up bar is absent on a resting question.
  - Existing modes still pass. The random order means running more than once, as with power-ups.
- **Lobby E2E:** the Parent panel test-score form previews the right coins, Approve raises the balance, and the duplicate warning appears on a second entry.

## Rollout notes
- Copy these to the tablets:
  - **Grade 5:** `recall.js`, `wallet.js`, `study-history.js`, `powerups.js`, `lobby-grade5.html`, and every Grade 5 game `.html`.
  - **Grade 2:** `grade 2/recall-grade2.js`, `wallet-grade2.js`, `study-history-grade2.js`, `powerups-grade2.js`, `lobby.html`, and every Grade 2 game `.html`.
- `recall.js` and `grade 2/recall-grade2.js` must be copied to the tablets along with the games, as with the wallet and power-ups files.
- Existing points and coins are untouched. Resting starts empty, so every question pays once more the first day after the update.
