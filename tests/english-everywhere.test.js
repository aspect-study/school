const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile, lobbyFile, appFile, appsOf } = require('./paths.js');

// Common Filipino words: text with any of them must also carry English (parent's rule, 2026-10-01).
const FILIPINO = /\b(ang|mo|na|sa|ng|pa|ka|kay|ni|si|mong|lang|kapag|para|wala|ulit|tama|mali)\b/i;
const ENGLISH = /\b(the|you|your|to|for|of|and|is|or|in|a|it|not|that|try|again|can|more|go|ask|just|yours|with)\b/i;

function hasEnglishWhereFilipino(text, where) {
  const s = String(text);
  if (FILIPINO.test(s)) assert.match(s, ENGLISH, where + ' is Filipino only: ' + s);
}

test('every Grade 2 power-up message has English', () => {
  const { TEXT } = require(engineFile('powerups.js'));
  for (const [key, value] of Object.entries(TEXT.grade2)) {
    if (key === 'helpers') continue;
    const v = typeof value === 'function' ? value(key === 'left' || key === 'confirm' ? 2 : 'Mommy') : value;
    if (key === 'askBody') { hasEnglishWhereFilipino(v + ' ' + TEXT.grade2.askEn('Mommy'), key); continue; }
    hasEnglishWhereFilipino(Array.isArray(v) ? v.join(' ') : v, 'power-ups ' + key);
    if (Array.isArray(v)) assert.ok(!FILIPINO.test(v[1]), key + ': the second line is the English one');
  }
});

test('every Grade 2 coin badge and guide line has English', () => {
  const { GUIDE_TEXT } = require(engineFile('wallet.js'));
  const g = GUIDE_TEXT.grade2;
  for (const key of ['have', 'goal', 'badge', 'haveNow']) hasEnglishWhereFilipino(g[key](5), 'guide ' + key);
  hasEnglishWhereFilipino(g.goal(0), 'guide goal reached');
  hasEnglishWhereFilipino(g.close, 'guide close');
  hasEnglishWhereFilipino(g.badgeLabel, 'guide badgeLabel');
  hasEnglishWhereFilipino(g.title + ' ' + g.titleEn, 'guide title');
  for (const s of g.sections(40)) {
    assert.ok(s[3], s[1] + ' has an English line');
    hasEnglishWhereFilipino(s[1], 'guide section title');
  }
});

test('every Grade 2 shop line has English', () => {
  const html = fs.readFileSync(lobbyFile(2), 'utf8');
  const start = html.indexOf('window.SHOP_TEXT = {');
  const body = html.slice(start, html.indexOf('};', start));
  // A literal \n in the source separates the Filipino and English lines.
  body.split('\n').slice(1).forEach((line) => hasEnglishWhereFilipino(line.split('\\n').join(' '), 'shop line'));
});

test('Grade 2 games show "points" with every "puntos"', () => {
  for (const file of [lobbyFile(2), ...appsOf(2).map((a) => appFile(a.id))]) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/puntos|(?<![-\w])sunod-sunod/.test(line)) return;
      const near = lines.slice(i, i + 5).join(' ');
      // A standalone "points", so ids like points-earned don't count as English. kit.resultLine() is the English points line.
      assert.match(near, /(?<![-\w])points(?![-\w])|in a row|kit\.resultLine\(\)/, file + ':' + (i + 1) + ' has no English: ' + line.trim());
    });
  }
});

test('the Grade 2 streak call-out has English', () => {
  const { SUBTITLE } = require(engineFile('fx.js'));
  hasEnglishWhereFilipino(SUBTITLE.grade2(3), 'streak subtitle');
  assert.match(SUBTITLE.grade2(3), /3 in a row/);
});

test('every Grade 2 medal and popup line has English', () => {
  const { TEXT } = require(engineFile('mastery.js'));
  const c = { gold: 1, silver: 2, bronze: 3, total: 9 };
  const samples = {
    newLine: [[{ level: 2, title: 'Halaman', points: 40 }]],
    chip: [[c]],
    name: [[1], [2], [3]],
    medalTitle: [[{ level: 1, title: 'Halaman' }], [{ level: 2, title: 'Halaman' }], [{ level: 3, title: 'Halaman' }]],
    medalLine: [[1, 1], [1, 5], [2, 5], [3, 5]],
    medalNext: [[1], [2], [3]],
    subjectTitle: [[1, 'Kuwentista'], [2, 'Kuwentista'], [3, 'Kuwentista']],
    subjectLine: [[1], [2], [3]],
    subjectNext: [[1, 1], [2, 3], [3, 0]],
    fixedTitle: [[1], [3]],
    fixedLine: [[1], [3]],
    fixedNext: [[1], [3]],
  };
  for (const [key, value] of Object.entries(TEXT.grade2)) {
    if (typeof value !== 'function') { hasEnglishWhereFilipino(value, 'medal ' + key); continue; }
    assert.ok(samples[key], 'add sample arguments for ' + key);
    for (const args of samples[key]) hasEnglishWhereFilipino(value(...args), 'medal ' + key);
  }
});

test('every Grade 2 quest and streak line has English', () => {
  const { TEXT } = require(engineFile('quests.js'));
  const t = TEXT.grade2;
  const quests = ['review', 'practice', 'stars', 'right', 'rounds', 'explore', 'best'].map((kind) => t.quest({ kind, title: 'Kuwentista', lesson: 'Pangngalan' }));
  const lines = [t.title, t.doneTitle, t.allTitle, t.allNext, t.doneNext(2, 3), t.streakTitle(7), t.streakNext(14), t.streakNext(0),
    t.streak({ days: 5, restLeft: 2 }), t.streak({ days: 5, restLeft: 0 }), t.streak({ days: 0, welcomeBack: true }), t.streak({ days: 0 })].concat(quests);
  lines.forEach((line) => hasEnglishWhereFilipino(line, 'quest text'));
});

test('every Grade 2 navigation line has English', () => {
  const { TEXT } = require(engineFile('nav.js'));
  for (const [key, value] of Object.entries(TEXT.grade2)) hasEnglishWhereFilipino(value, 'nav ' + key);
  assert.match(TEXT.grade2.leaveBody, /points/i, 'puntos comes with points');
});
