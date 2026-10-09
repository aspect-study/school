const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { APPS, appFile, worldFile, engineFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { keyOf } = require(engineFile('recall.js'));
const Q = require(worldFile('quiz.js'));

// Stands in for Recall.textOf (the browser's innerHTML → textContent). Both sides use it, so keys can be compared.
const NAMED = { ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', minus: '−', hellip: '…', middot: '·', lt: '<', gt: '>', quot: '"', rarr: '→', uarr: '↑', darr: '↓', sup3: '³', nbsp: ' ', amp: '&' };
const textOf = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z0-9]+);/gi, (m, n) => (n in NAMED ? NAMED[n] : m));

// Cuts `function name(...) { ... }` out of a page by counting braces.
function extract(html, name) {
  const start = html.indexOf('function ' + name + '(');
  let i = html.indexOf('{', start);
  for (let depth = 0; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}

function gameReviewInfo(id) {
  const html = fs.readFileSync(appFile(id), 'utf8');
  const tf = html.match(/SH_TRUE = '([^']*)', SH_FALSE = '([^']*)'/);
  const names = ['decode', 'historyQuestion', 'reviewInfo'].filter((n) => html.includes('function ' + n + '('));
  names.forEach((n) => assert.equal(html.split('function ' + n + '(').length, 2, id + ' has one ' + n));
  const src = names.map((n) => extract(html, n)).join('\n');
  const ctx = vm.createContext({ Recall: { textOf }, SH_TRUE: tf ? tf[1] : 'True', SH_FALSE: tf ? tf[2] : 'False' });
  return vm.runInContext(src + '\nreviewInfo', ctx);
}

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
