# Grade 2 Study History — Design

Date: 2026-09-28
Scope: `grade 2/` only (lobby + 7 apps). Grade 5 follows later with the same design.

## Goal

Let the parent see, with date and time, what the child reviewed and how she did in
every Grade 2 study game on that device. The history is permanent: nothing removes
it except a PIN-protected delete in the lobby.

## Constraints

- Each child has her own device (Windows laptops with Chrome/Edge, and tablets/phones).
  History is per-device. No syncing, no hosting.
- Pages are opened from local files. All Grade 2 pages already share browser storage
  (the lobby's combined points total proves this on both device types).
- A web page cannot silently write to a file on a tablet, so files are used only for
  manual Export/Import backups.
- `?reset=1` (lobby entry) wipes stars. It must never touch history.

## Architecture

One new shared script, `grade 2/study-history.js`, loaded by all 7 apps and the lobby:

```html
<script src="study-history.js"></script>
```

It exposes a single global, `StudyHistory`. Every call site in the apps is guarded
so a missing script never breaks a game:

```js
var SH = window.StudyHistory;
SH && SH.quizStarted(...);
```

The file must be copied to each device alongside the HTML files.

## Storage

- Key: `grade2_history_v1` in `localStorage`.
- Value: `{ "v": 1, "entries": [ ... ] }`, oldest first.
- Every write is read–modify–write of the whole value, wrapped in `try/catch`.
- On a failed write (storage full), the entry is dropped and a small marker key
  `grade2_history_error_v1` is set with the time. The lobby shows a banner:
  "History storage is full — export and delete old entries." Nothing is ever
  deleted automatically.
- Expected size: ~1 KB per quiz, under ~1 MB for a year of daily use.

### Entry shapes

Common fields on every entry:

| field | meaning |
|---|---|
| `id` | unique: start time in ms + random suffix, used for import de-duplication |
| `type` | `open`, `lesson` or `quiz` |
| `app` | slug, e.g. `kuwentista` |
| `appTitle` | display name, e.g. `Kuwentista` |
| `t` | start time, epoch ms (displayed in local time) |

`open` has no extra fields.

`lesson`:

| field | meaning |
|---|---|
| `lessonId`, `lessonTitle` | which lesson |
| `cardsTotal` | number of flashcards in the lesson |
| `cardsViewed` | highest card number reached (1-based) |
| `updatedAt` | last card view time |

`quiz`:

| field | meaning |
|---|---|
| `lessonId`, `lessonTitle` | lesson, or `final` / the app's review title for the Final Mock Exam |
| `final` | `true` for the Final Mock Exam |
| `total` | number of questions |
| `answered`, `correct` | running counts, updated after every answer |
| `wrong` | list of `{ q, picked, answer }`: question text, what she chose, correct answer |
| `finished` | `true` once the results screen is reached |
| `stars`, `points`, `bestStreak` | set on finish |
| `updatedAt` | time of the last answer or of finishing; time spent = `updatedAt - t` |

A quiz she quits halfway stays as `finished: false` and shows as
"Stopped at 4 of 10, 3 correct".

## `study-history.js` interface

Recording (called by the apps):

| call | returns | when |
|---|---|---|
| `appOpened(app, appTitle)` | — | inside the existing `?reset=1` block, i.e. entering from the lobby; a page refresh does not log a second open |
| `lessonOpened(app, appTitle, lessonId, lessonTitle, cardsTotal)` | entry id | lesson's flashcards are opened |
| `cardViewed(entryId, cardNumber)` | — | each flashcard render; keeps the maximum |
| `quizStarted(app, appTitle, lessonId, lessonTitle, isFinal, total)` | entry id | `startQuiz()` / `startFinalExam()` |
| `quizAnswered(entryId, isCorrect, q, picked, answer)` | — | each answer; `q/picked/answer` stored only when wrong |
| `quizFinished(entryId, stars, points, bestStreak)` | — | `finishQuiz()` |

Reading and managing (called by the lobby):

| call | purpose |
|---|---|
| `list(from, to, app)` | entries in range, newest first; `from`/`to` are dates, inclusive, `app` optional |
| `summary(entries)` | total study time, quiz count, average score, most-missed question |
| `deleteRange(from, to)` | removes entries whose `t` falls in the inclusive local-date range; both dates are required `YYYY-MM-DD` strings (anything else removes nothing); returns count |
| `deleteAll()` | removes the key; returns count |
| `exportJson()` / `exportCsv()` | returns file text |
| `importJson(text)` | merges by `id`, skips duplicates, returns count added; rejects files that are not `v: 1` history |
| `storageError()` | the full-storage marker, if set |

All text stored is plain text (HTML entities decoded by the app before the call,
as the apps already do for `missedQuestions`). The lobby renders it with
`textContent`, never `innerHTML`.

## App changes (all 7)

The apps come in two code styles; the hook points are the same five in each.

| hook | family A: `block-bot`, `kuwentista` | family B: `word-train`, `batang-bayani`, `growing-good`, `byte-buddies`, `science-detectives` |
|---|---|---|
| app opened | `?reset=1` block | `?reset=1` block |
| lesson opened | `openLesson(i)` | lesson `Start` button handler, before `showScreen('flash')` |
| card viewed | `renderCard()` | `renderFlash()` |
| quiz started | `startQuiz()`, `startFinalExam()` | `startQuiz()`, `startFinalExam()` |
| answer | `selectOption(idx)`; Block Bot also `checkNumberline()` (picked = typed number, answer = `start + jumps`) | the answer click handler that calls `showFeedback` and pushes `missedQuestions` |
| quiz finished | `finishQuiz()` | `finishQuiz()` |

Plus the `<script src="study-history.js"></script>` tag before each app's own script.
No lesson content, question, answer key, scoring or points logic changes.

## Lobby changes (`grade 2/lobby.html`)

### Entry and PIN

- A small, muted **🔒 Parent** link under the existing footer note.
- It opens a full-screen panel with a 4-digit PIN pad. The PIN is `0108`, a constant
  in the lobby source (enough to keep a 7-year-old out; anyone reading the file can see
  it). A wrong PIN shakes the dots and clears them, and she can retype straight away.
- Unlocked only while the panel is open. Closing the panel, pressing Escape, leaving the
  page, or switching apps / pressing Home on a tablet (`visibilitychange`) locks it again.
  The import file picker is exempt, so an import does not lock mid-way.
- If `window.StudyHistory` is missing, the panel shows
  "History file missing — copy study-history.js into the grade 2 folder."

### History panel

1. **Filters:** Today / Last 7 days / Last 30 days / All / custom From–To, and a subject
   picker (All + the 7 apps, built from the lobby's own subject cards). Default: Last 7
   days, All subjects.
2. **Summary strip** for the filtered entries: total study time, number of quizzes,
   average score, and the most-missed question (subject and question, with count).
3. **Timeline** grouped by day, newest first. Each row: time, icon, description.
   - 📂 `Opened Kuwentista`
   - 📖 `Pangngalan — viewed 6 of 8 cards`
   - ✏️ `Pangngalan quiz — 8/10 ⭐⭐ +95 pts · 4 min`, or
     `Final Mock Exam — stopped at 4 of 21, 3 correct`
   - A quiz row with wrong answers expands on tap to list each one:
     the question, ❌ what she picked, ✅ the correct answer.
4. **Backup:** two buttons, **Export backup** (`study-history-YYYY-MM-DD.json`) and
   **Export spreadsheet** (`study-history-YYYY-MM-DD.csv`). They are separate because
   browsers often block a second automatic download. Plus **Import** (file picker for a
   `.json` backup, reports "Added N entries, skipped M duplicates").
5. **Delete:** From–To date range with a confirm showing the count
   ("Delete 23 entries from Sep 1 – Sep 15?"), and a separate red **Delete everything**
   button with its own confirm.

CSV columns: Date, Time, Subject, Type, Lesson, Score, Answered, Stars, Points, Minutes,
Cards viewed, Finished, Wrong answers (one cell, `question → picked (correct: answer)`
joined with ` | `). Scores and cards are written `8 of 10`, never `8/10`, because
spreadsheets turn `8/10` into a date. The file starts with a UTF-8 BOM so Excel shows
Filipino characters correctly.

The panel follows the lobby's existing fonts and colors, works at phone width, and
is 3-up-rule exempt (it is a single-column list).

## Error handling

- Missing script: games play normally and record nothing; lobby shows the missing-file message.
- Corrupt stored value (unparseable JSON): treated as empty for reads. Before the next
  write, the raw value is copied to `grade2_history_corrupt_v1_<time>`, and recording
  then starts fresh. If that copy cannot be made, the write is refused and the corrupt
  value is left in place, so nothing is lost silently.
- Storage full: see Storage above.
- Import of a wrong file: rejected with a message, existing history untouched.
- Malformed entries (from a hand-edited or damaged backup): every reader and the lobby
  timeline skip or tolerate them, and none of them can throw into a game or the panel.
  Reads never write, so corrupt data is copied aside only once, on the next write.

## Testing

Headless Chrome driver on copies of the files (the method already used for points):

1. Enter each app via `?reset=1`: one `open` entry; refresh adds none.
2. Open a lesson and step through 5 of 8 cards: `cardsViewed = 5`.
3. Play a lesson perfectly, all-wrong, and mixed: counts, `wrong` list (question,
   picked, answer), stars, points and `finished` match the app's own results screen.
4. Quit mid-quiz: entry stays with `finished: false` and correct partial counts.
5. Final Mock Exam logs with `final: true`.
6. Block Bot number-line wrong answer logs the typed number and `start + jumps`.
7. `?reset=1` clears progress and leaves `grade2_history_v1` byte-identical.
8. Lobby: wrong PIN stays locked; 0108 opens; closing relocks.
9. `deleteRange` removes exactly the entries inside the inclusive range; `deleteAll` empties.
10. Export → deleteAll → Import restores identical entries; importing twice adds 0.
11. Remove `study-history.js`: every app still plays to the results screen with no console errors.
12. Existing points and results remain unchanged (perfect play = `10n + 5·max(0, n−2)`).

## Out of scope

- Grade 5 lobby and apps (same design, later).
- Syncing between devices, or live writing to a file.
- Changing the PIN from the UI.
