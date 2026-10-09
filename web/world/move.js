/* Input and camera for the 3D world: the paw joystick, WASD/arrow keys, dragging to turn the camera, and tap-to-walk
   (o.tapWalk). The maths is in walk.js; this file turns pointers and keys into it and moves the camera behind her. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var TAP_MOVE = 8, TAP_MS = 350, CAM_DIST = 15, STOP_GRACE = 0.25, BOX_IN = 0.4;
  // How far the camera looks down (radians): outdoors, and inside a room (her room's walls turn see-through instead).
  var PITCH = [0.12, 0.85], IN_PITCH = [0.6, 1.1], IN_START = 0.8;

  // o = { win, canvas, joy, knob, tapWalk, blocked(x, z), tapHit(x, y) → true when the tap was used (her pet),
  //       zoom (saved zoom), onZoom(z) (save it), canZoom() (zoom while frozen, e.g. on a ride) }
  function create(S, o) {
    var THREE = S.THREE, Walk = W.Walk, win = o.win;
    var st = { x: 0, z: 0, face: Math.PI, yaw: 0, pitch: 0.32, target: null, walkT: 0, mag: 0, sprint: false };
    var frozen = false, moved = false, still = 0, keys = {}, joy = { x: 0, y: 0 }, joyId = null, lookId = null, last = null, down = null;
    var camPos = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
    var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var pinchId = null, pinch = null, zoomSave = null, boxed = null, outPitch = st.pitch, fixedView = null;
    st.zoom = W.Prefs.clampZoom(o.zoom);

    function zoom(z) { st.zoom = W.Prefs.clampZoom(z); }
    function saveZoom(wait) {
      if (zoomSave) win.clearTimeout(zoomSave);
      zoomSave = win.setTimeout(function () {
        zoomSave = null;
        if (o.onZoom) o.onZoom(st.zoom);
      }, wait);
    }
    function zoomable() { return o.canZoom ? o.canZoom() : !frozen; }
    // A pinch cut short by a freeze or the page hiding still keeps the zoom she reached.
    function dropPinch() {
      if (pinch) saveZoom(0);
      pinchId = null;
      pinch = null;
    }
    function pinchZoom() { zoom(pinch.zoom * Math.hypot(pinch.x - last.x, pinch.y - last.y) / pinch.d); }

    function typing(e) { return e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName); }
    win.addEventListener('keydown', function (e) { if (!typing(e)) keys[String(e.key).toLowerCase()] = true; });
    win.addEventListener('keyup', function (e) { keys[String(e.key).toLowerCase()] = false; });
    function capture(e) { try { e.target.setPointerCapture(e.pointerId); } catch (err) {} }
    function releaseAll() {
      keys = {};
      joyId = null;
      lookId = null;
      dropPinch();
      joy.x = joy.y = 0;
      st.sprint = false;
      o.knob.style.transform = '';
    }
    win.addEventListener('blur', releaseAll);
    win.document.addEventListener('visibilitychange', function () { if (win.document.hidden) releaseAll(); });

    o.joy.addEventListener('pointerdown', function (e) {
      if (joyId !== null) return;
      joyId = e.pointerId;
      capture(e);
      moveJoy(e);
      e.preventDefault();
    });
    // A second finger while the first is down pinches: spreading them zooms in, and the camera does not turn.
    o.canvas.addEventListener('pointerdown', function (e) {
      if (lookId !== null) {
        if (pinchId !== null || !zoomable()) return;
        pinchId = e.pointerId;
        capture(e);
        pinch = { x: e.clientX, y: e.clientY, d: Math.max(1, Math.hypot(e.clientX - last.x, e.clientY - last.y)), zoom: st.zoom };
        down = null;
        return;
      }
      lookId = e.pointerId;
      capture(e);
      last = { x: e.clientX, y: e.clientY };
      down = { x: e.clientX, y: e.clientY, at: Date.now() };
    });
    o.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (!zoomable() || !e.deltaY) return;
      zoom(st.zoom * (e.deltaY < 0 ? 1 / 0.9 : 0.9));
      saveZoom(500);
    }, { passive: false });
    win.addEventListener('pointermove', function (e) {
      if (e.pointerId === joyId) moveJoy(e);
      else if (e.pointerId === pinchId) {
        pinch.x = e.clientX;
        pinch.y = e.clientY;
        pinchZoom();
      } else if (e.pointerId === lookId && pinchId !== null) {
        last = { x: e.clientX, y: e.clientY };
        pinchZoom();
      } else if (e.pointerId === lookId && !frozen && !fixedView) {
        var range = boxed ? IN_PITCH : PITCH;
        st.yaw -= (e.clientX - last.x) * 0.008;
        st.pitch = Math.max(range[0], Math.min(range[1], st.pitch + (e.clientY - last.y) * 0.004));
        last = { x: e.clientX, y: e.clientY };
      }
    });
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', end);

    function end(e) {
      if (e.pointerId === joyId) {
        joyId = null;
        joy.x = joy.y = 0;
        o.knob.style.transform = '';
      }
      if (pinchId !== null && (e.pointerId === pinchId || e.pointerId === lookId)) {
        pinchId = null;
        pinch = null;
        saveZoom(0);
      }
      if (e.pointerId === lookId) {
        lookId = null;
        var tap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MOVE && Date.now() - down.at < TAP_MS;
        if (tap && !frozen && o.tapHit && o.tapHit(e.clientX, e.clientY)) return;
        if (o.tapWalk && !frozen && !fixedView && tap) tapTo(e.clientX, e.clientY);
      }
    }

    function moveJoy(e) {
      var r = o.joy.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var max = r.width * 0.34, d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      o.knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      joy.x = dx / max;
      joy.y = dy / max;
    }

    function tapTo(cx, cy) {
      var r = o.canvas.getBoundingClientRect();
      ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, S.camera);
      if (!ray.ray.intersectPlane(groundPlane, hit)) return;
      clampIn(hit);
      st.target = { x: hit.x, z: hit.z };
    }

    function update(dt) {
      if (frozen || fixedView) { st.mag = 0; return st; }
      var ix = joy.x + (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      var iy = joy.y + (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      var dir = Walk.moveVector(ix, iy, st.yaw);
      if (dir) st.target = null;
      else if (st.target) {
        dir = Walk.toward(st.x, st.z, st.target.x, st.target.z);
        if (!dir) st.target = null;
      }
      if (!dir) {
        st.mag = 0;
        st.walkT *= 0.85;
        still += dt;
        if (moved && still >= STOP_GRACE) {
          st.sprint = false;
          moved = false;
        }
        return st;
      }
      var fast = st.sprint ? Walk.SPRINT : 1, next = Walk.step(st.x, st.z, dir, dt, o.blocked, fast);
      if (st.target && next.x === st.x && next.z === st.z) st.target = null;
      st.x = next.x;
      st.z = next.z;
      st.face = Walk.turn(st.face, Walk.facing(dir), dt * 12);
      st.walkT += dt * 12 * dir.mag * fast;
      st.mag = dir.mag;
      still = 0;
      moved = true;
      return st;
    }

    // Sprint stays armed while she stands; it switches off once she has stood still for STOP_GRACE after moving, so
    // changing keys or swinging the joystick through its middle does not end it.
    function sprint(on) { st.sprint = !!on && !frozen; }

    // Keeps a point inside the room (box(b)): where a tap sends her, and the character maker's camera.
    function clampIn(p) {
      if (!boxed) return;
      p.x = Math.max(boxed.minX + BOX_IN, Math.min(boxed.maxX - BOX_IN, p.x));
      p.z = Math.max(boxed.minZ + BOX_IN, Math.min(boxed.maxZ - BOX_IN, p.z));
    }

    // Behind her at the zoomed distance; with fixed(v) set, at v looking at v.at (the Decorate view).
    function camera(dt, snap) {
      var dist = CAM_DIST / st.zoom, pitch = st.pitch;
      if (fixedView) camPos.set(fixedView.x, fixedView.y, fixedView.z);
      else {
        camPos.set(st.x + Math.sin(st.yaw) * dist * Math.cos(pitch), 2.5 + Math.sin(pitch) * dist,
          st.z + Math.cos(st.yaw) * dist * Math.cos(pitch));
      }
      if (snap) S.camera.position.copy(camPos);
      else S.camera.position.lerp(camPos, Math.min(1, dt * 6));
      if (fixedView) S.camera.lookAt(fixedView.at.x, fixedView.at.y, fixedView.at.z);
      else S.camera.lookAt(st.x, 3.4, st.z);
    }

    // The character maker's view: in front of her, looking a little low so she sits above the panel. Inside a room the
    // camera stops at the wall and looks down at the same angle.
    function portrait() {
      camPos.set(st.x + Math.sin(st.face) * 18, 4, st.z + Math.cos(st.face) * 18);
      clampIn(camPos);
      var d = Math.hypot(camPos.x - st.x, camPos.z - st.z);
      S.camera.position.copy(camPos);
      S.camera.lookAt(st.x, 4 - 6 * d / 18, st.z);
    }

    // b = { minX, maxX, minZ, maxZ }: her room. The camera looks down more there (and the drag turns it within
    // IN_PITCH); taps send her only inside it. null: outdoors again, at the pitch she had.
    function box(b) {
      if (b && !boxed) {
        outPitch = st.pitch;
        st.pitch = IN_START;
      } else if (!b && boxed) st.pitch = outPitch;
      boxed = b ? { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ } : null;
    }

    // v = { x, y, z, at: { x, y, z } }: the camera moves there and stays (she cannot walk, drag or tap-to-walk);
    // null: back behind her.
    function fixed(v) { fixedView = v ? { x: v.x, y: v.y, z: v.z, at: { x: v.at.x, y: v.at.y, z: v.at.z } } : null; }

    function teleport(x, z, face) {
      st.x = x;
      st.z = z;
      st.face = face;
      st.yaw = face + Math.PI;
      st.target = null;
      camera(0, true);
    }

    function freeze(on) {
      frozen = on;
      joy.x = joy.y = 0;
      joyId = null;
      lookId = null;
      dropPinch();
      o.knob.style.transform = '';
      st.target = null;
      if (on) st.sprint = false;
    }

    return {
      state: st, update: update, camera: camera, portrait: portrait, teleport: teleport, freeze: freeze, sprint: sprint, zoom: zoom,
      box: box, fixed: fixed
    };
  }

  W.Move = { create: create };
})(this);
