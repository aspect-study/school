/* The weekly boss at the Boss Fort (bosses.js): he stands on a little stage beside the path to the gate, bobbing, now
   and then throwing his arms up, with his minions hopping around him (3 for each stage still open). When every stage
   is cleared, the finale: he wobbles, puffs up and pops in his themed burst, and a treasure chest drops. The chest
   stays open on the stage for the rest of the week. No boss this week: the stage is empty. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var STAGE_R = 4, TOP = 0.3, RING = 3.3, WOBBLE = 0.9, PUFF = 0.4, DROP = 0.6, DROP_FROM = 8, LID_OPEN = -1.9;
  // West of the path (its edge is at x -4.5), on the gate side of the fort, turned a little toward her.
  var AT = { x: -10, z: 15, turn: 0.5 };
  var BODY_Y = 2.3;

  // Each boss's hat or hair, on his head (it bobs with him).
  var HATS = {
    cloud: function (S, p, g) { [[-1.5, 1.7, 1], [0, 2.1, 1.3], [1.5, 1.7, 1]].forEach(function (b) { S.add(S.ball(b[2]), p.body, b[0], b[1], 0, g); }); },
    jelly: function (S, p, g) { S.add(S.ball(0.45), '#ffffff', -1.1, 1.1, 1.6, g); S.add(S.ball(0.7), p.accent, 0, 2.1, 0, g); },
    snooze: function (S, p, g) { S.add(S.cone(1.6, 2.4, 20), p.accent, 0, 2.9, 0, g).rotation.z = 0.35; S.add(S.ball(0.4), '#ffffff', 0.75, 4, 0, g); },
    mess: function (S, p, g) {
      [[-1.6, 1.4, 1.6], [1.5, 0.6, 1.65], [0.4, 1.9, 1.2]].forEach(function (b) { S.add(S.rbox(0.6, 0.6, 0.3, 0.1), p.accent, b[0], b[1], b[2], g).rotation.z = b[0]; });
    },
    fuzz: function (S, p, g) {
      for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; S.add(S.ball(0.6), p.body, Math.cos(a) * 2.2, Math.sin(a) * 2, -0.4, g); }
    },
    spud: function (S, p, g) {
      S.add(S.cyl(1.1, 1.1, 0.5, 20), p.accent, 0, 2.15, 0, g);
      for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; S.add(S.cone(0.25, 0.6, 8), p.accent, Math.cos(a) * 0.9, 2.65, Math.sin(a) * 0.9, g); }
    }
  };

  // o = { S, built, grade }
  function create(o) {
    var S = o.S, THREE = S.THREE, B = root.Bosses, p = W.Layout.places(o.grade).boss;
    var x0 = p.x + AT.x, z0 = p.z + AT.z;
    var base = new THREE.Group();
    base.position.set(x0, 0, z0);
    base.rotation.y = AT.turn;
    S.scene.add(base);
    S.add(S.cyl(STAGE_R, STAGE_R + 0.3, TOP, 32), '#ffd6e7', 0, TOP / 2, 0, base);

    var boss = null, model = null, minions = [], play = null, chest = chestModel();
    base.add(chest.group);
    chest.group.visible = false;

    function bossModel(b) {
      var g = new THREE.Group(), pal = b.palette;
      var body = W.Cast.head(S, pal.body, { eyeColor: pal.eye }, 4.2, 3.8, 3.4, 1.5);
      body.position.y = BODY_Y;
      g.add(body);
      HATS[b.id](S, pal, body);
      var arms = [-1, 1].map(function (s) { return S.add(S.ball(0.55), pal.body, s * 2.4, BODY_Y - 0.4, 0.3, g); });
      [-1, 1].forEach(function (s) { S.add(S.ball(0.6), pal.accent, s * 1.1, 0.5, 0.2, g).scale.set(1, 0.7, 1.2); });
      var plate = S.sprite(S.label(b.emoji + ' ' + B.name(b, o.grade), '#ff6f91'), 5.6, 5.6 * 180 / 512);
      plate.position.set(0, BODY_Y + 5.4, 0);
      g.add(plate);
      g.position.y = TOP;
      return { group: g, body: body, arms: arms, plate: plate };
    }

    function minionModel(b) {
      var g = new THREE.Group();
      S.add(S.rbox(1, 1, 0.9, 0.4), b.minion.color, 0, 0.5, 0, g);
      [-0.22, 0.22].forEach(function (x) { S.add(S.ball(0.1), '#3a2a4f', x, 0.6, 0.46, g); });
      return g;
    }

    function chestModel() {
      var g = new THREE.Group();
      S.add(S.rbox(2, 1.2, 1.4, 0.15), '#a0703c', 0, TOP + 0.6, 0, g);
      S.add(S.rbox(2.05, 0.2, 1.45, 0.05), '#ffd54a', 0, TOP + 0.9, 0, g);
      [-0.5, 0, 0.5].forEach(function (x) { S.add(S.ball(0.3), '#ffd54a', x, TOP + 1.25, 0, g); });
      var lid = new THREE.Group();
      lid.position.set(0, TOP + 1.2, -0.7);
      g.add(lid);
      S.add(S.rbox(2, 0.5, 1.4, 0.2), '#b8834a', 0, 0.25, 0.7, lid);
      S.add(S.rbox(0.35, 0.4, 0.1, 0.05), '#ffd54a', 0, 0.2, 1.42, lid);
      return { group: g, lid: lid };
    }

    function setBoss(b) {
      if (b === boss) return;
      if (model) {
        base.remove(model.group);
        model.group.traverse(function (n) {
          [].concat(n.material || []).forEach(function (m) {
            if (!m.map) return;
            m.map.dispose();
            m.dispose();
          });
        });
      }
      boss = b;
      model = b ? bossModel(b) : null;
      if (model) base.add(model.group);
      setMinions(0);
    }

    function setMinions(n) {
      if (minions.length === n && (!n || minions.boss === boss)) return;
      minions.forEach(function (m) { base.remove(m); });
      minions = [];
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2 + Math.PI / 2, m = minionModel(boss);
        m.position.set(Math.cos(a) * RING, TOP, Math.sin(a) * RING);
        m.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
        base.add(m);
        minions.push(m);
      }
      minions.boss = boss;
    }

    function showChest(on, open) {
      chest.group.visible = on;
      chest.group.position.y = 0;
      chest.lid.rotation.x = open ? LID_OPEN : 0;
    }

    // f = snapshot.fort. Ignored while the finale plays (town refreshes after it).
    function apply(f) {
      if (play) return;
      f = f || {};
      var b = B && f.week && f.total > 0 ? B.ofWeek(f.week) : null;
      setBoss(b);
      var won = !!b && f.beaten && !f.finale;
      if (model) {
        model.group.visible = !won;
        model.group.scale.set(1, 1, 1);
        model.group.rotation.z = 0;
      }
      setMinions(b && !f.beaten ? f.minions || 0 : 0);
      showChest(won, true);
    }

    function step(dt, low) {
      play.t += dt;
      var g = model.group, k = play.t;
      if (k < WOBBLE) { g.rotation.z = Math.sin(k * 18) * 0.15; return; }
      if (k < WOBBLE + PUFF) {
        g.rotation.z = 0;
        var s = 1 + (k - WOBBLE) / PUFF * 0.5;
        g.scale.set(s, s, s);
        return;
      }
      if (!play.popped) {
        play.popped = true;
        g.visible = false;
        g.scale.set(1, 1, 1);
        o.built.burst(x0, 3.5, z0, boss.pieces, low ? 12 : 24);
        showChest(true, false);
      }
      var d = Math.min(1, (k - WOBBLE - PUFF) / DROP);
      chest.group.position.y = DROP_FROM * (1 - d * d);
      if (d < 1) return;
      var done = play.done;
      play = null;
      if (done) done();
    }

    function animate(t, dt) {
      var low = !S.detail.visible;
      if (play) { step(dt || 0, low); return; }
      if (model && model.group.visible) {
        model.body.position.y = BODY_Y + Math.abs(Math.sin(t * 1.6)) * 0.25;
        var taunt = Math.sin(t * 0.5) > 0.92;
        model.arms.forEach(function (a, i) { a.position.y = taunt ? BODY_Y + 1.6 : BODY_Y - 0.4 + Math.sin(t * 2 + i) * 0.1; });
      }
      minions.forEach(function (m, i) { m.position.y = TOP + (low ? 0 : Math.max(0, Math.sin(t * 4 + i * 1.7)) * 0.6); });
    }

    // Plays the pop and drops the chest (closed), then calls done. false when there is no boss to pop.
    function finale(done) {
      if (!model || play) return false;
      model.group.visible = true;
      setMinions(0);
      showChest(false, false);
      play = { t: 0, popped: false, done: done };
      return true;
    }

    function openChest() {
      showChest(true, true);
      o.built.sparkle(x0, z0);
    }

    return {
      apply: apply, animate: animate, finale: finale, openChest: openChest,
      boss: function () { return boss; },
      debug: function () {
        return { boss: boss ? boss.id : null, shown: !!(model && model.group.visible), minions: minions.length,
          chest: chest.group.visible ? (chest.lid.rotation.x < 0 ? 'open' : 'closed') : 'none', playing: !!play,
          x: x0, z: z0 };
      }
    };
  }

  W.FortBoss = { create: create };
})(this);
