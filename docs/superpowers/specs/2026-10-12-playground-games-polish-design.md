# Playground games polish (2026-10-12)

Five changes to tag, hide-and-seek and Patintero in the 3D world (`web/world`). Pure rules live in `mategame.js` and
`patintero.js`; the 3D side in `games3d.js`, `world-main.js`, `mates3d.js`.

## 1. Stamina heart in all three games

- `world-main.js` stops pausing `stamina.tick` while `games.playing()`; the ❤️ pill fills while she sprints in tag and
  Patintero (running), and calms while she guards, counts or hides.
- The chaser thump and red edge stay. Hide-and-seek gets the same thump when the seeker is close while she hides.
- Tired-walk (9) is below the tag chase speed (9.6). If a tired heart makes tag unwinnable, the tired walk is raised
  slightly, only while a game plays.

## 2. Who is playing

- A roster row under the game pill: a face chip and name per player, her sister marked, "it" highlighted in tag.
  Patintero shows two rows (blue team, red team) whose chip colours match the bibs.
- A floating English name tag over each player's head while a game runs, hidden beyond 40 units.
- Built from `state()` (already lists the players); the pure game files change little.

## 3. Tag: a chaser who cannot catch her tries another kid, and comes back

- A chaser that gets nowhere (about 8 s without closing in) picks the nearest other kid to tag.
- While chasing that kid, if she comes within about 10 units of the chaser, the chaser breaks off and chases her again.
- A cooldown of about 3 s stops flip-flopping. Change in `tickTag` (`mategame.js`) with pure unit tests.

## 4. Patintero

- **Bibs:** blue bibs for her team, red for the other, on every player including her, put on at the start and taken off
  at the end, over each kid's own outfit. The ground rings stay.
- **Slow-motion replay on every tag:** a rolling 2.5 s buffer of all positions; on a tag the game logic pauses, the
  camera moves in, the last 2.5 s plays at 0.3 speed with a "Tagged!" label (about 8 s, with a tap-to-skip button), then
  the teams swap as today. Visual only.
- **Her guarding lane changes each round:** when her team guards, her lane is random among the middle line and the three
  cross lines, never the same as the previous round. The pill and hint name it. On a cross line she slides sideways
  along it. The kids fill the other three lanes. `fence()` follows her lane; runner crossing logic treats her like any
  guard on a cross line.

## Tests

Unit tests for the tag switch rule and lane choice (`node --test`), world e2e (`node tests/e2e/world-e2e.js`), and a
check that the roster and bibs show. Tablet check pending after build.
