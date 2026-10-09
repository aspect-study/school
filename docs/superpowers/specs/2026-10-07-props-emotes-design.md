# Wardrobe 3a: handheld props and emotes (Kuya Pilo's Toy Stall)

Date: 2026-10-07. Part of the 3D world wardrobe (spec 2), sub-project 3, split by the user into **3a** (props + emotes,
this spec) and **3b** (sound effects: footsteps, prop sounds, emote sounds; a later spec). Builds on wardrobe core
(`2026-10-06-wardrobe-core-design.md`), pets 2a (`2026-10-06-pets-design.md`) and pets 2b
(`2026-10-06-pets-2b-design.md`).

## Decisions (user, 2026-10-07)

- Split sub-project 3 into 3a (props + emotes) and 3b (sounds).
- Props are sold at a **third stall in Shop Plaza**, run by **Kuya Pilo**, a pilandok (Palawan mouse deer) toy-maker (first picked as a tarsier, changed because two subject buddies are already tarsiers named Tarsi).
- She **holds one prop** (picked at the mirror, like clothes) and a **✨ Use** button plays its action.
- The 12 props and prices below, with the **balloon free**.
- The emotes below (3 free, 8 paid at Kuya Pilo's) plus **free automatic outfit idles**.
- An "arms" pet uses a **one-arm carry**: the pet in her left arm, the prop in her right hand; the pet hops down while
  she does a move and climbs back after.
- Same rules as the rest of the wardrobe: shared wallet, plain Yes/No confirm, no PIN, no gifts, no refunds.

## Catalog

### Props (`items.js`, new slot `prop`, new group `props`)

| id | Coins | Icon | English | Filipino | ✨ Use |
|---|---|---|---|---|---|
| `balloon` | 0 | 🎈 | Balloon | Lobo | bounces up on its string |
| `bubblewand` | 80 | 🫧 | Bubble wand | Pang-bula | blows a stream of bubbles |
| `pamaypay` | 80 | 🪭 | Pamaypay fan | Pamaypay | fans herself, breeze lines |
| `teddy` | 100 | 🧸 | Teddy plushie | Laruang oso | big hug, hearts |
| `bouquet` | 120 | 💐 | Flower bouquet | Pumpon ng bulaklak | holds it out, petals drift |
| `umbrella` | 150 | ☂️ | Umbrella | Payong | opens and twirls |
| `ribbonwand` | 200 | 🎀 | Ribbon wand | Lasong pang-ikot | swirls a ribbon spiral |
| `drum` | 200 | 🥁 | Drum | Tambol | taps it, note bubbles |
| `parol` | 250 | ⭐ | Parol lantern | Parol | glows and twinkles |
| `ukulele` | 300 | 🎸 | Ukulele | Maliit na gitara | strums, note bubbles |
| `magicwand` | 500 | 🪄 | Magic wand | Mahiwagang wand | sparkle burst, star trail |
| `trophy` | 800 | 🏆 | Golden trophy | Gintong tropeo | raises it high, shine rays |

Filipino names are checked by the existing wording test in `tests/world3d-items.test.js` and reviewed against the
Filipino wording rules before the build; the plan may adjust a Filipino name, never an id or price.

**Free props.** `coins === 0` means always owned, as in `pets.js` `has()`. `Items.wearable()`, `Items.keepUnowned()`
and the mirror's `has()` in `maker.js` learn this rule (today they only check `wardrobe_v1.owned`).

**Groups.** `props` is added to `Items.GROUPS`. The mirror builds one tab per group, so it gets a **Props** tab (owned
props + None). `boutique.js` builds its tabs from `Items.GROUPS` too, so it filters `props` out: props are sold only at
Kuya Pilo's.

### Emotes (`emotes.js`, new pure-data catalog)

| id | Coins | Icon | English | Filipino |
|---|---|---|---|---|
| `emote-wave` | 0 | 👋 | Wave | Kaway |
| `emote-clap` | 0 | 👏 | Clap | Palakpak |
| `emote-cheer` | 0 | 🙌 | Cheer | Hiyaw ng saya |
| `emote-bow` | 80 | 🙇 | Bow | Yuko |
| `emote-heart` | 100 | 🫶 | Heart hands | Kamay na puso |
| `emote-giggle` | 120 | 😂 | Giggle | Hagikgik |
| `emote-spin` | 150 | 🌀 | Spin | Ikot |
| `emote-relax` | 150 | 🧘 | Sit and relax | Upo at pahinga |
| `emote-dance` | 250 | 💃 | Dance | Sayaw |
| `emote-cartwheel` | 400 | 🤸 | Cartwheel | Pabaligtad na ikot |
| `emote-hero` | 500 | 🦸 | Hero pose | Pose ng bayani |

Each emote has a time of 1.5–2.5 s. Owned emotes live in `wardrobe_v1.owned` (as tricks do), so sync (union), backups
and history need no change. Emote ids start with `emote-`; a test checks that no id clashes across `items.js`,
`pets.js` and `emotes.js`. `Emotes.owns(owned, id)`, `Emotes.find(id)`, `Emotes.name(it, grade)` and
`Emotes.usable(owned)` (free + owned, catalog order) mirror the `pets.js` helpers.

### Outfit idles (free, automatic, not in any catalog)

| Clothes | Idle |
|---|---|
| `princess` | curtsy sway |
| `hero` | fists on hips |
| `uniform` | arm swing |
| anything else, or none | gentle look-around |

## Kuya Pilo's Toy Stall

- **Place:** a third stall in Shop Plaza beside Lola Lana's boutique and Mang Kiko's pet stall, on both grades.
  `layout.js` gets `toyStall` (box) and `pilo` (circle) in `props()`, the stall joins the solid list, and an item
  `{ kind: 'toyshop', id: 'toyshop' }` joins the list beside `petshop`. Shop Plaza is a circle of radius 12 around
  (62, 0) with no floor drawn and is nearly full, so the toy stall stands in a row south of Lola Lana's at (61, -16) with
  Kuya Pilo at (57.8, -16), facing west like the other two. A layout
  test checks the stall is inside Shop Plaza, overlaps no other prop and leaves the paths clear.
- **Kuya Pilo:** a pilandok built from shapes (small deer body, big ears, big eyes, thin legs, a tiny apron; Pilandok is the clever hero of Filipino folk tales; no buddy uses this animal, while the Wikaharian and Kuwentista buddies are tarsiers named Tarsi) in the cast,
  with a hello line (Grade 2: Filipino paired with English, per the existing rule; Grade 5: English).
- **Panel:** `toyshop.js` (new) is a thin wrapper around the shared `stall.js` panel, like `boutique.js` and
  `petshop.js`. Two tabs:
  - **Props:** tapping one puts it in her hand (a try-on, put back on close unless bought).
  - **Emotes:** tapping one makes her do it once as a demo, through the existing optional `cat.play` hook; emotes are
    never "on".
- **Buying:** `closet.js` `buy()` unchanged (spend first, refund via `addBonus` if saving fails, off while
  `Clock.paused()`), with `via: 'toys'` for study history (shown as "· from the toy stall"). "N more coins" when short; 0-coin items show "Free".
- **Mirror:** the Props tab, plus a third link ("More toys") that lights the trail to Kuya Pilo's stall, beside the
  existing boutique and pet-stall links.

## In the world

### Holding a prop

- `avatar.js` adds a `hand` mount at the end of her right arm; `wear.js` draws the worn prop there (code-built shapes,
  no model files). A new prop fails tests until `wear.js` draws it.
- Each prop has a gentle hold idle: the balloon floats and sways on its string, the parol glows softly; the rest stay
  still.
- The prop is hidden during playground rides and comes back after.
- Her sister at the gate is drawn with her own prop (her look already carries `wear.prop`; drawn with `owned = null`).

### The bar

Two new buttons join 🍪 Treat and 🎾 Play, hidden at the same times (rides, open panels, talks, not free). Buttons are
English on both grades, like the Play row.

- **✨ Use:** shown only when she holds a prop; plays that prop's action.
- **😊 Emote:** opens a row of her usable emotes (like the Play row); she taps one and does it once. A tap elsewhere
  closes the row.

### Moves (`moves.js`, new, pure maths)

Like `pettricks.js`: for each emote, each prop action and each outfit idle, `Moves.pose(id, k)` gives her limb, body and
head angles at moment k (0 to 1) and `Moves.effectsBetween(id, from, to)` lists the timed effects due between two moments (bubbles, petals, hearts, sparkles, note
bubbles, breeze lines, shine rays, star trail). `avatar.animate()` accepts a new pose field `{ move: id, k }`. Prop
parts that move (balloon bounce, umbrella opening, ribbon spiral) are posed from the same k.

Runtime (`moverun.js`, new, driven from `world-main.js`'s tick):

- One move at a time. Walking, a door, quick travel, a panel or a ride stops it at once; her pose resets and live
  effects fade out instead of popping.
- A move can't start mid-ride, while a panel or talk is open, or while she isn't free.
- Effects are small emoji sprites (textures made once and kept), capped at 40 live sprites shared by all effects; on low quality the counts are
  halved.
- While a move runs her pet watches her (turns to face her). A pet in her arms hops down beside her first (reusing
  `companion.js` `hopDown`) and climbs back after, only when its petlife is idle. If the pet is busy (trick, fetch,
  sister play) the move still starts at once and the pet carries on where it is; it never waits.

### One-arm carry

An "arms" pet now sits in her left arm (left arm bent, right arm free). The `arms` mount moves to her left side. Her
right hand holds the prop. With no prop, the right arm hangs as it does when walking.

### Outfit idles

After about 8 s standing still, free, with nothing open and no move running, she plays her outfit's idle once, then the
8 s wait starts again. Never during rides, panels, talks or moves. Her pet's sit (3 s) and sleep (10 s) timers are
unchanged.

## Edge cases

- A worn prop she does not own (newer version, or bought on another device before sync) is kept in `avatar_v1` by
  `keepUnowned` and not drawn, like other slots.
- Not enough coins, date guard pause, failed save: as the boutique.
- Riding pets on her shoulder or head stay put during moves.
- A move started at Kuya Pilo's stall as a demo plays in the stall pose (her in front, facing the camera), like pet
  tricks at Mang Kiko's.

## Testing

- **Catalog:** 12 props and 11 emotes with these prices; balloon, Wave, Clap and Cheer free; ids unique across
  items/pets/emotes; Filipino names pass the wording test; Grade 2 names pair Filipino with English.
- **Drawn:** every prop has a `wear.js` builder; every emote, prop action and outfit idle has a `moves.js` entry.
- **moves.js:** each move starts and ends at rest, angles stay in safe ranges, effects are timed inside the move, times
  1.5–2.5 s.
- **Free rule:** `wearable`, `keepUnowned` and the mirror treat 0-coin props as owned.
- **layout.js:** toy stall inside Shop Plaza on both grades, no overlaps, paths clear.
- **Wiring:** new files in `WORLD_FILES` (tests/paths.js), both world pages and `web/sw.js` PRECACHE; boutique has no
  Props tab; Use/Emote hidden on rides and panels.
- **e2e (`world-e2e.js`):** a "toy stall" case: open, try a prop, demo an emote, buy, mirror Props tab, ✨ Use, 😊 Emote,
  one-arm carry with an arms pet; plus the existing cases still pass.
- **Visual check:** headless renders (canvas `toDataURL` after `S.render()`, dumped via `--dump-dom`; Chrome's
  `--screenshot` shows a blank WebGL canvas) of every prop held, each move's middle frame, Kuya Pilo and the stall,
  checked by eye in the final review.

## Not in 3a

Sounds (3b), pet reactions to props, emoting at her sister, prop gifts and refunds, props inside games.

## Files

| File | Change |
|---|---|
| `web/world/items.js` | `prop` slot, `props` group, 12 props, free rule in `wearable`/`keepUnowned` |
| `web/world/emotes.js` | new catalog |
| `web/world/moves.js` | new: poses + effects for emotes, prop actions, outfit idles |
| `web/world/toyshop.js` | new: Kuya Pilo's panel on `stall.js` |
| `web/world/wear.js` | prop builders on the hand mount |
| `web/world/avatar.js` | `hand` mount, one-arm carry, `{ move, k }` pose |
| `web/world/boutique.js` | skip the `props` group |
| `web/world/maker.js` | free rule, "More toys" link |
| `web/world/layout.js` | `toyStall`, `pilo`, toyshop item |
| `web/world/build.js` / `cast.js` | the stall and Kuya Pilo (`Cast.pilo`) |
| `web/world/usebar.js` | new: ✨ Use and 😊 Emote buttons and the emote row (like `playbar.js`) |
| `web/world/moverun.js` | new: runs one move at a time, stops it, fades effects, outfit-idle timer |
| `web/world/companion.js` | hop down / climb back for moves |
| `web/world/world-main.js` | runtime: moves, idles, effects pool, toy stall open |
| `web/world/text.js` | Grade 2/5 strings |
| `web/world/grade-2.html`, `grade-5.html`, `web/sw.js`, `tests/paths.js` | new scripts |
