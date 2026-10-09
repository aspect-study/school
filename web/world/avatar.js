/* Her chibi character, built from avatar_v1 parts (body, skin, hair style and colour, eyes, freckles, blush, outfit
   colour) and what she wears (wear.js), with mounts where a small pet rides (petbody.js) and a hand that holds her prop
   (wear.js). Pass a look already filtered by Items.wearable(). The character faces local +z. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SHOE = '#ffffff', SHORTS = '#4a5a8a', BOW = '#ff6f91', KNOT = '#ffd166', HOLD = -0.6, BLEND_OUT = 0.2;
  // Where a pet on her head stands, above the head centre, for each hat (wear.js); bare hair is 1.5.
  var HAT_TOP = { cap: 1.8, sunhat: 2.2, beanie: 2.45, flowercrown: 1.5, bunnyears: 1.5, wizard: 4.1, salakot: 2.7, crown: 1.8 };

  function faceTexture(S, look, skin) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = skin;
    x.fillRect(0, 0, 256, 256);
    W.Wear.paintFace(x, look, skin);
    x.fillStyle = BOW;
    x.beginPath(); x.moveTo(114, 176); x.quadraticCurveTo(128, 200, 142, 176); x.closePath(); x.fill();
    return S.canvasTexture(c);
  }

  function character(S, look) {
    var THREE = S.THREE, L = W.Look, Wr = W.Wear, add = S.add, rbox = S.rbox, ball = S.ball;
    var wear = look.wear || {};
    var skin = L.color(look, 'skin'), cloth = L.color(look, 'outfit'), girl = look.body === 'girl';
    var hair = Wr.hairMaterial(S, wear.dye, L.color(look, 'hairColor'));
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    var head = new THREE.Group();
    head.position.y = 4.1;
    body.add(head);

    var skinMat = Wr.skinMaterial(S, skin, wear.shimmer);
    var face = new THREE.MeshToonMaterial({ map: faceTexture(S, look, skin), gradientMap: S.ramp });
    add(rbox(2.6, 2.4, 2.4, 0.9), [skinMat, skinMat, skinMat, skinMat, face, skinMat], 0, 0, 0, head);
    add(rbox(2.8, 1.1, 2.6, 0.5), hair, 0, 0.95, -0.1, head);
    add(rbox(0.9, 0.7, 0.6, 0.3), hair, -0.75, 0.55, 1.05, head).rotation.z = 0.3;
    if (look.hair !== 'short' && look.hair !== 'curly') add(rbox(2.8, 1.8, 0.9, 0.45), hair, 0, 0.1, -1.0, head);
    if (look.hair === 'pigtails') {
      [-1, 1].forEach(function (s) {
        add(ball(0.6), hair, s * 1.6, -0.3, -0.6, head).scale.set(0.8, 1.3, 0.8);
        add(ball(0.32), KNOT, s * 1.45, 0.25, -0.6, head);
      });
    }
    if (look.hair === 'bob') {
      [-1, 1].forEach(function (s) { add(rbox(0.5, 2, 2.2, 0.25), hair, s * 1.4, -0.2, -0.1, head); });
    }
    if (look.hair === 'braids') {
      [-1, 1].forEach(function (s) {
        for (var k = 0; k < 3; k++) add(ball(0.42 - k * 0.05), hair, s * 1.3, -0.2 - k * 0.62, -0.55, head);
        add(ball(0.2), KNOT, s * 1.3, -1.75, -0.55, head);
      });
    }
    if (look.hair === 'ponytail') {
      add(ball(0.26), KNOT, 0, 0.75, -1.2, head);
      for (var p = 0; p < 3; p++) add(ball(0.55 - p * 0.08), hair, 0, 0.7 - p * 0.6, -1.5 - p * 0.05, head);
    }
    if (look.hair === 'curly') {
      [[0, 1.4, 0], [-0.85, 1.25, 0.35], [0.85, 1.25, 0.35], [-0.85, 1.25, -0.6], [0.85, 1.25, -0.6], [0, 1.3, -0.85],
        [-1.35, 0.3, -0.3], [1.35, 0.3, -0.3], [0, 0.5, -1.3]].forEach(function (c) { add(ball(0.65), hair, c[0], c[1], c[2], head); });
    }
    var a = { body: body, head: head, tint: cloth, girl: girl };
    if (girl && !wear.hat) {
      var bow = new THREE.Group();
      bow.position.set(0.9, 1.45, 0.3);
      bow.rotation.z = -0.3;
      head.add(bow);
      add(ball(0.5), BOW, -0.45, 0, 0, bow).scale.set(1, 0.7, 0.5);
      add(ball(0.5), BOW, 0.45, 0, 0, bow).scale.set(1, 0.7, 0.5);
      add(ball(0.22), KNOT, 0, 0, 0.1, bow);
    }
    var sleeve = Wr.clothes(S, a, wear.clothes);
    if (sleeve === undefined) {
      if (girl) {
        add(S.cyl(0.75, 1.15, 1.9, 24), cloth, 0, 2.05, 0, body);
        add(S.torus(1.05, 0.14, 8, 32), '#ffffff', 0, 1.2, 0, body).rotation.x = Math.PI / 2;
        sleeve = null;
      } else {
        add(S.cyl(0.85, 0.95, 1.5, 24), cloth, 0, 2.3, 0, body);
        add(rbox(1.8, 0.7, 1.4, 0.3), SHORTS, 0, 1.4, 0, body);
        sleeve = cloth;
      }
      add(ball(0.18), '#ffffff', 0, 2.5, 0.85, body);
    }
    Wr.extras(S, a, wear);

    function limb(color, x, y, len, r) {
      var p = new THREE.Group();
      p.position.set(x, y, 0);
      body.add(p);
      add(rbox(r * 2, len, r * 2, r * 0.95), color, 0, -len / 2, 0, p);
      return p;
    }
    var armL = limb(sleeve || skinMat, -0.95, 2.75, 1.2, 0.27), armR = limb(sleeve || skinMat, 0.95, 2.75, 1.2, 0.27);
    var legL = limb(skinMat, -0.38, 1.15, 1.05, 0.3), legR = limb(skinMat, 0.38, 1.15, 1.05, 0.3);
    [legL, legR].forEach(function (l) { add(rbox(0.7, 0.4, 0.85, 0.18), SHOE, 0, -1.05, 0.1, l); });
    var shine = Wr.sparkles(S, a, wear);
    var mounts = { shoulder: new THREE.Group(), head: new THREE.Group(), arms: new THREE.Group(), hand: new THREE.Group() };
    mounts.shoulder.position.set(1.5, 2.6, 0.3);
    body.add(mounts.shoulder);
    mounts.head.position.set(0, HAT_TOP[wear.hat] || 1.5, 0);
    head.add(mounts.head);
    // One-arm carry: a pet in her arms sits in her left arm, so her right hand is free for a prop.
    mounts.arms.position.set(-0.55, 1.9, 1.15);
    body.add(mounts.arms);
    // Her grip, at the end of her right arm. HOLD is the arm's angle while she holds a prop; animate() turns the hand back
    // by the arm's angle (ZYX undoes the arm's XYZ) so the prop stands upright however her arm moves (wear.js builds
    // props with +y up).
    mounts.hand.position.set(0, -1.2, 0.12);
    mounts.hand.rotation.order = 'ZYX';
    armR.add(mounts.hand);
    var held = Wr.prop(S, mounts.hand, wear.prop);
    var carry = look.petSpot === 'arms';

    var blob = new THREE.Mesh(S.circle(1.2, 24), S.shadowBlob);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.13;
    group.add(blob);

    // holding: a pet sits in her left arm, so a move leaves that arm in the carry pose.
    function addOffsets(o, f, holding) {
      if (!holding) { armL.rotation.x += o.aLx * f; armL.rotation.z += o.aLz * f; }
      armR.rotation.x += o.aRx * f; armR.rotation.z += o.aRz * f;
      legL.rotation.x += o.lLx * f; legR.rotation.x += o.lRx * f;
      body.position.x += o.bx * f;
      body.position.y += o.by * f;
      body.rotation.x += o.brx * f; body.rotation.y += o.bry * f; body.rotation.z += o.brz * f;
      head.rotation.x += o.hrx * f; head.rotation.y += o.hry * f; head.rotation.z += o.hrz * f;
    }

    // A move cut off part-way (she walks) fades out over BLEND_OUT seconds instead of snapping back in one frame. A move
    // that finished needs no fade: Spin ends a full turn round, which a fade would unwind backwards.
    var lastMove = null, fade = 0, lastT = null;

    // pose (optional): { sit } on a ride, { cheer } both arms up, { wave } her sister by the gate, { ride } on a playground
    // ride (her prop is put away), { move, k } a move from moves.js at moment k.
    function animate(t, walkT, mag, pose) {
      var m = Math.min(1, mag), sw = Math.sin(walkT) * 0.7 * m, hop = Math.abs(Math.sin(walkT));
      var dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
      lastT = t;
      body.position.x = 0;
      body.rotation.set(0, 0, 0);
      head.rotation.x = head.rotation.y = 0;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw; armR.rotation.x = held ? HOLD + sw * 0.3 : sw;
      armL.rotation.z = -0.25; armR.rotation.z = 0.25;
      body.position.y = hop * 0.25 * Math.min(1, m * 2);
      body.scale.set(1 + (1 - hop) * 0.04 * m, 1 - (1 - hop) * 0.05 * m, 1);
      if (pose && pose.sit) {
        legL.rotation.x = legR.rotation.x = -1.45;
        armL.rotation.x = armR.rotation.x = -0.6;
      }
      if (pose && pose.cheer) {
        armL.rotation.z = -2.6 + Math.sin(t * 9) * 0.2;
        armR.rotation.z = 2.6 - Math.sin(t * 9) * 0.2;
      }
      var holding = carry && mounts.arms.children.length > 0;
      if (holding && !(pose && pose.cheer)) {
        armL.rotation.x = -1.1;
        armL.rotation.z = 0.55;
      }
      if (pose && pose.wave) {
        armR.rotation.x = 0;
        armR.rotation.z = 2.4 + Math.sin(t * 8) * 0.4;
      }
      head.rotation.z = Math.sin(t * 1.6) * 0.05;
      head.position.y = 4.1 + Math.sin(t * 2.2) * 0.05;
      if (pose && pose.move) {
        lastMove = W.Moves.pose(pose.move, pose.k);
        fade = pose.k < 1 ? 1 : 0;
        addOffsets(lastMove, 1, holding);
      } else if (fade > 0) {
        fade = Math.max(0, fade - dt / BLEND_OUT);
        addOffsets(lastMove, fade, holding);
      }
      mounts.hand.visible = !(pose && pose.ride);
      mounts.hand.rotation.set(-armR.rotation.x, 0, -armR.rotation.z);
      if (held) held.animate(t, pose && pose.move === 'use-' + wear.prop ? pose.k : null);
      shine.animate(t);
    }

    function dispose() {
      face.map.dispose();
      face.dispose();
      shine.dispose();
      if (held) held.dispose();
    }

    return { group: group, animate: animate, dispose: dispose, mounts: mounts, prop: held ? wear.prop : '' };
  }

  W.Avatar = { character: character, SCALE: 0.8 };
})(this);
