const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { web, worldFile } = require('./paths.js');
const Sfx = require(worldFile('sfx.js'));
const Pets = require(worldFile('pets.js'));
const Emotes = require(worldFile('emotes.js'));
const Items = require(worldFile('items.js'));
const Moves = require(worldFile('moves.js'));

function fakeWin(o = {}) {
  const made = { sources: [], fetched: [], ctx: null };
  const param = (v = 0) => ({ value: v, calls: [], setValueAtTime(x) { this.calls.push(['set', x]); }, linearRampToValueAtTime(x) { this.calls.push(['ramp', x]); }, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'suspended'; this.destination = {}; this.sampleRate = 8000; made.ctx = this; }
    resume() { this.state = 'running'; }
    createGain() { return { gain: param(1), connect() {} }; }
    createBufferSource() {
      const s = { buffer: null, playbackRate: param(1), connect() {}, start(at) { s.at = at; }, stop(at) { s.stopped = at; } };
      made.sources.push(s);
      return s;
    }
    createOscillator() { return { type: '', frequency: param(), connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', Q: param(), frequency: param(), connect() {} }; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    decodeAudioData(data, ok, bad) { if (data === 'bad') bad(new Error('bad')); else ok({ duration: 0.5, url: data }); }
  }
  const win = {
    AudioContext: Ctx,
    fetch: (url) => {
      made.fetched.push(url);
      if (o.fail && o.fail.test(url)) return Promise.resolve({ ok: false });
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(o.bad && o.bad.test(url) ? 'bad' : url) });
    }
  };
  return { win, made };
}
const settle = () => new Promise((r) => setTimeout(r, 0));
const lastDid = (s) => s.log().slice(-1)[0].did;

test('every sound file is in assets/sounds/world, and every file there is used', () => {
  const files = fs.readdirSync(web('assets/sounds/world')).sort();
  assert.deepEqual(files, Sfx.FILES.slice().sort());
  assert.equal(Sfx.FILES.length, 56);
});

test('every pet has a voice, and every emote and prop ✨ Use has a sound', () => {
  for (const p of Pets.PETS) {
    const key = Sfx.VOICES[p.id];
    assert.ok(key, p.id + ' has a voice');
    assert.ok(Sfx.SOUNDS[key], p.id + ' voice ' + key + ' is a sound');
  }
  for (const e of Emotes.EMOTES) assert.ok(Sfx.SOUNDS[e.id], e.id);
  for (const it of Items.ITEMS.filter((i) => i.slot === 'prop')) assert.ok(Sfx.SOUNDS[Moves.forProp(it.id)], it.id);
  assert.equal(Sfx.SOUNDS.rawr.code, true, 'the baby dragon is made in code');
});

test('steps land each time her leg swing reaches a foot plant, never going backwards', () => {
  const P = Math.PI;
  assert.equal(Sfx.stepsBetween(0, P / 2 - 0.01), 0);
  assert.equal(Sfx.stepsBetween(0, P / 2 + 0.01), 1);
  assert.equal(Sfx.stepsBetween(P / 2 + 0.01, P), 0);
  assert.equal(Sfx.stepsBetween(0, 3 * P), 3);
  assert.equal(Sfx.stepsBetween(5, 1), 0, 'walkT shrinking when she stops is not a step');
});

test('with no Web Audio every call quietly does nothing', () => {
  const s = Sfx.create({});
  s.unlock();
  s.setOn(true, true);
  assert.equal(s.play('emote-wave'), false);
  assert.equal(s.step('grass'), false);
  assert.equal(s.voice('kitten'), false);
  s.stopHer(0.2);
  s.stopAll(0);
});

test('before her first tap nothing plays; sound off means nothing is even downloaded', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win);
  assert.equal(s.play('emote-wave'), false);
  assert.equal(lastDid(s), 'locked');
  s.setOn(false, true);
  s.unlock();
  assert.equal(s.play('emote-wave'), false);
  assert.equal(lastDid(s), 'off');
  await settle();
  assert.deepEqual(made.fetched, []);
});

test('the first tap warms every file; a clip not loaded yet is skipped, never played late', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win, { base: 'snd/' });
  s.unlock();
  assert.equal(made.fetched.length, 56);
  assert.ok(made.fetched.includes('snd/emote-wave.mp3'));
  assert.equal(s.play('emote-wave'), false);
  assert.equal(lastDid(s), 'loading');
  await settle();
  assert.equal(made.sources.length, 0, 'the skipped play did not wait for its clip');
  made.ctx.currentTime = 1;
  assert.equal(s.play('emote-wave'), true);
  assert.equal(made.sources.length, 1);
  assert.equal(made.sources[0].buffer.url, 'snd/emote-wave.mp3');
});

test('a sound waits its cooldown; at most 6 play at once', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win);
  s.unlock();
  await settle();
  assert.equal(s.play('emote-wave'), true);
  assert.equal(s.play('emote-wave'), false);
  assert.equal(lastDid(s), 'cool');
  made.ctx.currentTime = 1;
  const keys = ['emote-clap', 'emote-bow', 'emote-heart', 'emote-giggle', 'emote-relax', 'emote-dance', 'emote-hero'];
  const played = keys.map((k) => s.play(k));
  assert.deepEqual(played, [true, true, true, true, true, true, false]);
  assert.equal(lastDid(s), 'full');
  made.ctx.currentTime = 5;
  assert.equal(s.play('emote-hero'), true, 'room again once the others ended');
});

test('a clip that fails to load stays skipped', async () => {
  const { win } = fakeWin({ fail: /emote-clap/, bad: /emote-bow/ });
  const s = Sfx.create(win);
  s.unlock();
  await settle();
  await settle();
  assert.equal(s.play('emote-clap'), false);
  assert.equal(lastDid(s), 'dead');
  assert.equal(s.play('emote-bow'), false);
  assert.equal(lastDid(s), 'dead');
});

test('stopHer fades her move sound and leaves her pet\'s sounds alone', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win);
  s.unlock();
  await settle();
  s.play('emote-wave', { her: true });
  s.voice('kitten');
  s.stopHer(0.2);
  assert.ok(Math.abs(made.sources[0].stopped - 0.22) < 1e-9, 'faded over 0.2 s, stopped just after');
  assert.equal(made.sources[1].stopped, undefined);
  s.stopAll(0);
  assert.equal(made.sources[1].stopped, 0.02);
});

test('steps: the footsteps setting turns them off; stone cycles its 5 clips; grass wobbles', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win, { base: '', rand: () => 1 });
  s.unlock();
  await settle();
  assert.equal(s.play('step-stone'), false, 'steps are not played by name');
  s.setOn(true, false);
  assert.equal(s.step('grass'), false);
  assert.equal(lastDid(s), 'off');
  s.setOn(true, true);
  for (let i = 0; i < 3; i++) {
    made.ctx.currentTime = 1 + i;
    assert.equal(s.step('stone'), true);
  }
  assert.deepEqual(made.sources.map((x) => x.buffer.url), ['step-stone-1.mp3', 'step-stone-2.mp3', 'step-stone-3.mp3']);
  made.ctx.currentTime = 10;
  s.step('grass');
  assert.equal(made.sources[3].playbackRate.value, 1.06);
});

test('voices: a pet type picks its clip; the dragon is drawn in code; extra options pass through', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win, { base: '' });
  s.unlock();
  await settle();
  assert.equal(s.voice('turtle', { delay: 0.4 }), true);
  assert.equal(made.sources[0].buffer.url, 'pop.mp3', 'the turtle shares the pop clip');
  assert.equal(made.sources[0].at, 0.4);
  assert.equal(s.voice('dragon'), true);
  assert.equal(lastDid(s), 'played');
  assert.equal(s.log().slice(-1)[0].key, 'rawr');
  assert.equal(s.voice('nobody'), false);
});

test('the tag heartbeat is drawn in code and keeps its own cooldown', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win, { base: '' });
  assert.equal(Sfx.SOUNDS.heartbeat.code, true);
  s.unlock();
  await settle();
  assert.equal(s.play('heartbeat'), true);
  assert.equal(s.log().slice(-1)[0].key, 'heartbeat');
  assert.equal(s.play('heartbeat'), false, 'not twice at once');
  made.ctx.currentTime = 1;
  assert.equal(s.play('heartbeat'), true);
});

test('the cooldown counts from when a clip starts, so a delayed copy of the same voice is heard', async () => {
  const { win } = fakeWin();
  const s = Sfx.create(win, { base: '' });
  s.unlock();
  await settle();
  assert.equal(s.voice('kitten'), true);
  assert.equal(s.voice('kitten', { delay: 0.7 }), true);
  assert.equal(s.voice('kitten', { delay: 0.3 }), false);
  assert.equal(lastDid(s), 'cool');
});

test('a context that is not running counts as locked until the next tap resumes it', async () => {
  const { win, made } = fakeWin();
  const s = Sfx.create(win, { base: '' });
  s.unlock();
  await settle();
  made.ctx.state = 'interrupted';
  assert.equal(s.play('emote-wave'), false);
  assert.equal(lastDid(s), 'locked');
  s.unlock();
  assert.equal(made.ctx.state, 'running');
  assert.equal(s.play('emote-wave'), true);
});

test('every ride cue has a sound', () => {
  const Rides = require(worldFile('rides.js'));
  for (const id of Object.keys(Rides.CUES)) {
    for (const [, name] of Rides.CUES[id]) assert.ok(Sfx.SOUNDS[name] && !Sfx.SOUNDS[name].files, id + ': ' + name);
  }
});
