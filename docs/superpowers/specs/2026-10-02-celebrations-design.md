# Celebration popups — design

Status: built 2026-10-02. Built between feature 2 (mastery map) and feature 3 (daily quests) of the user's list,
as a shared piece that later features (quests, boss round, family goal) will call.

## Goal

When she reaches a real milestone, a short popup celebrates it: what she did, in specific words, and one gentle next step.
Rare enough to stay special, never in the middle of a question, never about losing anything.

## User decisions

- Moments now: new medal, subject milestone, fixed mistakes. (Shop-goal popups were left out: they would put coins in the spotlight.)
- Each popup shows one gentle next step.
- Built before feature 3, as one shared piece.

## Moments

At most one popup per round end or game open; several events merge into one popup.

| Moment | Size | Headline (Grade 5) | What she did | Next step |
|---|---|---|---|---|
| New 🥉 | small | 🥉 Bronze: Plants! | You got all 12 questions right. | 🥈 next: get them right again in 3 days |
| New 🥈 | big | 🥈 Silver: Plants! | All 12 right on 2 different days. | 🥇 next: once more in about 7 days |
| New 🥇 | big | 🥇 Gold: Plants! | All 12 right on 3 different days. | It comes back in 2 weeks to stay strong |
| Subject milestone | big | 🏆 All of Life Lab is Bronze! (the game's name) | Every lesson has 🥉 or better. | Next: all-Silver, 4 lessons to go |
| Fixed mistakes | small | 🔧 You fixed 3 mistakes! | 3 questions you missed before are right now. | They come back in 3 days to check |

Rules:

- **Medal**: one event per newly paid medal (`Mastery.update(...).newly`), with the lesson's question count. The next-step days follow the box days
  (box 2 → 3 days, box 3 → 7 days, box 4 → 14 days).
- **Subject milestone**: the subject's level is the lowest `best` among its shown lessons (`order`). When an update raises it (1 → all-Bronze,
  2 → all-Silver, 3 → all-Gold), one event. Not on the first report of an app (no saved entry yet). No points. The next step counts the lessons
  still below the next level ("Next: all-Silver, 4 lessons to go"); at all-Gold: "Every lesson is Gold. Amazing!".
- **Fixed mistakes**: in a round, a question that was in box 1 and is answered right, unhelped, while due (so it moves to box 2). A same-day retry
  of a miss is resting and does not count. Shown when at least 1. Math Mastery reviews by skill and has no fixed-mistakes event.
- Merge: the headline is the biggest event (subject > gold > silver > bronze > fixed); up to 3 more events are listed under it as one line each.
  Big when any event is big.
- Grade 2: Filipino paired with English ("🥈 Pilak · Silver: Halaman!", "Inayos mo ang 3 mali · You fixed 3 mistakes!"); the button stays English.

## Behaviour

- A centred card over a dim backdrop (`role="dialog"`, `aria-modal`, labelled by the headline). Focus moves to its button and back after.
- Small: the medal drops in, soft chime. Big: the medal flips, confetti, fanfare.
- Waits while an `fx.js` call-out (for example "PERFECT!") is on screen, then shows.
- Closes on tap anywhere, the "Nice!" button, or Esc; or by itself after 4 s (small) or 6 s (big).
- Mute key silences it; `prefers-reduced-motion` gives a plain fade with no flip or confetti.
- Shown on the results screen after a round, and on the game home when a medal is paid on open.
- Never blocks a question: games only call it at round end and on open.

## Engine

- `fx.js`: `Fx.celebrate(events)` draws, plays and closes the popup. An empty list does nothing. A second call while one is open replaces it.
  Each event is `{ big, icon, title, line, next }` (plain text, set with `textContent`).
- `mastery.js`:
  - `update` also returns `count` per newly paid medal and `subjectUp` (0 or the new subject level), plus `toNext` (lessons below the next level).
  - `Mastery.events(result, fixed)` builds the ordered event list in the grade's language.
- `recall.js`: counts fixed mistakes per round; `Recall.fixed()` returns the count for the current round.
- Each game's existing `showMedals(el)` adds one line: `if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, <fixed>))`,
  where `<fixed>` is `Recall.fixed()` for the results anchor and 0 on open (Math: always 0).

## Tests

- `tests/mastery.test.js`: events for each moment in both grades, merge order and the 3-extra cap, subject milestone rises once and not on first report.
- `tests/recall.test.js`: fixed counts box-1 right answers while due; a same-day retry, a helped answer and a resting question do not count; resets per round.
- `tests/fx.test.js`: `celebrate` with no events does nothing (no DOM in node: test the pure helpers, e.g. the auto-close time per size).
- Wiring test: all 15 games pass their events to `Fx.celebrate` inside `showMedals`.
- E2E: in every game the Silver round shows a big popup with the lesson title, which closes on tap; with reduced motion there is no confetti;
  a Review round that fixes a mistake shows a small popup (non-Math games).

## Out of scope

Shop-goal popups, quests/boss/family events (their features will add events), sounds beyond the existing Web Audio tones.
