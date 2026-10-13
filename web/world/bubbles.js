/* The ambient word bubbles over characters' heads: a white speech bubble on a canvas texture, as a sprite that follows
   its speaker and fades in and out (chatter.js decides who speaks and when). English only. Cosmetic: nothing is saved. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var POOL = 3, CACHE = 24, W = 512, H = 192, LIFT = 1.3;

  // Words into at most maxLines lines no wider than maxW (measure(text) gives a pixel width).
  function wrap(measure, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      var next = line ? line + ' ' + w : w;
      if (line && measure(next) > maxW) {
        lines.push(line);
        line = w;
      } else line = next;
    });
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }

  function fits(measure, text, maxW, maxLines) {
    var lines = wrap(measure, text, maxW, 99);
    return lines.length <= maxLines && lines.every(function (l) { return measure(l) <= maxW; });
  }

  function paint(S, doc, text) {
    var c = doc.createElement('canvas');
    c.width = W;
    c.height = H;
    var x = c.getContext('2d'), size = 44, lines;
    do {
      x.font = '800 ' + size + 'px "Baloo 2", sans-serif';
      size -= 4;
    } while (!fits(function (s) { return x.measureText(s).width; }, text, 440, 2) && size > 24);
    lines = wrap(function (s) { return x.measureText(s).width; }, text, 440, 2);
    function rounded(l, t, w, h, r) {
      x.beginPath();
      x.moveTo(l + r, t);
      x.arcTo(l + w, t, l + w, t + h, r);
      x.arcTo(l + w, t + h, l, t + h, r);
      x.arcTo(l, t + h, l, t, r);
      x.arcTo(l, t, l + w, t, r);
      x.closePath();
    }
    x.fillStyle = 'rgba(0,0,0,.14)';
    rounded(14, 18, 484, 126, 40);
    x.fill();
    x.fillStyle = '#ffffff';
    rounded(10, 10, 492, 126, 40);
    x.fill();
    x.beginPath();
    x.moveTo(236, 134);
    x.lineTo(276, 134);
    x.lineTo(256, 176);
    x.closePath();
    x.fill();
    x.fillStyle = '#3b3350';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    var lh = size + 8, top = 73 - ((lines.length - 1) * lh) / 2;
    lines.forEach(function (l, i) { x.fillText(l, 256, top + i * lh); });
    return S.canvasTexture(c);
  }

  function create(S, doc) {
    var sprites = [], textures = {}, order = [];
    for (var i = 0; i < POOL; i++) {
      var sp = S.sprite(S.emoji(' '), 5.3, 2);
      sp.visible = false;
      sp.material.opacity = 0;
      S.scene.add(sp);
      sprites.push(sp);
    }
    function texture(text) {
      if (!textures[text]) {
        textures[text] = paint(S, doc, text);
        order.push(text);
        if (order.length > CACHE) {
          var old = order.shift();
          textures[old].dispose();
          delete textures[old];
        }
      }
      return textures[text];
    }
    // list = chatter.step(...): [{ text, x, y, z, alpha }]
    function show(list) {
      sprites.forEach(function (sp, n) {
        var b = list[n];
        if (!b || b.alpha <= 0) {
          sp.visible = false;
          return;
        }
        var map = texture(b.text);
        if (sp.material.map !== map) {
          sp.material.map = map;
          sp.material.needsUpdate = true;
        }
        sp.material.opacity = b.alpha;
        sp.position.set(b.x, b.y + LIFT, b.z);
        sp.visible = true;
      });
    }
    return { show: show, count: function () { return sprites.filter(function (sp) { return sp.visible; }).length; } };
  }

  var exported = { wrap: wrap, fits: fits, create: create };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Bubbles = exported;
})(this);
