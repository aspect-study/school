# World as home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules that override the skill defaults:** never run `git commit` (the owner does); never add `Co-Authored-By` or any AI attribution anywhere. Each task ends with a suggested commit command in a code block for the owner. Browser JS in `web/` is ES5 in an IIFE `(function (root) {...})(this)` (`var`, `function`, no arrow functions, no `const`/`let`, no template strings); tests and `tools/` are modern Node. Comments only for non-obvious code. Never use fully-qualified names inline. After adding a file under `web/`, run `node tools/update-precache.js`.

**Goal:** The 3D world is the kids' home: the lobby forwards to it, the world syncs and runs the daily quest and boss upkeep, the HUD shows coins and quests, and the reward shop, coin guide and parent area open as lobby sections inside the world's frame.

**Architecture:** `web/engine/embed.js` (moved out of `nav.js`) tells a page it is inside the world's frame and posts the close message with an optional `then`. `web/engine/home.js` forwards a lobby to the world when 3D can run and names the lobby section to show when embedded. `web/engine/lobby-embed.js` turns a lobby page in the frame into a single section and closes the frame when that section closes. `cloud.js` gets `Cloud.hold(on)` so the world's sync waits while a frame is open. In the world, a pure `web/world/hud.js` formats the 🪙 and 🎯 pills, and `world-main.js` wires the pills, the quests card, the upkeep, the sync, the sections in the portal and the learner-change reload.

**Tech Stack:** plain browser JS (ES5 IIFE), Node 22 (`node --test`), headless-Chrome e2e scripts in `tests/e2e` (the http static server from the games-in-world work).

Spec: `docs/superpowers/specs/2026-10-11-world-as-home-design.md`.

**Plan-level refinements of the spec:**
- `forwardTo` also never forwards a `file:` page (like `cloud.js`, which never syncs on `file:`). The existing lobby e2e scripts load lobbies from `file://`, so they need no `?stay=1`; only the new `home-e2e.js` (served over http) sees the forward.
- The lobby's embed mode lives in one new engine file, `lobby-embed.js`, loaded last by both lobbies, so the two lobbies' inline shop and parent scripts stay identical (`tests/copies.test.js`).
- Instead of a world-side timer, the world uses `cloud.js`'s own 2-minute timer and calls `Cloud.hold(true/false)` around the frame.
- The quests card uses `Quests.text.title` as its title and hides the box's own title line, so no new quest wording is needed.

## File map

- Create `web/engine/embed.js`, `tests/embed.test.js`.
- Create `web/engine/home.js`, `tests/home.test.js`.
- Create `web/engine/lobby-embed.js`.
- Create `web/world/hud.js`, `tests/world3d-hud.test.js`.
- Create `tests/e2e/home-e2e.js`, `tests/e2e/home-world.page.js`.
- Modify `web/engine/nav.js`, `tests/nav.test.js`, `tests/nav-wiring.test.js` (embed moved out).
- Modify the 17 game pages: load `embed.js` (script tag only).
- Modify `web/lobby/grade-2.html`, `web/lobby/grade-5.html`: load `embed.js`, `home.js` early and `lobby-embed.js` last; embed guards in three inline scripts; `#shop-world` removed.
- Modify `web/engine/cloud.js`: `Cloud.hold`.
- Modify `web/world/portal.js`, `tests/world3d-portal.test.js`: accept `then` of `'shop'`, `'lobby'`, `'account'`.
- Modify `web/world/grade-2.html`, `web/world/grade-5.html`: sync scripts, `hud.js`, resting link `?stay=1`.
- Modify `web/world/world-main.js`, `web/world/text.js`, `web/world/world.css`.
- Modify `tests/paths.js`, `tests/world3d-wiring.test.js`, `tests/world3d-text.test.js`, `tests/e2e/world-e2e.js`, `tests/e2e/world-driver.page.js`.
- Modify `web/sw.js` (generated), `README.md`, `docs/HANDOFF.md`.

---

### Task 1: `embed.js` (moved out of `nav.js`)

**Files:**
- Create: `web/engine/embed.js`, `tests/embed.test.js`
- Modify: `web/engine/nav.js`, `tests/nav.test.js`, `tests/nav-wiring.test.js`, the 17 game pages, `tests/paths.js`, `web/world/portal.js`, `tests/world3d-portal.test.js`

- [ ] **Step 1: Move the helper tests and add the new ones (failing)**

In `tests/nav.test.js`, delete the three tests that test `isEmbedded`, `closeMessage` and `targetOrigin` ("a game is embedded only with ?embed=1…", "leaving an embedded game asks the world to close the frame…", "the close message goes to the page's own origin…") and remove those three names from the `require` line.

Create `tests/embed.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { isEmbedded, closeMessage, targetOrigin, close } = require(engineFile('embed.js'));

test('a page is embedded only with ?embed=1 and inside another window', () => {
  const top = { location: { search: '?embed=1' } };
  top.parent = top;
  assert.equal(isEmbedded(top), false, 'opened on its own, even with the flag');
  assert.equal(isEmbedded({ location: { search: '?reset=1&embed=1' }, parent: {} }), true);
  assert.equal(isEmbedded({ location: { search: '?embed=10' }, parent: {} }), false);
  assert.equal(isEmbedded({ location: { search: '' }, parent: {} }), false);
  assert.equal(isEmbedded({ get location() { throw new Error('blocked'); } }), false);
});

test('leaving an embedded game asks the world to close the frame; the shop asks for the shop after', () => {
  assert.deepEqual(closeMessage('../../../world/grade-5.html'), { type: 'portal-close' });
  assert.deepEqual(closeMessage('../../../lobby/grade-5.html#shop'), { type: 'portal-close', then: 'shop' });
});

test('the close message goes to the page\'s own origin; file pages (origin "null") use *', () => {
  assert.equal(targetOrigin('https://study-game.example'), 'https://study-game.example');
  assert.equal(targetOrigin('null'), '*');
  assert.equal(targetOrigin(undefined), '*');
});

test('close posts portal-close to the parent, with then only when given', () => {
  const sent = [];
  const win = { location: { origin: 'https://a.test' }, parent: { postMessage: (m, o) => sent.push([m, o]) } };
  close(win);
  close(win, 'account');
  assert.deepEqual(sent, [[{ type: 'portal-close' }, 'https://a.test'], [{ type: 'portal-close', then: 'account' }, 'https://a.test']]);
});
```

Run: `node --test tests/embed.test.js`
Expected: FAIL, cannot find `web/engine/embed.js`.

- [ ] **Step 2: Create `web/engine/embed.js`**

```js
/* Inside the 3D world's frame (web/world/portal.js) a page opens with ?embed=1. These tell a page it is there and let
   it ask the world to close the frame, with an optional next step (then) for the world. */
(function (root) {
  'use strict';

  function isEmbedded(win) {
    try { return /[?&]embed=1(&|$)/.test(win.location.search) && !!win.parent && win.parent !== win; } catch (e) { return false; }
  }

  function closeMessage(url) {
    return /#shop$/.test(url) ? { type: 'portal-close', then: 'shop' } : { type: 'portal-close' };
  }

  function targetOrigin(origin) { return origin && origin !== 'null' ? origin : '*'; }

  function close(win, then) {
    var msg = { type: 'portal-close' };
    if (then) msg.then = then;
    win.parent.postMessage(msg, targetOrigin(win.location.origin));
  }

  var exported = { isEmbedded: isEmbedded, closeMessage: closeMessage, targetOrigin: targetOrigin, close: close };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Embed = exported;
})(this);
```

Run: `node --test tests/embed.test.js`
Expected: PASS (4 tests).

- [ ] **Step 3: `nav.js` uses `Embed`**

In `web/engine/nav.js`:
- Delete the functions `isEmbedded`, `closeMessage` and `targetOrigin` and the comment above them.
- In `create()`, replace `var embedded = isEmbedded(win);` with `var E = win.Embed, embedded = !!(E && E.isEmbedded(win));`.
- Replace the embed branch of `api.go` with `function (url) { E.close(win, E.closeMessage(url).then); }`.
- Remove `isEmbedded`, `closeMessage`, `targetOrigin` from `exported`.

- [ ] **Step 4: Games load `embed.js` (wiring test first)**

In `tests/nav-wiring.test.js`, change the `order` regex so `embed.js` sits right after `learner.js`:

```js
    const order = new RegExp('engine/learner\.js" data-grade="' + grade + '"></script>\r?\n<script src="\.\./\.\./\.\./engine/embed\.js"></script>\r?\n(<script src="\.\./\.\./\.\./engine/clock\.js" data-grade="' + grade + '"></script>\r?\n)?<script src="\.\./\.\./\.\./engine/nav\.js" data-grade="' + grade + '"></script>');
    assert.match(html, order, 'embed.js loads right after learner.js, then the date guard if present, then nav.js');
```

Run: `node --test tests/nav-wiring.test.js` → 17 FAIL.

In each of the 17 game pages insert, on the line after the `learner.js` tag:

```html
<script src="../../../engine/embed.js"></script>
```

A safe way from the repo root:

```bash
node -e "const fs=require('fs');for(const f of process.argv.slice(1)){let t=fs.readFileSync(f,'utf8');const m=t.match(/(<script src=\"\.\.\/\.\.\/\.\.\/engine\/learner\.js\" data-grade=\"grade\d\"><\/script>\r?\n)/);if(!m)throw new Error(f);t=t.replace(m[1],m[1]+'<script src=\"../../../engine/embed.js\"></script>\n');fs.writeFileSync(f,t);console.log('ok '+f);}" web/subjects/grade-2/*/index.html web/subjects/grade-5/*/index.html
```

In `tests/paths.js`, add `'embed.js'` to `ENGINE_FILES` right after `'learner.js'`.

- [ ] **Step 5: The portal accepts the new `then` values**

In `tests/world3d-portal.test.js`, in the test 'a close message asking for the shop passes it on', add after the existing checks:

```js
  for (const then of ['lobby', 'account']) {
    const t = rig();
    t.portal.open('shop', HREF, '#7bd88f', 'Shop');
    t.msg({ type: 'portal-close', then });
    assert.equal(t.log.at(-1), 'closed:' + then);
  }
```

In `web/world/portal.js`, add near the timing constants `var THEN = ['shop', 'lobby', 'account'];`, change the message handler's close call to `close(THEN.indexOf(evt.data.then) >= 0 ? evt.data.then : undefined, false);` and add `THEN: THEN` to `exported`.

- [ ] **Step 6: Run everything that touches it**

Run: `node tools/update-precache.js`, `node --test`, `node tests/e2e/nav-e2e.js`, `node tests/e2e/portal-e2e.js`
Expected: all pass.

- [ ] **Step 7: Suggested commit (owner runs it)**

```bash
git add web/engine/embed.js tests/embed.test.js web/engine/nav.js tests/nav.test.js tests/nav-wiring.test.js web/subjects tests/paths.js web/world/portal.js tests/world3d-portal.test.js web/sw.js && git commit -m 'Embed helpers move to engine/embed.js (games load it); the frame accepts then lobby and account' -- web/engine/embed.js tests/embed.test.js web/engine/nav.js tests/nav.test.js tests/nav-wiring.test.js web/subjects tests/paths.js web/world/portal.js tests/world3d-portal.test.js web/sw.js
```

---

### Task 2: `home.js`: the lobby forwards to the world

**Files:**
- Create: `web/engine/home.js`, `tests/home.test.js`
- Modify: `web/lobby/grade-2.html`, `web/lobby/grade-5.html`, `tests/paths.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/home.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile, lobbyFile } = require('./paths.js');
const { forwardTo, sectionOf, SECTIONS } = require(engineFile('home.js'));

const HTTP = { protocol: 'https:', search: '', hash: '' };

test('a lobby that can run 3D forwards to its grade\'s world', () => {
  assert.equal(forwardTo(HTTP, 'grade5', true, false), '../world/grade-5.html');
  assert.equal(forwardTo(HTTP, 'grade2', true, false), '../world/grade-2.html');
});

test('the lobby stays without 3D, inside the frame, with ?stay=1, on a lobby section, and on file pages', () => {
  assert.equal(forwardTo(HTTP, 'grade5', false, false), null, 'no 3D');
  assert.equal(forwardTo(HTTP, 'grade5', true, true), null, 'inside the world frame');
  assert.equal(forwardTo(Object.assign({}, HTTP, { search: '?stay=1' }), 'grade5', true, false), null);
  assert.equal(forwardTo(Object.assign({}, HTTP, { search: '?a=1&stay=1' }), 'grade5', true, false), null);
  assert.equal(forwardTo(Object.assign({}, HTTP, { search: '?stay=10' }), 'grade5', true, false), '../world/grade-5.html');
  for (const s of SECTIONS) assert.equal(forwardTo(Object.assign({}, HTTP, { hash: '#' + s }), 'grade5', true, false), null, s);
  assert.equal(forwardTo(Object.assign({}, HTTP, { protocol: 'file:' }), 'grade5', true, false), null);
});

test('the frame shows the named lobby section, the shop when unnamed', () => {
  assert.deepEqual(SECTIONS, ['shop', 'coins', 'parent']);
  assert.equal(sectionOf('#parent'), 'parent');
  assert.equal(sectionOf('#coins'), 'coins');
  assert.equal(sectionOf('#shop'), 'shop');
  assert.equal(sectionOf(''), 'shop');
  assert.equal(sectionOf('#nope'), 'shop');
});

for (const n of [5, 2]) {
  test('grade ' + n + ' lobby loads embed.js and home.js right after learner.js', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    assert.ok(html.includes('<script src="../engine/learner.js" data-grade="grade' + n + '"></script>\n<script src="../engine/embed.js"></script>\n<script src="../engine/home.js" data-grade="grade' + n + '"></script>\n'));
  });
}
```

Run: `node --test tests/home.test.js` → FAIL (no `home.js`).

- [ ] **Step 2: Create `web/engine/home.js`**

```js
/* Home is the 3D world. A lobby page forwards there when 3D can run (not inside the world's frame, not with ?stay=1,
   not for a lobby section, not as a file). Inside the frame, the lobby shows one section, named by the hash. */
(function (root) {
  'use strict';

  var SECTIONS = ['shop', 'coins', 'parent'];

  function sectionOf(hash) {
    var h = String(hash || '').replace(/^#/, '');
    return SECTIONS.indexOf(h) >= 0 ? h : 'shop';
  }

  // loc = { protocol, search, hash }.
  function forwardTo(loc, grade, canRun, embedded) {
    if (!canRun || embedded || loc.protocol === 'file:') return null;
    if (/[?&]stay=1(&|$)/.test(loc.search || '')) return null;
    if (SECTIONS.indexOf(String(loc.hash || '').replace(/^#/, '')) >= 0) return null;
    return '../world/grade-' + (grade === 'grade2' ? '2' : '5') + '.html';
  }

  function canRun(doc) {
    try {
      var c = doc.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  var exported = { SECTIONS: SECTIONS, sectionOf: sectionOf, forwardTo: forwardTo, canRun: canRun };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Home = exported;
  try {
    var script = root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var embedded = !!(root.Embed && root.Embed.isEmbedded(root));
    // Read now: the shop script strips the hash before lobby-embed.js runs.
    exported.section = embedded ? sectionOf(root.location.hash) : null;
    var url = grade ? forwardTo(root.location, grade, canRun(root.document), embedded) : null;
    if (url) root.location.replace(url);
  } catch (e) {}
})(this);
```

- [ ] **Step 3: Load them in both lobbies**

In `web/lobby/grade-5.html` and `web/lobby/grade-2.html`, on the line after `<script src="../engine/learner.js" data-grade="gradeN"></script>` add:

```html
<script src="../engine/embed.js"></script>
<script src="../engine/home.js" data-grade="gradeN"></script>
```

(`gradeN` is `grade5` or `grade2`.) In `tests/paths.js`, add `'home.js'` to `ENGINE_FILES` after `'embed.js'`.

- [ ] **Step 4: Run the tests**

Run: `node tools/update-precache.js`, `node --test`, `node tests/e2e/lobby-e2e.js 5`
Expected: all pass (the lobby e2e loads `file://` pages, which never forward).

- [ ] **Step 5: Suggested commit (owner runs it)**

```bash
git add web/engine/home.js tests/home.test.js web/lobby/grade-2.html web/lobby/grade-5.html tests/paths.js web/sw.js && git commit -m 'Home is the world: the lobby forwards to the 3D world when 3D can run (stay=1, no 3D, the frame and file pages stay)' -- web/engine/home.js tests/home.test.js web/lobby/grade-2.html web/lobby/grade-5.html tests/paths.js web/sw.js
```

---

### Task 3: The lobby inside the frame shows one section

**Files:**
- Create: `web/engine/lobby-embed.js`
- Modify: `web/lobby/grade-2.html`, `web/lobby/grade-5.html`, `tests/world3d-wiring.test.js`, `tests/home.test.js`, `tests/e2e/world-e2e.js`

Read first: in each lobby, the shop script (`<script data-shop>`, ~line 840-1120: `fromWorld`, `ShopReturn`, `closeByHand`, the first-visit `W.showGuide()`), `showQuests()` (~line 745), the `<script data-world>` line, and `web/engine/parent-panel.js` `mountLobby` (`#parent-open`, `#parent-close`, `#account-open`). `web/engine/wallet.js` builds the coin guide overlay (find its class name near `overlay = el(`; the plan calls it `.cg-overlay`, use the real one) and exposes `Wallet.showGuide()` and `Wallet.guideOpen()`.

- [ ] **Step 1: Wiring tests (failing)**

Append to `tests/home.test.js`:

```js
for (const n of [5, 2]) {
  test('grade ' + n + ' lobby loads lobby-embed.js last and guards its background jobs inside the frame', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(srcs.at(-1), '../engine/lobby-embed.js');
    assert.ok(!html.includes('#shop-world') && !html.includes('ShopReturn'), 'the old shop-as-a-page path is gone');
    assert.ok(html.includes('if (window.Embed && Embed.isEmbedded(window)) return;'), 'jobs skip inside the frame');
  });
}
```

In `tests/world3d-wiring.test.js`, delete the assertions about `#shop-world` and `ShopReturn` (around lines 70-80) and the test around them if nothing else remains in it.

Run: `node --test tests/home.test.js` → the new tests FAIL.

- [ ] **Step 2: Remove `#shop-world` from both lobbies (identical edits)**

In the shop script of each lobby:
- Delete `var fromWorld = location.hash === '#shop-world';` and `window.ShopReturn = …;`.
- Delete the function `closeByHand` and its comment; every use of `closeByHand` becomes `closeShop` (the ✕ listener and the Escape key).
- In `closeShop`, delete `fromWorld = false;`.
- Change `if (location.hash === '#shop' || fromWorld) {` to `if (location.hash === '#shop') {`.
- Guard the first-visit guide: `if (!seen && W.showGuide && !(window.Embed && Embed.isEmbedded(window))){`.

In `tests/e2e/world-e2e.js`, delete the "lobby shop opened from the world sends her back" case (the block that stages the lobby with `#shop-world` and asserts `shop.open` / `shop.went`, around lines 170-184, and its `console.log`).

- [ ] **Step 3: Guard the lobby's background jobs (identical edits in both lobbies)**

- First line inside `function showQuests(){`: `if (window.Embed && Embed.isEmbedded(window)) return;`
- The `<script data-world>` line becomes:

```html
<script data-world>window.addEventListener('pageshow', function () { if (window.Embed && Embed.isEmbedded(window)) return; try { sessionStorage.removeItem('world_return_v1'); } catch (e) {} });</script>
```

(The world page shares `sessionStorage` with its frame; the lobby in the frame must not clear the world's return note.)

- [ ] **Step 4: Create `web/engine/lobby-embed.js`**

```js
/* A lobby page inside the 3D world's frame (?embed=1) shows just one section: the reward shop, the coin guide or the
   parent area (home.js reads which from the hash). When that section closes, the frame closes. In the parent area,
   Account and Open the lobby page leave the frame for the world to open as full pages. */
(function (root) {
  'use strict';
  var E = root.Embed, H = root.Home, doc = root.document;
  if (!E || !H || !E.isEmbedded(root) || !H.section) return;

  var section = H.section;
  function $(id) { return doc.getElementById(id); }
  var isOpen = {
    shop: function () { return !$('shop-overlay').hidden; },
    parent: function () { return !$('parent-overlay').hidden; },
    coins: function () { return !!(root.Wallet && root.Wallet.guideOpen && root.Wallet.guideOpen()); }
  }[section];

  doc.documentElement.classList.add('lobby-embed');
  var style = doc.createElement('style');
  style.textContent =
    '.lobby-embed body{background:var(--bg);}' +
    '.lobby-embed body>*:not(#shop-overlay):not(#parent-overlay):not(.cg-overlay){display:none !important;}';
  doc.head.appendChild(style);

  if (root.Wallet && root.Wallet.guideOpen && root.Wallet.guideOpen() && section !== 'coins') doc.querySelector('.cg-overlay').hidden = true;
  if (section === 'shop' && !isOpen()) $('shop-open').click();
  if (section === 'parent') $('parent-open').click();
  if (section === 'coins' && root.Wallet && root.Wallet.showGuide) root.Wallet.showGuide();

  var closed = false;
  function done(then) {
    if (closed) return;
    closed = true;
    E.close(root, then);
  }
  new root.MutationObserver(function () { if (!isOpen()) done(); })
    .observe(doc.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });

  if (section === 'parent') {
    var account = $('account-open');
    if (account) account.addEventListener('click', function (e) { e.preventDefault(); done('account'); });
    var lobby = doc.createElement('button');
    lobby.type = 'button';
    lobby.className = 'p-btn';
    lobby.id = 'open-lobby';
    lobby.textContent = '🏫 Open the lobby page';
    lobby.addEventListener('click', function () { done('lobby'); });
    $('parent-close').insertAdjacentElement('afterend', lobby);
  }
})(this);
```

Before saving, replace `.cg-overlay` (two places) with the coin guide overlay's real class from `wallet.js`. If the shop does not open on `#shop` by itself (it does today: the shop script opens it and strips the hash), the `click()` covers it.

- [ ] **Step 5: Load it with the other engine files in both lobbies**

The lobbies load every engine file together near the end of the page (`lang.js` … `install.js`), then
`<script data-file-check>`, then the inline scripts (the shop, `ParentPanel.mount`). `tests/pages.test.js` forbids a
shared file after the file check. So add, right after `<script src="../engine/install.js" data-grade="gradeN"></script>`:

```html
<script src="../engine/lobby-embed.js"></script>
```

and make `lobby-embed.js` wait for the inline scripts: wrap everything after the `if (… !H.section) return;` guard in

```js
  function start() {
    // (the body from "var section = H.section;" to the end)
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
```

(`DOMContentLoaded` fires after every inline script has run, so the shop and parent panel are wired by then.) It is
then the last `<script src>` in the page, which the Step 1 test checks. Add `'lobby-embed.js'` to `ENGINE_FILES` in
`tests/paths.js`.

- [ ] **Step 6: Run the tests**

Run: `node tools/update-precache.js`, `node --test`, `node tests/e2e/lobby-e2e.js 5`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/world-e2e.js`
Expected: all pass.

- [ ] **Step 7: Suggested commit (owner runs it)**

```bash
git add web/engine/lobby-embed.js web/lobby/grade-2.html web/lobby/grade-5.html tests/home.test.js tests/world3d-wiring.test.js tests/e2e/world-e2e.js tests/paths.js web/sw.js && git commit -m 'Lobby in the world frame: one section (shop, coin guide, parent area), closing it closes the frame; #shop-world removed' -- web/engine/lobby-embed.js web/lobby/grade-2.html web/lobby/grade-5.html tests/home.test.js tests/world3d-wiring.test.js tests/e2e/world-e2e.js tests/paths.js web/sw.js
```

---

### Task 4: `Cloud.hold`

**Files:**
- Modify: `web/engine/cloud.js`, `tests/browser-globals.test.js` (or a new small test if that file does not fit)

- [ ] **Step 1: Failing test**

`cloud.js` returns early on `file:` and without a learner, leaving the stub. Add a test that the stub has `hold` (so the world can always call it). In `tests/browser-globals.test.js` (it runs engine files in a VM without a page), add:

```js
test('Cloud always has hold, even when sync is off', () => {
  const win = browser('storage.js', 'cloud.js');
  assert.equal(typeof win.Cloud.hold, 'function');
  win.Cloud.hold(true);
  win.Cloud.hold(false);
});
```

If `browser()` cannot run `cloud.js` (it needs `document` or `location`), give the VM window the minimum it needs (`location: { protocol: 'file:' }`, `document: { readyState: 'complete', addEventListener() {} }`) inside this test only.

Run: `node --test tests/browser-globals.test.js` → FAIL (`hold` is not a function).

- [ ] **Step 2: Implement**

In `web/engine/cloud.js`:
- Add `hold: function () {},` to the stub `root.Cloud = { … }`.
- Next to `var connected = false, …` add `held = false, heldMissed = false` to the same `var` list.
- At the very top of `runSync`: `if (held) { heldMissed = true; return Promise.resolve(); }` (match `runSync`'s real return; if it returns nothing, just `return;`).
- After `root.Cloud.sync = runSync;` add:

```js
  // The 3D world holds its sync while a page runs in its frame (that page syncs itself), then catches up once.
  root.Cloud.hold = function (on) {
    held = !!on;
    if (!held && heldMissed) { heldMissed = false; runSync(); }
  };
```

- [ ] **Step 3: Run the tests**

Run: `node --test`, `node tests/e2e/lobby-e2e.js 5`
Expected: all pass.

- [ ] **Step 4: Suggested commit (owner runs it)**

```bash
git add web/engine/cloud.js tests/browser-globals.test.js && git commit -m 'Cloud.hold: the world pauses its sync while a frame is open and catches up after' -- web/engine/cloud.js tests/browser-globals.test.js
```

---

### Task 5: `hud.js` pills and the world page's new scripts

**Files:**
- Create: `web/world/hud.js`, `tests/world3d-hud.test.js`
- Modify: `web/world/grade-5.html`, `web/world/grade-2.html`, `tests/paths.js`, `tests/world3d-wiring.test.js`

- [ ] **Step 1: Failing tests**

Create `tests/world3d-hud.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const H = require(worldFile('hud.js'));

test('the coin pill shows the whole balance, never below zero', () => {
  assert.equal(H.pills({ coins: 125, done: 0, total: 3, streak: 0 }).coins, '🪙 125');
  assert.equal(H.pills({ coins: 12.7, done: 0, total: 3, streak: 0 }).coins, '🪙 12');
  assert.equal(H.pills({ coins: -4, done: 0, total: 3, streak: 0 }).coins, '🪙 0');
  assert.equal(H.pills({ coins: undefined, done: 0, total: 3, streak: 0 }).coins, '🪙 0');
});

test('the quests pill shows done of total and the streak, no flame at 0', () => {
  assert.equal(H.pills({ coins: 0, done: 2, total: 3, streak: 4 }).quests, '🎯 2/3 🔥4');
  assert.equal(H.pills({ coins: 0, done: 0, total: 3, streak: 0 }).quests, '🎯 0/3');
  assert.equal(H.pills({ coins: 0, done: 0, total: 0, streak: 2 }).quests, '🎯 🔥2', 'no quests yet');
});
```

Run: `node --test tests/world3d-hud.test.js` → FAIL.

- [ ] **Step 2: Create `web/world/hud.js`**

```js
/* The world HUD's two pills: her coins, and today's quests with her streak. */
(function (root) {
  'use strict';

  function pills(s) {
    var coins = '🪙 ' + Math.max(0, Math.floor(Number(s.coins) || 0));
    var quests = '🎯' + (s.total > 0 ? ' ' + s.done + '/' + s.total : '');
    if (s.streak > 0) quests += ' 🔥' + s.streak;
    return { coins: coins, quests: quests };
  }

  var exported = { pills: pills };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Hud = exported;
})(this);
```

Run: `node --test tests/world3d-hud.test.js` → PASS.

- [ ] **Step 3: Load the sync files and `hud.js` in the world pages (wiring test first)**

In `tests/paths.js`:
- `WORLD_FILES`: insert `'hud.js'` right before `'world-main.js'` (after `'portal.js'`).
- `WORLD_ENGINES`: append `'sync-core', 'firebase-config', 'firebase-remote', 'cloud'` after `'study-kit'` (the lobby's order).

In `tests/world3d-wiring.test.js`, the `NO_GRADE` list must name every engine file the world loads without `data-grade`: copy each of the four sync files' exact tags from `web/lobby/grade-5.html` (with or without `data-grade`) and add those loaded without it to `NO_GRADE`. Also change the resting card assertion to `assert.ok(html.includes('href="../lobby/grade-' + n + '.html?stay=1"'), 'the resting card opens the lobby, which then stays');`.

Run: `node --test tests/world3d-wiring.test.js` → FAIL.

In `web/world/grade-5.html` and `web/world/grade-2.html`:
- After the `study-kit.js` tag, add the four sync tags as the lobby has them (same attributes; `data-grade` value `grade5`/`grade2` to match the page).
- Before `<script src="world-main.js"></script>`, add `<script src="hud.js"></script>`.
- Resting link: `href="../lobby/grade-N.html"` → `href="../lobby/grade-N.html?stay=1"`.

- [ ] **Step 4: Run the tests**

Run: `node tools/update-precache.js`, `node --test`
Expected: all pass.

- [ ] **Step 5: Suggested commit (owner runs it)**

```bash
git add web/world/hud.js tests/world3d-hud.test.js web/world/grade-5.html web/world/grade-2.html tests/paths.js tests/world3d-wiring.test.js web/sw.js && git commit -m 'World: HUD pill text (hud.js), loads the sync files, resting card opens the lobby with stay=1' -- web/world/hud.js tests/world3d-hud.test.js web/world/grade-5.html web/world/grade-2.html tests/paths.js tests/world3d-wiring.test.js web/sw.js
```

---

### Task 6: The world takes over (pills, quests card, sections, upkeep, sync, learner change)

**Files:**
- Modify: `web/world/world-main.js`, `web/world/text.js`, `web/world/world.css`, `tests/world3d-text.test.js`

Read first in `world-main.js`: `start()` top (`meL`, `lobbyUrl`, `hud = buildHud()`), `refresh()`, the portal block (`pauseWorld`, `W.Portal.create`, `onClosed`, `openGame`), `W.Folk.create` (`shop:`), `openOverlay`/`closeOverlay`/`focusFirst`, `openSettings`, `buildHud`, and the start sequence near the end (`refresh(); dress(…); … welcome(ret);`).

- [ ] **Step 1: Text for the parents button**

In `web/world/text.js`, add `parents: '🔒 For parents',` to `TEXT.grade5` and `TEXT.grade2` next to `settings`. In `tests/world3d-text.test.js`, add `'parents'` to `ENGLISH_ONLY`. Remove the now-unused `lobby` key from both tables and from `ENGLISH_ONLY` only if nothing else uses `T.lobby` (grep `web/world`); otherwise leave it.

Run: `node --test tests/world3d-text.test.js` → PASS.

- [ ] **Step 2: HUD pills replace the title and the lobby pill**

In `buildHud()`:
- Replace `top.appendChild(el('div', 'w-pill', '🌍 ' + T.title));` with:

```js
      var coinsPill = button('w-pill w-coins', '🪙', function () { if (calm()) openSection('coins'); });
      coinsPill.id = 'hud-coins';
      var questsPill = button('w-pill w-quests-pill', '🎯', function () { if (calm()) openQuests(); });
      questsPill.id = 'hud-quests';
      var left = el('div', 'w-hud-left');
      left.appendChild(coinsPill);
      left.appendChild(questsPill);
      top.appendChild(left);
```

- Delete the `lobbyLink` lines (creation, `href`, listener, `right.appendChild(lobbyLink)`).
- Add `coins: coinsPill, quests: questsPill,` to the returned object.

Near `canZoom`, add:

```js
    function calm() { return !maker && !overlay && !talking && !stall && !deco && !portal.isOpen(); }
```

In `web/world/world.css`, add:

```css
.w-hud-left { display: flex; gap: 6px; }
.w-quests .quests-title { display: none; }
.w-quests ul { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 8px; }
.w-quests li { display: flex; gap: 8px; align-items: baseline; font-weight: 700; }
.w-quests a { color: inherit; }
```

- [ ] **Step 3: Pills, upkeep, sections, quests card**

After the portal block (after `openGame`), add:

```js
    // The town's buildings as the lobby's subject cards, for the quests and the weekly boss.
    function subjectCards() {
      return W.Progress.cards(grade, L, root.Subjects).map(function (c) { return { app: c.app, title: c.name, href: c.href }; });
    }
    function questState() {
      var s = { done: 0, total: 0, streak: 0 };
      try {
        var list = root.Quests.state().list;
        s.total = list.length;
        s.done = list.filter(function (q) { return q.done; }).length;
        s.streak = root.Quests.streak();
      } catch (e) {}
      return s;
    }
    function showPills() {
      var q = questState(), coins = 0;
      try { coins = root.Wallet ? root.Wallet.balanceStored() : 0; } catch (e) {}
      var p = W.Hud.pills({ coins: coins, done: q.done, total: q.total, streak: q.streak });
      if (hud.coins.textContent !== p.coins) hud.coins.textContent = p.coins;
      if (hud.quests.textContent !== p.quests) hud.quests.textContent = p.quests;
    }
    // The lobby used to do this when it opened; home is the world now.
    function upkeep() {
      var cards = subjectCards(), events = [];
      try { if (root.Boss && root.Boss.ensure) events = root.Boss.ensure(cards) || []; } catch (e) {}
      try {
        if (root.Quests && root.Quests.pick) {
          root.Quests.pick(cards);
          events = root.Quests.check().concat(events);
        }
      } catch (e) {}
      showPills();
      if (events.length && root.Fx && root.Fx.celebrate) root.Fx.celebrate(events, hud.quests);
    }
    var SECTION_TITLE = { shop: 'Shop', coins: 'Coins', parent: T.parents };
    function openSection(name) { portal.open(name, lobbyUrl + '#' + name, '#ffb84d', SECTION_TITLE[name] || name); }
    function openQuests() {
      var cards = subjectCards(), title = (root.Quests && root.Quests.text && root.Quests.text.title) || '🎯';
      var card = openOverlay(title), box = el('div', 'w-quests');
      card.appendChild(box);
      if (root.Quests && root.Quests.renderLobby) root.Quests.renderLobby(box, cards);
      box.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        e.preventDefault();
        var href = a.getAttribute('href');
        var c = cards.filter(function (x) { return href.indexOf(x.href.split('?')[0]) === 0; })[0];
        closeOverlay();
        if (!c) return;
        leaving(c.app);
        openGame(c.app, href);
      });
      card.appendChild(button('w-btn w-close', T.close, closeOverlay));
      focusFirst(card);
    }
    var learnerId = meL ? meL.id : null;
    // A different child picked in the parent area: this world belongs to someone else now.
    function learnerChanged() {
      var now = null;
      try { now = root.Learner && root.Learner.current ? root.Learner.current() : null; } catch (e) {}
      if ((now ? now.id : null) === learnerId) return false;
      if (now) root.location.reload();
      else debug.go('../index.html');
      return true;
    }
    doc.addEventListener('cloud-synced', function () { refresh(); upkeep(); });
    var dayNow = today();
    root.setInterval(function () {
      if (today() === dayNow) return;
      dayNow = today();
      refresh();
      upkeep();
    }, 30000);
```

`Quests.state`, `Quests.streak`, `Quests.text`, `Quests.renderLobby`, `Quests.pick`, `Quests.check` come from `web/engine/quests.js` (`create()` plus `mountUi`; the world page loads `quests.js` with `data-grade`). Check each name exists on `root.Quests` in the browser (read `create()`'s return object); if one is named differently, use the real name and report it.

- [ ] **Step 4: The portal, sync and sections**

In `pauseWorld(on)`: in the `on` branch add `if (root.Cloud && root.Cloud.hold) root.Cloud.hold(true);`; in the resume path add `if (root.Cloud && root.Cloud.hold) root.Cloud.hold(false);`.

Replace the portal's `onClosed` with:

```js
      onClosed: function (then) {
        if (learnerChanged()) return;
        refresh();
        upkeep();
        welcome(W.Prefs.readReturn(session));
        // After the history step back has landed, so the next page or frame is not undone by it.
        root.setTimeout(function () {
          if (then === 'shop') openSection('shop');
          else if (then === 'lobby') debug.go(lobbyUrl + '?stay=1');
          else if (then === 'account') debug.go('../index.html?account=1');
        }, 300);
      },
```

In `W.Folk.create({...})`, change `shop:` to `shop: function () { openSection('shop'); },`.

Grep `web/world` for any other `#shop-world` or `lobbyUrl` navigation and route a shop one through `openSection('shop')`.

In `openSettings()`, before `card.appendChild(el('p', 'w-credit', T.credit));`, add:

```js
      card.appendChild(button('w-btn w-parents', T.parents, function () { closeOverlay(); openSection('parent'); }));
```

- [ ] **Step 5: Start-up and debug**

In the start sequence, right after the first `refresh();` near the end of `start()`, add `upkeep();`.

Next to `debug.portal = {…}` add:

```js
    debug.section = openSection;
    debug.openQuests = openQuests;
    debug.pills = function () { return { coins: hud.coins.textContent, quests: hud.quests.textContent }; };
```

- [ ] **Step 6: Run the tests**

Run: `node --test`, `node tests/e2e/world-e2e.js`, `node tests/e2e/portal-e2e.js`
Expected: all pass. If a `world-e2e` case read the `🌍` title pill or the 🏠 Lobby pill, update it to the new pills (`#hud-coins`, `#hud-quests`) and say so in your report.

- [ ] **Step 7: Suggested commit (owner runs it)**

```bash
git add web/world/world-main.js web/world/text.js web/world/world.css tests/world3d-text.test.js tests/e2e/world-e2e.js tests/e2e/world-driver.page.js && git commit -m 'World as home: coin and quest pills, quests card, shop / coin guide / parent area in the frame, daily upkeep and sync in the world' -- web/world/world-main.js web/world/text.js web/world/world.css tests/world3d-text.test.js tests/e2e/world-e2e.js tests/e2e/world-driver.page.js
```

---

### Task 7: `home-e2e.js`

**Files:**
- Create: `tests/e2e/home-e2e.js`, `tests/e2e/home-world.page.js`

Model it on `tests/e2e/portal-e2e.js` (stage the site, serve it with `tests/e2e/static-server.js`, `dumpDom` an http URL with `WEBGL_ARGS`, start-failure guards, try/finally to kill the server) and `tests/e2e/portal-world.page.js` (the rAF-to-timer swap for headless virtual time, `waitFor` with named timeouts, `out()`). Over http the frame is same-origin, so the world driver can read the frame's DOM through `frame.contentDocument`.

- [ ] **Step 1: Stage**

Stage `world/grade-5.html` (with the CALM + avatar seed from `portal-e2e.js`, plus a seed that adds coins: `Wallet.addBonus(25);` after the engine scripts), the driver appended; the real `lobby/grade-5.html` (no driver); and the real Science game page (`app('life-lab').page`) so a quest link can open. Copy vendor, `world/world.css` and engine files as `portal-e2e.js` does, and every world script (the stager copies `src`s without `./`).

- [ ] **Step 2: The world driver checks, in order**

1. **Forward:** the run opens `http://127.0.0.1:<port>/lobby/grade-5.html`; the driver (on the world page) records `location.pathname` (must end with `/world/grade-5.html`).
2. **Pills:** `WorldDebug.pills()`: `coins === '🪙 ' + Math.floor(Wallet.balanceStored())` and `quests` matches `/^🎯 \d\/3/`.
3. **Shop in the frame:** `WorldDebug.portal.instant(true); WorldDebug.section('shop')`; wait for `state() === 'open'` and the frame's `#shop-overlay` not hidden; record that the frame's `.wrap` is not displayed (`getComputedStyle(…).display === 'none'`); click the frame's `#shop-close`; wait until the portal is closed.
4. **Parent PIN in the frame:** `WorldDebug.section('parent')`; wait for the frame's `#pin-view` visible and `#open-lobby` present; click the frame's `#parent-close`; wait closed.
5. **Coin guide:** `WorldDebug.section('coins')`; wait for the frame's coin guide visible; click its close button; wait closed.
6. **Quests card:** `WorldDebug.openQuests()`; record the number of `.w-quests li` (3); click the first `.w-quests a` if any; wait for the portal to open and record `WorldDebug.portal.url()` (contains `/subjects/` and `embed=1`); `WorldDebug.portal.close()`; wait closed.
7. `out(o)`.

- [ ] **Step 3: A second run: `?stay=1`**

Open `http://127.0.0.1:<port>/lobby/grade-5.html?stay=1` with a tiny driver appended to the staged lobby that, after 1.5 s, writes `{ path: location.pathname }` with `out()`; assert it still ends with `/lobby/grade-5.html`. (Stage a second copy of the lobby with this driver under a different folder, or append the driver to the one lobby and let the first run ignore it: the forward happens before it fires.)

- [ ] **Step 4: Assertions in `home-e2e.js`**

`r.timeout === undefined`; no page errors; the forward path; the pills; shop open, `.wrap` hidden, closed by ✕; PIN view shown, `#open-lobby` present, closed; coin guide shown and closed; 3 quests; the quest link opened a game URL with `embed=1`; the stay run stayed. Print `ok home: lobby forwards, pills, shop / parent / coins in the frame, quests card, stay=1`.

- [ ] **Step 5: Run everything**

Run: `node tests/e2e/home-e2e.js`, then `node --test`, `node tests/e2e/world-e2e.js`, `node tests/e2e/portal-e2e.js`, `node tests/e2e/lobby-e2e.js 5`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/apps-e2e.js`, `node tests/e2e/sisters-e2e.js`, `node tests/e2e/guide-e2e.js`, `node tests/e2e/account-e2e.js`, `node tests/e2e/backup-e2e.js 5`, `node tests/e2e/migration-e2e.js`, `node tests/e2e/file-check-e2e.js`, `node tests/e2e/english-first-e2e.js` (one at a time, long timeouts).
Expected: all pass.

- [ ] **Step 6: Suggested commit (owner runs it)**

```bash
git add tests/e2e/home-e2e.js tests/e2e/home-world.page.js && git commit -m 'Home e2e: lobby forwards to the world, pills, shop / parent / coin guide in the frame, quests card, stay=1' -- tests/e2e/home-e2e.js tests/e2e/home-world.page.js
```

---

### Task 8: Docs

**Files:**
- Modify: `README.md`, `docs/HANDOFF.md`

- [ ] **Step 1: README**

After the `node tests/e2e/portal-e2e.js …` line add:

```
node tests/e2e/home-e2e.js           # world as home (local http server): the lobby forwards to the world, coin and quest pills, shop / parent area / coin guide in the frame, quests card, ?stay=1 keeps the lobby
```

Wherever README says the lobby is the home or the start point for the kids, add one sentence: "With 3D, every lobby link forwards to the 3D world; `?stay=1` keeps the lobby (the world's resting card uses it)."

- [ ] **Step 2: HANDOFF**

Under **3D world**, add:

```markdown
- World as home (2026-10-11): a lobby page forwards to the world when 3D can run (`web/engine/home.js`; never inside
  the frame, with `?stay=1`, for a lobby section, or on `file:` pages). The world syncs (`cloud.js`, held while a frame
  is open via `Cloud.hold`) and runs the lobby's daily upkeep (`Quests.pick`, `Boss.ensure`, `Quests.check`). HUD: 🪙
  coins (opens the coin guide) and 🎯 quests with the streak (opens a quests card whose links open the game in the
  frame); the 🏠 Lobby pill is gone. Bunny's counter opens the reward shop and ⚙️ → 🔒 For parents the PIN-gated parent
  area, both as lobby sections in the frame (`?embed=1#shop|#coins|#parent`, `web/engine/lobby-embed.js`); the parent
  area's Account and 🏫 Open the lobby page leave the frame. A different child picked in the parent area reloads the
  world. Embed helpers live in `web/engine/embed.js`. Spec and plan: `docs/superpowers/specs/2026-10-11-world-as-home-design.md`,
  `docs/superpowers/plans/2026-10-11-world-as-home.md`. Tablet check pending (sign-in lands in the world, the home-screen
  icon, the shop's phone request from the world, a sync seen on the phone page while she stays in the world).
```

In **Next**, the "App inside the world" bullet now names only sub-project D.

- [ ] **Step 3: Suggested commit (owner runs it)**

```bash
git add README.md docs/HANDOFF.md docs/superpowers/plans/2026-10-11-world-as-home.md && git commit -m 'World as home: docs and plan' -- README.md docs/HANDOFF.md docs/superpowers/plans/2026-10-11-world-as-home.md
```
