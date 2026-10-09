const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const { TEXT, english, visitKey } = require(worldFile('text.js'));
const B = require(engineFile('bosses.js'));

function keys(o, prefix = '') {
  return Object.keys(o).sort().flatMap((k) => (typeof o[k] === 'object' ? keys(o[k], prefix + k + '.') : [prefix + k]));
}
const at = (o, k) => k.split('.').reduce((v, p) => v[p], o);

// Buttons are English on both grades; names are names.
const ENGLISH_ONLY = new Set(['sprint', 'stop', 'go', 'mirror', 'signpost', 'close', 'lobby', 'toLobby', 'settings', 'on', 'off',
  'qualityNames.auto', 'qualityNames.high', 'qualityNames.low', 'maker.done',
  'maker.bodies.girl', 'maker.bodies.boy', 'maker.hairs.pigtails', 'maker.hairs.bob', 'maker.hairs.short',
  'petshopGo', 'petsMore', 'treat', 'tabs.pet', 'tabs.pets', 'tabs.gear',
  'toyshopGo', 'toysMore', 'use', 'emote', 'tabs.props', 'tabs.emotes',
  'play', 'free', 'tabs.tricks', 'tabs.toys',
  'maker.spots.walk', 'maker.spots.shoulder', 'maker.spots.head', 'maker.spots.arms',
  'mimiTalk', 'goTrail', 'later', 'counter', 'fortGo', 'fortClosed', 'seeBoss', 'openChest',
  'more', 'ask', 'bye', 'next', 'gotIt', 'talkTo', 'listen', 'reviewGame', 'bunny',
  'hug', 'cheerAgain', 'rides.slide', 'rides.swings', 'rides.seesaw', 'rides.merry',
  'lana', 'boutiqueGo', 'buy', 'yes', 'no', 'need', 'owned', 'shopMore',
  'tabs.me', 'tabs.clothes', 'tabs.hats', 'tabs.accessories', 'tabs.face', 'tabs.hair',
  'maker.none', 'maker.hairs.braids', 'maker.hairs.ponytail', 'maker.hairs.curly',
  'maker.eyesNames.round', 'maker.eyesNames.sleepy', 'maker.eyesNames.sparkly', 'maker.eyesNames.smiley',
  'zoomIn', 'zoomOut', 'goIn', 'goOut', 'visitAte', 'visitKuya', 'visitBunso', 'visitSister', 'visitBrother', 'decorate', 'done', 'study', 'sit', 'cheerPill', 'turn', 'putAway', 'tasyoGo', 'yay',
  'tabs.furniture', 'tabs.wall', 'tabs.fun', 'tabs.room', 'tabs.earned', 'credit',
  // The earn line put in {how} is already a pair on Grade 2.
  'locked']);

test('both grades have the same words', () => {
  assert.deepEqual(keys(TEXT.grade2), keys(TEXT.grade5));
});

test('Grade 2 pairs Filipino with English on every label, and buttons stay English', () => {
  for (const k of keys(TEXT.grade2)) {
    const v = at(TEXT.grade2, k);
    if (ENGLISH_ONLY.has(k)) assert.equal(v, at(TEXT.grade5, k), k + ' is a button: same English as Grade 5');
    else assert.match(v, / · /, k + ' needs Filipino · English');
  }
});

test('the Go button has a place for the subject name', () => {
  assert.ok(TEXT.grade5.go.includes('{name}'));
});

test('counts go into the fort words through {c} and {n}', () => {
  for (const g of ['grade5', 'grade2']) assert.ok(TEXT[g].fortCount.includes('{c}') && TEXT[g].fortCount.includes('{n}'), g);
});

test('the characters have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['more', 'ask', 'bye', 'next', 'talkTo', 'listen', 'reviewGame', 'bunny', 'hoot', 'tree', 'askTitle']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.ok(TEXT[g].talkTo.includes('{name}'));
  }
});

test('family, comfort and play have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['hug', 'cheerAgain', 'jesus', 'nudge', 'sisterHello', 'sisterPlaying', 'sisterChoosing', 'sisterChoosingBoy']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.deepEqual(Object.keys(TEXT[g].rides), ['slide', 'swings', 'seesaw', 'merry']);
    for (const k of ['sisterHello', 'sisterPlaying', 'sisterChoosing', 'sisterChoosingBoy']) {
      assert.equal(TEXT[g][k].split('{name}').length - 1, g === 'grade2' ? 2 : 1, g + ' ' + k + ' names her sister in each half');
    }
  }
  assert.match(TEXT.grade5.nudge, /^Let's learn something!/);
});

test('the boutique and the wardrobe have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['boutique', 'lanaHello', 'have', 'confirm', 'bought', 'notEnough', 'failed', 'paused']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.equal(TEXT[g].have.split('{n}').length - 1, g === 'grade2' ? 2 : 1, g + ' have names the coins in each half');
    assert.ok(TEXT[g].confirm.includes('{en}') && TEXT[g].confirm.includes('{coins}'), g + ' confirm');
    assert.ok(TEXT[g].need.includes('{n}'));
    assert.deepEqual(Object.keys(TEXT[g].maker.slots), ['clothes', 'hat', 'glasses', 'back', 'neck', 'sticker', 'paint', 'dye', 'shimmer', 'prop']);
  }
  assert.ok(TEXT.grade2.confirm.includes('{fil}'), 'Grade 2 names the item in Filipino too');
  assert.equal(TEXT.grade5.confirm, 'Buy {en} for {coins} coins?');
});

test('floating signs are English only, keeping the emoji in front', () => {
  const T = TEXT.grade2;
  assert.equal(english('🧶 ' + T.boutique), "🧶 Lola Lana's Boutique");
  assert.equal(english('🐱 ' + T.mimi), '🐱 Mayor Mimi');
  assert.equal(english(T.fortCount.split('{c}').join('3').split('{n}').join('4')), '⚔️ 3 of 4 stages cleared');
  assert.equal(english('🔢 Matematika · Math'), '🔢 Math');
  assert.equal(english('📚 Filipino'), '📚 Filipino', 'a Filipino subject name stays');
  assert.equal(english("🏠 Lola Lana's Boutique"), "🏠 Lola Lana's Boutique");
  assert.equal(english('🌧️ ' + B.name(B.ROSTER[0], 'grade2')), '🌧️ King Grumble Cloud');
  for (const [k, v] of Object.entries(T.places)) assert.equal(english(v), TEXT.grade5.places[k], k);
});

test('the pet stall, the Pet tab and the treat have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['petshop', 'kikoHello', 'petshopGo', 'petsMore', 'treat']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.deepEqual(Object.keys(TEXT[g].maker.spots), ['walk', 'shoulder', 'head', 'arms']);
    assert.deepEqual(Object.keys(TEXT[g].maker.petSlots), ['hat', 'neck', 'back', 'glasses']);
    assert.ok(TEXT[g].maker.petColor && TEXT[g].maker.petSpot, g);
    assert.equal(TEXT[g].petNames, undefined, 'default pet names live in pets.js');
  }
  assert.equal(english('🦜 ' + TEXT.grade2.petshop), "🦜 Mang Kiko's Pet Stall");
});

test('the Play button, Free and the pet stall tabs have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    assert.equal(TEXT[g].play, '🎾 Play');
    assert.equal(TEXT[g].free, '🎁 Free');
    assert.equal(TEXT[g].tabs.tricks, 'Tricks');
    assert.equal(TEXT[g].tabs.toys, 'Toys');
  }
});

test('Kuya Pilo, the toy stall, Use and Emote have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    for (const k of ['toyshop', 'piloHello', 'toyshopGo', 'toysMore', 'use', 'emote']) assert.ok(TEXT[g][k], g + ' ' + k);
    assert.equal(TEXT[g].tabs.props, 'Props');
    assert.equal(TEXT[g].tabs.emotes, 'Emotes');
    assert.equal(TEXT[g].use, '✨ Use');
    assert.equal(TEXT[g].emote, '😊 Emote');
  }
  assert.equal(english('🎈 ' + TEXT.grade2.toyshop), "🎈 Kuya Pilo's Toy Stall");
  assert.ok(TEXT.grade2.piloHello.includes(' · '), 'Grade 2 pairs Filipino with English');
});

test('the footsteps setting says Footsteps, and Grade 2 pairs Filipino with English', () => {
  assert.equal(TEXT.grade5.steps, '👣 Footsteps');
  assert.equal(TEXT.grade2.steps, '👣 Yabag · Footsteps');
});

test('the Sprint and Stop buttons have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    assert.equal(TEXT[g].sprint, 'Sprint');
    assert.equal(TEXT[g].stop, '⏹️ Stop');
  }
});

test('My Room, Tito Tasyo and the trophies have their words', () => {
  for (const g of ['grade5', 'grade2']) {
    const T = TEXT[g];
    for (const k of ['zoomIn', 'zoomOut', 'goIn', 'goOut', 'visitAte', 'visitKuya', 'visitBunso', 'visitSister', 'visitBrother', 'decorate', 'done', 'study', 'sit', 'cheerPill', 'turn', 'putAway',
      'tasyoGo', 'yay', 'locked', 'tasyo', 'tasyoHello', 'noRoom', 'grew', 'earnedPop', 'trophyUp', 'desk', 'deskDone', 'toGo', 'myRoom']) assert.ok(T[k], g + ' ' + k);
    for (const k of ['furniture', 'wall', 'fun', 'room', 'earned']) assert.ok(T.tabs[k], g + ' tabs.' + k);
    assert.ok(T.locked.includes('{how}'));
    assert.equal(T.toGo.split('{n}').length - 1, g === 'grade2' ? 2 : 1, g + ' toGo');
    assert.equal(T.earnedPop.split('{en}').length - 1, 1, g + ' earnedPop');
    assert.ok(T.trophyUp.includes('{en}') && T.trophyUp.includes('{lvl}'), g + ' trophyUp');
  }
  assert.ok(TEXT.grade2.earnedPop.includes('{fil}'));
  assert.ok(TEXT.grade2.trophyUp.includes('{fil}') && TEXT.grade2.trophyUp.includes('{name}'));
  assert.equal(TEXT.grade5.noRoom, 'No room for this one yet. Your room grows with medals! 🏅');
  assert.equal(TEXT.grade5.grew, 'Your room grew! 🏡');
  assert.equal(TEXT.grade2.grew, 'Lumaki ang kuwarto mo! · Your room grew!');
  assert.equal(english('🔨 ' + TEXT.grade2.tasyo), "🔨 Tito Tasyo's Workshop");
});

test('Grade 2 words are English only unless the Filipino switch is on', () => {
  const { localized } = require(worldFile('text.js'));
  const en = localized('grade2', false), both = localized('grade2', true);
  assert.equal(both, TEXT.grade2, 'with the switch on the pairs stay as they are');
  assert.equal(localized('grade5', false), TEXT.grade5);
  assert.equal(en.mimi, 'Mayor Mimi');
  assert.equal(en.loading, 'Loading the village…');
  assert.equal(en.waking, '✨ Waking up…');
  assert.equal(en.places.boss, 'Boss Fort');
  assert.equal(en.maker.slots.hat, 'Hat');
  assert.equal(en.buy, TEXT.grade2.buy);
  const leftovers = [];
  (function walk(x, path) {
    if (typeof x === 'string') { if (x.includes(' · ')) leftovers.push(path); }
    else if (x && typeof x === 'object') Object.keys(x).forEach((k) => walk(x[k], path + '.' + k));
  })(en, 'T');
  assert.deepEqual(leftovers, []);
});

test('the visit button follows the sibling', () => {
  assert.equal(TEXT.grade2[visitKey('ate')], "👀 Visit Ate's room");
  assert.equal(TEXT.grade2[visitKey('kuya')], "👀 Visit Kuya's room");
  assert.equal(TEXT.grade5[visitKey('bunso')], "👀 Visit Bunso's room");
  assert.equal(TEXT.grade5[visitKey('sister')], "👀 Visit your sister's room");
  assert.equal(TEXT.grade5[visitKey('brother')], "👀 Visit your brother's room");
  assert.match(TEXT.grade5.sisterChoosingBoy, /his look/);
  assert.match(TEXT.grade2.sisterChoosingBoy, /kanyang itsura.*his look/);
});
