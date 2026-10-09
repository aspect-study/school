/* The pet stall's catalog: 16 pets (3 free) with their sizes and colours, pet gear, tricks and toys. Pure data, so the Node tests can
   read it. Paid pets and gear share wardrobe_v1's owned list with Lola Lana's items. wearable() keeps only what she can
   have out: a free or owned pet, owned gear in its own slot, a colour in range and a spot its size allows. */
(function (root) {
  'use strict';

  var COLORS = 5;
  var SPOTS = ['walk', 'shoulder', 'head', 'arms'];
  var SIZES = { small: ['walk', 'shoulder', 'head'], medium: ['walk', 'arms'], big: ['walk'] };
  var GEAR_SLOTS = ['hat', 'neck', 'back', 'glasses'];
  var GROUPS = ['pets', 'gear', 'tricks', 'toys'];

  // name: the pet's default name until she gives it one. colors[0] is its natural colour.
  function pet(id, size, coins, icon, en, fil, name, colors) {
    return { id: id, kind: 'pet', size: size, coins: coins, icon: icon, en: en, fil: fil, name: name, colors: colors };
  }
  function gear(id, slot, coins, icon, en, fil) {
    return { id: id, kind: 'gear', slot: slot, coins: coins, icon: icon, en: en, fil: fil };
  }
  var PETS = [
    pet('chick', 'small', 0, '🐥', 'Chick', 'Sisiw', 'Piyo', ['#ffe066', '#ffffff', '#ffb3c7', '#9ed8ff', '#c7f2a4']),
    pet('kitten', 'medium', 0, '🐱', 'Kitten', 'Kuting', 'Muning', ['#ffb86b', '#f5f0e8', '#8a8a8a', '#4a4a4a', '#d9b3ff']),
    pet('puppy', 'medium', 0, '🐶', 'Puppy', 'Tuta', 'Bantay', ['#f2d1a8', '#ffffff', '#8b5a2b', '#3a3a3a', '#ffc2d6']),
    pet('hamster', 'small', 150, '🐹', 'Hamster', 'Hamster', 'Mochi', ['#f4c27a', '#ffffff', '#c8a27a', '#9b9b9b', '#ffd1e8']),
    pet('duckling', 'small', 150, '🦆', 'Duckling', 'Bibe', 'Bibo', ['#ffd43b', '#ffffff', '#c9b28a', '#8fd3ff', '#ffb3c7']),
    pet('bunny', 'medium', 200, '🐰', 'Bunny', 'Kuneho', 'Puti', ['#ffffff', '#d9c3a5', '#9b8b80', '#ffd1e8', '#c9b6ff']),
    pet('turtle', 'medium', 200, '🐢', 'Turtle', 'Pagong', 'Pong', ['#7bc96f', '#4fb3a8', '#a3d977', '#c9a26b', '#9fa8ff']),
    pet('piglet', 'medium', 250, '🐷', 'Piglet', 'Biik', 'Bilog', ['#ffb3c7', '#f5e6d8', '#d98c8c', '#7a6a6a', '#c9b6ff']),
    pet('parrot', 'small', 300, '🦜', 'Parrot', 'Loro', 'Loro', ['#5fcf6a', '#4cb8e0', '#ff6f61', '#ffd43b', '#b39dff']),
    pet('carabao', 'big', 400, '🐃', 'Carabao calf', 'Batang kalabaw', 'Bugoy', ['#8c8c94', '#8b6a55', '#c9b8a6', '#f0c9c0', '#9fb3c8']),
    pet('penguin', 'medium', 400, '🐧', 'Penguin', 'Penguin', 'Yelo', ['#2f3e55', '#5a6b8c', '#7a5c9e', '#2f6b5a', '#8c4a5a']),
    pet('fox', 'medium', 450, '🦊', 'Fox', 'Soro', 'Kahel', ['#ff8c42', '#f5f5f5', '#d9534f', '#b0b8c4', '#ffb3d1']),
    pet('tarsier', 'small', 500, '🐒', 'Tarsier', 'Tarsier', 'Mata', ['#b08968', '#d8c3a5', '#8d6e63', '#c9b6a0', '#e0b8c8']),
    pet('panda', 'big', 500, '🐼', 'Panda', 'Panda', 'Bao', ['#ffffff', '#fff2d9', '#ffd6e7', '#d9fff0', '#e6dcff']),
    pet('unicorn', 'big', 800, '🦄', 'Unicorn pony', 'Kabayong unicorn', 'Kislap', ['#ffffff', '#ffd1e8', '#e3d5ff', '#d5ecff', '#fff0b3']),
    pet('dragon', 'big', 800, '🐉', 'Baby dragon', 'Batang dragon', 'Apoy', ['#7bd389', '#b39dff', '#ff9ecb', '#7fc8ff', '#ff7b6b'])
  ];
  var GEAR = [
    gear('pet-partyhat', 'hat', 50, '🥳', 'Party hat', 'Sombrerong pampista'),
    gear('pet-bow', 'hat', 50, '🎀', 'Bow', 'Laso'),
    gear('pet-flower', 'hat', 80, '🌼', 'Flower', 'Bulaklak'),
    gear('pet-wizard', 'hat', 150, '🧙', 'Wizard hat', 'Sombrero ng salamangkero'),
    gear('pet-crown', 'hat', 300, '👑', 'Tiny crown', 'Munting korona'),
    gear('pet-bell', 'neck', 50, '🔔', 'Bell collar', 'Kolyar na may kampanilya'),
    gear('pet-bandana', 'neck', 80, '🔺', 'Bandana', 'Bandana'),
    gear('pet-bowtie', 'neck', 80, '🤵', 'Bow tie', 'Kurbatang paru-paro'),
    gear('pet-scarf', 'neck', 100, '🧣', 'Scarf', 'Bupanda'),
    gear('pet-pack', 'back', 150, '🎒', 'Mini backpack', 'Munting bag sa likod'),
    gear('pet-cape', 'back', 200, '🦸', 'Cape', 'Kapa'),
    gear('pet-wings', 'back', 400, '🕊️', 'Tiny wings', 'Munting pakpak'),
    gear('pet-sunglasses', 'glasses', 100, '🕶️', 'Sunglasses', 'Salaming pang-araw'),
    gear('pet-starglasses', 'glasses', 150, '⭐', 'Star glasses', 'Salaming hugis bituin')
  ];
  // Tricks and toys belong to her, not to one pet. len: how long a trick lasts (s). range: how far a toy flies,
  // flight: how long it is in the air (s), dig: the pet digs it up before it carries it.
  function trick(id, coins, icon, en, fil, len) {
    return { id: id, kind: 'trick', coins: coins, icon: icon, en: en, fil: fil, len: len };
  }
  function toy(id, coins, icon, en, fil, range, flight, dig) {
    return { id: id, kind: 'toy', coins: coins, icon: icon, en: en, fil: fil, range: range, flight: flight, dig: dig };
  }
  var TRICKS = [
    trick('trick-bow', 0, '🙇', 'Bow', 'Yuko', 1.2),
    trick('trick-spin', 100, '🌀', 'Spin', 'Ikot', 1.2),
    trick('trick-jump', 150, '🦘', 'Jump', 'Talon', 1.2),
    trick('trick-roll', 200, '🔄', 'Roll over', 'Pagulong', 1.2),
    trick('trick-dance', 300, '💃', 'Dance', 'Sayaw', 2),
    trick('trick-twirl', 450, '🌪️', 'Twirl jump', 'Paikot na talon', 1.2),
    trick('trick-backflip', 600, '🤸', 'Backflip', 'Pabaligtad na talon', 1.2)
  ];
  var TOYS = [
    toy('toy-ball', 0, '🎾', 'Ball', 'Bola', 8, 0.6, false),
    toy('toy-bone', 80, '🦴', 'Bone', 'Buto', 6, 0.6, true),
    toy('toy-frisbee', 100, '🥏', 'Frisbee', 'Frisbee', 12, 0.9, false)
  ];

  var BY_ID = {};
  PETS.concat(GEAR, TRICKS, TOYS).forEach(function (x) { BY_ID[x.id] = x; });
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  function find(id) { return typeof id === 'string' && own(BY_ID, id) ? BY_ID[id] : null; }
  function petOf(id) { var p = find(id); return p && p.kind === 'pet' ? p : null; }
  function spotsFor(id) { var p = petOf(id); return SIZES[p ? p.size : 'big'].slice(); }
  function inGroup(id) {
    if (id === 'pets') return PETS.filter(function (p) { return p.coins > 0; });
    if (id === 'tricks') return TRICKS.slice();
    if (id === 'toys') return TOYS.slice();
    return id === 'gear' ? GEAR.slice() : [];
  }
  function name(it, grade) { return grade === 'grade2' && it.fil !== it.en && (!root.Lang || root.Lang.both()) ? it.fil + ' · ' + it.en : it.en; }
  function emptyWear() {
    var w = {};
    GEAR_SLOTS.forEach(function (s) { w[s] = ''; });
    return w;
  }
  // owned = null skips the ownership check (her sister, drawn as she saved it).
  function has(owned, it) { return it.coins === 0 || owned === null || own(owned, it.id); }
  function owns(owned, id) {
    var it = find(id);
    return !!it && (it.coins === 0 || own(owned || {}, id));
  }
  // What her Play row offers: her toys, then her tricks.
  function playable(owned) {
    return TOYS.concat(TRICKS).filter(function (x) { return owns(owned, x.id); });
  }
  // The trick her pet shows off with for a new medal: her dearest one; Jump when she only has Bow.
  function bestTrick(owned) {
    var best = null;
    TRICKS.forEach(function (t) { if (t.coins > 0 && own(owned || {}, t.id) && (!best || t.coins > best.coins)) best = t; });
    return best ? best.id : 'trick-jump';
  }

  function wearable(look, owned) {
    var l = look || {}, out = Object.assign({}, l), p = petOf(l.pet), w = l.petWear || {};
    // The chick stands in for a pet she cannot have out, in its own colour, walking.
    if (!p || !has(owned, p)) {
      p = BY_ID.chick;
      l = Object.assign({}, l, { petColor: 0, petSpot: 'walk' });
    }
    out.pet = p.id;
    out.petColor = Number.isInteger(l.petColor) && l.petColor >= 0 && l.petColor < p.colors.length ? l.petColor : 0;
    out.petSpot = SIZES[p.size].indexOf(l.petSpot) >= 0 ? l.petSpot : 'walk';
    out.petWear = {};
    GEAR_SLOTS.forEach(function (s) {
      var g = find(w[s]);
      out.petWear[s] = g && g.kind === 'gear' && g.slot === s && has(owned, g) ? g.id : '';
    });
    return out;
  }

  // The mirror lists only what she has here, so it shows the chick in place of a pet she has not got yet (bought on
  // another device, waiting for wardrobe_v1 to sync, or from a newer version) and an empty slot for such gear.
  function keepUnowned(stored, edited, owned) {
    var out = Object.assign({}, edited), wear = Object.assign({}, edited.petWear), s = stored || {}, was = s.petWear || {};
    var sp = petOf(s.pet), hidden = typeof s.pet === 'string' && s.pet !== 'chick' && (sp ? !has(owned, sp) : !find(s.pet));
    if (hidden && out.pet === 'chick') {
      out.pet = s.pet;
      out.petColor = s.petColor;
      out.petSpot = s.petSpot;
    }
    GEAR_SLOTS.forEach(function (k) {
      var g = find(was[k]);
      if (!wear[k] && was[k] && (g ? g.kind === 'gear' && g.slot === k && !has(owned, g) : true)) wear[k] = was[k];
    });
    out.petWear = wear;
    return out;
  }

  var exported = {
    COLORS: COLORS, SPOTS: SPOTS, SIZES: SIZES, GEAR_SLOTS: GEAR_SLOTS, GROUPS: GROUPS, PETS: PETS, GEAR: GEAR,
    TRICKS: TRICKS, TOYS: TOYS, owns: owns, playable: playable, bestTrick: bestTrick,
    find: find, spotsFor: spotsFor, inGroup: inGroup, name: name, emptyWear: emptyWear, wearable: wearable, keepUnowned: keepUnowned
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Pets = exported;
})(this);
