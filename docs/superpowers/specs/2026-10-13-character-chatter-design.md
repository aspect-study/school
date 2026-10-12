# Character chatter: word bubbles over characters, and tap-to-reply chat

Date: 2026-10-13. Part A of two. Part B (characters talking to each other) gets its own spec and plan once A is built; it
reuses the engine and line data described here.

## Goal

The world's characters, playmates and pets say short things on their own when she is near, and answer when she taps them,
so the world feels alive instead of silent. Everything is pre-written: no AI runs on the tablet (the on-device AI spike
failed on both tablets on 2026-10-12, see `docs/superpowers/plans/2026-10-11-on-device-ai.md` and the memory note). Variety
comes from many lines, each chosen by what is happening right now, and from never repeating a line soon.

Cosmetic only: nothing here saves data, awards coins or points, or changes review, medals or the shop.

## Decisions (made with the owner, 2026-10-12)

- Characters speak on their own near her and when she taps them.
- Build order, each its own release: **A1** pets and playmates, **A2** the town characters, **A3** everyone else.
- Calm by default: at most 2 bubbles at once, about 4 s each, a speaker at most once every 20-30 s. A **Chatter** setting
  in the world's ⚙️ offers Quiet, Calm and Chatty.
- Lines use only what the game already knows about her. Remembering what she tapped in chats is a follow-up (see Later).
- The owner reads every line before it ships, through generated review sheets.

## Out of scope

- Any AI, any typed text from her, any Filipino-only text.
- Characters talking to each other (Part B).
- Remembering reply taps across days (Later).

## Architecture

### `web/world/speech.js` (new, pure, ES5 IIFE, tested in Node)

`pick(speaker, ctx, state, rand)` returns a line or `null`.

- `speaker` is `{ id, kind, species?, name? }`. Its pool is its own lines, plus the shared pool for its kind: an `any pet`
  pool, one pool per species, an `any kid` pool, and so on. Shared pools mean a new pet needs few lines of its own.
- `ctx` is a plain object of facts (below). `state` is `{ recent: { speakerId: [lineId, ...] }, last: { speakerId: ms } }`,
  kept in memory for the session only.
- A line is eligible when every tag in its `when` holds in `ctx` and every `{slot}` in its text has a value.
- Drop lines the speaker used in its last 20. Prefer the line with the most matching tags; break ties at random.
- Return `null` when nothing fits (the speaker stays quiet, which beats a filler line).
- `reply(lineId, index)` returns the next line for a chat step.
- Also exports `fill(text, ctx)` (slots) and `eligible(...)` for tests and the review tool.

### Line data, pure data files

`web/world/speech/pets.js`, `speech/kids.js` (A1), `speech/town.js` (A2), later files for A3. Each file is
`{ pools: { <poolId>: [line, ...] } }`. A line:

```js
{ id: 'pandesal-hat-1', when: ['wearing:hat'], say: 'Nice {hat}! It looks great on you!',
  fil: 'Ang ganda ng {hat}!', replies: [{ text: 'Thanks!', next: 'pandesal-hat-2' }] }
```

- `say` is English. `fil` is optional and only the tap chat uses it (below).
- `replies` is up to 3 buttons, each pointing to another line id; a chat ends at a line with no replies. A chat is at most
  3 steps. A line without `replies` is ambient-only or a chat end.
- `when` tags are defined once in `speech.js` (`TAGS`) so a typo in a line fails a test.

### Context facts (`ctx`)

Built by `web/world/speechctx.js` (view side) from modules that already exist; nothing new is stored.

| Tag | Source |
|---|---|
| `time:morning`, `afternoon`, `evening`, `night` | the device clock (`Clock`) |
| `near:<ride>`, `near:plaza`, `near:school`, `near:garden`, `near:fort` | her position against `Layout` |
| `wearing:hat`, `wearing:glasses`, `wearing:accessory`, slot values `{hat}`, `{colour}` | the wardrobe state |
| `pet:<species>`, slot `{pet}` | her pet |
| `streak:3`, `streak:7` (at least) | `quests_v1` |
| `medal:today` | `mastery_v1` |
| `studied:<subject>:today`, `studied:today` | `study-history` |
| `fav:<question>:<choice>`, slot `{fruit}`, `{colour}`, ... | `mates_v1` (her answers to the playmates' questions) |
| `after:ride`, `tired` | the ride that just ended, the stamina heart |

Lines never use "she/her/he/him/his" about the player; they say "you". (Boys play too, see `boy-players`.)

### `web/world/chatter.js` (new, view)

- Runs each frame inside the world loop (alongside `life.js`). Each second it lists speakers within the radius, skips any
  that spoke too recently, and asks `speech.pick`.
- Draws one bubble per speaker: a white rounded speech bubble with the words (up to 2 lines) on a canvas texture, as a
  sprite above the head (character head 4.4, pet head 2.4, as in `life.js`), visible about 4 s with a short fade.
- **Ambient bubbles are English only**, whatever the Filipino switch says. This follows the existing rule that floating
  signs in the 3D world show the English half (`web/world/text.js`, `Text.english`).
- Limits come from the Chatter setting:

| Setting | Bubbles at once | Gap per speaker | Radius |
|---|---|---|---|
| Quiet | 0 (taps still work) | - | - |
| Calm (default) | 2 | 20-30 s | 12 |
| Chatty | 3 | 10-15 s | 16 |

- Silent while: a talk bubble, stall, card, deco view or game frame is open; during rides, playmate games (tag,
  hide-and-seek, Patintero) and their replay; while she sprints or the heart is full; and for speakers 40+ squares away.
- A speaker that is waving, napping or doing a prop action at the moment may still speak; a pet's own sound plays only as
  today.

### The tap chat

- A tapped character or kid opens the existing `talk.js` bubble. The opening line comes from `speech.pick` with the
  context, and its replies are drawn as the bubble's buttons (`stack` layout). The existing buttons stay (Let's play!,
  Ask me!, More, Bye).
- A pet that is close can be tapped; this needs a tap target for the unique pets (they have none today). If the
  hit-test turns out to be costly, A1 ships ambient bubbles for pets first and pet chat second (see the plan).
- Grade 2 and the 🇵🇭 switch: the chat bubble shows "Filipino · English" through `Talk`'s existing pair mode when the
  line has a `fil`, and English alone otherwise. Grade 5 is English.

### The Chatter setting

`world3d_device_v1` gets `chatter: 'quiet' | 'calm' | 'chatty'` (default `calm`) in `prefs.js`, with a row in the ⚙️
Settings card like the sound pack row. Device-only, not synced.

### Review sheets: `tools/line-sheet.js`

Reads the line files and writes `docs/lines/<file>.md`, one section per speaker, grouped by situation (the `when` tags),
showing each line, its slots with an example filled value, its Filipino half, and the reply tree. Run it after editing lines;
`tests/` checks the sheets are up to date (like the precache list).

## Voice and content rules (enforced by tests)

- Kind words only: never scold, never compare her with her sister or anyone.
- Ambient `say` is at most 60 characters. Chat lines are at most 140.
- Every tag is a known tag; every slot is filled by a known source; every `next` points to a real line; no reply loop.
- No "she/her/he/him/his" about the player. Grade 2 `fil` follows the Filipino rules in `CLAUDE.md` (the Filipino half carries the
  full meaning; "puwede", "natutuhan"; never "bagay" for "fits"; never "tunog tama").
- Names are the existing ones: playmates Migo, Ella, Tomas, Bea, Jun, Luna and three new kids (no name, generic kid
  pool); pets Tagpi, Lila, Kidlat, Pandesal, Mingming, Kwento, Tagal, Bituin, Kawayan, Hielo, Pitik, and her own pet.
- Each speaker has its own voice (a parrot repeats words, a fox is sneaky, Bea likes lists). Running jokes are fine.

## A1 content target

Pets: every species pool (16), the `any pet` pool and about 8 personal lines for each of the 11 named pets, plus lines for
her own pet. Kids: the `any kid` pool and about 25 lines for each of the 6 friends. A first count is about 500 lines; the
plan sets the exact list and the review order.

## Files

New: `web/world/speech.js`, `speechctx.js`, `chatter.js`, `speech/pets.js`, `speech/kids.js`, `tools/line-sheet.js`,
`docs/lines/*.md` (generated). Changed: `web/world/prefs.js` (the setting), `world-main.js` (the Settings row, the
chatter tick and the silence conditions), `talk.js` (reply buttons) or `folk.js`/`mates3d.js` (the opening line),
`web/world/world.css`. After adding files under `web/`, run `node tools/update-precache.js`.

## Testing

- Node: `speech.pick` (tags, slots, recent window, specificity, null), the line guards (length, tags, slots, replies,
  pronouns, scolding words, Filipino rules), the Chatter limits (Quiet, Calm, Chatty, silence conditions) with a fake
  clock and fake speakers, the setting's storage, and the review-sheet tool.
- Headless Chrome: bubbles appear near a pet and a kid, none in Quiet, none during a ride, and a tapped kid shows a chat
  with replies. `node tests/e2e/world-e2e.js` must still pass (as `CLAUDE.md` requires for any world change).
- Manual on the tablets: how Calm feels, readability for Grade 2, bubble position with her zoom, frame rate with 12
  speakers near.

## Accepted gaps

- Memory is per session: a reload resets which lines were said recently.
- A bubble can be missed if she looks away; Quiet is there for the opposite problem.
- Chatty on a slow tablet adds sprite and canvas work; the existing quality watcher already drops the world to low
  quality, and Chatty stays within its bubble cap.
- Ambient bubbles are English only, so a Grade 2 child who reads only Filipino meets the Filipino in the tap chat.

## Later

- **Chat memory (planned):** remember which reply buttons she tapped so a topic returns days later. Needs one new synced
  state key and its own spec.
- **Part B:** characters talking to each other, reusing `speech.js` and the line files with a new pair mode.
- **A2:** Mimi, Hoot, Bunny, the four shop owners and the subject buddies (`speech/town.js`). **A3:** everyone else.
