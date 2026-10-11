# HUD tidy-up and stamina (sub-project D, part 1) — design

Part 1 of sub-project D from `2026-10-11-games-in-world-design.md`. Part 2, lazy loading after measuring the tablet,
is a separate spec and plan that follows.

## Why

On the tablet the 3D world's controls cover too much of the view and feel busy: the zoom slider sits on the left edge
all the time, although pinch-zoom already works. Running is a switch that can be armed while standing still, and she
can run without limit.

## What changes

### 1. Zoom

- On a touch device (`(pointer: coarse)`) the zoom box (`.w-zoom`, `web/world/world-main.js` `buildHud`) is never shown.
  She zooms by pinching (`web/world/move.js`). A mouse or laptop keeps the slider.
- The ⚙️ card gets a Zoom row with − and + buttons for anyone who cannot pinch. They call `ctl.zoom` with the same
  `ZOOM_STEP` the slider uses, and skip the `canZoom()` guard, which is false while the card (an overlay) is open.
  The existing `onZoom` saves the result.

### 2. 🏃 tap while moving

- Tapping 🏃 while she is moving (`ctl.state.mag > 0`) starts a run. Tapping it while running ends it.
- Tapping 🏃 while she stands still does nothing.
- "Stops with her" already exists: `move.js` clears `st.sprint` once she has stood still for `STOP_GRACE`. It stays as is.
  The button's pressed state keeps following `st.sprint`.

### 3. Heart and stamina

New module `web/world/stamina.js` (plain logic, no DOM, no Three.js; exported for Node tests, `World3D.Stamina` in the
browser). State: `heart` from 0 to 1 and `tired`.

- `tick(dt, { running, still, paused })` changes the heart per second:
  - running: +1/8.
  - walking (moving, not running): −1/6.
  - standing still: −1/3.
- The heart is clamped to 0..1. At 1, `tired` becomes true. While tired, `tired` clears only once the heart is at or
  below 0.3 (hysteresis, so it does not flicker).
- `paused` holds the heart at 0 and `tired` false. It is set while a playmate game runs (tag, hide-and-seek,
  patintero, whatever `games3d.playing()` reports; the plan checks that it covers all three). Sprint is then unlimited,
  as it is today. Stamina only matters in free roaming.
- In `world-main.js` `tick`: call `stamina.tick`, and when `tired` call `ctl.sprint(false)`. A 🏃 tap while tired is
  ignored.
- The ❤️ is a new element in `#w-rail`, above 🏃. It shows while `heart > 0` or she is running. A CSS keyframe pulses
  it, and `animation-duration` follows the heart (about 1.2 s empty, 0.35 s full).
- While tired, 🏃 is greyed (`aria-disabled`) and shows the label "catching breath" (new key in `text.js`, English
  only like the other world buttons).
- Sound: while `heart > 0.66` and not paused, `sfx('heartbeat')` plays quietly (about 0.4 gain), with the gap between
  beats shrinking from about 0.9 s to 0.35 s as the heart fills. It reuses the sound `games3d.js` plays for the chase.

## Out of scope

Lazy loading (part 2). Resizing the joystick (the owner says it is fine). Reworking the top pills, ⚙️, the action
button or the room and ride pills. Stamina inside the chase games. A stamina setting for parents.

## Tests

- `tests/world3d-stamina.test.js`: rise, fall (walk, still), clamp, `tired` at 1, recovery only at or below 0.3,
  `paused` resets, and the two timing helpers `stamina.js` also exports: `pulseSeconds(heart)` (1.2 down to 0.35)
  and `beatGap(heart)` (0.9 down to 0.35, or `null` while the heart is at or below 0.66).
- A pure helper for the 🏃 tap rule (moving starts, still ignored, tired ignored), tested in Node.
- `tests/world3d-wiring.test.js`: `stamina.js` is loaded before `world-main.js` on both world pages.
- `tests/e2e/world-e2e.js`: the ⚙️ zoom row (− and + change the zoom), and a tap on 🏃 while still leaves
  `state.sprint` false.
- Pinch-zoom is unchanged, so no new test.
- A tablet check stays pending: no slider on the real tablet, the feel of the heart timing.

## Docs

`docs/HANDOFF.md` 3D world section: one bullet for this part. The "Next" bullet then names only lazy loading.
