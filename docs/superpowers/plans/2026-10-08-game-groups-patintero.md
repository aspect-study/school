# Playground games part 3: Game groups and Patintero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 🎲 Games board, a kid's talk bubble and a friend's invite offer games by group (🏃 Tag & Chase: Tag, Patintero; 🙈 Hide & Seek: Hide and seek), and Patintero is playable on a court beside the playground: two teams of 4, she runs first and becomes the middle guard when her team is tagged.

**Architecture:** `mategame.js` gains `GROUPS` and the new texts, buttons and pops. A new pure module `web/world/patintero.js` holds the court geometry, teams, kid runner and guard play, scoring, swaps and her fence; it is drafted and unit-tested below. `games3d.js` draws the court, runs the two-step picker, and drives either `MateGame` or `Patintero`, whichever is playing. `world-main.js` passes two hooks: `fence(x, z)` joins her `blocked` check (the court's soft walls while she runs, the middle line while she guards, which works because `walk.step` moves x and z separately), and `place(x, z, face)` teleports her to her spot at each turn. `mates3d.js` swaps its two game buttons for one 🎲 Let's play!.

**Tech Stack:** Plain ES5 browser scripts (IIFE, `root.World3D`), Three.js through `scene.js` helpers, Node's built-in test runner (`node --test`), headless Chrome e2e (`node tests/e2e/world-e2e.js`).

**Spec:** `docs/superpowers/specs/2026-10-08-game-groups-patintero-design.md`

---

## Ground rules for every task

- **Never run `git commit`.** The owner commits. Each task ends by **staging** its files with `git add` (listed in the
  task) and printing the commit as one code block: `git add <files> && git commit -m '...' -- <files>`. No
  `Co-Authored-By` or `Claude-Session` lines anywhere.
- Match the surrounding code: ES5 in `web/` (`var`, `function`), 2-space indent, single quotes, comments only where
  something is not obvious. Tests use `const` and arrow functions like their neighbours.
- A new file under `web/` changes `web/sw.js` PRECACHE: run `node tools/update-precache.js` in the same task. A new
  file under `web/world/` also goes in `WORLD_FILES` in `tests/paths.js` and the `<script>` list of **both**
  `web/world/grade-5.html` and `web/world/grade-2.html`, in the same order.
- After each task: `node --test` from the repo root passes, all of it. Tasks that touch `world-main.js`, `games3d.js`,
  `mates3d.js` or the HTML also run `node tests/e2e/world-e2e.js`.
- Grade 2 text pairs Filipino with English as `'Filipino · English'`; buttons and word pops are English on both
  grades. Filipino rules from `CLAUDE.md` hold (the Filipino half carries the full meaning on its own).

## Decisions made while planning (within the spec)

- **The court is at (39, 74)**, long side along z, home line at z = 86 (the gate end). A scan of both grades' layouts
  found it the closest spot to the playground where the court and its 4-unit run-offs touch no obstacle and no path
  (`L.blocked`, `L.onPath`, 0.5 margin). Task 4 adds a test that keeps it clear. No owner question was needed.
- **Her sister needs no change in `kin.js`:** `player()` already gives `move`, `where`, `put`, `game` and `pop`, which
  is all Patintero uses; she walks back to the gate through `cast.game(id, false)` as after tag.
- **Announcements use the existing hint line under the pill.** The line shows her job (run or guard); a swap or a
  point replaces it for `HINT_TIME` seconds.
- **The 4 minutes run through the 3-second ready counts too**, so a game is 4 minutes on the clock.
- **Kid play is tuned against a seeded simulation (Task 3).** While drafting, kid-only games stalled (guards shadowed
  runners) or swapped every second (runners dashed from too far). The draft below fixes the causes it found: a dash
  starts only from the waiting spot and goes to just past one line; the middle guard only counts as a threat on the
  middle line; guards watch one runner at a time and react 0.6 s late; the other team gets bolder the longer it waits.
  The draft passes all rules tests, but kids score in only 6 of 20 simulated games against a target of 10, so Task 3
  tunes it.

## File map

| File | Responsibility |
|---|---|
| `web/world/mategame.js` (modify) | `GROUPS`, group and Patintero texts (both grades), buttons, why lines, `GAMES` list for invites |
| `web/world/patintero.js` (new) | `COURT`, `RULES`, `POPS`, `court(cx, cz)`, `fence(c, guarding, x, z)`, `create(o)` engine |
| `web/world/games3d.js` (modify) | court and sign, two-step picker, `choose(first)`, Patintero start / hud / rings / events / end, `fence`, invites from all games |
| `web/world/mates3d.js` (modify) | 🎲 Let's play! in the kid's bubble |
| `web/world/world-main.js` (modify) | `fence` in her `blocked`, `place` and `choose` hooks |
| `web/world/grade-5.html`, `grade-2.html`, `tests/paths.js`, `web/sw.js` (modify) | load `patintero.js`; precache |
| `tests/world3d-mategame.test.js` (modify) | groups, texts, invites |
| `tests/world3d-patintero.test.js` (new) | rules |
| `tests/world3d-patintero-sim.test.js` (new) | kid play keeps the game moving |
| `tests/world3d-games-wiring.test.js` (new) | court spot clear in both grades; source wiring |
| `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js` (modify) | two-step picker in `games`; new `patintero` case |
| `README.md`, `docs/HANDOFF.md` (modify) | playground games, e2e line, Built |

---

### Task 1: Groups, texts and buttons in `mategame.js`

**Files:**
- Modify: `web/world/mategame.js`
- Modify: `tests/world3d-mategame.test.js`

- [ ] **Step 1: Write the failing tests** (append to `tests/world3d-mategame.test.js`)

```js
test('games come in groups: Tag & Chase (tag, Patintero) and Hide & Seek (hide-and-seek)', () => {
  assert.deepEqual(G.GROUPS.map((g) => [g.id, g.games]), [['chase', ['tag', 'patintero']], ['hide', ['seek']]]);
  assert.deepEqual(G.GAMES, ['tag', 'patintero', 'seek'], 'every game once, in group order');
  assert.equal(G.BUTTONS.chase, '🏃 Tag & Chase');
  assert.equal(G.BUTTONS.hide, '🙈 Hide & Seek');
  assert.equal(G.BUTTONS.patintero, '🏃 Patintero!');
  assert.equal(G.BUTTONS.back, '⬅ Back');
  assert.equal(G.BUTTONS.play, "🎲 Let's play!");
  G.GAMES.forEach((id) => assert.ok(G.BUTTONS[id], id + ' has a button'));
});

test('group and Patintero texts in both grades; Grade 2 pairs Filipino · English', () => {
  for (const grade of ['grade5', 'grade2']) {
    const t = G.TEXT[grade];
    ['kinds', 'inviteRun', 'patRun', 'patGuard', 'patTagged', 'patTagger', 'patScore', 'patTheyScore'].forEach((k) => assert.equal(typeof t[k], 'string', grade + ' ' + k));
    ['chase', 'hide'].forEach((k) => assert.equal(typeof t.groups[k], 'string', grade + ' group ' + k));
    ['patWin', 'patLose', 'patTie'].forEach((k) => assert.match(t[k](2, 1), /2.*1/, grade + ' ' + k));
  }
  const g2 = G.TEXT.grade2;
  assert.equal(g2.groups.chase, 'Habulan at Takbuhan · Tag & Chase');
  assert.equal(g2.groups.hide, 'Taguan · Hide & Seek');
  assert.equal(g2.inviteRun, 'Gusto mo bang maglaro ng patintero? · Want to play Patintero?');
  assert.equal(g2.patTagged, '😲 Nataya! Magpapalit ang mga koponan! · Tagged! Teams swap!');
  assert.equal(g2.patWin(3, 1), 'Panalo ang koponan mo, 3 laban sa 1! · Your team won, 3 to 1!');
  ['kinds', 'inviteRun', 'patRun', 'patGuard', 'patTagged', 'patTagger', 'patScore', 'patTheyScore'].forEach((k) => assert.ok(g2[k].includes(' · '), k));
  assert.equal(G.TEXT.grade5.why.length, G.TEXT.grade2.why.length);
  assert.ok(G.TEXT.grade5.why.includes('Teamwork: watch your teammates and run when the guard looks away!'));
});
```

- [ ] **Step 2: Run them and see them fail:** `node --test tests/world3d-mategame.test.js` (GROUPS undefined).

- [ ] **Step 3: Add to `mategame.js`**

After `var DISGUISES = ...;` add:

```js
  // The Games board, a kid's bubble and a friend's invite all offer games through these groups; a new game is one
  // more id here plus its button and start.
  var GROUPS = [
    { id: 'chase', games: ['tag', 'patintero'] },
    { id: 'hide', games: ['seek'] }
  ];
  var GAMES = GROUPS.reduce(function (all, g) { return all.concat(g.games); }, []);
```

In `TEXT.grade5`, after `boardName: 'Games board',` add:

```js
      kinds: 'What kind of game?', groups: { chase: '🏃 Tag & Chase', hide: '🙈 Hide & Seek' },
      inviteRun: 'Want to play Patintero?',
      patRun: 'Cross every line and come back!', patGuard: '🛡️ Guard the middle line! Tag a runner!',
      patTagged: '😲 Tagged! Teams swap!', patTagger: '🎉 Got one! Teams swap!',
      patScore: '🎉 A point for your team!', patTheyScore: 'They scored! Guard closer!',
      patWin: function (a, b) { return 'Your team won, ' + a + ' to ' + b + '!'; },
      patLose: function (a, b) { return 'The other team won this time, ' + a + ' to ' + b + ". Let's play again!"; },
      patTie: function (a, b) { return 'A tie, ' + a + ' to ' + b + '! Everyone played great!'; },
```

and append to `TEXT.grade5.why`:

```js
        'Teamwork: watch your teammates and run when the guard looks away!', 'Waiting for the right moment is a superpower!'
```

In `TEXT.grade2`, after `boardName: ...,` add:

```js
      kinds: pair('Anong klaseng laro?', 'What kind of game?'),
      groups: { chase: pair('Habulan at Takbuhan', 'Tag & Chase'), hide: pair('Taguan', 'Hide & Seek') },
      inviteRun: pair('Gusto mo bang maglaro ng patintero?', 'Want to play Patintero?'),
      patRun: pair('Tumawid sa lahat ng guhit at bumalik!', 'Cross every line and come back!'),
      patGuard: pair('🛡️ Bantayan ang gitnang guhit! Tayain ang tatakbo!', 'Guard the middle line! Tag a runner!'),
      patTagged: pair('😲 Nataya! Magpapalit ang mga koponan!', 'Tagged! Teams swap!'),
      patTagger: pair('🎉 Nakataya! Magpapalit ang mga koponan!', 'Got one! Teams swap!'),
      patScore: pair('🎉 Isang puntos para sa koponan mo!', 'A point for your team!'),
      patTheyScore: pair('Nakapuntos sila! Bantayan nang mabuti!', 'They scored! Guard closer!'),
      patWin: function (a, b) { return pair('Panalo ang koponan mo, ' + a + ' laban sa ' + b + '!', 'Your team won, ' + a + ' to ' + b + '!'); },
      patLose: function (a, b) {
        return pair('Panalo ang kabila ngayon, ' + a + ' laban sa ' + b + '. Maglaro ulit tayo!', 'The other team won this time, ' + a + ' to ' + b + ". Let's play again!");
      },
      patTie: function (a, b) { return pair('Tabla, ' + a + ' laban sa ' + b + '! Ang galing ng lahat!', 'A tie, ' + a + ' to ' + b + '! Everyone played great!'); },
```

and append to `TEXT.grade2.why`:

```js
        pair('Pagtutulungan: bantayan ang mga kakampi at tumakbo kapag iba ang tinitingnan ng bantay!', 'Teamwork: watch your teammates and run when the guard looks away!'),
        pair('Ang paghihintay sa tamang sandali ay isang superpower!', 'Waiting for the right moment is a superpower!')
```

Note: the Grade 2 `patTagged` test expects `'😲 Nataya! … · Tagged! Teams swap!'`: `pair` puts the emoji only on the
Filipino half, as the existing `youreIt` does.

In `BUTTONS` add: `patintero: '🏃 Patintero!', chase: '🏃 Tag & Chase', hide: '🙈 Hide & Seek', back: '⬅ Back', play: "🎲 Let's play!"`.

In `exported` add `GROUPS: GROUPS, GAMES: GAMES`.

- [ ] **Step 4: Run `node --test`**: all pass.

- [ ] **Step 5: Stage**

```
git add web/world/mategame.js tests/world3d-mategame.test.js
```

---

### Task 2: The Patintero rules, `patintero.js`

**Files:**
- Create: `web/world/patintero.js`
- Create: `tests/world3d-patintero.test.js`
- Modify: `tests/paths.js` (`WORLD_FILES`: `'patintero.js'` right after `'mategame.js'`)
- Modify: `web/world/grade-5.html`, `web/world/grade-2.html` (`<script src="patintero.js"></script>` right after `mategame.js`)
- Modify: `web/sw.js` (by `node tools/update-precache.js`)

- [ ] **Step 1: Write the test file** `tests/world3d-patintero.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const P = require(worldFile('patintero.js'));

// Kids on an open field: move goes straight at speed; put sets fields.
function field(ids) {
  const kids = {};
  ids.forEach((id, i) => { kids[id] = { x: i, z: 0, face: 0, cheer: false }; });
  return {
    kids,
    move(id, x, z, speed, dt) {
      const k = kids[id], dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz), s = speed * dt;
      if (d <= Math.max(s, 0.3)) { k.x = x; k.z = z; return true; }
      k.x += dx / d * s; k.z += dz / d * s;
      return false;
    },
    where(id) { return kids[id]; },
    put(id, p) { const k = kids[id]; ['x', 'z', 'face', 'cheer'].forEach((f) => { if (p[f] !== undefined) k[f] = p[f]; }); return true; }
  };
}
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const C = P.court(39, 74);
function setup(herRuns = true, sister = null, ids = IDS) {
  const f = field(ids), g = P.create({ rand, move: f.move, where: f.where, put: f.put });
  const her = { x: 39, z: 90 };
  const ev = g.start(ids, her, C, sister, herRuns);
  ev.filter((e) => e.type === 'place').forEach((e) => { her.x = e.x; her.z = e.z; });
  return { f, g, her, ev };
}
// Runs the ready count down.
function go(g, her) { let ev = []; for (let i = 0; i < 70 && g.state().phase === 'ready'; i++) ev = ev.concat(g.tick(0.05, her)); return ev; }
// Puts every guard far from (x, z) along their own line, so she can pass.
function clear(f, g, x) {
  const s = g.state();
  Object.keys(s.posts).forEach((id) => { if (id === 'her') return; const k = f.kids[id];
    if (s.posts[id] === 'mid') k.z = C.mid.to; else k.x = x < C.cx ? C.maxX - 0.6 : C.minX + 0.6; });
}

test('the court: home at +z, 3 cross lines 6 apart, the middle line from the first cross line to the far line', () => {
  assert.equal(C.home, 86); assert.equal(C.far, 62);
  assert.deepEqual(C.cross, [80, 74, 68]);
  assert.deepEqual(C.mid, { x: 39, from: 80, to: 62 });
  assert.deepEqual([C.minX, C.maxX], [34, 44]);
});

test('her fence: running, the court and its run-offs; guarding, only the middle line', () => {
  assert.equal(P.fence(C, false, 39, 74), false);
  assert.equal(P.fence(C, false, 39, 89), false, 'behind the home line');
  assert.equal(P.fence(C, false, 33, 74), true, 'past a sideline');
  assert.equal(P.fence(C, false, 39, 91), true, 'too far behind home');
  assert.equal(P.fence(C, true, 39, 70), false);
  assert.equal(P.fence(C, true, 39.5, 70), true, 'off the middle line');
  assert.equal(P.fence(C, true, 39, 81), true, 'before the middle line starts');
});

test('teams of 4: her, the kid who asked and her sister in blue; runners behind home, guards on their posts', () => {
  const { f, g, her, ev } = setup(true, 'c');
  const s = g.state();
  assert.deepEqual(s.team.blue, ['her', 'a', 'c', 'b']);
  assert.deepEqual(s.team.red, ['d', 'e', 'f', 'g']);
  assert.deepEqual(s.posts, { d: 'c0', e: 'c1', f: 'c2', g: 'mid' });
  assert.equal(s.phase, 'ready'); assert.equal(s.running, true); assert.equal(s.guarding, false);
  assert.ok(her.z > C.home, 'she starts behind the home line');
  ['a', 'b', 'c'].forEach((id) => assert.ok(f.kids[id].z > C.home, id));
  assert.equal(f.kids.d.z, 80); assert.equal(f.kids.e.z, 74); assert.equal(f.kids.f.z, 68); assert.equal(f.kids.g.x, 39);
  assert.deepEqual(ev.map((e) => e.type).slice(0, 2), ['start', 'place']);
});

test('ready, set, go: a 3-second count and then play', () => {
  const { g, her } = setup();
  const ev = go(g, her);
  assert.deepEqual(ev.filter((e) => e.type === 'count').map((e) => e.n), [3, 2, 1]);
  assert.ok(ev.some((e) => e.type === 'go'));
  assert.equal(g.state().phase, 'play');
});

test('she scores by running past the far line and back home; guards never leave their lines', () => {
  const { f, g, her } = setup();
  go(g, her);
  const route = [[36, 89], [36, 60], [36, 89]];
  let ev = [], at = { x: 36, z: 89 };
  for (const [x, z] of route) {
    while (Math.hypot(at.x - x, at.z - z) > 0.01) {
      clear(f, g, at.x);
      const d = Math.hypot(x - at.x, z - at.z), s = Math.min(d, 0.5);
      at = { x: at.x + (x - at.x) / d * s, z: at.z + (z - at.z) / d * s };
      her.x = at.x; her.z = at.z;
      ev = ev.concat(g.tick(0.05, her));
      const st = g.state();
      Object.keys(st.posts).forEach((id) => {
        const k = f.kids[id];
        if (st.posts[id] === 'mid') assert.equal(k.x, 39, id + ' on the middle line');
        else assert.ok(C.cross.includes(k.z), id + ' on a cross line');
      });
      if (!g.state().running) break;
    }
  }
  const sc = ev.filter((e) => e.type === 'score');
  assert.ok(sc.some((e) => e.kid === 'her' && e.team === 'blue'), 'her point: ' + JSON.stringify(sc));
  assert.ok(g.state().score.blue >= 1);
});

test('a guard touching her swaps the teams: she becomes the middle guard', () => {
  const { f, g, her } = setup();
  go(g, her);
  her.x = 37; her.z = 80.5;
  f.kids.d.x = 37; f.kids.d.z = 80;
  const ev = g.tick(0.05, her);
  const sw = ev.find((e) => e.type === 'swap');
  assert.ok(sw, JSON.stringify(ev));
  assert.equal(sw.by, 'd'); assert.equal(sw.kid, 'her'); assert.equal(sw.herTeam, 'tagged');
  const s = g.state();
  assert.equal(s.guarding, true); assert.equal(s.posts.her, 'mid'); assert.equal(s.phase, 'ready');
  const pl = ev.filter((e) => e.type === 'place').pop();
  assert.equal(pl.x, 39); assert.ok(pl.z <= 80 && pl.z >= 62, 'placed on the middle line');
  assert.equal(g.fence(39, 70), false); assert.equal(g.fence(40, 70), true);
});

test('she tags a runner while guarding: the teams swap back and her team runs', () => {
  const { f, g, her } = setup(false);
  assert.equal(g.state().guarding, true);
  go(g, her);
  const runner = g.state().team.red[0];
  f.kids[runner].x = 39.5; f.kids[runner].z = her.z;
  const ev = g.tick(0.05, her);
  const sw = ev.find((e) => e.type === 'swap');
  assert.ok(sw); assert.equal(sw.by, 'her'); assert.equal(sw.herTeam, 'tagger');
  assert.equal(g.state().running, true);
});

test('a runner behind the lines cannot be tagged', () => {
  const { f, g, her } = setup();
  go(g, her);
  her.x = 39; her.z = 87;
  f.kids.d.x = 39; f.kids.d.z = 86.5;
  assert.ok(!g.tick(0.05, her).some((e) => e.type === 'swap'));
});

test('first to 3 wins; after 4 minutes the team ahead wins, equal is a tie', () => {
  let { g, her } = setup();
  go(g, her);
  let ev = [];
  for (let i = 0; i < 241 / 0.5 && g.playing(); i++) ev = ev.concat(g.tick(0.5, her));
  assert.equal(g.playing(), false);
  const end = ev.find((e) => e.type === 'end');
  assert.ok(end); assert.equal(end.kind, 'patintero');
  const s = g.state();
  assert.equal(end.result, s.score.blue > s.score.red ? 'win' : s.score.blue < s.score.red ? 'lose' : 'tie');
  assert.equal(P.RULES.win, 3); assert.equal(P.RULES.time, 240);
});

test('Play again can start with her team guarding', () => {
  const { g } = setup(false);
  const s = g.state();
  assert.equal(s.running, false); assert.equal(s.herRuns, false); assert.equal(s.posts.her, 'mid');
});

test('fewer kids: the teams stay as even as they can', () => {
  const { g } = setup(true, null, ['a', 'b', 'c', 'd', 'e']);
  const s = g.state();
  assert.equal(s.team.blue.length, 3); assert.equal(s.team.red.length, 3);
});
```

- [ ] **Step 2: Run it and see it fail:** `node --test tests/world3d-patintero.test.js` (module missing).

- [ ] **Step 3: Create `web/world/patintero.js`** (drafted and run against the tests above while planning):

```js
/* Patintero with the kids, the pure part (playground games part 3; the 3D side is games3d.js). Two teams of up to 4 on a
   court of cross lines: the runners go from behind the home line past every line to beyond the far line and back, and
   each one who gets home scores a point; the guards stay on their lines (a cross-line guard moves only across the
   court, the middle guard only along the middle line) and tag a runner by touching them. One tag swaps the teams. The
   first team to WIN points, or the team ahead after TIME seconds, wins.
   She is on the blue team. While her team runs she moves freely (the shell keeps her inside the court with fence());
   while it guards she is the middle guard and the shell keeps her on the middle line. Kid runners wait out of reach of
   the next line, feint along it away from its guard, and dash when no guard is near where they would cross (the other
   team takes smaller gaps the longer it waits). Kid guards watch one runner near their line at a time, react a moment
   late (so a feint works), and lunge when that runner is close.
   o = { rand, move(id, x, z, speed, dt) → arrived, where(id) → { x, z }, put(id, p) }; her = { x, z } each tick. */
(function (root) {
  'use strict';

  // w, len: court size; gap: between lines (3 cross lines at gap, 2 gap, 3 gap from home); end: run-off behind the
  // home and far lines; edge: how close to a sideline anyone goes.
  var COURT = { w: 10, len: 24, gap: 6, end: 4, edge: 0.6 };
  // Her walk is 9 and her sprint 12.6 (walk.js): a guard is slower than her walk, a lunge slower than her sprint.
  var RULES = {
    win: 3, time: 240, ready: 3, reach: 1.6,
    guard: 8.5, lunge: 11, lungeR: 3, lungeT: 0.6, rest: 1.2, restSpeed: 4,
    run: 9, dash: 11, past: 2.5, off: 2, side: 2.5, wait: 1.4,
    // A kid crosses when no guard is nearer than this to where they would cross: her teammates are careful,
    // the other team bolder (so she gets to tag them when she guards).
    safe: 4.5, bold: 3.5, impatient: 0.3, midSafe: 4, keep: 1.5, react: 0.6, danger: 4
  };
  // Word pops are English on both grades.
  var POPS = { got: 'Got you!', home: 'Home! 🎉', tagged: '😲', ready: 'Ready…', set: 'Set…', go: 'Go!' };
  // The guard posts, in the order a team fills them: hers puts her in the middle.
  var POSTS = ['c0', 'c1', 'c2', 'mid'];

  function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // The court around (cx, cz), long side along z, home at the +z end.
  function court(cx, cz) {
    var home = cz + COURT.len / 2, far = cz - COURT.len / 2, cross = [];
    for (var i = 1; i * COURT.gap < COURT.len; i++) cross.push(home - i * COURT.gap);
    return {
      cx: cx, cz: cz, w: COURT.w, len: COURT.len, minX: cx - COURT.w / 2, maxX: cx + COURT.w / 2, home: home, far: far, cross: cross,
      mid: { x: cx, from: cross[0], to: far }
    };
  }

  // Where she may stand: running, anywhere on the court and its run-offs; guarding, only on the middle line.
  function fence(c, guarding, x, z) {
    if (guarding) return Math.abs(x - c.mid.x) > 0.01 || z > c.mid.from || z < c.mid.to;
    return x < c.minX + COURT.edge || x > c.maxX - COURT.edge || z > c.home + COURT.end || z < c.far - COURT.end;
  }

  function create(o) {
    var rand = o.rand, st = null;

    // blue: her team (her first, then the kid who asked and her sister), red: the rest. ids: the kids, first one asked.
    function teams(ids, sister) {
      var mine = ids.slice(0, 1);
      if (sister && ids.indexOf(sister) > 0) mine.push(sister);
      var rest = ids.filter(function (id) { return mine.indexOf(id) < 0; });
      var size = Math.min(3, Math.ceil((ids.length + 1) / 2) - 1);
      while (mine.length < size && rest.length) mine.push(rest.shift());
      return { blue: ['her'].concat(mine), red: rest.slice(0, 4) };
    }

    function u(z) { return st.court.home - z; }
    function onCourt(p) { var k = u(p.z); return k >= 0 && k <= COURT.len; }

    // Everyone to their spots for a turn: runners spread behind the home line, guards on their posts.
    function lineUp(ev) {
      var c = st.court, run = st.team[st.runners], guard = st.team[st.runners === 'blue' ? 'red' : 'blue'];
      st.posts = {};
      st.legs = {};
      guard.forEach(function (id, n) {
        var post = (guard[0] === 'her' ? ['mid', 'c0', 'c1', 'c2'] : POSTS)[n];
        st.posts[id] = post;
        var p = postSpot(post, c.cx + (n % 2 ? 2 : -2));
        if (id === 'her') ev.push({ type: 'place', x: p.x, z: p.z, face: Math.PI });
        else o.put(id, { x: p.x, z: p.z, face: 0, still: true });
      });
      run.forEach(function (id, n) {
        var x = c.minX + (n + 0.5) * c.w / run.length, z = c.home + 2;
        st.legs[id] = { back: false, plan: null, dash: null, wait: rand() * RULES.wait, waited: 0 };
        if (id === 'her') ev.push({ type: 'place', x: x, z: z, face: Math.PI });
        else o.put(id, { x: x, z: z, face: Math.PI, still: true });
      });
      st.guards = {};
      guard.forEach(function (id) { st.guards[id] = { lunge: 0, rest: 0, watch: null, keep: 0 }; });
      st.phase = 'ready';
      st.ready = RULES.ready;
      st.shown = 0;
      st.her = { back: false };
    }

    function postSpot(post, x) {
      var c = st.court;
      if (post === 'mid') return { x: c.mid.x, z: (c.mid.from + c.mid.to) / 2 };
      return { x: clamp(x, c.minX + COURT.edge, c.maxX - COURT.edge), z: c.cross[+post.slice(1)] };
    }

    // ids: the kids (the one who asked first); sister: her sister's id when she plays; herRuns: her team runs first.
    function start(ids, her, c, sister, herRuns) {
      var t = teams(ids, sister);
      st = {
        court: c, team: t, ids: t.blue.concat(t.red).filter(function (id) { return id !== 'her'; }), runners: herRuns === false ? 'red' : 'blue',
        score: { blue: 0, red: 0 }, t: 0, done: false, result: null, danger: false, chaseD: null, swaps: 0, herRuns: herRuns !== false
      };
      var ev = [{ type: 'start', kind: 'patintero' }];
      lineUp(ev);
      return ev;
    }

    function guarding() { return !!st && !st.done && st.runners === 'red'; }
    function where(id, her) { return id === 'her' ? her : o.where(id); }

    // The z a runner heads for next: just past the next line on their leg, or behind the far / home line.
    function nextZ(z, back) {
      var c = st.court, lines = [c.home].concat(c.cross, [c.far]), k;
      if (!back) {
        for (k = 0; k < lines.length; k++) if (lines[k] < z - 0.01) return lines[k] - RULES.past;
        return c.far - RULES.past;
      }
      for (k = lines.length - 1; k >= 0; k--) if (lines[k] > z + 0.01) return lines[k] + RULES.past;
      return c.home + RULES.past;
    }

    // How far the guards who could reach a runner crossing the line at lineZ at x are from that spot: the line's own
    // guard, and the middle guard only when x is on the middle line.
    function threat(x, lineZ, her) {
      var best = Infinity;
      Object.keys(st.posts).forEach(function (id) {
        var g = where(id, her), post = st.posts[id];
        if (post === 'mid' && Math.abs(x - st.court.mid.x) > RULES.reach + 0.4) return;
        if (post !== 'mid' && Math.abs(g.z - lineZ) > 0.01) return;
        best = Math.min(best, dist(g, { x: x, z: lineZ }));
      });
      return best;
    }

    function midGuard(her) {
      var id = Object.keys(st.posts).filter(function (g) { return st.posts[g] === 'mid'; })[0];
      return id ? where(id, her) : null;
    }

    function lineGuard(lineZ, her) {
      var id = Object.keys(st.posts).filter(function (g) { return st.posts[g] !== 'mid' && Math.abs(where(g, her).z - lineZ) < 0.01; })[0];
      return id ? where(id, her) : null;
    }

    function runKid(id, dt, her) {
      var c = st.court, leg = st.legs[id], p = o.where(id), goal = nextZ(p.z, leg.back);
      var lineZ = leg.back ? goal - RULES.past : goal + RULES.past;
      // A dash goes to just past the one line it started at (leg.dash holds that z).
      if (leg.dash !== null) {
        if (o.move(id, p.x, leg.dash, RULES.dash, dt)) { leg.dash = null; leg.wait = rand() * RULES.wait; leg.waited = 0; }
        return;
      }
      leg.wait -= dt;
      leg.waited += dt;
      // Her teammates only take a clear gap; the other team takes smaller gaps the longer they wait at a line.
      var safe = st.runners === 'blue' ? RULES.safe : Math.max(RULES.reach + 1, RULES.bold - leg.waited * RULES.impatient);
      var wz = leg.back ? lineZ - RULES.off : lineZ + RULES.off;
      // A dash starts only from the waiting spot, so a guard far away now is still far away at the line.
      if (leg.wait <= 0 && Math.abs(p.z - wz) < 0.5 && threat(p.x, lineZ, her) >= safe) { leg.dash = goal; leg.plan = null; return; }
      // Feint: wait out of reach of the line, sliding along it on one side of the middle line; switching sides crosses
      // the middle line, so only when its guard is not near.
      if (!leg.plan || o.move(id, leg.plan.x, leg.plan.z, RULES.run, dt)) {
        var side = p.x < c.cx ? -1 : 1, mid = midGuard(her), g = lineGuard(lineZ, her);
        var want = g ? (g.x < c.cx ? 1 : -1) : side;
        if (rand() < 0.3) want = -want;
        if (want !== side && (!mid || p.z > c.mid.from + RULES.reach || Math.abs(mid.z - p.z) >= RULES.midSafe)) side = want;
        leg.plan = { x: c.cx + side * (RULES.side + rand() * (c.w / 2 - RULES.side - COURT.edge)), z: wz };
      }
    }

    // A runner past the far line turns for home; one back behind the home line scores and goes again.
    function legs(id, p, ev) {
      var c = st.court, leg = id === 'her' ? st.her : st.legs[id];
      if (!leg.back && p.z < c.far) {
        leg.back = true;
        if (id !== 'her') { leg.plan = null; leg.dash = null; }
      } else if (leg.back && p.z > c.home) {
        leg.back = false;
        if (id !== 'her') { leg.plan = null; leg.dash = null; }
        st.score[st.runners]++;
        ev.push({ type: 'score', team: st.runners, kid: id });
        if (id !== 'her') ev.push({ type: 'pop', kid: id, text: POPS.home });
      }
    }

    function guardKid(id, dt, her) {
      var c = st.court, g = st.guards[id], post = st.posts[id], me = o.where(id), runners = st.team[st.runners];
      var lineZ = post === 'mid' ? null : c.cross[+post.slice(1)];
      // How far a runner is from this guard's line: across for the middle line (only beside it), along for a cross line.
      function off(p) {
        if (post !== 'mid') return Math.abs(p.z - lineZ);
        return p.z > c.mid.from + RULES.off || p.z < c.mid.to - RULES.off ? Infinity : Math.abs(p.x - c.mid.x);
      }
      // A guard watches one runner near the line for a while, picked at random, so the others sometimes get a gap.
      g.keep -= dt;
      if (!g.watch || g.keep <= 0 || runners.indexOf(g.watch) < 0 || off(where(g.watch, her)) > COURT.gap / 2) {
        var near = runners.filter(function (r) { return off(where(r, her)) <= COURT.gap / 2; });
        if (!near.length) near = runners.slice().sort(function (a, b) { return off(where(a, her)) - off(where(b, her)); }).slice(0, 1);
        g.watch = near[Math.floor(rand() * near.length) % near.length];
        g.keep = RULES.keep;
      }
      // Guards react a moment late: they go where the runner they watch was a moment ago, so a feint works.
      var now = where(g.watch, her), k = Math.min(1, dt / RULES.react);
      if (!g.seen || g.seenId !== g.watch) { g.seen = { x: now.x, z: now.z }; g.seenId = g.watch; }
      g.seen = { x: g.seen.x + (now.x - g.seen.x) * k, z: g.seen.z + (now.z - g.seen.z) * k };
      var best = g.seen;
      g.rest = Math.max(0, g.rest - dt);
      var speed = RULES.guard;
      if (g.lunge > 0) {
        g.lunge -= dt;
        speed = RULES.lunge;
        if (g.lunge <= 0) g.rest = RULES.rest;
      } else if (g.rest > 0) speed = RULES.restSpeed;
      else if (dist(me, now) <= RULES.lungeR) { g.lunge = RULES.lungeT; speed = RULES.lunge; }
      var tx = post === 'mid' ? c.mid.x : clamp(best ? best.x : c.cx, c.minX + COURT.edge, c.maxX - COURT.edge);
      var tz = post === 'mid' ? clamp(best ? best.z : (c.mid.from + c.mid.to) / 2, c.mid.to, c.mid.from) : lineZ;
      o.move(id, tx, tz, speed, dt);
      // Guards never leave their line.
      var at = o.where(id);
      if (post === 'mid') o.put(id, { x: c.mid.x, z: clamp(at.z, c.mid.to, c.mid.from) });
      else o.put(id, { x: clamp(at.x, c.minX + COURT.edge, c.maxX - COURT.edge), z: lineZ });
    }

    function swap(ev, by, kid) {
      st.swaps++;
      ev.push({ type: 'swap', by: by, kid: kid, herTeam: st.runners === 'blue' ? 'tagged' : 'tagger' }, { type: 'pop', kid: by === 'her' ? kid : by, text: by === 'her' ? POPS.tagged : POPS.got });
      st.runners = st.runners === 'blue' ? 'red' : 'blue';
      calm(ev);
      lineUp(ev);
    }

    function calm(ev) {
      st.chaseD = null;
      if (!st.danger) return;
      st.danger = false;
      ev.push({ type: 'danger', on: false });
    }

    function finish(ev) {
      st.done = true;
      var a = st.score.blue, b = st.score.red;
      st.result = a > b ? 'win' : a < b ? 'lose' : 'tie';
      calm(ev);
      st.ids.forEach(function (id) { o.put(id, { cheer: true, still: true }); });
      return ev.concat([{ type: 'end', kind: 'patintero', result: st.result }]);
    }

    function tick(dt, her) {
      if (!st || st.done) return [];
      var ev = [];
      // The 4 minutes run through the ready counts too.
      st.t += dt;
      if (st.phase === 'ready') {
        st.ready -= dt;
        var n = Math.max(1, Math.ceil(st.ready));
        if (st.ready > 0 && n !== st.shown) { st.shown = n; ev.push({ type: 'count', n: n }); }
        if (st.ready <= 0) { st.phase = 'play'; ev.push({ type: 'go' }); }
        return st.t >= RULES.time ? finish(ev) : ev;
      }
      var runners = st.team[st.runners], guards = Object.keys(st.posts);
      runners.forEach(function (id) { if (id !== 'her') runKid(id, dt, her); });
      guards.forEach(function (id) { if (id !== 'her') guardKid(id, dt, her); });
      // Tags: a guard touching a runner on the court swaps the teams.
      for (var i = 0; i < guards.length; i++) {
        for (var j = 0; j < runners.length; j++) {
          var g = where(guards[i], her), r = where(runners[j], her);
          if (onCourt(r) && dist(g, r) <= RULES.reach) {
            swap(ev, guards[i], runners[j]);
            return ev;
          }
        }
      }
      runners.forEach(function (id) { legs(id, where(id, her), ev); });
      if (st.score.blue >= RULES.win || st.score.red >= RULES.win || st.t >= RULES.time) return finish(ev);
      // Danger: a guard lunging close to her while she runs.
      if (st.runners === 'blue') {
        var near = null;
        guards.forEach(function (id) {
          var d = dist(o.where(id), her);
          if (st.guards[id].lunge > 0 && d <= RULES.danger && (near === null || d < near)) near = d;
        });
        st.chaseD = near;
        if (near !== null && !st.danger) { st.danger = true; ev.push({ type: 'danger', on: true }); }
        else if (near === null && st.danger) { st.danger = false; ev.push({ type: 'danger', on: false }); }
      }
      return ev;
    }

    function state() {
      if (!st) return null;
      return {
        kind: 'patintero', phase: st.phase, done: st.done, result: st.result, running: st.runners === 'blue', guarding: guarding(),
        score: { blue: st.score.blue, red: st.score.red }, left: Math.max(0, RULES.time - st.t),
        count: st.phase === 'ready' ? Math.max(1, Math.ceil(st.ready)) : 0, team: { blue: st.team.blue.slice(), red: st.team.red.slice() },
        posts: Object.assign({}, st.posts), ids: st.ids.slice(), danger: st.danger, chaseD: st.chaseD, swaps: st.swaps, herRuns: st.herRuns,
        props: []
      };
    }

    return {
      start: start, tick: tick, state: state, guarding: guarding,
      fence: function (x, z) { return !!st && !st.done && fence(st.court, guarding(), x, z); },
      playing: function () { return !!st && !st.done; },
      stop: function () { st = null; }
    };
  }

  var exported = { COURT: COURT, RULES: RULES, POPS: POPS, court: court, fence: fence, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Patintero = exported;
})(this);
```

- [ ] **Step 4: Wire the file in:** add `'patintero.js'` after `'mategame.js'` in `WORLD_FILES` (`tests/paths.js`),
  add `<script src="patintero.js"></script>` after the `mategame.js` line in both world HTML files, then run
  `node tools/update-precache.js`.

- [ ] **Step 5: Run `node --test`**: all pass (11 new tests).

- [ ] **Step 6: Stage**

```
git add web/world/patintero.js tests/world3d-patintero.test.js tests/paths.js web/world/grade-5.html web/world/grade-2.html web/sw.js
```

---

### Task 3: Tune kid play until the game keeps moving

**Files:**
- Create: `tests/world3d-patintero-sim.test.js`
- Modify: `web/world/patintero.js` (only `RULES` numbers and the kid runner / guard functions `runKid`, `guardKid`,
  `threat`, `lineGuard`, `midGuard`)

- [ ] **Step 1: Write the acceptance test** `tests/world3d-patintero-sim.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const P = require(worldFile('patintero.js'));

// Whole kid games on an open field, 20 seeds: she stands still behind the home line while her team runs and in the
// middle of her line while it guards, so only the kids play. The kids' play must keep the game moving.
function play(seed0) {
  let seed = seed0;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const kids = {};
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((id, i) => { kids[id] = { x: i, z: 0 }; });
  const f = {
    move(id, x, z, speed, dt) {
      const k = kids[id], dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz), s = speed * dt;
      if (d <= Math.max(s, 0.3)) { k.x = x; k.z = z; return true; }
      k.x += dx / d * s; k.z += dz / d * s;
      return false;
    },
    where: (id) => kids[id],
    put(id, p) { if (p.x !== undefined) { kids[id].x = p.x; kids[id].z = p.z; } return true; }
  };
  const g = P.create({ rand, move: f.move, where: f.where, put: f.put }), c = P.court(39, 74);
  const her = { x: 39, z: 90 }, out = { scores: 0, swaps: 0 };
  const take = (ev) => ev.forEach((e) => {
    if (e.type === 'place') { her.x = e.x; her.z = e.z; }
    if (e.type === 'score') out.scores++;
    if (e.type === 'swap') out.swaps++;
  });
  take(g.start(Object.keys(kids), her, c, null, seed0 % 2 === 1));
  for (let t = 0; t < 300 && g.playing(); t += 0.05) take(g.tick(0.05, her));
  out.ended = !g.playing();
  return out;
}

test('kid play keeps the game moving: points get scored and turns are neither instant nor endless', () => {
  const games = Array.from({ length: 20 }, (_, i) => play(i + 1));
  assert.ok(games.every((g) => g.ended), 'every game ends');
  const scored = games.filter((g) => g.scores > 0).length;
  const turns = games.reduce((n, g) => n + g.swaps + 1, 0), mean = 20 * P.RULES.time / turns;
  assert.ok(scored >= 10, 'kids score in at least half the games: ' + scored + '/20');
  assert.ok(mean >= 8 && mean <= 45, 'a turn lasts 8 to 45 s on average: ' + mean.toFixed(1));
});
```

- [ ] **Step 2: Run it:** `node --test tests/world3d-patintero-sim.test.js`. With the draft it fails with
  `kids score in at least half the games: 6/20`.

- [ ] **Step 3: Tune.** Change one thing at a time, rerun the sim and the Task 2 tests after each change, and keep a
  short log of what moved the numbers. Do not change the rules the spec fixed (lines, reach, one tag swaps, 3 points,
  4 minutes) or the guard speeds she meets (guard 8.5, lunge 11 for 0.6 s, rest 1.2 s): those are what make her game
  fair. Things that are free to change:
  - how long kid guards stick with one runner (`keep`) and how late they react (`react`);
  - kid runner speeds (`run`, `dash`), the waiting spot (`off`, `side`), the gaps they take (`safe`, `bold`,
    `impatient`, `midSafe`);
  - how a runner picks its waiting side (for example spreading runners at the same line to opposite sides, so a
    guard can watch only one of them).
  Learned while drafting: with `run` slower than `guard`, feints never open a gap; with `safe` above 5 and no
  impatience, her teammates never cross at all.

- [ ] **Step 4: Stop rule.** If after a reasonable effort the sim still misses its bar, do not lower the bar on your
  own: report the best numbers and settings to the owner and ask whether to accept them or change a rule (for
  example a point for reaching the far line).

- [ ] **Step 5: Run `node --test`**: all pass.

- [ ] **Step 6: Stage**

```
git add web/world/patintero.js tests/world3d-patintero-sim.test.js
```

---

### Task 4: The court beside the playground

**Files:**
- Modify: `web/world/games3d.js`
- Create: `tests/world3d-games-wiring.test.js`

- [ ] **Step 1: Write the failing test** `tests/world3d-games-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const P = require(worldFile('patintero.js'));

const games = fs.readFileSync(worldFile('games3d.js'), 'utf8');

test('the Patintero court and its run-offs are clear of everything in both grades', () => {
  const m = games.match(/COURT_AT = \[(-?[\d.]+), (-?[\d.]+)\]/);
  assert.ok(m, 'games3d.js names the court spot');
  const c = P.court(+m[1], +m[2]);
  for (const grade of ['grade5', 'grade2']) {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    for (let x = c.minX; x <= c.maxX; x += 0.5) {
      for (let z = c.far - P.COURT.end; z <= c.home + P.COURT.end; z += 0.5) {
        assert.ok(!L.blocked(obs, b, x, z, 0.5), grade + ' blocked at ' + x + ',' + z);
        assert.ok(!L.onPath(grade, x, z, 0.5), grade + ' path at ' + x + ',' + z);
      }
    }
  }
});

test('hiding props never land on the court', () => {
  assert.match(games, /function okSpot\(x, z\) \{[^}]*!onCourt\(x, z, 3\)/);
});
```

- [ ] **Step 2: Run it and see it fail** (no `COURT_AT`).

- [ ] **Step 3: Draw the court in `games3d.js`.**

At the top, with the other constants: `var COURT_AT = [39, 74];`
After the `board` block, add:

```js
    // --- the Patintero court beside the playground (always there; it blocks nothing) ---------------------------
    var P = W.Patintero, court = P.court(COURT_AT[0], COURT_AT[1]);
    (function () {
      var g = new THREE.Group(), c = court, end = P.COURT.end, chalk = '#fbfaf2';
      S.add(S.rbox(c.w + 1, 0.04, c.len + 2 * end, 0.02), '#d9b98a', c.cx, 0.02, c.cz, g);
      [c.home].concat(c.cross, [c.far]).forEach(function (z) { S.add(S.rbox(c.w, 0.05, 0.22, 0.01), chalk, c.cx, 0.05, z, g); });
      [c.minX, c.maxX].forEach(function (x) { S.add(S.rbox(0.22, 0.05, c.len, 0.01), chalk, x, 0.05, c.cz, g); });
      S.add(S.rbox(0.22, 0.05, c.mid.from - c.mid.to, 0.01), chalk, c.mid.x, 0.05, (c.mid.from + c.mid.to) / 2, g);
      S.add(S.cyl(0.12, 0.12, 2.4, 8), '#a0703c', c.minX - 0.8, 1.2, c.home + end - 0.6, g);
      var name = S.sprite(S.label('🏃 Patintero', '#6bb8ff'), 3.2, 3.2 * 180 / 512);
      name.position.set(c.minX - 0.8, 2.9, c.home + end - 0.6);
      g.add(name);
      S.scene.add(g);
    })();
    function onCourt(x, z, m) {
      return x > court.minX - m && x < court.maxX + m && z > court.far - P.COURT.end - m && z < court.home + P.COURT.end + m;
    }
```

Check the label helpers' signatures in `scene.js` (`label(text, bg)`, `sprite(tex, w, h)`) before use; the board
uses them the same way.

In `okSpot`, add `&& !onCourt(x, z, 3)` to the returned condition.

- [ ] **Step 4: Run `node --test` and `node tests/e2e/world-e2e.js`**: all pass. Take one headless screenshot of the
  court from above, if the e2e tooling offers one, and look at it.

- [ ] **Step 5: Stage**

```
git add web/world/games3d.js tests/world3d-games-wiring.test.js
```

---

### Task 5: The two-step picker, Let's play! and invites from all games

**Files:**
- Modify: `web/world/games3d.js`, `web/world/mates3d.js`, `web/world/world-main.js`
- Modify: `tests/world3d-games-wiring.test.js`, `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`

- [ ] **Step 1: Failing wiring tests** (append to `tests/world3d-games-wiring.test.js`):

```js
const mates = fs.readFileSync(worldFile('mates3d.js'), 'utf8');
const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');

test('a kid offers one 🎲 Let\'s play! that opens the group picker', () => {
  assert.match(mates, /GB\.play, onClick: function \(\) \{ o\.choose\(k\.m\.id\); \}/);
  assert.ok(!/GB\.tag|GB\.seek/.test(mates), 'no single-game buttons left in the kid bubble');
  assert.match(main, /choose: function \(id\) \{ if \(games\) games\.choose\(id\); \}/);
});

test('a friend asks for any game, each equally likely', () => {
  assert.match(games, /G\.GAMES\[Math\.floor\(rand\(\) \* G\.GAMES\.length\) % G\.GAMES\.length\]/);
});
```

- [ ] **Step 2: `games3d.js`: the picker.** Replace the body of `act(it)` and add `choose`:

```js
    // first: the kid who asked or was asked, or null at the board (the nearest kid then).
    function choose(first) {
      if (talk || game.playing() || pat.playing()) return;
      var who = first || M.nearest(her);
      say(first ? M.face(first) : '🎲', first ? nameOf(first) : String(LT.boardName).split(' · ').pop(), LT.kinds,
        G.GROUPS.map(function (g) {
          return { text: B[g.id], main: g.id === 'chase', onClick: function () { pickGame(g, who, first); } };
        }).concat([{ text: T.bye }]));
    }
    // A group with one game starts it straight away.
    function pickGame(g, who, first) {
      if (g.games.length === 1) return start(g.games[0], who);
      say(first ? M.face(first) : '🎲', first ? nameOf(first) : String(LT.boardName).split(' · ').pop(), LT.groups[g.id],
        g.games.map(function (id, n) { return { text: B[id], main: n === 0, onClick: function () { start(id, who); } }; })
          .concat([{ text: B.back, onClick: function () { choose(first); } }, { text: T.bye }]));
    }
    function act(it) {
      if (it.kind !== 'gameboard') return;
      choose(null);
    }
```

The game's own question text (`LT.board`, "Which game do you want to play?") is no longer used; remove it from both
grades in `mategame.js` and from any test that names it.

In `invite`, replace `kind: rand() < 0.5 ? 'tag' : 'seek'` with
`kind: G.GAMES[Math.floor(rand() * G.GAMES.length) % G.GAMES.length]`, and the invite line with
`kind === 'tag' ? LT.inviteTag : kind === 'patintero' ? LT.inviteRun : LT.inviteSeek`.

Return `choose: choose` from `create`.

- [ ] **Step 3: `mates3d.js`.** In `tail(k)`, replace the two pushes with
  `out.push({ text: GB.play, onClick: function () { o.choose(k.m.id); } });` and the guard `if (o.game && GB)` with
  `if (o.choose && GB)`. Update the `o = {...}` comment at the top of `create` (`choose(id)` replaces `game(kind, id)`).

- [ ] **Step 4: `world-main.js`.** In the `mates` options replace
  `game: function (kind, id) { if (games) games.start(kind, id); },` with
  `choose: function (id) { if (games) games.choose(id); },`.

- [ ] **Step 5: e2e.** In the `games` case of `tests/e2e/world-driver.page.js`: after `MD.talk('migo')`, record
  `o.talkButtons`, press `"🎲 Let's play!"`, record `o.kindButtons`, press `'🏃 Tag & Chase'`, record
  `o.chaseButtons`, press `'🏷️ Tag!'`. At the board: record `o.boardButtons` after `D.act()`, then press
  `'🙈 Hide & Seek'` (it starts straight away). In `tests/e2e/world-e2e.js` change the assertions to:

```js
  assert.ok(games.talkButtons.includes("🎲 Let's play!"), games.talkButtons.join());
  assert.deepEqual(games.kindButtons, ['🏃 Tag & Chase', '🙈 Hide & Seek', '👋 Bye']);
  assert.deepEqual(games.chaseButtons, ['🏷️ Tag!', '🏃 Patintero!', '⬅ Back', '👋 Bye']);
  assert.deepEqual(games.boardButtons, ['🏃 Tag & Chase', '🙈 Hide & Seek', '👋 Bye']);
```

- [ ] **Step 6: Run `node --test` and `node tests/e2e/world-e2e.js`**: all pass.

- [ ] **Step 7: Stage**

```
git add web/world/games3d.js web/world/mates3d.js web/world/world-main.js web/world/mategame.js tests/world3d-games-wiring.test.js tests/world3d-mategame.test.js tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 6: Playing Patintero in the world

**Files:**
- Modify: `web/world/games3d.js`, `web/world/world-main.js`
- Modify: `tests/world3d-games-wiring.test.js`

- [ ] **Step 1: Failing wiring tests** (append):

```js
test('her fence and her place come from the game', () => {
  assert.match(main, /blocked: function \(x, z\) \{ return L\.blocked\(obs, bounds, x, z, L\.PLAYER_R\) \|\| \(!!games && \(games\.blocked\(x, z, L\.PLAYER_R\) \|\| games\.fence\(x, z\)\)\); \}/);
  assert.match(main, /place: function \(x, z, face\) \{ ctl\.teleport\(x, z, face\); pal\.place\(ctl\.state, true\); \}/);
  assert.match(games, /fence: function \(x, z\) \{ return pat\.fence\(x, z\); \}/);
});
```

- [ ] **Step 2: `world-main.js`.** In `W.Move.create`'s options, the `blocked` becomes
  `return L.blocked(obs, bounds, x, z, L.PLAYER_R) || (!!games && (games.blocked(x, z, L.PLAYER_R) || games.fence(x, z)));`
  (only hers: the pet, kids and gifts keep `games.blocked`). In `W.Games3D.create`'s options add
  `place: function (x, z, face) { ctl.teleport(x, z, face); pal.place(ctl.state, true); },`.

- [ ] **Step 3: `games3d.js`: a second engine, and "whichever is playing".**
  - After `var game = G.create(...)`: `var pat = W.Patintero.create({ rand: rand, move: cast.move, where: cast.where, put: cast.put });`
  - Add `function playing() { return game.playing() || pat.playing(); }` and
    `function state() { return pat.state() && !pat.state().done ? pat.state() : game.state(); }`, and use them
    everywhere the file now calls `game.playing()` or `game.state()` for "is a game on" / the HUD / `release` / `end`
    (`items`, `act`, `choose`, `invite`, `tick`, `stop`, `heartbeat`, `hud`, `release`, `end`, the debug state).
    `game.disguiseProp`, `game.booReady`, `game.boo` stay on `game`.
  - `release()` calls both `game.stop()` and `pat.stop()`, removes the rings, and calls `o.freeze(false)`.
  - Return `fence: function (x, z) { return pat.fence(x, z); }`.

- [ ] **Step 4: Start.** In `start(kind, first)`:
  - For `'patintero'` the cast is 7 besides her (`PAT_KIDS = 7`, a new constant), her sister counting as one:
    `var want = kind === 'patintero' ? PAT_KIDS - (sis ? 1 : 0) : PLAYERS;` and `.slice(0, isSis(first) ? want + 1 : want)`
    in place of the `PLAYERS` slice; skip the props; then
    `ev = pat.start(ids, her, court, sis ? sis.id : null, !(last && last.kind === 'patintero' && last.herRuns));`
    so Play again starts the other way round (store `herRuns` in `last`). When `sis` is set, also put `sis.id` in
    `ids` as now.
  - Make the rings: one flat disc per player (her included) in a group added to the scene:
    `S.add(S.cyl(0.95, 0.95, 0.05, 24), blue ? '#4a8cff' : '#ff5a5a', 0, 0.06, 0, rings)`, where `blue` comes from
    `pat.state().team.blue`. Each `tick`, move every ring to its player (`her` for `'her'`, `cast.where(id)`).

- [ ] **Step 5: HUD.** In `hud()`, for `s.kind === 'patintero'`:
  - pill: `'🏃 Patintero 🔵 ' + s.score.blue + ' – ' + s.score.red + ' 🔴' + ' · ⏱️ ' + clock(s.left)`;
  - the hint line shows `s.running ? LT.patRun : LT.patGuard` unless an announcement is showing (`hintT > 0`);
  - `danger` uses `s.danger` and `s.chaseD` as for tag, with `P.RULES.danger` in place of `G.TAG.safe` for the
    opacity;
  - no cover, no disguise, no Boo! button.

- [ ] **Step 6: Events.** In `handle(ev)` add:

```js
        else if (e.type === 'place') {
          o.place(e.x, e.z, e.face);
          o.freeze(true);
        } else if (e.type === 'count' && pat.playing()) {
          var who = pat.state().team.blue[1];
          if (who && (e.n === 3 || e.n === 2)) popOf(who, e.n === 3 ? P.POPS.ready : P.POPS.set);
        } else if (e.type === 'swap') {
          o.sfx('catch');
          hint.textContent = e.herTeam === 'tagged' ? LT.patTagged : LT.patTagger;
          hintT = HINT_TIME;
        } else if (e.type === 'score') {
          o.sfx(e.team === 'blue' ? 'emote-cheer' : 'emote-clap');
          hint.textContent = e.team === 'blue' ? LT.patScore : LT.patTheyScore;
          hintT = HINT_TIME;
        }
```

The existing `'go'` branch already unfreezes her and plays `ride-start`; for Patintero it also pops `P.POPS.go` over
the same kid. The existing `'danger'` branch serves both games.

- [ ] **Step 7: Tick.** In `tick`, when `pat.playing()`: `var ev = pat.tick(dt, { x: st.x, z: st.z });`, then handle,
  hud, heartbeat and move the rings, as for `game`.

- [ ] **Step 8: End.** In `end(result, kid)`, for `s.kind === 'patintero'`:
  `line = result === 'win' ? LT.patWin(s.score.blue, s.score.red) : result === 'lose' ? LT.patLose(s.score.blue, s.score.red) : LT.patTie(s.score.blue, s.score.red)`,
  `next = 'patintero'`, the speaker is `last.first`, and `last.herRuns = s.herRuns`. ✖ End game and the other
  `end(null)` paths work as now.

- [ ] **Step 9: Debug.** `debug.state()` adds, for Patintero, `rings` (count), `fenced: { side: pat.fence(court.maxX + 1, court.cz), mid: pat.fence(court.mid.x + 1, court.cz) }`;
  add `debug.court = function () { return court; }`.

- [ ] **Step 10: Run `node --test` and `node tests/e2e/world-e2e.js`**: all pass.

- [ ] **Step 11: Stage**

```
git add web/world/games3d.js web/world/world-main.js tests/world3d-games-wiring.test.js
```

---

### Task 7: e2e: a Patintero game in the world

**Files:**
- Modify: `tests/e2e/world-driver.page.js` (new `patintero` case; add it to the mode list in the file's first comment)
- Modify: `tests/e2e/world-e2e.js`

- [ ] **Step 1: The driver case.** Following the `games` case's style (`D.pause()`, `MD.calm()`, `run(s)`):
  1. `D.startGame('patintero', MD.list()[0].id)`, one tick; record `kind`, `phase`, `pill`, `hint`, `rings`, the
     team sizes, `D.state().z > court.home` (she is behind the home line), and whether she moved during
     `run(1)` (she must not: frozen while ready).
  2. `run(3)`: record `phase` (`'play'`).
  3. Put the first kid guard (`state.posts`: the one on `'c0'`) beside her with `GD.place(id, x, court.cross[0])`,
     `D.stand(x, court.cross[0] + 0.5)`, one tick: record `guarding`, `posts.her`, `D.state().x` (on the middle
     line), `fenced`, the hint (`LT.patTagged`).
  4. `run(3)`, then place a runner kid on her and tick: record `running` again and the hint (`LT.patTagger`).
  5. `GD.end()`: record `playing`, `rings` and that she can walk freely again (`fenced` all false).
  6. Board → `'🏃 Tag & Chase'` → `'🏃 Patintero!'` starts it too; then `GD.end()`.

- [ ] **Step 2: Assertions** in `tests/e2e/world-e2e.js` (Grade 5 page):

```js
  const pat = run('patintero', stageWorld('patintero', 5, AVATAR_SCRIPT), 'patintero');
  assert.deepEqual(pat.errors, [], 'patintero: page errors');
  assert.equal(pat.start.kind, 'patintero');
  assert.equal(pat.start.phase, 'ready');
  assert.match(pat.start.pill, /^🏃 Patintero 🔵 0 – 0 🔴 · ⏱️ 4:00$/);
  assert.equal(pat.start.hint, 'Cross every line and come back!');
  assert.deepEqual(pat.start.teams, [4, 4]);
  assert.equal(pat.start.rings, 8);
  assert.equal(pat.start.behindHome, true);
  assert.equal(pat.start.movedWhileReady, false);
  assert.equal(pat.play.phase, 'play');
  assert.deepEqual([pat.tagged.guarding, pat.tagged.post, pat.tagged.onMid], [true, 'mid', true]);
  assert.deepEqual(pat.tagged.fenced, { side: true, mid: true });
  assert.equal(pat.tagged.hint, '😲 Tagged! Teams swap!');
  assert.equal(pat.tagger.running, true);
  assert.equal(pat.tagger.hint, '🎉 Got one! Teams swap!');
  assert.deepEqual(pat.afterEnd, { playing: false, rings: 0 });
  assert.equal(pat.fromBoard, 'patintero');
```

  (Use the avatar script string the `games` case passes to `stageWorld`; lift it into a shared constant if it is
  repeated.)

- [ ] **Step 3: Run `node tests/e2e/world-e2e.js`**: all pass.

- [ ] **Step 4: Stage**

```
git add tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 8: Docs

**Files:**
- Modify: `README.md`, `docs/HANDOFF.md`

- [ ] **Step 1: `README.md`.** In the 3D world's playground line, say the games come in two groups (🏃 Tag & Chase: tag,
  Patintero; 🙈 Hide & Seek: hide-and-seek) and describe Patintero in one or two sentences (court beside the
  playground, 4 against 4, she runs and then guards the middle line, first to 3 points or 4 minutes). Add "Patintero
  (run, be tagged, guard the middle line, tag back)" to the `world-e2e.js` line. Add the new test files to the
  project layout if the README lists tests.

- [ ] **Step 2: `docs/HANDOFF.md`.** Under Built → Playground games, add a "Game groups and Patintero (2026-10-08)"
  line. Under "Still pending on the owner's side", add "Patintero on the tablet: the court's place, the kids' play,
  her guarding on the middle line".

- [ ] **Step 3: Final checks.** `node --test`, `node tests/e2e/world-e2e.js`, and
  `git log origin/main..HEAD --grep='Co-Authored-By\|Claude-Session'` prints nothing.

- [ ] **Step 4: Stage**

```
git add README.md docs/HANDOFF.md
```

---

## Final review

Review the whole diff against the spec: every owner decision is in, Filipino lines read correctly on their own, no
two-right-answers style ambiguity in the bubbles, no file left out of `PRECACHE`, the court touches nothing, and the
kid-play numbers from Task 3 are written in the review notes for the owner's tablet check.
