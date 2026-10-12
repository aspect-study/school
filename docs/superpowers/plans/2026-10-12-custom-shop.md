# Parent-customizable reward shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules that override the skill defaults:** never run `git commit` (the owner does); never add `Co-Authored-By` or any AI attribution anywhere. Each task ends with a suggested commit command in a code block for the owner. Browser JS in `web/` is ES5 in an IIFE `(function (root) {...})(this)` (`var`, `function`, no arrow functions, no `const`/`let`, no template strings); tests and `tools/` are modern Node. Comments only for non-obvious code. Never use fully-qualified names inline. After adding a file under `web/`, run `node tools/update-precache.js`.

**Goal:** A parent can hide, rename and reprice the built-in rewards, add their own rewards, and reset, per child, behind the parent PIN. The child's shop, the coin guide, shop requests and the phone page all follow. The settings sync between devices.

**Architecture:** A per-child document `shop_items_v1` lives in the learner's space. `web/engine/wallet.js` gets pure helpers (`normalizeShopDoc`, `effectiveCatalog`) and its wallet object reads the document each time, so `wallet.catalog`, `canBuy`, `buy` and `shelf` return the effective shop with no change at their call sites. A small edit API on the wallet (`wallet.shop`) validates and writes. A new `web/engine/shop-editor.js` draws the editor inside the Rewards tab of the shared Parent panel (tablet lobbies and phone page). `web/engine/sync-core.js` gets a `shopItems` merge kind.

**Tech Stack:** plain browser JS (ES5 IIFE), Node 22 (`node --test`), headless-Chrome e2e scripts in `tests/e2e`.

Spec: `docs/superpowers/specs/2026-10-12-custom-shop-design.md`.

## File map

- Modify `web/engine/wallet.js` (core helpers, wallet integration, edit API, guide).
- Create `web/engine/shop-editor.js`, `tests/shop-items.test.js`, `tests/shop-editor-wiring.test.js`.
- Modify `web/engine/sync-core.js`, `tests/sync.test.js`.
- Modify `web/engine/parent-panel.js` (mount the editor), `web/parent/phone.js` (changed-request marker, refresh after sync).
- Modify `web/lobby/grade-5.html`, `web/lobby/grade-2.html` (shop script: note rule, settle check; `SHOP_TEXT.short`; editor container and script tag), `web/parent/index.html` (editor container and script tag).
- Modify `tests/wallet.test.js`, `tests/shop-requests.test.js`, `tests/copies.test.js` only if its asserts need the new script tag, `tests/paths.js` (file lists), `tests/e2e/lobby-e2e.js`, `tests/e2e/lobby-driver.page.js`.
- Modify `web/sw.js` (generated), `docs/HANDOFF.md`, `README.md`.

## Shared definitions (used by every task)

An *effective item* is `{ id, emoji, name, goal, coins, perDay?, note?, custom?, renamed? }`.

Document: `{ v: 1, items: { <id>: entry } }`, entry `{ at, hidden?, coins?, name?, emoji?, note?, perDay?, custom?, deleted? }`.

Limits: `PRICE_MIN` 10, `PRICE_MAX` 10000, `NAME_MAX` 40, `NOTE_MAX` 80, `CUSTOM_MAX` 40, `PER_DAY_CHOICES` `[1, 2, 3]`, `EMOJI_PICKS` a fixed list of 30 emoji.

---

### Task 1: Pure core in `wallet.js`

**Files:**
- Modify: `web/engine/wallet.js`
- Create: `tests/shop-items.test.js`

- [ ] **Step 1: Failing tests**

Create `tests/shop-items.test.js` (modern Node):

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { CATALOG, effectiveCatalog, normalizeShopDoc, SHOP_LIMITS, EMOJI_PICKS } = require(engineFile('wallet.js'));

const doc = (items) => ({ v: 1, items });
const ids = (list) => list.map((i) => i.id);

test('no document gives the defaults, in the same order', () => {
  assert.deepEqual(ids(effectiveCatalog(CATALOG, null)), ids(CATALOG));
  assert.deepEqual(ids(effectiveCatalog(CATALOG, doc({}))), ids(CATALOG));
});

test('hidden built-in items are left out', () => {
  const list = effectiveCatalog(CATALOG, doc({ tatay1: { at: 1, hidden: true } }));
  assert.ok(!ids(list).includes('tatay1'));
  assert.equal(list.length, CATALOG.length - 1);
});

test('a price override re-sorts the list, keeping default order at equal prices', () => {
  const list = effectiveCatalog(CATALOG, doc({ pesos: { at: 1, coins: 45 } }));
  const i = ids(list).indexOf('pesos');
  assert.equal(list[i].coins, 45);
  assert.equal(list[i - 1].coins <= 45, true);
  assert.equal(list[i + 1].coins >= 45, true);
  assert.equal(list[i - 1].id, 'music', 'sits between the 40 and 50 coin items');
});

test('renaming a built-in item sets renamed and its goal; a price change does not', () => {
  const list = effectiveCatalog(CATALOG, doc({ dessert: { at: 1, name: 'Ice cream' }, movie: { at: 1, coins: 700 } }));
  const dessert = list.find((i) => i.id === 'dessert'), movie = list.find((i) => i.id === 'movie');
  assert.equal(dessert.name, 'Ice cream');
  assert.equal(dessert.goal, 'Ice cream');
  assert.equal(dessert.renamed, true);
  assert.equal(movie.renamed, undefined);
});

test('custom items are added after defaults at the same price, and deleted ones are gone', () => {
  const list = effectiveCatalog(CATALOG, doc({
    ca1: { at: 1, custom: true, name: 'Bike ride', emoji: '🚲', coins: 200 },
    cb2: { at: 2, custom: true, deleted: true },
  }));
  const i = ids(list).indexOf('ca1');
  assert.equal(list[i - 1].coins <= 200, true);
  assert.equal(list[i - 1].id, 'duo', 'the last default priced 200 comes first');
  assert.ok(!ids(list).includes('cb2'));
  assert.equal(list[i].custom, true);
});

test('bad values are ignored and never throw', () => {
  const bad = normalizeShopDoc({ v: 1, items: {
    music: { at: 1, coins: 5 },
    piggy: { at: 1, coins: 'abc' },
    hero: { at: 1, coins: 10001 },
    ml: { at: 1, name: 'x'.repeat(41) },
    teach: { at: 1, emoji: 'not an emoji' },
    junk: 7,
    c1: { at: 1, custom: true, name: 'No price', emoji: '🎁' },
  } });
  assert.deepEqual(effectiveCatalog(CATALOG, bad).map((i) => i.coins), CATALOG.map((i) => i.coins));
  assert.deepEqual(normalizeShopDoc('{not json'), { v: 1, items: {} });
  assert.deepEqual(normalizeShopDoc(null), { v: 1, items: {} });
});

test('built-in perDay and deleted flags cannot be overridden', () => {
  const list = effectiveCatalog(CATALOG, normalizeShopDoc({ v: 1, items: { ml: { at: 1, perDay: 5, deleted: true } } }));
  assert.equal(list.find((i) => i.id === 'ml').perDay, 1);
});

test('only the first 40 live custom items are kept', () => {
  const items = {};
  for (let n = 0; n < 45; n++) items['c' + n] = { at: n + 1, custom: true, name: 'Reward ' + n, emoji: EMOJI_PICKS[0], coins: 100 };
  const kept = Object.keys(normalizeShopDoc({ v: 1, items }).items);
  assert.equal(kept.length, SHOP_LIMITS.customMax);
});

test('a custom daily limit must be 1, 2 or 3', () => {
  const ok = normalizeShopDoc({ v: 1, items: { c1: { at: 1, custom: true, name: 'A', emoji: EMOJI_PICKS[0], coins: 50, perDay: 2 } } });
  assert.equal(effectiveCatalog(CATALOG, ok).find((i) => i.id === 'c1').perDay, 2);
  const bad = normalizeShopDoc({ v: 1, items: { c1: { at: 1, custom: true, name: 'A', emoji: EMOJI_PICKS[0], coins: 50, perDay: 9 } } });
  assert.equal(effectiveCatalog(CATALOG, bad).find((i) => i.id === 'c1').perDay, undefined);
});
```
- [ ] **Step 2: Run, expect failure** — `node --test tests/shop-items.test.js` fails: `effectiveCatalog` is not exported.

- [ ] **Step 3: Implement in `wallet.js`**

Above `create`, after `findItem`:

```js
var SHOP_KEY = 'shop_items_v1';
var SHOP_LIMITS = { priceMin: 10, priceMax: 10000, nameMax: 40, noteMax: 80, customMax: 40 };
var PER_DAY_CHOICES = [1, 2, 3];
var EMOJI_PICKS = ['🎵', '🎮', '🍽️', '🍨', '🍕', '🍳', '🥤', '🍿', '🎬', '📺', '📚', '🧸', '🎨', '⚽', '🚲', '🏊', '🎡', '🎠', '🛝', '🏖️', '🐶', '🌳', '🎁', '⭐', '💵', '📱', '🎤', '🛍️', '👭', '✨'];

function emptyShopDoc() { return { v: 1, items: {} }; }

function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  var t = v.replace(/\s+/g, ' ').trim();
  return t.length >= 1 && t.length <= max ? t : '';
}

function validPrice(n) { return Number.isInteger(n) && n >= SHOP_LIMITS.priceMin && n <= SHOP_LIMITS.priceMax; }
function validEmoji(e) { return typeof e === 'string' && EMOJI_PICKS.indexOf(e) >= 0; }

// Reads a stored or synced document: every bad field is dropped on its own, so one bad value never hides the rest.
function normalizeShopDoc(raw) {
  var d = raw;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return emptyShopDoc(); } }
  if (!d || d.v !== 1 || !d.items || typeof d.items !== 'object' || Array.isArray(d.items)) return emptyShopDoc();
  var out = emptyShopDoc(), customs = [];
  Object.keys(d.items).forEach(function (id) {
    var e = d.items[id];
    if (!e || typeof e !== 'object' || !Number.isFinite(e.at)) return;
    var builtIn = !!findItem(id), entry = { at: e.at };
    if (builtIn) {
      if (e.hidden === true) entry.hidden = true;
      if (validPrice(e.coins)) entry.coins = e.coins;
      var name = cleanText(e.name, SHOP_LIMITS.nameMax);
      if (name) entry.name = name;
      if (validEmoji(e.emoji)) entry.emoji = e.emoji;
      out.items[id] = entry;
      return;
    }
    if (e.custom !== true) return;
    entry.custom = true;
    if (e.deleted === true) { entry.deleted = true; out.items[id] = entry; return; }
    var cname = cleanText(e.name, SHOP_LIMITS.nameMax);
    if (!cname || !validEmoji(e.emoji) || !validPrice(e.coins)) return;
    entry.name = cname;
    entry.emoji = e.emoji;
    entry.coins = e.coins;
    var note = cleanText(e.note, SHOP_LIMITS.noteMax);
    if (note) entry.note = note;
    if (PER_DAY_CHOICES.indexOf(e.perDay) >= 0) entry.perDay = e.perDay;
    if (e.hidden === true) entry.hidden = true;
    customs.push(id);
    out.items[id] = entry;
  });
  customs.sort(function (a, b) { return out.items[a].at - out.items[b].at || (a < b ? -1 : 1); });
  customs.slice(SHOP_LIMITS.customMax).forEach(function (id) { delete out.items[id]; });
  return out;
}

// What the shop shows: defaults with the overrides applied, hidden and deleted items left out, custom items added,
// cheapest first. Equal prices keep the default order, custom items after the defaults.
function effectiveCatalog(defaults, doc) {
  var items = (doc && doc.items) || {}, rows = [];
  defaults.forEach(function (d, i) {
    var o = own(items, d.id) ? items[d.id] : null;
    if (o && o.hidden) return;
    var item = { id: d.id, emoji: d.emoji, name: d.name, goal: d.goal, coins: d.coins };
    if (d.perDay) item.perDay = d.perDay;
    if (o && o.coins) item.coins = o.coins;
    if (o && o.emoji) item.emoji = o.emoji;
    if (o && o.name) { item.name = o.name; item.goal = o.name; item.renamed = true; }
    rows.push({ item: item, order: i });
  });
  var base = defaults.length;
  Object.keys(items).filter(function (id) { return items[id].custom && !items[id].deleted && !items[id].hidden; })
    .sort(function (a, b) { return items[a].at - items[b].at || (a < b ? -1 : 1); })
    .forEach(function (id, k) {
      var o = items[id], item = { id: id, emoji: o.emoji, name: o.name, goal: o.name, coins: o.coins, custom: true };
      if (o.perDay) item.perDay = o.perDay;
      if (o.note) item.note = o.note;
      rows.push({ item: item, order: base + k });
    });
  rows.sort(function (a, b) { return a.item.coins - b.item.coins || a.order - b.order; });
  return rows.map(function (r) { return r.item; });
}
```

Add to `exported`: `effectiveCatalog`, `normalizeShopDoc`, `SHOP_LIMITS`, `EMOJI_PICKS`, `SHOP_KEY`. `CATALOG` stays the defaults.

- [ ] **Step 4: Run** — `node --test tests/shop-items.test.js` passes; `node --test tests/wallet.test.js` still passes unchanged.

- [ ] **Step 5: Commit**

```bash
git add web/engine/wallet.js tests/shop-items.test.js && git commit -m 'Add shop document helpers: validate, apply overrides, order the effective catalog' -- web/engine/wallet.js tests/shop-items.test.js
```

---

### Task 2: Wallet reads the document; edit API

**Files:**
- Modify: `web/engine/wallet.js`, `tests/wallet.test.js`

- [ ] **Step 1: Failing tests** (append to `tests/wallet.test.js`, using its `setup`, `converted` helpers; `storage.data.shop_items_v1` is the key)

Cover, each as its own `test`:
1. With no document, `w.catalog` deep-equals `CATALOG` (existing tests keep passing).
2. A stored document hiding `tatay1`: `w.catalog` lacks it, `canBuy('tatay1', ...)` is `{ ok: false, need: 0, daily: false }`, `buy('tatay1', ...)` returns `null` and writes nothing.
3. A price override: `canBuy`/`buy` use the override (`purchase.coins` is the new price, `spent` goes up by it).
4. A custom item is listed in price order, can be bought, and `perDay: 1` blocks a second buy the same day (`daily: true`).
5. `shelf()` rows follow the effective list.
6. A corrupt document (`'{not json'`) reads as no document.
7. The wallet only ever writes `wallet_v1`, `shop_items_v1`; editing the shop never writes a points key.
8. Edit API, with `w.shop`:
   - `setHidden('tatay1', true)` then `false` round-trips; `setHidden` on an unknown id returns `{ ok: false, error: 'item' }`.
   - `editItem('dessert', { coins: 4 })` returns `{ ok: false, error: 'price' }` and writes nothing; `{ coins: 250 }` works; `{ name: '' }` → `'name'`; `{ emoji: 'x' }` → `'emoji'`.
   - `editItem('ml', { perDay: 3 })` is ignored (still 1 a day).
   - `addItem({ name: 'Bike ride', emoji: '🚲', coins: 200, note: 'Around the village', perDay: 2 })` returns `{ ok: true, id }` with id matching `/^c[0-9a-z]+$/`; a 41st returns `{ ok: false, error: 'full' }`; `removeItem(id)` on a custom item works and leaves a tombstone, on a built-in returns `{ ok: false, error: 'item' }`.
   - `resetItem('dessert')` clears its overrides; `resetAll()` clears every built-in override and deletes every custom item.
   - Two edits in the same millisecond get increasing `at` values (a fixed clock, so `at` must be `max(now(), previous at + 1)`).
   - `w.shop.rows()` lists every default and live custom item including hidden ones, each `{ id, item, base, hidden, edited, custom }` (`base` = the default item for a built-in, `null` for custom; `edited` true when a field differs from the default), in price order.
   - `w.current('dessert')` returns the effective item or `null` when hidden/deleted/unknown.

- [ ] **Step 2: Run, expect failures.**

- [ ] **Step 3: Implement inside `create`**

- `function readShop() { var raw = null; try { raw = storage.getItem(SHOP_KEY); } catch (e) {} return raw ? normalizeShopDoc(raw) : emptyShopDoc(); }`
- `function writeShop(doc) { try { storage.setItem(SHOP_KEY, JSON.stringify(doc)); return true; } catch (e) { return false; } }`
- `function items() { return effectiveCatalog(CATALOG, readShop()); }` and `function find(id) { ... }` over `items()`.
- `check()` and `buy()` use `find(id)` instead of module-level `findItem` (a hidden/deleted item is "not found"). `shelf()` maps `items()`.
- In the returned object replace `catalog: CATALOG` with `get catalog() { return items(); }` (an ES5 getter; the test for `progress.js`/`town.js` keeps working because they read `wallet.catalog` each time).
- `current: function (id) { return find(id) || null; }`.
- `shop` object:
  - A private `stamp(prevAt)` returning `Math.max(now(), (prevAt || 0) + 1)`.
  - `rows()`, `setHidden(id, hidden)`, `editItem(id, fields)`, `addItem(fields)`, `removeItem(id)`, `resetItem(id)`, `resetAll()`.
  - Validation reuses `cleanText`, `validPrice`, `validEmoji`, `PER_DAY_CHOICES`. A field that is `undefined` is left alone; any present-but-invalid field returns its error (`'name'`, `'price'`, `'emoji'`, `'note'`, `'limit'`) and writes nothing. Built-in `perDay` is never stored. `note` and `perDay` are only stored for custom items; `perDay: 0` or `null` on a custom item removes the limit.
  - Every successful write goes through `writeShop` and returns `{ ok: true }` (or `{ ok: true, id }`), or `{ ok: false, error: 'save' }` when storage throws.
  - A new custom id is `'c' + now().toString(36) + <2 random base-36 chars>`; retry once if it already exists.
  - `resetItem` writes `{ at }` for a built-in id; for a custom id it returns `{ ok: false, error: 'item' }` (use `removeItem`). `resetAll` writes a fresh `at` for every built-in id that has an entry and tombstones every live custom item.

- [ ] **Step 4: Run** — `node --test tests/wallet.test.js tests/shop-items.test.js`, then `node --test` for the whole suite.

- [ ] **Step 5: Commit**

```bash
git add web/engine/wallet.js tests/wallet.test.js && git commit -m 'Wallet follows the per-child shop document and gets an edit API' -- web/engine/wallet.js tests/wallet.test.js
```

---

### Task 3: Coin guide follows the shop

**Files:**
- Modify: `web/engine/wallet.js`, `tests/wallet.test.js`

- [ ] **Step 1: Failing tests**

Keep the existing guide tests as they are (they call `sections(ml)` with one argument and must keep passing). Add:
- `sections(ml, tatay)`: with `tatay = [p1, p2, p3]` the ML-with-Tatay section quotes those prices; with `tatay = null` the section is absent; with `ml = null` the solo ML section is absent; with `undefined` for either, the default catalog price is used (so the old one-argument calls are unchanged). Both grades.
- `goal(need)` is unchanged; `GUIDE_TEXT[grade].goal` is only shown when `ml` exists (see UI step).

- [ ] **Step 2: Implement**

- Change both grades' `sections: function (ml)` to `function (ml, tatay)`. At the top: `if (ml === undefined) ml = coinsOf('ml'); if (tatay === undefined) tatay = [coinsOf('tatay1'), coinsOf('tatay2'), coinsOf('tatay3')];`. Build the array, then drop the 🎮 section when `ml === null` and the 👨 section when `tatay === null`. Replace the `coinsOf('tatayN')` calls inside the strings with `tatay[N - 1]`. Strings otherwise unchanged.
- In `mountUi`, build the guide body on every `show()` instead of once: look up `wallet.current('ml')` and the three Tatay items, pass `ml ? ml.coins : null` and `all three present ? [p1, p2, p3] : null`, rebuild the section list (remove the old `.cg-item` nodes first). The goal line (`T.goal(...)`) is hidden when the solo ML item is hidden or deleted; when shown it uses the current ML price.
- `lessonsFor` already takes the price it is given.

- [ ] **Step 3: Run** — `node --test tests/wallet.test.js`. Add a test that mounts nothing but checks `sections` only; the DOM path is covered by the e2e in Task 8.

- [ ] **Step 4: Commit**

```bash
git add web/engine/wallet.js tests/wallet.test.js && git commit -m 'Coin guide shows the ML sections only while those rewards exist, with their current prices' -- web/engine/wallet.js tests/wallet.test.js
```

---

### Task 4: Sync merge kind `shopItems`

**Files:**
- Modify: `web/engine/sync-core.js`, `tests/sync.test.js`

- [ ] **Step 1: Failing tests** (follow the existing `requests` merge tests in `tests/sync.test.js` for how merge functions and `kindOf` are exercised)

- `kindOf('shop_items_v1')` is `'shopItems'`.
- Merge of two documents: the union of ids; per id the larger `at` wins; equal `at`: a `deleted` entry beats a live one, then the entry whose `JSON.stringify` sorts higher; the result is identical in either argument order (test both orders with the same inputs).
- `null` on one side returns the other; a corrupt side (not `{ v: 1, items: {} }`) is treated as `null`.
- A document written on one device and merged on another round-trips through `readLocal`/`writeLocal` (string stored in the space, parsed on read).
- Delete child: if the test file already checks that deleting a learner removes every `learner/<id>/` key, add `shop_items_v1` to that fixture; otherwise add a small test that the key is under the learner prefix and is removed with it.

- [ ] **Step 2: Implement**

- Add `shopItems: true` to `JSON_KINDS`; in `kindOf` add `if (key === 'shop_items_v1') return 'shopItems';`.
- Add the merge rule next to `requests`:

```js
shopItems: function (a, b) {
  var la = isObj(a) && isObj(a.items) ? a.items : null, lb = isObj(b) && isObj(b.items) ? b.items : null;
  if (!la || !lb) return la ? a : lb ? b : null;
  var items = {};
  function pick(x, y) {
    if (!x || !y) return x || y;
    var ax = Number(x.at) || 0, ay = Number(y.at) || 0;
    if (ax !== ay) return ax > ay ? x : y;
    if (!!x.deleted !== !!y.deleted) return x.deleted ? x : y;
    return JSON.stringify(x) >= JSON.stringify(y) ? x : y;
  }
  Object.keys(la).concat(Object.keys(lb)).forEach(function (id) { items[id] = pick(la[id], lb[id]); });
  return { v: 1, items: items };
},
```

  Check how the existing rules are looked up (`MERGE[kind]`) and whether any list of kinds elsewhere (for example a "which kinds the phone pulls" list or the admin stats) needs the new kind.

- [ ] **Step 3: Run** — `node --test tests/sync.test.js`, then the whole suite.

- [ ] **Step 4: Commit**

```bash
git add web/engine/sync-core.js tests/sync.test.js && git commit -m 'Sync the per-child shop document, newest change per reward wins' -- web/engine/sync-core.js tests/sync.test.js
```

---

### Task 5: Requests, notes and the child's side

**Files:**
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html`, `web/parent/phone.js`, `tests/shop-requests.test.js`

- [ ] **Step 1: Lobby shop script** (one edit in `grade-5.html`, then the identical edit in `grade-2.html`; `tests/copies.test.js` requires the two `<script data-shop>` blocks to be identical)

- In `renderList`, the note line becomes:
  `var note = item.note || (item.renamed ? '' : T.notes[item.id]); if (note) row.appendChild(el('div', 'shop-note', note));`
- In `settle()`, the check becomes: `if (!item || item.coins !== r.coins || !W.canBuy(item.id, points).ok) return 'short';` (a hidden or deleted item is not found by `itemById`; a changed price differs from the request's snapshot).
- `itemById` already reads `W.catalog`, now the effective list.

- [ ] **Step 2: `SHOP_TEXT.short` in each lobby's own inline script** (these differ by grade and are outside the identical block)

- `grade-5.html`: `short: 'Nothing was bought. Please ask again.',`
- `grade-2.html`: `short: 'Walang nabili. Magtanong ulit.\nNothing was bought. Please ask again.',`

  The message names neither a change nor coins, so a child cannot argue with it. Run `tests/english-everywhere.test.js` after editing; the Filipino must follow `CLAUDE.md` rules.

- [ ] **Step 3: Phone page** (`web/parent/phone.js`, `renderRequests`)

- For each waiting request, `var now = child.wallet.current(r.item); var changed = !now || now.coins !== r.coins;`.
- When `changed`, the text row ends with ` · Changed since asked` plus, when the item still exists, ` (now N coins)`, and the only button is `Dismiss` (calls a new `dismiss(id)`); there is no Approve. `dismiss(id)` calls `child.requests.cancel(id)` (allowed from `waiting`), then `render(); sync();`. The child's lobby sees status `cancelled`, which falls through to the neutral `T.short` text. Do not use `answer(id, false)`: that shows the child "Your parent said not this time."
- Normal requests keep `Approve` and `No`. Add the `STATUS_TEXT` entry for `cancelled` if missing.
- Re-run `renderRequests` after every sync (it already runs from `render`), so a price edit made on the phone updates the markers at once.

- [ ] **Step 4: Tests** (`tests/shop-requests.test.js` for the pure part, plus a wiring test string-checking the lobby script)

- The request module is unchanged, so test the rule with a small pure helper if you extract one (preferred: `ShopRequests.isStale(request, currentItem)` returning true when `!currentItem || currentItem.coins !== request.coins`, used by both the lobby `settle` and the phone). Test: unchanged → false; price differs → true; item null → true.
- `tests/copies.test.js` still passes (identical shop script in both lobbies).

- [ ] **Step 5: Run** — `node --test`.

- [ ] **Step 6: Commit**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html web/parent/phone.js web/engine/shop-requests.js tests/shop-requests.test.js && git commit -m 'A changed or hidden reward ends a waiting request quietly; the parent sees it on the phone' -- web/lobby/grade-5.html web/lobby/grade-2.html web/parent/phone.js web/engine/shop-requests.js tests/shop-requests.test.js
```

---

### Task 6: The editor (`shop-editor.js`)

**Files:**
- Create: `web/engine/shop-editor.js`, `tests/shop-editor-wiring.test.js`
- Modify: `web/engine/parent-panel.js`, `web/lobby/grade-5.html`, `web/lobby/grade-2.html`, `web/parent/index.html`, `tests/paths.js`, `tests/copies.test.js`, `tests/pages.test.js` (whichever of these list the engine scripts a page must load)
- Modify: `web/sw.js` via `node tools/update-precache.js`

- [ ] **Step 1: Wiring test first** (string checks, like `tests/guide-wiring.test.js`)

- Each of the two lobbies and `web/parent/index.html` contains `<div class="p-section" id="shop-editor"></div>` inside the `data-panel="rewards"` panel, and loads `../engine/shop-editor.js` before `../engine/parent-panel.js`.
- `parent-panel.js` calls `root.ShopEditor.mount` only when `$('shop-editor')` exists.
- `shop-editor.js` never uses `innerHTML` (all text via `textContent`), is ES5 (no `=>`, `let`, `const`, backticks).

- [ ] **Step 2: `shop-editor.js`**

`root.ShopEditor = { mount: mount }`, `mount(o)` with `o = { box, wallet, onChange }`. Returns `{ render }`. Pure DOM built with `createElement`/`textContent`, using the existing panel classes (`p-section`, `p-btn`, `p-row`, `p-note`) and a few `.se-*` rules injected once.

Behavior, reading everything from `wallet.shop.rows()`:

- Heading `🛒 Reward shop`, the note "Rewards you add are only for this child. Coins already spent stay spent.", an `Add a reward` button, a search box (shown when there are more than 12 rows; matches name), and the list.
- Row: emoji, name, `🪙 price`, `perDay` as ` · N a day`, an "edited" tag when `row.edited`, a `Hide`/`Show` toggle (greyed row when hidden), `Edit`, and for edited built-ins `Reset`.
- Edit form replaces the row (or opens at the top for a new reward): name input (`maxlength` 40), emoji pick row of buttons from `EMOJI_PICKS` (current one marked `aria-pressed`), price number input with `−10`/`+10` buttons (`min` 10, `max` 10000, `step` 10), and for custom items a note input (`maxlength` 80) and a daily limit select (`No limit`, `1 a day`, `2 a day`, `3 a day`). Save and Cancel.
- Save calls `wallet.shop.editItem` or `addItem`. On `{ ok: false, error }` show the reason under the right field (`name`: "Type a name, up to 40 letters."; `price`: "Price must be 10 to 10000 coins."; `emoji`: "Pick a picture."; `full`: "You already have 40 rewards of your own. Delete one first."; `save`: "Could not save. Try again."), keep the form open. On success close the form, `render()`, `onChange()`.
- Delete (custom only) shows an inline confirm "Delete this reward? [Cancel] [Delete]" like the child-delete confirm, then `removeItem`.
- Bottom `Reset the whole shop` with the same inline confirm, then `resetAll`.
- Hide/Show and Reset apply at once, then `render()` and `onChange()`.
- Every button has `type="button"` and an `aria-label` that names the reward.

- [ ] **Step 3: Mount it**

- In `parent-panel.js` `mount(o)`: after the tabs wiring, `if (root.ShopEditor && $('shop-editor') && o.wallet && o.wallet.shop) editor = root.ShopEditor.mount({ box: $('shop-editor'), wallet: o.wallet, onChange: function () { if (o.onChange) o.onChange(); } });`. Call `editor.render()` whenever the Rewards tab is shown (`showTab('rewards')`) and expose a `refresh()` that phone.js and the lobby can call after a sync. Keep `onChange` semantics: on the phone it is `sync`, in the lobby it dispatches `parent-changed`.
- Add the container and the `<script src="../engine/shop-editor.js"></script>` tag to the three pages. The lobbies list engine scripts in a `GLOBALS` map / load list; follow the existing pattern for `parent-panel.js` and add `'shop-editor': 'ShopEditor'` where that map is checked by `tests/browser-globals.test.js`.
- Update `tests/paths.js` file lists and any test that enumerates the engine files a page loads.
- `phone.js`: after each `sync()` completes (where it re-renders the coin line), also call `c.panel.refresh && c.panel.refresh()` so edits made on the tablet appear.
- Run `node tools/update-precache.js`.

- [ ] **Step 4: Run** — `node --test` (pwa, pages, copies, browser-globals, the new wiring test all green).

- [ ] **Step 5: Commit**

```bash
git add web/engine/shop-editor.js web/engine/parent-panel.js web/lobby/grade-5.html web/lobby/grade-2.html web/parent/index.html web/parent/phone.js web/sw.js tests/ && git commit -m 'Add the reward shop editor to the Rewards tab of the Parent panel' -- web/engine/shop-editor.js web/engine/parent-panel.js web/lobby/grade-5.html web/lobby/grade-2.html web/parent/index.html web/parent/phone.js web/sw.js tests/
```

---

### Task 7: Remaining readers

**Files:**
- Modify: `web/parent/phone.js` (`renderShop`), `web/engine/wallet.js` only if a gap shows up

- [ ] **Step 1: Check each reader of the catalog against the spec**
  - `phone.js` `renderShop` uses `wallet.shelf(points)`, now the effective list: hidden items are not listed there. Confirm and leave as is.
  - `web/world/progress.js` and `web/world/town.js` read `wallet.catalog` each call: confirm no cached copy at load (`grep -n "catalog" web/world/*.js web/engine/world.js`).
  - The lobby `nextGoal` uses `W.catalog`: confirm a hidden reward is never named in "N more coins to …".
  - `StudyHistory.purchased(item.id, item.name, item.coins, via)` already snapshots the name and price; a custom item's name is stored through `plain(...)`: confirm it strips anything unsafe.
  - The shop search placeholder ("Search rewards, like ML or Tatay") is fine for all families; leave it.
- [ ] **Step 2:** Fix any gap found with a test first. Otherwise no code change and no commit.

---

### Task 8: End-to-end, docs, final check

**Files:**
- Modify: `tests/e2e/lobby-e2e.js`, `tests/e2e/lobby-driver.page.js`, `docs/HANDOFF.md`, `README.md`

- [ ] **Step 1: Lobby e2e** (follow how the driver already opens the Parent panel with the PIN and the shop)
  - Open the panel, go to Rewards, hide `dessert`; the editor row is greyed and the child's shop no longer lists it.
  - Add a custom reward `Bike ride`, 🚲, 100 coins; it shows in the shop in price order and can be bought through the PIN (`purchase` history entry has the name and 100 coins).
  - Edit `movie`'s price to 700; the shop shows 700.
  - Open the coin guide with `ml` hidden: no ML game section, no goal line.
  - Reset the whole shop: the child's shop equals the default list again.
  - Seeds and the existing assertions (`340 coins`, goal text, `movieNeed`) keep passing when no document exists (run before the new steps).
- [ ] **Step 2: Docs.** `docs/HANDOFF.md`: add the feature to "built", with the file list and the decisions (per child, delete is final, limits, stale requests end quietly). `README.md`: update the shop paragraph and "Adding content" (a new built-in reward still goes in `CATALOG`).
- [ ] **Step 3: Full check.**
  - `node --test` all green.
  - `node tests/e2e/lobby-e2e.js`, `node tests/e2e/guide-e2e.js`, and `node tests/e2e/world-e2e.js` (the world reads `wallet.catalog`) all pass.
  - `node tools/update-precache.js` leaves no diff.
  - `git log origin/main..HEAD --grep='Co-Authored-By\|Claude-Session'` prints nothing before any push.
- [ ] **Step 4: Memory.** Write a project memory note for the feature (files, document shape, the stale-request rule) and add its line to `MEMORY.md`.
- [ ] **Step 5: Commit**

```bash
git add tests/e2e docs/HANDOFF.md README.md && git commit -m 'Cover the customizable shop in the lobby e2e; update HANDOFF and README' -- tests/e2e docs/HANDOFF.md README.md
```

## Self-review notes

- Spec sections: 1 and 2 (document, limits) → Tasks 1 and 2; 3 (effective catalog, notes) → Tasks 1, 2 and 5; 4 (editor) → Task 6; 5 (readers: guide, goal line, requests, history, daily limit) → Tasks 3, 5 and 7; 6 (sync, delete child, backup) → Task 4; tests → every task plus Task 8.
- The coin guide's old one-argument `sections(ml)` calls stay valid on purpose, so the existing tests are not rewritten.
- Wallet storage is the learner's `storage`, so the lobby's outbox notices `shop_items_v1` writes and the phone's memory space is pushed by `sync()` exactly like the wallet.
- Open risk to check in Task 6: the lobby loads engine scripts through a list/`GLOBALS` map that several tests read; the new script must be added everywhere those tests look.
