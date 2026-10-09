/* Runs one of her moves (moves.js) at a time: an emote, a prop's ✨ Use, a demo at Kuya Pilo's stall, or her outfit idle
   after 8 s standing still. Walking or a panel ends a move at once (a stall demo keeps going). No Three.js. */
(function (root) {
  'use strict';
  var IDLE_AFTER = 8;
  var M = typeof module !== 'undefined' && module.exports ? require('./moves.js') : root.World3D.Moves;

  function create() {
    var run = null, still = 0;

    // demo: shown at the stall (keeps going while the panel is open; replaces another demo). A tap replaces an idle.
    function start(id, demo) {
      var m = M.find(id);
      if (!m || (run && !run.idle && !demo)) return false;
      run = { id: id, t: 0, k: 0, len: m.len, demo: !!demo, idle: id.indexOf('idle-') === 0 };
      still = 0;
      return true;
    }
    function stop() {
      var was = run ? run.id : null;
      run = null;
      still = 0;
      return was;
    }

    // her = { moving, free, clothes }. Returns { move, k, fx: [kinds due now], idle } or null.
    function tick(dt, her) {
      var busy = her.moving || !her.free;
      if (run && !run.demo && busy) run = null;
      if (!run) {
        still = busy ? 0 : still + dt;
        if (still < IDLE_AFTER) return null;
        start(M.idleFor(her.clothes));
        dt = 0;
      }
      var from = run.k;
      run.t += dt;
      run.k = Math.min(1, run.t / run.len);
      var out = { move: run.id, k: run.k, fx: M.effectsBetween(run.id, from, run.k), idle: run.idle };
      if (run.k >= 1) run = null;
      return out;
    }

    function state() { return run ? { move: run.id, k: run.k, demo: run.demo, idle: run.idle } : null; }

    return { start: start, stop: stop, tick: tick, state: state };
  }

  var exported = { IDLE_AFTER: IDLE_AFTER, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MoveRun = exported;
})(this);
