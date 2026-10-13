# Character chatter A2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mimi, Hoot, Bunny, the four shop owners and the 17 subject buddies show ambient word bubbles near her, from pre-written lines.

**Architecture:** A1 built the engine. A2 adds two speaker kinds to `speech.poolIds`, lists the town characters in `life.speakers()`, and adds two line files with their review sheets. Ambient only; no chat.

**Tech Stack:** As A1 (ES5 browser JS, `node --test`, headless-Chrome e2e).

Spec: `docs/superpowers/specs/2026-10-13-character-chatter-a2-design.md`. A1 plan for conventions: `docs/superpowers/plans/2026-10-13-character-chatter-a1.md`.

**Commit rule:** the agent never runs `git commit`; each task ends by giving the owner the command (`git add <files> && git commit -m '...' -- <files>`), no `Co-Authored-By` or AI line.

---

### Task 1: engine support and empty line files

**Files:**
- Modify: `web/world/speech.js` (`poolIds`), `web/world/life.js` (`speakers`), `web/world/world-main.js` (merge the new data), `tests/world3d-speech.test.js`, `tests/world3d-speech-wiring.test.js`, `tests/world3d-speech-lines.test.js`, `tools/line-sheet.js`, `tests/paths.js`, `web/world/grade-2.html`, `web/world/grade-5.html`
- Create: `web/world/speech/town.js`, `web/world/speech/buddies.js`, `docs/lines/town.md`, `docs/lines/buddies.md` (generated)

- [ ] **Step 1: Failing tests.** In `tests/world3d-speech.test.js` add: `Speech.poolIds({ id: 'mimi', kind: 'char' })` equals `['char:mimi']`; `Speech.poolIds({ id: 'buddy:life-lab', kind: 'buddy', app: 'life-lab' })` equals `['any-buddy', 'buddy:life-lab']`. In `tests/world3d-speech-wiring.test.js` add: `life.js` source contains `kind: 'char'` and `kind: 'buddy'`. In `tests/world3d-speech-lines.test.js` extend the pool-name guard to accept `char:<mimi|hoot|bunny|lana|kiko|pilo|tasyo>`, `any-buddy`, and `buddy:<app id>` for every app id in `require('./paths.js').APPS`, and add the A2 coverage test (counts from the spec; chat-only rules do not apply). Run `node --test` and see the new tests fail.
- [ ] **Step 2: Implement.** `speech.js` `poolIds`: add

  ```js
    if (sp.kind === 'char') return ['char:' + sp.id];
    if (sp.kind === 'buddy') return ['any-buddy', 'buddy:' + sp.app];
  ```

  before the final default return. `life.js` `speakers()`: after the pets, add the characters from `defs` that are not pets and not external:

  ```js
      defs.forEach(function (d) {
        var p = !d.pet && !d.external ? lastOut.poses[d.id] : null;
        if (!p) return;
        var buddy = d.id.indexOf('buddy:') === 0;
        list.push({
          id: d.id, speaker: buddy ? { id: d.id, kind: 'buddy', app: d.id.slice(6) } : { id: d.id, kind: 'char' },
          x: p.x, z: p.z, head: CHAR_HEAD + (d.fly ? p.y : 0), hidden: !!p.hidden
        });
      });
  ```

  Create `web/world/speech/town.js` and `buddies.js` as empty-pool data files in the same wrapper as `speech/pets.js` (globals `SpeechTown`, `SpeechBuddies`); add them to `WORLD_FILES` in `tests/paths.js` right after `'speech/kids.js'` and to both world pages in the same order; merge them in `world-main.js` where `speechData` is built (`W.Speech.merge(W.SpeechPets, W.SpeechKids, W.SpeechTown, W.SpeechBuddies)`); add them to `SHEETS` in `tools/line-sheet.js` (`town.md` "Town characters", `buddies.md` "Subject buddies"; extend `poolTitle` for `char:`, `buddy:` and `any-buddy`). Run `node tools/update-precache.js` and `node tools/line-sheet.js`. Expected: every test passes except the new A2 coverage test.
- [ ] **Step 3: Commit.**

```bash
git add web/world/speech.js web/world/life.js web/world/world-main.js web/world/speech/town.js web/world/speech/buddies.js web/world/grade-2.html web/world/grade-5.html web/sw.js tools/line-sheet.js docs/lines tests/paths.js tests/world3d-speech.test.js tests/world3d-speech-wiring.test.js tests/world3d-speech-lines.test.js && git commit -m 'Let town characters and subject buddies speak: new speaker kinds, empty line files and sheets' -- web/world/speech.js web/world/life.js web/world/world-main.js web/world/speech/town.js web/world/speech/buddies.js web/world/grade-2.html web/world/grade-5.html web/sw.js tools/line-sheet.js docs/lines tests/paths.js tests/world3d-speech.test.js tests/world3d-speech-wiring.test.js tests/world3d-speech-lines.test.js
```

### Task 2: write the town characters' lines

**Files:** Modify `web/world/speech/town.js`.

Content task; the guard tests are the acceptance check. Pools: `char:mimi` >= 20, `char:hoot` >= 15, `char:bunny` >= 15, `char:lana`, `char:kiko`, `char:pilo`, `char:tasyo` >= 12 each. Follow the spec's "Line rules" and voices exactly, plus A1's Voice and content rules. Ambient only (no `replies`/`follow`), English, at most 60 characters, tags and slots from `speech.js`, at least 3 open lines per pool, ids like `char-mimi-4`. Then `node tools/line-sheet.js` and `node --test tests/world3d-speech-lines.test.js tests/world3d-speech-sheets.test.js`.

- [ ] Commit: `git add web/world/speech/town.js docs/lines && git commit -m 'Write the lines for Mayor Mimi, Professor Hoot, Bunny and the four shop owners' -- web/world/speech/town.js docs/lines`

### Task 3: write the subject buddies' lines

**Files:** Modify `web/world/speech/buddies.js`.

Content task. Pools: `any-buddy` >= 40; `buddy:<app id>` >= 12 for each app id in `tests/paths.js` `APPS` (17). Voice per buddy comes from `web/world/buddies.js` (name, creature, prop: Kiko the carabao is hardworking and loves history, Fizz the frog loves experiments, Byte the robot beeps, Melody the bird sings, Bookie the worm loves books, Stitch the hedgehog loves crafts, and so on). A buddy mentions its subject lightly and warmly, never nags (see spec). Ambient only, English, at most 60 characters. Buddies that appear in both grades under different app ids (Tarsi, Kiko, Pandy) may share wording but need their own line ids. Then regenerate the sheets and run the line and sheet tests.

- [ ] Commit: `git add web/world/speech/buddies.js docs/lines && git commit -m 'Write the lines for the 17 subject buddies' -- web/world/speech/buddies.js docs/lines`

### Task 4: end-to-end check and docs

**Files:** `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`, `docs/HANDOFF.md`, `README.md`, the A2 spec if anything changed.

- [ ] Extend the A1 chatter e2e case: stand at the Plaza in Chatty for 25 s with the driver clock; some bubble shows (`D.bubbles() >= 1`). Update HANDOFF ("Character chatter A2 (2026-10-13)": files, counts, the owner reviews `docs/lines/town.md` and `buddies.md`) and README (one line). Run `node --test` and `node tests/e2e/world-e2e.js` (rerun up to 3 times if only a known flake fails, and say so).
- [ ] Commit: `git add tests/e2e docs/HANDOFF.md README.md && git commit -m 'Check town character chatter end to end and update the handoff and README' -- tests/e2e docs/HANDOFF.md README.md`

---

## Self-review

Spec coverage: speakers and pools (Task 1), lines and counts (Tasks 2, 3), e2e and docs (Task 4). The A1 silence rules, limits and bubble drawing apply unchanged. The `char` and `buddy` kinds are used consistently in speech.js, life.js and the guard tests.
