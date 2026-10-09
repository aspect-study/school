# Map guide and lesson path — design

Date: 2026-10-04. Status: approved in brainstorming, not yet planned.

## Why

The campus map shows many markers at once (⚔️ boss, ❗ quest, 🔁 due review, ✨ shop) and leaves the choice to her. Grade 2 especially does not know what to do first. The user wants an automatic guide, like the helper character in games that tells the hero where to go next, and each subject's lessons laid out as levels on a path.

## User decisions

- Both places: a guide on the Campus/Bayan map and a lesson path inside each of the 17 games.
- Lesson path inside each subject, **no locks**. Every lesson stays open; the guide only suggests. (Locks would block test prep when the teacher's order differs, and Silver/Gold need different days on purpose.)
- A lesson stop is **done at Bronze** (`best` ≥ 1 in `mastery_v1`), so the path and the 🏅 Medals screen always agree.
- **Urgent first, then the path**: boss stage, then due review, then a quest for a game, then the next lesson without Bronze.
- On Campus, step 4 continues in the **game she played most recently**.
- **Zigzag stops** (auto laid out), names shown on tap.
- In-app text only, no voice. Grade 5 English; Grade 2 pairs Filipino with English, buttons English only.

## 1. The picker — `web/engine/guide.js`

A pure function returns exactly one step: `{ kind, app, lesson, text, href }`. It reads only existing data: boss stages, `Recall.dueByApp()`, today's quests, `mastery_v1` (which already keeps each game's lesson `order`, `title`, `icon` and `best`), and study history for the most recent game.

**Campus order** (first match wins):

1. `boss` — a boss stage not cleared → that game with `?boss=1`.
2. `review` — the game with the most due review questions (ties: lobby card order) → `?review=1`.
3. `quest` — today's first quest that is not done **and has an `app`**. A `practice` quest opens its lesson (`?lesson=<id>`, or just the game when its title matches no lesson); `explore` → the game. A `review` quest is skipped: step 2 already sends her to due review, and with nothing due there is nothing to review. Quests without an app (stars, right, rounds, best) are skipped too; playing the path finishes them.
4. `lesson` — the first lesson in `order` whose `best` < 1, in the game she played most recently (latest study-history entry for an app on this lobby). If that game is all Bronze, the next game in lobby card order that has one → `?lesson=<id>`.
5. `visit` — a game on the lobby with no `mastery_v1` entry yet (first in card order) → the game.
6. `done` — everything above is empty → cheer; `href` is the shop when `Wallet.canAfford` is true, else none.

**In-game order** (scope = this app): boss stage → due review → a practice quest for this app → its lesson (review quests are skipped as on Campus; explore quests are for the lobby) → next lesson without Bronze in lesson order → Mock Exam while its best is below 3 stars → `home` ("🏠 This game is all Bronze! Go back to the map for your next stop").

Missing or malformed data never throws; that source is treated as empty.

**Wording:** `TEXT.grade5` English; `TEXT.grade2` "Filipino · English" pairs for every line. Examples: "⚔️ The boss is waiting in Life Lab!", "🔁 Life Lab has 3 review questions", "📘 Next stop: States of Matter", "🎉 All done today!". Grade 2 Filipino follows the existing wording rules (no "bagay" for "fits", "Ang" before a quoted subject).

## 2. Campus/Bayan guide — `web/engine/world.js`

- An HTML speech bubble above the map inside `#campus`: buddy emoji, the step text, and **Go ▶** (none when there is no `href`). HTML, not SVG text, so it reads on 360 px phones.
- The target building gets a pulsing ring; the road from the buddy's spot to it is highlighted with the existing `route()`. Under `prefers-reduced-motion` the ring is static.
- **Go ▶** acts like tapping the building (walk, then open), but opens the step's `href` (`?boss=1`, `?review=1`, `?lesson=<id>`).
- Tapping any place still works as today. Nothing is locked.
- List view shows the same bubble and Go ▶ above the cards (no walk).
- Recomputed whenever the map renders (load, `cloud-synced`, `pageshow`).
- `world.js` only renders the step; it calls `Guide.next(...)` like it calls `Boss`, `Quests` and `Recall` today.

## 3. Lesson path — `web/engine/trail.js`

- **Layout:** round stops in a center → left → center → right zigzag, joined by a dotted line; positions computed for any count (tested 1, 7, 29).
- **Stop:** lesson icon, number, medal (🥉🥈🥇) and the existing polish mark when it slipped. The guide's next stop has a larger glowing ring with the buddy (`world_v1.avatar`, read-only; default buddy when unset) beside it.
- **Tap a stop:** a small name card ("4 · States of Matter 🥉") with **Open ▶** → `openLesson(i)`. Each stop is a `<button>` with an `aria-label` of its full name.
- **Above the path:** the guide bubble with Go ▶, then the existing Mock Exam, Review and Exam Strategy cards unchanged.
- **Go ▶** calls the game's own functions: boss → `startReview(true)`, review → `startReview()`, lesson → `openLesson(i)`, mock exam → `startFinalExam()`, home → the lobby.
- **Buddy hop:** when the next stop changed since the last home view (last stop kept per device in `sessionStorage`), the buddy hops from the old stop to the new one. Reduced motion: it appears there.
- **Path ⇄ List toggle** on the game home; one setting for all games per learner in `trail_v1`; default Path. List = today's cards exactly.
- **Search:** while the 🔎 box has text, results show as today's cards; clearing it restores the path.
- **`?lesson=<id>`:** on load, opens that lesson (reviewer lock applies as usual). Unknown ids are ignored.
- **Per-game hook:** one line beside `Search.start`:
  `Trail.start({ app, list, lessons, openLesson, startReview, startFinalExam })`.
  Trail reads the lesson cards (`data-search-lesson`) in `list` and watches it, so every `renderHome()` redraw also redraws the path. `renderHome` itself does not change. Games with a different list id (e.g. `lesson-grid`) or lesson shape (Math Mastery uses `emoji`) pass their own names.

## 4. Data, wiring, tests

**Data**
- `trail_v1 { v, view, t }` — view only; synced with the default replace merge; not in backups (cosmetic, like `world_v1`).
- No new progress data. The hop's last stop lives in `sessionStorage` (device-only, never synced).

**Wiring** (one scratchpad script, as for the boss round)
- Both lobbies: `guide.js` after `boss.js`, `quests.js`, `mastery.js` and before `world.js`.
- All 17 games: `guide.js` and `trail.js` after those engines, and the `Trail.start(...)` line.
- Every page's file-check `GLOBALS` gains `guide: 'Guide', trail: 'Trail'`.
- `web/sw.js` PRECACHE gains both files.

**Unit tests** (`node --test`)
- `tests/guide.test.js`: each step in both orders, ties, most-recent game, all-Bronze fall-through, never-opened game, quests without an app skipped, done with and without an affordable reward, Grade 2 lines always paired, malformed data never throws.
- `tests/trail.test.js`: zigzag positions (1, 7, 29), next stop, medals and polish mark, toggle state, `?lesson=` handling, search hides the path.
- `tests/guide-wiring.test.js`, `tests/trail-wiring.test.js`: script order in every lobby/game, one `Trail.start` per game, GLOBALS entries, PRECACHE.

**E2E** (Chrome drivers, like `nav-e2e`)
- Lobby: with a boss stage open, the bubble names it and Go ▶ opens the game with `?boss=1`.
- Game: the path renders, Go ▶ opens the next lesson, and after a Bronze the next stop moves.
- Existing lobby, apps, search, nav and sisters e2e keep passing.

## Order of work

Family presence (`family.js`, `world.js`, both lobbies) is being built and is uncommitted. Finish and commit it first; this work builds on top of it. Then: plan → subagent-driven build.

## Out of scope

Locks or unlocks; voice; a guide inside a lesson or quiz (the reviewer lock already guides reading); new rewards for following the guide; app-less quests as guide steps.
