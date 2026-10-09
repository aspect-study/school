const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const House = require(worldFile('house.js'));
const F = require(worldFile('furniture.js'));

function memory(initial, failWrites) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { if (failWrites) throw new Error('full'); data[k] = String(v); },
  };
}
function wallet(coins) {
  const w = { coins, bonus: 0, spent: 0 };
  w.balanceStored = () => w.coins;
  w.spend = (n) => { if (w.coins < n) return false; w.coins -= n; w.spent += n; return true; };
  w.addBonus = (n) => { w.coins += n; w.bonus += n; return true; };
  return w;
}
function history() {
  const h = { list: [] };
  h.purchased = (item, name, coins, via) => { h.list.push({ item, name, coins, via }); return 'id'; };
  return h;
}
const aquarium = F.find('home-aquarium');
const base = (o) => Object.assign({ paused: () => false, now: () => 1000, item: aquarium }, o);
const saved = (s) => JSON.parse(s.data.house_v1);
const EMPTY = { v: 1, owned: {}, earned: {}, deskRight: 0, room: null, seen: null };

function entry(bests) {
  const lessons = {}, order = [];
  bests.forEach((b, i) => { order.push('l' + i); lessons['l' + i] = { title: 'L' + i, icon: '', now: b, best: b, paid: b }; });
  return { t: 1, order, lessons };
}
const NO = { streak: 0, boss: false, gold: false, medals: 0, allGold: false, desk: 0 };

test('a fresh device has the empty house; junk is cleaned away', () => {
  assert.equal(House.KEY, 'house_v1');
  assert.deepEqual(House.read(memory()), EMPTY);
  assert.deepEqual(House.read(memory({ house_v1: '{nope' })), EMPTY);
  assert.deepEqual(House.clean({
    v: 1,
    owned: { 'home-aquarium': { t: 5, coins: 600 }, 'home-future': { t: 6, coins: 90 }, bad: 3, zero: { t: 0 } },
    earned: { 'home-gold-frame': 7, nope: 'x', neg: -1 },
    deskRight: '4',
    room: { at: 9, placed: [{ id: 'home-bed', c: 0, r: 3, turn: 1 }, 'junk', { c: 1 }], wall: 5, floor: 'home-floor-tile', stars: 'yes' },
    seen: { at: 9, size: 9, trophies: { 'life-lab': 2, 'math-mastery': 8, x: 'a' } }
  }), {
    v: 1,
    owned: { 'home-aquarium': { t: 5, coins: 600 }, 'home-future': { t: 6, coins: 90 } },
    earned: { 'home-gold-frame': 7 },
    deskRight: 4,
    room: { at: 9, placed: [{ id: 'home-bed', c: 0, r: 3, turn: 1 }], wall: '', floor: 'home-floor-tile', stars: false },
    seen: { at: 9, size: 4, trophies: { 'life-lab': 2 } }
  });
});

test('what she owns: starters always, bought and earned pieces once saved, never an earned one unearned', () => {
  const d = House.clean({ owned: { 'home-aquarium': { t: 5, coins: 600 } }, earned: { 'home-gold-frame': 7 } });
  for (const id of ['home-bed', 'home-wall-pink', 'home-floor-tile', 'home-aquarium', 'home-gold-frame']) assert.equal(House.owns(d, id), true, id);
  for (const id of ['home-tent', 'home-streak-lamp', 'home-star-ceiling', 'nope']) assert.equal(House.owns(d, id), false, id);
});

test('buying spends exactly the price, saves the piece and logs it as a house purchase', () => {
  const s = memory(), w = wallet(1000), h = history();
  assert.deepEqual(House.buy(base({ storage: s, wallet: w, history: h })), { ok: true });
  assert.equal(w.coins, 400);
  assert.deepEqual(House.read(s).owned, { 'home-aquarium': { t: 1000, coins: 600 } });
  assert.deepEqual(h.list, [{ item: 'home-aquarium', name: 'Aquarium', coins: 600, via: 'house' }]);
});

test('a failed save gives the coins back', () => {
  const s = memory({}, true), w = wallet(1000), h = history();
  assert.deepEqual(House.buy(base({ storage: s, wallet: w, history: h })), { ok: false, why: 'failed' });
  assert.equal(w.coins, 1000);
  assert.equal(w.spent, 600, 'coins went first');
  assert.equal(w.bonus, 600, 'and came back through addBonus');
  assert.deepEqual(h.list, []);
});

test('buying is refused while paused, when short, and for owned, starter, earned or unknown pieces', () => {
  const w = wallet(1000);
  assert.deepEqual(House.buy(base({ storage: memory(), wallet: w, paused: () => true })), { ok: false, why: 'paused' });
  assert.deepEqual(House.buy(base({ storage: memory(), wallet: wallet(550) })), { ok: false, why: 'short', need: 50 });
  const s = memory({ house_v1: JSON.stringify({ v: 1, owned: { 'home-aquarium': { t: 1, coins: 600 } } }) });
  assert.deepEqual(House.buy(base({ storage: s, wallet: w })), { ok: false, why: 'owned' });
  assert.deepEqual(House.buy(base({ storage: memory(), wallet: w, item: F.find('home-bed') })), { ok: false, why: 'owned' });
  assert.deepEqual(House.buy(base({ storage: memory(), wallet: w, item: F.find('home-gold-frame') })), { ok: false, why: 'earned' });
  assert.deepEqual(House.buy(base({ storage: memory(), wallet: w, item: { id: 'crown', coins: 1 } })), { ok: false, why: 'unknown' });
  assert.equal(w.coins, 1000);
  // The price is the catalog's, whatever the card says.
  const s2 = memory(), w2 = wallet(1000);
  assert.deepEqual(House.buy(base({ storage: s2, wallet: w2, item: { id: 'home-tent', coins: 1 } })), { ok: true });
  assert.equal(w2.coins, 600);
});

test('buying keeps the rest of the house as it was', () => {
  const s = memory({ house_v1: JSON.stringify({ v: 1, earned: { 'home-gold-frame': 3 }, deskRight: 5, room: { at: 2, placed: [], wall: 'home-wall-blue', floor: 'home-floor-wood', stars: false } }) });
  House.buy(base({ storage: s, wallet: wallet(1000) }));
  const d = saved(s);
  assert.deepEqual([d.earned, d.deskRight, d.room.wall], [{ 'home-gold-frame': 3 }, 5, 'home-wall-blue']);
});

test('her room: the starters on a new device, repaired at this size once saved', () => {
  const s = memory();
  assert.deepEqual(House.roomOf(House.read(s), 4).placed.map((p) => p.id), ['home-bed', 'home-rug-round']);
  assert.equal(House.saveRoom(s, { size: 4, placed: [{ id: 'home-bed', c: 0, r: 3, turn: 1 }, { id: 'home-tent', c: 2, r: 2, turn: 0 }], wall: 'home-wall-blue', floor: 'home-floor-tile', stars: false }, 77), true);
  const d = House.read(s);
  assert.deepEqual(d.room, { at: 77, placed: [{ id: 'home-bed', c: 0, r: 3, turn: 1 }, { id: 'home-tent', c: 2, r: 2, turn: 0 }], wall: 'home-wall-blue', floor: 'home-floor-tile', stars: false });
  assert.deepEqual(House.roomOf(d, 4), { size: 4, placed: [{ id: 'home-bed', c: 0, r: 3, turn: 1 }], wall: 'home-wall-blue', floor: 'home-floor-tile', stars: false }, 'the tent is not hers');
  assert.equal(House.saveRoom(memory({}, true), { placed: [], wall: '', floor: '' }, 1), false);
});

test("roomOf: a boy with no room gets blue walls; a girl's stays pink", () => {
  assert.equal(House.roomOf(House.read(memory({})), 4, true).wall, 'home-wall-blue');
  assert.equal(House.roomOf(House.read(memory({})), 4).wall, 'home-wall-pink');
});

test('facts from her medals, streak, boss and desk', () => {
  const mastery = { v: 1, apps: { 'life-lab': entry([3, 3]), 'math-mastery': entry([1, 3, 0]), 'block-bot': entry([3]) } };
  assert.deepEqual(House.facts({ mastery, grade: 'grade5', streak: 7, boss: { week: '2026-W41', stages: [{ app: 'a', cleared: true }], paid: [] }, deskRight: 3 }),
    { streak: 7, boss: true, gold: true, medals: 4, allGold: true, desk: 3 });
  assert.deepEqual(House.facts({ mastery: { v: 1, apps: { 'math-mastery': entry([1, 2]) } }, grade: 'grade5', streak: { days: 2 }, boss: { stages: [{ app: 'a', cleared: true }, { app: 'b', cleared: false }], paid: ['2026-W40|half'] } }),
    { streak: 2, boss: false, gold: false, medals: 2, allGold: false, desk: 0 });
  assert.equal(House.facts({ grade: 'grade5', boss: { stages: [], paid: ['2026-W39|full'] } }).boss, true, 'a full boss paid in an earlier week');
  assert.deepEqual(House.facts({ grade: 'grade2', mastery: { v: 1, apps: { 'life-lab': entry([3]) } } }), NO, 'only her grade\'s subjects count');
  assert.deepEqual(House.facts({}), NO);
});

test('each unlock rule at its edge', () => {
  const d = House.clean({});
  const on = (f, grade) => House.unlocks(d, Object.assign({}, NO, f), grade || 'grade5');
  assert.deepEqual(on({}), []);
  assert.deepEqual(on({ streak: 6 }), []);
  assert.deepEqual(on({ streak: 7 }), ['home-streak-lamp']);
  assert.deepEqual(on({ boss: true }), ['home-boss-rug']);
  assert.deepEqual(on({ gold: true }), ['home-gold-frame']);
  assert.deepEqual(on({ medals: 49 }), []);
  assert.deepEqual(on({ medals: 50 }), ['home-book-tower']);
  assert.deepEqual(on({ medals: 29 }, 'grade2'), []);
  assert.deepEqual(on({ medals: 30 }, 'grade2'), ['home-book-tower']);
  assert.deepEqual(on({ allGold: true }), ['home-star-ceiling']);
  assert.deepEqual(on({ desk: 19 }), []);
  assert.deepEqual(on({ desk: 20 }), ['home-hoot-plush']);
  assert.deepEqual(on({ streak: 9, boss: true, gold: true, medals: 60, allGold: true, desk: 25 }),
    ['home-streak-lamp', 'home-boss-rug', 'home-gold-frame', 'home-book-tower', 'home-star-ceiling', 'home-hoot-plush']);
});

test('an earned piece stays hers after its condition ends, and is not unlocked twice', () => {
  const s = memory();
  const ids = House.unlocks(House.read(s), Object.assign({}, NO, { streak: 7 }), 'grade5');
  assert.equal(House.earn(s, ids, 500), true);
  assert.deepEqual(House.read(s).earned, { 'home-streak-lamp': 500 });
  assert.deepEqual(House.unlocks(House.read(s), Object.assign({}, NO, { streak: 8 }), 'grade5'), []);
  assert.equal(House.owns(House.read(s), 'home-streak-lamp'), true, 'the streak ended, the lamp stays');
  House.earn(s, ['home-streak-lamp'], 900);
  assert.equal(House.read(s).earned['home-streak-lamp'], 500, 'the first time is kept');
});

test('the desk counts right answers', () => {
  const s = memory();
  assert.equal(House.addDeskRight(s), 1);
  assert.equal(House.addDeskRight(s), 2);
  assert.equal(House.read(s).deskRight, 2);
  assert.equal(House.addDeskRight(memory({}, true)), 0, 'not saved, not counted');
});

test('snapshot writes what she saw going in', () => {
  const s = memory();
  assert.equal(House.snapshot(s, 5, { 'life-lab': 2, 'math-mastery': 0 }, 1234), true);
  assert.deepEqual(saved(s).seen, { at: 1234, size: 5, trophies: { 'life-lab': 2, 'math-mastery': 0 } });
});
