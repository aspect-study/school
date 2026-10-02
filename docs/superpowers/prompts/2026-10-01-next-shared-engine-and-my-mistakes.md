# Next session: shared quiz engine (step 4), then "My Mistakes" (step 7)

The user chose this order on 2026-10-01. Do 4 first, then 7. **7 pays no points.**

Read first: memory `study-games-repo`, `power-ups`, `fair-points-anti-memorization`,
`sound-fx-streaks`, `coin-shop-decisions`. Global rules: never run `git commit`
(give the message in a code block, no Co-Authored-By), use few comments, and use imports, not inline qualified names.

## Baseline (all green on 2026-10-01)
- `node --test`: 233 pass. Run it from the repo root (`node --test tests/` does not work here)
- `node tests/e2e/apps-e2e.js` / `apps-e2e.js 5`: 7 + 8 apps
- `node tests/e2e/lobby-e2e.js [5]`, `backup-e2e.js [5]`, `file-check-e2e.js`
- The repo is in git now. Check `git status` is clean before starting, so the diff shows only this work.

## Step 4: extract the shared quiz engine into `study-kit.js`
Problem: the points/streak/round logic is copy-pasted into all 15 games, so every
feature costs 15 edits (power-ups, recall, fx, wallet badge, explore mode all did).

- **Updated 2026-10-02 (folder restructure, see `docs/superpowers/specs/2026-10-02-project-structure-design.md`):**
  there are no Grade 2 copies any more. Create one file, `web/engine/study-kit.js` (this is phase 2 of that spec),
  add it to `ENGINE_FILES` in `tests/paths.js` and to `PRECACHE` in `web/sw.js`, and load it as `../../../engine/study-kit.js`.
  Baseline is now 250 unit tests.
  Add it to the `GLOBALS` map in the `<script data-file-check>` snippet (all 17 pages, identical text;
  `tests/pages.test.js`), and to `file-check-e2e.js`.
- Candidates to move: POINTS_PER_CORRECT / STREAK_BONUS / STREAK_BONUS_AT /
  EXAM_POINTS_PER_CORRECT scoring, `totalPoints` load/save (`<slug>_points_v1`),
  `sessionPoints`/`streak`/`bestStreak` reset, `updatePointsLive` (incl. `Wallet.liveHtml()`),
  the results "points this round" line (+ `Recall.resultLine()`), the daily star
  reset (`STORAGE_KEY + '_day'`), and the `?reset=1` + `SH.appOpened` block.
  Math Mastery already has `awardPoint/startRound/pointsRoundLine`; use that as the model API.
- Leave each game's LESSONS data, screens, and the three layout families (A/B/C) alone.
- **Pure refactor: no behaviour change.** Prove it with the full e2e suites (they
  check exact point totals, streaks, recall, power-ups and history) and keep
  Math.random call order unchanged in math-mastery generators.
  Do it one family at a time (C → B → A → math) and run e2e after each.
- The new file must be copied to both tablets. Say so in the final summary.

## Step 7: "My Mistakes" replay round (no points)
Idea: replay the questions she recently got wrong, from study history.
- History quiz entries store `wrong: [{q, picked, answer}]` per app (`SH.list`).
  Match `q` back to the real question object in that app's LESSONS (stems are plain
  text via `SH.plain`. Watch reused stems in Word Train/Byte Buddies; also match on the answer).
  Math Mastery questions are generated, so decide whether to skip it or store enough to rebuild.
- **No points, no coins, no streak bonus, no stars, no recall rest-day writes.**
  Keep the learn-from-mistake panel and explore mode. Probably no power-ups (they cost coins).
  Record it in study history (e.g. `kind:'mistakes'`) so the parent sees it, without
  feeding the wallet. Check `Needs practice` (`SH.weakSpots`) is not skewed by it.
- Build it once in study-kit (that is why 4 goes first), with a per-family button on the home screen.
- Open questions to ask the user at the start: how far back (7 or 14 days?);
  drop a question once she gets it right in a later quiz?; max questions per round;
  Grade 2 copy in Taglish (with English, per `english-with-filipino-coin-text`).
- Add unit + e2e tests in the same style (perfect play, all-wrong, history entry, no points).
