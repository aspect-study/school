/* The guide: one next step for her, on the lobby map and on each game's home. The pages are decoded as UTF-8, so the
   text can hold emoji. next() picks the step from what the other engines already keep: the weekly boss, due review,
   today's quests, medals (mastery_v1) and the game she played last. Nothing is locked; the guide only suggests. */
(function (root) {
  'use strict';

  function englishOnly(grade) { return grade === 'grade2' && !!root.Lang && !root.Lang.both(); }

  // The same buddies as world.js (a test keeps them equal), so a game shows her buddy without loading the map.
  var AVATARS = { girl: '👧', boy: '👦', cat: '🐱', dog: '🐶', bear: '🐻', rabbit: '🐰', owl: '🦉', robot: '🤖' };
  var DEFAULT_AVATAR = 'cat';

  function questionsEn(n) { return n + (n === 1 ? ' review question' : ' review questions'); }
  function waitingEn(n) { return questionsEn(n) + (n === 1 ? ' is' : ' are') + ' waiting'; }
  var TEXT = {
    grade5: {
      boss: function (name) { return '⚔️ The boss is waiting in ' + name + '!'; },
      bossHere: '⚔️ The boss is waiting here! Clear this stage.',
      review: function (name, n) { return '🔁 ' + name + ' has ' + questionsEn(n) + ' waiting'; },
      reviewHere: function (n) { return '🔁 ' + waitingEn(n); },
      practice: function (name, lesson) { return '🎯 Today\'s quest: practice ' + lesson + ' in ' + name; },
      practiceHere: function (lesson) { return '🎯 Today\'s quest: practice ' + lesson; },
      explore: function (name) { return '🎯 Today\'s quest: play ' + name; },
      lesson: function (name, lesson) { return '📘 Next stop: ' + lesson + ' in ' + name; },
      lessonHere: function (lesson) { return '📘 Next stop: ' + lesson; },
      visit: function (name) { return '🧭 Visit ' + name + ' for the first time'; },
      mock: '🏆 Every lesson has a medal! Try the Mock Exam for 3 stars',
      home: '🏠 This game is all Bronze! Go back to the map for your next stop',
      done: '🎉 All done today! Great work!',
      doneShop: '🎉 All done today! You can buy a reward in the shop',
      go: 'Go ▶'
    },
    grade2: {
      boss: function (name) { return '⚔️ Naghihintay ang boss sa ' + name + '! · The boss is waiting in ' + name + '!'; },
      bossHere: '⚔️ Naghihintay ang boss dito! · The boss is waiting here! Clear this stage.',
      review: function (name, n) { return '🔁 May ' + n + ' tanong na babalikan sa ' + name + ' · ' + name + ' has ' + questionsEn(n) + ' waiting'; },
      reviewHere: function (n) { return '🔁 May ' + n + ' tanong na babalikan · ' + waitingEn(n); },
      practice: function (name, lesson) { return '🎯 Quest ngayon: sanayin ang ' + lesson + ' sa ' + name + ' · Today\'s quest: practice ' + lesson + ' in ' + name; },
      practiceHere: function (lesson) { return '🎯 Quest ngayon: sanayin ang ' + lesson + ' · Today\'s quest: practice ' + lesson; },
      explore: function (name) { return '🎯 Quest ngayon: laruin ang ' + name + ' · Today\'s quest: play ' + name; },
      lesson: function (name, lesson) { return '📘 Susunod: ' + lesson + ' sa ' + name + ' · Next stop: ' + lesson + ' in ' + name; },
      lessonHere: function (lesson) { return '📘 Susunod: ' + lesson + ' · Next stop: ' + lesson; },
      visit: function (name) { return '🧭 Bisitahin ang ' + name + ' sa unang pagkakataon · Visit ' + name + ' for the first time'; },
      mock: '🏆 May medalya na ang bawat aralin! Subukan ang Mock Exam para sa 3 bituin · Every lesson has a medal! Try the Mock Exam for 3 stars',
      home: '🏠 Bronze na ang lahat ng aralin dito! Bumalik sa mapa para sa susunod mong pupuntahan · This game is all Bronze! Go back to the map for your next stop',
      done: '🎉 Tapos na ang lahat ngayon! Ang galing mo! · All done today! Great work!',
      doneShop: '🎉 Tapos na ang lahat ngayon! May mabibili ka sa tindahan · All done today! You can buy a reward in the shop',
      go: 'Go ▶'
    }
  };

  function wordsFor(grade) { return englishOnly(grade) ? TEXT.grade5 : TEXT[grade] || TEXT.grade5; }

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function list(v) { return Array.isArray(v) ? v.filter(isObj) : []; }
  function count(v) { v = Math.floor(Number(v)); return v > 0 ? v : 0; }
  function level(v) { v = Math.floor(Number(v)); return v >= 1 && v <= 3 ? v : 0; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fold(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  // A game's lessons in mastery_v1 order: [{ id, title, best }].
  function lessonsOf(entry) {
    if (!isObj(entry) || !isObj(entry.lessons)) return [];
    var order = Array.isArray(entry.order) ? entry.order : Object.keys(entry.lessons);
    return order.filter(function (id, i) {
      return typeof id === 'string' && order.indexOf(id) === i && has(entry.lessons, id) && isObj(entry.lessons[id]);
    }).map(function (id) {
      var l = entry.lessons[id];
      return { id: id, title: typeof l.title === 'string' && l.title ? l.title : id, best: level(l.best) };
    });
  }

  function firstOpen(entry) {
    var open = lessonsOf(entry).filter(function (l) { return l.best < 1; });
    return open.length ? open[0] : null;
  }

  // A practice quest names its lesson by title; this finds the lesson's id.
  function findLesson(entry, title) {
    var want = fold(title), hit = lessonsOf(entry).filter(function (l) { return fold(l.title) === want; });
    return hit.length ? hit[0].id : null;
  }

  function recentApp(entries, apps) {
    var best = null;
    list(entries).forEach(function (e) {
      if (apps.indexOf(e.app) < 0 || typeof e.t !== 'number') return;
      if (!best || e.t > best.t) best = e;
    });
    return best ? best.app : null;
  }

  function todayQuests(state, nowMs) {
    return isObj(state) && state.day === dayKey(nowMs) ? list(state.list) : [];
  }

  function step(kind, app, text, extra) {
    var s = { kind: kind, app: app, text: text };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  }

  // o: { cards: [{ app, name }] in lobby order, app (a game's own id; left out on the lobby), stages, due, quests,
  // mastery (mastery_v1 apps), recent, finalStars (a game's Mock Exam stars), canAfford }. Always returns one step.
  function next(o, grade) {
    var T = wordsFor(grade);
    o = isObj(o) ? o : {};
    var here = typeof o.app === 'string' && o.app ? o.app : null, names = {}, apps = [], i;
    list(o.cards).forEach(function (c) {
      if (typeof c.app !== 'string' || has(names, c.app) || (here && c.app !== here)) return;
      names[c.app] = typeof c.name === 'string' && c.name ? c.name : c.app;
      apps.push(c.app);
    });
    if (here && !has(names, here)) { names[here] = here; apps.push(here); }
    var due = isObj(o.due) ? o.due : {}, mastery = isObj(o.mastery) ? o.mastery : {};

    var stages = list(o.stages);
    for (i = 0; i < stages.length; i++) {
      var st = stages[i];
      if (st.cleared !== true && has(names, st.app)) return step('boss', st.app, here ? T.bossHere : T.boss(names[st.app]));
    }

    var most = null;
    apps.forEach(function (a) {
      var n = count(due[a]);
      if (n > 0 && (!most || n > most.count)) most = { app: a, count: n };
    });
    if (most) return step('review', most.app, here ? T.reviewHere(most.count) : T.review(names[most.app], most.count), { count: most.count });

    // A review quest is left to the due-review step above: with nothing due there is nothing to review.
    var quests = list(o.quests);
    for (i = 0; i < quests.length; i++) {
      var q = quests[i];
      if (q.done === true || !has(names, q.app)) continue;
      if (q.kind === 'practice' && typeof q.lesson === 'string' && q.lesson) {
        return step('quest', q.app, here ? T.practiceHere(q.lesson) : T.practice(names[q.app], q.lesson),
          { lesson: findLesson(mastery[q.app], q.lesson), title: q.lesson });
      }
      if (q.kind === 'explore' && !here) return step('quest', q.app, T.explore(names[q.app]));
    }

    var order = apps;
    if (!here && typeof o.recent === 'string' && has(names, o.recent)) {
      order = [o.recent].concat(apps.filter(function (a) { return a !== o.recent; }));
    }
    for (i = 0; i < order.length; i++) {
      var l = firstOpen(mastery[order[i]]);
      if (l) return step('lesson', order[i], here ? T.lessonHere(l.title) : T.lesson(names[order[i]], l.title), { lesson: l.id, title: l.title });
    }

    if (here) return count(o.finalStars) < 3 ? step('mock', here, T.mock) : step('home', here, T.home);

    for (i = 0; i < apps.length; i++) {
      if (!lessonsOf(mastery[apps[i]]).length) return step('visit', apps[i], T.visit(names[apps[i]]));
    }
    return o.canAfford === true ? step('done', null, T.doneShop, { shop: true }) : step('done', null, T.done);
  }

  function withParam(href, param) { return href + (href.indexOf('?') >= 0 ? '&' : '?') + param; }

  // Where Go takes her from the lobby: the step's game with ?boss=1, ?review=1 or ?lesson=<id>; null when it leads nowhere.
  function link(s, cards) {
    if (!isObj(s) || !s.app) return null;
    var card = list(cards).filter(function (c) { return c.app === s.app && typeof c.href === 'string' && c.href; })[0];
    if (!card) return null;
    if (s.kind === 'boss') return withParam(card.href, 'boss=1');
    if (s.kind === 'review') return withParam(card.href, 'review=1');
    if (typeof s.lesson === 'string' && s.lesson) return withParam(card.href, 'lesson=' + encodeURIComponent(s.lesson));
    return card.href;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function avatarOf(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem('world_v1')); } catch (e) {}
    var id = isObj(d) && typeof d.avatar === 'string' && has(AVATARS, d.avatar) ? d.avatar : DEFAULT_AVATAR;
    return AVATARS[id];
  }

  function bubble(s, avatar, grade, go) {
    var T = wordsFor(grade);
    return '<div class="g-guide" role="status"><span class="g-buddy" aria-hidden="true">' + esc(avatar) + '</span>' +
      '<p class="g-text">' + esc(s.text) + '</p>' + (go ? '<button type="button" class="g-go">' + esc(T.go) + '</button>' : '') + '</div>';
  }

  var CSS =
    '.g-guide{display:flex;align-items:center;gap:12px;max-width:720px;margin:0 auto 14px;padding:12px 14px;box-sizing:border-box;' +
      'border-radius:18px;background:var(--card,#fff);color:var(--ink,#1d1d1f);border:2px solid var(--header-accent,var(--accent,#2E6F9E));}' +
    '.g-buddy{flex:none;font-size:2rem;line-height:1;}' +
    '.g-text{flex:1;min-width:0;margin:0;font-weight:800;line-height:1.35;}' +
    '.g-go{flex:none;min-height:44px;padding:8px 16px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;' +
      'color:#fff;background:var(--header-accent,var(--accent,#2E6F9E));}' +
    '.g-go:focus-visible{outline:3px solid var(--ink,#1d1d1f);outline-offset:2px;}' +
    '@media print{.g-guide{display:none !important;}}';

  var exported = { next: next, link: link, bubble: bubble, avatarOf: avatarOf, lessonsOf: lessonsOf, firstOpen: firstOpen,
    findLesson: findLesson, recentApp: recentApp, todayQuests: todayQuests, dayKey: dayKey, TEXT: TEXT, AVATARS: AVATARS,
    DEFAULT_AVATAR: DEFAULT_AVATAR, CSS: CSS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies and games get step/html/addStyle for their grade; a page without data-grade gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && TEXT[grade]) {
      var storage = root.Learner ? root.Learner.storage : root.localStorage;
      var safe = function (fn, fallback) {
        try { var v = fn(); return v === undefined || v === null ? fallback : v; } catch (e) { return fallback; }
      };
      // cards: [{ app, name, href }]; opts: { app (inside a game), finalStars, canAfford }.
      api.step = function (cards, opts) {
        opts = opts || {};
        var apps = list(cards).map(function (c) { return c.app; });
        return next({
          cards: cards,
          app: opts.app,
          stages: safe(function () { return root.Boss.current().stages; }, []),
          due: safe(function () { return root.Recall.dueByApp(); }, {}),
          quests: safe(function () { return todayQuests(root.Quests.state(), Date.now()); }, []),
          mastery: safe(function () { return root.Mastery.summary().apps; }, {}),
          recent: safe(function () { return recentApp(root.StudyHistory.list(), apps); }, null),
          finalStars: opts.finalStars,
          canAfford: opts.canAfford
        }, grade);
      };
      api.html = function (s, go) { return bubble(s, avatarOf(storage), grade, go); };
      api.addStyle = function (doc) {
        if (doc.getElementById('guide-style')) return;
        var style = doc.createElement('style');
        style.id = 'guide-style';
        style.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(style);
      };
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Guide = api;
  } catch (e) {}
})(this);
