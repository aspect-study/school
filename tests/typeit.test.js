const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { loadGame, GRADE5, GRADE2 } = require('./load-games.js');
const { normalize, matches } = require(engineFile('recall.js'));

const plain = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ');

for (const app of GRADE5.concat(GRADE2)) {
  test(app + ': every typed question is real and can be answered without the choices', () => {
    const { questions, typeIt } = loadGame(app);
    assert.ok(typeIt, 'TYPE_IT map present');
    assert.ok(Object.keys(typeIt).length >= 1, 'at least one typed question, so the e2e recall check can type');
    const byStem = new Map(questions.map((q) => [q.q, q]));
    for (const [stem, accept] of Object.entries(typeIt)) {
      const q = byStem.get(stem);
      const where = `${app}: "${stem}"`;
      assert.ok(q, `${where} is not a stem in this game`);
      assert.ok(Array.isArray(accept), `${where}: value must be an array of other accepted answers`);
      assert.ok(!q.tf, `${where}: True/False cannot be typed`);
      assert.ok(q.optionCount >= 3, `${where}: only 2 choices, a coin flip`);
      assert.doesNotMatch(stem, /which of (these|the following)|alin sa mga/i, `${where}: needs the choices`);
      assert.doesNotMatch(stem, /\bNOT\b|\bHINDI\b/, `${where}: a NOT question needs the choices`);
      const words = normalize(plain(q.answer)).split(' ').filter(Boolean);
      assert.ok(words.length >= 1 && words.length <= 3, `${where}: answer "${q.answer}" is not 1-3 words`);
      for (const alt of accept) assert.ok(normalize(alt), `${where}: empty accepted answer`);
      for (const w of q.wrong) assert.ok(!matches(plain(w), plain(q.answer), accept, q.wrong.map(plain)), `${where}: typing the wrong choice "${w}" would be accepted`);
    }
  });
}
