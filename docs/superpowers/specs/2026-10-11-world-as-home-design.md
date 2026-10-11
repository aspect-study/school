# World as home: the 3D world replaces the lobby for the kids

Date: 2026-10-11. Sub-project C of the "app inside the world" brainstorm. Builds on B, games inside the world
(`2026-10-11-games-in-world-design.md`: `web/world/portal.js`, the frame, `?embed=1`), and A, light theme
(`2026-10-11-light-theme-design.md`). Everything there still holds unless changed here.

## Why

The owner wants no flat menu pages for the kids. After B, games open inside the world, but sign-in, the home-screen icons
and old links still land on the lobby, and the lobby is where the coins, quests, reward shop, parent area and cloud sync
live. This spec makes the world the kids' home and brings those pieces into it.

## Decisions

- **Mix:** small things become native world pieces (a coin pill and a quests pill in the HUD, a quests card); big things
  (the reward shop, the coin guide, the PIN-gated parent area) open the existing lobby page in the portal frame, one
  section at a time. Nothing in the shop or the parent panel is rewritten.
- **The parent area** is reached from the world's ⚙️ Settings card ("🔒 For parents"), not from a building.
- **The HUD's 🏠 Lobby pill is removed.** The lobby page stays as the fallback when 3D cannot start, and the parent area
  (in the frame) has an "Open the lobby page" button.
- **The lobby forwards to the world** when 3D can run, so every road that led to the lobby now leads home to the world.
- **The world takes over the lobby's background jobs:** cloud sync and the daily quest and boss upkeep.

## Design

### `web/engine/embed.js` (new, shared)

`isEmbedded(win)`, `closeMessage(url)` and `targetOrigin(origin)` move here from `nav.js` (same code, same tests,
moved to `tests/embed.test.js`); `nav.js` uses `root.Embed`. `closeMessage` is extended to carry any `then`:
`closeMessage(url)` keeps its URL rules (`#shop` → `then: 'shop'`), and a new `close(win, then)` posts
`{ type: 'portal-close', then: then }` to `win.parent` with `targetOrigin(win.location.origin)`. Loaded by every game page
(before `nav.js`) and by both lobbies.

### `web/engine/home.js` (new)

- Pure: `forwardTo(loc, canRun, embedded)` returns the world URL (`../world/grade-N.html`) or `null`. It is `null` when
  3D cannot run, when embedded, when the query has `stay=1`, or when the hash names a lobby section (`#shop`, `#coins`,
  `#parent`, `#shop-world`). The grade comes from the lobby page's `data-grade`.
- `canRun(doc)`: a WebGL context can be made on a test canvas (the same check as `world-main.js`'s `canRun`, minus the
  Three.js check, since the lobby does not load Three.js).
- In the browser, at the top of each lobby page (first script after `storage.js`/`learner.js`), it calls
  `location.replace(url)` when `forwardTo` returns a URL, before the lobby draws.

### World page (`web/world/grade-*.html`, `world-main.js`)

- **Sync:** loads `sync-core.js`, `firebase-config.js`, `firebase-remote.js` and `cloud.js` (same order as the lobby).
  `cloud.js` must run without the parent panel's DOM (it only fills the Cloud section when that section exists; the plan
  checks and guards this). The world calls `Cloud.sync()` on its own timer only while no portal frame is open; on
  `cloud-synced` it runs its refresh (town, folk, kin, pills). On portal close it runs one `Cloud.sync()`.
- **Upkeep:** a `upkeep()` step builds the subject cards from the town's buildings (`W.Progress.cards` gives `app`, `name`,
  `href`; mapped to the lobby's `{ app, title, href }` shape, `title` = `name`; the `href`s are `../subjects/…`, which
  resolve the same from `web/world/` as from `web/lobby/`), then runs `Boss.ensure(cards)`, `Quests.pick(cards)` and `Quests.check()`, and plays any events with
  `Fx.celebrate` anchored to the 🎯 pill. It runs at start, after a portal closes, after `cloud-synced`, and when the day
  changes (a 30-second timer compares the day key; nothing runs per frame).
- **HUD:** the top-left `🌍 {title}` pill becomes two pills: `🪙 {balance}` (from `Wallet.balanceStored()`) and
  `🎯 {done}/{total} 🔥{streak}` (streak hidden at 0). Text comes from a pure `W.Hud.pills(state)` in a new
  `web/world/hud.js`. The 🏠 Lobby pill is removed; ⚙️ stays top-right.
- **🎯 Quests card:** tapping the pill opens a world card (`openOverlay`) with a box filled by
  `Quests.renderLobby(box, cards)`. A click on a link inside it is intercepted: the card closes and the link's game opens
  with `openGame(app, href)` (app from the card list by href).
- **🪙 pill:** opens the frame with `lobby/grade-N.html#coins`.
- **Bunny's shop counter** (`folk.shop`) and the portal's `then: 'shop'` open the frame with `lobby/grade-N.html#shop`
  instead of loading the lobby page.
- **⚙️ Settings card:** a new "🔒 For parents" button closes the card and opens the frame with
  `lobby/grade-N.html#parent`.
- **Portal `then` values** the world handles after closing: `'shop'` (open the shop frame), `'lobby'` (go to
  `lobby/grade-N.html?stay=1`), `'account'` (go to `../index.html?account=1`).
- **Learner change:** the world remembers the current learner id at start; after a frame closes, if
  `Learner.current()` is a different learner (or none), the world reloads (or goes to `../index.html` when none).
- **Resting card:** its link becomes `../lobby/grade-N.html?stay=1`.

### Lobby page in embed mode (`web/lobby/grade-*.html`)

When `Embed.isEmbedded(window)`:

- `<html>` gets `class="lobby-embed"`; CSS hides everything except the section's overlay, and the page background is
  plain (`var(--bg)`).
- The section comes from the hash: `#shop` opens the shop overlay; `#coins` opens the coin guide; `#parent` opens the
  parent overlay at its PIN view. Unknown or missing hash: `#shop`. A pure `sectionOf(hash)` (in `home.js`) picks it.
- No first-visit coin guide pop-up (unless `#coins`), no install prompt, no `showQuests` upkeep or celebrations, no
  campus map.
- Closing the section posts the close message: the shop's ✕ and Done, the coin guide's "Got it!", and the parent ✕.
- In the parent panel: 👤 Account posts `then: 'account'` instead of navigating inside the frame; a new "🏫 Open the
  lobby page" button (shown only when embedded) posts `then: 'lobby'`.
- The lobby's own cloud sync runs as usual inside the frame (the parent's Cloud section needs it); the world's sync waits
  while the frame is open.
- The old `#shop-world` path (`ShopReturn`, the shop walking her back to the world by page load) is removed: the world no
  longer opens the shop as a page.

## Edge cases

- **No 3D:** the lobby never forwards; the world's resting card opens `lobby?stay=1`.
- **The first visit after this ships:** a tablet whose last page was the lobby opens the lobby, which forwards to the
  world (a short flash of the lobby's background at most).
- **Midnight in the world:** the day check reruns upkeep and the pills.
- **Sync errors:** shown only in the parent area's Cloud section, as today.
- **The back gesture with the shop, coin guide or parent area open:** closes the frame (portal behaviour).
- **The phone parent page and `/admin/`:** unchanged.
- **Grade 2 wording:** the pills are numbers and emoji only; the quests card uses the existing `Quests` text, which already
  follows the English-first rule; the new Settings button and lobby button are English, like other buttons.

## Testing

- `node --test`:
  - `tests/embed.test.js`: the moved helpers (the existing `nav.js` tests for them move here) plus `close(win, then)`.
  - `tests/home.test.js`: `forwardTo` (3D or not, `stay=1`, embedded, each section hash, grade 2 and 5) and `sectionOf`.
  - `tests/world3d-hud.test.js`: `W.Hud.pills` (coins, done/total, streak 0 hidden, Grade 2).
  - Wiring tests: the world pages load the sync files and `hud.js` in order (`tests/paths.js` lists), the lobbies and
    games load `embed.js`, the lobbies load `home.js` early; precache updated.
- E2E:
  - New `tests/e2e/home-e2e.js` (served over the static server from B): a lobby with 3D forwards to the world; with
    `?stay=1` it stays; in the world the 🪙 pill shows the seeded balance and the 🎯 pill the quest count; Bunny's counter
    opens the shop section in the frame and its ✕ closes it; ⚙️ → For parents shows the PIN pad in the frame; the quests
    card lists 3 quests and its first link opens that game in the frame.
  - The lobby-based e2e scripts (`lobby-e2e`, `sisters-e2e`, `guide-e2e`'s lobby case, `backup-e2e`, `migration-e2e`,
    `file-check-e2e`, `account-e2e` where it lands on a lobby) open the lobby with `?stay=1` or expect the forward.
  - `world-e2e`, `portal-e2e`, `apps-e2e` (both grades) still pass; the `world-e2e` cases that used the 🏠 Lobby pill or
    `#shop-world` are updated.
- Owner tablet check: sign-in lands in the world; the home-screen icon opens the world; coins and quests in the HUD;
  the shop and its phone request from the world; the parent PIN and panel in the frame; a sync seen on the phone parent
  page while the kid stays in the world.

## Out of scope

Sub-project D (HUD tidy-up beyond these pills, lazy loading); rebuilding the shop or parent panel as world cards; a
Parents' Office building; changing the phone parent page.
