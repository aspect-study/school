/* What the playground kids ask (playmates part 1): today's questions, never the same one twice in a day, and her
   answers to the fun questions, which the friends remember. Saved as mates_v1 { v, day, asked, fun, t }, a synced
   replace key like world3d_v1; a new day clears asked and keeps fun. Pure. */
(function (root) {
  'use strict';
  var KEY = 'mates_v1', MAX_ASKED = 400, Q_MAX = 120;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function index(n, rand) { return Math.min(n - 1, Math.floor(rand() * n)); }

  function read(storage, today) {
    var d = null;
    try { d = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    if (!isObj(d)) d = {};
    var fun = {};
    if (isObj(d.fun)) Object.keys(d.fun).forEach(function (id) { if (Number.isInteger(d.fun[id]) && d.fun[id] >= 0) fun[id] = d.fun[id]; });
    var asked = d.day === today && Array.isArray(d.asked) ? d.asked.filter(function (k) { return typeof k === 'string'; }) : [];
    return { v: 1, day: today, asked: asked, fun: fun, t: typeof d.t === 'number' ? d.t : 0 };
  }

  function write(storage, d, now) {
    d.t = now;
    try { storage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }

  function funKey(id) { return 'fun:' + id; }
  function studyKey(app, q) { return 'study:' + app + ':' + String(q).slice(0, Q_MAX); }

  function markAsked(storage, today, key, now) {
    var d = read(storage, today);
    if (d.asked.indexOf(key) < 0) d.asked.push(key);
    if (d.asked.length > MAX_ASKED) d.asked = d.asked.slice(-MAX_ASKED);
    return write(storage, d, now);
  }

  function saveFun(storage, today, id, choice, now) {
    var d = read(storage, today);
    d.fun[id] = choice;
    return write(storage, d, now);
  }

  // bank: [{ id, choices }]; null when every fun question was asked today.
  function pickFun(bank, asked, rand) {
    var left = bank.filter(function (q) { return asked.indexOf(funKey(q.id)) < 0; });
    return left.length ? left[index(left.length, rand)] : null;
  }

  // cands: [{ app, item }] from a game's lessons; null when every one was asked today.
  function pickStudy(cands, asked, rand) {
    var left = cands.filter(function (c) { return asked.indexOf(studyKey(c.app, c.item.q)) < 0; });
    return left.length ? left[index(left.length, rand)] : null;
  }

  // One of her saved fun answers: { q, choice }, or null.
  function remembered(bank, fun, rand) {
    var have = bank.filter(function (q) { return has(fun, q.id) && fun[q.id] < q.choices.length; });
    if (!have.length) return null;
    var q = have[index(have.length, rand)];
    return { q: q, choice: fun[q.id] };
  }

  // The choice a kid likes best: the same every time, different from kid to kid.
  function favourite(kidId, q) {
    var s = kidId + '|' + q.id, h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % q.choices.length;
  }

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = index(i + 1, rand), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  var exported = {
    KEY: KEY, read: read, markAsked: markAsked, saveFun: saveFun, funKey: funKey, studyKey: studyKey,
    pickFun: pickFun, pickStudy: pickStudy, remembered: remembered, favourite: favourite, shuffle: shuffle
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateQuiz = exported;
})(this);
