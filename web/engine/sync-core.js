/* Cloud sync rules (phase 5b). Merges one learner's space with the cloud through a small `remote` interface:
   cloud.js gives the Firebase one, the tests give an in-memory one. The device stays the main copy.
   Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var STATE = 'sync_state_v1';
  var LOCAL_ONLY = /^(sync_|last_backup_v1$|history_error_v1$|history_corrupt_v1_|family_peek_v1$|world3d_device_v1$)/;
  var POINTS = /_points_v1$/;
  var CHEERS_TOTAL = 'cheers_sent_total';
  var PROGRESS = /_progress_v\d+$/;
  var PROGRESS_DAY = /_progress_v\d+_day$/;
  var WALLET_COUNTERS = ['spent', 'bonus'];
  var REQUEST_STEP = { waiting: 0, approved: 1, declined: 1, done: 2, cancelled: 2, short: 2 };
  var REQUESTS_KEEP_MS = 7 * 86400000;
  var PRACTICE_KEEP_MS = 56 * 86400000;
  var FAMILY_NEWS = 20;
  var FAMILY_SENT_MS = 7 * 86400000;
  // Kinds whose value is saved as JSON under its own key.
  var JSON_KINDS = { recall: true, review: true, quests: true, boss: true, mastery: true, profile: true, requests: true, practice: true, family: true, familySeen: true, wardrobe: true, house: true };

  function json(text, fallback) {
    try { var v = JSON.parse(text); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; }
  }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function dayNum(d) {
    var p = String(d || '').split('-');
    return p.length === 3 ? Number(p[0]) * 10000 + Number(p[1]) * 100 + Number(p[2]) : 0;
  }
  // A cheap fingerprint, so an entry is only sent again when it changed.
  function stamp(entry) {
    var s = JSON.stringify(entry), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return s.length + ':' + h;
  }

  function kindOf(key) {
    if (LOCAL_ONLY.test(key)) return null;
    if (POINTS.test(key) || key === CHEERS_TOTAL) return 'counter';
    if (key === 'wallet_v1') return 'wallet';
    if (key === 'recall_v1') return 'recall';
    if (key === 'review_v1') return 'review';
    if (key === 'mastery_v1') return 'mastery';
    if (key === 'quests_v1') return 'quests';
    if (key === 'boss_v1') return 'boss';
    if (key === 'history_v1') return 'history';
    if (key === 'profile_v1') return 'profile';
    if (key === 'coin_guide_seen_v1') return 'flag';
    if (key === 'shop_requests_v1') return 'requests';
    if (key === 'practice_v1') return 'practice';
    if (key === 'family_v1') return 'family';
    if (key === 'family_seen_v1') return 'familySeen';
    if (key === 'wardrobe_v1') return 'wardrobe';
    if (key === 'house_v1') return 'house';
    if (PROGRESS.test(key) || PROGRESS_DAY.test(key)) return 'progress';
    return 'replace';
  }

  // Merge rules: a = this device, b = the cloud; either may be null. Each is safe to repeat and gives the same
  // answer in either order, so devices agree whichever syncs first.
  // A full tie goes to a deletion, then to a review start mark, so either merge order agrees.
  function reviewRank(it) { return it.gone ? 2 : it.started ? 1 : 0; }
  function reviewNewer(it, have) {
    if (it.t !== have.t) return it.t > have.t;
    if (it.box !== have.box) return it.box > have.box;
    if (dayNum(it.due) !== dayNum(have.due)) return dayNum(it.due) > dayNum(have.due);
    return reviewRank(it) > reviewRank(have);
  }

  // What a medal entry shows apart from best and paid; it breaks a tie between two writes at the same time.
  function masteryView(e) {
    return JSON.stringify([e.order, Object.keys(e.lessons).filter(function (k) { return isObj(e.lessons[k]); })
      .map(function (k) { var l = e.lessons[k]; return [k, l.title, l.icon, l.now]; })]);
  }
  function medalLevel(v) { var n = Math.floor(Number(v)); return n >= 1 ? Math.min(n, 3) : 0; }
  function ownLesson(e, k) { return Object.prototype.hasOwnProperty.call(e.lessons, k) && isObj(e.lessons[k]) ? e.lessons[k] : null; }
  function masteryApp(newer, older) {
    var lessons = {};
    Object.keys(newer.lessons).concat(older ? Object.keys(older.lessons) : []).forEach(function (k) {
      var l = ownLesson(newer, k), o = older ? ownLesson(older, k) : null, base = l || o;
      if (!base || Object.prototype.hasOwnProperty.call(lessons, k)) return;
      lessons[k] = { title: base.title, icon: base.icon, now: base.now,
        best: Math.max(medalLevel(l && l.best), medalLevel(o && o.best)), paid: Math.max(medalLevel(l && l.paid), medalLevel(o && o.paid)) };
    });
    return { t: newer.t, order: newer.order, lessons: lessons };
  }

  function union(x, y, keep) {
    var seen = {}, out = [];
    (Array.isArray(x) ? x : []).concat(Array.isArray(y) ? y : []).forEach(function (s) { if (typeof s === 'string' && !seen[s]) { seen[s] = true; out.push(s); } });
    out.sort();
    return keep ? out.slice(-keep) : out;
  }
  function paidDayOf(x, y) {
    x = typeof x === 'string' ? x : '';
    y = typeof y === 'string' ? y : '';
    if (dnum(x) !== dnum(y)) return dnum(x) > dnum(y) ? x : y;
    return x > y ? x : y;
  }
  function dnum(d) { return dayNum(d) || 0; }
  function questIds(q) { return JSON.stringify((q.list || []).map(function (x) { return x && x.id; })); }

  function bossStages(v) {
    return (Array.isArray(v) ? v : []).filter(function (s) { return isObj(s) && typeof s.app === 'string'; })
      .map(function (s) { return { app: s.app, title: typeof s.title === 'string' ? s.title : s.app, cleared: s.cleared === true }; });
  }
  function bossCleared(list) { return list.filter(function (s) { return s.cleared; }).length; }
  function bossApps(list) { return JSON.stringify(list.map(function (s) { return s.app; })); }

  // Family news and sent cheers: one list per id from both copies, newest first; the same id is the same entry.
  function familyList(x, y) {
    var byId = {};
    [x, y].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (e) {
        if (!isObj(e) || typeof e.id !== 'string' || typeof e.t !== 'number' || !isFinite(e.t)) return;
        var have = byId[e.id];
        if (!have || JSON.stringify(e) > JSON.stringify(have)) byId[e.id] = e;
      });
    });
    return Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (p, q) { return q.t - p.t || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0); });
  }

  function houseCount(x) { var n = Math.floor(Number(isObj(x) ? x.deskRight : 0)); return n > 0 && isFinite(n) ? n : 0; }
  function laterPart(a, b, k) {
    var x = isObj(a) && isObj(a[k]) ? a[k] : null, y = isObj(b) && isObj(b[k]) ? b[k] : null;
    if (!x || !y) return x || y;
    var tx = Number(x.at) || 0, ty = Number(y.at) || 0;
    if (tx !== ty) return tx > ty ? x : y;
    return JSON.stringify(x) >= JSON.stringify(y) ? x : y;
  }

  var MERGE = {
    // Wardrobe: what she owns only grows; each item keeps its earliest buy. Ids are sorted so both orders give one text.
    wardrobe: function (a, b) {
      if (!isObj(a) && !isObj(b)) return null;
      var owned = {};
      [a, b].forEach(function (x) {
        var o = isObj(x) && isObj(x.owned) ? x.owned : {};
        Object.keys(o).forEach(function (id) {
          var e = o[id];
          if (!isObj(e) || !(Number(e.t) > 0)) return;
          var t = Number(e.t), coins = Number(e.coins) || 0, have = owned[id];
          if (!have || t < have.t || (t === have.t && coins > have.coins)) owned[id] = { t: t, coins: coins };
        });
      });
      var sorted = {};
      Object.keys(owned).sort().forEach(function (id) { sorted[id] = owned[id]; });
      return { v: 1, owned: sorted };
    },
    // My Little House: bought pieces as wardrobe, earned pieces keep their earliest time, the larger desk count; the
    // room and what she saw come from the side saved later (on a tie the larger text), so both orders agree.
    house: function (a, b) {
      if (!isObj(a) && !isObj(b)) return null;
      var owned = MERGE.wardrobe(a, b).owned, earned = {}, sorted = {};
      [a, b].forEach(function (x) {
        var o = isObj(x) && isObj(x.earned) ? x.earned : {};
        Object.keys(o).forEach(function (id) {
          var t = Number(o[id]);
          if (t > 0 && isFinite(t) && !(earned[id] <= t)) earned[id] = t;
        });
      });
      Object.keys(earned).sort().forEach(function (id) { sorted[id] = earned[id]; });
      return {
        v: 1, owned: owned, earned: sorted,
        deskRight: Math.max(houseCount(a), houseCount(b)),
        room: laterPart(a, b, 'room'),
        seen: laterPart(a, b, 'seen')
      };
    },
    // Family presence: news and cheers sent join by id (the last 20 news; cheers until a week before the newest), at only goes up.
    family: function (a, b) {
      a = isObj(a) ? a : null;
      b = isObj(b) ? b : null;
      if (!a || !b) return a || b;
      var sent = familyList(a.sent, b.sent), newest = sent.length ? sent[0].t : 0;
      return {
        v: 1,
        at: Math.max(Number(a.at) || 0, Number(b.at) || 0),
        news: familyList(a.news, b.news).slice(0, FAMILY_NEWS),
        sent: sent.filter(function (s) { return s.t >= newest - FAMILY_SENT_MS; })
      };
    },
    // What she has already been shown: the later time wins, per sister for news.
    familySeen: function (a, b) {
      if (!isObj(a) && !isObj(b)) return null;
      var news = {};
      [a, b].forEach(function (x) {
        if (!isObj(x) || !isObj(x.news)) return;
        Object.keys(x.news).forEach(function (k) { var v = Number(x.news[k]) || 0; if (!(news[k] >= v)) news[k] = v; });
      });
      return { cheers: Math.max(isObj(a) ? Number(a.cheers) || 0 : 0, isObj(b) ? Number(b.cheers) || 0 : 0), news: news };
    },
    // Review boxes: per question the later answer wins; at the same time the higher box, then the later due day.
    review: function (a, b) {
      var items = {};
      [a, b].forEach(function (x) {
        if (!x || !isObj(x.items)) return;
        Object.keys(x.items).forEach(function (k) {
          var it = x.items[k], have = items[k];
          if (!isObj(it) || typeof it.t !== 'number' || !isFinite(it.t) || !(it.box >= 1 && it.box <= 5) || !dayNum(it.due)) return;
          if (!have || reviewNewer(it, have)) items[k] = it;
        });
      });
      return { v: 1, items: items };
    },
    // Medals: per app the newer write gives the lessons, titles and current levels; best and paid only go up.
    mastery: function (a, b) {
      var apps = {};
      [a, b].forEach(function (x) {
        if (!x || !isObj(x.apps)) return;
        Object.keys(x.apps).forEach(function (id) {
          var e = x.apps[id], have = apps[id];
          if (!isObj(e) || !isObj(e.lessons) || typeof e.t !== 'number' || !isFinite(e.t)) return;
          if (!have) { apps[id] = masteryApp(e, null); return; }
          var eNewer = e.t !== have.t ? e.t > have.t : masteryView(e) > masteryView(have);
          apps[id] = eNewer ? masteryApp(e, have) : masteryApp(have, e);
        });
      });
      return { v: 1, apps: apps };
    },
    // Daily quests: the later day's list wins; on the same day the first pick is kept and a quest done anywhere is done.
    // Study days and paid streak milestones add up; the all-3 bonus day is the later one.
    quests: function (a, b) {
      a = isObj(a) ? a : null;
      b = isObj(b) ? b : null;
      if (!a || !b) return a || b;
      var keep;
      if (dnum(a.day) !== dnum(b.day)) keep = dnum(a.day) > dnum(b.day) ? a : b;
      else if ((Number(a.at) || 0) !== (Number(b.at) || 0)) keep = (Number(a.at) || 0) < (Number(b.at) || 0) ? a : b;
      else keep = questIds(a) <= questIds(b) ? a : b;
      var other = keep === a ? b : a, sameDay = dnum(a.day) === dnum(b.day), doneThere = {};
      if (sameDay) (Array.isArray(other.list) ? other.list : []).forEach(function (q) { if (q && q.done) doneThere[q.id] = true; });
      var list = (Array.isArray(keep.list) ? keep.list : []).filter(isObj).map(function (q) {
        var c = {};
        Object.keys(q).forEach(function (k) { c[k] = q[k]; });
        c.done = !!(q.done || doneThere[q.id]);
        return c;
      });
      return {
        v: 1, day: sameDay ? paidDayOf(a.day, b.day) : (typeof keep.day === 'string' ? keep.day : ''), at: Number(keep.at) || 0, list: list,
        days: union(a.days, b.days, 400),
        paidDay: paidDayOf(a.paidDay, b.paidDay),
        streakPaid: union(a.streakPaid, b.streakPaid)
      };
    },
    // Weekly boss: the later week wins. In one week a picked list beats an empty one, then the list with more
    // cleared stages, then the smaller app list. A stage cleared on either copy is cleared, and pay marks add up.
    boss: function (a, b) {
      a = isObj(a) ? a : null;
      b = isObj(b) ? b : null;
      if (!a || !b) return a || b;
      var paid = union(a.paid, b.paid, 60), week = paidDayOf(a.week, b.week);
      if (dnum(a.week) !== dnum(b.week)) {
        return { v: 1, week: week, stages: bossStages((dnum(a.week) > dnum(b.week) ? a : b).stages), paid: paid };
      }
      var sa = bossStages(a.stages), sb = bossStages(b.stages), keep;
      if (!sa.length || !sb.length) keep = sa.length ? sa : sb;
      else if (bossCleared(sa) !== bossCleared(sb)) keep = bossCleared(sa) > bossCleared(sb) ? sa : sb;
      else if (bossApps(sa) !== bossApps(sb)) keep = bossApps(sa) < bossApps(sb) ? sa : sb;
      else keep = JSON.stringify(sa) <= JSON.stringify(sb) ? sa : sb;
      var done = {};
      (keep === sa ? sb : sa).forEach(function (s) { if (s.cleared) done[s.app] = true; });
      return { v: 1, week: week, stages: keep.map(function (s) {
        return { app: s.app, title: s.title, cleared: s.cleared || !!done[s.app] };
      }), paid: paid };
    },
    recall: function (a, b) {
      var rest = {};
      [a, b].forEach(function (x) {
        if (!x || !isObj(x.rest)) return;
        Object.keys(x.rest).forEach(function (q) { if (!rest[q] || dayNum(x.rest[q]) > dayNum(rest[q])) rest[q] = x.rest[q]; });
      });
      return Object.assign({}, b || {}, a || {}, { v: 1, rest: rest });
    },
    // Stars reset each day: the same day keeps the best per lesson, a newer day replaces an older one.
    progress: function (a, b) {
      if (!a || !b) return a || b;
      var da = dayNum(a.day), db = dayNum(b.day);
      if (da !== db) return da > db ? a : b;
      var stars = Object.assign({}, b.stars);
      Object.keys(a.stars || {}).forEach(function (k) { stars[k] = Math.max(Number(stars[k]) || 0, Number(a.stars[k]) || 0); });
      return { day: a.day, stars: stars };
    },
    // The wallet minus its two counters: a subject's baseline is set once, purchases are kept from both.
    wallet: function (a, b) {
      a = a || {}; b = b || {};
      var baselines = Object.assign({}, a.baselines || {}, b.baselines || {});
      var seen = {}, purchases = [];
      (a.purchases || []).concat(b.purchases || []).forEach(function (p) {
        var k = p && p.t + '|' + p.item;
        if (p && !seen[k]) { seen[k] = true; purchases.push(p); }
      });
      purchases.sort(function (x, y) { return x.t - y.t; });
      var rateFrom = null;
      [a.rateFrom, b.rateFrom].forEach(function (rf) {
        if (!isObj(rf)) return;
        rateFrom = rateFrom || {};
        Object.keys(rf).forEach(function (k) {
          var v = Number(rf[k]) || 0;
          if (!Object.prototype.hasOwnProperty.call(rateFrom, k) || v > rateFrom[k]) rateFrom[k] = v;
        });
      });
      return { baselines: baselines, purchases: purchases, oldPointsCounted: a.oldPointsCounted === true || b.oldPointsCounted === true, rateFrom: rateFrom };
    },
    // Name, emoji and boy: the latest change wins. Grade: the higher wins (moving up never goes back).
    profile: function (a, b) {
      if (!a || !b) return a || b;
      var newer = (Number(a.at) || 0) >= (Number(b.at) || 0) ? a : b;
      var out = { name: newer.name, emoji: newer.emoji, grade: Math.max(Number(a.grade) || 0, Number(b.grade) || 0), at: newer.at || 0 };
      if (newer.boy === true) out.boy = true;
      return out;
    },
    // Shop requests: per request, the copy further along wins (waiting, then an answer, then the tablet's result),
    // then the later change. Requests asked a week before the newest one are dropped, the same on every device.
    requests: function (a, b) {
      var la = (a && a.list) || {}, lb = (b && b.list) || {}, list = {}, newest = 0;
      function pick(x, y) {
        if (!x || !y) return x || y;
        var sx = REQUEST_STEP[x.status] || 0, sy = REQUEST_STEP[y.status] || 0;
        if (sx !== sy) return sx > sy ? x : y;
        if ((Number(x.at) || 0) !== (Number(y.at) || 0)) return (Number(x.at) || 0) > (Number(y.at) || 0) ? x : y;
        return String(x.status) >= String(y.status) ? x : y;
      }
      Object.keys(la).concat(Object.keys(lb)).forEach(function (id) {
        list[id] = pick(la[id], lb[id]);
        newest = Math.max(newest, Number(list[id].t) || 0);
      });
      Object.keys(list).forEach(function (id) { if ((Number(list[id].t) || 0) < newest - REQUESTS_KEEP_MS) delete list[id]; });
      return { v: 1, list: list };
    },
    // Practice these sends: the union by id (copies of one send are the same; the greater JSON wins so either
    // order agrees). Sends 8 weeks older than the newest are dropped.
    practice: function (a, b) {
      var all = {}, sends = {}, newest = -Infinity;
      [a, b].forEach(function (x) {
        var src = isObj(x) && isObj(x.sends) ? x.sends : {};
        Object.keys(src).forEach(function (id) {
          var it = src[id];
          if (id === '__proto__' || !isObj(it) || typeof it.t !== 'number' || !isFinite(it.t) || typeof it.app !== 'string' || !Array.isArray(it.keys)) return;
          if (!all[id] || JSON.stringify(it) > JSON.stringify(all[id])) all[id] = it;
        });
      });
      Object.keys(all).forEach(function (id) { newest = Math.max(newest, all[id].t); });
      Object.keys(all).sort().forEach(function (id) { if (all[id].t >= newest - PRACTICE_KEEP_MS) sends[id] = all[id]; });
      return { v: 1, sends: sends };
    },
    flag: function (a, b) { return a === '1' || b === '1' ? '1' : (a !== null && a !== undefined ? a : b); },
    replace: function (a, b) { return a !== null && a !== undefined ? a : b; }
  };

  // opts.historyFrom (ms): pull only history changed since then; loadOlder() fetches the rest once.
  function create(space, remote, id, opts) {
    var historyFrom = opts && Number(opts.historyFrom) > 0 ? Number(opts.historyFrom) : 0;
    var st = json(space.getItem(STATE), {});
    st.counters = isObj(st.counters) ? st.counters : {};
    st.known = isObj(st.known) ? st.known : {};
    st.lastPull = Number(st.lastPull) || 0;
    function saveState() { space.put(STATE, JSON.stringify(st)); }

    // ---- reading and writing this device's values, one shape per kind ----
    function progressBase(key) { return PROGRESS_DAY.test(key) ? key.replace(/_day$/, '') : key; }
    function readLocal(kind, key) {
      if (kind === 'progress') {
        var stars = json(space.getItem(key), null), day = space.getItem(key + '_day');
        return stars || day ? { day: day, stars: stars || {} } : null;
      }
      if (kind === 'wallet') {
        var w = json(space.getItem('wallet_v1'), null);
        return w ? { baselines: w.baselines || {}, purchases: w.purchases || [], oldPointsCounted: w.oldPointsCounted === true, rateFrom: w.rateFrom || null } : null;
      }
      if (JSON_KINDS[kind]) return json(space.getItem(key), null);
      return space.getItem(key);
    }
    function writeLocal(kind, key, value) {
      if (value === null || value === undefined) return;
      if (kind === 'progress') {
        space.put(key, JSON.stringify(value.stars || {}));
        if (value.day) space.put(key + '_day', value.day);
      } else if (kind === 'wallet') {
        var w = json(space.getItem('wallet_v1'), { v: 1, spent: 0, bonus: 0 });
        w.v = 1;
        w.baselines = value.baselines;
        w.purchases = value.purchases;
        w.oldPointsCounted = value.oldPointsCounted;
        w.rateFrom = value.rateFrom || null;
        space.put('wallet_v1', JSON.stringify(w));
      } else if (JSON_KINDS[kind]) {
        space.put(key, JSON.stringify(value));
      } else {
        space.put(key, String(value));
      }
    }

    // ---- counters: points per subject, and the wallet's spent and bonus ----
    function counterKeys() {
      var keys = space.keys().filter(function (k) { return POINTS.test(k) || k === CHEERS_TOTAL; });
      if (space.getItem('wallet_v1') !== null) WALLET_COUNTERS.forEach(function (f) { keys.push('wallet.' + f); });
      return keys;
    }
    function readCounter(key) {
      if (key.indexOf('wallet.') === 0) return Number(json(space.getItem('wallet_v1'), {})[key.slice(7)]) || 0;
      return parseInt(space.getItem(key), 10) || 0;
    }
    function addToCounter(key, diff) {
      if (!diff) return;
      if (key.indexOf('wallet.') === 0) {
        var w = json(space.getItem('wallet_v1'), { v: 1, baselines: {}, purchases: [] });
        w[key.slice(7)] = (Number(w[key.slice(7)]) || 0) + diff;
        space.put('wallet_v1', JSON.stringify(w));
      } else {
        space.put(key, String(readCounter(key) + diff));
      }
    }

    // ---- history: one cloud doc per entry ----
    function readHistory() { return json(space.getItem('history_v1'), { v: 1, entries: [] }); }
    function writeHistory(h) {
      h.entries.sort(function (a, b) { return (a.t || 0) - (b.t || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
      space.put('history_v1', JSON.stringify({ v: 1, entries: h.entries }));
    }

    function applyHistory(list) {
      var h = readHistory(), byId = {};
      h.entries.forEach(function (e, i) { byId[e.id] = i; });
      list.forEach(function (d) {
        // A change made here and not sent yet wins: entries are only edited on the device that made them.
        var mine = byId[d.id] !== undefined ? h.entries[byId[d.id]] : null;
        if (mine && stamp(mine) !== st.known[d.id]) return;
        if (d.entry) {
          if (byId[d.id] === undefined) { byId[d.id] = h.entries.length; h.entries.push(d.entry); } else h.entries[byId[d.id]] = d.entry;
          st.known[d.id] = stamp(d.entry);
        } else if (byId[d.id] !== undefined) {
          h.entries[byId[d.id]] = null;
          delete st.known[d.id];
        } else {
          delete st.known[d.id];
        }
      });
      h.entries = h.entries.filter(Boolean);
      writeHistory(h);
    }

    function pull(since) {
      return (historyFrom ? remote.pull(id, since, historyFrom) : remote.pull(id, since)).then(function (p) {
        var pending = space.outbox();
        (p.state || []).forEach(function (d) {
          var kind = kindOf(d.key);
          if (!kind || kind === 'counter' || kind === 'history') return;
          if (kind === 'replace' && pending[d.key]) return;
          var key = kind === 'progress' ? progressBase(d.key) : d.key;
          writeLocal(kind, key, (MERGE[kind] || MERGE.replace)(readLocal(kind, key), d.value));
        });
        (p.counters || []).forEach(function (d) {
          var last = Number(st.counters[d.key]) || 0;
          addToCounter(d.key, d.total - last);
          st.counters[d.key] = d.total;
        });
        if ((p.history || []).length) applyHistory(p.history);
        st.lastPull = Math.max(st.lastPull, Number(p.until) || 0);
        saveState();
      });
    }

    function pushCounters() {
      return counterKeys().reduce(function (chain, key) {
        return chain.then(function () {
          var last = Number(st.counters[key]) || 0, before = readCounter(key), delta = before - last;
          if (!delta) return null;
          return remote.add(id, key, delta).then(function (total) {
            // Anything earned while waiting stays on top of the new total.
            addToCounter(key, total - before);
            st.counters[key] = total;
            saveState();
          });
        });
      }, Promise.resolve());
    }

    function pushValues(sent) {
      var keys = {};
      Object.keys(sent).forEach(function (k) {
        var kind = kindOf(k);
        if (!kind || kind === 'counter' || kind === 'history') return;
        keys[kind === 'progress' ? progressBase(k) : k] = kind;
      });
      return Object.keys(keys).reduce(function (chain, key) {
        return chain.then(function () {
          var kind = keys[key], rule = MERGE[kind] || MERGE.replace, local = readLocal(kind, key);
          if (local === null) return null;
          // Re-merge with what the device holds now: it may have changed while the cloud round trip ran.
          return remote.merge(id, key, local, rule).then(function (merged) { writeLocal(kind, key, rule(readLocal(kind, key), merged)); });
        });
      }, Promise.resolve());
    }

    function pushHistory() {
      var entries = readHistory().entries, present = {}, docs = [];
      entries.forEach(function (e) {
        if (!e || !e.id) return;
        present[e.id] = true;
        var s = stamp(e);
        if (st.known[e.id] !== s) docs.push({ id: e.id, entry: e, stamp: s });
      });
      Object.keys(st.known).forEach(function (eid) { if (!present[eid]) docs.push({ id: eid, entry: null }); });
      if (!docs.length) return Promise.resolve();
      return remote.putHistory(id, docs.map(function (d) { return { id: d.id, entry: d.entry }; })).then(function () {
        docs.forEach(function (d) { if (d.entry) st.known[d.id] = d.stamp; else delete st.known[d.id]; });
        saveState();
      });
    }

    return {
      // One round: bring in the cloud's changes, then send this device's. The outbox is only cleared on success.
      sync: function () {
        var sent = space.outbox();
        return pull(st.lastPull)
          .then(pushCounters)
          .then(function () { return pushValues(sent); })
          .then(pushHistory)
          .then(function () {
            space.done(sent);
            st.lastSync = Date.now();
            saveState();
            return { ok: true, at: st.lastSync };
          });
      },
      state: function () { return st; },
      linked: function () { return st.linked === true; },
      link: function () { st.linked = true; saveState(); },
      historyFrom: function () { return historyFrom; },
      loadOlder: function () {
        if (!historyFrom) return Promise.resolve(0);
        var from = historyFrom;
        return remote.pullOlder(id, from).then(function (p) {
          var list = p.history || [];
          if (list.length) applyHistory(list);
          historyFrom = 0;
          saveState();
          return list.length;
        });
      }
    };
  }

  // What a device does the first time it signs in. Data from two learners is never added together, because a
  // migrated tablet and the cloud may hold the same points.
  function plan(me, keys, cloudLearners) {
    if (cloudLearners.some(function (l) { return l.id === me.id; })) return { action: 'linked' };
    var hasData = keys.some(function (k) { return !/^(profile_v1$|sync_)/.test(k); });
    if (!hasData && cloudLearners.length) return { action: 'choose', candidates: cloudLearners, keep: false };
    var same = cloudLearners.filter(function (l) { return l.profile && Number(l.profile.grade) === me.grade; });
    if (!same.length) return { action: 'upload' };
    return { action: 'choose', candidates: same, keep: true };
  }

  var exported = { create: create, plan: plan, MERGE: MERGE, kindOf: kindOf, STATE: STATE };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.SyncCore = exported;
})(this);
