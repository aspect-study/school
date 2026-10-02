# Cloud sync (phase 5b) and parent view (phase 5c)

Date: 2026-10-02
Status: 5a done. 5b built 2026-10-02 (project `study-game-949fd`, SDK 12.4.0): sync-core.js + cloud.js, 385 unit tests + all e2e green, live sign-in check against the real project passed. Waiting on the parent's first real sign-in test. 5c not started.

## Goals (chosen by the user)

1. **Automatic backup.** No more manual exports. A new or wiped tablet signs in and gets everything back.
2. **Same child, many devices.** Points, coins, stars and history stay in sync.
3. **Parent view on a phone** (5c).

Provider: **Firebase** (Firestore + Authentication, free Spark plan). Sign-in: **email + password**, one family login, typed once per device in 🔒 Parent.

## Principles

- **The device stays the main copy.** Games never wait on the network and work offline exactly as today. Sync runs in the background when the device is online and signed in.
- **Nothing is lost when two devices play offline.** Every saved key has a merge rule; nothing uses "last save wins" where that would drop points.
- **No dependency on the SDK being reachable.** `engine/sync.js` loads the Firebase SDK with a dynamic `import()` from gstatic (pinned version) only when signed in and online. If it fails to load, the games carry on and sync retries later. The offline cache does not hold the SDK.
- **The sync logic is testable without Firebase.** `sync.js` works against a small `remote` interface (read docs, write docs, add to a counter, list changes since a time). Unit tests run it against an in-memory fake with two simulated devices. The Firebase adapter is thin and is checked by hand against the real project.

## Firestore layout

```
families/{uid}/learners/{learnerId}                 { name, emoji, grade, updatedAt }
families/{uid}/learners/{learnerId}/state/{key}      { value, updatedAt }              replaced or merged values
families/{uid}/learners/{learnerId}/counters/{key}   { total }                          added to with increment()
families/{uid}/learners/{learnerId}/history/{id}     { ...entry, updatedAt } | { deleted: true, updatedAt }
```

`uid` is the family login. All devices sign in as the family, so they share one tree.

## Merge rules (one per kind of key)

| Key | Rule |
|---|---|
| `<game>_points_v1` | **Counter.** The device sends what it added since its last sync (`increment(delta)`) and takes the new total. Both devices' earnings count. |
| `wallet_v1` | Split by field: `spent` and `bonus` are **counters**. `baselines` are set once per subject and never overwritten. `purchases` merge by time, and the existing 7-day prune runs after the merge. `oldPointsCounted` stays true once true. |
| `recall_v1` | Rest-days merge per question, keeping the latest date. |
| `<game>_progress_vN` + `_day` | Stars: the same day keeps the best per lesson; a newer day replaces an older one (stars reset daily). |
| `history_v1` | One doc per entry, merged by entry ID. "Delete range" and "Delete everything" in Parent write `deleted` markers, so other devices drop those entries instead of bringing them back. |
| `profile_v1` | Name and emoji: the latest wins. Grade: the higher wins (moving up never goes back). |
| `coin_guide_seen_v1` | Stays true once true. |
| `last_backup_v1`, `history_error_v1`, `history_corrupt_v1_*`, `sync_*` | **Device only, never synced.** |

Counter deltas use `sync_state_v1` in the learner's space (excluded from the outbox): the last total seen from the cloud for each counter. delta = local − last seen.

## When it syncs

- On page load, on every outbox change (debounced about 3 s), when the tab becomes visible again, and when the device comes back online.
- Each round: **pull** what changed in the cloud since the last pull and merge it in (quiet writes that don't go into the outbox). Then **push** the outbox. Then `done(sent)`.
- 🔒 Parent shows the status: "☁️ Synced 2 min ago", "☁️ Waiting for internet" or "☁️ Not signed in".

## Signing in, and which cloud learner a device is

- 🔒 Parent → **Cloud backup**: email, password, Sign in / Sign out. Firebase keeps the device signed in.
- **First sign-in on a device that has her data** (the normal case: each child's own tablet), with no cloud learner of that grade yet: her learner is uploaded as is, with the same ID.
- **A device with no data of its own** (new or wiped tablet, or a second device): Parent shows the family's learners ("Ana 🌻 · Grade 5"), the parent taps one, and the device adopts that learner's ID and downloads everything.
- **A device with data whose grade matches an existing cloud learner:** Parent asks "Is this Ana?". The parent chooses **Use the cloud's** (replace this device's data) or **Keep this tablet's** (upload as a separate learner). Data is never added together here, which avoids counting the same migrated points twice.

## Security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

The web config (apiKey and so on) is public by design, so it lives in `web/engine/firebase-config.js`. Access is controlled by these rules. A unit test checks that the rules file in the repo keeps this shape.

## Privacy

Children's names, quiz history and coins are stored in the parent's Firebase project, readable only with the family login. No analytics, and no other Firebase products. Sign-out on a device stops syncing; it does not delete the device's copy.

## What the parent sets up (one time)

1. <https://console.firebase.google.com> → Add project (Analytics off).
2. Build → **Authentication** → Get started → **Email/Password** → Enable. Then Users → Add user: the family email + password.
3. Build → **Firestore Database** → Create database (production mode, nearest region, e.g. `asia-southeast1`). Then Rules → paste the rules above → Publish.
4. Project settings → Your apps → **Web** (`</>`) → register "Study Games" (no Hosting). Copy the `firebaseConfig` object and send it over.
5. Authentication → Settings → **Authorized domains** → add `aspect-study.github.io`.

## Tests (5b)

- Unit tests with the fake remote, two devices:
  - offline points on both devices add up;
  - spending on both devices adds up;
  - history from both devices merges, and deletes spread;
  - stars respect the day rule;
  - rest-days keep the latest date;
  - name changes spread;
  - device-only keys never leave;
  - a failed push keeps the outbox;
  - the first-sign-in choices behave as described.
- The e2e suites run with sync off (no config), proving the offline behavior is unchanged.

## As built (5b)

- `web/engine/sync-core.js`: merge rules (`MERGE`), `kindOf`, `plan()` (first sign-in) and `create(space, remote, id).sync()`. A history entry changed on this device and not sent yet wins over the cloud's copy in the same round.
- `web/engine/cloud.js`: the Firestore remote (transactions for merges and counters, batched history writes, `>=` pulls on `updatedAt` with idempotent merges), the Parent "Cloud backup" panel, and timing. It loads the SDK only on devices that have signed in (`sync_signed_in_v1`), and does nothing on `file://`.
- Profiles carry `at` (time of the last change) so the name merge can pick the latest.
- `firebase/firestore.rules` is test-checked. `tests/sync.test.js` runs two simulated devices against an in-memory cloud.

## Phase 5c: parent view

Designed in `2026-10-02-parent-view-design.md`: a phone page that acts as one more synced device, with viewing, real test scores and shop approvals.
