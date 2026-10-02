/* The Parent panel: study history with its filters, Needs practice and real test scores. In the lobbies it also has
   the PIN overlay, the learner's name, backups and deleting history. Shared by both lobbies and the parent page. */
(function (root) {
  'use strict';

  var PIN = '0108';

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
      if (entered === PIN) { entered = ''; draw(); o.onUnlock(); return; }
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
  function mount(o) {
    var SH = o.history, W = o.wallet, L = o.learner, STORE = o.store;
    var doc = root.document;
    var $ = function (id) { return doc.getElementById(id); };
    var range = '7';
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
      if (e.type === 'purchase') return '🛒 Bought ' + e.itemName + ' — ' + e.coins + ' coins' + (e.via === 'phone' ? " · approved on the parent's phone" : e.via === 'pin' ? ' · approved with the PIN on the tablet' : '');
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

    function renderSummary(s) {
      var box = $('hist-summary');
      box.textContent = '';
      box.appendChild(el('span', '', '⏱️ Study time: ' + (s.studyMs > 0 ? formatDuration(s.studyMs) : 'none yet')));
      box.appendChild(el('span', '', '✏️ Quizzes: ' + s.quizzes));
      box.appendChild(el('span', '', '🎯 Average: ' + (s.averagePct === null ? '—' : s.averagePct + '%')));
      if (s.mostMissed) {
        box.appendChild(el('span', 'missed', 'Most missed: ' + subjectOf(s.mostMissed.app, s.mostMissed.appTitle) + ' · “' + s.mostMissed.q + '” (' + s.mostMissed.count + '×)'));
      }
    }

    var WEAK_BELOW = 80;
    function renderWeakSpots(entries) {
      var box = $('weak-spots');
      box.textContent = '';
      if (!SH.weakSpots) return;
      box.appendChild(el('h3', '', '📉 Needs practice'));
      var all = SH.weakSpots(entries, 50);
      var spots = all.filter(function (s) { return s.pct < WEAK_BELOW; }).slice(0, 5);
      if (!spots.length) {
        box.appendChild(el('p', 'p-note', all.length ? 'Every lesson is at ' + WEAK_BELOW + '% or more in this range. 🎉' : 'Not enough quiz answers in this range yet.'));
        return;
      }
      box.appendChild(el('p', 'p-note', 'Lessons under ' + WEAK_BELOW + '% right, weakest first (at least 5 answers).'));
      var ol = el('ol', 'weak-list');
      spots.forEach(function (s) {
        ol.appendChild(el('li', '', subjectOf(s.app, s.appTitle) + ' · ' + s.lesson + ' — ' + s.pct + '% right (' +
          s.correct + ' of ' + s.answered + ', ' + (s.quizzes === 1 ? '1 quiz' : s.quizzes + ' quizzes') + ')'));
      });
      box.appendChild(ol);
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

    function renderHistory() {
      $('history-full').hidden = !SH.storageError();
      var r = currentRange();
      if (range === 'custom' && r[0] && r[1] && r[0] > r[1]) {
        $('range-msg').textContent = 'From must be on or before To.';
        $('hist-summary').textContent = '';
        $('weak-spots').textContent = '';
        $('hist-list').textContent = '';
        return;
      }
      $('range-msg').textContent = '';
      var entries = SH.list(r[0], r[1], $('subject-filter').value || null);
      renderSummary(SH.summary(entries));
      renderWeakSpots(entries);
      renderList(entries);
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
      if (!W.addBonus(v.coins)) { $('ts-msg').textContent = 'Could not save. Storage may be full.'; return; }
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
        pinView.hidden = true;
        historyView.hidden = false;
        $('history-missing').hidden = !!SH;
        $('history-body').hidden = !SH;
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
        var keys = ['wallet_v1', 'recall_v1'];
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
          return 'This backup has 0 points and no coins: the page it was copied from had nothing saved. Make the backup where she can see her points (the same app and the same link), then try again.';
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
        $('hero-title').textContent = me.name ? (me.emoji ? me.emoji + ' ' : '') + 'Hi, ' + me.name + '!' : 'Study Games';
      }
      $('learner-save').addEventListener('click', function () {
        L.update({ name: $('learner-name').value, emoji: $('learner-emoji').value });
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
    return { render: renderHistory };
  }

  root.ParentPanel = { mount: mount, pinGate: pinGate, subjectsFromCards: subjectsFromCards };
})(this);
