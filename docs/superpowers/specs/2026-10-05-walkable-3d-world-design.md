# Walkable 3D World (spec 1 of 2)

## Goal

Give both girls a cute, Roblox-style 3D world they walk around in: her own character and pet, every subject a
building on School Street, characters who talk to her and help her review, talking trees with inspiring quotes, a
playground, her sister at the gate, and a cute Jesus who gives love and comfort. It is a place she visits from the
lobby. The lobby, the 2D Campus map and the List do not change.

Spec 2 (later, own brainstorm) adds the wardrobe, pet choices and cosmetic shop items. This spec builds the character
from swappable parts so spec 2 only adds parts.

## Decisions (user, 2026-10-05)

- **Look:** bright, soft, toy-like chibi style. Rounded shapes, toon shading, pastel colours, puffy trees, flowers,
  butterflies, a rainbow behind the Boss Fort. Camera behind and above her (third-person, Roblox style). The previews
  `cute-campus.html` and `jesus-garden.html` in `docs/superpowers/mockups/2026-10-05-walkable-3d-world/` are the
  agreed look (they load Three.js from a CDN; the real build vendors it).
- **Devices:** recent mid-range Android tablets, iPads, and recent Android phones and iPhones.
- **Placement:** option C. A separate full-screen world opened by a **🌸 Play World** button in the lobby hero. The
  2D Campus map and List stay as they are.
- **Grades:** both from the start. Grade 5 **Campus**, Grade 2 **Bayan** (7 buildings, simpler paths, bigger signs,
  every label Filipino · English).
- **Character:** a small free character maker in this spec. Wardrobe and shop items are spec 2.
- **Money:** coins only (earned by studying) plus parent-gifted items. No real money, ever. (Applies to spec 2.)
- **Places (8):** School Street, Boss Fort, Plaza, Jesus' Garden, Shop Plaza, Whispering Park, My Little House,
  Playground.
- **Characters (7 kinds):** talking trees, Professor Hoot the owl, a subject buddy at each door, Mayor Mimi the cat
  (guide), Bunny the shopkeeper, Jesus, her sister.
- **Talking:** pre-written lines that know her progress, and characters who ask her due review questions. No typing,
  no chat, no AI.
- **Jesus:** in his garden, plus a morning greeting at the gate once a day, plus he comes to her on hard days. He
  never quizzes, never gives coins, never says "wrong", and is never an item to buy or wear. Verses are simple
  kid-friendly paraphrases with the reference underneath (not tied to one translation).
- **Study time:** a gentle 10-minute nudge only. Nothing is ever locked. No parent setting (the parent talks with her
  personally).
- **Tech:** Three.js with hand-coded models (approach 1), vendored in the repo, no CDN.
- **Build order:** one spec, built in 4 phases, each playable at the end. Each phase gets its own plan, written after
  the previous phase is built (plan 1: `docs/superpowers/plans/2026-10-05-walkable-3d-world-phase-1.md`).

## Architecture

### Pages

- `web/world/grade-5.html` (Campus) and `web/world/grade-2.html` (Bayan). Each loads the shared engine files the
  lobby uses (learner, storage, cloud, wallet, mastery, quests, boss, recall, study-kit, guide, family, fx, shop),
  then the world modules with `data-grade`.
- Each lobby hero gets a **🌸 Play World** button linking to its world page (English on both grades: Grade 2 buttons
  are English-only, labels are paired). Nothing else in the lobby changes.

### Modules (`web/world/`)

| File | Job |
|---|---|
| `scene.js` | Renderer, gradient sky, fog, lights, shared toon materials and geometry cache, quality level |
| `layout.js` | Pure data per grade: the 8 places, paths, building spots (one per lobby app), tree and decoration spots |
| `build.js` | Turns layout data into 3D buildings, roofs by medal tier, trees, the fort, garden, park, house, playground |
| `avatar.js` | Builds a character from parts (body, skin, hair, hair colour, outfit colour) and a pet. Spec 2 adds parts here |
| `move.js` | Joystick, keys, tap-to-walk, camera follow, collisions, ⚡ quick travel |
| `talk.js` | Speech bubble UI and the dialogue picker (which line, from her progress) |
| `lines.js` | Every written line: buddies, trees, Mimi, Bunny, Hoot, Jesus. Grade 2 as Filipino · English pairs |
| `quiz.js` | ❓ Ask me! questions through `StudyKit` + `Recall` |
| `lesson-files.js` | Generated list of each game's lesson script paths (see Phase 3) |
| `world-main.js` | Wires it all together, reads progress from the existing engines, handles errors and the nudge |
| `text.js`, `look.js`, `prefs.js`, `walk.js`, `music.js`, `maker.js` | Words per grade; `avatar_v1` data; device prefs, the return spot and the frame-rate check; pure movement maths; the synthesized music-box loop; the character maker panel |

Pure logic (layout, the dialogue picker, the hard-day check, the nudge timer, cleaning `avatar_v1`, the quiz adapter)
is written as functions that take their inputs, so they are unit-testable in Node without WebGL.

### Shared code changes

- **Three.js r149** `three.min.js` (the last release with a classic, non-module build) is copied to
  `web/vendor/three/`, with `RoundedBoxGeometry` ported to a classic script `web/vendor/three/rounded-box.js`. ES modules
  and import maps do not load from `file://`, which the e2e tests and offline copies use. Only the world pages load them.
- **Shop:** the inline `<script data-shop>` in both lobbies moves into `web/engine/shop.js`, loaded by both lobbies
  and both world pages. The lobbies behave exactly as before. Existing shop tests are updated to the new location
  and must pass.
- **nav.js:** the 🏠 button goes back to the world when the game was opened from the world (a sessionStorage flag set
  by the world just before it navigates), otherwise to the lobby as today.
- **family.js:** the peek also reads `avatar_v1`.
- **sw.js PRECACHE** gains the world pages, modules and vendor files (`node tools/update-precache.js`).
- **tools/update-precache.js** also regenerates `web/world/lesson-files.js`.

## Phase 1: the world and her character

**Character maker** (first visit, and later at the mirror in My Little House, free):
- Big spinning preview. Body style (girl / boy), 5 skin tones, 3 hairstyles (pigtails, bob, short), 8 hair colours,
  8 outfit colours.
- 1 of 3 starter pets: chick, kitten, puppy. A pet name she types (max 12 characters, a default if blank).
- **Done ✨** saves `avatar_v1` and puts her at the gate.

**Moving:**
- Paw joystick bottom-left, plus WASD/arrows. Dragging elsewhere turns the camera (pitch is clamped).
- Tap the ground to walk there. On by default in Grade 2, which also gets a bigger joystick.
- Buildings and the edges block her (simple box and circle checks, sliding along walls).
- **⚡ signpost** in the plaza opens a picture list of the 8 places and every subject door. Tapping one pops her
  there with a sparkle.

**Doors:** each building has a glowing door mat. Standing on it shows "📐 Go to Math!" (Grade 2 paired). Tapping
saves her spot in sessionStorage, sets the came-from-world flag, and opens the same URL as the lobby card. Coming back
puts her outside that door.

**Places in Phase 1:** all 8 are built and walkable. Characters and features inside them arrive in later phases.
Each zone is about a 10–20 second walk from the plaza.

**Sound:** `fx.js` chimes for doors, sparkles and greetings. Soft background music with a 🔇 button, remembered per
device.

**Quality:** starts high (soft shadows, full detail). If the frame rate stays under about 30 fps for 3 seconds it
drops to low (no shadows, fewer flowers and clouds, pixel ratio 1). A ⚙️ button lets her or a parent choose.

**Failure handling:**
- No WebGL, the vendor script fails to load, or world start-up throws: a friendly card, "The world is resting 😴.
  Here's the Campus map!", with a button back to the lobby.
- `webglcontextlost` (the browser reclaims graphics, e.g. after switching apps): show "✨ Waking up…", rebuild the
  scene on `webglcontextrestored`, put her back where she was.

## Phase 2: the map's logic in 3D

- **Medal buildings** from `mastery.js`: none plain, 🥉 roof flag, 🥈 front banner and blooming flower boxes, 🥇 gold
  roof with an occasional sparkle. Signs show the subject name (`.subject-title`, as the 2D map does).
- **Floating markers**, at most 2 per building, same counts as the lobby: ⚔️ boss stage this week, ❗ today's quest,
  🔁 n review due, ✨ over the shop when she can afford a reward.
- **Mayor Mimi** by the fountain uses `guide.js`'s `next()` picker (boss → due review → quest → next lesson → visit a
  new game → done/shop). Talking to her says the step and lights a **sparkle trail** on the ground to that place,
  which fades when she arrives. She waves her over by herself on the first visit each day, otherwise only when
  tapped.
- **Shop Plaza:** Bunny's counter opens the same reward shop (`engine/shop.js`): same items, prices, PIN, wallet.
- **Boss Fort:** when a boss is up, the gate glows and entering opens the next uncleared stage, as the 2D arena does.
  The sign shows "c of n stages cleared". With no boss, the gate is shut with 💤 and Mimi explains when the next one
  comes.
- Everything redraws on return from a game, on `pageshow`, and on `cloud-synced`.

## Phase 3: talking characters

**Speech bubble:** walk near a character and tap. A big bubble shows their name, face and line, with buttons
**💬 More**, **❓ Ask me!** (where offered) and **👋 Bye**. No typing, no chat.

**Subject buddies**, one per door:
- Grade 5: Math ruler kitten, English bookworm, Science test-tube frog, AP carabao, Filipino tarsier with a pencil,
  GMRC panda with a heart, P.E. sporty puppy, TLE sewing hedgehog, Computer robot, Music songbird.
- Grade 2: Math block robot, English train-conductor bear, Filipino tarsier storyteller, Makabansa carabao, GMRC
  panda, Computer mouse (the animal, holding a computer mouse), Science detective frog.

The picker chooses a line from that subject's real state, in this priority order: boss stage this week,
review due, quest today, medal progress (e.g. "Silver! 2 more lessons for gold"), not played for 3+ days, fallback
("Want to learn something new today?").

**❓ Ask me!** (buddies: own subject; Professor Hoot on the park bench: all subjects, up to 3 per visit):
- Only questions that are **due for review** are asked. If none are due: "You're all caught up! 🌟" and an offer
  to open the next lesson. The world cannot be used to farm points.
- Only multiple-choice and true/false questions. Typed answers, picture (`art`) questions and Math Mastery's skill
  reviews stay in the games. Math's buddy offers to open its review instead.
- The world loads that subject's lesson files on demand from `lesson-files.js`, finds the due question by its review
  key, and builds the key with a per-shape adapter: the index shape (`options` strings + `correct` index; all Grade 5
  games and Grade 2 Math and Filipino) and the typed shape (`type: 'mc'` with `{text, correct}` options, `type: 'tf'`
  with `answer`; the other Grade 2 games). A test proves each adapter key
  equals that game's own `reviewInfo` key.
- Answering runs `StudyKit.start` for that app (its `subject.json` pointsKey) and `Recall`, so points, the gap bonus,
  box moves and coins follow exactly the in-game review rules. Right: a happy dance and confetti. Wrong: the right
  answer plus the game's own `why`/`explain` text. The box drops as usual.
- If a lesson file fails to load: "Let's ask in the game!" and the door is offered.

**Talking trees** (Whispering Park, about 8): faces that blink. About 60 original kid-friendly quotes (Grade 2
paired). Each tree has a quote of the day (chosen from the date and tree), and 💬 More gives another.

**Bunny the shopkeeper:** opens the shop and cheers her saving toward the cheapest reward she can't afford yet
("Only 40 more coins for ML with Tatay! 🎮"). She never pushes spending.

## Phase 4: family, comfort and play

**Jesus** (rules above). Lines are paraphrased verses with references, Grade 2 paired.
- **Garden:** sits on the bench with the lamb. 🤗 Hug opens his arms and sends hearts up. 💬 More gives another
  message. Lines vary with her day (e.g. after a long study day: "I'm proud of how hard you tried").
- **Morning greeting:** the first world open of the local day (`world3d_v1.greeted`), he waits at the gate with a
  greeting and a verse. After Hug or Bye he walks back to the garden.
- **Hard day:** checked on world open and on return from a game, at most once per day
  (`world3d_v1.comforted`). A hard day is any of: 5 or more wrong answers today with under 60% right (from study
  history), the daily-quest streak broke today (quests), or a boss stage lost today (boss). He walks over in a soft
  golden glow with comfort matching the reason. If greeting and comfort are both due, comfort wins and counts as the
  greeting.

**Her sister at the gate:** shown in her own `avatar_v1` look and pet, read through the family peek.
- Tap: the existing cheers menu (pre-written cheers, "Ate"/"Bunso", no chat, nothing compared).
- Played in the last 5 minutes: she waves with a ✨ "playing now" glow.
- No `avatar_v1` yet: a friendly default with 🎨 "Ate is still choosing her look!" (paired for Grade 2).

**Playground:** slide, swings, see-saw, merry-go-round. Walk up and tap: her character rides with an animation, the
pet bounces along. No coins, no quizzes, nothing saved.

**10-minute nudge:** counts only while the world is visible and she is not in the character maker or the shop. After
10 minutes without entering a game, Mayor Mimi walks over: "Let's learn something! Science is waiting 🔬" (from
`guide.js`), with **Go ▶** (sparkle trail) or **Later**. Nothing locks. The timer restarts on entering a game and
after each nudge.

## Data

| Key | Shape | Sync |
|---|---|---|
| `avatar_v1` | `{v, body, skin, hair, hairColor, outfit, pet, petName, t}` | Synced, replace merge; in the family peek. Spec 2 adds wardrobe fields |
| `world3d_v1` | `{v, greeted, comforted, t}` (local day keys) | Synced, newer `t` wins |
| `world3d_device_v1` | `{v, quality, music}` | Device only (`LOCAL_ONLY`) |
| sessionStorage | spot she left from, came-from-world flag | Session only |

Not in backups (cosmetic, like `world_v1`). Unknown or invalid values clean to defaults. The pet name is trimmed to
12 characters and escaped everywhere it is shown.

## Performance

Geometry and materials are cached and shared. One shadow-casting sun follows her with a tight shadow box. Target
about 60 fps on her tablet, at least 30 on phones, with automatic low quality below that.

## Testing

- **Unit (Node):** layout covers every lobby app per grade (a new game fails until it gets a building and a buddy);
  dialogue picker priorities; hard-day check; nudge timer; `avatar_v1` cleaning; quiz adapters produce each game's
  `reviewInfo` key; quote of the day is stable per date; Grade 2 lines are all paired.
- **Wiring:** both world pages load the required scripts in order; vendor files, world files and
  `lesson-files.js` are in PRECACHE and `lesson-files.js` is up to date; both lobbies have the Play World button;
  `engine/shop.js` is loaded by both lobbies and both world pages.
- **E2E (headless Chrome, software WebGL):** first visit → maker → gate; walking to a door and Go opens the right
  game URL; 🏠 in that game returns to the world; Ask me! moves the same review box the game would; WebGL disabled →
  resting card; cheers to her sister from the gate. Existing lobby, shop, family and file-check e2e still pass.

## Out of scope

Wardrobe, buying items, more pets, pet tricks, decorating My Little House (spec 2); live AI chat; real-money
purchases; making the 3D world the lobby home; any change inside games except 🏠 returning to the world.
