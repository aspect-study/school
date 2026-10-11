# On-device AI helper: engine and "Explain it another way"

Date: 2026-10-11. Sub-project 1 of 2. Sub-project 2 (the pet teacher chat in the 3D world) gets its own spec and plan
once this one is built; it reuses the engine described here.

## Goal

Run Gemma 4 E2B (open model, Apache 2.0, text + image + audio in, text out) inside the tablet's browser with WebGPU, with
no laptop and no server. Use it first for one feature: after a wrong answer, an **Explain it another way** button gives the
child a second, simpler explanation of the lesson's own facts.

The AI only adds to what exists. The hand-written `why` and `tip` stay on screen, and every game behaves exactly as it
does today when the AI is off, unsupported or not downloaded.

## Decisions (made with the owner)

- Runs in the tablet's browser (WebGPU), not on a home laptop. The girls' tablets are recent (2020 or newer).
- Runtime: Transformers.js with an ONNX build of Gemma 4 E2B. The engine hides the runtime behind a small interface so
  it can be swapped for Google's MediaPipe/LiteRT web build later.
- Language: English only. The Filipino games (Kuwentista, Wikaharian, Araling Panlipunan, Makabansa) get no button until
  the model's Filipino is trusted.
- Download: a parent turns the AI on (behind the PIN); the download then runs by itself in the background on Wi-Fi only.
- Cosmetic only: AI answers never change points, coins, review boxes or medals, and are never stored or synced.

## Out of scope

- The pet teacher chat in the world (sub-project 2).
- Reading-aloud checker (audio) and the lenient type-it check: parked ideas.
- Typed free questions to the AI, any Filipino output, any question or lesson generation.

## First task: the spike (before any plan task that depends on it)

On one of the girls' tablets, load the chosen ONNX build and record: download size, time to first answer, answer speed,
memory use, whether WebGPU initialises, and the quality of 10 sample explanations built from real lessons. The results
pick the model repo, the quantisation and the speed thresholds below, and are written back into this spec. If the
tablets cannot run it acceptably, stop and re-brainstorm (smaller model, one tablet only, or the laptop route).

## Architecture

### `web/engine/ai.js` (new, ES5 IIFE, `Ai`)

The only file games and the parent panel talk to.

- `Ai.state()` returns `off | unsupported | downloading | ready | failed`, plus `progress` (0-1) while downloading.
- `Ai.ready()` is true only when the state is `ready` for this device.
- `Ai.explain(request, done)` where `request` is the grounded facts (see Prompt) and `done(err, text)` is called once.
  Returns a handle with `cancel()`.
- `Ai.enable()` / `Ai.disable()` are called by the parent panel. `Ai.onChange(fn)` lets the UI refresh.
- Feature checks: WebGPU present, enough storage quota, the speed check (below). Any failure sets `unsupported` or
  `failed` and the AI stays hidden.

### `web/engine/ai-worker.js` (new)

A Web Worker that loads the Transformers.js module, fetches the model files, runs generation and posts back text. The
game page never blocks. Transformers.js is an ES module, so the worker is loaded as a module worker; the ES5 rule
applies to our own files, not the vendored library. The library is vendored under `web/vendor/` (or loaded from a
pinned CDN version if the spike shows vendoring is not practical) so the app still works offline once cached.

### Where the model lives

Not in the repo: GitHub Pages limits files to 100 MB and the site to about 1 GB. The files are fetched from Hugging Face
and stored in the browser's own storage (Cache Storage, or OPFS if the spike shows it is needed). The download resumes
after an interruption and starts only on Wi-Fi: `navigator.connection` is used where it exists, and where it does not
(iOS Safari) the parent switch carries a note that the download is large and should be started on home Wi-Fi.

### State and the parent switch

- One device-level key `study_ai_v1` holds `{ on: bool, child: { <learnerId>: bool } }`, written through the existing
  storage layer like `study_fil_helper_v1`. Not synced: it describes this device's downloaded model.
- Parent area, Settings tab (PIN already required): an **AI helper** row per child on this tablet with a switch and a
  status line: Off, Downloading 38%, Ready, Not supported on this tablet, Failed - try again.
- The model is downloaded once per device; the per-child switch only decides who sees the buttons.

### Prompt (grounding)

Built by a pure function in `web/engine/ai-prompt.js` (new, testable in Node) from lesson data only:

- the question, the right answer, the option the child picked, that option's `why`, the question's `tip`, and the
  lesson's flashcards for the same topic;
- the instruction: explain simply in English in 2-3 short sentences for a child in grade N, use only these facts, do not
  add new facts, do not ask questions, no links;
- if there is nothing to ground on (no `why`, no `tip`, no cards), `Ai` is not offered for that question.

Grade N is the learner's grade, so Grade 2 gets shorter words than Grade 5.

### Answer cleaning

A pure function in `ai-prompt.js`: trims to the first 60 words (cut at a sentence end), strips markdown, drops the whole
answer if it contains a link, an email, a number the lesson does not contain when the question is a number question, or a
word from a small blocklist. A dropped answer shows "Try the lesson's explanation above." in the card.

### Speed check and failure handling

- After the first load, one fixed warm-up prompt is timed. If it is slower than the spike's threshold, state becomes
  `unsupported` for that device.
- During a request: a 20 s timeout, out-of-memory, a worker error or a cancelled request all end the same way: the card
  shows the fallback line, and after two failures in a session the button is hidden until the page is reloaded.
- A request is cancelled when the child moves to the next question or leaves the game.

### The button in the games

All 17 games have the wrong-answer panel; 13 of them get the button. The wiring follows the existing per-game hook contract (like `Nav.screen`,
`Power`, `Trail.start`):

- A new engine file `web/engine/ai-explain.js` draws the button and the answer card (class `ai-card`, styled like
  `explore-card`) and is called by each game with the question's data when the wrong-answer panel opens.
- Label: **Explain it another way**. The answer card is headed **Helper's answer** so it is clear it is not the lesson's
  own text. Under it: **Thanks, got it** and **Try again** (at most 2 retries per question).
- Hidden entirely when `Ai.ready()` is false, when the learner's switch is off, or in a Filipino game.
- Reviewer-lock, power-ups, points and review are untouched: the button only appears after the answer is already
  recorded.

## Files

New: `web/engine/ai.js`, `ai-worker.js`, `ai-prompt.js`, `ai-explain.js`; vendored Transformers.js under `web/vendor/`.
Changed: `web/engine/parent-panel.js` (AI helper row); the 13 English-language games (17 minus Kuwentista, Batang
Bayani, History Explorers and Wikaharian) call `AiExplain`; `web/sw.js` precache (not the model files). After adding or removing files under `web/`, run
`node tools/update-precache.js`. A new test enforces that every English game wires the button and no Filipino game does.

## Testing

- Node unit tests: prompt building (grounded only, grade wording, nothing to ground gives no button), answer cleaning
  (word limit, links, blocklist), state machine (off, downloading, ready, unsupported, failed), switch storage.
- A fake runtime replaces the worker in tests, so `node --test` stays fast and offline.
- Headless-Chrome e2e with the fake runtime: button hidden when off, shown when ready, answer card appears, second
  failure hides the button, the game plays the same with the AI off.
- Manual on the tablets: the real model, download on Wi-Fi, resume after interruption, speed, battery, answer quality
  and wording on real lessons from both grades.

## Accepted gaps

- A 2B model can still say something slightly off even with grounding; the lesson's own text is always shown first and
  the card is labelled as the helper's.
- iOS cannot tell Wi-Fi from mobile data, so the Wi-Fi-only rule there is a note to the parent, not a guard.
- The first download is over 1 GB per tablet; the exact size and any storage-quota problems are settled by the spike.
