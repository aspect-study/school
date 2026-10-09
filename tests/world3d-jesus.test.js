const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { JESUS } = require(worldFile('lines.js'));

const all = (g) => [].concat(JESUS[g].greet, JESUS[g].garden, [JESUS[g].proud], JESUS[g].hug,
  JESUS[g].comfort.wrong, JESUS[g].comfort.streak, JESUS[g].comfort.boss);
const NEVER = /wrong|\bmali\b|coin|point|puntos|quiz|streak|score/i;
const FIL_WRONG = /tunog tama|natutunan|\bpwede\b|nakakatakot|^Tapos\b/i;

test('Jesus has enough to say', () => {
  for (const g of ['grade5', 'grade2']) {
    const J = JESUS[g];
    assert.deepEqual([J.greet.length, J.garden.length, J.hug.length, J.comfort.wrong.length, J.comfort.streak.length, J.comfort.boss.length],
      [5, 8, 3, 2, 2, 2], g);
  }
});

test('every line has his words, a verse in kid words and where it is in the Bible', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const l of all(g)) {
      assert.ok(l.say && l.verse && l.ref, g + ' ' + l.say);
      assert.match(l.ref, /\d+:\d+/, l.ref);
    }
  }
});

test('Grade 2 pairs Filipino with English; the English half is the Grade 5 line', () => {
  for (const l of all('grade2')) for (const k of ['say', 'verse', 'ref']) assert.match(l[k], / · /, k + ': ' + l[k]);
  for (const l of all('grade5')) for (const k of ['say', 'verse', 'ref']) assert.doesNotMatch(l[k], / · /, k + ': ' + l[k]);
  const en = all('grade5');
  all('grade2').forEach((l, i) => {
    assert.ok(l.say.endsWith(' · ' + en[i].say), en[i].say);
    assert.ok(l.verse.endsWith(' · ' + en[i].verse), en[i].verse);
  });
});

test('Jesus never quizzes, pays, scolds or talks about a streak', () => {
  for (const g of ['grade5', 'grade2']) for (const l of all(g)) for (const k of ['say', 'verse']) assert.doesNotMatch(l[k], NEVER, l[k]);
  for (const l of all('grade2')) for (const k of ['say', 'verse']) assert.doesNotMatch(l[k], FIL_WRONG, l[k]);
});
