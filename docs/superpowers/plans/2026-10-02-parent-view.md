# Parent View on the Phone (Phase 5c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone page (`web/parent/index.html`) where a parent signs in once, types the PIN on every open, picks a child, sees her progress, adds real test scores, and approves shop requests that the child sent from a tablet.

**Architecture:** The phone is one more synced device. It pulls a child's data from Firestore into an in-memory learner space, uses the same `wallet.js`, `study-history.js` and `sync-core.js` the tablets use, and syncs changes back. The Parent panel script, today copied into both lobbies, moves to `engine/parent-panel.js` and is shared by both lobbies and the phone page. Shop requests are a new synced key (`shop_requests_v1`) with a merge rule in `sync-core.js`. The phone only answers; the tablet does the buying.

**Tech Stack:** Plain ES5 browser scripts (no build step), Firebase JS SDK 12.4.0 loaded from gstatic with dynamic `import()`, Firestore, `node --test` unit tests, headless-Chrome e2e scripts in `tests/e2e/`.

**Spec:** `docs/superpowers/specs/2026-10-02-parent-view-design.md`

**House rules (from the user):**
- Never run `git commit`. Every commit step below is a command for the user to run. Show it to them; don't run it.
- No `Co-Authored-By:` lines.
- Comments only for non-obvious code.
- Engine files marked "Keep this file ASCII-only" must stay ASCII. Emoji go in HTML pages or texts that are already non-ASCII (`cloud.js`, the lobby pages).
- After adding, renaming or removing any file under `web/`, run `node tools/update-precache.js`.

**Run all unit tests:** `node --test` from the repo root (currently 385 pass).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `web/engine/storage.js` | modify | add `memory()` and `StudyStore.memorySpace(id)` |
| `web/engine/wallet.js` | modify | browser global also carries `Wallet.create` |
| `web/engine/study-history.js` | modify | browser global also carries `StudyHistory.create` |
| `web/engine/shop-requests.js` | create | ask / answer / cancel / settle / waiting / list on one space |
| `web/engine/sync-core.js` | modify | `requests` kind + `MERGE.requests` |
| `web/engine/subjects.js` | create | each grade's subjects (app, title, pointsKey) for the phone |
| `web/engine/firebase-remote.js` | create | SDK loading, sign-in, the Firestore remote (+ `watch`); split out of `cloud.js` |
| `web/engine/cloud.js` | modify | uses `FirebaseRemote`; adds `Cloud.signedIn`, `Cloud.watch`, the `cloud-synced` event, and re-runs a sync asked for while busy |
| `web/engine/parent-panel.js` | create | the Parent panel, moved out of both lobbies; `mount`, `pinGate`, `subjectsFromCards` |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | modify | load the new engine files, call `ParentPanel.mount`, shop phone button + texts |
| `web/subjects/**/index.html` (15 games) | modify | the shared file-check snippet gains the new globals |
| `web/parent/index.html`, `phone.js`, `parent.css`, `parent.webmanifest` | create | the phone page |
| `tools/update-precache.js` | modify | `parent/` group before the redirect pages |
| `tests/paths.js` | modify | new engine files, the parent page |
| `tests/shop-requests.test.js`, `tests/subjects.test.js`, `tests/browser-globals.test.js` | create | unit tests |
| `tests/sync.test.js`, `tests/copies.test.js`, `tests/pwa.test.js` | modify | tests |

---

### Task 1: In-memory space in storage.js

**Files:**
- Modify: `web/engine/storage.js`
- Test: `tests/storage.test.js`

- [ ] **Step 1: Write the failing test.** Append to `tests/storage.test.js`:

```js
test('memory() is an empty store shaped like localStorage, for the parent page', () => {
  const { memory } = require(engineFile('storage.js'));
  const m = memory();
  assert.equal(m.length, 0);
  const s = space(m, 'kid', now);
  s.setItem('wallet_v1', '{}');
  assert.equal(m.getItem('learner/kid/wallet_v1'), '{}');
  assert.deepEqual(s.keys().sort(), ['sync_outbox_v1', 'wallet_v1']);
  assert.deepEqual(spaces(m), ['kid']);
  m.removeItem('learner/kid/wallet_v1');
  assert.equal(s.getItem('wallet_v1'), null);
  assert.equal(memory().length, 0, 'each memory() is a new, separate store');
});
```

- [ ] **Step 2: Run it and check that it fails.**
Run: `node --test tests/storage.test.js`
Expected: FAIL, `memory is not a function`.

- [ ] **Step 3: Implement.** In `web/engine/storage.js`, add this function after `spaces(raw)`:

```js
  // A store shaped like localStorage that lives only in memory: the parent page pulls each child into one.
  function memory() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
      key: function (i) { var k = Object.keys(data); return i < k.length ? k[i] : null; },
      get length() { return Object.keys(data).length; }
    };
  }
```

Change the export line to:

```js
  var exported = { space: space, spaces: spaces, memory: memory, PREFIX: PREFIX, OUTBOX: OUTBOX };
```

Change the browser global to:

```js
  root.StudyStore = {
    space: function (id) { return space(root.localStorage, id, now); },
    spaces: function () { return spaces(root.localStorage); },
    memorySpace: function (id) { return space(memory(), id, now); },
    raw: root.localStorage
  };
```

- [ ] **Step 4: Run the tests and check that they pass.**
Run: `node --test tests/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (the user runs this).**

```bash
git add web/engine/storage.js tests/storage.test.js && git commit -m "Add an in-memory learner space for the parent page"
```

---

### Task 2: Factories on the browser globals

The phone page builds a wallet and a history on each child's in-memory space. In the browser, `Wallet` and `StudyHistory` are ready-made instances today, and on a page without `data-grade` the wallet throws, so `Wallet` is not even defined.

**Files:**
- Modify: `web/engine/wallet.js:412-416`, `web/engine/study-history.js:463-470`
- Create: `tests/browser-globals.test.js`

- [ ] **Step 1: Write the failing test.** Create `tests/browser-globals.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');

// Runs engine files as a browser would (no `module`), on a page with no data-grade, like the parent page.
function browser(...files) {
  const data = {};
  const win = {
    localStorage: {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: (k) => { delete data[k]; },
      key: (i) => Object.keys(data)[i] ?? null,
      get length() { return Object.keys(data).length; },
    },
  };
  win.window = win;
  vm.createContext(win);
  for (const f of files) vm.runInContext(fs.readFileSync(engineFile(f), 'utf8'), win);
  return win;
}

test('the parent page can build a wallet and a history on a child\'s in-memory space', () => {
  const win = browser('storage.js', 'study-history.js', 'wallet.js');
  const s = win.StudyStore.memorySpace('kid');
  const w = win.Wallet.create(s, () => 1000, 'grade5');
  assert.ok(w.addBonus(40));
  assert.equal(JSON.parse(s.getItem('wallet_v1')).bonus, 40);
  const h = win.StudyHistory.create(s, () => 1000, 'grade5');
  h.testScore('rise-shine', 'GMRC', 'ST1', 19, 20, 40);
  assert.equal(h.findTest('rise-shine', 'st1').score, 19);
});
```

- [ ] **Step 2: Run it and check that it fails.**
Run: `node --test tests/browser-globals.test.js`
Expected: FAIL, `Cannot read properties of undefined (reading 'create')`.

- [ ] **Step 3: Implement.** In `web/engine/wallet.js`, replace the browser block at the end with:

```js
  root.Wallet = { create: create };
  try {
    var script = root.document && root.document.currentScript;
    root.Wallet = create(root.Learner ? root.Learner.storage : root.localStorage, Date.now, script ? script.getAttribute('data-grade') : null);
    root.Wallet.create = create;
    mountUi(root, root.Wallet);
  } catch (e) {}
})(this);
```

In `web/engine/study-history.js`, replace the browser block at the end with:

```js
  root.StudyHistory = { create: create };
  try {
    var script = root.document && root.document.currentScript;
    var grade = script ? script.getAttribute('data-grade') : null;
    var store = root.Learner ? root.Learner.storage : root.localStorage;
    var sh = create(store, Date.now, grade);
    store.getItem(KEY);
    sh.create = create;
    root.StudyHistory = sh;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Run all tests.**
Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit (the user runs this).**

```bash
git add web/engine/wallet.js web/engine/study-history.js tests/browser-globals.test.js && git commit -m "Let pages build a wallet and history on any learner space"
```

---

### Task 3: shop-requests.js

**Files:**
- Create: `web/engine/shop-requests.js`
- Create: `tests/shop-requests.test.js`
- Modify: `tests/paths.js` (`ENGINE_FILES`)

- [ ] **Step 1: Write the failing tests.** Create `tests/shop-requests.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, KEY } = require(engineFile('shop-requests.js'));

const DAY = 86400000;
const ITEM = { id: 'ml', name: 'Mobile Legends', emoji: '🎮', coins: 40 };
const MOVIE = { id: 'movie', name: 'Movie night', emoji: '🎬', coins: 200 };

function setup() {
  const data = {};
  const store = { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  const clock = { t: new Date(2026, 9, 2, 15, 0).getTime() };
  return { store, clock, R: create(store, () => clock.t++) };
}

test('ask saves a waiting request with the item, its name and its price', () => {
  const { R } = setup();
  const id = R.ask(ITEM);
  assert.ok(id);
  const r = R.get(id);
  assert.equal(r.status, 'waiting');
  assert.equal(r.item, 'ml');
  assert.equal(r.name, 'Mobile Legends');
  assert.equal(r.coins, 40);
  assert.deepEqual(R.waiting().map((x) => x.id), [id]);
});

test('a request is answered once, only while it waits', () => {
  const { R } = setup();
  const id = R.ask(ITEM);
  assert.equal(R.answer(id, true), true);
  assert.equal(R.answer(id, false), false);
  assert.equal(R.get(id).status, 'approved');
  assert.deepEqual(R.waiting(), []);
  const no = R.ask(ITEM);
  assert.equal(R.answer(no, false), true);
  assert.equal(R.get(no).status, 'declined');
});

test('settle buys only approved requests: done when bought, short when not', () => {
  const { R } = setup();
  const a = R.ask(ITEM), b = R.ask(MOVIE), c = R.ask(ITEM), d = R.ask(ITEM);
  R.answer(a, true); R.answer(b, true); R.answer(d, false);
  const asked = [];
  const out = R.settle((r) => { asked.push(r.id); return r.item === 'ml' ? 'done' : 'short'; });
  assert.deepEqual(asked.sort(), [a, b].sort());
  assert.deepEqual(out.map((x) => x.status).sort(), ['done', 'short']);
  assert.equal(R.get(a).status, 'done');
  assert.equal(R.get(b).status, 'short');
  assert.equal(R.get(c).status, 'waiting');
  assert.equal(R.get(d).status, 'declined');
  assert.deepEqual(R.settle(() => 'done'), [], 'nothing is bought twice');
});

test('cancel works while waiting or approved, not after', () => {
  const { R } = setup();
  const a = R.ask(ITEM), b = R.ask(ITEM), c = R.ask(ITEM);
  R.answer(b, true);
  R.answer(c, true);
  R.settle(() => 'done');
  assert.equal(R.cancel(a), true);
  assert.equal(R.get(a).status, 'cancelled');
  assert.equal(R.cancel(c), false);
  assert.equal(R.get(c).status, 'done');
  const e = R.ask(ITEM);
  R.answer(e, true);
  assert.equal(R.cancel(e), true);
});

test("yesterday's waiting request is expired and can't be approved", () => {
  const { R, clock } = setup();
  const id = R.ask(ITEM);
  clock.t += DAY;
  assert.equal(R.get(id).status, 'expired');
  assert.deepEqual(R.waiting(), []);
  assert.equal(R.answer(id, true), false);
});

test('requests older than 7 days are dropped when anything is saved', () => {
  const { R, clock } = setup();
  const old = R.ask(ITEM);
  clock.t += 8 * DAY;
  const fresh = R.ask(ITEM);
  assert.equal(R.get(old), null);
  assert.ok(R.get(fresh));
});

test('list shows every request, newest first', () => {
  const { R } = setup();
  const a = R.ask(ITEM), b = R.ask(MOVIE);
  assert.deepEqual(R.list().map((r) => r.id), [b, a]);
});

test('a broken saved value starts empty', () => {
  const { store, R } = setup();
  store.data[KEY] = '{oops';
  assert.deepEqual(R.list(), []);
  assert.ok(R.ask(ITEM));
  assert.equal(R.list().length, 1);
});
```

- [ ] **Step 2: Run them and check that they fail.**
Run: `node --test tests/shop-requests.test.js`
Expected: FAIL, `Cannot find module ... shop-requests.js`.

- [ ] **Step 3: Implement.** Create `web/engine/shop-requests.js`:

```js
/* Shop requests: a child asks on the tablet, a parent answers on the phone, and the tablet does the buying.
   Saved as shop_requests_v1 in the learner's space, so cloud sync carries it (the merge rule is in sync-core.js).
   Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var KEY = 'shop_requests_v1';
  var KEEP_DAYS = 7;
  var DAY_MS = 86400000;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function create(storage, now) {
    function read() {
      try {
        var s = JSON.parse(storage.getItem(KEY));
        if (s && s.list && typeof s.list === 'object' && !Array.isArray(s.list)) return s;
      } catch (e) {}
      return { v: 1, list: {} };
    }
    function write(s) {
      var cutoff = now() - KEEP_DAYS * DAY_MS;
      Object.keys(s.list).forEach(function (id) { if (!(s.list[id].t >= cutoff)) delete s.list[id]; });
      try { storage.setItem(KEY, JSON.stringify({ v: 1, list: s.list })); return true; } catch (e) { return false; }
    }
    // A request nobody answered on the day it was asked is too old to approve.
    function statusOf(r) { return r.status === 'waiting' && dateKey(r.t) !== dateKey(now()) ? 'expired' : r.status; }
    function view(id, r) { return { id: id, item: r.item, name: r.name, emoji: r.emoji, coins: r.coins, t: r.t, status: statusOf(r) }; }
    function move(id, to, from) {
      var s = read(), r = s.list[id];
      if (!r || from.indexOf(statusOf(r)) < 0) return false;
      r.status = to;
      r.at = now();
      return write(s);
    }
    function all() {
      var s = read();
      return Object.keys(s.list).map(function (id) { return view(id, s.list[id]); }).sort(function (a, b) { return b.t - a.t; });
    }

    return {
      ask: function (item) {
        var s = read(), t = now();
        var id = 'r' + t.toString(36) + Math.floor(Math.random() * 1296).toString(36);
        s.list[id] = { item: item.id, name: item.name, emoji: item.emoji || '', coins: item.coins, t: t, status: 'waiting', at: t };
        return write(s) ? id : null;
      },
      get: function (id) {
        var r = read().list[id];
        return r ? view(id, r) : null;
      },
      list: all,
      waiting: function () { return all().filter(function (r) { return r.status === 'waiting'; }).reverse(); },
      answer: function (id, yes) { return move(id, yes ? 'approved' : 'declined', ['waiting']); },
      cancel: function (id) { return move(id, 'cancelled', ['waiting', 'approved']); },
      // buy(request) returns 'done' when it bought the item; anything else means there weren't enough coins.
      settle: function (buy) {
        var s = read(), out = [];
        Object.keys(s.list).forEach(function (id) {
          var r = s.list[id];
          if (r.status !== 'approved') return;
          r.status = buy(view(id, r)) === 'done' ? 'done' : 'short';
          r.at = now();
          out.push({ id: id, status: r.status });
        });
        if (out.length) write(s);
        return out;
      }
    };
  }

  var exported = { create: create, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.ShopRequests = exported;
})(this);
```

- [ ] **Step 4: Add the file to `ENGINE_FILES` in `tests/paths.js`:**

```js
const ENGINE_FILES = ['storage.js', 'learner.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'cloud.js', 'shop-requests.js'];
```

- [ ] **Step 5: Run all tests.**
Run: `node --test`
Expected: all pass, except possibly `pwa.test.js` reporting `engine/shop-requests.js is missing from PRECACHE`. If so, run `node tools/update-precache.js` and run `node --test` again until everything passes.

- [ ] **Step 6: Commit (the user runs this).**

```bash
git add web/engine/shop-requests.js web/sw.js tests/shop-requests.test.js tests/paths.js && git commit -m "Add shop requests a parent can answer from another device"
```

---

### Task 4: The requests merge rule in sync-core.js

**Files:**
- Modify: `web/engine/sync-core.js`
- Test: `tests/sync.test.js`

- [ ] **Step 1: Write the failing tests.** Append to `tests/sync.test.js`:

```js
const DAY = 86400000;
const req = (status, at, t = 100) => ({ v: 1, list: { r1: { item: 'ml', name: 'Mobile Legends', emoji: '', coins: 40, t, status, at } } });

test('shop_requests_v1 syncs with its own merge rule', () => {
  assert.equal(kindOf('shop_requests_v1'), 'requests');
});

test('shop requests: the copy further along wins, in either order', () => {
  const cases = [
    ['waiting', 'approved', 'approved'],
    ['approved', 'done', 'done'],
    ['approved', 'cancelled', 'cancelled'],
    ['waiting', 'declined', 'declined'],
    ['approved', 'short', 'short'],
  ];
  for (const [a, b, want] of cases) {
    assert.equal(MERGE.requests(req(a, 1), req(b, 2)).list.r1.status, want, a + ' + ' + b);
    assert.equal(MERGE.requests(req(b, 2), req(a, 1)).list.r1.status, want, b + ' + ' + a);
  }
});

test('shop requests: at the same step, the later answer wins', () => {
  assert.equal(MERGE.requests(req('approved', 5), req('declined', 9)).list.r1.status, 'declined');
  assert.equal(MERGE.requests(req('declined', 9), req('approved', 5)).list.r1.status, 'declined');
});

test('shop requests: both devices\' requests are kept, and ones a week older than the newest are dropped', () => {
  const a = { v: 1, list: { old: { item: 'ml', coins: 40, t: 0, status: 'done', at: 1 } } };
  const b = { v: 1, list: { r2: { item: 'ml', coins: 40, t: 3 * DAY, status: 'waiting', at: 3 * DAY } } };
  assert.deepEqual(Object.keys(MERGE.requests(a, b).list).sort(), ['old', 'r2']);
  b.list.r3 = { item: 'ml', coins: 40, t: 8 * DAY, status: 'waiting', at: 8 * DAY };
  assert.deepEqual(Object.keys(MERGE.requests(a, b).list).sort(), ['r2', 'r3']);
  assert.deepEqual(MERGE.requests(null, b), MERGE.requests(b, null));
});
```

- [ ] **Step 2: Run them and check that they fail.**
Run: `node --test tests/sync.test.js`
Expected: FAIL (`kindOf` returns `'replace'`; `MERGE.requests is not a function`).

- [ ] **Step 3: Implement.** In `web/engine/sync-core.js`:

Add near the other constants at the top:

```js
  var REQUEST_STEP = { waiting: 0, approved: 1, declined: 1, done: 2, cancelled: 2, short: 2 };
  var REQUESTS_KEEP_MS = 7 * 86400000;
```

In `kindOf`, after the `coin_guide_seen_v1` line:

```js
    if (key === 'shop_requests_v1') return 'requests';
```

In `MERGE`, after `profile`:

```js
    // Shop requests: per request, the copy further along wins (waiting, then an answer, then the tablet's result),
    // then the later change. Requests asked a week before the newest one are dropped, the same on every device.
    requests: function (a, b) {
      var la = (a && a.list) || {}, lb = (b && b.list) || {}, list = {}, newest = 0;
      function pick(x, y) {
        if (!x || !y) return x || y;
        var sx = REQUEST_STEP[x.status] || 0, sy = REQUEST_STEP[y.status] || 0;
        if (sx !== sy) return sx > sy ? x : y;
        if ((Number(x.at) || 0) !== (Number(y.at) || 0)) return (Number(x.at) || 0) > (Number(y.at) || 0) ? x : y;
        return String(x.status) >= String(y.status) ? x : y;
      }
      Object.keys(la).concat(Object.keys(lb)).forEach(function (id) {
        list[id] = pick(la[id], lb[id]);
        newest = Math.max(newest, Number(list[id].t) || 0);
      });
      Object.keys(list).forEach(function (id) { if ((Number(list[id].t) || 0) < newest - REQUESTS_KEEP_MS) delete list[id]; });
      return { v: 1, list: list };
    },
```

In `readLocal`, change `if (kind === 'recall' || kind === 'profile') return json(space.getItem(key), null);` to:

```js
      if (kind === 'recall' || kind === 'profile' || kind === 'requests') return json(space.getItem(key), null);
```

In `writeLocal`, change `} else if (kind === 'recall' || kind === 'profile') {` to:

```js
      } else if (kind === 'recall' || kind === 'profile' || kind === 'requests') {
```

- [ ] **Step 4: Run the tests and check that they pass.**
Run: `node --test tests/sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (the user runs this).**

```bash
git add web/engine/sync-core.js tests/sync.test.js && git commit -m "Sync shop requests between devices"
```

---

### Task 5: Phone-as-device round trips

These tests prove the design works end to end on the fake cloud before any page is built.

**Files:**
- Test: `tests/sync.test.js`

- [ ] **Step 1: Write the tests.** Append to `tests/sync.test.js`:

```js
const ShopRequests = require(engineFile('shop-requests.js'));
const WalletLib = require(engineFile('wallet.js'));
const HistoryLib = require(engineFile('study-history.js'));

test('the parent phone is one more device: a test score added there reaches the tablet', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const phone = device(cloud);
  await phone.sync();
  assert.equal(wallet(phone).bonus, 50);
  assert.equal(pts(phone), 420);

  assert.ok(WalletLib.create(phone.s, now, 'grade5').addBonus(40));
  HistoryLib.create(phone.s, now, 'grade5').testScore('rise-shine', 'GMRC', 'GMRC ST1', 19, 20, 40);
  await phone.sync();
  await tablet.sync();

  assert.equal(wallet(tablet).bonus, 90);
  const entries = JSON.parse(tablet.s.getItem('history_v1')).entries;
  assert.ok(entries.some((e) => e.type === 'test' && e.testName === 'GMRC ST1' && e.coins === 40));
});

test('a shop request asked on the tablet and approved on the phone is bought on the tablet', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const phone = device(cloud);
  await phone.sync();

  const id = ShopRequests.create(tablet.s, now).ask({ id: 'ml', name: 'Mobile Legends', emoji: '', coins: 40 });
  await tablet.sync();
  await phone.sync();
  const onPhone = ShopRequests.create(phone.s, now);
  assert.deepEqual(onPhone.waiting().map((r) => r.id), [id]);
  assert.ok(onPhone.answer(id, true));
  await phone.sync();
  await tablet.sync();

  const bought = [];
  const out = ShopRequests.create(tablet.s, now).settle((r) => { bought.push(r.item); return 'done'; });
  assert.deepEqual(bought, ['ml']);
  assert.deepEqual(out, [{ id, status: 'done' }]);
  await tablet.sync();
  await phone.sync();
  assert.equal(ShopRequests.create(phone.s, now).get(id).status, 'done');
});

test('cancelling on the tablet beats an approval from the phone', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const phone = device(cloud);
  await phone.sync();

  const id = ShopRequests.create(tablet.s, now).ask({ id: 'ml', name: 'Mobile Legends', emoji: '', coins: 40 });
  await tablet.sync();
  await phone.sync();
  ShopRequests.create(tablet.s, now).cancel(id);
  ShopRequests.create(phone.s, now).answer(id, true);
  await phone.sync();
  await tablet.sync();
  await phone.sync();

  assert.equal(ShopRequests.create(tablet.s, now).get(id).status, 'cancelled');
  assert.equal(ShopRequests.create(phone.s, now).get(id).status, 'cancelled');
  assert.deepEqual(ShopRequests.create(tablet.s, now).settle(() => 'done'), []);
});
```

- [ ] **Step 2: Run them.**
Run: `node --test tests/sync.test.js`
Expected: PASS. If one fails, the bug is in Task 3 or 4. Fix it there; don't change these tests.

- [ ] **Step 3: Commit (the user runs this).**

```bash
git add tests/sync.test.js && git commit -m "Test the parent phone as one more synced device"
```

---

### Task 6: subjects.js

**Files:**
- Create: `web/engine/subjects.js`
- Create: `tests/subjects.test.js`
- Modify: `tests/paths.js` (`ENGINE_FILES`)

- [ ] **Step 1: Write the failing test.** Create `tests/subjects.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile, lobbyFile } = require('./paths.js');
const { SUBJECTS } = require(engineFile('subjects.js'));

for (const grade of [5, 2]) {
  test('the parent page lists the same Grade ' + grade + ' subjects as the lobby cards', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const cards = [...html.matchAll(/data-app="([^"]+)"[\s\S]*?subject-title">([^<]+)<[\s\S]*?data-points-key="([^"]+)"/g)]
      .map((m) => ({ app: m[1], title: m[2].replace(/&amp;/g, '&'), pointsKey: m[3] }));
    assert.deepEqual(SUBJECTS[grade], cards);
  });
}
```

- [ ] **Step 2: Run it and check that it fails.**
Run: `node --test tests/subjects.test.js`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implement.** Create `web/engine/subjects.js`:

```js
/* Each grade's subjects as the lobby cards show them, for the parent page, which has no cards.
   tests/subjects.test.js keeps this list equal to the cards. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var SUBJECTS = {
    5: [
      { app: 'history-explorers', title: 'Araling Panlipunan', pointsKey: 'historyexplorers_points_v1' },
      { app: 'wikaharian', title: 'Filipino', pointsKey: 'wikaharian_points_v1' },
      { app: 'math-mastery', title: 'Math', pointsKey: 'mathmastery_points_v1' },
      { app: 'page-turners', title: 'English', pointsKey: 'pageturners_points_v1' },
      { app: 'rise-shine', title: 'GMRC', pointsKey: 'riseshine_points_v1' },
      { app: 'rally-ready', title: 'P.E. & Health', pointsKey: 'rallyready_points_v1' },
      { app: 'craft-corner', title: 'TLE', pointsKey: 'craftcorner_points_v1' },
      { app: 'life-lab', title: 'Science', pointsKey: 'lifelab_points_v1' }
    ],
    2: [
      { app: 'block-bot', title: 'Math', pointsKey: 'blockbot_points_v1' },
      { app: 'kuwentista', title: 'Filipino', pointsKey: 'kuwentista_points_v1' },
      { app: 'word-train', title: 'English', pointsKey: 'wordtrain_points_v1' },
      { app: 'batang-bayani', title: 'Makabansa', pointsKey: 'batangbayani_points_v1' },
      { app: 'growing-good', title: 'GMRC', pointsKey: 'growinggood_points_v1' },
      { app: 'byte-buddies', title: 'Computer', pointsKey: 'bytebuddies_points_v1' },
      { app: 'science-detectives', title: 'Science', pointsKey: 'sciencedetectives_points_v1' }
    ]
  };

  var exported = { SUBJECTS: SUBJECTS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Subjects = SUBJECTS;
})(this);
```

- [ ] **Step 4: Add `'subjects.js'` to the end of `ENGINE_FILES` in `tests/paths.js`, run `node tools/update-precache.js`, then run `node --test`.**
Expected: all pass.

- [ ] **Step 5: Commit (the user runs this).**

```bash
git add web/engine/subjects.js web/sw.js tests/subjects.test.js tests/paths.js && git commit -m "List each grade's subjects for the parent page"
```

---

### Task 7: Split firebase-remote.js out of cloud.js; add watch, signedIn and the cloud-synced event

There are no unit tests for this browser-only Firebase code. Steps 4 and 5 check it in a real browser.

**Files:**
- Create: `web/engine/firebase-remote.js`
- Modify (rewrite): `web/engine/cloud.js`
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html` (script tags)
- Modify: the file-check snippet in both lobbies and all 15 games
- Modify: `tests/paths.js`

- [ ] **Step 1: Create `web/engine/firebase-remote.js`:**

```js
/* The Firebase side of cloud sync: loads the SDK from Google's CDN only when asked, signs in, and gives
   sync-core.js its remote on Firestore. Used by cloud.js (lobbies) and the parent page. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/12.4.0/';
  var fb = null;

  function load() {
    if (fb) return Promise.resolve(fb);
    if (!root.FIREBASE_CONFIG) return Promise.reject(new Error('no Firebase config'));
    return Promise.all(['app', 'auth', 'firestore'].map(function (m) { return import(SDK + 'firebase-' + m + '.js'); }))
      .then(function (mods) {
        var app = mods[0].initializeApp(root.FIREBASE_CONFIG);
        fb = { A: mods[1], F: mods[2], auth: mods[1].getAuth(app), db: mods[2].getFirestore(app) };
        return fb;
      });
  }

  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }
  var enc = encodeURIComponent, dec = decodeURIComponent;

  // The remote interface sync-core.js expects, on Firestore: families/{uid}/learners/{id}/{state|counters|history}/{key}.
  // Call it only after load() has finished.
  function remoteFor(uid) {
    var F = fb.F, db = fb.db;
    function learnerDoc(id) { return F.doc(db, 'families', uid, 'learners', id); }
    function sub(id, name) { return F.collection(db, 'families', uid, 'learners', id, name); }
    function since(id, name, ms) { return F.getDocs(F.query(sub(id, name), F.where('updatedAt', '>=', F.Timestamp.fromMillis(ms)))); }
    function at(d) { var t = d.data().updatedAt; return t && t.toMillis ? t.toMillis() : 0; }
    function stateRef(id, key) { return key === 'profile_v1' ? learnerDoc(id) : F.doc(sub(id, 'state'), enc(key)); }

    return {
      learners: function () {
        return F.getDocs(F.collection(db, 'families', uid, 'learners')).then(function (snap) {
          return snap.docs.map(function (d) { return { id: d.id, profile: parse(d.data().json) }; });
        });
      },
      pull: function (id, ms) {
        return Promise.all([F.getDoc(learnerDoc(id)), since(id, 'state', ms), since(id, 'counters', ms), since(id, 'history', ms)]).then(function (r) {
          var until = ms, out = { state: [], counters: [], history: [] };
          function seen(d) { until = Math.max(until, at(d)); }
          if (r[0].exists() && at(r[0]) >= ms) { seen(r[0]); out.state.push({ key: 'profile_v1', value: parse(r[0].data().json) }); }
          r[1].docs.forEach(function (d) { seen(d); out.state.push({ key: dec(d.id), value: parse(d.data().json) }); });
          r[2].docs.forEach(function (d) { seen(d); out.counters.push({ key: dec(d.id), total: Number(d.data().total) || 0 }); });
          r[3].docs.forEach(function (d) { seen(d); out.history.push({ id: dec(d.id), entry: d.data().deleted ? null : parse(d.data().json) }); });
          out.until = until;
          return out;
        });
      },
      merge: function (id, key, local, fn) {
        var ref = stateRef(id, key);
        return F.runTransaction(db, function (tx) {
          return tx.get(ref).then(function (snap) {
            var merged = fn(local, snap.exists() ? parse(snap.data().json) : null);
            tx.set(ref, { json: JSON.stringify(merged), updatedAt: F.serverTimestamp() });
            return merged;
          });
        });
      },
      add: function (id, key, delta) {
        var ref = F.doc(sub(id, 'counters'), enc(key));
        return F.runTransaction(db, function (tx) {
          return tx.get(ref).then(function (snap) {
            var total = (snap.exists() ? Number(snap.data().total) || 0 : 0) + delta;
            tx.set(ref, { total: total, updatedAt: F.serverTimestamp() });
            return total;
          });
        });
      },
      putHistory: function (id, docs) {
        var chunks = [];
        for (var i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
        return chunks.reduce(function (chain, chunk) {
          return chain.then(function () {
            var batch = F.writeBatch(db);
            chunk.forEach(function (d) {
              batch.set(F.doc(sub(id, 'history'), enc(d.id)), d.entry
                ? { json: JSON.stringify(d.entry), updatedAt: F.serverTimestamp() }
                : { deleted: true, updatedAt: F.serverTimestamp() });
            });
            return batch.commit();
          });
        }, Promise.resolve());
      },
      // Calls onChange whenever one state doc changes in the cloud (and once at the start). Returns a stop function.
      watch: function (id, key, onChange) {
        return F.onSnapshot(stateRef(id, key), function () { onChange(); }, function () {});
      }
    };
  }

  function signInError(e) {
    var code = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'Wrong email or password.';
    if (/network/.test(code)) return 'No internet. Try again when online.';
    if (/too-many-requests/.test(code)) return 'Too many tries. Wait a few minutes.';
    return 'Could not sign in (' + (code || 'unknown error') + ').';
  }

  root.FirebaseRemote = {
    // onUser(user or null) runs once the saved login is known, and again on every sign-in or sign-out.
    onAuth: function (onUser) {
      return load().then(function () { return fb.auth.authStateReady(); }).then(function () { fb.A.onAuthStateChanged(fb.auth, onUser); });
    },
    signIn: function (email, password) {
      return load().then(function () { return fb.A.signInWithEmailAndPassword(fb.auth, email, password); });
    },
    signOut: function () { return fb ? fb.A.signOut(fb.auth) : Promise.resolve(); },
    remote: remoteFor,
    signInError: signInError
  };
})(this);
```

- [ ] **Step 2: Rewrite `web/engine/cloud.js`** in full:

```js
/* Cloud backup and sync (phase 5b), loaded by the lobbies only. It fills the Parent panel's "Cloud backup" section,
   and syncs when the lobby opens, every 2 minutes, and when the device comes back online. firebase-remote.js loads
   the Firebase SDK only on devices where a parent has signed in, so the games stay light and offline play never
   waits on it. After each good sync it fires a "cloud-synced" event on document. */
(function (root) {
  'use strict';

  var EVERY_MS = 2 * 60 * 1000;
  var ROUND_TIMEOUT_MS = 30000;
  var SIGNED_IN = 'sync_signed_in_v1';

  // Defined even when sync is off (opened as a file, no learner), so the missing-file check and the shop see it.
  root.Cloud = {
    sync: function () { return Promise.resolve(); },
    signedIn: function () { return false; },
    watch: function () { return function () {}; }
  };
  var L = root.Learner, Core = root.SyncCore, FR = root.FirebaseRemote;
  if (!L || !Core || !FR || !root.FIREBASE_CONFIG || !L.current() || root.location.protocol === 'file:') return;

  var me = L.current();
  var space = L.storage;
  var device = root.StudyStore.raw;
  var connected = false, user = null, busy = false, again = false, choice = null, timer = null, typedEmail = '', signingIn = false;
  var status = { text: '', error: false };

  // The Firebase login belongs to the whole device, so one sign-in covers both lobbies.
  // Before 2026-10-02 the flag was saved in a child's own space, so any child's copy still counts.
  function wasSignedIn() {
    return device.getItem(SIGNED_IN) === '1' || root.StudyStore.spaces().some(function (id) {
      return root.StudyStore.space(id).getItem(SIGNED_IN) === '1';
    });
  }
  function markSignedIn(on) {
    try { if (on) device.setItem(SIGNED_IN, '1'); else device.removeItem(SIGNED_IN); } catch (e) {}
    root.StudyStore.spaces().forEach(function (id) { root.StudyStore.space(id).put(SIGNED_IN, null); });
  }

  function withTimeout(p) {
    return Promise.race([p, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ROUND_TIMEOUT_MS); })]);
  }

  function ago(ms) {
    var min = Math.round((Date.now() - ms) / 60000);
    return min < 1 ? 'just now' : min === 1 ? '1 min ago' : min < 60 ? min + ' min ago' : Math.round(min / 60) + ' h ago';
  }

  function runSync() {
    if (!user || choice) return Promise.resolve();
    // A sync asked for during a round (for example a shop request) runs right after it.
    if (busy) { again = true; return Promise.resolve(); }
    if (root.navigator && root.navigator.onLine === false) { setStatus('☁️ Waiting for internet. Everything is saved on this tablet.'); return Promise.resolve(); }
    busy = true;
    var remote = FR.remote(user.uid), core = Core.create(space, remote, me.id);
    var round = core.linked() ? Promise.resolve() : remote.learners().then(function (list) {
      var p = Core.plan(me, space.keys(), list);
      if (p.action === 'choose') { choice = p; return 'wait'; }
      core.link();
      return null;
    });
    return withTimeout(round.then(function (wait) { return wait === 'wait' ? null : core.sync(); }))
      .then(function (r) {
        if (r) {
          setStatus('☁️ Synced ' + ago(r.at) + '.');
          document.dispatchEvent(new CustomEvent('cloud-synced'));
        } else render();
      }, function () {
        setStatus('☁️ Could not reach the cloud. Everything is saved on this tablet; it will try again.', true);
      })
      .then(function () {
        busy = false;
        if (again) { again = false; runSync(); }
      });
  }

  function start(u) {
    var changed = (u && u.uid) !== (user && user.uid);
    user = u;
    if (u) {
      markSignedIn(true);
      if (!timer) timer = setInterval(runSync, EVERY_MS);
      runSync();
    } else {
      markSignedIn(false);
      if (timer) { clearInterval(timer); timer = null; }
    }
    if (changed) { status = { text: '', error: false }; render(); }
  }

  function connect() {
    if (connected) return Promise.resolve();
    connected = true;
    return FR.onAuth(start).catch(function (e) { connected = false; throw e; });
  }

  // ---- the Parent panel section ----
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function setStatus(text, error) { status = { text: text, error: !!error }; render(); }

  function render() {
    var box = document.getElementById('cloud-section');
    if (!box) return;
    box.hidden = false;
    box.textContent = '';
    box.appendChild(el('h3', {}, '☁️ Cloud backup'));
    if (!user) {
      box.appendChild(el('p', { class: 'p-note' }, 'Sign in with the family login. This tablet then backs up on its own and stays in sync with her other devices.'));
      var row = el('div', { class: 'p-row' });
      var email = el('input', { type: 'email', id: 'cloud-email', autocomplete: 'username', placeholder: 'Family email' });
      email.value = typedEmail;
      email.addEventListener('input', function () { typedEmail = email.value; });
      var pass = el('input', { type: 'password', id: 'cloud-pass', autocomplete: 'current-password', placeholder: 'Password' });
      var go = el('button', { class: 'p-btn', type: 'button', id: 'cloud-signin' }, 'Sign in');
      row.appendChild(email); row.appendChild(pass); row.appendChild(go);
      box.appendChild(row);
      go.disabled = signingIn;
      box.appendChild(el('p', { class: 'p-note', id: 'cloud-msg' }, status.text));
      go.addEventListener('click', function () {
        typedEmail = email.value.trim();
        signingIn = true;
        setStatus('Signing in…');
        connect()
          .then(function () { return FR.signIn(typedEmail, pass.value); })
          .then(function () { signingIn = false; }, function (e) { signingIn = false; setStatus(FR.signInError(e), true); });
      });
      return;
    }
    box.appendChild(el('p', { class: 'p-note' }, 'Signed in as ' + (user.email || 'the family login') + '.'));
    if (choice) return renderChoice(box);
    box.appendChild(el('p', { class: 'p-note', id: 'cloud-status' }, status.text || '☁️ Syncing…'));
    var actions = el('div', { class: 'p-row' });
    var now = el('button', { class: 'p-btn', type: 'button', id: 'cloud-sync' }, 'Sync now');
    var out = el('button', { class: 'p-btn', type: 'button', id: 'cloud-signout' }, 'Sign out');
    actions.appendChild(now); actions.appendChild(out);
    box.appendChild(actions);
    box.appendChild(el('p', { class: 'p-note' }, 'Signing out stops syncing. It does not delete anything on this tablet or in the cloud.'));
    now.addEventListener('click', function () { setStatus('☁️ Syncing…'); runSync(); });
    out.addEventListener('click', function () { FR.signOut(); });
  }

  function label(c) {
    var p = c.profile || {};
    return (p.emoji ? p.emoji + ' ' : '') + (p.name || 'No name yet') + ' · Grade ' + (p.grade || '?');
  }

  function renderChoice(box) {
    box.appendChild(el('p', {}, choice.keep ? 'The cloud already has a child in this grade. Is this tablet hers?' : 'Which child uses this tablet?'));
    var row = el('div', { class: 'p-row' });
    choice.candidates.forEach(function (c) {
      var b = el('button', { class: 'p-btn', type: 'button' }, (choice.keep ? 'Yes, this is ' : 'This is ') + label(c));
      b.addEventListener('click', function () {
        if (choice.keep && !confirm('This tablet will switch to ' + label(c) + ' from the cloud. Points and coins saved only on this tablet will not be added. Continue?')) return;
        L.adopt(c.id, c.profile || {});
        root.location.reload();
      });
      row.appendChild(b);
    });
    if (choice.keep) {
      var keep = el('button', { class: 'p-btn', type: 'button' }, 'No, keep this tablet as a different child');
      keep.addEventListener('click', function () {
        Core.create(space, null, me.id).link();
        choice = null;
        runSync();
      });
      row.appendChild(keep);
    }
    box.appendChild(row);
  }

  root.Cloud.sync = runSync;
  root.Cloud.signedIn = function () { return !!user && !choice; };
  root.Cloud.watch = function (key, onChange) { return user ? FR.remote(user.uid).watch(me.id, key, onChange) : function () {}; };

  function init() {
    render();
    if (wasSignedIn()) connect().catch(function () { setStatus('☁️ Waiting for internet. Everything is saved on this tablet.'); });
    root.addEventListener('online', function () { if (user) runSync(); else if (wasSignedIn()) connect().catch(function () {}); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') runSync(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(this);
```

- [ ] **Step 3: Load the new file in both lobbies and teach every page's file check about the new globals.**

In `web/lobby/grade-5.html` add this line right after `<script src="../engine/firebase-config.js" data-grade="grade5"></script>`:

```html
<script src="../engine/firebase-remote.js" data-grade="grade5"></script>
```

In `web/lobby/grade-2.html` add this line right after its `firebase-config.js` line:

```html
<script src="../engine/firebase-remote.js" data-grade="grade2"></script>
```

The file-check snippet must stay identical on every page (`tests/pages.test.js`). Add the four globals this plan introduces to every page at once:

```bash
cd /c/Users/ADMIN/IdeaProjects/school && grep -rl "cloud: 'Cloud' };" web --include=*.html | xargs sed -i "s/cloud: 'Cloud' };/cloud: 'Cloud', 'firebase-remote': 'FirebaseRemote', 'shop-requests': 'ShopRequests', subjects: 'Subjects', 'parent-panel': 'ParentPanel' };/"
grep -rL "'parent-panel': 'ParentPanel'" web/lobby/*.html web/subjects/*/*/index.html
```

Expected: the second command prints nothing, which means every page has the new snippet.

Add `'firebase-remote.js'` to `ENGINE_FILES` in `tests/paths.js`, right after `'firebase-config.js'`. Run `node tools/update-precache.js`.

- [ ] **Step 4: Run all unit tests and the e2e suites that run with sync off.**

```bash
node --test
node tests/e2e/lobby-e2e.js
node tests/e2e/lobby-e2e.js 5
node tests/e2e/file-check-e2e.js
```

Expected: everything passes.

- [ ] **Step 5: Check it by hand in a browser.** Serve the site with `npx -y http-server web -p 8765 -s`. Open `http://localhost:8765/lobby/grade-5.html`, then Parent, PIN 0108. Check:
  - The Cloud backup section shows the sign-in form.
  - Signing in with a wrong password shows "Wrong email or password." This needs network access to Firebase.
  - In the console, `Cloud.signedIn()` is `false` and `typeof Cloud.watch` is `'function'`.
  - The console shows no errors.

  Stop the server when done.

- [ ] **Step 6: Commit (the user runs this).**

```bash
git add web tests/paths.js && git commit -m "Split the Firebase code out of cloud.js and let pages watch a synced key"
```

---

### Task 8: Move the Parent panel into engine/parent-panel.js

The inline Parent panel script (the last `<script>` in each lobby, from `var PIN = '0108';` to the end) is the same in both lobbies, as `tests/copies.test.js` checks. It moves into one engine file. The lobby keeps the same DOM, so the e2e drivers don't change.

**Files:**
- Create: `web/engine/parent-panel.js`
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html` (last inline script, script tags)
- Modify: `tests/copies.test.js`, `tests/paths.js`

- [ ] **Step 1: Write the failing test.** Append to `tests/copies.test.js`:

```js
test('the Parent panel lives in engine/parent-panel.js, not inline in the lobbies', () => {
  for (const grade of [5, 2]) {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    assert.ok(html.includes('<script src="../engine/parent-panel.js"'), 'grade ' + grade + ' lobby does not load parent-panel.js');
    assert.ok(!html.includes('function renderWeakSpots'), 'grade ' + grade + ' lobby still has the panel script inline');
  }
});
```

- [ ] **Step 2: Run it and check that it fails.**
Run: `node --test tests/copies.test.js`
Expected: FAIL, `grade 5 lobby does not load parent-panel.js`.

- [ ] **Step 3: Create `web/engine/parent-panel.js`.** Apart from the marked changes, the code is the old inline script moved as it was:

```js
/* The Parent panel: study history with its filters, Needs practice and real test scores. In the lobbies it also has
   the PIN overlay, the learner's name, backups and deleting history. Shared by both lobbies and the parent page. */
(function (root) {
  'use strict';

  var PIN = '0108';

  // The 4-dot PIN keypad. o: { dots, pad, hint, hintText, onUnlock }.
  function pinGate(o) {
    var entered = '', shakeT = null;
    function draw() {
      Array.prototype.forEach.call(o.dots.children, function (d, i) { d.classList.toggle('fill', i < entered.length); });
    }
    function press(key) {
      if (key === 'clear') { entered = entered.slice(0, -1); draw(); return; }
      if (entered.length >= 4) return;
      entered += key;
      draw();
      if (entered.length < 4) return;
      if (entered === PIN) { entered = ''; draw(); o.onUnlock(); return; }
      entered = '';
      clearTimeout(shakeT);
      o.dots.classList.remove('shake');
      void o.dots.offsetWidth;
      o.dots.classList.add('shake');
      o.hint.textContent = 'Wrong PIN';
      shakeT = setTimeout(function () {
        o.dots.classList.remove('shake');
        draw();
        o.hint.textContent = o.hintText;
      }, 1500);
    }
    o.pad.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (b) press(b.getAttribute('data-key') || b.textContent);
    });
    return { press: press, reset: function () { entered = ''; draw(); } };
  }

  function subjectsFromCards(doc) {
    return Array.prototype.map.call(doc.querySelectorAll('.subject-card'), function (card) {
      return {
        app: card.getAttribute('data-app'),
        title: card.querySelector('.subject-title').textContent,
        pointsKey: card.querySelector('[data-points-key]').getAttribute('data-points-key')
      };
    });
  }

  // o: { history, wallet, learner, store, subjects: [{ app, title, pointsKey }], lobby, onChange }.
  // lobby: true adds the PIN overlay, learner, backup and delete sections. onChange runs after a test score is added.
  function mount(o) {
    var SH = o.history, W = o.wallet, L = o.learner, STORE = o.store;
    var doc = root.document;
    var $ = function (id) { return doc.getElementById(id); };
    var range = '7';
    var picking = false;

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function entriesWord(n) { return n + (n === 1 ? ' entry' : ' entries'); }

    function today() { return SH.dateKey(Date.now()); }
    function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return SH.dateKey(d.getTime()); }
    function currentRange() {
      if (range === 'all') return [null, null];
      if (range === 'custom') return [$('range-from').value || null, $('range-to').value || null];
      if (range === 'today') return [today(), today()];
      return [daysAgo(parseInt(range, 10) - 1), today()];
    }
    function rangeDatesFor(r) {
      if (r === 'all' || r === 'today') return [today(), today()];
      if (r === 'custom') return [$('range-from').value || today(), $('range-to').value || today()];
      return [daysAgo(parseInt(r, 10) - 1), today()];
    }
    function prefillCustomFrom(oldRange) {
      var d = rangeDatesFor(oldRange);
      if (!$('range-from').value) $('range-from').value = d[0];
      if (!$('range-to').value) $('range-to').value = d[1];
    }

    function formatDuration(ms) {
      var mins = Math.round(ms / 60000);
      if (mins < 1) return 'under 1 min';
      if (mins < 60) return mins + ' min';
      return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
    }

    function wrongList(e) { return Array.isArray(e.wrong) ? e.wrong.filter(Boolean) : []; }

    var subjectByApp = {};
    function subjectOf(app, appTitle) { return subjectByApp[app] || appTitle; }

    function describe(e) {
      var subject = subjectOf(e.app, e.appTitle);
      if (e.type === 'open') return '📂 Opened ' + subject;
      if (e.type === 'purchase') return '🛒 Bought ' + e.itemName + ' — ' + e.coins + ' coins';
      if (e.type === 'test') return '📝 Real test · ' + subject + ' · ' + e.testName + ' — ' + e.score + '/' + e.total + ' · +' + e.coins + ' coins';
      if (e.type === 'lesson') return '📖 ' + subject + ' · ' + e.lessonTitle + ' — viewed ' + e.cardsViewed + ' of ' + e.cardsTotal + ' cards';
      var icon = '✏️', name;
      if (e.kind === 'walkthrough') { icon = '🧩'; name = subject + ' · UPAC Walkthrough: ' + e.lessonTitle; }
      else if (e.kind === 'case') { icon = '📋'; name = subject + ' · Case Study: ' + e.lessonTitle; }
      else name = subject + ' · ' + (e.final ? 'Final Mock Exam' : e.lessonTitle + ' quiz');
      if (!e.finished) return icon + ' ' + name + ' — stopped at ' + e.answered + ' of ' + e.total + ', ' + e.correct + ' correct' + helpsText(e) + typedText(e);
      var starCount = Math.min(3, Math.max(0, e.stars | 0));
      var stars = starCount > 0 ? ' ' + '⭐'.repeat(starCount) : '';
      var updatedAt = typeof e.updatedAt === 'number' ? e.updatedAt : e.t;
      var scoreText = e.kind === 'walkthrough' ? e.correct + '/' + e.total + ' steps' : e.correct + '/' + e.total;
      return icon + ' ' + name + ' — ' + scoreText + stars + ' +' + e.points + ' pts · ' + formatDuration(updatedAt - e.t) + helpsText(e) + typedText(e);
    }

    function helpsText(e) {
      var text = SH.powerUpsText ? SH.powerUpsText(e) : '';
      return text ? ' · ⚡ ' + text : '';
    }

    function typedText(e) { return e.typed ? ' · ✏️ ' + e.typed + ' typed' : ''; }

    function wrongDetails(e) {
      var wrong = wrongList(e);
      var d = el('details');
      d.appendChild(el('summary', '', plural(wrong.length, 'wrong answer')));
      var ul = el('ul', 'h-wrong');
      wrong.forEach(function (w) {
        var li = el('li');
        li.appendChild(el('div', '', w.q));
        li.appendChild(el('div', 'pick', '❌ ' + w.picked));
        li.appendChild(el('div', 'ans', '✅ ' + w.answer));
        ul.appendChild(li);
      });
      d.appendChild(ul);
      return d;
    }

    function renderSummary(s) {
      var box = $('hist-summary');
      box.textContent = '';
      box.appendChild(el('span', '', '⏱️ Study time: ' + formatDuration(s.studyMs)));
      box.appendChild(el('span', '', '✏️ Quizzes: ' + s.quizzes));
      box.appendChild(el('span', '', '🎯 Average: ' + (s.averagePct === null ? '—' : s.averagePct + '%')));
      if (s.mostMissed) {
        box.appendChild(el('span', 'missed', 'Most missed: ' + subjectOf(s.mostMissed.app, s.mostMissed.appTitle) + ' · “' + s.mostMissed.q + '” (' + s.mostMissed.count + '×)'));
      }
    }

    var WEAK_BELOW = 80;
    function renderWeakSpots(entries) {
      var box = $('weak-spots');
      box.textContent = '';
      if (!SH.weakSpots) return;
      box.appendChild(el('h3', '', '📉 Needs practice'));
      var all = SH.weakSpots(entries, 50);
      var spots = all.filter(function (s) { return s.pct < WEAK_BELOW; }).slice(0, 5);
      if (!spots.length) {
        box.appendChild(el('p', 'p-note', all.length ? 'Every lesson is at ' + WEAK_BELOW + '% or more in this range. 🎉' : 'Not enough quiz answers in this range yet.'));
        return;
      }
      box.appendChild(el('p', 'p-note', 'Lessons under ' + WEAK_BELOW + '% right, weakest first (at least 5 answers).'));
      var ol = el('ol', 'weak-list');
      spots.forEach(function (s) {
        ol.appendChild(el('li', '', subjectOf(s.app, s.appTitle) + ' · ' + s.lesson + ' — ' + s.pct + '% right (' +
          s.correct + ' of ' + s.answered + ', ' + (s.quizzes === 1 ? '1 quiz' : s.quizzes + ' quizzes') + ')'));
      });
      box.appendChild(ol);
    }

    function renderList(entries) {
      var box = $('hist-list');
      box.textContent = '';
      if (!entries.length) { box.appendChild(el('p', 'p-note', 'No activity in this range yet.')); return; }
      var lastDay = '';
      entries.forEach(function (e) {
        try {
          var when = new Date(e.t);
          var day = when.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
          if (day !== lastDay) { box.appendChild(el('div', 'h-day', day)); lastDay = day; }
          var row = el('div', 'h-item');
          row.appendChild(el('div', 'h-time', when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })));
          var body = el('div', 'h-body', describe(e));
          if (e.type === 'quiz' && wrongList(e).length) body.appendChild(wrongDetails(e));
          row.appendChild(body);
          box.appendChild(row);
        } catch (err) {
          var fallback = el('div', 'h-item');
          fallback.appendChild(el('div', 'h-time', new Date(e.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })));
          fallback.appendChild(el('div', 'h-body', subjectOf(e.app, e.appTitle) || 'Unknown'));
          box.appendChild(fallback);
        }
      });
    }

    function renderHistory() {
      $('history-full').hidden = !SH.storageError();
      var r = currentRange();
      if (range === 'custom' && r[0] && r[1] && r[0] > r[1]) {
        $('range-msg').textContent = 'From must be on or before To.';
        $('hist-summary').textContent = '';
        $('weak-spots').textContent = '';
        $('hist-list').textContent = '';
        return;
      }
      $('range-msg').textContent = '';
      var entries = SH.list(r[0], r[1], $('subject-filter').value || null);
      renderSummary(SH.summary(entries));
      renderWeakSpots(entries);
      renderList(entries);
    }

    function fmtDate(key) {
      var p = key.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    var tsRepeat = null;
    function tsValues() {
      var name = $('ts-name').value.trim(), scoreText = $('ts-score').value, totalText = $('ts-total').value;
      var score = Number(scoreText), total = Number(totalText);
      if (!name || scoreText === '' || totalText === '' || !Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) return null;
      return { app: $('ts-subject').value, name: name, score: score, total: total, coins: W.testBonus(score, total) };
    }
    function tsPreview() {
      tsRepeat = null;
      var v = tsValues();
      $('ts-add').disabled = !v;
      $('ts-add').textContent = v ? 'Add ' + v.coins + ' coins' : 'Add coins';
      $('ts-msg').textContent = v ? Math.floor(v.score * 100 / v.total) + '% → 🪙 ' + v.coins + ' coins' : '';
    }
    function tsAdd() {
      var v = tsValues();
      if (!v) return;
      var earlier = SH.findTest(v.app, v.name);
      if (earlier && tsRepeat !== earlier.id) {
        tsRepeat = earlier.id;
        $('ts-msg').textContent = 'Already added on ' + fmtDate(SH.dateKey(earlier.t)) + '. Tap Add again to add it again.';
        return;
      }
      if (!W.addBonus(v.coins)) { $('ts-msg').textContent = 'Could not save. Storage may be full.'; return; }
      SH.testScore(v.app, subjectOf(v.app), v.name, v.score, v.total, v.coins);
      if (W.refreshShop) W.refreshShop();
      if (W.renderCoins) W.renderCoins();
      $('ts-name').value = '';
      $('ts-score').value = '';
      $('ts-total').value = '';
      tsPreview();
      $('ts-msg').textContent = '✅ Added 🪙 ' + v.coins + ' coins for ' + v.name + '.';
      renderHistory();
      if (o.onChange) o.onChange();
    }

    o.subjects.forEach(function (s) {
      subjectByApp[s.app] = s.title;
      var opt = el('option', '', s.title);
      opt.value = s.app;
      $('subject-filter').appendChild(opt);
      var tsOpt = el('option', '', s.title);
      tsOpt.value = s.app;
      $('ts-subject').appendChild(tsOpt);
    });

    $('test-score').hidden = !(SH && W && W.addBonus && W.testBonus);
    ['ts-name', 'ts-score', 'ts-total'].forEach(function (id) { $(id).addEventListener('input', tsPreview); });
    $('ts-subject').addEventListener('change', tsPreview);
    $('ts-add').addEventListener('click', tsAdd);

    $('range-buttons').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-range]');
      if (!b) return;
      var newRange = b.getAttribute('data-range');
      if (newRange === 'custom' && range !== 'custom') prefillCustomFrom(range);
      range = newRange;
      Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle('on', c === b); });
      $('custom-range').hidden = range !== 'custom';
      renderHistory();
    });
    ['range-from', 'range-to', 'subject-filter'].forEach(function (id) {
      $(id).addEventListener('change', renderHistory);
    });

    // ---- lobby only: the PIN overlay, the learner's name, backups and deleting history ----
    function mountLobby() {
      var overlay = $('parent-overlay'), pinView = $('pin-view'), historyView = $('history-view');
      var gate = pinGate({ dots: $('pin-dots'), pad: $('pin-pad'), hint: $('pin-hint'), hintText: 'Enter the parent PIN', onUnlock: unlock });

      function lock() {
        gate.reset();
        pinView.hidden = false;
        historyView.hidden = true;
      }
      function openParent() {
        lock();
        overlay.hidden = false;
        doc.querySelector('.wrap').inert = true;
        $('parent-close').focus();
      }
      function closeParent() {
        lock();
        overlay.hidden = true;
        doc.querySelector('.wrap').inert = false;
        $('parent-open').focus();
      }
      function unlock() {
        pinView.hidden = true;
        historyView.hidden = false;
        $('history-missing').hidden = !!SH;
        $('history-body').hidden = !SH;
        if (SH) { renderHistory(); renderBackupAge(); }
      }

      function download(name, text, type) {
        var url = URL.createObjectURL(new Blob([text], { type: type }));
        var a = el('a');
        a.href = url;
        a.download = name;
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        $('backup-msg').textContent = 'Saved ' + name + ' to your Downloads folder.';
      }

      var BACKUP_DUE_DAYS = 7;
      function savedState() {
        var state = {};
        var keys = ['wallet_v1', 'recall_v1'];
        o.subjects.forEach(function (s) { keys.push(s.pointsKey); });
        keys.forEach(function (k) {
          var v = null;
          try { v = STORE.getItem(k); } catch (e) {}
          if (v !== null) state[k] = v;
        });
        return state;
      }
      function pointsIn(state) {
        var total = 0;
        Object.keys(state).forEach(function (k) { if (/_points_v1$/.test(k)) total += parseInt(state[k], 10) || 0; });
        return total;
      }
      function daysSinceBackup() {
        var last = SH.lastBackup();
        if (last === null) return null;
        return Math.round((new Date(today()) - new Date(SH.dateKey(last))) / 86400000);
      }
      function renderBackupAge() {
        if (!SH || !SH.lastBackup) return;
        var days = daysSinceBackup();
        var late = days !== null && days > BACKUP_DUE_DAYS;
        var due = days === null ? pointsIn(savedState()) > 0 : late;
        $('parent-open').textContent = due ? '🔒 Parent · 💾 backup due' : '🔒 Parent';
        $('backup-age').textContent = days === null ? '⚠️ No full backup from this device yet.' :
          (late ? '⚠️ ' : '✅ ') + 'Last full backup: ' + (days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago') + (late ? '. Time to export a new one.' : '.');
      }
      function totalsText(state) { return '⭐ ' + pointsIn(state) + ' points' + coinsText(state); }
      function noStateReason(text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) {}
        if (data && data.state && typeof data.state === 'object') {
          return 'This backup has 0 points and no coins: the page it was copied from had nothing saved. Make the backup where she can see her points (the same app and the same link), then try again.';
        }
        return 'This backup has no points or coins in it (it was made with the old Export button).';
      }
      function coinsText(state) { return W && W.savedBalance ? ' and 🪙 ' + W.savedBalance(state) + ' coins' : ''; }
      function restoreState(b) {
        var current = savedState();
        var same = Object.keys(b.state).every(function (k) { return current[k] === b.state[k]; });
        if (same) return 'Points and coins already match this backup.';
        var when = b.exportedAt ? ' from ' + fmtDate(SH.dateKey(b.exportedAt)) : '';
        if (!confirm('This backup' + when + ' has ⭐ ' + pointsIn(b.state) + ' points' + coinsText(b.state) + '.\n' +
          'This device has ⭐ ' + pointsIn(current) + ' points' + coinsText(current) + '.\n\n' +
          'Replace the points and coins on this device with the ones in the backup?')) return 'Points and coins were left as they are.';
        try {
          Object.keys(b.state).forEach(function (k) { STORE.setItem(k, b.state[k]); });
          if (b.learner && L && !L.current().name) L.update(b.learner);
        } catch (e) {
          return 'Could not restore points and coins: storage is full or unavailable.';
        }
        setTimeout(function () { location.reload(); }, 1500);
        return 'Restored points and coins. Reloading…';
      }

      function renderLearner() {
        var me = L && L.current();
        $('learner-section').hidden = !me;
        if (!me) return;
        $('learner-name').value = me.name;
        $('learner-emoji').value = me.emoji;
        $('hero-title').textContent = me.name ? (me.emoji ? me.emoji + ' ' : '') + 'Hi, ' + me.name + '!' : 'Study Games';
      }
      $('learner-save').addEventListener('click', function () {
        L.update({ name: $('learner-name').value, emoji: $('learner-emoji').value });
        renderLearner();
        $('learner-msg').textContent = '✅ Saved.';
      });
      renderLearner();

      $('parent-open').addEventListener('click', openParent);
      renderBackupAge();
      $('parent-close').addEventListener('click', closeParent);
      root.addEventListener('pagehide', closeParent);
      root.addEventListener('focus', function () { picking = false; });
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden && !picking) closeParent();
      });
      doc.addEventListener('keydown', function (ev) {
        if (overlay.hidden) return;
        if (ev.key === 'Escape') closeParent();
        else if (!pinView.hidden && /^[0-9]$/.test(ev.key)) gate.press(ev.key);
        else if (!pinView.hidden && ev.key === 'Backspace') gate.press('clear');
      });

      $('export-json').addEventListener('click', function () {
        download('study-backup-' + SH.grade + '-' + today() + '.json', SH.exportJson(savedState(), L && L.current()), 'application/json');
        $('backup-msg').textContent += ' It holds ' + totalsText(savedState()) + '.';
        SH.markBackedUp();
        renderBackupAge();
      });
      $('export-csv').addEventListener('click', function () {
        download('study-history-' + SH.grade + '-' + today() + '.csv', SH.exportCsv(subjectOf), 'text/csv;charset=utf-8');
      });
      $('export-shop').addEventListener('click', function () {
        download('shop-history-' + SH.grade + '-' + today() + '.csv', SH.exportPurchasesCsv(), 'text/csv;charset=utf-8');
      });
      function importResult(msg) {
        $('backup-msg').textContent = msg;
        alert(msg);
      }
      function importText(text) {
        try {
          var r = SH.importJson(text);
          var b = SH.backupState(text);
          var history = 'Study history: added ' + entriesWord(r.added) + ', skipped ' + plural(r.skipped, 'duplicate') + '.';
          renderHistory();
          importResult(history + ' ' + (b ? restoreState(b) : noStateReason(text) + ' Only the history was added.'));
        } catch (err) {
          importResult(err.message);
        }
      }
      function showPasteBox(hint, text) {
        $('paste-box').hidden = false;
        $('paste-hint').textContent = hint;
        $('paste-text').value = text;
        $('paste-text').focus();
        if (text) $('paste-text').select();
      }
      function copyText(text) {
        var ta = el('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        doc.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = false;
        try { ok = doc.execCommand('copy'); } catch (e) {}
        ta.remove();
        return ok;
      }
      $('copy-backup').addEventListener('click', function () {
        var text = SH.exportJson(savedState(), L && L.current());
        if (copyText(text)) {
          SH.markBackedUp();
          renderBackupAge();
          importResult('Full backup copied: ' + totalsText(savedState()) + '. Paste it somewhere safe (a note, or a message to yourself). To restore, open the lobby, then Parent, Paste backup.');
          return;
        }
        showPasteBox('Copying did not work here. Select all of the text below and copy it yourself.', text);
        SH.markBackedUp();
        renderBackupAge();
      });
      $('paste-btn').addEventListener('click', function () {
        showPasteBox('Paste the full backup text here, then tap Import pasted backup.', '');
      });
      $('paste-import').addEventListener('click', function () {
        var text = $('paste-text').value.trim();
        if (!text) { importResult('Paste the backup text first.'); return; }
        importText(text);
      });
      $('import-btn').addEventListener('click', function () { picking = true; $('import-file').click(); });
      $('import-file').addEventListener('change', function () {
        picking = false;
        var input = this, file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          importText(String(reader.result));
          input.value = '';
        };
        reader.onerror = function () {
          importResult('Could not read that file.');
          input.value = '';
        };
        reader.readAsText(file);
      });

      $('delete-range').addEventListener('click', function () {
        var from = $('del-from').value, to = $('del-to').value;
        if (!from || !to || from > to) {
          $('delete-msg').textContent = 'Pick a From date and a To date (From must be on or before To).';
          return;
        }
        var n = SH.list(from, to).length;
        if (!n) { $('delete-msg').textContent = 'Nothing to delete in that range.'; return; }
        if (!confirm('Delete ' + entriesWord(n) + ' from ' + fmtDate(from) + ' to ' + fmtDate(to) + '? This cannot be undone. Export a backup first if you might want them.')) return;
        var removed = SH.deleteRange(from, to);
        $('delete-msg').textContent = removed === 0 ? 'Could not delete — browser storage is unavailable.' : 'Deleted ' + entriesWord(removed) + '.';
        renderHistory();
      });
      $('delete-all').addEventListener('click', function () {
        var n = SH.list(null, null).length;
        if (!n) { $('delete-msg').textContent = 'History is already empty.'; return; }
        if (!confirm('Delete ALL ' + entriesWord(n) + ' on this device? This cannot be undone.')) return;
        var removed = SH.deleteAll();
        $('delete-msg').textContent = removed === 0 ? 'Could not delete — browser storage is unavailable.' : 'Deleted ' + entriesWord(removed) + '.';
        renderHistory();
      });
    }

    if (o.lobby) mountLobby();
    return { render: renderHistory };
  }

  root.ParentPanel = { mount: mount, pinGate: pinGate, subjectsFromCards: subjectsFromCards };
})(this);
```

Check the moved code against the old inline script with `git diff`. Only these differences are expected:
1. The PIN keypad is now `pinGate`, and `lock()` calls `gate.reset()`.
2. The subject list comes from `o.subjects`, not a `.subject-card` loop. `savedState` reads `o.subjects` too.
3. `tsAdd` ends with `if (o.onChange) o.onChange();`.
4. The overlay, learner, backup and delete parts run only when `o.lobby` is true.
5. `document` is `doc` and `window` is `root`.
6. The old `window.Wallet` is now `o.wallet`.

`mount` expects a working history (`SH`). When `study-history.js` is missing or broken, the lobby doesn't call `mount`. Instead, it shows its `history-missing` warning (see Step 4).

- [ ] **Step 4: Replace the lobby's inline panel script.** In both `web/lobby/grade-5.html` and `web/lobby/grade-2.html`, replace the whole last inline script, from `<script>` + `(function(){` + `  var PIN = '0108';` down to the final `})();` + `</script>`, with exactly:

```html
<script>
(function(){
  var SH = window.StudyHistory, P = window.ParentPanel;
  if (!P) return;
  if (!SH || !SH.list){
    document.getElementById('parent-open').addEventListener('click', function(){
      document.getElementById('parent-overlay').hidden = false;
      document.getElementById('pin-view').hidden = true;
      document.getElementById('history-view').hidden = false;
      document.getElementById('history-missing').hidden = false;
      document.getElementById('history-body').hidden = true;
    });
    document.getElementById('parent-close').addEventListener('click', function(){ document.getElementById('parent-overlay').hidden = true; });
    return;
  }
  P.mount({ history: SH, wallet: window.Wallet, learner: window.Learner, store: window.Learner ? Learner.storage : localStorage, subjects: P.subjectsFromCards(document), lobby: true });
})();
</script>
```

The `SH.list` check is there because Task 2 makes `StudyHistory` exist (as `{ create }`) even when the history instance failed to build.

Load the new file in both lobbies, after `cloud.js`:

```html
<script src="../engine/parent-panel.js" data-grade="grade5"></script>
```

In the Grade 2 lobby, use `data-grade="grade2"`.

Add `'parent-panel.js'` to the end of `ENGINE_FILES` in `tests/paths.js`. Run `node tools/update-precache.js`.

- [ ] **Step 5: Run all unit tests and the lobby e2e suites.**

```bash
node --test
node tests/e2e/lobby-e2e.js
node tests/e2e/lobby-e2e.js 5
node tests/e2e/backup-e2e.js
node tests/e2e/backup-e2e.js 5
node tests/e2e/file-check-e2e.js
node tests/e2e/migration-e2e.js
```

Expected: all pass. They drive the same element IDs, so a failure means a moved line changed behaviour. Compare the failing step with the old inline code (`git show HEAD:web/lobby/grade-5.html`).

- [ ] **Step 6: Commit (the user runs this).**

```bash
git add web tests && git commit -m "Move the Parent panel into one shared engine file"
```

---

### Task 9: The tablet shop asks on the parent's phone

**Files:**
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html` (shop PIN view HTML, `SHOP_TEXT`, `<script data-shop>`, script tags)
- Test: `tests/english-everywhere.test.js` already checks every Grade 2 shop line has English. `tests/copies.test.js` already checks that the shop script is identical in both lobbies.

- [ ] **Step 1: Load `shop-requests.js` in both lobbies**, right after `wallet.js`:

```html
<script src="../engine/shop-requests.js" data-grade="grade5"></script>
```

In the Grade 2 lobby, use `data-grade="grade2"`.

- [ ] **Step 2: Add the button and the message to the shop PIN view** in both lobbies. Replace:

```html
      <div class="shop-actions"><button class="p-btn" id="shop-cancel" type="button"></button></div>
    </div>

    <div id="shop-done-view" hidden>
```

with:

```html
      <p class="p-note shop-intro" id="shop-phone-msg" aria-live="polite"></p>
      <div class="shop-actions"><button class="p-btn" id="shop-phone" type="button" hidden></button> <button class="p-btn" id="shop-cancel" type="button"></button></div>
    </div>

    <div id="shop-done-view" hidden>
```

- [ ] **Step 3: Add the new texts.** In `web/lobby/grade-5.html`, add these lines to `window.SHOP_TEXT`, after `back: 'Back to the shop'` (put a comma after `'Back to the shop'`):

```js
  phone: "📱 Ask on parent's phone",
  waiting: 'Waiting for a parent… Ask your parent to open the parent page on their phone. The PIN still works here too.',
  declined: 'Your parent said not this time.',
  short: 'Not enough coins now, so nothing was bought.',
  expired: 'That request is too old. Ask again.'
```

In `web/lobby/grade-2.html`, do the same with these lines. Each line is Filipino, a literal `\n`, then English; the button stays English only:

```js
  phone: "📱 Ask on Mommy or Tatay's phone",
  waiting: 'Hinihintay si Mommy o Tatay… Sabihin sa kanila na buksan ang parent page. Puwede pa rin ang PIN dito.\nWaiting for Mommy or Tatay… Ask them to open the parent page. The PIN still works here too.',
  declined: 'Sabi ni Mommy o Tatay, hindi muna ngayon.\nMommy or Tatay said not this time.',
  short: 'Kulang na ang coins mo, kaya walang nabili.\nNot enough coins now, so nothing was bought.',
  expired: 'Luma na ang request na iyan. Humingi ulit.\nThat request is too old. Ask again.'
```

- [ ] **Step 4: Change the shop script.** In `<script data-shop>`, make each change below in both lobbies, so the two scripts stay identical.

a) After `var pending = null, entered = '', shakeT = null;` add:

```js
  var C = window.Cloud, R = window.ShopRequests && W ? ShopRequests.create(STORE, Date.now) : null;
  var asked = null, unwatch = null;
```

b) Replace `function askParent(item){ ... }` with:

```js
  function askParent(item){
    pending = item;
    entered = '';
    drawDots();
    $('shop-ask').textContent = T.ask(label(item), item.coins);
    $('shop-pin-hint').textContent = T.pinHint;
    $('shop-phone-msg').textContent = '';
    $('shop-phone').hidden = !(R && C && C.signedIn());
    show('shop-pin-view');
    $('shop-cancel').focus();
  }
  function stopWaiting(){
    if (unwatch){ unwatch(); unwatch = null; }
    asked = null;
    $('shop-phone-msg').textContent = '';
  }
  function askPhone(){
    if (!pending || !R) return;
    asked = R.ask(pending);
    if (!asked){ $('shop-phone-msg').textContent = T.saveFail; return; }
    $('shop-phone').hidden = true;
    $('shop-phone-msg').textContent = T.waiting;
    unwatch = C.watch(ShopRequests.KEY, function(){ C.sync(); });
    C.sync();
  }
  function cancelAsk(){
    if (asked && R){ R.cancel(asked); C.sync(); }
    stopWaiting();
    backToList();
  }
  // Buys what a parent approved on the phone, after checking the coins again. Runs after every cloud sync,
  // so an answer that comes while the shop is closed is still bought the next time the lobby syncs.
  function settle(){
    if (!R) return;
    var results = R.settle(function(r){
      var item = itemById(r.item), points = readPoints();
      if (!item || !W.canBuy(item.id, points).ok) return 'short';
      if (!W.buy(item.id, points)) return 'short';
      if (SH) SH.purchased(item.id, item.name, item.coins);
      return 'done';
    });
    if (results.length) C.sync();
    var mine = asked ? R.get(asked) : null;
    if (!mine || mine.status === 'waiting' || mine.status === 'approved'){
      if (results.length && overlay.hidden) renderList();
      return;
    }
    var item = itemById(mine.item);
    stopWaiting();
    pending = null;
    var left = W.balance(readPoints());
    $('coin-badge').textContent = T.coins(left);
    if (mine.status === 'done'){
      if (window.Fx) Fx.purchase();
      $('shop-done').textContent = T.done(label(item), left);
    } else {
      $('shop-done').textContent = mine.status === 'declined' ? T.declined : mine.status === 'expired' ? T.expired : T.short;
    }
    show('shop-done-view');
    $('shop-back').focus();
  }
```

c) In `function approve(){`, add this as the first line, so typing the PIN cancels a waiting phone request before buying:

```js
    if (asked && R){ R.cancel(asked); stopWaiting(); C.sync(); }
```

d) In `function closeShop(){`, after `pending = null;`, add the line below. It stops listening but keeps the request, so the parent can still approve it:

```js
    if (unwatch){ unwatch(); unwatch = null; }
    asked = null;
```

e) After `$('shop-back').textContent = T.back;` add:

```js
  $('shop-phone').textContent = T.phone || '';
```

f) Replace `$('shop-cancel').addEventListener('click', backToList);` with:

```js
  $('shop-cancel').addEventListener('click', cancelAsk);
  $('shop-phone').addEventListener('click', askPhone);
  document.addEventListener('cloud-synced', settle);
```

- [ ] **Step 5: Run all unit tests and the lobby e2e suites.**

```bash
node --test
node tests/e2e/lobby-e2e.js
node tests/e2e/lobby-e2e.js 5
```

Expected: all pass. With sync off, `Cloud.signedIn()` is false, so the phone button stays hidden and the shop behaves exactly as before.

- [ ] **Step 6: Commit (the user runs this).**

```bash
git add web && git commit -m "Let a child send a shop request to the parent's phone"
```

---

### Task 10: The phone page

**Files:**
- Create: `web/parent/index.html`, `web/parent/phone.js`, `web/parent/parent.css`, `web/parent/parent.webmanifest`
- Modify: `tools/update-precache.js`, `tests/paths.js`, `tests/pwa.test.js`

- [ ] **Step 1: Write the failing test.** In `tests/paths.js`, add after `LOBBIES`:

```js
// The parent page on the phone (phase 5c): not a lobby, but installable the same way.
const PARENT = { page: 'parent/index.html', manifest: 'parent/parent.webmanifest' };
```

Add `PARENT` to `module.exports`. In `tests/pwa.test.js`, change the import to `const { WEB, LOBBIES, PARENT, web } = require('./paths.js');` and the loop to:

```js
for (const { page, manifest } of [...Object.values(LOBBIES), PARENT]) {
```

Its message `'start_url must open this lobby'` is fine for the parent page too.

Append to `tests/copies.test.js`:

```js
test('the parent page loads the shared panel and its engine files', () => {
  const { web, PARENT } = require('./paths.js');
  const html = fs.readFileSync(web(PARENT.page), 'utf8');
  for (const f of ['storage', 'study-history', 'wallet', 'sync-core', 'firebase-config', 'firebase-remote', 'shop-requests', 'subjects', 'parent-panel']) {
    assert.ok(html.includes('<script src="../engine/' + f + '.js"></script>'), 'parent page does not load ' + f + '.js');
  }
  assert.ok(!html.includes('learner.js'), 'the parent page must not create a learner on the phone');
  assert.ok(html.includes('<script src="phone.js"></script>'));
});
```

- [ ] **Step 2: Run them and check that they fail.**
Run: `node --test tests/pwa.test.js tests/copies.test.js`
Expected: FAIL, the parent page doesn't exist yet.

- [ ] **Step 3: Teach the precache tool about `parent/`.** In `tools/update-precache.js`, change `GROUPS` to:

```js
const GROUPS = [/^index\.html$/, /^lobby\//, /^parent\//, /^engine\//, /^subjects\//, /^assets\//];
```

- [ ] **Step 4: Create `web/parent/parent.webmanifest`:**

```json
{
  "id": "./index.html",
  "name": "Study Games - Parent",
  "short_name": "Parent",
  "description": "See each child's progress, add real test scores and approve shop requests.",
  "start_url": "./index.html",
  "scope": "../",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F4F1E9",
  "theme_color": "#1B7A79",
  "icons": [
    { "src": "../assets/icons/grade5-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "../assets/icons/grade5-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "../assets/icons/grade5-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 5: Create `web/parent/parent.css`** from the Grade 5 lobby's theme and panel rules, plus a few rules for the phone:

```bash
cd /c/Users/ADMIN/IdeaProjects/school && mkdir -p web/parent && node -e "
const fs = require('fs');
const h = fs.readFileSync('web/lobby/grade-5.html', 'utf8');
const theme = h.slice(h.indexOf('<style>') + 8, h.indexOf('  .wrap{'));
const panelEnd = h.indexOf('\n', h.indexOf('  .h-wrong .ans')) + 1;
const panel = h.slice(h.indexOf('  .parent-head{'), panelEnd);
fs.writeFileSync('web/parent/parent.css', '/* The Grade 5 lobby\'s theme and Parent panel look, copied from web/lobby/grade-5.html. */\n' + theme + panel);
"
cat >> web/parent/parent.css <<'EOF'

  /* The parent page only */
  [hidden]{ display:none !important; }
  .phone{ width:100%; max-width:760px; }
  .phone h1{ margin:0 0 4px; font-family:'Baloo 2', system-ui, sans-serif; color:var(--header-accent); font-size:1.6rem; }
  .phone .p-row input{ min-width:0; flex:1 1 180px; }
  .kid-btn{ display:block; width:100%; text-align:left; font-size:1.05rem; padding:14px 16px; margin-bottom:10px; }
  .req{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 0; border-top:1px solid var(--border); }
  .req:first-of-type{ border-top:0; }
  .req-text{ flex:1 1 200px; font-weight:800; overflow-wrap:anywhere; }
  .coins-big{ font-family:'Baloo 2', system-ui, sans-serif; font-size:1.6rem; font-weight:800; margin:0; }
  .pts-list{ display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:6px 14px; margin-top:8px; font-weight:700; }
  .status-line{ margin:0 0 14px; }
  .status-line.error{ color:var(--bad); }
EOF
head -3 web/parent/parent.css && grep -c "h-wrong" web/parent/parent.css
```

Expected: the header comment is printed, and the `h-wrong` count is at least 4.

- [ ] **Step 6: Create `web/parent/index.html`.** The elements inside `<template id="child-template">` use the same IDs `parent-panel.js` looks up in the lobby.

```html
<!DOCTYPE html>
<html lang="en">
<meta charset="utf-8">
<title>Study Games &mdash; Parent</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="manifest" href="parent.webmanifest">
<meta name="theme-color" content="#1B7A79">
<link rel="icon" type="image/png" href="../assets/icons/grade5-192.png">
<link rel="apple-touch-icon" href="../assets/icons/grade5-180.png">
<meta name="apple-mobile-web-app-title" content="Parent">
<meta name="mobile-web-app-capable" content="yes">
<script data-pwa>
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', function(){ navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function(){}); });
}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="parent.css">

<div class="phone">
  <div class="parent-head">
    <h1>🔒 Parent</h1>
    <button class="p-btn" id="signout" type="button" hidden>Sign out</button>
  </div>
  <p class="p-note status-line" id="status" aria-live="polite">Loading…</p>

  <div id="signin-view" class="p-section" hidden>
    <h3>☁️ Sign in</h3>
    <p class="p-note">Use the family login, the same one as on the tablets. This phone remembers it.</p>
    <div class="p-row">
      <input type="email" id="signin-email" autocomplete="username" placeholder="Family email">
      <input type="password" id="signin-pass" autocomplete="current-password" placeholder="Password">
      <button class="p-btn" type="button" id="signin-go">Sign in</button>
    </div>
    <p class="p-note" id="signin-msg"></p>
  </div>

  <div id="pin-view" hidden>
    <p class="pin-hint" id="pin-hint">Enter the parent PIN</p>
    <div class="pin-dots" id="pin-dots"><span></span><span></span><span></span><span></span></div>
    <div class="pin-pad" id="pin-pad">
      <button type="button">1</button><button type="button">2</button><button type="button">3</button>
      <button type="button">4</button><button type="button">5</button><button type="button">6</button>
      <button type="button">7</button><button type="button">8</button><button type="button">9</button>
      <button type="button" data-key="clear" aria-label="Delete digit">⌫</button><button type="button">0</button><span></span>
    </div>
  </div>

  <div id="pick-view" class="p-section" hidden>
    <h3>Which child?</h3>
    <div id="kids"></div>
  </div>

  <div id="child-view" hidden>
    <div class="p-row status-line">
      <button class="p-btn" type="button" id="switch-child">↩ Children</button>
      <button class="p-btn" type="button" id="refresh">↻ Refresh</button>
    </div>
    <div id="child"></div>
  </div>
</div>

<template id="child-template">
  <div class="p-section" id="requests" hidden></div>
  <div class="p-section" id="recent" hidden></div>
  <div class="p-section">
    <h3 id="kid-name"></h3>
    <p class="coins-big" id="kid-coins"></p>
    <div class="pts-list" id="kid-points"></div>
  </div>

  <div class="p-warn" id="history-full" hidden>History storage is full.</div>
  <div class="p-section">
    <div class="p-row" id="range-buttons">
      <button class="p-btn" type="button" data-range="today">Today</button>
      <button class="p-btn on" type="button" data-range="7">Last 7 days</button>
      <button class="p-btn" type="button" data-range="30">Last 30 days</button>
      <button class="p-btn" type="button" data-range="all">All</button>
      <button class="p-btn" type="button" data-range="custom">Custom</button>
    </div>
    <div class="p-row" id="custom-range" hidden>
      <label>From <input type="date" id="range-from"></label>
      <label>To <input type="date" id="range-to"></label>
    </div>
    <p class="p-note" id="range-msg"></p>
    <div class="p-row">
      <label>Subject <select id="subject-filter"><option value="">All subjects</option></select></label>
    </div>
  </div>
  <div class="p-section"><div class="h-summary" id="hist-summary"></div></div>
  <div class="p-section" id="weak-spots"></div>

  <div class="p-section" id="test-score">
    <h3>📝 Real test score</h3>
    <div class="p-row">
      <label>Subject <select id="ts-subject"></select></label>
      <label>Test <input type="text" id="ts-name" maxlength="60" placeholder="e.g. Science ST1"></label>
    </div>
    <div class="p-row">
      <label>Score <input type="number" id="ts-score" min="0" step="1" inputmode="numeric"></label>
      <label>out of <input type="number" id="ts-total" min="1" step="1" inputmode="numeric"></label>
      <button class="p-btn" type="button" id="ts-add" disabled>Add coins</button>
    </div>
    <p class="p-note">100% = 50 coins · 90% or more = 40 · 80% or more = 30 · below 80% = 10 for trying.</p>
    <p class="p-note" id="ts-msg"></p>
  </div>

  <div class="p-section" id="hist-list"></div>
</template>

<script src="../engine/storage.js"></script>
<script src="../engine/study-history.js"></script>
<script src="../engine/wallet.js"></script>
<script src="../engine/sync-core.js"></script>
<script src="../engine/firebase-config.js"></script>
<script src="../engine/firebase-remote.js"></script>
<script src="../engine/shop-requests.js"></script>
<script src="../engine/subjects.js"></script>
<script src="../engine/parent-panel.js"></script>
<script src="phone.js"></script>
```

- [ ] **Step 7: Create `web/parent/phone.js`:**

```js
/* The parent page on the phone. Sign in once, type the PIN on every open, pick a child, then see and act on her
   data. The phone is one more synced device: the child is pulled into memory, changed with the same engine
   files as the tablets, and synced back. Nothing is kept on the phone. */
(function () {
  'use strict';

  var FR = window.FirebaseRemote, Core = window.SyncCore, P = window.ParentPanel;
  var LOCK_AFTER_MS = 5 * 60 * 1000;
  var VIEWS = ['signin-view', 'pin-view', 'pick-view', 'child-view'];
  var STATUS_TEXT = {
    approved: 'Approved · waiting for the tablet to buy it',
    done: '✅ Bought on the tablet',
    short: '⚠️ Not enough coins, nothing was bought',
    declined: 'You said no',
    cancelled: 'Cancelled on the tablet',
    expired: 'Too old, nobody answered that day'
  };
  var $ = function (id) { return document.getElementById(id); };
  var user = null, unlocked = false, hiddenAt = 0, child = null, syncing = null, again = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function show(view) { VIEWS.forEach(function (id) { $(id).hidden = id !== view; }); }
  function setStatus(text, error) {
    $('status').textContent = text;
    $('status').classList.toggle('error', !!error);
  }
  function time(ms) { return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function label(l) {
    var p = l.profile || {};
    return (p.emoji ? p.emoji + ' ' : '') + (p.name || 'No name yet') + ' · Grade ' + (p.grade || '?');
  }
  function offline() { setStatus('No internet, or the cloud could not be reached. Try again when online.', true); }

  function chime() {
    try {
      var a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.6);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + 0.6);
    } catch (e) {}
  }

  // ---- sign in, PIN, child picker ----
  function route() {
    if (!user) { closeChild(); show('signin-view'); setStatus(''); $('signout').hidden = true; return; }
    $('signout').hidden = false;
    if (!unlocked) { closeChild(); gate.reset(); show('pin-view'); setStatus('Signed in as ' + (user.email || 'the family login') + '.'); return; }
    if (!child) pick();
  }

  var gate = P.pinGate({ dots: $('pin-dots'), pad: $('pin-pad'), hint: $('pin-hint'), hintText: 'Enter the parent PIN', onUnlock: function () { unlocked = true; route(); } });

  function pick() {
    show('pick-view');
    setStatus('Loading the children…');
    FR.remote(user.uid).learners().then(function (list) {
      var kids = list.filter(function (l) { return l.profile && Number(l.profile.grade); })
        .sort(function (a, b) { return Number(b.profile.grade) - Number(a.profile.grade); });
      var box = $('kids');
      box.textContent = '';
      if (!kids.length) { setStatus('No child has synced yet. Sign in on a tablet first (Parent, then Cloud backup).'); return; }
      setStatus('');
      if (kids.length === 1) { openChild(kids[0]); return; }
      kids.forEach(function (l) {
        var b = el('button', 'p-btn kid-btn', label(l));
        b.type = 'button';
        b.addEventListener('click', function () { openChild(l); });
        box.appendChild(b);
      });
    }, offline);
  }

  // ---- one child ----
  function openChild(l) {
    closeChild();
    var grade = Number(l.profile.grade), g = 'grade' + grade;
    var remote = FR.remote(user.uid), space = StudyStore.memorySpace(l.id), core = Core.create(space, remote, l.id);
    setStatus('Loading ' + label(l) + '…');
    core.sync().then(function () {
      var c = {
        learner: l, grade: grade, space: space, core: core, seen: {}, loaded: false,
        subjects: window.Subjects[grade] || [],
        history: StudyHistory.create(space, Date.now, g),
        wallet: Wallet.create(space, Date.now, g),
        requests: ShopRequests.create(space, Date.now)
      };
      child = c;
      var box = $('child');
      box.textContent = '';
      box.appendChild($('child-template').content.cloneNode(true));
      c.panel = P.mount({ history: c.history, wallet: c.wallet, store: space, subjects: c.subjects, lobby: false, onChange: sync });
      c.unwatch = remote.watch(l.id, ShopRequests.KEY, function () { sync(); });
      show('child-view');
      render();
      setStatus('Synced at ' + time(Date.now()) + '.');
    }, offline);
  }
  function closeChild() {
    if (child && child.unwatch) child.unwatch();
    child = null;
    $('child').textContent = '';
  }

  function sync() {
    if (!child) return Promise.resolve();
    if (syncing) { again = true; return syncing; }
    var c = child;
    syncing = c.core.sync().then(function () {
      if (child === c) { render(); setStatus('Synced at ' + time(Date.now()) + '.'); }
    }, function () {
      setStatus('Could not reach the cloud. What you see may be out of date; tap Refresh to try again.', true);
    }).then(function () {
      syncing = null;
      if (again) { again = false; sync(); }
    });
    return syncing;
  }

  function render() {
    renderRequests();
    renderRecent();
    renderCoins();
    child.panel.render();
  }

  function renderRequests() {
    var box = $('requests'), list = child.requests.waiting(), fresh = false;
    box.textContent = '';
    box.hidden = !list.length;
    if (list.length) box.appendChild(el('h3', '', '🛒 Waiting for you'));
    list.forEach(function (r) {
      if (!child.seen[r.id]) { child.seen[r.id] = true; fresh = true; }
      var row = el('div', 'req');
      row.appendChild(el('div', 'req-text', (r.emoji ? r.emoji + ' ' : '') + r.name + ' · ' + r.coins + ' coins · asked ' + time(r.t)));
      var yes = el('button', 'p-btn on', 'Approve'), no = el('button', 'p-btn', 'No');
      yes.type = 'button';
      no.type = 'button';
      yes.addEventListener('click', function () { answer(r.id, true); });
      no.addEventListener('click', function () { answer(r.id, false); });
      row.appendChild(yes);
      row.appendChild(no);
      box.appendChild(row);
    });
    if (fresh && child.loaded) chime();
    child.loaded = true;
  }

  function renderRecent() {
    var today = new Date().toDateString();
    var list = child.requests.list().filter(function (r) { return r.status !== 'waiting' && new Date(r.t).toDateString() === today; });
    var box = $('recent');
    box.textContent = '';
    box.hidden = !list.length;
    if (!list.length) return;
    box.appendChild(el('h3', '', 'Today\'s shop requests'));
    list.forEach(function (r) {
      box.appendChild(el('div', 'req', time(r.t) + ' · ' + (r.emoji ? r.emoji + ' ' : '') + r.name + ' — ' + (STATUS_TEXT[r.status] || r.status)));
    });
  }

  function answer(id, yes) {
    if (!child.requests.answer(id, yes)) { setStatus('That request was already answered or is too old.', true); render(); return; }
    render();
    sync();
  }

  function renderCoins() {
    var points = {}, total = 0, list = $('kid-points');
    list.textContent = '';
    child.subjects.forEach(function (s) {
      var n = parseInt(child.space.getItem(s.pointsKey), 10) || 0;
      points[s.pointsKey] = n;
      total += n;
      list.appendChild(el('div', '', s.title + ' ⭐ ' + n));
    });
    var coins = child.wallet.balance(points);
    $('kid-name').textContent = label(child.learner);
    $('kid-coins').textContent = '🪙 ' + coins + (coins === 1 ? ' coin' : ' coins') + ' · ⭐ ' + total + ' points';
  }

  // ---- buttons and lifecycle ----
  $('signin-go').addEventListener('click', function () {
    var email = $('signin-email').value.trim(), pass = $('signin-pass').value;
    $('signin-msg').textContent = 'Signing in…';
    FR.signIn(email, pass).then(function () { $('signin-msg').textContent = ''; }, function (e) { $('signin-msg').textContent = FR.signInError(e); });
  });
  $('signout').addEventListener('click', function () { unlocked = false; FR.signOut(); });
  $('switch-child').addEventListener('click', function () { closeChild(); pick(); });
  $('refresh').addEventListener('click', function () { setStatus('Syncing…'); sync(); });
  document.addEventListener('keydown', function (ev) {
    if ($('pin-view').hidden) return;
    if (/^[0-9]$/.test(ev.key)) gate.press(ev.key);
    else if (ev.key === 'Backspace') gate.press('clear');
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (unlocked && Date.now() - hiddenAt > LOCK_AFTER_MS) { unlocked = false; route(); return; }
    if (child) sync();
  });
  window.addEventListener('online', function () { if (child) sync(); else if (user && unlocked) pick(); });

  if (location.protocol === 'file:') { setStatus('Open this page from the website, not as a file.', true); return; }
  FR.onAuth(function (u) { user = u; route(); }).catch(offline);
})();
```

- [ ] **Step 8: Add the page's files to the precache, then run all tests.**

```bash
node tools/update-precache.js
node --test
```

Expected: all pass, including the PWA test for `parent/index.html` and the new copies test.

- [ ] **Step 9: Check it by hand in a browser.** Serve with `npx -y http-server web -p 8765 -s` and open `http://localhost:8765/parent/index.html` at phone width (in DevTools, a 390×844 device). Check:
  - The sign-in form shows, and a wrong password gives "Wrong email or password."
  - The console shows no errors.
  - There's no horizontal scrolling at 390 px wide.

  The real sign-in is checked in Task 11 by the parent, who has the password.

- [ ] **Step 10: Commit (the user runs this).**

```bash
git add web tools tests && git commit -m "Add the parent page for the phone"
```

---

### Task 11: Live check with the parent, then docs

- [ ] **Step 1: Ask the user to push** (`git push`). This publishes through GitHub Pages in 1–2 minutes. Then walk them through these checks on the live site, one at a time. Never ask for the family password.
  1. On the phone, open `https://aspect-study.github.io/school/parent/`, sign in, and type the PIN. Both children appear. Open each one: coins, points per subject and history should match that child's tablet lobby.
  2. On the phone, add a real test score (for example "Check 1", 10/10, 50 coins). Within about 2 minutes (or after Sync now), the tablet's coin badge goes up by 50, and the score shows in the tablet's history.
  3. On the tablet, open the Shop, pick a reward, and tap **📱 Ask on parent's phone**. The phone, with the parent page open on that child, chimes and shows the request. Tap Approve. Within seconds, the tablet shows "🎉 Approved!" with the cha-ching, and the coins go down. The phone's "Today's shop requests" says "✅ Bought on the tablet".
  4. Ask again, and tap **No** on the phone. The tablet says "Your parent said not this time." No coins are spent.
  5. Ask again, then type the PIN on the tablet instead. It buys at once, and the phone shows "Cancelled on the tablet".
  6. On the phone, put the page in the background for over 5 minutes and come back. It asks for the PIN again.

  If any check fails, use superpowers:systematic-debugging before changing code.

- [ ] **Step 2: Update the docs.**
  - `README.md`: add the parent page address next to the two lobby addresses. In the files table, add `web/parent/` and the new engine files (`firebase-remote.js`, `shop-requests.js`, `subjects.js`, `parent-panel.js`).
  - `docs/superpowers/specs/2026-10-02-parent-view-design.md`: set the Status line to "Built 2026-MM-DD; live-checked with the parent", using the real date.
  - The project memory (`project-structure.md` in the memory folder): phase 5c is built; the phone is one more device, with shop requests answered on the phone and bought on the tablet.

- [ ] **Step 3: Commit (the user runs this).**

```bash
git add README.md docs && git commit -m "Document the parent page"
```
