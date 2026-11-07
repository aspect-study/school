# Term 2 Study Loft

Date: 2026-11-07. Status: built. Section 2 (the house, the Study Loft) is replaced by
`2026-11-07-term-2-upper-floors-design.md`: Term 2 moves to each subject building's upper floor.

## Goal

Both daughters are in their 2nd term. My Little House gets a second floor reached by a ladder. Upstairs, each child
finds her Term 2 lessons and an Exam Corner for test practice. Downstairs she can still revisit Term 1 lessons. Each
child sees only her own grade, as today (the signed-in learner decides the grade).

This spec covers the structure (sub-project 1). Building the Term 2 lessons from the decks is sub-project 2, done one
subject per commit after this lands.

## Owner decisions

- Upstairs is a study hall that opens the existing game for each subject filtered to Term 2. No new games.
- Term 1 stays always open: downstairs shelf and the town buildings. It still pays points and medals as today.
- Upstairs has two spots: the subject desks (learn) and the Exam Corner (practice before test week).
- Lessons are built subject by subject as decks arrive; a subject with no Term 2 lesson yet shows "Coming soon".
- Split by a term tag on lesson files (approach A), not by link-only desks or a second lesson folder.

## 1. Lesson data and engine

- A lesson file may carry `term: 2`. A file without `term` is Term 1, so no existing lesson changes.
- A Term 2 summative-test practice lesson also carries `exam: true`. In a term view it is left out of the lesson list
  and the lesson path and is offered only in the Exam Corner view (`?term=2&exam=1`). With no `?term=` (the full view)
  it shows as a normal lesson card.
- `StudyKit` reads `?term=1` or `?term=2` from the page URL and exposes `StudyKit.term()` (1, 2 or null).
- The lesson list a game builds its home, lesson path (`trail.js`), search (`search.js`) and medals from is filtered by
  that term. With no `?term=`, the game home shows a "Term 1" heading above the first lesson and a "Term 2 · New" heading above
  the first Term 2 lesson (file order, so the list, the lesson path and the search stay in step). With no Term 2 lesson
  in the game, the home shows no headings (looks as today). The headings hide while a search is typed and, with the
  cards, in the lesson path view. Grade 2 reads "📘 Unang Termino · Term 1" and "🌟 Ikalawang Termino (bago) · Term 2 (new)".
- `?term=2&exam=1` opens the game straight into its final exam drawn only from Term 2 lessons, with the `exam: true`
  lessons offered beside it. Each game's final exam takes its questions from the filtered list.
- Review boxes, medals, points, coins, quests, weekly boss, boss army, parent Focus and history keep every lesson of
  both terms. In a term view the game's review round and boss stage ask that term's due questions; the town building
  (no `?term=`) asks both. In a term view the review card, the path's review stop and the boss stop count only that
  term's boxes (Recall.tidy, or Recall.scopeSkills for Math Mastery, scopes the counts to the view's questions), so a
  stop never shows "ready" with nothing to ask. A term view never drops review boxes or medals of the other term
  (Recall.tidy keeps all, Mastery keeps the other lessons in order).
- Games that key stars by lesson position (Grade 2 Byte Buddies, Word Train, Growing Good, Batang Bayani, Science
  Detectives) use the lesson's position in the full list, so a term view reads and writes the right lesson's stars.
- The final exam's best score is kept per view: `final` (both terms), `final-t1`, `final-t2` in the game's progress.
- `?term=` survives the in-game navigation the same way `?lesson=` does; `?reset=1` keeps `term=` (and `embed=1`)
  and drops the rest, `exam=` and `lesson=` included.

## 2. The house

- **Ladder:** a fixed 🪜 ladder in the south-east corner of her room, floor square (size − 1, 0), leaning on wall squares
  `s{size-1}` and `e0` (like `DESK` and `SEAT` in `room.js`): Decorate never places furniture there, it cannot be
  moved or sold, and it moves with the corner when the room grows. A piece already standing on a newly reserved square
  goes back to her storage (the load repair), still owned. Near it a 🪜 Climb
  button shows; a tap plays a short climb and loads the Study Loft.
- **Study Loft:** a second interior built with the room's builder, walls and inside camera (`room3d.js`), fixed layout,
  not decoratable, nothing saved (no change to `house_v1`).
  - One desk per game of her grade (10 for Grade 5, 7 for Grade 2), each with the game's emoji and a sign showing the
    English half (`Text.english()`, as world signs do).
  - A ready desk (the game has at least one `term: 2` lesson that is not `exam: true`) opens the game in the world frame
    (`portal.js`) with `?term=2`. A desk with none is dimmed and says "Coming soon" when tapped.
  - The Exam Corner board on the far wall lists each game that has Term 2 lessons; a row opens `?term=2&exam=1`.
  - A 🪜 Down spot returns her to her room at the ladder square.
- **Downstairs:** a fixed 📚 Old lessons bookcase on wall square `e1` beside the ladder; its front floor square
  (size − 1, 1) stays clear (rugs allowed) and she cannot walk into the bookcase itself. It opens a picker of her
  grade's games; each opens `?term=1` in the frame. 🪜 Down lands her on that square, clear of the bookcase.
- Town buildings, buddies' "Let's go" and the Boss Fort keep opening the full game (both terms).
- Her sister's room (view only) gets no ladder and no shelf.
- Which games have Term 2 lessons comes from a new generated `web/world/term-lessons.js` (`World3D.TermLessons`,
  `{ app: { lessons, exams } }` for all 17 games, Math Mastery included), written by `tools/update-precache.js` from
  the `term: 2` and `exam: true` lines of the lesson files (and the inline Math Mastery list).

## 3. Content workflow (sub-project 2)

- Sources: `sources/grade-5/*/TERM 2/` and the zips and PDFs received from 2026-11-05 on. Received so far: Grade 5
  Math, Science, Filipino, English, Araling Panlipunan, GMRC, Music & Arts, P.E. & Health, TLE; Grade 2 GMRC, Math,
  Makabansa. Not yet: Grade 2 English, Filipino, Science, Computer; Grade 5 Computer.
- One subject per commit; new lessons numbered after the game's existing ones, tagged `term: 2`, following the CLAUDE.md
  lesson and Filipino rules; run `node tools/update-precache.js` after adding files.

## 4. Tests

- Unit: the term filter (untagged = Term 1, `exam: true` hidden from lists, null term = both with headings); loft desk
  states from `lesson-files.js` counts; ladder and shelf squares never accept furniture at any room size.
- Wiring: every one of the 17 games honours `?term=` on its home, path and final exam (`tests/` static check like the
  other per-game contracts).
- `tests/e2e/world-e2e.js`: go in the house, 🪜 Climb, open a ready desk (frame shows only Term 2 lessons), close,
  🪜 Down, open the 📚 shelf and one game with `?term=1`.
- Existing suites stay green (`node --test`, world e2e).

## Out of scope

- Hiding or locking Term 1, or term-only points.
- Decorating the loft, visiting the sister's loft.
- Term 3 (the tag allows it later; the loft would then need a third view).
