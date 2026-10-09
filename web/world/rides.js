/* The playground rides as plain maths: how far each moving part turns at moment k (0 to 1) of a ride, and where she is
   then. build.js turns the parts and play.js puts her there. pr = Layout.props(grade). Sitting puts her hips (1.05 up
   from her feet) on the seat. */
(function (root) {
  'use strict';

  var RIDES = { slide: { time: 2 }, swings: { time: 4 }, seesaw: { time: 4 }, merry: { time: 4 } };
  var BAR = 4.4, ROPE = 3.2, SEAT = 1.2, PLANK = 2.6, PLANK_Y = 0.9, TILT = 0.15, MERRY = 1.5, DECK = 0.7, HIPS = 1.05;
  // The slide's ramp, drawn by build.js: centre 1.8 up and 0.4 south of the slide's spot, 5.6 long, tilted 0.55 so the
  // end by the ladder tower is the high one.
  var RAMP = { y: 1.8, dz: 0.4, half: 2.8, tilt: 0.55 };

  function ease(k) { return k * k * (3 - 2 * k); }
  function fade(k) { return k < 0.8 ? 1 : Math.max(0, (1 - k) / 0.2); }

  // Each ride's sound moments at k (world-main.js plays them through sfx.js): the slide starts down at 0.25, a
  // swing passes the bottom where sin(4πk) is 0, a see-saw side touches down at its extremes, the merry-go-round
  // slows at 0.7.
  var CUES = {
    slide: [[0, 'ride-start'], [0.25, 'slide-go'], [1, 'ride-land']],
    swings: [[0, 'ride-start'], [0.25, 'swing'], [0.5, 'swing'], [0.75, 'swing'], [1, 'ride-land']],
    seesaw: [[0, 'ride-start'], [1 / 12, 'seesaw-bump'], [4 / 12, 'seesaw-bump'], [7 / 12, 'seesaw-bump'], [10 / 12, 'seesaw-bump'],
      [1, 'ride-land']],
    merry: [[0, 'ride-start'], [0, 'merry-start'], [0.7, 'merry-slow'], [1, 'ride-land']]
  };

  // The cue names a ride passes after k = from and up to k = to, in order; play.js starts with from = -1.
  function cues(id, from, to) {
    var list = Object.prototype.hasOwnProperty.call(CUES, id) ? CUES[id] : [];
    return list.filter(function (c) { return c[0] > from && c[0] <= to; }).map(function (c) { return c[1]; });
  }

  // The swing's angle, the see-saw's tilt or the merry-go-round's turn at k; null (or the end) is at rest.
  function part(id, k) {
    if (k === null || k === undefined || k <= 0 || k >= 1) return id === 'seesaw' ? TILT : 0;
    if (id === 'swings') return 0.7 * Math.sin(k * Math.PI * 4) * fade(k);
    if (id === 'seesaw') return 0.3 * Math.sin(k * Math.PI * 4 + Math.PI / 6);
    if (id === 'merry') return Math.PI * 4 * ease(k);
    return 0;
  }

  // Her seat on the swings, see-saw or merry-go-round when its moving part is at angle a.
  function seat(pr, id, a) {
    if (id === 'swings') {
      var sw = pr.swings;
      return { x: sw.x + SEAT, y: BAR - ROPE * Math.cos(a) - HIPS + 0.1, z: sw.z - ROPE * Math.sin(a), face: 0, sit: true, cheer: false };
    }
    if (id === 'seesaw') {
      var se = pr.seesaw;
      return { x: se.x + PLANK * Math.cos(a), y: PLANK_Y + PLANK * Math.sin(a) - HIPS + 0.15, z: se.z, face: -Math.PI / 2, sit: true, cheer: false };
    }
    var mr = pr.merry;
    return { x: mr.x + MERRY * Math.sin(a), y: DECK, z: mr.z + MERRY * Math.cos(a), face: a + Math.PI / 2, sit: false, cheer: true };
  }

  // { x, y, z, face, sit, cheer } for her at moment k of the ride.
  function pose(pr, id, k) {
    if (id !== 'slide') return seat(pr, id, part(id, k));
    var sl = pr.slide;
    if (k < 0.25) return { x: sl.x, y: 3.6, z: sl.z - 2.4, face: 0, sit: false, cheer: false };
    var u = ease(Math.min(1, (k - 0.25) / 0.75)), c = Math.cos(RAMP.tilt) * RAMP.half, s = Math.sin(RAMP.tilt) * RAMP.half;
    var z0 = sl.z + RAMP.dz - c, z1 = sl.z + RAMP.dz + c, y0 = RAMP.y + s, y1 = RAMP.y - s;
    return { x: sl.x, y: Math.max(0, y0 + (y1 - y0) * u - HIPS + 0.05), z: z0 + (z1 - z0) * u, face: 0, sit: true, cheer: u > 0.85 };
  }

  // A friend riding along: the far end of the see-saw, the other swing (at its own angle a), or the merry-go-round
  // spot `slot` (1-3) a quarter turn on from hers.
  function partner(pr, id, a, slot) {
    if (id === 'seesaw') {
      var se = pr.seesaw;
      return { x: se.x - PLANK * Math.cos(a), y: PLANK_Y - PLANK * Math.sin(a) - HIPS + 0.15, z: se.z, face: Math.PI / 2, sit: true, cheer: false };
    }
    if (id === 'swings') {
      var sw = pr.swings;
      return { x: sw.x - SEAT, y: BAR - ROPE * Math.cos(a) - HIPS + 0.1, z: sw.z - ROPE * Math.sin(a), face: 0, sit: true, cheer: false };
    }
    if (id === 'merry') return seat(pr, 'merry', a + (slot || 1) * Math.PI / 2);
    return null;
  }

  // Rides that go on until she taps Stop, and one loop in seconds: a whole swing or rock, and one full turn of the
  // merry-go-round at its top speed (1.5π a second), so every loop ends where it rests.
  var LOOPS = { swings: 2, seesaw: 2, merry: 4 / 3 };
  var SPIN = Math.PI * 1.5;

  function loops(id) { return Object.prototype.hasOwnProperty.call(LOOPS, id); }

  // When the ending (today's last 2 s) starts: the first loop boundary at or after Stop, never before 2 s; null
  // until Stop.
  function endAt(id, stopAt) {
    if (stopAt === null || stopAt === undefined) return null;
    var lap = LOOPS[id];
    return 2 + lap * Math.max(0, Math.ceil((Math.max(2, stopAt) - 2) / lap - 1e-9));
  }

  function loopDone(id, t, stopAt) {
    var e = endAt(id, stopAt);
    return e !== null && t >= e + 2;
  }

  function spun(t) { return t < 2 ? part('merry', t / 4) : Math.PI * 2 + SPIN * (t - 2); }

  // The moving part's angle t seconds into a looping ride.
  function loopPart(id, t, stopAt) {
    var e = endAt(id, stopAt);
    if (e !== null && t >= e + 2) return part(id, null);
    if (e !== null && t >= e) {
      var k = 0.5 + (t - e) / 4;
      return id === 'merry' ? spun(e) + part(id, k) - Math.PI * 2 : part(id, k);
    }
    return id === 'merry' ? spun(t) : part(id, (t % 2) / 4);
  }

  function loopPose(pr, id, t, stopAt) { return seat(pr, id, loopPart(id, t, stopAt)); }

  // The cue names a looping ride passes after time from and up to time to (play.js starts with from = -1): the start,
  // a creak each second as the swing passes the bottom or a bump a third of a second past each second as a see-saw
  // side touches down, the merry-go-round slowing 0.8 s into its ending, and the landing.
  function loopCues(id, from, to, stopAt) {
    var e = endAt(id, stopAt), last = e === null ? Infinity : e + 2, out = [];
    function at(time, name) { if (time > from && time <= to && time <= last) out.push({ time: time, name: name }); }
    at(0, 'ride-start');
    if (id === 'merry') {
      at(0, 'merry-start');
      if (e !== null) at(e + 0.8, 'merry-slow');
    } else {
      var off = id === 'seesaw' ? 1 / 3 : 0, name = id === 'seesaw' ? 'seesaw-bump' : 'swing';
      for (var n = Math.max(0, Math.floor(from)); n + off <= Math.min(to, last); n++) {
        if (n + off > 0 && n + off < last) at(n + off, name);
      }
    }
    if (e !== null) at(last, 'ride-land');
    return out.sort(function (x, y) { return x.time - y.time; }).map(function (c) { return c.name; });
  }

  // A ride run { t, stopAt } by anyone: the moving part's angle t seconds in, and whether it has landed.
  function runPart(id, t, stopAt) { return loops(id) ? loopPart(id, t, stopAt) : part(id, Math.min(1, t / RIDES[id].time)); }
  function runDone(id, t, stopAt) { return loops(id) ? loopDone(id, t, stopAt) : t >= RIDES[id].time; }

  var exported = {
    RIDES: RIDES, RAMP: RAMP, CUES: CUES, LOOPS: LOOPS, part: part, pose: pose, cues: cues, seat: seat, partner: partner,
    loops: loops, endAt: endAt, loopDone: loopDone, loopPart: loopPart, loopPose: loopPose, loopCues: loopCues,
    runPart: runPart, runDone: runDone
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Rides = exported;
})(this);
