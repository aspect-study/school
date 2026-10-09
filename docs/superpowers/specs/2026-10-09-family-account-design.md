# Family account: registration, change password, parent PIN, grade at registration

Date: 2026-10-09. Builds on `2026-10-02-cloud-sync-design.md` (Firebase sign-in, `families/{uid}/learners/{id}`) and
learner profiles (`web/engine/learner.js`); everything there still holds unless changed here.

## Why

Today the family's Firebase email + password is made by hand in the Firebase console, the parent PIN is fixed at
`0108` in `parent-panel.js`, and a new device only asks for a grade. The owner wants a family to create its account in
the app, add its children with their grades, and change the family password and the parent PIN.

## Decisions (owner, 2026-10-09)

- **Registration is for the family account only.** Children never get a login or password.
- **Changeable:** the family login password and the parent PIN. Not a child's password (there is none).
- **Grade is picked when a child is added** (at registration, or later with Add a child). Changing a child's grade
  later is out of scope.
- **Lives on a new start page** (`web/index.html`), with an Account view for changes once a device already has a child.
- **Play without an account stays.** Nothing is sent anywhere unless a parent signs in or registers.
- **Forgot password** sends Firebase's reset email.
- **PIN stored as plain digits**: a hash of 4 digits adds nothing, and `firebase/firestore.rules` already limit reads
  to the family login. The default stays `0108` until someone changes it, so the current family notices nothing.

Accepted consequence: with Create account in the app, anyone who finds the site can register on the `study-game`
Firebase project. The rules keep each account to its own `families/{uid}`, so no one can read another family's data;
the cost is Firestore quota. If that becomes a problem, Email/Password sign-up can be turned off again in the Firebase
console (Authentication → Settings → User actions) without code changes; Sign in keeps working.

Out of scope: child passwords, changing a child's grade, deleting the account, deleting a child, grades other than 2
and 5 (the list is one constant so it can grow).

## Design

### Start page (`web/index.html`)

A device whose `Learner.current()` exists still goes straight to her lobby, unless the URL has `?account=1`.
Otherwise the page shows one view at a time (English only; it is read by a parent):

1. **Welcome:** "Study Games", three buttons: **Sign in**, **Create family account**, **Play without an account**,
   and the existing link to the phone parent page.
2. **Sign in:** email, password, **Sign in**, **Forgot password?**, Back. On success, load the family's learners:
   none → Add children; otherwise → Who uses this tablet.
   - Forgot password: needs the email field filled; sends the reset email; shows "Check your email for a link to set
     a new password." Errors shown in words (no internet, unknown email, too many tries).
3. **Create family account:** email, password, password again, **Create account**, Back. Checks before sending:
   email looks like `x@y.z`, password at least 6 characters (Firebase's rule), both passwords match. Firebase errors
   in words: email already used ("This email already has an account. Sign in instead."), weak password, no internet.
   On success → Add children.
4. **Add children:** a form with name (1 to 30 characters, trimmed), emoji (a row of 8 to pick from, first one
   preselected) and grade (**Grade 5** / **Grade 2** buttons, one must be picked). **Add child** saves her and lists
   her above the form; **Done** (enabled once at least one child exists) → Who uses this tablet.
   Each child is a new learner id (same format as `learner.js`'s `newLearner`) written to the cloud as
   `profile_v1` = `{ name, emoji, grade, at }` through the remote's `merge`, so other devices see her at once.
5. **Who uses this tablet:** one big button per child: emoji, name, "Grade N". Tapping one calls `Learner.adopt(id,
   profile)`, sets the device's signed-in flag (`sync_signed_in_v1`, the key `cloud.js` reads) and goes to her lobby.
   Because the device's learner id now matches a cloud learner, `SyncCore.plan` returns `linked` and the lobby syncs
   with no second sign-in and no "which child" question.
6. **Play without an account:** today's Grade 5 / Grade 2 buttons, unchanged behaviour.

The Firebase SDK still loads only when Sign in, Create account or Forgot password is tapped (or the Account view
opens), through `firebase-remote.js`'s existing `load()`.

### Account view (`index.html?account=1`)

Opened from a new **👤 Account** button in the lobby Parent panel's ⚙️ Settings tab (already behind the PIN) and from
the phone parent page (after its PIN). If the device is not signed in, it shows Sign in first (and, if signed in from
here on a device that already has a child, returns to the Account view, not the child picker).

- **Signed in as** the email, and **Back** (to the lobby, or to the page in `?back=`).
- **Change password:** current password, new password, new password again. Same checks as registration; then
  `reauthenticateWithCredential` with the current password and `updatePassword`. Wrong current password: "The current
  password is wrong." Success: "Password changed. Use the new one on every device next time it asks." Other signed-in
  devices stay signed in (Firebase keeps their session).
- **Change parent PIN:** current PIN, new PIN, new PIN again (4 digits each, number keyboard). Wrong current PIN or a
  mismatch shows a message and changes nothing. Success saves it on the device and, when signed in, in the cloud.
  Works without an account too (device only, and the view says so).
- **Add a child:** the same form as step 4. The new child appears on other devices' pickers.
- **Sign out:** same as the Cloud backup section's Sign out.

The Cloud backup section in the Parent panel keeps its own sign-in form and adds a line: "No family account yet?
Create one" linking to `index.html?account=1`.

### `web/engine/firebase-remote.js` (additions)

- `createAccount(email, password)` → `createUserWithEmailAndPassword`.
- `resetPassword(email)` → `sendPasswordResetEmail`.
- `changePassword(current, next)` → `reauthenticateWithCredential(user, EmailAuthProvider.credential(email,
  current))`, then `updatePassword`.
- `accountError(e)`: words for `email-already-in-use`, `weak-password`, `invalid-email`, `requires-recent-login`,
  `invalid-credential`/`wrong-password` (as "The current password is wrong." in change-password), network,
  too-many-requests, `user-not-found`; anything else reads "Something went wrong (code). Try again."
- Remote gains `getPin()` (the record or null) / `putPin({ pin, at })` on `families/{uid}/settings/pin` = `{ pin, at, updatedAt }`. Already
  covered by the existing rules (`families/{uid}/{document=**}`).

### `web/engine/parent-pin.js` (new, loaded by the two lobbies and the parent page before `parent-panel.js`, and by the start page)

- Device-level key `parent_pin_v1` = `{ pin, at }` through `StudyStore.raw` (device storage, like `sync_signed_in_v1`);
  not per learner, so both children's lobbies use the same PIN.
- `ParentPin.get()` → the saved PIN, or `'0108'` when none or invalid.
- `ParentPin.check(entry)` → `entry === get()`.
- `ParentPin.set(pin)` → validates `/^\d{4}$/`, saves `{ pin, at: now }`, returns true/false.
- `ParentPin.merge(local, cloud)` (pure, exported for tests) → the one with the larger `at`; either may be null; a
  missing one never wins over a present one.
- `ParentPin.sync(remote)` → reads the cloud copy, merges, writes back whichever side is older. Never throws (a failed
  read keeps the device copy).

`parent-panel.js`'s `pinGate` compares with `ParentPin.check` instead of the `PIN` constant (falling back to `'0108'`
if `ParentPin` is missing, so a page that forgets the script still opens with the old PIN). The shop's own PIN keypad
in each lobby (`entered === PIN` in `web/lobby/grade-5.html` and `web/lobby/grade-2.html`) switches to
`ParentPanel.checkPin` (the same check as the panel, with the same fallback) too, and its `PIN` constant is removed. The lobbies' missing-file check stays unchanged (it must be identical on every page), which is why the shop goes through `ParentPanel`.

### Sync of the PIN

- `cloud.js`: after each good round, `ParentPin.sync(remote)` (failure ignored, like `peekFamily`).
- Phone parent page: after sign-in and before showing its PIN keypad, `ParentPin.sync(remote)`; if it fails, the device
  copy (or `0108`) is used.
- Start page: after sign-in or registration, `ParentPin.sync(remote)`, so a new tablet learns the family's PIN.
- Changing the PIN while signed in calls `putPin` at once; offline, the next sync carries it.

### Files

- `web/index.html`: the views above (markup + CSS), loads `account.js`.
- `web/engine/account.js` (new): the start page and Account view logic (views, validation, calls into
  `FirebaseRemote`, `Learner`, `ParentPin`). Pure helpers exported for tests: `validEmail`, `checkPassword(a, b)`
  (returns an error message or `''`), `checkChild({ name, emoji, grade })`, `GRADES = [5, 2]`, `EMOJIS`.
- `web/engine/parent-pin.js` (new), `web/engine/firebase-remote.js`, `web/engine/parent-panel.js` (PIN check, 👤
  Account button), `web/engine/cloud.js` (PIN sync, "Create one" link), `web/parent/phone.js` and
  `web/parent/index.html` (PIN sync, 👤 Account link), `web/lobby/grade-5.html` and `web/lobby/grade-2.html` (load
  `parent-pin.js`, shop keypad uses `ParentPanel.checkPin`).
- `node tools/update-precache.js` after adding the two files.
- `README.md` (start page, Account, PIN no longer fixed) and `docs/HANDOFF.md` (Built).

## Error handling

- Every Firebase call shows a message in words in the view's message line; buttons are disabled while a call runs and
  re-enabled after.
- Offline on the start page: Sign in / Create account / Forgot password say "No internet. Try again when online, or
  play without an account."
- Registration that succeeded but adding a child failed (offline mid-way): the account exists; the Add children view
  stays with the message, and signing in later lands on Add children because the family has no children.
- `Learner.adopt` and the signed-in flag are written only after the child is picked (in the Account view: right after sign-in), so a half-finished flow leaves the
  device as it was.

## Testing

- `tests/parent-pin.test.js`: `get` defaults to `0108`; `set` rejects non-4-digit; `merge` newest wins, nulls handled;
  `sync` writes back the older side and survives a failing remote.
- `tests/account.test.js`: `validEmail`, `checkPassword` (short, mismatch, ok), `checkChild` (empty name, no grade,
  name trimmed and capped at 30), `GRADES` matches the lobbies that exist.
- `tests/parent-pin-wiring.test.js`: every page that loads `parent-panel.js` loads `parent-pin.js` before it; no
  `'0108'` left in `parent-panel.js` (except the fallback) or in the two lobbies.
- `tests/e2e/account-e2e.js` (headless Chrome, fake `FirebaseRemote` injected before `account.js`):
  create account → add Grade 5 and Grade 2 children → pick Grade 2 child → lands on `lobby/grade-2.html` with that
  learner and the signed-in flag; sign in → pick child; sign in with no children → Add children; play without an
  account → Grade 5 lobby with nothing sent; forgot password message; change password (wrong current rejected, right
  one accepted); change PIN (mismatch rejected) → the lobby Parent panel rejects `0108` and accepts the new PIN (the shop keypad shares that check; the wiring test covers it).
- Existing suites still pass: `node --test`, `tests/e2e/migration-e2e.js`, and the lobby e2e scripts.
