/* Loaded by every game except Math Mastery, after powerups.js. The pages are decoded as UTF-8, so the text can hold emoji.
   A question she gets right on her own pays no points again for REST_DAYS calendar days. */
(function (root) {
  'use strict';

  var REST_DAYS = 3;
  var TYPED_BONUS = 5;

  function dayWord(n) { return n === 1 ? ' day' : ' days'; }
  function restingEn(n) { return n + (n === 1 ? ' question was resting, so it pays' : ' questions were resting, so they pay') + ' again soon'; }

  var TEXT = {
    grade5: {
      resting: function (days) { return '⏳ Resting: points again in ' + days + dayWord(days); },
      resultLine: function (n) { return ' · ⏳ ' + restingEn(n); },
      typePrompt: '✏️ Type the answer first for +' + TYPED_BONUS + ' bonus!',
      typePromptResting: '✏️ Type it from memory. Good practice!',
      placeholder: 'Your answer',
      check: 'Check',
      show: 'Show choices',
      notQuite: 'Not quite! Pick from the choices.',
      typedRight: '✏️ You typed it! +' + TYPED_BONUS + ' bonus'
    },
    grade2: {
      resting: function (days) { return '⏳ Pahinga muna: may points ulit pagkalipas ng ' + days + ' araw · Resting: points again in ' + days + dayWord(days); },
      resultLine: function (n) { return ' · ⏳ ' + n + ' tanong ang nagpahinga · ' + restingEn(n); },
      typePrompt: '✏️ I-type muna ang sagot para sa +' + TYPED_BONUS + ' bonus · Type the answer first for +' + TYPED_BONUS + ' bonus!',
      typePromptResting: '✏️ I-type mula sa alaala. Magandang practice! · Type it from memory. Good practice!',
      placeholder: 'Your answer',
      check: 'Check',
      show: 'Show choices',
      notQuite: 'Hindi pa tama. Pumili sa choices. · Not quite! Pick from the choices.',
      typedRight: '✏️ Na-type mo! · You typed it! +' + TYPED_BONUS + ' bonus'
    }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayNumber(key) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
    return p ? Math.round(Date.UTC(+p[1], +p[2] - 1, +p[3]) / 86400000) : NaN;
  }

  // 32-bit FNV-1a, enough to tell about a thousand questions apart.
  function hash(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function questionKey(app, exam, q, extra) {
    return app + '|' + (exam ? 'exam' : 'lesson') + '|' + hash(String(q) + '|' + String(extra || ''));
  }

  function normalize(text) {
    return String(text == null ? '' : text).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function withinOneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  // A typed text that is, or is one edit from, a wrong choice never counts unless it is exactly right.
  function matches(typed, answer, accept, wrong) {
    var t = normalize(typed);
    if (!t) return false;
    var targets = [answer].concat(accept || []).map(normalize).filter(Boolean);
    if (targets.indexOf(t) !== -1) return true;
    var nearWrong = (wrong || []).some(function (w) {
      var n = normalize(w);
      return n && (n === t || withinOneEdit(t, n));
    });
    if (nearWrong) return false;
    return targets.some(function (want) {
      if (/[0-9]/.test(want + t)) return false;
      return want.replace(/ /g, '').length >= 5 && withinOneEdit(t, want);
    });
  }

  function create(storage, now, grade) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Recall needs a grade like "grade5".');
    var KEY = grade + '_recall_v1';
    var current = null, lastQuiz = null, restingCount = 0;

    function read() {
      var raw = null;
      try { raw = storage.getItem(KEY); } catch (e) {}
      try {
        var d = raw ? JSON.parse(raw) : null;
        if (d && d.v === 1 && d.rest && typeof d.rest === 'object' && !Array.isArray(d.rest)) return d;
      } catch (e) {}
      return { v: 1, rest: {} };
    }

    function write(state) {
      try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }

    function daysLeft(paidOn) {
      var gone = dayNumber(dateKey(now())) - dayNumber(paidOn);
      return isNaN(gone) ? 0 : Math.max(0, Math.min(REST_DAYS, REST_DAYS - gone));
    }

    var stored = read(), pruned = false;
    Object.keys(stored.rest).forEach(function (k) {
      if (typeof stored.rest[k] !== 'string' || daysLeft(stored.rest[k]) === 0) { delete stored.rest[k]; pruned = true; }
    });
    if (pruned) write(stored);

    return {
      text: TEXT[grade],

      begin: function (quiz, key) {
        if (quiz !== lastQuiz) { lastQuiz = quiz; restingCount = 0; }
        var paidOn = read().rest[key];
        current = { key: key, resting: typeof paidOn === 'string' ? daysLeft(paidOn) : 0, typed: false };
        return current;
      },

      clear: function () { current = null; },

      markTyped: function () { if (current) current.typed = true; },

      typed: function () { return !!(current && current.typed); },

      // Called only for a right answer.
      points: function (helped, base, bonus) {
        if (!current) return helped ? base / 2 : base + bonus;
        if (current.resting) { restingCount++; return 0; }
        if (helped) return base / 2;
        var state = read();
        state.rest[current.key] = dateKey(now());
        write(state);
        return base + bonus + (current.typed ? TYPED_BONUS : 0);
      },

      resultLine: function () { return restingCount ? TEXT[grade].resultLine(restingCount) : ''; }
    };
  }

  var UI_CSS =
    '.recall-note{margin:8px 0;padding:8px 12px;border-radius:12px;background:#EEF4FF;color:#23395B;font-size:.9rem;font-weight:700;}' +
    '.recall-type{margin:10px 0;padding:12px;border:2px dashed #9BB4E0;border-radius:16px;background:#F7FAFF;color:#23395B;}' +
    '.recall-type p{margin:0 0 8px;font-weight:800;}' +
    '.recall-type input{box-sizing:border-box;width:100%;padding:10px 12px;border:2px solid #9BB4E0;border-radius:12px;font:inherit;font-size:1.05rem;}' +
    '.recall-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}' +
    '.recall-row button{flex:1 1 140px;padding:10px 14px;border:0;border-radius:999px;font:inherit;font-weight:800;cursor:pointer;}' +
    '.recall-check{background:#2E9E5B;color:#fff;}' +
    '.recall-show{background:#E4E9F2;color:#23395B;}' +
    '.recall-type button:focus-visible,.recall-type input:focus-visible{outline:3px solid #23395B;outline-offset:2px;}';

  // pu is the object the game builds for PowerUps.offer, plus `art`.
  function mountUi(win, core) {
    var doc = win.document, T = core.text, hidden = null;
    var style = doc.createElement('style');
    style.textContent = UI_CSS;
    (doc.head || doc.documentElement).appendChild(style);

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function note(before, text) { before.parentNode.insertBefore(el('div', 'recall-note', text), before); }

    core.ask = function (pu, app, typeIt) {
      var PU = win.PowerUps;
      Array.prototype.forEach.call(doc.querySelectorAll('.recall-note, .recall-type'), function (n) { n.parentNode.removeChild(n); });
      if (hidden) { hidden.style.display = ''; hidden = null; }
      var before = pu.before;
      if (!before || !before.parentNode) { core.clear(); if (PU && PU.skip) PU.skip(); return; }
      var right = (pu.options || [])[pu.correct];
      var wrong = Array.prototype.filter.call(pu.options || [], function (o) { return o !== right; })
        .map(function (o) { return o.textContent; });
      var cur = core.begin(pu.quiz, questionKey(app, pu.exam, pu.q, (pu.art || '') + '|' + (right ? right.textContent : '')));
      function offer() { if (!cur.resting && PU) PU.offer(pu); }
      if (cur.resting) note(before, T.resting(cur.resting));

      var accept = typeIt && Object.prototype.hasOwnProperty.call(typeIt, pu.q) ? typeIt[pu.q] : null;
      var typing = !!accept && !!right;
      if ((cur.resting || typing) && PU && PU.skip) PU.skip();
      if (!typing) { offer(); return; }

      var box = el('div', 'recall-type');
      var input = el('input');
      input.type = 'text';
      input.placeholder = T.placeholder;
      input.setAttribute('aria-label', T.placeholder);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('spellcheck', 'false');
      var row = el('div', 'recall-row');
      var check = el('button', 'recall-check', T.check);
      var show = el('button', 'recall-show', T.show);
      check.type = 'button';
      show.type = 'button';
      row.appendChild(check);
      row.appendChild(show);
      box.appendChild(el('p', '', cur.resting ? T.typePromptResting : T.typePrompt));
      box.appendChild(input);
      box.appendChild(row);
      before.style.display = 'none';
      hidden = before;
      before.parentNode.insertBefore(box, before);

      function reveal() {
        if (box.parentNode) box.parentNode.removeChild(box);
        before.style.display = '';
        hidden = null;
      }
      check.addEventListener('click', function () {
        if (!input.value.trim()) { input.focus(); return; }
        reveal();
        if (matches(input.value, right.textContent, accept, wrong)) {
          core.markTyped();
          if (!cur.resting) note(before, T.typedRight);
          right.click();
        } else {
          note(before, T.notQuite);
          offer();
        }
      });
      show.addEventListener('click', function () { reveal(); offer(); });
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') check.click(); });
    };
    return core;
  }

  var exported = { create: create, matches: matches, normalize: normalize, questionKey: questionKey, TEXT: TEXT, REST_DAYS: REST_DAYS, TYPED_BONUS: TYPED_BONUS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Recall = mountUi(root, create(root.localStorage, Date.now, script ? script.getAttribute('data-grade') : null));
  } catch (e) {}
})(this);
