/* A shop stall panel: tabs of things to try on, try-ons that stack (one per slot), and Buy with a plain Yes/No. Lola
   Lana's Boutique (boutique.js) and Mang Kiko's Pet Stall (petshop.js) open it with their own catalog. Only Yes keeps
   an item; closing puts back her saved look (try-ons live only here, in memory). */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  function copy(l) {
    var c = Object.assign({}, l);
    c.wear = Object.assign({}, l.wear);
    c.petWear = Object.assign({}, l.petWear);
    return c;
  }

  // o = { doc, T, grade, look (saved, wearable), owned() → map, balance() → coins, paused() → bool,
  //       buy(item) → { ok, why, need }, onTry(look), onBought(item, trying, keep(look) → look), onClose(),
  //       title, hello, cls, cat }
  // cat = { groups: [id], items(group) → [item], find(id), name(item), on(look, item) → worn?,
  //         put(look, item, saved) (try it on, or back to what she had), keep(look, item) (wear it for good),
  //         play(item) → true when it shows the item (a trick, a toy) instead of trying it on; optional,
  //         note(item) → text for an item that cannot be bought (how to earn it), shown instead of a price; optional }
  function open(o) {
    var doc = o.doc, T = o.T, cat = o.cat, saved = copy(o.look), trying = copy(o.look), tab = cat.groups[0], pending = null;

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

    var box = el('div', 'maker boutique' + (o.cls ? ' ' + o.cls : ''));
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', o.title);
    box.appendChild(el('div', 'maker-title', o.title));
    box.appendChild(el('div', 'bt-line', o.hello));
    var have = el('div', 'bt-have');
    box.appendChild(have);
    var note = el('div', 'bt-note');
    box.appendChild(note);
    var tabs = el('div', 'maker-tabs');
    cat.groups.forEach(function (id) {
      var b = button('maker-tab', T.tabs[id], function () { show(id); });
      b.setAttribute('data-tab', id);
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
    var grid = el('div', 'bt-grid');
    box.appendChild(grid);
    var ask = el('div', 'bt-confirm');
    ask.hidden = true;
    var askText = el('div', 'bt-confirm-text');
    ask.appendChild(askText);
    var yesBtn = button('w-btn bt-yes', T.yes, yes);
    ask.appendChild(yesBtn);
    ask.appendChild(button('w-btn bt-no', T.no, no));
    box.appendChild(ask);
    var msg = el('div', 'bt-msg');
    msg.setAttribute('aria-live', 'polite');
    box.appendChild(msg);
    box.appendChild(button('maker-done', T.close, close));

    function render() {
      var coins = o.balance(), owned = o.owned(), paused = o.paused();
      have.textContent = T.have.split('{n}').join(String(coins));
      note.textContent = paused ? T.paused : '';
      note.hidden = !paused;
      [].forEach.call(tabs.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
      grid.textContent = '';
      cat.items(tab).forEach(function (it) {
        var card = el('div', 'bt-card');
        card.setAttribute('data-item', it.id);
        var on = cat.on(trying, it);
        var tryBtn = button('bt-try', '', function () { tryOn(it.id); });
        tryBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        tryBtn.appendChild(el('span', 'bt-icon', it.icon));
        tryBtn.appendChild(el('span', 'bt-name', cat.name(it)));
        card.appendChild(tryBtn);
        var locked = cat.note ? cat.note(it) : '';
        if (Object.prototype.hasOwnProperty.call(owned, it.id)) {
          card.appendChild(el('div', 'bt-owned', T.owned));
        } else if (locked) {
          card.appendChild(el('div', 'bt-earn', locked));
        } else if (it.coins === 0) {
          card.appendChild(el('div', 'bt-owned', T.free));
        } else {
          card.appendChild(el('div', 'bt-price', '🪙 ' + it.coins));
          var bar = el('div', 'bt-bar'), fill = el('span');
          fill.style.width = Math.min(100, Math.round(coins / it.coins * 100)) + '%';
          bar.appendChild(fill);
          card.appendChild(bar);
          var short = coins < it.coins;
          var buyBtn = button('w-btn bt-buy', short && !paused ? T.need.replace('{n}', String(it.coins - coins)) : T.buy, function () { buy(it.id); });
          buyBtn.disabled = short || paused;
          card.appendChild(buyBtn);
        }
        grid.appendChild(card);
      });
    }

    function into(e) { if (e.scrollIntoView) e.scrollIntoView({ block: 'nearest' }); }
    // render() rebuilds the cards, so focus goes back to the same button.
    function refocus(sel) {
      var b = box.querySelector(sel);
      if (b) b.focus();
    }

    function show(id) {
      tab = id;
      ask.hidden = true;
      pending = null;
      render();
      refocus('.maker-tab[data-tab="' + id + '"]');
    }

    function tryOn(id) {
      var it = cat.find(id);
      if (!it) return;
      msg.textContent = '';
      if (!(cat.play && cat.play(it))) {
        cat.put(trying, it, saved);
        o.onTry(copy(trying));
        render();
      }
      refocus('.bt-card[data-item="' + id + '"] .bt-try');
    }

    function buy(id) {
      var it = cat.find(id);
      if (!it || (cat.note && cat.note(it))) return;
      pending = it;
      if (!cat.on(trying, it)) tryOn(id);
      askText.textContent = T.confirm.split('{en}').join(it.en).split('{fil}').join(it.fil).split('{coins}').join(String(it.coins));
      ask.hidden = false;
      into(ask);
      yesBtn.focus();
    }

    function yes() {
      var it = pending;
      ask.hidden = true;
      pending = null;
      if (!it) return;
      var r = o.buy(it);
      if (r.ok) {
        cat.keep(saved, it);
        cat.keep(trying, it);
        msg.textContent = T.bought;
        o.onBought(it, copy(trying), function (l) { var c = copy(l); cat.keep(c, it); return c; });
      } else {
        msg.textContent = r.why === 'failed' ? T.failed : r.why === 'paused' ? T.paused : T.notEnough;
      }
      render();
      refocus('.bt-card[data-item="' + it.id + '"] .bt-try');
      into(msg);
    }

    function no() {
      var it = pending;
      ask.hidden = true;
      pending = null;
      if (it) refocus('.bt-card[data-item="' + it.id + '"] .bt-try');
    }
    function asking() { return !ask.hidden; }

    function close() {
      if (!box.parentNode) return;
      box.parentNode.removeChild(box);
      o.onClose();
    }

    doc.body.appendChild(box);
    show(cat.groups[0]);
    return { el: box, tab: show, tryOn: tryOn, buy: buy, yes: yes, no: no, asking: asking, close: close };
  }

  W.Stall = { open: open };
})(this);
