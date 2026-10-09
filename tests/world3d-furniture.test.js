const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const F = require(worldFile('furniture.js'));
const Items = require(worldFile('items.js'));
const Pets = require(worldFile('pets.js'));
const Emotes = require(worldFile('emotes.js'));

// The spec's three tables: id, coins (null = earned), tab, size, hint, English, Filipino.
const TABLE = [
  ['home-bed', 0, 'furniture', [1, 2], 'wall-side', 'Plain bed', 'Simpleng kama'],
  ['home-rug-round', 0, 'furniture', [2, 2], 'middle', 'Round rug', 'Bilog na alpombra'],
  ['home-lamp', 0, 'furniture', [1, 1], 'wall-side', 'Small lamp', 'Maliit na lampara'],
  ['home-wall-pink', 0, 'room', null, null, 'Pink walls', 'Kulay-rosas na dingding'],
  ['home-wall-blue', 0, 'room', null, null, 'Blue walls', 'Asul na dingding'],
  ['home-floor-wood', 0, 'room', null, null, 'Wooden floor', 'Sahig na kahoy'],
  ['home-floor-tile', 0, 'room', null, null, 'Tile floor', 'Sahig na baldosa'],
  ['home-plant', 50, 'furniture', [1, 1], 'wall-side', 'Potted plant', 'Halaman sa paso'],
  ['home-poster-stars', 50, 'wall', [1], 'wall', 'Star poster', 'Poster ng mga bituin'],
  ['home-poster-rainbow', 50, 'wall', [1], 'wall', 'Rainbow poster', 'Poster ng bahaghari'],
  ['home-beanbag', 60, 'furniture', [1, 1], 'middle', 'Beanbag', 'Malambot na upuan'],
  ['home-clock', 70, 'wall', [1], 'wall', 'Wall clock', 'Orasan sa dingding'],
  ['home-toybox', 80, 'fun', [1, 1], 'wall-side', 'Toy box', 'Kahon ng laruan'],
  ['home-plant-tall', 90, 'furniture', [1, 1], 'wall-side', 'Tall plant', 'Mataas na halaman'],
  ['home-rug-heart', 90, 'furniture', [2, 2], 'middle', 'Heart rug', 'Alpombrang hugis-puso'],
  ['home-window', 100, 'wall', [1], 'wall', 'Flower window', 'Bintanang may bulaklak'],
  ['home-pet-bed', 100, 'fun', [1, 1], 'wall-side', 'Pet bed', 'Higaan ng alaga'],
  ['home-globe', 110, 'fun', [1, 1], 'wall-side', 'Globe', 'Globo'],
  ['home-lights', 120, 'wall', [2], 'wall', 'Fairy lights', 'Maliliit na ilaw'],
  ['home-tea-table', 120, 'furniture', [1, 1], 'middle', 'Tea table', 'Mesang pang-tsaa'],
  ['home-floor-checker', 120, 'room', null, null, 'Checkered floor', 'Sahig na may kuwadradong disenyo'],
  ['home-rocking-chair', 140, 'furniture', [1, 1], 'middle', 'Rocking chair', 'Tumba-tumba'],
  ['home-bookcase', 150, 'furniture', [1, 1], 'wall-side', 'Bookcase', 'Lalagyan ng aklat'],
  ['home-wall-stars', 150, 'room', null, null, 'Starry walls', 'Dingding na may bituin'],
  ['home-easel', 160, 'fun', [1, 1], 'wall-side', 'Painting easel', 'Patungan ng pinta'],
  ['home-aparador', 180, 'furniture', [1, 2], 'wall-side', 'Aparador', 'Aparador ng damit'],
  ['home-piano', 200, 'fun', [1, 2], 'wall-side', 'Toy piano', 'Laruang piyano'],
  ['home-bed-cloud', 250, 'furniture', [1, 2], 'wall-side', 'Cloud bed', 'Kamang hugis-ulap'],
  ['home-dollhouse', 300, 'fun', [1, 1], 'wall-side', 'Dollhouse', 'Bahay ng manika'],
  ['home-telescope', 350, 'fun', [1, 1], 'wall-side', 'Telescope', 'Teleskopyo'],
  ['home-tent', 400, 'fun', [2, 2], 'middle', 'Play tent', 'Laruang tolda'],
  ['home-bunk-bed', 500, 'furniture', [1, 2], 'wall-side', 'Bunk bed', 'Kamang dalawang palapag'],
  ['home-canopy-bed', 600, 'furniture', [2, 2], 'wall-side', 'Canopy bed', 'Kamang may kurtina'],
  ['home-aquarium', 600, 'fun', [1, 2], 'wall-side', 'Aquarium', 'Akwaryum'],
  ['home-streak-lamp', null, 'earned', [1, 1], 'wall-side', 'Streak lamp', 'Lampara ng sunod-sunod na araw'],
  ['home-boss-rug', null, 'earned', [2, 2], 'middle', 'Boss rug', 'Alpombra ng Boss'],
  ['home-gold-frame', null, 'earned', [1], 'wall', 'Gold frame', 'Gintong kuwadro'],
  ['home-book-tower', null, 'earned', [1, 1], 'wall-side', 'Book tower', 'Tore ng aklat'],
  ['home-star-ceiling', null, 'earned', null, null, 'Star ceiling', 'Kisameng may bituin'],
  ['home-hoot-plush', null, 'earned', [1, 1], 'wall-side', 'Hoot plush', 'Laruang Hoot']
];

test('40 pieces: 7 free starters, 27 for sale and 6 earned, with the spec\'s prices and names', () => {
  assert.equal(F.ITEMS.length, 40);
  assert.equal(F.ITEMS.filter((it) => it.coins === 0).length, 7);
  assert.equal(F.ITEMS.filter((it) => it.coins > 0).length, 27);
  assert.equal(F.ITEMS.filter((it) => it.earned).length, 6);
  assert.deepEqual(F.ITEMS.map((it) => [it.id, it.earned ? null : it.coins, it.tab, it.size || null, it.hint || null, it.en, it.fil]), TABLE);
});

test('ids are unique, start with home- and never clash with the wardrobe, pets or emotes', () => {
  const ids = F.ITEMS.map((it) => it.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^home-[a-z0-9-]+$/);
  const others = new Set([...Items.ITEMS, ...Pets.PETS, ...Pets.GEAR, ...Pets.TRICKS, ...Pets.TOYS, ...Emotes.EMOTES].map((it) => it.id));
  for (const id of ids) assert.ok(!others.has(id), id);
});

test('tabs, prices, kinds, sizes and hints fit together', () => {
  assert.deepEqual(F.TABS, ['furniture', 'wall', 'fun', 'room', 'earned']);
  for (const it of F.ITEMS) {
    assert.ok(F.TABS.includes(it.tab), it.id);
    assert.ok(it.icon && it.en && it.fil, it.id);
    assert.notEqual(it.fil, it.en, it.id + ' needs a Filipino name');
    assert.doesNotMatch(it.fil, /\bbagay\b|tunog tama/i, it.id);
    if (it.earned) {
      assert.equal(it.tab, 'earned', it.id);
      assert.equal(it.coins, undefined, it.id + ' is never for sale');
      assert.ok(F.EARN[it.earned.rule], it.id);
    } else {
      assert.ok(it.coins === 0 || (it.coins >= 50 && it.coins <= 800), it.id);
      assert.notEqual(it.tab, 'earned', it.id);
    }
    if (it.kind === 'room') {
      assert.equal(it.size, undefined, it.id);
      assert.ok(['wall', 'floor', 'stars'].includes(it.part), it.id);
      if (it.part !== 'stars') assert.match(it.color, /^#[0-9a-f]{6}$/, it.id);
      if (it.part === 'floor') assert.ok(['wood', 'tile', 'checker'].includes(it.pattern), it.id);
    } else if (it.kind === 'floor') {
      assert.ok([[1, 1], [1, 2], [2, 2]].some((s) => JSON.stringify(s) === JSON.stringify(it.size)), it.id);
      assert.ok(['wall-side', 'middle'].includes(it.hint), it.id);
    } else {
      assert.equal(it.kind, 'wall', it.id);
      assert.ok([[1], [2]].some((s) => JSON.stringify(s) === JSON.stringify(it.size)), it.id);
      assert.equal(it.hint, 'wall', it.id);
    }
    if (it.tab === 'room') assert.equal(it.kind, 'room', it.id);
  }
  assert.deepEqual(F.ITEMS.filter((it) => it.rug).map((it) => it.id), ['home-rug-round', 'home-rug-heart', 'home-boss-rug']);
  assert.equal(F.find('home-wall-stars').pattern, 'stars');
  assert.equal(F.find('home-star-ceiling').part, 'stars');
});

test('the starter room uses free pieces', () => {
  assert.deepEqual(F.STARTER_ROOM, { wall: 'home-wall-pink', floor: 'home-floor-wood', placed: ['home-bed', 'home-rug-round'] });
  for (const id of [F.STARTER_ROOM.wall, F.STARTER_ROOM.floor, ...F.STARTER_ROOM.placed]) assert.equal(F.find(id).coins, 0, id);
  assert.equal(F.find(F.STARTER_ROOM.wall).part, 'wall');
  assert.equal(F.find(F.STARTER_ROOM.floor).part, 'floor');
});

test('find, inTab, name and earnLine', () => {
  assert.equal(F.find('home-aquarium').coins, 600);
  assert.equal(F.find('cap'), null);
  assert.equal(F.find('toString'), null);
  assert.equal(F.find(7), null);
  assert.deepEqual(F.inTab('wall').map((it) => it.id), ['home-poster-stars', 'home-poster-rainbow', 'home-clock', 'home-window', 'home-lights']);
  assert.deepEqual(F.inTab('earned').map((it) => it.id), ['home-streak-lamp', 'home-boss-rug', 'home-gold-frame', 'home-book-tower', 'home-star-ceiling', 'home-hoot-plush']);
  assert.equal(F.TABS.reduce((n, t) => n + F.inTab(t).length, 0), 40);
  const aq = F.find('home-aquarium');
  assert.equal(F.name(aq, 'grade5'), 'Aquarium');
  assert.equal(F.name(aq, 'grade2'), 'Akwaryum · Aquarium');
  assert.equal(F.earnLine(F.find('home-book-tower'), 'grade5'), 'Get a medal in 50 lessons');
  assert.equal(F.earnLine(F.find('home-book-tower'), 'grade2'), 'Magkaroon ng medalya sa 30 aralin · Get a medal in 30 lessons');
  assert.equal(F.earnLine(F.find('home-streak-lamp'), 'grade5'), 'Learn 7 days in a row');
  assert.equal(F.earnLine(aq, 'grade5'), '');
  assert.equal(F.earnCount(F.find('home-book-tower'), 'grade2'), 30);
  assert.equal(F.earnCount(F.find('home-hoot-plush'), 'grade5'), 20);
  assert.equal(F.earnCount(F.find('home-gold-frame'), 'grade5'), null);
});

test('Grade 2 names and earn lines are pairs, with no pair inside a half', () => {
  for (const it of F.ITEMS) {
    const parts = F.name(it, 'grade2').split(' · ');
    assert.deepEqual(parts, [it.fil, it.en], it.id);
    if (it.earned) {
      const line = F.earnLine(it, 'grade2').split(' · ');
      assert.equal(line.length, 2, it.id);
      assert.equal(line[1], F.earnLine(it, 'grade5').replace('50', '30'), it.id);
    }
  }
});

test('every floor and wall piece can be drawn (a new piece fails here until room3d.js draws it)', () => {
  const R3 = require(worldFile('room3d.js'));
  for (const it of F.ITEMS.filter((i) => i.kind !== 'room')) assert.equal(typeof R3.BUILDERS[it.id], 'function', it.id + ' needs a builder in room3d.js');
});
