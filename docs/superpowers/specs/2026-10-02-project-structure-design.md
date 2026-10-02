# Project structure for the long run

Date: 2026-10-02
Status: approved. Phase 1 done 2026-10-02 (250 unit tests + all e2e green). Phases 2–5 are open.

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
