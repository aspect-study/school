# Spaced review (Leitner boxes) — design

Status: built 2026-10-02. Feature 1 of 9 in the user's game-improvement list
(1 spaced review, 2 mastery map, 3 daily quests + gentle streak, 4 boss round, 5 test countdown,
6 Grade 2 read-aloud, 7 Math misconception tags, 8 family goal, 9 haptics, plus moving coins toward milestones).
This feature also replaces the queued "My Mistakes" round (`docs/superpowers/prompts/2026-10-01-next-shared-engine-and-my-mistakes.md`, step 7).

## Goal

Questions come back on a schedule (1, 3, 7, 14, 30 days) and remembering after a longer gap pays more.
Replaying today pays nothing. Each game keeps its own look: review is played inside the game.

## User decisions

- Review is played inside each game; the lobby card links to it (not one mixed page — that is feature 4).
- Points: same-day retries of a mistake pay 0; a due question pays normal points plus a gap bonus.
- Every answered question enters the boxes (not only mistakes). The 3-day rest becomes "rests until due".
- Math Mastery reviews by skill (lesson), with fresh generated problems.
- Up to 10 questions per review round.

## Rules

### Question key

`<app>|<hash>` where `<hash>` is the existing `recall.js` hash of `stem|art|answer text`.
This is today's `questionKey` without the `lesson`/`exam` part, so one question has one box in
lesson quizzes, the Mock Exam and Review. Math Mastery uses `math-mastery|skill:<lesson id>`.

### Boxes

| Box | Due again after | Gap bonus when right while due |
|---|---|---|
| 1 | 1 day | +2 |
| 2 | 3 days | +4 |
| 3 | 7 days | +6 |
| 4 | 14 days | +8 |
| 5 | 30 days (stays at 5) | +10 |

Days are local calendar days, as in the current rest rule. A question is **due** when it has no item
or when today ≥ its `due` day.

### Answering (all games except Math Mastery)

| Situation | Points | Box after |
|---|---|---|
| New (no item), right unhelped | normal (+5 if typed) | 2 |
| Due, right unhelped | normal + gap bonus of its box (+5 if typed) | box + 1 (max 5) |
| Due or new, right with a power-up | half, as today | 1 |
| Due or new, wrong | 0 | 1 |
| Not due, any answer | 0, note "⏳ Resting: due in N days" | unchanged |

"Normal" is whatever the game pays today (`POINTS_PER_CORRECT` plus streak bonus, exam 20).
A not-due question skips power-ups (as resting questions do today) but still counts for stars, streak and history,
and still shows the type-it box with the "from memory" prompt.

Changes from today, stated to the user: a missed question retried the same day pays 0 (it is in box 1 until
tomorrow), and well-known questions rest up to 30 days instead of 3.

### Math Mastery (skills)

- Math Mastery now loads `recall.js`, but only for skill boxes. It still does not call `Recall.ask`;
  lesson points and the per-question no-rest rule are unchanged.
- A skill is graded at the end of any round in which it had at least 3 problems: ≥ 2/3 right unhelped → up a box,
  else box 1. A lesson quiz grades its skill this way too.
- A Review round takes up to 3 due skills, makes 3 fresh problems each (≤ 9 problems), and pays the normal
  math points plus the skill's gap bonus on each right unhelped answer.

### Review round

- `Recall.pickDue(app, questions, limit)` returns up to `limit` (10) due questions that already have an item, most overdue
  first, then lowest box, then a random order. New questions (no item) are not review; they belong to lessons.
- More due than the limit: the card says "10 of 23" and she can play again.

### Starting data (replaces "My Mistakes")

- One-time migration in `recall.js`: each `recall_v1` rest entry `<app>|<mode>|<hash>` → item `<app>|<hash>`,
  box 2, due = rest day + 3. If lesson and exam entries collide, the later day wins. `recall_v1` is kept as a safety net.
- On game open, wrong answers from the last 14 days of study history that match a current question
  (plain stem + answer, as `SH.quizAnswered` stores them) and have no item get box 1, due today.
- On game open, items for that app whose key matches none of its current questions are deleted.

## Screens

- **Lobby card** (both lobbies, top of the games list): "🔁 Review due · Science 4 · English 3 · Math 2".
  Each subject is a chip linking to the game with `?review=1`. Nothing due: "🎉 All caught up! Next review:
  tomorrow (5)". The lobby loads `recall.js` and counts from `review_v1` only. Subjects never opened since
  the update have no seeded mistakes yet; that is accepted.
- **Game home**: a "🔁 Review (4 due)" card next to the Mock Exam card; greyed with "Next: in 2 days" when none is due.
  `?review=1` starts the round on load.
- **Quiz**: the game's normal quiz screen (art, why panel, explore mode, power-ups, type-it, fx).
- **Results**: adds "📦 6 moved up a box" and the gap bonus total to the points line.
- **Grade 2 text**: Filipino paired with English (e.g. "🔁 Balikan · Review due"), buttons English-only,
  per the existing coin-text rule.

## Data

Key `review_v1` in the learner space (`learner/<id>/review_v1`):

```json
{ "v": 1, "items": { "life-lab|1a2b3c4d": { "box": 3, "due": "2026-10-09", "t": 1791000000000 } } }
```

`t` is the time of the last answer that changed the item.

## Study history

A Review round is saved as a quiz with `kind: 'review'` and title "Review". `SH.weakSpots` skips `kind: 'review'`
entries so they do not form a fake "Review" group in Needs practice.

## Cloud sync

`sync-core.js`: `kindOf('review_v1') === 'review'`, merge rule per key: the item with the larger `t` wins;
equal `t` → higher box, then later `due`. Order-independent and safe to repeat, like the other rules.

## Per-game changes (15 games)

1. Review card in `renderHome`.
2. `startReview()` built like `startFinalExam`, using `Recall.pickDue(SH_APP, allQuestions, 10)` and
   `SH.quizStarted(..., kind 'review')`.
3. `?review=1` starts it on load.

Scoring stays in `recall.js` (`Recall.points`) and `study-kit.js`.

## Tests

- `tests/recall.test.js`: box moves and due days, gap bonus, not-due rule, helped and wrong → box 1,
  `pickDue` order and limit, migration from `recall_v1`, history seeding, pruning, Math 2-of-3 grading.
- `tests/sync.test.js`: review merge in both orders and repeated.
- Static wiring test: each game has the Review card, `startReview`, `?review=1`; lobbies load `recall.js`.
- E2E: a Review round in sample games with exact points (normal + gap bonus), box moves, history entry,
  same-day retry pays 0. Lobby e2e: card counts and chip links.
- PRECACHE stays complete (`node tools/update-precache.js`).

## Out of scope

Mixed-subject rounds (feature 4), reminders, shop changes, the mastery map (feature 2, which will read `review_v1`).
