const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');

const read = (f) => fs.readFileSync(worldFile(f), 'utf8');

test('her pet\'s sounds go through o.sfx; only the celebration keeps its game chime', () => {
  const src = read('companion.js');
  assert.equal((src.match(/o\.sound\(/g) || []).length, 1, 'pat, treat and throw no longer beep');
  assert.ok(src.includes('o.sound(f.sound)'), 'the celebration keeps its chime');
  assert.ok(src.includes('life.heard'), 'companion empties petlife\'s heard list');
  assert.ok(src.includes('o.sfx('), 'and hands it to world-main');
});

test('her sister\'s lent pet says what kind it is, for its voice', () => {
  assert.ok(read('kin.js').includes('type: s.lk.pet'));
});

test('world-main makes the sounds: steps, her moves, stall demos and try-ons, her pet, the settings row', () => {
  const src = read('world-main.js');
  for (const s of [
    'W.Sfx.create(root)',
    'sfx: petSound',
    'W.Sfx.stepsBetween(stepT, st.walkT)',
    'sfx.play(id, { her: true })',
    'sfx.stopHer(0.2)',
    'sfx.voice(shown.pet)',
    'setting(T.steps,',
    'sfx.unlock()',
    'sfx.stopAll(0)',
    'quiet: !!(mv && !mv.idle)'
  ]) assert.ok(src.includes(s), s);
});

test('rides report their sound cues; stall buys ring the cash register', () => {
  const p = read('play.js');
  assert.ok(!p.includes('o.sound('), 'the ride start chime is gone');
  assert.ok(p.includes('R.cues('), 'play.js reports the ride cues');
  const w = read('world-main.js');
  assert.ok(w.includes('cue: function (name) { sfx.play(name); }'), 'world-main plays them');
  assert.ok(/onBought:[\s\S]*?sound\('purchase'\)[\s\S]*?onClose:/.test(w), 'a stall buy rings the cash register');
});
