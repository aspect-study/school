/* Loaded by both lobbies and every game after mastery.js, and by the parent page. The pages are decoded as UTF-8, so the text can hold emoji.
   The lobby picks 3 quests a day; finishing rounds ticks them off. All 3 pay a small bonus once a day, and a streak
   that survives 2 rest days in any 7 pays at 7, 14, 30 and 60 days. Nothing here ever talks about losing a streak. */
(function (root) {
  'use strict';

  function wordsFor(grade) { return grade === 'grade2' && root.Lang && !root.Lang.both() ? TEXT.grade5 : TEXT[grade]; }

  var KEY = 'quests_v1';
  var ORDER = ['rounds', 'stars', 'right', 'explore', 'best'];
  var ALL_COINS = 3;
  var MILESTONES = [[7, 5], [14, 10], [30, 15], [60, 20]];
  var KEEP_DAYS = 400;
  var WEAK_DAYS = 14;
  var RIGHT_GOAL = 20;
  var ROUNDS_GOAL = 2;
  var REST_DAYS = 2;

  function restEn(r) { return r > 0 ? 'you can rest ' + r + (r === 1 ? ' more day' : ' more days') + ' this week' : 'come back tomorrow to keep it going'; }
  function coinsEn(c) { return '+' + c + ' coins'; }
  var QUEST_EN = {
    review: function (q) { return '🔁 Do a Review round in ' + q.title; },
    practice: function (q) { return '📘 Practice ' + q.lesson + ' in ' + q.title; },
    stars: function () { return '⭐ Get 3 stars on a lesson'; },
    right: function () { return '✅ Get ' + RIGHT_GOAL + ' answers right today'; },
    rounds: function () { return '🎮 Play ' + ROUNDS_GOAL + ' rounds of any game'; },
    explore: function (q) { return '🧭 Go play ' + q.title + ' today'; },
    best: function () { return '🏅 Beat your best score on a lesson'; }
  };
  var QUEST_FIL = {
    review: function (q) { return 'Gumawa ng Review round sa ' + q.title; },
    practice: function (q) { return 'Sanayin ang ' + q.lesson + ' sa ' + q.title; },
    stars: function () { return 'Kumuha ng 3 star sa isang aralin'; },
    right: function () { return RIGHT_GOAL + ' tamang sagot ngayon'; },
    rounds: function () { return 'Maglaro ng ' + ROUNDS_GOAL + ' round'; },
    explore: function (q) { return 'Laruin ang ' + q.title + ' ngayon'; },
    best: function () { return 'Talunin ang best score mo sa isang aralin'; }
  };
  function streakEn(s) {
    if (s.days) return '🔥 ' + s.days + '-day streak · ' + restEn(s.restLeft);
    return s.welcomeBack ? 'Welcome back! Let\'s start a new streak' : 'Start a streak today!';
  }

  var TEXT = {
    grade5: {
      title: '🎯 Today\'s quests',
      quest: function (q) { return (QUEST_EN[q.kind] || QUEST_EN.rounds)(q); },
      streak: streakEn,
      doneTitle: 'You finished a quest!',
      doneNext: function (n, total) { return n + ' of ' + total + ' quests done today'; },
      allTitle: 'You finished all 3 quests!',
      allNext: 'See you tomorrow!',
      streakTitle: function (n) { return 'You have a ' + n + '-day streak!'; },
      streakNext: function (next) { return next ? 'Next: ' + next + ' days' : 'You are amazing!'; },
      coins: coinsEn
    },
    grade2: {
      title: '🎯 Mga quest ngayon · Today\'s quests',
      quest: function (q) {
        var en = (QUEST_EN[q.kind] || QUEST_EN.rounds)(q), cut = en.indexOf(' ');
        return en.slice(0, cut) + ' ' + (QUEST_FIL[q.kind] || QUEST_FIL.rounds)(q) + ' · ' + en.slice(cut + 1);
      },
      streak: function (s) {
        if (s.days) return '🔥 ' + s.days + ' araw na sunod-sunod · ' + (s.restLeft > 0 ? s.restLeft + ' pahinga pa' : 'bumalik bukas para tuloy-tuloy') + ' · ' + streakEn(s).slice(3);
        return s.welcomeBack ? 'Maligayang pagbabalik! · Welcome back! Let\'s start a new streak' : 'Simulan ang streak ngayon! · Start a streak today!';
      },
      doneTitle: 'Tapos ang quest! · You finished a quest!',
      doneNext: function (n, total) { return n + ' sa ' + total + ' quest ngayon · ' + n + ' of ' + total + ' quests done today'; },
      allTitle: 'Tapos ang 3 quest! · You finished all 3 quests!',
      allNext: 'Kita tayo bukas! · See you tomorrow!',
      streakTitle: function (n) { return n + ' araw na sunod-sunod! · You have a ' + n + '-day streak!'; },
      streakNext: function (next) { return next ? 'Susunod: ' + next + ' araw · Next: ' + next + ' days' : 'Ang galing mo! · You are amazing!'; },
      coins: coinsEn
    }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayNum(key) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
    return p ? Math.round(Date.UTC(+p[1], +p[2] - 1, +p[3]) / 86400000) : NaN;
  }
  function keyOfNum(n) { var d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function strings(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; }

  function read(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    var ok = isObj(d) && d.v === 1;
    return {
      v: 1,
      day: ok && typeof d.day === 'string' ? d.day : '',
      at: ok && typeof d.at === 'number' ? d.at : 0,
      list: ok && Array.isArray(d.list) ? d.list.filter(isObj) : [],
      days: ok ? strings(d.days) : [],
      paidDay: ok && typeof d.paidDay === 'string' ? d.paidDay : '',
      streakPaid: ok ? strings(d.streakPaid) : []
    };
  }

  // days: study days as YYYY-MM-DD. Going back from today (or yesterday, while today has no quest yet), the run
  // continues until some 7-day window holds 3 days without study.
  function streakOf(days, today) {
    var set = {}, t = dayNum(today), any = false;
    days.forEach(function (d) { var n = dayNum(d); if (!isNaN(n)) { set[n] = true; any = true; } });
    var start = set[t] ? t : t - 1, count = 0, first = null, misses = [];
    for (var d = start; d > start - 400; d--) {
      if (set[d]) { count++; first = d; continue; }
      misses.push(d);
      if (misses.filter(function (m) { return m - d < 7; }).length > REST_DAYS) break;
    }
    var used = 0;
    if (first !== null) for (var r = Math.max(t - 6, first); r < t; r++) if (!set[r]) used++;
    return { days: count, start: first === null ? null : keyOfNum(first), restLeft: Math.max(0, REST_DAYS - used), welcomeBack: count === 0 && any };
  }

  function parentLine(state, nowMs) {
    var today = dayKey(nowMs), s = streakOf(state.days, today);
    var head = s.days ? '🔥 ' + s.days + '-day streak' : 'No streak yet';
    if (state.day !== today || !state.list.length) return head + ' · quests not picked yet today';
    var done = state.list.filter(function (q) { return q.done; }).length;
    return head + ' · today ' + done + ' of ' + state.list.length + ' quests';
  }

  function hrefFor(card, kind) {
    return card.href + (kind === 'review' ? (card.href.indexOf('?') >= 0 ? '&' : '?') + 'review=1' : '');
  }

  function linkFor(q, cards) {
    if (!q.app) return null;
    for (var i = 0; i < cards.length; i++) if (cards[i].app === q.app) return hrefFor(cards[i], q.kind);
    return null;
  }

  // A milestone run never overlaps another, so any paid entry that starts on or after this run's start belongs to it.
  function milestonePaid(streakPaid, m, start) {
    return streakPaid.some(function (k) {
      var p = k.split('|');
      return p.length === 2 && Number(p[1]) === m && p[0] >= start;
    });
  }

  function plainLesson(label) {
    return label !== 'Final Mock Exam' && label.indexOf('UPAC Walkthrough: ') !== 0 && label.indexOf('Case Study: ') !== 0;
  }

  // deps: { history() -> study history entries, due() -> { app: count }, weak(entries) -> SH.weakSpots groups, bonus(coins) -> true when paid,
  //         paused?() -> true while the date guard is on }
  function create(storage, now, grade, deps) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Quests needs a grade like "grade5".');
    var T = wordsFor(grade);
    var news = deps.news || function () {};

    function save(state) { try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
    function finished(entries) {
      return entries.filter(function (e) { return e && e.type === 'quiz' && e.finished === true && typeof e.t === 'number'; });
    }
    function lessonQuiz(e) { return !e.kind && !e.final && typeof e.lessonTitle === 'string'; }

    function doneBy(q, today) {
      if (q.kind === 'review') return today.some(function (e) { return e.kind === 'review' && e.app === q.app; });
      if (q.kind === 'practice') return today.some(function (e) { return lessonQuiz(e) && e.app === q.app && e.lessonTitle === q.lesson; });
      if (q.kind === 'stars') return today.some(function (e) { return e.stars === 3; });
      if (q.kind === 'right') return today.reduce(function (n, e) { return n + (Number(e.correct) || 0); }, 0) >= RIGHT_GOAL;
      if (q.kind === 'rounds') return today.length >= ROUNDS_GOAL;
      if (q.kind === 'explore') return today.some(function (e) { return e.app === q.app; });
      if (q.kind === 'best') {
        var all = finished(deps.history());
        return today.some(function (e) {
          if (!lessonQuiz(e)) return false;
          var before = all.filter(function (o) { return lessonQuiz(o) && o.app === e.app && o.lessonTitle === e.lessonTitle && o.t < e.t; });
          return before.length > 0 && before.every(function (o) { return (Number(e.correct) || 0) > (Number(o.correct) || 0); });
        });
      }
      return false;
    }

    // A clock set back (or paused by the date guard) never makes a list for an earlier day, so a missed day can't be filled in.
    function stuck(state, today) { return (deps.paused && deps.paused()) || (!!state.day && dayNum(today) < dayNum(state.day)); }

    function pick(cards) {
      var state = read(storage), today = dayKey(now());
      if (state.day === today && state.list.length === 3) return state;
      if (stuck(state, today)) return state;
      var last = state.list, apps = cards.map(function (c) { return c.app; }), byApp = {};
      cards.forEach(function (c) { byApp[c.app] = c; });
      var entries = finished(deps.history());
      function prevOf(kind) { for (var i = 0; i < last.length; i++) if (last[i].kind === kind) return last[i]; return null; }
      function quest(kind, app, extra) {
        var q = { id: kind + (app ? '|' + app : '') + (extra && extra.lesson ? '|' + extra.lesson : ''), kind: kind };
        if (app) { q.app = app; q.title = byApp[app].title; q.href = hrefFor(byApp[app], kind); }
        if (extra && extra.lesson) q.lesson = extra.lesson;
        q.done = false;
        return q;
      }
      function notYesterday(list, same) { return list.length > 1 ? list.filter(function (x) { return !same(x); }) : list; }

      var due = deps.due() || {}, prevReview = prevOf('review');
      var dueApps = apps.filter(function (a) { return due[a] > 0; }).sort(function (a, b) { return due[b] - due[a] || apps.indexOf(a) - apps.indexOf(b); });
      dueApps = notYesterday(dueApps, function (a) { return prevReview && prevReview.app === a; });
      var slot1 = dueApps.length ? quest('review', dueApps[0]) : quest('stars');

      var from = dayNum(today) - WEAK_DAYS, prevPractice = prevOf('practice');
      var recent = entries.filter(function (e) { return dayNum(dayKey(e.t)) >= from; });
      var weak = (deps.weak(recent) || []).filter(function (g) { return byApp[g.app] && typeof g.lesson === 'string' && plainLesson(g.lesson) && g.pct < 80; });
      weak = notYesterday(weak, function (g) { return prevPractice && prevPractice.app === g.app && prevPractice.lesson === g.lesson; });
      var slot2 = weak.length ? quest('practice', weak[0].app, { lesson: weak[0].lesson }) : quest('right');

      var lastPlayed = {};
      entries.forEach(function (e) { if (!lastPlayed[e.app] || e.t > lastPlayed[e.app]) lastPlayed[e.app] = e.t; });
      var open = apps.filter(function (a) { return a !== slot1.app && a !== slot2.app; });
      var stale = (open.length ? open : apps).slice().sort(function (a, b) { return (lastPlayed[a] || 0) - (lastPlayed[b] || 0) || apps.indexOf(a) - apps.indexOf(b); })[0];
      var playedLesson = entries.some(lessonQuiz);
      var prev3 = last.length === 3 ? last[2].kind : null, startAt = (ORDER.indexOf(prev3) + 1) % ORDER.length, slot3 = null;
      for (var i = 0; i < ORDER.length && !slot3; i++) {
        var kind = ORDER[(startAt + i) % ORDER.length];
        if (kind === slot1.kind || kind === slot2.kind || kind === prev3) continue;
        if (kind === 'explore' && !stale) continue;
        if (kind === 'best' && !playedLesson) continue;
        slot3 = kind === 'explore' ? quest('explore', stale) : quest(kind);
      }
      if (!slot3) slot3 = quest('rounds');

      state.day = today;
      state.at = now();
      state.list = [slot1, slot2, slot3];
      save(state);
      return state;
    }

    function check() {
      var state = read(storage), today = dayKey(now()), events = [], changed = false;
      if (state.day !== today || !state.list.length || stuck(state, today)) return [];
      var todays = finished(deps.history()).filter(function (e) { return e.t >= state.at && dayKey(e.t) === today; });
      var doneCount = state.list.filter(function (q) { return q.done; }).length;
      state.list.forEach(function (q) {
        if (q.done || !doneBy(q, todays)) return;
        q.done = true;
        changed = true;
        doneCount++;
        events.push({ big: false, icon: '🎯', title: T.doneTitle, line: T.quest(q), next: T.doneNext(doneCount, state.list.length) });
      });
      if (doneCount && state.days.indexOf(today) < 0) {
        state.days.push(today);
        state.days.sort();
        state.days = state.days.slice(-KEEP_DAYS);
        changed = true;
      }
      // Mark and save first, then pay: a failed save never leaves coins without a mark, a failed payment leaves no mark.
      function pay(coins, mark, unmark) {
        mark();
        if (!save(state)) { unmark(); return false; }
        if (deps.bonus(coins)) return true;
        unmark();
        save(state);
        return false;
      }
      if (doneCount === state.list.length && state.paidDay !== today) {
        var before = state.paidDay;
        if (pay(ALL_COINS, function () { state.paidDay = today; }, function () { state.paidDay = before; })) {
          events.unshift({ big: true, icon: '🎯', title: T.allTitle, line: T.coins(ALL_COINS), next: T.allNext });
          news('quests', {});
        }
      }
      var s = streakOf(state.days, today);
      MILESTONES.forEach(function (m, i) {
        if (!s.start || s.days < m[0] || milestonePaid(state.streakPaid, m[0], s.start)) return;
        var key = s.start + '|' + m[0];
        if (pay(m[1], function () { state.streakPaid.push(key); }, function () { state.streakPaid.pop(); })) {
          events.unshift({ big: true, icon: '🔥', title: T.streakTitle(m[0]), line: T.coins(m[1]), next: T.streakNext(MILESTONES[i + 1] ? MILESTONES[i + 1][0] : 0) });
          news('streak', { n: m[0] });
        }
      });
      if (changed && !save(state)) return [];
      return events;
    }

    return {
      text: T,
      pick: pick,
      check: check,
      doneBy: doneBy,
      state: function () { return read(storage); },
      streak: function () { return streakOf(read(storage).days, dayKey(now())); }
    };
  }

  var UI_CSS =
    '.quests{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#FFF8E6;color:#4A3500;font-weight:800;}' +
    '.quests[hidden]{display:none;}' +
    '.quests-title{margin:0 0 8px;}' +
    '.quests-list{margin:0;padding:0;list-style:none;display:grid;gap:6px;}' +
    '.quests-list li{display:flex;gap:8px;align-items:center;font-size:.95rem;}' +
    '.quests-list a{color:inherit;text-decoration:underline;text-underline-offset:3px;}' +
    '.quests-list a:focus-visible{outline:3px solid #4A3500;outline-offset:2px;border-radius:6px;}' +
    '.quests-list .done{opacity:.6;text-decoration:line-through;}' +
    '.quests-streak{margin:10px 0 0;font-size:.95rem;}';

  function mountUi(win, core) {
    var doc = win.document, T = core.text;
    var style = doc.createElement('style');
    style.textContent = UI_CSS;
    (doc.head || doc.documentElement).appendChild(style);

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    core.renderLobby = function (box, cards) {
      if (!box) return;
      var state = core.state();
      box.innerHTML = '';
      box.appendChild(el('p', 'quests-title', T.title));
      var list = el('ul', 'quests-list');
      state.list.forEach(function (q) {
        var li = el('li');
        li.appendChild(el('span', '', q.done ? '✅' : '⬜'));
        var text = T.quest(q);
        var href = q.done ? null : linkFor(q, cards || []);
        if (href) {
          var a = el('a', '', text);
          a.href = href;
          li.appendChild(a);
        } else {
          li.appendChild(el('span', q.done ? 'done' : '', text));
        }
        list.appendChild(li);
      });
      box.appendChild(list);
      box.appendChild(el('p', 'quests-streak', T.streak(core.streak())));
      box.hidden = !state.list.length;
    };
    return core;
  }

  var exported = { create: create, read: read, streakOf: streakOf, parentLine: parentLine, TEXT: TEXT, ORDER: ORDER,
    ALL_COINS: ALL_COINS, MILESTONES: MILESTONES, KEY: KEY, linkFor: linkFor };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies and games get pick/check for their grade; the parent page (no data-grade) gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && TEXT[grade]) {
      var SH = root.StudyHistory;
      api = mountUi(root, create(root.Learner ? root.Learner.storage : root.localStorage, Date.now, grade, {
        history: function () { return SH && SH.list ? SH.list() : []; },
        due: function () { return root.Recall && root.Recall.dueByApp ? root.Recall.dueByApp() : {}; },
        weak: function (entries) { return SH && SH.weakSpots ? SH.weakSpots(entries, 20) : []; },
        paused: function () { return !!(root.Clock && root.Clock.paused()); },
        bonus: function (coins) {
          var W = root.Wallet;
          if (!W || !W.addBonus || !W.addBonus(coins)) return false;
          if (W.renderCoins) W.renderCoins();
          return true;
        },
        news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }
      }));
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Quests = api;
  } catch (e) {}
})(this);
