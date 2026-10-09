# Pets + Pet Gear (Part 2a) — Design

Date: 2026-10-06. Spec 2 of the walkable 3D world, sub-project 2 (pets), part **2a**. Builds on the wardrobe core
(`2026-10-06-wardrobe-core-design.md`): same wallet, same `wardrobe_v1` owned list, same stall panel style.

## Goal

She buys more pets and pet gear with her coins at Mang Kiko's Pet Stall in Shop Plaza, picks which pet walks with
her (and where it rides) at the mirror, and her pet feels alive: it follows her, sits and sleeps when she stops, shows
its name, hops with hearts when tapped, and munches a free treat.

## Decisions (agreed with the user)

- **New pet stall** run by **Mang Kiko** the parrot, next to Lola Lana's stall in Shop Plaza.
- **Collect many, one walks.** She owns any number of pets; one is out at a time, chosen at the mirror. The 3 current
  pets (chick, kitten, puppy) stay free.
- **Treats, no hunger.** A free, unlimited treat makes the pet munch happily. The pet never gets hungry, sad or sick.
- **Same rules as the wardrobe:** shared wallet, plain Yes/No confirm, prices 50–800, no gifts, no refunds, Buy off
  while the date guard pauses coins, code-built shapes (no model files).
- **Split:** 2a (this spec) = stall, pets, gear, colours, riding spots, follow/sit/sleep, name tag, tap to pet,
  treats, mood bubbles. **2b** (own spec later) = paid pet tricks, fetch toys, celebrate-on-return (the pet waits at
  the game door she went into and celebrates a finished lesson, medal or boss stage, with ⭐ bubbles), and
  pet-to-pet play with her sister's pet at the gate.
- **Follow, not pathfinding.** The pet slides along walls with the same collision as her and pops back to her side
  when far behind. No path planning (open plazas; tablet budget).

## What she sees

### Mang Kiko's Pet Stall

A small stall in Shop Plaza mirroring Lola Lana's: stall box about `x 61, z 9.5` (`hx 2, hz 1.5`), Mang Kiko about
`x 57.8, z 9.5` (circle `r 0.8`), action spot about 2.2 west of him (`r 2.6`), clear of Bunny (`62.6, 4.4`), the
counter and the shop box. Exact numbers are checked in the plan against `layout.js` obstacles and the spawn spots.
Mang Kiko is a chibi parrot (green body, red-yellow wings, little straw hat), built like the other folk; a new item
kind `petshop` shows his action button, and he says one short hello line.

The panel is the boutique panel shared (`stall.js`): modal, she is frozen, HUD hidden, portrait camera, balance at
the top, cards with icon, name, price, progress bar or ✓ Owned, Buy → "Buy Panda for 500 coins?" Yes / No, "N more
coins" when short, disabled with the clock text while `Clock.paused()`.

- **Tabs:** Pets, Pet gear.
- **Try-on:** tapping a pet card swaps her pet beside her at once (in its saved spot if that pet's size allows it,
  else walking). Gear tries stack, one per slot, on whichever pet is shown. A second tap on the same card takes the
  try back off.
- **Yes** spends the coins and keeps that pet or gear on (saved). Other tries stay tries. **Closing** puts back her
  saved pet look.

### The mirror

The maker gets a **Pet** tab after Me (pet and pet name move from Me to it):

| Row | Choices |
|---|---|
| Pet | the 3 free pets + pets she owns (icon + name) |
| Colour | 5 swatches for that pet (first = its natural colour), free |
| Name | text box (as today), placeholder = the pet's default name |
| Rides | only the spots its size allows: Walk beside / On shoulder / On head / In arms |
| Hat, Neck, Back, Glasses | owned pet gear for that slot, plus None |

Plus a "🦜 More at Mang Kiko's" link that saves, closes and lights Mimi's trail to Shop Plaza (like Lola Lana's link).
Changing pet keeps the gear (all gear fits all pets) and drops the spot back to Walk if the new pet's size does not
allow it. The mirror never sells anything.

### Catalog

**Pets** (16 total; 13 paid). Size decides riding spots.

| Pet | Size | Coins | Default name |
|---|---|---|---|
| Chick | small | free | Piyo |
| Kitten | medium | free | Muning |
| Puppy | medium | free | Bantay |
| Hamster | small | 150 | Mochi |
| Duckling | small | 150 | Bibo |
| Bunny | medium | 200 | Puti |
| Turtle | medium | 200 | Pong |
| Piglet | medium | 250 | Bilog |
| Parrot | small | 300 | Loro |
| Carabao calf | big | 400 | Bugoy |
| Penguin | medium | 400 | Yelo |
| Fox | medium | 450 | Kahel |
| Tarsier | small | 500 | Mata |
| Panda | big | 500 | Bao |
| Unicorn pony | big | 800 | Kislap |
| Baby dragon | big | 800 | Apoy |

| Size | Spots |
|---|---|
| small | walk, shoulder, head |
| medium | walk, arms |
| big | walk |

Each pet has 5 colours (index 0 = natural, then 4 friendly variants, e.g. a white, a brown, a pastel and a fun one).
Exact colours, icons and Filipino names are set in the plan.

**Pet gear** (14), slots `hat, neck, back, glasses`, ids prefixed `pet-` so they never clash with wardrobe ids
(both live in the same `owned` map; test-enforced):

| Slot | Items | Coins |
|---|---|---|
| hat | party hat 50, bow 50, flower 80, wizard hat 150, tiny crown 300 | 50–300 |
| neck | bell collar 50, bandana 80, bow tie 80, scarf 100 | 50–100 |
| back | mini backpack 150, cape 200, tiny wings 400 | 150–400 |
| glasses | sunglasses 100, star glasses 150 | 100–150 |

Every gear piece attaches to anchor points each pet body provides (`head` top, `neck`, `back`, `face`), scaled by
the pet's size, so every piece fits every pet.

### Life with her pet

Moods are driven by `petlife.js`:

- **Follow:** walks to a spot behind her and to one side, stepping with `Walk.step` and the world's `blocked()`
  (pet radius 0.6), so it slides along walls. It stops when she stops.
- **Sit** after 3 s of her standing still; **sleep** after 10 s, with a 💤 bubble. When she moves it wakes (short
  stretch) and follows again.
- **Catch up:** 12 units or more away (teleport, spawn, ride end, back from a panel), it pops beside her with a small
  sparkle.
- **Riding:** on shoulder or head it is parented to her character's anchor and bobs with her steps; in arms she uses
  a new `carry` arm pose and holds it in front. Riding pets still fall asleep after 10 s still.
- **Waits:** while a ride, the maker, a stall, a chat or a visitor talk is on, it holds still. On a playground ride a
  riding pet rides along on her (decided while planning). At the mirror or a stall a walking pet sits in front of her, facing the camera.
- **Name tag:** its name (or the default name) floats above it on a small canvas sprite, in every quality
  setting.
- **Tap to pet:** tapping the pet (hit test on the pet group only) makes it hop with 💖 and a soft sound, walking or
  riding. `move.js` gets a `tapHit(x, y)` hook checked before tap-to-walk, so the tap pets it instead of walking to
  it; taps elsewhere behave as today.
- **🍪 Treat:** a small HUD pill, hidden while frozen or a panel is open. The pet munches with a 🍪 bubble; 2 s
  cooldown; free and unlimited; nothing saved.
- **Mood bubbles:** 💤 sleeping, 💖 after a pat or near her sister (within 6 units of the sister at the gate), 🍪
  munching. One bubble at a time, a short pop-in emoji sprite.

### Her sister

`kin.js` draws the sister's pet with its colour, gear and spot exactly as she saved it (`owned = null`), and its name
tag. It sits by her at the gate; it does not follow or sleep (play together is 2b).

## Data

| Key | Change |
|---|---|
| `wardrobe_v1` | No format change. Paid pets and pet gear go into the same `owned` map: sync, union merge, backups, refunds on a failed save all work as today. Free pets are never stored there. |
| `avatar_v1` | Stays `v: 1`. Adds `petColor` (0–4, default 0), `petSpot` (`walk`/`shoulder`/`head`/`arms`, default `walk`), `petWear` `{hat, neck, back, glasses}` (gear id or `''`). `pet` now keeps any valid id string (`/^[a-z0-9-]{1,32}$/`), like `wear`, instead of resetting to `chick`, so a pet bought on another tablet and not yet synced is not wiped on save. |

- **What is drawn:** `Pets.petLook(look, owned)` returns `{pet, color, spot, wear}`: an unknown or unowned paid pet →
  chick; unowned or unknown gear → `''`; a spot the size does not allow → `walk`; colour out of range → 0. `owned =
  null` skips ownership (her sister). Stored values are kept so a late sync makes them show.
- **Mirror saving** uses the same keep-unowned rule as the wardrobe for `pet` and `petWear`: a stored id she does not
  own here yet is kept when she leaves that row untouched.
- **History:** a buy logs `purchase` with `via: 'pets'`; `SH.purchased()` keeps it and the Parent panel shows
  "🛒 Bought Panda — 500 coins · from the pet stall".
- Both grades get the same catalog, each paying from her own wallet.

## Files

| File | Job |
|---|---|
| `web/world/pets.js` (new, pure) | Pet + gear catalog, `SIZES`/`SPOTS`, stall tabs, `find`, `name(it, grade)`, `petLook`, `keepUnowned` for pet fields, default names. Node-testable. |
| `web/world/petbody.js` (new) | One builder per pet (with `head/neck/back/face` anchors and colour), one builder per gear piece, mood animation (`walk`, `sit`, `sleep`, `munch`, `happy`), dispose. `Avatar.pet` delegates to it. |
| `web/world/petlife.js` (new, pure) | Mood state machine: `tick(state, dt, her)` → mood, target, catch-up, bubble; pat and treat events with cooldown. Node-testable. |
| `web/world/stall.js` (new) | The boutique panel made generic: catalog, tabs, card names, try/buy hooks. |
| `web/world/boutique.js` | Thin wrapper over `stall.js` (behaviour unchanged). |
| `web/world/petshop.js` (new) | Thin wrapper over `stall.js` for pets and gear. |
| `web/world/avatar.js` | Shoulder and head anchors, `carry` arm pose. |
| `web/world/look.js` | New fields, `pet` id rule. |
| `web/world/maker.js` | Pet tab, link to Mang Kiko. |
| `web/world/move.js` | `tapHit` hook before tap-to-walk. |
| `web/world/layout.js`, `build.js`, `cast.js`, `folk.js`, `lines.js`, `text.js` | Stall, Mang Kiko, his line, `petshop` kind, panel and pet text (Grade 2 paired, buttons English-only), default pet names. |
| `web/world/world-main.js` | Draws the pet from `petLook`, rides it on her, runs `petlife`, name tag, bubbles, tap, Treat pill, opens the pet stall (modal like the boutique; nudge and visitors wait). |
| `web/world/kin.js` | Sister's pet with colour, gear, spot and name tag. |
| `web/engine/study-history.js`, `parent-panel.js` | `via: 'pets'` and its label. |

Both world pages load `pets.js` after `items.js`, `petbody.js` before `avatar.js`, `petlife.js` with the pure
modules, `stall.js` before `boutique.js` and `petshop.js` after it (`tests/paths.js` WORLD_FILES). Run
`node tools/update-precache.js` after adding files.

## Performance

Pet and gear meshes reuse the cached shared geometry and materials. One pet plus the sister's. The name tag and
bubble are small canvas sprites, redrawn only when the name or bubble changes. `petlife` and follow cost a few
`blocked()` checks per frame. Switching pet or gear rebuilds only the pet, never her character or the scene.

## Error handling

- Buying is `Closet.buy` unchanged: coins first, refund via `addBonus` if the save fails, off while paused, "Not
  enough coins yet" if a sync moved the coins.
- Unknown or unowned pet and gear ids are never drawn but are kept in storage.
- Pet names go through the existing `cleanName`.
- A catalog pet or gear piece without a builder fails the tests.

## Testing

- **Unit (Node):** catalog ids unique and never clash with `Items` ids; paid prices within 50–800, free pets cost 0;
  every pet has a size, 5 colours, a default name and a Grade 2 pair; every pet and gear piece has a `petbody`
  builder; `petLook` fallbacks (unowned pet → chick, unowned gear → `''`, bad spot → `walk`, bad colour → 0, `null`
  owned keeps all); `Look.clean` keeps unknown valid pet ids and cleans the new fields; keep-unowned for pet fields;
  `petlife` sits at 3 s, sleeps at 10 s, wakes on move, catches up at 12 units, treat cooldown 2 s, sister hearts
  within 6; `Closet.buy` with a pet logs `via: 'pets'`; `SH.purchased()` keeps it; the boutique still passes its
  tests through `stall.js`.
- **Wiring:** both world pages load the new scripts in order; PRECACHE up to date; Grade 2 pet stall, Mang Kiko and
  pet text paired; `petshop` kind and Mang Kiko clear of obstacles and spawn spots.
- **E2E (headless Chrome, software WebGL):** walk to Mang Kiko and the stall opens; try a pet and a hat, close, and
  the saved pet is back; buy a pet with seeded coins, balance drops, the pet follows her; at the mirror switch pet,
  colour, gear and spot (shoulder on a small pet, arms on a medium pet, a big pet shows only Walk); tap the pet →
  happy mood; Treat → munch; stand still → sit then sleep; the sister's pet shows at the gate with its gear. Existing
  world, boutique, lobby, shop and family e2e still pass.
- **Tablet check (user):** smoothness with the pet out, shoulder/head/arms look right, tap on the pet vs tap-to-walk.

## Out of scope (2a)

Pet tricks, fetch toys, celebrate-on-return and ⭐ bubbles, pet-to-pet play (all 2b); hunger, care needs or sad pets
(never); her own emotes and poses (sub-project 3); parent gifts, refunds, selling back.
