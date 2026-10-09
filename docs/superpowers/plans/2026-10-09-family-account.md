# Family Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family creates its Firebase account in the app, adds its children with their grade, picks the child for this device, and can change the family password and the parent PIN (synced across devices).

**Architecture:** A new start page (`web/index.html`) driven by `web/engine/account.js` (pure helpers + view logic). A new `web/engine/parent-pin.js` owns the PIN (device copy + newest-wins merge with one cloud doc). `firebase-remote.js` gains account calls and the PIN doc; `parent-panel.js`, the two lobbies, `cloud.js` and the phone page switch to the new PIN and link to the Account view.

**Tech Stack:** Plain HTML + ES5 JavaScript in IIFEs `(function (root) {...})(this)`, Firebase JS SDK 12.4.0 (modular, loaded on demand from gstatic), `node --test`, headless Chrome e2e via `tests/e2e/chrome.js`.

**Spec:** `docs/superpowers/specs/2026-10-09-family-account-design.md`.

## Rules for whoever builds this (from `CLAUDE.md`)

- **Never run `git commit`.** Each task ends with `git add` of its files (staging only). The owner commits.
- Never add `Co-Authored-By`, `Claude-Session` or any AI attribution anywhere.
- Browser JS is ES5 in an IIFE. Comments only for non-obvious code. Engine files stay ASCII-only where the file header says so (`parent-pin.js` and `account.js`: keep them ASCII; emoji go in as `\u` escapes).
- After adding a file under `web/`, run `node tools/update-precache.js` (Task 7).

## File map

| File | Change | Responsibility |
|---|---|---|
| `web/engine/parent-pin.js` | create | The parent PIN: device copy `parent_pin_v1`, default `0108`, `merge`, `sync(remote)` |
| `web/engine/account.js` | create | Start page + Account view: helpers (`validEmail`, `checkPassword`, `checkPin`, `checkChild`, `newId`, `backTarget`) and the views |
| `web/index.html` | rewrite | Welcome / Sign in / Create account / Add children / Who uses this tablet / Play without an account / Account |
| `web/engine/firebase-remote.js` | modify | `createAccount`, `resetPassword`, `changePassword`, `accountError`; remote `getPin` / `putPin` |
| `web/engine/parent-panel.js` | modify | `checkPin` (ParentPin with `0108` fallback) used by `pinGate`, exported |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | modify | load `parent-pin.js`; shop keypad uses `ParentPanel.checkPin`; 👤 Account section in Settings |
| `web/engine/cloud.js` | modify | `ParentPin.sync` after each good round; "Create one" link when signed out |
| `web/parent/index.html`, `web/parent/phone.js` | modify | load `parent-pin.js`; sync PIN on sign-in; 👤 Account link |
| `tests/paths.js` | modify | `ENGINE_FILES` gains `parent-pin.js`, `account.js` |
| `tests/parent-pin.test.js` | create | unit tests |
| `tests/account.test.js` | create | unit tests |
| `tests/firebase-remote.test.js` | create | `accountError` wording |
| `tests/parent-pin-wiring.test.js` | create | pages load the files, no `0108` left, links present |
| `tests/e2e/account-e2e.js` | create | headless Chrome flows with a fake `FirebaseRemote` |
| `README.md`, `docs/HANDOFF.md` | modify | docs |

---

### Task 1: `parent-pin.js`

**Files:**
- Create: `web/engine/parent-pin.js`
- Modify: `tests/paths.js` (the `ENGINE_FILES` line)
- Test: `tests/parent-pin.test.js`

- [ ] **Step 1: Write the failing test** `tests/parent-pin.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, merge, KEY, DEFAULT_PIN } = require(engineFile('parent-pin.js'));

function storage() {
  const data = {};
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
}
let clock = 1000;
const now = () => clock++;

function fakeRemote(cloud) {
  const puts = [];
  return { puts, getPin: () => Promise.resolve(cloud), putPin: (rec) => { puts.push(rec); return Promise.resolve(); } };
}

test('the PIN is 0108 until a parent sets one', () => {
  const p = create(storage(), now);
  assert.equal(DEFAULT_PIN, '0108');
  assert.equal(p.get(), '0108');
  assert.ok(p.check('0108'));
  assert.ok(!p.check('1234'));
});

test('set accepts only 4 digits and replaces the default', () => {
  const s = storage();
  const p = create(s, now);
  assert.equal(p.set('12a4'), false);
  assert.equal(p.set('123'), false);
  assert.equal(p.set('12345'), false);
  assert.equal(p.get(), '0108');
  assert.equal(p.set('4321'), true);
  assert.equal(p.get(), '4321');
  assert.ok(!p.check('0108'));
  assert.equal(JSON.parse(s.data[KEY]).pin, '4321');
});

test('a broken saved value reads as the default', () => {
  const s = storage();
  s.setItem(KEY, 'nope');
  assert.equal(create(s, now).get(), '0108');
  s.setItem(KEY, JSON.stringify({ pin: '12', at: 5 }));
  assert.equal(create(s, now).get(), '0108');
});

test('merge keeps the newer copy and ignores broken ones', () => {
  const a = { pin: '1111', at: 5 }, b = { pin: '2222', at: 9 };
  assert.equal(merge(a, b), b);
  assert.equal(merge(b, a), b);
  assert.equal(merge(null, b), b);
  assert.equal(merge(a, null), a);
  assert.equal(merge(null, null), null);
  assert.equal(merge(a, { pin: 'xx', at: 99 }), a);
  assert.equal(merge(a, { pin: '3333', at: 5 }), a, 'a tie keeps the device copy');
});

test('sync takes a newer PIN from the cloud', async () => {
  const s = storage();
  s.setItem(KEY, JSON.stringify({ pin: '1111', at: 5 }));
  const p = create(s, now);
  const r = fakeRemote({ pin: '2222', at: 9 });
  await p.sync(r);
  assert.equal(p.get(), '2222');
  assert.deepEqual(r.puts, []);
});

test('sync sends a newer device PIN to the cloud', async () => {
  const p = create(storage(), now);
  p.set('4321');
  const r = fakeRemote({ pin: '1111', at: 1 });
  await p.sync(r);
  assert.equal(r.puts.length, 1);
  assert.equal(r.puts[0].pin, '4321');
  const empty = fakeRemote(null);
  await p.sync(empty);
  assert.equal(empty.puts[0].pin, '4321');
});

test('sync with nothing anywhere writes nothing', async () => {
  const s = storage();
  const r = fakeRemote(null);
  await create(s, now).sync(r);
  assert.deepEqual(r.puts, []);
  assert.deepEqual(s.data, {});
});

test('sync never fails: a broken remote keeps the device PIN', async () => {
  const p = create(storage(), now);
  p.set('4321');
  await p.sync({ getPin: () => Promise.reject(new Error('offline')), putPin: () => Promise.resolve() });
  await p.sync({ getPin: () => { throw new Error('not loaded'); }, putPin: () => Promise.resolve() });
  await p.sync({ getPin: () => Promise.resolve(null), putPin: () => Promise.reject(new Error('offline')) });
  assert.equal(p.get(), '4321');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/parent-pin.test.js`
Expected: FAIL with `Cannot find module '...web/engine/parent-pin.js'`.

- [ ] **Step 3: Write `web/engine/parent-pin.js`**

```js
/* The parent PIN for the Parent panel and the shop. One per device (not per child), 0108 until a parent changes it.
   When the family is signed in, one cloud copy keeps every device on the same PIN: the newer change wins.
   Loaded after storage.js. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var KEY = 'parent_pin_v1';
  var DEFAULT_PIN = '0108';
  var FOUR_DIGITS = /^\d{4}$/;

  function valid(r) { return !!r && typeof r === 'object' && typeof r.pin === 'string' && FOUR_DIGITS.test(r.pin) && typeof r.at === 'number'; }

  function merge(local, cloud) {
    var a = valid(local) ? local : null, b = valid(cloud) ? cloud : null;
    if (!a) return b;
    if (!b) return a;
    return b.at > a.at ? b : a;
  }

  function create(storage, now) {
    function read() {
      try { var r = JSON.parse(storage.getItem(KEY)); return valid(r) ? r : null; } catch (e) { return null; }
    }
    function write(r) {
      try { storage.setItem(KEY, JSON.stringify({ pin: r.pin, at: r.at })); return true; } catch (e) { return false; }
    }
    function get() { var r = read(); return r ? r.pin : DEFAULT_PIN; }

    return {
      get: get,
      check: function (entry) { return entry === get(); },
      set: function (pin) { return FOUR_DIGITS.test(String(pin)) && write({ pin: String(pin), at: now() }); },
      // remote: { getPin() -> promise of { pin, at } or null, putPin({ pin, at }) -> promise }. Never rejects.
      sync: function (remote) {
        var local = read();
        return Promise.resolve().then(function () { return remote.getPin(); }).then(function (cloud) {
          var best = merge(local, cloud);
          if (!best) return null;
          if (best !== local) write(best);
          if (!valid(cloud) || cloud.at < best.at) return remote.putPin({ pin: best.pin, at: best.at });
          return null;
        }).then(function () {}, function () {});
      }
    };
  }

  var exported = { create: create, merge: merge, KEY: KEY, DEFAULT_PIN: DEFAULT_PIN };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try { root.ParentPin = create(root.StudyStore.raw, function () { return Date.now(); }); } catch (e) {}
})(this);
```

- [ ] **Step 4: Add both new engine files to `ENGINE_FILES` in `tests/paths.js`**

Insert `'parent-pin.js'` right before `'parent-panel.js'` and `'account.js'` at the end of the array, so the line ends:

```js
..., 'subjects.js', 'insights.js', 'parent-pin.js', 'parent-panel.js', 'account.js'];
```

(`account.js` does not exist until Task 4; nothing copies `ENGINE_FILES` before then except e2e scripts, which are not run until Task 6.)

- [ ] **Step 5: Run the test**

Run: `node --test tests/parent-pin.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Stage**

```bash
git add web/engine/parent-pin.js tests/parent-pin.test.js tests/paths.js
```

---

### Task 2: `firebase-remote.js` account calls and the PIN doc

**Files:**
- Modify: `web/engine/firebase-remote.js`
- Test: `tests/firebase-remote.test.js`

- [ ] **Step 1: Write the failing test** `tests/firebase-remote.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');

function remoteModule() {
  const win = {};
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('firebase-remote.js'), 'utf8'), win);
  return win.FirebaseRemote;
}
const err = (code) => ({ code });

test('account errors are in words', () => {
  const FR = remoteModule();
  assert.equal(FR.accountError(err('auth/email-already-in-use')), 'This email already has an account. Sign in instead.');
  assert.equal(FR.accountError(err('auth/weak-password')), 'The password needs at least 6 characters.');
  assert.equal(FR.accountError(err('auth/invalid-email')), 'Type a real email address.');
  assert.equal(FR.accountError(err('auth/requires-recent-login')), 'Sign out, sign in again, then change the password.');
  assert.equal(FR.accountError(err('auth/invalid-credential'), 'change'), 'The current password is wrong.');
  assert.equal(FR.accountError(err('auth/wrong-password'), 'change'), 'The current password is wrong.');
  assert.equal(FR.accountError(err('auth/invalid-credential')), 'Wrong email or password.');
  assert.equal(FR.accountError(err('auth/user-not-found')), 'No account uses that email.');
  assert.equal(FR.accountError(err('auth/network-request-failed')), 'No internet. Try again when online.');
  assert.equal(FR.accountError(err('auth/too-many-requests')), 'Too many tries. Wait a few minutes.');
  assert.equal(FR.accountError(err('auth/odd')), 'Something went wrong (auth/odd). Try again.');
  assert.equal(FR.accountError(null), 'Something went wrong (unknown error). Try again.');
});

test('the account calls exist', () => {
  const FR = remoteModule();
  for (const name of ['createAccount', 'resetPassword', 'changePassword', 'accountError', 'signIn', 'signOut', 'onAuth', 'remote']) {
    assert.equal(typeof FR[name], 'function', name);
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/firebase-remote.test.js`
Expected: FAIL (`FR.accountError is not a function`).

- [ ] **Step 3: Add the PIN doc to the remote**

In `web/engine/firebase-remote.js`, inside `remoteFor(uid)`, after the `stateRef` function line, add:

```js
    function pinRef() { return F.doc(db, 'families', uid, 'settings', 'pin'); }
```

and add these two methods to the returned object, after `watch`:

```js
      ,
      // The family's parent PIN (parent-pin.js): { pin, at } or null.
      getPin: function () {
        return F.getDoc(pinRef()).then(function (snap) {
          if (!snap.exists()) return null;
          var d = snap.data();
          return { pin: String(d.pin), at: Number(d.at) || 0 };
        });
      },
      putPin: function (rec) { return F.setDoc(pinRef(), { pin: rec.pin, at: rec.at, updatedAt: F.serverTimestamp() }); }
```

(Put the comma right after the closing `}` of `watch` rather than on its own line; shown separately here only to mark it.)

- [ ] **Step 4: Add `accountError` and the account calls**

After the `signInError` function, add:

```js
  // context 'change': the password typed was the current one, so a wrong one is named that way.
  function accountError(e, context) {
    var code = (e && e.code) || '';
    if (/email-already-in-use/.test(code)) return 'This email already has an account. Sign in instead.';
    if (/weak-password/.test(code)) return 'The password needs at least 6 characters.';
    if (/invalid-email/.test(code)) return 'Type a real email address.';
    if (/requires-recent-login/.test(code)) return 'Sign out, sign in again, then change the password.';
    if (/invalid-credential|wrong-password/.test(code)) return context === 'change' ? 'The current password is wrong.' : 'Wrong email or password.';
    if (/user-not-found/.test(code)) return 'No account uses that email.';
    if (/network/.test(code)) return 'No internet. Try again when online.';
    if (/too-many-requests/.test(code)) return 'Too many tries. Wait a few minutes.';
    return 'Something went wrong (' + (code || 'unknown error') + '). Try again.';
  }
```

In `root.FirebaseRemote = { ... }`, after `signIn`, add:

```js
    createAccount: function (email, password) {
      return load().then(function () { return fb.A.createUserWithEmailAndPassword(fb.auth, email, password); });
    },
    resetPassword: function (email) {
      return load().then(function () { return fb.A.sendPasswordResetEmail(fb.auth, email); });
    },
    // Firebase asks for the current password again before a password change.
    changePassword: function (current, next) {
      return load().then(function () {
        var u = fb.auth.currentUser;
        if (!u) { var e = new Error('signed out'); e.code = 'auth/requires-recent-login'; throw e; }
        return fb.A.reauthenticateWithCredential(u, fb.A.EmailAuthProvider.credential(u.email, current))
          .then(function () { return fb.A.updatePassword(u, next); });
      });
    },
```

and after `signInError: signInError` add `, accountError: accountError`.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/firebase-remote.test.js tests/sync.test.js`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add web/engine/firebase-remote.js tests/firebase-remote.test.js
```

---

### Task 3: Use the new PIN everywhere it is checked, and sync it

**Files:**
- Modify: `web/engine/parent-panel.js` (lines 6, 73, 899)
- Modify: `web/lobby/grade-5.html` (script list ~line 737, Settings ~line 631, shop ~lines 855 and 1078)
- Modify: `web/lobby/grade-2.html` (script list, Settings ~line 601, shop ~lines 841 and 1064)
- Modify: `web/engine/cloud.js`
- Modify: `web/parent/index.html`, `web/parent/phone.js`
- Test: `tests/parent-pin-wiring.test.js`

- [ ] **Step 1: Write the failing wiring test** `tests/parent-pin-wiring.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOBBIES, PARENT, ENGINE_FILES, lobbyFile, engineFile, web } = require('./paths.js');

const read = (f) => fs.readFileSync(f, 'utf8');
const engines = (html) => [...html.matchAll(/<script src="(?:\.\.\/)*engine\/([a-z-]+)\.js"/g)].map((m) => m[1]);

test('both new engine files are in ENGINE_FILES', () => {
  assert.ok(ENGINE_FILES.includes('parent-pin.js'));
  assert.ok(ENGINE_FILES.includes('account.js'));
});

for (const [name, file] of [['grade 5 lobby', lobbyFile(5)], ['grade 2 lobby', lobbyFile(2)], ['parent page', web(PARENT.page)]]) {
  test(name + ' loads parent-pin.js before parent-panel.js', () => {
    const list = engines(read(file));
    assert.ok(list.includes('parent-pin'), 'parent-pin.js not loaded');
    assert.ok(list.indexOf('parent-pin') < list.indexOf('parent-panel'), 'parent-pin.js must come before parent-panel.js');
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby: the shop keypad uses the shared PIN check and Settings links to Account', () => {
    const html = read(lobbyFile(grade));
    assert.ok(!html.includes('0108'), 'no fixed PIN left in the lobby');
    assert.ok(!/entered === PIN/.test(html), 'shop keypad still compares with a constant');
    assert.ok(html.includes('ParentPanel.checkPin(entered)'), 'shop keypad must use ParentPanel.checkPin');
    assert.ok(html.includes('href="../index.html?account=1&amp;back=lobby/grade-' + grade + '.html"'), 'Account link');
  });
}

test('parent-panel.js keeps 0108 only as the fallback', () => {
  const js = read(engineFile('parent-panel.js'));
  assert.equal(js.split("'0108'").length - 1, 1);
  assert.ok(!/=== PIN\b/.test(js));
  assert.ok(/checkPin: checkPin/.test(js), 'checkPin exported');
});

test('cloud.js and the phone page sync the PIN; the phone links to Account', () => {
  assert.ok(read(engineFile('cloud.js')).includes('ParentPin.sync(remote)'));
  assert.ok(read(web('parent/phone.js')).includes('ParentPin.sync('));
  assert.ok(read(web(PARENT.page)).includes('href="../index.html?account=1&amp;back=parent/"'));
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/parent-pin-wiring.test.js`
Expected: FAIL (`parent-pin.js not loaded`, and others).

- [ ] **Step 3: `parent-panel.js`**

Replace line 6 `  var PIN = '0108';` with:

```js
  var FALLBACK_PIN = '0108';

  // A page that forgot parent-pin.js still opens with the PIN every family had before 2026-10-09.
  function checkPin(entry) { return root.ParentPin ? root.ParentPin.check(entry) : entry === FALLBACK_PIN; }
```

In `pinGate`, replace `if (entered === PIN) {` with `if (checkPin(entered)) {`.

Replace the last export line with:

```js
  root.ParentPanel = { mount: mount, pinGate: pinGate, checkPin: checkPin, subjectsFromCards: subjectsFromCards };
```

- [ ] **Step 4: The two lobbies**

In each lobby, add a script tag right before the `parent-panel.js` one, matching that lobby's `data-grade`:

```html
<script src="../engine/parent-pin.js" data-grade="grade5"></script>
```

(`data-grade="grade2"` in `web/lobby/grade-2.html`.)

In the shop script, delete the line `  var PIN = '0108';` and replace

```js
    if (entered === PIN){ entered = ''; approve(); return; }
```

with

```js
    if (window.ParentPanel && ParentPanel.checkPin(entered)){ entered = ''; approve(); return; }
```

In the Settings panel, right after the closing `</div>` of `<div class="p-section" id="learner-section">`, add (grade 5 shown; use `grade-2.html` in the Grade 2 lobby):

```html
          <div class="p-section" id="account-section">
            <h3>👤 Account</h3>
            <p class="p-note">Create the family login, change its password or the parent PIN, or add a child.</p>
            <div class="p-row"><a class="p-btn" id="account-open" href="../index.html?account=1&amp;back=lobby/grade-5.html">Open Account</a></div>
          </div>
```

- [ ] **Step 5: `cloud.js`**

In `runSync`, replace

```js
      return core.sync().then(function (r) { return peekFamily(remote).then(function () { return r; }); });
```

with

```js
      return core.sync().then(function (r) {
        return peekFamily(remote).then(function () { return root.ParentPin ? root.ParentPin.sync(remote) : null; }).then(function () { return r; });
      });
```

(The parent PIN is the family's, not a child's, so it rides along after the child's round; `ParentPin.sync` never
rejects, so a failed PIN read cannot fail the round. The wiring test looks for `ParentPin.sync(remote)` literally.)

In `render()`, in the signed-out branch, right after `box.appendChild(el('p', { class: 'p-note', id: 'cloud-msg' }, status.text));`, add:

```js
      var make = el('p', { class: 'p-note' }, 'No family account yet? ');
      make.appendChild(el('a', { href: '../index.html?account=1&back=lobby/grade-' + me.grade + '.html' }, 'Create one'));
      box.appendChild(make);
```

- [ ] **Step 6: Phone parent page**

In `web/parent/index.html`, add `<script src="../engine/parent-pin.js"></script>` right before `<script src="../engine/parent-panel.js"></script>`, and inside `<div id="pick-view" ...>` after `<div id="kids"></div>` add:

```html
    <p class="p-note"><a href="../index.html?account=1&amp;back=parent/">👤 Account: password, parent PIN, add a child</a></p>
```

In `web/parent/phone.js`, in `startAuth`, replace

```js
    FR.onAuth(function (u) { authHeard = true; user = u; route(); }).then(function () { authStarting = false; }, function () {
```

with

```js
    FR.onAuth(function (u) {
      authHeard = true;
      user = u;
      if (u && window.ParentPin) ParentPin.sync(FR.remote(u.uid));
      route();
    }).then(function () { authStarting = false; }, function () {
```

- [ ] **Step 7: Run the tests**

Run: `node tools/update-precache.js` (so `tests/pwa.test.js` knows `parent-pin.js`; it runs again in Task 7).
Run: `node --test`
Expected: all PASS.

- [ ] **Step 8: Stage**

```bash
git add web/engine/parent-panel.js web/engine/cloud.js web/lobby/grade-5.html web/lobby/grade-2.html web/parent/index.html web/parent/phone.js web/sw.js web/world/lesson-files.js tests/parent-pin-wiring.test.js
```

---

### Task 4: `account.js` helpers

**Files:**
- Create: `web/engine/account.js` (helpers only in this task; the views come in Task 5)
- Test: `tests/account.test.js`

- [ ] **Step 1: Write the failing test** `tests/account.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { LOBBIES, engineFile } = require('./paths.js');
const A = require(engineFile('account.js'));

test('validEmail', () => {
  assert.ok(A.validEmail('mom@family.test'));
  assert.ok(A.validEmail('  mom@family.test '));
  assert.ok(!A.validEmail('mom@'));
  assert.ok(!A.validEmail('mom family@x.y'));
  assert.ok(!A.validEmail(''));
  assert.ok(!A.validEmail(null));
});

test('checkPassword', () => {
  assert.equal(A.checkPassword('12345', '12345'), 'The password needs at least 6 characters.');
  assert.equal(A.checkPassword('', ''), 'The password needs at least 6 characters.');
  assert.equal(A.checkPassword('secret1', 'secret2'), 'The two passwords are not the same.');
  assert.equal(A.checkPassword('secret1', 'secret1'), '');
});

test('checkPin', () => {
  assert.equal(A.checkPin('0000', '1234', '1234', '0108'), 'The current PIN is wrong.');
  assert.equal(A.checkPin('0108', '12a4', '12a4', '0108'), 'The new PIN must be 4 digits.');
  assert.equal(A.checkPin('0108', '123', '123', '0108'), 'The new PIN must be 4 digits.');
  assert.equal(A.checkPin('0108', '1234', '1235', '0108'), 'The two new PINs are not the same.');
  assert.equal(A.checkPin('0108', '1234', '1234', '0108'), '');
});

test('checkChild', () => {
  assert.equal(A.checkChild({ name: '  ', grade: 5 }).error, 'Type her name.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 0 }).error, 'Pick her grade.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 3 }).error, 'Pick her grade.');
  assert.deepEqual(A.checkChild({ name: ' Ana ', emoji: A.EMOJIS[1], grade: '2' }), { error: '', child: { name: 'Ana', emoji: A.EMOJIS[1], grade: 2 } });
  assert.equal(A.checkChild({ name: 'x'.repeat(40), grade: 5 }).child.name.length, 30);
  assert.equal(A.checkChild({ name: 'Ana', emoji: 'x', grade: 5 }).child.emoji, A.EMOJIS[0]);
});

test('GRADES are the lobbies that exist, oldest first', () => {
  assert.deepEqual(A.GRADES, Object.keys(LOBBIES).map(Number).sort((a, b) => b - a));
  assert.equal(A.EMOJIS.length, 8);
});

test('newId looks like a learner id', () => {
  const id = A.newId(1700000000000);
  assert.match(id, /^l[0-9a-z]+$/);
  assert.ok(id.startsWith('l' + (1700000000000).toString(36)));
});

test('backTarget only allows the lobbies and the parent page', () => {
  assert.equal(A.backTarget('?account=1&back=lobby%2Fgrade-2.html'), 'lobby/grade-2.html');
  assert.equal(A.backTarget('?account=1&back=lobby/grade-5.html'), 'lobby/grade-5.html');
  assert.equal(A.backTarget('?back=parent/'), 'parent/');
  assert.equal(A.backTarget('?back=https://evil.example'), '');
  assert.equal(A.backTarget('?back=%E0%A4%A'), '');
  assert.equal(A.backTarget(''), '');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/account.test.js`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 3: Write `web/engine/account.js` (helpers part)**

```js
/* The start page (index.html): a family signs in or creates its account, adds its children with their grade, and
   picks who uses this device; or plays without an account. index.html?account=1 is the Account view: change the
   family password or the parent PIN, add a child, sign out. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var GRADES = [5, 2];
  var EMOJIS = ['🌻', '🦋', '🐱', '🐶', '🦄', '⭐', '🌈', '🐼'];
  var NAME_MAX = 30;

  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

  function checkPassword(a, b) {
    if (!a || a.length < 6) return 'The password needs at least 6 characters.';
    if (a !== b) return 'The two passwords are not the same.';
    return '';
  }

  function checkPin(current, next, again, real) {
    if (current !== real) return 'The current PIN is wrong.';
    if (!/^\d{4}$/.test(next)) return 'The new PIN must be 4 digits.';
    if (next !== again) return 'The two new PINs are not the same.';
    return '';
  }

  function checkChild(c) {
    var name = String(c.name || '').trim().slice(0, NAME_MAX);
    if (!name) return { error: 'Type her name.' };
    var grade = Number(c.grade);
    if (GRADES.indexOf(grade) < 0) return { error: 'Pick her grade.' };
    return { error: '', child: { name: name, emoji: EMOJIS.indexOf(c.emoji) >= 0 ? c.emoji : EMOJIS[0], grade: grade } };
  }

  // Same shape as learner.js's ids.
  function newId(now) { return 'l' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  // Only pages of this site, so the link cannot send a parent somewhere else.
  function backTarget(search) {
    var m = /[?&]back=([^&]*)/.exec(search || ''), to = '';
    try { to = m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
    return /^(lobby\/grade-\d+\.html|parent\/)$/.test(to) ? to : '';
  }

  var exported = { GRADES: GRADES, EMOJIS: EMOJIS, validEmail: validEmail, checkPassword: checkPassword, checkPin: checkPin, checkChild: checkChild, newId: newId, backTarget: backTarget };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Account = exported;

  // VIEWS (Task 5)
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/account.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Stage**

```bash
git add web/engine/account.js tests/account.test.js
```

---

### Task 5: The start page and the Account view

**Files:**
- Rewrite: `web/index.html`
- Modify: `web/engine/account.js` (replace the `// VIEWS (Task 5)` line)

- [ ] **Step 1: Rewrite `web/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Study Games</title>
<script src="engine/lang.js"></script>
<script src="engine/storage.js"></script>
<script src="engine/learner.js"></script>
<script>
// A device that already knows its child goes straight to her lobby; ?account=1 opens the Account view instead.
if (window.Learner && Learner.current() && !/[?&]account=1(&|$)/.test(location.search)) location.replace(Learner.lobby());
</script>
<link rel="icon" type="image/png" href="assets/icons/grade5-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root{ --paper:#F4F1E9; --ink:#2B2A26; --muted:#6B6860; --teal:#1B7A79; --pink:#D9667B; --bad:#B42318; }
  *{ box-sizing:border-box; }
  body{
    margin:0; min-height:100vh; background:var(--paper); color:var(--ink);
    font-family:'Nunito',system-ui,sans-serif;
    display:flex; justify-content:center; padding:32px 16px;
  }
  main{ width:100%; max-width:520px; display:flex; flex-direction:column; gap:16px; }
  main.busy{ opacity:.6; pointer-events:none; }
  h1{ font-family:'Baloo 2',system-ui,sans-serif; font-size:clamp(30px,6vw,44px); margin:0; text-align:center; }
  h2{ font-family:'Baloo 2',system-ui,sans-serif; font-size:26px; margin:0 0 4px; }
  h3{ margin:18px 0 4px; font-size:18px; }
  section{ display:flex; flex-direction:column; gap:10px; }
  section[hidden]{ display:none; }
  .note{ margin:0; color:var(--muted); font-weight:600; }
  .msg{ margin:0; min-height:1.4em; text-align:center; font-weight:700; color:var(--teal); }
  .msg.error{ color:var(--bad); }
  input{ font:inherit; font-size:18px; padding:12px 14px; border-radius:12px; border:2px solid #D8D3C6; background:#fff; color:var(--ink); }
  input:focus-visible{ outline:3px solid var(--teal); outline-offset:1px; }
  button{ font:inherit; cursor:pointer; color:var(--ink); }
  .big{
    padding:14px 18px; border-radius:16px; border:3px solid var(--teal); background:#fff; box-shadow:0 4px 0 var(--teal);
    font-family:'Baloo 2',system-ui,sans-serif; font-size:22px; font-weight:800; text-align:left;
  }
  .big:active{ transform:translateY(3px); box-shadow:0 1px 0 var(--teal); }
  .big.ghost{ border-color:#C9C3B4; box-shadow:0 4px 0 #C9C3B4; }
  .big:disabled{ opacity:.5; cursor:default; }
  .link{ border:0; background:none; padding:6px 0; color:var(--muted); font-weight:700; text-decoration:underline; align-self:flex-start; }
  .chips{ display:flex; flex-wrap:wrap; gap:8px; }
  .chip{ padding:8px 14px; border-radius:999px; border:2px solid #D8D3C6; background:#fff; font-size:20px; font-weight:800; }
  .chip.on{ border-color:var(--teal); background:var(--teal); color:#fff; }
  #kid-list{ margin:0; padding-left:20px; font-weight:700; }
  .choices{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
  .choices a{
    display:flex; align-items:center; gap:14px; padding:18px 20px; border-radius:18px; text-decoration:none;
    background:#fff; color:var(--ink); border:3px solid var(--accent); box-shadow:0 4px 0 var(--accent);
    font-family:'Baloo 2',system-ui,sans-serif; font-size:24px; font-weight:800;
  }
  .choices a:active{ transform:translateY(3px); box-shadow:0 1px 0 var(--accent); }
  .choices img{ width:56px; height:56px; border-radius:14px; }
  a.parent-page{ align-self:center; color:var(--muted); font-weight:700; }
</style>
</head>
<body>
<main id="account-app">
  <h1>Study Games</h1>
  <p class="msg" id="msg" aria-live="polite"></p>

  <section id="welcome-view" hidden>
    <button class="big" type="button" id="go-signin">🔑 Sign in</button>
    <button class="big" type="button" id="go-register">✨ Create family account</button>
    <button class="big ghost" type="button" id="go-play">🎮 Play without an account</button>
    <p class="note">With an account, progress is backed up and the children's tablets and your phone stay in sync.</p>
    <a class="parent-page" href="parent/">🔒 Parent page (for a parent's phone)</a>
  </section>

  <section id="signin-view" hidden>
    <h2>Sign in</h2>
    <input type="email" id="signin-email" autocomplete="username" placeholder="Family email">
    <input type="password" id="signin-pass" autocomplete="current-password" placeholder="Password">
    <button class="big" type="button" id="signin-go">Sign in</button>
    <button class="link" type="button" id="signin-forgot">Forgot password?</button>
    <button class="link" type="button" data-back>← Back</button>
  </section>

  <section id="register-view" hidden>
    <h2>Create family account</h2>
    <p class="note">One account for the whole family. Use it on every tablet and on your phone.</p>
    <input type="email" id="reg-email" autocomplete="username" placeholder="Family email">
    <input type="password" id="reg-pass" autocomplete="new-password" placeholder="Password (6 or more characters)">
    <input type="password" id="reg-pass2" autocomplete="new-password" placeholder="Password again">
    <button class="big" type="button" id="reg-go">Create account</button>
    <button class="link" type="button" data-back>← Back</button>
  </section>

  <section id="children-view" hidden>
    <h2>Add children</h2>
    <ul id="kid-list"></ul>
    <input type="text" id="kid-name" maxlength="30" placeholder="Her name">
    <div class="chips" id="kid-emojis" aria-label="Emoji"></div>
    <div class="chips" id="kid-grades" aria-label="Grade"></div>
    <button class="big" type="button" id="kid-add">➕ Add child</button>
    <button class="big ghost" type="button" id="kid-done" disabled>Done</button>
  </section>

  <section id="pick-view" hidden>
    <h2>Who uses this tablet?</h2>
    <div class="chips" id="pick-list" style="flex-direction:column"></div>
  </section>

  <section id="play-view" hidden>
    <h2>Pick your grade.</h2>
    <div class="choices">
      <a href="lobby/grade-5.html" style="--accent:#1B7A79"><img src="assets/icons/grade5-192.png" alt="">Grade 5</a>
      <a href="lobby/grade-2.html" style="--accent:#D9667B"><img src="assets/icons/grade2-192.png" alt="">Grade 2</a>
    </div>
    <button class="link" type="button" data-back>← Back</button>
  </section>

  <section id="account-view" hidden>
    <h2>👤 Account</h2>
    <p class="note" id="acct-who"></p>
    <div id="acct-guest">
      <button class="big" type="button" id="acct-signin">🔑 Sign in</button>
      <button class="big" type="button" id="acct-register">✨ Create family account</button>
    </div>
    <div id="acct-signed">
      <h3>Change password</h3>
      <section>
        <input type="password" id="pw-cur" autocomplete="current-password" placeholder="Current password">
        <input type="password" id="pw-new" autocomplete="new-password" placeholder="New password (6 or more characters)">
        <input type="password" id="pw-new2" autocomplete="new-password" placeholder="New password again">
        <button class="big" type="button" id="pw-go">Change password</button>
      </section>
      <h3>Children</h3>
      <section>
        <button class="big ghost" type="button" id="acct-add">➕ Add a child</button>
        <button class="big ghost" type="button" id="acct-signout">Sign out</button>
      </section>
    </div>
    <h3>Change parent PIN</h3>
    <section>
      <input type="password" id="pin-cur" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="Current PIN">
      <input type="password" id="pin-new" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="New PIN (4 digits)">
      <input type="password" id="pin-new2" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="New PIN again">
      <button class="big" type="button" id="pin-go">Change PIN</button>
    </section>
    <a class="link" id="acct-back" href="index.html">← Back</a>
  </section>
</main>
<script src="engine/parent-pin.js"></script>
<script src="engine/firebase-config.js"></script>
<script src="engine/firebase-remote.js"></script>
<script src="engine/account.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add the views to `web/engine/account.js`**

Replace the line `  // VIEWS (Task 5)` with:

```js
  var doc = root.document;
  if (!doc || !doc.getElementById('account-app')) return;

  var FR = root.FirebaseRemote, L = root.Learner, Pin = root.ParentPin, raw = root.StudyStore.raw;
  var SIGNED_IN = 'sync_signed_in_v1';
  var OFFLINE = 'No internet. Try again when online, or play without an account.';
  var VIEWS = ['welcome-view', 'signin-view', 'register-view', 'children-view', 'pick-view', 'play-view', 'account-view'];
  var $ = function (id) { return doc.getElementById(id); };
  var accountMode = /[?&]account=1(&|$)/.test(root.location.search);
  var user = null, kids = [], form = { emoji: EMOJIS[0], grade: 0 }, working = false;

  // e2e tests replace this to stay on the page.
  exported.go = function (url) { root.location.replace(url); };

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(text, error) { $('msg').textContent = text; $('msg').classList.toggle('error', !!error); }
  function show(view) { VIEWS.forEach(function (v) { $(v).hidden = v !== view; }); say(''); }
  function label(k) {
    var p = k.profile || {};
    return (p.emoji ? p.emoji + ' ' : '') + (p.name || 'No name yet') + ' · Grade ' + p.grade;
  }
  function remote() { return FR.remote(user.uid); }
  function markSignedIn(on) {
    try { if (on) raw.setItem(SIGNED_IN, '1'); else raw.removeItem(SIGNED_IN); } catch (e) {}
  }

  // One cloud call at a time; the page is dimmed while it runs.
  function work(text, start, done, fail) {
    if (working) return;
    if (root.navigator && root.navigator.onLine === false) { say(OFFLINE, true); return; }
    working = true;
    $('account-app').classList.add('busy');
    say(text);
    function stop() { working = false; $('account-app').classList.remove('busy'); }
    Promise.resolve().then(start).then(function (v) { stop(); done(v); }, function (e) { stop(); say(fail(e), true); });
  }

  // ---- sign in, create account, forgot password ----
  function signedIn(u, fresh) {
    user = u;
    Pin.sync(remote()).then(function () {
      if (fresh) { kids = []; renderChildren(); return; }
      if (accountMode) { markSignedIn(true); renderAccount(); return; }
      work('Loading the children…', loadKids, function () { if (kids.length) renderPick(); else renderChildren(); },
        function () { return 'Could not load the children. ' + OFFLINE; });
    });
  }
  function loadKids() {
    return remote().learners().then(function (list) {
      kids = list.filter(function (l) { return l.profile && Number(l.profile.grade); });
    });
  }

  $('signin-go').addEventListener('click', function () {
    var email = $('signin-email').value.trim(), pass = $('signin-pass').value;
    if (!validEmail(email) || !pass) { say('Type the family email and the password first.', true); return; }
    work('Signing in…', function () { return FR.signIn(email, pass); }, function (cred) {
      $('signin-pass').value = '';
      signedIn(cred.user, false);
    }, function (e) { return FR.accountError(e); });
  });

  $('signin-forgot').addEventListener('click', function () {
    var email = $('signin-email').value.trim();
    if (!validEmail(email)) { say('Type the family email first, then tap Forgot password.', true); return; }
    work('Sending…', function () { return FR.resetPassword(email); }, function () {
      say('Check your email for a link to set a new password.');
    }, function (e) { return FR.accountError(e); });
  });

  $('reg-go').addEventListener('click', function () {
    var email = $('reg-email').value.trim(), pass = $('reg-pass').value;
    var problem = validEmail(email) ? checkPassword(pass, $('reg-pass2').value) : 'Type a real email address.';
    if (problem) { say(problem, true); return; }
    work('Creating the account…', function () { return FR.createAccount(email, pass); }, function (cred) {
      $('reg-pass').value = '';
      $('reg-pass2').value = '';
      if (accountMode) markSignedIn(true);
      signedIn(cred.user, true);
    }, function (e) { return FR.accountError(e); });
  });

  // ---- add children ----
  EMOJIS.forEach(function (e) {
    var b = el('button', 'chip', e);
    b.type = 'button';
    b.setAttribute('data-emoji', e);
    $('kid-emojis').appendChild(b);
  });
  GRADES.forEach(function (g) {
    var b = el('button', 'chip', 'Grade ' + g);
    b.type = 'button';
    b.setAttribute('data-grade', String(g));
    $('kid-grades').appendChild(b);
  });
  function drawForm() {
    Array.prototype.forEach.call($('kid-emojis').children, function (b) {
      var on = b.getAttribute('data-emoji') === form.emoji;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    Array.prototype.forEach.call($('kid-grades').children, function (b) {
      var on = Number(b.getAttribute('data-grade')) === form.grade;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  $('kid-emojis').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-emoji]');
    if (b) { form.emoji = b.getAttribute('data-emoji'); drawForm(); }
  });
  $('kid-grades').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-grade]');
    if (b) { form.grade = Number(b.getAttribute('data-grade')); drawForm(); }
  });

  function renderChildren() {
    show('children-view');
    var list = $('kid-list');
    list.textContent = '';
    kids.forEach(function (k) { list.appendChild(el('li', '', label(k))); });
    $('kid-done').disabled = !kids.length;
    $('kid-name').value = '';
    form = { emoji: EMOJIS[0], grade: 0 };
    drawForm();
  }

  $('kid-add').addEventListener('click', function () {
    var r = checkChild({ name: $('kid-name').value, emoji: form.emoji, grade: form.grade });
    if (r.error) { say(r.error, true); return; }
    var id = newId(Date.now());
    var profile = { name: r.child.name, emoji: r.child.emoji, grade: r.child.grade, at: Date.now() };
    work('Saving…', function () {
      return remote().merge(id, 'profile_v1', profile, function (local) { return local; });
    }, function () {
      var k = { id: id, profile: profile };
      kids.push(k);
      renderChildren();
      say('Added ' + label(k) + '.');
    }, function () { return 'Could not save her. ' + OFFLINE; });
  });

  $('kid-done').addEventListener('click', function () { if (accountMode) renderAccount(); else renderPick(); });

  // ---- who uses this tablet ----
  function renderPick() {
    show('pick-view');
    var box = $('pick-list');
    box.textContent = '';
    kids.forEach(function (k) {
      var b = el('button', 'big', label(k));
      b.type = 'button';
      b.setAttribute('data-learner', k.id);
      b.addEventListener('click', function () {
        L.adopt(k.id, k.profile);
        markSignedIn(true);
        exported.go(L.lobby(k.profile));
      });
      box.appendChild(b);
    });
  }

  // ---- the Account view ----
  function renderAccount() {
    show('account-view');
    $('acct-who').textContent = user ? 'Signed in as ' + (user.email || 'the family login') + '.' :
      'Not signed in. A PIN change here stays on this device only.';
    $('acct-guest').hidden = !!user;
    $('acct-signed').hidden = !user;
    $('acct-back').setAttribute('href', backTarget(root.location.search) || (L.current() ? L.lobby() : 'index.html'));
  }

  $('pw-go').addEventListener('click', function () {
    var cur = $('pw-cur').value, next = $('pw-new').value;
    var problem = cur ? checkPassword(next, $('pw-new2').value) : 'Type the current password.';
    if (problem) { say(problem, true); return; }
    work('Changing the password…', function () { return FR.changePassword(cur, next); }, function () {
      $('pw-cur').value = $('pw-new').value = $('pw-new2').value = '';
      say('Password changed. Use the new one on every device next time it asks.');
    }, function (e) { return FR.accountError(e, 'change'); });
  });

  $('pin-go').addEventListener('click', function () {
    var problem = checkPin($('pin-cur').value, $('pin-new').value, $('pin-new2').value, Pin.get());
    if (problem) { say(problem, true); return; }
    if (!Pin.set($('pin-new').value)) { say('Could not save the PIN on this device.', true); return; }
    $('pin-cur').value = $('pin-new').value = $('pin-new2').value = '';
    if (!user) { say('PIN changed on this device.'); return; }
    Pin.sync(remote()).then(function () { say('PIN changed. Your other devices get it at their next sync.'); });
  });

  $('acct-signin').addEventListener('click', function () { show('signin-view'); });
  $('acct-register').addEventListener('click', function () { show('register-view'); });
  $('acct-add').addEventListener('click', function () {
    work('Loading the children…', loadKids, renderChildren, function () { return 'Could not load the children. ' + OFFLINE; });
  });
  $('acct-signout').addEventListener('click', function () {
    FR.signOut().then(function () {
      user = null;
      markSignedIn(false);
      renderAccount();
    });
  });

  // ---- navigation ----
  $('go-signin').addEventListener('click', function () { show('signin-view'); });
  $('go-register').addEventListener('click', function () { show('register-view'); });
  $('go-play').addEventListener('click', function () { show('play-view'); });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-back]'), function (b) {
    b.addEventListener('click', function () { if (accountMode) renderAccount(); else show('welcome-view'); });
  });

  if (!accountMode) { show('welcome-view'); return; }
  renderAccount();
  say('Checking the sign-in…');
  // Only the first answer: later sign-ins from this page are handled by their own buttons.
  var heard = false;
  FR.onAuth(function (u) {
    if (heard) return;
    heard = true;
    user = u;
    renderAccount();
  }).catch(function () { renderAccount(); say('No internet. You can still change the PIN on this device.', true); });
```

- [ ] **Step 3: Check the page by hand**

Run: `node --test tests/account.test.js tests/pages.test.js`
Expected: PASS (the module branch returns before the view code).

Open `web/index.html` in Chrome through a local server so the Firebase SDK can load (for example `npx http-server web -p 8080`, then `http://localhost:8080/index.html`). In a private window: the Welcome view shows; Play without an account shows the two grade cards; Back returns. Do not create a real account here; Task 6 covers the flows with a fake.

- [ ] **Step 4: Stage**

```bash
git add web/index.html web/engine/account.js
```

---

### Task 6: e2e test with a fake Firebase

**Files:**
- Create: `tests/e2e/account-e2e.js`

- [ ] **Step 1: Write `tests/e2e/account-e2e.js`**

```js
// The start page and the Account view with a fake Firebase: create an account, add two children, pick one; change the
// password and the parent PIN (the lobby then wants the new PIN); play without an account; forgot password; sign in
// to a family with and without children.
// Run: node tests/e2e/account-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { LOBBIES, ENGINE_FILES, lobbyFile, web } = require('../paths.js');

// Stands in for web/engine/firebase-remote.js. The "cloud" lives in localStorage so it survives page loads.
const FAKE = `(function (root) {
  var KEY = 'fake_cloud';
  function db() { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, current: null, calls: 0 }; } catch (e) { return { users: {}, current: null, calls: 0 }; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function call() { var d = db(); d.calls++; save(d); return d; }
  function fail(code) { var e = new Error(code); e.code = code; return Promise.reject(e); }
  function userOf(d) { return d.current ? { uid: d.users[d.current].uid, email: d.current } : null; }
  root.FirebaseRemote = {
    onAuth: function (cb) { cb(userOf(call())); return Promise.resolve(); },
    signIn: function (email, pass) { var d = call(), u = d.users[email]; if (!u || u.pass !== pass) return fail('auth/invalid-credential'); d.current = email; save(d); return Promise.resolve({ user: userOf(d) }); },
    createAccount: function (email, pass) { var d = call(); if (d.users[email]) return fail('auth/email-already-in-use'); d.users[email] = { uid: 'u' + Object.keys(d.users).length, pass: pass, learners: {}, pin: null, resets: 0 }; d.current = email; save(d); return Promise.resolve({ user: userOf(d) }); },
    resetPassword: function (email) { var d = call(); if (d.users[email]) d.users[email].resets++; save(d); return Promise.resolve(); },
    changePassword: function (cur, next) { var d = call(), u = d.users[d.current]; if (u.pass !== cur) return fail('auth/invalid-credential'); u.pass = next; save(d); return Promise.resolve(); },
    signOut: function () { var d = call(); d.current = null; save(d); return Promise.resolve(); },
    signInError: function () { return 'Wrong email or password.'; },
    accountError: function (e, ctx) { return e.code === 'auth/invalid-credential' ? (ctx === 'change' ? 'The current password is wrong.' : 'Wrong email or password.') : 'error ' + e.code; },
    whenSlow: function (p) { return p; },
    remote: function (uid) {
      function me(d) { for (var k in d.users) if (d.users[k].uid === uid) return d.users[k]; return null; }
      return {
        learners: function () { var u = me(db()); return Promise.resolve(Object.keys(u.learners).map(function (id) { return { id: id, profile: u.learners[id] }; })); },
        merge: function (id, key, local, fn) { var d = db(), u = me(d); u.learners[id] = fn(local, u.learners[id] || null); save(d); return Promise.resolve(u.learners[id]); },
        getPin: function () { return Promise.resolve(me(db()).pin); },
        putPin: function (rec) { var d = db(); me(d).pin = rec; save(d); return Promise.resolve(); }
      };
    }
  };
})(this);`;

// Runs steps 60 ms apart (so the fake's promises settle), then prints what the steps logged.
const HELPERS = `
var log = {};
function q(id) { return document.getElementById(id); }
function type(id, v) { q(id).value = v; }
function click(id) { q(id).click(); }
function msg() { return q('msg').textContent; }
function view() { return ['welcome-view','signin-view','register-view','children-view','pick-view','play-view','account-view'].filter(function (v) { return q(v) && !q(v).hidden; })[0] || ''; }
function cloud() { return JSON.parse(localStorage.getItem('fake_cloud')); }
function run(steps) {
  var i = 0;
  (function next() {
    if (i < steps.length) {
      try { steps[i++](); } catch (e) { log.stepError = 'step ' + i + ': ' + e.message; i = steps.length; }
      setTimeout(next, 60);
      return;
    }
    var out = document.createElement('pre');
    out.id = 'e2e-out';
    out.textContent = JSON.stringify({ errors: window.__e2eErrors || [], log: log });
    document.body.appendChild(out);
  })();
}
if (window.Account) Account.go = function (u) { log.went = u; };
`;

const work = makeWorkDir('account-e2e');
const site = path.join(work, 'site');
const WAIT = 8000;

function page(name, driver) {
  const file = path.join(site, name);
  fs.writeFileSync(file, appendDriver(fs.readFileSync(web('index.html'), 'utf8'), HELPERS + driver));
  return file;
}
function seed(name, cloudState) {
  const file = path.join(site, name);
  fs.writeFileSync(file, '<!DOCTYPE html><meta charset="utf-8"><script>localStorage.clear();' +
    (cloudState ? 'localStorage.setItem("fake_cloud",' + JSON.stringify(JSON.stringify(cloudState)) + ');' : '') +
    'var p=document.createElement("pre");p.id="e2e-out";p.textContent="{}";document.documentElement.appendChild(p);</script>');
  return file;
}

fs.mkdirSync(site, { recursive: true });
stage(site, 'index.html', fs.readFileSync(web('index.html'), 'utf8'), ENGINE_FILES);
const lobby = stage(site, LOBBIES[2].page, appendDriver(fs.readFileSync(lobbyFile(2), 'utf8'), HELPERS + `
function pin(d) { Array.prototype.filter.call(document.querySelectorAll('#pin-pad button'), function (b) { return b.textContent === d; })[0].click(); }
run([
  function () { log.learner = Learner.current(); click('parent-open'); },
  function () { '0108'.split('').forEach(pin); log.oldPinLocked = q('history-view').hidden; },
  function () { '4321'.split('').forEach(pin); log.newPinOpen = !q('history-view').hidden; }
]);`), ENGINE_FILES);
// After staging (which copies the real engine files), swap in the fake Firebase.
fs.writeFileSync(path.join(site, 'engine', 'firebase-remote.js'), FAKE);

const create = page('create.html', `
run([
  function () { log.start = view(); click('go-register'); },
  function () { type('reg-email', 'mom@family.test'); type('reg-pass', 'secret1'); type('reg-pass2', 'secret2'); click('reg-go'); },
  function () { log.mismatch = msg(); type('reg-pass2', 'secret1'); click('reg-go'); },
  function () { log.afterCreate = view(); log.doneDisabled = q('kid-done').disabled; click('kid-add'); },
  function () { log.noName = msg(); type('kid-name', 'Ana'); click('kid-add'); },
  function () { log.noGrade = msg(); document.querySelector('#kid-grades [data-grade="5"]').click(); document.querySelector('#kid-emojis [data-emoji="' + Account.EMOJIS[1] + '"]').click(); click('kid-add'); },
  function () { log.added = msg(); type('kid-name', 'Bea'); document.querySelector('#kid-grades [data-grade="2"]').click(); click('kid-add'); },
  function () { log.listed = q('kid-list').children.length; click('kid-done'); },
  function () {
    log.pick = view();
    var buttons = Array.prototype.slice.call(document.querySelectorAll('#pick-list [data-learner]'));
    log.pickLabels = buttons.map(function (b) { return b.textContent; });
    buttons.filter(function (b) { return b.textContent.indexOf('Bea') >= 0; })[0].click();
  },
  function () {
    log.device = JSON.parse(localStorage.getItem('learners_v1'));
    log.flag = localStorage.getItem('sync_signed_in_v1');
    log.cloud = cloud();
  }
]);`);

const account = page('account.html', `
run([
  function () { log.view = view(); log.who = q('acct-who').textContent; log.back = q('acct-back').getAttribute('href'); },
  function () { type('pw-cur', 'wrong11'); type('pw-new', 'newpass1'); type('pw-new2', 'newpass1'); click('pw-go'); },
  function () { log.wrongPass = msg(); type('pw-cur', 'secret1'); type('pw-new', 'newpass1'); type('pw-new2', 'newpass1'); click('pw-go'); },
  function () { log.passOk = msg(); log.pass = cloud().users['mom@family.test'].pass; },
  function () { type('pin-cur', '0108'); type('pin-new', '4321'); type('pin-new2', '4322'); click('pin-go'); },
  function () { log.pinMismatch = msg(); type('pin-cur', '0108'); type('pin-new', '4321'); type('pin-new2', '4321'); click('pin-go'); },
  function () { log.pinOk = msg(); log.pin = ParentPin.get(); log.cloudPin = cloud().users['mom@family.test'].pin; }
]);`);

const guest = page('guest.html', `
run([
  function () { click('go-play'); },
  function () {
    log.play = view();
    log.links = Array.prototype.map.call(document.querySelectorAll('#play-view a'), function (a) { return a.getAttribute('href'); });
    log.callsAfterPlay = cloud().calls;
    document.querySelector('#play-view [data-back]').click();
  },
  function () { log.backTo = view(); click('go-signin'); },
  function () { click('signin-forgot'); },
  function () { log.forgotEmpty = msg(); type('signin-email', 'dad@family.test'); click('signin-forgot'); },
  function () { log.forgot = msg(); log.resets = cloud().users['dad@family.test'].resets; type('signin-pass', 'nope'); click('signin-go'); },
  function () { log.wrong = msg(); type('signin-email', 'new@family.test'); type('signin-pass', 'secret1'); click('signin-go'); },
  function () { log.noKids = view(); }
]);`);

const dad = page('dad.html', `
run([
  function () { click('go-signin'); type('signin-email', 'dad@family.test'); type('signin-pass', 'secret1'); click('signin-go'); },
  function () {
    log.pick = view();
    var b = document.querySelectorAll('#pick-list [data-learner]');
    log.count = b.length;
    b[0].click();
  },
  function () { log.pin = ParentPin.get(); log.current = JSON.parse(localStorage.getItem('learners_v1')).current; }
]);`);

const FAMILY = {
  calls: 0, current: null,
  users: {
    'dad@family.test': { uid: 'u0', pass: 'secret1', resets: 0, pin: { pin: '2468', at: 5 }, learners: { lk1: { name: 'Ana', emoji: '🌻', grade: 5, at: 1 } } },
    'new@family.test': { uid: 'u1', pass: 'secret1', resets: 0, pin: null, learners: {} },
  },
};

try {
  const one = path.join(work, 'one');
  dumpDom(one, seed('seed-empty.html'), '');
  const a = readOutput(dumpDom(one, create, '', WAIT));
  assert.deepEqual(a.errors, [], 'create errors');
  assert.equal(a.log.stepError, undefined, a.log.stepError);
  assert.equal(a.log.start, 'welcome-view');
  assert.equal(a.log.mismatch, 'The two passwords are not the same.');
  assert.equal(a.log.afterCreate, 'children-view');
  assert.equal(a.log.doneDisabled, true);
  assert.equal(a.log.noName, 'Type her name.');
  assert.equal(a.log.noGrade, 'Pick her grade.');
  assert.match(a.log.added, /^Added .*Ana · Grade 5\.$/);
  assert.equal(a.log.listed, 2);
  assert.equal(a.log.pick, 'pick-view');
  assert.equal(a.log.pickLabels.length, 2);
  assert.equal(a.log.went, 'lobby/grade-2.html');
  assert.equal(a.log.flag, '1');
  const learners = a.log.cloud.users['mom@family.test'].learners;
  const bea = Object.keys(learners).find((id) => learners[id].name === 'Bea');
  assert.equal(learners[bea].grade, 2);
  assert.equal(Object.values(learners).find((p) => p.name === 'Ana').grade, 5);
  assert.equal(a.log.device.current, bea, 'this tablet is Bea');

  const b = readOutput(dumpDom(one, account, '?account=1&back=lobby/grade-2.html', WAIT));
  assert.deepEqual(b.errors, [], 'account errors');
  assert.equal(b.log.stepError, undefined, b.log.stepError);
  assert.equal(b.log.view, 'account-view');
  assert.equal(b.log.who, 'Signed in as mom@family.test.');
  assert.equal(b.log.back, 'lobby/grade-2.html');
  assert.equal(b.log.wrongPass, 'The current password is wrong.');
  assert.equal(b.log.passOk, 'Password changed. Use the new one on every device next time it asks.');
  assert.equal(b.log.pass, 'newpass1');
  assert.equal(b.log.pinMismatch, 'The two new PINs are not the same.');
  assert.equal(b.log.pinOk, 'PIN changed. Your other devices get it at their next sync.');
  assert.equal(b.log.pin, '4321');
  assert.equal(b.log.cloudPin.pin, '4321');

  const c = readOutput(dumpDom(one, lobby, '', WAIT));
  assert.deepEqual(c.errors, [], 'lobby errors');
  assert.equal(c.log.stepError, undefined, c.log.stepError);
  assert.equal(c.log.learner.id, bea);
  assert.equal(c.log.learner.grade, 2);
  assert.equal(c.log.oldPinLocked, true, '0108 no longer opens the Parent panel');
  assert.equal(c.log.newPinOpen, true, 'the new PIN opens it');

  const two = path.join(work, 'two');
  dumpDom(two, seed('seed-family.html', FAMILY), '');
  const d = readOutput(dumpDom(two, guest, '', WAIT));
  assert.deepEqual(d.errors, [], 'guest errors');
  assert.equal(d.log.stepError, undefined, d.log.stepError);
  assert.equal(d.log.play, 'play-view');
  assert.deepEqual(d.log.links, ['lobby/grade-5.html', 'lobby/grade-2.html']);
  assert.equal(d.log.callsAfterPlay, 0, 'playing without an account calls nothing');
  assert.equal(d.log.backTo, 'welcome-view');
  assert.equal(d.log.forgotEmpty, 'Type the family email first, then tap Forgot password.');
  assert.equal(d.log.forgot, 'Check your email for a link to set a new password.');
  assert.equal(d.log.resets, 1);
  assert.equal(d.log.wrong, 'Wrong email or password.');
  assert.equal(d.log.noKids, 'children-view', 'a family with no children goes to Add children');

  const e = readOutput(dumpDom(two, dad, '', WAIT));
  assert.deepEqual(e.errors, [], 'sign-in errors');
  assert.equal(e.log.stepError, undefined, e.log.stepError);
  assert.equal(e.log.pick, 'pick-view');
  assert.equal(e.log.count, 1);
  assert.equal(e.log.went, 'lobby/grade-5.html');
  assert.equal(e.log.current, 'lk1');
  assert.equal(e.log.pin, '2468', 'a new tablet learns the family PIN');
  console.log('Account e2e passed');
} catch (err) {
  console.error('FAIL account:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
```

Notes for the builder:
- `stage(site, 'index.html', ...)` copies `index.html`'s `engine/*.js` scripts and `ENGINE_FILES`; the other start-page copies (`create.html`, …) sit next to it and use the same `engine/` folder.
- The four start-page copies are not `index.html`, so their head redirect still runs if the device has a learner. Only `account.html` is opened after a learner exists, and it is opened with `?account=1`, so it stays. `dad.html` runs in profile `two`, where `guest.html` never picked a child, so it stays too.
- If a step's message is still the "…ing" text, the 60 ms gap was too short for that step; raise it in `run` (the fake resolves at once, so 60 ms is plenty under `--virtual-time-budget`).

- [ ] **Step 2: Run it**

Run: `node tests/e2e/account-e2e.js`
Expected: `Account e2e passed`. If an assertion fails, fix the code (not the expected text) unless the test is wrong about the spec.

- [ ] **Step 3: Run the e2e scripts that load the lobbies and the start page**

Run each: `node tests/e2e/migration-e2e.js`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/sisters-e2e.js`, `node tests/e2e/backup-e2e.js`, `node tests/e2e/file-check-e2e.js`
Expected: each passes.

- [ ] **Step 4: Stage**

```bash
git add tests/e2e/account-e2e.js
```

---

### Task 7: Precache, docs, full check

**Files:**
- Modify: `web/sw.js` (generated), `README.md`, `docs/HANDOFF.md`

- [ ] **Step 1: Precache the new files**

Run: `node tools/update-precache.js`
Expected: `web/sw.js precaches N files` (N is 2 more than before).

- [ ] **Step 2: README**

In `README.md`:

1. In "Where data is stored", replace the bullet `- The device remembers its child, so \`index.html\` goes straight to her lobby. A new device asks for the grade once.` with:

```markdown
- The device remembers its child, so `index.html` goes straight to her lobby. A new device shows **Welcome**: 🔑 Sign in
  (then "Who uses this tablet?"), ✨ Create family account (email + password, then add each child with her name, emoji
  and grade, then pick who uses this tablet), or 🎮 Play without an account (pick the grade; nothing is sent anywhere).
  Forgot password sends Firebase's reset email. `web/engine/account.js` runs it.
```

2. In "Parent panel", after the **Cloud backup** bullet, add:

```markdown
- **👤 Account** (Settings tab, and on the phone page under "Which child?"): opens `index.html?account=1`. Change the
  family password (asks for the current one), change the parent PIN (asks for the current one; 0108 until changed),
  add a child, sign out. The PIN lives on each device (`parent_pin_v1`, `web/engine/parent-pin.js`) and, when signed
  in, in `families/{uid}/settings/pin`; the newest change wins at each sync, so one change reaches every tablet and the
  phone. Without an account the PIN change stays on that device.
```

3. In the "Shop" paragraph and the "Parent panel" intro, the text "the PIN" stays; nothing says 0108 there. In the
   project layout block, add after `cloud.js ...`:

```
    parent-pin.js              the parent PIN: device copy, 0108 by default, synced newest-wins with the family's cloud copy
    account.js                 the start page: sign in, create the family account, add children, Account view
```

4. In the e2e list, add:

```
node tests/e2e/account-e2e.js        # start page: create account, add children with their grade, pick one; Account view: change password and PIN (the lobby wants the new PIN); play without an account; forgot password
```

- [ ] **Step 3: HANDOFF**

In `docs/HANDOFF.md`, under **Study games and lobby** in "Built", add:

```markdown
- Family account (2026-10-09): the start page has Sign in, Create family account (then add each child with her grade,
  then "Who uses this tablet?") and Play without an account; Forgot password. `index.html?account=1` (👤 Account in
  the lobby Settings tab and on the phone page) changes the family password and the parent PIN (no longer fixed at
  0108; synced newest-wins through `families/{uid}/settings/pin`) and adds a child. Spec and plan:
  `docs/superpowers/specs/2026-10-09-family-account-design.md`, `docs/superpowers/plans/2026-10-09-family-account.md`.
```

Under "Still pending on the owner's side (not code)", add:

```markdown
- Family account live check: create a test account on the site, add a child, pick her, change the PIN and see it on
  the other tablet and the phone after a sync; Forgot password email arrives. Anyone can now register on `study-game`;
  turn Email/Password sign-up off in the Firebase console if that becomes a problem.
```

Update the "Updated" date at the top to 2026-10-09.

- [ ] **Step 4: Full check**

Run: `node --test`
Expected: all pass (including `tests/pwa.test.js`).

Run: `node tests/e2e/account-e2e.js`
Expected: `Account e2e passed`.

`node tests/e2e/world-e2e.js` is not needed (the 3D world is untouched).

- [ ] **Step 5: Stage and hand the owner the commit**

```bash
git add web/sw.js README.md docs/HANDOFF.md
```

Give the owner this one command (they run it):

```bash
git add web/engine/parent-pin.js web/engine/account.js web/index.html web/engine/firebase-remote.js web/engine/parent-panel.js web/engine/cloud.js web/lobby/grade-5.html web/lobby/grade-2.html web/parent/index.html web/parent/phone.js web/sw.js tests/paths.js tests/parent-pin.test.js tests/account.test.js tests/firebase-remote.test.js tests/parent-pin-wiring.test.js tests/e2e/account-e2e.js README.md docs/HANDOFF.md docs/superpowers/plans/2026-10-09-family-account.md && git commit -m 'Family account: create the family login on the start page, add children with their grade, pick who uses the tablet; Account view changes the password and the parent PIN (synced newest-wins, 0108 until changed)' -- web/engine/parent-pin.js web/engine/account.js web/index.html web/engine/firebase-remote.js web/engine/parent-panel.js web/engine/cloud.js web/lobby/grade-5.html web/lobby/grade-2.html web/parent/index.html web/parent/phone.js web/sw.js tests/paths.js tests/parent-pin.test.js tests/account.test.js tests/firebase-remote.test.js tests/parent-pin-wiring.test.js tests/e2e/account-e2e.js README.md docs/HANDOFF.md docs/superpowers/plans/2026-10-09-family-account.md
```
