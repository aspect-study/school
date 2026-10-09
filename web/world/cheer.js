/* What her pet celebrates when she comes back from a game, with no Three.js: a snapshot of her progress as she goes
   through a door (before) and what changed when she is back. deps = { tally(app) → { gold, silver, bronze },
   boss() → boss_v1 state { week, stages }, list(app) → that game's study-history entries }. */
(function (root) {
  'use strict';
  var Pets = typeof module !== 'undefined' && module.exports ? require('./pets.js') : root.World3D.Pets;
  var MEDALS = ['🥇', '🥈', '🥉'];

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function n(v) { v = Math.floor(Number(v)); return v > 0 ? v : 0; }
  function safe(fn, fallback) {
    try {
      var v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function bossNow(deps) {
    var b = safe(deps.boss, {}), stages = isObj(b) && Array.isArray(b.stages) ? b.stages : [];
    return {
      week: isObj(b) && typeof b.week === 'string' ? b.week : '',
      cleared: stages.filter(function (s) { return isObj(s) && s.cleared === true; }).length
    };
  }
  function tallyNow(app, deps) {
    var t = safe(function () { return deps.tally(app); }, null);
    return isObj(t) ? { gold: n(t.gold), silver: n(t.silver), bronze: n(t.bronze) } : null;
  }

  // app: the game she goes into, or 'boss' for a stage from the Boss Fort.
  function before(app, deps, now) {
    var b = bossNow(deps), out = { at: now, week: b.week, cleared: b.cleared };
    var t = app === 'boss' ? null : tallyNow(app, deps);
    if (t) out.tally = t;
    return out;
  }

  function after(app, was, deps) {
    var b = bossNow(deps), at = isObj(was) ? Number(was.at) : NaN, list = safe(function () { return deps.list(app); }, []);
    var rounds = app === 'boss' || !Array.isArray(list) ? 0 : list.filter(function (e) {
      return isObj(e) && e.type === 'quiz' && e.finished === true && e.app === app && Number(e.t) >= at;
    }).length;
    return { week: b.week, cleared: b.cleared, tally: app === 'boss' ? null : tallyNow(app, deps), rounds: rounds };
  }

  // Lessons at least gold, at least silver, at least bronze.
  function ladder(t) {
    var g = n(t.gold), s = n(t.silver), b = n(t.bronze);
    return [g, g + s, g + s + b];
  }

  // was: before() as read back from sessionStorage; now: after(). The biggest thing first.
  function pick(was, now) {
    if (!isObj(was) || !Number.isFinite(Number(was.at)) || !isObj(now)) return { level: 'hello' };
    if (typeof was.week === 'string' && was.week && was.week === now.week && n(now.cleared) > n(was.cleared)) return { level: 'boss' };
    if (isObj(was.tally) && isObj(now.tally)) {
      var a = ladder(was.tally), b = ladder(now.tally);
      for (var i = 0; i < 3; i++) if (b[i] > a[i]) return { level: 'medal', medal: MEDALS[i] };
    }
    return n(now.rounds) > 0 ? { level: 'round' } : { level: 'hello' };
  }

  // What her pet does: a trick (with its length) or a pat, its bubble, a star burst and a sound. owned: wardrobe_v1.
  function plan(result, owned) {
    function make(id, emoji, sound) { return { trick: id, len: Pets.find(id).len, emoji: emoji, burst: true, sound: sound }; }
    var level = result && result.level;
    if (level === 'boss') return make('trick-twirl', '⚔️', 'allRead');
    if (level === 'medal') return make(Pets.bestTrick(owned), result.medal, 'allRead');
    if (level === 'round') return make('trick-jump', '⭐', 'cardRead');
    return { trick: null, len: 0, emoji: '💖', burst: false, sound: 'cardRead' };
  }

  var exported = { before: before, after: after, pick: pick, plan: plan };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Cheer = exported;
})(this);
