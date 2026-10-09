# Practice These Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** In the Parent view's Focus tab, each subject with questions to fix gets a **📌 Practice these (N)** button. One tap makes those questions due today in her review boxes, so they lead her next review round on the tablet. It works from the tablet lobby and from the parent phone (the change syncs).

**Architecture:** No new screens for her. Review rounds already take due questions first (`Recall.pickDue`), the lobby already shows due review per game, and the guide already sends her to due review. `insights.js` gains two pure helpers: `practiceKeys(subject, items)` (which review keys to mark) and `markDue(items, keys, today, now)` (marks them). `parent-panel.js` shows the button or a done note and writes `review_v1`, then calls `o.onChange` (the phone syncs; the lobby refreshes its review chips).

**Builds on:** `docs/superpowers/specs/2026-10-05-parent-focus-tabs-design.md` (the Focus tab, `review_v1` shape, status rule).

**House rules:** never `git commit` (stage only); comments sparingly; `insights.js` ASCII-only; `node --test` from the repo root.

## Rules

- **Which keys** (`practiceKeys`): every question in the subject with status `missing` (it has a key and a box); plus, for games whose review boxes are per lesson (Grade 5 Math, keys `app|skill:<lessonId>`), each **weak** lesson whose skill key has a box. Keys without a valid box are skipped (nothing to schedule). No duplicates.
- **Marking** (`markDue`): a key already due (due on or before today) and not `started` today is left as it is. Otherwise its item becomes `{ box, due: today, t: now }`: `started` is dropped so it can come back today; `t` is now so the sync merge keeps this write. A question key goes to **box 1** (she missed it; this also keeps the status honest, since box 1 never reads as Fixed). A skill key keeps its box, so Math medals do not drop.
- **Button state:** the subject shows the button while at least one of its practice keys is not due now; otherwise it shows "📌 In her review now: N. She'll see them under Review in the lobby." Derived from the data each render, so it is right on every device.
- **After a tap:** save `review_v1`; on failure show "Could not save. Storage may be full." Re-render; call `o.onChange`. The lobby passes an `onChange` that refreshes its review chips and map markers (it dispatches the existing `cloud-synced` document event those already listen to).
- Grade 5 Math lessons: `lessonId` comes from the history entries (the same id its skill keys use).

## Task A: `insights.js` helpers

**Files:** `web/engine/insights.js`, `tests/insights.test.js`

- [ ] Lessons keep the first non-empty `lessonId` of their entries: `{ title, lessonId, answered, ... }` (`String(e.lessonId)`, `''` when absent).
- [ ] Add, export and unit-test:

```js
  function validItem(items, k) {
    var it = isObj(items) && Object.prototype.hasOwnProperty.call(items, k) ? items[k] : null;
    return isObj(it) && !it.gone && it.box >= 1 && it.box <= 5 && typeof it.due === 'string';
  }

  function dueNow(it, today) { return it.due <= today && it.started !== today; }

  // The review_v1 keys behind a subject's "Practice these": its questions still missing, and for games whose
  // review is per lesson (Grade 5 Math: app|skill:lessonId) its weak lessons. Only keys that already have a box.
  function practiceKeys(s, items) {
    var keys = [], seen = Object.create(null);
    function add(k) { if (k && !seen[k] && validItem(items, k)) { seen[k] = true; keys.push(k); } }
    s.questions.forEach(function (q) { if (q.status === 'missing') add(q.key); });
    s.lessons.forEach(function (l) { if (l.weak && l.lessonId) add(s.app + '|skill:' + l.lessonId); });
    return keys;
  }

  // How many of these keys are not due now (0 means the button has nothing left to do).
  function practicePending(keys, items, today) {
    return keys.filter(function (k) { return validItem(items, k) && !dueNow(items[k], today); }).length;
  }

  // Makes the keys due today so they lead her next review round. A question goes back to box 1; a lesson skill
  // keeps its box so its medal does not drop. Returns how many changed.
  function markDue(items, keys, today, now) {
    var n = 0;
    keys.forEach(function (k) {
      if (!validItem(items, k) || dueNow(items[k], today)) return;
      var it = items[k];
      items[k] = { box: k.indexOf('|skill:') >= 0 ? it.box : 1, due: it.due < today ? it.due : today, t: now };
      n++;
    });
    return n;
  }
```

Tests (in `tests/insights.test.js`):
1. `practiceKeys`: missing keyed questions included; fixed, no-key, and keys without a box excluded; a Grade-5-Math-style subject (`app: 'math-mastery'`) with a weak lesson `lessonId: '3'` and item `math-mastery|skill:3` includes that key; a non-weak lesson's skill key excluded; no duplicates.
2. `markDue`: an item due in 3 days with box 2 (question key) → `{ box: 1, due: today, t: now }`; an overdue item stays overdue (due unchanged) but gets `t` and loses `started`… only if it was started today (an overdue item not started today is left untouched and not counted); an item `started` today → rewritten without `started`; a skill key keeps its box; invalid/missing keys skipped; return value counts changes.
3. `practicePending`: counts keys not due now; 0 after `markDue`.
4. `build` lessons carry `lessonId` (first non-empty).

Stage: `git add web/engine/insights.js tests/insights.test.js`

## Task B: the button, the lobby refresh, e2e, README

**Files:** `web/engine/parent-panel.js`, `web/lobby/grade-5.html`, `web/lobby/grade-2.html`, `tests/e2e/lobby-driver.page.js`, `tests/e2e/lobby-e2e.js`, `README.md`

- [ ] `renderHistory` passes the `review_v1` items it already reads into `renderFocus(report, items)` → `focusSubject(s, open, items)`.
- [ ] In `focusSubject`, right after the summary: `var keys = IN.practiceKeys(s, items)`; if `keys.length`, add a `div.f-practice` holding either a button `📌 Practice these (N)` (class `p-btn f-practice-btn`) when `IN.practicePending(keys, items, today()) > 0`, or a `p.p-note` "📌 In her review now: N. She'll see them under Review in the lobby." (N = keys.length; "1 question" / "N questions" wording is fine either way: keep it short), plus a `p.p-note` message line for errors.
- [ ] Tap: read `review_v1` from `STORE` fresh (`{ v: 1, items }`; if missing or bad, start `{ v: 1, items: {} }`), `IN.markDue(d.items, keys, today(), Date.now())`, `STORE.setItem('review_v1', JSON.stringify(d))` in try/catch (on failure show "Could not save. Storage may be full." and stop), then `renderHistory()` and `if (o.onChange) o.onChange()`. Open state is kept by the existing open-state code.
- [ ] CSS: `.f-practice{margin:10px 0 2px;}`.
- [ ] Lobbies: change the `P.mount({ ... lobby: true })` call in both lobbies to also pass `onChange: function () { document.dispatchEvent(new Event('cloud-synced')); }`. Check first what listens to `cloud-synced` in the lobby (grep) and confirm nothing heavy or celebratory fires that would be wrong after a parent action (e.g. `showQuests` runs `Quests.check()` and may celebrate). If something would misfire, instead pass an `onChange` that calls only the review-chip refresh (expose a small `window.refreshReview` or equivalent from the lobby script that defines `showReview`) and the world map refresh if it has one; keep it minimal and the same in both lobbies.
- [ ] Test score: the lobby's test-score path already calls `o.onChange` after adding coins; check that the new lobby `onChange` is harmless there too.
- [ ] e2e: in the driver, in the block that seeds `review_v1` with `k-adj` (box 2, Fixed) and `k-pro` (box 1, due `2099-01-01`, Still missing): capture `r.practiceLabel` = the first Focus subject's `.f-practice-btn` text (expect `📌 Practice these (1)`), click it, then capture `r.practiceDue` = the saved `review_v1` item `k-pro` (expect `box: 1` and `due` = today's `YYYY-MM-DD`, no `started`), `r.practiceAfter` = the first subject's `.f-practice` text (expect it to start with `📌 In her review now: 1`), and `r.adjUntouched` = `k-adj` unchanged. Assert in `lobby-e2e.js`.
- [ ] README: in the Focus bullet, add: "**📌 Practice these** puts a subject's still-missing questions (and, for Grade 5 Math, its weak lessons) into her review for today; she sees them under Review in the lobby."
- [ ] Run `node --test`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/lobby-e2e.js 5`. Stage the files.
