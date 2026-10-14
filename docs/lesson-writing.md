# Writing lessons

> **Superseded 2026-10-14.** This project is private, so new lessons are based directly on the source (deck, textbook,
> test): its facts, terms, wording, examples and numbers. Nothing is reworded for copyright and the overlap check is
> not run. The rules below describe the old original-wording approach and apply only to a public version, which lives
> in its own project. The "Kept the same in each question" section and the review-key steps still help when editing.

Lessons used to be written fresh from class decks, textbook scans and summative tests so the site could be public: a
lesson kept the source's **facts and terms** and wrote **every sentence fresh**.

## Kept exactly

- Facts, answer keys, real names (people, places, events, laws, books, authors), dates and numbers that are facts.
- Subject terms and their spelling: Batas, Komunidad, Hardware, Software, kongkreto, pantukoy, presser foot.
- The order of steps or lists the deck teaches, when a test could ask for it.
- Where sources disagree, the deck wins; ask the owner when an existing answer key would flip.

## Written new

- Every sentence of cards, questions, options, `explain`, `why`, `tip` and their English halves. Allowed repeats: a
  term, a name, a title, a list of terms, or a definition's core phrase of a few words ("Ang **komunidad** ay pangkat
  ng mga tao…" with the rest of the sentence new).
- Invented people and scenes: the play-world cast first (Lola Lana, Kuya Pilo, Tito Tasyo, Mang Kiko, Mayor Mimi,
  Professor Hoot, Bunny; the playmate kids Migo, Bea, Luna, Tomas, Jun; their pets Tagpi the puppy, Lila the bunny,
  Kidlat the fox, Pandesal the hamster, Mingming the kitten — pets may appear as pets, never as people), everyday
  Filipino names to fill in (Aling Nena, Mang Ben, Paolo). Adults (Lola Lana, Kuya Pilo, Tito Tasyo, Mang Kiko, Mayor
  Mimi, Professor Hoot) play adult roles; students are the kids or everyday names. Nanay, Tatay, Lolo, Ate and Kuya only in a general sense. Never the
  kids' real names.
- **Math:** new numbers and a new story; the same concept, number of steps, digit counts, regrouping or borrowing,
  decimal places and fraction type. Work every answer out twice. `explain` follows the source's method.
- **Stories:** an original passage practises the skill (sequence, main idea, cause and effect, inference, character
  traits). A 📖 card in our own words covers the class story: title, author, who, what happened, its lesson. Never
  quote it; questions about it ask about events and meaning.

## Kept the same in each question

- The learning target and the thinking level. An apply or analyse question ("Which shows…", "What would happen if…",
  "Why…") stays one; it never shrinks to recalling a definition.
- The question type (multiple choice, Tama/Mali, type-it, matching) and roughly the number of options.
- Every other rule: one right answer, the Filipino wording rules, `why` and `tip` on every option, Tama/Mali about half
  and half, the right answer not usually the longest.

## Examples

These "source" lines are made up for the examples.

**Math (Grade 5, adding decimals: hundredths plus tenths, one regrouping)**
- Source: "Mrs. Cruz bought 3.75 kg of rice and 2.5 kg of sugar. How many kilograms did she buy in all?"
- Ours: "Lola Lana bought 4.65 m of red cloth and 1.8 m of blue cloth for a costume. How many meters of cloth did she
  buy?" Answer 6.45 m (4.65 + 1.80; 6 + 8 = 14 tenths regroups once, like the source's 7 + 5 = 12 tenths).

**GMRC situation (apply a value to a new case)**
- Source: "Your classmate dropped her baon. What should you do?"
- Ours: "Migo's lunchbox spilled on the way to the playground. What is the kind thing for you to do?" with the same
  right choice (help pick it up and share) and wrong choices that test the same value.

**Story (English 5, sequence)**
- The class story stays in the class book. The lesson gets a 📖 card ("In *the class story*, a boy loses his kite,
  searches the town and learns to ask for help") and an original passage about Tagpi the puppy losing a ball, with
  the sequence questions asked about the new passage.

## Checking

1. Write or rewrite the lesson.
2. `node tools/source-overlap.js <lesson files>` until it prints `Total: 0`. A hit shows the shared words and the
   source file. Rewrite the sentence; add a phrase to `tools/overlap-allow.txt` only when it is an official title, a
   fixed list of terms, a song or anthem line, or a generic quiz instruction or fixed sequence ("What should you do",
   "a e i o u").
3. `node --test` and the game's e2e (`node tests/e2e/apps-e2e.js 5` or `2`).

The checker reads `sources/`, which is on the owner's PC only. It cannot read pictures, so check these yourself:

- Files listed under "Not checked". That list only catches a whole file with little or no text; a picture-only slide
  inside a deck that has text elsewhere is not listed.
- Text inside a lesson's SVG pictures (`art`, `pic`): the checker skips those fields.

## Rewording an existing question

Rewording changes a question's review key. To keep the learner's progress:

1. Before editing: `node tools/review-keys.js snapshot <game dir>` (saved in `sources/.audit/`).
2. Rewrite, keeping every question in its place (new questions go at the end of a lesson).
3. `node tools/review-keys.js check <game dir>` prints `add  was: '…'` for each reworded question; add that field to the
   quiz item and run it again until it says `0 to fix`.
4. If two questions share a stem, give the reworded one its own stem (for example name the picture or add context);
   otherwise its review box cannot carry over. `check` says `stem shared with another question` for these.
5. If a stem changed and the game has a type-it map, update the map's key to the new stem (`node --test` checks).
