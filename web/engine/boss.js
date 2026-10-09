/* Loaded by both lobbies and every game after quests.js, and by the parent page. The pages are decoded as UTF-8, so the text can hold emoji.
   Once a week the lobby picks a boss: the games where review is most needed. Each stage is a short review round
   played inside that game; 2 of 3 right clears it. Every stage cleared pays 10 coins, at least half by the end of
   the week pays 4. */
(function (root) {
  'use strict';

  var KEY = 'boss_v1';
  var MISSED_KEY = 'boss_missed_v1';
  var STAGES = { grade5: 4, grade2: 3 };
  var STAGE_SIZE = 3;
  var MIN_STAGES = 2;
  var MIN_BOXES = 3;
  var FULL_COINS = 10;
  var HALF_COINS = 4;
  var KEEP_PAID = 60;

  function coinsEn(c) { return '+' + c + ' coins'; }
  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  var TEXT = {
    grade5: {
      stageTitle: '🐉 Boss stage',
      cardTitle: '🐉 Weekly Boss — until Sunday',
      hp: function (c, n) { return c + ' of ' + n + ' stages cleared'; },
      beaten: '🐉 Boss beaten! New boss on Monday',
      none: '🐉 The boss comes when you\'ve played a few games',
      hitTitle: function (t) { return 'Boss hit! ' + t + ' stage cleared'; },
      hitNext: function (t) { return t ? 'Next stage: ' + t : 'The boss is down!'; },
      missTitle: 'Almost! Try the boss stage again',
      missLine: function (r, n, need) { return r + ' of ' + n + ' right · you need ' + need; },
      missNext: 'Tap Try Again when you\'re ready',
      beatTitle: 'You beat the Weekly Boss!',
      beatNext: 'New boss on Monday',
      halfTitle: function (c, n) { return 'Last week\'s boss: ' + c + ' of ' + n + ' stages'; },
      halfNext: 'A new boss is here!',
      coins: coinsEn
    },
    grade2: {
      stageTitle: '🐉 Laban sa Boss · Fight the boss',
      cardTitle: '🐉 Boss ngayong linggo · Weekly Boss — until Sunday',
      hp: function (c, n) { return c + ' sa ' + n + ' stage ang tapos · ' + c + ' of ' + n + ' stages cleared'; },
      beaten: '🐉 Natalo mo na ang Boss! · Boss beaten! A new boss comes on Monday',
      none: '🐉 Darating ang boss kapag nakapaglaro ka na · The boss comes when you\'ve played a few games',
      hitTitle: function (t) { return 'Tinamaan mo ang Boss! · Boss hit! The ' + t + ' stage is cleared'; },
      hitNext: function (t) { return t ? 'Susunod: ' + t + ' · Next stage: ' + t : 'Talo na ang Boss! · The boss is down!'; },
      missTitle: 'Muntik na! · Almost! Try the boss stage again',
      missLine: function (r, n, need) { return r + ' sa ' + n + ' ang tama · ' + r + ' of ' + n + ' right · kailangan ' + need + ' · you need ' + need; },
      missNext: 'Pindutin ang Try Again · Tap Try Again when you\'re ready',
      beatTitle: 'Natalo mo ang Boss! · You beat the Weekly Boss!',
      beatNext: 'Bagong boss sa Lunes · A new boss comes on Monday',
      halfTitle: function (c, n) { return 'Boss noong nakaraang linggo: ' + c + ' sa ' + n + ' · Last week\'s boss: ' + c + ' of ' + n + ' stages'; },
      halfNext: 'May bagong boss! · A new boss is here!',
      coins: coinsEn
    }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function weekKey(ms) {
    var d = new Date(ms);
    return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7));
  }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function strings(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; }
  function clearedCount(stages) { return stages.filter(function (s) { return s.cleared; }).length; }

  // The day she last missed a stage (synced, so Jesus can comfort her in the 3D world); '' when never or unreadable.
  function missedDay(storage) {
    try {
      var d = JSON.parse(storage.getItem(MISSED_KEY));
      return isObj(d) && typeof d.day === 'string' ? d.day : '';
    } catch (e) { return ''; }
  }

  function read(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    var ok = isObj(d) && d.v === 1;
    return {
      v: 1,
      week: ok && typeof d.week === 'string' ? d.week : '',
      stages: ok && Array.isArray(d.stages) ? d.stages.filter(function (s) { return isObj(s) && typeof s.app === 'string'; })
        .map(function (s) { return { app: s.app, title: typeof s.title === 'string' ? s.title : s.app, cleared: s.cleared === true }; }) : [],
      paid: ok ? strings(d.paid) : []
    };
  }

  // The lobby cards whose game has at least 3 review boxes (or 1 skill box, for Math), most due first, then most
  // boxes in 1-2, then at random.
  function rank(cards, items, due, random) {
    var stats = {};
    Object.keys(items || {}).forEach(function (k) {
      var it = items[k], cut = k.indexOf('|');
      if (cut < 1 || !isObj(it) || it.gone || !(it.box >= 1 && it.box <= 5) || Math.floor(it.box) !== it.box) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(it.due) || typeof it.t !== 'number') return;
      var app = k.slice(0, cut), s = stats[app] || (stats[app] = { n: 0, skills: 0, weak: 0 });
      s.n++;
      if (k.indexOf('|skill:') === cut) s.skills++;
      if (it.box <= 2) s.weak++;
    });
    return cards.filter(function (c) { var s = stats[c.app]; return s && (s.n >= MIN_BOXES || s.skills >= 1); })
      .map(function (c) { return { card: c, due: (due && due[c.app]) || 0, weak: stats[c.app].weak, r: random() }; })
      .sort(function (a, b) { return b.due - a.due || b.weak - a.weak || a.r - b.r; })
      .map(function (x) { return x.card; });
  }

  function linkFor(app, cards) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].app === app) return cards[i].href + (cards[i].href.indexOf('?') >= 0 ? '&' : '?') + 'boss=1';
    }
    return null;
  }

  function parentLine(state, nowMs) {
    if (state.week !== weekKey(nowMs) || !state.stages.length) return '🐉 Weekly boss: not started';
    var c = clearedCount(state.stages), n = state.stages.length;
    return c === n ? '🐉 Weekly boss: beaten' : '🐉 Weekly boss: ' + c + ' of ' + n + ' stages';
  }

  // What the army shows when a stage ends: 'none' (not a stage now), 'miss', 'hit' (cleared, others left) or 'down'
  // (every stage cleared).
  function outcome(events, state) {
    if (!events.length) return 'none';
    if (events.some(function (e) { return e.boss === 'miss'; })) return 'miss';
    var stages = state && Array.isArray(state.stages) ? state.stages : [];
    return stages.length && clearedCount(stages) === stages.length ? 'down' : 'hit';
  }

  // deps: { items() -> review_v1 items, due() -> { app: count }, bonus(coins) -> true when paid, random?() }
  function create(storage, now, grade, deps) {
    if (!Object.prototype.hasOwnProperty.call(STAGES, grade || '')) throw new Error('Boss needs a grade like "grade5".');
    var T = grade === 'grade2' ? L(TEXT[grade]) : TEXT[grade], random = deps.random || Math.random;
    var news = deps.news || function () {};
    if (grade === 'grade2' && root.Lang && !root.Lang.both()) T.missLine = TEXT.grade5.missLine;

    function save(state) { try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
    function paidFor(state, week) { return state.paid.some(function (p) { return p.indexOf(week + '|') === 0; }); }

    // Mark and save first, then pay: a failed save never leaves coins without a mark, a failed payment leaves no mark.
    function pay(state, mark, coins) {
      state.paid = state.paid.concat([mark]).slice(-KEEP_PAID);
      function unmark() { state.paid = state.paid.filter(function (p) { return p !== mark; }); }
      if (!save(state)) { unmark(); return false; }
      if (deps.bonus(coins)) return true;
      unmark();
      save(state);
      return false;
    }

    // Whichever device or sync cleared the last stage, the whole boss is paid once.
    function payFull(state, next) {
      var n = state.stages.length;
      if (!n || clearedCount(state.stages) < n || paidFor(state, state.week)) return [];
      if (!pay(state, state.week + '|full', FULL_COINS)) return [];
      return [{ big: true, icon: '🐉', title: T.beatTitle, line: T.coins(FULL_COINS), next: next || T.beatNext, boss: 'beat', week: state.week }];
    }

    function current() {
      var state = read(storage);
      return state.week === weekKey(now()) ? state : { v: 1, week: weekKey(now()), stages: [], paid: state.paid };
    }

    function ensure(cards) {
      var state = read(storage), before = JSON.stringify(state), week = weekKey(now()), events = [];
      if (state.week > week) return [];
      if (state.week && state.week < week) {
        var n = state.stages.length, c = clearedCount(state.stages);
        if (n && !paidFor(state, state.week)) {
          if (c === n) events = payFull(state, T.halfNext);
          else if (c >= Math.ceil(n / 2) && pay(state, state.week + '|half', HALF_COINS)) {
            events.push({ big: false, icon: '🐉', title: T.halfTitle(c, n), line: T.coins(HALF_COINS), next: T.halfNext, boss: 'half', week: state.week });
          }
          if ((c === n || c >= Math.ceil(n / 2)) && !events.length) return [];
        }
        state.week = '';
        state.stages = [];
      }
      if (state.week === week && state.stages.length) return payFull(state);
      var picked = rank(cards || [], deps.items() || {}, deps.due() || {}, random).slice(0, STAGES[grade]);
      state.week = week;
      state.stages = picked.length >= MIN_STAGES ? picked.map(function (p) { return { app: p.app, title: p.title, cleared: false }; }) : [];
      if (JSON.stringify(state) !== before) save(state);
      return events;
    }

    function stageResult(app, right, total) {
      var state = read(storage);
      if (state.week !== weekKey(now()) || !total) return [];
      var stage = state.stages.filter(function (s) { return s.app === app; })[0];
      if (!stage || stage.cleared) return [];
      var need = Math.ceil(total * 2 / 3);
      if (right < need) {
        try { storage.setItem(MISSED_KEY, JSON.stringify({ v: 1, day: dayKey(new Date(now())) })); } catch (e) {}
        return [{ big: false, icon: '⚔️', title: T.missTitle, line: T.missLine(right, total, need), next: T.missNext, boss: 'miss', week: state.week }];
      }
      stage.cleared = true;
      if (!save(state)) return [];
      news('boss', { app: app, title: stage.title });
      var open = state.stages.filter(function (s) { return !s.cleared; });
      var hit = { big: false, icon: '⚔️', title: T.hitTitle(stage.title), line: T.hp(clearedCount(state.stages), state.stages.length),
        next: T.hitNext(open.length ? open[0].title : null), boss: 'hit', week: state.week };
      return payFull(state).concat([hit]);
    }

    return {
      text: T,
      grade: grade,
      STAGE_SIZE: STAGE_SIZE,
      ensure: ensure,
      stageResult: stageResult,
      current: current,
      isStage: function (app) { return current().stages.some(function (s) { return s.app === app && !s.cleared; }); }
    };
  }

  var UI_CSS =
    '.boss{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#F3ECFF;color:#3B2363;font-weight:800;}' +
    '.boss[hidden]{display:none;}' +
    '.boss-title{margin:0 0 8px;}' +
    '.boss-hp{height:12px;margin:0 0 4px;border-radius:999px;background:#E0D4F7;overflow:hidden;}' +
    '.boss-hp span{display:block;height:100%;background:#7C4DDB;}' +
    '.boss-count{margin:0 0 8px;font-size:.9rem;}' +
    '.boss-list{margin:0;padding:0;list-style:none;display:grid;gap:6px;}' +
    '.boss-list li{display:flex;gap:8px;align-items:center;font-size:.95rem;}' +
    '.boss-list a{color:inherit;text-decoration:underline;text-underline-offset:3px;}' +
    '.boss-list a:focus-visible{outline:3px solid #3B2363;outline-offset:2px;border-radius:6px;}' +
    '.boss-list .done{opacity:.6;}';

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
      var stages = core.current().stages, n = stages.length, c = clearedCount(stages);
      box.innerHTML = '';
      box.hidden = false;
      box.appendChild(el('p', 'boss-title', !n ? T.none : c === n ? T.beaten : T.cardTitle));
      if (!n) return;
      var bar = el('div', 'boss-hp'), fill = el('span');
      fill.style.width = Math.round((n - c) / n * 100) + '%';
      bar.setAttribute('aria-hidden', 'true');
      bar.appendChild(fill);
      box.appendChild(bar);
      box.appendChild(el('p', 'boss-count', T.hp(c, n)));
      var list = el('ul', 'boss-list');
      stages.forEach(function (s) {
        var li = el('li'), href = s.cleared ? null : linkFor(s.app, cards || []);
        li.appendChild(el('span', '', s.cleared ? '✅' : '⚔️'));
        if (href) {
          var a = el('a', '', s.title);
          a.href = href;
          li.appendChild(a);
        } else {
          li.appendChild(el('span', s.cleared ? 'done' : '', s.title));
        }
        list.appendChild(li);
      });
      box.appendChild(list);
    };
    // The boss's face and name on hit, beat and half popups (bosses.js), and the army's end-of-stage show (army.js).
    function faces(events) {
      var B = win.Bosses;
      if (!B) return events;
      events.forEach(function (e) {
        if (!e.week || !(e.boss === 'hit' || e.boss === 'beat' || e.boss === 'half')) return;
        var b = B.ofWeek(e.week);
        e.art = B.svg(b, e.boss === 'hit' ? 'ouch' : 'dizzy');
        e.who = B.name(b, core.grade);
      });
      return events;
    }
    var plainResult = core.stageResult, plainEnsure = core.ensure;
    core.stageResult = function (app, right, total) {
      var events = plainResult(app, right, total), state = core.current();
      try {
        if (win.Army && win.Army.end) {
          win.Army.end(outcome(events, state), state.stages.filter(function (s) { return !s.cleared; }).length);
        }
      } catch (e) {}
      try { return faces(events); } catch (e) { return events; }
    };
    core.ensure = function (cards) {
      var events = plainEnsure(cards);
      try { return faces(events); } catch (e) { return events; }
    };
    return core;
  }

  var exported = { create: create, read: read, rank: rank, weekKey: weekKey, linkFor: linkFor, parentLine: parentLine,
    missedDay: missedDay, outcome: outcome, MISSED_KEY: MISSED_KEY,
    TEXT: TEXT, KEY: KEY, STAGES: STAGES, STAGE_SIZE: STAGE_SIZE, FULL_COINS: FULL_COINS, HALF_COINS: HALF_COINS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies and games get the boss for their grade; the parent page (no data-grade) gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && STAGES[grade]) {
      var storage = root.Learner ? root.Learner.storage : root.localStorage;
      api = mountUi(root, create(storage, Date.now, grade, {
        items: function () {
          try { var d = JSON.parse(storage.getItem('review_v1')); return d && isObj(d.items) ? d.items : {}; } catch (e) { return {}; }
        },
        due: function () { return root.Recall && root.Recall.dueByApp ? root.Recall.dueByApp() : {}; },
        bonus: function (coins) {
          var W = root.Wallet;
          if (!W || !W.addBonus || !W.addBonus(coins)) return false;
          if (W.renderCoins) W.renderCoins();
          return true;
        },
        news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }
      }));
      api.wantsBoss = /(^|[?&])boss=1(&|$)/.test(root.location ? root.location.search : '');
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Boss = api;
  } catch (e) {}
})(this);
