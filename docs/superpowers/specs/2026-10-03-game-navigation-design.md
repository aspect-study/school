# Game navigation: Back, Home and Menu

Date: 2026-10-03
Status: built 2026-10-03

## Problem

- None of the 15 games links back to the lobby. The tablets run the installed app full-screen (`display: standalone`), so there is no browser back button. Once she opens a game, the only way out is to close the app.
- The ← button on the quiz screen leaves straight away, with no check. One wrong tap loses the round.
- All the screens of a game are on one page, so the Android back gesture leaves the whole game instead of going back one screen.
- Every game has its own back controls (a `btn-icon` ←, a "← Back" button, a "Back to Home" button), and they behave differently.

## Goal

The same top bar in every game, always in the same place: **← Back**, **🏠 Home**, **☰ Menu**. A check before leaving a round, and an Android back gesture that does what ← does.

## Out of scope

- Saving a round so it can be resumed later.
- Lobby navigation. The only lobby change is opening the shop when the page is loaded with `#shop` (see Menu).

## Design

### 1. One shared file: `web/engine/nav.js`

A global `Nav`, loaded by every game right after `learner.js` and before `fx.js`. There is one copy for both grades. The language comes from `data-grade` on the script tag, the same as the other engine files.

When the game calls `Nav.start`, the file adds a bar as the first child of `<body>`:

```
┌────────────────────────────────────┐
│ ←  Life Lab 🔬            🏠   ☰  │
└────────────────────────────────────┘
```

- The bar is sticky at the top, 52px tall. Its background is `--card` (or `--surface`) with `--ink` text and a 3px `--accent` line underneath (falling back to `#2E6F9E`), so each game keeps its accent and the bar reads well in dark mode too.
- Each button is at least 44×44px (tap target size) and has an `aria-label`.
- The bar is hidden in print (`@media print`). Math Mastery prints worksheets.
- The styles are added by the file itself (one `<style id="nav-style">`), the same way `fx.js` adds its styles.

### 2. What each button does

| Button | On the game home | On any other screen |
|---|---|---|
| ← Back | goes to the lobby | goes to the game home |
| 🏠 Home | goes to the lobby | goes to the lobby |
| ☰ Menu | opens the menu sheet | opens the menu sheet |

"The lobby" is `../../../lobby/grade-5.html` or `../../../lobby/grade-2.html`, picked by `data-grade`. Going to the lobby uses `location.href`, without `?reset=1`, which only lobby → game links use.

### 3. The menu sheet

A small panel that drops down from the top right, with a see-through backdrop. Tapping the backdrop or pressing Escape closes it.

- 📚 Lessons: goes to the game home (with the round check from section 4).
- 🏠 Lobby: goes to the lobby (with the round check).
- 🔊 Sound on / 🔇 Sound off: switches the existing mute setting through `Fx.setMuted(!Fx.muted())`. The label updates in place.
- 🪙 Shop: goes to `lobby/grade-N.html#shop` (with the round check).

Grade 2 labels are English with Filipino. Example: "Lessons · Mga Aralin", "Sound off · Walang tunog". Buttons and short labels stay English-first, following the coin text rule.

### 4. "Leave the quiz?" check

When the game's `inRound()` returns true, ←, 🏠 and the Lessons, Lobby and Shop menu items first open a check:

```
┌────────────────────────────────┐
│  Leave the quiz?               │
│  Points you earned are kept.   │
│                                │
│  [   Keep playing   ]          │
│       Leave                    │
└────────────────────────────────┘
```

- **Keep playing** is the big button and has focus first. Escape and tapping the backdrop do the same as Keep playing.
- **Leave** carries on with what she tapped.
- Grade 2 adds Filipino under the English: "Aalis ka na ba sa pagsusulit?" and "Hindi mawawala ang puntos mo." The buttons stay English.
- "Points you earned are kept" is true because `kit.answer` saves points on every answer.

A round counts as running from its first question until the results screen. The results screen is not inside a round.

### 5. Android back gesture

- `Nav.screen(id)` calls `history.pushState({nav: id}, '')` whenever she leaves the game home. Going back to the home uses `history.back()`, or replaces the entry if she is already there, so the history never grows past two entries: game home plus one screen. Nav sets an internal flag before its own `history.back()` and ignores the `popstate` that follows.
- On `popstate`:
  - If she is on an inner screen, it runs the same steps as ← (with the round check). If she cancels, it pushes the state again so she stays where she is.
  - If she is on the game home, the browser has already gone back. The lobby was the page before the game, so the gesture lands in the lobby.
- If the game was opened directly (no lobby before it), ← on the home still goes to the lobby through `location.href`.

### 6. How a game hooks in

Each game adds:

```html
<script src="../../../engine/nav.js" data-grade="grade5"></script>
```

and once, after its screens exist:

```js
Nav.start({
  title: 'Life Lab 🔬',
  home: 'home',                 // id the game passes to Nav.screen for its home screen
  goHome: goHome,               // the game's own function that shows its home
  inRound: () => Nav.current() === 'quizScreen'   // true from the first question until results
});
```

and one line in its existing `showScreen`, or wherever it switches screens:

```js
Nav.screen(id);
```

- Games with a different `showScreen` signature (Math Mastery, Grade 2 Filipino and Math pass an element, others pass a name) pass any string id. Nav only compares it with `home`.
- Each game removes its own back controls (`btn-icon` ←, `back-link`, `back-btn`), so there is only one Back. In the Grade 5 games the "Back to Home" button on the results screen becomes "📚 More lessons", which calls `goHome()`. The Grade 2 and Math results buttons ("Lesson List", "Lesson Map", "Balik sa Aralin") already say where they go and stay.
- A round is detected from the current screen, so no game needs a new flag: the quiz screen is a round. Math Mastery also counts a walkthrough problem until its "Next Problem" / "Back to the Lesson Map" button shows, and an open case study.
- An optional `back` function replaces `goHome` for ←. Math Mastery uses it so ← inside a case study goes back to the case list (its old `caseBack()`).

### 7. `fx.js` change

- Add `Fx.setMuted(bool)`, which uses the same logic as the current mute button click: write the key, cancel speech when muting, play a tone when unmuting.
- `mountMute()` does nothing if `window.Nav` exists. Games get sound from the menu, and lobbies (which don't load `nav.js`) keep the floating 🔊 button.

### 8. Lobby change

Both lobbies call `openShop()` on load when `location.hash === '#shop'`, then clear the hash with `history.replaceState` so a reload doesn't reopen the shop.

### 9. Files

- New: `web/engine/nav.js`.
- Changed: `web/engine/fx.js` (setMuted, skip mount under Nav).
- Changed: all 15 `web/subjects/grade-N/<subject>/index.html` (script tag, `Nav.start`, `Nav.screen`, remove old back controls).
- Changed: `web/lobby/grade-5.html`, `web/lobby/grade-2.html` (`#shop`).
- Changed: `tests/paths.js` ENGINE_FILES and PRECACHE in `web/sw.js` (run `node tools/update-precache.js`). Bump the cache name.

## Testing

- **Unit** (`tests/nav.test.js`, with a fake DOM like the other engine tests):
  - ← on an inner screen calls `goHome`.
  - ← on the home goes to the lobby URL for each grade.
  - The check shows only when `inRound()` is true. Keep playing changes nothing, and Leave carries on.
  - popstate on an inner screen with the check cancelled pushes the state again.
  - The Shop item goes to `…#shop`.
- **Static** (existing per-game wiring tests): every game loads `nav.js` after `learner.js` and before `fx.js`, calls `Nav.start` and `Nav.screen`, and has no old `btn-icon` ← or `back-btn` left.
- **Text**: Grade 2 nav strings pair English with Filipino (extend the coin-text test).
- **E2E** (one Grade 5 and one Grade 2 game):
  1. Open from the lobby and start a quiz.
  2. Tap ← and check the popup appears.
  3. Tap Keep playing and check the same question is still there.
  4. Tap ← again, then Leave, and check she's on the game home.
  5. Tap ← and check she's in the lobby.
  6. Open the menu, tap Shop, and check the shop overlay is open.
- The full `node --test` suite and the e2e suite stay green.
