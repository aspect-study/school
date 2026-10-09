const test = require('node:test');
const assert = require('node:assert/strict');
const { lessons, content } = require('./content.js');
const APPS = ['history-explorers', 'wikaharian'];

function loadApp(id) {
  return { LESSONS: lessons(id), STRATEGY: content(id, 'strategy') };
}

for (const file of APPS) {
  test(`${file}: LESSONS and STRATEGY parse as arrays`, () => {
    const { LESSONS, STRATEGY } = loadApp(file);
    assert.ok(Array.isArray(LESSONS) && LESSONS.length > 0, 'LESSONS should be a non-empty array');
    assert.ok(Array.isArray(STRATEGY) && STRATEGY.length > 0, 'STRATEGY should be a non-empty array');
  });

  test(`${file}: every lesson has exactly one tip card, as the last card`, () => {
    const { LESSONS } = loadApp(file);
    for (const lesson of LESSONS) {
      assert.ok(Array.isArray(lesson.cards) && lesson.cards.length >= 1, `${lesson.id}: needs at least one card`);
      const tipCards = lesson.cards.filter(c => c.tip === true);
      assert.equal(tipCards.length, 1, `${lesson.id}: expected exactly one card with tip:true`);
      const last = lesson.cards[lesson.cards.length - 1];
      assert.equal(last.tip, true, `${lesson.id}: the tip card must be the last card`);
      assert.equal(last.front, '🔑 Paano Sagutin?', `${lesson.id}: tip card front text`);
    }
  });

  test(`${file}: every card has non-empty English`, () => {
    const { LESSONS } = loadApp(file);
    for (const lesson of LESSONS) {
      for (const card of lesson.cards) {
        assert.ok(typeof card.en === 'string' && card.en.trim().length > 0,
          `${lesson.id}: card "${card.front}" is missing en`);
        assert.notEqual(card.en, card.back,
          `${lesson.id}: card "${card.front}" en is a verbatim copy of the Filipino back`);
      }
    }
  });

  test(`${file}: every quiz item has non-empty qen and en`, () => {
    const { LESSONS } = loadApp(file);
    for (const lesson of LESSONS) {
      for (const item of lesson.quiz) {
        assert.ok(typeof item.qen === 'string' && item.qen.trim().length > 0,
          `${lesson.id}: quiz "${item.q}" is missing qen`);
        assert.ok(typeof item.en === 'string' && item.en.trim().length > 0,
          `${lesson.id}: quiz "${item.q}" is missing en`);
        assert.notEqual(item.qen, item.q,
          `${lesson.id}: quiz "${item.q}" qen is a verbatim copy of the Filipino question`);
        assert.notEqual(item.en, item.explain,
          `${lesson.id}: quiz "${item.q}" en is a verbatim copy of the Filipino explanation`);
        if (item.q.startsWith('Tama o Mali:')) {
          assert.ok(item.qen.startsWith('True or False:'),
            `${lesson.id}: quiz "${item.q}" qen must start with "True or False:"`);
        }
      }
    }
  });

  test(`${file}: every strategy tip has non-empty English`, () => {
    const { STRATEGY } = loadApp(file);
    for (const tip of STRATEGY) {
      assert.ok(typeof tip.en === 'string' && tip.en.trim().length > 0,
        `strategy tip "${tip.title}" is missing en`);
      assert.notEqual(tip.en, tip.body,
        `strategy tip "${tip.title}" en is a verbatim copy of the Filipino body`);
    }
  });
}
