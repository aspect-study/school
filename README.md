# School Study Games

Study games for a Grade 2 and a Grade 5 learner. Each school subject has its own game with flashcards, quizzes and a mock exam, all written from the class's own lesson decks, textbook pages and past summative tests. There's also a points and coin system, which turns study time into rewards that a parent approves.

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
| Wikaharian (`filipino/`) | Filipino | 5 | Poetry, fiction, informative text patterns, actor focus, linkers |
| History Explorers (`araling-panlipunan/`) | Araling Panlipunan | 14 | Origins of the Philippines, barangay, leaders and classes, trade, beliefs and traditions |
| Life Lab (`science/`) | Science | 18 | Matter, measurement, scientific method, microorganisms, plant and animal groups |
| Rise & Shine (`gmrc/`) | GMRC | 13 | Self, saving, dignity, faith, traffic rules, manners, gratitude, e-waste |
| Rally Ready (`pe-health/`) | P.E. & Health | 7 | Net and wall games, ABC skills, pickleball, managing stress |
| Craft Corner (`tle/`) | TLE | 9 | Home furnishings, embroidery, crochet, sewing |

The Filipino and Araling Panlipunan games keep the textbook's Filipino wording and add optional English help: card translations, a "Hindi maintindihan?" button on questions, and "Paano Sagutin?" tip cards.

### Grade 2 (Taglish interface)

| Game | Subject | Covers |
|---|---|---|
| Block Bot (`math/`) | Math | Numbers, place value, number lines, Philippine money (drawn in SVG) |
| Kuwentista (`filipino/`) | Filipino | Alpabeto, pang-uri, kongkreto at di-kongkreto, pangungusap at parirala, sight words |
| Word Train (`english/`) | English | Alphabet, onset and rime, CVC words, nouns, pronouns, verbs, adjectives, sentences, intonation, sequencing |
| Batang Bayani (`makabansa/`) | Makabansa | Komunidad, klima, mapa, mga tungkulin |
| Growing Good (`gmrc/`) | GMRC | Family, feelings, prayer, saving, obeying, talents |
| Byte Buddies (`computer/`) | Computer | Computer care, parts, the desktop, the Internet |
| Science Detectives (`science/`) | Science | Body, senses, objects, animals, habitats |

## How a game works

- **Flashcards** for each lesson, then a **10-question quiz** (multiple choice, true/false, picture and number-line questions).
- A **Final Mock Exam** mixes questions from every lesson.
- An **Exam Strategy** page has subject-specific test-taking tips, including the "trap" patterns real tests use.
- **Learn from mistakes:** after a wrong answer, the game explains why that choice is wrong, what the right answer is, and gives a tip for next time.
- **Explore other answers:** after answering, tap any other choice to see why it is or isn't right. This never affects the score.
- **Stars** (up to 3 per lesson) reset each day. **Points** are permanent.
- **Medals** (🥉 Bronze, 🥈 Silver, 🥇 Gold) need every question in a lesson right on 1, 2 and 3 separate days. They never go away; a 🔧 shows when a lesson needs a polish. A new medal pays 20, 40 or 80 points once. The lobby's **🗺️ My Map** shows every lesson's medal.
- **Celebrations:** a short popup cheers a new medal, a whole game reaching Bronze, Silver or Gold, and fixed mistakes, with what she did and one next step. It waits for PERFECT!, closes with a tap or by itself, follows the mute key and the tablet's reduce-motion setting.
- **Daily quests:** the lobby offers 3 quests a day fitted to her (a Review that is due, her weakest recent lesson, and a rotating one), never the same twice in a row when there is another choice. All 3 pay 3 coins once a day. The **streak** counts days with at least one quest and survives 2 rest days in any 7; it pays 5, 10, 15 and 20 coins at 7, 14, 30 and 60 days. It never talks about losing a streak.

## Rewards

| Rule | Value |
|---|---|
| Correct answer | 10 points (20 in the mock exam) |
| Streak bonus | +5 per answer once 3 in a row are right |
| Type it first ✏️ | +5 for typing the answer before seeing the choices |
| Question rest ⏳ | A question answered right without help pays 0 for 3 days, so replaying a memorized quiz doesn't farm points |
| Coins 🪙 | 1 coin per 10 new points, plus a 40-coin welcome gift |
| Real test bonus 📝 | A parent enters a school test score: 50 / 40 / 30 / 10 coins for 100% / ≥90% / ≥80% / below |

**Shop:** the lobby has a reward shop for real-life rewards (the catalog is in `web/engine/wallet.js`). A parent approves each purchase with a PIN.

**Power-ups:** inside a quiz, coins buy Hint, 50/50, Second Chance, Shield, Later and Ask Family.

Each grade has its own separate wallet.

## Parent panel

Tap **🔒 Parent** in a lobby and enter the PIN:

- **Learner:** her name and emoji. The lobby then greets her ("🌻 Hi, Ana!"). The name stays on the tablet and in her backups, never on the website.
- **Study history:** every app opened, lesson viewed and quiz taken, with score, time, power-ups used and each wrong answer (what was picked vs the right answer). Filter by date range and subject.
- **Needs practice:** lessons under 80% right, weakest first.
- **Real test score:** add bonus coins for a school test.
- **Cloud backup:** sign in once per device with the family login (email + password). The lobby then backs up to Firebase on its own and keeps her other devices in sync: when the lobby opens, every 2 minutes, and when the device comes back online. A new or wiped tablet signs in, taps the child, and everything comes back. See `docs/superpowers/specs/2026-10-02-cloud-sync-design.md`.
- **Full backup:** export or import a `.json` file holding the history, points, coins, question rest-days and her name. Backups made before learner profiles still import. Import shows the backup's points and coins next to the device's and asks before replacing them. The 🔒 Parent button shows **💾 backup due** when the last backup is more than 7 days old.
- Spreadsheet (`.csv`) export of the history and of shop purchases.

## Where data is stored

All progress lives in the browser's `localStorage` on each device, and the device is always the main copy: the games never wait on the network. If a parent signs in under **Cloud backup**, the lobby also syncs it to the family's Firebase project (`study-game`), readable only with the family login (`firebase/firestore.rules`). Without signing in, nothing is sent anywhere. That means:

- Each device (and each website address) has its own data. Use **Export full backup / Import backup** to move it.
- Everything a child saves belongs to her **learner profile**: it is stored under `learner/<id>/…`, not under a grade. Her coins, history and stars stay with her when she moves up a grade, and a younger sibling who later plays the same game on the same device starts fresh. `web/engine/learner.js` owns this.
- The device remembers its child, so `index.html` goes straight to her lobby. A new device asks for the grade once.
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
    sync-core.js               cloud sync merge rules (lobbies only)
    firebase-config.js         the family's Firebase project; public by design
    cloud.js                   Firebase sign-in, the Cloud backup panel and sync timing (lobbies only)
    study-history.js           study history + backup
    wallet.js                  points → coins, shop catalog, coin guide
    powerups.js                in-quiz power-ups
    recall.js                  review boxes (1/3/7/14/30 days), Review rounds, type-it-first
    mastery.js                 lesson medals (🥉🥈🥇 from the review boxes), the lobby map, medal points
    quests.js                  daily quests, the gentle streak, quest and streak coins
    fx.js                      sound effects + streak call-outs (Web Audio)
    study-kit.js               points, streaks, rounds, daily star reset (required by every game)
  assets/icons/              home-screen icons
  sw.js                      offline cache (service worker)
  *.html, grade 2/*.html     redirects from the old addresses
sources/<grade>/<subject>/   text extracted from the lesson decks the games were built from
tools/update-precache.js     lists every file under web/ in the offline cache
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

The source lesson decks (PDF/PPTX), photos and scans are deliberately not in the repo; see `.gitignore`. They go in `sources/<grade>/<subject>/` next to their `.md` extractions.

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
6. Run `node tools/update-precache.js` so it works offline. `node --test` lists anything you missed.
7. Put the source decks in `sources/grade-6/math/`.

## Deployment

Pushing to `main` runs `.github/workflows/pages.yml`: it runs the unit tests and, if they pass, publishes the `web/` folder to GitHub Pages. Both lobbies update within a minute or two. A failing test blocks the publish, so the live site keeps its last good version.

One-time setup: GitHub → repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
