process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { APPS, engineFile, appFile } = require('./paths.js');
const { create, matches, normalize, keyOf, REST_DAYS, TYPED_BONUS, BOX_DAYS, GAP_BONUS, REVIEW_SIZE, TEXT } = require(engineFile('recall.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function clock(y, m, d) {
  let t = new Date(y, m - 1, d, 10, 0).getTime();
  const now = () => t;
  now.days = (n) => { const x = new Date(t); x.setDate(x.getDate() + n); t = x.getTime(); };
  now.set = (ms) => { t = ms; };
  return now;
}

const items = (s) => JSON.parse(s.data.review_v1).items;

test('boxes, gap bonuses, round size and the typed bonus', () => {
  assert.equal(REST_DAYS, 3);
  assert.equal(TYPED_BONUS, 5);
  assert.deepEqual(BOX_DAYS, [0, 1, 3, 7, 14, 30]);
  assert.deepEqual(GAP_BONUS, [0, 2, 4, 6, 8, 10]);
  assert.equal(REVIEW_SIZE, 10);
});

test('the key covers the app, the stem, the picture and the answer, but not the mode', () => {
  assert.notEqual(keyOf('a', { q: 'How much?', art: '<svg 1>' }), keyOf('a', { q: 'How much?', art: '<svg 2>' }));
  assert.notEqual(keyOf('a', { q: 'Q', answer: 'x' }), keyOf('a', { q: 'Q', answer: 'y' }));
  assert.notEqual(keyOf('a', { q: 'Q' }), keyOf('b', { q: 'Q' }));
  assert.equal(keyOf('a', { q: 'Q', art: undefined, answer: undefined }), keyOf('a', { q: 'Q', art: '', answer: '' }));
  assert.match(keyOf('a', { q: 'Q' }), /^a\|[0-9a-f]+$/);
});

test('a new question right on her own pays normally and goes to box 2, due in 3 days', () => {
  const s = memory(), now = clock(2026, 10, 30);
  const r = create(s, now, 'grade5');
  assert.equal(r.begin([], 'k').resting, 0);
  assert.equal(r.points(false, 10, 5), 15);
  assert.deepEqual(items(s).k, { box: 2, due: '2026-11-02', t: now() });
  assert.equal(r.begin([], 'k').resting, 3, 'same day: resting 3 more days');
  assert.equal(r.points(false, 10, 5), 0, 'a resting question pays nothing');
  assert.equal(items(s).k.box, 2, 'and its box does not change');
});

test('a due question right on her own pays the gap bonus of its box and moves up', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  r.begin([], 'k'); r.points(false, 10, 0);
  const pays = [];
  for (const days of [3, 7, 14, 30, 30]) {
    now.days(days);
    assert.equal(r.begin([], 'k').resting, 0, 'due after ' + days + ' days');
    pays.push(r.points(false, 10, 0));
  }
  assert.deepEqual(pays, [14, 16, 18, 20, 20], 'box 2..5 bonuses, box 5 stays at 5');
  assert.equal(items(s).k.box, 5);
});

test('the gap counts calendar days, not hours', () => {
  const now = clock(2026, 10, 5);
  now.set(new Date(2026, 9, 5, 23, 59).getTime());
  const r = create(memory(), now, 'grade5');
  r.begin([], 'k'); r.points(false, 10, 0);
  now.set(new Date(2026, 9, 8, 0, 1).getTime());
  assert.equal(r.begin([], 'k').resting, 0);
});

test('a wrong answer sends a due or new question to box 1, due tomorrow', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  r.begin([], 'k'); r.missed();
  assert.deepEqual(items(s).k, { box: 1, due: '2026-10-02', t: now() });
  assert.equal(r.begin([], 'k').resting, 1, 'a same-day retry rests');
  assert.equal(r.points(false, 10, 0), 0, 'and pays nothing');
  now.days(1);
  r.begin([], 'k');
  assert.equal(r.points(false, 10, 0), 12, 'the next day it pays + the box 1 bonus');
  assert.equal(items(s).k.box, 2);
});

test('a wrong answer on a resting question changes nothing', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  r.begin([], 'k'); r.points(false, 10, 0);
  const before = s.data.review_v1;
  r.begin([], 'k'); r.missed();
  assert.equal(s.data.review_v1, before);
});

test('a helped right answer pays half and goes to box 1', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  assert.equal(r.points(true, 10, 5), 5);
  assert.equal(items(s).k.box, 1);
});

test('a typed right answer adds the bonus; a resting one pays nothing at all', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  r.markTyped();
  assert.equal(r.typed(), true);
  assert.equal(r.points(false, 20, 5), 20 + 5 + TYPED_BONUS);
  r.begin([], 'k');
  r.markTyped();
  assert.equal(r.points(false, 20, 5), 0);
  r.begin([], 'other');
  assert.equal(r.typed(), false, 'a new question starts untyped');
});

test('a question with review:false always pays normally and is never stored', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 1), 'grade5');
  r.begin([], 'n', { review: false });
  assert.equal(r.points(false, 10, 5), 15);
  r.begin([], 'n', { review: false });
  r.missed();
  assert.equal(r.points(false, 10, 5), 15);
  assert.equal(s.data.review_v1, undefined);
});

test('the results line counts resting answers and moves in this quiz only', () => {
  const now = clock(2026, 10, 1);
  const r = create(memory(), now, 'grade5');
  const q1 = [];
  r.begin(q1, 'a'); r.points(false, 10, 0);
  r.begin(q1, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), '', 'new questions are not moves');
  const q2 = [];
  r.begin(q2, 'a'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), TEXT.grade5.resultLine(1));
  now.days(3);
  const q3 = [];
  r.begin(q3, 'a'); r.points(false, 10, 0);
  r.begin(q3, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), TEXT.grade5.movedLine(2, 8));
  r.begin([], 'a');
  assert.equal(r.resultLine(), '', 'a new quiz starts the count again');
});

test('the 3-day rest dates become box 2 items, due when the rest ends, once', () => {
  const s = memory({ recall_v1: JSON.stringify({ v: 1, rest: {
    'life-lab|lesson|1a2b': '2026-10-01', 'life-lab|exam|1a2b': '2026-09-30', 'page-turners|lesson|ff': '2026-09-29', junk: 5, 'bad|lesson|zz': 'yesterday',
  } }) });
  create(s, clock(2026, 10, 2), 'grade5');
  const got = items(s);
  assert.deepEqual(Object.keys(got).sort(), ['life-lab|1a2b', 'page-turners|ff']);
  assert.equal(got['life-lab|1a2b'].due, '2026-10-04', 'the later rest wins');
  assert.equal(got['life-lab|1a2b'].box, 2);
  assert.equal(got['page-turners|ff'].due, '2026-10-02');
  assert.ok(s.data.recall_v1, 'the old key is kept as a safety net');
  s.data.review_v1 = JSON.stringify({ v: 1, items: {} });
  create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(items(s), {}, 'it runs only while review_v1 does not exist');
});

test('nothing is written when there is nothing to migrate, and bad data is ignored', () => {
  const s = memory();
  create(s, clock(2026, 10, 2), 'grade5');
  assert.equal(s.data.review_v1, undefined);
  const r = create(memory({ review_v1: '{nope' }), clock(2026, 10, 2), 'grade5');
  assert.equal(r.begin([], 'k').resting, 0);
  const bad = memory({ review_v1: JSON.stringify({ v: 1, items: { k: { box: 9, due: 'x', t: 1 } } }) });
  assert.equal(create(bad, clock(2026, 10, 2), 'grade5').begin([], 'k').resting, 0, 'a broken item counts as new');
});

test('boxes live in the learner space given, and an unknown grade is refused', () => {
  const now = clock(2026, 10, 1);
  const mine = memory(), sister = memory();
  const g5 = create(mine, now, 'grade5');
  g5.begin([], 'k');
  g5.points(false, 10, 0);
  assert.ok(mine.data.review_v1, 'saved as review_v1 in her own space');
  assert.equal(create(sister, now, 'grade5').begin([], 'k').resting, 0, 'another learner has her own boxes');
  assert.throws(() => create(mine, now, 'grade9'));
  assert.throws(() => create(mine, now, null));
});

test('normalize drops case, accents, punctuation and extra spaces', () => {
  assert.equal(normalize('  Ñino,  BATHALA! '), 'nino bathala');
  assert.equal(normalize('Apo-Kabunian'), 'apo kabunian');
  assert.equal(normalize(null), '');
});

test('matches the answer or an accepted alternative', () => {
  assert.equal(matches('bathala', 'Bathala', []), true);
  assert.equal(matches('Insomnia.', 'INSOMNIA', []), true);
  assert.equal(matches('sun', 'the Sun', ['sun']), true);
  assert.equal(matches('moon', 'Sun', []), false);
});

test('one typo is forgiven only when the answer has 5 or more letters', () => {
  assert.equal(matches('insomia', 'insomnia', []), true, 'one letter missing');
  assert.equal(matches('insomniaa', 'insomnia', []), true, 'one letter extra');
  assert.equal(matches('insomnoa', 'insomnia', []), true, 'one letter changed');
  assert.equal(matches('insomnai', 'insomnia', []), false, 'two letters swapped is two edits');
  assert.equal(matches('rots', 'root', []), false, 'short answers must be exact');
});

test('typing a wrong choice, or one edit from it, is never accepted', () => {
  assert.equal(matches('those', 'These', [], ['Those']), false);
  assert.equal(matches('these', 'These', [], ['Those']), true);
  assert.equal(matches('thse', 'These', [], ['Those']), false, 'one edit from both');
  assert.equal(matches('masaya ng bata', 'masayang bata', [], ['masaya ng bata']), false);
  assert.equal(matches('masayang bata', 'masayang bata', [], ['masaya ng bata']), true);
  assert.equal(matches('insomia', 'insomnia', [], ['phobia']), true);
});

test('numbers must match exactly', () => {
  assert.equal(matches('125', '125', []), true);
  assert.equal(matches('126', '125', []), false);
  assert.equal(matches('12345', '12346', []), false);
});

test('an empty answer never matches', () => {
  assert.equal(matches('', 'Sun', []), false);
  assert.equal(matches('  !! ', 'Sun', []), false);
});

test('points with no question started fall back to the normal rule', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  assert.equal(r.points(false, 10, 5), 15);
  assert.equal(r.points(true, 10, 5), 5);
});

test('a cleared question falls back to the normal rule and rests nothing', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  r.clear();
  assert.equal(r.points(false, 10, 5), 15);
  assert.equal(r.begin([], 'k').resting, 0);
});

test('storage that throws never breaks the game', () => {
  const s = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const r = create(s, clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  assert.equal(r.points(false, 10, 0), 10);
});

test('Grade 2 text pairs Filipino with English; buttons are English only', () => {
  const t = TEXT.grade2;
  const lines = [t.resting(2), t.resultLine(3), t.typePrompt, t.typePromptResting, t.notQuite, t.typedRight, t.movedLine(2, 8),
    t.lobbyTitle, t.caughtUp(null), t.caughtUp({ days: 1, count: 5 }), t.cardTitle, t.cardDue(3, 3), t.cardDue(10, 23), t.cardNext(2), t.cardNext(0), t.reviewTitle];
  for (const line of lines) assert.match(line, / · /, line);
  assert.equal(t.cardNext(2), 'Susunod: sa 2 araw · Next: in 2 days');
  assert.equal(t.check, 'Check');
  assert.equal(t.show, 'Show choices');
  assert.deepEqual(Object.keys(TEXT.grade2).sort(), Object.keys(TEXT.grade5).sort());
  assert.equal(TEXT.grade5.resting(1), '⏳ Resting: points again in 1 day');
  assert.equal(t.resting(2), '⏳ Pahinga muna: may points ulit pagkalipas ng 2 araw · Resting: points again in 2 days');
});

test('Grade 5 review text', () => {
  const t = TEXT.grade5;
  assert.equal(t.cardDue(4, 4), '4 due');
  assert.equal(t.cardDue(10, 23), '10 of 23 due');
  assert.equal(t.cardNext(1), 'Next: tomorrow');
  assert.equal(t.cardNext(5), 'Next: in 5 days');
  assert.equal(t.cardNext(0), 'Answer some questions first');
  assert.equal(t.caughtUp({ days: 1, count: 5 }), '🎉 All caught up! Next review: tomorrow (5)');
  assert.equal(t.caughtUp(null), '🎉 All caught up!');
});

test('homeCard says how many are due, or when the next ones are', () => {
  const s = memory({ review_v1: JSON.stringify({ v: 1, items: {
    'a|1': { box: 1, due: '2026-10-01', t: 1 }, 'b|1': { box: 2, due: '2026-10-04', t: 1 },
  } }) });
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.homeCard('a'), { ready: true, title: '🔁 Review', line: '1 due' });
  assert.deepEqual(r.homeCard('b'), { ready: false, title: '🔁 Review', line: 'Next: in 2 days' });
});

const info = (q) => ({ q: q.q, answer: q.a, historyQ: q.q, historyAnswer: q.a });
const pool = (n) => Array.from({ length: n }, (_, i) => ({ q: 'Q' + i, a: 'A' + i }));
function setItem(s, app, q, box, due, t = 1) {
  const d = s.data.review_v1 ? JSON.parse(s.data.review_v1) : { v: 1, items: {} };
  d.items[keyOf(app, info(q))] = { box, due, t };
  s.data.review_v1 = JSON.stringify(d);
}

test('pickDue returns only due questions that have a box, most overdue first, then lowest box', () => {
  const s = memory(), p = pool(6);
  setItem(s, 'a', p[0], 3, '2026-10-05');
  setItem(s, 'a', p[1], 2, '2026-09-28');
  setItem(s, 'a', p[2], 1, '2026-10-01');
  setItem(s, 'a', p[3], 4, '2026-10-01');
  setItem(s, 'b', p[4], 1, '2026-09-01');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.pickDue('a', p, info).map((q) => q.q), ['Q1', 'Q2', 'Q3']);
});

test('pickDue takes at most the round size, and counts every due one', () => {
  const s = memory(), p = pool(14);
  p.forEach((q) => setItem(s, 'a', q, 1, '2026-10-01'));
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.equal(r.pickDue('a', p, info).length, 10);
  assert.equal(r.pickDue('a', p, info, 3).length, 3);
  assert.equal(r.dueCount('a'), 14);
  assert.deepEqual(r.dueByApp(), { a: 14 });
});

test('tidy with no questions keeps every box', () => {
  const s = memory(), p = pool(2);
  setItem(s, 'a', p[0], 2, '2026-10-01');
  const before = s.data.review_v1;
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', [], info, []);
  assert.equal(s.data.review_v1, before);
});

test('tidy keeps boxes it cannot match when some lessons did not load', () => {
  const s = memory(), p = pool(4);
  setItem(s, 'a', p[3], 2, '2026-10-01');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  r.tidy('a', p.slice(0, 2), info, [], true);
  assert.ok(items(s)[keyOf('a', info(p[3]))], 'kept');
  r.tidy('a', p.slice(0, 2), info, []);
  assert.equal(items(s)[keyOf('a', info(p[3]))].gone, true, 'pruned when everything loaded');
});

test('tidy seeds a wrong answer exactly 14 days old, but not 15', () => {
  const s = memory(), p = pool(2), now = clock(2026, 10, 20);
  const day = (d) => new Date(2026, 9, d, 9).getTime();
  const wrong = (q, a) => [{ q, picked: 'x', answer: a }];
  create(s, now, 'grade5').tidy('a', p, info, [
    { type: 'quiz', app: 'a', t: day(6), wrong: wrong('Q0', 'A0') },
    { type: 'quiz', app: 'a', t: day(5), wrong: wrong('Q1', 'A1') },
  ]);
  const got = items(s);
  assert.ok(got[keyOf('a', info(p[0]))], '14 days old is seeded');
  assert.equal(got[keyOf('a', info(p[1]))], undefined, '15 days old is not');
});

test('tidy ignores history entries without a time', () => {
  const s = memory(), p = pool(1);
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', p, info, [{ type: 'quiz', app: 'a', wrong: [{ q: 'Q0', answer: 'A0' }] }]);
  assert.equal(s.data.review_v1, undefined);
});

test('pickDue returns a question that appears twice in the pool only once', () => {
  const s = memory(), p = pool(2);
  setItem(s, 'a', p[0], 1, '2026-10-01');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.pickDue('a', [p[0], p[0], p[1]], info).map((q) => q.q), ['Q0']);
});

test('nextDue says when the next questions come due, and how many', () => {
  const s = memory(), p = pool(4);
  setItem(s, 'a', p[0], 2, '2026-10-04');
  setItem(s, 'a', p[1], 2, '2026-10-04');
  setItem(s, 'a', p[2], 3, '2026-10-09');
  setItem(s, 'b', p[3], 1, '2026-10-03');
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.nextDue('a'), { days: 2, count: 2 });
  assert.deepEqual(r.nextDue(), { days: 1, count: 1 });
  assert.equal(r.nextDue('c'), null);
});

test('tidy puts her wrong answers from the last 14 days in box 1, due today', () => {
  const s = memory(), p = pool(4), now = clock(2026, 10, 20);
  const day = (d) => new Date(2026, 9, d, 9).getTime();
  const entries = [
    { type: 'quiz', app: 'a', t: day(19), wrong: [{ q: 'Q0', picked: 'x', answer: 'A0' }, { q: 'Q9', picked: 'x', answer: 'A9' }] },
    { type: 'quiz', app: 'a', t: day(1), wrong: [{ q: 'Q1', picked: 'x', answer: 'A1' }] },
    { type: 'quiz', app: 'b', t: day(19), wrong: [{ q: 'Q2', picked: 'x', answer: 'A2' }] },
    { type: 'open', app: 'a', t: day(19) },
  ];
  setItem(s, 'a', p[3], 4, '2026-11-01');
  const r = create(s, now, 'grade5');
  r.tidy('a', p, info, entries);
  const got = items(s);
  assert.deepEqual(got[keyOf('a', info(p[0]))], { box: 1, due: '2026-10-20', t: day(19) });
  assert.equal(got[keyOf('a', info(p[1]))], undefined, 'older than 14 days');
  assert.equal(got[keyOf('a', info(p[2]))], undefined, 'another app');
  assert.equal(got[keyOf('a', info(p[3]))].box, 4, 'a question that has a box keeps it');
});

test('tidy matches history text through the plain function it was given', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 2), 'grade5', (x) => String(x).replace(/<[^>]+>/g, ''));
  const q = { q: '<b>Q</b>', a: '<i>A</i>' };
  r.tidy('a', [q], info, [{ type: 'quiz', app: 'a', t: new Date(2026, 9, 2, 9).getTime(), wrong: [{ q: 'Q', answer: 'A' }] }]);
  assert.ok(items(s)[keyOf('a', info(q))]);
});

test('tidy drops boxes for questions no longer in that game, but keeps other apps and skills', () => {
  const s = memory(), p = pool(2);
  setItem(s, 'a', p[0], 2, '2026-10-01');
  setItem(s, 'a', { q: 'gone', a: 'x' }, 2, '2026-10-01');
  setItem(s, 'b', { q: 'gone', a: 'x' }, 2, '2026-10-01');
  const d = JSON.parse(s.data.review_v1); d.items['a|skill:frac'] = { box: 1, due: '2026-10-01', t: 1 }; s.data.review_v1 = JSON.stringify(d);
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', p, info, []);
  const live = Object.keys(items(s)).filter((k) => !items(s)[k].gone);
  assert.deepEqual(live.sort(), [keyOf('a', info(p[0])), 'a|skill:frac', keyOf('b', { q: 'gone', answer: 'x' })].sort());
  assert.equal(items(s)[keyOf('a', { q: 'gone', answer: 'x' })].gone, true);
});

test('tidy writes nothing when nothing changes', () => {
  const s = memory();
  create(s, clock(2026, 10, 2), 'grade5').tidy('a', pool(2), info, []);
  assert.equal(s.data.review_v1, undefined);
});

test('a skill moves up after 2 of 3 right, and back to box 1 otherwise', () => {
  const s = memory(), now = clock(2026, 10, 1);
  const r = create(s, now, 'grade5');
  assert.equal(r.gradeSkill('m', 'frac', 2, 3), 0, 'a new skill goes to box 2 but is not a move');
  assert.equal(items(s)['m|skill:frac'].box, 2);
  assert.equal(r.gradeSkill('m', 'frac', 3, 3), 0, 'not due yet: unchanged');
  assert.equal(items(s)['m|skill:frac'].box, 2);
  now.days(3);
  assert.equal(r.skillBonus('m', 'frac'), 4, 'box 2 gap bonus while due');
  assert.equal(r.gradeSkill('m', 'frac', 6, 9), 1, '2 of 3 or better moves up');
  assert.equal(items(s)['m|skill:frac'].box, 3);
  assert.equal(r.skillBonus('m', 'frac'), 0, 'no bonus once it is resting');
  now.days(7);
  assert.equal(r.gradeSkill('m', 'frac', 1, 3), 0);
  assert.equal(items(s)['m|skill:frac'].box, 1);
});

test('a brand-new skill that fails goes to box 1', () => {
  const s = memory();
  create(s, clock(2026, 10, 1), 'grade5').gradeSkill('m', 'frac', 1, 3);
  assert.equal(items(s)['m|skill:frac'].box, 1);
});

test('a skill needs at least 3 problems in the round to be graded', () => {
  const s = memory();
  const r = create(s, clock(2026, 10, 1), 'grade5');
  assert.equal(r.gradeSkill('m', 'frac', 2, 2), 0);
  assert.equal(s.data.review_v1, undefined);
});

test('skillsDue lists due skills, most overdue first, up to the limit', () => {
  const s = memory({ review_v1: JSON.stringify({ v: 1, items: {
    'm|skill:a': { box: 2, due: '2026-10-01', t: 1 }, 'm|skill:b': { box: 1, due: '2026-09-20', t: 1 },
    'm|skill:c': { box: 3, due: '2026-10-09', t: 1 }, 'm|skill:d': { box: 1, due: '2026-10-02', t: 1 },
  } }) });
  const r = create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(r.skillsDue('m', ['a', 'b', 'c', 'd', 'e']), ['b', 'a', 'd']);
  assert.deepEqual(r.skillsDue('m', ['a', 'b', 'c', 'd'], 2), ['b', 'a']);
});

test('a skill started in review is not due again today, but the round in progress keeps its bonus', () => {
  const s = memory({ review_v1: JSON.stringify({ v: 1, items: {
    'm|skill:a': { box: 2, due: '2026-10-01', t: 1 }, 'm|skill:b': { box: 1, due: '2026-10-01', t: 1 },
  } }) });
  const now = clock(2026, 10, 2), r = create(s, now, 'grade5');
  r.startSkills('m', r.skillsDue('m', ['a', 'b']));
  assert.equal(items(s)['m|skill:a'].started, '2026-10-02');
  assert.deepEqual(r.skillsDue('m', ['a', 'b']), [], 'leaving early cannot replay it today');
  assert.equal(r.skillBonus('m', 'a'), 4, 'bonus still paid in the started round');
  r.gradeSkill('m', 'b', 3, 3);
  assert.equal('started' in items(s)['m|skill:b'], false, 'grading clears started');
  now.days(1);
  assert.deepEqual(r.skillsDue('m', ['a', 'b']), ['a'], 'left early: due again tomorrow');
});

test('startSkills keeps the old time, and a started skill counts as next due tomorrow', () => {
  const s = memory({ review_v1: JSON.stringify({ v: 1, items: { 'm|skill:a': { box: 2, due: '2026-10-01', t: 7 } } }) });
  const r = create(s, clock(2026, 10, 2), 'grade5');
  r.startSkills('m', ['a']);
  assert.equal(items(s)['m|skill:a'].t, 7);
  assert.deepEqual(r.dueByApp(), {});
  assert.deepEqual(r.nextDue('m'), { days: 1, count: 1 });
});

test('startSkills ignores skills without a box', () => {
  const s = memory();
  create(s, clock(2026, 10, 2), 'grade5').startSkills('m', ['x']);
  assert.equal(s.data.review_v1, undefined);
});

test('tidy leaves a tombstone that every reader treats as absent', () => {
  const s = memory(), p = pool(2), now = clock(2026, 10, 2);
  setItem(s, 'a', p[0], 1, '2026-10-01');
  setItem(s, 'a', p[1], 3, '2026-10-05');
  const r = create(s, now, 'grade5');
  r.tidy('a', [p[0]], info, []);
  const k = keyOf('a', info(p[1]));
  assert.deepEqual(items(s)[k], { box: 3, due: '2026-10-05', t: now(), gone: true });
  assert.equal(r.dueCount('a'), 1);
  assert.deepEqual(r.pickDue('a', p, info).map((q) => q.q), ['Q0']);
  assert.equal(r.nextDue('a'), null);
  assert.equal(r.begin({}, k).item, null, 'counts as new');
  const before = s.data.review_v1;
  now.set(now() + 1000);
  r.tidy('a', [p[0]], info, []);
  assert.equal(s.data.review_v1, before, 'a tombstone is not pruned again');
});

test('tidy can seed a tombstoned question that is back in the pool', () => {
  const s = memory(), p = pool(1), now = clock(2026, 10, 2);
  const k = keyOf('a', info(p[0]));
  s.data.review_v1 = JSON.stringify({ v: 1, items: { [k]: { box: 3, due: '2026-10-01', t: 1, gone: true } } });
  create(s, now, 'grade5').tidy('a', p, info, [{ type: 'quiz', app: 'a', t: now(), wrong: [{ q: 'Q0', answer: 'A0' }] }]);
  assert.equal(items(s)[k].box, 1);
  assert.equal('gone' in items(s)[k], false);
});

test('the moved line leaves out a zero review bonus', () => {
  assert.equal(TEXT.grade5.movedLine(1, 0), ' · 📦 1 question moved up a box');
  assert.equal(TEXT.grade2.movedLine(2, 0), ' · 📦 2 tanong ang umakyat ng box · 2 questions moved up a box');
  assert.match(TEXT.grade5.movedLine(2, 8), / \(\+8 review bonus\)$/);
  assert.match(TEXT.grade2.movedLine(2, 8), / \(\+8 review bonus\)$/);
});

test('homeCard takes an optional round size', () => {
  const its = {};
  for (let i = 0; i < 5; i++) its['m|skill:' + i] = { box: 1, due: '2026-10-01', t: 1 };
  const r = create(memory({ review_v1: JSON.stringify({ v: 1, items: its }) }), clock(2026, 10, 2), 'grade5');
  assert.equal(r.homeCard('m', 3).line, '3 of 5 due');
  assert.equal(r.homeCard('m').line, '5 due');
});

const fs = require('node:fs');
// Math Mastery has its own exam scoring and never rests questions; it is checked below.
const games = APPS.filter((app) => app.id !== 'math-mastery').map((app) => ({
  a: app.id, file: appFile(app.id), tag: '<script src="../../../engine/recall.js" data-grade="grade' + app.grade + '"></script>', pu: '../../../engine/powerups.js',
}));
const count = (html, s) => html.split(s).length - 1;

for (const g of games) {
  test(g.a + ' routes every question and every point through Recall', () => {
    const html = fs.readFileSync(g.file, 'utf8');
    assert.ok(html.indexOf(g.tag) > html.indexOf('<script src="' + g.pu + '"'), 'recall tag after the power-ups tag');
    assert.equal(count(html, 'PowerUps.offer('), 1, 'only offerQuestion calls PowerUps.offer');
    assert.ok(count(html, 'offerQuestion({') >= 1, 'questions are offered through offerQuestion');
    // The study kit asks Recall what every right answer pays (tests/study-kit.test.js).
    assert.ok(html.indexOf('<script src="../../../engine/study-kit.js"') > html.indexOf(g.tag), 'study-kit tag after the recall tag');
    assert.equal(count(html, 'Recall.points('), 0, 'no points paid outside the study kit');
    assert.equal(count(html, ', window.Recall ? Recall.typed() : false);'), count(html, 'SH.quizAnswered('), 'history hears about typed answers');
    assert.equal(count(html, 'Recall.resultLine()'), 0, 'resting questions are shown through kit.resultLine()');
    assert.equal(count(html, 'kit.resultLine()'), 1, 'the results screen shows resting questions');
    assert.match(html, /(const|var) TYPE_IT = StudyKit\.content\('typeIt'\);/);
  });
}

test('Math Mastery pays double in the mock exam, never rests questions, and reviews by skill', () => {
  const html = fs.readFileSync(appFile('math-mastery'), 'utf8');
  assert.equal(count(html, "kit.answer(correct, { helped: helped, exam: currentQuizMeta.id === 'final', extra: extra });"), 1);
  assert.equal(count(html, 'kit.answer(ok, { shield: false });'), 5, 'walkthrough and case-study steps never spend a Streak Shield');
  const tag = '<script src="../../../engine/recall.js" data-grade="grade5"></script>';
  assert.equal(count(html, tag), 1, 'recall.js loaded for skill boxes');
  assert.ok(html.indexOf(tag) < html.indexOf('<script src="../../../engine/study-kit.js"'));
  assert.equal(count(html, 'Recall.ask('), 0, 'questions never rest');
  assert.equal(count(html, 'offerQuestion('), 0);
});
