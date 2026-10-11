# Original lesson writing: design

Date: 2026-10-11. Status: approved in brainstorming, plan next.

## Why

Lessons are built from teacher decks, textbook scans and summative tests, which are copyrighted. Since the family
account (2026-10-09) anyone can register, so lesson text is published. From now on lessons keep the source's facts,
terms and learning targets but every sentence is written fresh. Existing lessons are audited after the new rules are
in place, rewriting only text that copies a source.

Order: (1) the rules and the checker, used for every new lesson; (2) the audit of existing lessons, one game per step.

## Part 1: Writing rules

The line "follow the class deck's wording and facts" (in `CLAUDE.md` and `README.md`) becomes **"follow the class
deck's facts and terms; write every sentence fresh."** The full rules live in a new `docs/lesson-writing.md`.

### Kept exactly as the source has it

- Facts, answer keys, real names (people, places, events, laws, books, authors), dates and numbers that are facts.
- Subject terms and their spelling (Batas, Komunidad, Hardware, Software, kongkreto, pantukoy, presser foot).
- The order of steps or lists the deck teaches, when a test could ask for it.
- Source conflicts are handled as today (deck wins; ask the owner when an existing answer key would flip).

### Written new

- Every sentence of cards, questions, options, `explain`, `why`, `tip` and their English halves. Allowed repeats are
  short unavoidable phrases only: a term, a name, a title, a list of terms, or a definition's core phrase of a few
  words (e.g. "Ang **komunidad** ay pangkat ng mga tao…" with the rest of the sentence new).
- Invented people and scenes use the play-world cast first (Lola Lana, Kuya Pilo, Tito Tasyo, Mang Kiko, Mayor Mimi,
  Professor Hoot, Bunny; the playmate kids Migo, Bea, Luna, Tomas, Jun; their pets Tagpi the puppy, Lila the bunny,
  Kidlat the fox, Pandesal the hamster, Mingming the kitten — pets may appear as pets, never as people) and everyday
  Filipino names to fill in (Aling Nena, Mang Ben, Paolo…). Adults (Lola Lana, Kuya Pilo, Tito Tasyo, Mang Kiko, Mayor
  Mimi, Professor Hoot) play adult roles; students are the kids or everyday names. Family words (Nanay, Tatay, Lolo, Ate, Kuya) are used
  generically. The sisters' real names never appear in lesson text.
- **Math:** new numbers and a new story; the same concept, number of steps, digit counts, regrouping or borrowing,
  decimal places and fraction type. Every new answer is computed twice, and `explain` follows the source's method.
- **Stories** (class reading passages and story slides): an original passage carries the skill practice (sequence,
  main idea, cause and effect, inference, character traits). A 📖 summary card in our own words covers the class story
  itself: title, author, who, what happened, its lesson. Nothing is quoted; questions about the class story ask about
  events and meaning, not wording.

### Kept the same in each question

- The learning target and the thinking level: an apply or analyse question stays apply or analyse ("Which shows…",
  "What would happen if…", "Why…"), never shrinks to recall.
- The question type (multiple choice, Tama/Mali, type-it, matching) and roughly the number of options.
- All current rules: no two right answers, Filipino wording rules, `why` and `tip` for every option, Tama/Mali about
  half and half, the right answer not usually the longest.

## Part 2: Overlap checker, `tools/source-overlap.js`

Plain Node, no npm dependencies, run on the owner's PC (`sources/` is untracked, so it cannot run in CI).

### Source text

- PDF: `pdftotext -layout` (ships with Git Bash).
- pptx and docx: slide and document XML, unpacked with Windows' built-in `tar -xf`; text runs joined per slide.
- Zips: unpacked; the files inside are read as above.
- Existing `md/` and `extracted/` text files, and the Google Forms `.html` pages with tags stripped.
- Images and picture-only slides have no text: they are listed under "not checked".
- Extracted text is cached in `sources/.text/` (untracked), rebuilt when a file's size or modified time changes.

### Lesson text

- Each lesson file runs in a `vm` context with a stub `StudyKit.lesson` that captures the object; every string field
  is collected with its path (`cards[2].back`, `quiz[3].q`, `quiz[3].why[1]`, art labels…).
- Grade 5 Math's case-study and walkthrough data files are read the same way.

### Matching

- Both sides are normalised: lowercase, HTML tags and entities removed, accents removed, ’ to ', punctuation dropped,
  whitespace collapsed.
- A hit is any run of **7 or more words** a lesson string shares with a source, or any whole lesson sentence of
  **4 or more words** equal to a source sentence.
- `tools/overlap-allow.txt` holds accepted phrases, one normalised phrase per line (official law titles, term lists,
  Lupang Hinirang, song titles). A hit inside an allowed phrase is skipped.

### Use and output

- `node tools/source-overlap.js` checks every game; a folder argument checks one game; file arguments check only those
  lesson files.
- The report groups hits by lesson file: field path, the shared words, the source file. It ends with hits per game and
  the "not checked" list. Exit code 1 when there is any hit.

## Part 3: Audit and review carry-over

### Carry-over

`Recall.tidy` (`web/engine/recall.js`) marks boxes of questions a game no longer has as `gone`. A reworded question has
a new key (hash of stem, art and answer), so it would lose its box and its medal progress.

- A rewritten question carries `was: '<old hash>'`, the hash part of its old review key (`app|<hash>`), computed by
  the audit before the rewrite with the game's own `reviewInfo`, cut out of its page and run in Node (the method
  `tests/world3d-quiz.test.js` already uses, moved into `tests/game-keys.js`).
- In `tidy`, before old boxes are marked `gone`: for each question with `was`, when `app|<was>` has a live box and the
  new key has none, the old box's `box` and `due` are copied to the new key with `t: now()`. The old box is then marked
  `gone` as usual.
- The games' `prepareQuestion` copies only some fields, so `tidy` never sees `was` on the questions it gets. Instead
  `Recall.renamesOf(StudyKit.lessons())` maps each stem to its `was` hash (a stem used by two questions is left out),
  and the browser wrapper passes that map to `tidy`. No game page changes.
- Every device reaches the same result; sync's newest-wins keeps it. Medals, boss counts and Practice these read the
  new key.
- `was` fields can be removed later; a leftover one does nothing.
- Accepted gap: older parent-history entries keep the old key; Focus shows them as it shows a removed question.

### Audit steps

One game per step, each its own commit:

1. Games with lessons from summative tests: Net Navigators (Computer 5), Wikaharian (Filipino 5), Rise & Shine
   (GMRC 5), Craft Corner (TLE 5), Life Lab (Science 5), History Explorers (AP 5).
2. Story-heavy games, which get the original passage plus 📖 summary card: Page Turners (English 5), Kuwentista
   (Filipino 2), Word Train (English 2).
3. The rest, highest hit count first.

Per game: run the checker; rewrite only flagged strings (questions without hits stay untouched); add `was` to every
question whose key changed; update type-it keys whose stems changed; rerun until 0 hits; `node --test` and the game's
e2e (`node tests/e2e/apps-e2e.js 5` or `2`); hand the owner the commit.

## Part 4: Docs, workflow, tests

### Docs

- `CLAUDE.md` "Text and lessons": the deck-wording line becomes "Follow the class deck's facts and terms; write every
  sentence fresh (`docs/lesson-writing.md`). Run `node tools/source-overlap.js <new lesson files>` before handing over
  a lesson; it must report 0 hits."
- `README.md` "Adding content": the same change; the tools list gains `source-overlap.js`.
- `docs/lesson-writing.md`: the Part 1 rules, three worked before/after examples (a math word problem, a GMRC
  situation question, a story with its summary card), and how to use the checker and the allowlist.
- `docs/HANDOFF.md` "Next": the audit, with a per-game checklist ticked as games are done.

### Workflow for a new deck

Check coverage → read every slide → write under the new rules → checker on the new files until 0 hits →
`node --test` and e2e → commit for the owner.

### Tests

- `tests/source-overlap.test.js`: normalising and matching on small made-up texts (catches a 7-word run, catches a
  whole short sentence, skips an allowed phrase, passes a fresh rewrite). Needs no `sources/`, so it runs in CI.
- Recall unit test: `was` copies box and due to the new key, marks the old one `gone`, never overwrites an existing
  new box, and a question without `was` behaves as today.
- Wiring test: any `was` field in a lesson is a well-formed hash (1-8 lowercase hex digits, the FNV-1a output of
  `hash()` in `recall.js`), differs from the question's key now, and sits on a stem used once in the game.

## Out of scope

- CI enforcement through committed source fingerprints (possible later).
- Picture-only slides: manual care, reminded by the checker's "not checked" list.
- Remapping old parent-history entries.
