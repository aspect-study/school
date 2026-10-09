const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile, APPS } = require('./paths.js');
const { fold, plain, index, find, TEXT } = require(engineFile('search.js'));
const content = require('./content.js');

const LESSONS = [
  { title: 'Ang Barangay', subtitle: 'Ang sinaunang pamayanan', cards: [{ front: 'Datu', back: 'Ang pinuno ng <b>barangay</b>.' }] },
  { title: 'Herarkiya', subtitle: 'Kabisayaan at Luzon', cards: [{ front: 'Timawa', back: 'Malayang tao sa Kabisayaan.' }, { front: 'Datu', back: 'Pinakamataas sa Kabisayaan.' }] },
  { tag: 'Week 1 &middot; Day 2', title: 'Review of the Alphabet', flashcards: [{ title: 'BIG LETTERS', text: 'A, B, C' }] },
  { title: 'Divisibility Rules', subtitle: '2, 3, 4', flashcards: [{ term: 'Divisible by 2', def: 'The last digit is even.' }] },
  { title: 'Pang-ekonomikong Pamumuhay', subtitle: 'Pakikipag-ugnayan sa Tsina', cards: [{ front: 'Ñ at NG', back: 'Kaniya&rsquo;y titik.' }] },
];
const idx = index(LESSONS);
const ids = (q) => find(idx, q).map((f) => f.i);

test('folding drops tags, entities, accents and hyphens, and lowers the case', () => {
  assert.equal(plain('<b>Ang</b> &ldquo;aklat&rdquo;'), 'Ang "aklat"');
  assert.equal(fold('Pang-Ekonomiko &mdash; Ñ'), 'pang ekonomiko n');
  assert.equal(fold('kaniya’y'), "kaniya'y");
});

test('an empty search shows everything (null), not zero results', () => {
  assert.equal(find(idx, ''), null);
  assert.equal(find(idx, '   '), null);
});

test('a title or subtitle match has no hit line', () => {
  assert.deepEqual(find(idx, 'barangay'), [{ i: 0, hit: null }]);
  assert.deepEqual(ids('alphabet'), [2]);
  assert.deepEqual(ids('week 1'), [2]);
});

test('a flashcard match names the flashcard', () => {
  assert.deepEqual(find(idx, 'datu'), [{ i: 0, hit: { card: 'Datu' } }, { i: 1, hit: { card: 'Datu' } }]);
  assert.deepEqual(find(idx, 'malayang'), [{ i: 1, hit: { card: 'Timawa' } }]);
  assert.deepEqual(find(idx, 'even'), [{ i: 3, hit: { card: 'Divisible by 2' } }]);
});

test('every word must be in the lesson, in any order, any case', () => {
  assert.deepEqual(ids('KABISAYAAN datu'), [1]);
  assert.deepEqual(ids('datu pamayanan'), [0]);
  assert.deepEqual(ids('datu zebra'), []);
});

test('hyphens, accents and curly apostrophes do not get in the way', () => {
  assert.deepEqual(ids('pang ekonomiko'), [4]);
  assert.deepEqual(ids('pakikipag-ugnayan'), [4]);
  assert.deepEqual(ids("kaniya'y"), [4]);
});

test('a number finds the lesson in that place, unless the number is in the lesson text', () => {
  assert.deepEqual(find(idx, '5'), [{ i: 4, hit: { lesson: 5 } }]);
  assert.deepEqual(ids('2'), [1, 2, 3]);
  assert.deepEqual(ids('99'), []);
});

test('Grade 2 search messages carry English and Filipino', () => {
  assert.match(TEXT.grade2.placeholder, /Search lessons · Hanapin/);
  assert.match(TEXT.grade2.found(3), /^3 lessons found · 3 aralin/);
  assert.match(TEXT.grade2.none, /^No lesson found\..* · Walang aralin/);
  assert.equal(TEXT.grade5.found(1), '1 lesson found');
});

test('History Explorers: searching the test topics finds their lessons', () => {
  const sidx = index(content.lessons('history-explorers'));
  const has = (q, n) => assert.ok(find(sidx, q).some((f) => f.i === n - 1), q + ' finds lesson ' + n);
  has('pananaw sa kasaysayan', 17);
  has('kalinangang materyal', 7);
  has('kalinangang di materyal', 25);
  has('islam', 26);
  has('tsina', 29);
  has('timawa', 3);
  has('timawa', 24);
});

for (const app of APPS.filter((a) => a.id !== 'math-mastery')) {
  test(app.id + ': every lesson can be found by its own title', () => {
    const lessons = content.lessons(app.id);
    const sidx = index(lessons);
    lessons.forEach((l, i) => assert.ok(find(sidx, plain(l.title)).some((f) => f.i === i), plain(l.title)));
  });
}
