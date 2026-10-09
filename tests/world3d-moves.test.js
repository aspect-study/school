const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const M = require(worldFile('moves.js'));
const Emotes = require(worldFile('emotes.js'));
const Items = require(worldFile('items.js'));

const TAU = Math.PI * 2;
const ids = () => Object.keys(M.MOVES);
const turn = (a) => Math.abs(a - Math.round(a / TAU) * TAU);

test('every emote, every prop action and every outfit idle has a move (a new one fails here until drawn)', () => {
  const want = Emotes.EMOTES.map((e) => e.id)
    .concat(Items.inGroup('props').map((p) => M.forProp(p.id)))
    .concat(['idle-princess', 'idle-hero', 'idle-uniform', 'idle-look']);
  assert.deepEqual(ids().sort(), want.sort());
});

test('each move lasts 1.5 to 2.5 s, starts and ends at rest, and stays in safe ranges', () => {
  for (const id of ids()) {
    const len = M.find(id).len;
    assert.ok(len >= 1.5 && len <= 2.5, id + ' len ' + len);
    for (const p of [0, 1]) {
      const o = M.pose(id, p);
      for (const k of M.KEYS) {
        const v = k === 'bry' || k === 'brz' ? turn(o[k]) : Math.abs(o[k]);
        assert.ok(v < 1e-9, id + ' ' + k + ' at ' + p + ' = ' + o[k]);
      }
    }
    for (let i = 0; i <= 40; i++) {
      const o = M.pose(id, i / 40);
      for (const k of M.KEYS) {
        assert.ok(Number.isFinite(o[k]), id + ' ' + k);
        if (k !== 'bry' && k !== 'brz' && k !== 'by') assert.ok(Math.abs(o[k]) <= 3.2, id + ' ' + k + ' = ' + o[k]);
      }
      // by reaches 5.6 only mid-cartwheel, when her feet are over her head.
      assert.ok(o.by >= -1.2 && o.by <= 6, id + ' by');
    }
  }
});

test('effects are known kinds, timed inside the move, and found between two moments', () => {
  for (const id of ids()) {
    for (const [at, kind] of M.find(id).fx) {
      assert.ok(at > 0 && at < 1, id + ' fx at ' + at);
      assert.ok(Object.prototype.hasOwnProperty.call(M.FX, kind), id + ' fx ' + kind);
    }
  }
  assert.deepEqual(M.effectsBetween('use-bubblewand', 0, 0.3), ['bubbles']);
  assert.deepEqual(M.effectsBetween('use-bubblewand', 0.3, 1), ['bubbles', 'bubbles']);
  assert.deepEqual(M.effectsBetween('nope', 0, 1), []);
});

test('the effect table: emoji, count, rise, spread, life', () => {
  for (const [kind, f] of Object.entries(M.FX)) {
    assert.ok(Array.isArray(f.e) && f.e.length, kind);
    assert.ok(f.n >= 1 && f.n <= 10 && f.life > 0 && f.spread > 0 && Number.isFinite(f.vy), kind);
  }
});

test('outfit idles and prop actions are named from the look', () => {
  assert.equal(M.idleFor('princess'), 'idle-princess');
  assert.equal(M.idleFor('hero'), 'idle-hero');
  assert.equal(M.idleFor('uniform'), 'idle-uniform');
  assert.equal(M.idleFor('hoodie'), 'idle-look');
  assert.equal(M.idleFor(''), 'idle-look');
  assert.equal(M.forProp('drum'), 'use-drum');
  assert.equal(M.find('nope'), null);
  assert.equal(M.find('constructor'), null);
});
