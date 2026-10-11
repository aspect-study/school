# Games inside the world: a frame overlay over the paused town

Date: 2026-10-11. Builds on the walkable 3D world (`2026-10-05`) and the game navigation bar (`2026-10-03`); everything
there still holds unless changed here. Replaces the parked "classroom overlay" idea (2026-10-08): the owner chose a
floating card over the town instead of themed 3D classrooms.

## Why

The owner wants the whole app to live in the 3D world, with no flat page menus. Each game already has its own building,
but walking through the door leaves the world: `act()` in `web/world/world-main.js` loads the game as a separate page,
and coming back reloads the world. This spec keeps her in the world while she plays a game.

This is sub-project B of four from the 2026-10-11 brainstorm:

- A. Light theme everywhere: lock games and lobbies to light (today they follow the device's dark mode, which is where
  the dark "dashboard" look comes from), then restyle fonts and buttons.
- **B. Games inside the world (this spec).**
- C. World as home: sign-in goes straight to the world; the reward shop, quests, search, settings and the PIN-gated
  parent area open as overlays in the world. The lobby stays as the fallback without WebGL.
- D. HUD tidy-up and lazy loading, after measuring the tablet.

## Decisions

- **The real game page runs in an iframe** over the world (same origin, same storage). No game is rebuilt as 3D or as a
  new modal: scoring, review boxes, medals, power-ups, fair points and every button stay as they are.
- **Floating card over the frozen, blurred town**, not a themed classroom.
- **Look: playful frame, clean inside.** A thick rounded frame in the building's `roof` colour (from `layout.js` APPS),
  a chunky ✕ button with a darker bottom edge that springs down on press, and a short pop-in. The game page inside keeps
  its own clean look.
- **No live blur or depth of field.** After the camera glide, the world draws one last frame, stops its frame loop and
  music, and the canvas gets a CSS blur. This costs nothing per frame and saves tablet battery.
- **Only the world embeds.** Games opened from the lobby, the phone parent page or a bookmark behave exactly as today.

## Design

### `web/world/portal.js` (new)

`W.Portal.create(deps)` returns `{ open(app, url, color), close(then), isOpen() }`. Its deps are the document, the
camera controller, `freeze(on)`, `pauseWorld(on)` (frame loop, music, nudge timer, playmate timers), `onClosed(then)`
and a clock.

- `open`:
  1. Ignored while a frame is already open or opening.
  2. Freezes her and glides the camera over 600 ms from its current position and look-at to a point in front of the
     door looking at it.
  3. Calls `pauseWorld(true)`, adds the class `w-portal-on` (CSS blur on the canvas) and inserts
     `<div class="w-portal">` with the frame, the ✕ button and
     `<iframe src="{url}{?|&}embed=1" title="{sign}">`.
  4. Pushes one history entry `{ portal: app }`.
- `close(then)`: removes the frame, takes off the blur, calls `pauseWorld(false)`, glides the camera back over 400 ms,
  unfreezes her and then calls `onClosed(then)`. If the portal's history entry is still on top, it is consumed with
  `history.back()` first.
- **Messages:** a `message` listener accepts only events whose `source` is the iframe's `contentWindow` and whose
  `origin` equals `location.origin`. `{ type: 'portal-close', then?: 'shop' }` calls `close(then)`. Anything else is
  ignored.
- **✕ button:** always closes, even if the game inside is stuck. It does not run the game's leave-quiz check (points
  already earned are saved as each answer is given).
- **Load timeout:** if the iframe has not fired `load` after 8 s, the portal closes and the world falls back to today's
  full-page navigation to the same URL (without `embed=1`).
- **Pure parts, exported for tests:** `ease(from, to, t)` (smoothstep between two `{pos, look}` poses),
  `embedUrl(url)`, `acceptMessage(evt, frameWin, origin)`.

### `web/world/world-main.js`

- In `act()`, a `door` calls `leaving(near.app)` as today, then `portal.open(near.app, town.doorHref(...), app.roof)`
  instead of `debug.go(...)`.
- `onClosed(then)`: rereads what the HUD and building decorations show (wallet, medals, quests, boss), runs the world's
  daily refresh if the date changed, then `welcome(W.Prefs.readReturn(session))` so her pet celebrates as it does after a
  page return today. If `then === 'shop'`, the world calls its existing `shop()` (the lobby's `#shop-world`).
- `debug.portal` exposes `isOpen()` and `close()` for e2e.
- The Enter/E key and every other action check `portal.isOpen()` the same way they check `overlay`.

### `web/engine/nav.js`

- `create(win, grade)` reads `embed=1` from `win.location.search` and checks that `win.parent !== win`.
- In embed mode, `go(url)` does not navigate. It posts `{ type: 'portal-close' }` to `win.parent` with
  `win.location.origin` as the target origin. `shop()` posts `{ type: 'portal-close', then: 'shop' }`. The leave-quiz
  check still runs first, because it sits in `controller` before `go`.
- In embed mode, the ☰ "Lobby" item reads "Back to town" (Grade 2 text follows `Lang`) and closes the frame.
- In embed mode, the page sets `data-theme="light"` on `<html>`, so a tablet in dark mode still shows the clean light
  game inside the playful frame. Sub-project A will make light the default everywhere.

### `web/engine/trail.js`

- The trail's `home` step posts the same close message in embed mode instead of setting `location.href`.

### Back gesture

The world's `{ portal }` history entry sits under the game's own entries. While the game is on an inner screen, back
goes through the game's existing `{ nav }` handling. On the game home, back pops the world's entry, and the world's
`popstate` handler closes the portal. If she is mid-quiz on the home screen, the game's leave-quiz check already
handles that inside the frame.

### `web/world/world.css`

- `.w-portal`: fixed, full-viewport, flex-centred. The frame is `min(900px, 100vw - 16px)` wide and
  `min(100dvh - 16px, 1100px)` tall, with a 6 px border in `--portal-color`, 28 px radius, a soft drop shadow and a
  280 ms scale-in from 0.92.
- `.w-portal-x`: 52 px round, white with a 4 px bottom edge in the frame colour; `:active` scales to 0.9 and drops the
  edge to 1 px.
- `.w-portal-on canvas`: `filter: blur(6px) saturate(1.1)`, applied once while the loop is stopped.
- `prefers-reduced-motion`: no glide or pop-in. The frame appears and disappears at once.

### Cloud sync

Both the world and the game in the frame load the sync code. The plan's first task checks whether `sync-core.js` and
the outbox already prevent two documents in the same origin from uploading the same records twice. If they do not, the
game skips starting sync in embed mode and the world runs one sync round after `close`.

## Edge cases

- Tapping a door twice quickly opens one frame.
- A running playground game (tag, hide-and-seek, Patintero) keeps doors blocked, as today.
- The 10-minute nudge and playmate timers pause while the frame is open.
- Midnight while the frame is open: the daily refresh runs on close.
- No WebGL: unchanged. The world is "resting" and the lobby is used.
- Offline with the game not cached (rare: the service worker precaches every game): the browser's offline page shows
  inside the frame, because an iframe fires `load` for an error page too, and ✕ closes it. The 8 s timeout covers a
  frame that never loads at all: it puts the world back (camera, frame loop, movement) and opens the plain page.

## Testing

- `node --test`:
  - `nav.js` controller in embed mode: `home`, back from home and Shop post the close message (with `then: 'shop'` for
    Shop) and never set `location`; the leave-quiz `ask` runs first while a round is on.
  - `nav.js` without embed: unchanged behaviour (existing tests).
  - `trail.js` home step in embed mode.
  - `portal.js`: `ease` endpoints and midpoint, `embedUrl` with and without an existing query, `acceptMessage` rejects
    a wrong source, a wrong origin and an unknown type, and the open/close state machine ignores a second `open`.
- E2E, new `tests/e2e/portal-e2e.js`: open the Grade 5 world, walk to the Science door, Go in; the iframe appears with
  `embed=1`, the canvas is blurred and the frame loop is stopped; the game is in embed mode (light, Back to town). ← on
  the game home closes the frame, the HUD comes back, the loop runs again and no history entry is left. ✕ closes it at
  once, also from a quiz screen and after visiting a lesson, without stepping past the world. (The world HUD has no coin
  total; points earned in the frame are checked by the tablet check.)
- `node tests/e2e/world-e2e.js` still passes. `node tools/update-precache.js` adds `portal.js`.
- Owner tablet check: the glide's smoothness, the frame size on the tablet and the phone, the back gesture and the pet
  celebration after closing.

## Out of scope

Sub-projects A, C and D above; themed 3D classrooms; any change to scoring or to how games look inside.
