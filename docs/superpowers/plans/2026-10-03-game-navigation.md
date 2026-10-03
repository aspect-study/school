# Game Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **The user runs every commit.** Never run `git commit`. At each "Commit" step, stage nothing and show the user the `git add` / `git commit -m '...'` commands as a code block. No `Co-Authored-By` lines.

**Goal:** Every game gets the same top bar (← Back, 🏠 Home = lobby, ☰ Menu), a "Leave the quiz?" check, and an Android back gesture that goes back one screen.

**Architecture:** One new engine file `web/engine/nav.js` with a global `Nav`. The navigation rules sit in a pure `controller()` (unit-tested with stubs). A thin DOM layer builds the bar, the menu sheet and the check dialog (covered by e2e). Each game calls `Nav.start({...})` once and `Nav.screen(id)` from its own `showScreen`. `fx.js` gets `Fx.setMuted` and hides its floating 🔊 when `Nav` is present.

**Tech Stack:** Plain HTML/JS, no build step. Tests use `node --test` and headless Chrome e2e (`tests/e2e/*.js`, `--dump-dom` with an in-page driver).

**Spec:** `docs/superpowers/specs/2026-10-03-game-navigation-design.md`

---

## Background the engineer needs

- The site lives in `web/`. Games are at `web/subjects/grade-N/<subject>/index.html` and load engine files with `<script src="../../../engine/X.js" data-grade="gradeN"></script>`. Lobbies are `web/lobby/grade-5.html` and `web/lobby/grade-2.html`.
- Engine files follow one pattern (see `web/engine/fx.js`): an IIFE that does `module.exports = exported` under Node (for unit tests) and otherwise creates a browser global, reading `data-grade` from `document.currentScript`.
- `tests/paths.js` has `ENGINE_FILES`, `APPS` (each with `id`, `grade`, `page`), `appFile(id)`, `lobbyFile(grade)`, `engineFile(name)`.
- Every page has an identical `<script data-file-check>` snippet (test-enforced by `tests/pages.test.js`). It maps engine file names to globals and shows a red bar when one is missing.
- Every file under `web/` must be in PRECACHE in `web/sw.js`. Run `node tools/update-precache.js` after adding a file.
- Run unit tests with `node --test` from the repo root.
- The games come in four families. The e2e suite already uses these names:

| Family | Games (folder → app id) | `showScreen` | Home id | Quiz screen id | Old back controls |
|---|---|---|---|---|---|
| C (Grade 5) | grade-5 araling-panlipunan (history-explorers), english (page-turners), filipino (wikaharian), gmrc (rise-shine), pe-health (rally-ready), science (life-lab), tle (craft-corner) | `showScreen(id)` toggles `.active` on `#id` | `home` | `quizScreen` | 3× `<div class="btn-icon" role="button" … onclick="goHome()" …>←</div>`; results `<button class="btn ghost full" onclick="goHome()">Back to Home</button>` |
| B (Grade 2) | grade-2 computer (byte-buddies), english (word-train), gmrc (growing-good), makabansa (batang-bayani), science (science-detectives) | `showScreen(name)` toggles `#screen-<name>` | `home` | `quiz` | `<button class="back-link" id="back-from-flash">…</button>`, `<button class="back-link" id="back-from-quiz">…</button>` + their `addEventListener` lines |
| A (Grade 2) | grade-2 filipino (kuwentista), math (block-bot) | `showScreen(el)` takes an element | `screen-home` | `screen-quiz` | 2× `<button class="back-btn" onclick="goHome()">&larr; …</button>` |
| Math | grade-5 math (math-mastery) | `showScreen(el)` | `screen-home` | `screen-quiz`, `screen-walkthrough`, `screen-cases` | 5× `<button class="back-btn" …>&larr; Back</button>` (one calls `caseBack()`) |

- Every game ends its main script with a final `renderHome();` line. The e2e harness (`injectDriver` in `tests/e2e/chrome.js`) injects its driver right after the **last** `renderHome();`, so put `Nav.start(...)` **before** that line and never write the text `renderHome();` inside the `Nav.start` call.
- e2e drivers call `goHome()` directly. `goHome` must stay ungated, because only taps on the bar ask the check.

## File map

- Create `web/engine/nav.js`: TEXT, `lobbyUrl`, pure `controller`, DOM bar, menu and check, the `Nav` global.
- Create `tests/nav.test.js`: controller and text unit tests.
- Create `tests/nav-wiring.test.js`: static checks on all 15 games and both lobbies.
- Create `tests/e2e/driver-nav.page.js` and `tests/e2e/nav-e2e.js`: browser test.
- Modify `web/engine/fx.js`: `setMuted`, skip the floating button under Nav.
- Modify `tests/paths.js`: add `nav.js` to ENGINE_FILES.
- Modify `tests/english-everywhere.test.js`: Grade 2 nav text has English.
- Modify `web/sw.js`: PRECACHE (tool) + cache name `study-games-v3`.
- Modify all 15 game pages and both lobbies.
- Modify `README.md`: list `nav.js` among engine files and the e2e command.

---

### Task 1: Navigation rules (pure controller) and text

**Files:**
- Create: `web/engine/nav.js`
- Test: `tests/nav.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/nav.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { controller, lobbyUrl, TEXT } = require(engineFile('nav.js'));

// A stand-in for window.history: records calls; back() lands on the game-home entry (state null).
function setup(over = {}) {
  const log = [];
  const history = {
    state: null,
    pushState(s) { this.state = s; log.push('push:' + s.nav); },
    replaceState(s) { this.state = s; log.push('replace:' + s.nav); },
    back() { this.state = null; log.push('back'); },
  };
  let round = false;
  let asked = null;
  const ctl = controller(Object.assign({
    home: 'home',
    lobby: '../../../lobby/grade-5.html',
    goHome: () => { log.push('goHome'); ctl.screen('home'); },
    inRound: () => round,
    go: (url) => log.push('go:' + url),
    ask: (proceed, stay) => { asked = { proceed, stay }; log.push('ask'); },
    history,
  }, over));
  return { ctl, log, history, setRound: (v) => { round = v; }, asked: () => asked };
}

test('the lobby is two folders up from the subject folder, per grade', () => {
  assert.equal(lobbyUrl('grade5'), '../../../lobby/grade-5.html');
  assert.equal(lobbyUrl('grade2'), '../../../lobby/grade-2.html');
  assert.equal(lobbyUrl(null), '../../../lobby/grade-5.html');
});

test('← on the game home goes to the lobby', () => {
  const s = setup();
  s.ctl.back();
  assert.deepEqual(s.log, ['go:../../../lobby/grade-5.html']);
});

test('leaving the home pushes one history entry, later screens replace it, home goes back once', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.ctl.screen('resultsScreen');
  s.ctl.screen('home');
  assert.deepEqual(s.log, ['push:quizScreen', 'replace:resultsScreen', 'back']);
  s.ctl.popstate();
  assert.deepEqual(s.log, ['push:quizScreen', 'replace:resultsScreen', 'back'], 'the popstate from our own back() is ignored');
  assert.equal(s.ctl.current(), 'home');
});

test('← on an inner screen outside a round goes straight to the game home', () => {
  const s = setup();
  s.ctl.screen('flashScreen');
  s.ctl.back();
  assert.deepEqual(s.log, ['push:flashScreen', 'goHome', 'back']);
});

test('← during a round asks first: Keep playing stays, Leave goes home', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.setRound(true);
  s.ctl.back();
  assert.deepEqual(s.log, ['push:quizScreen', 'ask']);
  s.asked().stay();
  assert.equal(s.ctl.current(), 'quizScreen');
  s.ctl.back();
  s.asked().proceed();
  assert.deepEqual(s.log.slice(-2), ['goHome', 'back']);
});

test('🏠 asks during a round, then goes to the lobby; outside a round it goes at once', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.setRound(true);
  s.ctl.home();
  assert.equal(s.log.at(-1), 'ask');
  s.asked().proceed();
  assert.equal(s.log.at(-1), 'go:../../../lobby/grade-5.html');
  s.setRound(false);
  s.ctl.home();
  assert.equal(s.log.at(-1), 'go:../../../lobby/grade-5.html');
});

test('Shop goes to the lobby with #shop', () => {
  const s = setup();
  s.ctl.shop();
  assert.deepEqual(s.log, ['go:../../../lobby/grade-5.html#shop']);
});

test('Lessons does nothing on the game home and goes home from inside', () => {
  const s = setup();
  s.ctl.lessons();
  assert.deepEqual(s.log, []);
  s.ctl.screen('flashScreen');
  s.ctl.lessons();
  assert.deepEqual(s.log, ['push:flashScreen', 'goHome', 'back']);
});

test('the back gesture during a round asks; Keep playing puts the history entry back', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.setRound(true);
  s.history.state = null; // the browser already moved to the game-home entry
  s.ctl.popstate();
  assert.equal(s.log.at(-1), 'ask');
  s.asked().stay();
  assert.equal(s.log.at(-1), 'push:quizScreen');
  assert.equal(s.ctl.current(), 'quizScreen');
});

test('the back gesture outside a round goes home without a second history step', () => {
  const s = setup();
  s.ctl.screen('flashScreen');
  s.history.state = null;
  s.ctl.popstate();
  assert.deepEqual(s.log, ['push:flashScreen', 'goHome']);
  assert.equal(s.ctl.current(), 'home');
});

test('the back gesture on the game home is left to the browser (it returns to the lobby)', () => {
  const s = setup();
  s.ctl.popstate();
  assert.deepEqual(s.log, []);
});

test('a game can replace what ← does on inner screens (Math case studies)', () => {
  const calls = [];
  const s = setup({ back: () => calls.push('caseBack') });
  s.ctl.screen('screen-cases');
  s.ctl.back();
  assert.deepEqual(calls, ['caseBack']);
});

test('the check buttons stay English in both grades', () => {
  for (const g of ['grade5', 'grade2']) {
    assert.equal(TEXT[g].keep, 'Keep playing');
    assert.equal(TEXT[g].leave, 'Leave');
  }
  assert.equal(TEXT.grade5.leaveTitle, 'Leave the quiz?');
  assert.equal(TEXT.grade5.leaveBody, 'Points you earned are kept.');
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `node --test tests/nav.test.js`
Expected: FAIL with `Cannot find module …web/engine/nav.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `web/engine/nav.js` (the DOM part comes in Task 2):

```js
/* The top bar in every game: ← Back, 🏠 Home (the lobby) and ☰ Menu, the "Leave the quiz?" check
   and the Android back gesture. A game calls Nav.start once and Nav.screen whenever it switches screens. */
(function (root) {
  'use strict';

  var TEXT = {
    grade5: {
      back: 'Back', home: 'Go to the lobby', menu: 'Menu',
      lessons: '📚 Lessons', lobby: '🏠 Lobby', soundOn: '🔊 Sound on', soundOff: '🔇 Sound off', shop: '🪙 Shop',
      leaveTitle: 'Leave the quiz?', leaveBody: 'Points you earned are kept.',
      keep: 'Keep playing', leave: 'Leave'
    },
    grade2: {
      back: 'Back', home: 'Go to the lobby', menu: 'Menu',
      lessons: '📚 Lessons · Mga Aralin', lobby: '🏠 Lobby', soundOn: '🔊 Sound on · May tunog',
      soundOff: '🔇 Sound off · Walang tunog', shop: '🪙 Shop · Tindahan',
      leaveTitle: 'Leave the quiz? · Aalis ka na ba sa pagsusulit?',
      leaveBody: 'Points you earned are kept. · Hindi mawawala ang puntos mo.',
      keep: 'Keep playing', leave: 'Leave'
    }
  };

  function lobbyUrl(grade) {
    return '../../../lobby/grade-' + (grade === 'grade2' ? '2' : '5') + '.html';
  }

  // The rules, with no DOM: o = { home, lobby, goHome, back?, inRound, go(url), ask(proceed, stay), history }.
  // History holds at most two entries per game: the game home, plus one {nav: id} entry for whatever inner screen is showing.
  function controller(o) {
    var current = o.home;
    var ignorePop = false;
    var back = o.back || o.goHome;
    var h = o.history;

    function onHome() { return current === o.home; }
    function innerEntry() { return !!(h.state && h.state.nav); }
    function guard(proceed, stay) {
      if (o.inRound()) o.ask(proceed, stay || function () {});
      else proceed();
    }

    return {
      current: function () { return current; },
      screen: function (id) {
        current = String(id);
        if (onHome()) {
          if (innerEntry()) { ignorePop = true; h.back(); }
        } else if (innerEntry()) {
          h.replaceState({ nav: current }, '');
        } else {
          h.pushState({ nav: current }, '');
        }
      },
      back: function () {
        if (onHome()) o.go(o.lobby);
        else guard(back);
      },
      home: function () { guard(function () { o.go(o.lobby); }); },
      lessons: function () { if (!onHome()) guard(o.goHome); },
      shop: function () { guard(function () { o.go(o.lobby + '#shop'); }); },
      // The browser has already stepped back to the game-home entry when this runs.
      popstate: function () {
        if (ignorePop) { ignorePop = false; return; }
        if (onHome()) return;
        guard(back, function () { h.pushState({ nav: current }, ''); });
      }
    };
  }

  var exported = { TEXT: TEXT, lobbyUrl: lobbyUrl, controller: controller };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
})(this);
```

- [ ] **Step 4: Run the test and check it passes**

Run: `node --test tests/nav.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit (the user runs it)**

```bash
git add web/engine/nav.js tests/nav.test.js
git commit -m "Add navigation rules for the game top bar"
```

---

### Task 2: The bar, menu and check in the browser

**Files:**
- Modify: `web/engine/nav.js` (add the DOM layer and the global)
- Modify: `tests/paths.js:8` (ENGINE_FILES)
- Modify: `tests/english-everywhere.test.js` (append a test)
- Modify: `web/sw.js` (PRECACHE via tool, cache name)
- Modify: the `<script data-file-check>` snippet in all 15 games and both lobbies

- [ ] **Step 1: Write the failing text test**

Append to `tests/english-everywhere.test.js`:

```js
test('every Grade 2 navigation line has English', () => {
  const { TEXT } = require(engineFile('nav.js'));
  for (const [key, value] of Object.entries(TEXT.grade2)) hasEnglishWhereFilipino(value, 'nav ' + key);
  assert.match(TEXT.grade2.leaveBody, /points/i, 'puntos comes with points');
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/english-everywhere.test.js`
Expected: PASS. The Task 1 text already pairs English with Filipino. This test guards later edits.

- [ ] **Step 3: Add the DOM layer to `web/engine/nav.js`**

Insert this block above `var exported = …`:

```js
  var CSS =
    '#nav-bar{position:sticky;top:0;z-index:9000;display:flex;align-items:center;gap:6px;min-height:52px;box-sizing:border-box;' +
      'padding:4px 8px;padding-top:max(4px,env(safe-area-inset-top));background:var(--card,var(--surface,#fff));color:var(--ink,#1d1d1f);' +
      'border-bottom:3px solid var(--accent,#2E6F9E);box-shadow:0 2px 8px rgba(0,0,0,.08);}' +
    '.nav-btn{min-width:44px;height:44px;border-radius:12px;border:none;background:transparent;color:inherit;font:inherit;font-size:1.4rem;' +
      'line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}' +
    '.nav-btn:hover,.nav-item:hover{background:rgba(127,127,127,.14);}' +
    '.nav-btn:focus-visible,.nav-item:focus-visible,.nav-keep:focus-visible,.nav-leave:focus-visible{outline:3px solid var(--accent,#2E6F9E);outline-offset:2px;}' +
    '.nav-title{flex:1;min-width:0;font-weight:800;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#nav-sheet,#nav-confirm{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.35);}' +
    '#nav-confirm{display:flex;align-items:center;justify-content:center;padding:16px;}' +
    '#nav-sheet[hidden],#nav-confirm[hidden]{display:none;}' +
    '.nav-panel,.nav-box{background:var(--card,var(--surface,#fff));color:var(--ink,#1d1d1f);box-shadow:0 12px 32px rgba(0,0,0,.25);}' +
    '.nav-panel{position:absolute;top:58px;right:8px;min-width:220px;max-width:calc(100vw - 16px);border-radius:16px;padding:8px;' +
      'display:flex;flex-direction:column;gap:4px;}' +
    '.nav-item{min-height:48px;text-align:left;padding:10px 14px;border:none;border-radius:12px;background:transparent;color:inherit;' +
      'font:inherit;font-weight:700;font-size:1rem;cursor:pointer;}' +
    '.nav-box{width:100%;max-width:360px;border-radius:20px;padding:22px 20px;text-align:center;}' +
    '.nav-box h2{margin:0 0 6px;font-size:1.3rem;}' +
    '.nav-box p{margin:0 0 18px;}' +
    '.nav-sub{display:block;font-size:.85em;font-weight:600;opacity:.8;margin-top:2px;}' +
    '.nav-keep{display:block;width:100%;min-height:52px;border:none;border-radius:14px;background:var(--ink,#1d1d1f);' +
      'color:var(--card,var(--surface,#fff));font:inherit;font-weight:800;font-size:1.1rem;cursor:pointer;}' +
    '.nav-leave{display:block;margin:10px auto 0;min-height:44px;padding:8px 18px;border:none;background:transparent;color:inherit;' +
      'font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;}' +
    '@media print{#nav-bar,#nav-sheet,#nav-confirm{display:none !important;}}';

  function create(win, grade) {
    var doc = win.document;
    var t = TEXT[grade] || TEXT.grade5;
    var ctl = null, sheet = null, dialog = null, menuBtn = null, soundBtn = null, keepBtn = null;
    var pending = null, returnFocus = null;

    var api = {
      lobby: lobbyUrl(grade),
      go: function (url) { win.location.href = url; },
      start: start,
      screen: function (id) { if (ctl) ctl.screen(id); },
      current: function () { return ctl ? ctl.current() : null; }
    };

    function button(id, cls, text, label, onClick) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.id = id;
      b.className = cls;
      b.textContent = text;
      if (label) b.setAttribute('aria-label', label);
      b.addEventListener('click', onClick);
      return b;
    }

    // "English · Filipino" becomes the English line with the Filipino under it.
    function lines(node, text) {
      var parts = text.split(' · ');
      node.textContent = parts[0];
      for (var i = 1; i < parts.length; i++) {
        var sub = doc.createElement('span');
        sub.className = 'nav-sub';
        sub.textContent = parts[i];
        node.appendChild(sub);
      }
    }

    function renderSound() {
      if (!soundBtn) return;
      var m = win.Fx.muted();
      soundBtn.textContent = m ? t.soundOff : t.soundOn;
      soundBtn.setAttribute('aria-pressed', m ? 'false' : 'true');
    }

    function openSheet() {
      renderSound();
      sheet.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      sheet.querySelector('.nav-item').focus();
    }
    function closeSheet() {
      if (!sheet || sheet.hidden) return;
      sheet.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
    }
    function pick(fn) { return function () { closeSheet(); fn(); }; }

    function ask(proceed, stay) {
      pending = { proceed: proceed, stay: stay };
      returnFocus = doc.activeElement;
      dialog.hidden = false;
      keepBtn.focus();
    }
    function answer(leave) {
      var p = pending;
      pending = null;
      dialog.hidden = true;
      if (!p) return;
      if (leave) { p.proceed(); return; }
      p.stay();
      if (returnFocus && returnFocus.focus) returnFocus.focus();
    }

    function build(title) {
      var style = doc.createElement('style');
      style.id = 'nav-style';
      style.textContent = CSS;
      doc.head.appendChild(style);

      var bar = doc.createElement('nav');
      bar.id = 'nav-bar';
      bar.setAttribute('aria-label', t.menu);
      var name = doc.createElement('span');
      name.className = 'nav-title';
      name.textContent = title || doc.title;
      menuBtn = button('nav-menu', 'nav-btn', '☰', t.menu, function () { if (sheet.hidden) openSheet(); else closeSheet(); });
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-controls', 'nav-sheet');
      bar.appendChild(button('nav-back', 'nav-btn', '←', t.back, function () { ctl.back(); }));
      bar.appendChild(name);
      bar.appendChild(button('nav-home', 'nav-btn', '🏠', t.home, function () { ctl.home(); }));
      bar.appendChild(menuBtn);

      sheet = doc.createElement('div');
      sheet.id = 'nav-sheet';
      sheet.hidden = true;
      var panel = doc.createElement('div');
      panel.className = 'nav-panel';
      panel.setAttribute('role', 'menu');
      var items = [
        button('nav-lessons', 'nav-item', t.lessons, null, pick(function () { ctl.lessons(); })),
        button('nav-lobby', 'nav-item', t.lobby, null, pick(function () { ctl.home(); }))
      ];
      if (win.Fx && win.Fx.setMuted) {
        soundBtn = button('nav-sound', 'nav-item', '', null, function () { win.Fx.setMuted(!win.Fx.muted()); renderSound(); });
        items.push(soundBtn);
      }
      items.push(button('nav-shop', 'nav-item', t.shop, null, pick(function () { ctl.shop(); })));
      items.forEach(function (b) { b.setAttribute('role', 'menuitem'); panel.appendChild(b); });
      sheet.appendChild(panel);
      sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });

      dialog = doc.createElement('div');
      dialog.id = 'nav-confirm';
      dialog.hidden = true;
      var box = doc.createElement('div');
      box.className = 'nav-box';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'nav-confirm-title');
      var h = doc.createElement('h2');
      h.id = 'nav-confirm-title';
      lines(h, t.leaveTitle);
      var p = doc.createElement('p');
      lines(p, t.leaveBody);
      keepBtn = button('nav-keep', 'nav-keep', t.keep, null, function () { answer(false); });
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(keepBtn);
      box.appendChild(button('nav-leave', 'nav-leave', t.leave, null, function () { answer(true); }));
      dialog.appendChild(box);
      dialog.addEventListener('click', function (e) { if (e.target === dialog) answer(false); });

      doc.body.insertBefore(bar, doc.body.firstChild);
      doc.body.appendChild(sheet);
      doc.body.appendChild(dialog);
    }

    function start(opts) {
      if (ctl) return;
      ctl = controller({
        home: opts.home,
        lobby: api.lobby,
        goHome: opts.goHome,
        back: opts.back,
        inRound: opts.inRound || function () { return false; },
        go: function (url) { api.go(url); },
        ask: ask,
        history: win.history
      });
      build(opts.title);
      win.addEventListener('popstate', function () { closeSheet(); ctl.popstate(); });
      doc.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!dialog.hidden) answer(false);
        else closeSheet();
      });
    }

    return api;
  }
```

Then change the bottom of the file so the browser gets the global:

```js
  var exported = { TEXT: TEXT, lobbyUrl: lobbyUrl, controller: controller };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Nav = create(root, script ? script.getAttribute('data-grade') : null);
  } catch (e) {}
})(this);
```

- [ ] **Step 4: Register the file**

In `tests/paths.js` line 8, insert `'nav.js'` right after `'learner.js'`:

```js
const ENGINE_FILES = ['storage.js', 'learner.js', 'nav.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'quests.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'parent-panel.js'];
```

In `web/sw.js` change `const CACHE = 'study-games-v2';` to `const CACHE = 'study-games-v3';`. Then run:

Run: `node tools/update-precache.js`
Expected: `web/sw.js precaches N files`, where N is one more than before. `git diff web/sw.js` shows `'engine/nav.js',` added.

- [ ] **Step 5: Add Nav to the file check on all 17 pages**

The snippet must stay identical on every page. In each of the 15 game pages and both lobbies, inside `<script data-file-check>`, change:

```js
var GLOBALS = { storage: 'StudyStore', learner: 'Learner', 'study-history': 'StudyHistory',
```

to:

```js
var GLOBALS = { storage: 'StudyStore', learner: 'Learner', nav: 'Nav', 'study-history': 'StudyHistory',
```

(the rest of the line stays as it is). One way to do it across all pages:

```bash
grep -rl "var GLOBALS = { storage: 'StudyStore', learner: 'Learner', 'study-history'" web | xargs sed -i "s/var GLOBALS = { storage: 'StudyStore', learner: 'Learner', 'study-history'/var GLOBALS = { storage: 'StudyStore', learner: 'Learner', nav: 'Nav', 'study-history'/"
```

Check that exactly 17 files changed: `git diff --stat web | tail -1`. Also check that the parent page (`web/parent/index.html`) and the redirect pages are untouched. If they have the snippet too, they must get the same change, because `tests/pages.test.js` only compares lobbies and games.

- [ ] **Step 6: Run the full unit suite**

Run: `node --test`
Expected: PASS (all existing tests, plus nav and pwa precache).

- [ ] **Step 7: Commit (the user runs it)**

```bash
git add web/engine/nav.js web/sw.js tests/paths.js tests/english-everywhere.test.js web/lobby web/subjects
git commit -m "Add the game top bar engine: Back, Home, Menu and the leave-the-quiz check"
```

---

### Task 3: Sound switch moves into the menu (`fx.js`)

**Files:**
- Modify: `web/engine/fx.js` (`mountMute` near line 373, the returned object near line 395)
- Test: `tests/browser-globals.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/browser-globals.test.js`:

```js
test('Fx.setMuted switches the saved sound setting', () => {
  const data = {};
  const win = {
    localStorage: { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
    document: { readyState: 'loading', addEventListener() {}, currentScript: null, getElementById: () => null },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('fx.js'), 'utf8'), win);
  win.Fx.setMuted(true);
  assert.equal(win.Fx.muted(), true);
  assert.equal(data.study_fx_muted_v1, '1');
  win.Fx.setMuted(false);
  assert.equal(win.Fx.muted(), false);
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `node --test tests/browser-globals.test.js`
Expected: FAIL with `win.Fx.setMuted is not a function`. If it fails earlier because `create()` touches something the stub lacks, add only that member to the stub `document`, never a whole fake DOM.

- [ ] **Step 3: Implement**

In `web/engine/fx.js`, replace `mountMute` with `setMuted` + a `mountMute` that uses it and stays away when the page has the Nav bar:

```js
    function setMuted(on) {
      write(MUTE_KEY, on ? '1' : '0');
      if (on && win.speechSynthesis) win.speechSynthesis.cancel();
      if (!on) tone(880, 0, 0.12, 'sine', 0.16);
      var btn = doc.getElementById('fx-mute');
      if (btn) renderMute(btn);
    }

    // Games switch sound from the Nav menu; only pages without Nav (the lobbies) get the floating button.
    function mountMute() {
      if (win.Nav || doc.getElementById('fx-mute')) return;
      var btn = doc.createElement('button');
      btn.id = 'fx-mute';
      btn.type = 'button';
      renderMute(btn);
      btn.addEventListener('click', function () { setMuted(!muted()); });
      doc.body.appendChild(btn);
    }
```

Add `setMuted: setMuted` to the returned object:

```js
    return { correct: correct, wrong: wrong, finish: finish, purchase: purchase, muted: muted, setMuted: setMuted,
      celebrate: celebrate, celebrateNow: openPop, queued: function () { return queued; } };
```

`tone()` must cope with no AudioContext (it already returns early when muted or unsupported). Check that it doesn't throw in the Node stub. If it does, the test's `win` has no `AudioContext`, and `tone` should already guard that. Read it to confirm.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/browser-globals.test.js tests/fx.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (the user runs it)**

```bash
git add web/engine/fx.js tests/browser-globals.test.js
git commit -m "Let the game menu switch sound; keep the floating sound button in the lobbies only"
```

---

### Task 4: Wiring test (fails until Tasks 5–9 are done)

**Files:**
- Create: `tests/nav-wiring.test.js`

- [ ] **Step 1: Write the test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, appFile, lobbyFile } = require('./paths.js');

const OLD_BACK = ['class="btn-icon" role="button"', 'class="back-link"', 'class="back-btn"', 'Back to Home'];

for (const app of APPS) {
  test(app.id + ' has the Back, Home and Menu bar and no old back buttons', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const grade = 'grade' + app.grade;
    const order = new RegExp('engine/learner\\.js" data-grade="' + grade + '"></script>\\r?\\n<script src="\\.\\./\\.\\./\\.\\./engine/nav\\.js" data-grade="' + grade + '"></script>');
    assert.match(html, order, 'nav.js loads right after learner.js');
    assert.equal(html.split('Nav.start(').length - 1, 1, 'one Nav.start');
    assert.equal(html.split('Nav.screen(').length - 1, 1, 'showScreen tells Nav, once');
    assert.ok(html.lastIndexOf('Nav.start(') < html.lastIndexOf('renderHome();'), 'Nav.start comes before the last renderHome(); (the e2e driver goes after it)');
    for (const old of OLD_BACK) assert.ok(!html.includes(old), 'old back control left: ' + old);
  });
}

for (const grade of [5, 2]) {
  test('the grade ' + grade + ' lobby opens the shop from a #shop link', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    assert.ok(html.includes("if (location.hash === '#shop')"), 'reads #shop on load');
  });
}
```

- [ ] **Step 2: Run it**

Run: `node --test tests/nav-wiring.test.js`
Expected: FAIL for all 15 games and both lobbies. These turn green in Tasks 5–9.

- [ ] **Step 3: Commit (the user runs it, or fold into the Task 5 commit)**

```bash
git add tests/nav-wiring.test.js
git commit -m "Test that every game wires the top bar"
```

---

### Task 5: Family C, the seven Grade 5 games

**Files (each):** `web/subjects/grade-5/{araling-panlipunan,english,filipino,gmrc,pe-health,science,tle}/index.html`

Titles for `Nav.start` (copy from each page's `<h1>`):

| Folder | title |
|---|---|
| araling-panlipunan | `'History Explorers ⛵'` |
| english | `'Page Turners 📖'` |
| filipino | `'Wikaharian 👑'` |
| gmrc | `'Rise & Shine 🏅'` |
| pe-health | `'Rally Ready 🏓'` |
| science | `'Life Lab 🔬'` |
| tle | `'Craft Corner 🧵'` |

Do these steps in every one of the seven files:

- [ ] **Step 1: Load nav.js** right after learner.js:

```html
<script src="../../../engine/learner.js" data-grade="grade5"></script>
<script src="../../../engine/nav.js" data-grade="grade5"></script>
```

- [ ] **Step 2: Remove the three old ← buttons.** Delete each whole line:

```html
      <div class="btn-icon" role="button" tabindex="0" aria-label="Back to home" onclick="goHome()" onkeydown="cardKey(event)">←</div>
```

Keep the surrounding `<div class="topbar">` and its `<h2>`, because they show the lesson title. Then delete the now-unused CSS rules that start with `.btn-icon{` and `.btn-icon:focus-visible{`. Check first with `grep -n "btn-icon" <file>` that nothing else uses them.

- [ ] **Step 3: Rename the results button:**

```html
      <button class="btn ghost full" onclick="goHome()">📚 More lessons</button>
```

- [ ] **Step 4: Tell Nav about screen changes** in `showScreen`:

```js
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (window.Nav) Nav.screen(id);
}
```

- [ ] **Step 5: Start Nav** on the line right before the final `renderHome();` at the end of the main script (use the title from the table):

```js
window.Nav && Nav.start({ title: 'Life Lab 🔬', home: 'home', goHome: goHome, inRound: () => Nav.current() === 'quizScreen' });
```

- [ ] **Step 6: Run the tests for this family**

Run: `node --test tests/nav-wiring.test.js tests/pages.test.js tests/fx.test.js`
Expected: the seven Grade 5 family-C games PASS in nav-wiring. Grade 2, Math and the lobbies still fail. pages and fx PASS.

Run: `node tests/e2e/apps-e2e.js 5`
Expected: all Grade 5 games pass as before. Math is unchanged so far.

- [ ] **Step 7: Commit (the user runs it)**

```bash
git add web/subjects/grade-5
git commit -m "Add the Back, Home and Menu bar to the Grade 5 games"
```

---

### Task 6: Family B, five Grade 2 games

**Files (each):** `web/subjects/grade-2/{computer,english,gmrc,makabansa,science}/index.html`

| Folder | title |
|---|---|
| computer | `'Byte Buddies'` |
| english | `'Word Train'` |
| gmrc | `'Growing Good'` |
| makabansa | `'Batang Bayani'` |
| science | `'Science Detectives'` |

In every one of the five files:

- [ ] **Step 1: Load nav.js** right after learner.js:

```html
<script src="../../../engine/learner.js" data-grade="grade2"></script>
<script src="../../../engine/nav.js" data-grade="grade2"></script>
```

- [ ] **Step 2: Remove the two old back links.** Delete the whole `<button class="back-link" id="back-from-flash">…Lesson List</button>` line in `#screen-flash`, and the `<button class="back-link" id="back-from-quiz">…</button>` line in `#screen-quiz`. Delete their listeners:

```js
  document.getElementById('back-from-flash').addEventListener('click', goHome);
  document.getElementById('back-from-quiz').addEventListener('click', goHome);
```

Keep `#btn-go-home` and its listener: the results button already says "Lesson List" / "Listahan ng Aralin". Delete the three `.back-link` CSS rules (`.back-link{`, `.back-link:focus-visible{`, `.back-link svg{`) after checking with `grep -n "back-link" <file>` that nothing else uses them.

- [ ] **Step 3: Tell Nav about screen changes:**

```js
  function showScreen(name){
    screens.forEach(function(s){
      document.getElementById('screen-'+s).classList.toggle('active', s === name);
    });
    if (window.Nav) Nav.screen(name);
```

(Add only the `Nav.screen` line, keeping whatever already follows inside the function.)

- [ ] **Step 4: Start Nav** on the line right before the final `  renderHome();`:

```js
  window.Nav && Nav.start({ title: 'Word Train', home: 'home', goHome: goHome, inRound: function () { return Nav.current() === 'quiz'; } });
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/nav-wiring.test.js tests/pages.test.js`
Expected: the five family-B games PASS in nav-wiring.

Run: `node tests/e2e/apps-e2e.js`
Expected: all Grade 2 games pass as before.

- [ ] **Step 6: Commit (the user runs it)**

```bash
git add web/subjects/grade-2
git commit -m "Add the Back, Home and Menu bar to five Grade 2 games"
```

---

### Task 7: Family A, Kuwentista and Block Bot

**Files:** `web/subjects/grade-2/filipino/index.html` (title `'Kuwentista'`), `web/subjects/grade-2/math/index.html` (title `'Block Bot'`)

In both files:

- [ ] **Step 1: Load nav.js** right after learner.js (`data-grade="grade2"`, same two lines as Task 6 Step 1).

- [ ] **Step 2: Remove the two old back buttons.** Delete both lines in `#screen-cards` and `#screen-quiz`:

```html
      <button class="back-btn" onclick="goHome()">&larr; Balik</button>
```

(In Block Bot they read `&larr; Back`.) Keep the `.screen-head` and its `<h2>`. Keep the results `secondary-btn` ("Balik sa Aralin" / "Lesson Map"). Delete the `.back-btn{…}` CSS rule after `grep -n "back-btn" <file>` shows no other use.

- [ ] **Step 3: Tell Nav about screen changes:**

```js
function showScreen(el){
  [homeScreen, cardsScreen, quizScreen, resultsScreen].forEach(s=>s.classList.add('hidden'));
  el.classList.remove('hidden');
  window.scrollTo(0,0);
  if (window.Nav) Nav.screen(el.id);
```

(Add only the `Nav.screen` line, keeping the rest of the function.)

- [ ] **Step 4: Start Nav** right before the final `renderHome();`:

```js
window.Nav && Nav.start({ title: 'Kuwentista', home: 'screen-home', goHome: goHome, inRound: () => Nav.current() === 'screen-quiz' });
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/nav-wiring.test.js` then `node tests/e2e/apps-e2e.js`
Expected: all 7 Grade 2 games PASS in both.

- [ ] **Step 6: Commit (the user runs it)**

```bash
git add web/subjects/grade-2/filipino/index.html web/subjects/grade-2/math/index.html
git commit -m "Add the Back, Home and Menu bar to Kuwentista and Block Bot"
```

---

### Task 8: Math Mastery

**Files:** `web/subjects/grade-5/math/index.html`

- [ ] **Step 1: Load nav.js** right after learner.js (`data-grade="grade5"`).

- [ ] **Step 2: Remove all five old back buttons.** Delete the four `<button class="back-btn" onclick="goHome()">&larr; Back</button>` lines (cards, quiz, walkthrough, print screens) and `<button class="back-btn" onclick="caseBack()">&larr; Back</button>` (cases screen). Keep the `.screen-head` blocks, the results "Lesson Map" button, and `#wt-continue`. Keep the `caseBack()` function, because Nav uses it. Delete the `.back-btn{…}` CSS rule.

- [ ] **Step 3: Tell Nav about screen changes:**

```js
function showScreen(el){
  [homeScreen, cardsScreen, quizScreen, resultsScreen, wtScreen, caseScreen, printScreen].forEach(s=>s.classList.add('hidden'));
  el.classList.remove('hidden');
  window.scrollTo(0,0);
  if (window.Nav) Nav.screen(el.id);
```

- [ ] **Step 4: Start Nav** right before the final `renderHome();`. A walkthrough problem is a round until its `#wt-continue` button shows. An open case study (`#case-detail` not hidden) is a round. ← on the cases screen uses `caseBack()`: it closes an open case, or goes home from the case list.

```js
window.Nav && Nav.start({
  title: 'Math Mastery',
  home: 'screen-home',
  goHome: goHome,
  back: () => (Nav.current() === 'screen-cases' ? caseBack() : goHome()),
  inRound: () => {
    const cur = Nav.current();
    if (cur === 'screen-quiz') return true;
    if (cur === 'screen-walkthrough') return !document.getElementById('wt-continue');
    if (cur === 'screen-cases') return !document.getElementById('case-detail').classList.contains('hidden');
    return false;
  }
});
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/nav-wiring.test.js` then `node tests/e2e/apps-e2e.js 5`
Expected: all 15 games PASS in nav-wiring (only the two lobby tests still fail). Math e2e passes.

- [ ] **Step 6: Commit (the user runs it)**

```bash
git add web/subjects/grade-5/math/index.html
git commit -m "Add the Back, Home and Menu bar to Math Mastery"
```

---

### Task 9: Lobbies open the shop from `#shop`

**Files:** `web/lobby/grade-5.html` (near line 1011), `web/lobby/grade-2.html` (near line 981)

- [ ] **Step 1: Implement.** In each lobby, right after the existing `$('shop-open').addEventListener('click', openShop);` block of listeners (after the `$('shop-search')…` line), add:

```js
  if (location.hash === '#shop') {
    history.replaceState(null, '', location.pathname + location.search);
    openShop();
  }
```

`location.search` keeps any query. The hash is cleared so a reload doesn't reopen the shop. If the lobby builds the shop list after this point (e.g. in a later init function), move this block to the end of that init so `openShop()` shows a filled list. Read the code around `openShop` (grade-5 ~line 860) to confirm.

- [ ] **Step 2: Run the tests**

Run: `node --test`
Expected: PASS, everything including both lobby tests in nav-wiring.

Run: `node tests/e2e/lobby-e2e.js` and `node tests/e2e/lobby-e2e.js 5`
Expected: PASS as before.

- [ ] **Step 3: Commit (the user runs it)**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html
git commit -m "Open the shop when a game's menu sends her to the lobby"
```

---

### Task 10: Browser test of the bar

**Files:**
- Create: `tests/e2e/driver-nav.page.js`
- Create: `tests/e2e/nav-e2e.js`
- Modify: `README.md` (test list near line 169)

- [ ] **Step 1: Write the in-page driver** `tests/e2e/driver-nav.page.js`. It runs after the game's final `renderHome();`. `__NAV_QUIZ` is the game's start-quiz call and is set by the runner.

```js
(function () {
  var went = [];
  Nav.go = function (url) { went.push(url); };
  var $ = function (id) { return document.getElementById(id); };
  var out = { errors: window.__e2eErrors || [] };

  out.barFirst = document.body.firstElementChild && document.body.firstElementChild.id === 'nav-bar';
  out.noFloatingMute = !$('fx-mute');

  $('nav-back').click();
  out.backFromHome = went.pop();

  __NAV_QUIZ();
  out.quizScreen = Nav.current();
  $('nav-back').click();
  out.askShown = !$('nav-confirm').hidden;
  $('nav-keep').click();
  out.keptScreen = Nav.current();
  out.askHiddenAfterKeep = $('nav-confirm').hidden;

  $('nav-back').click();
  $('nav-leave').click();
  out.afterLeave = Nav.current();

  $('nav-menu').click();
  out.menuOpen = !$('nav-sheet').hidden;
  var before = window.Fx.muted();
  $('nav-sound').click();
  out.soundToggled = window.Fx.muted() !== before;
  $('nav-sound').click();
  $('nav-shop').click();
  out.shop = went.pop();
  out.menuClosed = $('nav-sheet').hidden;

  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
})();
```

- [ ] **Step 2: Write the runner** `tests/e2e/nav-e2e.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile } = require('../paths.js');

// One game per family: start a quiz the way each family's own e2e driver does.
const CASES = [
  { id: 'life-lab', lobby: '../../../lobby/grade-5.html', home: 'home', quiz: 'quizScreen', start: 'currentLessonIdx = 0; startQuiz();' },
  { id: 'math-mastery', lobby: '../../../lobby/grade-5.html', home: 'screen-home', quiz: 'screen-quiz', start: 'currentLessonIdx = 0; startQuiz();' },
  { id: 'word-train', lobby: '../../../lobby/grade-2.html', home: 'home', quiz: 'quiz', start: 'currentLessonIdx = 0; startQuiz();' },
  { id: 'kuwentista', lobby: '../../../lobby/grade-2.html', home: 'screen-home', quiz: 'screen-quiz', start: 'currentLessonIdx = 0; startQuiz();' },
];

const work = makeWorkDir('nav-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'driver-nav.page.js'), 'utf8');

for (const c of CASES) {
  const html = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'function __NAV_QUIZ(){ ' + c.start + ' }\n' + driver);
  const file = stage(path.join(work, c.id), app(c.id).page, html, ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile-' + c.id), file));
  assert.deepEqual(r.errors, [], c.id + ': page errors');
  assert.equal(r.barFirst, true, c.id + ': the bar is the first thing on the page');
  assert.equal(r.noFloatingMute, true, c.id + ': no floating sound button in games');
  assert.equal(r.backFromHome, c.lobby, c.id + ': ← on the home goes to the lobby');
  assert.equal(r.quizScreen, c.quiz, c.id + ': the quiz started');
  assert.equal(r.askShown, true, c.id + ': ← during a quiz asks first');
  assert.equal(r.keptScreen, c.quiz, c.id + ': Keep playing stays in the quiz');
  assert.equal(r.askHiddenAfterKeep, true, c.id + ': the check closes');
  assert.equal(r.afterLeave, c.home, c.id + ': Leave goes to the game home');
  assert.equal(r.menuOpen, true, c.id + ': ☰ opens the menu');
  assert.equal(r.soundToggled, true, c.id + ': the menu switches sound');
  assert.equal(r.shop, c.lobby + '#shop', c.id + ': Shop goes to the lobby shop');
  assert.equal(r.menuClosed, true, c.id + ': picking an item closes the menu');
  console.log('ok ' + c.id);
}
```

- [ ] **Step 3: Check the quiz-start calls.** Open each family's existing driver (`driver-family-c.page.js`, `driver-math.page.js`, `driver-family-b.page.js`, `driver-family-a.page.js`). Copy the exact statement each one uses to start a lesson quiz (search for `startQuiz`), and put it in that case's `start` string if it differs from `currentLessonIdx = 0; startQuiz();`. Also check that `app(id).page` is the right helper name in `tests/paths.js` (it exports `app`).

- [ ] **Step 4: Run it**

Run: `node tests/e2e/nav-e2e.js`
Expected: `ok life-lab`, `ok math-mastery`, `ok word-train`, `ok kuwentista`, and exit code 0.

- [ ] **Step 5: List it in the README.** Under the e2e commands (near `README.md:169`), add:

```
node tests/e2e/nav-e2e.js            # top bar: Back, Home, Menu and the leave-the-quiz check
```

Wherever the README lists the engine files, add `nav.js` after `learner.js` with "top bar: Back, Home, Menu".

- [ ] **Step 6: Run everything**

Run each and expect PASS:
- `node --test`
- `node tests/e2e/apps-e2e.js`
- `node tests/e2e/apps-e2e.js 5`
- `node tests/e2e/lobby-e2e.js`
- `node tests/e2e/lobby-e2e.js 5`
- `node tests/e2e/backup-e2e.js`
- `node tests/e2e/file-check-e2e.js`
- `node tests/e2e/migration-e2e.js`
- `node tests/e2e/nav-e2e.js`

- [ ] **Step 7: Mark the spec built.** In `docs/superpowers/specs/2026-10-03-game-navigation-design.md` change `Status: approved design, not built` to `Status: built 2026-10-03`.

- [ ] **Step 8: Commit (the user runs it)**

```bash
git add tests/e2e/driver-nav.page.js tests/e2e/nav-e2e.js README.md docs/superpowers/specs/2026-10-03-game-navigation-design.md
git commit -m "Test the game top bar in the browser and document it"
```

---

## Manual check on the tablet (user, after deploy)

1. Open the installed Grade 5 app → any game. The bar shows at the top. Tap 🏠 and you land in the lobby.
2. Start a quiz, tap ←, and the check appears. Tap Keep playing and you stay on the same question. Tap ← then Leave and you're on the game home.
3. Swipe back (Android) on a lesson screen and you go to the game home. Swipe back again and you're in the lobby.
4. Tap ☰ → Shop and the lobby opens with the shop showing.
5. Repeat on the Grade 2 tablet, and check that the check shows the Filipino line.
