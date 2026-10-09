/* What she wears, built from the same shapes as the rest of her: one builder per wardrobe item (items.js), the eyes
   and face extras painted onto her face picture, special hair materials, body shimmer and sparkles. avatar.js calls it.
   a = { body, head, tint, girl }: her body group and head group (the head centre sits 4.1 up the body); the
   character faces +z. A clothes builder draws her top half and returns her sleeve colour (null: bare arms). */
(function (root) {
  'use strict';
  var WHITE = '#ffffff', GOLD = '#ffd166', INK = '#3a2a4f', NAVY = '#2f3e75', DENIM = '#4a6fa5', SHORTS = '#4a5a8a';

  function pair(fn) { [-1, 1].forEach(fn); }
  function shorts(S, a, color) { S.add(S.rbox(1.8, 0.7, 1.4, 0.3), color, 0, 1.4, 0, a.body); }

  var CLOTHES = {
    hoodie: function (S, a) {
      S.add(S.cyl(0.88, 0.98, 1.6, 24), a.tint, 0, 2.3, 0, a.body);
      shorts(S, a, SHORTS);
      S.add(S.rbox(1.7, 0.9, 0.6, 0.28), a.tint, 0, 3.1, -0.75, a.body);
      S.add(S.rbox(1, 0.45, 0.12, 0.15), WHITE, 0, 2.0, 0.93, a.body);
      return a.tint;
    },
    overalls: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.5, 24), WHITE, 0, 2.3, 0, a.body);
      S.add(S.rbox(1.1, 1, 0.2, 0.1), DENIM, 0, 2.2, 0.85, a.body);
      pair(function (s) { S.add(S.rbox(0.18, 1.1, 0.12, 0.05), DENIM, s * 0.45, 2.75, 0.8, a.body); });
      shorts(S, a, DENIM);
      return null;
    },
    raincoat: function (S, a) {
      S.add(S.cyl(0.8, 1.2, 2.1, 24), '#ffd43b', 0, 2.05, 0, a.body);
      [2.6, 2.1, 1.6].forEach(function (y) { S.add(S.ball(0.12), '#ff8c1a', 0, y, 0.95, a.body); });
      return '#ffd43b';
    },
    jersey: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.5, 24), a.tint, 0, 2.3, 0, a.body);
      S.add(S.cyl(0.4, 0.4, 0.06, 20), WHITE, 0, 2.4, 0.9, a.body).rotation.x = Math.PI / 2;
      S.add(S.rbox(0.12, 0.45, 0.05, 0.03), INK, 0, 2.4, 0.95, a.body);
      shorts(S, a, a.tint);
      return null;
    },
    uniform: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.2, 24), WHITE, 0, 2.45, 0, a.body);
      if (a.girl) S.add(S.cyl(0.95, 1.2, 0.9, 24), NAVY, 0, 1.55, 0, a.body);
      else shorts(S, a, NAVY);
      S.add(S.cone(0.25, 0.6, 4), NAVY, 0, 2.6, 0.92, a.body).rotation.x = Math.PI;
      return WHITE;
    },
    princess: function (S, a) {
      S.add(S.cyl(0.7, 1.5, 2.0, 32), a.tint, 0, 2.0, 0, a.body);
      S.add(S.torus(0.78, 0.1, 8, 32), GOLD, 0, 2.55, 0, a.body).rotation.x = Math.PI / 2;
      pair(function (s) { S.add(S.ball(0.42), a.tint, s * 0.95, 2.85, 0, a.body); });
      S.add(S.ball(0.16), GOLD, 0, 2.75, 0.75, a.body);
      return null;
    },
    hero: function (S, a) {
      S.add(S.cyl(0.85, 0.95, 1.5, 24), '#4361ee', 0, 2.3, 0, a.body);
      shorts(S, a, '#4361ee');
      S.add(S.rbox(2.1, 2.4, 0.1, 0.08), '#ef233c', 0, 2.0, -1.0, a.body).rotation.x = 0.12;
      S.add(S.cone(0.32, 0.12, 5), GOLD, 0, 2.6, 0.92, a.body).rotation.x = Math.PI / 2;
      return '#4361ee';
    },
    filipiniana: function (S, a) {
      if (a.girl) {
        S.add(S.cyl(0.75, 1.3, 2.0, 32), '#fff4d6', 0, 2.0, 0, a.body);
        pair(function (s) { S.add(S.ball(0.6), '#fffbe9', s * 1.0, 3.0, 0, a.body).scale.set(0.9, 0.55, 0.9); });
        return null;
      }
      S.add(S.cyl(0.85, 0.95, 1.6, 24), '#fffbe6', 0, 2.3, 0, a.body);
      [-0.3, 0, 0.3].forEach(function (x) { S.add(S.rbox(0.06, 1.1, 0.04, 0.02), '#e0c48a', x, 2.4, 0.92, a.body); });
      shorts(S, a, INK);
      return '#fffbe6';
    }
  };

  var HATS = {
    cap: function (S, a) {
      S.add(S.cyl(1.35, 1.42, 0.7, 24), '#ff6f91', 0, 1.45, 0, a.head);
      S.add(S.rbox(1.6, 0.12, 1.2, 0.05), '#ff6f91', 0, 1.15, 1.3, a.head);
    },
    sunhat: function (S, a) {
      S.add(S.cyl(2.2, 2.2, 0.12, 32), '#ffe8a3', 0, 1.3, 0, a.head);
      S.add(S.cyl(1.2, 1.35, 0.9, 24), '#ffe8a3', 0, 1.75, 0, a.head);
      S.add(S.torus(1.3, 0.1, 8, 32), '#ff8fab', 0, 1.45, 0, a.head).rotation.x = Math.PI / 2;
    },
    beanie: function (S, a) {
      S.add(S.ball(1.45), a.tint, 0, 1.15, 0, a.head).scale.set(1, 0.7, 1);
      S.add(S.ball(0.35), WHITE, 0, 2.2, 0, a.head);
    },
    flowercrown: function (S, a) {
      S.add(S.torus(1.35, 0.08, 8, 32), '#5fcf9a', 0, 1.35, 0, a.head).rotation.x = Math.PI / 2;
      for (var k = 0; k < 8; k++) {
        var ang = k * Math.PI / 4;
        S.add(S.ball(0.25), k % 2 ? '#ff8fc8' : '#ffe066', Math.sin(ang) * 1.35, 1.4, Math.cos(ang) * 1.35, a.head);
      }
    },
    bunnyears: function (S, a) {
      S.add(S.torus(1.35, 0.08, 8, 32), '#ff8fab', 0, 1.4, 0, a.head).rotation.x = Math.PI / 2 + 0.4;
      pair(function (s) {
        S.add(S.rbox(0.45, 1.7, 0.3, 0.2), WHITE, s * 0.55, 2.4, 0, a.head).rotation.z = -s * 0.15;
        S.add(S.rbox(0.25, 1.3, 0.1, 0.1), '#ffb3c7', s * 0.55, 2.35, 0.13, a.head).rotation.z = -s * 0.15;
      });
    },
    wizard: function (S, a) {
      S.add(S.cyl(2, 2, 0.12, 32), '#7b5cff', 0, 1.35, 0, a.head);
      S.add(S.cone(1.3, 2.6, 24), '#7b5cff', 0, 2.65, 0, a.head);
      S.add(S.ball(0.22), GOLD, 0, 3.95, 0, a.head);
    },
    salakot: function (S, a) {
      S.add(S.cone(2.4, 1.1, 24), '#d9a066', 0, 1.95, 0, a.head);
      S.add(S.cyl(0.2, 0.25, 0.3, 12), '#b5835a', 0, 2.55, 0, a.head);
    },
    crown: function (S, a) {
      S.add(S.cyl(1.05, 1.1, 0.5, 24), GOLD, 0, 1.55, 0, a.head);
      for (var k = 0; k < 5; k++) {
        var ang = k * Math.PI * 2 / 5;
        S.add(S.cone(0.25, 0.55, 4), GOLD, Math.sin(ang) * 0.95, 2.05, Math.cos(ang) * 0.95, a.head);
      }
      S.add(S.ball(0.16), '#ff6f91', 0, 1.6, 1.08, a.head);
    }
  };

  var GLASSES = {
    roundglasses: function (S, a) {
      pair(function (s) { S.add(S.torus(0.4, 0.07, 8, 24), INK, s * 0.62, 0.05, 1.26, a.head); });
      S.add(S.rbox(0.45, 0.08, 0.08, 0.03), INK, 0, 0.1, 1.26, a.head);
    },
    starglasses: function (S, a) {
      pair(function (s) { S.add(S.cone(0.5, 0.1, 5), '#ff6f91', s * 0.62, 0.05, 1.28, a.head).rotation.x = Math.PI / 2; });
      S.add(S.rbox(0.45, 0.08, 0.08, 0.03), '#ff6f91', 0, 0.1, 1.28, a.head);
    }
  };

  // Big enough to show beside her head from behind and peek out from the front. spot: a small dot on each upper wing.
  function wings(S, a, colors, opts, spot) {
    pair(function (s) {
      var up = S.add(S.ball(1.2), S.toon(colors[0], opts), s * 1.35, 3.6, -1.35, a.body);
      up.scale.set(0.9, 1.15, 0.12);
      up.rotation.z = s * 0.45;
      var low = S.add(S.ball(0.8), S.toon(colors[1], opts), s * 1.1, 2.4, -1.25, a.body);
      low.scale.set(0.9, 1, 0.12);
      low.rotation.z = -s * 0.3;
      if (spot) S.add(S.ball(0.22), spot, s * 1.6, 3.9, -1.45, a.body).scale.set(1, 1, 0.3);
    });
  }
  var BACK = {
    backpack: function (S, a) {
      S.add(S.rbox(1.4, 1.5, 0.7, 0.3), '#5fcf9a', 0, 2.4, -1.05, a.body);
      S.add(S.rbox(1, 0.6, 0.2, 0.15), '#ffd166', 0, 2.1, -1.45, a.body);
    },
    angelwings: function (S, a) { wings(S, a, [WHITE, '#f3f6ff']); },
    butterflywings: function (S, a) { wings(S, a, ['#ff9e3d', '#ffd166'], null, '#2b2140'); },
    fairywings: function (S, a) { wings(S, a, ['#9fd8ff', '#d7b8ff'], { transparent: true, opacity: 0.85, emissive: '#9fd8ff', emissiveIntensity: 0.4 }); }
  };

  var NECK = {
    scarf: function (S, a) {
      S.add(S.torus(0.9, 0.3, 10, 28), a.tint, 0, 2.85, 0, a.body).rotation.x = Math.PI / 2;
      S.add(S.rbox(0.42, 1.3, 0.22, 0.1), a.tint, 0.45, 2.2, 1.0, a.body).rotation.z = 0.12;
    },
    bowtie: function (S, a) {
      pair(function (s) { S.add(S.cone(0.25, 0.45, 12), '#ef233c', s * 0.25, 3.0, 0.88, a.body).rotation.z = s * Math.PI / 2; });
      S.add(S.ball(0.12), '#ef233c', 0, 3.0, 0.92, a.body);
    }
  };

  function extras(S, a, wear) {
    [['hat', HATS], ['glasses', GLASSES], ['back', BACK], ['neck', NECK]].forEach(function (p) {
      var f = p[1][wear[p[0]]];
      if (f) f(S, a);
    });
  }
  // undefined: no clothes item, so avatar.js draws her own outfit.
  function clothes(S, a, id) { return CLOTHES[id] ? CLOTHES[id](S, a) : undefined; }

  // ---- the face, on a 256px canvas: eyes at (86,132) and (170,132), cheeks at (52,178) and (204,178) ----
  var EYE = '#3a2a4f';
  function star(x, cx, cy, r, points, inner) {
    x.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var ang = i * Math.PI / points - Math.PI / 2, rr = i % 2 ? r * inner : r;
      x.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    }
    x.closePath();
    x.fill();
  }
  function heart(x, cx, cy, r) {
    x.beginPath();
    x.arc(cx - r / 2, cy, r / 2, Math.PI, 0);
    x.arc(cx + r / 2, cy, r / 2, Math.PI, 0);
    x.lineTo(cx, cy + r * 1.1);
    x.closePath();
    x.fill();
  }

  function eye(x, kind, ex, ey, skin) {
    if (kind === 'smiley') {
      x.strokeStyle = EYE; x.lineWidth = 9; x.lineCap = 'round';
      x.beginPath(); x.arc(ex, ey + 8, 18, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke();
      return;
    }
    var big = kind === 'sparkly' ? 1.18 : 1;
    x.fillStyle = EYE; x.beginPath(); x.ellipse(ex, ey, 22 * big, 30 * big, 0, 0, 7); x.fill();
    x.fillStyle = '#7b5cff'; x.beginPath(); x.ellipse(ex, ey + 8, 16 * big, 18 * big, 0, 0, 7); x.fill();
    x.fillStyle = '#ffffff';
    if (kind === 'sparkly') star(x, ex + 9, ey - 12, 12, 4, 0.35);
    else { x.beginPath(); x.arc(ex + 8, ey - 12, 9, 0, 7); x.fill(); }
    x.beginPath(); x.arc(ex - 8, ey + 10, 4, 0, 7); x.fill();
    if (kind === 'sleepy') {
      x.fillStyle = skin; x.fillRect(ex - 30, ey - 36, 60, 34);
      x.strokeStyle = EYE; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.moveTo(ex - 24, ey - 2); x.lineTo(ex + 24, ey - 2); x.stroke();
    }
  }

  var STICKERS = {
    heartsticker: function (x) { x.fillStyle = '#ff4d88'; heart(x, 206, 92, 26); },
    starsticker: function (x) { x.fillStyle = '#ffd43b'; star(x, 218, 180, 27, 5, 0.45); },
    rainbowsticker: function (x) {
      ['#ff6f91', '#ffd166', '#5fcf9a', '#6aa9ff'].forEach(function (c, i) {
        x.strokeStyle = c; x.lineWidth = 8;
        x.beginPath(); x.arc(206, 194, 36 - i * 7.5, Math.PI, 0); x.stroke();
      });
    },
    moonsticker: function (x) {
      // The full moon less a smaller circle, inside the moon's own circle: a crescent, without touching her face.
      x.save();
      x.beginPath(); x.arc(206, 92, 26, 0, 7); x.clip();
      x.fillStyle = '#ffe27a'; x.beginPath(); x.rect(180, 66, 52, 52); x.arc(218, 84, 22, 0, 7); x.fill('evenodd');
      x.restore();
    },
    cloversticker: function (x) {
      x.fillStyle = '#4fbf6a';
      [[-11, -8], [11, -8], [0, 10]].forEach(function (p) { heart(x, 218 + p[0], 176 + p[1], 13); });
      x.strokeStyle = '#3a9a52'; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(218, 184); x.lineTo(226, 204); x.stroke();
    },
    daisysticker: function (x) {
      x.fillStyle = '#ffffff';
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        x.beginPath(); x.ellipse(206 + Math.cos(a) * 15, 92 + Math.sin(a) * 15, 9, 6, a, 0, 7); x.fill();
      }
      x.fillStyle = '#ffd43b'; x.beginPath(); x.arc(206, 92, 9, 0, 7); x.fill();
    },
    sparklecheeks: function (x) {
      [[44, 172], [64, 190], [212, 172], [192, 190]].forEach(function (p, i) {
        x.fillStyle = i % 2 ? '#ffffff' : '#fff3a3';
        star(x, p[0], p[1], 16, 4, 0.3);
      });
    }
  };

  var PAINTS = {
    boltpaint: function (x) {
      x.fillStyle = '#ffcf33'; x.strokeStyle = '#e09a00'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(58, 160); x.lineTo(38, 190); x.lineTo(52, 190); x.lineTo(42, 214); x.lineTo(70, 180);
      x.lineTo(56, 180); x.lineTo(66, 160); x.closePath(); x.fill(); x.stroke();
    },
    whiskers: function (x) {
      x.strokeStyle = EYE; x.lineWidth = 4; x.lineCap = 'round';
      [-10, 0, 10].forEach(function (dy) {
        x.beginPath(); x.moveTo(30, 178 + dy * 1.5); x.lineTo(72, 182 + dy); x.stroke();
        x.beginPath(); x.moveTo(226, 178 + dy * 1.5); x.lineTo(184, 182 + dy); x.stroke();
      });
    },
    flag: function (x) {
      x.fillStyle = '#0038a8'; x.fillRect(28, 176, 48, 15);
      x.fillStyle = '#ce1126'; x.fillRect(28, 191, 48, 15);
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(28, 176); x.lineTo(50, 191); x.lineTo(28, 206); x.closePath(); x.fill();
      x.fillStyle = '#fcd116'; x.beginPath(); x.arc(36, 191, 3.5, 0, 7); x.fill();
    },
    butterfly: function (x) {
      [['#a77bff', -12, -10], ['#a77bff', 12, -10], ['#ff8fc8', -9, 10], ['#ff8fc8', 9, 10]].forEach(function (w) {
        x.fillStyle = w[0]; x.beginPath(); x.ellipse(206 + w[1], 178 + w[2], 11, 9, 0, 0, 7); x.fill();
      });
      x.fillStyle = EYE; x.fillRect(205, 166, 3, 24);
    },
    tiger: function (x) {
      x.fillStyle = '#ff8c1a';
      [[100, 0], [128, 0], [156, 0]].forEach(function (p) {
        x.beginPath(); x.moveTo(p[0] - 10, 0); x.lineTo(p[0] + 10, 0); x.lineTo(p[0], 40); x.closePath(); x.fill();
      });
      [[0, 150], [0, 190], [256, 150], [256, 190]].forEach(function (p) {
        var dir = p[0] ? -1 : 1;
        x.beginPath(); x.moveTo(p[0], p[1] - 8); x.lineTo(p[0], p[1] + 8); x.lineTo(p[0] + dir * 40, p[1]); x.closePath(); x.fill();
      });
    }
  };

  // Paints everything on her face but the mouth: face paint, blush, freckles, a sticker, then the eyes on top.
  function paintFace(x, look, skin) {
    var wear = look.wear || {};
    if (PAINTS[wear.paint]) PAINTS[wear.paint](x);
    if (look.blush !== false) {
      x.fillStyle = 'rgba(255,120,160,.55)';
      x.beginPath(); x.ellipse(52, 178, 22, 12, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(204, 178, 22, 12, 0, 0, 7); x.fill();
    }
    if (look.freckles) {
      x.fillStyle = 'rgba(160,100,60,.7)';
      [[60, 166], [72, 176], [54, 182], [196, 166], [184, 176], [202, 182]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 3.5, 0, 7); x.fill(); });
    }
    if (STICKERS[wear.sticker]) STICKERS[wear.sticker](x);
    [86, 170].forEach(function (ex) { eye(x, look.eyes, ex, 132, skin); });
  }

  // ---- hair and skin ----
  function stripes(S, key, colors, opts) {
    var cache = S.wearMats = S.wearMats || {};
    if (cache[key]) return cache[key];
    var c = root.document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    colors.forEach(function (col, i) { g.addColorStop(i / (colors.length - 1), col); });
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
    cache[key] = new S.THREE.MeshToonMaterial(Object.assign({ map: S.canvasTexture(c), gradientMap: S.ramp }, opts || {}));
    return cache[key];
  }
  var DYE = {
    goldhair: function (S) { return S.toon('#f2c14e', { emissive: '#6b4a00', emissiveIntensity: 0.25 }); },
    pastelhair: function (S) { return S.toon('#f7b8d8'); },
    glitterhair: function (S, base) { return S.toon(base, { emissive: '#ffd9a0', emissiveIntensity: 0.05 }); },
    rainbowhair: function (S) { return stripes(S, 'rainbow', ['#ff6f91', '#ffb347', '#ffe066', '#7ddc8b', '#6aa9ff', '#a77bff']); },
    minthair: function (S) { return S.toon('#8fe3c4'); },
    sunsethair: function (S) { return stripes(S, 'sunset', ['#ff7a59', '#ffb347', '#ff8fc8', '#a77bff']); },
    galaxyhair: function (S) { return stripes(S, 'galaxy', ['#1d1640', '#3b2a8f', '#7b5cff', '#2b2140'], { emissive: '#3b2a8f', emissiveIntensity: 0.35 }); }
  };
  // A material for her hair: her own colour, or the dye she wears.
  function hairMaterial(S, dye, base) { return DYE[dye] ? DYE[dye](S, base) : S.toon(base); }

  var SHIMMER = { goldshimmer: '#ffd166', pinkshimmer: '#ff8fc8', silvershimmer: '#dfe7f2', mintshimmer: '#8fe3c4', lavendershimmer: '#c9a7ff' };
  function skinMaterial(S, skin, shimmer) {
    return SHIMMER[shimmer] ? S.toon(skin, { emissive: SHIMMER[shimmer], emissiveIntensity: 0.4 }) : S.toon(skin);
  }

  // Twinkling sparkles on her body (shimmer) and in her hair (glitter hair); hidden in low quality, like the scenery details.
  function sparkles(S, a, wear) {
    var spots = [];
    if (SHIMMER[wear.shimmer]) spots = [[-0.6, 2.6, 1.15, a.body], [0.6, 1.8, 1.3, a.body], [1.45, 3.0, 0.3, a.body], [-1.45, 1.8, -0.2, a.body], [0.2, 2.5, -1.2, a.body]];
    if (wear.dye === 'glitterhair') spots = spots.concat([[-0.9, 1.45, 1.45, a.head], [0.9, 1.8, 0.4, a.head], [-1.6, 1.0, 0.2, a.head], [1.6, 0.8, -0.5, a.head], [0.2, 0.6, -1.7, a.head]]);
    var tex = S.wearSpark || (S.wearSpark = S.emoji('✨'));
    var list = spots.map(function (p, i) {
      var s = S.sprite(tex, 0.5, 0.5);
      s.position.set(p[0], p[1], p[2]);
      s.userData.phase = i * 1.3;
      p[3].add(s);
      return s;
    });
    return {
      animate: function (t) {
        list.forEach(function (s) {
          s.visible = S.detail.visible;
          var k = 0.45 + Math.abs(Math.sin(t * 3 + s.userData.phase)) * 0.4;
          s.scale.set(k, k, 1);
        });
      },
      dispose: function () { list.forEach(function (s) { s.material.dispose(); }); }
    };
  }

  // ---- props in her right hand: origin at her grip, +y up, +z forward. Each builder fills group g and may return
  // animate(t, k) (k: 0..1 while she uses it, null while she just holds it) and the own materials to dispose. ----
  function easeIn(k) { return k == null ? 0 : Math.min(1, k / 0.2, (1 - k) / 0.2); }
  function starShape(S, g, mat, r, y) {
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2, c = S.add(S.cone(r * 0.32, r, 4), mat, Math.sin(a) * r * 0.5, y + Math.cos(a) * r * 0.5, 0, g);
      c.rotation.z = -a;
    }
    S.add(S.ball(r * 0.4), mat, 0, y, 0, g);
  }

  var PROPS = {
    balloon: function (S, g) {
      var up = new S.THREE.Group();
      g.add(up);
      S.add(S.cyl(0.02, 0.02, 4, 4), WHITE, 0, 2, 0, up);
      S.add(S.ball(0.7), '#ff6f91', 0, 4.8, 0, up).scale.set(1, 1.15, 1);
      S.add(S.cone(0.12, 0.2, 6), '#ff6f91', 0, 4.02, 0, up).rotation.x = Math.PI;
      return {
        animate: function (t, k) {
          up.rotation.z = Math.sin(t * 1.5) * 0.12;
          up.position.y = k === null ? 0 : Math.abs(Math.sin(k * Math.PI * 3)) * 0.8 * (1 - k);
        }
      };
    },
    bubblewand: function (S, g) {
      S.add(S.cyl(0.05, 0.05, 1.2, 6), '#ff8fc8', 0, 0.6, 0, g);
      S.add(S.torus(0.24, 0.05, 6, 16), '#7fd6ff', 0, 1.4, 0, g);
    },
    pamaypay: function (S, g) {
      var fan = new S.THREE.Group();
      fan.position.y = 0.5;
      g.add(fan);
      S.add(S.cyl(0.05, 0.05, 0.5, 6), '#a0785a', 0, -0.25, 0, fan);
      S.add(S.ball(0.6), '#e8c872', 0, 0.45, 0, fan).scale.set(1, 1, 0.12);
      [-0.3, 0, 0.3].forEach(function (x) { S.add(S.rbox(0.05, 0.9, 0.09, 0.02), '#c49a4a', x, 0.45, 0, fan).rotation.z = -x; });
      return { animate: function (t, k) { fan.rotation.y = k === null ? 0 : Math.sin(k * Math.PI * 6) * 0.5 * easeIn(k); } };
    },
    teddy: function (S, g) {
      var bear = new S.THREE.Group(), fur = '#c68b59';
      g.add(bear);
      S.add(S.ball(0.45), fur, 0, 0.5, 0, bear);
      S.add(S.ball(0.35), fur, 0, 1.05, 0, bear);
      pair(function (s) { S.add(S.ball(0.14), fur, s * 0.25, 1.35, 0, bear); });
      S.add(S.ball(0.14), '#f3d9c4', 0, 1.0, 0.3, bear);
      return { animate: function (t, k) { var s = 1 + Math.sin((k || 0) * Math.PI) * 0.15; bear.scale.set(s, s, s); } };
    },
    bouquet: function (S, g) {
      [-0.15, 0, 0.15].forEach(function (x) { S.add(S.cyl(0.04, 0.04, 0.9, 5), '#5fcf6a', x, 0.6, 0, g).rotation.z = -x; });
      S.add(S.cone(0.32, 0.7, 8), '#fff2b3', 0, 0.35, 0, g).rotation.x = Math.PI;
      [['#ff6f91', -0.2, 1.05], ['#ffd166', 0.2, 1.05], ['#a77bff', 0, 1.2], ['#ff9e6b', 0, 0.95]].forEach(function (f) {
        S.add(S.ball(0.18), f[0], f[1], f[2], 0.05, g);
      });
    },
    umbrella: function (S, g) {
      S.add(S.cyl(0.04, 0.04, 2.2, 6), '#5a4a52', 0, 1.1, 0, g);
      var top = S.add(S.cone(1.4, 0.7, 8), '#6aa9ff', 0, 2.3, 0, g);
      top.scale.set(0.25, 1.6, 0.25);
      return {
        animate: function (t, k) {
          var open = 0.25 + 0.75 * easeIn(k);
          top.scale.set(open, 1.6 - 0.6 * easeIn(k), open);
          top.rotation.y = k === null ? 0 : k * Math.PI * 4;
        }
      };
    },
    ribbonwand: function (S, g) {
      S.add(S.cyl(0.04, 0.04, 1, 6), WHITE, 0, 0.5, 0, g);
      var bits = [];
      for (var i = 0; i < 8; i++) bits.push(S.add(S.rbox(0.18, 0.08, 0.04, 0.02), '#ff6f91', 0, 1 - i * 0.12, 0, g));
      return {
        animate: function (t, k) {
          var e = easeIn(k);
          bits.forEach(function (b, i) {
            var a = i * 0.7 + (k || 0) * Math.PI * 4, r = 0.05 + 0.8 * e;
            b.position.set(Math.cos(a) * r * (i / 8), 1 + i * 0.12 * e - (1 - e) * i * 0.12, Math.sin(a) * r * (i / 8));
          });
        }
      };
    },
    drum: function (S, g) {
      var d = new S.THREE.Group();
      d.position.set(0, 0.1, 0.15);
      g.add(d);
      S.add(S.cyl(0.5, 0.5, 0.6, 16), '#ff5a5f', 0, 0, 0, d);
      S.add(S.cyl(0.52, 0.52, 0.06, 16), '#fff6e0', 0, 0.32, 0, d);
      S.add(S.torus(0.5, 0.04, 6, 16), GOLD, 0, -0.3, 0, d).rotation.x = Math.PI / 2;
      return { animate: function (t, k) { d.position.y = 0.1 + (k === null ? 0 : Math.abs(Math.sin(k * Math.PI * 6)) * 0.08); } };
    },
    parol: function (S, g) {
      var glow = S.toon(GOLD, { emissive: '#ffb347', emissiveIntensity: 0.5 }, true);
      S.add(S.cyl(0.04, 0.04, 1.2, 6), '#a0785a', 0, 0.6, 0, g);
      starShape(S, g, glow, 0.6, 1.6);
      return {
        animate: function (t, k) { glow.emissiveIntensity = 0.45 + Math.sin(t * 2) * 0.15 + easeIn(k) * 0.8; },
        mats: [glow]
      };
    },
    ukulele: function (S, g) {
      var u = new S.THREE.Group();
      u.rotation.z = 0.6;
      g.add(u);
      S.add(S.ball(0.42), '#d9a066', 0, 0.1, 0, u).scale.set(1, 1.15, 0.4);
      S.add(S.ball(0.32), '#d9a066', 0, 0.62, 0, u).scale.set(1, 1, 0.4);
      S.add(S.cyl(0.11, 0.11, 0.05, 12), INK, 0, 0.35, 0.14, u).rotation.x = Math.PI / 2;
      S.add(S.rbox(0.14, 1.0, 0.1, 0.04), '#8b5a2b', 0, 1.3, 0, u);
    },
    magicwand: function (S, g) {
      var glow = S.toon(GOLD, { emissive: '#ffd166', emissiveIntensity: 0.4 }, true);
      S.add(S.cyl(0.05, 0.05, 1.3, 6), INK, 0, 0.65, 0, g);
      starShape(S, g, glow, 0.35, 1.45);
      return { animate: function (t, k) { glow.emissiveIntensity = 0.35 + easeIn(k) * 0.9; }, mats: [glow] };
    },
    trophy: function (S, g) {
      var gold = S.toon(GOLD, { emissive: '#b8860b', emissiveIntensity: 0.25 }, true);
      S.add(S.rbox(0.6, 0.2, 0.6, 0.06), gold, 0, 0.15, 0, g);
      S.add(S.cyl(0.08, 0.08, 0.4, 8), gold, 0, 0.45, 0, g);
      S.add(S.cyl(0.45, 0.2, 0.6, 16), gold, 0, 0.95, 0, g);
      pair(function (s) { S.add(S.torus(0.2, 0.05, 6, 12), gold, s * 0.45, 1.0, 0, g).rotation.y = Math.PI / 2; });
      return { animate: function (t, k) { gold.emissiveIntensity = 0.25 + easeIn(k) * 0.6; }, mats: [gold] };
    }
  };

  // Draws prop id in hand (avatar.js's hand mount). Returns { animate(t, k), dispose() }, or null for no prop.
  function prop(S, hand, id) {
    if (!id || !Object.prototype.hasOwnProperty.call(PROPS, id)) return null;
    var g = new S.THREE.Group();
    hand.add(g);
    var r = PROPS[id](S, g) || {};
    return {
      animate: function (t, k) { if (r.animate) r.animate(t, k == null ? null : k); },
      dispose: function () {
        (r.mats || []).forEach(function (m) { m.dispose(); });
        hand.remove(g);
      }
    };
  }

  var exported = {
    CLOTHES: CLOTHES, HATS: HATS, GLASSES: GLASSES, BACK: BACK, NECK: NECK, STICKERS: STICKERS, PAINTS: PAINTS, DYE: DYE, SHIMMER: SHIMMER, PROPS: PROPS, prop: prop,
    clothes: clothes, extras: extras, paintFace: paintFace, hairMaterial: hairMaterial, skinMaterial: skinMaterial, sparkles: sparkles
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Wear = exported;
})(this);
