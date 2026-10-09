# Date Guard and Coin Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **The user runs every commit.** Never run `git commit` or any git command that changes the index or working tree. Skip each "Commit" step except to show the commands. No `Co-Authored-By` lines.

**Goal:** Moving the tablet's clock back pauses all points and coins. Coins come at 20 points each (was 10), without lowering any balance, and new medals pay 3 / 5 / 10 coins.

**Architecture:** A new engine file `clock.js` (global `Clock`) remembers the latest time the device has seen. `Clock.paused()` is checked at four choke points: `kit.answer` (points), `Recall` (boxes), `Wallet.addBonus` (every coin reward) and nothing else. The wallet gets a per-key `rateFrom` snapshot, so points before the switch keep the old rate. `Mastery.update` pays medal coins through a `bonus` dependency, saving the mark first and taking it back if the pay fails, instead of handing points to the game.

**Tech Stack:** Plain HTML/JS, no build step. `node --test` for unit tests, and headless-Chrome e2e in `tests/e2e/*.js`.

**Spec:** `docs/superpowers/specs/2026-10-04-date-guard-and-coin-milestones-design.md`

---

## Background the engineer needs

- The site is `web/`. Engine files are in `web/engine/`. Copy the pattern of `web/engine/quests.js` or `boss.js`: an IIFE that exports under Node and otherwise creates a global, reading `data-grade` from `document.currentScript`.
- Games: `web/subjects/grade-N/<subject>/index.html` (17). Lobbies: `web/lobby/grade-5.html`, `grade-2.html`. The parent phone page is `web/parent/` and does not get the clock.
- `tests/paths.js` has `ENGINE_FILES`, `APPS`, `appFile(id)`, `lobbyFile(grade)` and `engineFile(name)`. After adding a file under `web/`, run `node tools/update-precache.js`, because `tests/pwa.test.js` enforces it.
- Learner storage is `Learner.storage`, which is synced. Raw `localStorage` is per device and not synced; the sync only reads learner spaces.
- Grade 2 text must pair any Filipino with English (`tests/english-everywhere.test.js`).
- Edits that touch many game files: write a one-off node script to the scratchpad `C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN-IdeaProjects-school\715fe93e-2caf-47f9-adda-cd2b15e46008\scratchpad` (not the repo). Each replacement must match exactly once or it throws. Bash heredocs with emoji or backslashes have broken here before, so write files with the Write tool.
- The user has unrelated staged changes in `tests/read-gate.test.js`, `web/engine/fx.js` and `web/engine/read-gate.js`. Do not touch them. The weekly boss work is also uncommitted in the tree; leave it alone except where a task says otherwise.

---

### Task 1: `clock.js`

**Files:**
- Create: `web/engine/clock.js`
- Create: `tests/clock.test.js`
- Modify: `tests/paths.js` (add `'clock.js'` to ENGINE_FILES right after `'learner.js'`)
- Modify: `web/sw.js` (via `node tools/update-precache.js`)

- [ ] **Step 1: Write the failing tests** in `tests/clock.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, KEY, SLACK, TEXT } = require(engineFile('clock.js'));

function memory() {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}
function world(start) {
  let t = start || Date.UTC(2026, 9, 4, 2);
  const now = () => t;
  now.add = (ms) => { t += ms; };
  const s = memory();
  return { s, now, c: create(s, now) };
}
const HOUR = 3600000;

test('one hour of slack', () => {
  assert.equal(KEY, 'clock_seen_v1');
  assert.equal(SLACK, HOUR);
});

test('a fresh device is not paused, and the latest time seen rises with the clock', () => {
  const w = world();
  assert.equal(w.c.paused(), false);
  assert.equal(Number(w.s.data[KEY]), w.now());
  w.now.add(5 * HOUR);
  assert.equal(w.c.paused(), false);
  assert.equal(Number(w.s.data[KEY]), w.now());
});

test('a small step back is fine; more than an hour back pauses until the clock catches up', () => {
  const w = world();
  w.c.paused();
  w.now.add(-59 * 60000);
  assert.equal(w.c.paused(), false, '59 minutes back');
  w.now.add(-2 * HOUR);
  assert.equal(w.c.paused(), true, 'about 3 hours back');
  const seen = w.s.data[KEY];
  assert.equal(w.c.paused(), true);
  assert.equal(w.s.data[KEY], seen, 'a paused check never lowers the latest time');
  w.now.add(3 * HOUR);
  assert.equal(w.c.paused(), false, 'caught up');
});

test('the parent fix makes now the latest time', () => {
  const w = world();
  w.c.paused();
  w.now.add(-48 * HOUR);
  assert.equal(w.c.paused(), true);
  w.c.fix();
  assert.equal(w.c.paused(), false);
});

test('broken storage never pauses', () => {
  const now = () => 1000;
  const c = create({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } }, now);
  assert.equal(c.paused(), false);
  const junk = create({ getItem: () => 'soon', setItem() {} }, now);
  assert.equal(junk.paused(), false);
});

test('the banner text', () => {
  assert.match(TEXT.grade5.banner, /^⏰ The tablet's date is earlier than before\. Points and coins are paused until the date is right\.$/);
  assert.match(TEXT.grade2.banner, / · The tablet's date is earlier than before/);
});
```

- [ ] **Step 2: Run them to make sure they fail.** Run `node --test tests/clock.test.js` and expect `Cannot find module`.

- [ ] **Step 3: Write `web/engine/clock.js`:**

```js
/* Loaded right after learner.js by both lobbies and every game. The pages are decoded as UTF-8, so the text can hold emoji.
   The date guard: this device remembers the latest time it has seen. When the clock reads more than an hour earlier,
   points and coins pause, so moving the date back can never earn rewards. It lives in the device's own storage, never
   synced: two tablets' clocks never agree to the second. */
(function (root) {
  'use strict';

  var KEY = 'clock_seen_v1';
  var SLACK = 3600000;

  var TEXT = {
    grade5: { banner: '⏰ The tablet\'s date is earlier than before. Points and coins are paused until the date is right.' },
    grade2: { banner: '⏰ Mali ang petsa ng tablet. Hihinto muna ang points at coins. · The tablet\'s date is earlier than before. Points and coins are paused until the date is right.' }
  };

  function create(storage, now) {
    // null when storage cannot be read: a guard that cannot remember must never block her.
    function seen() {
      var raw;
      try { raw = storage.getItem(KEY); } catch (e) { return null; }
      var v = Number(raw);
      return isFinite(v) && v > 0 ? v : 0;
    }
    function save(t) { try { storage.setItem(KEY, String(t)); } catch (e) {} }

    return {
      paused: function () {
        var s = seen(), t = now();
        if (s === null) return false;
        if (t < s - SLACK) return true;
        if (t > s) save(t);
        return false;
      },
      fix: function () { save(now()); }
    };
  }

  var CSS = '.clock-banner{margin:0;padding:10px 16px;background:#FFE9E9;color:#7A1C1C;font-weight:800;text-align:center;line-height:1.4;}';

  function showBanner(doc, text) {
    function put() {
      if (!doc.body || doc.getElementById('clock-banner')) return;
      var style = doc.createElement('style');
      style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
      var b = doc.createElement('p');
      b.id = 'clock-banner';
      b.className = 'clock-banner';
      b.setAttribute('role', 'status');
      b.textContent = text;
      doc.body.insertBefore(b, doc.body.firstChild);
    }
    if (doc.body) put();
    else doc.addEventListener('DOMContentLoaded', put);
  }

  var exported = { create: create, KEY: KEY, SLACK: SLACK, TEXT: TEXT };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = create(root.localStorage, Date.now);
    if (api.paused() && grade && TEXT[grade]) showBanner(root.document, TEXT[grade].banner);
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Clock = api;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Run `node --test tests/clock.test.js`.** Every test should pass.

- [ ] **Step 5: Register the file.** Add `'clock.js'` after `'learner.js'` in `ENGINE_FILES` (`tests/paths.js`), run `node tools/update-precache.js`, then run `node --test`. Everything should pass.

- [ ] **Step 6: Commit (the user runs it).**

```bash
git add web/engine/clock.js tests/clock.test.js tests/paths.js web/sw.js
git commit -m "Add the date guard engine: each tablet remembers the latest time it has seen and pauses rewards when the clock reads more than an hour earlier"
```

---

### Task 2: The pause gates

**Files:**
- Modify: `web/engine/study-kit.js` (`answer`)
- Modify: `web/engine/recall.js` (`create` gains a `paused` parameter; `points`, `missed`, `gradeSkill`; the browser mount)
- Modify: `web/engine/wallet.js` (`create` gains a `paused` parameter; `addBonus`; the browser mount)
- Test: `tests/study-kit.test.js`, `tests/recall.test.js`, `tests/wallet.test.js`

- [ ] **Step 1: Write the failing tests.**

In `tests/recall.test.js` (the helpers `memory`, `clock`, `info`, `pool`, `setItem` and `items` exist):

```js
test('while the date guard is on, answers leave the boxes alone and pay nothing', () => {
  const s = memory(), p = pool(2);
  setItem(s, 'a', p[0], 2, '2026-10-01');
  let paused = true;
  const r = create(s, clock(2026, 10, 2), 'grade5', undefined, () => paused);
  const before = s.data.review_v1;
  r.begin([p[0]], keyOf('a', info(p[0])));
  assert.equal(r.points(false, 10, 0), 0);
  r.begin([p[1]], keyOf('a', info(p[1])));
  r.missed();
  assert.equal(r.gradeSkill('a', 'x', 3, 3), 0);
  assert.equal(s.data.review_v1, before, 'no box moved');
  assert.equal(r.resultLine(), '', 'nothing counted as moved');
  paused = false;
  r.begin([p[0]], keyOf('a', info(p[0])));
  assert.ok(r.points(false, 10, 0) > 10, 'back to normal: due, so points plus the gap bonus');
});
```

In `tests/wallet.test.js` (`memStorage` and `makeClock` exist):

```js
test('while the date guard is on, no bonus coins are added', () => {
  const storage = memStorage(), clock = makeClock();
  let paused = true;
  const w = create(storage, clock.now, 'grade5', () => paused);
  assert.equal(w.addBonus(10), false);
  assert.equal(storage.data.wallet_v1, undefined);
  paused = false;
  assert.equal(w.addBonus(10), true);
  assert.equal(JSON.parse(storage.data.wallet_v1).bonus, 10);
});
```

In `tests/study-kit.test.js`, read how the existing tests build the fake `win` for `start(opts, win, now)`, and add one test in that style. Give the window `Clock: { paused: () => true }`, answer correctly, and assert that `kit.answer(true, {})` returns 0, `kit.totalPoints()` is unchanged and the points key was not raised.

- [ ] **Step 2: Run `node --test tests/recall.test.js tests/wallet.test.js tests/study-kit.test.js`.** The three new tests should fail.

- [ ] **Step 3: Implement.**

In `web/engine/recall.js`:
- Change `function create(storage, now, grade, plain) {` to `function create(storage, now, grade, plain, paused) {` and add on the next lines:
  ```js
      paused = paused || function () { return false; };
  ```
- In `points`, make the first line `if (paused()) return 0;`.
- In `missed`, make the first line `if (paused()) return;`.
- In `gradeSkill`, make the first line `if (paused()) return 0;`.
- In the browser mount at the bottom, pass a fifth argument to `create`:
  ```js
      script ? script.getAttribute('data-grade') : null, SH && SH.plain, function () { return !!(root.Clock && root.Clock.paused()); }));
  ```

In `web/engine/wallet.js`:
- Change `function create(storage, now, grade) {` to `function create(storage, now, grade, paused) {`, and add `paused = paused || function () { return false; };`.
- In `addBonus`, add `if (paused()) return false;` after the integer check.
- Where the browser mount creates the wallet for the page, pass `function () { return !!(root.Clock && root.Clock.paused()); }` as the fourth argument. Leave `savedBalance` (which calls `create` with a fake storage) and any other `create` calls as they are.

In `web/engine/study-kit.js` `answer`, after `if (!o.helped && o.extra) pts += o.extra;` add:
```js
          if (win.Clock && win.Clock.paused()) pts = 0;
```

- [ ] **Step 4: Run `node --test`.** Everything should pass.

- [ ] **Step 5: Commit (the user runs it).**

```bash
git add web/engine/study-kit.js web/engine/recall.js web/engine/wallet.js tests/study-kit.test.js tests/recall.test.js tests/wallet.test.js
git commit -m "Pause points, review boxes and bonus coins while the tablet's clock reads earlier than before"
```

---

### Task 3: Load the guard everywhere, and the parent fix

**Files:**
- Modify: all 17 game pages and both lobbies (the `clock.js` tag), through a scratchpad script
- Modify: `web/lobby/grade-5.html` and `web/lobby/grade-2.html` (`#clock-section` in the Parent panel)
- Modify: `web/engine/parent-panel.js` (wire the section)
- Create: `tests/clock-wiring.test.js`

- [ ] **Step 1: Write the failing test** `tests/clock-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;

for (const app of APPS) {
  test(app.id + ' loads the date guard right after learner.js', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const learner = '<script src="../../../engine/learner.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, learner + '\n<script src="../../../engine/clock.js" data-grade="grade' + app.grade + '"></script>'), 1);
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby loads the date guard and offers the parent fix', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const learner = '<script src="../engine/learner.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, learner + '\n<script src="../engine/clock.js" data-grade="grade' + grade + '"></script>'), 1);
    assert.equal(count(html, '<div class="p-section" id="clock-section" hidden>'), 1);
    assert.equal(count(html, '<button class="p-btn" type="button" id="clock-fix">The date is right now</button>'), 1);
  });
}

test('the parent panel wires the date fix', () => {
  const js = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'engine', 'parent-panel.js'), 'utf8');
  assert.equal(count(js, "$('clock-section').hidden = !(root.Clock && root.Clock.paused());"), 1);
  assert.equal(count(js, 'root.Clock.fix();'), 1);
});
```

Before writing the last test, check what the global object is called inside `parent-panel.js` (for example `root` or `window`). Use the same name in the code and in this test.

- [ ] **Step 2: Run `node --test tests/clock-wiring.test.js`.** Every test should fail.

- [ ] **Step 3: Add the script tags.** Write a scratchpad script that, for every game page (`APPS` / `appFile`) and both lobbies (`LOBBIES` / `lobbyFile`), finds the exact `learner.js` tag line and inserts the `clock.js` tag with the same `src` prefix and `data-grade` on the next line, matching exactly once. Run it from the repo root.

- [ ] **Step 4: Add the Parent panel section.** In each lobby, add this right before `<div class="p-section" id="test-score">`, with the same indentation:

```html
        <div class="p-section" id="clock-section" hidden>
          <h3>📅 Tablet date</h3>
          <p class="p-note">The tablet's date looks earlier than the last time it was used, so points and coins are paused. If today's date and time are right, tap the button.</p>
          <button class="p-btn" type="button" id="clock-fix">The date is right now</button>
          <p class="p-note" id="clock-msg"></p>
        </div>
```

In `web/engine/parent-panel.js`, find where the panel shows its sections after the PIN (next to the `$('test-score').hidden = …` line) and add:

```js
    $('clock-section').hidden = !(root.Clock && root.Clock.paused());
```

Where the other buttons are wired once, add:

```js
    $('clock-fix').addEventListener('click', function () {
      root.Clock.fix();
      $('clock-msg').textContent = 'Done. Points and coins are back on.';
    });
```

Use the file's own global name if it isn't `root`, and update the test to match. If `$` returns null when the element is missing (the phone page has no such section), guard both additions so the phone page never throws: check what `$` does in that file and follow its pattern.

- [ ] **Step 5: Run `node --test`.** Everything should pass. Then run `node tests/e2e/lobby-e2e.js` and `node tests/e2e/file-check-e2e.js`. Both should pass.

- [ ] **Step 6: Commit (the user runs it).**

```bash
git add web/subjects web/lobby web/engine/parent-panel.js tests/clock-wiring.test.js
git commit -m "Load the date guard in every game and lobby, with a parent fix button when the tablet date was set back"
```

---

### Task 4: 20 points per coin, keeping old points at the old rate

**Files:**
- Modify: `web/engine/wallet.js` (rate, `rateFrom`, `track`, balance, `earned`, the coin guide text)
- Modify: `web/engine/sync-core.js` (`MERGE.wallet`, and the wallet branches of `readLocal` / `writeLocal`)
- Modify: `web/lobby/grade-5.html` and `web/lobby/grade-2.html` (shop `intro`)
- Test: `tests/wallet.test.js`, `tests/sync.test.js`, plus any test that breaks because of the new rate

- [ ] **Step 1: Write the failing tests** in `tests/wallet.test.js`:

```js
test('the switch to 20 points a coin never lowers a balance', () => {
  const { storage, w } = setup();
  w.track({ lifelab_points_v1: 400 });
  assert.equal(w.balance({ lifelab_points_v1: 400 }), 40 + 40, 'the 400 old points keep 10 a coin');
  assert.deepEqual(JSON.parse(storage.data.wallet_v1).rateFrom, { lifelab_points_v1: 400 });
  assert.equal(w.balance({ lifelab_points_v1: 440 }), 40 + 40 + 2, '40 new points = 2 coins');
  assert.equal(w.earned({ lifelab_points_v1: 440 }).coins, 42);
  w.track({ lifelab_points_v1: 440, newgame_points_v1: 100 });
  assert.equal(w.balance({ lifelab_points_v1: 440, newgame_points_v1: 160 }), 40 + 42 + 3, 'a key first seen after the switch is all new rate');
});

test('a wallet the lobby has not opened since the update keeps the old rate', () => {
  const { storage, clock } = setup();
  storage.data.wallet_v1 = JSON.stringify({ v: 1, baselines: { lifelab_points_v1: 0 }, spent: 0, bonus: 0, purchases: [], oldPointsCounted: true });
  const w = create(storage, clock.now, 'grade5');
  assert.equal(w.balance({ lifelab_points_v1: 400 }), 80);
  assert.equal(w.balanceStored(), 40, 'balanceStored reads the stored points (none here)');
});
```

In `tests/sync.test.js`:

```js
test('wallet: the rate switch points merge to the higher number per key, in either order', () => {
  const a = { baselines: { x: 0 }, purchases: [], oldPointsCounted: true, rateFrom: { x: 400, y: 10 } };
  const b = { baselines: { x: 0 }, purchases: [], oldPointsCounted: true, rateFrom: { x: 420 } };
  assert.deepEqual(MERGE.wallet(a, b).rateFrom, { x: 420, y: 10 });
  assert.deepEqual(MERGE.wallet(b, a).rateFrom, { x: 420, y: 10 });
  assert.equal(MERGE.wallet({ baselines: {}, purchases: [] }, { baselines: {}, purchases: [] }).rateFrom, null, 'still missing when both lack it');
});
```

Also extend the existing wallet sync round-trip test (around line 75, which writes a `wallet_v1` and syncs it to a second device). Add `rateFrom: { riseshine_points_v1: 100 }` to the written wallet and assert that it arrives on the second device.

- [ ] **Step 2: Run `node --test tests/wallet.test.js tests/sync.test.js`.** The new tests should fail.

- [ ] **Step 3: Implement the rate.** In `web/engine/wallet.js`:

```js
  var POINTS_PER_COIN = 20;
  // The rate before 2026-10-04. Points earned before a wallet switched keep it, so no balance ever drops.
  var OLD_POINTS_PER_COIN = 10;
```

- `fresh()` gains `rateFrom: null`.
- `read()` gains `rateFrom: d.rateFrom && typeof d.rateFrom === 'object' && !Array.isArray(d.rateFrom) ? d.rateFrom : null`.
- Replace the coin part of `balanceOf` and `earned` with a shared function:

```js
    // Per key: points up to the switch (rateFrom) convert at the old rate, points after it at the new one. With no
    // rateFrom yet (the lobby has not opened since the update), everything still converts at the old rate.
    function coinsFrom(state, points) {
      var old = 0, fresh = 0, rf = state.rateFrom;
      Object.keys(points || {}).forEach(function (key) {
        if (!own(state.baselines, key)) return;
        var p = Number(points[key]) || 0, b = Number(state.baselines[key]) || 0;
        var r = !rf ? Infinity : own(rf, key) ? Math.max(b, Number(rf[key]) || 0) : b;
        old += Math.max(0, Math.min(p, r) - b);
        fresh += Math.max(0, p - Math.max(b, r));
      });
      return Math.floor(old / OLD_POINTS_PER_COIN) + Math.floor(fresh / POINTS_PER_COIN);
    }
```

  `balanceOf` becomes `Math.max(0, WELCOME_GIFT + coinsFrom(state, points) + state.bonus - state.spent)`, and `earned` returns `coins: coinsFrom(state, points)`. `newPoints` stays as it is for the `points` field.
- In `track`, after the existing loops and before `if (changed) write(state);`:

```js
        // The switch to 20 points a coin (2026-10-04): what each key holds now keeps the old rate.
        if (!state.rateFrom) {
          state.rateFrom = {};
          Object.keys(points || {}).forEach(function (key) {
            if (own(state.baselines, key)) state.rateFrom[key] = Number(points[key]) || 0;
          });
          changed = true;
        }
```

- Export `OLD_POINTS_PER_COIN` and `POINTS_PER_COIN` with the other exports if tests need them.

- [ ] **Step 4: Sync.** In `web/engine/sync-core.js`:
  - `readLocal` (wallet branch) returns `rateFrom: w.rateFrom || null` as well.
  - `writeLocal` (wallet branch) sets `w.rateFrom = value.rateFrom || null;`.
  - `MERGE.wallet` adds:

```js
      var rateFrom = null;
      [a.rateFrom, b.rateFrom].forEach(function (rf) {
        if (!isObj(rf)) return;
        rateFrom = rateFrom || {};
        Object.keys(rf).forEach(function (k) {
          var v = Number(rf[k]) || 0;
          if (!Object.prototype.hasOwnProperty.call(rateFrom, k) || v > rateFrom[k]) rateFrom[k] = v;
        });
      });
```

  It also includes `rateFrom: rateFrom` in the returned object.

- [ ] **Step 5: Text.**
  - Coin guide in `wallet.js` `GUIDE_TEXT`, both grades: change the coin line to every 20 points = 1 coin, and a perfect 10-question lesson = 140 points = 7 coins. Grade 2: `Bawat 20 points = 1 coin. … Perfect sa 10 tanong = 140 points = 7 coins!` paired with the English.
  - Add one guide row after the coin row:
    - Grade 5: `['🏅', 'Medals', 'A new medal on a lesson gives coins once: 🥉 3, 🥈 5, 🥇 10.']`
    - Grade 2: `['🏅', 'Medals', 'Bawat bagong medal sa aralin: 🥉 3, 🥈 5, 🥇 10 coins. · A new medal on a lesson gives coins once: 🥉 3, 🥈 5, 🥇 10.']`
  - Follow the exact row shape of the neighbouring Grade 2 rows; they may have a separate English field.
  - The shop `intro` in both lobbies: `10 points` becomes `20 points` in both places.
  - Grep `web/` for any other `10 points` coin wording, and report what you find.

- [ ] **Step 6: Fix the tests the rate change breaks.** Run `node --test`. Older wallet, lobby or backup unit tests that track a wallet and then add points will now expect 10 points a coin. For each failure, confirm that the failure comes from the new rule (points after the first `track` convert at 20), then update the expected numbers. Do not change any test whose failure has another cause; report it instead. List every test you changed and why.

- [ ] **Step 7: Commit (the user runs it).**

```bash
git add web/engine/wallet.js web/engine/sync-core.js web/lobby tests
git commit -m "Coins now take 20 points each; points earned before the switch keep 10 a coin, so no balance drops; synced per subject"
```

---

### Task 5: Medals pay coins

**Files:**
- Modify: `web/engine/mastery.js` (`COINS`, the `update` pay, `newLine`, the mount's `bonus`)
- Modify: all 17 games (remove `if (medals.points) kit.award(medals.points);`), through a scratchpad script
- Test: `tests/mastery.test.js`, `tests/mastery-wiring.test.js`, `tests/english-everywhere.test.js`

- [ ] **Step 1: Change the tests first.**
  - In `tests/mastery.test.js`:
    - Import `COINS` instead of `PAY`, and assert `COINS` deep-equals `[0, 3, 5, 10]`.
    - In every pay assertion, change `.points` to `.coins`, mapping 20→3, 40→5, 80→10, 60 (Bronze + Silver)→8 and 120 (Silver + Gold, 40 + 80)→15. Read each test and recompute rather than mapping blindly.
    - Change the `newLine` assertions to `'🏅 New Silver: Plants! +5 coins'` and `'🏅 Bagong Tanso · New Bronze: Halaman! +3 coins'` (passing `coins` instead of `points`).
    - Add `assert.equal(TEXT.grade5.newLine({ level: 1, title: 'Plants', coins: 0 }), '🏅 New Bronze: Plants!');`.
  - Add a test that `create(s, now, 'grade5', { bonus: (c) => { paid.push(c); return true; } })` calls `bonus` with the coins on a new medal.
  - Add a test that a failing `bonus` (returns false) leaves the saved `paid` level unchanged, returns `coins: 0`, still lists the medal in `newly`, and that a later update with a working `bonus` pays it.
  - In `tests/mastery-wiring.test.js`, replace the assertion `count(html, 'if (medals.points) kit.award(medals.points);'), 1` with an assertion that `kit.award(` does not appear in the game at all (`count(html, 'kit.award('), 0`).
  - In `tests/english-everywhere.test.js`, the `newLine` sample becomes `[{ level: 2, title: 'Halaman', coins: 5 }]`.

- [ ] **Step 2: Run `node --test tests/mastery.test.js tests/mastery-wiring.test.js`.** The changed tests should fail.

- [ ] **Step 3: Implement in `web/engine/mastery.js`:**
  - Replace `var PAY = [0, 20, 40, 80];` with `var COINS = [0, 3, 5, 10];`, and export `COINS` instead of `PAY`.
  - `newLine`, Grade 5: `'🏅 New ' + NAMES.en[m.level] + ': ' + m.title + '!' + (m.coins ? ' +' + m.coins + ' coins' : '')`. Grade 2 is the same after its `NAMES.fil` part.
  - `create(storage, now, grade, deps)`: `var bonus = deps && deps.bonus ? deps.bonus : function () { return true; };`.
  - In `update`:
    - `result` starts `{ lessons: {}, newly: [], coins: 0 }`.
    - The per-lesson loop sums `COINS[x]` into `c` (not points), pushes `coins: c` into `newly`, adds `c` to `result.coins`, and remembers the old paid level for that lesson in a local `unpaid` map (`unpaid[l.id] = paid`) whenever `c > 0`.
    - In the save `catch`, `result.coins = 0` replaces `result.points = 0`.
    - After the save succeeds and `result.coins > 0`, call `bonus(result.coins)`. If it returns false:
      - set each `entry.lessons[id].paid` back to `unpaid[id]`
      - save `state` again (inside try/catch)
      - set `result.coins = 0` and each `newly[i].coins = 0`
      - the medals still show; the next update pays them.
  - In the browser mount, pass the deps:

```js
    var api = grade && TEXT[grade] ? mountUi(root, create(root.Learner ? root.Learner.storage : root.localStorage, Date.now, grade, {
      bonus: function (coins) {
        var W = root.Wallet;
        if (!W || !W.addBonus || !W.addBonus(coins)) return false;
        if (W.renderCoins) W.renderCoins();
        return true;
      }
    })) : {};
```

  - Grep `mastery.js` for any other use of `points` (for example `showNew`) and switch it to coins.

- [ ] **Step 4: Remove the award line from the games.** Write a scratchpad script that removes the whole line matching `/^[ \t]*if \(medals\.points\) kit\.award\(medals\.points\);\r?\n/m` from each of the 17 games, exactly once per file. Run it.

- [ ] **Step 5: Run `node --test`.** Everything should pass.

- [ ] **Step 6: Commit (the user runs it).**

```bash
git add web/engine/mastery.js web/subjects tests/mastery.test.js tests/mastery-wiring.test.js tests/english-everywhere.test.js
git commit -m "New medals pay coins directly, 3 for Bronze, 5 for Silver and 10 for Gold, once per lesson; an unpaid medal pays on the next update"
```

---

### Task 6: E2E and docs

**Files:**
- Modify: `tests/e2e/driver-common.page.js` (`__e2eMedal`), `tests/e2e/apps-e2e.js` (`checkMedal`) and any other e2e expectation the new rate breaks
- Modify: `README.md`
- Modify: the spec's status line

- [ ] **Step 1: The medal e2e counts coins.** In `__e2eMedal`, `round()` returns the change in the wallet's bonus instead of points:

```js
  function bonus() { return (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0; }
  function round() {
    var before = bonus();
    startLesson(lesson);
    __e2eAnswerAll(true);
    return bonus() - before;
  }
```

Do the same for `r.slipPaid` if it measures points.

In `checkMedal` (`apps-e2e.js`):
- Math: `[m.first, m.second]` deep-equals `[3, 5]`.
- Other games: `m.first === 0 || m.first === 3`, and `m.first + m.second === 8`.
- Change the log line to say coins.

- [ ] **Step 2: Run every e2e suite.**
  - Run each of these twice: `node tests/e2e/apps-e2e.js`, `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/lobby-e2e.js 5`.
  - Run each of these once: `backup-e2e.js` (both grades), `file-check-e2e.js`, `migration-e2e.js`, `nav-e2e.js`.
  - For any failure, decide whether the expectation predates the new rate or medal coins. For example, a shop test that adds points after the lobby tracked the wallet now gets half the coins. If so, update the expectation and say so. If not, report it as a bug and do not change product code.

- [ ] **Step 3: README.**
  - In the rewards section, coins come at 20 points each (points from before 2026-10-04 kept 10 a coin), and a new medal pays 3 / 5 / 10 coins once.
  - Add a **Date guard** bullet: when the tablet's clock reads more than an hour earlier than the latest time it has seen, points and coins pause, a banner says so, and Parent → 📅 Tablet date → "The date is right now" clears it.
  - Add `clock.js  the date guard` to the engine file list.

- [ ] **Step 4: Spec status.** `Status: built 2026-10-04.`

- [ ] **Step 5: Run `node --test` one last time.** Everything should pass.

- [ ] **Step 6: Commit (the user runs it).**

```bash
git add tests/e2e README.md docs/superpowers/specs/2026-10-04-date-guard-and-coin-milestones-design.md docs/superpowers/plans/2026-10-04-date-guard-and-coin-milestones.md
git commit -m "Test medal coins end to end and document the date guard and the new coin rate"
```
