# Playground playmates, part 1: kids who live in the playground, ride with her and talk with her

Date: 2026-10-07. Part 1 of 2. Part 2 (playground games: tag and hide-and-seek) gets its own spec after part 1 is built.

## Why

The playground has four rides and she plays there alone; the see-saw especially feels wrong with nobody on the other
end. The user wants "lots of playmates in the playground that play with her". All three levels were wanted: kids
living there on their own (A), kids joining her rides (B), and playground games (C, part 2).

## User decisions (don't re-litigate)

- 9 kids: 6 named friends who are always there + 3 random kids who are new every time she opens the world.
- Named friends mention her real progress (like Mimi and the buddies).
- Every conversation includes one question. Some kids ask study questions, others fun "getting to know you"
  questions. No question repeats on the same day.
- Study answers: saved to study history so the parent sees them, but 0 points, 0 coins, review boxes, quests and the
  3-day rest untouched (no farming).
- Kids join her rides on their own, and she can also invite a kid to a ride.
- Pure play otherwise: no coins, no comparison, no free chat, no typing.

## 1. Who's there and what they do on their own

**The 6 named friends** (same in both grades; fixed looks made from character-maker parts):

| Friend | Personality | Favourite ride | Asks |
|---|---|---|---|
| Migo | Silly, laughs a lot | merry | fun |
| Ella | Kind, a little shy | swings | study |
| Tomas | Racer, always running | slide | fun |
| Bea | Nicely bossy, organizes | seesaw | study |
| Jun | Curious, loves facts | swings | study |
| Luna | Dreamy, loves animals | merry | fun |

**The 3 new kids:** looks drawn at random from the maker's parts (body, skin, hair style and colour, outfit colour) each
time the world opens, never equal to a named friend's look. No names: the bubble calls them "New friend"
("Bagong kaibigan · New friend" in Grade 2). They ask fun questions only.

**On their own** at the playground the kids stay inside the playground circle (`Layout.places(grade).playground`, r 16; it was r 11
with the rides 4 from the middle, now the rides stand 7 apart from it so the kids have room) and keep picking
a next step: walk or run to a free ride (favourite first), ride it for a few loops, wait their turn at the slide ladder
(one on the slide at a time), pair up on the see-saw (a kid rides it only when both ends are filled), share the swings
(2 seats), ride the merry-go-round together (up to 4), or wander, stop and wave when she comes near.

**She never waits.** If a kid is on the ride or seat she taps, the kid moves to the partner seat, or gets off with a
"Your turn!" word pop over their head when the ride is full (section 2). A kid already sliding down when she gets on
the slide finishes from the next seat instead of starting again. On the swings, see-saw and merry-go-round the moving
part is shared, so it starts her ride from rest.

**Keeping out of her view.** Standing kids step back a little when closer than 1.5 (staying in talking reach), and
step out of the lane between her and the camera and away from the camera itself. Walking kids go round that lane,
and on their own never pick a ride she stands at, rides or whose spot is in her view (kids she invites or who come to
ride with her still do). An invited friend walks beside her, on the side that is free. A kid within 9 of the camera
(along the ground) fades, down to faint at 3.5, since riders cannot step aside; each kid has its own copies of its
materials for this. In tests, a kid was in her view 3% of the time instead of 62%.

**Name tags** show only on the friend she can talk to (the one her 💬 Talk to button names) and while they talk.

**All over the map** (added after part 1 shipped: "the playmates should also go around the map, not only in the
playground"). The kids walk the paths to the other places and hang out there: the gate, the plaza round the fountain,
the street in front of the doors, Jesus's garden, Shop Plaza, Whispering Park and the house (never the Boss Fort).
`Layout.walkways(grade)` gives the path points as a tree from the plaza (any two join through it; the plaza point sits
in the fountain, so walkers skip it) and each place's hangout area. A kid at the playground heads out 25% of the time
they pick something new; elsewhere they wander there 75% of the time, resting about 6 s at each spot, and otherwise go
on (back to the playground 40% of the time). An outing goes to the place she is in 40% of the time while fewer than 4
kids are there, so she meets kids wherever she plays. In tests about a fifth of the kids are at the playground at
any time and most of the rest at the other places; standing in the park she has one or two kids with her on average.
She can talk to them anywhere. An invited friend follows her out of the playground too (the invite ends only after
about 60 s or when they ride with her), and pops in beside her when left more than 25 behind (she sprinted or used
quick travel). Without walkways (the unit tests of the playground behaviour) the kids stay in the playground.

**Performance:** the 9 kids' plans run all the time (pure maths, cheap); each kid is drawn and animated only while
within 50 of her, so at most a few are drawn away from busy places. Simple steering around the ride props
with the existing obstacle shapes; no new physics. A kid who starts going round a prop keeps to that side until the
way ahead is clear, so they get past it instead of turning back and forth.

## 2. Riding together and inviting a friend

**Joining on their own.** When she starts a ride, the nearest free kids (a kid whose favourite it is first) run to it:

- See-saw: one kid takes the other end. Until they sit (usually 1-2 s) the see-saw rocks as today; then the partner is
  down when she is up.
- Swings: one kid takes the other swing, swinging opposite her (angle -a), so it starts and lands at rest with her.
- Merry-go-round: up to 3 kids hop on at the other spots and spin with her.
- Slide: one kid climbs after her and slides down right behind her.

The moving part is shared, so Stop ends the ride for everyone with the existing ending, and everyone lands together.
Kids then stay near the ride for a few seconds before going back to their own plans.

During a ride, kids show emoji pops over their heads (😄 🎉 ⭐) and a soft kid giggle sometimes plays (`mate-giggle`,
the existing CC0 `emote-giggle.mp3` at a lower volume; no new clips). No speech bubbles mid-ride.

**Inviting.** She taps a kid; the bubble offers 🎠 Let's play! → four ride buttons. A "Tara!" word pop shows over the
kid's head (English only in both grades, like the buttons) and the kid follows her like her pet does. When she starts any ride, the invited kid gets the
partner seat first. Following ends after about 60 s, when she rides (the kid rides with her and then the invite is
done), or when she leaves the playground; the kid waves and goes back to playing. Works with the new kids too.

**Zoom:** to see more of the playground, she can zoom out to 0.45x (was 0.7x), 33 from her; zoom in stays 1.5x.

**Rules:** a kid never blocks her path or the ride she taps (a kid is the thing to tap only when no door, ride or other
character is in reach); her pet still bounces beside the ride; Sprint, zoom and
the 10-minute nudge work as today, and a nudge that stops a ride lands the kids too.

## 3. Talking and questions

Tapping a kid who is not mid-ride: the kid stops, turns to her, and the bubble opens:

1. **Hello line.** Named friends sometimes mention real progress from the same snapshot Mimi and the buddies use
   (a medal, the streak, this week's boss), otherwise a personality line ("Race you to the slide!"). New kids say a
   "Hi! I'm new here!"-style line.
2. **One question.** Ella, Bea and Jun ask study questions; Migo, Tomas, Luna and the new kids ask fun ones.
3. **Buttons:** the answers, then 🎠 Let's play!, then 👋 Bye. After answering: the reaction, then Let's play! and Bye.

**Study questions**
- From any lesson of her grade's subjects that the world can show (multiple choice and true/false, no picture,
  passage or generated lesson): the existing `Quiz.askable` / `Quiz.view` and `Ask.loader`.
- Never twice on the same day by any kid (today's review keys in `mates_v1.asked`).
- Right: cheer + confetti pop + a "Galing!" line. Wrong: "Oops! It's …" with the right answer and the why/tip the way
  the games show it.
- Saved to her study history as a world entry the parent page shows, with 0 points. Never passed to `Recall` or
  `StudyKit` scoring; quests never tick; the 3-day rest is untouched.
- If the lesson files can't load, or every askable question was already asked today, the kid asks a fun question.

**Fun questions**
- About 60 per grade, each with 2-4 choices and no right answer ("Cats or dogs?", "Favourite fruit?").
- Never twice on the same day (fun question ids in `mates_v1.asked` too).
- The kid reacts from their own favourites: "Me too!!" on a match, "Ooh, cool!" otherwise.
- Friends remember her latest answer per question (`mates_v1.fun`) and can bring it up later in a hello line
  ("You said you love dogs! Me too 🐶").

**Language:** Grade 5 in English. Grade 2 kid lines are Filipino + English pairs shown in the bubble's pair mode;
buttons English only (the existing rule). Study questions show the lesson's own wording.

## 4. How it fits together

**New files in `web/world/`** (added to `tests/paths.js` `WORLD_FILES` in load order, both world pages and the
precache list):

| File | Kind | Job |
|---|---|---|
| `mates.js` | pure | The 6 friends (id, name, look, favourite ride, asks), random new-kid looks never equal to a friend's, `newKids(rand)`, `all(rand)` |
| `mateboard.js` | pure | Who sits where: seats per ride, the kids' own ride runs, friends on her ride following her run; she always wins her seat |
| `matemind.js` | pure | Each kid's plan and step: wander, go to a ride, queue, ride, join her, follow, stop to talk, cheer; steering round props |
| `matelines.js` | pure | Hello, personality, progress, reaction and invite lines and the fun-question bank per grade |
| `matequiz.js` | pure | `mates_v1` (see below), picks today's unasked study or fun question, her remembered answers, each kid's steady favourite |
| `mates3d.js` | 3D | Builds the 9 kids with `Avatar.character`, shows or hides them near the playground, poses them each frame, emoji pops, opens the talk bubble (talk.js) |

**Changed files**
- `rides.js`: exports `seat`; `partner(pr, id, a, slot)` poses (far see-saw end, the other swing, merry spots);
  `runPart` / `runDone` for any rider's run `{ t, stopAt }`. A kid-only looping ride gets a Stop after 2-4 loops.
- `build.js`: the left swing turns as part `swing2`.
- `play.js`: `now()` gives her ride as a run `{ id, t, stopAt }`; `mateboard.js` follows it each frame.
- `mates_v1` `{v, day, asked: [keys], fun: {id: choice}, t}` lives in `matequiz.js` (prefs.js untouched): a synced
  replace key like `world3d_v1` (`sync-core.js` already treats it so). A new day clears `asked` and keeps `fun`. Bad
  JSON reads as empty.
- `world-main.js`: wires `mates3d` in: tap targets (after everything else), busy state, frozen while a card, the maker
  or a stall is open, her ride from `play.now()`, sounds.
- `sfx.js`: `mate-giggle` reuses `emote-giggle.mp3`; `Sfx.FILES` stays 56.
- `ask.js`: `Ask.loader` gives everyone the same loader for a window and its lesson files, so Hoot's Ask me! and the
  kids never load at once (which could leave `StudyKit.lesson` swapped) or run a lesson script twice.

**Edge cases**
- Lesson files fail or today's study questions are used up: fun question instead.
- She walks away mid-talk: the bubble closes like other characters.
- A card, the maker, a stall or the nudge opens: kids freeze in place.
- Reduced motion: emoji pops appear without floating up.
- Accepted gap: a second tablet may repeat a question the same day (same as `world3d_v1`).

## 5. Testing

**Unit (node):**
- Seat claiming: no double-booking; she always gets her seat and the kid on it moves to the partner seat or leaves.
- See-saw partner is on the opposite end; the other swing swings opposite her; merry spots are evenly spaced.
- Stop lands every rider; a kid-only ride ends after its loops.
- Daily-unique picking for study and fun questions; a new day clears `asked` and keeps `fun`; bad `mates_v1` reads empty.
- New-kid looks never equal a friend's; the 6 friends' data is complete.
- Every Grade 2 kid line is a Filipino · English pair; the fun bank has about 60 questions per grade, no duplicate ids.
- Study answers never call `Recall` or `StudyKit` scoring; the history entry has 0 points.

**E2E (`WorldDebug`):**
- 9 kids appear near the playground and, standing at home there, are hidden at the plaza (more than 50 away).
- She starts the see-saw and a kid sits on the other end; Stop lands both.
- Tap Ella: a study question; answer it; the history entry has 0 points and no review box moves.
- Invite Ella: she follows and takes the other swing on her next ride.
- Tap Migo: a fun question; her answer is kept in `mates_v1.fun`.

## Not in part 1

Tag and hide-and-seek (part 2). Coins or points from kids. Kids talking mid-ride. Kids going into the buildings or
the Boss Fort.
