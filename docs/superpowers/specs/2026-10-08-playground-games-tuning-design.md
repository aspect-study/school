# Playground games, tuning: fair hide-and-seek, a harder tag, her sister plays

Date: 2026-10-08. Follows `2026-10-07-playground-games-design.md`; everything there still holds unless changed here.

## What the owner saw (2026-10-08)

- Hide-and-seek: the kids hide in the same few spots, close to the one counting, and she can watch them run to their
  spots on the screen while she counts.
- Tag: she outruns the kids most of the time (her walk is 9 and her sprint 12.6; a chasing kid ran 8).
- Her sister should play too.

## Decisions

**Hide-and-seek, she seeks**
- **Eyes covered:** while she counts, a full-screen cover (🙈 and the big number) hides the 3D view. The pill and
  ✖ End game stay on top.
- **Whole map:** 24 hiding props (was 16) spread over all eight hangouts (playground, gate, plaza, school street,
  garden, shop, park, house). Each kid hides behind a different prop at least 20 from where she counts, each in a
  different place while places are left, picked at random (no bias toward near props). A kid still on the way when
  the count ends is already hiding when her eyes open.
- **Time:** 4 minutes (was 3) for the bigger area.
- **Hints only near the end, and never the exact spot:** no giggle marker over the prop. With 90, 60 and 30 s left a
  hidden kid giggles and a line under the pill names the place only: "🤭 I hear a giggle near Whispering Park!"
  (Grade 2: "May humahagikgik malapit sa Parke ng Bulong! · I hear a giggle near Whispering Park!").
- She hides (a kid seeks): the hiders use the same spread-out spots.

**Tag**
- The chaser runs 9.6 (a little faster than her walk) and aims where she is heading.
- Within 7 of her the chaser **lunges** at 14 (faster than her sprint) for 1 s, then **puffs** at 7 for 1.5 s, so
  sprinting and dodging at the right moment gets her away, and standing still or walking gets her caught.
- **Danger cues:** while the chaser is within 6, the screen's edge pulses red (stronger as they get closer) and a
  heartbeat thumps faster the closer they are; the chaser pops "Here I come!" with a whistle when lunging. Getting
  clear (beyond 10) counts as a getaway: the kid pops "So close!" with a clap, and the end bubble's "got away N times"
  includes these.
- A kid she chases sidesteps once (😜) when she is about to touch them, then needs 2.5 s before the next one; kids
  flee at 8.5 (was 7.5), so tagging them still works with a sprint.
- A chaser who cannot catch her gives up after 20 s (was 15).
- Her walk and sprint are unchanged; the same numbers apply in both grades.

**Her sister plays**
- When her sister stands by the gate (Family peek), she joins every tag and hide-and-seek game as a fifth player
  (four kids and her sister), played by the computer the same way as the kids: she runs, chases, hides, counts and
  pops words over her head. She is not for talking to while she plays.
- After the game she walks back to her spot by the gate (or sparkles back there if something blocks her).
- Not live multiplayer: the sister on her own tablet does not steer this figure.

## Where

- `mategame.js`: the rules (tuning numbers, spread-out spots, snap at the count's end, place hints, lunge, puff, lead,
  danger and getaway events, the sidestep).
- `games3d.js`: the cover, the hint line, the red edge, the heartbeat, and the sister routed through `kin.js`.
- `kin.js`: `player()`, her sister as a game player (move, where, put, game, pop) and the walk back.
- `sfx.js`: the heartbeat, drawn in code like the dragon's rawr (no new sound file).
- Tests: `world3d-mategame.test.js`, `world3d-sfx.test.js`, `tests/e2e/world-e2e.js` (games and family runs).
