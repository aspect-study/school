process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, streakOf, read, parentLine, TEXT, ORDER, ALL_COINS, MILESTONES } = require(engineFile('quests.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function clock(y, m, d, h) {
  let t = new Date(y, m - 1, d, h || 9, 0).getTime();
  const now = () => t;
  now.days = (n) => { const x = new Date(t); x.setDate(x.getDate() + n); t = x.getTime(); };
  now.mins = (n) => { t += n * 60000; };
  return now;
}

const CARDS = [
  { app: 'life-lab', title: 'Life Lab', href: 'life.html?reset=1' },
  { app: 'craft-corner', title: 'Craft Corner', href: 'craft.html?reset=1' },
  { app: 'page-turners', title: 'Page Turners', href: 'pages.html?reset=1' },
];

// A fake page: history entries, due counts, weak spots and a wallet.
function world(opts) {
  const o = Object.assign({ due: {}, weak: [], entries: [] }, opts);
  const s = memory(), now = o.now || clock(2026, 10, 2);
  const paid = [];
  const deps = {
    history: () => o.entries,
    due: () => o.due,
    weak: () => o.weak,
    bonus: (c) => { paid.push(c); return true; },
  };
  return { o, s, now, paid, q: create(s, now, 'grade5', deps) };
}

let nextId = 1;
const round = (now, f) => Object.assign({ id: 'e' + nextId++, type: 'quiz', app: 'life-lab', appTitle: 'Life Lab', lessonTitle: 'Plants',
  final: false, finished: true, stars: 1, correct: 5, answered: 8, total: 8, t: now() }, f);
const saved = (s) => JSON.parse(s.data.quests_v1);

test('the pool, the all-3 bonus and the streak milestones', () => {
  assert.deepEqual(ORDER, ['rounds', 'stars', 'right', 'explore', 'best']);
  assert.equal(ALL_COINS, 3);
  assert.deepEqual(MILESTONES, [[7, 5], [14, 10], [30, 15], [60, 20]]);
});

test('slot 1 is the review with the most due, slot 2 the weakest lesson, slot 3 the first pool kind', () => {
  const w = world({ due: { 'craft-corner': 2, 'life-lab': 5 }, weak: [{ app: 'life-lab', appTitle: 'Life Lab', lesson: 'Plants', pct: 50 }] });
  const list = w.q.pick(CARDS).list;
  assert.deepEqual(list.map((x) => x.id), ['review|life-lab', 'practice|life-lab|Plants', 'rounds']);
  assert.deepEqual(list[0], { id: 'review|life-lab', kind: 'review', app: 'life-lab', title: 'Life Lab', href: 'life.html?reset=1&review=1', done: false });
  assert.equal(list[1].lesson, 'Plants');
  assert.equal(w.q.pick(CARDS).list[0].id, 'review|life-lab', 'picked once a day');
});

test('fallbacks: nothing due gives 3 stars, no weak lesson gives 20 right; slot 3 skips kinds already used', () => {
  const w = world();
  assert.deepEqual(w.q.pick(CARDS).list.map((x) => x.kind), ['stars', 'right', 'rounds']);
  const weakOnlyMock = world({ weak: [{ app: 'life-lab', lesson: 'Final Mock Exam', pct: 40 }, { app: 'life-lab', lesson: 'Case Study: X', pct: 40 }, { app: 'other-app', lesson: 'Y', pct: 40 }] });
  assert.equal(weakOnlyMock.q.pick(CARDS).list[1].kind, 'right', 'mock exams, case studies and other grades are not practice quests');
});

test('rotation: tomorrow skips yesterday\'s subject, lesson and pool kind when there is another choice', () => {
  const w = world({ due: { 'life-lab': 5, 'craft-corner': 2 }, weak: [{ app: 'life-lab', lesson: 'Plants', pct: 50 }, { app: 'craft-corner', lesson: 'Sewing', pct: 60 }] });
  w.q.pick(CARDS);
  w.now.days(1);
  const list = w.q.pick(CARDS).list;
  assert.deepEqual(list.map((x) => x.id), ['review|craft-corner', 'practice|craft-corner|Sewing', 'stars']);
  w.now.days(1);
  w.o.due = { 'life-lab': 5 };
  w.o.weak = [{ app: 'life-lab', lesson: 'Plants', pct: 50 }];
  assert.deepEqual(w.q.pick(CARDS).list.map((x) => x.id), ['review|life-lab', 'practice|life-lab|Plants', 'right'], 'the only choice may repeat');
});

test('explore picks the subject she has not played the longest; best needs a lesson played before', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now, entries: [round(now, { app: 'life-lab', t: now() - 86400000 }), round(now, { app: 'page-turners', t: now() - 3 * 86400000 })] });
  const saveDay = (kind) => { w.s.data.quests_v1 = JSON.stringify({ v: 1, day: '2026-10-01', at: 1, list: [{ id: 'stars', kind: 'stars' }, { id: 'right', kind: 'right' }, { id: kind, kind }], days: [], paidDay: '', streakPaid: [] }); };
  saveDay('right');
  assert.deepEqual(w.q.pick(CARDS).list[2], { id: 'explore|craft-corner', kind: 'explore', app: 'craft-corner', title: 'Craft Corner', href: 'craft.html?reset=1', done: false }, 'never played first');
  const fresh = world();
  fresh.s.data.quests_v1 = JSON.stringify({ v: 1, day: '2026-10-01', at: 1, list: [{ id: 'x', kind: 'stars' }, { id: 'y', kind: 'right' }, { id: 'explore|a', kind: 'explore' }], days: [], paidDay: '', streakPaid: [] });
  assert.equal(fresh.q.pick(CARDS).list[2].kind, 'rounds', 'no lesson played yet: best is skipped and the rotation wraps');
});

test('each quest is done by the right rounds today, after the pick', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now, due: { 'life-lab': 3 }, weak: [{ app: 'life-lab', lesson: 'Plants', pct: 50 }] });
  w.o.entries.push(round(now, { kind: 'review', lessonTitle: 'Review' }));
  now.mins(1);
  w.q.pick(CARDS);
  assert.deepEqual(w.q.check(), [], 'a round before the pick does not count');
  now.mins(5);
  w.o.entries.push(round(now, { kind: 'review', lessonTitle: 'Review', finished: false }));
  assert.deepEqual(w.q.check(), [], 'an unfinished round does not count');
  w.o.entries.push(round(now, { kind: 'review', lessonTitle: 'Review' }));
  const ev = w.q.check();
  assert.deepEqual(ev, [{ big: false, icon: '🎯', title: 'You finished a quest!', line: '🔁 Do a Review round in Life Lab', next: '1 of 3 quests done today' }]);
  assert.deepEqual(saved(w.s).days, ['2026-10-02'], 'one quest makes it a study day');
  assert.deepEqual(w.q.check(), [], 'celebrated once');
  w.o.entries.push(round(now, { lessonTitle: 'Plants' }));
  const done = w.q.check();
  assert.equal(done.length, 3, 'practice and 2 rounds are done too, so all 3 pay the bonus');
  assert.equal(done[0].big, true, 'the bonus leads');
});

test('stars, right, explore and best rules', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  const isDone = (q, entries) => { w.o.entries = entries; return w.q.doneBy(q, entries.filter((e) => e.finished)); };
  assert.equal(isDone({ kind: 'stars' }, [round(now, { stars: 3 })]), true);
  assert.equal(isDone({ kind: 'stars' }, [round(now, { stars: 2 })]), false);
  assert.equal(isDone({ kind: 'right' }, [round(now, { correct: 12 }), round(now, { correct: 8 })]), true);
  assert.equal(isDone({ kind: 'right' }, [round(now, { correct: 19 })]), false);
  assert.equal(isDone({ kind: 'rounds' }, [round(now)]), false);
  assert.equal(isDone({ kind: 'explore', app: 'craft-corner' }, [round(now, { app: 'craft-corner' })]), true);
  const old = round(now, { correct: 6, t: now() - 86400000 });
  w.o.entries = [old, round(now, { correct: 7 })];
  assert.equal(w.q.doneBy({ kind: 'best' }, [w.o.entries[1]]), true, 'beat 6 with 7');
  w.o.entries = [old, round(now, { correct: 6 })];
  assert.equal(w.q.doneBy({ kind: 'best' }, [w.o.entries[1]]), false, 'a tie is not a new best');
  w.o.entries = [round(now, { correct: 8, lessonTitle: 'New' })];
  assert.equal(w.q.doneBy({ kind: 'best' }, w.o.entries), false, 'a first try is not a new best');
});

test('all 3 quests pay 3 coins once a day', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  w.q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3, correct: 12 }), round(now, { stars: 1, correct: 9 }));
  const ev = w.q.check();
  assert.deepEqual(w.paid, [3]);
  assert.deepEqual(ev[0], { big: true, icon: '🎯', title: 'You finished all 3 quests!', line: '+3 coins', next: 'See you tomorrow!' });
  assert.equal(ev.length, 4, 'the big one first, then each quest');
  w.q.check();
  assert.deepEqual(w.paid, [3], 'paid once');
  assert.equal(saved(w.s).paidDay, '2026-10-02');
});

test('a failed payment is tried again later and never marked paid', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  let ok = false;
  const q = create(w.s, now, 'grade5', { history: () => w.o.entries, due: () => ({}), weak: () => [], bonus: (c) => { if (ok) w.paid.push(c); return ok; } });
  q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3, correct: 12 }), round(now, { correct: 9 }));
  q.check();
  assert.equal(saved(w.s).paidDay, '');
  ok = true;
  q.check();
  assert.deepEqual(w.paid, [3]);
});

test('the streak survives 2 rest days in any 7, counts only study days, and today is not over yet', () => {
  const d = (n) => { const x = new Date(2026, 9, 2 + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const today = d(0);
  assert.deepEqual(streakOf([], today), { days: 0, start: null, restLeft: 2, welcomeBack: false });
  assert.equal(streakOf([d(-1), d(-2), d(-3)], today).days, 3, 'not studied today yet: still 3');
  assert.equal(streakOf([d(0), d(-1), d(-3), d(-5)], today).days, 4, 'two rest days inside the week');
  assert.equal(streakOf([d(0), d(-1), d(-3), d(-5)], today).restLeft, 0, 'both rest days used');
  assert.equal(streakOf([d(0), d(-2), d(-4), d(-5)], today).days, 4);
  assert.equal(streakOf([d(0), d(-4), d(-5)], today).days, 1, 'three missed days in a row end the run');
  const back = streakOf([d(-10), d(-11)], today);
  assert.deepEqual([back.days, back.welcomeBack], [0, true]);
  assert.equal(streakOf([d(0), d(-1)], today).start, d(-1));
});

test('streak milestones pay once per run', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  const days = [];
  for (let i = 6; i >= 1; i--) { const x = new Date(2026, 9, 2 - i); days.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); }
  w.s.data.quests_v1 = JSON.stringify({ v: 1, day: '', at: 0, list: [], days, paidDay: '', streakPaid: [] });
  w.q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3 }));
  const ev = w.q.check();
  assert.deepEqual(ev[0], { big: true, icon: '🔥', title: 'You have a 7-day streak!', line: '+5 coins', next: 'Next: 14 days' });
  assert.deepEqual(w.paid, [5]);
  assert.deepEqual(saved(w.s).streakPaid, [days[0] + '|7']);
  w.o.entries.push(round(now, { stars: 3 }));
  w.q.check();
  assert.deepEqual(w.paid, [5], 'once per run');
});

test('lobby text and the parent line', () => {
  const T = TEXT.grade5;
  assert.equal(T.streak({ days: 12, restLeft: 2 }), '🔥 12-day streak · you can rest 2 more days this week');
  assert.equal(T.streak({ days: 3, restLeft: 1 }), '🔥 3-day streak · you can rest 1 more day this week');
  assert.equal(T.streak({ days: 3, restLeft: 0 }), '🔥 3-day streak · come back tomorrow to keep it going');
  assert.equal(T.streak({ days: 0, welcomeBack: true }), 'Welcome back! Let\'s start a new streak');
  assert.equal(T.streak({ days: 0, welcomeBack: false }), 'Start a streak today!');
  assert.equal(T.quest({ kind: 'practice', lesson: 'Plants', title: 'Life Lab' }), '📘 Practice Plants in Life Lab');
  assert.equal(TEXT.grade2.quest({ kind: 'review', title: 'Kuwentista' }), '🔁 Gumawa ng Review round sa Kuwentista · Do a Review round in Kuwentista');
  const today = new Date(2026, 9, 2, 9).getTime();
  const state = { v: 1, day: '2026-10-02', at: 1, list: [{ done: true }, { done: false }, { done: true }], days: ['2026-10-01', '2026-10-02'], paidDay: '', streakPaid: [] };
  assert.equal(parentLine(state, today), '🔥 2-day streak · today 2 of 3 quests');
  assert.equal(parentLine(read(memory()), today), 'No streak yet · quests not picked yet today');
});

test('junk saved data reads as a fresh start', () => {
  assert.deepEqual(read(memory({ quests_v1: '{nope' })), { v: 1, day: '', at: 0, list: [], days: [], paidDay: '', streakPaid: [] });
  const w = world();
  w.s.data.quests_v1 = JSON.stringify({ v: 1, day: 5, list: 'x', days: 'y' });
  assert.equal(w.q.pick(CARDS).list.length, 3);
});

test('create needs a known grade', () => {
  assert.throws(() => create(memory(), () => 0, 'grade9', {}), /grade/);
});

const dkey = (ms) => { const x = new Date(ms); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

test('a 70-day run pays each milestone exactly once and keeps counting past 60', () => {
  const now = clock(2026, 8, 1);
  const w = world({ now });
  for (let i = 0; i < 70; i++) {
    w.q.pick(CARDS);
    now.mins(1);
    w.o.entries.push(round(now, { stars: 3, correct: 5 }));
    w.q.check();
    now.days(1);
  }
  assert.deepEqual(w.paid, [5, 10, 15, 20]);
  assert.equal(w.q.streak().days >= 69, true);
  assert.equal(saved(w.s).days.length, 70);
});

test('a study day synced in later does not pay a milestone twice; a new run after a break does', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  const days = ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];
  w.s.data.quests_v1 = JSON.stringify({ v: 1, day: '', at: 0, list: [], days, paidDay: '', streakPaid: [] });
  w.q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3 }));
  w.q.check();
  assert.deepEqual(w.paid, [5]);
  const st = saved(w.s);
  st.days.unshift('2026-09-25');
  w.s.data.quests_v1 = JSON.stringify(st);
  w.q.check();
  assert.deepEqual(w.paid, [5], 'the run start moved earlier, still the same run');

  const w2 = world({ now: clock(2026, 10, 2) });
  w2.s.data.quests_v1 = JSON.stringify({ v: 1, day: '', at: 0, list: [], days, paidDay: '', streakPaid: ['2026-08-01|7'] });
  w2.q.pick(CARDS);
  w2.now.mins(1);
  w2.o.entries.push(round(w2.now, { stars: 3 }));
  w2.q.check();
  assert.deepEqual(w2.paid, [5], 'an older paid run does not block a new one');
});

test('when saving fails the coins are never paid twice', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  let failing = false;
  const store = { getItem: w.s.getItem, setItem: (k, v) => { if (failing) throw new Error('full'); w.s.setItem(k, v); } };
  const calls = [];
  const q = create(store, now, 'grade5', { history: () => w.o.entries, due: () => ({}), weak: () => [], bonus: (c) => { calls.push(c); return true; } });
  q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3, correct: 12 }), round(now, { correct: 9 }));
  failing = true;
  q.check();
  q.check();
  assert.deepEqual(calls, [], 'no coins when the mark cannot be saved');
  failing = false;
  q.check();
  q.check();
  assert.deepEqual(calls, [3], 'paid once after saving works');
});

test('a failed bonus leaves nothing marked, for the all-3 and the streak', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  w.s.data.quests_v1 = JSON.stringify({ v: 1, day: '', at: 0, list: [], days: ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'], paidDay: '', streakPaid: [] });
  const q = create(w.s, now, 'grade5', { history: () => w.o.entries, due: () => ({}), weak: () => [], bonus: () => false });
  q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3, correct: 12 }), round(now, { correct: 9 }));
  q.check();
  assert.equal(saved(w.s).paidDay, '');
  assert.deepEqual(saved(w.s).streakPaid, []);
});

test('explore skips the subjects already used by the other two quests', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now, due: { 'craft-corner': 3 }, weak: [{ app: 'life-lab', lesson: 'Plants', pct: 50 }],
    entries: [round(now, { app: 'life-lab', t: now() - 86400000 }), round(now, { app: 'page-turners', t: now() - 86400000 })] });
  w.s.data.quests_v1 = JSON.stringify({ v: 1, day: '2026-10-01', at: 1, list: [{ id: 'a', kind: 'stars' }, { id: 'b', kind: 'right' }, { id: 'c', kind: 'right' }], days: [], paidDay: '', streakPaid: [] });
  assert.equal(w.q.pick(CARDS).list[2].id, 'explore|page-turners');
});

test('quest popups count up one by one', () => {
  const now = clock(2026, 10, 2);
  const w = world({ now });
  w.q.pick(CARDS);
  now.mins(1);
  w.o.entries.push(round(now, { stars: 3, correct: 12 }), round(now, { correct: 9 }));
  const ev = w.q.check();
  assert.deepEqual(ev.filter((e) => !e.big).map((e) => e.next), ['1 of 3 quests done today', '2 of 3 quests done today', '3 of 3 quests done today']);
});

test('links come from the lobby cards, never from saved data', () => {
  const { linkFor } = require(engineFile('quests.js'));
  assert.equal(linkFor({ kind: 'review', app: 'life-lab', href: 'javascript:alert(1)' }, CARDS), 'life.html?reset=1&review=1');
  assert.equal(linkFor({ kind: 'explore', app: 'craft-corner' }, CARDS), 'craft.html?reset=1');
  assert.equal(linkFor({ kind: 'review', app: 'gone', href: 'x' }, CARDS), null);
  assert.equal(linkFor({ kind: 'rounds' }, CARDS), null);
  assert.equal(linkFor({ kind: 'review', app: 'a' }, [{ app: 'a', href: 'a.html' }]), 'a.html?review=1');
});
