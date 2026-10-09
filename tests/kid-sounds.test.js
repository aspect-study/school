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
