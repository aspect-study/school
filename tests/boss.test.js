process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, read, rank, weekKey, linkFor, parentLine, missedDay, outcome, TEXT, KEY, MISSED_KEY, STAGES, STAGE_SIZE, FULL_COINS, HALF_COINS } = require(engineFile('boss.js'));
const { kindOf } = require(engineFile('sync-core.js'));

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
  return now;
}

const CARDS = ['a', 'b', 'c', 'd', 'e', 'm'].map((app) => ({ app, title: app.toUpperCase() + ' Game', href: app + '.html?reset=1' }));

// n review boxes for one app, all due on 2026-10-05.
function boxes(items, app, n, box) {
  for (let i = 0; i < n; i++) items[app + '|h' + i] = { box: box || 2, due: '2026-10-05', t: 1 };
  return items;
}

function world(opts) {
  const o = Object.assign({ items: {}, due: {}, grade: 'grade5', bonusOk: true }, opts);
  const s = memory(), now = o.now || clock(2026, 10, 5);
  const paid = [];
  const deps = {
    items: () => o.items,
    due: () => o.due,
    bonus: (c) => { if (!o.bonusOk) return false; paid.push(c); return true; },
    random: () => 0.5,
  };
  return { o, s, now, paid, b: create(s, now, o.grade, deps) };
}

// Four qualifying apps: a has the most due, then c; b and d have none due, b has more weak boxes.
function fourApps() {
  const items = {};
  boxes(items, 'a', 3, 3); boxes(items, 'b', 5, 1); boxes(items, 'c', 3, 2); boxes(items, 'd', 4, 2);
  return { items, due: { a: 3, c: 1 } };
}
const saved = (s) => JSON.parse(s.data[KEY]);

test('sizes and pay', () => {
  assert.deepEqual(STAGES, { grade5: 4, grade2: 3 });
  assert.equal(STAGE_SIZE, 3);
  assert.equal(FULL_COINS, 10);
  assert.equal(HALF_COINS, 4);
});

test('a week starts on Monday', () => {
  assert.equal(weekKey(new Date(2026, 9, 4, 23, 59).getTime()), '2026-09-28', 'Sunday belongs to the week before');
  assert.equal(weekKey(new Date(2026, 9, 5, 0, 1).getTime()), '2026-10-05');
  assert.equal(weekKey(new Date(2026, 9, 11, 20).getTime()), '2026-10-05');
  assert.equal(weekKey(new Date(2027, 0, 1, 9).getTime()), '2026-12-28', 'across the year end');
});

test('rank: most due first, then most weak boxes; 3 boxes or 1 skill box qualify; gone boxes and other cards do not count', () => {
  const items = {};
  boxes(items, 'a', 3, 3);
  boxes(items, 'b', 5, 1);
  boxes(items, 'c', 3, 2);
  boxes(items, 'd', 2, 1);
  items['m|skill:fractions'] = { box: 2, due: '2026-10-09', t: 1 };
  boxes(items, 'e', 3, 1);
  Object.keys(items).filter((k) => k.indexOf('e|') === 0).forEach((k) => { items[k].gone = true; });
  boxes(items, 'x', 9, 1);
  const order = rank(CARDS, items, { a: 3, c: 1, x: 9 }, () => 0.5).map((c) => c.app);
  assert.deepEqual(order, ['a', 'c', 'b', 'm']);
});

test('ensure picks the stages once a week, with their titles', () => {
  const w = world(fourApps());
  assert.deepEqual(w.b.ensure(CARDS), []);
  const st = saved(w.s);
  assert.equal(st.week, '2026-10-05');
  assert.deepEqual(st.stages, [
    { app: 'a', title: 'A Game', cleared: false }, { app: 'c', title: 'C Game', cleared: false },
    { app: 'b', title: 'B Game', cleared: false }, { app: 'd', title: 'D Game', cleared: false }]);
  w.o.due = { d: 9 };
  w.now.days(3);
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages.map((s) => s.app), ['a', 'c', 'b', 'd'], 'kept for the rest of the week');
  assert.equal(w.b.isStage('a'), true);
  assert.equal(w.b.isStage('e'), false);
});

test('Grade 2 has 3 stages', () => {
  const w = world(Object.assign(fourApps(), { grade: 'grade2' }));
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages.map((s) => s.app), ['a', 'c', 'b']);
});

test('fewer than 2 qualifying games: no boss yet, and the lobby tries again later that week', () => {
  const w = world({ items: boxes({}, 'a', 3) });
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages, []);
  assert.equal(w.b.isStage('a'), false);
  boxes(w.o.items, 'b', 3);
  w.now.days(1);
  w.b.ensure(CARDS);
  assert.deepEqual(saved(w.s).stages.map((s) => s.app), ['a', 'b']);
});

test('2 of 3 right clears a stage; 1 of 3 asks to try again; a cleared stage counts once', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  const miss = w.b.stageResult('c', 1, 3);
  assert.equal(miss.length, 1);
  assert.deepEqual([miss[0].big, miss[0].icon, miss[0].title], [false, '⚔️', TEXT.grade5.missTitle]);
  assert.equal(miss[0].line, '1 of 3 right · you need 2');
  assert.equal(w.b.isStage('c'), true, 'still open');
  const hit = w.b.stageResult('c', 2, 3);
  assert.deepEqual(hit.map((e) => e.title), ['Boss hit! C Game stage cleared']);
  assert.equal(hit[0].line, '1 of 4 stages cleared');
  assert.equal(hit[0].next, 'Next stage: A Game');
  assert.equal(w.b.isStage('c'), false);
  assert.deepEqual(w.b.stageResult('c', 3, 3), [], 'already cleared');
  assert.deepEqual(w.b.stageResult('e', 3, 3), [], 'not a stage');
  assert.deepEqual(w.b.stageResult('a', 0, 0), [], 'an empty round counts for nothing');
  assert.deepEqual(w.b.stageResult('a', 2, 2).map((e) => e.icon), ['⚔️'], 'a short pool keeps the 2-of-3 ratio');
  assert.equal(w.paid.length, 0);
});

test('clearing every stage pays 10 coins once', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  ['a', 'c', 'b'].forEach((app) => w.b.stageResult(app, 3, 3));
  const last = w.b.stageResult('d', 2, 3);
  assert.deepEqual(last.map((e) => e.big), [true, false]);
  assert.deepEqual([last[0].icon, last[0].title, last[0].line], ['🐉', TEXT.grade5.beatTitle, '+10 coins']);
  assert.equal(last[1].next, TEXT.grade5.hitNext(null));
  assert.deepEqual(w.paid, [10]);
  assert.deepEqual(saved(w.s).paid, ['2026-10-05|full']);
  assert.deepEqual(w.b.ensure(CARDS), [], 'the lobby pays nothing more');
  w.now.days(7);
  assert.deepEqual(w.b.ensure(CARDS), [], 'nor at the next week');
  assert.deepEqual(w.paid, [10]);
});

test('at least half cleared pays 4 coins when the next week starts; then a new boss is picked', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  w.b.stageResult('a', 3, 3);
  w.b.stageResult('c', 3, 3);
  w.now.days(7);
  const events = w.b.ensure(CARDS);
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].big, events[0].title, events[0].line], [false, 'Last week\'s boss: 2 of 4 stages', '+4 coins']);
  assert.deepEqual(w.paid, [4]);
  const st = saved(w.s);
  assert.equal(st.week, '2026-10-12');
  assert.equal(st.stages.length, 4);
  assert.ok(st.stages.every((s) => !s.cleared), 'a fresh boss');
  assert.deepEqual(st.paid, ['2026-10-05|half']);
  assert.deepEqual(w.b.ensure(CARDS), []);
  assert.deepEqual(w.paid, [4]);
});

test('under half pays nothing at the next week', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  w.b.stageResult('a', 3, 3);
  w.now.days(7);
  assert.deepEqual(w.b.ensure(CARDS), []);
  assert.deepEqual(w.paid, []);
  const st = saved(w.s);
  assert.equal(st.week, '2026-10-12');
  assert.ok(st.stages.length === 4 && st.stages.every((x) => !x.cleared), 'a fresh boss');
});

test('stages cleared on another device: the lobby pays the full boss once, this week or at rollover', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  const st = saved(w.s);
  st.stages.forEach((s) => { s.cleared = true; });
  w.s.data[KEY] = JSON.stringify(st);
  assert.deepEqual(w.b.ensure(CARDS).map((e) => e.big), [true]);
  assert.deepEqual(w.paid, [10]);

  const w2 = world(fourApps());
  w2.b.ensure(CARDS);
  const st2 = saved(w2.s);
  st2.stages.forEach((s) => { s.cleared = true; });
  w2.s.data[KEY] = JSON.stringify(st2);
  w2.now.days(7);
  const rolled = w2.b.ensure(CARDS);
  assert.deepEqual(rolled.map((e) => e.title), [TEXT.grade5.beatTitle], 'full, not half');
  assert.equal(rolled[0].next, TEXT.grade5.halfNext);
  assert.deepEqual(w2.paid, [10]);
});

test('a failed payment leaves no mark, so the lobby pays later', () => {
  const w = world(Object.assign(fourApps(), { bonusOk: false }));
  w.b.ensure(CARDS);
  ['a', 'c', 'b'].forEach((app) => w.b.stageResult(app, 3, 3));
  assert.deepEqual(w.b.stageResult('d', 3, 3).map((e) => e.big), [false], 'no beat popup without the coins');
  assert.deepEqual(saved(w.s).paid, []);
  w.o.bonusOk = true;
  assert.deepEqual(w.b.ensure(CARDS).map((e) => e.big), [true]);
  assert.deepEqual(w.paid, [10]);
});

test('read ignores junk', () => {
  assert.deepEqual(read(memory({ boss_v1: '{nope' })), { v: 1, week: '', stages: [], paid: [] });
  assert.deepEqual(read(memory({ boss_v1: JSON.stringify({ v: 1, week: 5, stages: [null, { app: 'a', cleared: 'yes' }, { title: 'x' }], paid: [1, 'w|full'] }) })),
    { v: 1, week: '', stages: [{ app: 'a', title: 'a', cleared: false }], paid: ['w|full'] });
});

test('links open the game in boss mode', () => {
  assert.equal(linkFor('a', CARDS), 'a.html?reset=1&boss=1');
  assert.equal(linkFor('z', [{ app: 'z', href: 'z.html' }]), 'z.html?boss=1');
  assert.equal(linkFor('q', CARDS), null);
});

test('the parent line', () => {
  const now = new Date(2026, 9, 6, 9).getTime();
  const st = (cleared) => ({ v: 1, week: '2026-10-05', stages: [{ app: 'a', title: 'A', cleared: true }, { app: 'b', title: 'B', cleared }], paid: [] });
  assert.equal(parentLine(st(false), now), '🐉 Weekly boss: 1 of 2 stages');
  assert.equal(parentLine(st(true), now), '🐉 Weekly boss: beaten');
  assert.equal(parentLine(st(true), new Date(2026, 9, 13, 9).getTime()), '🐉 Weekly boss: not started');
  assert.equal(parentLine({ v: 1, week: '2026-10-05', stages: [], paid: [] }, now), '🐉 Weekly boss: not started');
});

test('a reward owed at rollover is never lost: a failed payment keeps the old week for the next try (full)', () => {
  const w = world(Object.assign(fourApps(), { bonusOk: false }));
  w.b.ensure(CARDS);
  ['a', 'c', 'b', 'd'].forEach((app) => w.b.stageResult(app, 3, 3));
  w.now.days(7);
  assert.deepEqual(w.b.ensure(CARDS), []);
  const st = saved(w.s);
  assert.equal(st.week, '2026-10-05');
  assert.ok(st.stages.length === 4 && st.stages.every((s) => s.cleared));
  assert.deepEqual(st.paid, []);
  w.o.bonusOk = true;
  const events = w.b.ensure(CARDS);
  assert.deepEqual(events.map((e) => e.big), [true]);
  assert.equal(events[0].next, TEXT.grade5.halfNext, 'the new boss is picked right then');
  assert.deepEqual(w.paid, [10]);
  assert.equal(saved(w.s).week, '2026-10-12');
});

test('a reward owed at rollover is never lost: a failed payment keeps the old week for the next try (half)', () => {
  const w = world(Object.assign(fourApps(), { bonusOk: false }));
  w.b.ensure(CARDS);
  w.b.stageResult('a', 3, 3);
  w.b.stageResult('c', 3, 3);
  w.now.days(7);
  assert.deepEqual(w.b.ensure(CARDS), []);
  const st = saved(w.s);
  assert.equal(st.week, '2026-10-05');
  assert.equal(st.stages.filter((s) => s.cleared).length, 2);
  assert.deepEqual(st.paid, []);
  w.o.bonusOk = true;
  assert.equal(w.b.ensure(CARDS).length, 1);
  assert.deepEqual(w.paid, [4]);
  assert.equal(saved(w.s).week, '2026-10-12');
});

test('a clock moved back changes nothing', () => {
  const w = world(Object.assign(fourApps(), { now: clock(2026, 10, 12) }));
  w.b.ensure(CARDS);
  w.b.stageResult('a', 3, 3);
  const before = w.s.data[KEY];
  w.now.days(-7);
  assert.deepEqual(w.b.ensure(CARDS), []);
  assert.equal(w.s.data[KEY], before);
  w.now.days(7);
  w.b.ensure(CARDS);
  assert.equal(saved(w.s).stages.find((s) => s.app === 'a').cleared, true);
});

test('ensure does not write when nothing changed', () => {
  const s = memory();
  let writes = 0;
  const counted = { getItem: s.getItem, setItem: (k, v) => { writes++; s.setItem(k, v); } };
  const b = create(counted, clock(2026, 10, 5), 'grade5', { items: () => boxes({}, 'a', 3), due: () => ({}), bonus: () => true, random: () => 0.5 });
  b.ensure(CARDS);
  const first = writes;
  b.ensure(CARDS);
  assert.equal(writes, first);
});

test('rank counts only boxes the review would accept', () => {
  const items = {};
  for (let i = 0; i < 3; i++) items['p|h' + i] = { box: 2.5, due: '2026-10-05', t: 1 };
  for (let i = 0; i < 3; i++) items['q|h' + i] = { box: 2, due: '2026-10-05' };
  for (let i = 0; i < 3; i++) items['r|h' + i] = { box: 2, due: 'soon', t: 1 };
  const cards = ['p', 'q', 'r'].map((app) => ({ app, title: app, href: app + '.html' }));
  assert.deepEqual(rank(cards, items, {}, () => 0.5), []);
});

test('a cleared boss stage is told to the family news, once', () => {
  const w = world(fourApps()), told = [];
  const b = create(w.s, w.now, 'grade5', { items: () => w.o.items, due: () => w.o.due, bonus: () => true, random: () => 0.5,
    news: (kind, data) => told.push([kind, data]) });
  b.ensure(CARDS);
  b.stageResult('c', 1, 3);
  b.stageResult('c', 2, 3);
  b.stageResult('c', 3, 3);
  assert.deepEqual(told, [['boss', { app: 'c', title: 'C Game' }]]);
});

test('a missed stage remembers the day (for Jesus in the 3D world); a clear does not', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  assert.equal(missedDay(w.s), '');
  w.b.stageResult('c', 2, 3);
  assert.equal(missedDay(w.s), '', 'a clear is not a miss');
  w.b.stageResult('a', 1, 3);
  assert.equal(missedDay(w.s), '2026-10-05');
  assert.deepEqual(JSON.parse(w.s.data[MISSED_KEY]), { v: 1, day: '2026-10-05' });
  assert.equal(missedDay(memory({ boss_missed_v1: '{"day":5}' })), '');
  assert.equal(missedDay(memory({ boss_missed_v1: 'nope' })), '');
  assert.equal(MISSED_KEY, 'boss_missed_v1');
  assert.equal(kindOf(MISSED_KEY), 'replace', 'synced whole, so every tablet knows');
});

test('boss events say which kind and which week they are for (the army and the popup faces read them)', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  assert.deepEqual(w.b.stageResult('c', 1, 3).map((e) => [e.boss, e.week]), [['miss', '2026-10-05']]);
  assert.deepEqual(w.b.stageResult('c', 3, 3).map((e) => [e.boss, e.week]), [['hit', '2026-10-05']]);
  ['a', 'b'].forEach((app) => w.b.stageResult(app, 3, 3));
  assert.deepEqual(w.b.stageResult('d', 3, 3).map((e) => e.boss), ['beat', 'hit']);
});

test('the half popup is for last week\'s boss', () => {
  const w = world(fourApps());
  w.b.ensure(CARDS);
  w.b.stageResult('a', 3, 3);
  w.b.stageResult('c', 3, 3);
  w.now.days(7);
  assert.deepEqual(w.b.ensure(CARDS).map((e) => [e.boss, e.week]), [['half', '2026-10-05']]);
});

test('outcome: what the army shows at the end of a stage', () => {
  const open = { stages: [{ cleared: true }, { cleared: false }] };
  const done = { stages: [{ cleared: true }, { cleared: true }] };
  assert.equal(outcome([], open), 'none');
  assert.equal(outcome([{ boss: 'miss' }], open), 'miss');
  assert.equal(outcome([{ boss: 'hit' }], open), 'hit');
  assert.equal(outcome([{ boss: 'beat' }, { boss: 'hit' }], done), 'down');
  assert.equal(outcome([{ boss: 'hit' }], done), 'down', 'all cleared even if the pay failed');
});
