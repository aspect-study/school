# Boy players: a boy/girl choice per child, gender-aware family wording

Date: 2026-10-09. Status: approved design, plan next.

## Why

The family account lets any family add children, and some will be boys. Today the family wording assumes sisters: older
sibling is always **Ate**, the same-grade sibling is "Sister", cheers say "cheer her on", the world says "Visit Ate's
room", the Ask Family helper is "Ask Ate", and the start page asks for "Her name". A boy should see **Kuya**, "brother",
"his/him". Already done before this spec: the Play World button and the world HUD badge are no longer pink/🌸.

## Decisions

- The app learns a child is a boy from a **Girl / Boy choice made by the parent** (not from the avatar body, not
  neutral wording everywhere).
- Missing flag = girl. Existing children, their saved data and every word they see stay exactly as today.
- Only kid-facing and parent-facing text changes. Code comments that say "her" stay.

## 1. Data

`profile_v1` (already synced through the outbox and the family peek) gets an optional `boy: true`. Absent or anything
other than `true` means girl.

`engine/learner.js`:
- `readProfile` returns `boy: p.boy === true`; `writeProfile` writes `boy: true` only for boys (girls' profiles keep
  today's exact shape).
- `current()` includes `boy`.
- `update(fields)` accepts `fields.boy` (boolean).
- `adopt(id, profile)` keeps `profile.boy === true`.

`engine/sync-core.js` MERGE.profile today rebuilds the profile from name, emoji, grade and at, so it would drop the
flag: the newer copy's `boy` wins, written only when true.

## 2. Where the choice is made

**Start page, Add children** (`index.html`, `engine/account.js`):
- A chip row `👧 Girl` / `👦 Boy` (`#kid-kinds`, buttons `data-boy="0|1"`) under the grade chips. Required like the
  grade: nothing picked → error "Pick girl or boy." `checkChild` returns `child.boy`; the saved profile carries it.
- Neutral wording: placeholder "Child's name"; errors "Type the name.", "Pick the grade.", "Could not save the child.";
  the same-device note says "Add only brothers or sisters with Add a child."
- The child list line shows the choice: `🌻 Ana · Grade 5 · Girl`.

**Lobby → Parent → Settings → 🧒 Learner** (both lobbies, `engine/parent-panel.js`): a Girl/Boy select
(`#learner-boy`) beside Name and Emoji, saved by the same Save button through `Learner.update`. This covers guest
children and children added before this change. The note under it says "The name stays on this tablet and in the
backups."

## 3. What follows from the flag

Wording helpers live where the text lives; each takes the boy flag of the person being talked about.

**Family cheers and buddy** (`engine/family.js`):
- `relation(myGrade, herGrade, herBoy)`: higher grade → `'ate'` or `'kuya'`; lower → `'bunso'` (neutral, unchanged);
  same grade → `'sister'` or `'brother'`. `sisters()` passes the sibling's `profile.boy` and puts `boy` on each entry.
- TEXT gains `kuya: 'Kuya'`, `brother: 'Brother'` (Grade 2: `'Kapatid · Brother'`).
- The cheers a younger child sends (`fromBunso`) name the receiver: "Galing mo, Kuya!" etc. when the receiver is a boy.
  Cheer ids, limits and stored data do not change; only the displayed text is picked by the receiver's flag.
- "her big moments", "Cheer her on!" → "his"/"him" for a boy sibling. Filipino halves (siya, niya) are already neutral.

**3D world** (`world/text.js`, `world/kin.js`, `world/world-main.js`):
- The visit button follows the sibling's relation, not the page grade: `visitAte`, `visitKuya` ("👀 Visit Kuya's room"),
  `visitBunso`, `visitSister` ("👀 Visit your sister's room"), `visitBrother`. `TEXT.visitKey(rel)` maps one to the other.
- `sisterChoosing` "still choosing her look" → "his look" for a boy (Filipino "kanyang" stays).
- Any other world line naming the sibling follows the sibling's flag.

**Ask Family power-up** (`engine/powerups.js`, `engine/wallet.js` coin guide, `engine/study-history.js` names):
- The `ate` helper's label is **Kuya** (👦) when the child's older sibling in the family is a boy, otherwise **Ate**
  (👧) as today. The id stays `ate`: prices, history entries and saved data do not change. With no family information
  (guest, only child) it stays Ate.
- The coin guide (`wallet.js`) and the parent's history names (`study-history.js`) are static text: they say
  "Ate o Kuya" / "Ate or Kuya".

**A boy's first look and room** (`world/look.js`, `world/room.js` / `world/furniture.js`):
- A new character for a boy starts with `body: 'boy'`, `hair: 'short'`. A saved character is never changed.
- A new room for a boy starts with the free `home-wall-blue`; girls keep `home-wall-pink`. A saved room is never
  changed. `STARTER_ROOM` stays as it is; the boy wall is picked at room creation.

**Parent page notes** (`engine/parent-panel.js`): "she may be mixing these up", "In her review now", "She'll see them",
"where she can see her points" become neutral ("may be mixing these up", "In the review now", "They come back under
Review", "where the points show"), since the phone page has no single current child to ask.

## 4. Not changing

The character maker's body choice (any child can pick any body), the playmates (already 3 boys and 3 girls), shop and
furniture items, the cheer ids, the coin prices, code comments.

## 5. Tests

- Unit: learner profile `boy` default false, write/read/adopt/update round trip, a girl's profile JSON has no `boy` key;
  `checkChild` requires the choice; `relation` for all six cases; cheer text for boy and girl receivers; helper label
  Ate/Kuya/guest; a boy's default look and starter wall; a girl's are unchanged.
- E2E: `tests/e2e/account-e2e.js` adds a boy child and checks the chip, the list line and the saved profile.
  `tests/e2e/world-e2e.js` keeps passing (girls unchanged); the boy cases in the world are covered by unit tests of
  `Look.read`, `Room.start`, `House.roomOf` and `TEXT.visitKey`.
- All of `node --test` and the e2e scripts in `README.md` pass.
