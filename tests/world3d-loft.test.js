const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Lo = require(worldFile('loft.js'));
const L = require(worldFile('layout.js'));
const R = require(worldFile('room.js'));

const counts = { 'life-lab': { lessons: 3, exams: 1 }, wikaharian: { lessons: 0, exams: 2 } };

test('desk squares: the north row, then the east wall, never the ladder, Exam Corner or arrival squares', () => {
  const sq = Lo.deskSquares(10);
  assert.equal(sq.length, 10);
  assert.deepEqual(sq.slice(0, 6), [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5]]);
  assert.deepEqual(sq.slice(6), [[5, 4], [5, 3], [5, 2], [5, 1]]);
  [Lo.LADDER, Lo.EXAM, Lo.ARRIVE].forEach((s) => assert.ok(!sq.some((d) => d[0] === s[0] && d[1] === s[1])));
});

test('one desk per game of the grade, ready only with a Term 2 lesson that is not exam-only', () => {
  ['grade5', 'grade2'].forEach((g) => {
    const desks = Lo.desks(L.APPS[g], counts);
    assert.equal(desks.length, L.APPS[g].length);
    desks.forEach((d) => assert.equal(d.ready, d.app === 'life-lab'));
  });
});

test('Exam Corner lists every game with any Term 2 lesson', () => {
  assert.deepEqual(Lo.examApps(L.APPS.grade5, counts).map((a) => a.app).sort(), ['life-lab', 'wikaharian']);
});

test('urls: desks open ?term=2, the Exam Corner adds exam=1, the bookcase opens ?term=1', () => {
  const a = L.APPS.grade5.filter((x) => x.app === 'life-lab')[0];
  assert.equal(Lo.deskUrl('grade5', a), '../subjects/grade-5/science/index.html?reset=1&term=2');
  assert.equal(Lo.examUrl('grade5', a), '../subjects/grade-5/science/index.html?reset=1&term=2&exam=1');
  assert.equal(Lo.oldUrl('grade5', a), '../subjects/grade-5/science/index.html?reset=1&term=1');
});

test('items: a desk per game, the Exam Corner and the ladder down, all inside the loft', () => {
  const desks = Lo.desks(L.APPS.grade5, counts), items = Lo.items(desks), side = Lo.SIZE * R.SQ;
  assert.equal(items.filter((i) => i.kind === 'loft-desk').length, 10);
  assert.equal(items.filter((i) => i.kind === 'loft-exam').length, 1);
  assert.equal(items.filter((i) => i.kind === 'ladder-down').length, 1);
  items.forEach((i) => {
    assert.ok(i.x > R.ORIGIN.x && i.x < R.ORIGIN.x + side && i.z < R.ORIGIN.z && i.z > R.ORIGIN.z - side, i.id);
  });
});

test('solids: each desk blocks its square, the arrival square stays open', () => {
  const desks = Lo.desks(L.APPS.grade2, counts), solid = Lo.solid(desks), a = R.center(Lo.ARRIVE[0], Lo.ARRIVE[1]);
  assert.equal(solid.length, desks.length + 1, 'desks plus the Exam Corner board');
  assert.ok(!solid.some((q) => Math.abs(a.x - q.x) < q.hx && Math.abs(a.z - q.z) < q.hz));
});
