# Boss + Army — Design

Date: 2026-10-06. Build order: **after walkable 3D world phase 4** (both touch `world-main.js`, `prefs.js` and the world
e2e seeds).

## Goal

The weekly boss round (`web/engine/boss.js`, spec `2026-10-04-weekly-boss-design.md`) becomes a visible character with
an army. Each minion is one of her boss-stage questions: a right answer pops it in a cute themed burst. Clearing the
last stage pops the boss. It shows live inside the games and at the Boss Fort in the 3D world.

It is a show on top of the existing round. Scoring, coins (10 full / 4 half), review boxes, the 2-of-3 rule, retries
and stage picking do not change.

## Decisions (agreed with the user)

- Shown in both places: the army pops live in the games; the fort shows who is left and plays the big finale.
- A wrong answer: the minion giggles and stays, the next one steps up. No growing boss, no shields, nothing lost.
- 6 rotating bosses, one per week, same for both grades. Grade 2 text paired Filipino · English.
- Final pop: a quick burst in the game right away, then the full 3D finale + chest once in the fort.
- Build: shared data (`bosses.js`) + shared 2D strip (`army.js`) + real 3D chibi models (`fort-boss.js`).
- Cute, never violent: things "pop" into confetti, candy, feathers. No "mali" / "wrong" wording, never mean.

## The cast

`Bosses.ofWeek(weekKey)` = whole weeks between `'2026-10-05'` (a Monday) and `weekKey` (a `boss_v1` Monday key),
mod 6 (kept non-negative for earlier weeks). Nothing new is saved; every device agrees.

| # | id | Boss (Grade 2 pair) | Minions | Final pop |
|---|---|---|---|---|
| 0 | cloud | King Grumble Cloud (Haring Ulap-Simangot · King Grumble Cloud) | raindrops | rain turns into a rainbow |
| 1 | jelly | Jelly Jiggles (Jelly Jiggles) | gummy bears | candy rain |
| 2 | snooze | Captain Snooze (Kapitan Antok · Captain Snooze) | little pillows | feathers and Zzz |
| 3 | mess | Mr. Mess (G. Kalat · Mr. Mess) | crumpled paper balls | paper confetti, then a folded star |
| 4 | fuzz | Count Fuzzball (Konde Himulmol · Count Fuzzball) | dust bunnies | sparkle puff and a clean shine |
| 5 | spud | Queen Spud (Reyna Patatas · Queen Spud) | tater tots | popcorn shower |

Each boss entry: `{ id, name: {g5, g2}, minion: {g5, g2}, palette: {body, accent, cheek, eye}, pop: <theme id>,
lines: { hello, tease, ouch, home, beaten, dizzy } }`. Each line exists for Grade 5 (English) and Grade 2 (paired
Filipino · English). The lines are short and silly: "Bleh! Missed me!", "You'll never pop us all!", "Okay okay, you win!
See you next Monday!"

## Army rules

- One minion per question in the game: usually 3 per stage (Grade 5: 4 stages = 12; Grade 2: 3 stages = 9). A stage
  with fewer questions has fewer minions, and a Math Mastery stage can have more.
- Right answer → that minion pops. Wrong answer → it giggles and wobbles, the boss teases, the next minion steps up.
- Stage missed → "My minions go home to the fort! Try again?"; retry as today.
- A cleared stage removes its minions for good. The fort shows `Boss.STAGE_SIZE` (3) minions for each uncleared
  stage, derived from `boss_v1`, so no new army state is saved (the fort doesn't know a stage's real size until it
  is played).
- Half-cleared last week → the lobby's existing "Last week's boss" popup shows him dizzy, waddling away. No fort scene.

## In the games — `web/engine/army.js` (global `Army`)

**Hooks** (checked against the code 2026-10-06)
- Every game scores through `kit.answer` (Math Mastery also from walkthroughs and case studies). `StudyKit.answer`
  calls `win.Army && win.Army.hit(correct)` beside `Fx.correct` / `Fx.wrong`, guarded with try/catch.
  2nd Chance's first miss is caught by powerups.js before the game's handler, so it never reaches `hit`; one question
  = one `hit`.
- Each game's `startReview(boss)` calls `Army.start(currentQuizSet.length, el)` when `boss` is true, and
  `Army.stop()` otherwise. `el` is that game's quiz screen element; the strip is put first inside it.
  The minion count is the real stage size, not a fixed 3. `Recall.pickBoss` can return fewer than 3 questions, and
  Math Mastery's stage is 3 questions per skill from `Recall.weakestSkill`, which can be several skills.
- `Army.hit` does nothing unless a stage is running **and** the strip is on screen. Leaving a stage for Home and then
  opening a Math walkthrough never pops anything.
- Stage end is reported by boss.js, not by each game. The browser `stageResult` wrapper (in `mountUi`) calls
  `Army.end(result)` before it returns the popup events. `result` is `'miss'`, `'hit'` (cleared, others left),
  `'down'` (cleared, all stages done) or `'none'` (stage already cleared or old week → `Army.stop()`).
  Every game already calls `Boss.stageResult` first in `showMedals` (boss-wiring test), before `Fx.celebrate`.
- All calls are guarded: missing or broken `army.js` / `bosses.js` leaves the stage exactly as today.

**The strip**: about 90 px (64 px on phones), first inside the quiz screen, above the question. Boss SVG on the left,
bobbing, with a small line bubble (hidden when there is no room); the stage's minions on the right in one row (they
shrink to fit when there are more than 3), the next one slightly forward. It never covers the question, the answer
buttons or the nav bar.

- Right: themed burst (CSS + SVG pieces, about 0.6 s) and a new synthesized `Fx.pop()` sound.
- Wrong: giggle wobble + "tease" line.
- `'hit'`: the boss shakes, "ouch" line ("Only N stages left!"), then the existing "Boss hit!" popup.
- `'down'`: the boss puffs up and pops in the full-screen themed burst (about 1.5 s), then the existing
  "The boss is down! +10 coins" popup. fx.js gets `Fx.hold(ms)`, which pushes back the time `Fx.celebrate` waits
  for (the same way it waits for a call-out like PERFECT!), so the burst and the popup never overlap.
- `'miss'`: "home" line, retry as today.
- `prefers-reduced-motion`: pops become a quick fade plus ⭐.

SVG bosses and minions are drawn from the palette in `bosses.js`, so they match the 3D models.

## In the 3D world — `web/world/fort-boss.js`

**Boss up this week**
- The boss stands on a small stage in front of the fort gate, about twice her height, rounded chibi shapes like Mimi
  and the buddies, colors from `bosses.js`. He bobs and now and then taunts (arms up, a wink).
- Minions stand in a ring around him; count = uncleared stages × `Boss.STAGE_SIZE` from the progress snapshot. They hop out of step.
- Walking up opens the fort talk with his "hello" line (with the real count); the button stays "⚔️ Enter the Boss
  Fort!" with the existing link to the next uncleared stage. The "c of n stages cleared" badge stays.

**All stages cleared (once per week)**
- When `boss_v1` is fully cleared and `world3d_v1.bossWin !== week`: a ⭐ marker floats over the fort, and Mimi's
  step becomes "Go see the boss!" with her sparkle trail to the fort. This is set in the world's `progress.js`
  snapshot (`snap.step` / `snap.target`), **not** in `engine/guide.js`, so the 2D lobby guide is unchanged.
- At the fort: the boss wobbles, puffs up and pops in the 3D themed burst (one shared particle set, removed after). A
  treasure chest drops; she taps "Open!"; gold sparkles; the bubble says "You beat <name>! Your 10 coins are already in
  your wallet 🪙". Nothing is paid here.
- Then `world3d_v1.bossWin = week` is saved (`markDaily(storage, 'bossWin', week, now)`; `readDaily` must keep the
  new field, since today it rebuilds the object from known fields only) and the fort shows "🏆 Boss beaten! A new boss comes on Monday" with the
  open chest on the stage for the rest of the week. If she never visits the world that week, the show is skipped.

**No boss this week**: he sleeps inside, 💤 as today, Mimi's line unchanged.

**Low quality mode**: minions don't hop, the burst uses half the particles. At most 12 minions.

## Files

| File | Change |
|---|---|
| `web/engine/bosses.js` (new, pure) | roster, lines, `ofWeek(weekKey)`, `text(boss, key, grade)` |
| `web/engine/army.js` (new) | strip, `start`, `hit`, `end`, `stop`, bursts, SVG from palette |
| `web/engine/study-kit.js` | `answer` calls `Army.hit(correct)` |
| `web/engine/fx.js` | `Fx.pop()` sound; `Fx.hold(ms)` delays the next `Fx.celebrate` |
| `web/engine/boss.js` | browser `stageResult` calls `Army.end(result)`; hit / final / half popups show the boss's name and face (half = last week's boss, dizzy) |
| 17 games | `Army.start(currentQuizSet.length, <quiz screen>)` / `Army.stop()` in `startReview`; script tags for bosses.js and army.js (`data-grade`) after boss.js |
| `web/world/fort-boss.js` (new) | 3D boss, minion ring, finale, chest |
| `web/world/prefs.js` | `readDaily` / write `bossWin` |
| `web/world/progress.js` | `fort.minions`, `fort.finale` (all cleared and not shown this week); when `fort.finale`, step = "Go see the boss!", target = fort |
| `web/world/world-main.js`, `decor.js`, `text.js`, `lines.js` | create fort-boss, ⭐ marker, texts |
| world pages (bosses.js, fort-boss.js), lobbies (bosses.js, for the half popup), `tests/paths.js`, `sw.js` | load the new files; run `node tools/update-precache.js` |

## Testing

- Unit:
  - `ofWeek` is the same on every device, takes turns through all 6, and handles the year boundary and weeks before 2026-10-05.
  - Every boss has every line for both grades, Grade 2 paired, no "mali" / "wrong".
  - `Army.hit` does nothing with no stage running or with the strip hidden; the minion count follows `start(n)`.
  - `stageResult` reports `miss` / `hit` / `down` / `none` to `Army.end` correctly.
  - Fort minions = uncleared × `Boss.STAGE_SIZE`; `readDaily` keeps `bossWin`.
  - `fort.finale` is true once and then false after `bossWin`.
  - The finale step comes before Mimi's normal guide step, and only in the world.
- Wiring: `tests/army-wiring.test.js` checks all 17 games (start, stop, end, script tags); a new game must add them.
- e2e:
  - A game boss stage: 2 pops, 1 giggle, the stage clears, the existing popup opens after the burst.
  - A Math Mastery boss stage shows one minion per question.
  - The last stage: the final burst, then the coin popup.
  - World: the fort minion count; the finale plays once and saves `bossWin`.
  - The world e2e CALM seed adds `bossWin = <week>` so other cases stay calm.

## Accepted gaps

- If she leaves the game during the final burst, the coin popup may be skipped (coins are still paid, as today).
- `world3d_v1` syncs as a plain replace through the lobby, and the world pages don't sync. Another tablet can show
  the fort finale once more before its lobby pulls `bossWin`.
