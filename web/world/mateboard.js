/* Who sits where on the playground rides (playmates part 1): seats, the kids' own rides, and friends riding with her.
   Pure maths on rides.js. A ride's moving part is shared, so kids on her ride move with her run and land with her;
   seat 0 of her ride is hers. tick(dt, now) takes play.js now() each frame and returns events:
   { type: 'start', id, bumped: [{ kid, end }] } when she gets on, { type: 'land', kid, end } when a kid gets off. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var R = node ? require('./rides.js') : root.World3D.Rides;

  var SEATS = { slide: 2, swings: 2, seesaw: 2, merry: 4 };
  var FOLLOW = 1, MERRY_WAIT = 1.5;
  var SIDE = [0, 1.4, -1.4, 2.8];

  // pr = Layout.props(grade); ends = { rideId: { x, z, face } }; rand picks how many loops the kids ride (2-4).
  function create(pr, ends, rand) {
    var seats = {}, runs = {}, her = null, wait = {};
    function reset() {
      seats = {};
      runs = {};
      wait = {};
      Object.keys(SEATS).forEach(function (id) {
        seats[id] = [];
        for (var i = 0; i < SEATS[id]; i++) seats[id].push(null);
      });
    }
    reset();

    function partOf(id, i) { return id === 'slide' ? 'slide' + i : id === 'swings' ? (i ? 'swing2' : 'swings') : id; }
    function rideOf(part) { return part.indexOf('slide') === 0 ? 'slide' : part === 'swing2' ? 'swings' : part; }
    function mine(id) { return !!her && her.id === id; }
    function endFor(id, i) { var e = ends[id]; return { x: e.x + SIDE[i], z: e.z, face: e.face }; }
    function newRun(id) { return { t: 0, stopAt: R.loops(id) ? 2 + R.LOOPS[id] * (2 + Math.min(2, Math.floor(rand() * 3))) : null }; }

    function seatOf(kid) {
      for (var id in seats) {
        var i = seats[id].indexOf(kid);
        if (i >= 0) return { id: id, i: i };
      }
      return null;
    }

    // A free seat on ride id, or -1 when it is full or the kids' part there is already moving.
    function claim(kid, id) {
      if (seatOf(kid) || !seats[id]) return -1;
      for (var i = 0; i < seats[id].length; i++) {
        if (seats[id][i] !== null || (mine(id) && i === 0) || runs[partOf(id, i)]) continue;
        seats[id][i] = kid;
        if (id === 'merry' && !mine(id) && wait.merry === undefined) wait.merry = 0;
        return i;
      }
      return -1;
    }

    function leave(kid) {
      var s = seatOf(kid);
      if (!s) return;
      seats[s.id][s.i] = null;
      var part = partOf(s.id, s.i);
      if (runs[part] && !seats[s.id].some(function (k, i) { return k !== null && partOf(s.id, i) === part; })) delete runs[part];
      if (!seats[s.id].some(function (k) { return k !== null; })) delete wait[s.id];
    }

    function land(id, i, ev) {
      ev.push({ type: 'land', kid: seats[id][i], end: endFor(id, i) });
      seats[id][i] = null;
    }

    function herStart(id) {
      var bumped = [];
      her = { id: id, t: 0, stopAt: null };
      // The slide has no shared part, so a kid already sliding down finishes from the next seat instead of jumping
      // back to the top.
      if (id === 'slide' && runs.slide0 && seats.slide[1] === null) {
        runs.slide1 = runs.slide0;
        seats.slide[1] = seats.slide[0];
        seats.slide[0] = null;
        delete runs.slide0;
      }
      seats[id].forEach(function (k, i) { if (k !== null && !(id === 'slide' && i === 1 && runs.slide1)) delete runs[partOf(id, i)]; });
      delete wait[id];
      var k0 = seats[id][0];
      if (k0 !== null) {
        seats[id][0] = null;
        var j = seats[id].indexOf(null, 1);
        if (j > 0) seats[id][j] = k0;
        else bumped.push({ kid: k0, end: endFor(id, 0) });
      }
      return bumped;
    }

    // She landed: her friends get off with her; a kid still sliding down after her finishes first.
    function herLand(ev) {
      var id = her.id;
      her = null;
      seats[id].forEach(function (k, i) { if (k !== null && !runs[partOf(id, i)]) land(id, i, ev); });
    }

    function startReady(dt) {
      Object.keys(seats).forEach(function (id) {
        var s = seats[id];
        if (mine(id)) {
          if (id === 'slide' && s[1] !== null && !runs.slide1 && her.t >= FOLLOW) runs.slide1 = newRun('slide');
          return;
        }
        if (id === 'slide') {
          if (s[0] !== null && !runs.slide0) runs.slide0 = newRun('slide');
          if (s[1] !== null && !runs.slide1 && (s[0] === null || (runs.slide0 && runs.slide0.t >= FOLLOW))) runs.slide1 = newRun('slide');
        } else if (id === 'swings') {
          if (s[0] !== null && !runs.swings) runs.swings = newRun('swings');
          if (s[1] !== null && !runs.swing2) runs.swing2 = newRun('swings');
        } else if (id === 'seesaw') {
          if (s[0] !== null && s[1] !== null && !runs.seesaw) runs.seesaw = newRun('seesaw');
        } else if (wait.merry !== undefined && !runs.merry) {
          wait.merry += dt;
          if (wait.merry >= MERRY_WAIT) {
            runs.merry = newRun('merry');
            delete wait.merry;
          }
        }
      });
    }

    function tick(dt, now) {
      var ev = [];
      if (her && (!now || now.id !== her.id)) herLand(ev);
      if (now && !her) ev.push({ type: 'start', id: now.id, bumped: herStart(now.id) });
      if (now) {
        her.t = now.t;
        her.stopAt = now.stopAt;
      }
      Object.keys(runs).forEach(function (part) {
        var r = runs[part], id = rideOf(part);
        r.t += dt;
        if (!R.runDone(id, r.t, r.stopAt)) return;
        delete runs[part];
        seats[id].forEach(function (k, i) { if (k !== null && partOf(id, i) === part) land(id, i, ev); });
      });
      startReady(dt);
      return ev;
    }

    function angle(id, i) {
      if (mine(id)) {
        var a = R.runPart(id, her.t, her.stopAt);
        return id === 'swings' ? -a : a;
      }
      var r = runs[partOf(id, i)];
      return r ? R.runPart(id, r.t, r.stopAt) : R.part(id, null);
    }

    // Where a seated kid is: { x, y, z, face, sit, cheer }, or null.
    function pose(kid) {
      var s = seatOf(kid);
      if (!s) return null;
      var id = s.id, i = s.i;
      if (id === 'slide') {
        var r = runs[partOf(id, i)];
        return R.pose(pr, 'slide', r ? Math.min(1, r.t / R.RIDES.slide.time) : 0);
      }
      var a = angle(id, i);
      if (id === 'swings') return mine(id) || i === 1 ? R.partner(pr, 'swings', a) : R.seat(pr, 'swings', a);
      if (i === 0) return R.seat(pr, id, a);
      return R.partner(pr, id, a, i);
    }

    // The angles build.js should show for the parts she is not riding.
    function parts() {
      var out = {};
      ['swings', 'swing2', 'seesaw', 'merry'].forEach(function (p) {
        var id = rideOf(p);
        if (mine(id)) {
          if (p === 'swing2') out.swing2 = seats.swings[1] !== null ? angle('swings', 1) : R.part('swings', null);
          return;
        }
        var r = runs[p];
        out[p] = r ? R.runPart(id, r.t, r.stopAt) : R.part(id, null);
      });
      return out;
    }

    // Kids on ride id beside her (seats 1 and up).
    function friends(id) { return seats[id].slice(1).filter(function (k) { return k !== null; }).length; }

    return {
      claim: claim, leave: leave, tick: tick, pose: pose, parts: parts, seatOf: seatOf, friends: friends,
      running: function (part) { return !!runs[part]; },
      herRide: function () { return her ? her.id : null; },
      moving: function (kid) { var s = seatOf(kid); return !!s && (mine(s.id) || !!runs[partOf(s.id, s.i)]); },
      clear: function () { reset(); her = null; },
      SEATS: SEATS
    };
  }

  var exported = { create: create, SEATS: SEATS, FOLLOW: FOLLOW };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateBoard = exported;
})(this);
