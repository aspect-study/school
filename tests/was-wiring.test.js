// A reworded question's was field must name its old review key, so Recall can carry the review progress over.
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { gameKey, hashOf } = require('./game-keys.js');
const Q = require(worldFile('quiz.js'));

for (const id of Object.keys(Q.SHAPES)) {
  test(id + ': every was is an old key hash, not the key now, on a stem used once', () => {
    const stems = new Map();
    lessons(id).forEach((l) => (l.quiz || []).forEach((item) => stems.set(item.q, (stems.get(item.q) || 0) + 1)));
    lessons(id).forEach((l, li) => (l.quiz || []).forEach((item, i) => {
      if (item.was === undefined) return;
      const where = id + ' lesson ' + (li + 1) + ' question ' + (i + 1);
      assert.equal(typeof item.was, 'string', where + ': was is a string');
      assert.match(item.was, /^[0-9a-f]{1,8}$/, where + ': was is a review hash');
      assert.notEqual(item.was, hashOf(gameKey(id, item)), where + ': the key did not change, so was is not needed');
      assert.equal(stems.get(item.q), 1, where + ': another question has the same stem');
    }));
  });
}
