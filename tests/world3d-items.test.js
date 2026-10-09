const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Items = require(worldFile('items.js'));

test('60 items (52 sold, 8 found), unique ids, a known slot and a price from 50 to 800 (the balloon is free)', () => {
  assert.equal(Items.ITEMS.length, 60);
  assert.equal(new Set(Items.ITEMS.map((i) => i.id)).size, 60);
  for (const it of Items.ITEMS) {
    assert.ok(Items.SLOTS.includes(it.slot), it.id + ' slot');
    const free = (it.slot === 'prop' && it.coins === 0) || (it.found && it.coins === 0);
    assert.ok(Number.isInteger(it.coins) && (free || (it.coins >= 50 && it.coins <= 800)), it.id + ' price ' + it.coins);
    assert.match(it.id, /^[a-z0-9-]{1,32}$/, it.id);
    assert.ok(it.icon && it.en && it.fil, it.id + ' icon and names');
    assert.ok(!it.en.includes(' · ') && !it.fil.includes(' · '), it.id + ' names are single halves');
  }
});

test('the balloon is the only free item; found items are hers only once found', () => {
  assert.deepEqual(Items.ITEMS.filter((i) => Items.owns({}, i.id)).map((i) => i.id), ['balloon']);
  assert.equal(Items.owns({ moonsticker: { t: 1, coins: 0 } }, 'moonsticker'), true);
  assert.equal(Items.wearable({ wear: { sticker: 'moonsticker' } }, {}).wear.sticker, '');
});

test('8 found-only items, in the face and hair groups, never sold', () => {
  assert.deepEqual(Items.FOUND.map((i) => i.id), ['moonsticker', 'cloversticker', 'daisysticker', 'boltpaint', 'minthair', 'sunsethair', 'mintshimmer', 'lavendershimmer']);
  for (const it of Items.FOUND) assert.ok(['sticker', 'paint', 'dye', 'shimmer'].includes(it.slot), it.id);
  const fs = require('node:fs');
  assert.match(fs.readFileSync(worldFile('boutique.js'), 'utf8'), /filter\(function \(it\) \{ return !it\.found; \}\)/);
});

test('keepUnowned: a free prop she took off stays off; an unowned paid prop is kept', () => {
  assert.equal(Items.keepUnowned({ wear: { prop: 'balloon' } }, { wear: { prop: '' } }, {}).wear.prop, '');
  assert.equal(Items.keepUnowned({ wear: { prop: 'trophy' } }, { wear: { prop: '' } }, {}).wear.prop, 'trophy');
});

test('every slot belongs to exactly one group; 8 items per group, 12 props', () => {
  const slots = Items.GROUPS.flatMap((g) => g.slots);
  assert.deepEqual([...slots].sort(), [...Items.SLOTS].sort());
  assert.deepEqual(Items.GROUPS.map((g) => g.id), ['clothes', 'hats', 'accessories', 'face', 'hair', 'props']);
  const found = { face: 4, hair: 4 };
  for (const g of Items.GROUPS) assert.equal(Items.inGroup(g.id).filter((i) => !i.found).length, g.id === 'props' ? 12 : 8, g.id);
  for (const g of Items.GROUPS) assert.equal(Items.inGroup(g.id).filter((i) => i.found).length, found[g.id] || 0, g.id + ' found');
});

test('the props and their prices', () => {
  assert.deepEqual(Items.inGroup('props').map((i) => [i.id, i.coins]), [
    ['balloon', 0], ['bubblewand', 80], ['pamaypay', 80], ['teddy', 100], ['bouquet', 120], ['umbrella', 150],
    ['ribbonwand', 200], ['drum', 200], ['parol', 250], ['ukulele', 300], ['magicwand', 500], ['trophy', 800]
  ]);
  for (const it of Items.inGroup('props')) assert.equal(it.slot, 'prop');
});

test('a free prop counts as owned: worn, kept and never hidden', () => {
  const look = { wear: { prop: 'balloon' } };
  assert.equal(Items.wearable(look, {}).wear.prop, 'balloon');
  assert.equal(Items.wearable({ wear: { prop: 'trophy' } }, {}).wear.prop, '', 'a paid prop she does not own is not drawn');
  assert.equal(Items.owns({}, 'balloon'), true);
  assert.equal(Items.owns({}, 'trophy'), false);
  assert.equal(Items.owns({ trophy: { t: 1, coins: 800 } }, 'trophy'), true);
  assert.equal(Items.owns({}, 'nope'), false);
});

test('the crown, the wings and the Filipiniana are the dearest of their groups', () => {
  const top = (group) => Math.max(...Items.inGroup(group).map((i) => i.coins));
  assert.equal(Items.find('crown').coins, top('hats'));
  assert.equal(Items.find('fairywings').coins, top('accessories'));
  assert.equal(Items.find('filipiniana').coins, top('clothes'));
});

test('Grade 2 names pair Filipino with English; Grade 5 is English', () => {
  const crown = Items.find('crown');
  assert.equal(Items.name(crown, 'grade5'), 'Crown');
  assert.equal(Items.name(crown, 'grade2'), 'Korona · Crown');
  for (const it of Items.ITEMS) {
    assert.doesNotMatch(it.fil, /\bbagay\b|tunog tama/i, it.id);
    assert.notEqual(it.fil, it.en, it.id + ' needs a Filipino name');
  }
});

test('find knows only catalog ids', () => {
  assert.equal(Items.find('nope'), null);
  assert.equal(Items.find('constructor'), null);
});

test('wearable keeps real items she owns in their own slot, and drops the rest', () => {
  const look = { body: 'girl', wear: { hat: 'crown', clothes: 'crown', glasses: 'ghost', back: 'fairywings', neck: '', sticker: 'heartsticker' } };
  const owned = { crown: { t: 1, coins: 700 }, heartsticker: { t: 2, coins: 50 } };
  const out = Items.wearable(look, owned);
  assert.deepEqual(out.wear, { clothes: '', hat: 'crown', glasses: '', back: '', neck: '', sticker: 'heartsticker', paint: '', dye: '', shimmer: '', prop: '' });
  assert.equal(out.body, 'girl');
  assert.equal(look.wear.back, 'fairywings', 'the saved look is not changed');
  assert.equal(Items.wearable(look, null).wear.back, 'fairywings', 'her sister is drawn without an ownership check');
  assert.deepEqual(Items.wearable({}, null).wear, Items.emptyWear());
});

test('keepUnowned keeps a stored item she does not own yet where the panel left the slot empty', () => {
  const stored = { body: 'girl', wear: Object.assign(Items.emptyWear(), { back: 'fairywings', hat: 'crown', neck: 'scarf' }) };
  const edited = { body: 'boy', wear: Object.assign(Items.emptyWear(), { hat: '', neck: 'bowtie', sticker: 'heartsticker' }) };
  const owned = { crown: { t: 1, coins: 700 }, bowtie: { t: 2, coins: 100 }, heartsticker: { t: 3, coins: 50 } };
  const out = Items.keepUnowned(stored, edited, owned);
  assert.equal(out.body, 'boy');
  assert.equal(out.wear.back, 'fairywings', 'not owned here yet: kept');
  assert.equal(out.wear.hat, '', 'owned and taken off: stays off');
  assert.equal(out.wear.neck, 'bowtie', 'a new choice wins');
  assert.equal(out.wear.sticker, 'heartsticker');
  assert.equal(edited.wear.back, '', 'the edited look is not changed');
});

test('keepUnowned keeps an item from a newer version of the games, which the mirror cannot show', () => {
  const stored = { wear: Object.assign(Items.emptyWear(), { hat: 'spacehelmet' }) };
  const out = Items.keepUnowned(stored, { wear: Items.emptyWear() }, { spacehelmet: { t: 1, coins: 300 } });
  assert.equal(out.wear.hat, 'spacehelmet');
});
