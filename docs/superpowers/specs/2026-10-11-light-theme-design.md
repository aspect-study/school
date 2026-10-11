# Light theme everywhere, with a gentle Grade 5 polish

Date: 2026-10-11. Sub-project A of the "app inside the world" brainstorm (B, games inside the world, is
`2026-10-11-games-in-world-design.md`).

## Why

The owner saw the games and lobbies as dark "developer dashboards" next to the bright 3D village. The dark look is not a
design choice: every game page and both lobbies follow the tablet's dark mode (`prefers-color-scheme: dark`). Their light
look is already warm and kid-friendly (cream and pastel pages, chunky buttons with a press-down edge, rounded Baloo 2 and
Nunito, a playful font per Grade 2 game). The Grade 5 games are the plainest: flat white cards with thin outlines.

## Decisions

- **Kid pages are always light:** the 17 game pages (`web/subjects/grade-*/*/index.html`) and both lobbies
  (`web/lobby/grade-*.html`), including the parent panel inside the lobby.
- **Adult pages keep dark mode:** the phone parent page (`web/parent/`) and the owner dashboard (`web/admin/`).
- **Unchanged:** the start page and the 3D world (no dark mode today).
- **Gentle polish for Grade 5 only**, in one shared stylesheet; each game keeps its own colour. Grade 2 is already
  playful and is not restyled.

## Design

### Lock to light (19 pages)

In each kid page:

- Delete the dark-mode CSS: every `@media (prefers-color-scheme: dark) { … }` block and every
  `:root[data-theme="dark"] …` rule, including the Grade 5 hero darkening rule and its comment.
- Add `<meta name="color-scheme" content="light">` next to the viewport meta, and `color-scheme: light;` in the `:root`
  block, so scrollbars, inputs and other built-in controls stay light on a dark-mode tablet.
- The `:root:not([data-theme="light"])` selectors go away with the dark blocks; no page needs a `data-theme`
  attribute afterwards.

In `web/engine/nav.js`, remove the embed-mode line that sets `data-theme="light"` (added by sub-project B); embed mode
keeps `data-embed`. Update its test expectation and the portal e2e assertion that checked `data-theme` (it checks the
computed page background is light instead).

### Grade 5 polish: `web/subjects/grade-5/polish.css` (new)

Linked from all 10 Grade 5 game pages with `<link rel="stylesheet" href="../polish.css">` placed right after the page's
own `</style>`, so it wins on equal specificity without `!important`. It uses each page's own variables
(`--accent`, `--card`, `--ink`, with fallbacks), mixing tints with `color-mix(in srgb, …)` as the pages already do.

- **Lesson rows** (`.item-card`, Math `.lesson-card`): border 3 px in a light tint of the game colour
  (`color-mix(in srgb, var(--accent) 28%, #fff)`), radius 20 px, and a 5 px solid bottom edge in a deeper tint drawn as a
  `box-shadow` (like the pages' chunky `.btn`), replacing the soft drop shadow; the
  icon tile (`.item-card .icon`, Math `.lesson-emoji`) gets a pastel tint of the game colour and 14 px radius; the title
  takes the game colour darkened (`color-mix(in srgb, var(--accent) 70%, #000)`).
- **Press feel:** `:active` moves the row down 3 px and shrinks the edge to 2 px; the edge is a shadow, so the rows
  below never move. Hover keeps a border colour change, without today's lift. The empty Review row does not press.
- **Special rows keep their meaning:** the mock exam row keeps its gold border (`.final-card`), the strategy row its
  coral border (`.strategy-card`); only their width and press edge change.
- **Answers** (`.option`): the same 3 px border and a 4 px tinted shadow edge, radius 16 px, font weight 700, the same
  press feel; a right answer's edge is green and a wrong one's red. `.option.correct`, `.option.wrong` / Math `.option.incorrect`, `:disabled`, `.explorable` (dashed) and
  `.explored` keep their current colours and win over the polish (the page's two-class state rules outrank the polish's
  one-class rules; an explored answer keeps its ring).
- **Reduced motion:** no transform on press.
- **Not touched:** the hero banner, the quiz header and progress bar, the big `.btn` buttons (already chunky),
  flashcards, results and the nav bar.

### Precache and wiring

`node tools/update-precache.js` adds `subjects/grade-5/polish.css` to `web/sw.js`.

## Testing

- New `tests/light-theme.test.js`:
  - each of the 19 kid pages has no `prefers-color-scheme` and no `data-theme="dark"`, and has
    `<meta name="color-scheme" content="light">` and `color-scheme: light`;
  - the parent page CSS and the admin CSS still contain `prefers-color-scheme: dark` (adult pages keep dark mode);
  - each Grade 5 game page links `../polish.css` once, after its last `</style>` in `<head>`; no Grade 2 page links it;
  - `polish.css` covers `.item-card`, `.lesson-card`, `.option` and has a `prefers-reduced-motion` rule.
- `tests/pwa.test.js` (existing) enforces the precache entry.
- `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/apps-e2e.js`, `node tests/e2e/lobby-e2e.js 5`,
  `node tests/e2e/lobby-e2e.js`, `node tests/e2e/nav-e2e.js` and `node tests/e2e/portal-e2e.js` pass.
- Screenshots for the owner: Life Lab and Math Mastery home and quiz, before and after, with the browser forced to dark
  mode (they must look the same as light), plus one Grade 2 game and both lobbies in forced dark mode.

## Out of scope

Restyling Grade 2, the hero banners, the lobbies' layout, the start page, the parent page and the dashboard; a
shared design system across all pages (sub-projects C and D may revisit the lobbies).
