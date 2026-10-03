/* Loaded by every game and both lobbies after recall.js, and by the parent page. The pages are decoded as UTF-8, so the text can hold emoji.
   A lesson's medal comes from its weakest question's review box: Bronze at box 2, Silver at 3, Gold at 4.
   The best medal is kept in mastery_v1, shown with a polish mark when the lesson slips, and paid once. */
(function (root) {
  'use strict';

  var KEY = 'mastery_v1';
  var MEDALS = ['', '🥉', '🥈', '🥇'];
  var MIN_BOX = [0, 2, 3, 4];
  var PAY = [0, 20, 40, 80];
  var NAMES = { en: ['', 'Bronze', 'Silver', 'Gold'], fil: ['', 'Tanso', 'Pilak', 'Ginto'] };

  function tally(c) { return '🥇 ' + c.gold + ' · 🥈 ' + c.silver + ' · 🥉 ' + c.bronze; }

  function questionsEn(n) { return n > 1 ? 'all ' + n + ' questions' : 'every question'; }
  function lessonsEn(n) { return n + (n === 1 ? ' lesson' : ' lessons'); }
  var MEDAL_LINE_EN = [
    '',
    function (n) { return 'You got ' + questionsEn(n) + ' right.'; },
    function (n) { return 'You got ' + questionsEn(n) + ' right on 2 different days.'; },
    function (n) { return 'You got ' + questionsEn(n) + ' right on 3 different days.'; }
  ];
  var MEDAL_NEXT_EN = ['', '🥈 next: get them right again in 3 days', '🥇 next: once more in about 7 days', 'It comes back in 2 weeks to stay strong'];
  var MEDAL_NEXT_FIL = ['', '🥈 Susunod: sagutin ulit sa 3 araw', '🥇 Susunod: isa pa pagkalipas ng mga 7 araw', 'Babalik ito sa 2 linggo'];
  function subjectNextEn(l, n) { return l < 3 ? 'Next: all-' + NAMES.en[l + 1] + ', ' + lessonsEn(n) + ' to go' : 'Every lesson is Gold. Amazing!'; }
  function fixedTitleEn(n) { return 'You fixed ' + n + (n === 1 ? ' mistake!' : ' mistakes!'); }
  function fixedLineEn(n) { return n === 1 ? 'A question you missed before is right now.' : n + ' questions you missed before are right now.'; }
  function fixedNextEn(n) { return (n === 1 ? 'It comes' : 'They come') + ' back in 3 days to check'; }

  var TEXT = {
    grade5: {
      name: function (l) { return NAMES.en[l]; },
      newLine: function (m) { return '🏅 New ' + NAMES.en[m.level] + ': ' + m.title + '! +' + m.points + ' points'; },
      chip: function (c) { return tally(c) + ' of ' + c.total + ' lessons'; },
      polish: 'needs a polish',
      mapButton: '🗺️ My Map',
      mapTitle: '🗺️ My Medal Map',
      mapHint: 'Get every question in a lesson right: 🥉 on 1 day · 🥈 on 2 days · 🥇 on 3 days',
      openOnce: 'Open this game once to see its medals',
      medalTitle: function (m) { return NAMES.en[m.level] + ': ' + m.title + '!'; },
      medalLine: function (l, n) { return MEDAL_LINE_EN[l](n); },
      medalNext: function (l) { return MEDAL_NEXT_EN[l]; },
      subjectTitle: function (l, app) { return 'All of ' + app + ' is ' + NAMES.en[l] + '!'; },
      subjectLine: function (l) { return 'Every lesson has ' + MEDALS[l] + ' or better.'; },
      subjectNext: subjectNextEn,
      fixedTitle: fixedTitleEn,
      fixedLine: fixedLineEn,
      fixedNext: fixedNextEn
    },
    grade2: {
      name: function (l) { return NAMES.fil[l] + ' · ' + NAMES.en[l]; },
      newLine: function (m) { return '🏅 Bagong ' + NAMES.fil[m.level] + ' · New ' + NAMES.en[m.level] + ': ' + m.title + '! +' + m.points + ' points'; },
      chip: function (c) { return tally(c) + ' sa ' + c.total + ' aralin · of ' + c.total + ' lessons'; },
      polish: 'kailangang balikan · needs a polish',
      mapButton: '🗺️ My Map',
      mapTitle: '🗺️ Mapa ng Galing · Map of My Medals',
      mapHint: 'Sagutin nang tama ang lahat: 🥉 1 araw · 🥈 2 araw · 🥇 3 araw · Get all of the questions right: 🥉 1 day · 🥈 2 days · 🥇 3 days',
      openOnce: 'Buksan muna ang laro · Open this game once to see its medals',
      medalTitle: function (m) { return NAMES.fil[m.level] + ' · ' + NAMES.en[m.level] + ': ' + m.title + '!'; },
      medalLine: function (l, n) {
        var fil = l === 1 ? (n > 1 ? 'Tama lahat ng ' + n + ' tanong' : 'Tama ang bawat tanong') : 'Tama lahat sa ' + l + ' magkaibang araw';
        return fil + ' · ' + MEDAL_LINE_EN[l](n);
      },
      medalNext: function (l) { return MEDAL_NEXT_FIL[l] + ' · ' + MEDAL_NEXT_EN[l]; },
      subjectTitle: function (l, app) { return NAMES.fil[l] + ' na ang lahat ng ' + app + '! · All of ' + app + ' is ' + NAMES.en[l] + '!'; },
      subjectLine: function (l) { return 'May ' + MEDALS[l] + ' o higit pa ang bawat aralin · Every lesson has ' + MEDALS[l] + ' or better.'; },
      subjectNext: function (l, n) {
        return (l < 3 ? 'Susunod: lahat ' + NAMES.fil[l + 1] + ', ' + n + ' aralin pa' : 'Ginto na lahat. Galing!') + ' · ' + subjectNextEn(l, n);
      },
      fixedTitle: function (n) { return 'Inayos mo ang ' + n + ' mali · ' + fixedTitleEn(n); },
      fixedLine: function (n) { return n + ' tanong na mali dati, tama na ngayon · ' + fixedLineEn(n); },
      fixedNext: function (n) { return 'Babalik sa 3 araw para masuri · ' + fixedNextEn(n); }
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function level(v) { var n = Math.floor(Number(v)); return n >= 1 ? Math.min(n, 3) : 0; }
  function readJson(storage, key) { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } }

  function read(storage) {
    var d = readJson(storage, KEY);
    return isObj(d) && d.v === 1 && isObj(d.apps) ? d : { v: 1, apps: {} };
  }

  function boxOf(items, key) {
    var it = items[key];
    return isObj(it) && !it.gone && it.box >= 1 && it.box <= 5 ? Math.floor(it.box) : 0;
  }

  function levelOf(items, keys) {
    var min = Math.min.apply(null, keys.map(function (k) { return boxOf(items, k); }));
    for (var l = 3; l > 0; l--) if (min >= MIN_BOX[l]) return l;
    return 0;
  }

  function lessonsOf(entry) {
    if (!isObj(entry) || !isObj(entry.lessons)) return [];
    var order = Array.isArray(entry.order) ? entry.order : Object.keys(entry.lessons);
    return order.filter(function (id, i) { return order.indexOf(id) === i && has(entry.lessons, id) && isObj(entry.lessons[id]); }).map(function (id) { return entry.lessons[id]; });
  }

  function counts(entry) {
    var c = { gold: 0, silver: 0, bronze: 0, total: 0 };
    lessonsOf(entry).forEach(function (l) {
      var b = level(l.best);
      c.total++;
      if (b === 3) c.gold++;
      else if (b === 2) c.silver++;
      else if (b === 1) c.bronze++;
    });
    return c;
  }

  function polishList(entry) {
    return lessonsOf(entry).filter(function (l) { return level(l.now) < level(l.best); }).map(function (l) { return String(l.title); });
  }

  // A game's level is its weakest shown lesson's best medal.
  function subjectLevel(entry) {
    var list = lessonsOf(entry);
    return list.length ? Math.min.apply(null, list.map(function (l) { return level(l.best); })) : 0;
  }

  function create(storage, now, grade) {
    if (!Object.prototype.hasOwnProperty.call(TEXT, grade || '')) throw new Error('Mastery needs a grade like "grade5".');
    return {
      text: TEXT[grade],

      summary: function () { return read(storage); },

      // Popup events for Fx.celebrate, biggest first: a game-wide level, then medals, then fixed mistakes.
      events: function (result, fixed, appTitle) {
        var T = TEXT[grade], list = [];
        if (result.subjectUp) {
          list.push({ rank: 10 + result.subjectUp, medal: result.subjectUp, big: true, icon: '🏆', title: T.subjectTitle(result.subjectUp, appTitle),
            line: T.subjectLine(result.subjectUp), next: T.subjectNext(result.subjectUp, result.toNext) });
        }
        (result.newly || []).forEach(function (m) {
          list.push({ rank: 1 + m.level, medal: m.level, big: m.level >= 2, icon: MEDALS[m.level], title: T.medalTitle(m),
            line: T.medalLine(m.level, m.count || 1), next: T.medalNext(m.level) });
        });
        if (fixed > 0) list.push({ rank: 1, big: false, icon: '🔧', title: T.fixedTitle(fixed), line: T.fixedLine(fixed), next: T.fixedNext(fixed) });
        list.sort(function (a, b) { return b.rank - a.rank; });
        // medal (1-3, Bronze to Gold) picks the popup's voice clip in Fx.
        return list.map(function (e) {
          var out = { big: e.big, icon: e.icon, title: e.title, line: e.line, next: e.next };
          if (e.medal) out.medal = e.medal;
          return out;
        });
      },

      // lessons: [{ id, title, icon, keys }], keys being the lesson's review_v1 keys. A lesson with no keys has no medal.
      update: function (app, lessons) {
        var boxes = readJson(storage, 'review_v1'), items = isObj(boxes) && isObj(boxes.items) ? boxes.items : {};
        var state = read(storage), old = isObj(state.apps[app]) && isObj(state.apps[app].lessons) ? state.apps[app].lessons : {};
        var entry = { t: now(), order: [], lessons: {} }, result = { lessons: {}, newly: [], points: 0 }, raised = false;
        lessons.forEach(function (l) {
          if (!l.keys || !l.keys.length || has(entry.lessons, l.id)) return;
          var was = has(old, l.id) && isObj(old[l.id]) ? old[l.id] : null, lv = levelOf(items, l.keys);
          var best = Math.max(lv, was ? level(was.best) : 0);
          if (was && best > level(was.best)) raised = true;
          // A lesson seen for the first time starts as paid, so medals earned before it was tracked pay nothing.
          var paid = was ? level(was.paid) : best, pts = 0;
          for (var x = paid + 1; x <= best; x++) pts += PAY[x];
          if (pts) {
            result.newly.push({ id: l.id, title: l.title, level: best, points: pts, count: l.keys.length });
            result.points += pts;
          }
          entry.order.push(l.id);
          entry.lessons[l.id] = { title: String(l.title), icon: l.icon || '', now: lv, best: best, paid: Math.max(paid, best) };
          result.lessons[l.id] = { now: lv, best: best, polish: lv < best };
        });
        Object.keys(old).forEach(function (id) {
          if (!has(entry.lessons, id) && isObj(old[id])) entry.lessons[id] = old[id];
        });
        var prev = state.apps[app], after = subjectLevel(entry);
        result.subjectUp = isObj(prev) && raised && after > subjectLevel(prev) ? after : 0;
        result.toNext = after < 3 ? lessonsOf(entry).filter(function (l) { return level(l.best) <= after; }).length : 0;
        if (!isObj(prev) || JSON.stringify([prev.order, prev.lessons]) !== JSON.stringify([entry.order, entry.lessons])) {
          state.apps[app] = entry;
          try {
            storage.setItem(KEY, JSON.stringify(state));
          } catch (e) {
            result.points = 0;
            result.newly = [];
            result.subjectUp = 0;
          }
        }
        result.counts = counts(entry);
        return result;
      }
    };
  }

  var UI_CSS =
    '.medal{display:inline-block;margin-left:6px;font-size:1.1em;line-height:1;vertical-align:middle;}' +
    '.medal-chip{margin:6px 0 0;font-weight:800;font-size:.95rem;}' +
    '.medal-new{margin:8px 0;padding:8px 12px;border-radius:12px;background:#FFF4D6;color:#5A3E00;font-weight:800;}' +
    '.map-open{display:block;margin:0 0 12px;padding:10px 18px;border:2px solid #9BB4E0;border-radius:999px;background:#fff;color:#23395B;font:inherit;font-weight:800;cursor:pointer;}' +
    '.map-open[hidden],.map-view[hidden]{display:none;}' +
    '.map-open:focus-visible,.map-tile:focus-visible{outline:3px solid #23395B;outline-offset:2px;}' +
    '.map-view{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:#F7FAFF;color:#23395B;}' +
    '.map-view h2{margin:0 0 4px;font-size:1.2rem;}' +
    '.map-hint,.map-count,.map-empty{margin:0 0 8px;font-size:.9rem;font-weight:700;}' +
    '.map-row{margin:12px 0 0;}' +
    '.map-row h3{margin:0 0 4px;font-size:1rem;}' +
    '.map-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;}' +
    '.map-tile{display:flex;gap:6px;align-items:center;padding:8px 10px;border-radius:12px;background:#fff;border:2px solid #DCE5F2;color:#23395B;text-decoration:none;font-size:.85rem;font-weight:700;}' +
    '.map-tile.has{border-color:#E8B93A;}' +
    '.map-medal{font-size:1.2rem;flex:none;}';

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
    function after(anchor, node) { anchor.parentNode.insertBefore(node, anchor.nextSibling); }
    function sticker(best, polish) { return MEDALS[best] + (polish ? '🔧' : ''); }

    // HTML for a lesson card; m is one of update()'s lessons.
    core.badge = function (m) {
      if (!m || !m.best) return '';
      var label = T.name(m.best) + (m.polish ? ' · ' + T.polish : '');
      return '<span class="medal" title="' + label + '" aria-label="' + label + '">' + sticker(m.best, m.polish) + '</span>';
    };

    core.renderChip = function (result) {
      var badge = doc.getElementById('points-total-badge');
      if (!badge || !badge.parentNode) return;
      Array.prototype.slice.call(doc.querySelectorAll('.medal-new[data-home]')).forEach(function (line) {
        if (line.getAttribute('data-seen') === '1') line.parentNode.removeChild(line);
        else line.setAttribute('data-seen', '1');
      });
      var chip = doc.getElementById('medal-chip');
      if (!chip) {
        chip = el('div', 'medal-chip');
        chip.id = 'medal-chip';
        after(badge, chip);
      }
      chip.textContent = T.chip(result.counts);
      chip.hidden = !result.counts.total;
    };

    // Replaces the new-medal lines right under anchor.
    core.showNew = function (anchor, newly) {
      if (!anchor || !anchor.parentNode) return;
      var next = anchor.nextSibling;
      while (next && next.className === 'medal-new') {
        var old = next;
        next = next.nextSibling;
        old.parentNode.removeChild(old);
      }
      newly.slice().reverse().forEach(function (m) {
        var line = el('div', 'medal-new', T.newLine(m));
        if (anchor.id === 'points-total-badge') line.setAttribute('data-home', '1');
        after(anchor, line);
      });
    };

    core.renderMap = function (box, cards) {
      if (!box) return;
      var apps = core.summary().apps;
      box.innerHTML = '';
      box.appendChild(el('h2', '', T.mapTitle));
      box.appendChild(el('p', 'map-hint', T.mapHint));
      Array.prototype.forEach.call(cards, function (card) {
        var app = card.getAttribute('data-app'), entry = apps[app], list = lessonsOf(entry);
        var title = card.querySelector('.subject-title'), emoji = card.querySelector('.subject-emoji');
        var row = el('section', 'map-row');
        row.setAttribute('data-app', app);
        row.appendChild(el('h3', '', (emoji ? emoji.textContent + ' ' : '') + (title ? title.textContent : app)));
        if (!list.length) {
          row.appendChild(el('p', 'map-empty', T.openOnce));
        } else {
          row.appendChild(el('p', 'map-count', T.chip(counts(entry))));
          var tiles = el('div', 'map-tiles');
          list.forEach(function (l) {
            var best = level(l.best), a = el('a', 'map-tile' + (best ? ' has' : ''));
            a.href = card.getAttribute('href');
            a.appendChild(el('span', 'map-medal', best ? sticker(best, level(l.now) < best) : '⚪'));
            a.appendChild(el('span', '', (l.icon ? l.icon + ' ' : '') + String(l.title)));
            tiles.appendChild(a);
          });
          row.appendChild(tiles);
        }
        box.appendChild(row);
      });
    };
    return core;
  }

  var exported = { create: create, read: read, counts: counts, polishList: polishList, levelOf: levelOf,
    MEDALS: MEDALS, MIN_BOX: MIN_BOX, PAY: PAY, TEXT: TEXT, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Games and lobbies get the page helpers for their grade; the parent page (no data-grade) gets only the pure ones.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = grade && TEXT[grade] ? mountUi(root, create(root.Learner ? root.Learner.storage : root.localStorage, Date.now, grade)) : {};
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Mastery = api;
  } catch (e) {}
})(this);
