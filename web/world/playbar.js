/* The 🎾 Play button beside 🍪 Treat and the row it opens: her toys, then her tricks (pets.js playable). Tap one and
   her pet does it; a tap anywhere else closes the row. Buttons are English on both grades. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { doc, T, owned() → wardrobe_v1 owned map, pick(id), onOpen() optional }
  function create(o) {
    var doc = o.doc, row = doc.createElement('div'), btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'w-pill w-play';
    btn.textContent = o.T.play;
    btn.setAttribute('aria-expanded', 'false');
    row.className = 'w-playrow';
    row.hidden = true;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', o.T.play);

    function open() {
      if (o.onOpen) o.onOpen();
      row.textContent = '';
      W.Pets.playable(o.owned()).forEach(function (it) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'w-pill w-play-item';
        b.setAttribute('data-play', it.id);
        b.textContent = it.icon + ' ' + it.en;
        b.addEventListener('click', function () {
          close();
          o.pick(it.id);
        });
        row.appendChild(b);
      });
      row.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      row.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function () { if (row.hidden) open(); else close(); });
    doc.addEventListener('pointerdown', function (e) {
      if (!row.hidden && !row.contains(e.target) && e.target !== btn) close();
    });
    doc.body.appendChild(row);
    (doc.getElementById('w-rail') || doc.body).appendChild(btn);

    return {
      open: open, close: close,
      isOpen: function () { return !row.hidden; },
      items: function () { return [].map.call(row.querySelectorAll('[data-play]'), function (b) { return b.getAttribute('data-play'); }); },
      press: function (id) {
        var b = row.querySelector('[data-play="' + id + '"]');
        if (b) b.click();
        return !!b;
      },
      show: function (on) {
        if (btn.hidden === on) btn.hidden = !on;
        if (!on && !row.hidden) close();
      }
    };
  }

  W.PlayBar = { create: create };
})(this);
