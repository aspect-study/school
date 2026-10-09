/* The parent PIN for the Parent panel and the shop. One per device (not per child), 0108 until a parent changes it.
   When the family is signed in, one cloud copy keeps every device on the same PIN: the newer change wins.
   Loaded after storage.js. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var KEY = 'parent_pin_v1';
  var DEFAULT_PIN = '0108';
  var FOUR_DIGITS = /^\d{4}$/;

  function valid(r) {
    return !!r && typeof r === 'object' && typeof r.pin === 'string' && FOUR_DIGITS.test(r.pin) &&
      typeof r.at === 'number' && isFinite(r.at);
  }

  function merge(local, cloud) {
    var a = valid(local) ? local : null, b = valid(cloud) ? cloud : null;
    if (!a) return b;
    if (!b) return a;
    return b.at > a.at ? b : a;
  }

  function create(storage, now) {
    function read() {
      try { var r = JSON.parse(storage.getItem(KEY)); return valid(r) ? r : null; } catch (e) { return null; }
    }
    function write(r) {
      try { storage.setItem(KEY, JSON.stringify({ pin: r.pin, at: r.at })); return true; } catch (e) { return false; }
    }
    function get() { var r = read(); return r ? r.pin : DEFAULT_PIN; }

    return {
      get: get,
      check: function (entry) { return entry === get(); },
      set: function (pin) { return FOUR_DIGITS.test(String(pin)) && write({ pin: String(pin), at: now() }); },
      // remote: { getPin() -> promise of { pin, at } or null, putPin({ pin, at }) -> promise }. Never rejects.
      sync: function (remote) {
        return Promise.resolve().then(function () { return remote.getPin(); }).then(function (cloud) {
          var local = read();
          var best = merge(local, cloud);
          if (!best) return null;
          if (best !== local) write(best);
          if (!valid(cloud) || cloud.at < best.at) return remote.putPin({ pin: best.pin, at: best.at });
          return null;
        }).then(function () {}, function () {});
      }
    };
  }

  var exported = { create: create, merge: merge, KEY: KEY, DEFAULT_PIN: DEFAULT_PIN };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try { root.ParentPin = create(root.StudyStore.raw, function () { return Date.now(); }); } catch (e) {}
})(this);
