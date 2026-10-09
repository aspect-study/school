# Parent view: tabs and the Focus view

Date: 2026-10-05
Status: design approved by the user (tabs, 30-day default, "Practice these" later).

## Problem

The Parent view (`web/engine/parent-panel.js`, shared by both lobbies and the phone page `web/parent/`) is one long scroll: shop requests, coins, medals, shop prices, filters, a one-line summary, Needs practice (5 lessons), the real test form, the day log, then learner, backup and delete on the tablets. To see which questions she keeps missing in one subject, a parent opens every quiz row in the day log one by one. Nothing says whether a missed question has since been fixed.

## Goals (chosen by the user)

1. **Tabs** instead of one scroll: 🎯 Focus (opens first), 📚 Subjects, 🕒 Activity, 🪙 Rewards, ⚙️ Settings (tablets only).
2. **Focus**: the subjects that need the most help first. Each opens into its weakest lessons and the questions to fix: the question, what she picked, the right answer, how many times she missed it, its lesson, and a **Still missing / Fixed** chip. A wrong answer picked twice or more is flagged as "may be mixing these up".
3. **Subjects**: every subject with % right, quizzes and medals; open one for every lesson with its medal, 🔧 when a medal needs a review, and % right in the range or "No quiz in this range".
4. **Default range: Last 30 days.** The range bar sits above the tabs and drives Focus, Subjects and Activity.
5. A "Practice these" button that turns the questions to fix into her review round: built right after, see `docs/superpowers/plans/2026-10-05-practice-these.md`.

## Data

- Study history (`history_v1`) keeps, per quiz, `answered`, `correct` and `wrong: [{ q, picked, answer }]`. Right answers are not kept per question.
- Review boxes (`review_v1`) keep, per question key `app|hash(q|art|answer)`, `{ box, due, t }`. A miss puts the question in box 1. A right answer without help moves it up (box 2 or more). A right answer with help puts it in box 1. `t` is when it was last graded.
- The two cannot be joined today: history keeps plain text, and the key hashes the raw text plus the picture.

**Change:** every new wrong answer also keeps `key` (from `Recall.lastKey()`, the question the game is asking) and `t` (when she missed it). `study-history.js` reads the key through an optional fourth argument to `create`, so the 17 games need no changes.

**Status rule** (`Insights.status(key, missedAt, items)`):
- `fixed` when the question's box is 2 or more and it was graded after her last miss.
- `missing` when it has a box but not that.
- `''` (no chip) when there is no key or no box: answers saved before this change, questions asked with `review: false` (for example Grade 2 Math's number line), and Grade 5 Math, whose boxes are per lesson (`app|skill:id`), not per question.

Every question that is not `fixed` counts as **to fix**.

## Ranking

- Subjects with answers first; then most questions to fix; then lowest % right; then by name.
- Lessons (review rounds left out, as Needs practice does today): lowest % right first. A lesson is **weak** with 5 or more answers and under 80% right. Focus shows up to 3 weak lessons per subject.
- Questions: to fix before fixed; then most misses; then most recent miss. Focus shows 8 and folds the rest under "Show N more"; fixed ones fold under "Fixed (N)".
- Subject % right = right answers ÷ answers, review rounds included. This replaces the old "Average" (the mean of finished quizzes).

## Files

| File | What changes |
|---|---|
| `web/engine/insights.js` (new) | Pure: `build(entries, { subjects, items })`, `lessonRows(subject, masteryEntry)`, `status(...)`. |
| `web/engine/study-history.js` | Wrong answers keep `key` and `t`. |
| `web/engine/parent-panel.js` | Injects its own CSS; tabs; summary tiles; Focus; Subjects; subject filter only filters Activity; default range 30. The old Most missed line and Needs practice section go (Focus replaces them). `SH.weakSpots` stays: daily quests use it. |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | Parent markup regrouped into tab panels; load `insights.js`; dead `.h-summary` / `.weak-list` CSS removed. |
| `web/parent/index.html`, `web/parent/phone.js`, `web/parent/parent.css` | The same tabs (no Settings); medals move into Subjects; `renderMedals` goes. |
| `web/sw.js`, `tests/paths.js` | `insights.js` precached and staged. |
| tests | `tests/insights.test.js` (new), `tests/study-history.test.js`, `tests/browser-globals.test.js`, `tests/insights-wiring.test.js` (new), lobby e2e. |

`insights.js` is not added to the missing-file bar's GLOBALS list, the same as `mastery.js`, `quests.js` and `boss.js`. The panel shows a note when it is missing.

## Accepted gaps

- Answers saved before this change show no chip. They still count as to fix until they age out of the range.
- Grade 5 Math questions are generated, so they never show a chip; its lessons still rank by % right.
- Subjects joins medal lessons to history lessons by title (whitespace and case ignored). A lesson renamed after she played it shows twice: once with its medal and once with its old answers.
