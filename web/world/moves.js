/* Her moves as plain maths: the emotes (emotes.js), each prop's ✨ Use action (items.js props) and the outfit idles.
   pose(id, p) gives offsets from her current pose at moment p (0 to 1), all zero at the start and the end, which
   avatar.js adds to her arms, legs, body and head. fx lists timed effects that build.js draws from FX. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;
  var KEYS = ['aLx', 'aLz', 'aRx', 'aRz', 'lLx', 'lRx', 'bx', 'by', 'brx', 'bry', 'brz', 'hrx', 'hry', 'hrz'];

  // Effects: emoji sprites that rise (vy) and drift (spread) for life seconds; n at a time (half on low quality).
  var FX = {
    bubbles: { e: ['🫧'], n: 6, vy: 1.2, spread: 1.4, life: 1.8 },
    petals: { e: ['🌸', '🌷'], n: 6, vy: -0.3, spread: 1.6, life: 2 },
    hearts: { e: ['💖', '💗'], n: 5, vy: 1.5, spread: 1, life: 1.6 },
    sparkles: { e: ['✨'], n: 7, vy: 0.8, spread: 1.6, life: 1.2 },
    notes: { e: ['🎵', '🎶'], n: 4, vy: 1.4, spread: 1, life: 1.6 },
    breeze: { e: ['💨'], n: 3, vy: 0.2, spread: 1.2, life: 1 },
    shine: { e: ['🌟'], n: 6, vy: 1, spread: 1.8, life: 1.4 },
    stars: { e: ['⭐'], n: 6, vy: 1.2, spread: 1.6, life: 1.4 },
    giggle: { e: ['😆'], n: 3, vy: 1.2, spread: 0.8, life: 1.4 }
  };

  function env(p) {
    var e = Math.max(0, Math.min(1, p / 0.2, (1 - p) / 0.2));
    return e * e * (3 - 2 * e);
  }
  function ease(p) { return p * p * (3 - 2 * p); }
  function hump(p) { return Math.sin(Math.PI * p); }
  function wave(p, n) { return Math.sin(p * TAU * n); }
  function move(len, fx, pose) { return { len: len, fx: fx, pose: pose }; }

  var MOVES = {
    'emote-wave': move(1.6, [], function (p, e) { return { aRz: (1.75 + wave(p, 3) * 0.35) * e, aRx: 0.6 * e }; }),
    'emote-clap': move(1.6, [[0.4, 'sparkles']], function (p, e) {
      var c = (0.35 + wave(p, 4) * 0.25) * e;
      return { aLx: -1.3 * e, aRx: -1.3 * e, aLz: c, aRz: -c };
    }),
    'emote-cheer': move(1.6, [[0.3, 'stars']], function (p, e) {
      return { aLz: (-1.95 + wave(p, 4) * 0.2) * e, aRz: (1.95 - wave(p, 4) * 0.2) * e, aLx: 0.4 * e, aRx: 0.4 * e, by: Math.abs(Math.sin(p * Math.PI * 2)) * 0.6 * e };
    }),
    'emote-bow': move(1.6, [], function (p) { return { brx: 0.3 * hump(p), hrx: 0.35 * hump(p) }; }),
    'emote-heart': move(1.8, [[0.35, 'hearts'], [0.65, 'hearts']], function (p, e) {
      return { aLz: -2.0 * e, aRz: 2.0 * e, aLx: 0.3 * e, aRx: 0.3 * e };
    }),
    'emote-giggle': move(1.6, [[0.2, 'giggle']], function (p, e) {
      return { aLx: -0.9 * e, aRx: -0.9 * e, brz: wave(p, 4) * 0.12 * e, by: Math.abs(wave(p, 4)) * 0.15 * e, hrz: wave(p, 4) * 0.2 * e };
    }),
    'emote-spin': move(1.6, [[0.5, 'sparkles']], function (p, e) { return { bry: ease(p) * TAU, aLz: -1.2 * e, aRz: 1.2 * e }; }),
    'emote-relax': move(2.5, [], function (p, e) {
      return { lLx: -1.45 * e, lRx: -1.45 * e, by: -0.85 * e, aLx: -0.3 * e, aRx: -0.3 * e, hrz: wave(p, 1) * 0.1 * e };
    }),
    'emote-dance': move(2.4, [[0.25, 'notes'], [0.75, 'notes']], function (p, e) {
      var s = wave(p, 3);
      return {
        by: Math.abs(Math.sin(p * Math.PI * 6)) * 0.5 * e, brz: s * 0.25 * e,
        aLz: -(1.4 + s * 0.6) * e, aRz: (1.4 - s * 0.6) * e, lLx: s * 0.5 * e, lRx: -s * 0.5 * e
      };
    }),
    // Turns about her middle (2.7 up, her big head included), like a pet's roll in pettricks.js.
    'emote-cartwheel': move(1.8, [[0.5, 'stars']], function (p, e) {
      var a = ease(p) * TAU, h = 2.7;
      return { brz: a, bx: h * Math.sin(a), by: h - h * Math.cos(a) + hump(p) * 0.5, aLz: -2.4 * e, aRz: 2.4 * e };
    }),
    'emote-hero': move(2, [[0.3, 'shine']], function (p, e) {
      return { aLz: -0.7 * e, aRz: 0.7 * e, aLx: 0.4 * e, aRx: 0.4 * e, brx: -0.15 * e, by: Math.sin(Math.min(1, p / 0.3) * Math.PI) * 0.8 };
    }),

    'use-balloon': move(1.6, [[0.5, 'sparkles']], function (p) { return { aRx: -0.9 * hump(p) }; }),
    'use-bubblewand': move(2, [[0.25, 'bubbles'], [0.5, 'bubbles'], [0.75, 'bubbles']], function (p, e) { return { aRx: -1.0 * e }; }),
    'use-pamaypay': move(2, [[0.3, 'breeze'], [0.6, 'breeze']], function (p, e) { return { aRx: -1.2 * e, aRz: (-0.4 + wave(p, 3) * 0.3) * e }; }),
    'use-teddy': move(1.8, [[0.4, 'hearts']], function (p, e) {
      return { aLx: -0.9 * e, aRx: -0.3 * e, aLz: 0.6 * e, aRz: -0.55 * e, brz: wave(p, 1) * 0.1 * e };
    }),
    'use-bouquet': move(2, [[0.35, 'petals'], [0.65, 'petals']], function (p, e) { return { aRx: -1.3 * e, brx: 0.15 * e }; }),
    'use-umbrella': move(2, [[0.5, 'sparkles']], function (p, e) { return { aRx: -2.0 * e, aRz: -0.6 * e }; }),
    'use-ribbonwand': move(2.2, [[0.5, 'sparkles']], function (p, e) {
      return { aRz: (0.8 + wave(p, 2) * 0.8) * e, aRx: -1.0 * e, bry: wave(p, 1) * 0.3 * e };
    }),
    'use-drum': move(2, [[0.2, 'notes'], [0.5, 'notes'], [0.8, 'notes']], function (p, e) {
      return { aLx: -1.0 * e, aRx: (-0.9 - Math.abs(Math.sin(p * Math.PI * 6)) * 0.4) * e };
    }),
    'use-parol': move(2, [[0.4, 'sparkles'], [0.7, 'sparkles']], function (p, e) { return { aRx: -1.8 * e }; }),
    'use-ukulele': move(2.2, [[0.25, 'notes'], [0.5, 'notes'], [0.75, 'notes']], function (p, e) {
      return { aLx: -1.2 * e, aRx: (-1.0 + wave(p, 4) * 0.25) * e };
    }),
    'use-magicwand': move(2, [[0.3, 'sparkles'], [0.6, 'stars'], [0.85, 'sparkles']], function (p, e) {
      return { aRx: (-1.6 + wave(p, 2) * 0.5) * e };
    }),
    'use-trophy': move(2, [[0.35, 'shine'], [0.7, 'shine']], function (p, e) {
      return { aRz: 2.3 * e, aRx: 0.6 * e, by: Math.abs(Math.sin(p * Math.PI * 2)) * 0.4 * e };
    }),

    'idle-princess': move(2, [], function (p) {
      var c = hump(p);
      return { by: -0.35 * c, lLx: 0.3 * c, lRx: -0.2 * c, aLz: -0.5 * c, aRz: 0.5 * c };
    }),
    'idle-hero': move(2, [], function (p, e) { return { aLz: -0.7 * e, aRz: 0.7 * e, aLx: 0.4 * e, aRx: 0.4 * e, brx: -0.12 * e, hrx: -0.1 * e }; }),
    'idle-uniform': move(2, [], function (p, e) { return { aLx: wave(p, 2) * 0.5 * e, aRx: -wave(p, 2) * 0.5 * e }; }),
    'idle-look': move(2.4, [], function (p, e) { return { hry: wave(p, 1) * 0.6 * e }; })
  };

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function find(id) { return typeof id === 'string' && own(MOVES, id) ? MOVES[id] : null; }

  // Offsets at moment p, every key present (0 when the move leaves it alone). p is clamped to 0..1.
  function pose(id, p) {
    var m = find(id), k = Math.max(0, Math.min(1, p)), out = {}, o = m ? m.pose(k, env(k)) : {};
    KEYS.forEach(function (key) { out[key] = typeof o[key] === 'number' ? o[key] : 0; });
    return out;
  }

  // The effect kinds due after moment from, up to and including moment to.
  function effectsBetween(id, from, to) {
    var m = find(id);
    return m ? m.fx.filter(function (f) { return f[0] > from && f[0] <= to; }).map(function (f) { return f[1]; }) : [];
  }

  function forProp(id) { return 'use-' + id; }
  var IDLES = { princess: 'idle-princess', hero: 'idle-hero', uniform: 'idle-uniform' };
  function idleFor(clothes) { return own(IDLES, clothes || '') ? IDLES[clothes] : 'idle-look'; }

  var exported = { KEYS: KEYS, FX: FX, MOVES: MOVES, find: find, pose: pose, effectsBetween: effectsBetween, forProp: forProp, idleFor: idleFor };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Moves = exported;
})(this);
