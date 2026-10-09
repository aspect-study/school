/* Loaded by every page right after storage.js. Each child on a device is a learner, and everything she saves lives in
   her own space (learner/<id>/), so her coins, history and stars stay hers when she moves up a grade. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var Store = typeof module !== 'undefined' && module.exports ? require('./storage.js') : null;

  var DEVICE_KEY = 'learners_v1';
  var PROFILE = 'profile_v1';
  var NAME_MAX = 30;

  // Before 2026-10-02 every key was global. These tell which grade's child each old key belonged to.
  var LEGACY_APPS = {
    grade5: ['historyexplorers', 'pageturners', 'wikaharian', 'riseshine', 'mathmastery', 'rallyready', 'lifelab', 'craftcorner'],
    grade2: ['blockbot', 'wordtrain', 'kuwentista', 'growinggood', 'batangbayani', 'sciencedetectives', 'bytebuddies']
  };
  var LEGACY_GRADE_KEYS = /^(wallet_v1|recall_v1|history_v1|history_error_v1|history_corrupt_v1_\d+|last_backup_v1|coin_guide_seen_v1)$/;

  function legacyKey(key) {
    var m = /^grade(\d+)_(.+)$/.exec(key);
    if (m && LEGACY_GRADE_KEYS.test(m[2])) return { grade: Number(m[1]), key: m[2] };
    m = /^([a-z0-9]+)_(points_v1|progress_v\d+(_day)?)$/.exec(key);
    if (!m) return null;
    for (var g in LEGACY_APPS) {
      if (LEGACY_APPS[g].indexOf(m[1]) >= 0) return { grade: Number(g.slice(5)), key: key };
    }
    return null;
  }

  function create(storage, now, pageGrade) {
    var space = function (id) { return Store.space(storage, id, now); };
    function get(k) { try { return storage.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { storage.setItem(k, v); } catch (e) {} }
    function keys() {
      var out = [];
      try { for (var i = 0; i < storage.length; i++) out.push(storage.key(i)); } catch (e) {}
      return out;
    }
    function json(raw) { try { return JSON.parse(raw); } catch (e) { return null; } }

    function readProfile(id) {
      var p = json(space(id).getItem(PROFILE));
      if (!p || typeof p.grade !== 'number') return null;
      return { id: id, name: typeof p.name === 'string' ? p.name : '', emoji: typeof p.emoji === 'string' ? p.emoji : '', grade: p.grade, boy: p.boy === true };
    }
    function writeProfile(l) {
      var p = { name: l.name, emoji: l.emoji, grade: l.grade, at: now() };
      if (l.boy === true) p.boy = true;
      try { space(l.id).setItem(PROFILE, JSON.stringify(p)); } catch (e) {}
    }

    function list() {
      var out = [];
      Store.spaces(storage).forEach(function (id) {
        var p = readProfile(id);
        if (p) out.push(p);
      });
      return out.sort(function (a, b) { return b.grade - a.grade || (a.id < b.id ? -1 : 1); });
    }

    var device = json(get(DEVICE_KEY)) || {};
    function saveDevice() { set(DEVICE_KEY, JSON.stringify({ v: 1, current: device.current || null })); }

    function newLearner(grade) {
      var l = { id: 'l' + now().toString(36) + Math.floor(Math.random() * 1296).toString(36), name: '', emoji: '', grade: grade, boy: false };
      writeProfile(l);
      return l;
    }

    // Copies, never moves: the old keys stay as a safety net. Skipped once any learner exists.
    function migrate() {
      if (list().length) return;
      var byGrade = {};
      keys().forEach(function (k) {
        var m = k && legacyKey(k);
        if (m) (byGrade[m.grade] = byGrade[m.grade] || []).push([k, m.key]);
      });
      Object.keys(byGrade).map(Number).sort(function (a, b) { return b - a; }).forEach(function (grade) {
        var l = newLearner(grade), mine = space(l.id);
        byGrade[grade].forEach(function (pair) {
          var v = get(pair[0]);
          if (v !== null) { try { mine.setItem(pair[1], v); } catch (e) {} }
        });
      });
    }

    function pick() {
      var all = list();
      var current = null;
      all.forEach(function (l) { if (l.id === device.current) current = l; });
      if (!pageGrade) return current || (all.length === 1 ? all[0] : null);
      var same = null;
      all.forEach(function (l) { if (!same && l.grade === pageGrade) same = l; });
      if (current && current.grade === pageGrade) return current;
      if (same) return same;
      if (current && current.grade > pageGrade) return current;
      return newLearner(pageGrade);
    }

    migrate();
    var me = pick();
    if (me && device.current !== me.id) {
      device.current = me.id;
      saveDevice();
    }

    var nobody = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {}, put: function () {}, keys: function () { return []; }, outbox: function () { return {}; }, done: function () {} };
    var store = me ? space(me.id) : nobody;

    return {
      current: function () { return me ? { id: me.id, name: me.name, emoji: me.emoji, grade: me.grade, boy: me.boy === true } : null; },
      list: list,
      storage: store,
      update: function (fields) {
        if (!me) return;
        if (typeof fields.name === 'string') me.name = fields.name.trim().slice(0, NAME_MAX);
        if (typeof fields.emoji === 'string') me.emoji = fields.emoji.trim().slice(0, 8);
        if (typeof fields.boy === 'boolean') me.boy = fields.boy;
        writeProfile(me);
      },
      lobby: function (l) { return 'lobby/grade-' + (l || me).grade + '.html'; },
      // Cloud sync: this device becomes a learner who already exists in the cloud. The page reloads afterwards.
      adopt: function (id, profile) {
        var l = { id: String(id), name: profile.name || '', emoji: profile.emoji || '', grade: Number(profile.grade) || (me && me.grade) || pageGrade, boy: profile.boy === true };
        writeProfile(l);
        device.current = l.id;
        saveDevice();
        return space(l.id);
      }
    };
  }

  var exported = { create: create, legacyKey: legacyKey, LEGACY_APPS: LEGACY_APPS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  Store = { space: function (raw, id, now) { return root.StudyStore.space(id); }, spaces: function () { return root.StudyStore.spaces(); } };
  try {
    var script = root.document && root.document.currentScript;
    var m = /^grade(\d+)$/.exec(script ? script.getAttribute('data-grade') || '' : '');
    root.Learner = create(root.localStorage, Date.now, m ? Number(m[1]) : null);
  } catch (e) {}
})(this);
