# Weekly boss round — design

Status: built 2026-10-04. Feature 4 of 9 in the user's game-improvement list (see `2026-10-02-spaced-review-design.md`).
Builds on spaced review (`review_v1`), daily quests (`quests.js` patterns) and the celebration popups (`Fx.celebrate`).

## Goal

Once a week, give her a "boss" that mixes subjects: a few short review stages across the games where she most needs
review, ending in a bigger reward. It reuses each game's own review code and look; there is no mixed question page.

## User decisions

- **Boss trail**, not one mixed page: the lobby shows the boss with one stage per subject, and each stage is played inside
  that game (keeps the spaced-review rule "review is played inside each game").
- **Size:** Grade 5 has 4 stages and Grade 2 has 3. Each stage has 3 questions.
- **Stage fill:** due questions first, then her weakest boxes even if not due yet.
- **Clear rule:** 2 of 3 right clears a stage. A failed stage can be retried any number of times that week.
- **Reward:** all stages cleared = 10 coins plus a big popup. At least half cleared by the end of the week = 4 coins.
  Coins are paid through `Wallet.addBonus`.

## The week

- A boss week runs Monday 00:00 to Sunday 23:59 on the device's local clock. The week key is the date of its Monday,
  for example `2026-10-05`.
- The lobby picks the stages the first time it opens in a new week and saves them. Stages do not change during the week.
- If fewer than 2 games qualify, there is no boss yet. The lobby tries to pick again on every open that week. Once a
  boss has stages, it is never re-picked within the week.

## Picking stages

Only the games on that lobby's cards are used, as for quests. A game qualifies when:

- a normal game has at least 3 valid (not `gone`) items under its app prefix in `review_v1`, or
- Math Mastery has at least 1 valid `skill:` item.

Qualifying games are ranked by:

1. due count (`Recall.dueByApp()`), highest first,
2. then the count of items in boxes 1-2, highest first,
3. then at random.

The top N are used, where N is 4 for Grade 5 and 3 for Grade 2. If fewer than N qualify but at least 2 do, the boss has
that many stages.

## Playing a stage

- The lobby's boss card has one row per stage. A row that is not cleared links to the game with `?boss=1`. A cleared row
  has a ✅ and no link.
- A game opened with `?boss=1` whose app is an uncleared stage of the current week starts a boss round straight away.
  Otherwise (stage cleared, week rolled over, or the game is not a stage) it opens its home screen as usual.
- The round is titled "🐉 Boss stage" (Grade 2: "🐉 Boss stage · Laban sa Boss"). It looks like that game's normal
  review round.
- **Questions** (normal games): `Recall.pickBoss(app, pool, info, 3)` returns
  1. due questions, most overdue first, then lowest box (same order as `pickDue`),
  2. then non-due questions in boxes 1-2, lowest box first, then most recently answered first,
  3. then non-due questions in the lowest remaining boxes.

  Questions are picked when the stage starts, not on Monday, so they are always current.
- **Pay per question:** normal review rules, with no special cases. A due question pays points plus the gap bonus and
  moves up a box. A non-due question is resting, so it pays 0 and its box does not move. A wrong answer drops it to box 1
  as usual.
- **Math Mastery:** the stage is 3 fresh problems from one skill: the most overdue due skill, otherwise the skill with
  the lowest box (ties: earliest due). `gradeSkill` runs as usual, so the box changes only when the skill was due.
  Points follow the normal Math lesson rules for generated problems.
- **Power-ups:** allowed, as in a normal review round. A helped right answer counts as right for the clear rule.
- **History:** a stage is logged with `SH.quizStarted(..., 'review')`, the same kind as a review round, so it also
  completes the daily quest "Do a Review round in <game>".

## Clearing

- At the end of the round the game calls `Boss.stageResult(app, right, total)`.
- `right * 3 >= total * 2` (2 of 3) marks the stage `cleared` and returns a small celebration event:
  "⚔️ Boss hit! Science stage cleared", with the next step "Next stage: Filipino" or the boss result.
- Otherwise it returns a small event "Almost! Try the boss stage again" and the stage stays open.
- When the last stage is cleared, the boss is beaten. `stageResult` pays 10 coins and returns a big event:
  "🐉 You beat the Weekly Boss! +10 coins".
- The events go into the game's existing `showMedals` → `Fx.celebrate(events, el)` call, together with medal and quest
  events.
- If `total < 3` (a pool too small to fill the stage), the result still counts with the same 2-of-3 ratio.

## Reward and settling

- **Full:** all stages cleared pays 10 coins at once, from `stageResult`. The pay mark is `<week>|full`.
- **Half:** when the lobby opens in a later week and the old boss has at least half its stages cleared (rounded up:
  2 of 4, 2 of 3, 1 of 2) but not all, it pays 4 coins with mark `<week>|half`. It then shows one small popup
  ("Last week's boss: 3 of 4 stages, +4 coins") and picks the new boss.
- **Less than half:** no pay and no popup. The card just shows the new boss, with no mention of last week.
- **A failed payment:** when a reward is owed for last week but the coins cannot be paid, last week is kept as it was,
  and the next lobby open tries again.
- **Clock moved back:** when the saved week is later than the device's week, nothing changes.
- **Never twice:** a week can have at most one of `full` or `half`. As in quests, the mark is saved before calling
  `addBonus`, and the mark is removed if `addBonus` fails.

## Lobby card

```
🐉 Weekly Boss — until Sunday
███████░░░            (boss HP: the stages still to clear)
2 of 4 stages cleared
  ✅ Life Lab
  ✅ Wikaharian
  ⚔️ History Explorers   ← link
  ⚔️ Math Mastery        ← link
```

- It sits under the daily quests. It re-renders on `cloud-synced` and `pageshow`, as quests do.
- When the boss is beaten, the card shows "🐉 Boss beaten! New boss on Monday".
- With no boss yet, it shows "🐉 The boss comes when you've played a few games" (Grade 2 paired with Filipino).
- Grade 2 text follows the Grade 2 coin-text rule: Filipino is always paired with English, and buttons are English
  only.

## Parent phone page

One line under the streak line: "🐉 Weekly boss: 2 of 4 stages" (or "beaten", or "not started"). The tablet needs no
extra line, because its lobby already shows the boss card.

## Data

`boss_v1` in the learner space:

```
{ v: 1,
  week: '2026-10-05',
  stages: [ { app: 'life-lab', title: 'Life Lab', cleared: true }, ... ],
  paid: [ '2026-09-28|half', '2026-10-05|full' ] }
```

- `title` is the lobby card's name, saved so a game can say "Next stage: Wikaharian".
- Only the current week's stages are kept. The `paid` list keeps the last 60 entries.
- `MERGE.boss` in sync-core:
  - The newer `week` wins for `week` and `stages`.
  - On the same week, the stage list of the copy that has stages is kept. If both have stages but the lists differ (two
    offline devices picked differently), the one with more cleared stages wins, then the lexically smaller app list.
  - Each stage's `cleared` is OR-ed when both copies have the same app.
  - `paid` is the union of both lists.
- `kindOf('boss_v1') === 'boss'`. It is added to the JSON kinds in `readLocal`/`writeLocal`.

## Code

- **`web/engine/boss.js`** (new). `create(deps)` takes storage, `now`, grade, `due()` (= `Recall.dueByApp`),
  `items()` (the raw `review_v1` items) and `bonus(coins)` (= `Wallet.addBonus`), so it can be unit-tested like
  `quests.js`. Exports:
  - `weekKey(ms)`
  - `ensure(cards)`: picks or keeps this week's stages, settles last week, and returns events
  - `stageResult(app, right, total)`: returns events
  - `isStage(app)`
  - `renderLobby(box, cards)`
  - `parentLine(state, nowMs)`: for the parent phone page
  - `wantsBoss`: `?boss=1` in the URL
  - `linkFor(app, cards)`
- **`web/engine/recall.js`:** add `pickBoss(app, questions, info, n)` and `weakestSkill(app, ids)`.
- **Each game (all 17):**
  - load `boss.js` after `quests.js`
  - `startReview(boss)`: with `boss` true it picks with `Recall.pickBoss` (Math: `Recall.weakestSkill`), titles the
    round with `Boss.text.stageTitle` and sets `currentQuizMeta.boss = true`. `currentQuizMeta.id` stays `'review'`,
    so history, retry and Math's skill bonus work as in a review round.
  - Retry replays the boss round while the stage is still open (`bossAgain()`), otherwise a normal review.
  - `bossEvents(el)` calls `Boss.stageResult` once per finished boss round, and its events are added to the
    `Fx.celebrate` call in `showMedals`.
  - `else if (window.Recall && window.Boss && Boss.wantsBoss && Boss.isStage(SH_APP)) startReview(true);` runs right
    after the `?review=1` check at the end of the script.
- **Lobbies:** `showQuests` also calls `Boss.ensure(cards)` and `Boss.renderLobby`, and celebrates the boss and quest
  events in one `Fx.celebrate` call (a second call would replace the first).
- **Parent phone page:** add the status line (`Boss.parentLine`).
- **`sw.js`:** add `boss.js` to PRECACHE (test-enforced).

## Testing

- **`tests/boss.test.js`:**
  - week key on Sunday, Monday and across a year end
  - picking: ranking, the qualify rules (3 items; Math 1 skill), only lobby cards, fewer than 2 games gives no boss and
    re-picks later, the stages are kept within the week
  - clear rule: 2 of 3, 1 of 3, retry after a fail, and a cleared stage is not counted twice
  - full pay once
  - half pay on rollover; no pay under half; never both half and full
  - the pay mark is undone when the bonus fails
  - Grade 2 has 3 stages and paired text
- **`tests/recall.test.js`:** `pickBoss` order and fill; `weakestSkill`.
- **`tests/sync.test.js`:** the `MERGE.boss` rules, and two devices clearing different stages.
- **`tests/boss-wiring.test.js`:** every game in `tests/paths.js` APPS has `startBoss`, the `wantsBoss` check,
  `stageResult` in the celebrate path and the `boss.js` tag; both lobbies have the `#boss` card.
- **E2E:** a boss stage in one normal game and in Math Mastery (cleared and failed), and the lobby card after a cleared
  stage.

## Accepted gaps

- Changing the tablet clock can start a new week early (same as quests and review).
- Two offline devices can each pay the same week's reward before they sync.
- If a game's lesson files fail to load, the stage cannot start. The game opens its home screen, and the stage stays
  open.

## Not doing

- A boss quest kind in the daily quests (stages already count as review rounds).
- Boss art or animation beyond the HP bar and the existing popups.
