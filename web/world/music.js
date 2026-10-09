/* A soft music-box loop for the 3D world, synthesized with Web Audio so no audio file is needed. MIDI note numbers;
   null is a rest. */
(function (root) {
  'use strict';

  var MELODY = [72, 76, 79, 76, 74, 72, 69, 72, 74, 76, 74, 72, 67, 69, 72, null];
  var BASS = [48, 55, 45, 52];
  var BEAT = 0.42;

  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function create(win) {
    var ctx = null, master = null, timer = null, at = 0, i = 0;

    function note(n, t, vol, dur) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq(n);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function schedule() {
      // A throttled timer can fall far behind: skip ahead instead of piling up the missed notes at once.
      if (at < ctx.currentTime) at = ctx.currentTime + 0.05;
      while (at < ctx.currentTime + 1) {
        var n = MELODY[i % MELODY.length];
        if (n !== null) note(n, at, 0.05, 1.2);
        if (i % 4 === 0) note(BASS[Math.floor(i / 4) % BASS.length], at, 0.03, 1.8);
        at += BEAT;
        i++;
      }
    }

    return {
      start: function () {
        var AC = win.AudioContext || win.webkitAudioContext;
        if (!AC) return;
        try {
          if (!ctx) {
            ctx = new AC();
            master = ctx.createGain();
            master.connect(ctx.destination);
          }
          if (ctx.resume) ctx.resume();
          master.gain.setValueAtTime(1, ctx.currentTime);
          if (timer) return;
          at = ctx.currentTime + 0.1;
          schedule();
          timer = win.setInterval(schedule, 250);
        } catch (e) { timer = null; }
      },
      running: function () { return !!ctx && ctx.state === 'running' && !!timer; },
      stop: function () {
        if (timer) win.clearInterval(timer);
        timer = null;
        if (master) master.gain.setValueAtTime(0, ctx.currentTime);
      },
      playing: function () { return !!timer; }
    };
  }

  var exported = { MELODY: MELODY, BASS: BASS, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Music = exported;
})(this);
