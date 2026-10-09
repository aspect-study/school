/* Loaded by every game and both lobbies, after study-history.js and powerups.js. The pages are decoded as UTF-8, so the text can hold emoji.
   Every question sits in a box (1-5). A right answer on its due day pays a gap bonus and moves it up; a wrong one sends it to box 1.
   A question that is not due yet pays no points. */
(function (root) {
  'use strict';

  function wordsFor(grade) { return grade === 'grade2' && root.Lang && !root.Lang.both() ? TEXT.grade5 : TEXT[grade]; }

  var REST_DAYS = 3;
  var TYPED_BONUS = 5;
  var BOX_DAYS = [0, 1, 3, 7, 14, 30];
  var GAP_BONUS = [0, 2, 4, 6, 8, 10];
  var MAX_BOX = 5;
  var REVIEW_SIZE = 10;
  var SEED_DAYS = 14;

  function dayWord(n) { return n === 1 ? ' day' : ' days'; }
  function restingEn(n) { return n + (n === 1 ? ' question was resting, so it pays' : ' questions were resting, so they pay') + ' again soon'; }

  function bonusText(bonus) { return bonus ? ' (+' + bonus + ' review bonus)' : ''; }

  function whenFil(days) { return days === 1 ? 'bukas' : 'sa ' + days + ' araw'; }
  function whenEn(days) { return days === 1 ? 'tomorrow' : 'in ' + days + ' days'; }

  var TEXT = {
    grade5: {
      resting: function (days) { return '⏳ Resting: points again in ' + days + dayWord(days); },
      resultLine: function (n) { return ' · ⏳ ' + restingEn(n); },
      movedLine: function (n, bonus) { return ' · 📦 ' + n + (n === 1 ? ' question' : ' questions') + ' moved up a box' + bonusText(bonus); },
      typePrompt: '✏️ Type the answer first for +' + TYPED_BONUS + ' bonus!',
      typePromptResting: '✏️ Type it from memory. Good practice!',
      placeholder: 'Your answer',
      check: 'Check',
      show: 'Show choices',
      notQuite: 'Not quite! Pick from the choices.',
      typedRight: '✏️ You typed it! +' + TYPED_BONUS + ' bonus',
      lobbyTitle: '🔁 Review due',
      caughtUp: function (next) { return '🎉 All caught up!' + (next ? ' Next review: ' + whenEn(next.days) + ' (' + next.count + ')' : ''); },
      cardTitle: '🔁 Review',
      cardDue: function (n, total) { return total > n ? n + ' of ' + total + ' due' : n + ' due'; },
      cardNext: function (days) { return days ? 'Next: ' + whenEn(days) : 'Answer some questions first'; },
      reviewTitle: 'Review'
    },
    grade2: {
      resting: function (days) { return '⏳ Pahinga muna: may points ulit pagkalipas ng ' + days + ' araw · Resting: points again in ' + days + dayWord(days); },
      resultLine: function (n) { return ' · ⏳ ' + n + ' tanong ang nagpahinga · ' + restingEn(n); },
      movedLine: function (n, bonus) { return ' · 📦 ' + n + ' tanong ang umakyat ng box · ' + n + (n === 1 ? ' question' : ' questions') + ' moved up a box' + bonusText(bonus); },
      typePrompt: '✏️ I-type muna ang sagot para sa +' + TYPED_BONUS + ' bonus · Type the answer first for +' + TYPED_BONUS + ' bonus!',
      typePromptResting: '✏️ I-type mula sa alaala. Magandang practice! · Type it from memory. Good practice!',
      placeholder: 'Your answer',
      check: 'Check',
      show: 'Show choices',
      notQuite: 'Hindi pa tama. Pumili sa choices. · Not quite! Pick from the choices.',
      typedRight: '✏️ Na-type mo! · You typed it! +' + TYPED_BONUS + ' bonus',
      lobbyTitle: '🔁 Balikan · Review due',
      caughtUp: function (next) { return '🎉 Tapos na lahat! · All caught up!' + (next ? ' Susunod: ' + whenFil(next.days) + ' · Next review: ' + whenEn(next.days) + ' (' + next.count + ')' : ''); },
      cardTitle: '🔁 Balikan · Review',
      cardDue: function (n, total) { return (total > n ? n + ' sa ' + total : String(n)) + ' na babalikan · ' + (total > n ? n + ' of ' + total + ' due' : n + ' due'); },
      cardNext: function (days) { return days ? 'Susunod: ' + whenFil(days) + ' · Next: ' + whenEn(days) : 'Sumagot muna ng mga tanong · Answer some questions first'; },
      reviewTitle: 'Balikan · Review'
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

  function dayKeyOf(n) {
    var d = new Date(n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
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

  // The stem, picture and answer text; the same hash the 3-day rest used, without its lesson/exam part.
  function keyOf(app, info) {
    return app + '|' + hash(String(info.q) + '|' + String(info.art || '') + '|' + String(info.answer || ''));
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

  function create(storage, now, grade, plain, paused) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Recall needs a grade like "grade5".');
    var KEY = 'review_v1', OLD_KEY = 'recall_v1';
    var current = null, lastQuiz = null, round = { resting: 0, moved: 0, bonus: 0, fixed: 0 };
    plain = plain || function (s) { return String(s == null ? '' : s); };
    paused = paused || function () { return false; };

    function today() { return dayNumber(dateKey(now())); }

    function valid(it) {
      return !!it && typeof it === 'object' && it.box >= 1 && it.box <= MAX_BOX && Math.floor(it.box) === it.box &&
        !isNaN(dayNumber(it.due)) && typeof it.t === 'number' && !it.gone;
    }

    // A skill begun in review today waits for tomorrow, so leaving the round early cannot replay it for the bonus.
    function isDue(it, t) { return valid(it) && dayNumber(it.due) <= t && it.started !== dayKeyOf(t); }

    function read() {
      var raw = null;
      try { raw = storage.getItem(KEY); } catch (e) {}
      try {
        var d = raw ? JSON.parse(raw) : null;
        if (d && d.v === 1 && d.items && typeof d.items === 'object' && !Array.isArray(d.items)) return d;
      } catch (e) {}
      return null;
    }

    function load() { return read() || { v: 1, items: {} }; }

    function write(state) {
      try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }

    function item(key) {
      var it = load().items[key];
      return valid(it) ? it : null;
    }

    function put(key, box) {
      var state = load();
      state.items[key] = { box: box, due: dayKeyOf(today() + BOX_DAYS[box]), t: now() };
      write(state);
    }

    function dueByApp() {
      var items = load().items, t = today(), counts = {};
      Object.keys(items).forEach(function (k) {
        if (!isDue(items[k], t)) return;
        var app = k.slice(0, k.indexOf('|'));
        counts[app] = (counts[app] || 0) + 1;
      });
      return counts;
    }

    function nextDue(app) {
      var items = load().items, t = today(), best = null;
      Object.keys(items).forEach(function (k) {
        var it = items[k];
        if (!valid(it) || (app && k.indexOf(app + '|') !== 0)) return;
        var d = dayNumber(it.due) - t;
        if (d <= 0 && it.started === dayKeyOf(t)) d = 1;
        if (d <= 0) return;
        if (!best || d < best.days) best = { days: d, count: 1 };
        else if (d === best.days) best.count++;
      });
      return best;
    }

    function daysLeft(it) { return it ? Math.max(0, dayNumber(it.due) - today()) : 0; }

    // One-time copy of the 3-day rest dates: each resting question starts in box 2, due when its rest ends.
    function migrate() {
      var raw = null;
      try { if (storage.getItem(KEY) !== null) return; raw = storage.getItem(OLD_KEY); } catch (e) { return; }
      var old = null;
      try { old = raw ? JSON.parse(raw) : null; } catch (e) {}
      if (!old || !old.rest || typeof old.rest !== 'object') return;
      var items = {}, any = false;
      Object.keys(old.rest).forEach(function (k) {
        var p = /^(.*)\|(?:lesson|exam)\|([0-9a-f]+)$/.exec(k), day = dayNumber(old.rest[k]);
        if (!p || isNaN(day)) return;
        var key = p[1] + '|' + p[2], due = day + REST_DAYS;
        if (items[key] && dayNumber(items[key].due) >= due) return;
        items[key] = { box: 2, due: dayKeyOf(due), t: day * 86400000 };
        any = true;
      });
      if (any) write({ v: 1, items: items });
    }
    migrate();

    function skillsDue(app, ids, limit) {
      var t = today();
      return ids.map(function (id) { return { id: id, it: item(app + '|skill:' + id) }; })
        .filter(function (s) { return isDue(s.it, t); })
        .sort(function (a, b) { return dayNumber(a.it.due) - dayNumber(b.it.due) || a.it.box - b.it.box; })
        .slice(0, limit || 3)
        .map(function (s) { return s.id; });
    }

    return {
      text: wordsFor(grade),

      // opts.review false: a generated question that never comes back, so it is never stored.
      begin: function (quiz, key, opts) {
        if (quiz !== lastQuiz) { lastQuiz = quiz; round = { resting: 0, moved: 0, bonus: 0, fixed: 0 }; }
        var review = !(opts && opts.review === false);
        var it = review ? item(key) : null;
        current = { key: key, review: review, item: it, resting: daysLeft(it), typed: false };
        return current;
      },

      clear: function () { current = null; },

      lastKey: function () { return current ? current.key : null; },

      markTyped: function () { if (current) current.typed = true; },

      typed: function () { return !!(current && current.typed); },

      // Called only for a right answer.
      points: function (helped, base, bonus) {
        if (paused()) return 0;
        if (!current) return helped ? base / 2 : base + bonus;
        if (current.resting) { round.resting++; return 0; }
        var typed = current.typed ? TYPED_BONUS : 0;
        if (!current.review) return helped ? base / 2 : base + bonus + typed;
        if (helped) { put(current.key, 1); return base / 2; }
        var from = current.item ? current.item.box : 0, gap = GAP_BONUS[from];
        put(current.key, from ? Math.min(MAX_BOX, from + 1) : 2);
        if (from) { round.moved++; round.bonus += gap; }
        if (from === 1) round.fixed++;
        return base + bonus + gap + typed;
      },

      // Called for a wrong answer.
      missed: function () {
        if (paused()) return;
        if (current && current.review && !current.resting) put(current.key, 1);
      },

      // Missed questions answered right on their due day in the current round.
      fixed: function () { return round.fixed; },

      resultLine: function () {
        return (round.resting ? wordsFor(grade).resultLine(round.resting) : '') +
          (round.moved ? wordsFor(grade).movedLine(round.moved, round.bonus) : '');
      },

      // info(q) gives { q, art, answer, historyQ, historyAnswer } for one of the game's questions.
      pickDue: function (app, questions, info, limit) {
        var items = load().items, t = today(), seen = {}, due = [];
        questions.forEach(function (q) {
          var key = keyOf(app, info(q)), it = items[key];
          if (seen[key] || !isDue(it, t)) return;
          seen[key] = true;
          due.push({ q: q, late: t - dayNumber(it.due), box: it.box, r: Math.random() });
        });
        due.sort(function (a, b) { return b.late - a.late || a.box - b.box || a.r - b.r; });
        return due.slice(0, limit || REVIEW_SIZE).map(function (d) { return d.q; });
      },

      // A boss stage: due questions first, then the lowest boxes even when not due yet (those rest, so they pay 0).
      pickBoss: function (app, questions, info, n) {
        var items = load().items, t = today(), seen = {}, due = [], rest = [];
        questions.forEach(function (q) {
          var key = keyOf(app, info(q)), it = items[key];
          if (seen[key] || !valid(it)) return;
          seen[key] = true;
          (isDue(it, t) ? due : rest).push({ q: q, late: t - dayNumber(it.due), box: it.box, at: it.t, r: Math.random() });
        });
        due.sort(function (a, b) { return b.late - a.late || a.box - b.box || a.r - b.r; });
        rest.sort(function (a, b) { return a.box - b.box || b.at - a.at || a.r - b.r; });
        return due.concat(rest).slice(0, n || 3).map(function (d) { return d.q; });
      },

      dueByApp: dueByApp,

      // The world's gifts and monsters: 'due' (in a box, due today), 'rest' (in a box, not due yet) or 'new' (never
      // answered), with its box (0 when new).
      status: function (key) {
        var it = item(key);
        return it ? { status: isDue(it, today()) ? 'due' : 'rest', box: it.box } : { status: 'new', box: 0 };
      },

      dueCount: function (app) { return dueByApp()[app] || 0; },

      nextDue: nextDue,

      homeCard: function (app, limit) {
        var T = wordsFor(grade), due = dueByApp()[app] || 0, next = due ? null : nextDue(app);
        return { ready: due > 0, title: T.cardTitle, line: due ? T.cardDue(Math.min(due, limit || REVIEW_SIZE), due) : T.cardNext(next ? next.days : 0) };
      },

      // Seeds box 1 from her recent wrong answers and drops boxes for questions this game no longer has.
      // A dropped box stays as a newer "gone" copy, so a sync with an older copy cannot bring it back.
      tidy: function (app, questions, info, entries, keepAll) {
        if (!questions.length) return;
        var state = load(), keys = {}, byText = {}, changed = false, prefix = app + '|';
        questions.forEach(function (q) {
          var i = info(q), key = keyOf(app, i);
          keys[key] = true;
          byText[plain(i.historyQ) + '\n' + plain(i.historyAnswer)] = key;
        });
        if (!keepAll) Object.keys(state.items).forEach(function (k) {
          var it = state.items[k];
          if (k.indexOf(prefix) !== 0 || k.indexOf(prefix + 'skill:') === 0 || keys[k] || (it && it.gone)) return;
          if (valid(it)) state.items[k] = { box: it.box, due: it.due, t: now(), gone: true };
          else delete state.items[k];
          changed = true;
        });
        var from = today() - SEED_DAYS;
        (entries || []).forEach(function (e) {
          if (!e || e.type !== 'quiz' || typeof e.t !== 'number' || e.app !== app || !Array.isArray(e.wrong) || dayNumber(dateKey(e.t)) < from) return;
          e.wrong.forEach(function (w) {
            var key = w && byText[w.q + '\n' + w.answer];
            var old = key && state.items[key];
            if (key && !valid(old)) { state.items[key] = { box: 1, due: dayKeyOf(today()), t: old ? Math.max(e.t, now()) : e.t }; changed = true; }
          });
        });
        if (changed) write(state);
      },

      // Math Mastery makes up new problems, so it keeps a box per skill (lesson id) instead of per question.
      gradeSkill: function (app, id, right, total) {
        if (paused()) return 0;
        if (total < 3) return 0;
        var key = app + '|skill:' + id, it = item(key);
        if (it && daysLeft(it) > 0) return 0;
        var from = it ? it.box : 0, pass = right * 3 >= total * 2;
        put(key, pass ? (from ? Math.min(MAX_BOX, from + 1) : 2) : 1);
        return pass && from ? 1 : 0;
      },

      skillBonus: function (app, id) {
        var it = item(app + '|skill:' + id);
        return it && daysLeft(it) === 0 ? GAP_BONUS[it.box] : 0;
      },

      // Called with the skills skillsDue gave when a review round starts; grading replaces the box and clears the mark.
      startSkills: function (app, ids) {
        var state = load(), day = dayKeyOf(today()), changed = false;
        ids.forEach(function (id) {
          var key = app + '|skill:' + id, it = state.items[key];
          if (!valid(it)) return;
          state.items[key] = { box: it.box, due: it.due, t: it.t, started: day };
          changed = true;
        });
        if (changed) write(state);
      },

      skillsDue: skillsDue,

      // A boss stage: Math's due skill, otherwise the skill in the lowest box.
      weakestSkill: function (app, ids) {
        var due = skillsDue(app, ids, 1);
        if (due.length) return due;
        var t = today(), best = null;
        ids.forEach(function (id) {
          var it = item(app + '|skill:' + id);
          if (it && dayNumber(it.due) <= t && it.started === dayKeyOf(t)) return;
          if (it && (!best || it.box < best.it.box || (it.box === best.it.box && dayNumber(it.due) < dayNumber(best.it.due)))) best = { id: id, it: it };
        });
        return best ? [best.id] : [];
      }
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
    '.recall-type button:focus-visible,.recall-type input:focus-visible{outline:3px solid #23395B;outline-offset:2px;}' +
    '.review-empty{opacity:.55;filter:grayscale(.6);cursor:default;}' +
    '.review-due{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#EEF4FF;color:#23395B;font-weight:800;}' +
    '.review-due p{margin:0 0 8px;}' +
    '.review-chips{display:flex;flex-wrap:wrap;gap:8px;}' +
    '.review-chip{display:inline-block;padding:8px 14px;border-radius:999px;background:#fff;border:2px solid #9BB4E0;color:#23395B;text-decoration:none;font-weight:800;}' +
    '.review-chip:focus-visible{outline:3px solid #23395B;outline-offset:2px;}';

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
      var cur = core.begin(pu.quiz, keyOf(app, { q: pu.q, art: pu.art, answer: right ? right.textContent : '' }), { review: pu.review });
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

    core.renderLobby = function (box, cards) {
      if (!box) return;
      if (!T) return;
      var counts = core.dueByApp(), chips = [];
      Array.prototype.forEach.call(cards, function (card) {
        var n = counts[card.getAttribute('data-app')];
        if (!n) return;
        var a = el('a', 'review-chip'), title = card.querySelector('.subject-title');
        var href = card.getAttribute('href');
        a.href = href + (href.indexOf('?') >= 0 ? '&' : '?') + 'review=1';
        a.textContent = (title ? title.textContent : card.getAttribute('data-app')) + ' ' + n;
        chips.push(a);
      });
      if (!chips.length && !core.nextDue()) { box.hidden = true; return; }
      box.innerHTML = '';
      box.appendChild(el('p', '', chips.length ? T.lobbyTitle : T.caughtUp(core.nextDue())));
      if (chips.length) {
        var row = el('div', 'review-chips');
        chips.forEach(function (c) { row.appendChild(c); });
        box.appendChild(row);
      }
      box.hidden = false;
    };
    // The text a button shows for this HTML, as Recall.ask reads it with textContent.
    var tidy = core.tidy;
    // A lesson file that failed to load must not cost her that lesson's boxes.
    core.tidy = function (app, questions, info, entries) {
      var tags = doc.querySelectorAll('script[src*="lessons/"]').length;
      var loaded = win.StudyKit && win.StudyKit.lessons ? win.StudyKit.lessons().length : tags;
      return tidy(app, questions, info, entries, loaded < tags);
    };
    core.textOf = function (html) {
      var d = doc.createElement('div');
      d.innerHTML = String(html == null ? '' : html);
      return d.textContent;
    };
    core.keyOf = keyOf;
    return core;
  }

  var exported = { create: create, matches: matches, normalize: normalize, keyOf: keyOf, TEXT: TEXT,
    REST_DAYS: REST_DAYS, TYPED_BONUS: TYPED_BONUS, BOX_DAYS: BOX_DAYS, GAP_BONUS: GAP_BONUS, REVIEW_SIZE: REVIEW_SIZE, SEED_DAYS: SEED_DAYS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    var SH = root.StudyHistory;
    root.Recall = mountUi(root, create(root.Learner ? root.Learner.storage : root.localStorage, Date.now,
      script ? script.getAttribute('data-grade') : null, SH && SH.plain, function () { return !!(root.Clock && root.Clock.paused()); }));
    root.Recall.wantsReview = /(^|[?&])review=1(&|$)/.test(root.location ? root.location.search : '');
  } catch (e) {}
})(this);
