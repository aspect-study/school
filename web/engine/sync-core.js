/* Cloud sync rules (phase 5b). Merges one learner's space with the cloud through a small `remote` interface:
   cloud.js gives the Firebase one, the tests give an in-memory one. The device stays the main copy.
   Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var STATE = 'sync_state_v1';
  var LOCAL_ONLY = /^(sync_|last_backup_v1$|history_error_v1$|history_corrupt_v1_)/;
  var POINTS = /_points_v1$/;
  var PROGRESS = /_progress_v\d+$/;
  var PROGRESS_DAY = /_progress_v\d+_day$/;
  var WALLET_COUNTERS = ['spent', 'bonus'];

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
    if (POINTS.test(key)) return 'counter';
    if (key === 'wallet_v1') return 'wallet';
    if (key === 'recall_v1') return 'recall';
    if (key === 'history_v1') return 'history';
    if (key === 'profile_v1') return 'profile';
    if (key === 'coin_guide_seen_v1') return 'flag';
    if (PROGRESS.test(key) || PROGRESS_DAY.test(key)) return 'progress';
    return 'replace';
  }

  // Merge rules: a = this device, b = the cloud; either may be null. Each is safe to repeat and gives the same
  // answer in either order, so devices agree whichever syncs first.
  var MERGE = {
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
      return { baselines: baselines, purchases: purchases, oldPointsCounted: a.oldPointsCounted === true || b.oldPointsCounted === true };
    },
    // Name and emoji: the latest change wins. Grade: the higher wins (moving up never goes back).
    profile: function (a, b) {
      if (!a || !b) return a || b;
      var newer = (Number(a.at) || 0) >= (Number(b.at) || 0) ? a : b;
      return { name: newer.name, emoji: newer.emoji, grade: Math.max(Number(a.grade) || 0, Number(b.grade) || 0), at: newer.at || 0 };
    },
    flag: function (a, b) { return a === '1' || b === '1' ? '1' : (a !== null && a !== undefined ? a : b); },
    replace: function (a, b) { return a !== null && a !== undefined ? a : b; }
  };

  function create(space, remote, id) {
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
        return w ? { baselines: w.baselines || {}, purchases: w.purchases || [], oldPointsCounted: w.oldPointsCounted === true } : null;
      }
      if (kind === 'recall' || kind === 'profile') return json(space.getItem(key), null);
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
        space.put('wallet_v1', JSON.stringify(w));
      } else if (kind === 'recall' || kind === 'profile') {
        space.put(key, JSON.stringify(value));
      } else {
        space.put(key, String(value));
      }
    }

    // ---- counters: points per subject, and the wallet's spent and bonus ----
    function counterKeys() {
      var keys = space.keys().filter(function (k) { return POINTS.test(k); });
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

    function pull(since) {
      return remote.pull(id, since).then(function (p) {
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
        if ((p.history || []).length) {
          var h = readHistory(), byId = {};
          h.entries.forEach(function (e, i) { byId[e.id] = i; });
          p.history.forEach(function (d) {
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
          var kind = keys[key], local = readLocal(kind, key);
          if (local === null) return null;
          return remote.merge(id, key, local, MERGE[kind] || MERGE.replace).then(function (merged) { writeLocal(kind, key, merged); });
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
      link: function () { st.linked = true; saveState(); }
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
