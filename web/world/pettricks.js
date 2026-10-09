/* Pet tricks and toys. A trick moves the pet's whole body (pets.js TRICKS), so every pet can do every trick with no
   per-pet drawing; a riding pet does a third of it, and spins instead of rolling or flipping off her. The toys are
   tiny shapes she throws and the pet carries in its mouth. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;

  function hop(p, h) { return Math.sin(Math.PI * p) * h; }
  // Turns the body by a about a point h above its feet, so a roll or a flip turns about its middle.
  function about(b, axis, a, h) {
    b.rotation[axis] += a;
    b.position.y += h - h * Math.cos(a);
    if (axis === 'z') b.position.x += h * Math.sin(a);
    else b.position.z -= h * Math.sin(a);
  }

  // MOVES[id](body, p, k, h): p runs 0 → 1 over the trick; k = 1 walking, 1/3 riding; h = the pet's middle.
  var MOVES = {
    'trick-bow': function (b, p) { b.rotation.x += Math.sin(Math.PI * p) * 0.6; },
    'trick-spin': function (b, p) { b.rotation.y += p * TAU; },
    'trick-jump': function (b, p, k) {
      if (p < 0.85) b.position.y += hop(p / 0.85, 2.2 * k);
      else if (p < 1) b.scale.set(1.15, 0.8, 1.15);
    },
    'trick-roll': function (b, p, k, h) {
      if (k < 1) return MOVES['trick-spin'](b, p);
      b.position.y += hop(p, 0.6);
      about(b, 'z', p * TAU, h);
    },
    'trick-dance': function (b, p, k) {
      b.rotation.z += Math.sin(p * TAU * 3) * 0.35;
      b.position.y += Math.abs(Math.sin(p * Math.PI * 3)) * 0.6 * k;
    },
    'trick-twirl': function (b, p, k) {
      b.position.y += hop(p, 2.4 * k);
      b.rotation.y += p * TAU;
    },
    'trick-backflip': function (b, p, k, h) {
      if (k < 1) return MOVES['trick-spin'](b, p);
      b.position.y += hop(p, 2.6);
      about(b, 'x', -p * TAU, h);
    }
  };

  // After pet.animate(): the trick on top of the mood pose.
  function trick(pet, id, p, small) {
    var m = MOVES[id];
    if (m) m(pet.body, Math.min(1, Math.max(0, p)), small ? 1 / 3 : 1, pet.top * 0.5);
  }

  var TOYS = {
    'toy-ball': function (S, g) { S.add(S.ball(0.35), '#c6f432', 0, 0.35, 0, g); },
    'toy-bone': function (S, g) {
      S.add(S.cyl(0.12, 0.12, 0.9, 8), '#fff5e0', 0, 0.2, 0, g).rotation.z = Math.PI / 2;
      [-1, 1].forEach(function (s) {
        S.add(S.ball(0.16), '#fff5e0', s * 0.45, 0.2, 0.1, g);
        S.add(S.ball(0.16), '#fff5e0', s * 0.45, 0.2, -0.1, g);
      });
    },
    'toy-frisbee': function (S, g) {
      S.add(S.cyl(0.6, 0.6, 0.08, 20), '#ff6f91', 0, 0.06, 0, g);
      S.add(S.torus(0.5, 0.05, 6, 20), '#ffd166', 0, 0.1, 0, g).rotation.x = Math.PI / 2;
    }
  };

  // A toy at world size with its bottom at y = 0 (in the air or on the ground). Shapes and colours are shared and
  // cached by scene.js, so dropping a toy needs no dispose.
  function toy(S, id) {
    var g = new S.THREE.Group();
    (TOYS[id] || TOYS['toy-ball'])(S, g);
    return g;
  }

  // The toy in the pet's mouth: just below and in front of its face, at the pet's size.
  function hold(pet, g) {
    var f = pet.anchors.face, s = pet.anchors.s;
    if (g.parent) g.parent.remove(g);
    g.position.set(f[0], f[1] - 0.45 * s, f[2] + 0.1);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(s * 0.9);
    pet.body.add(g);
  }

  var exported = { MOVES: MOVES, TOYS: TOYS, trick: trick, toy: toy, hold: hold };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.PetTricks = exported;
})(this);
