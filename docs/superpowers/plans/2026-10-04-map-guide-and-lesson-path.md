# Map Guide and Lesson Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her buddy suggests one next step on the Campus/Bayan map and on every game's home, and each game's home shows its lessons as a zigzag path of stops with medals. Nothing is locked.

**Architecture:** `web/engine/guide.js` holds a pure `next()` picker (boss, then due review, then a quest for a game, then the next lesson without Bronze, then visit, mock or home, then done) plus the speech-bubble HTML. `world.js` shows the bubble above the map with a pulsing target and a lit road. `web/engine/trail.js` draws the zigzag path under each game's home cards and hides the lesson cards in Path view. Both read only data other engines already keep: `boss_v1`, `review_v1` (through `Recall.dueByApp`), `quests_v1`, `mastery_v1` and study history.

**Tech Stack:** Plain ES5 browser scripts (IIFE + `module.exports` for Node), `node --test` unit tests, headless Chrome e2e drivers (`tests/e2e/chrome.js`).

**Spec:** `docs/superpowers/specs/2026-10-04-map-guide-and-lesson-path-design.md`

**House rules for every task:**
- Never run `git commit`. Each task ends by staging its files; the user commits.
- Comments only where the code isn't obvious. Match the style of `world.js` and `search.js`.
- Before Task 1, Family presence (staged on 2026-10-04: `family.js`, `world.js`, both lobbies, all games) must already be committed. Check with `git status --short`: if any of those files still shows `A ` or `M `, stop and ask the user to commit Family presence first.
- Run unit tests from the repo root: `node --test`.

---

## File map

| File | What it does |
|---|---|
| `web/engine/guide.js` (new) | `next()` picker, `link()`, `bubble()`, Grade 5/Grade 2 text, CSS, page binding `Guide.step/html/addStyle` |
| `web/engine/trail.js` (new) | zigzag layout, stop and name-card HTML, `trail_v1` view, page binding `Trail.start` |
| `web/engine/world.js` | the target building's ring, the lit road, the `#campus-guide` bubble and Go ▶ |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | load `guide.js`; GLOBALS |
| `web/subjects/*/*/index.html` (17) | load `guide.js` and `trail.js`; one `Trail.start(...)` line; GLOBALS |
| `web/sw.js` | PRECACHE both files |
| `tests/paths.js` | ENGINE_FILES gains both files |
| `tests/guide.test.js`, `tests/trail.test.js` (new) | unit tests |
| `tests/guide-wiring.test.js`, `tests/trail-wiring.test.js` (new) | wiring tests |
| `tests/world.test.js`, `tests/world-wiring.test.js`, `tests/family-wiring.test.js` | target/road test; new GLOBALS ending |
| `tests/e2e/guide-e2e.js`, `driver-guide-lobby.page.js`, `driver-guide-game.page.js`, `driver-guide-param.page.js` (new) | e2e |
| `README.md` | the new e2e command |

---

### Task 1: The guide's picker (`guide.js`, pure part)

**Files:**
- Create: `web/engine/guide.js`
- Test: `tests/guide.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/guide.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const G = require(engineFile('guide.js'));
const W = require(engineFile('world.js'));
const { next, lessonsOf, firstOpen, findLesson, recentApp, todayQuests, dayKey, TEXT, AVATARS } = G;

const CARDS = [
  { app: 'history-explorers', name: 'History Explorers', href: '../subjects/grade-5/araling-panlipunan/index.html' },
  { app: 'life-lab', name: 'Life Lab', href: '../subjects/grade-5/science/index.html' },
  { app: 'math-mastery', name: 'Math Mastery', href: '../subjects/grade-5/math/index.html' },
];

// entry(['a', 'Title', best], ...) is one game's mastery_v1 entry.
function entry(...lessons) {
  const e = { order: [], lessons: {} };
  lessons.forEach(([id, title, best]) => { e.order.push(id); e.lessons[id] = { title, icon: '', now: best, best, paid: best }; });
  return e;
}
const ALL_BRONZE = {
  'history-explorers': entry(['h1', 'Kasaysayan', 1]),
  'life-lab': entry(['a', 'What Is Matter', 2], ['b', 'Matter', 1]),
  'math-mastery': entry(['m1', 'Divisibility', 3]),
};
const base = (extra) => Object.assign({ cards: CARDS, mastery: ALL_BRONZE }, extra);

test('the buddies are the same as on the map', () => {
  assert.deepEqual(AVATARS, W.AVATARS);
});

test('an open boss stage comes first', () => {
  const s = next(base({ stages: [{ app: 'life-lab', cleared: true }, { app: 'math-mastery', cleared: false }], due: { 'life-lab': 9 } }), 'grade5');
  assert.deepEqual(s, { kind: 'boss', app: 'math-mastery', text: '⚔️ The boss is waiting in Math Mastery!' });
});

test('then the game with the most due review, ties to the lobby order', () => {
  assert.deepEqual(next(base({ due: { 'life-lab': 3, 'math-mastery': 5 } }), 'grade5'),
    { kind: 'review', app: 'math-mastery', text: '🔁 Math Mastery has 5 review questions waiting', count: 5 });
  assert.equal(next(base({ due: { 'math-mastery': 2, 'life-lab': 2 } }), 'grade5').app, 'life-lab');
  assert.equal(next(base({ due: { 'life-lab': 1 } }), 'grade5').text, '🔁 Life Lab has 1 review question waiting');
  assert.equal(next(base({ due: { 'not-here': 9, 'life-lab': -2 } }), 'grade5').kind, 'done');
});

test('then a quest for a game: practice opens its lesson, explore opens the game, others are skipped', () => {
  const mastery = Object.assign({}, ALL_BRONZE, { 'life-lab': entry(['a', 'What Is Matter', 1], ['b', 'Matter', 0]) });
  const quests = [{ kind: 'stars', done: false }, { kind: 'practice', app: 'life-lab', lesson: 'what is  matter', done: false }];
  assert.deepEqual(next(base({ mastery, quests }), 'grade5'),
    { kind: 'quest', app: 'life-lab', text: "🎯 Today's quest: practice what is  matter in Life Lab", lesson: 'a', title: 'what is  matter' });
  assert.deepEqual(next(base({ quests: [{ kind: 'explore', app: 'math-mastery', done: false }] }), 'grade5'),
    { kind: 'quest', app: 'math-mastery', text: "🎯 Today's quest: play Math Mastery" });
  assert.equal(next(base({ quests: [{ kind: 'explore', app: 'math-mastery', done: true }, { kind: 'review', app: 'life-lab', done: false }] }), 'grade5').kind, 'done');
  assert.equal(next(base({ quests: [{ kind: 'practice', app: 'life-lab', lesson: 'Gone lesson', done: false }] }), 'grade5').lesson, null);
});

test('then the next lesson without Bronze, in the game she played last first', () => {
  const mastery = Object.assign({}, ALL_BRONZE, {
    'history-explorers': entry(['h1', 'Kasaysayan', 0]),
    'life-lab': entry(['a', 'What Is Matter', 1], ['b', 'Matter', 0], ['c', 'Measure', 0]),
  });
  assert.deepEqual(next(base({ mastery, recent: 'life-lab' }), 'grade5'),
    { kind: 'lesson', app: 'life-lab', text: '📘 Next stop: Matter in Life Lab', lesson: 'b', title: 'Matter' });
  assert.equal(next(base({ mastery }), 'grade5').app, 'history-explorers', 'no recent game: lobby order');
  assert.equal(next(base({ mastery, recent: 'math-mastery' }), 'grade5').app, 'history-explorers', 'the last game is all Bronze: lobby order');
  assert.equal(next(base({ mastery, recent: 'shop' }), 'grade5').app, 'history-explorers');
});

test('then a game never opened, then all done', () => {
  assert.deepEqual(next(base({ mastery: { 'life-lab': ALL_BRONZE['life-lab'] } }), 'grade5'),
    { kind: 'visit', app: 'history-explorers', text: '🧭 Visit History Explorers for the first time' });
  assert.deepEqual(next(base({}), 'grade5'), { kind: 'done', app: null, text: '🎉 All done today! Great work!' });
  assert.deepEqual(next(base({ canAfford: true }), 'grade5'),
    { kind: 'done', app: null, text: '🎉 All done today! You can buy a reward in the shop', shop: true });
});

test('inside a game: only that game counts, then the Mock Exam, then home', () => {
  const g = (extra) => next(Object.assign({ cards: [{ app: 'life-lab', name: 'Life Lab' }], app: 'life-lab', mastery: ALL_BRONZE }, extra), 'grade5');
  assert.equal(g({ stages: [{ app: 'math-mastery', cleared: false }] }).kind, 'mock', "another game's boss is not here");
  assert.deepEqual(g({ stages: [{ app: 'life-lab', cleared: false }] }), { kind: 'boss', app: 'life-lab', text: '⚔️ The boss is waiting here! Clear this stage.' });
  assert.deepEqual(g({ due: { 'life-lab': 3, 'math-mastery': 9 } }), { kind: 'review', app: 'life-lab', text: '🔁 3 review questions are waiting', count: 3 });
  assert.equal(g({ quests: [{ kind: 'explore', app: 'life-lab', done: false }] }).kind, 'mock', 'explore is for the lobby');
  assert.deepEqual(g({ quests: [{ kind: 'practice', app: 'life-lab', lesson: 'Matter', done: false }] }),
    { kind: 'quest', app: 'life-lab', text: "🎯 Today's quest: practice Matter", lesson: 'b', title: 'Matter' });
  assert.deepEqual(g({ mastery: { 'life-lab': entry(['a', 'What Is Matter', 1], ['b', 'Matter', 0]) } }),
    { kind: 'lesson', app: 'life-lab', text: '📘 Next stop: Matter', lesson: 'b', title: 'Matter' });
  assert.deepEqual(g({ finalStars: 2 }), { kind: 'mock', app: 'life-lab', text: '🏆 Every lesson has a medal! Try the Mock Exam for 3 stars' });
  assert.deepEqual(g({ finalStars: 3 }), { kind: 'home', app: 'life-lab', text: '🏠 This game is all Bronze! Go back to the map for your next stop' });
  assert.equal(g({ cards: [] }).kind, 'mock', 'works with no card list');
});

test('broken data never throws and reads as empty', () => {
  for (const o of [null, 7, { cards: 'x', stages: 'x', due: [], quests: {}, mastery: 3 }, { cards: [null, { app: 5 }], stages: [null, { app: 'life-lab' }] }]) {
    assert.equal(next(o, 'grade5').kind, 'done');
  }
  assert.deepEqual(lessonsOf({ order: ['a', 'a', 5, 'gone'], lessons: { a: { best: '2' }, gone: null } }), [{ id: 'a', title: 'a', best: 2 }]);
  assert.deepEqual(lessonsOf(null), []);
  assert.equal(firstOpen(entry(['a', 'A', 1])), null);
  assert.deepEqual(firstOpen(entry(['a', 'A', 1], ['b', 'B', 0])), { id: 'b', title: 'B', best: 0 });
  assert.equal(findLesson(null, 'x'), null);
});

test('the game played last comes from study history', () => {
  const apps = ['life-lab', 'math-mastery'];
  assert.equal(recentApp([{ app: 'life-lab', t: 5 }, { app: 'shop', t: 9 }, { app: 'math-mastery', t: 7 }, { app: 'math-mastery' }], apps), 'math-mastery');
  assert.equal(recentApp('x', apps), null);
  assert.equal(recentApp([], apps), null);
});

test("only today's quests count", () => {
  const now = Date.UTC(2026, 9, 4, 4);
  assert.deepEqual(todayQuests({ day: dayKey(now), list: [{ kind: 'stars' }, null] }, now), [{ kind: 'stars' }]);
  assert.deepEqual(todayQuests({ day: '2026-10-01', list: [{ kind: 'stars' }] }, now), []);
  assert.deepEqual(todayQuests(null, now), []);
});

test('every Grade 2 guide line is Filipino · English, and the English is the Grade 5 line', () => {
  for (const [key, v] of Object.entries(TEXT.grade2)) {
    const g2 = typeof v === 'function' ? v('Life Lab', 2) : v;
    const g5 = typeof v === 'function' ? TEXT.grade5[key]('Life Lab', 2) : TEXT.grade5[key];
    if (key === 'go') { assert.equal(g2, g5, 'buttons stay English'); continue; }
    const cut = g2.lastIndexOf(' · ');
    assert.ok(cut > 0, key + ' has a Filipino line and an English line');
    assert.ok(g5.endsWith(g2.slice(cut + 3)), key + ': the English matches Grade 5');
  }
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/guide.test.js`
Expected: FAIL with `Cannot find module` for `guide.js`.

- [ ] **Step 3: Write the picker**

Create `web/engine/guide.js`:

```js
/* The guide: one next step for her, on the lobby map and on each game's home. The pages are decoded as UTF-8, so the
   text can hold emoji. next() picks the step from what the other engines already keep: the weekly boss, due review,
   today's quests, medals (mastery_v1) and the game she played last. Nothing is locked; the guide only suggests. */
(function (root) {
  'use strict';

  // The same buddies as world.js (a test keeps them equal), so a game shows her buddy without loading the map.
  var AVATARS = { girl: '👧', boy: '👦', cat: '🐱', dog: '🐶', bear: '🐻', rabbit: '🐰', owl: '🦉', robot: '🤖' };
  var DEFAULT_AVATAR = 'cat';

  function questionsEn(n) { return n + (n === 1 ? ' review question' : ' review questions'); }
  function waitingEn(n) { return questionsEn(n) + (n === 1 ? ' is' : ' are') + ' waiting'; }
  var TEXT = {
    grade5: {
      boss: function (name) { return '⚔️ The boss is waiting in ' + name + '!'; },
      bossHere: '⚔️ The boss is waiting here! Clear this stage.',
      review: function (name, n) { return '🔁 ' + name + ' has ' + questionsEn(n) + ' waiting'; },
      reviewHere: function (n) { return '🔁 ' + waitingEn(n); },
      practice: function (name, lesson) { return '🎯 Today\'s quest: practice ' + lesson + ' in ' + name; },
      practiceHere: function (lesson) { return '🎯 Today\'s quest: practice ' + lesson; },
      explore: function (name) { return '🎯 Today\'s quest: play ' + name; },
      lesson: function (name, lesson) { return '📘 Next stop: ' + lesson + ' in ' + name; },
      lessonHere: function (lesson) { return '📘 Next stop: ' + lesson; },
      visit: function (name) { return '🧭 Visit ' + name + ' for the first time'; },
      mock: '🏆 Every lesson has a medal! Try the Mock Exam for 3 stars',
      home: '🏠 This game is all Bronze! Go back to the map for your next stop',
      done: '🎉 All done today! Great work!',
      doneShop: '🎉 All done today! You can buy a reward in the shop',
      go: 'Go ▶'
    },
    grade2: {
      boss: function (name) { return '⚔️ Naghihintay ang boss sa ' + name + '! · The boss is waiting in ' + name + '!'; },
      bossHere: '⚔️ Naghihintay ang boss dito! · The boss is waiting here! Clear this stage.',
      review: function (name, n) { return '🔁 May ' + n + ' tanong na babalikan sa ' + name + ' · ' + name + ' has ' + questionsEn(n) + ' waiting'; },
      reviewHere: function (n) { return '🔁 May ' + n + ' tanong na babalikan · ' + waitingEn(n); },
      practice: function (name, lesson) { return '🎯 Quest ngayon: sanayin ang ' + lesson + ' sa ' + name + ' · Today\'s quest: practice ' + lesson + ' in ' + name; },
      practiceHere: function (lesson) { return '🎯 Quest ngayon: sanayin ang ' + lesson + ' · Today\'s quest: practice ' + lesson; },
      explore: function (name) { return '🎯 Quest ngayon: laruin ang ' + name + ' · Today\'s quest: play ' + name; },
      lesson: function (name, lesson) { return '📘 Susunod: ' + lesson + ' sa ' + name + ' · Next stop: ' + lesson + ' in ' + name; },
      lessonHere: function (lesson) { return '📘 Susunod: ' + lesson + ' · Next stop: ' + lesson; },
      visit: function (name) { return '🧭 Bisitahin ang ' + name + ' · Visit ' + name + ' for the first time'; },
      mock: '🏆 May medalya na ang bawat aralin! Subukan ang Mock Exam · Every lesson has a medal! Try the Mock Exam for 3 stars',
      home: '🏠 Bronze na ang lahat ng aralin dito! Bumalik sa mapa · This game is all Bronze! Go back to the map for your next stop',
      done: '🎉 Tapos na ang lahat ngayon! Ang galing mo! · All done today! Great work!',
      doneShop: '🎉 Tapos na ang lahat ngayon! May mabibili ka sa tindahan · All done today! You can buy a reward in the shop',
      go: 'Go ▶'
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function list(v) { return Array.isArray(v) ? v.filter(isObj) : []; }
  function count(v) { v = Math.floor(Number(v)); return v > 0 ? v : 0; }
  function level(v) { v = Math.floor(Number(v)); return v >= 1 && v <= 3 ? v : 0; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fold(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  // A game's lessons in mastery_v1 order: [{ id, title, best }].
  function lessonsOf(entry) {
    if (!isObj(entry) || !isObj(entry.lessons)) return [];
    var order = Array.isArray(entry.order) ? entry.order : Object.keys(entry.lessons);
    return order.filter(function (id, i) {
      return typeof id === 'string' && order.indexOf(id) === i && has(entry.lessons, id) && isObj(entry.lessons[id]);
    }).map(function (id) {
      var l = entry.lessons[id];
      return { id: id, title: typeof l.title === 'string' && l.title ? l.title : id, best: level(l.best) };
    });
  }

  function firstOpen(entry) {
    var open = lessonsOf(entry).filter(function (l) { return l.best < 1; });
    return open.length ? open[0] : null;
  }

  // A practice quest names its lesson by title; this finds the lesson's id.
  function findLesson(entry, title) {
    var want = fold(title), hit = lessonsOf(entry).filter(function (l) { return fold(l.title) === want; });
    return hit.length ? hit[0].id : null;
  }

  function recentApp(entries, apps) {
    var best = null;
    list(entries).forEach(function (e) {
      if (apps.indexOf(e.app) < 0 || typeof e.t !== 'number') return;
      if (!best || e.t > best.t) best = e;
    });
    return best ? best.app : null;
  }

  function todayQuests(state, nowMs) {
    return isObj(state) && state.day === dayKey(nowMs) ? list(state.list) : [];
  }

  function step(kind, app, text, extra) {
    var s = { kind: kind, app: app, text: text };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  }

  // o: { cards: [{ app, name }] in lobby order, app (a game's own id; left out on the lobby), stages, due, quests,
  // mastery (mastery_v1 apps), recent, finalStars (a game's Mock Exam stars), canAfford }. Always returns one step.
  function next(o, grade) {
    var T = TEXT[grade] || TEXT.grade5;
    o = isObj(o) ? o : {};
    var here = typeof o.app === 'string' && o.app ? o.app : null, names = {}, apps = [], i;
    list(o.cards).forEach(function (c) {
      if (typeof c.app !== 'string' || has(names, c.app) || (here && c.app !== here)) return;
      names[c.app] = typeof c.name === 'string' && c.name ? c.name : c.app;
      apps.push(c.app);
    });
    if (here && !has(names, here)) { names[here] = here; apps.push(here); }
    var due = isObj(o.due) ? o.due : {}, mastery = isObj(o.mastery) ? o.mastery : {};

    var stages = list(o.stages);
    for (i = 0; i < stages.length; i++) {
      var st = stages[i];
      if (st.cleared !== true && has(names, st.app)) return step('boss', st.app, here ? T.bossHere : T.boss(names[st.app]));
    }

    var most = null;
    apps.forEach(function (a) {
      var n = count(due[a]);
      if (n > 0 && (!most || n > most.count)) most = { app: a, count: n };
    });
    if (most) return step('review', most.app, here ? T.reviewHere(most.count) : T.review(names[most.app], most.count), { count: most.count });

    // A review quest is left to the due-review step above: with nothing due there is nothing to review.
    var quests = list(o.quests);
    for (i = 0; i < quests.length; i++) {
      var q = quests[i];
      if (q.done === true || !has(names, q.app)) continue;
      if (q.kind === 'practice' && typeof q.lesson === 'string' && q.lesson) {
        return step('quest', q.app, here ? T.practiceHere(q.lesson) : T.practice(names[q.app], q.lesson),
          { lesson: findLesson(mastery[q.app], q.lesson), title: q.lesson });
      }
      if (q.kind === 'explore' && !here) return step('quest', q.app, T.explore(names[q.app]));
    }

    var order = apps;
    if (!here && typeof o.recent === 'string' && has(names, o.recent)) {
      order = [o.recent].concat(apps.filter(function (a) { return a !== o.recent; }));
    }
    for (i = 0; i < order.length; i++) {
      var l = firstOpen(mastery[order[i]]);
      if (l) return step('lesson', order[i], here ? T.lessonHere(l.title) : T.lesson(names[order[i]], l.title), { lesson: l.id, title: l.title });
    }

    if (here) return count(o.finalStars) < 3 ? step('mock', here, T.mock) : step('home', here, T.home);

    for (i = 0; i < apps.length; i++) {
      if (!lessonsOf(mastery[apps[i]]).length) return step('visit', apps[i], T.visit(names[apps[i]]));
    }
    return o.canAfford === true ? step('done', null, T.doneShop, { shop: true }) : step('done', null, T.done);
  }

  var exported = { next: next, lessonsOf: lessonsOf, firstOpen: firstOpen, findLesson: findLesson, recentApp: recentApp,
    todayQuests: todayQuests, dayKey: dayKey, TEXT: TEXT, AVATARS: AVATARS, DEFAULT_AVATAR: DEFAULT_AVATAR };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    root.Guide = exported;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/guide.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Stage**

```bash
git add web/engine/guide.js tests/guide.test.js
```

---

### Task 2: The guide's bubble, links and page binding

**Files:**
- Modify: `web/engine/guide.js`
- Test: `tests/guide.test.js`

- [ ] **Step 1: Add the failing tests**

In `tests/guide.test.js`, change the destructuring line at the top to:

```js
const { next, lessonsOf, firstOpen, findLesson, recentApp, todayQuests, dayKey, link, bubble, avatarOf, TEXT, AVATARS } = G;
```

Then append:

```js
function memory(initial) {
  const data = Object.assign({}, initial);
  return { getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('Go links open the game at the right spot', () => {
  const sci = '../subjects/grade-5/science/index.html';
  assert.equal(link({ kind: 'boss', app: 'life-lab' }, CARDS), sci + '?boss=1');
  assert.equal(link({ kind: 'review', app: 'life-lab' }, CARDS), sci + '?review=1');
  assert.equal(link({ kind: 'lesson', app: 'life-lab', lesson: 'Ang Kuwento #1' }, CARDS), sci + '?lesson=Ang%20Kuwento%20%231');
  assert.equal(link({ kind: 'quest', app: 'life-lab', lesson: 'b' }, CARDS), sci + '?lesson=b');
  assert.equal(link({ kind: 'quest', app: 'life-lab', lesson: null }, CARDS), sci);
  assert.equal(link({ kind: 'visit', app: 'life-lab' }, CARDS), sci);
  assert.equal(link({ kind: 'boss', app: 'life-lab' }, [{ app: 'life-lab', href: 'x.html?a=1' }]), 'x.html?a=1&boss=1');
  assert.equal(link({ kind: 'done', app: null }, CARDS), null);
  assert.equal(link({ kind: 'visit', app: 'nowhere' }, CARDS), null);
  assert.equal(link(null, CARDS), null);
});

test('the bubble shows the buddy and the step, escaped, with Go when it leads somewhere', () => {
  assert.equal(bubble({ text: 'A <b> & "c"' }, '🦉', 'grade5', true),
    '<div class="g-guide" role="status"><span class="g-buddy" aria-hidden="true">🦉</span><p class="g-text">A &lt;b&gt; &amp; &quot;c&quot;</p><button type="button" class="g-go">Go ▶</button></div>');
  assert.ok(!bubble({ text: 'x' }, '🦉', 'grade2', false).includes('g-go'));
});

test('her buddy comes from world_v1, the cat by default', () => {
  assert.equal(avatarOf(memory({ world_v1: JSON.stringify({ v: 1, avatar: 'owl' }) })), '🦉');
  assert.equal(avatarOf(memory({ world_v1: JSON.stringify({ v: 1, avatar: 'toString' }) })), '🐱');
  assert.equal(avatarOf(memory({ world_v1: '{broken' })), '🐱');
  assert.equal(avatarOf(memory()), '🐱');
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/guide.test.js`
Expected: FAIL with `link is not a function`.

- [ ] **Step 3: Add links, the bubble, CSS and the page binding**

In `web/engine/guide.js`, add these functions right after `next()`:

```js
  function withParam(href, param) { return href + (href.indexOf('?') >= 0 ? '&' : '?') + param; }

  // Where Go takes her from the lobby: the step's game with ?boss=1, ?review=1 or ?lesson=<id>; null when it leads nowhere.
  function link(s, cards) {
    if (!isObj(s) || !s.app) return null;
    var card = list(cards).filter(function (c) { return c.app === s.app && typeof c.href === 'string' && c.href; })[0];
    if (!card) return null;
    if (s.kind === 'boss') return withParam(card.href, 'boss=1');
    if (s.kind === 'review') return withParam(card.href, 'review=1');
    if (typeof s.lesson === 'string' && s.lesson) return withParam(card.href, 'lesson=' + encodeURIComponent(s.lesson));
    return card.href;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function avatarOf(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem('world_v1')); } catch (e) {}
    var id = isObj(d) && typeof d.avatar === 'string' && has(AVATARS, d.avatar) ? d.avatar : DEFAULT_AVATAR;
    return AVATARS[id];
  }

  function bubble(s, avatar, grade, go) {
    var T = TEXT[grade] || TEXT.grade5;
    return '<div class="g-guide" role="status"><span class="g-buddy" aria-hidden="true">' + esc(avatar) + '</span>' +
      '<p class="g-text">' + esc(s.text) + '</p>' + (go ? '<button type="button" class="g-go">' + esc(T.go) + '</button>' : '') + '</div>';
  }

  var CSS =
    '.g-guide{display:flex;align-items:center;gap:12px;max-width:720px;margin:0 auto 14px;padding:12px 14px;box-sizing:border-box;' +
      'border-radius:18px;background:var(--card,#fff);color:var(--ink,#1d1d1f);border:2px solid var(--header-accent,var(--accent,#2E6F9E));}' +
    '.g-buddy{flex:none;font-size:2rem;line-height:1;}' +
    '.g-text{flex:1;min-width:0;margin:0;font-weight:800;line-height:1.35;}' +
    '.g-go{flex:none;min-height:44px;padding:8px 16px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;' +
      'color:#fff;background:var(--header-accent,var(--accent,#2E6F9E));}' +
    '.g-go:focus-visible{outline:3px solid var(--ink,#1d1d1f);outline-offset:2px;}' +
    '@media print{.g-guide{display:none !important;}}';
```

Replace the export block at the bottom of the file (from `var exported = {` to the end) with:

```js
  var exported = { next: next, link: link, bubble: bubble, avatarOf: avatarOf, lessonsOf: lessonsOf, firstOpen: firstOpen,
    findLesson: findLesson, recentApp: recentApp, todayQuests: todayQuests, dayKey: dayKey, TEXT: TEXT, AVATARS: AVATARS,
    DEFAULT_AVATAR: DEFAULT_AVATAR, CSS: CSS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies and games get step/html/addStyle for their grade; a page without data-grade gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && TEXT[grade]) {
      var storage = root.Learner ? root.Learner.storage : root.localStorage;
      var safe = function (fn, fallback) {
        try { var v = fn(); return v === undefined || v === null ? fallback : v; } catch (e) { return fallback; }
      };
      // cards: [{ app, name, href }]; opts: { app (inside a game), finalStars, canAfford }.
      api.step = function (cards, opts) {
        opts = opts || {};
        var apps = list(cards).map(function (c) { return c.app; });
        return next({
          cards: cards,
          app: opts.app,
          stages: safe(function () { return root.Boss.current().stages; }, []),
          due: safe(function () { return root.Recall.dueByApp(); }, {}),
          quests: safe(function () { return todayQuests(root.Quests.state(), Date.now()); }, []),
          mastery: safe(function () { return root.Mastery.summary().apps; }, {}),
          recent: safe(function () { return recentApp(root.StudyHistory.list(), apps); }, null),
          finalStars: opts.finalStars,
          canAfford: opts.canAfford
        }, grade);
      };
      api.html = function (s, go) { return bubble(s, avatarOf(storage), grade, go); };
      api.addStyle = function (doc) {
        if (doc.getElementById('guide-style')) return;
        var style = doc.createElement('style');
        style.id = 'guide-style';
        style.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(style);
      };
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Guide = api;
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/guide.test.js`
Expected: PASS, 14 tests.

- [ ] **Step 5: Stage**

```bash
git add web/engine/guide.js tests/guide.test.js
```

---

### Task 3: The lesson path's layout and HTML (`trail.js`, pure part)

**Files:**
- Create: `web/engine/trail.js`
- Test: `tests/trail.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/trail.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { layout, height, buddySpot, pct, readView, saveView, lessonParam, indexOfId, medals, nextStop, pathHtml, cardHtml,
  lobbyUrl, TEXT, KEY, ROW, TOP } = require(engineFile('trail.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('stops zigzag middle, left, middle, right, one row apart', () => {
  assert.deepEqual(layout(1), [{ x: 0.5, y: TOP }]);
  assert.deepEqual(layout(5).map((p) => p.x), [0.5, 0.25, 0.5, 0.75, 0.5]);
  const many = layout(29);
  assert.equal(many.length, 29);
  many.forEach((p, i) => assert.equal(p.y, TOP + i * ROW));
  assert.equal(height(0), 0);
  assert.equal(height(1), 2 * TOP);
  assert.equal(height(7), 2 * TOP + 6 * ROW);
});

test('the buddy stands beside a stop, toward the middle', () => {
  assert.equal(pct(buddySpot({ x: 0.5, y: 10 }).x), 67);
  assert.equal(pct(buddySpot({ x: 0.25, y: 10 }).x), 42);
  assert.equal(pct(buddySpot({ x: 0.75, y: 10 }).x), 58);
  assert.equal(buddySpot({ x: 0.5, y: 10 }).y, 10);
});

test('Path is the default view and the choice is saved', () => {
  const s = memory();
  assert.equal(readView(s), 'path');
  assert.equal(saveView(s, () => 7, 'list'), true);
  assert.deepEqual(JSON.parse(s.data[KEY]), { v: 1, view: 'list', t: 7 });
  assert.equal(readView(s), 'list');
  saveView(s, () => 8, 'nonsense');
  assert.equal(readView(s), 'path');
  assert.equal(readView(memory({ [KEY]: '{broken' })), 'path');
});

test('?lesson= names the lesson to open', () => {
  assert.equal(lessonParam('?lesson=b'), 'b');
  assert.equal(lessonParam('?x=1&lesson=Ang%20Kuwento%20%231'), 'Ang Kuwento #1');
  assert.equal(lessonParam('?mylesson=b'), null);
  assert.equal(lessonParam('?lesson=%E0%A4%A'), null);
  assert.equal(lessonParam(''), null);
  assert.equal(indexOfId([{ id: 'a' }, { id: 'b' }], 'b'), 1);
  assert.equal(indexOfId([{ id: 'a' }], null), -1);
});

test('medals come from mastery_v1 and the next stop is the first without Bronze', () => {
  const lessons = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const ms = medals(lessons, { lessons: { a: { best: 2, now: 1 }, b: { best: 1, now: 1 } } });
  assert.deepEqual(ms, [{ best: 2, polish: true }, { best: 1, polish: false }, { best: 0, polish: false }]);
  assert.equal(nextStop(ms), 2);
  assert.equal(nextStop(ms.slice(0, 2)), -1);
  assert.deepEqual(medals(lessons, null), [{ best: 0, polish: false }, { best: 0, polish: false }, { best: 0, polish: false }]);
});

test('the path draws a button per stop, the next one glowing, with the buddy beside it', () => {
  const lessons = [{ id: 'a', title: 'What Is Matter', icon: '⚛️' }, { id: 'b', title: 'Matter <2>', icon: '<svg/>' }];
  const html = pathHtml(lessons, [{ best: 1, polish: false }, { best: 0, polish: false }], 1, '🦉', TEXT.grade5);
  assert.ok(html.includes('class="t-stop t-tier-1" data-stop="0" style="left:50%;top:' + TOP + 'px" aria-label="Lesson 1: What Is Matter, bronze"'));
  assert.ok(html.includes('class="t-stop t-tier-0 t-next" data-stop="1" style="left:25%;top:' + (TOP + ROW) + 'px" aria-label="Lesson 2: Matter &lt;2&gt;, next stop"'));
  assert.ok(html.includes('<span class="t-icon" aria-hidden="true">⚛️</span>'));
  assert.ok(html.includes('<span class="t-icon" aria-hidden="true">2</span>'), 'markup icons fall back to the number');
  assert.equal((html.match(/🥉/g) || []).length, 1);
  assert.ok(html.includes('<span class="t-buddy" aria-hidden="true" style="left:42%;top:' + (TOP + ROW) + 'px">🦉</span>'));

  const done = pathHtml(lessons, [{ best: 1, polish: true }, { best: 3, polish: false }], -1, '🦉', TEXT.grade5);
  assert.ok(!done.includes('t-next'));
  assert.ok(done.includes('🥉🔧') && done.includes(', needs a polish'));
  assert.ok(done.includes('<span class="t-buddy" aria-hidden="true" style="left:42%;'), 'all Bronze: the buddy waits at the last stop');
  assert.ok(!pathHtml([], [], -1, '🦉', TEXT.grade5).includes('t-buddy'));
});

test('tapping a stop shows its name and Open; the last stop opens its card upward', () => {
  const lessons = [{ id: 'a', title: 'What Is Matter' }, { id: 'b', title: 'Matter' }];
  const ms = [{ best: 1, polish: false }, { best: 0, polish: false }];
  const first = cardHtml(lessons, ms, 0, TEXT.grade5);
  assert.ok(first.startsWith('<div class="t-card" role="dialog" aria-label="Lesson 1: What Is Matter" style="left:50%;top:' + (TOP + 46) + 'px">'));
  assert.ok(first.includes('<p class="t-card-title">1 · What Is Matter 🥉</p>'));
  assert.ok(first.includes('<button type="button" class="t-open" data-open="0">Open ▶</button>'));
  assert.ok(cardHtml(lessons, ms, 1, TEXT.grade5).startsWith('<div class="t-card t-card-up" role="dialog" aria-label="Lesson 2: Matter" style="left:25%;top:' + (TOP + ROW - 46) + 'px">'));
  assert.equal(cardHtml(lessons, ms, 5, TEXT.grade5), '');
});

test('Grade 2 stop names pair Filipino with English; buttons stay English', () => {
  assert.equal(TEXT.grade2.stop(3, 'Kuwento'), 'Aralin 3 · Lesson 3: Kuwento');
  assert.equal(TEXT.grade2.open, TEXT.grade5.open);
  assert.equal(TEXT.grade2.path, TEXT.grade5.path);
  assert.equal(TEXT.grade2.list, TEXT.grade5.list);
});

test('home goes to the grade lobby, like the 🏠 button', () => {
  assert.equal(lobbyUrl('grade2'), '../../../lobby/grade-2.html');
  assert.equal(lobbyUrl('grade5'), '../../../lobby/grade-5.html');
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/trail.test.js`
Expected: FAIL with `Cannot find module` for `trail.js`.

- [ ] **Step 3: Write the pure part of `trail.js`**

Create `web/engine/trail.js`:

```js
/* The lesson path on every game's home: each lesson is a stop down a zigzag with its medal, her buddy stands at the
   first lesson without Bronze, and the guide's bubble on top says what to do next. Nothing is locked. A game calls
   Trail.start({ app, title, list, lessons, review, final, finalStars }) right after Search.start: list is the id of the
   element holding the home cards (lesson cards carry data-search-lesson="<index>"), lessons is medalLessons(), review
   is startReview, final is startFinalExam and finalStars() the Mock Exam's best stars. */
(function (root) {
  'use strict';

  var KEY = 'trail_v1';
  var ROW = 104, TOP = 56, SIDE = 0.17, CARD_GAP = 46;
  var XS = [0.5, 0.25, 0.5, 0.75];
  var MEDALS = ['', '🥉', '🥈', '🥇'];
  var TIERS = ['', 'bronze', 'silver', 'gold'];
  var TEXT = {
    grade5: {
      path: '🗺️ Path', list: '📋 List', open: 'Open ▶', label: 'Lesson path', next: 'next stop', polish: 'needs a polish',
      stop: function (n, title) { return 'Lesson ' + n + ': ' + title; }
    },
    grade2: {
      path: '🗺️ Path', list: '📋 List', open: 'Open ▶', label: 'Daan ng mga aralin · Lesson path', next: 'next stop', polish: 'needs a polish',
      stop: function (n, title) { return 'Aralin ' + n + ' · Lesson ' + n + ': ' + title; }
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function level(v) { v = Math.floor(Number(v)); return v >= 1 && v <= 3 ? v : 0; }
  function pct(x) { return Math.round(x * 1000) / 10; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function readView(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    return isObj(d) && d.v === 1 && d.view === 'list' ? 'list' : 'path';
  }

  function saveView(storage, now, view) {
    try {
      storage.setItem(KEY, JSON.stringify({ v: 1, view: view === 'list' ? 'list' : 'path', t: now() }));
      return true;
    } catch (e) { return false; }
  }

  // Stop centers: x as a fraction of the width, y in px from the top.
  function layout(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push({ x: n === 1 ? 0.5 : XS[i % XS.length], y: TOP + i * ROW });
    return out;
  }
  function height(n) { return n > 0 ? 2 * TOP + (n - 1) * ROW : 0; }
  function buddySpot(p) { return { x: p.x > 0.5 ? p.x - SIDE : p.x + SIDE, y: p.y }; }

  function lessonParam(search) {
    var m = /(?:^|[?&])lesson=([^&]*)/.exec(search || '');
    if (!m) return null;
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return null; }
  }

  function indexOfId(lessons, id) {
    if (typeof id !== 'string') return -1;
    for (var i = 0; i < lessons.length; i++) if (isObj(lessons[i]) && lessons[i].id === id) return i;
    return -1;
  }

  // Each lesson's medal from the game's mastery_v1 entry.
  function medals(lessons, entry) {
    var saved = isObj(entry) && isObj(entry.lessons) ? entry.lessons : {};
    return lessons.map(function (l) {
      var m = isObj(l) && has(saved, l.id) && isObj(saved[l.id]) ? saved[l.id] : {};
      var best = level(m.best);
      return { best: best, polish: best > 0 && level(m.now) < best };
    });
  }

  function nextStop(ms) {
    for (var i = 0; i < ms.length; i++) if (ms[i].best < 1) return i;
    return -1;
  }

  function titleOf(l) { return typeof l.title === 'string' && l.title ? l.title : String(l.id); }
  // Grade 2 lessons keep SVG markup as their icon; those stops show the lesson number instead.
  function iconOf(l, n) {
    var s = typeof l.icon === 'string' ? l.icon.trim() : '';
    return s && s.indexOf('<') < 0 && s.length <= 8 ? s : String(n);
  }
  function sticker(m) { return m.best ? MEDALS[m.best] + (m.polish ? '🔧' : '') : ''; }

  function pathHtml(lessons, ms, next, avatar, T) {
    var pts = layout(lessons.length), h = height(lessons.length);
    var line = pts.map(function (p) { return pct(p.x) + ',' + p.y; }).join(' ');
    var s = '<div class="t-map" style="height:' + h + 'px">' +
      '<svg class="t-line" viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + line + '"/></svg>';
    lessons.forEach(function (l, i) {
      var m = ms[i], n = i + 1;
      var label = T.stop(n, titleOf(l)) + (m.best ? ', ' + TIERS[m.best] : '') + (m.polish ? ', ' + T.polish : '') + (i === next ? ', ' + T.next : '');
      s += '<button type="button" class="t-stop t-tier-' + m.best + (i === next ? ' t-next' : '') + '" data-stop="' + i +
        '" style="left:' + pct(pts[i].x) + '%;top:' + pts[i].y + 'px" aria-label="' + esc(label) + '">' +
        '<span class="t-icon" aria-hidden="true">' + esc(iconOf(l, n)) + '</span>' +
        '<span class="t-num" aria-hidden="true">' + n + '</span>' +
        (m.best ? '<span class="t-medal" aria-hidden="true">' + sticker(m) + '</span>' : '') + '</button>';
    });
    if (lessons.length) {
      var b = buddySpot(pts[next >= 0 ? next : lessons.length - 1]);
      s += '<span class="t-buddy" aria-hidden="true" style="left:' + pct(b.x) + '%;top:' + b.y + 'px">' + esc(avatar) + '</span>';
    }
    return s + '</div>';
  }

  // The name card under a tapped stop (above it for the last stop, so it stays on the path).
  function cardHtml(lessons, ms, i, T) {
    var pts = layout(lessons.length), p = pts[i], l = lessons[i];
    if (!p || !isObj(l)) return '';
    var up = i === lessons.length - 1 && lessons.length > 1, x = Math.min(0.78, Math.max(0.22, p.x));
    return '<div class="t-card' + (up ? ' t-card-up' : '') + '" role="dialog" aria-label="' + esc(T.stop(i + 1, titleOf(l))) +
      '" style="left:' + pct(x) + '%;top:' + (up ? p.y - CARD_GAP : p.y + CARD_GAP) + 'px">' +
      '<p class="t-card-title">' + esc((i + 1) + ' · ' + titleOf(l)) + (ms[i] && ms[i].best ? ' ' + sticker(ms[i]) : '') + '</p>' +
      '<button type="button" class="t-open" data-open="' + i + '">' + esc(T.open) + '</button></div>';
  }

  // Same address as the 🏠 button in nav.js.
  function lobbyUrl(grade) { return '../../../lobby/grade-' + (grade === 'grade2' ? '2' : '5') + '.html'; }

  var exported = { layout: layout, height: height, buddySpot: buddySpot, pct: pct, readView: readView, saveView: saveView,
    lessonParam: lessonParam, indexOfId: indexOfId, medals: medals, nextStop: nextStop, pathHtml: pathHtml, cardHtml: cardHtml,
    lobbyUrl: lobbyUrl, TEXT: TEXT, KEY: KEY, ROW: ROW, TOP: TOP };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
})(this);
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/trail.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Stage**

```bash
git add web/engine/trail.js tests/trail.test.js
```

---

### Task 4: The lesson path on the page (`Trail.start`)

**Files:**
- Modify: `web/engine/trail.js`

No unit test: this part is DOM-only and is covered by the e2e in Task 7. This step checks that the file still loads in Node and that Task 3's tests still pass.

- [ ] **Step 1: Add the page code**

In `web/engine/trail.js`, insert this block right before `var exported = {`:

```js
  var UI_CSS =
    '[data-trail-hidden]{display:none !important;}' +
    '.trail-path[hidden]{display:none !important;}' +
    '.trail-top{display:flex;flex-direction:column;max-width:720px;margin:0 auto;}' +
    '.trail-toggle{align-self:flex-end;margin:0 0 12px;min-height:44px;padding:8px 18px;border-radius:999px;font:inherit;font-weight:800;' +
      'cursor:pointer;color:var(--ink,#1d1d1f);background:var(--card,#fff);border:1.5px solid rgba(127,127,127,.45);}' +
    '.trail-path{max-width:560px;margin:8px auto 24px;}' +
    '.t-map{position:relative;}' +
    '.t-line{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}' +
    '.t-line polyline{fill:none;stroke:rgba(127,127,127,.55);stroke-width:4;stroke-dasharray:2 12;stroke-linecap:round;vector-effect:non-scaling-stroke;}' +
    '.t-stop{position:absolute;width:68px;height:68px;margin:-34px 0 0 -34px;padding:0;box-sizing:border-box;border-radius:50%;cursor:pointer;' +
      'font:inherit;color:var(--ink,#1d1d1f);background:var(--card,#fff);border:4px solid rgba(127,127,127,.45);}' +
    '.t-icon{font-size:1.9rem;line-height:1;}' +
    '.t-num{position:absolute;left:-6px;bottom:-6px;min-width:24px;height:24px;padding:0 4px;box-sizing:border-box;border-radius:12px;' +
      'font-size:.8rem;font-weight:800;line-height:24px;color:#fff;background:var(--ink,#1d1d1f);}' +
    '.t-medal{position:absolute;right:-10px;top:-10px;font-size:1.3rem;}' +
    '.t-tier-1{border-color:#C9772B;}.t-tier-2{border-color:#9AA4AE;}.t-tier-3{border-color:#E0A526;background:#FFF6DA;}' +
    '.t-next{width:84px;height:84px;margin:-42px 0 0 -42px;border-color:var(--header-accent,var(--accent,#2E6F9E));animation:t-pulse 1.6s ease-in-out infinite;}' +
    '@keyframes t-pulse{0%,100%{box-shadow:0 0 0 0 rgba(224,165,38,.55);}50%{box-shadow:0 0 0 12px rgba(224,165,38,0);}}' +
    '.t-stop:focus-visible{outline:4px solid var(--ink,#1d1d1f);outline-offset:3px;}' +
    '.t-buddy{position:absolute;font-size:2.2rem;line-height:1;transform:translate(-50%,-50%);pointer-events:none;}' +
    '.t-hop{transition:left .5s ease-in-out,top .5s ease-in-out;}' +
    '.t-card{position:absolute;z-index:2;width:min(280px,90%);padding:12px 14px;box-sizing:border-box;transform:translateX(-50%);' +
      'border-radius:16px;text-align:center;background:var(--card,#fff);color:var(--ink,#1d1d1f);' +
      'border:2px solid rgba(127,127,127,.45);box-shadow:0 6px 18px rgba(0,0,0,.18);}' +
    '.t-card-up{transform:translate(-50%,-100%);}' +
    '.t-card-title{margin:0 0 10px;font-weight:800;}' +
    '.t-open{min-height:44px;padding:8px 18px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;' +
      'color:#fff;background:var(--header-accent,var(--accent,#2E6F9E));}' +
    '@media (prefers-reduced-motion:reduce){.t-next{animation:none;box-shadow:0 0 0 6px rgba(224,165,38,.45);}.t-hop{transition:none;}}' +
    '@media print{.trail-top,.trail-path{display:none !important;}[data-trail-hidden]{display:revert !important;}}';

  function create(win, grade) {
    var doc = win.document, T = TEXT[grade] || TEXT.grade5;
    var storage = win.Learner ? win.Learner.storage : win.localStorage;
    var o = null, list = null, slot = null, toggle = null, path = null, openCard = -1;

    function now() { return Date.now(); }
    function reduced() {
      try { return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }
    function searching() { var S = win.Search; return !!(S && S.query && S.query().trim()); }
    function entry() { try { return win.Mastery.summary().apps[o.app]; } catch (e) { return null; } }
    function avatar() { var G = win.Guide; return G && G.avatarOf ? G.avatarOf(storage) : '🐱'; }
    function lessonCards() { return Array.prototype.filter.call(list.children, function (c) { return c.hasAttribute('data-search-lesson'); }); }

    // Opens a lesson the way a tap on its card does, so every game's own open code runs (cards may be hidden).
    function openAt(i) {
      var card = list.querySelector('[data-search-lesson="' + i + '"]');
      if (!card) return;
      var b = card.matches('button, [role="button"]') ? card : card.querySelector('button, [role="button"]');
      if (b) b.click();
    }

    function act(s) {
      if (s.kind === 'boss') return o.review(true);
      if (s.kind === 'review') return o.review();
      if (s.kind === 'mock') return o.final();
      if (s.kind === 'home') { win.location.href = lobbyUrl(grade); return; }
      var i = indexOfId(o.lessons, s.lesson);
      if (i >= 0) openAt(i);
    }

    function showGuide() {
      var G = win.Guide, s = null;
      if (G && G.step && G.html) {
        try { s = G.step([{ app: o.app, name: o.title }], { app: o.app, finalStars: o.finalStars() }); } catch (e) {}
      }
      if (!s) { slot.innerHTML = ''; return; }
      var go = (s.kind !== 'quest' && s.kind !== 'lesson') || indexOfId(o.lessons, s.lesson) >= 0;
      slot.innerHTML = G.html(s, go);
      var b = slot.querySelector('.g-go');
      if (b) b.addEventListener('click', function () { act(s); });
    }

    // Slides the buddy from the stop it stood at last time to the new one (a lesson just got its Bronze).
    function hop(at) {
      var key = 'trail_last_' + o.app, buddy = path.querySelector('.t-buddy'), n = o.lessons.length, last = null;
      try { last = win.sessionStorage.getItem(key); win.sessionStorage.setItem(key, String(at)); } catch (e) {}
      var from = last === null ? -1 : Number(last);
      if (!buddy || reduced() || !(from >= 0 && from < n) || from === at) return;
      var a = buddySpot(layout(n)[from]), left = buddy.style.left, top = buddy.style.top;
      buddy.style.left = pct(a.x) + '%';
      buddy.style.top = a.y + 'px';
      void buddy.offsetWidth;
      buddy.classList.add('t-hop');
      buddy.style.left = left;
      buddy.style.top = top;
    }

    function closeCard() {
      var c = path.querySelector('.t-card');
      if (c) c.parentNode.removeChild(c);
      openCard = -1;
    }

    function showCard(i) {
      closeCard();
      var map = path.querySelector('.t-map');
      if (!map) return;
      map.insertAdjacentHTML('beforeend', cardHtml(o.lessons, medals(o.lessons, entry()), i, T));
      openCard = i;
      var b = map.querySelector('.t-open');
      if (b) b.focus();
    }

    function draw() {
      var view = readView(storage), on = view === 'path' && !searching();
      lessonCards().forEach(function (c) {
        if (on) c.setAttribute('data-trail-hidden', '');
        else c.removeAttribute('data-trail-hidden');
      });
      toggle.textContent = view === 'path' ? T.list : T.path;
      showGuide();
      openCard = -1;
      path.hidden = !on;
      if (!on) { path.innerHTML = ''; return; }
      var ms = medals(o.lessons, entry()), next = nextStop(ms);
      path.innerHTML = pathHtml(o.lessons, ms, next, avatar(), T);
      if (o.lessons.length) hop(next >= 0 ? next : o.lessons.length - 1);
    }

    function start(opts) {
      if (list || !isObj(opts)) return;
      list = doc.getElementById(opts.list);
      if (!list || !Array.isArray(opts.lessons) || typeof opts.app !== 'string') { list = null; return; }
      function fn(f, fallback) { return typeof f === 'function' ? f : fallback; }
      o = {
        app: opts.app, title: typeof opts.title === 'string' ? opts.title : opts.app, lessons: opts.lessons.filter(isObj),
        review: fn(opts.review, function () {}), final: fn(opts.final, function () {}), finalStars: fn(opts.finalStars, function () { return 0; })
      };

      var style = doc.createElement('style');
      style.id = 'trail-style';
      style.textContent = UI_CSS;
      (doc.head || doc.documentElement).appendChild(style);
      if (win.Guide && win.Guide.addStyle) win.Guide.addStyle(doc);

      // Above the search box (which must stay right above the cards): the guide's bubble and the Path/List toggle.
      var top = doc.createElement('div');
      top.className = 'trail-top';
      slot = doc.createElement('div');
      slot.className = 'trail-guide';
      toggle = doc.createElement('button');
      toggle.type = 'button';
      toggle.className = 'trail-toggle';
      top.appendChild(slot);
      top.appendChild(toggle);
      var search = list.previousElementSibling && list.previousElementSibling.classList.contains('lsearch') ? list.previousElementSibling : null;
      list.parentNode.insertBefore(top, search || list);
      path = doc.createElement('div');
      path.className = 'trail-path';
      path.setAttribute('role', 'group');
      path.setAttribute('aria-label', T.label);
      list.parentNode.insertBefore(path, list.nextSibling);

      toggle.addEventListener('click', function () {
        saveView(storage, now, readView(storage) === 'path' ? 'list' : 'path');
        draw();
      });
      path.addEventListener('click', function (e) {
        var open = e.target.closest('[data-open]');
        if (open) { var i = Number(open.getAttribute('data-open')); closeCard(); return openAt(i); }
        var stop = e.target.closest('[data-stop]');
        if (stop) {
          var j = Number(stop.getAttribute('data-stop'));
          return j === openCard ? closeCard() : showCard(j);
        }
        if (!e.target.closest('.t-card')) closeCard();
      });
      path.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || openCard < 0) return;
        var j = openCard;
        closeCard();
        var s = path.querySelector('[data-stop="' + j + '"]');
        if (s) s.focus();
      });
      // The home screen redraws its cards after every lesson; the path follows (new medals, the buddy hops).
      new win.MutationObserver(draw).observe(list, { childList: true });
      if (search) ['input', 'click', 'keyup'].forEach(function (ev) { search.addEventListener(ev, function () { win.setTimeout(draw, 0); }); });
      doc.addEventListener('cloud-synced', draw);
      win.addEventListener('pageshow', function (e) { if (e.persisted) draw(); });
      draw();

      var want = indexOfId(o.lessons, lessonParam(win.location.search));
      if (want >= 0) win.setTimeout(function () { openAt(want); }, 0);
    }

    return { start: start };
  }
```

Then replace the export block at the bottom (from `var exported = {` to the end) with:

```js
  var exported = { layout: layout, height: height, buddySpot: buddySpot, pct: pct, readView: readView, saveView: saveView,
    lessonParam: lessonParam, indexOfId: indexOfId, medals: medals, nextStop: nextStop, pathHtml: pathHtml, cardHtml: cardHtml,
    lobbyUrl: lobbyUrl, TEXT: TEXT, KEY: KEY, ROW: ROW, TOP: TOP };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Trail = create(root, script ? script.getAttribute('data-grade') : null);
  } catch (e) {}
})(this);
```

- [ ] **Step 2: Run the tests and check they still pass**

Run: `node --test tests/trail.test.js tests/guide.test.js`
Expected: PASS (9 + 14 tests).

- [ ] **Step 3: Stage**

```bash
git add web/engine/trail.js
```

---

### Task 5: The guide on the Campus/Bayan map (`world.js`)

**Files:**
- Modify: `web/engine/world.js` (`drawPlace`, `draw`, `UI_CSS`, `mountUi`, the page binding)
- Test: `tests/world.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/world.test.js`:

```js
test('the guide target gets a ring and a lit road from the buddy', () => {
  const cards = [{ app: 'life-lab', name: 'Life Lab', emoji: '🧪', accent: '', href: 'x' }];
  const list = places('grade5', cards, status(['life-lab'], {}), TEXT.grade5);
  const svg = W.draw('grade5', list, 'cat', null, TEXT.grade5, 'life-lab');
  assert.ok(svg.includes('class="w-place w-game w-tier-0 w-target"'));
  assert.equal((svg.match(/class="w-ring"/g) || []).length, 1);
  const road = svg.match(/<path class="w-guide-road" d="([^"]+)"\/>/);
  const L = LAYOUT.grade5, to = stand(L, list.find((p) => p.id === 'life-lab'));
  assert.equal(road[1], 'M' + route(L, L.gate, to).map((p) => p[0] + ' ' + p[1]).join('L'));
  assert.ok(svg.indexOf('w-guide-road') < svg.indexOf('data-place="life-lab"'), 'the road runs under the buildings');
  const plain = W.draw('grade5', list, 'cat', null, TEXT.grade5);
  assert.ok(!plain.includes('w-target') && !plain.includes('w-guide-road') && !plain.includes('w-ring'));
  assert.ok(!W.draw('grade5', list, 'cat', null, TEXT.grade5, 'nowhere').includes('w-guide-road'));
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `node --test tests/world.test.js`
Expected: FAIL on `w-target`.

- [ ] **Step 3: Draw the target and its road**

In `web/engine/world.js`, change the `drawPlace` signature and its first lines:

```js
  function drawPlace(p, T, target) {
    var top = p.y - p.h / 2, left = p.x - p.w / 2, rh = Math.round(p.h * 0.2), bodyTop = top + rh, bodyH = Math.round(p.h * 0.38);
    var boardTop = bodyTop + bodyH, boardH = p.h - rh - bodyH, font = Math.round(boardH * 0.42), u = Math.round(p.h / 6);
    var sub = subLine(p), beaten = p.arena && p.arena.beaten;
    var s = '<g class="w-place w-' + p.kind + ' w-tier-' + p.level + (beaten ? ' w-beaten' : '') + (p.id === target ? ' w-target' : '') + '" data-place="' + esc(p.id) +
      '" tabindex="0" role="link" aria-label="' + esc(label(p, T)) + '"' + (p.accent ? ' style="--acc:' + esc(p.accent) + '"' : '') + '>';
    if (p.id === target) s += '<rect class="w-ring" x="' + (left - 14) + '" y="' + (top - 14) + '" width="' + (p.w + 28) + '" height="' + (p.h + 28) + '" rx="30"/>';
```

(The rest of `drawPlace` stays as it is, starting from `if (p.level === 3) s += '<rect class="w-glow"`.)

Replace the whole `draw` function with:

```js
  // target: the place the guide points at, drawn with a ring and a lit road from the buddy.
  function draw(grade, list, avatar, at, T, target) {
    var L = LAYOUT[grade], r = radius(L), byId = {};
    list.forEach(function (p) { byId[p.id] = p; });
    var spot = has(byId, at) ? stand(L, byId[at]) : L.gate;
    var s = '<svg class="w-map" viewBox="0 0 ' + L.w + ' ' + L.h + '" role="group" aria-label="' + esc(T.mapLabel) + '">' +
      '<rect class="w-ground" width="' + L.w + '" height="' + L.h + '" rx="40"/>' +
      '<path class="w-road" stroke-width="' + SPINE_HALF * 2 + '" d="M' + L.spine + ' ' + L.gate[1] + 'V' + (L.arena.y + ARENA.h / 2) + '"/>';
    list.forEach(function (p) {
      if (p.kind === 'arena') return;
      var edge = p.x < L.spine ? p.x + p.w / 2 : p.x - p.w / 2;
      s += '<path class="w-road" stroke-width="' + r + '" d="M' + edge + ' ' + stand(L, p)[1] + 'H' + L.spine + '"/>';
    });
    L.trees.forEach(function (t) { s += drawTree(t); });
    s += drawGate(L);
    if (typeof target === 'string' && has(byId, target)) {
      s += '<path class="w-guide-road" d="M' + route(L, spot, stand(L, byId[target])).map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + '"/>';
    }
    list.forEach(function (p) { s += drawPlace(p, T, target); });
    return s + drawAvatar(spot, has(AVATARS, avatar) ? avatar : DEFAULT_AVATAR, r, T) + '</svg>';
  }
```

- [ ] **Step 4: Run the test and check it passes**

Run: `node --test tests/world.test.js`
Expected: PASS (all world tests, including the new one).

- [ ] **Step 5: Add the CSS**

In `UI_CSS`, add these strings right after the `'.w-beaten{opacity:.55;filter:grayscale(1);}' +` line:

```js
    '.w-guide-road{fill:none;stroke:var(--header-accent);stroke-width:14;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:2 26;opacity:.85;}' +
    '.w-ring{fill:none;stroke:var(--header-accent);stroke-width:8;animation:w-pulse 1.6s ease-in-out infinite;}' +
    '@keyframes w-pulse{0%,100%{opacity:.25;}50%{opacity:.9;}}' +
    '@media (prefers-reduced-motion:reduce){.w-ring{animation:none;opacity:.7;}}' +
    '#campus-guide:empty{display:none;}' +
```

- [ ] **Step 6: Show the bubble and wire Go ▶ in `mountUi`**

1. Right after `(doc.head || doc.documentElement).appendChild(style);` in `mountUi`, add:

```js
    if (win.Guide && win.Guide.addStyle) win.Guide.addStyle(doc);
```

2. In `api.mount`, replace from `var list, state, at, wasOpen = false;` through the end of the `catch` block with:

```js
      var list, state, at, cards, step = null, target = null, wasOpen = false;
      try {
        var old = box.querySelector('.w-picker');
        wasOpen = !!(old && !old.hidden);
        cards = cardsOf(grid);
        state = readState(storage);
        list = places(grade, cards, status(cards.map(function (c) { return c.app; }), deps), T);
        at = resolveAt(state.at, list);
        step = safe(function () { return deps.guide(cards); }, null);
        target = step ? (step.shop === true ? 'shop' : step.app) : null;
        box.innerHTML = draw(grade, list, state.avatar || DEFAULT_AVATAR, at, T, target) + pickerHtml(T, state.avatar);
      } catch (e) {
        box.innerHTML = '';
        box.hidden = true;
        grid.hidden = false;
        if (toggle) toggle.hidden = true;
        var gone = doc.getElementById('campus-guide');
        if (gone) gone.innerHTML = '';
        return false;
      }
```

3. Change `act` and `go` to carry the guide's link:

```js
      function act(p, href) {
        if (p.kind === 'game') return api.navigate(href || p.href);
```

(the rest of `act` is unchanged) and

```js
      function go(id, href) {
        if (walking) return walking.finish();
        var p = find(id);
        if (!p) return;
        var path = route(L, spot(at), stand(L, p));
        at = id;
        saveState(storage, deps.now, { at: id });
        if (reduced() || !(api.walkMs > 0)) {
          put(buddy, path[path.length - 1]);
          return act(p, href);
        }
        walking = walk(buddy, path, api.walkMs, function () { walking = null; act(p, href); });
      }
```

4. Add this function right after `activate`:

```js
      // The bubble sits above the map and stays in List view. Go walks the buddy there on the map, or just goes in List view.
      function showGuide() {
        var G = win.Guide, slot = doc.getElementById('campus-guide');
        if (!step || !G || !G.html) { if (slot) slot.innerHTML = ''; return; }
        if (!slot) {
          slot = doc.createElement('div');
          slot.id = 'campus-guide';
          box.parentNode.insertBefore(slot, box);
        }
        var href = G.link(step, cards), shop = step.shop === true;
        slot.innerHTML = G.html(step, !!href || shop);
        var b = slot.querySelector('.g-go');
        if (!b) return;
        b.addEventListener('click', function () {
          if (!box.hidden && target && find(target)) return go(target, href);
          if (shop) { var open = doc.getElementById('shop-open'); if (open) open.click(); return; }
          if (href) api.navigate(href);
        });
      }
```

5. Call it right before `var campus = state.view !== 'list';`:

```js
      showGuide();
```

- [ ] **Step 7: Give the page binding a guide**

In the binding at the bottom of `world.js`, add a `guide` entry to the deps object passed to `mountUi` (after `canAfford`):

```js
        canAfford: function () { var W = root.Wallet; return !!(W && W.canAfford && W.canAfford()); },
        guide: function (cards) {
          var G = root.Guide, W = root.Wallet;
          return G && G.step ? G.step(cards, { canAfford: !!(W && W.canAfford && W.canAfford()) }) : null;
        }
```

- [ ] **Step 8: Run all unit tests**

Run: `node --test`
Expected: PASS. (Lobbies don't load `guide.js` yet, so `deps.guide` returns null there and nothing changes on screen.)

- [ ] **Step 9: Stage**

```bash
git add web/engine/world.js tests/world.test.js
```

---

### Task 6: Wire both lobbies and all 17 games

**Files:**
- Create: `tests/guide-wiring.test.js`, `tests/trail-wiring.test.js`
- Modify: `tests/paths.js`, `web/sw.js`, `tests/world-wiring.test.js`, `tests/family-wiring.test.js`, `web/lobby/grade-5.html`, `web/lobby/grade-2.html`, all 17 `web/subjects/*/*/index.html`

- [ ] **Step 1: Write the failing wiring tests**

Create `tests/guide-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOBBIES, APPS, ENGINE_FILES, lobbyFile, appFile, web } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const GLOBALS_END = "world: 'World', family: 'Family', guide: 'Guide', trail: 'Trail' };";

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby loads the guide before the map', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/guide.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    for (const before of ['boss.js', 'quests.js', 'mastery.js', 'recall.js', 'study-history.js']) {
      assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/' + before + '"'), 'after ' + before);
    }
    assert.ok(html.indexOf(tag) < html.indexOf('<script src="../engine/world.js"'), 'before world.js');
    assert.equal(count(html, GLOBALS_END), 1, 'the missing-file bar knows guide.js and trail.js');
  });
}

test('every game loads the guide', () => {
  for (const a of APPS) {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    const tag = '<script src="../../../engine/guide.js" data-grade="grade' + a.grade + '"></script>';
    assert.equal(count(html, tag), 1, a.id);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/family.js"'), a.id + ': after family.js');
    assert.equal(count(html, GLOBALS_END), 1, a.id);
  }
});

test('guide.js and trail.js are cached for offline use and copied to the e2e site', () => {
  const sw = fs.readFileSync(web('sw.js'), 'utf8');
  for (const f of ['guide.js', 'trail.js']) {
    assert.ok(sw.includes("'engine/" + f + "',"), f + ' in PRECACHE');
    assert.ok(ENGINE_FILES.includes(f), f + ' in ENGINE_FILES');
  }
});
```

Create `tests/trail-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, appFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const START = /window\.Trail && window\.Recall && Trail\.start\(\{ app: SH_APP, title: SH_TITLE, list: '([^']+)', lessons: medalLessons\(\), review: startReview, final: startFinalExam, finalStars: function \(\) \{ return starsFor\(\(progress\['final'\] \|\| 0\) \/ \((LESSONS|lessons)\.length \* FINAL_EXAM_PER_LESSON\)\); \} \}\);/g;

for (const a of APPS) {
  test(a.id + ' draws the lesson path', () => {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    const tag = '<script src="../../../engine/trail.js" data-grade="grade' + a.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads trail.js once');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/guide.js"'), 'after guide.js');
    const starts = [...html.matchAll(START)];
    assert.equal(starts.length, 1, 'one Trail.start');
    const search = html.match(/Search\.start\(\{ list: '([^']+)', lessons: (LESSONS|lessons) \}\);/);
    assert.equal(starts[0][1], search[1], 'the same card list as the search');
    assert.equal(starts[0][2], search[2], 'the same lesson list as the search');
    assert.ok(starts[0].index > search.index, 'right after Search.start, so the search box is already there');
  });
}
```

- [ ] **Step 2: Run them and check they fail**

Run: `node --test tests/guide-wiring.test.js tests/trail-wiring.test.js`
Expected: FAIL (no guide.js tag in the lobbies).

- [ ] **Step 3: Add both files to ENGINE_FILES and PRECACHE**

In `tests/paths.js`, change the ENGINE_FILES list so `'family.js'` is followed by the two new files:

```js
const ENGINE_FILES = ['storage.js', 'learner.js', 'clock.js', 'nav.js', 'search.js', 'read-gate.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'quests.js', 'boss.js', 'world.js', 'family.js', 'guide.js', 'trail.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'parent-panel.js'];
```

In `web/sw.js`, find the line `  'engine/world.js',` in `PRECACHE` and add two lines right after it, with the same indent:

```js
  'engine/guide.js',
  'engine/trail.js',
```

- [ ] **Step 4: Write and run the one-off wiring script**

Save as `C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN-IdeaProjects-school\c407e2e9-4915-4978-b4cb-5a04ad1a5554\scratchpad\wire-guide.js` (the session scratchpad; outside the repo):

```js
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('C:/Users/ADMIN/IdeaProjects/school/tests/paths.js');

const OLD_END = "world: 'World', family: 'Family' };";
const NEW_END = "world: 'World', family: 'Family', guide: 'Guide', trail: 'Trail' };";
const SEARCH = /^([ \t]*)window\.Search && Search\.start\(\{ list: '([^']+)', lessons: (LESSONS|lessons) \}\);\r?$/m;

function once(html, find, file) {
  const n = html.split(find).length - 1;
  if (n !== 1) throw new Error(file + ': expected 1 of ' + find + ', found ' + n);
}

for (const grade of Object.keys(LOBBIES)) {
  const file = lobbyFile(grade);
  let html = fs.readFileSync(file, 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const world = '<script src="../engine/world.js" data-grade="grade' + grade + '"></script>';
  once(html, world, file);
  once(html, OLD_END, file);
  html = html.replace(world, '<script src="../engine/guide.js" data-grade="grade' + grade + '"></script>' + eol + world).replace(OLD_END, NEW_END);
  fs.writeFileSync(file, html);
  console.log('wired ' + file);
}

for (const a of APPS) {
  const file = appFile(a.id);
  let html = fs.readFileSync(file, 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const g = 'grade' + a.grade;
  const family = '<script src="../../../engine/family.js" data-grade="' + g + '"></script>';
  once(html, family, file);
  once(html, OLD_END, file);
  const m = html.match(SEARCH);
  if (!m) throw new Error(file + ': no Search.start line');
  html = html.replace(family, family + eol +
    '<script src="../../../engine/guide.js" data-grade="' + g + '"></script>' + eol +
    '<script src="../../../engine/trail.js" data-grade="' + g + '"></script>');
  html = html.replace(OLD_END, NEW_END);
  const line = m[1] + "window.Trail && window.Recall && Trail.start({ app: SH_APP, title: SH_TITLE, list: '" + m[2] +
    "', lessons: medalLessons(), review: startReview, final: startFinalExam, finalStars: function () { return starsFor((progress['final'] || 0) / (" +
    m[3] + ".length * FINAL_EXAM_PER_LESSON)); } });";
  const cr = m[0].endsWith('\r') ? '\r' : '';
  html = html.replace(m[0], m[0].replace(/\r$/, '') + eol + line + cr);
  fs.writeFileSync(file, html);
  console.log('wired ' + a.id);
}
```

Run: `node "C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN-IdeaProjects-school\c407e2e9-4915-4978-b4cb-5a04ad1a5554\scratchpad\wire-guide.js"`
Expected: `wired …` for 2 lobbies and 17 games, no error.

- [ ] **Step 5: Update the two older wiring tests to the new GLOBALS ending**

In `tests/family-wiring.test.js`, line 7 becomes:

```js
const GLOBALS_END = "'parent-panel': 'ParentPanel', world: 'World', family: 'Family', guide: 'Guide', trail: 'Trail' };";
```

In `tests/world-wiring.test.js`, change the GLOBALS assertion to:

```js
    assert.ok(html.includes("'parent-panel': 'ParentPanel', world: 'World', family: 'Family', guide: 'Guide', trail: 'Trail' };"), 'the missing-file bar knows world.js');
```

- [ ] **Step 6: Run all unit tests**

Run: `node --test`
Expected: PASS, including `pages.test.js` (one identical file check on every page) and both new wiring tests.

- [ ] **Step 7: Stage**

```bash
git add tests/guide-wiring.test.js tests/trail-wiring.test.js tests/paths.js tests/family-wiring.test.js tests/world-wiring.test.js web/sw.js web/lobby/grade-5.html web/lobby/grade-2.html web/subjects
```

---

### Task 7: End-to-end check in Chrome

**Files:**
- Create: `tests/e2e/guide-e2e.js`, `tests/e2e/driver-guide-lobby.page.js`, `tests/e2e/driver-guide-game.page.js`, `tests/e2e/driver-guide-param.page.js`
- Modify: `README.md`

- [ ] **Step 1: Write the lobby driver**

Create `tests/e2e/driver-guide-lobby.page.js`:

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
  var went = [];
  World.navigate = function (href) { went.push(href); };
  World.walkMs = 0;
  function draw() { World.mount(campus, grid, toggle); }
  function slot() { return document.getElementById('campus-guide'); }
  function text() { var p = slot() && slot().querySelector('.g-text'); return p ? p.textContent : ''; }
  function go() { slot().querySelector('.g-go').click(); return went.pop(); }
  var apps = [].map.call(grid.querySelectorAll('.subject-card[data-app]'), function (c) { return c.getAttribute('data-app'); });

  __store.setItem('world_v1', JSON.stringify({ v: 1, avatar: 'owl', view: 'campus', at: null, t: 1 }));
  var q = Quests.state();
  q.list.forEach(function (x) { x.done = true; });
  __store.setItem(Quests.KEY, JSON.stringify(q));

  __store.setItem(Boss.KEY, JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [],
    stages: [{ app: 'life-lab', title: 'Life Lab', cleared: false }, { app: 'math-mastery', title: 'Math Mastery', cleared: false }] }));
  draw();
  r.slotBeforeMap = !!slot() && slot().nextElementSibling === campus;
  r.buddy = slot().querySelector('.g-buddy').textContent;
  r.bossText = text();
  r.target = campus.querySelector('[data-place="life-lab"]').getAttribute('class');
  r.road = campus.querySelectorAll('.w-guide-road').length;
  r.bossHref = go();

  __store.setItem(Boss.KEY, JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [], stages: [] }));
  draw();
  r.visitText = text();
  r.visitApp = apps[0];

  __store.setItem('mastery_v1', JSON.stringify({ v: 1, apps: { 'life-lab': { order: ['a', 'b'], lessons: {
    a: { title: 'What Is Matter', icon: '', now: 1, best: 1, paid: 1 }, b: { title: 'Matter', icon: '', now: 0, best: 0, paid: 0 } } } } }));
  draw();
  r.lessonText = text();
  r.lessonHref = go();

  toggle.click();
  r.listHidesMap = campus.hidden && !grid.hidden;
  r.listText = text();
  r.listHref = go();
  toggle.click();

  var all = { v: 1, apps: {} };
  apps.forEach(function (a) { all.apps[a] = { order: ['x'], lessons: { x: { title: 'X', icon: '', now: 1, best: 1, paid: 1 } } }; });
  __store.setItem('mastery_v1', JSON.stringify(all));
  draw();
  r.doneText = text();
  r.doneGo = !!slot().querySelector('.g-go');
  r.doneTarget = campus.querySelectorAll('.w-target').length;
  out();
})();
```

- [ ] **Step 2: Write the game drivers**

Create `tests/e2e/driver-guide-game.page.js` (injected after the game's last `renderHome();`, so `medalLessons`, `renderHome`, `goHome` and `SH_APP` are in scope):

```js
setTimeout(function () {
  var r = { errors: window.__e2eErrors || [] };
  function out() {
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(r);
    document.body.appendChild(pre);
  }
  var C = __GUIDE, store = Learner.storage;
  var list = document.getElementById(C.list), path = document.querySelector('.trail-path'), top = document.querySelector('.trail-top');
  var lessons = medalLessons(), T = Guide.TEXT[C.grade];
  r.thirdId = lessons[2].id;
  function shown() {
    return [].filter.call(list.children, function (c) { return c.hasAttribute('data-search-lesson') && getComputedStyle(c).display !== 'none'; }).length;
  }
  function next() { return [].map.call(path.querySelectorAll('.t-next'), function (s) { return s.getAttribute('data-stop'); }); }
  function guideText() { return document.querySelector('.trail-guide .g-text').textContent; }
  function later(f) { setTimeout(f, 40); }

  r.order = !!top && top.nextElementSibling.classList.contains('lsearch') && list.nextElementSibling === path;
  r.startScreen = Nav.current() === C.home;
  r.stops = path.querySelectorAll('.t-stop').length === lessons.length;
  r.cardsHidden = shown() === 0;
  r.next = next();
  r.text = guideText() === T.lessonHere(lessons[0].title);
  r.buddy = !!path.querySelector('.t-buddy');

  var ms = JSON.parse(store.getItem('mastery_v1')), e = ms.apps[SH_APP];
  e.lessons[e.order[0]].best = 1;
  e.lessons[e.order[0]].now = 1;
  store.setItem('mastery_v1', JSON.stringify(ms));
  renderHome();
  later(function () {
    r.nextAfter = next();
    r.hop = path.querySelector('.t-buddy').classList.contains('t-hop');
    r.textAfter = guideText() === T.lessonHere(lessons[1].title);

    var toggle = document.querySelector('.trail-toggle');
    toggle.click();
    r.listView = path.hidden && shown() === lessons.length && toggle.textContent === '🗺️ Path';
    toggle.click();
    r.pathAgain = !path.hidden && shown() === 0 && toggle.textContent === '📋 List';

    var input = document.getElementById('lesson-search');
    input.value = C.query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    later(function () {
      r.searchShowsCards = path.hidden && shown() > 0;
      document.querySelector('.lsearch-clear').click();
      later(function () {
        r.clearShowsPath = !path.hidden && shown() === 0;

        document.querySelector('.trail-guide .g-go').click();
        r.goOpens = Nav.current() !== C.home;
        goHome();
        later(function () {
          path.querySelector('[data-stop="2"]').click();
          var card = path.querySelector('.t-card');
          r.card = card ? card.querySelector('.t-card-title').textContent.indexOf('3 · ' + lessons[2].title) === 0 : false;
          card.querySelector('.t-open').click();
          r.openOpens = Nav.current() !== C.home;
          out();
        });
      });
    });
  });
}, 40);
```

Create `tests/e2e/driver-guide-param.page.js`:

```js
setTimeout(function () {
  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify({ errors: window.__e2eErrors || [], opened: Nav.current() !== __GUIDE.home });
  document.body.appendChild(pre);
}, 80);
```

- [ ] **Step 3: Write the runner**

Create `tests/e2e/guide-e2e.js`:

```js
// The guide's bubble on the Grade 5 map, and the lesson path in one game per home-screen family.
// Run: node tests/e2e/guide-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver, appendDriver } = require('./chrome.js');
const { LOBBIES, ENGINE_FILES, app, appFile, lobbyFile } = require('../paths.js');

const CASES = [
  { id: 'life-lab', grade: 'grade5', list: 'homeList', home: 'home', query: 'atoms' },
  { id: 'math-mastery', grade: 'grade5', list: 'lesson-grid', home: 'screen-home', query: 'divisible' },
  { id: 'word-train', grade: 'grade2', list: 'home-list', home: 'home', query: 'capital' },
];

const work = makeWorkDir('guide-e2e');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

try {
  const lobbyDriver = 'var __store = Learner.storage;\n' + read('driver-guide-lobby.page.js');
  const lobby = stage(path.join(work, 'lobby'), LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), lobbyDriver), ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile-lobby'), lobby, ''));
  assert.deepEqual(r.errors, [], 'lobby: page errors');
  assert.equal(r.slotBeforeMap, true, 'the bubble sits right above the map');
  assert.equal(r.buddy, '🦉', 'her buddy speaks');
  assert.equal(r.bossText, '⚔️ The boss is waiting in Life Lab!');
  assert.match(r.target, /w-target/);
  assert.equal(r.road, 1);
  assert.match(r.bossHref, /subjects\/grade-5\/science\/index\.html\?boss=1$/);
  assert.match(r.visitText, /^🧭 Visit .+ for the first time$/);
  assert.equal(r.lessonText, '📘 Next stop: Matter in Life Lab');
  assert.match(r.lessonHref, /science\/index\.html\?lesson=b$/);
  assert.equal(r.listHidesMap, true);
  assert.equal(r.listText, '📘 Next stop: Matter in Life Lab', 'the bubble stays in List view');
  assert.match(r.listHref, /science\/index\.html\?lesson=b$/);
  assert.equal(r.doneText, '🎉 All done today! Great work!');
  assert.equal(r.doneGo, false, 'nothing to buy: no Go');
  assert.equal(r.doneTarget, 0);
  console.log('ok lobby guide');

  for (const c of CASES) {
    const html = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'var __GUIDE = ' + JSON.stringify(c) + ';\n' + read('driver-guide-game.page.js'));
    const file = stage(path.join(work, c.id), app(c.id).page, html, ENGINE_FILES);
    const g = readOutput(dumpDom(path.join(work, 'profile-' + c.id), file, ''));
    assert.deepEqual(g.errors, [], c.id + ': page errors');
    assert.equal(g.order, true, c.id + ': bubble and toggle, then search, then cards, then the path');
    assert.equal(g.startScreen, true, c.id + ': opens on the home screen');
    assert.equal(g.stops, true, c.id + ': a stop per lesson');
    assert.equal(g.cardsHidden, true, c.id + ': Path view hides the lesson cards');
    assert.deepEqual(g.next, ['0'], c.id + ': the first lesson glows');
    assert.equal(g.text, true, c.id + ': the bubble names the first lesson');
    assert.equal(g.buddy, true);
    assert.deepEqual(g.nextAfter, ['1'], c.id + ': after a Bronze the next stop moves');
    assert.equal(g.hop, true, c.id + ': the buddy hops');
    assert.equal(g.textAfter, true);
    assert.equal(g.listView, true, c.id + ': List shows the cards');
    assert.equal(g.pathAgain, true, c.id + ': Path comes back');
    assert.equal(g.searchShowsCards, true, c.id + ': a search shows cards');
    assert.equal(g.clearShowsPath, true, c.id + ': clearing the search brings the path back');
    assert.equal(g.goOpens, true, c.id + ': Go opens the next lesson');
    assert.equal(g.card, true, c.id + ': a tapped stop shows its name');
    assert.equal(g.openOpens, true, c.id + ': Open opens that lesson');

    // The third lesson's id comes from the page (medalLessons), read back from the first run.
    const param = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'var __GUIDE = ' + JSON.stringify(c) + ';\n' + read('driver-guide-param.page.js'));
    const pfile = stage(path.join(work, c.id + '-param'), app(c.id).page, param, ENGINE_FILES);
    const p = readOutput(dumpDom(path.join(work, 'profile-' + c.id + '-param'), pfile, '?lesson=' + encodeURIComponent(g.thirdId)));
    assert.deepEqual(p.errors, [], c.id + ': ?lesson= page errors');
    assert.equal(p.opened, true, c.id + ': ?lesson= opens that lesson');
    console.log('ok ' + c.id);
  }
} catch (err) {
  console.log('FAIL guide: ' + err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
```

- [ ] **Step 4: Run the e2e**

Run: `node tests/e2e/guide-e2e.js`
Expected: `ok lobby guide`, `ok life-lab`, `ok math-mastery`, `ok word-train`, exit code 0.

If a game case fails on `hop`, check that headless Chrome isn't reporting reduced motion (`matchMedia('(prefers-reduced-motion: reduce)')`); if it is, make the driver assert `r.hop` only when `!matchMedia('(prefers-reduced-motion: reduce)').matches`.

- [ ] **Step 5: Run the existing e2e suites that touch the same pages**

Run each and expect it to pass as before:

```bash
node tests/e2e/lobby-e2e.js
node tests/e2e/lobby-e2e.js 5
node tests/e2e/search-e2e.js
node tests/e2e/nav-e2e.js
node tests/e2e/sisters-e2e.js
node tests/e2e/read-gate-e2e.js
node tests/e2e/apps-e2e.js
node tests/e2e/apps-e2e.js 5
node tests/e2e/file-check-e2e.js
```

If `apps-e2e` or `nav-e2e` expects a lesson card to be visible on the home screen, the fix is in the driver, not the game: have it set Path view off first with `Learner.storage.setItem('trail_v1', JSON.stringify({ v: 1, view: 'list', t: 1 }))` before it clicks cards, and note that in the driver with a one-line comment.

- [ ] **Step 6: Add the command to the README**

In `README.md`, add this line right after the `node tests/e2e/sisters-e2e.js` line in the test command list:

```
node tests/e2e/guide-e2e.js          # guide bubble on the map; lesson path, toggle, search and ?lesson= in games
```

- [ ] **Step 7: Stage**

```bash
git add tests/e2e/guide-e2e.js tests/e2e/driver-guide-lobby.page.js tests/e2e/driver-guide-game.page.js tests/e2e/driver-guide-param.page.js README.md
```

---

### Task 8: Final check and hand-off

- [ ] **Step 1: Run everything**

```bash
node --test
node tests/e2e/guide-e2e.js
```

Expected: all unit tests pass; the guide e2e prints four `ok` lines.

- [ ] **Step 2: Look at it once in a real browser**

Open `web/lobby/grade-5.html` and `web/subjects/grade-2/english/index.html` in Chrome at 360 px and at tablet width. Check: the bubble text wraps without overflow; the zigzag stops don't overlap; the name card for the last stop opens upward; Grade 2 text shows Filipino · English.

- [ ] **Step 3: Update memory**

Update `C:\Users\ADMIN\.claude\projects\C--Users-ADMIN-IdeaProjects-school\memory\map-guide-lesson-path.md`: status BUILT on the build date, the `Trail.start` hook contract (one line after `Search.start`, `medalLessons()`, `startReview`, `startFinalExam`, `finalStars`), that a NEW game needs that line plus the two script tags (the trail-wiring test fails otherwise), and that `trail_v1` is synced but not backed up.

- [ ] **Step 4: Hand the commit to the user**

Don't commit. Give the user:

```bash
git add web/engine/guide.js web/engine/trail.js web/engine/world.js web/sw.js web/lobby web/subjects tests README.md
```

```bash
git commit -m "Add the guide and the lesson path: her buddy now suggests one next step on the Campus and Bayan map (the boss stage, then due review, then a quest for a game, then the next lesson without Bronze in the game she played last, then a game she has not opened) with a Go button that walks there; every game's home shows its lessons as a zigzag path of stops with medals, her buddy at the next stop and hopping ahead after each Bronze, a name card with Open for any stop, and a Path or List switch; nothing is locked"
```
