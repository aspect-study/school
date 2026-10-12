# Account hardening for families beyond our own

Status: design approved 2026-10-12. Spec for the first three steps of the multi-family readiness review.

## Why

Cloud sync works for one family on trust. Before other families use the app, three things must change: the database
rules must enforce what the client already does, sign-up must resist abuse, and registration must collect consent and
a real parent PIN. Out of scope: the owner custom claim, server-side backups, error reporting, learner-ID UUIDs.

## Decisions

| Question | Decision |
|---|---|
| Parent PIN for new families | Required at registration; no default for signed-in accounts |
| Privacy scope at launch | Philippines only (Data Privacy Act, RA 10173) |
| Email verification | Send it, never block play or sync |
| Existing accounts | Keep password and PIN; one-time consent screen at next sign-in |
| Rules tests | Firebase emulator tests, dev-only dependency, `npm run test:rules` |

## 1. Rules

`firebase/firestore.rules` stops using `families/{uid}/{document=**}`. A family (`request.auth.uid == uid`) may read,
write and delete only these paths, each with a shape check:

| Path | Allowed fields |
|---|---|
| `families/{uid}` | `email`, `createdAt` (number), `lastSeenAt`, `updatedAt` (timestamps), `consent` ({ `at` number, `version` number }) |
| `families/{uid}/learners/{id}` | `json` (string, size cap), `updatedAt == request.time` |
| `.../learners/{id}/state/{key}` | `json` (string, size cap), `updatedAt == request.time` |
| `.../learners/{id}/counters/{key}` | `total` (number), `updatedAt == request.time` |
| `.../learners/{id}/history/{key}` | `json` (string, size cap) or `deleted == true`, plus `updatedAt == request.time` |
| `families/{uid}/settings/pin` | `pin` (string, 4 digits), `at` (number), `updatedAt == request.time` |

- Every other path is denied.
- `hasOnly` is used on the key set so extra fields are rejected.
- Size caps come from the largest real documents plus headroom; the plan measures them first.
- The owner keeps read-only access to everything under `families`, by the same UID and email as today.

### Tests

- New dev dependency `@firebase/rules-unit-testing` (and `firebase-tools` for the emulator); Java is required.
- `tests/rules/*.rules.test.js` run only through `npm run test:rules`; `node --test` does not load them.
- Cases: family A cannot read or write family B; a signed-out user is denied everywhere; unknown paths, extra fields,
  oversized `json`, wrong types, a client-supplied `updatedAt` and a 3-digit PIN are denied; each valid write the app
  makes (profile, state, counters, history including tombstones, PIN, family doc with consent) is allowed; the owner
  reads every family and cannot write.
- The existing regex tests in `tests/admin-rules.test.js` keep passing.

## 2. Abuse protection

- **Email verification.** `FirebaseRemote.sendVerification()` runs after `createAccount`. The Account view shows
  "Email verified" or "Not verified yet" with a Send again button. Nothing is blocked.
- **App Check.** `firebase-remote.js` `open()` initialises App Check with the reCAPTCHA v3 provider when
  `FIREBASE_CONFIG.appCheckSiteKey` is set. The key is public and lives in `firebase-config.js`.
  Localhost and e2e runs use an App Check debug token. Rollout: ship the client, watch the App Check metrics in
  monitor mode until every tablet has loaded the new code (the service worker is network-first), then switch
  Firestore and Authentication to Enforce in the console.
- **Console settings** (documented in the README, no code): email-enumeration protection on, password policy of at
  least 8 characters.
- **Client password rule.** `checkPassword` in `account.js` requires 8 characters. Existing passwords keep working
  until changed.

## 3. Register, consent, PIN, deletion

### Register view

Fields: email, password, repeat password, 4-digit PIN, repeat PIN, and a consent checkbox with a link to
`web/privacy.html`. The Create button stays disabled until the box is ticked. On success the PIN is saved with
`ParentPin.set` and synced, and `putFamily` writes `consent: { at: Date.now(), version: 1 }`.
`0108` stays only for "play without an account".

### Privacy notice

`web/privacy.html`, plain English, parent-facing. It states what is collected (email; each child's nickname, grade,
girl/boy, progress), why, that it is stored in Google Firebase, who can see it (the family, and the owner for support
and totals), no ads and no selling, how long it is kept (until the family deletes it), and how to delete it.
It lists a contact address for privacy and deletion requests, supplied by the owner before the pilot; a test fails
while the page still contains the `PRIVACY_CONTACT` marker. The file is added to the precache with
`node tools/update-precache.js`.

### Existing accounts

After a sign-in, if the family document has no `consent`, a one-time consent view shows before the children list.
Accept writes the consent record and continues. Decline signs the family out; local play without an account still
works. Passwords and PINs are untouched.

### Delete family account

A button in the Account view for signed-in families, with a confirm step that asks for the password and the typed
word DELETE. Order:

1. Reauthenticate with the password.
2. `deleteLearner` for every learner (existing code, empties sub-collections first).
3. Delete `settings/pin`, then the family document.
4. Delete the Firebase user (`deleteUser`).
5. Clear this device's learner data and sign-in flags, then go to the start page.

The Firebase user is deleted last, so a failure at any earlier step leaves the account usable and the action
retryable. Accepted gap: the family's other tablets keep their local copy until they are signed out or cleared.

## Testing summary

- Emulator rules tests (section 1).
- Unit tests in `tests/` for `checkPassword`, a new `checkRegister` (PIN and consent), and the consent record shape.
- `tests/e2e/account-e2e.js` extended: register with PIN and consent, the existing-account consent screen, and delete
  family account.
- `tests/pwa.test.js` stays green after the precache update.

## Accepted gaps

- Verification is advisory, so a mistyped email gives no recovery by email until the family fixes it.
- App Check is a deterrent, not proof of a genuine app.
- The owner identity is still hard-coded in the rules.
- The PIN is still checked in the browser and stored readable in the family's own data. It keeps children out of the
  Parent panel and the shop; it is not a security boundary.
