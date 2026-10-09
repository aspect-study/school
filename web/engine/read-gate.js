/* The reviewer lock: the quiz opens only after every flashcard was shown once. There is no wait on a card.
   A game calls ReadGate.open({ cards, next, start }) when a lesson opens, and ReadGate.show(card) every time a card
   is shown. next/start are button ids; start is left out when Next turns into Start Quiz on the last card.
   Next and Prev are free, and a card seen once stays seen until the lesson closes. */
(function (root) {
  'use strict';

  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  function forGrade(grade, table) { return grade === 'grade2' ? L(table) : table; }

  var CHEER = {
    grade5: { last: ' · Last one! 🏁', half: ' · Over halfway! 💪', some: ' · Nice! 👍' },
    grade2: { last: ' · Last one! Huling card na! 🏁', half: ' · Halfway! Kalahati na! 💪', some: ' · Nice! Galing! 👍' }
  };

  function cheer(g, n, total) {
    var c = CHEER[g];
    if (total - n === 1) return c.last;
    if (n * 2 >= total) return c.half;
    return n > 0 ? c.some : '';
  }

  var TEXT = {
    grade5: {
      locked: function (n, total) { return '📖 Read every card to unlock the quiz (' + n + ' of ' + total + ' read)' + cheer('grade5', n, total); },
      done: '✅ You read every card. Start the quiz!'
    },
    grade2: {
      locked: function (n, total) { return '📖 Read every card first (' + n + ' of ' + total + ') · Basahin muna ang lahat ng card' + cheer('grade2', n, total); },
      done: '✅ You read every card! · Nabasa mo na lahat!'
    }
  };

  // The rules, with no DOM.
  function controller(cards) {
    var seen = [], cur = -1;

    function seenCount() {
      var n = 0;
      for (var c = 0; c < cards; c++) if (seen[c]) n++;
      return n;
    }

    return {
      show: function (card) {
        cur = card;
        seen[card] = true;
      },
      status: function () {
        var n = seenCount();
        return { card: cur, last: cur === cards - 1, read: n, total: cards, allRead: n === cards };
      }
    };
  }

  var LOCK = 'data-read-lock';
  var CSS =
    '[' + LOCK + ']{position:relative;overflow:hidden;opacity:.85;}' +
    '[' + LOCK + ']::after{content:"";position:absolute;left:0;top:0;bottom:0;width:calc(var(--read,0) * 100%);' +
      'background:currentColor;opacity:.22;pointer-events:none;transition:width .2s ease-out;}' +
    '.read-gate-ready{animation:read-gate-ready .4s ease-out;}' +
    '@keyframes read-gate-ready{0%{transform:scale(1)}45%{transform:scale(1.1)}100%{transform:scale(1)}}' +
    '.read-gate-wiggle{animation:read-gate-wiggle .35s ease-in-out;}' +
    '@keyframes read-gate-wiggle{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}' +
    '@media (prefers-reduced-motion:reduce){.read-gate-ready,.read-gate-wiggle{animation:none}}' +
    '.read-gate-note{margin:10px auto 0;max-width:520px;text-align:center;font-weight:700;font-size:.92rem;line-height:1.4;' +
      'color:var(--muted,#555);}' +
    '.read-gate-note.done{color:var(--good,#15803d);}';

  function grade() {
    var s = typeof document !== 'undefined' && document.currentScript;
    return (s && s.getAttribute('data-grade')) || 'grade5';
  }

  function browser(g) {
    var text = forGrade(g, TEXT[g] || TEXT.grade5);
    if (g === 'grade2' && root.Lang && !root.Lang.both()) {
      text.locked = function (n, total) { return '📖 Read every card first (' + n + ' of ' + total + ')' + cheer('grade5', n, total); };
    }
    var gate = null, ids = null, note = null, wasAllRead = null;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // A locked button stays clickable for the page's own disabled rules; this stops the click before any handler runs.
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[' + LOCK + ']');
      if (!b) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      animate(b, 'read-gate-wiggle');
    }, true);

    function animate(b, cls) {
      if (!b) return;
      b.classList.remove(cls);
      void b.offsetWidth;
      b.classList.add(cls);
      setTimeout(function () { b.classList.remove(cls); }, 450);
    }

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
      var startId = ids.start == null ? ids.next : ids.start;
      var progress = s.read / s.total;
      // With no Start button, Next on the last card is Start Quiz.
      setLock(ids.next, ids.start == null && s.last && !s.allRead, progress);
      setLock(ids.start, !s.allRead, progress);
      if (s.allRead && wasAllRead === false) {
        if (root.Fx && typeof root.Fx.allRead === 'function') root.Fx.allRead();
        animate(document.getElementById(startId), 'read-gate-ready');
      }
      wasAllRead = s.allRead;
      var el = noteEl();
      if (!el) return;
      var line = s.allRead ? text.done : text.locked(s.read, s.total);
      if (el.textContent !== line) el.textContent = line;
      el.classList.toggle('done', s.allRead);
    }

    return {
      open: function (o) {
        gate = controller(o.cards);
        ids = { next: o.next, start: o.start == null ? null : o.start };
        wasAllRead = null;
      },
      show: function (card) {
        if (!gate) return;
        gate.show(card);
        paint();
      }
    };
  }

  var api = { TEXT: TEXT, CHEER: CHEER, controller: controller };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    var b = browser(grade());
    api.open = b.open;
    api.show = b.show;
    root.ReadGate = api;
  }
})(typeof window !== 'undefined' ? window : this);
