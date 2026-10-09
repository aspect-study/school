# Family presence — design

Status: built 2026-10-04 (plan docs/superpowers/plans/2026-10-04-family-presence.md).
Follows the campus map lobby (`2026-10-04-campus-map-design.md`), which left family presence for its own spec.

## Goal

Ate (Grade 5) and Bunso (Grade 2) tease and argue a lot (asaran, pikunan). The app cannot stop that, but it can
give them many small sweet moments with each other: each sees her sister on her own map, sees her sister's big
moments, and sends a one-tap kind cheer. Over time kindness becomes a habit and they feel like one team.

## User decisions

- **Nothing compares them.** No leaderboard, no "who has more", no scores, coins or wrong answers of the sister,
  ever. Grade 5 vs Grade 2 is never a fair contest.
- **In-app only.** No real-life missions.
- **No team goal.** No shared jar, no shared coins.
- **Cheers earn nothing.** No coins, no points, no quest credit. The reward is the warm feeling and her reply.
- **Pre-written cheers only.** No free text, no chat, ever.
- **Approach A:** ride the existing sync round (lobby open, every 2 min, back online). No live listeners.
- **Parent phone:** unchanged in v1.

## What each girl sees (lobby, Campus view)

**Her sister's buddy** (the sister's `world_v1` avatar, or the default) stands by the gate with a name tag.

- **Playing now:** the sister's `family_v1.at` is under 5 minutes old. The buddy glows softly with a 🎮 bubble.
- **Away:** the buddy is a bit faded; the tag says "last seen 2 hrs ago" (Grade 2: Filipino · English).
- **No sister** (this tablet not signed in, or no other learner in the family): nothing is drawn.
- **💌 marker** on the buddy when the sister has news newer than `family_seen_v1.news[sisterId]`.

**Tapping the buddy opens the Sister card:**

- **Today's news:** up to 5 of her big moments, newest first: 🥉🥈🥇 medal in a game, ⚔️ boss stage cleared,
  ✅ all 3 quests done, 🔥 streak milestone (7, 14, 30, 60 days). Opening the card marks the news as seen.
- **Send a cheer:** 6 big buttons, one tap sends.
- **Cheers count:** "💖 12 cheers from Ate" (cheers she received from this sister).

**Cheer arrives:** on the next sync round, all unseen cheers to me show as one `Fx.celebrate` popup
("💌 Bunso: Galing mo, Ate! · You're great! 🌟"; up to 4 cheers are listed in the same popup) whose next line says
"Tap Bunso's buddy to cheer back!". (Plan-time change: `Fx.celebrate` only has an OK button and fx.js is not changed,
so cheering back is one tap on her buddy instead of a button in the popup.)

**App names in news** come from `engine/subjects.js` (both grades' subject titles), which both lobbies now load.

**Who is Ate:** the learner in the higher grade. The label is the profile name when set, else "Ate" / "Bunso".
With more than 2 learners, each other learner gets her own buddy by the gate.

### Cheers

Ids are permanent once released (like app ids). Each direction has its own wording for an id; the receiver shows the text from the sender's list.

| id | Ate → Bunso (grade5) | Bunso → Ate (grade2) |
|---|---|---|
| `great` | Galing mo, Bunso! · You're great! 💖 | Galing mo, Ate! · You're great! 🌟 |
| `proud` | So proud of you! 🌟 | Idol kita, Ate! · You're my idol! 💖 |
| `can` | You can do it! 💪 | Kaya mo 'yan! · You can do it! 💪 |
| `smart` | Ang talino mo! · You're so smart! 🧠 | Salamat, Ate! · Thank you! 🙏 |
| `love` | Love you, Bunso! 🤗 | Love kita, Ate! · Love you! 🤗 |
| `go` | Keep going! 🚀 | Laban, Ate! · Fight! 🔥 |

The list used is the **sender's** grade. Grade 2 text always pairs Filipino with English (coin-text rule); buttons
show the full cheer. Cheers always say "Ate" / "Bunso" (respect words, never replaced by names); names appear only
on the buddy tag and the card title.

**Spam guard:** at most 10 cheers per local day per sender, and the same cheer id not twice within 60 seconds,
counted from her own `family_v1.sent`. When the day's 10 are used, buttons grey out with "More cheers tomorrow!"
(Grade 2: "Bukas ulit! · Again tomorrow!").

## Data

Each tablet **writes only its own learner space** and only reads the sister's.

**`family_v1`** (state, synced, in her own space):

```
{ v: 1,
  at:   <ms, last active in a lobby>,
  news: [{ id, t, kind: 'medal'|'boss'|'quests'|'streak', app?, tier?, n? }],   // newest first, max 20
  sent: [{ id, t, to: <sisterId>, cheer: <cheer id> }] }                        // last 7 days
```

- New `MERGE.family` in `sync-core.js`: union `news` and `sent` by `id`, sort by `t` descending, trim (20 news,
  `sent` older than 7 days dropped), `at` = max. Order-independent.
- **`cheers_sent_total`** (counter, existing increment-delta kind): +1 per cheer sent. The receiver's count is the
  sender's total; correct even after `sent` is trimmed. With more than 2 learners it counts all of her cheers.
- **`family_seen_v1`** (state, synced, own space): `{ cheers: <t of the newest cheer shown>, news: { <sisterId>: <t> } }`,
  merge = max per field. A cheer pops on one device only.
- **`family_peek_v1`** (device-only, own space): last read of each sister `{ <id>: { profile, world, family, total, readAt } }`,
  so the card still works offline.

**Reading the sister:** new remote call `peek(id, keys)` in `firebase-remote.js` (and the fake remote in tests)
reads `profile_v1`, `world_v1`, `family_v1` and the `cheers_sent_total` counter of each other learner from
`remote.learners()`. About 4 doc reads per sister per round. The result goes only into `family_peek_v1`, never into
her own learner keys.

**`at` writes:** set on lobby open and on each sync round only while `document.visibilityState === 'visible'`
(at most ~30 writes an hour per tablet).

**Backups:** all family keys are left out (social, not learning). Cheers only exist with the cloud, which already
keeps `cheers_sent_total`, so a backup copy adds nothing.

## Architecture

New engine file **`web/engine/family.js`** (global `Family`, `data-grade`):

- `Family.note(kind, data)` adds a news entry to `family_v1`. Does nothing while `Clock.paused()`.
  Called from the four places that already celebrate:
  - `mastery.js` medal pay (`kind:'medal'`, `app`, `tier`)
  - `boss.js` stage cleared (`kind:'boss'`, `app`)
  - `quests.js` all 3 quests done (`kind:'quests'`)
  - `quests.js` streak milestone pay (`kind:'streak'`, `n`)
  Games load family.js too, so notes are written locally in games and uploaded by the next lobby sync.
- `Family.send(sisterId, cheerId)` checks the spam guard, appends to `sent`, bumps `cheers_sent_total`.
- `World.mount` fires a `world-drawn` event on document when it has drawn the map; family.js listens and adds the
  sister buddies, the 💌 marker and the Sister card to that map. The lobby's inline scripts do not change.
- After each good sync round, `cloud.js` peeks each sister and hands the result to `Family.store()` (saved as
  `family_peek_v1`) before firing `cloud-synced`; on that event the lobby redraws the map and family.js shows unseen
  cheers through `Fx.celebrate` (waiting while another popup is open). Before the round, `cloud.js` calls
  `Family.touch()`. Signing out stores an empty peek.
- No cloud, or no sister: nothing is drawn; `note` still keeps local news so the first sync has it.

Pure logic (merge, trim, spam guard, Ate/Bunso choice, unseen selection, text) sits in testable functions exported
for Node, like `world.js` and `quests.js`.

## Edge cases

- **Offline:** sent cheers sit in her own `family_v1.sent` and upload on the next round. The card shows cached news
  with "last seen …"; no error.
- **Clock moved back:** `note` pauses; sending cheers still works (no reward). Unseen uses the sender's `t`.
- **Same child on two devices:** union merge + synced `family_seen_v1` → each cheer pops once.
- **Unknown cheer id** (older or newer app version): skipped quietly.
- **Sister deleted or renamed:** the next `learners()` list drives the view.

## Testing

- `tests/family.test.js`: note + trim, only the 4 kinds, `Clock.paused` blocks notes, spam guard (10/day, 60 s,
  local-day reset), Ate/Bunso by grade, name tag fallback, unseen cheers grouped into one popup, seen marking.
- `tests/sync.test.js`: `MERGE.family` order-independent on two simulated devices; `peek` reads only the 4 keys
  and writes nothing into her own space; `cheers_sent_total` sums across devices.
- Cheer text: every grade2 cheer has Filipino · English; both lists have the same ids in the same order.
- Wiring: family.js in PRECACHE, in every page's file-check GLOBALS, loaded by all games and both lobbies; the 4
  `Family.note` hook calls exist.
- `tests/sync.test.js` two-tablet round trip on the fake cloud: Bunso earns Bronze → Ate's peek shows the news →
  Ate cheers → Bunso's next round finds the unseen cheer → Bunso cheers back → Ate's count is 1.
- `tests/e2e/sisters-e2e.js` (one Grade 5 lobby; the cloud never runs on file://, so the sister's peek is seeded):
  buddy + 💌 marker, card news "🥉 Bronze in Math: …", sending a cheer, the 60 s and 10-a-day guards, the cheer popup,
  and no buddy without a peek. (`driver-family-*` names are already taken by the game e2e drivers.)

## Not in v1

Parent phone list of cheers, live listeners (instant cheers), team goals, real-life missions, cheers inside games,
free text.
