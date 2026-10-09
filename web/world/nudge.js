/* The gentle study nudge: after 10 minutes of world time without a game, Mayor Mimi comes over. Opening a game leaves
   the page, so the count starts again there. Nothing ever locks. */
(function (root) {
  'use strict';

  var LIMIT = 600;

  // tick(dt, counting) once per frame; true once when the time is up, then it counts from 0 again.
  function create(limit) {
    var max = limit || LIMIT, acc = 0;
    return {
      tick: function (dt, counting) {
        if (counting) acc += dt;
        if (acc < max) return false;
        acc = 0;
        return true;
      },
      force: function () { acc = max; },
      reset: function () { acc = 0; }
    };
  }

  var exported = { LIMIT: LIMIT, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Nudge = exported;
})(this);
