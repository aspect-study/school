/* 🎁 Gifts and monsters in the world, the pure part. loot_v1 keeps today's world coins (at most CAP) and the questions
   asked today. A question's tier comes from her own review boxes: Hard = due in box 1 (missed before), Medium = due in a
   higher box, Easy = never answered; a resting question is never asked. Hard pays a found-only item (items.js FOUND)
   she does not have yet. Timers say when a gift or a monster appears, spots say where (a hangout place, away from her,
   never the playground), and wander() walks a monster round its place. loot3d.js draws it all. */
(function (root) {
  'use strict';

  var KEY = 'loot_v1', CAP = 15;
  var COINS = { easy: 1, medium: 2, hard: 3 };
  var ORDER = ['hard', 'medium', 'easy'];
  var GIFT = { first: 60, min: 180, max: 300, most: 3, away: 12 };
  var MONSTER = { first: 90, min: 120, max: 240, most: 2, away: 20 };
  var PLACES = ['gate', 'plaza', 'street', 'garden', 'shop', 'park', 'house'];
  var SPEED = 2.2, HELPER_AT = 3;

  var KINDS = [
    { id: 'grumble', name: 'Grumble', face: '😤', color: '#c3a2ff', accent: '#7b5cff', eye: '#3a2a4f' },
    { id: 'sniffle', name: 'Sniffle', face: '🤧', color: '#9fd3ff', accent: '#4a90d9', eye: '#23395b' },
    { id: 'muddle', name: 'Muddle', face: '🌀', color: '#a8e6a0', accent: '#4fae5c', eye: '#2a4a2e' },
    { id: 'fizzle', name: 'Fizzle', face: '🫧', color: '#ffc58f', accent: '#ff8c42', eye: '#5a3418' }
  ];

  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  function pair(fil, en) { return fil + ' · ' + en; }
  function coinWord(n) { return n === 1 ? ' coin' : ' coins'; }

  var TEXT = {
    grade5: {
      title: 'Gifts and monsters in the Campus', gift: 'Gift box', thinking: 'Hmm, let me find a question… 🤔',
      tiers: { easy: '⭐ Easy', medium: '⭐⭐ Medium', hard: '⭐⭐⭐ Hard' },
      giftAsk: 'Answer to open me! 🎁', opened: '🎉 Right! The gift is open!', earned: '🎉 A gift from the monster!',
      points: function (p) { return p > 0 ? '+' + p + ' points' : ''; },
      coins: function (n) { return '🪙 You got ' + n + coinWord(n) + '!'; },
      capped: 'Your world coins are full for today. Your points still count!',
      found: function (it) { return '✨ You found ' + it.en + '! Wear it at the mirror.'; },
      stillClosed: 'Still closed! Try another question?',
      none: 'No new questions right now. Come back tomorrow! 🎁', fail: "I can't find my questions right now. Try again later!",
      hello: ['Grrr! Answer my question!', 'Hehe! Can you beat me?', 'Boo! Try my question!'],
      defeated: 'Pop! You did it! I left you a gift! 🎁', called: 'Hehe! I called a friend!', helperBye: 'Hehe! Bye!',
      monsterNone: 'You know everything today! Bye!'
    },
    grade2: L({
      title: 'Mga regalo at halimaw sa Bayan · Gifts and monsters in the Village',
      gift: 'Regalo · Gift box', thinking: 'Hmm, hahanap ako ng tanong… 🤔 · Hmm, let me find a question… 🤔',
      tiers: { easy: '⭐ Madali · Easy', medium: '⭐⭐ Katamtaman · Medium', hard: '⭐⭐⭐ Mahirap · Hard' },
      giftAsk: 'Sagutin para mabuksan ako! 🎁 · Answer to open me! 🎁',
      opened: '🎉 Tama! Bukas na ang regalo! · Right! The gift is open!',
      earned: '🎉 Regalo mula sa halimaw! · A gift from the monster!',
      points: function (p) { return p > 0 ? pair('+' + p + ' puntos', '+' + p + ' points') : ''; },
      coins: function (n) { return pair('🪙 Nakakuha ka ng ' + n + ' coins!', 'You got ' + n + coinWord(n) + '!'); },
      capped: pair('Puno na ang world coins mo ngayong araw. May puntos ka pa rin!', 'Your world coins are full for today. Your points still count!'),
      found: function (it) { return pair('✨ Nakita mo ang ' + it.fil + '! Isuot ito sa salamin.', 'You found ' + it.en + '! Wear it at the mirror.'); },
      stillClosed: pair('Sarado pa rin! Subukan ang ibang tanong?', 'Still closed! Try another question?'),
      none: pair('Wala pang bagong tanong ngayon. Balik ka bukas! 🎁', 'No new questions right now. Come back tomorrow! 🎁'),
      fail: pair('Hindi ko mahanap ang mga tanong ko ngayon. Subukan ulit mamaya!', "I can't find my questions right now. Try again later!"),
      hello: [
        pair('Grrr! Sagutin mo ang tanong ko!', 'Grrr! Answer my question!'),
        pair('Hehe! Kaya mo ba akong talunin?', 'Hehe! Can you beat me?'),
        pair('Bulaga! Subukan ang tanong ko!', 'Boo! Try my question!')
      ],
      defeated: pair('Pop! Nagawa mo! May iniwan akong regalo! 🎁', 'Pop! You did it! I left you a gift! 🎁'),
      called: pair('Hehe! Tinawag ko ang kaibigan ko!', 'Hehe! I called a friend!'),
      helperBye: pair('Hehe! Paalam!', 'Hehe! Bye!'),
      monsterNone: pair('Alam mo na lahat ngayon! Paalam!', 'You know everything today! Bye!')
    })
  };
  // Buttons and tap labels are English on both grades.
  var BUTTONS = { open: '🎁 Open the gift', battle: '⚔️ Battle {name}', again: '🔁 Try again' };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // loot_v1 for today: a new day starts empty. Bad JSON reads as empty.
  function read(storage, day) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    if (!isObj(d) || d.v !== 1 || d.day !== day) return { v: 1, day: day, coins: 0, asked: [], t: 0 };
    return {
      v: 1, day: day, coins: Math.max(0, Math.min(CAP, Math.floor(Number(d.coins) || 0))),
      asked: Array.isArray(d.asked) ? d.asked.filter(function (k) { return typeof k === 'string'; }) : [],
      t: Number(d.t) || 0
    };
  }
  function write(storage, s) { try { storage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  function markAsked(storage, day, key, now) {
    var s = read(storage, day);
    if (s.asked.indexOf(key) < 0) s.asked.push(key);
    s.t = now;
    write(storage, s);
  }
  // How many of a tier's coins still fit under today's cap.
  function room(storage, day, tier) { return Math.max(0, Math.min(COINS[tier] || 0, CAP - read(storage, day).coins)); }
  function paid(storage, day, n, now) {
    var s = read(storage, day);
    s.coins = Math.min(CAP, s.coins + n);
    s.t = now;
    write(storage, s);
  }

  // st: Recall.status(key).
  function tierOf(st) {
    if (!st || st.status === 'rest') return null;
    if (st.status === 'new') return 'easy';
    return st.box <= 1 ? 'hard' : 'medium';
  }

  // cands: [{ key, tier, ... }]. The highest tier not asked today, at random within it; null when none.
  function choose(cands, asked, rand) {
    for (var i = 0; i < ORDER.length; i++) {
      var ok = cands.filter(function (c) { return c.tier === ORDER[i] && asked.indexOf(c.key) < 0; });
      if (ok.length) return ok[Math.floor(rand() * ok.length) % ok.length];
    }
    return null;
  }

  // A found item she does not own yet (ids from Items.FOUND), or null.
  function foundPick(ids, owned, rand) {
    var left = ids.filter(function (id) { return !(owned && Object.prototype.hasOwnProperty.call(owned, id)); });
    return left.length ? left[Math.floor(rand() * left.length) % left.length] : null;
  }

  // A spawn timer: due(dt, count) is true when one should appear now. At the most, the timer starts a new wait.
  function timer(cfg, rand) {
    var left = cfg.first;
    function wait() { return cfg.min + rand() * (cfg.max - cfg.min); }
    return {
      due: function (dt, count) {
        left -= dt;
        if (left > 0) return false;
        left = wait();
        return count < cfg.most;
      },
      left: function () { return left; }
    };
  }

  function inArea(h, rand) {
    if (h.hx) return { x: h.x + (rand() * 2 - 1) * h.hx, z: h.z + (rand() * 2 - 1) * h.hz };
    var a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * h.r;
    return { x: h.x + Math.cos(a) * d, z: h.z + Math.sin(a) * d };
  }

  // A free spot in one of the hangout places (never the playground), at least away from her: { x, z, place }, or null.
  function spot(hangouts, her, away, rand, blocked) {
    var places = hangouts.filter(function (h) { return PLACES.indexOf(h.id) >= 0; });
    for (var i = places.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1)), t = places[i];
      places[i] = places[j];
      places[j] = t;
    }
    for (var n = 0; n < places.length; n++) {
      for (var k = 0; k < 8; k++) {
        var p = inArea(places[n], rand);
        if (Math.hypot(p.x - her.x, p.z - her.z) >= away && !blocked(p.x, p.z, 1.2)) return { x: p.x, z: p.z, place: places[n].id };
      }
    }
    return null;
  }

  function areaOf(hangouts, id) { return hangouts.filter(function (h) { return h.id === id; })[0] || null; }

  // m = { x, z, area, tx, tz, wait, face }: rests a little, then walks to a new point of its place. True while walking.
  function wander(m, dt, rand, blocked) {
    if (m.wait > 0) {
      m.wait -= dt;
      return false;
    }
    if (m.tx === undefined) {
      var p = inArea(m.area, rand);
      if (blocked(p.x, p.z, 1)) { m.wait = 0.5; return false; }
      m.tx = p.x;
      m.tz = p.z;
    }
    var dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz), step = SPEED * dt;
    if (d <= step) {
      m.x = m.tx;
      m.z = m.tz;
      m.tx = m.tz = undefined;
      m.wait = 1.5 + rand() * 2.5;
      return false;
    }
    var nx = m.x + dx / d * step, nz = m.z + dz / d * step;
    if (blocked(nx, nz, 1)) {
      m.tx = m.tz = undefined;
      m.wait = 0.5;
      return false;
    }
    m.x = nx;
    m.z = nz;
    m.face = Math.atan2(dx, dz);
    return true;
  }

  // Where a helper pops in: HELPER_AT from the monster, first free direction.
  function helperSpot(m, blocked) {
    for (var i = 0; i < 8; i++) {
      var a = (m.face || 0) + Math.PI / 2 + i * Math.PI / 4, x = m.x + Math.sin(a) * HELPER_AT, z = m.z + Math.cos(a) * HELPER_AT;
      if (!blocked(x, z, 1)) return { x: x, z: z };
    }
    return { x: m.x, z: m.z };
  }

  var exported = {
    KEY: KEY, CAP: CAP, COINS: COINS, ORDER: ORDER, GIFT: GIFT, MONSTER: MONSTER, PLACES: PLACES, KINDS: KINDS, TEXT: TEXT, BUTTONS: BUTTONS,
    read: read, markAsked: markAsked, room: room, paid: paid, tierOf: tierOf, choose: choose, foundPick: foundPick,
    timer: timer, spot: spot, areaOf: areaOf, wander: wander, helperSpot: helperSpot
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Loot = exported;
})(this);
