const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
// Common Filipino words: text with any of them must also carry English (parent's rule, 2026-10-01).
const FILIPINO = /\b(ang|mo|na|sa|ng|pa|ka|kay|ni|si|mong|lang|kapag|para|wala|ulit|tama|mali)\b/i;
const ENGLISH = /\b(the|you|your|to|for|of|and|is|or|in|a|it|not|that|try|again|can|more|go|ask|just|yours)\b/i;

function hasEnglishWhereFilipino(text, where) {
  const s = String(text);
  if (FILIPINO.test(s)) assert.match(s, ENGLISH, where + ' is Filipino only: ' + s);
}

test('every Grade 2 power-up message has English', () => {
  const { TEXT } = require(path.join(root, 'grade 2', 'powerups-grade2.js'));
  for (const [key, value] of Object.entries(TEXT.grade2)) {
    if (key === 'helpers') continue;
    const v = typeof value === 'function' ? value(key === 'left' || key === 'confirm' ? 2 : 'Mommy') : value;
    if (key === 'askBody') { hasEnglishWhereFilipino(v + ' ' + TEXT.grade2.askEn('Mommy'), key); continue; }
    hasEnglishWhereFilipino(Array.isArray(v) ? v.join(' ') : v, 'power-ups ' + key);
    if (Array.isArray(v)) assert.ok(!FILIPINO.test(v[1]), key + ': the second line is the English one');
  }
});

test('every Grade 2 coin badge and guide line has English', () => {
  const { GUIDE_TEXT } = require(path.join(root, 'grade 2', 'wallet-grade2.js'));
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
  const html = fs.readFileSync(path.join(root, 'grade 2', 'lobby.html'), 'utf8');
  const start = html.indexOf('window.SHOP_TEXT = {');
  const body = html.slice(start, html.indexOf('};', start));
  // A literal \n in the source separates the Filipino and English lines.
  body.split('\n').slice(1).forEach((line) => hasEnglishWhereFilipino(line.split('\\n').join(' '), 'shop line'));
});

test('Grade 2 games show "points" with every "puntos"', () => {
  for (const file of fs.readdirSync(path.join(root, 'grade 2')).filter((f) => f.endsWith('.html'))) {
    const lines = fs.readFileSync(path.join(root, 'grade 2', file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/puntos|(?<![-\w])sunod-sunod/.test(line)) return;
      const near = lines.slice(i, i + 5).join(' ');
      // A standalone "points", so ids like points-earned don't count as English.
      assert.match(near, /(?<![-\w])points(?![-\w])|in a row/, file + ':' + (i + 1) + ' has no English: ' + line.trim());
    });
  }
});

test('the Grade 2 streak call-out has English', () => {
  const { SUBTITLE } = require(path.join(root, 'grade 2', 'fx-grade2.js'));
  hasEnglishWhereFilipino(SUBTITLE.grade2(3), 'streak subtitle');
  assert.match(SUBTITLE.grade2(3), /3 in a row/);
});
