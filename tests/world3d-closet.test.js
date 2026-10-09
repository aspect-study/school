const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Closet = require(worldFile('closet.js'));
const Items = require(worldFile('items.js'));

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
const crown = Items.find('crown');
const base = (o) => Object.assign({ paused: () => false, now: () => 1000, item: crown }, o);

test('a fresh device owns nothing; broken data reads as nothing', () => {
  assert.deepEqual(Closet.read(memory()), {});
  assert.deepEqual(Closet.read(memory({ wardrobe_v1: '{nope' })), {});
  assert.deepEqual(Closet.read(memory({ wardrobe_v1: JSON.stringify({ v: 1, owned: { cap: { t: 5, coins: 50 }, bad: 3, zero: { t: 0 } } }) })), { cap: { t: 5, coins: 50 } });
  assert.equal(Closet.KEY, 'wardrobe_v1');
});

test('buying spends exactly the price, saves the item and logs it as a wardrobe purchase', () => {
  const s = memory(), w = wallet(1000), h = history();
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: h })), { ok: true });
  assert.equal(w.coins, 300);
  assert.deepEqual(Closet.read(s), { crown: { t: 1000, coins: 700 } });
  assert.deepEqual(h.list, [{ item: 'crown', name: 'Crown', coins: 700, via: 'wardrobe' }]);
});

test('not enough coins buys nothing and says how many more', () => {
  const s = memory(), w = wallet(650), h = history();
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: h })), { ok: false, why: 'short', need: 50 });
  assert.equal(w.coins, 650);
  assert.deepEqual(Closet.read(s), {});
  assert.deepEqual(h.list, []);
});

test('an item she owns is never bought twice', () => {
  const s = memory({ wardrobe_v1: JSON.stringify({ v: 1, owned: { crown: { t: 1, coins: 700 } } }) }), w = wallet(1000);
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: history() })), { ok: false, why: 'owned' });
  assert.equal(w.coins, 1000);
});

test('while the date guard pauses coins, nothing can be bought', () => {
  const w = wallet(1000);
  assert.deepEqual(Closet.buy(base({ storage: memory(), wallet: w, history: history(), paused: () => true })), { ok: false, why: 'paused' });
  assert.equal(w.coins, 1000);
});

test('if the wallet refuses at the last moment, nothing is saved', () => {
  const s = memory(), w = wallet(1000);
  w.spend = () => false;
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: history() })), { ok: false, why: 'short', need: 0 });
  assert.deepEqual(Closet.read(s), {});
});

test('a failed save gives the coins back and logs nothing', () => {
  const w = wallet(1000), h = history();
  assert.deepEqual(Closet.buy(base({ storage: memory({}, true), wallet: w, history: h })), { ok: false, why: 'failed' });
  assert.equal(w.coins, 1000);
  assert.equal(w.bonus, 700);
  assert.deepEqual(h.list, []);
});

test('a broken history never undoes a good buy', () => {
  const s = memory(), w = wallet(1000);
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: { purchased: () => { throw new Error('x'); } } })), { ok: true });
  assert.ok(Closet.read(s).crown);
});

test('a pet bought at Mang Kiko\'s goes in the same owned list and is logged as from the pet stall', () => {
  const Pets = require(worldFile('pets.js'));
  const s = memory(), w = wallet(1000), h = history();
  assert.deepEqual(Closet.buy(base({ storage: s, wallet: w, history: h, item: Pets.find('panda'), via: 'pets' })), { ok: true });
  assert.equal(w.coins, 500);
  assert.deepEqual(Closet.read(s), { panda: { t: 1000, coins: 500 } });
  assert.deepEqual(h.list, [{ item: 'panda', name: 'Panda', coins: 500, via: 'pets' }]);
});

test('a trick is bought like a pet: coins first, owned, logged from the pet stall', () => {
  const Pets = require(worldFile('pets.js'));
  const s = memory(), w = wallet(150), h = history();
  const r = Closet.buy(base({ storage: s, wallet: w, history: h, item: Pets.find('trick-spin'), via: 'pets' }));
  assert.deepEqual(r, { ok: true });
  assert.equal(w.coins, 50);
  assert.ok(Closet.read(s)['trick-spin']);
  assert.deepEqual(h.list, [{ item: 'trick-spin', name: 'Spin', coins: 100, via: 'pets' }]);
});
