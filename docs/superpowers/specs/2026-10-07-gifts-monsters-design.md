# Gifts and monsters: question-gated rewards in the 3D world

Date: 2026-10-07. Step 5 of the playground idea (`docs/superpowers/ideas/2026-10-06-playground-exploration-combat.md`).
Uses the pet teacher (`2026-10-07-pet-teacher-design.md`) for every wrong answer.

## User decisions (don't re-litigate)

- **Coins: small, with a daily cap.** Easy 1, Medium 2, Hard 3 coins; at most **15 world coins a day** from gifts and
  monsters together. (A perfect 10-question lesson ≈ 5 coins, so a full world day ≈ 3 lessons' worth.)
- **Questions: due first, then fresh.** Due review questions first, then lesson questions she has never answered.
  A resting question (in a review box, not due yet) is never asked, so nothing pays twice. No question repeats on the
  same day. Scored exactly like ❓ Ask me!: points, review boxes, the gap bonus; saved to her study history as an
  unfinished review quiz, so quests never tick.
- **Tiers come from her own review boxes:** Hard = a due question in box 1 (she missed it before), Medium = a due
  question in a higher box, Easy = a fresh question. Hard first, then Medium, then Easy.
- **Item drops: found-only items.** 8 new wardrobe items that Lola Lana never sells; a Hard reward gives one she does
  not have yet, until she has them all. Then Hard pays coins only.
- **Pet teacher** on every wrong answer.

## Gifts

- A gift box (a wrapped cube with a bow, gently bobbing, a soft glow) appears at a random spot of one of the hangout
  places (gate, plaza, street, garden, Shop Plaza, park, house; never the playground or the fort), at least 12 from her.
- The first gift comes 60 s after the world opens; then one every 3-5 minutes (random), at most 3 on the map.
- She walks up and taps 🎁 Open the gift (or taps the box). The gift asks one question; its tier shows as stars
  (⭐ Easy, ⭐⭐ Medium, ⭐⭐⭐ Hard; Grade 2: Madali, Katamtaman, Mahirap).
- **Right:** the lid pops off, confetti, and the bubble says the points (as Ask me! does) and the coins
  ("🪙 +2 coins"), plus the found item if any ("You found Moon sticker! Wear it at the mirror ✨").
- **Wrong:** the pet teacher explains; then the gift says "Still closed! Try another question?" with 🔁 Try again
  (a new question) and 👋 Bye. The gift stays until opened.

## Monsters

- Cute, bubbly blob monsters (4 kinds: Grumble, Sniffle, Muddle, Fizzle; one colour and emoji each, little horns or
  ears, big eyes). They wander slowly inside a hangout place, now and then hopping and giggling.
- The first monster comes 90 s after the world opens; then one every 2-4 minutes, at most 2 (helpers not counted),
  at a place at least 20 from her.
- **No collision fights:** a fight starts only when she taps ⚔️ Battle {name} (or the monster itself).
- **Right:** the monster wobbles and pops in a bubbly burst (emoji pieces, no explosions), and drops a gift where it
  stood. That gift is already earned: tapping it opens it at once with that question's tier reward.
- **Wrong:** the pet teacher explains; then the monster giggles "Hehe! I called a friend!", a small helper monster
  pops in nearby and the monster vanishes with no gift. A helper never calls another: a wrong answer just makes it
  vanish ("Hehe! Bye!").

## When there is nothing to give

- No question left (every askable question is resting or was asked today) or the lesson files will not load: a gift
  says "No new questions right now. Come back tomorrow! 🎁" and stays closed; a monster says "You know everything
  today! Bye!" and vanishes.
- **Cap reached:** the gift still opens and the answer still scores points, but no coins: "Your world coins are full
  for today. Your points still count!". A found item still drops.
- **Tablet date wrong** (the date guard): `Wallet.addBonus` refuses, so no coins and the paused line.

## Data

`loot_v1` `{ v, day, coins, asked: [review keys], t }` (a synced replace key, like `mates_v1`): world coins paid
today and the questions asked today. A new day resets both. Bad JSON reads as empty. A second tablet may repeat a
question or pay past the cap the same day (accepted, same as `mates_v1`).

Found items go into `wardrobe_v1` (synced as a union) through `Closet.found`, with 0 coins.

## Found-only items (items.js, `found: true`, never in the boutique)

| id | slot | icon | English | Filipino |
|---|---|---|---|---|
| moonsticker | sticker | 🌙 | Moon sticker | Sticker na buwan |
| cloversticker | sticker | 🍀 | Clover sticker | Sticker na klober |
| daisysticker | sticker | 🌼 | Daisy sticker | Sticker na daisy |
| boltpaint | paint | ⚡ | Lightning face paint | Pinta ng kidlat sa mukha |
| minthair | dye | 🌿 | Mint hair | Buhok na kulay mint |
| sunsethair | dye | 🌅 | Sunset hair | Buhok na kulay dapithapon |
| mintshimmer | shimmer | 🍃 | Mint shimmer | Kinang na kulay mint |
| lavendershimmer | shimmer | 💜 | Lavender shimmer | Kinang na kulay lavender |

She wears them from the mirror like any owned item (the mirror shows owned items only).

## How it fits

| File | Kind | Job |
|---|---|---|
| `items.js` | data | the 8 found items (`found: true`, 0 coins), `FOUND`; `owns` never treats a found item as free |
| `wear.js` | 3D | draws the 3 stickers and the paint; the 2 dyes and 2 shimmers |
| `boutique.js` | UI | hides found items |
| `closet.js` | data | `found(storage, id, now)` adds an owned item with 0 coins |
| `recall.js` (engine) | engine | `status(key)` → `{ status: 'due' | 'rest' | 'new', box }` |
| `loot.js` (new) | pure | `loot_v1`, tiers, coins and the cap, question choice, the found-item pick, gift and monster timers and spots, monster kinds, wandering, Grade 2/5 lines |
| `loot3d.js` (new) | 3D | draws gifts and monsters, animates them, act/tap targets, the question bubbles, pays rewards |
| `world-main.js` | wiring | creates loot3d (teach, coins via `Wallet.addBonus`, `Closet.found`, sounds), tap targets, freezes with cards |
| `sfx.js` | sound | `gift-open`, `monster-pop`, `monster-giggle` reuse existing clips (no new files) |

Load order: `loot.js` after `quiz.js`; `loot3d.js` after `mates3d.js`.

## Testing

- Unit: tiers from review boxes; Hard before Medium before Easy; resting and asked-today never picked; coins capped at
  15 a day and reset on a new day; bad `loot_v1` reads empty; found item never one she owns, none when all owned;
  timers (first gift 60 s, then 3-5 min, max 3; monsters 90 s, 2-4 min, max 2); spots never in the playground and at
  least 12 / 20 from her; helpers never summon; Grade 2 lines are pairs; found items hidden from the boutique and not
  free; `Recall.status`.
- E2E: a gift spawned beside her: a wrong answer brings the pet teacher and Try again; a right answer opens it, pays
  coins and saves history; a monster: a wrong answer brings a helper, a right answer on the helper drops a gift that
  opens at once.
