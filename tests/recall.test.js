process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { APPS, engineFile, appFile } = require('./paths.js');
const { create, matches, normalize, questionKey, REST_DAYS, TYPED_BONUS, TEXT } = require(engineFile('recall.js'));

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

test('the rest lasts 3 days and the typed bonus is 5', () => {
  assert.equal(REST_DAYS, 3);
  assert.equal(TYPED_BONUS, 5);
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

test('the key covers the app, the mode, the stem and the picture', () => {
  assert.notEqual(questionKey('a', false, 'How much?', '<svg 1>'), questionKey('a', false, 'How much?', '<svg 2>'));
  assert.notEqual(questionKey('a', false, 'Q', ''), questionKey('a', true, 'Q', ''));
  assert.notEqual(questionKey('a', false, 'Q', ''), questionKey('b', false, 'Q', ''));
  assert.equal(questionKey('a', false, 'Q', undefined), questionKey('a', false, 'Q', ''));
});

test('an unhelped right answer pays, then rests until 3 calendar days later', () => {
  const now = clock(2026, 10, 30);
  const r = create(memory(), now, 'grade5');
  const quiz = [];
  assert.equal(r.begin(quiz, 'k').resting, 0);
  assert.equal(r.points(false, 10, 5), 15);
  assert.equal(r.begin(quiz, 'k').resting, 3, 'same day');
  assert.equal(r.points(false, 10, 5), 0, 'a resting question pays nothing');
  now.days(2);
  assert.equal(r.begin(quiz, 'k').resting, 1, 'Nov 1, across the month end');
  now.days(1);
  assert.equal(r.begin(quiz, 'k').resting, 0, 'Nov 2 = paid day + 3');
  assert.equal(r.points(false, 10, 0), 10);
});

test('the rest counts calendar days, not hours', () => {
  const now = clock(2026, 10, 5);
  now.set(new Date(2026, 9, 5, 23, 59).getTime());
  const r = create(memory(), now, 'grade5');
  r.begin([], 'k');
  r.points(false, 10, 0);
  now.set(new Date(2026, 9, 8, 0, 1).getTime());
  assert.equal(r.begin([], 'k').resting, 0);
});

test('a helped right answer pays half and does not start the rest', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  assert.equal(r.points(true, 10, 5), 5);
  assert.equal(r.begin([], 'k').resting, 0);
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

test('lesson and exam rest separately', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  r.begin([], questionKey('a', false, 'Q', ''));
  r.points(false, 10, 0);
  assert.equal(r.begin([], questionKey('a', true, 'Q', '')).resting, 0);
});

test('the results line counts resting answers in this quiz only', () => {
  const r = create(memory(), clock(2026, 10, 1), 'grade5');
  const q1 = [];
  r.begin(q1, 'a'); r.points(false, 10, 0);
  r.begin(q1, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), '');
  const q2 = [];
  r.begin(q2, 'a'); r.points(false, 10, 0);
  r.begin(q2, 'b'); r.points(false, 10, 0);
  assert.equal(r.resultLine(), TEXT.grade5.resultLine(2));
  r.begin([], 'a');
  assert.equal(r.resultLine(), '', 'a new quiz starts the count again');
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

test('old rest dates are pruned and bad data is ignored', () => {
  const s = memory({ grade5_recall_v1: JSON.stringify({ v: 1, rest: { old: '2026-09-01', fresh: '2026-10-01', junk: 5, bad: 'yesterday' } }) });
  create(s, clock(2026, 10, 2), 'grade5');
  assert.deepEqual(JSON.parse(s.data.grade5_recall_v1).rest, { fresh: '2026-10-01' });
  const r = create(memory({ grade5_recall_v1: '{nope' }), clock(2026, 10, 2), 'grade5');
  assert.equal(r.begin([], 'k').resting, 0);
});

test('each grade has its own store and an unknown grade is refused', () => {
  const s = memory();
  const now = clock(2026, 10, 1);
  const g5 = create(s, now, 'grade5');
  g5.begin([], 'k');
  g5.points(false, 10, 0);
  assert.equal(create(s, now, 'grade2').begin([], 'k').resting, 0);
  assert.throws(() => create(s, now, 'grade9'));
  assert.throws(() => create(s, now, null));
});

test('storage that throws never breaks the game', () => {
  const s = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const r = create(s, clock(2026, 10, 1), 'grade5');
  r.begin([], 'k');
  assert.equal(r.points(false, 10, 0), 10);
});

test('Grade 2 text pairs Filipino with English; buttons are English only', () => {
  const t = TEXT.grade2;
  for (const line of [t.resting(2), t.resultLine(3), t.typePrompt, t.typePromptResting, t.notQuite, t.typedRight]) assert.match(line, / · /, line);
  assert.equal(t.check, 'Check');
  assert.equal(t.show, 'Show choices');
  assert.deepEqual(Object.keys(TEXT.grade2).sort(), Object.keys(TEXT.grade5).sort());
  assert.equal(TEXT.grade5.resting(1), '⏳ Resting: points again in 1 day');
  assert.equal(t.resting(2), '⏳ Pahinga muna: may points ulit pagkalipas ng 2 araw · Resting: points again in 2 days');
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
    assert.match(html, /EXAM_POINTS_PER_CORRECT = 20/);
    assert.equal(count(html, 'Recall.points(helped, ptsBase, ptsBonus)'), count(html, 'streak++;'), 'every right answer is scored by Recall');
    assert.equal(count(html, ', window.Recall ? Recall.typed() : false);'), count(html, 'SH.quizAnswered('), 'history hears about typed answers');
    assert.equal(count(html, 'Recall.resultLine()'), 1, 'the results screen shows resting questions');
    assert.match(html, /(const|var) TYPE_IT = \{/);
  });
}

test('Math Mastery pays double in the mock exam but never rests questions', () => {
  const html = fs.readFileSync(appFile('math-mastery'), 'utf8');
  assert.match(html, /EXAM_POINTS_PER_CORRECT = 20/);
  assert.match(html, /function awardPoint\(correct, helped, shielded, exam\)/);
  assert.match(html, /awardPoint\(correct, helped, [^\n]*, currentQuizMeta\.id === 'final'\);/);
  assert.equal(count(html, 'recall.js'), 0);
});
