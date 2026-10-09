/* The character maker at the mirror: a Me tab (body, skin, hair, eyes, freckles, blush, outfit colour), a Pet tab (which
   pet, its colour, name, where it rides and its gear) and one tab per boutique group listing only what she owns, plus
   None. Every pick calls o.onChange so the 3D preview updates; Done calls o.onDone; the links to Lola Lana's, Mang
   Kiko's and Kuya Pilo's save too and call o.onShop. Opens on her first visit and at the mirror. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { doc, T, look, owned: { itemId: … }, onChange(look), onDone(look), onShop(look) }
  function open(o) {
    var doc = o.doc, T = o.T, t = T.maker, O = W.Look.OPTIONS, I = W.Items, P = W.Pets, buttons = [], panes = {};
    var owned = o.owned || {};
    var look = Object.assign({}, o.look);
    look.wear = Object.assign({}, look.wear);
    look.petWear = Object.assign({}, look.petWear);
    function has(id) { return Object.prototype.hasOwnProperty.call(owned, id) || I.owns(owned, id); }

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function button(cls, text, onClick) {
      var b = el('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    var box = el('div', 'maker');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t.title);
    box.appendChild(el('div', 'maker-title', t.title));
    var tabs = el('div', 'maker-tabs');
    box.appendChild(tabs);

    function pane(id) {
      var b = button('maker-tab', T.tabs[id], function () { show(id); });
      b.setAttribute('data-tab', id);
      tabs.appendChild(b);
      var p = el('div', 'maker-pane');
      p.setAttribute('data-pane', id);
      box.appendChild(p);
      panes[id] = { tab: b, el: p };
      return p;
    }
    function show(id) {
      Object.keys(panes).forEach(function (k) {
        panes[k].el.hidden = k !== id;
        panes[k].tab.setAttribute('aria-pressed', k === id ? 'true' : 'false');
      });
    }

    function get(field) {
      var dot = field.indexOf('.');
      return dot < 0 ? look[field] : look[field.slice(0, dot)][field.slice(dot + 1)];
    }
    function row(parent, label, field, values, draw) {
      var r = el('div', 'maker-row');
      r.appendChild(el('div', 'maker-label', label));
      var list = el('div', 'maker-options');
      values.forEach(function (v) {
        var b = button('maker-opt', '', function () { pick(field, v); });
        b.setAttribute('data-field', field);
        b.setAttribute('data-value', String(v));
        draw(b, v);
        list.appendChild(b);
        buttons.push(b);
      });
      r.appendChild(list);
      parent.appendChild(r);
    }
    function swatches(field) {
      return function (b, i) {
        b.className += ' swatch';
        b.style.background = O[field][i];
        b.setAttribute('aria-label', t[field] + ' ' + (i + 1));
      };
    }
    function named(names) { return function (b, v) { b.textContent = names[v]; }; }
    function indexes(field) { return O[field].map(function (c, i) { return i; }); }
    var onOff = { 'true': T.on, 'false': T.off };

    var me = pane('me');
    row(me, t.body, 'body', O.body, named(t.bodies));
    row(me, t.skin, 'skin', indexes('skin'), swatches('skin'));
    row(me, t.hair, 'hair', O.hair, named(t.hairs));
    row(me, t.hairColor, 'hairColor', indexes('hairColor'), swatches('hairColor'));
    row(me, t.eyes, 'eyes', O.eyes, named(t.eyesNames));
    row(me, t.freckles, 'freckles', O.freckles, named(onOff));
    row(me, t.blush, 'blush', O.blush, named(onOff));
    row(me, t.outfit, 'outfit', indexes('outfit'), swatches('outfit'));

    var pp = pane('pet');
    var pets = P.PETS.filter(function (p) { return p.coins === 0 || has(p.id); });
    row(pp, t.pet, 'pet', pets.map(function (p) { return p.id; }), function (b, v) { b.textContent = P.find(v).icon + ' ' + P.find(v).en; });
    row(pp, t.petColor, 'petColor', [0, 1, 2, 3, 4], function (b, i) {
      b.className += ' swatch';
      b.setAttribute('aria-label', t.petColor + ' ' + (i + 1));
    });
    var nameRow = el('label', 'maker-row maker-label', t.petName);
    var input = el('input', 'maker-name');
    input.type = 'text';
    input.maxLength = 12;
    input.value = look.petName;
    input.addEventListener('input', function () { look.petName = input.value; });
    nameRow.appendChild(doc.createElement('br'));
    nameRow.appendChild(input);
    pp.appendChild(nameRow);
    row(pp, t.petSpot, 'petSpot', P.SPOTS, named(t.spots));
    P.GEAR_SLOTS.forEach(function (slot) {
      var gear = P.GEAR.filter(function (g) { return g.slot === slot && has(g.id); });
      if (!gear.length) return;
      row(pp, t.petSlots[slot], 'petWear.' + slot, [''].concat(gear.map(function (g) { return g.id; })), function (b, v) {
        b.textContent = v ? P.find(v).icon + ' ' + P.find(v).en : t.none;
      });
    });

    I.GROUPS.forEach(function (g) {
      var p = pane(g.id);
      g.slots.forEach(function (slot) {
        var mine = I.ITEMS.filter(function (it) { return it.slot === slot && has(it.id); });
        if (!mine.length) return;
        row(p, t.slots[slot], 'wear.' + slot, [''].concat(mine.map(function (it) { return it.id; })), function (b, v) {
          b.textContent = v ? I.find(v).icon + ' ' + I.find(v).en : t.none;
        });
      });
    });

    box.appendChild(button('maker-shop', T.shopMore, shop));
    box.appendChild(button('maker-shop', T.petsMore, shop));
    box.appendChild(button('maker-shop', T.toysMore, shop));
    box.appendChild(button('maker-done', t.done, finish));

    function mark() {
      var p = P.find(look.pet) || P.find('chick'), spots = P.SIZES[p.size];
      buttons.forEach(function (b) {
        var f = b.getAttribute('data-field'), v = b.getAttribute('data-value');
        b.setAttribute('aria-pressed', String(get(f)) === v ? 'true' : 'false');
        if (f === 'petSpot') b.hidden = spots.indexOf(v) < 0;
        if (f === 'petColor') b.style.background = p.colors[Number(v)];
      });
      input.placeholder = p.name;
    }
    function snapshot() {
      var c = Object.assign({}, look);
      c.wear = Object.assign({}, look.wear);
      c.petWear = Object.assign({}, look.petWear);
      return c;
    }
    function pick(field, v) {
      var dot = field.indexOf('.');
      if (dot < 0) look[field] = v;
      else look[field.slice(0, dot)][field.slice(dot + 1)] = v;
      if (field === 'pet' && P.spotsFor(v).indexOf(look.petSpot) < 0) look.petSpot = 'walk';
      mark();
      o.onChange(snapshot());
    }
    function close() {
      if (!box.parentNode) return false;
      box.parentNode.removeChild(box);
      return true;
    }
    function finish() { if (close()) o.onDone(snapshot()); }
    function shop() { if (close()) o.onShop(snapshot()); }

    doc.body.appendChild(box);
    show('me');
    mark();
    if (buttons[0]) buttons[0].focus();
    return { pick: pick, tab: show, done: finish, el: box };
  }

  W.Maker = { open: open };
})(this);
