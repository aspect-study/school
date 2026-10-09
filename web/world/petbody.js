/* Her pet, built from the same shapes as everything else: one builder per pet (pets.js) in its chosen colour, one per
   pet gear piece, a few moods (walk, idle, sit, sleep, stretch, happy, munch), riding on her (mount) and the name above
   it (tag). Each pet faces local +z with its feet at y = 0; a builder returns its anchors (see BODIES). */
(function (root) {
  'use strict';
  var Pets = typeof module !== 'undefined' && module.exports ? require('./pets.js') : root.World3D.Pets;
  var EYE = '#3a2a4f', WHITE = '#ffffff', PINK = '#ff8fab', ORANGE = '#ffa94d', GOLD = '#ffd166', DARK = '#2b2b2b';

  function eyes(S, b, gap, y, z, r) { [-1, 1].forEach(function (s) { S.add(S.ball(r || 0.09), EYE, s * gap, y, z, b); }); }
  // Eyes on a dark face: a white ball behind each.
  function brightEyes(S, b, gap, y, z) {
    [-1, 1].forEach(function (s) {
      S.add(S.ball(0.13), WHITE, s * gap, y, z, b);
      S.add(S.ball(0.07), EYE, s * gap, y, z + 0.09, b);
    });
  }
  function blob(S, b, r, color, x, y, z, sx, sy, sz) {
    var m = S.add(S.ball(r), color, x, y, z, b);
    if (sx) m.scale.set(sx, sy, sz);
    return m;
  }
  function legs(S, b, color, r, h, dx, dz) {
    [[-dx, -dz], [dx, -dz], [-dx, dz], [dx, dz]].forEach(function (p) { S.add(S.cyl(r, r, h, 10), color, p[0], h / 2, p[1], b); });
  }
  function anchors(head, neck, back, face, s, top, nr) { return { head: head, neck: neck, back: back, face: face, s: s, top: top, nr: nr }; }

  // BODIES[id](S, b, c) draws pet id into group b in colour c and returns its anchors.
  var BODIES = {
    chick: function (S, b, c) {
      blob(S, b, 0.75, c, 0, 0.75, 0);
      S.add(S.cone(0.18, 0.35, 12), ORANGE, 0, 0.85, 0.78, b).rotation.x = Math.PI / 2;
      eyes(S, b, 0.28, 1.0, 0.65, 0.1);
      blob(S, b, 0.22, c, 0, 1.55, -0.1, 0.5, 1, 1);
      return anchors([0, 1.5, 0.1], [0, 0.6, 0], [0, 1.15, -0.55], [0, 1.0, 0.76], 0.8, 2.3, 0.64);
    },
    kitten: function (S, b, c) {
      blob(S, b, 0.7, c, 0, 0.7, 0, 1, 0.9, 1.2);
      blob(S, b, 0.62, c, 0, 1.45, 0.55);
      [-0.35, 0.35].forEach(function (x) { S.add(S.cone(0.2, 0.45, 4), c, x, 2.0, 0.5, b); });
      eyes(S, b, 0.245, 1.55, 1.1);
      S.add(S.ball(0.08), PINK, 0, 1.38, 1.16, b);
      S.add(S.cyl(0.1, 0.12, 1.1, 8), c, 0, 1.2, -0.9, b).rotation.x = -0.6;
      return anchors([0, 2.05, 0.55], [0, 1.05, 0.55], [0, 1.35, -0.2], [0, 1.55, 1.18], 0.8, 2.9, 0.45);
    },
    puppy: function (S, b, c) {
      blob(S, b, 0.72, c, 0, 0.72, 0, 1, 0.9, 1.25);
      blob(S, b, 0.64, c, 0, 1.5, 0.55);
      [-0.55, 0.55].forEach(function (x) { S.add(S.rbox(0.25, 0.7, 0.45, 0.12), '#a0522d', x, 1.4, 0.45, b); });
      eyes(S, b, 0.25, 1.62, 1.12);
      S.add(S.ball(0.13), EYE, 0, 1.42, 1.18, b);
      S.add(S.cyl(0.08, 0.1, 0.7, 8), c, 0, 1.0, -0.95, b).rotation.x = -1;
      return anchors([0, 2.1, 0.55], [0, 1.05, 0.55], [0, 1.4, -0.2], [0, 1.62, 1.2], 0.85, 3, 0.43);
    },
    hamster: function (S, b, c) {
      blob(S, b, 0.7, c, 0, 0.65, 0, 1.1, 0.9, 1.1);
      blob(S, b, 0.45, '#fff5e6', 0, 0.55, 0.55, 1, 0.9, 0.6);
      [-0.38, 0.38].forEach(function (x) { blob(S, b, 0.18, c, x, 1.25, 0.1); });
      eyes(S, b, 0.25, 0.85, 0.72, 0.08);
      S.add(S.ball(0.06), PINK, 0, 0.72, 0.8, b);
      return anchors([0, 1.3, 0], [0, 0.62, 0], [0, 1.1, -0.3], [0, 0.85, 0.8], 0.75, 2.1, 0.68);
    },
    duckling: function (S, b, c) {
      blob(S, b, 0.65, c, 0, 0.65, 0, 1, 0.9, 1.2);
      blob(S, b, 0.45, c, 0, 1.35, 0.35);
      S.add(S.rbox(0.4, 0.12, 0.35, 0.06), ORANGE, 0, 1.25, 0.82, b);
      eyes(S, b, 0.18, 1.45, 0.78, 0.07);
      S.add(S.cone(0.2, 0.4, 8), c, 0, 0.9, -0.75, b).rotation.x = -Math.PI / 3;
      return anchors([0, 1.8, 0.35], [0, 1.05, 0.3], [0, 1.15, -0.35], [0, 1.45, 0.84], 0.7, 2.5, 0.36);
    },
    bunny: function (S, b, c) {
      blob(S, b, 0.7, c, 0, 0.7, 0, 1, 0.95, 1.1);
      blob(S, b, 0.6, c, 0, 1.5, 0.4);
      [-0.22, 0.22].forEach(function (x) {
        S.add(S.rbox(0.25, 0.9, 0.15, 0.1), c, x, 2.35, 0.35, b);
        S.add(S.rbox(0.12, 0.6, 0.05, 0.04), PINK, x, 2.35, 0.43, b);
      });
      eyes(S, b, 0.22, 1.6, 0.95, 0.08);
      S.add(S.ball(0.06), PINK, 0, 1.45, 0.99, b);
      blob(S, b, 0.22, WHITE, 0, 0.8, -0.75);
      return anchors([0, 2.05, 0.4], [0, 1.05, 0.35], [0, 1.3, -0.25], [0, 1.6, 1.02], 0.8, 3.3, 0.47);
    },
    turtle: function (S, b, c) {
      var skin = '#b5e38a';
      blob(S, b, 0.85, c, 0, 0.7, 0, 1, 0.6, 1.1);
      blob(S, b, 0.38, skin, 0, 0.75, 1.0);
      legs(S, b, skin, 0.15, 0.4, 0.5, 0.5);
      eyes(S, b, 0.15, 0.85, 1.33, 0.06);
      return anchors([0, 1.12, 1.0], [0, 0.5, 1.0], [0, 1.2, -0.1], [0, 0.85, 1.4], 0.6, 2.0, 0.3);
    },
    piglet: function (S, b, c) {
      blob(S, b, 0.75, c, 0, 0.75, 0, 1.1, 0.9, 1.25);
      blob(S, b, 0.58, c, 0, 1.3, 0.75);
      S.add(S.cyl(0.22, 0.22, 0.15, 16), PINK, 0, 1.2, 1.3, b).rotation.x = Math.PI / 2;
      [-0.32, 0.32].forEach(function (x) { S.add(S.cone(0.15, 0.3, 4), c, x, 1.8, 0.7, b); });
      eyes(S, b, 0.22, 1.42, 1.3, 0.07);
      S.add(S.torus(0.12, 0.04, 6, 12), PINK, 0, 1.0, -0.95, b);
      return anchors([0, 1.85, 0.75], [0, 1.0, 0.75], [0, 1.4, -0.15], [0, 1.42, 1.38], 0.8, 2.7, 0.47);
    },
    parrot: function (S, b, c) {
      blob(S, b, 0.55, c, 0, 0.85, 0, 0.9, 1.2, 0.9);
      blob(S, b, 0.42, c, 0, 1.6, 0.1);
      S.add(S.cone(0.12, 0.3, 10), GOLD, 0, 1.5, 0.55, b).rotation.x = Math.PI / 2;
      [-0.5, 0.5].forEach(function (x) { S.add(S.rbox(0.15, 0.7, 0.5, 0.07), '#ff8c42', x, 0.85, 0, b); });
      S.add(S.rbox(0.3, 0.7, 0.1, 0.05), '#ff8c42', 0, 0.5, -0.5, b).rotation.x = 0.5;
      eyes(S, b, 0.17, 1.68, 0.5, 0.06);
      return anchors([0, 2.0, 0.1], [0, 1.25, 0.05], [0, 1.15, -0.4], [0, 1.68, 0.56], 0.6, 2.6, 0.36);
    },
    carabao: function (S, b, c) {
      S.add(S.rbox(1.6, 1.1, 2.2, 0.45), c, 0, 1.3, 0, b);
      legs(S, b, c, 0.18, 0.9, 0.5, 0.7);
      S.add(S.rbox(0.95, 0.85, 0.9, 0.35), c, 0, 1.9, 1.3, b);
      S.add(S.rbox(0.7, 0.45, 0.25, 0.15), '#d9c9b6', 0, 1.7, 1.8, b);
      [-1, 1].forEach(function (s) { S.add(S.cone(0.12, 0.6, 8), '#f5e9d6', s * 0.55, 2.35, 1.2, b).rotation.z = -s * 1.2; });
      eyes(S, b, 0.28, 2.05, 1.76, 0.08);
      return anchors([0, 2.35, 1.3], [0, 1.3, 1.15], [0, 1.85, -0.2], [0, 2.05, 1.84], 1.1, 3.4, 0.45);
    },
    penguin: function (S, b, c) {
      blob(S, b, 0.7, c, 0, 0.9, 0, 1, 1.3, 0.95);
      blob(S, b, 0.5, WHITE, 0, 0.8, 0.38, 1, 1.3, 0.6);
      S.add(S.cone(0.12, 0.3, 10), ORANGE, 0, 1.45, 0.68, b).rotation.x = Math.PI / 2;
      brightEyes(S, b, 0.2, 1.62, 0.58);
      [-1, 1].forEach(function (s) {
        S.add(S.rbox(0.12, 0.7, 0.4, 0.06), c, s * 0.7, 0.95, 0, b).rotation.z = s * 0.3;
        S.add(S.rbox(0.3, 0.1, 0.4, 0.05), ORANGE, s * 0.25, 0.08, 0.25, b);
      });
      return anchors([0, 1.85, 0], [0, 1.3, 0], [0, 1.15, -0.55], [0, 1.62, 0.75], 0.75, 2.6, 0.58);
    },
    fox: function (S, b, c) {
      blob(S, b, 0.65, c, 0, 0.7, 0, 1, 0.9, 1.3);
      blob(S, b, 0.4, WHITE, 0, 0.75, 0.55);
      blob(S, b, 0.55, c, 0, 1.4, 0.6);
      S.add(S.cone(0.25, 0.45, 12), c, 0, 1.3, 1.1, b).rotation.x = Math.PI / 2;
      S.add(S.ball(0.07), EYE, 0, 1.3, 1.33, b);
      [-0.3, 0.3].forEach(function (x) { S.add(S.cone(0.2, 0.45, 4), c, x, 1.95, 0.55, b); });
      eyes(S, b, 0.22, 1.5, 1.13, 0.07);
      blob(S, b, 0.45, c, 0, 0.9, -1.0, 0.8, 0.8, 1.5);
      blob(S, b, 0.25, WHITE, 0, 1.0, -1.55);
      return anchors([0, 1.95, 0.6], [0, 1.05, 0.5], [0, 1.2, -0.25], [0, 1.5, 1.2], 0.75, 2.8, 0.41);
    },
    tarsier: function (S, b, c) {
      blob(S, b, 0.5, c, 0, 0.6, 0, 1, 1.1, 0.9);
      blob(S, b, 0.5, c, 0, 1.3, 0.1);
      [-1, 1].forEach(function (s) {
        S.add(S.ball(0.22), '#5a3a2e', s * 0.2, 1.35, 0.5, b);
        S.add(S.ball(0.06), WHITE, s * 0.15, 1.42, 0.68, b);
        blob(S, b, 0.2, c, s * 0.45, 1.7, 0, 1, 1, 0.4);
      });
      S.add(S.cyl(0.05, 0.05, 1.2, 6), c, 0, 0.6, -0.6, b).rotation.x = -1.2;
      return anchors([0, 1.8, 0.1], [0, 0.95, 0.05], [0, 0.9, -0.4], [0, 1.35, 0.74], 0.6, 2.4, 0.38);
    },
    panda: function (S, b, c) {
      blob(S, b, 1.0, c, 0, 1.0, 0, 1.1, 0.95, 1.15);
      blob(S, b, 0.8, c, 0, 2.0, 0.5);
      [-1, 1].forEach(function (s) {
        blob(S, b, 0.22, DARK, s * 0.3, 2.05, 1.2, 1, 1.3, 0.5);
        S.add(S.ball(0.07), WHITE, s * 0.3, 2.1, 1.3, b);
        blob(S, b, 0.28, DARK, s * 0.6, 2.65, 0.35);
        blob(S, b, 0.35, DARK, s * 0.75, 1.2, 0.55);
        blob(S, b, 0.35, DARK, s * 0.55, 0.35, 0.3);
      });
      S.add(S.ball(0.1), DARK, 0, 1.85, 1.27, b);
      return anchors([0, 2.75, 0.5], [0, 1.55, 0.5], [0, 1.7, -0.6], [0, 2.1, 1.38], 1.05, 3.7, 0.65);
    },
    unicorn: function (S, b, c) {
      var mane = ['#ff8fc8', '#ffd166', '#8fd3ff', '#c9b6ff'];
      S.add(S.rbox(1.4, 1.0, 2.0, 0.45), c, 0, 1.5, 0, b);
      legs(S, b, c, 0.16, 1.1, 0.45, 0.65);
      S.add(S.rbox(0.8, 0.8, 1.1, 0.35), c, 0, 2.4, 1.1, b);
      S.add(S.cone(0.12, 0.7, 10), GOLD, 0, 3.05, 1.3, b);
      [-0.25, 0.25].forEach(function (x) { S.add(S.cone(0.12, 0.3, 6), c, x, 2.95, 0.85, b); });
      [[0, 2.85, 0.75], [0, 2.55, 0.5], [0, 2.2, 0.3], [0, 1.6, -1.1], [0, 1.3, -1.25], [0, 1.0, -1.3]].forEach(function (p, i) {
        S.add(S.ball(0.22), mane[i % mane.length], p[0], p[1], p[2], b);
      });
      eyes(S, b, 0.3, 2.5, 1.58, 0.08);
      return anchors([0, 2.92, 0.78], [0, 1.95, 1.05], [0, 2.05, -0.1], [0, 2.5, 1.7], 1.0, 4.0, 0.38);
    },
    dragon: function (S, b, c) {
      var BELLY = '#fff2b3';
      blob(S, b, 0.9, c, 0, 1.0, 0, 1, 1, 1.2);
      blob(S, b, 0.6, BELLY, 0, 0.9, 0.55, 1, 1.1, 0.6);
      blob(S, b, 0.65, c, 0, 2.0, 0.55);
      blob(S, b, 0.35, c, 0, 1.85, 1.1, 1.1, 0.8, 1);
      brightEyes(S, b, 0.25, 2.15, 1.08);
      [-1, 1].forEach(function (s) {
        S.add(S.cone(0.1, 0.35, 8), BELLY, s * 0.3, 2.6, 0.4, b);
        S.add(S.rbox(0.1, 0.8, 0.9, 0.05), '#ffb3d1', s * 0.85, 1.6, -0.4, b).rotation.z = s * 0.6;
      });
      [[1.85, -0.3], [1.6, -0.75], [1.2, -1.05]].forEach(function (p) { S.add(S.cone(0.12, 0.3, 6), BELLY, 0, p[0], p[1], b); });
      S.add(S.cone(0.25, 0.9, 10), c, 0, 0.6, -1.3, b).rotation.x = -Math.PI / 2;
      return anchors([0, 2.65, 0.55], [0, 1.5, 0.55], [0, 1.85, -0.3], [0, 2.15, 1.26], 1.0, 3.6, 0.53);
    }
  };

  // GEAR[id](S, g) draws one gear piece into g at unit size.
  var GEAR = {
    'pet-partyhat': function (S, g) {
      S.add(S.cone(0.3, 0.7, 16), '#ff6f91', 0, 0.35, 0, g);
      S.add(S.ball(0.1), GOLD, 0, 0.72, 0, g);
    },
    'pet-bow': function (S, g) {
      [-0.18, 0.18].forEach(function (x) { blob(S, g, 0.18, '#ff6f91', x, 0.08, 0, 1, 0.7, 0.5); });
      S.add(S.ball(0.08), GOLD, 0, 0.08, 0.04, g);
    },
    'pet-flower': function (S, g) {
      for (var i = 0; i < 5; i++) {
        var a = i / 5 * Math.PI * 2;
        S.add(S.ball(0.12), '#ff8fc8', Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16, g);
      }
      S.add(S.ball(0.09), GOLD, 0, 0.1, 0, g);
    },
    'pet-wizard': function (S, g) {
      S.add(S.cyl(0.45, 0.45, 0.05, 20), '#6c4ab6', 0, 0.02, 0, g);
      S.add(S.cone(0.32, 0.9, 16), '#6c4ab6', 0, 0.47, 0, g);
      S.add(S.ball(0.07), GOLD, 0, 0.45, 0.25, g);
    },
    'pet-crown': function (S, g) {
      S.add(S.cyl(0.28, 0.28, 0.2, 16), GOLD, 0, 0.1, 0, g);
      for (var i = 0; i < 5; i++) {
        var a = i / 5 * Math.PI * 2;
        S.add(S.cone(0.06, 0.15, 4), GOLD, Math.cos(a) * 0.25, 0.27, Math.sin(a) * 0.25, g);
      }
      S.add(S.ball(0.06), '#ff6f91', 0, 0.12, 0.28, g);
    },
    'pet-bell': function (S, g) {
      S.add(S.torus(0.5, 0.07, 8, 24), '#ff6f91', 0, 0, 0, g).rotation.x = Math.PI / 2;
      S.add(S.ball(0.12), GOLD, 0, -0.1, 0.52, g);
    },
    'pet-bandana': function (S, g) {
      S.add(S.torus(0.5, 0.08, 8, 24), '#e63946', 0, 0, 0, g).rotation.x = Math.PI / 2;
      S.add(S.cone(0.3, 0.4, 3), '#e63946', 0, -0.2, 0.45, g).rotation.x = Math.PI;
    },
    'pet-bowtie': function (S, g) {
      [-0.14, 0.14].forEach(function (x) { blob(S, g, 0.14, '#4361ee', x, 0, 0.5, 1, 0.7, 0.5); });
      S.add(S.ball(0.06), '#4361ee', 0, 0, 0.53, g);
    },
    'pet-scarf': function (S, g) {
      S.add(S.torus(0.5, 0.12, 8, 24), '#5fcf9a', 0, 0, 0, g).rotation.x = Math.PI / 2;
      S.add(S.rbox(0.18, 0.5, 0.08, 0.04), '#5fcf9a', 0.2, -0.25, 0.45, g);
    },
    'pet-pack': function (S, g) {
      S.add(S.rbox(0.62, 0.55, 0.4, 0.14), '#ffb347', 0, 0.15, -0.05, g);
      S.add(S.rbox(0.38, 0.24, 0.08, 0.04), '#ff8c42', 0, 0.08, -0.27, g);
    },
    'pet-cape': function (S, g) {
      S.add(S.rbox(0.8, 0.05, 0.5, 0.03), '#ef233c', 0, 0.05, -0.15, g).rotation.x = -0.2;
      S.add(S.rbox(0.85, 0.9, 0.05, 0.03), '#ef233c', 0, -0.35, -0.25, g).rotation.x = 0.25;
    },
    'pet-wings': function (S, g) {
      [-1, 1].forEach(function (s) { blob(S, g, 0.35, WHITE, s * 0.35, 0.3, 0, 0.25, 0.9, 0.6).rotation.z = s * 0.5; });
    },
    'pet-sunglasses': function (S, g) {
      [-0.29, 0.29].forEach(function (x) { S.add(S.rbox(0.32, 0.22, 0.05, 0.04), '#222222', x, 0, 0.03, g); });
      S.add(S.rbox(0.28, 0.04, 0.03, 0.015), '#222222', 0, 0.04, 0.03, g);
    },
    'pet-starglasses': function (S, g) {
      [-0.29, 0.29].forEach(function (x) { S.add(S.cone(0.19, 0.05, 5), '#ff6f91', x, 0, 0.04, g).rotation.x = Math.PI / 2; });
    }
  };
  var AT = { hat: 'head', neck: 'neck', back: 'back', glasses: 'face' };
  var SCALE = 0.8;

  // l = a look already through Pets.wearable(): { pet, petColor, petWear }.
  function build(S, l) {
    var THREE = S.THREE, p = Pets.find(l.pet) || Pets.find('chick');
    var group = new THREE.Group(), body = new THREE.Group(), gear = {}, sprites = [];
    group.scale.setScalar(SCALE);
    group.add(body);
    var a = BODIES[p.id](S, body, p.colors[l.petColor] || p.colors[0]);
    Pets.GEAR_SLOTS.forEach(function (slot) {
      var id = l.petWear && l.petWear[slot];
      if (!id || !GEAR[id]) return;
      var g = new THREE.Group(), at = a[AT[slot]];
      g.position.set(at[0], at[1], at[2]);
      g.scale.setScalar(slot === 'neck' ? a.nr * 2.2 : a.s);
      body.add(g);
      GEAR[id](S, g);
      gear[slot] = g;
    });

    function animate(t, mood) {
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      body.scale.set(1, 1, 1);
      if (mood === 'walk') body.position.y = Math.abs(Math.sin(t * 7)) * 0.3;
      else if (mood === 'happy') {
        body.position.y = Math.abs(Math.sin(t * 10)) * 0.8;
        body.rotation.y = (t * 8) % (Math.PI * 2);
      } else if (mood === 'munch') body.rotation.x = 0.15 + Math.sin(t * 14) * 0.12;
      else if (mood === 'sit') body.scale.set(1.05, 0.85, 1);
      else if (mood === 'sleep') {
        body.scale.set(1.08, 0.75 + Math.sin(t * 2) * 0.03, 1);
        body.rotation.z = 0.25;
      } else if (mood === 'stretch') body.scale.set(0.95, 1.12, 1.05);
      else body.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
    }

    function dispose() {
      sprites.forEach(function (s) {
        if (s.material.map) s.material.map.dispose();
        s.material.dispose();
      });
    }

    return { group: group, body: body, anchors: a, top: a.top, gear: gear, sprites: sprites, animate: animate, dispose: dispose };
  }

  var MOUNT = { shoulder: 0.5, head: 0.42, arms: 0.6 };
  // ch = her character (avatar.js) with mounts; false for walk, or when the character has no mounts.
  function mount(pet, ch, spot) {
    if (!MOUNT[spot] || !ch || !ch.mounts || !ch.mounts[spot]) return false;
    if (pet.group.parent) pet.group.parent.remove(pet.group);
    pet.group.position.set(0, 0, 0);
    pet.group.rotation.set(0, 0, 0);
    pet.group.scale.setScalar(MOUNT[spot]);
    ch.mounts[spot].add(pet.group);
    return true;
  }

  // Its name floats above it; build()'s dispose() frees the sprite.
  function tag(S, pet, name) {
    var s = S.sprite(S.label(name, '#7b5cff'), 2.6, 2.6 * 180 / 512);
    s.position.set(0, pet.top + 0.9, 0);
    pet.group.add(s);
    pet.sprites.push(s);
    return s;
  }

  var exported = { BODIES: BODIES, GEAR: GEAR, MOUNT: MOUNT, SCALE: SCALE, build: build, mount: mount, tag: tag };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.PetBody = exported;
})(this);
