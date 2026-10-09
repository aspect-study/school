/* My Little House saved data (house_v1: synced with its own merge, kept in backups, peeked by her sister): what she
   bought from Tito Tasyo, the pieces she earned, her right desk answers, her room and what she saw last time she went
   in. Buying works like closet.js: coins go first, and a failed save gives them back. */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Furniture = node ? require('./furniture.js') : root.World3D.Furniture;
  var Room = node ? require('./room.js') : root.World3D.Room;
  var Trophies = node ? require('./trophies.js') : root.World3D.Trophies;
  var Layout = node ? require('./layout.js') : root.World3D.Layout;

  var KEY = 'house_v1';
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function time(v) { v = Number(v); return v > 0 && isFinite(v) ? v : 0; }
  function count(v) { v = Math.floor(Number(v)); return v > 0 && isFinite(v) ? v : 0; }

  function cleanRoom(r) {
    if (!isObj(r)) return null;
    return {
      at: time(r.at),
      placed: (Array.isArray(r.placed) ? r.placed : []).filter(function (p) { return isObj(p) && typeof p.id === 'string'; }),
      wall: typeof r.wall === 'string' ? r.wall : '',
      floor: typeof r.floor === 'string' ? r.floor : '',
      stars: r.stars === true
    };
  }
  function cleanSeen(s) {
    if (!isObj(s)) return null;
    var size = Math.floor(Number(s.size)), trophies = {};
    if (isObj(s.trophies)) {
      Object.keys(s.trophies).forEach(function (app) {
        var l = Math.floor(Number(s.trophies[app]));
        if (l >= 0 && l <= 3) trophies[app] = l;
      });
    }
    return { at: time(s.at), size: size >= 4 && size <= 8 ? size : 4, trophies: trophies };
  }

  // Unknown ids stay in owned and earned (bought on a newer version), they are just not drawn.
  function clean(raw) {
    var owned = {}, earned = {};
    raw = isObj(raw) ? raw : {};
    if (isObj(raw.owned)) {
      Object.keys(raw.owned).forEach(function (id) {
        var e = raw.owned[id];
        if (isObj(e) && time(e.t)) owned[id] = { t: time(e.t), coins: Number(e.coins) || 0 };
      });
    }
    if (isObj(raw.earned)) Object.keys(raw.earned).forEach(function (id) { if (time(raw.earned[id])) earned[id] = time(raw.earned[id]); });
    return { v: 1, owned: owned, earned: earned, deskRight: count(raw.deskRight), room: cleanRoom(raw.room), seen: cleanSeen(raw.seen) };
  }

  function read(storage) {
    var raw = null;
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    return clean(raw);
  }
  function write(storage, data) {
    var text = JSON.stringify(clean(data));
    try {
      storage.setItem(KEY, text);
      return storage.getItem(KEY) === text;
    } catch (e) { return false; }
  }

  // Starters are hers without an entry, as Items.owns does; earned pieces only once earned.
  function owns(data, id) {
    var it = Furniture.find(id);
    return (!!it && !it.earned && it.coins === 0) || own(data.owned, id) || own(data.earned, id);
  }

  // Her room at this size, repaired: a new room starts with the starters.
  function roomOf(data, size, boy) {
    var has = function (id) { return owns(data, id); };
    return data.room ? Room.repair(Furniture, data.room, size, has) : Room.start(Furniture, size, boy);
  }

  // o = { storage, wallet, history, paused(), now(), item }. Returns { ok: true } or { ok: false, why, need? }.
  function buy(o) {
    var it = Furniture.find(o.item && o.item.id);
    if (o.paused()) return { ok: false, why: 'paused' };
    if (!it) return { ok: false, why: 'unknown' };
    if (it.earned) return { ok: false, why: 'earned' };
    var data = read(o.storage);
    if (owns(data, it.id)) return { ok: false, why: 'owned' };
    var have = o.wallet.balanceStored();
    if (have < it.coins) return { ok: false, why: 'short', need: it.coins - have };
    if (!o.wallet.spend(it.coins)) return { ok: false, why: 'short', need: 0 };
    data.owned[it.id] = { t: o.now(), coins: it.coins };
    if (!write(o.storage, data) || !own(read(o.storage).owned, it.id)) {
      o.wallet.addBonus(it.coins);
      return { ok: false, why: 'failed' };
    }
    try { if (o.history) o.history.purchased(it.id, it.en, it.coins, 'house'); } catch (e) {}
    return { ok: true };
  }

  function update(storage, change) {
    var data = read(storage);
    change(data);
    return write(storage, data);
  }

  function saveRoom(storage, room, now) {
    return update(storage, function (d) {
      d.room = { at: now, placed: room.placed.slice(), wall: room.wall, floor: room.floor, stars: room.stars === true };
    });
  }

  function facts(o) {
    var grade = Layout.gradeOf(o.grade), mastery = o.mastery, boss = isObj(o.boss) ? o.boss : {};
    var stages = Array.isArray(boss.stages) ? boss.stages.filter(isObj) : [];
    var paid = Array.isArray(boss.paid) ? boss.paid : [];
    var apps = Layout.APPS[grade].map(function (a) {
      return Trophies.counts(isObj(mastery) && isObj(mastery.apps) && own(mastery.apps, a.app) ? mastery.apps[a.app] : null);
    });
    var streak = isObj(o.streak) ? o.streak.days : o.streak;
    return {
      streak: count(streak),
      boss: (stages.length > 0 && stages.every(function (s) { return s.cleared === true; })) ||
        paid.some(function (m) { return typeof m === 'string' && /\|full$/.test(m); }),
      gold: apps.some(function (c) { return c.gold > 0; }),
      medals: Trophies.medals(grade, mastery),
      allGold: apps.some(function (c) { return c.total > 0 && c.gold === c.total; }),
      desk: count(o.deskRight)
    };
  }

  var RULES = {
    streak: function (f) { return f.streak >= Furniture.EARN.streak.n; },
    boss: function (f) { return f.boss; },
    gold: function (f) { return f.gold; },
    books: function (f, grade) { return f.medals >= Furniture.EARN.books.n[grade]; },
    allGold: function (f) { return f.allGold; },
    desk: function (f) { return f.desk >= Furniture.EARN.desk.n; }
  };

  // Earned pieces whose rule is true now and that she has not earned yet, in catalog order.
  function unlocks(data, f, grade) {
    grade = Layout.gradeOf(grade);
    return Furniture.inTab('earned').filter(function (it) {
      return !own(data.earned, it.id) && RULES[it.earned.rule](f, grade);
    }).map(function (it) { return it.id; });
  }

  function earn(storage, ids, now) {
    return update(storage, function (d) { ids.forEach(function (id) { if (!own(d.earned, id)) d.earned[id] = now; }); });
  }

  // One more right answer at the study desk; the new count (the old one when it could not be saved).
  function addDeskRight(storage) {
    var data = read(storage), n = data.deskRight + 1;
    data.deskRight = n;
    return write(storage, data) ? n : n - 1;
  }

  // What she saw when she went in: the room's size and each trophy's level, for the next visit's celebrations.
  function snapshot(storage, size, trophies, now) {
    return update(storage, function (d) { d.seen = { at: now, size: size, trophies: Object.assign({}, trophies) }; });
  }

  var exported = {
    KEY: KEY, clean: clean, read: read, write: write, owns: owns, roomOf: roomOf, buy: buy, saveRoom: saveRoom,
    facts: facts, unlocks: unlocks, earn: earn, addDeskRight: addDeskRight, snapshot: snapshot
  };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.House = exported;
})(this);
