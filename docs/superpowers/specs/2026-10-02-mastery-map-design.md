# Mastery map (lesson medals) — design

Status: built 2026-10-02. Feature 2 of 9 in the user's game-improvement list (see `2026-10-02-spaced-review-design.md`).
Builds on spaced review: medals are worked out from the `review_v1` boxes.

## Goal

Stars reset every day and show today's effort. Medals show what she has kept over weeks: a medal needs every question
in a lesson answered right on separate days, so it cannot be earned by replaying one evening.

## User decisions

- Three tiers by box: 🥉 Bronze, 🥈 Silver, 🥇 Gold.
- A medal is never taken away; when the lesson slips below it, the medal shows 🔧 "needs a polish".
- Medals show on the game's lesson cards, on a new lobby "My Map" page, and on the parent phone page.
- First-time medals pay one-time milestone points: 🥉 +20, 🥈 +40, 🥇 +80.
- Medals she already qualifies for on the first open after the update show but pay nothing.

## Rules

### Lesson level

A lesson's level is set by its weakest question. A question with no `review_v1` item, or a tombstoned (`gone`) one, counts as box 0.

| Level | Every question at |
|---|---|
| 0 (none) | below box 2 somewhere |
| 1 🥉 Bronze | box 2+ (right once) |
| 2 🥈 Silver | box 3+ (right on 2 separate days, about a week) |
| 3 🥇 Gold | box 4+ (right on 3+ separate days, about 2-3 weeks) |

- A lesson's questions are keyed with the same `Recall.keyOf(app, reviewInfo(q))` the games use, so one question
  shared with the Mock Exam has one box.
- Math Mastery: a lesson is one skill item `math-mastery|skill:<lesson id>`, with the same thresholds.
- Block Bot lessons with `generate` (no fixed questions) have no medal; they are left out of the summary.
- A lesson with no questions is left out.

### Best, polish and pay

Per lesson the summary keeps `now` (current level), `best` (highest level ever) and `paid` (highest level paid for).

- `best = max(best, now)`. Never lowered.
- 🔧 "needs a polish" shows when `now < best`.
- When `best > paid`, the game pays the sum of the tiers between them (🥉 20, 🥈 40, 🥇 80; nothing → 🥈 pays 60)
  and sets `paid = best`. Points go to that game's points total (`kit.award`), so they reach the wallet and sync as points do.
- First open: when the summary has no entry for the app yet, every lesson gets `paid = best` with no points.
  A lesson added later (new lesson file) starts the same way: unpaid levels it already has on its first appearance are not paid.
- Re-earning a medal after a slip pays nothing (`paid` already covers it).

### When medals update

- On game open, after `Recall.tidy` (boxes can change between visits, e.g. after a sync). A medal paid here shows its
  line once at the top of the home screen.
- At the end of every round the game has (lesson quiz, Mock Exam, Review, Math Mastery rounds).
  New medals add a results line: "🏅 New Silver: Plants! +40" (Grade 2: "🏅 Bagong Pilak · New Silver: … +40").

## Data

Key `mastery_v1` in the learner space:

```json
{ "v": 1, "apps": { "life-lab": { "t": 1791000000000, "order": ["l1", "l2"],
  "lessons": { "l1": { "title": "Plants", "icon": "🌱", "now": 2, "best": 2, "paid": 2 } } } } }
```

`t` is when that app's entry was last written. Each game rewrites only its own app entry.

## Engine (`mastery.js`, new)

`recall.js` is already large, so medals get their own file. Games and lobbies load it after `recall.js`; the parent page loads it too.

- `Mastery.update(app, lessons)` where each lesson is `{ id, title, icon, keys }`, `keys` being the lesson's `review_v1` keys
  (Math: `[app + '|skill:' + id]`). It reads `review_v1`, saves the app's `mastery_v1` entry and returns
  `{ lessons: { id: { now, best, polish } }, newly: [{ id, title, level, points }], points, counts: { gold, silver, bronze, total } }`.
- `Mastery.read(storage)`, `Mastery.counts(entry)` and `Mastery.polishList(entry)` for the lobby and the parent page.
- `Mastery.badge`, `renderChip`, `showNew` and `renderMap` draw the medals; the text is in the grade's language.
- `study-kit.js`: `kit.award(pts)` adds to the points total (not the round's session points) and renders coins.

## Screens

- **Game home**: each lesson card shows its medal (🥉🥈🥇, with 🔧 when slipped) beside today's stars.
  A header chip under the points badge: "🥇 2 · 🥈 3 · 🥉 5 of 18".
- **Results**: the new-medal line under the points line.
- **Lobby**: a "🗺️ My Map" button in both lobbies opens a map panel above the games (no new page). One row per subject
  card, one tile per lesson in `order`, showing icon, title and medal. A tile links to the game like its card.
  A subject with no summary entry says "Open this game once to see its medals".
  Grade 2 text pairs Filipino with English; buttons English-only.
- **Parent page**: per child, a medal count per subject and a "Needs a polish" list (lesson titles with 🔧).

## Cloud sync

`sync-core.js`: `kindOf('mastery_v1') === 'mastery'`. Merge per app, per lesson: `best` and `paid` take the max;
`now`, `title`, `icon` and the app's `order` come from the entry with the newer app `t`. Order-independent and
safe to repeat. Two devices could each pay the same medal before syncing; accepted, as each child uses one tablet.

## Per-game changes (15 games)

1. `medalLessons()` builds the lesson list for `Mastery.update` (Math: skills; Block Bot: no `generate` lessons).
2. `updateMedals()` calls `Mastery.update`, pays with `kit.award`, and returns the new-medal line.
3. Called after `Recall.tidy` on open and in every round's finish; lesson cards and the header chip read its result.

## Tests

- `tests/mastery.test.js`: levels from boxes (unanswered = 0, gone = 0), best never drops, polish, pay difference,
  first-open no pay, later-added lesson no pay, skill levels.
- `tests/sync.test.js`: mastery merge in both orders and repeated.
- `tests/study-kit.test.js`: `award`.
- Wiring test: each game has `medalLessons`, `updateMedals`, calls it on open and at round end; lobbies link the map.
- E2E: answer a whole lesson right, move time forward and answer again → 🥈 with the right points; the lobby map tile shows it.
- PRECACHE gains `engine/mastery.js`.

## Out of scope

Badges for whole subjects, medal shop items, changing per-answer points (later milestone work).
