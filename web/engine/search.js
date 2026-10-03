/* The 🔎 lesson search on every game's home screen. It looks through each lesson's title, subtitle and flashcards.
   A game calls Search.start({ list, lessons }) once: list is the id of the element holding the home cards, and
   each lesson card in it carries data-search-lesson="<index in lessons>". Other cards hide while a search is on. */
(function (root) {
  'use strict';

  var TEXT = {
    grade5: {
      label: 'Search lessons', placeholder: '🔎 Search a lesson or a word', clear: 'Clear the search',
      found: function (n) { return n === 1 ? '1 lesson found' : n + ' lessons found'; },
      none: 'No lesson found. Try a shorter word.', lesson: 'Lesson'
    },
    grade2: {
      label: 'Search lessons', placeholder: '🔎 Search lessons · Hanapin ang aralin', clear: 'Clear the search',
      found: function (n) { return (n === 1 ? '1 lesson found' : n + ' lessons found') + ' · ' + n + ' aralin ang nakita'; },
      none: 'No lesson found. Try a shorter word. · Walang aralin na nakita. Subukan ang mas maikling salita.', lesson: 'Lesson'
    }
  };

  var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"',
    mdash: ' ', ndash: ' ', middot: ' ', rarr: ' ', larr: ' ', hellip: ' ', times: 'x', divide: '/' };

  // Plain readable text: no tags, entities decoded.
  function plain(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
      .replace(/&([a-z]+);/gi, function (m, n) { return ENTITIES[n.toLowerCase()] || ' '; })
      .replace(/\s+/g, ' ')
      .trim();
  }

  // For matching: lower case, accents off (Ñ → n), curly quotes straight, hyphens as spaces.
  function fold(s) {
    return plain(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’]/g, "'").replace(/[-‐-―_/]/g, ' ').replace(/\s+/g, ' ');
  }

  function words(query) {
    return fold(query).split(' ').filter(Boolean);
  }

  // Lessons use one of two card shapes: {front, back, en} or {title|term, text|def, en}.
  function index(lessons) {
    return lessons.map(function (l, i) {
      var cards = (l.cards || l.flashcards || []).map(function (c) {
        var name = plain(c.front || c.term || c.title || '');
        return { name: name, text: fold([c.front, c.term, c.title, c.back, c.def, c.text, c.en].join(' ')) };
      });
      return { i: i, head: fold([l.tag, l.title, l.subtitle].join(' ')), cards: cards };
    });
  }

  // Every word has to be somewhere in the lesson. hit says where, when it is not in the title:
  // { card: name } or { lesson: number } (a number typed matches the lesson's place in the list).
  function find(idx, query) {
    var ws = words(query);
    if (!ws.length) return null;
    var out = [];
    idx.forEach(function (e) {
      var all = e.head + ' ' + e.cards.map(function (c) { return c.text; }).join(' ');
      if (!ws.every(function (w) { return all.indexOf(w) >= 0; })) {
        if (ws.length === 1 && /^\d+$/.test(ws[0]) && +ws[0] === e.i + 1) out.push({ i: e.i, hit: { lesson: e.i + 1 } });
        return;
      }
      var missing = ws.filter(function (w) { return e.head.indexOf(w) < 0; });
      if (!missing.length) { out.push({ i: e.i, hit: null }); return; }
      var card = e.cards.filter(function (c) { return missing.every(function (w) { return c.text.indexOf(w) >= 0; }); })[0] ||
        e.cards.filter(function (c) { return c.text.indexOf(missing[0]) >= 0; })[0];
      out.push({ i: e.i, hit: card && card.name ? { card: card.name } : null });
    });
    return out;
  }

  var CSS =
    '.lsearch{display:block;max-width:720px;margin:0 auto 14px;box-sizing:border-box;}' +
    '.lsearch-row{position:relative;display:flex;align-items:center;}' +
    '.lsearch-input{width:100%;box-sizing:border-box;min-height:52px;padding:12px 52px 12px 16px;border-radius:16px;font:inherit;font-size:1.05rem;' +
      'color:var(--ink,#1d1d1f);background:var(--card,var(--surface,#fff));border:2px solid rgba(127,127,127,.35);-webkit-appearance:none;appearance:none;}' +
    '.lsearch-input::-webkit-search-cancel-button{display:none;}' +
    '.lsearch-input:focus{outline:3px solid var(--accent,#2E6F9E);outline-offset:1px;}' +
    '.lsearch-clear{position:absolute;right:4px;width:44px;height:44px;border:none;border-radius:12px;background:transparent;color:var(--ink,#1d1d1f);' +
      'font:inherit;font-size:1.2rem;cursor:pointer;}' +
    '.lsearch-clear[hidden]{display:none;}' +
    '.lsearch-clear:hover{background:rgba(127,127,127,.14);}' +
    '.lsearch-count{margin:6px 4px 0;font-size:.9rem;font-weight:700;color:var(--ink,#1d1d1f);opacity:.8;}' +
    '.lsearch-count:empty{display:none;}' +
    '.lsearch-hit{display:block;margin-top:4px;font-size:.85rem;font-weight:700;opacity:.85;}' +
    '[data-search-hidden]{display:none !important;}' +
    '@media print{.lsearch{display:none !important;}}';

  function create(win, grade) {
    var doc = win.document;
    var t = TEXT[grade] || TEXT.grade5;
    var list = null, input = null, clearBtn = null, count = null, idx = null;

    function cardsOf() {
      return Array.prototype.slice.call(list.children);
    }

    function apply() {
      if (!list) return;
      var found = find(idx, input.value);
      var byIndex = {};
      (found || []).forEach(function (f) { byIndex[f.i] = f; });
      var shown = 0;
      cardsOf().forEach(function (card) {
        var old = card.querySelector('.lsearch-hit');
        if (old) old.parentNode.removeChild(old);
        var n = card.getAttribute('data-search-lesson');
        var f = n === null ? null : byIndex[n];
        var show = !found || !!f;
        if (show) card.removeAttribute('data-search-hidden');
        else card.setAttribute('data-search-hidden', '');
        if (f) shown++;
        if (f && f.hit) {
          var hit = doc.createElement('span');
          hit.className = 'lsearch-hit';
          hit.textContent = '🔎 ' + (f.hit.card || t.lesson + ' ' + f.hit.lesson);
          (card.querySelector('.info, .lesson-info') || card).appendChild(hit);
        }
      });
      clearBtn.hidden = !input.value;
      count.textContent = found ? (shown ? t.found(shown) : t.none) : '';
    }

    function firstShown() {
      var card = cardsOf().filter(function (c) { return c.hasAttribute('data-search-lesson') && !c.hasAttribute('data-search-hidden'); })[0];
      if (!card) return null;
      return card.matches('button, [role="button"]') ? card : card.querySelector('button, [role="button"]');
    }

    function build() {
      var style = doc.createElement('style');
      style.id = 'search-style';
      style.textContent = CSS;
      doc.head.appendChild(style);

      var box = doc.createElement('div');
      box.className = 'lsearch';
      box.setAttribute('role', 'search');
      var row = doc.createElement('div');
      row.className = 'lsearch-row';
      input = doc.createElement('input');
      input.type = 'search';
      input.id = 'lesson-search';
      input.className = 'lsearch-input';
      input.placeholder = t.placeholder;
      input.setAttribute('aria-label', t.label);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('enterkeyhint', 'search');
      clearBtn = doc.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'lsearch-clear';
      clearBtn.textContent = '✕';
      clearBtn.hidden = true;
      clearBtn.setAttribute('aria-label', t.clear);
      count = doc.createElement('p');
      count.className = 'lsearch-count';
      count.setAttribute('aria-live', 'polite');
      row.appendChild(input);
      row.appendChild(clearBtn);
      box.appendChild(row);
      box.appendChild(count);
      list.parentNode.insertBefore(box, list);

      input.addEventListener('input', apply);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; apply(); }
        if (e.key === 'Enter') {
          var go = firstShown();
          if (go) { e.preventDefault(); input.blur(); go.click(); }
        }
      });
      clearBtn.addEventListener('click', function () { input.value = ''; apply(); input.focus(); });
    }

    function start(opts) {
      if (list) return;
      list = doc.getElementById(opts.list);
      if (!list || !opts.lessons) { list = null; return; }
      idx = index(opts.lessons);
      build();
      // The home screen redraws its cards after every lesson; keep the search applied to the new ones.
      new win.MutationObserver(apply).observe(list, { childList: true });
      apply();
    }

    return { start: start, query: function () { return input ? input.value : ''; } };
  }

  var exported = { TEXT: TEXT, plain: plain, fold: fold, index: index, find: find };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Search = create(root, script ? script.getAttribute('data-grade') : null);
  } catch (e) {}
})(this);
