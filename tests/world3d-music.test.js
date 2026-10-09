const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Music = require(worldFile('music.js'));

const PENTATONIC = [0, 2, 4, 7, 9];

test('the tune stays on the C major pentatonic scale, so it always sounds sweet', () => {
  for (const n of Music.MELODY.concat(Music.BASS)) {
    if (n === null) continue;
    assert.ok(Number.isInteger(n) && n >= 36 && n <= 84, String(n));
    assert.ok(PENTATONIC.includes(n % 12), String(n));
  }
});

test('with no Web Audio the music quietly does nothing', () => {
  const m = Music.create({});
  m.start();
  assert.equal(m.playing(), false);
  m.stop();
});

test('stop silences notes that were already scheduled', () => {
  const gains = [];
  const param = () => ({ value: 0, calls: [], setValueAtTime(v) { this.calls.push(v); }, exponentialRampToValueAtTime() {} });
  class FakeContext {
    constructor() { this.currentTime = 0; this.destination = {}; this.state = 'suspended'; }
    resume() { this.state = 'running'; }
    createOscillator() { return { type: '', frequency: param(), connect() {}, start() {}, stop() {} }; }
    createGain() { const g = { gain: param(), connect() {} }; gains.push(g); return g; }
  }
  const win = { AudioContext: FakeContext, setInterval: () => 1, clearInterval() {} };
  const m = Music.create(win);
  m.start();
  assert.equal(m.playing(), true);
  m.stop();
  assert.equal(m.playing(), false);
  assert.deepEqual(gains[0].gain.calls, [1, 0]);
});

test('starting again resumes a suspended context without a second timer, and running() follows the context', () => {
  let resumes = 0, intervals = 0;
  class FakeContext {
    constructor() { this.currentTime = 0; this.destination = {}; this.state = 'suspended'; }
    resume() { resumes++; this.state = 'running'; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  const ctxs = [];
  const Wrapped = class extends FakeContext { constructor() { super(); ctxs.push(this); } };
  const m = Music.create({ AudioContext: Wrapped, setInterval: () => { intervals++; return 1; }, clearInterval() {} });
  assert.equal(m.running(), false);
  m.start();
  assert.equal(m.running(), true);
  ctxs[0].state = 'suspended';
  assert.equal(m.running(), false, 'a suspended context is not running');
  m.start();
  assert.equal(resumes, 2);
  assert.equal(intervals, 1);
  assert.equal(m.running(), true);
});
