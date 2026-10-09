# Pet teacher: her pet explains a wrong answer in the 3D world

Date: 2026-10-07. Step 4 of the playground idea (`docs/superpowers/ideas/2026-10-06-playground-exploration-combat.md`).
Gifts and monsters (step 5) use it too.

## Why

A wrong answer in the world today gets one line ("The right answer is …") with the why and explain text squeezed under
it. The games teach better: they show what she picked, the right answer, and why. Her pet is the friend who is always
with her, so the pet does the teaching, kindly.

## User decisions (don't re-litigate)

- The pet teaches after **every** wrong answer in the world: Professor Hoot's and the buddies' ❓ Ask me!, the
  playmates' study questions, and (later) gifts and monsters.
- The words come only from the lesson's own text (the option's why, the question's explain); no AI, no new writing per
  question.

## What she sees

1. She taps a wrong answer. The character's bubble closes; her pet hops down if it was riding on her, stands beside
   her on the camera side, faces the camera, does a small hop and shows 💡 over its head. She cannot walk while it
   talks (the bubble freezes her, as every bubble does).
2. The pet's bubble (the usual speech bubble, face = the pet's emoji, name = her pet's name):
   - a kind line ("Let's look at it together!"; Grade 2 as a Filipino · English pair),
   - a soft red chip **You picked:** her answer, and a green chip **Right answer:** the answer,
   - numbered steps: (1) why her pick isn't right (the option's why) when the lesson has one, (2…) the explanation,
     then a last step "Remember: <the right answer>" (Grade 2: "Tandaan · Remember: …"). A Filipino line and its English line stay together in one step;
     an explanation in one language is split into sentences (at most 4 steps from it).
   - one button, **Got It!** (English, like every button).
3. Got It! closes it, the pet goes back to following her, and the character carries on: Hoot/the buddy shows Next ▶
   (more questions) or Bye; a playmate shows Let's play! and Bye. No points change: scoring already happened when she
   answered, exactly as before.

When a question has no why and no explain, the steps are just "Remember: …".

## How it fits

| File | Kind | Job |
|---|---|---|
| `web/world/teach.js` (new) | pure | `Teach.lesson(grade, view, opt)` → `{ hello, pickedLabel, answerLabel, picked, answer, steps }`; `Teach.TEXT` per grade |
| `talk.js` | DOM | optional `o.teach = { pickedLabel, picked, answerLabel, answer, steps }` renders the two chips and an ordered list |
| `companion.js` | 3D | `teach(on, her)`: hop down, stand on the camera side facing it, 💡 bubble, a hop; off: climb back / follow |
| `world-main.js` | wiring | `teacher(view, opt, then)` opens the pet bubble (pet face + name from her look) and hands it to folk and mates3d |
| `folk.js`, `mates3d.js` | wiring | a wrong answer calls `o.teach(view, opt, then)`; `then` shows the old follow-up buttons |
| `world.css` | style | `.talk-chip.bad` (soft red), `.talk-chip.good` (green), `.talk-steps` |

`teach.js` loads after `quiz.js` (tests/paths.js `WORLD_FILES`, both world pages, the precache list).

## Testing

- Unit: steps from why + explain; pairs kept together; one-language explanations split into sentences (max 4);
  "Remember" step always last; no why/explain → one step; every Grade 2 line is a pair; talk.js renders the chips and
  the list; folk/mates wiring calls `teach` on a wrong answer only.
- E2E: Ask me! from Hoot, a wrong answer → the pet's bubble with both chips and Got It!; Got It! → Hoot's Next/Bye; the
  pet stands beside her with 💡 while it talks.
