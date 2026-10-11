const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { APPS, appFile, engineFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { keyOf } = require(engineFile('recall.js'));
const { textOf, extract, gameReviewInfo, gameKey } = require('./game-keys.js');

test('textOf decodes entities the way the browser\'s textContent does', () => {
  assert.equal(textOf('25&deg;C'), '25°C');
  assert.equal(textOf('8 &divide; 2'), '8 ÷ 2');
  assert.equal(textOf('a&nbsp;b'), 'a b');
  assert.equal(textOf('&amp;lt;'), '&lt;');
  assert.equal(textOf('it&#8217;s'), 'it’s');
  assert.equal(textOf('it&#x2019;s'), 'it’s');
  assert.equal(textOf('<b>bold</b> and <i class="x">it</i>'), 'bold and it');
  assert.equal(textOf('&lt;b&gt;'), '<b>');
});

test('textOf refuses an entity it does not know, so a key is never silently wrong', () => {
  assert.throws(() => textOf('a &zzz; b'), /zzz/);
});

const withReview = APPS.filter((a) => fs.readFileSync(appFile(a.id), 'utf8').includes('function reviewInfo('));
const quizItems = (id) => lessons(id).filter((l) => !l.generate).flatMap((l) => l.quiz || []);

test('every quiz item of every game gets a review key without errors', () => {
  assert.ok(withReview.length > 10);
  for (const a of withReview) {
    for (const item of quizItems(a.id)) {
      assert.doesNotThrow(() => gameKey(a.id, item), a.id + ': ' + String(item.q).slice(0, 60));
    }
  }
});

// The page's prepareQuestion with an identity shuffle, so prepared items can be compared with raw ones.
function gamePrepare(id) {
  const html = fs.readFileSync(appFile(id), 'utf8');
  if (!html.includes('function prepareQuestion(')) return null;
  const src = 'function shuffle(a){ return a.slice(); }\n' + extract(html, 'prepareQuestion') + '\nprepareQuestion';
  return vm.runInContext(src, vm.createContext({}));
}

test('a raw quiz item and the prepared one the game asks have the same review key', () => {
  let checked = 0;
  for (const a of withReview) {
    const prepare = gamePrepare(a.id);
    if (!prepare) continue;
    const info = gameReviewInfo(a.id);
    for (const item of quizItems(a.id)) {
      const raw = info(item), prepared = info(prepare(item));
      assert.equal(keyOf(a.id, prepared), keyOf(a.id, raw), a.id + ': ' + String(item.q).slice(0, 60));
      assert.equal(prepared.q, item.q, a.id + ': stem changed by prepareQuestion');
      checked++;
    }
  }
  assert.ok(checked > 1000, 'checked ' + checked);
});
