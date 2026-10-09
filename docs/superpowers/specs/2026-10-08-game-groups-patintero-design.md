# Playground games, part 3: game groups and Patintero

Date: 2026-10-08. Follows `2026-10-07-playground-games-design.md` and `2026-10-08-playground-games-tuning-design.md`;
everything there still holds unless changed here.

## Owner decisions (2026-10-08, don't re-litigate)

- More games will come, so the games are sorted into **groups**. Two groups for now:
  - **🏃 Tag & Chase** (Grade 2: "Habulan at Takbuhan · Tag & Chase"): Tag, Patintero.
  - **🙈 Hide & Seek** (Grade 2: "Taguan · Hide & Seek"): Hide and seek.
- **Two-step pick:** first the group, then the game.
- **Patintero, both sides:** she starts as a runner; when her team is tagged the teams swap and she guards.
  Play again starts the other way round.
- **Close to the real rules:** guards stay on their lines, the middle-line guard runs its whole length, a runner
  scores by reaching the far end and coming back, one tag swaps the teams.
- **Friends invite her to Patintero too**, like tag and hide-and-seek.
- **Pure play:** no coins, no points, no questions, the same as tag and hide-and-seek.

## Why Patintero

Patintero is the best-known Filipino street game, so it ties the world to games she hears about at school and from
family. On top of what tag already trains, it adds:

- **Teamwork:** one tag swaps the whole team, so she watches her teammates and helps them, not only herself.
- **Timing and reading others:** a guard can be faked one way and passed the other; waiting for the gap is
  self-control.
- **Rules with lines and turns:** guards keep to their lines, runners go there and back, and the score is kept as a
  team.

## Game groups

- The groups and their games are one list in `mategame.js` (`GROUPS`): id, emoji, name (both grades) and game ids.
  The Games board, the kid's talk bubble and the friend's invite all read it, so a new game later is one entry there.
- **Games board:** "What kind of game?" (Grade 2: "Anong klaseng laro? · What kind of game?") with one button per
  group plus Bye. Picking a group shows its games plus ⬅ Back. A group with a single game starts it straight away.
- **Talking to a kid:** the 🏷️ Tag! and 🙈 Hide and seek! buttons become one **🎲 Let's play!** that opens the same
  group step, with that kid as the one who asked.
- **A friend runs up and asks:** they pick a game at random from all games (each equally likely).
- Buttons stay English on both grades: "🏃 Tag & Chase", "🙈 Hide & Seek", "🏃 Patintero!", "⬅ Back".

## The court

- A permanent court painted on the ground beside the playground, placed like the board: the first spot from a short
  list that is clear of buildings, rides and paths (`staticBlocked`, `onPath`), facing the playground. If no listed
  spot is clear, the build stops and asks the owner where it goes, rather than overlapping something.
- 10 wide and 24 long, chalk-white lines on packed-dirt ground:
  - the **home line** at one end and the **far line** at the other;
  - **3 cross lines** inside, 6 apart, each with one guard;
  - the **middle line** down the centre from the first cross line to the far line, for the middle guard
    (the "patotot").
- A floating "🏃 Patintero" sign at the home end (English only, like all world signs).
- The court blocks nothing: she and the kids can walk across it any time. Hiding props never go on it.

## Patintero rules in the world

**Players:** 8, two teams of 4. Her team: her, her sister when she is at the gate, and kids to make 4. The other team:
4 kids. Kids are picked like tag (the one who asked plus the nearest); kids far away pop in. When a game starts,
everyone sparkles to their start spot: runners behind the home line, guards on their lines. Each player has a
coloured ring at their feet for the game: **blue** her team, **red** the other.

**Runners:** start behind the home line, run past every cross line to beyond the far line, then back past every line to
beyond the home line. A runner who makes it home scores **1 point** for their team and may go again. The sidelines are
soft walls during the game (runners slide along them), so she cannot step out by accident on a tablet.

**Guards:** each stays on their own line. A cross-line guard moves only across the court along that line; the middle
guard moves only along the middle line. A guard tags a runner by touching them (within reach of the line).

**One tag swaps the teams:** the runners become guards and the guards become runners. Everyone sparkles to their new
spots, there is a 3-second "Ready… set… go!" and play goes on. The score carries over.

**End:** the first team to **3 points**, or after **4 minutes** the team with more points; equal points is a tie.
The end bubble has 🔁 Play again (her team starts on the other side from last time), Bye, and one "why" line in a
kid's voice.

**She runs:** she moves freely with her normal walk (9) and Sprint (12.6). Her kid teammates run on their own: they
wait behind a line until the next guard is far enough away, fake one way and dash the other, and are careful (they
cross only with a clear gap) so they do not lose the turn for her all the time.

**She guards:** she is the **middle guard** (the most moving guard, the team leader). While guarding, her joystick
only moves her along the middle line; the other direction is ignored. Her three teammates guard the cross lines.
Kid runners try to slip past her and her teammates with the same fake-and-dash.

**Kid guards** move along their line toward the runner most likely to cross next, a little slower than her walk
(8.5), and lunge (11, for 0.6 s) when a runner is within 3 of their line, then rest for 1.2 s. So walking straight
across gets her caught, and a sprint at the right moment gets her through. These numbers start here and are tuned on
the tablet like tag's were.

**Danger cues:** the red edge and heartbeat from tag play when a guard is lunging at her.

**Pill:** "🏃 Patintero 🔵 1 – 0 🔴 3:12" with a line under it saying her job:
- running: "Cross every line and come back!" (Grade 2: "Tumawid sa lahat ng guhit at bumalik! · Cross every line and
  come back!");
- guarding: "🛡️ Guard the middle line! Tag a runner!" (Grade 2: "🛡️ Bantayan ang gitnang guhit! Tayain ang
  tatakbo! · Guard the middle line! Tag a runner!").

**Bubbles and pops (Grade 2 pairs Filipino · English):**

| When | Grade 5 | Grade 2 Filipino half |
|---|---|---|
| Invite | Want to play Patintero? | Gusto mo bang maglaro ng patintero? |
| Her team tagged | 😲 Tagged! Teams swap! | 😲 Nataya! Magpapalit ang mga koponan! |
| She or a teammate tags | 🎉 Got one! Teams swap! | 🎉 Nakataya! Magpapalit ang mga koponan! |
| Her team scores | 🎉 A point for your team! | 🎉 Isang puntos para sa koponan mo! |
| Other team scores | They scored! Guard closer! | Nakapuntos sila! Bantayan nang mabuti! |
| Win | Your team won, {a} to {b}! | Panalo ang koponan mo, {a} laban sa {b}! |
| Lose | The other team won this time, {a} to {b}. Let's play again! | Panalo ang kabila ngayon, {a} laban sa {b}. Maglaro ulit tayo! |
| Tie | A tie, {a} to {b}! Everyone played great! | Tabla, {a} laban sa {b}! Ang galing ng lahat! |

Pops over heads (English, both grades): "Ready…", "Set…", "Go!", "Got you!", "Home! 🎉", "😜".

New "why" lines, added to the shared list:
- "Teamwork: watch your teammates and run when the guard looks away!" (Grade 2: "Pagtutulungan: bantayan ang mga
  kakampi at tumakbo kapag iba ang tinitingnan ng bantay!")
- "Waiting for the right moment is a superpower!" (Grade 2: "Ang paghihintay sa tamang sandali ay isang
  superpower!")

## Where

- `mategame.js`: `GROUPS`, the new texts and buttons, the invite picking from all games.
- `patintero.js` (new, pure, like `mategame.js`): court geometry, teams, the runner and guard logic, scoring, swaps,
  events for the shell. Run `node tools/update-precache.js` after adding it.
- `games3d.js`: the court and its sign, the two-step board bubble, start and end of a Patintero game, the rings, the
  pill line, the rail that keeps her on the middle line while she guards, danger cues reused from tag.
- `mates3d.js`: 🎲 Let's play! in the kid's talk bubble.
- `kin.js`: her sister as a Patintero player (same `player()` hooks as tag).
- `world-main.js`: load `patintero.js`; pass the rail to her controls.
- Tests: `world3d-mategame.test.js` (groups, invites), new `world3d-patintero.test.js` (lines, reach, scoring there
  and back, one tag swaps, 3 points or 4 minutes, tie, Play again swaps the start), `tests/e2e/world-e2e.js` (board
  two-step, a Patintero run, rail while guarding), `tests/pwa.test.js` (precache).
- Docs: `README.md` (playground games), `docs/HANDOFF.md` (Built).

## Not in this part

- More games in the groups (Tumbang Preso, Piko, Luksong Tinik and others): each is its own small spec later.
- Live play between the two tablets.
