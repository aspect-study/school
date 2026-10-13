# Focus music: a calm loop that is different for every lesson

Date: 2026-10-13.

## Goal

Opening a lesson is silent today, so it feels flat. While she reads the cards and answers the quiz, a soft, slow tune
plays in the background to help her settle and focus. Every lesson has its own tune, and the same lesson always gets the
same one, so it becomes familiar.

Cosmetic only: nothing here saves study data, awards coins or points, or changes review, medals or the shop.

## Decisions (made with the owner, 2026-10-13)

- Plays for the whole lesson: from opening it, through the cards and the quiz, until she leaves it or reaches the
  results screen.
- Synthesized with Web Audio, no audio files (works offline, adds nothing to the precache size).
- Unique per lesson, from a seed made of the game and the lesson id.
- On by default and quiet. A toggle in the ☰ menu, saved per device.

## Out of scope

- Real audio tracks, a choice of music styles, a volume slider.
- Music on the lobby, the map, the shop or the parent page. The world already has its own music (`web/world/music.js`).
- Any change to scoring, review, medals, coins or history.

## How a lesson gets its tune

`Focus.compose(seed)` is pure: a string seed goes in, a plan comes out (no audio objects), so Node tests can check it.
The seed is `<game key>:<lesson id>`. A small string hash feeds a seeded random generator (mulberry32).

The plan picks, in this order, so the same seed always gives the same result:

- **Mode**, one of four calm ones: major pentatonic, Lydian, Dorian, natural minor. No tritone-heavy or chromatic notes.
- **Root note**, any of the 12 keys, placed in a comfortable low-middle register.
- **Tempo**, 52-68 BPM.
- **Voice**, one of four soft timbres: warm pad, music-box chime, soft marimba, harp-like pluck. Built from sine and
  triangle oscillators through one low-pass filter.
- **Chords**, a loop of 4 chords built from the mode, one per bar.
- **Melody**, 4 bars over the chords, mostly chord tones, mostly stepwise, with many rests. Every other pass the
  melody drops or moves one note, so the loop does not feel mechanical.
- **Reverb**, a short generated impulse (a decaying noise buffer) through one ConvolverNode.

Two lessons can by chance share a mode and a tempo, but the full plan (key, voice, chords, melody) is different, and a test
checks that real lesson ids produce plans that are all different.

## When it plays

- `Focus.start(seed)` runs when a lesson opens. It fades in over about 2 s.
- `Focus.stop()` fades out over about 1 s when she leaves the lesson (back, home, map) or reaches the results screen.
  The medal and voice clips then play over silence.
- **Ducking:** while an `Fx` clip or speech plays, the music gain drops to about 30% and returns after it ends, so
  the call-outs are always clear. `Fx` calls `Focus.duck(ms)`.
- **Hidden tab:** it pauses on `visibilitychange` and resumes when the tab is shown again.
- **Autoplay rule:** browsers block audio until a tap. She has always tapped to open a lesson, so `start` runs inside that
  gesture. If the context is still suspended, `start` retries on the next tap instead of failing.
- **World music:** games open in a frame in the world, and the world already stops its music while the portal is
  open (`world-main.js`, `!portal.isOpen()`). The frame is a separate window, so the lesson music has its own
  `AudioContext` and no coordination is needed. When a game is opened on its own (not embedded), there is no world music.
- A lesson that is already open when `Focus.stop()` or `start` is called twice does nothing extra: `start` with the same seed
  while playing is a no-op, and with a new seed it cross-fades.

## Controls

- Loudness is fixed and low: the master gain is about 0.06, below the sound effects.
- The ☰ menu from `nav.js` gets a **Focus music** check item (🎵 on / off) beside the existing sound item, with the same
  English-and-Filipino text pairing the sound item uses for Grade 2 (buttons stay English only for Grade 2, per the project rule).
- The setting is stored in `localStorage` under `study_focus_v1` (`'0'` = off, anything else = on), device-only like
  `study_fx_muted_v1`. It is not synced and not in backups.
- The existing sound item (`Fx.muted()`) also silences the music: if sound is off, focus music is off, whatever the
  🎵 setting is. The 🎵 item is hidden while sound is off, so the two never disagree.
- Off means nothing is created: no `AudioContext`, no timers.

## Architecture

### `web/engine/focus.js` (new, ES5 IIFE `(function (root) {...})(this)`, tested in Node)

- Exports `compose(seed)`, `hash(str)`, `MODES`, `create(win)`.
- `create(win)` returns `{ start(seed), stop(), duck(ms), playing(), enabled(), setEnabled(on) }`.
- The browser global is `root.Focus = create(root)`.
- The player schedules notes with a short look-ahead timer, as `world/music.js` does (skip ahead if the timer was throttled
  instead of piling notes up). It reuses that approach rather than importing it, because the world module lives under
  `web/world/` and games do not load world scripts.

### Wiring in the 17 games

- Each game's `index.html` loads `../../../engine/focus.js` (the path its other engine scripts use) and calls
  `Focus.start('<game key>:' + LESSONS[i].id)` in `openLesson`, and `Focus.stop()` where the screen leaves the lesson.
- The stop is driven from the game's `showScreen`: a screen other than the cards, quiz and exam screens stops the music. The
  per-game screen ids are listed in the plan, one table row per game.
- The boss round, spaced review and final exam are lessons in effect: they get a seed from their own name
  (`boss`, `review`, `final`) plus the game key, so they have a tune but one that is the same every time.
- `nav.js` adds the menu item and calls `Focus.setEnabled`.
- `Fx` calls `Focus.duck` when it plays a clip or speech, guarded with `root.Focus &&` so a game without it still works.

### Files and rules from `CLAUDE.md`

- Add `web/engine/focus.js` to the precache with `node tools/update-precache.js` (`tests/pwa.test.js` enforces it).
- ES5 only, no build step, comments only where non-obvious (the seed and look-ahead scheduling).
- Wiring is a hook contract: a test fails if any game has lessons and is missing `Focus.start` or `Focus.stop`, the same
  way the existing nav, trail and power-up hooks are enforced.

## Errors

- No Web Audio (old browser): `start` returns and nothing happens.
- `AudioContext` creation throws or is blocked: caught, the timer is cleared, the game carries on silent.
- `localStorage` unavailable: treated as on (the default), nothing thrown.
- Low-end tablets: one voice plus one short convolver at most. There is no device sniffing; the plan includes a listening
  check on the owner's two tablets, and the reverb is the first thing removed if it stutters.

## Tests

`tests/focus.test.js` (`node --test`):

- `compose` is deterministic: the same seed gives a deep-equal plan.
- Different seeds give different plans: every lesson id of every game produces a distinct plan (hashes of `plan` all differ).
- Every melody and chord note is inside the chosen mode; tempo is 52-68; mode and voice come from the allowed lists.
- Melody has at least 30% rests and never leaps more than a fifth.
- `create` with a fake `win` and fake `AudioContext`: `start` schedules notes, a second `start` with the same seed is a
  no-op, a new seed cross-fades, `stop` clears the timer, `setEnabled(false)` stops it, `duck` lowers then restores gain,
  and nothing is created while disabled.
- Hook test: every game that has `LESSONS` calls `Focus.start` and `Focus.stop`, and loads `focus.js`.
- `tests/pwa.test.js` stays green after `update-precache.js`.

Manual: owner listens to a handful of lessons on both tablets (stutter check, volume against the voice clips, tune
variety), and checks the ☰ toggle and that sound-off silences it. `tests/e2e` lobby and game scripts must still pass.

## Later

- Optional per-subject flavour (a brighter mode for Math, softer for GMRC) if the owner wants the subjects to feel different.
- A "Focus music" row in the parent page if a child ever finds it distracting.

## Adjustments made while planning and building

- The seed is `<game key>:<lesson title>`, not the lesson id: Grade 2 lessons have only an index, and every lesson has a title.
- The stop rule lives in `Focus.screen(id)`, called by `Nav.screen`: music plays on screen ids matching `/flash|cards|quiz/i` and stops on every other screen.
- A new seed while playing takes effect at the next bar, so the notes already ringing fade naturally (this is the "cross-fade").
- The menu item uses 🎶, because 🎵 is already the Sounds item. `Focus.setting()` is the saved choice; `Focus.enabled()` is the effective one (setting on and `Fx` not muted).
- The no-big-leap rule (at most a fifth) holds between notes inside one pass of the melody. The jump where the loop restarts is not limited.
- The second pass drops one note chosen so that its neighbours stay within a fifth of each other.
- Uniqueness is tested with 2000 synthetic seeds, because lesson data lives in many formats.
- The master level is 0.12 with voices at 0.5 and chords at 0.18 (peak about 0.06 for the melody); the tablet listening check decides if it needs changing.
