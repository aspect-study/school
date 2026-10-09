/* Loaded right after learner.js by both lobbies and every game. The pages are decoded as UTF-8, so the text can hold emoji.
   The date guard: this device remembers the latest time it has seen. When the clock reads more than an hour earlier,
   points and coins pause, so moving the date back can never earn rewards. It lives in the device's own storage, never
   synced: two tablets' clocks never agree to the second. */
(function (root) {
  'use strict';

  var KEY = 'clock_seen_v1';
  var SLACK = 3600000;

  var TEXT = {
    grade5: { banner: '⏰ The tablet\'s date is earlier than before. Points and coins are paused until the date is right.' },
    grade2: { banner: '⏰ Mali ang petsa ng tablet. Hihinto muna ang points at coins. · The tablet\'s date is earlier than before. Points and coins are paused until the date is right.' }
  };

  function create(storage, now) {
    // null when storage cannot be read: a guard that cannot remember must never block her.
    function seen() {
      var raw;
      try { raw = storage.getItem(KEY); } catch (e) { return null; }
      var v = Number(raw);
      return isFinite(v) && v > 0 ? v : 0;
    }
    function save(t) { try { storage.setItem(KEY, String(t)); } catch (e) {} }

    return {
      paused: function () {
        var s = seen(), t = now();
        if (s === null) return false;
        if (t < s - SLACK) return true;
        if (t > s) save(t);
        return false;
      },
      fix: function () { save(now()); }
    };
  }

  var CSS = '.clock-banner{margin:0;padding:10px 16px;background:#FFE9E9;color:#7A1C1C;font-weight:800;text-align:center;line-height:1.4;}';

  function showBanner(doc, text) {
    function put() {
      if (!doc.body || doc.getElementById('clock-banner')) return;
      var style = doc.createElement('style');
      style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
      var b = doc.createElement('p');
      b.id = 'clock-banner';
      b.className = 'clock-banner';
      b.setAttribute('role', 'status');
      b.textContent = text;
      doc.body.insertBefore(b, doc.body.firstChild);
    }
    if (doc.body) put();
    else doc.addEventListener('DOMContentLoaded', put);
  }

  var exported = { create: create, KEY: KEY, SLACK: SLACK, TEXT: TEXT };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var api = create(root.localStorage, Date.now);
    if (api.paused() && grade && TEXT[grade]) showBanner(root.document, grade === 'grade2' && root.Lang ? root.Lang.localize(TEXT[grade]).banner : TEXT[grade].banner);
    var fix = api.fix;
    api.fix = function () {
      fix();
      var b = root.document.getElementById('clock-banner');
      if (b) b.remove();
    };
    Object.keys(exported).forEach(function (k) { api[k] = exported[k]; });
    root.Clock = api;
  } catch (e) {}
})(this);
