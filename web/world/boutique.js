/* Lola Lana's Boutique: the wardrobe catalog (items.js) in the shared stall panel (stall.js). */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o: as stall.js, without title, hello, cls and cat.
  function open(o) {
    var I = W.Items;
    return W.Stall.open(Object.assign({}, o, {
      title: '🧶 ' + o.T.boutique, hello: o.T.lanaHello, cls: 'bt-wardrobe',
      cat: {
        groups: I.GROUPS.map(function (g) { return g.id; }).filter(function (id) { return id !== 'props'; }),
        // Found items come only from the world's gifts.
        items: function (g) { return I.inGroup(g).filter(function (it) { return !it.found; }); },
        find: I.find,
        name: function (it) { return I.name(it, o.grade); },
        on: function (l, it) { return l.wear[it.slot] === it.id; },
        put: function (l, it, saved) { l.wear[it.slot] = l.wear[it.slot] === it.id ? saved.wear[it.slot] : it.id; },
        keep: function (l, it) { l.wear[it.slot] = it.id; }
      }
    }));
  }

  W.Boutique = { open: open };
})(this);
