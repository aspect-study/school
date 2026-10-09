# Wardrobe Core + Boutique Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lola Lana's Boutique in Shop Plaza sells 40 wardrobe items for coins from her real-reward wallet, with stacked
try-on; the mirror gets tabs for owned items plus free basics (more skin tones, hair styles, eyes, freckles, blush).

**Architecture:** Pure, Node-testable data and logic (`items.js` catalog, `look.js` cleaning, `closet.js` owned list
and buying) feed a drawing layer (`wear.js` builders, called by `avatar.js`) and two DOM panels (`boutique.js`, the
reworked `maker.js`). `world-main.js` wires them; `folk.js` hosts Lola Lana. `wardrobe_v1` syncs as a union and rides in
backups; worn items live in `avatar_v1.wear`.

**Tech Stack:** ES5 browser JS in IIFEs `(function (root) {...})(this)`, Three.js (vendored), `node --test`, headless
Chrome e2e (`tests/e2e`). No build step.

**Spec:** `docs/superpowers/specs/2026-10-06-wardrobe-core-design.md`

## Rules for every task (the user's)

- **Never run `git commit`.** Each task ends by staging with `git add`. The user commits.
- Comments sparingly, only for non-obvious code. Grade 2 labels are "Filipino · English"; buttons are English only.
  Filipino: write "puwede" and "natutuhan"; never "tunog tama"; never "bagay" for "fits".
- After adding a file under `web/`, run `node tools/update-precache.js`.
- Run the whole unit suite with `node --test` from the repo root.

## File map

| File | Status | Job |
|---|---|---|
| `web/world/items.js` | new | Catalog (40 items), slots, groups, `name()`, `find()`, `wearable()` |
| `web/world/look.js` | modify | New free options, `wear` cleaning |
| `web/world/closet.js` | new | `wardrobe_v1` read + `buy()` |
| `web/engine/sync-core.js` | modify | `wardrobe` kind, union merge |
| `web/engine/study-history.js` | modify | `via: 'wardrobe'`, `wardrobe_v1` in backups |
| `web/engine/parent-panel.js` | modify | Label + backup key |
| `web/world/text.js` | modify | Boutique, maker and tab words |
| `web/world/wear.js` | new | Item builders, face painting, hair/skin materials, sparkles |
| `web/world/avatar.js` | modify | New hair styles, calls `Wear` |
| `web/world/layout.js`, `build.js`, `cast.js`, `folk.js` | modify | Stall, Lola Lana, `boutique` item |
| `web/world/boutique.js` | new | Boutique panel |
| `web/world/maker.js` | modify | Tabs, owned rows, shop link |
| `web/world/world-main.js`, `town.js`, `kin.js` | modify | Wiring |
| `web/world/world.css` | modify | Tabs, boutique cards |
| `web/world/grade-2.html`, `grade-5.html`, `tests/paths.js` | modify | Script order |
| Tests | new/modify | `world3d-items`, `world3d-closet`, `world3d-wear`, `world3d-look`, `sync`, `study-history`, `world3d-text`, `world3d-layout`, `world3d-wardrobe-wiring`, `e2e/world-e2e.js` + driver |

---

### Task 1: The catalog (`items.js`)

**Files:**
- Create: `web/world/items.js`
- Create: `tests/world3d-items.test.js`
- Modify: `tests/paths.js:12` (WORLD_FILES), `web/world/grade-2.html:44-45`, `web/world/grade-5.html:44-45`

- [ ] **Step 1: Write the failing test** — `tests/world3d-items.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Items = require(worldFile('items.js'));

test('40 items, unique ids, a known slot and a price from 50 to 800', () => {
  assert.equal(Items.ITEMS.length, 40);
  assert.equal(new Set(Items.ITEMS.map((i) => i.id)).size, 40);
  for (const it of Items.ITEMS) {
    assert.ok(Items.SLOTS.includes(it.slot), it.id + ' slot');
    assert.ok(Number.isInteger(it.coins) && it.coins >= 50 && it.coins <= 800, it.id + ' price ' + it.coins);
    assert.match(it.id, /^[a-z0-9-]{1,32}$/, it.id);
    assert.ok(it.icon && it.en && it.fil, it.id + ' icon and names');
    assert.ok(!it.en.includes(' · ') && !it.fil.includes(' · '), it.id + ' names are single halves');
  }
});

test('every slot belongs to exactly one group, and each group has 8 items', () => {
  const slots = Items.GROUPS.flatMap((g) => g.slots);
  assert.deepEqual([...slots].sort(), [...Items.SLOTS].sort());
  assert.deepEqual(Items.GROUPS.map((g) => g.id), ['clothes', 'hats', 'accessories', 'face', 'hair']);
  for (const g of Items.GROUPS) assert.equal(Items.inGroup(g.id).length, 8, g.id);
});

test('the crown, the wings and the Filipiniana are the dearest of their groups', () => {
  const top = (group) => Math.max(...Items.inGroup(group).map((i) => i.coins));
  assert.equal(Items.find('crown').coins, top('hats'));
  assert.equal(Items.find('fairywings').coins, top('accessories'));
  assert.equal(Items.find('filipiniana').coins, top('clothes'));
});

test('Grade 2 names pair Filipino with English; Grade 5 is English', () => {
  const crown = Items.find('crown');
  assert.equal(Items.name(crown, 'grade5'), 'Crown');
  assert.equal(Items.name(crown, 'grade2'), 'Korona · Crown');
  for (const it of Items.ITEMS) {
    assert.doesNotMatch(it.fil, /\bbagay\b|tunog tama/i, it.id);
    assert.notEqual(it.fil, it.en, it.id + ' needs a Filipino name');
  }
});

test('find knows only catalog ids', () => {
  assert.equal(Items.find('nope'), null);
  assert.equal(Items.find('constructor'), null);
});

test('wearable keeps real items she owns in their own slot, and drops the rest', () => {
  const look = { body: 'girl', wear: { hat: 'crown', clothes: 'crown', glasses: 'ghost', back: 'fairywings', neck: '', sticker: 'heartsticker' } };
  const owned = { crown: { t: 1, coins: 700 }, heartsticker: { t: 2, coins: 50 } };
  const out = Items.wearable(look, owned);
  assert.deepEqual(out.wear, { clothes: '', hat: 'crown', glasses: '', back: '', neck: '', sticker: 'heartsticker', paint: '', dye: '', shimmer: '' });
  assert.equal(out.body, 'girl');
  assert.equal(look.wear.back, 'fairywings', 'the saved look is not changed');
  assert.equal(Items.wearable(look, null).wear.back, 'fairywings', 'her sister is drawn without an ownership check');
  assert.deepEqual(Items.wearable({}, null).wear, Items.emptyWear());
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-items.test.js`
Expected: FAIL, `Cannot find module ... items.js`.

- [ ] **Step 3: Write `web/world/items.js`**

```js
/* The wardrobe catalog: what Lola Lana sells, the slot each item fills and its price in coins. Pure data, so the Node
   tests can read it. wearable() keeps only real items she owns, each in its own slot. */
(function (root) {
  'use strict';

  var SLOTS = ['clothes', 'hat', 'glasses', 'back', 'neck', 'sticker', 'paint', 'dye', 'shimmer'];
  // The boutique tabs and the mirror tabs, in this order.
  var GROUPS = [
    { id: 'clothes', slots: ['clothes'] },
    { id: 'hats', slots: ['hat'] },
    { id: 'accessories', slots: ['glasses', 'back', 'neck'] },
    { id: 'face', slots: ['sticker', 'paint'] },
    { id: 'hair', slots: ['dye', 'shimmer'] }
  ];

  // tint: the item takes her outfit colour.
  function item(id, slot, coins, icon, en, fil, tint) {
    return { id: id, slot: slot, coins: coins, icon: icon, en: en, fil: fil, tint: !!tint };
  }
  var ITEMS = [
    item('hoodie', 'clothes', 150, '🧥', 'Hoodie', 'Jaket na may talukbong', true),
    item('overalls', 'clothes', 150, '👖', 'Overalls', 'Oberols'),
    item('raincoat', 'clothes', 200, '🌧️', 'Raincoat', 'Kapote'),
    item('jersey', 'clothes', 200, '🎽', 'Sports jersey', 'Damit pang-isports', true),
    item('uniform', 'clothes', 250, '🏫', 'School uniform', 'Uniporme sa paaralan'),
    item('princess', 'clothes', 450, '👗', 'Princess dress', 'Damit-prinsesa', true),
    item('hero', 'clothes', 500, '🦸', 'Superhero suit', 'Kasuotang superhero'),
    item('filipiniana', 'clothes', 600, '🇵🇭', 'Filipiniana or barong', 'Filipiniana o barong'),
    item('cap', 'hat', 50, '🧢', 'Cap', 'Gora'),
    item('sunhat', 'hat', 80, '👒', 'Sun hat', 'Sombrero pang-araw'),
    item('beanie', 'hat', 100, '🧶', 'Beanie', 'Bonete', true),
    item('flowercrown', 'hat', 150, '🌸', 'Flower crown', 'Korona ng bulaklak'),
    item('bunnyears', 'hat', 200, '🐰', 'Bunny ears', 'Tainga ng kuneho'),
    item('wizard', 'hat', 250, '🧙', 'Wizard hat', 'Sombrero ng salamangkero'),
    item('salakot', 'hat', 300, '🌾', 'Salakot hat', 'Salakot'),
    item('crown', 'hat', 700, '👑', 'Crown', 'Korona'),
    item('roundglasses', 'glasses', 100, '👓', 'Round glasses', 'Bilog na salamin'),
    item('starglasses', 'glasses', 150, '🕶️', 'Star sunglasses', 'Salaming pang-araw na bituin'),
    item('scarf', 'neck', 100, '🧣', 'Scarf', 'Bupanda', true),
    item('bowtie', 'neck', 100, '🎀', 'Bow tie', 'Kurbatang paru-paro'),
    item('backpack', 'back', 200, '🎒', 'Backpack', 'Bag sa likod'),
    item('angelwings', 'back', 500, '😇', 'Angel wings', 'Pakpak ng anghel'),
    item('butterflywings', 'back', 600, '🦋', 'Butterfly wings', 'Pakpak ng paru-paro'),
    item('fairywings', 'back', 800, '🧚', 'Fairy wings', 'Pakpak ng diwata'),
    item('heartsticker', 'sticker', 50, '💖', 'Heart sticker', 'Sticker na puso'),
    item('starsticker', 'sticker', 50, '⭐', 'Star sticker', 'Sticker na bituin'),
    item('rainbowsticker', 'sticker', 80, '🌈', 'Rainbow sticker', 'Sticker na bahaghari'),
    item('sparklecheeks', 'sticker', 100, '✨', 'Sparkle cheeks', 'Kumikinang na pisngi'),
    item('whiskers', 'paint', 80, '🐱', 'Cat whiskers', 'Bigote ng pusa'),
    item('flag', 'paint', 120, '🇵🇭', 'Flag face paint', 'Pinta ng watawat sa mukha'),
    item('butterfly', 'paint', 150, '🦋', 'Butterfly face paint', 'Pinta ng paru-paro sa mukha'),
    item('tiger', 'paint', 200, '🐯', 'Tiger face paint', 'Pinta ng tigre sa mukha'),
    item('goldhair', 'dye', 200, '💛', 'Gold hair', 'Gintong buhok'),
    item('pasteltips', 'dye', 250, '🍬', 'Pastel tips', 'Pastel na dulo ng buhok'),
    item('glitterhair', 'dye', 300, '💫', 'Glitter hair', 'Makinang na buhok'),
    item('rainbowhair', 'dye', 400, '🌈', 'Rainbow hair', 'Bahagharing buhok'),
    item('galaxyhair', 'dye', 500, '🌌', 'Galaxy hair', 'Buhok na parang kalawakan'),
    item('goldshimmer', 'shimmer', 600, '🌟', 'Gold shimmer', 'Gintong kinang'),
    item('pinkshimmer', 'shimmer', 600, '💗', 'Pink shimmer', 'Rosas na kinang'),
    item('silvershimmer', 'shimmer', 600, '🤍', 'Silver shimmer', 'Pilak na kinang')
  ];

  var BY_ID = {};
  ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  function find(id) { return own(BY_ID, id) ? BY_ID[id] : null; }
  function groupOf(slot) { return GROUPS.filter(function (g) { return g.slots.indexOf(slot) >= 0; })[0].id; }
  function inGroup(id) { return ITEMS.filter(function (it) { return groupOf(it.slot) === id; }); }
  function name(it, grade) { return grade === 'grade2' ? it.fil + ' · ' + it.en : it.en; }
  function emptyWear() {
    var w = {};
    SLOTS.forEach(function (s) { w[s] = ''; });
    return w;
  }

  // owned: { itemId: {...} } from closet.js, or null to skip the ownership check (her sister, drawn as she saved it).
  function wearable(look, owned) {
    var out = Object.assign({}, look), wear = {};
    SLOTS.forEach(function (s) {
      var id = look && look.wear ? look.wear[s] : '', it = find(id);
      wear[s] = it && it.slot === s && (owned === null || own(owned, id)) ? id : '';
    });
    out.wear = wear;
    return out;
  }

  var exported = { SLOTS: SLOTS, GROUPS: GROUPS, ITEMS: ITEMS, find: find, groupOf: groupOf, inGroup: inGroup, name: name, emptyWear: emptyWear, wearable: wearable };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Items = exported;
})(this);
```

- [ ] **Step 4: Wire it into the world pages**

In `tests/paths.js:12`, change the start of `WORLD_FILES` from `['text.js', 'layout.js', 'look.js', ...` to
`['text.js', 'layout.js', 'items.js', 'look.js', ...` (everything else unchanged).

In both `web/world/grade-2.html` and `web/world/grade-5.html`, replace

```html
<script src="layout.js"></script>
<script src="look.js"></script>
```

with

```html
<script src="layout.js"></script>
<script src="items.js"></script>
<script src="look.js"></script>
```

Run: `node tools/update-precache.js`

- [ ] **Step 5: Run the tests**

Run: `node --test tests/world3d-items.test.js tests/world3d-wiring.test.js tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add web/world/items.js tests/world3d-items.test.js tests/paths.js web/world/grade-2.html web/world/grade-5.html web/sw.js web/world/lesson-files.js
```

---

### Task 2: Free basics and `wear` in `look.js`

**Files:**
- Modify: `web/world/look.js`
- Modify: `tests/world3d-look.test.js`

- [ ] **Step 1: Update the tests** — in `tests/world3d-look.test.js`, replace the tests
`'unknown or broken values clean to the defaults; ...'` and `'save stamps the time and keeps only clean values'` with
the versions below, and add the two new tests at the end.

```js
const EMPTY = { clothes: '', hat: '', glasses: '', back: '', neck: '', sticker: '', paint: '', dye: '', shimmer: '' };

test('unknown or broken values clean to the defaults; the pet name is trimmed and safe', () => {
  const raw = { v: 1, body: 'dragon', skin: 10, hair: 'bob', hairColor: -1, outfit: 1.5, pet: 'cat', petName: '<b>Bantay the Brave Dog</b>', t: 7,
    eyes: 'wink', freckles: 'yes', blush: 0, wear: { hat: 'crown', back: '<b>', clothes: 7, zzz: 'x' } };
  const r = Look.read(memory({ avatar_v1: JSON.stringify(raw) }));
  assert.deepEqual(r.look, { v: 1, body: 'girl', skin: 0, hair: 'bob', hairColor: 0, outfit: 0, pet: 'chick', eyes: 'round', freckles: false, blush: true,
    petName: 'bBantay the', wear: Object.assign({}, EMPTY, { hat: 'crown' }), t: 7 });
  assert.equal(r.made, true);
  assert.equal(Look.read(memory({ avatar_v1: '{nope' })).made, false);
  assert.equal(Look.read(memory({ avatar_v1: JSON.stringify(Object.assign({}, raw, { v: 2 })) })).made, false);
});

test('save stamps the time and keeps only clean values', () => {
  const s = memory();
  const out = Look.save(s, { body: 'boy', skin: 7, hair: 'curly', hairColor: 3, outfit: 4, pet: 'puppy', petName: '  Max  ', eyes: 'smiley', freckles: true, blush: false,
    wear: { hat: 'cap', sticker: 'starsticker' }, t: 0 }, 1234);
  assert.deepEqual(out, { v: 1, body: 'boy', skin: 7, hair: 'curly', hairColor: 3, outfit: 4, pet: 'puppy', eyes: 'smiley', freckles: true, blush: false,
    petName: 'Max', wear: Object.assign({}, EMPTY, { hat: 'cap', sticker: 'starsticker' }), t: 1234 });
  assert.deepEqual(JSON.parse(s.data.avatar_v1), out);
});

test('a look saved before the wardrobe keeps working and gets the new defaults', () => {
  const old = { v: 1, body: 'girl', skin: 2, hair: 'pigtails', hairColor: 1, outfit: 3, pet: 'kitten', petName: 'Mimi', t: 5 };
  const r = Look.read(memory({ avatar_v1: JSON.stringify(old) }));
  assert.equal(r.look.skin, 2);
  assert.equal(r.look.eyes, 'round');
  assert.equal(r.look.freckles, false);
  assert.equal(r.look.blush, true);
  assert.deepEqual(r.look.wear, EMPTY);
});

test('the free basics: 10 skin tones and 6 hair styles, old ones first', () => {
  assert.equal(Look.OPTIONS.skin.length, 10);
  assert.deepEqual(Look.OPTIONS.skin.slice(0, 5), ['#ffe0c7', '#f6c9a0', '#e0a878', '#b97d52', '#8a5634']);
  assert.deepEqual(Look.OPTIONS.hair, ['pigtails', 'bob', 'short', 'braids', 'ponytail', 'curly']);
  assert.deepEqual(Look.OPTIONS.eyes, ['round', 'sleepy', 'sparkly', 'smiley']);
});
```

Also, in the existing test `'options are unique and colours are hex'`, nothing changes (booleans are unique too).

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-look.test.js`
Expected: FAIL (no `eyes`, `wear`, short `skin` list).

- [ ] **Step 3: Change `web/world/look.js`**

Replace the header comment and the block from `var KEY = 'avatar_v1';` through the end of `clean()` with:

```js
/* Her character's look, saved per learner as avatar_v1 and synced (replace merge), so her sister can see it later.
   Colours are stored as indexes into OPTIONS, so new colours are only ever appended. wear holds one wardrobe item id
   per slot (items.js); ids from a newer device are kept, and items.wearable() decides what is drawn. */
(function (root) {
  'use strict';

  var Items = typeof module !== 'undefined' && module.exports ? require('./items.js') : root.World3D.Items;
  var KEY = 'avatar_v1';
  var NAME_MAX = 12;
  var ID = /^[a-z0-9-]{1,32}$/;
  var OPTIONS = {
    body: ['girl', 'boy'],
    skin: ['#ffe0c7', '#f6c9a0', '#e0a878', '#b97d52', '#8a5634', '#fff0e1', '#d49a6a', '#a86b3c', '#704524', '#4f3020'],
    hair: ['pigtails', 'bob', 'short', 'braids', 'ponytail', 'curly'],
    hairColor: ['#5a3a2e', '#2b2140', '#a0522d', '#e8b04a', '#f4a6c8', '#7b5cff', '#4cb8e0', '#ff7f7f'],
    outfit: ['#ff8fc8', '#6aa9ff', '#5fcf9a', '#ffd166', '#a77bff', '#ff9e6b', '#4cc9a0', '#ff6f91'],
    pet: ['chick', 'kitten', 'puppy'],
    eyes: ['round', 'sleepy', 'sparkly', 'smiley'],
    freckles: [false, true],
    blush: [true, false]
  };
  var INDEXED = { skin: true, hairColor: true, outfit: true };
  var DEFAULT = { v: 1, body: 'girl', skin: 0, hair: 'pigtails', hairColor: 0, outfit: 0, pet: 'chick', eyes: 'round', freckles: false, blush: true,
    petName: '', wear: Items.emptyWear(), t: 0 };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function cleanName(s) {
    return typeof s === 'string' ? Array.from(s.replace(/[\x00-\x1f\x7f<>&"​-‏ -‮⁦-⁩]/g, '').trim()).slice(0, NAME_MAX).join('').trim() : '';
  }

  function clean(raw) {
    var d = isObj(raw) && raw.v === 1 ? raw : {};
    var out = { v: 1 };
    Object.keys(OPTIONS).forEach(function (k) {
      var ok = INDEXED[k] ? Number.isInteger(d[k]) && d[k] >= 0 && d[k] < OPTIONS[k].length : OPTIONS[k].indexOf(d[k]) >= 0;
      out[k] = ok ? d[k] : DEFAULT[k];
    });
    out.petName = cleanName(d.petName);
    var w = isObj(d.wear) ? d.wear : {};
    out.wear = {};
    Items.SLOTS.forEach(function (s) { out.wear[s] = typeof w[s] === 'string' && ID.test(w[s]) ? w[s] : ''; });
    out.t = Number.isFinite(d.t) && d.t > 0 ? d.t : 0;
    return out;
  }
```

Leave `read`, `save`, `color`, `petName` and the export block as they are.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-look.test.js tests/world3d-items.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/look.js tests/world3d-look.test.js
```

---

### Task 3: What she owns and buying (`closet.js`)

**Files:**
- Create: `web/world/closet.js`
- Create: `tests/world3d-closet.test.js`
- Modify: `tests/paths.js:12`, both world pages

- [ ] **Step 1: Write the failing test** — `tests/world3d-closet.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Closet = require(worldFile('closet.js'));
const Items = require(worldFile('items.js'));

function memory(initial, failWrites) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { if (failWrites) throw new Error('full'); data[k] = String(v); },
  };
}
function wallet(coins) {
  const w = { coins, bonus: 0, spent: 0 };
  w.balanceStored = () => w.coins;
  w.spend = (n) => { if (w.coins < n) return false; w.coins -= n; w.spent += n; return true; };
  w.addBonus = (n) => { w.coins += n; w.bonus += n; return true; };
  return w;
}
function history() {
  const h = { list: [] };
  h.purchased = (item, name, coins, via) => { h.list.push({ item, name, coins, via }); return 'id'; };
  return h;
}
const crown = Items.find('crown');
const base = (o) => Object.assign({ paused: () => false, now: () => 1000, item: crown }, o);

test('a fresh device owns nothing; broken data reads as nothing', () => {
  assert.deepEqual(Closet.read(memory()), {});
  assert.deepEqual(Closet.read(memory({ wardrobe_v1: '{nope' })), {});
  assert.deepEqual(Closet.read(memory({ wardrobe_v1: JSON.stringify({ v: 1, owned: { cap: { t: 5, coins: 50 }, bad: 3, zero: { t: 0 } } }) })), { cap: { t: 5, coins: 50 } });
  assert.equal(Closet.KEY, 'wardrobe_v1');
});

test('buying spends exactly the price, saves the item and logs it as a wardrobe purchase', () => {
  const s = memory(), w = wallet(1000), h = history();
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: h })), { ok: true });
  assert.equal(w.coins, 300);
  assert.deepEqual(Closet.read(s), { crown: { t: 1000, coins: 700 } });
  assert.deepEqual(h.list, [{ item: 'crown', name: 'Crown', coins: 700, via: 'wardrobe' }]);
});

test('not enough coins buys nothing and says how many more', () => {
  const s = memory(), w = wallet(650), h = history();
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: h })), { ok: false, why: 'short', need: 50 });
  assert.equal(w.coins, 650);
  assert.deepEqual(Closet.read(s), {});
  assert.deepEqual(h.list, []);
});

test('an item she owns is never bought twice', () => {
  const s = memory({ wardrobe_v1: JSON.stringify({ v: 1, owned: { crown: { t: 1, coins: 700 } } }) }), w = wallet(1000);
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: history() })), { ok: false, why: 'owned' });
  assert.equal(w.coins, 1000);
});

test('while the date guard pauses coins, nothing can be bought', () => {
  const w = wallet(1000);
  assert.deepEqual(Closet.buy(base({ storage: memory(), wallet: w, history: history(), paused: () => true })), { ok: false, why: 'paused' });
  assert.equal(w.coins, 1000);
});

test('if the wallet refuses at the last moment, nothing is saved', () => {
  const s = memory(), w = wallet(1000);
  w.spend = () => false;
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: history() })), { ok: false, why: 'short', need: 0 });
  assert.deepEqual(Closet.read(s), {});
});

test('a failed save gives the coins back and logs nothing', () => {
  const w = wallet(1000), h = history();
  assert.deepEqual(Closet.buy(base({ storage: memory({}, true), wallet: w, history: h })), { ok: false, why: 'failed' });
  assert.equal(w.coins, 1000);
  assert.equal(w.bonus, 700);
  assert.deepEqual(h.list, []);
});

test('a broken history never undoes a good buy', () => {
  const s = memory(), w = wallet(1000);
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: { purchased: () => { throw new Error('x'); } } })), { ok: true });
  assert.ok(Closet.read(s).crown);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-closet.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `web/world/closet.js`**

```js
/* What she owns from Lola Lana's Boutique (wardrobe_v1: synced as a union, kept in backups) and buying it with her
   coins. Coins go first: owned only ever grows when it syncs, so an item must never be saved before it is paid for. */
(function (root) {
  'use strict';

  var KEY = 'wardrobe_v1';
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function read(storage) {
    var raw = null, owned = {};
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    if (isObj(raw) && isObj(raw.owned)) {
      Object.keys(raw.owned).forEach(function (id) {
        var e = raw.owned[id];
        if (isObj(e) && Number(e.t) > 0) owned[id] = { t: Number(e.t), coins: Number(e.coins) || 0 };
      });
    }
    return owned;
  }

  // o = { storage, wallet, history, paused(), now(), item }. Returns { ok: true } or { ok: false, why, need? }.
  function buy(o) {
    var it = o.item, owned = read(o.storage);
    if (o.paused()) return { ok: false, why: 'paused' };
    if (own(owned, it.id)) return { ok: false, why: 'owned' };
    var have = o.wallet.balanceStored();
    if (have < it.coins) return { ok: false, why: 'short', need: it.coins - have };
    if (!o.wallet.spend(it.coins)) return { ok: false, why: 'short', need: 0 };
    owned[it.id] = { t: o.now(), coins: it.coins };
    var saved = false;
    try {
      o.storage.setItem(KEY, JSON.stringify({ v: 1, owned: owned }));
      saved = own(read(o.storage), it.id);
    } catch (e) {}
    if (!saved) {
      o.wallet.addBonus(it.coins);
      return { ok: false, why: 'failed' };
    }
    try { if (o.history) o.history.purchased(it.id, it.en, it.coins, 'wardrobe'); } catch (e) {}
    return { ok: true };
  }

  var exported = { KEY: KEY, read: read, buy: buy };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Closet = exported;
})(this);
```

- [ ] **Step 4: Wire it**

In `tests/paths.js:12`: `'items.js', 'look.js',` → `'items.js', 'look.js', 'closet.js',`.
In both world pages, add `<script src="closet.js"></script>` right after `<script src="look.js"></script>`.
Run: `node tools/update-precache.js`

- [ ] **Step 5: Run the tests**

Run: `node --test tests/world3d-closet.test.js tests/world3d-wiring.test.js tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add web/world/closet.js tests/world3d-closet.test.js tests/paths.js web/world/grade-2.html web/world/grade-5.html web/sw.js web/world/lesson-files.js
```

---

### Task 4: Sync `wardrobe_v1` as a union

**Files:**
- Modify: `web/engine/sync-core.js:20` (JSON_KINDS), `:37-55` (kindOf), `:122` (MERGE)
- Modify: `tests/sync.test.js` (add tests at the end)

- [ ] **Step 1: Write the failing tests** — append to `tests/sync.test.js`

```js
test('wardrobe_v1 syncs with its own merge rule', () => {
  assert.equal(kindOf('wardrobe_v1'), 'wardrobe');
});

test('wardrobe: a union of what she owns, the earliest buy kept, the same in either order and safe to repeat', () => {
  const a = { v: 1, owned: { cap: { t: 5, coins: 50 }, crown: { t: 9, coins: 700 } } };
  const b = { v: 1, owned: { crown: { t: 7, coins: 700 }, scarf: { t: 8, coins: 100 }, bad: 4 } };
  const ab = MERGE.wardrobe(a, b), ba = MERGE.wardrobe(b, a);
  assert.deepEqual(ab, { v: 1, owned: { cap: { t: 5, coins: 50 }, crown: { t: 7, coins: 700 }, scarf: { t: 8, coins: 100 } } });
  assert.equal(JSON.stringify(ab), JSON.stringify(ba), 'same text either way, so it is not sent again');
  assert.deepEqual(MERGE.wardrobe(ab, b), ab);
  assert.deepEqual(MERGE.wardrobe(a, null), MERGE.wardrobe(null, a));
  assert.equal(MERGE.wardrobe(null, null), null);
});

test('items bought on two devices end up owned on both', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud), phone = device(cloud);
  tablet.s.setItem('wardrobe_v1', JSON.stringify({ v: 1, owned: { cap: { t: 5, coins: 50 } } }));
  phone.s.setItem('wardrobe_v1', JSON.stringify({ v: 1, owned: { crown: { t: 6, coins: 700 } } }));
  await tablet.sync();
  await phone.sync();
  await tablet.sync();
  for (const d of [tablet, phone]) assert.deepEqual(Object.keys(JSON.parse(d.s.getItem('wardrobe_v1')).owned), ['cap', 'crown']);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/sync.test.js`
Expected: FAIL (`kindOf('wardrobe_v1')` is `'replace'`; `MERGE.wardrobe` is not a function).

- [ ] **Step 3: Change `web/engine/sync-core.js`**

Line 20, add `wardrobe: true` to `JSON_KINDS`:

```js
  var JSON_KINDS = { recall: true, review: true, quests: true, boss: true, mastery: true, profile: true, requests: true, practice: true, family: true, familySeen: true, wardrobe: true };
```

In `kindOf`, after `if (key === 'family_seen_v1') return 'familySeen';` add:

```js
    if (key === 'wardrobe_v1') return 'wardrobe';
```

In `var MERGE = {`, add as the first entry:

```js
    // Wardrobe: what she owns only grows; each item keeps its earliest buy. Ids are sorted so both orders give one text.
    wardrobe: function (a, b) {
      if (!isObj(a) && !isObj(b)) return null;
      var owned = {};
      [a, b].forEach(function (x) {
        var o = isObj(x) && isObj(x.owned) ? x.owned : {};
        Object.keys(o).forEach(function (id) {
          var e = o[id];
          if (!isObj(e) || !(Number(e.t) > 0)) return;
          var t = Number(e.t), coins = Number(e.coins) || 0, have = owned[id];
          if (!have || t < have.t || (t === have.t && coins > have.coins)) owned[id] = { t: t, coins: coins };
        });
      });
      var sorted = {};
      Object.keys(owned).sort().forEach(function (id) { sorted[id] = owned[id]; });
      return { v: 1, owned: sorted };
    },
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/sync.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/sync-core.js tests/sync.test.js
```

---

### Task 5: History label and backups

**Files:**
- Modify: `web/engine/study-history.js:211-215` (`purchased`), `:336` (`STATE_KEY_RE`)
- Modify: `web/engine/parent-panel.js:158` (label), `:702` (`savedState` keys)
- Modify: `tests/study-history.test.js`
- Create: `tests/world3d-wardrobe-wiring.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/study-history.test.js`, change the test `'a purchase remembers how it was approved: ...'` to:

```js
test('a purchase remembers how it was approved: the PIN, the parent\'s phone, or bought in the wardrobe boutique', () => {
  const { sh, storage } = setup();
  sh.purchased('ml', 'ML game', 40, 'phone');
  sh.purchased('ml', 'ML game', 40, 'pin');
  sh.purchased('crown', 'Crown', 700, 'wardrobe');
  sh.purchased('ml', 'ML game', 40, 'anything else');
  assert.deepEqual(saved(storage).map((e) => e.via), ['phone', 'pin', 'wardrobe', undefined]);
});

test('what she owns from the wardrobe rides along in a backup', () => {
  const { storage, clock } = setup();
  const sh = create(storage, clock.now, 'grade5');
  const owned = '{"v":1,"owned":{"crown":{"t":5,"coins":700}}}';
  const b = sh.backupState(sh.exportJson({ wallet_v1: '{"v":1}', wardrobe_v1: owned, avatar_v1: '{"v":1}' }));
  assert.equal(b.state.wardrobe_v1, owned);
  assert.equal(b.state.avatar_v1, undefined, 'the look itself is not backed up');
});
```

Create `tests/world3d-wardrobe-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile } = require('./paths.js');

const panel = fs.readFileSync(engineFile('parent-panel.js'), 'utf8');

test('the Parent panel backs up and restores what she owns from the wardrobe', () => {
  const keys = panel.match(/var keys = \[([^\]]+)\];/);
  assert.ok(keys && keys[1].includes("'wardrobe_v1'"), 'savedState() lists wardrobe_v1');
});

test('the Parent panel says where a wardrobe purchase came from', () => {
  assert.ok(panel.includes("e.via === 'wardrobe' ? ' · from the wardrobe boutique'"));
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/study-history.test.js tests/world3d-wardrobe-wiring.test.js`
Expected: FAIL.

- [ ] **Step 3: Change the code**

`web/engine/study-history.js`, in `api.purchased`, replace the comment and the `via` line:

```js
    // via: 'pin' (typed on the tablet), 'phone' (approved on the parent page) or 'wardrobe' (Lola Lana's Boutique).
    api.purchased = function (item, itemName, coins, via) {
      var e = { type: 'purchase', app: 'shop', appTitle: 'Shop', item: String(item), itemName: plain(itemName), coins: coins };
      if (via === 'pin' || via === 'phone' || via === 'wardrobe') e.via = via;
      return add(e);
    };
```

Line 336:

```js
    var STATE_KEY_RE = /^(?:[a-z0-9]+_points_v1|wallet_v1|recall_v1|review_v1|mastery_v1|quests_v1|boss_v1|practice_v1|wardrobe_v1)$/;
```

`web/engine/parent-panel.js:158`:

```js
      if (e.type === 'purchase') return '🛒 Bought ' + e.itemName + ' — ' + e.coins + ' coins' + (e.via === 'phone' ? " · approved on the parent's phone" : e.via === 'pin' ? ' · approved with the PIN on the tablet' : e.via === 'wardrobe' ? ' · from the wardrobe boutique' : '');
```

`web/engine/parent-panel.js:702`:

```js
        var keys = ['wallet_v1', 'recall_v1', 'review_v1', 'mastery_v1', 'quests_v1', 'boss_v1', 'practice_v1', 'wardrobe_v1'];
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/study-history.test.js tests/world3d-wardrobe-wiring.test.js tests/browser-globals.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/study-history.js web/engine/parent-panel.js tests/study-history.test.js tests/world3d-wardrobe-wiring.test.js
```

---

### Task 6: Words (`text.js`)

**Files:**
- Modify: `web/world/text.js`
- Modify: `tests/world3d-text.test.js`

- [ ] **Step 1: Update the test** — in `tests/world3d-text.test.js`, add these keys to `ENGLISH_ONLY`:

```js
  'lana', 'boutiqueGo', 'buy', 'yes', 'no', 'need', 'owned', 'shopMore',
  'tabs.me', 'tabs.clothes', 'tabs.hats', 'tabs.accessories', 'tabs.face', 'tabs.hair',
  'maker.none', 'maker.hairs.braids', 'maker.hairs.ponytail', 'maker.hairs.curly',
  'maker.eyesNames.round', 'maker.eyesNames.sleepy', 'maker.eyesNames.sparkly', 'maker.eyesNames.smiley',
```

and append:

```js
test('the boutique and the wardrobe have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['boutique', 'lanaHello', 'have', 'confirm', 'bought', 'notEnough', 'failed', 'paused']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.equal(TEXT[g].have.split('{n}').length - 1, g === 'grade2' ? 2 : 1, g + ' have names the coins in each half');
    assert.ok(TEXT[g].confirm.includes('{en}') && TEXT[g].confirm.includes('{coins}'), g + ' confirm');
    assert.ok(TEXT[g].need.includes('{n}'));
    assert.deepEqual(Object.keys(TEXT[g].maker.slots), ['clothes', 'hat', 'glasses', 'back', 'neck', 'sticker', 'paint', 'dye', 'shimmer']);
  }
  assert.ok(TEXT.grade2.confirm.includes('{fil}'), 'Grade 2 names the item in Filipino too');
  assert.equal(TEXT.grade5.confirm, 'Buy the {en} for {coins} coins?');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-text.test.js`
Expected: FAIL.

- [ ] **Step 3: Change `web/world/text.js`**

In `BUTTONS`, after `qualityNames: { auto: 'Auto', high: 'High', low: 'Low' }`, add (mind the comma on the line before):

```js
    qualityNames: { auto: 'Auto', high: 'High', low: 'Low' },
    lana: 'Lola Lana', boutiqueGo: "🧶 Open Lola Lana's Boutique", buy: 'Buy', yes: 'Yes', no: 'No',
    need: '{n} more coins', owned: '✓ Owned', shopMore: "🛍️ More at Lola Lana's",
    tabs: { me: 'Me', clothes: 'Clothes', hats: 'Hats', accessories: 'Accessories', face: 'Face', hair: 'Hair & Glitter' }
```

Replace `MAKER_BUTTONS` with:

```js
  var MAKER_BUTTONS = {
    done: 'Done ✨',
    none: 'None',
    bodies: { girl: 'Girl', boy: 'Boy' },
    hairs: { pigtails: 'Pigtails', bob: 'Bob', short: 'Short', braids: 'Braids', ponytail: 'Ponytail', curly: 'Curly' },
    pets: { chick: 'Chick', kitten: 'Kitten', puppy: 'Puppy' },
    eyesNames: { round: 'Round', sleepy: 'Sleepy', sparkly: 'Sparkly', smiley: 'Smiley' }
  };
```

In `TEXT.grade5`'s first object, after `sisterChoosing: ...,` add:

```js
      boutique: "Lola Lana's Boutique", lanaHello: 'Hello! Tap anything to try it on. 🧶',
      have: '🪙 You have {n} coins', confirm: 'Buy the {en} for {coins} coins?', bought: 'It is yours! 💖',
      notEnough: 'Not enough coins yet.', failed: 'Something went wrong. Try again.',
      paused: '⏰ Coins are paused until the tablet date is right.',
```

In `TEXT.grade5`'s maker object, after `petName: 'Pet name'`, add:

```js
      , eyes: 'Eyes', freckles: 'Freckles', blush: 'Blush',
      slots: { clothes: 'Clothes', hat: 'Hat', glasses: 'Glasses', back: 'On my back', neck: 'Neck', sticker: 'Sticker', paint: 'Face paint', dye: 'Special hair', shimmer: 'Body shimmer' }
```

(write it as `petName: 'Pet name', eyes: 'Eyes', ...` — one object, commas in place.)

In `TEXT.grade2`'s first object, after `sisterChoosing: ...,` add:

```js
      boutique: "Tindahan ng Damit ni Lola Lana · Lola Lana's Boutique",
      lanaHello: 'Kumusta! Pindutin ang kahit ano para isukat ito. 🧶 · Hello! Tap anything to try it on. 🧶',
      have: '🪙 Mayroon kang {n} coins · You have {n} coins',
      confirm: 'Bilhin ang {fil} sa halagang {coins} coins? · Buy the {en} for {coins} coins?',
      bought: 'Iyo na ito! 💖 · It is yours! 💖',
      notEnough: 'Kulang pa ang coins mo. · Not enough coins yet.',
      failed: 'May nangyaring mali. Subukan ulit. · Something went wrong. Try again.',
      paused: '⏰ Hihinto muna ang coins hanggang tama na ang petsa ng tablet. · Coins are paused until the tablet date is right.',
```

In `TEXT.grade2`'s maker object, after `petName: 'Pangalan ng alaga · Pet name'`, add:

```js
      , eyes: 'Mata · Eyes', freckles: 'Pekas · Freckles', blush: 'Pamumula ng pisngi · Blush',
      slots: {
        clothes: 'Damit · Clothes', hat: 'Sombrero · Hat', glasses: 'Salamin sa mata · Glasses', back: 'Sa likod · On my back',
        neck: 'Sa leeg · Neck', sticker: 'Sticker sa mukha · Sticker', paint: 'Pinta sa mukha · Face paint',
        dye: 'Espesyal na buhok · Special hair', shimmer: 'Kinang sa katawan · Body shimmer'
      }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-text.test.js`
Expected: PASS (the "same words" test passes because both grades got the same keys).

- [ ] **Step 5: Stage**

```bash
git add web/world/text.js tests/world3d-text.test.js
```

---

### Task 7: Drawing the items (`wear.js`)

**Files:**
- Create: `web/world/wear.js`
- Create: `tests/world3d-wear.test.js`
- Modify: `tests/paths.js:12`, both world pages

- [ ] **Step 1: Write the failing test** — `tests/world3d-wear.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Items = require(worldFile('items.js'));
const Wear = require(worldFile('wear.js'));
const Look = require(worldFile('look.js'));

const TABLE = { clothes: 'CLOTHES', hat: 'HATS', glasses: 'GLASSES', back: 'BACK', neck: 'NECK', sticker: 'STICKERS', paint: 'PAINTS', dye: 'DYE', shimmer: 'SHIMMER' };

test('every catalog item can be drawn (a new item fails here until wear.js draws it)', () => {
  for (const it of Items.ITEMS) {
    const table = Wear[TABLE[it.slot]];
    assert.ok(table && Object.prototype.hasOwnProperty.call(table, it.id), it.id + ' needs a ' + TABLE[it.slot] + ' entry in wear.js');
  }
});

test('wear.js draws nothing that is not in the catalog', () => {
  for (const [slot, name] of Object.entries(TABLE)) {
    for (const id of Object.keys(Wear[name])) assert.equal(Items.find(id) && Items.find(id).slot, slot, name + '.' + id);
  }
});

// A 2D canvas that accepts any drawing call, so the face painters can run in Node.
function fakeCtx() {
  const calls = [];
  return new Proxy({ calls }, {
    get: (t, k) => (k in t ? t[k] : (...args) => { calls.push(k); }),
    set: () => true,
  });
}

test('every eye shape, sticker and face paint paints without errors', () => {
  for (const eyes of Look.OPTIONS.eyes) {
    for (const it of Items.ITEMS.filter((i) => i.slot === 'sticker' || i.slot === 'paint')) {
      const look = Object.assign({}, Look.DEFAULT, { eyes, freckles: true, wear: Object.assign(Items.emptyWear(), { [it.slot]: it.id }) });
      const x = fakeCtx();
      Wear.paintFace(x, look, '#ffe0c7');
      assert.ok(x.calls.length > 10, eyes + ' ' + it.id);
    }
  }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-wear.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `web/world/wear.js`**

```js
/* What she wears, built from the same shapes as the rest of her: one builder per wardrobe item (items.js), the eyes
   and face extras painted onto her face picture, special hair materials, body shimmer and sparkles. avatar.js calls it.
   a = { body, head, tint, girl }: her body group and head group (the head centre sits 4.1 up the body); the
   character faces +z. A clothes builder draws her top half and returns her sleeve colour (null: bare arms). */
(function (root) {
  'use strict';
  var WHITE = '#ffffff', GOLD = '#ffd166', INK = '#3a2a4f', NAVY = '#2f3e75', DENIM = '#4a6fa5', SHORTS = '#4a5a8a';

  function pair(fn) { [-1, 1].forEach(fn); }
  function shorts(S, a, color) { S.add(S.rbox(1.8, 0.7, 1.4, 0.3), color, 0, 1.4, 0, a.body); }

  var CLOTHES = {
    hoodie: function (S, a) {
      S.add(S.cyl(0.88, 0.98, 1.6, 24), a.tint, 0, 2.3, 0, a.body);
      shorts(S, a, SHORTS);
      S.add(S.rbox(1.7, 0.9, 0.6, 0.28), a.tint, 0, 3.1, -0.75, a.body);
      S.add(S.rbox(1, 0.45, 0.12, 0.15), WHITE, 0, 2.0, 0.93, a.body);
      return a.tint;
    },
    overalls: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.5, 24), WHITE, 0, 2.3, 0, a.body);
      S.add(S.rbox(1.1, 1, 0.2, 0.1), DENIM, 0, 2.2, 0.85, a.body);
      pair(function (s) { S.add(S.rbox(0.18, 1.1, 0.12, 0.05), DENIM, s * 0.45, 2.75, 0.8, a.body); });
      shorts(S, a, DENIM);
      return null;
    },
    raincoat: function (S, a) {
      S.add(S.cyl(0.8, 1.2, 2.1, 24), '#ffd43b', 0, 2.05, 0, a.body);
      [2.6, 2.1, 1.6].forEach(function (y) { S.add(S.ball(0.12), '#ff8c1a', 0, y, 0.95, a.body); });
      return '#ffd43b';
    },
    jersey: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.5, 24), a.tint, 0, 2.3, 0, a.body);
      S.add(S.cyl(0.4, 0.4, 0.06, 20), WHITE, 0, 2.4, 0.9, a.body).rotation.x = Math.PI / 2;
      S.add(S.rbox(0.12, 0.45, 0.05, 0.03), INK, 0, 2.4, 0.95, a.body);
      shorts(S, a, a.tint);
      return null;
    },
    uniform: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.2, 24), WHITE, 0, 2.45, 0, a.body);
      if (a.girl) S.add(S.cyl(0.95, 1.2, 0.9, 24), NAVY, 0, 1.55, 0, a.body);
      else shorts(S, a, NAVY);
      S.add(S.cone(0.25, 0.6, 4), NAVY, 0, 2.6, 0.92, a.body).rotation.x = Math.PI;
      return WHITE;
    },
    princess: function (S, a) {
      S.add(S.cyl(0.7, 1.5, 2.0, 32), a.tint, 0, 2.0, 0, a.body);
      S.add(S.torus(0.78, 0.1, 8, 32), GOLD, 0, 2.55, 0, a.body).rotation.x = Math.PI / 2;
      pair(function (s) { S.add(S.ball(0.42), a.tint, s * 0.95, 2.85, 0, a.body); });
      S.add(S.ball(0.16), GOLD, 0, 2.75, 0.75, a.body);
      return null;
    },
    hero: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.5, 24), '#4361ee', 0, 2.3, 0, a.body);
      shorts(S, a, '#4361ee');
      S.add(S.rbox(2.1, 2.4, 0.1, 0.08), '#ef233c', 0, 2.0, -1.0, a.body).rotation.x = 0.12;
      S.add(S.cone(0.32, 0.12, 5), GOLD, 0, 2.6, 0.92, a.body).rotation.x = Math.PI / 2;
      return '#4361ee';
    },
    filipiniana: function (S, a) {
      if (a.girl) {
        S.add(S.cyl(0.75, 1.3, 2.0, 32), '#fff4d6', 0, 2.0, 0, a.body);
        pair(function (s) { S.add(S.ball(0.6), '#fffbe9', s * 1.0, 3.0, 0, a.body).scale.set(0.9, 0.55, 0.9); });
        return null;
      }
      S.add(S.cyl(0.85, 0.95, 1.6, 24), '#fffbe6', 0, 2.3, 0, a.body);
      [-0.3, 0, 0.3].forEach(function (x) { S.add(S.rbox(0.06, 1.1, 0.04, 0.02), '#e0c48a', x, 2.4, 0.92, a.body); });
      shorts(S, a, INK);
      return '#fffbe6';
    }
  };

  var HATS = {
    cap: function (S, a) {
      S.add(S.cyl(1.35, 1.42, 0.7, 24), '#ff6f91', 0, 1.45, 0, a.head);
      S.add(S.rbox(1.6, 0.12, 1.2, 0.05), '#ff6f91', 0, 1.15, 1.3, a.head);
    },
    sunhat: function (S, a) {
      S.add(S.cyl(2.2, 2.2, 0.12, 32), '#ffe8a3', 0, 1.3, 0, a.head);
      S.add(S.cyl(1.2, 1.35, 0.9, 24), '#ffe8a3', 0, 1.75, 0, a.head);
      S.add(S.torus(1.3, 0.1, 8, 32), '#ff8fab', 0, 1.45, 0, a.head).rotation.x = Math.PI / 2;
    },
    beanie: function (S, a) {
      S.add(S.ball(1.45), a.tint, 0, 1.15, 0, a.head).scale.set(1, 0.7, 1);
      S.add(S.ball(0.35), WHITE, 0, 2.2, 0, a.head);
    },
    flowercrown: function (S, a) {
      S.add(S.torus(1.35, 0.08, 8, 32), '#5fcf9a', 0, 1.35, 0, a.head).rotation.x = Math.PI / 2;
      for (var k = 0; k < 8; k++) {
        var ang = k * Math.PI / 4;
        S.add(S.ball(0.25), k % 2 ? '#ff8fc8' : '#ffe066', Math.sin(ang) * 1.35, 1.4, Math.cos(ang) * 1.35, a.head);
      }
    },
    bunnyears: function (S, a) {
      S.add(S.torus(1.35, 0.08, 8, 32), '#ff8fab', 0, 1.4, 0, a.head).rotation.x = Math.PI / 2 + 0.4;
      pair(function (s) {
        S.add(S.rbox(0.45, 1.7, 0.3, 0.2), WHITE, s * 0.55, 2.4, 0, a.head).rotation.z = -s * 0.15;
        S.add(S.rbox(0.25, 1.3, 0.1, 0.1), '#ffb3c7', s * 0.55, 2.35, 0.13, a.head).rotation.z = -s * 0.15;
      });
    },
    wizard: function (S, a) {
      S.add(S.cyl(2, 2, 0.12, 32), '#7b5cff', 0, 1.35, 0, a.head);
      S.add(S.cone(1.3, 2.6, 24), '#7b5cff', 0, 2.65, 0, a.head);
      S.add(S.ball(0.22), GOLD, 0, 3.95, 0, a.head);
    },
    salakot: function (S, a) {
      S.add(S.cone(2.4, 1.1, 24), '#d9a066', 0, 1.95, 0, a.head);
      S.add(S.cyl(0.2, 0.25, 0.3, 12), '#b5835a', 0, 2.55, 0, a.head);
    },
    crown: function (S, a) {
      S.add(S.cyl(1.05, 1.1, 0.5, 24), GOLD, 0, 1.55, 0, a.head);
      for (var k = 0; k < 5; k++) {
        var ang = k * Math.PI * 2 / 5;
        S.add(S.cone(0.25, 0.55, 4), GOLD, Math.sin(ang) * 0.95, 2.05, Math.cos(ang) * 0.95, a.head);
      }
      S.add(S.ball(0.16), '#ff6f91', 0, 1.6, 1.08, a.head);
    }
  };

  var GLASSES = {
    roundglasses: function (S, a) {
      pair(function (s) { S.add(S.torus(0.4, 0.07, 8, 24), INK, s * 0.62, 0.05, 1.26, a.head); });
      S.add(S.rbox(0.45, 0.08, 0.08, 0.03), INK, 0, 0.1, 1.26, a.head);
    },
    starglasses: function (S, a) {
      pair(function (s) { S.add(S.cone(0.5, 0.1, 5), '#ff6f91', s * 0.62, 0.05, 1.28, a.head).rotation.x = Math.PI / 2; });
      S.add(S.rbox(0.45, 0.08, 0.08, 0.03), '#ff6f91', 0, 0.1, 1.28, a.head);
    }
  };

  function wings(S, a, colors, opts) {
    pair(function (s) {
      var up = S.add(S.ball(0.9), S.toon(colors[0], opts), s * 0.85, 3.0, -1.05, a.body);
      up.scale.set(0.9, 1.1, 0.12);
      up.rotation.z = s * 0.5;
      var low = S.add(S.ball(0.6), S.toon(colors[1], opts), s * 0.7, 2.05, -1.05, a.body);
      low.scale.set(0.9, 1, 0.12);
      low.rotation.z = -s * 0.3;
    });
  }
  var BACK = {
    backpack: function (S, a) {
      S.add(S.rbox(1.4, 1.5, 0.7, 0.3), '#5fcf9a', 0, 2.4, -1.05, a.body);
      S.add(S.rbox(1, 0.6, 0.2, 0.15), '#ffd166', 0, 2.1, -1.45, a.body);
    },
    angelwings: function (S, a) { wings(S, a, [WHITE, '#f3f6ff']); },
    butterflywings: function (S, a) { wings(S, a, ['#ff9e3d', '#2b2140']); },
    fairywings: function (S, a) { wings(S, a, ['#bfe6ff', '#e7d4ff'], { transparent: true, opacity: 0.75, emissive: '#bfe6ff', emissiveIntensity: 0.3 }); }
  };

  var NECK = {
    scarf: function (S, a) {
      S.add(S.torus(0.85, 0.22, 10, 28), a.tint, 0, 3.05, 0, a.body).rotation.x = Math.PI / 2;
      S.add(S.rbox(0.4, 0.9, 0.2, 0.1), a.tint, 0.45, 2.6, 0.85, a.body);
    },
    bowtie: function (S, a) {
      pair(function (s) { S.add(S.cone(0.25, 0.45, 12), '#ef233c', s * 0.25, 3.0, 0.88, a.body).rotation.z = s * Math.PI / 2; });
      S.add(S.ball(0.12), '#ef233c', 0, 3.0, 0.92, a.body);
    }
  };

  function extras(S, a, wear) {
    [['hat', HATS], ['glasses', GLASSES], ['back', BACK], ['neck', NECK]].forEach(function (p) {
      var f = p[1][wear[p[0]]];
      if (f) f(S, a);
    });
  }
  // undefined: no clothes item, so avatar.js draws her own outfit.
  function clothes(S, a, id) { return CLOTHES[id] ? CLOTHES[id](S, a) : undefined; }

  // ---- the face, on a 256px canvas: eyes at (86,132) and (170,132), cheeks at (52,178) and (204,178) ----
  var EYE = '#3a2a4f';
  function star(x, cx, cy, r, points, inner) {
    x.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var ang = i * Math.PI / points - Math.PI / 2, rr = i % 2 ? r * inner : r;
      x.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    }
    x.closePath();
    x.fill();
  }
  function heart(x, cx, cy, r) {
    x.beginPath();
    x.arc(cx - r / 2, cy, r / 2, Math.PI, 0);
    x.arc(cx + r / 2, cy, r / 2, Math.PI, 0);
    x.lineTo(cx, cy + r * 1.1);
    x.closePath();
    x.fill();
  }

  function eye(x, kind, ex, ey, skin) {
    if (kind === 'smiley') {
      x.strokeStyle = EYE; x.lineWidth = 9; x.lineCap = 'round';
      x.beginPath(); x.arc(ex, ey + 8, 18, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke();
      return;
    }
    var big = kind === 'sparkly' ? 1.18 : 1;
    x.fillStyle = EYE; x.beginPath(); x.ellipse(ex, ey, 22 * big, 30 * big, 0, 0, 7); x.fill();
    x.fillStyle = '#7b5cff'; x.beginPath(); x.ellipse(ex, ey + 8, 16 * big, 18 * big, 0, 0, 7); x.fill();
    x.fillStyle = '#ffffff';
    if (kind === 'sparkly') star(x, ex + 9, ey - 12, 12, 4, 0.35);
    else { x.beginPath(); x.arc(ex + 8, ey - 12, 9, 0, 7); x.fill(); }
    x.beginPath(); x.arc(ex - 8, ey + 10, 4, 0, 7); x.fill();
    if (kind === 'sleepy') {
      x.fillStyle = skin; x.fillRect(ex - 30, ey - 36, 60, 34);
      x.strokeStyle = EYE; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.moveTo(ex - 24, ey - 2); x.lineTo(ex + 24, ey - 2); x.stroke();
    }
  }

  var STICKERS = {
    heartsticker: function (x) { x.fillStyle = '#ff4d88'; heart(x, 206, 92, 26); },
    starsticker: function (x) { x.fillStyle = '#ffd43b'; star(x, 206, 98, 20, 5, 0.45); },
    rainbowsticker: function (x) {
      ['#ff6f91', '#ffd166', '#5fcf9a', '#6aa9ff'].forEach(function (c, i) {
        x.strokeStyle = c; x.lineWidth = 5;
        x.beginPath(); x.arc(206, 186, 26 - i * 5, Math.PI, 0); x.stroke();
      });
    },
    sparklecheeks: function (x) {
      [[44, 172], [64, 190], [212, 172], [192, 190]].forEach(function (p, i) {
        x.fillStyle = i % 2 ? '#ffffff' : '#fff3a3';
        star(x, p[0], p[1], 9, 4, 0.3);
      });
    }
  };

  var PAINTS = {
    whiskers: function (x) {
      x.strokeStyle = EYE; x.lineWidth = 4; x.lineCap = 'round';
      [-10, 0, 10].forEach(function (dy) {
        x.beginPath(); x.moveTo(30, 178 + dy * 1.5); x.lineTo(72, 182 + dy); x.stroke();
        x.beginPath(); x.moveTo(226, 178 + dy * 1.5); x.lineTo(184, 182 + dy); x.stroke();
      });
    },
    flag: function (x) {
      x.fillStyle = '#0038a8'; x.fillRect(30, 160, 44, 14);
      x.fillStyle = '#ce1126'; x.fillRect(30, 174, 44, 14);
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(30, 160); x.lineTo(50, 174); x.lineTo(30, 188); x.closePath(); x.fill();
      x.fillStyle = '#fcd116'; x.beginPath(); x.arc(37, 174, 3, 0, 7); x.fill();
    },
    butterfly: function (x) {
      [['#a77bff', -12, -10], ['#a77bff', 12, -10], ['#ff8fc8', -9, 10], ['#ff8fc8', 9, 10]].forEach(function (w) {
        x.fillStyle = w[0]; x.beginPath(); x.ellipse(206 + w[1], 178 + w[2], 11, 9, 0, 0, 7); x.fill();
      });
      x.fillStyle = EYE; x.fillRect(205, 166, 3, 24);
    },
    tiger: function (x) {
      x.fillStyle = '#ff8c1a';
      [[100, 0], [128, 0], [156, 0]].forEach(function (p) {
        x.beginPath(); x.moveTo(p[0] - 10, 0); x.lineTo(p[0] + 10, 0); x.lineTo(p[0], 40); x.closePath(); x.fill();
      });
      [[0, 150], [0, 190], [256, 150], [256, 190]].forEach(function (p) {
        var dir = p[0] ? -1 : 1;
        x.beginPath(); x.moveTo(p[0], p[1] - 8); x.lineTo(p[0], p[1] + 8); x.lineTo(p[0] + dir * 40, p[1]); x.closePath(); x.fill();
      });
    }
  };

  // Paints everything on her face but the mouth: face paint, blush, freckles, a sticker, then the eyes on top.
  function paintFace(x, look, skin) {
    var wear = look.wear || {};
    if (PAINTS[wear.paint]) PAINTS[wear.paint](x);
    if (look.blush !== false) {
      x.fillStyle = 'rgba(255,120,160,.55)';
      x.beginPath(); x.ellipse(52, 178, 22, 12, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(204, 178, 22, 12, 0, 0, 7); x.fill();
    }
    if (look.freckles) {
      x.fillStyle = 'rgba(160,100,60,.7)';
      [[60, 166], [72, 176], [54, 182], [196, 166], [184, 176], [202, 182]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 3.5, 0, 7); x.fill(); });
    }
    if (STICKERS[wear.sticker]) STICKERS[wear.sticker](x);
    [86, 170].forEach(function (ex) { eye(x, look.eyes, ex, 132, skin); });
  }

  // ---- hair and skin ----
  function stripes(S, key, colors, opts) {
    var cache = S.wearMats = S.wearMats || {};
    if (cache[key]) return cache[key];
    var c = root.document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    colors.forEach(function (col, i) { g.addColorStop(i / (colors.length - 1), col); });
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
    cache[key] = new S.THREE.MeshToonMaterial(Object.assign({ map: S.canvasTexture(c), gradientMap: S.ramp }, opts || {}));
    return cache[key];
  }
  var DYE = {
    goldhair: function (S) { return S.toon('#f2c14e', { emissive: '#6b4a00', emissiveIntensity: 0.25 }); },
    pasteltips: function (S, base) { return stripes(S, 'pastel' + base, [base, base, '#ffc6e0', '#c8b6ff']); },
    glitterhair: function (S, base) { return S.toon(base, { emissive: '#ffffff', emissiveIntensity: 0.18 }); },
    rainbowhair: function (S) { return stripes(S, 'rainbow', ['#ff6f91', '#ffb347', '#ffe066', '#7ddc8b', '#6aa9ff', '#a77bff']); },
    galaxyhair: function (S) { return stripes(S, 'galaxy', ['#1d1640', '#3b2a8f', '#7b5cff', '#2b2140'], { emissive: '#3b2a8f', emissiveIntensity: 0.35 }); }
  };
  // A material for her hair: her own colour, or the dye she wears.
  function hairMaterial(S, dye, base) { return DYE[dye] ? DYE[dye](S, base) : S.toon(base); }

  var SHIMMER = { goldshimmer: '#ffd166', pinkshimmer: '#ff8fc8', silvershimmer: '#dfe7f2' };
  function skinMaterial(S, skin, shimmer) {
    return SHIMMER[shimmer] ? S.toon(skin, { emissive: SHIMMER[shimmer], emissiveIntensity: 0.18 }) : S.toon(skin);
  }

  // Twinkling ✨ on her body (shimmer) and in her hair (glitter hair); hidden in low quality, like the scenery details.
  function sparkles(S, a, wear) {
    var spots = [];
    if (SHIMMER[wear.shimmer]) spots = [[-1.2, 2.2, 0.6, a.body], [1.2, 2.8, 0.4, a.body], [0, 1.4, 0.9, a.body], [-0.9, 3.4, -0.5, a.body]];
    if (wear.dye === 'glitterhair') spots = spots.concat([[-1, 1.3, 0.6, a.head], [1.1, 0.9, 0, a.head], [0, 1.7, -0.6, a.head]]);
    var tex = S.wearSpark || (S.wearSpark = S.emoji('✨'));
    var list = spots.map(function (p, i) {
      var s = S.sprite(tex, 0.5, 0.5);
      s.position.set(p[0], p[1], p[2]);
      s.userData.phase = i * 1.3;
      p[3].add(s);
      return s;
    });
    return {
      animate: function (t) {
        list.forEach(function (s) {
          s.visible = S.detail.visible;
          var k = 0.35 + Math.abs(Math.sin(t * 3 + s.userData.phase)) * 0.35;
          s.scale.set(k, k, 1);
        });
      },
      dispose: function () { list.forEach(function (s) { s.material.dispose(); }); }
    };
  }

  var exported = {
    CLOTHES: CLOTHES, HATS: HATS, GLASSES: GLASSES, BACK: BACK, NECK: NECK, STICKERS: STICKERS, PAINTS: PAINTS, DYE: DYE, SHIMMER: SHIMMER,
    clothes: clothes, extras: extras, paintFace: paintFace, hairMaterial: hairMaterial, skinMaterial: skinMaterial, sparkles: sparkles
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Wear = exported;
})(this);
```

- [ ] **Step 4: Wire it**

In `tests/paths.js:12`: `'ask.js', 'avatar.js',` → `'ask.js', 'wear.js', 'avatar.js',`.
In both world pages, add `<script src="wear.js"></script>` right before `<script src="avatar.js"></script>`.
Run: `node tools/update-precache.js`

- [ ] **Step 5: Run the tests**

Run: `node --test tests/world3d-wear.test.js tests/world3d-wiring.test.js tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add web/world/wear.js tests/world3d-wear.test.js tests/paths.js web/world/grade-2.html web/world/grade-5.html web/sw.js web/world/lesson-files.js
```

---

### Task 8: She wears it (`avatar.js`, `world-main.js`, `kin.js`)

**Files:**
- Modify: `web/world/avatar.js` (whole `faceTexture` and `character`)
- Modify: `web/world/world-main.js:104-113` (`dress`), `:144-161` (`openMaker` `onChange`/`onDone`), `:378` (first `dress`)
- Modify: `web/world/kin.js:163-164`

No new unit test: the drawing is covered by Task 7's tests and Task 12's e2e. Run the existing e2e at the end.

- [ ] **Step 1: Replace `faceTexture` and `character` in `web/world/avatar.js`**

Replace the header comment, the constants line, `faceTexture`, and `character` (up to, not including, `function pet`)
with:

```js
/* Her chibi character, built from avatar_v1 parts (body, skin, hair style and colour, eyes, freckles, blush, outfit
   colour) and what she wears (wear.js), and her pet. Pass a look already filtered by Items.wearable(). The character
   faces local +z. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SHOE = '#ffffff', SHORTS = '#4a5a8a', BOW = '#ff6f91', KNOT = '#ffd166', EYE = '#3a2a4f';

  function faceTexture(S, look, skin) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = skin;
    x.fillRect(0, 0, 256, 256);
    W.Wear.paintFace(x, look, skin);
    x.fillStyle = BOW;
    x.beginPath(); x.moveTo(114, 176); x.quadraticCurveTo(128, 200, 142, 176); x.closePath(); x.fill();
    return S.canvasTexture(c);
  }

  function character(S, look) {
    var THREE = S.THREE, L = W.Look, Wr = W.Wear, add = S.add, rbox = S.rbox, ball = S.ball;
    var wear = look.wear || {};
    var skin = L.color(look, 'skin'), cloth = L.color(look, 'outfit'), girl = look.body === 'girl';
    var hair = Wr.hairMaterial(S, wear.dye, L.color(look, 'hairColor'));
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    var head = new THREE.Group();
    head.position.y = 4.1;
    body.add(head);

    var skinMat = Wr.skinMaterial(S, skin, wear.shimmer);
    var face = new THREE.MeshToonMaterial({ map: faceTexture(S, look, skin), gradientMap: S.ramp });
    add(rbox(2.6, 2.4, 2.4, 0.9), [skinMat, skinMat, skinMat, skinMat, face, skinMat], 0, 0, 0, head);
    add(rbox(2.8, 1.1, 2.6, 0.5), hair, 0, 0.95, -0.1, head);
    add(rbox(0.9, 0.7, 0.6, 0.3), hair, -0.75, 0.55, 1.05, head).rotation.z = 0.3;
    if (look.hair !== 'short' && look.hair !== 'curly') add(rbox(2.8, 1.8, 0.9, 0.45), hair, 0, 0.1, -1.0, head);
    if (look.hair === 'pigtails') {
      [-1, 1].forEach(function (s) {
        add(ball(0.6), hair, s * 1.6, -0.3, -0.6, head).scale.set(0.8, 1.3, 0.8);
        add(ball(0.32), KNOT, s * 1.45, 0.25, -0.6, head);
      });
    }
    if (look.hair === 'bob') {
      [-1, 1].forEach(function (s) { add(rbox(0.5, 2, 2.2, 0.25), hair, s * 1.4, -0.2, -0.1, head); });
    }
    if (look.hair === 'braids') {
      [-1, 1].forEach(function (s) {
        for (var k = 0; k < 3; k++) add(ball(0.42 - k * 0.05), hair, s * 1.3, -0.2 - k * 0.62, -0.55, head);
        add(ball(0.2), KNOT, s * 1.3, -1.75, -0.55, head);
      });
    }
    if (look.hair === 'ponytail') {
      add(ball(0.26), KNOT, 0, 0.75, -1.2, head);
      for (var p = 0; p < 3; p++) add(ball(0.55 - p * 0.08), hair, 0, 0.7 - p * 0.6, -1.5 - p * 0.05, head);
    }
    if (look.hair === 'curly') {
      [[0, 1.4, 0], [-0.85, 1.25, 0.35], [0.85, 1.25, 0.35], [-0.85, 1.25, -0.6], [0.85, 1.25, -0.6], [0, 1.3, -0.85],
        [-1.35, 0.3, -0.3], [1.35, 0.3, -0.3], [0, 0.5, -1.3]].forEach(function (c) { add(ball(0.65), hair, c[0], c[1], c[2], head); });
    }
    var a = { body: body, head: head, tint: cloth, girl: girl };
    if (girl && !wear.hat) {
      var bow = new THREE.Group();
      bow.position.set(0.9, 1.45, 0.3);
      bow.rotation.z = -0.3;
      head.add(bow);
      add(ball(0.5), BOW, -0.45, 0, 0, bow).scale.set(1, 0.7, 0.5);
      add(ball(0.5), BOW, 0.45, 0, 0, bow).scale.set(1, 0.7, 0.5);
      add(ball(0.22), KNOT, 0, 0, 0.1, bow);
    }
    var sleeve = Wr.clothes(S, a, wear.clothes);
    if (sleeve === undefined) {
      if (girl) {
        add(S.cyl(0.75, 1.15, 1.9, 24), cloth, 0, 2.05, 0, body);
        add(S.torus(1.05, 0.14, 8, 32), '#ffffff', 0, 1.2, 0, body).rotation.x = Math.PI / 2;
        sleeve = null;
      } else {
        add(S.cyl(0.85, 0.95, 1.5, 24), cloth, 0, 2.3, 0, body);
        add(rbox(1.8, 0.7, 1.4, 0.3), SHORTS, 0, 1.4, 0, body);
        sleeve = cloth;
      }
      add(ball(0.18), '#ffffff', 0, 2.5, 0.85, body);
    }
    Wr.extras(S, a, wear);

    function limb(color, x, y, len, r) {
      var p = new THREE.Group();
      p.position.set(x, y, 0);
      body.add(p);
      add(rbox(r * 2, len, r * 2, r * 0.95), color, 0, -len / 2, 0, p);
      return p;
    }
    var armL = limb(sleeve || skinMat, -0.95, 2.75, 1.2, 0.27), armR = limb(sleeve || skinMat, 0.95, 2.75, 1.2, 0.27);
    var legL = limb(skinMat, -0.38, 1.15, 1.05, 0.3), legR = limb(skinMat, 0.38, 1.15, 1.05, 0.3);
    [legL, legR].forEach(function (l) { add(rbox(0.7, 0.4, 0.85, 0.18), SHOE, 0, -1.05, 0.1, l); });
    var shine = Wr.sparkles(S, a, wear);

    var blob = new THREE.Mesh(S.circle(1.2, 24), S.shadowBlob);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.13;
    group.add(blob);

    // pose (optional): { sit } on a ride, { cheer } both arms up, { wave } her sister by the gate.
    function animate(t, walkT, mag, pose) {
      var m = Math.min(1, mag), sw = Math.sin(walkT) * 0.7 * m, hop = Math.abs(Math.sin(walkT));
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw; armR.rotation.x = sw;
      armL.rotation.z = -0.25; armR.rotation.z = 0.25;
      body.position.y = hop * 0.25 * Math.min(1, m * 2);
      body.scale.set(1 + (1 - hop) * 0.04 * m, 1 - (1 - hop) * 0.05 * m, 1);
      if (pose && pose.sit) {
        legL.rotation.x = legR.rotation.x = -1.45;
        armL.rotation.x = armR.rotation.x = -0.6;
      }
      if (pose && pose.cheer) {
        armL.rotation.z = -2.6 + Math.sin(t * 9) * 0.2;
        armR.rotation.z = 2.6 - Math.sin(t * 9) * 0.2;
      }
      if (pose && pose.wave) armR.rotation.z = 2.4 + Math.sin(t * 8) * 0.4;
      head.rotation.z = Math.sin(t * 1.6) * 0.05;
      head.position.y = 4.1 + Math.sin(t * 2.2) * 0.05;
      shine.animate(t);
    }

    function dispose() {
      face.map.dispose();
      face.dispose();
      shine.dispose();
    }

    return { group: group, animate: animate, dispose: dispose };
  }
```

Note: `EYE` is still used by `pet()` below; leave `pet()` and the `W.Avatar` export unchanged.

- [ ] **Step 2: Draw only what she owns, in `web/world/world-main.js`**

Add a helper right above `function dress(l) {`:

```js
    function worn(l) { return W.Items.wearable(l, W.Closet.read(store)); }
```

In `openMaker`, change `onChange: dress,` to `onChange: function (l) { dress(worn(l)); },` and in its `onDone`, change
`dress(look);` to `dress(worn(look));`. Near the end of `start()`, change the first `dress(look);` (right after
`refresh();`) to `dress(worn(look));`.

- [ ] **Step 3: Her sister keeps her saved look, in `web/world/kin.js:163-164`**

```js
        var sp = spots[i], lk = W.Items.wearable(W.Look.clean(s.look), null), made = lk.t > 0, name = s.name || english(FT[s.rel] || FT.sister);
        var ch = W.Avatar.character(S, lk), pet = W.Avatar.pet(S, lk.pet);
```

- [ ] **Step 4: Run the existing world e2e and unit tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: all PASS (nothing she can see changed for a look with no wardrobe items).

- [ ] **Step 5: Stage**

```bash
git add web/world/avatar.js web/world/world-main.js web/world/kin.js
```

---

### Task 9: The stall and Lola Lana (`layout.js`, `build.js`, `cast.js`, `folk.js`)

**Files:**
- Modify: `web/world/layout.js` (`props`, `obstacles`, `interactables`)
- Modify: `web/world/build.js` (new `stall()` after `shop()`)
- Modify: `web/world/cast.js` (new `lana()`, export)
- Modify: `web/world/folk.js`
- Modify: `web/world/world-main.js` (folk option `boutique`)
- Modify: `tests/world3d-layout.test.js`

- [ ] **Step 1: Write the failing layout tests** — append to `tests/world3d-layout.test.js`

```js
for (const grade of ['grade5', 'grade2']) {
  test(grade + ': Lola Lana\'s Boutique stands in Shop Plaza, clear of Bunny\'s counter, and can be walked up to', () => {
    const pr = L.props(grade), shop = L.places(grade).shop, items = L.interactables(grade);
    const lana = items.find((i) => i.id === 'boutique');
    assert.ok(lana && lana.kind === 'boutique', 'boutique item');
    assert.ok(Math.hypot(pr.lana.x - shop.x, pr.lana.z - shop.z) <= shop.r, 'Lola Lana is in Shop Plaza');
    assert.equal(L.nearest(items, lana.x, lana.z).id, 'boutique');
    const counter = items.find((i) => i.id === 'counter');
    assert.equal(L.nearest(items, counter.x, counter.z).id, 'counter', 'the counter still finds Bunny');
    assert.equal(L.blocked(L.obstacles(grade), L.GRADES[grade].bounds, lana.x, lana.z, L.PLAYER_R), false, 'she can stand there');
    assert.equal(L.blocked(L.obstacles(grade), L.GRADES[grade].bounds, pr.stall.x, pr.stall.z, 0.1), true, 'the stall is solid');
    assert.ok(!L.onPath(grade, pr.stall.x, pr.stall.z, pr.stall.hz), 'the stall is off the path');
  });
}
```

The existing test `'every place, door, mirror and signpost can be walked to from the gate'` already walks to every
interactable, so it covers the new `boutique` item with no change.

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/world3d-layout.test.js`
Expected: FAIL (`pr.lana` undefined, no `boutique` item).

- [ ] **Step 3: Layout** — in `web/world/layout.js`:

In `props()`, after `shop: { x: 68, z: 0, hx: 6, hz: 6 },` add:

```js
      stall: { x: 61, z: -9.5, hx: 2, hz: 1.5 },
      lana: { x: 57.8, z: -9.5, r: 0.8 },
```

In `obstacles()`, add `pr.stall` to the boxes list and `pr.lana` to the circles list:

```js
      .concat([pr.bench, pr.shop, pr.stall, pr.house, pr.slide, pr.swings, pr.seesaw, pr.hoot]);
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mimi, pr.mirror, pr.pond, pr.merry, pr.lamb, pr.lana].concat(pr.posts,
```

In `interactables()`, after the `counter` line add:

```js
    list.push({ kind: 'boutique', id: 'boutique', x: pr.lana.x - 2.2, z: pr.lana.z, r: 2.6 });
```

- [ ] **Step 4: Run the layout tests**

Run: `node --test tests/world3d-layout.test.js`
Expected: PASS.

- [ ] **Step 5: The stall** — in `web/world/build.js`, add after the `shop()` function:

```js
    // Lola Lana's Boutique: a striped stall south of the shop; its front faces west, toward the path.
    function stall() {
      var s = pr.stall, g = group(s.x, s.z, -Math.PI / 2);
      add(rbox(s.hz * 2, 1.3, s.hx * 2, 0.3), '#ffd6e7', 0, 0.65, 0, g);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) { add(S.cyl(0.1, 0.1, 3.6, 8), '#ffffff', c[0] * (s.hz - 0.2), 1.8, c[1] * (s.hx - 0.2), g); });
      for (var k = 0; k < 5; k++) add(rbox(0.6, 0.3, s.hx * 2 + 0.4, 0.1), k % 2 ? '#ffffff' : '#ff8fc8', -1.2 + k * 0.6, 3.7, 0, g);
      ['#ff8fc8', '#6aa9ff', '#ffd166'].forEach(function (c, i) { add(ball(0.3), c, -0.6 + i * 0.6, 1.6, s.hx - 0.6, g); });
      floatSign('🧶 ' + T.boutique, '#ff8fc8', 0, 6, 0, 6 * cfg.signScale, g);
    }
```

and call `stall();` on the line after `shop();` in the build sequence near the end of `build()`. (`ball` is the scene
helper already used elsewhere in `build.js`; if it is not in scope there, use `S.ball`.)

- [ ] **Step 6: Lola Lana** — in `web/world/cast.js`, add before the final `W.Cast = ...` line:

```js
  // Lola Lana, the sheep tailor of the boutique: woolly puffs, round glasses and a gold measuring tape round her neck.
  function lana(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, WOOL = '#fffaf2', FACE = '#f3d9c4';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    [[0, 1.1, 0, 0.85], [0.55, 1.25, 0.1, 0.55], [-0.55, 1.25, 0.1, 0.55], [0, 1.5, -0.3, 0.6], [0, 0.6, 0.2, 0.6]].forEach(function (p) {
      add(ball(p[3]), WOOL, p[0], p[1], p[2], body);
    });
    add(S.torus(0.62, 0.08, 8, 24), '#ffd166', 0, 2.05, 0, body).rotation.x = Math.PI / 2;
    add(S.rbox(0.18, 0.9, 0.05, 0.03), '#ffd166', 0.3, 1.6, 0.6, body);
    [-0.35, 0.35].forEach(function (x) { add(S.cyl(0.14, 0.14, 0.6, 10), '#5a4a52', x, 0.3, 0, body); });
    var top = head(S, FACE, { mouth: 'muzzle', glasses: true }, 1.7, 1.6, 1.5, 0.65);
    top.position.y = 2.75;
    body.add(top);
    [[-0.5, 0.75, 0, 0.42], [0.5, 0.75, 0, 0.42], [0, 0.95, -0.2, 0.45]].forEach(function (p) { add(ball(p[3]), WOOL, p[0], p[1], p[2], top); });
    [-1, 1].forEach(function (s) { add(ball(0.28), FACE, s * 0.95, 0.25, 0, top).scale.set(1.4, 0.6, 0.6); });
    return life(group, body, top, 0.7);
  }
```

and add `lana: lana` to the export:

```js
  W.Cast = { mimi: mimi, buddy: buddy, hoot: hoot, bunny: bunny, lana: lana, treeFace: treeFace, jesus: jesus, lamb: lamb, head: head };
```

- [ ] **Step 7: Folk hosts Lola Lana** — in `web/world/folk.js`:

Update the options comment to add `boutique()`:

```js
  // o = { S, grade, T, store, today(), busy(on), door(app, kind) → href, open(app, href), shop(), boutique(), cheer(x, z), changed(), textOf(html) }
```

After the `bunny` line, add:

```js
    var lana = place(W.Cast.lana(S), pr.lana.x, pr.lana.z, -Math.PI / 2);
```

In `label(it)`, before `return null;`:

```js
      if (it.kind === 'boutique') return T.boutiqueGo;
```

In `act(it)`, add a branch:

```js
      else if (it.kind === 'boutique') o.boutique();
```

In `tick(t)`, after `bunny.char.animate(t);`:

```js
      lana.animate(t);
```

In `handles`:

```js
      handles: function (kind) { return kind === 'buddy' || kind === 'hoot' || kind === 'counter' || kind === 'tree' || kind === 'boutique'; },
```

- [ ] **Step 8: Give folk the callback** — in `web/world/world-main.js`, in the `W.Folk.create({...})` options, after
the `shop:` line add:

```js
      boutique: function () { openBoutique(); },
```

and add a temporary no-op so the page still runs until Task 10 replaces it, right above `function openMaker() {`:

```js
    function openBoutique() {}
```

- [ ] **Step 9: Run tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 10: Stage**

```bash
git add web/world/layout.js web/world/build.js web/world/cast.js web/world/folk.js web/world/world-main.js tests/world3d-layout.test.js
```

---

### Task 10: The boutique panel (`boutique.js`) and wiring

**Files:**
- Create: `web/world/boutique.js`
- Modify: `web/world/world-main.js`, `web/world/world.css`
- Modify: `tests/paths.js:12`, both world pages

- [ ] **Step 1: Write `web/world/boutique.js`**

```js
/* Lola Lana's Boutique: tabs of wardrobe items, try-on that stacks one item per slot, and Buy with a plain Yes/No.
   Only Yes keeps an item; closing puts back her saved look (try-ons live only here, in memory). */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { doc, T, grade, look (saved, wearable), owned() → map, balance() → coins, paused() → bool,
  //       buy(item) → { ok, why, need }, onTry(look), onBought(saved, trying), onClose() }
  function open(o) {
    var doc = o.doc, T = o.T, I = W.Items, saved = copy(o.look), trying = copy(o.look), tab = 'clothes', pending = null;

    function copy(l) { var c = Object.assign({}, l); c.wear = Object.assign({}, l.wear); return c; }
    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function button(cls, text, onClick) {
      var b = el('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    var box = el('div', 'maker boutique');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', T.boutique);
    box.appendChild(el('div', 'maker-title', '🧶 ' + T.boutique));
    box.appendChild(el('div', 'bt-line', T.lanaHello));
    var have = el('div', 'bt-have');
    box.appendChild(have);
    var note = el('div', 'bt-note');
    box.appendChild(note);
    var tabs = el('div', 'maker-tabs');
    I.GROUPS.forEach(function (g) {
      var b = button('maker-tab', T.tabs[g.id], function () { show(g.id); });
      b.setAttribute('data-tab', g.id);
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
    var grid = el('div', 'bt-grid');
    box.appendChild(grid);
    var ask = el('div', 'bt-confirm');
    ask.hidden = true;
    var askText = el('div', 'bt-confirm-text');
    ask.appendChild(askText);
    ask.appendChild(button('w-btn bt-yes', T.yes, yes));
    ask.appendChild(button('w-btn bt-no', T.no, no));
    box.appendChild(ask);
    var msg = el('div', 'bt-msg');
    msg.setAttribute('aria-live', 'polite');
    box.appendChild(msg);
    box.appendChild(button('maker-done', T.close, close));

    function render() {
      var coins = o.balance(), owned = o.owned(), paused = o.paused();
      have.textContent = T.have.split('{n}').join(String(coins));
      note.textContent = paused ? T.paused : '';
      note.hidden = !paused;
      [].forEach.call(tabs.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
      grid.textContent = '';
      I.inGroup(tab).forEach(function (it) {
        var card = el('div', 'bt-card');
        card.setAttribute('data-item', it.id);
        var on = trying.wear[it.slot] === it.id;
        var tryBtn = button('bt-try', '', function () { tryOn(it.id); });
        tryBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        tryBtn.appendChild(el('span', 'bt-icon', it.icon));
        tryBtn.appendChild(el('span', 'bt-name', I.name(it, o.grade)));
        card.appendChild(tryBtn);
        if (Object.prototype.hasOwnProperty.call(owned, it.id)) {
          card.appendChild(el('div', 'bt-owned', T.owned));
        } else {
          card.appendChild(el('div', 'bt-price', '🪙 ' + it.coins));
          var bar = el('div', 'bt-bar'), fill = el('span');
          fill.style.width = Math.min(100, Math.round(coins / it.coins * 100)) + '%';
          bar.appendChild(fill);
          card.appendChild(bar);
          var short = coins < it.coins;
          var buyBtn = button('w-btn bt-buy', short && !paused ? T.need.replace('{n}', String(it.coins - coins)) : T.buy, function () { buy(it.id); });
          buyBtn.disabled = short || paused;
          card.appendChild(buyBtn);
        }
        grid.appendChild(card);
      });
    }

    function show(id) { tab = id; ask.hidden = true; pending = null; render(); }

    function tryOn(id) {
      var it = I.find(id);
      if (!it) return;
      trying.wear[it.slot] = trying.wear[it.slot] === id ? saved.wear[it.slot] : id;
      msg.textContent = '';
      o.onTry(copy(trying));
      render();
    }

    function buy(id) {
      var it = I.find(id);
      if (!it) return;
      pending = it;
      if (trying.wear[it.slot] !== id) tryOn(id);
      askText.textContent = T.confirm.split('{en}').join(it.en).split('{fil}').join(it.fil).split('{coins}').join(String(it.coins));
      ask.hidden = false;
    }

    function yes() {
      var it = pending;
      ask.hidden = true;
      pending = null;
      if (!it) return;
      var r = o.buy(it);
      if (r.ok) {
        saved.wear[it.slot] = it.id;
        trying.wear[it.slot] = it.id;
        msg.textContent = T.bought;
        o.onBought(copy(saved), copy(trying));
      } else {
        msg.textContent = r.why === 'failed' ? T.failed : r.why === 'paused' ? T.paused : T.notEnough;
      }
      render();
    }

    function no() { ask.hidden = true; pending = null; }

    function close() {
      if (!box.parentNode) return;
      box.parentNode.removeChild(box);
      o.onClose();
    }

    doc.body.appendChild(box);
    show('clothes');
    var first = tabs.querySelector('button');
    if (first) first.focus();
    return { el: box, tab: show, tryOn: tryOn, buy: buy, yes: yes, no: no, close: close };
  }

  W.Boutique = { open: open };
})(this);
```

- [ ] **Step 2: Styles** — append to `web/world/world.css`:

```css
.maker-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; }
.maker-tab { font: 800 15px 'Baloo 2', system-ui, sans-serif; border: 3px solid transparent; border-radius: 999px; padding: 4px 12px;
  background: #fff0f7; color: #6a2c70; cursor: pointer; min-height: 40px; }
.maker-tab[aria-pressed="true"] { border-color: #ff6f91; background: #ffe0ef; }
.maker-shop { display: block; margin: 8px auto 0; font: 800 16px 'Baloo 2', system-ui, sans-serif; border: 0; background: none;
  color: #c2185b; text-decoration: underline; cursor: pointer; min-height: 44px; }
.bt-line, .bt-have, .bt-note { text-align: center; font-weight: 700; margin: 2px 0; }
.bt-note { color: #b5442b; }
.bt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.bt-card { background: #fff7fb; border-radius: 18px; padding: 8px; display: flex; flex-direction: column; gap: 6px; align-items: stretch;
  box-shadow: 0 3px 0 #f3b6d6; }
.bt-try { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 3px solid transparent; border-radius: 14px;
  background: #fff; cursor: pointer; padding: 6px; min-height: 44px; font: 700 14px 'Baloo 2', system-ui, sans-serif; color: #6a2c70; }
.bt-try[aria-pressed="true"] { border-color: #ff6f91; box-shadow: 0 0 0 3px #ffd6e7; }
.bt-icon { font-size: 30px; line-height: 1; }
.bt-price, .bt-owned { text-align: center; font-weight: 800; }
.bt-owned { color: #2e8b57; }
.bt-bar { height: 8px; border-radius: 999px; background: #f3e1ea; overflow: hidden; }
.bt-bar span { display: block; height: 100%; background: linear-gradient(90deg, #ffd166, #ff8fc8); }
.bt-buy { min-height: 44px; }
.bt-buy:disabled { opacity: .6; cursor: default; }
.bt-confirm { margin: 10px 0; padding: 10px; border-radius: 16px; background: #fffbe0; text-align: center; font-weight: 800; }
.bt-confirm .w-btn { margin: 6px 6px 0; }
.bt-msg { text-align: center; font-weight: 800; min-height: 1.4em; }
```

- [ ] **Step 3: Wire it into `web/world/world-main.js`**

1. Add `boutique = null` to the variables: change
   `var me = null, pet = null, near = null, maker = null, overlay = null, lost = false, before = null, talking = false;` to
   `var me = null, pet = null, near = null, maker = null, boutique = null, overlay = null, lost = false, before = null, talking = false, shown = null;`
2. `occupied()` → `function occupied() { return talking || !!overlay || !!maker || !!boutique; }`
3. In `dress(l)`, add `shown = l;` as the first line.
4. Replace the temporary `function openBoutique() {}` with:

```js
    function openBoutique() {
      if (boutique || maker) return;
      ctl.freeze(true);
      hud.show(false);
      var paused = function () { return !!(root.Clock && root.Clock.paused()); };
      boutique = W.Boutique.open({
        doc: doc, T: T, grade: grade, look: worn(look),
        owned: function () { return W.Closet.read(store); },
        balance: function () { try { return root.Wallet ? root.Wallet.balanceStored() : 0; } catch (e) { return 0; } },
        paused: paused,
        buy: function (it) {
          if (!root.Wallet) return { ok: false, why: 'failed' };
          return W.Closet.buy({ storage: store, wallet: root.Wallet, history: root.StudyHistory, paused: paused, now: Date.now, item: it });
        },
        onTry: function (l) { dress(l); },
        onBought: function (keep, trying) {
          look = W.Look.save(store, Object.assign({}, look, { wear: keep.wear }), Date.now());
          dress(trying);
          world.sparkle(ctl.state.x, ctl.state.z);
          sound('allRead');
        },
        onClose: function () {
          boutique = null;
          dress(worn(look));
          ctl.freeze(false);
          hud.show(true);
          ctl.teleport(ctl.state.x, ctl.state.z, ctl.state.face);
        }
      });
    }
```

5. In `act()`: `if (!near || maker || overlay || talking || boutique) return;`
6. In `buildHud()`, the gear button: `if (!maker && !overlay && !talking && !boutique) openSettings();`
7. In `tick(dt)`:
   - `if (maker) {` (the portrait spin) → `if (maker || boutique) {`
   - `var free = !maker && !overlay && !talking;` → `var free = !maker && !boutique && !overlay && !talking;`
   - `if (!maker) {` (town/folk/kin ticks) → `if (!maker && !boutique) {`
   - `if (nudge.tick(dt, !doc.hidden && !maker)) nudgeDue = true;` → `if (nudge.tick(dt, !doc.hidden && !maker && !boutique)) nudgeDue = true;`
8. In the `keydown` listener: add as its first line `if (e.key === 'Escape' && boutique) { boutique.close(); return; }`,
   and change `near && !maker && !overlay && !talking` to `near && !maker && !boutique && !overlay && !talking`.
9. Debug hooks, after `debug.maker = {...};`:

```js
    debug.boutiqueOpen = function () { return !!boutique; };
    debug.boutique = {
      tab: function (id) { if (boutique) boutique.tab(id); },
      tryOn: function (id) { if (boutique) boutique.tryOn(id); },
      buy: function (id) { if (boutique) boutique.buy(id); },
      yes: function () { if (boutique) boutique.yes(); },
      no: function () { if (boutique) boutique.no(); },
      close: function () { if (boutique) boutique.close(); }
    };
    debug.wearing = function () { return shown ? Object.assign({}, shown.wear) : null; };
```

- [ ] **Step 4: Wire the script**

In `tests/paths.js:12`: `'maker.js', 'town.js',` → `'maker.js', 'boutique.js', 'town.js',`.
In both world pages, add `<script src="boutique.js"></script>` right after `<script src="maker.js"></script>`.
Run: `node tools/update-precache.js`

- [ ] **Step 5: Run tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add web/world/boutique.js web/world/world-main.js web/world/world.css tests/paths.js web/world/grade-2.html web/world/grade-5.html web/sw.js web/world/lesson-files.js
```

---

### Task 11: The mirror gets tabs (`maker.js`, `town.js`)

**Files:**
- Modify: `web/world/maker.js` (whole file)
- Modify: `web/world/town.js` (expose `trailTo`)
- Modify: `web/world/world-main.js` (`openMaker` passes `owned` and `onShop`; debug `maker.tab`)

- [ ] **Step 1: Replace `web/world/maker.js`**

```js
/* The character maker at the mirror: a Me tab (body, skin, hair, eyes, freckles, blush, outfit colour, pet and pet
   name) and one tab per boutique group listing only what she owns, plus None. Every pick calls o.onChange so the 3D
   preview updates; Done calls o.onDone; 🛍️ More at Lola Lana's saves too and calls o.onShop. Opens on her first visit
   and at the mirror. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var PET_EMOJI = { chick: '🐥', kitten: '🐱', puppy: '🐶' };

  // o = { doc, T, look, owned: { itemId: … }, onChange(look), onDone(look), onShop(look) }
  function open(o) {
    var doc = o.doc, T = o.T, t = T.maker, O = W.Look.OPTIONS, I = W.Items, buttons = [], panes = {};
    var look = Object.assign({}, o.look);
    look.wear = Object.assign({}, look.wear);

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function button(cls, text, onClick) {
      var b = el('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    var box = el('div', 'maker');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t.title);
    box.appendChild(el('div', 'maker-title', t.title));
    var tabs = el('div', 'maker-tabs');
    box.appendChild(tabs);

    function pane(id) {
      var b = button('maker-tab', T.tabs[id], function () { show(id); });
      b.setAttribute('data-tab', id);
      tabs.appendChild(b);
      var p = el('div', 'maker-pane');
      p.setAttribute('data-pane', id);
      box.appendChild(p);
      panes[id] = { tab: b, el: p };
      return p;
    }
    function show(id) {
      Object.keys(panes).forEach(function (k) {
        panes[k].el.hidden = k !== id;
        panes[k].tab.setAttribute('aria-pressed', k === id ? 'true' : 'false');
      });
    }

    function get(field) { return field.indexOf('wear.') === 0 ? look.wear[field.slice(5)] : look[field]; }
    function row(parent, label, field, values, draw) {
      var r = el('div', 'maker-row');
      r.appendChild(el('div', 'maker-label', label));
      var list = el('div', 'maker-options');
      values.forEach(function (v) {
        var b = button('maker-opt', '', function () { pick(field, v); });
        b.setAttribute('data-field', field);
        b.setAttribute('data-value', String(v));
        draw(b, v);
        list.appendChild(b);
        buttons.push(b);
      });
      r.appendChild(list);
      parent.appendChild(r);
    }
    function swatches(field) {
      return function (b, i) {
        b.className += ' swatch';
        b.style.background = O[field][i];
        b.setAttribute('aria-label', t[field] + ' ' + (i + 1));
      };
    }
    function named(names) { return function (b, v) { b.textContent = names[v]; }; }
    function indexes(field) { return O[field].map(function (c, i) { return i; }); }
    var onOff = { 'true': T.on, 'false': T.off };

    var me = pane('me');
    row(me, t.body, 'body', O.body, named(t.bodies));
    row(me, t.skin, 'skin', indexes('skin'), swatches('skin'));
    row(me, t.hair, 'hair', O.hair, named(t.hairs));
    row(me, t.hairColor, 'hairColor', indexes('hairColor'), swatches('hairColor'));
    row(me, t.eyes, 'eyes', O.eyes, named(t.eyesNames));
    row(me, t.freckles, 'freckles', O.freckles, named(onOff));
    row(me, t.blush, 'blush', O.blush, named(onOff));
    row(me, t.outfit, 'outfit', indexes('outfit'), swatches('outfit'));
    row(me, t.pet, 'pet', O.pet, function (b, v) { b.textContent = PET_EMOJI[v] + ' ' + t.pets[v]; });

    var nameRow = el('label', 'maker-row maker-label', t.petName);
    var input = el('input', 'maker-name');
    input.type = 'text';
    input.maxLength = 12;
    input.value = look.petName;
    input.addEventListener('input', function () { look.petName = input.value; });
    nameRow.appendChild(doc.createElement('br'));
    nameRow.appendChild(input);
    me.appendChild(nameRow);

    var owned = o.owned || {};
    I.GROUPS.forEach(function (g) {
      var p = pane(g.id);
      g.slots.forEach(function (slot) {
        var mine = I.ITEMS.filter(function (it) { return it.slot === slot && Object.prototype.hasOwnProperty.call(owned, it.id); });
        if (!mine.length) return;
        row(p, t.slots[slot], 'wear.' + slot, [''].concat(mine.map(function (it) { return it.id; })), function (b, v) {
          b.textContent = v ? I.find(v).icon + ' ' + I.find(v).en : t.none;
        });
      });
    });

    box.appendChild(button('maker-shop', T.shopMore, shop));
    box.appendChild(button('maker-done', t.done, finish));

    function mark() {
      buttons.forEach(function (b) {
        var on = String(get(b.getAttribute('data-field'))) === b.getAttribute('data-value');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      input.placeholder = T.petNames[look.pet];
    }
    function snapshot() {
      var c = Object.assign({}, look);
      c.wear = Object.assign({}, look.wear);
      return c;
    }
    function pick(field, v) {
      if (field.indexOf('wear.') === 0) look.wear[field.slice(5)] = v;
      else look[field] = v;
      mark();
      o.onChange(snapshot());
    }
    function close() {
      if (!box.parentNode) return false;
      box.parentNode.removeChild(box);
      return true;
    }
    function finish() { if (close()) o.onDone(snapshot()); }
    function shop() { if (close()) o.onShop(snapshot()); }

    doc.body.appendChild(box);
    show('me');
    mark();
    if (buttons[0]) buttons[0].focus();
    return { pick: pick, tab: show, done: finish, el: box };
  }

  W.Maker = { open: open, PET_EMOJI: PET_EMOJI };
})(this);
```

- [ ] **Step 2: Expose the trail in `web/world/town.js`** — in the returned object, add:

```js
      trailTo: startTrail,
```

- [ ] **Step 3: `openMaker` in `web/world/world-main.js`** — replace the whole function with:

```js
    function openMaker() {
      ctl.freeze(true);
      hud.show(false);
      function saveLook(l) {
        look = W.Look.save(store, l, Date.now());
        mine.made = true;
        maker = null;
        dress(worn(look));
        ctl.freeze(false);
        hud.show(true);
        ctl.teleport(ctl.state.x, ctl.state.z, ctl.state.face);
      }
      maker = W.Maker.open({
        doc: doc, T: T, look: worn(look), owned: W.Closet.read(store),
        onChange: function (l) { dress(worn(l)); },
        onDone: function (l) {
          saveLook(l);
          world.sparkle(ctl.state.x, ctl.state.z);
          sound('allRead');
        },
        onShop: function (l) {
          saveLook(l);
          town.trailTo('shop');
        }
      });
    }
```

Note: `worn(look)` is passed in so the maker never shows an unowned item as picked; items she does not own are not
listed, so saving cannot add one.

And extend `debug.maker`:

```js
    debug.maker = {
      pick: function (field, value) { if (maker) maker.pick(field, value); },
      tab: function (id) { if (maker) maker.tab(id); },
      done: function () { if (maker) maker.done(); }
    };
```

- [ ] **Step 4: Run tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS (the fresh-visit case picks `hair` and `pet`, both on the Me tab, which opens first).

- [ ] **Step 5: Stage**

```bash
git add web/world/maker.js web/world/town.js web/world/world-main.js
```

---

### Task 12: End-to-end check

**Files:**
- Modify: `tests/e2e/world-driver.page.js` (new mode `wardrobe`, header comment)
- Modify: `tests/e2e/world-e2e.js` (new case)
- Modify: `README.md` (world-e2e line)

- [ ] **Step 1: Driver mode** — in `tests/e2e/world-driver.page.js`, add `|wardrobe` to the modes in the header comment
and add this block inside `run()`, before `if (mode === 'lost') {`:

```js
    if (mode === 'wardrobe') {
      D.teleport('shop');
      D.stand(55.6, -9.5);
      o.near = D.state().near;
      o.act = text('#act');
      D.act();
      o.open = D.boutiqueOpen();
      o.have = text('.bt-have');
      D.boutique.tab('hats');
      D.boutique.tryOn('crown');
      D.boutique.tab('clothes');
      D.boutique.tryOn('princess');
      o.trying = D.wearing();
      D.boutique.close();
      o.afterClose = D.wearing();
      o.closed = !D.boutiqueOpen();
      // While a panel is open nothing is "near"; one frame finds Lola Lana again.
      D.tick();
      D.act();
      D.boutique.tab('hats');
      D.boutique.buy('cap');
      o.confirm = text('.bt-confirm-text');
      D.boutique.yes();
      o.msg = text('.bt-msg');
      o.owned = Object.keys(JSON.parse(Learner.storage.getItem('wardrobe_v1')).owned);
      o.savedHat = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.hat;
      o.balance = Wallet.balanceStored();
      o.bought = StudyHistory.list().filter(function (e) { return e.type === 'purchase'; }).map(function (e) { return [e.item, e.coins, e.via]; });
      var crown = document.querySelector('.bt-card[data-item="crown"] .bt-buy');
      o.crownBuy = crown ? { text: crown.textContent, disabled: crown.disabled } : null;
      D.boutique.close();
      o.afterBuy = D.wearing();
      D.teleport('house');
      D.stand(47, 49.6);
      D.act();
      o.makerOpen = D.makerOpen();
      D.maker.tab('hats');
      D.maker.pick('wear.hat', '');
      o.noHat = D.wearing().hat;
      D.maker.pick('wear.hat', 'cap');
      D.maker.done();
      o.mirrorHat = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.hat;
      return out(o);
    }
```

- [ ] **Step 2: The e2e case** — in `tests/e2e/world-e2e.js`, before the `// 🏠 in a game opened from the world` block, add:

```js
  // Lola Lana's Boutique: try on two things and close (her look comes back), buy a cap with 100 coins, then take it
  // off and put it back on at the mirror.
  const RICH = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "pigtails", hairColor: 2, outfit: 3, pet: "kitten", petName: "", t: 5 }));'
    + 'Learner.storage.setItem("wallet_v1", JSON.stringify({ v: 1, baselines: {}, spent: 40, bonus: 100, purchases: [], oldPointsCounted: true }));</script>';
  const wr = run('wardrobe', stageWorld('wardrobe', 5, RICH), 'wardrobe');
  assert.deepEqual(wr.errors, [], 'wardrobe: page errors');
  assert.equal(wr.near, 'boutique');
  assert.equal(wr.act, "🧶 Open Lola Lana's Boutique");
  assert.equal(wr.open, true);
  assert.equal(wr.have, '🪙 You have 100 coins');
  assert.equal(wr.trying.hat, 'crown', 'try-ons stack: the crown');
  assert.equal(wr.trying.clothes, 'princess', 'and the dress together');
  assert.equal(wr.afterClose.hat, '', 'closing puts her look back');
  assert.equal(wr.afterClose.clothes, '');
  assert.equal(wr.closed, true);
  assert.equal(wr.confirm, 'Buy the Cap for 50 coins?');
  assert.equal(wr.msg, 'It is yours! 💖');
  assert.deepEqual(wr.owned, ['cap']);
  assert.equal(wr.savedHat, 'cap', 'a bought item is worn and saved');
  assert.equal(wr.balance, 50);
  assert.deepEqual(wr.bought, [['cap', 50, 'wardrobe']]);
  assert.deepEqual(wr.crownBuy, { text: '650 more coins', disabled: true });
  assert.equal(wr.afterBuy.hat, 'cap');
  assert.equal(wr.makerOpen, true, 'the mirror opens the maker');
  assert.equal(wr.noHat, '', 'None takes the cap off');
  assert.equal(wr.mirrorHat, 'cap', 'and it can go back on');
  console.log('ok boutique: try-on, close, buy, mirror');
```

Check the seeded balance first: `balanceStored()` = 40 welcome + 0 from points + 100 bonus − 40 spent = 100. If the
wallet's `read()` drops a field this seed relies on, adjust the seed (not the asserts) until `wr.have` reads 100.

- [ ] **Step 3: Run it**

Run: `node tests/e2e/world-e2e.js`
Expected: every `ok ...` line, including `ok boutique: try-on, close, buy, mirror`.

- [ ] **Step 4: README** — in `README.md`, in the `node tests/e2e/world-e2e.js` line, add `, Lola Lana's boutique (try-on, buy) and the mirror's wardrobe tabs`
before the end of the comment.

- [ ] **Step 5: Run every check**

Run, in turn:
- `node --test`
- `node tests/e2e/world-e2e.js`
- `node tests/e2e/lobby-e2e.js`
- `node tests/e2e/backup-e2e.js`
- `node tests/e2e/sisters-e2e.js`

Expected: all pass.

- [ ] **Step 6: Stage**

```bash
git add tests/e2e/world-driver.page.js tests/e2e/world-e2e.js README.md
```

---

### Task 13: Final review

- [ ] **Step 1:** Open both world pages in a browser (`web/world/grade-5.html`, `web/world/grade-2.html`) with a seeded
  wallet, walk to Lola Lana, try every tab, buy one item, check the Grade 2 text pairs and Filipino wording, and look at
  each of the 40 items on both bodies at the boutique (anything floating, clipping through the head, or hidden goes
  back to Task 7 for a position fix).
- [ ] **Step 2:** Run `node tools/update-precache.js` once more and `node --test`; stage `web/sw.js` if it changed.
- [ ] **Step 3:** Request the final code review (superpowers:requesting-code-review) against the spec.
- [ ] **Step 4:** Give the user the commit as `git add ...` and `git commit -m '...'` blocks. Do not commit.
