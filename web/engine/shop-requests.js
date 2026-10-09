/* Shop requests: a child asks on the tablet, a parent answers on the phone, and the tablet does the buying.
   Saved as shop_requests_v1 in the learner's space, so cloud sync carries it (the merge rule is in sync-core.js).
   Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var KEY = 'shop_requests_v1';
  var KEEP_DAYS = 7;
  var DAY_MS = 86400000;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function create(storage, now) {
    function read() {
      try {
        var s = JSON.parse(storage.getItem(KEY));
        if (s && s.list && typeof s.list === 'object' && !Array.isArray(s.list)) return s;
      } catch (e) {}
      return { v: 1, list: {} };
    }
    function write(s) {
      // Relative to the newest request, exactly like the merge rule in sync-core.js, so a dropped request can't come back.
      var newest = 0;
      Object.keys(s.list).forEach(function (id) { newest = Math.max(newest, Number(s.list[id].t) || 0); });
      var cutoff = newest - KEEP_DAYS * DAY_MS;
      Object.keys(s.list).forEach(function (id) { if ((Number(s.list[id].t) || 0) < cutoff) delete s.list[id]; });
      try { storage.setItem(KEY, JSON.stringify({ v: 1, list: s.list })); return true; } catch (e) { return false; }
    }
    // A request nobody answered on the day it was asked is too old to approve.
    function statusOf(r) { return r.status === 'waiting' && dateKey(r.t) !== dateKey(now()) ? 'expired' : r.status; }
    function view(id, r) { return { id: id, item: r.item, name: r.name, emoji: r.emoji, coins: r.coins, t: r.t, status: statusOf(r) }; }
    function move(id, to, from) {
      var s = read(), r = s.list[id];
      if (!r || from.indexOf(statusOf(r)) < 0) return false;
      r.status = to;
      r.at = now();
      return write(s);
    }
    function all() {
      var s = read();
      return Object.keys(s.list).map(function (id) { return view(id, s.list[id]); }).sort(function (a, b) { return b.t - a.t; });
    }

    return {
      ask: function (item) {
        var s = read(), t = now();
        var id = 'r' + t.toString(36) + Math.floor(Math.random() * 1296).toString(36);
        s.list[id] = { item: item.id, name: item.name, emoji: item.emoji || '', coins: item.coins, t: t, status: 'waiting', at: t };
        return write(s) ? id : null;
      },
      get: function (id) {
        var r = read().list[id];
        return r ? view(id, r) : null;
      },
      list: all,
      waiting: function () { return all().filter(function (r) { return r.status === 'waiting'; }).reverse(); },
      answer: function (id, yes) { return move(id, yes ? 'approved' : 'declined', ['waiting']); },
      cancel: function (id) { return move(id, 'cancelled', ['waiting', 'approved']); },
      // buy(request) returns 'done' when it bought the item; anything else means there weren't enough coins.
      settle: function (buy) {
        var s = read(), out = [], ids = Object.keys(s.list);
        for (var i = 0; i < ids.length; i++) {
          var r = s.list[ids[i]];
          if (r.status !== 'approved') continue;
          r.status = buy(view(ids[i], r)) === 'done' ? 'done' : 'short';
          r.at = now();
          // Saved one by one: if saving fails, stop so nothing already bought is bought again.
          if (!write(s)) break;
          out.push({ id: ids[i], status: r.status });
        }
        return out;
      }
    };
  }

  var exported = { create: create, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.ShopRequests = exported;
})(this);
