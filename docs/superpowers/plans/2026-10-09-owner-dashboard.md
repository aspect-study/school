# Owner Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules (override any skill):** never run `git commit`, never add `Co-Authored-By:` or any AI attribution. Each task ends with a commit command in a code block that the **owner** runs. Browser JS is ES5 in an IIFE; comments only for non-obvious code; no fully-qualified inline class names.

**Goal:** A private owner-only page at `/admin/` on the Vercel site that shows families, children, activity, questions per day, subjects and last sync, read from Firebase.

**Architecture:** Families get a summary doc `families/{uid}` (written at sign-up and, at most once an hour per device, on sync). Firestore rules let the owner's UID read every family. `web/admin/` is a static page that signs in with the existing `FirebaseRemote`, reads families, learners and the last 30 days of history through a new read-only `adminRemote`, and turns them into numbers with a pure `admin-stats.js`.

**Tech Stack:** Plain ES5 browser JS, Firebase Auth + Firestore (modular SDK from CDN, already used), `node --test`.

**Deviations from the spec (decided while planning):**
- `learnerCount` is not stored on the family doc; the dashboard counts learner docs, which is always correct.
- The rules are pasted in the Firebase console (there is no `firebase.json` in the repo), so the deploy step is "paste", not `firebase deploy`. Task 8 fixes the spec text.
- `web/admin/` must be excluded from `tools/update-precache.js` and from the "every file is precached" test in `tests/pwa.test.js` (Task 5), otherwise the precache tooling would pull it onto the kids' tablets.

## File structure

| File | Responsibility |
|---|---|
| `web/admin/admin-stats.js` (new) | Pure `compute(data, now)`: raw docs → numbers. No DOM, no Firebase. Also `module.exports` for tests. |
| `web/admin/admin-config.js` (new) | `OWNER_UID` constant for the page check. |
| `web/admin/index.html`, `admin.css`, `admin.js` (new) | Sign-in, owner check, load + 10-min cache, render. |
| `web/engine/firebase-remote.js` (modify) | `putFamily` on the remote; new `adminRemote()`. |
| `web/engine/cloud.js` (modify) | Hourly `putFamily` after a good sync. |
| `web/engine/account.js` (modify) | `putFamily` with `createdAt` when an account is created. |
| `firebase/firestore.rules` (modify) | Owner read clause. |
| `tools/update-precache.js`, `tests/pwa.test.js` (modify) | Exclude `admin/`. |
| `tests/admin-stats.test.js`, `tests/admin-rules.test.js`, `tests/admin-wiring.test.js` (new) | Tests. |
| `README.md`, `docs/HANDOFF.md`, the spec (modify) | Docs. |

---

### Task 1: The stats module

**Files:**
- Create: `web/admin/admin-stats.js`
- Test: `tests/admin-stats.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/admin-stats.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { web } = require('./paths.js');
const Stats = require(web('admin/admin-stats.js'));

const NOW = new Date(2026, 9, 9, 15).getTime();
const at = (daysAgo, hour) => new Date(2026, 9, 9 - daysAgo, hour).getTime();
const quiz = (uid, learnerId, app, appTitle, answered, t) => ({ uid, learnerId, entry: { type: 'quiz', app, appTitle, answered, t } });

function fixture() {
  return {
    families: [
      { uid: 'f1', email: 'a@x.com', lastSeenAt: at(0, 9) },
      { uid: 'f2', email: 'b@x.com', lastSeenAt: at(10, 9) },
      { uid: 'f3', email: 'c@x.com', lastSeenAt: null }
    ],
    learners: [
      { uid: 'f1', id: 'l1', grade: 2 },
      { uid: 'f1', id: 'l2', grade: 5 },
      { uid: 'f2', id: 'l3', grade: 5 }
    ],
    history: [
      quiz('f1', 'l1', 'math2', 'Block Bot', 10, at(0, 10)),
      quiz('f1', 'l1', 'math2', 'Block Bot', 5, at(3, 10)),
      quiz('f2', 'l3', 'sci5', 'Life Lab', 7, at(8, 10)),
      quiz('f2', 'l3', 'sci5', 'Life Lab', 4, at(31, 10)),
      { uid: 'f1', learnerId: 'l2', entry: { type: 'lesson', app: 'sci5', appTitle: 'Life Lab', t: at(0, 11) } },
      { uid: 'f1', learnerId: 'l2', entry: null },
      { uid: 'f1', learnerId: 'l2', entry: { type: 'quiz', answered: 3 } }
    ]
  };
}

test('totals count families, children and grades', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.totals, { families: 3, children: 3, grade2: 1, grade5: 2 });
});

test('active families and children use today and the last 7 days', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.active, { familiesToday: 1, families7: 1, childrenToday: 2, children7: 2 });
});

test('questions per day cover 30 days and ignore older or broken entries', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily[29].day, '2026-10-09');
  assert.equal(s.daily[29].answered, 10);
  assert.equal(s.daily[26].answered, 5);
  assert.equal(s.daily[21].answered, 7);
  assert.equal(s.daily.reduce((n, d) => n + d.answered, 0), 22);
  assert.equal(s.questionsToday, 10);
});

test('subjects add up questions answered, biggest first', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.subjects, [
    { app: 'math2', title: 'Block Bot', answered: 15 },
    { app: 'sci5', title: 'Life Lab', answered: 7 }
  ]);
});

test('family rows show children, last sync and a stale flag, newest first', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.families.map((f) => [f.uid, f.children, f.stale]), [['f1', 2, false], ['f2', 1, true], ['f3', 0, false]]);
  assert.equal(s.families[2].lastSeenAt, null);
});

test('empty or missing input gives zeros', () => {
  const s = Stats.compute({}, NOW);
  assert.deepEqual(s.totals, { families: 0, children: 0, grade2: 0, grade5: 0 });
  assert.equal(s.daily.length, 30);
  assert.deepEqual(s.subjects, []);
  assert.deepEqual(s.families, []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/admin-stats.test.js`
Expected: FAIL, "Cannot find module" for `web/admin/admin-stats.js`.

- [ ] **Step 3: Write the module**

Create `web/admin/admin-stats.js`:

```js
/* Turns the raw family, learner and history docs into the owner dashboard's numbers. Pure: no DOM, no Firebase.
   data = { families: [{ uid, email, lastSeenAt }], learners: [{ uid, id, grade }], history: [{ uid, learnerId, entry }] }.
   Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var DAYS = 30;
  var STALE_MS = 7 * 86400000;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function compute(data, now) {
    var families = (data && data.families) || [], learners = (data && data.learners) || [], history = (data && data.history) || [];
    // Calendar arithmetic, not 86400000 steps, so a daylight-saving change cannot shift a day.
    function dayStart(back) { var d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime(); }
    var weekStart = dayStart(6), todayStart = dayStart(0), from = dayStart(DAYS - 1);

    var daily = [], slot = {};
    for (var i = DAYS - 1; i >= 0; i--) {
      var key = dayKey(dayStart(i));
      slot[key] = daily.length;
      daily.push({ day: key, answered: 0 });
    }

    var seen = { fToday: {}, f7: {}, cToday: {}, c7: {} };
    var subjects = {};
    history.forEach(function (h) {
      var e = h && h.entry;
      if (!e || typeof e.t !== 'number' || e.t < from || e.t > now) return;
      var child = h.uid + '/' + h.learnerId;
      if (e.t >= weekStart) { seen.f7[h.uid] = true; seen.c7[child] = true; }
      if (e.t >= todayStart) { seen.fToday[h.uid] = true; seen.cToday[child] = true; }
      var n = e.type === 'quiz' && typeof e.answered === 'number' ? e.answered : 0;
      if (n <= 0) return;
      daily[slot[dayKey(e.t)]].answered += n;
      var s = subjects[e.app] || (subjects[e.app] = { app: e.app, title: e.appTitle || e.app, answered: 0 });
      s.answered += n;
    });

    var rows = families.map(function (f) {
      var seenAt = typeof f.lastSeenAt === 'number' ? f.lastSeenAt : null;
      return {
        uid: f.uid,
        email: f.email || '',
        children: learners.filter(function (l) { return l.uid === f.uid; }).length,
        lastSeenAt: seenAt,
        stale: seenAt !== null && now - seenAt > STALE_MS
      };
    }).sort(function (a, b) { return (b.lastSeenAt || 0) - (a.lastSeenAt || 0); });

    function count(o) { return Object.keys(o).length; }
    return {
      at: now,
      totals: {
        families: families.length,
        children: learners.length,
        grade2: learners.filter(function (l) { return l.grade === 2; }).length,
        grade5: learners.filter(function (l) { return l.grade === 5; }).length
      },
      active: { familiesToday: count(seen.fToday), families7: count(seen.f7), childrenToday: count(seen.cToday), children7: count(seen.c7) },
      questionsToday: daily[DAYS - 1].answered,
      daily: daily,
      subjects: Object.keys(subjects).map(function (k) { return subjects[k]; }).sort(function (a, b) { return b.answered - a.answered; }),
      families: rows
    };
  }

  var exported = { compute: compute, DAYS: DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.AdminStats = exported;
})(this);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/admin-stats.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/admin/admin-stats.js tests/admin-stats.test.js && git commit -m 'Add the owner dashboard stats module' -- web/admin/admin-stats.js tests/admin-stats.test.js
```

---

### Task 2: Owner clause in the rules

**Files:**
- Modify: `firebase/firestore.rules`
- Test: `tests/admin-rules.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/admin-rules.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8');

test('the owner may read every family, and only read', () => {
  assert.match(rules, /function isOwner\(\)/);
  const lines = rules.split('\n').filter((l) => l.includes('isOwner()') && l.includes('allow'));
  assert.ok(lines.length >= 2, 'owner clause missing on the family doc or its subcollections');
  for (const l of lines) assert.match(l.trim(), /^allow read:/, 'the owner must not get write access: ' + l);
});

test('the owner is one UID with one email', () => {
  assert.match(rules, /request\.auth\.uid == 'OWNER_UID'/);
  assert.match(rules, /request\.auth\.token\.email == 'aspectjump\.java@gmail\.com'/);
});

test('a family keeps read and write on its own data', () => {
  const own = rules.split('\n').filter((l) => l.includes('request.auth.uid == uid'));
  assert.ok(own.length >= 2);
  for (const l of own) assert.match(l, /allow read, write:/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/admin-rules.test.js`
Expected: FAIL (no `isOwner`).

- [ ] **Step 3: Write the rules**

Replace `firebase/firestore.rules` with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // The owner is one account: this UID (Firebase console, Authentication, Users) with this email. Until the UID is
    // pasted here the owner clause matches nobody.
    function isOwner() {
      return request.auth != null && request.auth.uid == 'OWNER_UID'
        && request.auth.token.email == 'aspectjump.java@gmail.com';
    }

    match /families/{uid} {
      allow read: if isOwner();
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /families/{uid}/{document=**} {
      allow read: if isOwner();
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/admin-rules.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add firebase/firestore.rules tests/admin-rules.test.js && git commit -m 'Let the owner read every family in the Firestore rules' -- firebase/firestore.rules tests/admin-rules.test.js
```

---

### Task 3: Remote calls (`putFamily`, `adminRemote`)

**Files:**
- Modify: `web/engine/firebase-remote.js` (inside `remoteFor`, before `putPin`; new function before `signInError`; export list)
- Modify: `tests/firebase-remote.test.js:33`

- [ ] **Step 1: Write the failing test**

In `tests/firebase-remote.test.js`, add `'adminRemote'` to the list in the `'the account calls exist'` test:

```js
  for (const name of ['createAccount', 'resetPassword', 'changePassword', 'accountError', 'signIn', 'signOut', 'onAuth', 'remote', 'adminRemote']) {
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/firebase-remote.test.js`
Expected: FAIL, `adminRemote` is `undefined`.

- [ ] **Step 3: Add `putFamily` to the remote**

In `web/engine/firebase-remote.js`, change the end of the `remoteFor` return object. Replace:

```js
      putPin: function (rec) { return F.setDoc(pinRef(), { pin: rec.pin, at: rec.at, updatedAt: F.serverTimestamp() }); }
    };
  }
```

with:

```js
      putPin: function (rec) { return F.setDoc(pinRef(), { pin: rec.pin, at: rec.at, updatedAt: F.serverTimestamp() }); },
      // The family's summary doc, listed by the owner dashboard. createdAt is passed only when the account is made.
      putFamily: function (rec) {
        var data = { lastSeenAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() };
        if (rec.email) data.email = rec.email;
        if (rec.createdAt) data.createdAt = rec.createdAt;
        return F.setDoc(F.doc(db, 'families', uid), data, { merge: true });
      }
    };
  }

  // Read-only reads for the owner dashboard. Call it only after load() has finished.
  function adminRemote() {
    var F = fb.F, db = fb.db;
    function ms(t) { return t && t.toMillis ? t.toMillis() : null; }
    return {
      families: function () {
        return F.getDocs(F.collection(db, 'families')).then(function (snap) {
          return snap.docs.map(function (d) {
            var x = d.data();
            return { uid: d.id, email: x.email || '', createdAt: Number(x.createdAt) || null, lastSeenAt: ms(x.lastSeenAt) };
          });
        });
      },
      learners: function (uid) {
        return F.getDocs(F.collection(db, 'families', uid, 'learners')).then(function (snap) {
          return snap.docs.map(function (d) {
            var p = parse(d.data().json) || {};
            return { uid: uid, id: d.id, grade: Number(p.grade) || 0 };
          });
        });
      },
      history: function (uid, id, sinceMs) {
        var col = F.collection(db, 'families', uid, 'learners', id, 'history');
        return F.getDocs(F.query(col, F.where('updatedAt', '>=', F.Timestamp.fromMillis(sinceMs)))).then(function (snap) {
          return snap.docs.filter(function (d) { return !d.data().deleted; })
            .map(function (d) { return { uid: uid, learnerId: id, entry: parse(d.data().json) }; });
        });
      }
    };
  }
```

- [ ] **Step 4: Export it**

In the `root.FirebaseRemote = {` block, add after `remote: remoteFor,`:

```js
    adminRemote: function () { return load().then(adminRemote); },
```

Then update the test from Step 1 only if needed: `adminRemote` is a function, so it passes as written.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/firebase-remote.test.js tests/sync.test.js`
Expected: PASS.

- [ ] **Step 6: Commit (owner runs)**

```bash
git add web/engine/firebase-remote.js tests/firebase-remote.test.js && git commit -m 'Add the family summary write and the owner read calls to the Firebase remote' -- web/engine/firebase-remote.js tests/firebase-remote.test.js
```

---

### Task 4: Write the family doc at sign-up and on sync

**Files:**
- Modify: `web/engine/account.js:135` (the `reg-go` handler)
- Modify: `web/engine/cloud.js` (constants near line 9, new function before `runSync`, call in `runSync`)
- Test: `tests/admin-wiring.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/admin-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile } = require('./paths.js');

const read = (name) => fs.readFileSync(engineFile(name), 'utf8');

test('creating an account writes the family summary doc with createdAt', () => {
  assert.match(read('account.js'), /putFamily\(\{ email: email, createdAt: Date\.now\(\) \}\)/);
});

test('a good sync refreshes the family summary doc at most once an hour per device', () => {
  const src = read('cloud.js');
  assert.match(src, /putFamily\(\{ email: user\.email \}\)/);
  assert.match(src, /SEEN_EVERY_MS = 60 \* 60 \* 1000/);
  assert.match(src, /touchFamily\(remote\)/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/admin-wiring.test.js`
Expected: FAIL (2 tests).

- [ ] **Step 3: account.js**

In `web/engine/account.js`, in the `reg-go` handler replace:

```js
    work('Creating the account…', function () { return FR.createAccount(email, pass).then(startSession); }, function () {
```

with:

```js
    work('Creating the account…', function () {
      return FR.createAccount(email, pass).then(startSession).then(function () {
        return remote().putFamily({ email: email, createdAt: Date.now() }).then(null, function () {});
      });
    }, function () {
```

- [ ] **Step 4: cloud.js**

In `web/engine/cloud.js`, change the constants:

```js
  var EVERY_MS = 2 * 60 * 1000;
  var SIGNED_IN = 'sync_signed_in_v1';
```

to:

```js
  var EVERY_MS = 2 * 60 * 1000;
  var SEEN_EVERY_MS = 60 * 60 * 1000;
  var SIGNED_IN = 'sync_signed_in_v1';
  var SEEN = 'family_seen_';
```

Add this function directly above `function runSync() {`:

```js
  // Keeps the family's summary doc fresh for the owner dashboard without a write on every 2-minute round.
  function touchFamily(remote) {
    var key = SEEN + user.uid, last = 0;
    try { last = Number(device.getItem(key)) || 0; } catch (e) {}
    if (Date.now() - last < SEEN_EVERY_MS) return;
    remote.putFamily({ email: user.email }).then(function () {
      try { device.setItem(key, String(Date.now())); } catch (e) {}
    }, function () {});
  }
```

In `runSync`, after the line `if (root.ParentPin) root.ParentPin.sync(remote);` add:

```js
          touchFamily(remote);
```

- [ ] **Step 5: Run the tests**

Run: `node --test`
Expected: PASS (whole suite; `tests/family-wiring.test.js` and `tests/sync.test.js` still green).

- [ ] **Step 6: Commit (owner runs)**

```bash
git add web/engine/account.js web/engine/cloud.js tests/admin-wiring.test.js && git commit -m 'Write the family summary doc at sign-up and hourly on sync' -- web/engine/account.js web/engine/cloud.js tests/admin-wiring.test.js
```

---

### Task 5: Keep `admin/` out of the precache

**Files:**
- Modify: `tools/update-precache.js:26`
- Modify: `tests/pwa.test.js:22`
- Create (placeholder so the exclusion is tested): none; Task 6 adds the real files.

- [ ] **Step 1: Write the failing test**

In `tests/pwa.test.js`, append:

```js
test('the owner dashboard is never precached onto the kids tablets', () => {
  assert.ok(!precacheList().some((f) => f.startsWith('admin/')), 'web/admin must stay out of PRECACHE');
});
```

and change the loop in the first test from

```js
  for (const file of siteFiles().filter((f) => f !== 'sw.js')) {
```

to

```js
  for (const file of siteFiles().filter((f) => f !== 'sw.js' && !f.startsWith('admin/'))) {
```

- [ ] **Step 2: Exclude it in the tool**

In `tools/update-precache.js` replace:

```js
const files = walk(WEB).filter((f) => f !== 'sw.js').sort(
```

with:

```js
const files = walk(WEB).filter((f) => f !== 'sw.js' && !f.startsWith('admin/')).sort(
```

(keep the rest of that line unchanged), and add above it:

```js
// The owner dashboard (web/admin) is for the owner's phone or PC only, never for the kids' tablets.
```

- [ ] **Step 3: Run**

Run: `node tools/update-precache.js && node --test tests/pwa.test.js`
Expected: `web/sw.js precaches N files` (N unchanged, since `web/admin/admin-stats.js` is skipped), tests PASS. `git diff web/sw.js` must show no `admin/` line.

- [ ] **Step 4: Commit (owner runs)**

```bash
git add tools/update-precache.js tests/pwa.test.js && git commit -m 'Keep the owner dashboard out of the offline cache' -- tools/update-precache.js tests/pwa.test.js
```

---

### Task 6: The admin page

**Files:**
- Create: `web/admin/admin-config.js`, `web/admin/index.html`, `web/admin/admin.css`, `web/admin/admin.js`
- Test: `tests/admin-wiring.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/admin-wiring.test.js`:

```js
const { web, LOBBIES } = require('./paths.js');

test('the admin page loads its scripts in order and is not linked from the site', () => {
  const html = fs.readFileSync(web('admin/index.html'), 'utf8');
  const order = ['../engine/firebase-config.js', '../engine/firebase-remote.js', 'admin-config.js', 'admin-stats.js', 'admin.js'];
  const at = order.map((s) => html.indexOf('src="' + s + '"'));
  assert.ok(at.every((i) => i >= 0), 'a script is missing: ' + at);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'scripts out of order');
  assert.match(html, /<meta name="robots" content="noindex">/);
  for (const page of ['index.html', LOBBIES[5].page, LOBBIES[2].page, 'parent/index.html']) {
    assert.ok(!fs.readFileSync(web(page), 'utf8').includes('admin/'), page + ' links to the admin page');
  }
});

test('admin.js builds its text with textContent, never innerHTML', () => {
  assert.ok(!/innerHTML/.test(fs.readFileSync(web('admin/admin.js'), 'utf8')));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/admin-wiring.test.js`
Expected: FAIL (no `web/admin/index.html`).

- [ ] **Step 3: admin-config.js**

```js
/* The owner: one Firebase account, by UID and email. Paste the same UID into firebase/firestore.rules.
   The page shows your UID after you sign in, so you can copy it from there. No password is stored anywhere. */
(function (root) {
  root.OWNER_UID = 'OWNER_UID';
  root.OWNER_EMAIL = 'aspectjump.java@gmail.com';
})(this);
```

- [ ] **Step 4: index.html**

```html
<!DOCTYPE html>
<html lang="en">
<meta charset="utf-8">
<title>Study Games &mdash; Owner</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="admin.css">

<div class="wrap">
  <header class="head">
    <h1>📊 Owner dashboard</h1>
    <button type="button" id="signout" hidden>Sign out</button>
  </header>
  <p class="note" id="status" aria-live="polite"></p>

  <section id="signin-view" hidden>
    <h2>Sign in</h2>
    <div class="row">
      <input type="email" id="signin-email" autocomplete="username" placeholder="Owner email">
      <input type="password" id="signin-pass" autocomplete="current-password" placeholder="Password">
      <button type="button" id="signin-go">Sign in</button>
    </div>
  </section>

  <section id="denied-view" hidden>
    <h2>Not allowed</h2>
    <p class="note" id="denied-note"></p>
  </section>

  <main id="dash-view" hidden>
    <div class="row"><button type="button" id="refresh">↻ Refresh</button><span class="note" id="updated"></span></div>
    <div class="tiles" id="tiles"></div>
    <section><h2>Questions answered, last 30 days</h2><div class="chart" id="chart" role="img"></div><div class="axis" id="axis"></div></section>
    <section><h2>By subject, last 30 days</h2><div id="subjects"></div></section>
    <section><h2>Families</h2><div class="table" id="families"></div>
      <p class="note">A family appears here after its next sync on the updated app.</p></section>
    <section id="errors-slot" hidden></section>
    <section id="traffic-slot" hidden></section>
  </main>
</div>

<script src="../engine/firebase-config.js"></script>
<script src="../engine/firebase-remote.js"></script>
<script src="admin-config.js"></script>
<script src="admin-stats.js"></script>
<script src="admin.js"></script>
```

- [ ] **Step 5: admin.css**

```css
:root{--bg:#F4F1E9;--card:#fff;--ink:#2B2A22;--soft:#6B6656;--line:rgba(43,42,34,.12);--accent:#1B7A79;--bad:#B03A2E;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#181712;--card:#221F1A;--ink:#F1EDE0;--soft:#B2AC97;--line:rgba(241,237,224,.14);--accent:#3FBDBA;--bad:#F1948A;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:16px}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px}
h1{font-size:1.3rem;margin:.2em 0}
h2{font-size:1.05rem;margin:0 0 8px}
section,main>section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0}
.note{color:var(--soft);font-size:.9rem;margin:6px 0}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
input{flex:1 1 180px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}
button{padding:10px 14px;border:0;border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}
@media (min-width:560px){.tiles{grid-template-columns:repeat(4,1fr)}}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px}
.tile b{display:block;font-size:1.6rem}
.tile span{color:var(--soft);font-size:.85rem}
.chart{display:flex;align-items:flex-end;gap:2px;height:120px}
.bar{flex:1;background:var(--accent);border-radius:3px 3px 0 0;min-height:2px}
.axis{display:flex;justify-content:space-between;color:var(--soft);font-size:.8rem;margin-top:4px}
.sub{display:grid;grid-template-columns:1fr auto;gap:2px 8px;margin:6px 0}
.sub i{grid-column:1/3;display:block;height:6px;background:var(--accent);border-radius:3px}
.table .r{display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:8px 0;border-top:1px solid var(--line);align-items:center}
.table .r:first-child{border-top:0}
.stale{color:var(--bad);font-weight:700}
.error{color:var(--bad)}
[hidden]{display:none!important}
```

- [ ] **Step 6: admin.js**

```js
/* The owner dashboard page: sign in, check the owner, load the numbers (10-minute cache) and draw them.
   All text goes in with textContent. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var FR = root.FirebaseRemote, Stats = root.AdminStats, OWNER = root.OWNER_UID, OWNER_EMAIL = root.OWNER_EMAIL;
  var doc = root.document;
  var CACHE = 'admin_cache_v1', FRESH_MS = 10 * 60 * 1000, WINDOW_MS = Stats.DAYS * 86400000;
  var VIEWS = ['signin-view', 'denied-view', 'dash-view'];
  var $ = function (id) { return doc.getElementById(id); };

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(text, error) { $('status').textContent = text; $('status').classList.toggle('error', !!error); }
  function show(view) { VIEWS.forEach(function (v) { $(v).hidden = v !== view; }); }

  function ago(ms) {
    if (!ms) return 'Not yet';
    var min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    if (min < 1440) return Math.round(min / 60) + ' h ago';
    return Math.round(min / 1440) + ' d ago';
  }

  function readCache() {
    try {
      var c = JSON.parse(root.localStorage.getItem(CACHE));
      if (c && c.stats && Date.now() - c.at < FRESH_MS) return c.stats;
    } catch (e) {}
    return null;
  }
  function writeCache(stats) { try { root.localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), stats: stats })); } catch (e) {} }
  function clearCache() { try { root.localStorage.removeItem(CACHE); } catch (e) {} }

  function load(force) {
    var cached = force ? null : readCache();
    if (cached) return Promise.resolve(cached);
    var data = { families: [], learners: [], history: [] };
    return FR.adminRemote().then(function (admin) {
      return admin.families().then(function (families) {
        data.families = families;
        return Promise.all(families.map(function (f) { return admin.learners(f.uid); }));
      }).then(function (lists) {
        lists.forEach(function (l) { data.learners = data.learners.concat(l); });
        var since = Date.now() - WINDOW_MS;
        return Promise.all(data.learners.map(function (l) { return admin.history(l.uid, l.id, since); }));
      });
    }).then(function (parts) {
      parts.forEach(function (h) { data.history = data.history.concat(h); });
      var stats = Stats.compute(data, Date.now());
      writeCache(stats);
      return stats;
    });
  }

  function tile(value, label) {
    var t = el('div', 'tile');
    t.appendChild(el('b', '', String(value)));
    t.appendChild(el('span', '', label));
    return t;
  }

  function render(s) {
    var tiles = $('tiles');
    tiles.textContent = '';
    tiles.appendChild(tile(s.totals.families, 'families'));
    tiles.appendChild(tile(s.totals.children, 'children (G2 ' + s.totals.grade2 + ' / G5 ' + s.totals.grade5 + ')'));
    tiles.appendChild(tile(s.active.families7 + ' / ' + s.active.children7, 'active 7 days (families / children)'));
    tiles.appendChild(tile(s.questionsToday, 'questions today'));

    var max = Math.max(1, Math.max.apply(null, s.daily.map(function (d) { return d.answered; })));
    var chart = $('chart');
    chart.textContent = '';
    s.daily.forEach(function (d) {
      var bar = el('div', 'bar');
      bar.style.height = Math.round(d.answered / max * 100) + '%';
      bar.title = d.day + ': ' + d.answered;
      chart.appendChild(bar);
    });
    chart.setAttribute('aria-label', 'Questions answered per day, ' + s.daily[0].day + ' to ' + s.daily[s.daily.length - 1].day);
    $('axis').textContent = '';
    $('axis').appendChild(el('span', '', s.daily[0].day));
    $('axis').appendChild(el('span', '', 'max ' + max));
    $('axis').appendChild(el('span', '', s.daily[s.daily.length - 1].day));

    var subjects = $('subjects');
    subjects.textContent = '';
    if (!s.subjects.length) subjects.appendChild(el('p', 'note', 'No questions answered yet.'));
    var top = s.subjects.length ? s.subjects[0].answered : 1;
    s.subjects.forEach(function (x) {
      var row = el('div', 'sub');
      row.appendChild(el('span', '', x.title));
      row.appendChild(el('span', '', String(x.answered)));
      var bar = el('i');
      bar.style.width = Math.round(x.answered / top * 100) + '%';
      row.appendChild(bar);
      subjects.appendChild(row);
    });

    var fams = $('families');
    fams.textContent = '';
    if (!s.families.length) fams.appendChild(el('p', 'note', 'No families yet.'));
    s.families.forEach(function (f) {
      var r = el('div', 'r');
      r.appendChild(el('span', '', f.email || f.uid));
      r.appendChild(el('span', '', f.children + (f.children === 1 ? ' child' : ' children')));
      r.appendChild(el('span', f.stale ? 'stale' : '', ago(f.lastSeenAt)));
      fams.appendChild(r);
    });
    $('updated').textContent = 'Updated ' + ago(s.at) + '.';
  }

  function refresh(force) {
    say('Loading…');
    load(force).then(function (s) { say(''); render(s); }, function () { say('Could not load. Check the internet and tap Refresh.', true); });
  }

  function onUser(u) {
    $('signout').hidden = !u;
    if (!u) { clearCache(); show('signin-view'); say(''); return; }
    var owner = OWNER && OWNER !== 'OWNER_UID' && u.uid === OWNER && String(u.email).toLowerCase() === OWNER_EMAIL;
    if (!owner) {
      show('denied-view');
      $('denied-note').textContent = 'Signed in as ' + (u.email || 'this account') + '. Your UID is ' + u.uid +
        '. To make it the owner, paste it into web/admin/admin-config.js and firebase/firestore.rules, then publish both.';
      say('');
      return;
    }
    show('dash-view');
    refresh(false);
  }

  $('signin-go').addEventListener('click', function () {
    var email = $('signin-email').value.trim(), pass = $('signin-pass').value;
    if (!email || !pass) { say('Type the email and the password first.', true); return; }
    say('Signing in…');
    FR.signIn(email, pass).then(function () { $('signin-pass').value = ''; }, function (e) { say(FR.signInError(e), true); });
  });
  $('signout').addEventListener('click', function () { FR.signOut(); });
  $('refresh').addEventListener('click', function () { refresh(true); });

  show('signin-view');
  FR.onAuth(onUser).catch(function () { say('Could not reach Firebase. Check the internet and reload.', true); });
})(this);
```

- [ ] **Step 7: Run all tests**

Run: `node tools/update-precache.js && node --test`
Expected: PASS. `git status` shows `web/sw.js` unchanged by this step.

- [ ] **Step 8: Try the page locally**

Run: `npx serve web -l 5173` (or any static server on `web/`), open `http://localhost:5173/admin/`.
Expected: the sign-in card shows. Sign in with the owner account: "Not allowed" with your UID and the paste instruction. After pasting the UID into `admin-config.js` and the rules (Task 7), reload: the dashboard shows tiles, chart and the family table.

- [ ] **Step 9: Commit (owner runs)**

```bash
git add web/admin tests/admin-wiring.test.js && git commit -m 'Add the owner dashboard page' -- web/admin tests/admin-wiring.test.js
```

---

### Task 7: Go live (owner steps, no code)

- [ ] **Step 1:** Open the Firebase console → Authentication → Users and create (or use) the account `aspectjump.java@gmail.com` with a strong password that is not used anywhere else (type it only in the console and on the sign-in page, never in chat or the repo); copy its **User UID**. If that email is already registered, use that account; nobody else can register it.
- [ ] **Step 2:** Paste the UID over `OWNER_UID` in `web/admin/admin-config.js` and in `firebase/firestore.rules`.
- [ ] **Step 3:** Firebase console → Firestore → Rules: paste the whole `firebase/firestore.rules` and Publish.
- [ ] **Step 4:** Push to Vercel as usual. Open `/admin/`, sign in, confirm the dashboard shows. Then confirm three failures: a wrong password for the owner email is refused at sign-in; a normal family account shows "Not allowed" with no data; and in the Firebase Rules Playground a read of `families/<other uid>` as that family is denied.
- [ ] **Step 5:** Open a lobby on a tablet signed in as a family, tap Sync now, then Refresh the dashboard: that family appears (families only show after their first sync on the updated app).
- [ ] **Step 6 (commit, owner runs):**

```bash
git add web/admin/admin-config.js firebase/firestore.rules && git commit -m 'Set the owner UID for the dashboard' -- web/admin/admin-config.js firebase/firestore.rules
```

---

### Task 8: Docs

**Files:**
- Modify: `README.md` (file list near line 226), `docs/HANDOFF.md`, `docs/superpowers/specs/2026-10-09-owner-dashboard-design.md`

- [ ] **Step 1: README.** In the file list, after the `firebase/firestore.rules` line add:

```
web/admin/                     owner dashboard at /admin/ (sign in with the owner account; not linked, not cached offline)
```

and add one sentence under the cloud-sync paragraph (line ~159): "The owner can read every family's summary on `/admin/`; the owner UID is set in `web/admin/admin-config.js` and `firebase/firestore.rules`."

- [ ] **Step 2: HANDOFF.** Add a short "Owner dashboard (sub-project 1 of 3)" entry: built, live steps in plan Task 7, still to do: error reporting hook (2), Vercel Web Analytics link (3), parent progress dashboard.

- [ ] **Step 3: Spec.** In the spec's **Data** section remove `learnerCount` from the family summary doc; in **Deploy** replace step 2 with "Paste `firebase/firestore.rules` into Firebase console → Firestore → Rules and Publish (no `firebase.json` exists)".

- [ ] **Step 4: Run** `node --test` — expected PASS.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add README.md docs/HANDOFF.md docs/superpowers/specs/2026-10-09-owner-dashboard-design.md docs/superpowers/plans/2026-10-09-owner-dashboard.md && git commit -m 'Document the owner dashboard' -- README.md docs/HANDOFF.md docs/superpowers/specs/2026-10-09-owner-dashboard-design.md docs/superpowers/plans/2026-10-09-owner-dashboard.md
```

---

## Self-review

- **Spec coverage:** owner-only access (Tasks 2, 6, 7); family summary doc (3, 4); reads with 30-day window and 10-minute cache (3, 6); every number in "Numbers shown" (1); page, states, phone layout, not linked, not precached (5, 6); errors and traffic slots reserved (6); tests listed in the spec (1, 2, 3, 4, 6); deploy (7). Accepted gap: families that have not synced since the update are invisible until they do.
- **Placeholders:** none; `OWNER_UID` is a deliberate constant replaced in Task 7.
- **Names:** `putFamily`, `adminRemote` (remote method, `FR.adminRemote()` returns a promise of the reader), `AdminStats.compute`, `OWNER_UID`, cache key `admin_cache_v1`, `family_seen_<uid>` are used consistently across tasks.
