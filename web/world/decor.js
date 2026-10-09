/* Decorations that follow her progress: a medal flag on the roof (bronze), a banner and flowers over the door (silver),
   a gold roof with a twinkling star (gold); floating markers (⚔️ boss, ❗ quest, 🔁 n due); the shop's ✨; the Boss
   Fort's count, glowing gate, ⭐ when the boss waits for his finale, or sleepy 💤 when there is no boss; and Mayor Mimi's sparkle trail. apply(snapshot) redraws; animate(t) moves. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var MEDAL = ['', '#d08a4e', '#cfd8e6', '#ffd54a'];
  var MARK = { boss: '⚔️', quest: '❗' };
  var TRAIL_GAP = 2.2;

  // built = what build.js returned: { buildings: { app: { group, roofs, roofColor, top, signY } }, shop, fort: { group, door } }
  function create(S, built, T) {
    var THREE = S.THREE, add = S.add;
    var medals = {}, marks = {}, moving = [], twinkles = [], trail = [], fortGlow = false, fortBadge = null;
    var starTex = S.emoji('🌟');
    var trailMat = new THREE.SpriteMaterial({ map: S.emoji('✨'), transparent: true, depthWrite: false });

    var shopSpark = S.sprite(S.emoji('✨'), 2.2, 2.2);
    shopSpark.position.set(0, 10.5, 0);
    shopSpark.visible = false;
    built.shop.add(shopSpark);
    var fortSleep = S.sprite(S.emoji('💤'), 2.4, 2.4);
    fortSleep.position.set(3, 8.5, 9);
    built.fort.group.add(fortSleep);
    var fortStar = S.sprite(S.emoji('⭐'), 3, 3);
    fortStar.position.set(0, 19, 0);
    fortStar.visible = false;
    built.fort.group.add(fortStar);
    var fixed = [{ o: shopSpark, y: 10.5 }, { o: fortSleep, y: 8.5 }, { o: fortStar, y: 19 }];

    // Sprites own their material (the textures are shared and cached), so free the material when a sprite goes.
    function empty(group) {
      while (group.children.length) {
        var c = group.children[0];
        group.remove(c);
        if (c.isSprite) c.material.dispose();
      }
    }

    function layer(store, app) {
      if (!store[app]) {
        store[app] = new THREE.Group();
        built.buildings[app].group.add(store[app]);
      }
      empty(store[app]);
      return store[app];
    }

    function medal(app, level) {
      var b = built.buildings[app], g = layer(medals, app);
      b.roofs.forEach(function (m) { m.material = S.toon(level === 3 ? MEDAL[3] : b.roofColor); });
      if (level < 1) return;
      // The flag stands on the roof's side, clear of the name sign above the middle.
      add(S.cyl(0.12, 0.12, 3, 8), '#ffffff', 4.4, b.flagY + 1.5, 0, g);
      add(S.cone(0.8, 1.6, 3), MEDAL[level], 5.1, b.flagY + 2.4, 0, g).rotation.z = -Math.PI / 2;
      if (level >= 2) {
        add(S.rbox(6, 1.1, 0.25, 0.3), MEDAL[2], 0, 6.25, 4.2, g);
        for (var k = 0; k < 5; k++) add(S.ball(0.3), ['#ff8fab', '#ffd166', '#c77dff'][k % 3], (k - 2) * 1.2, 6.9, 4.3, g);
      }
      if (level === 3) {
        var star = S.sprite(starTex, 2, 2);
        star.position.set(0, b.signY + 4.2, 0);
        g.add(star);
        twinkles.push(star);
      }
    }

    function markers(app, list) {
      var b = built.buildings[app], g = layer(marks, app);
      list.forEach(function (m, i) {
        var s = S.sprite(S.badge(m.kind === 'due' ? '🔁' + m.count : MARK[m.kind]), 2.6, 1.3);
        s.position.set((i - (list.length - 1) / 2) * 2.9, b.signY + 2.4, 0);
        g.add(s);
        moving.push({ o: s, y: s.position.y });
      });
    }

    function fort(f) {
      fortSleep.visible = !f.next && !f.beaten;
      fortStar.visible = !!f.finale;
      fortGlow = !!f.next || !!f.finale;
      if (!fortGlow) built.fort.door.material.emissive.setRGB(0, 0, 0);
      if (fortBadge) {
        built.fort.group.remove(fortBadge);
        fortBadge.material.dispose();
        fortBadge = null;
      }
      if (!f.total) return;
      fortBadge = S.sprite(S.label(W.Progress.fill(T.fortCount, { c: f.cleared, n: f.total }), '#ff6f91'), 7.5, 7.5 * 180 / 512);
      // Clear of the Boss Fort sign at 14, which is taller on Grade 2 (signScale 1.25) and bobs 0.25 up and down.
      fortBadge.position.set(0, 18, 0);
      built.fort.group.add(fortBadge);
    }

    function apply(snap) {
      moving = [];
      twinkles = [];
      Object.keys(snap.apps).forEach(function (app) {
        if (!built.buildings[app]) return;
        medal(app, snap.apps[app].level);
        markers(app, snap.apps[app].markers);
      });
      shopSpark.visible = !!(snap.shop && snap.shop.sparkle);
      fort(snap.fort);
    }

    function hideTrail() {
      trail.forEach(function (s) { S.scene.remove(s); });
      trail = [];
    }

    // points: [[x, z], ...] from layout.route(); one sparkle every TRAIL_GAP along the way.
    function showTrail(points) {
      hideTrail();
      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / TRAIL_GAP));
        for (var k = i === 1 ? 0 : 1; k <= n; k++) {
          var s = new THREE.Sprite(trailMat);
          s.position.set(a[0] + (b[0] - a[0]) * k / n, 0.7, a[1] + (b[1] - a[1]) * k / n);
          S.scene.add(s);
          trail.push(s);
        }
      }
    }

    function animate(t) {
      fixed.concat(moving).forEach(function (m) { m.o.position.y = m.y + Math.sin(t * 2.4 + m.o.position.x) * 0.3; });
      twinkles.forEach(function (s) { var k = 2 + Math.sin(t * 4) * 0.3; s.scale.set(k, k, 1); });
      trail.forEach(function (s, i) { var k = 0.7 + 0.35 * Math.max(0, Math.sin(t * 5 - i * 0.6)); s.scale.set(k, k, 1); });
      if (fortGlow) built.fort.door.material.emissive.setRGB(0.25 + 0.25 * Math.sin(t * 3), 0.05, 0.15);
    }

    return { apply: apply, showTrail: showTrail, hideTrail: hideTrail, trailCount: function () { return trail.length; }, animate: animate };
  }

  W.Decor = { create: create };
})(this);
