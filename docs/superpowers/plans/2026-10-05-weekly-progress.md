# Weekly Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** At the top of the Parent view's Focus tab, a **📈 This week** block shows whether practice is working:
- each subject's % right this week (Monday to today) next to last week's, with the change;
- how many questions she fixed this week;
- what happened to the questions sent with **📌 Practice these** this week and last week ("Mon, Oct 5 · Math: 3 questions → 2 fixed, 1 still to fix").

The block ignores the range buttons: it is always this week against last week.

**Decisions (user, 2026-10-05):** weeks run Monday to Sunday (the same weeks as the weekly boss); Practice these taps are remembered and synced so the tablet and phone agree.

**House rules:** never `git commit` (stage only); comments sparingly; `insights.js` and `sync-core.js` ES5 and ASCII-only; `node --test` from the repo root.

## Data

- **Weeks:** `weekStart(ms)` is local Monday 00:00 of that day's week. This week is `[weekStart(now), now]`; last week is `[weekStart(now) - 7 days, weekStart(now))`. Use the date arithmetic `boss.js` uses (`d.getDate() - (d.getDay() + 6) % 7`), not `- 7 * 86400000`, so a DST change cannot shift a week.
- **% right per subject:** quiz entries with answers (review rounds included, as the subject % in Focus is), grouped by `app`, split by entry `t` into the two weeks. A subject appears when either week has answers.
- **Fixed this week:** use `Insights.build(allLoadedEntries, ...)` questions. A question counts when its status is `fixed` and its review item's `t` is on or after this week's start.
- **Practice record:** a new synced key `practice_v1`, `{ v: 1, sends: { <id>: { t, app, keys: [...] } } }`.
  - Each Practice these tap adds one send: id `t + '-' + random`, the tap time, the subject's app, and the keys it marked.
  - Sync merge: the union of sends by id. When both copies have the same id, keep either one, since they are identical. Drop sends more than 8 weeks older than the newest send.
  - The writer drops sends older than 8 weeks too.
- **What happened to a send:**
  - A question key counts as `fixed` when its item has `box >= 2` and `t > send.t`; otherwise it is `still to fix`.
  - A lesson key (`|skill:`) counts as `practised` when its item `t > send.t`; otherwise `not yet`.
  - A key with no item is `still to fix` or `not yet`.
- The block lists sends from this week and last week, newest first.

## Task A: engine (pure + sync)

**Files:** `web/engine/insights.js`, `web/engine/sync-core.js`, `tests/insights.test.js`, `tests/sync.test.js`

- [ ] `insights.js` exports:
  - `weekStart(ms)`.
  - `weekly(entries, o)`, with `o = { subjects, items, sends, now }`. It returns:

    ```
    { start, prevStart,
      subjects: [{ app, title, now: { answered, correct, pct }, before: { answered, correct, pct }, change }],
      fixed,
      sends: [{ id, t, app, title, questions: { total, fixed }, lessons: { total, practised } }] }
    ```

    - `change` is `now.pct - before.pct` when both weeks have answers, otherwise `null`.
    - Subjects come in `o.subjects` order, then any others found in the entries.
    - `fixed` counts the questions fixed this week, as defined in Data.
    - `sends` holds this week's and last week's sends, newest first; `title` comes from `o.subjects`, falling back to the app id.
  - `addSend(state, app, keys, now, rand)`: pure; returns the new `practice_v1` object with the send added and the 8-week prune applied. `rand` is injected so tests are deterministic.
- [ ] `sync-core.js`: `kindOf('practice_v1') === 'practice'`; add `practice` to `JSON_KINDS`; add `MERGE.practice` (union by id, then the 8-week prune measured from the newest send; ignore malformed sends; returns `{ v: 1, sends }`).
- [ ] Tests, written to fail first:
  - `weekStart` on a Sunday, a Monday and a Wednesday (local dates via `new Date(y, m, d, h)`).
  - `weekly`:
    - the two-week split;
    - the `change` value and `null` when a week is empty;
    - subject order;
    - `fixed` counts only items graded this week;
    - send outcomes for question and lesson keys;
    - sends older than last week are excluded.
  - `addSend` adds a send and prunes sends over 8 weeks old.
  - `MERGE.practice`:
    - is a union that gives the same result in either order and is safe to repeat;
    - prunes;
    - ignores junk.
  - `kindOf`, plus one sync round trip: a tablet and a phone each add a send, both sync, and both end up with both sends.
- [ ] `node --test`; stage.

## Task B: the block, the record, e2e, README

**Files:** `web/engine/parent-panel.js`, `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`, `README.md`

- [ ] **Practice these tap:** after a successful `review_v1` save, read `practice_v1` from `STORE` (anything malformed becomes `{ v: 1, sends: {} }`), apply `IN.addSend(state, s.app, keys, Date.now(), Math.random)`, then save in try/catch. A failure here does not undo the review change; it shows "Saved for review, but the practice record could not be saved."
- [ ] **The block:**
  - `renderWeek()` runs on every `renderHistory`, using `SH.list(null, null)` (all loaded history), `reviewItems()`, `practice_v1` and `o.subjects`.
  - It renders into a `div.p-section#week` created once and inserted before the Focus `.p-section` that holds `#hist-summary`, inside the Focus panel. No page markup changes.
  - Content:
    - Heading `📈 This week` with a note "Monday to today, compared with last week. The range above doesn't change this."
    - One row per subject: the title, then `{now}% right` (or `No quiz yet this week`), then `last week {before}%` (or `none last week`), and a change chip when not null. The chip reads `▲ 7` in the good colour when the change is above 0, `▼ 5` in the bad colour below 0, and `=` when 0.
    - A line `✅ Fixed this week: N questions` (N may be 0).
    - When there are sends, a "📌 Practice sent" label and one row per send, for example:
      - `Mon, Oct 5 · Math: 3 questions → 2 fixed, 1 still to fix`
      - `Mon, Oct 5 · Math: 2 lessons → 1 practised, 1 not yet`
      - When a send has both kinds, join them with `; `.
      - Use the browser's local date format for the date.
    - When neither week has answers and there are no sends, show only `No quiz answers this week or last week yet.`
  - CSS goes in the panel's CSS string, reusing the existing tokens: `.w-row` (flex, space-between), `.w-up` (good colour), `.w-down` (bad colour) and `.w-same`.
- [ ] **e2e** (lobby driver):
  - Seed quizzes for subject 0 this week (8 of 10) and last week (6 of 10); a subject-1 quiz last week only.
  - Seed a `review_v1` item for a keyed miss from last week, graded this week at box 2.
  - Seed `practice_v1` with one send this week holding that key plus a box-1 key.
  - Use the driver's `at(daysAgo, h, m)` helper. Compute "this week" and "last week" days from today's weekday so the test passes on any day: on Monday, "this week" is today only.
  - Assert:
    - the subject-0 row shows `80% right`, `last week 60%` and `▲ 20`;
    - the subject-1 row shows `No quiz yet this week` and `last week …`;
    - `Fixed this week: 1 question`;
    - the send row ends `2 questions → 1 fixed, 1 still to fix`.
  - Also assert that clicking a Practice these button writes `practice_v1` with one new send holding that subject's keys. Reuse the existing Practice these e2e block.
- [ ] **README**, Focus bullet: add "**📈 This week** compares each subject's % right with last week (Monday to Sunday), counts questions fixed this week, and shows what happened to the questions sent with Practice these."
- [ ] Run `node --test`, `node tests/e2e/lobby-e2e.js` and `node tests/e2e/lobby-e2e.js 5`; stage.

## Accepted gaps

- "Fixed this week" only counts questions missed in the loaded history (the phone loads 60 days).
- Practice taps made before this change have no record and are not listed.
- Grade 5 Math lessons count as `practised` when reviewed after the send, not `fixed`: Math review works per lesson.
