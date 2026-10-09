/* Her emotes: body moves she does from the 😊 Emote row (moves.js draws them). Wave, Clap and Cheer are free; the rest
   are sold at Kuya Pilo's toy stall and owned in wardrobe_v1 like tricks. Pure data, so the Node tests can read it. */
(function (root) {
  'use strict';

  function emote(id, coins, icon, en, fil) { return { id: id, kind: 'emote', coins: coins, icon: icon, en: en, fil: fil }; }
  var EMOTES = [
    emote('emote-wave', 0, '👋', 'Wave', 'Kaway'),
    emote('emote-clap', 0, '👏', 'Clap', 'Palakpak'),
    emote('emote-cheer', 0, '🙌', 'Cheer', 'Hiyaw ng saya'),
    emote('emote-bow', 80, '🙇', 'Bow', 'Yuko'),
    emote('emote-heart', 100, '🫶', 'Heart hands', 'Kamay na puso'),
    emote('emote-giggle', 120, '😂', 'Giggle', 'Hagikgik'),
    emote('emote-spin', 150, '🌀', 'Spin', 'Ikot'),
    emote('emote-relax', 150, '🧘', 'Sit and relax', 'Upo at pahinga'),
    emote('emote-dance', 250, '💃', 'Dance', 'Sayaw'),
    emote('emote-cartwheel', 400, '🤸', 'Cartwheel', 'Pabaligtad na ikot'),
    emote('emote-hero', 500, '🦸', 'Hero pose', 'Pose ng bayani')
  ];

  var BY_ID = {};
  EMOTES.forEach(function (e) { BY_ID[e.id] = e; });
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  function find(id) { return typeof id === 'string' && own(BY_ID, id) ? BY_ID[id] : null; }
  function name(it, grade) { return grade === 'grade2' && (!root.Lang || root.Lang.both()) ? it.fil + ' · ' + it.en : it.en; }
  function owns(owned, id) {
    var e = find(id);
    return !!e && (e.coins === 0 || own(owned, id));
  }
  // What her 😊 Emote row offers, in catalog order.
  function usable(owned) { return EMOTES.filter(function (e) { return owns(owned, e.id); }).map(function (e) { return e.id; }); }

  var exported = { EMOTES: EMOTES, find: find, name: name, owns: owns, usable: usable };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Emotes = exported;
})(this);
