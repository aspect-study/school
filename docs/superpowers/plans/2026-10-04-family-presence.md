# Family Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each sister sees the other's buddy by the campus gate (glowing when she is playing now), opens a card with her big moments (medals, boss stages, all quests, streaks), and sends one-tap pre-written cheers that pop up on her sister's tablet after the next sync. Nothing compares them and cheers earn nothing.

**Architecture:** A new engine file, `web/engine/family.js`, keeps a small synced key in the child's own learner space (`family_v1`: last-active time, big-moment news, cheers sent) plus the counter `cheers_sent_total`. Tablets never write each other's data: after each good sync round `cloud.js` reads ("peeks") four docs of every other learner and hands them to `Family.store()`, which keeps them on the device as `family_peek_v1`. `mastery.js`, `boss.js` and `quests.js` report big moments through a `deps.news` hook. `world.js` fires a `world-drawn` event, and family.js draws the sister buddies and the card on top of the map.

**Tech Stack:** Plain ES5 JavaScript, inline SVG, `node:test` unit tests, headless-Chrome e2e (`tests/e2e/`), Firebase Firestore through the existing `firebase-remote.js`. Static files only (GitHub Pages).

**Spec:** `docs/superpowers/specs/2026-10-04-family-presence-design.md`

**Rules for every task (from the user's CLAUDE.md):**
- Never run `git commit`. At the end of each task, give the user a `git add` block and a `git commit -m '...'` block and let them run it. No `Co-Authored-By` lines.
- Use comments sparingly; only for non-obvious code. Match the surrounding style (ES5 `var`/`function` in engine files, 2-space indent, no arrow functions in `web/`).
- `git status` shows staged work from another session (`tests/read-gate.test.js`, `web/engine/fx.js`, `web/engine/read-gate.js`). Leave those files alone, never edit `fx.js`, and never add them to this feature's commit commands. Commit only the paths you list, using `git commit -m '...' -- <paths>` so the other staged files stay out.

**Test commands:**
- One unit file: `node --test tests/family.test.js`
- All unit tests: `node --test` (from the repo root)
- Sisters e2e: `node tests/e2e/sisters-e2e.js`
- Lobby e2e: `node tests/e2e/lobby-e2e.js` and `node tests/e2e/lobby-e2e.js 5`
- File-check e2e: `node tests/e2e/file-check-e2e.js`
- After adding a file under `web/`: `node tools/update-precache.js`

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `web/engine/sync-core.js` | modify | kinds `family`, `familySeen`, counter `cheers_sent_total`, `family_peek_v1` device-only, `MERGE.family`, `MERGE.familySeen` |
| `web/engine/firebase-remote.js` | modify | `peek(id, keys, counters)`: read a few docs of another learner |
| `web/engine/family.js` | create | `family_v1` state, news, cheers + guard, peek cache, seen marks, sisters/unseen logic, text, lobby UI |
| `web/engine/mastery.js`, `boss.js`, `quests.js` | modify | `deps.news(kind, data)` hook at their pay points + browser wiring to `Family.note` |
| `web/engine/world.js` | modify | export `esc`/`svgText`; fire `world-drawn` after each mount |
| `web/engine/cloud.js` | modify | `Family.touch()` before a round, `peekFamily()` after it, empty peek on sign-out |
| `web/lobby/grade-5.html`, `grade-2.html` | modify | load `subjects.js` + `family.js`; GLOBALS gets `family` |
| 17 game pages `web/subjects/grade-N/*/index.html` | modify | load `family.js` after `boss.js`; GLOBALS gets `family` |
| `tests/paths.js` | modify | `family.js` in `ENGINE_FILES` |
| `web/sw.js` | regenerate | precache `engine/family.js` |
| `tests/sync.test.js` | modify | merge rules, counter, peek contract, two-tablet round trip |
| `tests/family.test.js` | create | unit tests for family.js |
| `tests/family-wiring.test.js` | create | pages, engines, cloud.js and world.js wiring |
| `tests/mastery.test.js`, `quests.test.js`, `boss.test.js` | modify | news hook tests |
| `tests/world.test.js`, `tests/world-wiring.test.js` | modify | exported helpers; GLOBALS string |
| `tests/english-everywhere.test.js` | modify | Grade 2 family text and cheers pair Filipino with English |
| `tests/e2e/sisters-e2e.js`, `tests/e2e/driver-sisters.page.js` | create | the lobby with a seeded sister |
| `README.md` | modify | feature bullet, engine line, e2e line |

---

### Task 1: sync-core: family kinds, merge rules and the cheers counter

**Files:**
- Modify: `web/engine/sync-core.js`
- Test: `tests/sync.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/sync.test.js`:

```js
test('family keys: what kind each one is', () => {
  assert.equal(kindOf('family_v1'), 'family');
  assert.equal(kindOf('family_seen_v1'), 'familySeen');
  assert.equal(kindOf('cheers_sent_total'), 'counter');
  assert.equal(kindOf('family_peek_v1'), null, 'her sister\'s data never leaves the tablet');
});

test('family: news and sent cheers join by id, newest first, trimmed; at is the later one; either order agrees', () => {
  const day = 86400000;
  const a = { v: 1, at: 50, news: [{ id: 'n1', t: 10, kind: 'medal' }, { id: 'n2', t: 30, kind: 'boss' }], sent: [{ id: 's1', t: 8 * day, to: 'b', cheer: 'great' }] };
  const b = { v: 1, at: 70, news: [{ id: 'n2', t: 30, kind: 'boss' }, { id: 'n3', t: 20, kind: 'quests' }], sent: [{ id: 's0', t: 0, to: 'b', cheer: 'go' }, { id: 's2', t: 8 * day + 5, to: 'b', cheer: 'can' }] };
  const ab = MERGE.family(a, b);
  assert.deepEqual(ab, MERGE.family(b, a));
  assert.equal(ab.at, 70);
  assert.deepEqual(ab.news.map((n) => n.id), ['n2', 'n3', 'n1']);
  assert.deepEqual(ab.sent.map((s) => s.id), ['s2', 's1'], 'cheers a week older than the newest are dropped');
  const many = { v: 1, at: 0, news: Array.from({ length: 25 }, (_, i) => ({ id: 'x' + i, t: i, kind: 'quests' })), sent: [] };
  assert.equal(MERGE.family(many, null).news.length, 25, 'one side alone is kept as it is');
  assert.equal(MERGE.family(many, { v: 1, at: 0, news: [], sent: [] }).news.length, 20);
  assert.equal(MERGE.family(null, null), null);
  assert.deepEqual(MERGE.family({ v: 1, news: [{ id: 'j' }, 'junk'], sent: 'x' }, { v: 1 }), { v: 1, at: 0, news: [], sent: [] });
});

test('family seen marks only go forward, in either order', () => {
  const a = { cheers: 5, news: { x: 3, y: 9 } }, b = { cheers: 7, news: { x: 4 } };
  assert.deepEqual(MERGE.familySeen(a, b), { cheers: 7, news: { x: 4, y: 9 } });
  assert.deepEqual(MERGE.familySeen(b, a), MERGE.familySeen(a, b));
  assert.deepEqual(MERGE.familySeen(null, b), { cheers: 7, news: { x: 4 } });
  assert.equal(MERGE.familySeen(null, null), null);
});

test('cheers sent add up across devices like points', async () => {
  const cloud = fakeCloud();
  const a = device(cloud, 'ana'), b = device(cloud, 'ana');
  a.s.setItem('cheers_sent_total', '2');
  await a.sync();
  b.s.setItem('cheers_sent_total', '1');
  await b.sync();
  await a.sync();
  assert.equal(a.s.getItem('cheers_sent_total'), '3');
  assert.equal(b.s.getItem('cheers_sent_total'), '3');
  assert.equal(cloud.db.ana.counters.cheers_sent_total.total, 3);
});

test('family_v1 from two devices of one child joins in the cloud; the peek cache never leaves the tablet', async () => {
  const cloud = fakeCloud();
  const a = device(cloud, 'ana'), b = device(cloud, 'ana');
  a.s.setItem('family_v1', JSON.stringify({ v: 1, at: 5, news: [{ id: 'n1', t: 5, kind: 'quests' }], sent: [] }));
  a.s.setItem('family_peek_v1', JSON.stringify({ sis: { total: 1 } }));
  await a.sync();
  b.s.setItem('family_v1', JSON.stringify({ v: 1, at: 9, news: [{ id: 'n2', t: 9, kind: 'boss' }], sent: [] }));
  await b.sync();
  await a.sync();
  const fam = (d) => JSON.parse(d.s.getItem('family_v1'));
  assert.deepEqual(fam(a).news.map((n) => n.id), ['n2', 'n1']);
  assert.deepEqual(fam(b), fam(a));
  assert.equal(cloud.db.ana.state.family_peek_v1, undefined);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/sync.test.js`
Expected: FAIL. `kindOf('family_v1')` returns `'replace'`, and `MERGE.family` is not a function.

- [ ] **Step 3: Implement**

In `web/engine/sync-core.js`:

1. Replace the constants block at the top (lines 7-14) with:

```js
  var STATE = 'sync_state_v1';
  var LOCAL_ONLY = /^(sync_|last_backup_v1$|history_error_v1$|history_corrupt_v1_|family_peek_v1$)/;
  var POINTS = /_points_v1$/;
  var CHEERS_TOTAL = 'cheers_sent_total';
  var PROGRESS = /_progress_v\d+$/;
  var PROGRESS_DAY = /_progress_v\d+_day$/;
  var WALLET_COUNTERS = ['spent', 'bonus'];
  var REQUEST_STEP = { waiting: 0, approved: 1, declined: 1, done: 2, cancelled: 2, short: 2 };
  var REQUESTS_KEEP_MS = 7 * 86400000;
  var FAMILY_NEWS = 20;
  var FAMILY_SENT_MS = 7 * 86400000;
  // Kinds whose value is saved as JSON under its own key.
  var JSON_KINDS = { recall: true, review: true, quests: true, boss: true, mastery: true, profile: true, requests: true, family: true, familySeen: true };
```

2. In `kindOf`, change the first counter line and add the two family kinds before the `PROGRESS` line:

```js
    if (POINTS.test(key) || key === CHEERS_TOTAL) return 'counter';
```

```js
    if (key === 'family_v1') return 'family';
    if (key === 'family_seen_v1') return 'familySeen';
```

3. After `function bossApps(list) { ... }`, add:

```js
  // Family news and sent cheers: one list per id from both copies, newest first; the same id is the same entry.
  function familyList(x, y) {
    var byId = {};
    [x, y].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (e) {
        if (!isObj(e) || typeof e.id !== 'string' || typeof e.t !== 'number' || !isFinite(e.t)) return;
        var have = byId[e.id];
        if (!have || JSON.stringify(e) > JSON.stringify(have)) byId[e.id] = e;
      });
    });
    return Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (p, q) { return q.t - p.t || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0); });
  }
```

4. In `MERGE`, before `recall:`, add:

```js
    // Family presence: news and cheers sent join by id (the last 20 news; cheers until a week before the newest), at only goes up.
    family: function (a, b) {
      a = isObj(a) ? a : null;
      b = isObj(b) ? b : null;
      if (!a || !b) return a || b;
      var sent = familyList(a.sent, b.sent), newest = sent.length ? sent[0].t : 0;
      return {
        v: 1,
        at: Math.max(Number(a.at) || 0, Number(b.at) || 0),
        news: familyList(a.news, b.news).slice(0, FAMILY_NEWS),
        sent: sent.filter(function (s) { return s.t >= newest - FAMILY_SENT_MS; })
      };
    },
    // What she has already been shown: the later time wins, per sister for news.
    familySeen: function (a, b) {
      if (!isObj(a) && !isObj(b)) return null;
      var news = {};
      [a, b].forEach(function (x) {
        if (!isObj(x) || !isObj(x.news)) return;
        Object.keys(x.news).forEach(function (k) { var v = Number(x.news[k]) || 0; if (!(news[k] >= v)) news[k] = v; });
      });
      return { cheers: Math.max(isObj(a) ? Number(a.cheers) || 0 : 0, isObj(b) ? Number(b.cheers) || 0 : 0), news: news };
    },
```

5. In `readLocal`, replace the line
`if (kind === 'recall' || kind === 'review' || kind === 'quests' || kind === 'boss' || kind === 'mastery' || kind === 'profile' || kind === 'requests') return json(space.getItem(key), null);`
with:

```js
      if (JSON_KINDS[kind]) return json(space.getItem(key), null);
```

6. In `writeLocal`, replace
`} else if (kind === 'recall' || kind === 'review' || kind === 'quests' || kind === 'boss' || kind === 'mastery' || kind === 'profile' || kind === 'requests') {`
with:

```js
      } else if (JSON_KINDS[kind]) {
```

7. In `counterKeys`, replace the filter line with:

```js
      var keys = space.keys().filter(function (k) { return POINTS.test(k) || k === CHEERS_TOTAL; });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/sync.test.js`
Expected: PASS, all tests (old and new).

- [ ] **Step 5: Commit (the user runs it)**

```bash
git add web/engine/sync-core.js tests/sync.test.js
```

```bash
git commit -m "Sync family presence data: family_v1 news and cheers join by id across devices, seen marks only go forward, cheers_sent_total adds up like points, and the sister peek cache never leaves the tablet" -- web/engine/sync-core.js tests/sync.test.js
```

---

### Task 2: the remote `peek` call

**Files:**
- Modify: `web/engine/firebase-remote.js` (inside `remoteFor`'s returned object)
- Modify: `tests/sync.test.js` (`fakeCloud`)

- [ ] **Step 1: Write the failing test**

In `tests/sync.test.js`, add this method to the object in `fakeCloud()`, after `putHistory`:

```js
    peek: async (id, keys, counters) => {
      if (cloud.offline) throw new Error('offline');
      const l = L(id);
      return {
        state: Object.fromEntries(keys.map((k) => [k, l.state[k] ? copy(l.state[k].value) : null])),
        counters: Object.fromEntries(counters.map((k) => [k, l.counters[k] ? l.counters[k].total : 0])),
      };
    },
```

Then append the test:

```js
test('peek reads only the asked keys of another learner and changes nothing', async () => {
  const cloud = fakeCloud();
  const sis = device(cloud, 'mia');
  sis.s.setItem('profile_v1', JSON.stringify({ name: 'Mia', emoji: '', grade: 2, at: 1 }));
  sis.s.setItem('world_v1', JSON.stringify({ v: 1, avatar: 'owl', view: 'campus', at: null, t: 1 }));
  sis.s.setItem('blockbot_points_v1', '50');
  sis.s.setItem('cheers_sent_total', '4');
  await sis.sync();
  const before = JSON.stringify(cloud.db);
  const r = await cloud.peek('mia', ['profile_v1', 'world_v1', 'family_v1'], ['cheers_sent_total']);
  assert.deepEqual(r, {
    state: { profile_v1: { name: 'Mia', emoji: '', grade: 2, at: 1 }, world_v1: JSON.stringify({ v: 1, avatar: 'owl', view: 'campus', at: null, t: 1 }), family_v1: null },
    counters: { cheers_sent_total: 4 },
  });
  assert.equal(JSON.stringify(cloud.db), before);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/sync.test.js`
Expected: PASS. This test pins the contract that the fake and the real remote share. The real Firestore call can't run under Node, so Task 8 adds a static check that it exists.

- [ ] **Step 3: Implement the Firestore version**

In `web/engine/firebase-remote.js`, inside the object returned by `remoteFor`, add after `putHistory`:

```js
      // Reads a few state docs and counters of one learner (her sister's, for family.js). Missing docs read as null and 0.
      peek: function (id, keys, counters) {
        var reads = keys.map(function (k) { return F.getDoc(stateRef(id, k)); })
          .concat(counters.map(function (k) { return F.getDoc(F.doc(sub(id, 'counters'), enc(k))); }));
        return Promise.all(reads).then(function (snaps) {
          var out = { state: {}, counters: {} };
          keys.forEach(function (k, i) { out.state[k] = snaps[i].exists() ? parse(snaps[i].data().json) : null; });
          counters.forEach(function (k, i) {
            var s = snaps[keys.length + i];
            out.counters[k] = s.exists() ? Number(s.data().total) || 0 : 0;
          });
          return out;
        });
      },
```

(`profile_v1` maps to the learner doc through `stateRef`, the same as `merge` uses. `world_v1` is a plain synced key, so it comes back as the saved JSON text; family.js parses it.)

- [ ] **Step 4: Run all unit tests**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit (the user runs it)**

```bash
git add web/engine/firebase-remote.js tests/sync.test.js
```

```bash
git commit -m "Add the cloud peek: read a few docs of another learner (profile, buddy, family news and cheer total) without writing anything" -- web/engine/firebase-remote.js tests/sync.test.js
```

---

### Task 3: `family.js` core: state, news, cheers, peek, sisters

**Files:**
- Create: `web/engine/family.js`
- Create: `tests/family.test.js`
- Modify: `tests/paths.js:8` (`ENGINE_FILES`)
- Modify: `tests/english-everywhere.test.js`
- Regenerate: `web/sw.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/family.test.js`:

```js
process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');
const { read, note, touch, canSend, send, store, readPeek, readSeen, markCheers, markNews, sisters, unseenCheers, relation, voiceOf,
  newsLine, ago, CHEERS, TEXT, KEY, SEEN, PEEK, TOTAL, PEEK_STATE, PEEK_COUNTERS, DAY_LIMIT, NEWS_KEEP } = require(engineFile('family.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function clock(y, m, d, h) {
  let t = new Date(y, m - 1, d, h || 9, 0).getTime();
  const now = () => t;
  now.days = (n) => { const x = new Date(t); x.setDate(x.getDate() + n); t = x.getTime(); };
  now.mins = (n) => { t += n * 60000; };
  now.secs = (n) => { t += n * 1000; };
  return now;
}

const rnd = () => 0.5;
const saved = (s) => JSON.parse(s.data[KEY]);
const EMPTY = { v: 1, at: 0, news: [], sent: [] };
const ME = { id: 'ana', grade: 5 };
const peekOf = (now, family, extra) => Object.assign({
  mia: { profile: { name: '', emoji: '', grade: 2 }, world: { avatar: 'rabbit' }, family, total: 3, readAt: now() },
}, extra);

test('keys and limits', () => {
  assert.deepEqual([KEY, SEEN, PEEK, TOTAL], ['family_v1', 'family_seen_v1', 'family_peek_v1', 'cheers_sent_total']);
  assert.deepEqual(PEEK_STATE, ['profile_v1', 'world_v1', 'family_v1']);
  assert.deepEqual(PEEK_COUNTERS, ['cheers_sent_total']);
  assert.equal(DAY_LIMIT, 10);
  assert.equal(NEWS_KEEP, 20);
});

test('junk reads as an empty family state', () => {
  assert.deepEqual(read(memory()), EMPTY);
  assert.deepEqual(read(memory({ family_v1: '{nope' })), EMPTY);
  assert.deepEqual(read(memory({ family_v1: JSON.stringify({ v: 2, at: 5 }) })), EMPTY);
});

test('note keeps only the four big moments, newest first, at most 20', () => {
  const s = memory(), now = clock(2026, 10, 4);
  assert.equal(note(s, now, rnd, 'medal', { app: 'block-bot', tier: 1, title: 'Skip Counting', coins: 3 }), true);
  now.mins(1);
  note(s, now, rnd, 'streak', { n: 7 });
  assert.equal(note(s, now, rnd, 'score', { n: 90 }), false, 'never scores');
  assert.equal(note(s, now, rnd, 'constructor'), false);
  const news = saved(s).news;
  assert.deepEqual(news.map((n) => n.kind), ['streak', 'medal']);
  assert.deepEqual(Object.keys(news[1]).sort(), ['app', 'id', 'kind', 't', 'tier', 'title'], 'coins are never kept');
  assert.equal(news[0].n, 7);
  for (let i = 0; i < 25; i++) { now.mins(1); note(s, now, rnd, 'quests'); }
  assert.equal(saved(s).news.length, 20);
});

test('touch saves when she was last in the lobby', () => {
  const s = memory(), now = clock(2026, 10, 4);
  assert.equal(touch(s, now), true);
  assert.equal(saved(s).at, now());
});

test('a cheer: 10 a day, not the same one twice in a minute, a new day starts fresh', () => {
  const s = memory(), now = clock(2026, 10, 4, 20);
  assert.equal(send(s, now, rnd, 'mia', 'great'), true);
  assert.equal(s.data[TOTAL], '1');
  assert.deepEqual(saved(s).sent.map(({ to, cheer }) => ({ to, cheer })), [{ to: 'mia', cheer: 'great' }]);
  now.secs(30);
  assert.deepEqual(canSend(s, now, 'great'), { ok: false, reason: 'again', left: 9 });
  assert.equal(send(s, now, rnd, 'mia', 'great'), false);
  assert.equal(send(s, now, rnd, 'mia', 'love'), true, 'another cheer is fine');
  now.secs(31);
  assert.equal(send(s, now, rnd, 'mia', 'great'), true, 'after a minute');
  for (const id of ['proud', 'can', 'smart', 'go', 'love', 'proud', 'can']) { now.mins(2); assert.equal(send(s, now, rnd, 'mia', id), true, id); }
  assert.deepEqual(canSend(s, now, 'go'), { ok: false, reason: 'limit', left: 0 });
  assert.equal(send(s, now, rnd, 'mia', 'go'), false);
  assert.equal(s.data[TOTAL], '10');
  now.mins(4 * 60);
  assert.equal(canSend(s, now, 'go').ok, true, 'a new day');
  assert.equal(send(s, now, rnd, 'mia', 'hug'), false, 'unknown cheer');
  assert.equal(send(s, now, rnd, '', 'go'), false, 'no sister');
});

test('sent cheers older than a week are dropped when saving', () => {
  const s = memory(), now = clock(2026, 10, 1);
  send(s, now, rnd, 'mia', 'go');
  now.days(8);
  send(s, now, rnd, 'mia', 'can');
  assert.deepEqual(saved(s).sent.map((x) => x.cheer), ['can']);
});

test('who is Ate: the higher grade; the sender picks the cheer words', () => {
  assert.equal(relation(5, 2), 'bunso');
  assert.equal(relation(2, 5), 'ate');
  assert.equal(relation(5, 5), 'sister');
  assert.equal(voiceOf('ate'), 'fromAte');
  assert.equal(voiceOf('bunso'), 'fromBunso');
  assert.equal(voiceOf('sister'), 'fromAte');
  assert.deepEqual(CHEERS.fromAte.map((c) => c.id), ['great', 'proud', 'can', 'smart', 'love', 'go']);
  assert.deepEqual(CHEERS.fromBunso.map((c) => c.id), CHEERS.fromAte.map((c) => c.id));
  assert.equal(CHEERS.fromAte[0].text, "Galing mo, Bunso! · You're great! 💖");
  assert.equal(CHEERS.fromBunso[0].text, "Galing mo, Ate! · You're great! 🌟");
});

test('store keeps each sister\'s profile, buddy, family and cheer total; an empty list clears it', () => {
  const s = memory(), now = clock(2026, 10, 4);
  // world_v1 is a plain synced key, so the cloud holds the saved JSON text; profile_v1 and family_v1 come as objects.
  store(s, now, [{ id: 'mia', state: { profile_v1: { name: 'Mia', grade: 2 }, world_v1: JSON.stringify({ v: 1, avatar: 'owl' }), family_v1: { v: 1, at: 5, news: [], sent: [] } }, counters: { cheers_sent_total: 4 } }, { nope: 1 }]);
  assert.deepEqual(readPeek(s), { mia: { profile: { name: 'Mia', grade: 2 }, world: { v: 1, avatar: 'owl' }, family: { v: 1, at: 5, news: [], sent: [] }, total: 4, readAt: now() } });
  store(s, now, []);
  assert.deepEqual(readPeek(s), {});
  assert.deepEqual(readPeek(memory({ family_peek_v1: '[1]' })), {});
});

test('sisters: label, buddy, playing now, the last 5 news and the 💌 mark', () => {
  const now = clock(2026, 10, 4);
  const news = Array.from({ length: 7 }, (_, i) => ({ id: 'n' + i, t: now() - (7 - i) * 60000, kind: 'quests' }));
  const fam = { v: 1, at: now() - 4 * 60000, news, sent: [] };
  const list = sisters(ME, peekOf(now, fam, { ana: { profile: { grade: 5 } } }), now(), null);
  assert.equal(list.length, 1, 'never myself');
  const m = list[0];
  assert.deepEqual([m.id, m.rel, m.name, m.grade, m.avatar, m.playing, m.total, m.hasNews], ['mia', 'bunso', '', 2, 'rabbit', true, 3, true]);
  assert.deepEqual(m.news.map((n) => n.id), ['n6', 'n5', 'n4', 'n3', 'n2']);
  now.mins(2);
  assert.equal(sisters(ME, peekOf(now, fam), now(), null)[0].playing, false, '5 minutes after her last visit');
  assert.equal(sisters(ME, peekOf(now, fam), now(), { news: { mia: news[6].t } })[0].hasNews, false, 'seen');
  assert.equal(sisters(ME, peekOf(now, null), now(), null)[0].hasNews, false, 'no family data yet');
});

test('unseen cheers to me, in her words, oldest first; unknown ids and cheers to others are skipped', () => {
  const now = clock(2026, 10, 4);
  const fam = { v: 1, at: 0, news: [], sent: [
    { id: 'c3', t: 300, to: 'ana', cheer: 'love' },
    { id: 'c2', t: 200, to: 'ana', cheer: 'hug' },
    { id: 'c1', t: 100, to: 'ana', cheer: 'great' },
    { id: 'c0', t: 50, to: 'leo', cheer: 'great' }] };
  const got = unseenCheers(ME, peekOf(now, fam), null);
  assert.deepEqual(got.map((c) => [c.from, c.rel, c.t, c.text]),
    [['mia', 'bunso', 100, "Galing mo, Ate! · You're great! 🌟"], ['mia', 'bunso', 300, 'Love kita, Ate! · Love you! 🤗']]);
  assert.deepEqual(unseenCheers(ME, peekOf(now, fam), { cheers: 100 }).map((c) => c.t), [300]);
  const fromAte = { ana: { profile: { grade: 5 }, family: { v: 1, sent: [{ id: 'x', t: 9, to: 'mia', cheer: 'great' }] } } };
  assert.deepEqual(unseenCheers({ id: 'mia', grade: 2 }, fromAte, null).map((c) => c.text), ["Galing mo, Bunso! · You're great! 💖"]);
});

test('seen marks only go forward', () => {
  const s = memory();
  markCheers(s, 300);
  markCheers(s, 100);
  markNews(s, 'mia', 50);
  markNews(s, 'mia', 20);
  assert.deepEqual(readSeen(s), { cheers: 300, news: { mia: 50 } });
  assert.deepEqual(readSeen(memory({ family_seen_v1: 'x' })), { cheers: 0, news: {} });
});

test('news lines name the subject and never show scores', () => {
  const SUBJ = { 5: [{ app: 'life-lab', title: 'Science' }], 2: [{ app: 'block-bot', title: 'Math' }] };
  const t5 = TEXT.grade5, t2 = TEXT.grade2;
  assert.equal(newsLine(t5, { kind: 'medal', app: 'block-bot', tier: 1, title: 'Skip Counting' }, SUBJ), '🥉 Bronze in Math: Skip Counting');
  assert.equal(newsLine(t5, { kind: 'medal', app: 'gone-app', tier: 3 }, SUBJ), '🥇 Gold in gone-app');
  assert.equal(newsLine(t5, { kind: 'boss', app: 'life-lab' }, SUBJ), '⚔️ Cleared a boss stage in Science');
  assert.equal(newsLine(t5, { kind: 'quests' }, SUBJ), '✅ Did all 3 quests today');
  assert.equal(newsLine(t5, { kind: 'streak', n: 14 }, SUBJ), '🔥 14-day streak');
  assert.equal(newsLine(t2, { kind: 'medal', app: 'life-lab', tier: 2, title: 'Plants' }, SUBJ), '🥈 Silver sa Science · Silver in Science: Plants');
  assert.equal(newsLine(t2, { kind: 'streak', n: 7 }, null), '🔥 7 araw na sunod-sunod · a 7-day streak');
  assert.equal(ago(1000, 1000 + 30000), 'just now');
  assert.equal(ago(0, 5 * 60000), '5 min ago');
  assert.equal(ago(0, 2 * 3600000), '2 h ago');
  assert.equal(ago(0, 24 * 3600000), '1 day ago');
  assert.equal(ago(0, 3 * 24 * 3600000), '3 days ago');
  assert.equal(t5.count(1, 'Bunso'), '💖 1 cheer from Bunso');
  assert.equal(t5.count(12, 'Bunso'), '💖 12 cheers from Bunso');
});

// A game page: Family has note and touch, and nothing is drawn.
function page(opts) {
  const s = memory();
  const win = {
    document: {
      currentScript: { getAttribute: (k) => (k === 'data-grade' ? 'grade5' : null) },
      visibilityState: opts.hidden ? 'hidden' : 'visible',
      getElementById: () => null,
      addEventListener() {},
    },
    Learner: { storage: s, current: () => ({ id: 'ana', grade: 5 }) },
    Clock: { paused: () => !!opts.paused },
    setTimeout,
    clearTimeout,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('family.js'), 'utf8'), win);
  return { win, s };
}

test('in a game, Family.note writes news unless the date guard is on; touch skips a hidden page', () => {
  const p = page({});
  assert.equal(p.win.Family.note('quests'), true);
  assert.equal(JSON.parse(p.s.data.family_v1).news.length, 1);
  assert.equal(page({ paused: true }).win.Family.note('quests'), false);
  assert.equal(page({ hidden: true }).win.Family.touch(), false);
  assert.equal(p.win.Family.touch(), true);
});

test('without data-grade, Family has the helpers only', () => {
  const win = {};
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('family.js'), 'utf8'), win);
  assert.equal(typeof win.Family.sisters, 'function');
  assert.equal(win.Family.note, undefined);
});
```

Append to `tests/english-everywhere.test.js`:

```js
test('every Grade 2 family line and Bunso\'s cheers have English', () => {
  const { TEXT, CHEERS } = require(engineFile('family.js'));
  const t = TEXT.grade2;
  [t.ate, t.bunso, t.sister, t.playing, t.seen('2 h ago'), t.buddy('Ate'), t.title('Ate'), t.newsHead, t.noNews, t.cheerHead,
    t.count(1, 'Ate'), t.count(4, 'Ate'), t.limit, t.sent, t.close, t.next('Ate'), t.medal(1, 'Math', 'Skip Counting'),
    t.boss('Math'), t.quests, t.streak(7)].concat(CHEERS.fromBunso.map((c) => c.text))
    .forEach((line) => hasEnglishWhereFilipino(line, 'family text'));
  assert.equal(t.close, 'Close', 'buttons are English only');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/family.test.js tests/english-everywhere.test.js`
Expected: FAIL with `Cannot find module ... family.js`.

- [ ] **Step 3: Create `web/engine/family.js`**

```js
/* Loaded by every game (after boss.js) and both lobbies (after world.js and subjects.js). The pages are decoded as
   UTF-8, so the text can hold emoji.
   Family presence: each sister sees the other's buddy by the gate, her big moments, and sends one-tap cheers.
   A tablet writes only its own learner space; the sister's data comes in through cloud.js as family_peek_v1.
   Nothing here compares the sisters or touches points and coins. */
(function (root) {
  'use strict';

  var KEY = 'family_v1';
  var SEEN = 'family_seen_v1';
  var PEEK = 'family_peek_v1';
  var TOTAL = 'cheers_sent_total';
  var PEEK_STATE = ['profile_v1', 'world_v1', KEY];
  var PEEK_COUNTERS = [TOTAL];
  var KINDS = { medal: true, boss: true, quests: true, streak: true };
  var NEWS_KEEP = 20;
  var CARD_NEWS = 5;
  var SENT_KEEP_MS = 7 * 86400000;
  var DAY_LIMIT = 10;
  var SAME_GAP_MS = 60000;
  var PLAYING_MS = 5 * 60000;
  var MEDALS = ['', '🥉', '🥈', '🥇'];
  var TIERS = ['', 'Bronze', 'Silver', 'Gold'];

  // Same id, same button spot; each direction has its own words. Ids are permanent once released.
  var CHEERS = {
    fromAte: [
      { id: 'great', text: "Galing mo, Bunso! · You're great! 💖" },
      { id: 'proud', text: 'So proud of you! 🌟' },
      { id: 'can', text: 'You can do it! 💪' },
      { id: 'smart', text: "Ang talino mo! · You're so smart! 🧠" },
      { id: 'love', text: 'Love you, Bunso! 🤗' },
      { id: 'go', text: 'Keep going! 🚀' }
    ],
    fromBunso: [
      { id: 'great', text: 'Galing mo, Ate! · You\'re great! 🌟' },
      { id: 'proud', text: 'Idol kita, Ate! · You\'re my idol! 💖' },
      { id: 'can', text: 'Kaya mo \'yan! · You can do it! 💪' },
      { id: 'smart', text: 'Salamat, Ate! · Thank you! 🙏' },
      { id: 'love', text: 'Love kita, Ate! · Love you! 🤗' },
      { id: 'go', text: 'Laban, Ate! · Fight! 🔥' }
    ]
  };

  function cheersEn(n) { return n === 1 ? ' cheer' : ' cheers'; }
  var TEXT = {
    grade5: {
      ate: 'Ate', bunso: 'Bunso', sister: 'Sister',
      playing: 'playing now',
      seen: function (when) { return 'last seen ' + when; },
      buddy: function (name) { return name + '\'s buddy. Tap to see her big moments and send a cheer.'; },
      title: function (name) { return '💖 ' + name; },
      newsHead: 'Big moments',
      noNews: 'No big moments yet. Cheer her on!',
      cheerHead: 'Send a cheer 💌',
      count: function (n, name) { return '💖 ' + n + cheersEn(n) + ' from ' + name; },
      limit: 'More cheers tomorrow!',
      sent: 'Sent! 💌',
      close: 'Close',
      next: function (name) { return 'Tap ' + name + '\'s buddy to cheer back!'; },
      medal: function (tier, app, title) { return MEDALS[tier] + ' ' + TIERS[tier] + ' in ' + app + (title ? ': ' + title : ''); },
      boss: function (app) { return '⚔️ Cleared a boss stage in ' + app; },
      quests: '✅ Did all 3 quests today',
      streak: function (n) { return '🔥 ' + n + '-day streak'; }
    },
    grade2: {
      ate: 'Ate', bunso: 'Bunso', sister: 'Kapatid · Sister',
      playing: 'naglalaro ngayon · playing now',
      seen: function (when) { return 'last seen ' + when; },
      buddy: function (name) { return 'Kasama ni ' + name + '. Pindutin para makita at i-cheer siya. · ' + name + '\'s buddy. Tap to see her big moments and send a cheer.'; },
      title: function (name) { return '💖 ' + name; },
      newsHead: 'Mga tagumpay niya · Big moments',
      noNews: 'Wala pa. I-cheer mo siya! · No big moments yet. Go and cheer her on!',
      cheerHead: 'Magpadala ng cheer · Send a cheer 💌',
      count: function (n, name) { return '💖 ' + n + ' cheer mula kay ' + name + ' · ' + n + cheersEn(n) + ' to you from ' + name; },
      limit: 'Bukas ulit! · Again tomorrow!',
      sent: 'Naipadala na! · It is sent! 💌',
      close: 'Close',
      next: function (name) { return 'Pindutin si ' + name + ' para mag-cheer pabalik · Tap ' + name + ' to cheer back!'; },
      medal: function (tier, app, title) { return MEDALS[tier] + ' ' + TIERS[tier] + ' sa ' + app + ' · ' + TIERS[tier] + ' in ' + app + (title ? ': ' + title : ''); },
      boss: function (app) { return '⚔️ Natalo ang boss sa ' + app + ' · Cleared a boss stage in ' + app; },
      quests: '✅ Tapos ang 3 quests ngayon · All 3 quests done for the day',
      streak: function (n) { return '🔥 ' + n + ' araw na sunod-sunod · a ' + n + '-day streak'; }
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function readJson(storage, key) { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } }
  function parseObj(v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } }
    return isObj(v) ? v : null;
  }
  function newestFirst(a, b) { return b.t - a.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
  function entries(list) {
    return (Array.isArray(list) ? list : []).filter(function (e) {
      return isObj(e) && typeof e.id === 'string' && typeof e.t === 'number' && isFinite(e.t);
    }).sort(newestFirst);
  }

  function clean(d) {
    var ok = isObj(d) && d.v === 1;
    return {
      v: 1,
      at: ok ? num(d.at) : 0,
      news: ok ? entries(d.news).filter(function (n) { return KINDS[n.kind] === true; }) : [],
      sent: ok ? entries(d.sent) : []
    };
  }
  function read(storage) { return clean(readJson(storage, KEY)); }
  function write(storage, state, t) {
    state.news = state.news.slice(0, NEWS_KEEP);
    state.sent = state.sent.filter(function (s) { return s.t >= t - SENT_KEEP_MS; });
    try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function newId(t, random) { return t.toString(36) + '-' + Math.floor(random() * 1679616).toString(36); }

  // A big moment for her sister's card. Only the four kinds; never scores, coins or wrong answers.
  function note(storage, now, random, kind, data) {
    if (KINDS[kind] !== true) return false;
    var t = now(), s = read(storage), e = { id: newId(t, random), t: t, kind: kind };
    data = isObj(data) ? data : {};
    if (typeof data.app === 'string' && data.app) e.app = data.app;
    if (typeof data.title === 'string' && data.title) e.title = data.title;
    if (data.tier >= 1 && data.tier <= 3) e.tier = Math.floor(data.tier);
    if (data.n >= 1) e.n = Math.floor(data.n);
    s.news.unshift(e);
    return write(storage, s, t);
  }

  function touch(storage, now) {
    var t = now(), s = read(storage);
    s.at = t;
    return write(storage, s, t);
  }

  function cheerText(voice, id) {
    var list = has(CHEERS, voice) ? CHEERS[voice] : [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].text;
    return null;
  }

  function dayKey(t) { var d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  // 10 cheers a local day, and never the same cheer twice inside a minute, so a cheer cannot become teasing.
  function canSend(storage, now, cheerId) {
    var t = now(), sent = read(storage).sent, today = dayKey(t);
    var used = sent.filter(function (s) { return dayKey(s.t) === today; }).length;
    if (used >= DAY_LIMIT) return { ok: false, reason: 'limit', left: 0 };
    if (cheerId && sent.some(function (s) { return s.cheer === cheerId && t >= s.t && t - s.t < SAME_GAP_MS; })) {
      return { ok: false, reason: 'again', left: DAY_LIMIT - used };
    }
    return { ok: true, left: DAY_LIMIT - used };
  }

  function send(storage, now, random, to, cheerId) {
    if (typeof to !== 'string' || !to || !cheerText('fromAte', cheerId) || !canSend(storage, now, cheerId).ok) return false;
    var t = now(), s = read(storage);
    s.sent.unshift({ id: newId(t, random), t: t, to: to, cheer: cheerId });
    if (!write(storage, s, t)) return false;
    try { storage.setItem(TOTAL, String((parseInt(storage.getItem(TOTAL), 10) || 0) + 1)); } catch (e) {}
    return true;
  }

  // list: [{ id, state: { profile_v1, world_v1, family_v1 }, counters: { cheers_sent_total } }] from cloud.js.
  // world_v1 is a plain synced key, so it arrives as the saved JSON text.
  function store(storage, now, list) {
    var out = {}, t = now();
    (Array.isArray(list) ? list : []).forEach(function (r) {
      if (!isObj(r) || typeof r.id !== 'string' || !r.id) return;
      var st = isObj(r.state) ? r.state : {}, c = isObj(r.counters) ? r.counters : {};
      out[r.id] = { profile: isObj(st.profile_v1) ? st.profile_v1 : {}, world: parseObj(st.world_v1) || {},
        family: isObj(st[KEY]) ? st[KEY] : null, total: num(c[TOTAL]), readAt: t };
    });
    try {
      if (storage.put) storage.put(PEEK, JSON.stringify(out));
      else storage.setItem(PEEK, JSON.stringify(out));
    } catch (e) {}
  }
  function readPeek(storage) { var d = readJson(storage, PEEK); return isObj(d) ? d : {}; }

  function cleanSeen(d) {
    var news = {};
    if (isObj(d) && isObj(d.news)) Object.keys(d.news).forEach(function (k) { news[k] = num(d.news[k]); });
    return { cheers: isObj(d) ? num(d.cheers) : 0, news: news };
  }
  function readSeen(storage) { return cleanSeen(readJson(storage, SEEN)); }
  function saveSeen(storage, s) { try { storage.setItem(SEEN, JSON.stringify(s)); } catch (e) {} }
  function markCheers(storage, t) {
    var s = readSeen(storage);
    if (t > s.cheers) { s.cheers = t; saveSeen(storage, s); }
  }
  function markNews(storage, id, t) {
    var s = readSeen(storage);
    if (!(s.news[id] >= t)) { s.news[id] = t; saveSeen(storage, s); }
  }

  // What she is to me: the higher grade is Ate.
  function relation(myGrade, herGrade) { return herGrade > myGrade ? 'ate' : herGrade < myGrade ? 'bunso' : 'sister'; }
  function voiceOf(senderIs) { return senderIs === 'bunso' ? 'fromBunso' : 'fromAte'; }
  function nameIn(prof) { return typeof prof.name === 'string' ? prof.name.trim() : ''; }

  function sisters(me, peek, nowMs, seen) {
    seen = cleanSeen(seen);
    peek = isObj(peek) ? peek : {};
    return Object.keys(peek).sort().filter(function (id) { return id !== me.id && isObj(peek[id]); }).map(function (id) {
      var p = peek[id], prof = isObj(p.profile) ? p.profile : {}, fam = clean(p.family), grade = num(prof.grade);
      return {
        id: id, rel: relation(num(me.grade), grade), grade: grade, name: nameIn(prof),
        avatar: isObj(p.world) && typeof p.world.avatar === 'string' ? p.world.avatar : null,
        at: fam.at, playing: fam.at > 0 && nowMs - fam.at < PLAYING_MS,
        news: fam.news.slice(0, CARD_NEWS),
        hasNews: fam.news.length > 0 && fam.news[0].t > num(seen.news[id]),
        total: num(p.total)
      };
    });
  }

  function unseenCheers(me, peek, seen) {
    seen = cleanSeen(seen);
    peek = isObj(peek) ? peek : {};
    var out = [];
    Object.keys(peek).forEach(function (id) {
      if (id === me.id || !isObj(peek[id])) return;
      var p = peek[id], prof = isObj(p.profile) ? p.profile : {}, rel = relation(num(me.grade), num(prof.grade));
      clean(p.family).sent.forEach(function (s) {
        var text = cheerText(voiceOf(rel), s.cheer);
        if (s.to === me.id && s.t > seen.cheers && text) out.push({ from: id, rel: rel, name: nameIn(prof), t: s.t, text: text });
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // subjects: engine/subjects.js ({ 5: [{ app, title }], 2: [...] }), so a news line names her sister's subject.
  function appTitle(subjects, app) {
    var found = '';
    Object.keys(isObj(subjects) ? subjects : {}).forEach(function (g) {
      (Array.isArray(subjects[g]) ? subjects[g] : []).forEach(function (s) { if (!found && s && s.app === app) found = s.title; });
    });
    return found || app || '';
  }
  function newsLine(T, n, subjects) {
    var app = appTitle(subjects, n.app);
    if (n.kind === 'medal') return T.medal(n.tier >= 1 && n.tier <= 3 ? n.tier : 1, app, n.title || '');
    if (n.kind === 'boss') return T.boss(app);
    if (n.kind === 'quests') return T.quests;
    return T.streak(n.n || 0);
  }
  function ago(t, nowMs) {
    var min = Math.floor((nowMs - t) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    var h = Math.floor(min / 60);
    if (h < 24) return h + ' h ago';
    var d = Math.floor(h / 24);
    return d === 1 ? '1 day ago' : d + ' days ago';
  }

  function mountUi(win, grade, storage, deps) {
    var doc = win.document, api = { text: TEXT[grade] };
    api.note = function (kind, data) { return deps.paused() ? false : note(storage, deps.now, deps.random, kind, data); };
    api.touch = function () { return doc.visibilityState === 'hidden' ? false : touch(storage, deps.now); };
    api.store = function (list) { store(storage, deps.now, list); };
    return api;
  }

  var exported = { read: read, note: note, touch: touch, canSend: canSend, send: send, store: store, readPeek: readPeek,
    readSeen: readSeen, markCheers: markCheers, markNews: markNews, sisters: sisters, unseenCheers: unseenCheers,
    relation: relation, voiceOf: voiceOf, cheerText: cheerText, newsLine: newsLine, ago: ago,
    CHEERS: CHEERS, TEXT: TEXT, KEY: KEY, SEEN: SEEN, PEEK: PEEK, TOTAL: TOTAL, PEEK_STATE: PEEK_STATE,
    PEEK_COUNTERS: PEEK_COUNTERS, DAY_LIMIT: DAY_LIMIT, NEWS_KEEP: NEWS_KEEP };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Games and lobbies get note/touch for their grade; a page without data-grade gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && TEXT[grade]) {
      api = mountUi(root, grade, root.Learner ? root.Learner.storage : root.localStorage, {
        now: Date.now,
        random: Math.random,
        me: function () { return root.Learner && root.Learner.current ? root.Learner.current() : null; },
        paused: function () { return !!(root.Clock && root.Clock.paused()); },
        sync: function () { if (root.Cloud && root.Cloud.sync) root.Cloud.sync(); }
      });
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Family = api;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Register the file**

In `tests/paths.js`, add `'family.js'` to `ENGINE_FILES` right after `'world.js'`:

```js
const ENGINE_FILES = ['storage.js', 'learner.js', 'clock.js', 'nav.js', 'search.js', 'read-gate.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'quests.js', 'boss.js', 'world.js', 'family.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'parent-panel.js'];
```

Run: `node tools/update-precache.js`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/family.test.js tests/english-everywhere.test.js tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 6: Commit (the user runs it)**

```bash
git add web/engine/family.js tests/family.test.js tests/english-everywhere.test.js tests/paths.js web/sw.js
```

```bash
git commit -m "Add family.js core: big-moment news (medal, boss, quests, streak only), one-tap cheers with a 10-a-day and once-a-minute guard, the sister peek cache, seen marks, Ate/Bunso by grade, and bilingual Grade 2 text" -- web/engine/family.js tests/family.test.js tests/english-everywhere.test.js tests/paths.js web/sw.js
```

---

### Task 4: two-tablet round trip

**Files:**
- Test: `tests/sync.test.js`

- [ ] **Step 1: Write the test**

Append to `tests/sync.test.js`:

```js
const Fam = require(engineFile('family.js'));

test('two tablets: Bunso\'s medal reaches Ate, Ate\'s cheer reaches Bunso once, and the cheer back counts', async () => {
  const cloud = fakeCloud();
  const ate = device(cloud, 'ana'), bunso = device(cloud, 'mia');
  ate.s.setItem('profile_v1', JSON.stringify({ name: '', emoji: '', grade: 5, at: 1 }));
  bunso.s.setItem('profile_v1', JSON.stringify({ name: '', emoji: '', grade: 2, at: 1 }));
  let T = new Date(2026, 9, 4, 9).getTime();
  const clock = () => T;
  const ME_A = { id: 'ana', grade: 5 }, ME_B = { id: 'mia', grade: 2 };
  // What cloud.js does after a good round.
  async function peekFor(d, me) {
    const list = await cloud.learners();
    const got = await Promise.all(list.filter((l) => l.id !== me.id)
      .map(async (l) => Object.assign({ id: l.id }, await cloud.peek(l.id, Fam.PEEK_STATE, Fam.PEEK_COUNTERS))));
    Fam.store(d.s, clock, got);
    return Fam.readPeek(d.s);
  }

  Fam.note(bunso.s, clock, Math.random, 'medal', { app: 'block-bot', tier: 1, title: 'Skip Counting' });
  await bunso.sync();
  await ate.sync();
  const seen = Fam.sisters(ME_A, await peekFor(ate, ME_A), clock(), Fam.readSeen(ate.s));
  assert.deepEqual(seen.map((s) => [s.id, s.rel, s.hasNews, s.news[0].kind]), [['mia', 'bunso', true, 'medal']]);

  assert.equal(Fam.send(ate.s, clock, Math.random, 'mia', 'great'), true);
  await ate.sync();
  await bunso.sync();
  const cheers = Fam.unseenCheers(ME_B, await peekFor(bunso, ME_B), Fam.readSeen(bunso.s));
  assert.deepEqual(cheers.map((c) => c.text), ["Galing mo, Bunso! · You're great! 💖"]);
  Fam.markCheers(bunso.s, cheers[0].t);
  assert.deepEqual(Fam.unseenCheers(ME_B, Fam.readPeek(bunso.s), Fam.readSeen(bunso.s)), [], 'shown once');

  T += 1000;
  assert.equal(Fam.send(bunso.s, clock, Math.random, 'ana', 'proud'), true);
  await bunso.sync();
  await ate.sync();
  const back = await peekFor(ate, ME_A);
  assert.equal(Fam.sisters(ME_A, back, clock(), null)[0].total, 1, 'Ate sees 1 cheer from Bunso');
  assert.deepEqual(Fam.unseenCheers(ME_A, back, null).map((c) => c.text), ["Idol kita, Ate! · You're my idol! 💖"]);
  assert.equal(cloud.db.ana.state.family_peek_v1, undefined, 'a peek never goes to the cloud');
  assert.equal(cloud.db.ana.state.family_v1.value.sent.length, 1, 'each tablet writes only its own learner');
  assert.equal(cloud.db.mia.state.family_v1.value.sent.length, 1);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/sync.test.js`
Expected: PASS. Tasks 1-3 already built the parts; this test proves they work together. If it fails, fix the code it points at, not the test.

- [ ] **Step 3: Commit (the user runs it)**

```bash
git add tests/sync.test.js
```

```bash
git commit -m "Test the sisters' round trip on two simulated tablets: news reaches Ate, a cheer reaches Bunso once, the cheer back counts, and each tablet writes only its own data" -- tests/sync.test.js
```

---

### Task 5: engines report big moments

**Files:**
- Modify: `web/engine/mastery.js` (`create`, `update`, browser wiring)
- Modify: `web/engine/quests.js` (`create`, `check`, browser wiring)
- Modify: `web/engine/boss.js` (`create`, `stageResult`, browser wiring)
- Test: `tests/mastery.test.js`, `tests/quests.test.js`, `tests/boss.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/mastery.test.js`:

```js
test('a new medal is told to the family news, once', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) }), told = [];
  const m = create(s, now, 'grade5', { news: (kind, data) => told.push([kind, data]) });
  const lessons = [lesson('l1', ['a'])];
  m.update('life-lab', lessons);
  s.data.review_v1 = boxes({ a: 2 });
  m.update('life-lab', lessons);
  m.update('life-lab', lessons);
  assert.deepEqual(told, [['medal', { app: 'life-lab', tier: 1, title: 'Lesson l1' }]]);
});

test('a refused medal payment tells no news', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) }), told = [];
  const m = create(s, now, 'grade5', { bonus: () => false, news: (kind) => told.push(kind) });
  m.update('life-lab', [lesson('l1', ['a'])]);
  s.data.review_v1 = boxes({ a: 2 });
  m.update('life-lab', [lesson('l1', ['a'])]);
  assert.deepEqual(told, []);
});
```

Append to `tests/quests.test.js`:

```js
test('the all-3 bonus and a streak milestone are told to the family news, once', () => {
  const now = clock(2026, 10, 2);
  const s = memory(), entries = [], told = [];
  const days = [];
  for (let i = 6; i >= 1; i--) { const x = new Date(2026, 9, 2 - i); days.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); }
  s.data.quests_v1 = JSON.stringify({ v: 1, day: '', at: 0, list: [], days, paidDay: '', streakPaid: [] });
  const q = create(s, now, 'grade5', { history: () => entries, due: () => ({}), weak: () => [], bonus: () => true,
    news: (kind, data) => told.push([kind, data]) });
  q.pick(CARDS);
  now.mins(1);
  entries.push(round(now, { stars: 3, correct: 12 }), round(now, { stars: 1, correct: 9 }));
  q.check();
  assert.deepEqual(told, [['quests', {}], ['streak', { n: 7 }]]);
  q.check();
  assert.equal(told.length, 2, 'once');
});
```

Append to `tests/boss.test.js`:

```js
test('a cleared boss stage is told to the family news, once', () => {
  const w = world(fourApps()), told = [];
  const b = create(w.s, w.now, 'grade5', { items: () => w.o.items, due: () => w.o.due, bonus: () => true, random: () => 0.5,
    news: (kind, data) => told.push([kind, data]) });
  b.ensure(CARDS);
  b.stageResult('c', 1, 3);
  b.stageResult('c', 2, 3);
  b.stageResult('c', 3, 3);
  assert.deepEqual(told, [['boss', { app: 'c', title: 'C Game' }]]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/mastery.test.js tests/quests.test.js tests/boss.test.js`
Expected: FAIL. Each `told` stays `[]`.

- [ ] **Step 3: Implement the hooks**

`web/engine/mastery.js`:
- In `create`, after `var bonus = deps && deps.bonus ? deps.bonus : function () { return true; };` add:

```js
    var news = deps && deps.news ? deps.news : function () {};
```

- In `update`, right before `result.counts = counts(entry);` add:

```js
        result.newly.forEach(function (m) { news('medal', { app: app, tier: m.level, title: m.title }); });
```

(`newly` is emptied when the payment is refused, so a refused medal tells nothing.)

- In the browser wiring at the bottom, change the deps object passed to `create` to:

```js
      bonus: function (coins) {
        var W = root.Wallet;
        if (!W || !W.addBonus || !W.addBonus(coins)) return false;
        if (W.renderCoins) W.renderCoins();
        return true;
      },
      news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }
```

`web/engine/quests.js`:
- In `create`, after `var T = TEXT[grade];` add:

```js
    var news = deps.news || function () {};
```

- In `check`, change the all-3 block and the milestone block to:

```js
      if (doneCount === state.list.length && state.paidDay !== today) {
        var before = state.paidDay;
        if (pay(ALL_COINS, function () { state.paidDay = today; }, function () { state.paidDay = before; })) {
          events.unshift({ big: true, icon: '🎯', title: T.allTitle, line: T.coins(ALL_COINS), next: T.allNext });
          news('quests', {});
        }
      }
      var s = streakOf(state.days, today);
      MILESTONES.forEach(function (m, i) {
        if (!s.start || s.days < m[0] || milestonePaid(state.streakPaid, m[0], s.start)) return;
        var key = s.start + '|' + m[0];
        if (pay(m[1], function () { state.streakPaid.push(key); }, function () { state.streakPaid.pop(); })) {
          events.unshift({ big: true, icon: '🔥', title: T.streakTitle(m[0]), line: T.coins(m[1]), next: T.streakNext(MILESTONES[i + 1] ? MILESTONES[i + 1][0] : 0) });
          news('streak', { n: m[0] });
        }
      });
```

- In the browser wiring, add after the `bonus` function inside the deps object (keep the comma after `bonus`'s closing brace):

```js
        news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }
```

`web/engine/boss.js`:
- In `create`, after `var T = TEXT[grade], random = deps.random || Math.random;` add:

```js
    var news = deps.news || function () {};
```

- In `stageResult`, change `if (!save(state)) return [];` (the one right after `stage.cleared = true;`) to:

```js
      if (!save(state)) return [];
      news('boss', { app: app, title: stage.title });
```

- In the browser wiring, add after the `bonus` function inside the deps object:

```js
        news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }
```

The hook line must read exactly `news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }` in all three files. Task 8's wiring test looks for it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: PASS, all unit tests.

- [ ] **Step 5: Commit (the user runs it)**

```bash
git add web/engine/mastery.js web/engine/quests.js web/engine/boss.js tests/mastery.test.js tests/quests.test.js tests/boss.test.js
```

```bash
git commit -m "Tell family.js about big moments: a paid medal, a cleared boss stage, all 3 quests and a streak milestone each add one news line for her sister" -- web/engine/mastery.js web/engine/quests.js web/engine/boss.js tests/mastery.test.js tests/quests.test.js tests/boss.test.js
```

---

### Task 6: the lobby UI: sister buddies, the card, the cheer popup

**Files:**
- Modify: `web/engine/world.js` (export `esc`/`svgText`; fire `world-drawn`)
- Modify: `web/engine/family.js` (replace `mountUi`; add `UI_CSS`)
- Test: `tests/world.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/world.test.js`:

```js
test('world.js shares its SVG text helpers with family.js', () => {
  assert.equal(W.esc('<a&"\'>'), '&lt;a&amp;&quot;&#39;&gt;');
  assert.equal(W.svgText('x', 1, 2, 10, 'Hi', 100), '<text class="x" x="1" y="2" font-size="10">Hi</text>');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/world.test.js`
Expected: FAIL, `W.esc is not a function`.

- [ ] **Step 3: Change `world.js`**

- In `exported`, add `esc: esc, svgText: svgText,` after `draw: draw,`.
- In `api.mount`, right before the final `return true;` add:

```js
      try { doc.dispatchEvent(new win.CustomEvent('world-drawn', { detail: { box: box } })); } catch (e) {}
```

- [ ] **Step 4: Replace `mountUi` in `family.js`**

Replace the whole `function mountUi(win, grade, storage, deps) { ... }` from Task 3 with the code below. Put `UI_CSS` and `SVG_NS` directly above it.

```js
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var UI_CSS =
    '.f-sis{cursor:pointer;outline:none;}' +
    '.f-sis:focus-visible .f-ring{stroke:var(--ink);stroke-width:6;}' +
    '.f-ring{fill:var(--card);stroke:#E46BA0;stroke-width:5;}' +
    '.f-glow{fill:#F9C5DC;opacity:.6;}' +
    '.f-away{opacity:.6;}' +
    '.f-tag{fill:var(--ink);font-weight:800;}' +
    '.f-mark circle{fill:var(--card);stroke:#E46BA0;stroke-width:3;}' +
    '.f-card{position:absolute;left:0;right:0;bottom:0;max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:10px;' +
      'padding:18px 16px 16px;background:var(--card);color:var(--ink);border:1.5px solid var(--border);border-radius:20px;box-sizing:border-box;}' +
    '.f-title{margin:0;font-weight:800;font-size:1.3rem;}' +
    '.f-sub{margin:0;color:var(--ink-soft);font-weight:700;}' +
    '.f-head{margin:6px 0 0;font-weight:800;}' +
    '.f-news{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-weight:700;}' +
    '.f-cheers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}' +
    '.f-cheers button,.f-close{font:inherit;font-weight:800;padding:12px 10px;border-radius:14px;border:1.5px solid var(--border);' +
      'background:var(--bg-alt);color:var(--ink);cursor:pointer;}' +
    '.f-cheers button:disabled{opacity:.45;cursor:default;}' +
    '.f-msg,.f-count{margin:0;font-weight:800;}' +
    '.f-close{align-self:center;padding:8px 22px;}';

  function mountUi(win, grade, storage, deps) {
    var doc = win.document, T = TEXT[grade], api = { text: T }, openId = null, lastMsg = '', tries = 0, timer = null;

    function me() { return deps.me() || { id: '', grade: 0 }; }
    function all() { return sisters(me(), readPeek(storage), deps.now(), readSeen(storage)); }
    function nameOf(s) { return s.name || T[s.rel]; }
    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    // Her buddy stands beside the gate, right then left, a little further out for each more sister.
    function spotOf(L, r, i) {
      var dx = Math.round(r * 3.4) * (Math.floor(i / 2) + 1) * (i % 2 ? -1 : 1);
      return [L.gate[0] + dx, L.gate[1] - r];
    }
    function buddySvg(W, s, pt, r) {
      var name = nameOf(s), now = deps.now(), when = s.at ? T.seen(ago(s.at, now)) : '';
      var tag = s.playing ? name + ' 🎮' : when ? name + ' · ' + when : name;
      var face = has(W.AVATARS, s.avatar) ? W.AVATARS[s.avatar] : W.AVATARS[W.DEFAULT_AVATAR], m = Math.round(r * 0.8);
      return '<g class="f-sis ' + (s.playing ? 'f-on' : 'f-away') + '" data-sister="' + W.esc(s.id) + '" tabindex="0" role="button" aria-label="' +
        W.esc((T.buddy(name) + ' ' + (s.playing ? T.playing : when)).trim()) + '" transform="translate(' + pt[0] + ' ' + pt[1] + ')">' +
        (s.playing ? '<circle class="f-glow" r="' + (r + 10) + '"/>' : '') +
        '<circle class="f-ring" r="' + r + '"/>' +
        W.svgText('', 0, 0, Math.round(r * 1.2), face, r * 2) +
        W.svgText('f-tag', 0, r + Math.round(r * 0.6), Math.round(r * 0.62), tag, r * 5) +
        (s.hasNews ? '<g class="f-mark" aria-hidden="true"><circle cx="' + m + '" cy="' + -m + '" r="' + Math.round(r * 0.55) + '"/>' +
          W.svgText('', m, -m, Math.round(r * 0.6), '💌', r) + '</g>' : '') +
        '</g>';
    }

    function draw(box) {
      var W = win.World, svg = box && box.querySelector('.w-map');
      if (!svg || !W || !W.LAYOUT || !W.LAYOUT[grade] || !W.svgText) return;
      var old = svg.querySelector('.f-sisters');
      if (old) old.parentNode.removeChild(old);
      var list = all();
      if (!list.length) return;
      var L = W.LAYOUT[grade], r = W.radius(L), g = doc.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'f-sisters');
      g.innerHTML = list.map(function (s, i) { return buddySvg(W, s, spotOf(L, r, i), r); }).join('');
      svg.appendChild(g);
      if (svg.getAttribute('data-family')) return;
      svg.setAttribute('data-family', '1');
      function pick(target) {
        var b = target && target.closest ? target.closest('[data-sister]') : null;
        if (b) openCard(box, b.getAttribute('data-sister'));
        return !!b;
      }
      svg.addEventListener('click', function (e) { pick(e.target); });
      svg.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && pick(e.target)) e.preventDefault();
      });
    }

    function closeCard(box, focus) {
      var c = box.querySelector('.f-card');
      if (c) c.parentNode.removeChild(c);
      openId = null;
      lastMsg = '';
      var b = focus ? box.querySelector('[data-sister]') : null;
      if (b && b.focus) b.focus();
    }

    // The card is drawn again after each sync (the map is redrawn), so a "Sent!" line is kept for the same sister.
    function openCard(box, id) {
      var s = all().filter(function (x) { return x.id === id; })[0], keep = openId === id ? lastMsg : '';
      closeCard(box, false);
      if (!s) return;
      openId = id;
      lastMsg = keep;
      var name = nameOf(s), card = el('div', 'f-card');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', T.title(name));
      card.appendChild(el('p', 'f-title', T.title(name)));
      card.appendChild(el('p', 'f-sub', s.playing ? T.playing : s.at ? T.seen(ago(s.at, deps.now())) : ''));
      card.appendChild(el('p', 'f-head', T.newsHead));
      var ul = el('ul', 'f-news');
      if (!s.news.length) ul.appendChild(el('li', '', T.noNews));
      s.news.forEach(function (n) { ul.appendChild(el('li', '', newsLine(T, n, win.Subjects))); });
      card.appendChild(ul);
      card.appendChild(el('p', 'f-head', T.cheerHead));
      var grid = el('div', 'f-cheers');
      CHEERS[voiceOf(relation(s.grade, num(me().grade)))].forEach(function (c) {
        var b = el('button', '', c.text);
        b.type = 'button';
        b.setAttribute('data-cheer', c.id);
        grid.appendChild(b);
      });
      card.appendChild(grid);
      var msg = el('p', 'f-msg', lastMsg);
      msg.setAttribute('aria-live', 'polite');
      card.appendChild(msg);
      card.appendChild(el('p', 'f-count', T.count(s.total, name)));
      var close = el('button', 'f-close', T.close);
      close.type = 'button';
      card.appendChild(close);
      function paint() {
        var ok = canSend(storage, deps.now, null).ok;
        Array.prototype.forEach.call(grid.querySelectorAll('button'), function (b) { b.disabled = !ok; });
        if (!ok) msg.textContent = lastMsg = T.limit;
      }
      grid.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button[data-cheer]') : null;
        if (!b || b.disabled) return;
        if (send(storage, deps.now, deps.random, s.id, b.getAttribute('data-cheer'))) {
          msg.textContent = lastMsg = T.sent;
          deps.sync();
        }
        paint();
      });
      close.addEventListener('click', function () { closeCard(box, true); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(box, true); });
      paint();
      box.appendChild(card);
      if (s.news.length) markNews(storage, s.id, s.news[0].t);
      draw(box);
      var first = grid.querySelector('button:not([disabled])') || close;
      try { first.focus(); } catch (e) {}
    }

    function popCheers() {
      win.clearTimeout(timer);
      var F = win.Fx, list = unseenCheers(me(), readPeek(storage), readSeen(storage));
      if (!list.length || !F || !F.celebrate) return;
      // Another popup is up (quests, the boss): wait for it, so neither is lost.
      if (doc.getElementById('fx-pop') || (F.queued && F.queued())) {
        if (tries++ < 20) timer = win.setTimeout(popCheers, 3000);
        return;
      }
      tries = 0;
      F.celebrate(list.slice(-4).map(function (c) {
        var name = c.name || T[c.rel];
        return { big: false, icon: '💌', title: name + ': ' + c.text, line: '', next: T.next(name) };
      }));
      markCheers(storage, list[list.length - 1].t);
    }

    api.note = function (kind, data) { return deps.paused() ? false : note(storage, deps.now, deps.random, kind, data); };
    api.touch = function () { return doc.visibilityState === 'hidden' ? false : touch(storage, deps.now); };
    api.store = function (list) { store(storage, deps.now, list); };
    api.popCheers = popCheers;

    // Games stop here: only a lobby has the campus map.
    if (!doc.getElementById('campus')) return api;
    var style = doc.createElement('style');
    style.textContent = UI_CSS;
    (doc.head || doc.documentElement).appendChild(style);
    doc.addEventListener('world-drawn', function (e) {
      var box = e.detail && e.detail.box;
      if (!box) return;
      draw(box);
      if (openId) openCard(box, openId);
    });
    doc.addEventListener('cloud-synced', function () { win.setTimeout(popCheers, 1500); });
    win.setTimeout(popCheers, 1500);
    return api;
  }
```

- [ ] **Step 5: Run the unit tests**

Run: `node --test tests/world.test.js tests/family.test.js`
Expected: PASS. The game-page test in `family.test.js` still passes, because its fake document has no `#campus`, so `mountUi` returns before touching the DOM.

- [ ] **Step 6: Commit (the user runs it)**

```bash
git add web/engine/world.js web/engine/family.js tests/world.test.js
```

```bash
git commit -m "Draw her sister on the campus map: a buddy by the gate that glows while she is playing, a 💌 for new big moments, a card with her last 5 moments and 6 cheer buttons, and a popup for cheers she sent" -- web/engine/world.js web/engine/family.js tests/world.test.js
```

---

### Task 7: cloud.js: touch, peek, clear

**Files:**
- Modify: `web/engine/cloud.js`

- [ ] **Step 1: Implement**

In `web/engine/cloud.js`:

1. After `function ago(ms) { ... }`, add:

```js
  // After a good round: read each other learner's profile, buddy, family news and cheer total for family.js.
  // A failed peek never fails the round; the card keeps the last one.
  function peekFamily(remote) {
    var F = root.Family;
    if (!F || !F.store || !remote.peek) return Promise.resolve();
    return remote.learners().then(function (list) {
      return Promise.all(list.filter(function (l) { return l.id !== me.id; }).map(function (l) {
        return remote.peek(l.id, F.PEEK_STATE, F.PEEK_COUNTERS).then(function (r) { r.id = l.id; return r; });
      }));
    }).then(F.store, function () {});
  }
```

2. In `runSync`, replace
`var run = round.then(function (wait) { return wait === 'wait' ? null : core.sync(); });`
with:

```js
    var run = round.then(function (wait) {
      if (wait === 'wait') return null;
      if (root.Family && root.Family.touch) root.Family.touch();
      return core.sync().then(function (r) { return peekFamily(remote).then(function () { return r; }); });
    });
```

3. In `start(u)`, in the `else` branch after `markSignedIn(false);` add:

```js
      if (root.Family && root.Family.store) root.Family.store([]);
```

- [ ] **Step 2: Run all unit tests**

Run: `node --test`
Expected: PASS. cloud.js has no unit tests; Task 8 adds static checks for these three lines.

- [ ] **Step 3: Commit (the user runs it)**

```bash
git add web/engine/cloud.js
```

```bash
git commit -m "Peek her sister after each sync: mark this child as active before the round, read the other learners' family data after it, and forget it on sign-out" -- web/engine/cloud.js
```

---

### Task 8: wire the pages

**Files:**
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html`
- Modify: all 17 `web/subjects/grade-N/*/index.html`
- Create: `tests/family-wiring.test.js`
- Modify: `tests/world-wiring.test.js`

- [ ] **Step 1: Write the failing wiring test**

Create `tests/family-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, ENGINE_FILES, appFile, lobbyFile, engineFile, web } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const GLOBALS_END = "'parent-panel': 'ParentPanel', world: 'World', family: 'Family' };";

for (const app of APPS) {
  test(app.id + ' writes family news', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const tag = '<script src="../../../engine/family.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads family.js once');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/boss.js"'), 'after boss.js');
    assert.equal(count(html, GLOBALS_END), 1, 'the missing-file bar knows family.js');
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby shows her sister', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const subjects = '<script src="../engine/subjects.js"></script>';
    const tag = '<script src="../engine/family.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, subjects), 1, 'subject names for her sister\'s news');
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(subjects) > html.indexOf('<script src="../engine/world.js"'), 'subjects.js after world.js');
    assert.ok(html.indexOf(tag) > html.indexOf(subjects), 'family.js after subjects.js');
    assert.ok(html.indexOf(tag) < html.indexOf('<script src="../engine/cloud.js"'), 'before cloud.js');
    assert.equal(count(html, GLOBALS_END), 1);
  });
}

test('the engines tell family.js their big moments', () => {
  const hook = 'news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }';
  for (const f of ['mastery.js', 'quests.js', 'boss.js']) assert.equal(count(fs.readFileSync(engineFile(f), 'utf8'), hook), 1, f);
});

test('cloud.js touches before a round, peeks the sisters after it, and clears the peek on sign-out', () => {
  const js = fs.readFileSync(engineFile('cloud.js'), 'utf8');
  assert.equal(count(js, 'if (root.Family && root.Family.touch) root.Family.touch();'), 1);
  assert.equal(count(js, 'return core.sync().then(function (r) { return peekFamily(remote).then(function () { return r; }); });'), 1);
  assert.equal(count(js, 'if (root.Family && root.Family.store) root.Family.store([]);'), 1);
  assert.equal(count(js, 'function peekFamily(remote) {'), 1);
  assert.equal(count(fs.readFileSync(engineFile('firebase-remote.js'), 'utf8'), 'peek: function (id, keys, counters) {'), 1);
});

test('world.js tells family.js when the map is drawn', () => {
  assert.equal(count(fs.readFileSync(engineFile('world.js'), 'utf8'), "doc.dispatchEvent(new win.CustomEvent('world-drawn', { detail: { box: box } }));"), 1);
});

test('family.js is cached for offline use and copied to the e2e site', () => {
  assert.ok(fs.readFileSync(web('sw.js'), 'utf8').includes("'engine/family.js',"));
  assert.ok(ENGINE_FILES.includes('family.js'));
});
```

In `tests/world-wiring.test.js`, change the GLOBALS assertion to:

```js
    assert.ok(html.includes("'parent-panel': 'ParentPanel', world: 'World', family: 'Family' };"), 'the missing-file bar knows world.js');
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/family-wiring.test.js tests/world-wiring.test.js`
Expected: FAIL on every page test (no family.js tag, old GLOBALS).

- [ ] **Step 3: Wire the pages with a one-off script**

Save as `<scratchpad>/wire-family.js` (the session's scratchpad directory, not the repo), then run `node <scratchpad>/wire-family.js` from the repo root:

```js
const fs = require('node:fs');
const path = require('node:path');
const { APPS, LOBBIES, appFile, lobbyFile } = require(path.join(process.cwd(), 'tests', 'paths.js'));

const OLD = "'parent-panel': 'ParentPanel', world: 'World' };";
const NEW = "'parent-panel': 'ParentPanel', world: 'World', family: 'Family' };";

function edit(file, after, insert) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.split(after).length !== 2) throw new Error(file + ': expected one ' + after);
  if (html.split(OLD).length !== 2) throw new Error(file + ': expected one GLOBALS ending');
  html = html.replace(after, after + '\n' + insert).replace(OLD, NEW);
  fs.writeFileSync(file, html);
  console.log('wired ' + path.relative(process.cwd(), file));
}

for (const app of APPS) {
  const g = 'grade' + app.grade;
  edit(appFile(app.id), '<script src="../../../engine/boss.js" data-grade="' + g + '"></script>',
    '<script src="../../../engine/family.js" data-grade="' + g + '"></script>');
}
for (const grade of Object.keys(LOBBIES)) {
  const g = 'grade' + grade;
  edit(lobbyFile(grade), '<script src="../engine/world.js" data-grade="' + g + '"></script>',
    '<script src="../engine/subjects.js"></script>\n<script src="../engine/family.js" data-grade="' + g + '"></script>');
}
```

Expected: 19 `wired …` lines. Each file keeps its own line endings, because the script only inserts after an existing tag. If a page uses CRLF, check with `git diff --stat` that only 2 lines changed per page.

- [ ] **Step 4: Run all unit tests**

Run: `node --test`
Expected: PASS, including `pages.test.js` (the file-check snippet is still identical on every page) and `world-wiring.test.js` (exact-case script paths).

- [ ] **Step 5: Run the existing e2e suites that load these pages**

Run: `node tests/e2e/lobby-e2e.js`, then `node tests/e2e/lobby-e2e.js 5`, then `node tests/e2e/file-check-e2e.js`, then `node tests/e2e/apps-e2e.js`, then `node tests/e2e/apps-e2e.js 5`
Expected: `Lobby passed` (both), `File check passed`, and every game passes. family.js is now in `ENGINE_FILES`, so every staged site has it.

- [ ] **Step 6: Commit (the user runs it)**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html web/subjects tests/family-wiring.test.js tests/world-wiring.test.js
```

```bash
git commit -m "Load family.js in every game and both lobbies (lobbies also load subjects.js for subject names), and add it to the missing-file check" -- web/lobby/grade-5.html web/lobby/grade-2.html web/subjects tests/family-wiring.test.js tests/world-wiring.test.js
```

---

### Task 9: sisters e2e

**Files:**
- Create: `tests/e2e/driver-sisters.page.js`
- Create: `tests/e2e/sisters-e2e.js`

- [ ] **Step 1: Write the driver**

Create `tests/e2e/driver-sisters.page.js`:

```js
(function () {
  var r = {};
  function out() {
    r.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(r);
    document.body.appendChild(pre);
  }
  var campus = document.getElementById('campus'), grid = document.querySelector('.grid'), toggle = document.getElementById('campus-toggle');
  var me = Learner.current(), now = Date.now();
  function seed(peek) { __store.setItem('family_peek_v1', JSON.stringify(peek)); World.mount(campus, grid, toggle); }
  function family() { return JSON.parse(__store.getItem('family_v1') || 'null'); }
  function sis() { return campus.querySelector('[data-sister="mia"]'); }
  function tap(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }

  seed({});
  r.noPeekNoBuddy = !campus.querySelector('.f-sis');

  var peek = { mia: { profile: { name: '', emoji: '', grade: 2 }, world: { avatar: 'rabbit' }, total: 3, readAt: now,
    family: { v: 1, at: now - 60000, news: [{ id: 'n1', t: now - 120000, kind: 'medal', app: 'block-bot', tier: 1, title: 'Skip Counting' }],
      sent: [{ id: 's1', t: now - 30000, to: me.id, cheer: 'great' }] } } };
  seed(peek);
  r.buddy = !!sis();
  r.playing = sis().getAttribute('class');
  r.tag = sis().querySelector('.f-tag').textContent;
  r.mark = !!sis().querySelector('.f-mark');

  tap(sis());
  var card = campus.querySelector('.f-card');
  r.cardOpen = !!card;
  r.news = [].map.call(card.querySelectorAll('.f-news li'), function (li) { return li.textContent; });
  r.count = card.querySelector('.f-count').textContent;
  r.buttons = [].map.call(card.querySelectorAll('[data-cheer]'), function (b) { return b.textContent; });
  r.markAfterOpen = !!sis().querySelector('.f-mark');
  card.querySelector('[data-cheer="great"]').click();
  r.msg = card.querySelector('.f-msg').textContent;
  r.sent = family().sent.map(function (s) { return [s.to, s.cheer]; });
  r.total = __store.getItem('cheers_sent_total');
  card.querySelector('[data-cheer="great"]').click();
  r.sentAfterAgain = family().sent.length;
  card.querySelector('.f-close').click();
  r.cardClosed = !campus.querySelector('.f-card');

  Family.popCheers();
  r.pop = ((Fx.queued && Fx.queued()) || []).map(function (e) { return e.title + ' | ' + e.next; });
  r.seenCheers = JSON.parse(__store.getItem('family_seen_v1')).cheers === now - 30000;
  r.unseenAfter = Family.unseenCheers(me, Family.readPeek(__store), Family.readSeen(__store)).length;

  var fam = family();
  for (var i = 0; i < 9; i++) fam.sent.push({ id: 'x' + i, t: now - 1 - i, to: 'mia', cheer: 'go' });
  __store.setItem('family_v1', JSON.stringify(fam));
  tap(sis());
  card = campus.querySelector('.f-card');
  r.limitDisabled = [].every.call(card.querySelectorAll('[data-cheer]'), function (b) { return b.disabled; });
  r.limitMsg = card.querySelector('.f-msg').textContent;
  out();
})();
```

- [ ] **Step 2: Write the runner**

Create `tests/e2e/sisters-e2e.js`:

```js
// Her sister by the gate on the Grade 5 lobby: the buddy, the card, cheers and the cheer popup.
// The cloud never runs on file://, so the sister's peek is seeded the way cloud.js would save it.
// Run: node tests/e2e/sisters-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { LOBBIES, lobbyFile, ENGINE_FILES } = require('../paths.js');

const work = makeWorkDir('sisters-e2e');
const driver = 'var __store = Learner.storage;\n' + fs.readFileSync(path.join(__dirname, 'driver-sisters.page.js'), 'utf8');
const file = stage(path.join(work, 'site'), LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), driver), ENGINE_FILES);

try {
  const r = readOutput(dumpDom(path.join(work, 'profile'), file, ''));
  assert.deepEqual(r.errors, [], 'page errors');
  assert.equal(r.noPeekNoBuddy, true, 'no sister data: no buddy');
  assert.equal(r.buddy, true, 'her buddy stands by the gate');
  assert.match(r.playing, /f-on/, 'she was here a minute ago: playing now');
  assert.equal(r.tag, 'Bunso 🎮');
  assert.equal(r.mark, true, '💌 for news she has not seen');
  assert.equal(r.cardOpen, true);
  assert.deepEqual(r.news, ['🥉 Bronze in Math: Skip Counting']);
  assert.equal(r.count, '💖 3 cheers from Bunso');
  assert.deepEqual(r.buttons, ["Galing mo, Bunso! · You're great! 💖", 'So proud of you! 🌟', 'You can do it! 💪', "Ang talino mo! · You're so smart! 🧠", 'Love you, Bunso! 🤗', 'Keep going! 🚀']);
  assert.equal(r.markAfterOpen, false, 'opening the card marks the news seen');
  assert.equal(r.msg, 'Sent! 💌');
  assert.deepEqual(r.sent, [['mia', 'great']]);
  assert.equal(r.total, '1');
  assert.equal(r.sentAfterAgain, 1, 'the same cheer twice in a minute is not sent');
  assert.equal(r.cardClosed, true);
  assert.deepEqual(r.pop, ["Bunso: Galing mo, Ate! · You're great! 🌟 | Tap Bunso's buddy to cheer back!"]);
  assert.equal(r.seenCheers, true);
  assert.equal(r.unseenAfter, 0, 'a cheer pops once');
  assert.equal(r.limitDisabled, true, '10 a day');
  assert.equal(r.limitMsg, 'More cheers tomorrow!');
  console.log('Sisters passed');
} catch (err) {
  console.log('FAIL sisters: ' + err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
```

- [ ] **Step 3: Run it**

Run: `node tests/e2e/sisters-e2e.js`
Expected: `Sisters passed`. If `r.pop` is empty because the lobby queued its own popup at load (quests or boss), check what `Fx.queued()` held. Fresh profiles have no quest history, so nothing should be queued. Fix the cause; don't loosen the assertion.

- [ ] **Step 4: Commit (the user runs it)**

```bash
git add tests/e2e/driver-sisters.page.js tests/e2e/sisters-e2e.js
```

```bash
git commit -m "Add the sisters e2e: on the Grade 5 lobby with a seeded sister, check the buddy, 💌, the card's news and count, sending a cheer, the once-a-minute and 10-a-day guards, and the cheer popup showing once" -- tests/e2e/driver-sisters.page.js tests/e2e/sisters-e2e.js
```

---

### Task 10: docs

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-04-family-presence-design.md` (status line)

- [ ] **Step 1: README**

- Under the feature bullets, after the **Campus map** bullet, add:

```markdown
- **Sisters (family presence):** with the cloud on, each lobby's map shows her sister's buddy by the gate (glowing while she is playing, 💌 when she has new big moments). Tapping it shows her last 5 big moments (medals, boss stages, all 3 quests, streaks) and 6 one-tap cheers; a cheer pops up on her sister's tablet after the next sync. Never scores or coins, never free text; cheers earn nothing; 10 a day.
```

- In the engine file list, after the `world.js` line, add (same alignment):

```
    family.js                  her sister on the map: big-moment news, one-tap cheers, the cheer popup
```

- In the e2e command list, after the `lobby-e2e.js` line, add:

```
node tests/e2e/sisters-e2e.js        # her sister's buddy, card, cheers and the cheer popup
```

- [ ] **Step 2: Spec status**

In the spec, change `Status: spec approved in brainstorming 2026-10-04, not built.` to `Status: built 2026-10-04 (plan docs/superpowers/plans/2026-10-04-family-presence.md).`

- [ ] **Step 3: Final check**

Run: `node --test`, then `node tests/e2e/sisters-e2e.js`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/lobby-e2e.js 5`, `node tests/e2e/file-check-e2e.js`
Expected: all pass.

- [ ] **Step 4: Commit (the user runs it)**

```bash
git add README.md docs/superpowers/specs/2026-10-04-family-presence-design.md docs/superpowers/plans/2026-10-04-family-presence.md
```

```bash
git commit -m "Document family presence in the README and mark the spec built" -- README.md docs/superpowers/specs/2026-10-04-family-presence-design.md docs/superpowers/plans/2026-10-04-family-presence.md
```

---

## Deploy note (for the user, after pushing)

Both tablets must be signed in to the family cloud (Parent → Cloud backup). Open each lobby once while online. Her sister's buddy appears after the next sync, as long as the other tablet has synced at least once since this update. Nothing needs to change in the Firestore rules: both learners are already under the same `families/{uid}`.
