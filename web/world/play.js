/* Playground rides: she walks up to the slide, the swings, the see-saw or the merry-go-round and taps; she rides with
   an animation (the pet bounces beside it) and lands beside the ride. The slide is one run; the others go on until
   she taps Stop. Nothing is saved or paid. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { grade, built, ctl, busy(on), cue(name) (optional: each sound moment the ride passes) }
  function create(o) {
    var R = W.Rides, pr = W.Layout.props(o.grade), ends = {}, ride = null;
    W.Layout.rideSpots(o.grade).forEach(function (s) { ends[s.id] = s.end; });

    function cue(names) {
      if (o.cue) names.forEach(function (name) { o.cue(name); });
    }

    function start(id) {
      if (ride || !R.RIDES[id]) return;
      ride = { id: id, t: 0, stopAt: null, loop: R.loops(id) };
      o.busy(true);
      cue(ride.loop ? R.loopCues(id, -1, 0, null) : R.cues(id, -1, 0));
    }

    // A looping ride finishes its loop, plays its ending and lands her.
    function stop() {
      if (ride && ride.loop && ride.stopAt === null) ride.stopAt = ride.t;
    }

    // Each frame: her pose while she rides, or null. The last frame puts her down at the ride's end spot.
    function tick(dt) {
      if (!ride) return null;
      var id = ride.id, from = ride.t, p, a, done;
      ride.t += dt;
      if (ride.loop) {
        cue(R.loopCues(id, from, ride.t, ride.stopAt));
        p = R.loopPose(pr, id, ride.t, ride.stopAt);
        a = R.loopPart(id, ride.t, ride.stopAt);
        done = R.loopDone(id, ride.t, ride.stopAt);
      } else {
        var time = R.RIDES[id].time, k = Math.min(1, ride.t / time);
        cue(R.cues(id, Math.min(1, from / time), k));
        p = R.pose(pr, id, k);
        a = R.part(id, k);
        done = k >= 1;
      }
      o.built.ride(id, a);
      if (done) {
        o.built.ride(id, null);
        ride = null;
        o.ctl.teleport(ends[id].x, ends[id].z, ends[id].face);
        o.busy(false);
      }
      return p;
    }

    return {
      start: start, stop: stop, tick: tick,
      riding: function () { return ride ? ride.id : null; },
      stoppable: function () { return !!ride && ride.loop && ride.stopAt === null; },
      // Her ride as a run for the playground kids (mateboard.js): { id, t, stopAt }, or null.
      now: function () { return ride ? { id: ride.id, t: ride.t, stopAt: ride.loop ? ride.stopAt : null } : null; }
    };
  }

  W.Play = { create: create };
})(this);
