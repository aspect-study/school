# Wardrobe 3a: Props and Emotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kuya Pilo the pilandok runs a third Shop Plaza stall selling 12 handheld props and 8 paid emotes; she holds one prop (picked at the mirror) and a ✨ Use button plays its action, a 😊 Emote row plays her emotes, she plays an outfit idle after standing still, and a pet in her arms rides in one arm.

**Architecture:** Props are wardrobe items (`items.js`, new `prop` slot) drawn by `wear.js` on a new hand mount in `avatar.js`. Emotes are a new pure catalog (`emotes.js`) owned in the same `wardrobe_v1.owned` map. Every body move (emotes, prop actions, outfit idles) is pure maths in `moves.js` (offsets from her pose at moment k, plus timed effects), run one at a time by `moverun.js`; `avatar.js` applies the offsets, `build.js` draws the effects as fading emoji sprites. `toyshop.js` puts the catalog in the shared `stall.js` panel; `usebar.js` adds the ✨ Use and 😊 Emote buttons.

**Tech Stack:** Plain ES5 browser scripts (IIFE, `root.World3D`), Three.js r149 (toon materials, code-built shapes), Node's built-in test runner (`node --test`), headless Chrome e2e (`node tests/e2e/world-e2e.js`).

**Spec:** `docs/superpowers/specs/2026-10-07-props-emotes-design.md`

## Ground rules for every task

- **Never run `git commit`.** The user commits. Each task ends by **staging** its files with `git add` (listed in the task). No `Co-Authored-By` lines anywhere.
- Match the surrounding code: ES5 (`var`, `function`), 2-space indent, single quotes, comments only where something is not obvious, no fully-qualified names.
- A new file under `web/world/` must be added in the same task to: `WORLD_FILES` in `tests/paths.js` (load order), the `<script>` list in **both** `web/world/grade-5.html` and `web/world/grade-2.html` (same order), and `web/sw.js` PRECACHE by running `node tools/update-precache.js`. `tests/world3d-wiring.test.js` and `tests/pwa.test.js` fail otherwise.
- After each task: `node --test` must pass (all of it, not just the new file). Tasks that touch `world-main.js`, `build.js`, `avatar.js`, `companion.js`, `folk.js`, `layout.js` or the HTML also run `node tests/e2e/world-e2e.js`.
- Grade 2 text pairs Filipino with English as `'Filipino · English'`; buttons are English on both grades.

## File map

| File | Responsibility |
|---|---|
| `web/world/items.js` (modify) | `prop` slot, `props` group, 12 props, free rule (`coins === 0` = owned) |
| `web/world/emotes.js` (new) | the 11 emotes: catalog + `find`, `name`, `owns`, `usable` |
| `web/world/moves.js` (new) | every move: length, offsets at k, timed effects; the effect table `FX` |
| `web/world/moverun.js` (new) | runs one move at a time, stops it, outfit-idle timer |
| `web/world/wear.js` (modify) | `PROPS` builders and `prop(S, hand, id)` |
| `web/world/avatar.js` (modify) | hand mount, prop, one-arm carry, `{ move, k }` and `{ ride }` poses |
| `web/world/build.js` (modify) | the toy stall, `fx(x, y, z, kind)`, `fxLive()` |
| `web/world/cast.js` (modify) | `pilo(S)`: Kuya Pilo |
| `web/world/layout.js` (modify) | `toyStall`, `pilo`, the `toyshop` interactable |
| `web/world/folk.js` (modify) | places Kuya Pilo, label + act for `toyshop` |
| `web/world/toyshop.js` (new) | Kuya Pilo's panel on `stall.js` (Props + Emotes tabs) |
| `web/world/usebar.js` (new) | ✨ Use and 😊 Emote buttons and the emote row |
| `web/world/playbar.js` (modify) | optional `onOpen` hook so the two rows close each other |
| `web/world/petlife.js` (modify) | `startWatch(s, len)` action |
| `web/world/companion.js` (modify) | `watch(her, len)`, `unwatch()`; an arms pet hops down while watching |
| `web/world/boutique.js` (modify) | skips the `props` group |
| `web/world/maker.js` (modify) | free rule, "More toys" link |
| `web/world/text.js` (modify) | new words |
| `web/world/world-main.js` (modify) | opens the toy stall; runs moves, idles, effects, pet watch |
| `web/world/world.css` (modify) | positions for the new buttons and rows |
| `web/engine/parent-panel.js` (modify) | "· from the toy stall" for `via: 'toys'` |

---

### Task 1: Prop catalog, free rule, boutique filter, words

**Files:**
- Modify: `web/world/items.js`
- Modify: `web/world/boutique.js`
- Modify: `web/world/maker.js:16`
- Modify: `web/world/text.js`
- Test: `tests/world3d-items.test.js`, `tests/world3d-text.test.js`

**Tasks 1 and 2 go to one subagent in one run:** after Task 1, `tests/world3d-wear.test.js` cannot see a drawing for the 12 new props until Task 2 adds them, so the suite is green again only at the end of Task 2.

- [ ] **Step 1: Update the item tests (they fail now)**

In `tests/world3d-items.test.js` replace the first two tests with:

```js
test('52 items, unique ids, a known slot and a price from 50 to 800 (the balloon is free)', () => {
  assert.equal(Items.ITEMS.length, 52);
  assert.equal(new Set(Items.ITEMS.map((i) => i.id)).size, 52);
  for (const it of Items.ITEMS) {
    assert.ok(Items.SLOTS.includes(it.slot), it.id + ' slot');
    const free = it.id === 'balloon' && it.coins === 0;
    assert.ok(Number.isInteger(it.coins) && (free || (it.coins >= 50 && it.coins <= 800)), it.id + ' price ' + it.coins);
    assert.match(it.id, /^[a-z0-9-]{1,32}$/, it.id);
    assert.ok(it.icon && it.en && it.fil, it.id + ' icon and names');
    assert.ok(!it.en.includes(' · ') && !it.fil.includes(' · '), it.id + ' names are single halves');
  }
});

test('every slot belongs to exactly one group; 8 items per group, 12 props', () => {
  const slots = Items.GROUPS.flatMap((g) => g.slots);
  assert.deepEqual([...slots].sort(), [...Items.SLOTS].sort());
  assert.deepEqual(Items.GROUPS.map((g) => g.id), ['clothes', 'hats', 'accessories', 'face', 'hair', 'props']);
  for (const g of Items.GROUPS) assert.equal(Items.inGroup(g.id).length, g.id === 'props' ? 12 : 8, g.id);
});

test('the props and their prices', () => {
  assert.deepEqual(Items.inGroup('props').map((i) => [i.id, i.coins]), [
    ['balloon', 0], ['bubblewand', 80], ['pamaypay', 80], ['teddy', 100], ['bouquet', 120], ['umbrella', 150],
    ['ribbonwand', 200], ['drum', 200], ['parol', 250], ['ukulele', 300], ['magicwand', 500], ['trophy', 800]
  ]);
  for (const it of Items.inGroup('props')) assert.equal(it.slot, 'prop');
});

test('a free prop counts as owned: worn, kept and never hidden', () => {
  const look = { wear: { prop: 'balloon' } };
  assert.equal(Items.wearable(look, {}).wear.prop, 'balloon');
  assert.equal(Items.wearable({ wear: { prop: 'trophy' } }, {}).wear.prop, '', 'a paid prop she does not own is not drawn');
  assert.equal(Items.owns({}, 'balloon'), true);
  assert.equal(Items.owns({}, 'trophy'), false);
  assert.equal(Items.owns({ trophy: { t: 1, coins: 800 } }, 'trophy'), true);
  assert.equal(Items.owns({}, 'nope'), false);
});
```

In the test `'wearable keeps real items she owns in their own slot, and drops the rest'`, add `prop: ''` to the expected `out.wear` object (after `shimmer: ''`).

- [ ] **Step 2: Update the text tests (they fail now)**

In `tests/world3d-text.test.js`:
- add to `ENGLISH_ONLY`: `'toyshopGo', 'toysMore', 'use', 'emote', 'tabs.props', 'tabs.emotes'`;
- in `'the boutique and the wardrobe have their words'`, change the slots list to `['clothes', 'hat', 'glasses', 'back', 'neck', 'sticker', 'paint', 'dye', 'shimmer', 'prop']`;
- add at the end:

```js
test('Kuya Pilo, the toy stall, Use and Emote have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['toyshop', 'piloHello', 'toyshopGo', 'toysMore', 'use', 'emote']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.equal(TEXT[g].tabs.props, 'Props');
    assert.equal(TEXT[g].tabs.emotes, 'Emotes');
    assert.equal(TEXT[g].use, '✨ Use');
    assert.equal(TEXT[g].emote, '😊 Emote');
  }
  assert.equal(english('🎈 ' + TEXT.grade2.toyshop), "🎈 Kuya Pilo's Toy Stall");
  assert.ok(TEXT.grade2.piloHello.includes(' · '), 'Grade 2 pairs Filipino with English');
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `node --test tests/world3d-items.test.js tests/world3d-text.test.js`
Expected: FAIL (52 vs 40 items, missing `props` group, missing words, `Items.owns` is not a function).

- [ ] **Step 4: Add the props, the slot, the group and the free rule to `web/world/items.js`**

Change `SLOTS` and `GROUPS`:

```js
  var SLOTS = ['clothes', 'hat', 'glasses', 'back', 'neck', 'sticker', 'paint', 'dye', 'shimmer', 'prop'];
  // The boutique tabs and the mirror tabs, in this order. Props are sold at Kuya Pilo's toy stall, not the boutique.
  var GROUPS = [
    { id: 'clothes', slots: ['clothes'] },
    { id: 'hats', slots: ['hat'] },
    { id: 'accessories', slots: ['glasses', 'back', 'neck'] },
    { id: 'face', slots: ['sticker', 'paint'] },
    { id: 'hair', slots: ['dye', 'shimmer'] },
    { id: 'props', slots: ['prop'] }
  ];
```

Append to `ITEMS` (after `silvershimmer`; add a comma after its line):

```js
    item('balloon', 'prop', 0, '🎈', 'Balloon', 'Lobo'),
    item('bubblewand', 'prop', 80, '🫧', 'Bubble wand', 'Pang-bula'),
    item('pamaypay', 'prop', 80, '🪭', 'Pamaypay fan', 'Pamaypay'),
    item('teddy', 'prop', 100, '🧸', 'Teddy plushie', 'Laruang oso'),
    item('bouquet', 'prop', 120, '💐', 'Flower bouquet', 'Pumpon ng bulaklak'),
    item('umbrella', 'prop', 150, '☂️', 'Umbrella', 'Payong'),
    item('ribbonwand', 'prop', 200, '🎀', 'Ribbon wand', 'Lasong pang-ikot'),
    item('drum', 'prop', 200, '🥁', 'Drum', 'Tambol'),
    item('parol', 'prop', 250, '⭐', 'Parol lantern', 'Parol'),
    item('ukulele', 'prop', 300, '🎸', 'Ukulele', 'Maliit na gitara'),
    item('magicwand', 'prop', 500, '🪄', 'Magic wand', 'Mahiwagang wand'),
    item('trophy', 'prop', 800, '🏆', 'Golden trophy', 'Gintong tropeo')
```

Add the free rule after `find`:

```js
  // A free item (the balloon) is always hers, like the free pets, tricks and the ball.
  function owns(owned, id) {
    var it = find(id);
    return !!it && (it.coins === 0 || own(owned, id));
  }
```

In `wearable`, replace `(owned === null || own(owned, id))` with `(owned === null || owns(owned, id))`.
In `keepUnowned`, replace `(!own(owned, was[s]) || !find(was[s]))` with `!owns(owned, was[s])` (an unknown id is not owned either, so one call covers both).
Export it: add `owns: owns,` to `exported`.

- [ ] **Step 5: Boutique skips props; the mirror counts free items**

`web/world/boutique.js`, the `groups` line:

```js
        groups: I.GROUPS.map(function (g) { return g.id; }).filter(function (id) { return id !== 'props'; }),
```

`web/world/maker.js` line 16, replace `has`:

```js
    function has(id) { return Object.prototype.hasOwnProperty.call(owned, id) || I.owns(owned, id); }
```

(The mirror already builds one pane per `Items.GROUPS` entry, so it gets a Props pane listing the owned props plus None. Free pets are handled separately at maker.js line 97 and are unaffected.)

- [ ] **Step 6: Add the words to `web/world/text.js`**

In `BUTTONS`, after `play: '🎾 Play', free: '🎁 Free',` add:

```js
    toyshopGo: "🎈 Open Kuya Pilo's Toy Stall", toysMore: "🎈 More at Kuya Pilo's", use: '✨ Use', emote: '😊 Emote',
```

and in `tabs` add `props: 'Props', emotes: 'Emotes'`.

Grade 5 labels (after `kikoHello`):

```js
      toyshop: "Kuya Pilo's Toy Stall", piloHello: 'Hello! Tap a toy to hold it, or a move to see it. 🎈',
```

Grade 5 maker `slots`: add `prop: 'In my hand'` at the end.

Grade 2 labels (after `kikoHello`):

```js
      toyshop: "Tindahan ng Laruan ni Kuya Pilo · Kuya Pilo's Toy Stall",
      piloHello: 'Kumusta! Pindutin ang laruan para hawakan ito, o ang galaw para makita ito. 🎈 · Hello! Tap a toy to hold it, or a move to see it. 🎈',
```

Grade 2 maker `slots`: add `prop: 'Hawak sa kamay · In my hand'` at the end.

- [ ] **Step 7: Run the tests**

Run: `node --test tests/world3d-items.test.js tests/world3d-text.test.js tests/world3d-look.test.js tests/world3d-closet.test.js`
Expected: PASS. (`node --test` as a whole still fails in `tests/world3d-wear.test.js` only, until Task 2.)

- [ ] **Step 8: Stage (do not commit)**

```bash
git add web/world/items.js web/world/boutique.js web/world/maker.js web/world/text.js tests/world3d-items.test.js tests/world3d-text.test.js
```

---

### Task 2: Prop shapes in `wear.js`

**Files:**
- Modify: `web/world/wear.js`
- Test: `tests/world3d-wear.test.js`

Coordinates: a prop is built in its own group whose origin is her grip; **+y is up and +z is forward** (avatar.js turns the hand mount so this holds while she holds the prop). Her head is 2.6 wide, her arm 1.2 long; props are about 1–3.5 tall. `S.add(geo, colorOrMaterial, x, y, z, parent)` returns the mesh. `S.toon(color, opts, true)` makes an own (not shared) material you may change and must dispose.

- [ ] **Step 1: Write the failing test**

In `tests/world3d-wear.test.js`, add `prop: 'PROPS'` to the `TABLE` map at the top, then append (the file already has `Items`, `Wear`; these fake scene helpers are the ones `tests/world3d-petbody.test.js` uses):

```js
function vec(v = 0) {
  return { x: v, y: v, z: v, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, setScalar(k) { this.x = this.y = this.z = k; return this; } };
}
class Obj {
  constructor() { this.children = []; this.position = vec(); this.rotation = vec(); this.scale = vec(1); this.parent = null; this.visible = true; }
  add(c) { this.children.push(c); c.parent = this; return this; }
  remove(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return this; }
}
function fakeS() {
  const geo = () => ({});
  return {
    THREE: { Group: Obj },
    add: (g, m, x, y, z, parent) => { const o = new Obj(); o.position.set(x, y, z); parent.add(o); return o; },
    toon: () => ({ emissiveIntensity: 0, dispose() {} }),
    ball: geo, rbox: geo, cyl: geo, cone: geo, torus: geo,
  };
}

test('every prop builds in her hand and animates while held and while used', () => {
  for (const it of Items.inGroup('props')) {
    const hand = new Obj(), S = fakeS();
    const h = Wear.prop(S, hand, it.id);
    assert.ok(h, it.id + ' builds');
    assert.equal(hand.children.length, 1, it.id + ' is one group in the hand');
    assert.ok(hand.children[0].children.length >= 2, it.id + ' has shapes');
    for (const k of [null, 0, 0.25, 0.5, 0.75, 1]) h.animate(1.3, k);
    h.dispose();
  }
  assert.equal(Wear.prop(fakeS(), new Obj(), ''), null, 'no prop: nothing');
  assert.equal(Wear.prop(fakeS(), new Obj(), 'crown'), null, 'not a prop: nothing');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-wear.test.js`
Expected: FAIL (`Wear.prop is not a function`, and 12 props missing from `PROPS`).

- [ ] **Step 3: Fill `PROPS` and add `prop()` in `web/world/wear.js`**

Add before `var exported`:

```js
  // ---- props in her right hand: origin at her grip, +y up, +z forward. Each builder fills group g and may return
  // animate(t, k) (k: 0..1 while she uses it, null while she just holds it) and the own materials to dispose. ----
  function easeIn(k) { return k === null ? 0 : Math.min(1, k / 0.2, (1 - k) / 0.2); }
  function star(S, g, mat, r, y) {
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2, c = S.add(S.cone(r * 0.32, r, 4), mat, Math.sin(a) * r * 0.5, y + Math.cos(a) * r * 0.5, 0, g);
      c.rotation.z = -a;
    }
    S.add(S.ball(r * 0.4), mat, 0, y, 0, g);
  }

  var PROPS = {
    balloon: function (S, g) {
      var up = new S.THREE.Group();
      g.add(up);
      S.add(S.cyl(0.02, 0.02, 2.6, 4), WHITE, 0, 1.3, 0, up);
      S.add(S.ball(0.7), '#ff6f91', 0, 3.2, 0, up).scale.set(1, 1.15, 1);
      S.add(S.cone(0.12, 0.2, 6), '#ff6f91', 0, 2.42, 0, up).rotation.x = Math.PI;
      return {
        animate: function (t, k) {
          up.rotation.z = Math.sin(t * 1.5) * 0.12;
          up.position.y = k === null ? 0 : Math.abs(Math.sin(k * Math.PI * 3)) * 0.8 * (1 - k);
        }
      };
    },
    bubblewand: function (S, g) {
      S.add(S.cyl(0.05, 0.05, 1.2, 6), '#ff8fc8', 0, 0.6, 0, g);
      S.add(S.torus(0.24, 0.05, 6, 16), '#7fd6ff', 0, 1.4, 0, g);
    },
    pamaypay: function (S, g) {
      var fan = new S.THREE.Group();
      fan.position.y = 0.5;
      g.add(fan);
      S.add(S.cyl(0.05, 0.05, 0.5, 6), '#a0785a', 0, -0.25, 0, fan);
      S.add(S.ball(0.6), '#e8c872', 0, 0.45, 0, fan).scale.set(1, 1, 0.12);
      [-0.3, 0, 0.3].forEach(function (x) { S.add(S.rbox(0.05, 0.9, 0.09, 0.02), '#c49a4a', x, 0.45, 0, fan).rotation.z = -x; });
      return { animate: function (t, k) { fan.rotation.y = k === null ? 0 : Math.sin(k * Math.PI * 6) * 0.5 * easeIn(k); } };
    },
    teddy: function (S, g) {
      var bear = new S.THREE.Group(), FUR_T = '#c68b59';
      g.add(bear);
      S.add(S.ball(0.45), FUR_T, 0, 0.5, 0, bear);
      S.add(S.ball(0.35), FUR_T, 0, 1.05, 0, bear);
      pair(function (s) { S.add(S.ball(0.14), FUR_T, s * 0.25, 1.35, 0, bear); });
      S.add(S.ball(0.14), '#f3d9c4', 0, 1.0, 0.3, bear);
      return { animate: function (t, k) { var s = 1 + Math.sin((k || 0) * Math.PI) * 0.15; bear.scale.set(s, s, s); } };
    },
    bouquet: function (S, g) {
      [-0.15, 0, 0.15].forEach(function (x) { S.add(S.cyl(0.04, 0.04, 0.9, 5), '#5fcf6a', x, 0.6, 0, g).rotation.z = -x; });
      S.add(S.cone(0.32, 0.7, 8), '#fff2b3', 0, 0.35, 0, g).rotation.x = Math.PI;
      [['#ff6f91', -0.2, 1.05], ['#ffd166', 0.2, 1.05], ['#a77bff', 0, 1.2], ['#ff9e6b', 0, 0.95]].forEach(function (f) {
        S.add(S.ball(0.18), f[0], f[1], f[2], 0.05, g);
      });
    },
    umbrella: function (S, g) {
      S.add(S.cyl(0.04, 0.04, 2.2, 6), '#5a4a52', 0, 1.1, 0, g);
      var top = S.add(S.cone(1.4, 0.7, 8), '#6aa9ff', 0, 2.3, 0, g);
      return {
        animate: function (t, k) {
          var open = 0.25 + 0.75 * easeIn(k);
          top.scale.set(open, 1.6 - 0.6 * easeIn(k), open);
          top.rotation.y = k === null ? 0 : k * Math.PI * 4;
        }
      };
    },
    ribbonwand: function (S, g) {
      S.add(S.cyl(0.04, 0.04, 1, 6), WHITE, 0, 0.5, 0, g);
      var bits = [];
      for (var i = 0; i < 8; i++) bits.push(S.add(S.rbox(0.18, 0.08, 0.04, 0.02), '#ff6f91', 0, 1 - i * 0.12, 0, g));
      return {
        animate: function (t, k) {
          var e = easeIn(k);
          bits.forEach(function (b, i) {
            var a = i * 0.7 + (k || 0) * Math.PI * 4, r = 0.05 + 0.8 * e;
            b.position.set(Math.cos(a) * r * (i / 8), 1 + i * 0.12 * e - (1 - e) * i * 0.12, Math.sin(a) * r * (i / 8));
          });
        }
      };
    },
    drum: function (S, g) {
      var d = new S.THREE.Group();
      d.position.set(0, 0.1, 0.3);
      g.add(d);
      S.add(S.cyl(0.5, 0.5, 0.6, 16), '#ff5a5f', 0, 0, 0, d);
      S.add(S.cyl(0.52, 0.52, 0.06, 16), '#fff6e0', 0, 0.32, 0, d);
      S.add(S.torus(0.5, 0.04, 6, 16), GOLD, 0, -0.3, 0, d).rotation.x = Math.PI / 2;
      return { animate: function (t, k) { d.position.y = 0.1 + (k === null ? 0 : Math.abs(Math.sin(k * Math.PI * 6)) * 0.08); } };
    },
    parol: function (S, g) {
      var glow = S.toon(GOLD, { emissive: '#ffb347', emissiveIntensity: 0.5 }, true);
      S.add(S.cyl(0.04, 0.04, 1.2, 6), '#a0785a', 0, 0.6, 0, g);
      star(S, g, glow, 0.6, 1.6);
      return {
        animate: function (t, k) { glow.emissiveIntensity = 0.45 + Math.sin(t * 2) * 0.15 + easeIn(k) * 0.8; },
        mats: [glow]
      };
    },
    ukulele: function (S, g) {
      var u = new S.THREE.Group();
      u.rotation.z = 0.6;
      g.add(u);
      S.add(S.ball(0.42), '#d9a066', 0, 0.1, 0, u).scale.set(1, 1.15, 0.4);
      S.add(S.ball(0.32), '#d9a066', 0, 0.62, 0, u).scale.set(1, 1, 0.4);
      S.add(S.cyl(0.11, 0.11, 0.05, 12), INK, 0, 0.35, 0.14, u).rotation.x = Math.PI / 2;
      S.add(S.rbox(0.14, 1.0, 0.1, 0.04), '#8b5a2b', 0, 1.3, 0, u);
    },
    magicwand: function (S, g) {
      var glow = S.toon(GOLD, { emissive: '#ffd166', emissiveIntensity: 0.4 }, true);
      S.add(S.cyl(0.05, 0.05, 1.3, 6), INK, 0, 0.65, 0, g);
      star(S, g, glow, 0.35, 1.45);
      return { animate: function (t, k) { glow.emissiveIntensity = 0.35 + easeIn(k) * 0.9; }, mats: [glow] };
    },
    trophy: function (S, g) {
      var gold = S.toon(GOLD, { emissive: '#b8860b', emissiveIntensity: 0.25 }, true);
      S.add(S.rbox(0.6, 0.2, 0.6, 0.06), gold, 0, 0.15, 0, g);
      S.add(S.cyl(0.08, 0.08, 0.4, 8), gold, 0, 0.45, 0, g);
      S.add(S.cyl(0.45, 0.2, 0.6, 16), gold, 0, 0.95, 0, g);
      pair(function (s) { S.add(S.torus(0.2, 0.05, 6, 12), gold, s * 0.45, 1.0, 0, g).rotation.y = Math.PI / 2; });
      return { animate: function (t, k) { gold.emissiveIntensity = 0.25 + easeIn(k) * 0.6; }, mats: [gold] };
    }
  };

  // Draws prop id in hand (avatar.js's hand mount). Returns { animate(t, k), dispose() }, or null for no prop.
  function prop(S, hand, id) {
    if (!id || !Object.prototype.hasOwnProperty.call(PROPS, id)) return null;
    var g = new S.THREE.Group();
    hand.add(g);
    var r = PROPS[id](S, g) || {};
    return {
      animate: function (t, k) { if (r.animate) r.animate(t, k); },
      dispose: function () { (r.mats || []).forEach(function (m) { m.dispose(); }); }
    };
  }
```

Add `PROPS: PROPS, prop: prop,` to `exported`.

- [ ] **Step 4: Run the tests**

Run: `node --test`
Expected: PASS (all, including Task 1's items/text tests and the wear "every catalog item can be drawn" test).

- [ ] **Step 5: Stage (do not commit)**

```bash
git add web/world/wear.js tests/world3d-wear.test.js
```

---

### Task 3: The emote catalog and the toy-stall history label

**Files:**
- Create: `web/world/emotes.js`
- Modify: `tests/paths.js` (WORLD_FILES), `web/world/grade-5.html`, `web/world/grade-2.html`, `web/sw.js` (via tool)
- Modify: `web/engine/parent-panel.js:158`
- Test: `tests/world3d-emotes.test.js` (new), `tests/world3d-wardrobe-wiring.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/world3d-emotes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Emotes = require(worldFile('emotes.js'));
const Items = require(worldFile('items.js'));
const Pets = require(worldFile('pets.js'));

test('11 emotes: wave, clap and cheer free, 8 paid from 80 to 500', () => {
  assert.deepEqual(Emotes.EMOTES.map((e) => [e.id, e.coins]), [
    ['emote-wave', 0], ['emote-clap', 0], ['emote-cheer', 0], ['emote-bow', 80], ['emote-heart', 100], ['emote-giggle', 120],
    ['emote-spin', 150], ['emote-relax', 150], ['emote-dance', 250], ['emote-cartwheel', 400], ['emote-hero', 500]
  ]);
  for (const e of Emotes.EMOTES) {
    assert.equal(e.kind, 'emote');
    assert.ok(e.icon && e.en && e.fil, e.id);
    assert.notEqual(e.fil, e.en, e.id + ' needs a Filipino name');
    assert.doesNotMatch(e.fil, /\bbagay\b|tunog tama/i, e.id);
  }
});

test('emote ids never clash with wardrobe or pet ids (they share one owned list)', () => {
  for (const e of Emotes.EMOTES) {
    assert.equal(Items.find(e.id), null, e.id);
    assert.equal(Pets.find(e.id), null, e.id);
  }
});

test('find, name, owns and usable', () => {
  assert.equal(Emotes.find('emote-spin').en, 'Spin');
  assert.equal(Emotes.find('constructor'), null);
  assert.equal(Emotes.name(Emotes.find('emote-spin'), 'grade5'), 'Spin');
  assert.equal(Emotes.name(Emotes.find('emote-spin'), 'grade2'), 'Ikot · Spin');
  assert.equal(Emotes.owns({}, 'emote-wave'), true);
  assert.equal(Emotes.owns({}, 'emote-spin'), false);
  assert.equal(Emotes.owns({ 'emote-spin': { t: 1, coins: 150 } }, 'emote-spin'), true);
  assert.deepEqual(Emotes.usable({ 'emote-spin': { t: 1, coins: 150 }, 'trick-spin': { t: 1, coins: 100 } }),
    ['emote-wave', 'emote-clap', 'emote-cheer', 'emote-spin']);
});
```

Append to `tests/world3d-wardrobe-wiring.test.js`:

```js
test('the Parent panel says when a purchase came from the toy stall', () => {
  assert.ok(panel.includes("e.via === 'toys' ? ' · from the toy stall'"));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-emotes.test.js tests/world3d-wardrobe-wiring.test.js`
Expected: FAIL (cannot find `emotes.js`; parent-panel text missing).

- [ ] **Step 3: Create `web/world/emotes.js`**

```js
/* Her emotes: body moves she does from the 😊 Emote row (moves.js draws them). Wave, Clap and Cheer are free; the rest
   are sold at Kuya Pilo's toy stall and owned in wardrobe_v1 like tricks. Pure data, so the Node tests can read it. */
(function (root) {
  'use strict';

  function emote(id, coins, icon, en, fil) { return { id: id, kind: 'emote', coins: coins, icon: icon, en: en, fil: fil }; }
  var EMOTES = [
    emote('emote-wave', 0, '👋', 'Wave', 'Kaway'),
    emote('emote-clap', 0, '👏', 'Clap', 'Palakpak'),
    emote('emote-cheer', 0, '🙌', 'Cheer', 'Hiyaw ng saya'),
    emote('emote-bow', 80, '🙇', 'Bow', 'Yuko'),
    emote('emote-heart', 100, '🫶', 'Heart hands', 'Kamay na puso'),
    emote('emote-giggle', 120, '😂', 'Giggle', 'Hagikgik'),
    emote('emote-spin', 150, '🌀', 'Spin', 'Ikot'),
    emote('emote-relax', 150, '🧘', 'Sit and relax', 'Upo at pahinga'),
    emote('emote-dance', 250, '💃', 'Dance', 'Sayaw'),
    emote('emote-cartwheel', 400, '🤸', 'Cartwheel', 'Pabaligtad na ikot'),
    emote('emote-hero', 500, '🦸', 'Hero pose', 'Pose ng bayani')
  ];

  var BY_ID = {};
  EMOTES.forEach(function (e) { BY_ID[e.id] = e; });
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  function find(id) { return typeof id === 'string' && own(BY_ID, id) ? BY_ID[id] : null; }
  function name(it, grade) { return grade === 'grade2' ? it.fil + ' · ' + it.en : it.en; }
  function owns(owned, id) {
    var e = find(id);
    return !!e && (e.coins === 0 || own(owned, id));
  }
  // What her 😊 Emote row offers, in catalog order.
  function usable(owned) { return EMOTES.filter(function (e) { return owns(owned, e.id); }).map(function (e) { return e.id; }); }

  var exported = { EMOTES: EMOTES, find: find, name: name, owns: owns, usable: usable };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Emotes = exported;
})(this);
```

- [ ] **Step 4: Wire the file in**

- `tests/paths.js` `WORLD_FILES`: insert `'emotes.js'` right after `'pets.js'`.
- Both world pages: add `<script src="emotes.js"></script>` right after `<script src="pets.js"></script>`.
- Run: `node tools/update-precache.js`

- [ ] **Step 5: The parent panel label**

`web/engine/parent-panel.js` line 158: change `: e.via === 'pets' ? ' · from the pet stall' : '')` to
`: e.via === 'pets' ? ' · from the pet stall' : e.via === 'toys' ? ' · from the toy stall' : '')`.

- [ ] **Step 6: Run the tests**

Run: `node --test`
Expected: PASS.

- [ ] **Step 7: Stage (do not commit)**

```bash
git add web/world/emotes.js tests/world3d-emotes.test.js tests/world3d-wardrobe-wiring.test.js tests/paths.js web/world/grade-5.html web/world/grade-2.html web/sw.js web/engine/parent-panel.js
```

---

### Task 4: Moves (pure maths)

**Files:**
- Create: `web/world/moves.js`
- Modify: `tests/paths.js`, both world pages (after `emotes.js`), `web/sw.js` (tool)
- Test: `tests/world3d-moves.test.js` (new)

`Moves.pose(id, p)` returns **offsets from her current pose** at moment p (0..1), with every key present. All offsets are 0 at p = 0 and p = 1 (rotations `bry`/`brz` may end at a whole turn). Keys: `aLx aLz aRx aRz` (left/right arm rotation x/z), `lLx lRx` (legs x), `bx by` (body position), `brx bry brz` (body rotation), `hrx hry hrz` (head rotation). avatar.js adds them on top of her walk/hold/carry pose.

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-moves.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const M = require(worldFile('moves.js'));
const Emotes = require(worldFile('emotes.js'));
const Items = require(worldFile('items.js'));

const TAU = Math.PI * 2;
const ids = () => Object.keys(M.MOVES);
const turn = (a) => Math.abs(a - Math.round(a / TAU) * TAU);

test('every emote, every prop action and every outfit idle has a move (a new one fails here until drawn)', () => {
  const want = Emotes.EMOTES.map((e) => e.id)
    .concat(Items.inGroup('props').map((p) => M.forProp(p.id)))
    .concat(['idle-princess', 'idle-hero', 'idle-uniform', 'idle-look']);
  assert.deepEqual(ids().sort(), want.sort());
});

test('each move lasts 1.5 to 2.5 s, starts and ends at rest, and stays in safe ranges', () => {
  for (const id of ids()) {
    const len = M.find(id).len;
    assert.ok(len >= 1.5 && len <= 2.5, id + ' len ' + len);
    for (const p of [0, 1]) {
      const o = M.pose(id, p);
      for (const k of M.KEYS) {
        const v = k === 'bry' || k === 'brz' ? turn(o[k]) : Math.abs(o[k]);
        assert.ok(v < 1e-9, id + ' ' + k + ' at ' + p + ' = ' + o[k]);
      }
    }
    for (let i = 0; i <= 40; i++) {
      const o = M.pose(id, i / 40);
      for (const k of M.KEYS) {
        assert.ok(Number.isFinite(o[k]), id + ' ' + k);
        if (k !== 'bry' && k !== 'brz' && k !== 'by') assert.ok(Math.abs(o[k]) <= 3.2, id + ' ' + k + ' = ' + o[k]);
      }
      // by reaches 5.6 only mid-cartwheel, when her feet are over her head.
      assert.ok(o.by >= -1.2 && o.by <= 6, id + ' by');
    }
  }
});

test('effects are known kinds, timed inside the move, and found between two moments', () => {
  for (const id of ids()) {
    for (const [at, kind] of M.find(id).fx) {
      assert.ok(at > 0 && at < 1, id + ' fx at ' + at);
      assert.ok(Object.prototype.hasOwnProperty.call(M.FX, kind), id + ' fx ' + kind);
    }
  }
  assert.deepEqual(M.effectsBetween('use-bubblewand', 0, 0.3), ['bubbles']);
  assert.deepEqual(M.effectsBetween('use-bubblewand', 0.3, 1), ['bubbles', 'bubbles']);
  assert.deepEqual(M.effectsBetween('nope', 0, 1), []);
});

test('the effect table: emoji, count, rise, spread, life', () => {
  for (const [kind, f] of Object.entries(M.FX)) {
    assert.ok(Array.isArray(f.e) && f.e.length, kind);
    assert.ok(f.n >= 1 && f.n <= 10 && f.life > 0 && f.spread > 0 && Number.isFinite(f.vy), kind);
  }
});

test('outfit idles and prop actions are named from the look', () => {
  assert.equal(M.idleFor('princess'), 'idle-princess');
  assert.equal(M.idleFor('hero'), 'idle-hero');
  assert.equal(M.idleFor('uniform'), 'idle-uniform');
  assert.equal(M.idleFor('hoodie'), 'idle-look');
  assert.equal(M.idleFor(''), 'idle-look');
  assert.equal(M.forProp('drum'), 'use-drum');
  assert.equal(M.find('nope'), null);
  assert.equal(M.find('constructor'), null);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-moves.test.js`
Expected: FAIL (cannot find `moves.js`).

- [ ] **Step 3: Create `web/world/moves.js`**

```js
/* Her moves as plain maths: the emotes (emotes.js), each prop's ✨ Use action (items.js props) and the outfit idles.
   pose(id, p) gives offsets from her current pose at moment p (0 to 1), all zero at the start and the end, which
   avatar.js adds to her arms, legs, body and head. fx lists timed effects that build.js draws from FX. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;
  var KEYS = ['aLx', 'aLz', 'aRx', 'aRz', 'lLx', 'lRx', 'bx', 'by', 'brx', 'bry', 'brz', 'hrx', 'hry', 'hrz'];

  // Effects: emoji sprites that rise (vy) and drift (spread) for life seconds; n at a time (half on low quality).
  var FX = {
    bubbles: { e: ['🫧'], n: 6, vy: 1.2, spread: 1.4, life: 1.8 },
    petals: { e: ['🌸', '🌷'], n: 6, vy: -0.3, spread: 1.6, life: 2 },
    hearts: { e: ['💖', '💗'], n: 5, vy: 1.5, spread: 1, life: 1.6 },
    sparkles: { e: ['✨'], n: 7, vy: 0.8, spread: 1.6, life: 1.2 },
    notes: { e: ['🎵', '🎶'], n: 4, vy: 1.4, spread: 1, life: 1.6 },
    breeze: { e: ['💨'], n: 3, vy: 0.2, spread: 1.2, life: 1 },
    shine: { e: ['🌟'], n: 6, vy: 1, spread: 1.8, life: 1.4 },
    stars: { e: ['⭐'], n: 6, vy: 1.2, spread: 1.6, life: 1.4 },
    giggle: { e: ['😆'], n: 3, vy: 1.2, spread: 0.8, life: 1.4 }
  };

  function env(p) {
    var e = Math.max(0, Math.min(1, p / 0.2, (1 - p) / 0.2));
    return e * e * (3 - 2 * e);
  }
  function ease(p) { return p * p * (3 - 2 * p); }
  function hump(p) { return Math.sin(Math.PI * p); }
  function wave(p, n) { return Math.sin(p * TAU * n); }
  function move(len, fx, pose) { return { len: len, fx: fx, pose: pose }; }

  var MOVES = {
    'emote-wave': move(1.6, [], function (p, e) { return { aRz: (2.15 + wave(p, 3) * 0.4) * e, aRx: 0 }; }),
    'emote-clap': move(1.6, [[0.4, 'sparkles']], function (p, e) {
      var c = (0.35 + wave(p, 4) * 0.25) * e;
      return { aLx: -1.3 * e, aRx: -1.3 * e, aLz: c, aRz: -c };
    }),
    'emote-cheer': move(1.6, [[0.3, 'stars']], function (p, e) {
      return { aLz: (-2.35 + wave(p, 4) * 0.2) * e, aRz: (2.35 - wave(p, 4) * 0.2) * e, by: Math.abs(Math.sin(p * Math.PI * 2)) * 0.6 * e };
    }),
    'emote-bow': move(1.6, [], function (p) { return { brx: 0.6 * hump(p), hrx: 0.2 * hump(p) }; }),
    'emote-heart': move(1.8, [[0.35, 'hearts'], [0.65, 'hearts']], function (p, e) {
      return { aLz: -2.0 * e, aRz: 2.0 * e, aLx: -0.4 * e, aRx: -0.4 * e };
    }),
    'emote-giggle': move(1.6, [[0.2, 'giggle']], function (p, e) {
      return { aLx: -0.9 * e, aRx: -0.9 * e, brz: wave(p, 4) * 0.12 * e, by: Math.abs(wave(p, 4)) * 0.15 * e, hrz: wave(p, 4) * 0.2 * e };
    }),
    'emote-spin': move(1.6, [[0.5, 'sparkles']], function (p, e) { return { bry: ease(p) * TAU, aLz: -1.2 * e, aRz: 1.2 * e }; }),
    'emote-relax': move(2.5, [], function (p, e) {
      return { lLx: -1.45 * e, lRx: -1.45 * e, by: -1.0 * e, aLx: -0.3 * e, aRx: -0.3 * e, hrz: wave(p, 1) * 0.1 * e };
    }),
    'emote-dance': move(2.4, [[0.25, 'notes'], [0.75, 'notes']], function (p, e) {
      var s = wave(p, 3);
      return {
        by: Math.abs(Math.sin(p * Math.PI * 6)) * 0.5 * e, brz: s * 0.25 * e,
        aLz: -(1.4 + s * 0.6) * e, aRz: (1.4 - s * 0.6) * e, lLx: s * 0.5 * e, lRx: -s * 0.5 * e
      };
    }),
    // Turns about her middle (2.5 up), like a pet's roll in pettricks.js.
    'emote-cartwheel': move(1.8, [[0.5, 'stars']], function (p, e) {
      var a = ease(p) * TAU, h = 2.5;
      return { brz: a, bx: h * Math.sin(a), by: h - h * Math.cos(a) + hump(p) * 0.6, aLz: -2.4 * e, aRz: 2.4 * e };
    }),
    'emote-hero': move(2, [[0.3, 'shine']], function (p, e) {
      return { aLz: -0.7 * e, aRz: 0.7 * e, aLx: 0.4 * e, aRx: 0.4 * e, brx: -0.15 * e, by: Math.sin(Math.min(1, p / 0.3) * Math.PI) * 0.8 };
    }),

    'use-balloon': move(1.6, [[0.5, 'sparkles']], function (p) { return { aRx: -0.9 * hump(p) }; }),
    'use-bubblewand': move(2, [[0.25, 'bubbles'], [0.5, 'bubbles'], [0.75, 'bubbles']], function (p, e) { return { aRx: -1.0 * e }; }),
    'use-pamaypay': move(2, [[0.3, 'breeze'], [0.6, 'breeze']], function (p, e) { return { aRx: -1.2 * e, aRz: (-0.4 + wave(p, 3) * 0.3) * e }; }),
    'use-teddy': move(1.8, [[0.4, 'hearts']], function (p, e) {
      return { aLx: -1.3 * e, aRx: -1.3 * e, aLz: 0.5 * e, aRz: -0.5 * e, brz: wave(p, 1) * 0.1 * e };
    }),
    'use-bouquet': move(2, [[0.35, 'petals'], [0.65, 'petals']], function (p, e) { return { aRx: -1.3 * e, brx: 0.15 * e }; }),
    'use-umbrella': move(2, [[0.5, 'sparkles']], function (p, e) { return { aRx: -2.2 * e }; }),
    'use-ribbonwand': move(2.2, [[0.5, 'sparkles']], function (p, e) {
      return { aRz: (0.8 + wave(p, 2) * 0.8) * e, aRx: -1.0 * e, bry: wave(p, 1) * 0.3 * e };
    }),
    'use-drum': move(2, [[0.2, 'notes'], [0.5, 'notes'], [0.8, 'notes']], function (p, e) {
      return { aLx: -1.0 * e, aRx: (-0.9 - Math.abs(Math.sin(p * Math.PI * 6)) * 0.4) * e };
    }),
    'use-parol': move(2, [[0.4, 'sparkles'], [0.7, 'sparkles']], function (p, e) { return { aRx: -1.8 * e }; }),
    'use-ukulele': move(2.2, [[0.25, 'notes'], [0.5, 'notes'], [0.75, 'notes']], function (p, e) {
      return { aLx: -1.2 * e, aRx: (-1.0 + wave(p, 4) * 0.25) * e };
    }),
    'use-magicwand': move(2, [[0.3, 'sparkles'], [0.6, 'stars'], [0.85, 'sparkles']], function (p, e) {
      return { aRx: (-1.6 + wave(p, 2) * 0.5) * e };
    }),
    'use-trophy': move(2, [[0.35, 'shine'], [0.7, 'shine']], function (p, e) {
      return { aRz: 2.3 * e, by: Math.abs(Math.sin(p * Math.PI * 2)) * 0.4 * e };
    }),

    'idle-princess': move(2, [], function (p) {
      var c = hump(p);
      return { by: -0.35 * c, lLx: 0.3 * c, lRx: -0.2 * c, aLz: -0.5 * c, aRz: 0.5 * c };
    }),
    'idle-hero': move(2, [], function (p, e) { return { aLz: -0.7 * e, aRz: 0.7 * e, aLx: 0.4 * e, aRx: 0.4 * e, brx: -0.12 * e, hrx: -0.1 * e }; }),
    'idle-uniform': move(2, [], function (p, e) { return { aLx: wave(p, 2) * 0.5 * e, aRx: -wave(p, 2) * 0.5 * e }; }),
    'idle-look': move(2.4, [], function (p, e) { return { hry: wave(p, 1) * 0.6 * e }; })
  };

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function find(id) { return typeof id === 'string' && own(MOVES, id) ? MOVES[id] : null; }

  // Offsets at moment p, every key present (0 when the move leaves it alone). p is clamped to 0..1.
  function pose(id, p) {
    var m = find(id), k = Math.max(0, Math.min(1, p)), out = {}, o = m ? m.pose(k, env(k)) : {};
    KEYS.forEach(function (key) { out[key] = typeof o[key] === 'number' ? o[key] : 0; });
    return out;
  }

  // The effect kinds due after moment from, up to and including moment to.
  function effectsBetween(id, from, to) {
    var m = find(id);
    return m ? m.fx.filter(function (f) { return f[0] > from && f[0] <= to; }).map(function (f) { return f[1]; }) : [];
  }

  function forProp(id) { return 'use-' + id; }
  var IDLES = { princess: 'idle-princess', hero: 'idle-hero', uniform: 'idle-uniform' };
  function idleFor(clothes) { return own(IDLES, clothes || '') ? IDLES[clothes] : 'idle-look'; }

  var exported = { KEYS: KEYS, FX: FX, MOVES: MOVES, find: find, pose: pose, effectsBetween: effectsBetween, forProp: forProp, idleFor: idleFor };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Moves = exported;
})(this);
```

- [ ] **Step 4: Wire the file in**

- `tests/paths.js` `WORLD_FILES`: insert `'moves.js'` right after `'emotes.js'`.
- Both world pages: `<script src="moves.js"></script>` right after `emotes.js`.
- Run: `node tools/update-precache.js`

- [ ] **Step 5: Run the tests**

Run: `node --test`
Expected: PASS.

- [ ] **Step 6: Stage (do not commit)**

```bash
git add web/world/moves.js tests/world3d-moves.test.js tests/paths.js web/world/grade-5.html web/world/grade-2.html web/sw.js
```

---

### Task 5: The move runner

**Files:**
- Create: `web/world/moverun.js`
- Modify: `tests/paths.js`, both world pages (after `moves.js`), `web/sw.js` (tool)
- Test: `tests/world3d-moverun.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-moverun.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
global.World3D = { Moves: require(worldFile('moves.js')) };
const Run = require(worldFile('moverun.js'));

const still = { moving: false, free: true, clothes: '' };

test('a move runs once from k 0 to 1, with its effects, then ends', () => {
  const r = Run.create();
  assert.equal(r.start('use-bubblewand'), true);
  assert.equal(r.start('emote-wave'), false, 'one move at a time');
  const seen = [];
  let last = null;
  for (let i = 0; i < 25; i++) {
    const f = r.tick(0.1, still);
    if (f) { seen.push(...f.fx); last = f; }
  }
  assert.deepEqual(seen, ['bubbles', 'bubbles', 'bubbles']);
  assert.equal(last.k, 1);
  assert.equal(r.state(), null, 'ended');
});

test('walking, a panel or a stop() ends a move at once', () => {
  const r = Run.create();
  r.start('emote-dance');
  r.tick(0.1, still);
  assert.equal(r.tick(0.1, { moving: true, free: true }), null);
  assert.equal(r.state(), null);
  r.start('emote-dance');
  assert.equal(r.tick(0.1, { moving: false, free: false }), null);
  r.start('emote-dance');
  assert.equal(r.stop(), 'emote-dance');
  assert.equal(r.state(), null);
});

test('a demo at the stall keeps going while the panel is open, and replaces another demo', () => {
  const r = Run.create();
  assert.equal(r.start('emote-dance', true), true);
  assert.equal(r.tick(0.1, { moving: false, free: false }).move, 'emote-dance');
  assert.equal(r.start('emote-spin', true), true);
  assert.equal(r.state().move, 'emote-spin');
  assert.equal(r.state().demo, true);
});

test('after 8 s standing still and free she plays her outfit idle; a tap replaces an idle', () => {
  const r = Run.create();
  for (let i = 0; i < 79; i++) assert.equal(r.tick(0.1, { moving: false, free: true, clothes: 'princess' }), null);
  const f = r.tick(0.2, { moving: false, free: true, clothes: 'princess' });
  assert.equal(f.move, 'idle-princess');
  assert.equal(f.idle, true);
  assert.equal(r.start('emote-wave'), true, 'a tap replaces an idle');
  assert.equal(r.state().move, 'emote-wave');
});

test('moving or a panel resets the idle wait; unknown moves never start', () => {
  const r = Run.create();
  for (let i = 0; i < 60; i++) r.tick(0.1, still);
  r.tick(0.1, { moving: true, free: true });
  for (let i = 0; i < 60; i++) assert.equal(r.tick(0.1, still), null);
  assert.equal(r.start('nope'), false);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-moverun.test.js`
Expected: FAIL (cannot find `moverun.js`).

- [ ] **Step 3: Create `web/world/moverun.js`**

```js
/* Runs one of her moves (moves.js) at a time: an emote, a prop's ✨ Use, a demo at Kuya Pilo's stall, or her outfit idle
   after 8 s standing still. Walking or a panel ends a move at once (a stall demo keeps going). No Three.js. */
(function (root) {
  'use strict';
  var IDLE_AFTER = 8;

  function create() {
    // In Node the tests put World3D on the global object; in the browser it is window.World3D.
    var M = (root.World3D || World3D).Moves, run = null, still = 0;

    // demo: shown at the stall (keeps going while the panel is open; replaces another demo). A tap replaces an idle.
    function start(id, demo) {
      var m = M.find(id);
      if (!m || (run && !run.idle && !demo)) return false;
      run = { id: id, t: 0, k: 0, len: m.len, demo: !!demo, idle: id.indexOf('idle-') === 0 };
      still = 0;
      return true;
    }
    function stop() {
      var was = run ? run.id : null;
      run = null;
      return was;
    }

    // her = { moving, free, clothes }. Returns { move, k, fx: [kinds due now], idle } or null.
    function tick(dt, her) {
      var busy = her.moving || !her.free;
      if (run && !run.demo && busy) run = null;
      if (!run) {
        still = busy ? 0 : still + dt;
        if (still < IDLE_AFTER) return null;
        start(M.idleFor(her.clothes));
        dt = 0;
      }
      var from = run.k;
      run.t += dt;
      run.k = Math.min(1, run.t / run.len);
      var out = { move: run.id, k: run.k, fx: M.effectsBetween(run.id, from, run.k), idle: run.idle };
      if (run.k >= 1) run = null;
      return out;
    }

    function state() { return run ? { move: run.id, k: run.k, demo: run.demo, idle: run.idle } : null; }

    return { start: start, stop: stop, tick: tick, state: state };
  }

  var exported = { IDLE_AFTER: IDLE_AFTER, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MoveRun = exported;
})(this);
```

- [ ] **Step 4: Wire the file in**

- `tests/paths.js` `WORLD_FILES`: insert `'moverun.js'` right after `'moves.js'`.
- Both world pages: `<script src="moverun.js"></script>` right after `moves.js`.
- Run: `node tools/update-precache.js`

- [ ] **Step 5: Run the tests**

Run: `node --test`
Expected: PASS.

- [ ] **Step 6: Stage (do not commit)**

```bash
git add web/world/moverun.js tests/world3d-moverun.test.js tests/paths.js web/world/grade-5.html web/world/grade-2.html web/sw.js
```

---

### Task 6: Her pet watches a move (and an arms pet hops down)

**Files:**
- Modify: `web/world/petlife.js`
- Modify: `web/world/companion.js`
- Test: `tests/world3d-petlife.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/world3d-petlife.test.js` (it already requires petlife as `PL` — check the top of the file and use its name):

```js
test('watch: the pet watches her move for its length, one action at a time, then rests', () => {
  const s = PL.create();
  assert.equal(PL.startWatch(s, 2), true);
  assert.equal(s.action.kind, 'watch');
  assert.equal(PL.startTrick(s, 'trick-spin', 1.2), false, 'busy while watching');
  assert.equal(PL.startWatch(s, 2), false);
  PL.tick(s, 2.1, { moving: false });
  assert.equal(s.action, null);
  assert.equal(PL.busy(s), true, '1 s rest after');
  assert.equal(PL.mood(s, false), 'happy', 'happy after watching');
  const t = PL.create();
  PL.startTrick(t, 'trick-spin', 1.2);
  assert.equal(PL.startWatch(t, 2), false, 'a busy pet carries on');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-petlife.test.js`
Expected: FAIL (`PL.startWatch is not a function`).

- [ ] **Step 3: Add `startWatch` to `web/world/petlife.js`**

After `startPlay`:

```js
  // She does a move (moves.js); the pet watches her for its length.
  function startWatch(s, len) { return begin(s, { kind: 'watch', len: len }); }
```

Add `startWatch: startWatch,` to `exported`. Update the header comment's action list: "a trick, a toy held at the stall, fetch (…), play with her sister's pet or watching her do a move". (`end(s, true)` already sets `happy`, and `mood()` falls to `idle` while watching.)

- [ ] **Step 4: Add `watch` / `unwatch` to `web/world/companion.js`**

After `celebrate`:

```js
    // She does a move: the pet watches; a pet in her arms hops down first and climbs back after (tick's stop()).
    // False when the pet is busy: it carries on where it is.
    function watch(her, len) {
      if (!pet || !PL.startWatch(life, len)) return false;
      if (spot === 'arms') hopDown(her);
      return true;
    }
    function unwatch() { if (life.action && life.action.kind === 'watch') stop(); }
```

In `tick`, add a branch before `else if (spot === 'walk' && her.front) show(her);`:

```js
      else if (a && a.kind === 'watch') { if (walking()) pet.group.lookAt(her.x, 0, her.z); }
```

Return them: add `watch: watch, unwatch: unwatch` to the returned object. (`if (!a && (fetch || toy || playing || down)) stop();` already climbs an arms pet back once the watch ends.)

- [ ] **Step 5: Run the tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS (nothing calls `watch` yet; the e2e proves companion still loads).

- [ ] **Step 6: Stage (do not commit)**

```bash
git add web/world/petlife.js web/world/companion.js tests/world3d-petlife.test.js
```

---

### Task 7: Her character holds a prop, carries a pet in one arm and does moves

**Files:**
- Modify: `web/world/avatar.js`
- Test: e2e (Task 11) and renders (Task 12); no Node test (avatar.js needs a canvas for the face)

- [ ] **Step 1: Hand mount, prop and one-arm carry**

In `character()`, after `var armL = limb(...), armR = limb(...);` and the mounts block, replace

```js
    var mounts = { shoulder: new THREE.Group(), head: new THREE.Group(), arms: new THREE.Group() };
```

with

```js
    var mounts = { shoulder: new THREE.Group(), head: new THREE.Group(), arms: new THREE.Group(), hand: new THREE.Group() };
```

replace `mounts.arms.position.set(0, 1.9, 1.25);` with

```js
    // One-arm carry: a pet in her arms sits in her left arm, so her right hand is free for a prop.
    mounts.arms.position.set(-0.55, 1.9, 1.15);
```

and after `body.add(mounts.arms);` add

```js
    // Her grip, at the end of her right arm. HOLD is the arm's angle while she holds a prop; the hand turns back by the
    // same angle so the prop stands upright (wear.js builds props with +y up).
    mounts.hand.position.set(0, -1.2, 0.12);
    mounts.hand.rotation.x = -HOLD;
    armR.add(mounts.hand);
    var held = Wr.prop(S, mounts.hand, wear.prop);
```

Add `HOLD = -0.6` to the top-level `var` line with `SHOE`, `SHORTS`… (`var SHOE = '#ffffff', ..., HOLD = -0.6;`).

- [ ] **Step 2: The new `animate`**

Replace `animate` with:

```js
    // pose (optional): { sit } on a ride, { cheer } both arms up, { wave } her sister by the gate, { ride } on a playground
    // ride (her prop is put away), { move, k } a move from moves.js at moment k.
    function animate(t, walkT, mag, pose) {
      var m = Math.min(1, mag), sw = Math.sin(walkT) * 0.7 * m, hop = Math.abs(Math.sin(walkT));
      body.position.x = 0;
      body.rotation.set(0, 0, 0);
      head.rotation.x = head.rotation.y = 0;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw; armR.rotation.x = held ? HOLD + sw * 0.3 : sw;
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
      if (carry && !(pose && pose.cheer)) {
        armL.rotation.x = -1.1;
        armL.rotation.z = 0.55;
      }
      if (pose && pose.wave) {
        armR.rotation.x = 0;
        armR.rotation.z = 2.4 + Math.sin(t * 8) * 0.4;
      }
      head.rotation.z = Math.sin(t * 1.6) * 0.05;
      head.position.y = 4.1 + Math.sin(t * 2.2) * 0.05;
      if (pose && pose.move) {
        var o = W.Moves.pose(pose.move, pose.k);
        armL.rotation.x += o.aLx; armL.rotation.z += o.aLz;
        armR.rotation.x += o.aRx; armR.rotation.z += o.aRz;
        legL.rotation.x += o.lLx; legR.rotation.x += o.lRx;
        body.position.x = o.bx;
        body.position.y += o.by;
        body.rotation.set(o.brx, o.bry, o.brz);
        head.rotation.x = o.hrx; head.rotation.y = o.hry; head.rotation.z += o.hrz;
      }
      mounts.hand.visible = !(pose && pose.ride);
      if (held) held.animate(t, pose && pose.move === 'use-' + wear.prop ? pose.k : null);
      shine.animate(t);
    }
```

In `dispose()` add `if (held) held.dispose();`.
Return the prop id too: `return { group: group, animate: animate, dispose: dispose, mounts: mounts, prop: held ? wear.prop : '' };`
Update the file header comment: "…with mounts where a small pet rides (petbody.js) and a hand that holds her prop (wear.js)."

- [ ] **Step 3: Run the tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS (the pet-stall case covers an arms pet: kitten → `arms` in the `pets` mode still mounts).

- [ ] **Step 4: Stage (do not commit)**

```bash
git add web/world/avatar.js
```

---

### Task 8: Effects in `build.js`

**Files:**
- Modify: `web/world/build.js`

- [ ] **Step 1: Add `fx` and `fxLive`**

After `burst(...)`, add:

```js
    // Effects of her moves (moves.js FX): emoji sprites that rise, drift and fade. At most MAX_FX at once, half as many
    // per puff on low quality. Textures are made once and kept.
    var MAX_FX = 40, fxTex = {};
    function fxLive() { return sparks.filter(function (p) { return p.fx; }).length; }
    function fx(x, y, z, kind) {
      var f = W.Moves.FX[kind];
      if (!f) return 0;
      var n = Math.max(0, Math.min(S.detail.visible ? f.n : Math.ceil(f.n / 2), MAX_FX - fxLive()));
      for (var i = 0; i < n; i++) {
        var e = f.e[i % f.e.length], s = S.sprite(fxTex[e] || (fxTex[e] = S.emoji(e)), 0.7, 0.7);
        s.position.set(x + (Math.random() - 0.5) * f.spread, y + Math.random() * 0.5, z + (Math.random() - 0.5) * f.spread);
        S.scene.add(s);
        sparks.push({ s: s, vx: (Math.random() - 0.5) * f.spread, vz: (Math.random() - 0.5) * f.spread, vy: f.vy + Math.random() * 0.5, life: f.life, keep: true, fx: true });
      }
      return n;
    }
```

Add `fx: fx, fxLive: fxLive` to the returned object of `build()`.

- [ ] **Step 2: Run the tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 3: Stage (do not commit)**

```bash
git add web/world/build.js
```

---

### Task 9: Kuya Pilo's stall in the world

**Files:**
- Modify: `web/world/layout.js`, `web/world/build.js`, `web/world/cast.js`, `web/world/folk.js`
- Test: `tests/world3d-layout.test.js`

- [ ] **Step 1: Write the failing layout test**

Append to `tests/world3d-layout.test.js`:

```js
for (const grade of ['grade5', 'grade2']) {
  test(grade + ": Kuya Pilo's Toy Stall stands in a row south of Lola Lana's, clear of trees, paths and the other stalls", () => {
    const pr = L.props(grade), shop = L.places(grade).shop, items = L.interactables(grade), obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    const pilo = items.find((i) => i.id === 'toyshop');
    assert.ok(pilo && pilo.kind === 'toyshop', 'toyshop item');
    assert.deepEqual([pr.toyStall.x, pr.toyStall.z], [61, -16]);
    assert.ok(Math.hypot(pr.pilo.x - shop.x, pr.pilo.z - shop.z) <= 18, 'Kuya Pilo is by Shop Plaza');
    assert.equal(L.nearest(items, pilo.x, pilo.z).id, 'toyshop');
    for (const id of ['counter', 'boutique', 'petshop']) {
      const it = items.find((i) => i.id === id);
      assert.equal(L.nearest(items, it.x, it.z).id, id, id + ' still finds its own');
    }
    assert.equal(L.blocked(obs, b, pilo.x, pilo.z, L.PLAYER_R), false, 'she can stand there');
    assert.equal(L.blocked(obs, b, pr.toyStall.x, pr.toyStall.z, 0.1), true, 'the stall is solid');
    assert.equal(L.blocked(obs, b, pr.pilo.x, pr.pilo.z, 0.1), true, 'Kuya Pilo is solid');
    assert.ok(!L.onPath(grade, pr.toyStall.x, pr.toyStall.z, pr.toyStall.hz), 'the stall is off the path');
    for (const t of L.trees(grade)) assert.ok(Math.hypot(t.x - pr.toyStall.x, t.z - pr.toyStall.z) > 3.5, 'no tree in the stall');
    const gap = Math.abs(pr.toyStall.z - pr.stall.z) - pr.toyStall.hz - pr.stall.hz;
    assert.ok(gap >= 2, "room between Lola Lana's stall and Kuya Pilo's");
  });
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-layout.test.js`
Expected: FAIL (`pr.toyStall` undefined).

- [ ] **Step 3: `web/world/layout.js`**

In `props()`, after `kiko: …,` add:

```js
      toyStall: { x: 61, z: -16, hx: 2, hz: 1.5 },
      pilo: { x: 57.8, z: -16, r: 0.8 },
```

In `obstacles()`, add `pr.toyStall` to the boxes list (after `pr.petStall`) and `pr.pilo` to the circles list (after `pr.kiko`).
In `interactables()`, after the `petshop` line:

```js
    list.push({ kind: 'toyshop', id: 'toyshop', x: pr.pilo.x - 2.2, z: pr.pilo.z, r: 2.6 });
```

- [ ] **Step 4: The stall in `web/world/build.js`**

After `petStall()`:

```js
    // Kuya Pilo's Toy Stall: south of Lola Lana's, in sunny yellow, with toys on the counter.
    function toyStall() {
      var s = pr.toyStall, g = group(s.x, s.z, -Math.PI / 2);
      add(rbox(s.hz * 2, 1.3, s.hx * 2, 0.3), '#fff2b3', 0, 0.65, 0, g);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) { add(S.cyl(0.1, 0.1, 3.6, 8), '#ffffff', c[0] * (s.hz - 0.2), 1.8, c[1] * (s.hx - 0.2), g); });
      for (var k = 0; k < 5; k++) add(rbox(0.6, 0.3, s.hx * 2 + 0.4, 0.1), k % 2 ? '#ffffff' : '#ffb347', -1.2 + k * 0.6, 3.7, 0, g);
      add(ball(0.3), '#ff6f91', -0.6, 1.6, s.hx - 0.6, g);
      add(S.cone(0.25, 0.5, 6), '#6aa9ff', 0, 1.55, s.hx - 0.6, g);
      add(rbox(0.45, 0.45, 0.45, 0.1), '#7fdc8b', 0.6, 1.55, s.hx - 0.6, g);
      floatSign('🎈 ' + T.toyshop, '#ffb347', 0, 6, 0, 6 * cfg.signScale, g);
    }
```

Call `toyStall();` right after `petStall();` near the bottom of `build()`.

- [ ] **Step 5: Kuya Pilo in `web/world/cast.js`**

After `kiko(S)`:

```js
  // Kuya Pilo, the pilandok (Palawan mouse deer) of the toy stall: a small brown deer with big ears and eyes, thin legs
  // and a yellow apron. Pilandok is the clever hero of Filipino folk tales.
  function pilo(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, FUR = '#b5835a', LIGHT = '#f1dcc4', PINK = '#f3c1b0';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(ball(0.75), FUR, 0, 1.45, 0, body).scale.set(0.9, 1.1, 0.85);
    add(ball(0.45), LIGHT, 0, 1.35, 0.45, body).scale.set(1, 1.3, 0.5);
    add(S.rbox(0.9, 0.8, 0.12, 0.06), '#ffd166', 0, 1.3, 0.66, body);
    [-1, 1].forEach(function (s) {
      add(S.cyl(0.09, 0.07, 0.9, 8), FUR, s * 0.3, 0.45, 0, body);
      add(S.cyl(0.08, 0.06, 0.8, 8), FUR, s * 0.62, 1.55, 0.1, body).rotation.z = s * 0.4;
    });
    var top = head(S, FUR, { mouth: 'muzzle', eye: 30, gap: 46 }, 1.5, 1.35, 1.4, 0.6);
    top.position.y = 2.65;
    body.add(top);
    add(ball(0.32), LIGHT, 0, -0.3, 0.75, top).scale.set(1.2, 0.8, 0.8);
    [-1, 1].forEach(function (s) {
      var ear = add(ball(0.42), FUR, s * 0.8, 0.75, -0.1, top);
      ear.scale.set(0.55, 1.1, 0.3);
      ear.rotation.z = -s * 0.5;
      var inner = add(ball(0.3), PINK, s * 0.8, 0.75, 0.02, top);
      inner.scale.set(0.4, 0.85, 0.2);
      inner.rotation.z = -s * 0.5;
    });
    return life(group, body, top, 2.1);
  }
```

Add `pilo: pilo` to `W.Cast`.

- [ ] **Step 6: `web/world/folk.js`**

- After `var kiko = place(...)`: `var pilo = place(W.Cast.pilo(S), pr.pilo.x, pr.pilo.z, -Math.PI / 2);`
- `label`: after the `petshop` line add `if (it.kind === 'toyshop') return T.toyshopGo;`
- `act`: change to `else if (it.kind === 'boutique' || it.kind === 'petshop' || it.kind === 'toyshop') o.stall(it.kind);`
- `tick`: add `pilo.animate(t);`
- `handles`: add `|| kind === 'toyshop'`.

(world-main's `openStall` does not know `toyshop` until Task 10; until then the act opens the boutique panel. Task 10 follows directly.)

- [ ] **Step 7: Run the tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 8: Stage (do not commit)**

```bash
git add web/world/layout.js web/world/build.js web/world/cast.js web/world/folk.js tests/world3d-layout.test.js
```

---

### Task 10: The toy stall panel and the mirror link

**Files:**
- Create: `web/world/toyshop.js`
- Modify: `tests/paths.js` (after `petshop.js`), both world pages, `web/sw.js` (tool)
- Modify: `web/world/world-main.js` (`openStall`, debug), `web/world/maker.js` (link)

- [ ] **Step 1: Create `web/world/toyshop.js`**

```js
/* Kuya Pilo's Toy Stall: the props (items.js) and the emotes (emotes.js) in the shared stall panel (stall.js). Trying a
   prop puts it in her hand; an emote is shown by her doing it once (o.demo). */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o: as stall.js, without title, hello, cls and cat; plus demo(id) to show an emote.
  function open(o) {
    var I = W.Items, E = W.Emotes;
    var isEmote = function (it) { return it.kind === 'emote'; };
    return W.Stall.open(Object.assign({}, o, {
      title: '🎈 ' + o.T.toyshop, hello: o.T.piloHello, cls: 'bt-toys',
      cat: {
        groups: ['props', 'emotes'],
        items: function (g) { return g === 'emotes' ? E.EMOTES.slice() : I.inGroup('props'); },
        find: function (id) { return E.find(id) || I.find(id); },
        name: function (it) { return isEmote(it) ? E.name(it, o.grade) : I.name(it, o.grade); },
        on: function (l, it) { return !isEmote(it) && l.wear.prop === it.id; },
        put: function (l, it, saved) { if (!isEmote(it)) l.wear.prop = l.wear.prop === it.id ? saved.wear.prop : it.id; },
        keep: function (l, it) { if (!isEmote(it)) l.wear.prop = it.id; },
        play: function (it) {
          if (!isEmote(it)) return false;
          if (o.demo) o.demo(it.id);
          return true;
        }
      }
    }));
  }

  W.ToyShop = { open: open };
})(this);
```

Wire it: `tests/paths.js` `WORLD_FILES` insert `'toyshop.js'` after `'petshop.js'`; both pages `<script src="toyshop.js"></script>` after `petshop.js`; `node tools/update-precache.js`.

- [ ] **Step 2: `openStall` in `web/world/world-main.js`**

The moves runner arrives in Task 11; this step only opens the panel. Change the panel pick and `via`:

```js
      stall = (kind === 'petshop' ? W.PetShop : kind === 'toyshop' ? W.ToyShop : W.Boutique).open({
```

```js
            via: kind === 'petshop' ? 'pets' : kind === 'toyshop' ? 'toys' : 'wardrobe'
```

and in `onBought` treat emotes like tricks (no look to save):

```js
          if (it.kind !== 'trick' && it.kind !== 'toy' && it.kind !== 'emote') {
```

Debug (next to `debug.petshopOpen`):

```js
    debug.toyshopOpen = function () { return stallKind === 'toyshop'; };
```

and change `debug.boutique = debug.petshop = {` to `debug.boutique = debug.petshop = debug.toyshop = {`.

`demo` is already passed (`demo: function (id) { pal.demo(id); }`); Task 11 changes it to route emotes to her moves.

- [ ] **Step 3: The mirror's third link (`web/world/maker.js`)**

After `box.appendChild(button('maker-shop', T.petsMore, shop));`:

```js
    box.appendChild(button('maker-shop', T.toysMore, shop));
```

Update the header comment: "the links to Lola Lana's, Mang Kiko's and Kuya Pilo's save too and call o.onShop."

- [ ] **Step 4: Run the tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 5: Stage (do not commit)**

```bash
git add web/world/toyshop.js tests/paths.js web/world/grade-5.html web/world/grade-2.html web/sw.js web/world/world-main.js web/world/maker.js
```

---

### Task 11: The ✨ Use and 😊 Emote buttons and the runtime

**Files:**
- Create: `web/world/usebar.js`
- Modify: `tests/paths.js` (after `playbar.js`), both world pages, `web/sw.js` (tool)
- Modify: `web/world/playbar.js`, `web/world/world-main.js`, `web/world/world.css`

- [ ] **Step 1: Create `web/world/usebar.js`**

```js
/* The ✨ Use button (shown while she holds a prop) and the 😊 Emote button with the row of her emotes (emotes.js).
   Tap an emote and she does it; a tap anywhere else closes the row. Buttons are English on both grades. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { doc, T, owned() → wardrobe_v1 owned map, held() → her prop id or '', use(), pick(id), onOpen() }
  function create(o) {
    var doc = o.doc, row = doc.createElement('div');
    function pill(cls, text, onClick) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'w-pill ' + cls;
      b.textContent = text;
      b.addEventListener('click', onClick);
      return b;
    }
    var useBtn = pill('w-use', o.T.use, function () { o.use(); });
    var emoteBtn = pill('w-emote', o.T.emote, function () { if (row.hidden) open(); else close(); });
    emoteBtn.setAttribute('aria-expanded', 'false');
    row.className = 'w-emoterow';
    row.hidden = true;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', o.T.emote);

    function open() {
      if (o.onOpen) o.onOpen();
      row.textContent = '';
      W.Emotes.usable(o.owned()).forEach(function (id) {
        var it = W.Emotes.find(id), b = pill('w-play-item', it.icon + ' ' + it.en, function () {
          close();
          o.pick(id);
        });
        b.setAttribute('data-emote', id);
        row.appendChild(b);
      });
      row.hidden = false;
      emoteBtn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      row.hidden = true;
      emoteBtn.setAttribute('aria-expanded', 'false');
    }

    doc.addEventListener('pointerdown', function (e) {
      if (!row.hidden && !row.contains(e.target) && e.target !== emoteBtn) close();
    });
    doc.body.appendChild(row);
    doc.body.appendChild(emoteBtn);
    doc.body.appendChild(useBtn);

    return {
      open: open, close: close,
      isOpen: function () { return !row.hidden; },
      items: function () { return [].map.call(row.querySelectorAll('[data-emote]'), function (b) { return b.getAttribute('data-emote'); }); },
      press: function (id) {
        var b = row.querySelector('[data-emote="' + id + '"]');
        if (b) b.click();
        return !!b;
      },
      use: function () { if (!useBtn.hidden) useBtn.click(); return !useBtn.hidden; },
      useShown: function () { return !useBtn.hidden; },
      show: function (on) {
        emoteBtn.hidden = !on;
        useBtn.hidden = !on || !o.held();
        if (!on && !row.hidden) close();
      }
    };
  }

  W.UseBar = { create: create };
})(this);
```

Wire it: `WORLD_FILES` insert `'usebar.js'` after `'playbar.js'`; both pages `<script src="usebar.js"></script>` after `playbar.js`; `node tools/update-precache.js`.

- [ ] **Step 2: `onOpen` in `web/world/playbar.js`**

Document it in the `o = {…}` comment (`onOpen()` optional) and call it first thing in `open()`:

```js
    function open() {
      if (o.onOpen) o.onOpen();
      row.textContent = '';
```

- [ ] **Step 3: Button positions in `web/world/world.css`**

The right column stacks Treat (124), Play (180), Emote (236), Use (292); both rows open above it at 348. Replace the `.w-play` / `.w-playrow` block (lines 143–155) with:

```css
.w-play { position: fixed; right: 16px; bottom: 180px; }
.w-emote { position: fixed; right: 16px; bottom: 236px; }
.w-use { position: fixed; right: 16px; bottom: 292px; }
.w-playrow, .w-emoterow { position: fixed; right: 16px; bottom: 348px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; max-width: calc(100vw - 32px); }
.w-play-item { min-height: 44px; }
@media (max-height: 520px) {
  .w-play { bottom: 148px; }
  .w-emote { bottom: 204px; }
  .w-use { bottom: 260px; }
  .w-playrow, .w-emoterow { bottom: 316px; }
}
@media (max-width: 600px) {
  .w-play { right: auto; left: 24px; bottom: calc(max(24px, env(safe-area-inset-bottom)) + 208px); }
  .w-joy.big ~ .w-play { bottom: calc(max(24px, env(safe-area-inset-bottom)) + 244px); }
  .w-emote { right: auto; left: 24px; bottom: calc(max(24px, env(safe-area-inset-bottom)) + 264px); }
  .w-joy.big ~ .w-emote { bottom: calc(max(24px, env(safe-area-inset-bottom)) + 300px); }
  .w-use { right: auto; left: 24px; bottom: calc(max(24px, env(safe-area-inset-bottom)) + 320px); }
  .w-joy.big ~ .w-use { bottom: calc(max(24px, env(safe-area-inset-bottom)) + 356px); }
  .w-playrow, .w-emoterow { right: auto; left: 16px; justify-content: flex-start; bottom: calc(max(24px, env(safe-area-inset-bottom)) + 376px); }
  .w-joy.big ~ .w-playrow, .w-joy.big ~ .w-emoterow { bottom: calc(max(24px, env(safe-area-inset-bottom)) + 412px); }
}
```

(`.w-joy.big ~ …` only matches siblings after the joystick; usebar appends its nodes after world-main's HUD, so it holds.)

- [ ] **Step 4: The runtime in `web/world/world-main.js`**

a) After the `var bar = W.PlayBar.create({...});` block, add `onOpen: function () { useBar.close(); }` inside the PlayBar options, then:

```js
    var runner = W.MoveRun.create(), fxAt = new S.THREE.Vector3();
    // She does a move herself (an emote or her prop's ✨ Use); her pet watches.
    function startMove(id) {
      if (maker || stall || overlay || talking || riding || !runner.start(id)) return false;
      pal.watch(ctl.state, W.Moves.find(id).len);
      return true;
    }
    var useBar = W.UseBar.create({
      doc: doc, T: T,
      owned: function () { return W.Closet.read(store); },
      held: function () { return me ? me.prop : ''; },
      use: function () { if (me && me.prop) startMove(W.Moves.forProp(me.prop)); },
      pick: function (id) { if (W.Emotes.owns(W.Closet.read(store), id)) startMove(id); },
      onOpen: function () { bar.close(); }
    });
```

(`bar` and `useBar` refer to each other only inside callbacks, so the order is fine.)

b) In `openStall`'s options, route emotes to her and tricks/toys to her pet:

```js
        demo: function (id) { if (W.Emotes.find(id)) runner.start(id, true); else pal.demo(id); },
```

and in its `onClose`, first line: `runner.stop();`.

c) In `goTo(spot)`, first line: `runner.stop();`.

d) In `tick(dt)`, replace the block from `var st = ctl.update(dt), pose = play.tick(dt);` to `me.animate(t, st.walkT, st.mag);` (the end of the `else` branch) with:

```js
      var st = ctl.update(dt), pose = play.tick(dt), free = !maker && !stall && !overlay && !talking;
      var mv = pose ? (runner.stop(), null) : runner.tick(dt, { moving: st.mag > 0, free: free, clothes: shown ? shown.wear.clothes : '' });
      if (!mv) pal.unwatch();
      var mp = mv ? { move: mv.move, k: mv.k } : undefined;
      if (pose) {
        me.group.position.set(pose.x, pose.y, pose.z);
        me.group.rotation.y = pose.face;
        ctl.camera(dt);
        me.animate(t, 0, 0, Object.assign({ ride: true }, pose));
      } else {
        me.group.position.set(st.x, 0, st.z);
        if (maker || stall) {
          me.group.rotation.y += dt * 0.8;
          ctl.portrait();
        } else {
          me.group.rotation.y = st.face;
          ctl.camera(dt);
        }
        me.animate(t, st.walkT, st.mag, mp);
      }
      if (mv) mv.fx.forEach(function (kind) {
        if (mv.move.indexOf('use-') === 0) me.mounts.hand.getWorldPosition(fxAt);
        else fxAt.set(me.group.position.x, 4.5, me.group.position.z);
        world.fx(fxAt.x, fxAt.y + 0.8, fxAt.z, kind);
      });
```

Then remove the now-duplicate `var free = !maker && !stall && !overlay && !talking;` line further down in `tick`, and next to `bar.show(free && !pose);` add `useBar.show(free && !pose);`.

e) Escape closes the emote row: in the `keydown` handler, before the play-row line:

```js
      if (e.key === 'Escape' && useBar.isOpen()) { useBar.close(); return; }
```

f) `hud.show(false)` hides Treat while a panel is open; the bars hide themselves through `show()` each frame, so nothing else is needed.

g) Debug (next to `debug.playBar`):

```js
    debug.useBar = { open: useBar.open, items: useBar.items, press: useBar.press, isOpen: useBar.isOpen, use: useBar.use, useShown: useBar.useShown };
    debug.move = function () { return runner.state(); };
    debug.holding = function () { return me ? me.prop : ''; };
    debug.fxLive = function () { return world.fxLive(); };
```

- [ ] **Step 5: Run the tests**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS (existing cases; the new case comes in Task 12).

- [ ] **Step 6: Stage (do not commit)**

```bash
git add web/world/usebar.js tests/paths.js web/world/grade-5.html web/world/grade-2.html web/sw.js web/world/playbar.js web/world/world-main.js web/world/world.css
```

---

### Task 12: End-to-end: the toy stall, Use, Emote, idles and the mirror

**Files:**
- Modify: `tests/e2e/world-driver.page.js` (new mode `toys`; add `toys` to the header comment's list)
- Modify: `tests/e2e/world-e2e.js`

- [ ] **Step 1: The driver mode**

In `world-driver.page.js`, before `if (mode === 'cheer') {`, add:

```js
    if (mode === 'toys') {
      D.pause();
      var pq = World3D.Layout.props('grade5').pilo;
      D.teleport('shop');
      D.stand(pq.x - 2.2, pq.z);
      o.near = D.state().near;
      o.act = text('#act');
      D.act();
      o.open = D.toyshopOpen();
      o.title = text('.maker-title');
      o.propCards = [].map.call(document.querySelectorAll('.bt-card'), function (c) { return c.getAttribute('data-item'); });
      o.balloonFree = text('.bt-card[data-item="balloon"] .bt-owned');
      D.toyshop.tryOn('magicwand');
      o.trying = D.wearing().prop;
      D.toyshop.tab('emotes');
      o.emoteCards = document.querySelectorAll('.bt-card').length;
      D.toyshop.tryOn('emote-dance');
      D.tick(0.1);
      o.demo = D.move();
      D.toyshop.tab('props');
      D.toyshop.buy('ukulele');
      o.confirm = text('.bt-confirm-text');
      D.toyshop.yes();
      D.toyshop.tab('emotes');
      D.toyshop.buy('emote-spin');
      D.toyshop.yes();
      o.owned = Object.keys(JSON.parse(Learner.storage.getItem('wardrobe_v1')).owned).sort();
      o.bought = StudyHistory.list().filter(function (e) { return e.type === 'purchase'; }).map(function (e) { return [e.item, e.coins, e.via]; })
        .sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
      D.toyshop.close();
      o.afterClose = { holding: D.holding(), move: D.move(), saved: JSON.parse(Learner.storage.getItem('avatar_v1')).wear.prop };
      D.teleport('gate');
      for (var w = 0; w < 20; w++) D.tick(0.1);
      o.useShown = D.useBar.useShown();
      D.useBar.use();
      D.tick(0.1);
      o.using = D.move();
      o.petWatch = D.pet.state();
      for (w = 0; w < 30; w++) D.tick(0.1);
      o.afterUse = { move: D.move(), pet: D.pet.state() };
      o.fx = D.fxLive();
      D.useBar.open();
      o.emotes = D.useBar.items();
      D.useBar.press('emote-spin');
      o.rowClosed = !D.useBar.isOpen();
      D.tick(0.1);
      o.spin = D.move();
      D.teleport('plaza');
      o.cancelled = D.move();
      for (w = 0; w < 90; w++) D.tick(0.1);
      o.idle = D.move();
      D.teleport('house');
      D.stand(47, 49.6);
      D.act();
      D.maker.tab('props');
      o.mirrorProps = [].map.call(document.querySelectorAll('.maker-opt[data-field="wear.prop"]'), function (b) { return b.getAttribute('data-value'); });
      D.maker.pick('wear.prop', 'balloon');
      D.maker.done();
      o.mirrorSaved = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.prop;
      o.holdingAfter = D.holding();
      return out(o);
    }
```

- [ ] **Step 2: The test case**

In `world-e2e.js`, after the `tricks` block (after `console.log('ok tricks and fetch: …')`):

```js
  // Kuya Pilo's Toy Stall: try a prop, see an emote, buy a prop and an emote; Use with an arms pet; the Emote row;
  // teleport ends a move; an outfit idle after standing still; the mirror Props tab.
  const TOYS = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "bob", hairColor: 2, outfit: 3, pet: "kitten", petSpot: "arms", petName: "", t: 5 }));'
    + 'Learner.storage.setItem("wallet_v1", JSON.stringify({ v: 1, baselines: {}, spent: 0, bonus: 600, purchases: [], oldPointsCounted: true }));</script>';
  const ty = run('toys', stageWorld('toys', 5, TOYS), 'toys');
  assert.deepEqual(ty.errors, [], 'toys: page errors');
  assert.equal(ty.near, 'toyshop');
  assert.equal(ty.act, "🎈 Open Kuya Pilo's Toy Stall");
  assert.equal(ty.open, true);
  assert.equal(ty.title, "🎈 Kuya Pilo's Toy Stall");
  assert.equal(ty.propCards.length, 12);
  assert.equal(ty.balloonFree, '🎁 Free');
  assert.equal(ty.trying, 'magicwand', 'trying a prop puts it in her hand');
  assert.equal(ty.emoteCards, 11);
  assert.deepEqual([ty.demo.move, ty.demo.demo], ['emote-dance', true], 'trying an emote: she does it');
  assert.equal(ty.confirm, 'Buy Ukulele for 300 coins?');
  assert.deepEqual(ty.owned, ['emote-spin', 'ukulele']);
  assert.deepEqual(ty.bought, [['emote-spin', 150, 'toys'], ['ukulele', 300, 'toys']]);
  assert.deepEqual(ty.afterClose, { holding: 'ukulele', move: null, saved: 'ukulele' }, 'a bought prop stays in her hand');
  assert.equal(ty.useShown, true);
  assert.equal(ty.using.move, 'use-ukulele');
  assert.deepEqual([ty.petWatch.action, ty.petWatch.down], ['watch', true], 'the kitten hops down from her arms to watch');
  assert.equal(ty.afterUse.move, null);
  assert.deepEqual([ty.afterUse.pet.action, ty.afterUse.pet.down], [null, false], 'and climbs back');
  assert.ok(ty.fx <= 40, 'effects stay under the cap');
  assert.deepEqual(ty.emotes, ['emote-wave', 'emote-clap', 'emote-cheer', 'emote-spin']);
  assert.equal(ty.rowClosed, true);
  assert.equal(ty.spin.move, 'emote-spin');
  assert.equal(ty.cancelled, null, 'quick travel ends a move');
  assert.ok(ty.idle && ty.idle.idle && ty.idle.move.indexOf('idle-') === 0, 'an outfit idle after standing still');
  assert.deepEqual(ty.mirrorProps, ['', 'balloon', 'ukulele'], 'the mirror lists None, the free balloon and what she owns');
  assert.equal(ty.mirrorSaved, 'balloon');
  assert.equal(ty.holdingAfter, 'balloon');
  console.log('ok toy stall: try, demo, buy, Use, Emote row, idle, mirror Props');
```

Note: `D.teleport('plaza')` exists only if `plaza` is a spot id; check `L.spots(grade)` ids (`gate`, `plaza`, …) and use any other place id if needed. `D.stand(47, 49.6)` + `D.act()` opens the mirror, as in the `pets` mode.

- [ ] **Step 3: Run it**

Run: `node tests/e2e/world-e2e.js`
Expected: all cases `ok`, including `ok toy stall: …`.
If an assertion fails, fix the code under test (not the assertion) unless the assertion contradicts the spec.

- [ ] **Step 4: Run everything**

Run: `node --test` then `node tests/e2e/world-e2e.js`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/sisters-e2e.js`, `node tests/e2e/backup-e2e.js`
Expected: PASS.

- [ ] **Step 5: Stage (do not commit)**

```bash
git add tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 13: Visual check with headless renders, then tune

**Files:**
- Scratch only (session scratchpad); tuning edits go to `web/world/wear.js`, `web/world/avatar.js`, `web/world/moves.js`, `web/world/cast.js`, `web/world/build.js`

Chrome's `--screenshot` shows a blank WebGL canvas. Read the canvas right after `S.render()` with `toDataURL` and dump it through `--dump-dom`.

- [ ] **Step 1: Write the render harness in the scratchpad**

Base it on `tests/e2e/world-e2e.js`'s `stageWorld` (copy the staging: `stage()`, vendor files, `world.css`) and, in the staged copy of `world/world-main.js` only, replace `debug.ready = true;` with `debug.S = S; debug.ready = true;`. Seed `world3d_v1` as `CALM` does and an `avatar_v1` with `wear.prop` set (and `wardrobe_v1` owning it). The page driver, per shot:

```js
// after WorldDebug.ready: D.pause(); position her; pick the camera; then
S.render();
var png = S.renderer.domElement.toDataURL('image/png');
// append <pre id="dbg">{"png": png}</pre>; Node decodes it to a .png file
```

Shots to take (grade 5, then 2 or 3 also on grade 2):
1. Each of the 12 props held, front three-quarter view (camera at her x+5, y 4, z+8 looking at her y 3), standing still.
2. Each prop's ✨ Use at k = 0.5: `D.useBar.use(); D.tick(len * 0.5)` before rendering.
3. Each emote at k = 0.5 (`D.useBar.open(); D.useBar.press(id)` — seed ownership of all emotes) and the 4 idles (`runner` via `D.useBar`… use `WorldDebug` + `World3D.MoveRun` not reachable: instead trigger an idle by ticking 8.2 s still with the matching clothes).
4. An arms pet (kitten) with a prop: one-arm carry.
5. Kuya Pilo and the toy stall from the path (camera at (48, 5, -16) looking at (60, 2, -16)), and Shop Plaza from above showing the three stalls in a row.

- [ ] **Step 2: Look at every render and tune**

Check: props sit in her hand and stand upright; the balloon floats above her; the umbrella opens over her head; effects appear near the hand or head; spin/cartwheel turn about her middle; relax sits on the ground (not below it); the kitten sits in her left arm while the prop is in her right; Kuya Pilo reads as a small deer with big ears; the stall's sign does not overlap Lola Lana's. Adjust numbers only (positions, sizes, angles, `HOLD`, `mounts.arms`/`mounts.hand` positions); re-render after each change.

- [ ] **Step 3: Run everything again**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 4: Stage the tuning (do not commit)**

```bash
git add web/world/wear.js web/world/avatar.js web/world/moves.js web/world/cast.js web/world/build.js
```

---

## After the last task

Final whole-branch review (superpowers:requesting-code-review), then give the user one `git add …` / `git commit -m '…' -- <files>` command covering every staged file. No `Co-Authored-By`. Update memory: `wardrobe-decisions.md` (3a built, contracts: `Moves` offsets + `FX`, `MoveRun` demo/idle rules, `Wear.prop` + hand mount, `companion.watch`), `remaining-work.md` (next: 3b sounds; tablet check of 3a).
