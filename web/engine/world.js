/* Loaded by both lobbies after boss.js. The pages are decoded as UTF-8, so the text can hold emoji.
   Draws the lobby as a map she taps around: every game card is a building that levels up with her medals, plus the
   shop and the weekly boss arena. The cards stay the source of names and links; Campus mode only hides them. */
(function (root) {
  'use strict';

  var localize = root.Lang ? root.Lang.localize : function (t) { return t; };
  function forGrade(grade, table) { return grade === 'grade2' ? localize(table) : table; }

  var KEY = 'world_v1';
  var AVATARS = { girl: '👧', boy: '👦', cat: '🐱', dog: '🐶', bear: '🐻', rabbit: '🐰', owl: '🦉', robot: '🤖' };
  var AVATAR_ORDER = ['girl', 'boy', 'cat', 'dog', 'bear', 'rabbit', 'owl', 'robot'];
  var DEFAULT_AVATAR = 'cat';
  var MAX_MARKERS = 2;
  var SPINE_HALF = 30;
  var ARENA = { w: 260, h: 140 };
  var MARK = { boss: '⚔️', quest: '❗', sparkle: '✨' };
  var WALK_MS = 600;

  // One canvas per grade. Buildings sit in two columns either side of the main road (x = spine), from the gate at the
  // bottom to the boss arena at the top; every walk goes building → main road → building, so no path graph is needed.
  var LAYOUT = {
    grade5: {
      w: 1000, h: 1400, bw: 300, bh: 150, spine: 500, gate: [500, 1350],
      arena: { x: 500, y: 110 }, shop: { x: 230, y: 1210 }, lot: { x: 770, y: 1210 },
      trees: [[150, 1345], [300, 1355], [700, 1355], [850, 1345], [180, 110], [300, 80], [700, 80], [820, 110]],
      apps: {
        'history-explorers': { x: 230, y: 1030, roof: 'peak' },
        'wikaharian': { x: 770, y: 1030, roof: 'dome' },
        'math-mastery': { x: 230, y: 850, roof: 'flat' },
        'page-turners': { x: 770, y: 850, roof: 'peak' },
        'rise-shine': { x: 230, y: 670, roof: 'dome' },
        'rally-ready': { x: 770, y: 670, roof: 'flat' },
        'craft-corner': { x: 230, y: 490, roof: 'peak' },
        'life-lab': { x: 770, y: 490, roof: 'dome' },
        'net-navigators': { x: 230, y: 310, roof: 'flat' },
        'rhythm-hues': { x: 770, y: 310, roof: 'peak' }
      }
    },
    grade2: {
      w: 1000, h: 1260, bw: 320, bh: 160, spine: 500, gate: [500, 1210],
      arena: { x: 500, y: 110 }, shop: { x: 230, y: 1060 }, lot: { x: 770, y: 1060 },
      trees: [[150, 1215], [300, 1220], [700, 1220], [850, 1215], [700, 270], [850, 330], [900, 230], [180, 110], [820, 110]],
      apps: {
        'block-bot': { x: 230, y: 870, roof: 'flat' },
        'kuwentista': { x: 770, y: 870, roof: 'peak' },
        'word-train': { x: 230, y: 680, roof: 'dome' },
        'batang-bayani': { x: 770, y: 680, roof: 'peak' },
        'growing-good': { x: 230, y: 490, roof: 'dome' },
        'byte-buddies': { x: 770, y: 490, roof: 'flat' },
        'science-detectives': { x: 230, y: 300, roof: 'peak' }
      }
    }
  };

  function dueEn(n) { return n + (n === 1 ? ' review question due' : ' review questions due'); }
  function arenaEn(c, n) { return c + ' of ' + n + ' stages cleared'; }
  var TEXT = {
    grade5: {
      campus: '🗺️ Campus', list: '📋 List', mapLabel: 'Campus map',
      pick: 'Pick your buddy!', skip: 'Skip', buddy: 'Your buddy. Tap to change.',
      shop: 'Shop', arena: 'Boss Arena',
      level: ['', 'bronze', 'silver', 'gold'],
      boss: 'boss stage this week', quest: 'quest today', sparkle: 'you can buy a reward',
      due: dueEn, arenaCount: arenaEn, beaten: 'boss beaten', noBoss: 'no boss this week'
    },
    grade2: {
      campus: '🗺️ Bayan', list: '📋 List', mapLabel: 'Mapa ng bayan · Map of the village',
      pick: 'Piliin ang kasama mo! · Pick your buddy!', skip: 'Skip', buddy: 'Your buddy. Tap to change.',
      shop: 'Tindahan · Shop', arena: 'Boss Fort',
      level: ['', 'bronze', 'silver', 'gold'],
      boss: 'boss stage this week', quest: 'quest today', sparkle: 'you can buy a reward',
      due: dueEn, arenaCount: arenaEn, beaten: 'boss beaten', noBoss: 'no boss this week'
    }
  };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function readJson(storage, key) { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } }

  function clean(d) {
    var ok = isObj(d);
    return {
      v: 1,
      avatar: ok && typeof d.avatar === 'string' && has(AVATARS, d.avatar) ? d.avatar : null,
      view: ok && d.view === 'list' ? 'list' : 'campus',
      at: ok && typeof d.at === 'string' && d.at ? d.at : null,
      t: ok && typeof d.t === 'number' ? d.t : 0
    };
  }

  function readState(storage) {
    var d = readJson(storage, KEY);
    return clean(isObj(d) && d.v === 1 ? d : null);
  }

  function saveState(storage, now, patch) {
    var s = readState(storage);
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    try {
      s.t = now();
      storage.setItem(KEY, JSON.stringify(clean(s)));
      return true;
    } catch (e) { return false; }
  }

  function safe(fn, fallback) {
    if (typeof fn !== 'function') return fallback;
    try {
      var v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function tallyOf(c) {
    function n(v) { v = Math.floor(Number(v)); return v > 0 ? v : 0; }
    return isObj(c) ? { gold: n(c.gold), silver: n(c.silver), bronze: n(c.bronze), total: n(c.total) } : { gold: 0, silver: 0, bronze: 0, total: 0 };
  }

  // Like the lobby's Medals list: a game's level is its weakest lesson's medal.
  function levelOf(t) {
    if (!t.total) return 0;
    if (t.gold >= t.total) return 3;
    if (t.gold + t.silver >= t.total) return 2;
    if (t.gold + t.silver + t.bronze >= t.total) return 1;
    return 0;
  }

  function status(apps, deps) {
    deps = deps || {};
    var due = safe(deps.due, {}), quests = safe(deps.quests, []), boss = safe(deps.boss, {});
    if (!isObj(due)) due = {};
    if (!Array.isArray(quests)) quests = [];
    var stages = isObj(boss) && Array.isArray(boss.stages) ? boss.stages.filter(isObj) : [];
    var cleared = stages.filter(function (s) { return s.cleared === true; }).length;
    var out = {
      apps: {},
      shop: { sparkle: safe(deps.canAfford, false) === true },
      arena: { cleared: cleared, total: stages.length, beaten: stages.length > 0 && cleared === stages.length }
    };
    apps.forEach(function (app) {
      var tally = tallyOf(safe(function () { return deps.tally(app); }, null)), markers = [];
      if (stages.some(function (s) { return s.app === app && s.cleared !== true; })) markers.push({ kind: 'boss' });
      if (quests.some(function (q) { return isObj(q) && q.app === app && q.done !== true; })) markers.push({ kind: 'quest' });
      var n = Math.floor(Number(due[app]));
      if (n > 0) markers.push({ kind: 'due', count: n });
      out.apps[app] = { level: levelOf(tally), tally: tally, markers: markers.slice(0, MAX_MARKERS) };
    });
    return out;
  }

  function box(id, x, y, w, h) { return { id: id, x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }; }

  // Every fixed spot on a grade's map as a rectangle, for the layout tests.
  function rects(grade) {
    var L = LAYOUT[grade];
    var out = Object.keys(L.apps).map(function (app) { return box(app, L.apps[app].x, L.apps[app].y, L.bw, L.bh); });
    out.push(box('shop', L.shop.x, L.shop.y, L.bw, L.bh), box('lot', L.lot.x, L.lot.y, L.bw, L.bh),
      box('arena', L.arena.x, L.arena.y, ARENA.w, ARENA.h));
    return out;
  }

  function radius(L) { return Math.round(L.bh * 0.22); }

  // Where the buddy stands by a place: beside it on the road side, near its foot; below the arena.
  function stand(L, p) {
    var r = radius(L), gap = r + 6;
    if (p.x === L.spine) return [L.spine, p.y + p.h / 2 + gap];
    return [p.x < L.spine ? p.x + p.w / 2 + gap : p.x - p.w / 2 - gap, p.y + p.h / 2 - r];
  }

  function route(L, from, to) {
    var out = [];
    [from, [L.spine, from[1]], [L.spine, to[1]], to].forEach(function (p) {
      var last = out[out.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    });
    return out;
  }

  // The point a fraction f (0-1) of the way along the path; every leg is level or upright.
  function pointAt(pts, f) {
    var lens = [], total = 0, i;
    for (i = 1; i < pts.length; i++) {
      lens.push(Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]));
      total += lens[i - 1];
    }
    var d = f * total;
    for (i = 1; i < pts.length; i++) {
      if (d <= lens[i - 1] || i === pts.length - 1) {
        var k = lens[i - 1] ? Math.min(1, d / lens[i - 1]) : 1;
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      }
      d -= lens[i - 1];
    }
    return pts[pts.length - 1];
  }

  function resolveAt(at, list) {
    return at && list.some(function (p) { return p.id === at; }) ? at : 'gate';
  }

  // The places to draw, in order: a building per card, then the shop and the arena. A card with no spot in the
  // layout takes the spare lot; any more than one is left to the List view.
  function places(grade, cards, st, T) {
    var L = LAYOUT[grade], list = [], lotUsed = false;
    cards.forEach(function (c) {
      var spot = L.apps[c.app];
      if (!spot) {
        if (lotUsed) return;
        lotUsed = true;
        spot = L.lot;
      }
      var s = st.apps[c.app] || { level: 0, tally: tallyOf(null), markers: [] };
      list.push({ id: c.app, kind: 'game', x: spot.x, y: spot.y, w: L.bw, h: L.bh, roof: spot.roof || 'flat',
        name: c.name, game: c.game, emoji: c.emoji, accent: c.accent, href: c.href, level: s.level, tally: s.tally, markers: s.markers });
    });
    list.push({ id: 'shop', kind: 'shop', x: L.shop.x, y: L.shop.y, w: L.bw, h: L.bh, roof: 'peak', name: T.shop, emoji: '🛒',
      level: 0, tally: null, markers: st.shop.sparkle ? [{ kind: 'sparkle' }] : [] });
    list.push({ id: 'arena', kind: 'arena', x: L.arena.x, y: L.arena.y, w: ARENA.w, h: ARENA.h, roof: 'flat', name: T.arena, emoji: '🐉',
      level: 0, tally: null, markers: [], arena: st.arena });
    return list;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // Long names are squeezed onto the board instead of spilling past it.
  function svgText(cls, x, y, size, value, max) {
    var v = String(value), squeeze = v.length * size * 0.56 > max ? ' textLength="' + max + '" lengthAdjust="spacingAndGlyphs"' : '';
    return '<text' + (cls ? ' class="' + cls + '"' : '') + ' x="' + x + '" y="' + y + '" font-size="' + size + '"' + squeeze + '>' + esc(v) + '</text>';
  }

  function markText(m) { return m.kind === 'due' ? '🔁' + m.count : MARK[m.kind]; }

  function label(p, T) {
    var parts = [p.game && p.game !== p.name ? p.name + ' (' + p.game + ')' : p.name];
    if (p.kind === 'arena') parts.push(!p.arena.total ? T.noBoss : p.arena.beaten ? T.beaten : T.arenaCount(p.arena.cleared, p.arena.total));
    if (p.level) parts.push(T.level[p.level]);
    p.markers.forEach(function (m) { parts.push(m.kind === 'due' ? T.due(m.count) : T[m.kind]); });
    return parts.join(', ');
  }

  function subLine(p) {
    if (p.kind === 'arena') return p.arena.total ? (p.arena.beaten ? '✅ ' : '') + p.arena.cleared + ' / ' + p.arena.total : '';
    return p.tally && p.tally.total ? '🥇' + p.tally.gold + ' 🥈' + p.tally.silver + ' 🥉' + p.tally.bronze + ' / ' + p.tally.total : '';
  }

  function roofPath(p, top, rh) {
    var l = p.x - p.w / 2 + 8, r = p.x + p.w / 2 - 8, base = top + rh;
    if (p.roof === 'peak') return 'M' + l + ' ' + base + 'L' + p.x + ' ' + top + 'L' + r + ' ' + base + 'Z';
    if (p.roof === 'dome') return 'M' + l + ' ' + base + 'A' + (r - l) / 2 + ' ' + rh + ' 0 0 1 ' + r + ' ' + base + 'Z';
    return 'M' + l + ' ' + (top + rh / 2) + 'H' + r + 'V' + base + 'H' + l + 'Z';
  }

  // A building: roof, body with the card's emoji, a name board with the medal tally, then up to two markers.
  // Bronze adds a flag, Silver a banner, Gold a gold roof and a glow.
  function drawPlace(p, T, target) {
    var top = p.y - p.h / 2, left = p.x - p.w / 2, rh = Math.round(p.h * 0.2), bodyTop = top + rh, bodyH = Math.round(p.h * 0.38);
    var boardTop = bodyTop + bodyH, boardH = p.h - rh - bodyH, font = Math.round(boardH * 0.42), u = Math.round(p.h / 6);
    var sub = subLine(p), beaten = p.arena && p.arena.beaten;
    var s = '<g class="w-place w-' + p.kind + ' w-tier-' + p.level + (beaten ? ' w-beaten' : '') + (p.id === target ? ' w-target' : '') + '" data-place="' + esc(p.id) +
      '" tabindex="0" role="link" aria-label="' + esc(label(p, T)) + '"' + (p.accent ? ' style="--acc:' + esc(p.accent) + '"' : '') + '>';
    if (p.id === target) s += '<rect class="w-ring" x="' + (left - 14) + '" y="' + (top - 14) + '" width="' + (p.w + 28) + '" height="' + (p.h + 28) + '" rx="30"/>';
    if (p.level === 3) s += '<rect class="w-glow" x="' + (left - 10) + '" y="' + (top - 10) + '" width="' + (p.w + 20) + '" height="' + (p.h + 20) + '" rx="28"/>';
    s += '<path class="w-roof' + (p.level === 3 ? ' w-gold' : '') + '" d="' + roofPath(p, top, rh) + '"/>';
    s += '<rect class="w-body" x="' + (left + 8) + '" y="' + bodyTop + '" width="' + (p.w - 16) + '" height="' + bodyH + '" rx="10"/>';
    if (p.level >= 2) s += '<rect class="w-banner" x="' + (left + 20) + '" y="' + (bodyTop + 6) + '" width="' + u + '" height="' + (bodyH - 12) + '" rx="4"/>';
    if (p.level >= 1) {
      var px = Math.round(p.x - p.w * 0.3), py = top - 6;
      s += '<path class="w-pole" d="M' + px + ' ' + bodyTop + 'V' + py + '"/>' +
        '<path class="w-flag" d="M' + px + ' ' + py + 'l' + u + ' ' + u / 2 + 'l' + -u + ' ' + u / 2 + 'Z"/>';
    }
    s += svgText('w-emoji', p.x, bodyTop + bodyH / 2, Math.round(bodyH * 0.62), p.emoji, p.w);
    s += '<rect class="w-board" x="' + left + '" y="' + boardTop + '" width="' + p.w + '" height="' + boardH + '" rx="10"/>';
    s += svgText('w-name', p.x, sub ? boardTop + boardH * 0.32 : boardTop + boardH / 2, font, p.name, p.w - 16);
    if (sub) s += svgText('w-sub', p.x, boardTop + boardH * 0.74, Math.round(font * 0.72), sub, p.w - 16);
    p.markers.forEach(function (m, i) {
      var mw = Math.round(u * 2.4), mh = Math.round(u * 1.4), mx = left + p.w - mw - i * (mw + 6), my = top - Math.round(mh / 2);
      s += '<g class="w-marker w-m-' + m.kind + '" aria-hidden="true"><rect x="' + mx + '" y="' + my + '" width="' + mw + '" height="' + mh +
        '" rx="' + Math.round(mh / 2) + '"/>' + svgText('', mx + mw / 2, my + mh / 2, Math.round(mh * 0.62), markText(m), mw - 8) + '</g>';
    });
    return s + '</g>';
  }

  function drawTree(t) {
    return '<g class="w-tree" aria-hidden="true"><rect x="' + (t[0] - 6) + '" y="' + (t[1] + 16) + '" width="12" height="24"/>' +
      '<circle cx="' + t[0] + '" cy="' + t[1] + '" r="28"/></g>';
  }

  function drawGate(L) {
    var x0 = L.spine - SPINE_HALF - 18, x1 = L.spine + SPINE_HALF + 6, y = L.gate[1] - 46;
    return '<g class="w-gate" aria-hidden="true"><rect x="' + x0 + '" y="' + y + '" width="12" height="66"/>' +
      '<rect x="' + x1 + '" y="' + y + '" width="12" height="66"/>' +
      '<rect x="' + x0 + '" y="' + (y - 12) + '" width="' + (x1 - x0 + 12) + '" height="14" rx="6"/></g>';
  }

  function drawAvatar(spot, avatar, r, T) {
    return '<g class="w-avatar" data-avatar="" tabindex="0" role="button" aria-label="' + esc(T.buddy) + '" transform="translate(' + spot[0] + ' ' + spot[1] + ')">' +
      '<circle r="' + r + '"/>' + svgText('', 0, 0, Math.round(r * 1.2), AVATARS[avatar], r * 2) + '</g>';
  }

  // target: the place the guide points at, drawn with a ring and a lit road from the buddy.
  function draw(grade, list, avatar, at, T, target) {
    var L = LAYOUT[grade], r = radius(L), byId = {};
    list.forEach(function (p) { byId[p.id] = p; });
    var spot = has(byId, at) ? stand(L, byId[at]) : L.gate;
    var s = '<svg class="w-map" viewBox="0 0 ' + L.w + ' ' + L.h + '" role="group" aria-label="' + esc(T.mapLabel) + '">' +
      '<rect class="w-ground" width="' + L.w + '" height="' + L.h + '" rx="40"/>' +
      '<path class="w-road" stroke-width="' + SPINE_HALF * 2 + '" d="M' + L.spine + ' ' + L.gate[1] + 'V' + (L.arena.y + ARENA.h / 2) + '"/>';
    list.forEach(function (p) {
      if (p.kind === 'arena') return;
      var edge = p.x < L.spine ? p.x + p.w / 2 : p.x - p.w / 2;
      s += '<path class="w-road" stroke-width="' + r + '" d="M' + edge + ' ' + stand(L, p)[1] + 'H' + L.spine + '"/>';
    });
    L.trees.forEach(function (t) { s += drawTree(t); });
    s += drawGate(L);
    if (typeof target === 'string' && has(byId, target)) {
      s += '<path class="w-guide-road" d="M' + route(L, spot, stand(L, byId[target])).map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + '"/>';
    }
    list.forEach(function (p) { s += drawPlace(p, T, target); });
    return s + drawAvatar(spot, has(AVATARS, avatar) ? avatar : DEFAULT_AVATAR, r, T) + '</svg>';
  }

  var UI_CSS =
    '.grid[hidden],.campus[hidden],.campus-toggle[hidden]{display:none!important;}' +
    '.campus{position:relative;margin:0 0 16px;}' +
    '.campus-toggle{font:inherit;font-weight:800;cursor:pointer;margin-top:10px;padding:8px 18px;border-radius:999px;' +
      'border:1.5px solid var(--border);background:var(--card);color:var(--ink);}' +
    '.w-map{display:block;width:100%;height:auto;}' +
    '.w-map text{text-anchor:middle;dominant-baseline:central;font-family:inherit;}' +
    '.w-ground{fill:var(--bg-alt);}' +
    '.w-road{fill:none;stroke:var(--ink-soft);stroke-opacity:.22;stroke-linecap:round;}' +
    '.w-tree circle{fill:#5FAF6B;}.w-tree rect{fill:#8A5E3B;}' +
    '.w-gate rect{fill:var(--ink-soft);}' +
    '.w-place,.w-avatar{cursor:pointer;outline:none;}' +
    '.w-place:focus-visible .w-board,.w-avatar:focus-visible circle{stroke:var(--ink);stroke-width:6;}' +
    '.w-roof{fill:var(--acc,var(--ink-soft));}.w-roof.w-gold{fill:#E0A526;}' +
    '.w-body{fill:var(--card);stroke:var(--acc,var(--ink-soft));stroke-width:4;}' +
    '.w-board{fill:var(--card);stroke:var(--acc,var(--border));stroke-width:3;}' +
    '.w-name{fill:var(--ink);font-weight:800;}.w-sub{fill:var(--ink-soft);font-weight:700;}' +
    '.w-pole{stroke:var(--ink-soft);stroke-width:4;}' +
    '.w-flag{fill:#C9772B;}.w-tier-2 .w-flag{fill:#9AA4AE;}.w-tier-3 .w-flag{fill:#E0A526;}' +
    '.w-banner{fill:var(--acc,var(--ink-soft));opacity:.55;}' +
    '.w-glow{fill:#F6D36B;opacity:.35;}' +
    '.w-marker rect{fill:var(--card);stroke:var(--ink);stroke-width:3;}.w-marker text{fill:var(--ink);font-weight:800;}' +
    '.w-m-boss rect{fill:#F3ECFF;stroke:#7C4DDB;}.w-m-sparkle rect{fill:var(--gold-soft);stroke:var(--gold-deep);}' +
    '.w-arena .w-roof{fill:#7C4DDB;}.w-arena .w-body{stroke:#7C4DDB;}.w-shop .w-roof{fill:var(--gold-deep);}' +
    '.w-beaten{opacity:.55;filter:grayscale(1);}' +
    '.w-guide-road{fill:none;stroke:var(--header-accent);stroke-width:14;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:2 26;opacity:.85;}' +
    '.w-ring{fill:none;stroke:var(--header-accent);stroke-width:8;animation:w-pulse 1.6s ease-in-out infinite;}' +
    '@keyframes w-pulse{0%,100%{opacity:.25;}50%{opacity:.9;}}' +
    '@media (prefers-reduced-motion:reduce){.w-ring{animation:none;opacity:.7;}}' +
    '#campus-guide:empty{display:none;}' +
    '.w-avatar circle{fill:var(--card);stroke:var(--header-accent);stroke-width:5;}' +
    '.w-picker{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:14px;' +
      'padding:24px 16px 16px;background:var(--card);border:1.5px solid var(--border);border-radius:20px;}' +
    '.w-picker[hidden]{display:none;}' +
    '.w-pick-title{margin:0;font-weight:800;font-size:1.2rem;text-align:center;}' +
    '.w-pick-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;width:100%;max-width:420px;}' +
    '.w-pick-grid button{font-size:2.2rem;padding:10px 0;border-radius:16px;border:1.5px solid var(--border);background:var(--bg-alt);cursor:pointer;}' +
    '.w-pick-grid button[aria-pressed="true"]{border:3px solid var(--header-accent);}' +
    '.w-skip{font:inherit;font-weight:800;padding:8px 18px;border-radius:12px;border:0;background:var(--bg-alt);color:var(--ink);cursor:pointer;}';

  function pickerHtml(T, current) {
    var s = '<div class="w-picker" hidden role="dialog" aria-label="' + esc(T.pick) + '"><p class="w-pick-title">' + esc(T.pick) + '</p><div class="w-pick-grid">';
    AVATAR_ORDER.forEach(function (id) {
      s += '<button type="button" data-pick="' + id + '" aria-label="' + id + '" aria-pressed="' + (id === current) + '">' + AVATARS[id] + '</button>';
    });
    return s + '</div><button type="button" class="w-skip">' + esc(T.skip) + '</button></div>';
  }

  function cardsOf(grid) {
    return Array.prototype.map.call(grid.querySelectorAll('.subject-card[data-app]'), function (c) {
      function textOf(sel) { var e = c.querySelector(sel); return e ? e.textContent.trim() : ''; }
      return {
        app: c.getAttribute('data-app'),
        name: textOf('.subject-title') || textOf('.subject-app') || c.getAttribute('data-app'),
        game: textOf('.subject-app'),
        emoji: textOf('.subject-emoji'),
        accent: c.style.getPropertyValue('--card-accent').trim(),
        href: c.getAttribute('href')
      };
    });
  }

  function mountUi(win, grade, storage, deps) {
    var doc = win.document, T = forGrade(grade, TEXT[grade]), L = LAYOUT[grade], api = {}, walking = null, asked = false;
    if (grade === 'grade2' && root.Lang && !root.Lang.both()) T.campus = '🗺️ Village';
    var style = doc.createElement('style');
    style.textContent = UI_CSS;
    (doc.head || doc.documentElement).appendChild(style);
    if (win.Guide && win.Guide.addStyle) win.Guide.addStyle(doc);

    function reduced() {
      try { return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }
    function put(el, pt) { el.setAttribute('transform', 'translate(' + pt[0] + ' ' + pt[1] + ')'); }

    // Moves the buddy along the path, then calls done once; finish() jumps to the end.
    function walk(el, pts, ms, done) {
      var start = null, over = false, frame = null;
      var ask = win.requestAnimationFrame ? function (f) { return win.requestAnimationFrame(f); } : function (f) { return win.setTimeout(function () { f(Date.now()); }, 16); };
      var drop = win.cancelAnimationFrame ? function (id) { win.cancelAnimationFrame(id); } : function (id) { win.clearTimeout(id); };
      function stop() { over = true; if (frame !== null) drop(frame); }
      function finish() {
        if (over) return;
        stop();
        put(el, pts[pts.length - 1]);
        done();
      }
      frame = ask(function step(t) {
        if (over) return;
        if (start === null) start = t;
        var f = Math.min(1, (t - start) / ms);
        put(el, pointAt(pts, f));
        if (f < 1) frame = ask(step);
        else finish();
      });
      return { finish: finish };
    }

    api.text = T;
    api.walkMs = WALK_MS;
    api.navigate = function (href) { win.location.href = href; };

    // Draws the map into box and hides the cards (or the reverse, in List view). Safe to call again: it replaces
    // its own SVG. If anything fails, the cards stay as they were.
    api.mount = function (box, grid, toggle) {
      if (!box || !grid) return false;
      if (walking) walking.finish();
      var list, state, at, cards, step = null, target = null, wasOpen = false;
      try {
        var old = box.querySelector('.w-picker');
        wasOpen = !!(old && !old.hidden);
        cards = cardsOf(grid);
        state = readState(storage);
        list = places(grade, cards, status(cards.map(function (c) { return c.app; }), deps), T);
        at = resolveAt(state.at, list);
        step = safe(function () { return deps.guide(cards); }, null);
        target = step ? (step.shop === true ? 'shop' : step.app) : null;
        box.innerHTML = draw(grade, list, state.avatar || DEFAULT_AVATAR, at, T, target) + pickerHtml(T, state.avatar);
      } catch (e) {
        box.innerHTML = '';
        box.hidden = true;
        grid.hidden = false;
        if (toggle) toggle.hidden = true;
        var gone = doc.getElementById('campus-guide');
        if (gone) gone.innerHTML = '';
        return false;
      }
      var svg = box.querySelector('.w-map'), buddy = box.querySelector('.w-avatar'), picker = box.querySelector('.w-picker');

      function find(id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
      function spot(id) { var p = find(id); return p ? stand(L, p) : L.gate; }
      function act(p, href) {
        if (p.kind === 'game') return api.navigate(href || p.href);
        if (p.kind === 'shop') {
          var b = doc.getElementById('shop-open');
          if (b) b.click();
          return;
        }
        var boss = doc.getElementById('boss');
        if (boss && boss.scrollIntoView) boss.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }
      function go(id, href) {
        if (walking) return walking.finish();
        var p = find(id);
        if (!p) return;
        var path = route(L, spot(at), stand(L, p));
        at = id;
        saveState(storage, deps.now, { at: id });
        if (reduced() || !(api.walkMs > 0)) {
          put(buddy, path[path.length - 1]);
          return act(p, href);
        }
        walking = walk(buddy, path, api.walkMs, function () { walking = null; act(p, href); });
      }
      function openPicker(focus) {
        picker.hidden = false;
        var first = picker.querySelector('button');
        if (focus && first) first.focus();
      }
      function activate(target) {
        if (!target || !target.closest) return;
        if (target.closest('.w-avatar')) return openPicker(true);
        var g = target.closest('[data-place]');
        if (g) go(g.getAttribute('data-place'));
      }

      // The bubble sits above the map and stays in List view. Go walks the buddy there on the map, or just goes in List view.
      function showGuide() {
        var G = win.Guide, slot = doc.getElementById('campus-guide');
        if (!step || !G || !G.html) { if (slot) slot.innerHTML = ''; return; }
        if (!slot) {
          slot = doc.createElement('div');
          slot.id = 'campus-guide';
          box.parentNode.insertBefore(slot, box);
        }
        var href = G.link(step, cards), shop = step.shop === true;
        slot.innerHTML = G.html(step, !!href || shop);
        var b = slot.querySelector('.g-go');
        if (!b) return;
        b.addEventListener('click', function () {
          if (!box.hidden && target && find(target)) return go(target, href);
          if (shop) { var open = doc.getElementById('shop-open'); if (open) open.click(); return; }
          if (href) api.navigate(href);
        });
      }

      svg.addEventListener('click', function (e) { activate(e.target); });
      svg.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activate(e.target);
      });
      picker.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var pick = b.getAttribute('data-pick');
        saveState(storage, deps.now, { avatar: pick || state.avatar || DEFAULT_AVATAR });
        picker.hidden = true;
        if (pick) return api.mount(box, grid, toggle);
        buddy.focus();
      });
      picker.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { picker.hidden = true; buddy.focus(); }
      });

      showGuide();
      var campus = state.view !== 'list';
      box.hidden = !campus;
      grid.hidden = campus;
      if (toggle) {
        toggle.textContent = campus ? T.list : T.campus;
        toggle.hidden = false;
        if (!toggle.getAttribute('data-wired')) {
          toggle.setAttribute('data-wired', '1');
          toggle.addEventListener('click', function () {
            saveState(storage, deps.now, { view: readState(storage).view === 'list' ? 'campus' : 'list' });
            api.mount(box, grid, toggle);
          });
        }
      }
      if (campus && (wasOpen || (!state.avatar && !asked))) {
        asked = true;
        openPicker(false);
      }
      try { doc.dispatchEvent(new win.CustomEvent('world-drawn', { detail: { box: box } })); } catch (e) {}
      return true;
    };
    return api;
  }

  // Where a live page reads her progress: the lobby's 2D map and the 3D world (web/world/) both use this.
  function liveDeps(win) {
    return {
      now: Date.now,
      tally: function (app) { var M = win.Mastery; return M && M.summary && M.counts ? M.counts(M.summary().apps[app]) : null; },
      due: function () { return win.Recall && win.Recall.dueByApp ? win.Recall.dueByApp() : {}; },
      quests: function () {
        var Q = win.Quests, G = win.Guide;
        if (!Q || !Q.state) return [];
        var st = Q.state();
        return G && G.todayQuests ? G.todayQuests(st, Date.now()) : st.list;
      },
      boss: function () { return win.Boss && win.Boss.current ? win.Boss.current() : {}; },
      canAfford: function () { var Wa = win.Wallet; return !!(Wa && Wa.canAfford && Wa.canAfford()); },
      guide: function (cards) {
        var G = win.Guide, Wa = win.Wallet;
        return G && G.step ? G.step(cards, { canAfford: !!(Wa && Wa.canAfford && Wa.canAfford()) }) : null;
      }
    };
  }

  var exported = { readState: readState, saveState: saveState, status: status, liveDeps: liveDeps, levelOf: levelOf, rects: rects, radius: radius,
    stand: stand, route: route, pointAt: pointAt, resolveAt: resolveAt, places: places, draw: draw, esc: esc, svgText: svgText,
    LAYOUT: LAYOUT, TEXT: TEXT, KEY: KEY, AVATARS: AVATARS, AVATAR_ORDER: AVATAR_ORDER, DEFAULT_AVATAR: DEFAULT_AVATAR, MAX_MARKERS: MAX_MARKERS, SPINE_HALF: SPINE_HALF };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  // Lobbies get the map for their grade; a page without data-grade gets only the pure helpers.
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = {};
    if (grade && LAYOUT[grade]) {
      var storage = root.Learner ? root.Learner.storage : root.localStorage;
      api = mountUi(root, grade, storage, liveDeps(root));
    }
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.World = api;
  } catch (e) {}
})(this);
