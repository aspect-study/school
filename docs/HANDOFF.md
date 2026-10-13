# Handoff

Where the project stands. Updated 2026-10-11. Working rules are in `CLAUDE.md`; what the app does is in `README.md`.
Keep this page current: when a feature lands, move it to "Built", and add new ideas under "Parked" or "Next".

## Project

`C:\Users\ADMIN\IdeaProjects\school` holds study games for two sisters (Grade 2 and Grade 5): 17 subject games, two
lobbies with a campus map, a parent phone page, points, coins and a reward shop, cloud sync, and a walkable Three.js 3D
world (`web/world`). The repo is private; pushing to `main` deploys `web/` on Vercel (GitHub Pages is no longer used).

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
    changes; a phone parent page left open picks up a PIN changed elsewhere only after it signs in again or is reopened. `index.html?account=1` now asks for the parent PIN first (`lock-view`, 2026-10-09).
- Light theme everywhere (2026-10-11): the 17 games and both lobbies are always light (no dark-mode CSS;
  `color-scheme: light`), so a dark-mode tablet no longer turns them into dark dashboards; the phone parent page and
  `/admin/` still follow the phone's dark mode. Grade 5 games share `web/subjects/grade-5/polish.css`: lesson rows and
  answers have a thick border tinted with the game's colour and a press-down edge. `tests/light-theme.test.js` guards
  both. Spec and plan: `docs/superpowers/specs/2026-10-11-light-theme-design.md`,
  `docs/superpowers/plans/2026-10-11-light-theme.md`.

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
- World controls: 🏃 run button (a tap makes her 40% faster: while she stands it arms the run, which starts when she moves; acts on pointer-down so a tap beside a held joystick works on iOS; running too long fills a heart; see the next bullet), looping rides with a Stop pill (the slide stays one run), pinch / wheel zoom.
- HUD tidy-up and stamina (2026-10-11, sub-project D part 1): on a touch device the zoom slider is gone (she pinches);
  ⚙️ has a Zoom row with − and +. 🏃 can be armed while she stands (changed 2026-10-11) and still stops
  with her. Running fills a heart (`web/world/stamina.js`): about 8 s of running fills it, walking calms it in about
  6 s, standing in about 3 s. A ❤️ pill by 🏃 shows while the heart is above 0 and pulses faster as it fills, the
  existing heartbeat sound plays quietly in the last third, and at full she walks ("Catching breath", 🏃 greyed) until
  it is at or below 0.3. It also runs in the playground games (tag, hide-and-seek, Patintero) since 2026-10-12. Spec and plan:
  `docs/superpowers/specs/2026-10-11-hud-tidy-design.md`, `docs/superpowers/plans/2026-10-11-hud-tidy.md`. Tablet
  check pending (no slider on the real tablet, how the heart timing feels).
- Playground playmates: 6 named friends + 3 new kids each visit; they ride, join her rides, follow when invited, roam
  the whole map, and ask one study or fun question per talk (study answers saved with 0 points).
- Character chatter A1 (2026-10-13): pets and playmates say short pre-written lines in word bubbles near her, and a
  playmate's 💬 Chat button opens a tap chat with reply buttons. Pure `web/world/speech.js` (line picking), `chatter.js`
  (scheduler), `speechctx.js` (facts), `speechchat.js` (tap chat), view `bubbles.js`; lines in `web/world/speech/pets.js`
  and `kids.js`. A Chatter setting in the world's ⚙️ (Quiet, Calm default, Chatty; device only). Review sheets are
  generated into `docs/lines/` by `node tools/line-sheet.js`; run it after editing lines. Cosmetic only. Spec and plan:
  `docs/superpowers/specs/2026-10-13-character-chatter-design.md`, `docs/superpowers/plans/2026-10-13-character-chatter-a1.md`.
  Owner checked on the tablets and read the lines (2026-10-13): no changes asked.
- Character chatter A2 (2026-10-13): the town characters (Mimi, Hoot, Bunny, Lana, Kiko, Pilo, Tasyo) and the 17
  subject buddies at their doors now say ambient word bubbles with the A1 engine and rules. Lines in
  `web/world/speech/town.js` (181 lines, 24-30 per character) and `buddies.js` (42 shared + 13 per buddy = 263);
  review sheets `docs/lines/town.md` and `docs/lines/buddies.md`. Ambient only, no tap chat. The owner reviews both
  sheets. Doubts the buddy writer listed: word-train asking voice, history-explorers balangay line, net-navigators
  grown-up line, block-bot seesaw, craft-corner cooking. The e2e chatter case checks a bubble shows at the Plaza in
  Chatty. Spec and plan: `docs/superpowers/specs/2026-10-13-character-chatter-a2-design.md`,
  `docs/superpowers/plans/2026-10-13-character-chatter-a2.md`.
- Focus music (2026-10-13): a calm, slow tune plays while a lesson is open (cards and quiz), different for every lesson.
  `web/engine/focus.js` composes it from the seed `<game id>:<lesson title>` (mode, key, 52-68 BPM, one of four soft
  voices, chords, a sparse melody whose second pass drops a note) and plays it with Web Audio; no audio files. Each of
  the 17 games calls `Focus.start` for a lesson, the final exam and a review round; `Nav.screen` calls `Focus.screen`,
  which stops it on any screen that is not the cards or the quiz. `fx.js` ducks it under voice clips and speech. A
  ☰ menu item (🎶) toggles it, saved per device in `study_focus_v1`; Sound off silences it too. Tests:
  `tests/focus.test.js`, `tests/focus-wiring.test.js`. Tablet listening check pending (volume against the voice clips,
  stutter; the reverb is the first thing to drop). Spec and plan: `docs/superpowers/specs/2026-10-13-focus-music-design.md`,
  `docs/superpowers/plans/2026-10-13-focus-music.md`.
- Living world (2026-10-09): world characters no longer stand still. Buddies, Hoot, Bunny, Mimi and the four shop
  owners each run small routines (sweep, read, water, serve, hammer, hop, short flights, Mimi's stroll) inside a
  leash of 2-3 squares around their spot; they wave when she walks close, stop and face her when she talks to them,
  and carry on 2 s after. 11 unique pets (5 on playmates: Tagpi, Lila, Kidlat, Pandesal, Mingming; Hoot's parrot
  Kwento, Bunny's turtle Tagal, Mimi's unicorn Bituin; three on buddies) follow their owner, do 2 species behaviors
  each (parrot talks, fox pounces, dragon-style breathe, turtle shell...), sit and cheer when their kid rides, nap
  when the owner is still, greet her once every 30 s, play with another pet, and startle (a turtle hides) when
  someone runs or she sprints past. Pure engine `web/world/routines.js` + tables `lifedata.js`, view `life.js`;
  cosmetic only (no coins, points or saved data); far characters (40+) stand still and at most 12 act at once.
  Spec and plan: `docs/superpowers/specs/2026-10-09-living-world-design.md`,
  `docs/superpowers/plans/2026-10-09-living-world.md`. Tablet smoothness check pending.
- Playground games: tag, hide-and-seek and Patintero (Games board by the playground entrance; pure play, no coins).
  - Tuning (2026-10-08): hide-and-seek covers her eyes while she counts, the kids hide all over the map far from her,
    hints name only the place in the last 90 s; tag chasers are faster and lunge, with a red edge and heartbeat when
    close; her sister joins every game.
  - Game groups and Patintero (2026-10-08): the board and a kid's 🎲 Let's play! offer 🏃 Tag & Chase (tag,
    Patintero) and 🙈 Hide & Seek, and a friend may invite her to any of the three; Patintero on a big court (30 by 60)
    on the open lawn west of the school street, 4 against 4, she runs first and guards the middle line when her team
    is tagged, first to 5 points or 4 minutes.
  - Playground games polish (2026-10-12): the stamina heart runs in all three games, and hide-and-seek thumps when the
    seeker is close; a roster row (face chips and names, two rows in Patintero, "it" highlighted) and floating name tags
    show who plays; a tag chaser who cannot catch her gives up after 8 s, tries another kid, and chases her again once
    she is within 10 units (3 s hold); Patintero players wear blue and red bibs, every tag plays a slow-motion replay
    (last 2.5 s at 0.3 speed, about 8 s, 🎬 Replay bar with Skip ⏭; the game clock waits; `web/world/replay.js`), and
    her guard lane is random each round (middle or one of the three cross lines, never the same twice in a row; the
    hint names it). Spec and plan: `docs/superpowers/specs/2026-10-12-playground-games-polish-design.md`,
    `docs/superpowers/plans/2026-10-12-playground-games-polish.md`. Tablet check pending (replay smoothness and kids'
    legs in it, bib and name-tag sizes, roster on a phone, how the tired heart feels in tag).
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
- Games inside the world (2026-10-11): a door, a buddy's "Let's go" or the Boss Fort opens the real game page in a
  framed iframe over the paused, blurred town (`web/world/portal.js`); the game runs with `?embed=1` (`Nav.embedded`):
  ←/🏠 on the game home, the menu's 🏠 Back to town and the lesson path's home stop close the frame, ☰ Shop closes it
  and opens the lobby shop, and the game is locked to light inside. Closing replays her pet's welcome without a reload
  and steps back over every history entry the game added. The lobby and the phone page still open games as pages.
  Accepted gap: offline with a game not cached shows the browser's offline page inside the frame (✕ closes it). Spec
  and plan: `docs/superpowers/specs/2026-10-11-games-in-world-design.md`, `docs/superpowers/plans/2026-10-11-games-in-world.md`.
  Tablet check pending (glide smoothness, frame size on phone and tablet, the back gesture after a quiz, the pet's welcome).
- World as home (2026-10-11): a lobby page forwards to the world when 3D can run (`web/engine/home.js`; never inside
  the frame, with `?stay=1`, for a lobby section, or on `file:` pages). The world syncs (`cloud.js`, held while a frame
  is open via `Cloud.hold`) and runs the lobby's daily upkeep (`Quests.pick`, `Boss.ensure`, `Quests.check`). HUD: 🪙
  coins (opens the coin guide) and 🎯 quests with the streak (opens a quests card whose links open the game in the
  frame); the 🏠 Lobby pill is gone. Bunny's counter opens the reward shop and ⚙️ → 🔒 For parents the PIN-gated parent
  area, both as lobby sections in the frame (`?embed=1#shop|#coins|#parent`, `web/engine/lobby-embed.js`); the parent
  area's Account and 🏫 Open the lobby page leave the frame. A different child picked in the parent area reloads the
  world. Embed helpers live in `web/engine/embed.js`. Spec and plan: `docs/superpowers/specs/2026-10-11-world-as-home-design.md`,
  `docs/superpowers/plans/2026-10-11-world-as-home.md`. Tablet check pending (sign-in lands in the world, the home-screen
  icon, the shop's phone request from the world, a sync seen on the phone page while she stays in the world).
- Gifts and monsters at the hangout places: question-gated, 1/2/3 coins, at most 15 world coins a day, found-only
  wardrobe items for Hard questions.
- Customizable reward shop (2026-10-12): per child, a parent hides, renames and reprices the built-in rewards, adds up to
  40 of their own (10 to 10000 coins, optional note and 1 to 3 a day) and resets, in the Parent panel's Rewards tab
  (`web/engine/shop-editor.js`, mounted by `parent-panel.js`; works on the tablet lobbies and the phone page). The
  settings are `shop_items_v1` (`{ v: 1, items: { id: { at, hidden?, coins?, name?, emoji?, note?, perDay?, custom?,
  deleted? } } }`), read by `web/engine/wallet.js` (`effectiveCatalog`, `wallet.catalog` as a getter, `wallet.shop`
  edit API, `wallet.current(id)`) and synced by the `shopItems` merge in `sync-core.js` (later change per reward
  wins; a delete is final and kept as a marker). The coin guide drops the ML sections while those rewards are hidden.
  A request whose reward was hidden, deleted or repriced after the child asked ends as `short` with a neutral message
  (`ShopRequests.isStale`); on the phone it shows "Changed since asked" with Dismiss (a cancel, never a refusal).
  The 3D world's own stalls and the power-up prices are not affected. Accepted gap: a reward name starting with
  `=`, `+`, `-` or `@` is not guarded in the shop-history CSV (only a parent can type names). Spec and plan:
  `docs/superpowers/specs/2026-10-12-custom-shop-design.md`, `docs/superpowers/plans/2026-10-12-custom-shop.md`. Owner
  check pending: the editor on the phone page (no browser test) and on a real tablet.
- Original lesson writing (2026-10-11): lessons keep the deck's facts and terms, every sentence fresh
  (`docs/lesson-writing.md`); `tools/source-overlap.js` checks lesson text against `sources/` (7-word runs, whole
  4-word sentences); a reworded question's `was` field carries its review box over (`Recall.renamesOf`). Spec and
  plan: `docs/superpowers/specs/2026-10-11-original-lesson-writing-design.md`,
  `docs/superpowers/plans/2026-10-11-original-lesson-writing.md`.
- Owner dashboard (sub-project 1 of 3): built, a private page at `/admin/` (`web/admin/`) showing families, children,
  activity, questions per day, subjects and last sync, read from Firebase through the owner clause in the rules and
  `FirebaseRemote.adminRemote()`. Live since 2026-10-09 (owner UID set in `admin-config.js` and the published rules).
  Still unchecked: a wrong password is refused, a family account sees "Not allowed". Still to do: error
  reporting hook, Vercel Web Analytics link, parent progress dashboard, play-world time tracking.

## Parked or excluded (ask the owner before starting)

- **Wardrobe 4, particle trails and auras:** excluded by the owner 2026-10-07. Do not build.
- **On-device AI helper (parked 2026-10-11):** Gemma 4 E2B in the tablet browser (WebGPU), "Explain it another way" after a
  wrong answer, parent switch in the lobby Settings tab, English only. Spec and plan are written, no code yet; resume at
  plan Task 1 (the spike page, run on the girls' tablets). Sub-project 2 (pet teacher chat in the world) comes after.
  `docs/superpowers/specs/2026-10-11-on-device-ai-design.md`, `docs/superpowers/plans/2026-10-11-on-device-ai.md`.

## Next

- **Character chatter, what is left:** A3 is done (2026-10-13): her own pet speaks ambient bubbles while it walks, with the shared pet lines and no `{pet}` lines (`Speech.without`). The owner decided to SKIP Jesus's and her sister's chatter (both are sensitive; do not propose them). Later and optional: pet tap chat, `studied` and `medal` tags, reply chats for town characters, chat memory (remember reply taps; needs one synced key), Part B (characters talking to each other).
- **Lesson audit** (rewrite text that copies a source; `docs/lesson-writing.md`, "Rewording an existing question"),
  one game per commit, hits at the start in brackets (3356 in all on 2026-10-11).
  **Stopped 2026-10-12** by the owner (token cost). The unticked games stay as they are; don't audit them, not even
  when a new deck arrives. The rule applies to new lessons only: new lesson files must pass
  `node tools/source-overlap.js <new files>`. Open owner questions: Wikaharian dagat vs ilog (Mang Felipe) and "Nagmamahal," lagda vs bating
  pangwakas; Craft Corner half double crochet steps (deck = single crochet) and the "twisted twice" line in double
  treble.
  - [x] Net Navigators (Computer 5) [240]
  - [x] Wikaharian (Filipino 5) [364]
  - [x] Rise & Shine (GMRC 5) [121]
  - [x] Craft Corner (TLE 5) [149]
  - [ ] Life Lab (Science 5) [344]
  - [ ] History Explorers (AP 5) [406]
  - [ ] Page Turners (English 5) [302]
  - [ ] Kuwentista (Filipino 2) [121]
  - [ ] Word Train (English 2) [104]
  - [ ] Growing Good (GMRC 2) [246]
  - [ ] Rhythm & Hues (Music & Arts 5) [275]
  - [ ] Byte Buddies (Computer 2) [208]
  - [ ] Rally Ready (P.E. & Health 5) [168]
  - [ ] Batang Bayani (Makabansa 2) [99]
  - [ ] Science Detectives (Science 2) [81]
  - [ ] Math Mastery (Math 5) [81]
  - [ ] Block Bot (Math 2) [47]
- **Lazy loading, sub-project D part 2 (parked 2026-10-11):** no slowness has been felt on the tablet, so nothing to
  fix yet. The world page loads 97 scripts, about 1.7 MB of JS (three.min.js 608 KB, world-main.js 80 KB) and 2.8 MB of
  sounds; the service worker precaches them, so after the first visit the cost is parse and start-up. Decided in the
  brainstorm: measure before changing anything. Proposed, not yet approved: a `?perf=1` panel on the world page (time
  to first screen and to world-ready, script time, average and worst frame rate over 10 s, slowest scripts, cached or
  not; no storage, no effect without the flag), with the alternatives of saving the numbers in the parent area or
  syncing them to the cloud. Resume at that question if the world ever feels slow.
- **Wardrobe 5b, My Yard:** the same square-and-place system outdoors around My Little House (split from 5 on
  2026-10-08). Brainstorm first.
- Account hardening (2026-10-12): strict Firestore rules with emulator tests, PIN and consent at registration, privacy notice, email verification (advisory), 8-character passwords, delete family account, App Check support (key still to be registered, see README).

New subject lessons arrive as class decks and summative tests.

## Still pending on the owner's side (not code)

- App Check key + Enforce, email enumeration protection, password policy (README, Account hardening): only needed if other families ever sign up on this site; the school app is private and unlisted, and the public project has its own repo and session. The new Firestore rules are deployed (owner, 2026-10-13).
- Set the privacy contact email in `web/privacy.html` (it still contains CONTACT_EMAIL) and remove the skip in `tests/privacy.test.js` before other families use the app.
- Firestore rules republished with the history-entry cap of 100000 (owner, 2026-10-13; a long Mock Exam entry lists every wrong answer). Measured 2026-10-12 on a used tablet: `review_v1` 125659 characters (cap 500000), `mastery_v1` 16667, `history_v1` 268777 in total but synced as one small document per entry. Re-measure (`learner/` keys in localStorage) once a term; if `review_v1` passes 350000, raise the state cap in the rules and in `tests/rules/families.rules.js`.
- Family account live check: done by the owner (2026-10-13). Anyone can still register on `study-game`; turn Email/Password sign-up off in the Firebase console if that becomes a problem.
- Tablet checks of the 3D world: music after the first tap, smoothness, Mimi's greeting and trail, the shop hop and
  back, the boss strip, playmates, playground games, gifts and monsters.
- Patintero on the tablet: the court on the west lawn (moved from beside the playground and made 30 by 60 on
  2026-10-08 so everyone has room to run; first to 5 points because 3 came too fast on the big court) and the view
  of it, the kids' play pace, her guarding on the middle line, Sprint having to be pressed again after each
  "Ready… Set… Go!", and any stutter when the teams swap (8 sparkles at once).
- A live cheer test between the two tablets.
- Living world on the tablet: smoothness with everyone moving, pets keeping up when a kid runs, and whether the pets' sizes next to the characters look right.
- My Room on the tablet: Decorate taps on squares and pieces, the panel size, Tito Tasyo's preview, the desk (the
  camera there looks past her head, which hides most of the desk top and a small pet sitting on it), the trophy
  bubble, and a sister visit once both tablets have synced.
