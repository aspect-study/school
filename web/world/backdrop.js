/* The start page backdrop: a random town (Campus or Bayan) with the playground kids walking its paths and pets trotting
   after them, seen by a slow camera that circles one kid at a time. Purely visual: it reads and writes no saved data.
   Tells the page that shows it (web/index.html) when it is drawing (backdrop-ready) or cannot (backdrop-failed), and
   window.__backdrop is for the e2e driver. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var doc = root.document, C = W.BackdropCore;
  var FRAME = 1 / 30, STILL_SECONDS = 6, FOCUS_EVERY = 25, FAR = 1e4;
  var debug = root.__backdrop = { state: 'start', frames: 0, grade: '' };

  function tell(message) {
    debug.state = message === 'backdrop-ready' ? 'ready' : 'failed';
    try { root.parent.postMessage(message, '*'); } catch (e) {}
  }

  function webgl() {
    if (!root.THREE || !root.THREE.RoundedBoxGeometry) return false;
    try {
      var c = doc.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  function reduced() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function start() {
    var kind = C.mode({ webgl: webgl(), reduced: reduced() });
    if (kind === 'off') return tell('backdrop-failed');

    var L = W.Layout, grade = C.pickGrade(Math.random), T = W.Text.localized(grade, false);
    debug.grade = grade;
    var S = W.Scene.create(doc.getElementById('stage'), 'low');
    var world = W.Build.build(S, grade, T);
    var obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds, ends = {};
    L.rideSpots(grade).forEach(function (s) { ends[s.id] = s.end; });

    var list = W.Mates.all(Math.random);
    var mind = W.MateMind.create({
      pr: L.props(grade), ends: ends, boards: L.rideSpots(grade), area: L.places(grade).playground, rand: Math.random,
      kids: list.map(function (m) { return { id: m.id, fav: m.fav, racer: m.id === 'tomas' }; }), ways: L.walkways(grade),
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r); }
    });
    var kids = list.map(function (m) {
      var ch = W.Avatar.character(S, W.Pets.wearable(W.Items.wearable(m.look, null), null));
      ch.group.scale.setScalar(0.92 * W.Avatar.SCALE);
      S.scene.add(ch.group);
      return ch;
    });
    var pets = C.PET_IDS.map(function (id, i) {
      var body = W.PetBody.build(S, W.Pets.wearable({ pet: id, petColor: i }, null));
      S.scene.add(body.group);
      return { body: body, state: { x: 0, z: 0, face: 0 }, owner: i, placed: false };
    });

    var frames = [], t = 0, focus = { x: 0, z: 0 }, focusIdx = 0, focusT = 0, placed = false;
    var watch = C.slowWatch(), clock = 0;

    function step(dt) {
      t += dt;
      mind.tick(dt, { x: FAR, z: FAR, now: null });
      frames = mind.frames();
      var parts = mind.parts();
      Object.keys(parts).forEach(function (p) { world.ride(p, parts[p]); });
      frames.forEach(function (f, n) {
        var g = kids[n].group;
        g.visible = !f.hidden;
        g.position.set(f.x, f.y, f.z);
        g.rotation.y = f.face;
        kids[n].animate(t, f.walkT, f.mag, f.ride ? { ride: true, sit: f.sit, cheer: f.cheer } : { wave: f.wave, cheer: f.cheer });
      });
      pets.forEach(function (p, i) {
        var owner = frames[p.owner], spot = C.petSpot(owner, i);
        if (!p.placed) {
          p.state.x = spot.x;
          p.state.z = spot.z;
          p.placed = true;
        }
        var r = C.stepPet(p.state, spot, dt);
        p.body.group.position.set(p.state.x, 0, p.state.z);
        p.body.group.rotation.y = p.state.face;
        p.body.animate(t, r.moving ? 'walk' : 'idle');
      });
      world.animate(t, dt, null);
    }

    function aim(dt) {
      focusT += dt;
      if (focusT >= FOCUS_EVERY) {
        focusT = 0;
        focusIdx = (focusIdx + 1) % frames.length;
      }
      var k = frames[focusIdx];
      focus.x = placed ? C.ease(focus.x, k.x, dt, 1.5) : k.x;
      focus.z = placed ? C.ease(focus.z, k.z, dt, 1.5) : k.z;
      placed = true;
      var v = C.viewOf(focus, t);
      S.camera.position.set(v.x, v.y, v.z);
      S.camera.lookAt(focus.x, v.lookY, focus.z);
      S.follow(focus.x, focus.z);
    }

    function draw(dt) {
      aim(dt);
      S.render();
      debug.frames++;
    }

    var canvas = S.renderer.domElement, stopped = false;
    function giveUp() {
      stopped = true;
      tell('backdrop-failed');
    }
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      giveUp();
    });

    for (var i = 0; i < 20; i++) step(0.1);
    if (kind === 'still') {
      for (i = 0; i < STILL_SECONDS * 10; i++) step(0.1);
      draw(0.1);
      // A resize clears the canvas (Scene's own listener runs first), and nothing else would draw it again.
      root.addEventListener('resize', function () { if (!stopped) S.render(); });
      return tell('backdrop-ready');
    }

    var last = null, acc = 0, told = false;
    function frame(now) {
      if (stopped) return;
      root.requestAnimationFrame(frame);
      if (last === null) last = now;
      acc += Math.min(0.1, (now - last) / 1000);
      var real = (now - last) / 1000;
      last = now;
      if (acc < FRAME) return;
      var dt = acc;
      acc = 0;
      step(dt);
      draw(dt);
      if (!told) {
        told = true;
        tell('backdrop-ready');
      }
      clock += real;
      if (watch.push(Math.min(real, 1)) && clock > 0) giveUp();
    }
    root.requestAnimationFrame(frame);
  }

  try {
    start();
  } catch (e) {
    tell('backdrop-failed');
  }
})(this);
