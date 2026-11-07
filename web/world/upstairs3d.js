/* The upper floors in 3D: on every subject building the spiral stairs at the north front corner, the balcony with its
   railing and posts, the Term 2 door (🌟, or 🌱 and greyed until Term 2 lessons exist), the exam board, and the
   Term 1 / Term 2 plaques. Positions come from upstairs.js (world coordinates). */
(function (root) {
  'use strict';
  var STEPS = 12, TURN = Math.PI * 1.5;

  // o = { floors: Upstairs.all(...), term1, term2 } (English sign words for the plaques).
  function create(S, o) {
    var THREE = S.THREE, group = new THREE.Group(), myTex = [], mySprites = [], dim = [];
    S.scene.add(group);

    function add(geo, color, x, y, z) { return S.add(geo, color, x, y, z, group); }
    function sprite(tex, w, h, x, y, z) {
      myTex.push(tex);
      var s = S.sprite(tex, w, h);
      mySprites.push(s.material);
      s.position.set(x, y, z);
      group.add(s);
      return s;
    }
    function label(text, color, w, x, y, z) { return sprite(S.label(text, color), w, w * 180 / 512, x, y, z); }

    o.floors.forEach(function (i) {
      var y = i.y, s = i.side, midX = (i.wall + i.rail) / 2, depth = Math.abs(i.rail - i.wall), len = i.box.maxZ - i.box.minZ;
      var face = -s;
      add(S.rbox(depth + 0.2, 0.3, len, 0.1), '#fff6fb', midX, y - 0.15, (i.box.minZ + i.box.maxZ) / 2);
      add(S.rbox(0.2, 1.1, len, 0.06), '#ffffff', i.rail, y + 0.55, (i.box.minZ + i.box.maxZ) / 2);
      add(S.rbox(depth, 1.1, 0.2, 0.06), '#ffffff', midX, y + 0.55, i.box.maxZ);
      i.posts.forEach(function (p) { add(S.cyl(p.r, p.r, y, 10), '#ffffff', p.x, y / 2, p.z); });

      add(S.cyl(0.25, 0.25, y + 1.2, 10), '#c98b6b', i.stairs.x, (y + 1.2) / 2, i.stairs.z);
      for (var k = 0; k < STEPS; k++) {
        // The bottom step faces the street-side foot and the top step points +z, onto the balcony.
        var a = Math.PI / 2 - s * TURN * (STEPS - 1 - k) / STEPS, st = add(S.rbox(i.stairs.r, 0.18, 0.7, 0.05), '#ffd9a8',
          i.stairs.x + Math.cos(a) * i.stairs.r / 2, (k + 1) * y / STEPS, i.stairs.z + Math.sin(a) * i.stairs.r / 2);
        st.rotation.y = -a;
      }

      var ready = i.ready, doorX = i.wall + face * 0.3;
      add(S.rbox(0.5, 3.4, 2.4, 0.25), ready ? '#c98b6b' : '#d8d8e0', doorX, y + 1.7, i.door.z);
      sprite(S.emoji(ready ? '🌟' : '🌱'), 0.9, 0.9, doorX + face * 0.4, y + 3.9, i.door.z);
      label(o.term2, ready ? i.roof : '#b8b8c8', 3.2, doorX + face * 0.4, y + 4.9, i.door.z);
      add(S.rbox(0.25, 1.8, 2.2, 0.06), i.examReady ? '#5a7f5a' : '#b8b8c8', i.wall + face * 0.2, y + 1.9, i.exam.z);
      sprite(S.emoji('📝'), 0.8, 0.8, i.wall + face * 0.45, y + 2.0, i.exam.z);
      label(o.term1, i.roof, 3.2, i.wall + face * 0.6, 5.9, i.door.z + 2.6);
      if (!ready) dim.push(i.app);
    });

    return {
      group: group,
      count: function () { return o.floors.length; },
      dimmed: function () { return dim.slice(); },
      dispose: function () {
        S.scene.remove(group);
        mySprites.forEach(function (m) { m.dispose(); });
        myTex.forEach(function (t) { if (t && t.dispose) t.dispose(); });
      }
    };
  }

  var exported = { create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Upstairs3D = exported;
})(this);
