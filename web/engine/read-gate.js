/* The reviewer lock: the quiz opens only after every flashcard was on screen long enough to read.
   A game calls ReadGate.open({ cards, faces, next, start }) when a lesson opens, and ReadGate.show(card, face, el)
   every time a card (or a flip-card face) is shown. next/start are button ids; start is left out when Next turns
   into Start Quiz on the last card. Prev is never locked, and a card read once stays read until the lesson closes. */
(function (root) {
  'use strict';

  var TEXT = {
    grade5: {
      locked: function (n, total) { return '📖 Read every card to unlock the quiz (' + n + ' of ' + total + ' read)'; },
      flip: '👆 Tap the card to read the other side too.',
      done: '✅ You read every card. Start the quiz!'
    },
    grade2: {
      locked: function (n, total) { return '📖 Read every card first (' + n + ' of ' + total + ') · Basahin muna ang lahat ng card'; },
      flip: '👆 Tap the card to read the other side. · Pindutin ang card para mabasa ang kabila.',
      done: '✅ You read every card! · Nabasa mo na lahat!'
    }
  };

  // The least time a card face stays up before it counts as read: a fast reader's pace, so only skipping is stopped.
  var PACE = {
    grade5: { perWord: 200, min: 2000, max: 25000 },
    grade2: { perWord: 350, min: 3000, max: 25000 }
  };

  function wordCount(text) {
    return String(text || '').split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w); }).length;
  }

  function readMs(text, grade) {
    var p = PACE[grade] || PACE.grade5;
    return Math.min(p.max, Math.max(p.min, wordCount(text) * p.perWord));
  }

  // The rules, with no DOM or clock: time comes in through tick(now, active).
  // Time on a face adds up across visits, so flipping back and forth never starts it over.
  function controller(cards, faces) {
    var spent = [], need = [], read = [];
    for (var c = 0; c < cards; c++) { spent.push({}); need.push({}); read.push({}); }
    var cur = null, last = 0;

    function cardRead(c) {
      for (var f = 0; f < faces; f++) if (!read[c][f]) return false;
      return true;
    }
    // A side not shown yet counts as 0, so a flip card with only its front read is half done.
    function cardProgress(c) {
      var sum = 0;
      for (var f = 0; f < faces; f++) sum += read[c][f] ? 1 : need[c][f] ? Math.min(1, spent[c][f] / need[c][f]) : 0;
      return sum / faces;
    }
    function readCount() {
      var n = 0;
      for (var c = 0; c < cards; c++) if (cardRead(c)) n++;
      return n;
    }

    return {
      show: function (card, face, ms, now) {
        cur = { card: card, face: face };
        need[card][face] = ms;
        spent[card][face] = spent[card][face] || 0;
        last = now;
      },
      tick: function (now, active) {
        if (!cur) return;
        if (active) spent[cur.card][cur.face] += Math.max(0, now - last);
        last = now;
        if (spent[cur.card][cur.face] >= need[cur.card][cur.face]) read[cur.card][cur.face] = true;
      },
      status: function () {
        var faceRead = !cur || !!read[cur.card][cur.face];
        var n = readCount();
        return {
          nextLocked: !!cur && !cardRead(cur.card),
          progress: cur ? cardProgress(cur.card) : 1,
          faceRead: faceRead,
          flip: !!cur && faceRead && !cardRead(cur.card),
          last: !!cur && cur.card === cards - 1,
          read: n,
          total: cards,
          allRead: n === cards
        };
      }
    };
  }

  var LOCK = 'data-read-lock';
  var CSS =
    '[' + LOCK + ']{position:relative;overflow:hidden;opacity:.6;cursor:not-allowed;}' +
    '[' + LOCK + ']::after{content:"";position:absolute;left:0;bottom:0;height:5px;width:calc(var(--read,0) * 100%);' +
      'background:currentColor;opacity:.7;transition:width .1s linear;}' +
    '.read-gate-note{margin:10px auto 0;max-width:520px;text-align:center;font-weight:700;font-size:.92rem;line-height:1.4;' +
      'color:var(--muted,#555);}' +
    '.read-gate-note.done{color:var(--good,#15803d);}';

  function grade() {
    var s = typeof document !== 'undefined' && document.currentScript;
    return (s && s.getAttribute('data-grade')) || 'grade5';
  }

  function browser(g) {
    var text = TEXT[g] || TEXT.grade5;
    var gate = null, ids = null, timer = null, note = null;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // A locked button stays clickable for the page's own disabled rules; this stops the click before any handler runs.
    // It catches the clock up first, so a click the moment the card is read goes through.
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[' + LOCK + ']');
      if (!b) return;
      if (gate) step();
      if (!b.hasAttribute(LOCK)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    // Timers can freeze while the app is in the background: count up to the moment it hid, and nothing while hidden.
    document.addEventListener('visibilitychange', function () {
      if (!gate) return;
      gate.tick(Date.now(), document.hidden);
      paint();
    });

    function setLock(id, locked, progress) {
      var b = id && document.getElementById(id);
      if (!b) return;
      if (locked) {
        b.setAttribute(LOCK, '');
        b.setAttribute('aria-disabled', 'true');
        b.style.setProperty('--read', progress);
      } else {
        b.removeAttribute(LOCK);
        b.removeAttribute('aria-disabled');
        b.style.removeProperty('--read');
      }
    }

    function noteEl() {
      var next = document.getElementById(ids.next);
      var row = next && next.parentNode;
      if (!row) return null;
      if (!note || note.previousSibling !== row) {
        if (note) note.remove();
        note = document.createElement('div');
        note.className = 'read-gate-note';
        note.setAttribute('aria-live', 'polite');
        row.parentNode.insertBefore(note, row.nextSibling);
      }
      return note;
    }

    function paint() {
      var s = gate.status();
      // With no Start button, Next on the last card is Start Quiz.
      var nextLocked = ids.start == null && s.last ? !s.allRead : s.nextLocked;
      setLock(ids.next, nextLocked, s.progress);
      setLock(ids.start, !s.allRead, s.allRead ? 1 : s.read / s.total);
      var el = noteEl();
      if (!el) return;
      var line = s.allRead ? text.done : s.flip ? text.flip : text.locked(s.read, s.total);
      if (el.textContent !== line) el.textContent = line;
      el.classList.toggle('done', s.allRead);
      if (s.faceRead && timer) { clearInterval(timer); timer = null; }
    }

    function step() {
      gate.tick(Date.now(), !document.hidden);
      paint();
    }

    return {
      open: function (o) {
        gate = controller(o.cards, o.faces || 1);
        ids = { next: o.next, start: o.start == null ? null : o.start };
      },
      show: function (card, face, el) {
        if (!gate) return;
        gate.tick(Date.now(), !document.hidden);
        gate.show(card, face || 0, readMs(el ? el.textContent : '', g), Date.now());
        if (!timer) timer = setInterval(step, 100);
        paint();
      }
    };
  }

  var api = { TEXT: TEXT, PACE: PACE, wordCount: wordCount, readMs: readMs, controller: controller };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    var b = browser(grade());
    api.open = b.open;
    api.show = b.show;
    root.ReadGate = api;
  }
})(typeof window !== 'undefined' ? window : this);
