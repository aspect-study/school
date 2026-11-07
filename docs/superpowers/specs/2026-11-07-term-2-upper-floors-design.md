# Term 2 on the subject buildings' upper floors

Date: 2026-11-07. Status: decisions from the owner in brainstorming; waiting for the owner's OK on this spec.

Replaces section 2 ("The house") of `2026-11-07-term-2-study-loft-design.md`. Section 1 of that spec (lesson data and
engine: `term: 2`, `exam: true`, `?term=`, `&exam=1`, per-view final exam best, review and boss scoped to the view)
is built and stays as it is. Section 3 (content workflow) is unchanged.

## Goal

The owner expected Term 2 to sit upstairs in each subject's own building, not in a loft above My Little House. Each
building on School Street gets a second floor with a balcony. The ground door opens Term 1, the balcony door opens
Term 2, and a practice-exam board hangs on the balcony. The Study Loft, its ladder and the Old lessons bookcase go.

## Owner decisions

1. Term 2 lives on a second floor of every subject building. The house loft is removed.
2. Every building is drawn one floor taller with a balcony and a Term 2 door. No ladder, and no "which term?" prompt at
   a door.
3. The ground door opens Term 1 only (`&term=1`). The balcony door opens Term 2 (`&term=2`).
4. The Exam Corner moves upstairs: each balcony has its own exam board (`&term=2&exam=1`).
5. She reaches the balcony by side stairs: at the stairs' foot a ⬆️ Go up spot plays the sparkle hop up the stairs
   and she stands on the balcony, where she walks between the Term 2 door and the exam board, then ⬇️ Go down.
6. A game with no Term 2 lessons yet still has the upper floor: its balcony door is dimmed with a 🌱 and says "coming
   soon" when tapped, as the loft desks did.
7. The 📚 Old lessons bookcase in her room is removed (the ground floors are Term 1 now).
8. Hoot's guide, the buddies and the Boss Fort follow the lesson's term: a guide step to a lesson opens the floor of
   that lesson's term; review and weekly-boss steps and the Boss Fort keep both terms; a buddy's Let's go opens Term 2
   when the game has Term 2 lessons, else Term 1.
9. Her sister's side does not change: visiting the sister's room stays as it is, and only her own grade's town has the
   stairs (as today, each child walks only her own town).

## 1. The building

- Each building's body grows by one floor (about 4.6 units) and its roof, top ball, floating sign and progress flags
  (`decor.js` reads `top` and `flagY`) move up with it. Shapes (cone, dome, cake), colours and the ground door stay.
- **Balcony:** across the front at the second floor (floor at the top of the ground floor, about y 6.9), the full
  width of the front wall, about 2.4 deep, with a low railing. On its wall: the 🌟 Term 2 door in the middle (above
  the ground door) and the 📝 exam board at the end away from the stairs.
- **Stairs:** a small spiral staircase at the front corner on the Boss Fort side (north, so the buddy beside the door
  on the plaza side keeps its spot), standing in the gap between buildings. Its foot is on the street side; its head
  joins the balcony's end.
- **Plaques** (English half on world signs, `Text.english()`): "📘 Term 1" beside the ground door, "🌟 Term 2" over the
  balcony door. Grade 2 text pairs as usual ("Unang Termino · Term 1", "Ikalawang Termino · Term 2").
- **Not ready** (the game has no `term: 2` lesson that is not `exam: true`, from `World3D.TermLessons`): the balcony
  door is drawn dimmed with a 🌱 instead of 🌟. The exam board is dimmed when the game has no `term: 2` lesson at all
  (an exam-only game still has its exam). The stairs still work.

## 2. Going up and down

- At the stairs' foot, her action button reads "⬆️ Go up to Term 2" (buttons stay English only). A tap plays the
  sparkle hop (as at My Little House's door) and she stands on the balcony a step past the stairs' head, facing along
  it toward the Term 2 door.
- On the balcony:
  - She walks only on the balcony (a movement box like her room's), above the street: her avatar, her pet and the
    camera are raised by the balcony height. Grade 2 tap-to-walk hits the balcony floor, not the street below.
  - The town stays visible and alive below; town interactables (doors, buddies, rides, trees) are off while she is up.
    Only three spots work: the 🌟 Term 2 door, the 📝 exam board and ⬇️ Go down at the stairs' head.
  - Her pet comes up with her and stays on the balcony.
  - Her treat and prop bars hide while she is up (a thrown toy would fall to the street), and gifts and monsters
    pause, as they do while a bubble is open.
- **🌟 Term 2 door:** ready → opens the game in the world frame (`portal.js`) with `&term=2`. Not ready → a bubble:
  "Term 2 lessons for {name} are coming soon! 🌱". Closing the game leaves her on the balcony.
- **📝 exam board:** ready → opens `&term=2&exam=1` (the final exam from Term 2 lessons, with any `exam: true` lessons
  beside it). Not ready → "No Term 2 lessons yet. Check back soon! 🌱".
- **⬇️ Go down:** the sparkle hop down; she lands at the stairs' foot, facing the street.
- Go up is not offered while a playground game, a monster or a ride holds her (the same busy checks the doors use).
  Quick travel (Mayor Mimi, the travel overlay) from the balcony first brings her down.
- A page reload or a return from a full-page game lands her at the ground door, as today.

## 3. Doors, guide, buddies, Boss Fort

- **Ground door:** `Layout.appUrl(grade, folder) + '&term=1'`. Its action reads "{emoji} Go to {name} (Term 1)".
- **Guide (the next step Mayor Mimi and the buddies point to):**
  - A lesson or practice-quest step whose lesson is Term 2 points at the balcony: Mayor Mimi's sparkle trail ends at
    the stairs' foot, the balcony door opens the step's link with `&term=2`, and the ground door opens plain Term 1.
    The building's floating ❗ marker stays above its sign, as today.
  - A lesson step whose lesson is Term 1 behaves as today on the ground door, with `&term=1` added.
  - Review, weekly-boss (`?boss=1`) and mock steps keep opening the full game (both terms, no `term=`), from the
    ground door, so a review still asks every due question. A first-visit step needs nothing special: the ground door
    stays plain Term 1.
  - Which term a lesson is in comes from the generated `term-lessons.js`, which now also lists each game's Term 2
    lesson ids (`ids`, from the lesson files' `id:` lines; Math Mastery from its inline list). A lesson id not listed
    is Term 1.
- **Buddy Let's go:** opens `&term=2` when the game has Term 2 lessons, else `&term=1`; when the guide's step is in
  that game, the step's link with its term (as above). The buddy's review button keeps the full game.
- **Boss Fort, the quests panel and the weekly boss trail** keep opening the full game, as today.

## 4. Removed

- The Study Loft: `loft.js`, `loft3d.js`, `climbUp` / `climbDown` / `loftDesk` / `examCorner` / `oldLessons` in
  `world-main.js`, their text strings, and their tests (`world3d-loft*.test.js`, the loft part of `world-e2e.js`).
- In My Room: the 🪜 ladder and the 📚 Old lessons bookcase (`room3d.js`), and their reserved squares in `room.js`.
  Those squares take furniture again. Pieces the earlier load repair moved to her storage stay there, still owned; she
  can place them again with Decorate. `house_v1` does not change.

## 5. Code shape

- New pure module `web/world/upstairs.js` (`World3D.Upstairs`): per building, the balcony box, the stairs' foot and
  head, the door and board spots, ready states from `TermLessons`, the three URLs (ground, Term 2, exam), and which
  floor a guide step belongs to. No Three.js, so `node --test` covers it.
- New drawing module `web/world/upstairs3d.js`: stairs, balcony, railing, balcony door, exam board, plaques, dimmed
  state. `build.js` only makes the body one floor taller and moves the roof parts up.
- `world-main.js` wires going up and down (movement box, lift, interactables swap), like the room enter/exit code.
  `move.js` gains a lift height for the camera and tap-to-walk; the avatar and the pet take the same lift.
- The floor-aware door links (ground or balcony) live in `Upstairs.links` and `Upstairs.buddyHref`;
  `town.doorHref` was removed (`progress.js` `doorHref` stays for its own callers).
- Both new files go in `tools/world-manifest.json`, then `node tools/update-world-pages.js` and
  `node tools/update-precache.js`.

## 6. Tests

- Unit (`upstairs.js`): every building of both grades has a balcony, stairs foot and head inside the town bounds, not
  overlapping a neighbour, the buddy, the ground door's reach or the street; the three URLs; ready and not-ready states;
  a Term 2 guide step goes to the balcony, a Term 1 or review step to the ground door; ids in `term-lessons.js` match
  the lesson files.
- Unit (room): no ladder or bookcase square is reserved any more; the earlier tests for them are removed.
- `tests/e2e/world-e2e.js`: the ground door of Araling Panlipunan opens `&term=1`; Go up; on the balcony the Term 2
  door opens `&term=2` (it has lessons 30-38) and the exam board `&term=2&exam=1`; closing the game keeps her on the
  balcony; Go down lands at the stairs' foot; a not-ready building's balcony door says coming soon; her room has no
  ladder or bookcase.
- `node --test`, `node tests/e2e/world-e2e.js` and `node tests/e2e/term-e2e.js` pass.

## Out of scope

- Walking the stairs freely (the world has no heights; the climb is the sparkle hop).
- A third floor for Term 3 (the tag allows it later).
- Any change to the game pages' term views, points, medals, review or boss rules.
