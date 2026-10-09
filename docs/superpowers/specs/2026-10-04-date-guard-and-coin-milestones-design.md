# Date guard and coin milestones — design

Status: built 2026-10-04. Two of the "smaller items" left after the weekly boss (the user skipped
features 5-9). The third smaller item, naming the Page Turners passages, was a content fix done the same day.

## Goal

1. **Date guard:** moving the tablet's clock back can no longer earn points or coins.
2. **Coin milestones:** fewer coins per answer, more for remembering lessons. Per-answer pay halves, and medals pay
   coins directly.

## User decisions

- **Date guard, "never go back":** each tablet remembers the latest time it has seen. When the clock reads earlier than
  that, points and coins pause. No internet check.
- **Coins, "half and half":** 20 points = 1 coin (was 10). New medals pay 🥉 3, 🥈 5, 🥇 10 coins, once per lesson.
  Quests, the boss and real test scores are unchanged.

## Part 1: Date guard

### The rule

- A new engine file `web/engine/clock.js` (global `Clock`) keeps the latest time this device has seen in the
  device-wide key `clock_seen_v1` (raw `localStorage`, outside the learner spaces, so it never syncs; two tablets'
  clocks never agree to the second).
- `Clock.paused()` is true when `now < seen - 1 hour`. The hour lets small clock corrections pass. Otherwise it saves
  `seen = max(seen, now)` and returns false.
- `seen` is also bumped when the page loads.
- If storage fails, the guard is open (never paused). A guard that cannot remember must not block her.

### What pauses

| Where | While paused |
|---|---|
| `StudyKit` `kit.answer` | a right answer pays 0 points (Math's review `extra` too) |
| `Recall.points` | returns 0, the box does not move, and the round counters do not count it |
| `Recall.missed` | the box does not drop to 1 |
| `Recall.gradeSkill` | returns 0, the skill box does not move |
| `Wallet.addBonus` | returns false, so nothing pays coins: medals, quests, streaks, the boss, test scores |

Quests and the boss already remove their pay mark when `addBonus` fails, so those rewards pay later once the date is
right. Medals do the same (Part 2).

What does not pause: playing, flashcards, history, stars, the shop and power-ups.

### What she sees

On every page that loads `clock.js` with a grade, a banner at the top when paused:

- Grade 5: `⏰ The tablet's date is earlier than before. Points and coins are paused until the date is right.`
- Grade 2: `⏰ Mali ang petsa ng tablet. Hihinto muna ang points at coins. · The tablet's date is earlier than before. Points and coins are paused until the date is right.`

The banner is checked once, on load. A clock changed while a page is open still pauses pay at once, and the banner
shows the next time a page opens.

### The parent fix

A Parent panel section (behind PIN 0108) on both lobbies: "📅 Tablet date". It shows only while paused:

- Text: `The tablet's date looks earlier than the last time it was used, so points and coins are paused. If today's
  date and time are right, tap the button.`
- Button: `The date is right now`. It sets `seen = now`, and the message becomes `Done. Points and coins are back on.`

You need this when a tablet was set ahead by mistake and then put back. Without it, the tablet would stay paused
until real time caught up.

### Loading

`clock.js` loads right after `learner.js` in both lobbies and all 17 games. The parent phone page does not load it.
Every use is guarded (`window.Clock && Clock.paused()`), so a missing file means no guard, never a broken page.

## Part 2: Coin milestones

### Rate

- `POINTS_PER_COIN` becomes 20. The old rate (10) is kept as `OLD_POINTS_PER_COIN`.
- Points earned before the switch keep the old rate, so her balance never drops:
  - `wallet_v1` gains `rateFrom: { <pointsKey>: <points at the switch> }`.
  - The first `Wallet.track(points)` after the update (the lobby calls it on every open) sets `rateFrom` for every
    tracked key to its current points. This happens once: it only runs while `rateFrom` is missing.
  - Per key, with baseline `b`, current points `p` and switch point `r`:
    - `r = max(b, rateFrom[key])` when `rateFrom` has the key.
    - `r = b` when `rateFrom` exists without the key (the key was first seen after the switch).
    - `r = +∞` when `rateFrom` is missing (the lobby has not opened since the update, so the old rate still applies).
  - `old = Σ max(0, min(p, r) − b)`, `new = Σ max(0, p − max(b, r))`, and
    `coins from points = floor(old / 10) + floor(new / 20)`.
- `Wallet.earned(points).coins` uses the same formula, so the shop's "⭐ N new points → 🪙 M coins" line stays right.
- Sync: `MERGE.wallet` keeps `rateFrom` as the union of both copies, the higher number per key. It is missing only
  when both copies lack it. `readLocal` / `writeLocal` for the wallet carry it.

### Medals pay coins

- Mastery's `PAY` (points 20/40/80) is replaced by `COINS = [0, 3, 5, 10]`. Skipping straight to a higher medal pays
  every level skipped (Bronze to Silver at once pays 3 + 5), as points did.
- `Mastery.update` pays the coins itself through `deps.bonus(coins)`. In the browser that is `Wallet.addBonus`, looked
  up when it pays, plus `Wallet.renderCoins`. It returns `result.coins` (no `result.points`), and each `newly` entry
  has `coins`.
- **Mark, then pay:** the new `paid` levels are saved first, then `bonus` is called. If it fails (date guard, no
  wallet file, storage full), the `paid` levels go back to what they were, `result.coins` becomes 0 and `newly`
  is empty. The medal still shows on the lesson, but no popup plays. The next update that pays celebrates it once,
  with its coins.
- Games no longer call `kit.award(medals.points)`. That line is removed from all 17 games. `kit.award` stays in the
  kit, unused.
- The new-medal line says coins: `🏅 New Silver: Plants! +5 coins`. Grade 2:
  `🏅 Bagong Pilak · New Silver: Halaman! +5 coins`. With 0 coins (not paid yet) the `+N coins` part is left out.

### Text

- Coin guide (`wallet.js` GUIDE_TEXT, both grades): every 20 points = 1 coin, and a perfect 10-question lesson =
  140 points = 7 coins. One new line says a new medal pays 3 / 5 / 10 coins.
- Shop intro in both lobbies: "Every 20 points you earn gives you 1 coin" (Grade 2: "Bawat 20 points = 1 coin! …
  Every 20 points = 1 coin! …").
- README rewards section.

## Testing

- **`tests/clock.test.js`:**
  - not paused on a fresh device
  - `seen` rises with time
  - 59 minutes back is fine, 2 hours back is paused
  - going forward again clears the pause
  - `fix()` clears it
  - broken storage is never paused
  - the Grade 2 banner pairs Filipino with English
- **Gates:**
  - `tests/study-kit.test.js`: a paused right answer pays 0
  - `tests/recall.test.js`: a paused `points` / `missed` / `gradeSkill` leaves the boxes alone
  - `tests/wallet.test.js`: a paused `addBonus` returns false and adds nothing
- **Rate (`tests/wallet.test.js`):**
  - the balance does not change at the switch
  - points after the switch pay 1 coin per 20
  - a key first seen after the switch is all new rate
  - with no `rateFrom` the old rate applies
  - `earned()` matches the balance
- **Sync (`tests/sync.test.js`):** `rateFrom` merges to the higher number per key in either order, and it survives a sync
  round.
- **Medals (`tests/mastery.test.js`):** the existing pay tests move from points to coins (`COINS`). New tests: a failed
  bonus leaves `paid` unchanged and pays on the next update, and the new-line text.
- **Wiring:**
  - `clock.js` is loaded after `learner.js` in every game and both lobbies
  - no game calls `kit.award(medals.points)`
  - the Parent panel has the `#clock-section`
- **E2E:**
  - the medal check counts coins (`wallet_v1.bonus`) instead of points: Math 3 then 5; other games Bronze 0 or 3, and
    Bronze + Silver = 8
  - the lobby, backup and migration suites still pass

## Accepted gaps

- Moving the clock **ahead** still works once. After that the tablet is ahead, and moving it back pauses everything,
  so it is a single jump, not a loop.
- A tablet whose clock really was wrong and gets fixed backward needs the parent button.
- A game opened before the first lobby open after the update counts its points at the old rate until the lobby
  records the switch.
