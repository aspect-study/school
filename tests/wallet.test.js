process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { create, CATALOG } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));

function memStorage() {
  const data = {};
  const writes = [];
  return {
    data,
    writes,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { writes.push(k); data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

function makeClock() {
  const clock = { ms: new Date(2026, 9, 1, 15, 0).getTime() };
  clock.now = () => clock.ms;
  clock.set = (y, mo, d, h, mi, s) => { clock.ms = new Date(y, mo - 1, d, h, mi, s || 0).getTime(); };
  return clock;
}

function setup(grade) {
  const storage = memStorage();
  const clock = makeClock();
  return { storage, clock, w: create(storage, clock.now, grade || 'grade5') };
}

// The first track() converts every existing point once; this starts a wallet past that step.
function converted(w) {
  w.track({});
  return w;
}

test('a fresh wallet holds the 40-coin welcome gift plus 1 coin per 10 points it already had', () => {
  const { w } = setup();
  const points = { a: 900, b: 455 };
  w.track(points);
  assert.equal(w.balance(points), 40 + 135);
});

test('a wallet saved before the conversion counts all its old points once, keeping what was spent', () => {
  const { w, storage } = setup();
  storage.data.grade5_wallet_v1 = JSON.stringify({ v: 1, baselines: { a: 900, b: 455 }, spent: 40, purchases: [] });
  assert.equal(w.balance({ a: 900, b: 455 }), 0, 'before the lobby converts, old points still earn nothing');
  w.track({ a: 900, b: 455 });
  assert.equal(w.balance({ a: 900, b: 455 }), 40 + 135 - 40);
  w.track({ a: 900, b: 455 });
  assert.equal(w.balance({ a: 900, b: 455 }), 40 + 135 - 40, 'a second track converts nothing again');
});

test('after the conversion, a subject added later starts from its current points', () => {
  const { w } = setup();
  w.track({ a: 100 });
  w.track({ a: 100, b: 700 });
  assert.equal(w.balance({ a: 100, b: 700 }), 50);
  assert.equal(w.balance({ a: 100, b: 730 }), 53);
});

test('balanceStored reads the points of every tracked key from storage', () => {
  const { w, storage } = setup();
  storage.data.a = '300';
  storage.data.b = '55';
  storage.data.other = '9999';
  w.track({ a: 300, b: 55 });
  assert.equal(w.balanceStored(), 40 + 35, 'untracked keys are ignored');
  storage.data.a = '420';
  assert.equal(w.balanceStored(), 40 + 47);
  delete storage.data.b;
  assert.equal(w.balanceStored(), 40 + 42, 'a missing key reads as 0 points');
});

test('points earned after the baseline become 1 coin per 10, rounded down', () => {
  const { w } = setup();
  converted(w);
  w.track({ a: 900, b: 455 });
  assert.equal(w.balance({ a: 1040, b: 455 }), 54);
  assert.equal(w.balance({ a: 1049, b: 455 }), 54);
  assert.equal(w.balance({ a: 1045, b: 460 }), 55, 'floor applies to the sum across keys');
});

test('the earned part never goes below 0 when points drop under the baseline', () => {
  const { w } = setup();
  converted(w);
  w.track({ a: 500 });
  assert.equal(w.balance({ a: 0 }), 40);
});

test('a points key seen for the first time is baselined, so its old points give no coins', () => {
  const { w } = setup();
  converted(w);
  w.track({ a: 100 });
  assert.equal(w.balance({ a: 100, b: 700 }), 40, 'an untracked key earns nothing');
  w.track({ a: 100, b: 700 });
  assert.equal(w.balance({ a: 100, b: 700 }), 40);
  assert.equal(w.balance({ a: 100, b: 730 }), 43);
});

test('track keeps the first baseline and does not move it', () => {
  const { w } = setup();
  converted(w);
  w.track({ a: 100 });
  w.track({ a: 300 });
  assert.equal(w.balance({ a: 300 }), 60);
});

test('buy deducts coins, records the purchase and never lowers points', () => {
  const { w, storage, clock } = setup();
  const points = { a: 0 };
  w.track(points);
  const p = w.buy('ml', { a: 600 });
  assert.deepEqual(p, { item: 'ml', coins: 40, t: clock.ms });
  assert.equal(w.balance({ a: 600 }), 60);
  assert.deepEqual(w.purchases(), [p]);
  assert.equal(JSON.parse(storage.getItem('grade5_wallet_v1')).spent, 40);
});

test('not enough coins: canBuy says how many more are needed and buy changes nothing', () => {
  const { w, storage } = setup();
  w.track({ a: 0 });
  assert.deepEqual(w.canBuy('dinner', { a: 0 }), { ok: false, need: 60, daily: false });
  const before = storage.getItem('grade5_wallet_v1');
  assert.equal(w.buy('dinner', { a: 0 }), null);
  assert.equal(storage.getItem('grade5_wallet_v1'), before);
  assert.deepEqual(w.canBuy('dinner', { a: 600 }), { ok: true, need: 0, daily: false });
});

test('unknown items cannot be bought', () => {
  const { w } = setup();
  assert.equal(w.canBuy('pony', {}).ok, false);
  assert.equal(w.buy('pony', {}), null);
});

test('ML is limited to one per local calendar day and resets at local midnight', () => {
  const { w, clock } = setup();
  const rich = { a: 10000 };
  w.track({ a: 0 });
  clock.set(2026, 10, 1, 23, 59, 0);
  assert.ok(w.buy('ml', rich));
  clock.set(2026, 10, 1, 23, 59, 59);
  assert.deepEqual(w.canBuy('ml', rich), { ok: false, need: 0, daily: true });
  assert.equal(w.buy('ml', rich), null);
  clock.set(2026, 10, 2, 0, 0, 1);
  assert.deepEqual(w.canBuy('ml', rich), { ok: true, need: 0, daily: false });
  assert.ok(w.buy('ml', rich));
});

test('ML bought at 7 AM blocks a second one at 9 AM the same local day (a UTC date would roll over at 8 AM)', () => {
  const { w, clock } = setup();
  const rich = { a: 10000 };
  w.track({ a: 0 });
  clock.set(2026, 10, 3, 7, 0);
  assert.ok(w.buy('ml', rich));
  clock.set(2026, 10, 3, 9, 0);
  assert.equal(w.canBuy('ml', rich).daily, true);
  assert.equal(w.buy('ml', rich), null);
});

test('items without a daily limit can be bought more than once a day', () => {
  const { w } = setup();
  const rich = { a: 10000 };
  w.track({ a: 0 });
  assert.ok(w.buy('dessert', rich));
  assert.ok(w.buy('dessert', rich));
});

test('the wallet only ever writes its own key, never a points key', () => {
  const { w, storage } = setup();
  storage.data.a = '500';
  w.track({ a: 500 });
  w.buy('ml', { a: 1500 });
  w.buy('dinner', { a: 1500 });
  assert.deepEqual([...new Set(storage.writes)], ['grade5_wallet_v1']);
  assert.equal(storage.data.a, '500');
});

test('a failed write spends nothing and buy returns null', () => {
  const { w, storage } = setup();
  w.track({ a: 0 });
  storage.setItem = () => { throw new Error('full'); };
  assert.equal(w.buy('ml', { a: 0 }), null);
  assert.equal(w.balance({ a: 0 }), 40);
});

test('corrupt wallet data reads as a fresh wallet without throwing', () => {
  const { w, storage } = setup();
  storage.data.grade5_wallet_v1 = '{not json';
  assert.equal(w.balance({ a: 10 }), 40);
  storage.data.grade5_wallet_v1 = JSON.stringify({ v: 1, baselines: null, spent: 'x', purchases: 7 });
  assert.equal(w.balance({ a: 10 }), 40);
  assert.deepEqual(w.purchases(), []);
});

test('a missing or invalid grade is refused rather than defaulting to another child\'s wallet', () => {
  const storage = memStorage();
  assert.throws(() => create(storage, Date.now, null));
  assert.throws(() => create(storage, Date.now, 'Grade 5'));
});

test('two wallets on one storage never affect each other', () => {
  const storage = memStorage();
  const clock = makeClock();
  const g2 = create(storage, clock.now, 'grade2');
  const g5 = create(storage, clock.now, 'grade5');
  const p2 = { blockbot_points_v1: 0 };
  const p5 = { pageturners_points_v1: 0 };
  g2.track(p2);
  g5.track(p5);

  const p2Later = { blockbot_points_v1: 1000 };
  assert.equal(g2.balance(p2Later), 140, 'grade 2 earns from its own key');
  assert.equal(g5.balance(p5), 40, 'grade 5 keeps only its own welcome gift');

  assert.ok(g2.buy('ml', p2Later));
  assert.ok(g2.buy('dinner', p2Later));
  assert.equal(g2.balance(p2Later), 0);
  assert.equal(g5.balance(p5), 40, 'grade 2 spending does not touch grade 5');
  assert.deepEqual(g5.purchases(), []);
  assert.deepEqual(g5.canBuy('ml', p5), { ok: true, need: 0, daily: false }, 'grade 2 ML does not block grade 5 ML');
  assert.ok(g5.buy('ml', p5));
  assert.equal(g2.purchases().length, 2);
  assert.equal(g2.balance(p2Later), 0);

  assert.ok(storage.getItem('grade2_wallet_v1'));
  assert.ok(storage.getItem('grade5_wallet_v1'));
  assert.equal(JSON.parse(storage.getItem('grade2_wallet_v1')).spent, 140);
  assert.equal(JSON.parse(storage.getItem('grade5_wallet_v1')).spent, 40);
});

test('the catalog has unique ids, whole-coin prices, and ML is 40 coins once a day', () => {
  const ids = CATALOG.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  CATALOG.forEach((i) => assert.ok(Number.isInteger(i.coins) && i.coins > 0, i.id));
  const ml = CATALOG.find((i) => i.id === 'ml');
  assert.equal(ml.coins, 40);
  assert.equal(ml.perDay, 1);
});

test('earned reports the new points since the baseline and the coins they made', () => {
  const { w } = setup();
  converted(w);
  w.track({ a: 500, b: 0 });
  assert.deepEqual(w.earned({ a: 1500, b: 9 }), { points: 1009, coins: 100, welcome: 40, spent: 0, bonus: 0 });
  w.buy('ml', { a: 1500, b: 9 });
  assert.deepEqual(w.earned({ a: 1500, b: 9 }), { points: 1009, coins: 100, welcome: 40, spent: 40, bonus: 0 });
  assert.deepEqual(w.earned({ a: 0, b: 0 }).points, 0, 'never negative');
});

test('prune drops purchases older than the last 7 local days but keeps the spent total', () => {
  const { w, storage, clock } = setup();
  const rich = { a: 10000 };
  w.track({ a: 0 });
  clock.set(2026, 10, 1, 23, 0);
  w.buy('dessert', rich);
  clock.set(2026, 10, 2, 0, 30);
  w.buy('dinner', rich);
  clock.set(2026, 10, 8, 9, 0);
  w.prune(7);
  assert.deepEqual(w.purchases().map((p) => p.item), ['dinner'], 'Oct 1 is outside Oct 2-8');
  assert.equal(JSON.parse(storage.getItem('grade5_wallet_v1')).spent, 200);
  assert.equal(w.balance(rich), 40 + 1000 - 200, 'pruning never gives coins back');
});

test('prune keeps today\'s ML purchase so the daily limit still holds', () => {
  const { w, storage, clock } = setup();
  const rich = { a: 10000 };
  w.track({ a: 0 });
  w.buy('ml', rich);
  const before = storage.writes.length;
  w.prune(7);
  assert.equal(storage.writes.length, before, 'nothing to prune means no write');
  assert.equal(w.canBuy('ml', rich).daily, true);
});

test('both guides explain the same topics, quote the real ML price and the 10-points-per-coin rate', () => {
  const { GUIDE_TEXT } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));
  const ml = CATALOG.find((i) => i.id === 'ml').coins;
  const g2 = GUIDE_TEXT.grade2.sections(ml), g5 = GUIDE_TEXT.grade5.sections(ml);
  assert.deepEqual(Object.keys(GUIDE_TEXT.grade2).sort(), Object.keys(GUIDE_TEXT.grade5).sort());
  assert.deepEqual(g2.map((s) => s[0]), g5.map((s) => s[0]), 'same icons in the same order');
  for (const sections of [g2, g5]) {
    const text = sections.map((s) => s[2]).join(' ');
    assert.ok(text.includes(' ' + ml + ' coins'), 'quotes the ML price');
    assert.match(text, /10 points/);
    assert.match(text, /140 points = 14 coins/);
  }
});

test('the Grade 2 guide gives every section an English line with the same numbers', () => {
  const { GUIDE_TEXT } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));
  const ml = CATALOG.find((i) => i.id === 'ml').coins;
  const sections = GUIDE_TEXT.grade2.sections(ml);
  assert.ok(GUIDE_TEXT.grade2.titleEn, 'English title');
  for (const s of sections) assert.ok(s[3], s[1] + ' has an English line');
  const english = sections.map((s) => s[3]).join(' ');
  assert.ok(english.includes(' ' + ml + ' coins'), 'quotes the ML price');
  assert.match(english, /140 points = 14 coins/);
  assert.ok(GUIDE_TEXT.grade5.sections(ml).every((s) => !s[3]), 'Grade 5 is already in English');
});

test('spend takes in-quiz power-up coins from the stored balance, never below zero', () => {
  const { w, storage } = setup();
  storage.setItem('a_points', '50');
  w.track({ a_points: 50 });
  assert.equal(w.balanceStored(), 45);
  assert.equal(w.spend(5), true);
  assert.equal(w.balanceStored(), 40);
  assert.equal(w.purchases().length, 0, 'power-ups are not shop purchases');
  assert.equal(w.spend(41), false);
  assert.equal(w.spend(0), false);
  assert.equal(w.spend(40), true);
  assert.equal(w.balanceStored(), 0);
});

test('test-score coins follow the tiers, compared without rounding', () => {
  const { testBonus, TEST_BONUS_TIERS } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));
  assert.deepEqual(TEST_BONUS_TIERS.map((t) => [t.pct, t.coins]), [[100, 50], [90, 40], [80, 30], [0, 10]]);
  assert.equal(testBonus(15, 15), 50);
  assert.equal(testBonus(14, 15), 40, '93.3%');
  assert.equal(testBonus(9, 10), 40, 'exactly 90%');
  assert.equal(testBonus(899, 1000), 30, '89.9%');
  assert.equal(testBonus(4, 5), 30, 'exactly 80%');
  assert.equal(testBonus(799, 1000), 10, '79.9%');
  assert.equal(testBonus(0, 10), 10, 'trying still counts');
  assert.equal(testBonus(11, 10), 0, 'score above total');
  assert.equal(testBonus(5, 0), 0, 'no total');
  assert.equal(testBonus(2.5, 10), 0, 'whole numbers only');
});

test('a bonus adds coins on top of points, welcome gift and spending', () => {
  const { w } = setup();
  converted(w);
  const before = w.balance({});
  assert.equal(w.addBonus(40), true);
  assert.equal(w.balance({}), before + 40);
  assert.equal(w.balanceStored(), before + 40);
  assert.equal(w.earned({}).bonus, 40);
  assert.equal(w.addBonus(0), false);
  assert.equal(w.addBonus(-5), false);
  assert.equal(w.addBonus(2.5), false);
  assert.equal(w.balance({}), before + 40);
});

test('an old wallet without a bonus field reads it as 0', () => {
  const { storage, clock } = setup();
  storage.setItem('grade5_wallet_v1', JSON.stringify({ v: 1, baselines: {}, spent: 0, purchases: [], oldPointsCounted: true }));
  const w = create(storage, clock.now, 'grade5');
  assert.equal(w.earned({}).bonus, 0);
  assert.equal(w.balance({}), 40);
});

test('the coin guide explains resting, typing, the exam and the test bonus in both grades', () => {
  const { GUIDE_TEXT } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));
  for (const grade of ['grade2', 'grade5']) {
    const icons = GUIDE_TEXT[grade].sections(40).map((s) => s[0]);
    for (const icon of ['⏳', '✏️', '🏆', '📝']) assert.ok(icons.includes(icon), grade + ' has ' + icon);
  }
});

test('savedBalance reads the coins a backup would restore without touching storage', () => {
  const { storage, w } = setup();
  const saved = {
    grade5_wallet_v1: JSON.stringify({ v: 1, baselines: { lifelab_points_v1: 0, riseshine_points_v1: 100 }, spent: 30, bonus: 50, purchases: [], oldPointsCounted: true }),
    lifelab_points_v1: '420',
    riseshine_points_v1: '300',
  };
  assert.equal(w.savedBalance(saved), 40 + 62 + 50 - 30);
  assert.equal(w.savedBalance({}), 40);
  assert.deepEqual(storage.writes, []);
});
