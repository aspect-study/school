# Playground playmates, part 2: tag and hide-and-seek with the kids

Date: 2026-10-07. Part 2 of `2026-10-07-playground-playmates-design.md`.

## User decisions (don't re-litigate)

- **Where:** the whole map. Each game puts down a **new random set of hiding props** (bushes, crate stacks, barrels,
  hay bales, big boxes, flower bushes) around the places and paths; they go away when the game ends.
- **A twist** that makes hide-and-seek more interesting and lets her **surprise the kids**.
- **How a game starts: all three ways.** Talking to a kid adds 🏷️ Tag! and 🙈 Hide and seek!; now and then a friend
  runs up and asks her to play (she can say no); a 🎲 Games board at the playground's entrance.
- **Take turns:** in tag whoever is tagged is "it" next (kids chase her too); in hide-and-seek she seeks first, then
  Play again swaps (a kid counts and looks for her).
- **Pure play:** no coins, no points, no questions. The value is the play itself (below).

## Why these games are good for her (the reason for building them)

Tag and hide-and-seek are among the oldest games children play everywhere, and they exercise exactly the skills school
work leans on:

- **Perspective taking ("what can they see?")**: choosing a hiding spot, or guessing where a friend would hide, means
  imagining another person's view. This is the root of reading comprehension (what does the character know?) and of
  kindness.
- **Spatial thinking and map memory**: remembering which spots she already checked and finding her way round the map
  are the same skills behind maps in Araling Panlipunan/Makabansa, geometry and following directions.
- **Self-control and attention**: counting to ten without peeking, standing still while hidden, waiting for her turn.
  Holding back an impulse is one of the strongest predictors of school success.
- **Fair play**: taking turns being "it", no tag-backs, being a good finder and a good loser; playing by shared rules.
- **Quick decisions under a little pressure**: run or dodge, check this spot or that one, then calm down again,
  practice for test nerves.
- **A real break**: a few minutes of play between study rounds helps attention come back; the world's 10-minute nudge
  still brings her back to learning.

The games say a little of this at the end ("Taking turns makes the game fair for everyone!"), in the kids' own voice,
never as a lecture.

## Tag

- Up to 4 kids play: the one who asked (or was asked) plus the nearest others; kids far away pop in near her.
- New hiding props appear around where she stands (they are obstacles to dodge round).
- She starts as **it** ("🏷️ You're it! Tag a friend!"). Kids within reach flee from whoever is it; she tags a kid by
  touching them (getting close). The tagged kid becomes it, counts 3 s ("3… 2… 1…") and chases her. A kid catching
  her makes her it again. **No tag-backs** for 3 s. A kid-it who cannot catch her for 15 s goes after another kid
  instead, so the game keeps moving. The kids are a bit slower than her walk, so Sprint is how she gets away.
- 2 minutes; a pill at the top shows who is it and the time. Then "Great game!" with how many she tagged and how
  many times she got away.

## Hide-and-seek

**She seeks (first):** she covers her eyes and counts 10 (a big number on the screen; she cannot move). The kids
run to hiding props and vanish behind them. Then she looks: getting near a kid's prop finds them (they jump out
with 😆). The pill shows "Found 2 of 4" and the time (3 minutes). Every 25 s with no find, a hidden kid giggles and a
😆 pops over their prop. Found kids go back to where the game started and cheer.

**The kids' twist, "Sneaky switch":** once a game, when she comes close to a hidden kid, that kid may dash out
giggling ("🤭 Sneaky!") to another prop. She can catch them on the way.

**She hides (Play again):** a kid counts 10 at the start spot with eyes covered while she and the other kids hide.
The seeker then checks props one by one (looking round each for a moment) and finds her if close, unless she is in
disguise.

**Her twist, surprise the kids:**
- **🌳 Disguise:** near a hiding prop she can turn into one (her character becomes a bush, crate or barrel). While
  she stands still the seeker usually walks right past (7 times in 10). Moving ends the disguise.
- **👻 Boo!:** when the seeker comes close and has not found her, a Boo! button shows. Tapping it makes the seeker
  jump ("😱 Waaah!") and everyone laughs: she wins the round by surprise.
- Not found after 2 minutes: "You're the best hider! 🏆".

## Starting and ending

- Talking to any kid: the bubble's buttons get 🏷️ Tag! and 🙈 Hide and seek! (with Let's play! and Bye).
- Every 4-6 minutes, when she is free and not in a game, a nearby friend runs up: "Want to play tag?" / "Want to
  play hide-and-seek?" with Yes! and No thanks.
- 🎲 Games board beside the playground's entrance: tapping it offers both games.
- ✖ End game on the pill ends a game at once. A door, quick travel or the 10-minute nudge ends it too. After a game:
  🔁 Play again (swapping roles in hide-and-seek) and 👋 Bye.

## How it fits

| File | Kind | Job |
|---|---|---|
| `matemind.js` | pure | a `game` state the brain leaves alone; `game(id, on)`, `move(id, x, z, speed, dt)` (the same steering), `put(id, …)`, `where(id)`; hidden kids in `frames()` |
| `mategame.js` (new) | pure | the rules of tag and hide-and-seek (phases, it, tags, finds, hints, sneaky switch, the kid seeker, disguise misses, Boo!), random hiding props, the lines (Grade 2 pairs) |
| `games3d.js` (new) | 3D/UI | draws the hiding props and her disguise, the pill and count number, the Disguise/Boo!/End game buttons, the board, invitations, the end bubble |
| `mates3d.js` | 3D | game buttons in the talk tail; hidden kids not drawn; hands its kids to games3d |
| `world-main.js` | wiring | props block walking (her, kids, pet); her disguise hides her; leaving or the nudge ends a game |

## Testing

- Unit: props are random, spaced and on free ground, never on a path; tag: tagging, it changes, no tag-backs, a
  kid-it switches after 15 s, the end at 2 minutes; hide-and-seek: kids hide at distinct props, found within reach,
  hints every 25 s, one sneaky switch at most, the kid seeker finds her when close, misses her in disguise 7 in 10,
  Boo! only when close and ends with her win, best hider at time out; matemind leaves game kids alone; Grade 2 pairs.
- E2E: start tag from a kid's bubble, tag a kid, the kid becomes it; hide-and-seek from the board: count, find all;
  Play again: she hides, disguises, Boo! the seeker.
