const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Tr = require(worldFile('trophies.js'));
const L = require(worldFile('layout.js'));
const { TEXT } = require(worldFile('text.js'));

// A mastery_v1 app entry from a list of best medals.
function entry(bests) {
  const lessons = {}, order = [];
  bests.forEach((b, i) => { order.push('l' + i); lessons['l' + i] = { title: 'L' + i, icon: '', now: b, best: b, paid: b }; });
  return { t: 1, order, lessons };
}
const many = (n, v) => Array.from({ length: n }, () => v);

test('trophy colours at their edges: 80% gold, half silver, any medal bronze', () => {
  assert.equal(Tr.level(entry([...many(8, 3), 0, 0])), 3, '8 of 10 gold');
  assert.equal(Tr.level(entry([...many(7, 3), ...many(3, 2)])), 2, '7 gold and 3 silver');
  assert.equal(Tr.level(entry([...many(5, 2), ...many(5, 0)])), 2, '5 of 10 silver');
  assert.equal(Tr.level(entry([...many(4, 2), 1, ...many(5, 0)])), 1, '4 silver and a bronze');
  assert.equal(Tr.level(entry(many(10, 0))), 0, 'no medal yet');
  assert.equal(Tr.level(null), 0, 'a game never opened');
  assert.equal(Tr.level(entry([])), 0, 'no lessons known');
  assert.equal(Tr.level({ lessons: 'junk' }), 0);
});

test('counts: medals by colour, total and lessons still to go', () => {
  assert.deepEqual(Tr.counts(entry([3, 3, 2, 1, 0, 0, 7, 'x'])), { gold: 3, silver: 1, bronze: 1, total: 8, none: 2 + 1 });
  assert.deepEqual(Tr.counts(null), { gold: 0, silver: 0, bronze: 0, total: 0, none: 0 });
});

test('the bubble line in both grades', () => {
  const e = entry([...many(5, 3), ...many(3, 2), ...many(2, 1), ...many(8, 0)]);
  assert.equal(Tr.line({ emoji: '🔬', sign: 'Life Lab' }, e, 'grade5', TEXT.grade5), '🔬 Life Lab: 🥇 5 · 🥈 3 · 🥉 2 · 8 to go');
  const g5 = L.APPS.grade5.find((a) => a.app === 'life-lab');
  assert.equal(Tr.line(g5, e, 'grade5', TEXT.grade5), '🔬 Science: 🥇 5 · 🥈 3 · 🥉 2 · 8 to go');
  assert.equal(Tr.line(Object.assign({ title: 'Life Lab' }, g5), e, 'grade5', TEXT.grade5), '🔬 Life Lab: 🥇 5 · 🥈 3 · 🥉 2 · 8 to go');
  const g2 = L.APPS.grade2.find((a) => a.app === 'science-detectives');
  assert.equal(Tr.line(g2, e, 'grade2', TEXT.grade2), '🔍 Agham: 🥇 5 · 🥈 3 · 🥉 2 · 8 pa · 8 to go');
  const fil = L.APPS.grade2.find((a) => a.app === 'kuwentista');
  assert.equal(Tr.line(fil, entry([3]), 'grade2', TEXT.grade2), '📚 Filipino: 🥇 1 · 🥈 0 · 🥉 0', 'nothing to go: no to-go part');
  assert.equal(Tr.subject(g2, 'grade5'), 'Agham · Science');
});

test('levels and medals cover only her grade\'s subjects; medals counts lessons with a best medal', () => {
  const mastery = { v: 1, apps: {
    'life-lab': entry([3, 3, 3, 3, 3]),
    'math-mastery': entry([1, 0, 2, 2]),
    'block-bot': entry([3, 3, 3]),
    'kuwentista': entry([0])
  } };
  const g5 = Tr.levels('grade5', mastery);
  assert.deepEqual(Object.keys(g5), L.APPS.grade5.map((a) => a.app));
  assert.equal(g5['life-lab'], 3);
  assert.equal(g5['math-mastery'], 2);
  assert.equal(g5['page-turners'], 0);
  assert.deepEqual(Object.keys(Tr.levels('grade2', mastery)), L.APPS.grade2.map((a) => a.app));
  assert.equal(Tr.medals('grade5', mastery), 8);
  assert.equal(Tr.medals('grade2', mastery), 3);
  assert.equal(Tr.medals('grade5', null), 0);
  assert.equal(Tr.levels('grade2', 'junk')['block-bot'], 0);
});

test('medal names for the trophy-up line', () => {
  assert.deepEqual(Tr.NAMES.en, ['Grey', 'Bronze', 'Silver', 'Gold']);
  assert.deepEqual(Tr.NAMES.fil.slice(1), ['Tanso', 'Pilak', 'Ginto']);
});
