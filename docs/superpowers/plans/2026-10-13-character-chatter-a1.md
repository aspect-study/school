# Character chatter A1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pets and playground kids show short word bubbles near her on their own (Quiet / Calm / Chatty), and a kid can be tapped for a tap-to-reply chat, all from pre-written, reviewable lines.

**Architecture:** A pure line picker (`speech.js`), a pure context builder (`speechctx.js`) and a pure bubble scheduler (`chatter.js`) are tested in Node. A small view (`bubbles.js`) draws the bubbles as sprites, `life.js` exposes the pets as speakers, `world-main.js` ties it together and adds the Chatter setting, and `speechchat.js` runs a kid's chat in the existing `talk.js` bubble. Line data lives in `web/world/speech/*.js`; `tools/line-sheet.js` turns it into review pages in `docs/lines/`.

**Tech Stack:** Plain ES5 browser JS in an IIFE with the `module.exports` / `root.World3D.X` pattern used by `web/world/stamina.js`, `node --test`, headless-Chrome e2e.

Spec: `docs/superpowers/specs/2026-10-13-character-chatter-design.md`.

**Commit rule (this repo):** the agent never runs `git commit`. Every "Commit" step ends by giving the owner the exact command as one code block (`git add <files> && git commit -m '...' -- <files>`), with no `Co-Authored-By` or any AI line. Before any push: `git log origin/main..HEAD --grep='Co-Authored-By\|Claude-Session'` must print nothing.

**Code rules:** ES5 (no arrow functions, `let`, `const`, template strings) in browser files, comments only where non-obvious, short class names with imports (never fully-qualified names inline). Test files use `node:test` and `node:assert/strict`, with paths from `tests/paths.js`.

## What A1 includes and what it does not

Included: the engine, the bubbles, the Chatter setting, pet and playmate ambient lines, a 💬 Chat button on a tapped playmate with reply buttons, review sheets.

Not in A1 (written into the spec's "Later" list in Task 12):
- Her own pet as a speaker (the companion does not expose its position yet).
- Pet tap chat (pets have no tap target; talk buttons come from proximity "near" items, so a roaming pet needs a dynamic item, which is its own task).
- Context tags `studied:*` and `medal:today`. A1 uses time of day, place, wardrobe, pet, streak, her saved favourites, the stamina heart and "just left a ride".
- The town characters (A2) and everyone else (A3).

## File structure

| File | Responsibility |
|---|---|
| `web/world/speech.js` (new) | Pure. Tags, slots, `pick`, `fill`, `reply`, `merge`, `poolIds`, `newState`. |
| `web/world/speechctx.js` (new) | Pure. `build(input)` turns plain facts into `{ tags, slots }`. |
| `web/world/chatter.js` (new) | Pure. `create({ rand, ask })` and `step(dt, input)`: who speaks when, with the Quiet/Calm/Chatty limits. |
| `web/world/bubbles.js` (new) | View. Draws active bubbles as sprites; exports pure `wrap` for tests. |
| `web/world/speechchat.js` (new) | View helper. Runs a tap chat in `talk.js`. |
| `web/world/speech/pets.js`, `speech/kids.js` (new) | Pure data: `{ pools }` for pets and playmates. |
| `web/world/prefs.js` (modify) | `chatter` device pref. |
| `web/world/text.js` (modify) | Setting and button strings, both grade versions. |
| `web/world/life.js` (modify) | `speakers()` for the pets. |
| `web/world/mates3d.js` (modify) | 💬 Chat button on a playmate's bubble. |
| `web/world/world-main.js` (modify) | Creates the pieces, the Settings row, the tick, the silence rule, debug hooks. |
| `web/world/grade-2.html`, `grade-5.html` (modify) | Script tags. |
| `tools/line-sheet.js` (new) | Writes `docs/lines/*.md` from the line files. |
| `tests/paths.js` (modify) | New names in `WORLD_FILES`. |
| `tests/world3d-speech.test.js`, `-speechctx`, `-chatter`, `-bubbles`, `-speech-lines`, `-speech-sheets`, `-speech-wiring` (new) | Node tests. |
| `tests/e2e/world-e2e.js` (modify) | Headless-Chrome checks. |

---

### Task 1: `speech.js` (the line picker)

**Files:**
- Create: `web/world/speech.js`
- Test: `tests/world3d-speech.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Speech = require(worldFile('speech.js'));

const DATA = {
  pools: {
    'any-pet': [
      { id: 'a1', say: 'Hello there!' },
      { id: 'a2', when: ['time:evening'], say: 'Good evening!' },
      { id: 'a3', when: ['wearing:hat'], say: 'Nice {hat}!' }
    ],
    'species:fox': [{ id: 'f1', say: 'Sneaky me!' }],
    'pet:kidlat': [{ id: 'k1', say: 'Zoom!', replies: [{ text: 'Wow!', next: 'k2' }] }, { id: 'k2', follow: true, say: 'Faster than lightning!' }]
  }
};
const FOX = { id: 'pet:tomas', kind: 'pet', species: 'fox', name: 'Kidlat' };
const ctx = (tags, slots) => ({ tags: tags || [], slots: slots || {} });

test('poolIds gives a pet its own, its species and the shared pool, and a kid its own and the shared pool', () => {
  assert.deepEqual(Speech.poolIds(FOX), ['any-pet', 'species:fox', 'pet:kidlat']);
  assert.deepEqual(Speech.poolIds({ id: 'migo', kind: 'kid' }), ['any-kid', 'kid:migo']);
});

test('validTag and validSlot accept the known names only', () => {
  for (const t of ['time:evening', 'near:slide', 'wearing:hat', 'pet:fox', 'fav:color:1', 'streak:3', 'tired', 'after:ride']) assert.ok(Speech.validTag(t), t);
  for (const t of ['time:lunch', 'wearing:shoes', 'fav:color', 'Pet:fox', '']) assert.ok(!Speech.validTag(t), t);
  for (const s of ['hat', 'pet', 'streak', 'fav_color']) assert.ok(Speech.validSlot(s), s);
  assert.ok(!Speech.validSlot('nose'));
});

test('pick prefers the line with the most matching tags', () => {
  const line = Speech.pick(DATA, FOX, ctx(['time:evening']), Speech.newState(), () => 0);
  assert.equal(line.id, 'a2');
});

test('a line with a slot needs a value for that slot even when its tag holds', () => {
  assert.equal(Speech.pick(DATA, FOX, ctx(['wearing:hat']), Speech.newState(), () => 0).id !== 'a3', true);
  assert.equal(Speech.pick(DATA, FOX, ctx(['wearing:hat'], { hat: 'Red cap' }), Speech.newState(), () => 0).id, 'a3');
});

test('fill puts the slot values into the text', () => {
  assert.equal(Speech.fill('Nice {hat}, {pet}!', ctx([], { hat: 'Red cap', pet: 'Kidlat' })), 'Nice Red cap, Kidlat!');
});

test('pick never repeats a recent line and returns null when nothing fits', () => {
  const state = Speech.newState();
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const line = Speech.pick(DATA, FOX, ctx(), state, () => 0);
    ids.push(line ? line.id : null);
  }
  assert.deepEqual(ids, ['a1', 'f1', null]);
});

test('ambient picks skip chat openers (lines with replies) and lines that only follow a reply', () => {
  const ids = new Set();
  for (let i = 0; i < 20; i++) {
    const line = Speech.pick(DATA, FOX, ctx(), Speech.newState(), () => Math.random());
    if (line) ids.add(line.id);
  }
  assert.ok(!ids.has('k1') && !ids.has('k2'));
});

test('the recent list keeps the last 20 lines per speaker', () => {
  const pool = [];
  for (let i = 0; i < 30; i++) pool.push({ id: 'l' + i, say: 'Line ' + i });
  const state = Speech.newState();
  for (let i = 0; i < 25; i++) Speech.pick({ pools: { 'any-pet': pool } }, FOX, ctx(), state, () => 0);
  assert.equal(state.recent[FOX.id].length, 20);
});

test('chatOnly keeps to lines with replies when one fits, and falls back to any line', () => {
  const chat = Speech.pick(DATA, FOX, ctx(), Speech.newState(), () => 0, true);
  assert.equal(chat.id, 'k1');
  const only = { pools: { 'any-pet': [{ id: 'z1', say: 'Just a line' }] } };
  assert.equal(Speech.pick(only, FOX, ctx(), Speech.newState(), () => 0, true).id, 'z1');
});

test('reply returns the line a reply button points to, or null at the end of a chat', () => {
  const k1 = DATA.pools['pet:kidlat'][0];
  assert.equal(Speech.reply(DATA, k1.replies[0]).id, 'k2');
  assert.equal(Speech.reply(DATA, { text: 'x', next: 'nope' }), null);
});

test('merge joins the pools of several data files', () => {
  const m = Speech.merge({ pools: { a: [{ id: '1' }] } }, { pools: { a: [{ id: '2' }], b: [{ id: '3' }] } });
  assert.deepEqual(Object.keys(m.pools).sort(), ['a', 'b']);
  assert.equal(m.pools.a.length, 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/world3d-speech.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write `web/world/speech.js`**

```js
/* Which line a character says on its own or in a chat. Pure: the world passes in the speaker, the facts about her (see
   speechctx.js) and what each speaker said lately, so Node can test every choice. A line is { id, when: [tags], say, fil?,
   replies?: [{ text, next }] } in a pool; a speaker draws on its own pools and the shared pool of its kind. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var RECENT = 20;

  var FIXED_TAGS = [
    'time:morning', 'time:afternoon', 'time:evening', 'time:night',
    'near:slide', 'near:swings', 'near:seesaw', 'near:merry', 'near:plaza', 'near:fort', 'near:garden', 'near:pond', 'near:shop',
    'wearing:hat', 'wearing:glasses', 'wearing:neck', 'wearing:back', 'streak:3', 'streak:7', 'after:ride', 'tired'
  ];
  var SLOTS = ['hat', 'glasses', 'neck', 'back', 'pet', 'streak'];

  function validTag(tag) {
    return FIXED_TAGS.indexOf(tag) >= 0 || /^pet:[a-z]+$/.test(tag) || /^fav:[a-z]+:[0-9]+$/.test(tag);
  }
  function validSlot(name) { return SLOTS.indexOf(name) >= 0 || /^fav_[a-z]+$/.test(name); }

  function slotsOf(text) {
    var out = [], re = /\{([a-z_]+)\}/g, m;
    while ((m = re.exec(text))) out.push(m[1]);
    return out;
  }

  function newState() { return { recent: {} }; }

  function poolIds(sp) {
    if (sp.kind === 'pet') return ['any-pet', 'species:' + sp.species, 'pet:' + String(sp.name || '').toLowerCase()];
    if (sp.kind === 'kid') return ['any-kid', 'kid:' + sp.id];
    return [sp.kind + ':' + sp.id];
  }

  function holds(line, ctx) {
    var ok = (line.when || []).every(function (t) { return ctx.tags.indexOf(t) >= 0; });
    return ok && slotsOf(line.say).every(function (s) { return !!ctx.slots[s]; });
  }

  function fill(text, ctx) {
    return String(text).replace(/\{([a-z_]+)\}/g, function (m, k) { return ctx.slots[k] || ''; });
  }

  // A chat opener has replies. A follow line (follow: true) is only ever reached through a reply, never picked.
  function isChat(line) { return !!(line.replies && line.replies.length); }

  function remember(state, id, lineId) {
    var list = state.recent[id] || (state.recent[id] = []);
    list.push(lineId);
    if (list.length > RECENT) list.shift();
  }

  function eligible(data, speaker, ctx, state) {
    var recent = state.recent[speaker.id] || [], out = [];
    poolIds(speaker).forEach(function (p) {
      (data.pools[p] || []).forEach(function (line) {
        if (!line.follow && recent.indexOf(line.id) < 0 && holds(line, ctx)) out.push(line);
      });
    });
    return out;
  }

  // Ambient picks are plain lines. chatOnly: a tap chat wants an opener with replies, and falls back to a plain line
  // when no opener fits. The most specific lines win; ties are random.
  function pick(data, speaker, ctx, state, rand, chatOnly) {
    var all = eligible(data, speaker, ctx, state), chats = all.filter(isChat), plain = all.filter(function (l) { return !isChat(l); });
    var from = chatOnly && chats.length ? chats : plain;
    if (!from.length) return null;
    var top = Math.max.apply(null, from.map(function (l) { return (l.when || []).length; }));
    var best = from.filter(function (l) { return (l.when || []).length === top; });
    var line = best[Math.min(best.length - 1, Math.floor(rand() * best.length))];
    remember(state, speaker.id, line.id);
    return line;
  }

  function reply(data, r) {
    var found = null;
    Object.keys(data.pools).forEach(function (p) {
      data.pools[p].forEach(function (l) { if (l.id === r.next) found = l; });
    });
    return found;
  }

  function merge() {
    var out = { pools: {} };
    [].forEach.call(arguments, function (d) {
      if (!d) return;
      Object.keys(d.pools).forEach(function (p) { out.pools[p] = (out.pools[p] || []).concat(d.pools[p]); });
    });
    return out;
  }

  var exported = {
    RECENT: RECENT, FIXED_TAGS: FIXED_TAGS, SLOTS: SLOTS, validTag: validTag, validSlot: validSlot, slotsOf: slotsOf,
    newState: newState, poolIds: poolIds, holds: holds, fill: fill, isChat: isChat, eligible: eligible, pick: pick, reply: reply, merge: merge
  };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Speech = exported;
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/world3d-speech.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add web/world/speech.js tests/world3d-speech.test.js && git commit -m 'Add the pure line picker for character chatter: tags, slots, recent-line memory and reply chains' -- web/world/speech.js tests/world3d-speech.test.js
```

(`tests/paths.js` lists `speech.js` in Task 9; the wiring tests that read it are not affected until then.)

---

### Task 2: `speechctx.js` (the facts about her)

**Files:**
- Create: `web/world/speechctx.js`
- Test: `tests/world3d-speechctx.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Ctx = require(worldFile('speechctx.js'));
const Speech = require(worldFile('speech.js'));

const BASE = { hour: 9, her: { x: 0, z: 0 }, spots: [], wear: {}, itemName: (id) => id.toUpperCase(), petSpecies: '', petName: '', streak: 0, fav: [] };

test('time of day follows the hour', () => {
  const at = (h) => Ctx.build(Object.assign({}, BASE, { hour: h })).tags.filter((t) => t.startsWith('time:'))[0];
  assert.equal(at(5), 'time:morning');
  assert.equal(at(11), 'time:morning');
  assert.equal(at(12), 'time:afternoon');
  assert.equal(at(17), 'time:evening');
  assert.equal(at(21), 'time:night');
  assert.equal(at(3), 'time:night');
});

test('near: a spot counts when she is inside its radius', () => {
  const spots = [{ tag: 'near:slide', x: 10, z: 0, r: 8 }, { tag: 'near:fort', x: 100, z: 0, r: 8 }];
  const c = Ctx.build(Object.assign({}, BASE, { spots, her: { x: 5, z: 0 } }));
  assert.ok(c.tags.includes('near:slide'));
  assert.ok(!c.tags.includes('near:fort'));
});

test('wearing: each worn slot gives a tag and a slot with the item name', () => {
  const c = Ctx.build(Object.assign({}, BASE, { wear: { hat: 'cap', glasses: '' } }));
  assert.ok(c.tags.includes('wearing:hat'));
  assert.ok(!c.tags.includes('wearing:glasses'));
  assert.equal(c.slots.hat, 'CAP');
});

test('pet, streak and favourites', () => {
  const c = Ctx.build(Object.assign({}, BASE, { petSpecies: 'fox', petName: 'Kidlat', streak: 4, fav: [{ q: 'color', choice: 1, label: '💙 Blue' }] }));
  assert.ok(c.tags.includes('pet:fox'));
  assert.equal(c.slots.pet, 'Kidlat');
  assert.ok(c.tags.includes('streak:3'));
  assert.ok(!c.tags.includes('streak:7'));
  assert.equal(c.slots.streak, '4');
  assert.ok(c.tags.includes('fav:color:1'));
  assert.equal(c.slots.fav_color, 'Blue');
});

test('every tag and slot it builds is one the picker knows', () => {
  const c = Ctx.build(Object.assign({}, BASE, {
    wear: { hat: 'a', glasses: 'b', neck: 'c', back: 'd' }, petSpecies: 'fox', petName: 'K', streak: 9, afterRide: true, tired: true,
    spots: [{ tag: 'near:slide', x: 0, z: 0, r: 1 }], fav: [{ q: 'fruit', choice: 0, label: 'Mango' }]
  }));
  c.tags.forEach((t) => assert.ok(Speech.validTag(t), t));
  Object.keys(c.slots).forEach((s) => assert.ok(Speech.validSlot(s), s));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-speechctx.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write `web/world/speechctx.js`**

```js
/* The facts about her that a character's line can depend on, as { tags, slots }. Pure: world-main.js reads the real game
   state and passes plain values in. Nothing here is stored or sent anywhere. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var WEAR_SLOTS = ['hat', 'glasses', 'neck', 'back'];

  function part(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  function plain(label) { return String(label || '').replace(/^[^\p{L}\p{N}]+/u, '').trim(); }

  // i = { hour, her: { x, z }, spots: [{ tag, x, z, r }], wear: { slot: itemId }, itemName(id), petSpecies, petName, streak,
  //       afterRide, tired, fav: [{ q, choice, label }] }
  function build(i) {
    var tags = ['time:' + part(i.hour)], slots = {};
    (i.spots || []).forEach(function (s) {
      if (Math.hypot(i.her.x - s.x, i.her.z - s.z) <= s.r) tags.push(s.tag);
    });
    WEAR_SLOTS.forEach(function (s) {
      var id = i.wear && i.wear[s], name = id && i.itemName ? i.itemName(id) : '';
      if (name) {
        tags.push('wearing:' + s);
        slots[s] = name;
      }
    });
    if (i.petSpecies) tags.push('pet:' + i.petSpecies);
    if (i.petName) slots.pet = i.petName;
    var n = Number(i.streak) || 0;
    if (n >= 3) tags.push('streak:3');
    if (n >= 7) tags.push('streak:7');
    if (n > 0) slots.streak = String(n);
    if (i.afterRide) tags.push('after:ride');
    if (i.tired) tags.push('tired');
    (i.fav || []).forEach(function (f) {
      tags.push('fav:' + f.q + ':' + f.choice);
      slots['fav_' + f.q] = plain(f.label);
    });
    return { tags: tags, slots: slots };
  }

  var exported = { build: build, part: part };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.SpeechCtx = exported;
})(this);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/world3d-speechctx.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/world/speechctx.js tests/world3d-speechctx.test.js && git commit -m 'Add the context builder for character chatter: time of day, place, wardrobe, pet, streak and favourites' -- web/world/speechctx.js tests/world3d-speechctx.test.js
```

---

### Task 3: `chatter.js` (when they speak)

**Files:**
- Create: `web/world/chatter.js`
- Test: `tests/world3d-chatter.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Chatter = require(worldFile('chatter.js'));

const kid = (id, x) => ({ id, speaker: { id }, x, z: 0, head: 4, hidden: false });
const HER = { x: 0, z: 0 };

// Steps the scheduler once per second for `seconds`; calls back with the second and the bubbles on screen.
function run(chatter, mode, speakers, seconds, extra, each) {
  for (let t = 1; t <= seconds; t++) {
    const input = Object.assign({ mode, her: HER, speakers, silent: false }, extra);
    each(t, chatter.step(1, input));
  }
}

test('Quiet shows no bubbles at all', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  run(c, 'quiet', [kid('a', 3)], 60, {}, (t, list) => assert.equal(list.length, 0));
});

test('Calm: a near speaker speaks after the warm-up and the bubble follows its head', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const sp = [kid('a', 3)];
  let first = null;
  run(c, 'calm', sp, 3, {}, (t, list) => { if (list.length && !first) first = { t, b: list[0] }; });
  assert.equal(first.t, 2);
  assert.equal(first.b.text, 'Hi!');
  assert.equal(first.b.y, 4);
  sp[0].x = 7;
  const list = c.step(1, { mode: 'calm', her: HER, speakers: sp, silent: false });
  assert.equal(list.length, 1);
  assert.equal(list[0].x, 7);
});

test('a speaker beyond the radius never speaks (Calm 12, Chatty 16)', () => {
  const calm = Chatter.create({ rand: () => 0, ask: () => 'Hi!' }), chatty = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  run(calm, 'calm', [kid('a', 14)], 60, {}, (t, list) => assert.equal(list.length, 0));
  let seen = 0;
  run(chatty, 'chatty', [kid('a', 14)], 60, {}, (t, list) => { seen += list.length; });
  assert.ok(seen > 0);
});

test('Calm never shows more than 2 bubbles and does reach 2', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  let max = 0;
  run(c, 'calm', [kid('a', 3), kid('b', 4), kid('c', 5)], 90, {}, (t, list) => { max = Math.max(max, list.length); });
  assert.equal(max, 2);
});

test('Chatty allows 3 at once', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  let max = 0;
  run(c, 'chatty', [kid('a', 3), kid('b', 4), kid('c', 5), kid('d', 6)], 90, {}, (t, list) => { max = Math.max(max, list.length); });
  assert.equal(max, 3);
});

test('in Calm new bubbles start at least 3 seconds apart', () => {
  const births = [];
  let now = 0;
  const c = Chatter.create({ rand: () => 0, ask: () => { births.push(now); return 'Hi!'; } });
  run(c, 'calm', [kid('a', 3), kid('b', 4), kid('c', 5)], 60, {}, (t) => { now = t; });
  // ask runs inside step(), before `now` is updated, so every birth is one second early; the gaps are exact.
  assert.ok(births.length >= 3);
  for (let i = 1; i < births.length; i++) assert.ok(births[i] - births[i - 1] >= 3, births.join(','));
});

test('one speaker waits at least the Calm gap (20 s) between speeches', () => {
  const births = [];
  let now = 0;
  const c = Chatter.create({ rand: () => 0, ask: () => { births.push(now + 1); return 'Hi!'; } });
  run(c, 'calm', [kid('a', 3)], 100, {}, (t) => { now = t; });
  assert.ok(births.length >= 3);
  for (let i = 1; i < births.length; i++) assert.ok(births[i] - births[i - 1] >= 20, births.join(','));
});

test('a bubble lasts about 4 seconds', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const seen = [];
  run(c, 'calm', [kid('a', 3)], 12, {}, (t, list) => seen.push(list.length));
  assert.deepEqual(seen.slice(0, 8), [0, 1, 1, 1, 1, 0, 0, 0]);
});

test('silent clears the bubbles and blocks new ones', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const sp = [kid('a', 3)];
  run(c, 'calm', sp, 3, {}, () => {});
  const during = c.step(1, { mode: 'calm', her: HER, speakers: sp, silent: true });
  assert.equal(during.length, 0);
  run(c, 'calm', sp, 40, { silent: true }, (t, list) => assert.equal(list.length, 0));
});

test('ask returning nothing shows no bubble and the speaker tries again after its gap', () => {
  let calls = 0;
  const c = Chatter.create({ rand: () => 0, ask: () => { calls++; return null; } });
  run(c, 'calm', [kid('a', 3)], 50, {}, (t, list) => assert.equal(list.length, 0));
  assert.ok(calls >= 2 && calls <= 3, 'asked ' + calls);
});

test('a hidden speaker does not speak and its bubble goes', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const sp = [kid('a', 3)];
  run(c, 'calm', sp, 3, {}, () => {});
  sp[0].hidden = true;
  assert.equal(c.step(1, { mode: 'calm', her: HER, speakers: sp, silent: false }).length, 0);
});

test('the bubble fades in and out', () => {
  const c = Chatter.create({ rand: () => 0, ask: () => 'Hi!' });
  const alphas = [];
  run(c, 'calm', [kid('a', 3)], 6, {}, (t, list) => { if (list.length) alphas.push(list[0].alpha); });
  assert.equal(alphas[0], 0);
  assert.equal(alphas[1], 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-chatter.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write `web/world/chatter.js`**

```js
/* When the world's characters speak on their own: which near speaker gets a bubble, how many are on screen and how often
   each one talks, from the Chatter setting. Pure and timer-free: the world feeds it dt every frame. A speaker is
   { id, speaker, x, z, head, hidden }; ask(entry) returns the words to show, or null. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;

  var LIMITS = {
    quiet: { max: 0, gap: [20, 30], radius: 0, spacing: 3 },
    calm: { max: 2, gap: [20, 30], radius: 12, spacing: 3 },
    chatty: { max: 3, gap: [10, 15], radius: 16, spacing: 1 }
  };
  var LIFE = 4, FADE_IN = 0.25, FADE_OUT = 0.5, CHECK = 1;

  function create(o) {
    var rand = o.rand || Math.random, now = 0, since = CHECK, lastNew = -100, active = [], nextOk = {};

    function span(g) { return g[0] + rand() * (g[1] - g[0]); }

    function view() {
      return active.map(function (b) {
        var age = now - b.born, a = Math.min(1, age / FADE_IN, (LIFE - age) / FADE_OUT);
        return { id: b.id, text: b.text, x: b.x, y: b.y, z: b.z, alpha: Math.max(0, a) };
      });
    }

    // The first time a speaker is near it only gets a random delay, so a crowd does not all talk at once.
    function spawn(input, lim) {
      var taken = {};
      active.forEach(function (b) { taken[b.id] = true; });
      var cands = input.speakers.filter(function (s) {
        return !s.hidden && !taken[s.id] && Math.hypot(s.x - input.her.x, s.z - input.her.z) <= lim.radius;
      }).sort(function (a, b) {
        return Math.hypot(a.x - input.her.x, a.z - input.her.z) - Math.hypot(b.x - input.her.x, b.z - input.her.z);
      });
      for (var i = 0; i < cands.length; i++) {
        var s = cands[i];
        if (nextOk[s.id] === undefined) {
          nextOk[s.id] = now + rand() * lim.gap[1];
          continue;
        }
        if (now < nextOk[s.id]) continue;
        var text = o.ask(s);
        nextOk[s.id] = now + span(lim.gap);
        if (!text) continue;
        active.push({ id: s.id, text: text, born: now, x: s.x, y: s.head, z: s.z });
        lastNew = now;
        return;
      }
    }

    function step(dt, input) {
      now += dt;
      var lim = LIMITS[input.mode] || LIMITS.calm, byId = {};
      input.speakers.forEach(function (s) { byId[s.id] = s; });
      if (input.silent || lim.max === 0) active = [];
      active = active.filter(function (b) { return now - b.born < LIFE && byId[b.id] && !byId[b.id].hidden; });
      active.forEach(function (b) {
        var s = byId[b.id];
        b.x = s.x;
        b.y = s.head;
        b.z = s.z;
      });
      since += dt;
      if (since >= CHECK) {
        since = 0;
        if (!input.silent && lim.max > 0 && active.length < lim.max && now - lastNew >= lim.spacing) spawn(input, lim);
      }
      return view();
    }

    return { step: step };
  }

  var exported = { LIMITS: LIMITS, LIFE: LIFE, create: create };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Chatter = exported;
})(this);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/world3d-chatter.test.js`
Expected: PASS (12 tests). If a timing assertion is off by one second, fix the test arithmetic (the first bubble is born in the step at second 2: step 1 only sets the speaker's warm-up delay), not the limits. Calm spaces new bubbles 3 s apart so at most 2 overlap; Chatty spaces them 1 s apart so 3 can overlap.

- [ ] **Step 5: Commit**

```bash
git add web/world/chatter.js tests/world3d-chatter.test.js && git commit -m 'Add the bubble scheduler for character chatter: Quiet, Calm and Chatty limits, spacing, radius and fades' -- web/world/chatter.js tests/world3d-chatter.test.js
```

---

### Task 4: the Chatter pref

**Files:**
- Modify: `web/world/prefs.js` (`readPrefs`, `savePrefs`, the export block)
- Modify: `tests/world3d-prefs.test.js` (the first test's expected objects)

- [ ] **Step 1: Update the failing test**

In the first test of `tests/world3d-prefs.test.js`, every expected object gets `chatter: 'calm'` (the default); add a case for saving and rejecting values:

```js
test('device prefs default to auto quality with music and footsteps on', () => {
  assert.deepEqual(P.readPrefs(memory()), { v: 1, quality: 'auto', music: true, steps: true, zoom: 1, chatter: 'calm' });
  assert.deepEqual(P.readPrefs(memory({ world3d_device_v1: '{"quality":"ultra","music":"no","steps":"no"}' })), { v: 1, quality: 'auto', music: true, steps: true, zoom: 1, chatter: 'calm' });
  const s = memory();
  P.savePrefs(s, { quality: 'low', music: false, steps: false });
  assert.deepEqual(P.readPrefs(s), { v: 1, quality: 'low', music: false, steps: false, zoom: 1, chatter: 'calm' });
  P.savePrefs(s, { quality: 'low', music: false });
  assert.equal(P.readPrefs(s).steps, true, 'footsteps stay on unless switched off');
});

test('the chatter pref is quiet, calm or chatty and defaults to calm', () => {
  const s = memory();
  P.savePrefs(s, { chatter: 'chatty' });
  assert.equal(P.readPrefs(s).chatter, 'chatty');
  P.savePrefs(s, { chatter: 'quiet' });
  assert.equal(P.readPrefs(s).chatter, 'quiet');
  P.savePrefs(s, { chatter: 'loud' });
  assert.equal(P.readPrefs(s).chatter, 'calm');
  assert.deepEqual(P.CHATTERS, ['quiet', 'calm', 'chatty']);
});
```

Keep the other assertions in that test file (zoom, quality) as they are; if another expected object in the file lists all keys, add `chatter: 'calm'` to it.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-prefs.test.js`
Expected: FAIL (missing `chatter`).

- [ ] **Step 3: Implement in `web/world/prefs.js`**

Add after `var QUALITIES = [...]`:

```js
  var CHATTERS = ['quiet', 'calm', 'chatty'];
```

Replace the return of `readPrefs`:

```js
    return {
      v: 1, quality: QUALITIES.indexOf(d.quality) >= 0 ? d.quality : 'auto', music: d.music !== false, steps: d.steps !== false,
      zoom: clampZoom(d.zoom), chatter: CHATTERS.indexOf(d.chatter) >= 0 ? d.chatter : 'calm'
    };
```

Replace the `var out = {...}` line in `savePrefs`:

```js
    var out = {
      v: 1, quality: QUALITIES.indexOf(prefs.quality) >= 0 ? prefs.quality : 'auto', music: prefs.music !== false, steps: prefs.steps !== false,
      zoom: clampZoom(prefs.zoom), chatter: CHATTERS.indexOf(prefs.chatter) >= 0 ? prefs.chatter : 'calm'
    };
```

Add `CHATTERS: CHATTERS,` to the `exported` object (next to `ZOOM_MIN`).

- [ ] **Step 4: Run the prefs test and the sync-core tests**

Run: `node --test tests/world3d-prefs.test.js tests/sync-core.test.js`
Expected: PASS. (The device key must stay unsynced; the existing `kindOf` assertion in the prefs test covers that.)

- [ ] **Step 5: Commit**

```bash
git add web/world/prefs.js tests/world3d-prefs.test.js && git commit -m 'Add the Chatter device setting: quiet, calm (default) or chatty' -- web/world/prefs.js tests/world3d-prefs.test.js
```

---

### Task 5: setting and button words

**Files:**
- Modify: `web/world/text.js` (both grade sets, next to `steps:` at about lines 50 and 90; the button map near line 5)
- Test: `tests/world3d-text.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/world3d-text.test.js` (read its top first to reuse its `require` names for `Text`/`T`; if it builds the sets with `Text.forGrade('grade2')` or similar, use that same call):

```js
test('the Chatter setting and the Chat button have words on both grades', () => {
  for (const grade of ['grade2', 'grade5']) {
    const T = Text.forGrade ? Text.forGrade(grade) : Text.of(grade);
    assert.ok(T.chatter, grade + ' chatter label');
    assert.deepEqual(Object.keys(T.chatterNames), ['quiet', 'calm', 'chatty']);
    assert.equal(T.chatterNames.calm, 'Calm', 'choices are English buttons');
    assert.equal(T.chat, '💬 Chat');
  }
});
```

Run `grep -n "module.exports\|exported = \|function" web/world/text.js | head` and adjust `Text.forGrade ? ... : ...` to the real accessor.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-text.test.js`
Expected: FAIL (`T.chatter` undefined).

- [ ] **Step 3: Add the strings**

Grade 5 set, after `steps: '👣 Footsteps',`:

```js
      chatter: '💬 Chatter', chatterNames: { quiet: 'Quiet', calm: 'Calm', chatty: 'Chatty' }, chat: '💬 Chat',
```

Grade 2 set, after `steps: '👣 Yabag · Footsteps',`:

```js
      chatter: '💬 Kuwentuhan · Chatter', chatterNames: { quiet: 'Quiet', calm: 'Calm', chatty: 'Chatty' }, chat: '💬 Chat',
```

(The `BUTTONS` map at the top of the file is for buttons that are English on both grades; `chat` is also reachable as `T.chat` through the set, which is what `mates3d.js` reads. If the sets spread `BUTTONS` into `T`, put `chat` in `BUTTONS` instead and remove it from the two sets.)

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/world3d-text.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/world/text.js tests/world3d-text.test.js && git commit -m 'Add the Chatter setting and Chat button words for both grades' -- web/world/text.js tests/world3d-text.test.js
```

---

### Task 6: the line guards (tests that every line must pass)

**Files:**
- Create: `tests/world3d-speech-lines.test.js`
- Create: `web/world/speech/pets.js`, `web/world/speech/kids.js` (empty pools for now, filled by Tasks 7 and 8)

- [ ] **Step 1: Create the empty data files**

`web/world/speech/pets.js`:

```js
/* What the world's pets say near her (A1). Pure data: pools of lines, see speech.js. Every line is read through
   docs/lines/pets.md before it ships. */
(function (root) {
  'use strict';
  var data = { pools: {} };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.SpeechPets = data;
})(this);
```

`web/world/speech/kids.js`: the same, with the comment "What the playground kids say near her (A1)..." and `root.World3D.SpeechKids = data;`.

- [ ] **Step 2: Write the guard test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { worldFile } = require('./paths.js');
const Speech = require(worldFile('speech.js'));
const LifeData = require(worldFile('lifedata.js'));

const DIR = worldFile('speech');
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();
const SPECIES = Object.keys(LifeData.SPECIES);
const PET_NAMES = ['tagpi', 'lila', 'kidlat', 'pandesal', 'mingming', 'kwento', 'tagal', 'bituin', 'kawayan', 'hielo', 'pitik'];
const FRIENDS = ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna'];

const ALL = {};
const BY_ID = {};
for (const f of FILES) {
  const data = require(path.join(DIR, f));
  for (const [pool, lines] of Object.entries(data.pools)) {
    ALL[pool] = (ALL[pool] || []).concat(lines);
    for (const l of lines) {
      assert.ok(!BY_ID[l.id], 'duplicate line id ' + l.id);
      BY_ID[l.id] = l;
    }
  }
}
const LINES = Object.values(ALL).flat();
const TARGETS = new Set(LINES.flatMap((l) => (l.replies || []).map((r) => r.next)));
const chatLike = (l) => Speech.isChat(l) || !!l.follow;

const SCOLD = /\b(wrong|stupid|dumb|lazy|hate|ugly|bad|should have|better than|worse than|slower than|loser)\b/i;
const PRONOUN = /\b(she|her|hers|he|him|his)\b/i;
const FIL_BAD = [/tunog tama/i, /\bbagay\b/i, /\bpwede\b/i, /natutunan/i];

test('every pool belongs to a known speaker kind', () => {
  for (const pool of Object.keys(ALL)) {
    const ok = pool === 'any-pet' || pool === 'any-kid'
      || (pool.startsWith('species:') && SPECIES.includes(pool.slice(8)))
      || (pool.startsWith('pet:') && PET_NAMES.includes(pool.slice(4)))
      || (pool.startsWith('kid:') && FRIENDS.includes(pool.slice(4)));
    assert.ok(ok, 'unknown pool ' + pool);
  }
});

test('every line has an id, words and only known tags and slots', () => {
  for (const l of LINES) {
    assert.match(l.id, /^[a-z0-9-]+$/, 'id ' + l.id);
    assert.ok(typeof l.say === 'string' && l.say.trim() === l.say && l.say.length > 0, l.id + ' say');
    for (const t of l.when || []) assert.ok(Speech.validTag(t), l.id + ' tag ' + t);
    assert.equal(new Set(l.when || []).size, (l.when || []).length, l.id + ' repeats a tag');
    for (const s of Speech.slotsOf(l.say)) assert.ok(Speech.validSlot(s), l.id + ' slot ' + s);
    if (l.fil) assert.deepEqual(Speech.slotsOf(l.fil).sort(), Speech.slotsOf(l.say).sort(), l.id + ' fil slots');
  }
});

test('ambient lines are at most 60 characters and chat lines (openers and follow lines) at most 140', () => {
  for (const l of LINES) {
    const max = chatLike(l) ? 140 : 60;
    assert.ok(l.say.length <= max, l.id + ' is ' + l.say.length + ' characters');
  }
});

test('lines are kind: no scolding, no comparing, nothing about her as she or he', () => {
  for (const l of LINES) {
    assert.doesNotMatch(l.say, SCOLD, l.id + ' scolds');
    if (l.allow !== 'pronoun') assert.doesNotMatch(l.say, PRONOUN, l.id + ' uses she/her/he/him/his');
  }
});

test('Filipino halves follow the project wording rules', () => {
  for (const l of LINES) {
    if (!l.fil) continue;
    for (const bad of FIL_BAD) assert.doesNotMatch(l.fil, bad, l.id + ' ' + bad);
  }
});

test('follow lines are exactly the lines replies lead to', () => {
  for (const id of TARGETS) assert.ok(BY_ID[id] && BY_ID[id].follow === true, id + ' is a reply target and needs follow: true');
  for (const l of LINES) if (l.follow) assert.ok(TARGETS.has(l.id), l.id + ' is marked follow but no reply leads to it');
});

test('chat lines carry a Filipino half and replies lead to real lines, at most 3 steps, with no loop', () => {
  for (const l of LINES) {
    if (!chatLike(l)) continue;
    assert.ok(l.fil, l.id + ' needs a fil half');
    for (const r of l.replies || []) {
      assert.ok(r.text && r.text.length <= 24, l.id + ' reply text');
      assert.ok(BY_ID[r.next], l.id + ' replies to missing ' + r.next);
    }
    assert.ok((l.replies || []).length <= 3, l.id + ' has more than 3 replies');
  }
  function depth(id, seen) {
    assert.ok(!seen.includes(id), 'loop through ' + id);
    const l = BY_ID[id];
    const next = (l.replies || []).map((r) => depth(r.next, seen.concat(id)));
    return 1 + (next.length ? Math.max(...next) : 0);
  }
  for (const l of LINES) if (l.replies && l.replies.length) assert.ok(depth(l.id, []) <= 3, l.id + ' is a chat of more than 3 steps');
});

test('every pool can always say something: at least 3 lines with no condition or only a time of day', () => {
  for (const [pool, lines] of Object.entries(ALL)) {
    const open = lines.filter((l) => !chatLike(l) && (l.when || []).every((t) => t.startsWith('time:'))).length;
    assert.ok(open >= 3, pool + ' has only ' + open + ' open lines');
  }
});

test('A1 coverage: pets', () => {
  const need = (pool, n) => assert.ok((ALL[pool] || []).length >= n, pool + ' has ' + (ALL[pool] || []).length + ', needs ' + n);
  need('any-pet', 40);
  for (const s of SPECIES) need('species:' + s, 12);
  for (const n of PET_NAMES) need('pet:' + n, 8);
});

test('A1 coverage: playmates', () => {
  const need = (pool, n) => assert.ok((ALL[pool] || []).length >= n, pool + ' has ' + (ALL[pool] || []).length + ', needs ' + n);
  need('any-kid', 40);
  for (const f of FRIENDS) need('kid:' + f, 25);
  const trees = (pool) => (ALL[pool] || []).filter((l) => Speech.isChat(l) && !l.follow).length;
  assert.ok(trees('any-kid') >= 6, 'any-kid needs 6 chats that open with replies');
  for (const f of FRIENDS) assert.ok(trees('kid:' + f) >= 4, f + ' needs 4 chats that open with replies');
});
```

- [ ] **Step 3: Run to verify the structural tests pass and the coverage tests fail**

Run: `node --test tests/world3d-speech-lines.test.js`
Expected: the structural tests pass on the empty files except "every pool can always say something" (passes: no pools); the two "A1 coverage" tests FAIL. That is the target for Tasks 7 and 8.

- [ ] **Step 4: Commit**

```bash
git add tests/world3d-speech-lines.test.js web/world/speech/pets.js web/world/speech/kids.js && git commit -m 'Add the line guard tests and empty line files for pets and playmates' -- tests/world3d-speech-lines.test.js web/world/speech/pets.js web/world/speech/kids.js
```

---

### Task 7: write the pet lines

**Files:**
- Modify: `web/world/speech/pets.js`

This is a content task. The guard tests from Task 6 are the acceptance check.

- [ ] **Step 1: Read the rules the lines must follow**

Read `docs/superpowers/specs/2026-10-13-character-chatter-design.md` ("Voice and content rules"), and `CLAUDE.md` ("Text and lessons": the Filipino rules). Ambient pet lines are English only, at most 60 characters, kind, never about her as she/he, and speak in the pet's own voice.

- [ ] **Step 2: Write the pools**

Format (every line has a unique id like `<pool>-<n>`; use `when` only where the line needs it; use slots only for facts in `speechctx.js`):

```js
  var data = {
    pools: {
      'any-pet': [
        { id: 'any-pet-1', say: 'Such a nice day to hang out!' },
        { id: 'any-pet-2', when: ['time:evening'], say: 'The sky is turning pink. So pretty!' },
        { id: 'any-pet-3', when: ['wearing:hat'], say: 'I love your {hat}!' },
        { id: 'any-pet-4', when: ['near:slide'], say: 'Wheee! Look at that slide!' },
        { id: 'any-pet-5', when: ['streak:3'], say: '{streak} days in a row. Wow!' },
        { id: 'any-pet-6', when: ['tired'], say: 'Take a breath. I will wait!' }
      ],
      'species:fox': [
        { id: 'species-fox-1', say: 'Psst. I know a secret shortcut.' }
      ],
      'pet:kidlat': [
        { id: 'pet-kidlat-1', say: 'Lightning fast, that is me!' }
      ]
    }
  };
```

Required content (counts are the minimum the tests check; write a few more when a pool is rich):
- `any-pet`: 40 lines. At least 5 time-of-day lines (all four times), 4 `near:` lines (slide, swings, seesaw, merry), 4 wardrobe lines (`wearing:hat`, `wearing:glasses`, `wearing:neck`, `wearing:back`, each using its slot), 3 streak lines (`streak:3`, `streak:7`, a plain `{streak}`), 2 `after:ride` lines, 2 `tired` lines, 2 `{pet}` lines, the rest open.
- One pool per species in `Object.keys(LifeData.SPECIES)`: chick, kitten, puppy, hamster, duckling, bunny, turtle, piglet, parrot, carabao, penguin, fox, tarsier, panda, unicorn, dragon. 12 lines each, voiced like this: chick peppy and peeping; kitten curious and soft; puppy excited and loyal; hamster busy, cheeks full, loves its wheel; duckling splashy; bunny hops, loves carrots; turtle slow, wise, calm; piglet loves mud and snacks; parrot repeats and mixes up words; carabao calm, hardworking, farm life; penguin cool, dramatic about sliding; fox sneaky and clever; tarsier wide-eyed, quiet, loves the night; panda sleepy, bamboo; unicorn sparkly and kind; dragon fiery but gentle, sneezes sparks.
- A pool for each named pet, 8 lines each: Tagpi (Migo's patchy puppy, loves fetch), Lila (Ella's shy bunny), Kidlat (Tomas's fast fox), Pandesal (Bea's tidy hamster who loves bread), Mingming (Luna's sleepy kitten), Kwento (Hoot's parrot, a storyteller), Tagal (Bunny's patient turtle), Bituin (Mimi's star unicorn), Kawayan (panda who loves bamboo), Hielo (penguin who loves cool things), Pitik (a cheerful duckling).
- At least 3 open lines in every pool (the test enforces it).
- Never scold or compare. No "she/her/he/him/his". English only.

- [ ] **Step 3: Run the guards**

Run: `node --test tests/world3d-speech-lines.test.js`
Expected: every test passes except the playmate coverage test.

- [ ] **Step 4: Generate the review sheet and stop for the owner**

After Task 11 exists, run `node tools/line-sheet.js` and tell the owner to read `docs/lines/pets.md`. Apply the owner's changes, re-run the guards and the sheet tool.

- [ ] **Step 5: Commit**

```bash
git add web/world/speech/pets.js && git commit -m 'Write the pet lines: shared, per species and per named pet' -- web/world/speech/pets.js
```

---

### Task 8: write the playmate lines

**Files:**
- Modify: `web/world/speech/kids.js`

- [ ] **Step 1: Read the rules**

Same documents as Task 7, plus `web/world/matelines.js` (the kids already ask "getting to know you" questions; the ids of those questions are the `fav` question ids, for example `color`, `fruit`, `ride`, `subject`, `sport`, `shape`, `merienda`).

- [ ] **Step 2: Write the pools**

Ambient format as in Task 7. Chat format: the opening line has `replies`, each reply points at a line id, every line a reply leads to is marked `follow: true` (it is never picked on its own), and every chat line carries `fil` (a Grade 2 Filipino half that keeps the full meaning; `puwede`, `natutuhan`; never `bagay` for "fits"; never `tunog tama`; the guard test checks this).

```js
      'kid:migo': [
        { id: 'kid-migo-1', say: 'The merry-go-round is my favourite!' },
        { id: 'kid-migo-chat-1', say: 'Want to hear a joke?', fil: 'Gusto mo bang makarinig ng biro?',
          replies: [{ text: 'Yes please!', next: 'kid-migo-chat-2' }, { text: 'Maybe later', next: 'kid-migo-chat-3' }] },
        { id: 'kid-migo-chat-2', follow: true, say: 'Why did the banana go to school? To get a little bit peel-ier!', fil: 'Bakit pumasok sa school ang saging? Para humusay pa!' },
        { id: 'kid-migo-chat-3', follow: true, say: 'Okay! I have lots more jokes.', fil: 'Sige! Marami pa akong biro.' }
      ],
```

Required content:
- `any-kid`: 40 lines in a neutral friendly voice, with the same mix as the pets' `any-pet` (times of day, `near:` rides, wardrobe, streak, `after:ride`, `tired`, `{pet}` lines about her pet, open lines), plus at least 6 chats that open with replies and use `fav:` tags and `fav_` slots where it fits (for example `when: ['fav:color:1']`, say `Blue is your favourite colour, right?`... use the real question ids and choice indexes from `FUN` in `matelines.js`, and slots like `{fav_color}`).
- `kid:migo` (cheerful, merry-go-round, jokes), `kid:ella` (studious, swings, kind, flowers), `kid:tomas` (slides, fast, energetic), `kid:bea` (seesaw, organised, loves lists), `kid:jun` (swings, loves stars and his telescope), `kid:luna` (merry-go-round, animals, dreamy): 25 lines each, at least 4 chats that open with replies per friend. Chats are two or three steps, kind, and end on a line with no replies.
- The three new random kids use only `any-kid`.
- Nothing about her as she/he. Kids say "you". Never scold or compare her with her sister or anyone.

- [ ] **Step 3: Run the guards**

Run: `node --test tests/world3d-speech-lines.test.js`
Expected: all tests pass.

- [ ] **Step 4: Generate the review sheet and stop for the owner**

After Task 11 exists, run `node tools/line-sheet.js`, tell the owner to read `docs/lines/kids.md`, apply their changes, re-run the guards and the tool.

- [ ] **Step 5: Commit**

```bash
git add web/world/speech/kids.js && git commit -m 'Write the playmate lines: shared and per friend, with tap-to-reply chats' -- web/world/speech/kids.js
```

---

### Task 9: draw the bubbles and wire the world

**Files:**
- Create: `web/world/bubbles.js`
- Test: `tests/world3d-bubbles.test.js`
- Modify: `web/world/life.js` (add `speakers()`)
- Modify: `web/world/world-main.js` (create, Settings row, tick, silence, debug)
- Modify: `web/world/grade-2.html`, `web/world/grade-5.html` (script tags)
- Modify: `tests/paths.js` (`WORLD_FILES`)
- Test: `tests/world3d-speech-wiring.test.js`

- [ ] **Step 1: Write the failing test for `wrap`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Bubbles = require(worldFile('bubbles.js'));

const measure = (s) => s.length * 10;

test('wrap keeps short words on one line', () => {
  assert.deepEqual(Bubbles.wrap(measure, 'Hello there!', 200, 2), ['Hello there!']);
});

test('wrap breaks at spaces and never makes more than the allowed lines', () => {
  const lines = Bubbles.wrap(measure, 'one two three four five six seven eight', 100, 2);
  assert.ok(lines.length <= 2);
  assert.equal(lines.join(' ').replace(/…$/, '').length > 0, true);
});

test('wrap reports when the text does not fit', () => {
  assert.equal(Bubbles.fits(measure, 'one two three four five six seven eight', 100, 2), false);
  assert.equal(Bubbles.fits(measure, 'one two three four', 100, 2), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-bubbles.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write `web/world/bubbles.js`**

```js
/* The ambient word bubbles over characters' heads: a white speech bubble on a canvas texture, as a sprite that follows
   its speaker and fades in and out (chatter.js decides who speaks and when). English only. Cosmetic: nothing is saved. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var POOL = 3, CACHE = 24, W = 512, H = 192, LIFT = 1.3;

  // Words into at most maxLines lines no wider than maxW (measure(text) gives a pixel width).
  function wrap(measure, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      var next = line ? line + ' ' + w : w;
      if (line && measure(next) > maxW) {
        lines.push(line);
        line = w;
      } else line = next;
    });
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }

  function fits(measure, text, maxW, maxLines) {
    var lines = wrap(measure, text, maxW, 99);
    return lines.length <= maxLines && lines.every(function (l) { return measure(l) <= maxW; });
  }

  function paint(S, doc, text) {
    var c = doc.createElement('canvas');
    c.width = W;
    c.height = H;
    var x = c.getContext('2d'), size = 44, lines;
    do {
      x.font = '800 ' + size + 'px "Baloo 2", sans-serif';
      size -= 4;
    } while (!fits(function (s) { return x.measureText(s).width; }, text, 440, 2) && size > 24);
    lines = wrap(function (s) { return x.measureText(s).width; }, text, 440, 2);
    function rounded(l, t, w, h, r) {
      x.beginPath();
      x.moveTo(l + r, t);
      x.arcTo(l + w, t, l + w, t + h, r);
      x.arcTo(l + w, t + h, l, t + h, r);
      x.arcTo(l, t + h, l, t, r);
      x.arcTo(l, t, l + w, t, r);
      x.closePath();
    }
    x.fillStyle = 'rgba(0,0,0,.14)';
    rounded(14, 18, 484, 126, 40);
    x.fill();
    x.fillStyle = '#ffffff';
    rounded(10, 10, 492, 126, 40);
    x.fill();
    x.beginPath();
    x.moveTo(236, 134);
    x.lineTo(276, 134);
    x.lineTo(256, 176);
    x.closePath();
    x.fill();
    x.fillStyle = '#3b3350';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    var lh = size + 8, top = 73 - ((lines.length - 1) * lh) / 2;
    lines.forEach(function (l, i) { x.fillText(l, 256, top + i * lh); });
    return S.canvasTexture(c);
  }

  function create(S, doc) {
    var sprites = [], textures = {}, order = [];
    for (var i = 0; i < POOL; i++) {
      var sp = S.sprite(S.emoji(' '), 5.3, 2);
      sp.visible = false;
      sp.material.opacity = 0;
      S.scene.add(sp);
      sprites.push(sp);
    }
    function texture(text) {
      if (!textures[text]) {
        textures[text] = paint(S, doc, text);
        order.push(text);
        if (order.length > CACHE) {
          var old = order.shift();
          textures[old].dispose();
          delete textures[old];
        }
      }
      return textures[text];
    }
    // list = chatter.step(...): [{ text, x, y, z, alpha }]
    function show(list) {
      sprites.forEach(function (sp, n) {
        var b = list[n];
        if (!b || b.alpha <= 0) {
          sp.visible = false;
          return;
        }
        var map = texture(b.text);
        if (sp.material.map !== map) {
          sp.material.map = map;
          sp.material.needsUpdate = true;
        }
        sp.material.opacity = b.alpha;
        sp.position.set(b.x, b.y + LIFT, b.z);
        sp.visible = true;
      });
    }
    return { show: show, count: function () { return sprites.filter(function (sp) { return sp.visible; }).length; } };
  }

  var exported = { wrap: wrap, fits: fits, create: create };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Bubbles = exported;
})(this);
```

Run: `node --test tests/world3d-bubbles.test.js` → PASS (3 tests).

- [ ] **Step 4: Add `speakers()` to `life.js`**

In `create(o)`, next to `var chars = ...`, add `var lastOut = null;`. In `tick`, right after `var out = engine.tick(...)`, add `lastOut = out;`. Before the final `return {`, add:

```js
    // The pets as speakers for chatter.js: where each one is now and how high its head is.
    function speakers() {
      var list = [];
      if (!lastOut) return list;
      defs.forEach(function (d) {
        var p = d.pet ? lastOut.poses[d.id] : null;
        if (!p) return;
        list.push({ id: d.id, speaker: { id: d.id, kind: 'pet', species: d.species, name: d.name }, x: p.x, z: p.z, head: PET_HEAD + p.y, hidden: !!p.hidden });
      });
      return list;
    }
```

and add `speakers: speakers,` to the returned object (after `snapHome: snapHome,`). Update the file's top comment by one clause: "and lists the pets as speakers for chatter.js".

- [ ] **Step 5: Wire `world-main.js`**

After `var life = W.Life.create({...});` add:

```js
    var speechData = W.Speech.merge(W.SpeechPets, W.SpeechKids), speechState = W.Speech.newState();
    var chatCtx = W.SpeechCtx.build({ hour: 12, her: { x: 0, z: 0 } }), chatCtxAt = -10, rideEnded = -999, wasRiding = false;
    var KID_HEAD = 4.4;
    var chatter = W.Chatter.create({
      rand: Math.random,
      ask: function (s) {
        var line = W.Speech.pick(speechData, s.speaker, chatCtx, speechState, Math.random);
        return line ? W.Speech.fill(line.say, chatCtx) : null;
      }
    });
    var bubbles = W.Bubbles.create(S, doc);
```

Add these helper functions near `buildHud` (they only read state):

```js
    // Spots where a character may mention the place: [{ tag, x, z, r }] from the layout.
    var chatSpots = (function () {
      var pr = L.props(grade), spots = [];
      [['slide', 'near:slide', 9], ['swings', 'near:swings', 9], ['seesaw', 'near:seesaw', 9], ['merry', 'near:merry', 9],
       ['fountain', 'near:plaza', 12], ['fort', 'near:fort', 14], ['jesus', 'near:garden', 10], ['pond', 'near:pond', 8], ['shop', 'near:shop', 10]
      ].forEach(function (s) { if (pr[s[0]]) spots.push({ tag: s[1], x: pr[s[0]].x, z: pr[s[0]].z, r: s[2] }); });
      return spots;
    })();

    function refreshChatCtx(st) {
      var streak = 0, fav = [];
      try { streak = root.Quests.streakOf(root.Quests.read(store).days, today()); } catch (e) {}
      try {
        var saved = W.MateQuiz.read(store, today()).fun;
        W.MateLines.FUN.forEach(function (q) {
          if (Object.prototype.hasOwnProperty.call(saved, q.id)) fav.push({ q: q.id, choice: saved[q.id], label: q.choices[saved[q.id]] });
        });
      } catch (e) {}
      var items = W.Items;
      chatCtx = W.SpeechCtx.build({
        hour: new Date().getHours(), her: { x: st.x, z: st.z }, spots: chatSpots,
        wear: shown ? shown.wear : {},
        itemName: function (id) { var it = items.find(id); return it ? it.en : ''; },
        petSpecies: shown ? shown.pet : '', petName: shown ? W.Look.petName(shown) : '',
        streak: streak, afterRide: t - rideEnded < 30, tired: stamina.state().tired, fav: fav
      });
    }

    function chatSpeakers() {
      var list = life.speakers(), kids = mates.api.owners();
      Object.keys(kids).forEach(function (key) {
        var k = kids[key];
        list.push({ id: key, speaker: { id: key.slice(5), kind: 'kid' }, x: k.x, z: k.z, head: KID_HEAD, hidden: !!k.hidden });
      });
      return list;
    }

    function chatSilent(st) {
      return !!(maker || stall || overlay || talking || deco || play.riding() || (games && games.playing()) || st.sprint || stamina.state().tired);
    }
```

Before writing these, verify with `grep -n "W.MateQuiz\|MateQuiz =" web/world/*.js` that the global name of `matequiz.js` is `MateQuiz` (if the export is under another name such as `Quiz`, use that name), and with `grep -n "var deco\|deco =" web/world/world-main.js` that `deco` is the decorate-view variable (it is used in `canZoom`).

In the per-frame `tick` function, replace the line `if (!overlay) life.tick(t, dt, st);` with:

```js
        if (!overlay) life.tick(t, dt, st);
        var ridingNow = !!play.riding();
        if (wasRiding && !ridingNow) rideEnded = t;
        wasRiding = ridingNow;
        if (t - chatCtxAt > 0.5) {
          refreshChatCtx(st);
          chatCtxAt = t;
        }
        bubbles.show(chatter.step(dt, { mode: prefs.chatter, her: st, speakers: overlay ? [] : chatSpeakers(), silent: !!overlay || chatSilent(st) }));
```

In `openSettings`, after the `setting(T.steps, ...)` block, add:

```js
      setting(T.chatter, W.Prefs.CHATTERS.map(function (m) { return { value: m, text: T.chatterNames[m] }; }), prefs.chatter, function (m) {
        prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { chatter: m }));
      });
```

In the debug block near `debug.talking`, add:

```js
    debug.bubbles = function () { return bubbles.count(); };
    debug.setChatter = function (m) { prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { chatter: m })); };
```

If `tick` can run before `life` and `mates` exist (check the order in the file: `chatSpeakers` uses `life` and `mates`, both created before the first frame), no guard is needed.

- [ ] **Step 6: Add the new files to the world's file list and pages**

In `tests/paths.js`, `WORLD_FILES`: insert `'speech.js', 'speechctx.js', 'chatter.js', 'speech/pets.js', 'speech/kids.js'` right after `'matelines.js'`; insert `'speechchat.js'` right after `'talk.js'`; insert `'bubbles.js'` right before `'life.js'`.

In both `web/world/grade-2.html` and `web/world/grade-5.html`, add the matching `<script src="..."></script>` lines at the same positions in the same order (open the file, find the `matelines.js`, `talk.js` and `life.js` tags, and copy their exact tag style). `speechchat.js` is created in Task 10; until then keep its entry out of both places and add it in Task 10 together.

Run: `node tools/update-precache.js`

- [ ] **Step 7: Write the wiring test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');

const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');

test('the world creates the chatter, draws bubbles and silences them while she is busy', () => {
  assert.match(main, /W\.Chatter\.create\(/);
  assert.match(main, /W\.Bubbles\.create\(/);
  assert.match(main, /chatter\.step\(/);
  assert.match(main, /bubbles\.show\(/);
  assert.match(main, /function chatSilent/);
});

test('Settings has a Chatter row for Quiet, Calm and Chatty', () => {
  assert.match(main, /setting\(T\.chatter,/);
  assert.match(main, /W\.Prefs\.CHATTERS/);
});

test('chatter never touches coins, points or storage', () => {
  for (const f of ['speech.js', 'speechctx.js', 'chatter.js', 'bubbles.js']) {
    const src = fs.readFileSync(worldFile(f), 'utf8');
    for (const banned of ['Wallet', 'Recall.', 'StudyKit', 'localStorage', 'store.']) assert.ok(!src.includes(banned), f + ' ' + banned);
  }
});

test('life.js lists the pets as speakers', () => {
  assert.match(fs.readFileSync(worldFile('life.js'), 'utf8'), /speakers: speakers/);
});
```

- [ ] **Step 8: Run the whole suite**

Run: `node --test`
Expected: PASS. Fix any wiring test that fails because of script order (`tests/world3d-wiring.test.js` compares the page's tags with `WORLD_FILES`) or the precache list (`node tools/update-precache.js`).

- [ ] **Step 9: Commit**

```bash
git add web/world/bubbles.js web/world/life.js web/world/world-main.js web/world/grade-2.html web/world/grade-5.html web/sw.js tests/paths.js tests/world3d-bubbles.test.js tests/world3d-speech-wiring.test.js && git commit -m 'Show ambient word bubbles over pets and playmates, with a Chatter setting for Quiet, Calm and Chatty' -- web/world/bubbles.js web/world/life.js web/world/world-main.js web/world/grade-2.html web/world/grade-5.html web/sw.js tests/paths.js tests/world3d-bubbles.test.js tests/world3d-speech-wiring.test.js
```

---

### Task 10: tap-to-reply chat with a playmate

**Files:**
- Create: `web/world/speechchat.js`
- Modify: `web/world/mates3d.js` (the 💬 Chat button on a playmate's bubble)
- Modify: `tests/paths.js`, `web/world/grade-2.html`, `grade-5.html` (add `speechchat.js` after `talk.js`)
- Test: `tests/world3d-speechchat.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Chat = require(worldFile('speechchat.js'));

const DATA = {
  pools: {
    'any-kid': [],
    'kid:migo': [
      { id: 'c1', say: 'Joke?', fil: 'Biro?', replies: [{ text: 'Yes!', next: 'c2' }, { text: 'Later', next: 'c3' }] },
      { id: 'c2', follow: true, say: 'Knock knock!', fil: 'Tok tok!' },
      { id: 'c3', follow: true, say: 'Okay!', fil: 'Sige!' }
    ]
  }
};

test('a step shows the English alone on Grade 5 and the pair on Grade 2', () => {
  const line = DATA.pools['kid:migo'][0];
  assert.equal(Chat.textOf(line, { tags: [], slots: {} }, 'grade5').text, 'Joke?');
  const g2 = Chat.textOf(line, { tags: [], slots: {} }, 'grade2');
  assert.equal(g2.text, 'Biro? · Joke?');
  assert.equal(g2.pair, true);
});

test('buttons are the replies, then Bye; a chat end has only Bye as the main button', () => {
  const open = Chat.buttons(DATA.pools['kid:migo'][0], 'Bye', () => {}, () => {});
  assert.deepEqual(open.map((b) => b.text), ['Yes!', 'Later', 'Bye']);
  assert.ok(!open[2].main);
  const end = Chat.buttons(DATA.pools['kid:migo'][1], 'Bye', () => {}, () => {});
  assert.deepEqual(end.map((b) => b.text), ['Bye']);
  assert.ok(end[0].main);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-speechchat.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write `web/world/speechchat.js`**

```js
/* A tap chat in the speech bubble: a character's opening line, its reply buttons, the line each reply leads to, and Bye.
   Grade 2 shows "Filipino · English" through Talk's pair mode (the 🇵🇭 switch decides how much of it); Grade 5 English.
   Cosmetic: nothing is saved. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Speech = node ? require('./speech.js') : null;

  function speech() { return Speech || root.World3D.Speech; }

  function textOf(line, ctx, grade) {
    var en = speech().fill(line.say, ctx), fil = line.fil ? speech().fill(line.fil, ctx) : '';
    if (grade === 'grade2' && fil) return { text: fil + ' · ' + en, pair: true };
    return { text: en, pair: false };
  }

  // choose(reply) runs when a reply is tapped; bye runs for the Bye button.
  function buttons(line, byeText, choose, bye) {
    var out = (line.replies || []).map(function (r) { return { text: r.text, onClick: function () { choose(r); } }; });
    out.push({ text: byeText, main: !out.length, onClick: bye });
    return out;
  }

  // o = { doc, data, speaker, face, who, ctx, state, rand, grade, byeText, onClose }; returns false when no line fits.
  function open(o) {
    var W = root.World3D, line = speech().pick(o.data, o.speaker, o.ctx, o.state, o.rand, true), handle = null;
    if (!line) return false;
    function step(l) {
      var t = textOf(l, o.ctx, o.grade);
      handle = W.Talk.open({
        doc: o.doc, face: o.face, who: o.who, text: t.text, pair: t.pair, stack: true,
        buttons: buttons(l, o.byeText, function (r) {
          var next = speech().reply(o.data, r);
          if (next) step(next);
          else if (o.onClose) o.onClose();
        }, function () { if (o.onClose) o.onClose(); })
      });
    }
    step(line);
    return { close: function () { if (handle) handle.close(); } };
  }

  var exported = { textOf: textOf, buttons: buttons, open: open };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.SpeechChat = exported;
})(this);
```

Note on `Talk.open`: a button click closes the bubble first, then runs the button's action, which opens the next bubble; the world stays frozen between the two because `talking` is held by the playmate's own talk state (see Step 4), and no `onClose` runs between steps, only at the end.

- [ ] **Step 4: Add the 💬 Chat button in `mates3d.js`**

Read `web/world/mates3d.js` lines 120-260 (`openTalk`, `hello`, the `buttons` list around line 132). In the list of buttons the playmate's bubble builds, add one more button after the existing ones (before Bye if the file orders them that way):

```js
        { text: T.chat, onClick: function () { openChat(k); } }
```

and add `openChat` next to `openTalk`:

```js
    function openChat(k) {
      var shown = o.chatContext ? o.chatContext() : null;
      if (!shown) return;
      var opened = W.SpeechChat.open({
        doc: doc, data: o.chatData(), speaker: { id: k.m.id, kind: 'kid' }, face: k.m.face, who: nameOf(k), ctx: shown.ctx,
        state: shown.state, rand: Math.random, grade: grade, byeText: T.buttons ? T.buttons.bye : '👋 Bye',
        onClose: function () { talk = null; o.busy(false); }
      });
      if (!opened) { talk = null; o.busy(false); }
    }
```

Use the exact local names the file already uses for the document, the grade, `T` and the busy callback (`doc`, `grade`, `o.busy`, and the same way `openTalk` reads Bye text); adjust the snippet to match. Keep the kid standing still while the chat runs the same way `openTalk` does (it sets `talking = ...` and calls `o.busy(true)`; reuse those two lines at the start of `openChat`, and clear them in `onClose`).

In `world-main.js`, pass two new options to `W.Mates3D.create({...})`:

```js
      chatData: function () { return speechData; },
      chatContext: function () { return { ctx: chatCtx, state: speechState }; },
```

(`speechData`, `chatCtx` and `speechState` are declared after `life`; move their `var` lines above the `W.Mates3D.create` call so they exist when it runs, keeping the `chatter`/`bubbles` creation where Task 9 put it.)

- [ ] **Step 5: Add `speechchat.js` to the lists and pages, then run everything**

`tests/paths.js` `WORLD_FILES`: `'speechchat.js'` right after `'talk.js'`; add the same tag in both `grade-*.html` pages; run `node tools/update-precache.js`; run `node --test`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/world/speechchat.js web/world/mates3d.js web/world/world-main.js web/world/grade-2.html web/world/grade-5.html web/sw.js tests/paths.js tests/world3d-speechchat.test.js && git commit -m 'Add tap-to-reply chat with a playmate: a Chat button, reply buttons and two or three step conversations' -- web/world/speechchat.js web/world/mates3d.js web/world/world-main.js web/world/grade-2.html web/world/grade-5.html web/sw.js tests/paths.js tests/world3d-speechchat.test.js
```

---

### Task 11: the review sheets

**Files:**
- Create: `tools/line-sheet.js`
- Create: `docs/lines/pets.md`, `docs/lines/kids.md` (generated)
- Test: `tests/world3d-speech-sheets.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./paths.js');
const Sheet = require(path.join(ROOT, 'tools', 'line-sheet.js'));

test('render groups a pool by situation and shows replies and the Filipino half', () => {
  const md = Sheet.render('Test', { pools: { 'any-kid': [
    { id: 'a', say: 'Hi!' },
    { id: 'b', when: ['time:evening'], say: 'Good evening!' },
    { id: 'c', say: 'Joke?', fil: 'Biro?', replies: [{ text: 'Yes!', next: 'd' }] },
    { id: 'd', follow: true, say: 'Knock knock!', fil: 'Tok tok!' }
  ] } });
  assert.match(md, /# Test: lines to review/);
  assert.match(md, /## Any playmate \(4 lines\)/);
  assert.match(md, /### Anytime/);
  assert.match(md, /### time:evening/);
  assert.match(md, /Joke\? _\(Biro\?\)_/);
  assert.match(md, /\[Yes!\] → Knock knock!/);
});

test('the pages in docs/lines are up to date (run node tools/line-sheet.js)', () => {
  for (const s of Sheet.SHEETS) {
    const file = path.join(ROOT, 'docs', 'lines', s.out);
    assert.ok(fs.existsSync(file), s.out + ' is missing');
    assert.equal(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), Sheet.sheet(s), s.out);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/world3d-speech-sheets.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write `tools/line-sheet.js`**

```js
// Turns the line files in web/world/speech/ into readable review pages in docs/lines/. Run: node tools/line-sheet.js
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHEETS = [
  { file: 'pets.js', out: 'pets.md', title: 'Pets' },
  { file: 'kids.js', out: 'kids.md', title: 'Playmates' }
];

function poolTitle(id) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (id === 'any-pet') return 'Any pet';
  if (id === 'any-kid') return 'Any playmate';
  if (id.startsWith('species:')) return 'Species: ' + id.slice(8);
  if (id.startsWith('pet:')) return 'Pet: ' + cap(id.slice(4));
  if (id.startsWith('kid:')) return 'Playmate: ' + cap(id.slice(4));
  return id;
}

function render(title, data) {
  const byId = {};
  Object.values(data.pools).forEach((lines) => lines.forEach((l) => { byId[l.id] = l; }));
  const out = ['# ' + title + ': lines to review', '',
    'Made by `node tools/line-sheet.js` from the line files in `web/world/speech/`. Do not edit this page: tell Claude what to change.', ''];
  Object.keys(data.pools).sort().forEach((pool) => {
    const lines = data.pools[pool];
    out.push('## ' + poolTitle(pool) + ' (' + lines.length + ' lines)', '');
    const groups = {};
    lines.filter((l) => !l.follow).forEach((l) => {
      const key = l.when && l.when.length ? l.when.join(' + ') : 'Anytime';
      (groups[key] = groups[key] || []).push(l);
    });
    Object.keys(groups).sort((a, b) => (a === 'Anytime' ? -1 : b === 'Anytime' ? 1 : a.localeCompare(b))).forEach((key) => {
      out.push('### ' + key, '');
      groups[key].forEach((l) => {
        out.push('- ' + l.say + (l.fil ? ' _(' + l.fil + ')_' : ''));
        (l.replies || []).forEach((r) => {
          const next = byId[r.next];
          out.push('  - [' + r.text + '] → ' + (next ? next.say : '(missing ' + r.next + ')'));
        });
      });
      out.push('');
    });
  });
  return out.join('\n') + '\n';
}

function sheet(s) {
  return render(s.title, require(path.join(ROOT, 'web', 'world', 'speech', s.file)));
}

function writeAll() {
  const dir = path.join(ROOT, 'docs', 'lines');
  fs.mkdirSync(dir, { recursive: true });
  SHEETS.forEach((s) => fs.writeFileSync(path.join(dir, s.out), sheet(s)));
  console.log('wrote ' + SHEETS.map((s) => 'docs/lines/' + s.out).join(', '));
}

module.exports = { SHEETS, render, sheet };
if (require.main === module) writeAll();
```

- [ ] **Step 4: Generate the pages and run the test**

Run: `node tools/line-sheet.js`, then `node --test tests/world3d-speech-sheets.test.js`
Expected: PASS. Re-run `node tools/line-sheet.js` whenever a line changes.

- [ ] **Step 5: Commit**

```bash
git add tools/line-sheet.js docs/lines tests/world3d-speech-sheets.test.js && git commit -m 'Add the review sheets for character lines: one readable page per speaker group' -- tools/line-sheet.js docs/lines tests/world3d-speech-sheets.test.js
```

---

### Task 12: end-to-end check, docs, the spec's later list

**Files:**
- Modify: `tests/e2e/world-e2e.js` (and `tests/e2e/world-driver.page.js` if it holds the page helpers)
- Modify: `docs/superpowers/specs/2026-10-13-character-chatter-design.md`, `docs/HANDOFF.md`, `README.md`

- [ ] **Step 1: Add the headless-Chrome checks**

Read `tests/e2e/world-e2e.js` and copy how an existing block moves her near a place (a teleport or `debug.goTo`-style helper) and waits. Add a block with these checks, using `debug.setChatter` and `debug.bubbles`:
1. `setChatter('quiet')`, stand by the playground (the kids and the pets are near), wait 12 s: `debug.bubbles()` stays 0.
2. `setChatter('chatty')`, stay 25 s: `debug.bubbles()` reaches at least 1 at some moment (poll once a second).
3. Open a talk bubble (`debug.talking()` true): within 2 s `debug.bubbles()` is 0.
4. Tap a playmate, press 💬 Chat: a `.talk` bubble opens with at least one reply button; pressing a reply opens the next line; pressing Bye closes it and `debug.talking()` is false.

- [ ] **Step 2: Run the world checks**

Run: `node tests/e2e/world-e2e.js`
Expected: PASS, including the four new checks and every older one.

- [ ] **Step 3: Update the spec to match what was built**

In `docs/superpowers/specs/2026-10-13-character-chatter-design.md`:
- Files: add `bubbles.js` and `speechchat.js`, and note `chatter.js` is the pure scheduler.
- Tags table: remove `near:school`, add `near:pond` and `near:shop`; remove `medal:today` and `studied:*` from A1 (move them to Later).
- The tap chat section: the playmate bubble gets a 💬 Chat button that opens the chat; pet chat needs a tap target and is Later.
- A1 content target: her own pet is Later.
- Later list: add "her own pet as a speaker", "pet tap chat (dynamic near item)", "studied and medal tags".

- [ ] **Step 4: Update `docs/HANDOFF.md` and `README.md`**

HANDOFF "Built": a bullet "Character chatter A1 (2026-10-13)" naming the files, the Chatter setting, the review sheets (`docs/lines/`), and the pending tablet check (how Calm feels, bubble readability for Grade 2). "Next": A2 (town characters) and A3 plans. README: one line under the 3D world section about the Chatter setting and `node tools/line-sheet.js` after editing lines.

- [ ] **Step 5: Run everything**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e docs/superpowers/specs/2026-10-13-character-chatter-design.md docs/HANDOFF.md README.md && git commit -m 'Check character chatter end to end and update the spec, handoff and README' -- tests/e2e docs/superpowers/specs/2026-10-13-character-chatter-design.md docs/HANDOFF.md README.md
```

---

## Self-review

- **Spec coverage:** line engine and pools (Task 1), facts (2), limits and silence (3, 9), the setting (4, 5, 9), line rules enforced (6), pet and kid lines (7, 8), bubbles and wiring (9), tap chat (10), review sheets (11), tests, docs and the spec's Later list (12). Her own pet, pet tap chat and the `studied` and `medal` tags are listed as not in A1, and Task 12 puts them in the spec's Later list.
- **Placeholders:** none in code steps. Tasks 7 and 8 are content tasks: the acceptance check is the guard test, and the format, counts, voices and an example are given.
- **Names:** `Speech.pick/fill/reply/merge/poolIds/newState/validTag/validSlot/slotsOf/isChat`, `SpeechCtx.build`, `Chatter.create().step`, `Bubbles.create(S, doc).show/count`, `SpeechChat.open/textOf/buttons`, `Prefs.CHATTERS`, `life.speakers()` are used the same way everywhere. `SpeechPets` and `SpeechKids` are the globals for the data files.
- **Risks to watch during the build:** `matequiz.js`'s global name and `deco` in Task 9, the exact local names in `mates3d.js` in Task 10, and the e2e helpers in Task 12. Each task tells the implementer to confirm them before editing.
