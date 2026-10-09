# Walkable 3D World — Phase 3 Implementation Plan (talking characters)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the 3D world with characters who talk: a subject buddy by every door whose line follows her real progress, Professor Hoot on a park bench, Bunny by the shop counter, and eight talking trees with a quote of the day. Buddies and Hoot can ask her the review questions that are due (❓ Ask me!), scored exactly like a review round in the game.

**Architecture:** Pure, Node-tested modules hold the data and the decisions: `buddies.js` (who stands by each door), `lines.js` (every written line and the 60 quotes), `chat.js` (which line to say), `quiz.js` (how each game builds its review key and how a question is shown), and the generated `lesson-files.js` (each game's lesson scripts). `ask.js` loads a game's lesson scripts on demand and answers through the game's own engines (`StudyKit.start` + `Recall`), so points, gap bonus, box moves and coins follow the game's rules. `cast.js` gains the 3D characters, and the new controller `folk.js` (beside Phase 2's `town.js`) wires them to the speech bubble.

**Tech Stack:** Plain HTML/CSS/JS (no build step), Three.js r149 (vendored, global `THREE`), `node --test`, headless Chrome e2e (`tests/e2e/chrome.js`).

**Spec:** `docs/superpowers/specs/2026-10-05-walkable-3d-world-design.md`, "Phase 3".

**Code this builds on (committed):** Phase 1 (f090550) and Phase 2 (4c36a68): `web/world/*.js`, `world.css`, both world pages, `tests/world3d-*.test.js`, `tests/e2e/world-e2e.js` + `world-driver.page.js`.

**Decisions made while planning (within the spec):**
- Reading-passage questions (Page Turners, Kuwentista) are not asked in the world, like picture questions: the bubble is too small for a passage.
- 💬 More walks down the buddy's lines in the spec's priority order, so every line is reachable; the first line is the most important one.
- Buddies and Hoot ask up to 3 due questions per conversation.
- An Ask me! conversation is saved in study history as one review quiz (`kind: 'review'`) that is never finished, so the parent's Focus tab sees the answers and the wrong ones, but quests (which count finished rounds only) never tick from the world.
- Medals are not recomputed in the world; the game pays any new medal the next time she opens it (accepted gap, as for a sync).
- Bunny stands beside the counter (the shop's wall leaves no room behind it). The counter's button becomes "💬 Talk to Bunny"; her bubble has 🛍️ Open the shop.

**House rules (read before starting):**
- Never run `git commit`. Each task ends by staging with `git add`; the user commits.
- Comments sparingly. Browser files: ES5 `var`/`function`, IIFE `(function (root) { ... })(this)`. Tests: `const`, arrow functions, `node:test`.
- Grade 2: labels and lines pair Filipino with English (`Filipino · English`); buttons are English only. Filipino follows the wording rules: "natutuhan", "puwede", "nakatutulong", never "tunog tama", never "bagay" for "fits", Tama/Mali feedback starts with "Magaling!".
- After adding a file under `web/`, run `node tools/update-precache.js`.
- Run unit tests from the repo root with `node --test`.
- Edits to existing files are given as "find this exact text → replace with". If the text is not found exactly, stop and report it.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `web/world/text.js` | Modify | Button words (More, Ask me!, Bye, Next, Talk to…, Listen, Review in the game) and labels (Hoot, Talking Tree, the history title) |
| `web/world/buddies.js` | Create | Each door's buddy: name, face emoji, hello line, look |
| `web/world/lines.js` | Create | Buddy state lines, Ask me! lines, Hoot, Bunny, 60 quotes |
| `web/world/chat.js` | Create | Pure picker: buddy lines in priority order, quote of the day, Bunny's saving line, pair joining |
| `web/world/quiz.js` | Create | Per-game review key (`info`), what can be asked (`askable`), what the bubble shows (`view`) |
| `tools/lesson-files.js` | Create | Builds `web/world/lesson-files.js` |
| `tools/update-precache.js` | Modify | Also writes `web/world/lesson-files.js` |
| `web/world/lesson-files.js` | Create (generated) | Each game's lesson script paths, title, points and progress keys |
| `web/world/ask.js` | Create | Loads lesson scripts on demand; picks due questions; answers through StudyKit + Recall + StudyHistory |
| `web/world/layout.js` | Modify | Buddy spots, Hoot's bench, Bunny's spot, the 8 talking trees, new interactables and obstacles |
| `web/world/progress.js` | Modify | Snapshot `info` per subject; shared `points()` |
| `web/world/talk.js` | Modify | A helper line (`sub`) and stacked answer buttons (`stack`) |
| `web/world/world.css` | Modify | Styles for both |
| `web/world/build.js` | Modify | `cheer(x, y, z)` confetti burst |
| `web/world/cast.js` | Modify | 17 buddies (12 kinds), Professor Hoot with his bench, Bunny, tree faces that blink |
| `web/world/folk.js` | Create | Phase 3 controller: characters, conversations, Ask me! flow |
| `web/world/town.js` | Modify | Hands the counter to Bunny; no greeting while another bubble is open |
| `web/world/world-main.js` | Modify | Creates `folk`, shares refresh, debug hooks |
| `web/world/grade-5.html`, `grade-2.html` | Modify | Load `study-kit.js` and the new files |
| `tests/paths.js` | Modify | `WORLD_FILES`, `WORLD_ENGINES` |
| `tests/world3d-*.test.js` | Modify / create | Unit + wiring tests |
| `tests/e2e/world-e2e.js`, `world-driver.page.js` | Modify | Talking and Ask me! cases |

---

### Task 1: Words for the characters (`text.js`)

**Files:**
- Modify: `web/world/text.js`
- Test: `tests/world3d-text.test.js`

- [ ] **Step 1: Write the failing test**

In `tests/world3d-text.test.js`, find:

```js
  'mimiTalk', 'goTrail', 'later', 'counter', 'fortGo', 'fortClosed']);
```

Replace with:

```js
  'mimiTalk', 'goTrail', 'later', 'counter', 'fortGo', 'fortClosed',
  'more', 'ask', 'bye', 'next', 'talkTo', 'listen', 'reviewGame', 'bunny']);
```

Append at the end of the file:

```js
test('the characters have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['more', 'ask', 'bye', 'next', 'talkTo', 'listen', 'reviewGame', 'bunny', 'hoot', 'tree', 'askTitle']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.ok(TEXT[g].talkTo.includes('{name}'));
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-text.test.js`
Expected: FAIL on "the characters have their words".

- [ ] **Step 3: Add the words**

In `web/world/text.js`, find:

```js
    toLobby: '🗺️ Back to the lobby', settings: '⚙️', on: 'On', off: 'Off',
```

Replace with:

```js
    toLobby: '🗺️ Back to the lobby', settings: '⚙️', on: 'On', off: 'Off',
    more: '💬 More', ask: '❓ Ask me!', bye: '👋 Bye', next: '❓ Next question', talkTo: '💬 Talk to {name}',
    listen: '🌳 Listen to the tree', reviewGame: '🔁 Review in the game', bunny: 'Bunny',
```

Find (Grade 5 labels):

```js
      fortBeaten: '🏆 Boss beaten! A new boss comes on Monday',
      places: {
        gate: 'Gate', plaza: 'Plaza',
```

Replace with:

```js
      fortBeaten: '🏆 Boss beaten! A new boss comes on Monday',
      hoot: 'Professor Hoot', tree: 'Talking Tree', askTitle: 'Ask me! in the Campus',
      places: {
        gate: 'Gate', plaza: 'Plaza',
```

Find (Grade 2 labels):

```js
      fortBeaten: '🏆 Natalo mo na ang Boss! Bagong boss sa Lunes · Boss beaten! A new boss comes on Monday',
```

Replace with:

```js
      fortBeaten: '🏆 Natalo mo na ang Boss! Bagong boss sa Lunes · Boss beaten! A new boss comes on Monday',
      hoot: 'Propesor Hoot · Professor Hoot', tree: 'Punong Nagsasalita · Talking Tree',
      askTitle: 'Tanong sa Bayan · Ask me! in the Village',
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-text.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/text.js tests/world3d-text.test.js
```

---

### Task 2: Who says what (`buddies.js`, `lines.js`)

**Files:**
- Create: `web/world/buddies.js`, `web/world/lines.js`
- Test: `tests/world3d-lines.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-lines.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const B = require(worldFile('buddies.js'));
const { TEXT, QUOTES } = require(worldFile('lines.js'));

// Every string or function result inside an object, called with sample arguments.
function said(o, path = '') {
  return Object.keys(o).flatMap((k) => {
    const v = o[k];
    if (typeof v === 'function') return [[path + k, v(2, '🎮 ML game')], [path + k + '(1)', v(1, 'Math')]];
    if (Array.isArray(v)) return v.map((s, i) => [path + k + '.' + i, s]);
    if (v && typeof v === 'object') return said(v, path + k + '.');
    return [[path + k, v]];
  });
}

for (const grade of ['grade5', 'grade2']) {
  test(grade + ': every door has a buddy, built from known parts', () => {
    const apps = L.buildings(grade).map((b) => b.app);
    assert.deepEqual(Object.keys(B.BUDDIES[grade]).sort(), apps.slice().sort(), 'a new game needs a buddy in web/world/buddies.js');
    const names = new Set();
    for (const app of apps) {
      const b = B.BUDDIES[grade][app];
      assert.ok(b.name && b.face && b.hi, app);
      assert.ok(!names.has(b.name), app + ' has a name of its own');
      names.add(b.name);
      assert.ok(B.KINDS.includes(b.look.kind), app + ' kind');
      assert.match(b.look.fur, /^#[0-9a-f]{6}$/i, app + ' fur');
      if (b.look.prop) assert.ok(B.PROPS.includes(b.look.prop), app + ' prop');
      if (b.look.hat) assert.ok(B.HATS.includes(b.look.hat), app + ' hat');
      if (grade === 'grade2') assert.match(b.hi, / · /, app + ' hello is Filipino · English');
    }
  });
}

test('both grades have the same lines', () => {
  assert.deepEqual(said(TEXT.grade2).map((x) => x[0]), said(TEXT.grade5).map((x) => x[0]));
});

test('Grade 2 lines pair Filipino with English; Grade 5 lines are English', () => {
  for (const [k, v] of said(TEXT.grade2)) assert.match(v, / · /, k);
  for (const [k, v] of said(TEXT.grade5)) assert.doesNotMatch(v, / · /, k);
});

test('counts read right in English', () => {
  assert.match(TEXT.grade5.due(1), /1 question is /);
  assert.match(TEXT.grade5.due(3), /3 questions are /);
  assert.match(TEXT.grade5.toGold(1), /1 more lesson for gold/);
  assert.match(TEXT.grade5.toGold(2), /2 more lessons for gold/);
  assert.equal(TEXT.grade5.right(0), '🎉 Right!');
  assert.equal(TEXT.grade5.right(14), '🎉 Right! +14 points');
});

test('60 different quotes, each Filipino · English', () => {
  assert.equal(QUOTES.length, 60);
  assert.equal(new Set(QUOTES.map((q) => q[1])).size, 60);
  for (const [fil, en] of QUOTES) {
    assert.ok(fil && en && !fil.includes(' · ') && !en.includes(' · '), en);
    assert.doesNotMatch(fil, /tunog tama|natutunan|\bpwede\b|nakakatakot|^Tapos\b/i, fil);
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-lines.test.js`
Expected: FAIL with "Cannot find module …buddies.js".

- [ ] **Step 3: Create `web/world/buddies.js`**

```js
/* Who stands by each subject door: a name, a face for the speech bubble, a hello line and the look cast.js builds.
   Grade 2 hello lines pair Filipino with English. A new game needs a buddy here (the test fails otherwise). */
(function (root) {
  'use strict';

  var KINDS = ['kitten', 'worm', 'frog', 'carabao', 'tarsier', 'panda', 'puppy', 'hedgehog', 'robot', 'bird', 'bear', 'mouse'];
  var PROPS = ['ruler', 'book', 'tube', 'pencil', 'heart', 'ball', 'needle', 'note', 'block', 'glass', 'mouse'];
  var HATS = ['salakot', 'cap'];

  var BUDDIES = {
    grade5: {
      'history-explorers': { name: 'Kiko', face: '🐃', hi: 'Mabuhay! I love our history!', look: { kind: 'carabao', fur: '#9a98ae', belly: '#d9d6e6', hat: 'salakot' } },
      'wikaharian': { name: 'Tarsi', face: '🐒', hi: 'Kumusta! Words are my treasure!', look: { kind: 'tarsier', fur: '#c9a27e', belly: '#f1dcc4', prop: 'pencil' } },
      'math-mastery': { name: 'Ruler Kit', face: '🐱', hi: 'Purr-fect timing!', look: { kind: 'kitten', fur: '#ffb38a', belly: '#fff4e6', prop: 'ruler' } },
      'page-turners': { name: 'Bookie', face: '🐛', hi: 'Hello, reader friend!', look: { kind: 'worm', fur: '#8ee07f', belly: '#d8f7cf', prop: 'book' } },
      'rise-shine': { name: 'Pandy', face: '🐼', hi: 'Hi! Your kind heart shines!', look: { kind: 'panda', fur: '#ffffff', belly: '#f2f2f2', prop: 'heart' } },
      'rally-ready': { name: 'Dash', face: '🐶', hi: 'Woof! Ready, set, go!', look: { kind: 'puppy', fur: '#e8b97a', belly: '#fff1dc', prop: 'ball' } },
      'craft-corner': { name: 'Stitch', face: '🦔', hi: "Hi! Let's make something lovely!", look: { kind: 'hedgehog', fur: '#f3d2b3', belly: '#fff4e6', spikes: '#a7744f', prop: 'needle' } },
      'life-lab': { name: 'Fizz', face: '🐸', hi: 'Ribbit! Science is so cool!', look: { kind: 'frog', fur: '#7fdc8b', belly: '#e3fbd9', prop: 'tube' } },
      'net-navigators': { name: 'Byte', face: '🤖', hi: 'Beep boop! Hello, friend!', look: { kind: 'robot', fur: '#a8ecf7', belly: '#e4fbff' } },
      'rhythm-hues': { name: 'Melody', face: '🐦', hi: 'Tweet tweet! La la la!', look: { kind: 'bird', fur: '#ffd166', belly: '#fff3c4', prop: 'note' } }
    },
    grade2: {
      'block-bot': { name: 'Bloxy', face: '🤖', hi: 'Beep! Kumusta, kaibigan? · Beep! Hello, friend!', look: { kind: 'robot', fur: '#ffb38a', belly: '#fff1e6', prop: 'block' } },
      'kuwentista': { name: 'Tarsi', face: '🐒', hi: 'May kuwento ako para sa iyo! · I have a story for you!', look: { kind: 'tarsier', fur: '#c9a27e', belly: '#f1dcc4', prop: 'book' } },
      'word-train': { name: 'Choo-Choo Bear', face: '🐻', hi: 'Tsuk-tsuk! Sakay na! · Choo choo! All aboard!', look: { kind: 'bear', fur: '#c48a6a', belly: '#f3dcc8', hat: 'cap' } },
      'batang-bayani': { name: 'Kiko', face: '🐃', hi: 'Mabuhay, batang bayani! · Hello, little hero!', look: { kind: 'carabao', fur: '#9a98ae', belly: '#d9d6e6', hat: 'salakot' } },
      'growing-good': { name: 'Pandy', face: '🐼', hi: 'Ang bait mo! · You are so kind!', look: { kind: 'panda', fur: '#ffffff', belly: '#f2f2f2', prop: 'heart' } },
      'byte-buddies': { name: 'Click', face: '🐭', hi: 'Click! Handa ka na ba? · Click! Are you ready?', look: { kind: 'mouse', fur: '#d9d6e6', belly: '#f7f5ff', prop: 'mouse' } },
      'science-detectives': { name: 'Detective Ribbit', face: '🐸', hi: 'Ribbit! Mag-imbestiga tayo! · Ribbit! Let us investigate!', look: { kind: 'frog', fur: '#7fdc8b', belly: '#e3fbd9', prop: 'glass' } }
    }
  };

  var exported = { BUDDIES: BUDDIES, KINDS: KINDS, PROPS: PROPS, HATS: HATS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Buddies = exported;
})(this);
```

- [ ] **Step 4: Create `web/world/lines.js`**

```js
/* Every line the characters say, except Mayor Mimi's (guide.js) and the hello lines (buddies.js). Buddies speak from her
   progress, Hoot about review, Bunny about saving; QUOTES are the talking trees' [Filipino, English] quotes. Grade 2 says
   both halves; Grade 5 the English. Kind words only: nothing here ever scolds or compares. */
(function (root) {
  'use strict';

  function word(n, one, many) { return n === 1 ? one : many; }
  function qs(n) { return n + word(n, ' question is', ' questions are'); }
  function lessons(n) { return n + ' more ' + word(n, 'lesson', 'lessons'); }
  function coins(n) { return n + ' more ' + word(n, 'coin', 'coins'); }

  var EN = {
    boss: function (s) { return '⚔️ The boss is waiting in ' + s + '! Beat a stage at the Boss Fort.'; },
    due: function (n) { return '🔁 ' + qs(n) + ' ready for review. Tap Ask me!'; },
    dueGame: function (n) { return '🔁 ' + qs(n) + ' ready for review inside the game.'; },
    quest: function (s) { return '❗ There is a quest in ' + s + ' today!'; },
    allGold: '🏆 All gold! You are a star!',
    toGold: function (n) { return '🥈 Silver! ' + lessons(n) + ' for gold!'; },
    toSilver: function (n) { return '🥉 Bronze! ' + lessons(n) + ' for silver!'; },
    toBronze: function (n) { return '🏅 Get a medal on ' + lessons(n) + ' for bronze!'; },
    missed: function (d) { return '💛 I missed you! It has been ' + d + ' days.'; },
    fallback: 'Want to learn something new today?',
    thinking: '🤔 Let me find a question…',
    askNone: "🌟 You're all caught up! No questions are due.",
    askGame: "📖 These questions are best in the game. Let's go there!",
    askFail: "📖 Let's ask in the game!",
    right: function (p) { return p > 0 ? '🎉 Right! +' + p + ' points' : '🎉 Right!'; },
    answerIs: function (a) { return 'The right answer is ' + a; },
    hoot: {
      hello: function (n) { return 'Hoo-hoo! ' + qs(n) + ' ready for review. Shall I ask you?'; },
      none: 'Hoo! Nothing to review right now. Come back tomorrow! 🌙',
      wise: [
        'Reviewing helps you remember what you learned.',
        'A lesson is easier to remember when you repeat it little by little.',
        'It is okay to make mistakes. That is how we learn!',
        'Sleep early to make your memory strong.'
      ]
    },
    bunny: {
      save: function (n, goal) { return 'Only ' + coins(n) + ' for ' + goal + '! 🐰 Keep going!'; },
      any: 'You have enough coins for a reward! Saving them is great too. 💛',
      tips: [
        'Every 20 points make 1 coin.',
        'Mommy or Tatay types the PIN when you buy.',
        'Buying never takes away your ⭐ points.'
      ]
    }
  };

  function pair(fil, en) { return fil + ' · ' + en; }

  var FIL = {
    boss: function (s) { return pair('⚔️ Naghihintay ang boss sa ' + s + '! Talunin ang isang yugto sa Kuta ng Boss.', EN.boss(s).slice(3)); },
    due: function (n) { return pair('🔁 ' + n + ' tanong ang handa nang balikan. Pindutin ang Ask me!', EN.due(n).slice(3)); },
    dueGame: function (n) { return pair('🔁 ' + n + ' tanong ang handa nang balikan sa loob ng laro.', EN.dueGame(n).slice(3)); },
    quest: function (s) { return pair('❗ May quest sa ' + s + ' ngayong araw!', EN.quest(s).slice(2)); },
    allGold: pair('🏆 Puro ginto! Ang galing mo!', 'All gold! You are a star!'),
    toGold: function (n) { return pair('🥈 Pilak! ' + n + ' pang aralin para sa ginto!', EN.toGold(n).slice(3)); },
    toSilver: function (n) { return pair('🥉 Tanso! ' + n + ' pang aralin para sa pilak!', EN.toSilver(n).slice(3)); },
    toBronze: function (n) { return pair('🏅 Kumuha ng medalya sa ' + n + ' pang aralin para sa tanso!', EN.toBronze(n).slice(3)); },
    missed: function (d) { return pair('💛 Na-miss kita! ' + d + ' araw na ang nakalipas.', EN.missed(d).slice(3)); },
    fallback: pair('Gusto mo bang matuto ng bago ngayong araw?', EN.fallback),
    thinking: pair('🤔 Teka, hahanap ako ng tanong…', 'Let me find a question…'),
    askNone: pair('🌟 Tapos mo na ang lahat ng babalikan! Walang tanong na nakatakda ngayon.', "You're all caught up! No questions are due."),
    askGame: pair('📖 Mas maganda ang mga tanong na ito sa loob ng laro. Doon tayo!', "These questions are best in the game. Let's go there!"),
    askFail: pair('📖 Sa loob ng laro na lang tayo magtanong!', "Let's ask in the game!"),
    right: function (p) { return p > 0 ? pair('🎉 Magaling! +' + p + ' puntos', 'Great job! +' + p + ' points') : pair('🎉 Magaling!', 'Great job!'); },
    answerIs: function (a) { return pair('Ang tamang sagot ay ' + a, 'The right answer is ' + a); },
    hoot: {
      hello: function (n) { return pair('Huu-huu! ' + n + ' tanong ang handa nang balikan. Gusto mo bang tanungin kita?', EN.hoot.hello(n)); },
      none: pair('Huu! Wala pang babalikan ngayon. Bumalik ka bukas! 🌙', EN.hoot.none),
      wise: [
        pair('Tumutulong ang pagbabalik-aral para hindi mo makalimutan ang natutuhan mo.', EN.hoot.wise[0]),
        pair('Mas madaling tandaan ang aralin kapag inuulit nang paunti-unti.', EN.hoot.wise[1]),
        pair('Ayos lang magkamali. Doon tayo natututo!', EN.hoot.wise[2]),
        pair('Matulog nang maaga para lumakas ang iyong memorya.', EN.hoot.wise[3])
      ]
    },
    bunny: {
      save: function (n, goal) { return pair('Kaunti na lang! ' + n + ' coins pa para sa ' + goal + '! 🐰', EN.bunny.save(n, goal)); },
      any: pair('Kaya mo nang bumili ng reward! Magaling din ang mag-ipon. 💛', EN.bunny.any),
      tips: [
        pair('Bawat 20 points ay 1 coin.', EN.bunny.tips[0]),
        pair('Si Mommy o Tatay ang nagta-type ng PIN kapag bumili ka.', EN.bunny.tips[1]),
        pair('Hindi nababawasan ang iyong ⭐ points kapag bumili ka.', EN.bunny.tips[2])
      ]
    }
  };

  var QUOTES = [
    ['Ang maliliit na hakbang araw-araw ay humahantong sa malalaking pangarap.', 'Small steps every day lead to big dreams.'],
    ['Natututo tayo sa mga pagkakamali. Subukan muli!', 'Mistakes help you learn. Try again!'],
    ['Maging mabait. Pinagniningning nito ang lahat.', 'Be kind. It makes everyone shine.'],
    ['Mas matapang ka kaysa sa iniisip mo.', 'You are braver than you think.'],
    ['Dinadala ka ng pagbabasa sa malalayong lugar.', 'Reading takes you to faraway places.'],
    ['Ang ngiti ay regalong maibibigay mo araw-araw.', 'A smile is a gift you can give every day.'],
    ['Ang pagsasanay ay nagdadala ng pag-unlad.', 'Practice makes progress.'],
    ['Magtanong ka. Lumalago ang isip na mausisa.', 'Ask questions. Curious minds grow.'],
    ['Sapat na palagi ang iyong makakaya.', 'Your best is always enough.'],
    ['Sumasaya ang puso kapag tumutulong sa iba.', 'Helping others makes your heart happy.'],
    ['Ang bawat eksperto ay nagsimula rin bilang baguhan.', 'Every expert was once a beginner.'],
    ['Bahagi rin ng pag-aaral ang pagpapahinga.', 'Rest is part of learning too.'],
    ['Magpasalamat ka. Isa itong munting mahiwagang salita.', 'Say thank you. It is a little magic word.'],
    ['Gawin ang iyong makakaya, at ipagmalaki ito.', 'Try your best, then be proud.'],
    ['Gumagaan ang mahirap kapag sinasanay.', 'Hard things get easier with practice.'],
    ['Kaya mong gawin ang mahihirap na bagay.', 'You can do hard things.'],
    ['Isang superpower ang pagiging mabuting kaibigan.', 'Being a good friend is a superpower.'],
    ['Matuto ng bago ngayong araw.', 'Learn something new today.'],
    ['Mahal ka ng pamilya mo, palagi.', 'Your family loves you, always.'],
    ['Sa tiyaga, nagiging puno ang maliliit na buto.', 'With patience, little seeds grow into trees.'],
    ['Nakatutulong sa abalang isip ang malinis na paligid.', 'A tidy space helps a busy mind.'],
    ['Ang mababait na salita ay parang sikat ng araw.', 'Kind words are like sunshine.'],
    ['Magpatuloy ka. Lumalaki at umuunlad ka!', 'Keep going. You are growing!'],
    ['Magbahagi, at lalaki ang saya.', 'Share, and the joy grows bigger.'],
    ['Maniwala ka sa iyong sarili.', 'Believe in yourself.'],
    ['Bawat pahinang binabasa mo ay nagpapatalino sa iyo.', 'Every page you read makes you wiser.'],
    ['Makinig nang mabuti, at marami kang matututuhan.', 'Listen well, and you will learn a lot.'],
    ['Ayos lang na hindi mo pa alam.', 'It is okay not to know yet.'],
    ['Lumilipas ang ulap. Bumabalik ang araw.', 'Clouds pass. The sun comes back.'],
    ['Maging tapat, kahit mahirap.', 'Be honest, even when it is hard.'],
    ['Pinalalakas ka ng tubig, tulog at laro.', 'Water, sleep and play keep you strong.'],
    ['Mahalaga ang iyong mga ideya.', 'Your ideas matter.'],
    ['Mag-isip muna bago sumagot.', 'Think first, then answer.'],
    ['Ipagdiwang ang maliliit na tagumpay!', 'Celebrate small wins!'],
    ['Mahalin ang bayan sa pamamagitan ng pag-aalaga rito.', 'Love your country by caring for it.'],
    ['Pinatitibay ng paggalang ang pagkakaibigan.', 'Respect makes friendships strong.'],
    ['Unti-unti, maraming natatapos.', 'Little by little, a lot gets done.'],
    ['Ikaw ang maging dahilan ng ngiti ng iba ngayong araw.', 'Be the reason someone smiles today.'],
    ['Huwag sumuko. Huminga nang malalim at subukan muli.', 'Do not give up. Take a breath and try again.'],
    ['Masaya ang pusong marunong magpasalamat.', 'A grateful heart is a happy heart.'],
    ['Mabagal tumubo ang puno, pero tumataas ito.', 'Trees grow slowly, but they grow tall.'],
    ['Mahalaga ang boses mo. Magsalita nang mahinahon at mabait.', 'Your voice matters. Speak gently and kindly.'],
    ['Isang pakikipagsapalaran ang pag-aaral!', 'Learning is an adventure!'],
    ['Ang mabubuting gawi ay nagbubunga ng magagandang araw.', 'Good habits grow good days.'],
    ['Alagaan ang mundo. Inaalagaan din tayo nito.', 'Take care of the earth. It takes care of us.'],
    ['Ang pagtulong sa bahay ay pagmamahal na isinasagawa.', 'Helping at home is love in action.'],
    ['Kumanta, gumuhit, sumayaw. Ipakita ang iyong saya!', 'Sing, draw, dance. Let your joy out!'],
    ['Ang tanong ay simula ng sagot.', 'A question is the start of an answer.'],
    ['Ang araw na ito ay isang bagong simula.', 'Today is a fresh new start.'],
    ['Magsikap, at maglaro nang patas.', 'Work hard, and play fair.'],
    ['Hindi ka sinusukat ng iyong mga pagkakamali, kundi ng iyong pagsisikap.', 'Your mistakes do not define you. Your tries do.'],
    ['Laging maganda ang mabuting puso.', 'A kind heart is always beautiful.'],
    ['Isa-isahin ang mga gawain.', 'Do one thing at a time.'],
    ['Maging mausisa tungkol sa mundo.', 'Wonder about the world.'],
    ['Ipinagmamalaki ka ng pamilya mo.', 'You make your family proud.'],
    ['Ang magkapatid ay puwedeng maging magkaibigan habambuhay.', 'Sisters can be best friends for life.'],
    ['Humingi ng tawad, at ayusin ang nagawa.', 'Say sorry, and make it right.'],
    ['Maging mabait din sa iyong sarili.', 'Be gentle with yourself too.'],
    ['Pinagagaan ng masayang tawa ang lahat.', 'A good laugh makes everything lighter.'],
    ['Kamangha-mangha ang pagkakalikha sa iyo.', 'You are wonderfully made.']
  ];

  var exported = { TEXT: { grade5: EN, grade2: FIL }, QUOTES: QUOTES };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Lines = exported;
})(this);
```

Note: `.slice(3)` / `.slice(2)` drop the emoji and space from the English half (🔁 ⚔️ 🥈 🥉 🏅 💛 are 2 UTF-16 units + a space = 3; ❗ is 1 unit + a space = 2). The test "Grade 2 lines pair" proves both halves are there; check one by eye: `FIL.due(2)` must read `🔁 2 tanong ang handa nang balikan. Pindutin ang Ask me! · 2 questions are ready for review. Tap Ask me!`. ⚔️ is 2 units (U+2694 + U+FE0F), so `slice(3)` is right for it too.

- [ ] **Step 5: Run the test**

Run: `node --test tests/world3d-lines.test.js`
Expected: PASS. Also run in Node: `node -e "const L=require('./web/world/lines.js');console.log(L.TEXT.grade2.due(2));console.log(L.TEXT.grade2.quest('Math'));console.log(L.TEXT.grade2.boss('Math'))"` and check that no English half starts with a broken character or a leftover emoji.

- [ ] **Step 6: Stage**

```bash
git add web/world/buddies.js web/world/lines.js tests/world3d-lines.test.js
```

---

### Task 3: What to say (`chat.js`)

**Files:**
- Create: `web/world/chat.js`
- Test: `tests/world3d-chat.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-chat.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const C = require(worldFile('chat.js'));
const { TEXT, QUOTES } = require(worldFile('lines.js'));

const DAY = 86400000;
const NOW = new Date(2026, 9, 6, 10).getTime();
const O = { now: NOW, subject: 'Science', hi: 'Ribbit!', inGame: false };
const E = TEXT.grade5;

test('a buddy says the most important thing first: boss, review, quest, medal, missed, then the fallback', () => {
  const all = C.buddyLines('grade5', { boss: true, due: 2, quest: true, tally: { gold: 1, silver: 1, bronze: 0, total: 2 }, lastT: NOW - 4 * DAY }, O);
  assert.deepEqual(all, ['Ribbit! ' + E.boss('Science'), E.due(2), E.quest('Science'), E.toGold(1), E.missed(4), E.fallback]);
  assert.deepEqual(C.buddyLines('grade5', {}, O), ['Ribbit! ' + E.fallback], 'nothing known: the hello and the fallback');
});

test('a game whose review stays inside says so', () => {
  assert.equal(C.buddyLines('grade5', { due: 1 }, Object.assign({}, O, { inGame: true }))[0], 'Ribbit! ' + E.dueGame(1));
});

test('medal lines follow the weakest medal', () => {
  const m = (t) => C.buddyLines('grade5', { tally: t }, O)[0].slice('Ribbit! '.length);
  assert.equal(m({ gold: 3, silver: 0, bronze: 0, total: 3 }), E.allGold);
  assert.equal(m({ gold: 1, silver: 2, bronze: 0, total: 3 }), E.toGold(2));
  assert.equal(m({ gold: 1, silver: 0, bronze: 2, total: 3 }), E.toSilver(2));
  assert.equal(m({ gold: 0, silver: 0, bronze: 1, total: 3 }), E.toBronze(2));
  assert.equal(m({ gold: 0, silver: 0, bronze: 0, total: 0 }), E.fallback, 'no lessons tracked yet');
});

test('she is missed only after 3 days away', () => {
  assert.equal(C.buddyLines('grade5', { lastT: NOW - 2 * DAY }, O).length, 1);
  assert.equal(C.buddyLines('grade5', { lastT: NOW - 3 * DAY }, O)[0], 'Ribbit! ' + E.missed(3));
});

test('Grade 2 joins the hello and the line half by half', () => {
  const out = C.buddyLines('grade2', {}, Object.assign({}, O, { hi: 'Ang bait mo! · You are so kind!' }));
  assert.equal(out[0], 'Ang bait mo! Gusto mo bang matuto ng bago ngayong araw? · You are so kind! Want to learn something new today?');
  assert.equal(C.join('a', 'b'), 'a b');
});

test('a tree has one quote all day, and More walks through every quote', () => {
  assert.equal(C.quote('grade5', 3, '2026-10-6', 0), C.quote('grade5', 3, '2026-10-6', 0));
  const trees = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((t) => C.quote('grade5', t, '2026-10-6', 0)));
  assert.ok(trees.size >= 5, 'the trees mostly say different things');
  const seen = new Set();
  for (let k = 0; k < QUOTES.length; k++) seen.add(C.quote('grade5', 3, '2026-10-6', k));
  assert.equal(seen.size, QUOTES.length);
  assert.match(C.quote('grade2', 3, '2026-10-6', 0), / · /);
});

test('Bunny cheers the cheapest reward still out of reach, and never pushes spending', () => {
  const shelf = [
    { item: { emoji: '🎵', goal: 'Car music pick' }, ok: true, need: 0, daily: false },
    { item: { emoji: '🎮', goal: 'ML game' }, ok: false, need: 0, daily: true },
    { item: { emoji: '🐴', goal: 'Piggyback' }, ok: false, need: 12, daily: false },
    { item: { emoji: '👨', goal: '1 ML game with Tatay' }, ok: false, need: 40, daily: false },
  ];
  assert.equal(C.bunnyLine('grade5', shelf), E.bunny.save(12, '🐴 Piggyback'));
  assert.equal(C.bunnyLine('grade5', [shelf[0]]), E.bunny.any);
  assert.equal(C.bunnyLine('grade5', []), E.bunny.any);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-chat.test.js`
Expected: FAIL with "Cannot find module …chat.js".

- [ ] **Step 3: Create `web/world/chat.js`**

```js
/* Which line a character says. Pure: folk.js passes in what it knows about her, so Node can test every choice.
   A buddy's lines come in the spec's order (boss, review, quest, medal, missed her, fallback); 💬 More walks down them. */
(function (root) {
  'use strict';
  var DAY = 86400000, MISS_DAYS = 3;
  var node = typeof module !== 'undefined' && module.exports;
  var Lines = node ? require('./lines.js') : null;

  function lines() { return Lines || root.World3D.Lines; }

  // Two lines into one. Grade 2 lines are "Filipino · English": the halves go together.
  function join(a, b) {
    var sep = ' · ', i = a.lastIndexOf(sep), j = b.lastIndexOf(sep);
    if (i < 0 || j < 0) return a + ' ' + b;
    return a.slice(0, i) + ' ' + b.slice(0, j) + sep + a.slice(i + sep.length) + ' ' + b.slice(j + sep.length);
  }

  function medalLine(L, t) {
    if (!t || !(t.total > 0)) return null;
    var g = t.gold || 0, s = t.silver || 0, b = t.bronze || 0;
    if (g >= t.total) return L.allGold;
    if (g + s >= t.total) return L.toGold(t.total - g);
    if (g + s + b >= t.total) return L.toSilver(t.total - g - s);
    return L.toBronze(t.total - g - s - b);
  }

  // s = { boss, due, quest, tally, lastT }; o = { now, subject, hi, inGame (review stays in the game) }
  function buddyLines(grade, s, o) {
    var L = lines().TEXT[grade], out = [];
    if (s.boss) out.push(L.boss(o.subject));
    if (s.due > 0) out.push(o.inGame ? L.dueGame(s.due) : L.due(s.due));
    if (s.quest) out.push(L.quest(o.subject));
    var m = medalLine(L, s.tally);
    if (m) out.push(m);
    if (typeof s.lastT === 'number') {
      var days = Math.floor((o.now - s.lastT) / DAY);
      if (days >= MISS_DAYS) out.push(L.missed(days));
    }
    out.push(L.fallback);
    out[0] = join(o.hi, out[0]);
    return out;
  }

  function hash(text) {
    var h = 7;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
  }

  // The same quote all day for a tree; k = how many times she pressed More.
  function quote(grade, tree, day, k) {
    var Q = lines().QUOTES, q = Q[(hash(String(day) + '|' + tree) + (k || 0)) % Q.length];
    return grade === 'grade2' ? q[0] + ' · ' + q[1] : q[1];
  }

  // shelf = Wallet.shelf(points): the cheapest reward she cannot afford yet, or a happy line when she can afford them all.
  function bunnyLine(grade, shelf) {
    var L = lines().TEXT[grade].bunny, best = null;
    (shelf || []).forEach(function (s) {
      if (s && s.item && !s.ok && !s.daily && s.need > 0 && (!best || s.need < best.need)) best = s;
    });
    return best ? L.save(best.need, best.item.emoji + ' ' + best.item.goal) : L.any;
  }

  var exported = { join: join, buddyLines: buddyLines, quote: quote, bunnyLine: bunnyLine };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Chat = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-chat.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/chat.js tests/world3d-chat.test.js
```

---

### Task 4: Questions the way each game keys them (`quiz.js`)

Every game builds its review key in its own `reviewInfo` (in its `index.html`). The world must build the very same key, or Ask me! would move a box the game never reads. The test runs each game's own `reviewInfo` (cut out of its page) next to `quiz.js` on every question.

**Files:**
- Create: `web/world/quiz.js`
- Test: `tests/world3d-quiz.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-quiz.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { APPS, appFile, worldFile, engineFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { keyOf } = require(engineFile('recall.js'));
const Q = require(worldFile('quiz.js'));

// Stands in for Recall.textOf (the browser's innerHTML → textContent). Both sides use it, so keys can be compared.
const textOf = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

// Cuts `function name(...) { ... }` out of a page by counting braces.
function extract(html, name) {
  const start = html.indexOf('function ' + name + '(');
  let i = html.indexOf('{', start);
  for (let depth = 0; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}

function gameReviewInfo(id) {
  const html = fs.readFileSync(appFile(id), 'utf8');
  const tf = html.match(/SH_TRUE = '([^']*)', SH_FALSE = '([^']*)'/);
  const src = ['decode', 'historyQuestion', 'reviewInfo'].filter((n) => html.includes('function ' + n + '(')).map((n) => extract(html, n)).join('\n');
  const ctx = vm.createContext({ Recall: { textOf }, SH_TRUE: tf ? tf[1] : 'True', SH_FALSE: tf ? tf[2] : 'False' });
  return vm.runInContext(src + '\nreviewInfo', ctx);
}

test('every game except Math Mastery can be asked in the world', () => {
  assert.deepEqual(Object.keys(Q.SHAPES).sort(), APPS.map((a) => a.id).filter((id) => id !== 'math-mastery').sort(),
    'a new game needs a shape in web/world/quiz.js');
  assert.equal(Q.supports('math-mastery'), false);
});

for (const id of Object.keys(Q.SHAPES)) {
  test(id + ': the world builds the same review key as the game, for every question', () => {
    const game = gameReviewInfo(id);
    let asked = 0;
    lessons(id).filter((l) => !l.generate).forEach((l, li) => (l.quiz || []).forEach((item, i) => {
      const where = id + ' lesson ' + (li + 1) + ' question ' + (i + 1);
      const mine = Q.info(id, item, textOf);
      const theirs = game(item);
      assert.equal(keyOf(id, mine), keyOf(id, theirs), where);
      assert.equal(mine.historyAnswer, theirs.historyAnswer, where);
      if (!Q.askable(id, l, item)) return;
      asked++;
      assert.equal(mine.historyQ, theirs.historyQ, where);
      const v = Q.view(id, item, textOf, () => 0.3);
      assert.equal(v.options.filter((o) => o.right).length, 1, where + ' has one right choice');
      assert.equal(v.options.find((o) => o.right).text, v.answer, where);
      assert.ok(v.q, where + ' has a question');
    }));
    assert.ok(asked > 0, id + ' has questions the world can ask');
  });
}

test('pictures, reading passages and generated lessons stay in the game', () => {
  assert.equal(Q.askable('life-lab', {}, { q: 'Q', options: ['a', 'b'], correct: 0, art: '<svg></svg>' }), false);
  assert.equal(Q.askable('page-turners', {}, { q: 'Q', options: ['a', 'b'], correct: 0, passage: 'Once…' }), false);
  assert.equal(Q.askable('block-bot', { generate: () => [] }, { q: 'Q', options: ['1', '2'], correct: 0 }), false);
  assert.equal(Q.askable('byte-buddies', {}, { type: 'mc', q: 'Q', pic: 'x.png', options: [{ text: 'a', correct: true }] }), false);
  assert.equal(Q.askable('word-train', {}, { type: 'tf', q: 'Q', answer: false }), true);
});

test('true/false shows the game\'s own words', () => {
  const v = Q.view('batang-bayani', { type: 'tf', q: 'Q', answer: false, why: 'Pinili mo ang Tama, pero…', bad: 'Hindi totoo.', good: 'Magaling!' }, textOf);
  assert.deepEqual(v.options.map((o) => [o.text, o.right]), [['Tama', false], ['Mali', true]]);
  assert.equal(v.answer, 'Mali');
  assert.equal(v.options[0].why, 'Pinili mo ang Tama, pero…');
  assert.equal(v.explain, 'Hindi totoo.');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-quiz.test.js`
Expected: FAIL with "Cannot find module …quiz.js".

- [ ] **Step 3: Create `web/world/quiz.js`**

```js
/* ❓ Ask me! questions from a game's own lesson data. Each game builds its review key in its own reviewInfo (in its
   page); SHAPES says how, so the world finds the same review box the game uses (the test checks every question).
   Only questions the speech bubble can show are asked: multiple choice and true/false, without a picture, a reading
   passage or a generated lesson. Math Mastery reviews skills, so its buddy sends her to the game instead. */
(function (root) {
  'use strict';

  // index: options are strings and correct is an index. typed: type 'mc' with {text, correct} options, or 'tf' with answer.
  // art: the field that goes into the key as the picture (null: the game leaves it out). text: the answer goes
  // through textOf. decode: the game decodes a few entities first. tf: the game's True/False words.
  var INDEX = { shape: 'index', art: 'art', text: true };
  var TYPED = { shape: 'typed', art: null, decode: true, tf: ['True', 'False'] };
  var SHAPES = {
    'history-explorers': INDEX, 'wikaharian': INDEX, 'page-turners': INDEX, 'rise-shine': INDEX, 'rally-ready': INDEX,
    'craft-corner': INDEX, 'life-lab': INDEX, 'net-navigators': INDEX, 'rhythm-hues': INDEX,
    'block-bot': { shape: 'index', art: 'art', text: false },
    'kuwentista': { shape: 'index', art: null, text: false },
    'word-train': TYPED, 'growing-good': TYPED, 'science-detectives': TYPED,
    'byte-buddies': { shape: 'typed', art: 'pic', decode: true, tf: ['True', 'False'] },
    'batang-bayani': { shape: 'typed', art: null, decode: false, tf: ['Tama', 'Mali'] }
  };

  // The same replacements as the Grade 2 games' decode().
  function decode(str) {
    return str
      .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
      .replace(/&rsquo;/g, '’').replace(/&mdash;/g, '—').replace(/&minus;/g, '−').replace(/&amp;/g, '&');
  }

  function supports(app) { return Object.prototype.hasOwnProperty.call(SHAPES, app); }

  function rightOption(item) {
    return (item.options || []).filter(function (o) { return o && o.correct; })[0] || null;
  }

  function askable(app, lesson, item) {
    var c = SHAPES[app];
    if (!c || !item || (lesson && lesson.generate) || item.art || item.pic || item.passage) return false;
    if (c.shape === 'index') return Array.isArray(item.options) && typeof item.correct === 'number' && item.options[item.correct] !== undefined;
    return item.type === 'tf' ? typeof item.answer === 'boolean' : item.type === 'mc' && !!rightOption(item);
  }

  // The game's reviewInfo: { q, art, answer, historyQ, historyAnswer }. Block Bot names its picture questions in its own
  // way (historyQuestion), but picture questions are never asked here, so only their keys must match.
  function info(app, item, textOf) {
    var c = SHAPES[app], art = c.art ? item[c.art] : undefined;
    if (c.shape === 'index') {
      var answer = item.options[item.correct];
      return { q: item.q, art: art, answer: c.text ? textOf(answer) : answer, historyQ: art ? item.q + ' [' + answer + ']' : item.q, historyAnswer: answer };
    }
    var right = item.type === 'tf' ? null : rightOption(item);
    var said = item.type === 'tf' ? (item.answer ? c.tf[0] : c.tf[1]) : (right || {}).text;
    return {
      q: item.q, art: art, answer: right ? textOf(c.decode ? decode(right.text) : right.text) : '',
      historyQ: art ? item.q + ' [' + said + ']' : item.q, historyAnswer: said
    };
  }

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1)), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function both() { return [].slice.call(arguments).filter(Boolean).join('\n'); }

  // What the bubble shows: the question, a helper line, the choices (shuffled), the right answer and the game's own
  // explanations. history is the text the game saves for that choice.
  function view(app, item, textOf, rand) {
    var c = SHAPES[app];
    rand = rand || Math.random;
    function t(s) { return s ? textOf(c.shape === 'typed' && c.decode ? decode(String(s)) : s) : ''; }
    if (c.shape === 'index') {
      var options = shuffle(item.options.map(function (o, i) {
        return { text: t(o), right: i === item.correct, history: o, why: both(t((item.why || [])[i]), t((item.whyEn || [])[i])) };
      }), rand);
      return { q: t(item.q), sub: t(item.qen), options: options, answer: t(item.options[item.correct]), explain: both(t(item.explain), t(item.en)), good: '' };
    }
    var out = { q: t(item.q), sub: '', explain: t(item.bad), good: t(item.good) };
    if (item.type === 'tf') {
      out.options = [true, false].map(function (v, i) {
        return { text: c.tf[i], right: item.answer === v, history: c.tf[i], why: item.answer === v ? '' : t(item.why) };
      });
      out.answer = c.tf[item.answer ? 0 : 1];
    } else {
      out.options = shuffle(item.options.map(function (o) {
        return { text: t(o.text), right: !!o.correct, history: o.text, why: o.correct ? '' : t(o.why) };
      }), rand);
      out.answer = t(rightOption(item).text);
    }
    return out;
  }

  var exported = { SHAPES: SHAPES, supports: supports, askable: askable, info: info, view: view, decode: decode };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Quiz = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-quiz.test.js`
Expected: PASS. If a game's key does not match, read that game's `reviewInfo` in its `index.html` and fix its entry in `SHAPES` (never change the game).

- [ ] **Step 5: Stage**

```bash
git add web/world/quiz.js tests/world3d-quiz.test.js
```

---

### Task 5: Each game's lesson files (`tools/lesson-files.js`, `web/world/lesson-files.js`)

**Files:**
- Create: `tools/lesson-files.js`, `web/world/lesson-files.js` (generated)
- Modify: `tools/update-precache.js`
- Test: `tests/world3d-lesson-files.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-lesson-files.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, app, appFile, worldFile } = require('./paths.js');
const { dataFiles } = require('./content.js');
const Q = require(worldFile('quiz.js'));
const gen = require(path.join(ROOT, 'tools', 'lesson-files.js'));

test('web/world/lesson-files.js is up to date (run node tools/update-precache.js)', () => {
  assert.equal(fs.readFileSync(worldFile('lesson-files.js'), 'utf8').replace(/\r\n/g, '\n'), gen.source());
});

test('every game the world asks from lists its lesson files in page order, with its own keys', () => {
  const FILES = require(worldFile('lesson-files.js'));
  for (const id of Object.keys(Q.SHAPES)) {
    const f = FILES[id];
    const a = app(id);
    assert.ok(f, id);
    assert.equal(f.dir, '../' + path.posix.dirname(a.page) + '/', id + ' dir');
    assert.deepEqual(f.files, dataFiles(id).filter((x) => x.startsWith('lessons/')), id + ' files');
    assert.deepEqual([f.title, f.pointsKey, f.progressKey], [a.title, a.pointsKey, a.progressKey], id + ' keys');
    for (const file of f.files) assert.ok(fs.existsSync(path.join(path.dirname(appFile(id)), file)), file);
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-lesson-files.test.js`
Expected: FAIL with "Cannot find module …tools/lesson-files.js".

- [ ] **Step 3: Create `tools/lesson-files.js`**

```js
// Builds web/world/lesson-files.js: each game's lesson scripts (in its page's order), title, points key and progress
// key, so the 3D world can load a subject's questions when she asks. update-precache.js writes it.
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const OUT = path.join(WEB, 'world', 'lesson-files.js');

function collect() {
  const out = {};
  const base = path.join(WEB, 'subjects');
  for (const g of fs.readdirSync(base).sort()) {
    for (const s of fs.readdirSync(path.join(base, g)).sort()) {
      const dir = path.join(base, g, s);
      const json = path.join(dir, 'subject.json');
      if (!fs.existsSync(json)) continue;
      const meta = JSON.parse(fs.readFileSync(json, 'utf8'));
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      const files = [...html.matchAll(/<script src="(lessons\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
      if (!files.length) continue;
      out[meta.id] = { title: meta.title, pointsKey: meta.pointsKey, progressKey: meta.progressKey, dir: '../subjects/' + g + '/' + s + '/', files };
    }
  }
  return out;
}

function source() {
  return '/* Made by tools/update-precache.js; do not edit. Each game\'s lesson files, which the 3D world loads when she asks\n'
    + '   for review questions (ask.js). */\n'
    + '(function (root) {\n'
    + "  'use strict';\n"
    + '  var FILES = ' + JSON.stringify(collect(), null, 2).replace(/\n/g, '\n  ') + ';\n'
    + "  if (typeof module !== 'undefined' && module.exports) {\n"
    + '    module.exports = FILES;\n'
    + '    return;\n'
    + '  }\n'
    + '  root.World3D = root.World3D || {};\n'
    + '  root.World3D.LessonFiles = FILES;\n'
    + '})(this);\n';
}

module.exports = { collect, source, OUT };
```

- [ ] **Step 4: Make `update-precache.js` write it**

In `tools/update-precache.js`, find:

```js
const WEB = path.join(__dirname, '..', 'web');
const SW = path.join(WEB, 'sw.js');
```

Replace with:

```js
const lessonFiles = require('./lesson-files.js');

const WEB = path.join(__dirname, '..', 'web');
const SW = path.join(WEB, 'sw.js');

// The world's list of lesson files is written first, so it is precached too.
fs.writeFileSync(lessonFiles.OUT, lessonFiles.source());
```

Also change the comment on its second line from:

```js
// Run after adding, renaming or removing a file under web/: node tools/update-precache.js
```

to:

```js
// Run after adding, renaming or removing a file under web/: node tools/update-precache.js
// It also rewrites web/world/lesson-files.js (tools/lesson-files.js).
```

- [ ] **Step 5: Generate and run the test**

Run: `node tools/update-precache.js && node --test tests/world3d-lesson-files.test.js`
Expected: `web/sw.js precaches N files`, then PASS. `web/world/lesson-files.js` now exists and `web/sw.js` lists `world/lesson-files.js`.

- [ ] **Step 6: Stage**

```bash
git add tools/lesson-files.js tools/update-precache.js web/world/lesson-files.js web/sw.js tests/world3d-lesson-files.test.js
```

---

### Task 6: Asking and scoring (`ask.js`)

`create()` is the part Node tests: it picks due questions and answers them through the page's own engines. `loader()` is the browser part that loads a game's lesson scripts once, one game at a time, catching each `StudyKit.lesson(...)` call.

**Files:**
- Create: `web/world/ask.js`
- Test: `tests/world3d-ask.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/world3d-ask.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { create: createRecall, keyOf } = require(engineFile('recall.js'));
const SK = require(engineFile('study-kit.js'));
const Q = require(worldFile('quiz.js'));
const A = require(worldFile('ask.js'));

const NOW = new Date(2026, 9, 6, 10).getTime();
const textOf = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '');
const FILES = {
  'life-lab': { title: 'Life Lab', pointsKey: 'lifelab_points_v1', progressKey: 'lifelab_progress_v1', dir: 'x/', files: ['a.js'] },
  'page-turners': { title: 'Page Turners', pointsKey: 'pageturners_points_v1', progressKey: 'pageturners_progress_v1', dir: 'y/', files: ['b.js'] },
};

function memory(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

// A page with the real Recall and StudyKit; load() answers from the lesson data, or fails for a missing app.
function page(items, data) {
  const storage = memory({ review_v1: JSON.stringify({ v: 1, items }) });
  const history = [];
  const loaded = [];
  const win = { Learner: { storage }, location: { search: '' }, document: { querySelectorAll: () => [] } };
  win.Recall = Object.assign(createRecall(storage, () => NOW, 'grade5'), { keyOf });
  win.StudyKit = { start: (opts) => SK.start(opts, win, () => new Date(NOW)) };
  win.StudyHistory = {
    quizStarted: (...a) => { history.push({ started: a }); return 'h' + history.length; },
    quizAnswered: (...a) => { history.push({ answered: a }); },
  };
  const load = (app) => { loaded.push(app); return data[app] ? Promise.resolve(data[app]) : Promise.reject(new Error('404')); };
  const asker = A.create({ win, files: FILES, quiz: Q, load, textOf, title: 'Ask me!', rand: () => 0.4 });
  return { storage, history, loaded, asker };
}

function questions(app, n) {
  const ls = lessons(app);
  const out = [];
  ls.forEach((l) => (l.quiz || []).forEach((q) => { if (out.length < n && Q.askable(app, l, q)) out.push(q); }));
  return out;
}
const key = (app, q) => keyOf(app, Q.info(app, q, textOf));
const due = (box) => ({ box, due: '2026-10-01', t: 1 });

test('a due question is asked, and a right answer moves its box and pays like a review in the game', async () => {
  const [q, later] = questions('life-lab', 2);
  const p = page({ [key('life-lab', q)]: due(2), [key('life-lab', later)]: { box: 3, due: '2026-10-20', t: 1 } }, { 'life-lab': lessons('life-lab') });
  const list = await p.asker.pick(['life-lab']);
  assert.equal(list.length, 1, 'only the due question');
  assert.equal(list[0].item, q);
  const r = p.asker.answer(list, 0, list[0].view.options.findIndex((o) => o.right));
  assert.equal(r.right, true);
  assert.equal(r.pts, 14, '10 points + the box-2 gap bonus of 4');
  assert.equal(p.storage.getItem('lifelab_points_v1'), '14');
  assert.equal(JSON.parse(p.storage.getItem('review_v1')).items[key('life-lab', q)].box, 3);
  assert.deepEqual(p.history[0].started, ['life-lab', 'Life Lab', 'review', 'Ask me!', false, 1, 'review']);
  assert.deepEqual(p.history[1].answered.slice(0, 2), ['h1', true]);
});

test('a wrong answer sends the question to box 1 and shows the game\'s explanation', async () => {
  const [q] = questions('life-lab', 1);
  const p = page({ [key('life-lab', q)]: due(3) }, { 'life-lab': lessons('life-lab') });
  const list = await p.asker.pick(['life-lab']);
  const r = p.asker.answer(list, 0, list[0].view.options.findIndex((o) => !o.right));
  assert.equal(r.right, false);
  assert.equal(r.pts, 0);
  assert.equal(r.answer, list[0].view.answer);
  assert.equal(JSON.parse(p.storage.getItem('review_v1')).items[key('life-lab', q)].box, 1);
  assert.equal(p.storage.getItem('lifelab_points_v1'), null);
});

test('nothing due: nothing is loaded and nothing is asked', async () => {
  const p = page({}, { 'life-lab': lessons('life-lab') });
  assert.deepEqual(await p.asker.pick(['life-lab']), []);
  assert.deepEqual(p.loaded, []);
  assert.equal(p.asker.supported('math-mastery'), false);
  assert.deepEqual(await p.asker.pick(['math-mastery']), []);
});

test('a lesson file that fails: the pick fails when nothing loaded, and skips that game when another loaded', async () => {
  const [q] = questions('life-lab', 1);
  const [r] = questions('page-turners', 1);
  const items = { [key('life-lab', q)]: due(2), [key('page-turners', r)]: due(2) };
  await assert.rejects(page(items, {}).asker.pick(['life-lab']));
  const list = await page(items, { 'life-lab': lessons('life-lab') }).asker.pick(['life-lab', 'page-turners']);
  assert.deepEqual(list.map((x) => x.app), ['life-lab']);
});

test('Professor Hoot asks up to 3, taking turns across the subjects with the most due first', async () => {
  const life = questions('life-lab', 3);
  const page2 = questions('page-turners', 2);
  const items = {};
  life.forEach((q) => { items[key('life-lab', q)] = due(2); });
  page2.forEach((q) => { items[key('page-turners', q)] = due(2); });
  const p = page(items, { 'life-lab': lessons('life-lab'), 'page-turners': lessons('page-turners') });
  assert.deepEqual(p.asker.dueApps(), ['life-lab', 'page-turners']);
  const list = await p.asker.pick(p.asker.dueApps(), 3);
  assert.deepEqual(list.map((x) => x.app), ['life-lab', 'page-turners', 'life-lab']);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-ask.test.js`
Expected: FAIL with "Cannot find module …ask.js".

- [ ] **Step 3: Create `web/world/ask.js`**

```js
/* ❓ Ask me! in the world. pick() finds her due review questions in a subject's own lesson files (loaded when she asks);
   answer() scores through the game's engines: StudyKit.start with the game's keys, then Recall moves the box and
   StudyKit pays points, the gap bonus and the streak, exactly like a review round in the game. Each conversation is
   one review quiz in her study history, never finished, so quests do not tick from the world. */
(function (root) {
  'use strict';
  var LIMIT = 3;

  // o = { win, files (LessonFiles), quiz (World3D.Quiz), load(app) → Promise<lessons>, textOf, title, rand }
  function create(o) {
    var win = o.win, Q = o.quiz, sessions = {};

    function supported(app) { return Q.supports(app) && !!o.files[app]; }
    function dueOf(app) { return win.Recall.dueCount(app); }

    // Subjects with due questions the world can ask, most due first.
    function dueApps() {
      var due = win.Recall.dueByApp();
      return Object.keys(due).filter(function (a) { return due[a] > 0 && supported(a); })
        .sort(function (a, b) { return due[b] - due[a] || (a < b ? -1 : 1); });
    }

    function pickFrom(app, lessons, limit) {
      var items = [];
      lessons.forEach(function (l) {
        (l.quiz || []).forEach(function (it) { if (Q.askable(app, l, it)) items.push(it); });
      });
      return win.Recall.pickDue(app, items, function (it) { return Q.info(app, it, o.textOf); }, limit)
        .map(function (it) { return { app: app, item: it, view: Q.view(app, it, o.textOf, o.rand) }; });
    }

    // Resolves [] when nothing is due; rejects when no subject's lesson files would load.
    function pick(apps, limit) {
      limit = limit || LIMIT;
      apps = apps.filter(function (a) { return supported(a) && dueOf(a) > 0; });
      if (!apps.length) return Promise.resolve([]);
      var lists = [], failed = 0;
      return apps.reduce(function (p, app) {
        return p.then(function () {
          return o.load(app).then(function (lessons) { lists.push(pickFrom(app, lessons, limit)); }, function () { failed++; });
        });
      }, Promise.resolve()).then(function () {
        if (failed === apps.length) throw new Error('No lesson files loaded');
        var out = [];
        for (var i = 0; out.length < limit && lists.some(function (l) { return l.length > i; }); i++) {
          lists.forEach(function (l) { if (l[i] && out.length < limit) out.push(l[i]); });
        }
        return out;
      });
    }

    function session(app, list) {
      if (!sessions[app]) {
        var f = o.files[app], SH = win.StudyHistory;
        var n = list.filter(function (q) { return q.app === app; }).length;
        var kit = win.StudyKit.start({ app: app, title: f.title, pointsKey: f.pointsKey, progressKey: f.progressKey });
        kit.startRound();
        sessions[app] = { kit: kit, hist: SH && SH.quizStarted ? SH.quizStarted(app, f.title, 'review', o.title, false, n, 'review') : null };
      }
      return sessions[app];
    }

    // j indexes list[i].view.options.
    function answer(list, i, j) {
      var q = list[i], opt = q.view.options[j], R = win.Recall, SH = win.StudyHistory;
      var s = session(q.app, list), info = Q.info(q.app, q.item, o.textOf), right = !!opt.right;
      R.begin(list, R.keyOf(q.app, info));
      if (SH && s.hist) SH.quizAnswered(s.hist, right, info.historyQ, opt.history, info.historyAnswer, false);
      var pts = s.kit.answer(right, { helped: false, shield: false });
      R.clear();
      return { right: right, pts: pts, answer: q.view.answer, why: opt.why || '', explain: q.view.explain, good: q.view.good };
    }

    return { pick: pick, answer: answer, dueApps: dueApps, supported: supported, end: function () { sessions = {}; } };
  }

  // Loads a game's lesson scripts once, one game at a time, catching what they hand to StudyKit.lesson.
  function loader(win, files) {
    var doc = win.document, cache = {}, queue = Promise.resolve();
    function script(src) {
      return new Promise(function (ok, fail) {
        var s = doc.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = fail;
        doc.head.appendChild(s);
      });
    }
    return function load(app) {
      if (cache[app]) return cache[app];
      var f = files[app];
      if (!f) return Promise.reject(new Error('No lesson files for ' + app));
      var job = queue.then(function () {
        var got = [], kit = win.StudyKit, keep = kit.lesson;
        kit.lesson = function (l) { got.push(l); };
        return f.files.reduce(function (p, file) { return p.then(function () { return script(f.dir + file); }); }, Promise.resolve())
          .then(function () { kit.lesson = keep; return got; }, function (e) { kit.lesson = keep; throw e; });
      });
      queue = job.catch(function () {});
      cache[app] = job.catch(function (e) { delete cache[app]; throw e; });
      return cache[app];
    };
  }

  var exported = { create: create, loader: loader, LIMIT: LIMIT };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Ask = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-ask.test.js`
Expected: PASS. If "box-2 gap bonus" gives another number, check `GAP_BONUS` in `web/engine/recall.js` (index 2 is 4) and that the streak is 1 (no streak bonus).

- [ ] **Step 5: Precache and stage**

Run: `node tools/update-precache.js`

```bash
git add web/world/ask.js tests/world3d-ask.test.js web/sw.js
```

---

### Task 7: Where the characters stand (`layout.js`)

Buddies stand on the street side beside their door, 3.6 toward the plaza. Hoot sits on a bench in Whispering Park facing north, toward where quick travel drops her. Bunny stands just in front of the shop wall beside the counter. The park's 6 ring trees and 2 new ones talk.

**Files:**
- Modify: `web/world/layout.js`
- Test: `tests/world3d-layout.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/world3d-layout.test.js`:

```js
for (const grade of ['grade5', 'grade2']) {
  test(grade + ': a buddy stands beside every door, off the street and out of the doorway', () => {
    const b = L.buddies(grade);
    assert.deepEqual(b.map((x) => x.app), L.buildings(grade).map((x) => x.app));
    const items = L.interactables(grade);
    for (const x of b) {
      assert.ok(Math.abs(x.x) - 0.8 > L.STREET.half, x.app + ' is on the street');
      const door = L.buildings(grade).find((d) => d.app === x.app).door;
      assert.equal(L.nearest(items, door.x, door.z).id, x.app, 'the door mat still finds the door');
      assert.equal(L.nearest(items, x.x, x.z + 2).id, 'buddy:' + x.app, 'in front of the buddy finds the buddy');
    }
  });

  test(grade + ': Hoot, Bunny\'s counter and 8 talking trees in the park can be talked to', () => {
    const ids = L.interactables(grade).map((i) => i.id);
    for (const id of ['hoot', 'counter']) assert.ok(ids.includes(id), id);
    const t = L.talkTrees(grade);
    assert.deepEqual(t.map((x) => x.talk), [0, 1, 2, 3, 4, 5, 6, 7]);
    const park = L.places(grade).park;
    for (const x of t) {
      assert.ok(Math.hypot(x.x - park.x, x.z - park.z) <= 13, 'tree ' + x.talk + ' is in the park');
      assert.ok(ids.includes('tree:' + x.talk));
    }
  });
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world3d-layout.test.js`
Expected: FAIL with "L.buddies is not a function".

- [ ] **Step 3: Change `layout.js`**

Find:

```js
  var DOOR_R = 2.6;
```

Replace with:

```js
  var DOOR_R = 2.6;
  var BUDDY_AHEAD = 3.6;
  // Two more talking trees inside Whispering Park, besides its ring of six.
  var TALK_TREES = [[-44, 54], [-60, 42]];
```

In `props()`, find:

```js
      mimi: { x: 6.5, z: -6, r: 0.8 },
```

Replace with:

```js
      mimi: { x: 6.5, z: -6, r: 0.8 },
      hoot: { x: -50, z: 52.5, hx: 1.7, hz: 0.7 },
      bunny: { x: 62.6, z: 4.4 },
```

Find the whole `trees` function:

```js
  // Border trees, a ring in the park and four in the garden. c indexes the tree colours in build.js.
  function trees(grade) {
    var b = GRADES[grade].bounds, out = [], i = 0;
    function push(x, z) { out.push({ x: x, z: z, s: 0.85 + (i % 3) * 0.2, c: i % 4 }); i++; }
    for (var x = b.minX + 4; x <= b.maxX - 4; x += 9) {
      if (Math.abs(x) > 14) { push(x, b.minZ + 4); push(x, b.maxZ - 4); }
    }
    for (var z = b.minZ + 13; z <= b.maxZ - 13; z += 9) { push(b.minX + 4, z); push(b.maxX - 4, z); }
    var park = PLACES.park, garden = PLACES.garden;
    for (var k = 0; k < 6; k++) push(park.x + 12 * Math.cos(k * Math.PI / 3), park.z + 12 * Math.sin(k * Math.PI / 3));
    for (k = 0; k < 4; k++) push(garden.x + 11 * Math.cos(Math.PI / 4 + k * Math.PI / 2), garden.z + 11 * Math.sin(Math.PI / 4 + k * Math.PI / 2));
    return out;
  }
```

Replace with:

```js
  // Border trees, a ring in the park, four in the garden and two more in the park. c indexes the tree colours in
  // build.js; talk numbers the park's talking trees (0-7).
  function trees(grade) {
    var b = GRADES[grade].bounds, out = [], i = 0;
    function push(x, z, talk) {
      var t = { x: x, z: z, s: 0.85 + (i % 3) * 0.2, c: i % 4 };
      if (talk !== undefined) t.talk = talk;
      out.push(t);
      i++;
    }
    for (var x = b.minX + 4; x <= b.maxX - 4; x += 9) {
      if (Math.abs(x) > 14) { push(x, b.minZ + 4); push(x, b.maxZ - 4); }
    }
    for (var z = b.minZ + 13; z <= b.maxZ - 13; z += 9) { push(b.minX + 4, z); push(b.maxX - 4, z); }
    var park = PLACES.park, garden = PLACES.garden;
    for (var k = 0; k < 6; k++) push(park.x + 12 * Math.cos(k * Math.PI / 3), park.z + 12 * Math.sin(k * Math.PI / 3), k);
    for (k = 0; k < 4; k++) push(garden.x + 11 * Math.cos(Math.PI / 4 + k * Math.PI / 2), garden.z + 11 * Math.sin(Math.PI / 4 + k * Math.PI / 2));
    TALK_TREES.forEach(function (p, j) { push(p[0], p[1], 6 + j); });
    return out;
  }

  function talkTrees(grade) { return trees(grade).filter(function (t) { return t.talk !== undefined; }); }

  // Each subject buddy stands beside its door on the street side, a little toward the plaza, facing the street.
  function buddies(grade) {
    return buildings(grade).map(function (b) { return { app: b.app, x: b.door.x, z: b.z + BUDDY_AHEAD, face: b.rot }; });
  }
```

In `obstacles()`, find:

```js
      .concat([pr.bench, pr.shop, pr.house, pr.slide, pr.swings, pr.seesaw]);
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mimi, pr.mirror, pr.pond, pr.merry].concat(pr.posts,
      trees(grade).map(function (t) { return { x: t.x, z: t.z, r: 1.1 * t.s }; }));
```

Replace with:

```js
      .concat([pr.bench, pr.shop, pr.house, pr.slide, pr.swings, pr.seesaw, pr.hoot]);
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mimi, pr.mirror, pr.pond, pr.merry].concat(pr.posts,
      trees(grade).map(function (t) { return { x: t.x, z: t.z, r: 1.1 * t.s }; }),
      buddies(grade).map(function (b) { return { x: b.x, z: b.z, r: 0.8 }; }));
```

In `interactables()`, find:

```js
    list.push({ kind: 'fort', id: 'fort', x: pr.fort.x, z: pr.fort.z + pr.fort.r + 2, r: 3 });
    return list;
```

Replace with:

```js
    list.push({ kind: 'fort', id: 'fort', x: pr.fort.x, z: pr.fort.z + pr.fort.r + 2, r: 3 });
    buddies(grade).forEach(function (b) { list.push({ kind: 'buddy', id: 'buddy:' + b.app, app: b.app, x: b.x, z: b.z, r: 2.4 }); });
    list.push({ kind: 'hoot', id: 'hoot', x: pr.hoot.x, z: pr.hoot.z - pr.hoot.hz - 1.6, r: 2.6 });
    talkTrees(grade).forEach(function (t) { list.push({ kind: 'tree', id: 'tree:' + t.talk, tree: t.talk, x: t.x, z: t.z, r: 1.1 * t.s + 2.2 }); });
    return list;
```

In `exported`, find:

```js
    gradeOf: gradeOf, places: places, props: props, buildings: buildings, paths: paths, onPath: onPath, trees: trees,
```

Replace with:

```js
    gradeOf: gradeOf, places: places, props: props, buildings: buildings, paths: paths, onPath: onPath, trees: trees,
    talkTrees: talkTrees, buddies: buddies,
```

- [ ] **Step 4: Run the layout tests**

Run: `node --test tests/world3d-layout.test.js`
Expected: PASS, including the older "every place, door, mirror and signpost can be walked to" (it now also walks to every buddy, Hoot and tree) and "every trail … stays in the open".

- [ ] **Step 5: Stage**

```bash
git add web/world/layout.js tests/world3d-layout.test.js
```

---

### Task 8: What buddies know about each subject (`progress.js`)

**Files:**
- Modify: `web/world/progress.js`
- Test: `tests/world3d-progress.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/world3d-progress.test.js`:

```js
test('snapshot info: each subject\'s boss stage, quest, due count and medal tally, before markers are cut to two', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    tally: (app) => (app === 'life-lab' ? { gold: 1, silver: 1, bronze: 0, total: 2 } : null),
    due: () => ({ 'life-lab': 4 }),
    quests: () => [{ app: 'life-lab', done: false }, { app: 'page-turners', done: true }],
    boss: () => ({ stages: [{ app: 'life-lab', cleared: false }] }),
  }) });
  assert.deepEqual(s.info['life-lab'], { boss: true, quest: true, due: 4, tally: { gold: 1, silver: 1, bronze: 0, total: 2 } });
  assert.deepEqual(s.info['page-turners'], { boss: false, quest: false, due: 0, tally: null });
  assert.equal(s.apps['life-lab'].markers.length, 2, 'the map still shows two markers');
});

test('points reads each subject\'s stored points', () => {
  const store = { getItem: (k) => ({ a: '30', b: 'x' })[k] ?? null };
  assert.deepEqual(P.points(store, ['a', 'b', 'c']), { a: 30, b: 0, c: 0 });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world3d-progress.test.js`
Expected: FAIL ("Cannot read properties of undefined (reading 'life-lab')" and "P.points is not a function").

- [ ] **Step 3: Change `progress.js`**

Find:

```js
    var next = stages.filter(function (s) { return s && s.cleared !== true && apps.indexOf(s.app) >= 0; })[0];
    return {
      apps: st.apps,
```

Replace with:

```js
    var next = stages.filter(function (s) { return s && s.cleared !== true && apps.indexOf(s.app) >= 0; })[0];
    var due = safe(function () { return o.deps.due(); }, {}), quests = safe(function () { return o.deps.quests(); }, []);
    var info = {};
    apps.forEach(function (app) {
      info[app] = {
        boss: stages.some(function (s) { return s && s.app === app && s.cleared !== true; }),
        quest: Array.isArray(quests) && quests.some(function (q) { return q && q.app === app && q.done !== true; }),
        due: Math.max(0, Math.floor(Number(due[app])) || 0),
        tally: st.apps[app] ? st.apps[app].tally : null
      };
    });
    return {
      apps: st.apps,
      info: info,
```

Find:

```js
  // Like the lobby shop's canAfford, from each subject's stored points.
  function canAfford(wallet, storage, keys) {
    if (!wallet || !wallet.catalog || !wallet.canBuy) return false;
    var points = {};
    keys.forEach(function (k) { points[k] = safe(function () { return parseInt(storage.getItem(k), 10) || 0; }, 0); });
    return wallet.catalog.some(function (item) { return safe(function () { return wallet.canBuy(item.id, points).ok === true; }, false); });
  }
```

Replace with:

```js
  function points(storage, keys) {
    var out = {};
    keys.forEach(function (k) { out[k] = safe(function () { return parseInt(storage.getItem(k), 10) || 0; }, 0); });
    return out;
  }

  // Like the lobby shop's canAfford, from each subject's stored points.
  function canAfford(wallet, storage, keys) {
    if (!wallet || !wallet.catalog || !wallet.canBuy) return false;
    var p = points(storage, keys);
    return wallet.catalog.some(function (item) { return safe(function () { return wallet.canBuy(item.id, p).ok === true; }, false); });
  }
```

Find:

```js
  var exported = { cards: cards, snapshot: snapshot, doorHref: doorHref, canAfford: canAfford, fill: fill };
```

Replace with:

```js
  var exported = { cards: cards, snapshot: snapshot, doorHref: doorHref, canAfford: canAfford, points: points, fill: fill };
```

Check `World.status` (in `web/engine/world.js`) returns `tally` for each app: it does (`out.apps[app] = { level, tally, markers }`). If `tallyOf` returns something other than `null` or `{ gold, silver, bronze, total }` for an unknown app, make the test's expected `tally` match what it returns and say so in the report.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-progress.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/world/progress.js tests/world3d-progress.test.js
```

---

### Task 9: Bubble helper line, answer buttons and confetti (`talk.js`, `world.css`, `build.js`)

**Files:**
- Modify: `web/world/talk.js`, `web/world/world.css`, `web/world/build.js`

- [ ] **Step 1: `talk.js` gains `sub` and `stack`**

Find:

```js
  // o = { doc, face, who, text, buttons: [{ text, main, onClick }], onClose }
```

Replace with:

```js
  // o = { doc, face, who, text, sub (a smaller second line), stack (buttons in a column, for answers),
  //       buttons: [{ text, main, onClick }], onClose }
```

Find:

```js
    box.appendChild(say);
    var row = el('div', 'talk-row');
```

Replace with:

```js
    box.appendChild(say);
    if (o.sub) box.appendChild(el('p', 'talk-sub', o.sub));
    var row = el('div', 'talk-row' + (o.stack ? ' stack' : ''));
```

Also change the file's first comment line from `Phase 3's characters use it too. */` (end of the header comment) so the header reads:

```js
/* The speech bubble for the world's characters: a face, a name, the words, and buttons. One bubble at a time; a button
   or Escape closes it (then runs that button's action). Questions use the helper line and a column of answers. */
```

- [ ] **Step 2: Styles**

In `web/world/world.css`, find:

```css
.talk-say { font-size: 21px; font-weight: 800; line-height: 1.3; margin: 6px 0 10px; }
```

Replace with:

```css
.talk-say { font-size: 21px; font-weight: 800; line-height: 1.3; margin: 6px 0 10px; white-space: pre-line; }
.talk-sub { font-size: 16px; font-weight: 600; line-height: 1.35; margin: -4px 0 12px; color: #7a4a86; white-space: pre-line;
  max-height: 28vh; overflow-y: auto; }
.talk-row.stack { flex-direction: column; align-items: stretch; }
.talk-row.stack .talk-btn { border-radius: 18px; padding: 10px 16px; line-height: 1.3; }
```

Find:

```css
  box-shadow: 0 6px 0 #f3b6d6, 0 14px 30px rgba(200,80,150,.25); z-index: 20; }
```

Replace with:

```css
  box-shadow: 0 6px 0 #f3b6d6, 0 14px 30px rgba(200,80,150,.25); z-index: 20; max-height: calc(100% - 90px); overflow-y: auto; }
```

- [ ] **Step 3: `build.js` gains `cheer(x, y, z)`**

Find:

```js
  var RAINBOW = ['#ff9aa2', '#ffdac1', '#fff5ba', '#b5ead7', '#c7ceea'];
```

Replace with:

```js
  var RAINBOW = ['#ff9aa2', '#ffdac1', '#fff5ba', '#b5ead7', '#c7ceea'];
  var CHEER = ['🎉', '⭐', '💖', '✨'];
```

Find:

```js
    function animate(t, dt, nearDoor) {
```

Replace with:

```js
    // A right answer: confetti bursts out and falls.
    function cheer(x, y, z) {
      for (var i = 0; i < 16; i++) {
        var a = i / 16 * Math.PI * 2, s = S.sprite(S.emoji(CHEER[i % CHEER.length]), 0.9, 0.9);
        s.position.set(x, y, z);
        S.scene.add(s);
        sparks.push({ s: s, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 3 + Math.random() * 2, g: 5, life: 1.6 });
      }
    }

    function animate(t, dt, nearDoor) {
```

Find:

```js
        p.life -= dt;
        p.s.position.y += p.vy * dt;
```

Replace with:

```js
        p.life -= dt;
        p.vy -= (p.g || 0) * dt;
        p.s.position.x += (p.vx || 0) * dt;
        p.s.position.z += (p.vz || 0) * dt;
        p.s.position.y += p.vy * dt;
```

Find:

```js
    return { animate: animate, sparkle: sparkle, buildings: parts, shop: shopGroup, fort: fortParts };
```

Replace with:

```js
    return { animate: animate, sparkle: sparkle, cheer: cheer, buildings: parts, shop: shopGroup, fort: fortParts };
```

- [ ] **Step 4: Run the unit tests**

Run: `node --test`
Expected: PASS (no test reads these files' code yet; this guards against typos breaking other tests). If a wiring test fails only because the new world files are not on the pages yet (Task 11 does that), note it in the report and go on.

- [ ] **Step 5: Stage**

```bash
git add web/world/talk.js web/world/world.css web/world/build.js
```

---

### Task 10: The characters in 3D (`cast.js`)

All characters face local +z and return `{ group, animate(t), dance() }`, like Mayor Mimi. Faces are drawn on a canvas on the front of a rounded head, as Mimi's is. `treeFace` returns `{ mesh, animate(t) }`.

**Files:**
- Modify: `web/world/cast.js`

- [ ] **Step 1: Update the header comment**

Find:

```js
/* The world's characters, each a group facing local +z with animate(t). Phase 2: Mayor Mimi, the cat in a purple coat
   and top hat who stands by the fountain and guides her. Phase 3 adds the subject buddies, Professor Hoot and Bunny. */
```

Replace with:

```js
/* The world's characters, each a group facing local +z with animate(t). Mayor Mimi, the cat in a purple coat and top
   hat who guides her; a buddy for each subject door (built from buddies.js looks), Professor Hoot on his park bench,
   Bunny the shopkeeper, and the faces of the talking trees. dance() is a happy hop and spin after a right answer. */
```

- [ ] **Step 2: Add the shared pieces after `var FUR = …` line**

Find:

```js
  var FUR = '#fff4e6', COAT = '#7b5cff', HAT = '#3a2a4f';
```

Replace with:

```js
  var FUR = '#fff4e6', COAT = '#7b5cff', HAT = '#3a2a4f';
  var DANCE = 1.2, INK = '#3a2a4f';

  // A face on a 256px canvas. o = { bg, eye, gap, eyeY, eyeColor, mouth: 'smile'|'beak'|'muzzle'|'none', glasses,
  // patches (panda), noEyes (frog: eyes sit on top of the head), closed (a blink) }
  function faceCanvas(o) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d'), er = o.eye || 22, gap = o.gap || 48, ey = o.eyeY || 116, ink = o.eyeColor || INK;
    if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, 256, 256); }
    [128 - gap, 128 + gap].forEach(function (ex) {
      if (o.patches) { x.fillStyle = '#2b2b2b'; x.beginPath(); x.ellipse(ex, ey + 4, er + 14, er + 18, ex < 128 ? 0.5 : -0.5, 0, 7); x.fill(); }
      if (o.noEyes) return;
      if (o.closed) {
        x.strokeStyle = ink; x.lineWidth = 7; x.lineCap = 'round';
        x.beginPath(); x.arc(ex, ey - er * 0.2, er * 0.8, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
      } else {
        x.fillStyle = ink; x.beginPath(); x.ellipse(ex, ey, er * 0.85, er, 0, 0, 7); x.fill();
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex + er * 0.3, ey - er * 0.4, er * 0.32, 0, 7); x.fill();
      }
      if (o.glasses) { x.strokeStyle = INK; x.lineWidth = 6; x.beginPath(); x.arc(ex, ey, er + 12, 0, 7); x.stroke(); }
    });
    if (o.glasses) { x.beginPath(); x.moveTo(128 - gap + er + 12, ey); x.lineTo(128 + gap - er - 12, ey); x.stroke(); }
    x.fillStyle = 'rgba(255,120,160,.45)';
    x.beginPath(); x.ellipse(128 - gap - 18, ey + 46, 18, 10, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(128 + gap + 18, ey + 46, 18, 10, 0, 0, 7); x.fill();
    var my = ey + 50;
    if (o.mouth === 'beak') {
      x.fillStyle = '#ff9e3d'; x.beginPath(); x.moveTo(110, my - 14); x.lineTo(146, my - 14); x.lineTo(128, my + 12); x.closePath(); x.fill();
    } else if (o.mouth !== 'none') {
      if (o.mouth === 'muzzle') { x.fillStyle = INK; x.beginPath(); x.ellipse(128, my - 12, 12, 8, 0, 0, 7); x.fill(); }
      x.strokeStyle = ink; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.arc(128, my - 4, 16, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    }
    return c;
  }

  // A rounded head with the face on its front.
  function head(S, color, face, w, h, d, r) {
    var THREE = S.THREE, hm = S.toon(color);
    var fm = new THREE.MeshToonMaterial({ map: S.canvasTexture(faceCanvas(Object.assign({ bg: color }, face))), gradientMap: S.ramp });
    var g = new THREE.Group();
    S.add(S.rbox(w, h, d, r), [hm, hm, hm, hm, fm, hm], 0, 0, 0, g);
    return g;
  }

  // A gentle idle bob and head tilt; dance() hops and spins once.
  function life(group, body, top, phase) {
    var from = null, pending = false, baseY = body.position.y;
    function animate(t) {
      if (pending) { from = t; pending = false; }
      var d = from === null ? -1 : t - from;
      if (d >= 0 && d < DANCE) {
        body.position.y = baseY + Math.abs(Math.sin(d * 9)) * 0.7;
        body.rotation.y = d / DANCE * Math.PI * 2;
      } else {
        from = null;
        body.position.y = baseY + Math.abs(Math.sin(t * 2 + phase)) * 0.08;
        body.rotation.y = 0;
      }
      top.rotation.z = Math.sin(t * 1.5 + phase) * 0.06;
    }
    return { group: group, animate: animate, dance: function () { pending = true; } };
  }

  var FACES = {
    kitten: { mouth: 'muzzle' }, worm: { glasses: true }, frog: { noEyes: true }, carabao: { mouth: 'muzzle', eye: 18 },
    tarsier: { eye: 36, gap: 50, eyeColor: '#5a3a2e' }, panda: { patches: true, mouth: 'muzzle', eye: 16 },
    puppy: { mouth: 'muzzle' }, hedgehog: { mouth: 'muzzle', eye: 18 }, robot: { bg: '#2b2140', eyeColor: '#7ff7ff', eye: 20 },
    bird: { mouth: 'beak' }, bear: { mouth: 'muzzle' }, mouse: { mouth: 'muzzle', eye: 20 }
  };

  // Held in the right hand; the hand is at y -0.75 in the arm group.
  var PROPS = {
    ruler: function (S, g) { S.add(S.rbox(0.28, 1.7, 0.07, 0.03), '#ffd166', 0, -0.5, 0.3, g); },
    book: function (S, g) {
      S.add(S.rbox(0.95, 1.15, 0.28, 0.06), '#6aa9ff', 0, -0.75, 0.35, g);
      S.add(S.rbox(0.85, 1.05, 0.3, 0.04), '#ffffff', 0.04, -0.75, 0.35, g);
    },
    tube: function (S, g) {
      S.add(S.cyl(0.17, 0.17, 1, 12), '#dff4ff', 0, -0.6, 0.35, g);
      S.add(S.cyl(0.14, 0.14, 0.5, 12), '#7fdc8b', 0, -0.83, 0.35, g);
    },
    pencil: function (S, g) {
      S.add(S.cyl(0.13, 0.13, 1.3, 6), '#ffd166', 0, -0.55, 0.35, g);
      S.add(S.cone(0.13, 0.3, 6), '#f6c9a0', 0, -1.35, 0.35, g).rotation.x = Math.PI;
      S.add(S.ball(0.14), '#ff8fab', 0, 0.12, 0.35, g);
    },
    heart: function (S, g) {
      [-0.17, 0.17].forEach(function (x) { S.add(S.ball(0.26), '#ff6f91', x, -0.6, 0.4, g); });
      S.add(S.cone(0.37, 0.5, 16), '#ff6f91', 0, -0.95, 0.4, g).rotation.x = Math.PI;
    },
    ball: function (S, g) { S.add(S.ball(0.45), '#ff9e6b', 0, -0.9, 0.4, g); S.add(S.ball(0.46), '#ffffff', 0, -0.9, 0.4, g).scale.set(1, 0.18, 1); },
    needle: function (S, g) {
      S.add(S.cyl(0.05, 0.05, 1.4, 6), '#cfd8e6', 0, -0.6, 0.35, g);
      S.add(S.ball(0.18), '#ff8fab', 0, -0.05, 0.35, g);
    },
    note: function (S, g) {
      S.add(S.ball(0.24), '#7b5cff', 0, -1, 0.4, g).scale.set(1.2, 0.9, 1);
      S.add(S.cyl(0.05, 0.05, 0.9, 6), '#7b5cff', 0.22, -0.55, 0.4, g);
      S.add(S.rbox(0.35, 0.15, 0.06, 0.03), '#7b5cff', 0.38, -0.15, 0.4, g);
    },
    block: function (S, g) { S.add(S.rbox(0.75, 0.75, 0.75, 0.15), '#ff7f7f', 0, -0.95, 0.4, g); },
    glass: function (S, g) {
      S.add(S.cyl(0.06, 0.06, 0.7, 6), '#a0785a', 0, -0.9, 0.4, g);
      var ring = S.add(S.cyl(0.4, 0.4, 0.08, 20), '#ffd166', 0, -0.25, 0.4, g);
      ring.rotation.x = Math.PI / 2;
      S.add(S.cyl(0.33, 0.33, 0.1, 20), '#dff4ff', 0, -0.25, 0.4, g).rotation.x = Math.PI / 2;
    },
    mouse: function (S, g) { S.add(S.rbox(0.55, 0.3, 0.85, 0.14), '#e4e9f2', 0, -0.95, 0.45, g); }
  };

  // Ears, horns, spikes, wings and hats. top = the head group, body = the body group.
  function extras(S, look, top, body) {
    var add = S.add, ball = S.ball, fur = look.fur, k = look.kind;
    function pair(fn) { [-1, 1].forEach(fn); }
    if (k === 'kitten') pair(function (s) {
      add(S.cone(0.38, 0.7, 4), fur, s * 0.65, 1.15, 0, top);
      add(S.cone(0.2, 0.4, 4), '#ffb3c7', s * 0.65, 1.1, 0.12, top);
    });
    if (k === 'bear' || k === 'panda') pair(function (s) { add(ball(0.38), k === 'panda' ? '#2b2b2b' : fur, s * 0.8, 1, 0, top); });
    if (k === 'mouse' || k === 'tarsier') pair(function (s) {
      add(S.cyl(0.62, 0.62, 0.16, 20), fur, s * 1.15, 0.75, 0, top).rotation.x = Math.PI / 2;
      add(S.cyl(0.42, 0.42, 0.18, 20), '#ffb3c7', s * 1.15, 0.75, 0.03, top).rotation.x = Math.PI / 2;
    });
    if (k === 'puppy') pair(function (s) { add(S.rbox(0.45, 1, 0.3, 0.2), '#b5835a', s * 1.15, 0.1, 0, top).rotation.z = s * 0.25; });
    if (k === 'carabao') pair(function (s) {
      add(S.cone(0.22, 1.1, 8), '#f2e6d0', s * 1.25, 0.75, 0, top).rotation.z = -s * 1.1;
      add(ball(0.25), fur, s * 1.1, 0.25, 0, top);
    });
    if (k === 'frog') pair(function (s) {
      add(ball(0.42), fur, s * 0.55, 1.05, 0.2, top);
      add(ball(0.26), '#ffffff', s * 0.55, 1.1, 0.5, top);
      add(ball(0.14), INK, s * 0.55, 1.12, 0.7, top);
    });
    if (k === 'worm') pair(function (s) {
      add(S.cyl(0.05, 0.05, 0.8, 6), INK, s * 0.45, 1.3, 0, top);
      add(ball(0.18), '#ffd166', s * 0.45, 1.75, 0, top);
    });
    if (k === 'robot') {
      add(S.cyl(0.05, 0.05, 0.8, 6), INK, 0, 1.3, 0, top);
      add(ball(0.18), '#ff6f91', 0, 1.75, 0, top);
    }
    if (k === 'hedgehog') {
      for (var i = 0; i < 9; i++) {
        var a = (i - 4) * 0.33;
        add(S.cone(0.25, 0.8, 6), look.spikes, Math.sin(a), 0.5 + Math.cos(a) * 0.5, -0.6, top).rotation.set(-0.9, 0, -a);
      }
    }
    if (k === 'bird') {
      pair(function (s) { add(ball(0.5), fur, s * 0.95, 1.15, 0, body).scale.set(0.4, 0.9, 0.8); });
      add(S.cone(0.15, 0.5, 6), '#ff9e3d', 0, 1.1, 0, top);
    }
    if (look.hat === 'salakot') add(S.cone(1.6, 0.7, 16), '#e7b58c', 0, 1.25, 0, top);
    if (look.hat === 'cap') {
      add(S.cyl(0.95, 1, 0.55, 20), '#3a5fcd', 0, 1.1, 0, top);
      add(S.cyl(0.6, 0.6, 0.08, 20), '#2b2140', 0, 0.85, 0.75, top);
      add(ball(0.15), '#ffd166', 0, 1.15, 0.92, top);
    }
  }
```

- [ ] **Step 3: Add the characters before `W.Cast = …`**

Find:

```js
  W.Cast = { mimi: mimi };
```

Replace with:

```js
  // look = { kind, fur, belly, prop, hat, spikes } from buddies.js
  function buddy(S, look) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, k = look.kind, fur = look.fur, belly = look.belly || '#fff4e6';
    var worm = k === 'worm', robot = k === 'robot';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    if (worm) {
      for (var i = 0; i < 3; i++) add(S.ball(0.75 - i * 0.12), i % 2 ? belly : fur, 0, 0.7 - i * 0.05, -0.6 - i * 0.85, body);
    } else {
      add(rbox(1.6, 1.5, 1.3, robot ? 0.2 : 0.55), fur, 0, 1.15, 0, body);
      add(rbox(1, 0.95, 0.2, robot ? 0.1 : 0.35), belly, 0, 1.1, 0.6, body);
      [-0.42, 0.42].forEach(function (x) { add(rbox(0.55, 0.45, 0.7, 0.2), fur, x, 0.22, 0.05, body); });
      add(rbox(0.38, 0.8, 0.38, 0.17), fur, -0.95, 1.3, 0.1, body);
    }
    var top = head(S, fur, FACES[k], 2.1, 1.85, 1.75, robot ? 0.3 : 0.75);
    top.position.y = worm ? 2.05 : 2.85;
    body.add(top);
    extras(S, look, top, body);
    var arm = new THREE.Group();
    arm.position.set(0.95, worm ? 1.2 : 1.75, 0.15);
    body.add(arm);
    add(rbox(0.38, 0.8, 0.38, 0.17), fur, 0, -0.35, 0, arm);
    if (look.prop && PROPS[look.prop]) PROPS[look.prop](S, arm);
    return life(group, body, top, fur.charCodeAt(1) % 6);
  }

  // Professor Hoot sits on his own bench; the group stands where the bench is.
  function hoot(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, BROWN = '#a0785a', DARK = '#86624a';
    var group = new THREE.Group(), body = new THREE.Group();
    add(rbox(3.2, 0.3, 1.2, 0.12), '#e7b58c', 0, 1, 0, group);
    add(rbox(3.2, 1, 0.25, 0.1), '#e7b58c', 0, 1.7, -0.5, group);
    [-1.3, 1.3].forEach(function (x) { add(rbox(0.25, 0.9, 1, 0.08), '#c98f62', x, 0.45, 0, group); });
    body.position.y = 1.15;
    group.add(body);
    add(S.ball(0.9), BROWN, 0, 0.85, 0, body).scale.set(1, 1.05, 0.9);
    add(S.ball(0.6), '#f1dcc4', 0, 0.8, 0.45, body).scale.set(1, 1.1, 0.5);
    [-1, 1].forEach(function (s) { add(S.ball(0.5), DARK, s * 0.85, 0.85, 0, body).scale.set(0.45, 1, 0.9); });
    var top = head(S, BROWN, { eye: 34, gap: 48, mouth: 'beak', glasses: true }, 2, 1.6, 1.6, 0.7);
    top.position.y = 2.25;
    body.add(top);
    [-1, 1].forEach(function (s) { add(S.cone(0.25, 0.6, 4), DARK, s * 0.75, 1, 0, top).rotation.z = -s * 0.3; });
    add(rbox(1.9, 0.12, 1.9, 0.04), '#2b2140', 0, 1.05, 0, top).rotation.y = Math.PI / 4;
    add(S.cyl(0.55, 0.55, 0.35, 16), '#2b2140', 0, 0.9, 0, top);
    add(S.ball(0.13), '#ffd166', 0.8, 0.85, 0.3, top);
    return life(group, body, top, 1.3);
  }

  function bunny(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, WHITE = '#ffffff';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(rbox(1.5, 1.5, 1.2, 0.55), WHITE, 0, 1.15, 0, body);
    add(rbox(1.1, 1.1, 0.15, 0.1), '#ff8fab', 0, 1, 0.6, body);
    add(S.ball(0.3), WHITE, 0, 0.9, -0.65, body);
    var top = head(S, WHITE, { mouth: 'muzzle', eyeColor: '#7b3a5a' }, 2, 1.8, 1.7, 0.75);
    top.position.y = 2.8;
    body.add(top);
    [-1, 1].forEach(function (s) {
      add(rbox(0.45, 1.7, 0.3, 0.2), WHITE, s * 0.45, 1.65, 0, top).rotation.z = -s * 0.12;
      add(rbox(0.25, 1.3, 0.1, 0.1), '#ffb3c7', s * 0.45, 1.6, 0.13, top).rotation.z = -s * 0.12;
    });
    return life(group, body, top, 2.1);
  }

  // A talking tree's face on the side of its crown that looks at the park's middle; it blinks now and then.
  function treeFace(S, t, center) {
    var THREE = S.THREE;
    if (!S.treeFaces) {
      S.treeFaces = [false, true].map(function (closed) {
        return S.canvasTexture(faceCanvas({ eye: 18, gap: 40, mouth: 'smile', eyeColor: '#3f6b3a', closed: closed }));
      });
    }
    var tex = S.treeFaces, mat = new THREE.MeshBasicMaterial({ map: tex[0], transparent: true, depthWrite: false });
    var size = 1.9 * t.s, mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    var dx = center.x - t.x, dz = center.z - t.z, d = Math.hypot(dx, dz) || 1;
    mesh.position.set(t.x + dx / d * 1.95 * t.s, 3.5 * t.s, t.z + dz / d * 1.95 * t.s);
    mesh.rotation.y = Math.atan2(dx, dz);
    var phase = (t.talk || 0) * 1.7;
    return { mesh: mesh, animate: function (time) { mat.map = (time + phase) % 4 < 0.15 ? tex[1] : tex[0]; } };
  }

  W.Cast = { mimi: mimi, buddy: buddy, hoot: hoot, bunny: bunny, treeFace: treeFace };
```

The last argument of `life()` only staggers the idle bob so the buddies do not bob in step.

- [ ] **Step 4: Check every kind and prop is built**

Run: `node -e "const B=require('./web/world/buddies.js');const s=require('fs').readFileSync('web/world/cast.js','utf8');for(const k of B.KINDS)if(!s.includes(k+':'))console.log('no face for',k);for(const p of B.PROPS)if(!s.includes(p+': function'))console.log('no prop',p);console.log('checked')"`
Expected: only `checked`.

- [ ] **Step 5: Stage**

```bash
git add web/world/cast.js
```

---

### Task 11: The Phase 3 controller (`folk.js`) and the wiring

**Files:**
- Create: `web/world/folk.js`
- Modify: `web/world/town.js`, `web/world/world-main.js`, `web/world/grade-5.html`, `web/world/grade-2.html`, `tests/paths.js`, `web/sw.js` (regenerated)

- [ ] **Step 1: Update the wiring lists (the wiring test fails first)**

In `tests/paths.js`, find:

```js
const WORLD_FILES = ['text.js', 'layout.js', 'look.js', 'prefs.js', 'walk.js', 'music.js', 'progress.js', 'scene.js', 'build.js', 'decor.js', 'cast.js', 'talk.js', 'avatar.js', 'move.js', 'maker.js', 'town.js', 'world-main.js'];
```

Replace with:

```js
const WORLD_FILES = ['text.js', 'layout.js', 'look.js', 'prefs.js', 'walk.js', 'music.js', 'progress.js', 'buddies.js', 'lines.js', 'chat.js', 'quiz.js', 'lesson-files.js', 'scene.js', 'build.js', 'decor.js', 'cast.js', 'talk.js', 'ask.js', 'avatar.js', 'move.js', 'maker.js', 'town.js', 'folk.js', 'world-main.js'];
```

Find:

```js
const WORLD_ENGINES = ['storage', 'learner', 'clock', 'study-history', 'recall', 'mastery', 'wallet', 'quests', 'boss', 'guide', 'world', 'subjects', 'fx'];
```

Replace with:

```js
// study-kit scores ❓ Ask me! answers the way the games do (and catches the lesson files ask.js loads).
const WORLD_ENGINES = ['storage', 'learner', 'clock', 'study-history', 'recall', 'mastery', 'wallet', 'quests', 'boss', 'guide', 'world', 'subjects', 'fx', 'study-kit'];
```

Run: `node --test tests/world3d-wiring.test.js`
Expected: FAIL ("world grade 5 loads its scripts in order" and "every world script is a file in web/world" for `folk.js`).

- [ ] **Step 2: Load the new scripts in both world pages**

In `web/world/grade-5.html`, find:

```html
<script src="../engine/fx.js" data-grade="grade5"></script>
```

Replace with:

```html
<script src="../engine/fx.js" data-grade="grade5"></script>
<script src="../engine/study-kit.js" data-grade="grade5"></script>
```

Find:

```html
<script src="progress.js"></script>
<script src="scene.js"></script>
```

Replace with:

```html
<script src="progress.js"></script>
<script src="buddies.js"></script>
<script src="lines.js"></script>
<script src="chat.js"></script>
<script src="quiz.js"></script>
<script src="lesson-files.js"></script>
<script src="scene.js"></script>
```

Find:

```html
<script src="talk.js"></script>
<script src="avatar.js"></script>
```

Replace with:

```html
<script src="talk.js"></script>
<script src="ask.js"></script>
<script src="avatar.js"></script>
```

Find:

```html
<script src="town.js"></script>
<script src="world-main.js"></script>
```

Replace with:

```html
<script src="town.js"></script>
<script src="folk.js"></script>
<script src="world-main.js"></script>
```

Make the same four changes in `web/world/grade-2.html`, with `data-grade="grade2"` on the study-kit line.

- [ ] **Step 3: Create `web/world/folk.js`**

```js
/* Phase 3 of the world: the characters who talk. A buddy by every subject door, Professor Hoot on his park bench, Bunny
   by the shop counter and the talking trees of Whispering Park. What they say comes from her progress (chat.js);
   ❓ Ask me! asks her due review questions through ask.js, scored like a review round in the game. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { S, grade, T, store, today(), busy(on), door(app, kind) → href, open(app, href), shop(), cheer(x, z), changed(), textOf(html) }
  function create(o) {
    var L = W.Layout, P = W.Progress, C = W.Chat, S = o.S, T = o.T, grade = o.grade, doc = root.document;
    var LT = W.Lines.TEXT[grade], who = W.Buddies.BUDDIES[grade];
    var subjects = root.Subjects, n = grade === 'grade2' ? 2 : 5, names = {};
    P.cards(grade, L, subjects).forEach(function (c) { names[c.app] = c.name; });
    var keys = ((subjects && subjects[n]) || []).map(function (s) { return s.pointsKey; });
    var pr = L.props(grade), park = L.places(grade).park;
    var asker = W.Ask.create({
      win: root, files: W.LessonFiles, quiz: W.Quiz, load: W.Ask.loader(root, W.LessonFiles), textOf: o.textOf, title: T.askTitle
    });

    function place(c, x, z, face) {
      c.group.position.set(x, 0, z);
      c.group.rotation.y = face;
      S.scene.add(c.group);
      return c;
    }

    var buddies = {};
    L.buddies(grade).forEach(function (b) {
      var w = who[b.app];
      buddies[b.app] = { face: w.face, name: w.name, char: place(W.Cast.buddy(S, w.look), b.x, b.z, b.face), x: b.x, z: b.z };
    });
    var hoot = { face: '🦉', name: T.hoot, char: place(W.Cast.hoot(S), pr.hoot.x, pr.hoot.z, Math.PI), x: pr.hoot.x, z: pr.hoot.z };
    var bunny = { face: '🐰', name: T.bunny, char: place(W.Cast.bunny(S), pr.bunny.x, pr.bunny.z, -Math.PI / 2), x: pr.bunny.x, z: pr.bunny.z };
    var tree = { face: '🌳', name: T.tree };
    var faces = L.talkTrees(grade).map(function (t) {
      var f = W.Cast.treeFace(S, t, park);
      S.scene.add(f.mesh);
      return f;
    });

    var snap = null, talk = null, conv = 0;

    function english(s) { return String(s).split(' · ').pop(); }
    function dueOf(app) { return root.Recall && root.Recall.dueCount ? root.Recall.dueCount(app) : 0; }

    function say(ch, text, buttons, sub, stack, onClose) {
      if (talk) talk.close();
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: ch.face, who: ch.name, text: text, sub: sub, stack: stack, buttons: buttons,
        onClose: function () {
          if (talk === mine) { talk = null; o.busy(false); }
          if (onClose) onClose();
        }
      });
    }

    // Lines she can walk through with 💬 More, then the character's own buttons, then 👋 Bye.
    function chat(ch, lines, extra) {
      var i = 0;
      function show() {
        var buttons = lines.length > 1 ? [{ text: T.more, onClick: function () { i = (i + 1) % lines.length; show(); } }] : [];
        say(ch, lines[i], buttons.concat(extra, [{ text: T.bye }]));
      }
      show();
    }

    function lastPlayed(app) {
      var last = null;
      try {
        var SH = root.StudyHistory;
        (SH && SH.list ? SH.list() : []).forEach(function (e) {
          if (e && e.app === app && typeof e.t === 'number' && (last === null || e.t > last)) last = e.t;
        });
      } catch (e) {}
      return last;
    }

    function doorButton(app) {
      return { text: '📖 ' + T.go.replace('{name}', english(names[app])), main: true, onClick: function () { o.open(app, o.door(app)); } };
    }

    function openBuddy(app) {
      var ch = buddies[app], info = (snap && snap.info && snap.info[app]) || {};
      var lines = C.buddyLines(grade, { boss: info.boss, quest: info.quest, due: info.due || 0, tally: info.tally, lastT: lastPlayed(app) },
        { now: Date.now(), subject: names[app], hi: who[app].hi, inGame: !asker.supported(app) });
      var extra = [];
      if (asker.supported(app)) extra.push({ text: T.ask, main: true, onClick: function () { ask([app], ch, app); } });
      else if (info.due > 0) extra.push({ text: T.reviewGame, main: true, onClick: function () { o.open(app, o.door(app, 'review')); } });
      chat(ch, lines, extra);
    }

    function openHoot() {
      var apps = asker.dueApps(), due = apps.reduce(function (s, a) { return s + dueOf(a); }, 0);
      chat(hoot, [due ? LT.hoot.hello(due) : LT.hoot.none].concat(LT.hoot.wise),
        due ? [{ text: T.ask, main: true, onClick: function () { ask(apps, hoot, null); } }] : []);
    }

    function openBunny() {
      var shelf = [];
      try { if (root.Wallet && root.Wallet.shelf) shelf = root.Wallet.shelf(P.points(o.store, keys)); } catch (e) {}
      chat(bunny, [C.bunnyLine(grade, shelf)].concat(LT.bunny.tips), [{ text: T.counter, main: true, onClick: o.shop }]);
    }

    function openTree(id) {
      var k = 0;
      function show() { say(tree, C.quote(grade, id, o.today(), k), [{ text: T.more, onClick: function () { k++; show(); } }, { text: T.bye }]); }
      show();
    }

    // app: the buddy's subject (its door is offered when the questions stay in the game); null for Hoot.
    function ask(apps, ch, app) {
      var token = ++conv;
      asker.end();
      say(ch, LT.thinking, [{ text: T.bye }], '', false, function () { if (token === conv) conv++; });
      asker.pick(apps).then(function (list) {
        if (token !== conv) return;
        if (list.length) return question(list, 0, ch, app);
        var due = apps.reduce(function (s, a) { return s + dueOf(a); }, 0);
        if (due > 0) return say(ch, LT.askGame, app ? [doorButton(app), { text: T.bye }] : [{ text: T.bye }]);
        say(ch, LT.askNone, app ? [doorButton(app), { text: T.bye }] : [{ text: T.bye }]);
      }, function () {
        if (token === conv) say(ch, LT.askFail, app ? [doorButton(app), { text: T.bye }] : [{ text: T.bye }]);
      });
    }

    function question(list, i, ch, app) {
      var v = list[i].view;
      var buttons = v.options.map(function (opt, j) { return { text: opt.text, onClick: function () { answered(list, i, j, ch, app); } }; });
      buttons.push({ text: T.bye });
      say(ch, v.q, buttons, v.sub, true);
    }

    function answered(list, i, j, ch, app) {
      var r = asker.answer(list, i, j), more = i + 1 < list.length;
      if (r.right) {
        ch.char.dance();
        o.cheer(ch.x, ch.z);
      }
      o.changed();
      var buttons = more ? [{ text: T.next, main: true, onClick: function () { question(list, i + 1, ch, app); } }] : [];
      buttons.push({ text: T.bye });
      var sub = (r.right ? [r.good, r.explain] : [r.why, r.explain]).filter(Boolean).join('\n');
      say(ch, r.right ? LT.right(r.pts) : LT.answerIs(r.answer), buttons, sub);
    }

    function label(it) {
      if (it.kind === 'buddy') return T.talkTo.replace('{name}', buddies[it.app].name);
      if (it.kind === 'hoot') return T.talkTo.replace('{name}', english(T.hoot));
      if (it.kind === 'counter') return T.talkTo.replace('{name}', T.bunny);
      if (it.kind === 'tree') return T.listen;
      return null;
    }

    function act(it) {
      if (talk) return;
      if (it.kind === 'buddy') openBuddy(it.app);
      else if (it.kind === 'hoot') openHoot();
      else if (it.kind === 'counter') openBunny();
      else if (it.kind === 'tree') openTree(it.tree);
    }

    function tick(t) {
      Object.keys(buddies).forEach(function (a) { buddies[a].char.animate(t); });
      hoot.char.animate(t);
      bunny.char.animate(t);
      faces.forEach(function (f) { f.animate(t); });
    }

    return {
      refresh: function (s) { snap = s; },
      label: label, act: act, tick: tick,
      handles: function (kind) { return kind === 'buddy' || kind === 'hoot' || kind === 'counter' || kind === 'tree'; },
      talking: function () { return !!talk; },
      closeTalk: function () { if (talk) talk.close(); }
    };
  }

  W.Folk = { create: create };
})(this);
```

- [ ] **Step 4: `town.js` hands the counter to Bunny and waits while another bubble is open**

In `web/world/town.js`, find:

```js
  // o = { S, built, grade, T, store, session, lobbyUrl, go(url), sound(name), busy(on), today() }
```

Replace with:

```js
  // o = { S, built, grade, T, store, session, go(url), sound(name), busy(on), isBusy(), today() }
```

Also change the header comment's last sentences from `and handles Mimi, Bunny's shop counter (a hop to the lobby's shop and back) and the Boss Fort gate.` so the header reads:

```js
/* Phase 2 of the world: her progress on the map. Reads the same engines as the lobby (medals, review, quests, boss,
   wallet, guide), dresses the buildings through decor.js, puts Mayor Mimi by the fountain with her sparkle trail, and
   handles Mimi and the Boss Fort gate (Bunny's counter is folk.js's now). world-main.js asks it for button labels,
   actions and door links. If an engine is missing, the world stays plain. */
```

Find:

```js
    function join(a, b) {
      var sep = ' · ', i = a.lastIndexOf(sep), j = b.lastIndexOf(sep);
      if (i < 0 || j < 0) return a + ' ' + b;
      return a.slice(0, i) + ' ' + b.slice(0, j) + sep + a.slice(i + sep.length) + ' ' + b.slice(j + sep.length);
    }

```

Replace with nothing (delete these lines). Then find:

```js
      say('🐱', T.mimi, step ? (target ? join(step.text, T.follow) : step.text) : T.mimiIdle, buttons);
```

Replace with:

```js
      say('🐱', T.mimi, step ? (target ? W.Chat.join(step.text, T.follow) : step.text) : T.mimiIdle, buttons);
```

Find:

```js
      if (it.kind === 'mimi') return T.mimiTalk;
      if (it.kind === 'counter') return T.counter;
      if (it.kind === 'fort') return snap && snap.fort && snap.fort.href ? T.fortGo : T.fortClosed;
```

Replace with:

```js
      if (it.kind === 'mimi') return T.mimiTalk;
      if (it.kind === 'fort') return snap && snap.fort && snap.fort.href ? T.fortGo : T.fortClosed;
```

Find:

```js
      if (it.kind === 'mimi') openMimi();
      else if (it.kind === 'counter') o.go(o.lobbyUrl + '#shop-world');
      else if (it.kind === 'fort') openFort();
```

Replace with:

```js
      if (it.kind === 'mimi') openMimi();
      else if (it.kind === 'fort') openFort();
```

Find:

```js
      if (!talk && !greeted && Math.hypot(st.x - plaza.x, st.z - plaza.z) < GREET && !talkedToday()) openMimi();
```

Replace with:

```js
      if (!talk && !o.isBusy() && !greeted && Math.hypot(st.x - plaza.x, st.z - plaza.z) < GREET && !talkedToday()) openMimi();
```

Find:

```js
      handles: function (kind) { return kind === 'mimi' || kind === 'counter' || kind === 'fort'; },
```

Replace with:

```js
      handles: function (kind) { return kind === 'mimi' || kind === 'fort'; },
```

- [ ] **Step 5: Wire `folk` into `world-main.js`**

Find:

```js
    var town = W.Town.create({
      S: S, built: world, grade: grade, T: T, store: store, session: session, lobbyUrl: lobbyUrl,
      go: function (url) { debug.go(url); }, sound: sound,
      busy: function (on) { talking = on; ctl.freeze(on); },
      today: function () { return root.Guide && root.Guide.dayKey ? root.Guide.dayKey(Date.now()) : new Date().toDateString(); }
    });
```

Replace with:

```js
    function busy(on) { talking = on; ctl.freeze(on); }
    function today() { return root.Guide && root.Guide.dayKey ? root.Guide.dayKey(Date.now()) : new Date().toDateString(); }
    var town = W.Town.create({
      S: S, built: world, grade: grade, T: T, store: store, session: session,
      go: function (url) { debug.go(url); }, sound: sound, busy: busy, today: today,
      isBusy: function () { return talking; }
    });
    var folk = W.Folk.create({
      S: S, grade: grade, T: T, store: store, today: today, busy: busy,
      textOf: function (html) { return root.Recall && root.Recall.textOf ? root.Recall.textOf(html) : String(html == null ? '' : html); },
      door: function (app, kind) {
        var b = L.buildings(grade).filter(function (x) { return x.app === app; })[0], plain = L.appUrl(grade, b.folder);
        return kind === 'review' ? plain + '&review=1' : town.doorHref(app, plain);
      },
      open: function (app, href) { W.Prefs.setReturn(session, grade, app); debug.go(href); },
      shop: function () { debug.go(lobbyUrl + '#shop-world'); },
      cheer: function (x, z) { world.cheer(x, 4.5, z); sound('allRead'); },
      changed: refresh
    });
    function refresh() {
      town.refresh();
      folk.refresh(town.snapshot());
    }
```

Find:

```js
    function actLabel(it) {
      if (it.kind === 'door') return it.emoji + ' ' + T.go.replace('{name}', english(it.sign));
      if (town.handles(it.kind)) return town.label(it);
```

Replace with:

```js
    function actLabel(it) {
      if (it.kind === 'door') return it.emoji + ' ' + T.go.replace('{name}', english(it.sign));
      if (folk.handles(it.kind)) return folk.label(it);
      if (town.handles(it.kind)) return town.label(it);
```

Find:

```js
      } else if (near.kind === 'mirror') openMaker();
      else if (near.kind === 'signpost') openTravel();
      else town.act(near);
```

Replace with:

```js
      } else if (near.kind === 'mirror') openMaker();
      else if (near.kind === 'signpost') openTravel();
      else if (folk.handles(near.kind)) folk.act(near);
      else town.act(near);
```

Find:

```js
      if (!maker) town.tick(t, st);
```

Replace with:

```js
      if (!maker) {
        town.tick(t, st);
        folk.tick(t);
      }
```

Find:

```js
        if (wantMusic()) music.start();
        town.refresh();
      }
    });
    root.addEventListener('pageshow', function (e) { if (e.persisted) town.refresh(); });
```

Replace with:

```js
        if (wantMusic()) music.start();
        refresh();
      }
    });
    root.addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });
```

Find:

```js
    town.refresh();
    dress(look);
```

Replace with:

```js
    refresh();
    dress(look);
```

Find:

```js
    debug.talking = town.talking;
    debug.talkText = town.talkText;
    debug.closeTalk = town.closeTalk;
```

Replace with:

```js
    debug.talking = function () { return !!doc.querySelector('.talk'); };
    debug.talkText = function () { var e = doc.querySelector('.talk .talk-say'); return e ? e.textContent : null; };
    debug.talkButtons = function () { return [].map.call(doc.querySelectorAll('.talk .talk-btn'), function (b) { return b.textContent; }); };
    debug.pressTalk = function (text) {
      var b = [].filter.call(doc.querySelectorAll('.talk .talk-btn'), function (x) { return x.textContent === text; })[0];
      if (b) b.click();
      return !!b;
    };
    debug.closeTalk = function () { town.closeTalk(); folk.closeTalk(); };
    debug.stand = function (x, z) { ctl.teleport(x, z, ctl.state.face); putPet(); tick(0); };
```

Also update the header comment of `world-main.js`: find `doors, the mirror (character maker), quick travel, settings and music.` and replace with `doors, the mirror (character maker), quick travel, settings and music, and hands Mimi and the fort to town.js and the talking characters to folk.js.`

- [ ] **Step 6: Precache and run the unit tests**

Run: `node tools/update-precache.js && node --test`
Expected: everything passes, including `world3d-wiring` and `pwa` (the new files are in PRECACHE). If `town.js` or `world-main.js` text replacements left a reference to `lobbyUrl` in `town.js`, remove it (town no longer receives it).

- [ ] **Step 7: Stage**

```bash
git add web/world/folk.js web/world/town.js web/world/world-main.js web/world/grade-5.html web/world/grade-2.html tests/paths.js web/sw.js
```

---

### Task 12: Browser test for Phase 3

**Files:**
- Modify: `tests/e2e/world-e2e.js`, `tests/e2e/world-driver.page.js`

- [ ] **Step 1: Driver: a wait helper and the `talk` mode**

In `tests/e2e/world-driver.page.js`, change the first comment line's mode list to `#e2e=fresh|back|lost|resting|grade2|progress|talk.` and find:

```js
  function text(sel) { var e = document.querySelector(sel); return e ? e.textContent : null; }
```

Replace with:

```js
  function text(sel) { var e = document.querySelector(sel); return e ? e.textContent : null; }
  // Polls until check() is true (or about 5 s pass), then runs then().
  function waitFor(check, then, tries) {
    tries = tries === undefined ? 100 : tries;
    if (check() || tries <= 0) return then();
    setTimeout(function () { waitFor(check, then, tries - 1); }, 50);
  }
```

Find:

```js
    if (mode === 'back') { o.state = D.state(); return out(o); }
    if (mode === 'grade2') { o.bigJoystick = !!document.querySelector('.w-joy.big'); return out(o); }
```

Replace with:

```js
    if (mode === 'back') { o.state = D.state(); return out(o); }
    if (mode === 'grade2') {
      o.bigJoystick = !!document.querySelector('.w-joy.big');
      D.maker.done();
      var b2 = World3D.Layout.buddies('grade2')[0];
      D.stand(b2.x, b2.z + 2);
      D.act();
      o.buddyText = D.talkText();
      return out(o);
    }
    if (mode === 'talk') {
      var LY = World3D.Layout;
      var buddy = function (app) { return LY.buddies('grade5').filter(function (b) { return b.app === app; })[0]; };
      var spot = function (id) { return LY.interactables('grade5').filter(function (i) { return i.id === id; })[0]; };
      var b = buddy('life-lab');
      D.stand(b.x, b.z + 2);
      o.near = D.state().near;
      o.act = D.actText();
      D.act();
      o.buddyText = D.talkText();
      o.buddyButtons = D.talkButtons();
      D.pressTalk('❓ Ask me!');
      return waitFor(function () { return document.querySelector('.talk-row.stack'); }, function () {
        o.options = D.talkButtons();
        D.pressTalk(window.__answer);
        o.after = D.talkText();
        o.box = JSON.parse(Learner.storage.getItem('review_v1')).items[window.__key].box;
        o.points = Learner.storage.getItem('lifelab_points_v1');
        o.history = StudyHistory.list().filter(function (e) { return e.app === 'life-lab'; })
          .map(function (e) { return { kind: e.kind, correct: e.correct, finished: e.finished }; });
        D.pressTalk('👋 Bye');
        var p = buddy('page-turners');
        D.stand(p.x, p.z + 2);
        D.act();
        D.pressTalk('❓ Ask me!');
        waitFor(function () { var t = D.talkText(); return t && t.indexOf('🤔') !== 0; }, function () {
          o.failText = D.talkText();
          o.failButtons = D.talkButtons();
          D.pressTalk('👋 Bye');
          var h = spot('hoot');
          D.stand(h.x, h.z);
          o.hootNear = D.state().near;
          D.act();
          o.hootText = D.talkText();
          D.pressTalk('👋 Bye');
          var c = spot('counter');
          D.stand(c.x, c.z);
          D.act();
          o.bunnyText = D.talkText();
          o.bunnyButtons = D.talkButtons();
          D.pressTalk('👋 Bye');
          var t = spot('tree:0'), park = LY.places('grade5').park, d = Math.hypot(park.x - t.x, park.z - t.z);
          D.stand(t.x + (park.x - t.x) / d * (t.r - 1), t.z + (park.z - t.z) / d * (t.r - 1));
          o.treeNear = D.state().near;
          D.act();
          o.treeText = D.talkText();
          o.treeWant = World3D.Chat.quote('grade5', 0, Guide.dayKey(Date.now()), 0);
          out(o);
        });
      });
    }
```

- [ ] **Step 2: Runner: stage the life-lab lesson files and assert**

In `tests/e2e/world-e2e.js`, find:

```js
const { WORLDS, VENDOR_FILES, ENGINE_FILES, LOBBIES, web, app, appFile, lobbyFile } = require('../paths.js');
```

Replace with:

```js
const { WORLDS, VENDOR_FILES, ENGINE_FILES, LOBBIES, web, app, appFile, lobbyFile, engineFile, worldFile } = require('../paths.js');
const { lessons } = require('../content.js');
const { keyOf } = require(engineFile('recall.js'));
const LESSON_FILES = require(worldFile('lesson-files.js'));
```

Find:

```js
  const g2 = run('grade2', stageWorld('grade2', 2), 'grade2');
  assert.deepEqual(g2.errors, [], 'grade 2: page errors');
  assert.equal(g2.makerOpen, true);
  assert.match(g2.makerTitle, / · /, 'Grade 2 labels are paired');
  assert.equal(g2.bigJoystick, true);
  console.log('ok grade 2');
```

Replace with:

```js
  const g2 = run('grade2', stageWorld('grade2', 2), 'grade2');
  assert.deepEqual(g2.errors, [], 'grade 2: page errors');
  assert.equal(g2.makerOpen, true);
  assert.match(g2.makerTitle, / · /, 'Grade 2 labels are paired');
  assert.equal(g2.bigJoystick, true);
  assert.match(g2.buddyText, /^Beep! Kumusta, kaibigan\? .* · Beep! Hello, friend! /, 'a Grade 2 buddy speaks Filipino · English');
  console.log('ok grade 2');

  // Talking characters: a buddy's line, ❓ Ask me! moving the same review box the game would, a lesson file that does not
  // load, Hoot, Bunny and a tree. The question is one without HTML, so its plain text is its button's text.
  const item = lessons('life-lab').flatMap((l) => l.quiz).find((q) => !q.art && !/[<&]/.test(q.q + q.options.join('')));
  const answer = item.options[item.correct];
  const key = keyOf('life-lab', { q: item.q, answer });
  const TALK = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));'
    + 'var __items = {}; __items[' + JSON.stringify(key) + '] = { box: 2, due: "2026-01-01", t: 1 }; __items["page-turners|feed"] = { box: 1, due: "2026-01-01", t: 1 };'
    + 'Learner.storage.setItem("review_v1", JSON.stringify({ v: 1, items: __items }));'
    + 'window.__key = ' + JSON.stringify(key) + '; window.__answer = ' + JSON.stringify(answer) + ';</script>';
  const talkFile = stageWorld('talk', 5, TALK);
  const lf = LESSON_FILES['life-lab'];
  for (const f of lf.files) {
    const to = path.join(work, 'talk', 'world', lf.dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(web('world'), lf.dir, f), to);
  }
  const talk = run('talk', talkFile, 'talk');
  assert.deepEqual(talk.errors, [], 'talk: page errors');
  assert.equal(talk.near, 'buddy:life-lab');
  assert.equal(talk.act, '💬 Talk to Fizz');
  assert.equal(talk.buddyText, 'Ribbit! Science is so cool! 🔁 1 question is ready for review. Tap Ask me!');
  assert.deepEqual(talk.buddyButtons, ['💬 More', '❓ Ask me!', '👋 Bye']);
  assert.ok(talk.options.includes(answer), 'the due question is asked');
  assert.equal(talk.after, '🎉 Right! +14 points');
  assert.equal(talk.box, 3, 'the same review box the game uses moved up');
  assert.equal(talk.points, '14');
  assert.deepEqual(talk.history, [{ kind: 'review', correct: 1, finished: false }]);
  assert.equal(talk.failText, "📖 Let's ask in the game!");
  assert.deepEqual(talk.failButtons, ['📖 Go to English!', '👋 Bye']);
  assert.equal(talk.hootNear, 'hoot');
  assert.equal(talk.hootText, 'Hoo-hoo! 1 question is ready for review. Shall I ask you?');
  assert.match(talk.bunnyText, /coins/);
  assert.deepEqual(talk.bunnyButtons, ['💬 More', '🛍️ Open the shop', '👋 Bye']);
  assert.equal(talk.treeNear, 'tree:0');
  assert.equal(talk.treeText, talk.treeWant);
  console.log('ok buddies, Ask me!, Hoot, Bunny and a tree');
```

- [ ] **Step 3: Run the browser test**

Run: `node tests/e2e/world-e2e.js`
Expected: every `ok …` line, including `ok buddies, Ask me!, Hoot, Bunny and a tree`. If `talk.after` shows a streak bonus or a different gap bonus, compare with `GAP_BONUS` in `web/engine/recall.js` before changing the expectation. If `failText` is still the thinking line, the loader did not reject on a missing file: check `s.onerror` in `ask.js`.

- [ ] **Step 4: Stage**

```bash
git add tests/e2e/world-e2e.js tests/e2e/world-driver.page.js
```

---

### Task 13: Look check, docs and the full run

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Screenshots**

Copy `web/` to the scratchpad. In the copy's `world/grade-5.html`, insert the `TALK` seed script from Task 12 (as plain HTML) before `<script src="../vendor/three/three.min.js"></script>`, and at the end of the body add:

```html
<script>addEventListener("world-ready", function () { var b = World3D.Layout.buddies("grade5")[6]; WorldDebug.stand(b.x, b.z + 7); });</script>
```

Screenshot from file:// with a fresh `--user-data-dir`:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --no-first-run --user-data-dir="<fresh dir>" --window-size=1200,800 --virtual-time-budget=8000 --screenshot="<out.png>" "file:///<scratchpad>/site/world/grade-5.html"
```

Take three: School Street (above), the park (`WorldDebug.teleport("park")`), and Shop Plaza (`WorldDebug.teleport("shop")`). Check: buddies stand beside their doors facing the street, each looks like its animal with its prop; Hoot sits on his bench with his cap and glasses; Bunny stands by the counter; tree faces sit on the crowns looking into the park. Send the screenshots to the user with SendUserFile. Delete the copy afterwards.

- [ ] **Step 2: README**

In the "Running locally" list, change the `world-e2e.js` comment to:

```
node tests/e2e/world-e2e.js          # 3D world: maker, doors, 🏠 back, quick travel, medals, markers, Mimi's trail, fort, shop and back, buddies, Ask me!, Hoot, Bunny, trees
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
git commit -m "3D world phase 3: a buddy by every subject door (Fizz the frog, Bookie the bookworm, Kiko the carabao and friends) says what matters most in that subject (boss, review due, today's quest, medal progress, missing her) and asks her due review questions with Ask me!, scored through the game's own StudyKit and Recall so the same review box moves and the same points and coins are paid; Professor Hoot on his park bench asks up to 3 due questions from any subject, Bunny by the shop counter cheers her saving toward the next reward and opens the shop, and 8 talking trees in Whispering Park each have a quote of the day from 60 kind quotes (Grade 2 in Filipino and English); lesson-files.js is generated with the precache"
```

---

## Self-review notes

- **Spec Phase 3 coverage:** speech bubble with More / Ask me! / Bye (Tasks 9, 11); 17 buddies with the spec's animals and props (Tasks 2, 10; Grade 2 Math = block robot, English = conductor bear, Computer = mouse with a computer mouse, Science = detective frog with a magnifier); line priority boss → due → quest → medal → 3+ days → fallback (Task 3); Ask me! only due questions, caught-up line with the next-lesson door, no farming (a right answer moves the box out of today, a wrong one to tomorrow) (Tasks 6, 11); MC and TF only, no typed / art / Math Mastery skills (Task 4; passages also stay, see decisions); lesson files on demand from `lesson-files.js` generated by the precache tool (Task 5); per-shape adapters proved equal to each game's `reviewInfo` (Task 4); scoring via `StudyKit.start` + `Recall` (Task 6); right = dance + confetti, wrong = right answer + the game's why/explain (Task 11); load failure → "Let's ask in the game!" + door (Tasks 11, 12); Hoot up to 3 across subjects (Tasks 6, 11); 8 talking trees, 60 quotes, quote of the day + More (Tasks 2, 3, 7, 10); Bunny opens the shop and cheers the cheapest unaffordable reward (Tasks 3, 11). Phase 4 items are not here.
- **Names across tasks:** `Buddies.{BUDDIES, KINDS, PROPS, HATS}`; `Lines.{TEXT, QUOTES}`; `Chat.{join, buddyLines, quote, bunnyLine}`; `Quiz.{SHAPES, supports, askable, info, view, decode}`; `LessonFiles[app] = { title, pointsKey, progressKey, dir, files }`; `Ask.{create, loader, LIMIT}` → `{ pick, answer, dueApps, supported, end }`; `Layout.{buddies, talkTrees, props.hoot, props.bunny}`, interactable kinds `buddy|hoot|tree|counter`; `Progress.{points, snapshot().info}`; `Talk.open({ sub, stack })`; `build().cheer`; `Cast.{buddy, hoot, bunny, treeFace}`; `Folk.create(o)` → `{ refresh, label, act, tick, handles, talking, closeTalk }`; `WorldDebug.{stand, talkButtons, pressTalk}`.
- **Accepted gaps:** medals change only when she next opens the game; Ask me! answers do not tick quests; reading-passage and picture questions are asked only in the games.
