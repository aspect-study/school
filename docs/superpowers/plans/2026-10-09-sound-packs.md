# Sound packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules that override the skill defaults:** never run `git commit` (the owner does); never add `Co-Authored-By` or any AI attribution anywhere. Each task ends with a suggested commit command in a code block for the owner. Browser JS is ES5 in an IIFE (`var`, `function`, no arrow functions, no `const`/`let`) in `web/`; tests and `tools/` are modern Node. Comments only for non-obvious code. Never use fully-qualified class names inline.

**Goal:** Replace the MOBA/Valorant/LoL announcer as the default with an original, kid-friendly "Happy Chimes" pack, keep the MOBA clips as a "Battle announcer" pack, and let the learner choose in the ☰ menu of every game and in the world's ⚙️ Settings.

**Architecture:** `web/engine/fx.js` gets a `PACKS` table (`kids`, `battle`) and a device-level key `study_fx_pack_v1`; every call-out, finish, medal and sample reads the active pack. `tools/kid-sounds.js` synthesizes the kid clips into `web/assets/sounds/kids/*.wav` deterministically (no dependencies). `nav.js` and `world-main.js` add one row each that call `Fx.setPack`.

**Tech Stack:** plain browser JS (ES5 IIFE), Node 22 (`node --test`), Web Audio/HTMLAudio, headless-Chrome e2e scripts in `tests/e2e`.

Spec: `docs/superpowers/specs/2026-10-09-sound-packs-design.md`. One small addition to the spec: each pack has a `clipsAreMusic` flag (true for `kids`) meaning "the clip is itself the jingle, so the code-made stinger plays only if the clip cannot play". `speech` stays "true only for battle".

## File map

- Create `tools/kid-sounds.js` — synthesizes the 17 kid clips; exports `CLIPS`, `render`, `wav` for the test; CLI writes the files.
- Create `web/assets/sounds/kids/*.wav` — generated output (17 files).
- Create `tests/kid-sounds.test.js` — clips are valid, audible, unclipped, and in sync with the tool.
- Modify `web/engine/fx.js` — packs, pack-aware functions, `Fx.pack/setPack/packs/packLabel`.
- Modify `tests/fx.test.js` — pack tests; existing MOBA tests now name `'battle'`.
- Modify `tests/browser-globals.test.js` — `setPack` stores the key and rejects unknown ids.
- Modify `tests/learner.test.js`, `tests/storage.test.js` — the pack key is a device-level key.
- Modify `web/engine/nav.js`, `tests/nav.test.js`, `tests/e2e/driver-nav.page.js`, `tests/e2e/nav-e2e.js` — ☰ row.
- Modify `web/world/text.js`, `web/world/world-main.js`, `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js` — Settings row.
- Modify `web/sw.js` via `node tools/update-precache.js`.
- Modify `docs/HANDOFF.md`, `README.md`.

The 17 kid clips (all under `web/assets/sounds/kids/`): `nice`, `great`, `super`, `wow`, `amazing`, `fantastic`, `superstar` (streak tiers 2 to 8), `yay` (first right answer), `finish-0`, `finish-1`, `finish-2`, `finish-3` (stars), `exam-2`, `exam-3`, `medal-1`, `medal-2`, `medal-3`.

---

### Task 1: The sound generator

**Files:**
- Create: `tools/kid-sounds.js`
- Create: `tests/kid-sounds.test.js`
- Create (generated): `web/assets/sounds/kids/*.wav`

- [ ] **Step 1: Write the failing test**

Create `tests/kid-sounds.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CLIPS, render, wav, OUT, RATE } = require('../tools/kid-sounds.js');

const NAMES = ['nice', 'great', 'super', 'wow', 'amazing', 'fantastic', 'superstar', 'yay',
  'finish-0', 'finish-1', 'finish-2', 'finish-3', 'exam-2', 'exam-3', 'medal-1', 'medal-2', 'medal-3'];

test('the generator defines exactly the 17 kid clips', () => {
  assert.deepEqual(Object.keys(CLIPS).sort(), [...NAMES].sort());
});

for (const name of NAMES) {
  test('kids/' + name + '.wav is audible, not clipped, short, and matches the generator', () => {
    const buf = render(name);
    let peak = 0;
    for (const v of buf) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak > 0.3, 'audible');
    assert.ok(peak <= 0.95, 'not clipped');
    const secs = buf.length / RATE;
    assert.ok(secs >= 0.4 && secs <= 3, 'between 0.4 and 3 seconds, got ' + secs);
    const file = fs.readFileSync(path.join(OUT, name + '.wav'));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF');
    assert.equal(file.toString('ascii', 8, 12), 'WAVE');
    assert.ok(file.equals(wav(buf)), 'the file on disk is what the tool makes; run node tools/kid-sounds.js');
  });
}

test('the kids folder holds only those clips', () => {
  assert.deepEqual(fs.readdirSync(OUT).sort(), NAMES.map((n) => n + '.wav').sort());
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/kid-sounds.test.js`
Expected: FAIL with "Cannot find module '../tools/kid-sounds.js'".

- [ ] **Step 3: Write the generator**

Create `tools/kid-sounds.js`:

```js
// Makes web/assets/sounds/kids/ (the "Happy Chimes" sound pack). Every clip is original: mallet, bell, sparkle and
// "boing" tones synthesized here, so there is nothing to license. Deterministic: running it twice writes identical files.
//   node tools/kid-sounds.js
const fs = require('node:fs');
const path = require('node:path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'web', 'assets', 'sounds', 'kids');

// C major pentatonic from C5 to C7: any run of notes sounds happy.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
const SPARKLE = [2093, 2637, 3136, 3951];

function track(seconds) { return new Float32Array(Math.ceil(seconds * RATE)); }

function add(buf, at, dur, fn) {
  const start = Math.floor(at * RATE);
  const n = Math.min(Math.floor(dur * RATE), buf.length - start);
  for (let i = 0; i < n; i++) buf[start + i] += fn(i / RATE);
}

// A xylophone-like tap: a sine with a short bright overtone.
function mallet(buf, freq, at, vol) {
  add(buf, at, 0.5, (t) => vol * Math.min(1, t / 0.004) * Math.exp(-t * 7) *
    (Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.exp(-t * 30) * Math.sin(2 * Math.PI * freq * 4 * t)));
}

// A small glass bell: three inharmonic partials that fade at different speeds.
function bell(buf, freq, at, vol) {
  const partials = [[1, 1, 3], [2.76, 0.4, 5], [5.4, 0.15, 8]];
  add(buf, at, 0.9, (t) => vol * Math.min(1, t / 0.003) *
    partials.reduce((sum, p) => sum + p[1] * Math.exp(-t * p[2]) * Math.sin(2 * Math.PI * freq * p[0] * t), 0));
}

function chord(buf, freqs, at, vol) { freqs.forEach((f) => bell(buf, f, at, vol)); }

// A bouncy "boing": a sine that sweeps up, then wobbles down.
function boing(buf, at, vol) {
  add(buf, at, 0.28, (t) => {
    const f = 300 + 500 * Math.sin(Math.min(1, t / 0.12) * Math.PI / 2) - 250 * Math.max(0, t - 0.12) / 0.16 + 25 * Math.sin(2 * Math.PI * 28 * t);
    return vol * Math.min(1, t / 0.005) * Math.exp(-t * 6) * Math.sin(2 * Math.PI * f * t);
  });
}

function sparkle(buf, at, count, vol) {
  for (let k = 0; k < count; k++) {
    const f = SPARKLE[k % SPARKLE.length] * (k >= SPARKLE.length ? 1.25 : 1);
    add(buf, at + k * 0.075, 0.14, (t) => vol * Math.min(1, t / 0.002) * Math.exp(-t * 28) * Math.sin(2 * Math.PI * f * t));
  }
}

// notes PENTA[from], PENTA[from + 1], ... one every gap seconds.
function run(buf, from, count, gap, at, vol) {
  for (let k = 0; k < count; k++) mallet(buf, PENTA[from + k], (at || 0) + k * gap, vol || 0.5);
}

function finish(buf) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const scale = peak > 0 ? 0.8 / peak : 1;
  const fade = Math.floor(0.01 * RATE);
  for (let i = 0; i < buf.length; i++) {
    buf[i] *= scale;
    if (i > buf.length - fade) buf[i] *= (buf.length - i) / fade;
  }
  return buf;
}

// name -> seconds and how to play it.
const CLIPS = {
  nice: [0.9, (b) => { run(b, 0, 3, 0.11); }],
  great: [1.0, (b) => { run(b, 1, 4, 0.1); }],
  super: [1.2, (b) => { run(b, 1, 5, 0.09); bell(b, PENTA[6], 0.45, 0.4); }],
  wow: [1.3, (b) => { run(b, 2, 5, 0.09); sparkle(b, 0.45, 4, 0.25); bell(b, PENTA[7], 0.4, 0.4); }],
  amazing: [1.5, (b) => { run(b, 2, 6, 0.08); chord(b, [PENTA[8], PENTA[5]], 0.5, 0.3); sparkle(b, 0.55, 5, 0.25); }],
  fantastic: [1.7, (b) => { boing(b, 0, 0.5); run(b, 2, 7, 0.08, 0.25); chord(b, [PENTA[9], PENTA[6]], 0.8, 0.3); sparkle(b, 0.85, 6, 0.25); }],
  superstar: [2.0, (b) => { boing(b, 0, 0.5); run(b, 2, 8, 0.075, 0.25); chord(b, [PENTA[10], PENTA[7], PENTA[5]], 0.85, 0.3); sparkle(b, 0.9, 8, 0.25); }],
  yay: [0.8, (b) => { boing(b, 0, 0.45); mallet(b, PENTA[7], 0.2, 0.5); mallet(b, PENTA[8], 0.32, 0.5); }],
  'finish-0': [0.9, (b) => { mallet(b, PENTA[0], 0, 0.4); mallet(b, PENTA[2], 0.18, 0.4); bell(b, PENTA[3], 0.34, 0.25); }],
  'finish-1': [1.1, (b) => { run(b, 0, 3, 0.15); bell(b, PENTA[5], 0.45, 0.3); }],
  'finish-2': [1.4, (b) => { run(b, 0, 4, 0.13); chord(b, [PENTA[5], PENTA[3]], 0.55, 0.3); }],
  'finish-3': [2.0, (b) => { run(b, 0, 7, 0.1); chord(b, [PENTA[8], PENTA[5], PENTA[3]], 0.75, 0.3); sparkle(b, 0.8, 7, 0.25); }],
  'exam-2': [1.7, (b) => { run(b, 1, 6, 0.1); chord(b, [PENTA[8], PENTA[6]], 0.65, 0.3); sparkle(b, 0.7, 4, 0.2); }],
  'exam-3': [2.5, (b) => { boing(b, 0, 0.45); run(b, 0, 9, 0.09, 0.25); chord(b, [PENTA[10], PENTA[7], PENTA[5]], 1.05, 0.3); sparkle(b, 1.1, 10, 0.25); }],
  'medal-1': [1.2, (b) => { mallet(b, PENTA[3], 0, 0.5); mallet(b, PENTA[5], 0.14, 0.5); bell(b, PENTA[6], 0.3, 0.35); }],
  'medal-2': [1.5, (b) => { run(b, 2, 3, 0.13); chord(b, [PENTA[7], PENTA[5]], 0.45, 0.3); sparkle(b, 0.5, 3, 0.2); }],
  'medal-3': [2.2, (b) => { run(b, 1, 6, 0.1); chord(b, [PENTA[9], PENTA[6], PENTA[4]], 0.7, 0.3); sparkle(b, 0.8, 8, 0.25); }]
};

function render(name) {
  const [secs, play] = CLIPS[name];
  const buf = track(secs);
  play(buf);
  return finish(buf);
}

// 16-bit mono PCM wav.
function wav(buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  Object.keys(CLIPS).forEach((name) => fs.writeFileSync(path.join(OUT, name + '.wav'), wav(render(name))));
  console.log('wrote ' + Object.keys(CLIPS).length + ' clips to ' + OUT);
}

if (require.main === module) main();
module.exports = { CLIPS, render, wav, OUT, RATE };
```

- [ ] **Step 4: Generate the clips and run the test**

Run: `node tools/kid-sounds.js && node --test tests/kid-sounds.test.js`
Expected: `wrote 17 clips to ...\web\assets\sounds\kids`, then all kid-sounds tests PASS.
If `peak > 0.3` or the length bound fails for a clip, the tool's `finish()` already scales peak to 0.8, so a failure means a clip is silent or the wrong length: fix that clip's seconds or notes, regenerate, rerun.

- [ ] **Step 5: Listen**

Ask the owner to play a few of `web/assets/sounds/kids/nice.wav`, `superstar.wav`, `finish-3.wav`, `medal-3.wav` (double-click in Explorer) and say if any should be higher, softer or shorter; tweak the notes in `CLIPS`, rerun `node tools/kid-sounds.js`, rerun the test. This is the one subjective step; do not skip it, but do not block the remaining tasks on it either (the clips are regenerated by the same command at any time).

- [ ] **Step 6: Suggested commit**

```bash
git add tools/kid-sounds.js tests/kid-sounds.test.js web/assets/sounds/kids && git commit -m 'Sounds: original Happy Chimes clips generated by tools/kid-sounds.js (17 wav, deterministic, tested)' -- tools/kid-sounds.js tests/kid-sounds.test.js web/assets/sounds/kids
```

---

### Task 2: Packs in `fx.js`

**Files:**
- Modify: `web/engine/fx.js`
- Modify: `tests/fx.test.js`
- Modify: `tests/browser-globals.test.js`
- Modify: `tests/learner.test.js`, `tests/storage.test.js`

- [ ] **Step 1: Rewrite the pure-data tests first**

In `tests/fx.test.js` replace the import line and the five tests from `the streak announcer climbs…` through `every voice clip is in assets/sounds…` with the block below (keep everything after `the call-out subtitle speaks…` as is).

Import line becomes:

```js
const { order, tierFor, PACKS, PACK_IDS, DEFAULT_PACK, PACK_KEY, finishClip, medalClip, allClips, SUBTITLE, POP_MS, POP_CLOSE } = require(engineFile('fx.js'));
```

Replacement tests:

```js
test('there are two packs and Happy Chimes is the default', () => {
  assert.deepEqual(PACK_IDS, ['kids', 'battle']);
  assert.equal(DEFAULT_PACK, 'kids');
  assert.equal(PACK_KEY, 'study_fx_pack_v1');
  assert.equal(PACKS.kids.label, 'Happy Chimes');
  assert.equal(PACKS.battle.label, 'Battle announcer');
  assert.equal(PACKS.kids.speech, false, 'no robotic speech in the kid pack');
  assert.equal(PACKS.battle.speech, true);
  assert.equal(PACKS.kids.clipsAreMusic, true);
  assert.equal(PACKS.battle.clipsAreMusic, false);
});

test('the battle announcer climbs one tier per answer in a row and stays legendary', () => {
  assert.equal(tierFor(0, 'battle'), null);
  assert.equal(tierFor(1, 'battle'), null, 'a single right answer only dings');
  const words = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => tierFor(n, 'battle').word);
  assert.deepEqual(words, ['DOUBLE KILL!', 'TRIPLE KILL!', 'MANIAC!', 'SAVAGE!!!', 'DOMINATING!', 'UNSTOPPABLE!', 'LEGENDARY!', 'LEGENDARY!', 'LEGENDARY!']);
});

test('Happy Chimes climbs the same tiers with friendly words', () => {
  assert.equal(tierFor(0), null);
  assert.equal(tierFor(1), null);
  const words = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => tierFor(n).word);
  assert.deepEqual(words, ['NICE!', 'GREAT!', 'SUPER!', 'WOW!', 'AMAZING!', 'FANTASTIC!', 'SUPERSTAR!', 'SUPERSTAR!']);
  assert.equal(PACKS.kids.firstBlood.word, 'YAY!');
  assert.deepEqual(PACKS.kids.tiers.map((t) => t.at), PACKS.battle.tiers.map((t) => t.at), 'same streak lengths in both packs');
  assert.equal(PACKS.kids.tiers[PACKS.kids.tiers.length - 1].rays, true);
});

test('each battle call-out has its own voice clip, and the first right answer of a round is First Blood', () => {
  assert.deepEqual(PACKS.battle.tiers.map((t) => t.clip), ['double-kill.mp3', 'triple-kill.mp3', 'maniac.mp3', 'savage.mp3', 'dominating.mp3', 'unstoppable.mp3', 'legendary.mp3']);
  assert.equal(PACKS.battle.firstBlood.word, 'FIRST BLOOD!');
  assert.equal(PACKS.battle.firstBlood.clip, 'first-blood.mp3');
});

test('the end of a battle round speaks by stars; a perfect round is Ace, a mock exam has its own top two', () => {
  assert.deepEqual([0, 1, 2, 3].map((n) => finishClip(n, false, 'battle')), ['valorant-1-kill.mp3', 'valorant-2-kills.mp3', 'valorant-3-kills.mp3', 'valorant-ace.mp3']);
  assert.deepEqual([0, 1, 2, 3].map((n) => finishClip(n, true, 'battle')), ['valorant-1-kill.mp3', 'valorant-2-kills.mp3', 'valorant-4-kills.mp3', 'lol-legendary-kill.mp3']);
});

test('the end of a Happy Chimes round plays a jingle by stars, with its own exam top two', () => {
  assert.deepEqual([0, 1, 2, 3].map((n) => finishClip(n, false)), ['kids/finish-0.wav', 'kids/finish-1.wav', 'kids/finish-2.wav', 'kids/finish-3.wav']);
  assert.deepEqual([0, 1, 2, 3].map((n) => finishClip(n, true)), ['kids/finish-0.wav', 'kids/finish-1.wav', 'kids/exam-2.wav', 'kids/exam-3.wav']);
});

test('a medal popup plays by its best medal; other popups only chime', () => {
  assert.equal(medalClip([{ medal: 1 }], 'battle'), 'lol-quadra-kill.mp3');
  assert.equal(medalClip([{ medal: 1 }, { medal: 2 }, {}], 'battle'), 'valorant-5-kills.mp3');
  assert.equal(medalClip([{ medal: 3 }], 'battle'), 'lol-penta-kill.mp3');
  assert.equal(medalClip([{ icon: '🔧' }], 'battle'), null);
  assert.equal(medalClip([{ medal: 1 }, { medal: 3 }]), 'kids/medal-3.wav');
  assert.equal(medalClip([{ icon: '🔧' }]), null);
});

test('an unknown pack id falls back to Happy Chimes', () => {
  assert.equal(tierFor(2, 'nope').word, 'NICE!');
  assert.equal(tierFor(2, '__proto__').word, 'NICE!');
  assert.deepEqual(allClips('nope'), allClips('kids'));
});

test('every battle clip is in assets/sounds and every file there is used', () => {
  const dir = path.join(WEB, 'assets', 'sounds');
  const used = [...new Set(allClips('battle'))].sort();
  assert.equal(used.length, allClips('battle').length, 'no clip is used twice');
  const files = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  assert.deepEqual(files.sort(), used);
});

test('every Happy Chimes clip is in assets/sounds/kids and every file there is used', () => {
  const dir = path.join(WEB, 'assets', 'sounds', 'kids');
  const used = [...new Set(allClips('kids'))].sort();
  assert.equal(used.length, allClips('kids').length, 'no clip is used twice');
  assert.deepEqual(fs.readdirSync(dir).map((n) => 'kids/' + n).sort(), used);
});
```

- [ ] **Step 2: Add the stateful tests**

Append to `tests/browser-globals.test.js` right after the `Fx.setMuted switches the saved sound setting` test (it already imports `vm`, `fs` and `engineFile`):

```js
function fxWindow(data) {
  const win = {
    localStorage: { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
    document: { readyState: 'loading', addEventListener() {}, currentScript: null, getElementById: () => null },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('fx.js'), 'utf8'), win);
  return win;
}

test('Fx.setPack saves the sound pack, ignores unknown ids and defaults to Happy Chimes', () => {
  const data = {};
  const win = fxWindow(data);
  assert.equal(win.Fx.pack(), 'kids');
  assert.deepEqual(Array.from(win.Fx.packs()), ['kids', 'battle']);
  assert.equal(win.Fx.packLabel('battle'), 'Battle announcer');
  win.Fx.setPack('battle');
  assert.equal(win.Fx.pack(), 'battle');
  assert.equal(data.study_fx_pack_v1, 'battle');
  win.Fx.setPack('nope');
  win.Fx.setPack('__proto__');
  assert.equal(win.Fx.pack(), 'battle');
  assert.equal(fxWindow({ study_fx_pack_v1: 'battle' }).Fx.pack(), 'battle', 'a saved choice survives a reload');
  assert.equal(fxWindow({ study_fx_pack_v1: 'junk' }).Fx.pack(), 'kids', 'a bad saved value means the default');
});

test('Fx.setPack still switches for the page when storage is unavailable', () => {
  const win = fxWindow({});
  win.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  win.Fx.setPack('battle');
  assert.equal(win.Fx.pack(), 'battle');
});
```

In `tests/learner.test.js` after the line `assert.equal(legacyKey('study_fx_muted_v1'), null, 'device settings stay global');` add:

```js
  assert.equal(legacyKey('study_fx_pack_v1'), null, 'the sound pack is a device setting too');
```

In `tests/storage.test.js` change `study_fx_muted_v1: '1' }` on line 68 to `study_fx_muted_v1: '1', study_fx_pack_v1: 'battle' }` and, in the assertions that follow that line, mirror whatever the test asserts for `study_fx_muted_v1` (read the next ten lines; if none asserts on it, leave only the input change).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/fx.test.js tests/browser-globals.test.js tests/learner.test.js tests/storage.test.js`
Expected: FAIL (`PACKS`, `PACK_IDS`, `Fx.pack` not defined).

- [ ] **Step 4: Rewrite the data section of `fx.js` (lines 6 to 56)**

Replace from `var MUTE_KEY = ...` through the end of `tierFor` (just before the comment `// soundDir: the URL of assets/sounds/`) with:

```js
  var MUTE_KEY = 'study_fx_muted_v1';
  var PACK_KEY = 'study_fx_pack_v1';
  var DEFAULT_PACK = 'kids';
  var PACK_IDS = ['kids', 'battle'];
  var POP_MS = { small: 4000, big: 6000 };
  var POP_CLOSE = 'Nice!';

  // speech: the device voice stands in for a clip that cannot play. clipsAreMusic: the clip is itself the jingle, so the
  // synthesized stinger plays only when the clip cannot.
  var PACKS = {
    kids: {
      label: 'Happy Chimes',
      speech: false,
      clipsAreMusic: true,
      tiers: [
        { at: 2, word: 'NICE!', clip: 'kids/nice.wav', color: '#38bdf8', glow: '#bae6fd', notes: 2 },
        { at: 3, word: 'GREAT!', clip: 'kids/great.wav', color: '#34d399', glow: '#a7f3d0', notes: 3 },
        { at: 4, word: 'SUPER!', clip: 'kids/super.wav', color: '#f472b6', glow: '#fbcfe8', notes: 4 },
        { at: 5, word: 'WOW!', clip: 'kids/wow.wav', color: '#a78bfa', glow: '#ddd6fe', notes: 5, big: true },
        { at: 6, word: 'AMAZING!', clip: 'kids/amazing.wav', color: '#fb923c', glow: '#fed7aa', notes: 5, big: true },
        { at: 7, word: 'FANTASTIC!', clip: 'kids/fantastic.wav', color: '#facc15', glow: '#fef08a', notes: 6, big: true },
        { at: 8, word: 'SUPERSTAR!', clip: 'kids/superstar.wav', color: '#f59e0b', glow: '#fef08a', notes: 7, big: true, rays: true }
      ],
      firstBlood: { word: 'YAY!', clip: 'kids/yay.wav', color: '#f472b6', glow: '#fbcfe8', notes: 1 },
      finishClips: ['kids/finish-0.wav', 'kids/finish-1.wav', 'kids/finish-2.wav', 'kids/finish-3.wav'],
      examClips: { 2: 'kids/exam-2.wav', 3: 'kids/exam-3.wav' },
      medalClips: { 1: 'kids/medal-1.wav', 2: 'kids/medal-2.wav', 3: 'kids/medal-3.wav' }
    },
    // Mobile Legends-style streak announcer, one tier per answer in a row.
    battle: {
      label: 'Battle announcer',
      speech: true,
      clipsAreMusic: false,
      tiers: [
        { at: 2, word: 'DOUBLE KILL!', say: 'Double kill!', clip: 'double-kill.mp3', color: '#3b82f6', glow: '#93c5fd', notes: 2 },
        { at: 3, word: 'TRIPLE KILL!', say: 'Triple kill!', clip: 'triple-kill.mp3', color: '#10b981', glow: '#6ee7b7', notes: 3 },
        { at: 4, word: 'MANIAC!', say: 'Maniac!', clip: 'maniac.mp3', color: '#a855f7', glow: '#d8b4fe', notes: 4 },
        { at: 5, word: 'SAVAGE!!!', say: 'Savage!', clip: 'savage.mp3', color: '#ef4444', glow: '#fca5a5', notes: 5, big: true },
        { at: 6, word: 'DOMINATING!', say: 'Dominating!', clip: 'dominating.mp3', color: '#f97316', glow: '#fdba74', notes: 5, big: true },
        { at: 7, word: 'UNSTOPPABLE!', say: 'Unstoppable!', clip: 'unstoppable.mp3', color: '#eab308', glow: '#fde047', notes: 6, big: true },
        { at: 8, word: 'LEGENDARY!', say: 'Legendary!', clip: 'legendary.mp3', color: '#f59e0b', glow: '#fef08a', notes: 7, big: true, rays: true }
      ],
      // The first unhelped right answer of each round.
      firstBlood: { word: 'FIRST BLOOD!', say: 'First blood!', clip: 'first-blood.mp3', color: '#dc2626', glow: '#fca5a5', notes: 1 },
      // The voice at the end of a round, by stars (3 = every answer right). A mock exam has its own top two.
      finishClips: ['valorant-1-kill.mp3', 'valorant-2-kills.mp3', 'valorant-3-kills.mp3', 'valorant-ace.mp3'],
      examClips: { 2: 'valorant-4-kills.mp3', 3: 'lol-legendary-kill.mp3' },
      // A popup's voice by its best medal: 1 Bronze, 2 Silver, 3 Gold (also an all-Bronze/Silver/Gold game).
      medalClips: { 1: 'lol-quadra-kill.mp3', 2: 'valorant-5-kills.mp3', 3: 'lol-penta-kill.mp3' }
    }
  };

  function known(id) { return Object.prototype.hasOwnProperty.call(PACKS, id); }
  function packOf(id) { return PACKS[known(id) ? id : DEFAULT_PACK]; }

  function finishClip(stars, exam, id) {
    var p = packOf(id);
    var n = Math.max(0, Math.min(3, stars | 0));
    return (exam && p.examClips[n]) || p.finishClips[n];
  }

  function medalClip(events, id) {
    var best = 0;
    (events || []).forEach(function (e) { if (e.medal > best) best = e.medal; });
    return packOf(id).medalClips[best] || null;
  }

  function allClips(id) {
    var p = packOf(id);
    var list = p.tiers.map(function (t) { return t.clip; }).concat(p.firstBlood.clip, p.finishClips);
    [p.examClips, p.medalClips].forEach(function (m) { Object.keys(m).forEach(function (k) { list.push(m[k]); }); });
    return list;
  }

  var SUBTITLE = {
    grade5: function (n) { return '🔥 ' + n + ' in a row!'; },
    grade2: function (n) { return '🔥 ' + n + ' sunod-sunod na tama! · ' + n + ' in a row!'; }
  };

  function tierFor(streak, id) {
    var tiers = packOf(id).tiers;
    var found = null;
    for (var i = 0; i < tiers.length; i++) if (streak >= tiers[i].at) found = tiers[i];
    return found;
  }
```

- [ ] **Step 5: Make `create()` read the active pack**

Inside `create`:

(a) After `var subtitle = SUBTITLE[grade] || SUBTITLE.grade5;` add:

```js
    var memPack = null;
```

(b) After `function muted() { ... }` add:

```js
    function packId() {
      var saved = read(PACK_KEY);
      if (known(saved)) return saved;
      return known(memPack) ? memPack : DEFAULT_PACK;
    }
```

(c) Replace `function correct(streak, o) {...}` with:

```js
    function stinger(tier, loud) {
      arpeggio(tier.notes, 0.07, loud && tier.big ? 'square' : 'triangle', loud && tier.big ? 0.07 : 0.12);
      if (loud && tier.big) tone(110, 0.05, 0.4, 'sawtooth', 0.08, 55);
    }

    function correct(streak, o) {
      var id = packId(), p = PACKS[id];
      if (o && o.exam) examRound = true;
      tone(880, 0, 0.12, 'sine', 0.18);
      tone(1319, 0.08, 0.2, 'sine', 0.18);
      var tier = tierFor(streak, id);
      if (!tier && streak === 1 && !blooded) tier = p.firstBlood;
      if (streak > 0) blooded = true;
      if (!tier) return;
      if (!p.clipsAreMusic) stinger(tier, true);
      clip(tier.clip, function () {
        if (p.speech) say(tier.say);
        if (p.clipsAreMusic) stinger(tier, false);
      });
      show(tier.word, subtitle(streak), tier);
    }
```

(d) Replace `function finish(stars) {...}` with:

```js
    function jingle(stars) {
      if (stars >= 3) {
        [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.16); });
        tone(1047, 0.5, 0.6, 'triangle', 0.14);
        tone(1319, 0.5, 0.6, 'sine', 0.1);
        tone(1568, 0.5, 0.6, 'sine', 0.08);
      } else if (stars >= 1) {
        [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.15); });
        tone(1047, 0.38, 0.4, 'triangle', 0.13);
      } else {
        tone(523, 0, 0.25, 'triangle', 0.13);
        tone(784, 0.15, 0.35, 'triangle', 0.13);
      }
    }

    function finish(stars) {
      var id = packId(), musical = PACKS[id].clipsAreMusic;
      if (!musical) jingle(stars);
      clip(finishClip(stars, examRound, id), musical ? function () { jingle(stars); } : null);
      if (stars >= 3) show('PERFECT!', '⭐⭐⭐', { color: '#eab308', glow: '#fde047', big: true, rays: true });
    }
```

(e) In `openPop`, replace

```js
      fanfare(big);
      var voice = medalClip(events);
      if (voice) clip(voice);
```

with:

```js
      var id = packId(), voice = medalClip(events, id);
      var musical = !!voice && PACKS[id].clipsAreMusic;
      if (!musical) fanfare(big);
      if (voice) clip(voice, musical ? function () { fanfare(big); } : null);
```

(f) After `function setMuted(on) {...}` add:

```js
    function setPack(id) {
      if (!known(id)) return;
      memPack = id;
      write(PACK_KEY, id);
      var sample = tierFor(2, id);
      clip(sample.clip, function () { if (PACKS[id].speech) say(sample.say); });
    }
```

(g) In `start()` change `allClips().forEach(clipAudio)` to `allClips(packId()).forEach(clipAudio)`.

(h) Replace the `return { pop: popSound, ...` object with the same list plus the new members:

```js
    return { pop: popSound, hold: hold, round: round, correct: correct, wrong: wrong, finish: finish, purchase: purchase, muted: muted, setMuted: setMuted,
      pack: packId, setPack: setPack, packs: function () { return PACK_IDS.slice(); }, packLabel: function (id) { return known(id) ? PACKS[id].label : ''; },
      celebrate: celebrate, celebrateNow: openPop, cardRead: cardRead, allRead: allRead, queued: function () { return queued; } };
```

(i) Replace the `var exported = {...}` line with:

```js
  var exported = { order: order, tierFor: tierFor, PACKS: PACKS, PACK_IDS: PACK_IDS, DEFAULT_PACK: DEFAULT_PACK, PACK_KEY: PACK_KEY, finishClip: finishClip, medalClip: medalClip, allClips: allClips, SUBTITLE: SUBTITLE, MUTE_KEY: MUTE_KEY, POP_MS: POP_MS, POP_CLOSE: POP_CLOSE };
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/fx.test.js tests/browser-globals.test.js tests/learner.test.js tests/storage.test.js tests/kid-sounds.test.js`
Expected: all PASS. If an unrelated test still imports `TIERS` or `FIRST_BLOOD` from fx.js, run `grep -rn "TIERS\|FIRST_BLOOD" tests web --include=*.js` and update it to `PACKS.battle.tiers` / `PACKS.battle.firstBlood`.

- [ ] **Step 7: Suggested commit**

```bash
git add web/engine/fx.js tests/fx.test.js tests/browser-globals.test.js tests/learner.test.js tests/storage.test.js && git commit -m 'Fx: sound packs (Happy Chimes default, Battle announcer kept); Fx.pack/setPack/packs/packLabel; study_fx_pack_v1 is a device setting' -- web/engine/fx.js tests/fx.test.js tests/browser-globals.test.js tests/learner.test.js tests/storage.test.js
```

---

### Task 3: The ☰ menu row

**Files:**
- Modify: `web/engine/nav.js`
- Modify: `tests/nav.test.js`
- Modify: `tests/e2e/driver-nav.page.js`, `tests/e2e/nav-e2e.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/nav.test.js`:

```js
test('the menu has a sound-pack label in both grades, paired in Grade 2', () => {
  assert.equal(TEXT.grade5.soundPack, '🎵 Sounds');
  assert.equal(TEXT.grade2.soundPack, '🎵 Sounds · Mga tunog');
});
```

In `tests/e2e/driver-nav.page.js`, after `$('nav-sound').click();` (the second one, which switches sound back) and before `$('nav-shop').click();` add:

```js
  var packBefore = window.Fx.pack();
  out.packLabel = $('nav-pack').textContent;
  $('nav-pack').click();
  out.packChanged = window.Fx.pack() !== packBefore;
  out.packLabelAfter = $('nav-pack').textContent;
  $('nav-pack').click();
  out.packBack = window.Fx.pack() === packBefore;
  out.menuStillOpen = !$('nav-sheet').hidden;
```

In `tests/e2e/nav-e2e.js` after the line `assert.equal(r.soundToggled, true, c.id + ': the menu switches sound');` add:

```js
    assert.match(r.packLabel, /^🎵 Sounds.*: Happy Chimes$/, c.id + ': the menu shows the sound pack, Happy Chimes by default');
    assert.equal(r.packChanged, true, c.id + ': tapping the pack row changes the pack');
    assert.match(r.packLabelAfter, /: Battle announcer$/, c.id + ': the row shows the new pack');
    assert.equal(r.packBack, true, c.id + ': a second tap cycles back');
    assert.equal(r.menuStillOpen, true, c.id + ': the menu stays open like the sound row');
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/nav.test.js`
Expected: FAIL (`soundPack` undefined).

- [ ] **Step 3: Implement in `nav.js`**

In `TEXT.grade5` add `soundPack: '🎵 Sounds',` after `soundOn…soundOff…` line; in `TEXT.grade2` add `soundPack: '🎵 Sounds · Mga tunog',` after `soundOff: …,`.

Line 116: add `packBtn = null,` to the `var ctl = null, sheet = null, …, soundBtn = null, keepBtn = null;` declaration (after `soundBtn = null,`).

Replace `function renderSound() {...}` with:

```js
    function renderSound() {
      if (packBtn) packBtn.textContent = t.soundPack + ': ' + win.Fx.packLabel(win.Fx.pack());
      if (!soundBtn) return;
      var m = win.Fx.muted();
      soundBtn.textContent = m ? t.soundOff : t.soundOn;
      soundBtn.setAttribute('aria-checked', m ? 'false' : 'true');
    }

    function nextPack() {
      var ids = win.Fx.packs();
      win.Fx.setPack(ids[(ids.indexOf(win.Fx.pack()) + 1) % ids.length]);
    }
```

After the `if (win.Fx && win.Fx.setMuted) {...}` block add:

```js
      if (win.Fx && win.Fx.setPack) {
        packBtn = button('nav-pack', 'gnav-item', '', null, function () { nextPack(); renderSound(); });
        items.push(packBtn);
      }
```

- [ ] **Step 4: Run unit and e2e tests**

Run: `node --test tests/nav.test.js tests/nav-wiring.test.js && node tests/e2e/nav-e2e.js`
Expected: PASS; the e2e prints its ok lines for every game.

- [ ] **Step 5: Suggested commit**

```bash
git add web/engine/nav.js tests/nav.test.js tests/e2e/driver-nav.page.js tests/e2e/nav-e2e.js && git commit -m 'Nav: Sounds row in the menu of every game to switch Happy Chimes / Battle announcer' -- web/engine/nav.js tests/nav.test.js tests/e2e/driver-nav.page.js tests/e2e/nav-e2e.js
```

---

### Task 4: World Settings row

**Files:**
- Modify: `web/world/text.js`
- Modify: `web/world/world-main.js`
- Modify: `tests/e2e/world-driver.page.js`, `tests/e2e/world-e2e.js`

- [ ] **Step 1: Write the failing e2e check**

In `tests/e2e/world-driver.page.js`, in the `mode === 'sounds'` block, after `o.stepsLabel = ...;` add:

```js
      var packRow = [].filter.call(document.querySelectorAll('.w-setting'), function (r) { return r.textContent.indexOf('🎵') >= 0 && r.textContent.indexOf('Battle') >= 0; })[0];
      o.packLabel = packRow ? packRow.firstChild.textContent : null;
      o.packBefore = Fx.pack();
      var battle = packRow ? [].filter.call(packRow.querySelectorAll('button'), function (b) { return b.textContent === 'Battle announcer'; })[0] : null;
      if (battle) battle.click();
      o.packAfter = Fx.pack();
      o.packPressed = battle ? battle.getAttribute('aria-pressed') : null;
```

In `tests/e2e/world-e2e.js` after the line `assert.equal(snd.prefs.steps, false, ...)` add:

```js
  assert.equal(snd.packLabel, '🎵 Sounds');
  assert.equal(snd.packBefore, 'kids', 'Happy Chimes is the default');
  assert.equal(snd.packAfter, 'battle', 'the Settings choice switches the pack');
  assert.equal(snd.packPressed, 'true');
```

Note: `row.firstChild.textContent` is the label span, and the Music row also contains 🎵, so the driver finds the pack row by the word `Battle` in its buttons. The Music row label is `🎵 Music`, hence the pack label must be `🎵 Sounds`.

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/e2e/world-e2e.js`
Expected: FAIL at the new assertions (`packLabel` null).

- [ ] **Step 3: Implement**

In `web/world/text.js` add `soundPack: '🎵 Sounds',` in the grade 5 object right after `sound: '🔊 Sound',` (line 48, same object literal) and `soundPack: '🎵 Mga tunog · Sounds',` in the grade 2 object right after `sound: '🔊 Tunog · Sound',` (line 88).

In `web/world/world-main.js` `openSettings`, after the `setting(T.sound, ...)` block and before `setting(T.steps, ...)` add:

```js
      if (root.Fx && root.Fx.setPack) {
        var packs = root.Fx.packs().map(function (id) { return { value: id, text: root.Fx.packLabel(id) }; });
        setting(T.soundPack, packs, root.Fx.pack(), function (id) { root.Fx.setPack(id); });
      }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world3d-text.test.js tests/world-wiring.test.js && node tests/e2e/world-e2e.js`
Expected: PASS. (`world3d-text.test.js` checks Grade 2 pairing and Filipino rules; `Mga tunog · Sounds` follows the Filipino-first pairing used by the neighbouring labels.)

- [ ] **Step 5: Suggested commit**

```bash
git add web/world/text.js web/world/world-main.js tests/e2e/world-driver.page.js tests/e2e/world-e2e.js && git commit -m 'World: Sounds choice in Settings (Happy Chimes / Battle announcer), same shared setting as the game menu' -- web/world/text.js web/world/world-main.js tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 5: Precache, docs, full verification

**Files:**
- Modify: `web/sw.js` (generated)
- Modify: `docs/HANDOFF.md`, `README.md`

- [ ] **Step 1: Regenerate the offline list**

Run: `node tools/update-precache.js`
Expected: `web/sw.js` gains 17 `assets/sounds/kids/*.wav` lines; `git diff --stat web/sw.js` shows only additions (the cache version line may also change if the tool bumps it).

- [ ] **Step 2: Docs**

Read `docs/HANDOFF.md` and `README.md`. In `README.md`, where sounds or Fx are described (search for `fx.js` and `assets/sounds`), add: sound packs, `Fx.pack/setPack`, the key `study_fx_pack_v1`, `tools/kid-sounds.js` (how to regenerate), and that the battle clips are only played when "Battle announcer" is chosen. In `docs/HANDOFF.md`, add a "Sound packs (2026-10-09)" entry under built, noting the default is Happy Chimes, MOBA clips are kept for the Battle announcer, the world's own sounds were not changed, and the spec/plan paths.

- [ ] **Step 3: Full verification**

Run, in order, and check each passes:

```bash
node --test
node tests/e2e/nav-e2e.js
node tests/e2e/lobby-e2e.js
node tests/e2e/apps-e2e.js
node tests/e2e/world-e2e.js
git log origin/main..HEAD --grep='Co-Authored-By\|Claude-Session'
```

Expected: every test and e2e passes; the final `git log` prints nothing.

- [ ] **Step 4: Manual check (owner)**

On a tablet or the browser: open any game, answer 2, 3, 5 and 8 in a row and finish a round: you hear the new chimes and see NICE!/GREAT!/WOW!/SUPERSTAR!. Open ☰, tap the Sounds row: it switches to Battle announcer and plays "Double kill!"; the world's ⚙️ Settings shows the same choice. Check the volume of the chimes against the world music and say if any clip should be softer, higher or shorter; regenerate with `node tools/kid-sounds.js`.

- [ ] **Step 5: Suggested commit**

```bash
git add web/sw.js docs/HANDOFF.md README.md docs/superpowers/plans/2026-10-09-sound-packs.md && git commit -m 'Sound packs: precache the kids clips, docs and plan' -- web/sw.js docs/HANDOFF.md README.md docs/superpowers/plans/2026-10-09-sound-packs.md
```

---

## Self-review

- **Spec coverage:** packs table and storage key (Task 2); kids pack words/clips/no speech (Task 2); generator with 17 clips (Task 1); `Fx.pack/setPack` with sample and unknown-id rejection (Task 2); warm-up only for the active pack (Task 2 g); ☰ row (Task 3); world Settings row (Task 4); localStorage-blocked fallback (Task 2 test + `memPack`); precache and tests for device-level key (Tasks 2, 5); docs (Task 5); world's own sounds untouched (no task touches `sfx.js`).
- **Placeholders:** none; the only open-ended step is the listening check (Task 1 step 5), which is deliberately subjective and non-blocking.
- **Names:** `PACKS`, `PACK_IDS`, `DEFAULT_PACK`, `PACK_KEY`, `Fx.pack`, `Fx.setPack`, `Fx.packs`, `Fx.packLabel`, `clipsAreMusic`, `speech`, `T.soundPack`, `t.soundPack`, `nav-pack` are used identically across tasks.
