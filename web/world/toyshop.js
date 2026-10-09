/* Kuya Pilo's Toy Stall: the props (items.js) and the emotes (emotes.js) in the shared stall panel (stall.js). Trying a
   prop puts it in her hand; an emote is shown by her doing it once (o.demo). */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o: as stall.js, without title, hello, cls and cat; plus demo(id) to show an emote.
  function open(o) {
    var I = W.Items, E = W.Emotes;
    var isEmote = function (it) { return it.kind === 'emote'; };
    return W.Stall.open(Object.assign({}, o, {
      title: '🎈 ' + o.T.toyshop, hello: o.T.piloHello, cls: 'bt-toys',
      cat: {
        groups: ['props', 'emotes'],
        items: function (g) { return g === 'emotes' ? E.EMOTES.slice() : I.inGroup('props'); },
        find: function (id) { return E.find(id) || I.find(id); },
        name: function (it) { return isEmote(it) ? E.name(it, o.grade) : I.name(it, o.grade); },
        on: function (l, it) { return !isEmote(it) && l.wear.prop === it.id; },
        put: function (l, it, saved) { if (!isEmote(it)) l.wear.prop = l.wear.prop === it.id ? saved.wear.prop : it.id; },
        keep: function (l, it) { if (!isEmote(it)) l.wear.prop = it.id; },
        play: function (it) {
          if (!isEmote(it)) return false;
          if (o.demo) o.demo(it.id);
          return true;
        }
      }
    }));
  }

  W.ToyShop = { open: open };
})(this);
