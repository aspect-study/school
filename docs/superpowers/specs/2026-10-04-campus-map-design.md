# Campus map lobby — design

Status: spec approved in brainstorming 2026-10-04, not built.
Inspired by Upskwela World (a 3D world where courses, events and shops are places you walk to). Reverse-engineered
to three ideas: links become **places**, moving is how you **discover** things, and other people feel **present**.
This spec covers the first two. Family presence is a separate later spec.

## Goal

Turn each lobby into a small world she lives in: every game is a building on an illustrated map, the shop and the
weekly boss are places too, and buildings change as she earns medals. The card list stays one tap away.

## User decisions

- **Tap-to-go 2D map** (not a walkable joystick world, not Three.js 3D). B and C may come later.
- **The map is the home**, with a Campus ⇄ List toggle. The card list is the fallback.
- **Both grades:** Grade 5 **Campus**, Grade 2 **Bayan** (village) with bigger buildings.
- **Hand-built SVG art**, no images or libraries.
- **Free pick-a-character avatar** (8 choices), no coins, no cosmetics.
- **Version 1 has:** buildings level up with medals, markers for quests and due review, and a boss arena.
- **Later, own spec:** family presence (her sister's activity, cheers). No chat, ever.
- **Hosting:** GitHub Pages, static files only. Everything here is static and works offline.

## Architecture

One new engine file, `web/engine/world.js`, drawn on top of the existing lobby cards.

- The `.grid` of `.subject-card[data-app]` cards stays in the page. In Campus mode it is hidden. Quests, boss,
  review and parent code keep finding the cards, so no other engine changes.
- `world.js` loads like the other engines: `<script src="../engine/world.js" data-grade="grade5">`, exports
  `World` on `window` and `module.exports` for Node tests. Like `boss.js`, it holds emoji directly (pages are UTF-8).
- Each building's name, emoji, link and color come from its card (the subject, `.subject-title` such as "Math" or "English", falling back to `.subject-app`; the game name stays in the screen-reader label;
  `.subject-emoji`, `href`, `--card-accent`). The card stays the single source for subject text and links.
- `world.js` is added to the `sw.js` precache list.

### Parts of `world.js`

1. **Layout tables:** `LAYOUT.grade5` and `LAYOUT.grade2`: canvas size, building size, the main road's x (`spine`),
   the `gate`, `arena`, `shop` and spare `lot` spots, `trees`, and `apps: { [app]: { x, y, roof } }` where `roof` is
   `peak`, `dome` or `flat`. Every walk goes from the building to the main road, along it, then to the next building,
   so no path graph is needed.
2. **`World.status(apps, deps)`:** pure; returns `{ apps: { [app]: { level, tally, markers } }, shop: { sparkle }, arena: { cleared, total, beaten } }`.
   `deps` are injected functions so tests use fakes:
   - `tally(app)` → `Mastery.counts(Mastery.summary().apps[app])`; the subject level is the lowest lesson medal
     (0-3), worked out from the gold/silver/bronze/total counts.
   - `due()` → `Recall.dueByApp()`.
   - `quests()` → `Quests.state()`; an app has an open quest when a quest in today's list has `app` equal to it and
     `done` is not true.
   - `boss()` → the boss state (stages with `app` and `cleared`, for the current week only).
   - `canAfford()` → `Wallet.canAfford()`, true when at least one reward can be bought now. The lobby's shop script
     sets `Wallet.canAfford`, since the points it needs are read there.
   A missing or throwing dep gives no marker for that kind. It never throws.
3. **Renderer:** `World.draw(...)` builds the SVG as a string (unit-tested). `World.mount(box, grid, toggle)` reads
   the cards, draws, wires taps, the picker and the Campus ⇄ List button. It can be called again; it replaces its
   own SVG.

### Lobby changes (both grades)

- Add `<div class="campus" id="campus" hidden></div>` above the `.grid`, and a toggle button in the hero
  (hidden until `world.js` mounts).
- Call `World.mount` after quests and the boss have run, so markers match what the panels show.
- Campus mode hides `.grid`; the quests, boss, review-due and My Map panels stay as they are.

## Saved data

Key `world_v1`, per learner through `storage.js`:

```
{ v: 1, avatar: 'cat', view: 'campus', at: 'life-lab', t: 1759550000000 }
```

- `avatar`: one of `girl, boy, cat, dog, bear, rabbit, owl, robot`, or missing (not picked yet; draw `cat`).
- `view`: `campus` or `list`; the lobby opens in the saved view. Missing means `campus`.
- `at`: the app of the last building she tapped, `shop`, `arena`, or missing (the gate). An `at` that is no
  longer on the map means the gate.
- Synced by default (not in `LOCAL_ONLY`), with the default merge. No new `MERGE` rule.
- Not used for coins, scoring or the parent page. Corrupt or missing values fall back to the defaults above.

## Look

- One SVG, fixed `viewBox`: Grade 5 `0 0 1000 1400`, Grade 2 `0 0 1000 1260`. Width 100%, portrait, no pan or
  zoom. Buildings are 300 × 150 units (Grade 5) and 320 × 160 (Grade 2): about 110 × 55 CSS px on a 360 px phone
  and twice that on a tablet.
- Colors from the lobby's CSS variables; each building uses its card's `--card-accent`. Light and dark both work.
- **Grade 5 Campus:** gate at the bottom, winding paths, trees, flagpole, a sari-sari store shop, boss arena at the
  top, 10 subject buildings.
- **Grade 2 Bayan:** plaza in the middle, 7 houses around it, a tindahan shop, a small fort for the arena.
- Each building: shape + the card's emoji as its sign + a label board with the card title and a tally strip
  (`🥇3 🥈2 🥉4 / 14`).

### Building tiers

| Subject level | Look |
|---|---|
| 0 | plain building |
| 1 (every lesson 🥉 or better) | bronze flag on the roof |
| 2 (every lesson 🥈 or better) | flag + banner |
| 3 (every lesson 🥇) | gold roof + soft glow |

### Markers

At most two per building, in this order:

1. ⚔️ this week's boss stage, not cleared.
2. `!` an open quest for this app.
3. 🔁 bubble with the due review count (only when the count is above 0).

The shop shows ✨ when `canAfford()` is true. The arena shows `cleared / total` and turns grey once the boss is beaten.
With no boss this week, the arena shows no number.

## Interaction

- **Building tap:** the avatar walks along the path to the door (about 0.6 s), `world_v1.at` is saved, then the
  page goes to the card's `href`. A second tap during the walk goes straight there. With `prefers-reduced-motion`,
  no walk.
- **Shop tap:** walk, save `at: 'shop'`, then click the existing shop open button (`#shop-open`).
- **Arena tap:** walk, save `at: 'arena'`, then scroll the existing boss panel (`#boss`) into view.
- **Avatar tap:** open the picker.
- **Avatar look:** the buddy's emoji (👧 👦 🐱 🐶 🐻 🐰 🦉 🤖) in a round token on the map.
- **Picker:** a sheet with the 8 buddies. It opens in Campus view while `avatar` is missing. One tap picks and
  closes; Skip saves the default (cat) so the picker does not come back, and she can still tap the buddy to change. Grade 5: "Pick your buddy!" Grade 2: "Piliin ang kasama mo! ·
  Pick your buddy!" Buttons are English only.
- **Toggle:** switches view and saves `view`. Label: "🗺️ Campus" / "📋 List" (Grade 2: "🗺️ Bayan" / "📋 List").
- **Accessibility:** each building is a focusable `<a>` in the SVG with `aria-label` = title + level + markers, for
  example "Math Mastery, gold, 3 review questions due". Enter activates it as a tap.

## Errors and edge cases

- `world.js` missing or throwing: the toggle stays hidden and `.grid` stays visible, because only a successful
  `World.mount` hides the grid. The existing file-check bar reports the missing file.
- A card with no layout entry gets a plain building in the spare lot by the gate (one lot; a second unplaced card
  shows only in List). A layout entry with no card is not drawn. The wiring test keeps both in step, so neither ships.
- Engine data missing (fresh device, no `review_v1`, quests not picked): those markers are not shown.
- Returning from a game reloads the lobby, so markers are fresh. No polling.
- `World.mount` can be called again and replaces its own SVG. Wherever the lobby re-renders after a learner switch or
  restore today, it also calls `World.mount`, so the map shows that learner's `world_v1` and medals.
- Celebration popups from quests and the boss show as now, on top of the map.

## Testing

**`tests/world.test.js`** (Node, fake deps):
- Level 0-3 and tally from `mastery_v1`-shaped data.
- Marker order and the cap of two; no marker when a dep is missing or throws; 🔁 only when due > 0.
- The arena counts and `beaten`; the shop sparkle follows `canAfford`.
- `world_v1` read/write; corrupt JSON and unknown avatar fall back to defaults; `at` for a removed app → gate.
- Layout tables: places stay inside the map, off the main road, and never overlap; the buddy's standing spot by
  each building is between the building and the main road.
- `draw()` output: one group per place, tier classes, markers, escaped names, aria labels, one buddy.

**`tests/world-wiring.test.js`:**
- Both lobbies load `world.js` with the right `data-grade`, and have `#campus` and the toggle button.
- Every `.subject-card[data-app]` in each lobby has a `LAYOUT` entry, and every `LAYOUT` entry has a card.
- `world.js` is in the `sw.js` precache list.
- Every lobby `<script src>` matches a real file's name exactly, case included (GitHub Pages is case-sensitive).

**`tests/english-everywhere.test.js`:** Grade 2 `world.js` text pairs Filipino with English; buttons are English only.

**`tests/e2e/lobby-e2e.js`:**
- The lobby opens in Campus; tapping a building opens that game; going back shows the avatar at that door.
- The toggle switches to List, and the choice survives a reload.
- The picker saves the avatar; the shop building opens the shop popup.
- Seeded due questions, an open quest and a boss stage each show their marker.

## Out of scope

Family presence (later spec), walkable 2D or 3D worlds, avatar cosmetics or coin items, the avatar on the parent page,
and any change to the games themselves.
