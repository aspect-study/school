/* Draws the world from layout.js: ground and paths, School Street's buildings, the Boss Fort with its rainbow, the
   Plaza with the fountain and the quick-travel signpost, Jesus' Garden, Shop Plaza, Whispering Park, My Little House
   (her room is inside, room3d.js), the Playground and the gate. Later phases put characters and markers into these places. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var TREE_COLORS = ['#7fdc8b', '#ffb7d5', '#8ee0c0', '#b8e986'];
  var FLOWER_COLORS = ['#ff8fab', '#ffd166', '#ffffff', '#c77dff'];
  var RAINBOW = ['#ff9aa2', '#ffdac1', '#fff5ba', '#b5ead7', '#c7ceea'];
  var CHEER = ['🎉', '⭐', '💖', '✨'];

  function build(S, grade, T) {
    var THREE = S.THREE, L = W.Layout, add = S.add, rbox = S.rbox, ball = S.ball, toon = S.toon;
    var cfg = L.GRADES[grade], P = L.places(grade), pr = L.props(grade), obs = L.obstacles(grade);
    var cheerTex = CHEER.map(function (e) { return S.emoji(e); });
    var heartTex = ['💛', '💗', '✨'].map(function (e) { return S.emoji(e); });
    var doorMats = {}, signs = [], clouds = [], sparks = [], parts = {}, shopGroup = null, fortParts = null, rideParts = null;

    function flat(m) { m.castShadow = false; return m; }
    function group(x, z, rot) {
      var g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot || 0;
      S.scene.add(g);
      return g;
    }
    function floatSign(text, bg, x, y, z, w, parent) {
      var s = S.sprite(S.label(text, bg), w, w * 180 / 512);
      s.position.set(x, y, z);
      s.userData.y = y;
      s.userData.phase = signs.length;
      (parent || S.scene).add(s);
      signs.push(s);
      return s;
    }

    function ground() {
      var b = cfg.bounds;
      var g = flat(add(new THREE.PlaneGeometry(b.maxX - b.minX + 160, b.maxZ - b.minZ + 160), '#a8e6a1', (b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2));
      g.rotation.x = -Math.PI / 2;
      L.paths(grade).forEach(function (p) {
        var dx = p.to[0] - p.from[0], dz = p.to[1] - p.from[1];
        var m = flat(add(rbox(p.w, 0.2, Math.hypot(dx, dz) + p.w, 0.1), '#fff1d6', (p.from[0] + p.to[0]) / 2, 0, (p.from[1] + p.to[1]) / 2));
        m.rotation.y = Math.atan2(dx, dz);
      });
    }

    function porthole(g, x, y, z) {
      add(S.cyl(1.15, 1.15, 0.3, 28), '#ffffff', x, y, z, g).rotation.x = Math.PI / 2;
      add(S.cyl(0.9, 0.9, 0.35, 28), toon('#fffbe0', { emissive: '#fff3b0', emissiveIntensity: 0.5 }), x, y, z + 0.05, g).rotation.x = Math.PI / 2;
      add(rbox(2.6, 0.5, 0.8, 0.2), '#ffffff', x, y - 1.35, z + 0.25, g);
      for (var k = 0; k < 3; k++) add(ball(0.32), FLOWER_COLORS[k], x - 0.8 + k * 0.8, y - 0.95, z + 0.35, g);
    }

    // Local +z is the front, turned to face the street. parts[app] keeps what decor.js changes with her medals.
    function building(b) {
      var g = group(b.x, b.z, b.rot), roofs = [], top, flagY;
      add(rbox(11.5, 0.7, 9.5, 0.3), '#ffffff', 0, 0.35, 0, g);
      add(rbox(10, 6.4, 8, 1.2), b.wall, 0, 3.7, 0, g);
      if (b.shape === 'dome') {
        roofs.push(add(ball(5.4), b.roof, 0, 6.9, 0, g));
        roofs[0].scale.set(1, 0.62, 0.8);
        add(ball(0.6), '#fff6a8', 0, 10.5, 0, g);
        top = 10.5;
        flagY = 8.8;
      } else if (b.shape === 'cone') {
        roofs.push(add(S.cone(6.6, 4.6, 32), b.roof, 0, 9.3, 0, g));
        roofs[0].scale.z = 0.8;
        add(ball(0.55), '#fff6a8', 0, 11.8, 0, g);
        top = 11.8;
        flagY = 8.5;
      } else {
        roofs.push(add(rbox(10.6, 1.4, 8.6, 0.6), b.roof, 0, 7.4, 0, g));
        for (var d = -4; d <= 4; d += 1.6) roofs.push(add(ball(0.55), b.roof, d, 6.7, 4.2, g));
        add(rbox(3, 2.4, 3, 0.6), '#ffffff', 0, 9, 0, g);
        add(ball(0.7), '#ff6f91', 0, 10.7, 0, g);
        top = 10.7;
        flagY = 8.1;
      }
      add(rbox(2.6, 3.8, 0.5, 0.25), '#c98b6b', 0, 2.6, 4.05, g);
      add(ball(1.3), '#c98b6b', 0, 4.5, 4.05, g).scale.set(1, 0.6, 0.38);
      add(ball(0.2), '#ffd166', 0.8, 2.5, 4.35, g);
      porthole(g, -3.3, 4.3, 4.05);
      porthole(g, 3.3, 4.3, 4.05);
      var signY = b.shape === 'cake' ? 12.2 : 11.8;
      floatSign(b.emoji + ' ' + b.sign, b.roof, 0, signY, 0, 6.4 * cfg.signScale, g);
      doorMats[b.app] = flat(add(S.cyl(2.1, 2.1, 0.12, 40), toon('#ffffff', { transparent: true, opacity: 0.85 }, true), 0, 0.1, L.BUILDING.doorOut, g));
      parts[b.app] = { group: g, roofs: roofs, roofColor: b.roof, top: top, flagY: flagY, signY: signY };
    }

    function fort(p) {
      var g = group(p.x, p.z);
      add(S.cyl(9, 9.8, 6.5, 32), '#c9b6e4', 0, 3.25, 0, g);
      for (var c = 0; c < 12; c++) {
        var a = c / 12 * Math.PI * 2;
        add(rbox(1.7, 1.7, 1.7, 0.4), '#b39ddb', Math.cos(a) * 9, 7.3, Math.sin(a) * 9, g);
      }
      var door = add(rbox(4, 4.4, 0.6, 0.6), toon('#8e7cc3', null, true), 0, 2.2, 9.7, g);
      fortParts = { group: g, door: door };
      add(S.cyl(0.15, 0.15, 6, 8), '#ffffff', 0, 9.5, 0, g);
      add(rbox(3, 1.8, 0.2, 0.2), '#ff6f91', 1.6, 11.5, 0, g);
      floatSign(L.PLACE_EMOJI.boss + ' ' + T.places.boss, '#ff6f91', 0, 14, 0, 7.5 * cfg.signScale, g);
      var bow = new THREE.Group();
      bow.position.set(0, 0, -10);
      g.add(bow);
      RAINBOW.forEach(function (rc, i) {
        flat(add(new THREE.TorusGeometry(24 - i * 1.6, 0.8, 12, 64, Math.PI), toon(rc, { transparent: true, opacity: 0.85 }), 0, 0, 0, bow));
      });
    }

    function plaza(p) {
      var g = group(p.x, p.z);
      flat(add(S.cyl(p.r, p.r, 0.16, 48), '#ffe3f1', 0, 0.06, 0, g));
      add(S.cyl(3.2, 3.4, 1, 32), '#ffffff', 0, 0.5, 0, g);
      flat(add(S.cyl(2.8, 2.8, 0.2, 32), '#9ed8ff', 0, 1.0, 0, g));
      add(S.cyl(0.5, 0.7, 2.4, 16), '#ffffff', 0, 1.6, 0, g);
      add(ball(1.0), '#9ed8ff', 0, 3.1, 0, g).scale.set(1, 0.6, 1);
      var post = pr.signpost;
      add(S.cyl(0.25, 0.25, 4, 10), '#c48a6a', post.x, 2, post.z);
      add(rbox(3.4, 1, 0.3, 0.2), '#ffd166', post.x, 3.6, post.z).rotation.y = Math.PI / 4;
      floatSign(T.signpost, '#ffb347', post.x, 5.8, post.z, 4.8 * cfg.signScale);
    }

    function garden(p) {
      var g = group(p.x, p.z);
      flat(add(S.cyl(p.r, p.r, 0.12, 48), '#fff1de', 0, 0.05, 0, g));
      var lx = pr.bench.x - p.x;
      add(rbox(1.6, 0.5, 5, 0.2), '#e7b58c', lx, 1.3, 0, g);
      add(rbox(0.4, 1.4, 5, 0.2), '#e7b58c', lx - 0.7, 2.2, 0, g);
      add(rbox(1.4, 1.1, 0.4, 0.15), '#c98f62', lx, 0.55, -2, g);
      add(rbox(1.4, 1.1, 0.4, 0.15), '#c98f62', lx, 0.55, 2, g);
      for (var f = 0; f < 40; f++) {
        var a = f / 40 * Math.PI * 2;
        flat(add(ball(0.3), FLOWER_COLORS[f % 4], Math.cos(a) * (p.r - 1.5), 0.35, Math.sin(a) * (p.r - 1.5), g));
      }
      floatSign(L.PLACE_EMOJI.garden + ' ' + T.places.garden, '#ffb347', 0, 7, 0, 7 * cfg.signScale, g);
    }

    // Front faces west, toward the plaza.
    function shop() {
      var s = pr.shop, g = group(s.x, s.z, -Math.PI / 2);
      shopGroup = g;
      add(rbox(s.hz * 2, 5.5, 10, 1), '#fff6c9', 0, 2.75, -1, g);
      for (var k = 0; k < 6; k++) add(rbox(2, 0.5, 1.6, 0.2), k % 2 ? '#ffffff' : '#ff8fab', -5 + k * 2, 5.4, 4.4, g);
      add(rbox(6, 1.2, 1.2, 0.4), '#ffd166', 0, 1.2, 5, g);
      floatSign(L.PLACE_EMOJI.shop + ' ' + T.places.shop, '#ffb347', 0, 8.5, 0, 7 * cfg.signScale, g);
    }

    // Lola Lana's Boutique: a striped stall south of the shop; its front faces west, toward the path.
    function stall() {
      var s = pr.stall, g = group(s.x, s.z, -Math.PI / 2);
      add(rbox(s.hz * 2, 1.3, s.hx * 2, 0.3), '#ffd6e7', 0, 0.65, 0, g);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) { add(S.cyl(0.1, 0.1, 3.6, 8), '#ffffff', c[0] * (s.hz - 0.2), 1.8, c[1] * (s.hx - 0.2), g); });
      for (var k = 0; k < 5; k++) add(rbox(0.6, 0.3, s.hx * 2 + 0.4, 0.1), k % 2 ? '#ffffff' : '#ff8fc8', -1.2 + k * 0.6, 3.7, 0, g);
      ['#ff8fc8', '#6aa9ff', '#ffd166'].forEach(function (c, i) { add(ball(0.3), c, -0.6 + i * 0.6, 1.6, s.hx - 0.6, g); });
      floatSign('🧶 ' + T.boutique, '#ff8fc8', 0, 6, 0, 6 * cfg.signScale, g);
    }

    // Mang Kiko's Pet Stall: Lola Lana's stall on the other side of the shop, in green, with pet bowls on the counter.
    function petStall() {
      var s = pr.petStall, g = group(s.x, s.z, -Math.PI / 2);
      add(rbox(s.hz * 2, 1.3, s.hx * 2, 0.3), '#d5f5e3', 0, 0.65, 0, g);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) { add(S.cyl(0.1, 0.1, 3.6, 8), '#ffffff', c[0] * (s.hz - 0.2), 1.8, c[1] * (s.hx - 0.2), g); });
      for (var k = 0; k < 5; k++) add(rbox(0.6, 0.3, s.hx * 2 + 0.4, 0.1), k % 2 ? '#ffffff' : '#5fcf9a', -1.2 + k * 0.6, 3.7, 0, g);
      ['#6aa9ff', '#ff8fc8', '#ffd166'].forEach(function (c, i) { add(S.cyl(0.3, 0.22, 0.2, 16), c, -0.6 + i * 0.6, 1.4, s.hx - 0.6, g); });
      floatSign('🦜 ' + T.petshop, '#5fcf9a', 0, 6, 0, 6 * cfg.signScale, g);
    }

    // Kuya Pilo's Toy Stall: south of Lola Lana's, in sunny yellow, with toys on the counter.
    function toyStall() {
      var s = pr.toyStall, g = group(s.x, s.z, -Math.PI / 2);
      add(rbox(s.hz * 2, 1.3, s.hx * 2, 0.3), '#fff2b3', 0, 0.65, 0, g);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) { add(S.cyl(0.1, 0.1, 3.6, 8), '#ffffff', c[0] * (s.hz - 0.2), 1.8, c[1] * (s.hx - 0.2), g); });
      for (var k = 0; k < 5; k++) add(rbox(0.6, 0.3, s.hx * 2 + 0.4, 0.1), k % 2 ? '#ffffff' : '#ffb347', -1.2 + k * 0.6, 3.7, 0, g);
      add(ball(0.3), '#ff6f91', -0.6, 1.6, s.hx - 0.6, g);
      add(S.cone(0.25, 0.5, 6), '#6aa9ff', 0, 1.55, s.hx - 0.6, g);
      add(rbox(0.45, 0.45, 0.45, 0.1), '#7fdc8b', 0.6, 1.55, s.hx - 0.6, g);
      floatSign('🎈 ' + T.toyshop, '#ffb347', -1, 5.2, 0, 6 * cfg.signScale, g);
    }

    // Tito Tasyo's Workshop: south of Kuya Pilo's, in warm wood, with a plank and a little saw on the counter.
    function workshop() {
      var s = pr.tasyoStall, g = group(s.x, s.z, -Math.PI / 2);
      add(rbox(s.hz * 2, 1.3, s.hx * 2, 0.3), '#e8c9a0', 0, 0.65, 0, g);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) { add(S.cyl(0.1, 0.1, 3.6, 8), '#ffffff', c[0] * (s.hz - 0.2), 1.8, c[1] * (s.hx - 0.2), g); });
      for (var k = 0; k < 5; k++) add(rbox(0.6, 0.3, s.hx * 2 + 0.4, 0.1), k % 2 ? '#ffffff' : '#a0703c', -1.2 + k * 0.6, 3.7, 0, g);
      add(rbox(0.5, 0.16, 1.8, 0.06), '#f6deb5', 0.3, 1.38, s.hx - 1.3, g).rotation.y = 0.15;
      var saw = new THREE.Group();
      saw.position.set(-0.45, 1.36, s.hx - 0.75);
      saw.rotation.y = -0.4;
      g.add(saw);
      add(rbox(0.5, 0.06, 1.0, 0.03), '#dfe6ee', 0, 0, 0.2, saw);
      add(rbox(0.32, 0.18, 0.4, 0.08), '#ff7f7f', 0, 0.05, -0.45, saw);
      add(rbox(0.24, 0.24, 0.24, 0.06), '#ffd166', -0.2, 1.47, s.hx - 1.9, g);
      floatSign('🔨 ' + T.tasyo, '#a0703c', -1, 5.2, 0, 6 * cfg.signScale, g);
    }

    function park(p) {
      var g = group(p.x, p.z), pond = pr.pond;
      flat(add(S.cyl(p.r, p.r, 0.1, 48), '#b8ecc8', 0, 0.04, 0, g));
      flat(add(S.cyl(pond.r, pond.r, 0.14, 36), '#9ed8ff', pond.x - p.x, 0.08, pond.z - p.z, g));
      for (var k = 0; k < 3; k++) flat(add(S.cyl(0.6, 0.6, 0.06, 16), '#7fdc8b', pond.x - p.x - 1.5 + k * 1.4, 0.18, pond.z - p.z + (k % 2 ? 1 : -0.8), g));
      floatSign(L.PLACE_EMOJI.park + ' ' + T.places.park, '#5fcf9a', 0, 8, 0, 7 * cfg.signScale, g);
    }

    function house() {
      var h = pr.house, g = group(h.x, h.z, -Math.PI / 2);
      add(rbox(h.hz * 2, 5, h.hx * 2, 1), '#ffd6e7', 0, 2.5, 0, g);
      add(S.cone(7.4, 4, 4), '#ff8fab', 0, 7, 0, g).rotation.y = Math.PI / 4;
      add(rbox(2.2, 3.4, 0.4, 0.2), '#c98b6b', 0, 1.7, h.hx + 0.05, g);
      add(S.cyl(0.9, 0.9, 0.3, 24), '#fffbe0', -2.8, 3, h.hx + 0.05, g).rotation.x = Math.PI / 2;
      add(S.cyl(0.9, 0.9, 0.3, 24), '#fffbe0', 2.8, 3, h.hx + 0.05, g).rotation.x = Math.PI / 2;
      floatSign(L.PLACE_EMOJI.house + ' ' + T.places.house, '#ff8fab', 0, 10.5, 0, 7 * cfg.signScale, g);
    }

    // A swing hangs from the bar on two ropes; its group turns about the bar (rides.js gives the angle).
    function swing(x, z) {
      var pivot = new THREE.Group();
      pivot.position.set(x, 4.4, z);
      S.scene.add(pivot);
      [-0.4, 0.4].forEach(function (dx) { add(S.cyl(0.05, 0.05, 3.2, 6), '#ffffff', dx, -1.6, 0, pivot); });
      add(rbox(1, 0.2, 0.7, 0.1), '#ffd166', 0, -3.2, 0, pivot);
      return pivot;
    }

    function playground(p) {
      flat(add(S.cyl(p.r, p.r, 0.1, 48), '#ffe9b8', p.x, 0.04, p.z));
      var sl = pr.slide, sw = pr.swings, se = pr.seesaw, mr = pr.merry;
      var ramp = W.Rides.RAMP;
      add(rbox(1.6, 0.3, ramp.half * 2, 0.15), '#ff8fab', sl.x, ramp.y, sl.z + ramp.dz, null).rotation.x = ramp.tilt;
      add(rbox(1.6, 3.6, 1.4, 0.3), '#6aa9ff', sl.x, 1.8, sl.z - 2.4);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x - 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x + 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 6, 8), '#a77bff', sw.x, 4.4, sw.z).rotation.z = Math.PI / 2;
      var left = swing(sw.x - 1.2, sw.z);
      var pivot = swing(sw.x + 1.2, sw.z);
      var plank = new THREE.Group();
      plank.position.set(se.x, 0.9, se.z);
      plank.rotation.z = W.Rides.part('seesaw', null);
      S.scene.add(plank);
      add(rbox(6, 0.25, 0.7, 0.12), '#5fcf9a', 0, 0, 0, plank);
      add(S.cone(0.6, 0.8, 4), '#ffffff', se.x, 0.4, se.z);
      var merry = new THREE.Group();
      merry.position.set(mr.x, 0, mr.z);
      S.scene.add(merry);
      add(S.cyl(mr.r, mr.r, 0.4, 24), '#ff9e6b', 0, 0.5, 0, merry);
      add(S.cyl(0.2, 0.2, 2, 8), '#ffffff', 0, 1.6, 0, merry);
      for (var h = 0; h < 4; h++) add(S.cyl(0.08, 0.08, 1.2, 6), '#ffffff', Math.cos(h * Math.PI / 2) * 1.7, 1.2, Math.sin(h * Math.PI / 2) * 1.7, merry);
      rideParts = { pivot: pivot, left: left, plank: plank, merry: merry };
      floatSign(L.PLACE_EMOJI.playground + ' ' + T.places.playground, '#ff9e6b', p.x, 7.5, p.z, 7 * cfg.signScale);
    }

    function gate(p) {
      pr.posts.forEach(function (c) {
        add(S.cyl(0.7, 0.7, 7, 20), '#ffffff', c.x, 3.5, c.z);
        add(ball(1.1), '#ffb3d9', c.x, 7.4, c.z);
      });
      add(new THREE.TorusGeometry(6.5, 0.5, 16, 48, Math.PI), '#ffd166', p.x, 7, p.z);
      floatSign(L.PLACE_EMOJI.gate + ' ' + T.title, '#c77dff', p.x, 9.8, p.z, 9 * cfg.signScale);
    }

    function tree(t) {
      var s = t.s, c = TREE_COLORS[t.c];
      add(S.cyl(0.35 * s, 0.5 * s, 2.4 * s, 12), '#c48a6a', t.x, 1.2 * s, t.z);
      add(ball(1.8 * s), c, t.x, 3.6 * s, t.z);
      add(ball(1.3 * s), c, t.x - 1.2 * s, 3.1 * s, t.z + 0.3 * s);
      add(ball(1.2 * s), c, t.x + 1.1 * s, 3.3 * s, t.z - 0.2 * s);
    }

    function details() {
      var b = cfg.bounds, w = b.maxX - b.minX - 16, d = b.maxZ - b.minZ - 16;
      for (var f = 0; f < 160; f++) {
        var x = b.minX + 8 + (f * 53 % w), z = b.minZ + 8 + (f * 97 % d);
        if (L.blocked(obs, b, x, z, 0.4) || L.onPath(grade, x, z, 0.6)) continue;
        flat(add(ball(0.32), FLOWER_COLORS[f % 4], x, 0.45, z, S.detail));
      }
      for (var k = 0; k < 10; k++) {
        var cg = new THREE.Group();
        cg.position.set(-80 + k * 17, 30 + (k % 3) * 6, b.minZ + 20 + (k * 23 % (b.maxZ - b.minZ - 40)));
        [[0, 0, 2.6], [2.6, 0.6, 3], [5.2, 0, 2.4], [2.6, -0.6, 2.2]].forEach(function (p) { flat(add(ball(p[2]), '#ffffff', p[0], p[1], 0, cg)); });
        S.detail.add(cg);
        clouds.push(cg);
      }
    }

    function sparkle(x, z) {
      for (var i = 0; i < 12; i++) {
        var s = S.sprite(S.emoji(i % 2 ? '✨' : '💗'), 1, 1);
        s.position.set(x + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, z + (Math.random() - 0.5) * 3);
        S.scene.add(s);
        sparks.push({ s: s, vy: 2 + Math.random() * 2, life: 1.4 });
      }
    }

    // A right answer: confetti bursts out and falls.
    function cheer(x, y, z) {
      for (var i = 0; i < 16; i++) {
        var a = i / 16 * Math.PI * 2, s = S.sprite(cheerTex[i % cheerTex.length], 0.9, 0.9);
        s.position.set(x, y, z);
        S.scene.add(s);
        sparks.push({ s: s, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 3 + Math.random() * 2, g: 5, life: 1.6, keep: true });
      }
    }

    // Jesus's hug and a cheer for her sister: hearts float up and fade.
    function hearts(x, y, z) {
      for (var i = 0; i < 14; i++) {
        var s = S.sprite(heartTex[i % heartTex.length], 0.9, 0.9);
        s.position.set(x + (Math.random() - 0.5) * 3, y + Math.random(), z + (Math.random() - 0.5) * 3);
        S.scene.add(s);
        sparks.push({ s: s, vx: (Math.random() - 0.5) * 1.2, vy: 1.5 + Math.random() * 1.5, life: 2.4, keep: true });
      }
    }

    // The boss's final pop: his themed pieces burst out and fall. Each sprite has its own texture, freed with it.
    function burst(x, y, z, pieces, count) {
      for (var i = 0; i < count; i++) {
        var a = i / count * Math.PI * 2, s = S.sprite(S.emoji(pieces[i % pieces.length]), 1.2, 1.2);
        s.position.set(x, y, z);
        S.scene.add(s);
        sparks.push({ s: s, vx: Math.cos(a) * 4, vz: Math.sin(a) * 4, vy: 4 + Math.random() * 3, g: 5, life: 2 });
      }
    }

    // Effects of her moves (moves.js FX): emoji sprites that rise, drift and fade. At most MAX_FX at once, half as many
    // per puff on low quality. Textures are made once and kept.
    var MAX_FX = 40, fxTex = {}, fxCount = 0;
    function fxLive() { return fxCount; }
    function fx(x, y, z, kind) {
      var f = W.Moves.FX[kind];
      if (!f) return 0;
      var n = Math.max(0, Math.min(S.detail.visible ? f.n : Math.ceil(f.n / 2), MAX_FX - fxLive()));
      for (var i = 0; i < n; i++) {
        var e = f.e[i % f.e.length], s = S.sprite(fxTex[e] || (fxTex[e] = S.emoji(e)), 0.7, 0.7);
        s.position.set(x + (Math.random() - 0.5) * f.spread, y + Math.random() * 0.5, z + (Math.random() - 0.5) * f.spread);
        S.scene.add(s);
        sparks.push({ s: s, vx: (Math.random() - 0.5) * f.spread, vz: (Math.random() - 0.5) * f.spread, vy: f.vy + Math.random() * 0.5, life: f.life, keep: true, fx: true });
        fxCount++;
      }
      return n;
    }

    // Turns a ride's moving part to angle a (rides.js part or loopPart); null puts it back at rest.
    function ride(id, a) {
      if (!rideParts) return;
      if (a === null) a = W.Rides.part(id, null);
      if (id === 'swings') rideParts.pivot.rotation.x = a;
      else if (id === 'swing2') rideParts.left.rotation.x = a;
      else if (id === 'seesaw') rideParts.plank.rotation.z = a;
      else if (id === 'merry') rideParts.merry.rotation.y = a;
    }

    function animate(t, dt, nearDoor) {
      signs.forEach(function (s) { s.position.y = s.userData.y + Math.sin(t * 2 + s.userData.phase) * 0.25; });
      Object.keys(doorMats).forEach(function (app) {
        var on = app === nearDoor, m = doorMats[app], k = 1 + Math.sin(t * 3) * 0.06 + (on ? 0.2 : 0);
        m.material.color.set(on ? '#ffe066' : '#ffffff');
        m.scale.set(k, 1, k);
      });
      clouds.forEach(function (c, i) {
        c.position.x += dt * (0.6 + (i % 3) * 0.3);
        if (c.position.x > 95) c.position.x = -95;
      });
      sparks = sparks.filter(function (p) {
        p.life -= dt;
        p.vy -= (p.g || 0) * dt;
        p.s.position.x += (p.vx || 0) * dt;
        p.s.position.z += (p.vz || 0) * dt;
        p.s.position.y += p.vy * dt;
        p.s.material.opacity = Math.max(0, Math.min(1, p.life));
        if (p.life > 0) return true;
        S.scene.remove(p.s);
        if (p.fx) fxCount--;
        if (!p.keep) p.s.material.map.dispose();
        p.s.material.dispose();
        return false;
      });
    }

    ground();
    L.buildings(grade).forEach(building);
    fort(P.boss);
    plaza(P.plaza);
    garden(P.garden);
    shop();
    stall();
    petStall();
    toyStall();
    workshop();
    park(P.park);
    house();
    playground(P.playground);
    gate(P.gate);
    L.trees(grade).forEach(tree);
    details();

    return { animate: animate, sparkle: sparkle, cheer: cheer, hearts: hearts, burst: burst, fx: fx, fxLive: fxLive, ride: ride, buildings: parts, shop: shopGroup, fort: fortParts };
  }

  W.Build = { build: build };
})(this);
