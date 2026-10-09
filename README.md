# School Study Games

A family project: study games I'm building for my two daughters, one in Grade 2 and one in Grade 5. Each school subject has its own game with flashcards, quizzes and a mock exam, all written from the class's own lesson decks, textbook pages and past summative tests. There's also a points and coin system, which turns study time into rewards that a parent approves.

Everything is plain HTML and JavaScript: no build step, no server, no install. Open a lobby page in any modern browser (desktop, iPad or Android tablet) and play.

## Play

| Grade | Lobby |
|---|---|
| Grade 5 | <https://aspect-study.github.io/school/lobby/grade-5.html> |
| Grade 2 | <https://aspect-study.github.io/school/lobby/grade-2.html> |

<https://aspect-study.github.io/school/> asks which grade is studying. Old links (`lobby-grade5.html`, `grade%202/lobby.html` and the old game addresses) still work: they forward to the new ones, so home-screen icons installed before the move keep working.

### Install as an app (works offline)

Each lobby is an installable app (PWA) with its own name and icon: **Grade 5** (teal) and **Grade 2** (pink). Open the lobby link once while online, then:

- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).
- **iPad / iPhone (Safari):** Share → **Add to Home Screen**.

After that first visit, every game in that grade plays offline. When the tablet is online, it always loads the newest version, so content updates show up without reinstalling.

**Before replacing an existing iPad home-screen icon**, make a backup (🔒 Parent → Full backup, or copy the backup text) and import it in the new app. On iOS each home-screen app has its own storage, so a new icon starts with no points or coins. Android shares storage with Chrome, so nothing needs to be moved there. An existing icon keeps working and also gets offline play, so there is no need to replace it.

The offline cache list is in `web/sw.js`. `tests/pwa.test.js` fails if any file in `web/` is left out of it.

## Subjects

### Grade 5 (English interface)

| Game | Subject | Lessons | Covers |
|---|---|---|---|
| Math Mastery (`math/`) | Math | 11 | Divisibility, GEMDAS, fraction operations, ordering decimals, UPAC word problems, 10 case studies |
| Page Turners (`english/`) | English | 23 | Story elements, figurative language, main idea, summarizing, author's purpose, nouns and pronouns, fact vs opinion and more |
| Wikaharian (`filipino/`) | Filipino | 20 | Poetry, fiction, informative text patterns, actor focus, linkers, denotation, degrees of adjectives, adverbs, myths and legends, letters, references, forms, literary works |
| History Explorers (`araling-panlipunan/`) | Araling Panlipunan | 29 | Barangay, leaders and classes, trade, beliefs and traditions, the study of history, theories of origin, the first Filipinos, evidence, location, Islam and the sultanates, ties with China |
| Life Lab (`science/`) | Science | 18 | Matter, measurement, scientific method, microorganisms, plant and animal groups |
| Rise & Shine (`gmrc/`) | GMRC | 13 | Self, saving, dignity, faith, traffic rules, manners, gratitude, e-waste |
| Rally Ready (`pe-health/`) | P.E. & Health | 18 | Net and wall games, ABC skills, pickleball, practical skills test, stress and coping, bullying, life skills, relaxation, Siyatong, puberty |
| Craft Corner (`tle/`) | TLE | 9 | Home furnishings, embroidery, crochet, sewing |
| Rhythm & Hues (`music-arts/`) | Music & Arts | 12 | Precolonial songs, instruments, dance and visual arts; recorder history, consorts, parts, care, notes and fingerings |
| Net Navigators (`computer/`) | Computer | 8 | Search engines and keywords, evaluating websites, file sharing and its risks, online storage, netiquette, chat and IM, discussion boards |

The Filipino and Araling Panlipunan games keep the textbook's Filipino wording and add optional English help: card translations, a "Hindi maintindihan?" button on questions, and "Paano Sagutin?" tip cards.

### Grade 2 (Taglish interface)

| Game | Subject | Lessons | Covers |
|---|---|---|---|
| Block Bot (`math/`) | Math | 12 | Numbers, place value, number lines, Philippine money (drawn in SVG) |
| Kuwentista (`filipino/`) | Filipino | 15 | Alpabeto, pangngalan, panghalip, pang-uri, pandiwa, kongkreto at di-kongkreto, pangungusap at parirala, pantukoy, sight words |
| Word Train (`english/`) | English | 13 | Alphabet, onset and rime, CVC words, nouns, pronouns, verbs, adjectives, sentences, intonation, sequencing |
| Batang Bayani (`makabansa/`) | Makabansa | 14 | Komunidad, klima, mapa, mga tungkulin |
| Growing Good (`gmrc/`) | GMRC | 8 | Family, feelings, prayer, saving, obeying, talents |
| Byte Buddies (`computer/`) | Computer | 10 | Computer care, parts, the desktop, the Internet |
| Science Detectives (`science/`) | Science | 6 | Body, senses, objects, animals, habitats |

## How a game works

- **Flashcards** for each lesson, then a **10-question quiz** (multiple choice, true/false, picture and number-line questions).
- A **Final Mock Exam** mixes questions from every lesson.
- An **Exam Strategy** page has subject-specific test-taking tips, including the "trap" patterns real tests use.
- **Learn from mistakes:** after a wrong answer, the game explains why that choice is wrong, what the right answer is, and gives a tip for next time.
- **Explore other answers:** after answering, tap any other choice to see why it is or isn't right. This never affects the score.
- **Stars** (up to 3 per lesson) reset each day. **Points** are permanent.
- **Medals** (🥉 Bronze, 🥈 Silver, 🥇 Gold) need every question in a lesson right on 1, 2 and 3 separate days. They never go away; a 🔧 shows when a lesson needs a polish. A new medal pays 3, 5 or 10 coins once. The lobby's **🏅 Medals** button shows every lesson's medal.
- **Celebrations:** a short popup cheers a new medal, a whole game reaching Bronze, Silver or Gold, and fixed mistakes, with what she did and one next step. It waits for PERFECT!, closes with a tap or by itself, follows the mute key and the tablet's reduce-motion setting.
- **Daily quests:** the lobby offers 3 quests a day fitted to her (a Review that is due, her weakest recent lesson, and a rotating one), never the same twice in a row when there is another choice. All 3 pay 3 coins once a day. The **streak** counts days with at least one quest and survives 2 rest days in any 7; it pays 5, 10, 15 and 20 coins at 7, 14, 30 and 60 days. It never talks about losing a streak.
- **Weekly boss:** every Monday the lobby picks a boss: 4 games (3 for Grade 2) where review is most needed. Each stage is a 3-question review inside that game, due questions first, then her weakest boxes (those rest and pay 0 points). 2 of 3 right clears a stage, and she can retry. Every stage cleared pays 10 coins at once. At least half cleared by Sunday pays 4 coins when the next week starts.
- **Boss army:** each week one of 6 cute bosses (`bosses.js`) leads the boss round. In a boss stage a strip shows him and one minion per question; a right answer pops a minion, a wrong one makes it giggle. The last stage pops the boss. In the 3D world he waits on his own little stage beside the Boss Fort with his minions and, once every stage is cleared, plays a finale with a treasure chest (once a week, `world3d_v1.bossWin`).
- **Date guard:** when the tablet's clock reads more than an hour earlier than the latest time it has seen, points and coins pause, a banner says so, and Parent → 📅 Tablet date → "The date is right now" clears it.
- **Campus map:** the lobby opens on a map (Grade 5 Campus, Grade 2 Bayan). Every game is a building that gets a flag, a banner and a gold roof as all its lessons reach Bronze, Silver and Gold. ⚔️, ❗ and 🔁 show a boss stage, an open quest and due review; the shop sparkles when a reward is affordable, and the Boss Arena counts stages cleared. Her buddy (picked once, free) walks to the building she taps. 📋 List shows the cards, and the lobby remembers the choice.
- **Sisters (family presence):** with the cloud on, each lobby's map shows her sister's buddy by the gate (glowing while she is playing, 💌 when she has new big moments). Tapping it shows her last 5 big moments (medals, boss stages, all 3 quests, streaks) and 6 one-tap cheers; a cheer pops up on her sister's tablet after the next sync. Never scores or coins, never free text; cheers earn nothing; 10 a day.

## The 3D world

**🌸 Play World** in each lobby opens a walkable Three.js world (`web/world/grade-5.html`, `grade-2.html`). A tablet
that cannot do 3D gets a resting card with a link back to the lobby.

The start page shows a slow animated 3D town (`web/world/backdrop.html`, random Campus or Bayan) behind its buttons; it
is purely visual and falls back to the plain page when 3D cannot run.

- **Her character:** made once in the character maker; the mirror in her room changes the look later. A joystick or tap-to-walk moves
  her, Sprint makes her 40% faster, and pinch or the mouse wheel zooms.
- **The games are buildings.** Each door opens that game; its building gets decorations as its lessons earn medals.
  Quick travel jumps between places.
- **Characters:** Mayor Mimi (welcome, sparkle trail, the 10-minute nudge), a subject buddy at each door and Professor
  Hoot (Ask me! review questions), Bunny's shop, talking trees, Jesus's garden (a daily greeting, comfort on hard days),
  her sister at the gate, and the week's boss at the Boss Fort.
- **Shop Plaza stalls** (same coins as the reward shop): Lola Lana's boutique (clothes, hats, accessories, face extras),
  Mang Kiko's pets (pets, pet gear, tricks, toys), Kuya Pilo's toys (handheld props, emotes) and Tito Tasyo's
  workshop (furniture for her room).
- **My Room:** 🚪 Go in at My Little House takes her into her own room, 4×4 squares at first, then 5×5 up to 8×8 as her
  lessons earn medals (Grade 5 at 8, 20, 40 and 70 lessons with a medal; Grade 2 at 5, 12, 25 and 40). In 🛠️ Decorate (a view from above) she places furniture on squares, moves, turns and puts it
  away, and buys new pieces with her coins; six pieces are earned only (a 7-day streak, a weekly boss, her first gold,
  many medals, a subject all gold, 20 desk questions). The study desk asks up to 3 due review questions per visit (her pet hops onto the desk, or sits by the stool), the
  trophy shelf has one cup per subject in its medal colour, and the mirror is by the door. 👀 Visit lets her walk
  around her sister's room (view only) and send a cheer.
- **Playground:** swings, see-saw and merry-go-round loop until she taps Stop; the slide is one run. Nine kids play
  there (six named friends and three new kids each visit). They ride with her, follow her when invited, walk the whole
  map and ask one study or fun question per talk. A kid's 🎲 Let's play! or the 🎲 Games board offers the games in two
  groups, 🏃 Tag & Chase (tag, Patintero) and 🙈 Hide & Seek (hide-and-seek), and a friend may run up and ask her to
  play one; her sister joins them. Patintero is played on a big court (30 by 60, with open ground all round) on the
  open lawn west of the school street, 4 against 4: her team runs across every line and back, and when a guard tags
  one of them the teams swap and she guards the middle line. The first team to 5 points, or the one ahead after 4
  minutes, wins.
- **Learning in the world:** after any wrong answer her pet explains it step by step. Gift boxes and cute monsters at
  the hangout places open or pop only on a right answer (see Rewards).
- **Sounds:** footsteps (Settings: Footsteps On/Off), pet voices and ride sounds; the clips are in `web/assets/sounds/world` (made by `tools/world-sounds.js`).

World answers from Ask me!, gifts and monsters are scored like a review and show in the parent history. The
playmates' study questions are saved to history with 0 points.
Characters walk small routines and some of them have unique pets (web/world/routines.js, lifedata.js, life.js).

## Rewards

| Rule | Value |
|---|---|
| Correct answer | 10 points (20 in the mock exam) |
| Streak bonus | +5 per answer once 3 in a row are right |
| Type it first ✏️ | +5 for typing the answer before seeing the choices |
| Question rest ⏳ | A question answered right without help pays 0 for 3 days, so replaying a memorized quiz doesn't farm points |
| Coins 🪙 | 1 coin per 20 new points (points from before 2026-10-04 keep 1 coin per 10), plus a 40-coin welcome gift |
| Medals 🏅 | A new 🥉 / 🥈 / 🥇 pays 3 / 5 / 10 coins once |
| World gifts and monsters 🎁 | In the 3D world, a right answer opens a gift or pops a monster: 1 / 2 / 3 coins for an Easy (never answered) / Medium (due) / Hard (due, missed before) question, at most 15 world coins a day; a Hard one also gives a found-only wardrobe item. Due questions come first; resting ones are never asked |
| Real test bonus 📝 | A parent enters a school test score: 50 / 40 / 30 / 10 coins for 100% / ≥90% / ≥80% / below |

**Shop:** the lobby has a reward shop for real-life rewards (the catalog is in `web/engine/wallet.js`). A parent approves each purchase with a PIN.

**Power-ups:** inside a quiz, coins buy Hint, 50/50, Second Chance, Shield, Later and Ask Family.

Each grade has its own separate wallet.

## Parent panel

Tap **🔒 Parent** in a lobby and enter the PIN:

- **Learner:** her name and emoji. The lobby then greets her ("🌻 Hi, Ana!"). The name stays on the tablet and in her backups, never on the website.
- **Tabs:** 🎯 Focus (opens first), 📚 Subjects, 🕒 Activity, 🪙 Rewards and ⚙️ Settings (tablets only). The range (Today, 7 days, 30 days, All, Custom; Last 30 days by default) drives Focus, Subjects and Activity.
- **Focus:** the subjects that need the most help first, ranked by questions to fix, then % right. Open one for its weakest lessons (5+ answers, under 80%) and each question she missed: what she picked, the right answer, how often, its lesson, a **Still missing** or **Fixed** chip (from the review boxes; answers saved before 2026-10-05 and Grade 5 Math show no chip), and a note when she picked the same wrong answer more than once. **📌 Practice these** puts a subject's still-missing questions (and, for Grade 5 Math, its weak lessons) into her review for today; she sees them under Review in the lobby. **📈 This week** compares each subject's % right with last week (Monday to Sunday), counts questions fixed this week, and shows what happened to the questions sent with Practice these.
- **Subjects:** every subject with % right, quizzes and medals; every lesson with its medal, 🔧 when it needs a review, and % right in the range.
- **Activity:** every app opened, lesson viewed and quiz taken, with score, time, power-ups used and each wrong answer. Filter by subject. The phone loads the last 60 days of history when it opens; pick All (or an older Custom range) and tap **Load older history** for the rest.
- **Real test score:** add bonus coins for a school test.
- **Cloud backup:** sign in once per device with the family login (email + password). The lobby then backs up to Firebase on its own and keeps her other devices in sync: when the lobby opens, every 2 minutes, and when the device comes back online. A new or wiped tablet signs in, taps the child, and everything comes back. See `docs/superpowers/specs/2026-10-02-cloud-sync-design.md`.
- **👤 Account** (Settings tab, and on the phone page under "Which child?"): opens `index.html?account=1`. Change the
  family password (asks for the current one), change the parent PIN (asks for the current one; 0108 until changed),
  add a child, sign out (works offline too). The PIN lives on each device (`parent_pin_v1`, `web/engine/parent-pin.js`) and, when signed
  in, in `families/{uid}/settings/pin`; the newest change wins at each sync, so one change reaches every tablet and the
  phone. The lobby syncs the PIN after each good cloud round without waiting on it. The phone page keeps its PIN pad
  disabled ("Checking the PIN…") until the family PIN has synced, for at most 5 seconds. Without an account the PIN
  change stays on that device.
- **Full backup:** export or import a `.json` file holding the history, points, coins, question rest-days and her name. Backups made before learner profiles still import. Import shows the backup's points and coins next to the device's and asks before replacing them. The 🔒 Parent button shows **💾 backup due** when the last backup is more than 7 days old.
- Spreadsheet (`.csv`) export of the history and of shop purchases.

## Where data is stored

All progress lives in the browser's `localStorage` on each device, and the device is always the main copy: the games never wait on the network. If a parent signs in under **Cloud backup**, the lobby also syncs it to the family's Firebase project (`study-game`), readable only with the family login (`firebase/firestore.rules`). Without signing in, nothing is sent anywhere. That means:

- Each device (and each website address) has its own data. Use **Export full backup / Import backup** to move it.
- Everything a child saves belongs to her **learner profile**: it is stored under `learner/<id>/…`, not under a grade. Her coins, history and stars stay with her when she moves up a grade, and a younger sibling who later plays the same game on the same device starts fresh. `web/engine/learner.js` owns this.
- The device remembers its child, so `index.html` goes straight to her lobby. A new device shows **Welcome**: 🔑 Sign in
  (then "Who uses this tablet?"), ✨ Create family account (email + password, then add each child with her name, emoji
  and grade, then pick who uses this tablet), or 🎮 Play without an account (pick the grade; nothing is sent anywhere).
  Forgot password sends Firebase's reset email. Add children and Who uses this tablet? have a Back button. On a tablet that already has a child, Create family account skips Add children: her progress uploads at the next sync, and only her siblings are added with Add a child. `web/engine/account.js` runs it.
- Tablets saved before learner profiles (2026-10-02) are moved over automatically on their first visit. The old keys are copied, not moved, and stay as a safety net.
- Clearing the browser's site data erases progress, so keep a recent backup off the device.
- On iPad, a Home Screen app has storage separate from Safari.

## Project layout

```
web/                         the published site (the only folder GitHub Pages serves)
  index.html                 "Who's studying?" grade picker
  lobby/grade-5.html         Grade 5 lobby (subject cards, shop, parent panel) + its .webmanifest
  lobby/grade-2.html         Grade 2 lobby + its .webmanifest
  subjects/<grade>/<subject>/  one game per subject, e.g. subjects/grade-5/science/:
    index.html                 the game: screens, look and quiz flow
    subject.json               its permanent ID, title and storage keys
    lessons/NN-name.js         one lesson per file (cards + quiz), plain data
    strategy.js, type-it.js    exam tips; questions she may type first (cases.js, walkthroughs.js in Math)
  engine/                    shared by every page, one copy each:
    storage.js                 the only file that touches browser storage: each child's space + the sync outbox (loaded first)
    learner.js                 who is studying, and which space is hers (loaded second)
    nav.js                     games only: top bar (Back, Home, Menu), the leave-the-quiz check, the back gesture
    search.js                  games only: the lesson search above the home list (titles, subtitles, flashcards)
    read-gate.js               games only: the quiz unlocks once every flashcard was shown (no timer)
    clock.js                   the date guard: points and coins pause when the tablet's clock goes back
    sync-core.js               cloud sync merge rules (lobbies only)
    firebase-config.js         the family's Firebase project; public by design
    cloud.js                   Firebase sign-in, the Cloud backup panel and sync timing (lobbies only)
    parent-pin.js              the parent PIN: device copy, 0108 by default, synced newest-wins with the family's cloud copy
    account.js                 the start page: sign in, create the family account, add children, Account view
    study-history.js           study history + backup
    wallet.js                  points → coins, shop catalog, coin guide
    powerups.js                in-quiz power-ups
    recall.js                  review boxes (1/3/7/14/30 days), Review rounds, type-it-first
    mastery.js                 lesson medals (🥉🥈🥇 from the review boxes), the lobby map, medal coins
    quests.js                  daily quests, the gentle streak, quest and streak coins
    boss.js                    the weekly boss: stages, the lobby card, boss coins
    bosses.js                  the 6 weekly bosses: names, lines, drawings
    army.js                    the boss stage strip: minions that pop or giggle, the boss pop
    world.js                   the lobby's campus map: buildings, markers, the buddy, Campus or List
    guide.js, trail.js         the map's guide bubble; the zigzag lesson path on each game's home
    family.js                  her sister on the map: big-moment news, one-tap cheers, the cheer popup
    insights.js                the parent Focus tab: weakest lessons, missed questions, Fixed / Still missing
    parent-panel.js            the parent panel, shared by both lobbies and the phone page
    shop-requests.js           shop purchases waiting for a parent's OK, synced between devices
    firebase-remote.js         the Firestore side of cloud sync
    subjects.js                each grade's games for the phone page, which has no lobby cards (a test keeps it equal)
    fx.js                      sound effects (Web Audio) + streak call-outs; two sound packs, Happy Chimes (default) and Battle announcer
    study-kit.js               points, streaks, rounds, daily star reset (required by every game)
  world/                     the 3D world: grade-5.html, grade-2.html and world-main.js, which loads the rest
                               (layout, build, move, rides, stalls, pets, playmates, games, loot, sounds…)
  parent/                    the parent page for the phone (sign in, PIN, pick a child)
  vendor/three/              Three.js for the 3D world
  assets/icons/              home-screen icons
  assets/sounds/             Battle announcer voice clips; kids/ holds the Happy Chimes clips; world/ holds the 3D world's sounds
  sw.js                      offline cache (service worker)
  *.html, grade 2/*.html     redirects from the old addresses
sources/<grade>/<subject>/   the lesson decks the games were built from, and their text extractions (not in git: teacher and student names; keep your own backup)
tools/update-precache.js     lists every file under web/ in the offline cache (and rebuilds world/lesson-files.js)
tools/world-sounds.js        makes the 3D world's sound clips
tools/kid-sounds.js          makes the Happy Chimes clips (original, generated: node tools/kid-sounds.js)
firebase/firestore.rules     who may read and write the cloud copy (paste into Firebase → Firestore → Rules)
tests/                       unit tests (node:test) and headless-Chrome end-to-end tests
  paths.js                   where every page lives (games are found through their subject.json)
  content.js                 loads a game's lesson files the way the browser does
docs/                        design specs, plans and handoff notes
.github/workflows/pages.yml  runs the unit tests, then publishes web/
```

The engine files serve both grades. Each page says which grade it is with `data-grade` on the script tag (`<script src="../../../engine/wallet.js" data-grade="grade5">`), and every grade keeps its own storage keys.

Every page checks that its engine files loaded and shows a red **Missing or broken file** bar if one didn't. A game needs `study-kit.js` to play; the other engine files are optional extras.

Subject folders are named after the subject (`math`, `english`, `araling-panlipunan`…), not the game, and grades are `grade-2` … `grade-12`. Each game's internal ID (`math-mastery`, `block-bot`…) is saved in study history and must never change; it lives in the game's `subject.json`.

The source lesson decks (PDF/PPTX), photos, scans and their `.md` extractions are deliberately not in the repo; see `.gitignore`. They go in `sources/<grade>/<subject>/` on the owner's machine only.

The long-term plan (shared engine, lessons as data, learner profiles, database) is in `docs/superpowers/specs/2026-10-02-project-structure-design.md`.

## Running locally

Open `web/lobby/grade-5.html` or `web/lobby/grade-2.html` directly in a browser. No server is needed.

## Tests

Requires Node.js 18+ and Google Chrome (or Microsoft Edge) for the end-to-end tests.

```bash
node --test                          # unit tests (run from the repo root)
node tests/e2e/apps-e2e.js           # play every Grade 2 game in headless Chrome
node tests/e2e/apps-e2e.js 5         # play every Grade 5 game
node tests/e2e/lobby-e2e.js [5]      # lobby, parent panel and shop
node tests/e2e/account-e2e.js        # start page: create account, add children with their grade, pick one; Account view: change password and PIN (the lobby wants the new PIN); play without an account; forgot password
node tests/e2e/backdrop-e2e.js       # start page backdrop: both towns draw with kids and pets, buttons work through the iframe, page unchanged without 3D
node tests/e2e/english-first-e2e.js  # Grade 2 shows English only with the 🇵🇭 Filipino switch off, Filipino returns with it on, Filipino and Makabansa keep both
node tests/e2e/sisters-e2e.js        # her sister's buddy, card, cheers and the cheer popup
node tests/e2e/guide-e2e.js          # guide bubble on the map; lesson path, toggle, search and ?lesson= in games
node tests/e2e/world-e2e.js          # 3D world: maker, doors, 🏠 back, quick travel, medals, markers, Mimi's trail, fort, shop and back, buddies, Ask me!, the pet teacher after a wrong answer, gifts and monsters (coins, a found item, a helper), playmates (talk, questions, invite), playground games (tag with the red edge, hide-and-seek with her eyes covered, disguise and Boo!, a friend asking, her sister playing), Patintero (run, be tagged, guard the middle line, tag back), Hoot, Bunny, trees, Jesus's greeting and comfort, sister cheers, rides (looping until Stop, the slide one run), the 10-minute nudge stopping a ride, sprint, wheel and pinch zoom, the boss at the fort and his finale, Lola Lana's boutique (try-on, buy) and the mirror's wardrobe tabs, Mang Kiko's pet stall (try, buy, pat, treat, sleep, tricks, fetch) and the mirror's Pet tab, Kuya Pilo's toy stall (props, emotes), My Room (go in, Decorate: place, move, turn, put away, buy; Tito Tasyo's workshop; the desk; a trophy; growing with medals and earned pieces; her sister's room, view only, and a cheer), world sounds
node tests/e2e/nav-e2e.js            # top bar: Back, Home, Menu and the leave-the-quiz check
node tests/e2e/search-e2e.js         # lesson search: filter, nothing-found line, redraw, clear, Enter
node tests/e2e/read-gate-e2e.js      # reviewer lock: Start Quiz waits until every card was shown
node tests/e2e/backup-e2e.js [5]     # export → wipe → import → restore
node tests/e2e/file-check-e2e.js     # missing engine-file banner
node tests/e2e/migration-e2e.js      # a tablet saved before learner profiles keeps its points, coins and stars
```

The end-to-end tests inject a driver into a copy of each page. The driver plays every lesson perfectly and all-wrong, uses power-ups, and checks points, streaks, history and coins.

The unit tests also check the quiz content itself. For example: every wrong option has an explanation, true/false answers are balanced, and the English helpers are complete.

## Adding content

- Each lesson is its own file in `lessons/`, for example `web/subjects/grade-5/science/lessons/19-plants.js`, containing `StudyKit.lesson({ ... })`. The page loads them with one `<script src="lessons/…">` tag each, in number order.
- To add a lesson: copy a lesson file from the same game (each game family has its own question format), give it the next number, add its script tag after the last lesson tag, then run `node tools/update-precache.js`.
- New questions need an explanation for each wrong option (`why`) and a tip (`tip`); the tests enforce this.
- Math Mastery's lessons generate fresh numbers each time, so they stay in its page; its case studies and walkthroughs are data files.
- Keep the correct answer from usually being the longest option, and keep true/false answers roughly half and half.
- Follow the class deck's wording and facts, even where an outside source says something different.

**A new subject or grade** (for example Grade 6 Math):

1. Put the game at `web/subjects/grade-6/math/index.html`, loading the engine as `../../../engine/<file>.js` with `data-grade="grade6"` (`study-kit.js` last). Start it with `const kit = StudyKit.start({ app, title, pointsKey, progressKey })` and score every answer with `kit.answer(correct, { helped, exam })`.
2. Add `subject.json` next to it with a new, permanent `id`, plus `title`, `grade`, `subject`, `pointsKey` and `progressKey`. The tests find the game through this file.
3. Add a subject card to the lobby: `<a class="subject-card" data-app="<id>" href="../subjects/grade-6/math/index.html?reset=1">`.
4. Give it a Review round: `reviewInfo`, `reviewPool`, `startReview`, the `Recall.homeCard` card, the `currentQuizMeta.id === 'review'` retry line and the `Recall.tidy` / `Recall.wantsReview` lines at the end of its script (copy them from a game of the same family; `tests/review-wiring.test.js` checks them).
5. Give it medals: `medalLessons`, `updateMedals`, `showMedals`, `medalBadge`, the `Mastery.renderChip(medals)` line in `renderHome`, `showMedals(...'points-earned')` after the round's points line and `showMedals(...'points-total-badge')` before the first `renderHome()`, and load `quests.js` after `mastery.js` so quest events join the medal popup (copy them from a game of the same family; `tests/mastery-wiring.test.js` checks them).
6. Let it play boss stages: load `boss.js` after `quests.js`, give `startReview` the `boss` flag, and add the `bossEvents` / `bossAgain` helpers, the `var boss = bossEvents(el);` first line and `.concat(boss)` in `showMedals` and the `Boss.wantsBoss` line after the review check (copy them from a game of the same family; `tests/boss-wiring.test.js` checks them).
7. Give it the boss army: load `bosses.js` and `army.js` (`data-grade`) after `boss.js`, and add the `window.Army && (boss ? Army.start(...) : Army.stop());` line after `showScreen(...)` in `startReview` (`tests/army-wiring.test.js` checks them).
8. Give it a building in the 3D world: add an entry to `APPS.gradeN` in `web/world/layout.js` (app id, folder, emoji, sign with the subject name, colours, roof shape), in the lobby's order. `tests/world3d-layout.test.js` fails until it has one.
9. Run `node tools/update-precache.js` so it works offline. `node --test` lists anything you missed.
10. Put the source decks in `sources/grade-6/math/`.

## Deployment

Pushing to `main` runs `.github/workflows/pages.yml`: it runs the unit tests and, if they pass, publishes the `web/` folder to GitHub Pages. Both lobbies update within a minute or two. A failing test blocks the publish, so the live site keeps its last good version.

One-time setup: GitHub → repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
