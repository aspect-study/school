# Wardrobe 3b: sounds in the 3D world (footsteps, pets, props, emotes)

Date: 2026-10-07. Part of the 3D world wardrobe (spec 2), sub-project 3, split by the user into **3a** (props + emotes,
`2026-10-07-props-emotes-design.md`, built) and **3b** (sounds, this spec). Builds on pets 2a/2b
(`2026-10-06-pets-design.md`, `2026-10-06-pets-2b-design.md`).

## Decisions (user, 2026-10-07)

- **Scope B:** her footsteps, the 12 prop ✨ Use sounds, the 11 emote sounds, **plus her pet**: a voice per pet type and
  the pet-play sounds (treat, fetch, tricks).
- **Later as 3c, not now:** ride sounds, stall-buy cha-ching, world button taps, sounds for the visual effects
  (bubble pops, sparkles).
- **Real clips, mostly:** the user picked every sound on an audition page (scratchpad, session-only) from Kenney (CC0)
  and Mixkit (Mixkit free license) candidates. Only the baby dragon is code-made. Picks are in the table below.
- **Footsteps:** always on while she walks, quiet, grass or stone by the ground under her, plus a separate
  **👣 Footsteps On/Off** setting.
- **Pet voice (C):** on tap, treat, trick, fetch return and celebration, **plus** now and then on its own (at most once
  every 45 s), **plus** once at the start of play with her sister's pet (both pets).
- **Stalls (A):** sounds play while trying things: Kuya Pilo's emote demo plays its sound once per pick (a demo plays
  once per pick), a pet tried on at Mang Kiko's says hello once, and Try plays trick and toy sounds. The mirror is silent.
- **Pet beeps replaced:** the games' chimes the pet plays today (pat, treat, throw) give way to its new sounds; the
  celebration keeps its chime and adds the voice.
- **Approach A:** a new Web Audio engine `world/sfx.js` (not `engine/fx.js`, not `new Audio()` per clip).

## Sound picks

`rate` and `cut` are baked into the file by the tool script (speed and pitch change together, the same as the
audition's speed buttons); the engine plays every file at 1×. Mixkit ids are the `sfx/<id>/<id>-preview.mp3` clips.

### Her footsteps

| key | file(s) | source |
|---|---|---|
| `step-grass` | `step-grass.mp3` | Mixkit 1920 "Grass step" |
| `step-stone` | `step-stone-1.mp3` … `step-stone-5.mp3` | Kenney Impact Sounds `footstep_concrete_000`–`004` |

### Pet voices (`voice(type)`, keyed by the `pets.js` id)

| pet | file | source | rate | cut |
|---|---|---|---|---|
| chick | `pet-chick.mp3` | Mixkit 67 "Melodic songbird chirp" | | |
| kitten | `pet-kitten.mp3` | Mixkit 91 "Cartoon little cat meow" | | |
| puppy | `pet-puppy.mp3` | Mixkit 741 "Happy puppy barks" | 1.25 | first 1.5 s |
| hamster | `pet-hamster.mp3` | Mixkit 2873 "Creepy little creature" | 1.5 | |
| duckling | `pet-duckling.mp3` | Mixkit 1014 "Rubber duck squeak" | | |
| bunny | `pet-bunny.mp3` | Mixkit 2210 "Cartoon cute sneeze" | | |
| turtle | `pop.mp3` (shared) | Mixkit 2364 "Hard pop click" | | |
| piglet | `pet-piglet.mp3` | Mixkit 3 "Pig grunting" | 1.25 | first 1.4 s |
| parrot | `pet-parrot.mp3` | Mixkit 18 "Toy whistler bird" | | |
| carabao | `pet-carabao.mp3` | Mixkit 1744 "Cow moo" | 1.25 | |
| penguin | `pet-penguin.mp3` | Mixkit 1882 "Bath duck squeeze" | | |
| fox | `pet-fox.mp3` | Mixkit 2872 "Funny little creature laughing" | 1.5 | |
| tarsier | `pet-tarsier.mp3` | Mixkit 102 "Cartoon baby monkey laugh" | | |
| panda | `pet-panda.mp3` | Mixkit 2268 "Cartoon vocal yawn" | | |
| unicorn | `pet-unicorn.mp3` | Mixkit 1762 "Stallion horse neigh" | 1.25 | |
| dragon | (no file) | code-made "rawr" (sawtooth 300→200 Hz + band-passed noise, 0.35 s) | 1.5 | |

### Pet play

| key | file | source |
|---|---|---|
| `treat` | `treat.mp3` | Mixkit 2244 "Chewing something crunchy" |
| `throw` | `throw.mp3` | Mixkit 1491 "Arrow whoosh" |
| `land` | `land.mp3` | Kenney Impact Sounds `impactSoft_medium_000` |
| `catch` | `pop.mp3` (shared) | Mixkit 2364 "Hard pop click" |
| `dig` | `dig.mp3` | Mixkit 1494 "Sand swish" |
| `drop` | `drop.mp3` | Mixkit 3088 "Tv remote control or plastic toy drop" |
| `trick` | `spin-whistle.mp3` (shared) | Mixkit 2647 "Spinning whistle toy" |
| `trick-land` | `trick-land.mp3` | Mixkit 2255 "Cartoon positive sound" |

### Prop ✨ Use (key = the moves.js id)

| key | file | source |
|---|---|---|
| `use-balloon` | `use-balloon.mp3` | Mixkit 3072 "Annoying ballon sounds" |
| `use-bubblewand` | `use-bubblewand.mp3` | Mixkit 2999 "Magic bubbles spell" |
| `use-pamaypay` | `use-pamaypay.mp3` | Mixkit 1489 "Air woosh" |
| `use-teddy` | `use-teddy.mp3` | Mixkit 2816 "Clown squeaky toy" |
| `use-bouquet` | `use-bouquet.mp3` | Mixkit 864 "Fairy bell bless" |
| `use-umbrella` | `use-umbrella.mp3` | Kenney RPG Audio `cloth3` |
| `use-ribbonwand` | `use-ribbonwand.mp3` | Mixkit 1463 "Spellcaster fairy swoosh" |
| `use-drum` | `use-drum.mp3` | Mixkit 560 "Toy drums and bell ding" |
| `use-parol` | `use-parol.mp3` | Mixkit 2820 "Magic marimba" |
| `use-ukulele` | `use-ukulele.mp3` | Mixkit 2328 "Guitar stroke up" |
| `use-magicwand` | `use-magicwand.mp3` | Mixkit 3062 "Magic wand sparkle" |
| `use-trophy` | `use-trophy.mp3` | Mixkit 523 "Animated small group applause" |

### Emotes (key = the emotes.js id)

| key | file | source | cut |
|---|---|---|---|
| `emote-wave` | `emote-wave.mp3` | Mixkit 861 "Fairy message notification" | |
| `emote-clap` | `emote-clap.mp3` | Mixkit 480 "Clapping fast" | |
| `emote-cheer` | `emote-cheer.mp3` | Mixkit 515 "Girls crowd cheer, scream, and applause" | first 2.5 s |
| `emote-bow` | `emote-bow.mp3` | Mixkit 2344 "Magic notification ring" | |
| `emote-heart` | `emote-heart.mp3` | Mixkit 2194 "Cartoon friendly kiss" | |
| `emote-giggle` | `emote-giggle.mp3` | Mixkit 2265 "Happy child laughing" | |
| `emote-spin` | `spin-whistle.mp3` (shared) | Mixkit 2647 "Spinning whistle toy" | |
| `emote-relax` | `emote-relax.mp3` | Mixkit 3109 "Relaxing bell chime" | |
| `emote-dance` | `emote-dance.mp3` | Mixkit 2881 "Funny cartoon melody" | |
| `emote-cartwheel` | `emote-cartwheel.mp3` | Mixkit 2888 "Funny video game slide" | |
| `emote-hero` | `emote-hero.mp3` | Mixkit 555 "Achievement win drums" | |

Outfit idles (`idle-*`) are silent.

That is 49 keys, 48 with files, **50 files** (5 stone steps; `pop.mp3` and `spin-whistle.mp3` each serve two keys).

## Files

- `web/assets/sounds/world/*.mp3`: the 50 clips, mono, 22.05 kHz, about 64 kbps, cut and rate-baked; about 1 MB
  in all (the raw downloads were 3.2 MB, mostly three long clips).
- `tools/world-sounds.js`: one-off Node script that downloads the picks (Mixkit preview mp3s, Kenney zips), then cuts,
  speeds up (`asetrate`+`aresample`, so pitch rises like the audition) and encodes them with a temporary
  `ffmpeg-static` installed in a scratch folder (never in the project's package.json). Kept so the files can be remade
  or one swapped later. Its picks table is the credits list (source, id/name, license: Kenney CC0, Mixkit free license).
- `web/world/sfx.js`: the engine (below). No Three.js; loads in Node for tests, like `music.js`.
- Both `world/grade-5.html` and `world/grade-2.html` load `sfx.js` after `music.js`.

## Engine: `world/sfx.js`

```
World3D.Sfx = { SOUNDS, VOICES, stepsBetween(prevWalkT, walkT), create(win, opts) }
create(win, { base: '../assets/sounds/world/' }) → {
  unlock(),                 // first tap: make/resume the AudioContext, then warm every buffer in the background
  setOn(sound, steps),      // sound = !Fx.muted(); steps = prefs.steps
  play(key, o),             // o: { gain (0-1 multiplier, e.g. sister's pet 0.5), delay (s), wobble (bool), her (bool) }
  step(surface),            // 'grass' | 'stone'; stone cycles its 5 files
  voice(petType, o),        // the pet's voice key, or the code-made rawr for the dragon
  stopHer(fade),            // fades out only sounds played with o.her (her emote / ✨ Use) over fade seconds
  stopAll(fade)             // everything; on tab hide
}
```

- **`SOUNDS` table**, one entry per key: `file` or `files`, `gain`, `cool` (min seconds between plays of that key),
  optional `delay` (s after the move starts) and `wobble` (±6 % rate). Starting gains: footsteps 0.25, pet voices 0.6,
  pet play 0.5, props and emotes 0.6, the two applause/cheer clips 0.45. Default `cool` 0.15 s; voices 0.6 s.
- **`VOICES`**: `pets.js` id → voice key (`'rawr'` for the dragon).
- **Loading:** a buffer is fetched + decoded the first time its key is needed; after `unlock()` all buffers are warmed
  in the background. A key whose buffer is not ready is **skipped, never queued**. A failed fetch or decode marks that
  key dead (skipped from then on); nothing throws.
- **Limits:** at most 6 sounds at once (a new one beyond that is dropped); per-key cooldown.
- **Off states:** `setOn(false, …)` → every call is a no-op and nothing is fetched; `steps false` → `step()` is a no-op.
  Sound off at page load means no clip is ever downloaded.
- **No Web Audio** (or it fails to start) → every method is a no-op.
- The tab hiding calls `stopAll(0)`, next to the music's stop.

## When sounds play

Runtime modules report what happens; `world-main.js` and `companion.js` turn reports into sounds. `moverun.js` is
unchanged and `petlife.js` stays free of audio.

### Her

- **Footsteps follow her legs:** `move.js` already advances `st.walkT` while she walks (`avatar.js` swings her legs with
  `sin(walkT)`). A foot plants each time `walkT` passes `π/2 + kπ`. A pure helper `Sfx.stepsBetween(prevWalkT, walkT)`
  counts the plants crossed this frame (only forward; `walkT` decaying when she stops never counts); `world-main` calls
  `sfx.step(surface)` once per plant. Surface is `stone` when `L.onPath(grade, x, z, 0)` or she is within
  `places(grade).plaza.r` of the plaza centre, else `grass`. No steps while riding (`riding`), in a panel, or during a
  move (she is not walking then anyway). Grass steps wobble ±6 %.
- **Emotes and ✨ Use:** in `world-main`'s `startMove(id)`, after `runner.start(id)` succeeds →
  `sfx.play(id, { her: true })` (with the key's `delay`).
- **Cut short:** before `runner.tick(...)` and before each `runner.stop()`, `world-main` keeps `runner.state()`; when a
  non-idle move had `k < 1` and is gone afterwards (tick returned null, or it was stopped), it calls `sfx.stopHer(0.2)`.
  A move that finishes (`k` reaches 1) lets its sound end. Pet sounds are never cut.
- **Outfit idles:** started inside `runner.tick` → never reach `startMove` → silent.

### Her pet

`petlife` gets an event list in the style of its existing one-shot `fired`: `s.heard = []`, pushed at the points
where the state changes, as `{ name, info }`:

| event | pushed in petlife at | info |
|---|---|---|
| `pat` | `pat()` | |
| `treat` | `treat()` when it returns true | |
| `trick-start` | `startTrick()` when it begins | `{ id }` |
| `trick-land` | a trick ending with `end(s, true)` | `{ id }` |
| `throw` | `startFetch()` when it begins | |
| `land` | fetch stage `throw` → `run` (the toy reached the ground) | |
| `catch` | `arrive()` during stage `throw` (frisbee caught in the air), and `startHold()` (toy hops into its mouth at the stall) | |
| `dig` | entering stage `pick` when `toy.dig` | |
| `drop` | stage `back` → `drop` | |
| `play-start` | `startPlay()` when it begins | |
| `celebrate` | the moment the plan fires (where `s.fired` is set) | |
| `chatter` | `tick()`, see below | |

`companion.js` reads and empties `life.heard` every `tick` and calls a new option `o.sfx(name, info, petType)`;
`world-main` maps it:

- `pat` → voice. `treat` → `treat` (munch), then voice 0.4 s later.
- `trick-start` → `trick` whistle, except `trick-bow`. `trick-land` → `trick-land` + voice.
- `throw` → `throw`; `land` → `land`; `catch` → `catch` (pop); `dig` → `dig`; `drop` → `drop` + voice.
- `celebrate` → voice. When the plan has a trick, its own `trick-start`/`trick-land` follow as normal; the
  celebration's chime from `cheer.js` (`f.sound`) is **kept**.
- `play-start` → her pet's voice, then the sister's pet's voice 0.7 s later at gain 0.5 (type from the kin handle; 0.7 s clears the
  0.6 s voice cooldown when both pets are the same kind).
- `chatter` → voice with wobble.

**The old pet beeps are replaced (user, 2026-10-07):** `companion.js` drops `o.sound('cardRead')` in `pat()`,
`o.sound('allRead')` in `treat()` and `o.sound('cardRead')` when fetch starts. Only the celebration keeps `o.sound`.
Other world chimes (door in reach, Jesus' hug, sending a cheer, closing a stall, playground) stay.

**Chatter:** `PetLife.create(rand)` takes a random function (default `Math.random`) and keeps `s.chatAt`, the next
chatter time, drawn 45–75 s ahead. `tick(s, dt, her)` gets `her.quiet` (true while a panel, talk, quiz card, stall or
move is open) and `her.near` (pet within 6 units). When `s.t >= s.chatAt`, the pet is not busy, not asleep
(`still < SLEEP`), not quiet and near, it pushes `chatter` and draws the next time; otherwise it waits and tries again
next frame.

**Sister's pet:** `kin.js`'s lent handle gains `type` (the sister's pet id), so `companion` can pass it on with
`play-start`. The sister's own avatar makes no sounds.

### Stalls

- **Kuya Pilo:** the stall's `demo(id)` in `world-main` (an emote) → `runner.start(id, true)` → `sfx.play(id, { her:
  true })`. A demo plays once per pick (it does not loop), so the sound plays once per pick.
- **Mang Kiko:** a pet tried on → its voice once. Try of a trick → `trick-start`/`trick-land`; Try of a toy →
  `startHold` → `catch` pop.
- **Mirror:** silent.

## Settings

- `🔊 Sound` stays the master switch (`Fx.muted()`, shared with the games). The floating 🔊 button is hidden in the
  world (`world.css`), so the settings card is the only switch: its Sound row calls `sfx.setOn(...)` next to the
  music's start/stop. Off → world sounds off too.
- New row **`👣 Footsteps`** (Grade 2: **`👣 Yabag · Footsteps`**) with the existing On/Off buttons, under Sound;
  `text.js` gets `steps` in both grades. Saved device-only in `world3d_device_v1` as `steps` (default `true`; that key
  is already local-only in `sync-core.js`, so it never syncs and is not in backups). With Sound off the row stays but
  has no effect.
- No volume slider; loudness lives in the `SOUNDS` gains.

## Offline

`node tools/update-precache.js` adds the 50 files to `sw.js` `PRECACHE` (it lists every file under `web/`);
`tests/pwa.test.js` already fails when one is missing, so no new cache test is needed. No credits file goes in the
sounds folder (it would be precached too): the sources live in `tools/world-sounds.js`'s table and in this spec.
`tests/fx.test.js`'s "every file in assets/sounds is used" check is changed to look at files only, not the `world/`
folder.

## Testing

Unit (Node, fake AudioContext + fake fetch):
- every `SOUNDS` file exists in `assets/sounds/world/`, and every file there is used by `SOUNDS`;
- every `pets.js` pet has a `VOICES` entry; every `emotes.js` emote and every prop's `use-*` move has a `SOUNDS` key
  (a new pet, emote or prop fails until it has a sound or an explicit `silent` entry);
- cooldown, the 6-at-once cap, not-ready buffers skipped (not queued), dead keys after a failed decode, `setOn(false)`
  fetches nothing, `steps false`, `stopHer` leaves pet sounds alone, no Web Audio → no throw;
- `stepsBetween`: one plant per π of `walkT`, none going backwards; surface: on a path or in the plaza → stone;
- `petlife.heard`: each fetch stage once and in order (ball: throw, land, drop; frisbee caught: throw, catch, drop;
  bone: throw, land, dig, drop), treat only when accepted, trick start/land, `catch` on hold, `play-start`,
  `celebrate`; `chatter` never sooner than 45 s, never while asleep, quiet, far or busy (seeded `rand`);
- `companion` no longer calls `o.sound` for pat, treat or fetch (wiring test on the source);
- prefs: `steps` reads/saves with default `true`.

E2E (Grade 5): with a seeded pet, an emote and a pet tap reach the sound engine (its log), the settings card shows
the Footsteps row, and Off saves `steps: false`, with no page errors. Grade 2's row text is checked by the unit text
test.

## Out of scope (3c or later)

Ride sounds, stall-buy cha-ching, world button taps, effect sounds (bubble pops, sparkles), the sister's own move
sounds, a volume slider, any change to the games' sounds.

## Tablet check after the build

Footstep timing against her feet, loudness against the music box, first-tap unlock on the iPad, the random pet voice
not getting tiresome.
