# Daily quests and a gentle streak — design

Status: built 2026-10-02. Feature 3 of 9 in the user's game-improvement list (see `2026-10-02-spaced-review-design.md`).
Uses the celebration popups (`2026-10-02-celebrations-design.md`).

## Goal

Give her a small, doable plan for each day (about 15-20 minutes) that fits what she needs, and a streak that rewards
coming back without ever punishing a missed day.

## User decisions

- 3 quests a day, fitted to her.
- Rotate: never the same quest twice in a row when another choice also fits.
- Streak counts study days; it survives up to 2 missed days in any 7. No guilt messages.
- Small milestone pay: all 3 quests in a day, and streak milestones at 7, 14, 30 and 60 days.

## Quests

The lobby picks today's 3 quests the first time it opens that day and saves them; they do not change during the day.
Only the subjects on that lobby's cards are used. All checks read the study history (`history_v1`) entries from today
whose `finished` is true and whose time is after the quests were picked.

| Slot | Quest | When it is offered | Done when |
|---|---|---|---|
| 1 | 🔁 Do a Review round in **Life Lab** | some subject has review questions due; the one with the most due, skipping yesterday's slot-1 subject when another has some due | a Review round (`kind: 'review'`) finished in that game |
| 1 fallback | ⭐ Get 3 stars on a lesson | nothing is due | a finished round with 3 stars |
| 2 | 📘 Practice **Plants** in Life Lab | a lesson under 80% in the last 14 days (`SH.weakSpots`, plain lessons only, not the mock exam, walkthroughs or case studies); the weakest, skipping yesterday's slot-2 lesson when another is weak | a lesson quiz on that lesson finished in that game |
| 2 fallback | ✅ Get 20 answers right today | no weak lesson | 20 or more right answers across today's rounds |
| 3 | rotates through the pool below | always | see pool |

Slot 3 pool, in rotation order; each day takes the next kind after yesterday's slot-3 kind that is not already used by slot 1 or 2:

| Kind | Quest | Done when |
|---|---|---|
| rounds | 🎮 Play any 2 rounds | 2 rounds finished |
| stars | ⭐ Get 3 stars on a lesson | a finished round with 3 stars |
| right | ✅ Get 20 answers right today | 20 or more right answers |
| explore | 🧭 Play **Craft Corner** today (the subject she has not finished a round in for the longest; never-played first) | a round finished in that game |
| best | 🏅 Beat your best score on a lesson | a finished lesson quiz with more right answers than every earlier quiz on that lesson (it must have been played before) |

- Tapping a quest in the lobby opens its game (slot 1 opens it in Review mode); quests with no game are not links.
- Grade 2 text pairs Filipino with English ("🔁 Gumawa ng Review round sa Life Lab · Do a Review round in Life Lab").

## Streak

- A day is a **study day** when at least one quest was done that day.
- Going back from today (or from yesterday while today has no quest done yet, since the day is not over), the streak
  is the number of study days until some 7-day window holds 3 or more days without study.
- The lobby shows "🔥 12-day streak · 2 rest days left this week" (rest days left = 2 minus non-study days in the last 6 days that fall inside the current streak
  before today, never below 0).
- With no streak and no study days ever: "Start a streak today!". With no current streak but earlier study days:
  "Welcome back! Let's start a new streak". No message ever mentions losing a streak.

## Pay (coins, through the wallet's existing bonus)

| Milestone | Coins | Once |
|---|---|---|
| All 3 quests done | 3 (= 30 points) | per day |
| 7-day streak | 5 | per streak run |
| 14-day streak | 10 | per streak run |
| 30-day streak | 15 | per streak run |
| 60-day streak | 20 | per streak run |

A streak run is identified by its first study day, so reaching 7 again in a new run pays again; a run cannot be replayed.
The shop's "📝 N test bonus" text becomes "🎁 N bonus" (tests and quests).

## Celebrations

Via `Fx.celebrate` (merged with medal events at round end):

- Quest done: small, "🎯 Quest done: Do a Review round in Life Lab!" next "2 of 3 quests done today".
- All 3 done: big, "🎯 All 3 quests done!" line "+3 coins", next "See you tomorrow!".
- Streak milestone: big, "🔥 7-day streak!" line "+5 coins", next "Next: 14 days".

## Data

Key `quests_v1` in the learner space:

```json
{ "v": 1, "day": "2026-10-02", "at": 1791000000000,
  "list": [ { "id": "review|life-lab", "kind": "review", "app": "life-lab", "title": "Life Lab", "done": false },
            { "id": "practice|life-lab|Plants", "kind": "practice", "app": "life-lab", "title": "Life Lab", "lesson": "Plants", "done": false },
            { "id": "rounds", "kind": "rounds", "done": false } ],
  "prev": { "slot1": "life-lab", "slot2": "life-lab|Plants", "slot3": "rounds" },
  "days": ["2026-09-30", "2026-10-01"], "paidDay": "2026-10-01", "streakPaid": ["2026-09-24|7"] }
```

`days` keeps the last 60 study days. `prev` is yesterday's picks, used for rotation.

## Engine (`quests.js`, new)

- `Quests.pick(cards)` (lobby): if `day` is not today, picks today's list from `Recall.dueByApp`, `StudyHistory.weakSpots` and
  history, saves it. `cards` are the lobby's subject cards (app, title, href).
- `Quests.check()` (lobby and games): marks quests done from today's history, records today as a study day, pays the all-3
  bonus and streak milestones once (`Wallet.addBonus`), saves, and returns celebration events for what just happened.
- `Quests.streak()` → `{ days, restLeft, welcomeBack }`.
- `Quests.renderLobby(box, cards)`: the "🎯 Today's quests" card above the review card.
- Games: `showMedals` adds `Quests.check()` events to the medal events before `Fx.celebrate`.

## Cloud sync

`sync-core.js`: `kindOf('quests_v1') === 'quests'`. Merge: the later `day` wins `day/at/list/prev`; on the same day the copy with the
earlier `at` keeps its list and each quest's `done` is true if done in either; `days` and `streakPaid` are unions (last 60 days);
`paidDay` is the later. Order-independent and safe to repeat.

## Parent phone page

One line per child: "🔥 12-day streak · today 2 of 3 quests".

## Tests

- `tests/quests.test.js`: picking with and without due/weak, rotation (skips yesterday's subject/lesson/kind), each done rule,
  quests ignore rounds finished before the pick, streak rule (rest days, break, today not yet studied), pay once per day and per run.
- `tests/sync.test.js`: quests merge in both orders and repeated.
- Wiring: all 15 games and both lobbies load `quests.js`; games pass quest events to `Fx.celebrate`.
- E2E: lobby shows 3 quests and the streak; finishing a Review round in a game marks slot 1 done with a popup; all 3 done pays
  3 coins once; the parent line shows the streak.
- PRECACHE gains `engine/quests.js`.

## Out of scope

Weekly quests, parent-picked quests, quest history views, changing per-answer points.
