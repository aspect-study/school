/* My Room's catalog: what Tito Tasyo sells, the free starters and the earned pieces (never for sale). Floor items take
   size [w, d] squares (w along the columns, d along the rows), wall items [w] wall squares, room picks (walls, floor,
   star ceiling) no squares. Pure data, so the Node tests can read it. */
(function (root) {
  'use strict';

  var TABS = ['furniture', 'wall', 'fun', 'room', 'earned'];

  function add(it, extra) { return Object.assign(it, extra || {}); }
  function floor(id, coins, tab, w, d, hint, icon, en, fil, extra) {
    return add({ id: id, kind: 'floor', tab: tab, coins: coins, size: [w, d], hint: hint, icon: icon, en: en, fil: fil }, extra);
  }
  function wall(id, coins, w, icon, en, fil, extra) {
    return add({ id: id, kind: 'wall', tab: 'wall', coins: coins, size: [w], hint: 'wall', icon: icon, en: en, fil: fil }, extra);
  }
  // part: 'wall' (wallpaper), 'floor' or 'stars' (the star ceiling, on or off).
  function pick(id, coins, part, icon, en, fil, extra) {
    return add({ id: id, kind: 'room', tab: 'room', coins: coins, part: part, icon: icon, en: en, fil: fil }, extra);
  }
  // Earned pieces carry the rule that unlocks them instead of a price.
  function earn(rule, it) {
    delete it.coins;
    it.tab = 'earned';
    it.earned = { rule: rule };
    return it;
  }

  var ITEMS = [
    floor('home-bed', 0, 'furniture', 1, 2, 'wall-side', '🛏️', 'Plain bed', 'Simpleng kama', { color: '#9ed2ff' }),
    floor('home-rug-round', 0, 'furniture', 2, 2, 'middle', '⭕', 'Round rug', 'Bilog na alpombra', { color: '#ffb8d9', rug: true }),
    floor('home-lamp', 0, 'furniture', 1, 1, 'wall-side', '💡', 'Small lamp', 'Maliit na lampara', { color: '#ffe08a' }),
    pick('home-wall-pink', 0, 'wall', '🩷', 'Pink walls', 'Kulay-rosas na dingding', { color: '#ffd6e7' }),
    pick('home-wall-blue', 0, 'wall', '💙', 'Blue walls', 'Asul na dingding', { color: '#cfe8ff' }),
    pick('home-floor-wood', 0, 'floor', '🪵', 'Wooden floor', 'Sahig na kahoy', { color: '#d9a66b', pattern: 'wood' }),
    pick('home-floor-tile', 0, 'floor', '🔲', 'Tile floor', 'Sahig na baldosa', { color: '#e8eef2', pattern: 'tile' }),

    floor('home-plant', 50, 'furniture', 1, 1, 'wall-side', '🪴', 'Potted plant', 'Halaman sa paso', { color: '#5fcf9a' }),
    wall('home-poster-stars', 50, 1, '⭐', 'Star poster', 'Poster ng mga bituin', { color: '#3a4a8a' }),
    wall('home-poster-rainbow', 50, 1, '🌈', 'Rainbow poster', 'Poster ng bahaghari', { color: '#ffffff' }),
    floor('home-beanbag', 60, 'furniture', 1, 1, 'middle', '🫘', 'Beanbag', 'Malambot na upuan', { color: '#a77bff' }),
    wall('home-clock', 70, 1, '🕰️', 'Wall clock', 'Orasan sa dingding', { color: '#ff9f68' }),
    floor('home-toybox', 80, 'fun', 1, 1, 'wall-side', '🧸', 'Toy box', 'Kahon ng laruan', { color: '#ff7f7f' }),
    floor('home-plant-tall', 90, 'furniture', 1, 1, 'wall-side', '🌿', 'Tall plant', 'Mataas na halaman', { color: '#4cc9a0' }),
    floor('home-rug-heart', 90, 'furniture', 2, 2, 'middle', '💗', 'Heart rug', 'Alpombrang hugis-puso', { color: '#ff7ab8', rug: true }),
    wall('home-window', 100, 1, '🪟', 'Flower window', 'Bintanang may bulaklak', { color: '#9ed2ff' }),
    floor('home-pet-bed', 100, 'fun', 1, 1, 'wall-side', '🐾', 'Pet bed', 'Higaan ng alaga', { color: '#ffb38a' }),
    floor('home-globe', 110, 'fun', 1, 1, 'wall-side', '🌍', 'Globe', 'Globo', { color: '#6aa9ff' }),
    wall('home-lights', 120, 2, '✨', 'Fairy lights', 'Maliliit na ilaw', { color: '#fff3b0' }),
    floor('home-tea-table', 120, 'furniture', 1, 1, 'middle', '🫖', 'Tea table', 'Mesang pang-tsaa', { color: '#ffd0c2' }),
    pick('home-floor-checker', 120, 'floor', '🏁', 'Checkered floor', 'Sahig na may kuwadradong disenyo', { color: '#f5f0e8', pattern: 'checker' }),
    floor('home-rocking-chair', 140, 'furniture', 1, 1, 'middle', '🪑', 'Rocking chair', 'Tumba-tumba', { color: '#c8945a' }),
    floor('home-bookcase', 150, 'furniture', 1, 1, 'wall-side', '📚', 'Bookcase', 'Lalagyan ng aklat', { color: '#a0703c' }),
    pick('home-wall-stars', 150, 'wall', '🌟', 'Starry walls', 'Dingding na may bituin', { color: '#4a5aa8', pattern: 'stars' }),
    floor('home-easel', 160, 'fun', 1, 1, 'wall-side', '🎨', 'Painting easel', 'Patungan ng pinta', { color: '#e8c9a0' }),
    floor('home-aparador', 180, 'furniture', 1, 2, 'wall-side', '👚', 'Aparador', 'Aparador ng damit', { color: '#b07a4a' }),
    floor('home-piano', 200, 'fun', 1, 2, 'wall-side', '🎹', 'Toy piano', 'Laruang piyano', { color: '#ff9e9e' }),
    floor('home-bed-cloud', 250, 'furniture', 1, 2, 'wall-side', '☁️', 'Cloud bed', 'Kamang hugis-ulap', { color: '#f2f6ff' }),
    floor('home-dollhouse', 300, 'fun', 1, 1, 'wall-side', '🏠', 'Dollhouse', 'Bahay ng manika', { color: '#ffb8d9' }),
    floor('home-telescope', 350, 'fun', 1, 1, 'wall-side', '🔭', 'Telescope', 'Teleskopyo', { color: '#6a7a9a' }),
    floor('home-tent', 400, 'fun', 2, 2, 'middle', '⛺', 'Play tent', 'Laruang tolda', { color: '#ffd166' }),
    floor('home-bunk-bed', 500, 'furniture', 1, 2, 'wall-side', '🛌', 'Bunk bed', 'Kamang dalawang palapag', { color: '#9ed2ff' }),
    floor('home-canopy-bed', 600, 'furniture', 2, 2, 'wall-side', '👑', 'Canopy bed', 'Kamang may kurtina', { color: '#dcb8ff' }),
    floor('home-aquarium', 600, 'fun', 1, 2, 'wall-side', '🐠', 'Aquarium', 'Akwaryum', { color: '#a8ecf7' }),

    earn('streak', floor('home-streak-lamp', 0, '', 1, 1, 'wall-side', '🔥', 'Streak lamp', 'Lampara ng sunod-sunod na araw', { color: '#ff9f43' })),
    earn('boss', floor('home-boss-rug', 0, '', 2, 2, 'middle', '🐉', 'Boss rug', 'Alpombra ng Boss', { color: '#c0392b', rug: true })),
    earn('gold', wall('home-gold-frame', 0, 1, '🖼️', 'Gold frame', 'Gintong kuwadro', { color: '#ffd166' })),
    earn('books', floor('home-book-tower', 0, '', 1, 1, 'wall-side', '📖', 'Book tower', 'Tore ng aklat', { color: '#ff7f7f' })),
    earn('allGold', pick('home-star-ceiling', 0, 'stars', '🌌', 'Star ceiling', 'Kisameng may bituin')),
    earn('desk', floor('home-hoot-plush', 0, '', 1, 1, 'wall-side', '🦉', 'Hoot plush', 'Laruang Hoot', { color: '#b07a4a' }))
  ];

  // How each earned piece is won. n: the count in the line ({n}); an object gives one per grade.
  var EARN = {
    streak: { n: 7, en: 'Learn 7 days in a row', fil: 'Mag-aral nang 7 araw nang sunod-sunod' },
    boss: { en: 'Clear every stage of a weekly boss', fil: 'Tapusin ang lahat ng yugto ng isang lingguhang boss' },
    gold: { en: 'Get your first gold medal', fil: 'Makuha ang iyong unang gintong medalya' },
    books: { n: { grade5: 50, grade2: 30 }, en: 'Get a medal in {n} lessons', fil: 'Magkaroon ng medalya sa {n} aralin' },
    allGold: { en: 'Make every lesson in one subject gold', fil: 'Gawing ginto ang lahat ng aralin sa isang asignatura' },
    desk: { n: 20, en: 'Answer 20 desk questions right', fil: 'Sagutin nang tama ang 20 tanong sa mesa' }
  };

  var STARTER_ROOM = { wall: 'home-wall-pink', floor: 'home-floor-wood', placed: ['home-bed', 'home-rug-round'] };

  var BY_ID = {};
  ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  function find(id) { return typeof id === 'string' && own(BY_ID, id) ? BY_ID[id] : null; }
  function inTab(tab) { return ITEMS.filter(function (it) { return it.tab === tab; }); }
  function name(it, grade) { return grade === 'grade2' && (!root.Lang || root.Lang.both()) ? it.fil + ' · ' + it.en : it.en; }
  function countFor(rule, grade) {
    var n = rule.n;
    return n !== null && typeof n === 'object' ? n[grade === 'grade2' ? 'grade2' : 'grade5'] : n;
  }
  // The rule's count for her grade (null when the rule has none).
  function earnCount(it, grade) {
    var rule = it && it.earned ? EARN[it.earned.rule] : null;
    return rule && rule.n !== undefined ? countFor(rule, grade) : null;
  }
  // How to earn a piece, in Grade 2 as a 'Filipino · English' pair when the Filipino switch is on; '' for anything not earned.
  function earnLine(it, grade) {
    var rule = it && it.earned ? EARN[it.earned.rule] : null;
    if (!rule) return '';
    var n = String(countFor(rule, grade)), en = rule.en.split('{n}').join(n), fil = rule.fil.split('{n}').join(n);
    return grade === 'grade2' && (!root.Lang || root.Lang.both()) ? fil + ' · ' + en : en;
  }

  var exported = {
    TABS: TABS, ITEMS: ITEMS, EARN: EARN, STARTER_ROOM: STARTER_ROOM,
    find: find, inTab: inTab, name: name, earnLine: earnLine, earnCount: earnCount
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Furniture = exported;
})(this);
