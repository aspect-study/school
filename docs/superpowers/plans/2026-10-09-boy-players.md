# Boy Players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each child gets a Girl/Boy choice; family wording (Ate/Kuya, sister/brother, her/his), the Ask Family helper,
a boy's first character and first room follow it. Girls see nothing change.

**Architecture:** `profile_v1` gains an optional `boy: true` (absent = girl), carried by `learner.js`, the sync merge and
the family peek. Pure helpers (`Family.relation`, `Family.cheersFor`, `Family.olderIsBoy`, `TEXT.visitKey`,
`PowerUps.helperLabel`, `Look.read`, `Room.start`, `House.roomOf`) take the flag; the pages pass it.

**Tech Stack:** plain ES5 browser JS in IIFEs, `node --test`, headless-Chrome e2e scripts in `tests/e2e`.

Spec: `docs/superpowers/specs/2026-10-09-boy-players-design.md`.

Rules for every task (from `CLAUDE.md`): never run `git commit` — end each task by giving the owner the commit as one
`git add <files> && git commit -m '...' -- <files>` code block, with no Co-Authored-By or Claude lines. Comments only
for non-obvious code. Filipino: "puwede", "natutuhan"; the Filipino half carries the full meaning.

---

### Task 1: The boy flag in the learner profile and the sync merge

**Files:**
- Modify: `web/engine/learner.js` (`readProfile`, `writeProfile`, `current`, `update`, `adopt`)
- Modify: `web/engine/sync-core.js:306-310` (MERGE.profile)
- Test: `tests/learner.test.js`, `tests/sync.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/learner.test.js` (it already has `create`, `storage`, `now` helpers):

```js
test('boy: a girl by default, saved with update, kept by adopt; a girl\'s profile has no boy key', () => {
  const s = storage({});
  const L = create(s, now, 5);
  assert.equal(L.current().boy, false);
  const id = L.current().id;
  assert.equal('boy' in JSON.parse(s.getItem('learner/' + id + '/profile_v1')), false);
  L.update({ boy: true });
  assert.equal(create(s, now, 5).current().boy, true);
  assert.equal(JSON.parse(s.getItem('learner/' + id + '/profile_v1')).boy, true);
  L.update({ name: 'Ben' });
  assert.equal(create(s, now, 5).current().boy, true, 'a rename keeps him a boy');
  L.update({ boy: false });
  assert.equal(create(s, now, 5).current().boy, false);
  L.adopt('cloud2', { name: 'Ben', emoji: '', grade: 5, boy: true });
  assert.equal(create(s, now, 5).current().boy, true);
  assert.equal(L.list().find((l) => l.id === 'cloud2').boy, true);
});
```

Check the profile key name first: `grep -n "learner/" tests/learner.test.js | head -3`. If the space prefix differs, use
the same prefix the existing test at line 73 uses (`'learner/' + L.current().id + '/wallet_v1'`).

Append to `tests/sync.test.js` next to the "her name" test (line 217):

```js
test('boy: the newer copy decides, and a girl\'s merged profile has no boy key', () => {
  assert.deepEqual(MERGE.profile({ name: 'Ben', emoji: '', grade: 5, at: 9, boy: true }, { name: 'Ben', emoji: '', grade: 5, at: 3 }),
    { name: 'Ben', emoji: '', grade: 5, at: 9, boy: true });
  assert.deepEqual(MERGE.profile({ name: 'Ana', emoji: '', grade: 5, at: 9 }, { name: 'Ana', emoji: '', grade: 5, at: 3, boy: true }),
    { name: 'Ana', emoji: '', grade: 5, at: 9 });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/learner.test.js tests/sync.test.js`
Expected: FAIL (`boy` is `undefined`, merged profile lacks `boy`).

- [ ] **Step 3: Implement**

`web/engine/learner.js`:

```js
    function readProfile(id) {
      var p = json(space(id).getItem(PROFILE));
      if (!p || typeof p.grade !== 'number') return null;
      return { id: id, name: typeof p.name === 'string' ? p.name : '', emoji: typeof p.emoji === 'string' ? p.emoji : '', grade: p.grade, boy: p.boy === true };
    }
    function writeProfile(l) {
      var p = { name: l.name, emoji: l.emoji, grade: l.grade, at: now() };
      if (l.boy === true) p.boy = true;
      try { space(l.id).setItem(PROFILE, JSON.stringify(p)); } catch (e) {}
    }
```

`newLearner`: add `boy: false` to the new object. `current()`:

```js
      current: function () { return me ? { id: me.id, name: me.name, emoji: me.emoji, grade: me.grade, boy: me.boy === true } : null; },
```

`update(fields)`: add before `writeProfile(me);`

```js
        if (typeof fields.boy === 'boolean') me.boy = fields.boy;
```

`adopt(id, profile)`: add `boy: profile.boy === true` to the object `l`.

Also check `migrate()` and any other place that builds a learner object (`grep -n "grade: " web/engine/learner.js`) and
give each `boy: false` (a migrated child is a girl).

`web/engine/sync-core.js` MERGE.profile:

```js
    // Name, emoji and boy: the latest change wins. Grade: the higher wins (moving up never goes back).
    profile: function (a, b) {
      if (!a || !b) return a || b;
      var newer = (Number(a.at) || 0) >= (Number(b.at) || 0) ? a : b;
      var out = { name: newer.name, emoji: newer.emoji, grade: Math.max(Number(a.grade) || 0, Number(b.grade) || 0), at: newer.at || 0 };
      if (newer.boy === true) out.boy = true;
      return out;
    },
```

- [ ] **Step 4: Run all unit tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/engine/learner.js web/engine/sync-core.js tests/learner.test.js tests/sync.test.js && git commit -m 'Boy players 1: learner profile carries boy (absent = girl), kept by update, adopt and the sync merge' -- web/engine/learner.js web/engine/sync-core.js tests/learner.test.js tests/sync.test.js
```

---

### Task 2: Girl/Boy choice on the start page

**Files:**
- Modify: `web/engine/account.js` (`checkChild`, `label`, form chips, `renderChildren`, `kid-add`, messages)
- Modify: `web/index.html:97-104` (children view)
- Test: `tests/account.test.js`, `tests/e2e/account-e2e.js`

- [ ] **Step 1: Write the failing unit test**

Replace the `checkChild` test in `tests/account.test.js` (lines 30-37) with:

```js
test('checkChild', () => {
  assert.equal(A.checkChild({ name: '  ', grade: 5, boy: false }).error, 'Type the name.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 0, boy: false }).error, 'Pick the grade.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 3, boy: false }).error, 'Pick the grade.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 5 }).error, 'Pick girl or boy.');
  assert.deepEqual(A.checkChild({ name: ' Ana ', emoji: A.EMOJIS[1], grade: '2', boy: false }), { error: '', child: { name: 'Ana', emoji: A.EMOJIS[1], grade: 2, boy: false } });
  assert.equal(A.checkChild({ name: 'Ben', grade: 5, boy: true }).child.boy, true);
  assert.equal(A.checkChild({ name: 'x'.repeat(40), grade: 5, boy: false }).child.name.length, 30);
  assert.equal(A.checkChild({ name: 'Ana', emoji: 'x', grade: 5, boy: false }).child.emoji, A.EMOJIS[0]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/account.test.js`
Expected: FAIL on 'Type the name.'.

- [ ] **Step 3: Implement**

`web/engine/account.js` (keep the file ASCII-only: write emoji as `👧` girl, `👦` boy):

```js
  function checkChild(c) {
    var name = String(c.name || '').trim().slice(0, NAME_MAX);
    if (!name) return { error: 'Type the name.' };
    var grade = Number(c.grade);
    if (GRADES.indexOf(grade) < 0) return { error: 'Pick the grade.' };
    if (typeof c.boy !== 'boolean') return { error: 'Pick girl or boy.' };
    return { error: '', child: { name: name, emoji: EMOJIS.indexOf(c.emoji) >= 0 ? c.emoji : EMOJIS[0], grade: grade, boy: c.boy } };
  }
```

`label(k)`:

```js
  function label(k) {
    var p = k.profile || {};
    return (p.emoji ? p.emoji + ' ' : '') + (p.name || 'No name yet') + ' · Grade ' + p.grade + ' · ' + (p.boy === true ? 'Boy' : 'Girl');
  }
```

Form state: `form = { emoji: EMOJIS[0], grade: 0, boy: null }` in both places (the `var` at the top and in
`renderChildren`). After the `GRADES.forEach` chip loop add:

```js
  [['0', '👧 Girl'], ['1', '👦 Boy']].forEach(function (k) {
    var b = el('button', 'chip', k[1]);
    b.type = 'button';
    b.setAttribute('data-boy', k[0]);
    $('kid-kinds').appendChild(b);
  });
```

In `drawForm()` add:

```js
    Array.prototype.forEach.call($('kid-kinds').children, function (b) {
      var on = form.boy !== null && (b.getAttribute('data-boy') === '1') === form.boy;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
```

Click handler next to the grade one:

```js
  $('kid-kinds').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-boy]');
    if (b) { form.boy = b.getAttribute('data-boy') === '1'; drawForm(); }
  });
```

`kid-add`: pass `boy: form.boy` to `checkChild`; build the profile with the flag only for boys:

```js
    var profile = { name: r.child.name, emoji: r.child.emoji, grade: r.child.grade, at: Date.now() };
    if (r.child.boy) profile.boy = true;
```

Its error text: `'Could not save the child. ' + OFFLINE`. The register message (line ~143):
`' on this tablet is backed up at the next sync. Add only brothers or sisters with Add a child.'`.

`web/index.html` children view: placeholder `"Child's name"`, and after `#kid-grades`:

```html
    <div class="chips" id="kid-kinds" role="group" aria-label="Girl or boy"></div>
```

- [ ] **Step 4: Update the account e2e**

In `tests/e2e/account-e2e.js` `create` page steps (lines 94-97): after picking grade 5 and the emoji, the next
`kid-add` now reports the missing choice. Replace lines 96-97 with:

```js
  function () { log.noGrade = msg(); document.querySelector('#kid-grades [data-grade="5"]').click(); document.querySelector('#kid-emojis [data-emoji="' + Account.EMOJIS[1] + '"]').click(); click('kid-add'); },
  function () { log.noKind = msg(); document.querySelector('#kid-kinds [data-boy="0"]').click(); click('kid-add'); },
  function () { log.added = msg(); type('kid-name', 'Bea'); document.querySelector('#kid-grades [data-grade="2"]').click(); document.querySelector('#kid-kinds [data-boy="0"]').click(); click('kid-add'); },
  function () { log.addedBea = msg(); type('kid-name', 'Ben'); document.querySelector('#kid-grades [data-grade="2"]').click(); document.querySelector('#kid-kinds [data-boy="1"]').click(); click('kid-add'); },
```

Then update the assertions: find where `log.noName`, `log.noGrade`, `log.added`, `log.listed`, `pickLabels` are
asserted (`grep -n "noName\|noGrade\|log.added\|listed\|pickLabels" tests/e2e/account-e2e.js`) and change:
- `noName` → `'Type the name.'`, `noGrade` → `'Pick the grade.'`, add `assert.equal(a.log.noKind, 'Pick girl or boy.');`
- `added` text now ends `· Grade 5 · Girl.`; add `assert.ok(a.log.addedBea.includes('Bea'));`
- `listed` 2 → 3, `pickLabels.length` 2 → 3
- add, after the Bea checks:

```js
  const ben = Object.keys(learners).find((id) => learners[id].name === 'Ben');
  assert.equal(learners[ben].boy, true, 'Ben is saved as a boy');
  assert.equal('boy' in learners[bea], false, 'a girl\'s profile has no boy key');
```

- [ ] **Step 5: Run**

Run: `node --test` then `node tests/e2e/account-e2e.js`
Expected: all pass; `Account e2e passed`.

- [ ] **Step 6: Commit (owner runs)**

```bash
git add web/engine/account.js web/index.html tests/account.test.js tests/e2e/account-e2e.js && git commit -m 'Boy players 2: Add child asks girl or boy; neutral start-page wording' -- web/engine/account.js web/index.html tests/account.test.js tests/e2e/account-e2e.js
```

---

### Task 3: Girl/Boy in the lobby Learner settings; neutral parent notes

**Files:**
- Modify: `web/lobby/grade-5.html` and `web/lobby/grade-2.html` (`#learner-section`)
- Modify: `web/engine/parent-panel.js` (`renderLearner`, `learner-save`, lines ~260, ~307, ~738)
- Test: `tests/e2e/lobby-e2e.js:81`, `tests/e2e/migration-e2e.js`

- [ ] **Step 1: Lobby HTML (both files)**

In `#learner-section`, after the Emoji label:

```html
              <label>Child <select id="learner-boy"><option value="0">👧 Girl</option><option value="1">👦 Boy</option></select></label>
```

Replace the note `Her name stays on this tablet and in her backups. It is never put on the website.` with
`The name stays on this tablet and in the backups. It is never put on the website.`

- [ ] **Step 2: parent-panel.js**

`renderLearner()`: after the emoji line add `$('learner-boy').value = me.boy ? '1' : '0';`.
`learner-save`:

```js
        L.update({ name: $('learner-name').value, emoji: $('learner-emoji').value, boy: $('learner-boy').value === '1' });
```

Neutral notes:
- line ~260: `'Picked “' + q.repeatedPick + '” more than once: may be mixing these up.'`
- line ~307: `'📌 In the review now: ' + what + '. They come back under Review in the lobby.'`
- line ~738: `'... Make the backup where the points show (the same app and the same link), then try again.'`

- [ ] **Step 3: Update e2e strings**

`tests/e2e/lobby-e2e.js:81`: `'📌 In the review now: 1 question.'`. Run
`grep -rn "she may be mixing\|where she can see\|Her name stays" tests` and update any hit the same way.

- [ ] **Step 4: Run**

Run: `node --test`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/migration-e2e.js`
Expected: all pass.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html web/engine/parent-panel.js tests/e2e/lobby-e2e.js && git commit -m 'Boy players 3: girl or boy in the lobby Learner settings; parent notes no longer assume she' -- web/lobby/grade-5.html web/lobby/grade-2.html web/engine/parent-panel.js tests/e2e/lobby-e2e.js
```

---

### Task 4: Family wording: Ate/Kuya, sister/brother, his/him, cheers to Kuya

**Files:**
- Modify: `web/engine/family.js` (`relation`, `sisters`, `unseenCheers`, new `cheersFor`, `olderIsBoy`, `TEXT`, `mountUi`, exports)
- Test: `tests/family.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/family.test.js`, add `cheersFor, olderIsBoy` to the require destructuring (line 8), replace the relation
asserts (lines 106-108) with:

```js
  assert.equal(relation(5, 2), 'bunso');
  assert.equal(relation(5, 2, true), 'bunso');
  assert.equal(relation(2, 5), 'ate');
  assert.equal(relation(2, 5, true), 'kuya');
  assert.equal(relation(5, 5), 'sister');
  assert.equal(relation(5, 5, true), 'brother');
```

and append:

```js
test('cheers to a boy say Kuya; ids and the Ate side stay the same', () => {
  const toKuya = cheersFor('fromBunso', true);
  assert.deepEqual(toKuya.map((c) => c.id), CHEERS.fromBunso.map((c) => c.id));
  assert.equal(toKuya[0].text, 'Galing mo, Kuya! · You\'re great! 🌟');
  assert.ok(toKuya.every((c) => !/\bAte\b/.test(c.text)));
  assert.deepEqual(cheersFor('fromBunso', false), CHEERS.fromBunso);
  assert.deepEqual(cheersFor('fromAte', true), CHEERS.fromAte, 'Bunso is the same word for a boy');
});

test('a boy sibling: rel, boy, and the his/him words', () => {
  const peek = { ben: { profile: { name: 'Ben', grade: 5, boy: true } }, mia: { profile: { name: 'Mia', grade: 5 } } };
  const list = sisters({ id: 'me', grade: 2 }, peek, 0, {});
  assert.deepEqual(list.map((s) => [s.id, s.rel, s.boy]), [['ben', 'kuya', true], ['mia', 'ate', false]]);
  assert.equal(TEXT.grade5.kuya, 'Kuya');
  assert.equal(TEXT.grade5.brother, 'Brother');
  assert.equal(TEXT.grade2.brother, 'Kapatid · Brother');
  assert.match(TEXT.grade5.buddy('Ben', true), /his big moments/);
  assert.match(TEXT.grade5.buddy('Mia', false), /her big moments/);
  assert.equal(TEXT.grade5.noNewsBoy, 'No big moments yet. Cheer him on!');
  assert.equal(TEXT.grade2.noNewsBoy, 'Wala pa. I-cheer mo siya! · No big moments yet. Go and cheer him on!');
});

test('olderIsBoy: only when every older sibling is a boy', () => {
  const me = { id: 'me', grade: 2 };
  assert.equal(olderIsBoy(me, {}), false);
  assert.equal(olderIsBoy(me, { ben: { profile: { grade: 5, boy: true } } }), true);
  assert.equal(olderIsBoy(me, { ben: { profile: { grade: 5, boy: true } }, mia: { profile: { grade: 5 } } }), false);
  assert.equal(olderIsBoy(me, { tom: { profile: { grade: 2, boy: true } } }), false, 'same grade is not older');
});

test('unseen cheers from a younger sibling to a boy say Kuya', () => {
  const peek = { mia: { profile: { name: 'Mia', grade: 2 }, family: { v: 1, sent: [{ to: 'me', cheer: 'great', t: 50 }], news: [], at: 0 } } };
  const out = unseenCheers({ id: 'me', grade: 5, boy: true }, peek, {});
  assert.equal(out[0].text, 'Galing mo, Kuya! · You\'re great! 🌟');
});
```

Before writing the last test, look at how an existing `unseenCheers` test builds `family` (`grep -n "unseenCheers" tests/family.test.js`)
and copy its shape for the `family` object so `clean()` keeps the entry.

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/family.test.js`
Expected: FAIL (`cheersFor` is not a function, rel `ate` for Ben).

- [ ] **Step 3: Implement in `web/engine/family.js`**

```js
  // What she is to me: the higher grade is Ate, or Kuya for a boy.
  function relation(myGrade, herGrade, herBoy) {
    if (herGrade > myGrade) return herBoy ? 'kuya' : 'ate';
    if (herGrade < myGrade) return 'bunso';
    return herBoy ? 'brother' : 'sister';
  }
```

`cheerText` and the new `cheersFor`:

```js
  // The younger child's cheers call the receiver Ate; a boy receiver is Kuya. Ids never change.
  function cheersFor(voice, toBoy) {
    var list = has(CHEERS, voice) ? CHEERS[voice] : [];
    if (!(toBoy && voice === 'fromBunso')) return list;
    return list.map(function (c) { return { id: c.id, text: c.text.replace(/\bAte\b/g, 'Kuya') }; });
  }
  function cheerText(voice, id, toBoy) {
    var list = cheersFor(voice, toBoy);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].text;
    return null;
  }
```

`sisters()`: `var ..., boy = prof.boy === true;` then `rel: relation(num(me.grade), grade, boy)` and add `boy: boy` to
the returned entry.

`unseenCheers()`: `rel = relation(num(me.grade), num(prof.grade), prof.boy === true)`, and
`var text = cheerText(voiceOf(rel), s.cheer, me.boy === true);`.

```js
  function olderIsBoy(me, peek) {
    var older = sisters(me, peek, 0, {}).filter(function (s) { return s.rel === 'ate' || s.rel === 'kuya'; });
    return older.length > 0 && older.every(function (s) { return s.boy; });
  }
```

TEXT.grade5: `ate: 'Ate', kuya: 'Kuya', bunso: 'Bunso', sister: 'Sister', brother: 'Brother',`
`buddy: function (name, boy) { return name + '\'s buddy. Tap to see ' + (boy ? 'his' : 'her') + ' big moments and send a cheer.'; },`
add `noNewsBoy: 'No big moments yet. Cheer him on!',`.

TEXT.grade2: `ate: 'Ate', kuya: 'Kuya', bunso: 'Bunso', sister: 'Kapatid · Sister', brother: 'Kapatid · Brother',`
`buddy: function (name, boy) { return 'Kasama ni ' + name + '. Pindutin para makita at i-cheer siya. · ' + name + '\'s buddy. Tap to see ' + (boy ? 'his' : 'her') + ' big moments and send a cheer.'; },`
add `noNewsBoy: 'Wala pa. I-cheer mo siya! · No big moments yet. Go and cheer him on!',`.

`mountUi`: the buddy aria label `T.buddy(name, s.boy)`; the card `s.news.length ? ... : T.noNews` becomes
`if (!s.news.length) ul.appendChild(el('li', '', s.boy ? T.noNewsBoy : T.noNews));`; the cheer grid loop
`cheersFor(voiceOf(relation(s.grade, num(me().grade))), s.boy).forEach(...)`.

Exports: add `cheersFor: cheersFor, olderIsBoy: olderIsBoy`.

If `tests/family.test.js` checks that grade5 and grade2 TEXT have the same keys, the new keys are in both, so it holds.

- [ ] **Step 4: Run**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/engine/family.js tests/family.test.js && git commit -m 'Boy players 4: family buddy and cheers say Kuya, brother, his and him for a boy' -- web/engine/family.js tests/family.test.js
```

---

### Task 5: The 3D world: visit button, sibling lines, a boy's first look and room

**Files:**
- Modify: `web/world/text.js` (BUTTONS, grade5/grade2 `sisterChoosingBoy`, `visitKey`, exports)
- Modify: `web/world/kin.js:205-212` (choosing line, cheer buttons)
- Modify: `web/world/world-main.js` (line 62 `Look.read`, `actLabel` line 298, `sisterHouse` line 498, `H.roomOf` line 610)
- Modify: `web/world/look.js` (`read`), `web/world/room.js` (`start`), `web/world/house.js` (`roomOf`)
- Test: `tests/world3d-text.test.js`, `tests/world3d-look.test.js`, `tests/world3d-room.test.js`, `tests/world3d-house.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/world3d-text.test.js`: change the require to `const { TEXT, english, visitKey } = require(worldFile('text.js'));`,
add `'sisterChoosingBoy'` to the key lists at lines 61 and 64 (the `{name}` count check), and append:

```js
test('the visit button follows the sibling', () => {
  assert.equal(TEXT.grade2[visitKey('ate')], "👀 Visit Ate's room");
  assert.equal(TEXT.grade2[visitKey('kuya')], "👀 Visit Kuya's room");
  assert.equal(TEXT.grade5[visitKey('bunso')], "👀 Visit Bunso's room");
  assert.equal(TEXT.grade5[visitKey('sister')], "👀 Visit your sister's room");
  assert.equal(TEXT.grade5[visitKey('brother')], "👀 Visit your brother's room");
  assert.match(TEXT.grade5.sisterChoosingBoy, /his look/);
  assert.match(TEXT.grade2.sisterChoosingBoy, /kanyang itsura.*his look/);
});
```

`tests/world3d-look.test.js` (uses its `memory` helper):

```js
test('a boy with no character yet starts as a boy with short hair; a made character never changes', () => {
  const fresh = Look.read(memory({}), true);
  assert.equal(fresh.made, false);
  assert.equal(fresh.look.body, 'boy');
  assert.equal(fresh.look.hair, 'short');
  assert.equal(Look.read(memory({}), false).look.body, 'girl');
  const made = memory({});
  Look.save(made, Object.assign({}, Look.DEFAULT), 5);
  assert.equal(Look.read(made, true).look.body, 'girl', 'her saved choice stays');
});
```

Check `Look.KEY` is what `save` writes (it is); `memory` must have `setItem` — if it does not, build the saved look with
`memory({ [Look.KEY]: JSON.stringify(Object.assign({}, Look.DEFAULT, { t: 5 })) })` instead.

`tests/world3d-room.test.js` next to the `R.start(F, 4)` test (line 89):

```js
test('a boy\'s new room has the free blue walls; a girl\'s stays pink', () => {
  assert.equal(R.start(F, 4, true).wall, 'home-wall-blue');
  assert.equal(R.start(F, 4).wall, 'home-wall-pink');
  assert.deepEqual(R.start(F, 4, true).placed, R.start(F, 4).placed);
});
```

`tests/world3d-house.test.js` next to line 108:

```js
test('roomOf: a boy with no room gets blue walls; a saved room keeps its walls', () => {
  assert.equal(House.roomOf(House.read(memory({})), 4, true).wall, 'home-wall-blue');
  assert.equal(House.roomOf(House.read(memory({})), 4).wall, 'home-wall-pink');
});
```

(use the storage helper that file already uses for line 108; adjust the name if it is not `memory`.)

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/world3d-text.test.js tests/world3d-look.test.js tests/world3d-room.test.js tests/world3d-house.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

`web/world/text.js` BUTTONS: replace `visitAte: "👀 Visit Ate's room", visitBunso: "👀 Visit Bunso's room",` with

```js
    visitAte: "👀 Visit Ate's room", visitKuya: "👀 Visit Kuya's room", visitBunso: "👀 Visit Bunso's room",
    visitSister: "👀 Visit your sister's room", visitBrother: "👀 Visit your brother's room",
```

grade5 after `sisterChoosing`: `sisterChoosingBoy: '🎨 {name} is still choosing his look! Want to send a cheer?',`
grade2 after `sisterChoosing`:
`sisterChoosingBoy: '🎨 Pumipili pa si {name} ng kanyang itsura! Gusto mo bang magpadala ng cheer? · {name} is still choosing his look! Want to send a cheer?',`

```js
  var VISIT = { ate: 'visitAte', kuya: 'visitKuya', bunso: 'visitBunso', sister: 'visitSister', brother: 'visitBrother' };
  function visitKey(rel) { return VISIT[rel] || 'visitSister'; }
```

and add `visitKey: visitKey` to the exported object (Node and `root.World3D` paths, same as `english`).

`web/world/kin.js` `openSister`:

```js
      var choosing = s.boy ? T.sisterChoosingBoy : T.sisterChoosing;
      var line = (!x.made ? choosing : s.playing ? T.sisterPlaying : T.sisterHello).split('{name}').join(x.name);
      var buttons = F.cheersFor(F.voiceOf(F.relation(s.grade, x.myGrade)), s.boy).filter(function (c) {
```

`web/world/look.js`:

```js
  // boy: a child with no character yet starts with the boy body and short hair.
  function read(storage, boy) {
    var raw = null;
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    var look = clean(raw);
    if (!(look.t > 0) && boy) { look.body = 'boy'; look.hair = 'short'; }
    return { look: look, made: look.t > 0 };
  }
```

`web/world/room.js`:

```js
  // A new room: the starter pieces auto-placed in order; a boy's walls are the free blue ones.
  function start(cat, size, boy) {
    var room = { size: size, placed: [], wall: boy ? 'home-wall-blue' : cat.STARTER_ROOM.wall, floor: cat.STARTER_ROOM.floor, stars: false };
```

`web/world/house.js`: `function roomOf(data, size, boy)` → `... : Room.start(Furniture, size, boy);`

`web/world/world-main.js`:
- near the top of `start()`, before line 62:
  `var meL = null;` `try { meL = root.Learner && root.Learner.current ? root.Learner.current() : null; } catch (e) {}`
  `var myBoy = !!(meL && meL.boy);` and line 62 becomes `var mine = W.Look.read(store, myBoy), look = mine.look;`
- `sisterHouse()` return object: add `rel: s.rel, boy: s.boy,`
- `actLabel`: `if (it.kind === 'house-visit') return T[W.Text.visitKey(sister ? sister.rel : 'sister')];` — check how
  text.js is reached in world-main (`grep -n "W.Text\|Text\." web/world/world-main.js | head -3`) and use that name.
- line 610: `room: H.roomOf(data, size, sis ? sis.boy : myBoy)`

- [ ] **Step 4: Run**

Run: `node --test` then `node tests/e2e/world-e2e.js`
Expected: all unit tests pass; world e2e prints every `ok` line including `"ok her sister's room: view only, trophy names, a cheer"` (Mia is grade 2 for a grade 5 player, so the label is still "Visit Bunso's room").

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/world/text.js web/world/kin.js web/world/world-main.js web/world/look.js web/world/room.js web/world/house.js tests/world3d-text.test.js tests/world3d-look.test.js tests/world3d-room.test.js tests/world3d-house.test.js && git commit -m 'Boy players 5: world visit button and sibling lines follow the sibling; a boy starts as a boy with blue walls' -- web/world/text.js web/world/kin.js web/world/world-main.js web/world/look.js web/world/room.js web/world/house.js tests/world3d-text.test.js tests/world3d-look.test.js tests/world3d-room.test.js tests/world3d-house.test.js
```

---

### Task 6: Ask Family helper is Kuya for an older brother

**Files:**
- Modify: `web/engine/powerups.js:100, 269, 274` and exports
- Modify: `web/engine/wallet.js:328-330` (coin guide), `web/engine/study-history.js:37`
- Test: `tests/powerups.test.js`, `tests/study-history.test.js:600`, any wallet test on the guide text

- [ ] **Step 1: Write the failing test**

In `tests/powerups.test.js` add `helperLabel` to the require and append:

```js
test('Ask Family: the Ate helper is Kuya when the older sibling is a boy', () => {
  assert.deepEqual(helperLabel('ate', false), ['👧', 'Ate']);
  assert.deepEqual(helperLabel('ate', true), ['👦', 'Kuya']);
  assert.deepEqual(helperLabel('mommy', true), ['👩', 'Mommy']);
  assert.deepEqual(helperLabel('tatay', false), ['👨', 'Tatay']);
});
```

Change `tests/study-history.test.js:600` to expect `'Hint, Ask Ate or Kuya (5 coins)'`.

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/powerups.test.js tests/study-history.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

`web/engine/powerups.js`:

```js
  var HELPER_LABEL = { ate: ['👧', 'Ate'], mommy: ['👩', 'Mommy'], tatay: ['👨', 'Tatay'] };
  function helperLabel(helper, olderBoy) { return helper === 'ate' && olderBoy ? ['👦', 'Kuya'] : HELPER_LABEL[helper]; }
```

Inside the page UI (where lines 269/274 are), add

```js
    function olderBoy() {
      var F = root.Family, L = root.Learner;
      try { return !!(F && F.olderIsBoy && L && L.current() && F.olderIsBoy(L.current(), F.readPeek(L.storage))); } catch (e) { return false; }
    }
```

(if the UI function receives a `win` instead of `root`, use that name) and use `helperLabel(helper, olderBoy()).join(' ')`
at line 269 and `helperLabel(asked, olderBoy())[1]` at line 274. Add `helperLabel: helperLabel` to `exported`.

`web/engine/study-history.js:37`: `ate: 'Ask Ate or Kuya'`.

`web/engine/wallet.js` coin guide Ask Family entry: `'Tanungin si Ate o Kuya (' + ...` and `'Ask Ate or Kuya (' + ...`.
Then `grep -rn "Tanungin si Ate\|Ask Ate (" tests` and update any hit to the new text.

- [ ] **Step 4: Run**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit (owner runs)**

```bash
git add web/engine/powerups.js web/engine/wallet.js web/engine/study-history.js tests/powerups.test.js tests/study-history.test.js && git commit -m 'Boy players 6: Ask Family shows Kuya when the older sibling is a boy; guide and history say Ate or Kuya' -- web/engine/powerups.js web/engine/wallet.js web/engine/study-history.js tests/powerups.test.js tests/study-history.test.js
```

(add any wallet test file changed in Step 3 to both lists.)

---

### Task 7: Full check and docs

**Files:**
- Modify: `docs/HANDOFF.md`, `README.md` (only if it lists profile fields or the Add child steps)

- [ ] **Step 1: Run everything**

Run: `node --test`, then every e2e script listed in `README.md` (at least `account-e2e.js`, `lobby-e2e.js`,
`migration-e2e.js`, `world-e2e.js`).
Expected: all pass. Report any failure with its output; do not claim done otherwise.

- [ ] **Step 2: Attribution check**

Run: `git log origin/main..HEAD --grep='Co-Authored-By\|Claude-Session'`
Expected: prints nothing.

- [ ] **Step 3: HANDOFF**

Add a "Boy players" line under what is built: boy flag on `profile_v1` (absent = girl), Girl/Boy on Add child and in
Learner settings, Ate/Kuya and sister/brother wording, Ask Family Kuya, boy's first look and blue walls; accepted gaps:
the character maker still lets anyone pick any body, the guide and history say "Ate or Kuya".

- [ ] **Step 4: Commit (owner runs)**

```bash
git add docs/HANDOFF.md && git commit -m 'Handoff: boy players built' -- docs/HANDOFF.md
```
