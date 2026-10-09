/* The ✨ Use button (shown while she holds a prop) and the 😊 Emote button with the row of her emotes (emotes.js).
   Tap an emote and she does it; a tap anywhere else closes the row. Buttons are English on both grades. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { doc, T, owned() → wardrobe_v1 owned map, held() → her prop id or '', use(), pick(id), onOpen() }
  function create(o) {
    var doc = o.doc, row = doc.createElement('div');
    function pill(cls, text, onClick) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'w-pill ' + cls;
      b.textContent = text;
      b.addEventListener('click', onClick);
      return b;
    }
    var useBtn = pill('w-use', o.T.use, function () { o.use(); });
    var emoteBtn = pill('w-emote', o.T.emote, function () { if (row.hidden) open(); else close(); });
    emoteBtn.setAttribute('aria-expanded', 'false');
    row.className = 'w-emoterow';
    row.hidden = true;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', o.T.emote);

    function open() {
      if (o.onOpen) o.onOpen();
      row.textContent = '';
      W.Emotes.usable(o.owned()).forEach(function (id) {
        var it = W.Emotes.find(id), b = pill('w-play-item', it.icon + ' ' + it.en, function () {
          close();
          o.pick(id);
        });
        b.setAttribute('data-emote', id);
        row.appendChild(b);
      });
      row.hidden = false;
      emoteBtn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      row.hidden = true;
      emoteBtn.setAttribute('aria-expanded', 'false');
    }

    doc.addEventListener('pointerdown', function (e) {
      if (!row.hidden && !row.contains(e.target) && e.target !== emoteBtn) close();
    });
    doc.body.appendChild(row);
    var rail = doc.getElementById('w-rail') || doc.body;
    rail.appendChild(emoteBtn);
    rail.appendChild(useBtn);

    return {
      open: open, close: close,
      isOpen: function () { return !row.hidden; },
      items: function () { return [].map.call(row.querySelectorAll('[data-emote]'), function (b) { return b.getAttribute('data-emote'); }); },
      press: function (id) {
        var b = row.querySelector('[data-emote="' + id + '"]');
        if (b) b.click();
        return !!b;
      },
      use: function () { if (!useBtn.hidden) useBtn.click(); return !useBtn.hidden; },
      useShown: function () { return !useBtn.hidden; },
      show: function (on) {
        var noUse = !on || !o.held();
        if (emoteBtn.hidden === on) emoteBtn.hidden = !on;
        if (useBtn.hidden !== noUse) useBtn.hidden = noUse;
        if (!on && !row.hidden) close();
      }
    };
  }

  W.UseBar = { create: create };
})(this);
