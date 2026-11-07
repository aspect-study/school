/* Loaded by every game, before its own script. Points, streaks, rounds, the daily star reset and the lobby visit,
   so the scoring rules live in one place. Points are cumulative and survive ?reset=1: stars reset each day, points never do. */
(function (root) {
  'use strict';

  var RULES = { POINTS_PER_CORRECT: 10, EXAM_POINTS_PER_CORRECT: 20, STREAK_BONUS: 5, STREAK_BONUS_AT: 3 };

  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  // ?term=1|2 picks the lessons a page shows; &exam=1 (with a term) opens that term's final exam.
  function viewOf(search) {
    var t = /(?:^|[?&])term=([12])(?:&|$)/.exec(search || '');
    return { term: t ? Number(t[1]) : null, exam: !!t && /(?:^|[?&])exam=1(?:&|$)/.test(search || '') };
  }

  // A lesson without term is Term 1. An exam-only lesson (summative practice) shows only in the exam view.
  function pick(list, term, examView) {
    if (!term) return list.slice();
    return list.filter(function (l) { return (l.term || 1) === term && (examView || !l.exam); });
  }

  // opts: { app, title, pointsKey, progressKey, liveLabel = 'pts', liveSelector = '#points-live' }
  function start(opts, win, now) {
    var store = win.Learner ? win.Learner.storage : win.localStorage;
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
    var view = viewOf(search), finalKey = view.term ? 'final-t' + view.term : null, bothFinal = progress.final;
    if (finalKey) {
      progress = Object.assign({}, progress);
      if (progress[finalKey] === undefined) delete progress.final;
      else progress.final = progress[finalKey];
      delete progress[finalKey];
    }

    if (/(^|[?&])reset=1(&|$)/.test(search)) {
      if (win.StudyHistory) win.StudyHistory.appOpened(opts.app, opts.title);
      var keep = [];
      if (/[?&]embed=1(&|$)/.test(search)) keep.push('embed=1');
      if (view.term) keep.push('term=' + view.term);
      if (win.history && win.history.replaceState) win.history.replaceState(null, '', win.location.pathname + (keep.length ? '?' + keep.join('&') : '') + win.location.hash);
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
        var out = p;
        if (finalKey) {
          out = Object.assign({}, p);
          if (p.final !== undefined) out[finalKey] = p.final;
          if (bothFinal === undefined) delete out.final;
          else out.final = bothFinal;
        }
        set(opts.progressKey, JSON.stringify(out));
      },
      // A round is one quiz, one walkthrough problem or one case study; a streak carries across the whole round.
      startRound: function () {
        session = 0;
        streak = 0;
        best = 0;
        if (win.Fx && win.Fx.round) win.Fx.round();
        if (win.Army && win.Army.stop) { try { win.Army.stop(); } catch (e) {} }
        renderLive();
      },
      // opts.shield: false for answers that never had power-ups, so an unused Streak Shield is not spent.
      // opts.extra: points added to an unhelped right answer (Math Mastery's review bonus).
      answer: function (correct, o) {
        var pts = 0;
        if (correct) {
          if (!o.helped) streak++;
          if (streak > best) best = streak;
          var base = o.exam ? RULES.EXAM_POINTS_PER_CORRECT : RULES.POINTS_PER_CORRECT;
          var bonus = streak >= RULES.STREAK_BONUS_AT ? RULES.STREAK_BONUS : 0;
          pts = win.Recall ? win.Recall.points(!!o.helped, base, bonus) : o.helped ? base / 2 : base + bonus;
          if (!o.helped && o.extra) pts += o.extra;
          if (win.Clock && win.Clock.paused()) pts = 0;
          session += pts;
          total += pts;
          set(opts.pointsKey, String(total));
          if (win.Wallet && win.Wallet.renderCoins) win.Wallet.renderCoins();
          if (win.Fx) win.Fx.correct(o.helped ? 0 : streak, { exam: !!o.exam });
        } else {
          if (win.Recall && win.Recall.missed) win.Recall.missed();
          if (!(o.shield !== false && win.PowerUps && win.PowerUps.shield())) streak = 0;
          if (win.Fx) win.Fx.wrong();
        }
        if (win.Army && win.Army.hit) { try { win.Army.hit(!!correct); } catch (e) {} }
        renderLive();
        return pts;
      },
      // Milestone points (a new medal): they count toward coins but not toward this round's line.
      award: function (pts) {
        if (!(pts > 0)) return;
        total += pts;
        set(opts.pointsKey, String(total));
        if (win.Wallet && win.Wallet.renderCoins) win.Wallet.renderCoins();
      },
      renderLive: renderLive,
      roundLine: roundLine,
      resultLine: function () { return roundLine('this round') + (win.Recall ? win.Recall.resultLine() : ''); }
    };
  }

  // Each subjects/<grade>/<subject>/lessons/NN-name.js file calls lesson({...}); the page's script tags set the order.
  // content(name, value) holds the rest of a subject's data (exam tips, type-it answers, case studies).
  function library(view) {
    var lessons = [], content = {}, v = view || { term: null, exam: false };
    return {
      lesson: function (l) { lessons.push(l); },
      lessons: function () { return pick(lessons, v.term, v.exam); },
      all: function () { return lessons.slice(); },
      content: function (name, value) {
        if (arguments.length > 1) content[name] = value;
        return content[name];
      }
    };
  }

  var exported = { start: start, library: library, viewOf: viewOf, pick: pick, RULES: RULES };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  var VIEW = viewOf(root.location ? root.location.search : '');
  var lib = library(VIEW);
  root.StudyKit = {
    RULES: RULES,
    start: function (opts) { return start(opts, root, function () { return new Date(); }); },
    lesson: lib.lesson,
    lessons: lib.lessons,
    all: lib.all,
    pick: function (list) { return pick(list, VIEW.term, VIEW.exam); },
    term: function () { return VIEW.term; },
    examView: function () { return VIEW.exam; },
    content: lib.content
  };
})(this);
