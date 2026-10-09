# Start page backdrop: the animated Play World behind the buttons

Date: 2026-10-09. Status: design approved by the owner, spec awaiting review.

## Goal

The start page (`web/index.html`: Sign in, Create family account, Play without an account, Parent page) gets a moving
background: the real 3D Play World with a slowly gliding camera, the playground kids walking the paths and a few pets
trotting after them.

## Decisions (from the owner)

- Real 3D world, not a 2D imitation.
- Walking kids and pets, not only a flyover.
- The town is picked at random on every visit: Campus (grade 5) or Bayan (grade 2).

## Design

### Pieces

- `web/world/backdrop.html`: a standalone page that loads only the scripts needed to draw a town and its kids:
  three.js (+ rounded-box), `text.js`, `scene.js`, `layout.js`, `items.js`, `pets.js`, `look.js`, `avatar.js`,
  `petbody.js`, `mates.js`, `matemind.js`, `build.js` and the new `backdrop.js`. It loads no learner, storage, wallet,
  study history, quiz or sync code, and reads and writes no saved data.
- `web/world/backdrop.js`: picks the grade, builds the scene with `World3D.Scene.create` (quality low) and
  `World3D.Build.build`, runs the frame loop, the camera flyover, the roaming kids and the pets.
- `web/index.html`: a full-screen `<iframe>` behind the content, `pointer-events: none`, `aria-hidden`, `tabindex=-1`,
  with its `src` set only after the page's `load` event, fading in once the iframe reports it is ready (postMessage
  `backdrop-ready`). Until then, and if it never reports, the page looks as it does today.

### Scene

- Grade: `Math.random() < 0.5 ? 'grade5' : 'grade2'`, in a small exported function so a test can inject the random
  source. Sign text comes from `World3D.Text.localized(grade, false)` (English half only, as the world signs do).
- Camera: orbits slowly around one kid at a fixed height and radius, and hands over to the next kid every 25 seconds
  (the kids roam the whole map, so an orbit around the Plaza would rarely show them). No input.
- Kids: the nine playground kids from `Mates.all`, built with `Avatar.character`, moved by `MateMind` over
  `Layout.walkways(grade)` with the same blocked check the world uses. Only the walk/idle pose is needed; no talking,
  tags, pops or games.
- Pets: three or four pets built with `Petbody.build`, each trailing a kid at a short distance with a simple follow.
- Reuse the existing pose and walk-cycle code from `mates3d.js` and `avatar.js`. If the pose code cannot be called
  without the rest of `mates3d.js`, extract it into a small shared function rather than copying it.

### Legibility

- A cream veil (about 40% opacity) over the iframe keeps the 3D soft.
- Every view of the start page (not only the title) sits on the backdrop, so `<main>` gets a translucent cream panel
  with rounded corners instead of a title pill. The buttons keep their white cards. Dark mode is not a concern: the
  start page has none.

### Performance and fallbacks

- Quality low: pixel ratio 1, shadows off, extras hidden; frame loop capped at 30 fps.
- Pauses while the tab is hidden (`visibilitychange`); handles WebGL context loss by stopping and hiding itself.
- `prefers-reduced-motion`: renders one still frame and stops.
- No WebGL, a script error, or a frame rate that stays under 15 fps for 3 seconds: the iframe is removed and the page
  shows the current cream background. Nothing is reported to the user.
- Both new files go into the offline precache (`node tools/update-precache.js`), as `tests/pwa.test.js` requires.

### What it must not do

- Touch or load the learner, storage, wallet, points, quests or sync. It is purely visual.
- Intercept taps, steal focus or add anything for screen readers.
- Delay the buttons: nothing in `index.html` waits for the backdrop.

## Testing

- Unit (`node --test`): the grade pick with an injected random source (both outcomes); the fallback decision (no
  WebGL, slow frames, reduced motion).
- Headless-Chrome e2e (`tests/e2e`, listed in `README.md`): the start page still shows its three buttons and the
  Parent link, the iframe reaches ready, a tap on each button still works through the iframe layer, and with WebGL
  blocked the page looks as today (no iframe, no error).
- `node tests/e2e/world-e2e.js` must still pass, since `scene.js` and `build.js` are shared.

## Out of scope

- Any interaction with the backdrop town, music or sound.
- Choosing the town from the saved grade of a returning device (the start page does not know it).
- Changing the lobbies, the real 3D world or the account flow.
