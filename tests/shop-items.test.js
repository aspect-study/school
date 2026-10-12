const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { CATALOG, effectiveCatalog, normalizeShopDoc, SHOP_LIMITS, EMOJI_PICKS } = require(engineFile('wallet.js'));

const doc = (items) => ({ v: 1, items });
const ids = (list) => list.map((i) => i.id);

test('no document gives the defaults, in the same order', () => {
  assert.deepEqual(ids(effectiveCatalog(CATALOG, null)), ids(CATALOG));
  assert.deepEqual(ids(effectiveCatalog(CATALOG, doc({}))), ids(CATALOG));
});

test('hidden built-in items are left out', () => {
  const list = effectiveCatalog(CATALOG, doc({ tatay1: { at: 1, hidden: true } }));
  assert.ok(!ids(list).includes('tatay1'));
  assert.equal(list.length, CATALOG.length - 1);
});

test('a price override re-sorts the list', () => {
  const list = effectiveCatalog(CATALOG, doc({ pesos: { at: 1, coins: 45 } }));
  const i = ids(list).indexOf('pesos');
  assert.equal(list[i].coins, 45);
  assert.equal(list[i - 1].coins <= 45, true);
  assert.equal(list[i + 1].coins >= 45, true);
  assert.equal(list[i - 1].id, 'music', 'sits between the 40 and 50 coin items');
});

test('renaming a built-in item sets renamed and its goal; a price change does not', () => {
  const list = effectiveCatalog(CATALOG, doc({ dessert: { at: 1, name: 'Ice cream' }, movie: { at: 1, coins: 700 } }));
  const dessert = list.find((i) => i.id === 'dessert'), movie = list.find((i) => i.id === 'movie');
  assert.equal(dessert.name, 'Ice cream');
  assert.equal(dessert.goal, 'Ice cream');
  assert.equal(dessert.renamed, true);
  assert.equal(movie.coins, 700);
  assert.equal(movie.renamed, undefined);
});

test('custom items come after defaults at the same price, and deleted ones are gone', () => {
  const list = effectiveCatalog(CATALOG, doc({
    ca1: { at: 1, custom: true, name: 'Bike ride', emoji: '🚲', coins: 200 },
    cb2: { at: 2, custom: true, deleted: true },
  }));
  const i = ids(list).indexOf('ca1');
  assert.equal(list[i - 1].id, 'duo', 'the last default priced 200 comes first');
  assert.ok(!ids(list).includes('cb2'));
  assert.equal(list[i].custom, true);
});

test('bad values are ignored and never throw', () => {
  const bad = normalizeShopDoc({ v: 1, items: {
    music: { at: 1, coins: 5 },
    piggy: { at: 1, coins: 'abc' },
    hero: { at: 1, coins: 10001 },
    ml: { at: 1, name: 'x'.repeat(41) },
    teach: { at: 1, emoji: 'not an emoji' },
    junk: 7,
    c1: { at: 1, custom: true, name: 'No price', emoji: '🎁' },
  } });
  assert.deepEqual(effectiveCatalog(CATALOG, bad).map((i) => i.coins), CATALOG.map((i) => i.coins));
  assert.deepEqual(effectiveCatalog(CATALOG, bad).map((i) => i.name), CATALOG.map((i) => i.name));
  assert.ok(!ids(effectiveCatalog(CATALOG, bad)).includes('c1'));
  assert.deepEqual(normalizeShopDoc('{not json'), { v: 1, items: {} });
  assert.deepEqual(normalizeShopDoc(null), { v: 1, items: {} });
});

test('built-in perDay and deleted flags cannot be overridden', () => {
  const list = effectiveCatalog(CATALOG, normalizeShopDoc({ v: 1, items: { ml: { at: 1, perDay: 5, deleted: true } } }));
  assert.equal(list.find((i) => i.id === 'ml').perDay, 1);
});

test('only the first 40 live custom items are kept', () => {
  const items = {};
  for (let n = 0; n < 45; n++) items['c' + n] = { at: n + 1, custom: true, name: 'Reward ' + n, emoji: EMOJI_PICKS[0], coins: 100 };
  const kept = Object.keys(normalizeShopDoc({ v: 1, items }).items);
  assert.equal(kept.length, SHOP_LIMITS.customMax);
});

test('a custom daily limit must be 1, 2 or 3', () => {
  const entry = (perDay) => ({ v: 1, items: { c1: { at: 1, custom: true, name: 'A', emoji: EMOJI_PICKS[0], coins: 50, perDay } } });
  assert.equal(effectiveCatalog(CATALOG, normalizeShopDoc(entry(2))).find((i) => i.id === 'c1').perDay, 2);
  assert.equal(effectiveCatalog(CATALOG, normalizeShopDoc(entry(9))).find((i) => i.id === 'c1').perDay, undefined);
});
