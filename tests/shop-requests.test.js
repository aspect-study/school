const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, KEY } = require(engineFile('shop-requests.js'));

const DAY = 86400000;
const ITEM = { id: 'ml', name: 'Mobile Legends', emoji: '🎮', coins: 40 };
const MOVIE = { id: 'movie', name: 'Movie night', emoji: '🎬', coins: 200 };

function setup() {
  const data = {};
  const store = { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  const clock = { t: new Date(2026, 9, 2, 15, 0).getTime() };
  return { store, clock, R: create(store, () => clock.t++) };
}

test('ask saves a waiting request with the item, its name and its price', () => {
  const { R } = setup();
  const id = R.ask(ITEM);
  assert.ok(id);
  const r = R.get(id);
  assert.equal(r.status, 'waiting');
  assert.equal(r.item, 'ml');
  assert.equal(r.name, 'Mobile Legends');
  assert.equal(r.coins, 40);
  assert.deepEqual(R.waiting().map((x) => x.id), [id]);
});

test('a request is answered once, only while it waits', () => {
  const { R } = setup();
  const id = R.ask(ITEM);
  assert.equal(R.answer(id, true), true);
  assert.equal(R.answer(id, false), false);
  assert.equal(R.get(id).status, 'approved');
  assert.deepEqual(R.waiting(), []);
  const no = R.ask(ITEM);
  assert.equal(R.answer(no, false), true);
  assert.equal(R.get(no).status, 'declined');
});

test('settle buys only approved requests: done when bought, short when not', () => {
  const { R } = setup();
  const a = R.ask(ITEM), b = R.ask(MOVIE), c = R.ask(ITEM), d = R.ask(ITEM);
  R.answer(a, true); R.answer(b, true); R.answer(d, false);
  const asked = [];
  const out = R.settle((r) => { asked.push(r.id); return r.item === 'ml' ? 'done' : 'short'; });
  assert.deepEqual(asked.sort(), [a, b].sort());
  assert.deepEqual(out.map((x) => x.status).sort(), ['done', 'short']);
  assert.equal(R.get(a).status, 'done');
  assert.equal(R.get(b).status, 'short');
  assert.equal(R.get(c).status, 'waiting');
  assert.equal(R.get(d).status, 'declined');
  assert.deepEqual(R.settle(() => 'done'), [], 'nothing is bought twice');
});

test('cancel works while waiting or approved, not after', () => {
  const { R } = setup();
  const a = R.ask(ITEM), b = R.ask(ITEM), c = R.ask(ITEM);
  R.answer(b, true);
  R.answer(c, true);
  R.settle(() => 'done');
  assert.equal(R.cancel(a), true);
  assert.equal(R.get(a).status, 'cancelled');
  assert.equal(R.cancel(c), false);
  assert.equal(R.get(c).status, 'done');
  const e = R.ask(ITEM);
  R.answer(e, true);
  assert.equal(R.cancel(e), true);
});

test("yesterday's waiting request is expired and can't be approved", () => {
  const { R, clock } = setup();
  const id = R.ask(ITEM);
  clock.t += DAY;
  assert.equal(R.get(id).status, 'expired');
  assert.deepEqual(R.waiting(), []);
  assert.equal(R.answer(id, true), false);
});

test('requests older than 7 days are dropped when anything is saved', () => {
  const { R, clock } = setup();
  const old = R.ask(ITEM);
  clock.t += 8 * DAY;
  const fresh = R.ask(ITEM);
  assert.equal(R.get(old), null);
  assert.ok(R.get(fresh));
});

test('list shows every request, newest first', () => {
  const { R } = setup();
  const a = R.ask(ITEM), b = R.ask(MOVIE);
  assert.deepEqual(R.list().map((r) => r.id), [b, a]);
});

test('a broken saved value starts empty', () => {
  const { store, R } = setup();
  store.data[KEY] = '{oops';
  assert.deepEqual(R.list(), []);
  assert.ok(R.ask(ITEM));
  assert.equal(R.list().length, 1);
});

test('settle stops buying when the result cannot be saved', () => {
  const { store, R } = setup();
  const a = R.ask(ITEM), b = R.ask(ITEM);
  R.answer(a, true);
  R.answer(b, true);
  store.setItem = () => { throw new Error('full'); };
  let buys = 0;
  const out = R.settle(() => { buys++; return 'done'; });
  assert.ok(buys <= 1);
  assert.deepEqual(out, []);
});
