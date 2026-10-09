/* Her character's look, saved per learner as avatar_v1 and synced (replace merge), so her sister can see it later.
   Colours are stored as indexes into OPTIONS, so new colours are only ever appended. wear holds one wardrobe item id
   per slot (items.js) and petWear one pet gear id per slot (pets.js); pet ids and item ids from a newer device are
   kept, and items.wearable() / pets.wearable() decide what is drawn. */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Items = node ? require('./items.js') : root.World3D.Items;
  var Pets = node ? require('./pets.js') : root.World3D.Pets;
  var KEY = 'avatar_v1';
  var NAME_MAX = 12;
  var ID = /^[a-z0-9-]{1,32}$/;
  var OPTIONS = {
    body: ['girl', 'boy'],
    skin: ['#ffe0c7', '#f6c9a0', '#e0a878', '#b97d52', '#8a5634', '#fff0e1', '#d49a6a', '#a86b3c', '#704524', '#4f3020'],
    hair: ['pigtails', 'bob', 'short', 'braids', 'ponytail', 'curly'],
    hairColor: ['#5a3a2e', '#2b2140', '#a0522d', '#e8b04a', '#f4a6c8', '#7b5cff', '#4cb8e0', '#ff7f7f'],
    outfit: ['#ff8fc8', '#6aa9ff', '#5fcf9a', '#ffd166', '#a77bff', '#ff9e6b', '#4cc9a0', '#ff6f91'],
    eyes: ['round', 'sleepy', 'sparkly', 'smiley'],
    freckles: [false, true],
    blush: [true, false]
  };
  var INDEXED = { skin: true, hairColor: true, outfit: true };
  var DEFAULT = { v: 1, body: 'girl', skin: 0, hair: 'pigtails', hairColor: 0, outfit: 0, pet: 'chick', eyes: 'round', freckles: false, blush: true,
    petName: '', wear: Items.emptyWear(), petColor: 0, petSpot: 'walk', petWear: Pets.emptyWear(), t: 0 };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function cleanName(s) {
    return typeof s === 'string' ? Array.from(s.replace(/[\x00-\x1f\x7f<>&"\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').trim()).slice(0, NAME_MAX).join('').trim() : '';
  }

  function clean(raw) {
    var d = isObj(raw) && raw.v === 1 ? raw : {};
    var out = { v: 1 };
    Object.keys(OPTIONS).forEach(function (k) {
      var ok = INDEXED[k] ? Number.isInteger(d[k]) && d[k] >= 0 && d[k] < OPTIONS[k].length : OPTIONS[k].indexOf(d[k]) >= 0;
      out[k] = ok ? d[k] : DEFAULT[k];
    });
    out.petName = cleanName(d.petName);
    out.pet = typeof d.pet === 'string' && ID.test(d.pet) ? d.pet : DEFAULT.pet;
    out.petColor = Number.isInteger(d.petColor) && d.petColor >= 0 && d.petColor < Pets.COLORS ? d.petColor : 0;
    out.petSpot = Pets.SPOTS.indexOf(d.petSpot) >= 0 ? d.petSpot : 'walk';
    var pw = isObj(d.petWear) ? d.petWear : {};
    out.petWear = {};
    Pets.GEAR_SLOTS.forEach(function (s) { out.petWear[s] = typeof pw[s] === 'string' && ID.test(pw[s]) ? pw[s] : ''; });
    var w = isObj(d.wear) ? d.wear : {};
    out.wear = {};
    Items.SLOTS.forEach(function (s) { out.wear[s] = typeof w[s] === 'string' && ID.test(w[s]) ? w[s] : ''; });
    out.t = Number.isFinite(d.t) && d.t > 0 ? d.t : 0;
    return out;
  }

  // A boy with no character yet starts with the boy body and short hair.
  function forKid(look, boy) {
    if (!(look.t > 0) && boy) { look.body = 'boy'; look.hair = 'short'; }
    return look;
  }

  function read(storage, boy) {
    var raw = null;
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    var look = forKid(clean(raw), boy);
    return { look: look, made: look.t > 0 };
  }

  function save(storage, look, now) {
    var out = clean(Object.assign({}, look, { v: 1 }));
    out.t = now;
    try { storage.setItem(KEY, JSON.stringify(out)); } catch (e) {}
    return out;
  }

  function color(look, field) { return OPTIONS[field][look[field]]; }
  function petName(look) {
    var p = Pets.find(look.pet);
    return look.petName || (p && p.kind === 'pet' ? p : Pets.find('chick')).name;
  }

  var exported = { KEY: KEY, OPTIONS: OPTIONS, DEFAULT: DEFAULT, clean: clean, forKid: forKid, read: read, save: save, color: color, petName: petName };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Look = exported;
})(this);
