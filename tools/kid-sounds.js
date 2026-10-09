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
