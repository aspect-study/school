# Celebration Popups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A short popup in all 15 games celebrates a new medal, a whole game reaching a medal level, and fixed mistakes, with specific words and one gentle next step.

**Architecture:** `recall.js` counts fixed mistakes per round (`Recall.fixed()`). `mastery.js` reports each new medal's question count and when a game's lowest medal rises (`subjectUp`, `toNext`), and turns that into popup events in the grade's language (`events`). `fx.js` (already in every page, with mute, reduced-motion and confetti) draws the popup with `Fx.celebrate(events)`. Each game's existing `showMedals` gets one line.

**Tech Stack:** Plain ES5 engine files, `node --test`, headless-Chrome e2e in `tests/e2e/`.

**Spec:** `docs/superpowers/specs/2026-10-02-celebrations-design.md`

**House rules for every task:**
- Never run `git commit`. Each task ends by staging its files with `git add`; the user commits.
- Run unit tests from the repo root with `node --test <files>` (never `node --test tests/`).
- Engine files are ES5: no arrow functions, `let`/`const`, template strings or `Object.assign`.
- Comments only where the code is not obvious.
- Grade 2 text pairs Filipino with English; buttons are English only.

---

## File map

| File | Change |
|---|---|
| `web/engine/recall.js` | count fixed mistakes per round; `fixed()` |
| `web/engine/mastery.js` | `count` per new medal, `subjectUp`, `toNext`, popup text, `events()` |
| `web/engine/fx.js` | `celebrate`, `celebrateNow`, `queued`, popup CSS, `POP_MS` |
| 15 game pages | one line in `showMedals` |
| `tests/recall.test.js`, `tests/mastery.test.js`, `tests/fx.test.js`, `tests/english-everywhere.test.js`, `tests/mastery-wiring.test.js` | new cases |
| `tests/e2e/driver-common.page.js`, `tests/e2e/apps-e2e.js` | popup checks |
| `README.md` | features line |

---

### Task 1: recall.js counts fixed mistakes

A fixed mistake is a question in box 1 (missed before) answered right, on her own, while due. A same-day retry is resting, a helped answer goes back to box 1, so neither counts.

**Files:**
- Modify: `web/engine/recall.js` (the `round` object in `create`, `begin`, `points`, and the returned API)
- Test: `tests/recall.test.js`

- [ ] **Step 1: Write the failing test** — append to `tests/recall.test.js`:

```js
test('fixed counts missed questions answered right while due, per round', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  const day1 = [];
  r.begin(day1, 'a'); r.missed();
  r.begin(day1, 'b'); r.points(false, 10, 0);
  assert.equal(r.fixed(), 0, 'a miss is not a fix');
  const retry = [];
  r.begin(retry, 'a');
  assert.equal(r.points(false, 10, 0), 0, 'same day: resting');
  assert.equal(r.fixed(), 0, 'a same-day retry is not a fix');
  now.days(1);
  const helped = [];
  r.begin(helped, 'a'); r.points(true, 10, 0);
  assert.equal(r.fixed(), 0, 'a helped answer is not a fix');
  now.days(1);
  const due = [];
  r.begin(due, 'a'); r.points(false, 10, 0);
  assert.equal(r.fixed(), 1, 'box 1, due, right on her own');
  r.begin([], 'c');
  assert.equal(r.fixed(), 0, 'a new round starts at 0');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/recall.test.js`
Expected: FAIL with `r.fixed is not a function`.

- [ ] **Step 3: Implement** — in `web/engine/recall.js`:

Replace

```js
    var current = null, lastQuiz = null, round = { resting: 0, moved: 0, bonus: 0 };
```

with

```js
    var current = null, lastQuiz = null, round = { resting: 0, moved: 0, bonus: 0, fixed: 0 };
```

In `begin`, replace

```js
        if (quiz !== lastQuiz) { lastQuiz = quiz; round = { resting: 0, moved: 0, bonus: 0 }; }
```

with

```js
        if (quiz !== lastQuiz) { lastQuiz = quiz; round = { resting: 0, moved: 0, bonus: 0, fixed: 0 }; }
```

In `points`, replace

```js
        if (from) { round.moved++; round.bonus += gap; }
```

with

```js
        if (from) { round.moved++; round.bonus += gap; }
        if (from === 1) round.fixed++;
```

In the returned object, after `missed: function () { ... },` add

```js
      // Missed questions answered right on their due day in the current round.
      fixed: function () { return round.fixed; },
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/recall.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/recall.js tests/recall.test.js
```

---

### Task 2: mastery.js reports milestones and builds popup events

**Files:**
- Modify: `web/engine/mastery.js` (`TEXT`, helpers, `update`, and a new `events` in `create`)
- Test: `tests/mastery.test.js`, `tests/english-everywhere.test.js`

- [ ] **Step 1: Write the failing tests** — in `tests/mastery.test.js`, change the existing line

```js
  assert.deepEqual(up.newly, [{ id: 'l1', title: 'Lesson l1', level: 2, points: 60 }]);
```

to

```js
  assert.deepEqual(up.newly, [{ id: 'l1', title: 'Lesson l1', level: 2, points: 60, count: 1 }]);
```

and append:

```js
test('a new medal, a game-wide milestone and fixed mistakes become popup events, biggest first', () => {
  const s = memory({ review_v1: boxes({ a: 1, a2: 1, b: 2 }) });
  const m = create(s, now, 'grade5'), lessons = [lesson('l1', ['a', 'a2']), lesson('l2', ['b'])];
  assert.equal(m.update('life-lab', lessons).subjectUp, 0, 'the first report never celebrates');
  s.data.review_v1 = boxes({ a: 3, a2: 3, b: 2 });
  const r = m.update('life-lab', lessons);
  assert.equal(r.subjectUp, 1, 'every lesson now has Bronze or better');
  assert.equal(r.toNext, 1, 'one lesson is still below Silver');
  assert.deepEqual(m.events(r, 2, 'Life Lab'), [
    { big: true, icon: '🏆', title: 'All of Life Lab is Bronze!', line: 'Every lesson has 🥉 or better.', next: 'Next: all-Silver, 1 lesson to go' },
    { big: true, icon: '🥈', title: 'Silver: Lesson l1!', line: 'You got all 2 questions right on 2 different days.', next: '🥇 next: once more in about 7 days' },
    { big: false, icon: '🔧', title: 'You fixed 2 mistakes!', line: '2 questions you missed before are right now.', next: 'They come back in 3 days to check' },
  ]);
  assert.equal(m.update('life-lab', lessons).subjectUp, 0, 'it celebrates once');
  assert.deepEqual(m.events(m.update('life-lab', lessons), 0, 'Life Lab'), [], 'nothing new, no popup');
});

test('popup text for each medal, all-Gold and a single fix', () => {
  const T = create(memory(), now, 'grade5');
  const ev = (result, fixed) => T.events(Object.assign({ newly: [], subjectUp: 0, toNext: 0 }, result), fixed || 0, 'Life Lab');
  assert.deepEqual(ev({ newly: [{ id: 'x', title: 'Plants', level: 1, points: 20, count: 1 }] }), [
    { big: false, icon: '🥉', title: 'Bronze: Plants!', line: 'You got every question right.', next: '🥈 next: get them right again in 3 days' }]);
  assert.deepEqual(ev({ newly: [{ id: 'x', title: 'Plants', level: 3, points: 80, count: 3 }] }), [
    { big: true, icon: '🥇', title: 'Gold: Plants!', line: 'You got all 3 questions right on 3 different days.', next: 'It comes back in 2 weeks to stay strong' }]);
  assert.deepEqual(ev({ subjectUp: 3 })[0].next, 'Every lesson is Gold. Amazing!');
  assert.deepEqual(ev({}, 1), [
    { big: false, icon: '🔧', title: 'You fixed 1 mistake!', line: 'A question you missed before is right now.', next: 'It comes back in 3 days to check' }]);
  const g2 = create(memory(), now, 'grade2').events({ newly: [{ id: 'x', title: 'Halaman', level: 2, points: 40, count: 4 }], subjectUp: 0, toNext: 0 }, 0, 'Kuwentista');
  assert.equal(g2[0].title, 'Pilak · Silver: Halaman!');
});

test('a failed save never celebrates a milestone twice', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) });
  const m = create(s, now, 'grade5'), lessons = [lesson('l1', ['a'])];
  m.update('life-lab', lessons);
  s.data.review_v1 = boxes({ a: 2 });
  const failing = { getItem: s.getItem, setItem: () => { throw new Error('full'); } };
  const r = create(failing, now, 'grade5').update('life-lab', lessons);
  assert.equal(r.subjectUp, 0);
  assert.deepEqual(r.newly, []);
});
```

In `tests/english-everywhere.test.js`, replace the whole test `'every Grade 2 medal line has English'` with:

```js
test('every Grade 2 medal and popup line has English', () => {
  const { TEXT } = require(engineFile('mastery.js'));
  const c = { gold: 1, silver: 2, bronze: 3, total: 9 };
  const samples = {
    newLine: [[{ level: 2, title: 'Halaman', points: 40 }]],
    chip: [[c]],
    name: [[1], [2], [3]],
    medalTitle: [[{ level: 1, title: 'Halaman' }], [{ level: 2, title: 'Halaman' }], [{ level: 3, title: 'Halaman' }]],
    medalLine: [[1, 1], [1, 5], [2, 5], [3, 5]],
    medalNext: [[1], [2], [3]],
    subjectTitle: [[1, 'Kuwentista'], [2, 'Kuwentista'], [3, 'Kuwentista']],
    subjectLine: [[1], [2], [3]],
    subjectNext: [[1, 1], [2, 3], [3, 0]],
    fixedTitle: [[1], [3]],
    fixedLine: [[1], [3]],
    fixedNext: [[1], [3]],
  };
  for (const [key, value] of Object.entries(TEXT.grade2)) {
    if (typeof value !== 'function') { hasEnglishWhereFilipino(value, 'medal ' + key); continue; }
    assert.ok(samples[key], 'add sample arguments for ' + key);
    for (const args of samples[key]) hasEnglishWhereFilipino(value(...args), 'medal ' + key);
  }
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test tests/mastery.test.js tests/english-everywhere.test.js`
Expected: FAIL (`count` missing, `m.events is not a function`, missing sample keys are fine to fail later).

- [ ] **Step 3: Add the popup text** — in `web/engine/mastery.js`, after `function tally(c) { ... }` add:

```js
  function questionsEn(n) { return n > 1 ? 'all ' + n + ' questions' : 'every question'; }
  function lessonsEn(n) { return n + (n === 1 ? ' lesson' : ' lessons'); }
  var MEDAL_LINE_EN = [
    '',
    function (n) { return 'You got ' + questionsEn(n) + ' right.'; },
    function (n) { return 'You got ' + questionsEn(n) + ' right on 2 different days.'; },
    function (n) { return 'You got ' + questionsEn(n) + ' right on 3 different days.'; }
  ];
  var MEDAL_NEXT_EN = ['', '🥈 next: get them right again in 3 days', '🥇 next: once more in about 7 days', 'It comes back in 2 weeks to stay strong'];
  var MEDAL_NEXT_FIL = ['', '🥈 Susunod: sagutin ulit sa 3 araw', '🥇 Susunod: isa pa pagkalipas ng mga 7 araw', 'Babalik ito sa 2 linggo'];
  function subjectNextEn(l, n) { return l < 3 ? 'Next: all-' + NAMES.en[l + 1] + ', ' + lessonsEn(n) + ' to go' : 'Every lesson is Gold. Amazing!'; }
  function fixedTitleEn(n) { return 'You fixed ' + n + (n === 1 ? ' mistake!' : ' mistakes!'); }
  function fixedLineEn(n) { return n === 1 ? 'A question you missed before is right now.' : n + ' questions you missed before are right now.'; }
  function fixedNextEn(n) { return (n === 1 ? 'It comes' : 'They come') + ' back in 3 days to check'; }
```

In `TEXT.grade5`, after `openOnce: '...'` add (keep a comma after `openOnce`):

```js
      medalTitle: function (m) { return NAMES.en[m.level] + ': ' + m.title + '!'; },
      medalLine: function (l, n) { return MEDAL_LINE_EN[l](n); },
      medalNext: function (l) { return MEDAL_NEXT_EN[l]; },
      subjectTitle: function (l, app) { return 'All of ' + app + ' is ' + NAMES.en[l] + '!'; },
      subjectLine: function (l) { return 'Every lesson has ' + MEDALS[l] + ' or better.'; },
      subjectNext: subjectNextEn,
      fixedTitle: fixedTitleEn,
      fixedLine: fixedLineEn,
      fixedNext: fixedNextEn
```

In `TEXT.grade2`, after its `openOnce: '...'` add:

```js
      medalTitle: function (m) { return NAMES.fil[m.level] + ' · ' + NAMES.en[m.level] + ': ' + m.title + '!'; },
      medalLine: function (l, n) {
        var fil = l === 1 ? (n > 1 ? 'Tama lahat ng ' + n + ' tanong' : 'Tama ang bawat tanong') : 'Tama lahat sa ' + l + ' magkaibang araw';
        return fil + ' · ' + MEDAL_LINE_EN[l](n);
      },
      medalNext: function (l) { return MEDAL_NEXT_FIL[l] + ' · ' + MEDAL_NEXT_EN[l]; },
      subjectTitle: function (l, app) { return NAMES.fil[l] + ' na ang lahat ng ' + app + '! · All of ' + app + ' is ' + NAMES.en[l] + '!'; },
      subjectLine: function (l) { return 'May ' + MEDALS[l] + ' o higit pa ang bawat aralin · Every lesson has ' + MEDALS[l] + ' or better.'; },
      subjectNext: function (l, n) {
        return (l < 3 ? 'Susunod: lahat ' + NAMES.fil[l + 1] + ', ' + n + ' aralin pa' : 'Ginto na lahat. Galing!') + ' · ' + subjectNextEn(l, n);
      },
      fixedTitle: function (n) { return 'Inayos mo ang ' + n + ' mali · ' + fixedTitleEn(n); },
      fixedLine: function (n) { return n + ' tanong na mali dati, tama na ngayon · ' + fixedLineEn(n); },
      fixedNext: function (n) { return 'Babalik sa 3 araw para masuri · ' + fixedNextEn(n); }
```

(`TEXT` is declared before `MEDALS` is used at call time only, so the `MEDALS` reference inside these functions is fine.)

- [ ] **Step 4: Report milestones from `update`** — after `function polishList(entry) { ... }` add:

```js
  // A game's level is its weakest shown lesson's best medal.
  function subjectLevel(entry) {
    var list = lessonsOf(entry);
    return list.length ? Math.min.apply(null, list.map(function (l) { return level(l.best); })) : 0;
  }
```

In `update`, change

```js
            result.newly.push({ id: l.id, title: l.title, level: best, points: pts });
```

to

```js
            result.newly.push({ id: l.id, title: l.title, level: best, points: pts, count: l.keys.length });
```

then replace

```js
        var prev = state.apps[app];
        if (!isObj(prev) || JSON.stringify([prev.order, prev.lessons]) !== JSON.stringify([entry.order, entry.lessons])) {
          state.apps[app] = entry;
          try {
            storage.setItem(KEY, JSON.stringify(state));
          } catch (e) {
            result.points = 0;
            result.newly = [];
          }
        }
```

with

```js
        var prev = state.apps[app], after = subjectLevel(entry);
        result.subjectUp = isObj(prev) && after > subjectLevel(prev) ? after : 0;
        result.toNext = after < 3 ? lessonsOf(entry).filter(function (l) { return level(l.best) <= after; }).length : 0;
        if (!isObj(prev) || JSON.stringify([prev.order, prev.lessons]) !== JSON.stringify([entry.order, entry.lessons])) {
          state.apps[app] = entry;
          try {
            storage.setItem(KEY, JSON.stringify(state));
          } catch (e) {
            result.points = 0;
            result.newly = [];
            result.subjectUp = 0;
          }
        }
```

- [ ] **Step 5: Build the events** — in the object returned by `create`, after `summary: function () { return read(storage); },` add:

```js
      // Popup events for Fx.celebrate, biggest first: a game-wide level, then medals, then fixed mistakes.
      events: function (result, fixed, appTitle) {
        var T = TEXT[grade], list = [];
        if (result.subjectUp) {
          list.push({ rank: 10 + result.subjectUp, big: true, icon: '🏆', title: T.subjectTitle(result.subjectUp, appTitle),
            line: T.subjectLine(result.subjectUp), next: T.subjectNext(result.subjectUp, result.toNext) });
        }
        (result.newly || []).forEach(function (m) {
          list.push({ rank: 1 + m.level, big: m.level >= 2, icon: MEDALS[m.level], title: T.medalTitle(m),
            line: T.medalLine(m.level, m.count || 1), next: T.medalNext(m.level) });
        });
        if (fixed > 0) list.push({ rank: 1, big: false, icon: '🔧', title: T.fixedTitle(fixed), line: T.fixedLine(fixed), next: T.fixedNext(fixed) });
        list.sort(function (a, b) { return b.rank - a.rank; });
        return list.map(function (e) { return { big: e.big, icon: e.icon, title: e.title, line: e.line, next: e.next }; });
      },
```

(`Array.prototype.sort` is stable in every browser the games run on, so equal ranks keep lesson order.)

- [ ] **Step 6: Run the tests**

Run: `node --test tests/mastery.test.js tests/english-everywhere.test.js tests/browser-globals.test.js`
Expected: PASS.

- [ ] **Step 7: Stage**

```bash
git add web/engine/mastery.js tests/mastery.test.js tests/english-everywhere.test.js
```

---

### Task 3: fx.js draws the popup

**Files:**
- Modify: `web/engine/fx.js`
- Test: `tests/fx.test.js`

- [ ] **Step 1: Write the failing test** — in `tests/fx.test.js`, change

```js
const { tierFor, SUBTITLE } = require(engineFile('fx.js'));
```

to

```js
const { tierFor, SUBTITLE, POP_MS, POP_CLOSE } = require(engineFile('fx.js'));
```

and add after the subtitle test:

```js
test('a celebration closes by itself: small after 4 s, big after 6 s; its button stays English', () => {
  assert.deepEqual(POP_MS, { small: 4000, big: 6000 });
  assert.equal(POP_CLOSE, 'Nice!');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/fx.test.js`
Expected: FAIL (`POP_MS` is undefined).

- [ ] **Step 3: Constants** — in `web/engine/fx.js`, after `var MUTE_KEY = 'study_fx_muted_v1';` add:

```js
  var POP_MS = { small: 4000, big: 6000 };
  var POP_CLOSE = 'Nice!';
```

- [ ] **Step 4: State** — in `create`, after `var hideTimer = null;` add:

```js
    var calloutUntil = 0, queued = null, popTimer = null, closeTimer = null, pop = null, returnFocus = null;
```

- [ ] **Step 5: CSS** — in `addStyle`, replace

```js
        '@media print{#fx-mute,#fx-layer{display:none}}';
```

with

```js
        '#fx-pop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55);overflow:hidden;}' +
        '#fx-pop .fx-pop-card{position:relative;max-width:340px;width:100%;padding:22px 20px 18px;border-radius:22px;background:#fff;color:#1f2937;' +
        'text-align:center;font-family:"Segoe UI",system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);}' +
        '#fx-pop .fx-pop-icon{font-size:68px;line-height:1.1;}' +
        '#fx-pop .fx-pop-title{margin:6px 0 4px;font-size:1.35rem;font-weight:900;}' +
        '#fx-pop .fx-pop-line{font-size:1rem;font-weight:600;}' +
        '#fx-pop .fx-pop-next{margin-top:10px;padding:8px 10px;border-radius:12px;background:#EEF4FF;color:#23395B;font-size:.92rem;font-weight:700;}' +
        '#fx-pop .fx-pop-more{margin:10px 0 0;padding:0;list-style:none;font-size:.9rem;font-weight:700;}' +
        '#fx-pop .fx-pop-ok{margin-top:14px;padding:10px 26px;border:0;border-radius:999px;background:#2E9E5B;color:#fff;font:inherit;font-size:1rem;font-weight:800;cursor:pointer;}' +
        '#fx-pop .fx-pop-ok:focus-visible{outline:3px solid #23395B;outline-offset:2px;}' +
        '#fx-pop .fx-bit{position:absolute;width:10px;height:14px;border-radius:2px;animation:fx-fall var(--d) ease-in forwards;}' +
        '#fx-pop .fx-pop-card{animation:fx-drop .5s cubic-bezier(.2,1.4,.4,1);}' +
        '#fx-pop.fx-pop-big .fx-pop-icon{animation:fx-flip .9s ease-out;}' +
        '#fx-pop.fx-pop-calm .fx-pop-card,#fx-pop.fx-pop-calm .fx-pop-icon{animation:fx-in .3s ease-out;}' +
        '@keyframes fx-drop{0%{transform:translateY(-60px) scale(.8);opacity:0}100%{transform:none;opacity:1}}' +
        '@keyframes fx-flip{0%{transform:rotateY(0) scale(.4)}60%{transform:rotateY(540deg) scale(1.15)}100%{transform:rotateY(720deg) scale(1)}}' +
        '@keyframes fx-in{0%{opacity:0}100%{opacity:1}}' +
        '@media (prefers-reduced-motion:reduce){#fx-pop .fx-pop-card,#fx-pop .fx-pop-icon{animation:fx-in .3s ease-out}}' +
        '@media print{#fx-mute,#fx-layer,#fx-pop{display:none}}';
```

- [ ] **Step 6: Remember when a call-out ends** — in `show`, replace

```js
      hideTimer = setTimeout(function () { box.innerHTML = ''; }, 1700);
```

with

```js
      hideTimer = setTimeout(function () { box.innerHTML = ''; }, 1700);
      calloutUntil = Date.now() + 1700;
```

- [ ] **Step 7: The popup** — after the `finish` function add:

```js
    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function fanfare(big) {
      if (big) {
        [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.16); });
        tone(1319, 0.5, 0.6, 'sine', 0.12);
      } else {
        tone(988, 0, 0.15, 'sine', 0.14);
        tone(1319, 0.1, 0.3, 'sine', 0.14);
      }
    }

    function onKey(ev) { if (ev.key === 'Escape') closePop(); }

    function closePop() {
      clearTimeout(closeTimer);
      if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
      if (pop) doc.removeEventListener('keydown', onKey);
      pop = null;
      if (returnFocus && returnFocus.focus) { try { returnFocus.focus(); } catch (e) {} }
      returnFocus = null;
    }

    // events: [{ big, icon, title, line, next }], biggest first. The first is the headline; up to 3 more are listed.
    function openPop() {
      clearTimeout(popTimer);
      var events = queued;
      queued = null;
      if (!events || !events.length || !doc.body) return;
      closePop();
      var head = events[0], calm = reducedMotion();
      var big = events.some(function (e) { return e.big; });
      returnFocus = doc.activeElement;
      pop = el('div', big ? 'fx-pop-big' : 'fx-pop-small');
      if (calm) pop.className += ' fx-pop-calm';
      pop.id = 'fx-pop';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-modal', 'true');
      pop.setAttribute('aria-labelledby', 'fx-pop-title');
      var card = el('div', 'fx-pop-card');
      card.appendChild(el('div', 'fx-pop-icon', head.icon));
      var title = el('div', 'fx-pop-title', head.title);
      title.id = 'fx-pop-title';
      card.appendChild(title);
      if (head.line) card.appendChild(el('div', 'fx-pop-line', head.line));
      if (head.next) card.appendChild(el('div', 'fx-pop-next', head.next));
      if (events.length > 1) {
        var more = el('ul', 'fx-pop-more');
        events.slice(1, 4).forEach(function (e) { more.appendChild(el('li', '', e.icon + ' ' + e.title)); });
        card.appendChild(more);
      }
      var ok = el('button', 'fx-pop-ok', POP_CLOSE);
      ok.type = 'button';
      card.appendChild(ok);
      pop.appendChild(card);
      if (big && !calm) confetti(pop, ['#eab308', '#fde047', '#22d3ee', '#a855f7', '#ffffff'], 40);
      pop.addEventListener('click', closePop);
      doc.addEventListener('keydown', onKey);
      doc.body.appendChild(pop);
      try { ok.focus(); } catch (e) {}
      fanfare(big);
      closeTimer = setTimeout(closePop, big ? POP_MS.big : POP_MS.small);
    }

    // Waits for a call-out like PERFECT! to finish, so the two never overlap.
    function celebrate(events) {
      if (!events || !events.length) return;
      queued = events;
      clearTimeout(popTimer);
      popTimer = setTimeout(openPop, Math.max(0, calloutUntil - Date.now()));
    }
```

- [ ] **Step 8: Export** — replace

```js
    return { correct: correct, wrong: wrong, finish: finish, purchase: purchase, muted: muted };
```

with

```js
    return { correct: correct, wrong: wrong, finish: finish, purchase: purchase, muted: muted,
      celebrate: celebrate, celebrateNow: openPop, queued: function () { return queued; } };
```

and replace

```js
  var exported = { tierFor: tierFor, TIERS: TIERS, SUBTITLE: SUBTITLE, MUTE_KEY: MUTE_KEY };
```

with

```js
  var exported = { tierFor: tierFor, TIERS: TIERS, SUBTITLE: SUBTITLE, MUTE_KEY: MUTE_KEY, POP_MS: POP_MS, POP_CLOSE: POP_CLOSE };
```

- [ ] **Step 9: Run the tests**

Run: `node --test tests/fx.test.js`
Expected: PASS.

- [ ] **Step 10: Stage**

```bash
git add web/engine/fx.js tests/fx.test.js
```

---

### Task 4: All 15 games celebrate

Every game already has `showMedals(el)`, called after a round (`el` = `#points-earned`) and on open (`el` = `#points-total-badge`). Math Mastery never calls `Recall.ask`, so `Recall.fixed()` is always 0 there.

**Files:**
- Modify: all 15 `web/subjects/grade-*/*/index.html`
- Test: `tests/mastery-wiring.test.js`

- [ ] **Step 1: Write the failing test** — in `tests/mastery-wiring.test.js`, inside the per-game test, after the `'header chip'` assertion add:

```js
    assert.equal(count(html, "if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE));"), 1, 'celebrates milestones');
```

Run: `node --test tests/mastery-wiring.test.js`
Expected: FAIL for all 15 games.

- [ ] **Step 2: Grade 5 family C (7 games) + Math Mastery + Kuwentista + Block Bot** (`grade-5/{araling-panlipunan,filipino,english,gmrc,pe-health,tle,science,math}`, `grade-2/{filipino,math}`) — replace

```js
function showMedals(el){
  const m = updateMedals();
  if (m) Mastery.showNew(el, m.newly);
}
```

with

```js
function showMedals(el){
  const m = updateMedals();
  if (!m) return;
  Mastery.showNew(el, m.newly);
  if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE));
}
```

- [ ] **Step 3: Grade 2 family B (5 games)** (`grade-2/{computer,english,gmrc,makabansa,science}`) — replace

```js
  function showMedals(el){
    var m = updateMedals();
    if (m) Mastery.showNew(el, m.newly);
  }
```

with

```js
  function showMedals(el){
    var m = updateMedals();
    if (!m) return;
    Mastery.showNew(el, m.newly);
    if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE));
  }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/mastery-wiring.test.js tests/fx.test.js`
Expected: PASS for all 15 games.

- [ ] **Step 5: Stage**

```bash
git add web/subjects tests/mastery-wiring.test.js
```

---

### Task 5: E2E — the popup in every game, fixed mistakes, reduced motion

The e2e drivers are synchronous, so they read `Fx.queued()` and open the popup at once with `Fx.celebrateNow()` instead of waiting for the timer.

**Files:** `tests/e2e/driver-common.page.js`, `tests/e2e/apps-e2e.js`

- [ ] **Step 1: Medal popup** — in `tests/e2e/driver-common.page.js`, function `__e2eMedal`, right after

```js
  r.second = round();
```

add

```js
  r.lessonTitle = lesson.title;
  r.queued = (Fx.queued() || []).map(function (e) { return { big: e.big, icon: e.icon, title: e.title }; });
  Fx.celebrateNow();
  var pop = document.getElementById('fx-pop');
  r.pop = pop ? { big: pop.className.indexOf('fx-pop-big') >= 0, title: pop.querySelector('.fx-pop-title').textContent,
    bits: pop.querySelectorAll('.fx-bit').length, role: pop.getAttribute('role'), button: pop.querySelector('.fx-pop-ok').textContent } : null;
  if (pop) pop.click();
  r.popClosed = !document.getElementById('fx-pop');
  var realMatch = window.matchMedia;
  window.matchMedia = function () { return { matches: true }; };
  Fx.celebrate([{ big: true, icon: '🥇', title: 'Calm', line: '', next: '' }]);
  Fx.celebrateNow();
  var calm = document.getElementById('fx-pop');
  r.calm = calm ? { bits: calm.querySelectorAll('.fx-bit').length, calmClass: calm.className.indexOf('fx-pop-calm') >= 0 } : null;
  if (calm) calm.click();
  window.matchMedia = realMatch;
```

- [ ] **Step 2: Fixed-mistakes popup** — in `__e2eReview`, right after

```js
  r.resultText = document.getElementById('points-earned').textContent;
```

add

```js
  r.fixedEvents = (Fx.queued() || []).filter(function (e) { return e.icon === '🔧'; }).length;
```

- [ ] **Step 3: Assertions** — in `tests/e2e/apps-e2e.js`, `checkMedal`, before its `console.log` add:

```js
  assert.equal(m.queued.length, 1, 'one popup event for the new Silver: ' + JSON.stringify(m.queued));
  assert.deepEqual([m.queued[0].big, m.queued[0].icon], [true, '🥈']);
  assert.ok(m.pop, 'the popup opens');
  assert.equal(m.pop.role, 'dialog');
  assert.equal(m.pop.big, true, 'Silver is a big celebration');
  assert.ok(m.pop.title.includes(m.lessonTitle), 'the headline names the lesson: ' + m.pop.title);
  assert.ok(m.pop.bits > 0, 'big celebrations have confetti');
  assert.equal(m.pop.button, 'Nice!');
  assert.equal(m.popClosed, true, 'a tap closes it');
  assert.deepEqual(m.calm, { bits: 0, calmClass: true }, 'reduced motion: no confetti, a plain fade');
```

and in `checkReview`, before its `console.log` add:

```js
  assert.equal(r.fixedEvents, 1, 'answering a missed question right on its due day celebrates a fixed mistake');
```

- [ ] **Step 4: Run the e2e suites**

Run: `node tests/e2e/apps-e2e.js 5`, `node tests/e2e/apps-e2e.js 2`, `node tests/e2e/lobby-e2e.js 5`, `node tests/e2e/lobby-e2e.js 2`, `node tests/e2e/backup-e2e.js 5`, `node tests/e2e/backup-e2e.js 2`, `node tests/e2e/file-check-e2e.js`, `node tests/e2e/migration-e2e.js`.
Expected: all pass, each game printing its `medal:` and `review:` lines.

If a failure looks like a product bug rather than a test bug, find the root cause and fix the product code; do not weaken assertions.

- [ ] **Step 5: Stage**

```bash
git add tests/e2e/driver-common.page.js tests/e2e/apps-e2e.js
```

---

### Task 6: README, spec status, final check

- [ ] **Step 1: README** — after the `**Medals**` feature line add:

```markdown
- **Celebrations:** a short popup cheers a new medal, a whole game reaching Bronze, Silver or Gold, and fixed mistakes, with what she did and one next step. It waits for PERFECT!, closes with a tap or by itself, follows the mute key and the tablet's reduce-motion setting.
```

- [ ] **Step 2: Spec status** — in `docs/superpowers/specs/2026-10-02-celebrations-design.md` change `Status: approved 2026-10-02.` to `Status: built 2026-10-02.`

- [ ] **Step 3: Full check**

Run: `node tools/update-precache.js` (no new files, so `web/sw.js` should not change), then `node --test`.
Expected: all tests pass.

- [ ] **Step 4: Stage**

```bash
git add README.md docs/superpowers/specs/2026-10-02-celebrations-design.md docs/superpowers/plans/2026-10-02-celebrations.md
```

---

## Self-review notes

- Spec coverage: fixed count (Task 1); medal/subject/fixed events, merge order, 3-extra cap (Tasks 2, 3); popup look, timing after call-outs, tap/Esc/button/auto close, mute (via `tone`), reduced motion (Task 3); results and open-time calls in 15 games (Task 4); e2e (Task 5).
- Names: `Recall.fixed()`, `Mastery.events(result, fixed, appTitle)`, `result.subjectUp`, `result.toNext`, `newly[].count`, `Fx.celebrate`, `Fx.celebrateNow`, `Fx.queued`, `POP_MS`, `POP_CLOSE`, ids `#fx-pop`, `#fx-pop-title`, classes `fx-pop-big|small|calm`, `.fx-pop-ok`, `.fx-bit`.
