const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Pets = require(worldFile('pets.js'));
const Items = require(worldFile('items.js'));

const own = (...ids) => Object.fromEntries(ids.map((id) => [id, { t: 1, coins: 1 }]));

test('16 pets: 3 free, 13 paid within 50-800, each with a size, 5 colours, a default name and both languages', () => {
  assert.equal(Pets.PETS.length, 16);
  assert.deepEqual(Pets.PETS.filter((p) => p.coins === 0).map((p) => p.id), ['chick', 'kitten', 'puppy']);
  for (const p of Pets.PETS) {
    assert.equal(p.kind, 'pet', p.id);
    assert.ok(Pets.SIZES[p.size], p.id + ' size');
    assert.ok(p.coins === 0 || (p.coins >= 50 && p.coins <= 800), p.id + ' price');
    assert.equal(p.colors.length, Pets.COLORS, p.id + ' colours');
    p.colors.forEach((c) => assert.match(c, /^#[0-9a-f]{6}$/, p.id));
    assert.ok(p.name && p.en && p.fil && p.icon, p.id);
  }
});

test('14 gear pieces in 4 slots, 50-400 coins, ids start with pet-', () => {
  assert.equal(Pets.GEAR.length, 14);
  for (const g of Pets.GEAR) {
    assert.equal(g.kind, 'gear', g.id);
    assert.ok(Pets.GEAR_SLOTS.includes(g.slot), g.id);
    assert.ok(g.coins >= 50 && g.coins <= 400, g.id);
    assert.match(g.id, /^pet-[a-z]+$/);
    assert.ok(g.en && g.fil && g.icon, g.id);
  }
});

test('ids are unique and never clash with the wardrobe (they share one owned list)', () => {
  const ids = Pets.PETS.concat(Pets.GEAR, Pets.TRICKS, Pets.TOYS).map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(Items.find(id), null, id + ' is also a wardrobe id');
});

test('the stall shows paid pets and all gear; Grade 2 names pair Filipino with English unless they are the same', () => {
  assert.deepEqual(Pets.GROUPS, ['pets', 'gear', 'tricks', 'toys']);
  assert.equal(Pets.inGroup('tricks').length, 7, 'free ones show too, marked Free');
  assert.equal(Pets.inGroup('toys').length, 3);
  assert.equal(Pets.name(Pets.find('trick-spin'), 'grade2'), 'Ikot · Spin');
  assert.equal(Pets.name(Pets.find('toy-frisbee'), 'grade2'), 'Frisbee');
  assert.equal(Pets.inGroup('pets').length, 13);
  assert.equal(Pets.inGroup('gear').length, 14);
  assert.deepEqual(Pets.inGroup('nope'), []);
  assert.equal(Pets.name(Pets.find('bunny'), 'grade2'), 'Kuneho · Bunny');
  assert.equal(Pets.name(Pets.find('bunny'), 'grade5'), 'Bunny');
  assert.equal(Pets.name(Pets.find('panda'), 'grade2'), 'Panda');
  assert.equal(Pets.find('crown'), null);
  assert.equal(Pets.find(undefined), null);
});

test('spots by size', () => {
  assert.deepEqual(Pets.SPOTS, ['walk', 'shoulder', 'head', 'arms']);
  assert.deepEqual(Pets.spotsFor('hamster'), ['walk', 'shoulder', 'head']);
  assert.deepEqual(Pets.spotsFor('kitten'), ['walk', 'arms']);
  assert.deepEqual(Pets.spotsFor('panda'), ['walk']);
  assert.deepEqual(Pets.spotsFor('zebra'), ['walk']);
});

test('wearable: free pets always, paid pets and gear only when owned, colour and spot cleaned', () => {
  const look = { pet: 'panda', petColor: 3, petSpot: 'shoulder', petWear: { hat: 'pet-crown', neck: 'pet-bell', back: 'pet-cape', glasses: 'zzz' } };
  assert.deepEqual(Pets.wearable(look, {}), Object.assign({}, look, { pet: 'chick', petColor: 0, petSpot: 'walk', petWear: { hat: '', neck: '', back: '', glasses: '' } })); // the chick stands in, in its own colour, walking
  const mine = Pets.wearable(look, own('panda', 'pet-crown'));
  assert.equal(mine.pet, 'panda');
  assert.equal(mine.petSpot, 'walk', 'a big pet only walks');
  assert.deepEqual(mine.petWear, { hat: 'pet-crown', neck: '', back: '', glasses: '' });
  assert.equal(Pets.wearable({ pet: 'kitten', petColor: 9, petSpot: 'arms' }, {}).petColor, 0);
  assert.equal(Pets.wearable({ pet: 'kitten', petSpot: 'arms' }, {}).petSpot, 'arms');
  assert.equal(Pets.wearable({ pet: 'pet-crown' }, own('pet-crown')).pet, 'chick', 'gear is not a pet');
  assert.deepEqual(Pets.wearable({ petWear: { hat: 'pet-bell' } }, own('pet-bell')).petWear.hat, '', 'gear only in its own slot');
});

test('wearable with owned = null draws everything known (her sister, as she saved it)', () => {
  const w = Pets.wearable({ pet: 'dragon', petColor: 2, petWear: { hat: 'pet-wizard' } }, null);
  assert.equal(w.pet, 'dragon');
  assert.equal(w.petWear.hat, 'pet-wizard');
  assert.equal(Pets.wearable({ pet: 'zebra' }, null).pet, 'chick', 'an unknown pet is drawn as the chick');
});

test('keepUnowned: the mirror keeps a pet or gear she has not got here yet', () => {
  const stored = { pet: 'panda', petColor: 2, petSpot: 'walk', petWear: { hat: 'pet-crown', neck: '', back: '', glasses: '' } };
  // The mirror showed the chick and no hat in their place; she changed nothing about them.
  const edited = { pet: 'chick', petColor: 0, petSpot: 'walk', petWear: { hat: '', neck: 'pet-bell', back: '', glasses: '' } };
  const out = Pets.keepUnowned(stored, edited, own('pet-bell'));
  assert.equal(out.pet, 'panda');
  assert.equal(out.petColor, 2);
  assert.deepEqual(out.petWear, { hat: 'pet-crown', neck: 'pet-bell', back: '', glasses: '' });
  const owned = own('panda', 'pet-crown');
  assert.equal(Pets.keepUnowned(stored, edited, owned).pet, 'chick', 'she owns the panda here, so picking the chick is a real choice');
  assert.equal(Pets.keepUnowned(stored, edited, owned).petWear.hat, '', 'and taking the hat off too');
  assert.equal(Pets.keepUnowned(stored, Object.assign({}, edited, { pet: 'kitten' }), {}).pet, 'kitten');
});

test('7 tricks and 3 toys: one free of each, paid ones 50-800, prefixed ids, both languages', () => {
  assert.deepEqual(Pets.TRICKS.map((t) => [t.id, t.coins]), [['trick-bow', 0], ['trick-spin', 100], ['trick-jump', 150],
    ['trick-roll', 200], ['trick-dance', 300], ['trick-twirl', 450], ['trick-backflip', 600]]);
  assert.deepEqual(Pets.TOYS.map((t) => [t.id, t.coins, t.range]), [['toy-ball', 0, 8], ['toy-bone', 80, 6], ['toy-frisbee', 100, 12]]);
  for (const t of Pets.TRICKS) {
    assert.equal(t.kind, 'trick', t.id);
    assert.ok(t.len > 0 && t.en && t.fil && t.icon, t.id);
  }
  for (const t of Pets.TOYS) {
    assert.equal(t.kind, 'toy', t.id);
    assert.ok(t.flight > 0 && t.en && t.fil && t.icon, t.id);
  }
  assert.equal(Pets.find('toy-bone').dig, true);
});

test('owns, playable and bestTrick: free ones always, paid ones only when owned', () => {
  assert.equal(Pets.owns({}, 'trick-bow'), true);
  assert.equal(Pets.owns({}, 'trick-spin'), false);
  assert.equal(Pets.owns(own('trick-spin'), 'trick-spin'), true);
  assert.equal(Pets.owns(null, 'toy-ball'), true);
  assert.equal(Pets.owns(own('nope'), 'nope'), false);
  assert.deepEqual(Pets.playable({}).map((x) => x.id), ['toy-ball', 'trick-bow']);
  assert.deepEqual(Pets.playable(own('trick-dance', 'toy-frisbee', 'hamster')).map((x) => x.id),
    ['toy-ball', 'toy-frisbee', 'trick-bow', 'trick-dance'], 'toys first, then tricks; pets are not played');
  assert.equal(Pets.bestTrick({}), 'trick-jump', 'only Bow: the pet jumps');
  assert.equal(Pets.bestTrick(own('trick-spin', 'trick-roll')), 'trick-roll');
  assert.equal(Pets.bestTrick(own('trick-backflip', 'trick-spin')), 'trick-backflip');
});

test('a trick or a toy is never worn as a pet or gear', () => {
  const w = Pets.wearable({ pet: 'trick-spin', petWear: { hat: 'toy-ball' } }, own('trick-spin', 'toy-ball'));
  assert.equal(w.pet, 'chick');
  assert.equal(w.petWear.hat, '');
});
