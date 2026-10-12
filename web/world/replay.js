/* Slow-motion replay of the last seconds of a Patintero tag. No DOM, no Three.js.
   A frame is { dt, at: { id: { x, z, face } } }, dt being the time since the frame before it. The recorder keeps the
   newest frames whose span (the sum of dt after the first frame) is at least KEEP seconds, dropping the oldest frame
   only while the rest still span KEEP, so a clip is KEEP to KEEP + one frame long. */
(function (root) {
  'use strict';

  var KEEP = 2.5;

  function length(clip) {
    var s = 0, i;
    for (i = 1; i < clip.length; i++) s += clip[i].dt;
    return s;
  }

  function create() {
    var frames = [];
    function push(dt, at) {
      frames.push({ dt: dt, at: at });
      while (frames.length > 2 && length(frames) - frames[1].dt >= KEEP - 1e-9) frames.shift();
    }
    function clip() { return frames.slice(); }
    function clear() { frames = []; }
    return { push: push, clip: clip, clear: clear };
  }

  // Positions t seconds into the clip (clamped to it), between the two frames either side; {} for an empty clip.
  function sample(clip, t) {
    var out = {}, i = 1, at = 0, a, b, k;
    if (!clip.length) return out;
    t = Math.max(0, t);
    while (i < clip.length - 1 && at + clip[i].dt < t) { at += clip[i].dt; i++; }
    if (clip.length === 1) { a = b = clip[0]; k = 0; }
    else { a = clip[i - 1]; b = clip[i]; k = b.dt > 0 ? Math.max(0, Math.min(1, (t - at) / b.dt)) : 1; }
    Object.keys(a.at).forEach(function (id) {
      var p = a.at[id], q = b.at[id] || p;
      out[id] = { x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k, face: k < 0.5 ? p.face : q.face };
    });
    return out;
  }

  // Plays a clip at speed (0.3 = slow motion), so it lasts length / speed seconds; tick(dt) returns the positions to show.
  function player(clip, speed) {
    var t = 0, end = length(clip), over = false;
    return {
      tick: function (dt) {
        t = Math.min(end, t + dt * speed);
        if (t >= end) over = true;
        return sample(clip, t);
      },
      skip: function () { over = true; },
      done: function () { return over; }
    };
  }

  var exported = { KEEP: KEEP, create: create, sample: sample, length: length, player: player };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Replay = exported;
})(this);
