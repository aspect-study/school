/* Tito Tasyo's Workshop: My Room's catalog (furniture.js) in the shared stall panel (stall.js). Tapping a piece shows it
   turning on a little display stand (world-main.js draws it from look.homeTry); a piece bought here waits, unplaced, for
   the Decorate view. Earned pieces are never for sale: the ⭐ tab shows how to earn the ones she has not got yet. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o: as stall.js, without title, hello, cls and cat. owned() also counts the free starters and her earned pieces.
  function open(o) {
    var F = W.Furniture, T = o.T;
    return W.Stall.open(Object.assign({}, o, {
      title: '🔨 ' + T.tasyo, hello: T.tasyoHello, cls: 'bt-home',
      cat: {
        groups: F.TABS.slice(),
        items: function (g) { return F.inTab(g); },
        find: F.find,
        name: function (it) { return F.name(it, o.grade); },
        on: function (l, it) { return l.homeTry === it.id; },
        put: function (l, it, saved) { l.homeTry = l.homeTry === it.id ? saved.homeTry : it.id; },
        keep: function () {},
        note: function (it) {
          if (!it.earned || Object.prototype.hasOwnProperty.call(o.owned(), it.id)) return '';
          return T.locked.split('{how}').join(F.earnLine(it, o.grade));
        }
      }
    }));
  }

  W.Carpenter = { open: open };
})(this);
