const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, KEY, SLACK, TEXT } = require(engineFile('clock.js'));

function memory() {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}
function world(start) {
  let t = start || Date.UTC(2026, 9, 4, 2);
  const now = () => t;
  now.add = (ms) => { t += ms; };
  const s = memory();
  return { s, now, c: create(s, now) };
}
const HOUR = 3600000;

test('one hour of slack', () => {
  assert.equal(KEY, 'clock_seen_v1');
  assert.equal(SLACK, HOUR);
});

test('a fresh device is not paused, and the latest time seen rises with the clock', () => {
  const w = world();
  assert.equal(w.c.paused(), false);
  assert.equal(Number(w.s.data[KEY]), w.now());
  w.now.add(5 * HOUR);
  assert.equal(w.c.paused(), false);
  assert.equal(Number(w.s.data[KEY]), w.now());
});

test('a small step back is fine; more than an hour back pauses until the clock catches up', () => {
  const w = world();
  w.c.paused();
  w.now.add(-59 * 60000);
  assert.equal(w.c.paused(), false, '59 minutes back');
  w.now.add(-2 * HOUR);
  assert.equal(w.c.paused(), true, 'about 3 hours back');
  const seen = w.s.data[KEY];
  assert.equal(w.c.paused(), true);
  assert.equal(w.s.data[KEY], seen, 'a paused check never lowers the latest time');
  w.now.add(3 * HOUR);
  assert.equal(w.c.paused(), false, 'caught up');
});

test('the parent fix makes now the latest time', () => {
  const w = world();
  w.c.paused();
  w.now.add(-48 * HOUR);
  assert.equal(w.c.paused(), true);
  w.c.fix();
  assert.equal(w.c.paused(), false);
});

test('broken storage never pauses', () => {
  const now = () => 1000;
  const c = create({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } }, now);
  assert.equal(c.paused(), false);
  const junk = create({ getItem: () => 'soon', setItem() {} }, now);
  assert.equal(junk.paused(), false);
});

test('the banner text', () => {
  assert.match(TEXT.grade5.banner, /^⏰ The tablet's date is earlier than before\. Points and coins are paused until the date is right\.$/);
  assert.match(TEXT.grade2.banner, / · The tablet's date is earlier than before/);
});
