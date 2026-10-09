/* The wardrobe catalog: what Lola Lana sells, the slot each item fills and its price in coins. Pure data, so the Node
   tests can read it. wearable() keeps only real items she owns, each in its own slot. */
(function (root) {
  'use strict';

  var SLOTS = ['clothes', 'hat', 'glasses', 'back', 'neck', 'sticker', 'paint', 'dye', 'shimmer', 'prop'];
  // The boutique tabs and the mirror tabs, in this order. Props are sold at Kuya Pilo's toy stall, not the boutique.
  var GROUPS = [
    { id: 'clothes', slots: ['clothes'] },
    { id: 'hats', slots: ['hat'] },
    { id: 'accessories', slots: ['glasses', 'back', 'neck'] },
    { id: 'face', slots: ['sticker', 'paint'] },
    { id: 'hair', slots: ['dye', 'shimmer'] },
    { id: 'props', slots: ['prop'] }
  ];

  // tint: the item takes her outfit colour.
  function item(id, slot, coins, icon, en, fil, tint) {
    return { id: id, slot: slot, coins: coins, icon: icon, en: en, fil: fil, tint: !!tint };
  }
  // Found only in the world's Hard gifts (loot.js), never sold: hers only once found.
  function found(id, slot, icon, en, fil) {
    var it = item(id, slot, 0, icon, en, fil);
    it.found = true;
    return it;
  }
  var ITEMS = [
    item('hoodie', 'clothes', 150, '🧥', 'Hoodie', 'Jaket na may talukbong', true),
    item('overalls', 'clothes', 150, '👖', 'Overalls', 'Oberols'),
    item('raincoat', 'clothes', 200, '🌧️', 'Raincoat', 'Kapote'),
    item('jersey', 'clothes', 200, '🎽', 'Sports jersey', 'Damit pang-isports', true),
    item('uniform', 'clothes', 250, '🏫', 'School uniform', 'Uniporme sa paaralan'),
    item('princess', 'clothes', 450, '👗', 'Princess dress', 'Damit-prinsesa', true),
    item('hero', 'clothes', 500, '🦸', 'Superhero suit', 'Kasuotang superhero'),
    item('filipiniana', 'clothes', 600, '👘', 'Filipiniana or barong', 'Filipiniana o barong'),
    item('cap', 'hat', 50, '🧢', 'Cap', 'Gora'),
    item('sunhat', 'hat', 80, '👒', 'Sun hat', 'Sombrero pang-araw'),
    item('beanie', 'hat', 100, '🧶', 'Beanie', 'Bonete', true),
    item('flowercrown', 'hat', 150, '🌸', 'Flower crown', 'Korona ng bulaklak'),
    item('bunnyears', 'hat', 200, '🐰', 'Bunny ears', 'Tainga ng kuneho'),
    item('wizard', 'hat', 250, '🧙', 'Wizard hat', 'Sombrero ng salamangkero'),
    item('salakot', 'hat', 300, '🌾', 'Salakot hat', 'Salakot'),
    item('crown', 'hat', 700, '👑', 'Crown', 'Korona'),
    item('roundglasses', 'glasses', 100, '👓', 'Round glasses', 'Bilog na salamin'),
    item('starglasses', 'glasses', 150, '🕶️', 'Star sunglasses', 'Salaming pang-araw na hugis bituin'),
    item('scarf', 'neck', 100, '🧣', 'Scarf', 'Bupanda', true),
    item('bowtie', 'neck', 100, '🎀', 'Bow tie', 'Kurbatang paru-paro'),
    item('backpack', 'back', 200, '🎒', 'Backpack', 'Bag sa likod'),
    item('angelwings', 'back', 500, '😇', 'Angel wings', 'Pakpak ng anghel'),
    item('butterflywings', 'back', 600, '🦋', 'Butterfly wings', 'Pakpak ng paru-paro'),
    item('fairywings', 'back', 800, '🧚', 'Fairy wings', 'Pakpak ng diwata'),
    item('heartsticker', 'sticker', 50, '💖', 'Heart sticker', 'Sticker na puso'),
    item('starsticker', 'sticker', 50, '⭐', 'Star sticker', 'Sticker na bituin'),
    item('rainbowsticker', 'sticker', 80, '🌈', 'Rainbow sticker', 'Sticker na bahaghari'),
    item('sparklecheeks', 'sticker', 100, '✨', 'Sparkle cheeks', 'Kumikinang na pisngi'),
    item('whiskers', 'paint', 80, '🐱', 'Cat whiskers', 'Bigote ng pusa'),
    item('flag', 'paint', 120, '🇵🇭', 'Flag face paint', 'Pinta ng watawat sa mukha'),
    item('butterfly', 'paint', 150, '🦋', 'Butterfly face paint', 'Pinta ng paru-paro sa mukha'),
    item('tiger', 'paint', 200, '🐯', 'Tiger face paint', 'Pinta ng tigre sa mukha'),
    item('goldhair', 'dye', 200, '💛', 'Gold hair', 'Gintong buhok'),
    item('pastelhair', 'dye', 250, '🍬', 'Pastel hair', 'Pastel na buhok'),
    item('glitterhair', 'dye', 300, '💫', 'Glitter hair', 'Makinang na buhok'),
    item('rainbowhair', 'dye', 400, '🌈', 'Rainbow hair', 'Bahagharing buhok'),
    item('galaxyhair', 'dye', 500, '🌌', 'Galaxy hair', 'Buhok na parang kalawakan'),
    item('goldshimmer', 'shimmer', 600, '🌟', 'Gold shimmer', 'Gintong kinang'),
    item('pinkshimmer', 'shimmer', 600, '💗', 'Pink shimmer', 'Kulay-rosas na kinang'),
    item('silvershimmer', 'shimmer', 600, '🤍', 'Silver shimmer', 'Pilak na kinang'),
    item('balloon', 'prop', 0, '🎈', 'Balloon', 'Lobo'),
    item('bubblewand', 'prop', 80, '🫧', 'Bubble wand', 'Pang-bula'),
    item('pamaypay', 'prop', 80, '🪭', 'Pamaypay fan', 'Pamaypay'),
    item('teddy', 'prop', 100, '🧸', 'Teddy plushie', 'Laruang oso'),
    item('bouquet', 'prop', 120, '💐', 'Flower bouquet', 'Pumpon ng bulaklak'),
    item('umbrella', 'prop', 150, '☂️', 'Umbrella', 'Payong'),
    item('ribbonwand', 'prop', 200, '🎀', 'Ribbon wand', 'Lasong pang-ikot'),
    item('drum', 'prop', 200, '🥁', 'Drum', 'Tambol'),
    item('parol', 'prop', 250, '⭐', 'Parol lantern', 'Parol'),
    item('ukulele', 'prop', 300, '🎸', 'Ukulele', 'Maliit na gitara'),
    item('magicwand', 'prop', 500, '🪄', 'Magic wand', 'Mahiwagang wand'),
    item('trophy', 'prop', 800, '🏆', 'Golden trophy', 'Gintong tropeo'),
    found('moonsticker', 'sticker', '🌙', 'Moon sticker', 'Sticker na buwan'),
    found('cloversticker', 'sticker', '🍀', 'Clover sticker', 'Sticker na klober'),
    found('daisysticker', 'sticker', '🌼', 'Daisy sticker', 'Sticker na daisy'),
    found('boltpaint', 'paint', '⚡', 'Lightning face paint', 'Pinta ng kidlat sa mukha'),
    found('minthair', 'dye', '🌿', 'Mint hair', 'Buhok na kulay mint'),
    found('sunsethair', 'dye', '🌅', 'Sunset hair', 'Buhok na kulay dapithapon'),
    found('mintshimmer', 'shimmer', '🍃', 'Mint shimmer', 'Kinang na kulay mint'),
    found('lavendershimmer', 'shimmer', '💜', 'Lavender shimmer', 'Kinang na kulay lavender')
  ];
  var FOUND = ITEMS.filter(function (it) { return it.found; });

  var BY_ID = {};
  ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  function find(id) { return own(BY_ID, id) ? BY_ID[id] : null; }
  // A free item (the balloon) is always hers, like the free pets, tricks and the ball. A found item is hers once found.
  function owns(owned, id) {
    var it = find(id);
    return !!it && ((it.coins === 0 && !it.found) || own(owned, id));
  }
  function groupOf(slot) { return GROUPS.filter(function (g) { return g.slots.indexOf(slot) >= 0; })[0].id; }
  function inGroup(id) { return ITEMS.filter(function (it) { return groupOf(it.slot) === id; }); }
  function name(it, grade) { return grade === 'grade2' && (!root.Lang || root.Lang.both()) ? it.fil + ' · ' + it.en : it.en; }
  function emptyWear() {
    var w = {};
    SLOTS.forEach(function (s) { w[s] = ''; });
    return w;
  }

  // owned: { itemId: {...} } from closet.js, or null to skip the ownership check (her sister, drawn as she saved it).
  function wearable(look, owned) {
    var out = Object.assign({}, look), wear = {};
    SLOTS.forEach(function (s) {
      var id = look && look.wear ? look.wear[s] : '', it = find(id);
      wear[s] = it && it.slot === s && (owned === null || owns(owned, id)) ? id : '';
    });
    out.wear = wear;
    return out;
  }

  // Panels only show items she owns that this version knows, so a slot left empty there keeps a stored item she does
  // not own yet (bought on another device, waiting for wardrobe_v1 to sync) or one from a newer version.
  function keepUnowned(stored, edited, owned) {
    var out = Object.assign({}, edited), wear = Object.assign({}, edited.wear), was = (stored && stored.wear) || {};
    SLOTS.forEach(function (s) {
      if (!wear[s] && was[s] && !owns(owned, was[s])) wear[s] = was[s];
    });
    out.wear = wear;
    return out;
  }

  var exported = {
    SLOTS: SLOTS, GROUPS: GROUPS, ITEMS: ITEMS, FOUND: FOUND, find: find, groupOf: groupOf, inGroup: inGroup, name: name, emptyWear: emptyWear,
    owns: owns, wearable: wearable, keepUnowned: keepUnowned
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Items = exported;
})(this);
