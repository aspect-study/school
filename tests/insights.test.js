const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { build, lessonRows, status, practiceKeys, practicePending, markDue, weekStart, weekly, addSend } = require(engineFile('insights.js'));

const SUBJECTS = [{ app: 'page-turners', title: 'English' }, { app: 'math-mastery', title: 'Math' }, { app: 'life-lab', title: 'Science' }];
let n = 0;
function quiz(app, lessonTitle, answered, correct, wrong, extra) {
  n++;
  return Object.assign({ id: 'q' + n, type: 'quiz', app, appTitle: app, lessonTitle, answered, correct, total: answered,
    wrong: wrong || [], t: 1000 * n, updatedAt: 1000 * n + 500 }, extra);
}
const miss = (q, picked, answer, more) => Object.assign({ q, picked, answer }, more);

test('status: fixed after a right answer since the miss, missing until then, blank when nothing says', () => {
  const items = {
    k2: { box: 2, due: '2026-10-08', t: 500 },
    k1: { box: 1, due: '2026-10-06', t: 500 },
    kGone: { box: 3, due: '2026-10-08', t: 500, gone: true },
  };
  assert.equal(status('k2', 400, items), 'fixed');
  assert.equal(status('k2', 600, items), 'missing', 'graded before the miss: the box does not know about it');
  assert.equal(status('k1', 400, items), 'missing');
  assert.equal(status('kGone', 400, items), '');
  assert.equal(status('nope', 400, items), '');
  assert.equal(status('', 400, items), '');
  assert.equal(status('k2', 400, null), '');
});

test('build ranks subjects by questions to fix, then % right, and lists every subject', () => {
  const r = build([
    quiz('page-turners', 'Nouns', 10, 8, [miss('Pick the noun', 'run', 'cat'), miss('Pick the verb', 'cat', 'run')]),
    quiz('math-mastery', 'Rounding', 10, 5, [miss('Round 4.67', '4.6', '4.7')]),
    { id: 'o', type: 'open', app: 'life-lab', appTitle: 'Life Lab', t: 1 },
  ], { subjects: SUBJECTS, items: {} });
  assert.deepEqual(r.subjects.map((s) => [s.title, s.answered, s.correct, s.pct, s.toFix, s.fixed, s.quizzes]), [
    ['English', 10, 8, 80, 2, 0, 1],
    ['Math', 10, 5, 50, 1, 0, 1],
    ['Science', 0, 0, null, 0, 0, 0],
  ]);
  assert.deepEqual([r.answered, r.correct, r.pct, r.toFix, r.fixed], [20, 13, 65, 3, 0]);
});

test('equal questions to fix rank the lower % right first; an app not in the list still shows', () => {
  const r = build([
    quiz('page-turners', 'Nouns', 10, 9, [miss('A', 'x', 'y')]),
    quiz('math-mastery', 'Rounding', 10, 6, [miss('B', 'x', 'y')]),
    quiz('old-app', 'Old', 4, 4, [], { appTitle: 'Old App' }),
  ], { subjects: SUBJECTS.slice(0, 2), items: {} });
  assert.deepEqual(r.subjects.map((s) => s.title), ['Math', 'English', 'Old App']);
});

test('lessons: review rounds left out, weak at 5+ answers under 80%, weakest first, special lesson names', () => {
  const r = build([
    quiz('math-mastery', 'Rounding', 10, 4),
    quiz('math-mastery', 'Rounding', 5, 5),
    quiz('math-mastery', 'Adding', 4, 1),
    quiz('math-mastery', 'Pangwakas', 6, 3, [], { final: true }),
    quiz('math-mastery', 'Dough problem', 5, 4, [], { kind: 'walkthrough' }),
    quiz('math-mastery', 'Bibingka', 5, 2, [], { kind: 'case' }),
    quiz('math-mastery', 'Review', 10, 0, [], { kind: 'review' }),
  ], { subjects: SUBJECTS, items: {} });
  const math = r.subjects.find((s) => s.app === 'math-mastery');
  assert.deepEqual(math.lessons.map((l) => [l.title, l.answered, l.correct, l.pct, l.quizzes, l.weak]), [
    ['Adding', 4, 1, 25, 1, false],
    ['Case Study: Bibingka', 5, 2, 40, 1, true],
    ['Final Mock Exam', 6, 3, 50, 1, true],
    ['Rounding', 15, 9, 60, 2, true],
    ['UPAC Walkthrough: Dough problem', 5, 4, 80, 1, false],
  ]);
  assert.equal(math.answered, 45, 'the review round still counts toward the subject');
});

test('questions: grouped across quizzes, repeated wrong pick flagged, to fix before fixed, then most missed', () => {
  const items = { 'math-mastery|k1': { box: 2, due: '2026-10-08', t: 9000 } };
  const r = build([
    quiz('math-mastery', 'Rounding', 5, 3, [miss('Round 4.67', '4.6', '4.7', { t: 100 }), miss('0.35 + 1.2', '0.47', '1.55', { t: 110, key: 'math-mastery|k1' })]),
    quiz('math-mastery', 'Review', 3, 1, [miss('Round 4.67', '4.6', '4.7', { t: 200 }), miss('Round 2.35', '2.4', '2.3', { t: 210 })], { kind: 'review' }),
    quiz('math-mastery', 'Rounding', 5, 4, [miss('Round 4.67', '5', '4.7', { t: 300 })]),
  ], { subjects: SUBJECTS, items });
  const math = r.subjects.find((s) => s.app === 'math-mastery');
  assert.deepEqual(math.questions.map((q) => [q.q, q.count, q.lastPick, q.answer, q.repeatedPick, q.status, q.lesson]), [
    ['Round 4.67', 3, '5', '4.7', '4.6', '', 'Rounding'],
    ['Round 2.35', 1, '2.4', '2.3', '', '', ''],
    ['0.35 + 1.2', 1, '0.47', '1.55', '', 'fixed', 'Rounding'],
  ]);
  assert.deepEqual([math.toFix, math.fixed], [2, 1]);
});

test('an older answer without a key and a newer one with it are the same question', () => {
  const items = { 'page-turners|k9': { box: 1, due: '2026-10-06', t: 500 } };
  const r = build([
    quiz('page-turners', 'Nouns', 3, 2, [miss('Pick the noun', 'run', 'cat')]),
    quiz('page-turners', 'Nouns', 3, 2, [miss('Pick the noun', 'jump', 'cat', { key: 'page-turners|k9', t: 400 })]),
  ], { subjects: SUBJECTS, items });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  assert.deepEqual(en.questions.map((q) => [q.q, q.count, q.key, q.status]), [['Pick the noun', 2, 'page-turners|k9', 'missing']]);
});

test('build ignores odd entries and odd wrong answers', () => {
  const r = build([
    null,
    { type: 'quiz', app: 'page-turners', answered: 0, wrong: [miss('X', 'a', 'b')] },
    quiz('page-turners', 'Nouns', 2, 1, [null, { picked: 'a' }, miss('Y', 'a', 'b')]),
  ], { subjects: SUBJECTS });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  assert.deepEqual(en.questions.map((q) => q.q), ['Y']);
  assert.equal(build([], {}).pct, null);
  assert.deepEqual(build(null).subjects, []);
});

test('lessonRows: medal lessons in game order with her answers, then other lessons she answered', () => {
  const r = build([
    quiz('page-turners', 'Verbs', 10, 4),
    quiz('page-turners', 'Pangwakas', 6, 6, [], { final: true }),
  ], { subjects: SUBJECTS, items: {} });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  const entry = { order: ['n', 'v'], lessons: { n: { title: 'Nouns', best: 2, now: 1 }, v: { title: ' verbs ', best: 0, now: 0 } } };
  assert.deepEqual(lessonRows(en, entry), [
    { title: 'Nouns', medal: 2, polish: true, answered: 0, pct: null },
    { title: 'verbs', medal: 0, polish: false, answered: 10, pct: 40 },
    { title: 'Final Mock Exam', medal: 0, polish: false, answered: 6, pct: 100 },
  ]);
  assert.deepEqual(lessonRows(en, undefined).map((l) => l.title), ['Verbs', 'Final Mock Exam']);
  assert.deepEqual(lessonRows(en, { order: 'bad', lessons: null }).map((l) => l.title), ['Verbs', 'Final Mock Exam']);
});

test('two keys with the same question text stay separate; a keyless miss joins the keyed question', () => {
  const items = { 'a|L1': { box: 2, due: '2026-10-08', t: 9000 }, 'a|L2': { box: 1, due: '2026-10-06', t: 9000 } };
  const r = build([
    quiz('page-turners', 'L1', 3, 2, [miss('Same text', 'x', 'y', { t: 100, key: 'a|L1' })]),
    quiz('page-turners', 'L2', 3, 2, [miss('Same text', 'x', 'y', { t: 200, key: 'a|L2' })]),
  ], { subjects: SUBJECTS, items });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  assert.deepEqual(en.questions.map((q) => [q.key, q.status]), [['a|L2', 'missing'], ['a|L1', 'fixed']]);

  const r2 = build([
    quiz('page-turners', 'L1', 3, 2, [miss('Same text', 'x', 'y', { t: 100, key: 'a|L1' })]),
    quiz('page-turners', 'L1', 3, 2, [miss('Same text', 'z', 'y', { t: 200 })]),
  ], { subjects: SUBJECTS, items });
  assert.deepEqual(r2.subjects.find((s) => s.app === 'page-turners').questions.map((q) => [q.count, q.key]), [[2, 'a|L1']]);
});

test('odd answered and correct counts: zero or string answered skipped, correct clamped, missing title safe', () => {
  const r = build([
    quiz('page-turners', 'Nouns', '5', 5),
    quiz('page-turners', 'Nouns', 0, 0),
    quiz('page-turners', 'Verbs', 4, 9),
    quiz('page-turners', undefined, 2, 1, [], { kind: 'walkthrough' }),
  ], { subjects: SUBJECTS });
  const en = r.subjects.find((s) => s.app === 'page-turners');
  assert.deepEqual([en.answered, en.correct, en.quizzes], [6, 5, 2]);
  assert.deepEqual(en.lessons.map((l) => [l.title, l.correct]), [['UPAC Walkthrough: ', 1], ['Verbs', 4]]);
});

test('practiceKeys: missing questions with a box, plus weak lessons of per-lesson review games, once each', () => {
  const items = {
    'page-turners|1': { box: 1, due: '2026-10-06', t: 500 },
    'page-turners|2': { box: 2, due: '2026-10-08', t: 99999 },
    'math-mastery|skill:3': { box: 3, due: '2026-10-20', t: 1 },
    'math-mastery|skill:4': { box: 3, due: '2026-10-20', t: 1 },
  };
  const r = build([
    quiz('page-turners', 'Nouns', 10, 6, [
      miss('One', 'x', 'y', { key: 'page-turners|1' }), miss('One', 'z', 'y', { key: 'page-turners|1' }),
      miss('Two', 'x', 'y', { key: 'page-turners|2' }), miss('Three', 'x', 'y'),
      miss('Four', 'x', 'y', { key: 'page-turners|4' })]),
    quiz('math-mastery', 'Rounding', 10, 5, [], { lessonId: '3' }),
    quiz('math-mastery', 'Decimals', 10, 10, [], { lessonId: '4' }),
  ], { subjects: SUBJECTS, items });
  const by = (app) => r.subjects.find((s) => s.app === app);
  assert.deepEqual(practiceKeys(by('page-turners'), items), ['page-turners|1']);
  assert.deepEqual(practiceKeys(by('math-mastery'), items), ['math-mastery|skill:3']);
});

test('markDue and practicePending', () => {
  const items = {
    a: { box: 2, due: '2026-10-08', t: 1 },
    b: { box: 2, due: '2026-10-01', t: 1 },
    c: { box: 2, due: '2026-10-01', t: 1, started: '2026-10-05' },
    'math-mastery|skill:3': { box: 3, due: '2026-10-20', t: 1 },
    g: { box: 2, due: '2026-10-08', t: 1, gone: true },
  };
  const keys = ['a', 'b', 'c', 'math-mastery|skill:3', 'missing', 'g'];
  assert.equal(practicePending(keys, items, '2026-10-05'), 3);
  assert.equal(markDue(items, keys, '2026-10-05', 5000), 3);
  assert.deepEqual(items.a, { box: 1, due: '2026-10-05', t: 5000 });
  assert.deepEqual(items.b, { box: 2, due: '2026-10-01', t: 1 });
  assert.deepEqual(items.c, { box: 1, due: '2026-10-01', t: 5000 });
  assert.deepEqual(items['math-mastery|skill:3'], { box: 3, due: '2026-10-05', t: 5000 });
  assert.equal(items.g.t, 1);
  assert.equal(practicePending(keys, items, '2026-10-05'), 0);
});

test('build lessons carry the first lessonId', () => {
  const r = build([
    quiz('math-mastery', 'A', 5, 5, []),
    quiz('math-mastery', 'A', 5, 5, [], { lessonId: '7' }),
    quiz('math-mastery', 'B', 5, 5, [], { lessonId: 0 }),
  ], { subjects: SUBJECTS, items: {} });
  const ls = r.subjects.find((s) => s.app === 'math-mastery').lessons;
  assert.equal(ls.find((l) => l.title === 'A').lessonId, '7');
  assert.equal(ls.find((l) => l.title === 'B').lessonId, '0');
});

const DAY = 86400000;
const at = (d, h = 10) => new Date(2026, 9, d, h).getTime();
const MON = new Date(2026, 9, 5).getTime(), PREV = new Date(2026, 8, 28).getTime();
const NOW = at(7, 18);
function wq(app, answered, correct, t, wrong) { return { type: 'quiz', app, appTitle: app + '!', answered, correct, wrong: wrong || [], t, updatedAt: NOW }; }

test('weekStart is local Monday 00:00 of that day\'s week', () => {
  assert.equal(weekStart(at(4, 23)), PREV, 'Sunday belongs to the week before');
  assert.equal(weekStart(at(5, 0)), MON);
  assert.equal(weekStart(at(7, 15)), MON);
});

test('weekly splits answers into this week and last week by entry time', () => {
  const entries = [
    wq('math-mastery', 10, 8, at(6)), wq('math-mastery', 10, 12, at(7, 9)),
    wq('math-mastery', 10, 5, at(1)), wq('math-mastery', 10, 10, at(4, 23)),
    wq('math-mastery', 50, 0, PREV - 1), wq('math-mastery', 9, 9, NOW + 1000),
    { type: 'open', app: 'math-mastery', t: at(6) }, wq('math-mastery', 0, 0, at(6)),
  ];
  const w = weekly(entries, { subjects: SUBJECTS, items: {}, now: NOW });
  assert.equal(w.start, MON);
  assert.equal(w.prevStart, PREV);
  assert.equal(w.subjects.length, 1);
  const m = w.subjects[0];
  assert.equal(m.title, 'Math');
  assert.deepEqual(m.now, { answered: 20, correct: 18, pct: 90 }, 'correct is clamped to answered');
  assert.deepEqual(m.before, { answered: 20, correct: 15, pct: 75 });
  assert.equal(m.change, 15);
});

test('weekly: change is null when a week has no answers; subjects in game order, then others', () => {
  const entries = [wq('zz-new', 4, 2, at(6)), wq('life-lab', 4, 4, at(2)), wq('page-turners', 4, 3, at(6)), wq('aa-new', 2, 1, at(6))];
  const w = weekly(entries, { subjects: SUBJECTS, items: {}, now: NOW });
  assert.deepEqual(w.subjects.map((s) => s.app), ['page-turners', 'life-lab', 'zz-new', 'aa-new']);
  assert.deepEqual(w.subjects.map((s) => s.title), ['English', 'Science', 'zz-new!', 'aa-new!']);
  const science = w.subjects[1];
  assert.deepEqual(science.now, { answered: 0, correct: 0, pct: null });
  assert.equal(science.change, null);
  assert.equal(w.subjects[0].before.pct, null);
  assert.equal(w.subjects[0].change, null);
  assert.deepEqual(weekly([], { now: NOW }).subjects, []);
});

test('weekly: fixed counts only questions graded this week', () => {
  const entries = [wq('life-lab', 3, 0, at(1), [
    miss('Q1', 'a', 'b', { key: 'life-lab|1', t: at(1) }),
    miss('Q2', 'a', 'b', { key: 'life-lab|2', t: at(1) }),
    miss('Q3', 'a', 'b', { key: 'life-lab|3', t: at(1) }),
  ])];
  const items = {
    'life-lab|1': { box: 2, due: '2026-10-09', t: at(6) },
    'life-lab|2': { box: 2, due: '2026-10-09', t: at(3) },
    'life-lab|3': { box: 1, due: '2026-10-08', t: at(6) },
  };
  assert.equal(weekly(entries, { subjects: SUBJECTS, items, now: NOW }).fixed, 1);
});

test('weekly: what happened to the questions and lessons sent with Practice these', () => {
  const items = {
    'math-mastery|a': { box: 2, due: '2026-10-09', t: at(6) },
    'math-mastery|b': { box: 1, due: '2026-10-08', t: at(6) },
    'math-mastery|c': { box: 3, due: '2026-10-09', t: at(5, 8) },
    'math-mastery|d': { box: 3, due: '2026-10-09', t: at(6), gone: true },
    'math-mastery|skill:L1': { box: 1, due: '2026-10-08', t: at(6) },
    'math-mastery|skill:L2': { box: 3, due: '2026-10-09', t: at(5, 8) },
  };
  const sends = {
    s1: { t: at(5, 9), app: 'math-mastery', keys: ['math-mastery|a', 'math-mastery|b', 'math-mastery|c', 'math-mastery|d', 'math-mastery|e', 'math-mastery|skill:L1', 'math-mastery|skill:L2', 'math-mastery|skill:L3'] },
    s2: { t: at(1), app: 'other-app', keys: [] },
    old: { t: PREV - 1, app: 'math-mastery', keys: ['math-mastery|a'] },
    s3: { t: at(6, 12), app: 'math-mastery', keys: ['math-mastery|a'] },
  };
  const w = weekly([], { subjects: SUBJECTS, items, sends, now: NOW });
  assert.deepEqual(w.sends.map((s) => s.id), ['s3', 's1', 's2'], 'newest first; older than last week left out');
  assert.deepEqual(w.sends[1], { id: 's1', t: at(5, 9), app: 'math-mastery', title: 'Math',
    questions: { total: 5, fixed: 1 }, lessons: { total: 3, practised: 1 } });
  assert.deepEqual(w.sends[0].questions, { total: 1, fixed: 0 }, 'graded before the send');
  assert.equal(w.sends[2].title, 'other-app');
  assert.deepEqual(weekly([], { now: NOW }).sends, []);
});

test('addSend adds a send without touching the old object and drops sends over 8 weeks old', () => {
  const state = { v: 1, sends: { keep: { t: NOW - 50 * DAY, app: 'x', keys: ['x|1'] }, old: { t: NOW - 57 * DAY, app: 'x', keys: [] }, junk: { app: 'x' } } };
  const before = JSON.stringify(state);
  const keys = ['math-mastery|a'];
  const out = addSend(state, 'math-mastery', keys, NOW, () => 0.5);
  assert.equal(JSON.stringify(state), before);
  const id = NOW + '-' + Math.floor(0.5 * 1e9).toString(36);
  assert.deepEqual(Object.keys(out.sends).sort(), [id, 'keep'].sort());
  assert.deepEqual(out.sends[id], { t: NOW, app: 'math-mastery', keys: ['math-mastery|a'] });
  assert.notEqual(out.sends[id].keys, keys);
  assert.equal(out.v, 1);
  assert.deepEqual(Object.keys(addSend(null, 'a', [], NOW, () => 0).sends), [NOW + '-0']);
  assert.deepEqual(Object.keys(addSend('junk', 'a', [], NOW, () => 0).sends), [NOW + '-0']);
});
