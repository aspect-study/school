# Grade 5 English Helpers — Design

Date: 2026-09-28
Apps: `history-explorers.html` (Araling Panlipunan, 12 lessons) and `wikaharian.html`
(Filipino, 5 lessons). The other six Grade 5 apps are already in English.

## Why

She finds the Filipino words hard. Grade 2's Kuwentista solved this with English helpers,
and the user asked for the same in Grade 5.

## Decisions (user, 2026-09-28)

- Same pattern as Grade 2. Answer choices stay Filipino, like her real exam.
- Add a "🔑 Paano Sagutin?" tip card to the end of every lesson.

## What she sees

| where | behaviour |
|---|---|
| Flashcard | When she flips to the meaning, a blue **SA ENGLISH** box shows under the Filipino. It is hidden on the term side so the flip is not spoiled. |
| Question | A **🤔 Hindi maintindihan? Tingnan sa English** button under the question reveals the English question. The button is hidden for items without `qen`. |
| After answering | The explanation box shows the Filipino explanation, then **Sa English:** and the English explanation. |
| Tip card | The last card of each lesson, with a gold border. Front `🔑 Paano Sagutin?`; back in Filipino plus the English box. |
| Exam Strategy page | Each tip shows its English box under the Filipino body. |

## Data

- Card: `{front, back, en}`. `en` is the English of the term *and* its meaning, e.g.
  `'<b>Barangay</b> (village community): the early Filipino community ...'`.
- Tip card: `{front:'🔑 Paano Sagutin?', back:'…Filipino…', en:'…English…', tip:true}`.
- Quiz item: add `qen` (English of the question) and `en` (English of the explanation).
- Strategy tip: add `en` (English of title + body).
- `prepareQuestion` must carry `qen` and `en` through the option shuffle.

## Translation rules

1. **The Filipino is never changed.** Much of it is verbatim from her textbook and test.
2. The English says what the Filipino says: nothing added, nothing left out, at Grade 5
   reading level.
3. Filipino key terms stay in Filipino, with English in brackets on first use in each
   helper: `datu (chief)`, `babaylan (spiritual leader/healer)`, `bugay (bride price)`,
   `pang-angkop (linker)`, `pokus sa tagaganap (actor focus)`. She needs the Filipino
   terms for the test.
4. `Tama o Mali:` becomes `True or False:`. Answer names inside the English refer to the
   Filipino choice she will click (e.g. "…so the answer is <b>Mali</b> (False)").
5. Tip cards use only rules the lesson already teaches: the textbook's Hamon reversals,
   the lesson's own Tandaan-style rules, and trap words already in the Exam Strategy page.
   **Never new facts.**
6. Write apostrophes as `&rsquo;`, never a raw `'`, because the strings are single-quoted JS.

## Unchanged

- The study history keeps recording the Filipino question and her Filipino choice.
- Scoring, points, stars, the `?reset=1` contract, and the number of quiz questions are unchanged.
- Tip cards add one flashcard per lesson; quizzes and the mock exam are unchanged.

## Verification

- A permanent unit test (`tests/english-helpers.test.js`) checks that:
  - every card, quiz item and strategy tip has non-empty English;
  - each lesson's last card is its only tip card;
  - a `Tama o Mali:` item's `qen` starts with `True or False:`;
  - no helper contains a raw unescaped quote issue (the file parses).
- A one-off fidelity check against the pre-change snapshot confirms:
  - every original lesson id/title, card front/back, quiz q/options/correct/explain, and strategy kicker/title/body is byte-identical;
  - only English fields and the tip cards were added.
- A fresh reviewer checks every translation against its Filipino and lists any error or
  addition.
- The history e2e suite (`node tests/e2e/apps-e2e.js 5`) still passes.
