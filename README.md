# School Study Games

Study games for a Grade 2 and a Grade 5 learner. Each school subject has its own game with flashcards, quizzes and a mock exam, all written from the class's own lesson decks, textbook pages and past summative tests. There's also a points and coin system, which turns study time into rewards that a parent approves.

Everything is plain HTML and JavaScript: no build step, no server, no install. Open a lobby page in any modern browser (desktop, iPad or Android tablet) and play.

## Play

| Grade | Lobby |
|---|---|
| Grade 5 | <https://aspect-study.github.io/school/lobby-grade5.html> |
| Grade 2 | <https://aspect-study.github.io/school/grade%202/lobby.html> |

Tip: open the lobby on a tablet and use **Add to Home Screen** so it opens like an app.

## Subjects

### Grade 5 (English interface)

| Game | Subject | Lessons | Covers |
|---|---|---|---|
| `math-mastery.html` | Math | 11 | Divisibility, GEMDAS, fraction operations, ordering decimals, UPAC word problems, 10 case studies |
| `page-turners.html` | English | 23 | Story elements, figurative language, main idea, summarizing, author's purpose, nouns and pronouns, fact vs opinion and more |
| `wikaharian.html` | Filipino | 5 | Poetry, fiction, informative text patterns, actor focus, linkers |
| `history-explorers.html` | Araling Panlipunan | 14 | Origins of the Philippines, barangay, leaders and classes, trade, beliefs and traditions |
| `life-lab.html` | Science | 18 | Matter, measurement, scientific method, microorganisms, plant and animal groups |
| `rise-shine.html` | GMRC | 13 | Self, saving, dignity, faith, traffic rules, manners, gratitude, e-waste |
| `rally-ready.html` | P.E. & Health | 7 | Net and wall games, ABC skills, pickleball, managing stress |
| `craft-corner.html` | TLE | 9 | Home furnishings, embroidery, crochet, sewing |

The Filipino and Araling Panlipunan games keep the textbook's Filipino wording and add optional English help: card translations, a "Hindi maintindihan?" button on questions, and "Paano Sagutin?" tip cards.

### Grade 2 (Taglish interface, in `grade 2/`)

| Game | Subject | Covers |
|---|---|---|
| `block-bot.html` | Math | Numbers, place value, number lines, Philippine money (drawn in SVG) |
| `kuwentista.html` | Filipino | Alpabeto, pang-uri, kongkreto at di-kongkreto, pangungusap at parirala, sight words |
| `word-train.html` | English | Alphabet, onset and rime, CVC words, nouns, pronouns, verbs, adjectives, sentences, intonation, sequencing |
| `batang-bayani.html` | Makabansa | Komunidad, klima, mapa, mga tungkulin |
| `growing-good.html` | GMRC | Family, feelings, prayer, saving, obeying, talents |
| `byte-buddies.html` | Computer | Computer care, parts, the desktop, the Internet |
| `science-detectives.html` | Science | Body, senses, objects, animals, habitats |

## How a game works

- **Flashcards** for each lesson, then a **10-question quiz** (multiple choice, true/false, picture and number-line questions).
- A **Final Mock Exam** mixes questions from every lesson.
- An **Exam Strategy** page has subject-specific test-taking tips, including the "trap" patterns real tests use.
- **Learn from mistakes:** after a wrong answer, the game explains why that choice is wrong, what the right answer is, and gives a tip for next time.
- **Explore other answers:** after answering, tap any other choice to see why it is or isn't right. This never affects the score.
- **Stars** (up to 3 per lesson) reset each day. **Points** are permanent.

## Rewards

| Rule | Value |
|---|---|
| Correct answer | 10 points (20 in the mock exam) |
| Streak bonus | +5 per answer once 3 in a row are right |
| Type it first ✏️ | +5 for typing the answer before seeing the choices |
| Question rest ⏳ | A question answered right without help pays 0 for 3 days, so replaying a memorized quiz doesn't farm points |
| Coins 🪙 | 1 coin per 10 new points, plus a 40-coin welcome gift |
| Real test bonus 📝 | A parent enters a school test score: 50 / 40 / 30 / 10 coins for 100% / ≥90% / ≥80% / below |

**Shop:** the lobby has a reward shop for real-life rewards (the catalog is in `wallet.js`). A parent approves each purchase with a PIN.

**Power-ups:** inside a quiz, coins buy Hint, 50/50, Second Chance, Shield, Later and Ask Family.

Each grade has its own separate wallet.

## Parent panel

Tap **🔒 Parent** in a lobby and enter the PIN:

- **Study history:** every app opened, lesson viewed and quiz taken, with score, time, power-ups used and each wrong answer (what was picked vs the right answer). Filter by date range and subject.
- **Needs practice:** lessons under 80% right, weakest first.
- **Real test score:** add bonus coins for a school test.
- **Full backup:** export or import a `.json` file holding the history, points, coins and question rest-days. Import shows the backup's points and coins next to the device's and asks before replacing them. The 🔒 Parent button shows **💾 backup due** when the last backup is more than 7 days old.
- Spreadsheet (`.csv`) export of the history and of shop purchases.

## Where data is stored

All progress lives in the browser's `localStorage` on each device. There's no account and no server, and nothing is sent anywhere. That means:

- Each device (and each website address) has its own data. Use **Export full backup / Import backup** to move it.
- Clearing the browser's site data erases progress, so keep a recent backup off the device.
- On iPad, a Home Screen app has storage separate from Safari.

## Project layout

```
lobby-grade5.html        Grade 5 lobby (subject cards, shop, parent panel)
*.html                   Grade 5 games
study-history.js         shared: study history + backup
wallet.js                shared: points → coins, shop catalog, coin guide
powerups.js              shared: in-quiz power-ups
recall.js                shared: question rest + type-it-first
fx.js                    shared: sound effects + streak call-outs (Web Audio)
grade 2/                 Grade 2 lobby, games and *-grade2.js copies of the shared files
tests/                   unit tests (node:test) and headless-Chrome end-to-end tests
docs/superpowers/        design specs, plans and handoff notes
*/md/                    text extracted from the lesson decks the games were built from
```

Each shared file has a Grade 2 copy (for example `grade 2/wallet-grade2.js`), and the two must stay byte-identical. **Edit the Grade 2 copy, then copy it over the root file.** `tests/copies.test.js` fails if they differ.

Every page checks that its shared files loaded and shows a red **Missing or broken file** bar if one didn't.

The source lesson decks (PDF/PPTX), photos and scans are deliberately not in the repo; see `.gitignore`.

## Running locally

Open `lobby-grade5.html` or `grade 2/lobby.html` directly in a browser. No server is needed.

## Tests

Requires Node.js 18+ and Google Chrome (or Microsoft Edge) for the end-to-end tests.

```bash
node --test                          # unit tests (run from the repo root)
node tests/e2e/apps-e2e.js           # play every Grade 2 game in headless Chrome
node tests/e2e/apps-e2e.js 5         # play every Grade 5 game
node tests/e2e/lobby-e2e.js [5]      # lobby, parent panel and shop
node tests/e2e/backup-e2e.js [5]     # export → wipe → import → restore
node tests/e2e/file-check-e2e.js     # missing shared-file banner
```

The end-to-end tests inject a driver into a copy of each page. The driver plays every lesson perfectly and all-wrong, uses power-ups, and checks points, streaks, history and coins.

The unit tests also check the quiz content itself. For example: every wrong option has an explanation, true/false answers are balanced, and the English helpers are complete.

## Adding content

- Quiz content is a `LESSONS` array inside each game. New questions need an explanation for each wrong option (`why`) and a tip (`tip`); the tests enforce this.
- Keep the correct answer from usually being the longest option, and keep true/false answers roughly half and half.
- Follow the class deck's wording and facts, even where an outside source says something different.

## Deployment

The site is published with GitHub Pages from the `main` branch, root folder. Pushing to `main` updates both lobbies within a minute or two.
