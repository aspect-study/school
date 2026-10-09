const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { APPS, engineFile, appFile, lobbyFile } = require('./paths.js');
const { order, tierFor, PACKS, PACK_IDS, DEFAULT_PACK, PACK_KEY, finishClip, medalClip, allClips, SUBTITLE, POP_MS, POP_CLOSE } = require(engineFile('fx.js'));
const { WEB } = require('./paths.js');


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

test('celebrate order: big first, then events with art, then the original order', () => {
  const ev = [{ id: 'medal' }, { id: 'hit', art: 'x' }, { id: 'quest' }, { id: 'bigmedal', big: true }, { id: 'down', big: true, art: 'x' }];
  assert.deepEqual(order(ev).map((e) => e.id), ['down', 'bigmedal', 'hit', 'medal', 'quest']);
});
