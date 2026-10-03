const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { APPS, engineFile, appFile, lobbyFile } = require('./paths.js');
const { tierFor, TIERS, FIRST_BLOOD, finishClip, medalClip, allClips, SUBTITLE, POP_MS, POP_CLOSE } = require(engineFile('fx.js'));
const { WEB } = require('./paths.js');


test('the streak announcer climbs one tier per answer in a row and stays legendary', () => {
  assert.equal(tierFor(0), null);
  assert.equal(tierFor(1), null, 'a single right answer only dings');
  const words = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => tierFor(n).word);
  assert.deepEqual(words, ['DOUBLE KILL!', 'TRIPLE KILL!', 'MANIAC!', 'SAVAGE!!!', 'DOMINATING!', 'UNSTOPPABLE!', 'LEGENDARY!', 'LEGENDARY!', 'LEGENDARY!']);
});

test('each call-out has its own voice clip, and the first right answer of a round is First Blood', () => {
  assert.deepEqual(TIERS.map((t) => t.clip), ['double-kill.mp3', 'triple-kill.mp3', 'maniac.mp3', 'savage.mp3', 'dominating.mp3', 'unstoppable.mp3', 'legendary.mp3']);
  assert.equal(FIRST_BLOOD.word, 'FIRST BLOOD!');
  assert.equal(FIRST_BLOOD.clip, 'first-blood.mp3');
});

test('the end of a round speaks by stars; a perfect round is Ace, a mock exam has its own top two', () => {
  assert.deepEqual([0, 1, 2, 3].map((n) => finishClip(n, false)), ['valorant-1-kill.mp3', 'valorant-2-kills.mp3', 'valorant-3-kills.mp3', 'valorant-ace.mp3']);
  assert.deepEqual([0, 1, 2, 3].map((n) => finishClip(n, true)), ['valorant-1-kill.mp3', 'valorant-2-kills.mp3', 'valorant-4-kills.mp3', 'lol-legendary-kill.mp3']);
});

test('a medal popup speaks by its best medal; other popups only chime', () => {
  assert.equal(medalClip([{ medal: 1 }]), 'lol-quadra-kill.mp3');
  assert.equal(medalClip([{ medal: 1 }, { medal: 2 }, {}]), 'valorant-5-kills.mp3');
  assert.equal(medalClip([{ medal: 3 }]), 'lol-penta-kill.mp3');
  assert.equal(medalClip([{ icon: '🔧' }]), null);
});

test('every voice clip is in assets/sounds, and every file there is used', () => {
  const dir = path.join(WEB, 'assets', 'sounds');
  const used = [...new Set(allClips())].sort();
  assert.equal(used.length, allClips().length, 'no clip is used twice');
  assert.deepEqual(fs.readdirSync(dir).sort(), used);
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
