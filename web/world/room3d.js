/* My Room in 3D: the floor, the walls with the door, the study desk and stool, the mirror, the trophy shelf, the window
   seat at 6x6, the star ceiling, and one builder per catalog piece (BUILDERS). Square maths come from room.js.
   A floor piece is drawn centred on its footprint (it.size[0] * SQ along x, it.size[1] * SQ along z) with its front
   toward +z; long pieces whose long side is their front (aparador, toy piano, aquarium) face -x instead, so the turn
   auto-place gives them along the north wall shows their front to the room. A wall piece is drawn with its back on
   z = 0, facing +z, at its height above the floor. Pieces use the shared toon materials; the room's walls, floor,
   tiles, ghost and glow use their own, so fading or tinting never changes a shared one. A wall between the camera and
   the room turns see-through with everything on it (see()); a faded piece wears see-through copies of its materials. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Room = node ? require('./room.js') : root.World3D.Room;
  var Furniture = node ? require('./furniture.js') : root.World3D.Furniture;

  var SQ = Room.SQ, WALL_H = Room.WALL_H, HALF = Math.PI / 2;
  var WHITE = '#ffffff', CREAM = '#fff4e6', WOOD = '#e7b58c', DARK_WOOD = '#c98f62', GOLD = '#ffd166', INK = '#3a2a4f';
  var LEAF = '#5fcf9a', PINK = '#ff8fab', POT = '#e88a6a', SKY = '#cdeeff';
  var CUP = ['#b8b8c8', '#d39a5c', '#d8dde6', '#ffd166'], CUP_SCALE = 0.7;
  var BOOKS = ['#ff7f7f', '#6aa9ff', '#ffd166', '#5fcf9a', '#a77bff', '#ff9f68', '#ffb8d9'];
  var THICK = 0.3, DOOR_W = 1.7, DOOR_H = 4.0, NOOK_W = 1.8, NOOK_H = 4.2, NOOK_D = 1.7, SHAKE = 0.45, SEE = 0.16;
  var SIDES = ['n', 'e', 'w', 's'];

  function box(S, g, w, h, d, color, x, y, z, r) {
    return S.add(S.rbox(w, h, d, r === undefined ? Math.min(w, h, d) * 0.3 : r), color, x, y, z, g);
  }
  function ball(S, g, r, color, x, y, z) { return S.add(S.ball(r), color, x, y, z, g); }
  function cyl(S, g, rt, rb, h, color, x, y, z, seg) { return S.add(S.cyl(rt, rb, h, seg || 16), color, x, y, z, g); }
  function cone(S, g, r, h, color, x, y, z, seg) { return S.add(S.cone(r, h, seg || 12), color, x, y, z, g); }
  function ring(S, g, r, tube, color, x, y, z) { return S.add(S.torus(r, tube, 8, 24), color, x, y, z, g); }
  function lit(S, color, k) { return S.toon(color, { emissive: color, emissiveIntensity: k || 0.5 }); }
  function sub(S, g, x, y, z) {
    var n = new S.THREE.Group();
    n.position.set(x || 0, y || 0, z || 0);
    g.add(n);
    return n;
  }
  function flat(m) { m.castShadow = false; return m; }
  function pair(fn) { fn(-1); fn(1); }
  // A disc facing +z: a short cylinder turned up.
  function disc(S, g, r, h, color, x, y, z) {
    var m = cyl(S, g, r, r, h, color, x, y, z, 28);
    m.rotation.x = HALF;
    return m;
  }

  // A bed along z with its head at -z.
  function bedBase(S, g, frame, blanket) {
    box(S, g, 2.2, 0.5, 4.5, frame, 0, 0.5, 0.05, 0.15);
    box(S, g, 2.05, 0.45, 4.25, WHITE, 0, 0.95, 0.1, 0.2);
    box(S, g, 2.15, 0.28, 2.75, blanket, 0, 1.15, 0.8, 0.13);
    box(S, g, 2.17, 0.3, 0.42, WHITE, 0, 1.17, -0.62, 0.14);
    box(S, g, 1.45, 0.38, 0.8, WHITE, 0, 1.36, -1.55, 0.19);
  }
  function rugDisc(S, g, r, h, color, y) { return flat(cyl(S, g, r, r, h, color, 0, y, 0, 40)); }
  // A picture frame on the wall: border and inside, centred at height y.
  function frame(S, g, w, h, border, inside, y) {
    box(S, g, w, h, 0.12, border, 0, y, 0.06, 0.05);
    box(S, g, w - 0.24, h - 0.24, 0.1, inside, 0, y, 0.09, 0.03);
  }

  var BUILDERS = {
    'home-bed': function (S, g, it) {
      pair(function (s) { pair(function (t) { cyl(S, g, 0.12, 0.12, 0.3, WOOD, s * 0.92, 0.15, t * 2.05); }); });
      bedBase(S, g, WOOD, it.color);
      box(S, g, 2.3, 2.1, 0.3, it.color, 0, 1.15, -2.2, 0.15);
      pair(function (s) { ball(S, g, 0.2, WHITE, s * 1.05, 2.25, -2.2); });
      box(S, g, 2.3, 1.2, 0.25, it.color, 0, 0.75, 2.2, 0.12);
    },
    'home-rug-round': function (S, g, it) {
      rugDisc(S, g, 2.15, 0.05, WHITE, 0.025);
      rugDisc(S, g, 2.0, 0.06, it.color, 0.03);
      rugDisc(S, g, 1.4, 0.065, WHITE, 0.033);
      rugDisc(S, g, 1.25, 0.07, it.color, 0.035);
      rugDisc(S, g, 0.6, 0.075, '#ffe3f1', 0.038);
    },
    'home-lamp': function (S, g, it) {
      box(S, g, 1.3, 1.3, 1.1, WOOD, 0, 0.65, -0.55, 0.15);
      box(S, g, 1.0, 0.4, 0.06, CREAM, 0, 0.85, 0.0, 0.03);
      ball(S, g, 0.07, GOLD, 0, 0.85, 0.05);
      cyl(S, g, 0.28, 0.34, 0.14, WHITE, 0, 1.37, -0.6);
      cyl(S, g, 0.06, 0.06, 0.8, WHITE, 0, 1.8, -0.6, 8);
      cyl(S, g, 0.36, 0.62, 0.7, lit(S, it.color, 0.6), 0, 2.4, -0.6, 20);
      ball(S, g, 0.08, GOLD, 0, 2.8, -0.6);
    },
    'home-plant': function (S, g, it) {
      cyl(S, g, 0.55, 0.42, 0.9, POT, 0, 0.45, -0.4);
      cyl(S, g, 0.62, 0.62, 0.16, POT, 0, 0.9, -0.4);
      cyl(S, g, 0.52, 0.52, 0.06, '#8b5a2b', 0, 0.95, -0.4);
      ball(S, g, 0.55, it.color, 0, 1.6, -0.4);
      ball(S, g, 0.42, it.color, -0.38, 1.35, -0.2);
      ball(S, g, 0.42, it.color, 0.4, 1.4, -0.55);
      ball(S, g, 0.36, it.color, 0.1, 2.05, -0.3);
      ball(S, g, 0.13, '#ff8fc8', 0.25, 1.9, 0.0);
      ball(S, g, 0.13, '#ffe066', -0.3, 1.65, 0.1);
    },
    'home-poster-stars': function (S, g, it) {
      frame(S, g, 1.7, 2.1, WHITE, it.color, 2.9);
      ball(S, g, 0.3, GOLD, -0.3, 3.4, 0.14).scale.set(1, 1, 0.3);
      ball(S, g, 0.26, it.color, -0.18, 3.48, 0.18).scale.set(1, 1, 0.3);
      [[0.35, 3.3, 0.14], [0.1, 2.75, 0.11], [-0.4, 2.4, 0.12], [0.45, 2.3, 0.1], [0.4, 2.85, 0.07], [-0.15, 2.15, 0.07]].forEach(function (p, k) {
        ball(S, g, p[2], k % 2 ? WHITE : '#fff3b0', p[0], p[1], 0.15).scale.set(1, 1, 0.4);
      });
    },
    'home-poster-rainbow': function (S, g, it) {
      frame(S, g, 1.8, 2.1, it.color, SKY, 2.9);
      ['#ff9aa2', '#ffdac1', '#fff5ba', '#b5ead7', '#c7ceea'].forEach(function (c, k) {
        ring(S, g, 0.74 - k * 0.12, 0.065, c, 0, 2.55, 0.15);
      });
      box(S, g, 1.56, 0.66, 0.06, SKY, 0, 2.21, 0.22, 0.02);
      pair(function (s) {
        ball(S, g, 0.2, WHITE, s * 0.48, 2.62, 0.26).scale.set(1, 0.8, 0.5);
        ball(S, g, 0.15, WHITE, s * 0.7, 2.56, 0.25).scale.set(1, 0.8, 0.5);
      });
    },
    'home-beanbag': function (S, g, it) {
      ball(S, g, 1.0, it.color, 0, 0.72, 0.1).scale.set(1.05, 0.72, 1.05);
      ball(S, g, 0.75, it.color, 0, 1.2, -0.45).scale.set(1, 0.95, 0.7);
      ball(S, g, 0.5, '#c4a6ff', 0, 1.02, 0.25).scale.set(1, 0.35, 1);
    },
    'home-clock': function (S, g, it) {
      var y = 3.0;
      disc(S, g, 0.75, 0.24, it.color, 0, y, 0.12);
      disc(S, g, 0.62, 0.26, CREAM, 0, y, 0.14);
      [0, 1, 2, 3].forEach(function (k) {
        var a = k * HALF;
        ball(S, g, 0.06, INK, Math.sin(a) * 0.48, y + Math.cos(a) * 0.48, 0.28);
      });
      pair(function (s) {
        ball(S, g, 0.22, GOLD, s * 0.48, y + 0.78, 0.12);
        ball(S, g, 0.1, it.color, s * 0.4, y - 0.75, 0.12);
      });
      var hour = sub(S, g, 0, y, 0.3), min = sub(S, g, 0, y, 0.32);
      box(S, hour, 0.08, 0.36, 0.04, INK, 0, 0.16, 0, 0.02);
      box(S, min, 0.06, 0.52, 0.04, INK, 0, 0.24, 0, 0.02);
      ball(S, g, 0.07, it.color, 0, y, 0.34);
      return { animate: function (t) { min.rotation.z = -t * 0.6; hour.rotation.z = -t * 0.05; } };
    },
    'home-toybox': function (S, g, it) {
      box(S, g, 1.8, 1.1, 1.2, it.color, 0, 0.6, -0.4, 0.15);
      box(S, g, 1.82, 0.18, 1.22, WHITE, 0, 0.82, -0.4, 0.06);
      ball(S, g, 0.14, GOLD, 0, 0.82, 0.22);
      var lid = sub(S, g, 0, 1.15, -1.0);
      lid.rotation.x = -1.15;
      box(S, lid, 1.86, 0.14, 1.26, it.color, 0, 0, 0.63, 0.06);
      ball(S, g, 0.3, '#6aa9ff', -0.48, 1.22, -0.3);
      box(S, g, 0.42, 0.42, 0.42, '#ffd166', 0.05, 1.2, -0.25, 0.08).rotation.y = 0.5;
      ball(S, g, 0.3, '#c8945a', 0.5, 1.32, -0.45);
      pair(function (s) { ball(S, g, 0.11, '#c8945a', 0.5 + s * 0.22, 1.58, -0.45); });
      ball(S, g, 0.09, '#f1dcc4', 0.5, 1.28, -0.18);
    },
    'home-plant-tall': function (S, g, it) {
      cyl(S, g, 0.5, 0.38, 1.0, '#ffb38a', 0, 0.5, -0.45);
      cyl(S, g, 0.56, 0.56, 0.14, '#ffb38a', 0, 1.0, -0.45);
      cyl(S, g, 0.07, 0.09, 1.5, '#6b8f3a', 0, 1.75, -0.45, 8);
      [[0.5, 1.45, 0.9], [-0.5, 1.7, -0.8], [0.45, 2.05, 0.7], [-0.4, 2.35, -0.6], [0.3, 2.6, 0.5], [0, 2.75, 0]].forEach(function (p) {
        var leaf = ball(S, g, 0.55, it.color, p[0], p[1], -0.45);
        leaf.scale.set(0.42, 0.95, 0.22);
        leaf.rotation.z = p[2];
      });
    },
    'home-rug-heart': function (S, g, it) {
      function heart(s, color, h, y) {
        flat(box(S, g, 2.2 * s, h, 2.2 * s, color, 0, y, 0.16, 0.02)).rotation.y = Math.PI / 4;
        pair(function (k) { flat(cyl(S, g, 1.1 * s, 1.1 * s, h, color, k * 0.778 * s, y, 0.16 - 0.778 * s, 32)); });
      }
      heart(1.1, WHITE, 0.05, 0.025);
      heart(1.0, it.color, 0.06, 0.03);
      heart(0.45, '#ffd6e7', 0.065, 0.034);
    },
    'home-window': function (S, g, it) {
      box(S, g, 1.8, 2.0, 0.16, WHITE, 0, 3.0, 0.08, 0.06);
      box(S, g, 1.5, 1.7, 0.1, lit(S, it.color, 0.35), 0, 3.0, 0.12, 0.03);
      box(S, g, 0.1, 1.7, 0.08, WHITE, 0, 3.0, 0.2, 0.03);
      box(S, g, 1.5, 0.1, 0.08, WHITE, 0, 3.0, 0.2, 0.03);
      box(S, g, 2.1, 0.16, 0.5, WHITE, 0, 1.95, 0.25, 0.06);
      cyl(S, g, 0.2, 0.15, 0.3, POT, 0, 2.18, 0.3);
      ball(S, g, 0.16, LEAF, 0, 2.42, 0.3);
      ['#ff8fc8', '#ffe066', '#c77dff'].forEach(function (c, k) { ball(S, g, 0.12, c, -0.18 + k * 0.18, 2.55 + (k % 2) * 0.08, 0.36); });
      pair(function (s) { box(S, g, 0.36, 2.2, 0.1, PINK, s * 1.0, 3.05, 0.26, 0.05); });
    },
    'home-pet-bed': function (S, g, it) {
      ring(S, g, 0.72, 0.3, it.color, 0, 0.3, -0.1).rotation.x = HALF;
      cyl(S, g, 0.74, 0.74, 0.22, CREAM, 0, 0.2, -0.1, 24);
      box(S, g, 0.5, 0.12, 0.14, WHITE, 0.15, 0.38, 0.0, 0.05).rotation.y = 0.4;
      pair(function (s) { pair(function (t) { ball(S, g, 0.09, WHITE, 0.15 + s * 0.23 * Math.cos(0.4) + t * 0.06, 0.38, s * -0.23 * Math.sin(0.4) + t * 0.05); }); });
      ball(S, g, 0.2, '#ff6f91', -0.75, 0.2, 0.75);
    },
    'home-globe': function (S, g, it) {
      cyl(S, g, 0.45, 0.5, 0.1, WOOD, 0, 0.05, -0.3);
      cyl(S, g, 0.09, 0.09, 1.2, WOOD, 0, 0.65, -0.3, 8);
      cyl(S, g, 0.65, 0.65, 0.12, WOOD, 0, 1.3, -0.3, 24);
      cyl(S, g, 0.22, 0.3, 0.14, GOLD, 0, 1.43, -0.3);
      cyl(S, g, 0.04, 0.04, 0.3, GOLD, 0, 1.6, -0.3, 6);
      var tilt = sub(S, g, 0, 2.2, -0.3);
      tilt.rotation.z = 0.4;
      ring(S, tilt, 0.66, 0.035, GOLD, 0, 0, 0).rotation.y = HALF;
      var spin = sub(S, tilt, 0, 0, 0);
      ball(S, spin, 0.58, it.color, 0, 0, 0);
      [[0.3, 0.25, 0.4], [-0.38, -0.1, 0.35], [0.12, -0.32, -0.45], [-0.2, 0.36, -0.38], [0.48, -0.1, -0.18]].forEach(function (p) {
        ball(S, spin, 0.22, '#7fdc8b', p[0], p[1], p[2]).scale.set(1, 0.8, 1);
      });
      return { animate: function (t) { spin.rotation.y = t * 0.6; } };
    },
    'home-lights': function (S, g, it) {
      var mats = [it.color, '#ffb3d9', '#b8f2ff'].map(function (c) { return S.toon(c, { emissive: c, emissiveIntensity: 0.6 }, true); });
      var n = 10, pts = [];
      for (var k = 0; k <= n; k++) {
        var u = k / n;
        pts.push([-2.25 + u * 4.5, 4.9 - Math.abs(Math.sin(u * Math.PI * 2)) * 0.45]);
      }
      for (var j = 0; j < n; j++) {
        var a = pts[j], b = pts[j + 1], dx = b[0] - a[0], dy = b[1] - a[1];
        var w = cyl(S, g, 0.025, 0.025, 1, '#6b8f3a', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.12, 5);
        w.scale.y = Math.sqrt(dx * dx + dy * dy);
        w.rotation.z = Math.atan2(-dx, dy);
      }
      pts.forEach(function (p, k) {
        if (k === 0 || k === n) return;
        S.add(S.ball(0.13), mats[k % 3], p[0], p[1] - 0.15, 0.16, g).scale.set(1, 1.25, 1);
      });
      pair(function (s) { ball(S, g, 0.08, '#6b8f3a', s * 2.25, 4.9, 0.08); });
      return {
        animate: function (t) { mats.forEach(function (m, k) { m.emissiveIntensity = 0.45 + Math.max(0, Math.sin(t * 2.4 + k * 2.1)) * 0.6; }); },
        mats: mats
      };
    },
    'home-tea-table': function (S, g, it) {
      pair(function (s) { cyl(S, g, 0.4, 0.42, 0.18, PINK, 0, 0.09, s * 0.78, 20); });
      cyl(S, g, 0.45, 0.5, 0.08, WOOD, 0, 0.04, 0);
      cyl(S, g, 0.11, 0.11, 0.7, WOOD, 0, 0.42, 0, 8);
      cyl(S, g, 0.85, 0.85, 0.14, it.color, 0, 0.82, 0, 28);
      ball(S, g, 0.26, WHITE, 0, 1.12, 0).scale.set(1, 0.85, 1);
      ball(S, g, 0.09, it.color, 0, 1.36, 0);
      cone(S, g, 0.06, 0.28, WHITE, 0.3, 1.16, 0, 8).rotation.z = -1.0;
      ring(S, g, 0.12, 0.03, WHITE, -0.27, 1.13, 0);
      [[0.5, 0.25], [-0.45, 0.35], [0.1, -0.55]].forEach(function (p) {
        cyl(S, g, 0.1, 0.08, 0.14, WHITE, p[0], 0.96, p[1], 12);
      });
    },
    'home-rocking-chair': function (S, g, it) {
      var rock = sub(S, g, 0, 0, 0);
      pair(function (s) {
        ball(S, rock, 1, DARK_WOOD, s * 0.55, 0.16, 0).scale.set(0.07, 0.18, 0.95);
        cyl(S, rock, 0.06, 0.06, 0.62, it.color, s * 0.55, 0.52, 0.35, 8);
        cyl(S, rock, 0.06, 0.06, 0.62, it.color, s * 0.55, 0.52, -0.35, 8);
        box(S, rock, 0.14, 0.12, 0.95, it.color, s * 0.66, 1.4, 0.05, 0.05);
        cyl(S, rock, 0.05, 0.05, 0.5, it.color, s * 0.66, 1.12, 0.45, 8);
      });
      box(S, rock, 1.3, 0.16, 1.1, it.color, 0, 0.87, 0, 0.06);
      box(S, rock, 1.1, 0.18, 0.95, PINK, 0, 1.0, 0.03, 0.08);
      var back = sub(S, rock, 0, 0.9, -0.5);
      back.rotation.x = -0.18;
      box(S, back, 1.3, 1.7, 0.12, it.color, 0, 0.85, 0, 0.06);
      box(S, back, 1.0, 0.9, 0.14, PINK, 0, 0.75, 0.06, 0.07);
      box(S, back, 1.45, 0.18, 0.18, it.color, 0, 1.72, 0, 0.08);
      return { animate: function (t) { rock.rotation.x = Math.sin(t * 1.6) * 0.07; } };
    },
    'home-bookcase': function (S, g, it) {
      var z = -0.68;
      pair(function (s) { box(S, g, 0.12, 3.2, 0.8, it.color, s * 0.96, 1.6, z, 0.04); });
      box(S, g, 2.0, 3.1, 0.08, DARK_WOOD, 0, 1.6, z - 0.36, 0.03);
      box(S, g, 2.16, 0.16, 0.9, it.color, 0, 3.22, z, 0.06);
      [0.1, 1.15, 2.2].forEach(function (y, row) {
        box(S, g, 1.84, 0.1, 0.76, it.color, 0, y, z, 0.03);
        var x = -0.78;
        for (var k = 0; k < 4; k++) {
          var w = 0.22 + ((k + row) % 3) * 0.06, h = 0.62 + ((k * 2 + row) % 3) * 0.12;
          box(S, g, w, h, 0.6, BOOKS[(k + row * 2) % BOOKS.length], x + w / 2, y + 0.05 + h / 2, z + 0.02, 0.04);
          x += w + 0.08;
        }
      });
      ball(S, g, 0.2, '#5fcf9a', 0.55, 2.42, z);
    },
    'home-easel': function (S, g, it) {
      pair(function (s) { box(S, g, 0.1, 3.0, 0.1, it.color, s * 0.55, 1.45, -0.35, 0.04).rotation.z = s * 0.14; });
      box(S, g, 0.1, 2.8, 0.1, it.color, 0, 1.35, -0.85, 0.04).rotation.x = 0.35;
      box(S, g, 1.4, 0.08, 0.28, it.color, 0, 1.58, -0.25, 0.03);
      var pic = sub(S, g, 0, 2.3, -0.38);
      pic.rotation.x = -0.12;
      box(S, pic, 1.4, 1.1, 0.08, WHITE, 0, 0, 0, 0.03);
      ball(S, pic, 0.18, '#ffd166', 0.35, 0.25, 0.05).scale.set(1, 1, 0.2);
      ball(S, pic, 0.45, '#7fdc8b', -0.25, -0.5, 0.04).scale.set(1.2, 0.5, 0.15);
      ball(S, pic, 0.12, '#ff8fc8', -0.4, 0.05, 0.05).scale.set(1, 1, 0.2);
      ball(S, pic, 0.1, '#6aa9ff', 0.05, 0.3, 0.05).scale.set(1.6, 0.6, 0.2);
      cyl(S, g, 0.32, 0.32, 0.05, CREAM, 0.2, 1.65, -0.22, 20);
      ['#ff6f91', '#6aa9ff', '#ffd166'].forEach(function (c, k) { ball(S, g, 0.06, c, 0.05 + k * 0.13, 1.69, -0.18); });
    },
    // Front toward -x (its long side).
    'home-aparador': function (S, g, it) {
      pair(function (s) { pair(function (t) { cyl(S, g, 0.08, 0.08, 0.25, DARK_WOOD, 0.5 + s * 0.4, 0.12, t * 1.6, 8); }); });
      box(S, g, 1.1, 3.0, 3.6, it.color, 0.5, 1.75, 0, 0.12);
      box(S, g, 1.24, 0.2, 3.8, it.color, 0.5, 3.18, 0, 0.08);
      pair(function (s) {
        box(S, g, 0.08, 2.5, 1.66, '#c8945a', -0.06, 1.9, s * 0.88, 0.04);
        box(S, g, 0.1, 1.4, 0.9, '#d9a670', -0.1, 2.1, s * 0.88, 0.05);
        ball(S, g, 0.08, GOLD, -0.14, 1.85, s * 0.16);
      });
      box(S, g, 0.08, 0.32, 3.3, '#c8945a', -0.06, 0.45, 0, 0.04);
      ball(S, g, 0.07, GOLD, -0.12, 0.45, 0);
    },
    // Front toward -x (its long side).
    'home-piano': function (S, g, it) {
      box(S, g, 1.0, 1.9, 3.4, it.color, 0.55, 0.98, 0, 0.14);
      box(S, g, 1.1, 0.12, 3.5, '#ffc2c2', 0.55, 1.98, 0, 0.05);
      box(S, g, 0.62, 0.2, 3.2, it.color, -0.2, 1.22, 0, 0.06);
      box(S, g, 0.58, 0.12, 3.1, WHITE, -0.2, 1.38, 0, 0.04);
      for (var k = 0; k < 6; k++) box(S, g, 0.34, 0.1, 0.14, INK, -0.08, 1.48, -1.25 + k * 0.5 + (k > 2 ? 0.1 : 0), 0.03);
      var stand = sub(S, g, 0.3, 2.35, 0);
      stand.rotation.z = -0.2;
      box(S, stand, 0.06, 0.66, 1.1, WHITE, 0, 0, 0, 0.02);
      ball(S, stand, 0.07, INK, -0.04, 0.1, -0.2);
      ball(S, stand, 0.07, INK, -0.04, -0.05, 0.25);
      cyl(S, g, 0.42, 0.42, 0.18, '#ff6f91', -0.85, 0.95, 0, 20);
      cyl(S, g, 0.07, 0.07, 0.85, WHITE, -0.85, 0.45, 0, 8);
      cyl(S, g, 0.3, 0.32, 0.06, WHITE, -0.85, 0.03, 0, 16);
    },
    'home-bed-cloud': function (S, g, it) {
      bedBase(S, g, '#dfe8ff', '#bcd8ff');
      [-1.5, 0, 1.5].forEach(function (z) { pair(function (s) { ball(S, g, 0.42, it.color, s * 0.88, 0.5, z); }); });
      ball(S, g, 0.72, it.color, 0, 1.8, -2.05);
      pair(function (s) {
        ball(S, g, 0.55, it.color, s * 0.7, 1.55, -2.05);
        ball(S, g, 0.42, it.color, s * 0.38, 2.4, -2.05);
      });
      ball(S, g, 0.45, it.color, 0, 0.55, 2.15);
      ball(S, g, 0.14, GOLD, 0.5, 1.37, 1.4).scale.set(1, 0.6, 1);
    },
    'home-dollhouse': function (S, g, it) {
      box(S, g, 1.9, 0.4, 1.4, WHITE, 0, 0.2, -0.35, 0.1);
      box(S, g, 1.6, 1.4, 1.1, it.color, 0, 1.1, -0.4, 0.1);
      var roof = cone(S, g, 1.35, 0.95, '#ff6f91', 0, 2.27, -0.4, 4);
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.75;
      box(S, g, 0.24, 0.45, 0.24, '#ff6f91', 0.42, 2.45, -0.6, 0.05);
      pair(function (s) { box(S, g, 0.34, 0.34, 0.06, lit(S, SKY, 0.3), s * 0.45, 1.4, 0.16, 0.05); });
      box(S, g, 0.34, 0.6, 0.06, '#c98b6b', 0, 0.72, 0.16, 0.05);
      ball(S, g, 0.05, GOLD, 0.1, 0.72, 0.2);
      ball(S, g, 0.13, GOLD, 0, 2.05, 0.06);
      cyl(S, g, 0.06, 0.06, 0.5, '#c48a6a', 0.75, 0.65, 0.12, 6);
      ball(S, g, 0.24, LEAF, 0.75, 1.0, 0.12);
    },
    'home-telescope': function (S, g, it) {
      [0, 1, 2].forEach(function (k) {
        var leg = sub(S, g, 0, 0, -0.2);
        leg.rotation.y = k * Math.PI * 2 / 3;
        box(S, leg, 0.08, 2.0, 0.08, '#c8945a', 0, 0.95, 0.35, 0.03).rotation.x = -0.36;
      });
      ball(S, g, 0.16, INK, 0, 1.95, -0.2);
      var tube = sub(S, g, 0, 2.1, -0.2);
      tube.rotation.x = -0.9;
      cyl(S, tube, 0.22, 0.28, 1.8, it.color, 0, 0.2, 0, 20);
      cyl(S, tube, 0.32, 0.32, 0.14, GOLD, 0, 1.12, 0, 20);
      cyl(S, tube, 0.28, 0.28, 0.02, lit(S, SKY, 0.5), 0, 1.2, 0, 20);
      cyl(S, tube, 0.09, 0.11, 0.35, INK, 0, -0.85, 0, 10);
      cyl(S, tube, 0.07, 0.07, 0.5, GOLD, 0.26, 0.5, 0, 8);
    },
    'home-tent': function (S, g, it) {
      var tent = cone(S, g, 2.6, 3.2, it.color, 0, 1.6, 0, 4);
      tent.rotation.y = Math.PI / 4;
      var cap = cone(S, g, 0.98, 1.15, WHITE, 0, 2.645, 0, 4);
      cap.rotation.y = Math.PI / 4;
      var door = box(S, g, 1.0, 1.5, 0.08, '#7a4b12', 0, 0.75, 1.42, 0.35);
      door.rotation.x = -0.52;
      pair(function (s) { box(S, g, 0.45, 1.6, 0.06, PINK, s * 0.6, 0.78, 1.48, 0.03).rotation.set(-0.52, 0, s * 0.35); });
      cyl(S, g, 0.04, 0.04, 0.9, INK, 0, 3.55, 0, 6);
      box(S, g, 0.5, 0.32, 0.04, '#ff6f91', 0.27, 3.82, 0, 0.02);
      [[-1.2, 1.3], [1.2, 1.3], [-1.3, -1.2], [1.3, -1.2]].forEach(function (p) { ball(S, g, 0.12, GOLD, p[0], 0.12, p[1] * 1.05); });
    },
    'home-bunk-bed': function (S, g, it) {
      pair(function (s) { pair(function (t) { box(S, g, 0.18, 3.3, 0.18, it.color, s * 0.98, 1.65, t * 2.12, 0.06); }); });
      [[0.35, '#ff8fab'], [1.95, '#ffd166']].forEach(function (lv) {
        var y = lv[0];
        box(S, g, 1.95, 0.25, 4.2, it.color, 0, y, 0, 0.08);
        box(S, g, 1.85, 0.4, 4.05, WHITE, 0, y + 0.3, 0.02, 0.18);
        box(S, g, 1.92, 0.22, 2.6, lv[1], 0, y + 0.48, 0.7, 0.1);
        box(S, g, 1.3, 0.32, 0.7, WHITE, 0, y + 0.62, -1.55, 0.15);
      });
      pair(function (t) { box(S, g, 1.9, 0.3, 0.1, it.color, 0, 3.05, t * 2.12, 0.05); });
      box(S, g, 0.1, 0.32, 2.4, it.color, -0.98, 2.75, -0.8, 0.04);
      pair(function (s) { box(S, g, 0.08, 2.4, 0.08, WHITE, -1.08, 1.2, 1.5 + s * 0.3, 0.03); });
      [0.7, 1.3, 1.9].forEach(function (y) { box(S, g, 0.08, 0.08, 0.6, WHITE, -1.08, y, 1.5, 0.03); });
    },
    'home-canopy-bed': function (S, g, it) {
      box(S, g, 3.4, 0.6, 4.0, WHITE, 0, 0.45, 0.1, 0.2);
      box(S, g, 3.2, 0.5, 3.8, WHITE, 0, 0.95, 0.1, 0.22);
      box(S, g, 3.3, 0.3, 2.6, it.color, 0, 1.15, 0.75, 0.14);
      box(S, g, 3.32, 0.32, 0.42, WHITE, 0, 1.17, -0.65, 0.14);
      pair(function (s) { box(S, g, 1.2, 0.42, 0.75, WHITE, s * 0.75, 1.38, -1.4, 0.2); });
      box(S, g, 3.6, 2.0, 0.3, it.color, 0, 1.2, -1.95, 0.15);
      ball(S, g, 0.24, GOLD, 0, 2.3, -1.95);
      pair(function (s) { pair(function (t) { cyl(S, g, 0.09, 0.09, 3.1, GOLD, s * 1.72, 1.55, t > 0 ? 2.0 : -1.95, 8); }); });
      box(S, g, 3.75, 0.18, 4.25, it.color, 0, 3.15, 0.02, 0.08);
      ball(S, g, 1.9, '#f3e0ff', 0, 3.2, 0.02).scale.set(0.95, 0.07, 1.08);
      pair(function (s) {
        pair(function (t) { box(S, g, 0.55, 2.2, 0.1, '#f3e0ff', s * 1.45, 2.0, t > 0 ? 1.95 : -1.85, 0.05); });
        ball(S, g, 0.1, GOLD, s * 1.45, 1.6, 2.02);
      });
    },
    // Front toward -x (its long side).
    'home-aquarium': function (S, g, it) {
      var glass = S.toon(it.color, { transparent: true, opacity: 0.38, depthWrite: false });
      box(S, g, 1.1, 1.2, 3.6, WHITE, 0.55, 0.6, 0, 0.1);
      box(S, g, 0.06, 0.8, 3.0, '#d6f3fa', -0.02, 0.6, 0, 0.03);
      box(S, g, 0.95, 0.14, 3.3, '#ffe6a8', 0.55, 1.28, 0, 0.04);
      S.add(S.rbox(1.0, 1.5, 3.4, 0.08), glass, 0.55, 1.95, 0, g);
      box(S, g, 1.08, 0.12, 3.48, WHITE, 0.55, 2.74, 0, 0.05);
      [[-1.2, 0.5], [1.1, 0.7], [0.7, 0.4]].forEach(function (p) { cone(S, g, 0.11, p[1], LEAF, 0.6, 1.35 + p[1] / 2, p[0], 6); });
      ball(S, g, 0.16, '#b8b8c8', 0.65, 1.38, -0.5).scale.set(1.3, 0.7, 1);
      var fish = ['#ff9f43', '#ff6f91', '#ffd166'].map(function (c, k) {
        var f = sub(S, g, 0.45 + k * 0.08, 1.65 + k * 0.28, 0);
        ball(S, f, 0.15, c, 0, 0, 0).scale.set(0.5, 0.85, 1.2);
        cone(S, f, 0.12, 0.2, c, 0, 0, -0.22, 6).rotation.x = HALF;
        return f;
      });
      var bubbles = [0, 1, 2].map(function (k) { return ball(S, g, 0.05 + k * 0.015, WHITE, 0.5, 1.5, 0.9 - k * 0.15); });
      return {
        animate: function (t) {
          fish.forEach(function (f, k) {
            var a = t * (0.5 + k * 0.15) + k * 2;
            f.position.z = Math.sin(a) * 1.25;
            f.rotation.y = Math.cos(a) >= 0 ? 0 : Math.PI;
          });
          bubbles.forEach(function (b, k) { b.position.y = 1.4 + ((t * 0.5 + k / 3) % 1) * 1.2; });
        }
      };
    },
    'home-streak-lamp': function (S, g, it) {
      cyl(S, g, 0.45, 0.55, 1.0, WHITE, 0, 0.5, -0.35, 20);
      cyl(S, g, 0.52, 0.52, 0.1, GOLD, 0, 1.03, -0.35, 20);
      cyl(S, g, 0.45, 0.24, 0.36, GOLD, 0, 1.25, -0.35, 20);
      var flame = sub(S, g, 0, 1.45, -0.35);
      S.add(S.ball(0.32), lit(S, it.color, 0.8), 0, 0, 0, flame);
      S.add(S.cone(0.3, 0.75, 14), lit(S, it.color, 0.8), 0, 0.42, 0, flame);
      S.add(S.cone(0.16, 0.45, 12), lit(S, '#ffe066', 0.9), 0, 0.22, 0.2, flame);
      return { animate: function (t) { var k = 1 + Math.sin(t * 9) * 0.05 + Math.sin(t * 13) * 0.03; flame.scale.set(1 / k, k, 1 / k); } };
    },
    'home-boss-rug': function (S, g, it) {
      flat(box(S, g, 4.3, 0.05, 3.5, GOLD, 0, 0.025, 0, 0.02));
      flat(box(S, g, 4.0, 0.06, 3.2, it.color, 0, 0.03, 0, 0.02));
      flat(cyl(S, g, 0.95, 0.95, 0.065, GOLD, 0, 0.033, 0, 32));
      flat(cyl(S, g, 0.75, 0.75, 0.07, '#8e1c12', 0, 0.035, 0, 32));
      pair(function (s) { flat(cone(S, g, 0.22, 0.6, GOLD, s * 0.32, 0.075, -0.25, 4)).rotation.set(-HALF, 0, s * 0.5); });
      flat(ball(S, g, 0.25, GOLD, 0, 0.07, 0.1)).scale.set(1, 0.15, 0.8);
      pair(function (s) { pair(function (t) { ball(S, g, 0.13, GOLD, s * 2.12, 0.08, t * 1.72); }); });
    },
    'home-gold-frame': function (S, g, it) {
      var gold = S.toon(it.color, { emissive: '#b8860b', emissiveIntensity: 0.25 });
      S.add(S.rbox(1.75, 2.15, 0.16, 0.06), gold, 0, 2.95, 0.08, g);
      box(S, g, 1.35, 1.75, 0.1, '#fff4d6', 0, 2.95, 0.12, 0.03);
      pair(function (s) { pair(function (t) { S.add(S.ball(0.14), gold, s * 0.85, 2.95 + t * 1.05, 0.15, g); }); });
      S.add(S.ball(0.2), gold, 0, 4.12, 0.1, g);
      pair(function (s) { box(S, g, 0.22, 0.65, 0.04, s < 0 ? '#6aa9ff' : '#ff6f91', s * 0.13, 3.35, 0.18, 0.02).rotation.z = s * 0.3; });
      disc(S, g, 0.34, 0.08, it.color, 0, 2.78, 0.2);
      disc(S, g, 0.24, 0.09, '#ffe8a3', 0, 2.78, 0.21);
      ball(S, g, 0.09, WHITE, 0, 2.78, 0.26);
    },
    'home-book-tower': function (S, g, it) {
      for (var k = 0; k < 7; k++) {
        var w = 1.5 - (k % 3) * 0.12;
        box(S, g, w, 0.34, 1.05, BOOKS[k], (k % 2 ? 0.06 : -0.05), 0.18 + k * 0.36, -0.3, 0.07).rotation.y = (k % 3 - 1) * 0.18;
        box(S, g, w - 0.1, 0.24, 0.06, CREAM, (k % 2 ? 0.06 : -0.05), 0.18 + k * 0.36, 0.2, 0.02).rotation.y = (k % 3 - 1) * 0.18;
      }
      pair(function (s) { box(S, g, 0.6, 0.06, 0.8, WHITE, s * 0.3, 2.68, -0.3, 0.02).rotation.z = -s * 0.25; });
      ball(S, g, 0.18, GOLD, 0, 3.0, -0.3);
    },
    'home-hoot-plush': function (S, g, it) {
      var DARK = '#86624a';
      cyl(S, g, 0.8, 0.85, 0.3, '#ffb8d9', 0, 0.15, -0.2, 24);
      ball(S, g, 0.72, it.color, 0, 0.95, -0.2).scale.set(1, 1.05, 0.95);
      ball(S, g, 0.48, '#f1dcc4', 0, 0.88, 0.2).scale.set(1, 1.1, 0.5);
      pair(function (s) {
        ball(S, g, 0.4, DARK, s * 0.68, 0.95, -0.2).scale.set(0.45, 1, 0.9);
        ball(S, g, 0.13, '#ff9e3d', s * 0.25, 0.32, 0.3).scale.set(1, 0.6, 1.3);
        ball(S, g, 0.19, WHITE, s * 0.22, 1.85, 0.25);
        ball(S, g, 0.09, INK, s * 0.22, 1.85, 0.42);
        ring(S, g, 0.22, 0.03, INK, s * 0.22, 1.85, 0.38);
        cone(S, g, 0.14, 0.35, DARK, s * 0.4, 2.3, -0.25, 6).rotation.z = -s * 0.3;
      });
      ball(S, g, 0.6, it.color, 0, 1.85, -0.25);
      cone(S, g, 0.09, 0.22, '#ff9e3d', 0, 1.66, 0.36, 6).rotation.x = Math.PI;
      box(S, g, 1.0, 0.08, 1.0, '#2b2140', 0, 2.48, -0.25, 0.03).rotation.y = Math.PI / 4;
      cyl(S, g, 0.36, 0.36, 0.2, '#2b2140', 0, 2.38, -0.25, 16);
      ball(S, g, 0.09, GOLD, 0.45, 2.3, 0.05);
    }
  };

  // Builds catalog piece id into a new group: { group, animate(t), mats } (mats: its own materials, freed with it).
  function piece(S, id) {
    var it = Furniture.find(id), g = new S.THREE.Group();
    var r = (it && Object.prototype.hasOwnProperty.call(BUILDERS, id) ? BUILDERS[id](S, g, it) : null) || {};
    return { group: g, animate: r.animate || null, mats: r.mats || [] };
  }

  // The inner face of wall side at distance along from where its squares start counting; rot turns local +z inward.
  function wallPoint(side, along, L) {
    if (side === 'n') return { x: along, z: -L, rot: 0, nx: 0, nz: 1 };
    if (side === 's') return { x: along, z: 0, rot: Math.PI, nx: 0, nz: -1 };
    if (side === 'w') return { x: 0, z: -along, rot: HALF, nx: 1, nz: 0 };
    return { x: L, z: -along, rot: -HALF, nx: -1, nz: 0 };
  }

  // Puts a piece's group where p says, in the room's own coordinates (south-west corner at 0, rows toward -z).
  function placeNode(n, it, p, size) {
    if (it.kind === 'wall') {
      var w = wallPoint(p.side, (p.i + it.size[0] / 2) * SQ, size * SQ);
      n.position.set(w.x, 0, w.z);
      n.rotation.y = w.rot;
      return;
    }
    var t = p.turn || 0, wd = t % 2 ? [it.size[1], it.size[0]] : [it.size[0], it.size[1]];
    n.position.set((p.c + wd[0] / 2) * SQ, 0, -(p.r + wd[1] / 2) * SQ);
    n.rotation.y = t * HALF;
  }

  function star(x, cx, cy, r) {
    x.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -HALF + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
    x.fill();
  }
  // Floor and wall pictures, each one square of the pattern.
  var PATTERNS = {
    wood: function (x, color) {
      x.fillStyle = color; x.fillRect(0, 0, 128, 128);
      for (var k = 0; k < 4; k++) {
        x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, k * 32 + 12, 128, 3);
        x.fillStyle = 'rgba(110,60,20,.28)'; x.fillRect(0, k * 32, 128, 3);
        x.fillRect(k % 2 ? 40 : 100, k * 32, 3, 32);
      }
    },
    tile: function (x, color) {
      x.fillStyle = color; x.fillRect(0, 0, 128, 128);
      x.fillStyle = 'rgba(255,255,255,.5)';
      [[6, 6], [70, 6], [6, 70], [70, 70]].forEach(function (p) { x.fillRect(p[0], p[1], 16, 5); });
      x.fillStyle = 'rgba(120,140,170,.4)';
      [0, 64].forEach(function (v) { x.fillRect(v, 0, 3, 128); x.fillRect(0, v, 128, 3); });
    },
    checker: function (x, color) {
      x.fillStyle = color; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#ffc6dc'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
    },
    stars: function (x, color) {
      x.fillStyle = color; x.fillRect(0, 0, 256, 256);
      [[40, 50, 14], [150, 30, 9], [210, 110, 13], [90, 140, 10], [30, 210, 9], [170, 200, 14], [120, 80, 6], [230, 230, 6]].forEach(function (s, k) {
        x.fillStyle = k % 3 ? '#fff3b0' : '#ffffff';
        star(x, s[0], s[1], s[2]);
      });
      x.fillStyle = 'rgba(255,255,255,.7)';
      [[80, 20], [200, 60], [20, 120], [130, 230], [240, 170], [60, 180]].forEach(function (d) { x.fillRect(d[0], d[1], 3, 3); });
    }
  };

  // The room. o = { grade (the shelf: two rows for Grade 5), apps (Layout.APPS of the room's grade), stars }.
  function create(S, o) {
    var THREE = S.THREE, doc = typeof document !== 'undefined' ? document : root.document;
    var apps = o.apps || [], two = o.grade === 'grade2', O = Room.ORIGIN;
    var group = new THREE.Group();
    group.position.set(O.x, 0, O.z);
    S.scene.add(group);
    var fixed = sub(S, group), items = sub(S, group);
    var myGeos = {}, myMats = [], myTex = [], mySprites = [];
    var size = 0, L = 0, state = { size: 0, placed: [], wall: '', floor: '', stars: !!o.stars, trophies: {} };
    var shell = null, starSprites = [], floorTiles = {}, wallTiles = {}, tileList = [];
    var recs = [], selK = null, outline = null, glowSet = {}, faded = false, ghostRec = null, preview = {};
    var cups = {}, cupAt = {}, mirrorSign = null;
    // Each wall's see-through state: its own wall and trim materials fade in place (direct); what stands on it (door,
    // mirror, shelf, alcove, wall pieces) swaps to see-through copies. sideOn is what shows, camOut where the camera is.
    var direct = {}, directList = [], fixedOn = {}, shellOn = {}, sideOn = {}, camOut = {}, seeCopies = {};
    SIDES.forEach(function (sd) { direct[sd] = []; fixedOn[sd] = []; shellOn[sd] = []; sideOn[sd] = false; camOut[sd] = false; });

    function geo(key, make) { return myGeos[key] || (myGeos[key] = make()); }
    function mat(m) { myMats.push(m); return m; }
    function fadesWith(side, m) {
      direct[side].push({ m: m, t: m.transparent, o: m.opacity, d: m.depthWrite });
      directList.push(m);
      return m;
    }
    function sprite(tex, w, h) { var s = S.sprite(tex, w, h); mySprites.push(s.material); return s; }
    function paint(w, h, draw) {
      var c = doc.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'));
      var t = S.canvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      myTex.push(t);
      return t;
    }
    var emojis = {};
    function emojiTex(e) { if (!emojis[e]) { emojis[e] = S.emoji(e); myTex.push(emojis[e]); } return emojis[e]; }

    var wallMats = {}, trimMats = {};
    SIDES.forEach(function (sd) {
      wallMats[sd] = fadesWith(sd, mat(S.toon('#ffd6e7', null, true)));
      trimMats[sd] = fadesWith(sd, mat(S.toon(WHITE, null, true)));
    });
    var floorMat = mat(S.toon(WHITE, null, true));
    var gridTex = paint(64, 64, function (x) { x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60); });
    var hideMat = mat(new THREE.MeshBasicMaterial({ visible: false }));
    var gridMat = mat(new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, depthWrite: false }));
    var glowFloor = mat(new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.6, depthWrite: false }));
    var glowWall = mat(new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    var selMat = mat(new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.9 }));
    var floorTex = {}, wallTex = {};

    // A wall box w wide standing from y0 to y1, its picture scaled so one square of pattern covers one wall square.
    function wallBox(w, y0, y1) {
      return geo('wb' + [w, y0, y1], function () {
        var b = new THREE.BoxGeometry(w, y1 - y0, THICK), uv = b.attributes.uv;
        for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / SQ, (y0 + uv.getY(i) * (y1 - y0)) / WALL_H);
        return b;
      });
    }
    // The piece of wall side from a to b (distances along it), standing from y0 to y1.
    function wallPiece(parent, side, a, b, y0, y1, m) {
      var p = wallPoint(side, (a + b) / 2, L), w = S.add(wallBox(b - a, y0, y1), m, p.x - p.nx * THICK / 2, (y0 + y1) / 2, p.z - p.nz * THICK / 2, parent);
      w.rotation.y = p.rot;
      w.castShadow = false;
      return w;
    }
    // A strip along wall side from a to b (distances along it), lifted off the inner face by out.
    function strip(parent, side, a, b, h, d, y, out, color) {
      var p = wallPoint(side, (a + b) / 2, L), m = S.add(S.rbox(b - a, h, d, 0.04), color, p.x + p.nx * out, y, p.z + p.nz * out, parent);
      m.rotation.y = p.rot;
      m.castShadow = false;
      return m;
    }

    function buildShell() {
      if (shell) {
        group.remove(shell);
        starSprites.forEach(function (s) { s.material.dispose(); });
      }
      L = size * SQ;
      shell = sub(S, group);
      floorTiles = {}; wallTiles = {}; tileList = []; starSprites = [];
      SIDES.forEach(function (sd) { shellOn[sd] = []; });
      var base = flat(S.add(geo('base', function () { return new THREE.PlaneGeometry(160, 160); }), S.toon('#ffe3f1'), L / 2, -0.6, -L / 2, shell));
      base.rotation.x = -HALF;
      flat(S.add(S.rbox(L + 1.6, 0.6, L + 1.6, 0.3), '#fff6fb', L / 2, -0.31, -L / 2, shell));
      var fl = flat(S.add(geo('floor' + size, function () { return new THREE.PlaneGeometry(L, L); }), floorMat, L / 2, 0, -L / 2, shell));
      fl.rotation.x = -HALF;

      var sw = (SQ - DOOR_W) / 2, nw = (SQ - NOOK_W) / 2;
      // Openings: the door in s1 and, at 6x6, the window seat's alcove in n5. North and south walls cover the corners.
      var holes = { s: [[SQ + sw, 2 * SQ - sw, DOOR_H]], n: size >= 6 ? [[5 * SQ + nw, 6 * SQ - nw, NOOK_H]] : [], e: [], w: [] };
      ['n', 'e', 'w', 's'].forEach(function (side) {
        var m = wallMats[side], trim = trimMats[side];
        var ns = side === 'n' || side === 's', from = ns ? -THICK : 0, end = ns ? L + THICK : L, low = 0;
        holes[side].concat([[end, end, WALL_H]]).forEach(function (h) {
          if (h[0] > from) {
            wallPiece(shell, side, from, h[0], 0, WALL_H, m);
            strip(shell, side, Math.max(from, low), Math.min(h[0], L), 0.32, 0.08, 0.16, 0.04, trim);
          }
          if (h[1] > h[0]) wallPiece(shell, side, h[0], h[1], h[2], WALL_H, m);
          from = low = h[1];
        });
        strip(shell, side, -THICK, L + THICK, 0.14, THICK + 0.12, WALL_H + 0.07, -THICK / 2, trim);
        for (var i = 0; i < size; i++) {
          var p = wallPoint(side, (i + 0.5) * SQ, L), t = S.add(geo('wtile', function () { return new THREE.PlaneGeometry(SQ - 0.1, WALL_H - 0.8); }), hideMat, p.x + p.nx * 0.04, WALL_H / 2 + 0.1, p.z + p.nz * 0.04, shell);
          t.rotation.y = p.rot;
          t.castShadow = t.receiveShadow = false;
          t.userData.hit = { kind: 'wall', side: side, i: i };
          wallTiles[side + i] = t;
          tileList.push(t);
        }
      });
      doorFrame();
      if (size >= 6) windowSeat();

      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
        var ft = S.add(geo('ftile', function () { return new THREE.PlaneGeometry(SQ - 0.1, SQ - 0.1); }), hideMat, (c + 0.5) * SQ, 0.09, -(r + 0.5) * SQ, shell);
        ft.rotation.x = -HALF;
        ft.castShadow = ft.receiveShadow = false;
        ft.userData.hit = { kind: 'floor', c: c, r: r };
        floorTiles[c + ',' + r] = ft;
        tileList.push(ft);
      }

      var stars = sub(S, shell), seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var k = 0; k < 10 + size * 4; k++) {
        var s = S.sprite(emojiTex(k % 3 ? '⭐' : '✨'), 0.7, 0.7);
        s.position.set(0.4 + rnd() * (L - 0.8), WALL_H + 0.6 + rnd() * 0.5, -0.4 - rnd() * (L - 0.8));
        s.userData.phase = rnd() * 6;
        s.userData.k = 0.5 + rnd() * 0.4;
        stars.add(s);
        starSprites.push(s);
      }
      shell.userData.stars = stars;
    }

    // The door in wall square s1: a frame and the door standing open outward.
    function doorFrame() {
      var a = SQ + (SQ - DOOR_W) / 2, b = 2 * SQ - (SQ - DOOR_W) / 2, g = sub(S, shell);
      shellOn.s.push(g);
      [a, b].forEach(function (x) { S.add(S.rbox(0.24, DOOR_H + 0.1, 0.52, 0.08), WHITE, x, DOOR_H / 2, -0.14, g).castShadow = false; });
      S.add(S.rbox(DOOR_W + 0.48, 0.24, 0.52, 0.08), WHITE, (a + b) / 2, DOOR_H + 0.1, -0.14, g).castShadow = false;
      var leaf = S.add(S.rbox(DOOR_W - 0.1, DOOR_H - 0.1, 0.12, 0.05), '#c98b6b', a + 0.08, DOOR_H / 2, THICK + DOOR_W / 2, g);
      leaf.rotation.y = HALF;
      leaf.castShadow = false;
    }

    // At 6x6 an alcove opens in north wall square n5 with a cushioned window seat.
    function windowSeat() {
      var x = 5.5 * SQ, z0 = -L - THICK, zb = z0 - NOOK_D, zc = (z0 + zb) / 2, g = sub(S, shell);
      shellOn.n.push(g);
      S.add(wallBox(NOOK_W + 2 * THICK, 0, WALL_H), wallMats.n, x, WALL_H / 2, zb - THICK / 2, g).castShadow = false;
      pair(function (s) {
        var side = S.add(geo('nookside', function () { return new THREE.BoxGeometry(THICK, WALL_H, NOOK_D + THICK); }), wallMats.n, x + s * (NOOK_W + THICK) / 2, WALL_H / 2, zc - THICK / 2, g);
        side.castShadow = false;
      });
      box(S, g, NOOK_W, 1.2, NOOK_D + THICK, WHITE, x, 0.6, zc + THICK / 2, 0.1);
      box(S, g, NOOK_W - 0.06, 0.3, NOOK_D + THICK - 0.1, PINK, x, 1.35, zc + THICK / 2, 0.14);
      pair(function (s) { ball(S, g, 0.36, s < 0 ? '#ffd166' : '#9ed2ff', x + s * 0.55, 1.7, zb + 0.35).scale.set(1, 0.9, 0.55); });
      box(S, g, 1.4, 1.6, 0.12, WHITE, x, 2.9, zb + 0.06, 0.05);
      box(S, g, 1.2, 1.4, 0.08, lit(S, SKY, 0.45), x, 2.9, zb + 0.1, 0.03);
      box(S, g, 0.08, 1.4, 0.06, WHITE, x, 2.9, zb + 0.15, 0.02);
      box(S, g, 1.2, 0.08, 0.06, WHITE, x, 2.9, zb + 0.15, 0.02);
      pair(function (s) { box(S, g, 0.3, 2.0, 0.08, '#ffb8d9', x + s * 0.72, 2.95, zb + 0.2, 0.04); });
      box(S, g, NOOK_W, 0.16, 0.6, PINK, x, NOOK_H - 0.25, z0 + 0.1, 0.06);
    }

    // The study desk on square (0, 0) against the west wall, its front (and the stool) toward the east.
    function desk() {
      var c = Room.center(Room.DESK[0], Room.DESK[1]), g = sub(S, fixed, c.x - O.x, 0, c.z - O.z);
      g.rotation.y = HALF;
      box(S, g, 2.1, 0.14, 1.05, WOOD, 0, 2.0, -0.55, 0.06);
      pair(function (s) { box(S, g, 0.14, 1.93, 0.95, DARK_WOOD, s * 0.95, 0.97, -0.55, 0.05); });
      box(S, g, 0.7, 0.5, 0.9, '#ffb8d9', 0.5, 1.65, -0.55, 0.08);
      ball(S, g, 0.07, GOLD, 0.5, 1.65, -0.08);
      box(S, g, 1.8, 0.7, 0.08, WOOD, 0, 1.55, -1.0, 0.03);
      box(S, g, 0.55, 0.12, 0.72, '#6aa9ff', -0.55, 2.13, -0.65, 0.04);
      box(S, g, 0.5, 0.12, 0.66, '#ff7f7f', -0.55, 2.25, -0.65, 0.04).rotation.y = 0.2;
      box(S, g, 0.6, 0.02, 0.45, WHITE, 0.05, 2.08, -0.35, 0.01).rotation.y = -0.15;
      cyl(S, g, 0.13, 0.11, 0.3, LEAF, 0.35, 2.22, -0.85, 12);
      pair(function (s) { cyl(S, g, 0.025, 0.025, 0.45, s < 0 ? '#ffd166' : '#ff6f91', 0.35 + s * 0.04, 2.45, -0.85, 6).rotation.z = s * 0.15; });
      cyl(S, g, 0.15, 0.18, 0.08, WHITE, 0.78, 2.11, -0.9, 12);
      cyl(S, g, 0.03, 0.03, 0.6, WHITE, 0.78, 2.4, -0.9, 6);
      cone(S, g, 0.24, 0.3, lit(S, '#ffe08a', 0.6), 0.78, 2.75, -0.88, 16);
      ball(S, g, 0.13, '#ff5a5f', -0.1, 2.16, -0.85);
      cyl(S, g, 0.5, 0.5, 0.2, PINK, 0, 1.25, 0.6, 20);
      pair(function (s) { pair(function (t) { cyl(S, g, 0.05, 0.05, 1.15, WOOD, s * 0.3, 0.58, 0.6 + t * 0.3, 6); }); });
    }

    // The mirror on wall square s2, the outdoor mirror's look, facing north into the room.
    function mirror() {
      var p = wallPoint('s', (Room.MIRROR[0] + 0.5) * SQ, 0), g = sub(S, fixed, p.x, 0, p.z - 0.22);
      g.rotation.y = p.rot;
      fixedOn.s.push(g);
      var gold = S.toon(GOLD), glass = S.toon('#dff4ff', { emissive: '#bfe6ff', emissiveIntensity: 0.4 });
      flat(S.add(S.rbox(2.2, 3.4, 0.4, 0.3), gold, 0, 2.3, 0, g));
      flat(S.add(S.rbox(1.75, 2.9, 0.1, 0.25), glass, 0, 2.3, 0.22, g));
      flat(S.add(S.rbox(1.2, 0.3, 1, 0.1), gold, 0, 0.15, 0.3, g));
      mirrorSign = sprite(emojiTex('🪞'), 1.2, 1.2);
      mirrorSign.position.set(0, 4.65, 0.2);
      g.add(mirrorSign);
    }

    // The trophy shelf on wall squares w1 and w2, above furniture height: one cup per subject in lobby order.
    function shelf() {
      var g = sub(S, fixed, 0, 0, -(Room.WALK[1] + 1) * SQ), rows = two ? [3.6] : [4.45, 3.45];
      g.rotation.y = HALF;
      fixedOn.w.push(g);
      var per = Math.max(1, Math.ceil(apps.length / rows.length)), gap = 4.4 / per, sc = CUP_SCALE;
      box(S, g, 4.8, rows[0] - rows[rows.length - 1] + 1.5, 0.08, '#f6e2c8', 0, (rows[0] + rows[rows.length - 1]) / 2 + 0.25, 0.04, 0.04);
      rows.forEach(function (y) {
        box(S, g, 4.6, 0.12, 0.72, WOOD, 0, y - 0.06, 0.36, 0.04);
        pair(function (s) { box(S, g, 0.1, 0.36, 0.5, DARK_WOOD, s * 1.9, y - 0.3, 0.25, 0.03); });
      });
      apps.forEach(function (a, j) {
        var y = rows[Math.min(rows.length - 1, Math.floor(j / per))], lx = -2.2 + (j % per + 0.5) * gap;
        var cg = sub(S, g, lx, y, 0.36);
        cg.scale.set(sc, sc, sc);
        cg.userData.hit = { kind: 'trophy', app: a.app };
        var parts = [
          box(S, cg, 0.42, 0.12, 0.42, CUP[0], 0, 0.06, 0, 0.04),
          cyl(S, cg, 0.06, 0.08, 0.22, CUP[0], 0, 0.23, 0, 8),
          cyl(S, cg, 0.27, 0.12, 0.4, CUP[0], 0, 0.54, 0, 18)
        ];
        pair(function (s) { parts.push(ring(S, cg, 0.11, 0.035, CUP[0], s * 0.28, 0.56, 0)); });
        box(S, cg, 0.38, 0.3, 0.05, WHITE, 0, -0.07, 0.39 / sc, 0.03);
        var plaque = sprite(emojiTex(a.emoji), 0.27, 0.27);
        plaque.position.set(0, -0.06, 0.44 / sc);
        cg.add(plaque);
        cups[a.app] = { group: cg, parts: parts };
        cupAt[a.app] = { x: O.x + 0.36, y: y + 0.55 * sc, z: O.z - (Room.WALK[1] + 1) * SQ - lx };
      });
    }

    function trophies(levels) {
      apps.forEach(function (a) {
        var l = Math.max(0, Math.min(3, Math.floor(Number(levels[a.app]) || 0)));
        var m = S.toon(CUP[l], { emissive: CUP[l], emissiveIntensity: l === 3 ? 0.35 : 0.12 });
        cups[a.app].parts.forEach(function (p) {
          if (p.userData.solid) {
            p.userData.solid = m;
            p.material = seeCopy(m);
          } else p.material = m;
        });
      });
    }

    function pickOf(id, part) {
      var it = Furniture.find(id);
      return it && it.kind === 'room' && it.part === part ? it : Furniture.find(Furniture.STARTER_ROOM[part]);
    }
    function looks() {
      var w = pickOf(preview.wall || state.wall, 'wall'), f = pickOf(preview.floor || state.floor, 'floor');
      var tex = null;
      if (w.pattern) {
        tex = wallTex[w.id] || (wallTex[w.id] = paint(256, 256, function (x) { PATTERNS[w.pattern](x, w.color); }));
        tex.repeat.set(1, 2);
      }
      SIDES.forEach(function (sd) {
        var m = wallMats[sd];
        m.map = tex;
        m.color.set(tex ? WHITE : w.color);
        m.needsUpdate = true;
      });
      var ft = floorTex[f.id] || (floorTex[f.id] = paint(128, 128, function (x) { PATTERNS[f.pattern](x, f.color); }));
      ft.repeat.set(size, size);
      floorMat.map = ft;
      floorMat.needsUpdate = true;
      if (shell) shell.userData.stars.visible = preview.stars ? true : !!state.stars;
    }

    function tiles() {
      Object.keys(floorTiles).forEach(function (k) { floorTiles[k].material = glowSet['f' + k] ? glowFloor : faded ? gridMat : hideMat; });
      Object.keys(wallTiles).forEach(function (k) { wallTiles[k].material = glowSet['w' + k] ? glowWall : hideMat; });
    }

    function dropRec(r) {
      if (r.node.parent) r.node.parent.remove(r.node);
      r.pc.mats.forEach(function (m) { m.dispose(); });
    }

    function syncItems() {
      var pool = {}, old = recs;
      old.forEach(function (r) { if (r) (pool[r.key] = pool[r.key] || []).push(r); });
      recs = (state.placed || []).map(function (p, k) {
        var it = p ? Furniture.find(p.id) : null;
        if (!it || it.kind === 'room' || !Object.prototype.hasOwnProperty.call(BUILDERS, p.id)) return null;
        var key = JSON.stringify([p.id, p.c, p.r, p.turn || 0, p.side, p.i, size]);
        var r = pool[key] && pool[key].shift();
        if (!r) {
          var pc = piece(S, p.id), n = sub(S, items);
          placeNode(n, it, p, size);
          n.add(pc.group);
          r = { node: n, inner: pc.group, pc: pc, it: it, shake: 0, side: it.kind === 'wall' ? p.side : null };
          if (r.side && sideOn[r.side]) seeThrough(n, true);
        }
        r.key = key;
        r.node.userData.hit = { kind: 'item', k: k };
        return r;
      });
      old.forEach(function (r) { if (r && recs.indexOf(r) < 0) dropRec(r); });
    }

    function show(st) {
      state = st || state;
      if (state.size !== size) {
        size = state.size;
        buildShell();
      }
      looks();
      trophies(state.trophies || {});
      syncItems();
      select(selK);
      tiles();
    }

    function clearGhost() {
      if (!ghostRec) return;
      dropRec(ghostRec);
      ghostRec.clones.forEach(function (m) { m.dispose(); });
      ghostRec = null;
    }
    // A see-through preview of piece id at p (null: none).
    function ghost(p, id) {
      clearGhost();
      var it = p ? Furniture.find(id) : null;
      if (!it || it.kind === 'room') return;
      var pc = piece(S, id), n = sub(S, group), clones = [];
      placeNode(n, it, p, size);
      n.add(pc.group);
      pc.group.traverse(function (x) {
        if (!x.material || !x.isMesh) return;
        var m = x.material.clone();
        m.transparent = true;
        m.opacity = 0.5;
        m.depthWrite = false;
        clones.push(m);
        x.material = m;
        x.castShadow = false;
      });
      ghostRec = { node: n, pc: pc, clones: clones };
    }
    // Shows a wallpaper, floor or the star ceiling (part 'wall' | 'floor' | 'stars') on the room before she buys it.
    function roomGhost(part, id) {
      preview[part] = id || null;
      looks();
    }

    // A soft glowing outline around piece k (null: none).
    function select(k) {
      if (outline && outline.parent) outline.parent.remove(outline);
      outline = null;
      var r = k === null || k === undefined ? null : recs[k];
      selK = r ? k : null;
      if (!r) return;
      outline = new THREE.Group();
      var it = r.it, w, h, y, z;
      if (it.kind === 'wall') { w = it.size[0] * SQ - 0.2; h = 3.4; y = 1.5; z = 0.12; }
      else { w = it.size[0] * SQ - 0.16; h = it.size[1] * SQ - 0.16; y = 0.14; z = 0; }
      var bars = it.kind === 'wall'
        ? [[w, 0.16, 0, y], [w, 0.16, 0, y + h], [0.16, h, -w / 2, y + h / 2], [0.16, h, w / 2, y + h / 2]]
        : [[w + 0.16, 0.16, 0, h / 2], [w + 0.16, 0.16, 0, -h / 2], [0.16, h, -w / 2, 0], [0.16, h, w / 2, 0]];
      bars.forEach(function (b) {
        var m = it.kind === 'wall'
          ? S.add(S.rbox(b[0], b[1], 0.1, 0.05), selMat, b[2], b[3], z, outline)
          : S.add(S.rbox(b[0], 0.2, b[1], 0.06), selMat, b[2], y, b[3], outline);
        m.castShadow = false;
        m.userData.keep = true;
      });
      r.node.add(outline);
    }

    // Tints the squares in spots ([{ c, r }] or [{ side, i }]; null: none).
    function glow(spots) {
      glowSet = {};
      (spots || []).forEach(function (s) {
        if (s.side) glowSet['w' + s.side + s.i] = true;
        else glowSet['f' + s.c + ',' + s.r] = true;
      });
      tiles();
    }

    // A see-through copy of material m (kept for the room's life).
    function seeCopy(m) {
      if (seeCopies[m.uuid]) return seeCopies[m.uuid];
      var c = m.clone();
      c.transparent = true;
      c.opacity = SEE * m.opacity;
      c.depthWrite = false;
      seeCopies[m.uuid] = c;
      return c;
    }
    // Swaps everything under node n to see-through copies (on) or back. The wall's own materials and the selection
    // outline stay as they are.
    function seeThrough(n, on) {
      n.traverse(function (x) {
        if (!x.material || x.userData.keep || directList.indexOf(x.material) >= 0) return;
        if (on && !x.userData.solid) {
          x.userData.solid = x.material;
          x.userData.cast = x.castShadow;
          x.material = seeCopy(x.material);
          x.castShadow = false;
        } else if (!on && x.userData.solid) {
          x.material = x.userData.solid;
          x.castShadow = x.userData.cast;
          delete x.userData.solid;
          delete x.userData.cast;
        }
      });
    }
    function setSide(side, on) {
      sideOn[side] = on;
      direct[side].forEach(function (f) {
        f.m.transparent = on || f.t;
        f.m.opacity = on ? SEE * f.o : f.o;
        f.m.depthWrite = on ? false : f.d;
        f.m.needsUpdate = true;
      });
      fixedOn[side].concat(shellOn[side]).forEach(function (n) { seeThrough(n, on); });
      recs.forEach(function (r) { if (r && r.side === side) seeThrough(r.node, on); });
    }
    // A wall turns see-through while the camera is beyond it, and in the Decorate view the south and east walls do too.
    // Only a wall whose state changes is written.
    function walls() {
      SIDES.forEach(function (sd) {
        var on = camOut[sd] || (faded && (sd === 's' || sd === 'e'));
        if (on !== sideOn[sd]) setSide(sd, on);
      });
    }
    // The camera stands at (x, z) in the world.
    function see(x, z) {
      var lx = x - O.x, lz = z - O.z;
      camOut.s = lz > 0;
      camOut.n = lz < -L;
      camOut.w = lx < 0;
      camOut.e = lx > L;
      walls();
    }

    // The Decorate view: the south and east walls (and what hangs on them) see-through, the squares as a grid.
    function fade(on) {
      faded = !!on;
      walls();
      tiles();
    }

    function hitOf(x) {
      while (x) {
        if (x.userData && x.userData.hit) return x.userData.hit;
        x = x.parent;
      }
      return null;
    }
    // What a tap's ray meets first. A rug lies just under its floor square, so a piece met right behind the square wins.
    function hit(ray) {
      var targets = tileList.concat(items.children, apps.map(function (a) { return cups[a.app].group; }));
      var first = null, item = null;
      ray.intersectObjects(targets, true).forEach(function (h) {
        var info = hitOf(h.object);
        if (!info) return;
        if (!first) first = { info: info, d: h.distance };
        if (info.kind === 'item' && !item) item = { info: info, d: h.distance };
      });
      if (!first) return null;
      // A rug: sq is the floor square tapped on it.
      if (first.info.kind === 'floor' && item && item.d - first.d < 0.6) return Object.assign({}, item.info, { sq: { c: first.info.c, r: first.info.r } });
      return Object.assign({}, first.info);
    }

    function trophyAt(app) { var p = cupAt[app]; return p ? { x: p.x, y: p.y, z: p.z } : null; }
    function shake(k) { if (recs[k]) recs[k].shake = SHAKE; }

    function animate(t, dt) {
      recs.forEach(function (r, k) {
        if (!r) return;
        if (r.pc.animate) r.pc.animate(t);
        var x = 0;
        if (r.shake > 0) {
          r.shake = Math.max(0, r.shake - (dt || 0));
          x = Math.sin(t * 45) * 0.15 * r.shake / SHAKE;
        }
        r.inner.position.set(x, k === selK ? 0.1 + Math.sin(t * 4) * 0.06 : 0, 0);
      });
      selMat.opacity = 0.6 + Math.sin(t * 4) * 0.3;
      glowFloor.opacity = 0.5 + Math.sin(t * 3) * 0.12;
      glowWall.opacity = 0.4 + Math.sin(t * 3) * 0.12;
      if (ghostRec) ghostRec.clones.forEach(function (m) { m.opacity = 0.45 + Math.sin(t * 3) * 0.12; });
      if (shell && shell.userData.stars.visible) {
        starSprites.forEach(function (s) {
          var k = s.userData.k * (0.75 + Math.sin(t * 2.2 + s.userData.phase) * 0.25);
          s.scale.set(k, k, 1);
        });
      }
      if (mirrorSign) mirrorSign.position.y = 4.65 + Math.sin(t * 2) * 0.12;
    }

    function dispose() {
      clearGhost();
      recs.forEach(function (r) { if (r) dropRec(r); });
      recs = [];
      S.scene.remove(group);
      starSprites.forEach(function (s) { s.material.dispose(); });
      mySprites.forEach(function (m) { m.dispose(); });
      myMats.forEach(function (m) { m.dispose(); });
      myTex.forEach(function (t) { t.dispose(); });
      Object.keys(seeCopies).forEach(function (k) { seeCopies[k].dispose(); });
      Object.keys(myGeos).forEach(function (k) { myGeos[k].dispose(); });
    }

    desk();
    mirror();
    shelf();
    trophies({});

    return {
      group: group, show: show, ghost: ghost, roomGhost: roomGhost, select: select, glow: glow, fade: fade, see: see, hit: hit,
      trophyAt: trophyAt, shake: shake, animate: animate, dispose: dispose,
      seeThrough: function () { return SIDES.filter(function (sd) { return sideOn[sd]; }); }
    };
  }

  var exported = { BUILDERS: BUILDERS, PATTERNS: PATTERNS, piece: piece, placeNode: placeNode, create: create };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Room3D = exported;
})(this);
