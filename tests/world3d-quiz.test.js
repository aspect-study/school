const test = require('node:test');
const assert = require('node:assert/strict');
const { APPS, worldFile, engineFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { keyOf } = require(engineFile('recall.js'));
const Q = require(worldFile('quiz.js'));
const { textOf, gameReviewInfo } = require('./game-keys.js');

test('every game except Math Mastery can be asked in the world', () => {
  assert.deepEqual(Object.keys(Q.SHAPES).sort(), APPS.map((a) => a.id).filter((id) => id !== 'math-mastery').sort(),
    'a new game needs a shape in web/world/quiz.js');
  assert.equal(Q.supports('math-mastery'), false);
});

for (const id of Object.keys(Q.SHAPES)) {
  test(id + ': the world builds the same review key as the game, for every question', () => {
    const game = gameReviewInfo(id);
    let asked = 0;
    lessons(id).filter((l) => !l.generate).forEach((l, li) => (l.quiz || []).forEach((item, i) => {
      const where = id + ' lesson ' + (li + 1) + ' question ' + (i + 1);
      const mine = Q.info(id, item, textOf);
      const theirs = game(item);
      assert.equal(keyOf(id, mine), keyOf(id, theirs), where);
      assert.equal(mine.historyAnswer, theirs.historyAnswer, where);
      if (!Q.askable(id, l, item)) return;
      asked++;
      assert.equal(mine.historyQ, theirs.historyQ, where);
      const v = Q.view(id, item, textOf, () => 0.3);
      assert.equal(v.options.filter((o) => o.right).length, 1, where + ' has one right choice');
      assert.equal(v.options.find((o) => o.right).text, v.answer, where);
      assert.ok(v.q, where + ' has a question');
    }));
    assert.ok(asked > 0, id + ' has questions the world can ask');
  });
}

test('pictures, reading passages and generated lessons stay in the game', () => {
  assert.equal(Q.askable('life-lab', {}, { q: 'Q', options: ['a', 'b'], correct: 0, art: '<svg></svg>' }), false);
  assert.equal(Q.askable('page-turners', {}, { q: 'Q', options: ['a', 'b'], correct: 0, passage: 'Once…' }), false);
  assert.equal(Q.askable('block-bot', { generate: () => [] }, { q: 'Q', options: ['1', '2'], correct: 0 }), false);
  assert.equal(Q.askable('byte-buddies', {}, { type: 'mc', q: 'Q', pic: 'x.png', options: [{ text: 'a', correct: true }] }), false);
  assert.equal(Q.askable('word-train', {}, { type: 'tf', q: 'Q', answer: false }), true);
});

test('true/false shows the game\'s own words', () => {
  const v = Q.view('batang-bayani', { type: 'tf', q: 'Q', answer: false, why: 'Pinili mo ang Tama, pero…', bad: 'Hindi totoo.', good: 'Magaling!' }, textOf);
  assert.deepEqual(v.options.map((o) => [o.text, o.right]), [['Tama', false], ['Mali', true]]);
  assert.equal(v.answer, 'Mali');
  assert.equal(v.options[0].why, 'Pinili mo ang Tama, pero…');
  assert.equal(v.explain, 'Hindi totoo.');
});
