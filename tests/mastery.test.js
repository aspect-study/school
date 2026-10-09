const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, read, counts, polishList, levelOf, MEDALS, MIN_BOX, COINS, TEXT } = require(engineFile('mastery.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const boxes = (map) => JSON.stringify({ v: 1, items: Object.fromEntries(Object.entries(map).map(([k, box]) => [k, { box, due: '2026-10-09', t: 1 }])) });
const saved = (s) => JSON.parse(s.data.mastery_v1);
const lesson = (id, keys) => ({ id, title: 'Lesson ' + id, icon: '🌱', keys });
const now = () => 1000;

test('the medal ladder', () => {
  assert.deepEqual(MEDALS, ['', '🥉', '🥈', '🥇']);
  assert.deepEqual(MIN_BOX, [0, 2, 3, 4]);
  assert.deepEqual(COINS, [0, 3, 5, 10]);
});

test('a lesson is as strong as its weakest question; unanswered and gone count as box 0', () => {
  assert.equal(levelOf({ a: { box: 5 }, b: { box: 4 } }, ['a', 'b']), 3);
  assert.equal(levelOf({ a: { box: 5 }, b: { box: 3 } }, ['a', 'b']), 2);
  assert.equal(levelOf({ a: { box: 2 }, b: { box: 5 } }, ['a', 'b']), 1);
  assert.equal(levelOf({ a: { box: 1 }, b: { box: 5 } }, ['a', 'b']), 0);
  assert.equal(levelOf({ a: { box: 5 } }, ['a', 'b']), 0, 'b never answered');
  assert.equal(levelOf({ a: { box: 5 }, b: { box: 5, gone: true } }, ['a', 'b']), 0, 'a tombstone is not an answer');
  assert.equal(levelOf({ a: { box: 9 } }, ['a']), 0, 'junk boxes count as nothing');
});

test('the first time a game reports, medals she already has show but pay nothing', () => {
  const s = memory({ review_v1: boxes({ a: 3, b: 3, c: 1 }) });
  const r = create(s, now, 'grade5').update('life-lab', [lesson('l1', ['a', 'b']), lesson('l2', ['c'])]);
  assert.equal(r.coins, 0);
  assert.deepEqual(r.newly, []);
  assert.deepEqual(r.lessons, { l1: { now: 2, best: 2, polish: false }, l2: { now: 0, best: 0, polish: false } });
  assert.deepEqual(r.counts, { gold: 0, silver: 1, bronze: 0, total: 2 });
  assert.deepEqual(saved(s).apps['life-lab'], { t: 1000, order: ['l1', 'l2'], lessons: {
    l1: { title: 'Lesson l1', icon: '🌱', now: 2, best: 2, paid: 2 },
    l2: { title: 'Lesson l2', icon: '🌱', now: 0, best: 0, paid: 0 },
  } });
});

test('a new medal pays once, the tiers between add up, and earning it back pays nothing', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) });
  const m = create(s, now, 'grade5'), lessons = [lesson('l1', ['a'])];
  m.update('life-lab', lessons);
  s.data.review_v1 = boxes({ a: 3 });
  const up = m.update('life-lab', lessons);
  assert.equal(up.coins, 8, 'nothing to Silver pays Bronze 3 + Silver 5');
  assert.deepEqual(up.newly, [{ id: 'l1', title: 'Lesson l1', level: 2, coins: 8, count: 1 }]);
  assert.equal(m.update('life-lab', lessons).coins, 0, 'paid once');
  s.data.review_v1 = boxes({ a: 1 });
  const slip = m.update('life-lab', lessons);
  assert.deepEqual(slip.lessons.l1, { now: 0, best: 2, polish: true }, 'the medal stays, with a polish mark');
  assert.equal(slip.coins, 0);
  assert.deepEqual(polishList(saved(s).apps['life-lab']), ['Lesson l1']);
  s.data.review_v1 = boxes({ a: 3 });
  assert.equal(m.update('life-lab', lessons).coins, 0, 'earning it back pays nothing');
  s.data.review_v1 = boxes({ a: 4 });
  const gold = m.update('life-lab', lessons);
  assert.equal(gold.coins, 10);
  assert.deepEqual(gold.counts, { gold: 1, silver: 0, bronze: 0, total: 1 });
});

test('a lesson added later starts paid; lessons with no questions are left out; each app keeps its own entry', () => {
  const s = memory({ review_v1: boxes({ a: 1, b: 2 }) });
  const m = create(s, now, 'grade5');
  m.update('life-lab', [lesson('l1', ['a'])]);
  const r = m.update('life-lab', [lesson('l1', ['a']), lesson('l2', ['b']), lesson('gen', [])]);
  assert.equal(r.coins, 0, 'l2 already had Bronze when it appeared');
  assert.deepEqual(saved(s).apps['life-lab'].order, ['l1', 'l2']);
  m.update('word-train', [lesson('w1', ['b'])]);
  assert.deepEqual(Object.keys(saved(s).apps).sort(), ['life-lab', 'word-train']);
  assert.deepEqual(read(s).apps['life-lab'].order, ['l1', 'l2'], 'the other app is untouched');
});

test('a Math skill is a lesson with one key', () => {
  const key = 'math-mastery|skill:frac';
  const s = memory({ review_v1: boxes({ [key]: 1 }) });
  const m = create(s, now, 'grade5'), lessons = [{ id: 'frac', title: 'Fractions', icon: '🍕', keys: [key] }];
  m.update('math-mastery', lessons);
  s.data.review_v1 = boxes({ [key]: 2 });
  assert.equal(m.update('math-mastery', lessons).coins, 3);
});

test('junk saved data reads as no medals', () => {
  assert.deepEqual(read(memory({ mastery_v1: '{nope' })), { v: 1, apps: {} });
  assert.deepEqual(read(memory({ mastery_v1: JSON.stringify({ v: 2, apps: {} }) })), { v: 1, apps: {} });
  assert.deepEqual(counts(undefined), { gold: 0, silver: 0, bronze: 0, total: 0 });
  assert.deepEqual(polishList(null), []);
  const s = memory({ review_v1: '{nope', mastery_v1: JSON.stringify({ v: 1, apps: { 'life-lab': { t: 1, lessons: { l1: 'x' } } } }) });
  const r = create(s, now, 'grade5').update('life-lab', [lesson('l1', ['a'])]);
  assert.deepEqual(r.lessons.l1, { now: 0, best: 0, polish: false });
});

test('create needs a known grade', () => {
  assert.throws(() => create(memory(), now, 'grade9'), /grade/);
});

test('grade 5 and grade 2 medal text', () => {
  const c = { gold: 2, silver: 3, bronze: 5, total: 18 };
  assert.equal(TEXT.grade5.chip(c), '🥇 2 · 🥈 3 · 🥉 5 of 18 lessons');
  assert.equal(TEXT.grade5.newLine({ level: 2, title: 'Plants', coins: 5 }), '🏅 New Silver: Plants! +5 coins');
  assert.equal(TEXT.grade5.newLine({ level: 1, title: 'Plants', coins: 0 }), '🏅 New Bronze: Plants!');
  assert.equal(TEXT.grade5.name(3), 'Gold');
  assert.equal(TEXT.grade2.chip(c), '🥇 2 · 🥈 3 · 🥉 5 sa 18 aralin · of 18 lessons');
  assert.equal(TEXT.grade2.newLine({ level: 1, title: 'Halaman', coins: 3 }), '🏅 Bagong Tanso · New Bronze: Halaman! +3 coins');
  assert.equal(TEXT.grade2.name(3), 'Ginto · Gold');
  assert.equal(TEXT.grade2.mapButton, TEXT.grade5.mapButton, 'buttons stay English');
});

test('when the save fails nothing is paid, so the same tiers are not paid again', () => {
  const s = memory({ review_v1: boxes({ a: 5 }), mastery_v1: JSON.stringify({ v: 1, apps: { g: { t: 1, order: ['l1'], lessons: { l1: { title: 'L', icon: '', now: 0, best: 0, paid: 0 } } } } }) });
  s.setItem = () => { throw new Error('full'); };
  const m = create(s, now, 'grade5');
  for (let i = 0; i < 2; i++) {
    const r = m.update('g', [lesson('l1', ['a'])]);
    assert.equal(r.coins, 0);
    assert.deepEqual(r.newly, []);
    assert.equal(r.lessons.l1.best, 3);
    assert.equal(r.counts.gold, 1);
  }
});

test('a lesson that drops out keeps its best and paid, so it never pays twice', () => {
  const s = memory({ review_v1: boxes({ a: 5, b: 3 }) });
  const m = create(s, now, 'grade5');
  m.update('g', [lesson('l1', ['a']), lesson('l2', ['b'])]);
  m.update('g', [lesson('l1', ['a'])]);
  const hidden = saved(s).apps.g;
  assert.deepEqual(hidden.order, ['l1']);
  assert.deepEqual({ best: hidden.lessons.l2.best, paid: hidden.lessons.l2.paid }, { best: 2, paid: 2 });
  assert.deepEqual(m.update('g', [lesson('l1', ['a'])]).counts, { gold: 1, silver: 0, bronze: 0, total: 1 });
  s.data.review_v1 = boxes({ a: 5, b: 2 });
  const back = m.update('g', [lesson('l1', ['a']), lesson('l2', ['b'])]);
  assert.equal(back.coins, 0);
  assert.deepEqual(back.lessons.l2, { now: 1, best: 2, polish: true });
  s.data.review_v1 = boxes({ a: 5, b: 4 });
  assert.equal(m.update('g', [lesson('l1', ['a']), lesson('l2', ['b'])]).coins, 10);
});

test('junk best and paid are clamped to 3 and never pay again', () => {
  const s = memory({ review_v1: boxes({ a: 5 }), mastery_v1: JSON.stringify({ v: 1, apps: { g: { t: 1, order: ['l1'], lessons: { l1: { title: 'L', icon: '', now: 0, best: 9, paid: 9 } } } } }) });
  const r = create(s, now, 'grade5').update('g', [lesson('l1', ['a'])]);
  assert.equal(r.coins, 0);
  assert.equal(saved(s).apps.g.lessons.l1.paid, 3);
  assert.equal(counts({ order: ['l1'], lessons: { l1: { best: 9, now: 0 } } }).gold, 1);
  assert.equal(counts({ order: ['l1'], lessons: { l1: { best: -2, now: 0 } } }).total, 1);
});

test('lesson ids like constructor work', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) });
  const m = create(s, now, 'grade5'), lessons = [lesson('constructor', ['a']), lesson('toString', ['a'])];
  m.update('g', lessons);
  s.data.review_v1 = boxes({ a: 3 });
  const r = m.update('g', lessons);
  assert.equal(r.coins, 16);
  assert.deepEqual(saved(s).apps.g.order, ['constructor', 'toString']);
});

test('a repeated id in the order counts once', () => {
  assert.deepEqual(counts({ order: ['a', 'a'], lessons: { a: { best: 1, now: 1 } } }), { gold: 0, silver: 0, bronze: 1, total: 1 });
});

test('an update that changes nothing does not write, so it queues no upload', () => {
  const s = memory({ review_v1: boxes({ a: 2 }) });
  let writes = 0, clock = 1000;
  const setItem = s.setItem;
  s.setItem = (k, v) => { if (k === 'mastery_v1') writes++; setItem(k, v); };
  const m = create(s, () => clock++, 'grade5');
  m.update('life-lab', [lesson('l1', ['a'])]);
  m.update('life-lab', [lesson('l1', ['a'])]);
  assert.equal(writes, 1);
  assert.equal(saved(s).apps['life-lab'].t, 1000, 'the first t stays');
  s.data.review_v1 = boxes({ a: 3 });
  m.update('life-lab', [lesson('l1', ['a'])]);
  assert.equal(writes, 2);
  assert.equal(saved(s).apps['life-lab'].lessons.l1.best, 2);
  assert.notEqual(saved(s).apps['life-lab'].t, 1000);
});

test('a new medal, a game-wide milestone and fixed mistakes become popup events, biggest first', () => {
  const s = memory({ review_v1: boxes({ a: 1, a2: 1, b: 2 }) });
  const m = create(s, now, 'grade5'), lessons = [lesson('l1', ['a', 'a2']), lesson('l2', ['b'])];
  assert.equal(m.update('life-lab', lessons).subjectUp, 0, 'the first report never celebrates');
  s.data.review_v1 = boxes({ a: 3, a2: 3, b: 2 });
  const r = m.update('life-lab', lessons);
  assert.equal(r.subjectUp, 1, 'every lesson now has Bronze or better');
  assert.equal(r.toNext, 1, 'one lesson is still below Silver');
  assert.deepEqual(m.events(r, 2, 'Life Lab'), [
    { big: true, icon: '🏆', title: 'All of Life Lab is Bronze!', line: 'Every lesson has 🥉 or better.', next: 'Next: all-Silver, 1 lesson to go', medal: 1 },
    { big: true, icon: '🥈', title: 'Silver: Lesson l1!', line: 'You got all 2 questions right on 2 different days.', next: '🥇 next: once more in about 7 days', medal: 2 },
    { big: false, icon: '🔧', title: 'You fixed 2 mistakes!', line: '2 questions you missed before are right now.', next: 'They come back in 3 days to check' },
  ]);
  assert.equal(m.update('life-lab', lessons).subjectUp, 0, 'it celebrates once');
  assert.deepEqual(m.events(m.update('life-lab', lessons), 0, 'Life Lab'), [], 'nothing new, no popup');
});

test('popup text for each medal, all-Gold and a single fix', () => {
  const T = create(memory(), now, 'grade5');
  const ev = (result, fixed) => T.events(Object.assign({ newly: [], subjectUp: 0, toNext: 0 }, result), fixed || 0, 'Life Lab');
  assert.deepEqual(ev({ newly: [{ id: 'x', title: 'Plants', level: 1, coins: 3, count: 1 }] }), [
    { big: false, icon: '🥉', title: 'Bronze: Plants!', line: 'You got every question right.', next: '🥈 next: get them right again in 3 days', medal: 1 }]);
  assert.deepEqual(ev({ newly: [{ id: 'x', title: 'Plants', level: 3, coins: 10, count: 3 }] }), [
    { big: true, icon: '🥇', title: 'Gold: Plants!', line: 'You got all 3 questions right on 3 different days.', next: 'It comes back in 2 weeks to stay strong', medal: 3 }]);
  assert.deepEqual(ev({ subjectUp: 3 })[0].next, 'Every lesson is Gold. Amazing!');
  assert.deepEqual(ev({}, 1), [
    { big: false, icon: '🔧', title: 'You fixed 1 mistake!', line: 'A question you missed before is right now.', next: 'It comes back in 3 days to check' }]);
  const g2 = create(memory(), now, 'grade2').events({ newly: [{ id: 'x', title: 'Halaman', level: 2, coins: 5, count: 4 }], subjectUp: 0, toNext: 0 }, 0, 'Kuwentista');
  assert.equal(g2[0].title, 'Pilak · Silver: Halaman!');
});

test('a failed save never celebrates a milestone twice', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) });
  const m = create(s, now, 'grade5'), lessons = [lesson('l1', ['a'])];
  m.update('life-lab', lessons);
  s.data.review_v1 = boxes({ a: 2 });
  const failing = { getItem: s.getItem, setItem: () => { throw new Error('full'); } };
  const r = create(failing, now, 'grade5').update('life-lab', lessons);
  assert.equal(r.subjectUp, 0);
  assert.deepEqual(r.newly, []);
});

test('removing the only weak lesson is not a game-wide milestone', () => {
  const s = memory({ review_v1: boxes({ a: 2 }) });
  const m = create(s, now, 'grade5');
  m.update('life-lab', [lesson('l1', ['a']), lesson('l2', ['b'])]);
  const r = m.update('life-lab', [lesson('l1', ['a'])]);
  assert.equal(r.subjectUp, 0);
});

test('a new medal pays its coins through the bonus dependency', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) }), paid = [];
  const m = create(s, now, 'grade5', { bonus: (c) => { paid.push(c); return true; } }), lessons = [lesson('l1', ['a'])];
  m.update('g', lessons);
  s.data.review_v1 = boxes({ a: 3 });
  const r = m.update('g', lessons);
  assert.deepEqual(paid, [8]);
  assert.equal(r.coins, 8);
  m.update('g', lessons);
  assert.deepEqual(paid, [8], 'paid once');
});

test('a refused bonus takes the mark back and stays quiet; the update that pays it celebrates once', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) });
  let ok = false;
  const m = create(s, now, 'grade5', { bonus: () => ok }), lessons = [lesson('l1', ['a'])];
  m.update('g', lessons);
  s.data.review_v1 = boxes({ a: 3 });
  const r = m.update('g', lessons);
  assert.equal(r.coins, 0);
  assert.deepEqual(r.newly, [], 'no popup while it cannot pay');
  assert.equal(r.lessons.l1.best, 2, 'the medal still shows on the lesson');
  assert.equal(saved(s).apps.g.lessons.l1.paid, 0, 'still unpaid');
  assert.deepEqual(m.update('g', lessons).newly, [], 'and no popup on the next round either');
  ok = true;
  const again = m.update('g', lessons);
  assert.equal(again.coins, 8);
  assert.deepEqual(again.newly.map((n) => [n.level, n.coins]), [[2, 8]], 'celebrated once, with its coins');
  assert.equal(saved(s).apps.g.lessons.l1.paid, 2);
  assert.deepEqual(m.update('g', lessons).newly, []);
});

test('a new medal is told to the family news, once', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) }), told = [];
  const m = create(s, now, 'grade5', { news: (kind, data) => told.push([kind, data]) });
  const lessons = [lesson('l1', ['a'])];
  m.update('life-lab', lessons);
  s.data.review_v1 = boxes({ a: 2 });
  m.update('life-lab', lessons);
  m.update('life-lab', lessons);
  assert.deepEqual(told, [['medal', { app: 'life-lab', tier: 1, title: 'Lesson l1' }]]);
});

test('a refused medal payment tells no news', () => {
  const s = memory({ review_v1: boxes({ a: 1 }) }), told = [];
  const m = create(s, now, 'grade5', { bonus: () => false, news: (kind) => told.push(kind) });
  m.update('life-lab', [lesson('l1', ['a'])]);
  s.data.review_v1 = boxes({ a: 2 });
  m.update('life-lab', [lesson('l1', ['a'])]);
  assert.deepEqual(told, []);
});
