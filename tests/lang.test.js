const test = require('node:test');
const assert = require('node:assert/strict');
const Lang = require('../web/engine/lang.js');

test('en keeps the English half of a pair, whichever side it is on, and the leading emoji', () => {
  assert.equal(Lang.en('🪙 Tindahan · Shop'), '🪙 Shop');
  assert.equal(Lang.en('🔊 Sound on · May tunog'), '🔊 Sound on');
  assert.equal(Lang.en('Kumusta! Pindutin ang laruan. · Hello! Tap a toy.'), 'Hello! Tap a toy.');
  assert.equal(Lang.en('Mapa ng bayan · Map of the village'), 'Map of the village');
  assert.equal(Lang.en('No pair here'), 'No pair here');
});

test('localize makes strings, nested objects, arrays and functions English', () => {
  const t = Lang.localize({ a: 'Tama! · Right!', n: { b: 'Mga tunog · Sounds' }, l: ['Salamat · Thanks'], f: (x) => 'Natalo mo si ' + x + '! · You beat ' + x + '!' });
  assert.equal(t.a, 'Right!');
  assert.equal(t.n.b, 'Sounds');
  assert.deepEqual(t.l, ['Thanks']);
  assert.equal(t.f('Rex'), 'You beat Rex!');
});

test('the helper switch is off by default and remembered', () => {
  const store = {};
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  try {
    const fresh = Lang.helper();
    assert.equal(fresh, false);
    Lang.setHelper(true);
    assert.equal(store[Lang.KEY], 'on');
    assert.equal(Lang.helper(), true);
    Lang.setHelper(false);
    assert.equal(Lang.helper(), false);
  } finally { delete global.localStorage; }
});

test('filipinoGame is false outside a browser page', () => {
  assert.equal(Lang.filipinoGame(), false);
});
