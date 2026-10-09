const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { worldFile, engineFile } = require('./paths.js');

function load(files, helperOn) {
  const ctx = vm.createContext({ location: { pathname: '/world/grade-2.html' }, console });
  if (helperOn) ctx.localStorage = { getItem: () => 'on', setItem() {} };
  for (const f of [engineFile('lang.js')].concat(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  return ctx.World3D;
}

const raw = {
  lines: require(worldFile('lines.js')), buddies: require(worldFile('buddies.js')), teach: require(worldFile('teach.js')),
  loot: require(worldFile('loot.js')), mategame: require(worldFile('mategame.js')), matelines: require(worldFile('matelines.js')),
  chat: require(worldFile('chat.js'))
};

function strings(x, out) {
  out = out || [];
  if (typeof x === 'string') out.push(x);
  else if (typeof x === 'function') {
    [[2, 'Math'], [1, { fil: 'Pusa', en: 'Cat' }]].forEach((a) => { try { strings(x(a[0], a[1]), out); } catch (e) { strings(x('the gate'), out); } });
  }
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (x && typeof x === 'object') Object.keys(x).forEach((k) => strings(x[k], out));
  return out;
}

const english = load(['lines.js', 'buddies.js', 'chat.js', 'teach.js', 'loot.js', 'mategame.js', 'matelines.js'].map(worldFile), false);
const both = load(['lines.js', 'buddies.js', 'chat.js', 'teach.js', 'loot.js', 'mategame.js', 'matelines.js'].map(worldFile), true);

test('Grade 2 world text is English only by default', () => {
  const tables = {
    'lines TEXT': english.Lines.TEXT.grade2, 'jesus': english.Lines.JESUS.grade2, 'teach': english.Teach.TEXT.grade2,
    'loot': english.Loot.TEXT.grade2, 'mategame': english.MateGame.TEXT.grade2, 'matelines': english.MateLines.TEXT.grade2
  };
  for (const name of Object.keys(tables)) {
    for (const s of strings(tables[name])) assert.ok(!s.includes(' · '), name + ': ' + s);
  }
  for (const app of Object.keys(english.Buddies.BUDDIES.grade2)) {
    const hi = english.Buddies.BUDDIES.grade2[app].hi;
    if (app === 'kuwentista' || app === 'batang-bayani') assert.ok(hi.includes(' · '), app);
    else assert.ok(!hi.includes(' · '), app);
  }
});

test('English-only lines are exactly the English half, with the emoji kept', () => {
  assert.equal(english.Lines.TEXT.grade2.boss('Math'), '⚔️ The boss is waiting in Math! Beat a stage at the Boss Fort.');
  assert.equal(english.Lines.TEXT.grade2.hoot.wise[0], 'Reviewing helps you remember what you learned.');
  assert.equal(english.Lines.JESUS.grade2.greet[0].ref, 'Psalm 118:24');
  assert.equal(english.Loot.TEXT.grade2.opened, '🎉 Right! The gift is open!');
  assert.equal(english.Loot.TEXT.grade2.giftAsk, 'Answer to open me! 🎁');
  assert.equal(english.MateLines.TEXT.grade2.right[0], '🎉 Great job! You got it!');
  assert.equal(english.MateLines.TEXT.grade2.golds(3), '3 gold medals! You study a lot! 🏅');
  assert.equal(english.Teach.TEXT.grade2.remember('Mars'), 'Remember: Mars');
  assert.equal(english.MateGame.TEXT.grade2.hint('the gate'), '🤭 I hear a giggle near the gate!');
  assert.equal(english.MateGame.TEXT.grade2.hint(null), '🤭 I hear a giggle somewhere!');
});

test('every pair in the Grade 2 tables keeps its English half when made English only', () => {
  const pairs = [raw.lines.TEXT.grade2, raw.teach.TEXT.grade2, raw.loot.TEXT.grade2, raw.mategame.TEXT.grade2, raw.matelines.TEXT.grade2];
  const en = [english.Lines.TEXT.grade2, english.Teach.TEXT.grade2, english.Loot.TEXT.grade2, english.MateGame.TEXT.grade2, english.MateLines.TEXT.grade2];
  pairs.forEach((table, i) => {
    const a = strings(table), b = strings(en[i]);
    assert.equal(a.length, b.length);
    a.forEach((s, k) => {
      const cut = s.lastIndexOf(' · ');
      if (cut < 0) return assert.equal(b[k], s);
      const tail = s.slice(cut + 3), lead = /^[^\p{L}\p{N}]*/u.exec(s)[0];
      assert.equal(b[k], tail.startsWith(lead) ? tail : lead + tail, s);
    });
  });
});

test('trees, step lines and fun questions follow the switch', () => {
  assert.ok(!english.Chat.quote('grade2', 'oak', 'Mon', 0).includes(' · '));
  assert.ok(both.Chat.quote('grade2', 'oak', 'Mon', 0).includes(' · '));
  assert.ok(!english.MateLines.fun('grade2')[0].text.includes(' · '));
  assert.ok(both.MateLines.fun('grade2')[0].text.includes(' · '));
  assert.ok(both.Lines.TEXT.grade2.boss('Math').includes(' · '));
  assert.ok(both.Teach.TEXT.grade2.picked.includes(' · '));
});

test('a Filipino subject buddy keeps both languages; others show English', () => {
  const s = { boss: true, due: 0 };
  const fil = english.Chat.buddyLines('grade2', s, { now: 0, subject: 'Filipino', hi: english.Buddies.BUDDIES.grade2.kuwentista.hi });
  const math = english.Chat.buddyLines('grade2', s, { now: 0, subject: 'Math', hi: english.Buddies.BUDDIES.grade2['block-bot'].hi });
  assert.ok(fil[0].includes(' · '));
  assert.ok(!math[0].includes(' · '));
  assert.ok(math[0].startsWith('Beep! Hello, friend! ⚔️ The boss'), math[0]);
});

test('the pet teacher shows only the English line of a two-line step, except for Filipino subjects', () => {
  const view = { answer: 'Mars', explain: 'Pula ang Mars.\nMars is red.' };
  assert.deepEqual(Array.from(english.Teach.lesson('grade2', view, { text: 'V', why: '' }, () => 0).steps), ['Mars is red.', 'Remember: Mars']);
  const f = english.Teach.lesson('grade2', Object.assign({ app: 'kuwentista' }, view), { text: 'V', why: '' }, () => 0);
  assert.deepEqual(Array.from(f.steps), ['Pula ang Mars.\nMars is red.', 'Tandaan · Remember: Mars']);
  assert.deepEqual(both.Teach.lesson('grade2', view, { text: 'V', why: '' }, () => 0).steps[0], 'Pula ang Mars.\nMars is red.');
});
