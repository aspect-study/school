# Focus Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A soft, slow background tune plays while a lesson is open (cards and quiz), different for every lesson, with a ☰-menu toggle.

**Architecture:** One new engine module `web/engine/focus.js` with a pure `compose(seed)` (seed in, note plan out) and a thin Web Audio player. Games call `Focus.start(seed)` when a lesson, the final exam or a review round begins; `nav.js` calls `Focus.screen(id)` on every screen change, which stops the music on any screen that is not the cards or the quiz. `fx.js` ducks the music while a voice clip or speech plays.

**Tech Stack:** Plain ES5 browser JS in an IIFE `(function (root) {...})(this)`, Web Audio, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-13-focus-music-design.md`. Read `CLAUDE.md` first. The owner runs every commit: never run `git commit` yourself, and never add `Co-Authored-By`.

## Adjustments to the spec found while planning

These are small and the plan follows them; Task 7 writes them into the spec.

- The seed is `<game key>:<lesson title>`, not the lesson id. Grade 2 lessons have no id (only an index), and every lesson in every game has a title.
- The stop rule lives in `Focus.screen(id)` (called by `Nav.screen`): music plays on screen ids matching `/flash|cards|quiz/i` and stops on every other screen. The same rule works for the Grade 5 ids (`flashScreen`, `quizScreen`) and the Grade 2 ids (`screen-cards`, `screen-flash`, `screen-quiz`).
- A new seed while playing takes effect at the next bar, so the notes already ringing fade naturally (this is the "cross-fade").
- The menu item uses 🎶, because 🎵 is already the Sounds item. `Focus.setting()` is the saved choice; `Focus.enabled()` is the effective one (setting on and `Fx` not muted).
- The no-big-leap rule (at most a fifth, 7 semitones) holds between notes inside one pass of the melody. The jump where the loop restarts is not limited.
- Uniqueness is tested with 2000 synthetic seeds, because lesson data lives in many different formats.

## File structure

- Create `web/engine/focus.js`: generator, player, `Focus` global. One responsibility: the focus tune.
- Create `tests/focus.test.js`: generator and player tests.
- Create `tests/focus-wiring.test.js`: every game and `nav.js` and `fx.js` are wired.
- Modify `web/engine/nav.js`: menu item, text, `Focus.screen` hook.
- Modify `web/engine/fx.js`: duck calls in `clip` and `say`.
- Modify the 17 `web/subjects/grade-*/*/index.html` files: load `focus.js`, three `Focus.start` calls.
- Modify `tests/nav.test.js`: text keys.
- Modify `tools/update-precache.js` output (run the tool), `docs/HANDOFF.md`, `README.md`.

---

### Task 1: The generator `compose(seed)`

**Files:**
- Create: `web/engine/focus.js`
- Test: `tests/focus.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/focus.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const Focus = require(engineFile('focus.js'));

const SEEDS = [];
for (let i = 1; i <= 2000; i++) SEEDS.push('math:Lesson ' + i);

function semis(plan) {
  return (n) => (((n - plan.root) % 12) + 12) % 12;
}

test('the same seed always gives the same tune', () => {
  assert.deepEqual(Focus.compose('word-train:Nouns'), Focus.compose('word-train:Nouns'));
});

test('2000 different lessons give 2000 different tunes', () => {
  const all = new Set(SEEDS.map((s) => JSON.stringify(Focus.compose(s))));
  assert.equal(all.size, SEEDS.length);
});

test('every mode and every voice gets used', () => {
  const plans = SEEDS.map((s) => Focus.compose(s));
  assert.deepEqual([...new Set(plans.map((p) => p.mode))].sort(), Focus.MODE_NAMES.slice().sort());
  assert.deepEqual([...new Set(plans.map((p) => p.voice))].sort(), Focus.VOICE_NAMES.slice().sort());
});

test('tempo is slow, and every note stays inside the chosen mode and a soft register', () => {
  for (const s of SEEDS) {
    const p = Focus.compose(s);
    const inMode = semis(p);
    assert.ok(p.bpm >= 52 && p.bpm <= 68, s + ' bpm ' + p.bpm);
    assert.ok(p.root >= 48 && p.root <= 59, s + ' root');
    const scale = Focus.MODES[p.mode];
    for (const n of p.melody.concat(p.alt)) {
      if (n === null) continue;
      assert.ok(scale.includes(inMode(n)), s + ' melody note ' + n);
      assert.ok(n >= p.root && n <= 90, s + ' melody range ' + n);
    }
    for (const chord of p.chords) {
      assert.equal(chord.length, 3);
      for (const n of chord) assert.ok(scale.includes(inMode(n)) && n >= p.root && n <= 80, s + ' chord note ' + n);
    }
  }
});

test('the melody has 4 bars of 8 slots, many rests, and no leap bigger than a fifth', () => {
  for (const s of SEEDS) {
    const p = Focus.compose(s);
    assert.equal(p.melody.length, Focus.SLOTS_PER_BAR * Focus.BARS);
    assert.equal(p.chords.length, Focus.BARS);
    assert.ok(p.melody.filter((n) => n === null).length / p.melody.length >= 0.3, s + ' rests');
    for (const line of [p.melody, p.alt]) {
      const played = line.filter((n) => n !== null);
      for (let i = 1; i < played.length; i++) assert.ok(Math.abs(played[i] - played[i - 1]) <= 7, s + ' leap');
    }
  }
});

test('the second pass drops exactly one note of the first', () => {
  for (const s of SEEDS.slice(0, 200)) {
    const p = Focus.compose(s);
    const diff = p.melody.map((n, i) => i).filter((i) => p.melody[i] !== p.alt[i]);
    assert.equal(diff.length, 1, s);
    assert.notEqual(p.melody[diff[0]], null);
    assert.equal(p.alt[diff[0]], null);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/focus.test.js`
Expected: FAIL with "Cannot find module" for `web/engine/focus.js`.

- [ ] **Step 3: Write the generator**

Create `web/engine/focus.js`:

```js
/* Calm focus music for a lesson. compose(seed) turns a string into a tune (a plain object, no audio), so each lesson has
   its own tune and the same lesson always gets the same one. MIDI note numbers; null is a rest. */
(function (root) {
  'use strict';

  var KEY = 'study_focus_v1';
  var SLOTS_PER_BAR = 8;
  var BARS = 4;
  var RESTS_PER_BAR = 3;
  var STEPS = [-2, -1, -1, 0, 1, 1, 2];

  var MODES = {
    pentatonic: [0, 2, 4, 7, 9],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    minor: [0, 2, 3, 5, 7, 8, 10]
  };
  var MODE_NAMES = ['pentatonic', 'lydian', 'dorian', 'minor'];
  var VOICE_NAMES = ['pad', 'chime', 'marimba', 'pluck'];

  // FNV-1a, written with shifts so it stays plain ES5.
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  // xorshift32; the first outputs are dropped because similar seeds start out alike.
  function random(seed) {
    var s = seed || 1;
    function next() {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    }
    for (var i = 0; i < 6; i++) next();
    return next;
  }

  function compose(seed) {
    var r = random(hash(String(seed)));
    function pick(list) { return list[Math.floor(r() * list.length)]; }

    var mode = pick(MODE_NAMES);
    var scale = MODES[mode];
    var n = scale.length;
    var root = 48 + Math.floor(r() * 12);
    var bpm = 52 + Math.floor(r() * 17);
    var voice = pick(VOICE_NAMES);

    function pitch(deg) { return root + 12 * Math.floor(deg / n) + scale[((deg % n) + n) % n]; }

    var chordDegs = [0];
    for (var c = 1; c < BARS; c++) chordDegs.push(Math.floor(r() * n));
    var chords = chordDegs.map(function (d) { return [pitch(d), pitch(d + 2), pitch(d + 4)]; });

    // The chord tone (a triad on chordDeg) nearest to a melody degree: never more than one degree away.
    function nearestChordTone(from, chordDeg) {
      var best = null;
      for (var oct = 0; oct <= 3; oct++) {
        [0, 2, 4].forEach(function (k) {
          var cand = oct * n + ((chordDeg + k) % n);
          if (best === null || Math.abs(cand - from) < Math.abs(best - from)) best = cand;
        });
      }
      return best;
    }

    // The melody only moves when a note is played, so two played notes are never more than 2 degrees apart.
    var melody = [];
    var deg = n;
    for (var bar = 0; bar < BARS; bar++) {
      var rests = {};
      var count = 0;
      while (count < RESTS_PER_BAR) {
        var spot = Math.floor(r() * SLOTS_PER_BAR);
        if (!rests[spot]) { rests[spot] = true; count++; }
      }
      deg = nearestChordTone(deg, chordDegs[bar]);
      var firstOfBar = true;
      for (var slot = 0; slot < SLOTS_PER_BAR; slot++) {
        if (rests[slot]) { melody.push(null); continue; }
        if (!firstOfBar) deg = Math.max(n, Math.min(2 * n, deg + pick(STEPS)));
        firstOfBar = false;
        melody.push(pitch(deg));
      }
    }

    var played = [];
    melody.forEach(function (note, i) { if (note !== null) played.push(i); });
    var alt = melody.slice();
    alt[pick(played)] = null;

    return { mode: mode, root: root, bpm: bpm, voice: voice, chords: chords, melody: melody, alt: alt };
  }

  var exported = {
    KEY: KEY, MODES: MODES, MODE_NAMES: MODE_NAMES, VOICE_NAMES: VOICE_NAMES,
    SLOTS_PER_BAR: SLOTS_PER_BAR, BARS: BARS, hash: hash, compose: compose
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
})(this);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/focus.test.js`
Expected: PASS, 6 tests. If "2000 different lessons" fails, two seeds produced the same plan: check `hash` and `random` before touching the test.

- [ ] **Step 5: Commit (the owner runs it)**

```bash
git add web/engine/focus.js tests/focus.test.js && git commit -m 'Add focus music generator: a calm tune composed from a lesson seed' -- web/engine/focus.js tests/focus.test.js
```

---

### Task 2: The player

**Files:**
- Modify: `web/engine/focus.js` (replace the export block at the bottom)
- Test: `tests/focus.test.js` (append)

- [ ] **Step 1: Append the failing tests**

Append to `tests/focus.test.js`:

```js
function setup(over = {}) {
  const made = { oscs: 0, intervals: [], cleared: 0, targets: 0, resumes: 0, ctxs: 0 };
  const param = () => ({
    value: 1,
    setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {},
    cancelScheduledValues() {}, setTargetAtTime() { made.targets++; }
  });
  class FakeContext {
    constructor() { made.ctxs++; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.state = 'suspended'; }
    resume() { made.resumes++; this.state = 'running'; }
    suspend() { this.state = 'suspended'; }
    createOscillator() { made.oscs++; return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: param(), connect() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect() {} }; }
    createConvolver() { return { buffer: null, connect() {} }; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
  }
  const store = {};
  const win = Object.assign({
    AudioContext: FakeContext,
    setInterval(fn) { made.intervals.push(fn); return made.intervals.length; },
    clearInterval() { made.cleared++; },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    document: { addEventListener() {} }
  }, over);
  return { f: Focus.create(win), made, win, store };
}

test('start plays a tune and schedules notes; the same seed again does nothing more', () => {
  const { f, made } = setup();
  f.start('math:Fractions');
  assert.equal(f.playing(), true);
  assert.ok(made.oscs > 0);
  f.start('math:Fractions');
  assert.equal(made.intervals.length, 1);
  assert.equal(made.ctxs, 1);
});

test('a new seed while playing keeps one timer and switches at the next bar', () => {
  const { f, made } = setup();
  f.start('a');
  f.start('b');
  assert.equal(made.intervals.length, 1);
  assert.equal(f.playing(), true);
  made.intervals[0]();
});

test('stop ends the music and clears the timer', () => {
  const { f, made } = setup();
  f.start('a');
  f.stop();
  assert.equal(f.playing(), false);
  assert.equal(made.cleared, 1);
});

test('with no Web Audio nothing happens and nothing throws', () => {
  const f = Focus.create({ localStorage: { getItem: () => null, setItem() {} } });
  f.start('a');
  assert.equal(f.playing(), false);
  f.stop();
});

test('turned off, nothing is created; turning it on mid-lesson starts the tune', () => {
  const { f, made, store } = setup();
  f.setEnabled(false);
  assert.equal(store.study_focus_v1, '0');
  f.start('a');
  assert.equal(f.playing(), false);
  assert.equal(made.ctxs, 0);
  f.setEnabled(true);
  assert.equal(f.playing(), true);
  f.setEnabled(false);
  assert.equal(f.playing(), false);
});

test('Sound off silences the music whatever the setting is, and Sound on brings it back', () => {
  let muted = true;
  const { f } = setup({ Fx: { muted: () => muted } });
  f.start('a');
  assert.equal(f.playing(), false);
  assert.equal(f.setting(), true);
  assert.equal(f.enabled(), false);
  muted = false;
  f.sync();
  assert.equal(f.playing(), true);
  muted = true;
  f.sync();
  assert.equal(f.playing(), false);
});

test('duck lowers the music for a while and does nothing when it is not playing', () => {
  const { f, made } = setup();
  f.duck(1000);
  assert.equal(made.targets, 0);
  f.start('a');
  f.duck(1000);
  assert.equal(made.targets, 2);
});

test('only the cards and the quiz keep the music; every other screen stops it', () => {
  const { f } = setup();
  for (const id of ['flashScreen', 'quizScreen', 'screen-flash', 'screen-cards', 'screen-quiz', 'flash', 'quiz']) {
    f.start('a');
    f.screen(id);
    assert.equal(f.playing(), true, id);
  }
  for (const id of ['home', 'screen-home', 'resultsScreen', 'screen-results', 'strategyScreen', 'printScreen']) {
    f.start('a');
    f.screen(id);
    assert.equal(f.playing(), false, id);
  }
});

test('a blocked localStorage counts as on', () => {
  const { f } = setup({ localStorage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
  assert.equal(f.setting(), true);
  f.start('a');
  assert.equal(f.playing(), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/focus.test.js`
Expected: the six Task 1 tests pass; the new ones FAIL with "Focus.create is not a function".

- [ ] **Step 3: Replace the export block with the player**

In `web/engine/focus.js`, replace everything from `  var exported = {` to the end of the file with:

```js
  var LEVEL = 0.12;
  var DUCKED = 0.3;
  var LESSON_SCREEN = /flash|cards|quiz/i;

  var VOICES = {
    pad: { type: 'sine', attack: 0.35, length: 2.6, partial: 0 },
    chime: { type: 'sine', attack: 0.01, length: 2.2, partial: 0.3 },
    marimba: { type: 'triangle', attack: 0.005, length: 0.7, partial: 0 },
    pluck: { type: 'triangle', attack: 0.004, length: 1.3, partial: 0.15 }
  };

  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function create(win) {
    var ctx = null, bus = null, duckGain = null, fade = null, timer = null;
    var plan = null, pending = null, wanted = null, playingSeed = null, at = 0, slot = 0, pass = 0;

    function read() { try { return win.localStorage.getItem(KEY); } catch (e) { return null; } }
    function write(v) { try { win.localStorage.setItem(KEY, v); } catch (e) {} }
    function setting() { return read() !== '0'; }
    function enabled() { return setting() && !(win.Fx && win.Fx.muted && win.Fx.muted()); }

    function impulse() {
      var len = Math.floor(ctx.sampleRate * 1.2);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      return buf;
    }

    // voices -> low-pass -> (dry + short reverb) -> duck -> fade -> speakers
    function build(AC) {
      ctx = new AC();
      fade = ctx.createGain();
      duckGain = ctx.createGain();
      bus = ctx.createBiquadFilter();
      bus.type = 'lowpass';
      bus.frequency.value = 1800;
      var wet = ctx.createGain();
      wet.gain.value = 0.3;
      var verb = ctx.createConvolver();
      verb.buffer = impulse();
      bus.connect(duckGain);
      bus.connect(verb);
      verb.connect(wet);
      wet.connect(duckGain);
      duckGain.connect(fade);
      fade.connect(ctx.destination);
      if (win.document && win.document.addEventListener) {
        win.document.addEventListener('visibilitychange', function () {
          if (!ctx || !timer) return;
          if (win.document.hidden) { if (ctx.suspend) ctx.suspend(); } else if (ctx.resume) ctx.resume();
        });
        win.document.addEventListener('pointerdown', function () {
          if (timer && ctx.state === 'suspended' && ctx.resume) ctx.resume();
        }, true);
      }
    }

    function tone(hz, t, vol, type, attack, length) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + length + 0.05);
    }

    function note(n, t, voice) {
      var v = VOICES[voice];
      tone(freq(n), t, 0.5, v.type, v.attack, v.length);
      if (v.partial) tone(freq(n) * 2, t, 0.5 * v.partial, 'sine', v.attack, v.length * 0.7);
    }

    // A throttled timer can fall far behind: skip ahead instead of piling up the missed notes at once.
    function schedule() {
      if (at < ctx.currentTime) at = ctx.currentTime + 0.05;
      while (at < ctx.currentTime + 1) {
        if (slot % SLOTS_PER_BAR === 0 && pending) {
          plan = pending;
          pending = null;
          slot = 0;
          pass = 0;
        }
        var step = 30 / plan.bpm;
        if (slot % SLOTS_PER_BAR === 0) {
          var chord = plan.chords[(slot / SLOTS_PER_BAR) % BARS];
          for (var i = 0; i < chord.length; i++) tone(freq(chord[i]), at, 0.18, 'sine', 0.5, step * SLOTS_PER_BAR + 0.8);
        }
        var n = (pass % 2 ? plan.alt : plan.melody)[slot % (SLOTS_PER_BAR * BARS)];
        if (n !== null) note(n, at, plan.voice);
        at += step;
        slot++;
        if (slot % (SLOTS_PER_BAR * BARS) === 0) pass++;
      }
    }

    function begin() {
      var AC = win.AudioContext || win.webkitAudioContext;
      if (!AC) return;
      try {
        if (!ctx) build(AC);
        if (ctx.resume) ctx.resume();
        var t = ctx.currentTime;
        fade.gain.cancelScheduledValues(t);
        fade.gain.setValueAtTime(0.0001, t);
        fade.gain.linearRampToValueAtTime(LEVEL, t + 2);
        duckGain.gain.cancelScheduledValues(t);
        duckGain.gain.setValueAtTime(1, t);
        plan = compose(wanted);
        playingSeed = wanted;
        pending = null;
        slot = 0;
        pass = 0;
        at = t + 0.1;
        schedule();
        timer = win.setInterval(schedule, 250);
      } catch (e) { timer = null; }
    }

    function halt() {
      if (!timer) return;
      win.clearInterval(timer);
      timer = null;
      playingSeed = null;
      pending = null;
      var t = ctx.currentTime;
      fade.gain.cancelScheduledValues(t);
      fade.gain.setTargetAtTime(0, t, 0.25);
    }

    function start(seed) {
      wanted = String(seed);
      if (!enabled()) return;
      if (!timer) { begin(); return; }
      if (ctx.resume) ctx.resume();
      if (playingSeed !== wanted) {
        pending = compose(wanted);
        playingSeed = wanted;
      }
    }

    function sync() {
      if (!enabled()) halt();
      else if (wanted && !timer) begin();
    }

    return {
      start: start,
      stop: function () { wanted = null; halt(); },
      sync: sync,
      screen: function (id) { if (!LESSON_SCREEN.test(String(id))) { wanted = null; halt(); } },
      duck: function (ms) {
        if (!timer) return;
        var t = ctx.currentTime;
        duckGain.gain.cancelScheduledValues(t);
        duckGain.gain.setTargetAtTime(DUCKED, t, 0.08);
        duckGain.gain.setTargetAtTime(1, t + ms / 1000, 0.4);
      },
      playing: function () { return !!timer; },
      setting: setting,
      enabled: enabled,
      setEnabled: function (on) { write(on ? '1' : '0'); sync(); }
    };
  }

  var exported = {
    KEY: KEY, MODES: MODES, MODE_NAMES: MODE_NAMES, VOICE_NAMES: VOICE_NAMES,
    SLOTS_PER_BAR: SLOTS_PER_BAR, BARS: BARS, hash: hash, compose: compose, create: create
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Focus = create(root);
})(this);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/focus.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit (the owner runs it)**

```bash
git add web/engine/focus.js tests/focus.test.js && git commit -m 'Add the focus music player: soft voices, short reverb, ducking, per-lesson seed, setting' -- web/engine/focus.js tests/focus.test.js
```

---

### Task 3: Duck the music under voice clips and speech

**Files:**
- Modify: `web/engine/fx.js` (`say` ~line 182, `clip` ~line 204)
- Test: `tests/focus-wiring.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/focus-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile } = require('./paths.js');

test('fx.js ducks the focus music under a voice clip and under speech', () => {
  const src = fs.readFileSync(engineFile('fx.js'), 'utf8');
  const ducks = src.match(/if \(win\.Focus\) win\.Focus\.duck\(/g) || [];
  assert.equal(ducks.length, 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/focus-wiring.test.js`
Expected: FAIL, `0 !== 2`.

- [ ] **Step 3: Add the two calls**

In `web/engine/fx.js`, in `say`, after `win.speechSynthesis.speak(u);` add:

```js
        if (win.Focus) win.Focus.duck(2500 + text.length * 60);
```

In `clip`, after the line `clipUntil = Date.now() + (a.duration > 0 && isFinite(a.duration) ? a.duration : 2.5) * 1000;` add:

```js
        if (win.Focus) win.Focus.duck(clipUntil - Date.now() + 200);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/focus-wiring.test.js tests/fx.test.js tests/kid-sounds.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (the owner runs it)**

```bash
git add web/engine/fx.js tests/focus-wiring.test.js && git commit -m 'Duck the focus music under voice clips and speech' -- web/engine/fx.js tests/focus-wiring.test.js
```

---

### Task 4: The ☰ menu item and the screen hook

**Files:**
- Modify: `web/engine/nav.js` (TEXT ~lines 9-24, vars line 121, `api.screen` line 136, `renderSound` ~163, menu build ~236-251)
- Test: `tests/nav.test.js` (append), `tests/focus-wiring.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/nav.test.js`:

```js
test('the Focus music menu texts exist for both grades, and Grade 2 pairs English with Filipino', () => {
  for (const grade of ['grade5', 'grade2']) {
    assert.ok(TEXT[grade].focusOn, grade + ' focusOn');
    assert.ok(TEXT[grade].focusOff, grade + ' focusOff');
  }
  assert.match(TEXT.grade2.focusOn, / · /);
  assert.match(TEXT.grade2.focusOff, / · /);
});
```

Append to `tests/focus-wiring.test.js`:

```js
test('nav.js tells Focus about every screen, and its menu toggles the music', () => {
  const src = fs.readFileSync(engineFile('nav.js'), 'utf8');
  assert.match(src, /screen: function \(id\) \{ if \(win\.Focus\) win\.Focus\.screen\(id\); if \(ctl\) ctl\.screen\(id\); \}/);
  assert.match(src, /nav-focus/);
  assert.match(src, /win\.Focus\.setEnabled\(/);
  assert.match(src, /win\.Focus\.sync\(\)/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/nav.test.js tests/focus-wiring.test.js`
Expected: the two new tests FAIL.

- [ ] **Step 3: Edit `nav.js`**

3a. In `TEXT.grade5`, after `soundPack: '🎵 Sounds',` add `focusOn: '🎶 Focus music on', focusOff: '🎶 Focus music off',` (same line is fine; keep the line short by putting them on a new line).

3b. In `TEXT.grade2`, after the `soundPack: '🎵 Sounds · Mga tunog',` entry add:

```js
      focusOn: '🎶 Focus music on · May musika', focusOff: '🎶 Focus music off · Walang musika',
```

3c. Change the variable line (line 121) from `soundBtn = null, packBtn = null,` to `soundBtn = null, focusBtn = null, packBtn = null,`.

3d. Change `api.screen` (line 136) to:

```js
      screen: function (id) { if (win.Focus) win.Focus.screen(id); if (ctl) ctl.screen(id); },
```

3e. In `renderSound`, after the `soundBtn.setAttribute('aria-checked', ...)` line add:

```js
      if (focusBtn) {
        focusBtn.hidden = m;
        focusBtn.textContent = win.Focus.setting() ? t.focusOn : t.focusOff;
        focusBtn.setAttribute('aria-checked', win.Focus.setting() ? 'true' : 'false');
      }
```

3f. Replace the soundBtn creation block (lines 236-239) with:

```js
      if (win.Fx && win.Fx.setMuted) {
        soundBtn = button('nav-sound', 'gnav-item', '', null, function () {
          win.Fx.setMuted(!win.Fx.muted());
          if (win.Focus) win.Focus.sync();
          renderSound();
        });
        items.push(soundBtn);
        if (win.Focus && win.Focus.setEnabled) {
          focusBtn = button('nav-focus', 'gnav-item', '', null, function () { win.Focus.setEnabled(!win.Focus.setting()); renderSound(); });
          items.push(focusBtn);
        }
      }
```

3g. In the `items.forEach` line change `b === soundBtn ? 'menuitemcheckbox'` to `b === soundBtn || b === focusBtn ? 'menuitemcheckbox'`.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/nav.test.js tests/focus-wiring.test.js tests/nav-wiring.test.js tests/lang.test.js tests/english-everywhere.test.js`
Expected: PASS. If a Grade 2 pairing test objects to the new text, fix the wording to match its rule (English first, then Filipino after ` · `).

- [ ] **Step 5: Commit (the owner runs it)**

```bash
git add web/engine/nav.js tests/nav.test.js tests/focus-wiring.test.js && git commit -m 'Add a Focus music item to the game menu and stop the music on any screen that is not the cards or the quiz' -- web/engine/nav.js tests/nav.test.js tests/focus-wiring.test.js
```

---

### Task 5: Wire the 17 games

**Files:**
- Modify: all 17 `web/subjects/grade-*/*/index.html` (list: `tests/paths.js` `APPS`; Grade 5: araling-panlipunan, computer, english, filipino, gmrc, math, music-arts, pe-health, science, tle; Grade 2: computer, english, filipino, gmrc, makabansa, math, science)
- Test: `tests/focus-wiring.test.js` (append)

Note: that is 10 Grade 5 and 7 Grade 2 games = 17. The work is mechanical and independent per game, so it can be split between subagents (Grade 5 batch, Grade 2 batch). Each game needs the same three changes; the exact line numbers differ, so find them with the greps in Step 3.

- [ ] **Step 1: Append the failing test**

Append to `tests/focus-wiring.test.js`:

```js
const { APPS, appFile } = require('./paths.js');

for (const app of APPS) {
  test(app.id + ' loads focus.js and starts the music for a lesson, the final exam and a review round', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    assert.match(html, /engine\/fx\.js"[^>]*><\/script>\r?\n<script src="\.\.\/\.\.\/\.\.\/engine\/focus\.js"><\/script>/, 'focus.js loads right after fx.js');

    const starts = html.match(/window\.Focus && Focus\.start\(SH_APP \+ [^;]+\);/g) || [];
    assert.equal(starts.length, 3, 'three Focus.start calls');
    assert.ok(starts.some((s) => /:'\s*\+\s*\w+(\[[\w.]+\])?\.title\)/.test(s)), 'a lesson seeds from its title');
    assert.ok(starts.some((s) => s.includes("':final'")), 'the final exam has its own tune');
    assert.ok(starts.some((s) => s.includes("':boss'") && s.includes("':review'")), 'a review round has its own tune');

    assert.match(html, /id="[\w-]*(flash|cards)[\w-]*"/i, 'a cards screen id the music rule recognises');
    assert.match(html, /id="[\w-]*quiz[\w-]*"/i, 'a quiz screen id the music rule recognises');
  });
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/focus-wiring.test.js`
Expected: 17 new FAIL (focus.js not loaded).

- [ ] **Step 3: Edit each game**

For each of the 17 files:

3a. Directly after the line `<script src="../../../engine/fx.js" data-grade="gradeN"></script>` add a new line:

```html
<script src="../../../engine/focus.js"></script>
```

3b. Lesson start. Find the single `ReadGate.open(` call (Grep `ReadGate\.open`). Directly after the line it is on, add one line, with the same indentation:

- Grade 5 games, Grade 2 filipino and math (they use `LESSONS[i]`): `window.Focus && Focus.start(SH_APP + ':' + LESSONS[i].title);`
- Grade 2 english, computer, gmrc, makabansa, science (they use `lessons[currentLesson]`): `window.Focus && Focus.start(SH_APP + ':' + lessons[currentLesson].title);`

If a game spells the lessons variable or the index differently, use that game's own spelling, as in the `SH.lessonOpened(...)` line a few lines above `ReadGate.open`, which already reads the lesson's title. Check that `SH_APP` is defined in the game (Grep `SH_APP`); the Grade 5 and Grade 2 games all define it.

3c. Final exam. In `startFinalExam` (Grep `function startFinalExam`), directly before its `showScreen(...)` to the quiz screen, add:

```js
  window.Focus && Focus.start(SH_APP + ':final');
```

3d. Review round. In `startReview` (Grep `function startReview`), directly before its `showScreen(...)` to the quiz screen, add:

```js
  window.Focus && Focus.start(SH_APP + (boss ? ':boss' : ':review'));
```

In the Grade 2 games where `startReview` takes no `boss` argument (`function startReview(){`), change the signature to `startReview(boss)` only if the Trail/Recall hooks already pass it (see how `Trail.start({... review: startReview ...})` calls it); otherwise write `Focus.start(SH_APP + ':review')` ... but the test requires both `':boss'` and `':review'` in one call, so the signature must take `boss`. All 17 games already use `startReview(boss)` in the Grade 5 files; check the Grade 2 IIFE files and add the parameter if it is missing (an unused parameter is harmless).

3e. Check the screen ids. The music rule is `/flash|cards|quiz/i`. Grep `class="screen` in the game: the cards and quiz screens must have ids that match (Grade 5: `flashScreen`, `quizScreen`; Grade 2: `screen-flash` or `screen-cards`, `screen-quiz`). The Grade 5 Math game also has other screens (`wtScreen`, `caseScreen`, `printScreen`): those correctly stop the music.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/focus-wiring.test.js`
Expected: PASS for all 17 games.

Then run the full suite: `node --test`
Expected: PASS. Likely snags: `tests/read-gate-wiring.test.js` expects `ReadGate.open` to match its regex on one line (your new line is separate, so it should hold); `tests/browser-globals.test.js` may list engine globals (add `Focus` to its list if it fails and says so); any test that checks the lines around `fx.js` (adjust only if it fails and explains why).

- [ ] **Step 5: Commit (the owner runs it)**

```bash
git add web/subjects tests/focus-wiring.test.js && git commit -m 'Start the focus music in all 17 games: per lesson, final exam and review round' -- web/subjects tests/focus-wiring.test.js
```

---

### Task 6: Precache and the full checks

**Files:**
- Modify: the generated precache list (by tool), `sw.js` if the tool changes it

- [ ] **Step 1: Update the precache**

Run: `node tools/update-precache.js`
Expected: it lists `web/engine/focus.js` as added.

- [ ] **Step 2: Run every test**

Run: `node --test`
Expected: all pass, including `tests/pwa.test.js`.

- [ ] **Step 3: Run the e2e scripts**

Run the scripts listed in `README.md` under the e2e section (they need headless Chrome), at least the lobby and one game script, plus `node tests/e2e/world-e2e.js` because games open inside the world frame.
Expected: all pass. If one fails on a console error mentioning `Focus`, read the message: an `AudioContext` created before a user gesture only produces a warning, not an error.

- [ ] **Step 4: Check the listening experience in a real browser**

Open one Grade 5 and one Grade 2 game with `?` (no reset) in Chrome, open a lesson and check:
- the tune fades in within about 2 s of tapping the lesson, and keeps going on the quiz screen;
- it fades out on the results screen and on the home screen;
- it ducks while a streak voice clip plays (answer a few right in a row);
- ☰ shows "Focus music on"; turning it off stops it at once; turning Sound off hides that item and silences the music; turning Sound on brings it back;
- two different lessons sound different, and reopening the same lesson gives the same tune;
- the world's own music is silent while a game is open in the frame, and resumes after.

- [ ] **Step 5: Commit (the owner runs it)**

```bash
git add -A web tools && git commit -m 'Precache focus.js' -- web tools
```

(Use the file list `node tools/update-precache.js` reports instead of `-A` if it touched anything outside `web/` and `tools/`.)

---

### Task 7: Docs and the spec adjustments

**Files:**
- Modify: `docs/HANDOFF.md`, `README.md`, `docs/superpowers/specs/2026-10-13-focus-music-design.md`

- [ ] **Step 1: Update the spec**

Append to the spec a section "Adjustments made while planning" with the six bullets from the top of this plan.

- [ ] **Step 2: Update HANDOFF and README**

In `docs/HANDOFF.md` add a line under what is built: "Focus music: `web/engine/focus.js`, a calm generated tune per lesson (seed = game key + lesson title), ☰ menu toggle `study_focus_v1`, ducks under voice clips; each game calls `Focus.start` for a lesson, the final exam and a review round; tablet listening check pending." In `README.md`, where the engine modules and the "Adding content" hook list are described, add that a new game must load `focus.js` after `fx.js` and call `Focus.start` in three places (`tests/focus-wiring.test.js` enforces it).

- [ ] **Step 3: Verify**

Run: `node --test`
Expected: all pass.

- [ ] **Step 4: Commit (the owner runs it)**

```bash
git add docs/HANDOFF.md README.md docs/superpowers/specs/2026-10-13-focus-music-design.md && git commit -m 'Docs: focus music built, hook contract for new games, spec adjustments' -- docs/HANDOFF.md README.md docs/superpowers/specs/2026-10-13-focus-music-design.md
```

---

## Self-review against the spec

- Whole-lesson playback, fade in 2 s / out about 1 s, results stop: Tasks 2 and 4 (`begin`, `halt`, `Focus.screen`).
- Unique per lesson, deterministic, four modes, 52-68 BPM, four voices, chords, sparse melody, drop-one second pass, reverb: Task 1 and Task 2 (`build`).
- Ducking under clips and speech: Task 3.
- Hidden-tab pause and tap-to-unlock retry: Task 2 (`build` listeners).
- World music: no change needed (separate frame, already stopped by the world); checked by hand in Task 6 Step 4.
- ☰ toggle, saved per device, hidden while Sound is off, Sound off silences the music, off creates nothing: Tasks 2 and 4.
- Errors (no Web Audio, blocked storage, throwing context): Task 2 tests and `begin`'s try/catch.
- Tests, hook enforcement, precache, e2e, tablet listening check: Tasks 1-6.
- Not covered on purpose: syncing the setting, a volume slider, per-subject flavour (spec "Out of scope" and "Later").
