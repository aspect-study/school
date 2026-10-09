# Handoff

Where the project stands. Updated 2026-10-09. Working rules are in `CLAUDE.md`; what the app does is in `README.md`.
Keep this page current: when a feature lands, move it to "Built", and add new ideas under "Parked" or "Next".

## Project

`C:\Users\ADMIN\IdeaProjects\school` holds study games for two sisters (Grade 2 and Grade 5): 17 subject games, two
lobbies with a campus map, a parent phone page, points, coins and a reward shop, cloud sync, and a walkable Three.js 3D
world (`web/world`). Pushing to `main` publishes `web/` to GitHub Pages.

## Built (all on `main`)

Do not redo, re-plan or overwrite these. Each one has a spec and a plan in `docs/superpowers/` with the same date.

**Study games and lobby**
- 17 games (10 Grade 5, 7 Grade 2); lesson counts are in `README.md`.
- Fair points (3-day question rest, type-it-first), power-ups, coin shop with parent PIN, coin milestones, date guard.
- Spaced review (Leitner boxes), lesson medals, celebrations, daily quests + gentle streak, weekly boss + boss army.
- Nav bar, lesson search, reviewer lock (no timer), map guide + lesson path, campus map lobby, family presence
  (sister cheers).
- Parent panel tabs: Focus (Fixed / Still missing, Practice these, This week), phone parent page with recent history.
- Learner profiles, cloud sync (Firebase), PWA offline cache.
- Family account (2026-10-09): the start page has Sign in, Create family account (then add each child with the grade,
  then "Who uses this tablet?") and Play without an account; Forgot password. `index.html?account=1` (👤 Account in
  the lobby Settings tab and on the phone page) changes the family password and the parent PIN (no longer fixed at
  0108; synced newest-wins through `families/{uid}/settings/pin`) and adds a child. Spec and plan:
  `docs/superpowers/specs/2026-10-09-family-account-design.md`, `docs/superpowers/plans/2026-10-09-family-account.md`.
  - The phone parent page keeps its PIN pad disabled ("Checking the PIN…") until the family PIN has synced, for at
    most 5 s. The lobby syncs the PIN after each good cloud round without waiting on it. Add children and Who uses
    this tablet? have a Back button; Sign out works offline.
  - Play without an account opens the 3D world for the picked grade (a returning device still goes to its lobby).
- Start page backdrop (2026-10-09): animated 3D Play World (random town, kids and pets walking, camera circling one
  kid at a time) in a click-through iframe, `web/world/backdrop*.js`; falls back to the plain page without WebGL;
  owner tablet and phone check pending. Spec and plan: `docs/superpowers/specs/2026-10-09-start-page-backdrop-design.md`,
  `docs/superpowers/plans/2026-10-09-start-page-backdrop.md`.
- Boy players (2026-10-09): `profile_v1` may carry `boy: true` (absent = girl, so existing children are unchanged;
  the sync merge keeps it). Girl/Boy is asked on Add child and set in the lobby's Learner settings. Family wording
  follows it: Ate/Kuya, sister/brother, his/him in the buddy, cheers and the 3D world (visit button by relation); the
  Ask Family helper shows Kuya when every older sibling is a boy (id stays `ate`); a boy's unmade character starts as a
  boy with short hair and his first room has the free blue walls. Play World button and world badge are sky blue / 🌍.
  Accepted gaps: anyone can still pick any body in the character maker; the coin guide and parent history say "Ate or
  Kuya". Spec and plan: `docs/superpowers/specs/2026-10-09-boy-players-design.md`,
  `docs/superpowers/plans/2026-10-09-boy-players.md`.
  - Known gaps: newest-wins compares each device's own clock, so a tablet whose clock runs ahead wins over later real
    changes; a phone parent page left open picks up a PIN changed elsewhere only after it signs in again or is reopened. `index.html?account=1` opens without the parent PIN (the 👤 Account button sits behind it, but the
    address does not), so a child who types it can sign the tablet out or add a child; changing the password or PIN
    still needs the current one.

**3D world** (`web/world`, opened from 🌸 Play World in each lobby)
- Phases 1-4: character maker, a building per game with medal decorations, Mayor Mimi + sparkle trail, subject buddies
  with Ask me!, Professor Hoot, Bunny's shop, talking trees, Jesus's garden (daily greeting, comfort on hard days),
  sister at the gate, playground rides, 10-minute nudge.
- Boss + army at the Boss Fort, with the once-a-week finale and chest.
- Wardrobe (Shop Plaza stalls, same coin wallet as real rewards):
  - 1: Lola Lana's boutique (clothes, hats, accessories, face extras, special hair, shimmer).
  - 2a/2b: Mang Kiko's pet stall (13 pets, pet gear, tricks, toys, fetch, Play button).
  - 3a: Kuya Pilo's toy stall (12 props, 8 emotes). 3b: world sounds (footsteps, pet voices). 3c: ride sounds.
- Sound packs (2026-10-09): Happy Chimes (original clips from `tools/kid-sounds.js`, the default) and Battle announcer
  (the MOBA/Valorant/LoL clips, kept). Chosen in the ☰ menu of every game and in the world's ⚙️ Settings; one
  device-level key `study_fx_pack_v1`, `Fx.pack/setPack`. The world's own sounds are unchanged. Spec and plan:
  `docs/superpowers/specs/2026-10-09-sound-packs-design.md`, `docs/superpowers/plans/2026-10-09-sound-packs.md`.
- English first (2026-10-09): outside the Filipino, Makabansa and Araling Panlipunan games, Grade 2 text (messages, talks, labels, shop) shows English only. The 🇵🇭 Filipino switch (lobby, ☰ menu, world Settings; `study_fil_helper_v1`, `web/engine/lang.js`) brings the Filipino pairs back. Modules get their words through `Lang.localize` / `Lang.both()`; `tests/e2e/english-first-e2e.js` scans for leftover Filipino.
- Play World is the lobby hero button (2026-10-09); on a phone the world's action buttons sit in one right-hand column (`.w-rail`).
- World controls: Sprint button, looping rides with a Stop pill (the slide stays one run), pinch / wheel zoom.
- Playground playmates: 6 named friends + 3 new kids each visit; they ride, join her rides, follow when invited, roam
  the whole map, and ask one study or fun question per talk (study answers saved with 0 points).
- Playground games: tag, hide-and-seek and Patintero (Games board by the playground entrance; pure play, no coins).
  - Tuning (2026-10-08): hide-and-seek covers her eyes while she counts, the kids hide all over the map far from her,
    hints name only the place in the last 90 s; tag chasers are faster and lunge, with a red edge and heartbeat when
    close; her sister joins every game.
  - Game groups and Patintero (2026-10-08): the board and a kid's 🎲 Let's play! offer 🏃 Tag & Chase (tag,
    Patintero) and 🙈 Hide & Seek, and a friend may invite her to any of the three; Patintero on a big court (30 by 60)
    on the open lawn west of the school street, 4 against 4, she runs first and guards the middle line when her team
    is tagged, first to 5 points or 4 minutes.
- Pet teacher: her pet explains every wrong answer in the world step by step.
- Performance (2026-10-08): the HUD only writes values that change, the danger edge pulses by opacity, one failing
  frame cannot freeze the world, and the music skips ahead after a throttled timer.
- My Room, wardrobe 5a (2026-10-08): walk into My Little House; a room that grows with medals (4×4 up to 8×8, 2026-10-08: Grade 5 at 8/20/40/70, Grade 2 at 5/12/25/40); the
  🛠️ Decorate view (squares, move, turn, put away, buy with a see-through preview); Tito Tasyo's workshop (fourth
  Shop Plaza stall); earned-only pieces; the study desk (Ask me!, 3 a visit); the trophy shelf; the mirror moved
  inside; the window seat from 6×6 up; her sister's room, view only, with a cheer. Data in `house_v1` (synced, backed up).
  Done and tested 2026-10-08 with the review fixes: square (5,5) stays clear at 6×6 for 🪑 Sit, the mirror's "More at
  …" takes her out before the Shop Plaza trail, the doorstep (48.3, 54) is past 🚪 Go in's reach, her pet sits on the
  walkway in Decorate (she stays hidden) and at the desk hops onto it at shoulder size if small or sits by the stool,
  and a Grade 2 trophy bubble is one line. Owner decisions: keep `noRoom` "para dito"; keep the inside camera (looks
  down, walls in its way see-through). Merged into `main` 2026-10-08.
- Gifts and monsters at the hangout places: question-gated, 1/2/3 coins, at most 15 world coins a day, found-only
  wardrobe items for Hard questions.

## Parked or excluded (ask the owner before starting)

- **Wardrobe 4, particle trails and auras:** excluded by the owner 2026-10-07. Do not build.

## Next

- **Wardrobe 5b, My Yard:** the same square-and-place system outdoors around My Little House (split from 5 on
  2026-10-08). Brainstorm first.

New subject lessons arrive as class decks and summative tests.

## Still pending on the owner's side (not code)

- Family account live check: create a test account on the site, add a child, pick her, change the PIN and see it on
  the other tablet and the phone after a sync; Forgot password email arrives. First confirm sign-up is allowed in the Firebase console (Authentication → Settings →
  User actions); with email-enumeration protection on, Forgot password reports success even for an unknown email. Anyone can now register on `study-game`;
  turn Email/Password sign-up off in the Firebase console if that becomes a problem.
- Tablet checks of the 3D world: music after the first tap, smoothness, Mimi's greeting and trail, the shop hop and
  back, the boss strip, playmates, playground games, gifts and monsters.
- Patintero on the tablet: the court on the west lawn (moved from beside the playground and made 30 by 60 on
  2026-10-08 so everyone has room to run; first to 5 points because 3 came too fast on the big court) and the view
  of it, the kids' play pace, her guarding on the middle line, Sprint having to be pressed again after each
  "Ready… Set… Go!", and any stutter when the teams swap (8 sparkles at once).
- A live cheer test between the two tablets.
- My Room on the tablet: Decorate taps on squares and pieces, the panel size, Tito Tasyo's preview, the desk (the
  camera there looks past her head, which hides most of the desk top and a small pet sitting on it), the trophy
  bubble, and a sister visit once both tablets have synced.
