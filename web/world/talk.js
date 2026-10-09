/* The speech bubble for the world's characters: a face, a name, the words, and buttons. One bubble at a time; a button
   or Escape closes it (then runs that button's action). Questions use the helper line and a column of answers. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var count = 0;

  var SEP = ' · ', LONG = 160;

  // A Grade 2 line "Filipino · English" reads easier as two lines: [Filipino, English].
  function halves(text) {
    var i = text.lastIndexOf(SEP);
    return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + SEP.length)];
  }

  // Outside the Filipino games, a pair shows only its English half unless the 🇵🇭 Filipino switch is on or keepFil is set
  // (the Filipino and Makabansa buildings). Without Lang (Node) the pair stays whole.
  function shown(text, keepFil) {
    var L = root.Lang;
    return keepFil || !L || L.both() ? text : L.en(text);
  }

  // o = { doc, face, who, text, sub (smaller lines under it, one paragraph per line), stack (buttons in a column, for
  //       answers), pair (text is "Filipino · English": show the English on its own line; keepFil keeps both halves whatever the switch says), buttons: [{ text, main, onClick }],
  //       teach ({ pickedLabel, picked, answerLabel, answer, steps }: the pet teacher's two chips and numbered steps), onClose }
  function open(o) {
    var doc = o.doc, done = false, before = doc.activeElement;
    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    var id = 'talk-' + (++count), box = el('div', 'talk');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', o.who);
    box.appendChild(el('div', 'talk-who', o.face + ' ' + o.who));
    var say = o.pair ? halves(shown(o.text, o.keepFil)) : [o.text, ''], ids = [id + '-say'];
    var live = el('div', '');
    live.setAttribute('aria-live', 'polite');
    live.appendChild(el('p', 'talk-say', say[0])).id = id + '-say';
    if (say[1]) {
      live.appendChild(el('p', 'talk-en', say[1])).id = id + '-en';
      ids.push(id + '-en');
    }
    if (o.sub) {
      var sub = el('div', 'talk-sub' + (o.sub.length > LONG ? ' long' : ''));
      sub.id = id + '-sub';
      o.sub.split('\n').forEach(function (line) { if (line) sub.appendChild(el('p', '', line)); });
      live.appendChild(sub);
      ids.push(sub.id);
    }
    if (o.teach) {
      var tc = el('div', 'talk-teach');
      tc.id = id + '-teach';
      [['bad', o.teach.pickedLabel, o.teach.picked], ['good', o.teach.answerLabel, o.teach.answer]].forEach(function (c) {
        var chip = el('p', 'talk-chip ' + c[0]);
        chip.appendChild(el('span', 'talk-chip-label', c[1]));
        chip.appendChild(el('span', 'talk-chip-text', c[2]));
        tc.appendChild(chip);
      });
      var ol = el('ol', 'talk-steps');
      (o.teach.steps || []).forEach(function (s) { ol.appendChild(el('li', '', s)); });
      tc.appendChild(ol);
      live.appendChild(tc);
      ids.push(tc.id);
    }
    box.setAttribute('aria-describedby', ids.join(' '));
    box.appendChild(live);
    var row = el('div', 'talk-row' + (o.stack ? ' stack' : ''));
    // The main button comes first, for her eyes and for the keyboard.
    o.buttons.filter(function (b) { return b.main; }).concat(o.buttons.filter(function (b) { return !b.main; })).forEach(function (b) {
      var btn = el('button', 'talk-btn' + (b.main ? ' main' : ''), b.text);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        close();
        if (b.onClick) b.onClick();
      });
      row.appendChild(btn);
    });
    box.appendChild(row);

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      if (done) return;
      done = true;
      doc.removeEventListener('keydown', onKey);
      if (box.parentNode) box.parentNode.removeChild(box);
      if (before && before.focus && doc.body.contains(before)) before.focus();
      if (o.onClose) o.onClose();
    }

    doc.addEventListener('keydown', onKey);
    doc.body.appendChild(box);
    var first = row.querySelector('button');
    // Focusing a button low in a long bubble would scroll the words out of sight; she reads from the top.
    if (first) first.focus({ preventScroll: true });
    box.scrollTop = 0;
    return { close: close, el: box };
  }

  W.Talk = { open: open, shown: shown };
})(this);
