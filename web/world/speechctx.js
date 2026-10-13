/* The facts about her that a character's line can depend on, as { tags, slots }. Pure: world-main.js reads the real game
   state and passes plain values in. Nothing here is stored or sent anywhere. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var WEAR_SLOTS = ['hat', 'glasses', 'neck', 'back'];

  function part(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  function plain(label) { return String(label || '').replace(/^[^\p{L}\p{N}]+/u, '').trim(); }

  // i = { hour, her: { x, z }, spots: [{ tag, x, z, r }], wear: { slot: itemId }, itemName(id), petSpecies, petName, streak,
  //       afterRide, tired, fav: [{ q, choice, label }] }
  function build(i) {
    var tags = ['time:' + part(i.hour)], slots = {};
    (i.spots || []).forEach(function (s) {
      if (Math.hypot(i.her.x - s.x, i.her.z - s.z) <= s.r) tags.push(s.tag);
    });
    WEAR_SLOTS.forEach(function (s) {
      var id = i.wear && i.wear[s], name = id && i.itemName ? i.itemName(id) : '';
      if (name) {
        tags.push('wearing:' + s);
        slots[s] = name;
      }
    });
    if (i.petSpecies) tags.push('pet:' + i.petSpecies);
    if (i.petName) slots.pet = i.petName;
    var n = Number(i.streak) || 0;
    if (n >= 3) tags.push('streak:3');
    if (n >= 7) tags.push('streak:7');
    if (n > 0) slots.streak = String(n);
    if (i.afterRide) tags.push('after:ride');
    if (i.tired) tags.push('tired');
    (i.fav || []).forEach(function (f) {
      tags.push('fav:' + f.q + ':' + f.choice);
      slots['fav_' + f.q] = plain(f.label);
    });
    return { tags: tags, slots: slots };
  }

  var exported = { build: build, part: part };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.SpeechCtx = exported;
})(this);
