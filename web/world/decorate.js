/* The Decorate view in her room: a small panel at the bottom (coins, tabs, the cards of a tab, ↻ Turn and 📦 Put away
   while a piece is selected, the Yes/No to buy, a message line, ✅ Done) while the camera looks down on the room
   (world-main.js moves it). Squares, no dragging: tapping a piece of hers places it on a good free square, tapping a
   placed piece selects it and the squares where it fits glow, tapping one of those moves it. A piece she does not own
   shows see-through where it would go and asks to buy it. The square rules are room.js; every change is saved at once
   through o.save. cards() is pure, so the Node tests can read it. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Furniture = node ? require('./furniture.js') : root.World3D.Furniture;
  var Room = node ? require('./room.js') : root.World3D.Room;

  function starsItem() { return Furniture.ITEMS.filter(function (it) { return it.kind === 'room' && it.part === 'stars'; })[0]; }

  // Whether piece it is in the room now: placed, or the room's wallpaper, floor or star ceiling.
  function inRoom(it, room) {
    if (it.kind !== 'room') return room.placed.some(function (p) { return p.id === it.id; });
    if (it.part === 'stars') return room.stars === true;
    return room[it.part] === it.id;
  }

  // A tab's cards as she sees them: hers first ('on' in the room, or 'mine'), then for sale ('sale'), then, in the ⭐
  // tab, the earned pieces she has not earned yet ('locked'). The 🎨 tab also lists the star ceiling once she has it.
  function cards(tab, owns, room) {
    var list = Furniture.inTab(tab), mine = [], sale = [], locked = [], stars = starsItem();
    if (tab === 'room' && stars && owns(stars.id)) list = list.concat([stars]);
    list.forEach(function (it) {
      if (owns(it.id)) mine.push({ id: it.id, state: inRoom(it, room) ? 'on' : 'mine' });
      else if (it.earned) locked.push({ id: it.id, state: 'locked' });
      else sale.push({ id: it.id, state: 'sale' });
    });
    return mine.concat(sale, locked);
  }

  // o = { doc, T, grade, view (room3d.js), room() → her room now, save(room) → saved?, owns(id), buy(item) → { ok, why,
  //       need }, balance(), paused(), camera(on, panel) (the fixed view above the panel), onClose() }
  function open(o) {
    var doc = o.doc, T = o.T, view = o.view, F = Furniture;
    var tab = F.TABS[0], sel = null, pending = null, ghostOf = null, shakes = 0;

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
    function fill(text, values) {
      return text.replace(/\{(\w+)\}/g, function (m, k) { return values[k] === undefined ? m : String(values[k]); });
    }

    var box = el('div', 'deco' + (o.grade === 'grade2' ? ' pair' : ''));
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', T.decorate);
    // The coins: the whole line, or on a short screen just 🪙 and the number.
    var top = el('div', 'deco-top'), have = el('div', 'deco-have'), tabs = el('div', 'deco-tabs');
    var haveLine = el('span', 'deco-have-line'), haveShort = el('span', 'deco-have-short');
    have.appendChild(haveLine);
    have.appendChild(haveShort);
    // On a short screen a tab shows only its emoji (the word hides; it stays the button's name).
    F.TABS.forEach(function (id) {
      var b = button('maker-tab', '', function () { showTab(id); }), words = T.tabs[id], cut = words.indexOf(' ');
      b.appendChild(el('span', '', cut > 0 ? words.slice(0, cut) : words));
      if (cut > 0) b.appendChild(el('span', 'deco-tab-word', words.slice(cut)));
      b.setAttribute('aria-label', words);
      b.setAttribute('data-tab', id);
      tabs.appendChild(b);
    });
    top.appendChild(tabs);
    top.appendChild(button('deco-done', T.done, close));
    box.appendChild(top);
    var grid = el('div', 'deco-cards');
    box.appendChild(grid);
    var bar = el('div', 'deco-bar'), msg = el('div', 'deco-msg'), acts = el('div', 'deco-acts'), ask = el('div', 'deco-ask');
    msg.setAttribute('aria-live', 'polite');
    acts.appendChild(button('w-btn deco-turn', T.turn, turn));
    acts.appendChild(button('w-btn deco-away', T.putAway, putAway));
    var askText = el('div', 'deco-ask-text');
    ask.appendChild(askText);
    ask.appendChild(button('w-btn bt-yes', T.yes, yes));
    ask.appendChild(button('w-btn bt-no', T.no, no));
    bar.appendChild(have);
    bar.appendChild(msg);
    bar.appendChild(acts);
    bar.appendChild(ask);
    box.appendChild(bar);

    function room() { return o.room(); }
    function owns(id) { return o.owns(id); }
    function say(text) { msg.textContent = text || ''; }
    function lockedLine(it) { return T.locked.split('{how}').join(F.earnLine(it, o.grade)); }
    function itemAt(k) { var p = room().placed[k]; return p ? F.find(p.id) : null; }

    function render() {
      var r = room();
      haveLine.textContent = T.have.split('{n}').join(String(o.balance()));
      haveShort.textContent = '🪙 ' + o.balance();
      [].forEach.call(tabs.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
      var selId = sel === null ? null : r.placed[sel].id;
      grid.textContent = '';
      cards(tab, owns, r).forEach(function (c) {
        var it = F.find(c.id), card = button('deco-card ' + c.state, '', function () { pick(c.id); });
        card.setAttribute('data-item', c.id);
        card.setAttribute('aria-pressed', c.id === selId || c.id === ghostOf || (c.state === 'on' && it.kind === 'room') ? 'true' : 'false');
        card.appendChild(el('span', 'deco-icon', it.icon));
        card.appendChild(el('span', 'deco-name', F.name(it, o.grade)));
        var sub = c.state === 'on' ? T.placed : c.state === 'mine' ? T.owned : c.state === 'locked' ? lockedLine(it) : '🪙 ' + it.coins;
        card.appendChild(el('span', 'deco-sub', sub));
        grid.appendChild(card);
      });
      acts.hidden = sel === null || !!pending;
      ask.hidden = !pending;
      msg.hidden = !!pending;
    }

    // The selected piece glows, and so do the squares it could move to.
    function looks() {
      view.select(sel);
      view.glow(sel === null ? null : Room.spots(F, room(), sel));
    }
    function setSel(k) {
      sel = k;
      looks();
      say(k === null ? '' : T.decoMove);
      render();
    }
    function commit(next) {
      if (!o.save(next)) say(T.failed);
      looks();
      render();
    }
    function shake() {
      view.shake(sel);
      shakes++;
    }

    function dropGhost() {
      if (!ghostOf) return;
      view.ghost(null);
      view.roomGhost('wall', null);
      view.roomGhost('floor', null);
      view.roomGhost('stars', null);
      ghostOf = null;
    }
    function dropAsk() {
      pending = null;
      dropGhost();
    }

    // A piece she does not own: see-through where it would go, then Yes/No when she can buy it now.
    function offer(it) {
      var p = it.kind === 'room' ? null : Room.autoPlace(F, room(), it.id);
      if (it.kind !== 'room' && !p) return say(T.noRoom);
      if (it.kind === 'room') view.roomGhost(it.part, it.id);
      else view.ghost(p, it.id);
      ghostOf = it.id;
      if (o.paused()) return say(T.paused);
      var short = it.coins - o.balance();
      if (short > 0) return say(fill(T.needMore, { n: short }));
      pending = it;
      askText.textContent = fill(T.confirm, { en: it.en, fil: it.fil, coins: it.coins });
      say('');
    }

    function withPick(r, it) {
      var next = Object.assign({}, r);
      if (it.part === 'stars') next.stars = !r.stars;
      else next[it.part] = it.id;
      return next;
    }

    // A card: place, select, switch the room's look, or offer it for sale.
    function pick(id) {
      var it = F.find(id), r = room();
      dropAsk();
      if (!it) return render();
      if (it.kind === 'room') {
        if (sel !== null) setSel(null);
        if (owns(id)) {
          say('');
          if (it.part === 'stars' || r[it.part] !== id) return commit(withPick(r, it));
        } else if (it.earned) say(lockedLine(it));
        else offer(it);
        return render();
      }
      var k = -1;
      r.placed.forEach(function (p, j) { if (p.id === id) k = j; });
      if (k >= 0) return setSel(sel === k ? null : k);
      if (sel !== null) setSel(null);
      if (owns(id)) {
        var next = Room.place(F, r, id);
        say(next ? '' : T.noRoom);
        if (next) return commit(next);
      } else if (it.earned) say(lockedLine(it));
      else offer(it);
      render();
    }

    function yes() {
      var it = pending;
      if (!it) return;
      pending = null;
      dropGhost();
      var res = o.buy(it);
      if (!res.ok) {
        say(res.why === 'paused' ? T.paused : res.why === 'short' ? fill(T.needMore, { n: res.need || it.coins }) : T.failed);
        return render();
      }
      say(T.bought);
      var next = it.kind === 'room' ? withPick(room(), it) : Room.place(F, room(), it.id);
      if (next) commit(next);
      else render();
    }
    function no() {
      dropAsk();
      say('');
      render();
    }

    // A tap on the room (hit from room3d's view.hit, or null for nothing): select a piece, move the selected one to a
    // square where it fits, or shake it where it does not; anything else lets go of it. While she is asked to buy, a
    // tap on the room is No.
    function tap(hit) {
      if (pending) return no();
      dropGhost();
      var r = room(), k = hit && hit.kind === 'item' ? hit.k : null;
      if (k !== null && k === sel) return setSel(null);
      if (sel !== null) {
        var kind = itemAt(sel).kind, onRug = k !== null && hit.sq && itemAt(k) && itemAt(k).rug ? hit.sq : null;
        var sq = hit && hit.kind === 'floor' ? hit : onRug, next = null;
        if (sq && kind === 'floor') next = Room.move(F, r, sel, sq.c, sq.r);
        else if (hit && hit.kind === 'wall' && kind === 'wall') next = Room.moveWall(F, r, sel, hit.side, hit.i);
        if (next) {
          say(T.decoMove);
          return commit(next);
        }
        if (k === null && hit && (hit.kind === 'floor' || hit.kind === 'wall')) return shake();
      }
      setSel(k);
    }

    function turn() {
      if (sel === null) return;
      var next = Room.turn(F, room(), sel);
      if (next) commit(next);
      else shake();
    }
    function putAway() {
      if (sel === null) return;
      var next = Room.putAway(room(), sel);
      setSel(null);
      commit(next);
    }

    function showTab(id) {
      if (F.TABS.indexOf(id) < 0) return;
      tab = id;
      dropAsk();
      say('');
      render();
    }

    function close() {
      if (!box.parentNode) return;
      dropAsk();
      sel = null;
      view.select(null);
      view.glow(null);
      view.fade(false);
      box.parentNode.removeChild(box);
      o.camera(false);
      o.onClose();
    }

    doc.body.appendChild(box);
    render();
    say(T.decoHello);
    view.fade(true);
    o.camera(true, box);

    return {
      el: box, place: pick, tap: tap, select: function (k) { setSel(k === null || !itemAt(k) ? null : k); }, turn: turn,
      putAway: putAway, yes: yes, no: no, tab: showTab, close: close,
      selected: function () { return sel; },
      asking: function () { return !!pending; },
      message: function () { return msg.textContent; },
      ghost: function () { return ghostOf; },
      shakes: function () { return shakes; },
      cards: function () { return cards(tab, owns, room()); }
    };
  }

  var exported = { cards: cards, inRoom: inRoom, open: open };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Decorate = exported;
})(this);
