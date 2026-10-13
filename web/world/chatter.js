/* When the world's characters speak on their own: which near speaker gets a bubble, how many are on screen and how often
   each one talks, from the Chatter setting. Pure and timer-free: the world feeds it dt every frame. A speaker is
   { id, speaker, x, z, head, hidden }; ask(entry) returns the words to show, or null. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;

  var LIMITS = {
    quiet: { max: 0, gap: [20, 30], radius: 0, spacing: 3 },
    calm: { max: 2, gap: [20, 30], radius: 12, spacing: 3 },
    chatty: { max: 3, gap: [10, 15], radius: 16, spacing: 1 }
  };
  var LIFE = 4, FADE_IN = 0.25, FADE_OUT = 0.5, CHECK = 1;

  function create(o) {
    var rand = o.rand || Math.random, now = 0, since = CHECK, lastNew = -100, active = [], nextOk = {};

    function span(g) { return g[0] + rand() * (g[1] - g[0]); }

    function view() {
      return active.map(function (b) {
        var age = now - b.born, a = Math.min(1, age / FADE_IN, (LIFE - age) / FADE_OUT);
        return { id: b.id, text: b.text, x: b.x, y: b.y, z: b.z, alpha: Math.max(0, a) };
      });
    }

    // The first time a speaker is near it only gets a random delay, so a crowd does not all talk at once.
    function spawn(input, lim) {
      var taken = {};
      active.forEach(function (b) { taken[b.id] = true; });
      var cands = input.speakers.filter(function (s) {
        return !s.hidden && !taken[s.id] && Math.hypot(s.x - input.her.x, s.z - input.her.z) <= lim.radius;
      }).sort(function (a, b) {
        return Math.hypot(a.x - input.her.x, a.z - input.her.z) - Math.hypot(b.x - input.her.x, b.z - input.her.z);
      });
      for (var i = 0; i < cands.length; i++) {
        var s = cands[i];
        if (nextOk[s.id] === undefined) {
          nextOk[s.id] = now + rand() * lim.gap[1];
          continue;
        }
        if (now < nextOk[s.id]) continue;
        var text = o.ask(s);
        nextOk[s.id] = now + span(lim.gap);
        if (!text) continue;
        active.push({ id: s.id, text: text, born: now, x: s.x, y: s.head, z: s.z });
        lastNew = now;
        return;
      }
    }

    function step(dt, input) {
      now += dt;
      var lim = LIMITS[input.mode] || LIMITS.calm, byId = {};
      input.speakers.forEach(function (s) { byId[s.id] = s; });
      if (input.silent || lim.max === 0) active = [];
      active = active.filter(function (b) { return now - b.born < LIFE && byId[b.id] && !byId[b.id].hidden; });
      active.forEach(function (b) {
        var s = byId[b.id];
        b.x = s.x;
        b.y = s.head;
        b.z = s.z;
      });
      since += dt;
      if (since >= CHECK) {
        since = 0;
        if (!input.silent && lim.max > 0 && active.length < lim.max && now - lastNew >= lim.spacing) spawn(input, lim);
      }
      return view();
    }

    return { step: step };
  }

  var exported = { LIMITS: LIMITS, LIFE: LIFE, create: create };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Chatter = exported;
})(this);
