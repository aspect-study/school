/* Loaded by every game (after boss.js) and both lobbies (after world.js and subjects.js). The pages are decoded as
   UTF-8, so the text can hold emoji.
   Family presence: each sister sees the other's buddy by the gate, her big moments, and sends one-tap cheers.
   A tablet writes only its own learner space; the sister's data comes in through cloud.js as family_peek_v1.
   Nothing here compares the sisters or touches points and coins. */
(function (root) {
  'use strict';

  function englishOnly(grade) { return grade === 'grade2' && !!root.Lang && !root.Lang.both(); }

  var KEY = 'family_v1';
  var SEEN = 'family_seen_v1';
  var PEEK = 'family_peek_v1';
  var TOTAL = 'cheers_sent_total';
  var PEEK_STATE = ['profile_v1', 'world_v1', KEY, 'avatar_v1', 'house_v1'];
  var PEEK_COUNTERS = [TOTAL];
  var KINDS = { medal: true, boss: true, quests: true, streak: true };
  var NEWS_KEEP = 20;
  var CARD_NEWS = 5;
  var SENT_KEEP_MS = 7 * 86400000;
  var DAY_LIMIT = 10;
  var SAME_GAP_MS = 60000;
  var PLAYING_MS = 5 * 60000;
  var MEDALS = ['', '🥉', '🥈', '🥇'];
  var TIERS = ['', 'Bronze', 'Silver', 'Gold'];

  // Same id, same button spot; each direction has its own words. Ids are permanent once released.
  var CHEERS = {
    fromAte: [
      { id: 'great', text: 'Galing mo, Bunso! · You\'re great! 💖' },
      { id: 'proud', text: 'So proud of you! 🌟' },
      { id: 'can', text: 'You can do it! 💪' },
      { id: 'smart', text: 'Ang talino mo! · You\'re so smart! 🧠' },
      { id: 'love', text: 'Love you, Bunso! 🤗' },
      { id: 'go', text: 'Keep going! 🚀' }
    ],
    fromBunso: [
      { id: 'great', text: 'Galing mo, Ate! · You\'re great! 🌟' },
      { id: 'proud', text: 'Idol kita, Ate! · You\'re my idol! 💖' },
      { id: 'can', text: 'Kaya mo \'yan! · You can do it! 💪' },
      { id: 'smart', text: 'Salamat, Ate! · Thank you! 🙏' },
      { id: 'love', text: 'Love kita, Ate! · Love you! 🤗' },
      { id: 'go', text: 'Laban, Ate! · Fight! 🔥' }
    ]
  };

  function cheersEn(n) { return n === 1 ? ' cheer' : ' cheers'; }
  var TEXT = {
    grade5: {
      ate: 'Ate', kuya: 'Kuya', bunso: 'Bunso', sister: 'Sister', brother: 'Brother',
      playing: 'playing now',
      seen: function (when) { return 'last seen ' + when; },
      buddy: function (name, boy) { return name + '\'s buddy. Tap to see ' + (boy ? 'his' : 'her') + ' big moments and send a cheer.'; },
      title: function (name) { return '💖 ' + name; },
      newsHead: 'Big moments',
      noNews: 'No big moments yet. Cheer her on!',
      noNewsBoy: 'No big moments yet. Cheer him on!',
      cheerHead: 'Send a cheer 💌',
      count: function (n, name) { return '💖 ' + n + cheersEn(n) + ' from ' + name; },
      limit: 'More cheers tomorrow!',
      sent: 'Sent! 💌',
      close: 'Close',
      next: function (name) { return 'Tap ' + name + '\'s buddy to cheer back!'; },
      medal: function (tier, app, title) { return MEDALS[tier] + ' ' + TIERS[tier] + ' in ' + app + (title ? ': ' + title : ''); },
      boss: function (app) { return '⚔️ Cleared a boss stage in ' + app; },
      quests: '✅ Did all 3 quests today',
      streak: function (n) { return '🔥 ' + n + '-day streak'; }
    },
    grade2: {
      ate: 'Ate', kuya: 'Kuya', bunso: 'Bunso', sister: 'Kapatid · Sister', brother: 'Kapatid · Brother',
      playing: 'naglalaro ngayon · playing now',
      seen: function (when) { return 'huling nakita ' + when + ' · last seen ' + when; },
      buddy: function (name, boy) { return 'Kasama ni ' + name + '. Pindutin para makita at i-cheer siya. · ' + name + '\'s buddy. Tap to see ' + (boy ? 'his' : 'her') + ' big moments and send a cheer.'; },
      title: function (name) { return '💖 ' + name; },
      newsHead: 'Mga tagumpay niya · Big moments',
      noNews: 'Wala pa. I-cheer mo siya! · No big moments yet. Go and cheer her on!',
      noNewsBoy: 'Wala pa. I-cheer mo siya! · No big moments yet. Go and cheer him on!',
      cheerHead: 'Magpadala ng cheer · Send a cheer 💌',
      count: function (n, name) { return '💖 ' + n + ' cheer mula kay ' + name + ' · ' + n + cheersEn(n) + ' to you from ' + name; },
      limit: 'Bukas ulit! · Again tomorrow!',
      sent: 'Naipadala na! · It is sent! 💌',
      close: 'Close',
      next: function (name) { return 'Pindutin si ' + name + ' para mag-cheer pabalik · Tap ' + name + ' to cheer back!'; },
      medal: function (tier, app, title) { return MEDALS[tier] + ' ' + TIERS[tier] + ' sa ' + app + ' · ' + TIERS[tier] + ' in ' + app + (title ? ': ' + title : ''); },
      boss: function (app) { return '⚔️ Natalo ang boss sa ' + app + ' · Cleared a boss stage in ' + app; },
      quests: '✅ Tapos ang 3 quests ngayon · All 3 quests done for the day',
      streak: function (n) { return '🔥 ' + n + ' araw na sunod-sunod · a ' + n + '-day streak'; }
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function readJson(storage, key) { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } }
  function parseObj(v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } }
    return isObj(v) ? v : null;
  }
  function newestFirst(a, b) { return b.t - a.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
  function entries(list) {
    return (Array.isArray(list) ? list : []).filter(function (e) {
      return isObj(e) && typeof e.id === 'string' && typeof e.t === 'number' && isFinite(e.t);
    }).sort(newestFirst);
  }

  function clean(d) {
    var ok = isObj(d) && d.v === 1;
    return {
      v: 1,
      at: ok ? num(d.at) : 0,
      news: ok ? entries(d.news).filter(function (n) { return KINDS[n.kind] === true; }) : [],
      sent: ok ? entries(d.sent) : []
    };
  }
  function read(storage) { return clean(readJson(storage, KEY)); }
  function write(storage, state, t) {
    state.news = state.news.slice(0, NEWS_KEEP);
    state.sent = state.sent.filter(function (s) { return s.t >= t - SENT_KEEP_MS; });
    try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function newId(t, random) { return t.toString(36) + '-' + Math.floor(random() * 1679616).toString(36); }

  // A big moment for her sister's card. Only the four kinds; never scores, coins or wrong answers.
  function note(storage, now, random, kind, data) {
    if (KINDS[kind] !== true) return false;
    var t = now(), s = read(storage), e = { id: newId(t, random), t: t, kind: kind };
    data = isObj(data) ? data : {};
    if (typeof data.app === 'string' && data.app) e.app = data.app;
    if (typeof data.title === 'string' && data.title) e.title = data.title;
    if (data.tier >= 1 && data.tier <= 3) e.tier = Math.floor(data.tier);
    if (data.n >= 1) e.n = Math.floor(data.n);
    s.news.unshift(e);
    return write(storage, s, t);
  }

  function touch(storage, now) {
    var t = now(), s = read(storage);
    s.at = t;
    return write(storage, s, t);
  }

  // The younger child's cheers call the receiver Ate; a boy receiver is Kuya. Ids never change.
  function cheersFor(voice, toBoy) {
    var list = has(CHEERS, voice) ? CHEERS[voice] : [];
    if (!(toBoy && voice === 'fromBunso')) return list;
    return list.map(function (c) { return { id: c.id, text: c.text.replace(/\bAte\b/g, 'Kuya') }; });
  }
  function cheerText(voice, id, toBoy) {
    var list = cheersFor(voice, toBoy);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].text;
    return null;
  }

  function dayKey(t) { var d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  // 10 cheers a local day, and never the same cheer twice inside a minute, so a cheer cannot become teasing.
  function canSend(storage, now, cheerId) {
    var t = now(), sent = read(storage).sent, today = dayKey(t);
    var used = sent.filter(function (s) { return dayKey(s.t) === today || s.t > t; }).length;
    if (used >= DAY_LIMIT) return { ok: false, reason: 'limit', left: 0 };
    if (cheerId && sent.some(function (s) { return s.cheer === cheerId && t >= s.t && t - s.t < SAME_GAP_MS; })) {
      return { ok: false, reason: 'again', left: DAY_LIMIT - used };
    }
    return { ok: true, left: DAY_LIMIT - used };
  }

  function send(storage, now, random, to, cheerId) {
    if (typeof to !== 'string' || !to || !cheerText('fromAte', cheerId) || !canSend(storage, now, cheerId).ok) return false;
    var t = now(), s = read(storage);
    s.sent.unshift({ id: newId(t, random), t: t, to: to, cheer: cheerId });
    if (!write(storage, s, t)) return false;
    try { storage.setItem(TOTAL, String((parseInt(storage.getItem(TOTAL), 10) || 0) + 1)); } catch (e) {}
    return true;
  }

  // list: [{ id, state: { profile_v1, world_v1, family_v1, avatar_v1, house_v1 }, counters: { cheers_sent_total } }] from cloud.js.
  // world_v1 and avatar_v1 are plain synced keys, so they arrive as the saved JSON text.
  function store(storage, now, list) {
    var out = {}, t = now();
    (Array.isArray(list) ? list : []).forEach(function (r) {
      if (!isObj(r) || typeof r.id !== 'string' || !r.id) return;
      var st = isObj(r.state) ? r.state : {}, c = isObj(r.counters) ? r.counters : {};
      out[r.id] = { profile: isObj(st.profile_v1) ? st.profile_v1 : {}, world: parseObj(st.world_v1) || {},
        look: parseObj(st.avatar_v1), family: isObj(st[KEY]) ? st[KEY] : null,
        house: isObj(st.house_v1) ? st.house_v1 : parseObj(st.house_v1), total: num(c[TOTAL]), readAt: t };
    });
    if (!Object.keys(out).length && storage.getItem(PEEK) === null) return;
    try {
      if (storage.put) storage.put(PEEK, JSON.stringify(out));
      else storage.setItem(PEEK, JSON.stringify(out));
    } catch (e) {}
  }
  function readPeek(storage) { var d = readJson(storage, PEEK); return isObj(d) ? d : {}; }

  function cleanSeen(d) {
    var news = {};
    if (isObj(d) && isObj(d.news)) Object.keys(d.news).forEach(function (k) { news[k] = num(d.news[k]); });
    return { cheers: isObj(d) ? num(d.cheers) : 0, news: news };
  }
  function readSeen(storage) { return cleanSeen(readJson(storage, SEEN)); }
  function saveSeen(storage, s) { try { storage.setItem(SEEN, JSON.stringify(s)); } catch (e) {} }
  function markCheers(storage, t) {
    var s = readSeen(storage);
    if (t > s.cheers) { s.cheers = t; saveSeen(storage, s); }
  }
  function markNews(storage, id, t) {
    var s = readSeen(storage);
    if (!(s.news[id] >= t)) { s.news[id] = t; saveSeen(storage, s); }
  }

  // What she is to me: the higher grade is Ate, or Kuya for a boy.
  function relation(myGrade, herGrade, herBoy) {
    if (herGrade > myGrade) return herBoy ? 'kuya' : 'ate';
    if (herGrade < myGrade) return 'bunso';
    return herBoy ? 'brother' : 'sister';
  }
  function voiceOf(senderIs) { return senderIs === 'bunso' ? 'fromBunso' : 'fromAte'; }
  function nameIn(prof) { return typeof prof.name === 'string' ? prof.name.trim() : ''; }

  function sisters(me, peek, nowMs, seen) {
    seen = cleanSeen(seen);
    peek = isObj(peek) ? peek : {};
    return Object.keys(peek).sort().filter(function (id) { return id !== me.id && isObj(peek[id]); }).map(function (id) {
      var p = peek[id], prof = isObj(p.profile) ? p.profile : {}, fam = clean(p.family), grade = num(prof.grade);
      var boy = prof.boy === true;
      return {
        id: id, rel: relation(num(me.grade), grade, boy), boy: boy, grade: grade, name: nameIn(prof),
        avatar: isObj(p.world) && typeof p.world.avatar === 'string' ? p.world.avatar : null,
        look: isObj(p.look) ? p.look : null,
        house: isObj(p.house) ? p.house : null,
        at: fam.at, playing: fam.at > 0 && nowMs - fam.at < PLAYING_MS && nowMs - fam.at > -PLAYING_MS,
        news: fam.news.slice(0, CARD_NEWS),
        hasNews: fam.news.length > 0 && fam.news[0].t > num(seen.news[id]),
        total: num(p.total)
      };
    });
  }

  function olderIsBoy(me, peek) {
    var older = sisters(me, peek, 0, {}).filter(function (s) { return s.rel === 'ate' || s.rel === 'kuya'; });
    return older.length > 0 && older.every(function (s) { return s.boy; });
  }

  function unseenCheers(me, peek, seen) {
    seen = cleanSeen(seen);
    peek = isObj(peek) ? peek : {};
    var out = [];
    Object.keys(peek).forEach(function (id) {
      if (id === me.id || !isObj(peek[id])) return;
      var p = peek[id], prof = isObj(p.profile) ? p.profile : {}, rel = relation(num(me.grade), num(prof.grade), prof.boy === true);
      clean(p.family).sent.forEach(function (s) {
        var text = cheerText(voiceOf(rel), s.cheer, me.boy === true);
        if (s.to === me.id && s.t > seen.cheers && text) out.push({ from: id, rel: rel, name: nameIn(prof), t: s.t, text: text });
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // subjects: engine/subjects.js ({ 5: [{ app, title }], 2: [...] }), so a news line names her sister's subject.
  function appTitle(subjects, app) {
    var found = '';
    Object.keys(isObj(subjects) ? subjects : {}).forEach(function (g) {
      (Array.isArray(subjects[g]) ? subjects[g] : []).forEach(function (s) { if (!found && s && s.app === app) found = s.title; });
    });
    return found || app || '';
  }
  function newsLine(T, n, subjects) {
    var app = appTitle(subjects, typeof n.app === 'string' ? n.app : '');
    if (n.kind === 'medal') return T.medal(n.tier === 2 || n.tier === 3 ? n.tier : 1, app, typeof n.title === 'string' ? n.title : '');
    if (n.kind === 'boss') return T.boss(app);
    if (n.kind === 'quests') return T.quests;
    return T.streak(n.n >= 1 ? Math.floor(n.n) : 0);
  }
  function ago(t, nowMs) {
    var min = Math.floor((nowMs - t) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    var h = Math.floor(min / 60);
    if (h < 24) return h + ' h ago';
    var d = Math.floor(h / 24);
    return d === 1 ? '1 day ago' : d + ' days ago';
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var UI_CSS =
    '.f-sis{cursor:pointer;outline:none;}' +
    '.f-sis:focus-visible .f-ring{stroke:var(--ink);stroke-width:6;}' +
    '.f-ring{fill:var(--card);stroke:#E46BA0;stroke-width:5;}' +
    '.f-glow{fill:#F9C5DC;opacity:.6;}' +
    '.f-away{opacity:.6;}' +
    '.f-tag{fill:var(--ink);font-weight:800;}' +
    '.f-mark circle{fill:var(--card);stroke:#E46BA0;stroke-width:3;}' +
    '.f-card{position:absolute;left:0;right:0;bottom:0;max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:10px;' +
      'padding:18px 16px 16px;background:var(--card);color:var(--ink);border:1.5px solid var(--border);border-radius:20px;box-sizing:border-box;}' +
    '.f-title{margin:0;font-weight:800;font-size:1.3rem;}' +
    '.f-sub{margin:0;color:var(--ink-soft);font-weight:700;}' +
    '.f-head{margin:6px 0 0;font-weight:800;}' +
    '.f-news{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-weight:700;}' +
    '.f-cheers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}' +
    '.f-cheers button,.f-close{font:inherit;font-weight:800;padding:12px 10px;border-radius:14px;border:1.5px solid var(--border);' +
      'background:var(--bg-alt);color:var(--ink);cursor:pointer;}' +
    '.f-cheers button:disabled{opacity:.45;cursor:default;}' +
    '.f-msg,.f-count{margin:0;font-weight:800;}' +
    '.f-close{align-self:center;padding:8px 22px;}';

  function mountUi(win, grade, storage, deps) {
    var doc = win.document, T = englishOnly(grade) ? TEXT.grade5 : TEXT[grade], api = { text: T },
      cheerLine = function (text) { return englishOnly(grade) ? root.Lang.en(text) : text; }, openId = null, lastMsg = '', tries = 0, timer = null;

    function me() { return deps.me() || { id: '', grade: 0 }; }
    function all() { return sisters(me(), readPeek(storage), deps.now(), readSeen(storage)); }
    function nameOf(s) { return s.name || T[s.rel]; }
    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    // Her buddy stands beside the gate, right then left, a little further out for each more sister.
    function spotOf(L, r, i) {
      var dx = Math.round(r * 3.4) * (Math.floor(i / 2) + 1) * (i % 2 ? -1 : 1);
      return [L.gate[0] + dx, L.gate[1] - r];
    }
    function buddySvg(W, s, pt, r) {
      var name = nameOf(s), now = deps.now(), when = s.at ? T.seen(ago(s.at, now)) : '';
      var tag = s.playing ? name + ' 🎮' : when ? name + ' · ' + when : name;
      var face = has(W.AVATARS, s.avatar) ? W.AVATARS[s.avatar] : W.AVATARS[W.DEFAULT_AVATAR], m = Math.round(r * 0.8);
      return '<g class="f-sis ' + (s.playing ? 'f-on' : 'f-away') + '" data-sister="' + W.esc(s.id) + '" tabindex="0" role="button" aria-label="' +
        W.esc((T.buddy(name, s.boy) + ' ' + (s.playing ? T.playing : when)).trim()) + '" transform="translate(' + pt[0] + ' ' + pt[1] + ')">' +
        (s.playing ? '<circle class="f-glow" r="' + (r + 10) + '"/>' : '') +
        '<circle class="f-ring" r="' + r + '"/>' +
        W.svgText('', 0, 0, Math.round(r * 1.2), face, r * 2) +
        W.svgText('f-tag', 0, r + Math.round(r * 0.6), Math.round(r * 0.62), tag, r * 5) +
        (s.hasNews ? '<g class="f-mark" aria-hidden="true"><circle cx="' + m + '" cy="' + -m + '" r="' + Math.round(r * 0.55) + '"/>' +
          W.svgText('', m, -m, Math.round(r * 0.6), '💌', r) + '</g>' : '') +
        '</g>';
    }

    function draw(box) {
      var W = win.World, svg = box && box.querySelector('.w-map');
      if (!svg || !W || !W.LAYOUT || !W.LAYOUT[grade] || !W.svgText) return;
      var old = svg.querySelector('.f-sisters');
      if (old) old.parentNode.removeChild(old);
      var list = all();
      if (!list.length) return;
      var L = W.LAYOUT[grade], r = W.radius(L), g = doc.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'f-sisters');
      g.innerHTML = list.map(function (s, i) { return buddySvg(W, s, spotOf(L, r, i), r); }).join('');
      svg.appendChild(g);
      if (svg.getAttribute('data-family')) return;
      svg.setAttribute('data-family', '1');
      function pick(target) {
        var b = target && target.closest ? target.closest('[data-sister]') : null;
        if (b) openCard(box, b.getAttribute('data-sister'), 'user');
        return !!b;
      }
      svg.addEventListener('click', function (e) { pick(e.target); });
      svg.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && pick(e.target)) e.preventDefault();
      });
    }

    function closeCard(box, focus) {
      var c = box.querySelector('.f-card'), id = openId;
      if (c) c.parentNode.removeChild(c);
      openId = null;
      lastMsg = '';
      if (!focus) return;
      var b = Array.prototype.filter.call(box.querySelectorAll('[data-sister]'), function (x) { return x.getAttribute('data-sister') === id; })[0];
      if (b && b.focus) b.focus();
    }

    // The card is drawn again after each sync (the map is redrawn), so a "Sent!" line is kept for the same sister.
    function openCard(box, id, how) {
      var s = all().filter(function (x) { return x.id === id; })[0], keep = openId === id ? lastMsg : '';
      closeCard(box, false);
      if (!s) return;
      openId = id;
      lastMsg = keep;
      var name = nameOf(s), card = el('div', 'f-card');
      card.tabIndex = -1;
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', T.title(name));
      card.appendChild(el('p', 'f-title', T.title(name)));
      card.appendChild(el('p', 'f-sub', s.playing ? T.playing : s.at ? T.seen(ago(s.at, deps.now())) : ''));
      card.appendChild(el('p', 'f-head', T.newsHead));
      var ul = el('ul', 'f-news');
      if (!s.news.length) ul.appendChild(el('li', '', s.boy ? T.noNewsBoy : T.noNews));
      s.news.forEach(function (n) { ul.appendChild(el('li', '', newsLine(T, n, win.Subjects))); });
      card.appendChild(ul);
      card.appendChild(el('p', 'f-head', T.cheerHead));
      var grid = el('div', 'f-cheers');
      cheersFor(voiceOf(relation(s.grade, num(me().grade))), s.boy).forEach(function (c) {
        var b = el('button', '', cheerLine(c.text));
        b.type = 'button';
        b.setAttribute('data-cheer', c.id);
        grid.appendChild(b);
      });
      card.appendChild(grid);
      var msg = el('p', 'f-msg', lastMsg);
      msg.setAttribute('aria-live', 'polite');
      card.appendChild(msg);
      card.appendChild(el('p', 'f-count', T.count(s.total, name)));
      var close = el('button', 'f-close', T.close);
      close.type = 'button';
      card.appendChild(close);
      function paint() {
        var ok = canSend(storage, deps.now, null).ok;
        Array.prototype.forEach.call(grid.querySelectorAll('button'), function (b) { b.disabled = !ok; });
        if (!ok) msg.textContent = lastMsg = T.limit;
      }
      grid.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button[data-cheer]') : null;
        if (!b || b.disabled) return;
        if (send(storage, deps.now, deps.random, s.id, b.getAttribute('data-cheer'))) {
          msg.textContent = lastMsg = T.sent;
          deps.sync();
        }
        paint();
      });
      close.addEventListener('click', function () { closeCard(box, true); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(box, true); });
      paint();
      box.appendChild(card);
      if (s.news.length) markNews(storage, s.id, s.news[0].t);
      draw(box);
      // A sync redraw keeps her focus where it is; it only catches focus the redraw dropped.
      try {
        if (how === 'user') card.focus();
        else if (!doc.activeElement || doc.activeElement === doc.body) card.focus({ preventScroll: true });
      } catch (e) {}
    }

    function popCheers() {
      win.clearTimeout(timer);
      var F = win.Fx, list = unseenCheers(me(), readPeek(storage), readSeen(storage));
      if (!list.length || !F || !F.celebrate) return;
      // Another popup is up (quests, the boss): wait for it, so neither is lost.
      if (doc.getElementById('fx-pop') || (F.queued && F.queued())) {
        if (tries++ < 20) timer = win.setTimeout(popCheers, 3000);
        return;
      }
      tries = 0;
      F.celebrate(list.slice(0, 4).map(function (c) {
        var name = c.name || T[c.rel];
        return { big: false, icon: '💌', title: name + ': ' + cheerLine(c.text), line: '', next: T.next(name) };
      }));
      // Marked when queued: a popup that replaces this one in the same instant drops it (accepted; rare).
      markCheers(storage, list[Math.min(list.length, 4) - 1].t);
    }

    api.note = function (kind, data) { return deps.paused() ? false : note(storage, deps.now, deps.random, kind, data); };
    api.touch = function () { return doc.visibilityState === 'hidden' ? false : touch(storage, deps.now); };
    api.store = function (list) { store(storage, deps.now, list); };
    api.popCheers = popCheers;

    // Games stop here: only a lobby has the campus map.
    if (!doc.getElementById('campus')) return api;
    var style = doc.createElement('style');
    style.textContent = UI_CSS;
    (doc.head || doc.documentElement).appendChild(style);
    doc.addEventListener('world-drawn', function (e) {
      var box = e.detail && e.detail.box;
      if (!box) return;
      draw(box);
      if (openId && !box.hidden) openCard(box, openId, 'redraw');
      else openId = null;
    });
    doc.addEventListener('cloud-synced', function () { tries = 0; win.setTimeout(popCheers, 1500); });
    win.setTimeout(popCheers, 1500);
    return api;
  }

  var exported = { read: read, note: note, touch: touch, canSend: canSend, send: send, store: store, readPeek: readPeek,
    readSeen: readSeen, markCheers: markCheers, markNews: markNews, sisters: sisters, unseenCheers: unseenCheers,
    relation: relation, voiceOf: voiceOf, cheerText: cheerText, cheersFor: cheersFor, olderIsBoy: olderIsBoy, newsLine: newsLine, ago: ago,
    CHEERS: CHEERS, TEXT: TEXT, KEY: KEY, SEEN: SEEN, PEEK: PEEK, TOTAL: TOTAL, PEEK_STATE: PEEK_STATE,
    PEEK_COUNTERS: PEEK_COUNTERS, DAY_LIMIT: DAY_LIMIT, NEWS_KEEP: NEWS_KEEP };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // mountUi binds these to the page's storage; the pure versions (storage first) are for Node tests.
  var PAGE_ONLY = { note: true, touch: true, store: true };
  // Games and lobbies get note/touch for their grade; a page without data-grade gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && TEXT[grade]) {
      api = mountUi(root, grade, root.Learner ? root.Learner.storage : root.localStorage, {
        now: Date.now,
        random: Math.random,
        me: function () { return root.Learner && root.Learner.current ? root.Learner.current() : null; },
        paused: function () { return !!(root.Clock && root.Clock.paused()); },
        sync: function () { if (root.Cloud && root.Cloud.sync) root.Cloud.sync(); }
      });
    }
    Object.keys(exported).forEach(function (k) { if (!PAGE_ONLY[k]) api[k] = exported[k]; });
    root.Family = api;
  } catch (e) {}
})(this);
