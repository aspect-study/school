# Parent-customizable reward shop — design

Phase 1 (hide, rename, reprice built-in rewards) and phase 2 (add your own rewards, reset) in one spec.

## Why

The shop catalog is hard-coded in `web/engine/wallet.js` (`CATALOG`, 28 items). Many items are specific to the owner's
household ("ML with Tatay", "Pick Tatay's ML hero", "MPL PH match", "National Bookstore", "100 pesos"). With the family
account, other parents can register, and a reward a parent will not or cannot give breaks the promise that every coin buys
a real reward. A parent also knows best what is a fair price for a dessert or 30 minutes of screen time. The current list
and prices were tuned with the kids, so they stay as the starting point: the shop is "the starter list, which a parent
can edit", never an empty shop.

## What changes

### 1. Where the settings live

- One document per child, `shop_items_v1`, in the learner's space (`learner/<id>/`). The wallet is already per child
  (Grade 2 and Grade 5 sisters have separate wallets), and a 7-year-old and a 10-year-old need different rewards and
  prices, so this is per child and never per family.
- A child with no document sees exactly today's shop.
- Only a parent edits it: the editor sits in the Parent panel, behind the parent PIN on the tablet lobbies, and behind
  sign-in plus PIN on the phone parent page (`web/parent/phone.js`). The panel code is shared by both
  (`web/engine/parent-panel.js`), so the editor is written once.
- The children's shop (`#shop-overlay` in the lobbies) only reads the result. Nothing in it is editable.

### 2. Data shape

```
shop_items_v1 = { v: 1, items: { <id>: <entry> } }
entry = { at, hidden?, coins?, name?, emoji?, note?, perDay?, custom?, deleted? }
```

- `at` is the time of the last change to that entry (ms). Every edit sets it.
- Built-in item (id from `CATALOG`): an entry overrides only the fields it holds. `hidden`, `coins`, `name`, `emoji` are
  editable. An entry with no override fields (all removed) is a reset item.
- Custom item: id `c` + base-36 time + 2 random base-36 chars, `custom: true`, with `name`, `emoji`, `coins`, optional
  `note`, optional `perDay` (1, 2 or 3 a day). Its `goal` (the short text in "N more coins to …") is its name.
- Deleting a custom item writes `{ at, deleted: true }` and never removes the entry, so the delete reaches every device.
  It is a few bytes each.
- Limits, checked on save and again when reading (a bad value is ignored, the default applies, nothing throws):
  - `coins`: whole number, 10 to 10000.
  - `name`: 1 to 40 characters after trimming. `note`: up to 80 characters.
  - `emoji`: one of a fixed pick list of about 30 emoji (rewards, food, play, outings). A pick row is used because
    splitting a typed emoji safely needs `Intl.Segmenter`, which older tablets lack.
  - At most 40 custom items per child.
  - Built-in `perDay` is not editable (solo ML stays 1 a day). A custom item may set 1, 2 or 3.

### 3. The effective catalog

- A pure function in `wallet.js`, `effectiveCatalog(defaults, doc)`, returns the list the shop shows: defaults with
  overrides applied, hidden and deleted items left out, custom items added, sorted cheapest to dearest (stable, so equal
  prices keep their default order; custom items go after defaults at the same price).
- The wallet object's `catalog` becomes the effective list for that child (read each time, as `read()` does for the
  wallet today), so everything that already uses `wallet.catalog`, `canBuy`, `buy` and `shelf` follows with no change at
  the call sites: the lobby shop, `nextGoal`, the phone "Shop prices" list, `web/world/progress.js` (is anything
  affordable) and `web/world/town.js`.
- A hidden or deleted item cannot be bought: `check()` answers not found, as for an unknown id today.
- `exported.CATALOG` stays the defaults, for tests and for the editor.
- Editing a built-in item's name clears its built-in note (`SHOP_TEXT.notes[id]`), because the note describes the original
  reward. A price change keeps the note. A custom item shows its own `note`.
- The built-in names keep the project's wording rules; a parent's typed text is shown as typed, in both grades, with no
  Filipino/English pairing enforced. The tests that enforce pairing apply to built-in text only.

### 4. The editor

A "Shop" section in the Parent panel for the chosen child, listing every item in price order, hidden ones included:

- Each row: emoji, name, price, a Show/Hide switch, and an Edit button. A changed built-in item shows a small
  "edited" tag and a Reset button; a hidden one is greyed.
- Edit: name, emoji pick row, price (a number field with + and − steps of 10), and for custom items the note and the
  daily limit. Save and Cancel. Saving a custom item with an empty name or a bad price shows the reason under the
  field and does not close.
- "Add a reward" button at the top; a new custom reward opens the same Edit form.
- Delete (custom only) asks Cancel/Delete first, like the child-delete confirm.
- "Reset the whole shop" at the bottom asks first, then marks every built-in override reset and every custom item
  deleted, each with a new `at`.
- A search box when the list is long (same words as the child shop's search).
- Changes apply at once on the device, show up in the children's shop the next time it opens, and sync.
- The panel shows a short note: "Rewards you add are only for this child. Coins already spent stay spent."

### 5. Things that read the catalog

- **Coin guide** (`GUIDE_TEXT`, built at load with `coinsOf('ml')`, `coinsOf('tatay1..3')`): the ML game and ML with Tatay
  sections show only while their items are visible, with the child's current prices (`lessonsFor` uses the current
  ML price). Plan: build the sections from a `guide(catalog)` call per wallet instead of module load. The static
  `GUIDE_TEXT` stays exported for the existing tests, which keep checking the defaults.
- **Lobby `goal` line** ("N more coins to <goal>"): uses the effective catalog, so a hidden item is never named.
- **Shop requests** (`shop-requests.js`, child asks, parent approves on the phone, the tablet buys): a request holds the
  item id, name and price when it was asked. When the tablet settles it, an item that is now hidden, deleted or at a
  different price ends the request as `short` (nothing bought).
  - The child gets no choice and no explanation to argue with: rewards and prices are a parent setting, so the child's
    side shows only the neutral message "Nothing was bought. Please ask again." (the same text for a change or for too
    few coins), with no mention of what changed or who changed it.
  - The parent sees the problem where the decision is made: on the phone, a waiting request whose reward is now hidden,
    deleted or at a different price is marked "Changed since asked" with the current price, and approving it asks the
    child to request again instead of buying.
  - A child can never edit, hide or reprice a reward, and cannot reach the editor: it is inside the PIN-gated Parent
    panel, not the shop overlay.
- **Purchase history**: already stores `itemName` and `coins` for each purchase (`StudyHistory.purchased`), so renaming
  or deleting an item later never changes old history or the CSV export.
- **Daily limit**: `boughtToday` counts by item id, so hiding and showing an item does not reset the day's count.
- **Seeds in tests**: the lobby e2e seeds 3000 points (340 coins) so solo ML and dinner both fit; this still holds with
  no document.

### 6. Sync and data safety

- New merge kind `shopItems` in `web/engine/sync-core.js` (`kindOf`, `JSON_KINDS`, `merge`). Per item id the entry with
  the larger `at` wins; on a tie `deleted` wins, then the entry whose JSON string sorts higher, so every device ends
  with the same document whichever syncs first. The document is the union of ids.
- The key lives under `learner/<id>/`, so Delete child (cloud and local) removes it with the rest; a test pins this.
- The full backup and restore carry it (it is a normal learner key). A restore from an older backup with no such key
  leaves the document alone.
- `shop_items_v1` is ASCII JSON; the parent's names may hold any characters, which JSON escapes safely. They are shown
  with `textContent` only, never as HTML.

## Out of scope

- The 3D world's own stalls (boutique, pet stall, toy stall, workshop): they are coin sinks tied to the game's items and
  stay as they are.
- Power-up prices (`POWER_UPS`), the coin rate, the welcome gift, test bonus tiers and quest/medal bonuses.
- Sharing a custom list between children, or importing/exporting a shop template.
- Per-reward images, per-reward Filipino/English pairs, reordering by hand (order is always by price).
- The kid-facing editing of any reward. A child can still only request.

## Tests

- `tests/wallet.test.js`: with no document, `catalog` equals the defaults (all existing tests keep passing). With a
  document: hidden items are gone and cannot be bought; a price override is what `canBuy` and `buy` use; a custom item
  is listed in price order and can be bought; a deleted custom item cannot; `perDay` on a custom item blocks a second
  buy; a bad value (price 5, price "abc", name of 41 characters, unknown emoji, 41st custom item) is ignored or
  refused and never throws; a corrupt document reads as no document.
- New `tests/shop-items.test.js`: `effectiveCatalog` ordering (stable, custom after defaults at equal price), the note
  rule, reset, and the merge (two devices, either order, same result; a delete with a later `at` beats an edit; an edit
  with a later `at` than a delete cannot happen, because a deleted id is never edited again).
- `tests/wallet.test.js` guide checks: ML sections follow visibility and price; the default guide text is unchanged.
- `tests/shop-requests.test.js`: a request for an item hidden or repriced after asking settles as `short` and spends
  nothing.
- A sync test: `shop_items_v1` is a synced kind and survives Delete child on the other devices.
- A parent-panel test: the editor lists hidden items, saving writes the document, the confirm shows before delete and
  before "Reset the whole shop".
- `node tests/e2e/lobby-e2e.js`: hide an item in the panel and it disappears from the child's shop; add a custom item
  and it can be bought through the PIN.
- `node --test` all green; `node tools/update-precache.js` if a file is added under `web/`.

## Docs

Update `docs/HANDOFF.md` (what is built) and the shop paragraph of `README.md`; add a memory note after the build.

## Decisions to confirm before the plan

1. **Per child** (as written) rather than per family. Per family would be simpler but the sisters differ in age.
2. **Delete is final** for a custom item (no undo). Hiding is the reversible way.
3. **Price range 10 to 10000** and **40 custom items**. Easy to change.
4. **A changed or hidden item ends a waiting request as `short`** instead of buying at the old price. Confirmed by the owner, with the rule that the child gets no option or explanation to dispute it (neutral message only; the parent sees the change on the phone).
