const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Look = require(worldFile('look.js'));
const NO_GEAR = { hat: '', neck: '', back: '', glasses: '' };
const PET_DEFAULTS = { petColor: 0, petSpot: 'walk', petWear: NO_GEAR };

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

test('a fresh device has no character yet', () => {
  const r = Look.read(memory());
  assert.equal(r.made, false);
  assert.deepEqual(r.look, Look.DEFAULT);
  assert.equal(Look.KEY, 'avatar_v1');
});

const EMPTY = { clothes: '', hat: '', glasses: '', back: '', neck: '', sticker: '', paint: '', dye: '', shimmer: '', prop: '' };

test('unknown or broken values clean to the defaults; the pet name is trimmed and safe', () => {
  const raw = { v: 1, body: 'dragon', skin: 10, hair: 'bob', hairColor: -1, outfit: 1.5, pet: '<cat>', petName: '<b>Bantay the Brave Dog</b>', t: 7,
    petColor: 7, petSpot: 'roof', petWear: { hat: 'pet-crown', neck: '<b>', zzz: 'x' },
    eyes: 'wink', freckles: 'yes', blush: 0, wear: { hat: 'crown', back: '<b>', clothes: 7, zzz: 'x' } };
  const r = Look.read(memory({ avatar_v1: JSON.stringify(raw) }));
  assert.deepEqual(r.look, Object.assign({ v: 1, body: 'girl', skin: 0, hair: 'bob', hairColor: 0, outfit: 0, pet: 'chick', eyes: 'round', freckles: false, blush: true,
    petName: 'bBantay the', wear: Object.assign({}, EMPTY, { hat: 'crown' }), t: 7 }, PET_DEFAULTS, { petWear: Object.assign({}, NO_GEAR, { hat: 'pet-crown' }) }));
  assert.equal(r.made, true);
  assert.equal(Look.read(memory({ avatar_v1: '{nope' })).made, false);
  assert.equal(Look.read(memory({ avatar_v1: JSON.stringify(Object.assign({}, raw, { v: 2 })) })).made, false);
});

test('save stamps the time and keeps only clean values', () => {
  const s = memory();
  const out = Look.save(s, { body: 'boy', skin: 7, hair: 'curly', hairColor: 3, outfit: 4, pet: 'puppy', petName: '  Max  ', eyes: 'smiley', freckles: true, blush: false,
    wear: { hat: 'cap', sticker: 'starsticker' }, petColor: 4, petSpot: 'arms', petWear: { neck: 'pet-bell' }, t: 0 }, 1234);
  assert.deepEqual(out, { v: 1, body: 'boy', skin: 7, hair: 'curly', hairColor: 3, outfit: 4, pet: 'puppy', eyes: 'smiley', freckles: true, blush: false,
    petName: 'Max', wear: Object.assign({}, EMPTY, { hat: 'cap', sticker: 'starsticker' }), petColor: 4, petSpot: 'arms', petWear: Object.assign({}, NO_GEAR, { neck: 'pet-bell' }), t: 1234 });
  assert.deepEqual(JSON.parse(s.data.avatar_v1), out);
});

test('options are unique and colours are hex', () => {
  for (const [k, list] of Object.entries(Look.OPTIONS)) {
    assert.equal(new Set(list).size, list.length, k);
    if (['skin', 'hairColor', 'outfit'].includes(k)) list.forEach((c) => assert.match(c, /^#[0-9a-f]{6}$/, k));
  }
});

test('color reads through the options; petName falls back to the pet\'s default name', () => {
  const look = Object.assign({}, Look.DEFAULT, { outfit: 2, pet: 'puppy' });
  assert.equal(Look.color(look, 'outfit'), Look.OPTIONS.outfit[2]);
  assert.equal(Look.petName(look), 'Bantay');
  assert.equal(Look.petName(Object.assign({}, look, { petName: 'Max' })), 'Max');
  assert.equal(Look.petName(Object.assign({}, look, { pet: 'panda' })), 'Bao');
  assert.equal(Look.petName(Object.assign({}, look, { pet: 'zebra' })), 'Piyo', 'an unknown pet is drawn as the chick');
});

test('a pet id this version does not know is kept, so a newer device\'s pet is not wiped', () => {
  assert.equal(Look.clean({ v: 1, pet: 'panda' }).pet, 'panda');
  assert.equal(Look.clean({ v: 1, pet: 'zebra-2' }).pet, 'zebra-2');
  assert.equal(Look.clean({ v: 1, pet: 'a'.repeat(33) }).pet, 'chick');
  assert.equal(Look.clean({ v: 1, pet: 5 }).pet, 'chick');
  assert.deepEqual(Look.DEFAULT.petWear, NO_GEAR);
  assert.equal(Look.OPTIONS.pet, undefined, 'pets live in pets.js');
});

test('names are cut by whole characters and invisible direction marks are dropped', () => {
  const cut = Look.clean({ v: 1, petName: 'abcdefghijk\u{1F436}\u{1F436}' }).petName;
  assert.equal(Array.from(cut).length, 12);
  assert.ok(cut.endsWith('\u{1F436}') && !cut.endsWith('\u{1F436}\u{1F436}'));
  assert.equal(Look.clean({ v: 1, petName: '‮Abc' }).petName, 'Abc');
});

test('a look saved before the wardrobe keeps working and gets the new defaults', () => {
  const old = { v: 1, body: 'girl', skin: 2, hair: 'pigtails', hairColor: 1, outfit: 3, pet: 'kitten', petName: 'Mimi', t: 5 };
  const r = Look.read(memory({ avatar_v1: JSON.stringify(old) }));
  assert.equal(r.look.skin, 2);
  assert.equal(r.look.eyes, 'round');
  assert.equal(r.look.freckles, false);
  assert.equal(r.look.blush, true);
  assert.deepEqual(r.look.wear, EMPTY);
});

test('the free basics: 10 skin tones and 6 hair styles, old ones first', () => {
  assert.equal(Look.OPTIONS.skin.length, 10);
  assert.deepEqual(Look.OPTIONS.skin.slice(0, 5), ['#ffe0c7', '#f6c9a0', '#e0a878', '#b97d52', '#8a5634']);
  assert.deepEqual(Look.OPTIONS.hair, ['pigtails', 'bob', 'short', 'braids', 'ponytail', 'curly']);
  assert.deepEqual(Look.OPTIONS.eyes, ['round', 'sleepy', 'sparkly', 'smiley']);
});

test('a boy with no character yet starts as a boy with short hair; a made character never changes', () => {
  const fresh = Look.read(memory({}), true);
  assert.equal(fresh.made, false);
  assert.equal(fresh.look.body, 'boy');
  assert.equal(fresh.look.hair, 'short');
  assert.equal(Look.read(memory({}), false).look.body, 'girl');
  const made = memory({ [Look.KEY]: JSON.stringify(Object.assign({}, Look.DEFAULT, { t: 5 })) });
  assert.equal(Look.read(made, true).look.body, 'girl', 'her saved choice stays');
});

test('forKid: an unmade boy gets the boy body and short hair; a made look and a girl stay as they are', () => {
  const unmade = Look.forKid(Look.clean(null), true);
  assert.deepEqual([unmade.body, unmade.hair], ['boy', 'short']);
  const made = Look.forKid(Look.clean(Object.assign({}, Look.DEFAULT, { t: 5 })), true);
  assert.deepEqual([made.body, made.hair], ['girl', 'pigtails']);
  const girl = Look.forKid(Look.clean(null), false);
  assert.deepEqual([girl.body, girl.hair], ['girl', 'pigtails']);
});
