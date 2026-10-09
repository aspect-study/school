# Idea: Playground mechanics, exploration & combat learning (3D world)

Date: 2026-10-06. Status: **all built (2026-10-07).** Slide fix (de798d9), world controls (4be7a6c), pet teacher
(6927d69), gifts and monsters (dec1ff1). Their specs in `docs/superpowers/specs` are the record now; this page keeps the
original analysis. The open decisions below were settled as: 1/2/3 coins with a 15-coin daily world cap; found-only
items; resting questions are never asked; Sprint is tap-to-toggle; swings, see-saw and merry-go-round loop until Stop
while the slide stays one run.

## The user's request (verbatim intent)

### 1. UI & controls
- **Sprint button**: hold/tap button bottom-right, +40% movement speed while active, subtle speed-line particles.
- **Playground manual Stop button**: replaces auto-exit timers on playground rides with a fixed Stop button in the top
  corner; tapping it stops the ride animation and returns normal movement.
- **Pinch-to-zoom**: clamped between 1.5× (close-up) and 0.7× (wide overview).
- **Slide fix**: the slide renders upside down / inverted; mount it right side up on every map.

### 2. Dynamic map gifts (question-gated rewards)
- Gift boxes spawn at random navigation spots every 3–5 minutes, max 3 on the map at once.
- Tapping a gift opens a question; the box opens only on a right answer.
- No repeats: questions come from a per-session `UnseenQuestionPool` until the pool is used up.
- Rewards: Easy 3–5 coins; Medium 6–9 coins + common accessory; Hard 10–15 coins + rare wardrobe/pet item.

### 3. Educational monster encounters (combat + pet coaching)
- Monsters wander random paths; combat starts only when she **taps** one (no collision triggers).
- Right answer: defeat burst, the monster drops a gift box with tiered loot.
- Wrong answer: the monster summons 1 helper monster nearby and disappears without a gift. Helpers cannot summon more.
- **Pet teacher**: on a wrong answer, movement pauses, her pet steps forward in a dialogue bubble showing her pick in
  soft red, the right answer in green and a step-by-step explanation written for Grade 2; "Got It!" closes it.

## Analysis (checked against the code on 2026-10-06)

### Controls: all small, do first
- **Slide: confirmed bug, one-line fix.** `web/world/build.js:208` tilts the ramp with `rotation.x = -0.55`, which makes
  the ramp's **far** end high and the end at the ladder tower (`sl.z - 2.4`) low. `web/world/rides.js` (`RAMP`, `pose`)
  assumes the opposite (high at the tower), so she slides "through" a backwards ramp. Fix: `+0.55`. Both grades share
  build.js, so every map is fixed. Add a test tying the ramp sign to `Rides.RAMP.tilt`.
- **Sprint**: speed lives in one place (`SPEED = 9`, `web/world/walk.js:6`); +40% ≈ 12.6. On a tablet, holding Sprint +
  joystick + drag-to-look is a lot of thumbs; suggest **tap to toggle, auto-off when she stops**. Speed lines cosmetic.
- **Stop button**: rides end on their own after 2–4 s (`RIDES` in `web/world/rides.js:7`), so Stop barely shows today.
  It only makes sense if rides **loop until Stop**. Suggestion: swings, see-saw, merry-go-round loop until Stop; the
  slide stays one run (natural end).
- **Pinch zoom**: camera distance is fixed (`CAM_DIST = 15`, `web/world/move.js:6`). move.js tracks one look pointer
  (`lookId`), so a second finger must be handled or pinch will also spin the camera. Add mouse-wheel zoom for desktop.
  Clamp 0.7×–1.5× is fine; check the camera doesn't clip into buildings at 1.5×.

### Gifts + monsters: one sub-project, economy needs adjusting
Monsters drop gift boxes, so both share the question gate and loot table. Build them together.

- **Coin inflation (main concern).** Coins buy real rewards ([[coin-shop-decisions]] in memory). A perfect 10-question
  lesson ≈ 100 pts ≈ 5 coins (20 pts/coin). One Hard gift (10–15 coins) = 2–3 full lessons; with gifts every 3–5 min
  plus monster drops, an hour in the world could earn 150–300 coins and make ML/movie rewards much cheaper than real
  study. Options: lower gift coins (≈1–3) **or** keep the amounts with a daily world-coin cap (e.g. 20/day).
- **Per-session unseen pool is farmable.** Closing and reopening the world refills it. The app already has better
  guards: 3-day question rest (`recall.js`) and spaced-review boxes (`review_v1`). Professor Hoot's Ask me!
  (`web/world/ask.js`) already uses them; gifts/monsters should reuse that path so a rested question pays 0.
- **No difficulty tags exist** on questions. Derive Easy/Medium/Hard from her own review boxes (Hard = questions she
  missed, low boxes). Bigger rewards then go to what she needs to practise.
- **Item drops vs the boutique.** Lola Lana sells items for 50–800 coins (wardrobe part 1). Dropping the same items
  undercuts the shop. Suggest **found-only items** the boutique never sells. Pet items wait for pets 2a.
- **Monsters**: tap-to-fight fits move.js (`tapHit` already handles tapping her pet). Reuse the cute minion look,
  pop burst and sounds from boss + army (`army.js`, `bosses.js`); keep it bubbly, not real explosions (Grade 2).
  A wrong answer summoning a helper = a second chance, which is kind; the no-chain loop guard is right.
- **History**: world answers must show in the parent history like Ask me! does now (saved as an unfinished review quiz,
  quests never tick — existing phase 3 decision).
- **10-min nudge**: frequent gifts encourage longer world sessions; keep the existing gentle nudge as is.

### Pet teacher: best value, cheap
- Data exists: `ask.js` already returns `why` and `explain` per question (`web/world/ask.js:76`), and every game has the
  why + tip panels. The pet bubble reuses these (her pick soft red, right answer green, "Got It!").
- Limit: the explanation comes from the existing lesson text; no AI chat (phase 3 decision), so no newly written
  step-by-step breakdowns beyond what the lessons hold.
- Depends on pets 2a. Use it in Hoot's Ask me! too, not only monsters.

## Suggested order
1. Slide fix (bug, tiny).
2. Controls plan: Sprint + pinch/wheel zoom + Stop button with looping rides.
3. Finish pets 2a (spec + plan already written: `docs/superpowers/specs/2026-10-06-pets-design.md`,
   `docs/superpowers/plans/2026-10-06-pets.md`).
4. Pet teacher (in Ask me! first).
5. Gifts + monsters as one sub-project.

## Open decisions for the user (before step 5)
1. Coin amounts: lower amounts, or keep the proposed amounts with a daily world-coin cap?
2. Item drops: found-only items, or items the boutique also sells?
3. Do world gifts/monsters follow the 3-day question rest like the games?
4. Sprint: hold, or tap-to-toggle?
5. Stop button: loop all rides until Stop, or only the long ones (slide stays one run)?
