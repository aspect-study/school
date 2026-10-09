/* The world's characters, each a group facing local +z with animate(t). Mayor Mimi, the cat in a purple coat and top
   hat who guides her; a buddy for each subject door (built from buddies.js looks), Professor Hoot on his park bench,
   Bunny the shopkeeper, and the faces of the talking trees. dance() is a happy hop and spin after a right answer. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var FUR = '#fff4e6', COAT = '#7b5cff', HAT = '#3a2a4f';
  var DANCE = 1.2, INK = '#3a2a4f';

  // A face on a 256px canvas. o = { bg, eye, gap, eyeY, eyeColor, mouth: 'smile'|'beak'|'muzzle'|'none', glasses,
  // patches (panda), noEyes (frog: eyes sit on top of the head), closed (a blink) }
  function faceCanvas(o) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d'), er = o.eye || 22, gap = o.gap || 48, ey = o.eyeY || 116, ink = o.eyeColor || INK;
    if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, 256, 256); }
    [128 - gap, 128 + gap].forEach(function (ex) {
      if (o.patches) { x.fillStyle = '#2b2b2b'; x.beginPath(); x.ellipse(ex, ey + 4, er + 14, er + 18, ex < 128 ? 0.5 : -0.5, 0, 7); x.fill(); }
      if (o.noEyes) return;
      if (o.closed) {
        x.strokeStyle = ink; x.lineWidth = 7; x.lineCap = 'round';
        x.beginPath(); x.arc(ex, ey - er * 0.2, er * 0.8, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
      } else {
        x.fillStyle = ink; x.beginPath(); x.ellipse(ex, ey, er * 0.85, er, 0, 0, 7); x.fill();
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex + er * 0.3, ey - er * 0.4, er * 0.32, 0, 7); x.fill();
      }
      if (o.glasses) { x.strokeStyle = INK; x.lineWidth = 6; x.beginPath(); x.arc(ex, ey, er + 12, 0, 7); x.stroke(); }
    });
    if (o.glasses) { x.beginPath(); x.moveTo(128 - gap + er + 12, ey); x.lineTo(128 + gap - er - 12, ey); x.stroke(); }
    x.fillStyle = 'rgba(255,120,160,.45)';
    x.beginPath(); x.ellipse(128 - gap - 18, ey + 46, 18, 10, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(128 + gap + 18, ey + 46, 18, 10, 0, 0, 7); x.fill();
    var my = ey + 50;
    if (o.mouth === 'beak') {
      x.fillStyle = '#ff9e3d'; x.beginPath(); x.moveTo(110, my - 14); x.lineTo(146, my - 14); x.lineTo(128, my + 12); x.closePath(); x.fill();
    } else if (o.mouth !== 'none') {
      if (o.mouth === 'muzzle') { x.fillStyle = INK; x.beginPath(); x.ellipse(128, my - 12, 12, 8, 0, 0, 7); x.fill(); }
      x.strokeStyle = ink; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.arc(128, my - 4, 16, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    }
    return c;
  }

  // A rounded head with the face on its front.
  function head(S, color, face, w, h, d, r) {
    var THREE = S.THREE, hm = S.toon(color);
    var fm = new THREE.MeshToonMaterial({ map: S.canvasTexture(faceCanvas(Object.assign({ bg: color }, face))), gradientMap: S.ramp });
    var g = new THREE.Group();
    S.add(S.rbox(w, h, d, r), [hm, hm, hm, hm, fm, hm], 0, 0, 0, g);
    return g;
  }

  // Whole-body poses for what the world's characters do (routines.js); d = seconds since the action began.
  var ACTIONS = {
    walk: function (b, top, d) { b.position.y += Math.abs(Math.sin(d * 8)) * 0.18; b.rotation.z = Math.sin(d * 8) * 0.07; },
    sweep: function (b, top, d) { b.rotation.y = Math.sin(d * 4) * 0.35; b.rotation.x = 0.18; },
    read: function (b, top) { top.rotation.x = 0.35; b.rotation.x = 0.06; },
    water: function (b, top, d) { b.rotation.x = 0.3 + Math.sin(d * 6) * 0.05; },
    gaze: function (b, top, d) { top.rotation.x = -0.35; top.rotation.y = Math.sin(d * 0.8) * 0.4; },
    stretch: function (b, top, d) { b.scale.y = 1.08 + Math.sin(d * 3) * 0.04; top.rotation.x = -0.25; },
    hum: function (b, top, d) { b.rotation.z = Math.sin(d * 3) * 0.1; b.position.y += Math.abs(Math.sin(d * 3)) * 0.12; },
    arrange: function (b, top, d) { b.rotation.x = 0.2; b.rotation.y = Math.sin(d * 2.5) * 0.25; },
    serve: function (b, top, d) { b.rotation.x = 0.15 + Math.max(0, Math.sin(d * 2)) * 0.15; top.rotation.y = Math.sin(d * 1.4) * 0.3; },
    sip: function (b, top, d) { top.rotation.x = -0.3 * Math.min(1, d * 2); },
    hammer: function (b, top, d) { b.rotation.x = 0.1 + Math.max(0, Math.sin(d * 6)) * 0.12; },
    nibble: function (b, top, d) { top.rotation.x = 0.4 + Math.sin(d * 12) * 0.12; },
    hop: function (b, top, d) { b.position.y += Math.abs(Math.sin(d * 7)) * 0.7; },
    flap: function (b, top, d) { b.position.y += Math.abs(Math.sin(d * 12)) * 0.25; b.rotation.z = Math.sin(d * 12) * 0.12; },
    hover: function (b, top, d) { b.position.y += Math.sin(d * 5) * 0.12; b.rotation.z = Math.sin(d * 9) * 0.1; },
    wave: function (b, top, d) { b.rotation.z = Math.sin(d * 6) * 0.14; b.position.y += Math.abs(Math.sin(d * 6)) * 0.2; }
  };

  // A gentle idle bob and head tilt; dance() hops and spins once; setAction(name, lift) holds one of ACTIONS (lift raises
  // the body, for a flying Hoot).
  function life(group, body, top, phase) {
    var from = null, pending = false, baseY = body.position.y, act = 'idle', actFrom = 0, lastT = 0, lift = 0;
    function animate(t) {
      lastT = t;
      if (pending) { from = t; pending = false; }
      var d = from === null ? -1 : t - from;
      body.scale.y = 1;
      body.rotation.x = 0;
      body.rotation.z = 0;
      top.rotation.x = 0;
      top.rotation.y = 0;
      if (d >= 0 && d < DANCE) {
        body.position.y = baseY + Math.abs(Math.sin(d * 9)) * 0.7;
        body.rotation.y = d / DANCE * Math.PI * 2;
      } else {
        from = null;
        body.position.y = baseY + Math.abs(Math.sin(t * 2 + phase)) * 0.08;
        body.rotation.y = 0;
        if (ACTIONS[act]) ACTIONS[act](body, top, t - actFrom);
      }
      body.position.y += lift;
      top.rotation.z = Math.sin(t * 1.5 + phase) * 0.06;
    }
    function setAction(name, y) {
      if (name !== act) {
        act = name;
        actFrom = lastT;
      }
      lift = y || 0;
    }
    return { group: group, body: body, animate: animate, dance: function () { pending = true; }, setAction: setAction };
  }

  var FACES = {
    kitten: { mouth: 'muzzle' }, worm: { glasses: true }, frog: { noEyes: true }, carabao: { mouth: 'muzzle', eye: 18 },
    tarsier: { eye: 36, gap: 50, eyeColor: '#5a3a2e' }, panda: { patches: true, mouth: 'muzzle', eye: 16 },
    puppy: { mouth: 'muzzle' }, hedgehog: { mouth: 'muzzle', eye: 18 }, robot: { bg: '#2b2140', eyeColor: '#7ff7ff', eye: 20 },
    bird: { mouth: 'beak' }, bear: { mouth: 'muzzle' }, mouse: { mouth: 'muzzle', eye: 20 }
  };

  // Held in the right hand; the hand is at y -0.75 in the arm group.
  var PROPS = {
    ruler: function (S, g) { S.add(S.rbox(0.28, 1.7, 0.07, 0.03), '#ffd166', 0, -0.5, 0.3, g); },
    book: function (S, g) {
      S.add(S.rbox(0.95, 1.15, 0.28, 0.06), '#6aa9ff', 0, -0.75, 0.35, g);
      S.add(S.rbox(0.85, 1.05, 0.22, 0.04), '#ffffff', 0.08, -0.75, 0.35, g);
    },
    tube: function (S, g) {
      S.add(S.cyl(0.17, 0.17, 1, 12), S.toon('#dff4ff', { transparent: true, opacity: 0.5 }), 0, -0.6, 0.35, g);
      S.add(S.cyl(0.14, 0.14, 0.5, 12), '#7fdc8b', 0, -0.83, 0.35, g);
    },
    pencil: function (S, g) {
      S.add(S.cyl(0.13, 0.13, 1.3, 6), '#ffd166', 0, -0.55, 0.35, g);
      S.add(S.cone(0.13, 0.3, 6), '#f6c9a0', 0, -1.35, 0.35, g).rotation.x = Math.PI;
      S.add(S.ball(0.14), '#ff8fab', 0, 0.12, 0.35, g);
    },
    heart: function (S, g) {
      [-0.17, 0.17].forEach(function (x) { S.add(S.ball(0.26), '#ff6f91', x, -0.6, 0.4, g); });
      S.add(S.cone(0.37, 0.5, 16), '#ff6f91', 0, -0.95, 0.4, g).rotation.x = Math.PI;
    },
    ball: function (S, g) { S.add(S.ball(0.45), '#ff9e6b', 0, -0.9, 0.4, g); S.add(S.ball(0.46), '#ffffff', 0, -0.9, 0.4, g).scale.set(1, 0.18, 1); },
    needle: function (S, g) {
      S.add(S.cyl(0.05, 0.05, 1.4, 6), '#cfd8e6', 0, -0.6, 0.35, g);
      S.add(S.ball(0.18), '#ff8fab', 0, -0.05, 0.35, g);
    },
    note: function (S, g) {
      S.add(S.ball(0.24), '#7b5cff', 0, -1, 0.4, g).scale.set(1.2, 0.9, 1);
      S.add(S.cyl(0.05, 0.05, 0.9, 6), '#7b5cff', 0.22, -0.55, 0.4, g);
      S.add(S.rbox(0.35, 0.15, 0.06, 0.03), '#7b5cff', 0.38, -0.15, 0.4, g);
    },
    block: function (S, g) { S.add(S.rbox(0.75, 0.75, 0.75, 0.15), '#ff7f7f', 0, -0.95, 0.4, g); },
    glass: function (S, g) {
      S.add(S.cyl(0.06, 0.06, 0.7, 6), '#a0785a', 0, -0.9, 0.4, g);
      var ring = S.add(S.cyl(0.4, 0.4, 0.08, 20), '#ffd166', 0, -0.25, 0.4, g);
      ring.rotation.x = Math.PI / 2;
      S.add(S.cyl(0.33, 0.33, 0.1, 20), '#dff4ff', 0, -0.25, 0.4, g).rotation.x = Math.PI / 2;
    },
    mouse: function (S, g) { S.add(S.rbox(0.55, 0.3, 0.85, 0.14), '#e4e9f2', 0, -0.95, 0.45, g); }
  };

  // Ears, horns, spikes, wings and hats. top = the head group, body = the body group.
  function extras(S, look, top, body) {
    var add = S.add, ball = S.ball, fur = look.fur, k = look.kind;
    function pair(fn) { [-1, 1].forEach(fn); }
    if (k === 'kitten') pair(function (s) {
      add(S.cone(0.38, 0.7, 4), fur, s * 0.65, 1.15, 0, top);
      add(S.cone(0.2, 0.4, 4), '#ffb3c7', s * 0.65, 1.1, 0.12, top);
    });
    if (k === 'bear' || k === 'panda') pair(function (s) { add(ball(0.38), k === 'panda' ? '#2b2b2b' : fur, s * 0.8, 1, 0, top); });
    if (k === 'mouse' || k === 'tarsier') pair(function (s) {
      add(S.cyl(0.62, 0.62, 0.16, 20), fur, s * 1.15, 0.75, 0, top).rotation.x = Math.PI / 2;
      add(S.cyl(0.42, 0.42, 0.18, 20), '#ffb3c7', s * 1.15, 0.75, 0.03, top).rotation.x = Math.PI / 2;
    });
    if (k === 'puppy') pair(function (s) { add(S.rbox(0.45, 1, 0.3, 0.2), '#b5835a', s * 1.15, 0.1, 0, top).rotation.z = s * 0.25; });
    if (k === 'carabao') pair(function (s) {
      add(S.cone(0.22, 1.1, 8), '#f2e6d0', s * 1.25, 0.75, 0, top).rotation.z = -s * 1.1;
      add(ball(0.25), fur, s * 1.1, 0.25, 0, top);
    });
    if (k === 'frog') pair(function (s) {
      add(ball(0.42), fur, s * 0.55, 1.05, 0.2, top);
      add(ball(0.26), '#ffffff', s * 0.55, 1.1, 0.5, top);
      add(ball(0.14), INK, s * 0.55, 1.12, 0.7, top);
    });
    if (k === 'worm') pair(function (s) {
      add(S.cyl(0.05, 0.05, 0.8, 6), INK, s * 0.45, 1.3, 0, top);
      add(ball(0.18), '#ffd166', s * 0.45, 1.75, 0, top);
    });
    if (k === 'robot') {
      add(S.cyl(0.05, 0.05, 0.8, 6), INK, 0, 1.3, 0, top);
      add(ball(0.18), '#ff6f91', 0, 1.75, 0, top);
    }
    if (k === 'hedgehog') {
      for (var i = 0; i < 9; i++) {
        var a = (i - 4) * 0.33;
        add(S.cone(0.25, 0.8, 6), look.spikes, Math.sin(a), 0.5 + Math.cos(a) * 0.5, -0.6, top).rotation.set(-0.9, 0, -a);
      }
    }
    if (k === 'bird') {
      pair(function (s) { add(ball(0.5), fur, s * 0.95, 1.15, 0, body).scale.set(0.4, 0.9, 0.8); });
      add(S.cone(0.15, 0.5, 6), '#ff9e3d', 0, 1.1, 0, top);
    }
    if (look.hat === 'salakot') add(S.cone(1.6, 0.7, 16), '#e7b58c', 0, 1.25, 0, top);
    if (look.hat === 'cap') {
      add(S.cyl(0.95, 1, 0.55, 20), '#3a5fcd', 0, 1.1, 0, top);
      add(S.cyl(0.6, 0.6, 0.08, 20), '#2b2140', 0, 0.85, 0.75, top);
      add(ball(0.15), '#ffd166', 0, 1.15, 0.92, top);
    }
  }

  function catFace(S) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = FUR;
    x.fillRect(0, 0, 256, 256);
    [[84, 120], [172, 120]].forEach(function (e) {
      x.fillStyle = '#3a2a4f'; x.beginPath(); x.ellipse(e[0], e[1], 20, 26, 0, 0, 7); x.fill();
      x.fillStyle = '#5fcf9a'; x.beginPath(); x.ellipse(e[0], e[1] + 6, 14, 16, 0, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(e[0] + 7, e[1] - 10, 7, 0, 7); x.fill();
    });
    x.fillStyle = '#ff8fab';
    x.beginPath(); x.moveTo(116, 160); x.lineTo(140, 160); x.lineTo(128, 174); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,120,160,.45)';
    x.beginPath(); x.ellipse(52, 168, 20, 11, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(204, 168, 20, 11, 0, 0, 7); x.fill();
    x.strokeStyle = '#3a2a4f'; x.lineWidth = 4; x.lineCap = 'round';
    [[-1, 0], [-1, 12], [1, 0], [1, 12]].forEach(function (w) {
      x.beginPath(); x.moveTo(128 + w[0] * 30, 168 + w[1] / 2); x.lineTo(128 + w[0] * 86, 160 + w[1]); x.stroke();
    });
    x.beginPath(); x.arc(118, 178, 10, 0.2, Math.PI - 0.6); x.stroke();
    x.beginPath(); x.arc(138, 178, 10, 0.6, Math.PI - 0.2); x.stroke();
    return S.canvasTexture(c);
  }

  function mimi(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, ball = S.ball;
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    var furMat = S.toon(FUR), face = new THREE.MeshToonMaterial({ map: catFace(S), gradientMap: S.ramp });

    add(S.cyl(0.8, 1.1, 1.8, 24), COAT, 0, 1.6, 0, body);
    add(rbox(0.35, 1.9, 0.12, 0.05), '#ffd166', 0.3, 1.7, 0.92, body).rotation.z = 0.5;
    add(ball(0.18), '#ffd166', -0.1, 2.2, 0.95, body);
    [-0.35, 0.35].forEach(function (x) { add(rbox(0.6, 0.35, 0.8, 0.15), FUR, x, 0.2, 0.15, body); });
    add(S.cyl(0.12, 0.08, 1.4, 8), FUR, -0.4, 0.9, -0.85, body).rotation.x = -0.9;

    var head = new THREE.Group();
    head.position.y = 3.4;
    body.add(head);
    add(rbox(2.2, 2, 2, 0.8), [furMat, furMat, furMat, furMat, face, furMat], 0, 0, 0, head);
    [-0.65, 0.65].forEach(function (x) {
      add(S.cone(0.4, 0.7, 4), FUR, x, 1.2, 0, head);
      add(S.cone(0.22, 0.4, 4), '#ffb3c7', x, 1.15, 0.12, head);
    });
    add(S.cyl(1.1, 1.1, 0.12, 20), HAT, 0, 1.1, 0, head);
    add(S.cyl(0.75, 0.75, 0.9, 20), HAT, 0, 1.6, 0, head);
    add(S.cyl(0.77, 0.77, 0.2, 20), '#ff6f91', 0, 1.3, 0, head);

    var arm = new THREE.Group();
    arm.position.set(0.95, 2.3, 0);
    body.add(arm);
    add(rbox(0.45, 1.1, 0.45, 0.2), COAT, 0, 0.5, 0, arm);
    add(ball(0.28), FUR, 0, 1.1, 0, arm);
    var arm2 = new THREE.Group();
    arm2.position.set(-0.95, 2.3, 0);
    body.add(arm2);
    add(rbox(0.45, 1.1, 0.45, 0.2), COAT, 0, -0.5, 0, arm2);
    add(ball(0.28), FUR, 0, -1.1, 0, arm2);

    var waving = false, act = 'idle', actFrom = 0, lastT = 0;
    function animate(t) {
      lastT = t;
      body.rotation.set(0, 0, 0);
      body.scale.y = 1;
      head.rotation.x = 0;
      head.rotation.y = 0;
      arm.rotation.z = waving ? -0.4 + Math.sin(t * 8) * 0.5 : -0.2;
      head.rotation.z = Math.sin(t * 1.4) * 0.05;
      body.position.y = waving ? Math.abs(Math.sin(t * 4)) * 0.2 : 0;
      if (ACTIONS[act]) ACTIONS[act](body, head, t - actFrom);
    }
    return {
      group: group, body: body, animate: animate, wave: function (on) { waving = on; },
      setAction: function (name) {
        if (name !== act) {
          act = name;
          actFrom = lastT;
        }
      }
    };
  }

  // look = { kind, fur, belly, prop, hat, spikes } from buddies.js
  function buddy(S, look) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, k = look.kind, fur = look.fur, belly = look.belly || '#fff4e6';
    var worm = k === 'worm', robot = k === 'robot';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    if (worm) {
      for (var i = 0; i < 3; i++) add(S.ball(0.75 - i * 0.12), i % 2 ? belly : fur, 0, 0.7 - i * 0.05, -0.6 - i * 0.85, body);
    } else {
      add(rbox(1.6, 1.5, 1.3, robot ? 0.2 : 0.55), fur, 0, 1.15, 0, body);
      add(rbox(1, 0.95, 0.2, robot ? 0.1 : 0.35), belly, 0, 1.1, 0.6, body);
      [-0.42, 0.42].forEach(function (x) { add(rbox(0.55, 0.45, 0.7, 0.2), fur, x, 0.22, 0.05, body); });
      add(rbox(0.38, 0.8, 0.38, 0.17), fur, -0.95, 1.3, 0.1, body);
    }
    var top = head(S, fur, FACES[k], 2.1, 1.85, 1.75, robot ? 0.3 : 0.75);
    top.position.y = worm ? 2.05 : 2.85;
    body.add(top);
    extras(S, look, top, body);
    var arm = new THREE.Group();
    if (worm) arm.position.set(0.7, 1.45, 0.35); else arm.position.set(0.95, 1.75, 0.15);
    body.add(arm);
    add(rbox(0.38, 0.8, 0.38, 0.17), fur, 0, -0.35, 0, arm);
    if (look.prop && PROPS[look.prop]) PROPS[look.prop](S, arm);
    return life(group, body, top, fur.charCodeAt(1) % 6);
  }

  // Professor Hoot sits on his own bench; the group stands where the bench is.
  function hoot(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, BROWN = '#a0785a', DARK = '#86624a';
    var group = new THREE.Group(), body = new THREE.Group();
    add(rbox(3.2, 0.3, 1.5, 0.12), '#e7b58c', 0, 1, -0.15, group);
    add(rbox(3.2, 1, 0.25, 0.1), '#e7b58c', 0, 1.7, -0.85, group);
    [-1.3, 1.3].forEach(function (x) { add(rbox(0.25, 0.9, 1, 0.08), '#c98f62', x, 0.45, 0, group); });
    body.position.y = 1.15;
    group.add(body);
    add(S.ball(0.9), BROWN, 0, 0.85, 0, body).scale.set(1, 1.05, 0.9);
    add(S.ball(0.6), '#f1dcc4', 0, 0.8, 0.65, body).scale.set(1, 1.1, 0.5);
    [-1, 1].forEach(function (s) { add(S.ball(0.5), DARK, s * 0.85, 0.85, 0, body).scale.set(0.45, 1, 0.9); });
    var top = head(S, BROWN, { eye: 34, gap: 48, mouth: 'beak', glasses: true }, 2, 1.6, 1.6, 0.7);
    top.position.y = 2.25;
    body.add(top);
    [-1, 1].forEach(function (s) { add(S.cone(0.25, 0.6, 4), DARK, s * 0.75, 1, 0, top).rotation.z = -s * 0.3; });
    add(rbox(1.9, 0.12, 1.9, 0.04), '#2b2140', 0, 1.05, 0, top).rotation.y = Math.PI / 4;
    add(S.cyl(0.55, 0.55, 0.35, 16), '#2b2140', 0, 0.9, 0, top);
    add(S.ball(0.13), '#ffd166', 0.8, 0.85, 0.3, top);
    return life(group, body, top, 1.3);
  }

  function bunny(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, WHITE = '#ffffff';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(rbox(1.5, 1.5, 1.2, 0.55), WHITE, 0, 1.15, 0, body);
    add(rbox(1.1, 1.1, 0.15, 0.1), '#ff8fab', 0, 1, 0.6, body);
    add(S.ball(0.3), WHITE, 0, 0.9, -0.65, body);
    var top = head(S, WHITE, { mouth: 'muzzle', eyeColor: '#7b3a5a' }, 2, 1.8, 1.7, 0.75);
    top.position.y = 2.8;
    body.add(top);
    [-1, 1].forEach(function (s) {
      add(rbox(0.45, 1.7, 0.3, 0.2), WHITE, s * 0.45, 1.65, 0, top).rotation.z = -s * 0.12;
      add(rbox(0.25, 1.3, 0.1, 0.1), '#ffb3c7', s * 0.45, 1.6, 0.13, top).rotation.z = -s * 0.12;
    });
    return life(group, body, top, 2.1);
  }

  // A talking tree's face on the side of its crown that looks at the park's middle; it blinks now and then.
  function treeFace(S, t, center) {
    var THREE = S.THREE;
    if (!S.treeFaces) {
      S.treeFaces = [false, true].map(function (closed) {
        return S.canvasTexture(faceCanvas({ eye: 18, gap: 40, mouth: 'smile', eyeColor: '#3f6b3a', closed: closed }));
      });
    }
    var tex = S.treeFaces, mat = new THREE.MeshBasicMaterial({ map: tex[0], transparent: true, depthWrite: false });
    var size = 1.9 * t.s, mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    var dx = center.x - t.x, dz = center.z - t.z, d = Math.hypot(dx, dz) || 1;
    var ux = dx / d, uz = dz / d, reach = 1.8;
    [[-1.2, 0.3, 1.3], [1.1, -0.2, 1.2]].forEach(function (b) { reach = Math.max(reach, b[0] * ux + b[1] * uz + b[2]); });
    mesh.position.set(t.x + ux * (reach + 0.1) * t.s, 3.5 * t.s, t.z + uz * (reach + 0.1) * t.s);
    mesh.rotation.y = Math.atan2(dx, dz);
    var phase = (t.talk || 0) * 1.7;
    return { mesh: mesh, animate: function (time) { mat.map = (time + phase) % 4 < 0.15 ? tex[1] : tex[0]; } };
  }

  // His face from the agreed mockup: kind closed-eye smile, rosy cheeks, a short beard.
  function jesusFace(S) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#f6d3b0'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#4a2c1a'; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.arc(88, 120, 16, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.beginPath(); x.arc(168, 120, 16, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.fillStyle = 'rgba(255,140,150,.45)';
    x.beginPath(); x.ellipse(60, 150, 20, 11, 0, 0, 7); x.ellipse(196, 150, 20, 11, 0, 0, 7); x.fill();
    x.fillStyle = '#8a5a36';
    x.beginPath(); x.moveTo(30, 175); x.quadraticCurveTo(128, 300, 226, 175); x.lineTo(226, 256); x.lineTo(30, 256); x.closePath(); x.fill();
    x.strokeStyle = '#4a2c1a'; x.lineWidth = 7;
    x.beginPath(); x.arc(128, 150, 16, 0.3, Math.PI - 0.3); x.stroke();
    return S.canvasTexture(c);
  }

  // Jesus in a white robe with a blue sash and a soft halo. sit(on) seats him on the garden bench, walk(on) steps,
  // glow(on) lights the golden ring he comes in on a hard day, hug() opens his arms once.
  function jesus(S) {
    var THREE = S.THREE, add = S.add, rbox = S.rbox, SKIN = '#f6d3b0', HAIR = '#7a4a2a', ROBE = '#fffaf2';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(S.cyl(0.95, 1.5, 2.6, 28), ROBE, 0, 2.6, 0, body);
    add(rbox(0.55, 3.1, 2.75, 0.25), '#6fa8ff', 0, 2.75, 0, body).rotation.z = 0.55;
    add(S.torus(1.05, 0.12, 8, 28), '#e8c46a', 0, 2.2, 0, body).rotation.x = Math.PI / 2;
    var top = new THREE.Group();
    top.position.y = 4.9;
    body.add(top);
    var skin = S.toon(SKIN), face = new THREE.MeshToonMaterial({ map: jesusFace(S), gradientMap: S.ramp });
    add(rbox(2.5, 2.4, 2.3, 0.9), [skin, skin, skin, skin, face, skin], 0, 0, 0, top);
    add(rbox(2.7, 1, 2.5, 0.45), HAIR, 0, 1.05, -0.1, top);
    add(rbox(2.8, 2.6, 0.9, 0.45), HAIR, 0, -0.25, -0.95, top);
    [-1, 1].forEach(function (s) { add(rbox(0.6, 2.2, 1.4, 0.3), HAIR, s * 1.3, -0.35, -0.3, top); });
    var halo = new THREE.Mesh(S.torus(1.15, 0.13, 12, 48), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
    halo.position.set(0, 1.95, -0.2);
    halo.rotation.x = Math.PI / 2.4;
    top.add(halo);
    var shine = new THREE.Mesh(S.circle(2.6, 48), new THREE.MeshBasicMaterial({ color: '#fff3b8', transparent: true, opacity: 0.45, depthWrite: false }));
    shine.position.set(0, 0.2, -1.4);
    top.add(shine);
    function arm(side) {
      var p = new THREE.Group();
      p.position.set(side * 1.05, 3.6, 0.1);
      p.rotation.x = -0.4;
      body.add(p);
      add(rbox(0.65, 1.5, 0.65, 0.3), ROBE, 0, -0.75, 0, p);
      add(S.ball(0.3), SKIN, 0, -1.6, 0, p);
      return p;
    }
    var armL = arm(-1), armR = arm(1);
    var feet = [-0.45, 0.45].map(function (x) { return add(rbox(0.6, 0.3, 0.9, 0.14), '#c98f62', x, 0.15, 0.4, body); });
    var ring = new THREE.Mesh(S.torus(2.4, 0.18, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    ring.visible = false;
    group.add(ring);
    var disk = new THREE.Mesh(S.circle(2.4, 40), new THREE.MeshBasicMaterial({ color: '#fff3b8', transparent: true, opacity: 0.35, depthWrite: false }));
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = 0.15;
    disk.visible = false;
    group.add(disk);

    var hugT = 0, walking = false, sitting = false;
    function animate(t, dt) {
      top.rotation.z = Math.sin(t * 1.2) * 0.05;
      top.position.y = 4.9 + Math.sin(t * 1.6) * 0.05;
      halo.rotation.z = t * 0.6;
      shine.material.opacity = 0.35 + Math.sin(t * 2) * 0.1;
      var open = hugT > 0 ? Math.sin(Math.min(1, (1.2 - hugT) * 3) * Math.PI / 2) : 0;
      hugT = Math.max(0, hugT - (dt || 0));
      armL.rotation.z = -0.5 - open * 0.9;
      armR.rotation.z = 0.5 + open * 0.9;
      var step = walking ? Math.sin(t * 9) : 0;
      feet[0].position.z = sitting ? 1.1 : 0.4 + step * 0.35;
      feet[1].position.z = sitting ? 1.1 : 0.4 - step * 0.35;
      body.position.y = (sitting ? 0.25 : 0) + Math.abs(step) * 0.15;
      if (ring.visible) {
        ring.material.opacity = 0.5 + Math.sin(t * 3) * 0.2;
        ring.rotation.z = t;
      }
    }
    return {
      group: group, animate: animate,
      hug: function () { hugT = 1.2; },
      sit: function (on) { sitting = on; },
      walk: function (on) { walking = on; },
      glow: function (on) { ring.visible = disk.visible = on; }
    };
  }

  // The garden's little lamb: woolly puffs and a dark face; it hops gently.
  function lamb(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, DARK = '#3a3040';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    [[0, 0.9, 0, 0.75], [0.6, 0.95, 0, 0.55], [-0.6, 0.95, 0, 0.55], [0, 1.25, 0.3, 0.55], [0, 1.2, -0.4, 0.5]].forEach(function (p) {
      add(ball(p[3]), '#ffffff', p[0], p[1], p[2], body);
    });
    add(ball(0.45), DARK, 0, 1.3, 0.95, body).scale.set(1, 0.9, 1.1);
    [-0.35, 0.35].forEach(function (x) { add(ball(0.17), DARK, x, 1.5, 0.85, body).scale.set(1.6, 0.6, 0.8); });
    [-0.15, 0.15].forEach(function (x) { add(ball(0.06), '#ffffff', x, 1.4, 1.35, body); });
    [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4]].forEach(function (p) { add(S.cyl(0.12, 0.12, 0.6, 10), DARK, p[0], 0.3, p[1], body); });
    return { group: group, animate: function (t) { body.position.y = Math.abs(Math.sin(t * 3)) * 0.15; } };
  }

  // Lola Lana, the sheep tailor of the boutique: woolly puffs, round glasses and a gold measuring tape round her neck.
  function lana(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, WOOL = '#fffaf2', FACE = '#f3d9c4';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    [[0, 1.1, 0, 0.85], [0.55, 1.25, 0.1, 0.55], [-0.55, 1.25, 0.1, 0.55], [0, 1.5, -0.3, 0.6], [0, 0.6, 0.2, 0.6]].forEach(function (p) {
      add(ball(p[3]), WOOL, p[0], p[1], p[2], body);
    });
    add(S.torus(0.62, 0.08, 8, 24), '#ffd166', 0, 2.05, 0, body).rotation.x = Math.PI / 2;
    add(S.rbox(0.18, 0.9, 0.05, 0.03), '#ffd166', 0.3, 1.6, 0.6, body);
    [-0.35, 0.35].forEach(function (x) { add(S.cyl(0.14, 0.14, 0.6, 10), '#5a4a52', x, 0.3, 0, body); });
    var top = head(S, FACE, { mouth: 'muzzle', glasses: true }, 1.7, 1.6, 1.5, 0.65);
    top.position.y = 2.75;
    body.add(top);
    [[-0.5, 0.75, 0, 0.42], [0.5, 0.75, 0, 0.42], [0, 0.95, -0.2, 0.45]].forEach(function (p) { add(ball(p[3]), WOOL, p[0], p[1], p[2], top); });
    [-1, 1].forEach(function (s) { add(ball(0.28), FACE, s * 0.95, 0.25, 0, top).scale.set(1.4, 0.6, 0.6); });
    return life(group, body, top, 0.7);
  }

  // Mang Kiko, the parrot of the pet stall: green feathers, red and yellow wings, a blue tail and a little straw hat.
  function kiko(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, GREEN = '#5fcf6a';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(ball(0.85), GREEN, 0, 1.2, 0, body).scale.set(1, 1.15, 0.95);
    add(ball(0.55), '#fff2b3', 0, 1.05, 0.55, body).scale.set(1, 1.2, 0.5);
    [-1, 1].forEach(function (s) {
      add(S.rbox(0.25, 1.1, 0.7, 0.12), '#ff5a5f', s * 0.85, 1.3, -0.05, body).rotation.z = s * 0.2;
      add(S.rbox(0.2, 0.4, 0.5, 0.08), '#ffd43b', s * 0.88, 0.75, -0.05, body).rotation.z = s * 0.2;
      add(S.cyl(0.1, 0.1, 0.5, 8), '#ffb347', s * 0.3, 0.25, 0, body);
    });
    add(S.rbox(0.5, 0.9, 0.12, 0.05), '#4cb8e0', 0, 0.8, -0.85, body).rotation.x = 0.5;
    var top = head(S, GREEN, { mouth: 'beak' }, 1.6, 1.5, 1.4, 0.6);
    top.position.y = 2.65;
    body.add(top);
    add(S.cyl(1.0, 1.0, 0.08, 20), '#e8c872', 0, 0.8, 0, top);
    add(S.cyl(0.55, 0.6, 0.45, 20), '#e8c872', 0, 1.05, 0, top);
    add(S.cyl(0.62, 0.62, 0.12, 20), '#ff5a5f', 0, 0.9, 0, top);
    return life(group, body, top, 1.3);
  }

  // Kuya Pilo, the pilandok (Palawan mouse deer) of the toy stall: a small brown deer with big ears and eyes, thin legs
  // and a yellow apron. Pilandok is the clever hero of Filipino folk tales.
  function pilo(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, FUR = '#b5835a', LIGHT = '#f1dcc4', PINK = '#f3c1b0';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(ball(0.75), FUR, 0, 1.45, 0, body).scale.set(0.9, 1.1, 0.85);
    add(ball(0.45), LIGHT, 0, 1.35, 0.45, body).scale.set(1, 1.3, 0.5);
    add(S.rbox(0.75, 0.5, 0.1, 0.05), '#ffd166', 0, 0.95, 0.66, body);
    [-1, 1].forEach(function (s) {
      add(S.cyl(0.09, 0.07, 0.9, 8), FUR, s * 0.3, 0.45, 0, body);
      add(S.cyl(0.08, 0.06, 0.8, 8), FUR, s * 0.62, 1.55, 0.1, body).rotation.z = s * 0.4;
    });
    var top = head(S, FUR, { mouth: 'muzzle', eye: 30, gap: 46 }, 1.5, 1.35, 1.4, 0.6);
    top.position.y = 2.65;
    body.add(top);
    add(ball(0.32), LIGHT, 0, -0.3, 0.75, top).scale.set(1.2, 0.8, 0.8);
    add(ball(0.1), '#4a3428', 0, -0.2, 1.0, top).scale.set(1.3, 0.8, 0.8);
    [-1, 1].forEach(function (s) {
      var ear = add(ball(0.5), FUR, s * 0.8, 0.85, -0.1, top);
      ear.scale.set(0.55, 1.2, 0.3);
      ear.rotation.z = -s * 0.4;
      var inner = add(ball(0.36), PINK, s * 0.8, 0.85, 0.03, top);
      inner.scale.set(0.42, 0.95, 0.2);
      inner.rotation.z = -s * 0.4;
    });
    return life(group, body, top, 2.1);
  }

  // Tito Tasyo, the turtle carpenter of the workshop: a green shell with a darker rim on his back, a cream belly, a
  // little hammer in his right hand and a pencil tucked behind his ear.
  function tasyo(S) {
    var THREE = S.THREE, add = S.add, ball = S.ball, SKIN = '#a8d98a', SHELL = '#7fb069', RIM = '#5a8a4a', BELLY = '#fff1c9';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    add(ball(0.8), SKIN, 0, 1.3, 0, body).scale.set(0.95, 1.05, 0.85);
    add(ball(0.62), BELLY, 0, 1.25, 0.42, body).scale.set(1, 1.2, 0.45);
    [0.9, 1.25, 1.6].forEach(function (y) { add(S.rbox(0.7, 0.05, 0.08, 0.02), '#e8d49a', 0, y, 0.7, body); });
    add(ball(1.0), SHELL, 0, 1.45, -0.45, body).scale.set(1.05, 1.1, 0.62);
    add(S.torus(0.98, 0.12, 8, 28), RIM, 0, 1.45, -0.3, body).scale.set(1.05, 1.1, 1);
    [[0, 1.85], [-0.45, 1.25], [0.45, 1.25], [0, 0.95]].forEach(function (p) {
      add(S.cyl(0.24, 0.24, 0.1, 6), RIM, p[0], p[1], -1.02, body).rotation.x = Math.PI / 2;
    });
    [-1, 1].forEach(function (s) {
      add(S.cyl(0.18, 0.2, 0.55, 10), SKIN, s * 0.4, 0.3, 0.05, body);
      add(ball(0.2), SKIN, s * 0.4, 0.06, 0.18, body).scale.set(1.1, 0.5, 1.3);
    });
    var armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.8, 1.7, 0.1);
    armR.position.set(0.8, 1.7, 0.1);
    armL.rotation.z = -0.5;
    armR.rotation.set(-0.7, 0, 0.35);
    body.add(armL);
    body.add(armR);
    add(S.cyl(0.14, 0.12, 0.8, 8), SKIN, 0, -0.35, 0, armL);
    add(S.cyl(0.14, 0.12, 0.8, 8), SKIN, 0, -0.35, 0, armR);
    add(ball(0.17), SKIN, 0, -0.78, 0, armL);
    add(ball(0.17), SKIN, 0, -0.78, 0, armR);
    var hammer = new THREE.Group();
    hammer.position.set(0, -0.8, 0.05);
    hammer.rotation.x = 1.2;
    armR.add(hammer);
    add(S.cyl(0.06, 0.06, 0.9, 8), '#c98f62', 0, 0.3, 0, hammer);
    add(S.rbox(0.48, 0.2, 0.2, 0.06), '#8d99ae', 0, 0.78, 0, hammer).rotation.z = Math.PI / 2;
    var top = head(S, SKIN, { mouth: 'smile', eye: 20, gap: 44 }, 1.5, 1.3, 1.35, 0.6);
    top.position.y = 2.75;
    body.add(top);
    var pencil = new THREE.Group();
    pencil.position.set(0.72, 0.25, -0.1);
    pencil.rotation.set(0.5, 0, 1.1);
    top.add(pencil);
    add(S.cyl(0.08, 0.08, 0.8, 6), '#ffd166', 0, 0, 0, pencil);
    add(S.cone(0.08, 0.2, 6), '#f6c9a0', 0, -0.5, 0, pencil).rotation.x = Math.PI;
    add(S.cyl(0.085, 0.085, 0.12, 6), '#ff8fab', 0, 0.44, 0, pencil);
    var cap = add(S.cyl(0.62, 0.7, 0.28, 18), '#e8c9a0', 0, 0.68, -0.05, top);
    cap.rotation.x = -0.12;
    add(S.rbox(0.9, 0.08, 0.45, 0.04), '#a0703c', 0, 0.56, 0.55, top);
    var me = life(group, body, top, 2.8);
    var idle = me.animate;
    me.animate = function (t) {
      idle(t);
      armR.rotation.x = -0.7 + Math.max(0, Math.sin(t * 2.4)) * -0.5;
    };
    return me;
  }

  W.Cast = { mimi: mimi, buddy: buddy, hoot: hoot, bunny: bunny, lana: lana, kiko: kiko, pilo: pilo, tasyo: tasyo, treeFace: treeFace, jesus: jesus, lamb: lamb, head: head };
})(this);
