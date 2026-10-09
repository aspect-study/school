/* The 3D stage: renderer, sky, lights, toon materials and shared shapes. Everything the world draws goes through these
   helpers, so each shape and material is made once and reused. Needs THREE (r149) and THREE.RoundedBoxGeometry. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  function create(host, quality) {
    var THREE = root.THREE, doc = root.document;
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.background = gradient(['#9fd8ff', '#d6ecff', '#ffe3f1']);
    scene.fog = new THREE.Fog('#ffe9f4', 80, 190);
    var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight('#fff6fb', '#b8f0c0', 1.6));
    var sun = new THREE.DirectionalLight('#fff4e0', 1.9);
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.far = 160;
    scene.add(sun);
    scene.add(sun.target);
    // Flowers, clouds and other extras: hidden on low quality.
    var detail = new THREE.Group();
    scene.add(detail);

    var ramp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    var mats = {}, geos = {};

    function canvasTexture(c) {
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      return t;
    }

    function gradient(stops) {
      var c = doc.createElement('canvas');
      c.width = 2; c.height = 256;
      var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
      stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
      x.fillStyle = g;
      x.fillRect(0, 0, 2, 256);
      return canvasTexture(c);
    }

    // own: a material of its own (not shared), for things that change colour, like a door mat.
    function toon(color, opts, own) {
      var key = color + JSON.stringify(opts || {});
      if (!own && mats[key]) return mats[key];
      var m = new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: ramp }, opts || {}));
      if (!own) mats[key] = m;
      return m;
    }

    function cached(key, make) { return geos[key] || (geos[key] = make()); }
    function rbox(w, h, d, r) { return cached('b' + [w, h, d, r], function () { return new THREE.RoundedBoxGeometry(w, h, d, 4, r); }); }
    function ball(r) { return cached('s' + r, function () { return new THREE.SphereGeometry(r, 20, 14); }); }
    function cyl(rt, rb, h, seg) { return cached('c' + [rt, rb, h, seg], function () { return new THREE.CylinderGeometry(rt, rb, h, seg); }); }
    function torus(r, tube, rs, ts) { return cached('t' + [r, tube, rs, ts], function () { return new THREE.TorusGeometry(r, tube, rs, ts); }); }
    function circle(r, seg) { return cached('o' + [r, seg], function () { return new THREE.CircleGeometry(r, seg); }); }
    var shadowBlob = new THREE.MeshBasicMaterial({ color: '#7a3e8e', transparent: true, opacity: 0.15, depthWrite: false });
    function cone(r, h, seg) { return cached('k' + [r, h, seg], function () { return new THREE.ConeGeometry(r, h, seg); }); }

    function add(geo, mat, x, y, z, parent) {
      var o = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat);
      o.position.set(x || 0, y || 0, z || 0);
      o.castShadow = true;
      o.receiveShadow = true;
      (parent || scene).add(o);
      return o;
    }

    function pill(x, l, t, w, h) {
      var r = h / 2;
      x.beginPath();
      x.moveTo(l + r, t);
      x.arcTo(l + w, t, l + w, t + h, r);
      x.arcTo(l + w, t + h, l, t + h, r);
      x.arcTo(l, t + h, l, t, r);
      x.arcTo(l, t, l + w, t, r);
      x.fill();
    }

    // A small white pill with dark text for markers ("⚔️", "❗", "🔁3", "⚔️ 1/4"); one texture per text.
    var badges = {};
    function badge(text) {
      if (badges[text]) return badges[text];
      var c = doc.createElement('canvas');
      c.width = 256; c.height = 128;
      var x = c.getContext('2d');
      x.fillStyle = 'rgba(0,0,0,.15)'; pill(x, 10, 14, 236, 108);
      x.fillStyle = '#ffffff'; pill(x, 6, 6, 236, 108);
      var size = 70;
      do { x.font = '800 ' + size + 'px "Baloo 2", sans-serif'; size -= 4; } while (x.measureText(text).width > 210 && size > 24);
      x.fillStyle = '#6a2c70';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, 124, 64);
      return (badges[text] = canvasTexture(c));
    }

    // A white pill with a coloured centre and the text in white, English only; long text shrinks until it fits.
    function label(text, bg) {
      text = W.Text.english(text);
      var c = doc.createElement('canvas');
      c.width = 512; c.height = 180;
      var x = c.getContext('2d');
      x.fillStyle = 'rgba(0,0,0,.12)'; pill(x, 14, 22, 484, 148);
      x.fillStyle = '#ffffff'; pill(x, 8, 8, 496, 152);
      x.fillStyle = bg; pill(x, 20, 20, 472, 128);
      // iPad Safari mis-measures emoji built from several code points (🇵🇭, 🛍️) on a canvas, so the leading emoji gets
      // its own fixed-width box and only the words are measured.
      var lead = /^[^\p{L}\p{N}]*/u.exec(text)[0], icon = lead.trim(), words = text.slice(lead.length);
      var size = 74, iconW, gap, total;
      do {
        size -= 4;
        x.font = '800 ' + size + 'px "Baloo 2", sans-serif';
        iconW = icon ? size * 1.3 : 0;
        gap = icon && words ? size * 0.2 : 0;
        total = iconW + gap + x.measureText(words).width;
      } while (total > 420 && size > 8);
      var left = 256 - total / 2;
      x.fillStyle = '#ffffff';
      x.textBaseline = 'middle';
      x.textAlign = 'left';
      x.fillText(words, left + iconW + gap, 90);
      if (icon) {
        x.font = Math.round(size * 0.9) + 'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        x.textAlign = 'center';
        x.fillText(icon, left + iconW / 2, 92);
      }
      return canvasTexture(c);
    }

    function emoji(e) {
      var c = doc.createElement('canvas');
      c.width = c.height = 128;
      var x = c.getContext('2d');
      x.font = '96px serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(e, 64, 72);
      return canvasTexture(c);
    }

    function sprite(tex, w, h) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.set(w, h, 1);
      return s;
    }

    function resize() {
      var w = root.innerWidth, h = root.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function setQuality(q) {
      var high = q !== 'low';
      renderer.setPixelRatio(high ? Math.min(root.devicePixelRatio || 1, 2) : 1);
      renderer.shadowMap.enabled = high;
      sun.castShadow = high;
      detail.visible = high;
      scene.traverse(function (o) {
        if (o.material) [].concat(o.material).forEach(function (m) { m.needsUpdate = true; });
      });
      resize();
    }

    function follow(x, z) {
      sun.position.set(x + 25, 45, z + 25);
      sun.target.position.set(x, 0, z);
    }

    // After the browser gives the 3D graphics back, canvas pictures must be uploaded again.
    function refreshTextures() {
      scene.traverse(function (o) {
        if (o.material) [].concat(o.material).forEach(function (m) { if (m.map) m.map.needsUpdate = true; });
      });
      if (scene.background) scene.background.needsUpdate = true;
      ramp.needsUpdate = true;
    }

    root.addEventListener('resize', resize);
    setQuality(quality);

    return {
      THREE: THREE, renderer: renderer, scene: scene, camera: camera, sun: sun, detail: detail, ramp: ramp,
      toon: toon, add: add, rbox: rbox, ball: ball, cyl: cyl, cone: cone, torus: torus, circle: circle, shadowBlob: shadowBlob, label: label, badge: badge, emoji: emoji, sprite: sprite,
      canvasTexture: canvasTexture, setQuality: setQuality, resize: resize, follow: follow, refreshTextures: refreshTextures,
      render: function () { renderer.render(scene, camera); }
    };
  }

  W.Scene = { create: create };
})(this);
