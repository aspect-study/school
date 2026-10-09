# Pet Tricks, Fetch, Celebrations + Sister Play (Part 2b) — Design

Date: 2026-10-06. Spec 2 of the walkable 3D world, sub-project 2 (pets), part **2b**. Builds on part 2a
(`2026-10-06-pets-design.md`): Mang Kiko's stall (`petshop.js` + `stall.js`), `companion.js` (her pet), `petlife.js`
(mood), `petbody.js` (bodies and gear), `kin.js` (her sister's pet at the gate).

## Goal

Her pet does more than follow her: she buys tricks and toys at Mang Kiko's stall, taps 🎾 Play to make her pet do a
trick or play fetch, her pet waits at the door she went into and celebrates what she did inside the game, and it plays
with her sister's pet at the gate.

## Decisions (agreed with the user)

- **Tricks are bought once and shared by every pet** (not per pet). Sold at Mang Kiko's stall in a 🎩 Tricks tab.
- **7 tricks**, all whole-body moves so every one of the 16 bodies does them with no body-specific code: Bow (free),
  Spin 100, Jump 150, Roll over 200, Dance 300, Twirl jump 450, Backflip 600.
- **Fetch:** a free 🎾 ball, plus 🦴 Bone 80 and 🥏 Frisbee 100 in a 🎾 Toys tab.
- **One 🎾 Play button** beside 🍪 Treat opens a row of her owned toys, then her owned tricks.
- **Celebrate-on-return, level A:** ⚔️ boss stage > 🏅 medal > ⭐ finished round > 💖 plain greeting. **No coins** (the
  games already pay). Games are untouched.
- **Sister play, option A:** automatic play near the gate (about 6 s, at most once a minute), and Play → a toy near
  her sister's pet makes both pets chase it (hers wins).
- **One spec, one plan.**
- Same rules as the wardrobe: shared wallet, plain Yes/No, Buy off while the date guard pauses coins, no gifts, no
  refunds, code-built shapes.

## What she sees

### Mang Kiko's stall

Two new tabs after Pets and Gear: **🎩 Tricks** and **🎾 Toys**. Each card has the icon, name (Grade 2: Filipino ·
English) and price or "Owned" / "Free", like the other tabs.

- **Try a trick:** the pet standing in front of her performs it once.
- **Try a toy:** the pet holds the toy in its mouth and does a happy hop for about 2 s (no throw at the stall: the pet
  faces the camera there and a throw would leave the screen).
- Tricks and toys are never "on": Try just plays them, and closing the stall changes nothing on her look.
- **Buy** plays the item first (as Buy already calls Try), then asks "Buy Spin for 100 coins?".

### The 🎾 Play button

- Sits beside 🍪 Treat and shows exactly when Treat shows (she is free: no panel, chat, maker, overlay or ride).
- Tap → a small row opens above it: her owned toys first, then her owned tricks (free ones always there). Tap an item
  → it runs and the row closes. Tap outside → the row closes.
- While an action runs, or for 1 s after it ends, Play does nothing.

### Tricks

Each trick moves the whole pet group (`PetBody.trick(pet, id, p)`, `p` from 0 to 1):

| Id | Name (en / fil) | Icon | Coins | Move | Length |
|---|---|---|---|---|---|
| `trick-bow` | Bow / Yuko | 🙇 | 0 | pitch dip forward and back | 1.2 s |
| `trick-spin` | Spin / Ikot | 🌀 | 100 | yaw 360° in place | 1.2 s |
| `trick-jump` | Jump / Talon | 🦘 | 150 | high hop, squash on landing | 1.2 s |
| `trick-roll` | Roll over / Pagulong | 🔄 | 200 | full sideways roll | 1.2 s |
| `trick-dance` | Dance / Sayaw | 💃 | 300 | side wiggle + 3 bounces | 2 s |
| `trick-twirl` | Twirl jump / Paikot na talon | 🌪️ | 450 | hop with a 360° spin | 1.2 s |
| `trick-backflip` | Backflip / Pabaligtad na talon | 🤸 | 600 | hop with a backward 360° pitch | 1.2 s |

- **Riding pets** (shoulder, head, arms) do the same move at a third of the size; roll and backflip become a small
  spin, so the pet stays on her.
- At the end the pet is back to its exact pose, then shows 💖 (the existing happy state).

### Fetch

Stages: `throw` → `run` → `pick` → `back` → `drop`.

- **Throw:** she tosses the toy forward in an arc, turned about 30° to her pet's side (the camera sits right behind
  her, so a toy thrown straight ahead and the pet chasing it would hide behind her body). Landing distance: ball 8, bone 6, frisbee 12 units (the frisbee
  glides). The landing spot is pulled back along her facing line until it is clear (`blocked(x, z, toy radius)`); if
  nothing within the throw is clear, the toy drops at her feet.
- **Run:** the pet runs to the toy at 1.6× its walk speed, sliding along walls with the same `Walk.step` collision.
- **Pick:** the toy is parented to the pet's mouth. Bone: a short dig wiggle first. Frisbee: when the pet is within 2
  units as it lands, it leaps and catches it in the air.
- **Back:** the pet runs back beside her. **Drop:** the toy vanishes with a small sparkle, the pet shows 💖.
- **Riding pets** hop down beside her at the start and hop back up to their spot after the drop.
- **Cancel:** she walks more than 12 units from the pet, or a panel, chat, maker, overlay or ride opens → the toy
  vanishes with a sparkle and the pet goes back to normal follow (or remounts).
- Toy meshes: ball (sphere), frisbee (flattened cylinder), bone (two spheres + capsule), cached and shared.

### Celebrate-on-return

When she goes into a game (a door, Hoot's review link, or the Boss Fort's stage link), the world also saves a "before"
snapshot. When she comes back and spawns at that door (or the fort), her pet is beside her facing her, and about 1.5 s
later it celebrates the biggest thing she did:

1. **⚔️ Boss stage:** this week's cleared stage total went up → twirl jump with ⚔️ and ⭐ bubbles.
2. **🏅 Medal:** that app's gold, silver or bronze lesson count went up → her best owned trick (highest price; Jump if
   she owns only Bow) with a ⭐ burst; the bubble shows 🥇, 🥈 or 🥉 (the highest level that went up).
3. **⭐ Finished round:** `study-history` has a `quiz` entry for that app with `finished: true` and `t >= before.at`
   (lesson, review or boss round) → a hop with ⭐ bubbles.
4. **Nothing new:** a 💖 greeting.

Each level uses an existing fx sound. No coins. After the celebration starts, `before` is removed from the return
entry (`grade` and `app` stay), so a reload still spawns her at the door but does not celebrate again. For the Boss
Fort return (`app: 'boss'`) only level 1 and the 💖 greeting apply.

### Sister play

- **Auto play:** her pet is walking (not riding, no action running), she is free, and her pet is within 6 units of the
  nearest sister's pet → the two pets play for about 6 s: they circle each other on a small loop, hop, then meet nose
  to nose with 💖. Then the sister's pet sits again. Not again for 60 s. If she walks more than 8 units away, her pet
  stops and follows her.
- A sister's pet riding on her sister hops down to play and back up after (same `PetBody.mount` as hers).
- **Shared fetch:** Play → a toy while her pet is within 6 units of a sister's pet → both pets chase the toy; the
  sister's pet runs at 0.8× her pet's speed, so hers picks it up and brings it back; the sister's pet trots back to
  its spot and sits.
- All local animation: nothing saved or synced.

## Data

- **Catalog (`pets.js`):** `TRICKS` and `TOYS` entries `{ id, kind: 'trick' | 'toy', coins, icon, en, fil }`, plus
  toys' `range` (8, 6, 12) and tricks' `len` (seconds). `GROUPS` = `['pets', 'gear', 'tricks', 'toys']`. `find()`
  knows them; `inGroup('tricks')` / `inGroup('toys')` list all (free ones show as Free, like the wardrobe's basics).
  `owns(owned, id)` → free or in the owned map. Ids are prefixed `trick-` / `toy-` and never clash with `items.js` or
  pets/gear (test-enforced).
- **Owned:** the `wardrobe_v1` owned map, as for pets and gear (synced as a union, in backups). Nothing about tricks
  or toys is stored in her look.
- **Purchases:** `Closet.buy({ via: 'pets' })` logs `purchase` with `via: 'pets'`; the Parent panel already labels it.
- **Return snapshot:** `world_return_v1` (sessionStorage) gains an optional
  `before: { at, week, cleared, tally: { gold, silver, bronze } }`. `at` = ms when she left; `week` and `cleared` =
  boss week key and cleared stage total; `tally` = `deps.tally(app)` via `World.liveDeps` (missing for `boss`).
  `Prefs.readReturn` returns `before` when it is a valid object; `nav.js` still reads only `grade`/`app`.
  `Prefs.dropBefore(session)` removes only `before`.
- **No new storage keys.**

## Files

| File | Change |
|---|---|
| `web/world/pets.js` | `TRICKS`, `TOYS`, new groups, `owns()`. |
| `web/world/petlife.js` | `action` slot: start/tick/cancel trick and fetch stages, 1 s cooldown, moods `trick` / `fetch`. Pure. |
| `web/world/petbody.js` | `trick(pet, id, p, small)` whole-group moves; toy meshes; `hold(pet, toy)` mouth mount. |
| `web/world/companion.js` | `play(id)`, fetch movement and cancel, `celebrate(level, medal, best)`, `demo(id)` for the stall, sister play driver. |
| `web/world/cheer.js` (new) | Pure: `before(o)` builds the snapshot; `pick(before, now)` → `{ level: 'boss' \| 'medal' \| 'round' \| 'hello', medal }`; `bestTrick(owned)`. |
| `web/world/kin.js` | Sister's pet can be moved, unmounted and remounted; `nearestPet(x, z)`; `play` and `chase` hooks. |
| `web/world/stall.js` | Optional `cat.play(item)`: Try calls it instead of `put` / `onTry`. |
| `web/world/petshop.js` | Tricks and Toys groups, `play` → `companion.demo(id)`. |
| `web/world/prefs.js` | `setReturn(session, grade, app, before)`, `readReturn` keeps `before`, `dropBefore`. |
| `web/world/world-main.js`, `town.js` | Build `before` when opening a game / boss stage; on spawn, pick and celebrate; Play button and row. |
| `web/world/text.js` | Play, tab names, Grade 2 pairs. |
| `web/world/world.css` | Play row. |
| `web/world/grade-2.html`, `grade-5.html`, `sw.js` | Load `cheer.js` after `pets.js`; PRECACHE. |

## Performance

Tricks only change one group's transform. Fetch adds one tiny toy mesh and a few `blocked()` checks per frame. Sister
play moves one extra group. No new textures except emoji bubbles already cached by `companion.js`.

## Error handling

- Any missing engine (`Mastery`, `Boss`, `study-history`) or a broken `before` → level `hello`.
- Boss week changed while she was away → the boss check is skipped.
- A trick or toy id she does not own (or unknown) → Play ignores it.
- Fetch landing spot never clear → toy at her feet; pet stuck for 4 s in `run` or `back` → toy vanishes, pet pops
  beside her with a sparkle (same as the 12-unit catch-up).
- No sister here → no auto play, shared fetch is a normal fetch.

## Testing

- **Unit:** catalog (unique ids, no clash with items/pets/gear, prices, groups, every trick has a `PetBody.trick` move
  and every toy a mesh); `petlife` action timing, cooldown, fetch stage order, cancel; fetch landing pulled back from
  walls; `cheer.pick` for each level, priority, medal level order, week change, missing/bad input, `t < at` ignored,
  other app ignored; `Prefs` return with and without `before`, `dropBefore` keeps `grade`/`app`; `Closet.buy` of a
  trick logs `via: 'pets'`; sister play trigger at 6 units, stop at 8, 60 s cooldown; Grade 2 pairing of new text.
- **e2e (world):** buy Spin at the stall (Try plays it) → Play → Spin runs; Play → ball → full fetch round trip, pet
  back beside her with 💖; leave through a door, add a finished quiz entry, come back → ⭐ bubble, reload → no second
  celebration; walk to the gate → both pets play with 💖. Existing world, stall, boutique, lobby, family and backup e2e
  still pass.
- **Tablet check (user):** tricks on big pets (dragon, unicorn), fetch near walls, celebration timing after a game,
  gate play smoothness.

## Out of scope (2b)

Coins for celebrations; a live sister (her pet is a saved look); tricks per pet; new pets or gear; her own emotes and
poses (sub-project 3); parent gifts, refunds, selling back.
