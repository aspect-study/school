# Project structure for the long run

Date: 2026-10-02
Status: approved. Phases 1–4 done 2026-10-02. Phase 5a (storage + outbox) and 5b (Firebase sync) built 2026-10-02 (385 unit tests + all e2e green); 5c (parent view) is next. See 2026-10-02-cloud-sync-design.md.

## Why

The project will be maintained until both learners graduate (Grade 2 → Grade 12, about 10 years).
The current layout breaks down along three lines long before it runs out of folders:

| Today | Problem as it grows | Direction |
|---|---|---|
| Each game is one 1,000–4,000-line HTML file: content, engine and UI mixed | The engine is copy-pasted into every game; around 40 games later, a fix means 40 edits | One engine, content as data |
| Wallet, history and recall are keyed by grade (`grade5_*`, `grade2_*`) | Each June a learner moves up a grade and her coins and history are stranded | Learner profiles; grade is a changing attribute |
| `localStorage` is called directly everywhere | Adding a database touches every file | One storage module |

There's also a deliberate non-change: **plain HTML + JS, no framework, no build step.** Over 10 years, avoiding dependency churn matters more than having a framework. Native ES modules give clean, split-up files without a bundler when the engine is extracted.

## Target structure

```
school/
├─ web/                        the only folder that is deployed
│  ├─ index.html               "Who's studying?" picks the learner
│  ├─ sw.js                    service worker at the site root (covers every page)
│  ├─ engine/                  one copy of the shared runtime
│  │  ├─ (phase 1) fx.js powerups.js recall.js study-history.js wallet.js
│  │  ├─ (phase 2) game.js scoring.js styles/
│  │  └─ (phase 5) storage.js  only file that knows about localStorage / the database
│  ├─ lobby/                   lobby page(s)
│  ├─ subjects/<grade>/<subject>/
│  │  ├─ (phase 1) index.html  the game, unchanged inside
│  │  └─ (phase 3) subject.json + lessons/NN-name.js, rendered by one play page
│  ├─ assets/icons/ assets/art/
│  └─ <old URLs>               tiny redirect pages so installed icons and bookmarks keep working
├─ sources/<grade>/<subject>/  teacher decks as .md (PDF/PPTX/scans stay git-ignored)
├─ tools/                      conversion scripts, lesson template, question checker
├─ tests/                      unit, content and e2e tests; tests/paths.js is the one map of where things live
├─ server/ or supabase/        later, once the database is chosen
├─ docs/                       decisions/, specs/, plans/, prompts/
└─ .github/workflows/pages.yml publishes web/ to GitHub Pages
```

Naming: `grade-2`, `grade-5`, …, `grade-12` (lowercase, hyphen, no spaces). Subject folders use the subject name, not the game's brand name, because the brand can change while the subject doesn't:

| Grade 5 game | Folder | Grade 2 game | Folder |
|---|---|---|---|
| Math Mastery | `math` | Block Bot | `math` |
| Page Turners | `english` | Word Train | `english` |
| Wikaharian | `filipino` | Kuwentista | `filipino` |
| History Explorers | `araling-panlipunan` | Batang Bayani | `makabansa` |
| Life Lab | `science` | Science Detectives | `science` |
| Rise & Shine | `gmrc` | Growing Good | `gmrc` |
| Rally Ready | `pe-health` | Byte Buddies | `computer` |
| Craft Corner | `tle` | | |

The internal app IDs (`math-mastery`, `block-bot`, …) are stored in study history and recall keys. **They do not change.**

## Phases

Each phase ships on its own, and the site keeps working between phases.

1. **Folder move** (this spec, detailed below).
2. **Shared engine.** Extract the copy-pasted quiz/points/streak code into `web/engine/`, one game family at a time, with the e2e tests proving behavior is unchanged.
3. **Content as data.** Move each game's `LESSONS` into `web/subjects/<grade>/<subject>/lessons/`, add `subject.json`, use a single `play.html`, and add `tests/content/` checks.
4. **Learner profiles.** Replace grade-keyed wallets and history with learner-keyed ones, plus a one-time migration. `index.html` becomes the learner picker.
5. **Storage module, then the database.** `engine/storage.js` first, then `server/` or `supabase/`.

## Phase 1: folder move

### Moves

Site:

| From | To |
|---|---|
| `lobby-grade5.html` | `web/lobby/grade-5.html` |
| `grade 2/lobby.html` | `web/lobby/grade-2.html` |
| `manifest-grade5.webmanifest` | `web/lobby/grade-5.webmanifest` |
| `grade 2/manifest-grade2.webmanifest` | `web/lobby/grade-2.webmanifest` |
| `<grade-5 game>.html` | `web/subjects/grade-5/<subject>/index.html` |
| `grade 2/<game>.html` | `web/subjects/grade-2/<subject>/index.html` |
| `fx.js powerups.js recall.js study-history.js wallet.js` | `web/engine/` (one copy each) |
| `grade 2/*-grade2.js` | deleted (they were byte-identical copies) |
| `icons/` | `web/assets/icons/` |
| `sw.js` | `web/sw.js` |
| `.nojekyll` | deleted (the Actions deploy does not run Jekyll) |

Sources (including the git-ignored PDFs/PPTX inside them):

| From | To |
|---|---|
| `math/ english/ filipino/ gmrc/ computer/ science/` | `sources/grade-2/<same>/` |
| `makabansa/` and `md/` (Makabansa weeks 1–4) | `sources/grade-2/makabansa/` (`md/` merges into it) |
| `desktop-activity-voiceover.md` | `sources/grade-2/computer/` |
| `math-grade5/ english-grade5/ gmrc-grade5/ science-grade5/` | `sources/grade-5/<subject>/` |
| `ap-grade5/` | `sources/grade-5/araling-panlipunan/` |
| `pe-grade5/`, `P.E - Script.txt` | `sources/grade-5/pe-health/` |
| `tle-grade 5/` | `sources/grade-5/tle/` |
| `grade5-score-released/` | `sources/grade-5/summative-tests/` |
| `study-app-generator-prompt.md` | `docs/` |

### Code changes

- **Script tags:** games use `../../../engine/<file>.js`, and lobbies use `../engine/<file>.js`. The `data-grade` attribute is unchanged; it's what tells a shared script which grade it serves.
- **Missing-file check:** the snippet in every page strips the folder before looking up the global (`file.replace(/^.*\//, '')`), and the message says to check the `engine` folder. It stays identical across all pages (test-enforced).
- **Lobby cards:** these get `data-app="<app id>"`. The Parent panel reads that instead of parsing the link's file name. Links point to `../subjects/<grade>/<subject>/index.html?reset=1`; the explicit `index.html` is needed so pages still work when opened as local files.
- **Manifests:** `id`/`start_url` point to the new lobby, `scope` is `../` (the site root, so games stay inside the installed app), and icon paths are updated.
- **Service worker:** registered from each lobby as `../sw.js` with scope `../`. `PRECACHE` lists every page, engine file, manifest, icon and redirect page. The cache name moves to `study-games-v2` so tablets drop the old cache.
- **Redirect pages:** at every old URL (`lobby-grade5.html`, the 8 root Grade 5 games, `grade 2/lobby.html` and the 7 Grade 2 games). Each one forwards with `location.replace(...)` and keeps `?query` and `#hash`, with a `<meta http-equiv="refresh">` and a link as fallback. They are precached, so an installed icon that opens an old URL still works offline.
- **`web/index.html`:** a minimal page with two buttons, Grade 5 and Grade 2. Phase 4 turns it into the learner picker.
- **Deploy:** `.github/workflows/pages.yml` uploads `web/` with `actions/upload-pages-artifact` and deploys it with `actions/deploy-pages`. **Manual step:** set GitHub → Settings → Pages → Source to "GitHub Actions". The live site is stale or broken between the push and that switch.

### What stays safe

- **Points, coins, stars, history, recall and power-ups.** `localStorage` belongs to the origin (`aspect-study.github.io`), not to a path, and the app IDs and storage keys don't change.
- **Installed home-screen icons.** They open the old URL, which redirects inside the same standalone app. On iOS that's the same web clip, so it keeps its storage.

### Tests

- New `tests/paths.js`: the single map of `WEB`, `ENGINE`, the lobbies, and every app (`{ id, grade, subject, file }`). Every test reads paths from it.
- `tests/copies.test.js` keeps only the two lobby-script checks. The five file-copy checks are removed because those copies no longer exist.
- `tests/pwa.test.js`: every `.html`, `.js` and `.webmanifest` under `web/` (except `sw.js`) must be in `PRECACHE`, and every precached file must exist.
- New `tests/redirects.test.js`: every old URL has a redirect page that points to an existing file and keeps query and hash.
- E2E: one staging helper copies a page into a temp folder at its real relative path, with `engine/` beside it, so relative script paths resolve exactly as they do on the site.
- Done when: the unit suite passes (237 baseline tests plus the new ones) and every e2e script passes for both grades.

### Out of scope for phase 1

Any change to the inside of a game (engine extraction, content split), learner profiles, storage, and the database.

### Later cleanup

The redirect pages can be deleted once every device has opened the new addresses, for example at the start of the next school year. When they are deleted, remove them from `REDIRECTS` in `tests/paths.js` and from `PRECACHE`.

Android caveat: a Grade 2 icon installed before the move had the scope `grade 2/`. Its redirect leads outside that scope, so Android shows a thin browser bar. Reinstalling from `lobby/grade-2.html` fixes it, and points and coins carry over because Android shares storage with Chrome.

## Phase 2, first slice: study-kit.js (done 2026-10-02)

`web/engine/study-kit.js` now owns what all 15 games had copied: the scoring rules (10 / 20 in the exam / +5 from 3 in a row), the halving and streak rules for helped answers, the Streak Shield check, Recall's say on points, the total and round points, the live counter, the "points this round" line, the daily star reset, and the `?reset=1` lobby visit.

- A game calls `const kit = StudyKit.start({ app, title, pointsKey, progressKey[, liveLabel][, liveSelector] })`, then `kit.answer(correct, { helped, exam })` per answer, plus `kit.startRound()`, `kit.resultLine()` / `kit.roundLine(what)`, `kit.totalPoints()`, `kit.progress()` / `kit.saveProgress(p)`.
- `{ shield: false }` marks answers that never had power-ups (Math Mastery walkthrough and case-study steps), so an unused Streak Shield is not spent there. This matches the old `awardPoint(ok)` behavior.
- `study-kit.js` is the one **required** engine file. The others stay optional, and the no-extras e2e run keeps checking that.
- Storage keys are unchanged, so existing points, stars and wallets carry over.

Still per game (later slices of phase 2): screens, question rendering, results, missed-question review and explore mode. Each still differs between families A/B/C/math, and moving them goes with phase 3 (content as data, one play page).

## Phase 3: content as data (done 2026-10-02)

The user chose **content only**: every game keeps its own screens and look, and a shared play page is not planned. Lesson content (75–85% of each game file) moved into data files:

- `subjects/<grade>/<subject>/lessons/NN-name.js` holds one lesson per file as `StudyKit.lesson({...})`. The name comes from the lesson `id`, or from its title when there is no id (family B tracks progress by position, so the number prefix keeps that order). The page loads them with one script tag each.
- `strategy.js`, `type-it.js` (and `cases.js`, `walkthroughs.js` for Math Mastery) hold `StudyKit.content(name, value)`. The page reads them with `StudyKit.lessons()` / `StudyKit.content(name)`.
- Files are `.js`, not `.json`, because pages opened straight from a file cannot fetch JSON.
- The files are **plain data**. They were made by running each page's own code (its `mc`/`tf` builders, picture builders and passage constants) and writing out the result, then checked to round-trip exactly. Builders used only by content were removed from the pages. Block Bot's one generator is named in its data (`generate: 'numberline'`) and resolved by the page. Math Mastery's lessons are generators, so they stay in its page.
- `subject.json` per game holds `id`, `title`, `grade`, `subject`, `pointsKey`, `progressKey`. `tests/paths.js` discovers games from these files, and `REDIRECTS` is now a fixed historical list.
- `tools/update-precache.js` rewrites the offline cache list. `tests/content.js` loads data files through the kit's real `library()`, and `tests/content.test.js` checks the tags match the files, the numbering, plain-data purity and that `subject.json` agrees with the page.

## Phase 4: learner profiles (done 2026-10-02)

User decisions: each child has her own device; names are set on the device (never in public code); after moving up, the lobby shows the new grade plus a Review section.

- **`web/engine/learner.js`** is loaded first on every page (`data-grade` = the page's grade). Each learner's profile is `learner/<id>/profile_v1` (`name`, `emoji`, `grade`). The device keeps only `learners_v1` = `{ current }`, and the list is found by scanning profiles, so a damaged device record cannot orphan a child.
- **Choosing the learner for a page:** the current learner if her grade matches. Otherwise a learner with that grade (and switch to her). Otherwise the current learner if her grade is higher (she is reviewing an earlier grade). Otherwise a new learner for that grade. `index.html` (no grade) never creates one: it goes to the current learner's lobby or shows the picker.
- **Scoped storage:** `Learner.storage` maps `k` to `learner/<id>/k`. It is passed to study-history, wallet, recall and study-kit, and the lobbies use it too. Their keys no longer contain the grade (`wallet_v1`, `recall_v1`, `history_v1`, `history_error_v1`, `history_corrupt_v1_*`, `last_backup_v1`, `coin_guide_seen_v1`); game keys are unchanged. `data-grade` now only picks the language. The mute setting stays per device.
- **Migration:** when no learner profile exists yet, legacy keys are grouped by grade (a frozen table of the 15 games that existed, test-checked against their `subject.json`), one learner is created per grade with data, and the keys are copied, not moved. It never runs again once any profile exists.
- **Backups:** export adds `learner: { name, emoji }` and uses the new key names. Import maps `gradeN_wallet_v1` / `gradeN_recall_v1` from older backups, and fills in her name if the device has none.
- **Parent panel → Learner:** name and emoji. The hero title greets her once a name is set.

### Waiting for the first Grade 6 lobby

- A "Move up to Grade N+1" button in Parent (it sets `profile.grade`), and the new lobby lists the earlier grade's games under **Review**. Their pages already save into her space through the review rule above.
- `wallet.js` / `recall.js` / `powerups.js` / `fx.js` TEXT and the coin guide need `grade6` entries (they are keyed by `data-grade`).
- Backup import checks `data.grade` against the page's grade. Restoring a Grade 5 backup in a Grade 6 lobby must be allowed for the same learner.
- The old global keys can be deleted in a later release, once every tablet has migrated.

## Phase 5a: storage module (done 2026-10-02)

`web/engine/storage.js` loads first on every page and is the only engine file that touches browser storage. `StudyStore.space(id)` is a learner's space (`learner/<id>/…`). Every save or delete through it is noted in that space's outbox (`sync_outbox_v1`: key → time; `sync_*` keys are never noted). `done(sent)` clears only what wasn't changed again. `learner.js` now builds on it, so migrated keys and profile changes are already in the outbox for the first cloud upload. Phase 5b (Firebase sync) and 5c (parent view) are designed in `2026-10-02-cloud-sync-design.md`.
