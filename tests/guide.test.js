const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const G = require(engineFile('guide.js'));
const W = require(engineFile('world.js'));
const { next, lessonsOf, firstOpen, findLesson, recentApp, todayQuests, dayKey, link, bubble, avatarOf, TEXT, AVATARS } = G;

const CARDS = [
  { app: 'history-explorers', name: 'History Explorers', href: '../subjects/grade-5/araling-panlipunan/index.html' },
  { app: 'life-lab', name: 'Life Lab', href: '../subjects/grade-5/science/index.html' },
  { app: 'math-mastery', name: 'Math Mastery', href: '../subjects/grade-5/math/index.html' },
];

// entry(['a', 'Title', best], ...) is one game's mastery_v1 entry.
function entry(...lessons) {
  const e = { order: [], lessons: {} };
  lessons.forEach(([id, title, best]) => { e.order.push(id); e.lessons[id] = { title, icon: '', now: best, best, paid: best }; });
  return e;
}
const ALL_BRONZE = {
  'history-explorers': entry(['h1', 'Kasaysayan', 1]),
  'life-lab': entry(['a', 'What Is Matter', 2], ['b', 'Matter', 1]),
  'math-mastery': entry(['m1', 'Divisibility', 3]),
};
const base = (extra) => Object.assign({ cards: CARDS, mastery: ALL_BRONZE }, extra);

test('the buddies are the same as on the map', () => {
  assert.deepEqual(AVATARS, W.AVATARS);
});

test('an open boss stage comes first', () => {
  const s = next(base({ stages: [{ app: 'life-lab', cleared: true }, { app: 'math-mastery', cleared: false }], due: { 'life-lab': 9 } }), 'grade5');
  assert.deepEqual(s, { kind: 'boss', app: 'math-mastery', text: '⚔️ The boss is waiting in Math Mastery!' });
});

test('then the game with the most due review, ties to the lobby order', () => {
  assert.deepEqual(next(base({ due: { 'life-lab': 3, 'math-mastery': 5 } }), 'grade5'),
    { kind: 'review', app: 'math-mastery', text: '🔁 Math Mastery has 5 review questions waiting', count: 5 });
  assert.equal(next(base({ due: { 'math-mastery': 2, 'life-lab': 2 } }), 'grade5').app, 'life-lab');
  assert.equal(next(base({ due: { 'life-lab': 1 } }), 'grade5').text, '🔁 Life Lab has 1 review question waiting');
  assert.equal(next(base({ due: { 'not-here': 9, 'life-lab': -2 } }), 'grade5').kind, 'done');
});

test('then a quest for a game: practice opens its lesson, explore opens the game, others are skipped', () => {
  const mastery = Object.assign({}, ALL_BRONZE, { 'life-lab': entry(['a', 'What Is Matter', 1], ['b', 'Matter', 0]) });
  const quests = [{ kind: 'stars', done: false }, { kind: 'practice', app: 'life-lab', lesson: 'what is  matter', done: false }];
  assert.deepEqual(next(base({ mastery, quests }), 'grade5'),
    { kind: 'quest', app: 'life-lab', text: "🎯 Today's quest: practice what is  matter in Life Lab", lesson: 'a', title: 'what is  matter' });
  assert.deepEqual(next(base({ quests: [{ kind: 'explore', app: 'math-mastery', done: false }] }), 'grade5'),
    { kind: 'quest', app: 'math-mastery', text: "🎯 Today's quest: play Math Mastery" });
  assert.equal(next(base({ quests: [{ kind: 'explore', app: 'math-mastery', done: true }, { kind: 'review', app: 'life-lab', done: false }] }), 'grade5').kind, 'done');
  assert.equal(next(base({ quests: [{ kind: 'practice', app: 'life-lab', lesson: 'Gone lesson', done: false }] }), 'grade5').lesson, null);
});

test('then the next lesson without Bronze, in the game she played last first', () => {
  const mastery = Object.assign({}, ALL_BRONZE, {
    'history-explorers': entry(['h1', 'Kasaysayan', 0]),
    'life-lab': entry(['a', 'What Is Matter', 1], ['b', 'Matter', 0], ['c', 'Measure', 0]),
  });
  assert.deepEqual(next(base({ mastery, recent: 'life-lab' }), 'grade5'),
    { kind: 'lesson', app: 'life-lab', text: '📘 Next stop: Matter in Life Lab', lesson: 'b', title: 'Matter' });
  assert.equal(next(base({ mastery }), 'grade5').app, 'history-explorers', 'no recent game: lobby order');
  assert.equal(next(base({ mastery, recent: 'math-mastery' }), 'grade5').app, 'history-explorers', 'the last game is all Bronze: lobby order');
  assert.equal(next(base({ mastery, recent: 'shop' }), 'grade5').app, 'history-explorers');
});

test('then a game never opened, then all done', () => {
  assert.deepEqual(next(base({ mastery: { 'life-lab': ALL_BRONZE['life-lab'] } }), 'grade5'),
    { kind: 'visit', app: 'history-explorers', text: '🧭 Visit History Explorers for the first time' });
  assert.deepEqual(next(base({}), 'grade5'), { kind: 'done', app: null, text: '🎉 All done today! Great work!' });
  assert.deepEqual(next(base({ canAfford: true }), 'grade5'),
    { kind: 'done', app: null, text: '🎉 All done today! You can buy a reward in the shop', shop: true });
});

test('inside a game: only that game counts, then the Mock Exam, then home', () => {
  const g = (extra) => next(Object.assign({ cards: [{ app: 'life-lab', name: 'Life Lab' }], app: 'life-lab', mastery: ALL_BRONZE }, extra), 'grade5');
  assert.equal(g({ stages: [{ app: 'math-mastery', cleared: false }] }).kind, 'mock', "another game's boss is not here");
  assert.deepEqual(g({ stages: [{ app: 'life-lab', cleared: false }] }), { kind: 'boss', app: 'life-lab', text: '⚔️ The boss is waiting here! Clear this stage.' });
  assert.deepEqual(g({ due: { 'life-lab': 3, 'math-mastery': 9 } }), { kind: 'review', app: 'life-lab', text: '🔁 3 review questions are waiting', count: 3 });
  assert.equal(g({ quests: [{ kind: 'explore', app: 'life-lab', done: false }] }).kind, 'mock', 'explore is for the lobby');
  assert.deepEqual(g({ quests: [{ kind: 'practice', app: 'life-lab', lesson: 'Matter', done: false }] }),
    { kind: 'quest', app: 'life-lab', text: "🎯 Today's quest: practice Matter", lesson: 'b', title: 'Matter' });
  assert.deepEqual(g({ mastery: { 'life-lab': entry(['a', 'What Is Matter', 1], ['b', 'Matter', 0]) } }),
    { kind: 'lesson', app: 'life-lab', text: '📘 Next stop: Matter', lesson: 'b', title: 'Matter' });
  assert.deepEqual(g({ finalStars: 2 }), { kind: 'mock', app: 'life-lab', text: '🏆 Every lesson has a medal! Try the Mock Exam for 3 stars' });
  assert.deepEqual(g({ finalStars: 3 }), { kind: 'home', app: 'life-lab', text: '🏠 This game is all Bronze! Go back to the map for your next stop' });
  assert.equal(g({ cards: [] }).kind, 'mock', 'works with no card list');
});

test('broken data never throws and reads as empty', () => {
  for (const o of [null, 7, { cards: 'x', stages: 'x', due: [], quests: {}, mastery: 3 }, { cards: [null, { app: 5 }], stages: [null, { app: 'life-lab' }] }]) {
    assert.equal(next(o, 'grade5').kind, 'done');
  }
  assert.deepEqual(lessonsOf({ order: ['a', 'a', 5, 'gone'], lessons: { a: { best: '2' }, gone: null } }), [{ id: 'a', title: 'a', best: 2 }]);
  assert.deepEqual(lessonsOf(null), []);
  assert.equal(firstOpen(entry(['a', 'A', 1])), null);
  assert.deepEqual(firstOpen(entry(['a', 'A', 1], ['b', 'B', 0])), { id: 'b', title: 'B', best: 0 });
  assert.equal(findLesson(null, 'x'), null);
});

test('the game played last comes from study history', () => {
  const apps = ['life-lab', 'math-mastery'];
  assert.equal(recentApp([{ app: 'life-lab', t: 5 }, { app: 'shop', t: 9 }, { app: 'math-mastery', t: 7 }, { app: 'math-mastery' }], apps), 'math-mastery');
  assert.equal(recentApp('x', apps), null);
  assert.equal(recentApp([], apps), null);
});

test("only today's quests count", () => {
  const now = Date.UTC(2026, 9, 4, 4);
  assert.deepEqual(todayQuests({ day: dayKey(now), list: [{ kind: 'stars' }, null] }, now), [{ kind: 'stars' }]);
  assert.deepEqual(todayQuests({ day: '2026-10-01', list: [{ kind: 'stars' }] }, now), []);
  assert.deepEqual(todayQuests(null, now), []);
});

test('every Grade 2 guide line is Filipino · English, and the English is the Grade 5 line', () => {
  for (const [key, v] of Object.entries(TEXT.grade2)) {
    const g2 = typeof v === 'function' ? v('Life Lab', 2) : v;
    const g5 = typeof v === 'function' ? TEXT.grade5[key]('Life Lab', 2) : TEXT.grade5[key];
    if (key === 'go') { assert.equal(g2, g5, 'buttons stay English'); continue; }
    const cut = g2.lastIndexOf(' · ');
    assert.ok(cut > 0, key + ' has a Filipino line and an English line');
    assert.ok(g5.endsWith(g2.slice(cut + 3)), key + ': the English matches Grade 5');
  }
});

function memory(initial) {
  const data = Object.assign({}, initial);
  return { getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('Go links open the game at the right spot', () => {
  const sci = '../subjects/grade-5/science/index.html';
  assert.equal(link({ kind: 'boss', app: 'life-lab' }, CARDS), sci + '?boss=1');
  assert.equal(link({ kind: 'review', app: 'life-lab' }, CARDS), sci + '?review=1');
  assert.equal(link({ kind: 'lesson', app: 'life-lab', lesson: 'Ang Kuwento #1' }, CARDS), sci + '?lesson=Ang%20Kuwento%20%231');
  assert.equal(link({ kind: 'quest', app: 'life-lab', lesson: 'b' }, CARDS), sci + '?lesson=b');
  assert.equal(link({ kind: 'quest', app: 'life-lab', lesson: null }, CARDS), sci);
  assert.equal(link({ kind: 'visit', app: 'life-lab' }, CARDS), sci);
  assert.equal(link({ kind: 'boss', app: 'life-lab' }, [{ app: 'life-lab', href: 'x.html?a=1' }]), 'x.html?a=1&boss=1');
  assert.equal(link({ kind: 'done', app: null }, CARDS), null);
  assert.equal(link({ kind: 'visit', app: 'nowhere' }, CARDS), null);
  assert.equal(link(null, CARDS), null);
});

test('the bubble shows the buddy and the step, escaped, with Go when it leads somewhere', () => {
  assert.equal(bubble({ text: 'A <b> & "c"' }, '🦉', 'grade5', true),
    '<div class="g-guide" role="status"><span class="g-buddy" aria-hidden="true">🦉</span><p class="g-text">A &lt;b&gt; &amp; &quot;c&quot;</p><button type="button" class="g-go">Go ▶</button></div>');
  assert.ok(!bubble({ text: 'x' }, '🦉', 'grade2', false).includes('g-go'));
});

test('her buddy comes from world_v1, the cat by default', () => {
  assert.equal(avatarOf(memory({ world_v1: JSON.stringify({ v: 1, avatar: 'owl' }) })), '🦉');
  assert.equal(avatarOf(memory({ world_v1: JSON.stringify({ v: 1, avatar: 'toString' }) })), '🐱');
  assert.equal(avatarOf(memory({ world_v1: '{broken' })), '🐱');
  assert.equal(avatarOf(memory()), '🐱');
});
