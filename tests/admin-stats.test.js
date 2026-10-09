const test = require('node:test');
const assert = require('node:assert/strict');
const { web } = require('./paths.js');
const Stats = require(web('admin/admin-stats.js'));

const NOW = new Date(2026, 9, 9, 15).getTime();
const at = (daysAgo, hour) => new Date(2026, 9, 9 - daysAgo, hour).getTime();
const quiz = (uid, learnerId, app, appTitle, answered, t) => ({ uid, learnerId, entry: { type: 'quiz', app, appTitle, answered, t } });

function fixture() {
  return {
    families: [
      { uid: 'f1', email: 'a@x.com', lastSeenAt: at(0, 9) },
      { uid: 'f2', email: 'b@x.com', lastSeenAt: at(10, 9) },
      { uid: 'f3', email: 'c@x.com', lastSeenAt: null }
    ],
    learners: [
      { uid: 'f1', id: 'l1', grade: 2 },
      { uid: 'f1', id: 'l2', grade: 5 },
      { uid: 'f2', id: 'l3', grade: 5 }
    ],
    history: [
      quiz('f1', 'l1', 'math2', 'Block Bot', 10, at(0, 10)),
      quiz('f1', 'l1', 'math2', 'Block Bot', 5, at(3, 10)),
      quiz('f2', 'l3', 'sci5', 'Life Lab', 7, at(8, 10)),
      quiz('f2', 'l3', 'sci5', 'Life Lab', 4, at(31, 10)),
      { uid: 'f1', learnerId: 'l2', entry: { type: 'lesson', app: 'sci5', appTitle: 'Life Lab', t: at(0, 11) } },
      { uid: 'f1', learnerId: 'l2', entry: null },
      { uid: 'f1', learnerId: 'l2', entry: { type: 'quiz', answered: 3 } }
    ]
  };
}

test('totals count families, children and grades', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.totals, { families: 3, children: 3, grade2: 1, grade5: 2 });
});

test('active families and children use today and the last 7 days', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.active, { familiesToday: 1, families7: 1, childrenToday: 2, children7: 2 });
});

test('questions per day cover 30 days and ignore older or broken entries', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily[29].day, '2026-10-09');
  assert.equal(s.daily[29].answered, 10);
  assert.equal(s.daily[26].answered, 5);
  assert.equal(s.daily[21].answered, 7);
  assert.equal(s.daily.reduce((n, d) => n + d.answered, 0), 22);
  assert.equal(s.questionsToday, 10);
});

test('subjects add up questions answered, biggest first', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.subjects, [
    { app: 'math2', title: 'Block Bot', answered: 15 },
    { app: 'sci5', title: 'Life Lab', answered: 7 }
  ]);
});

test('family rows show children, last sync and a stale flag, newest first', () => {
  const s = Stats.compute(fixture(), NOW);
  assert.deepEqual(s.families.map((f) => [f.uid, f.children, f.stale]), [['f1', 2, false], ['f2', 1, true], ['f3', 0, false]]);
  assert.equal(s.families[2].lastSeenAt, null);
});

test('empty or missing input gives zeros', () => {
  const s = Stats.compute({}, NOW);
  assert.deepEqual(s.totals, { families: 0, children: 0, grade2: 0, grade5: 0 });
  assert.equal(s.daily.length, 30);
  assert.deepEqual(s.subjects, []);
  assert.deepEqual(s.families, []);
});

test('hostile history entries cannot pollute the stats', () => {
  const data = fixture();
  data.history.push(quiz('f1', 'l1', '__proto__', 'Evil', 5, at(0, 12)));
  data.history.push(quiz('f1', 'l1', 'math2', 'Block Bot', NaN, at(0, 12)));
  data.history.push(quiz('f1', 'l1', 'math2', 'Block Bot', Infinity, at(0, 12)));
  const s = Stats.compute(data, NOW);
  assert.equal({}.answered, undefined);
  assert.equal(s.questionsToday, 15);
  assert.ok(s.daily.every((d) => Number.isFinite(d.answered)));
  assert.deepEqual(s.subjects.map((x) => x.app), ['math2', 'sci5', '__proto__']);
});
