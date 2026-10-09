const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Cheer = require(worldFile('cheer.js'));

const deps = (o) => ({
  tally: () => o.tally,
  boss: () => o.boss,
  list: (app) => (o.list || []).filter((e) => e.app === app),
});
const T0 = { gold: 1, silver: 2, bronze: 3 };
const BOSS0 = { week: '2026-10-05', stages: [{ app: 'life-lab', cleared: true }, { app: 'page-turners', cleared: false }] };
const quiz = (t, extra) => Object.assign({ type: 'quiz', app: 'life-lab', finished: true, t }, extra);

test('before: when she left, this week\'s cleared stages and the game\'s medals (none for the fort)', () => {
  const d = deps({ tally: Object.assign({ total: 9 }, T0), boss: BOSS0 });
  assert.deepEqual(Cheer.before('life-lab', d, 1000), { at: 1000, week: '2026-10-05', cleared: 1, tally: T0 });
  assert.deepEqual(Cheer.before('boss', d, 1000), { at: 1000, week: '2026-10-05', cleared: 1 });
  const broken = { tally: () => { throw new Error('x'); }, boss: () => null, list: () => null };
  assert.deepEqual(Cheer.before('life-lab', broken, 5), { at: 5, week: '', cleared: 0 });
});

function result(was, now, app = 'life-lab') {
  return Cheer.pick(was, Cheer.after(app, was, deps(now)));
}
const was = { at: 1000, week: '2026-10-05', cleared: 1, tally: T0 };

test('a boss stage cleared this week is the biggest', () => {
  const boss = { week: '2026-10-05', stages: [{ app: 'a', cleared: true }, { app: 'b', cleared: true }] };
  assert.deepEqual(result(was, { tally: { gold: 2, silver: 1, bronze: 3 }, boss, list: [quiz(2000)] }), { level: 'boss' });
  assert.deepEqual(result({ at: 1, week: '2026-10-05', cleared: 0 }, { boss }, 'boss'), { level: 'boss' }, 'back at the fort');
  const newWeek = { week: '2026-10-12', stages: [{ app: 'a', cleared: true }, { app: 'b', cleared: true }] };
  assert.deepEqual(result(was, { tally: T0, boss: newWeek }), { level: 'hello' }, 'a new week is not a stage she cleared');
});

test('a medal: the highest level that went up', () => {
  assert.deepEqual(result(was, { tally: { gold: 1, silver: 3, bronze: 2 }, boss: BOSS0 }), { level: 'medal', medal: '🥈' }, 'bronze to silver');
  assert.deepEqual(result(was, { tally: { gold: 1, silver: 2, bronze: 4 }, boss: BOSS0 }), { level: 'medal', medal: '🥉' }, 'a new bronze');
  assert.deepEqual(result(was, { tally: { gold: 2, silver: 2, bronze: 3 }, boss: BOSS0 }), { level: 'medal', medal: '🥇' }, 'a new gold');
  assert.deepEqual(result(was, { tally: { gold: 2, silver: 2, bronze: 4 }, boss: BOSS0, list: [quiz(2000)] }), { level: 'medal', medal: '🥇' });
});

test('a finished round of that game since she left, else a hello', () => {
  assert.deepEqual(result(was, { tally: T0, boss: BOSS0, list: [quiz(2000)] }), { level: 'round' });
  assert.deepEqual(result(was, { tally: T0, boss: BOSS0, list: [quiz(999)] }), { level: 'hello' }, 'before she left');
  assert.deepEqual(result(was, { tally: T0, boss: BOSS0, list: [quiz(2000, { finished: false })] }), { level: 'hello' }, 'left early');
  assert.deepEqual(result(was, { tally: T0, boss: BOSS0, list: [quiz(2000, { app: 'page-turners' })] }), { level: 'hello' }, 'another game');
  assert.deepEqual(result(was, { tally: T0, boss: BOSS0, list: [quiz(2000, { type: 'lesson' })] }), { level: 'hello' });
});

test('missing or broken data is a hello', () => {
  const now = Cheer.after('life-lab', was, deps({ tally: T0, boss: BOSS0 }));
  assert.deepEqual(Cheer.pick(null, now), { level: 'hello' });
  assert.deepEqual(Cheer.pick({ at: 'soon' }, now), { level: 'hello' });
  assert.deepEqual(Cheer.pick(was, null), { level: 'hello' });
  assert.deepEqual(Cheer.pick({ at: 1, week: '', cleared: 0 }, { week: '', cleared: 3, tally: null, rounds: 0 }), { level: 'hello' }, 'no boss week');
  assert.deepEqual(Cheer.pick({ at: 1, tally: { gold: 'x' } }, { tally: { gold: 1, silver: 0, bronze: 0 }, rounds: 0 }), { level: 'medal', medal: '🥇' });
  const thrower = { tally: () => { throw new Error('x'); }, boss: () => { throw new Error('x'); }, list: () => { throw new Error('x'); } };
  assert.deepEqual(Cheer.pick(was, Cheer.after('life-lab', was, thrower)), { level: 'hello' });
});

test('plan: the move, the bubble, a star burst and a sound for each level', () => {
  const own = (...ids) => Object.fromEntries(ids.map((id) => [id, { t: 1, coins: 1 }]));
  assert.deepEqual(Cheer.plan({ level: 'boss' }, {}), { trick: 'trick-twirl', len: 1.2, emoji: '⚔️', burst: true, sound: 'allRead' });
  assert.deepEqual(Cheer.plan({ level: 'medal', medal: '🥈' }, own('trick-backflip')), { trick: 'trick-backflip', len: 1.2, emoji: '🥈', burst: true, sound: 'allRead' });
  assert.deepEqual(Cheer.plan({ level: 'medal', medal: '🥉' }, {}), { trick: 'trick-jump', len: 1.2, emoji: '🥉', burst: true, sound: 'allRead' });
  assert.deepEqual(Cheer.plan({ level: 'medal', medal: '🥇' }, own('trick-dance')).len, 2);
  assert.deepEqual(Cheer.plan({ level: 'round' }, {}), { trick: 'trick-jump', len: 1.2, emoji: '⭐', burst: true, sound: 'cardRead' });
  assert.deepEqual(Cheer.plan({ level: 'hello' }, {}), { trick: null, len: 0, emoji: '💖', burst: false, sound: 'cardRead' });
  assert.deepEqual(Cheer.plan(null, null), Cheer.plan({ level: 'hello' }, {}));
});
