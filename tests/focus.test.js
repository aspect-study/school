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
