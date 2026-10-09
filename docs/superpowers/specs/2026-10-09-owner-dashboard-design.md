# Owner dashboard (activity) design

Date: 2026-10-09. Sub-project 1 of 3 (activity dashboard; error and health reporting and Vercel traffic come later,
each with its own spec). Builds on `2026-10-02-cloud-sync-design.md` and `2026-10-09-family-account-design.md`.

## Goal

The owner opens one private page on the Vercel site and sees how the app is used: families, children, who is active,
questions answered per day, subjects practiced, last sync per family. Free tiers only (Vercel Hobby, Firebase Spark).

## Access

- `firebase/firestore.rules` gains an owner clause: the owner's UID may **read** `families/{uid}` and everything under
  it, for every family. Families keep their own-data-only read/write rule. The owner gets no write access.
- The owner is exactly one account: `aspectjump.java@gmail.com`. The rules allow a read only when the signed-in user's
  UID equals the owner UID **and** their token email equals `aspectjump.java@gmail.com`. Both are constants in the rules
  file; neither is a secret. The owner copies the UID from the Firebase console (Authentication → Users).
- The password is never stored in the repo, the page or the rules. Firebase Auth checks it at sign-in; a wrong password
  never produces a signed-in user, so the rules never match. The owner account is created in the Firebase console
  (or by registering once on the app) with a strong password, and nobody else can register that email afterwards.
- The page signs in with Email/Password through `FirebaseRemote`. If the signed-in UID or email is not the owner's, it
  shows "Not allowed" and reads nothing. The page check is a courtesy; the rules are the real protection.

## Data

- **Family summary doc.** Today a family has only subcollections, so families cannot be listed. When an account is
  created and on each sync, the app writes `families/{uid}` = `{ email, createdAt, lastSeenAt, updatedAt }`
  (merge write, `createdAt` set once). This is written by `account.js` / `cloud.js` through a new remote method
  `putFamily(rec)`. Existing families get their doc on their next sync.
- **Dashboard reads** (new `adminRemote`, read-only):
  - `families` (all summary docs).
  - For each family, each learner's `history` docs with `updatedAt` in the last 30 days, plus each learner profile (for the grade). Counters are not read.
- **Cost guard.** Only the last 30 days of history are read. The result is cached in `localStorage` for 10 minutes
  (wrapped in try/catch); a Refresh button bypasses the cache.

## Numbers shown

`web/admin/admin-stats.js` is a pure function module (no Firebase, no DOM) that turns raw docs into:

- Totals: families, children (split Grade 2 / Grade 5 by the learner profile's grade).
- Active families and children: today and last 7 days (a history entry that day).
- Questions answered per day for 30 days (the bar chart).
- Questions per subject, last 30 days.
- Per family: email, children, last sync time, flagged when last sync is over 7 days ago.

## Page

- `web/admin/index.html`, `admin.js`, `admin.css`, `admin-stats.js`. ES5 in an IIFE, no build step, like `web/parent/`.
- Not linked from any lobby and not in the PWA precache, so kids' tablets never download it.
- Order: sign-in form → tiles (families, children, active 7d, questions today) → 30-day bar chart → subject breakdown →
  family table → reserved empty slot for the future errors panel (sub-project 2) and a link slot for Vercel Analytics
  (sub-project 3).
- Works at phone width. Light and dark follow the system setting.
- States: signing in, loading, empty (no families), error with Retry, "Not allowed".

## Out of scope

Error reporting hook, Vercel Analytics, per-family parent dashboard, any write to family data, notifications.

## Testing

- `tests/admin-stats.test.js`: totals, active windows, per-day buckets, per-subject counts, stale-sync flag, empty
  input, entries outside the 30-day window ignored.
- `tests/firebase-remote.test.js` gains `putFamily` and the admin reads.
- A wiring test: the admin page is not in PRECACHE and no lobby links to it.
- `firebase/firestore.rules` stays small; check it in the Firebase Rules Playground (owner reads another family: allowed;
  a normal family reads another family: denied; owner write: denied).
- Manual e2e: sign in as owner (dashboard shows), then as a normal family ("Not allowed").
- `node --test` and `node tools/update-precache.js` must stay green.

## Rules change (sketch)

```
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
```

`OWNER_UID` is replaced by the real UID at deploy time. Until it is, the owner clause matches nobody.

## Deploy

1. Paste the owner UID into `firebase/firestore.rules`.
2. Paste `firebase/firestore.rules` into Firebase console → Firestore → Rules and Publish (no `firebase.json` exists).
3. Push to Vercel as usual; open `/admin/`.
