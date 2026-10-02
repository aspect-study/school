const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { APPS, engineFile, appFile, lobbyFile } = require('./paths.js');
const { tierFor, SUBTITLE, POP_MS, POP_CLOSE } = require(engineFile('fx.js'));


test('the streak announcer climbs one tier per answer in a row and stays legendary', () => {
  assert.equal(tierFor(0), null);
  assert.equal(tierFor(1), null, 'a single right answer only dings');
  const words = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => tierFor(n).word);
  assert.deepEqual(words, ['DOUBLE KILL!', 'TRIPLE KILL!', 'MANIAC!', 'SAVAGE!!!', 'UNSTOPPABLE!', 'GODLIKE!', 'LEGENDARY!', 'LEGENDARY!', 'LEGENDARY!']);
});

test('the call-out subtitle speaks each lobby\'s language', () => {
  assert.equal(SUBTITLE.grade5(5), '🔥 5 in a row!');
  assert.equal(SUBTITLE.grade2(5), '🔥 5 sunod-sunod na tama! · 5 in a row!');
});

test('a celebration closes by itself: small after 4 s, big after 6 s; its button stays English', () => {
  assert.deepEqual(POP_MS, { small: 4000, big: 6000 });
  assert.equal(POP_CLOSE, 'Nice!');
});

for (const g of APPS.map((app) => ({ a: app.id, file: appFile(app.id), fx: '../../../engine/fx.js', grade: 'grade' + app.grade }))) {
  test(g.a + ' loads the effects and plays them on every answer and result', () => {
    const html = fs.readFileSync(g.file, 'utf8');
    assert.ok(html.includes('<script src="' + g.fx + '" data-grade="' + g.grade + '"></script>'), 'missing fx script tag');
    // Every answer goes through kit.answer, which plays Fx.correct / Fx.wrong (tests/study-kit.test.js).
    assert.ok(html.split('kit.answer(').length - 1 > 0, 'answers are scored by the study kit');
    assert.equal(html.split('Fx.correct(').length + html.split('Fx.wrong(').length - 2, 0, 'no answer sound outside the study kit');
    assert.equal(html.split('window.Fx && Fx.finish(').length - 1, html.split('SH.quizFinished(').length - 1, 'every finished round calls Fx.finish');
  });
}

for (const lobby of [
  { file: lobbyFile(5), fx: '../engine/fx.js', grade: 'grade5' },
  { file: lobbyFile(2), fx: '../engine/fx.js', grade: 'grade2' },
]) {
  test(path.basename(path.dirname(lobby.file)) + '/' + path.basename(lobby.file) + ' plays the cha-ching only after a purchase is saved', () => {
    const html = fs.readFileSync(lobby.file, 'utf8');
    assert.ok(html.includes('<script src="' + lobby.fx + '" data-grade="' + lobby.grade + '"></script>'), 'missing fx script tag');
    assert.equal(html.split('if (bought && window.Fx) Fx.purchase();').length - 1, 1);
  });
}
