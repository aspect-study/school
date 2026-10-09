/* The Parent panel: study history with its filters, Needs practice and real test scores. In the lobbies it also has
   the PIN overlay, the learner's name, backups and deleting history. Shared by both lobbies and the parent page. */
(function (root) {
  'use strict';

  var FALLBACK_PIN = '0108';

  // A page that forgot parent-pin.js still opens with the PIN every family had before 2026-10-09.
  function checkPin(entry) { return root.ParentPin ? root.ParentPin.check(entry) : entry === FALLBACK_PIN; }

  // The panel's own look, so the two lobbies and the phone page share one copy. It uses each page's theme colors.
  var CSS =
    '.p-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;}' +
    '.p-tab{flex:none;font:inherit;font-size:.9rem;font-weight:800;cursor:pointer;padding:8px 14px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--ink);}' +
    '.p-tab.on{background:var(--ink);border-color:var(--ink);color:var(--bg);}' +
    '.p-tab:focus-visible{outline:3px solid var(--gold-deep);outline-offset:2px;}' +
    '.p-panel[hidden]{display:none;}' +
    '.p-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}' +
    '@media (max-width:520px){.p-tiles{grid-template-columns:repeat(2,minmax(0,1fr));}}' +
    '.p-tile{padding:10px 12px;border-radius:14px;background:var(--bg);}' +
    '.p-tile-label{font-size:.8rem;font-weight:700;color:var(--ink-soft);}' +
    '.p-tile-value{font-size:1.25rem;font-weight:800;}' +
    '.p-tile.bad .p-tile-value{color:var(--bad);}' +
    '.f-subject{border:1px solid var(--border);border-radius:14px;padding:10px 12px;margin-top:10px;}' +
    '.f-subject.need{border-color:var(--bad);}' +
    '.f-subject>summary{cursor:pointer;list-style:none;}' +
    '.f-subject>summary::-webkit-details-marker{display:none;}' +
    '.f-head{display:flex;justify-content:space-between;gap:8px;font-weight:800;}' +
    '.f-stat{color:var(--ink-soft);font-weight:700;}' +
    '.f-subject.need .f-head .f-stat{color:var(--bad);}' +
    '.f-bar{height:6px;border-radius:3px;background:var(--bg);margin-top:6px;overflow:hidden;}' +
    '.f-bar span{display:block;height:100%;background:var(--good);}' +
    '.f-subject.need .f-bar span{background:var(--bad);}' +
    '.f-label{margin:12px 0 4px;font-size:.8rem;font-weight:800;color:var(--ink-soft);}' +
    '.f-row{padding:6px 0;border-top:1px solid var(--border);overflow-wrap:anywhere;}' +
    '.f-lesson{display:flex;justify-content:space-between;gap:8px;}' +
    '.f-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:3px;font-size:.85rem;font-weight:700;}' +
    '.f-pick{color:var(--bad);}' +
    '.f-ans{color:var(--good);}' +
    '.f-from{color:var(--ink-soft);}' +
    '.f-chip{padding:1px 8px;border-radius:999px;font-size:.78rem;font-weight:800;color:var(--card);}' +
    '.f-chip.missing{background:var(--bad);}' +
    '.f-chip.fixed{background:var(--good);}' +
    '.f-mix{margin-top:3px;font-size:.85rem;font-weight:700;color:var(--gold-deep);}' +
    '.f-more>summary{cursor:pointer;margin-top:8px;font-weight:800;color:var(--header-accent);}' +
    '.f-practice{margin:10px 0 2px;}' +
    '.w-row{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--border);}' +
    '.w-name{font-weight:800;}' +
    '.w-stat{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:2px 10px;text-align:right;color:var(--ink-soft);font-weight:700;}' +
    '.w-up{color:var(--good);font-weight:800;}' +
    '.w-down{color:var(--bad);font-weight:800;}' +
    '.w-same{color:var(--ink-soft);font-weight:800;}' +
    '.w-fixed{margin:10px 0 0;font-weight:800;}' +
    '.w-send{padding:6px 0;border-top:1px solid var(--border);overflow-wrap:anywhere;}';

  function addStyle(doc) {
    if (doc.getElementById('parent-panel-css')) return;
    var s = doc.createElement('style');
    s.id = 'parent-panel-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // The 4-dot PIN keypad. o: { dots, pad, hint, hintText, onUnlock }.
  function pinGate(o) {
    var entered = '', shakeT = null;
    function draw() {
      Array.prototype.forEach.call(o.dots.children, function (d, i) { d.classList.toggle('fill', i < entered.length); });
    }
    function press(key) {
      if (key === 'clear') { entered = entered.slice(0, -1); draw(); return; }
      if (entered.length >= 4) return;
      entered += key;
      draw();
      if (entered.length < 4) return;
      if (checkPin(entered)) { entered = ''; draw(); o.onUnlock(); return; }
      entered = '';
      clearTimeout(shakeT);
      o.dots.classList.remove('shake');
      void o.dots.offsetWidth;
      o.dots.classList.add('shake');
      o.hint.textContent = 'Wrong PIN';
      shakeT = setTimeout(function () {
        o.dots.classList.remove('shake');
        draw();
        o.hint.textContent = o.hintText;
      }, 1500);
    }
    o.pad.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (b) press(b.getAttribute('data-key') || b.textContent);
    });
    return { press: press, reset: function () { entered = ''; draw(); } };
  }

  function subjectsFromCards(doc) {
    return Array.prototype.map.call(doc.querySelectorAll('.subject-card'), function (card) {
      return {
        app: card.getAttribute('data-app'),
        title: card.querySelector('.subject-title').textContent,
        pointsKey: card.querySelector('[data-points-key]').getAttribute('data-points-key')
      };
    });
  }

  // o: { history, wallet, learner, store, subjects: [{ app, title, pointsKey }], lobby, onChange }.
  // lobby: true adds the PIN overlay, learner, backup and delete sections. onChange runs after a test score is added.
  // older (phone only): { from() → ms the loaded history starts at, or 0 when all is loaded; load() → promise }.
  function mount(o) {
    var SH = o.history, W = o.wallet, L = o.learner, STORE = o.store;
    var doc = root.document;
    var $ = function (id) { return doc.getElementById(id); };
    var IN = root.Insights;
    addStyle(doc);
    var range = '30';
    var picking = false;

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function entriesWord(n) { return n + (n === 1 ? ' entry' : ' entries'); }

    function today() { return SH.dateKey(Date.now()); }
    function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return SH.dateKey(d.getTime()); }
    function currentRange() {
      if (range === 'all') return [null, null];
      if (range === 'custom') return [$('range-from').value || null, $('range-to').value || null];
      if (range === 'today') return [today(), today()];
      return [daysAgo(parseInt(range, 10) - 1), today()];
    }
    function rangeDatesFor(r) {
      if (r === 'all' || r === 'today') return [today(), today()];
      if (r === 'custom') return [$('range-from').value || today(), $('range-to').value || today()];
      return [daysAgo(parseInt(r, 10) - 1), today()];
    }
    function prefillCustomFrom(oldRange) {
      var d = rangeDatesFor(oldRange);
      if (!$('range-from').value) $('range-from').value = d[0];
      if (!$('range-to').value) $('range-to').value = d[1];
    }

    function formatDuration(ms) {
      var mins = Math.round(ms / 60000);
      if (mins < 1) return 'under 1 min';
      if (mins < 60) return mins + ' min';
      return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
    }

    function wrongList(e) { return Array.isArray(e.wrong) ? e.wrong.filter(Boolean) : []; }

    var subjectByApp = {};
    function subjectOf(app, appTitle) { return subjectByApp[app] || appTitle; }

    function describe(e) {
      var subject = subjectOf(e.app, e.appTitle);
      if (e.type === 'open') return '📂 Opened ' + subject;
      if (e.type === 'purchase') return '🛒 Bought ' + e.itemName + ' — ' + e.coins + ' coins' + (e.via === 'phone' ? " · approved on the parent's phone" : e.via === 'pin' ? ' · approved with the PIN on the tablet' : e.via === 'wardrobe' ? ' · from the wardrobe boutique' : e.via === 'pets' ? ' · from the pet stall' : e.via === 'toys' ? ' · from the toy stall' : e.via === 'house' ? " · from Tito Tasyo's workshop" : '');
      if (e.type === 'test') return '📝 Real test · ' + subject + ' · ' + e.testName + ' — ' + e.score + '/' + e.total + ' · +' + e.coins + ' coins';
      if (e.type === 'lesson') return '📖 ' + subject + ' · ' + e.lessonTitle + ' — viewed ' + e.cardsViewed + ' of ' + e.cardsTotal + ' cards';
      var icon = '✏️', name;
      if (e.kind === 'walkthrough') { icon = '🧩'; name = subject + ' · UPAC Walkthrough: ' + e.lessonTitle; }
      else if (e.kind === 'case') { icon = '📋'; name = subject + ' · Case Study: ' + e.lessonTitle; }
      else name = subject + ' · ' + (e.final ? 'Final Mock Exam' : e.lessonTitle + ' quiz');
      if (!e.finished) return icon + ' ' + name + ' — stopped at ' + e.answered + ' of ' + e.total + ', ' + e.correct + ' correct' + helpsText(e) + typedText(e);
      var starCount = Math.min(3, Math.max(0, e.stars | 0));
      var stars = starCount > 0 ? ' ' + '⭐'.repeat(starCount) : '';
      var updatedAt = typeof e.updatedAt === 'number' ? e.updatedAt : e.t;
      var scoreText = e.kind === 'walkthrough' ? e.correct + '/' + e.total + ' steps' : e.correct + '/' + e.total;
      return icon + ' ' + name + ' — ' + scoreText + stars + ' +' + e.points + ' pts · ' + formatDuration(updatedAt - e.t) + helpsText(e) + typedText(e);
    }

    function helpsText(e) {
      var text = SH.powerUpsText ? SH.powerUpsText(e) : '';
      return text ? ' · ⚡ ' + text : '';
    }

    function typedText(e) { return e.typed ? ' · ✏️ ' + e.typed + ' typed' : ''; }

    function wrongDetails(e) {
      var wrong = wrongList(e);
      var d = el('details');
      d.appendChild(el('summary', '', plural(wrong.length, 'wrong answer')));
      var ul = el('ul', 'h-wrong');
      wrong.forEach(function (w) {
        var li = el('li');
        li.appendChild(el('div', '', w.q));
        li.appendChild(el('div', 'pick', '❌ ' + w.picked));
        li.appendChild(el('div', 'ans', '✅ ' + w.answer));
        ul.appendChild(li);
      });
      d.appendChild(ul);
      return d;
    }

    var WEAK_BELOW = 80;
    var FOCUS_QUESTIONS = 8;
    var MEDALS = ['·', '🥉', '🥈', '🥇'];

    function tile(label, value, cls) {
      var t = el('div', 'p-tile' + (cls ? ' ' + cls : ''));
      t.appendChild(el('div', 'p-tile-label', label));
      t.appendChild(el('div', 'p-tile-value', value));
      return t;
    }

    function renderSummary(s, report) {
      var box = $('hist-summary');
      box.textContent = '';
      box.appendChild(tile('Study time', s.studyMs > 0 ? formatDuration(s.studyMs) : 'none yet'));
      var quizzes = s.quizzes;
      if (report) quizzes = report.subjects.reduce(function (n, x) { return n + x.quizzes; }, 0);
      box.appendChild(tile('Quizzes', String(quizzes)));
      box.appendChild(tile('Right answers', report && report.pct !== null ? report.pct + '%' : '—'));
      if (report) box.appendChild(tile('To fix', String(report.toFix), report.toFix ? 'bad' : ''));
    }

    var rendered = {};

    function readOpen(box) {
      if (!rendered[box.id]) return null;
      var st = {};
      Array.prototype.forEach.call(box.querySelectorAll('details.f-subject'), function (d) {
        var folds = [];
        Array.prototype.forEach.call(d.querySelectorAll('.f-more'), function (f, i) { if (f.open) folds.push(i); });
        st[d.getAttribute('data-app')] = { open: d.open, folds: folds };
      });
      return st;
    }

    function restoreOpen(box, st) {
      rendered[box.id] = true;
      if (!st) return;
      Array.prototype.forEach.call(box.querySelectorAll('details.f-subject'), function (d) {
        var was = st[d.getAttribute('data-app')] || { open: false, folds: [] };
        d.open = was.open;
        Array.prototype.forEach.call(d.querySelectorAll('.f-more'), function (f, i) { f.open = was.folds.indexOf(i) !== -1; });
      });
    }

    function bar(pct) {
      var b = el('div', 'f-bar'), fill = el('span');
      fill.style.width = (pct || 0) + '%';
      b.appendChild(fill);
      return b;
    }

    function questionRow(q) {
      var row = el('div', 'f-row f-question');
      row.appendChild(el('div', '', q.q));
      var meta = el('div', 'f-meta');
      meta.appendChild(el('span', 'f-pick', '❌ ' + q.lastPick + (q.count > 1 ? ' · missed ' + q.count + '×' : '')));
      meta.appendChild(el('span', 'f-ans', '✅ ' + q.answer));
      if (q.status) meta.appendChild(el('span', 'f-chip ' + q.status, q.status === 'fixed' ? 'Fixed' : 'Still missing'));
      if (q.lesson) meta.appendChild(el('span', 'f-from', q.lesson));
      row.appendChild(meta);
      if (q.repeatedPick) row.appendChild(el('div', 'f-mix', 'Picked “' + q.repeatedPick + '” more than once: may be mixing these up.'));
      return row;
    }

    function folded(summary, list) {
      var d = el('details', 'f-more');
      d.appendChild(el('summary', '', summary));
      list.forEach(function (q) { d.appendChild(questionRow(q)); });
      return d;
    }

    function readPractice() {
      try {
        var d = JSON.parse(STORE.getItem('practice_v1'));
        if (d && d.v === 1 && d.sends && typeof d.sends === 'object') return d;
      } catch (e) {}
      return { v: 1, sends: {} };
    }

    // The click re-renders Focus, so a message for the new practice box waits here.
    var practiceNote = null;
    function practiceBox(s, items) {
      var keys = IN.practiceKeys(s, items);
      if (!keys.length) return null;
      var box = el('div', 'f-practice'), msg = el('p', 'p-note f-practice-msg');
      if (practiceNote && practiceNote.app === s.app) { msg.textContent = practiceNote.text; practiceNote = null; }
      var lessons = keys.filter(function (k) { return k.indexOf('|skill:') >= 0; }).length, questions = keys.length - lessons;
      var what = [questions ? plural(questions, 'question') : '', lessons ? plural(lessons, 'lesson') : ''].filter(Boolean).join(' and ');
      if (IN.practicePending(keys, items, today()) > 0) {
        var btn = el('button', 'p-btn f-practice-btn', '📌 Practice these: ' + what);
        btn.type = 'button';
        btn.addEventListener('click', function () {
          var d = null;
          try { d = JSON.parse(STORE.getItem('review_v1')); } catch (e) {}
          if (!d || d.v !== 1 || !d.items || typeof d.items !== 'object') d = { v: 1, items: {} };
          IN.markDue(d.items, keys, today(), Date.now());
          try { STORE.setItem('review_v1', JSON.stringify(d)); } catch (e) { msg.textContent = 'Could not save. Storage may be full.'; return; }
          try {
            STORE.setItem('practice_v1', JSON.stringify(IN.addSend(readPractice(), s.app, keys, Date.now(), Math.random)));
          } catch (e) {
            practiceNote = { app: s.app, text: 'Saved for review, but the practice record could not be saved.' };
          }
          renderHistory();
          if (o.onChange) o.onChange();
        });
        box.appendChild(btn);
      } else {
        box.appendChild(el('p', 'p-note', '📌 In the review now: ' + what + '. They come back under Review in the lobby.'));
      }
      box.appendChild(msg);
      return box;
    }

    function focusSubject(s, open, items) {
      var need = s.toFix > 0 || s.pct < WEAK_BELOW;
      var d = el('details', 'f-subject' + (need ? ' need' : ''));
      d.open = open;
      d.setAttribute('data-app', s.app);
      var sum = el('summary'), head = el('div', 'f-head');
      head.appendChild(el('span', '', s.title));
      head.appendChild(el('span', 'f-stat', s.pct + '% right · ' + (s.toFix ? s.toFix + ' to fix' : 'nothing to fix')));
      sum.appendChild(head);
      sum.appendChild(bar(s.pct));
      d.appendChild(sum);
      var practice = practiceBox(s, items);
      if (practice) d.appendChild(practice);

      var weak = s.lessons.filter(function (l) { return l.weak; }).slice(0, 3);
      if (weak.length) {
        d.appendChild(el('div', 'f-label', 'Weakest lessons'));
        weak.forEach(function (l) {
          var row = el('div', 'f-row f-lesson');
          row.appendChild(el('span', '', l.title));
          row.appendChild(el('span', 'f-pick', l.pct + '% (' + l.correct + ' of ' + l.answered + ')'));
          d.appendChild(row);
        });
      }

      var toFix = s.questions.filter(function (q) { return q.status !== 'fixed'; });
      var fixed = s.questions.filter(function (q) { return q.status === 'fixed'; });
      if (toFix.length) {
        d.appendChild(el('div', 'f-label', 'Questions to fix'));
        toFix.slice(0, FOCUS_QUESTIONS).forEach(function (q) { d.appendChild(questionRow(q)); });
        if (toFix.length > FOCUS_QUESTIONS) d.appendChild(folded('Show ' + (toFix.length - FOCUS_QUESTIONS) + ' more', toFix.slice(FOCUS_QUESTIONS)));
      }
      if (fixed.length) d.appendChild(folded('Fixed (' + fixed.length + ')', fixed));
      if (!toFix.length && !fixed.length) d.appendChild(el('p', 'p-note', 'No wrong answers in this range. 🎉'));
      return d;
    }

    function renderFocus(report, items) {
      var box = $('focus'), st = readOpen(box);
      box.textContent = '';
      if (!report) { box.appendChild(el('p', 'p-note', 'Focus file missing — copy engine/insights.js.')); return; }
      var active = report.subjects.filter(function (s) { return s.answered > 0; });
      if (!active.length) { box.appendChild(el('p', 'p-note', 'No quiz answers in this range yet.')); return; }
      box.appendChild(el('p', 'p-note', 'Subjects that need the most help come first. Open one to see its weakest lessons and the questions to fix.'));
      active.forEach(function (s, i) { box.appendChild(focusSubject(s, i === 0 && s.toFix > 0, items)); });
      restoreOpen(box, st);
    }

    function renderList(entries) {
      var box = $('hist-list');
      box.textContent = '';
      if (!entries.length) { box.appendChild(el('p', 'p-note', 'No activity in this range yet.')); return; }
      var lastDay = '';
      entries.forEach(function (e) {
        try {
          var when = new Date(e.t);
          var day = when.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
          if (day !== lastDay) { box.appendChild(el('div', 'h-day', day)); lastDay = day; }
          var row = el('div', 'h-item');
          row.appendChild(el('div', 'h-time', when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })));
          var body = el('div', 'h-body', describe(e));
          if (e.type === 'quiz' && wrongList(e).length) body.appendChild(wrongDetails(e));
          row.appendChild(body);
          box.appendChild(row);
        } catch (err) {
          var fallback = el('div', 'h-item');
          fallback.appendChild(el('div', 'h-time', new Date(e.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })));
          fallback.appendChild(el('div', 'h-body', subjectOf(e.app, e.appTitle) || 'Unknown'));
          box.appendChild(fallback);
        }
      });
    }

    function subjectRow(s, entry) {
      var M = root.Mastery;
      var d = el('details', 'f-subject' + (s.answered && s.pct < WEAK_BELOW ? ' need' : ''));
      d.setAttribute('data-app', s.app);
      var sum = el('summary'), head = el('div', 'f-head');
      head.appendChild(el('span', '', s.title));
      head.appendChild(el('span', 'f-stat', s.answered ? s.pct + '% right · ' + (s.quizzes === 1 ? '1 quiz' : s.quizzes + ' quizzes') : 'No quiz in this range'));
      sum.appendChild(head);
      if (s.answered) sum.appendChild(bar(s.pct));
      if (entry && M && M.counts) {
        var c = M.counts(entry);
        sum.appendChild(el('div', 'p-note', '🥇 ' + c.gold + ' · 🥈 ' + c.silver + ' · 🥉 ' + c.bronze + ' of ' + c.total + ' lessons'));
      }
      d.appendChild(sum);
      var rows = IN.lessonRows(s, entry);
      if (!rows.length) d.appendChild(el('p', 'p-note', 'Not opened since medals were added, and no quiz in this range.'));
      rows.forEach(function (l) {
        var row = el('div', 'f-row f-lesson');
        row.appendChild(el('span', '', MEDALS[l.medal] + ' ' + l.title + (l.polish ? ' 🔧' : '')));
        row.appendChild(el('span', l.answered && l.pct < WEAK_BELOW ? 'f-pick' : 'f-stat', l.answered ? l.pct + '% right' : 'No quiz in this range'));
        d.appendChild(row);
      });
      return d;
    }

    // In game order, not ranked: this tab is for looking a subject up.
    function renderSubjects(report) {
      var box = $('subjects-list');
      if (!box) return;
      var st = readOpen(box);
      box.textContent = '';
      if (!report) { box.appendChild(el('p', 'p-note', 'Subjects file missing — copy engine/insights.js.')); return; }
      var M = root.Mastery, apps = M && M.read ? M.read(STORE).apps : {}, byApp = {};
      report.subjects.forEach(function (s) { byApp[s.app] = s; });
      o.subjects.forEach(function (sub) {
        if (byApp[sub.app]) box.appendChild(subjectRow(byApp[sub.app], apps[sub.app]));
      });
      var listed = {};
      o.subjects.forEach(function (sub) { listed[sub.app] = true; });
      report.subjects.forEach(function (s) {
        if (!listed[s.app] && s.answered > 0) box.appendChild(subjectRow(s, apps[s.app]));
      });
      restoreOpen(box, st);
    }

    function reviewItems() {
      try {
        var d = JSON.parse(STORE.getItem('review_v1'));
        return d && d.items && typeof d.items === 'object' ? d.items : {};
      } catch (e) { return {}; }
    }

    function weekRow(s) {
      var row = el('div', 'w-row'), stat = el('span', 'w-stat');
      row.appendChild(el('span', 'w-name', s.title));
      stat.appendChild(el('span', '', s.now.pct !== null ? s.now.pct + '% right' : 'No quiz yet this week'));
      stat.appendChild(el('span', '', s.before.pct !== null ? 'last week ' + s.before.pct + '%' : 'none last week'));
      if (s.change !== null) {
        stat.appendChild(s.change > 0 ? el('span', 'w-up', '▲ ' + s.change) :
          s.change < 0 ? el('span', 'w-down', '▼ ' + (-s.change)) : el('span', 'w-same', '='));
      }
      row.appendChild(stat);
      return row;
    }

    function sendText(x) {
      var parts = [];
      if (x.questions.total) {
        parts.push(plural(x.questions.total, 'question') + ' → ' + x.questions.fixed + ' fixed, ' + (x.questions.total - x.questions.fixed) + ' still to fix');
      }
      if (x.lessons.total) {
        parts.push(plural(x.lessons.total, 'lesson') + ' → ' + x.lessons.practised + ' practised, ' + (x.lessons.total - x.lessons.practised) + ' not yet');
      }
      var day = new Date(x.t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      return day + ' · ' + x.title + ': ' + parts.join('; ');
    }

    // Always this week against last week, whatever range is picked.
    function renderWeek() {
      var box = $('week');
      if (!box) {
        var anchor = $('hist-summary') && $('hist-summary').closest('.p-panel[data-panel="focus"] > .p-section');
        if (!anchor || !IN || !IN.weekly) return;
        box = el('div', 'p-section');
        box.id = 'week';
        anchor.parentNode.insertBefore(box, anchor);
      }
      box.textContent = '';
      var w;
      try {
        w = IN.weekly(SH.list(null, null), { subjects: o.subjects, items: reviewItems(), sends: readPractice().sends, now: Date.now() });
      } catch (e) { box.hidden = true; return; }
      box.hidden = false;
      box.appendChild(el('h3', '', '📈 This week'));
      if (!w.subjects.length && !w.sends.length) {
        box.appendChild(el('p', 'p-note', 'No quiz answers this week or last week yet.'));
        return;
      }
      box.appendChild(el('p', 'p-note', 'Monday to today, compared with last week. The range above doesn\'t change this.'));
      w.subjects.forEach(function (s) { box.appendChild(weekRow(s)); });
      box.appendChild(el('p', 'w-fixed', '✅ Fixed this week: ' + plural(w.fixed, 'question')));
      if (w.sends.length) {
        box.appendChild(el('div', 'f-label', '📌 Practice sent'));
        w.sends.forEach(function (x) { box.appendChild(el('div', 'w-send', sendText(x))); });
      }
    }

    function renderHistory() {
      $('history-full').hidden = !SH.storageError();
      renderWeek();
      var r = currentRange();
      if (range === 'custom' && r[0] && r[1] && r[0] > r[1]) {
        $('range-msg').textContent = 'From must be on or before To.';
        $('hist-summary').textContent = '';
        $('focus').textContent = '';
        if ($('subjects-list')) $('subjects-list').textContent = '';
        $('hist-list').textContent = '';
        renderOlder();
        return;
      }
      $('range-msg').textContent = '';
      renderOlder();
      var entries = SH.list(r[0], r[1]), app = $('subject-filter').value || null;
      var items = reviewItems();
      var report = IN ? IN.build(entries, { subjects: o.subjects, items: items }) : null;
      renderSummary(SH.summary(entries), report);
      renderFocus(report, items);
      renderSubjects(report);
      renderList(app ? entries.filter(function (e) { return e.app === app; }) : entries);
    }

    var loadingOlder = false;
    function olderWanted() {
      var from = o.older && o.older.from();
      if (!from) return false;
      if (range === 'all') return true;
      if (range !== 'custom') return false;
      var start = $('range-from').value;
      return !start || start < SH.dateKey(from);
    }
    function renderOlder(failed) {
      var note = $('older-history');
      if (!olderWanted()) { if (note) note.hidden = true; return; }
      if (!note) {
        note = el('p', 'p-note');
        note.id = 'older-history';
        $('range-msg').parentNode.insertBefore(note, $('range-msg').nextSibling);
      }
      note.hidden = false;
      note.textContent = failed ? 'Could not load older history. Check the connection and try again. ' :
        'Showing history from the last ' + Math.round((Date.now() - o.older.from()) / 86400000) + ' days. ';
      var b = el('button', 'p-btn', loadingOlder ? 'Loading…' : 'Load older history');
      b.type = 'button';
      b.disabled = loadingOlder;
      b.addEventListener('click', loadOlder);
      note.appendChild(b);
    }
    function loadOlder() {
      if (loadingOlder) return;
      loadingOlder = true;
      renderOlder();
      o.older.load().then(function () {
        loadingOlder = false;
        renderHistory();
      }, function () {
        loadingOlder = false;
        renderOlder(true);
      });
    }

    function fmtDate(key) {
      var p = key.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    var tsRepeat = null;
    function tsValues() {
      var name = $('ts-name').value.trim(), scoreText = $('ts-score').value, totalText = $('ts-total').value;
      var score = Number(scoreText), total = Number(totalText);
      if (!name || scoreText === '' || totalText === '' || !Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) return null;
      return { app: $('ts-subject').value, name: name, score: score, total: total, coins: W.testBonus(score, total) };
    }
    function tsPreview() {
      tsRepeat = null;
      var v = tsValues();
      $('ts-add').disabled = !v;
      $('ts-add').textContent = v ? 'Add ' + v.coins + ' coins' : 'Add coins';
      $('ts-msg').textContent = v ? Math.floor(v.score * 100 / v.total) + '% → 🪙 ' + v.coins + ' coins' : '';
    }
    function tsAdd() {
      var v = tsValues();
      if (!v) return;
      var earlier = SH.findTest(v.app, v.name);
      if (earlier && tsRepeat !== earlier.id) {
        tsRepeat = earlier.id;
        $('ts-msg').textContent = 'Already added on ' + fmtDate(SH.dateKey(earlier.t)) + '. Tap Add again to add it again.';
        return;
      }
      if (!W.addBonus(v.coins)) {
        $('ts-msg').textContent = root.Clock && root.Clock.paused() ?
          "The tablet's date looks wrong, so coins are paused. Fix the date first." : 'Could not save. Storage may be full.';
        return;
      }
      SH.testScore(v.app, subjectOf(v.app), v.name, v.score, v.total, v.coins);
      if (W.refreshShop) W.refreshShop();
      if (W.renderCoins) W.renderCoins();
      $('ts-name').value = '';
      $('ts-score').value = '';
      $('ts-total').value = '';
      tsPreview();
      $('ts-msg').textContent = '✅ Added 🪙 ' + v.coins + ' coins for ' + v.name + '.';
      renderHistory();
      if (o.onChange) o.onChange();
    }

    o.subjects.forEach(function (s) {
      subjectByApp[s.app] = s.title;
      var opt = el('option', '', s.title);
      opt.value = s.app;
      $('subject-filter').appendChild(opt);
      var tsOpt = el('option', '', s.title);
      tsOpt.value = s.app;
      $('ts-subject').appendChild(tsOpt);
    });

    // The parent phone page has no clock section, so every use is guarded.
    function showClockFix() {
      if ($('clock-section')) $('clock-section').hidden = !(root.Clock && root.Clock.paused());
    }
    if ($('clock-fix')) {
      $('clock-fix').addEventListener('click', function () {
        root.Clock.fix();
        $('clock-msg').textContent = 'Done. Points and coins are back on.';
        $('clock-fix').hidden = true;
      });
    }
    showClockFix();

    $('test-score').hidden = !(SH && W && W.addBonus && W.testBonus);
    ['ts-name', 'ts-score', 'ts-total'].forEach(function (id) { $(id).addEventListener('input', tsPreview); });
    $('ts-subject').addEventListener('change', tsPreview);
    $('ts-add').addEventListener('click', tsAdd);

    $('range-buttons').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-range]');
      if (!b) return;
      var newRange = b.getAttribute('data-range');
      if (newRange === 'custom' && range !== 'custom') prefillCustomFrom(range);
      range = newRange;
      Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle('on', c === b); });
      $('custom-range').hidden = range !== 'custom';
      renderHistory();
    });
    ['range-from', 'range-to', 'subject-filter'].forEach(function (id) {
      $(id).addEventListener('change', renderHistory);
    });

    function showTab(name) {
      Array.prototype.forEach.call($('p-tabs').querySelectorAll('[data-tab]'), function (b) {
        var on = b.getAttribute('data-tab') === name;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      Array.prototype.forEach.call($('p-tabs').parentNode.querySelectorAll('.p-panel[data-panel]'), function (p) {
        p.hidden = p.getAttribute('data-panel') !== name;
      });
    }
    $('p-tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tab]');
      if (b) showTab(b.getAttribute('data-tab'));
    });

    // ---- lobby only: the PIN overlay, the learner's name, backups and deleting history ----
    function mountLobby() {
      var overlay = $('parent-overlay'), pinView = $('pin-view'), historyView = $('history-view');
      var gate = pinGate({ dots: $('pin-dots'), pad: $('pin-pad'), hint: $('pin-hint'), hintText: 'Enter the parent PIN', onUnlock: unlock });

      function lock() {
        gate.reset();
        pinView.hidden = false;
        historyView.hidden = true;
      }
      function openParent() {
        lock();
        overlay.hidden = false;
        doc.querySelector('.wrap').inert = true;
        $('parent-close').focus();
      }
      function closeParent() {
        lock();
        overlay.hidden = true;
        doc.querySelector('.wrap').inert = false;
        $('parent-open').focus();
      }
      function unlock() {
        showTab('focus');
        pinView.hidden = true;
        historyView.hidden = false;
        $('history-missing').hidden = !!SH;
        $('history-body').hidden = !SH;
        showClockFix();
        if (SH) { renderHistory(); renderBackupAge(); }
      }

      function download(name, text, type) {
        var url = URL.createObjectURL(new Blob([text], { type: type }));
        var a = el('a');
        a.href = url;
        a.download = name;
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        $('backup-msg').textContent = 'Saved ' + name + ' to your Downloads folder.';
      }

      var BACKUP_DUE_DAYS = 7;
      function savedState() {
        var state = {};
        var keys = ['wallet_v1', 'recall_v1', 'review_v1', 'mastery_v1', 'quests_v1', 'boss_v1', 'practice_v1', 'wardrobe_v1', 'house_v1'];
        o.subjects.forEach(function (s) { keys.push(s.pointsKey); });
        keys.forEach(function (k) {
          var v = null;
          try { v = STORE.getItem(k); } catch (e) {}
          if (v !== null) state[k] = v;
        });
        return state;
      }
      function pointsIn(state) {
        var total = 0;
        Object.keys(state).forEach(function (k) { if (/_points_v1$/.test(k)) total += parseInt(state[k], 10) || 0; });
        return total;
      }
      function daysSinceBackup() {
        var last = SH.lastBackup();
        if (last === null) return null;
        return Math.round((new Date(today()) - new Date(SH.dateKey(last))) / 86400000);
      }
      function renderBackupAge() {
        if (!SH || !SH.lastBackup) return;
        var days = daysSinceBackup();
        var late = days !== null && days > BACKUP_DUE_DAYS;
        var due = days === null ? pointsIn(savedState()) > 0 : late;
        $('parent-open').textContent = due ? '🔒 Parent · 💾 backup due' : '🔒 Parent';
        $('backup-age').textContent = days === null ? '⚠️ No full backup from this device yet.' :
          (late ? '⚠️ ' : '✅ ') + 'Last full backup: ' + (days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago') + (late ? '. Time to export a new one.' : '.');
      }
      function totalsText(state) { return '⭐ ' + pointsIn(state) + ' points' + coinsText(state); }
      function noStateReason(text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) {}
        if (data && data.state && typeof data.state === 'object') {
          return 'This backup has 0 points and no coins: the page it was copied from had nothing saved. Make the backup where the points show (the same app and the same link), then try again.';
        }
        return 'This backup has no points or coins in it (it was made with the old Export button).';
      }
      function coinsText(state) { return W && W.savedBalance ? ' and 🪙 ' + W.savedBalance(state) + ' coins' : ''; }
      function restoreState(b) {
        var current = savedState();
        var same = Object.keys(b.state).every(function (k) { return current[k] === b.state[k]; });
        if (same) return 'Points and coins already match this backup.';
        var when = b.exportedAt ? ' from ' + fmtDate(SH.dateKey(b.exportedAt)) : '';
        if (!confirm('This backup' + when + ' has ⭐ ' + pointsIn(b.state) + ' points' + coinsText(b.state) + '.\n' +
          'This device has ⭐ ' + pointsIn(current) + ' points' + coinsText(current) + '.\n\n' +
          'Replace the points and coins on this device with the ones in the backup?')) return 'Points and coins were left as they are.';
        try {
          Object.keys(b.state).forEach(function (k) { STORE.setItem(k, b.state[k]); });
          if (b.learner && L && !L.current().name) L.update(b.learner);
        } catch (e) {
          return 'Could not restore points and coins: storage is full or unavailable.';
        }
        setTimeout(function () { location.reload(); }, 1500);
        return 'Restored points and coins. Reloading…';
      }

      function renderLearner() {
        var me = L && L.current();
        $('learner-section').hidden = !me;
        if (!me) return;
        $('learner-name').value = me.name;
        $('learner-emoji').value = me.emoji;
        $('learner-boy').value = me.boy ? '1' : '0';
        $('hero-title').textContent = me.name ? (me.emoji ? me.emoji + ' ' : '') + 'Hi, ' + me.name + '!' : 'Study Games';
      }
      $('learner-save').addEventListener('click', function () {
        L.update({ name: $('learner-name').value, emoji: $('learner-emoji').value, boy: $('learner-boy').value === '1' });
        renderLearner();
        $('learner-msg').textContent = '✅ Saved.';
      });
      renderLearner();

      $('parent-open').addEventListener('click', openParent);
      renderBackupAge();
      $('parent-close').addEventListener('click', closeParent);
      root.addEventListener('pagehide', closeParent);
      root.addEventListener('focus', function () { picking = false; });
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden && !picking) closeParent();
      });
      doc.addEventListener('keydown', function (ev) {
        if (overlay.hidden) return;
        if (ev.key === 'Escape') closeParent();
        else if (!pinView.hidden && /^[0-9]$/.test(ev.key)) gate.press(ev.key);
        else if (!pinView.hidden && ev.key === 'Backspace') gate.press('clear');
      });

      $('export-json').addEventListener('click', function () {
        download('study-backup-' + SH.grade + '-' + today() + '.json', SH.exportJson(savedState(), L && L.current()), 'application/json');
        $('backup-msg').textContent += ' It holds ' + totalsText(savedState()) + '.';
        SH.markBackedUp();
        renderBackupAge();
      });
      $('export-csv').addEventListener('click', function () {
        download('study-history-' + SH.grade + '-' + today() + '.csv', SH.exportCsv(subjectOf), 'text/csv;charset=utf-8');
      });
      $('export-shop').addEventListener('click', function () {
        download('shop-history-' + SH.grade + '-' + today() + '.csv', SH.exportPurchasesCsv(), 'text/csv;charset=utf-8');
      });
      function importResult(msg) {
        $('backup-msg').textContent = msg;
        alert(msg);
      }
      function importText(text) {
        try {
          var r = SH.importJson(text);
          var b = SH.backupState(text);
          var history = 'Study history: added ' + entriesWord(r.added) + ', skipped ' + plural(r.skipped, 'duplicate') + '.';
          renderHistory();
          importResult(history + ' ' + (b ? restoreState(b) : noStateReason(text) + ' Only the history was added.'));
        } catch (err) {
          importResult(err.message);
        }
      }
      function showPasteBox(hint, text) {
        $('paste-box').hidden = false;
        $('paste-hint').textContent = hint;
        $('paste-text').value = text;
        $('paste-text').focus();
        if (text) $('paste-text').select();
      }
      function copyText(text) {
        var ta = el('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        doc.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = false;
        try { ok = doc.execCommand('copy'); } catch (e) {}
        ta.remove();
        return ok;
      }
      $('copy-backup').addEventListener('click', function () {
        var text = SH.exportJson(savedState(), L && L.current());
        if (copyText(text)) {
          SH.markBackedUp();
          renderBackupAge();
          importResult('Full backup copied: ' + totalsText(savedState()) + '. Paste it somewhere safe (a note, or a message to yourself). To restore, open the lobby, then Parent, Paste backup.');
          return;
        }
        showPasteBox('Copying did not work here. Select all of the text below and copy it yourself.', text);
        SH.markBackedUp();
        renderBackupAge();
      });
      $('paste-btn').addEventListener('click', function () {
        showPasteBox('Paste the full backup text here, then tap Import pasted backup.', '');
      });
      $('paste-import').addEventListener('click', function () {
        var text = $('paste-text').value.trim();
        if (!text) { importResult('Paste the backup text first.'); return; }
        importText(text);
      });
      $('import-btn').addEventListener('click', function () { picking = true; $('import-file').click(); });
      $('import-file').addEventListener('change', function () {
        picking = false;
        var input = this, file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          importText(String(reader.result));
          input.value = '';
        };
        reader.onerror = function () {
          importResult('Could not read that file.');
          input.value = '';
        };
        reader.readAsText(file);
      });

      $('delete-range').addEventListener('click', function () {
        var from = $('del-from').value, to = $('del-to').value;
        if (!from || !to || from > to) {
          $('delete-msg').textContent = 'Pick a From date and a To date (From must be on or before To).';
          return;
        }
        var n = SH.list(from, to).length;
        if (!n) { $('delete-msg').textContent = 'Nothing to delete in that range.'; return; }
        if (!confirm('Delete ' + entriesWord(n) + ' from ' + fmtDate(from) + ' to ' + fmtDate(to) + '? This cannot be undone. Export a backup first if you might want them.')) return;
        var removed = SH.deleteRange(from, to);
        $('delete-msg').textContent = removed === 0 ? 'Could not delete — browser storage is unavailable.' : 'Deleted ' + entriesWord(removed) + '.';
        renderHistory();
      });
      $('delete-all').addEventListener('click', function () {
        var n = SH.list(null, null).length;
        if (!n) { $('delete-msg').textContent = 'History is already empty.'; return; }
        if (!confirm('Delete ALL ' + entriesWord(n) + ' on this device? This cannot be undone.')) return;
        var removed = SH.deleteAll();
        $('delete-msg').textContent = removed === 0 ? 'Could not delete — browser storage is unavailable.' : 'Deleted ' + entriesWord(removed) + '.';
        renderHistory();
      });
    }

    if (o.lobby) mountLobby();
    return { render: renderHistory, showTab: showTab };
  }

  root.ParentPanel = { mount: mount, pinGate: pinGate, checkPin: checkPin, subjectsFromCards: subjectsFromCards };
})(this);
