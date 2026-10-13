# Character chatter A2: the town characters

Date: 2026-10-13. Second release of the character chatter feature. The engine, bubbles, Chatter setting, line format and
review sheets are built by A1 (`docs/superpowers/specs/2026-10-13-character-chatter-design.md`); A2 adds speakers and lines.

## Goal

Mayor Mimi, Professor Hoot, Bunny, the four shop owners and the subject buddies show short ambient word bubbles near
her, in their own voices, like the pets and playmates already do.

## Decision (owner, 2026-10-13)

Ambient bubbles only. Tapping a town character keeps today's menu (progress lines, 💬 More, Ask me!, shop buttons, Bye); no
💬 Chat button and no reply chats for them in A2. A later release can add chats (the line format already supports them).

## Speakers and pools

The living world already tracks every town character. `life.speakers()` adds them, with the same bubble limits and the same
silence rules as A1.

| Speaker | Actor id in `lifedata.js` | Pool | Head height |
|---|---|---|---|
| Mayor Mimi | `mimi` | `char:mimi` | 4.4 |
| Professor Hoot | `hoot` (he flies: add the actor's `y`) | `char:hoot` | 4.4 + y |
| Bunny | `bunny` | `char:bunny` | 4.4 |
| Lola Lana, Mang Kiko, Kuya Pilo, Tito Tasyo | `lana`, `kiko`, `pilo`, `tasyo` | `char:lana`, `char:kiko`, `char:pilo`, `char:tasyo` | 4.4 |
| Subject buddies (17) | `buddy:<app id>` | `any-buddy`, plus `buddy:<app id>` | 4.4 |

`speech.poolIds` gets a `char` kind (`'char:' + id`) and a `buddy` kind (`['any-buddy', 'buddy:' + appId]`). Buddy pools are
keyed by app id, which is distinct for the two grades, so each grade's buddies get their own lines (Grade 5: Kiko,
Tarsi, Ruler Kit, Bookie, Pandy, Dash, Stitch, Fizz, Byte, Melody; Grade 2: Bloxy, Tarsi, Choo-Choo Bear, Kiko, Pandy,
Click, Detective Ribbit, from `web/world/buddies.js`). A grade's world only builds its own buddies, so a speaker whose
pool has no lines simply stays quiet.

## Line rules

Everything in A1's "Voice and content rules" applies, plus:

- Ambient only: English, at most 60 characters, no `replies`, no `follow`.
- A buddy mentions its own subject lightly and warmly (the "science is cool" kind), never nagging: no "you should
  study", no mention of due reviews, scores, coins, medals or streak counts as an obligation, no comparison with her
  sister or anyone. Streak and wardrobe tags are fine ("{streak} days in a row. Wow!" with `streak:3`).
- Shop owners speak about their stall in a friendly way and never push her to buy ("The new hats are in!" is fine,
  "You need this!" is not).
- Hoot is wise and gentle, loves books and the night; Mimi is a warm, proud mayor of the town; Bunny is small, shy and
  loves saving coins in a jar, never lecturing about money; Lana is a kind grandmother with yarn and stitches; Kiko loves
  animals and talks to them; Pilo is playful and full of toys and jokes; Tasyo is a patient carpenter who loves wood and
  fixing things.
- The same tags and slots as A1 (`time:`, `near:`, `wearing:`, `pet:`, `streak:`, `fav:`, `{pet}`...), which suit
  characters as well as kids.

## Counts (the guard tests enforce them)

`any-buddy` 40 lines; each of the 17 `buddy:<app>` pools 12 lines; `char:mimi` 20, `char:hoot` 15, `char:bunny` 15, and 12 for
each of the four shop owners. About 350 lines. Every pool has at least 3 open lines.

## Files

New: `web/world/speech/town.js` (pools for Mimi, Hoot, Bunny, the owners), `web/world/speech/buddies.js` (`any-buddy` and the
17 buddy pools), `docs/lines/town.md` and `docs/lines/buddies.md` (generated). Changed: `web/world/speech.js`
(`poolIds`), `web/world/life.js` (`speakers()` adds the characters), `web/world/world-main.js` (merge the two new data
files), `tools/line-sheet.js` (two more sheets), `tests/world3d-speech-lines.test.js` (pool names, counts),
`tests/paths.js` and the two world pages (the two new data files), the e2e check, HANDOFF and README.

## Testing

Node: `poolIds` for the new kinds; the guard tests over the new files and counts; `life.speakers()` lists the characters
(a wiring test reads the source); the sheets are up to date. E2E: at the Plaza in Chatty a character or buddy shows a
bubble within 25 s (extend the A1 chatter case). `node tests/e2e/world-e2e.js` must pass.

## Accepted gaps

- A Grade 2 child who reads Filipino only meets Filipino in tap menus; ambient bubbles are English (A1 rule).
- Buddy lines are subject-flavoured but not tied to her progress in that subject (no due-review or medal tags in A2).

## Later

Reply chats for town characters; character-to-character chatter (Part B); the A1 gaps (her own pet as a speaker, pet tap chat,
`studied`/`medal` tags); A3, everyone else.
