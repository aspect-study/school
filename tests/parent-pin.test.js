const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, merge, KEY, DEFAULT_PIN } = require(engineFile('parent-pin.js'));

function storage() {
  const data = {};
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
}
let clock = 1000;
const now = () => clock++;

function fakeRemote(cloud) {
  const puts = [];
  return { puts, getPin: () => Promise.resolve(cloud), putPin: (rec) => { puts.push(rec); return Promise.resolve(); } };
}

test('the PIN is 0108 until a parent sets one', () => {
  const p = create(storage(), now);
  assert.equal(DEFAULT_PIN, '0108');
  assert.equal(p.get(), '0108');
  assert.ok(p.check('0108'));
  assert.ok(!p.check('1234'));
});

test('set accepts only 4 digits and replaces the default', () => {
  const s = storage();
  const p = create(s, now);
  assert.equal(p.set('12a4'), false);
  assert.equal(p.set('123'), false);
  assert.equal(p.set('12345'), false);
  assert.equal(p.get(), '0108');
  assert.equal(p.set('4321'), true);
  assert.equal(p.get(), '4321');
  assert.ok(!p.check('0108'));
  assert.equal(JSON.parse(s.data[KEY]).pin, '4321');
});

test('a broken saved value reads as the default', () => {
  const s = storage();
  s.setItem(KEY, 'nope');
  assert.equal(create(s, now).get(), '0108');
  s.setItem(KEY, JSON.stringify({ pin: '12', at: 5 }));
  assert.equal(create(s, now).get(), '0108');
});

test('merge keeps the newer copy and ignores broken ones', () => {
  const a = { pin: '1111', at: 5 }, b = { pin: '2222', at: 9 };
  assert.equal(merge(a, b), b);
  assert.equal(merge(b, a), b);
  assert.equal(merge(null, b), b);
  assert.equal(merge(a, null), a);
  assert.equal(merge(null, null), null);
  assert.equal(merge(a, { pin: 'xx', at: 99 }), a);
  assert.equal(merge(a, { pin: '3333', at: 5 }), a, 'a tie keeps the device copy');
});

test('sync takes a newer PIN from the cloud', async () => {
  const s = storage();
  s.setItem(KEY, JSON.stringify({ pin: '1111', at: 5 }));
  const p = create(s, now);
  const r = fakeRemote({ pin: '2222', at: 9 });
  await p.sync(r);
  assert.equal(p.get(), '2222');
  assert.deepEqual(r.puts, []);
});

test('sync sends a newer device PIN to the cloud', async () => {
  const p = create(storage(), now);
  p.set('4321');
  const r = fakeRemote({ pin: '1111', at: 1 });
  await p.sync(r);
  assert.equal(r.puts.length, 1);
  assert.equal(r.puts[0].pin, '4321');
  const empty = fakeRemote(null);
  await p.sync(empty);
  assert.equal(empty.puts[0].pin, '4321');
});

test('sync with nothing anywhere writes nothing', async () => {
  const s = storage();
  const r = fakeRemote(null);
  await create(s, now).sync(r);
  assert.deepEqual(r.puts, []);
  assert.deepEqual(s.data, {});
});

test('sync never fails: a broken remote keeps the device PIN', async () => {
  const p = create(storage(), now);
  p.set('4321');
  await p.sync({ getPin: () => Promise.reject(new Error('offline')), putPin: () => Promise.resolve() });
  await p.sync({ getPin: () => { throw new Error('not loaded'); }, putPin: () => Promise.resolve() });
  await p.sync({ getPin: () => Promise.resolve(null), putPin: () => Promise.reject(new Error('offline')) });
  assert.equal(p.get(), '4321');
});

test('merge rejects a non-finite timestamp', () => {
  const a = { pin: '1111', at: 5 };
  assert.equal(merge(a, { pin: '9999', at: Infinity }), a);
  assert.equal(merge(a, { pin: '9999', at: NaN }), a);
});

test('set returns false when storage throws', () => {
  const s = storage();
  s.setItem = () => { throw new Error('full'); };
  assert.equal(create(s, now).set('4321'), false);
});

test('sync with a broken device value takes the cloud copy', async () => {
  const s = storage();
  s.setItem(KEY, 'nope');
  const p = create(s, now);
  const r = fakeRemote({ pin: '2222', at: 9 });
  await p.sync(r);
  assert.equal(JSON.parse(s.data[KEY]).pin, '2222');
  assert.deepEqual(r.puts, []);
});

test('a PIN set while the cloud read is pending is not overwritten', async () => {
  const s = storage();
  s.setItem(KEY, JSON.stringify({ pin: '1111', at: 5 }));
  const p = create(s, now);
  const puts = [];
  let release;
  const remote = {
    getPin: () => new Promise((res) => { release = () => res({ pin: '2222', at: 9 }); }),
    putPin: (rec) => { puts.push(rec); return Promise.resolve(); },
  };
  const done = p.sync(remote);
  await Promise.resolve();
  p.set('4321');
  release();
  await done;
  assert.equal(p.get(), '4321');
  assert.equal(puts.length, 1);
  assert.equal(puts[0].pin, '4321');
});
