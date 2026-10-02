/* Loaded by every game, before its own script. Points, streaks, rounds, the daily star reset and the lobby visit,
   so the scoring rules live in one place. Points are cumulative and survive ?reset=1: stars reset each day, points never do. */
(function (root) {
  'use strict';

  var RULES = { POINTS_PER_CORRECT: 10, EXAM_POINTS_PER_CORRECT: 20, STREAK_BONUS: 5, STREAK_BONUS_AT: 3 };

  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  // opts: { app, title, pointsKey, progressKey, liveLabel = 'pts', liveSelector = '#points-live' }
  function start(opts, win, now) {
    var store = win.localStorage;
    function get(key) { try { return store.getItem(key); } catch (e) { return null; } }
    function set(key, value) { try { store.setItem(key, value); } catch (e) {} }

    var total = parseInt(get(opts.pointsKey), 10) || 0;
    var session = 0, streak = 0, best = 0;

    var progress;
    try { progress = JSON.parse(get(opts.progressKey)) || {}; } catch (e) { progress = {}; }
    var dayStorageKey = opts.progressKey + '_day';
    var today = dayKey(now());
    if (get(dayStorageKey) !== today) {
      progress = {};
      set(opts.progressKey, JSON.stringify(progress));
      set(dayStorageKey, today);
    }

    var search = win.location ? win.location.search : '';
    if (/(^|[?&])reset=1(&|$)/.test(search)) {
      if (win.StudyHistory) win.StudyHistory.appOpened(opts.app, opts.title);
      if (win.history && win.history.replaceState) win.history.replaceState(null, '', win.location.pathname + win.location.hash);
    }

    function renderLive() {
      var html = '⭐ ' + session + ' ' + (opts.liveLabel || 'pts') + (streak >= 2 ? ' <span class="streak">🔥 x' + streak + '</span>' : '') +
        (win.Wallet && win.Wallet.liveHtml ? win.Wallet.liveHtml() : '');
      var els = win.document.querySelectorAll(opts.liveSelector || '#points-live');
      for (var i = 0; i < els.length; i++) els[i].innerHTML = html;
    }

    function roundLine(what) {
      var line = '⭐ +' + session + ' points ' + what;
      if (best >= RULES.STREAK_BONUS_AT) line += ' · 🔥 best streak: ' + best + ' in a row!';
      return line;
    }

    return {
      totalPoints: function () { return total; },
      sessionPoints: function () { return session; },
      streak: function () { return streak; },
      bestStreak: function () { return best; },
      pointsKey: opts.pointsKey,
      progress: function () { return progress; },
      saveProgress: function (p) {
        progress = p;
        set(opts.progressKey, JSON.stringify(p));
      },
      // A round is one quiz, one walkthrough problem or one case study; a streak carries across the whole round.
      startRound: function () {
        session = 0;
        streak = 0;
        best = 0;
        renderLive();
      },
      // opts.shield: false for answers that never had power-ups, so an unused Streak Shield is not spent.
      answer: function (correct, o) {
        var pts = 0;
        if (correct) {
          if (!o.helped) streak++;
          if (streak > best) best = streak;
          var base = o.exam ? RULES.EXAM_POINTS_PER_CORRECT : RULES.POINTS_PER_CORRECT;
          var bonus = streak >= RULES.STREAK_BONUS_AT ? RULES.STREAK_BONUS : 0;
          pts = win.Recall ? win.Recall.points(!!o.helped, base, bonus) : o.helped ? base / 2 : base + bonus;
          session += pts;
          total += pts;
          set(opts.pointsKey, String(total));
          if (win.Wallet && win.Wallet.renderCoins) win.Wallet.renderCoins();
          if (win.Fx) win.Fx.correct(o.helped ? 0 : streak);
        } else {
          if (!(o.shield !== false && win.PowerUps && win.PowerUps.shield())) streak = 0;
          if (win.Fx) win.Fx.wrong();
        }
        renderLive();
        return pts;
      },
      renderLive: renderLive,
      roundLine: roundLine,
      resultLine: function () { return roundLine('this round') + (win.Recall ? win.Recall.resultLine() : ''); }
    };
  }

  var exported = { start: start, RULES: RULES };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.StudyKit = { RULES: RULES, start: function (opts) { return start(opts, root, function () { return new Date(); }); } };
})(this);
