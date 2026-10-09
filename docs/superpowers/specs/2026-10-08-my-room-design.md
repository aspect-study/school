# Wardrobe 5a: My Room (inside My Little House)

Date: 2026-10-08. Part of the 3D world wardrobe (spec 2), sub-project 5 (My Little House decorating), parked on
2026-10-07 and resumed today. The owner split it into **5a My Room** (this spec) and **5b My Yard** (a later spec, the
same square-and-place system outdoors). Builds on wardrobe core (`2026-10-06-wardrobe-core-design.md`), pets
(`2026-10-06-pets-design.md`, `2026-10-06-pets-2b-design.md`), props and emotes (`2026-10-07-props-emotes-design.md`)
and the walkable world (`2026-10-05-walkable-3d-world-design.md`).

## Decisions (owner, 2026-10-08)

- She **walks inside** My Little House into one room; a **🛠️ Decorate** view (a dollhouse view from above) is where she
  places things. The yard is 5b.
- **Squares, no dragging.** Picking an item places it on a good free square at once; she moves an item by tapping it,
  then tapping a free square; ↻ turns it a quarter turn.
- The **room grows with medals** (4×4 → 5×5 → 6×6), never with coins.
- **Coins as in the rest of the wardrobe:** the shared wallet, a plain Yes/No confirm, no PIN, free starters, paid
  items 50-800 (most under 200), plus **earned items** that are never for sale.
- **Buy in both places:** in the Decorate view (with a see-through preview in her room) and at a **fourth Shop Plaza
  stall** run by **Tito Tasyo**, a turtle carpenter. One catalog, one owned list.
- The **study desk** is Professor Hoot's ❓ Ask me! at home: up to 3 due questions, the same rules.
- The **trophy shelf** has one trophy per subject that changes colour with its medals.
- **Sister visits, view only:** she can walk around her sister's room; trophies show colour only, never counts.
- Built **off the edge of the map** in the same 3D scene, reached by the sparkle hop.

## The room

### Going in and out

- Near the house door (`layout.js` `pr.house` front) a **🚪 Go in** pill shows (the same proximity pills as stalls and
  rides). Tapping it plays the quick-travel sparkle hop; she lands on the room's door square facing in, her pet beside
  her.
- Inside, standing on the door square or the walkway shows **🚪 Go out**; it hops her back to the doorstep facing away
  from the house.
- The room is built at about (200, 200), far outside every path and roam area. While she is inside, the outdoor groups
  (town, playmates, buddies, rides, loot) are hidden and stop ticking, so the frame cost is the room alone. Music keeps
  playing (the house zone's tune). The 10-minute nudge keeps counting and shows inside as it does outside.
- The camera inside looks down more steeply than outdoors (it still turns and tilts with a drag, within a range), at
  the usual distance, and every wall that stands between it and her turns see-through (with what hangs on it), so no
  wall hides her. Pinch and wheel zoom work inside. (Changed during the build on 2026-10-08, for the owner to confirm,
  from a camera clamped inside the room's box, which looked straight down at her head.)
- **The mirror moves inside**, onto the south wall beside the door, and works as today. The outdoor mirror spot is
  removed.
- Playmates and her sister never follow her in. A playground game in progress cannot be left through the door (the
  pill does not show during a game).

### Squares and fixed pieces

- One square is 2.4 world units. Columns `c` run west to east from 0, rows `r` run south to north from 0; the door is
  in the south wall at `c = 1`.
- The room grows by adding a column on the east and a row on the north, so every fixed piece and every placed item
  keeps its square when it grows.
- **Kept clear, always:** the door square (1, 0), the walkway (1, 1), and the mirror's standing square (2, 0).
- **Fixed pieces:** the study desk on (0, 0) against the west wall with its stool; the trophy shelf on the west wall
  over rows 1-2 (Grade 5: two shelves stacked on the same wall squares); the mirror on the south wall at `c = 2`.
- **Wall squares:** one per floor square along each wall. The door, mirror and shelf take theirs. Wall items go on the
  free ones.
- **At 6×6** a built-in window seat in an alcove opens in the north wall. It is decoration (she can sit on it with 🪑
  Sit), not a square.

### Size

The room counts **lessons with any medal** in her grade (`mastery_v1` best medals, which are never taken back), so the
room never shrinks.

| Size | Grade 5 | Grade 2 |
|---|---|---|
| 4×4 | from the start | from the start |
| 5×5 | 15 medals | 10 medals |
| 6×6 | 40 medals | 25 medals |

Growing is checked when she goes in. The first time she enters at a new size, a celebration popup shows ("Your room
grew! 🏡", Grade 2 "Lumaki ang kuwarto mo! · Your room grew!"). New squares start empty.

## Decorating

### Decorate view

- **🛠️ Decorate** (shown inside her own room, not during a sister visit) lifts the camera to a fixed view from above the
  south-east at about 55°; the south and east walls fade to see-through and the squares show as a faint grid. Walking is
  off; the pet sits.
- Tabs: **🛏️ Furniture · 🖼️ Wall · 🧸 Fun · 🎨 Room · ⭐ Earned**. The panel lists owned items first, then items for
  sale with their price, then (⭐ only) locked earned items with how to earn them.
- **Place:** tapping an owned item that is not in the room places it on the first square that fits its hint:
  - `wall-side` (beds, bookcase, aparador, aquarium...): a floor spot touching a wall, scanning from the north-west.
  - `middle` (rugs, tables, beanbag, tent...): the free spot nearest the room's centre.
  - `wall` (posters, clock, window, fairy lights): the first free wall square, north wall first.
  - If nothing fits: "No room for this one yet. Your room grows with medals! 🏅" (Grade 2 "Wala pang puwesto para dito.
    Lumalaki ang kuwarto mo sa bawat medalya! · No room for this one yet. Your room grows with medals! 🏅").
- **Select, move, turn, put away:** tapping a placed item selects it (a soft glow) and shows **↻ Turn** and **📦 Put
  away**. While one is selected, the free squares where it would fit glow; tapping one moves it there. Tapping a square
  where it does not fit gives a small shake. Turning that would not fit also shakes and does nothing. Tapping the item
  again, or empty space, deselects.
- **Rugs** lie under other things: a rug may share squares with one standing item, and only one rug may cover a square.
- **🎨 Room** tab: wallpaper and floor are whole-room picks (tap to switch, owned ones only; unowned ones preview
  as below).
- **✅ Done** brings the camera back down. Every change is saved at once.
- Sizes: items are 1×1, 1×2 or 2×2 squares (wall items one wall square, the fairy lights two). A 1×2 item turned a
  quarter turn becomes 2×1.

### Buying in the Decorate view

- Tapping an item she does not own places a see-through preview where it would go (wallpaper and floor preview on the
  room itself) and asks "Buy Aquarium for 600 coins?" (Grade 2 "Bilhin ang Akwaryum sa halagang 600 coins? · Buy
  Aquarium for 600 coins?"), **Yes** / **No**. Yes buys and places it; No removes the preview.
- No room for it: the "no room yet" line shows instead and nothing is offered (she can still buy it at the stall).
- Not enough coins: the usual "You need N more coins" line from the other stalls. Buying is off while the date guard
  has the clock paused, as at the other stalls.

### Tito Tasyo's workshop (fourth stall)

- A fourth stall in Shop Plaza next to Kuya Pilo's, run by **Tito Tasyo**, a turtle carpenter with a little hammer and
  a pencil behind his ear (no character in the world is a turtle).
- Built on `stall.js` like the boutique, pet and toy stalls: the same tabs (⭐ Earned shows the earned items with how to
  earn them, never a price), a turning preview of the item on the counter, the same buy confirm and `purchase` sound.
- An item bought here goes to her owned list and shows first in the Decorate view; it is not placed until she places
  it.
- The purchase is logged in study history with `via: 'house'`; the parent panel shows "· from Tito Tasyo's
  workshop".

## Catalog (`furniture.js`)

All items are built from simple shapes in code (no model files). Item ids start with `home-` so they never clash with
`items.js`, `pets.js` or `emotes.js` ids.

### Free starters (owned from the start)

| id | Tab | Size | Hint | English | Filipino |
|---|---|---|---|---|---|
| `home-bed` | furniture | 1×2 | wall-side | Plain bed | Simpleng kama |
| `home-rug-round` | furniture | 2×2 | middle | Round rug | Bilog na alpombra |
| `home-lamp` | furniture | 1×1 | wall-side | Small lamp | Maliit na lampara |
| `home-wall-pink` | room | — | — | Pink walls | Kulay-rosas na dingding |
| `home-wall-blue` | room | — | — | Blue walls | Asul na dingding |
| `home-floor-wood` | room | — | — | Wooden floor | Sahig na kahoy |
| `home-floor-tile` | room | — | — | Tile floor | Sahig na baldosa |

A new room starts with the plain bed on the first wall-side spot, the round rug in the middle, pink walls and the
wooden floor.

### For sale

| id | Coins | Tab | Size | Hint | English | Filipino |
|---|---|---|---|---|---|---|
| `home-plant` | 50 | furniture | 1×1 | wall-side | Potted plant | Halaman sa paso |
| `home-poster-stars` | 50 | wall | 1 | wall | Star poster | Poster ng mga bituin |
| `home-poster-rainbow` | 50 | wall | 1 | wall | Rainbow poster | Poster ng bahaghari |
| `home-beanbag` | 60 | furniture | 1×1 | middle | Beanbag | Malambot na upuan |
| `home-clock` | 70 | wall | 1 | wall | Wall clock | Orasan sa dingding |
| `home-toybox` | 80 | fun | 1×1 | wall-side | Toy box | Kahon ng laruan |
| `home-plant-tall` | 90 | furniture | 1×1 | wall-side | Tall plant | Mataas na halaman |
| `home-rug-heart` | 90 | furniture | 2×2 | middle | Heart rug | Alpombrang hugis-puso |
| `home-window` | 100 | wall | 1 | wall | Flower window | Bintanang may bulaklak |
| `home-pet-bed` | 100 | fun | 1×1 | wall-side | Pet bed | Higaan ng alaga |
| `home-globe` | 110 | fun | 1×1 | wall-side | Globe | Globo |
| `home-lights` | 120 | wall | 2 | wall | Fairy lights | Maliliit na ilaw |
| `home-tea-table` | 120 | furniture | 1×1 | middle | Tea table | Mesang pang-tsaa |
| `home-floor-checker` | 120 | room | — | — | Checkered floor | Sahig na may kuwadradong disenyo |
| `home-rocking-chair` | 140 | furniture | 1×1 | middle | Rocking chair | Tumba-tumba |
| `home-bookcase` | 150 | furniture | 1×1 | wall-side | Bookcase | Lalagyan ng aklat |
| `home-wall-stars` | 150 | room | — | — | Starry walls | Dingding na may bituin |
| `home-easel` | 160 | fun | 1×1 | wall-side | Painting easel | Patungan ng pinta |
| `home-aparador` | 180 | furniture | 1×2 | wall-side | Aparador | Aparador ng damit |
| `home-piano` | 200 | fun | 1×2 | wall-side | Toy piano | Laruang piyano |
| `home-bed-cloud` | 250 | furniture | 1×2 | wall-side | Cloud bed | Kamang hugis-ulap |
| `home-dollhouse` | 300 | fun | 1×1 | wall-side | Dollhouse | Bahay ng manika |
| `home-telescope` | 350 | fun | 1×1 | wall-side | Telescope | Teleskopyo |
| `home-tent` | 400 | fun | 2×2 | middle | Play tent | Laruang tolda |
| `home-bunk-bed` | 500 | furniture | 1×2 | wall-side | Bunk bed | Kamang dalawang palapag |
| `home-canopy-bed` | 600 | furniture | 2×2 | wall-side | Canopy bed | Kamang may kurtina |
| `home-aquarium` | 600 | fun | 1×2 | wall-side | Aquarium | Akwaryum |

The owner may rename or reprice before the build; the plan uses this table.

### Earned (never for sale)

| id | Size | Hint | English | Filipino | Earned when |
|---|---|---|---|---|---|
| `home-streak-lamp` | 1×1 | wall-side | Streak lamp | Lampara ng sunod-sunod na araw | a 7-day streak (`quests_v1`) |
| `home-boss-rug` | 2×2 | middle | Boss rug | Alpombra ng Boss | every stage of a weekly boss cleared (`boss_v1`) |
| `home-gold-frame` | 1 | wall | Gold frame | Gintong kuwadro | her first gold medal (`mastery_v1`) |
| `home-book-tower` | 1×1 | wall-side | Book tower | Tore ng aklat | 50 lessons with a medal (Grade 2: 30) |
| `home-star-ceiling` | — | room | Star ceiling | Kisameng may bituin | every lesson in one subject gold |
| `home-hoot-plush` | 1×1 | wall-side | Hoot plush | Laruang Hoot | 20 desk questions right |

- Unlocks are checked each time she goes in (and right after a desk answer for the Hoot plush). An unlocked item
  stays hers even if the condition later stops being true (a streak ending).
- Each unlock shows a celebration popup ("You earned the Streak lamp! 🌟"). Locked items show their "Earned when"
  line in the ⭐ tab, in Grade 2 as a Filipino · English pair.
- The star ceiling is a room pick like wallpaper (on or off), not a square item.

## Study desk

- Near the desk (inside her own room) a **✏️ Study** pill shows. Tapping it sits her on the stool facing the desk; her
  pet hops onto the desk if it is small, or sits beside the stool.
- The ❓ Ask me! flow runs exactly as Professor Hoot's (`quiz.js`, all subjects): only questions due for review, only
  multiple-choice and true/false, the same `StudyKit` + `Recall` scoring, the pet teacher on wrong answers. Up to 3 per
  visit; going back in starts a new visit (only due questions are asked, so nothing can be farmed).
- Nothing due: "You're all caught up! 🌟" and the offer to open the next lesson, as with Hoot.
- Each right answer at the desk adds 1 to `deskRight` (counts toward the Hoot plush).
- Standing up: **✅ Done** or walking off.

## Trophy shelf (`trophies.js`)

- One trophy per subject in her lobby, in the lobby's order (`layout.js` APPS for her grade): 10 for Grade 5 on two
  shelves, 7 for Grade 2 on one. Each trophy is a cup with the subject's emoji on a small plaque.
- Colour from that subject's lessons in `mastery_v1`:
  - **grey:** no medal yet;
  - **bronze:** at least one medal;
  - **silver:** at least half the lessons silver or better;
  - **gold:** at least 80% of the lessons gold.
- A subject whose game has never been opened (no lesson count known) shows grey.
- Walking up to the shelf and tapping a trophy shows a bubble: "🔬 Life Lab: 🥇 5 · 🥈 3 · 🥉 2 · 8 to go" (Grade 2:
  Filipino subject name, then "🥇 5 · 🥈 3 · 🥉 2 · 8 pa · 8 to go").
- When a trophy's colour has gone up since her last visit, a small celebration shows on entering ("Life Lab's trophy
  is Silver now! 🏆").

## Sister visits

- Outside her house door, beside 🚪 Go in, **👀 Visit Ate's room** (Grade 2 tablet) or **👀 Visit Bunso's room** (Grade 5
  tablet) shows once the sister's `house_v1` has arrived through the family peek at least once.
- The visit uses the sister's saved room: size, placed items, wallpaper, floor, star ceiling and the trophy colours from
  her last visit. Items draw from the one shared catalog. The sister's desk, shelf and mirror are there but closed:
  no ✏️ Study, no 🛠️ Decorate, no mirror tabs. Tapping a trophy shows only the subject name.
- She walks around with her own avatar and pet. A **💛 Cheer** pill sends one of the existing family cheers
  (`family.js`, the same cheers and limits as at the gate).
- 🚪 Go out hops her back to her own doorstep.
- If the sister's room data is unreadable, the button does not show.

## Saved data (`house_v1`)

```json
{
  "v": 1,
  "owned": { "home-aquarium": { "t": 1791000000000, "coins": 600 } },
  "earned": { "home-gold-frame": 1791000000000 },
  "deskRight": 7,
  "room": {
    "at": 1791000000000,
    "placed": [{ "id": "home-bed", "c": 2, "r": 3, "turn": 1 }],
    "wall": "home-wall-pink",
    "floor": "home-floor-wood",
    "stars": false
  },
  "seen": { "at": 1791000000000, "size": 5, "trophies": { "life-lab": 2 } }
}
```

- Free starters are owned without an `owned` entry (price 0 = owned, as `Items.owns` does).
- `house.js` repairs on load: placed items that are not owned or earned, off the room, on a kept-clear square or
  overlapping are dropped (the first one keeps its square); unknown ids are kept in `owned` but not drawn.
- `seen` is written each time she goes in: the room size and the trophy colours (0 grey to 3 gold) by app id. The
  sister view reads only `room` and `seen`, so it never needs the sister's medal data.
- **Buying** works like `closet.js`: spend first through the wallet, save, and refund through `Wallet.addBonus` if the
  save fails.
- **Sync:** a new JSON kind `house` in `sync-core.js`. Merge: `owned` union keeping each item's earliest buy (as
  wardrobe); `earned` union keeping the earliest time; `deskRight` the larger; `room` from the side with the later
  `room.at`; `seen` from the later `seen.at`. Then the load repair runs.
- **Family peek:** `house_v1` joins `PEEK_STATE` in `family.js`.
- **Backup:** `house_v1` joins the full backup keys and the study-history state keys (`STATE_KEY_RE`), like
  `wardrobe_v1`.

## Files

New, in `web/world` (logic files hold no 3D code):

| File | Job |
|---|---|
| `furniture.js` | The catalog above: id, tab, size, hint, coins (or `earned` + its rule), English and Filipino names |
| `room.js` | Pure room logic: size from a medal count, kept-clear and fixed squares, `fits`, auto-place, move, turn, put away, rug layering, load repair |
| `trophies.js` | Pure: a subject's colour and bubble line from `mastery_v1` and its lesson count |
| `house.js` | `house_v1` read/save, buy, earned unlocks, desk count, `seen` snapshot |
| `room3d.js` | The room in 3D (walls, floor, door, desk, shelf, mirror, nook, star ceiling) and a builder per catalog item |
| `decorate.js` | The Decorate view: camera lift, wall fade, grid, tabs, place / select / move / turn / put away, buy preview |
| `carpenter.js` | Tito Tasyo's workshop on `stall.js` |

Changed: `build.js` + `layout.js` (door pill spot, the room's spot, the fourth stall and Tito Tasyo, the outdoor mirror
removed), `world-main.js` (go in / out, hiding the outdoors, Study via the Ask me! flow, the visit, celebrations),
`text.js` + `lines.js` (all new text), `engine/family.js` (peek), `engine/sync-core.js` (kind + merge),
`engine/study-history.js` + `engine/parent-panel.js` (`via: 'house'`, backup keys), both world HTML pages (script
tags), then `node tools/update-precache.js`.

## Tests

Unit (`node --test`):
- `room.js`: the size at 0 / 14 / 15 / 39 / 40 medals (Grade 2 at 9 / 10 / 24 / 25); auto-place never covers the door,
  walkway, mirror square or fixed pieces; each hint picks the expected square in an empty room; move and turn refuse
  overlaps and walls; rugs share with one standing item only; growth keeps every placed square; load repair drops bad
  entries.
- `trophies.js`: colours at the boundaries (half silver, 80% gold), an unopened subject is grey, the bubble line in
  both grades.
- `furniture.js`: ids unique and `home-`-prefixed, no clash with items / pets / emotes; every item has a `room3d.js`
  builder (a new item fails until it is drawn); Grade 2 names are paired; earned items have no price.
- `house.js`: buy spends, refunds on a failed save, is refused while the clock is paused and for earned items; each
  unlock rule; an unlock is kept after its condition ends; `seen` snapshot.
- `sync-core.js`: the `house` merge in both orders gives one text.
- Grade 2 text pairs (the existing paired-text tests cover the new lines).

E2e:
- `world-e2e.js`, new `house` case: go in, the room is 4×4 with the starters; Decorate: place, select, move, turn, put
  away, a refused move; buy an item in the Decorate view and one at Tito Tasyo's; the desk asks a due question and
  counts it; a trophy bubble; seeded medals grow the room on the next entry with the popup; an earned unlock popup;
  go out.
- `sisters` e2e: one profile's decorated room shows in the other's visit, view only, with no trophy counts, and a cheer
  sends.

## Not in 5a

The yard (5b), dragging, a wall of firsts, more shelf space, gifts of furniture between sisters, refunds or selling.
