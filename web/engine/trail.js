/* The lesson path on every game's home: each lesson is a stop down a zigzag with its medal, her buddy stands at the
   first lesson without Bronze, and the guide's bubble on top says what to do next. Nothing is locked. A game calls
   Trail.start({ app, title, list, lessons, review, final, finalStars }) right after Search.start: list is the id of the
   element holding the home cards (lesson cards carry data-search-lesson="<index>"), lessons is medalLessons(), review
   is startReview, final is startFinalExam and finalStars() the Mock Exam's best stars. */
(function (root) {
  'use strict';

  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  function forGrade(grade, table) { return grade === 'grade2' ? L(table) : table; }

  var KEY = 'trail_v1';
  var ROW = 104, TOP = 56, SIDE = 0.17, CARD_GAP = 46;
  var XS = [0.5, 0.25, 0.5, 0.75];
  var MEDALS = ['', '🥉', '🥈', '🥇'];
  var TEXT = {
    grade5: {
      path: '🗺️ Path', list: '📋 List', open: 'Open ▶', label: 'Lesson path', next: 'next stop', polish: 'needs a polish',
      tiers: ['', 'bronze', 'silver', 'gold'],
      stop: function (n, title) { return 'Lesson ' + n + ': ' + title; }
    },
    // The medal words are the Medals screen's (mastery.js).
    grade2: {
      path: '🗺️ Path', list: '📋 List', open: 'Open ▶', label: 'Daan ng mga aralin · Lesson path',
      next: 'susunod · next stop', polish: 'kailangang balikan · needs a polish',
      tiers: ['', 'tanso · bronze', 'pilak · silver', 'ginto · gold'],
      stop: function (n, title) { return 'Aralin ' + n + ' · Lesson ' + n + ': ' + title; }
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function level(v) { v = Math.floor(Number(v)); return v >= 1 && v <= 3 ? v : 0; }
  function pct(x) { return Math.round(x * 1000) / 10; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function readView(storage) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    return isObj(d) && d.v === 1 && d.view === 'list' ? 'list' : 'path';
  }

  function saveView(storage, now, view) {
    try {
      storage.setItem(KEY, JSON.stringify({ v: 1, view: view === 'list' ? 'list' : 'path', t: now() }));
      return true;
    } catch (e) { return false; }
  }

  // Stop centers: x as a fraction of the width, y in px from the top.
  function layout(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push({ x: n === 1 ? 0.5 : XS[i % XS.length], y: TOP + i * ROW });
    return out;
  }
  function height(n) { return n > 0 ? 2 * TOP + (n - 1) * ROW : 0; }
  function buddySpot(p) { return { x: p.x > 0.5 ? p.x - SIDE : p.x + SIDE, y: p.y }; }

  function lessonParam(search) {
    var m = /(?:^|[?&])lesson=([^&]*)/.exec(search || '');
    if (!m) return null;
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return null; }
  }

  function indexOfId(lessons, id) {
    if (typeof id !== 'string') return -1;
    for (var i = 0; i < lessons.length; i++) if (isObj(lessons[i]) && lessons[i].id === id) return i;
    return -1;
  }

  // Each lesson's medal from the game's mastery_v1 entry.
  function medals(lessons, entry) {
    var saved = isObj(entry) && isObj(entry.lessons) ? entry.lessons : {};
    return lessons.map(function (l) {
      var m = isObj(l) && has(saved, l.id) && isObj(saved[l.id]) ? saved[l.id] : {};
      var best = level(m.best);
      return { best: best, polish: best > 0 && level(m.now) < best };
    });
  }

  function nextStop(ms) {
    for (var i = 0; i < ms.length; i++) if (ms[i].best < 1) return i;
    return -1;
  }

  function titleOf(l) { return typeof l.title === 'string' && l.title ? l.title : String(l.id); }
  // Grade 2 lessons keep SVG markup as their icon; those stops show the lesson number instead, with no number badge.
  function iconOf(l, n) {
    var s = typeof l.icon === 'string' ? l.icon.trim() : '';
    return s && s.indexOf('<') < 0 && s.length <= 8 ? s : String(n);
  }
  function sticker(m) { return m.best ? MEDALS[m.best] + (m.polish ? '🔧' : '') : ''; }

  function pathHtml(lessons, ms, next, avatar, T) {
    var pts = layout(lessons.length), h = height(lessons.length);
    var line = pts.map(function (p) { return pct(p.x) + ',' + p.y; }).join(' ');
    var s = '<div class="t-map" style="height:' + h + 'px">' +
      '<svg class="t-line" viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + line + '"/></svg>';
    lessons.forEach(function (l, i) {
      var m = ms[i], n = i + 1, icon = iconOf(l, n);
      var label = T.stop(n, titleOf(l)) + (m.best ? ', ' + T.tiers[m.best] : '') + (m.polish ? ', ' + T.polish : '') + (i === next ? ', ' + T.next : '');
      s += '<button type="button" class="t-stop t-tier-' + m.best + (i === next ? ' t-next' : '') + '" data-stop="' + i +
        '" style="left:' + pct(pts[i].x) + '%;top:' + pts[i].y + 'px" aria-label="' + esc(label) + '">' +
        '<span class="t-icon" aria-hidden="true">' + esc(icon) + '</span>' +
        (icon === String(n) ? '' : '<span class="t-num" aria-hidden="true">' + n + '</span>') +
        (m.best ? '<span class="t-medal" aria-hidden="true">' + sticker(m) + '</span>' : '') + '</button>';
    });
    if (lessons.length) {
      var b = buddySpot(pts[next >= 0 ? next : lessons.length - 1]);
      s += '<span class="t-buddy" aria-hidden="true" style="left:' + pct(b.x) + '%;top:' + b.y + 'px">' + esc(avatar) + '</span>';
    }
    return s + '</div>';
  }

  // The name card under a tapped stop (above it for the last stop, so it stays on the path).
  function cardHtml(lessons, ms, i, T) {
    var pts = layout(lessons.length), p = pts[i], l = lessons[i];
    if (!p || !isObj(l)) return '';
    var up = i === lessons.length - 1 && lessons.length > 1, x = Math.min(0.78, Math.max(0.22, p.x));
    return '<div class="t-card' + (up ? ' t-card-up' : '') + '" role="dialog" aria-label="' + esc(T.stop(i + 1, titleOf(l))) +
      '" style="left:' + pct(x) + '%;top:' + (up ? p.y - CARD_GAP : p.y + CARD_GAP) + 'px">' +
      '<p class="t-card-title">' + esc((i + 1) + ' · ' + titleOf(l)) + (ms[i] && ms[i].best ? ' ' + sticker(ms[i]) : '') + '</p>' +
      '<button type="button" class="t-open" data-open="' + i + '">' + esc(T.open) + '</button></div>';
  }

  // Same address as the 🏠 button in nav.js.
  function lobbyUrl(grade) { return '../../../lobby/grade-' + (grade === 'grade2' ? '2' : '5') + '.html'; }

  var UI_CSS =
    '[data-trail-hidden]{display:none !important;}' +
    '.trail-path[hidden],.trail-toggle[hidden]{display:none !important;}' +
    '.trail-top{display:flex;flex-direction:column;max-width:720px;margin:0 auto;}' +
    '.trail-toggle{align-self:flex-end;margin:0 0 12px;min-height:44px;padding:8px 18px;border-radius:999px;font:inherit;font-weight:800;' +
      'cursor:pointer;color:var(--ink,#1d1d1f);background:var(--card,#fff);border:1.5px solid rgba(127,127,127,.45);}' +
    '.trail-path{max-width:560px;margin:8px auto 24px;}' +
    '.t-map{position:relative;}' +
    '.t-line{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}' +
    '.t-line polyline{fill:none;stroke:rgba(127,127,127,.55);stroke-width:4;stroke-dasharray:2 12;stroke-linecap:round;vector-effect:non-scaling-stroke;}' +
    '.t-stop{position:absolute;width:68px;height:68px;margin:-34px 0 0 -34px;padding:0;box-sizing:border-box;border-radius:50%;cursor:pointer;' +
      'font:inherit;color:var(--ink,#1d1d1f);background:var(--card,#fff);border:4px solid rgba(127,127,127,.45);}' +
    '.t-icon{font-size:1.9rem;line-height:1;}' +
    '.t-num{position:absolute;left:-6px;bottom:-6px;min-width:24px;height:24px;padding:0 4px;box-sizing:border-box;border-radius:12px;' +
      'font-size:.8rem;font-weight:800;line-height:24px;color:#fff;background:var(--ink,#1d1d1f);}' +
    '.t-medal{position:absolute;right:-10px;top:-10px;font-size:1.3rem;}' +
    '.t-tier-1{border-color:#C9772B;}.t-tier-2{border-color:#9AA4AE;}.t-tier-3{border-color:#E0A526;background:#FFF6DA;}' +
    '.t-next{width:84px;height:84px;margin:-42px 0 0 -42px;border-color:var(--header-accent,var(--accent,#2E6F9E));animation:t-pulse 1.6s ease-in-out infinite;}' +
    '@keyframes t-pulse{0%,100%{box-shadow:0 0 0 0 rgba(224,165,38,.55);}50%{box-shadow:0 0 0 12px rgba(224,165,38,0);}}' +
    '.t-stop:focus-visible{outline:4px solid var(--ink,#1d1d1f);outline-offset:3px;}' +
    '.t-buddy{position:absolute;font-size:2.2rem;line-height:1;transform:translate(-50%,-50%);pointer-events:none;}' +
    '.t-hop{transition:left .5s ease-in-out,top .5s ease-in-out;}' +
    '.t-card{position:absolute;z-index:2;width:min(280px,90%);padding:12px 14px;box-sizing:border-box;transform:translateX(-50%);' +
      'border-radius:16px;text-align:center;background:var(--card,#fff);color:var(--ink,#1d1d1f);' +
      'border:2px solid rgba(127,127,127,.45);box-shadow:0 6px 18px rgba(0,0,0,.18);}' +
    '.t-card-up{transform:translate(-50%,-100%);}' +
    '.t-card-title{margin:0 0 10px;font-weight:800;}' +
    '.t-open{min-height:44px;padding:8px 18px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;' +
      'color:#fff;background:var(--header-accent,var(--accent,#2E6F9E));}' +
    '@media (prefers-reduced-motion:reduce){.t-next{animation:none;box-shadow:0 0 0 6px rgba(224,165,38,.45);}.t-hop{transition:none;}}' +
    '@media print{.trail-top,.trail-path{display:none !important;}[data-trail-hidden]{display:revert !important;}}';

  function create(win, grade) {
    var doc = win.document, T = forGrade(grade, TEXT[grade] || TEXT.grade5);
    if (grade === 'grade2' && root.Lang && !root.Lang.both()) T.stop = TEXT.grade5.stop;
    var storage = win.Learner ? win.Learner.storage : win.localStorage;
    var o = null, list = null, slot = null, toggle = null, path = null, openCard = -1, style = null, top = null, watcher = null;
    // Read at load: StudyKit drops the whole query when the lobby link carries ?reset=1, before Trail.start runs.
    var wanted = lessonParam(win.location ? win.location.search : '');

    function now() { return Date.now(); }
    function reduced() {
      try { return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }
    function searching() { var S = win.Search; return !!(S && S.query && S.query().trim()); }
    function entry() { try { return win.Mastery.summary().apps[o.app]; } catch (e) { return null; } }
    function avatar() { var G = win.Guide; return G && G.avatarOf ? G.avatarOf(storage) : '🐱'; }
    function lessonCards() { return Array.prototype.filter.call(list.children, function (c) { return c.hasAttribute('data-search-lesson'); }); }

    // Opens a lesson the way a tap on its card does, so every game's own open code runs (cards may be hidden).
    function openAt(i) {
      var card = list.querySelector('[data-search-lesson="' + i + '"]');
      if (!card) return;
      var b = card.matches('button, [role="button"]') ? card : card.querySelector('button, [role="button"]');
      if (b) b.click();
    }

    function act(s) {
      if (s.kind === 'boss') return o.review(true);
      if (s.kind === 'review') return o.review();
      if (s.kind === 'mock') return o.final();
      if (s.kind === 'home') { win.location.href = lobbyUrl(grade); return; }
      var i = indexOfId(o.lessons, s.lesson);
      if (i >= 0) openAt(i);
    }

    function showGuide() {
      var G = win.Guide, s = null;
      if (G && G.step && G.html) {
        try { s = G.step([{ app: o.app, name: o.title }], { app: o.app, finalStars: o.finalStars() }); } catch (e) {}
      }
      if (!s) { slot.innerHTML = ''; return; }
      var go = (s.kind !== 'quest' && s.kind !== 'lesson') || indexOfId(o.lessons, s.lesson) >= 0;
      slot.innerHTML = G.html(s, go);
      var b = slot.querySelector('.g-go');
      if (b) b.addEventListener('click', function () { act(s); });
    }

    // Slides the buddy from the stop it stood at last time to the new one (a lesson just got its Bronze).
    function hop(at) {
      var key = 'trail_last_' + o.app, buddy = path.querySelector('.t-buddy'), n = o.lessons.length, last = null;
      try { last = win.sessionStorage.getItem(key); win.sessionStorage.setItem(key, String(at)); } catch (e) {}
      var from = last === null ? -1 : Number(last);
      if (!buddy || reduced() || !(from >= 0 && from < n) || from === at) return;
      var a = buddySpot(layout(n)[from]), left = buddy.style.left, top = buddy.style.top;
      buddy.style.left = pct(a.x) + '%';
      buddy.style.top = a.y + 'px';
      void buddy.offsetWidth;
      buddy.classList.add('t-hop');
      buddy.style.left = left;
      buddy.style.top = top;
    }

    function closeCard() {
      var c = path.querySelector('.t-card');
      if (c) c.parentNode.removeChild(c);
      openCard = -1;
    }

    function showCard(i) {
      closeCard();
      var map = path.querySelector('.t-map');
      if (!map) return;
      map.insertAdjacentHTML('beforeend', cardHtml(o.lessons, medals(o.lessons, entry()), i, T));
      openCard = i;
      var b = map.querySelector('.t-open');
      if (b) b.focus();
    }

    function draw() {
      if (!path) return;
      var view = readView(storage), found = searching(), on = view === 'path' && !found;
      lessonCards().forEach(function (c) {
        if (on) c.setAttribute('data-trail-hidden', '');
        else c.removeAttribute('data-trail-hidden');
      });
      toggle.textContent = view === 'path' ? T.list : T.path;
      // Search results are always cards, so the switch would only change the view she gets back after clearing.
      toggle.hidden = found;
      showGuide();
      openCard = -1;
      path.hidden = !on;
      if (!on) { path.innerHTML = ''; return; }
      var ms = medals(o.lessons, entry()), next = nextStop(ms);
      path.innerHTML = pathHtml(o.lessons, ms, next, avatar(), T);
      if (o.lessons.length) hop(next >= 0 ? next : o.lessons.length - 1);
    }

    // A broken path must never cost her the game: start() undoes whatever mount() added and the home keeps its cards.
    function unmount() {
      if (watcher) watcher.disconnect();
      [style, top, path].forEach(function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
      if (list) lessonCards().forEach(function (c) { c.removeAttribute('data-trail-hidden'); });
      path = null;
    }

    function start(opts) {
      if (list || !isObj(opts)) return;
      try {
        mount(opts);
      } catch (e) {
        try { unmount(); } catch (e2) {}
      }
      // Opening the lesson needs only the cards, so a map link still works when the path could not be drawn.
      var want = list && o ? indexOfId(o.lessons, wanted) : -1;
      if (want >= 0) win.setTimeout(function () { openAt(want); }, 0);
    }

    function mount(opts) {
      list = doc.getElementById(opts.list);
      if (!list || !Array.isArray(opts.lessons) || typeof opts.app !== 'string') { list = null; return; }
      function fn(f, fallback) { return typeof f === 'function' ? f : fallback; }
      o = {
        app: opts.app, title: typeof opts.title === 'string' ? opts.title : opts.app, lessons: opts.lessons.filter(isObj),
        review: fn(opts.review, function () {}), final: fn(opts.final, function () {}), finalStars: fn(opts.finalStars, function () { return 0; })
      };

      style = doc.createElement('style');
      style.id = 'trail-style';
      style.textContent = UI_CSS;
      (doc.head || doc.documentElement).appendChild(style);
      if (win.Guide && win.Guide.addStyle) win.Guide.addStyle(doc);

      // Above the search box (which must stay right above the cards): the guide's bubble and the Path/List toggle.
      top = doc.createElement('div');
      top.className = 'trail-top';
      slot = doc.createElement('div');
      slot.className = 'trail-guide';
      toggle = doc.createElement('button');
      toggle.type = 'button';
      toggle.className = 'trail-toggle';
      top.appendChild(slot);
      top.appendChild(toggle);
      var search = list.previousElementSibling && list.previousElementSibling.classList.contains('lsearch') ? list.previousElementSibling : null;
      list.parentNode.insertBefore(top, search || list);
      path = doc.createElement('div');
      path.className = 'trail-path';
      path.setAttribute('role', 'group');
      path.setAttribute('aria-label', T.label);
      list.parentNode.insertBefore(path, list.nextSibling);

      toggle.addEventListener('click', function () {
        saveView(storage, now, readView(storage) === 'path' ? 'list' : 'path');
        draw();
      });
      path.addEventListener('click', function (e) {
        var open = e.target.closest('[data-open]');
        if (open) { var i = Number(open.getAttribute('data-open')); closeCard(); return openAt(i); }
        var stop = e.target.closest('[data-stop]');
        if (stop) {
          var j = Number(stop.getAttribute('data-stop'));
          return j === openCard ? closeCard() : showCard(j);
        }
        if (!e.target.closest('.t-card')) closeCard();
      });
      path.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || openCard < 0) return;
        var j = openCard;
        closeCard();
        var s = path.querySelector('[data-stop="' + j + '"]');
        if (s) s.focus();
      });
      // The home screen redraws its cards after every lesson; the path follows (new medals, the buddy hops).
      watcher = new win.MutationObserver(draw);
      watcher.observe(list, { childList: true });
      if (search) ['input', 'click', 'keyup'].forEach(function (ev) { search.addEventListener(ev, function () { win.setTimeout(draw, 0); }); });
      doc.addEventListener('cloud-synced', draw);
      win.addEventListener('pageshow', function (e) { if (e.persisted) draw(); });
      draw();
    }

    return { start: start };
  }

  var exported = { layout: layout, height: height, buddySpot: buddySpot, pct: pct, readView: readView, saveView: saveView,
    lessonParam: lessonParam, indexOfId: indexOfId, medals: medals, nextStop: nextStop, pathHtml: pathHtml, cardHtml: cardHtml,
    lobbyUrl: lobbyUrl, TEXT: TEXT, KEY: KEY, ROW: ROW, TOP: TOP };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Trail = create(root, script ? script.getAttribute('data-grade') : null);
  } catch (e) {}
})(this);
