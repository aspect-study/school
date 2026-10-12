# Idea: a public platform for Filipino families, with lessons from teachers

Date: 2026-10-12. Status: **concept only, parked.** Brainstorm it properly before any spec.

## Where it came from

The study games are built from one school's class decks, so the current lessons stay private to the owner's daughters
and are not published. The owner wants a public product for other families built from the parts of this system that do
not belong to any school.

## The concept

- **Customer:** Filipino parents with children in Grade 1 to 6, like the owner's.
- **Lessons come from teachers.** A teacher writes their own lessons for the platform; a teacher can earn when a family
  takes their lesson. Because the teacher owns what they write, the copyright problem of the school decks goes away.
  This is the owner's original idea for the app.
- **Reusable (not tied to a school):** the 3D world (character, pets, rooms, wardrobe, playmates, playground games),
  coins and the parent-approved reward shop (with the customizable shop), the PIN-gated parent area and phone page,
  daily quests, streak, weekly boss, spaced review, medals, family accounts, cloud sync.
- **Not reusable:** the 17 subject games' lessons, `type-it.js`, `strategy.js`, Math 5 `cases.js` and
  `walkthroughs.js`, and the Battle announcer sound clips (MOBA and Valorant voice clips; the Happy Chimes pack is
  original).

## Options weighed on 2026-10-12

1. A habits and chores world (kids earn coins for real-life tasks, a parent approves): needs almost no new code and has
   no content problem. Suggested as a possible first public product.
2. Bring-your-own lessons ("My Lessons": type question and answer cards, wrong choices built from the other answers).
3. Teacher or classroom edition: the direction the owner leans towards.

## Open questions for the later brainstorm

- How a teacher publishes a lesson, and what the app checks before a lesson is offered to families.
- How teachers are paid and who handles the money (free, one-off purchase, subscription, a revenue share).
- Child-data rules for a public app with children's accounts (the Philippines Data Privacy Act); the privacy notice is
  already in `web/privacy.html`.
- Whether the private daughters' app and the public platform share one codebase or become two.
- Hosting: Vercel Hobby is for non-commercial use; a paid product needs Pro.
