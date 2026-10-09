# Parent view on the phone (phase 5c)

Date: 2026-10-02
Status: design approved by the user. Builds on phase 5b (`2026-10-02-cloud-sync-design.md`).

## Goals (chosen by the user)

1. **See each child's progress from the parent's phone:** coins, points per subject, history (same filters as the lobby), Needs practice, real test scores.
2. **Add a real test score from the phone**, with the same coin rules as the tablet.
3. **Approve shop purchases from the phone.** The tablet's PIN keeps working as it does today.

Decisions:
- The page asks for the **Parent PIN (0108) every time it opens**, because the phone stays signed in to the family login.
- **No push notifications.** The child tells the parent; while the page is open, waiting requests appear live with a soft sound.
- Backup import, export and delete stay on the tablets only.

## Approach: the phone is one more synced device

The phone page downloads the chosen child's data from the cloud into an **in-memory space** and runs the same `wallet.js`, `study-history.js` and `sync-core.js` as the tablets. A test score added on the phone is an ordinary `addBonus` + `testScore` on that space, and `sync()` sends it with the existing merge rules (the bonus is a counter, so it adds up with anything the tablet did meanwhile). Nothing on the phone is kept between visits, and every visit pulls everything (`lastPull` 0). The data is small enough.

Rejected: a separate Firestore reader and writer for the phone (a second copy of the coin and merge logic that could drift and double count), and phone "commands" that only a tablet carries out (nothing changes on the phone until the tablet is online).

## Files

| File | What it does |
|---|---|
| `web/parent/index.html` | The phone page. Sign in (once per phone), PIN (every open), child picker, then the child's view. Installable to the home screen (own manifest, uses the root `sw.js`). |
| `web/engine/parent-panel.js` | The Parent panel script that is today copied byte-for-byte into both lobbies (history summary, filters and list, Needs practice, real test score form, coins). `ParentPanel.mount(options)` takes the history, wallet, subject list and which features to show. The lobbies and the phone page all use it. |
| `web/engine/shop-requests.js` | Shop requests on one learner's space: `ask`, `cancel`, `answer` (phone), `settle` (tablet), `waiting`. |
| `web/engine/sync-core.js` | Gains the `requests` merge rule for `shop_requests_v1`. |
| `web/engine/firebase-remote.js` | Split out of `cloud.js`: loads the SDK, signs in, and gives the Firestore remote, which gains `watch(id, key, onChange)` (a live listener on one state doc). Used by `cloud.js` and the phone page. |
| `web/engine/cloud.js` | Uses `firebase-remote.js`. Gains `Cloud.signedIn()`, `Cloud.watch(key, onChange)` (used while a request is waiting) and a `cloud-synced` event after each good sync. |
| `web/engine/subjects.js` | Each grade's subjects (app, name, points key) for the phone page. |
| `web/engine/storage.js`, `wallet.js`, `study-history.js` | Their factories become reachable in the browser (for example `StudyStore.memory()`, `Wallet.create`, `StudyHistory.create`), so the phone can build them on the in-memory space. Today the browser globals are only ready-made instances. |

Subject names on the phone come from `subjects.js`, which matches the lobby cards ("Math", not the app name "Math Mastery", the same as the lobby history). A test keeps it equal to the cards.

## The phone page, step by step

1. **Not signed in:** family email + password (same form and error texts as the lobby's Cloud backup).
2. **PIN:** the same 4-dot keypad as the lobbies. Wrong PIN shakes and clears. The PIN is asked again whenever the page is opened or comes back after 5 minutes in the background.
3. **Child picker:** one button per cloud learner ("🌻 Ana · Grade 5"), from `remote.learners()`. With one child it opens straight away.
4. **Child view, top to bottom:**
   - **Waiting shop requests** (only when there are any): "🧸 Toy · 40 coins · asked 3:12 PM" with **Approve** and **No**. Live while open; a soft chime when a new one arrives.
   - Coins and points per subject.
   - History with the same filters, Needs practice, real test scores (from `parent-panel.js`).
   - Add a real test score (same rules, including "Already added on …, tap Add again").
   - "Synced just now" and a **Refresh** button.
5. **Offline or the cloud can't be reached:** "No internet. Try again when online." and no child data, so nothing out of date is shown.

## Shop requests

Stored in the learner's space as `shop_requests_v1`: `{ v: 1, list: { <id>: { item, coins, t, status, at } } }`. It is a normal synced key, so it travels through the outbox and `remote.merge`.

**Status order:** `waiting` → `approved` or `declined` → `done`, `cancelled`, `short` (not enough coins) or `expired`. In a merge, the record further along wins; at the same step, the later `at` wins. So a tablet's Cancel beats a phone's Approve that arrives after it, and two answers at once settle on the later one.

**On the tablet (kid's side):**
- The shop's PIN screen gets **"📱 Ask on parent's phone"**, shown only when cloud sync is signed in on this tablet. It calls `ask(item)`, syncs, and shows "Waiting for a grown-up… Ask your parent to open the parent page." with **Cancel**.
- While waiting, the tablet calls `Cloud.watch('shop_requests_v1', …)`. On a change it runs a sync round and then `settle()`.
- `settle()` handles every `approved` request: it re-checks `canBuy` (coins and once-a-day limit). If the check passes, it does what the PIN path does (`W.buy`, `SH.purchased`, `Fx.purchase()`, the done screen) and marks the request `done`. If the check fails, it marks it `short` and says "Not enough coins now". A `declined` request shows "Your parent said not this time." Each result is synced back.
- The PIN keeps working while a request waits. Typing it cancels the waiting request and buys at once.
- `settle()` also runs on every normal sync round, so an answer that arrives while the shop is closed is still handled the next time the lobby opens. Only the done screen needs the shop to be open.

**On the phone:** waiting requests come from the pulled `shop_requests_v1`, plus a live `Cloud.watch` while the page is open. Approve or No calls `answer(id, yes)` and syncs. The phone never buys: coins are only spent on the tablet, after its own check.

**Expiry and cleanup:** a request that is still `waiting` from an earlier local day counts as `expired`, so an old request can't be approved by mistake. Records older than 7 days are dropped, the same as purchases.

## Firestore

No new collections: `shop_requests_v1` is a doc in `families/{uid}/learners/{id}/state/`, and the security rules stay as they are. The live listener is `onSnapshot` on that one doc, opened only while a request waits (tablet) or while the phone page shows a child, which stays well inside the free Spark plan.

## Tests

- `sync.test.js`: the `requests` merge in every order (waiting/approved/declined/cancelled/done from two devices), repeat-safe and order-independent like the other rules.
- `shop-requests.test.js`: ask, answer, settle (enough coins → done + purchase; not enough → short; declined), PIN while waiting cancels, yesterday's waiting → expired, 7-day cleanup.
- Phone-as-device round trip with the fake cloud: a test score added on an in-memory "phone" space shows up as coins on the "tablet" after both sync; an approval on the phone becomes a purchase on the tablet.
- `pages.test.js`-style checks: both lobbies and `parent/index.html` load `parent-panel.js`, and the lobbies no longer contain the panel script inline; `subjects.js` matches the lobby cards; the new files are in `sw.js` PRECACHE.
- The existing e2e suites still pass with sync off (the tablet shop without sync shows no phone button).
- By hand with the parent (the family password is never asked for): sign in on the phone, see both children, add a test score, and approve a real request from a tablet.

## Not included

Push notifications, editing or deleting history from the phone, buying from the phone, and backup import or export on the phone.
