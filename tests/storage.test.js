const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { space, spaces, OUTBOX } = require(engineFile('storage.js'));

function raw(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    key(i) { return Object.keys(data)[i] ?? null; },
    get length() { return Object.keys(data).length; },
  };
}
let t = 1000;
const now = () => t++;

test('a space keeps its keys under learner/<id>/', () => {
  const r = raw();
  const s = space(r, 'abc', now);
  s.setItem('wallet_v1', '{}');
  assert.equal(r.data['learner/abc/wallet_v1'], '{}');
  assert.equal(s.getItem('wallet_v1'), '{}');
  assert.equal(space(r, 'other', now).getItem('wallet_v1'), null);
});

test('every save and delete is noted in the outbox with its time', () => {
  const r = raw();
  const s = space(r, 'abc', now);
  t = 5000;
  s.setItem('riseshine_points_v1', '10');
  s.setItem('history_v1', '{}');
  s.setItem('riseshine_points_v1', '20');
  s.removeItem('recall_v1');
  assert.deepEqual(s.outbox(), { riseshine_points_v1: 5002, history_v1: 5001, recall_v1: 5003 });
  assert.ok(r.data['learner/abc/' + OUTBOX]);
});

test('the outbox never notes its own sync bookkeeping', () => {
  const s = space(raw(), 'abc', now);
  s.setItem('sync_state_v1', 'x');
  assert.deepEqual(s.outbox(), {});
});

test('a save that fails reaches the caller and is not noted', () => {
  const r = raw();
  r.setItem = () => { throw new Error('full'); };
  const s = space(r, 'abc', now);
  assert.throws(() => s.setItem('wallet_v1', 'x'), /full/);
  assert.deepEqual(s.outbox(), {});
});

test('done() clears only what was not changed again since it was sent', () => {
  const s = space(raw(), 'abc', now);
  t = 100;
  s.setItem('a', '1');
  s.setItem('b', '1');
  const sent = s.outbox();
  t = 200;
  s.setItem('b', '2');
  s.done(sent);
  assert.deepEqual(s.outbox(), { b: 200 });
});

test('keys() lists what a space holds, and spaces() lists every learner on the device', () => {
  const r = raw({ 'learner/a/x': '1', 'learner/a/y': '2', 'learner/b/x': '3', grade5_wallet_v1: 'old', study_fx_muted_v1: '1' });
  assert.deepEqual(space(r, 'a', now).keys().sort(), ['x', 'y']);
  assert.deepEqual(spaces(r).sort(), ['a', 'b']);
});

test('unreadable storage gives an empty space instead of an error', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); }, key() { throw new Error('blocked'); }, length: 3 };
  const s = space(broken, 'abc', now);
  assert.equal(s.getItem('x'), null);
  assert.deepEqual(s.outbox(), {});
  assert.deepEqual(s.keys(), []);
  assert.deepEqual(spaces(broken), []);
  s.removeItem('x');
});

test('put() saves values from the cloud without sending them back', () => {
  const s = space(raw(), 'abc', now);
  s.put('history_v1', '{}');
  assert.equal(s.getItem('history_v1'), '{}');
  s.put('history_v1', null);
  assert.equal(s.getItem('history_v1'), null);
  assert.deepEqual(s.outbox(), {});
});
