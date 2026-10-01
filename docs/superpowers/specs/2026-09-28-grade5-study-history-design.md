# Grade 5 Study History — Design Addendum

Date: 2026-09-28
Builds on: `2026-09-28-grade2-study-history-design.md`. Everything there applies
unless changed below.

## Decisions (user, 2026-09-28)

- Same PIN, **0108**.
- Math Mastery records **all three modes**: quizzes, UPAC Walkthrough problems, and
  Case Studies.

## Scope

- `lobby-grade5.html` plus 8 apps at the repo root: `history-explorers`, `wikaharian`,
  `math-mastery`, `page-turners`, `rise-shine`, `rally-ready`, `craft-corner`, `life-lab`.

## Shared script: two identical copies

- The Grade 5 pages live at the repo root and Grade 2's in `grade 2/`. Each device may
  hold only one folder, so each folder gets its own `study-history.js`. The two copies are
  **byte-identical**, and a unit test fails if they ever differ.
- The page picks the storage keys: `<script src="study-history.js" data-grade="grade5">`.
  With no attribute the prefix is `grade2`, so Grade 2 pages need no change.
  - Keys: `<grade>_history_v1`, `<grade>_history_error_v1`, `<grade>_history_corrupt_v1_<t>`.
  - The two grades' histories stay separate even on a laptop that holds both folders,
    and each lobby shows only its own grade.

## Library changes (both copies)

1. **Distinct cards.** `cardViewed` records each card number once (`seen` list), and
   `cardsViewed = seen.length`. Grade 5 flashcards wrap around (Previous on card 1 goes to
   the last card), so the old "furthest card" count would overstate what she viewed.
   Grade 2's linear cards give the same numbers as before.
2. **Round kinds.** `quizStarted(..., total, kind)` takes an optional `kind` of
   `'walkthrough'` or `'case'`, stored on the entry. The CSV `Type` column shows
   `UPAC walkthrough` / `Case study`.
3. **Grade-tagged backups.** `exportJson` stamps `grade: <prefix>`, and `importJson` rejects
   a backup whose `grade` is present and differs from the importing page's own prefix
   (`'This backup is from a different grade (<grade>).'`), so a Grade 5 export can't be
   loaded into Grade 2's history or vice versa. Older, grade-less backups still import.

## Math Mastery mapping

| mode | one entry is | `total` | a wrong answer records |
|---|---|---|---|
| quiz / Full Practice Test | one quiz | questions | question, pick, answer |
| UPAC Walkthrough | one problem (title = its first ~60 characters) | 5 steps | step prompt, what she picked or typed, the right one |
| Case Study | one case (its title) | its follow-up questions | question, pick or typed answer, right answer |

Walkthrough and case entries have no stars (the app gives none), so `stars` is 0 and the
lobby hides it (the CSV `Stars` column is blank for any `kind` entry, not just `0`).
Leaving mid-problem or mid-case leaves the entry unfinished, as for quizzes.

Every walkthrough wrong-answer question also appends `[<problem>]` (the same shortened
title used for the entry's `lessonTitle`), so "Most missed" does not merge the same step
prompt (e.g. "Plan: What is your plan?") asked across different problems.

## The other 7 apps

They share one layout (all built from Rise & Shine), so every app gets the same
hooks. Picture questions (Rise & Shine traffic signs, `q.art`) append `[correct answer]`
to the question text, so "Most missed" does not merge different signs.

## Lobby

- `lobby-grade5.html` gets the same Parent link, PIN pad and History panel. The panel
  **script** is identical in both lobbies, and a unit test compares them. Only the markup
  differs (the missing-file message names the right folder).
- Both panels learn the two new kinds:
  - 🧩 `Math Mastery · UPAC Walkthrough: <problem> — 4/5 steps …`
  - 📋 `Math Mastery · Case Study: <title> — 2/3 …`

## Testing

- **Unit tests:** distinct cards, `kind`, the `data-grade` prefix via `create(storage, now, 'grade5')`, and the copy parity checks.
- **E2E:** `apps-e2e.js` and `lobby-e2e.js` take a grade argument (`2` or `5`).
  - Grade 5 adds a family-C driver and a Math Mastery driver covering walkthrough and case scenarios.
  - Expected points: a flawless walkthrough problem = 65, a flawless 3-question case = 35.
