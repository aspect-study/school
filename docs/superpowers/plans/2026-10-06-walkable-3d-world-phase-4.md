# Walkable 3D World — Phase 4 Implementation Plan (family, comfort and play)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the 3D world. Jesus sits in his garden with a lamb and talks with her, greets her once a day where she starts, and comes to her in a soft golden glow on a hard day. Her sister stands by the gate in her own look and takes one-tap cheers. The playground rides work. Mayor Mimi gives a gentle nudge after 10 minutes without a game.

**Architecture:** Pure, Node-tested modules hold the decisions: `care.js` (hard day, who visits, which line), `nudge.js` (the 10-minute timer), `rides.js` (ride maths), plus small additions to `prefs.js`, `walk.js`, `layout.js`, `lines.js` and `text.js`. Two engine changes feed them: `boss.js` remembers the day she missed a stage, and `family.js` brings her sister's `avatar_v1` through the family peek. The 3D parts go in `cast.js` (Jesus, the lamb), `avatar.js` (sit, wave and cheer poses) and `build.js` (moving playground parts, hearts). Two new controllers sit beside Phase 3's `folk.js`: `kin.js` (Jesus and her sister) and `play.js` (rides). `town.js` gains Mimi's nudge walk, and `world-main.js` wires everything in.

**Tech Stack:** Plain HTML/CSS/JS (no build step), Three.js r149 (vendored, global `THREE`), `node --test`, headless Chrome e2e (`tests/e2e/chrome.js`).

**Spec:** `docs/superpowers/specs/2026-10-05-walkable-3d-world-design.md`, "Phase 4". **Outline (research):** `docs/superpowers/plans/2026-10-06-walkable-3d-world-phase-4-outline.md`.

**Code this builds on (committed):** Phase 1 (f090550), Phase 2 (4c36a68), Phase 3 (75d8091): `web/world/*.js`, both world pages, `tests/world3d-*.test.js`, `tests/e2e/world-e2e.js` + `world-driver.page.js`.

**Decisions made while planning (within the spec):**
- World pages do not load `cloud.js`. Her sister's data comes from `family_peek_v1`, which only the lobby's sync fills. A cheer sent in the world is saved to `family_v1` and goes out on the next lobby sync, the same as cheers from a game.
- A missed boss stage is saved nowhere today, so `boss.js` saves `boss_missed_v1` = `{ v: 1, day }` on a miss. It syncs as a plain replace.
- Hard day = 5 or more wrong answers today with under 60% right (study history), or the daily-quest streak broke today (`streakOf(days, today).days === 0 && streakOf(days, yesterday).days > 0`), or a boss stage missed today. Jesus's words never mention a streak, a quiz, coins, points or "wrong".
- Morning greeting: he appears with a sparkle about 7 steps ahead of her (where she starts: the gate on a normal first open) and walks up, then the bubble opens. Comfort is the same, in a golden glow. If both are due, comfort wins and marks both.
- Walking back: a few steps toward the garden, then a golden sparkle puts him on his bench. No long cross-map walk. He walks through things on the way (accepted).
- Jesus and her sister move or depend on synced data, so they are not in `Layout.interactables`. `kin.items()` adds them each frame, and they are not obstacles.
- Sister cheers use the speech bubble with the lobby's same cheers (`Family.CHEERS`, `canSend`, `send`, same 10-a-day limit). The cheer buttons keep the lobby's own words, which are Filipino · English, the same as the lobby card.
- Long study day (30+ answers today): Jesus's garden opens with "I'm proud of how hard you tried".
- Mimi's nudge: she appears with a sparkle a few steps away, walks to her, says `Chat.join(T.nudge, step.text)` with Go ▶ (trail) / Later, then sparkles back to the fountain.
- Every existing e2e case would be stopped by a morning greeting, so `stageWorld` seeds `world3d_v1` greeted/comforted = today by default (the CALM seed). Only the new Jesus cases turn it off.

**House rules (read before starting):**
- Never run `git commit`. Each task ends by staging with `git add`; the user commits.
- Comments sparingly. Browser files: ES5 `var`/`function`, IIFE `(function (root) { ... })(this)`. Tests: `const`, arrow functions, `node:test`.
- Grade 2: labels and lines pair Filipino with English (`Filipino · English`). Buttons are English only. Filipino follows the wording rules: "natutuhan", "puwede", "nakatutulong", never "tunog tama", never "bagay" for "fits".
- After adding a file under `web/`, run `node tools/update-precache.js`.
- Run unit tests from the repo root with `node --test`.
- Edits to existing files are given as "find this exact text → replace with". If the text is not found exactly, stop and report it.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `web/world/prefs.js` | Modify | `readDaily` keeps `greeted` and `comforted` |
| `web/engine/boss.js` | Modify | Saves `boss_missed_v1` on a missed stage; `missedDay(storage)`, `MISSED_KEY` |
| `web/engine/family.js` | Modify | `PEEK_STATE` + `avatar_v1`; the peek keeps `look`; `sisters()` hands it on |
| `web/world/text.js` | Modify | Hug, Another cheer, ride buttons; Jesus's name, nudge, sister lines |
| `web/world/lines.js` | Modify | `JESUS`: greet, garden, proud, hug, comfort (wrong / streak / boss), each `{ say, verse, ref }` |
| `web/world/care.js` | Create | Pure: `tally`, `streakBroke`, `hardDay`, `visit`, `pick`, `gardenLines` |
| `web/world/nudge.js` | Create | Pure: the 10-minute timer |
| `web/world/rides.js` | Create | Pure: ride times, moving-part angles and her pose |
| `web/world/walk.js` | Modify | `advance(x, z, tx, tz, dist)` |
| `web/world/layout.js` | Modify | Jesus's seat and talk spot, the lamb, sister spots, ride spots + interactables, `freeSpot` |
| `web/world/cast.js` | Modify | `jesus(S)`, `lamb(S)` |
| `web/world/avatar.js` | Modify | `animate(t, walkT, mag, pose)` with `sit`, `wave`, `cheer` |
| `web/world/build.js` | Modify | Moving swing, see-saw and merry-go-round; `ride(id, k)`; `hearts(x, y, z)` |
| `web/world/kin.js` | Create | Jesus (garden talk, Hug, greet and comfort visits, walk back) and her sister at the gate |
| `web/world/play.js` | Create | The ride controller |
| `web/world/town.js` | Modify | Mimi's nudge walk; no daily greeting while Jesus visits |
| `web/world/world-main.js` | Modify | Creates kin, play and the nudge; dynamic items; ride poses; debug hooks |
| `web/world/grade-5.html`, `grade-2.html` | Modify | Load `family.js` and the new files |
| `tests/paths.js` | Modify | `WORLD_FILES`, `WORLD_ENGINES` |
| `tests/world3d-*.test.js`, `tests/boss.test.js`, `tests/family.test.js`, `tests/sync.test.js` | Modify / create | Unit + wiring tests |
| `tests/e2e/world-e2e.js`, `world-driver.page.js` | Modify | CALM seed; Jesus, comfort, sister, ride and nudge cases |

---

### Task 1: Jesus's daily marks (`prefs.js`)

**Files:**
- Modify: `web/world/prefs.js`
- Test: `tests/world3d-prefs.test.js`

- [ ] **Step 1: Write the failing test**

In `tests/world3d-prefs.test.js`, find:

```js
test('daily marks remember the day Mimi talked to her, and sync whole', () => {
  const s = memory();
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '', t: 0 });
  P.markDaily(s, 'mimi', '2026-10-05', 99);
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '2026-10-05', t: 99 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '{"mimi":5,"t":"x"}' })), { v: 1, mimi: '', t: 0 });
```

Replace with:

```js
test('daily marks remember the day Mimi talked to her, and sync whole', () => {
  const s = memory();
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '', greeted: '', comforted: '', t: 0 });
  P.markDaily(s, 'mimi', '2026-10-05', 99);
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '2026-10-05', greeted: '', comforted: '', t: 99 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '{"mimi":5,"t":"x"}' })), { v: 1, mimi: '', greeted: '', comforted: '', t: 0 });
```

Append at the end of the file:

```js
test('daily marks also remember the days Jesus greeted and comforted her', () => {
  const s = memory();
  P.markDaily(s, 'greeted', '2026-10-06', 5);
  P.markDaily(s, 'comforted', '2026-10-06', 6);
  P.markDaily(s, 'mimi', '2026-10-06', 7);
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '2026-10-06', greeted: '2026-10-06', comforted: '2026-10-06', t: 7 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '{"greeted":1,"comforted":null}' })), { v: 1, mimi: '', greeted: '', comforted: '', t: 0 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '7' })), { v: 1, mimi: '', greeted: '', comforted: '', t: 0 });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-prefs.test.js`
Expected: FAIL. `readDaily` has no `greeted` / `comforted`.

- [ ] **Step 3: Keep the new fields**

In `web/world/prefs.js`, find:

```js
  // Once-a-day moments, synced so a second device does not repeat them. mimi: the day she last talked to Mayor Mimi.
  function readDaily(storage) {
    var d = parse(storage, DAILY_KEY) || {};
    return { v: 1, mimi: typeof d.mimi === 'string' ? d.mimi : '', t: typeof d.t === 'number' ? d.t : 0 };
  }
```

Replace with:

```js
  // Once-a-day moments, synced so a second device does not repeat them: the day she last talked to Mayor Mimi, and the
  // days Jesus last greeted and comforted her.
  function readDaily(storage) {
    var d = parse(storage, DAILY_KEY) || {};
    function day(k) { return typeof d[k] === 'string' ? d[k] : ''; }
    return { v: 1, mimi: day('mimi'), greeted: day('greeted'), comforted: day('comforted'), t: typeof d.t === 'number' ? d.t : 0 };
  }
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-prefs.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/prefs.js tests/world3d-prefs.test.js
```

---

### Task 2: Remember a missed boss stage (`boss.js`)

**Files:**
- Modify: `web/engine/boss.js`
- Test: `tests/boss.test.js`

- [ ] **Step 1: Write the failing test**

In `tests/boss.test.js`, find:

```js
const { create, read, rank, weekKey, linkFor, parentLine, TEXT, KEY, STAGES, STAGE_SIZE, FULL_COINS, HALF_COINS } = require(engineFile('boss.js'));
```

Replace with:

```js
const { create, read, rank, weekKey, linkFor, parentLine, missedDay, TEXT, KEY, MISSED_KEY, STAGES, STAGE_SIZE, FULL_COINS, HALF_COINS } = require(engineFile('boss.js'));
const { kindOf } = require(engineFile('sync-core.js'));
```

Append at the end of the file:

```js
test('a missed stage remembers the day (for Jesus in the 3D world); a clear does not', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  assert.equal(missedDay(w.s), '');
  w.b.stageResult('c', 2, 3);
  assert.equal(missedDay(w.s), '', 'a clear is not a miss');
  w.b.stageResult('a', 1, 3);
  assert.equal(missedDay(w.s), '2026-10-05');
  assert.deepEqual(JSON.parse(w.s.data[MISSED_KEY]), { v: 1, day: '2026-10-05' });
  assert.equal(missedDay(memory({ boss_missed_v1: '{"day":5}' })), '');
  assert.equal(missedDay(memory({ boss_missed_v1: 'nope' })), '');
  assert.equal(MISSED_KEY, 'boss_missed_v1');
  assert.equal(kindOf(MISSED_KEY), 'replace', 'synced whole, so every tablet knows');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/boss.test.js`
Expected: FAIL. `missedDay` is not a function.

- [ ] **Step 3: Save the day on a miss**

In `web/engine/boss.js`, find:

```js
  var KEY = 'boss_v1';
```

Replace with:

```js
  var KEY = 'boss_v1';
  var MISSED_KEY = 'boss_missed_v1';
```

Find:

```js
  function clearedCount(stages) { return stages.filter(function (s) { return s.cleared; }).length; }
```

Replace with:

```js
  function clearedCount(stages) { return stages.filter(function (s) { return s.cleared; }).length; }

  // The day she last missed a stage (synced, so Jesus can comfort her in the 3D world); '' when never or unreadable.
  function missedDay(storage) {
    try {
      var d = JSON.parse(storage.getItem(MISSED_KEY));
      return isObj(d) && typeof d.day === 'string' ? d.day : '';
    } catch (e) { return ''; }
  }
```

Find:

```js
      if (right < need) return [{ big: false, icon: '⚔️', title: T.missTitle, line: T.missLine(right, total, need), next: T.missNext }];
```

Replace with:

```js
      if (right < need) {
        try { storage.setItem(MISSED_KEY, JSON.stringify({ v: 1, day: dayKey(new Date(now())) })); } catch (e) {}
        return [{ big: false, icon: '⚔️', title: T.missTitle, line: T.missLine(right, total, need), next: T.missNext }];
      }
```

Find:

```js
  var exported = { create: create, read: read, rank: rank, weekKey: weekKey, linkFor: linkFor, parentLine: parentLine,
    TEXT: TEXT, KEY: KEY, STAGES: STAGES, STAGE_SIZE: STAGE_SIZE, FULL_COINS: FULL_COINS, HALF_COINS: HALF_COINS };
```

Replace with:

```js
  var exported = { create: create, read: read, rank: rank, weekKey: weekKey, linkFor: linkFor, parentLine: parentLine,
    missedDay: missedDay, MISSED_KEY: MISSED_KEY,
    TEXT: TEXT, KEY: KEY, STAGES: STAGES, STAGE_SIZE: STAGE_SIZE, FULL_COINS: FULL_COINS, HALF_COINS: HALF_COINS };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/boss.test.js tests/boss-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/boss.js tests/boss.test.js
```

---

### Task 3: Her sister's look comes through the family peek (`family.js`)

**Files:**
- Modify: `web/engine/family.js`
- Test: `tests/family.test.js`, `tests/sync.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/family.test.js`, find:

```js
  assert.deepEqual(PEEK_STATE, ['profile_v1', 'world_v1', 'family_v1']);
```

Replace with:

```js
  assert.deepEqual(PEEK_STATE, ['profile_v1', 'world_v1', 'family_v1', 'avatar_v1']);
```

Find:

```js
  assert.deepEqual(readPeek(s), { mia: { profile: { name: 'Mia', grade: 2 }, world: { v: 1, avatar: 'owl' }, family: { v: 1, at: 5, news: [], sent: [] }, total: 4, readAt: now() } });
```

Replace with:

```js
  assert.deepEqual(readPeek(s), { mia: { profile: { name: 'Mia', grade: 2 }, world: { v: 1, avatar: 'owl' }, look: null, family: { v: 1, at: 5, news: [], sent: [] }, total: 4, readAt: now() } });
```

Append at the end of the file:

```js
test('store keeps her 3D look (avatar_v1 arrives as saved JSON text); sisters hand it on', () => {
  const s = memory(), now = clock(2026, 10, 6);
  const look = { v: 1, body: 'girl', skin: 1, hair: 'bob', hairColor: 2, outfit: 3, pet: 'puppy', petName: '', t: 9 };
  store(s, now, [{ id: 'mia', state: { profile_v1: { grade: 2 }, avatar_v1: JSON.stringify(look) }, counters: {} }]);
  assert.deepEqual(readPeek(s).mia.look, look);
  assert.deepEqual(sisters(ME, readPeek(s), now(), null)[0].look, look);
  store(s, now, [{ id: 'mia', state: { profile_v1: { grade: 2 }, avatar_v1: '[1]' }, counters: {} }]);
  assert.equal(sisters(ME, readPeek(s), now(), null)[0].look, null, 'junk reads as no look yet');
  assert.equal(sisters(ME, peekOf(now, null), now(), null)[0].look, null, 'an older peek has no look');
});
```

In `tests/sync.test.js`, find:

```js
  Fam.note(bunso.s, clock, Math.random, 'medal', { app: 'block-bot', tier: 1, title: 'Skip Counting' });
```

Replace with:

```js
  const LOOK_B = { v: 1, body: 'girl', skin: 1, hair: 'pigtails', hairColor: 3, outfit: 2, pet: 'puppy', petName: 'Bantay', t: 7 };
  bunso.s.setItem('avatar_v1', JSON.stringify(LOOK_B));
  Fam.note(bunso.s, clock, Math.random, 'medal', { app: 'block-bot', tier: 1, title: 'Skip Counting' });
```

Find:

```js
  assert.deepEqual(seen.map((s) => [s.id, s.rel, s.hasNews, s.news[0].kind]), [['mia', 'bunso', true, 'medal']]);
```

Replace with:

```js
  assert.deepEqual(seen.map((s) => [s.id, s.rel, s.hasNews, s.news[0].kind]), [['mia', 'bunso', true, 'medal']]);
  assert.deepEqual(seen[0].look, LOOK_B, 'her 3D look comes through the peek, for the gate in the 3D world');
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/family.test.js tests/sync.test.js`
Expected: FAIL on `PEEK_STATE`, `look`, and the sync look assertion.

- [ ] **Step 3: Peek at `avatar_v1` and keep it**

In `web/engine/family.js`, find:

```js
  var PEEK_STATE = ['profile_v1', 'world_v1', KEY];
```

Replace with:

```js
  var PEEK_STATE = ['profile_v1', 'world_v1', KEY, 'avatar_v1'];
```

Find:

```js
  // list: [{ id, state: { profile_v1, world_v1, family_v1 }, counters: { cheers_sent_total } }] from cloud.js.
  // world_v1 is a plain synced key, so it arrives as the saved JSON text.
```

Replace with:

```js
  // list: [{ id, state: { profile_v1, world_v1, family_v1, avatar_v1 }, counters: { cheers_sent_total } }] from cloud.js.
  // world_v1 and avatar_v1 are plain synced keys, so they arrive as the saved JSON text.
```

Find:

```js
      out[r.id] = { profile: isObj(st.profile_v1) ? st.profile_v1 : {}, world: parseObj(st.world_v1) || {},
        family: isObj(st[KEY]) ? st[KEY] : null, total: num(c[TOTAL]), readAt: t };
```

Replace with:

```js
      out[r.id] = { profile: isObj(st.profile_v1) ? st.profile_v1 : {}, world: parseObj(st.world_v1) || {},
        look: parseObj(st.avatar_v1), family: isObj(st[KEY]) ? st[KEY] : null, total: num(c[TOTAL]), readAt: t };
```

Find:

```js
        avatar: isObj(p.world) && typeof p.world.avatar === 'string' ? p.world.avatar : null,
```

Replace with:

```js
        avatar: isObj(p.world) && typeof p.world.avatar === 'string' ? p.world.avatar : null,
        look: isObj(p.look) ? p.look : null,
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/family.test.js tests/sync.test.js`
Expected: PASS. If the sync look assertion still fails, check that the test device syncs a newly set plain key (`avatar_v1` is a replace key); stop and report if it does not.

- [ ] **Step 5: Stage**

```bash
git add web/engine/family.js tests/family.test.js tests/sync.test.js
```

---

### Task 4: Words for Phase 4 (`text.js`)

**Files:**
- Modify: `web/world/text.js`
- Test: `tests/world3d-text.test.js`

- [ ] **Step 1: Write the failing test**

In `tests/world3d-text.test.js`, find:

```js
  'more', 'ask', 'bye', 'next', 'talkTo', 'listen', 'reviewGame', 'bunny']);
```

Replace with:

```js
  'more', 'ask', 'bye', 'next', 'talkTo', 'listen', 'reviewGame', 'bunny',
  'hug', 'cheerAgain', 'rides.slide', 'rides.swings', 'rides.seesaw', 'rides.merry']);
```

Append at the end of the file:

```js
test('family, comfort and play have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['hug', 'cheerAgain', 'jesus', 'nudge', 'sisterHello', 'sisterPlaying', 'sisterChoosing']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.deepEqual(Object.keys(TEXT[g].rides), ['slide', 'swings', 'seesaw', 'merry']);
    for (const k of ['sisterHello', 'sisterPlaying', 'sisterChoosing']) {
      assert.equal(TEXT[g][k].split('{name}').length - 1, g === 'grade2' ? 2 : 1, g + ' ' + k + ' names her sister in each half');
    }
  }
  assert.match(TEXT.grade5.nudge, /^Let's learn something!/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-text.test.js`
Expected: FAIL on "family, comfort and play have their words".

- [ ] **Step 3: Add the words**

In `web/world/text.js`, find:

```js
    listen: '🌳 Listen to the tree', reviewGame: '🔁 Review in the game', bunny: 'Bunny',
```

Replace with:

```js
    listen: '🌳 Listen to the tree', reviewGame: '🔁 Review in the game', bunny: 'Bunny',
    hug: '🤗 Hug', cheerAgain: '💌 Another cheer',
    rides: { slide: '🛝 Go down the slide!', swings: '🌈 Ride the swing!', seesaw: '⚖️ Ride the see-saw!', merry: '🎠 Ride the merry-go-round!' },
```

Find (Grade 5 labels):

```js
      hoot: 'Professor Hoot', tree: 'Talking Tree', askTitle: 'Ask me! in the Campus',
```

Replace with:

```js
      hoot: 'Professor Hoot', tree: 'Talking Tree', askTitle: 'Ask me! in the Campus',
      jesus: 'Jesus', nudge: "Let's learn something!",
      sisterHello: '💖 Hi! Want to send {name} a cheer?',
      sisterPlaying: '✨ {name} is playing now! Want to send a cheer?',
      sisterChoosing: '🎨 {name} is still choosing her look! Want to send a cheer?',
```

Find (Grade 2 labels):

```js
      askTitle: 'Tanong sa Bayan · Ask me! in the Village',
```

Replace with:

```js
      askTitle: 'Tanong sa Bayan · Ask me! in the Village',
      jesus: 'Hesus · Jesus', nudge: "Tara, matuto tayo! · Let's learn something!",
      sisterHello: '💖 Kumusta! Gusto mo bang padalhan ng cheer si {name}? · Hi! Want to send {name} a cheer?',
      sisterPlaying: '✨ Naglalaro ngayon si {name}! Gusto mo bang magpadala ng cheer? · {name} is playing now! Want to send a cheer?',
      sisterChoosing: '🎨 Pumipili pa si {name} ng kanyang itsura! Gusto mo bang magpadala ng cheer? · {name} is still choosing her look! Want to send a cheer?',
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-text.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/text.js tests/world3d-text.test.js
```

---

### Task 5: What Jesus says (`lines.js`)

**Files:**
- Modify: `web/world/lines.js`
- Test: Create `tests/world3d-jesus.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-jesus.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { JESUS } = require(worldFile('lines.js'));

const all = (g) => [].concat(JESUS[g].greet, JESUS[g].garden, [JESUS[g].proud], JESUS[g].hug,
  JESUS[g].comfort.wrong, JESUS[g].comfort.streak, JESUS[g].comfort.boss);
const NEVER = /wrong|\bmali\b|coin|point|puntos|quiz|streak|score/i;
const FIL_WRONG = /tunog tama|natutunan|\bpwede\b|nakakatakot|^Tapos\b/i;

test('Jesus has enough to say', () => {
  for (const g of ['grade5', 'grade2']) {
    const J = JESUS[g];
    assert.deepEqual([J.greet.length, J.garden.length, J.hug.length, J.comfort.wrong.length, J.comfort.streak.length, J.comfort.boss.length],
      [5, 8, 3, 2, 2, 2], g);
  }
});

test('every line has his words, a verse in kid words and where it is in the Bible', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const l of all(g)) {
      assert.ok(l.say && l.verse && l.ref, g + ' ' + l.say);
      assert.match(l.ref, /\d+:\d+/, l.ref);
    }
  }
});

test('Grade 2 pairs Filipino with English; the English half is the Grade 5 line', () => {
  for (const l of all('grade2')) for (const k of ['say', 'verse', 'ref']) assert.match(l[k], / · /, k + ': ' + l[k]);
  for (const l of all('grade5')) for (const k of ['say', 'verse', 'ref']) assert.doesNotMatch(l[k], / · /, k + ': ' + l[k]);
  const en = all('grade5');
  all('grade2').forEach((l, i) => {
    assert.ok(l.say.endsWith(' · ' + en[i].say), en[i].say);
    assert.ok(l.verse.endsWith(' · ' + en[i].verse), en[i].verse);
  });
});

test('Jesus never quizzes, pays, scolds or talks about a streak', () => {
  for (const g of ['grade5', 'grade2']) for (const l of all(g)) for (const k of ['say', 'verse']) assert.doesNotMatch(l[k], NEVER, l[k]);
  for (const l of all('grade2')) for (const k of ['say', 'verse']) assert.doesNotMatch(l[k], FIL_WRONG, l[k]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-jesus.test.js`
Expected: FAIL. `JESUS` is undefined.

- [ ] **Step 3: Write the lines**

In `web/world/lines.js`, find:

```js
  var exported = { TEXT: { grade5: EN, grade2: FIL }, QUOTES: QUOTES };
```

Replace with:

```js
  // Jesus's words: [what he says, the verse in kid words, where it is]. Simple paraphrases, not one translation. He
  // never quizzes, pays, says "wrong" or talks about losing a streak.
  var JESUS_EN = {
    greet: [
      ['Good morning! I am so happy to see you today. 💛', 'This is the day the Lord has made. Let us be glad in it!', 'Psalm 118:24'],
      ['Hello, my friend! I am with you all day long.', 'I am with you always.', 'Matthew 28:20'],
      ['Good morning! You are so special to me.', 'You are precious and loved.', 'Isaiah 43:4'],
      ["Hi! Let's have a wonderful day together.", "God's love is new every morning.", 'Lamentations 3:22-23'],
      ['Good day! Remember, you can always talk to me.', 'Do not worry. Tell God about everything.', 'Philippians 4:6']
    ],
    garden: [
      ['Come sit with me and the little lamb. 🐑', 'The Lord is my shepherd. I have all I need.', 'Psalm 23:1'],
      ['Let the little children come to me. I love spending time with you!', 'Let the children come to me.', 'Mark 10:14'],
      ['Be kind to others, just like you want them to be kind to you.', 'Treat others the way you want to be treated.', 'Luke 6:31'],
      ['You are a light! Let your kindness shine.', 'Let your light shine before others.', 'Matthew 5:16'],
      ['I made the flowers, the birds, and you. You are wonderful!', 'I am wonderfully made.', 'Psalm 139:14'],
      ['When you feel scared, remember I am right here.', 'Be strong and brave. God is with you wherever you go.', 'Joshua 1:9'],
      ['Love one another, the way I love you.', 'Love one another as I have loved you.', 'John 13:34'],
      ['Saying thank you makes hearts happy.', 'Give thanks in all things.', '1 Thessalonians 5:18']
    ],
    proud: ['You tried so hard today. I am proud of how hard you tried!', 'Whatever you do, do it with all your heart.', 'Colossians 3:23'],
    hug: [
      ['I love you so much! 💛', "Nothing can take us away from God's love.", 'Romans 8:39'],
      ['You are never alone. I am always with you.', 'I am with you always.', 'Matthew 28:20'],
      ['A big hug for you! You are my treasure.', 'God cares for you.', '1 Peter 5:7']
    ],
    comfort: {
      wrong: [
        ['Learning can feel hard sometimes. That is okay. I am right here with you.', 'Do not be afraid, for I am with you.', 'Isaiah 41:10'],
        ['Some questions were tricky today. Take a deep breath. You can try again tomorrow.', 'Come to me when you are tired, and I will give you rest.', 'Matthew 11:28']
      ],
      streak: [
        ['Every day is a fresh new start. I love you just the same!', 'His love is new every morning.', 'Lamentations 3:23'],
        ['Rest is good too. Tomorrow is a new day to learn and play.', 'There is a time for everything.', 'Ecclesiastes 3:1']
      ],
      boss: [
        ['That boss was tough! Rest a little, then try again. I am with you!', 'I can do all things through Christ who gives me strength.', 'Philippians 4:13'],
        ['Brave hearts try again. I believe in you!', 'Be strong and take heart.', 'Psalm 31:24']
      ]
    }
  };
  var JESUS_FIL = {
    greet: [
      ['Magandang umaga! Masaya akong makita ka ngayon. 💛', 'Ito ang araw na ginawa ng Panginoon. Magalak tayo!', 'Awit 118:24'],
      ['Kumusta, kaibigan! Kasama mo ako buong araw.', 'Kasama mo ako palagi.', 'Mateo 28:20'],
      ['Magandang umaga! Napakahalaga mo sa akin.', 'Mahalaga ka at minamahal.', 'Isaias 43:4'],
      ['Kumusta! Magkaroon tayo ng masayang araw.', 'Bago tuwing umaga ang pag-ibig ng Diyos.', 'Panaghoy 3:22-23'],
      ['Magandang araw! Tandaan, puwede mo akong kausapin palagi.', 'Huwag mag-alala. Sabihin sa Diyos ang lahat.', 'Filipos 4:6']
    ],
    garden: [
      ['Halika, umupo ka kasama namin ng munting tupa. 🐑', 'Ang Panginoon ang aking pastol. Nasa akin ang lahat ng kailangan ko.', 'Awit 23:1'],
      ['Hayaan ninyong lumapit sa akin ang mga bata. Gustong-gusto kitang makasama!', 'Hayaan ninyong lumapit sa akin ang mga bata.', 'Marcos 10:14'],
      ['Maging mabait sa iba, gaya ng gusto mong kabaitan nila sa iyo.', 'Gawin sa iba ang gusto mong gawin nila sa iyo.', 'Lucas 6:31'],
      ['Isa kang ilaw! Hayaang magningning ang iyong kabaitan.', 'Hayaang magningning ang inyong ilaw sa harap ng iba.', 'Mateo 5:16'],
      ['Ginawa ko ang mga bulaklak, ang mga ibon, at ikaw. Kahanga-hanga ka!', 'Kahanga-hanga ang pagkakalikha sa akin.', 'Awit 139:14'],
      ['Kapag natatakot ka, tandaan na narito lang ako.', 'Magpakatatag at magpakatapang. Kasama mo ang Diyos saan ka man pumunta.', 'Josue 1:9'],
      ['Magmahalan kayo, gaya ng pagmamahal ko sa inyo.', 'Magmahalan kayo gaya ng pagmamahal ko sa inyo.', 'Juan 13:34'],
      ['Pinasasaya ng pasasalamat ang puso.', 'Magpasalamat sa lahat ng pagkakataon.', '1 Tesalonica 5:18']
    ],
    proud: ['Napakasipag mo ngayong araw. Ipinagmamalaki kita sa iyong pagsisikap!', 'Anuman ang gawin mo, gawin mo nang buong puso.', 'Colosas 3:23'],
    hug: [
      ['Mahal na mahal kita! 💛', 'Walang makapaghihiwalay sa atin sa pag-ibig ng Diyos.', 'Roma 8:39'],
      ['Hindi ka kailanman nag-iisa. Kasama mo ako palagi.', 'Kasama mo ako palagi.', 'Mateo 28:20'],
      ['Isang mahigpit na yakap para sa iyo! Ikaw ang aking kayamanan.', 'Iniingatan ka ng Diyos.', '1 Pedro 5:7']
    ],
    comfort: {
      wrong: [
        ['Minsan mahirap ang pag-aaral. Ayos lang iyon. Narito lang ako kasama mo.', 'Huwag kang matakot, sapagkat kasama mo ako.', 'Isaias 41:10'],
        ['May mga tanong na mahirap ngayon. Huminga nang malalim. Puwede kang sumubok ulit bukas.', 'Lumapit kayo sa akin kapag pagod kayo, at bibigyan ko kayo ng kapahingahan.', 'Mateo 11:28']
      ],
      streak: [
        ['Bagong simula ang bawat araw. Mahal pa rin kita!', 'Bago tuwing umaga ang kanyang pag-ibig.', 'Panaghoy 3:23'],
        ['Mabuti rin ang magpahinga. Bagong araw bukas para matuto at maglaro.', 'May tamang panahon para sa lahat.', 'Mangangaral 3:1']
      ],
      boss: [
        ['Ang lakas ng boss na iyon! Magpahinga muna, saka sumubok ulit. Kasama mo ako!', 'Kaya ko ang lahat sa tulong ni Cristo na nagbibigay sa akin ng lakas.', 'Filipos 4:13'],
        ['Sumusubok ulit ang matatapang na puso. Naniniwala ako sa iyo!', 'Magpakatatag kayo at lakasan ang loob.', 'Awit 31:24']
      ]
    }
  };

  function jline(en, fil) {
    return fil ? { say: pair(fil[0], en[0]), verse: pair(fil[1], en[1]), ref: pair(fil[2], en[2]) } : { say: en[0], verse: en[1], ref: en[2] };
  }
  // Same shape as the tables: a list of lines, one line (proud), or an object of those.
  function jesus(en, fil) {
    if (Array.isArray(en) && Array.isArray(en[0])) return en.map(function (x, i) { return jline(x, fil && fil[i]); });
    if (Array.isArray(en)) return jline(en, fil);
    var out = {};
    Object.keys(en).forEach(function (k) { out[k] = jesus(en[k], fil && fil[k]); });
    return out;
  }
  var JESUS = { grade5: jesus(JESUS_EN, null), grade2: jesus(JESUS_EN, JESUS_FIL) };

  var exported = { TEXT: { grade5: EN, grade2: FIL }, QUOTES: QUOTES, JESUS: JESUS };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-jesus.test.js tests/world3d-lines.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/lines.js tests/world3d-jesus.test.js
```

---

### Task 6: Hard days and visits (`care.js`)

**Files:**
- Create: `web/world/care.js`
- Test: Create `tests/world3d-care.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-care.test.js`:

```js
process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const C = require(worldFile('care.js'));
const { JESUS } = require(worldFile('lines.js'));
const { streakOf } = require(engineFile('quests.js'));

const TODAY = '2026-10-06';
const dayKey = (t) => (t < 100 ? '2026-10-05' : TODAY);

test('tally counts today\'s quiz answers only', () => {
  const entries = [
    { type: 'quiz', t: 200, answered: 8, correct: 3 },
    { type: 'quiz', t: 50, answered: 9, correct: 0 },
    { type: 'open', t: 200 },
    { type: 'quiz', t: 300, answered: 2, correct: 5 },
    null,
  ];
  assert.deepEqual(C.tally(entries, TODAY, dayKey), { answered: 10, correct: 5, wrong: 5 });
  assert.deepEqual(C.tally(null, TODAY, dayKey), { answered: 0, correct: 0, wrong: 0 });
});

test('a hard day: 5+ wrong under 60% right, a broken streak, or a missed boss stage, in that order', () => {
  const t = (answered, correct) => ({ answered, correct, wrong: answered - correct });
  assert.equal(C.hardDay({ tally: t(10, 5) }), 'wrong');
  assert.equal(C.hardDay({ tally: t(20, 15) }), null, '75% right is a good day');
  assert.equal(C.hardDay({ tally: t(6, 2) }), null, 'only 4 wrong');
  assert.equal(C.hardDay({ tally: t(0, 0), broke: true }), 'streak');
  assert.equal(C.hardDay({ tally: t(0, 0), bossMissed: true }), 'boss');
  assert.equal(C.hardDay({ tally: t(10, 5), broke: true, bossMissed: true }), 'wrong');
  assert.equal(C.hardDay({}), null);
});

test('the streak broke today: alive yesterday, gone today', () => {
  assert.equal(C.streakBroke(['2026-10-01'], '2026-10-05', '2026-10-04', streakOf), true);
  assert.equal(C.streakBroke(['2026-10-01'], '2026-10-04', '2026-10-03', streakOf), false, 'still alive');
  assert.equal(C.streakBroke([], '2026-10-05', '2026-10-04', streakOf), false, 'never had one');
  assert.equal(C.streakBroke(['2026-10-01'], '2026-10-05', '2026-10-04', () => { throw new Error('x'); }), false);
});

test('comfort wins over the greeting; each comes once a day', () => {
  const D = TODAY;
  assert.equal(C.visit({ greeted: '', comforted: '' }, D, null), 'greet');
  assert.equal(C.visit({ greeted: '', comforted: '' }, D, 'wrong'), 'comfort');
  assert.equal(C.visit({ greeted: D, comforted: '' }, D, null), null);
  assert.equal(C.visit({ greeted: D, comforted: '' }, D, 'boss'), 'comfort', 'a hard day later on still brings comfort');
  assert.equal(C.visit({ greeted: D, comforted: D }, D, 'boss'), null);
  assert.equal(C.visit({ greeted: '2026-10-05', comforted: '2026-10-05' }, D, null), 'greet', 'a new day');
});

test('pick: the same line all day, the next one with k, and not always the same day to day', () => {
  const list = JESUS.grade5.greet;
  assert.equal(C.pick(list, TODAY, 0), C.pick(list, TODAY, 0));
  assert.equal(list.indexOf(C.pick(list, TODAY, 1)), (list.indexOf(C.pick(list, TODAY, 0)) + 1) % list.length);
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
  assert.ok(new Set(days.map((d) => C.pick(list, d, 0))).size > 1);
});

test('the garden starts with the line of the day, and after a long study day with "proud"', () => {
  const J = JESUS.grade5;
  const plain = C.gardenLines(J, { answered: 10 }, TODAY);
  assert.equal(plain.length, J.garden.length);
  assert.equal(plain[0], C.pick(J.garden, TODAY, 0));
  assert.deepEqual(new Set(plain), new Set(J.garden));
  const long = C.gardenLines(J, { answered: 30 }, TODAY);
  assert.equal(long[0], J.proud);
  assert.equal(long.length, J.garden.length + 1);
  assert.equal(C.gardenLines(J, null, TODAY)[0], plain[0]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-care.test.js`
Expected: FAIL. Cannot find `care.js`.

- [ ] **Step 3: Write `care.js`**

Create `web/world/care.js`:

```js
/* When Jesus comes to her, as plain maths with no Three.js: what kind of day she is having (from study history, the
   daily-quest streak and the boss), whether he greets or comforts her today, and which of his lines to say. */
(function (root) {
  'use strict';

  var HARD_WRONG = 5, HARD_RATE = 0.6, LONG_DAY = 30;

  // Today's quiz answers from StudyHistory.list(); dayKey(ms) gives the local day as YYYY-MM-DD.
  function tally(entries, today, dayKey) {
    var out = { answered: 0, correct: 0, wrong: 0 };
    (Array.isArray(entries) ? entries : []).forEach(function (e) {
      if (!e || e.type !== 'quiz' || typeof e.t !== 'number' || dayKey(e.t) !== today) return;
      var a = Number(e.answered) || 0;
      out.answered += a;
      out.correct += Math.min(a, Number(e.correct) || 0);
    });
    out.wrong = out.answered - out.correct;
    return out;
  }

  // Alive yesterday, gone today. streakOf is quests.js's.
  function streakBroke(days, today, yesterday, streakOf) {
    try { return streakOf(days, today).days === 0 && streakOf(days, yesterday).days > 0; } catch (e) { return false; }
  }

  // o = { tally, broke, bossMissed } → 'wrong' | 'streak' | 'boss' | null, in the spec's order.
  function hardDay(o) {
    var t = o.tally || { answered: 0, correct: 0, wrong: 0 };
    if (t.wrong >= HARD_WRONG && t.correct < t.answered * HARD_RATE) return 'wrong';
    if (o.broke) return 'streak';
    if (o.bossMissed) return 'boss';
    return null;
  }

  // daily = Prefs.readDaily(). Comfort wins over the greeting (and counts as it); each comes at most once a local day.
  function visit(daily, today, reason) {
    if (reason && daily.comforted !== today) return 'comfort';
    if (daily.greeted !== today) return 'greet';
    return null;
  }

  // The same line all day, another one tomorrow; k walks on from it (💬 More, a second hug).
  function pick(list, today, k) {
    var h = 0, s = String(today);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return list[(h + (k || 0)) % list.length];
  }

  // His garden lines, starting with the line of the day; after a long study day "proud" comes first.
  function gardenLines(J, t, today) {
    var start = J.garden.indexOf(pick(J.garden, today, 0));
    var lines = J.garden.slice(start).concat(J.garden.slice(0, start));
    return t && t.answered >= LONG_DAY ? [J.proud].concat(lines) : lines;
  }

  var exported = { LONG_DAY: LONG_DAY, tally: tally, streakBroke: streakBroke, hardDay: hardDay, visit: visit, pick: pick, gardenLines: gardenLines };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Care = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-care.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/care.js tests/world3d-care.test.js
```

---

### Task 7: The 10-minute nudge timer (`nudge.js`)

**Files:**
- Create: `web/world/nudge.js`
- Test: Create `tests/world3d-nudge.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-nudge.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const N = require(worldFile('nudge.js'));

test('10 minutes of world time brings one nudge, then it counts again', () => {
  assert.equal(N.LIMIT, 600);
  const n = N.create();
  let fired = 0;
  for (let i = 0; i < 599; i++) if (n.tick(1, true)) fired++;
  assert.equal(fired, 0);
  assert.equal(n.tick(1, true), true);
  assert.equal(n.tick(1, true), false, 'the timer restarts after a nudge');
});

test('time that does not count (the character maker, a hidden page) never nudges', () => {
  const n = N.create(10);
  for (let i = 0; i < 50; i++) assert.equal(n.tick(1, false), false);
  for (let i = 0; i < 9; i++) assert.equal(n.tick(1, true), false);
  assert.equal(n.tick(1, true), true);
});

test('force nudges on the next tick (the browser test uses it); reset starts again', () => {
  const n = N.create();
  n.force();
  assert.equal(n.tick(0.016, true), true);
  n.force();
  n.reset();
  assert.equal(n.tick(0.016, true), false);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-nudge.test.js`
Expected: FAIL. Cannot find `nudge.js`.

- [ ] **Step 3: Write `nudge.js`**

Create `web/world/nudge.js`:

```js
/* The gentle study nudge: after 10 minutes of world time without a game, Mayor Mimi comes over. Opening a game leaves
   the page, so the count starts again there. Nothing ever locks. */
(function (root) {
  'use strict';

  var LIMIT = 600;

  // tick(dt, counting) once per frame; true once when the time is up, then it counts from 0 again.
  function create(limit) {
    var max = limit || LIMIT, acc = 0;
    return {
      tick: function (dt, counting) {
        if (counting) acc += dt;
        if (acc < max) return false;
        acc = 0;
        return true;
      },
      force: function () { acc = max; },
      reset: function () { acc = 0; }
    };
  }

  var exported = { LIMIT: LIMIT, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Nudge = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-nudge.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/nudge.js tests/world3d-nudge.test.js
```

---

### Task 8: Walking a step and where Phase 4 stands (`walk.js`, `layout.js`)

**Files:**
- Modify: `web/world/walk.js`, `web/world/layout.js`
- Test: `tests/world3d-walk.test.js`, `tests/world3d-layout.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/world3d-walk.test.js`:

```js
test('advance moves up to a distance toward a spot and says when it arrives', () => {
  const a = Walk.advance(0, 0, 3, 4, 1);
  assert.ok(close(a.x, 0.6) && close(a.z, 0.8) && a.arrived === false);
  assert.deepEqual(Walk.advance(0, 0, 3, 4, 5), { x: 3, z: 4, arrived: true });
});
```

Append to `tests/world3d-layout.test.js`:

```js
for (const grade of ['grade5', 'grade2']) {
  test(grade + ': Jesus sits on the garden bench with the lamb beside him, and she can walk up to him', () => {
    const pr = L.props(grade), g = L.places(grade).garden, obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    assert.ok(Math.abs(pr.jesus.x - pr.bench.x) <= pr.bench.hx && Math.abs(pr.jesus.z - pr.bench.z) <= pr.bench.hz, 'on the bench');
    assert.ok(Math.hypot(pr.lamb.x - g.x, pr.lamb.z - g.z) < g.r, 'the lamb is in the garden');
    assert.ok(L.blocked(obs, b, pr.lamb.x, pr.lamb.z, 0.1), 'she bumps into the lamb, not through it');
    const spot = L.jesusSpot(grade);
    assert.equal(L.blocked(obs, b, spot.x, spot.z, L.PLAYER_R), false, 'the talk spot is free');
    assert.ok(Math.hypot(spot.x - pr.jesus.x, spot.z - pr.jesus.z) < 4, 'close to him');
  });

  test(grade + ': her sister stands by the gate, in the open', () => {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds, gate = L.places(grade).gate;
    const spots = L.sisterSpots(grade);
    assert.ok(spots.length >= 1);
    for (const s of spots) {
      assert.equal(L.blocked(obs, b, s.x, s.z, L.PLAYER_R), false);
      assert.ok(Math.hypot(s.x - gate.x, s.z - gate.z) < 16, 'near the gate');
      assert.ok(Math.hypot(s.x - gate.stand[0], s.z - gate.stand[1]) > 3, 'not where she starts');
    }
  });

  test(grade + ': each ride has a free spot to tap and a free spot to land after', () => {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds, pg = L.places(grade).playground, items = L.interactables(grade);
    const rides = L.rideSpots(grade);
    assert.deepEqual(rides.map((r) => r.id), ['slide', 'swings', 'seesaw', 'merry']);
    for (const r of rides) {
      for (const p of [r, r.end]) assert.equal(L.blocked(obs, b, p.x, p.z, L.PLAYER_R), false, r.id);
      assert.ok(Math.hypot(r.x - pg.x, r.z - pg.z) < pg.r, r.id + ' is in the playground');
      const it = items.find((i) => i.id === 'ride:' + r.id);
      assert.ok(it && it.kind === 'ride' && it.ride === r.id, r.id);
      assert.equal(L.nearest(items, r.x, r.z).id, 'ride:' + r.id, 'standing there finds that ride');
    }
  });

  test(grade + ': freeSpot finds an open spot ahead of her, or one nearby when ahead is blocked', () => {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds, fort = L.props(grade).fort;
    const a = L.freeSpot(grade, 0, 84, Math.PI, 7);
    assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.z - 77) < 1e-9, 'straight up the street');
    const s = L.freeSpot(grade, 0, fort.z + fort.r + 2, Math.PI, 7);
    assert.equal(L.blocked(obs, b, s.x, s.z, 1.2), false, 'never inside the fort');
  });
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-walk.test.js tests/world3d-layout.test.js`
Expected: FAIL. `advance`, `jesusSpot`, `sisterSpots`, `rideSpots` and `freeSpot` are not functions.

- [ ] **Step 3: Add `advance`**

In `web/world/walk.js`, find:

```js
  function facing(dir) { return Math.atan2(dir.x, dir.z); }
```

Replace with:

```js
  function facing(dir) { return Math.atan2(dir.x, dir.z); }

  // Moves (x, z) up to dist toward (tx, tz), for characters who walk to her; arrived once it gets there.
  function advance(x, z, tx, tz, dist) {
    var dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    if (d <= dist) return { x: tx, z: tz, arrived: true };
    return { x: x + dx / d * dist, z: z + dz / d * dist, arrived: false };
  }
```

Find:

```js
  var exported = { SPEED: SPEED, moveVector: moveVector, toward: toward, step: step, facing: facing, turn: turn };
```

Replace with:

```js
  var exported = { SPEED: SPEED, moveVector: moveVector, toward: toward, step: step, facing: facing, turn: turn, advance: advance };
```

- [ ] **Step 4: Add the places**

In `web/world/layout.js`, find:

```js
      bench: { x: -70, z: 0, hx: 1, hz: 2.6 },
```

Replace with:

```js
      bench: { x: -70, z: 0, hx: 1, hz: 2.6 },
      jesus: { x: -69.8, z: 0 },
      lamb: { x: -67.4, z: 2.4, r: 0.9 },
```

Find:

```js
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mimi, pr.mirror, pr.pond, pr.merry].concat(pr.posts,
```

Replace with:

```js
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mimi, pr.mirror, pr.pond, pr.merry, pr.lamb].concat(pr.posts,
```

Find:

```js
    talkTrees(grade).forEach(function (t) { list.push({ kind: 'tree', id: 'tree:' + t.talk, tree: t.talk, x: t.x, z: t.z, r: 1.1 * t.s + 2.2 }); });
    return list;
  }
```

Replace with:

```js
    talkTrees(grade).forEach(function (t) { list.push({ kind: 'tree', id: 'tree:' + t.talk, tree: t.talk, x: t.x, z: t.z, r: 1.1 * t.s + 2.2 }); });
    rideSpots(grade).forEach(function (s) { list.push({ kind: 'ride', id: 'ride:' + s.id, ride: s.id, x: s.x, z: s.z, r: 2.2 }); });
    return list;
  }
```

Find:

```js
  function appUrl(grade, folder) {
```

Replace with:

```js
  // Where she stands to talk with Jesus on his bench (he looks east, into the garden).
  function jesusSpot(grade) {
    var j = props(grade).jesus;
    return { x: j.x + 3.4, z: j.z };
  }

  // Her sister waits beside the street just inside the gate, facing the gate, so she sees her on the way in.
  function sisterSpots() {
    return [{ x: -5.5, z: 80, face: 0.4 }, { x: 5.5, z: 80, face: -0.4 }];
  }

  // Where she taps each ride, and where she lands when it ends (the bottom of the slide; beside the others).
  function rideSpots(grade) {
    var pr = props(grade), sl = pr.slide, sw = pr.swings, se = pr.seesaw, mr = pr.merry;
    function spot(id, x, z, end) { return { id: id, x: x, z: z, end: end || { x: x, z: z, face: 0 } }; }
    return [
      spot('slide', sl.x, sl.z - sl.hz - 1.6, { x: sl.x, z: sl.z + sl.hz + 2.2, face: 0 }),
      spot('swings', sw.x + 1.2, sw.z + sw.hz + 1.6),
      spot('seesaw', se.x + 2.6, se.z + se.hz + 1.6),
      spot('merry', mr.x, mr.z + mr.r + 1.4)
    ];
  }

  // A free spot about d from (x, z), ahead of `face` when it can be, so a visitor appears where she can see them.
  function freeSpot(grade, x, z, face, d) {
    var obs = obstacles(grade), b = GRADES[grade].bounds, turns = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI];
    for (var i = 0; i < turns.length; i++) {
      var a = face + turns[i], px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      if (!blocked(obs, b, px, pz, 1.2)) return { x: px, z: pz };
    }
    return { x: x, z: z };
  }

  function appUrl(grade, folder) {
```

Find:

```js
    talkTrees: talkTrees, buddies: buddies,
```

Replace with:

```js
    talkTrees: talkTrees, buddies: buddies, jesusSpot: jesusSpot, sisterSpots: sisterSpots, rideSpots: rideSpots, freeSpot: freeSpot,
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/world3d-walk.test.js tests/world3d-layout.test.js`
Expected: PASS (the older layout tests too: the lamb and the ride spots stay out of every path she walks).

- [ ] **Step 6: Stage**

```bash
git add web/world/walk.js web/world/layout.js tests/world3d-walk.test.js tests/world3d-layout.test.js
```

---

### Task 9: Ride maths (`rides.js`)

**Files:**
- Create: `web/world/rides.js`
- Test: Create `tests/world3d-rides.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-rides.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const R = require(worldFile('rides.js'));
const L = require(worldFile('layout.js'));

const pr = L.props('grade5');
const steps = Array.from({ length: 21 }, (_, i) => i / 20);

test('each ride takes a few seconds and ends at rest', () => {
  assert.deepEqual(Object.keys(R.RIDES), ['slide', 'swings', 'seesaw', 'merry']);
  for (const id of Object.keys(R.RIDES)) {
    assert.ok(R.RIDES[id].time >= 1.5 && R.RIDES[id].time <= 5, id);
    assert.equal(R.part(id, 1), R.part(id, null), id + ' stops where it rests');
    assert.equal(R.part(id, 0), R.part(id, null), id + ' starts where it rests');
  }
});

test('her pose stays sensible all ride long, in the playground', () => {
  const pg = L.places('grade5').playground;
  for (const id of Object.keys(R.RIDES)) {
    for (const k of steps) {
      const p = R.pose(pr, id, k);
      for (const f of ['x', 'y', 'z', 'face']) assert.ok(Number.isFinite(p[f]), id + ' ' + f + ' at ' + k);
      assert.ok(p.y >= -1 && p.y < 4, id + ' height at ' + k);
      assert.ok(Math.hypot(p.x - pg.x, p.z - pg.z) < pg.r, id + ' at ' + k);
    }
  }
});

test('she sits on the swing and moves with its seat', () => {
  const k = 0.12, a = R.part('swings', k), p = R.pose(pr, 'swings', k);
  assert.ok(Math.abs(a) > 0.3, 'the swing is out');
  assert.equal(p.sit, true);
  assert.ok(Math.abs(p.z - (pr.swings.z - 3.2 * Math.sin(a))) < 1e-9);
});

test('the slide takes her from the top to the bottom', () => {
  const top = R.pose(pr, 'slide', 0.3), low = R.pose(pr, 'slide', 0.95);
  assert.ok(top.y > low.y && low.z > top.z);
  assert.equal(low.sit, true);
});

test('the merry-go-round carries her round its middle', () => {
  const a = R.pose(pr, 'merry', 0.25), b = R.pose(pr, 'merry', 0.5);
  for (const p of [a, b]) assert.ok(Math.abs(Math.hypot(p.x - pr.merry.x, p.z - pr.merry.z) - 1.5) < 1e-9);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.5, 'she moved round');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-rides.test.js`
Expected: FAIL. Cannot find `rides.js`.

- [ ] **Step 3: Write `rides.js`**

Create `web/world/rides.js`:

```js
/* The playground rides as plain maths: how far each moving part turns at moment k (0 to 1) of a ride, and where she is
   then. build.js turns the parts and play.js puts her there. pr = Layout.props(grade). Sitting puts her hips (1.05 up
   from her feet) on the seat. */
(function (root) {
  'use strict';

  var RIDES = { slide: { time: 2 }, swings: { time: 4 }, seesaw: { time: 4 }, merry: { time: 4 } };
  var BAR = 4.4, ROPE = 3.2, SEAT = 1.2, PLANK = 2.6, PLANK_Y = 0.9, TILT = 0.15, MERRY = 1.5, DECK = 0.7, HIPS = 1.05;
  // The slide's ramp in build.js: centre 1.8 up and 0.4 south of the slide's spot, 5.6 long, tilted 0.55.
  var RAMP = { y: 1.8, dz: 0.4, half: 2.8, tilt: 0.55 };

  function ease(k) { return k * k * (3 - 2 * k); }
  function fade(k) { return k < 0.8 ? 1 : Math.max(0, (1 - k) / 0.2); }

  // The swing's angle, the see-saw's tilt or the merry-go-round's turn at k; null (or the end) is at rest.
  function part(id, k) {
    if (k === null || k === undefined || k <= 0 || k >= 1) return id === 'seesaw' ? TILT : 0;
    if (id === 'swings') return 0.7 * Math.sin(k * Math.PI * 4) * fade(k);
    if (id === 'seesaw') return 0.3 * Math.sin(k * Math.PI * 4 + Math.PI / 6);
    if (id === 'merry') return Math.PI * 4 * ease(k);
    return 0;
  }

  // { x, y, z, face, sit, cheer } for her at moment k of the ride.
  function pose(pr, id, k) {
    var a = part(id, k);
    if (id === 'swings') {
      var sw = pr.swings;
      return { x: sw.x + SEAT, y: BAR - ROPE * Math.cos(a) - HIPS + 0.1, z: sw.z - ROPE * Math.sin(a), face: 0, sit: true, cheer: false };
    }
    if (id === 'seesaw') {
      var se = pr.seesaw;
      return { x: se.x + PLANK * Math.cos(a), y: PLANK_Y + PLANK * Math.sin(a) - HIPS + 0.15, z: se.z, face: -Math.PI / 2, sit: true, cheer: false };
    }
    if (id === 'merry') {
      var mr = pr.merry;
      return { x: mr.x + MERRY * Math.sin(a), y: DECK, z: mr.z + MERRY * Math.cos(a), face: a + Math.PI / 2, sit: false, cheer: true };
    }
    var sl = pr.slide;
    if (k < 0.25) return { x: sl.x, y: 3.6, z: sl.z - 2.4, face: 0, sit: false, cheer: false };
    var u = ease(Math.min(1, (k - 0.25) / 0.75)), c = Math.cos(RAMP.tilt) * RAMP.half, s = Math.sin(RAMP.tilt) * RAMP.half;
    var z0 = sl.z + RAMP.dz - c, z1 = sl.z + RAMP.dz + c, y0 = RAMP.y + s, y1 = RAMP.y - s;
    return { x: sl.x, y: Math.max(0, y0 + (y1 - y0) * u - HIPS + 0.05), z: z0 + (z1 - z0) * u, face: 0, sit: true, cheer: u > 0.85 };
  }

  var exported = { RIDES: RIDES, part: part, pose: pose };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Rides = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-rides.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/rides.js tests/world3d-rides.test.js
```

---

### Task 10: The 3D parts (`cast.js`, `avatar.js`, `build.js`)

No Node tests here (Three.js). They are checked by the browser test (Task 13) and the look check (Task 14).

**Files:**
- Modify: `web/world/cast.js`, `web/world/avatar.js`, `web/world/build.js`

- [ ] **Step 1: Jesus and the lamb**

In `web/world/cast.js`, find:

```js
  W.Cast = { mimi: mimi, buddy: buddy, hoot: hoot, bunny: bunny, treeFace: treeFace };
```

Replace with:

```js
  // His face from the agreed mockup: kind closed-eye smile, rosy cheeks, a short beard.
  function jesusFace(S) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#f6d3b0'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#4a2c1a'; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.arc(88, 120, 16, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.beginPath(); x.arc(168, 120, 16, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.fillStyle = 'rgba(255,140,150,.45)';
    x.beginPath(); x.ellipse(60, 150, 20, 11, 0, 0, 7); x.ellipse(196, 150, 20, 11, 0, 0, 7); x.fill();
    x.fillStyle = '#8a5a36';
    x.beginPath(); x.moveTo(30, 175); x.quadraticCurveTo(128, 300, 226, 175); x.lineTo(226, 256); x.lineTo(30, 256); x.closePath(); x.fill();
    x.strokeStyle = '#4a2c1a'; x.lineWidth = 7;
    x.beginPath(); x.arc(128, 150, 16, 0.3, Math.PI - 0.3); x.stroke();
    return S.canvasTexture(c);
  }

  // Jesus in a white robe with a blue sash and a soft halo. sit(on) seats him on the garden bench, walk(on) steps,
  // glow(on) lights the golden ring he comes in on a hard day, hug() opens his arms once.
  function jesus(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, SKIN = '#f6d3b0', HAIR = '#7a4a2a', ROBE = '#fffaf2';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(S.cyl(0.95, 1.5, 2.6, 28), ROBE, 0, 2.6, 0, body);
    add(rbox(0.55, 3.1, 2.75, 0.25), '#6fa8ff', 0, 2.75, 0, body).rotation.z = 0.55;
    add(S.torus(1.05, 0.12, 8, 28), '#e8c46a', 0, 2.2, 0, body).rotation.x = Math.PI / 2;
    var top = new THREE.Group();
    top.position.y = 4.9;
    body.add(top);
    var skin = S.toon(SKIN), face = new THREE.MeshToonMaterial({ map: jesusFace(S), gradientMap: S.ramp });
    add(rbox(2.5, 2.4, 2.3, 0.9), [skin, skin, skin, skin, face, skin], 0, 0, 0, top);
    add(rbox(2.7, 1, 2.5, 0.45), HAIR, 0, 1.05, -0.1, top);
    add(rbox(2.8, 2.6, 0.9, 0.45), HAIR, 0, -0.25, -0.95, top);
    [-1, 1].forEach(function (s) { add(rbox(0.6, 2.2, 1.4, 0.3), HAIR, s * 1.3, -0.35, -0.3, top); });
    var halo = new THREE.Mesh(S.torus(1.15, 0.13, 12, 48), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
    halo.position.set(0, 1.95, -0.2);
    halo.rotation.x = Math.PI / 2.4;
    top.add(halo);
    var shine = new THREE.Mesh(S.circle(2.6, 48), new THREE.MeshBasicMaterial({ color: '#fff3b8', transparent: true, opacity: 0.45, depthWrite: false }));
    shine.position.set(0, 0.2, -1.4);
    top.add(shine);
    function arm(side) {
      var p = new THREE.Group();
      p.position.set(side * 1.05, 3.6, 0.1);
      p.rotation.x = -0.4;
      body.add(p);
      add(rbox(0.65, 1.5, 0.65, 0.3), ROBE, 0, -0.75, 0, p);
      add(S.ball(0.3), SKIN, 0, -1.6, 0, p);
      return p;
    }
    var armL = arm(-1), armR = arm(1);
    var feet = [-0.45, 0.45].map(function (x) { return add(rbox(0.6, 0.3, 0.9, 0.14), '#c98f62', x, 0.15, 0.4, body); });
    var ring = new THREE.Mesh(S.torus(2.4, 0.18, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    ring.visible = false;
    group.add(ring);
    var disk = new THREE.Mesh(S.circle(2.4, 40), new THREE.MeshBasicMaterial({ color: '#fff3b8', transparent: true, opacity: 0.35, depthWrite: false }));
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = 0.15;
    disk.visible = false;
    group.add(disk);

    var hugT = 0, walking = false, sitting = false;
    function animate(t, dt) {
      top.rotation.z = Math.sin(t * 1.2) * 0.05;
      top.position.y = 4.9 + Math.sin(t * 1.6) * 0.05;
      halo.rotation.z = t * 0.6;
      shine.material.opacity = 0.35 + Math.sin(t * 2) * 0.1;
      var open = hugT > 0 ? Math.sin(Math.min(1, (1.2 - hugT) * 3) * Math.PI / 2) : 0;
      hugT = Math.max(0, hugT - (dt || 0));
      armL.rotation.z = -0.5 - open * 0.9;
      armR.rotation.z = 0.5 + open * 0.9;
      var step = walking ? Math.sin(t * 9) : 0;
      feet[0].position.z = sitting ? 1.1 : 0.4 + step * 0.35;
      feet[1].position.z = sitting ? 1.1 : 0.4 - step * 0.35;
      body.position.y = (sitting ? 0.25 : 0) + Math.abs(step) * 0.15;
      if (ring.visible) {
        ring.material.opacity = 0.5 + Math.sin(t * 3) * 0.2;
        ring.rotation.z = t;
      }
    }
    return {
      group: group, animate: animate,
      hug: function () { hugT = 1.2; },
      sit: function (on) { sitting = on; },
      walk: function (on) { walking = on; },
      glow: function (on) { ring.visible = disk.visible = on; }
    };
  }

  // The garden's little lamb: woolly puffs and a dark face; it hops gently.
  function lamb(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, DARK = '#3a3040';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    [[0, 0.9, 0, 0.75], [0.6, 0.95, 0, 0.55], [-0.6, 0.95, 0, 0.55], [0, 1.25, 0.3, 0.55], [0, 1.2, -0.4, 0.5]].forEach(function (p) {
      add(ball(p[3]), '#ffffff', p[0], p[1], p[2], body);
    });
    add(ball(0.45), DARK, 0, 1.3, 0.95, body).scale.set(1, 0.9, 1.1);
    [-0.35, 0.35].forEach(function (x) { add(ball(0.17), DARK, x, 1.5, 0.85, body).scale.set(1.6, 0.6, 0.8); });
    [-0.15, 0.15].forEach(function (x) { add(ball(0.06), '#ffffff', x, 1.4, 1.35, body); });
    [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4]].forEach(function (p) { add(S.cyl(0.12, 0.12, 0.6, 10), DARK, p[0], 0.3, p[1], body); });
    return { group: group, animate: function (t) { body.position.y = Math.abs(Math.sin(t * 3)) * 0.15; } };
  }

  W.Cast = { mimi: mimi, buddy: buddy, hoot: hoot, bunny: bunny, treeFace: treeFace, jesus: jesus, lamb: lamb };
```

- [ ] **Step 2: Sit, wave and cheer poses**

In `web/world/avatar.js`, find:

```js
    function animate(t, walkT, mag) {
      var m = Math.min(1, mag), sw = Math.sin(walkT) * 0.7 * m, hop = Math.abs(Math.sin(walkT));
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw; armR.rotation.x = sw;
      armL.rotation.z = -0.25; armR.rotation.z = 0.25;
      body.position.y = hop * 0.25 * Math.min(1, m * 2);
      body.scale.set(1 + (1 - hop) * 0.04 * m, 1 - (1 - hop) * 0.05 * m, 1);
```

Replace with:

```js
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
```

- [ ] **Step 3: Moving playground parts and hearts**

In `web/world/build.js`, find:

```js
    var cheerTex = CHEER.map(function (e) { return S.emoji(e); });
    var doorMats = {}, signs = [], clouds = [], sparks = [], parts = {}, shopGroup = null, fortParts = null;
```

Replace with:

```js
    var cheerTex = CHEER.map(function (e) { return S.emoji(e); });
    var heartTex = ['💛', '💗', '✨'].map(function (e) { return S.emoji(e); });
    var doorMats = {}, signs = [], clouds = [], sparks = [], parts = {}, shopGroup = null, fortParts = null, rideParts = null;
```

Find the whole playground function:

```js
    function playground(p) {
      flat(add(S.cyl(p.r, p.r, 0.1, 48), '#ffe9b8', p.x, 0.04, p.z));
      var sl = pr.slide, sw = pr.swings, se = pr.seesaw, mr = pr.merry;
      add(rbox(1.6, 0.3, 5.6, 0.15), '#ff8fab', sl.x, 1.8, sl.z + 0.4, null).rotation.x = -0.55;
      add(rbox(1.6, 3.6, 1.4, 0.3), '#6aa9ff', sl.x, 1.8, sl.z - 2.4);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x - 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x + 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 6, 8), '#a77bff', sw.x, 4.4, sw.z).rotation.z = Math.PI / 2;
      add(rbox(1, 0.2, 0.7, 0.1), '#ffd166', sw.x - 1.2, 1.2, sw.z);
      add(rbox(1, 0.2, 0.7, 0.1), '#ffd166', sw.x + 1.2, 1.2, sw.z);
      add(rbox(6, 0.25, 0.7, 0.12), '#5fcf9a', se.x, 0.9, se.z).rotation.z = 0.15;
      add(S.cone(0.6, 0.8, 4), '#ffffff', se.x, 0.4, se.z);
      add(S.cyl(mr.r, mr.r, 0.4, 24), '#ff9e6b', mr.x, 0.5, mr.z);
      add(S.cyl(0.2, 0.2, 2, 8), '#ffffff', mr.x, 1.6, mr.z);
      floatSign(L.PLACE_EMOJI.playground + ' ' + T.places.playground, '#ff9e6b', p.x, 7.5, p.z, 7 * cfg.signScale);
    }
```

Replace with:

```js
    // A swing hangs from the bar on two ropes; its group turns about the bar (rides.js gives the angle).
    function swing(x, z) {
      var pivot = new THREE.Group();
      pivot.position.set(x, 4.4, z);
      S.scene.add(pivot);
      [-0.4, 0.4].forEach(function (dx) { add(S.cyl(0.05, 0.05, 3.2, 6), '#ffffff', dx, -1.6, 0, pivot); });
      add(rbox(1, 0.2, 0.7, 0.1), '#ffd166', 0, -3.2, 0, pivot);
      return pivot;
    }

    function playground(p) {
      flat(add(S.cyl(p.r, p.r, 0.1, 48), '#ffe9b8', p.x, 0.04, p.z));
      var sl = pr.slide, sw = pr.swings, se = pr.seesaw, mr = pr.merry;
      add(rbox(1.6, 0.3, 5.6, 0.15), '#ff8fab', sl.x, 1.8, sl.z + 0.4, null).rotation.x = -0.55;
      add(rbox(1.6, 3.6, 1.4, 0.3), '#6aa9ff', sl.x, 1.8, sl.z - 2.4);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x - 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x + 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 6, 8), '#a77bff', sw.x, 4.4, sw.z).rotation.z = Math.PI / 2;
      swing(sw.x - 1.2, sw.z);
      var pivot = swing(sw.x + 1.2, sw.z);
      var plank = new THREE.Group();
      plank.position.set(se.x, 0.9, se.z);
      plank.rotation.z = W.Rides.part('seesaw', null);
      S.scene.add(plank);
      add(rbox(6, 0.25, 0.7, 0.12), '#5fcf9a', 0, 0, 0, plank);
      add(S.cone(0.6, 0.8, 4), '#ffffff', se.x, 0.4, se.z);
      var merry = new THREE.Group();
      merry.position.set(mr.x, 0, mr.z);
      S.scene.add(merry);
      add(S.cyl(mr.r, mr.r, 0.4, 24), '#ff9e6b', 0, 0.5, 0, merry);
      add(S.cyl(0.2, 0.2, 2, 8), '#ffffff', 0, 1.6, 0, merry);
      for (var h = 0; h < 4; h++) add(S.cyl(0.08, 0.08, 1.2, 6), '#ffffff', Math.cos(h * Math.PI / 2) * 1.7, 1.2, Math.sin(h * Math.PI / 2) * 1.7, merry);
      rideParts = { pivot: pivot, plank: plank, merry: merry };
      floatSign(L.PLACE_EMOJI.playground + ' ' + T.places.playground, '#ff9e6b', p.x, 7.5, p.z, 7 * cfg.signScale);
    }
```

Find:

```js
    function animate(t, dt, nearDoor) {
```

Replace with:

```js
    // Jesus's hug and a cheer for her sister: hearts float up and fade.
    function hearts(x, y, z) {
      for (var i = 0; i < 14; i++) {
        var s = S.sprite(heartTex[i % heartTex.length], 0.9, 0.9);
        s.position.set(x + (Math.random() - 0.5) * 3, y + Math.random(), z + (Math.random() - 0.5) * 3);
        S.scene.add(s);
        sparks.push({ s: s, vx: (Math.random() - 0.5) * 1.2, vy: 1.5 + Math.random() * 1.5, life: 2.4, keep: true });
      }
    }

    // Turns a ride's moving part to moment k of the ride; k null puts it back at rest.
    function ride(id, k) {
      if (!rideParts) return;
      var a = W.Rides.part(id, k);
      if (id === 'swings') rideParts.pivot.rotation.x = a;
      else if (id === 'seesaw') rideParts.plank.rotation.z = a;
      else if (id === 'merry') rideParts.merry.rotation.y = a;
    }

    function animate(t, dt, nearDoor) {
```

Find:

```js
    return { animate: animate, sparkle: sparkle, cheer: cheer, buildings: parts, shop: shopGroup, fort: fortParts };
```

Replace with:

```js
    return { animate: animate, sparkle: sparkle, cheer: cheer, hearts: hearts, ride: ride, buildings: parts, shop: shopGroup, fort: fortParts };
```

- [ ] **Step 4: Syntax check**

Run: `node --check web/world/cast.js && node --check web/world/avatar.js && node --check web/world/build.js`
Expected: no output.

- [ ] **Step 5: Stage**

```bash
git add web/world/cast.js web/world/avatar.js web/world/build.js
```

---

### Task 11: Jesus and her sister (`kin.js`)

**Files:**
- Create: `web/world/kin.js`

The browser test in Task 13 covers it.

- [ ] **Step 1: Write `kin.js`**

Create `web/world/kin.js`:

```js
/* Phase 4 of the world: family and comfort. Jesus sits on his garden bench with the lamb and talks with her (🤗 Hug,
   💬 More); once a local day he greets her where she starts, and on a hard day he comes to her in a soft golden glow.
   Her sister stands by the gate in her own look and takes one-tap cheers. Nothing here quizzes, pays or compares. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SPEED = 4.5, MEET = 3.2, APPEAR = 7, GIVE_UP = 10, LEAVE = 1.5, SEAT_FACE = Math.PI / 2;

  // o = { S, built, grade, T, store, today(), yesterday(), dayKey(ms), busy(on), isBusy(), sound(name) }
  function create(o) {
    var L = W.Layout, C = W.Care, S = o.S, T = o.T, grade = o.grade, doc = root.document;
    var J = W.Lines.JESUS[grade], pr = L.props(grade), seat = pr.jesus, spot = L.jesusSpot(grade);
    var F = root.Family && root.Family.sisters ? root.Family : null, FT = F && F.TEXT ? F.TEXT[grade] : null;
    var jesus = W.Cast.jesus(S), lamb = W.Cast.lamb(S);
    S.scene.add(jesus.group);
    S.scene.add(lamb.group);
    lamb.group.position.set(pr.lamb.x, 0, pr.lamb.z);
    lamb.group.rotation.y = -2.2;
    var jz = { mode: 'garden', kind: null, x: seat.x, z: seat.z, t: 0 };
    var pending = null, why = null, tally = null, talk = null, hugs = 0, sisters = [];

    function english(s) { return String(s).split(' · ').pop(); }
    function look(x, z) { return Math.atan2(x - jz.x, z - jz.z); }
    function put(x, z, face) {
      jz.x = x;
      jz.z = z;
      jesus.group.position.set(x, 0, z);
      jesus.group.rotation.y = face;
    }
    function sitDown() {
      jz.mode = 'garden';
      jesus.sit(true);
      jesus.walk(false);
      jesus.glow(false);
      put(seat.x, seat.z, SEAT_FACE);
    }

    function say(face, who, text, sub, buttons, stack) {
      if (talk) talk.close();
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: face, who: who, text: text, sub: sub, stack: !!stack, pair: grade === 'grade2', buttons: buttons,
        onClose: function () { if (talk === mine) { talk = null; o.busy(false); } }
      });
    }

    // The verse and where it is, under his words; Grade 2 shows the Filipino and English verse on their own lines.
    function verse(line) { return line.verse.split(' · ').concat(['📖 ' + line.ref]).join('\n'); }
    function sayJesus(line, buttons) { say('💛', T.jesus, line.say, verse(line), buttons); }

    function hug() {
      jesus.hug();
      o.built.hearts(jz.x, 5, jz.z);
      o.sound('allRead');
      sayJesus(C.pick(J.hug, o.today(), hugs++), [{ text: T.bye }]);
    }
    function hugButton() { return { text: T.hug, main: true, onClick: hug }; }

    function openGarden() {
      var lines = C.gardenLines(J, tally, o.today()), i = 0;
      function show() {
        sayJesus(lines[i], [hugButton(), { text: T.more, onClick: function () { i = (i + 1) % lines.length; show(); } }, { text: T.bye }]);
      }
      show();
    }

    // What kind of day she is having, from the same records the lobby keeps.
    function reasonNow() {
      var today = o.today(), entries = [], days = [], missed = false;
      try { entries = root.StudyHistory && root.StudyHistory.list ? root.StudyHistory.list() : []; } catch (e) {}
      try { days = root.Quests && root.Quests.read ? root.Quests.read(o.store).days : []; } catch (e) {}
      try { missed = !!(root.Boss && root.Boss.missedDay) && root.Boss.missedDay(o.store) === today; } catch (e) {}
      tally = C.tally(entries, today, o.dayKey);
      var broke = root.Quests && root.Quests.streakOf ? C.streakBroke(days, today, o.yesterday(), root.Quests.streakOf) : false;
      return C.hardDay({ tally: tally, broke: broke, bossMissed: missed });
    }

    // On world open and on coming back to it: does Jesus visit?
    function check() {
      if (jz.mode !== 'garden') return;
      why = reasonNow();
      pending = C.visit(W.Prefs.readDaily(o.store), o.today(), why);
    }

    function startVisit(st) {
      var at = L.freeSpot(grade, st.x, st.z, st.face, APPEAR);
      jz.kind = pending;
      pending = null;
      jz.mode = 'come';
      jz.t = 0;
      jesus.sit(false);
      jesus.glow(jz.kind === 'comfort');
      put(at.x, at.z, Math.atan2(st.x - at.x, st.z - at.z));
      o.built.sparkle(at.x, at.z);
    }

    function meet() {
      var today = o.today(), now = Date.now(), line;
      jz.mode = 'talk';
      jesus.walk(false);
      W.Prefs.markDaily(o.store, 'greeted', today, now);
      if (jz.kind === 'comfort') {
        W.Prefs.markDaily(o.store, 'comforted', today, now);
        line = C.pick(J.comfort[why] || J.comfort.wrong, today, 0);
      } else line = C.pick(J.greet, today, 0);
      sayJesus(line, [hugButton(), { text: T.bye }]);
    }

    function tickJesus(dt, st, free) {
      if (jz.mode === 'garden') {
        if (pending && free) startVisit(st);
        return;
      }
      if (jz.mode === 'come') {
        jz.t += dt;
        var d = Math.hypot(st.x - jz.x, st.z - jz.z);
        if (d > MEET && jz.t < GIVE_UP) {
          var p = W.Walk.advance(jz.x, jz.z, st.x, st.z, SPEED * dt);
          jesus.walk(true);
          put(p.x, p.z, look(st.x, st.z));
          return;
        }
        // She kept walking away: he comes to her side with a sparkle.
        if (d > MEET) {
          var near = L.freeSpot(grade, st.x, st.z, st.face, MEET - 0.4);
          o.built.sparkle(jz.x, jz.z);
          put(near.x, near.z, 0);
        }
        jesus.walk(false);
        put(jz.x, jz.z, look(st.x, st.z));
        if (!o.isBusy()) meet();
        return;
      }
      if (jz.mode === 'talk') {
        put(jz.x, jz.z, look(st.x, st.z));
        // Hug opens a new bubble in the same click, so the talk is over only when no bubble is left.
        if (!talk) {
          jz.mode = 'leave';
          jz.t = 0;
          jesus.walk(true);
        }
        return;
      }
      // Walking back: a few steps toward the garden, then a golden sparkle puts him on his bench.
      jz.t += dt;
      var q = W.Walk.advance(jz.x, jz.z, seat.x, seat.z, SPEED * dt);
      put(q.x, q.z, look(seat.x, seat.z));
      if (jz.t >= LEAVE || q.arrived) {
        o.built.sparkle(jz.x, jz.z);
        sitDown();
        o.built.sparkle(seat.x, seat.z);
      }
    }

    // Her sister's character by the gate, in her own look from the family peek (or the default while she chooses).
    function buildSisters() {
      if (!F || !FT) return;
      var me = null, list = [];
      try { me = root.Learner && root.Learner.current ? root.Learner.current() : null; } catch (e) {}
      try { list = F.sisters(me || { id: '', grade: 0 }, F.readPeek(o.store), Date.now(), F.readSeen(o.store)); } catch (e) {}
      var spots = L.sisterSpots(grade);
      sisters = list.slice(0, spots.length).map(function (s, i) {
        var sp = spots[i], lk = W.Look.clean(s.look), made = lk.t > 0, name = s.name || english(FT[s.rel] || FT.sister);
        var ch = W.Avatar.character(S, lk), pet = W.Avatar.pet(S, lk.pet);
        ch.group.position.set(sp.x, 0, sp.z);
        ch.group.rotation.y = sp.face;
        pet.group.position.set(sp.x + 1.4, 0, sp.z + 1);
        S.scene.add(ch.group);
        S.scene.add(pet.group);
        var tag = S.sprite(S.label('💖 ' + name + (s.playing ? ' 🎮' : ''), '#e46ba0'), 4.4, 4.4 * 180 / 512);
        tag.position.set(sp.x, 7, sp.z);
        S.scene.add(tag);
        var mark = !made ? '🎨' : s.playing ? '✨' : null;
        if (mark) {
          var m = S.sprite(S.emoji(mark), 1.6, 1.6);
          m.position.set(sp.x, 8.6, sp.z);
          S.scene.add(m);
        }
        return { s: s, ch: ch, pet: pet, x: sp.x, z: sp.z, name: name, made: made, myGrade: me ? Number(me.grade) || 0 : 0, cheered: 0 };
      });
    }

    function openSister(k) {
      var x = sisters[k], s = x.s;
      if (!F.canSend(o.store, Date.now, null).ok) return say('💖', x.name, FT.limit, '', [{ text: T.bye }]);
      var line = (!x.made ? T.sisterChoosing : s.playing ? T.sisterPlaying : T.sisterHello).split('{name}').join(x.name);
      var buttons = F.CHEERS[F.voiceOf(F.relation(s.grade, x.myGrade))].map(function (c) {
        return { text: c.text, onClick: function () { cheer(k, c.id); } };
      });
      say('💖', x.name, line, '', buttons.concat([{ text: T.bye }]), true);
    }

    function cheer(k, id) {
      var x = sisters[k], ok = F.send(o.store, Date.now, Math.random, x.s.id, id);
      if (ok) {
        o.built.hearts(x.x, 5, x.z);
        o.sound('allRead');
        x.cheered = 3;
      }
      var buttons = ok ? [{ text: T.cheerAgain, main: true, onClick: function () { openSister(k); } }, { text: T.bye }] : [{ text: T.bye }];
      say('💖', x.name, ok ? FT.sent : FT.limit, '', buttons);
    }

    // Moving and family characters, added to world-main's interactables each frame.
    function items() {
      var out = jz.mode === 'garden' ? [{ kind: 'jesus', id: 'jesus', x: spot.x, z: spot.z, r: 3 }] : [];
      sisters.forEach(function (x, k) { out.push({ kind: 'sister', id: 'sister:' + x.s.id, sister: k, x: x.x, z: x.z, r: 2.8 }); });
      return out;
    }

    function label(it) {
      if (it.kind === 'jesus') return T.talkTo.replace('{name}', english(T.jesus));
      if (it.kind === 'sister') return T.talkTo.replace('{name}', sisters[it.sister].name);
      return null;
    }

    function act(it) {
      if (talk) return;
      if (it.kind === 'jesus') openGarden();
      else if (it.kind === 'sister') openSister(it.sister);
    }

    // free: she is not in the maker, a card, a bubble or a ride, so a visit may start.
    function tick(t, dt, st, free) {
      jesus.animate(t, dt);
      lamb.animate(t);
      sisters.forEach(function (x) {
        x.cheered = Math.max(0, x.cheered - dt);
        x.ch.animate(t, 0, 0, { wave: x.s.playing || x.cheered > 0 });
        x.pet.animate(t);
      });
      tickJesus(dt, st, free);
    }

    sitDown();
    buildSisters();

    return {
      check: check, tick: tick, items: items, label: label, act: act,
      handles: function (kind) { return kind === 'jesus' || kind === 'sister'; },
      visiting: function () { return jz.mode === 'come' || jz.mode === 'talk'; },
      closeTalk: function () { if (talk) talk.close(); },
      debug: function () { return { mode: jz.mode, x: jz.x, z: jz.z, glow: jz.mode !== 'garden' && jz.kind === 'comfort' }; },
      sisterIds: function () { return sisters.map(function (x) { return x.s.id; }); }
    };
  }

  W.Kin = { create: create };
})(this);
```

- [ ] **Step 2: Syntax check**

Run: `node --check web/world/kin.js`
Expected: no output.

- [ ] **Step 3: Stage**

```bash
git add web/world/kin.js
```

---

### Task 12: Rides, Mimi's nudge and the wiring (`play.js`, `town.js`, `world-main.js`, pages)

**Files:**
- Create: `web/world/play.js`
- Modify: `web/world/town.js`, `web/world/world-main.js`, `web/world/grade-5.html`, `web/world/grade-2.html`, `tests/paths.js`
- Test: `tests/world3d-wiring.test.js` (via `tests/paths.js`)

- [ ] **Step 1: Write the failing test (the new load order)**

In `tests/paths.js`, find:

```js
const WORLD_FILES = ['text.js', 'layout.js', 'look.js', 'prefs.js', 'walk.js', 'music.js', 'progress.js', 'buddies.js', 'lines.js', 'chat.js', 'quiz.js', 'lesson-files.js', 'scene.js', 'build.js', 'decor.js', 'cast.js', 'talk.js', 'ask.js', 'avatar.js', 'move.js', 'maker.js', 'town.js', 'folk.js', 'world-main.js'];
```

Replace with:

```js
const WORLD_FILES = ['text.js', 'layout.js', 'look.js', 'prefs.js', 'walk.js', 'music.js', 'progress.js', 'buddies.js', 'lines.js', 'care.js', 'nudge.js', 'rides.js', 'chat.js', 'quiz.js', 'lesson-files.js', 'scene.js', 'build.js', 'decor.js', 'cast.js', 'talk.js', 'ask.js', 'avatar.js', 'move.js', 'maker.js', 'town.js', 'folk.js', 'kin.js', 'play.js', 'world-main.js'];
```

Find:

```js
// The engine files a world page loads, in order; world.js and subjects.js load without data-grade (pure helpers only).
// study-kit scores ❓ Ask me! answers the way the games do (and catches the lesson files ask.js loads).
const WORLD_ENGINES = ['storage', 'learner', 'clock', 'study-history', 'recall', 'mastery', 'wallet', 'quests', 'boss', 'guide', 'world', 'subjects', 'fx', 'study-kit'];
```

Replace with:

```js
// The engine files a world page loads, in order; world.js and subjects.js load without data-grade (pure helpers only).
// study-kit scores ❓ Ask me! answers the way the games do (and catches the lesson files ask.js loads). family.js brings
// her sister and the cheers; with no #campus on the page it shows no lobby card.
const WORLD_ENGINES = ['storage', 'learner', 'clock', 'study-history', 'recall', 'mastery', 'wallet', 'quests', 'boss', 'guide', 'world', 'subjects', 'family', 'fx', 'study-kit'];
```

Run: `node --test tests/world3d-wiring.test.js`
Expected: FAIL. The pages do not load the new scripts yet.

- [ ] **Step 2: Write `play.js`**

Create `web/world/play.js`:

```js
/* Playground rides: she walks up to the slide, the swings, the see-saw or the merry-go-round and taps; she rides with
   an animation (the pet bounces beside it) and lands beside the ride. Nothing is saved or paid. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { grade, built, ctl, busy(on), sound(name) }
  function create(o) {
    var R = W.Rides, pr = W.Layout.props(o.grade), ends = {}, ride = null;
    W.Layout.rideSpots(o.grade).forEach(function (s) { ends[s.id] = s.end; });

    function start(id) {
      if (ride || !R.RIDES[id]) return;
      ride = { id: id, t: 0 };
      o.busy(true);
      o.sound('allRead');
    }

    // Each frame: her pose while she rides, or null. The last frame puts her down at the ride's end spot.
    function tick(dt) {
      if (!ride) return null;
      ride.t += dt;
      var id = ride.id, k = Math.min(1, ride.t / R.RIDES[id].time), p = R.pose(pr, id, k);
      o.built.ride(id, k);
      if (k >= 1) {
        o.built.ride(id, null);
        ride = null;
        o.ctl.teleport(ends[id].x, ends[id].z, ends[id].face);
        o.busy(false);
      }
      return p;
    }

    return { start: start, tick: tick, riding: function () { return ride ? ride.id : null; } };
  }

  W.Play = { create: create };
})(this);
```

- [ ] **Step 3: Mimi's nudge in `town.js`**

Replace the whole of `web/world/town.js` with:

```js
/* Phase 2 of the world: her progress on the map. Reads the same engines as the lobby (medals, review, quests, boss,
   wallet, guide), dresses the buildings through decor.js, puts Mayor Mimi by the fountain with her sparkle trail, and
   handles Mimi and the Boss Fort gate (Bunny's counter is folk.js's now). world-main.js asks it for button labels,
   actions and door links. If an engine is missing, the world stays plain. Phase 4: after 10 minutes without a game,
   Mimi pops up near her, walks over and points at the guide's next step. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var ARRIVE = 3, GREET = 16, NUDGE_AWAY = 6, NUDGE_MEET = 2.8, NUDGE_SPEED = 5, NUDGE_GIVE_UP = 8;

  // o = { S, built, grade, T, store, session, go(url), sound(name), busy(on), isBusy(), today(), quiet() }
  function create(o) {
    var L = W.Layout, P = W.Progress, S = o.S, T = o.T, grade = o.grade;
    var subjects = root.Subjects, n = grade === 'grade2' ? 2 : 5;
    var cards = P.cards(grade, L, subjects);
    var keys = ((subjects && subjects[n]) || []).map(function (s) { return s.pointsKey; });
    if (root.Wallet && root.Wallet.catalog && !root.Wallet.canAfford) {
      root.Wallet.canAfford = function () { return P.canAfford(root.Wallet, o.store, keys); };
    }
    var deps = root.World && root.World.liveDeps ? root.World.liveDeps(root) : null;
    var link = root.Guide && root.Guide.link ? root.Guide.link : function () { return null; };
    var decor = W.Decor.create(S, o.built, T);
    var pr = L.props(grade), plaza = L.places(grade).plaza, allSpots = L.spots(grade);

    var mimi = W.Cast.mimi(S);
    mimi.group.position.set(pr.mimi.x, 0, pr.mimi.z);
    S.scene.add(mimi.group);
    var plate = S.sprite(S.label('🐱 ' + T.mimi, '#7b5cff'), 4.4, 4.4 * 180 / 512);
    plate.position.set(pr.mimi.x, 6.4, pr.mimi.z);
    S.scene.add(plate);

    var snap = null, trailTo = null, talk = null, greeted = false, visit = null;

    function talkedToday() { return W.Prefs.readDaily(o.store).mimi === o.today(); }
    function quiet() { return !!(o.quiet && o.quiet()); }

    function refresh() {
      try {
        snap = deps && root.World.status ? P.snapshot({ cards: cards, status: root.World.status, deps: deps, link: link }) : null;
      } catch (e) { snap = null; }
      if (snap) decor.apply(snap);
      mimi.wave(!!visit || (!greeted && !talkedToday()));
      return snap;
    }

    function say(face, who, text, buttons, after) {
      o.busy(true);
      talk = W.Talk.open({ doc: root.document, face: face, who: who, text: text, pair: grade === 'grade2', buttons: buttons,
        onClose: function () {
          talk = null;
          o.busy(false);
          if (after) after();
        } });
    }

    function startTrail(id) {
      var pts = L.route(grade, id);
      if (!pts.length) return;
      decor.showTrail(pts);
      trailTo = allSpots.filter(function (s) { return s.id === id; })[0] || null;
      o.sound('allRead');
    }

    function stepButtons() {
      var target = snap && snap.target, buttons = [];
      if (target) buttons.push({ text: T.goTrail, main: true, onClick: function () { startTrail(target); } });
      buttons.push({ text: T.later });
      return buttons;
    }

    function openMimi() {
      if (talk) return;
      greeted = true;
      W.Prefs.markDaily(o.store, 'mimi', o.today(), Date.now());
      mimi.wave(false);
      var step = snap && snap.step, target = snap && snap.target;
      say('🐱', T.mimi, step ? (target ? W.Chat.join(step.text, T.follow) : step.text) : T.mimiIdle, stepButtons());
    }

    // The 10-minute nudge: Mimi pops up with a sparkle a few steps from her and walks over. false when she cannot now.
    function nudge(st) {
      if (talk || visit) return false;
      var at = L.freeSpot(grade, st.x, st.z, st.face, NUDGE_AWAY);
      visit = { t: 0, talking: false };
      plate.visible = false;
      mimi.group.position.set(at.x, 0, at.z);
      mimi.wave(true);
      o.built.sparkle(at.x, at.z);
      return true;
    }

    function goHome() {
      var p = mimi.group.position;
      o.built.sparkle(p.x, p.z);
      p.set(pr.mimi.x, 0, pr.mimi.z);
      mimi.group.rotation.y = 0;
      plate.visible = true;
      mimi.wave(false);
      visit = null;
    }

    function openNudge() {
      visit.talking = true;
      var step = snap && snap.step;
      say('🐱', T.mimi, step ? W.Chat.join(T.nudge, step.text) : T.nudge, stepButtons(), goHome);
    }

    function openFort() {
      var f = snap && snap.fort;
      if (f && f.href) {
        W.Prefs.setReturn(o.session, grade, 'boss');
        o.go(f.href);
        return;
      }
      say('🏰', T.places.boss, f && f.beaten ? T.fortBeaten : T.fortNone, [{ text: T.close }]);
    }

    function label(it) {
      if (it.kind === 'mimi') return T.mimiTalk;
      if (it.kind === 'fort') return snap && snap.fort && snap.fort.href ? T.fortGo : T.fortClosed;
      return null;
    }

    function act(it) {
      if (it.kind === 'mimi') openMimi();
      else if (it.kind === 'fort') openFort();
    }

    // Each frame: Mimi greets her the first time today she comes into the plaza (not while Jesus visits); the trail goes
    // out when she arrives; a nudging Mimi walks to her, then talks.
    function tick(t, st, dt) {
      mimi.animate(t);
      decor.animate(t);
      if (!talk && !visit && !o.isBusy() && !quiet() && !greeted && Math.hypot(st.x - plaza.x, st.z - plaza.z) < GREET && !talkedToday()) openMimi();
      if (trailTo && Math.hypot(st.x - trailTo.x, st.z - trailTo.z) < ARRIVE) {
        decor.hideTrail();
        trailTo = null;
      }
      if (visit && !visit.talking) {
        visit.t += dt || 0;
        var p = mimi.group.position, d = Math.hypot(st.x - p.x, st.z - p.z);
        if (d > NUDGE_MEET && visit.t < NUDGE_GIVE_UP) {
          var q = W.Walk.advance(p.x, p.z, st.x, st.z, NUDGE_SPEED * (dt || 0));
          p.set(q.x, 0, q.z);
          mimi.group.rotation.y = Math.atan2(st.x - q.x, st.z - q.z);
        } else if (!o.isBusy()) openNudge();
      }
    }

    return {
      refresh: refresh, label: label, act: act, tick: tick, nudge: nudge,
      handles: function (kind) { return kind === 'mimi' || kind === 'fort'; },
      doorHref: function (app, plain) { return P.doorHref(snap, app, plain); },
      snapshot: function () { return snap; },
      visiting: function () { return !!visit; },
      trail: function () { return { to: trailTo ? trailTo.id : null, count: decor.trailCount() }; },
      closeTalk: function () { if (talk) talk.close(); }
    };
  }

  W.Town = { create: create };
})(this);
```

- [ ] **Step 4: Wire it into `world-main.js`**

In `web/world/world-main.js`, find:

```js
    function busy(on) { talking = on; ctl.freeze(on); }
    function today() { return root.Guide && root.Guide.dayKey ? root.Guide.dayKey(Date.now()) : new Date().toDateString(); }
    var town = W.Town.create({
      S: S, built: world, grade: grade, T: T, store: store, session: session,
      go: function (url) { debug.go(url); }, sound: sound, busy: busy, today: today,
      isBusy: function () { return talking; }
    });
```

Replace with:

```js
    function busy(on) { talking = on; ctl.freeze(on); }
    function dayKeyOf(ms) { return root.Guide && root.Guide.dayKey ? root.Guide.dayKey(ms) : new Date(ms).toDateString(); }
    function today() { return dayKeyOf(Date.now()); }
    var town = W.Town.create({
      S: S, built: world, grade: grade, T: T, store: store, session: session,
      go: function (url) { debug.go(url); }, sound: sound, busy: busy, today: today,
      isBusy: function () { return talking; },
      quiet: function () { return kin.visiting(); }
    });
```

Find:

```js
    function refresh() {
      town.refresh();
      folk.refresh(town.snapshot());
    }
```

Replace with:

```js
    var kin = W.Kin.create({
      S: S, built: world, grade: grade, T: T, store: store, today: today, busy: busy, sound: sound, dayKey: dayKeyOf,
      yesterday: function () { return dayKeyOf(Date.now() - 86400000); },
      isBusy: function () { return talking; }
    });
    var play = W.Play.create({ grade: grade, built: world, ctl: ctl, busy: busy, sound: sound });
    var nudge = W.Nudge.create(), nudgeDue = false;
    function refresh() {
      town.refresh();
      folk.refresh(town.snapshot());
      kin.check();
    }
```

Find:

```js
      if (it.kind === 'door') return it.emoji + ' ' + T.go.replace('{name}', english(it.sign));
      if (folk.handles(it.kind)) return folk.label(it);
```

Replace with:

```js
      if (it.kind === 'door') return it.emoji + ' ' + T.go.replace('{name}', english(it.sign));
      if (it.kind === 'ride') return T.rides[it.ride];
      if (kin.handles(it.kind)) return kin.label(it);
      if (folk.handles(it.kind)) return folk.label(it);
```

Find:

```js
      else if (near.kind === 'signpost') openTravel();
      else if (folk.handles(near.kind)) folk.act(near);
```

Replace with:

```js
      else if (near.kind === 'signpost') openTravel();
      else if (near.kind === 'ride') play.start(near.ride);
      else if (kin.handles(near.kind)) kin.act(near);
      else if (folk.handles(near.kind)) folk.act(near);
```

Find:

```js
    function tick(dt) {
      t += dt;
      var st = ctl.update(dt);
      me.group.position.set(st.x, 0, st.z);
      if (maker) {
        me.group.rotation.y += dt * 0.8;
        ctl.portrait();
      } else {
        me.group.rotation.y = st.face;
        ctl.camera(dt);
      }
      me.animate(t, st.walkT, st.mag);
      followPet(dt);
      near = maker || overlay || talking ? null : L.nearest(items, st.x, st.z);
      showAct();
      world.animate(t, dt, near && near.kind === 'door' ? near.id : null);
      if (!maker) {
        town.tick(t, st);
        folk.tick(t);
      }
```

Replace with:

```js
    function tick(dt) {
      t += dt;
      var st = ctl.update(dt), pose = play.tick(dt);
      if (pose) {
        me.group.position.set(pose.x, pose.y, pose.z);
        me.group.rotation.y = pose.face;
        ctl.camera(dt);
        me.animate(t, 0, 0, pose);
      } else {
        me.group.position.set(st.x, 0, st.z);
        if (maker) {
          me.group.rotation.y += dt * 0.8;
          ctl.portrait();
        } else {
          me.group.rotation.y = st.face;
          ctl.camera(dt);
        }
        me.animate(t, st.walkT, st.mag);
      }
      followPet(dt);
      var free = !maker && !overlay && !talking;
      near = free ? L.nearest(items.concat(kin.items()), st.x, st.z) : null;
      showAct();
      world.animate(t, dt, near && near.kind === 'door' ? near.id : null);
      if (!maker) {
        town.tick(t, st, dt);
        folk.tick(t);
        kin.tick(t, dt, st, free && !town.visiting());
      }
      if (nudge.tick(dt, !doc.hidden && !maker)) nudgeDue = true;
      if (nudgeDue && free && !kin.visiting() && town.nudge(st)) nudgeDue = false;
```

Find:

```js
    debug.closeTalk = function () { town.closeTalk(); folk.closeTalk(); };
```

Replace with:

```js
    debug.closeTalk = function () { town.closeTalk(); folk.closeTalk(); kin.closeTalk(); };
    debug.jesus = kin.debug;
    debug.sisters = kin.sisterIds;
    debug.riding = play.riding;
    debug.nudgeNow = nudge.force;
    debug.refresh = refresh;
```

- [ ] **Step 5: Load the scripts on both pages**

In `web/world/grade-5.html`, find `<script src="../engine/subjects.js"></script>` and add right after it:

```html
<script src="../engine/family.js" data-grade="grade5"></script>
```

Find `<script src="lines.js"></script>` and add right after it:

```html
<script src="care.js"></script>
<script src="nudge.js"></script>
<script src="rides.js"></script>
```

Find `<script src="folk.js"></script>` and add right after it:

```html
<script src="kin.js"></script>
<script src="play.js"></script>
```

Make the same three changes in `web/world/grade-2.html`, with `data-grade="grade2"` on the `family.js` tag.

- [ ] **Step 6: Precache and run the tests**

Run: `node tools/update-precache.js && node --check web/world/play.js && node --check web/world/town.js && node --check web/world/world-main.js && node --test`
Expected: PASS, including `tests/world3d-wiring.test.js` and the PRECACHE test.

- [ ] **Step 7: Stage**

```bash
git add web/world/play.js web/world/town.js web/world/world-main.js web/world/grade-5.html web/world/grade-2.html tests/paths.js web/sw.js
```

---

### Task 13: Browser test for Phase 4

**Files:**
- Modify: `tests/e2e/world-e2e.js`, `tests/e2e/world-driver.page.js`

- [ ] **Step 1: The CALM seed and the new cases**

In `tests/e2e/world-e2e.js`, find:

```js
const LESSON_FILES = require(worldFile('lesson-files.js'));
```

Replace with:

```js
const LESSON_FILES = require(worldFile('lesson-files.js'));
const { JESUS } = require(worldFile('lines.js'));
```

Find:

```js
function stageWorld(name, grade, before) {
  let html = fs.readFileSync(web(WORLDS[grade]), 'utf8');
  if (before) {
    const tag = '<script src="../vendor/three/three.min.js"></script>';
    if (!html.includes(tag)) throw new Error('three.min.js tag not found');
    html = html.replace(tag, before + tag);
  }
```

Replace with:

```js
// Today already greeted and comforted, so Jesus's daily visit does not cover the other cases. The Jesus cases turn it off.
const CALM = '<script>(function () { var k = Guide.dayKey(Date.now());'
  + 'Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: k, t: 1 })); })();</script>';

function stageWorld(name, grade, before, calm = true) {
  let html = fs.readFileSync(web(WORLDS[grade]), 'utf8');
  const seed = (calm ? CALM : '') + (before || '');
  if (seed) {
    const tag = '<script src="../vendor/three/three.min.js"></script>';
    if (!html.includes(tag)) throw new Error('three.min.js tag not found');
    html = html.replace(tag, seed + tag);
  }
```

Find:

```js
  // 🏠 in a game opened from the world goes back to the world.
```

Replace with:

```js
  // Phase 4: Jesus greets her once a day where she starts; Hug sends hearts; Bye walks him back to his bench; in his
  // garden he talks with her. On a hard day (a boss stage missed today) he comes in a golden glow.
  const says = (list) => list.map((l) => l.say);
  const LOOK = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));</script>';
  const kin = run('kin', stageWorld('kin', 5, LOOK, false), 'kin');
  assert.deepEqual(kin.errors, [], 'kin: page errors');
  assert.ok(says(JESUS.grade5.greet).includes(kin.greetText), 'a morning greeting: ' + kin.greetText);
  assert.deepEqual(kin.greetButtons, ['🤗 Hug', '👋 Bye']);
  assert.equal(kin.came.glow, false, 'no glow on a good day');
  assert.ok(says(JESUS.grade5.hug).includes(kin.hugText), kin.hugText);
  assert.equal(kin.back.mode, 'garden', 'after Bye he goes back to his bench');
  assert.equal(kin.daily.greeted, kin.today);
  assert.equal(kin.daily.comforted || '', '');
  assert.equal(kin.again, false, 'once a day');
  assert.equal(kin.gardenNear, 'jesus');
  assert.equal(kin.gardenAct, '💬 Talk to Jesus');
  assert.deepEqual(kin.gardenButtons, ['🤗 Hug', '💬 More', '👋 Bye']);
  assert.ok(says(JESUS.grade5.garden).includes(kin.gardenText), kin.gardenText);
  console.log('ok Jesus: greeting, hug, back to the garden, garden talk');

  const SAD = LOOK + '<script>(function () { var k = Guide.dayKey(Date.now());'
    + 'Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: "", t: 1 }));'
    + 'Learner.storage.setItem("boss_missed_v1", JSON.stringify({ v: 1, day: k })); })();</script>';
  const sad = run('comfort', stageWorld('comfort', 5, SAD, false), 'comfort');
  assert.deepEqual(sad.errors, [], 'comfort: page errors');
  assert.ok(says(JESUS.grade5.comfort.boss).includes(sad.text), 'comfort for the missed boss stage: ' + sad.text);
  assert.equal(sad.glow, true, 'he comes in a golden glow');
  assert.equal(sad.daily.comforted, sad.today);
  console.log('ok Jesus comforts her on a hard day');

  // Her sister by the gate takes a cheer; a ride ends by itself beside the swing; the 10-minute nudge brings Mimi.
  const FAMILY = LOOK + '<script>(function () { var now = Date.now();'
    + 'Learner.storage.setItem("family_peek_v1", JSON.stringify({ mia: { profile: { name: "Mia", grade: 2 }, world: {},'
    + ' look: { v: 1, body: "girl", skin: 1, hair: "pigtails", hairColor: 3, outfit: 2, pet: "puppy", petName: "", t: 5 },'
    + ' family: { v: 1, at: now, news: [], sent: [] }, total: 0, readAt: now } })); })();</script>';
  const fam = run('family', stageWorld('family', 5, FAMILY), 'family');
  assert.deepEqual(fam.errors, [], 'family: page errors');
  assert.deepEqual(fam.sisters, ['mia']);
  assert.equal(fam.near, 'sister:mia');
  assert.equal(fam.act, '💬 Talk to Mia');
  assert.equal(fam.text, '✨ Mia is playing now! Want to send a cheer?');
  assert.equal(fam.buttons.length, 7, 'six cheers and Bye');
  assert.equal(fam.buttons[6], '👋 Bye');
  assert.equal(fam.sent, 1, 'the cheer is saved, to go out on the next sync');
  assert.equal(fam.sentText, 'Sent! 💌');
  assert.equal(fam.rideAct, '🌈 Ride the swing!');
  assert.equal(fam.riding, 'swings');
  assert.equal(fam.rodeDone, null, 'the ride ends by itself');
  assert.deepEqual([fam.after.x, fam.after.z], [fam.end.x, fam.end.z], 'she lands beside the swing');
  assert.equal(fam.nudgeText.indexOf("Let's learn something!"), 0, fam.nudgeText);
  console.log('ok sister cheers, a ride, the 10-minute nudge');

  // 🏠 in a game opened from the world goes back to the world.
```

- [ ] **Step 2: The driver modes**

In `tests/e2e/world-driver.page.js`, find:

```js
// Drives the 3D world page for world-e2e.js. The mode comes from the URL hash: #e2e=fresh|back|lost|resting|grade2|progress|talk.
```

Replace with:

```js
// Drives the 3D world page for world-e2e.js. The mode comes from the URL hash:
// #e2e=fresh|back|lost|resting|grade2|progress|talk|kin|comfort|family.
```

Find:

```js
    if (mode === 'lost') {
```

Replace with:

```js
    if (mode === 'kin') {
      D.pause();
      var i;
      for (i = 0; i < 80 && !D.talking(); i++) D.tick(0.1);
      o.today = Guide.dayKey(Date.now());
      o.greetText = D.talkText();
      o.greetButtons = D.talkButtons();
      o.came = D.jesus();
      D.pressTalk('🤗 Hug');
      o.hugText = D.talkText();
      D.pressTalk('👋 Bye');
      for (i = 0; i < 60 && D.jesus().mode !== 'garden'; i++) D.tick(0.1);
      o.back = D.jesus();
      o.daily = JSON.parse(Learner.storage.getItem('world3d_v1'));
      D.refresh();
      for (i = 0; i < 20; i++) D.tick(0.1);
      o.again = D.talking() || D.jesus().mode !== 'garden';
      var js = World3D.Layout.jesusSpot('grade5');
      D.stand(js.x, js.z);
      o.gardenNear = D.state().near;
      o.gardenAct = D.actText();
      D.act();
      o.gardenText = D.talkText();
      o.gardenButtons = D.talkButtons();
      return out(o);
    }
    if (mode === 'comfort') {
      D.pause();
      for (var c = 0; c < 80 && !D.talking(); c++) D.tick(0.1);
      o.today = Guide.dayKey(Date.now());
      o.text = D.talkText();
      o.glow = D.jesus().glow;
      o.daily = JSON.parse(Learner.storage.getItem('world3d_v1'));
      return out(o);
    }
    if (mode === 'family') {
      D.pause();
      var LF = World3D.Layout;
      o.sisters = D.sisters();
      var sp = LF.sisterSpots('grade5')[0];
      D.stand(sp.x, sp.z + 1);
      o.near = D.state().near;
      o.act = D.actText();
      D.act();
      o.text = D.talkText();
      o.buttons = D.talkButtons();
      D.pressTalk(o.buttons[0]);
      o.sent = Family.read(Learner.storage).sent.length;
      o.sentText = D.talkText();
      D.pressTalk('👋 Bye');
      var sw = LF.interactables('grade5').filter(function (x) { return x.id === 'ride:swings'; })[0];
      D.stand(sw.x, sw.z);
      o.rideAct = D.actText();
      D.act();
      o.riding = D.riding();
      for (var r = 0; r < 60 && D.riding(); r++) D.tick(0.1);
      o.rodeDone = D.riding();
      o.after = D.state();
      o.end = LF.rideSpots('grade5').filter(function (x) { return x.id === 'swings'; })[0].end;
      D.nudgeNow();
      for (var n = 0; n < 80 && !D.talking(); n++) D.tick(0.1);
      o.nudgeText = D.talkText();
      return out(o);
    }
    if (mode === 'lost') {
```

- [ ] **Step 3: Run the browser tests**

Run: `node tests/e2e/world-e2e.js`
Expected: every `ok ...` line prints, including the three new ones. If a case fails, read its assertion message first; the earlier cases must still pass with the CALM seed.

Then run: `node tests/e2e/lobby-e2e.js && node tests/e2e/lobby-e2e.js 5 && node tests/e2e/file-check-e2e.js`
Expected: PASS (`family.js` and the peek change did not break the lobby).

- [ ] **Step 4: Stage**

```bash
git add tests/e2e/world-e2e.js tests/e2e/world-driver.page.js
```

---

### Task 14: Look check, docs and the full run

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Screenshots**

Copy `web/` to the scratchpad. In the copy's `world/grade-5.html`, insert the `FAMILY` seed script from Task 13 (as plain HTML) before `<script src="../vendor/three/three.min.js"></script>`, and at the end of the body add:

```html
<script>addEventListener("world-ready", function () { var j = World3D.Layout.jesusSpot("grade5"); WorldDebug.stand(j.x + 6, j.z + 2); });</script>
```

Screenshot from file:// with a fresh `--user-data-dir`:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --no-first-run --user-data-dir="<fresh dir>" --window-size=1200,800 --virtual-time-budget=8000 --screenshot="<out.png>" "file:///<scratchpad>/site/world/grade-5.html"
```

Take four:
- **Garden** (above). Check: Jesus sits on the bench facing the garden with his halo, and the lamb is beside him.
- **Gate:** replace the `stand` line with `WorldDebug.teleport("gate")`. Check: her sister stands to the side in the seeded look (pigtails, puppy), with the "💖 Mia 🎮" tag and the ✨.
- **Swing:** `var s = World3D.Layout.rideSpots("grade5")[1]; WorldDebug.stand(s.x, s.z); WorldDebug.act(); WorldDebug.tick(0.5);`. Check: she sits on the swing seat and the swing is out.
- **Comfort:** drop the CALM part and seed the `SAD` script instead, with `WorldDebug.tick(0.1)` called 15 times. Check: Jesus stands in front of her in the golden ring and the bubble shows the verse and 📖 reference under his words.

Send the screenshots to the user with SendUserFile. Delete the copy afterwards.

- [ ] **Step 2: README**

In the "Running locally" list, change the `world-e2e.js` comment to:

```
node tests/e2e/world-e2e.js          # 3D world: maker, doors, 🏠 back, quick travel, medals, markers, Mimi's trail, fort, shop and back, buddies, Ask me!, Hoot, Bunny, trees, Jesus's greeting and comfort, sister cheers, rides, the 10-minute nudge
```

- [ ] **Step 3: Full run**

Run: `node tools/update-precache.js && node --test && node tests/e2e/world-e2e.js && node tests/e2e/lobby-e2e.js && node tests/e2e/lobby-e2e.js 5 && node tests/e2e/guide-e2e.js && node tests/e2e/nav-e2e.js && node tests/e2e/file-check-e2e.js`
Expected: everything passes.

- [ ] **Step 4: Stage and hand the commit to the user**

```bash
git add README.md web/sw.js
```

Suggested commit for the user:

```bash
git commit -m "3D world phase 4: Jesus sits on his garden bench with a little lamb and talks with her (Hug sends hearts up, More gives another kind word with a kid-friendly verse and where it is in the Bible, and after a long study day he says he is proud of how hard she tried); once a day he greets her where she starts, and on a hard day (many tricky answers, the quest streak broke, or a boss stage missed) he comes to her in a soft golden glow with comfort that fits, then walks back to his garden; her sister stands by the gate in her own character and pet from the family peek, waves with a sparkle when she is playing, and takes the same one-tap cheers as the lobby; the slide, swings, see-saw and merry-go-round take her for a ride; and after 10 minutes in the world without a game Mayor Mimi walks over with the next step and Go or Later; Grade 2 in Filipino and English"
```

---

## Self-review notes

- **Spec Phase 4 coverage:**
  - Jesus garden with lamb, 🤗 Hug with hearts, 💬 More, long-day line: Tasks 5, 6, 10, 11.
  - Morning greeting once a local day (`world3d_v1.greeted`), walk back after Hug or Bye: Tasks 1, 6, 11.
  - Hard day (5+ wrong under 60%, streak broke today, boss stage lost today), checked on open and on return (`refresh` → `kin.check`), once a day (`comforted`), golden glow, comfort wins and counts as the greeting: Tasks 1, 2, 6, 11, 12.
  - Never quizzes, coins, "wrong" or streak talk; verses paraphrased with references; Grade 2 paired: Task 5 tests.
  - Sister at the gate in her `avatar_v1` look and pet, existing cheers, ✨ playing glow and wave, 🎨 choosing default: Tasks 3, 4, 11.
  - Playground rides, pet alongside, nothing saved: Tasks 8, 9, 10, 12.
  - 10-minute nudge counted only while visible and outside the maker (the shop is another page), Mimi walks over with the guide's step, Go ▶ trail / Later, restart after each nudge and on entering a game: Tasks 4, 7, 12.
  - Data: `world3d_v1 {v, greeted, comforted, t}`: Task 1. Testing (hard-day check, nudge timer, Grade 2 pairs, sister cheers e2e): Tasks 5-7, 13.
- **Names across tasks:**
  - `Prefs.readDaily().{greeted, comforted}`; `Boss.{missedDay, MISSED_KEY}`; `Family.sisters()[i].look`.
  - `Lines.JESUS[grade].{greet, garden, proud, hug, comfort.{wrong, streak, boss}}` → `{ say, verse, ref }`.
  - `Care.{tally, streakBroke, hardDay, visit, pick, gardenLines, LONG_DAY}`; `Nudge.{LIMIT, create}` → `{ tick, force, reset }`; `Rides.{RIDES, part, pose}`; `Walk.advance`.
  - `Layout.{jesusSpot, sisterSpots, rideSpots, freeSpot, props.jesus, props.lamb}`; interactable kind `ride`; dynamic kinds `jesus` and `sister`.
  - `Cast.{jesus, lamb}`; `Avatar.character().animate(t, walkT, mag, pose)`; `build().{hearts, ride}`.
  - `Kin.create(o)` → `{ check, tick, items, label, act, handles, visiting, closeTalk, debug, sisterIds }`; `Play.create(o)` → `{ start, tick, riding }`; `Town` adds `nudge`, `visiting`, `tick(t, st, dt)`.
  - `WorldDebug.{jesus, sisters, riding, nudgeNow, refresh}`.
- **Accepted gaps:** Jesus and Mimi walk through things on the way to her; a cheer sent in the world goes out on the next lobby sync; her sister's look updates only after the lobby syncs the peek; the pet waits beside the ride instead of riding.
