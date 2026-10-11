/* Opens a game page inside the world: the camera glides toward her at the door, the world stops drawing and blurs,
   and the game runs in a framed iframe with ?embed=1 until it asks to close (nav.js) or ✕ is pressed. */
(function (root) {
  'use strict';

  function smooth(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }
  // k = 1 returns b's own numbers, so a glide ends exactly where it was aimed.
  function mix(a, b, k) {
    if (k === 1) return { x: b.x, y: b.y, z: b.z };
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
  }

  // pose = { pos, look }: where the camera is and the point it looks at.
  function ease(from, to, t) {
    var k = smooth(t);
    return { pos: mix(from.pos, to.pos, k), look: mix(from.look, to.look, k) };
  }

  function closer(pose) {
    return { pos: mix(pose.pos, pose.look, 0.6), look: { x: pose.look.x, y: pose.look.y + 0.6, z: pose.look.z } };
  }

  function embedUrl(url) {
    var hash = url.indexOf('#'), base = hash < 0 ? url : url.slice(0, hash), tail = hash < 0 ? '' : url.slice(hash);
    return base + (base.indexOf('?') < 0 ? '?' : '&') + 'embed=1' + tail;
  }

  function acceptMessage(evt, frameWin, origin) {
    return !!evt && !!frameWin && evt.source === frameWin && evt.origin === origin && !!evt.data && evt.data.type === 'portal-close';
  }

  var OPEN_MS = 600, CLOSE_MS = 400, LOAD_MS = 8000;
  var THEN = ['shop', 'lobby', 'account'];

  function create(o) {
    var state = 'closed', url = null, home = null, glide = null, timer = null;

    function animate(from, to, ms, done) {
      var mine = glide = {};
      if (o.instant()) {
        o.camera.set(to);
        o.render();
        glide = null;
        done();
        return;
      }
      var start = o.now();
      function step() {
        if (glide !== mine) return;
        var t = Math.min(1, (o.now() - start) / ms);
        o.camera.set(ease(from, to, t));
        o.render();
        if (t < 1) o.raf(step);
        else { glide = null; done(); }
      }
      step();
    }

    function stopTimer() {
      if (timer !== null) o.cancel(timer);
      timer = null;
    }

    function open(app, href, color, title) {
      if (state !== 'closed') return false;
      state = 'opening';
      url = embedUrl(href);
      o.freeze(true);
      o.pauseWorld(true);
      home = o.camera.get();
      o.history.pushState({ portal: app || 'game' }, '');
      animate(home, closer(home), OPEN_MS, function () {
        if (state !== 'opening') return;
        state = 'open';
        o.view.show(url, color, title, stopTimer);
        timer = o.later(function () {
          timer = null;
          if (state !== 'open') return;
          state = 'closed';
          o.view.hide();
          o.camera.set(home);
          o.pauseWorld(false);
          o.freeze(false);
          o.fallback(href);
        }, LOAD_MS);
      });
      return true;
    }

    // popped: the browser already left our history entry (the back gesture).
    function close(then, popped) {
      if (state === 'closed' || state === 'closing') return false;
      stopTimer();
      state = 'closing';
      var inner = 0;
      try {
        var fs = o.view.win() && o.view.win().history.state;
        if (fs && fs.nav) inner = 1;
      } catch (e) {}
      o.view.hide();
      if (!popped && o.history.state && o.history.state.portal) o.history.go(-(1 + inner));
      animate(o.camera.get(), home, CLOSE_MS, function () {
        state = 'closed';
        o.pauseWorld(false);
        o.freeze(false);
        o.onClosed(then);
      });
      return true;
    }

    return {
      open: open,
      close: function (then) { return close(then, false); },
      popstate: function (st) {
        if ((state === 'opening' || state === 'open') && !(st && st.portal)) close(undefined, true);
      },
      message: function (evt) {
        if (state !== 'open' || !acceptMessage(evt, o.view.win(), o.origin)) return;
        close(THEN.indexOf(evt.data.then) >= 0 ? evt.data.then : undefined, false);
      },
      isOpen: function () { return state !== 'closed'; },
      state: function () { return state; },
      url: function () { return url; }
    };
  }

  // The frame: a full-screen layer with a card (the game's iframe) and a ✕ that always closes.
  function view(doc, label, onX) {
    var box = null, frame = null, opener = null;
    return {
      show: function (url, color, title, onLoad) {
        opener = doc.activeElement;
        box = doc.createElement('div');
        box.className = 'w-portal';
        box.style.setProperty('--portal-color', color || '#ffb84d');
        var card = doc.createElement('div');
        card.className = 'w-portal-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-label', title);
        frame = doc.createElement('iframe');
        frame.className = 'w-portal-frame';
        frame.title = title;
        frame.addEventListener('load', onLoad);
        frame.src = url;
        var x = doc.createElement('button');
        x.type = 'button';
        x.className = 'w-portal-x';
        x.textContent = '✕';
        x.setAttribute('aria-label', label);
        x.addEventListener('click', onX);
        card.appendChild(frame);
        card.appendChild(x);
        box.appendChild(card);
        doc.body.appendChild(box);
        doc.documentElement.classList.add('w-portal-on');
        frame.focus();
      },
      hide: function () {
        if (box && box.parentNode) box.parentNode.removeChild(box);
        box = frame = null;
        doc.documentElement.classList.remove('w-portal-on');
        if (opener && opener.focus && doc.body.contains(opener)) opener.focus();
        opener = null;
      },
      win: function () { return frame ? frame.contentWindow : null; }
    };
  }

  var exported = { ease: ease, closer: closer, embedUrl: embedUrl, acceptMessage: acceptMessage, create: create, view: view,
    OPEN_MS: OPEN_MS, CLOSE_MS: CLOSE_MS, LOAD_MS: LOAD_MS, THEN: THEN };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Portal = exported;
})(this);
