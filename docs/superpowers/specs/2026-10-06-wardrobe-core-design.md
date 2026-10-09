# Wardrobe Core + Boutique — Design

Date: 2026-10-06. Spec 2 of the walkable 3D world (`2026-10-05-walkable-3d-world-design.md`), sub-project 1 of 5.
Build order: after boss + army (both touch `world-main.js`, `layout.js`, `cast.js` and the world e2e seeds).

## Goal

She dresses up her 3D character with clothes, hats, accessories, face extras and special hair, bought with the same
coins as the reward shop at Lola Lana's Boutique in Shop Plaza, and switches what she wears at the mirror. The
character maker also gets more free basics (skin tones, hair styles, eyes, freckles, blush).

## Decisions (agreed with the user)

- **Shared coins.** Wardrobe items cost coins from the same wallet as the real rewards, so the girls learn wants vs
  needs. This replaces the 2026-10-01 decision to skip cosmetics. Each girl still has her own wallet; nothing moves
  between sisters.
- **Plain confirm.** "Buy Crown for 700 coins?" Yes / No. No PIN, no trade-off message, no parent limit.
- **Prices 50–800 coins** (for scale: ML 80, movie 600).
- **Basics free, fancy paid.** She never pays to look like herself.
- **No gifts, no refunds** in this sub-project.
- **Buy at a new boutique stall; the mirror only switches between owned items.**
- **Build:** items are code-built shapes (rounded boxes, balls, cones, like the rest of the character) plus canvas
  painting on the face texture. No model files.
- **~40 paid items** to start.

### The five sub-projects (this spec is #1)

1. Wardrobe core + boutique (this spec).
2. More pets + pet gear.
3. Handheld props (wand, lantern, balloon, bubbles, instrument, plushie) + emotes/poses/outfit idles + sound effects
   (footsteps, prop sounds).
4. Particle trails (sparkles, stars, hearts) + auras, with a tablet performance budget.
5. My Little House decorating.

Each gets its own brainstorm, spec, plan and build.

## What she sees

### Lola Lana's Boutique

A new stall inside the Shop Plaza place (centre `x 62, z 0`, radius 12), south of the shop building and clear of
Bunny (`62.6, 4.4`) and the counter, with its own collision box. The shopkeeper is **Lola Lana**, a sheep tailor
("lana" = wool), built like the other chibi folk. Walking up shows her action button (a new item kind `boutique`);
tapping it opens the Boutique panel. Grade 2 text is paired "Filipino · English"; buttons are English only.

The panel is modal like the maker: she is frozen, the HUD hides, and the camera uses the maker's portrait view
(`ctl.portrait()`) while her character turns slowly. The top shows her balance (`Wallet.balanceStored()`).

- **Tabs:** Clothes, Hats, Accessories, Face, Hair & Glitter.
- **Cards:** icon, name, price, a progress bar toward the price (like the reward shop), or ✓ Owned.
- **Try-on:** tapping a card puts the item on her 3D character at once; the camera turns to her as in the maker.
  Try-ons stack, one item per slot: a dress and a hat can be tried together; a second hat replaces the first.
- **Buy:** each card has its own Buy. It shows the plain confirm. Not enough coins: the button reads "40 more coins"
  and is disabled. While the date guard pauses coins (`Clock.paused()`), Buy is disabled and the panel shows the clock
  banner text. Yes spends the coins, keeps that item on her (it is saved as worn), and plays a small sparkle and
  sound. Other try-ons stay try-ons.
- **Closing** the boutique puts back her saved look. Try-ons live only in memory, so leaving the page any other way
  (reload, back gesture, closing the app) also loses them. Only Yes keeps an item.

### The mirror

"🪞 Change my look" opens the maker, which gets tabs so it stays short on a phone (the panel is 58% high):

- **Me** tab: today's rows (body, skin, hair, hair colour, outfit colour, pet, pet name) plus the new free rows (eyes,
  freckles, blush; more skin tones and hair styles in the existing rows).
- Then the five boutique tabs in the same order, each listing only what she owns, plus **None**. A tab with nothing
  owned yet shows only the link below.
- A "🛍 More at Lola Lana's" link that saves and closes the maker and lights Mimi's sparkle trail to Shop Plaza, where
  the boutique stands.
- The mirror never sells anything.

Her sister sees the new look at the gate and in the family peek, as today.

## Catalog

### Free (maker)

| Row | Added |
|---|---|
| Skin | 5 more tones (10 total), appended to `OPTIONS.skin` |
| Hair | braids, ponytail, curly (with pigtails, bob, short) |
| Eyes (new) | round (today's, default), sleepy, sparkly, smiley |
| Freckles (new) | on / off (default off) |
| Blush (new) | on / off (default on, today's look) |

### Paid (boutique), ~40 items

| Group | Slot(s) | Items | Price |
|---|---|---|---|
| Clothes | clothes | hoodie, overalls, school uniform, raincoat, sports jersey, princess dress, superhero suit with cape, Filipiniana / barong (by body) | 150–600 |
| Hats | hat | cap, sunhat, flower crown, beanie, bunny ears, witch hat, salakot, crown | 50–700 |
| Accessories | glasses, back, neck | round glasses, star sunglasses (glasses); backpack, angel wings, butterfly wings, fairy wings (back); scarf, bow tie (neck) | 100–800 |
| Face | sticker, paint | heart, star, rainbow stickers; cat whiskers, flag, butterfly, tiger face paint; sparkle cheeks | 50–200 |
| Hair & Glitter | dye, shimmer | rainbow, galaxy, gold, pastel dyes; hair glitter (dye slot); gold, pink, silver body shimmer | 200–800 |

Exact names, prices and icons are set in the plan; every price stays within 50–800 and the crown, wings and
Filipiniana / barong sit at the top.

Rules:

- One item per slot. Slots: `clothes, hat, glasses, back, neck, sticker, paint, dye, shimmer`.
- Clothes replace today's girl dress or boy shirt-and-shorts. Items marked `tint` take her outfit colour.
- A hat replaces the girl's bow; pigtails, braids and ponytail still show under it.
- A dye replaces her hair colour while worn; taking it off brings her hair colour back.
- Both grades get the same catalog, each paying from her own wallet.

## Data

| Key | Shape | Sync | Backup |
|---|---|---|---|
| `wardrobe_v1` (new) | `{v: 1, owned: {itemId: {t, coins}}}` | New kind `wardrobe` (in `kindOf`, `JSON_KINDS` and `MERGE`): union of `owned` (earliest `t` kept per item) | Yes, she paid coins for it |
| `avatar_v1` (grows) | adds `eyes`, `freckles`, `blush`, `wear: {clothes, hat, glasses, back, neck, sticker, paint, dye, shimmer}` (item id or `''`) | Replace merge, family peek (unchanged) | No (unchanged) |

- `avatar_v1` stays `v: 1`. Missing or invalid fields clean to defaults; old looks keep working. New colours are only
  appended.
- Her own character shows a worn item only if `wardrobe_v1` owns it; otherwise that slot shows as `''`. The stored
  value is kept, so a late sync of `wardrobe_v1` makes it show.
- The ownership filter runs in `world-main.js` before `Avatar.character()`. Her sister's character (`kin.js`, which
  already runs `Look.clean`) is drawn from her own `avatar_v1` without an ownership check.
- An unknown item id (from a newer device) is skipped when drawing and kept in storage.
- Backups: `wardrobe_v1` joins `STATE_KEY_RE` in `study-history.js` and the `savedState()` key list in
  `parent-panel.js`. Restore replaces the key like the wallet, so an older backup brings back the older owned list
  together with the older `spent`; the two stay consistent.
- Accepted gap: buying the same item offline on two devices charges twice. Each girl uses one tablet.

### Coins and history

- A buy calls the wallet's existing `spend(coins)` (no wallet changes), then writes `wardrobe_v1`, then logs a
  study-history `purchase` entry with `via: 'wardrobe'`. `SH.purchased()` today drops any `via` other than `pin` or
  `phone`, so it learns `wardrobe`. The Parent panel shows "🛒 Bought Crown — 300 coins · from the wardrobe
  boutique". It is pruned after 7 days like other purchases and appears in the purchases CSV.
- Coins are spent before `wardrobe_v1` is written on purpose: `owned` only ever grows (union), so an item that synced
  before a rollback could never be taken back.
- If `spend` returns false (a sync moved the coins), she sees "Not enough coins yet" and nothing is bought.
- If writing `wardrobe_v1` fails after the spend, the coins are given back with `Wallet.addBonus(coins)` and she sees
  "Try again". (`addBonus` refuses while the date guard is on, which is why Buy is disabled then.)

## Files

| File | Job |
|---|---|
| `web/world/items.js` (new) | Catalog data: `id, slot, group, name (en), name2 (Grade 2 pair), coins, tint, icon`. Plain module like `look.js` (Node-testable). |
| `web/world/wear.js` (new) | One mesh builder per item, attached to the character's head / body / back anchors; face painters for eyes, freckles, blush, stickers, paint, sparkle cheeks; hair dye and shimmer materials. |
| `web/world/closet.js` (new) | `wardrobe_v1`: read what she owns, and `buy()` (spend, save, refund on a failed save, log). Node-testable. |
| `web/world/boutique.js` (new) | The boutique panel: tabs, cards, try-on, Buy, confirm, revert on close. Same DOM style as `maker.js`. |
| `web/world/avatar.js` | Exposes head, body and back anchors; calls `Wear` for worn items; `faceTexture()` takes the look. |
| `web/world/look.js` | New free options, `wear` cleaning, `owns(look, wardrobe)` filter. |
| `web/world/maker.js` | New free rows, owned-item rows with None, "More at Lola Lana's" link. |
| `web/world/layout.js`, `build.js`, `cast.js`, `lines.js`, `text.js` | The stall, Lola Lana, her lines and the panel text (Grade 2 paired). |
| `web/world/world-main.js` | Opens the boutique at the stall (modal like the maker); revert on close; the nudge does not count while it is open (same as the maker); visitors wait while it is open. |
| `web/engine/sync-core.js` | `wardrobe` kind and its union merge. |
| `web/engine/study-history.js`, `parent-panel.js` | `via: 'wardrobe'` label; `wardrobe_v1` in backup keys. |

Both world pages load `items.js`, `look.js`, `closet.js` right after `layout.js`, `wear.js` right before `avatar.js`,
and `boutique.js` right after `maker.js`. Run
`node tools/update-precache.js` after adding the files.

## Performance

Item meshes reuse the shared cached geometry and materials. Wings and the cape are simple shapes. Glitter and shimmer
are a material change plus a few sparkle points, with no sparkle points in low quality. Try-on uses the existing
`dress()` path (rebuilds her character and pet, never the scene) and disposes the old face texture.

## Testing

- **Unit (Node):** every item has a valid slot and group, a price within 50–800, a unique id, and a paired Grade 2
  name; every item has a `Wear` builder (test-enforced, so a new item fails until it is drawn); `look.js` cleans the
  new fields and `wear`; an unowned worn item shows as `''`; the `wardrobe` merge gives the same answer in either
  order and on repeats; a buy spends exactly the price, writes `owned` and logs `purchase` with `via: 'wardrobe'`; not
  enough coins buys nothing; a failed `wardrobe_v1` write refunds; Buy is disabled while `Clock.paused()`;
  `SH.purchased()` keeps `via: 'wardrobe'`; `wardrobe_v1` survives export → `backupState()`.
- **Wiring:** both world pages load the new scripts in order; PRECACHE is up to date; `wardrobe_v1` is in the backup
  keys; Grade 2 boutique and Lola Lana text is paired.
- **E2E (headless Chrome, software WebGL):** walk to Lola Lana and the boutique opens; try a hat and a dress, close,
  and the look reverts; buy with seeded coins and the balance drops and the item is owned and worn; at the mirror,
  swap to None and back; with too few coins Buy is disabled. Existing world, lobby, shop and family e2e still pass.

## Out of scope

Parent gifts, refunds, selling back; pets and pet gear (sub-project 2); props, emotes, poses, sound effects (3);
trails and auras (4); house decorating (5); real-money purchases, ever.
