# World controls: Sprint, looping rides with Stop, pinch zoom

Date: 2026-10-07. Sub-project A of the playground/exploration/combat idea
(`docs/superpowers/ideas/2026-10-06-playground-exploration-combat.md`). B (pet teacher) and C (gifts + monsters) follow
with their own specs. The slide fix from that idea is already done.

## User decisions

- Sprint is **tap on, auto-off**: one tap makes her 40% faster; it turns itself off when she stops.
- Swings, see-saw and merry-go-round **loop until Stop**; the slide stays one run.
- Zoom is **remembered on the device**.
- Loop style: a **steady middle part** (start once, loop the middle, end once on Stop), not replaying the whole ride.

## 1. Sprint

- A round `🏃` button (`.w-sprint`, aria-label "Sprint") in the bottom-right corner under the Treat / Play / Emote / Use
  stack. On the narrow and side layouts it follows the same media rules as that stack and never covers the joystick or
  the action pill (`.w-act`). Buttons are English on both grades (text.js rule), so there is no Filipino pair.
- Tap: `sprint` on, the button glows (`aria-pressed="true"`). Tap again: off.
- Auto-off when any of these happen: she stops moving (no joystick, no keys, no tap-to-walk target in a frame where
  `mag` is 0), a ride starts, a card / maker / stall / overlay / talk opens, the world is hidden (blur / visibilitychange,
  the same `releaseAll` path).
- Speed: `walk.js` `step` takes a speed factor; `SPRINT = 1.4` (9 → 12.6). Her legs (`walkT`) advance 1.4× too, so the
  footsteps (which follow `walkT` through `Sfx.stepsBetween`) speed up with no extra sound work.
- Speed lines: a CSS overlay (`.w-speed`, pointer-events none) with soft white streaks at the screen edges, shown only
  while sprint is on **and** she is moving. No 3D particles. Respects `prefers-reduced-motion` (no animation, just hidden).
- The button hides whenever the Treat button hides (not free, or riding).
- `move.js` owns the state: `ctl.sprint(on)`, `ctl.state.sprint`; `update` passes the factor to `Walk.step` and clears
  `sprint` when `mag` is 0.

## 2. Looping rides + Stop

### Maths (rides.js, pure functions)

Each ride keeps its existing 0..1 pose/cue maths. A looping ride (`LOOP = { swings, seesaw, merry }`) is driven by
time instead of a single `k`:

- **Start**: the first part of today's ride, unchanged.
- **Loop**: a middle stretch that repeats and joins itself smoothly.
  - Swings: one full back-and-forth at full height (`0.7 · sin`), period 2 s (today's `sin(4πk)` over 4 s), so a
    creak every 1 s as now.
  - See-saw: one full rock, period 2 s, a bump every 1 s as now.
  - Merry-go-round: spins up during Start, then turns at a steady speed equal to today's top speed (1.5π rad/s).
- **End**: after Stop, the ride finishes the current cycle, then plays today's ending (swing fades, merry-go-round
  slows with `merry-slow`), then `ride-land`.
- `Rides.loopPose(pr, id, t, stopAt)` → pose (same shape as `pose`); `Rides.loopPart(id, t, stopAt)` → the prop's angle;
  `Rides.loopCues(id, from, to, stopAt)` → cue names passed between two times; `Rides.loopDone(id, t, stopAt)` → true at
  the end. `stopAt` is null until Stop is tapped; the end always starts on a cycle boundary at or after `stopAt`, so the
  motion never jumps.
- Sounds: `ride-start` and `merry-start` once; `swing` creak at each pass of the bottom and `seesaw-bump` at each
  touchdown, in every loop; `merry-slow` and `ride-land` once at the end.
- The slide keeps `pose` / `cues` as today.

### play.js

- `start(id)`: as today. Looping rides track `t` and `stopAt`.
- `stop()`: sets `stopAt` for a looping ride; ignored for the slide or when not riding.
- `tick(dt)`: uses the loop functions for looping rides, `pose` for the slide; on the last frame puts her at the ride's
  end spot exactly as today.
- `stoppable()`: true while a looping ride runs and Stop has not been tapped.

### Stop pill

- `⏹️ Stop` pill (`.w-stop`) top-right under the HUD, shown only while `play.stoppable()`. English on both grades.
- After the tap it hides; she lands when the ending finishes.
- The 10-minute nudge: if it is due while she is on a looping ride, world-main calls `play.stop()`; the nudge shows
  after she lands (it already waits for a free moment).

## 3. Zoom

- `move.js` keeps `zoom` (default 1, clamp 0.7–1.5); camera distance = `CAM_DIST / zoom` (21.4 wide … 10 close).
- Pinch: a second pointer down on the canvas while the look pointer is held starts a pinch; while two pointers are down
  the camera does not turn and no tap-to-walk fires; zoom = start zoom × (distance now / start distance). Lifting either
  finger ends the pinch; the remaining finger does not turn into a tap.
- Mouse wheel on the canvas: zoom × 0.9 or ÷ 0.9 per notch, clamped; `preventDefault` so the page does not scroll.
- Not while frozen (maker, stall, talk) and not in the maker's portrait view.
- Saved: `prefs.js` `world3d_device_v1` gets `zoom` (number, clamped, missing or broken → 1). Saved when a pinch ends or
  half a second after the last wheel notch, not every frame. `ctl.zoom(z)` sets it at start-up from the prefs.

## 4. Tests

Unit:
- `world3d-rides.test.js`: loop joins (pose at the end of a cycle equals pose at its start); Stop always ends at rest
  (`loopPart` at the end is the rest angle; see-saw rests at `TILT`); the end starts on a cycle boundary at or after
  `stopAt`; `loopCues` gives `ride-start` once, one `swing` per bottom pass across several loops, one `seesaw-bump` per
  touchdown, `merry-slow` + `ride-land` once after Stop; nothing after `loopDone`.
- `world3d-walk.test.js`: the speed factor moves her 1.4× as far; walls still block at sprint speed.
- `world3d-prefs.test.js`: zoom saved and read, clamped to 0.7–1.5, missing / string / NaN → 1, old prefs without zoom
  still read.
- A move.js test (or the wiring test) for the zoom clamp and `CAM_DIST / zoom`.

E2e (world spec, Grade 5):
- Sprint: tap 🏃 → pressed; walk → she covers more ground per second than without; let go → button no longer pressed.
- Looping ride: start the swings, wait longer than today's 4 s → still riding and Stop visible; tap Stop → she lands at
  the swings' end spot and Stop hides.
- Slide: no Stop pill; ends on its own.
- Zoom: wheel on the canvas changes the camera distance within the clamp; reload keeps it.

## Out of scope

- Camera collision with buildings when zoomed out.
- Any coins, items or questions (sub-project C).
