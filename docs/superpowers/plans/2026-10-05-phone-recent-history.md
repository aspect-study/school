# Phone: Recent History Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The parent phone page stops downloading the child's whole study history on every open. Each open fetches the last **60 days** of history; points, coins, medals, review boxes and the other small state stay fetched in full. When the parent picks a range that reaches further back (All, or a Custom From older than the window), a **Load older history** button fetches the rest once.

**Decisions (user, 2026-10-05):** recent-only + Load older (nothing kept on the phone, as before); 60-day window.

**Why:** tablets remember `lastPull` and fetch only changes; the phone uses an in-memory space, so `lastPull` is 0 on every open and every history doc (one per quiz, lesson, app open) is read again. Reads and load time grow with her history.

**House rules:** never `git commit` (stage only); comments sparingly; engine files ES5 and ASCII-only where they already are; `node --test` from the repo root.

## Design

- `firebase-remote.js`:
  - `pull(id, ms, historyMs)`: the history query uses `Math.max(ms, historyMs || 0)`; state, counters and the profile still use `ms`.
  - New `pullOlder(id, beforeMs)`: history docs with `updatedAt < beforeMs`, returned as `{ history: [{ id, entry }] }` (same shape and the same `deleted` → `entry: null` rule as `pull`).
- `sync-core.js` `create(space, remote, id, opts)`:
  - `opts.historyFrom` (ms, optional). While set, `pull(since)` calls `remote.pull(id, since, historyFrom)`.
  - The history-merge block inside `pull` moves into a function `applyHistory(list)` so `pull` and `loadOlder` share it.
  - New `loadOlder()`: if `historyFrom` is not set, resolves `0`. Otherwise calls `remote.pullOlder(id, historyFrom)`, applies the docs with `applyHistory`, saves state, clears `historyFrom`, and resolves the number of docs.
  - New `historyFrom()`: the current window start in ms, or `0` once everything is loaded.
  - Pushing is unchanged. `pushHistory` only sends entries whose stamp differs from `st.known`, and only deletes ids in `st.known` that are gone, so entries outside the window are never re-sent or deleted.
  - Tablets pass no `opts`, so nothing changes for them.
- `phone.js`: `Core.create(space, remote, l.id, { historyFrom: Date.now() - 60 * 86400000 })`, and passes the panel `older: { from: function () { return c.core.historyFrom(); }, load: function () { return c.core.loadOlder(); } }`.
- `parent-panel.js`:
  - `o.older` is optional (lobbies don't pass it).
  - In `renderHistory`, when `o.older` is set, `o.older.from()` is non-zero, and the range reaches before the window, show a note under the range buttons: "Showing history from the last 60 days." plus a **Load older history** button.
    - The range reaches back when it is `all`, or `custom` with an empty From or a From before the window's date key.
    - The note is a `p.p-note` with id `older-history`, created once and inserted after `#range-msg`; hidden otherwise.
  - Click: the button is disabled and reads "Loading…"; then `o.older.load()`, then `renderHistory()`. On failure the note reads "Could not load older history. Check the connection and try again." and the button comes back.
  - The 60 shown in the note comes from the window (`Math.round((Date.now() - from) / 86400000)`), so the panel has no second copy of the number.

## Task A: remote + sync-core

**Files:** `web/engine/firebase-remote.js`, `web/engine/sync-core.js`, `tests/sync.test.js`

- [ ] Extend the fake cloud in `tests/sync.test.js`: `pull(id, since, historyMs)` filters history by `Math.max(since, historyMs || 0)`, and add `pullOlder(id, before)` returning history docs with `at < before`.
- [ ] Tests (failing first):
  1. A device created with `{ historyFrom }` gets all state and counters, but only history docs at or after `historyFrom`. Points and wallet totals match a full device.
  2. `loadOlder()` then brings in the older entries (the count it returns is the number of docs), and `historyFrom()` becomes 0. A second `loadOlder()` resolves 0 and makes no remote call.
  3. A windowed device that adds a test score and syncs sends only that new entry. Older cloud entries are neither re-sent nor marked deleted: their `at` is unchanged and they are not `null`.
  4. A device without `opts` behaves as today: the existing tests stay green.
- [ ] Implement as in Design. `firebase-remote.js` `pullOlder` uses `F.query(sub(id, 'history'), F.where('updatedAt', '<', F.Timestamp.fromMillis(beforeMs)))`.
- [ ] `node --test`, then stage the three files.

## Task B: phone + panel

**Files:** `web/parent/phone.js`, `web/engine/parent-panel.js`, `README.md`

- [ ] Wire `phone.js` as in Design: one `HISTORY_DAYS = 60` constant, the core created with `historyFrom`, and `older` passed to `P.mount`.
- [ ] Add the panel note and button as in Design. Element creation follows the `el()` helper style, and the note is re-evaluated on every `renderHistory`.
- [ ] README, Parent panel section: "The phone loads the last 60 days of history when it opens; pick All (or an older Custom range) and tap **Load older history** for the rest."
- [ ] Check without the cloud: run the phone page's `ParentPanel.mount` with a fake `older` in a quick headless-Chrome or vm harness (scratchpad only, not committed). Confirm:
  - the note shows for All and is hidden for Last 30 days;
  - Load runs `load` and hides the note;
  - a rejected `load` shows the error text.
- [ ] `node --test`, `node tests/e2e/lobby-e2e.js`, `node tests/e2e/lobby-e2e.js 5` (lobbies must be unaffected). Stage.

## Accepted gaps

- The real-test-score "already added on …" check only sees tests in the loaded history: a repeat of a test from more than 60 days ago is not caught until older history is loaded.
- An entry last written more than 60 days ago but edited again since (e.g. re-uploaded by a reset tablet) appears in the window: extra data, harmless.
