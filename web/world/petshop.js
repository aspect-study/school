/* Mang Kiko's Pet Stall: the paid pets, pet gear, tricks and toys (pets.js) in the shared stall panel (stall.js).
   Trying a pet swaps the pet beside her; gear goes on whichever pet is shown; a trick or a toy is shown by the pet
   (o.demo). */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o: as stall.js, without title, hello, cls and cat; plus demo(id) to show a trick or a toy.
  function open(o) {
    var P = W.Pets;
    var shows = function (it) { return it.kind === 'trick' || it.kind === 'toy'; };
    return W.Stall.open(Object.assign({}, o, {
      title: '🦜 ' + o.T.petshop, hello: o.T.kikoHello, cls: 'bt-pets',
      cat: {
        groups: P.GROUPS,
        items: P.inGroup,
        find: P.find,
        name: function (it) { return P.name(it, o.grade); },
        on: function (l, it) { return shows(it) ? false : it.kind === 'pet' ? l.pet === it.id : l.petWear[it.slot] === it.id; },
        // A new pet comes in its natural colour (swatch 0); taking the try back off brings hers back as it was.
        put: function (l, it, saved) {
          if (shows(it)) return;
          if (it.kind !== 'pet') l.petWear[it.slot] = l.petWear[it.slot] === it.id ? saved.petWear[it.slot] : it.id;
          else if (l.pet === it.id) {
            l.pet = saved.pet;
            l.petColor = saved.petColor;
          } else {
            l.pet = it.id;
            l.petColor = 0;
          }
        },
        keep: function (l, it) {
          if (shows(it)) return;
          if (it.kind !== 'pet') l.petWear[it.slot] = it.id;
          else {
            l.pet = it.id;
            l.petColor = 0;
          }
        },
        play: function (it) {
          if (!shows(it)) return false;
          if (o.demo) o.demo(it.id);
          return true;
        }
      }
    }));
  }

  W.PetShop = { open: open };
})(this);
