const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Emotes = require(worldFile('emotes.js'));
const Items = require(worldFile('items.js'));
const Pets = require(worldFile('pets.js'));

test('11 emotes: wave, clap and cheer free, 8 paid from 80 to 500', () => {
  assert.deepEqual(Emotes.EMOTES.map((e) => [e.id, e.coins]), [
    ['emote-wave', 0], ['emote-clap', 0], ['emote-cheer', 0], ['emote-bow', 80], ['emote-heart', 100], ['emote-giggle', 120],
    ['emote-spin', 150], ['emote-relax', 150], ['emote-dance', 250], ['emote-cartwheel', 400], ['emote-hero', 500]
  ]);
  for (const e of Emotes.EMOTES) {
    assert.equal(e.kind, 'emote');
    assert.ok(e.icon && e.en && e.fil, e.id);
    assert.notEqual(e.fil, e.en, e.id + ' needs a Filipino name');
    assert.doesNotMatch(e.fil, /\bbagay\b|tunog tama/i, e.id);
  }
});

test('emote ids never clash with wardrobe or pet ids (they share one owned list)', () => {
  for (const e of Emotes.EMOTES) {
    assert.equal(Items.find(e.id), null, e.id);
    assert.equal(Pets.find(e.id), null, e.id);
  }
});

test('find, name, owns and usable', () => {
  assert.equal(Emotes.find('emote-spin').en, 'Spin');
  assert.equal(Emotes.find('constructor'), null);
  assert.equal(Emotes.name(Emotes.find('emote-spin'), 'grade5'), 'Spin');
  assert.equal(Emotes.name(Emotes.find('emote-spin'), 'grade2'), 'Ikot · Spin');
  assert.equal(Emotes.owns({}, 'emote-wave'), true);
  assert.equal(Emotes.owns({}, 'emote-spin'), false);
  assert.equal(Emotes.owns({ 'emote-spin': { t: 1, coins: 150 } }, 'emote-spin'), true);
  assert.deepEqual(Emotes.usable({ 'emote-spin': { t: 1, coins: 150 }, 'trick-spin': { t: 1, coins: 100 } }),
    ['emote-wave', 'emote-clap', 'emote-cheer', 'emote-spin']);
});
