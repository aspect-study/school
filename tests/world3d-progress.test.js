const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const P = require(worldFile('progress.js'));
const L = require(worldFile('layout.js'));
const { SUBJECTS } = require(engineFile('subjects.js'));
const World = require(engineFile('world.js'));
const Guide = require(engineFile('guide.js'));

function deps(over) {
  return Object.assign({ now: () => 0, tally: () => null, due: () => ({}), quests: () => [], boss: () => ({}), canAfford: () => false, guide: () => null }, over);
}
const cards5 = () => P.cards('grade5', L, SUBJECTS);

test('cards follow the lobby: subject names and the lobby card links', () => {
  assert.deepEqual(cards5()[7], { app: 'life-lab', name: 'Science', emoji: '🔬', href: '../subjects/grade-5/science/index.html?reset=1' });
  assert.equal(P.cards('grade2', L, SUBJECTS)[0].name, 'Math');
  assert.equal(P.cards('grade5', L, null)[7].name, 'Science', 'without engine/subjects.js the sign is the name');
});

test('snapshot: levels, markers, the fort and the guide step with its link', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    tally: (app) => (app === 'life-lab' ? { gold: 2, silver: 0, bronze: 0, total: 2 } : null),
    due: () => ({ 'page-turners': 3 }),
    boss: () => ({ stages: [{ app: 'life-lab', cleared: false }, { app: 'math-mastery', cleared: true }] }),
    guide: () => ({ kind: 'boss', app: 'life-lab', text: 'x' }),
  }) });
  assert.equal(s.apps['life-lab'].level, 3);
  assert.deepEqual(s.apps['life-lab'].markers, [{ kind: 'boss' }]);
  assert.deepEqual(s.apps['page-turners'].markers, [{ kind: 'due', count: 3 }]);
  assert.deepEqual(s.fort, { cleared: 1, total: 2, beaten: false, next: 'life-lab', href: '../subjects/grade-5/science/index.html?reset=1&boss=1',
    week: '', minions: 3, finale: false });
  assert.equal(s.target, 'life-lab');
  assert.equal(s.stepHref, '../subjects/grade-5/science/index.html?reset=1&boss=1');
  assert.equal(P.doorHref(s, 'life-lab', 'plain'), s.stepHref, 'the door the guide points at keeps the guide\'s link');
  assert.equal(P.doorHref(s, 'math-mastery', 'plain'), 'plain');
  assert.equal(P.doorHref(null, 'math-mastery', 'plain'), 'plain');
});

test('all done: no fort stage, and the shop is the target when she can afford a reward', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    guide: () => ({ kind: 'done', app: null, shop: true }), canAfford: () => true,
  }) });
  assert.deepEqual(s.fort, { cleared: 0, total: 0, beaten: false, next: null, href: null, week: '', minions: 0, finale: false });
  assert.equal(s.target, 'shop');
  assert.equal(s.stepHref, null);
  assert.equal(s.shop.sparkle, true);
});

test('broken engines give a plain world, never an error', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    boss: () => { throw new Error('x'); }, guide: () => { throw new Error('x'); },
  }) });
  assert.equal(s.step, null);
  assert.equal(s.target, null);
  assert.equal(s.fort.next, null);
});

test('canAfford asks the wallet with each subject\'s stored points', () => {
  const seen = [];
  const wallet = { catalog: [{ id: 'a' }, { id: 'b' }], canBuy: (id, pts) => { seen.push([id, pts]); return { ok: id === 'b' }; } };
  const store = { getItem: (k) => (k === 'x_points_v1' ? '120' : null) };
  assert.equal(P.canAfford(wallet, store, ['x_points_v1', 'y_points_v1']), true);
  assert.deepEqual(seen[0], ['a', { x_points_v1: 120, y_points_v1: 0 }]);
  assert.equal(P.canAfford(null, store, []), false);
});

test('fill puts numbers into the words', () => {
  assert.equal(P.fill('{c} of {n}', { c: 1, n: 3 }), '1 of 3');
  assert.equal(P.fill('{c} of {x}', { c: 1 }), '1 of {x}');
});

test('snapshot info: each subject\'s boss stage, quest, due count and medal tally, before markers are cut to two', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    tally: (app) => (app === 'life-lab' ? { gold: 1, silver: 1, bronze: 0, total: 2 } : null),
    due: () => ({ 'life-lab': 4 }),
    quests: () => [{ app: 'life-lab', done: false }, { app: 'page-turners', done: true }],
    boss: () => ({ stages: [{ app: 'life-lab', cleared: false }] }),
  }) });
  assert.deepEqual(s.info['life-lab'], { boss: true, quest: true, reviewQuest: false, due: 4, tally: { gold: 1, silver: 1, bronze: 0, total: 2 } });
  assert.deepEqual(s.info['page-turners'], { boss: false, quest: false, reviewQuest: false, due: 0, tally: { gold: 0, silver: 0, bronze: 0, total: 0 } });
  assert.equal(s.apps['life-lab'].markers.length, 2, 'the map still shows two markers');
});

test('snapshot info: an open review quest stays for the game, so the world does not answer its questions', () => {
  const s = P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, deps: deps({
    due: () => ({ 'life-lab': 3, 'page-turners': 2, 'math-mastery': 1 }),
    quests: () => [
      { kind: 'review', app: 'life-lab', done: false },
      { kind: 'review', app: 'page-turners', done: true },
      { kind: 'lesson', app: 'math-mastery', done: false },
    ],
  }) });
  assert.equal(s.info['life-lab'].reviewQuest, true);
  assert.equal(s.info['page-turners'].reviewQuest, false, 'a finished review quest frees the questions');
  assert.equal(s.info['math-mastery'].reviewQuest, false, 'other quests are not review quests');
  assert.equal(s.info['math-mastery'].quest, true);
});

test('points reads each subject\'s stored points', () => {
  const store = { getItem: (k) => ({ a: '30', b: 'x' })[k] ?? null };
  assert.deepEqual(P.points(store, ['a', 'b', 'c']), { a: 30, b: 0, c: 0 });
});

test('fort minions: 3 for each open stage, at most 12', () => {
  const snap = (stages) => P.snapshot({ cards: cards5(), status: World.status, link: Guide.link, stageSize: 3,
    deps: deps({ boss: () => ({ week: '2026-10-05', stages }) }) }).fort;
  const open = (app) => ({ app, cleared: false });
  assert.equal(snap([open('life-lab'), { app: 'math-mastery', cleared: true }]).minions, 3);
  assert.equal(snap(['life-lab', 'math-mastery', 'page-turners', 'rise-shine', 'wikaharian'].map(open)).minions, 12);
  assert.equal(snap([]).minions, 0);
});

test('the finale: all stages cleared and not seen this week; Mimi sends her to the fort, in the world only', () => {
  const beaten = { week: '2026-10-05', stages: [{ app: 'life-lab', cleared: true }, { app: 'math-mastery', cleared: true }] };
  const base = { cards: cards5(), status: World.status, link: Guide.link, stageSize: 3, finaleText: 'Go see the boss!',
    deps: deps({ boss: () => beaten, guide: () => ({ kind: 'review', app: 'page-turners', text: 'Review!' }) }) };
  const s = P.snapshot(base);
  assert.equal(s.fort.finale, true);
  assert.equal(s.fort.week, '2026-10-05');
  assert.equal(s.fort.minions, 0);
  assert.deepEqual(s.step, { kind: 'bossWin', text: 'Go see the boss!' }, "before the guide's own step");
  assert.equal(s.target, 'boss');
  assert.equal(s.stepHref, null);
  assert.equal(P.doorHref(s, 'page-turners', 'plain'), 'plain', 'no door keeps a link for the finale');
  const seen = P.snapshot(Object.assign({}, base, { bossWin: '2026-10-05' }));
  assert.equal(seen.fort.finale, false, 'once a week');
  assert.equal(seen.step.kind, 'review', 'then the guide again');
  const none = P.snapshot(Object.assign({}, base, { deps: deps({ boss: () => ({ week: '2026-10-05', stages: [] }) }) }));
  assert.equal(none.fort.finale, false, 'no boss, no finale');
});
