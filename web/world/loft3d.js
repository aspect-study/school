/* The Study Loft in 3D: a wooden floor with a low railing (so the camera sees over it), a little desk per subject
   with its emoji and English sign (dimmed with 🌱 when Term 2 lessons are not ready), the Exam Corner board on the
   west wall and the ladder hole in the south-east corner. Squares come from loft.js and room.js. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Room = node ? require('./room.js') : root.World3D.Room;
  var Loft = node ? require('./loft.js') : root.World3D.Loft;
  var SQ = Room.SQ, HALF = Math.PI / 2;

  function create(S, o) {
    var THREE = S.THREE, O = Room.ORIGIN, L = Loft.SIZE * SQ, myTex = [], mySprites = [];
    var floorGeo = new THREE.PlaneGeometry(L, L);
    var group = new THREE.Group();
    group.position.set(O.x, 0, O.z);
    S.scene.add(group);

    function add(geo, color, x, y, z, parent) { var m = S.add(geo, color, x, y, z, parent || group); m.castShadow = false; return m; }
    function sprite(tex, w, h, x, y, z, parent) {
      myTex.push(tex);
      var s = S.sprite(tex, w, h);
      mySprites.push(s.material);
      s.position.set(x, y, z);
      (parent || group).add(s);
      return s;
    }
    function local(c, r) { var p = Room.center(c, r); return { x: p.x - O.x, z: p.z - O.z }; }

    var fl = add(floorGeo, '#f3d3a8', L / 2, 0, -L / 2);
    fl.rotation.x = -HALF;
    add(S.rbox(L + 1.6, 0.6, L + 1.6, 0.3), '#fff6fb', L / 2, -0.31, -L / 2);
    [[L / 2, 0.05, L + 0.3, 0.3], [L / 2, -L - 0.05, L + 0.3, 0.3], [-0.05, -L / 2, 0.3, L + 0.3], [L + 0.05, -L / 2, 0.3, L + 0.3]].forEach(function (w) {
      add(S.rbox(w[2], 0.2, w[3], 0.06), '#c98f62', w[0], 1.3, w[1]);
      add(S.rbox(w[2], 0.12, w[3], 0.04), '#e7b58c', w[0], 0.4, w[1]);
    });

    var deskGroups = o.desks.map(function (d) {
      var p = local(d.c, d.r), g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      group.add(g);
      var top = d.ready ? d.roof || '#ffd166' : '#d8d8e0';
      add(S.rbox(1.7, 0.14, 1.2, 0.05), top, 0, 1.6, 0, g);
      [[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]].forEach(function (k) { add(S.rbox(0.12, 1.55, 0.12, 0.03), '#c98f62', k[0], 0.78, k[1], g); });
      add(S.rbox(0.9, 0.08, 0.6, 0.02), '#ffffff', 0, 1.72, 0.1, g);
      sprite(S.emoji(d.emoji), 0.9, 0.9, 0, 2.45, 0, g);
      sprite(S.label(d.sign, d.ready ? '#5fcf9a' : '#b8b8c8'), 2.2, 2.2 * 180 / 512, 0, 3.25, 0, g);
      if (!d.ready) sprite(S.emoji('🌱'), 0.6, 0.6, 0.6, 2.1, 0.3, g);
      return g;
    });

    var e = local(Loft.EXAM[0], Loft.EXAM[1]);
    add(S.rbox(0.25, 2.6, 3.2, 0.06), '#5a7f5a', 0.2, 2.2, e.z);
    add(S.rbox(0.3, 0.2, 3.4, 0.04), '#c98f62', 0.22, 0.85, e.z);
    sprite(S.emoji('📝'), 1.0, 1.0, 0.6, 2.4, e.z);
    sprite(S.label('📝 Exam Corner', '#ff9f68'), 2.6, 2.6 * 180 / 512, 0.8, 4.0, e.z);

    var l = local(Loft.LADDER[0], Loft.LADDER[1]);
    add(S.rbox(1.6, 0.05, 1.6, 0.02), '#5a3e2b', l.x, 0.02, l.z);
    [-0.55, 0.55].forEach(function (s) { add(S.rbox(0.16, 1.4, 0.16, 0.04), '#c98f62', l.x + s, 0.7, l.z - 0.6); });
    sprite(S.emoji('🪜'), 0.9, 0.9, l.x, 2.0, l.z);

    return {
      group: group,
      show: function () {},
      see: function () {},
      animate: function () {},
      hit: function () { return null; },
      trophyAt: function () { return null; },
      seeThrough: function () { return []; },
      deskCount: function () { return deskGroups.length; },
      dispose: function () {
        S.scene.remove(group);
        floorGeo.dispose();
        mySprites.forEach(function (m) { m.dispose(); });
        myTex.forEach(function (t) { if (t && t.dispose) t.dispose(); });
      }
    };
  }

  var exported = { create: create };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Loft3D = exported;
})(this);
