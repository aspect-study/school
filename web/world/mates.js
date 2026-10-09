/* The playground's kids (playmates part 1): six friends who are always there, each with a look made from the
   character maker's parts, a favourite ride and the kind of question they ask, and three new kids each time the world
   opens, whose looks never match a friend's. Pure. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Look = node ? require('./look.js') : root.World3D.Look;

  var RIDES = ['slide', 'swings', 'seesaw', 'merry'];
  var NEW_COUNT = 3;

  function look(o) { return Look.clean(Object.assign({ v: 1 }, o)); }

  var FRIENDS = [
    { id: 'migo', name: 'Migo', face: '😄', fav: 'merry', asks: 'fun',
      look: look({ body: 'boy', skin: 2, hair: 'curly', hairColor: 1, outfit: 1, eyes: 'smiley' }) },
    { id: 'ella', name: 'Ella', face: '🌷', fav: 'swings', asks: 'study',
      look: look({ body: 'girl', skin: 1, hair: 'braids', hairColor: 0, outfit: 7, eyes: 'sparkly' }) },
    { id: 'tomas', name: 'Tomas', face: '⚡', fav: 'slide', asks: 'fun',
      look: look({ body: 'boy', skin: 3, hair: 'short', hairColor: 1, outfit: 5, eyes: 'round', freckles: true }) },
    { id: 'bea', name: 'Bea', face: '📋', fav: 'seesaw', asks: 'study',
      look: look({ body: 'girl', skin: 0, hair: 'ponytail', hairColor: 2, outfit: 4, eyes: 'smiley' }) },
    { id: 'jun', name: 'Jun', face: '🔭', fav: 'swings', asks: 'study',
      look: look({ body: 'boy', skin: 6, hair: 'short', hairColor: 0, outfit: 2, eyes: 'round', blush: false }) },
    { id: 'luna', name: 'Luna', face: '🐾', fav: 'merry', asks: 'fun',
      look: look({ body: 'girl', skin: 4, hair: 'curly', hairColor: 1, outfit: 3, eyes: 'sleepy' }) }
  ];

  function lookKey(l) { return [l.body, l.skin, l.hair, l.hairColor, l.outfit, l.eyes].join('|'); }

  function index(n, rand) { return Math.min(n - 1, Math.floor(rand() * n)); }
  function pickOne(list, rand) { return list[index(list.length, rand)]; }

  // A look that clashes with one already taken gets the next outfit colour until it is unique.
  function newKids(rand) {
    var O = Look.OPTIONS, taken = FRIENDS.map(function (f) { return lookKey(f.look); }), out = [];
    while (out.length < NEW_COUNT) {
      var l = look({
        body: pickOne(O.body, rand), skin: index(O.skin.length, rand), hair: pickOne(O.hair, rand),
        hairColor: index(O.hairColor.length, rand), outfit: index(O.outfit.length, rand), eyes: pickOne(O.eyes, rand)
      });
      for (var i = 0; taken.indexOf(lookKey(l)) >= 0 && i < O.outfit.length; i++) l.outfit = (l.outfit + 1) % O.outfit.length;
      for (i = 0; taken.indexOf(lookKey(l)) >= 0 && i < O.skin.length; i++) l.skin = (l.skin + 1) % O.skin.length;
      taken.push(lookKey(l));
      out.push({ id: 'new' + (out.length + 1), name: '', face: '🙂', fav: pickOne(RIDES, rand), asks: 'fun', look: l, isNew: true });
    }
    return out;
  }

  function all(rand) { return FRIENDS.concat(newKids(rand)); }

  var exported = { RIDES: RIDES, FRIENDS: FRIENDS, lookKey: lookKey, newKids: newKids, all: all };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Mates = exported;
})(this);
