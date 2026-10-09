process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const C = require(worldFile('care.js'));
const { JESUS } = require(worldFile('lines.js'));
const { streakOf } = require(engineFile('quests.js'));

const TODAY = '2026-10-06';
const dayKey = (t) => (t < 100 ? '2026-10-05' : TODAY);

test('tally counts today\'s quiz answers only', () => {
  const entries = [
    { type: 'quiz', t: 200, answered: 8, correct: 3 },
    { type: 'quiz', t: 50, answered: 9, correct: 0 },
    { type: 'open', t: 200 },
    { type: 'quiz', t: 300, answered: 2, correct: 5 },
    null,
  ];
  assert.deepEqual(C.tally(entries, TODAY, dayKey), { answered: 10, correct: 5, wrong: 5 });
  assert.deepEqual(C.tally(null, TODAY, dayKey), { answered: 0, correct: 0, wrong: 0 });
});

test('a hard day: 5+ wrong under 60% right, a broken streak, or a missed boss stage, in that order', () => {
  const t = (answered, correct) => ({ answered, correct, wrong: answered - correct });
  assert.equal(C.hardDay({ tally: t(10, 5) }), 'wrong');
  assert.equal(C.hardDay({ tally: t(20, 15) }), null, '75% right is a good day');
  assert.equal(C.hardDay({ tally: t(6, 2) }), null, 'only 4 wrong');
  assert.equal(C.hardDay({ tally: t(0, 0), broke: true }), 'streak');
  assert.equal(C.hardDay({ tally: t(0, 0), bossMissed: true }), 'boss');
  assert.equal(C.hardDay({ tally: t(10, 5), broke: true, bossMissed: true }), 'wrong');
  assert.equal(C.hardDay({}), null);
});

test('the streak broke today: alive yesterday, gone today', () => {
  assert.equal(C.streakBroke(['2026-10-01'], '2026-10-05', '2026-10-04', streakOf), true);
  assert.equal(C.streakBroke(['2026-10-01'], '2026-10-04', '2026-10-03', streakOf), false, 'still alive');
  assert.equal(C.streakBroke([], '2026-10-05', '2026-10-04', streakOf), false, 'never had one');
  assert.equal(C.streakBroke(['2026-10-01'], '2026-10-05', '2026-10-04', () => { throw new Error('x'); }), false);
});

test('comfort wins over the greeting; each comes once a day', () => {
  const D = TODAY;
  assert.equal(C.visit({ greeted: '', comforted: '' }, D, null), 'greet');
  assert.equal(C.visit({ greeted: '', comforted: '' }, D, 'wrong'), 'comfort');
  assert.equal(C.visit({ greeted: D, comforted: '' }, D, null), null);
  assert.equal(C.visit({ greeted: D, comforted: '' }, D, 'boss'), 'comfort', 'a hard day later on still brings comfort');
  assert.equal(C.visit({ greeted: D, comforted: D }, D, 'boss'), null);
  assert.equal(C.visit({ greeted: '2026-10-05', comforted: '2026-10-05' }, D, null), 'greet', 'a new day');
});

test('pick: the same line all day, the next one with k, and not always the same day to day', () => {
  const list = JESUS.grade5.greet;
  assert.equal(C.pick(list, TODAY, 0), C.pick(list, TODAY, 0));
  assert.equal(list.indexOf(C.pick(list, TODAY, 1)), (list.indexOf(C.pick(list, TODAY, 0)) + 1) % list.length);
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
  assert.ok(new Set(days.map((d) => C.pick(list, d, 0))).size > 1);
});

test('the garden starts with the line of the day, and after a long study day with "proud"', () => {
  const J = JESUS.grade5;
  const plain = C.gardenLines(J, { answered: 10 }, TODAY);
  assert.equal(plain.length, J.garden.length);
  assert.equal(plain[0], C.pick(J.garden, TODAY, 0));
  assert.deepEqual(new Set(plain), new Set(J.garden));
  const long = C.gardenLines(J, { answered: 30 }, TODAY);
  assert.equal(long[0], J.proud);
  assert.equal(long.length, J.garden.length + 1);
  assert.equal(C.gardenLines(J, null, TODAY)[0], plain[0]);
});
